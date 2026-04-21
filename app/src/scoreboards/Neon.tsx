import React from 'react';
import { MatchState, OverlaySettings } from '../types';

export function Neon({ state, settings, displayTime, isOvertime }: {
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

  const LogoNeon = ({ team }: { team: 'team1' | 'team2' }) => {
    const t = state.teams[team];
    const c = team === 'team1' ? c1 : c2;
    return (
      <div style={{
        width: ls, height: ls, borderRadius: ls / 2, flexShrink: 0, overflow: 'hidden',
        background: `${c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px solid ${c}99`, boxShadow: `0 0 16px ${c}55, inset 0 0 12px ${c}22`,
      }}>
        {t.logo
          ? <img src={t.logo} alt={t.name} style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
          : <div style={{ width: '60%', height: '60%', border: `2px solid ${c}99`, borderRadius: ls / 4 }} />}
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Rubik', sans-serif", userSelect: 'none' }}>
      <div style={{
        background: 'rgba(2,2,12,0.95)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: `0 0 60px rgba(0,0,0,0.9), 0 0 1px ${c1}44, 0 0 1px ${c2}44`,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 14px 16px' }}>
          <LogoNeon team="team1" />
          <div>
            <div style={{
              fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em',
              color: c1, textShadow: `0 0 14px ${c1}, 0 0 30px ${c1}55`,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>{t1.name}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: c1, opacity: 0.7, marginTop: 3 }}>{t1.city}</div>
          </div>
        </div>

        <div style={{
          padding: '14px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          borderLeft: `1px solid ${c1}33`, borderRight: `1px solid ${c2}33`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 60, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              color: scoreColor, textShadow: `0 0 20px ${scoreColor}88, 0 0 40px ${scoreColor}44`,
            }}>{state.score.team1}</span>
            <span style={{ fontSize: 40, fontWeight: 900, color: 'rgba(255,255,255,0.15)', lineHeight: 1, textShadow: `0 0 20px ${scoreColor}44` }}>:</span>
            <span style={{
              fontSize: 60, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              color: scoreColor, textShadow: `0 0 20px ${scoreColor}88, 0 0 40px ${scoreColor}44`,
            }}>{state.score.team2}</span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: isOvertime ? '#f97316' : 'rgba(255,255,255,0.35)',
            textShadow: isOvertime ? '0 0 10px #f97316' : 'none',
          }}>
            ТАЙМ {state.timer.half} · {displayTime}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 14px 18px', flexDirection: 'row-reverse' }}>
          <LogoNeon team="team2" />
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 22, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em',
              color: c2, textShadow: `0 0 14px ${c2}, 0 0 30px ${c2}55`,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
            }}>{t2.name}</div>
            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: c2, opacity: 0.7, marginTop: 3 }}>{t2.city}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
