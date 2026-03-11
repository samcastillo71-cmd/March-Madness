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
  checkIsAdmin, saveResearchData, loadResearchData,
  saveOneTeamResearch, subscribeToResearchData,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, buildInitialBracketFromTeams,
  calcScore, emptyResearchCard,
} from './bracketData';

const RC = { East: '#3b82f6', West: '#ef4444', South: '#22c55e', Midwest: '#f59e0b' };

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  app:    { minHeight: '100vh', background: '#080c18', color: '#e0e0e0', fontFamily: "'Source Sans 3', sans-serif" },
  header: { background: 'rgba(8,12,24,.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(212,175,55,.25)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: '#d4af37', letterSpacing: 1 },
  card:   { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 },
  btn:    (bg = '#d4af37', fg = '#080c18') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? '#d4af37' : 'transparent', color: a ? '#080c18' : '#888', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
  tag:    (color) => ({ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }),
};

// ── TEAM LOGO ─────────────────────────────────────────────────────────────────
function TeamLogo({ espnId, name, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!espnId || err) return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#1a3a5c,#2d6a4f)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
      {name?.charAt(0) || '?'}
    </span>
  );
  return <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#fff' }} onError={() => setErr(true)} />;
}

// ── GAME SLOT ─────────────────────────────────────────────────────────────────
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a3a', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped }) {
  if (!game) return null;
  const { top, bottom, winner } = game;
  const Team = ({ team, side }) => {
    if (!team) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', height: 34, color: '#444', fontSize: 11, fontStyle: 'italic', flexDirection: flipped ? 'row-reverse' : 'row' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a1e2e', flexShrink: 0 }} />TBD
      </div>
    );
    const isW = winner?.name === team.name;
    const isL = winner && !isW;
    return (
      <div onClick={() => !locked && !team.firstFour && onPick?.(side)}
        title={isW && !locked ? 'Click to undo this pick' : ''}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', height: 34, flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? 'linear-gradient(90deg,rgba(212,175,55,.22),rgba(212,175,55,.05))' : 'transparent', cursor: locked || team.firstFour ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.28 : 1, transition: 'background .12s' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: 11, fontWeight: isW ? 700 : 500, color: isW ? '#d4af37' : isL ? '#444' : '#ccc', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 108 }}>
          {team.firstFour ? 'First Four →' : team.name}
        </span>
        {isW && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: '#d4af37', fontSize: 11 }}>✓</span>}
        {isL && !locked && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, fontSize: 9, color: '#333' }}>✕</span>}
      </div>
    );
  };
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.02)', minWidth: 178 }}>
      <Team team={top} side="top" />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <Team team={bottom} side="bottom" />
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#555', fontSize: 11, alignSelf: 'center' }}>–</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
    </div>
  );
}

// ── REGION BRACKET ────────────────────────────────────────────────────────────
const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];
const ROW_GAPS     = [4, 42, 116, 248];

function RegionBracket({ region, rounds, onPick, locked, flipped = false }) {
  const displayRounds = flipped ? [...rounds].reverse() : rounds;
  return (
    <div style={{ display: 'flex', flexDirection: flipped ? 'row-reverse' : 'row', gap: 14, alignItems: 'flex-start' }}>
      {displayRounds.map((games, dIdx) => {
        const logicIdx = flipped ? (rounds.length - 1 - dIdx) : dIdx;
        return (
          <div key={dIdx} style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAPS[logicIdx] }}>
            <div style={{ fontSize: 9, color: '#d4af37', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginBottom: 4, whiteSpace: 'nowrap' }}>
              {ROUND_LABELS[logicIdx]}
            </div>
            {games.map((game, gIdx) => (
              <GameSlot key={gIdx} game={game} locked={locked} flipped={flipped}
                onPick={side => onPick(region, logicIdx, gIdx, side)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── EDITABLE FIELD ────────────────────────────────────────────────────────────
function EditableField({ label, value, onSave, color = '#ccc', large = false, multiline = false }) {
  const [editing, setEditing]   = useState(false);
  const [draft,   setDraft]     = useState(value);
  const [saving,  setSavingF]   = useState(false);

  const commit = async () => {
    setSavingF(true);
    await onSave(draft);
    setSavingF(false);
    setEditing(false);
  };

  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer', group: true }}
      onClick={() => { setDraft(value); setEditing(true); }}>
      <span style={{ color, fontSize: large ? 38 : 13, fontWeight: large ? 700 : 400, lineHeight: 1.5, flex: 1 }}>{value || '—'}</span>
      <span style={{ fontSize: 10, color: '#444', marginTop: large ? 6 : 2, flexShrink: 0 }}>✏️</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {multiline
        ? <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={3}
            style={{ ...S.input, resize: 'vertical', fontSize: 13, padding: '8px 12px' }} />
        : <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
            style={{ ...S.input, fontSize: large ? 18 : 13, padding: '6px 12px' }}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
      }
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ ...S.btn('#22c55e', '#fff'), padding: '5px 14px', fontSize: 12 }} onClick={commit} disabled={saving}>
          {saving ? '…' : 'Save'}
        </button>
        <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), padding: '5px 14px', fontSize: 12 }} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ── RESEARCH CARD (full editable) ─────────────────────────────────────────────
function ResearchCard({ teamName, card, isAdmin, onFieldSave }) {
  if (!card) return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#444' }}>
      No data yet — {isAdmin ? 'use "Generate All" above to populate' : 'check back soon'}
    </div>
  );

  const field = (path, value, opts = {}) => isAdmin
    ? <EditableField value={value} onSave={v => onFieldSave(teamName, path, v)} {...opts} />
    : <span style={{ color: opts.color || '#ccc', fontSize: opts.large ? 38 : 13 }}>{value || '—'}</span>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
      {/* Stats */}
      <div style={S.card}>
        <h3 style={{ color: '#d4af37', marginBottom: 14, fontFamily: "'Playfair Display', serif" }}>{teamName}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['Record',     'record'],
            ['Rank',       'rank'],
            ['Coach',      'coach'],
            ['Conference', 'conference'],
            ['KenPom',     'kenpom'],
            ['Offense',    'offense'],
            ['Defense',    'defense'],
            ['Pace',       'pace'],
          ].map(([label, key]) => (
            <div key={key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={S.tag('#555')}>{label}</div>
              {field(key, card[key])}
            </div>
          ))}
        </div>
      </div>

      {/* Key Players */}
      <div style={S.card}>
        <h3 style={{ color: '#d4af37', marginBottom: 12 }}>Key Players</h3>
        {(card.keyPlayers || []).map((p, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              {isAdmin
                ? <EditableField value={p.name} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.name`, v)} />
                : <span style={{ fontWeight: 700 }}>{p.name}</span>}
              {isAdmin
                ? <EditableField value={p.pos} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} />
                : <span style={{ color: '#666', fontSize: 12 }}>{p.pos}</span>}
            </div>
            {isAdmin
              ? <EditableField value={p.stats} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.stats`, v)} />
              : <div style={{ fontSize: 13, color: '#999', margin: '3px 0' }}>{p.stats}</div>}
            {isAdmin
              ? <EditableField value={p.note} onSave={v => onFieldSave(teamName, `keyPlayers.${i}.note`, v)} color="#d4af37" />
              : <div style={{ fontSize: 12, color: '#d4af37', fontStyle: 'italic' }}>⭐ {p.note}</div>}
          </div>
        ))}
        <div style={{ padding: '10px 12px', background: 'rgba(231,76,60,0.07)', borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)', marginTop: 8 }}>
          <div style={S.tag('#e74c3c')}>🏥 Injury Report</div>
          {field('injuries', card.injuries, { multiline: true })}
        </div>
      </div>

      {/* Scouting */}
      <div style={S.card}>
        <h3 style={{ color: '#d4af37', marginBottom: 12 }}>Scouting Report</h3>
        {[['✅ Strengths', '#22c55e', 'strengths'], ['⚠️ Weaknesses', '#e74c3c', 'weaknesses'], ['💡 Analyst Note', '#d4af37', 'analystNote']].map(([label, color, key]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <div style={S.tag(color)}>{label}</div>
            {field(key, card[key], { color: '#bbb', multiline: true })}
          </div>
        ))}
      </div>

      {/* Odds */}
      <div style={S.card}>
        <h3 style={{ color: '#d4af37', marginBottom: 10 }}>Championship Odds</h3>
        {field('odds', card.odds, { color: '#22c55e', large: true })}
        <div style={{ fontSize: 13, color: '#555', marginBottom: 16, marginTop: 6 }}>Consensus sportsbook odds to win it all</div>
        <div style={{ padding: 12, background: 'rgba(212,175,55,0.07)', borderRadius: 8, border: '1px solid rgba(212,175,55,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
          💰 Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.
        </div>
        {isAdmin && (
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: '#555' }}>
            ✏️ Click any field above to edit it. Changes save instantly to Firestore.
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN TEAM ENTRY PANEL ────────────────────────────────────────────────────
function makeEmptyRoster() {
  return {
    year: new Date().getFullYear(),
    East:    Array(16).fill(null).map((_, i) => ({ seed: i + 1, name: '', espnId: '', firstFour: false })),
    West:    Array(16).fill(null).map((_, i) => ({ seed: i + 1, name: '', espnId: '', firstFour: false })),
    South:   Array(16).fill(null).map((_, i) => ({ seed: i + 1, name: '', espnId: '', firstFour: false })),
    Midwest: Array(16).fill(null).map((_, i) => ({ seed: i + 1, name: '', espnId: '', firstFour: false })),
  };
}

function TeamEntryPanel({ onTeamsSaved, onRequestGenerateResearch }) {
  const [roster,       setRoster]       = useState(makeEmptyRoster());
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'teamRoster'));
        if (snap.exists()) {
          const data = snap.data();
          delete data.updatedAt;
          setRoster(data);
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  const updateTeam = (region, idx, field, value) => {
    setRoster(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[region][idx][field] = value;
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await setDoc(doc(db, 'admin', 'teamRoster'), { ...roster, updatedAt: serverTimestamp() });
    const { buildInitialBracketFromTeams } = await import('./bracketData');
    const newBracket = buildInitialBracketFromTeams(roster);
    await saveOfficialBracket(newBracket);
    setSaving(false);
    setSaved(true);
    onTeamsSaved(newBracket, roster);
  };

  if (loading) return <div style={{ color: '#666', padding: 20 }}>Loading roster…</div>;

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: '#d4af37', marginBottom: 4 }}>📅 Set Up This Year's Teams</h3>
          <p style={{ color: '#666', fontSize: 13 }}>Enter all 64 teams after Selection Sunday. Check "FF" for First Four play-in slots.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Year:</span>
            <input type="number" value={roster.year}
              onChange={e => { setRoster(p => ({ ...p, year: parseInt(e.target.value) })); setSaved(false); }}
              style={{ ...S.input, width: 82, padding: '6px 10px', fontSize: 13 }} />
          </div>
          <button style={{ ...S.btn(saved ? '#22c55e' : '#d4af37', '#080c18'), padding: '8px 20px', fontSize: 13 }}
            onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save & Apply to Bracket'}
          </button>
          {saved && (
            <button style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 20px', fontSize: 13 }}
              onClick={() => onRequestGenerateResearch(roster)}>
              🤖 Auto-Generate Research Data
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East', 'West', 'South', 'Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }}
            onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>◈</span>{r}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {roster[activeRegion].map((team, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#d4af37', flexShrink: 0 }}>
              {team.seed}
            </span>
            <input placeholder={`Seed ${team.seed} team name`} value={team.name}
              onChange={e => updateTeam(activeRegion, idx, 'name', e.target.value)}
              style={{ ...S.input, flex: 2, padding: '6px 10px', fontSize: 13 }} />
            <input placeholder="ESPN ID" value={team.espnId}
              onChange={e => updateTeam(activeRegion, idx, 'espnId', e.target.value)}
              style={{ ...S.input, width: 80, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={team.firstFour}
                onChange={e => updateTeam(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>FF</span>
            </label>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(96,165,250,0.07)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', fontSize: 13, color: '#93c5fd' }}>
        💡 <strong>ESPN ID tip:</strong> Go to espn.com/mens-college-basketball/team/_/id/<strong>150</strong>/duke — the number after /id/ is the ESPN ID. Leave blank if unknown.
      </div>
    </div>
  );
}

// ── AI RESEARCH GENERATOR ─────────────────────────────────────────────────────
async function generateResearchForTeam(teamName, seed, region) {
  const prompt = `You are an NCAA March Madness analyst writing a scouting report for the ${new Date().getFullYear()} tournament.

Generate a JSON scouting report for: ${teamName} (${region} Region, Seed #${seed})

Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{
  "record": "W-L",
  "rank": "#N AP or Unranked",
  "coach": "Coach Name",
  "conference": "Conference Name",
  "kenpom": "#N",
  "offense": "NNN.N",
  "defense": "NN.N",
  "pace": "NN.N",
  "keyPlayers": [
    { "name": "Player Name", "pos": "G/F/C", "stats": "XX.X PPG / X.X RPG", "note": "brief scouting note" },
    { "name": "Player Name", "pos": "G/F/C", "stats": "XX.X PPG / X.X RPG", "note": "brief scouting note" }
  ],
  "injuries": "injury status or None reported",
  "odds": "+XXXX or N/A",
  "strengths": "2-3 sentence strength summary",
  "weaknesses": "2-3 sentence weakness summary",
  "analystNote": "1-2 sentence sharp analyst take"
}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,             setUser]            = useState(null);
  const [isAdmin,          setIsAdmin]         = useState(false);
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
  const saveTimer = useRef(null);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, async fbUser => {
    if (fbUser) {
      setUser(fbUser);
      const admin = await checkIsAdmin(fbUser.uid);
      setIsAdmin(admin);
      const saved = await loadBracket(fbUser.uid);
      if (saved) setBracket(saved);
    } else {
      setUser(null); setIsAdmin(false); setBracket(buildInitialBracket());
    }
    setAuthLoading(false);
  }), []);

  // ── LIVE SUBSCRIPTIONS ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToOfficialBracket(b => { setOfficialBracket(b); if (isAdmin) setBracket(b); });
    const u2 = subscribeToConfig(cfg => setLocked(cfg.locked ?? false));
    const u3 = subscribeToLeaderboard(setLeaderboard);
    const u4 = subscribeToResearchData(data => {
      setResearchData(data);
      if (!selectedTeam && Object.keys(data).length > 0)
        setSelectedTeam(Object.keys(data)[0]);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [user, isAdmin]);

  // ── AUTO-SAVE ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (locked && !isAdmin)) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      await saveBracket(user.uid, bracket, user.displayName, user.photoURL);
      if (isAdmin) await saveOfficialBracket(bracket);
      const score = calcScore(bracket, officialBracket);
      await updateLeaderboardEntry(user.uid, user.displayName, user.photoURL, score);
      setSaving(false);
      setLastSaved(new Date());
    }, 1500);
    return () => clearTimeout(saveTimer.current);
  }, [bracket, user, locked, isAdmin, officialBracket]);

  // ── PICK HANDLERS ─────────────────────────────────────────────────────────
  // Clicking the current winner clears it (and all downstream picks).
  // Clicking the other team sets them as winner (and clears any conflicting downstream).

  // Helper: recursively clear a team from all downstream rounds/slots
  const clearTeamDownstream = (next, region, teamName, fromRound, fromGameIdx) => {
    // Clear from region rounds
    for (let r = fromRound; r < 4; r++) {
      next[region].rounds[r].forEach((g, gi) => {
        if (g.top?.name    === teamName) { g.top    = null; g.winner = null; }
        if (g.bottom?.name === teamName) { g.bottom = null; g.winner = null; }
        if (g.winner?.name === teamName)   g.winner = null;
      });
    }
    // Clear from Final Four
    const fi    = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
    const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
    if (next.finalFour[fi][fSide]?.name  === teamName) next.finalFour[fi][fSide]  = null;
    if (next.finalFour[fi].winner?.name  === teamName) next.finalFour[fi].winner  = null;
    // Clear from Championship
    const cSide = fi === 0 ? 'top' : 'bottom';
    if (next.championship[cSide]?.name   === teamName) next.championship[cSide]   = null;
    if (next.championship.winner?.name   === teamName) next.championship.winner   = null;
  };

  const handlePick = useCallback((region, rIdx, gIdx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next  = JSON.parse(JSON.stringify(prev));
      const game  = next[region].rounds[rIdx][gIdx];
      if (!game) return prev;
      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked || clicked.firstFour) return prev;

      // Toggle: clicking current winner clears it
      if (game.winner?.name === clicked.name) {
        game.winner = null;
        clearTeamDownstream(next, region, clicked.name, rIdx + 1, Math.floor(gIdx / 2));
        return next;
      }

      // Set new winner
      game.winner = clicked;

      // Clear the loser from all downstream slots
      const loser = side === 'top' ? game.bottom : game.top;
      if (loser) clearTeamDownstream(next, region, loser.name, rIdx + 1, Math.floor(gIdx / 2));

      // Advance winner to next round
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
      const next   = JSON.parse(JSON.stringify(prev));
      const ff     = next.finalFour[idx];
      const clicked = ff[side];
      if (!clicked) return prev;

      // Toggle: clicking current winner clears it + championship slot
      if (ff.winner?.name === clicked.name) {
        ff.winner = null;
        const cSide = idx === 0 ? 'top' : 'bottom';
        next.championship[cSide]  = null;
        next.championship.winner  = null;
        return next;
      }

      // Set winner, clear loser from championship
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
      const next    = JSON.parse(JSON.stringify(prev));
      const clicked = next.championship[side];
      if (!clicked) return prev;
      // Toggle: clicking current champion clears them
      if (next.championship.winner?.name === clicked.name) {
        next.championship.winner = null;
        return next;
      }
      next.championship.winner = clicked;
      return next;
    });
  }, [locked, isAdmin]);

  const handleChampScore = useCallback((field, val) =>
    setBracket(prev => ({ ...prev, championship: { ...prev.championship, [field]: val } }))
  , []);

  // ── TEAM SAVED HANDLER ────────────────────────────────────────────────────
  const handleTeamsSaved = useCallback((newBracket) => {
    setBracket(newBracket);
    setOfficialBracket(newBracket);
  }, []);

  // ── GENERATE ALL RESEARCH ─────────────────────────────────────────────────
  const handleGenerateResearch = useCallback(async (roster) => {
    // Collect all non-firstFour teams
    const teams = [];
    ['East', 'West', 'South', 'Midwest'].forEach(region => {
      (roster[region] || []).forEach(t => {
        if (!t.firstFour && t.name) teams.push({ name: t.name, seed: t.seed, region });
      });
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
      } catch (e) {
        console.warn('Failed to generate for', name, e);
      }
      // Small delay to avoid rate limits
      if (i < teams.length - 1) await new Promise(r => setTimeout(r, 400));
    }

    await saveResearchData(allData);
    setResearchData(allData);
    setGenProgress({ done: teams.length, total: teams.length, current: '' });
    setGenerating(false);
    if (!selectedTeam && Object.keys(allData).length > 0)
      setSelectedTeam(Object.keys(allData)[0]);
  }, [researchData, selectedTeam]);

  // ── EDIT A SINGLE RESEARCH FIELD ──────────────────────────────────────────
  const handleResearchFieldSave = useCallback(async (teamName, fieldPath, value) => {
    setResearchData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next[teamName]) next[teamName] = {};
      // Support dot-path like keyPlayers.0.name
      const parts = fieldPath.split('.');
      let obj = next[teamName];
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
    await saveOneTeamResearch(teamName, (() => {
      const card = JSON.parse(JSON.stringify(researchData[teamName] || {}));
      const parts = fieldPath.split('.');
      let obj = card;
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) obj[parts[i]] = {};
        obj = obj[parts[i]];
      }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          messages: [{ role: 'user', content: `You are an NCAA March Madness analyst. Answer concisely (2-4 paragraphs) for the current tournament: "${researchQ}"\n\nFocus on stats, matchups, tournament history, injury concerns, and bracket strategy.` }],
        }),
      });
      const data = await res.json();
      setResearchResult(data.content?.[0]?.text || 'No response.');
    } catch { setResearchResult('Error — please try again.'); }
    setResearchLoading(false);
  };

  const score  = calcScore(bracket, officialBracket);
  const myRank = leaderboard.findIndex(e => e.uid === user?.uid) + 1;
  const allTeamNames = Object.keys(researchData).sort();

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#d4af37', fontSize: 18 }}>Loading…</div>
    </div>
  );

  if (!user) return (
    <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 88, marginBottom: 12 }}>🏀</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, color: '#d4af37', letterSpacing: 2, lineHeight: 1.1 }}>
          MARCH MADNESS<br />{CURRENT_YEAR}
        </h1>
        <p style={{ color: '#555', fontSize: 16, marginTop: 10 }}>School-Wide Bracket Challenge</p>
      </div>
      <div style={{ ...S.card, textAlign: 'center', maxWidth: 380, padding: '36px 40px' }}>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
          Sign in with your school Google account to fill out your bracket and compete with 1,500+ students.
        </p>
        <button style={S.btn()} onClick={signInWithGoogle}>
          <span style={{ fontWeight: 900, marginRight: 8 }}>G</span> Sign in with Google
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'bracket',     label: '🏀 Bracket'     },
    { id: 'research',    label: '📊 Research'    },
    { id: 'leaderboard', label: '🏆 Leaderboard' },
    ...(isAdmin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ];

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.logo}>🏀 MARCH MADNESS {CURRENT_YEAR}</div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user.photoURL && <img src={user.photoURL} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />}
          <span style={{ fontSize: 13, color: '#888' }}>{user.displayName?.split(' ')[0]}</span>
          {saving && <span style={{ fontSize: 11, color: '#666' }}>Saving…</span>}
          {!saving && lastSaved && <span style={{ fontSize: 11, color: '#3a5a3a' }}>Saved ✓</span>}
          <button onClick={logOut} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 12 }}>Sign out</button>
        </div>
      </header>

      <main style={{ paddingBottom: 60 }}>

        {/* ══════════════════ BRACKET TAB ══════════════════ */}
        {tab === 'bracket' && (
          <div style={{ padding: 20 }}>
            <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#666', letterSpacing: 1, textTransform: 'uppercase' }}>Your Score</div>
                <div style={{ fontSize: 38, fontWeight: 700, color: '#d4af37', fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                  {score} <span style={{ fontSize: 14, color: '#555' }}>pts</span>
                </div>
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
                <div style={{ fontSize: 11, color: '#666' }}>School Rank</div>
                <div style={{ fontSize: 34, fontWeight: 700, color: '#d4af37', fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
                  {myRank > 0 ? `#${myRank}` : '—'}
                </div>
                <div style={{ fontSize: 11, color: '#444' }}>of {leaderboard.length || '—'} entries</div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', paddingBottom: 40 }}>
              <div style={{ minWidth: 1860 }}>
                {/* TOP: East ←→ West */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.East, letterSpacing: 2, marginBottom: 10 }}>◈ EAST</div>
                    <RegionBracket region="East" rounds={bracket.East.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={false} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 230, paddingTop: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d4af37', letterSpacing: 2 }}>🏆 FINAL FOUR</div>
                    <GameSlot game={bracket.finalFour[0]} onPick={s => handleFFPick(0, s)} locked={locked && !isAdmin} />
                    <div style={{ fontSize: 10, color: '#555' }}>East vs West</div>
                    <div style={{ height: 16 }} />
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d4af37', letterSpacing: 2 }}>🏆 CHAMPIONSHIP</div>
                    <GameSlot game={bracket.championship} onPick={handleChampPick} locked={locked && !isAdmin} isChampionship onScoreChange={handleChampScore} />
                    {bracket.championship?.winner && (
                      <div style={{ textAlign: 'center', padding: '12px 22px', background: 'linear-gradient(135deg,rgba(212,175,55,.14),rgba(212,175,55,.04))', borderRadius: 10, border: '1px solid rgba(212,175,55,.35)', marginTop: 4 }}>
                        <div style={{ fontSize: 10, color: '#d4af37', letterSpacing: 2 }}>🏆 CHAMPION</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: "'Playfair Display', serif" }}>{bracket.championship.winner.name}</div>
                        {bracket.championship.scoreTop && (
                          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>
                            {bracket.championship.top?.name} {bracket.championship.scoreTop} – {bracket.championship.scoreBottom} {bracket.championship.bottom?.name}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ height: 16 }} />
                    <GameSlot game={bracket.finalFour[1]} onPick={s => handleFFPick(1, s)} locked={locked && !isAdmin} />
                    <div style={{ fontSize: 10, color: '#555' }}>South vs Midwest</div>
                  </div>
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.West, letterSpacing: 2, marginBottom: 10 }}>◈ WEST</div>
                    <RegionBracket region="West" rounds={bracket.West.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={true} />
                  </div>
                </div>

                <div style={{ height: 44 }} />

                {/* BOTTOM: South ←→ Midwest */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.South, letterSpacing: 2, marginBottom: 10 }}>◈ SOUTH</div>
                    <RegionBracket region="South" rounds={bracket.South.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={false} />
                  </div>
                  <div style={{ minWidth: 230 }} />
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.Midwest, letterSpacing: 2, marginBottom: 10 }}>◈ MIDWEST</div>
                    <RegionBracket region="Midwest" rounds={bracket.Midwest.rounds} onPick={handlePick} locked={locked && !isAdmin} flipped={true} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ RESEARCH TAB ══════════════════ */}
        {tab === 'research' && (
          <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#d4af37', marginBottom: 6 }}>Team Research Hub</h2>
            {isAdmin && <p style={{ color: '#555', fontSize: 13, marginBottom: 16 }}>✏️ As admin, click any field to edit it directly.</p>}

            {allTeamNames.length === 0 ? (
              <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#555' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
                <div style={{ fontSize: 16, marginBottom: 8 }}>No research data yet</div>
                <div style={{ fontSize: 13 }}>
                  {isAdmin
                    ? 'Go to Admin → Set Up Teams, save your teams, then click "Auto-Generate Research Data"'
                    : 'Check back after the admin sets up the tournament teams'}
                </div>
              </div>
            ) : (
              <>
                {/* Team selector */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                  {allTeamNames.map(t => (
                    <button key={t}
                      style={{ ...S.btn(selectedTeam === t ? '#d4af37' : 'rgba(255,255,255,0.05)', selectedTeam === t ? '#080c18' : '#aaa'), padding: '7px 16px', fontSize: 13 }}
                      onClick={() => setSelectedTeam(t)}>{t}</button>
                  ))}
                </div>

                {/* Research card */}
                {selectedTeam && (
                  <ResearchCard
                    teamName={selectedTeam}
                    card={researchData[selectedTeam]}
                    isAdmin={isAdmin}
                    onFieldSave={handleResearchFieldSave}
                  />
                )}
              </>
            )}

            {/* AI Assistant */}
            <div style={{ ...S.card, border: '1px solid rgba(212,175,55,0.22)', marginTop: 8 }}>
              <h3 style={{ color: '#d4af37', marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>AI Research Assistant</h3>
              <p style={{ color: '#555', fontSize: 13, marginBottom: 14 }}>Ask anything about matchups, history, upsets, or bracket strategy</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <input style={{ ...S.input, flex: 1 }} value={researchQ} onChange={e => setResearchQ(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleResearch()}
                  placeholder="e.g. 'How does Duke match up with Auburn?' or 'Best Cinderella picks this year?'" />
                <button style={{ ...S.btn(), flexShrink: 0 }} onClick={handleResearch} disabled={researchLoading}>
                  {researchLoading ? '…' : 'Ask'}
                </button>
              </div>
              {researchResult && (
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 16, fontSize: 14, color: '#ccc', lineHeight: 1.75, borderLeft: '3px solid #d4af37' }}>
                  {researchResult}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {['Best Cinderella teams', 'Most likely R1 upsets', 'Who wins the South region?', 'Best 3-point shooting teams'].map(q => (
                  <button key={q} onClick={() => setResearchQ(q)}
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#777', cursor: 'pointer', fontFamily: 'inherit' }}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ LEADERBOARD TAB ══════════════════ */}
        {tab === 'leaderboard' && (
          <div style={{ padding: 24, maxWidth: 660, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#d4af37', marginBottom: 20 }}>School Leaderboard</h2>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#444', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
                <span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Student</span><span>Points</span>
              </div>
              {leaderboard.length === 0
                ? <div style={{ color: '#444', textAlign: 'center', padding: 24 }}>No entries yet — be the first to submit!</div>
                : leaderboard.map((e, i) => (
                  <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(212,175,55,0.07)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(212,175,55,0.22)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? '#d4af37' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#444', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i + 1}</span>
                    {e.photoURL
                      ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} />
                      : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#666' }}>👤</div>}
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? '#d4af37' : '#bbb', fontSize: 14 }}>
                      {e.displayName || 'Anonymous'}{e.uid === user?.uid ? ' (You)' : ''}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#d4af37', fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))}
            </div>
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
              {[['dashboard', '📊 Dashboard'], ['teams', '🏀 Set Up Teams'], ['help', '❓ Help']].map(([id, label]) => (
                <button key={id}
                  style={{ ...S.navBtn(adminSubTab === id), borderBottom: adminSubTab === id ? '2px solid #e74c3c' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }}
                  onClick={() => setAdminSubTab(id)}>{label}</button>
              ))}
            </div>

            {adminSubTab === 'dashboard' && (
              <>
                {/* AI generation progress bar */}
                {generating && (
                  <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ color: '#6366f1', fontSize: 14, fontWeight: 700 }}>🤖 Generating research data…</span>
                      <span style={{ color: '#888', fontSize: 13 }}>{genProgress.done} / {genProgress.total}</span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', background: '#6366f1', borderRadius: 3, width: `${(genProgress.done / genProgress.total) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>Currently fetching: {genProgress.current}</div>
                  </div>
                )}
                <div style={{ ...S.card, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 16 }}>
                  <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                    Use the <strong style={{ color: '#d4af37' }}>Bracket tab</strong> to enter official game results — your picks become the school's answer key and update all student scores live.<br /><br />
                    Use <strong style={{ color: '#d4af37' }}>Set Up Teams</strong> every March after Selection Sunday — no code editing needed.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                  {[
                    ['Total Entries', leaderboard.length],
                    ['Avg Score', leaderboard.length ? Math.round(leaderboard.reduce((a, e) => a + (e.score || 0), 0) / leaderboard.length) + ' pts' : '—'],
                    ['Status', locked ? '🔒 Locked' : '🟢 Open'],
                  ].map(([l, v]) => (
                    <div key={l} style={{ ...S.card, textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#d4af37', fontFamily: "'Playfair Display', serif" }}>{v}</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {adminSubTab === 'teams' && (
              <TeamEntryPanel
                onTeamsSaved={handleTeamsSaved}
                onRequestGenerateResearch={handleGenerateResearch}
              />
            )}

            {adminSubTab === 'help' && (
              <div style={S.card}>
                <h3 style={{ color: '#d4af37', marginBottom: 14 }}>👤 Adding Another Admin</h3>
                <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                  1. Have the person sign into the app once with their Google account.<br />
                  2. Go to <strong style={{ color: '#ccc' }}>Firebase Console → Authentication → Users</strong> and copy their <strong style={{ color: '#ccc' }}>User UID</strong>.<br />
                  3. Go to <strong style={{ color: '#ccc' }}>Firestore → admins collection</strong> → Add document with that UID as the Document ID.<br />
                  4. They sign out and back in — Admin tab appears automatically.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
