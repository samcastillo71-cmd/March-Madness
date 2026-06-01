import { TeamLogo } from './TeamLogo';

export function ViewBracketModal({ data, onClose }) {
  const { displayName, bracket, isMammal } = data;
  const regions = ['East', 'West', 'South', 'Midwest'];
  const rounds = ['R64','R32','S16','E8'];
  const accent = isMammal ? '#86efac' : '#4ade80';
  const gold2  = '#fcd34d';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20, maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: accent, margin: 0 }}>{displayName}'s Bracket</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {regions.map(region => (
            <div key={region} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: accent, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>{region}</div>
              {(bracket[region]?.rounds || []).slice(0, 4).map((roundGames, rIdx) => (
                <div key={rIdx} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{rounds[rIdx]}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {roundGames.map((game, gIdx) => game.winner && (
                      <div key={gIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}>
                        {!isMammal && <TeamLogo espnId={game.winner?.espnId} name={game.winner?.name} size={16} />}
                        <span style={{ color: accent, fontWeight: 600 }}>#{game.winner.seed}</span>
                        <span style={{ color: '#ccc' }}>{game.winner.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {bracket.championship?.winner && (
            <div style={{ padding: 16, background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: gold2, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Champion</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: gold2, fontFamily: "'Playfair Display', serif" }}>{bracket.championship.winner.name}</div>
            </div>
          )}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 16, textAlign: 'right' }}>
          <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '7px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
