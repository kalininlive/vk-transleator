import React from 'react';
import { MatchState, OverlaySettings } from '../types';

export function Flat({ state, settings, displayTime, isOvertime }: {
  state: MatchState;
  settings: OverlaySettings;
  displayTime: string;
  isOvertime: boolean;
}) {
  const t1 = state.teams.team1;
  const t2 = state.teams.team2;
  const c1 = t1.color || '#2563eb';
  const c2 = t2.color || '#dc2626';
  const ls = settings.logo_size;
  const scoreColor = settings.color_score ?? '#ffffff';

  const LogoFlat = ({ team }: { team: 'team1' | 'team2' }) => {
    const t = state.teams[team];
    const c = team === 'team1' ? c1 : c2;
    return (
      <div style={{
        width: ls, height: ls, flexShrink: 0, overflow: 'hidden',
        background: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {t.logo
          ? <img src={t.logo} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ width: '65%', height: '65%', border: '2px solid rgba(255,255,255,0.4)' }} />}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Rubik', sans-serif", userSelect: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'stretch', overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
      }}>
        <div style={{ width: 5, background: c1, flexShrink: 0 }} />

        <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 0 12px' }}>
          <LogoFlat team="team1" />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 20, fontWeight: 900, color: '#fff', textTransform: 'uppercase',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>{t1.name}</div>
            <div style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
              color: '#fff', background: settings.color_city_badge ?? '#dc2626',
              padding: '1px 6px', marginTop: 3, display: 'inline-block',
            }}>{t1.city}</div>
          </div>
        </div>

        <div style={{
          background: '#111', padding: '12px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 52, fontWeight: 900, color: scoreColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{state.score.team1}</span>
            <span style={{ fontSize: 36, fontWeight: 900, color: 'rgba(255,255,255,0.3)', lineHeight: 1, textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>:</span>
            <span style={{ fontSize: 52, fontWeight: 900, color: scoreColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{state.score.team2}</span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 800, color: isOvertime ? '#f97316' : 'rgba(255,255,255,0.5)',
            letterSpacing: '0.12em', lineHeight: 1,
          }}>
            {state.timer.half}T · {displayTime}
          </div>
        </div>

        <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px 0 16px' }}>
          <div style={{ minWidth: 0, textAlign: 'right' }}>
            <div style={{
              fontSize: 20, fontWeight: 900, color: '#fff', textTransform: 'uppercase',
              letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>{t2.name}</div>
            <div style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
              color: '#fff', background: settings.color_city_badge ?? '#dc2626',
              padding: '1px 6px', marginTop: 3, display: 'inline-block', float: 'right',
            }}>{t2.city}</div>
          </div>
          <LogoFlat team="team2" />
        </div>

        <div style={{ width: 5, background: c2, flexShrink: 0 }} />
      </div>
    </div>
  );
}
