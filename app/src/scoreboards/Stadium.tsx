import React from 'react';
import { MatchState, OverlaySettings } from '../types';

export function Stadium({ state, settings, displayTime, overtimeDisplay, isOvertime }: {
  state: MatchState;
  settings: OverlaySettings;
  displayTime: string;
  overtimeDisplay: string;
  isOvertime: boolean;
}) {
  const t1 = state.teams.team1;
  const t2 = state.teams.team2;
  const c1 = t1.color || '#1e3a8a';
  const c2 = t2.color || '#7f1d1d';
  const logoSize = settings.logo_size;

  const Logo = ({ team }: { team: 'team1' | 'team2' }) => {
    const t = state.teams[team];
    const bg = team === 'team1' ? c1 : c2;
    return (
      <div style={{
        width: logoSize, height: logoSize, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.2)',
      }}>
        {t.logo
          ? <img src={t.logo} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ width: '75%', height: '75%', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, opacity: 0.4 }} />}
      </div>
    );
  };

  const cityStyle = {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.12em',
    whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis',
    marginTop: 5, color: '#fff',
    background: settings.color_city_badge ?? '#dc2626', borderRadius: 4, padding: '2px 7px', display: 'inline-block',
    maxWidth: '100%',
  };

  return (
    <div style={{ fontFamily: "'Rubik', sans-serif", userSelect: 'none' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 156px 1fr',
        width: 880, borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 14px 70px rgba(0,0,0,0.85)',
      }}>
        {/* Команда 1 */}
        <div style={{
          background: `linear-gradient(115deg, #03090f 0%, ${c1}99 60%, ${c1}dd 100%)`,
          padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
          position: 'relative', boxShadow: `inset -3px 0 40px ${c1}22`,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '20px 0 0 20px',
            background: `linear-gradient(180deg, transparent 0%, ${c1} 50%, transparent 100%)`,
          }} />
          <Logo team="team1" />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 26, fontWeight: 900, color: '#fff', textTransform: 'uppercase',
              letterSpacing: '-0.01em', lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: `0 0 18px ${c1}99`,
            }}>{t1.name}</div>
            <div style={cityStyle}>{t1.city}</div>
          </div>
        </div>

        {/* Центр */}
        <div style={{
          background: 'linear-gradient(180deg, #060606 0%, #0d0d0d 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '10px 0', gap: 3,
        }}>
          <div style={{
            fontSize: 13, fontWeight: 900, letterSpacing: '0.2em', lineHeight: 1,
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)',
            background: 'rgba(255,255,255,0.08)', borderRadius: 6, padding: '3px 10px',
          }}>ТАЙМ {state.timer.half}</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1 }}>
            <span style={{
              fontSize: 58, fontWeight: 900, color: '#fff', lineHeight: 1,
              textShadow: '0 0 25px rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums',
            }}>{state.score.team1}</span>
            <span style={{ fontSize: 42, fontWeight: 900, color: 'rgba(255,255,255,0.75)', lineHeight: 1, textShadow: '0 0 25px rgba(255,255,255,0.25)' }}>:</span>
            <span style={{
              fontSize: 58, fontWeight: 900, color: '#fff', lineHeight: 1,
              textShadow: '0 0 25px rgba(255,255,255,0.25)', fontVariantNumeric: 'tabular-nums',
            }}>{state.score.team2}</span>
          </div>

          <div style={{
            fontSize: 17, fontWeight: 900, letterSpacing: '0.08em', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: isOvertime ? '#f97316' : 'rgba(255,255,255,0.7)',
            animation: isOvertime ? 'fire 1.2s ease-in-out infinite' : undefined,
          }}>{displayTime}</div>

          {overtimeDisplay && (
            <div style={{
              fontSize: 10, fontWeight: 900, color: '#fca5a5', letterSpacing: '0.1em',
              background: 'rgba(127,29,29,0.65)', borderRadius: 5, padding: '1px 7px',
            }}>{overtimeDisplay}</div>
          )}
        </div>

        {/* Команда 2 */}
        <div style={{
          background: `linear-gradient(245deg, #0f0303 0%, ${c2}99 60%, ${c2}dd 100%)`,
          padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          gap: 14, position: 'relative', boxShadow: `inset 3px 0 40px ${c2}22`,
        }}>
          <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
            <div style={{
              fontSize: 26, fontWeight: 900, color: '#fff', textTransform: 'uppercase',
              letterSpacing: '-0.01em', lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textShadow: `0 0 18px ${c2}99`,
            }}>{t2.name}</div>
            <div style={{ ...cityStyle, float: 'right' }}>{t2.city}</div>
          </div>
          <Logo team="team2" />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, borderRadius: '0 20px 20px 0',
            background: `linear-gradient(180deg, transparent 0%, ${c2} 50%, transparent 100%)`,
          }} />
        </div>
      </div>
    </div>
  );
}
