import { useRef, useMemo } from 'react';
import { GameSlot }         from './GameSlot';
import { BracketConnector } from './BracketConnector';

const BB_REGION_COLORS = {
  East: 'var(--east)', West: 'var(--west)',
  South: 'var(--south)', Midwest: 'var(--midwest)',
};
const MM_DIVISION_COLORS = {
  Predators: 'var(--div-predators)', Herbivores: 'var(--div-herbivores)',
  Ocean: 'var(--div-ocean)', Nocturnal: 'var(--div-nocturnal)',
};
const ROUND_LABELS = ['R64', 'R32', 'S16', 'E8'];

// Gap between paired game cards — must fit the Compare button (28px) with breathing room.
const GAME_GAP = 48;

export function BracketRegion({
  regionName, rounds, onPick, locked,
  liveScores = {}, isMammal = false,
  onScoreChange, onCompare,
}) {
  const bannerBg  = isMammal ? 'var(--mm-banner)' : 'var(--bb-banner)';
  const accentClr = isMammal ? 'var(--mm-accent)' : 'var(--bb-accent)';
  const barColor  = isMammal
    ? (MM_DIVISION_COLORS[regionName] ?? 'var(--div-predators)')
    : (BB_REGION_COLORS[regionName]   ?? 'var(--east)');

  const roundRefs = useMemo(
    () => rounds.map(round => round.map(() => ({ current: null }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rounds.length, rounds.map(r => r.length).join(',')]
  );

  return (
    <div style={{ borderRadius: 10, boxShadow: '4px 4px 0 var(--ink)' }}>

      {/* Banner */}
      <div style={{ display: 'flex', alignItems: 'stretch',
        border: '2px solid var(--ink)', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
        <div style={{ width: 9, background: barColor, flexShrink: 0 }} />
        <div style={{ flex: 1, background: bannerBg,
          borderBottom: `3px solid ${accentClr}`,
          padding: '11px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Playfair Display, serif',
            fontSize: 19, fontWeight: 900, color: '#fff' }}>
            {regionName}
          </span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 8,
            letterSpacing: 1.5, textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.15)',
            padding: '2px 8px', borderRadius: 3 }}>
            Round of {(rounds[0]?.length ?? 0) * 2}
          </span>
        </div>
      </div>

      {/* Bracket body */}
      <div style={{ position: 'relative', background: 'var(--paper-wt)',
        border: '2px solid var(--ink)', borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        display: 'flex', padding: 14, overflowX: 'auto', gap: 0 }}>

        {rounds.map((roundGames, rIdx) => (
          <div key={rIdx} style={{ display: 'flex', flexDirection: 'column',
            minWidth: 168, flexShrink: 0 }}>

            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 8,
              letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--ink-low)',
              textAlign: 'center', marginBottom: 10 }}>
              {ROUND_LABELS[rIdx] ?? `R${rIdx}`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column',
              flex: 1, justifyContent: 'space-around' }}>
              {roundGames.map((game, gIdx) => {
                const isLastInRound = gIdx === roundGames.length - 1;
                const isPairTop = gIdx % 2 === 0;

                return (
                  <div key={gIdx}>
                    <div ref={el => { if (roundRefs[rIdx]?.[gIdx]) roundRefs[rIdx][gIdx].current = el; }}>
                      <GameSlot
                        game={game}
                        roundIdx={rIdx}
                        locked={locked}
                        isMammal={isMammal}
                        liveScores={liveScores}
                        onPick={(side) => onPick(regionName, rIdx, gIdx, side)}
                        onScoreChange={onScoreChange}
                        onCompare={onCompare}
                      />
                    </div>

                    {/* Compare-button gap between paired games */}
                    {isPairTop && !isLastInRound && (
                      <div style={{ height: GAME_GAP, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {game?.top && game?.bottom && onCompare && (
                          <button
                            onClick={() => onCompare(game.top, game.bottom, isMammal)}
                            style={{
                              padding: '4px 12px',
                              border: '1.5px solid var(--ink)',
                              borderRadius: 4,
                              background: 'var(--paper-wt)',
                              fontFamily: 'DM Mono, monospace',
                              fontSize: 9, fontWeight: 500,
                              letterSpacing: 1, textTransform: 'uppercase',
                              color: 'var(--ink-mid)', cursor: 'pointer',
                              boxShadow: '1px 1px 0 var(--ink)',
                              minHeight: 28, transition: 'all 0.1s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = '#fff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--paper-wt)'; e.currentTarget.style.color = 'var(--ink-mid)'; }}
                          >
                            Compare
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Connector SVG overlay */}
        {rounds.slice(0, -1).map((_, rIdx) => (
          <BracketConnector
            key={rIdx}
            leftGameRefs={roundRefs[rIdx]}
            rightGameRefs={roundRefs[rIdx + 1]}
            color="var(--ink)"
          />
        ))}
      </div>
    </div>
  );
}
