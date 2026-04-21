import React, { useState, useRef, useEffect } from 'react';
import { useMatchState, useOverlaySettings, useVKChannels, useStreamControl, useMediaLibrary } from './useMatchState';
import { MatchState, OverlaySettings, VKChannel, MediaLibraryItem } from './types';
import { supabase } from './supabase';

// SHA-256 helper
async function sha256(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Экран входа ────────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }: { onAuth: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) { setError('Введите логин и пароль'); return; }
    setLoading(true); setError('');
    try {
      const hash = await sha256(password);
      const { data } = await supabase.from('app_config').select('username,password_hash').eq('id', 1).single();
      if (data?.username === username && data?.password_hash === hash) {
        localStorage.setItem('vk_auth', '1');
        onAuth();
      } else { setError('Неверный логин или пароль'); }
    } catch { setError('Ошибка подключения'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex justify-center items-center p-4">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎙</div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">VK Stream</h1>
          <p className="text-gray-500 text-sm mt-1">Панель управления трансляцией</p>
        </div>
        <div className="space-y-3">
          <input type="text" value={username} onChange={e => setUsername(e.target.value)}
            placeholder="Логин" autoFocus
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Пароль"
            className="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition" />
          {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}
          <button type="button" onClick={handleLogin} disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 active:scale-95 transition text-white font-black uppercase tracking-widest py-4 rounded-xl">
            {loading ? '...' : 'ВОЙТИ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Главный компонент ──────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [isAuthenticated, setIsAuth] = useState(() => localStorage.getItem('vk_auth') === '1');
  if (!isAuthenticated) return <LoginScreen onAuth={() => setIsAuth(true)} />;
  return <AdminDashboard onLogout={() => { localStorage.removeItem('vk_auth'); setIsAuth(false); }} />;
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { state, updateState, resetMatch, triggerGoalAnimation, triggerCardEvent, loading: ml } = useMatchState();
  const { settings, updateSettings, resetToDefaults, loading: sl } = useOverlaySettings();
  const { channels, addChannel, deleteChannel, setActiveChannel, updateChannel } = useVKChannels();
  const mediaLib = useMediaLibrary();
  const [tab, setTab] = useState<'live' | 'match' | 'design' | 'fx' | 'library' | 'access'>('live');

  if (ml || sl || !state) return (
    <div className="text-white bg-gray-950 min-h-screen p-10 font-bold uppercase text-xl animate-pulse">📡 Подключение...</div>
  );

  const toggleTimer = () => {
    if (state.timer.isRunning) {
      const accum = state.timer.accumulatedTime + (state.timer.startTimestamp ? Date.now() - state.timer.startTimestamp : 0);
      updateState({ ...state, timer: { ...state.timer, isRunning: false, accumulatedTime: accum, startTimestamp: null } });
    } else {
      updateState({ ...state, timer: { ...state.timer, isRunning: true, startTimestamp: Date.now() } });
    }
  };

  const updateScore = (team: 'team1' | 'team2', delta: number) => {
    if (delta > 0) {
      triggerGoalAnimation(team, state.teams[team].name, { ...state.score, [team]: state.score[team] + delta });
    } else {
      updateState({ ...state, score: { ...state.score, [team]: Math.max(0, state.score[team] + delta) } });
    }
  };

  const TABS = [
    { id: 'live' as const,    label: 'ЭФИР',       icon: '🔴' },
    { id: 'match' as const,   label: 'МАТЧ',        icon: '⚽' },
    { id: 'design' as const,  label: 'ДИЗАЙН',      icon: '🎨' },
    { id: 'library' as const, label: 'МЕДИАТЕКА',   icon: '🎵' },
    { id: 'fx' as const,      label: 'FX ЭФФЕКТЫ',  icon: '🎛' },
    { id: 'access' as const,  label: 'ДОСТУП',      icon: '🔑' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header nav */}
      <div className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-3 py-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex gap-0.5 flex-wrap">
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition flex items-center gap-1 flex-shrink-0
                  ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/30 hover:text-white/60'}`}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={onLogout}
            className="text-white/20 hover:text-white/50 text-[10px] font-black uppercase tracking-widest transition px-2 py-1 flex-shrink-0 ml-1">
            Выйти
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-3 pb-28">
        {tab === 'live'    && <LiveTab state={state} updateState={updateState} updateScore={updateScore} toggleTimer={toggleTimer} resetMatch={resetMatch} settings={settings} updateSettings={updateSettings} channels={channels} triggerCardEvent={triggerCardEvent} />}
        {tab === 'match'   && <MatchTab state={state} updateState={updateState} channels={channels} setActiveChannel={setActiveChannel} />}
        {tab === 'design'  && <DesignTab state={state} updateState={updateState} settings={settings} updateSettings={updateSettings} resetToDefaults={resetToDefaults} />}
        {tab === 'library' && <LibraryTab mediaLib={mediaLib} />}
        {tab === 'fx'      && <FxTab state={state} updateState={updateState} mediaLib={mediaLib} />}
        {tab === 'access'  && <AccessTab channels={channels} addChannel={addChannel} deleteChannel={deleteChannel} updateChannel={updateChannel} />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// ВКЛ. В ЭФИРЕ — полный пульт
// ═══════════════════════════════════════════
function LiveTab({ state, updateState, updateScore, toggleTimer, resetMatch, settings, updateSettings, channels, triggerCardEvent }: {
  state: MatchState; updateState: (s: MatchState) => void;
  updateScore: (t: 'team1' | 'team2', d: number) => void;
  toggleTimer: () => void; resetMatch: () => void;
  settings: OverlaySettings; updateSettings: (p: Partial<OverlaySettings>) => void;
  channels: import('./types').VKChannel[];
  triggerCardEvent: (teamSide: 'team1' | 'team2', cardType: 'yellow' | 'red', playerName: string) => Promise<void>;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [cardPlayerName, setCardPlayerName] = useState('');
  const [streamMsg, setStreamMsg] = useState('');
  const [streamBusy, setStreamBusy] = useState(false);
  const [isLive, setIsLive] = useState<boolean | null>(null);
  const activeChannel = channels.find(c => c.is_active);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/stream-control/status', {
          headers: { 'x-secret': 'super_secret_stream_key_123' }
        });
        const json = await res.json().catch(() => ({}));
        if (json.status === 'ok') setIsLive(!!json.streaming);
        else setIsLive(false);
      } catch { setIsLive(false); }
    };
    checkStatus();
    const iv = setInterval(checkStatus, 10000);
    return () => clearInterval(iv);
  }, []);

  const toggleStream = async () => {
    const action = isLive ? 'stop' : 'start';
    setStreamBusy(true); setStreamMsg('');
    try {
      const res = await fetch(`/stream-control/${action}`, {
        method: 'POST',
        headers: { 'x-secret': 'super_secret_stream_key_123' }
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok || json.status === 'ok') {
        setIsLive(!isLive);
        setStreamMsg(action === 'start' ? '✓ Трансляция запущена' : '✓ Трансляция остановлена');
      } else {
        setStreamMsg(json.message ?? json.error ?? 'Ошибка сервера');
      }
    } catch {
      setStreamMsg('Нет связи с сервером');
    }
    setStreamBusy(false);
    setTimeout(() => setStreamMsg(''), 6000);
  };

  const elapsedMs = state.timer.accumulatedTime +
    (state.timer.isRunning && state.timer.startTimestamp ? Date.now() - state.timer.startTimestamp : 0);
  const warningMs = settings.timer_warning_min * 60000;
  const isOvertime = elapsedMs >= warningMs;
  const mm = Math.floor(elapsedMs / 60000).toString().padStart(2, '0');
  const ss = Math.floor((elapsedMs % 60000) / 1000).toString().padStart(2, '0');

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

      {/* ── Левая колонка: быстрые переключатели — ВТОРАЯ на мобильном ── */}
      <div className="order-2 md:order-1 md:col-span-4 space-y-3">

        {/* Управление трансляцией */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Трансляция</div>
          {activeChannel && <div className="text-[11px] font-black text-blue-400 truncate mb-1">{activeChannel.name}</div>}
          <button
            type="button"
            onClick={toggleStream}
            disabled={streamBusy || isLive === null}
            className={`w-full py-3 rounded-xl font-black text-[11px] uppercase tracking-widest transition disabled:opacity-50 active:scale-95 border ${
              isLive
                ? 'bg-red-600/70 border-red-500 text-white'
                : 'bg-gray-800 border-gray-600 text-white/70 hover:bg-gray-700'
            }`}
          >
            {streamBusy ? '...' : isLive === null ? '● ...' : isLive ? '● В ЭФИРЕ' : '● ОФФЛАЙН'}
          </button>
          {streamMsg && (
            <p className={`text-[10px] font-black text-center ${streamMsg.includes('Ошибка') || streamMsg.includes('Нет') ? 'text-red-400' : 'text-green-400'}`}>
              {streamMsg}
            </p>
          )}
        </div>

        {/* Наша команда */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/20">Наша команда</div>
          <div className="grid grid-cols-3 gap-1">
            {(['team1', 'team2', null] as const).map((t, i) => (
              <button key={i} type="button"
                title={t === 'team1' ? 'Наша команда — левая' : t === 'team2' ? 'Наша команда — правая' : 'Наша команда не выбрана'}
                onClick={() => updateState({ ...state, ourTeam: t })}
                className={`py-2 px-1 rounded-xl text-[9px] font-black transition truncate ${state.ourTeam === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white/40 hover:bg-gray-700'}`}>
                {t === 'team1' ? (state.teams.team1.name || 'Команда 1') : t === 'team2' ? (state.teams.team2.name || 'Команда 2') : '— нет'}
              </button>
            ))}
          </div>
          <div className="text-[8px] text-white/20 leading-tight">Если выбрана — гол противника показывает траур</div>
        </div>

        {/* Toggle анимаций */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-white/40">Анимации голов</div>
            <div className="text-[8px] text-white/20">ГОООЛ! и траур</div>
          </div>
          <button type="button"
            onClick={() => updateState({ ...state, goalAnimation: { ...state.goalAnimation, animationsEnabled: !(state.goalAnimation.animationsEnabled ?? true) } })}
            className={`w-14 h-7 rounded-full transition-all relative flex-shrink-0 ${(state.goalAnimation.animationsEnabled ?? true) ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${(state.goalAnimation.animationsEnabled ?? true) ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>

        {/* Интро-заставка */}
        <button type="button"
          onClick={() => updateState({ ...state, introScreen: { ...(state.introScreen ?? { countdown: null, audioUrl: '' }), isActive: !(state.introScreen?.isActive ?? false) } })}
          className={`w-full p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition border
            ${(state.introScreen?.isActive ?? false)
              ? 'bg-indigo-950/50 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/10'
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
          <span className={`block text-xl mb-1 ${(state.introScreen?.isActive ?? false) ? 'animate-pulse' : ''}`}>🎬</span>
          {(state.introScreen?.isActive ?? false) ? 'ИНТРО: АКТИВНО' : 'ИНТРО: ВЫКЛ'}
        </button>

        {/* Заставка */}
        <button type="button"
          onClick={() => updateState({ ...state, pauseScreen: { ...state.pauseScreen, isActive: !state.pauseScreen.isActive } })}
          className={`w-full p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition border
            ${state.pauseScreen.isActive
              ? 'bg-amber-950/50 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
          <span className={`block text-xl mb-1 ${state.pauseScreen.isActive ? 'animate-pulse' : ''}`}>⏸</span>
          {state.pauseScreen.isActive ? 'ЗАСТАВКА: ВКЛ' : 'ЗАСТАВКА: ВЫКЛ'}
        </button>

        {/* Баннер + Субтитры */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button"
            onClick={() => updateState({ ...state, bottomBanner: { ...state.bottomBanner, isActive: !state.bottomBanner.isActive } })}
            className={`p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition border
              ${state.bottomBanner.isActive
                ? 'bg-blue-950/40 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10'
                : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
            <span className="block text-xl mb-1">📜</span>
            {state.bottomBanner.isActive ? 'СТРОКА: ВИДНА' : 'СТРОКА: СКРЫТА'}
          </button>
          <button type="button"
            onClick={() => updateState({ ...state, subtitles: { ...(state.subtitles ?? { text: '', size: 'M' }), isActive: !(state.subtitles?.isActive ?? false) } })}
            className={`p-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition border
              ${(state.subtitles?.isActive ?? false)
                ? 'bg-purple-950/40 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10'
                : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}>
            <span className="block text-xl mb-1">💬</span>
            {(state.subtitles?.isActive ?? false) ? 'ТЕКСТ: ВКЛ' : 'ТЕКСТ: ВЫКЛ'}
          </button>
        </div>

        {/* Карточки */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Карточка</div>
          <input value={cardPlayerName} onChange={e => setCardPlayerName(e.target.value)}
            placeholder="Имя игрока (необязательно)"
            className="w-full bg-gray-800 text-white text-xs px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-yellow-500 transition" />
          <div className="grid grid-cols-2 gap-2">
            {(['team1', 'team2'] as const).map(team => (
              <div key={team} className="space-y-1">
                <div className="text-[8px] font-black uppercase tracking-widest text-white/20 text-center truncate">{state.teams[team].name}</div>
                <button type="button"
                  onClick={() => { triggerCardEvent(team, 'yellow', cardPlayerName); }}
                  className="w-full py-2 rounded-xl font-black text-xs uppercase transition bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/30 active:scale-95">
                  🟨 Жёлтая
                </button>
                <button type="button"
                  onClick={() => { triggerCardEvent(team, 'red', cardPlayerName); }}
                  className="w-full py-2 rounded-xl font-black text-xs uppercase transition bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 active:scale-95">
                  🟥 Красная
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Инверсия + Сброс */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3 space-y-2">
          <button type="button"
            onClick={() => updateState({ ...state, teams: { team1: state.teams.team2, team2: state.teams.team1 }, score: { team1: state.score.team2, team2: state.score.team1 } })}
            className="w-full bg-gray-800/50 hover:bg-gray-800 p-3 rounded-xl border border-white/5 flex justify-center items-center gap-2 text-white/40 text-[9px] font-black uppercase tracking-widest transition">
            ⇄ ИНВЕРСИЯ СТОРОН
          </button>
          {!confirmReset ? (
            <button type="button" onClick={() => setConfirmReset(true)}
              className="w-full bg-red-950/20 hover:bg-red-950/40 p-3 rounded-xl border border-red-900/20 text-red-500/50 text-[9px] font-black uppercase tracking-widest transition">
              🗑 СБРОС МАТЧА
            </button>
          ) : (
            <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 space-y-2">
              <p className="text-[9px] text-red-400 font-black uppercase tracking-widest text-center">Сбросить счёт и таймер?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { resetMatch(); setConfirmReset(false); }}
                  className="bg-red-600 hover:bg-red-500 p-2 rounded-lg text-[9px] font-black uppercase">Да</button>
                <button type="button" onClick={() => setConfirmReset(false)}
                  className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg text-[9px] font-black uppercase text-white/50">Отмена</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Правая колонка: таймер + команды — ПЕРВАЯ на мобильном ── */}
      <div className="order-1 md:order-2 md:col-span-8 space-y-4">

        {/* Таймер */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block mb-2">Основное время</span>
              <div className="flex gap-1">
                {[1, 2].map(n => (
                  <button key={n} type="button"
                    onClick={() => updateState({ ...state, timer: { ...state.timer, half: n, isRunning: false, accumulatedTime: 0, startTimestamp: null } })}
                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition
                      ${state.timer.half === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white/20 hover:bg-gray-700 border border-white/5'}`}>
                    {n} Тайм
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] block mb-2 text-right">Длительность</span>
              <select value={settings.timer_warning_min} aria-label="Длительность тайма"
                onChange={e => updateSettings({ timer_warning_min: parseInt(e.target.value) })}
                className="bg-gray-800 text-white font-black px-3 py-1.5 rounded-lg text-xs border border-white/5 focus:outline-none focus:border-blue-500 transition">
                <option value={1}>1 МИН 🧪</option>
                <option value={30}>30 МИН</option>
                <option value={35}>35 МИН</option>
                <option value={40}>40 МИН</option>
                <option value={45}>45 МИН</option>
              </select>
            </div>
          </div>

          {/* Дисплей времени */}
          <div className={`text-center text-3xl font-black tabular-nums font-mono ${isOvertime ? 'text-orange-400' : 'text-white/60'}`}>
            {mm}:{ss}{isOvertime ? ' 🔥' : ''}
          </div>

          <button type="button" onClick={toggleTimer}
            className={`w-full py-6 rounded-2xl text-xl font-black uppercase tracking-widest transition-all active:scale-[0.98] border-b-4
              ${state.timer.isRunning
                ? 'bg-red-600 border-red-800 hover:bg-red-500'
                : 'bg-emerald-600 border-emerald-800 hover:bg-emerald-500'}`}>
            {state.timer.isRunning ? '■ СТОП' : '▶ СТАРТ'}
          </button>
        </div>

        {/* Команды */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['team1', 'team2'] as const).map(id => {
            const color = state.teams[id].color || (id === 'team1' ? '#3b82f6' : '#ef4444');
            const darkerColor = color + 'bb';
            return (
              <div key={id} className="bg-gray-900 border border-gray-800 rounded-3xl p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col max-w-[60%]">
                    <span className="text-[9px] font-light uppercase tracking-widest truncate" style={{ color: color + '99' }}>{state.teams[id].city}</span>
                    <h2 className="text-base font-black uppercase tracking-tighter truncate leading-tight">{state.teams[id].name}</h2>
                  </div>
                  <div className="text-4xl font-black tabular-nums leading-none p-2 bg-black/30 rounded-xl border border-white/5 min-w-[56px] text-center">
                    {state.score[id]}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => updateScore(id, -1)}
                    className="bg-gray-800 hover:bg-gray-700 border border-white/5 p-3 rounded-xl text-sm font-black transition active:scale-90">
                    -1
                  </button>
                  <button type="button" onClick={() => updateScore(id, 1)}
                    className="flex-1 py-3 rounded-xl text-sm font-black shadow-lg transition active:scale-[0.98] border-b-4 text-white"
                    style={{ background: color, borderBottomColor: darkerColor }}>
                    +1 ГОЛ ⚽
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// МАТЧ — предматчевая подготовка
// ═══════════════════════════════════════════
// Карточка команды с локальным состоянием для полей ввода (debounce 500ms)
// Предотвращает перезапись текста 3-секундным polling'ом из Supabase
function TeamCard({ team, state, updateState, icon }: {
  team: 'team1' | 'team2'; state: MatchState; updateState: (s: MatchState) => void; icon: string;
}) {
  const logoRef = useRef<HTMLInputElement>(null);
  const [localName, setLocalName] = useState(state.teams[team].name);
  const [localCity, setLocalCity] = useState(state.teams[team].city);
  const nameTimer = useRef<ReturnType<typeof setTimeout>>();
  const cityTimer = useRef<ReturnType<typeof setTimeout>>();

  // Синхронизируем локальный state если сервер прислал изменение (не во время набора)
  const isTypingName = useRef(false);
  const isTypingCity = useRef(false);
  useEffect(() => { if (!isTypingName.current) setLocalName(state.teams[team].name); }, [state.teams[team].name]);
  useEffect(() => { if (!isTypingCity.current) setLocalCity(state.teams[team].city); }, [state.teams[team].city]);

  const handleName = (v: string) => {
    setLocalName(v); isTypingName.current = true;
    clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => {
      isTypingName.current = false;
      updateState({ ...state, teams: { ...state.teams, [team]: { ...state.teams[team], name: v } } });
    }, 500);
  };
  const handleCity = (v: string) => {
    setLocalCity(v); isTypingCity.current = true;
    clearTimeout(cityTimer.current);
    cityTimer.current = setTimeout(() => {
      isTypingCity.current = false;
      updateState({ ...state, teams: { ...state.teams, [team]: { ...state.teams[team], city: v } } });
    }, 500);
  };
  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 256; const ratio = Math.min(max / img.width, max / img.height, 1);
        canvas.width = img.width * ratio; canvas.height = img.height * ratio;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        updateState({ ...state, teams: { ...state.teams, [team]: { ...state.teams[team], logo: canvas.toDataURL('image/png', 0.85) } } });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const teamColor = state.teams[team].color || (team === 'team1' ? '#3b82f6' : '#ef4444');

  return (
    <Section title={`Команда ${team === 'team1' ? 1 : 2}`} icon={icon}>
      <div className="flex gap-3 items-start">
        {/* Логотип */}
        <div className="flex-shrink-0">
          <button type="button" onClick={() => logoRef.current?.click()}
            className="w-16 h-16 rounded-2xl bg-gray-800 border-2 border-dashed border-gray-600 hover:border-white/30 flex items-center justify-center overflow-hidden transition">
            {state.teams[team].logo
              ? <img src={state.teams[team].logo} className="w-full h-full object-contain p-1" alt="logo" />
              : <span className="text-2xl opacity-30">🏅</span>}
          </button>
          <input ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
          {state.teams[team].logo && (
            <button type="button"
              onClick={() => updateState({ ...state, teams: { ...state.teams, [team]: { ...state.teams[team], logo: '' } } })}
              className="w-full mt-1 text-[9px] text-white/20 hover:text-red-400 transition text-center">✕ убрать</button>
          )}
        </div>
        {/* Название + Город */}
        <div className="flex-1 space-y-2">
          <input value={localName} onChange={e => handleName(e.target.value)}
            placeholder="Название" className="w-full bg-gray-800 text-white font-black uppercase px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition text-sm" />
          <input value={localCity} onChange={e => handleCity(e.target.value)}
            placeholder="Город" className="w-full bg-gray-800 text-white/70 px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition text-sm" />
        </div>
        {/* Цвет команды */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-white/30 leading-none">Цвет</label>
          <div className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white/10 cursor-pointer hover:border-white/30 transition"
               style={{ background: teamColor }}>
            <input type="color" value={teamColor}
              onChange={e => updateState({ ...state, teams: { ...state.teams, [team]: { ...state.teams[team], color: e.target.value } } })}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
          </div>
          <span className="text-[8px] font-mono text-white/20">{teamColor.toUpperCase()}</span>
        </div>
      </div>
    </Section>
  );
}

function MatchTab({ state, updateState, channels, setActiveChannel }: {
  state: MatchState; updateState: (s: MatchState) => void;
  channels: VKChannel[]; setActiveChannel: (id: number) => void;
}) {
  return (
    <div className="space-y-5">

      {/* Название стрима */}
      <Section title="Название стрима" icon="🎙">
        <input
          value={state.streamTitle ?? ''}
          onChange={e => updateState({ ...state, streamTitle: e.target.value })}
          placeholder="Например: Финал. ЦСКА — Спартак"
          className="w-full bg-gray-800 text-white px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition text-sm"
        />
      </Section>

      {/* VK Канал */}
      <Section title="VK Канал трансляции" icon="📡">
        {channels.length === 0
          ? <p className="text-white/30 text-sm text-center py-3">Нет каналов — добавьте в Настройках</p>
          : <div className="space-y-2">
              {channels.map(ch => (
                <button key={ch.id} type="button" onClick={() => setActiveChannel(ch.id)}
                  className={`w-full p-3 rounded-xl text-left transition border ${ch.is_active ? 'bg-green-950/40 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-white/60 hover:border-gray-600'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-sm">{ch.name}</span>
                    {ch.is_active && <span className="text-[10px] font-black uppercase bg-green-600 px-2 py-0.5 rounded-full">АКТИВЕН</span>}
                  </div>
                  <div className="text-[10px] text-white/30 mt-0.5 truncate">{ch.rtmp_url}</div>
                </button>
              ))}
              <p className="text-[10px] text-white/20 text-center">После смены канала — перезапустите OBS на сервере</p>
            </div>
        }
      </Section>

      {/* Команды */}
      <TeamCard team="team1" state={state} updateState={updateState} icon="🔵" />
      <TeamCard team="team2" state={state} updateState={updateState} icon="🔴" />

      {/* Нижний баннер */}
      <Section title="Нижний баннер / бегущая строка" icon="📜">
        <BannerEditor state={state} updateState={updateState} />
      </Section>

      {/* Субтитры */}
      <Section title="Субтитры (статичный текст снизу)" icon="💬">
        <SubtitlesEditor state={state} updateState={updateState} />
      </Section>

    </div>
  );
}

// ── Редактор заставки ───────────────────────────────────────────────────────
function SplashEditor({ state, updateState, mediaLib }: { state: MatchState; updateState: (s: MatchState) => void; mediaLib?: ReturnType<typeof useMediaLibrary> }) {
  const splashMediaRef = useRef<HTMLInputElement>(null);
  const splashAudioRef = useRef<HTMLInputElement>(null);
  const [splashPlaying, setSplashPlaying] = useState(false);
  const splashAudioElRef = useRef<HTMLAudioElement | null>(null);

  const toggleSplashAudio = () => {
    if (splashPlaying) {
      splashAudioElRef.current?.pause();
      if (splashAudioElRef.current) splashAudioElRef.current.currentTime = 0;
      setSplashPlaying(false);
    } else {
      splashAudioElRef.current?.pause();
      const el = new Audio(state.pauseScreen.audioUrl);
      el.onended = () => setSplashPlaying(false);
      el.play().catch(() => {});
      splashAudioElRef.current = el;
      setSplashPlaying(true);
    }
  };

  const handleMediaFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => updateState({ ...state, pauseScreen: { ...state.pauseScreen, mediaUrl: e.target?.result as string } });
    reader.readAsDataURL(file);
  };

  const handleAudioFile = (file: File) => {
    if (file.size > 10_000_000) {
      alert('Файл слишком большой (> 10 МБ).');
    }
    const reader = new FileReader();
    reader.onload = e => updateState({ ...state, pauseScreen: { ...state.pauseScreen, audioUrl: e.target?.result as string } });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {/* Картинка/видео */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Картинка / Видео (mp4/webm)</label>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="button" onClick={() => splashMediaRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-black transition">
            📁 Загрузить файл
          </button>
          {state.pauseScreen.mediaUrl && (
            <button type="button" onClick={() => updateState({ ...state, pauseScreen: { ...state.pauseScreen, mediaUrl: '' } })}
              className="text-sm text-red-400/60 hover:text-red-400 font-black transition">✕ убрать</button>
          )}
          {!state.pauseScreen.mediaUrl && (
            <input value={state.pauseScreen.mediaUrl}
              onChange={e => updateState({ ...state, pauseScreen: { ...state.pauseScreen, mediaUrl: e.target.value } })}
              placeholder="или вставить URL"
              className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition text-sm" />
          )}
          {state.pauseScreen.mediaUrl && (
            <span className="text-[10px] text-green-400 font-black">✓ загружено</span>
          )}
        </div>
        <input ref={splashMediaRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleMediaFile(e.target.files[0])} />
      </div>
      {/* Текст поверх */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Текст поверх (50% прозрачность)</label>
        <input value={state.pauseScreen.text}
          onChange={e => updateState({ ...state, pauseScreen: { ...state.pauseScreen, text: e.target.value } })}
          placeholder="Перерыв / Скоро начало / ..."
          className="w-full bg-gray-800 text-white px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition text-sm" />
      </div>
      {/* Аудио */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">🎵 Фоновое аудио (MP3 на репите)</label>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="button" onClick={() => splashAudioRef.current?.click()}
            className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-black transition">
            🎵 Загрузить MP3
          </button>
          {state.pauseScreen.audioUrl ? (
            <>
              <span className="text-[10px] text-green-400 font-black">✓ загружен</span>
              <button type="button" onClick={toggleSplashAudio}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${splashPlaying ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                {splashPlaying ? '■ Стоп' : '▶ Тест'}
              </button>
              <button type="button" onClick={() => { splashAudioElRef.current?.pause(); setSplashPlaying(false); updateState({ ...state, pauseScreen: { ...state.pauseScreen, audioUrl: '' } }); }}
                className="text-sm text-red-400/60 hover:text-red-400 font-black transition">✕ убрать</button>
            </>
          ) : <span className="text-[10px] text-white/20 font-black">не задан — тишина</span>}
        </div>
        <input ref={splashAudioRef} type="file" accept="audio/*" className="hidden"
          onChange={e => e.target.files?.[0] && handleAudioFile(e.target.files[0])} />
        <p className="text-[9px] text-white/20 mt-1">Будет играть на репите пока заставка активна. В OBS включите "Allow audio" в браузер-сорсе.</p>
      </div>
      {/* Плейлист из медиатеки (если передан mediaLib) */}
      {mediaLib && mediaLib.items.length > 0 && (
        <div className="border-t border-white/5 pt-2">
          <PlaylistPicker
            label="Музыка паузы" icon="⏸"
            selectedIds={(state.pauseScreenPlaylist?.soundPlaylistIds) ?? []}
            playlistMode={(state.pauseScreenPlaylist?.playlistMode) ?? 'sequence'}
            items={mediaLib.items}
            onChangeIds={ids => updateState({ ...state, pauseScreenPlaylist: { ...(state.pauseScreenPlaylist ?? { playlistMode: 'sequence' }), soundPlaylistIds: ids } })}
            onChangeMode={m => updateState({ ...state, pauseScreenPlaylist: { ...(state.pauseScreenPlaylist ?? { soundPlaylistIds: [] }), playlistMode: m } })}
          />
        </div>
      )}
    </div>
  );
}

// ── Редактор баннера ────────────────────────────────────────────────────────
function BannerEditor({ state, updateState }: { state: MatchState; updateState: (s: MatchState) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const bannerImageRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => updateState({ ...state, bottomBanner: { ...state.bottomBanner, imageUrl: e.target?.result as string, mode: 'image' } });
    reader.readAsDataURL(file);
  };

  const mode = state.bottomBanner.mode ?? 'scroll';
  const size = state.bottomBanner.size ?? 'M';

  return (
    <div className="space-y-3">
      {/* Режим */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-1">Режим</label>
        <div className="flex gap-2">
          {(['scroll', 'image'] as const).map(m => (
            <button key={m} type="button" onClick={() => updateState({ ...state, bottomBanner: { ...state.bottomBanner, mode: m } })}
              className={`flex-1 py-2 rounded-xl font-black text-xs uppercase transition ${mode === m ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {m === 'scroll' ? 'Бегущая строка' : 'Картинка'}
            </button>
          ))}
        </div>
      </div>

      {/* Размер */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-1">Размер</label>
        <div className="flex gap-2">
          {(['S', 'M', 'L'] as const).map(s => (
            <button key={s} type="button" onClick={() => updateState({ ...state, bottomBanner: { ...state.bottomBanner, size: s } })}
              className={`flex-1 py-2 rounded-xl font-black text-xs uppercase transition ${size === s ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {s === 'S' ? 'S узкий' : s === 'M' ? 'M средний' : 'L широкий'}
            </button>
          ))}
        </div>
      </div>

      {/* Текст (для scroll) */}
      {mode === 'scroll' && (
        <input value={state.bottomBanner.text} onChange={e => updateState({ ...state, bottomBanner: { ...state.bottomBanner, text: e.target.value } })}
          placeholder="Текст бегущей строки..."
          className="w-full bg-gray-800 text-white px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 transition text-sm" />
      )}

      {/* Картинка drag-drop (для image) */}
      {mode === 'image' && (
        <div className="space-y-2">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
            onClick={() => bannerImageRef.current?.click()}
            className={`w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition
              ${dragOver ? 'border-blue-400 bg-blue-950/20' : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'}`}
          >
            {state.bottomBanner.imageUrl
              ? <img src={state.bottomBanner.imageUrl} alt="banner preview" className="max-h-20 object-contain rounded-lg" />
              : <>
                  <span className="text-3xl mb-2 opacity-40">🖼</span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/30">Перетащите или нажмите</span>
                </>
            }
          </div>
          <input ref={bannerImageRef} type="file" accept="image/*,image/gif" className="hidden"
            aria-label="Загрузить картинку для баннера"
            onChange={e => e.target.files?.[0] && handleImageFile(e.target.files[0])} />
          {state.bottomBanner.imageUrl && (
            <button type="button" onClick={() => updateState({ ...state, bottomBanner: { ...state.bottomBanner, imageUrl: '' } })}
              className="w-full text-[9px] font-black uppercase text-white/20 hover:text-red-400 transition">
              ✕ убрать картинку
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Редактор субтитров ──────────────────────────────────────────────────────
function SubtitlesEditor({ state, updateState }: { state: MatchState; updateState: (s: MatchState) => void }) {
  const subtitles = state.subtitles ?? { isActive: false, text: '', size: 'M' as const };
  const size = subtitles.size ?? 'M';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-1">Размер шрифта</label>
        <div className="flex gap-2">
          {(['S', 'M', 'L'] as const).map(s => (
            <button key={s} type="button"
              onClick={() => updateState({ ...state, subtitles: { ...subtitles, size: s } })}
              className={`flex-1 py-2 rounded-xl font-black text-xs uppercase transition ${size === s ? 'bg-purple-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
              {s === 'S' ? 'S малый' : s === 'M' ? 'M средний' : 'L крупный'}
            </button>
          ))}
        </div>
      </div>
      <input value={subtitles.text} onChange={e => updateState({ ...state, subtitles: { ...subtitles, text: e.target.value } })}
        placeholder="Текст субтитров..."
        className="w-full bg-gray-800 text-white px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-purple-500 transition text-sm" />
    </div>
  );
}

// ═══════════════════════════════════════════
// ДИЗАЙН — визуальные настройки табло
// ═══════════════════════════════════════════
function DesignTab({ state, updateState, settings, updateSettings, resetToDefaults }: {
  state: MatchState; updateState: (s: MatchState) => void;
  settings: OverlaySettings; updateSettings: (p: Partial<OverlaySettings>) => void;
  resetToDefaults: () => void;
}) {
  const [confirmFactory, setConfirmFactory] = useState(false);
  const sponsorRef = useRef<HTMLInputElement>(null);

  const POSITIONS = [
    { id: 'top-left',      label: '↖ Сверху лево' },
    { id: 'top-center',    label: '↑ Сверху центр' },
    { id: 'top-right',     label: '↗ Сверху право' },
    { id: null,            label: '' },
    { id: 'center-center', label: '⊙ Центр экрана' },
    { id: null,            label: '' },
    { id: 'bottom-left',   label: '↙ Снизу лево' },
    { id: 'bottom-center', label: '↓ Снизу центр' },
    { id: 'bottom-right',  label: '↘ Снизу право' },
  ] as const;

  const handleSponsorUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 256; const r = Math.min(max/img.width, max/img.height, 1);
        canvas.width = img.width*r; canvas.height = img.height*r;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        updateState({ ...state, sponsorLogo: { ...state.sponsorLogo, imageUrl: canvas.toDataURL('image/png', 0.85) } });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">

      {/* Предпросмотр */}
      <Section title="Предпросмотр" icon="🖥">
        <OverlayPreview state={state} settings={settings} />
      </Section>

      {/* Позиция и масштаб */}
      <Section title="Позиция и масштаб" icon="📐">
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Масштаб</label>
              <span className="text-[11px] font-black text-blue-400">{settings.scale.toFixed(1)}×</span>
            </div>
            <input type="range" min={0.5} max={2} step={0.1} value={settings.scale}
              onChange={e => updateSettings({ scale: parseFloat(e.target.value) })}
              className="w-full accent-blue-500" />
            <div className="flex justify-between text-[9px] text-white/20 mt-1">
              <span>0.5×</span><span>1.0× дефолт</span><span>2.0×</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Позиция на экране</label>
            <div className="grid grid-cols-3 gap-2">
              {POSITIONS.map((p, i) => p.id
                ? <button key={p.id} type="button" onClick={() => updateSettings({ position: p.id! })}
                    className={`py-2 px-1 rounded-xl text-[10px] font-black transition ${settings.position === p.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white/40 hover:bg-gray-700'}`}>
                    {p.label}
                  </button>
                : <div key={i} />
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Стиль табло */}
      <Section title="Стиль табло" icon="🎨">
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([
            { id: 'classic', label: '🔲 Classic',   desc: 'Горизонтальный, стекло/фон' },
            { id: 'stadium', label: '🏟 Stadium',   desc: 'Широкий, цвета команд' },
            { id: 'flat',    label: '▬ Flat',       desc: 'Плоский, тонкие полосы' },
            { id: 'neon',    label: '✦ Neon',       desc: 'Тёмный, неоновое свечение' },
          ] as const).map(s => (
            <button key={s.id} type="button" onClick={() => updateSettings({ scoreboard_style: s.id })}
              className={`p-3 rounded-xl text-left transition border ${(settings.scoreboard_style ?? 'classic') === s.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-white/50 hover:bg-gray-700'}`}>
              <div className="font-black text-sm">{s.label}</div>
              <div className="text-[9px] mt-0.5 opacity-70">{s.desc}</div>
            </button>
          ))}
        </div>

        {/* Glass / подложка */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-black text-sm">Glass-эффект</div>
            <div className="text-[10px] text-white/30">Стеклянный размытый фон (Classic/Flat)</div>
          </div>
          <button type="button" onClick={() => updateSettings({ glass_enabled: !settings.glass_enabled })}
            className={`w-14 h-7 rounded-full transition-all relative ${settings.glass_enabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
            <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${settings.glass_enabled ? 'left-7' : 'left-0.5'}`} />
          </button>
        </div>
        {!settings.glass_enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Цвет фона</label>
              <div className="flex items-center gap-2">
                <input type="color" value={settings.backdrop_color} onChange={e => updateSettings({ backdrop_color: e.target.value })}
                  className="w-10 h-8 rounded-lg border-0 cursor-pointer" />
                <span className="text-xs text-white/50 font-mono">{settings.backdrop_color}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Прозрачность</label>
                <span className="text-[11px] font-black text-blue-400">{Math.round(settings.backdrop_opacity * 100)}%</span>
              </div>
              <input type="range" min={0} max={1} step={0.05} value={settings.backdrop_opacity}
                onChange={e => updateSettings({ backdrop_opacity: parseFloat(e.target.value) })}
                className="w-full accent-blue-500" />
            </div>
          </div>
        )}
      </Section>

      {/* Логотипы */}
      <Section title="Логотипы команд" icon="🏅">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Размер</label>
              <span className="text-[11px] font-black text-blue-400">{settings.logo_size}px</span>
            </div>
            <input type="range" min={32} max={128} step={4} value={settings.logo_size}
              onChange={e => updateSettings({ logo_size: parseInt(e.target.value) })}
              className="w-full accent-blue-500" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">Форма логотипа</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: 'square',        label: '⬛ Квадрат' },
                { id: 'rounded',       label: '▢ Скруглённый' },
                { id: 'circle',        label: '⚪ Круг' },
                { id: 'circle-border', label: '⊙ Круг + обводка' },
              ] as const).map(shape => (
                <button key={shape.id} type="button" onClick={() => updateSettings({ logo_shape: shape.id })}
                  className={`py-2 px-3 rounded-xl text-xs font-black transition ${(settings.logo_shape ?? 'rounded') === shape.id ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'}`}>
                  {shape.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Цвета */}
      <Section title="Цвета" icon="🖌">
        <div className="grid grid-cols-2 gap-3">
          {([
            { label: 'Название команды', key: 'color_team_name' as const },
            { label: 'Счёт',             key: 'color_score' as const },
            { label: 'Таймер',           key: 'color_timer' as const },
            { label: 'Тайм',             key: 'color_half' as const },
            { label: 'Плашка города',    key: 'color_city_badge' as const },
          ]).map(({ label, key }) => (
            <div key={key}>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 block mb-2">{label}</label>
              <div className="flex items-center gap-2">
                <input type="color"
                  value={(settings[key] ?? '#ffffff').startsWith('#') ? (settings[key] ?? '#ffffff') : '#ffffff'}
                  onChange={e => updateSettings({ [key]: e.target.value })}
                  className="w-10 h-8 rounded-lg border-0 cursor-pointer" />
                <input value={settings[key] ?? ''}
                  onChange={e => updateSettings({ [key]: e.target.value })}
                  className="flex-1 bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 font-mono" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Спонсор */}
      <Section title="Логотип спонсора" icon="🏢">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Показывать</span>
            <button type="button" onClick={() => updateState({ ...state, sponsorLogo: { ...state.sponsorLogo, isActive: !state.sponsorLogo.isActive } })}
              className={`w-14 h-7 rounded-full transition-all relative ${state.sponsorLogo.isActive ? 'bg-blue-600' : 'bg-gray-700'}`}>
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${state.sponsorLogo.isActive ? 'left-7' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex gap-3 items-center">
            <button type="button" onClick={() => sponsorRef.current?.click()}
              className="w-16 h-16 rounded-2xl bg-gray-800 border-2 border-dashed border-gray-600 hover:border-white/30 flex items-center justify-center overflow-hidden transition">
              {state.sponsorLogo.imageUrl
                ? <img src={state.sponsorLogo.imageUrl} className="w-full h-full object-contain p-1" alt="sponsor" />
                : <span className="text-2xl opacity-30">🏢</span>}
            </button>
            <input ref={sponsorRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleSponsorUpload(e.target.files[0])} />
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Размер</label>
                <span className="text-[11px] font-black text-blue-400">{settings.sponsor_size}px</span>
              </div>
              <input type="range" min={40} max={200} step={10} value={settings.sponsor_size}
                onChange={e => updateSettings({ sponsor_size: parseInt(e.target.value) })}
                className="w-full accent-blue-500" />
            </div>
          </div>
          {state.sponsorLogo.imageUrl && (
            <button type="button" onClick={() => updateState({ ...state, sponsorLogo: { ...state.sponsorLogo, imageUrl: '' } })}
              className="text-sm text-red-400/60 hover:text-red-400 font-black transition">✕ убрать</button>
          )}
        </div>
      </Section>

      {/* Сброс */}
      <Section title="Сброс дизайна" icon="⚠️">
        {!confirmFactory ? (
          <button type="button" onClick={() => setConfirmFactory(true)}
            className="w-full py-3 rounded-xl bg-red-950/30 border border-red-900/30 text-red-400/70 font-black text-sm uppercase tracking-widest hover:bg-red-950/50 transition">
            Сброс до заводских настроек
          </button>
        ) : (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 space-y-2">
            <p className="text-[10px] text-red-400 font-black uppercase tracking-widest text-center">
              Сбросить визуальные настройки?<br />
              <span className="text-white/30 normal-case">Каналы и логин не затрагиваются</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { resetToDefaults(); setConfirmFactory(false); }}
                className="bg-red-600 hover:bg-red-500 py-2 rounded-lg text-xs font-black uppercase">Да, сброс</button>
              <button type="button" onClick={() => setConfirmFactory(false)}
                className="bg-gray-800 py-2 rounded-lg text-xs font-black uppercase text-white/50">Отмена</button>
            </div>
          </div>
        )}
      </Section>

    </div>
  );
}

// ═══════════════════════════════════════════
// МЕДИАТЕКА — библиотека звуков
// ═══════════════════════════════════════════
function LibraryTab({ mediaLib }: { mediaLib: ReturnType<typeof useMediaLibrary> }) {
  const { items, addTrack, deleteTrack } = mediaLib;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingName, setPendingName] = useState('');
  const [pendingData, setPendingData] = useState('');
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const { supabase: _sb } = { supabase: null }; // unused, but we need getTrackDataUrl
  const { getTrackDataUrl } = mediaLib;

  const handleFile = (file: File) => {
    if (file.size > 10_000_000) { alert('> 10 МБ — сожмите файл'); return; }
    const r = new FileReader();
    r.onload = e => {
      setPendingData(e.target?.result as string);
      setPendingName(file.name.replace(/\.[^.]+$/, ''));
    };
    r.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!pendingName || !pendingData) return;
    setUploading(true);
    await addTrack(pendingName.trim(), pendingData);
    setPendingName(''); setPendingData('');
    setUploading(false);
  };

  const togglePlay = async (id: number) => {
    if (playingId === id) {
      audioElRef.current?.pause();
      if (audioElRef.current) audioElRef.current.currentTime = 0;
      setPlayingId(null);
    } else {
      audioElRef.current?.pause();
      setPlayingId(id);
      const url = await getTrackDataUrl(id);
      if (!url) { setPlayingId(null); return; }
      const el = new Audio(url);
      el.onended = () => setPlayingId(null);
      el.play().catch(() => {});
      audioElRef.current = el;
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-900/20 border border-blue-600/30 rounded-xl px-3 py-2">
        <p className="text-[10px] text-blue-300/80 font-bold leading-tight">
          🎵 Загрузи треки — потом назначай их на слоты в <strong>FX ЭФФЕКТЫ</strong>. Лимит: 2 МБ на файл.
        </p>
      </div>

      {/* Загрузка */}
      <Section title="Добавить трек" icon="➕">
        <div className="space-y-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-black transition">
            📁 Выбрать MP3 / WAV
          </button>
          <input ref={fileRef} type="file" accept="audio/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          {pendingData && (
            <div className="flex gap-2 items-center flex-wrap">
              <input value={pendingName} onChange={e => setPendingName(e.target.value)}
                placeholder="Название трека"
                className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500" />
              <button type="button" onClick={handleSave} disabled={uploading || !pendingName}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm transition disabled:opacity-50">
                {uploading ? '...' : 'Сохранить'}
              </button>
              <button type="button" onClick={() => { setPendingName(''); setPendingData(''); }}
                className="text-red-400/60 hover:text-red-400 font-black text-sm transition">✕</button>
            </div>
          )}
        </div>
      </Section>

      {/* Список треков */}
      <Section title={`Треки (${items.length})`} icon="🎶">
        {items.length === 0
          ? <p className="text-[10px] text-white/20">Пусто — загрузи первый трек выше</p>
          : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2">
                  <button type="button" onClick={() => togglePlay(item.id)}
                    className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-xs transition ${playingId === item.id ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {playingId === item.id ? '■' : '▶'}
                  </button>
                  <span className="flex-1 text-sm font-bold truncate">{item.name}</span>
                  <button type="button" onClick={() => { if (playingId === item.id) { audioElRef.current?.pause(); setPlayingId(null); } deleteTrack(item.id); }}
                    className="text-red-400/40 hover:text-red-400 font-black text-sm transition flex-shrink-0">🗑</button>
                </div>
              ))}
              {items.length >= 20 && (
                <p className="text-[9px] text-yellow-400/60">Рекомендуем не больше 20 треков</p>
              )}
            </div>
          )
        }
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════
// FX ЭФФЕКТЫ — назначение звуков
// ═══════════════════════════════════════════
function PlaylistPicker({
  label, icon,
  selectedIds, playlistMode,
  onChangeIds, onChangeMode,
  items,
}: {
  label: string; icon: string;
  selectedIds: number[]; playlistMode: 'sequence' | 'random';
  onChangeIds: (ids: number[]) => void;
  onChangeMode: (m: 'sequence' | 'random') => void;
  items: MediaLibraryItem[];
}) {
  const toggleId = (id: number) => {
    onChangeIds(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  return (
    <div className="space-y-2">
      <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">{icon} {label} — Плейлист из МЕДИАТЕКИ</div>
      {items.length === 0
        ? <p className="text-[9px] text-white/20">Нет треков — сначала добавь в МЕДИАТЕКЕ</p>
        : (
          <div className="space-y-1">
            {items.map(item => (
              <label key={item.id} className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleId(item.id)}
                  className="rounded accent-blue-500 w-4 h-4 flex-shrink-0" />
                <span className="text-[11px] font-bold truncate group-hover:text-white/80">{item.name}</span>
              </label>
            ))}
          </div>
        )
      }
      {selectedIds.length > 1 && (
        <div className="flex gap-2 mt-1">
          {(['sequence', 'random'] as const).map(m => (
            <button key={m} type="button" onClick={() => onChangeMode(m)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition ${playlistMode === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white/30 hover:bg-gray-700'}`}>
              {m === 'sequence' ? '⬇ По порядку' : '🔀 Случайно'}
            </button>
          ))}
        </div>
      )}
      {selectedIds.length > 0 && (
        <p className="text-[8px] text-white/20">{selectedIds.length} трек(ов) выбрано{selectedIds.length > 1 ? `, режим: ${playlistMode === 'sequence' ? 'по порядку' : 'случайно'}` : ''}</p>
      )}
    </div>
  );
}

function FxTab({ state, updateState, mediaLib }: {
  state: MatchState; updateState: (s: MatchState) => void;
  mediaLib: ReturnType<typeof useMediaLibrary>;
}) {
  const goalSoundRef = useRef<HTMLInputElement>(null);
  const concededSoundRef = useRef<HTMLInputElement>(null);
  const introAudioRef = useRef<HTMLInputElement>(null);
  const [introCountdown, setIntroCountdown] = useState(String(state.introScreen?.countdown ?? ''));
  const [playingId, setPlayingId] = useState('');
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudio = (id: string, url: string) => {
    if (playingId === id) {
      audioElRef.current?.pause();
      if (audioElRef.current) audioElRef.current.currentTime = 0;
      setPlayingId('');
    } else {
      audioElRef.current?.pause();
      const el = new Audio(url);
      el.onended = () => setPlayingId('');
      el.play().catch(() => {});
      audioElRef.current = el;
      setPlayingId(id);
    }
  };

  const handleIntroCountdownSave = () => {
    const n = parseInt(introCountdown);
    updateState({ ...state, introScreen: { ...(state.introScreen ?? { isActive: false, audioUrl: '', soundPlaylistIds: [], playlistMode: 'sequence' }), countdown: isNaN(n) || n <= 0 ? null : n } });
  };

  const ga = state.goalAnimation;
  const is = state.introScreen ?? { isActive: false, countdown: null, audioUrl: '', soundPlaylistIds: [], playlistMode: 'sequence' as const };

  return (
    <div className="space-y-5">
      <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl px-3 py-2">
        <p className="text-[10px] text-yellow-300/80 font-bold leading-tight">
          ⚠️ В OBS → Browser Source → включите <span className="text-yellow-200">Control audio via OBS</span> — иначе звуки не играют в стриме
        </p>
      </div>

      {/* Звук нашего гола */}
      <Section title="Звук — Наш гол 🎉" icon="🔊">
        <div className="space-y-3">
          <PlaylistPicker
            label="Наш гол" icon="🎉"
            selectedIds={ga.soundPlaylistIds ?? []}
            playlistMode={ga.playlistMode ?? 'sequence'}
            items={mediaLib.items}
            onChangeIds={ids => updateState({ ...state, goalAnimation: { ...ga, soundPlaylistIds: ids } })}
            onChangeMode={m => updateState({ ...state, goalAnimation: { ...ga, playlistMode: m } })}
          />
          <div className="border-t border-white/5 pt-2">
            <div className="text-[8px] text-white/20 mb-2">Fallback-звук (если плейлист пуст)</div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => goalSoundRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-black transition">
                📁 MP3 / WAV
              </button>
              {ga.soundUrl ? (
                <>
                  <span className="text-[10px] text-green-400 font-black">✓ загружен</span>
                  <button type="button" onClick={() => toggleAudio('goal', ga.soundUrl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${playingId === 'goal' ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {playingId === 'goal' ? '■ Стоп' : '▶ Тест'}
                  </button>
                  <button type="button" onClick={() => updateState({ ...state, goalAnimation: { ...ga, soundUrl: '' } })}
                    className="text-sm text-red-400/60 hover:text-red-400 font-black transition">✕</button>
                </>
              ) : <span className="text-[10px] text-white/20 font-black">встроенный (goal.wav)</span>}
              <input ref={goalSoundRef} type="file" accept="audio/*" className="hidden" title="Звук гола"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 1_500_000) alert('> 1.5 МБ — сожмите MP3'); const r = new FileReader(); r.onload = ev => updateState({ ...state, goalAnimation: { ...ga, soundUrl: ev.target?.result as string } }); r.readAsDataURL(f); }} />
            </div>
          </div>
        </div>
      </Section>

      {/* Звук пропущенного */}
      <Section title="Звук — Пропустили 😔" icon="🔇">
        <div className="space-y-3">
          <PlaylistPicker
            label="Пропустили" icon="😔"
            selectedIds={ga.concededPlaylistIds ?? []}
            playlistMode={ga.playlistMode ?? 'sequence'}
            items={mediaLib.items}
            onChangeIds={ids => updateState({ ...state, goalAnimation: { ...ga, concededPlaylistIds: ids } })}
            onChangeMode={m => updateState({ ...state, goalAnimation: { ...ga, playlistMode: m } })}
          />
          <div className="border-t border-white/5 pt-2">
            <div className="text-[8px] text-white/20 mb-2">Fallback-звук</div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => concededSoundRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-black transition">
                📁 MP3 / WAV
              </button>
              {ga.concededSoundUrl ? (
                <>
                  <span className="text-[10px] text-green-400 font-black">✓ загружен</span>
                  <button type="button" onClick={() => toggleAudio('conceded', ga.concededSoundUrl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${playingId === 'conceded' ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {playingId === 'conceded' ? '■ Стоп' : '▶ Тест'}
                  </button>
                  <button type="button" onClick={() => updateState({ ...state, goalAnimation: { ...ga, concededSoundUrl: '' } })}
                    className="text-sm text-red-400/60 hover:text-red-400 font-black transition">✕</button>
                </>
              ) : <span className="text-[10px] text-white/20 font-black">встроенный (conceded.wav)</span>}
              <input ref={concededSoundRef} type="file" accept="audio/*" className="hidden" title="Звук пропущенного"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 1_500_000) alert('> 1.5 МБ'); const r = new FileReader(); r.onload = ev => updateState({ ...state, goalAnimation: { ...ga, concededSoundUrl: ev.target?.result as string } }); r.readAsDataURL(f); }} />
            </div>
          </div>
        </div>
      </Section>

      {/* Интро */}
      <Section title="Интро перед матчем" icon="🎬">
        <div className="space-y-3">
          <p className="text-[9px] text-white/30">Показывает логотипы команд VS и обратный отсчёт. Включать из ЭФИР.</p>
          <div className="flex gap-2 items-center">
            <input value={introCountdown} onChange={e => setIntroCountdown(e.target.value)}
              placeholder="Секунд обратного отсчёта (пусто = без)"
              className="flex-1 bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500" />
            <button type="button" onClick={handleIntroCountdownSave}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm transition">OK</button>
          </div>
          <PlaylistPicker
            label="Музыка интро" icon="🎵"
            selectedIds={is.soundPlaylistIds ?? []}
            playlistMode={is.playlistMode ?? 'sequence'}
            items={mediaLib.items}
            onChangeIds={ids => updateState({ ...state, introScreen: { ...is, soundPlaylistIds: ids } })}
            onChangeMode={m => updateState({ ...state, introScreen: { ...is, playlistMode: m } })}
          />
          <div className="border-t border-white/5 pt-2">
            <div className="text-[8px] text-white/20 mb-2">Fallback-звук интро</div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => introAudioRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm font-black transition">
                📁 Загрузить MP3
              </button>
              {is.audioUrl ? (
                <>
                  <span className="text-[10px] text-green-400 font-black">✓ загружена</span>
                  <button type="button" onClick={() => toggleAudio('intro', is.audioUrl)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${playingId === 'intro' ? 'bg-red-700 hover:bg-red-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    {playingId === 'intro' ? '■ Стоп' : '▶ Тест'}
                  </button>
                  <button type="button" onClick={() => updateState({ ...state, introScreen: { ...is, audioUrl: '' } })}
                    className="text-sm text-red-400/60 hover:text-red-400 font-black transition">✕</button>
                </>
              ) : <span className="text-[10px] text-white/20">не задана — тишина</span>}
              <input ref={introAudioRef} type="file" accept="audio/*" className="hidden" title="Музыка интро"
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 3_000_000) alert('> 3 МБ'); const r = new FileReader(); r.onload = ev => updateState({ ...state, introScreen: { ...is, audioUrl: ev.target?.result as string } }); r.readAsDataURL(f); }} />
            </div>
          </div>
        </div>
      </Section>

      {/* Заставка паузы */}
      <Section title="Заставка паузы / перерыва" icon="⏸">
        <SplashEditor state={state} updateState={updateState} mediaLib={mediaLib} />
      </Section>
    </div>
  );
}

// ═══════════════════════════════════════════
// ДОСТУП — ключи, каналы, аккаунт
// ═══════════════════════════════════════════
function AccessTab({ channels, addChannel, deleteChannel, updateChannel }: {
  channels: VKChannel[]; addChannel: (ch: Omit<VKChannel,'id'|'created_at'>) => void; deleteChannel: (id: number) => void;
  updateChannel: (id: number, patch: Partial<VKChannel>) => void;
}) {
  const [newCh, setNewCh] = useState({ name: '', rtmp_url: 'rtmp://ovsu.okcdn.ru/input/', stream_key: '', is_active: false });
  const [showKey, setShowKey] = useState<number | null>(null);
  const [newLogin, setNewLogin] = useState('');
  const [newPass, setNewPass] = useState('');
  const [authMsg, setAuthMsg] = useState('');
  const [ctrlMsg, setCtrlMsg] = useState('');

  const handleChangePassword = async () => {
    if (!newLogin || !newPass) { setAuthMsg('Заполните все поля'); return; }
    if (newPass.length < 6) { setAuthMsg('Пароль минимум 6 символов'); return; }
    const hash = await sha256(newPass);
    const { error } = await supabase.from('app_config').update({ username: newLogin, password_hash: hash }).eq('id', 1);
    setAuthMsg(error ? 'Ошибка сохранения' : 'Сохранено!');
    if (!error) { setNewLogin(''); setNewPass(''); }
    setTimeout(() => setAuthMsg(''), 3000);
  };

  return (
    <div className="space-y-5">

      {/* VK Каналы */}
      <Section title="VK Каналы трансляции" icon="📡">
        <div className="space-y-3">
          {channels.map(ch => (
            <div key={ch.id} className={`p-3 rounded-xl border ${ch.is_active ? 'border-green-600 bg-green-950/20' : 'border-gray-700 bg-gray-800/50'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm">{ch.name}</div>
                  <div className="text-[10px] text-white/30 truncate">{ch.rtmp_url}</div>
                  <div className="text-[10px] text-white/20 mt-0.5 flex items-center gap-1">
                    <span>Ключ: {showKey === ch.id ? ch.stream_key : '••••••••'}</span>
                    <button type="button" onClick={() => setShowKey(showKey === ch.id ? null : ch.id)}
                      className="text-blue-400 hover:text-blue-300 transition">
                      {showKey === ch.id ? 'скрыть' : 'показать'}
                    </button>
                  </div>
                </div>
                <button type="button" onClick={() => deleteChannel(ch.id)}
                  className="text-red-400/50 hover:text-red-400 font-black text-sm ml-2 transition">✕</button>
              </div>
            </div>
          ))}
          <div className="bg-gray-800/50 border border-dashed border-gray-600 rounded-xl p-3 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Добавить канал</p>
            {(['name', 'rtmp_url', 'stream_key'] as const).map(field => (
              <input key={field} value={newCh[field]}
                onChange={e => setNewCh(p => ({ ...p, [field]: e.target.value }))}
                placeholder={field === 'name' ? 'Название' : field === 'rtmp_url' ? 'RTMP URL' : 'Stream Key'}
                className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500" />
            ))}
            <button type="button"
              onClick={() => { if (!newCh.name || !newCh.rtmp_url || !newCh.stream_key) return; addChannel(newCh); setNewCh({ name: '', rtmp_url: 'rtmp://ovsu.okcdn.ru/input/', stream_key: '', is_active: false }); }}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-black text-sm uppercase tracking-widest transition">
              + Добавить
            </button>
          </div>
          <p className="text-[9px] text-white/20">После смены канала — перезапустите OBS на сервере</p>
        </div>
      </Section>




      {/* Аккаунт */}
      <Section title="Аккаунт (логин/пароль)" icon="🔐">
        <div className="space-y-3">
          <input value={newLogin} onChange={e => setNewLogin(e.target.value)} placeholder="Новый логин"
            className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500" />
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Новый пароль (мин. 6 символов)"
            className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500" />
          {authMsg && <p className={`text-sm text-center font-black ${authMsg.includes('Сохранено') ? 'text-green-400' : 'text-red-400'}`}>{authMsg}</p>}
          <button type="button" onClick={handleChangePassword}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-xl font-black text-sm uppercase tracking-widest transition">
            Сохранить
          </button>
        </div>
      </Section>

    </div>
  );
}

// ── Overlay Preview ────────────────────────────────────────────────────────────
function OverlayPreview({ state, settings }: { state: MatchState; settings: OverlaySettings }) {
  const pos = settings.position;
  const isBottom = pos.startsWith('bottom') || pos === 'center-center';
  // Горизонтальное выравнивание (justify = main axis в flex row)
  const horizAlign = pos.endsWith('left') ? 'justify-start' : pos.endsWith('right') ? 'justify-end' : 'justify-center';
  // Вертикальное выравнивание (items = cross axis в flex row)
  const vertAlign = pos === 'center-center' ? 'items-center' : pos.startsWith('bottom') ? 'items-end' : 'items-start';

  const lsz = Math.round(settings.logo_size * 0.18);
  const ssz = Math.round(settings.sponsor_size * 0.18);

  const bgStyle = settings.glass_enabled
    ? { background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' as const }
    : { background: settings.backdrop_color + Math.round(settings.backdrop_opacity * 255).toString(16).padStart(2, '0') };

  const bannerEl = state.bottomBanner.isActive && (
    <div className="flex justify-center mt-1">
      <div className="rounded flex items-center justify-center overflow-hidden"
        style={{ ...bgStyle, border: '1px solid rgba(255,255,255,0.1)', maxWidth: '120px', height: 9 }}>
        <span className="px-2 whitespace-nowrap font-bold uppercase" style={{ fontSize: 4, color: settings.color_team_name }}>
          {state.bottomBanner.text || 'Текст баннера'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-white/10"
      style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a1a2e 100%)' }}>
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)', backgroundSize: '25% 33%' }} />

      <div className={`absolute inset-0 flex ${horizAlign} ${vertAlign} p-3`}>
        <div className="flex flex-col gap-1" style={{ transform: `scale(${settings.scale})`, transformOrigin: `${pos.endsWith('left') ? 'left' : pos.endsWith('right') ? 'right' : 'center'} ${pos === 'center-center' ? 'center' : pos.startsWith('bottom') ? 'bottom' : 'top'}` }}>
          {/* Табло — стиль зависит от settings.scoreboard_style */}
          {(() => {
            const t1 = state.teams.team1; const t2 = state.teams.team2;
            const c1 = t1.color || '#3b82f6'; const c2 = t2.color || '#ef4444';
            const s1 = state.score.team1; const s2 = state.score.team2;
            const n1 = t1.name || 'Команда 1'; const n2 = t2.name || 'Команда 2';
            const scoreColor = settings.color_score ?? '#ffffff';
            const nameColor = settings.color_team_name;
            const Logo1 = () => (
              <div className="flex-shrink-0 overflow-hidden" style={{ width: lsz, height: lsz, background: c1, borderRadius: lsz * 0.25 }}>
                {t1.logo && <img src={t1.logo} className="w-full h-full object-cover" alt="" />}
              </div>
            );
            const Logo2 = () => (
              <div className="flex-shrink-0 overflow-hidden" style={{ width: lsz, height: lsz, background: c2, borderRadius: lsz * 0.25 }}>
                {t2.logo && <img src={t2.logo} className="w-full h-full object-cover" alt="" />}
              </div>
            );
            if (settings.scoreboard_style === 'stadium') return (
              <div style={{ display: 'flex', height: 26, overflow: 'hidden', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ background: c1 + '99', display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px', flex: 1, minWidth: 0 }}>
                  <Logo1 /><span style={{ fontSize: 5.5, fontWeight: 900, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{n1}</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s1}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.5)', lineHeight: 1 }}>:</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s2}</span>
                </div>
                <div style={{ background: c2 + '99', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, padding: '0 6px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 5.5, fontWeight: 900, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{n2}</span><Logo2 />
                </div>
              </div>
            );
            if (settings.scoreboard_style === 'flat') return (
              <div style={{ display: 'flex', height: 26, overflow: 'hidden', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ width: 3, background: c1, flexShrink: 0 }} />
                <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: 3, padding: '0 5px', flex: 1, minWidth: 0 }}>
                  <Logo1 /><span style={{ fontSize: 5.5, fontWeight: 900, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{n1}</span>
                </div>
                <div style={{ background: '#111', display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{s1}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.25)', lineHeight: 1 }}>:</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{s2}</span>
                </div>
                <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, padding: '0 5px', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 5.5, fontWeight: 900, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{n2}</span><Logo2 />
                </div>
                <div style={{ width: 3, background: c2, flexShrink: 0 }} />
              </div>
            );
            if (settings.scoreboard_style === 'neon') return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 6px', borderRadius: 6, background: 'rgba(2,2,12,0.95)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: lsz, height: lsz, borderRadius: '50%', background: c1 + '22', border: `1px solid ${c1}88`, overflow: 'hidden', flexShrink: 0, boxShadow: `0 0 6px ${c1}66` }}>
                  {t1.logo && <img src={t1.logo} className="w-full h-full object-cover" alt="" />}
                </div>
                <span style={{ fontSize: 5.5, fontWeight: 900, color: c1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, textShadow: `0 0 8px ${c1}` }}>{n1}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: scoreColor, lineHeight: 1, textShadow: `0 0 8px ${scoreColor}88` }}>{s1}</span>
                  <span style={{ fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.15)', lineHeight: 1 }}>:</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: scoreColor, lineHeight: 1, textShadow: `0 0 8px ${scoreColor}88` }}>{s2}</span>
                </div>
                <span style={{ fontSize: 5.5, fontWeight: 900, color: c2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, textAlign: 'right', textShadow: `0 0 8px ${c2}` }}>{n2}</span>
                <div style={{ width: lsz, height: lsz, borderRadius: '50%', background: c2 + '22', border: `1px solid ${c2}88`, overflow: 'hidden', flexShrink: 0, boxShadow: `0 0 6px ${c2}66` }}>
                  {t2.logo && <img src={t2.logo} className="w-full h-full object-cover" alt="" />}
                </div>
              </div>
            );
            // classic (default)
            return (
              <div className="flex items-center rounded-xl overflow-hidden border border-white/10" style={{ ...bgStyle, height: 26 }}>
                <div className="flex items-center gap-1 px-2">
                  <Logo1 />
                  <span className="font-black uppercase leading-none" style={{ fontSize: 6, maxWidth: 36, color: nameColor, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>{n1}</span>
                </div>
                <div className="px-2 border-x border-white/10 flex items-center gap-1">
                  <span className="font-black tabular-nums" style={{ fontSize: 9, color: scoreColor }}>{s1}</span>
                  <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', fontWeight: 900 }}>:</span>
                  <span className="font-black tabular-nums" style={{ fontSize: 9, color: scoreColor }}>{s2}</span>
                </div>
                <div className="flex items-center gap-1 px-2">
                  <span className="font-black uppercase leading-none" style={{ fontSize: 6, maxWidth: 36, color: nameColor, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>{n2}</span>
                  <Logo2 />
                </div>
              </div>
            );
          })()}
          {/* Таймер */}
          <div className="rounded-lg px-3 flex items-center gap-2 mx-auto" style={{ ...bgStyle, height: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: 5, color: settings.color_half }}>{state.timer.half} ТАЙМ</span>
            <span className="font-black tabular-nums" style={{ fontSize: 7, color: settings.color_timer }}>00:00</span>
          </div>
          {/* Баннер под табло (когда isBottom) */}
          {isBottom && bannerEl}
        </div>
      </div>

      {/* Спонсор — противоположный угол */}
      {state.sponsorLogo.isActive && state.sponsorLogo.imageUrl && (
        <div className={`absolute right-2 ${isBottom ? 'top-2' : 'bottom-2'} rounded-lg p-1`}
          style={{ ...bgStyle, border: '1px solid rgba(255,255,255,0.1)', width: ssz + 8, height: ssz + 8 }}>
          <img src={state.sponsorLogo.imageUrl} style={{ width: ssz, height: ssz, objectFit: 'contain' }} alt="sponsor" />
        </div>
      )}

      {/* Баннер внизу экрана (когда позиция сверху) */}
      {!isBottom && state.bottomBanner.isActive && (
        <div className="absolute bottom-1 left-0 right-0 flex justify-center">
          <div className="rounded flex items-center justify-center overflow-hidden"
            style={{ ...bgStyle, border: '1px solid rgba(255,255,255,0.1)', maxWidth: '80%', height: 10 }}>
            <span className="px-3 whitespace-nowrap font-bold uppercase" style={{ fontSize: 4, color: settings.color_team_name }}>
              {state.bottomBanner.text || 'Текст баннера'}
            </span>
          </div>
        </div>
      )}

      <div className="absolute bottom-1 left-2" style={{ fontSize: 4, color: 'rgba(255,255,255,0.2)' }}>
        {settings.scale.toFixed(1)}× · {settings.position} · лого {settings.logo_size}px
      </div>
    </div>
  );
}

// ── Section helper ─────────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-3 flex items-center gap-2">
        <span>{icon}</span>{title}
      </h3>
      {children}
    </div>
  );
}
