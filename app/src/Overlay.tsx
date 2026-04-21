import React, { useEffect, useRef, useState, memo } from 'react';
import { useOverlayState, useOverlaySettingsRT, useMediaLibrary } from './useMatchState';
import { motion, AnimatePresence } from 'framer-motion';
import { Classic, Stadium, Flat, Neon } from './scoreboards';

// TickerText — вне Overlay, мемоизирован: анимация не сбрасывается при polling/ре-рендере
const TickerText = memo(function TickerText({
  text, fontSize, color, shadow, speed,
}: { text: string; fontSize: number; color: string; shadow?: string; speed: number }) {
  const duration = Math.max(8, Math.round(60 / speed));
  return (
    <span style={{
      display: 'inline-block', whiteSpace: 'nowrap', willChange: 'transform',
      fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', lineHeight: 1,
      animation: `ticker ${duration}s linear infinite`,
      fontSize, color, textShadow: shadow,
    }}>{text}</span>
  );
});


export default function Overlay() {
  const { state, loading: matchLoading, updateState, triggerGoalAnimation } = useOverlayState();
  const { settings, loading: settingsLoading } = useOverlaySettingsRT();
  const { getTrackDataUrl } = useMediaLibrary();
  // Playlist indices (local, not in DB)
  const goalPlaylistIndexRef = useRef(0);
  const concededPlaylistIndexRef = useRef(0);
  const introPlaylistIndexRef = useRef(0);
  const [displayTime, setDisplayTime] = useState('00:00');
  const [overtimeDisplay, setOvertimeDisplay] = useState('');
  const [isOvertime, setIsOvertime] = useState(false);
  const [showGoalLocal, setShowGoalLocal] = useState(false);
  const [isConceded, setIsConceded] = useState(false);
  const [introCountdown, setIntroCountdown] = useState<number | null>(null);
  const goalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Persistent audio elements — браузер охотнее разрешает play() на существующих элементах
  const goalAudioEl = useRef<HTMLAudioElement>(new Audio());
  const splashAudioEl = useRef<HTMLAudioElement>(new Audio());
  const introAudioEl = useRef<HTMLAudioElement>(new Audio());
  // AudioContext unlock — разблокирует аудио в OBS CEF без user gesture
  useEffect(() => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ctx.resume().catch(() => {});
      // Попытка воспроизвести тишину — прогревает аудио-движок
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      return () => { ctx.close().catch(() => {}); };
    } catch {}
  }, []);

  // Таймер (requestAnimationFrame)
  useEffect(() => {
    if (!state || !settings) return;
    let id: number;
    const warningMs = settings.timer_warning_min * 60000;
    const loop = () => {
      let ms = state.timer.accumulatedTime;
      if (state.timer.isRunning && state.timer.startTimestamp)
        ms += Date.now() - state.timer.startTimestamp;
      const over = ms >= warningMs;
      setIsOvertime(over);
      if (over) {
        const overMs = ms - warningMs;
        const s = Math.floor(overMs / 1000);
        setOvertimeDisplay(`+${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`);
      } else {
        setOvertimeDisplay('');
      }
      const s = Math.floor(ms / 1000);
      setDisplayTime(`${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [state, settings]);

  // Анимация гола + звук (с поддержкой плейлиста из медиатеки)
  useEffect(() => {
    if (!state) return;
    if (state.goalAnimation.isActive) {
      if (state.goalAnimation.animationsEnabled === false) return;
      const conceded = state.ourTeam !== null && state.ourTeam !== undefined
        && state.goalAnimation.teamSide !== state.ourTeam;
      setIsConceded(conceded);
      setShowGoalLocal(true);
      goalAudioEl.current.pause();
      goalAudioEl.current.currentTime = 0;

      const ga = state.goalAnimation;
      const playlistIds = conceded ? (ga.concededPlaylistIds ?? []) : (ga.soundPlaylistIds ?? []);
      const fallback = conceded
        ? (ga.concededSoundUrl || './conceded.wav')
        : (ga.soundUrl || './goal.wav');

      if (playlistIds.length > 0) {
        const idxRef = conceded ? concededPlaylistIndexRef : goalPlaylistIndexRef;
        let pickIdx: number;
        if ((ga.playlistMode ?? 'sequence') === 'random') {
          pickIdx = Math.floor(Math.random() * playlistIds.length);
        } else {
          pickIdx = idxRef.current % playlistIds.length;
        }
        idxRef.current = pickIdx + 1;
        getTrackDataUrl(playlistIds[pickIdx]).then(url => {
          goalAudioEl.current.src = url || fallback;
          goalAudioEl.current.play().catch(() => {});
        });
      } else {
        goalAudioEl.current.src = fallback;
        goalAudioEl.current.play().catch(() => {});
      }

      if (goalTimerRef.current) clearTimeout(goalTimerRef.current);
      goalTimerRef.current = setTimeout(() => setShowGoalLocal(false), 5000);
    } else {
      setShowGoalLocal(false);
    }
  }, [state?.goalAnimation.goalId]);

  // Звук заставки (на репите, с поддержкой плейлиста)
  useEffect(() => {
    if (!state) return;
    if (state.pauseScreen.isActive) {
      const playlistIds = state.pauseScreenPlaylist?.soundPlaylistIds ?? [];
      if (playlistIds.length > 0) {
        const mode = state.pauseScreenPlaylist?.playlistMode ?? 'sequence';
        const idx = mode === 'random' ? Math.floor(Math.random() * playlistIds.length) : 0;
        getTrackDataUrl(playlistIds[idx]).then(url => {
          splashAudioEl.current.src = url || state.pauseScreen.audioUrl || '';
          if (splashAudioEl.current.src) { splashAudioEl.current.loop = true; splashAudioEl.current.play().catch(() => {}); }
        });
      } else if (state.pauseScreen.audioUrl) {
        splashAudioEl.current.src = state.pauseScreen.audioUrl;
        splashAudioEl.current.loop = true;
        splashAudioEl.current.play().catch(() => {});
      } else {
        splashAudioEl.current.pause();
        splashAudioEl.current.src = '';
      }
    } else {
      splashAudioEl.current.pause();
      splashAudioEl.current.src = '';
    }
    return () => { splashAudioEl.current.pause(); };
  }, [state?.pauseScreen.isActive, state?.pauseScreen.audioUrl, state?.pauseScreenPlaylist?.soundPlaylistIds?.join(',')]);

  // Интро-заставка: звук + обратный отсчёт
  useEffect(() => {
    if (!state) return;
    const intro = state.introScreen;
    if (!intro) return;
    if (intro.isActive) {
      // Звук интро (с поддержкой плейлиста)
      const introPlaylistIds = intro.soundPlaylistIds ?? [];
      if (introPlaylistIds.length > 0) {
        const mode = intro.playlistMode ?? 'sequence';
        const idx = mode === 'random' ? Math.floor(Math.random() * introPlaylistIds.length) : introPlaylistIndexRef.current % introPlaylistIds.length;
        introPlaylistIndexRef.current = idx + 1;
        getTrackDataUrl(introPlaylistIds[idx]).then(url => {
          introAudioEl.current.src = url || intro.audioUrl || '';
          if (introAudioEl.current.src) { introAudioEl.current.loop = true; introAudioEl.current.play().catch(() => {}); }
        });
      } else if (intro.audioUrl) {
        introAudioEl.current.src = intro.audioUrl;
        introAudioEl.current.loop = true;
        introAudioEl.current.play().catch(() => {});
      }
      // Обратный отсчёт
      if (intro.countdown != null && intro.countdown > 0) {
        setIntroCountdown(intro.countdown);
        if (introCountdownRef.current) clearInterval(introCountdownRef.current);
        introCountdownRef.current = setInterval(() => {
          setIntroCountdown(prev => {
            if (prev === null || prev <= 1) {
              if (introCountdownRef.current) clearInterval(introCountdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setIntroCountdown(null);
      }
    } else {
      introAudioEl.current.pause();
      introAudioEl.current.src = '';
      setIntroCountdown(null);
      if (introCountdownRef.current) clearInterval(introCountdownRef.current);
    }
    return () => { introAudioEl.current.pause(); };
  }, [state?.introScreen?.isActive, state?.introScreen?.audioUrl, state?.introScreen?.countdown]);

  if (matchLoading || settingsLoading || !state || !settings) return null;

  const pos = settings.position;
  const scale = settings.scale;
  const logoSize = settings.logo_size;
  const isBottom = pos.startsWith('bottom') || pos === 'center-center';
  const goalTeamColor = state.goalAnimation.teamSide === 'team1' ? '#3b82f6' : '#ef4444';

  // Стиль подложки табло: glass или solid
  const useGlass = settings.glass_enabled;
  const boardBg = useGlass
    ? 'bg-gradient-to-br from-black/80 via-black/60 to-black/80 backdrop-blur-2xl border border-white/20'
    : 'border border-white/10';
  const boardBgStyle = useGlass
    ? {}
    : settings.backdrop_opacity > 0
      ? { background: settings.backdrop_color + Math.round(settings.backdrop_opacity * 255).toString(16).padStart(2, '0') }
      : {};

  const timerBg = useGlass
    ? 'bg-black/80 backdrop-blur-2xl border border-white/20'
    : 'border border-white/10';
  const timerBgStyle = useGlass ? {} : boardBgStyle;
  const textShadow = useGlass ? undefined : '0 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)';

  const isVideo = state.pauseScreen.mediaUrl.match(/\.(mp4|webm)$/i) ||
    state.pauseScreen.mediaUrl.startsWith('data:video/');

  const BANNER_SIZES = {
    S: { width: '50%', fontSize: 18, imageHeight: 80 },
    M: { width: '75%', fontSize: 24, imageHeight: 120 },
    L: { width: '95%', fontSize: 28, imageHeight: 160 },
  };
  const SUBTITLE_FONT = { S: 16, M: 20, L: 24 };

  const bannerSize = BANNER_SIZES[state.bottomBanner.size ?? 'M'];
  const subtitlesActive = state.subtitles?.isActive ?? false;
  const bannerIsImage = state.bottomBanner.mode === 'image' && !!state.bottomBanner.imageUrl;


  // Цвет плашки города
  const cityBadgeStyle = { background: settings.color_city_badge ?? '#dc2626' };

  // Форма логотипа — по настройке
  const getLogoShapeStyle = (size: number): React.CSSProperties => {
    const shape = settings.logo_shape ?? 'rounded';
    switch (shape) {
      case 'square': return { borderRadius: 0 };
      case 'circle': return { borderRadius: size / 2 };
      case 'circle-border': return { borderRadius: size / 2, border: '3px solid rgba(255,255,255,0.5)' };
      default: return { borderRadius: size * 0.25 }; // 'rounded'
    }
  };

  // Контейнер логотипа команды с фоном и скруглением
  const LogoBox = ({ team }: { team: 'team1' | 'team2' }) => {
    const t = state.teams[team];
    const bg = t.color || (team === 'team1' ? '#1e3a5f' : '#5f1e1e');
    return (
      <div className="overflow-hidden flex-shrink-0 flex items-center justify-center"
           style={{ width: logoSize, height: logoSize, background: bg, ...getLogoShapeStyle(logoSize) }}>
        {t.logo
          ? <img src={t.logo} alt="Logo" className="w-full h-full object-cover" />
          : <div className="w-3/4 h-3/4 border-2 border-white/30 rounded-xl opacity-40" />}
      </div>
    );
  };

  return (
    <div className={`w-screen h-screen overflow-hidden text-white font-sans ${getPositionClasses(pos)} p-10 ${subtitlesActive && isBottom ? 'pb-14' : ''}`}>

      {/* Заставка */}
      <AnimatePresence>
        {state.pauseScreen.isActive && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
          >
            {state.pauseScreen.mediaUrl && (isVideo
              ? <video src={state.pauseScreen.mediaUrl} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover" />
              : <img src={state.pauseScreen.mediaUrl} className="absolute inset-0 w-full h-full object-cover" alt="Pause" />
            )}
            {state.pauseScreen.text && (
              <h1 className="relative z-10 text-6xl font-black uppercase tracking-widest text-center opacity-50"
                  style={{ textShadow: '0 0 40px rgba(0,0,0,0.8)' }}>
                {state.pauseScreen.text}
              </h1>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Анимация ГОЛ! */}
      <AnimatePresence>
        {showGoalLocal && !isConceded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-4 px-16 py-10 rounded-[2.5rem] border shadow-[0_0_80px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                 style={{ background: `linear-gradient(135deg,${goalTeamColor}22,#00000099)`, borderColor: `${goalTeamColor}55` }}>
              <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, -15, 15, 0] }} transition={{ duration: 0.6, repeat: 2 }} className="text-8xl leading-none">⚽</motion.div>
              <div className="text-3xl font-black uppercase tracking-[0.3em] text-white/50">Г О Л !</div>
              <div className="text-5xl font-black uppercase tracking-tight font-rubik" style={{ color: goalTeamColor, textShadow: `0 0 30px ${goalTeamColor}` }}>
                {state.goalAnimation.teamName}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-7xl font-black tabular-nums font-rubik" style={{ color: state.goalAnimation.teamSide === 'team1' ? goalTeamColor : 'white' }}>{state.goalAnimation.newScore.team1}</span>
                <span className="text-4xl font-black text-white/40 font-rubik">:</span>
                <span className="text-7xl font-black tabular-nums font-rubik" style={{ color: state.goalAnimation.teamSide === 'team2' ? goalTeamColor : 'white' }}>{state.goalAnimation.newScore.team2}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Анимация пропущенного гола */}
      <AnimatePresence>
        {showGoalLocal && isConceded && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-39 pointer-events-none"
              style={{ backdropFilter: 'grayscale(100%) brightness(0.5)', background: 'rgba(0,0,0,0.4)' }}
            />
            <motion.div
              initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
              className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
            >
              <div className="flex flex-col items-center gap-4 px-16 py-10 rounded-[2.5rem] border shadow-[0_0_80px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
                   style={{ background: 'linear-gradient(135deg,#11111199,#00000099)', borderColor: 'rgba(255,255,255,0.1)' }}>
                <motion.div animate={{ rotate: [0, -10, 10, -5, 5, 0] }} transition={{ duration: 1.2, delay: 0.3 }} className="text-8xl leading-none grayscale">😔</motion.div>
                <div className="text-3xl font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>пропустили</div>
                <div className="text-4xl font-black uppercase tracking-tight font-rubik" style={{ color: 'rgba(255,255,255,0.6)' }}>{state.goalAnimation.teamName}</div>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-7xl font-black tabular-nums font-rubik" style={{ color: 'rgba(255,255,255,0.5)' }}>{state.goalAnimation.newScore.team1}</span>
                  <span className="text-4xl font-black font-rubik" style={{ color: 'rgba(255,255,255,0.2)' }}>:</span>
                  <span className="text-7xl font-black tabular-nums font-rubik" style={{ color: 'rgba(255,255,255,0.5)' }}>{state.goalAnimation.newScore.team2}</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Интро-заставка */}
      <AnimatePresence>
        {state.introScreen?.isActive && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #050510 0%, #0a0a1a 100%)' }}
          >
            {/* Фоновый медиа из pauseScreen */}
            {state.pauseScreen.mediaUrl && (
              state.pauseScreen.mediaUrl.match(/\.(mp4|webm)$/i) || state.pauseScreen.mediaUrl.startsWith('data:video/')
                ? <video src={state.pauseScreen.mediaUrl} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover opacity-40" />
                : <img src={state.pauseScreen.mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-40" alt="" />
            )}
            <div className="relative z-10 flex flex-col items-center gap-10">
              {/* Логотипы команд */}
              <div className="flex items-center gap-16">
                <div className="flex flex-col items-center gap-4">
                  <div style={{
                    width: 140, height: 140, borderRadius: 28, overflow: 'hidden',
                    background: state.teams.team1.color || '#1e3a8a',
                    border: '2px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 40px ${state.teams.team1.color || '#1e3a8a'}66`,
                  }}>
                    {state.teams.team1.logo
                      ? <img src={state.teams.team1.logo} alt="T1" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <div style={{ width: '70%', height: '70%', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 16 }} />}
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black uppercase tracking-tight" style={{ color: '#fff' }}>
                      {state.teams.team1.name}
                    </div>
                    <div className="text-sm font-bold uppercase tracking-widest mt-1 px-3 py-1 rounded"
                         style={{ background: settings.color_city_badge ?? '#dc2626', color: '#fff' }}>
                      {state.teams.team1.city}
                    </div>
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center">
                  <span className="text-6xl font-black" style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '-0.02em' }}>VS</span>
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div style={{
                    width: 140, height: 140, borderRadius: 28, overflow: 'hidden',
                    background: state.teams.team2.color || '#7f1d1d',
                    border: '2px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 0 40px ${state.teams.team2.color || '#7f1d1d'}66`,
                  }}>
                    {state.teams.team2.logo
                      ? <img src={state.teams.team2.logo} alt="T2" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <div style={{ width: '70%', height: '70%', border: '2px solid rgba(255,255,255,0.3)', borderRadius: 16 }} />}
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black uppercase tracking-tight" style={{ color: '#fff' }}>
                      {state.teams.team2.name}
                    </div>
                    <div className="text-sm font-bold uppercase tracking-widest mt-1 px-3 py-1 rounded"
                         style={{ background: settings.color_city_badge ?? '#dc2626', color: '#fff' }}>
                      {state.teams.team2.city}
                    </div>
                  </div>
                </div>
              </div>

              {/* Обратный отсчёт */}
              {introCountdown !== null && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={introCountdown}
                    initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="text-9xl font-black tabular-nums"
                    style={{ color: introCountdown <= 3 ? '#ef4444' : '#fff', textShadow: introCountdown <= 3 ? '0 0 40px #ef444466' : 'none' }}
                  >
                    {introCountdown}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Карточка (жёлтая/красная) */}
      <AnimatePresence>
        {state.cardEvent?.isActive && (
          <motion.div
            initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-24 left-10 z-45 pointer-events-none"
          >
            <div className="flex items-center gap-4 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl"
                 style={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Иконка карточки */}
              <div style={{
                width: 32, height: 44, borderRadius: 5,
                background: state.cardEvent.cardType === 'yellow' ? '#f59e0b' : '#dc2626',
                boxShadow: state.cardEvent.cardType === 'yellow' ? '0 0 20px #f59e0b88' : '0 0 20px #dc262688',
                flexShrink: 0,
              }} />
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-white/50 leading-none mb-1">
                  {state.cardEvent.cardType === 'yellow' ? 'ЖЁЛТАЯ КАРТОЧКА' : 'КРАСНАЯ КАРТОЧКА'}
                </div>
                <div className="text-xl font-black uppercase tracking-tight text-white leading-none">
                  {state.teams[state.cardEvent.teamSide].name}
                </div>
                {state.cardEvent.playerName && (
                  <div className="text-sm font-bold text-white/70 mt-0.5">{state.cardEvent.playerName}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Спонсор */}
      <AnimatePresence>
        {state.sponsorLogo.isActive && state.sponsorLogo.imageUrl && (
          <motion.div
            initial={{ opacity: 0, y: isBottom ? -20 : 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`fixed ${isBottom ? 'top-6' : 'bottom-6'} right-6 z-30 pointer-events-none`}
          >
            <img src={state.sponsorLogo.imageUrl} alt="Sponsor" className="rounded-2xl"
                 style={{ width: settings.sponsor_size, height: settings.sponsor_size, objectFit: 'contain' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ТАБЛО */}
      {!state.pauseScreen.isActive && (
        <motion.div
          initial={{ y: isBottom ? 100 : -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1, scale }}
          transition={{ type: 'spring', stiffness: 100 }}
          className="flex flex-col gap-4 pointer-events-none"
          style={{
            transformOrigin: getTransformOrigin(pos),
            filter: settings.glass_enabled ? 'drop-shadow(0 0 30px rgba(0,0,0,0.5))' : 'none',
          }}
        >
          {(settings.scoreboard_style ?? 'classic') === 'stadium'
            ? <Stadium state={state} settings={settings} displayTime={displayTime} overtimeDisplay={overtimeDisplay} isOvertime={isOvertime} />
            : (settings.scoreboard_style ?? 'classic') === 'flat'
            ? <Flat state={state} settings={settings} displayTime={displayTime} isOvertime={isOvertime} />
            : (settings.scoreboard_style ?? 'classic') === 'neon'
            ? <Neon state={state} settings={settings} displayTime={displayTime} isOvertime={isOvertime} />
            : <Classic state={state} settings={settings} displayTime={displayTime} overtimeDisplay={overtimeDisplay} isOvertime={isOvertime} />
          }

          {/* Баннер под табло (позиция снизу) */}
          <AnimatePresence>
            {isBottom && state.bottomBanner.isActive && (
              <motion.div
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                className="pointer-events-none"
              >
                {bannerIsImage
                  ? <div className="rounded-2xl overflow-hidden shadow-2xl inline-block">
                      <img src={state.bottomBanner.imageUrl} alt="banner" style={{ height: bannerSize.imageHeight, objectFit: 'contain', display: 'block' }} />
                    </div>
                  : <div style={{ overflow: 'hidden', width: bannerSize.width, padding: '4px 0' }}>
                      <TickerText text={state.bottomBanner.text} fontSize={bannerSize.fontSize} color={settings.color_team_name} shadow={textShadow} speed={state.bottomBanner.speed || 1} />
                    </div>
                }
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Нижний баннер (позиция сверху — фиксированный внизу экрана) */}
      <AnimatePresence>
        {!isBottom && state.bottomBanner.isActive && (
          <motion.div
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
            className={`fixed ${subtitlesActive ? 'bottom-14' : 'bottom-10'} left-0 right-0 flex justify-center pointer-events-none`}
          >
            {bannerIsImage
              ? <div className="rounded-2xl overflow-hidden shadow-2xl inline-block">
                  <img src={state.bottomBanner.imageUrl} alt="banner" style={{ height: bannerSize.imageHeight, objectFit: 'contain', display: 'block' }} />
                </div>
              : <div style={{ overflow: 'hidden', width: bannerSize.width, padding: '4px 0' }}>
                  <TickerText text={state.bottomBanner.text} fontSize={bannerSize.fontSize} color={settings.color_team_name} shadow={textShadow} speed={state.bottomBanner.speed || 1} />
                </div>
            }
          </motion.div>
        )}
      </AnimatePresence>

      {/* Субтитры */}
      <AnimatePresence>
        {subtitlesActive && (
          <motion.div
            initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 flex justify-center pb-2 pointer-events-none"
          >
            <div className={`${timerBg} rounded-2xl py-2 px-10 shadow-2xl`}
                 style={{ ...timerBgStyle, fontSize: SUBTITLE_FONT[state.subtitles?.size ?? 'M'], color: settings.color_team_name, textShadow }}>
              {state.subtitles?.text ?? ''}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function getPositionClasses(pos: string) {
  if (pos === 'top-center') return 'flex justify-center items-start';
  if (pos === 'top-left') return 'flex justify-start items-start';
  if (pos === 'top-right') return 'flex justify-end items-start';
  if (pos === 'bottom-center') return 'flex justify-center items-end';
  if (pos === 'bottom-left') return 'flex justify-start items-end';
  if (pos === 'bottom-right') return 'flex justify-end items-end';
  if (pos === 'center-center') return 'flex justify-center items-center';
  return 'flex justify-center items-start';
}

function getTransformOrigin(pos: string) {
  if (pos === 'top-left') return 'top left';
  if (pos === 'top-right') return 'top right';
  if (pos === 'top-center') return 'top center';
  if (pos === 'bottom-left') return 'bottom left';
  if (pos === 'bottom-right') return 'bottom right';
  if (pos === 'bottom-center') return 'bottom center';
  if (pos === 'center-center') return 'center center';
  return 'top center';
}
