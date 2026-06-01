import { memo } from 'react';
import { TeamLogo } from './TeamLogo';

const ROUND_COLORS = [
  'rgba(96,165,250,0.22)', 'rgba(167,139,250,0.22)',
  'rgba(251,191,36,0.18)', 'rgba(239,68,68,0.22)', 'rgba(16,185,129,0.25)',
];
const ROUND_BORDER_COLORS = [
  'rgba(96,165,250,0.6)', 'rgba(167,139,250,0.6)',
  'rgba(251,191,36,0.55)', 'rgba(239,68,68,0.6)', 'rgba(52,211,153,0.7)',
];
const ACCENT2 = '#4ade80';
const GOLD    = '#f59e0b';
const GOLD2   = '#fcd34d';

const scoreInputStyle = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

function findLiveScore(liveScores, teamName) {
  if (!teamName || !liveScores) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(teamName);
  const exact = Object.entries(liveScores).find(([k]) => norm(k) === target);
  if (exact) return exact[1];
  const sub = Object.entries(liveScores).find(([k]) => { const nk = norm(k); return nk.includes(target) || target.includes(nk); });
  return sub ? sub[1] : null;
}

export const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onCompare, isMammal = false }) {
  if (!game) return null;
  const { top, bottom, winner } = game;
  const slotBg     = isChampionship ? 'rgba(245,158,11,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(245,158,11,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];
  const topLive    = findLiveScore(liveScores, top?.name);
  const bottomLive = findLiveScore(liveScores, bottom?.name);
  const hasLive    = topLive && bottomLive;
  const isLiveGame = hasLive && topLive.state === 'in';
  const isFinal    = hasLive && topLive.state === 'post';
  const winColor   = isMammal ? 'var(--mm-win)' : 'var(--bb-win)';

  const Team = ({ team, side }) => {
    if (!team) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, color: '#888', fontSize: 11, fontStyle: 'italic', flexDirection: flipped ? 'row-reverse' : 'row' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#111', flexShrink: 0 }} />TBD
      </div>
    );
    const isW  = winner?.name === team.name;
    const isL  = winner && !isW;
    const isFF = team.isFFPlaceholder;
    const live = side === 'top' ? topLive : bottomLive;
    const isLiveWinning = hasLive && live && live.score > (side === 'top' ? bottomLive?.score : topLive?.score);
    if (isHorizontal) return (
      <div onClick={() => !locked && !isFF && onPick?.(side)}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px', background: isW ? `linear-gradient(180deg,rgba(42,122,79,.3),rgba(42,122,79,.08))` : 'rgba(0,0,0,0.25)', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 6, opacity: isL ? 0.3 : 1, transition: 'background .12s', minWidth: 100, border: isW ? `1px solid rgba(42,122,79,0.4)` : '1px solid rgba(255,255,255,0.06)' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={36} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700 }}>{team.seed}</span>
        <span style={{ fontSize: 14, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textAlign: 'center', maxWidth: 120, lineHeight: 1.2 }}>{isFF ? 'TBD' : team.name}</span>
        {hasLive && live && <span style={{ fontSize: 18, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888' }}>{live.score}</span>}
        {isW && <span style={{ color: ACCENT2, fontSize: 13 }}>✓</span>}
      </div>
    );
    return (
      <div onClick={() => !locked && !isFF && onPick?.(side)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? 'linear-gradient(90deg,rgba(42,122,79,.3),rgba(42,122,79,.08))' : 'rgba(0,0,0,0.25)', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.3 : 1, transition: 'background .12s' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 14, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
          {isFF ? 'First Four Winner' : team.name}
        </span>
        {hasLive && live && <span style={{ fontSize: 13, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888', minWidth: 24, textAlign: 'right', flexShrink: 0 }}>{live.score}</span>}
        {isW && !hasLive && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: ACCENT2, fontSize: 11 }}>✓</span>}
      </div>
    );
  };

  if (isHorizontal) return (
    <div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Team team={top} side="top" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px', gap: 4 }}>
          {isLiveGame && <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /><span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span></>}
          {isFinal && <span style={{ fontSize: 10, color: '#777', fontWeight: 700 }}>FINAL</span>}
          <span style={{ fontSize: 18, fontWeight: 900, color: '#888' }}>VS</span>
          {isChampionship && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input placeholder="–" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={{ ...scoreInputStyle, width: 44, textAlign: 'center' }} />
              <span style={{ color: '#777', fontSize: 13, alignSelf: 'center' }}>-</span>
              <input placeholder="–" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={{ ...scoreInputStyle, width: 44, textAlign: 'center' }} />
            </div>
          )}
        </div>
        <Team team={bottom} side="bottom" />
      </div>
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
        </div>
      )}
    </div>
  );

  return (
    <div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
      <Team team={top} side="top" />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} />
      <Team team={bottom} side="bottom" />
      {isLiveGame && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '2px 8px', background: 'rgba(239,68,68,0.12)', borderTop: '1px solid rgba(239,68,68,0.2)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} /><span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span></div>}
      {isFinal && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.06)' }}><span style={{ fontSize: 10, color: '#777', fontWeight: 700 }}>FINAL</span></div>}
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={scoreInputStyle} />
          <span style={{ color: '#777', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={scoreInputStyle} />
        </div>
      )}
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
        </div>
      )}
    </div>
  );
});
