import React from 'react';
import { MatchState, OverlaySettings } from '../types';

export function Classic({ state, settings, displayTime, overtimeDisplay, isOvertime }: {
  state: MatchState;
  settings: OverlaySettings;
  displayTime: string;
  overtimeDisplay: string;
  isOvertime: boolean;
}) {
  const logoSize = settings.logo_size;
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
  const cityBadgeStyle = { background: settings.color_city_badge ?? '#dc2626' };

  const getLogoShapeStyle = (size: number): React.CSSProperties => {
    const shape = settings.logo_shape ?? 'rounded';
    switch (shape) {
      case 'square': return { borderRadius: 0 };
      case 'circle': return { borderRadius: size / 2 };
      case 'circle-border': return { borderRadius: size / 2, border: '3px solid rgba(255,255,255,0.5)' };
      default: return { borderRadius: size * 0.25 };
    }
  };

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

  const scoreFontClass = (settings.score_font ?? 'default') === 'mono' ? 'font-mono' : 'font-rubik';
  const scoreWeightClass = (settings.score_font ?? 'default') === 'bold' ? 'font-black' : 'font-bold';

  return (
    <>
      <div className={`${boardBg} rounded-3xl p-1 shadow-[0_20px_50px_rgba(0,0,0,0.5)] items-center w-max overflow-hidden flex`} style={boardBgStyle}>
        {/* Команда 1 */}
        <div className="flex items-center gap-5 px-8 min-w-[280px] justify-end">
          <div className="flex flex-col items-end" style={{ maxWidth: 200 }}>
            <span className="text-4xl font-black uppercase tracking-tighter font-rubik leading-none truncate w-full text-right"
                  style={{ color: settings.color_team_name, textShadow }}>
              {state.teams.team1.name}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest font-roboto mt-1 px-2 py-0.5 rounded text-white leading-none truncate max-w-full"
                  style={cityBadgeStyle}>
              {state.teams.team1.city}
            </span>
          </div>
          <LogoBox team="team1" />
        </div>

        {/* Счёт */}
        <div className="flex items-center bg-gradient-to-b from-white/10 to-transparent px-10 py-6 rounded-3xl mx-1 border-x border-white/5">
          <span className={`text-7xl tabular-nums tracking-tighter leading-none ${scoreFontClass} ${scoreWeightClass}`}
                style={{ color: settings.color_score ?? settings.color_timer, textShadow }}>
            {state.score.team1}
          </span>
          <span className="text-5xl font-black mx-3 text-white font-rubik" style={{ textShadow }}>:</span>
          <span className={`text-7xl tabular-nums tracking-tighter leading-none ${scoreFontClass} ${scoreWeightClass}`}
                style={{ color: settings.color_score ?? settings.color_timer, textShadow }}>
            {state.score.team2}
          </span>
        </div>

        {/* Команда 2 */}
        <div className="flex items-center gap-5 px-8 min-w-[280px] justify-start">
          <LogoBox team="team2" />
          <div className="flex flex-col items-start" style={{ maxWidth: 200 }}>
            <span className="text-4xl font-black uppercase tracking-tighter font-rubik leading-none truncate w-full"
                  style={{ color: settings.color_team_name, textShadow }}>
              {state.teams.team2.name}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest font-roboto mt-1 px-2 py-0.5 rounded text-white leading-none truncate max-w-full"
                  style={cityBadgeStyle}>
              {state.teams.team2.city}
            </span>
          </div>
        </div>
      </div>

      {/* Таймер */}
      <div className={`${timerBg} rounded-2xl px-8 py-3 shadow-2xl items-center w-max ml-auto mr-auto flex`} style={timerBgStyle}>
        <span className="text-xs font-black uppercase mr-5 tracking-[0.2em]"
              style={{ color: settings.color_half, textShadow }}>
          {state.timer.half} ТАЙМ
        </span>
        <div className="text-4xl font-black tabular-nums tracking-wider transition-all duration-700"
             style={{
               color: isOvertime ? '#f97316' : settings.color_timer,
               textShadow,
               animation: isOvertime ? 'fire 1.2s ease-in-out infinite' : undefined,
             }}>
          {displayTime}
        </div>
        {overtimeDisplay && (
          <span className="ml-3 text-sm font-black" style={{ color: '#fca5a5' }}>{overtimeDisplay}</span>
        )}
      </div>
    </>
  );
}
