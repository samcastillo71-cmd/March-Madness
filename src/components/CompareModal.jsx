import { TeamLogo } from './TeamLogo';

export function CompareModal({ teamA, teamB, cardA, cardB, isMammal, onClose }) {
  const bbStats = [
    ['Rank', 'rank'], ['Conference', 'conference'], ['Record', 'record'],
    ['KenPom', 'kenpom'], ['Offense', 'offense'], ['Defense', 'defense'],
    ['Pace', 'pace'], ['Odds', 'odds'], ['Strengths', 'strengths'], ['Weaknesses', 'weaknesses'],
  ];
  const mammalStats = [
    ['Habitat', 'habitat'], ['Diet', 'diet'], ['Superpower', 'superpower'],
    ['Battle Strength', 'battleStrength'], ['Size', 'size'], ['Speed', 'speed'], ['Lifespan', 'lifespan'],
  ];
  const stats = isMammal ? mammalStats : bbStats;
  const accent = isMammal ? '#86efac' : '#4ade80';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20, maxWidth: 700, width: '100%', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: accent, margin: 0, fontSize: 20 }}>Head-to-Head</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 20, gap: 8 }}>
          <div style={{ flex: 1, textAlign: 'right', paddingRight: 12 }}>
            {!isMammal && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TeamLogo espnId={teamA.espnId} name={teamA.name} size={44} /></div>}
            {isMammal && cardA?.wikiImageUrl && <img src={cardA.wikiImageUrl} alt={teamA.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block', marginLeft: 'auto', marginBottom: 6 }} />}
            <div style={{ fontSize: 11, color: accent }}>#{teamA.seed}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{teamA.name}</div>
          </div>
          <div style={{ fontSize: 13, color: '#444', fontWeight: 700, flexShrink: 0, paddingBottom: 4 }}>VS</div>
          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12 }}>
            {!isMammal && <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}><TeamLogo espnId={teamB.espnId} name={teamB.name} size={44} /></div>}
            {isMammal && cardB?.wikiImageUrl && <img src={cardB.wikiImageUrl} alt={teamB.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 6 }} />}
            <div style={{ fontSize: 11, color: accent }}>#{teamB.seed}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{teamB.name}</div>
          </div>
        </div>
        {stats.map(([label, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0', gap: 8 }}>
            <div style={{ flex: 1, textAlign: 'right', fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
              {cardA ? (cardA[key] || <span style={{ color: '#333' }}>—</span>) : <span style={{ color: '#555', fontStyle: 'italic', fontSize: 12 }}>No data</span>}
            </div>
            <div style={{ width: 120, textAlign: 'center', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, paddingTop: 2, flexShrink: 0 }}>{label}</div>
            <div style={{ flex: 1, textAlign: 'left', fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
              {cardB ? (cardB[key] || <span style={{ color: '#333' }}>—</span>) : <span style={{ color: '#555', fontStyle: 'italic', fontSize: 12 }}>No data</span>}
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 8, textAlign: 'right' }}>
          <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '7px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
