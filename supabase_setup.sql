-- ============================================================
-- VK Transleator — Supabase Cloud Schema Setup
-- Запустить в: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. МАТЧ — основное состояние (JSON-blob)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.football_match_state (
  id         BIGINT      PRIMARY KEY DEFAULT 1,
  state      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.football_match_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read"   ON public.football_match_state;
DROP POLICY IF EXISTS "Public Update" ON public.football_match_state;
CREATE POLICY "Public Read"   ON public.football_match_state FOR SELECT USING (true);
CREATE POLICY "Public Update" ON public.football_match_state FOR UPDATE USING (true);

-- Включить Realtime для этой таблицы
ALTER PUBLICATION supabase_realtime ADD TABLE public.football_match_state;

INSERT INTO public.football_match_state (id, state) VALUES (1, '{
  "teams": {
    "team1": { "name": "Команда 1", "city": "Город 1", "logo": "", "color": "#3b82f6" },
    "team2": { "name": "Команда 2", "city": "Город 2", "logo": "", "color": "#ef4444" }
  },
  "score": { "team1": 0, "team2": 0 },
  "timer": {
    "isRunning": false,
    "startTimestamp": null,
    "accumulatedTime": 0,
    "half": 1,
    "halfDurationMinutes": 35
  },
  "pauseScreen": { "isActive": false, "mediaUrl": "", "text": "", "audioUrl": "" },
  "bottomBanner": {
    "isActive": false, "text": "Текст баннера", "mode": "scroll",
    "size": "M", "speed": 1, "imageUrl": ""
  },
  "subtitles": { "isActive": false, "text": "", "size": "M" },
  "goalAnimation": {
    "isActive": false, "goalId": 0,
    "teamSide": "team1", "teamName": "",
    "newScore": { "team1": 0, "team2": 0 },
    "soundUrl": "", "concededSoundUrl": "", "animationsEnabled": true
  },
  "ourTeam": null,
  "sponsorLogo": { "isActive": false, "imageUrl": "", "size": 80 },
  "cardEvent": {
    "isActive": false, "cardId": 0,
    "teamSide": "team1", "cardType": "yellow", "playerName": ""
  },
  "introScreen": { "isActive": false, "countdown": null, "audioUrl": "" }
}'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- 2. НАСТРОЙКИ ОВЕРЛЕЯ
-- ============================================================
CREATE TABLE IF NOT EXISTS public.overlay_settings (
  id               BIGINT   PRIMARY KEY DEFAULT 1,
  scale            FLOAT    DEFAULT 1.0,
  position         TEXT     DEFAULT 'top-left',
  logo_size        INT      DEFAULT 64,
  logo_shape       TEXT     DEFAULT 'rounded',
  glass_enabled    BOOLEAN  DEFAULT true,
  backdrop_color   TEXT     DEFAULT '#000000',
  backdrop_opacity FLOAT    DEFAULT 0.6,
  scoreboard_style TEXT     DEFAULT 'classic',
  color_team_name  TEXT     DEFAULT '#ffffff',
  color_city       TEXT     DEFAULT '#93c5fd',
  color_city_badge TEXT     DEFAULT '#dc2626',
  color_timer      TEXT     DEFAULT '#ffffff',
  color_half       TEXT     DEFAULT 'rgba(255,255,255,0.4)',
  color_score      TEXT     DEFAULT '#ffffff',
  timer_warning_min INT     DEFAULT 35,
  sponsor_size     INT      DEFAULT 80,
  strip_enabled    BOOLEAN  DEFAULT false,
  strip_color      TEXT     DEFAULT '#ffffff',
  score_font       TEXT     DEFAULT 'default',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.overlay_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read"   ON public.overlay_settings;
DROP POLICY IF EXISTS "Public Update" ON public.overlay_settings;
CREATE POLICY "Public Read"   ON public.overlay_settings FOR SELECT USING (true);
CREATE POLICY "Public Update" ON public.overlay_settings FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.overlay_settings;

INSERT INTO public.overlay_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- 3. VK КАНАЛЫ (RTMP endpoints)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vk_channels (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL,
  rtmp_url   TEXT        NOT NULL,
  stream_key TEXT        NOT NULL,
  is_active  BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vk_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read" ON public.vk_channels;
DROP POLICY IF EXISTS "Public All"  ON public.vk_channels;
CREATE POLICY "Public Read" ON public.vk_channels FOR SELECT USING (true);
CREATE POLICY "Public All"  ON public.vk_channels FOR ALL    USING (true);


-- 4. КОНФИГ ПРИЛОЖЕНИЯ (авторизация + VPS API endpoint)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  id              BIGINT PRIMARY KEY DEFAULT 1,
  username        TEXT   NOT NULL DEFAULT 'admin',
  password_hash   TEXT   NOT NULL DEFAULT '',
  control_api_url TEXT   DEFAULT '',
  control_secret  TEXT   DEFAULT '',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read"   ON public.app_config;
DROP POLICY IF EXISTS "Public Update" ON public.app_config;
CREATE POLICY "Public Read"   ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Public Update" ON public.app_config FOR UPDATE USING (true);

-- Строка создаётся пустой; install.sh заполняет её через REST API
INSERT INTO public.app_config (id, username, password_hash)
VALUES (1, 'admin', '')
ON CONFLICT (id) DO NOTHING;


-- 5. МЕДИАТЕКА (звуки, музыка)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_library (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL,
  data_url   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public All" ON public.media_library;
CREATE POLICY "Public All" ON public.media_library FOR ALL USING (true);
