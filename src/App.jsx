// src/App.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './firebase';
import {
  saveBracket, loadBracket,
  saveOfficialBracket, subscribeToOfficialBracket,
  subscribeToConfig, setTournamentLocked,
  subscribeToLeaderboard, updateLeaderboardEntry,
  checkIsAdmin,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, calcScore, TEAM_RESEARCH,
} from './bracketData';

// ── REGION COLORS ─────────────────────────────────────────────────────────────
const RC = { East: '#3b82f6', West: '#ef4444', South: '#22c55e', Midwest: '#f59e0b' };

// ── TEAM LOGO ─────────────────────────────────────────────────────────────────
function TeamLogo({ espnId, name, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!espnId || err) return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg,#1a3a5c,#2d6a4f)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0,
      border: '1px solid rgba(255,255,255,0.15)',
    }}>{name?.charAt(0) || '?'}</span>
  );
  return (
    <img
      src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`}
      alt={name} width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#fff' }}
      onError={() => setErr(true)}
    />
  );
}

// ── GAME SLOT ─────────────────────────────────────────────────────────────────
function GameSlot({ game, onPick, locked, isChampionship, onScoreChange }) {
  if (!game) return null;
  const { top, bottom, winner } = game;

  const Team = ({ team, side }) => {
    if (!team) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', height: 34, color: '#444', fontSize: 11, fontStyle: 'italic' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#1a1e2e', flexShrink: 0 }} />
        TBD
      </div>
    );
    const isW = winner?.name === team.name;
    const isL = winner && !isW;
    return (
      <div
        onClick={() => !locked && !team.firstFour && onPick?.(side)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', height: 34,
          background: isW ? 'linear-gradient(90deg,rgba(212,175,55,.22),rgba(212,175,55,.05))' : 'transparent',
          cursor: locked || team.firstFour ? 'default' : 'pointer',
          borderRadius: 4, opacity: isL ? 0.28 : 1, transition: 'background .12s',
        }}
      >
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>
          {team.seed}
        </span>
        <span style={{
          fontSize: 11, fontWeight: isW ? 700 : 500,
          color: isW ? '#d4af37' : isL ? '#444' : '#ccc',
          textDecoration: isL ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 108,
        }}>
          {team.firstFour ? 'First Four →' : team.name}
        </span>
        {isW && <span style={{ marginLeft: 'auto', color: '#d4af37', fontSize: 11 }}>✓</span>}
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
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange('scoreTop', e.target.value)}
            style={scoreInput} />
          <span style={{ color: '#555', fontSize: 11, alignSelf: 'center' }}>–</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange('scoreBottom', e.target.value)}
            style={scoreInput} />
        </div>
      )}
    </div>
  );
}
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid #2a2a3a', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

// ── REGION BRACKET ────────────────────────────────────────────────────────────
const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite Eight'];
const ROW_GAPS     = [4, 42, 116, 248];

function RegionBracket({ region, rounds, onPick, locked }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {rounds.map((games, rIdx) => (
        <div key={rIdx} style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAPS[rIdx] }}>
          <div style={{ fontSize: 9, color: '#d4af37', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center', marginBottom: 4, whiteSpace: 'nowrap' }}>
            {ROUND_LABELS[rIdx]}
          </div>
          {games.map((game, gIdx) => (
            <GameSlot key={gIdx} game={game} locked={locked}
              onPick={side => onPick(region, rIdx, gIdx, side)} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  app:    { minHeight: '100vh', background: '#080c18', color: '#e0e0e0', fontFamily: "'Source Sans 3', sans-serif" },
  header: { background: 'rgba(8,12,24,.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(212,175,55,.25)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 900, color: '#d4af37', letterSpacing: 1 },
  card:   { background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 },
  btn:    (bg = '#d4af37', fg = '#080c18') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? '#d4af37' : 'transparent', color: a ? '#080c18' : '#888', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
};

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,            setUser]            = useState(null);
  const [isAdmin,         setIsAdmin]         = useState(false);
  const [authLoading,     setAuthLoading]     = useState(true);
  const [tab,             setTab]             = useState('bracket');
  const [bracket,         setBracket]         = useState(buildInitialBracket());
  const [officialBracket, setOfficialBracket] = useState(null);
  const [locked,          setLocked]          = useState(false);
  const [leaderboard,     setLeaderboard]     = useState([]);
  const [saving,          setSaving]          = useState(false);
  const [lastSaved,       setLastSaved]       = useState(null);
  const [selectedTeam,    setSelectedTeam]    = useState('Duke');
  const [researchQ,       setResearchQ]       = useState('');
  const [researchResult,  setResearchResult]  = useState('');
  const [researchLoading, setResearchLoading] = useState(false);
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
    const u1 = subscribeToOfficialBracket(setOfficialBracket);
    const u2 = subscribeToConfig(cfg => setLocked(cfg.locked ?? false));
    const u3 = subscribeToLeaderboard(setLeaderboard);
    return () => { u1(); u2(); u3(); };
  }, [user]);

  // ── AUTO-SAVE (debounced 1.5s) ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (locked && !isAdmin) return; // students can't save after lock
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
  const handlePick = useCallback((region, rIdx, gIdx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const game = next[region].rounds[rIdx][gIdx];
      if (!game) return prev;
      const winner = side === 'top' ? game.top : game.bottom;
      if (!winner || winner.firstFour) return prev;
      game.winner = winner;
      // Advance to next region round
      if (rIdx < 3) {
        const ng = next[region].rounds[rIdx + 1][Math.floor(gIdx / 2)];
        ng[gIdx % 2 === 0 ? 'top' : 'bottom'] = winner;
        if (ng.winner?.name !== winner.name) ng.winner = null;
      }
      // Elite Eight → Final Four
      if (rIdx === 3) {
        const fi   = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
        const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
        next.finalFour[fi][fSide] = winner;
        if (next.finalFour[fi].winner?.name !== winner.name) next.finalFour[fi].winner = null;
      }
      return next;
    });
  }, [locked, isAdmin]);

  const handleFFPick = useCallback((idx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const winner = next.finalFour[idx][side === 'top' ? 'top' : 'bottom'];
      if (!winner) return prev;
      next.finalFour[idx].winner = winner;
      next.championship[idx === 0 ? 'top' : 'bottom'] = winner;
      if (next.championship.winner?.name !== winner.name) next.championship.winner = null;
      return next;
    });
  }, [locked, isAdmin]);

  const handleChampPick = useCallback(side => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const winner = next.championship[side];
      if (!winner) return prev;
      next.championship.winner = winner;
      return next;
    });
  }, [locked, isAdmin]);

  const handleChampScore = useCallback((field, val) =>
    setBracket(prev => ({ ...prev, championship: { ...prev.championship, [field]: val } }))
  , []);

  // ── AI RESEARCH ───────────────────────────────────────────────────────────
  const handleResearch = async () => {
    if (!researchQ.trim()) return;
    setResearchLoading(true); setResearchResult('');
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 1000,
          messages: [{ role: 'user', content: `You are an NCAA March Madness analyst. Answer concisely (2-4 paragraphs) using knowledge through early 2025: "${researchQ}"\n\nFocus on stats, matchups, tournament history, injury concerns, and bracket strategy.` }],
        }),
      });
      const data = await res.json();
      setResearchResult(data.content?.[0]?.text || 'No response.');
    } catch { setResearchResult('Error — please try again.'); }
    setResearchLoading(false);
  };

  const score  = calcScore(bracket, officialBracket);
  const myRank = leaderboard.findIndex(e => e.uid === user?.uid) + 1;

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
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

  // ── MAIN APP ──────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'bracket',     label: '🏀 Bracket'     },
    { id: 'research',    label: '📊 Research'    },
    { id: 'leaderboard', label: '🏆 Leaderboard' },
    ...(isAdmin ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
  ];

  return (
    <div style={S.app}>
      {/* ── HEADER ── */}
      <header style={S.header}>
        <div style={S.logo}>🏀 MARCH MADNESS {CURRENT_YEAR}</div>
        <nav style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user.photoURL && <img src={user.photoURL} alt="" width={28} height={28} style={{ borderRadius: '50%' }} />}
          <span style={{ fontSize: 13, color: '#888' }}>{user.displayName?.split(' ')[0]}</span>
          {saving     && <span style={{ fontSize: 11, color: '#666' }}>Saving…</span>}
          {!saving && lastSaved && <span style={{ fontSize: 11, color: '#3a5a3a' }}>Saved ✓</span>}
          <button onClick={logOut} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 12 }}>Sign out</button>
        </div>
      </header>

      <main style={{ paddingBottom: 60 }}>

        {/* ════════════════════════ BRACKET TAB ════════════════════════ */}
        {tab === 'bracket' && (
          <div style={{ padding: 20 }}>
            {/* Score bar */}
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
                  <button
                    style={{ ...S.btn(locked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 12, padding: '6px 16px' }}
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

            {/* Bracket canvas */}
            <div style={{ overflowX: 'auto', paddingBottom: 40 }}>
              <div style={{ minWidth: 1860 }}>

                {/* TOP: East ←→ West */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.East, letterSpacing: 2, marginBottom: 10 }}>◈ EAST</div>
                    <RegionBracket region="East" rounds={bracket.East.rounds} onPick={handlePick} locked={locked && !isAdmin} />
                  </div>

                  {/* CENTER */}
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
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 4, fontFamily: "'Playfair Display', serif" }}>
                          {bracket.championship.winner.name}
                        </div>
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
                    <RegionBracket region="West" rounds={bracket.West.rounds.map(r => [...r].reverse())} onPick={handlePick} locked={locked && !isAdmin} />
                  </div>
                </div>

                <div style={{ height: 44 }} />

                {/* BOTTOM: South ←→ Midwest */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.South, letterSpacing: 2, marginBottom: 10 }}>◈ SOUTH</div>
                    <RegionBracket region="South" rounds={bracket.South.rounds} onPick={handlePick} locked={locked && !isAdmin} />
                  </div>
                  <div style={{ minWidth: 230 }} />
                  <div>
                    <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: RC.Midwest, letterSpacing: 2, marginBottom: 10 }}>◈ MIDWEST</div>
                    <RegionBracket region="Midwest" rounds={bracket.Midwest.rounds.map(r => [...r].reverse())} onPick={handlePick} locked={locked && !isAdmin} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ RESEARCH TAB ════════════════════════ */}
        {tab === 'research' && (
          <div style={{ padding: 24, maxWidth: 1080, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#d4af37', marginBottom: 20 }}>Team Research Hub</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {Object.keys(TEAM_RESEARCH).map(t => (
                <button key={t} style={{ ...S.btn(selectedTeam === t ? '#d4af37' : 'rgba(255,255,255,0.05)', selectedTeam === t ? '#080c18' : '#aaa'), padding: '7px 16px', fontSize: 13 }}
                  onClick={() => setSelectedTeam(t)}>{t}</button>
              ))}
            </div>
            {(() => {
              const t = TEAM_RESEARCH[selectedTeam];
              if (!t) return null;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                  <div style={S.card}>
                    <h3 style={{ color: '#d4af37', marginBottom: 14, fontFamily: "'Playfair Display', serif" }}>{selectedTeam}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[['Record', t.record], ['Rank', t.rank], ['Coach', t.coach], ['Conference', t.conference],
                        ['KenPom', t.kenpom], ['Offense', t.offense + ' ORtg'], ['Defense', t.defense + ' DRtg'], ['Pace', t.pace]
                      ].map(([l, v]) => (
                        <div key={l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 12px' }}>
                          <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd', marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={S.card}>
                    <h3 style={{ color: '#d4af37', marginBottom: 12 }}>Key Players</h3>
                    {t.keyPlayers.map((p, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700 }}>{p.name}</span>
                          <span style={{ color: '#666', fontSize: 12 }}>{p.pos}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#999', margin: '3px 0' }}>{p.stats}</div>
                        <div style={{ fontSize: 12, color: '#d4af37', fontStyle: 'italic' }}>⭐ {p.note}</div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 12px', background: 'rgba(231,76,60,0.07)', borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)' }}>
                      <div style={{ fontSize: 10, color: '#e74c3c', letterSpacing: 1 }}>🏥 INJURY REPORT</div>
                      <div style={{ fontSize: 13, color: '#bbb', marginTop: 4 }}>{t.injuries}</div>
                    </div>
                  </div>
                  <div style={S.card}>
                    <h3 style={{ color: '#d4af37', marginBottom: 12 }}>Scouting Report</h3>
                    {[['✅ STRENGTHS', '#22c55e', t.strengths], ['⚠️ WEAKNESSES', '#e74c3c', t.weaknesses], ['💡 ANALYST NOTE', '#d4af37', t.analystNote]].map(([label, color, text]) => (
                      <div key={label} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, color, letterSpacing: 1 }}>{label}</div>
                        <div style={{ fontSize: 13, color: '#bbb', marginTop: 4, lineHeight: 1.55, fontStyle: label.includes('NOTE') ? 'italic' : 'normal' }}>{text}</div>
                      </div>
                    ))}
                  </div>
                  <div style={S.card}>
                    <h3 style={{ color: '#d4af37', marginBottom: 10 }}>Championship Odds</h3>
                    <div style={{ fontSize: 44, fontWeight: 700, color: '#22c55e', fontFamily: "'Playfair Display', serif" }}>{t.odds}</div>
                    <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>Consensus sportsbook odds to win it all</div>
                    <div style={{ padding: 12, background: 'rgba(212,175,55,0.07)', borderRadius: 8, border: '1px solid rgba(212,175,55,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                      💰 Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* AI Assistant */}
            <div style={{ ...S.card, border: '1px solid rgba(212,175,55,0.22)' }}>
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
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#777', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ LEADERBOARD TAB ════════════════════════ */}
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
                  <div key={e.uid} style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px',
                    background: e.uid === user?.uid ? 'rgba(212,175,55,0.07)' : 'transparent',
                    borderRadius: 8, marginBottom: 3,
                    border: e.uid === user?.uid ? '1px solid rgba(212,175,55,0.22)' : '1px solid transparent',
                  }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? '#d4af37' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#444', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>
                      #{i + 1}
                    </span>
                    {e.photoURL
                      ? <img src={e.photoURL} alt="" width={26} height={26} style={{ borderRadius: '50%' }} />
                      : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1a1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#666' }}>👤</div>
                    }
                    <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? '#d4af37' : '#bbb', fontSize: 14 }}>
                      {e.displayName || 'Anonymous'}{e.uid === user?.uid ? ' (You)' : ''}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: '#d4af37', fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* ════════════════════════ ADMIN TAB ════════════════════════ */}
        {tab === 'admin' && isAdmin && (
          <div style={{ padding: 24, maxWidth: 840, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c', boxShadow: '0 0 6px #e74c3c' }} />
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', margin: 0 }}>Admin Panel</h2>
            </div>
            <div style={{ ...S.card, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 16 }}>
              <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                Go to the <strong style={{ color: '#d4af37' }}>Bracket tab</strong> to enter official game results.
                Every pick you make there becomes the school's scoring answer key.
                Student scores update <strong style={{ color: '#d4af37' }}>live</strong> as you advance teams.<br /><br />
                Click <strong style={{ color: '#e74c3c' }}>Lock All Brackets</strong> before the first game tips off to freeze student picks across all devices simultaneously.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
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

            <div style={{ ...S.card, marginBottom: 16 }}>
              <h3 style={{ color: '#d4af37', marginBottom: 10 }}>📅 Annual Update (Every March)</h3>
              <p style={{ color: '#888', fontSize: 14, lineHeight: 1.65, marginBottom: 12 }}>
                Open <code style={{ color: '#d4af37', background: 'rgba(212,175,55,0.1)', padding: '1px 6px', borderRadius: 3 }}>src/bracketData.js</code> in StackBlitz.
                Update <code style={{ color: '#d4af37' }}>CURRENT_YEAR</code> and replace all 64 team entries.
                First Four slots use <code style={{ color: '#d4af37' }}>{'firstFour: true'}</code>. Save — done.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '14px 16px', fontSize: 12, color: '#7ec8e3', fontFamily: 'monospace', lineHeight: 1.9, overflowX: 'auto' }}>
                {`// 1. Bump the year\nexport const CURRENT_YEAR = 2026;\n\n// 2. Replace teams (find ESPN IDs at espn.com/mens-college-basketball/teams)\nexport const TEAMS = {\n  East: [\n    { seed: 1, name: "New #1 Seed", espnId: 12345 },\n    // ... seeds 2-15 ...\n    { seed: 16, name: "FF: TBD", espnId: null, firstFour: true },\n  ],\n  // West, South, Midwest same format\n};`}
              </div>
            </div>

            <div style={S.card}>
              <h3 style={{ color: '#d4af37', marginBottom: 10 }}>👤 Adding an Admin</h3>
              <p style={{ color: '#888', fontSize: 14, lineHeight: 1.65 }}>
                1. The person signs into the app once with their Google account.<br />
                2. You go to <strong style={{ color: '#ccc' }}>Firebase Console → Authentication → Users</strong> and copy their <strong style={{ color: '#ccc' }}>User UID</strong>.<br />
                3. Go to <strong style={{ color: '#ccc' }}>Firestore → admins collection</strong> → Add document with that UID as the Document ID.<br />
                4. They sign out and back in — Admin tab appears automatically.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
