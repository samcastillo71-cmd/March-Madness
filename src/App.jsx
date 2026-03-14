// src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  saveBracket, loadBracket,
  saveOfficialBracket, subscribeToOfficialBracket,
  subscribeToConfig, setTournamentLocked,
  subscribeToLeaderboard, updateLeaderboardEntry,
  checkIsAdmin, saveResearchData,
  saveOneTeamResearch, subscribeToResearchData,
  saveMammalBracket, loadMammalBracket,
  saveMammalOfficialBracket, subscribeToMammalOfficialBracket,
  subscribeToMammalConfig, setMammalTournamentLocked,
  subscribeToMammalLeaderboard, updateMammalLeaderboardEntry,
  saveMammalResearchData, saveOneMammalResearch, subscribeToMammalResearchData,
  saveMammalRoster,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, buildInitialBracketFromTeams,
  calcScore, emptyResearchCard,
} from './bracketData';

// ── THEME ─────────────────────────────────────────────────────────────────────
const ACCENT  = '#16a34a';
const ACCENT2 = '#4ade80';
const GOLD    = '#f59e0b';
const GOLD2   = '#fcd34d';
const RC = { East: '#93c5fd', West: '#fca5a5', South: '#86efac', Midwest: '#fdba74' };

// Round colors — each round has a distinct tint
const ROUND_COLORS = [
  'rgba(96,165,250,0.22)',   // R64 — blue tint
  'rgba(167,139,250,0.22)',  // R32 — purple tint
  'rgba(251,191,36,0.18)',   // S16 — amber tint
  'rgba(239,68,68,0.22)',    // E8  — red tint
  'rgba(16,185,129,0.25)',   // FF  — teal
];
const ROUND_BORDER_COLORS = [
  'rgba(96,165,250,0.6)',
  'rgba(167,139,250,0.6)',
  'rgba(251,191,36,0.55)',
  'rgba(239,68,68,0.6)',
  'rgba(52,211,153,0.7)',    // FF  — teal
];

const ROUND_LABELS = [
  { main: 'Round of 64',  sub: '"First Round"'    },
  { main: 'Round of 32',  sub: '"Second Round"'   },
  { main: 'Sweet 16',     sub: '"Sweet Sixteen"'  },
  { main: 'Elite Eight',  sub: '"Elite Eight"'    },
];

const S = {
  app:    { minHeight: '100vh', background: '#0a1a0e', color: '#e8f5ee', fontFamily: "'Source Sans 3', sans-serif" },
  header: { background: 'rgba(10,26,14,.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(22,163,74,.5)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: ACCENT2, letterSpacing: 1 },
  card:   { background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20 },
  btn:    (bg = ACCENT, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? ACCENT : 'transparent', color: a ? '#fff' : '#999', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
  tag:    (color) => ({ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }),
};

// ── FORMAT NAME: "J. Smith" ───────────────────────────────────────────────────
function formatName(displayName) {
  if (!displayName) return 'Anonymous';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last  = parts[parts.length - 1];
  return `${first.charAt(0)}. ${last}`;
}

// ── TEAM LOGO ─────────────────────────────────────────────────────────────────
function TeamLogo({ espnId, name, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!espnId || err) return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#14532d,#166534)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
      {name?.charAt(0) || '?'}
    </span>
  );
  return <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#fff' }} onError={() => setErr(true)} />;
}

// ── GAME SLOT ─────────────────────────────────────────────────────────────────
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

// Fuzzy team name match for ESPN API names vs roster names
function findLiveScore(liveScores, teamName) {
  if (!teamName || !liveScores) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(teamName);
  // Exact normalized match first
  const exact = Object.entries(liveScores).find(([k]) => norm(k) === target);
  if (exact) return exact[1];
  // Substring match (handles "North Carolina" vs "UNC" etc)
  const sub = Object.entries(liveScores).find(([k]) => {
    const nk = norm(k);
    return nk.includes(target) || target.includes(nk);
  });
  return sub ? sub[1] : null;
}

function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onMatchup = null }) {
  const [hovered, setHovered] = useState(false);
  if (!game) return null;
  const { top, bottom, winner } = game;
  const slotBg     = isChampionship ? 'rgba(245,158,11,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(245,158,11,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];

  // Find if this game has a live/final score on ESPN
  const topLive    = findLiveScore(liveScores, top?.name);
  const bottomLive = findLiveScore(liveScores, bottom?.name);
  const hasLive    = topLive && bottomLive;
  const isLiveGame = hasLive && topLive.state === 'in';
  const isFinal    = hasLive && topLive.state === 'post';

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
        title={isW && !locked ? 'Click to undo this pick' : ''}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px',
          background: isW ? 'linear-gradient(180deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)',
          cursor: locked || isFF ? 'default' : 'pointer',
          borderRadius: 6, opacity: isL ? 0.3 : 1, transition: 'background .12s', minWidth: 100,
          border: isW ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(255,255,255,0.06)',
        }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={36} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700 }}>{team.seed}</span>
        <span style={{ fontSize: 20, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textAlign: 'center', maxWidth: 130, lineHeight: 1.2 }}>
          {isFF ? 'TBD' : team.name}
        </span>
        {hasLive && live && (
          <span style={{ fontSize: 20, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888' }}>
            {live.score}
          </span>
        )}
        {isW && <span style={{ color: ACCENT2, fontSize: 14 }}>✓</span>}
      </div>
    );

    return (
      <div onClick={() => !locked && !isFF && onPick?.(side)}
        title={isW && !locked ? 'Click to undo this pick' : ''}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box',
          flexDirection: flipped ? 'row-reverse' : 'row',
          background: isW ? 'linear-gradient(90deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)',
          cursor: locked || isFF ? 'default' : 'pointer',
          borderRadius: 4, opacity: isL ? 0.3 : 1, transition: 'background .12s',
        }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: 17, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
          {isFF ? 'FF Winner →' : team.name}
        </span>
        {hasLive && live && (
          <span style={{ fontSize: 13, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888', minWidth: 24, textAlign: 'right', marginLeft: 2, flexShrink: 0 }}>
            {live.score}
          </span>
        )}
        {isW && !hasLive && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: ACCENT2, fontSize: 11 }}>✓</span>}
      </div>
    );
  };

  if (isHorizontal) return (
    <div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        <Team team={top} side="top" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px', gap: 4 }}>
          {isLiveGame && topLive?.clock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span>
            </div>
          )}
          {isFinal && <span style={{ fontSize: 10, color: '#777', fontWeight: 700, letterSpacing: 1 }}>FINAL</span>}
          <span style={{ fontSize: 18, fontWeight: 900, color: '#888' }}>VS</span>
          {isChampionship && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input placeholder="–" value={game.scoreTop || ''} onChange={e => onScoreChange('scoreTop', e.target.value)} style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
              <span style={{ color: '#777', fontSize: 13, alignSelf: 'center' }}>-</span>
              <input placeholder="–" value={game.scoreBottom || ''} onChange={e => onScoreChange('scoreBottom', e.target.value)} style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
            </div>
          )}
        </div>
        <Team team={bottom} side="bottom" />
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', padding: '8px 8px 0 0' }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
      <Team team={top} side="top" />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} />
      <Team team={bottom} side="bottom" />
      {isLiveGame && topLive?.clock && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '2px 8px', background: 'rgba(239,68,68,0.12)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} />
          <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span>
          <span style={{ fontSize: 10, color: '#999' }}>{topLive.period ? `${topLive.period}H` : ''} {topLive.clock}</span>
        </div>
      )}
      {isFinal && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: 10, color: '#777', fontWeight: 700, letterSpacing: 1 }}>FINAL</span>
        </div>
      )}
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#777', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
      </div>
      {/* Matchup research button — shows on hover when both teams present */}
      {onMatchup && top?.name && bottom?.name && !top.isFFPlaceholder && !bottom.isFFPlaceholder && hovered && (
        <button onClick={e => { e.stopPropagation(); onMatchup(top.name, bottom.name); }}
          style={{ position: 'absolute', top: 0, right: 0, zIndex: 20, background: '#1d4ed8', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          title="Compare in Research tab">
          📊
        </button>
      )}
    </div>
  );
}

// ── REGION BRACKET ────────────────────────────────────────────────────────────
const ROW_GAPS = [4, 42, 116, 248];

function roundTopOffset(logicIdx) {
  const slotH = 69, minGap = ROW_GAPS[0];
  return logicIdx === 0 ? 0 : ((Math.pow(2, logicIdx) - 1) * (slotH + minGap)) / 2;
}

function RegionBracket({ region, rounds, onPick, locked, flipped = false, vflipped = false }) {
  const numRounds = rounds.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 14, alignItems: vflipped ? 'flex-end' : 'flex-start' }}>
      {rounds.map((_, iter) => {
        const logicIdx = flipped ? (numRounds - 1 - iter) : iter;
        const theGames = rounds[logicIdx];
        const gapSize  = ROW_GAPS[logicIdx];
        const pad      = roundTopOffset(logicIdx);
        const label    = ROUND_LABELS[logicIdx];
        return (
          <div key={iter} style={{
            display: 'flex', flexDirection: vflipped ? 'column-reverse' : 'column',
            gap: gapSize,
            paddingTop:    vflipped ? 0   : pad,
            paddingBottom: vflipped ? pad : 0,
          }}>
            <div style={{ textAlign: 'center', marginBottom: vflipped ? 0 : 4, marginTop: vflipped ? 4 : 0, whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 11, color: ACCENT2, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>{label?.main}</div>
              <div style={{ fontSize: 9, color: '#777', fontStyle: 'italic', marginTop: 1 }}>{label?.sub}</div>
            </div>
            {theGames.map((game, gIdx) => (
              <GameSlot key={gIdx} game={game} locked={locked} flipped={flipped} roundIdx={logicIdx}
                onPick={side => onPick(region, logicIdx, gIdx, side)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── EDITABLE FIELD ────────────────────────────────────────────────────────────
function EditableField({ value, onSave, color = '#ccc', large = false, multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSavingF] = useState(false);
  const commit = async () => { setSavingF(true); await onSave(draft); setSavingF(false); setEditing(false); };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }} onClick={() => { setDraft(value); setEditing(true); }}>
      <span style={{ color, fontSize: large ? 38 : 13, fontWeight: large ? 700 : 400, lineHeight: 1.5, flex: 1 }}>{value || '-'}</span>
      <span style={{ fontSize: 10, color: '#888', marginTop: large ? 6 : 2, flexShrink: 0 }}>edit</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {multiline
        ? <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={3} style={{ ...S.input, resize: 'vertical', fontSize: 13, padding: '8px 12px' }} />
        : <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus style={{ ...S.input, fontSize: large ? 18 : 13, padding: '6px 12px' }}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
      }
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...S.btn('#22c55e', '#fff'), padding: '5px 14px', fontSize: 12 }} onClick={commit} disabled={saving}>{saving ? '...' : 'Save'}</button>
        <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), padding: '5px 14px', fontSize: 12 }} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ── RESEARCH CARD ─────────────────────────────────────────────────────────────
function ResearchCard({ teamName, card, isAdmin, onFieldSave }) {
  if (!card) return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#888' }}>
      No data yet
    </div>
  );
  const field = (path, value, opts = {}) => isAdmin
    ? <EditableField value={value} onSave={v => onFieldSave(teamName, path, v)} {...opts} />
    : <span style={{ color: opts.color || '#ccc', fontSize: opts.large ? 38 : 13 }}>{value || '-'}</span>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
      <div style={S.card}>
        <h3 style={{ color: ACCENT2, marginBottom: 14, fontFamily: "'Playfair Display', serif" }}>{teamName}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['Record','record'],['Rank','rank'],['Coach','coach'],['Conference','conference'],['KenPom','kenpom'],['Offense','offense'],['Defense','defense'],['Pace','pace']].map(([label, key]) => (
            <div key={key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={S.tag('#555')}>{label}</div>
              {field(key, card[key])}
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={{ color: ACCENT2, marginBottom: 12 }}>Key Players</h3>
        {(card.keyPlayers || []).map((p, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              {isAdmin ? <EditableField value={p.name} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.name`, v)} /> : <span style={{ fontWeight: 700 }}>{p.name}</span>}
              {isAdmin ? <EditableField value={p.pos} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} /> : <span style={{ color: '#999', fontSize: 12 }}>{p.pos}</span>}
            </div>
            {isAdmin ? <EditableField value={p.stats} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.stats`, v)} /> : <div style={{ fontSize: 13, color: '#999', margin: '3px 0' }}>{p.stats}</div>}
            {isAdmin ? <EditableField value={p.note} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.note`, v)} color={ACCENT2} /> : <div style={{ fontSize: 12, color: ACCENT2, fontStyle: 'italic' }}>{p.note}</div>}
          </div>
        ))}
        <div style={{ padding: '10px 12px', background: 'rgba(231,76,60,0.07)', borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)', marginTop: 8 }}>
          <div style={S.tag('#e74c3c')}>Injury Report</div>
          {field('injuries', card.injuries, { multiline: true })}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={{ color: ACCENT2, marginBottom: 12 }}>Scouting Report</h3>
        {[['Strengths','#22c55e','strengths'],['Weaknesses','#e74c3c','weaknesses'],['Analyst Note',ACCENT2,'analystNote']].map(([label, color, key]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={S.tag(color)}>{label}</div>
            {field(key, card[key], { color: '#bbb', multiline: true })}
          </div>
        ))}
      </div>
      <div style={S.card}>
        <h3 style={{ color: ACCENT2, marginBottom: 10 }}>Championship Odds</h3>
        {field('odds', card.odds, { color: '#22c55e', large: true })}
        <div style={{ fontSize: 13, color: '#777', marginBottom: 16, marginTop: 6 }}>Consensus sportsbook odds to win it all</div>
        <div style={{ padding: 12, background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
          Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.
        </div>
        {isAdmin && <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: '#777' }}>Click any field above to edit it.</div>}
      </div>
    </div>
  );
}

// ── PLACEHOLDER ROSTERS ───────────────────────────────────────────────────────
const PLACEHOLDER_ANIMALS = {
  East:    ['African Lion','Snow Leopard','Gray Wolf','Brown Bear','Cheetah','Mountain Lion','Wolverine','Honey Badger','Arctic Fox','Red Fox','Bobcat','Lynx','Ocelot','Caracal','Serval','Clouded Leopard'],
  West:    ['African Elephant','White Rhino','Hippo','Giraffe','Cape Buffalo','Moose','Bison','Kodiak Bear','Polar Bear','Grizzly Bear','Black Bear','Jaguar','Tiger','Cougar','Leopard','Hyena'],
  South:   ['Killer Whale','Sperm Whale','Humpback Whale','Great White Shark','Bottlenose Dolphin','Sea Lion','Walrus','Narwhal','Beluga Whale','Orca','Manta Ray','Giant Squid','Octopus','Saltwater Croc','Komodo Dragon','Anaconda'],
  Midwest: ['Peregrine Falcon','Bald Eagle','Great Horned Owl','Harpy Eagle','Golden Eagle','Osprey','Red-tailed Hawk','Snowy Owl','Secretary Bird','Martial Eagle','Wedge-tailed Eagle','Philippine Eagle','Barn Owl','Great Grey Owl','Barred Owl','Steller\'s Sea Eagle'],
};

function makePlaceholderRoster() {
  const regions = ['East','West','South','Midwest'];
  const out = { year: new Date().getFullYear() };
  regions.forEach(r => {
    out[r] = Array(16).fill(null).map((_, i) => ({ seed: i+1, name: `Seed ${i+1}`, espnId: '', firstFour: false }));
  });
  return out;
}

function makePlaceholderMammalRoster() {
  const regions = ['East','West','South','Midwest'];
  const out = {};
  regions.forEach(r => {
    out[r] = PLACEHOLDER_ANIMALS[r].map((name, i) => ({ seed: i+1, name, firstFour: false }));
  });
  return out;
}

// ── ESPN BRACKET IMPORT ───────────────────────────────────────────────────────
async function importFromESPN() {
  // ESPN bracket endpoint — group 100 = NCAA Tournament
  const urls = [
    'https://site.web.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/22?region=us&lang=en',
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/22',
  ];

  let data = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) { data = await res.json(); break; }
    } catch {}
  }

  // Fallback: try scoreboard with tournament filter
  if (!data) {
    try {
      const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=64');
      if (res.ok) data = await res.json();
    } catch {}
  }

  if (!data) throw new Error('Could not reach ESPN API. Try again or enter teams manually.');

  // Parse bracket structure — ESPN returns regions with seeds and teams
  const regionMap = { East: [], West: [], South: [], Midwest: [] };
  const regionNames = Object.keys(regionMap);

  // Try tournament bracket format
  const bracket = data.bracket || data.rounds?.[0] || data.tournament?.bracket;
  if (bracket) {
    // Walk bracket tree to find all R1 matchups
    const walkBracket = (node) => {
      if (!node) return;
      if (node.competitors) {
        node.competitors.forEach(c => {
          const region = regionNames.find(r => c.region?.toLowerCase().includes(r.toLowerCase()));
          if (region && c.team) {
            regionMap[region].push({ seed: c.seed, name: c.team.displayName || c.team.name, espnId: String(c.team.id || ''), firstFour: false });
          }
        });
      }
      (node.children || node.games || []).forEach(walkBracket);
    };
    walkBracket(bracket);
  }

  // Try groups/regions format
  const groups = data.groups || data.regions || data.rounds?.[0]?.groups;
  if (groups && Object.values(regionMap).every(r => r.length === 0)) {
    groups.forEach(group => {
      const regionName = regionNames.find(r => group.name?.toLowerCase().includes(r.toLowerCase()) || group.abbreviation?.toLowerCase().includes(r.toLowerCase()[0]));
      if (!regionName) return;
      (group.teams || group.standings?.entries || []).forEach(entry => {
        const team = entry.team || entry;
        const seed = entry.seed || entry.curatedRank?.current || 0;
        regionMap[regionName].push({ seed, name: team.displayName || team.name || '', espnId: String(team.id || ''), firstFour: false });
      });
    });
  }

  // Check if we got anything useful
  const totalTeams = Object.values(regionMap).reduce((s, r) => s + r.length, 0);
  if (totalTeams < 16) throw new Error(`ESPN returned only ${totalTeams} teams — the tournament bracket may not be announced yet. Check back after Selection Sunday.`);

  // Sort by seed and cap at 16 (+FF slots) per region
  Object.keys(regionMap).forEach(r => {
    regionMap[r].sort((a, b) => a.seed - b.seed);
    // Mark potential First Four (seed 11 or 16 with duplicates)
    const seedCounts = {};
    regionMap[r].forEach(t => { seedCounts[t.seed] = (seedCounts[t.seed] || 0) + 1; });
    regionMap[r] = regionMap[r].map(t => ({ ...t, firstFour: seedCounts[t.seed] > 1 }));
  });

  return { ...regionMap, year: new Date().getFullYear() };
}

// ── ADMIN TEAM ENTRY PANEL ────────────────────────────────────────────────────
function makeEmptyRoster() {
  return makePlaceholderRoster();
}

function TeamEntryPanel({ onTeamsSaved, onRequestGenerateResearch }) {
  const [roster,       setRoster]       = useState(makeEmptyRoster());
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [applied,      setApplied]      = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'teamRoster'));
        if (snap.exists()) {
          const d = snap.data(); delete d.updatedAt;
          // Only use saved roster if it has actual team names, otherwise show placeholders
          const hasNames = ['East','West','South','Midwest'].some(r => (d[r] || []).some(t => t.name?.trim()));
          setRoster(hasNames ? d : makePlaceholderRoster());
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const updateTeam = (region, idx, field, value) => {
    setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[region][idx][field] = value; return n; });
    setSaved(false); setApplied(false);
  };

  const addTeamSlot = (region) => {
    setRoster(prev => {
      const n = JSON.parse(JSON.stringify(prev));
      n[region].push({ seed: '', name: '', espnId: '', firstFour: true });
      return n;
    });
  };

  const removeTeamSlot = (region, idx) => {
    setRoster(prev => {
      const n = JSON.parse(JSON.stringify(prev));
      n[region].splice(idx, 1);
      return n;
    });
    setSaved(false);
  };

  const [importing,    setImporting]    = useState(false);
  const [importStatus, setImportStatus] = useState(''); // '', 'success', 'error'
  const [importMsg,    setImportMsg]    = useState('');

  // Step 1: Save roster only (fast)
  const handleSaveRoster = async () => {
    setSaving(true);
    await setDoc(doc(db, 'admin', 'teamRoster'), { ...roster, updatedAt: serverTimestamp() });
    setSaving(false); setSaved(true);
  };

  // Step 2: Apply to bracket (separate, slower step)
  const handleApplyToBracket = async () => {
    setApplying(true);
    const nb = buildInitialBracketFromTeams(roster);
    await saveOfficialBracket(nb);
    setApplying(false); setApplied(true);
    onTeamsSaved(nb, roster);
  };

  // ESPN Import
  const handleESPNImport = async () => {
    setImporting(true); setImportStatus(''); setImportMsg('Fetching from ESPN...');
    try {
      const imported = await importFromESPN();
      setRoster(imported);
      setSaved(false); setApplied(false);
      setImportStatus('success');
      const total = Object.values(imported).filter(v => Array.isArray(v)).reduce((s, r) => s + r.length, 0);
      setImportMsg(`✓ Imported ${total} teams! Review below, then Save Roster → Apply to Bracket.`);
    } catch (e) {
      setImportStatus('error');
      setImportMsg(e.message || 'Import failed — try again or enter teams manually.');
    }
    setImporting(false);
  };

  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading roster...</div>;

  const regionTeams = roster[activeRegion] || [];

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: ACCENT2, marginBottom: 4 }}>Set Up This Year's Teams</h3>
          <p style={{ color: '#999', fontSize: 13 }}>Import from ESPN after Selection Sunday, or enter teams manually. You can always edit individual teams after importing.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* ESPN Import button */}
          <button style={{ ...S.btn('#0284c7', '#fff'), padding: '8px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleESPNImport} disabled={importing}>
            {importing ? '⏳ Importing...' : '📡 Import from ESPN'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Year:</span>
            <input type="number" value={roster.year} onChange={e => { setRoster(p => ({ ...p, year: parseInt(e.target.value) })); setSaved(false); }} style={{ ...S.input, width: 82, padding: '6px 10px', fontSize: 13 }} />
          </div>
          <button style={{ ...S.btn(saved ? '#22c55e' : ACCENT, '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={handleSaveRoster} disabled={saving}>
            {saving ? 'Saving...' : saved ? '✓ Roster Saved' : 'Save Roster'}
          </button>
          {saved && (
            <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }} onClick={handleApplyToBracket} disabled={applying}>
              {applying ? 'Applying...' : applied ? '✓ Applied!' : 'Apply to Bracket'}
            </button>
          )}
          {(applied || roster['East']?.some(t => t.name && t.name !== '' && !t.name.startsWith('Seed'))) && (
            <button style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={() => onRequestGenerateResearch(roster)}>
              ✨ Auto-Generate Research
            </button>
          )}
        </div>
      </div>

      {/* ESPN import status */}
      {importMsg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: importStatus === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${importStatus === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 13, color: importStatus === 'success' ? ACCENT2 : '#f87171' }}>
          {importMsg}
        </div>
      )}

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 12 }}>
        {[['1. Save Roster', saved], ['2. Apply to Bracket', applied], ['3. Generate Research (optional)', false]].map(([label, done], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: done ? 'rgba(22,163,74,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${done ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)'}`, color: done ? ACCENT2 : '#555' }}>
            {done ? '✓' : `${i+1}`} {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>●</span>{r}
            <span style={{ marginLeft: 6, fontSize: 11, color: '#777' }}>({roster[r]?.length || 0})</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {regionTeams.map((team, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: team.firstFour ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: team.firstFour ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
            {/* Editable seed */}
            <input
              type="number" min="1" max="16"
              value={team.seed}
              onChange={e => updateTeam(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)}
              style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }}
              title="Seed number (two FF teams can share the same seed)"
            />
            <input placeholder={`Team name`} value={team.name} onChange={e => updateTeam(activeRegion, idx, 'name', e.target.value)} style={{ ...S.input, flex: 2, padding: '6px 10px', fontSize: 13 }} />
            <input placeholder="ESPN ID" value={team.espnId} onChange={e => updateTeam(activeRegion, idx, 'espnId', e.target.value)} style={{ ...S.input, width: 80, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={team.firstFour} onChange={e => updateTeam(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: team.firstFour ? '#818cf8' : '#888', whiteSpace: 'nowrap', fontWeight: team.firstFour ? 700 : 400 }}>FF</span>
            </label>
            {regionTeams.length > 16 && (
              <button onClick={() => removeTeamSlot(activeRegion, idx)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }} title="Remove slot">×</button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={() => addTeamSlot(activeRegion)} style={{ ...S.btn('rgba(99,102,241,0.2)', '#818cf8'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(99,102,241,0.3)' }}>
          + Add FF Slot
        </button>
        <div style={{ flex: 1, padding: '7px 14px', background: 'rgba(96,165,250,0.07)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', fontSize: 12, color: '#93c5fd' }}>
          ESPN ID tip: espn.com/mens-college-basketball/team/_/id/<strong>150</strong>/duke — number after /id/
        </div>
      </div>
    </div>
  );
}

// ── AI RESEARCH GENERATOR ─────────────────────────────────────────────────────
async function generateResearchForTeam(teamName, seed, region) {
  const prompt = `You are writing a basketball team scouting report for middle school students (grades 6-8) for the ${new Date().getFullYear()} NCAA Tournament.
Write about: ${teamName} (${region} Region, Seed #${seed})
Use simple, clear language that a 12-14 year old can easily understand. Avoid jargon — if you use a basketball term, briefly explain it.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"record":"W-L","rank":"#N AP or Unranked","coach":"Coach Name","conference":"Conference Name","kenpom":"#N","offense":"NNN.N","defense":"NN.N","pace":"NN.N","keyPlayers":[{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"simple 1-sentence note a student would understand"},{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"simple 1-sentence note a student would understand"}],"injuries":"injury status or None reported","odds":"+XXXX or N/A","strengths":"2-3 sentences explaining what this team does well, written for a middle schooler","weaknesses":"2-3 sentences explaining where this team struggles, written for a middle schooler","analystNote":"1-2 sentences on why this team could surprise people in the tournament"}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  console.log('Gemini response status:', res.status, JSON.stringify(data).slice(0, 300));
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch (e) { console.warn('JSON parse failed:', text.slice(0,200)); return null; }
}

// ── MAMMAL AI RESEARCH GENERATOR ─────────────────────────────────────────────
async function generateMammalResearch(animalName, seed, region) {
  const prompt = `You are a nature educator writing animal profiles for middle school students (grades 6-8).
Generate a fun, age-appropriate JSON profile for: ${animalName} (${region} Region, Seed #${seed}) competing in March Mammal Madness.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"habitat":"2-3 sentence description of where this animal lives","diet":"2-3 sentences on what it eats and how it hunts or forages","funFacts":["interesting fact 1","interesting fact 2","interesting fact 3"],"size":"weight and length/height","lifespan":"X-Y years","speed":"top speed if known, or movement description","superpower":"1 sentence on this animal's most impressive ability or adaptation","battleStrength":"1-2 sentence fun assessment of how this animal would do in a bracket battle and why"}
Keep all language at a middle school reading level. Make it engaging and educational. No graphic violence descriptions.`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return null; }
}

// ── MAMMAL TEAM ENTRY PANEL ───────────────────────────────────────────────────
function MammalEntryPanel({ onAnimalsSaved, onRequestGenerateMammalResearch, regionNames, onRegionNamesChange }) {
  const [roster,       setRoster]       = useState({ East: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), West: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), South: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), Midwest: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })) });
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [applied,      setApplied]      = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'mammalRoster'));
        if (snap.exists()) {
          const d = snap.data();
          if (d._regionNames) onRegionNamesChange(d._regionNames);
          delete d.updatedAt; delete d._regionNames;
          setRoster(d);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const updateAnimal = (region, idx, field, value) => {
    setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[region][idx][field] = value; return n; });
    setSaved(false); setApplied(false);
  };

  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading roster...</div>;

  return (
    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: '#86efac', marginBottom: 4 }}>🦁 Set Up Mammal Madness Animals</h3>
          <p style={{ color: '#999', fontSize: 13 }}>Enter the 64 animals competing in this year's March Mammal Madness tournament.</p>
          {/* Region name editor */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#86efac', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
            {['East','West','South','Midwest'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
                <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })}
                  placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...S.btn(saved ? '#22c55e' : ACCENT, '#fff'), padding: '8px 20px', fontSize: 13 }}
            onClick={async () => { setSaving(true); await saveMammalRoster({ ...roster, _regionNames: regionNames }); setSaving(false); setSaved(true); }} disabled={saving}>
            {saving ? 'Saving...' : saved ? '✓ Roster Saved' : 'Save Roster'}
          </button>
          <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }}
            onClick={async () => { setApplying(true); const nb = buildInitialBracketFromTeams(roster); await saveMammalOfficialBracket(nb); setApplying(false); setApplied(true); onAnimalsSaved(nb, roster); }} disabled={applying}>
            {applying ? 'Applying...' : applied ? '✓ Applied!' : 'Apply to Bracket'}
          </button>
          <button style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={() => onRequestGenerateMammalResearch(roster)}>
            ✨ Auto-Generate Animal Facts
          </button>

        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>●</span>{r}
            <span style={{ marginLeft: 6, fontSize: 11, color: '#777' }}>({roster[activeRegion]?.length || 0})</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(roster[activeRegion] || []).map((animal, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: animal.firstFour ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: animal.firstFour ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
            <input type="number" min="1" max="16" value={animal.seed} onChange={e => updateAnimal(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)} style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Animal name (e.g. African Lion)" value={animal.name} onChange={e => updateAnimal(activeRegion, idx, 'name', e.target.value)} style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={animal.firstFour} onChange={e => updateAnimal(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: animal.firstFour ? '#818cf8' : '#888', whiteSpace: 'nowrap', fontWeight: animal.firstFour ? 700 : 400 }}>FF</span>
            </label>
          </div>
        ))}
      </div>
      <button onClick={() => setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[activeRegion].push({ seed: '', name: '', firstFour: true }); return n; })} style={{ ...S.btn('rgba(99,102,241,0.2)', '#818cf8'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(99,102,241,0.3)', marginTop: 12 }}>
        + Add FF Slot
      </button>
    </div>
  );
}

// ── MAMMAL RESEARCH CARD ──────────────────────────────────────────────────────
function MammalResearchCard({ animalName, card, isAdmin, onFieldSave, onGenerate, generating }) {
  const empty = !card || Object.keys(card).length === 0;
  return (
    <div style={{ ...S.card, marginBottom: 20, borderColor: 'rgba(134,239,172,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#86efac', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>🦁 Animal Profile</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', margin: 0, fontSize: 22 }}>{animalName}</h2>
        </div>
        {isAdmin && (
          <button onClick={() => onGenerate(animalName)} disabled={generating} style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 18px', fontSize: 13 }}>
            {generating ? '⏳ Generating...' : '✨ Generate Facts'}
          </button>
        )}
      </div>
      {empty ? (
        <div style={{ color: '#666', fontSize: 14, fontStyle: 'italic' }}>
          {isAdmin ? 'No data yet — click "Generate Facts" to auto-populate.' : 'Animal facts coming soon!'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['🌍 Habitat', 'habitat'],
            ['🍖 Diet & Hunting', 'diet'],
            ['⚡ Superpower', 'superpower'],
            ['⚔️ Battle Strength', 'battleStrength'],
          ].map(([label, field]) => (
            <div key={field} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, color: '#86efac', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{card[field] || '—'}</div>
            </div>
          ))}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, color: '#86efac', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>🌟 Fun Facts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(card.funFacts || []).map((fact, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: '#86efac', fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                  <span style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{fact}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, gridColumn: '1 / -1', flexWrap: 'wrap' }}>
            {[['📏 Size', card.size], ['⏳ Lifespan', card.lifespan], ['💨 Speed', card.speed]].map(([label, val]) => val && (
              <div key={label} style={{ background: 'rgba(134,239,172,0.06)', borderRadius: 8, padding: '10px 16px', border: '1px solid rgba(134,239,172,0.15)' }}>
                <div style={{ fontSize: 11, color: '#86efac', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 14, color: '#ccc' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── REVEAL MODE PANEL ─────────────────────────────────────────────────────────
// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,             setUser]            = useState(null);
  const [isAdmin,          setIsAdmin]         = useState(false);
  const [isTeacher,        setIsTeacher]       = useState(false);
  const [authLoading,      setAuthLoading]     = useState(true);
  const [tab,              setTab]             = useState('bracket');
  const [bracket,          setBracket]         = useState(() => buildInitialBracket());
  const [officialBracket,  setOfficialBracket] = useState(null);
  const [locked,           setLocked]          = useState(false);
  const [leaderboard,      setLeaderboard]     = useState([]);
  const [saving,           setSaving]          = useState(false);
  const [lastSaved,        setLastSaved]       = useState(null);
  const [researchData,     setResearchData]    = useState({});
  const [selectedTeam,     setSelectedTeam]    = useState(null);
  const [researchMatchup,  setResearchMatchup] = useState(null); // { teamA, teamB, label, isMammal }
  const [adminSubTab,      setAdminSubTab]     = useState('dashboard');
  const [generating,       setGenerating]      = useState(false);
  const [genProgress,      setGenProgress]     = useState({ done: 0, total: 0, current: '' });
  const [firstFourPicks,   setFirstFourPicks]  = useState({});
  const [tournamentYear,   setTournamentYear]  = useState(CURRENT_YEAR);
  const [yearDraft,        setYearDraft]       = useState(String(CURRENT_YEAR));
  const [yearSaving,       setYearSaving]      = useState(false);
  const [liveScores,       setLiveScores]      = useState({});
  // ── TOURNAMENT SWITCHER ───────────────────────────────────────────────────
  const [activeTournament, setActiveTournament] = useState('basketball'); // 'basketball' | 'mammals'
  // ── MAMMAL STATE ──────────────────────────────────────────────────────────
  const [mammalBracket,       setMammalBracket]       = useState(() => buildInitialBracketFromTeams(makePlaceholderMammalRoster()));
  const [mammalOfficialBracket, setMammalOfficialBracket] = useState(null);
  const [mammalLocked,        setMammalLocked]        = useState(false);
  const [mammalLeaderboard,   setMammalLeaderboard]   = useState([]);
  const [mammalResearchData,  setMammalResearchData]  = useState({});
  const [mammalSelectedAnimal, setMammalSelectedAnimal] = useState(null);
  const [mammalFirstFourPicks, setMammalFirstFourPicks] = useState({});
  const [mammalGenerating,    setMammalGenerating]    = useState(false);
  const [mammalGenProgress,   setMammalGenProgress]   = useState({ done: 0, total: 0, current: '' });
  const [mammalGeneratingOne, setMammalGeneratingOne] = useState(null);
  const [mammalRegionNames,   setMammalRegionNames]   = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });
  const prevMammalBracket = useRef(null);
  const prevMammalFF      = useRef(null);
  const mammalSaveTimer   = useRef(null); // { "Team Name": { score, oppScore, period, clock, status } }

  const saveTimer   = useRef(null);
  const prevBracket = useRef(null);
  const prevFF      = useRef(null);

  // Load year before login
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'tournament', 'config'));
        if (snap.exists() && snap.data().year) {
          setTournamentYear(snap.data().year);
          setYearDraft(String(snap.data().year));
        }
      } catch {}
    })();
  }, []);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, async fbUser => {
    if (fbUser) {
      setUser(fbUser);
      const admin = await checkIsAdmin(fbUser.uid);
      setIsAdmin(admin);
      // Check teacher role
      try {
        const tSnap = await getDoc(doc(db, 'teachers', fbUser.uid));
        setIsTeacher(tSnap.exists());
      } catch {}
      const saved = await loadBracket(fbUser.uid);
      if (saved) {
        if (saved._firstFourPicks) {
          setFirstFourPicks(saved._firstFourPicks);
          const { _firstFourPicks, ...bracketOnly } = saved;
          setBracket(bracketOnly);
        } else { setBracket(saved); }
      }
      // Load mammal bracket
      const savedMammal = await loadMammalBracket(fbUser.uid);
      // Load mammal region names + official bracket directly (don't wait for subscription)
      try {
        const rSnap = await getDoc(doc(db, 'admin', 'mammalRoster'));
        if (rSnap.exists() && rSnap.data()._regionNames) setMammalRegionNames(rSnap.data()._regionNames);
      } catch {}
      try {
        const obSnap = await getDoc(doc(db, 'admin', 'officialBracket_mammals'));
        if (obSnap.exists()) {
          const ob = JSON.parse(obSnap.data().bracket);
          const obSample = ob['East']?.rounds?.[0]?.[0]?.top?.name;
          setMammalOfficialBracket(ob);
          // If user has no saved picks, or their picks use different animals, start from official
          const userSample = savedMammal?.['East']?.rounds?.[0]?.[0]?.top?.name;
          if (!userSample || userSample !== obSample) {
              setMammalBracket(ob);
          }
        } else {
// no official bracket yet
        }
      } catch(e) { console.warn('[MMM] error loading official bracket:', e); }
      if (savedMammal) {
        const obSnap2 = await getDoc(doc(db, 'admin', 'officialBracket_mammals'));
        const obSample2 = obSnap2.exists() ? JSON.parse(obSnap2.data().bracket)?.['East']?.rounds?.[0]?.[0]?.top?.name : null;
        const userSample2 = savedMammal?.['East']?.rounds?.[0]?.[0]?.top?.name;
        // Only restore user's saved bracket if animals match official (picks are still valid)
        if (!obSample2 || userSample2 === obSample2) {
          if (savedMammal._firstFourPicks) {
            setMammalFirstFourPicks(savedMammal._firstFourPicks);
            const { _firstFourPicks, ...bracketOnly } = savedMammal;
            setMammalBracket(bracketOnly);
          } else { setMammalBracket(savedMammal); }
        }
      }
    } else { setUser(null); setIsAdmin(false); setIsTeacher(false); setBracket(buildInitialBracket()); setMammalBracket(buildInitialBracketFromTeams(makePlaceholderMammalRoster())); }
    setAuthLoading(false);
  }), []);

  // ── LIVE SUBSCRIPTIONS ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToOfficialBracket(b => {
      // Only use official bracket if it has real team names
      const hasRealTeams = b && ['East','West','South','Midwest'].some(r =>
        b[r]?.rounds?.[0]?.some(g => g?.top?.name && g.top.name !== '' && !g.top.name.startsWith('Seed ')));
      const placeholder = buildInitialBracket();
      setOfficialBracket(hasRealTeams ? b : null);
      if (isAdmin) setBracket(hasRealTeams ? b : placeholder);
      else setBracket(prev => {
        // If user's saved bracket has no real teams, show placeholder
        const userHasTeams = ['East','West','South','Midwest'].some(r =>
          prev[r]?.rounds?.[0]?.some(g => g?.top?.name && g.top.name !== '' && !g.top.name.startsWith('Seed ')));
        return userHasTeams ? prev : placeholder;
      });
    });
    const u2 = subscribeToConfig(cfg => {
      setLocked(cfg.locked ?? false);
      if (cfg.year) { setTournamentYear(cfg.year); setYearDraft(String(cfg.year)); }
    });
    const u3 = subscribeToLeaderboard(setLeaderboard);
    const u4 = subscribeToResearchData(data => {
      setResearchData(data);
      if (!selectedTeam && Object.keys(data).length > 0) setSelectedTeam(Object.keys(data)[0]);
    });
    const u5 = subscribeToMammalOfficialBracket(b => {
      if (!b) return;

      setMammalOfficialBracket(b);
      // Admins always see official bracket
      if (isAdmin) { setMammalBracket(b); return; }
      // Non-admins: use official bracket as base if their saved picks don't have matching animals
      setMammalBracket(prev => {
        const officialSample = b['East']?.rounds?.[0]?.[0]?.top?.name;
        const userSample = prev['East']?.rounds?.[0]?.[0]?.top?.name;
        // If user's bracket already has the official animals, keep their picks
        if (userSample && officialSample && userSample === officialSample) return prev;
        // Otherwise seed from official (user hasn't picked yet or animals changed)
        return b;
      });
    });
    const u6 = subscribeToMammalConfig(cfg => { setMammalLocked(cfg.locked ?? false); });
    const u7 = subscribeToMammalLeaderboard(setMammalLeaderboard);
    const u8 = subscribeToMammalResearchData(data => {
      setMammalResearchData(data);
      // Only auto-select first animal if none is selected yet — never override user's current selection
      setMammalSelectedAnimal(prev => {
        if (prev) return prev;
        const keys = Object.keys(data);
        return keys.length > 0 ? keys[0] : null;
      });
    });
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [user, isAdmin]);

  // ── LIVE SCORES (ESPN public API, polls every 60s during tournament) ───────
  useEffect(() => {
    if (!user) return;
    const fetchScores = async () => {
      try {
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard');
        const data = await res.json();
        const scores = {};
        (data.events || []).forEach(event => {
          const status = event.status?.type;
          const isLive = status?.state === 'in' || status?.state === 'post';
          if (!isLive) return;
          const comp = event.competitions?.[0];
          if (!comp) return;
          comp.competitors?.forEach(team => {
            const name = team.team?.displayName || team.team?.shortDisplayName || '';
            const score = parseInt(team.score) || 0;
            const opp   = comp.competitors?.find(t => t.id !== team.id);
            scores[name] = {
              score,
              oppScore: parseInt(opp?.score) || 0,
              period: event.status?.period ?? null,
              clock:  event.status?.displayClock ?? '',
              state:  status?.state,       // 'in' | 'post' | 'pre'
              winner: team.winner ?? false,
            };
          });
        });
        setLiveScores(scores);
      } catch {}
    };
    fetchScores();
    const interval = setInterval(fetchScores, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // ── SMART AUTO-SAVE (only when changed) ──────────────────────────────────
  useEffect(() => {
    if (!user || (locked && !isAdmin)) return;
    const bracketStr = JSON.stringify(bracket);
    const ffStr      = JSON.stringify(firstFourPicks);
    // Skip if nothing changed
    if (bracketStr === prevBracket.current && ffStr === prevFF.current) return;
    prevBracket.current = bracketStr;
    prevFF.current      = ffStr;

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveBracket(user.uid, { ...bracket, _firstFourPicks: firstFourPicks }, user.displayName, user.photoURL);
      const score = calcScore(bracket, officialBracket);
      await updateLeaderboardEntry(user.uid, user.displayName, user.photoURL, score, isTeacher);
      setSaving(false); setLastSaved(new Date());
    }, 3000); // 3s debounce
    return () => clearTimeout(saveTimer.current);
  }, [bracket, firstFourPicks, user, locked, isAdmin, officialBracket, isTeacher]);

  // ── MAMMAL AUTO-SAVE ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (mammalLocked && !isAdmin)) return;
    const bStr = JSON.stringify(mammalBracket);
    const fStr = JSON.stringify(mammalFirstFourPicks);
    if (bStr === prevMammalBracket.current && fStr === prevMammalFF.current) return;
    prevMammalBracket.current = bStr;
    prevMammalFF.current = fStr;
    clearTimeout(mammalSaveTimer.current);
    mammalSaveTimer.current = setTimeout(async () => {
      await saveMammalBracket(user.uid, { ...mammalBracket, _firstFourPicks: mammalFirstFourPicks }, user.displayName, user.photoURL);
      const score = calcScore(mammalBracket, mammalOfficialBracket);
      await updateMammalLeaderboardEntry(user.uid, user.displayName, user.photoURL, score, isTeacher);
    }, 3000);
    return () => clearTimeout(mammalSaveTimer.current);
  }, [mammalBracket, mammalFirstFourPicks, user, mammalLocked, isAdmin, mammalOfficialBracket, isTeacher]);

  // ── PICK HANDLERS ─────────────────────────────────────────────────────────
  const clearTeamDownstream = (next, region, teamName, fromRound) => {
    for (let r = fromRound; r < 4; r++) {
      next[region].rounds[r].forEach(g => {
        if (g.top?.name    === teamName) { g.top    = null; g.winner = null; }
        if (g.bottom?.name === teamName) { g.bottom = null; g.winner = null; }
        if (g.winner?.name === teamName)   g.winner = null;
      });
    }
    const fi    = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
    const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
    if (next.finalFour[fi][fSide]?.name === teamName) next.finalFour[fi][fSide] = null;
    if (next.finalFour[fi].winner?.name === teamName) next.finalFour[fi].winner = null;
    const cSide = fi === 0 ? 'top' : 'bottom';
    if (next.championship[cSide]?.name  === teamName) next.championship[cSide]  = null;
    if (next.championship.winner?.name  === teamName) next.championship.winner  = null;
  };

  const handlePick = useCallback((region, rIdx, gIdx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const game = next[region].rounds[rIdx][gIdx];
      if (!game) return prev;

      // null side = undo winner (from reveal panel)
      if (side === null) {
        if (game.winner) clearTeamDownstream(next, region, game.winner.name, rIdx + 1);
        game.winner = null;
        if (isAdmin) saveOfficialBracket(next);
        return next;
      }

      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked || clicked.isFFPlaceholder) return prev;
      if (game.winner?.name === clicked.name) {
        game.winner = null;
        clearTeamDownstream(next, region, clicked.name, rIdx + 1);
        if (isAdmin) saveOfficialBracket(next);
        return next;
      }
      game.winner = clicked;
      const loser = side === 'top' ? game.bottom : game.top;
      if (loser) clearTeamDownstream(next, region, loser.name, rIdx + 1);
      if (rIdx < 3) {
        const ng    = next[region].rounds[rIdx + 1][Math.floor(gIdx / 2)];
        const nSide = gIdx % 2 === 0 ? 'top' : 'bottom';
        ng[nSide]   = clicked;
        if (ng.winner?.name !== clicked.name) ng.winner = null;
      }
      if (rIdx === 3) {
        const fi    = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
        const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
        next.finalFour[fi][fSide] = clicked;
        if (next.finalFour[fi].winner?.name !== clicked.name) next.finalFour[fi].winner = null;
      }
      if (isAdmin) saveOfficialBracket(next);
      return next;
    });
  }, [locked, isAdmin]);

  const handleMammalPick = useCallback((region, rIdx, gIdx, side) => {
    if (mammalLocked && !isAdmin) return;
    setMammalBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const game = next[region]?.rounds?.[rIdx]?.[gIdx];
      if (!game) return prev;

      const clearMammalDownstream = (b, reg, teamName, fromRound) => {
        for (let r = fromRound; r < 4; r++) {
          b[reg].rounds[r].forEach(g => {
            if (g.top?.name    === teamName) { g.top    = null; g.winner = null; }
            if (g.bottom?.name === teamName) { g.bottom = null; g.winner = null; }
            if (g.winner?.name === teamName)   g.winner = null;
          });
        }
        const fi    = { East: 0, West: 0, South: 1, Midwest: 1 }[reg];
        const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[reg];
        if (b.finalFour?.[fi]?.[fSide]?.name  === teamName) b.finalFour[fi][fSide]  = null;
        if (b.finalFour?.[fi]?.winner?.name    === teamName) b.finalFour[fi].winner  = null;
        const cSide = fi === 0 ? 'top' : 'bottom';
        if (b.championship?.[cSide]?.name      === teamName) b.championship[cSide]   = null;
        if (b.championship?.winner?.name       === teamName) b.championship.winner   = null;
      };

      if (side === null) {
        if (game.winner) clearMammalDownstream(next, region, game.winner.name, rIdx + 1);
        game.winner = null;
        if (isAdmin) saveMammalOfficialBracket(next);
        return next;
      }
      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked) return prev;
      if (game.winner?.name === clicked.name) {
        game.winner = null;
        clearMammalDownstream(next, region, clicked.name, rIdx + 1);
        if (isAdmin) saveMammalOfficialBracket(next);
        return next;
      }
      game.winner = clicked;
      const loser = side === 'top' ? game.bottom : game.top;
      if (loser) clearMammalDownstream(next, region, loser.name, rIdx + 1);
      if (rIdx < 3) {
        const ng = next[region].rounds[rIdx + 1]?.[Math.floor(gIdx / 2)];
        if (ng) { const nSide = gIdx % 2 === 0 ? 'top' : 'bottom'; ng[nSide] = clicked; if (ng.winner?.name !== clicked.name) ng.winner = null; }
      }
      if (rIdx === 3) {
        const fi    = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
        const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
        if (next.finalFour?.[fi]) { next.finalFour[fi][fSide] = clicked; if (next.finalFour[fi].winner?.name !== clicked.name) next.finalFour[fi].winner = null; }
      }
      if (isAdmin) saveMammalOfficialBracket(next);
      return next;
    });
  }, [mammalLocked, isAdmin]);

  const handleMammalFFPick = useCallback((idx, side) => {
    if (mammalLocked && !isAdmin) return;
    setMammalBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ff = next.finalFour[idx];
      const clicked = ff[side];
      if (!clicked) return prev;
      if (ff.winner?.name === clicked.name) {
        ff.winner = null;
        const cSide = idx === 0 ? 'top' : 'bottom';
        next.championship[cSide] = null; next.championship.winner = null;
        if (isAdmin) saveMammalOfficialBracket(next);
        return next;
      }
      ff.winner = clicked;
      const cSide = idx === 0 ? 'top' : 'bottom';
      next.championship[cSide] = clicked;
      if (next.championship.winner?.name !== clicked.name) next.championship.winner = null;
      if (isAdmin) saveMammalOfficialBracket(next);
      return next;
    });
  }, [mammalLocked, isAdmin]);

  const handleMammalChampPick = useCallback(side => {
    if (mammalLocked && !isAdmin) return;
    setMammalBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const clicked = next.championship[side];
      if (!clicked) return prev;
      if (next.championship.winner?.name === clicked.name) { next.championship.winner = null; return next; }
      next.championship.winner = clicked;
      if (isAdmin) saveMammalOfficialBracket(next);
      return next;
    });
  }, [mammalLocked, isAdmin]);

  const handleFFPick = useCallback((idx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ff = next.finalFour[idx];
      const clicked = ff[side];
      if (!clicked) return prev;
      if (ff.winner?.name === clicked.name) {
        ff.winner = null;
        const cSide = idx === 0 ? 'top' : 'bottom';
        next.championship[cSide] = null;
        next.championship.winner = null;
        if (isAdmin) saveOfficialBracket(next);
        return next;
      }
      ff.winner = clicked;
      const cSide = idx === 0 ? 'top' : 'bottom';
      next.championship[cSide] = clicked;
      if (next.championship.winner?.name !== clicked.name) next.championship.winner = null;
      if (isAdmin) saveOfficialBracket(next);
      return next;
    });
  }, [locked, isAdmin]);

  const handleChampPick = useCallback(side => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const clicked = next.championship[side];
      if (!clicked) return prev;
      if (next.championship.winner?.name === clicked.name) { next.championship.winner = null; return next; }
      next.championship.winner = clicked;
      return next;
    });
  }, [locked, isAdmin]);

  const handleChampScore = useCallback((field, val) =>
    setBracket(prev => ({ ...prev, championship: { ...prev.championship, [field]: val } })), []);

  // First Four picks: when user picks a FF winner, replace the FF placeholder in R64
  const handleFirstFourPick = useCallback((key, winner, region, seed) => {
    if (locked && !isAdmin) return;
    setFirstFourPicks(prev => {
      if (prev[key] === winner.name) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: winner.name };
    });
    // Replace FF placeholder in R64 with the actual winner
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const r64  = next[region]?.rounds[0];
      if (!r64) return prev;
      r64.forEach(game => {
        if (game.top?.isFFPlaceholder && game.top.seed === seed) {
          game.top = { ...winner, isFFPlaceholder: false };
        }
        if (game.bottom?.isFFPlaceholder && game.bottom.seed === seed) {
          game.bottom = { ...winner, isFFPlaceholder: false };
        }
      });
      return next;
    });
  }, [locked, isAdmin]);

  const handleTeamsSaved = useCallback((newBracket) => {
    setBracket(newBracket); setOfficialBracket(newBracket);
  }, []);

  // ── SAVE TOURNAMENT YEAR ──────────────────────────────────────────────────
  const handleSaveYear = async () => {
    const yr = parseInt(yearDraft);
    if (!yr || yr < 2000 || yr > 2100) return;
    setYearSaving(true);
    await setDoc(doc(db, 'tournament', 'config'), { year: yr }, { merge: true });
    setTournamentYear(yr);
    setYearSaving(false);
  };

  // ── GENERATE ALL RESEARCH ─────────────────────────────────────────────────
  const handleGenerateResearch = useCallback(async (roster) => {
    const teams = [];
    ['East','West','South','Midwest'].forEach(region => {
      (roster[region] || []).forEach(t => { if (!t.firstFour && t.name) teams.push({ name: t.name, seed: t.seed, region }); });
    });
    if (!teams.length) return;
    setGenerating(true);
    setGenProgress({ done: 0, total: teams.length, current: teams[0].name });
    const allData = { ...researchData };
    for (let i = 0; i < teams.length; i++) {
      const { name, seed, region } = teams[i];
      setGenProgress({ done: i, total: teams.length, current: name });
      let card = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          card = await generateResearchForTeam(name, seed, region);
          if (card) break;
        } catch (e) { console.warn('Failed attempt', attempt + 1, name, e); }
        if (attempt < 2) await new Promise(r => setTimeout(r, 5000));
      }
      if (card) {
        allData[name] = { ...card, seed, region };
        // Save after each team so progress isn't lost if interrupted
        await saveResearchData(allData);
        setResearchData({ ...allData });
      }
      // 5 seconds between requests = 12 per minute, safely under the 15/min limit
      if (i < teams.length - 1) await new Promise(r => setTimeout(r, 5000));
    }
    setGenProgress({ done: teams.length, total: teams.length, current: '' });
    setGenerating(false);
    if (!selectedTeam && Object.keys(allData).length > 0) setSelectedTeam(Object.keys(allData)[0]);
  }, [researchData, selectedTeam]);

  // ── EDIT RESEARCH FIELD ───────────────────────────────────────────────────
  const handleResearchFieldSave = useCallback(async (teamName, fieldPath, value) => {
    setResearchData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[teamName]) next[teamName] = {};
      const parts = fieldPath.split('.');
      let obj = next[teamName];
      for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
    await saveOneTeamResearch(teamName, (() => {
      const card = JSON.parse(JSON.stringify(researchData[teamName] || {}));
      const parts = fieldPath.split('.');
      let obj = card;
      for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
      obj[parts[parts.length - 1]] = value;
      return card;
    })());
  }, [researchData]);

  // ── EDIT MAMMAL RESEARCH FIELD ───────────────────────────────────────────
  const handleMammalResearchFieldSave = useCallback(async (animalName, fieldPath, value) => {
    setMammalResearchData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[animalName]) next[animalName] = {};
      const parts = fieldPath.split('.');
      let obj = next[animalName];
      for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
    await saveOneMammalResearch(animalName, (() => {
      const card = JSON.parse(JSON.stringify(mammalResearchData[animalName] || {}));
      const parts = fieldPath.split('.');
      let obj = card;
      for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
      obj[parts[parts.length - 1]] = value;
      return card;
    })());
  }, [mammalResearchData]);

  // ── AI ASSISTANT ──────────────────────────────────────────────────────────
  const score        = calcScore(bracket, officialBracket);
  const myRank       = leaderboard.findIndex(e => e.uid === user?.uid) + 1;
  const allTeamNames = Object.keys(researchData).sort();

  // Split leaderboard into teachers and students
  const teacherBoard  = leaderboard.filter(e => e.isTeacher);
  const studentBoard  = leaderboard.filter(e => !e.isTeacher);

  // ── MAMMAL DERIVED STATE ──────────────────────────────────────────────────
  const mammalScore      = calcScore(mammalBracket, mammalOfficialBracket);
  const mammalMyRank     = mammalLeaderboard.findIndex(e => e.uid === user?.uid) + 1;
  const allAnimalNames   = Object.keys(mammalResearchData).sort();
  const mammalTeacherBoard = mammalLeaderboard.filter(e => e.isTeacher);
  const mammalStudentBoard = mammalLeaderboard.filter(e => !e.isTeacher);

  // ── MAMMAL GENERATE ALL RESEARCH ─────────────────────────────────────────
  const handleGenerateMammalResearch = useCallback(async (roster) => {
    const animals = [];
    ['East','West','South','Midwest'].forEach(region => {
      (roster[region] || []).forEach(a => { if (!a.firstFour && a.name) animals.push({ name: a.name, seed: a.seed, region }); });
    });
    if (!animals.length) return;
    setMammalGenerating(true);
    setMammalGenProgress({ done: 0, total: animals.length, current: animals[0].name });
    const allData = { ...mammalResearchData };
    for (let i = 0; i < animals.length; i++) {
      const { name, seed, region } = animals[i];
      setMammalGenProgress({ done: i, total: animals.length, current: name });
      let card = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          card = await generateMammalResearch(name, seed, region);
          if (card) break;
        } catch (e) { console.warn('Failed attempt', attempt + 1, name, e); }
        if (attempt < 2) await new Promise(r => setTimeout(r, 5000));
      }
      if (card) {
        allData[name] = { ...card, seed, region };
        await saveMammalResearchData(allData);
        setMammalResearchData({ ...allData });
      }
      if (i < animals.length - 1) await new Promise(r => setTimeout(r, 5000));
    }
    setMammalGenProgress({ done: animals.length, total: animals.length, current: '' });
    setMammalGenerating(false);
    if (!mammalSelectedAnimal && Object.keys(allData).length > 0) setMammalSelectedAnimal(Object.keys(allData)[0]);
  }, [mammalResearchData, mammalSelectedAnimal]);

  // ── MAMMAL GENERATE ONE ───────────────────────────────────────────────────
  const handleGenerateOneMammal = useCallback(async (animalName) => {
    setMammalGeneratingOne(animalName);
    try {
      const card = await generateMammalResearch(animalName, mammalResearchData[animalName]?.seed || 1, mammalResearchData[animalName]?.region || '');
      if (card) {
        await saveOneMammalResearch(animalName, { ...card, seed: mammalResearchData[animalName]?.seed, region: mammalResearchData[animalName]?.region });
        setMammalResearchData(prev => ({ ...prev, [animalName]: { ...card, seed: prev[animalName]?.seed, region: prev[animalName]?.region } }));
      }
    } catch (e) { console.warn('Failed:', animalName, e); }
    setMammalGeneratingOne(null);
  }, [mammalResearchData]);

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: ACCENT2, fontSize: 18 }}>Loading...</div>
    </div>
  );

  if (!user) return (
    <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 88, marginBottom: 12 }}>🏀</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, color: ACCENT2, letterSpacing: 2, lineHeight: 1.1 }}>
          MARCH MADNESS<br />{tournamentYear}
        </h1>
        <p style={{ color: '#777', fontSize: 16, marginTop: 10 }}>School-Wide Bracket Challenge</p>
      </div>
      <div style={{ ...S.card, textAlign: 'center', maxWidth: 380, padding: '36px 40px' }}>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
          Sign in with your school Google account to fill out your bracket and compete with your classmates and teachers.
        </p>
        <button style={S.btn()} onClick={signInWithGoogle}>
          <span style={{ fontWeight: 900, marginRight: 8 }}>G</span> Sign in with Google
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'bracket',     label: 'Bracket'     },
    { id: 'research',    label: 'Research'    },
    { id: 'leaderboard', label: 'Leaderboard' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  // Collect FF games from bracket for the First Four section
  const ffGamesList = [];
  ['East','West','South','Midwest'].forEach(region => {
    (bracket[region]?.rounds[0] || []).forEach(game => {
      const hasFF = game?.top?.isFFPlaceholder || game?.bottom?.isFFPlaceholder;
      if (hasFF) {
        const ffTeam = game.top?.isFFPlaceholder ? game.top : game.bottom;
        const key = `${region}-${ffTeam.seed}`;
        if (!ffGamesList.find(f => f.key === key) && ffTeam.ffTeams) {
          ffGamesList.push({ region, seed: ffTeam.seed, ffTeams: ffTeam.ffTeams, key });
        }
      }
    });
  });

  return (
    <div style={S.app}>
      <style>{`
        .bscroll { scrollbar-width: thin; scrollbar-color: rgba(22,163,74,0.5) rgba(255,255,255,0.04); }
        .bscroll::-webkit-scrollbar { height: 10px; }
        .bscroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 5px; }
        .bscroll::-webkit-scrollbar-thumb { background: rgba(22,163,74,0.5); border-radius: 5px; }
        .bscroll::-webkit-scrollbar-thumb:hover { background: rgba(22,163,74,0.8); }
        .bscroll-top { scrollbar-width: thin; scrollbar-color: rgba(22,163,74,0.5) rgba(255,255,255,0.04); }
        .bscroll-top::-webkit-scrollbar { height: 10px; }
        .bscroll-top::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 5px; }
        .bscroll-top::-webkit-scrollbar-thumb { background: rgba(22,163,74,0.5); border-radius: 5px; }
        .bscroll-top::-webkit-scrollbar-thumb:hover { background: rgba(22,163,74,0.8); }
        @keyframes champGlow { 0%,100%{box-shadow:0 0 24px rgba(245,158,11,0.3)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.6)} }
        @keyframes livePulse  { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      <header style={S.header}>
        <div style={S.logo}>🏀 MARCH MADNESS {tournamentYear}</div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user.photoURL && <img src={user.photoURL} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />}
          <span style={{ fontSize: 13, color: '#888' }}>{user.displayName?.split(' ')[0]}</span>
          {isTeacher && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: GOLD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
          {saving && <span style={{ fontSize: 11, color: '#777' }}>Saving...</span>}
          {!saving && lastSaved && <span style={{ fontSize: 11, color: '#166534' }}>Saved</span>}
          <button onClick={logOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>Sign out</button>
        </div>
      </header>

      <main style={{ paddingBottom: 60 }}>

        {/* ══════════════════ BRACKET TAB ══════════════════ */}
        {tab === 'bracket' && (
          <div style={{ padding: 20 }}>

            {/* Tournament Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setActiveTournament('basketball')} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>
                🏀 Basketball
              </button>
              <button onClick={() => setActiveTournament('mammals')} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>
                🦁 Mammal Madness
              </button>
            </div>

            {activeTournament === 'mammals' && (
              <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14, borderColor: 'rgba(134,239,172,0.25)' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#86efac', letterSpacing: 1, textTransform: 'uppercase' }}>Your Mammal Score</div>
                  <div style={{ fontSize: 38, fontWeight: 700, color: '#86efac', fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                    {mammalScore} <span style={{ fontSize: 14, color: '#888' }}>/ 1,920 pts</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: mammalLocked ? '#e74c3c' : '#22c55e', marginBottom: 6 }}>
                    {mammalLocked ? '🔒 Brackets Locked' : '🟢 Picks Open'}
                  </div>
                  {isAdmin && (
                    <button style={{ ...S.btn(mammalLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 12, padding: '6px 16px' }}
                      onClick={async () => { const nl = !mammalLocked; setMammalLocked(nl); await setMammalTournamentLocked(nl); }}>
                      {mammalLocked ? 'Unlock Brackets' : 'Lock All Brackets'}
                    </button>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#777' }}>School Rank</div>
                  <div style={{ fontSize: 34, fontWeight: 700, color: '#86efac', fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                    {mammalMyRank > 0 ? `#${mammalMyRank}` : '-'}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>of {mammalLeaderboard.length || '-'} entries</div>
                </div>
              </div>
            )}

            {activeTournament === 'mammals' && (
              <>
            {/* Mammal bracket scroll */}
            <div className="bscroll-top" style={{ overflowX: 'auto', overflowY: 'hidden', height: 12, marginBottom: 2 }}
              onScroll={e => { const b = document.querySelector('.bscroll-m'); if (b) b.scrollLeft = e.currentTarget.scrollLeft; }}>
              <div style={{ minWidth: `${240 * 11}px`, height: 1 }} />
            </div>
            <div className="bscroll-m bscroll" style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, cursor: 'grab' }}
              onScroll={e => { const t = document.querySelector('.bscroll-top'); if (t) t.scrollLeft = e.currentTarget.scrollLeft; }}
              onMouseDown={e => {
                const el = e.currentTarget; el.style.cursor = 'grabbing';
                const startX = e.pageX - el.offsetLeft, startScroll = el.scrollLeft;
                const onMove = mv => { el.scrollLeft = startScroll - (mv.pageX - el.offsetLeft - startX); };
                const onUp = () => { el.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
              }}>
              <div style={{ display: 'inline-block', paddingBottom: 8 }}>
                {(() => {
                  const CW = 240, SH = 89, SPINE_H = 56, TOP_H = 8 * SH, BOT_H = TOP_H;
                  const TOTAL_W = CW * 4 + CW * 3 + CW * 4;
                  const ROUND_ABS = [
                    [0,89,178,267,356,445,534,623],
                    [44.5,222.5,400.5,578.5],
                    [133.5,489.5],
                    [311.5],
                  ];
                  const activeMammal = isAdmin ? (mammalOfficialBracket || mammalBracket) : mammalBracket;

                  const MRoundCol = ({ region, rIdx, flip, dir }) => {
                    const games = activeMammal[region]?.rounds[rIdx] || [];
                    const positions = ROUND_ABS[rIdx];
                    return (
                      <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative', boxSizing: 'border-box' }}>
                        {games.map((game, gIdx) => {
                          const pos = positions[gIdx] ?? gIdx * SH;
                          return (
                            <div key={gIdx} style={{ position: 'absolute', left: 0, right: 0, ...(dir === 'top' ? { top: pos } : { bottom: pos }) }}>
                              <GameSlot game={game} locked={mammalLocked && !isAdmin} flipped={flip} roundIdx={rIdx}
                                onPick={side => handleMammalPick(region, rIdx, gIdx, side)}
                                onMatchup={(a, b) => { setResearchMatchup({ teamA: a, teamB: b, label: `${region} — ${['R64','R32','S16','E8'][rIdx]}`, isMammal: true }); setTab('research'); setActiveTournament('mammals'); }} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  };

                  const MSpineCell = ({ label, color, borderLeft = true }) => (
                    <div style={{ width: CW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: borderLeft ? '1px solid rgba(255,255,255,0.08)' : 'none', background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ height: SPINE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
                      </div>
                    </div>
                  );

                  const S16_CENTER_X = CW * 2.5, LABEL_TOP = TOP_H / 2;

                  return (
                    <div style={{ width: TOTAL_W, overflow: 'hidden' }}>
                      {/* TOP — East + West */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: LABEL_TOP + SH, left: S16_CENTER_X + CW, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.East, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>{ mammalRegionNames.East }</span>
                        </div>
                        <div style={{ position: 'absolute', top: LABEL_TOP + SH, right: S16_CENTER_X + CW * 2, transform: 'translate(50%,-50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.West, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>{ mammalRegionNames.West }</span>
                        </div>
                        {[0,1,2,3].map(rIdx => <MRoundCol key={rIdx} region="East" rIdx={rIdx} flip={false} dir="top" />)}
                        <div style={{ width: CW * 3, flexShrink: 0, height: TOP_H }} />
                        {[3,2,1,0].map(rIdx => <MRoundCol key={rIdx} region="West" rIdx={rIdx} flip={true} dir="top" />)}
                      </div>

                      {/* SPINE */}
                      <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '2px solid rgba(255,255,255,0.15)', borderBottom: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
                        <MSpineCell label="Round of 64" color={ROUND_BORDER_COLORS[0]} borderLeft={false} />
                        <MSpineCell label="Round of 32" color={ROUND_BORDER_COLORS[1]} />
                        <MSpineCell label="Sweet 16"    color={ROUND_BORDER_COLORS[2]} />
                        <MSpineCell label="Elite Eight" color={ROUND_BORDER_COLORS[3]} />
                        {/* Center */}
                        <div style={{ width: CW * 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 10px', background: 'linear-gradient(135deg,rgba(134,239,172,0.15),rgba(22,163,74,0.10))', border: '2px solid rgba(134,239,172,0.5)', borderRadius: 10, animation: 'champGlow 3s ease-in-out infinite' }}>
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Final Four — East vs West</div>
                              <GameSlot game={activeMammal.finalFour?.[0]} onPick={s => handleMammalFFPick(0, s)} locked={mammalLocked && !isAdmin} roundIdx={4} />
                            </div>
                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                              <GameSlot game={activeMammal.finalFour?.[1]} onPick={s => handleMammalFFPick(1, s)} locked={mammalLocked && !isAdmin} roundIdx={4} />
                              <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Final Four — South vs Midwest</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 14 }}>🦁</span>
                              <span style={{ fontSize: 11, fontWeight: 800, color: '#86efac', letterSpacing: 1, fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap' }}>Championship</span>
                              <span style={{ fontSize: 14 }}>🦁</span>
                            </div>
                            <GameSlot game={activeMammal.championship} onPick={handleMammalChampPick} locked={mammalLocked && !isAdmin} isChampionship isHorizontal roundIdx={-1} />
                            {activeMammal.championship?.winner && (
                              <div style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(134,239,172,0.15)', borderRadius: 5, border: '1px solid rgba(134,239,172,0.4)' }}>
                                <div style={{ fontSize: 9, color: '#86efac', letterSpacing: 1.5 }}>🎉 CHAMPION</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>{activeMammal.championship.winner.name}</div>
                              </div>
                            )}
                          </div>
                        </div>
                        <MSpineCell label="Elite Eight" color={ROUND_BORDER_COLORS[3]} />
                        <MSpineCell label="Sweet 16"    color={ROUND_BORDER_COLORS[2]} />
                        <MSpineCell label="Round of 32" color={ROUND_BORDER_COLORS[1]} />
                        <MSpineCell label="Round of 64" color={ROUND_BORDER_COLORS[0]} />
                      </div>

                      {/* BOTTOM — South + Midwest */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: LABEL_TOP - SH, left: S16_CENTER_X + CW, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.South, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>{ mammalRegionNames.South }</span>
                        </div>
                        <div style={{ position: 'absolute', top: LABEL_TOP - SH, right: S16_CENTER_X + CW * 2.5, transform: 'translate(50%,-50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.Midwest, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>{ mammalRegionNames.Midwest }</span>
                        </div>
                        {[0,1,2,3].map(rIdx => <MRoundCol key={rIdx} region="South" rIdx={rIdx} flip={false} dir="bot" />)}
                        <div style={{ width: CW * 3, flexShrink: 0, height: BOT_H }} />
                        {[3,2,1,0].map(rIdx => <MRoundCol key={rIdx} region="Midwest" rIdx={rIdx} flip={true} dir="bot" />)}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
              </>
            )}

            {activeTournament !== 'mammals' && (
              <>
            {/* Score bar */}
            <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#777', letterSpacing: 1, textTransform: 'uppercase' }}>Your Score</div>
                <div style={{ fontSize: 38, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                  {score} <span style={{ fontSize: 14, color: '#888' }}>/ 1,920 pts</span>
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>ESPN scoring (max 1,920)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: locked ? '#e74c3c' : '#22c55e', marginBottom: 6 }}>
                  {locked ? '🔒 Brackets Locked' : '🟢 Picks Open'}
                </div>
                {isAdmin && (
                  <button style={{ ...S.btn(locked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 12, padding: '6px 16px' }}
                    onClick={async () => { const nl = !locked; setLocked(nl); await setTournamentLocked(nl); }}>
                    {locked ? 'Unlock Brackets' : 'Lock All Brackets'}
                  </button>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#777' }}>School Rank</div>
                <div style={{ fontSize: 34, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                  {myRank > 0 ? `#${myRank}` : '-'}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>of {leaderboard.length || '-'} entries</div>
              </div>
            </div>

            {/* First Four */}
            {ffGamesList.length > 0 && (
              <div style={{ marginBottom: 20, padding: '16px 18px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', letterSpacing: 2, marginBottom: 2 }}>FIRST FOUR — PLAY-IN GAMES</div>
                <div style={{ fontSize: 11, color: '#777', marginBottom: 14 }}>Pick who wins each play-in game and advances into the main bracket</div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {ffGamesList.map(({ region, seed, ffTeams, key }) => {
                    const pick    = firstFourPicks[key];
                    const isLockd = locked && !isAdmin;
                    return (
                      <div key={key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 14px', minWidth: 210 }}>
                        <div style={{ fontSize: 10, color: RC[region], fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                          {region} — #{seed} seed play-in
                        </div>
                        {ffTeams.map(team => {
                          const isPick = pick === team.name;
                          return (
                            <div key={team.name} onClick={() => !isLockd && handleFirstFourPick(key, team, region, seed)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, marginBottom: 5, cursor: isLockd ? 'default' : 'pointer', background: isPick ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)', border: isPick ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)', transition: 'all .12s' }}>
                              <TeamLogo espnId={team.espnId} name={team.name} size={20} />
                              <span style={{ fontSize: 10, color: '#777', fontWeight: 700, minWidth: 14 }}>{team.seed}</span>
                              <span style={{ fontSize: 12, fontWeight: isPick ? 700 : 400, color: isPick ? '#a5b4fc' : '#bbb', flex: 1 }}>{team.name}</span>
                              {isPick && <span style={{ color: '#818cf8', fontSize: 13 }}>✓</span>}
                            </div>
                          );
                        })}
                        {pick
                          ? <div style={{ fontSize: 10, color: '#777', textAlign: 'center', marginTop: 4 }}>{pick} advances as #{seed} seed</div>
                          : <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginTop: 4 }}>pick a winner</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MAIN BRACKET ── */}
            {/* Top scrollbar mirror */}
            <div className="bscroll-top" style={{ overflowX: 'auto', overflowY: 'hidden', height: 12, marginBottom: 2 }}
              onScroll={e => { const b = document.querySelector('.bscroll'); if (b) b.scrollLeft = e.currentTarget.scrollLeft; }}>
              <div style={{ minWidth: `${240 * 11}px`, height: 1 }} />
            </div>
            <div className="bscroll" style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, cursor: 'grab' }}
              onScroll={e => { const t = document.querySelector('.bscroll-top'); if (t) t.scrollLeft = e.currentTarget.scrollLeft; }}
              onMouseDown={e => {
                const el = e.currentTarget;
                el.style.cursor = 'grabbing';
                const startX = e.pageX - el.offsetLeft;
                const startScroll = el.scrollLeft;
                const onMove = mv => { el.scrollLeft = startScroll - (mv.pageX - el.offsetLeft - startX); };
                const onUp = () => { el.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}>
              <div style={{ display: 'inline-block', paddingBottom: 8 }}>
                {(() => {
                  const CW = 240;
                  const SH = 89;
                  const SPINE_H = 56;
                  const TOP_H = 8 * SH;
                  const BOT_H = TOP_H;

                  const hasLeftFF  = ffGamesList.some(f => f.region === 'East' || f.region === 'South');
                  const hasRightFF = ffGamesList.some(f => f.region === 'West' || f.region === 'Midwest');
                  // Total width: FF? + 4 East + 3 center + 4 West + FF?
                  const TOTAL_W = (hasLeftFF ? CW : 0) + CW * 4 + CW * 3 + CW * 4 + (hasRightFF ? CW : 0);

                  // Absolute top positions for each round (from col edge toward spine)
                  // SH=89: slot=36px, divider=1px, game=73px, spacing~16px => ~89px per game slot
                  const ROUND_ABS = [
                    [0, 89, 178, 267, 356, 445, 534, 623],         // R64  (i * SH)
                    [44.5, 222.5, 400.5, 578.5],                   // R32
                    [133.5, 489.5],                                 // S16
                    [311.5],                                        // E8
                  ];

                  const RoundCol = ({ region, rIdx, flip, dir }) => {
                    const games = bracket[region]?.rounds[rIdx] || [];
                    const positions = ROUND_ABS[rIdx];
                    return (
                      <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative', boxSizing: 'border-box' }}>
                        {games.map((game, gIdx) => {
                          const pos = positions[gIdx] ?? gIdx * SH;
                          return (
                            <div key={gIdx} style={{ position: 'absolute', left: 0, right: 0, ...(dir === 'top' ? { top: pos } : { bottom: pos }) }}>
                              <GameSlot game={game} locked={locked && !isAdmin} flipped={flip} roundIdx={rIdx}
                                liveScores={liveScores}
                                onPick={side => handlePick(region, rIdx, gIdx, side)}
                                onMatchup={(a, b) => { setResearchMatchup({ teamA: a, teamB: b, label: `${region} — ${['R64','R32','S16','E8'][rIdx]}`, isMammal: false }); setTab('research'); setActiveTournament('basketball'); }} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  };



                  const FFCol = ({ regionTop, regionBot }) => {
                    const topGames = ffGamesList.filter(f => f.region === regionTop);
                    const botGames = ffGamesList.filter(f => f.region === regionBot);
                    const isLockd = locked && !isAdmin;
                    const FFCard = ({ region, seed, ffTeams, ffKey }) => (
                      <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 12, color: '#818cf8', fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>{region} #{seed} Play-In</div>
                        {ffTeams.map(team => {
                          const isPick = firstFourPicks[ffKey] === team.name;
                          return (
                            <div key={team.name} onClick={() => !isLockd && handleFirstFourPick(ffKey, team, region, seed)}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, marginBottom: 4, cursor: isLockd ? 'default' : 'pointer', background: isPick ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.2)', border: isPick ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.06)', transition: 'all .12s' }}>
                              <TeamLogo espnId={team.espnId} name={team.name} size={24} />
                              <span style={{ fontSize: 13, color: '#999', fontWeight: 700, minWidth: 18 }}>{team.seed}</span>
                              <span style={{ fontSize: 14, fontWeight: isPick ? 700 : 400, color: isPick ? '#a5b4fc' : '#bbb', flex: 1 }}>{team.name}</span>
                              {isPick && <span style={{ color: '#818cf8' }}>✓</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                    return (
                      <div style={{ width: CW, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: TOP_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8, paddingBottom: 4 }}>
                          {topGames.map(g => <FFCard key={g.key} {...g} ffKey={g.key} />)}
                        </div>
                        <div style={{ height: BOT_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 8, paddingTop: 4 }}>
                          {botGames.map(g => <FFCard key={g.key} {...g} ffKey={g.key} />)}
                        </div>
                      </div>
                    );
                  };

                  // Dividing line y-positions (from col top) for each round
                  const DIVS = {
                    top: [
                      [34, 123, 212, 301, 390, 479, 568, 657],
                      [78.5, 256.5, 434.5, 612.5],
                      [167.5, 523.5],
                      [345.5],
                    ],
                    bot: [
                      [657, 568, 479, 390, 301, 212, 123, 34],
                      [612.5, 434.5, 256.5, 78.5],
                      [523.5, 167.5],
                      [345.5],
                    ],
                  };

                  const BracketLines = ({ xOffset, flip, dir }) => {
                    const divs = DIVS[dir];
                    const H = TOP_H;
                    const W = CW * 4;
                    const STUB = CW * 0.5;
                    const lines = [];

                    for (let rIdx = 0; rIdx < 3; rIdx++) {
                      const fromDivs = divs[rIdx];
                      const toDivs   = divs[rIdx + 1];
                      const gradId   = `cg-${dir}-${flip?'f':'n'}-${rIdx}`;

                      toDivs.forEach((yMid, tIdx) => {
                        const y1 = fromDivs[tIdx * 2];
                        const y2 = fromDivs[tIdx * 2 + 1];
                        if (y1 == null || y2 == null) return;

                        // xBound: right edge of fromCol (= left edge of toCol)
                        // flip=false (East/South): R64 leftmost, cols go right toward spine
                        // flip=true  (West/Midwest): R64 rightmost, cols go left toward spine
                        const xBound = flip ? W - (rIdx + 1) * CW : (rIdx + 1) * CW;
                        const xV     = flip ? xBound - STUB        : xBound + STUB;
                        const xTo    = flip ? xBound - CW          : xBound + CW;

                        lines.push(
                          <g key={`${rIdx}-${tIdx}`}>
                            <line x1={xBound} y1={y1}   x2={xV}   y2={y1}   stroke={`url(#${gradId})`} strokeWidth="1.5" />
                            <line x1={xBound} y1={y2}   x2={xV}   y2={y2}   stroke={`url(#${gradId})`} strokeWidth="1.5" />
                            <line x1={xV}     y1={y1}   x2={xV}   y2={y2}   stroke={`url(#${gradId})`} strokeWidth="1.5" />
                            <line x1={xV}     y1={yMid} x2={xTo}  y2={yMid} stroke={`url(#${gradId})`} strokeWidth="1.5" />
                          </g>
                        );
                      });
                    }

                    return (
                      <svg width={W} height={H} style={{ position: 'absolute', top: 0, left: flip ? 'auto' : xOffset, right: flip ? xOffset : 'auto', pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>
                        <defs>
                          {[0,1,2].map(rIdx => (
                            <linearGradient key={rIdx} id={`cg-${dir}-${flip?'f':'n'}-${rIdx}`} x1={flip?'100%':'0%'} y1="0%" x2={flip?'0%':'100%'} y2="0%">
                              <stop offset="0%" stopColor={['#60a5fa','#a78bfa','#fbbf24','#ef4444'][rIdx]} stopOpacity="0.6" />
                              <stop offset="100%" stopColor={['#60a5fa','#a78bfa','#fbbf24','#ef4444'][rIdx+1]} stopOpacity="0.6" />
                            </linearGradient>
                          ))}
                        </defs>
                        {lines}
                      </svg>
                    );
                  };

                  const SpineCell = ({ label, sub, color, borderLeft = true, width = CW }) => (
                    <div style={{ width, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: borderLeft ? '1px solid rgba(255,255,255,0.08)' : 'none', background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ height: SPINE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ fontSize: 27, fontWeight: 800, color, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
                        {sub && <div style={{ fontSize: 10, color: '#777', fontStyle: 'italic', marginTop: 2 }}>{sub}</div>}
                      </div>
                    </div>
                  );

                  // S16 gap center: vertically at TOP_H/2, horizontally centered on the S16 column (index 2, so offset = CW*2 + CW/2)
                  const S16_CENTER_X = CW * 2.5; // center of S16 column within a 4-col region
                  const LABEL_TOP = TOP_H / 2;   // vertical midpoint = center of the big S16 gap

                  return (
                    <div style={{ width: TOTAL_W, overflow: 'hidden' }}>

                      {/* TOP HALF — East (left) + West (right), bottom-aligned to spine */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', overflow: 'hidden' }}>
                        {/* EAST watermark — centered in S16 gap */}
                        <div style={{ position: 'absolute', top: LABEL_TOP + SH, left: (hasLeftFF ? CW : 0) + S16_CENTER_X + CW, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.East, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>EAST</span>
                        </div>
                        {/* WEST watermark — mirrored, S16 col from right edge of right region */}
                        <div style={{ position: 'absolute', top: LABEL_TOP + SH, right: (hasRightFF ? CW : 0) + S16_CENTER_X + CW * 2, transform: 'translate(50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.West, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>WEST</span>
                        </div>
                        {hasLeftFF && <FFCol regionTop="East" regionBot="South" />}
                        {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="East" rIdx={rIdx} flip={false} dir="top" />)}
                        <div style={{ width: CW * 3, flexShrink: 0, height: TOP_H }} />
                        {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="West" rIdx={rIdx} flip={true} dir="top" />)}
                        {hasRightFF && <FFCol regionTop="West" regionBot="Midwest" />}
                        {/* Connector lines — rendered last so they paint over game cards */}
                        <BracketLines xOffset={hasLeftFF ? CW : 0} flip={false} dir="top" />
                        <BracketLines xOffset={hasRightFF ? CW : 0} flip={true} dir="top" />
                      </div>

                      {/* ── SPINE + floating FF games ── */}
                      <div style={{ position: 'relative' }}>

                        {/* Spine row */}
                        <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '2px solid rgba(255,255,255,0.15)', borderBottom: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
                          {hasLeftFF  && <SpineCell label="First Four"  sub='"Play-In"'      color="#818cf8" borderLeft={false} />}
                          <SpineCell label="Round of 64"  sub='"First Round"'    color={ROUND_BORDER_COLORS[0]} borderLeft={!hasLeftFF} />
                          <SpineCell label="Round of 32"  sub='"Second Round"'   color={ROUND_BORDER_COLORS[1]} />
                          <SpineCell label="Sweet 16"     sub='"Sweet Sixteen"'  color={ROUND_BORDER_COLORS[2]} />
                          <SpineCell label="Elite Eight"  sub='"Elite Eight"'    color={ROUND_BORDER_COLORS[3]} />

                          {/* Center — Championship + FF games anchored to it */}
                          <div style={{ width: CW * 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 10px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 10px', background: 'linear-gradient(135deg,rgba(245,158,11,0.18),rgba(124,58,237,0.14))', border: '2px solid rgba(245,158,11,0.65)', borderRadius: 10, animation: 'champGlow 3s ease-in-out infinite' }}>

                              {/* Final Four — East vs West — floats above champ box */}
                              <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Final Four — East vs West</div>
                                <GameSlot game={bracket.finalFour[0]} onPick={s => handleFFPick(0, s)} locked={locked && !isAdmin} roundIdx={4} liveScores={liveScores} />
                              </div>

                              {/* Final Four — South vs Midwest — floats below champ box */}
                              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <GameSlot game={bracket.finalFour[1]} onPick={s => handleFFPick(1, s)} locked={locked && !isAdmin} roundIdx={4} liveScores={liveScores} />
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Final Four — South vs Midwest</div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 14 }}>🏆</span>
                                <span style={{ fontSize: 11, fontWeight: 800, color: GOLD2, letterSpacing: 1, fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap' }}>Championship</span>
                                <span style={{ fontSize: 14 }}>🏆</span>
                              </div>
                              <GameSlot game={bracket.championship} onPick={handleChampPick} locked={locked && !isAdmin} isChampionship isHorizontal onScoreChange={handleChampScore} roundIdx={-1} liveScores={liveScores} />
                              {bracket.championship?.winner && (
                                <div style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(245,158,11,0.18)', borderRadius: 5, border: '1px solid rgba(245,158,11,0.5)' }}>
                                  <div style={{ fontSize: 9, color: GOLD2, letterSpacing: 1.5 }}>🎉 CHAMPION</div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>{bracket.championship.winner.name}</div>
                                </div>
                              )}
                            </div>
                          </div>

                          <SpineCell label="Elite Eight"  sub='"Elite Eight"'    color={ROUND_BORDER_COLORS[3]} />
                          <SpineCell label="Sweet 16"     sub='"Sweet Sixteen"'  color={ROUND_BORDER_COLORS[2]} />
                          <SpineCell label="Round of 32"  sub='"Second Round"'   color={ROUND_BORDER_COLORS[1]} />
                          <SpineCell label="Round of 64"  sub='"First Round"'    color={ROUND_BORDER_COLORS[0]} />
                          {hasRightFF && <SpineCell label="First Four"  sub='"Play-In"'      color="#818cf8" />}
                        </div>
                      </div>

                      {/* BOTTOM HALF — South (left) + Midwest (right), top-aligned from spine */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', overflow: 'hidden' }}>
                        {/* SOUTH watermark */}
                        <div style={{ position: 'absolute', top: LABEL_TOP - SH, left: (hasLeftFF ? CW : 0) + S16_CENTER_X + CW, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.South, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>SOUTH</span>
                        </div>
                        <div style={{ position: 'absolute', top: LABEL_TOP - SH, right: (hasRightFF ? CW : 0) + S16_CENTER_X + CW * 2.5, transform: 'translate(50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
                          <span style={{ fontSize: 130, fontWeight: 900, color: RC.Midwest, opacity: 0.18, letterSpacing: 4, textTransform: 'uppercase', userSelect: 'none', lineHeight: 1, display: 'block', whiteSpace: 'nowrap' }}>MIDWEST</span>
                        </div>
                        {/* South connector lines */}
                        {hasLeftFF && <FFCol regionTop="East" regionBot="South" />}
                        {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="South" rIdx={rIdx} flip={false} dir="bot" />)}
                        <div style={{ width: CW * 3, flexShrink: 0, height: BOT_H }} />
                        {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="Midwest" rIdx={rIdx} flip={true} dir="bot" />)}
                        {hasRightFF && <FFCol regionTop="West" regionBot="Midwest" />}
                        {/* Connector lines — rendered last so they paint over game cards */}
                        <BracketLines xOffset={hasLeftFF ? CW : 0} flip={false} dir="bot" />
                        <BracketLines xOffset={hasRightFF ? CW : 0} flip={true} dir="bot" />
                      </div>

                    </div>
                  );
                })()}
              </div>
            </div>
            </>
            )}
          </div>
        )}

        {tab === 'research' && (
          <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
            {/* Tournament switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => { setActiveTournament('basketball'); setResearchMatchup(null); }} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>🏀 Basketball</button>
              <button onClick={() => { setActiveTournament('mammals'); setResearchMatchup(null); }} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>🦁 Mammal Madness</button>
            </div>

            {/* ── MATCHUP VIEW ── */}
            {researchMatchup && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                  <button onClick={() => setResearchMatchup(null)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ← Back to Browse
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#777', letterSpacing: 1, textTransform: 'uppercase' }}>Matchup</span>
                    <span style={{ fontSize: 13, color: '#ccc', fontWeight: 600 }}>{researchMatchup.label}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'start' }}>
                  {/* Team A */}
                  <div style={{ borderRadius: '12px 0 0 12px', border: '1px solid rgba(99,102,241,0.3)', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.05))', padding: '10px 16px', borderBottom: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{researchMatchup.isMammal ? '🦁' : '🏀'}</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: '#a5b4fc', fontFamily: "'Playfair Display', serif" }}>{researchMatchup.teamA}</span>
                    </div>
                    <div style={{ padding: 16 }}>
                      {researchMatchup.isMammal
                        ? (mammalResearchData[researchMatchup.teamA]
                            ? <MammalResearchCard animalName={researchMatchup.teamA} card={mammalResearchData[researchMatchup.teamA]} isAdmin={false} onGenerate={() => {}} generating={false} />
                            : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No animal data yet for {researchMatchup.teamA}</div>)
                        : (researchData[researchMatchup.teamA]
                            ? <ResearchCard teamName={researchMatchup.teamA} card={researchData[researchMatchup.teamA]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />
                            : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No research data yet for {researchMatchup.teamA}</div>)
                      }
                    </div>
                  </div>
                  {/* VS divider */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 12px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#444', letterSpacing: 2 }}>VS</div>
                  </div>
                  {/* Team B */}
                  <div style={{ borderRadius: '0 12px 12px 0', border: '1px solid rgba(251,146,60,0.3)', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.2),rgba(251,146,60,0.05))', padding: '10px 16px', borderBottom: '1px solid rgba(251,146,60,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{researchMatchup.isMammal ? '🦁' : '🏀'}</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: '#fdba74', fontFamily: "'Playfair Display', serif" }}>{researchMatchup.teamB}</span>
                    </div>
                    <div style={{ padding: 16 }}>
                      {researchMatchup.isMammal
                        ? (mammalResearchData[researchMatchup.teamB]
                            ? <MammalResearchCard animalName={researchMatchup.teamB} card={mammalResearchData[researchMatchup.teamB]} isAdmin={false} onGenerate={() => {}} generating={false} />
                            : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No animal data yet for {researchMatchup.teamB}</div>)
                        : (researchData[researchMatchup.teamB]
                            ? <ResearchCard teamName={researchMatchup.teamB} card={researchData[researchMatchup.teamB]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />
                            : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No research data yet for {researchMatchup.teamB}</div>)
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!researchMatchup && activeTournament === 'basketball' && (<>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 6 }}>Team Research Hub</h2>
            {isAdmin && <p style={{ color: '#777', fontSize: 13, marginBottom: 16 }}>As admin, click any field to edit it directly.</p>}
            {allTeamNames.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 16, marginBottom: 8 }}>No research data yet</div>
                <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin > Set Up Teams, save your roster, apply to bracket, then click "Auto-Generate Research"' : 'Check back after the admin sets up the tournament teams'}</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                  {allTeamNames.map(t => (
                    <button key={t} style={{ ...S.btn(selectedTeam === t ? ACCENT : 'rgba(255,255,255,0.05)', selectedTeam === t ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => setSelectedTeam(t)}>{t}</button>
                  ))}
                </div>
                {selectedTeam && <ResearchCard teamName={selectedTeam} card={researchData[selectedTeam]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />}
              </>
            )}
            </>)}

            {!researchMatchup && activeTournament === 'mammals' && (<>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#86efac', marginBottom: 6 }}>🦁 Animal Research Hub</h2>
            {isAdmin && <p style={{ color: '#777', fontSize: 13, marginBottom: 16 }}>As admin, click "Generate Facts" on any animal card to auto-populate it.</p>}
            {allAnimalNames.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777', borderColor: 'rgba(134,239,172,0.15)' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🦁</div>
                <div style={{ fontSize: 16, marginBottom: 8 }}>No animal data yet</div>
                <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin > Mammal Madness, set up your animals, then click "Auto-Generate Animal Facts"' : 'Check back after the admin sets up the Mammal Madness animals'}</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                  {allAnimalNames.map(a => (
                    <button key={a} style={{ ...S.btn(mammalSelectedAnimal === a ? '#16a34a' : 'rgba(255,255,255,0.05)', mammalSelectedAnimal === a ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => setMammalSelectedAnimal(a)}>{a}</button>
                  ))}
                </div>
                {mammalSelectedAnimal && (
                  <MammalResearchCard
                    animalName={mammalSelectedAnimal}
                    card={mammalResearchData[mammalSelectedAnimal]}
                    isAdmin={isAdmin}
                    generating={mammalGeneratingOne === mammalSelectedAnimal}
                    onGenerate={handleGenerateOneMammal}
                  />
                )}
              </>
            )}
            </>)}
          </div>
        )}

        {/* ══════════════════ LEADERBOARD TAB ══════════════════ */}
        {tab === 'leaderboard' && (
          <div style={{ padding: 24, maxWidth: 660, margin: '0 auto' }}>
            {/* Tournament switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => setActiveTournament('basketball')} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>🏀 Basketball</button>
              <button onClick={() => setActiveTournament('mammals')} style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>🦁 Mammal Madness</button>
            </div>

            {/* ── BROWSE MODE ── */}
            {!researchMatchup && activeTournament === 'basketball' && (<>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 20 }}>Leaderboard</h2>
            <div style={S.card}>
              {studentBoard.length > 0 && <div style={{ fontSize: 11, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Students</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
                <span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Name</span><span>Points</span>
              </div>
              {studentBoard.length === 0
                ? <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>No entries yet — be the first to submit!</div>
                : studentBoard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(22,163,74,0.08)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(22,163,74,0.25)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? ACCENT2 : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#444', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                    {e.photoURL ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#777' }}>?</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? ACCENT2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
            </div>
            {teacherBoard.length > 0 && (
              <div style={{ ...S.card, marginTop: 20, borderColor: 'rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>🍎 Teachers</div>
                {teacherBoard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(245,158,11,0.06)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? GOLD2 : '#666', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                    {e.photoURL ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#777' }}>?</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? GOLD2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
              </div>
            )}
            </>)}

            {activeTournament === 'mammals' && (<>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#86efac', marginBottom: 20 }}>🦁 Mammal Madness Leaderboard</h2>
            <div style={{ ...S.card, borderColor: 'rgba(134,239,172,0.2)' }}>
              {mammalStudentBoard.length > 0 && <div style={{ fontSize: 11, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Students</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
                <span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Name</span><span>Points</span>
              </div>
              {mammalStudentBoard.length === 0
                ? <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>No mammal entries yet!</div>
                : mammalStudentBoard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(134,239,172,0.08)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(134,239,172,0.25)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? '#86efac' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#444', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                    {e.photoURL ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#777' }}>?</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? '#86efac' : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#86efac', fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
            </div>
            {mammalTeacherBoard.length > 0 && (
              <div style={{ ...S.card, marginTop: 20, borderColor: 'rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>🍎 Teachers</div>
                {mammalTeacherBoard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(245,158,11,0.06)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? GOLD2 : '#666', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                    {e.photoURL ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#777' }}>?</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? GOLD2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
              </div>
            )}
            </>)}
          </div>
        )}

        {/* ══════════════════ ADMIN TAB ══════════════════ */}
        {tab === 'admin' && isAdmin && (
          <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c', boxShadow: '0 0 6px #e74c3c' }} />
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', margin: 0 }}>Admin Panel</h2>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {[['dashboard','Dashboard'],['teams','Set Up Teams'],['mammals','🦁 Mammal Madness'],['help','Help']].map(([id, label]) => (
                <button key={id} style={{ ...S.navBtn(adminSubTab === id), borderBottom: adminSubTab === id ? '2px solid #e74c3c' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setAdminSubTab(id)}>{label}</button>
              ))}
            </div>

            {adminSubTab === 'dashboard' && (
              <>
                {generating && (
                  <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#6366f1', fontSize: 14, fontWeight: 700 }}>Generating research data...</span>
                      <span style={{ color: '#888', fontSize: 13 }}>{genProgress.done} / {genProgress.total}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', background: '#6366f1', borderRadius: 3, width: `${(genProgress.done / genProgress.total) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>Currently fetching: {genProgress.current}</div>
                  </div>
                )}

                {/* Tournament Year */}
                <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
                  <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
                  <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Updates the year shown on the login screen and app header for all users.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)} style={{ ...S.input, width: 110, padding: '8px 12px', fontSize: 16 }} />
                    <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px' }} onClick={handleSaveYear} disabled={yearSaving}>
                      {yearSaving ? 'Saving...' : 'Update Year'}
                    </button>
                    <span style={{ fontSize: 12, color: '#777' }}>Currently: <strong style={{ color: ACCENT2 }}>{tournamentYear}</strong></span>
                  </div>
                </div>

                <div style={{ ...S.card, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 16 }}>
                  <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    Use the <strong style={{ color: ACCENT2 }}>Bracket tab</strong> to enter official game results — your picks become the answer key and update all student scores live.<br /><br />
                    Use <strong style={{ color: ACCENT2 }}>Set Up Teams</strong> every March after Selection Sunday. No code editing needed.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {[['Total Entries', leaderboard.length],['Avg Score', leaderboard.length ? Math.round(leaderboard.reduce((a,e) => a+(e.score||0),0)/leaderboard.length)+' pts' : '-'],['Status', locked ? '🔒 Locked' : '🟢 Open']].map(([l,v]) => (
                    <div key={l} style={{ ...S.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif" }}>{v}</div>
                      <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminSubTab === 'teams' && (
              <TeamEntryPanel onTeamsSaved={handleTeamsSaved} onRequestGenerateResearch={handleGenerateResearch} />
            )}

            {adminSubTab === 'mammals' && (
              <>
                {mammalGenerating && (
                  <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#86efac', fontSize: 14, fontWeight: 700 }}>Generating animal facts...</span>
                      <span style={{ color: '#888', fontSize: 13 }}>{mammalGenProgress.done} / {mammalGenProgress.total}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', background: '#86efac', borderRadius: 3, width: `${(mammalGenProgress.done / mammalGenProgress.total) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>Currently generating: {mammalGenProgress.current}</div>
                  </div>
                )}
                {/* Mammal lock control */}
                <div style={{ ...S.card, borderColor: 'rgba(134,239,172,0.2)', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ color: '#86efac', marginBottom: 4 }}>Mammal Bracket Lock</h3>
                      <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Status: <span style={{ color: mammalLocked ? '#e74c3c' : '#22c55e', fontWeight: 700 }}>{mammalLocked ? '🔒 Locked' : '🟢 Open'}</span></p>
                    </div>
                    <button style={{ ...S.btn(mammalLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 13, padding: '8px 20px' }}
                      onClick={async () => { const nl = !mammalLocked; setMammalLocked(nl); await setMammalTournamentLocked(nl); }}>
                      {mammalLocked ? 'Unlock Brackets' : 'Lock All Brackets'}
                    </button>
                  </div>
                </div>
                <MammalEntryPanel
                  onAnimalsSaved={(nb, roster) => { setMammalBracket(nb); setMammalOfficialBracket(nb); }}
                  onRequestGenerateMammalResearch={handleGenerateMammalResearch}
                  regionNames={mammalRegionNames}
                  onRegionNamesChange={setMammalRegionNames}
                />
              </>
            )}

            {adminSubTab === 'help' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={S.card}>
                  <h3 style={{ color: ACCENT2, marginBottom: 14 }}>Adding Another Admin</h3>
                  <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                    1. Have the person sign into the app once with their Google account.<br />
                    2. Go to Firebase Console → Authentication → Users and copy their User UID.<br />
                    3. Go to Firestore → <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>admins</code> collection → Add document with that UID as the Document ID.<br />
                    4. They sign out and back in — Admin tab appears automatically.
                  </p>
                </div>
                <div style={{ ...S.card, borderColor: 'rgba(245,158,11,0.25)' }}>
                  <h3 style={{ color: GOLD2, marginBottom: 14 }}>Adding a Teacher</h3>
                  <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                    Teachers appear in a separate section on the leaderboard with a 🍎 Teacher label.<br /><br />
                    1. Have the teacher sign into the app once with their Google account.<br />
                    2. Go to Firebase Console → Authentication → Users and copy their User UID.<br />
                    3. Go to Firestore → <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>teachers</code> collection → Add document with that UID as the Document ID.<br />
                    4. They sign out and back in — their name shows with the Teacher badge.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
