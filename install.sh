#!/bin/bash
# ============================================================
# VK Transleator — VPS Setup
# VPS: OBS headless + nginx-rtmp + Flask API
# DB/Realtime/Frontend: Supabase Cloud + Vercel
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
INSTALL_DIR="/opt/vk-stream"

# ─── Загрузка из .vps.env (если есть) ────────────────────────
get_vps_var() {
    [ -f ".vps.env" ] && grep "^$1=" .vps.env | head -n 1 | cut -d'=' -f2- | tr -d '\r'
}
if [ -f ".vps.env" ]; then
    export SERVER_HOST=$(get_vps_var SERVER_HOST)
    export SUPABASE_URL=$(get_vps_var SUPABASE_URL)
    export SUPABASE_SERVICE_KEY=$(get_vps_var SUPABASE_SERVICE_KEY)
    export OVERLAY_URL=$(get_vps_var OVERLAY_URL)
    export ADMIN_USERNAME=$(get_vps_var ADMIN_USERNAME)
    export ADMIN_PASSWORD=$(get_vps_var ADMIN_PASSWORD)
    export API_SECRET=$(get_vps_var API_SECRET)
fi

ask() {
    local var_val=$(eval echo \$$3)
    if [ -n "$var_val" ]; then return 0; fi
    echo -ne "${YELLOW}  $1 [${2}]: ${NC}"; read inp; eval "$3='${inp:-$2}'";
}
ask_secret() {
    local var_val=$(eval echo \$$2)
    if [ -n "$var_val" ]; then return 0; fi
    echo -ne "${YELLOW}  $1: ${NC}"; read -s inp; echo ""; eval "$2='$inp'";
}

echo -e "${BLUE}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║      VK Transleator — VPS Setup (RTMP)       ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════╝${NC}"

# ─── Шаг 1: Сбор данных ──────────────────────────────────────
echo -e "\n${BOLD}Шаг 1: Настройки${NC}"

ask         "Домен VPS (без https://)"                  "obs.example.com"           SERVER_HOST
ask         "Supabase Project URL (https://xxx.supabase.co)" ""                     SUPABASE_URL
ask_secret  "Supabase Service Role Key"                                              SUPABASE_SERVICE_KEY
ask         "Vercel Overlay URL"                         "https://your-app.vercel.app/overlay"  OVERLAY_URL
ask         "Логин администратора"                       "admin"                     ADMIN_USERNAME
ask_secret  "Пароль администратора (мин. 6 символов)"                               ADMIN_PASSWORD
ask         "API Secret для Flask (или оставьте дефолт)" "$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 32 2>/dev/null || echo 'change_me_stream_secret')" API_SECRET

# Валидация обязательных полей
for var in SUPABASE_URL SUPABASE_SERVICE_KEY ADMIN_PASSWORD; do
    while [ -z "$(eval echo \$$var)" ]; do
        if [ "$var" = "ADMIN_PASSWORD" ]; then
            ask_secret "Пароль обязателен (мин. 6 символов)" ADMIN_PASSWORD
        else
            ask "$var обязателен" "" $var
        fi
    done
done
while [ ${#ADMIN_PASSWORD} -lt 6 ]; do
    echo -e "${RED}Пароль слишком короткий (мин. 6 символов)${NC}"
    unset ADMIN_PASSWORD; ask_secret "Пароль администратора" ADMIN_PASSWORD
done

echo -e "\n${GREEN}Настройки приняты:${NC}"
echo -e "  Домен:        ${BOLD}${SERVER_HOST}${NC}"
echo -e "  Supabase:     ${BOLD}${SUPABASE_URL}${NC}"
echo -e "  Overlay URL:  ${BOLD}${OVERLAY_URL}${NC}"
echo -e "  Логин:        ${BOLD}${ADMIN_USERNAME}${NC}"

# ─── Шаг 2: Зависимости ──────────────────────────────────────
echo -e "\n${BOLD}Шаг 2: Зависимости${NC}"

rm -f /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock
dpkg --configure -a

export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
[ -f /etc/needrestart/needrestart.conf ] && \
    sed -i "s/^#\?\$nrconf{restart}.*/\$nrconf{restart} = 'a';/" /etc/needrestart/needrestart.conf

apt-get update -qq
apt-get install -y -f
apt-get install -y -qq openssl python3-flask python3-requests curl ffmpeg xvfb > /dev/null

if ! command -v obs &> /dev/null; then
    echo "Установка OBS Studio..."
    apt-get install -y -qq software-properties-common > /dev/null
    if timeout 30 add-apt-repository -y ppa:obsproject/obs-studio > /dev/null 2>&1; then
        apt-get update -qq
        apt-get install -y -qq obs-studio > /dev/null
    else
        apt-get install -y -qq obs-studio > /dev/null 2>&1 || \
            echo "⚠️  OBS не установлен — добавьте вручную позже"
    fi
fi

if ! command -v docker &> /dev/null; then
    apt-get install -y -qq docker.io > /dev/null
fi
if ! docker compose version &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin > /dev/null 2>&1 || \
    apt-get install -y -qq docker-compose > /dev/null 2>&1 || true
fi
docker compose version &> /dev/null && DC="docker compose" || DC="docker-compose"

apt-get install -y -qq nginx certbot python3-certbot-nginx > /dev/null

# ─── Шаг 3: nginx-rtmp ───────────────────────────────────────
echo -e "\n${BOLD}Шаг 3: nginx-rtmp (Docker)${NC}"
mkdir -p "$INSTALL_DIR"

cat > "$INSTALL_DIR/nginx-rtmp.conf" <<'RTMPEOF'
worker_processes auto;
rtmp_auto_push on;
events {}
rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        application live {
            live on;
            record off;
            hls on;
            hls_path /tmp/hls;
            hls_fragment 1s;
            hls_playlist_length 3s;
            hls_cleanup on;
        }
    }
}
http {
    include mime.types;
    default_type application/octet-stream;
    server {
        listen 8080;
        location /hls {
            types { application/vnd.apple.mpegurl m3u8; video/mp2t ts; }
            root /tmp;
            add_header Cache-Control no-cache;
            add_header 'Access-Control-Allow-Origin' '*';
        }
        location /stat { rtmp_stat all; }
    }
}
RTMPEOF

docker rm -f vk-nginx-rtmp >/dev/null 2>&1 || true
docker run -d \
    --name vk-nginx-rtmp \
    --restart always \
    -p 1935:1935 \
    -p 8080:8080 \
    -v "$INSTALL_DIR/nginx-rtmp.conf:/etc/nginx/nginx.conf:ro" \
    tiangolo/nginx-rtmp
echo "nginx-rtmp запущен (порт 1935)"

# ─── Шаг 4: SSL Nginx ────────────────────────────────────────
echo -e "\n${BOLD}Шаг 4: Nginx SSL${NC}"
systemctl stop nginx || true

certbot certonly --standalone -d "${SERVER_HOST}" \
    --non-interactive --agree-tos -m "admin@${SERVER_HOST}" \
    || echo "⚠️  SSL: ошибка certbot, продолжаем..."

cat > /etc/nginx/sites-available/vk-stream <<NGINXEOF
server {
    listen 80;
    server_name ${SERVER_HOST};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${SERVER_HOST};
    ssl_certificate     /etc/letsencrypt/live/${SERVER_HOST}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${SERVER_HOST}/privkey.pem;

    location /stream-control/ {
        proxy_pass         http://127.0.0.1:5000/;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
    }

    location /hls/ {
        proxy_pass       http://127.0.0.1:8080/hls/;
        add_header       Cache-Control no-cache;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/vk-stream /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# ─── Шаг 5: Flask API ────────────────────────────────────────
echo -e "\n${BOLD}Шаг 5: Flask API${NC}"
mkdir -p "$INSTALL_DIR/api"
cp api.py "$INSTALL_DIR/api/main.py"

cat > /etc/systemd/system/vk-stream-control.service <<SVCEOF
[Unit]
Description=VK Stream Control API
After=network.target

[Service]
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/api/main.py
Restart=always
Environment=SERVER_HOST=${SERVER_HOST}
Environment=SUPABASE_URL=${SUPABASE_URL}
Environment=SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
Environment=OVERLAY_URL=${OVERLAY_URL}
Environment=API_SECRET=${API_SECRET}

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable vk-stream-control
systemctl restart vk-stream-control

# ─── Шаг 6: Инициализация Supabase ───────────────────────────
echo -e "\n${BOLD}Шаг 6: Настройка данных в Supabase${NC}"

PASS_HASH=$(echo -n "$ADMIN_PASSWORD" | openssl dgst -sha256 | awk '{print $NF}')
CONTROL_URL="https://${SERVER_HOST}/stream-control/"

echo "Записываю admin credentials и конфиг API в Supabase..."
HTTP_STATUS=$(curl -s -o /tmp/supabase_resp.json -w "%{http_code}" \
    -X POST "${SUPABASE_URL}/rest/v1/app_config" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates,return=minimal" \
    -d "[{\"id\": 1, \"username\": \"${ADMIN_USERNAME}\", \"password_hash\": \"${PASS_HASH}\", \"control_api_url\": \"${CONTROL_URL}\", \"control_secret\": \"${API_SECRET}\"}]")

if [ "$HTTP_STATUS" = "201" ] || [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "204" ]; then
    echo -e "${GREEN}✓ Admin credentials записаны в Supabase${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP ${HTTP_STATUS} от Supabase. Ответ:${NC}"
    cat /tmp/supabase_resp.json
    echo ""
    echo "Если SQL-схема ещё не применена — запустите supabase_setup.sql в Supabase Dashboard"
fi

# ─── Итог ────────────────────────────────────────────────────
echo -e "\n${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  УСТАНОВКА ЗАВЕРШЕНА!${NC}"
echo -e "${GREEN}${BOLD}════════════════════════════════════════${NC}"
echo ""
echo -e "  Flask API:     ${BOLD}https://${SERVER_HOST}/stream-control/${NC}"
echo -e "  RTMP приём:    ${BOLD}rtmp://${SERVER_HOST}:1935/live/stream${NC}"
echo -e "  HLS поток:     ${BOLD}https://${SERVER_HOST}/hls/stream.m3u8${NC}"
echo -e "  OBS Overlay:   ${BOLD}${OVERLAY_URL}${NC}"
echo -e "  Admin логин:   ${BOLD}${ADMIN_USERNAME}${NC}"
echo ""
echo -e "${BOLD}Статус Docker:${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""
echo -e "${BOLD}Статус сервиса:${NC}"
systemctl is-active vk-stream-control && echo -e "${GREEN}✓ vk-stream-control работает${NC}" || \
    echo -e "${RED}✗ vk-stream-control не запущен — проверьте: journalctl -u vk-stream-control -n 20${NC}"
