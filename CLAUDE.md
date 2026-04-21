# VK Transleator — Project Overview

## Status: REBASED — Vercel + Supabase Cloud + VPS (Phase 7)
Откат от single-VPS к оригинальной распределённой архитектуре.
Причина: Supabase Realtime v2.31.0 на VPS не запускал миграции → WebSocket не работал.

## Architecture
```
Phone (Larix RTMP)
  → VPS:1935 (nginx-rtmp Docker)
  → OBS Headless + Xvfb
      ├── Camera Source: rtmp://localhost/live/stream
      └── Browser Source: https://<vercel-app>/overlay  ← OVERLAY_URL env var
  → VK RTMP endpoint

Admin/Overlay (Vercel CDN)
  ↔ Supabase Cloud (PostgREST + Realtime WebSocket)
  → https://obs.kalininlive.ru/stream-control/ → Flask API (port 5000)
```

## File Map

| Файл | Назначение |
|------|-----------|
| [install.sh](install.sh) | Установка VPS: nginx-rtmp + OBS + Flask API (без Docker БД) |
| [docker-compose.db.yml](docker-compose.db.yml) | Только vk-nginx-rtmp (postgres/postgrest/realtime убраны) |
| [supabase_setup.sql](supabase_setup.sql) | SQL схема — запускать в Supabase Dashboard → SQL Editor |
| [api.py](api.py) | Flask API: читает Supabase через HTTP REST (не psycopg2) |
| [app/](app/) | React frontend (Vite) — деплоится на Vercel |
| [app/src/supabase.ts](app/src/supabase.ts) | Supabase клиент — требует VITE_* env vars (нет fallback) |
| [app/vercel.json](app/vercel.json) | Vercel SPA routing + overlay CORS headers |

## Environment Variables

### Vercel (app/.env → Vercel Dashboard → Environment Variables)
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
VITE_ADMIN_PIN=252525
```

### VPS (systemd service / .vps.env)
```
SERVER_HOST=obs.kalininlive.ru
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY
OVERLAY_URL=https://YOUR_APP.vercel.app/overlay
```

## Docker Services on VPS

| Контейнер | Image | Port |
|-----------|-------|------|
| vk-nginx-rtmp | tiangolo/nginx-rtmp | 1935, 8080 |

## Nginx Proxy Map (VPS)

| URL | → | Сервис |
|-----|---|--------|
| `/stream-control/` | → | localhost:5000 (Flask API) |
| `/hls/` | → | localhost:8080/hls/ (nginx-rtmp HLS) |

> `/rest/v1/` и `/realtime/v1/` убраны — фронт обращается напрямую к Supabase Cloud

## Deployment Checklist

### Supabase Cloud (cloud.supabase.com)
- [ ] Создать новый проект (free tier)
- [ ] Settings → API → скопировать URL, anon key, service role key
- [ ] SQL Editor → вставить и запустить `supabase_setup.sql`

### Vercel
- [ ] Новый проект → Import Git Repository
- [ ] Root Directory: `app/`
- [ ] Framework Preset: Vite
- [ ] Environment Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_ADMIN_PIN
- [ ] Deploy → проверить `/overlay` и `/admin`

### VPS (obs.kalininlive.ru)
- [ ] Создать `.vps.env` с SERVER_HOST, SUPABASE_URL, SUPABASE_SERVICE_KEY, OVERLAY_URL
- [ ] Запустить `install.sh` заново (или вручную обновить systemd env + перезапустить)
- [ ] Остановить старые контейнеры: `docker rm -f vk-postgres vk-postgrest vk-realtime`

## Checklist Features
- [x] React overlay (scoreboard styles: Classic, Flat, Neon, Stadium)
- [x] Admin panel с управлением матчем, дизайном, банерами, субтитрами
- [x] Supabase Realtime подписки (useMatchState, overlay_settings)
- [x] OBS headless + Browser Source (overlay на Vercel)
- [x] Flask API: start/stop/status через /stream-control/
- [x] api.py использует HTTP REST к Supabase (не прямое psycopg2 подключение)
- [ ] Vercel deployed
- [ ] Supabase Cloud project created + schema applied
- [ ] VPS updated with new env vars
