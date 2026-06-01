import { useState } from 'react';
import { EditableField } from './EditableField';

const ACCENT2 = '#4ade80';
const cardStyle = { background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20 };
const tagStyle = (color) => ({ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 });

export function ResearchCard({ teamName, card, isAdmin, onFieldSave }) {
  const [bannerErr, setBannerErr] = useState(false);
  if (!card) return <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#888' }}>No data yet</div>;
  const espnId = card.espnId || '';
  const bannerUrl = espnId ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${espnId}.png&w=900&h=225&scale=crop&location=origin&transparent=false&background=0x1a3a2a` : '';
  const field = (path, value, opts = {}) => isAdmin
    ? <EditableField value={value} onSave={v => onFieldSave(teamName, path, v)} label={path} {...opts} />
    : <span style={{ color: opts.color || '#ccc', fontSize: opts.large ? 38 : 13 }}>{value || '-'}</span>;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ position: 'relative', height: 140, borderRadius: '12px 12px 0 0', overflow: 'hidden', background: 'linear-gradient(135deg,#0d2818,#1a3a2a)' }}>
        {bannerUrl && !bannerErr && <img src={bannerUrl} alt={teamName} onError={() => setBannerErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,0.7) 0%,rgba(0,0,0,0.2) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 16, left: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{card.conference || ''}</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', margin: 0, fontSize: 24, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{teamName}</h2>
        </div>
        {card.record && <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(8px)' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>RECORD</div><div style={{ fontSize: 18, fontWeight: 700, color: ACCENT2 }}>{card.record}</div></div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <h3 style={{ color: ACCENT2, marginBottom: 14, fontFamily: "'Playfair Display', serif" }}>Team Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['Rank','rank'],['Coach','coach'],['Conference','conference'],['KenPom','kenpom'],['Offense','offense'],['Defense','defense'],['Pace','pace']].map(([label, key]) => (
              <div key={key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 12px' }}>
                <div style={tagStyle('#555')}>{label}</div>
                {field(key, card[key], { label })}
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle}>
          <h3 style={{ color: ACCENT2, marginBottom: 12 }}>Key Players</h3>
          {(card.keyPlayers || []).map((p, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                {isAdmin ? <EditableField value={p.name} label="name" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.name`, v)} /> : <span style={{ fontWeight: 700 }}>{p.name}</span>}
                {isAdmin ? <EditableField value={p.pos} label="pos" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} /> : <span style={{ color: '#999', fontSize: 12 }}>{p.pos}</span>}
              </div>
              {isAdmin ? <EditableField value={p.stats} label="stats" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.stats`, v)} /> : <div style={{ fontSize: 13, color: '#999', margin: '3px 0' }}>{p.stats}</div>}
              {isAdmin ? <EditableField value={p.note} label="note" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.note`, v)} color={ACCENT2} /> : <div style={{ fontSize: 12, color: ACCENT2, fontStyle: 'italic' }}>{p.note}</div>}
            </div>
          ))}
          <div style={{ padding: '10px 12px', background: 'rgba(231,76,60,0.07)', borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)', marginTop: 8 }}>
            <div style={tagStyle('#e74c3c')}>Injury Report</div>
            {field('injuries', card.injuries, { multiline: true, label: 'injuries' })}
          </div>
        </div>
        <div style={cardStyle}>
          <h3 style={{ color: ACCENT2, marginBottom: 12 }}>Scouting Report</h3>
          {[['Strengths','#22c55e','strengths'],['Weaknesses','#e74c3c','weaknesses'],['Analyst Note',ACCENT2,'analystNote']].map(([label, color, key]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={tagStyle(color)}>{label}</div>
              {field(key, card[key], { color: '#bbb', multiline: true, label })}
            </div>
          ))}
        </div>
        <div style={cardStyle}>
          <h3 style={{ color: ACCENT2, marginBottom: 10 }}>Championship Odds</h3>
          {field('odds', card.odds, { color: '#22c55e', large: true, label: 'odds' })}
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16, marginTop: 6 }}>Consensus sportsbook odds to win it all</div>
          <div style={{ padding: 12, background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.</div>
        </div>
      </div>
    </div>
  );
}
