// ── Состояние матча (JSON в football_match_state.state) ─────────────────────
export interface MatchState {
  teams: {
    team1: { name: string; city: string; logo: string; color: string };
    team2: { name: string; city: string; logo: string; color: string };
  };
  score: { team1: number; team2: number };
  timer: {
    isRunning: boolean;
    startTimestamp: number | null;
    accumulatedTime: number;      // мс
    half: number;                 // 1 | 2
    halfDurationMinutes: number;  // порог предупреждения (устарело — теперь в overlay_settings)
  };
  // Заставка (экран паузы перед матчем / в перерыве)
  pauseScreen: {
    isActive: boolean;
    mediaUrl: string;   // URL или base64 картинки/видео
    text: string;
    audioUrl: string;   // URL или base64 MP3 — играет на репите пока заставка активна
  };
  bottomBanner: {
    isActive: boolean;
    text: string;
    mode: 'scroll' | 'image';
    size: 'S' | 'M' | 'L';
    imageUrl: string;
    speed: number;
  };
  subtitles: {
    isActive: boolean;
    text: string;
    size: 'S' | 'M' | 'L';
  };
  goalAnimation: {
    isActive: boolean;
    goalId: number;         // уникальный ID каждого гола (Date.now()) — гарантирует срабатывание эффекта
    teamSide: 'team1' | 'team2';
    teamName: string;
    newScore: { team1: number; team2: number };
    soundUrl: string;       // кастомный звук гола (наш) — fallback если playlist пуст
    concededSoundUrl: string; // кастомный звук гола (нам) — fallback если playlist пуст
    animationsEnabled: boolean; // вкл/выкл анимации голов
    soundPlaylistIds: number[];      // IDs треков из media_library для нашего гола
    concededPlaylistIds: number[];   // IDs треков из media_library для пропущенного гола
    playlistMode: 'sequence' | 'random'; // режим плейлиста
  };
  ourTeam: 'team1' | 'team2' | null; // наша команда для разделения гол/пропустили
  streamTitle: string;               // название стрима (передаётся в ВК)
  sponsorLogo: {
    isActive: boolean;
    imageUrl: string;
    size: number;
  };
  cardEvent: {
    isActive: boolean;
    cardId: number;                  // Date.now() — уникальный ID, триггер анимации
    teamSide: 'team1' | 'team2';
    cardType: 'yellow' | 'red';
    playerName: string;
  };
  introScreen: {
    isActive: boolean;
    countdown: number | null;        // обратный отсчёт в секундах (null = без отсчёта)
    audioUrl: string;                // base64 MP3 — fallback если playlist пуст
    soundPlaylistIds: number[];      // IDs треков из media_library
    playlistMode: 'sequence' | 'random';
  };
  pauseScreenPlaylist: {             // плейлист для заставки паузы (отдельно от pauseScreen.audioUrl)
    soundPlaylistIds: number[];
    playlistMode: 'sequence' | 'random';
  };
}

// ── Элемент медиатеки ────────────────────────────────────────────────────────
export interface MediaLibraryItem {
  id: number;
  name: string;
  data_url?: string;   // только при полной загрузке
  created_at?: string;
}

// ── Визуальные настройки оверлея (overlay_settings) ─────────────────────────
export interface OverlaySettings {
  id: number;
  scale: number;           // 0.5 – 2.0
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center-center';
  logo_size: number;       // px
  glass_enabled: boolean;
  backdrop_color: string;
  backdrop_opacity: number;
  color_team_name: string;
  color_city: string;
  color_city_badge: string; // цвет плашки под названием города
  color_timer: string;
  color_half: string;
  timer_warning_min: number;
  sponsor_size: number;
  scoreboard_style: 'classic' | 'stadium' | 'flat' | 'neon'; // макет табло
  logo_shape: 'square' | 'rounded' | 'circle' | 'circle-border'; // форма логотипа команды
  strip_enabled: boolean;    // полосы-акценты рядом с логотипом
  strip_color: string;       // цвет полос (hex)
  score_font: 'default' | 'mono' | 'bold'; // стиль шрифта счёта
  color_score: string;       // цвет цифр счёта
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  id: 1,
  scale: 1.0,
  position: 'top-left',
  logo_size: 64,
  glass_enabled: true,
  backdrop_color: '#000000',
  backdrop_opacity: 0,
  color_team_name: '#ffffff',
  color_city: '#93c5fd',
  color_city_badge: '#dc2626',
  color_timer: '#ffffff',
  color_half: 'rgba(255,255,255,0.4)',
  timer_warning_min: 35,
  sponsor_size: 80,
  scoreboard_style: 'classic',
  logo_shape: 'rounded',
  strip_enabled: false,
  strip_color: '#ffffff',
  score_font: 'default',
  color_score: '#ffffff',
};

// ── VK Канал трансляции ──────────────────────────────────────────────────────
export interface VKChannel {
  id: number;
  name: string;
  rtmp_url: string;
  stream_key: string;
  is_active: boolean;
  created_at?: string;
}

// ── Конфиг авторизации ───────────────────────────────────────────────────────
export interface AppConfig {
  id: number;
  username: string;
  password_hash: string;  // SHA-256 hex
  control_api_url: string; // URL сервера управления стримом (напр. https://obs.kalininlive.ru/stream-control/)
  control_secret: string;  // секрет для x-secret заголовка
}
