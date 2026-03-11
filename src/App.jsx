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
  checkIsAdmin, checkIsTeacher, saveResearchData,
  saveOneTeamResearch, subscribeToResearchData,
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
const RC = { East: '#60a5fa', West: '#f87171', South: '#4ade80', Midwest: '#fb923c' };

// Round colors — each round has a distinct tint
const ROUND_COLORS = [
  'rgba(96,165,250,0.13)',   // R64 — blue tint
  'rgba(167,139,250,0.13)',  // R32 — purple tint
  'rgba(251,191,36,0.10)',   // S16 — amber tint
  'rgba(239,68,68,0.13)',    // E8  — red tint
];
const ROUND_BORDER_COLORS = [
  'rgba(96,165,250,0.35)',
  'rgba(167,139,250,0.35)',
  'rgba(251,191,36,0.30)',
  'rgba(239,68,68,0.35)',
];

const ROUND_LABELS = [
  { main: 'Round of 64',  sub: '"First Round"'    },
  { main: 'Round of 32',  sub: '"Second Round"'   },
  { main: 'Sweet 16',     sub: '"Sweet Sixteen"'  },
  { main: 'Elite Eight',  sub: '"Elite Eight"'    },
];

const S = {
  app:    { minHeight: '100vh', background: '#060d08', color: '#dde8e2', fontFamily: "'Source Sans 3', sans-serif" },
  header: { background: 'rgba(6,13,8,.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(22,163,74,.3)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: ACCENT2, letterSpacing: 1 },
  card:   { background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)', borderRadius: 12, padding: 20 },
  btn:    (bg = ACCENT, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? ACCENT : 'transparent', color: a ? '#fff' : '#777', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
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

function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0 }) {
  if (!game) return null;
  const { top, bottom, winner } = game;
  const slotBg     = isChampionship ? 'rgba(245,158,11,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(245,158,11,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];

  const Team = ({ team, side }) => {
    if (!team) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', height: 34, color: '#444', fontSize: 11, fontStyle: 'italic', flexDirection: flipped ? 'row-reverse' : 'row' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#111', flexShrink: 0 }} />TBD
      </div>
    );
    const isW = winner?.name === team.name;
    const isL = winner && !isW;
    const isFF = team.isFFPlaceholder;
    return (
      <div onClick={() => !locked && !isFF && onPick?.(side)}
        title={isW && !locked ? 'Click to undo this pick' : ''}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', height: 34,
          flexDirection: flipped ? 'row-reverse' : 'row',
          background: isW ? 'linear-gradient(90deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)',
          cursor: locked || isFF ? 'default' : 'pointer',
          borderRadius: 4, opacity: isL ? 0.3 : 1, transition: 'background .12s',
        }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: 11, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 108, flex: 1 }}>
          {isFF ? 'FF Winner →' : team.name}
        </span>
        {isW && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: ACCENT2, fontSize: 11 }}>✓</span>}
      </div>
    );
  };

  return (
    <div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
      <Team team={top} side="top" />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />
      <Team team={bottom} side="bottom" />
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#555', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
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
              <div style={{ fontSize: 9, color: '#555', fontStyle: 'italic', marginTop: 1 }}>{label?.sub}</div>
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
      <span style={{ fontSize: 10, color: '#444', marginTop: large ? 6 : 2, flexShrink: 0 }}>edit</span>
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
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#444' }}>
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
              {isAdmin ? <EditableField value={p.pos} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} /> : <span style={{ color: '#666', fontSize: 12 }}>{p.pos}</span>}
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
        <div style={{ fontSize: 13, color: '#555', marginBottom: 16, marginTop: 6 }}>Consensus sportsbook odds to win it all</div>
        <div style={{ padding: 12, background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
          Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.
        </div>
        {isAdmin && <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: '#555' }}>Click any field above to edit it.</div>}
      </div>
    </div>
  );
}

// ── ADMIN TEAM ENTRY PANEL ────────────────────────────────────────────────────
function makeEmptyRoster() {
  return {
    year: new Date().getFullYear(),
    East:    Array(16).fill(null).map((_, i) => ({ seed: i+1, name: '', espnId: '', firstFour: false })),
    West:    Array(16).fill(null).map((_, i) => ({ seed: i+1, name: '', espnId: '', firstFour: false })),
    South:   Array(16).fill(null).map((_, i) => ({ seed: i+1, name: '', espnId: '', firstFour: false })),
    Midwest: Array(16).fill(null).map((_, i) => ({ seed: i+1, name: '', espnId: '', firstFour: false })),
  };
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
        if (snap.exists()) { const d = snap.data(); delete d.updatedAt; setRoster(d); }
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

  if (loading) return <div style={{ color: '#666', padding: 20 }}>Loading roster...</div>;

  const regionTeams = roster[activeRegion] || [];

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: ACCENT2, marginBottom: 4 }}>Set Up This Year's Teams</h3>
          <p style={{ color: '#666', fontSize: 13 }}>Enter all 64–68 teams after Selection Sunday. Use "Add FF Slot" for First Four play-in teams — give them the same seed number and check FF on both.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
          {applied && (
            <button style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={() => onRequestGenerateResearch(roster)}>
              Auto-Generate Research
            </button>
          )}
        </div>
      </div>

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
            <span style={{ marginLeft: 6, fontSize: 11, color: '#555' }}>({roster[r]?.length || 0})</span>
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
              <button onClick={() => removeTeamSlot(activeRegion, idx)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }} title="Remove slot">×</button>
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
  const prompt = `You are an NCAA March Madness analyst writing a scouting report for the ${new Date().getFullYear()} tournament.
Generate a JSON scouting report for: ${teamName} (${region} Region, Seed #${seed})
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"record":"W-L","rank":"#N AP or Unranked","coach":"Coach Name","conference":"Conference Name","kenpom":"#N","offense":"NNN.N","defense":"NN.N","pace":"NN.N","keyPlayers":[{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"brief scouting note"},{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"brief scouting note"}],"injuries":"injury status or None reported","odds":"+XXXX or N/A","strengths":"2-3 sentence strength summary","weaknesses":"2-3 sentence weakness summary","analystNote":"1-2 sentence sharp analyst take"}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return null; }
}

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
  const [researchQ,        setResearchQ]       = useState('');
  const [researchResult,   setResearchResult]  = useState('');
  const [researchLoading,  setResearchLoading] = useState(false);
  const [adminSubTab,      setAdminSubTab]     = useState('dashboard');
  const [generating,       setGenerating]      = useState(false);
  const [genProgress,      setGenProgress]     = useState({ done: 0, total: 0, current: '' });
  const [firstFourPicks,   setFirstFourPicks]  = useState({});
  const [tournamentYear,   setTournamentYear]  = useState(CURRENT_YEAR);
  const [yearDraft,        setYearDraft]       = useState(String(CURRENT_YEAR));
  const [yearSaving,       setYearSaving]      = useState(false);

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
        const teacher = await checkIsTeacher(fbUser.uid);
        setIsTeacher(teacher);
      } catch {}
      const saved = await loadBracket(fbUser.uid);
      if (saved) {
        if (saved._firstFourPicks) {
          setFirstFourPicks(saved._firstFourPicks);
          const { _firstFourPicks, ...bracketOnly } = saved;
          setBracket(bracketOnly);
        } else { setBracket(saved); }
      }
    } else { setUser(null); setIsAdmin(false); setIsTeacher(false); setBracket(buildInitialBracket()); }
    setAuthLoading(false);
  }), []);

  // ── LIVE SUBSCRIPTIONS ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToOfficialBracket(b => { setOfficialBracket(b); if (isAdmin) setBracket(b); });
    const u2 = subscribeToConfig(cfg => {
      setLocked(cfg.locked ?? false);
      if (cfg.year) { setTournamentYear(cfg.year); setYearDraft(String(cfg.year)); }
    });
    const u3 = subscribeToLeaderboard(setLeaderboard);
    const u4 = subscribeToResearchData(data => {
      setResearchData(data);
      if (!selectedTeam && Object.keys(data).length > 0) setSelectedTeam(Object.keys(data)[0]);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [user, isAdmin]);

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
      if (isAdmin) await saveOfficialBracket(bracket);
      const score = calcScore(bracket, officialBracket);
      await updateLeaderboardEntry(user.uid, user.displayName, user.photoURL, score, isTeacher);
      setSaving(false); setLastSaved(new Date());
    }, 3000); // 3s debounce
    return () => clearTimeout(saveTimer.current);
  }, [bracket, firstFourPicks, user, locked, isAdmin, officialBracket, isTeacher]);

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
      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked || clicked.isFFPlaceholder) return prev;
      if (game.winner?.name === clicked.name) {
        game.winner = null;
        clearTeamDownstream(next, region, clicked.name, rIdx + 1);
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
      return next;
    });
  }, [locked, isAdmin]);

  const handleFFPick = useCallback((idx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ff   = next.finalFour[idx];
      const clicked = ff[side];
      if (!clicked) return prev;
      if (ff.winner?.name === clicked.name) {
        ff.winner = null;
        const cSide = idx === 0 ? 'top' : 'bottom';
        next.championship[cSide] = null; next.championship.winner = null;
        return next;
      }
      ff.winner = clicked;
      const cSide = idx === 0 ? 'top' : 'bottom';
      next.championship[cSide] = clicked;
      if (next.championship.winner?.name !== clicked.name) next.championship.winner = null;
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
      try {
        const card = await generateResearchForTeam(name, seed, region);
        if (card) allData[name] = { ...card, seed, region };
      } catch (e) { console.warn('Failed:', name, e); }
      if (i < teams.length - 1) await new Promise(r => setTimeout(r, 400));
    }
    await saveResearchData(allData);
    setResearchData(allData);
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

  // ── AI ASSISTANT ──────────────────────────────────────────────────────────
  const handleResearch = async () => {
    if (!researchQ.trim()) return;
    setResearchLoading(true); setResearchResult('');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          messages: [{ role: 'user', content: `You are an NCAA March Madness analyst. Answer concisely (2-4 paragraphs): "${researchQ}"\nFocus on stats, matchups, tournament history, injury concerns, and bracket strategy.` }] }),
      });
      const data = await res.json();
      setResearchResult(data.content?.[0]?.text || 'No response.');
    } catch { setResearchResult('Error - please try again.'); }
    setResearchLoading(false);
  };

  const score        = calcScore(bracket, officialBracket);
  const myRank       = leaderboard.findIndex(e => e.uid === user?.uid) + 1;
  const allTeamNames = Object.keys(researchData).sort();

  // Split leaderboard into teachers and students
  const teacherBoard  = leaderboard.filter(e => e.isTeacher);
  const studentBoard  = leaderboard.filter(e => !e.isTeacher);

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
        <p style={{ color: '#555', fontSize: 16, marginTop: 10 }}>School-Wide Bracket Challenge</p>
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
        @keyframes champGlow { 0%,100%{box-shadow:0 0 24px rgba(245,158,11,0.3)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.6)} }
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
          {saving && <span style={{ fontSize: 11, color: '#555' }}>Saving...</span>}
          {!saving && lastSaved && <span style={{ fontSize: 11, color: '#166534' }}>Saved</span>}
          <button onClick={logOut} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 12 }}>Sign out</button>
        </div>
      </header>

      <main style={{ paddingBottom: 60 }}>

        {/* ══════════════════ BRACKET TAB ══════════════════ */}
        {tab === 'bracket' && (
          <div style={{ padding: 20 }}>
            {/* Score bar */}
            <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>Your Score</div>
                <div style={{ fontSize: 38, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                  {score} <span style={{ fontSize: 14, color: '#444' }}>/ 1,920 pts</span>
                </div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>ESPN scoring (max 1,920)</div>
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
                <div style={{ fontSize: 11, color: '#555' }}>School Rank</div>
                <div style={{ fontSize: 34, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                  {myRank > 0 ? `#${myRank}` : '-'}
                </div>
                <div style={{ fontSize: 11, color: '#444' }}>of {leaderboard.length || '-'} entries</div>
              </div>
            </div>

            {/* First Four */}
            {ffGamesList.length > 0 && (
              <div style={{ marginBottom: 20, padding: '16px 18px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', letterSpacing: 2, marginBottom: 2 }}>FIRST FOUR — PLAY-IN GAMES</div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 14 }}>Pick who wins each play-in game and advances into the main bracket</div>
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
                              <span style={{ fontSize: 10, color: '#555', fontWeight: 700, minWidth: 14 }}>{team.seed}</span>
                              <span style={{ fontSize: 12, fontWeight: isPick ? 700 : 400, color: isPick ? '#a5b4fc' : '#bbb', flex: 1 }}>{team.name}</span>
                              {isPick && <span style={{ color: '#818cf8', fontSize: 13 }}>✓</span>}
                            </div>
                          );
                        })}
                        {pick
                          ? <div style={{ fontSize: 10, color: '#555', textAlign: 'center', marginTop: 4 }}>{pick} advances as #{seed} seed</div>
                          : <div style={{ fontSize: 10, color: '#444', textAlign: 'center', marginTop: 4 }}>pick a winner</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MAIN BRACKET ── */}
            <div className="bscroll" style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 16 }}>
              <div style={{ minWidth: 1960, paddingBottom: 8 }}>

                {/* Championship — raised above, centered */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0, position: 'relative', zIndex: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 28px', background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', border: '2px solid rgba(245,158,11,0.45)', borderRadius: 16, animation: 'champGlow 3s ease-in-out infinite', minWidth: 260 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>🏆</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: GOLD2, letterSpacing: 2, textTransform: 'uppercase', fontFamily: "'Playfair Display', serif" }}>National Championship</span>
                      <span style={{ fontSize: 20 }}>🏆</span>
                    </div>
                    <GameSlot game={bracket.championship} onPick={handleChampPick} locked={locked && !isAdmin} isChampionship onScoreChange={handleChampScore} roundIdx={-1} />
                    {bracket.championship?.winner && (
                      <div style={{ textAlign: 'center', padding: '10px 20px', background: 'linear-gradient(135deg,rgba(245,158,11,.2),rgba(245,158,11,.05))', borderRadius: 10, border: '1px solid rgba(245,158,11,.5)', marginTop: 2 }}>
                        <div style={{ fontSize: 11, color: GOLD2, letterSpacing: 2 }}>🎉 CHAMPION 🎉</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: "'Playfair Display', serif" }}>{bracket.championship.winner.name}</div>
                        {bracket.championship.scoreTop && (
                          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                            {bracket.championship.top?.name} {bracket.championship.scoreTop} — {bracket.championship.scoreBottom} {bracket.championship.bottom?.name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector line from championship down to Final Four */}
                <div style={{ display: 'flex', justifyContent: 'center', height: 28 }}>
                  <div style={{ width: 2, background: 'linear-gradient(to bottom, rgba(245,158,11,0.5), rgba(74,222,128,0.3))', borderRadius: 1 }} />
                </div>

                {/* Final Four + Regions row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>

                  {/* LEFT: East (top) + South (bottom) */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div>
                      <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, color: RC.East, letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>EAST</div>
                      <RegionBracket region="East" rounds={bracket.East.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={false} vflipped={false} />
                    </div>
                    <div style={{ flex: 1, minHeight: 80 }} />
                    <div>
                      <RegionBracket region="South" rounds={bracket.South.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={false} vflipped={true} />
                      <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, color: RC.South, letterSpacing: 3, marginTop: 12, textTransform: 'uppercase' }}>SOUTH</div>
                    </div>
                  </div>

                  {/* CENTER: Final Four hugging Elite Eight */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 220, justifyContent: 'space-between', paddingTop: 60, paddingBottom: 60, gap: 0 }}>

                    {/* Final Four Top (East vs West) — hugs Elite Eight */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT2, letterSpacing: 2, textTransform: 'uppercase' }}>Final Four</div>
                      <div style={{ fontSize: 10, fontStyle: 'italic', color: '#555', marginBottom: 4 }}>"The Final Four"</div>
                      <GameSlot game={bracket.finalFour[0]} onPick={s => handleFFPick(0, s)} locked={locked && !isAdmin} roundIdx={-1} />
                      <div style={{ fontSize: 11, color: '#444' }}>East vs West</div>
                    </div>

                    {/* Spacer that stretches to push FF games apart */}
                    <div style={{ flex: 1 }} />

                    {/* Final Four Bottom (South vs Midwest) — hugs Elite Eight */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT2, letterSpacing: 2, textTransform: 'uppercase' }}>Final Four</div>
                      <div style={{ fontSize: 10, fontStyle: 'italic', color: '#555', marginBottom: 4 }}>"The Final Four"</div>
                      <GameSlot game={bracket.finalFour[1]} onPick={s => handleFFPick(1, s)} locked={locked && !isAdmin} roundIdx={-1} />
                      <div style={{ fontSize: 11, color: '#444' }}>South vs Midwest</div>
                    </div>
                  </div>

                  {/* RIGHT: West (top) + Midwest (bottom) */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div>
                      <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, color: RC.West, letterSpacing: 3, marginBottom: 12, textTransform: 'uppercase' }}>WEST</div>
                      <RegionBracket region="West" rounds={bracket.West.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={true} vflipped={false} />
                    </div>
                    <div style={{ flex: 1, minHeight: 80 }} />
                    <div>
                      <RegionBracket region="Midwest" rounds={bracket.Midwest.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={true} vflipped={true} />
                      <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 800, color: RC.Midwest, letterSpacing: 3, marginTop: 12, textTransform: 'uppercase' }}>MIDWEST</div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ RESEARCH TAB ══════════════════ */}
        {tab === 'research' && (
          <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 6 }}>Team Research Hub</h2>
            {isAdmin && <p style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>As admin, click any field to edit it directly.</p>}
            {allTeamNames.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#555' }}>
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
            <div style={{ ...S.card, border: '1px solid rgba(22,163,74,0.25)', marginTop: 8 }}>
              <h3 style={{ color: ACCENT2, marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>AI Research Assistant</h3>
              <p style={{ color: '#555', fontSize: 13, marginBottom: 14 }}>Ask anything about matchups, history, upsets, or bracket strategy</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <input style={{ ...S.input, flex: 1 }} value={researchQ} onChange={e => setResearchQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleResearch()} placeholder="e.g. 'How does Duke match up with Auburn?' or 'Best Cinderella picks this year?'" />
                <button style={{ ...S.btn(), flexShrink: 0 }} onClick={handleResearch} disabled={researchLoading}>{researchLoading ? '...' : 'Ask'}</button>
              </div>
              {researchResult && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 16, fontSize: 14, color: '#ccc', lineHeight: 1.75, borderLeft: `3px solid ${ACCENT}` }}>{researchResult}</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {['Best Cinderella teams','Most likely R1 upsets','Who wins the South region?','Best 3-point shooting teams'].map(q => (
                  <button key={q} onClick={() => setResearchQ(q)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#777', cursor: 'pointer', fontFamily: 'inherit' }}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ LEADERBOARD TAB ══════════════════ */}
        {tab === 'leaderboard' && (
          <div style={{ padding: 24, maxWidth: 660, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 20 }}>Leaderboard</h2>

            {/* Students */}
            <div style={S.card}>
              {studentBoard.length > 0 && (
                <div style={{ fontSize: 11, color: '#444', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Students</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
                <span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Name</span><span>Points</span>
              </div>
              {studentBoard.length === 0
                ? <div style={{ color: '#444', textAlign: 'center', padding: 24 }}>No entries yet — be the first to submit!</div>
                : studentBoard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(22,163,74,0.08)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(22,163,74,0.25)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? ACCENT2 : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#444', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                    {e.photoURL ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#555' }}>?</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? ACCENT2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
            </div>

            {/* Teachers (separate section) */}
            {teacherBoard.length > 0 && (
              <div style={{ ...S.card, marginTop: 20, borderColor: 'rgba(245,158,11,0.25)' }}>
                <div style={{ fontSize: 11, color: GOLD, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>🍎 Teachers</div>
                {teacherBoard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(245,158,11,0.06)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? GOLD2 : '#666', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                    {e.photoURL ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#555' }}>?</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? GOLD2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
              </div>
            )}
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
              {[['dashboard','Dashboard'],['teams','Set Up Teams'],['help','Help']].map(([id, label]) => (
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
                    <div style={{ fontSize: 12, color: '#666' }}>Currently fetching: {genProgress.current}</div>
                  </div>
                )}

                {/* Tournament Year */}
                <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
                  <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
                  <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>Updates the year shown on the login screen and app header for all users.</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)} style={{ ...S.input, width: 110, padding: '8px 12px', fontSize: 16 }} />
                    <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px' }} onClick={handleSaveYear} disabled={yearSaving}>
                      {yearSaving ? 'Saving...' : 'Update Year'}
                    </button>
                    <span style={{ fontSize: 12, color: '#555' }}>Currently: <strong style={{ color: ACCENT2 }}>{tournamentYear}</strong></span>
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
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminSubTab === 'teams' && (
              <TeamEntryPanel onTeamsSaved={handleTeamsSaved} onRequestGenerateResearch={handleGenerateResearch} />
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
