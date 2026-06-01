import { memo, useState } from 'react';
import { TeamLogo } from './TeamLogo';

function findLiveScore(liveScores, teamName) {
  if (!teamName || !liveScores) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(teamName);
  const exact = Object.entries(liveScores).find(([k]) => norm(k) === target);
  if (exact) return exact[1];
  const sub = Object.entries(liveScores).find(([k]) => {
    const nk = norm(k);
    return nk.includes(target) || target.includes(nk);
  });
  return sub ? sub[1] : null;
}

const scoreInput = {
  width: 52, background: 'var(--paper-lt)', border: '1.5px solid var(--rule)',
  borderRadius: 3, color: 'var(--ink)', padding: '2px 6px', fontSize: 11,
  fontFamily: 'DM Mono, monospace', textAlign: 'center',
};

export const GameSlot = memo(function GameSlot({
  game, onPick, locked, isChampionship, onScoreChange,
  flipped, roundIdx = 0, liveScores = {}, isHorizontal = false,
  onCompare, isMammal = false,
}) {
  const [hovered,    setHovered]    = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  if (!game) return null;
  const { top, bottom, winner } = game;
  const hasBothTeams = !!(top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder);

  const topLive    = findLiveScore(liveScores, top?.name);
  const bottomLive = findLiveScore(liveScores, bottom?.name);
  const hasLive    = !!(topLive && bottomLive);
  const isLiveGame = hasLive && topLive.state === 'in';
  const isFinal    = hasLive && topLive.state === 'post';

  const winColor   = isMammal ? 'var(--mm-win)' : 'var(--bb-win)';
  const cardBorder = isChampionship ? '2px solid rgba(184,150,46,0.5)' : '2px solid var(--ink)';
  const cardBg     = isChampionship ? 'rgba(184,150,46,0.06)'          : 'var(--paper-wt)';

  const Team = ({ team, side }) => {
    if (!team) return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
        height: 36, color: 'var(--ink-low)', fontSize: 11, fontStyle: 'italic',
        flexDirection: flipped ? 'row-reverse' : 'row',
      }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--rule)', flexShrink: 0 }} />
        TBD
      </div>
    );
    const isW  = winner?.name === team.name;
    const isL  = winner && !isW;
    const isFF = team.isFFPlaceholder;
    const live = side === 'top' ? topLive : bottomLive;
    const isLiveWinning = hasLive && live &&
      live.score > (side === 'top' ? bottomLive?.score : topLive?.score);

    const winBg = isMammal
      ? 'linear-gradient(90deg, rgba(90,138,60,0.15), transparent)'
      : 'linear-gradient(90deg, rgba(42,122,79,0.15), transparent)';

    if (isHorizontal) return (
      <div
        onClick={() => !locked && !isFF && onPick?.(side)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          padding: '10px 14px', cursor: locked || isFF ? 'default' : 'pointer',
          borderRadius: 6, opacity: isL ? 0.35 : 1, transition: 'background 0.15s',
          minWidth: 100,
          background: isW ? winBg : 'transparent',
          border: isW ? `1.5px solid ${winColor}` : '1.5px solid var(--rule)',
        }}
      >
        <TeamLogo espnId={team.espnId} name={team.name} size={36} />
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: isW ? winColor : 'var(--ink-low)', fontWeight: 500 }}>{team.seed}</span>
        <span style={{ fontSize: 13, fontWeight: isW ? 700 : 500, color: 'var(--ink)', textAlign: 'center', maxWidth: 110, lineHeight: 1.2 }}>{isFF ? 'TBD' : team.name}</span>
        {hasLive && live && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 700, color: isFinal && live.winner ? winColor : isLiveGame && isLiveWinning ? 'var(--midwest)' : 'var(--ink-mid)' }}>{live.score}</span>}
        {isW && <span style={{ color: winColor, fontSize: 13 }}>✓</span>}
      </div>
    );

    return (
      <div
        onClick={() => !locked && !isFF && onPick?.(side)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
          height: 36, boxSizing: 'border-box',
          flexDirection: flipped ? 'row-reverse' : 'row',
          background: isW ? winBg : 'transparent',
          cursor: locked || isFF ? 'default' : 'pointer',
          opacity: isL ? 0.35 : 1,
          transition: 'background 0.15s',
        }}
      >
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{
          fontFamily: 'DM Mono, monospace', fontSize: 10,
          color: isW ? winColor : 'var(--ink-low)', fontWeight: 500,
          minWidth: 14, textDecoration: isL ? 'line-through' : 'none',
        }}>{team.seed}</span>
        <span style={{
          fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 14,
          fontWeight: isW ? 700 : 400,
          color: isL ? 'var(--ink-low)' : 'var(--ink-mid)',
          textDecoration: isL ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          maxWidth: hasLive ? 80 : 130, flex: 1,
        }}>
          {isFF ? 'First Four Winner' : team.name}
        </span>
        {hasLive && live && (
          <span style={{
            fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700,
            color: isFinal && live.winner ? winColor : isLiveGame && isLiveWinning ? 'var(--midwest)' : 'var(--ink-low)',
            minWidth: 22, textAlign: 'right', flexShrink: 0,
          }}>{live.score}</span>
        )}
        {isW && !hasLive && (
          <span style={{
            marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0,
            color: winColor, fontSize: 10, flexShrink: 0,
          }}>✓</span>
        )}
      </div>
    );
  };

  if (isHorizontal) return (
    <div style={{ border: cardBorder, borderRadius: 10, overflow: 'hidden', background: cardBg }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 8, gap: 8 }}>
        <Team team={top} side="top" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 4px' }}>
          {isLiveGame && (
            <>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--west)', display: 'inline-block' }} />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'var(--west)', fontWeight: 700, letterSpacing: 1 }}>LIVE</span>
            </>
          )}
          {isFinal && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'var(--ink-low)', fontWeight: 700, letterSpacing: 1 }}>FINAL</span>}
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 900, color: 'var(--ink-low)', fontStyle: 'italic' }}>vs</span>
          {isChampionship && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input placeholder="–" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={{ ...scoreInput, width: 40 }} />
              <span style={{ color: 'var(--ink-low)', fontSize: 13, alignSelf: 'center' }}>-</span>
              <input placeholder="–" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={{ ...scoreInput, width: 40 }} />
            </div>
          )}
        </div>
        <Team team={bottom} side="bottom" />
      </div>
    </div>
  );

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setBtnHovered(false); }}
      style={{
        border: cardBorder, borderRadius: 6, overflow: 'hidden',
        background: cardBg, minWidth: 178,
        boxShadow: hovered ? '3px 3px 0 var(--ink)' : '1px 1px 0 var(--rule)',
        transition: 'box-shadow 150ms ease-out',
      }}
    >
      <Team team={top} side="top" />

      {/* Divider — compare button slides up from here on gameslot hover */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', height: 20 }}>
        <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
        {hasBothTeams && onCompare && (
          <button
            onClick={e => { e.stopPropagation(); onCompare(top, bottom, isMammal); }}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
            aria-label={`Compare ${top?.name} vs ${bottom?.name}`}
            style={{
              padding: '2px 10px',
              border: '1.5px solid var(--ink)',
              borderRadius: 99,
              background: btnHovered ? 'var(--ink)' : 'var(--paper-wt)',
              color: btnHovered ? 'var(--paper)' : 'var(--ink)',
              fontFamily: 'DM Mono, monospace',
              fontSize: 8, fontWeight: 500,
              letterSpacing: 1.5, textTransform: 'uppercase',
              cursor: 'pointer', margin: '0 6px', flexShrink: 0,
              opacity: hovered ? 1 : 0,
              transform: hovered ? 'translateY(0) scale(1)' : 'translateY(4px) scale(0.85)',
              pointerEvents: hovered ? 'auto' : 'none',
              transition: 'opacity 150ms ease-out, transform 150ms ease-out, background 100ms, color 100ms',
              boxShadow: btnHovered ? 'none' : '1px 1px 0 var(--ink)',
            }}
          >
            ↔ compare
          </button>
        )}
        <div style={{ flex: 1, height: 1, background: 'var(--rule)' }} />
      </div>

      <Team team={bottom} side="bottom" />

      {isLiveGame && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '2px 8px', background: 'rgba(200,48,42,0.06)', borderTop: '1px solid var(--rule)',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--west)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'var(--west)', fontWeight: 700, letterSpacing: 1 }}>LIVE</span>
        </div>
      )}
      {isFinal && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2px 8px', background: 'var(--paper-lt)', borderTop: '1px solid var(--rule)',
        }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: 'var(--ink-low)', fontWeight: 700, letterSpacing: 1 }}>FINAL</span>
        </div>
      )}
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid var(--rule)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: 'var(--ink-low)', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
    </div>
  );
});
