# VK Transleator

Система трансляции футбольных матчей на VK с live-оверлеем (табло, счёт, таймер, анимации).

## Архитектура

```
Телефон (Larix / любой RTMP)
  → VPS:1935 (nginx-rtmp)
  → OBS Headless + Xvfb
      ├── Camera: rtmp://localhost/live/stream
      └── Browser Source: https://<vercel>.vercel.app/overlay
  → VK RTMP

Администратор → https://<vercel>.vercel.app/admin
  ↔ Supabase Cloud (REST + Realtime WebSocket)
  → https://<vps>/stream-control/ → Flask API (OBS start/stop)
```

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Realtime | Supabase JS Client (WebSocket) |
| Database | Supabase Cloud (PostgreSQL + PostgREST + Realtime) |
| Hosting Frontend | Vercel |
| VPS | OBS headless + Xvfb + nginx-rtmp (Docker) + Python Flask |

## Возможности оверлея

- 4 стиля табло: Classic, Stadium, Flat, Neon
- Таймер с паузой, сменой тайма, предупреждением об овертайме
- Анимация гола / пропущенного мяча со звуком
- Анимация карточек (жёлтая / красная)
- Интро-экран с обратным отсчётом
- Пауза-экран с медиа (видео / картинка)
- Бегущая строка / баннер внизу
- Субтитры
- Логотип спонсора
- Медиатека (звуки голов, проигрыша, интро)

---

## Быстрый старт

### 1. Supabase — создать проект

1. Перейти на [supabase.com](https://supabase.com) → New Project
2. **Settings → API** → скопировать:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → нужен для VPS install.sh
3. **SQL Editor → New Query** → вставить содержимое [`supabase_setup.sql`](supabase_setup.sql) → Run

### 2. Vercel — задеплоить фронтенд

1. Fork или clone этого репозитория на GitHub
2. [vercel.com](https://vercel.com) → New Project → Import Git Repository
3. **Root Directory**: `app/`
4. **Framework Preset**: Vite
5. **Environment Variables** (добавить все три):

| Переменная | Значение |
|------------|---------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |
| `VITE_ADMIN_PIN` | `252525` (или свой) |

6. Deploy → запомни URL вида `https://your-app.vercel.app`

### 3. VPS — установка

```bash
# Клонировать репозиторий на сервер
git clone https://github.com/kalininlive/vk-transleator.git /opt/vk-stream-src
cd /opt/vk-stream-src

# Запустить установщик (спросит домен, Supabase keys, логин/пароль)
bash install.sh
```

При запросах ввести:
- **Домен VPS** — например `obs.example.com` (должен быть направлен на сервер)
- **Supabase URL** — `https://xxx.supabase.co`
- **Supabase Service Role Key** — секретный ключ из Settings → API
- **Vercel Overlay URL** — `https://your-app.vercel.app/overlay`
- **Логин / пароль** — для входа в панель управления

### 4. OBS Browser Source — настройка

В OBS (install.sh настраивает автоматически):
- **Browser Source URL**: `https://your-app.vercel.app/overlay`
- Размер: 1920×1080
- CSS: `body { background: transparent !important; margin: 0; }`
- ✅ Прозрачность фона (Chroma Key не нужен)

### 5. Стриминг телефона

В приложении Larix Broadcaster (или любом RTMP):
- **URL**: `rtmp://your-vps.com:1935/live/`
- **Key**: `stream`

---

## SQL Schema (Supabase)

Полный файл: [`supabase_setup.sql`](supabase_setup.sql)

```sql
-- Состояние матча (Realtime)
CREATE TABLE public.football_match_state (
  id         BIGINT PRIMARY KEY DEFAULT 1,
  state      JSONB  NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Настройки оверлея (Realtime)
CREATE TABLE public.overlay_settings (
  id               BIGINT  PRIMARY KEY DEFAULT 1,
  scale            FLOAT   DEFAULT 1.0,
  position         TEXT    DEFAULT 'top-left',
  scoreboard_style TEXT    DEFAULT 'classic',
  logo_size        INT     DEFAULT 64,
  logo_shape       TEXT    DEFAULT 'rounded',
  glass_enabled    BOOLEAN DEFAULT true,
  backdrop_color   TEXT    DEFAULT '#000000',
  backdrop_opacity FLOAT   DEFAULT 0.6,
  color_team_name  TEXT    DEFAULT '#ffffff',
  color_city       TEXT    DEFAULT '#93c5fd',
  color_city_badge TEXT    DEFAULT '#dc2626',
  color_timer      TEXT    DEFAULT '#ffffff',
  color_score      TEXT    DEFAULT '#ffffff',
  timer_warning_min INT    DEFAULT 35,
  sponsor_size     INT     DEFAULT 80,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- VK RTMP каналы
CREATE TABLE public.vk_channels (
  id         SERIAL  PRIMARY KEY,
  name       TEXT    NOT NULL,
  rtmp_url   TEXT    NOT NULL,
  stream_key TEXT    NOT NULL,
  is_active  BOOLEAN DEFAULT false
);

-- Конфиг приложения (admin + VPS API endpoint)
CREATE TABLE public.app_config (
  id              BIGINT PRIMARY KEY DEFAULT 1,
  username        TEXT   NOT NULL DEFAULT 'admin',
  password_hash   TEXT   NOT NULL DEFAULT '',
  control_api_url TEXT   DEFAULT '',
  control_secret  TEXT   DEFAULT ''
);

-- Медиатека (звуки, музыка — base64 dataURL)
CREATE TABLE public.media_library (
  id       SERIAL PRIMARY KEY,
  name     TEXT   NOT NULL,
  data_url TEXT   NOT NULL
);
```

---

## Структура файлов

```
/
├── app/                    # React frontend (деплоится на Vercel)
│   ├── src/
│   │   ├── App.tsx         # Роутер: /admin, /overlay
│   │   ├── AdminPanel.tsx  # Панель управления
│   │   ├── Overlay.tsx     # Оверлей для OBS
│   │   ├── supabase.ts     # Supabase client
│   │   ├── useMatchState.ts# Realtime hook
│   │   ├── types.ts        # TypeScript интерфейсы
│   │   └── scoreboards/    # Classic, Flat, Neon, Stadium
│   ├── .env.example        # Пример env vars
│   └── vercel.json         # SPA routing + overlay CORS
├── api.py                  # Flask API (VPS: start/stop OBS)
├── install.sh              # Установщик VPS
├── supabase_setup.sql      # SQL схема для Supabase Cloud
├── docker-compose.db.yml   # nginx-rtmp only
└── CLAUDE.md               # Документация для AI-ассистента
```

---

## Flask API (VPS)

Все запросы требуют заголовка `x-secret: <API_SECRET>`.

| Endpoint | Метод | Описание |
|----------|-------|---------|
| `/status` | GET | Статус стрима (streaming: true/false) |
| `/start` | POST | Запустить OBS + трансляцию |
| `/stop` | POST | Остановить трансляцию |
| `/overlay/update` | POST | Обновить состояние оверлея |
| `/score` | POST | Обновить счёт |

```bash
curl -X POST https://your-vps.com/stream-control/start \
  -H "x-secret: your_api_secret"
```

---

## Env vars

| Переменная | Где задаётся | Описание |
|------------|-------------|---------|
| `VITE_SUPABASE_URL` | Vercel | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel | Supabase anon key |
| `VITE_ADMIN_PIN` | Vercel | PIN для входа в /admin |
| `SUPABASE_URL` | VPS / install.sh | Supabase Project URL |
| `SUPABASE_SERVICE_KEY` | VPS / install.sh | Supabase service role key |
| `OVERLAY_URL` | VPS / install.sh | URL оверлея на Vercel |
| `API_SECRET` | VPS / install.sh | Секрет для Flask API |
| `SERVER_HOST` | VPS / install.sh | Домен VPS |
