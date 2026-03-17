// src/App.jsx — Full rewrite with all fixes
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './firebase';
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
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
  saveMammalRoster, registerUser, checkIsTeacher, subscribeToAllUsers,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, buildInitialBracketFromTeams,
  calcScore,
} from './bracketData';

// ── THEME ─────────────────────────────────────────────────────────────────────
const ACCENT  = '#16a34a';
const ACCENT2 = '#4ade80';
const GOLD    = '#f59e0b';
const GOLD2   = '#fcd34d';
const RC = { East: '#93c5fd', West: '#fca5a5', South: '#86efac', Midwest: '#fdba74' };
const ROUND_COLORS = [
  'rgba(96,165,250,0.22)',
  'rgba(167,139,250,0.22)',
  'rgba(251,191,36,0.18)',
  'rgba(239,68,68,0.22)',
  'rgba(16,185,129,0.25)',
];
const ROUND_BORDER_COLORS = [
  'rgba(96,165,250,0.6)',
  'rgba(167,139,250,0.6)',
  'rgba(251,191,36,0.55)',
  'rgba(239,68,68,0.6)',
  'rgba(52,211,153,0.7)',
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

// ── HELPERS ───────────────────────────────────────────────────────────────────
function formatName(displayName) {
  if (!displayName) return 'Anonymous';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

const labelFontSize = (name) => {
  const len = (name || '').length;
  if (len <= 4)  return 120;
  if (len <= 6)  return 96;
  if (len <= 8)  return 76;
  if (len <= 10) return 60;
  if (len <= 12) return 50;
  if (len <= 14) return 42;
  return 34;
};

// ── ERROR BOUNDARY ────────────────────────────────────────────────────────────
import { Component } from 'react';
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏀</div>
          <h2 style={{ color: '#f87171', fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            Don't worry — your bracket picks are saved. Try reloading the page. If the problem keeps happening, let your teacher know.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => window.location.reload()}>
              Reload Page
            </button>
            <button style={{ background: 'rgba(255,255,255,0.07)', color: '#888', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => this.setState({ error: null })}>
              Try Again
            </button>
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: '#333' }}>{this.state.error?.message}</div>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// ── OFFLINE INDICATOR ─────────────────────────────────────────────────────────
function OfflineBar() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '6px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>
      ⚠️ You're offline — picks will save when you reconnect
    </div>
  );
}

// ── TEAM LOGO ─────────────────────────────────────────────────────────────────
const TeamLogo = memo(function TeamLogo({ espnId, name, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!espnId || err) return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#14532d,#166534)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}
      role="img" aria-label={name}>
      {name?.charAt(0) || '?'}
    </span>
  );
  return <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#fff' }} onError={() => setErr(true)} />;
});

// ── LABEL BOX (shared by both brackets) ──────────────────────────────────────
const LabelBox = memo(function LabelBox({ name, color, left, right, top, bottom, CW, SH }) {
  const LBL_W = CW * 2, LBL_H = SH * 2;
  return (
    <div style={{
      position: 'absolute', width: LBL_W, height: LBL_H,
      ...(left   !== undefined ? { left }   : {}),
      ...(right  !== undefined ? { right }  : {}),
      ...(top    !== undefined ? { top }    : {}),
      ...(bottom !== undefined ? { bottom } : {}),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      <span style={{
        fontSize: labelFontSize(name), fontWeight: 900, color, opacity: 0.18,
        letterSpacing: 2, textTransform: 'uppercase', userSelect: 'none',
        lineHeight: 1, whiteSpace: 'nowrap', textAlign: 'center', transition: 'font-size 0.2s',
      }}>{name}</span>
    </div>
  );
});

// ── GAME SLOT ─────────────────────────────────────────────────────────────────
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

function findLiveScore(liveScores, teamName) {
  if (!teamName || !liveScores) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(teamName);
  const exact = Object.entries(liveScores).find(([k]) => norm(k) === target);
  if (exact) return exact[1];
  const sub = Object.entries(liveScores).find(([k]) => {
    const nk = norm(k); return nk.includes(target) || target.includes(nk);
  });
  return sub ? sub[1] : null;
}

const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onMatchup = null }) {
  const [hovered, setHovered] = useState(false);
  if (!game) return null;
  const { top, bottom, winner } = game;
  const slotBg     = isChampionship ? 'rgba(245,158,11,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(245,158,11,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];
  const topLive    = findLiveScore(liveScores, top?.name);
  const bottomLive = findLiveScore(liveScores, bottom?.name);
  const hasLive    = topLive && bottomLive;
  const isLiveGame = hasLive && topLive.state === 'in';
  const isFinal    = hasLive && topLive.state === 'post';

  const Team = ({ team, side }) => {
    if (!team) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, color: '#888', fontSize: 11, fontStyle: 'italic', flexDirection: flipped ? 'row-reverse' : 'row' }}
        aria-label="TBD">
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#111', flexShrink: 0 }} />TBD
      </div>
    );
    const isW  = winner?.name === team.name;
    const isL  = winner && !isW;
    const isFF = team.isFFPlaceholder;
    const live = side === 'top' ? topLive : bottomLive;
    const isLiveWinning = hasLive && live && live.score > (side === 'top' ? bottomLive?.score : topLive?.score);

    const handleClick = () => { if (!locked && !isFF && onPick) onPick(side); };
    const handleKey   = (e) => { if ((e.key === 'Enter' || e.key === ' ') && !locked && !isFF && onPick) { e.preventDefault(); onPick(side); } };

    if (isHorizontal) return (
      <div onClick={handleClick} onKeyDown={handleKey}
        tabIndex={locked || isFF ? -1 : 0}
        role="button" aria-label={`Pick ${team.name}`} aria-pressed={isW}
        title={isW && !locked ? 'Click to undo this pick' : ''}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px',
          background: isW ? 'linear-gradient(180deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)',
          cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 6, opacity: isL ? 0.3 : 1,
          transition: 'background .12s', minWidth: 100,
          border: isW ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(255,255,255,0.06)',
          outline: 'none',
        }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={36} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700 }}>{team.seed}</span>
        <span style={{ fontSize: 20, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textAlign: 'center', maxWidth: 130, lineHeight: 1.2 }}>
          {isFF ? 'TBD' : team.name}
        </span>
        {hasLive && live && <span style={{ fontSize: 20, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888' }}>{live.score}</span>}
        {isW && <span style={{ color: ACCENT2, fontSize: 14 }} aria-hidden="true">✓</span>}
      </div>
    );

    return (
      <div onClick={handleClick} onKeyDown={handleKey}
        tabIndex={locked || isFF ? -1 : 0}
        role="button" aria-label={`Pick ${team.name}, seed ${team.seed}`} aria-pressed={isW}
        title={isW && !locked ? 'Click to undo this pick' : ''}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box',
          flexDirection: flipped ? 'row-reverse' : 'row',
          background: isW ? 'linear-gradient(90deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)',
          cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.3 : 1,
          transition: 'background .12s', outline: 'none',
        }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: team.name && team.name.length > 18 ? 11 : team.name && team.name.length > 13 ? 13 : 17, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
          {isFF ? 'First Four Winner' : team.name}
        </span>
        {hasLive && live && <span style={{ fontSize: 13, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888', minWidth: 24, textAlign: 'right', marginLeft: 2, flexShrink: 0 }}>{live.score}</span>}
        {isW && !hasLive && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: ACCENT2, fontSize: 11 }} aria-hidden="true">✓</span>}
        {isL && <span className="sr-only">eliminated</span>}
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
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} aria-hidden="true" />
              <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span>
            </div>
          )}
          {isFinal && <span style={{ fontSize: 10, color: '#777', fontWeight: 700, letterSpacing: 1 }}>FINAL</span>}
          <span style={{ fontSize: 18, fontWeight: 900, color: '#888' }} aria-hidden="true">VS</span>
          {isChampionship && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input placeholder="–" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} aria-label="Top score" style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
              <span style={{ color: '#777', fontSize: 13, alignSelf: 'center' }}>-</span>
              <input placeholder="–" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} aria-label="Bottom score" style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
            </div>
          )}
        </div>
        <Team team={bottom} side="bottom" />
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', padding: '8px 8px 0 0' }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
        <Team team={top} side="top" />
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} role="separator" />
        <Team team={bottom} side="bottom" />
        {isLiveGame && topLive?.clock && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '2px 8px', background: 'rgba(239,68,68,0.12)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} aria-hidden="true" />
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
            <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} aria-label="Top team score" style={scoreInput} />
            <span style={{ color: '#777', fontSize: 11, alignSelf: 'center' }}>-</span>
            <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} aria-label="Bottom team score" style={scoreInput} />
          </div>
        )}
      </div>
      {onMatchup && top?.name && bottom?.name && !top.isFFPlaceholder && !bottom.isFFPlaceholder && hovered && (
        <button onClick={e => { e.stopPropagation(); onMatchup(top.name, bottom.name); }}
          aria-label={`Compare ${top.name} vs ${bottom.name} in Research tab`}
          style={{ position: 'absolute', top: 0, right: 0, zIndex: 20, background: '#1d4ed8', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          title="Compare in Research tab">
          📊
        </button>
      )}
    </div>
  );
});

// ── FF GAME CARD ──────────────────────────────────────────────────────────────
function FFGameCard({ region, seed, ffTeams, pick, isLocked, onFirstFourPick, keyStr, regionNames, canMatchup, onMatchup }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 14px', minWidth: 210 }}>
        <div style={{ fontSize: 10, color: RC[region], fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
          {(regionNames && regionNames[region]) || region} — #{seed} seed play-in
        </div>
        {ffTeams.map(team => {
          const isPick = pick === team.name;
          return (
            <div key={team.name}
              onClick={e => { e.stopPropagation(); !isLocked && onFirstFourPick(keyStr, team, region, seed); }}
              role="button" tabIndex={isLocked ? -1 : 0} aria-pressed={isPick}
              aria-label={`Pick ${team.name}`}
              onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isLocked) { e.preventDefault(); onFirstFourPick(keyStr, team, region, seed); } }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, marginBottom: 5, cursor: isLocked ? 'default' : 'pointer', background: isPick ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)', border: isPick ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)', transition: 'all .12s', outline: 'none' }}>
              <TeamLogo espnId={team.espnId} name={team.name} size={20} />
              <span style={{ fontSize: 10, color: '#777', fontWeight: 700, minWidth: 14 }}>{team.seed}</span>
              <span style={{ fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 12, fontWeight: isPick ? 700 : 400, color: isPick ? '#a5b4fc' : '#bbb', flex: 1 }}>{team.name}</span>
              {isPick && <span style={{ color: '#818cf8', fontSize: 13 }} aria-hidden="true">✓</span>}
            </div>
          );
        })}
        {pick
          ? <div style={{ fontSize: 10, color: '#777', textAlign: 'center', marginTop: 4 }}>{pick} advances as #{seed} seed</div>
          : <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginTop: 4 }}>pick a winner</div>}
      </div>
      {canMatchup && hovered && ffTeams.length >= 2 && (
        <button onClick={e => { e.stopPropagation(); onMatchup(ffTeams[0].name, ffTeams[1].name); }}
          aria-label={`Compare ${ffTeams[0].name} vs ${ffTeams[1].name} in Research tab`}
          style={{ position: 'absolute', top: 0, right: 0, zIndex: 20, background: '#1d4ed8', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          title="Compare in Research tab">
          📊
        </button>
      )}
    </div>
  );
}

// ── EDITABLE FIELD ────────────────────────────────────────────────────────────
function EditableField({ value, onSave, color = '#ccc', large = false, multiline = false, label = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSavingF] = useState(false);
  const commit = async () => { setSavingF(true); await onSave(draft); setSavingF(false); setEditing(false); };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}
      onClick={() => { setDraft(value); setEditing(true); }}
      role="button" tabIndex={0} aria-label={`Edit ${label}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDraft(value); setEditing(true); } }}>
      <span style={{ color, fontSize: large ? 38 : 13, fontWeight: large ? 700 : 400, lineHeight: 1.5, flex: 1 }}>{value || '-'}</span>
      <span style={{ fontSize: 10, color: '#888', marginTop: large ? 6 : 2, flexShrink: 0 }}>edit</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {multiline
        ? <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={3} aria-label={`Edit ${label}`} style={{ ...S.input, resize: 'vertical', fontSize: 13, padding: '8px 12px' }} />
        : <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus aria-label={`Edit ${label}`}
            style={{ ...S.input, fontSize: large ? 18 : 13, padding: '6px 12px' }}
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
  const [bannerErr, setBannerErr] = useState(false);
  const [logoErr,   setLogoErr]   = useState(false);
  if (!card) return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#888' }}>
      No data yet
    </div>
  );
  const espnId = card.espnId || '';
  const bannerUrl = espnId ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${espnId}.png&w=900&h=225&scale=crop&location=origin&transparent=false&background=0x1a3a2a` : '';
  const logoUrl   = espnId ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png` : '';

  const field = (path, value, opts = {}) => isAdmin
    ? <EditableField value={value} onSave={v => onFieldSave(teamName, path, v)} label={path} {...opts} />
    : <span style={{ color: opts.color || '#ccc', fontSize: opts.large ? 38 : 13 }}>{value || '-'}</span>;

  return (
    <div style={{ marginBottom: 28 }}>
      {/* ── ESPN Banner Header ── */}
      <div style={{ position: 'relative', height: 140, borderRadius: '12px 12px 0 0', overflow: 'hidden', background: 'linear-gradient(135deg,#0d2818,#1a3a2a)', marginBottom: 0 }}>
        {bannerUrl && !bannerErr && (
          <img src={bannerUrl} alt={teamName} onError={() => setBannerErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.4 }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 100%)' }} />
        {/* Logo overlay */}
        <div style={{ position: 'absolute', bottom: 16, left: 20, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          {logoUrl && !logoErr ? (
            <img src={logoUrl} alt={teamName} onError={() => setLogoErr(true)}
              style={{ width: 72, height: 72, borderRadius: '50%', background: '#fff', padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', objectFit: 'contain' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#14532d,#166534)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' }}>
              {teamName?.charAt(0) || '?'}
            </div>
          )}
          <div style={{ paddingBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{card.conference || ''} · Seed #{card.rank?.replace(/[^0-9]/g,'') || ''}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', margin: 0, fontSize: 24, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{teamName}</h2>
          </div>
        </div>
        {/* Record badge */}
        {card.record && (
          <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>RECORD</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: ACCENT2 }}>{card.record}</div>
          </div>
        )}
      </div>

      {/* ── Stats Grid ── */}
      <div className="research-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={S.card}>
          <h3 style={{ color: ACCENT2, marginBottom: 14, fontFamily: "'Playfair Display', serif" }}>Team Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['Rank','rank'],['Coach','coach'],['Conference','conference'],['KenPom','kenpom'],['Offense','offense'],['Defense','defense'],['Pace','pace']].map(([label, key]) => (
              <div key={key} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '8px 12px' }}>
                <div style={S.tag('#555')}>{label}</div>
                {field(key, card[key], { label })}
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <h3 style={{ color: ACCENT2, marginBottom: 12 }}>Key Players</h3>
          {(card.keyPlayers || []).map((p, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                {isAdmin ? <EditableField value={p.name} label="player name" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.name`, v)} /> : <span style={{ fontWeight: 700 }}>{p.name}</span>}
                {isAdmin ? <EditableField value={p.pos} label="position" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} /> : <span style={{ color: '#999', fontSize: 12 }}>{p.pos}</span>}
              </div>
              {isAdmin ? <EditableField value={p.stats} label="stats" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.stats`, v)} /> : <div style={{ fontSize: 13, color: '#999', margin: '3px 0' }}>{p.stats}</div>}
              {isAdmin ? <EditableField value={p.note} label="note" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.note`, v)} color={ACCENT2} /> : <div style={{ fontSize: 12, color: ACCENT2, fontStyle: 'italic' }}>{p.note}</div>}
            </div>
          ))}
          <div style={{ padding: '10px 12px', background: 'rgba(231,76,60,0.07)', borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)', marginTop: 8 }}>
            <div style={S.tag('#e74c3c')}>Injury Report</div>
            {field('injuries', card.injuries, { multiline: true, label: 'injuries' })}
          </div>
        </div>
        <div style={S.card}>
          <h3 style={{ color: ACCENT2, marginBottom: 12 }}>Scouting Report</h3>
          {[['Strengths','#22c55e','strengths'],['Weaknesses','#e74c3c','weaknesses'],['Analyst Note',ACCENT2,'analystNote']].map(([label, color, key]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={S.tag(color)}>{label}</div>
              {field(key, card[key], { color: '#bbb', multiline: true, label })}
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h3 style={{ color: ACCENT2, marginBottom: 10 }}>Championship Odds</h3>
          {field('odds', card.odds, { color: '#22c55e', large: true, label: 'odds' })}
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16, marginTop: 6 }}>Consensus sportsbook odds to win it all</div>
          <div style={{ padding: 12, background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
            Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.
          </div>
          {isAdmin && <div style={{ marginTop: 12, padding: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: '#777' }}>Click any field above to edit it.</div>}
        </div>
      </div>
    </div>
  );
}

// ── REGION BANNER COLORS ─────────────────────────────────────────────────────
const REGION_BANNER_COLORS = {
  East:    ['#1e3a5f', '#2563eb'],
  West:    ['#5f1e1e', '#dc2626'],
  South:   ['#1e4d2b', '#16a34a'],
  Midwest: ['#4d3a1e', '#d97706'],
};

// ── MAMMAL RESEARCH CARD ──────────────────────────────────────────────────────
function MammalResearchCard({ animalName, card, isAdmin, onFieldSave, onGenerate, generating }) {
  const [imgErrors, setImgErrors] = useState({});
  const [lightbox, setLightbox] = useState(null);

  const region = (card?.region && REGION_BANNER_COLORS[card.region]) ? card.region : 'East';
  const [bgDark, bgLight] = REGION_BANNER_COLORS[region];
  const galleryImages = card?.galleryImages || [];
  const phyloPicUrl   = card?.phyloPicUrl   || null;
  const wikiImageUrl  = card?.wikiImageUrl  || null;
  const empty = !card || Object.keys(card).length === 0;

  const handleImgError = (key) => setImgErrors(prev => ({ ...prev, [key]: true }));

  return (
    <div style={{ marginBottom: 20 }}>
      {/* ── Banner: region-colored gradient + PhyloPic silhouette ── */}
      <div style={{ position: 'relative', height: 160, borderRadius: '12px 12px 0 0', overflow: 'hidden', background: `linear-gradient(135deg, ${bgDark} 0%, ${bgLight} 100%)` }}>
        {/* PhyloPic silhouette centered */}
        {phyloPicUrl && !imgErrors['phylopic'] && (
          <img src={phyloPicUrl} alt={`${animalName} silhouette`}
            onError={() => handleImgError('phylopic')}
            style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', height: 120, opacity: 0.35, filter: 'brightness(0)', objectFit: 'contain' }} />
        )}
        {/* Wikipedia header image - faded left side */}
        {wikiImageUrl && !imgErrors['wiki-header'] && (
          <img src={wikiImageUrl} alt={animalName}
            onError={() => handleImgError('wiki-header')}
            style={{ position: 'absolute', left: 0, top: 0, width: '45%', height: '100%', objectFit: 'cover', opacity: 0.25, maskImage: 'linear-gradient(to right, rgba(0,0,0,0.6), transparent)' }} />
        )}
        {/* Overlay gradient */}
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, rgba(0,0,0,0.5) 0%, transparent 60%)` }} />
        {/* Text content */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
              {region} Region · Seed #{card?.seed || ''}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', margin: 0, fontSize: 26, textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.1 }}>{animalName}</h2>
            {card?.latinName && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginTop: 3 }}>{card.latinName}</div>
            )}
          </div>
          {isAdmin && (
            <button onClick={() => onGenerate(animalName)} disabled={generating}
              aria-label={`Generate facts for ${animalName}`}
              style={{ ...S.btn('#6366f1', '#fff'), padding: '7px 16px', fontSize: 12, flexShrink: 0 }}>
              {generating ? '⏳ Generating...' : '✨ Regenerate'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      {empty ? (
        <div style={{ ...S.card, borderRadius: '0 0 12px 12px', borderTop: 'none', color: '#666', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 32 }}>
          {isAdmin ? 'No data yet — click "Generate Facts" to auto-populate.' : 'Organism facts coming soon!'}
        </div>
      ) : (
        <div style={{ ...S.card, borderRadius: '0 0 12px 12px', borderTop: 'none', borderColor: `${bgLight}44` }}>
          <div className="research-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Info boxes */}
            {[['Habitat','habitat'],['Diet & Hunting','diet'],['Superpower','superpower'],['Battle Strength','battleStrength']].map(([label, fld]) => (
              <div key={fld} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{label}</div>
                {isAdmin && onFieldSave
                  ? <EditableField value={card[fld]} label={fld} onSave={v => onFieldSave(animalName, fld, v)} color="#ccc" multiline />
                  : <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{card[fld] || '—'}</div>}
              </div>
            ))}

            {/* Image Gallery */}
            {galleryImages.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Photo Gallery</div>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                  {galleryImages.map((img, i) => !imgErrors[`gallery-${i}`] && (
                    <div key={i} style={{ flexShrink: 0, textAlign: 'center' }}>
                      <img src={img.url} alt={`${animalName} - ${img.source}`}
                        onError={() => handleImgError(`gallery-${i}`)}
                        onClick={() => setLightbox({ url: img.url, source: img.source, name: animalName })}
                        style={{ height: 160, width: 200, objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'zoom-in' }} />
                      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{img.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Lightbox */}
            {lightbox && (
              <div onClick={() => setLightbox(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }}
                role="dialog" aria-modal="true" aria-label={`${lightbox.name} photo`}>
                <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                  <img src={lightbox.url} alt={lightbox.name}
                    style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, display: 'block', boxShadow: '0 8px 40px rgba(0,0,0,0.8)' }} />
                  <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: '#888' }}>{lightbox.source}</div>
                  <button onClick={() => setLightbox(null)}
                    style={{ position: 'absolute', top: -12, right: -12, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                    aria-label="Close">×</button>
                </div>
              </div>
            )}

            {/* Fun Facts */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Fun Facts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(card.funFacts || []).map((fact, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: bgLight, fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                    <span style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{fact}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, gridColumn: '1 / -1', flexWrap: 'wrap' }}>
              {[['Size', card.size], ['Lifespan', card.lifespan], ['Speed', card.speed]].map(([label, val]) => val && (
                <div key={label} style={{ background: `${bgLight}15`, borderRadius: 8, padding: '10px 16px', border: `1px solid ${bgLight}33`, flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#ccc' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
  const out = { year: new Date().getFullYear() };
  ['East','West','South','Midwest'].forEach(r => {
    out[r] = Array(16).fill(null).map((_, i) => ({ seed: i+1, name: `Seed ${i+1}`, espnId: '', firstFour: false }));
  });
  return out;
}

function makePlaceholderMammalRoster() {
  const out = {};
  ['East','West','South','Midwest'].forEach(r => {
    out[r] = PLACEHOLDER_ANIMALS[r].map((name, i) => ({ seed: i+1, name, firstFour: false }));
  });
  return out;
}

// ── ESPN BRACKET IMPORT ───────────────────────────────────────────────────────
async function importFromESPN() {
  // Try multiple ESPN tournament API endpoints — ID changes each year
  const year = new Date().getFullYear();
  const urls = [
    // Primary: scoreboard-based bracket endpoint (most reliable)
    `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=64&dates=${year}`,
    // Tournament bracket endpoints with various IDs
    'https://site.web.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/22?region=us&lang=en&lang=en',
    'https://site.web.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/23?region=us&lang=en',
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/22',
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/23',
    // Fallback: general scoreboard
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=64',
  ];
  let data = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const d = await res.json();
        // Check if this response has useful bracket/team data
        const hasTeams = d.bracket || d.rounds || d.groups || d.regions ||
          (d.events && d.events.length > 0);
        if (hasTeams) { data = d; break; }
      }
    } catch {}
  }
  if (!data) throw new Error('Could not reach ESPN API. Try again or enter teams manually.');
  const regionMap = { East: [], West: [], South: [], Midwest: [] };
  const regionNames = Object.keys(regionMap);
  // Try bracket structure first
  const bracket = data.bracket || data.rounds?.[0] || data.tournament?.bracket;
  if (bracket) {
    const walkBracket = (node) => {
      if (!node) return;
      if (node.competitors) node.competitors.forEach(c => {
        const region = regionNames.find(r => c.region?.toLowerCase().includes(r.toLowerCase()));
        if (region && c.team) regionMap[region].push({ seed: parseInt(c.seed) || 0, name: c.team.displayName || c.team.name, espnId: String(c.team.id || ''), firstFour: false });
      });
      (node.children || node.games || []).forEach(walkBracket);
    };
    walkBracket(bracket);
  }
  // Try groups/regions structure
  const groups = data.groups || data.regions || data.rounds?.[0]?.groups;
  if (groups && Object.values(regionMap).every(r => r.length === 0)) {
    groups.forEach(group => {
      const regionName = regionNames.find(r => group.name?.toLowerCase().includes(r.toLowerCase()) || group.abbreviation?.toLowerCase().includes(r.toLowerCase()[0]));
      if (!regionName) return;
      (group.teams || group.standings?.entries || []).forEach(entry => {
        const team = entry.team || entry;
        regionMap[regionName].push({ seed: parseInt(entry.seed || entry.curatedRank?.current) || 0, name: team.displayName || team.name || '', espnId: String(team.id || ''), firstFour: false });
      });
    });
  }
  // Try scoreboard events format — extract teams from upcoming games
  if (data.events && Object.values(regionMap).every(r => r.length === 0)) {
    data.events.forEach(event => {
      const comp = event.competitions?.[0];
      if (!comp) return;
      // Try to find region from notes or event name
      const eventName = (event.name || event.shortName || '').toLowerCase();
      const region = regionNames.find(r => eventName.includes(r.toLowerCase()));
      comp.competitors?.forEach(c => {
        const seed = parseInt(c.curatedRank?.current || c.statistics?.find(s => s.name === 'seed')?.value) || 0;
        const teamRegion = region || regionNames.find(r => (c.team?.location || '').toLowerCase().includes(r.toLowerCase()));
        if (teamRegion && c.team && seed > 0) {
          regionMap[teamRegion].push({ seed, name: c.team.displayName || c.team.name || '', espnId: String(c.team.id || ''), firstFour: false });
        }
      });
    });
  }
  const totalTeams = Object.values(regionMap).reduce((s, r) => s + r.length, 0);
  if (totalTeams < 16) throw new Error(`ESPN returned only ${totalTeams} teams — bracket may not be announced yet.`);
  Object.keys(regionMap).forEach(r => {
    regionMap[r].sort((a, b) => a.seed - b.seed);
    const seedCounts = {};
    regionMap[r].forEach(t => { seedCounts[t.seed] = (seedCounts[t.seed] || 0) + 1; });
    regionMap[r] = regionMap[r].map(t => ({ ...t, firstFour: seedCounts[t.seed] > 1 }));
  });
  return { ...regionMap, year: new Date().getFullYear() };
}

// ── CLAUDE HAIKU VIA VERCEL PROXY ────────────────────────────────────────────
// Calls /api/generate (serverless function) so the API key never hits the browser.
// Retries indefinitely on per-minute rate limits with progressive backoff.
// Only throws on daily quota exhaustion or unrecoverable errors.
async function callAI(prompt, _sources = [], textOnly = false) {
  const BACKOFF_MS = [60000, 90000, 120000]; // 1min, 1.5min, 2min progressive
  let rateLimitAttempt = 0;
  while (true) {
    let res;
    try {
      res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sources: _sources, textOnly }),
      });
    } catch (e) {
      console.warn('Network error calling /api/generate, retrying in 15s:', e.message);
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }
    if (res.status === 429) {
      let errBody = '';
      try { errBody = await res.text(); } catch {}
      const isDaily = errBody.toLowerCase().includes('daily') || errBody.toLowerCase().includes('tomorrow');
      if (isDaily) throw new Error('Daily Gemini quota reached. Resets at midnight Pacific. Try again tomorrow.');
      const wait = BACKOFF_MS[Math.min(rateLimitAttempt, BACKOFF_MS.length - 1)];
      console.warn('Rate limited (attempt ' + (rateLimitAttempt + 1) + '), waiting ' + (wait/1000) + 's...');
      rateLimitAttempt++;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('AI proxy error ' + res.status + ': ' + errText.slice(0, 500));
    }
    rateLimitAttempt = 0;
    let data;
    try { data = await res.json(); } catch { throw new Error('Proxy returned invalid JSON'); }
    // Proxy returns { result: parsedJSON } or { error: string }
    if (data.error) {
      const isDaily = data.error.toLowerCase().includes('daily') || data.error.toLowerCase().includes('tomorrow');
      if (isDaily) throw new Error('Daily Gemini quota reached. Resets at midnight Pacific. Try again tomorrow.');
      throw new Error(data.error);
    }
    return data.result ?? null;
  }
}

async function generateResearchForTeam(teamName, seed, region, espnId, sources = []) {
  const prompt = `You are writing a basketball team scouting report for middle school students (grades 6-8) for the ${new Date().getFullYear()} NCAA Tournament.
Write about: ${teamName} (${region} Region, Seed #${seed})
Use simple, clear language that a 12-14 year old can easily understand. Avoid jargon — if you use a basketball term, briefly explain it.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"record":"W-L","rank":"#N AP or Unranked","coach":"Coach Name","conference":"Conference Name","kenpom":"#N","offense":"NNN.N","defense":"NN.N","pace":"NN.N","keyPlayers":[{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"simple 1-sentence note a student would understand"},{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"simple 1-sentence note a student would understand"}],"injuries":"injury status or None reported","odds":"+XXXX or N/A","strengths":"2-3 sentences explaining what this team does well, written for a middle schooler","weaknesses":"2-3 sentences explaining where this team struggles, written for a middle schooler","analystNote":"1-2 sentences on why this team could surprise people in the tournament","espnId":"${espnId || ''}"}`;
  return callAI(prompt, sources);
}

async function generateMammalResearch(animalName, seed, region, sources = []) {
  const prompt = `You are a nature educator writing organism profiles for middle school students (grades 6-8).
Generate a fun, age-appropriate JSON profile for: ${animalName} (${region} Region, Seed #${seed}) competing in March Mammal Madness.
IMPORTANT: First identify the Latin (scientific) name for ${animalName}. If the provided source materials contain a Latin name for this organism, use that exact Latin name. Otherwise determine it from your knowledge.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"latinName":"Genus species","habitat":"2-3 sentence description of where this organism lives","diet":"2-3 sentences on what it eats and how it hunts or forages","funFacts":["interesting fact 1","interesting fact 2","interesting fact 3"],"size":"weight and length/height","lifespan":"X-Y years","speed":"top speed if known, or movement description","superpower":"1 sentence on this organism's most impressive ability or adaptation","battleStrength":"1-2 sentence fun assessment of how this organism would do in a bracket battle and why"}
Keep all language at a middle school reading level. Make it engaging and educational. No graphic violence descriptions.`;
  return callAI(prompt, sources);
}

// ── ESPN TEAM LOOKUP BY ID ───────────────────────────────────────────────────
async function lookupESPNTeam(espnId) {
  if (!espnId || !String(espnId).match(/^\d+$/)) return null;
  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${espnId}`);
    if (!res.ok) return null;
    const data = await res.json();
    const team = data?.team;
    if (!team) return null;
    return team.displayName || team.name || null;
  } catch { return null; }
}

// ── ADMIN TEAM ENTRY PANEL ────────────────────────────────────────────────────
function TeamEntryPanel({ onTeamsSaved, onRequestGenerateResearch, regionNames, onRegionNamesChange, sourcesData, onSaveSources }) {
  const [roster,       setRoster]       = useState(makePlaceholderRoster());
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [applying,     setApplying]     = useState(false);
  const [applied,      setApplied]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [importing,    setImporting]    = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [importMsg,    setImportMsg]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'teamRoster'));
        if (snap.exists()) {
          const d = snap.data();
          if (d._regionNames) onRegionNamesChange(d._regionNames);
          delete d.updatedAt; delete d._regionNames;
          const hasNames = ['East','West','South','Midwest'].some(r => (d[r] || []).some(t => t.name?.trim()));
          setRoster(hasNames ? d : makePlaceholderRoster());
        }
      } catch (e) { console.warn('Failed to load roster:', e); }
      setLoading(false);
    })();
  }, []);

  const updateTeam = (region, idx, field, value) => {
    setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[region][idx][field] = value; return n; });
    setSaved(false); setApplied(false);
  };

  const handleSaveRoster = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'admin', 'teamRoster'), { ...roster, _regionNames: regionNames, updatedAt: serverTimestamp() });
      setSaved(true);
    } catch (e) { alert('Failed to save roster: ' + e.message); }
    setSaving(false);
  };

  const handleApplyToBracket = async () => {
    setApplying(true);
    try {
      const nb = buildInitialBracketFromTeams(roster);
      await saveOfficialBracket(nb);
      setApplied(true);
      onTeamsSaved(nb, roster);
    } catch (e) { alert('Failed to apply bracket: ' + e.message); }
    setApplying(false);
  };

  const handleESPNImport = async () => {
    setImporting(true); setImportStatus(''); setImportMsg('Fetching from ESPN...');
    try {
      const imported = await importFromESPN();
      setRoster(imported); setSaved(false); setApplied(false);
      setImportStatus('success');
      const total = Object.values(imported).filter(v => Array.isArray(v)).reduce((s, r) => s + r.length, 0);
      setImportMsg(`✓ Imported ${total} teams! Review below, then Save Roster → Apply to Bracket.`);
    } catch (e) { setImportStatus('error'); setImportMsg(e.message || 'Import failed.'); }
    setImporting(false);
  };

  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading roster...</div>;
  const regionTeams = roster[activeRegion] || [];

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: ACCENT2, marginBottom: 4 }}>Set Up This Year's Teams</h3>
          <p style={{ color: '#999', fontSize: 13 }}>Import from ESPN after Selection Sunday, or enter teams manually.</p>
          {/* Region name editor */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: ACCENT2, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
            {['East','West','South','Midwest'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
                <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })}
                  aria-label={`${r} region display name`}
                  placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...S.btn('#0284c7', '#fff'), padding: '8px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleESPNImport} disabled={importing}>
            {importing ? '⏳ Importing...' : '📡 Import from ESPN'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Year:</span>
            <input type="number" value={roster.year} aria-label="Tournament year"
              onChange={e => { setRoster(p => ({ ...p, year: parseInt(e.target.value) })); setSaved(false); }}
              style={{ ...S.input, width: 82, padding: '6px 10px', fontSize: 13 }} />
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
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', marginRight: 2 }}>✨ Generate Research:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(99,102,241,0.3)', '#a5b4fc'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(99,102,241,0.5)' }}
                  onClick={() => onRequestGenerateResearch(roster, r)}>
                  {regionNames[r] || r}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {importMsg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: importStatus === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${importStatus === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 13, color: importStatus === 'success' ? ACCENT2 : '#f87171' }} role="alert">
          {importMsg}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: 12 }}>
        {[['1. Save Roster', saved], ['2. Apply to Bracket', applied], ['3. Generate Research (optional)', false]].map(([label, done], i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: done ? 'rgba(22,163,74,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${done ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)'}`, color: done ? ACCENT2 : '#555' }}>
            {done ? '✓' : `${i+1}`} {label}
          </div>
        ))}
      </div>
      {onSaveSources && <SourcesPanel sources={sourcesData} onChange={onSaveSources} label="Basketball" />}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }} aria-hidden="true">●</span>{regionNames[r] || r}
            <span style={{ marginLeft: 6, fontSize: 11, color: '#777' }}>({roster[r]?.length || 0})</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {regionTeams.map((team, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: team.firstFour ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: team.firstFour ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
            <input type="number" min="1" max="16" value={team.seed} aria-label={`Seed for team ${idx+1}`}
              onChange={e => updateTeam(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)}
              style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Team name" value={team.name} aria-label={`Team name ${idx+1}`}
              onChange={e => updateTeam(activeRegion, idx, 'name', e.target.value)}
              style={{ ...S.input, flex: 2, padding: '6px 10px', fontSize: 13 }} />
            <input placeholder="ESPN ID" value={team.espnId} aria-label={`ESPN ID for ${team.name}`}
              onChange={e => updateTeam(activeRegion, idx, 'espnId', e.target.value)}
              onBlur={async e => {
                const id = e.target.value.trim();
                if (!id) return;
                const fetched = await lookupESPNTeam(id);
                if (fetched) {
                  // Only auto-fill name if it's empty or a placeholder
                  const currentName = team.name?.trim() || '';
                  if (!currentName || currentName.startsWith('Seed ')) {
                    updateTeam(activeRegion, idx, 'name', fetched);
                  }
                }
              }}
              style={{ ...S.input, width: 80, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={team.firstFour} onChange={e => updateTeam(activeRegion, idx, 'firstFour', e.target.checked)} aria-label="First Four team" />
              <span style={{ fontSize: 11, color: team.firstFour ? '#818cf8' : '#888', whiteSpace: 'nowrap', fontWeight: team.firstFour ? 700 : 400 }}>FF</span>
            </label>
            {regionTeams.length > 16 && (
              <button onClick={() => { setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[activeRegion].splice(idx, 1); return n; }); setSaved(false); }}
                aria-label={`Remove ${team.name}`}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: '0 2px', flexShrink: 0 }}>×</button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button onClick={() => setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[activeRegion].push({ seed: '', name: '', espnId: '', firstFour: true }); return n; })}
          style={{ ...S.btn('rgba(99,102,241,0.2)', '#818cf8'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(99,102,241,0.3)' }}>
          + Add FF Slot
        </button>
        <div style={{ flex: 1, padding: '7px 14px', background: 'rgba(96,165,250,0.07)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', fontSize: 12, color: '#93c5fd' }}>
          ESPN ID tip: espn.com/mens-college-basketball/team/_/id/<strong>150</strong>/duke — number after /id/
        </div>
      </div>
    </div>
  );
}

// ── MAMMAL TEAM ENTRY PANEL ───────────────────────────────────────────────────
function MammalEntryPanel({ onAnimalsSaved, onRequestGenerateMammalResearch, onRefetchImages, regionNames, onRegionNamesChange, sourcesData, onSaveSources }) {
  const [roster,       setRoster]   = useState({ East: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), West: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), South: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), Midwest: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })) });
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied,  setApplied]  = useState(false);
  const [loading,  setLoading]  = useState(true);

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
      } catch (e) { console.warn('Failed to load mammal roster:', e); }
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
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#86efac', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
            {['East','West','South','Midwest'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
                <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })}
                  aria-label={`${r} mammal region display name`}
                  placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12 }} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...S.btn(saved ? '#22c55e' : ACCENT, '#fff'), padding: '8px 20px', fontSize: 13 }}
            onClick={async () => { setSaving(true); try { await saveMammalRoster({ ...roster, _regionNames: regionNames }); setSaved(true); } catch(e) { alert('Save failed: ' + e.message); } setSaving(false); }} disabled={saving}>
            {saving ? 'Saving...' : saved ? '✓ Roster Saved' : 'Save Roster'}
          </button>
          <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }}
            onClick={async () => { setApplying(true); try { const nb = buildInitialBracketFromTeams(roster); await saveMammalOfficialBracket(nb); setApplied(true); onAnimalsSaved(nb, roster); } catch(e) { alert('Apply failed: ' + e.message); } setApplying(false); }} disabled={applying}>
            {applying ? 'Applying...' : applied ? '✓ Applied!' : 'Apply to Bracket'}
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', marginRight: 2, minWidth: 110 }}>✨ Generate Facts:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(99,102,241,0.3)', '#a5b4fc'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(99,102,241,0.5)' }}
                  onClick={() => onRequestGenerateMammalResearch(roster, r)}>
                  {regionNames[r] || r}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', marginRight: 2, minWidth: 110 }}>🖼️ Re-fetch Images:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(20,184,166,0.2)', '#5eead4'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(20,184,166,0.4)' }}
                  onClick={() => onRefetchImages && onRefetchImages(r)}>
                  {regionNames[r] || r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {onSaveSources && <SourcesPanel sources={sourcesData} onChange={onSaveSources} label="Mammal Madness" />}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }} aria-hidden="true">●</span>{regionNames[r] || r}
            <span style={{ marginLeft: 6, fontSize: 11, color: '#777' }}>({roster[activeRegion]?.length || 0})</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(roster[activeRegion] || []).map((animal, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: animal.firstFour ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: animal.firstFour ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.07)' }}>
            <input type="number" min="1" max="16" value={animal.seed} aria-label={`Seed for animal ${idx+1}`}
              onChange={e => updateAnimal(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)}
              style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Animal name" value={animal.name} aria-label={`Animal name ${idx+1}`}
              onChange={e => updateAnimal(activeRegion, idx, 'name', e.target.value)}
              style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={animal.firstFour} onChange={e => updateAnimal(activeRegion, idx, 'firstFour', e.target.checked)} aria-label="First Four animal" />
              <span style={{ fontSize: 11, color: animal.firstFour ? '#818cf8' : '#888', whiteSpace: 'nowrap', fontWeight: animal.firstFour ? 700 : 400 }}>FF</span>
            </label>
          </div>
        ))}
      </div>
      <button onClick={() => setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[activeRegion].push({ seed: '', name: '', firstFour: true }); return n; })}
        style={{ ...S.btn('rgba(99,102,241,0.2)', '#818cf8'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(99,102,241,0.3)', marginTop: 12 }}>
        + Add FF Slot
      </button>
    </div>
  );
}

// ── SOURCES PANEL ────────────────────────────────────────────────────────────
function SourcesPanel({ sources, onChange, label }) {
  const [newUrl,  setNewUrl]  = useState('');
  const [newName, setNewName] = useState('');

  const add = () => {
    if (!newUrl.trim()) return;
    onChange([...sources, { url: newUrl.trim(), name: newName.trim() || newUrl.trim(), primary: true }]);
    setNewUrl(''); setNewName('');
  };

  const remove  = (i) => onChange(sources.filter((_, idx) => idx !== i));
  const toggle  = (i) => onChange(sources.map((s, idx) => idx === i ? { ...s, primary: !s.primary } : s));

  return (
    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.25)' }}>
      <h3 style={{ color: '#a5b4fc', marginBottom: 4, fontSize: 15 }}>📎 Research Sources — {label}</h3>
      <p style={{ color: '#777', fontSize: 12, marginBottom: 14 }}>
        URLs the AI will read before generating research. Primary sources are prioritized. Secondary sources are used as supplementary context.
      </p>
      {sources.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {sources.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={() => toggle(i)}
                style={{ ...S.btn(s.primary ? '#6366f1' : 'rgba(255,255,255,0.08)', s.primary ? '#fff' : '#888'), padding: '3px 10px', fontSize: 10, flexShrink: 0 }}>
                {s.primary ? 'PRIMARY' : 'SECONDARY'}
              </button>
              <span style={{ flex: 1, fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.url}>
                <span style={{ color: '#fff', fontWeight: 600, marginRight: 6 }}>{s.name}</span>
                <span style={{ color: '#555' }}>{s.url}</span>
              </span>
              <button onClick={() => remove(i)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16, padding: '0 4px', flexShrink: 0 }}
                aria-label={`Remove ${s.name}`}>×</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Source name (e.g. MMM 2025 Slideshow)" value={newName}
          onChange={e => setNewName(e.target.value)}
          style={{ ...S.input, flex: 1, minWidth: 160, padding: '7px 12px', fontSize: 12 }} />
        <input placeholder="URL" value={newUrl}
          onChange={e => setNewUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}
          style={{ ...S.input, flex: 2, minWidth: 200, padding: '7px 12px', fontSize: 12 }} />
        <button style={{ ...S.btn('#6366f1', '#fff'), padding: '7px 16px', fontSize: 12, flexShrink: 0 }} onClick={add}>
          + Add Source
        </button>
      </div>
    </div>
  );
}

// ── VIEW BRACKET MODAL ───────────────────────────────────────────────────────
function ViewBracketModal({ data, onClose }) {
  const { displayName, bracket, isMammal } = data;
  const regions = ['East', 'West', 'South', 'Midwest'];
  const rounds = isMammal ? ['R64','R32','S16','E8'] : ['R64','R32','S16','E8'];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
      role="dialog" aria-modal="true" aria-label={`${displayName}'s bracket`}>
      <div style={{ ...S.card, maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: isMammal ? '#86efac' : ACCENT2, margin: 0 }}>{displayName}'s Bracket</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer', padding: '0 4px' }} aria-label="Close">×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {regions.map(region => {
            const regionRounds = bracket[region]?.rounds || [];
            return (
              <div key={region} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: isMammal ? '#86efac' : ACCENT2, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>{region}</div>
                {regionRounds.slice(0, 4).map((roundGames, rIdx) => (
                  <div key={rIdx} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{rounds[rIdx]}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {roundGames.map((game, gIdx) => game.winner && (
                        <div key={gIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}>
                          {!isMammal && <TeamLogo espnId={game.winner?.espnId} name={game.winner?.name} size={16} />}
                          <span style={{ color: isMammal ? '#86efac' : ACCENT2, fontWeight: 600 }}>#{game.winner.seed}</span>
                          <span style={{ color: '#ccc' }}>{game.winner.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Final Four */}
                {bracket.finalFour && bracket.finalFour.map((ff, i) => {
                  const ffRegion = [['East','West'],['South','Midwest']];
                  if (!ffRegion[i]?.includes(region)) return null;
                  return ff.winner ? (
                    <div key={`ff-${i}`} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Final Four</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(245,158,11,0.08)', borderRadius: 6, border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, width: 'fit-content' }}>
                        {!isMammal && <TeamLogo espnId={ff.winner?.espnId} name={ff.winner?.name} size={16} />}
                        <span style={{ color: GOLD2, fontWeight: 600 }}>#{ff.winner.seed}</span>
                        <span style={{ color: '#ccc' }}>{ff.winner.name}</span>
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
            );
          })}
          {bracket.championship?.winner && (
            <div style={{ marginTop: 8, padding: 16, background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: GOLD2, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>🏆 Champion</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {!isMammal && <TeamLogo espnId={bracket.championship.winner?.espnId} name={bracket.championship.winner?.name} size={32} />}
                <div style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{bracket.championship.winner.name}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 16, textAlign: 'right' }}>
          <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), padding: '7px 20px' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── LATIN NAME REVIEW MODAL ──────────────────────────────────────────────────
function LatinNameReviewModal({ review, onConfirm, onCancel }) {
  const [animals, setAnimals] = useState(review.animals.map(a => ({ ...a })));

  const updateLatin = (i, value) => {
    setAnimals(prev => prev.map((a, idx) => idx === i ? { ...a, latinName: value } : a));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      role="dialog" aria-modal="true" aria-label="Review Latin names">
      <div style={{ ...S.card, maxWidth: 680, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderColor: 'rgba(134,239,172,0.3)' }}>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#86efac', marginBottom: 6 }}>Review Latin Names</h2>
          <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>
            Claude identified the following scientific names. Review and correct any errors before images are fetched.
            Accurate Latin names ensure the correct images are pulled from iNaturalist, Wikipedia, and other sources.
          </p>
        </div>

        {/* Scrollable table */}
        <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 4 }}>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', padding: '4px 8px' }}>Common Name</div>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', padding: '4px 8px' }}>Latin Name (Scientific)</div>
          </div>
          {animals.map((animal, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 4, alignItems: 'center' }}>
              <div style={{ fontSize: 14, color: '#ccc', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px 0 0 6px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ fontSize: 10, color: '#555', marginRight: 6 }}>#{animal.seed}</span>
                {animal.name}
              </div>
              <input
                value={animal.latinName}
                onChange={e => updateLatin(i, e.target.value)}
                placeholder="Genus species"
                style={{ ...S.input, borderRadius: '0 6px 6px 0', borderLeft: 'none', fontSize: 13, padding: '8px 10px', fontStyle: 'italic', color: '#86efac' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), padding: '9px 20px' }} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ ...S.btn('#16a34a', '#fff'), padding: '9px 24px' }} onClick={() => onConfirm(animals, review.allData)}>
            Looks Good — Fetch Images →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      role="dialog" aria-modal="true" aria-label="Confirm action">
      <div style={{ ...S.card, maxWidth: 360, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 15, color: '#ccc', marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button style={S.btn('#e74c3c')} onClick={onConfirm}>Confirm</button>
          <button style={S.btn('rgba(255,255,255,0.1)', '#aaa')} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}


// ── EXTRACT FF PLACEHOLDERS FROM BRACKET ──────────────────────────────────────
// Scans R64 games for isFFPlaceholder slots and returns a map of
// "Region-seed" -> placeholder team object (with ffTeams array).
// Called once on bracket load to seed the ffPlaceholders state.
function extractFFPlaceholders(bracket) {
  const out = {};
  ['East','West','South','Midwest'].forEach(region => {
    (bracket[region]?.rounds?.[0] || []).forEach(game => {
      ['top','bottom'].forEach(side => {
        const slot = game[side];
        if (slot?.isFFPlaceholder && slot.ffTeams) {
          out[`${region}-${slot.seed}`] = slot;
        }
      });
    });
  });
  return out;
}

// ── APPLY FIRST FOUR PICKS TO BRACKET ────────────────────────────────────────
// After loading a saved bracket + firstFourPicks from Firestore, the placeholder
// slots in R64 still show "First Four Winner". This function re-applies the picks.
function applyFirstFourPicks(bracket, picks) {
  if (!picks || Object.keys(picks).length === 0) return bracket;
  const next = JSON.parse(JSON.stringify(bracket));
  Object.entries(picks).forEach(([key, winnerName]) => {
    // key format: "Region-seed" e.g. "East-11"
    const parts = key.split('-');
    const region = parts[0];
    const seed = parseInt(parts[1]);
    if (!region || !seed) return;
    const r64 = next[region]?.rounds?.[0];
    if (!r64) return;
    r64.forEach(game => {
      // Find the placeholder slot for this seed
      ['top', 'bottom'].forEach(side => {
        const slot = game[side];
        if (slot?.isFFPlaceholder && Number(slot.seed) === seed) {
          // Find the winning team from ffTeams
          const winner = slot.ffTeams?.find(t => t.name === winnerName);
          if (winner) game[side] = { ...winner, isFFPlaceholder: false };
        }
      });
    });
  });
  return next;
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  // ── STATE ──────────────────────────────────────────────────────────────────
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
  const [researchMatchup,  setResearchMatchup] = useState(null);
  const [adminSubTab,      setAdminSubTab]     = useState('dashboard');
  const [generating,       setGenerating]      = useState(false);
  const [genProgress,      setGenProgress]     = useState({ done: 0, total: 0, current: '' });
  const [genError,         setGenError]        = useState('');
  const [firstFourPicks,   setFirstFourPicks]  = useState({});
  // Stores original FF placeholder objects keyed by "Region-seed"
  // Set once on bracket load, never overwritten — used to restore placeholders on un-pick
  const [ffPlaceholders,      setFfPlaceholders]      = useState({});
  const [mammalFfPlaceholders,setMammalFfPlaceholders]= useState({});
  const [tournamentYear,   setTournamentYear]  = useState(CURRENT_YEAR);
  const [yearDraft,        setYearDraft]       = useState(String(CURRENT_YEAR));
  const [yearSaving,       setYearSaving]      = useState(false);
  const [liveScores,       setLiveScores]      = useState({});
  const [activeTournament, setActiveTournament] = useState('basketball');
  const [confirmDialog,    setConfirmDialog]   = useState(null); // { message, onConfirm }
  // Basketball region names (customizable)
  const [bbRegionNames,    setBbRegionNames]   = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });
  // Research sources (URLs for AI to consult during generation)
  const [bbSources,        setBbSources]       = useState([]);
  const [mammalSources,    setMammalSources]   = useState([]);

  // Mammal state
  const [mammalBracket,         setMammalBracket]         = useState(() => buildInitialBracketFromTeams(makePlaceholderMammalRoster()));
  const [mammalOfficialBracket, setMammalOfficialBracket] = useState(null);
  const [mammalLocked,          setMammalLocked]          = useState(false);
  const [mammalLeaderboard,     setMammalLeaderboard]     = useState([]);
  const [mammalResearchData,    setMammalResearchData]    = useState({});
  const [mammalSelectedAnimal,  setMammalSelectedAnimal]  = useState(null);
  const [mammalFirstFourPicks,  setMammalFirstFourPicks]  = useState({});
  const [mammalGenerating,      setMammalGenerating]      = useState(false);
  const [mammalGenProgress,     setMammalGenProgress]     = useState({ done: 0, total: 0, current: '' });
  const [mammalGenError,        setMammalGenError]        = useState('');
  const [mammalGeneratingOne,   setMammalGeneratingOne]   = useState(null);
  // Latin name review state — set during mammal generation phase 1→2
  const [latinReview,          setLatinReview]           = useState(null); // { animals: [{name, latinName, seed, region}], allData, onConfirm }
  const [mammalRegionNames,     setMammalRegionNames]     = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });
  // Users list (admin only)
  const [allUsers,             setAllUsers]             = useState([]);
  const [removingUser,         setRemovingUser]         = useState(null);
  // Roster mismatch warning
  const [rosterMismatch,       setRosterMismatch]       = useState(false);
  const [mammalRosterMismatch, setMammalRosterMismatch] = useState(false);
  // View bracket modal
  const [viewingBracket,       setViewingBracket]       = useState(null); // { uid, displayName, bracket, isMammal }
  const [loadingBracket,       setLoadingBracket]       = useState(null); // uid being loaded
  // Saved indicator for mammals too
  const [mammalLastSaved,      setMammalLastSaved]      = useState(null);

  const saveTimer         = useRef(null);
  const prevBracket       = useRef(null);
  const prevFF            = useRef(null);
  const mammalSaveTimer   = useRef(null);
  const prevMammalBracket = useRef(null);
  const prevMammalFF      = useRef(null);

  // ── MEMOIZED DERIVED STATE ────────────────────────────────────────────────
  const allTeamNames   = useMemo(() => Object.keys(researchData).sort(), [researchData]);
  const allAnimalNames = useMemo(() => Object.keys(mammalResearchData).sort(), [mammalResearchData]);
  // First Four team names from placeholders (flat list of all ffTeams)
  const ffTeamNames = useMemo(() => {
    const names = new Set();
    Object.values(ffPlaceholders).forEach(slot => (slot.ffTeams || []).forEach(t => names.add(t.name)));
    return [...names].sort();
  }, [ffPlaceholders]);
  const mammalFfTeamNames = useMemo(() => {
    const names = new Set();
    Object.values(mammalFfPlaceholders).forEach(slot => (slot.ffTeams || []).forEach(t => names.add(t.name)));
    return [...names].sort();
  }, [mammalFfPlaceholders]);
  const score          = useMemo(() => calcScore(bracket, officialBracket), [bracket, officialBracket]);
  const mammalScore    = useMemo(() => calcScore(mammalBracket, mammalOfficialBracket), [mammalBracket, mammalOfficialBracket]);
  const teacherBoard        = useMemo(() => leaderboard.filter(e => e.isTeacher), [leaderboard]);
  const studentBoard        = useMemo(() => leaderboard.filter(e => !e.isTeacher), [leaderboard]);
  const mammalTeacherBoard  = useMemo(() => mammalLeaderboard.filter(e => e.isTeacher), [mammalLeaderboard]);
  const mammalStudentBoard  = useMemo(() => mammalLeaderboard.filter(e => !e.isTeacher), [mammalLeaderboard]);
  const myRank       = useMemo(() => leaderboard.findIndex(e => e.uid === user?.uid) + 1, [leaderboard, user]);
  const mammalMyRank = useMemo(() => mammalLeaderboard.findIndex(e => e.uid === user?.uid) + 1, [mammalLeaderboard, user]);

  // FF games lists — read from ffPlaceholders state so banner always shows
  // regardless of whether picks have been applied to the bracket
  const ffGamesList = useMemo(() => {
    return Object.entries(ffPlaceholders).map(([key, slot]) => {
      const [region] = key.split('-');
      return { region, seed: slot.seed, ffTeams: slot.ffTeams, key };
    });
  }, [ffPlaceholders]);

  const mammalFFGamesList = useMemo(() => {
    return Object.entries(mammalFfPlaceholders).map(([key, slot]) => {
      const [region] = key.split('-');
      return { region, seed: slot.seed, ffTeams: slot.ffTeams, key };
    });
  }, [mammalFfPlaceholders]);

  // ── LOAD YEAR + SOURCES ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'tournament', 'config'));
        if (snap.exists()) {
          const d = snap.data();
          if (d.year) { setTournamentYear(d.year); setYearDraft(String(d.year)); }
          if (d.bbRegionNames) setBbRegionNames(d.bbRegionNames);
        }
      } catch {}
      try {
        const bbSnap = await getDoc(doc(db, 'admin', 'bbSources'));
        if (bbSnap.exists() && bbSnap.data().sources) setBbSources(bbSnap.data().sources);
      } catch {}
      try {
        const mmSnap = await getDoc(doc(db, 'admin', 'mammalSources'));
        if (mmSnap.exists() && mmSnap.data().sources) setMammalSources(mmSnap.data().sources);
      } catch {}
    })();
  }, []);

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(() => onAuthStateChanged(auth, async fbUser => {
    if (fbUser) {
      setUser(fbUser);
      // Register user so admin can manage roles
      try { await registerUser(fbUser.uid, fbUser.displayName, fbUser.photoURL, fbUser.email); } catch {}
      const [admin, teacher] = await Promise.all([
        checkIsAdmin(fbUser.uid).catch(() => false),
        checkIsTeacher(fbUser.uid).catch(() => false),
      ]);
      setIsAdmin(admin);
      setIsTeacher(teacher);

      // Load basketball bracket
      try {
        const saved = await loadBracket(fbUser.uid);
        if (saved) {
          if (saved._firstFourPicks) {
            const { _firstFourPicks, ...b } = saved;
            setFirstFourPicks(_firstFourPicks);
            setBracket(applyFirstFourPicks(b, _firstFourPicks));
          } else setBracket(saved);
        }
      } catch (e) { console.warn('Failed to load bracket:', e); }

      // Load mammal region names
      try {
        const rSnap = await getDoc(doc(db, 'admin', 'mammalRoster'));
        if (rSnap.exists() && rSnap.data()._regionNames) setMammalRegionNames(rSnap.data()._regionNames);
      } catch {}

      // Load mammal official bracket first, then user picks
      try {
        const obSnap = await getDoc(doc(db, 'admin', 'officialBracket_mammals'));
        if (obSnap.exists()) {
          const ob = JSON.parse(obSnap.data().bracket);
          const obSample = ob['East']?.rounds?.[0]?.[0]?.top?.name;
          setMammalOfficialBracket(ob);
          const savedMammal = await loadMammalBracket(fbUser.uid).catch(() => null);
          const userSample = savedMammal?.['East']?.rounds?.[0]?.[0]?.top?.name;
          if (savedMammal && (!obSample || userSample === obSample)) {
            if (savedMammal._firstFourPicks) {
              const { _firstFourPicks, ...b } = savedMammal;
              setMammalFirstFourPicks(_firstFourPicks);
              setMammalBracket(applyFirstFourPicks(b, _firstFourPicks));
            } else setMammalBracket(savedMammal);
          } else { setMammalBracket(ob); }
        } else {
          const savedMammal = await loadMammalBracket(fbUser.uid).catch(() => null);
          if (savedMammal) {
            if (savedMammal._firstFourPicks) {
              const { _firstFourPicks, ...b } = savedMammal;
              setMammalFirstFourPicks(_firstFourPicks);
              setMammalBracket(applyFirstFourPicks(b, _firstFourPicks));
            } else setMammalBracket(savedMammal);
          }
        }
      } catch (e) { console.warn('[MMM] error loading:', e); }
    } else {
      setUser(null); setIsAdmin(false); setIsTeacher(false);
      setBracket(buildInitialBracket());
      setMammalBracket(buildInitialBracketFromTeams(makePlaceholderMammalRoster()));
    }
    setAuthLoading(false);
  }), []);

  // ── LIVE SUBSCRIPTIONS ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const u1 = subscribeToOfficialBracket(b => {
      const hasRealTeams = b && ['East','West','South','Midwest'].some(r => b[r]?.rounds?.[0]?.some(g => g?.top?.name && !g.top.name.startsWith('Seed ')));
      setOfficialBracket(hasRealTeams ? b : null);
      if (isAdmin) {
        setBracket(hasRealTeams ? b : buildInitialBracket());
      } else setBracket(prev => {
        const userHasTeams = ['East','West','South','Midwest'].some(r => prev[r]?.rounds?.[0]?.some(g => g?.top?.name && !g.top.name.startsWith('Seed ')));
        return userHasTeams ? prev : (hasRealTeams ? prev : buildInitialBracket());
      });
      // Only populate ffPlaceholders once — never overwrite once set
      if (hasRealTeams) setFfPlaceholders(prev => Object.keys(prev).length > 0 ? prev : extractFFPlaceholders(b));
      // Detect roster mismatch for non-admin users
      if (!isAdmin && hasRealTeams) {
        const officialTeams = new Set(['East','West','South','Midwest'].flatMap(r => b[r]?.rounds?.[0]?.map(g => [g.top?.name, g.bottom?.name]).flat().filter(Boolean) || []));
        setBracket(prev => {
          const userTeams = new Set(['East','West','South','Midwest'].flatMap(r => prev[r]?.rounds?.[0]?.map(g => [g.top?.name, g.bottom?.name]).flat().filter(n => n && !n.startsWith('Seed ') && n !== 'First Four Winner') || []));
          if (userTeams.size > 0 && officialTeams.size > 0) {
            const hasMismatch = [...userTeams].some(t => !officialTeams.has(t));
            if (hasMismatch) setTimeout(() => setRosterMismatch(true), 0);
          }
          return prev;
        });
      }
    });
    const u2 = subscribeToConfig(cfg => {
      setLocked(cfg.locked ?? false);
      if (cfg.year) { setTournamentYear(cfg.year); setYearDraft(String(cfg.year)); }
      if (cfg.bbRegionNames) setBbRegionNames(cfg.bbRegionNames);
    });
    const u3 = subscribeToLeaderboard(setLeaderboard);
    const u4 = subscribeToResearchData(data => {
      setResearchData(data);
      setSelectedTeam(prev => prev && data[prev] ? prev : (Object.keys(data)[0] || null));
    });
    const u5 = subscribeToMammalOfficialBracket(b => {
      if (!b) return;
      setMammalOfficialBracket(b);
      // Only populate mammalFfPlaceholders once — never overwrite once set
      setMammalFfPlaceholders(prev => Object.keys(prev).length > 0 ? prev : extractFFPlaceholders(b));
      if (isAdmin) { setMammalBracket(b); return; }
      setMammalBracket(prev => {
        const officialSample = b['East']?.rounds?.[0]?.[0]?.top?.name;
        const userSample = prev['East']?.rounds?.[0]?.[0]?.top?.name;
        // Detect mammal roster mismatch
        const officialTeams = new Set(['East','West','South','Midwest'].flatMap(r => b[r]?.rounds?.[0]?.map(g => [g.top?.name, g.bottom?.name]).flat().filter(Boolean) || []));
        const userTeams = new Set(['East','West','South','Midwest'].flatMap(r => prev[r]?.rounds?.[0]?.map(g => [g.top?.name, g.bottom?.name]).flat().filter(n => n && !n.startsWith('Seed ') && n !== 'First Four Winner') || []));
        if (userTeams.size > 0 && officialTeams.size > 0) {
          const hasMismatch = [...userTeams].some(t => !officialTeams.has(t));
          if (hasMismatch) setTimeout(() => setMammalRosterMismatch(true), 0);
        }
        return (userSample && officialSample && userSample === officialSample) ? prev : b;
      });
    });
    const u6 = subscribeToMammalConfig(cfg => setMammalLocked(cfg.locked ?? false));
    const u7 = subscribeToMammalLeaderboard(setMammalLeaderboard);
    const u8 = subscribeToMammalResearchData(data => {
      setMammalResearchData(data);
      setMammalSelectedAnimal(prev => {
        // Reset if current selection no longer exists
        if (prev && data[prev]) return prev;
        return Object.keys(data)[0] || null;
      });
    });
    const u9 = isAdmin ? subscribeToAllUsers(setAllUsers) : () => {};
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, [user, isAdmin]);

  // ── LIVE SCORES ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const fetchScores = async () => {
      try {
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard');
        if (!res.ok) return;
        const data = await res.json();
        const scores = {};
        (data.events || []).forEach(event => {
          const status = event.status?.type;
          if (status?.state !== 'in' && status?.state !== 'post') return;
          const comp = event.competitions?.[0];
          if (!comp) return;
          comp.competitors?.forEach(team => {
            const name = team.team?.displayName || team.team?.shortDisplayName || '';
            const opp  = comp.competitors?.find(t => t.id !== team.id);
            scores[name] = { score: parseInt(team.score) || 0, oppScore: parseInt(opp?.score) || 0, period: event.status?.period ?? null, clock: event.status?.displayClock ?? '', state: status?.state, winner: team.winner ?? false };
          });
        });
        setLiveScores(scores);
      } catch {}
    };
    fetchScores();
    const interval = setInterval(fetchScores, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  // ── AUTO-SAVE (basketball) ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (locked && !isAdmin)) return;
    const bracketStr = JSON.stringify(bracket);
    const ffStr      = JSON.stringify(firstFourPicks);
    if (bracketStr === prevBracket.current && ffStr === prevFF.current) return;
    prevBracket.current = bracketStr;
    prevFF.current      = ffStr;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveBracket(user.uid, { ...bracket, _firstFourPicks: firstFourPicks }, user.displayName, user.photoURL);
        // Only update leaderboard if user has made at least one pick
        const hasPicks = ['East','West','South','Midwest'].some(r => bracket[r]?.rounds?.[0]?.some(g => g.winner));
        if (hasPicks) await updateLeaderboardEntry(user.uid, user.displayName, user.photoURL, score, isTeacher);
        setLastSaved(new Date());
      } catch (e) { console.warn('Save failed:', e); }
      setSaving(false);
    }, 3000);
    return () => clearTimeout(saveTimer.current);
  }, [bracket, firstFourPicks, user, locked, isAdmin, score, isTeacher]);

  // ── AUTO-SAVE (mammals) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user || (mammalLocked && !isAdmin)) return;
    const bStr = JSON.stringify(mammalBracket);
    const fStr = JSON.stringify(mammalFirstFourPicks);
    if (bStr === prevMammalBracket.current && fStr === prevMammalFF.current) return;
    prevMammalBracket.current = bStr;
    prevMammalFF.current = fStr;
    clearTimeout(mammalSaveTimer.current);
    mammalSaveTimer.current = setTimeout(async () => {
      try {
        await saveMammalBracket(user.uid, { ...mammalBracket, _firstFourPicks: mammalFirstFourPicks }, user.displayName, user.photoURL);
        const hasMammalPicks = ['East','West','South','Midwest'].some(r => mammalBracket[r]?.rounds?.[0]?.some(g => g.winner));
        if (hasMammalPicks) await updateMammalLeaderboardEntry(user.uid, user.displayName, user.photoURL, mammalScore, isTeacher);
        setMammalLastSaved(new Date());
      } catch (e) { console.warn('Mammal save failed:', e); }
    }, 3000);
    return () => clearTimeout(mammalSaveTimer.current);
  }, [mammalBracket, mammalFirstFourPicks, user, mammalLocked, isAdmin, mammalScore, isTeacher]);

  // ── BRACKET PICK LOGIC ────────────────────────────────────────────────────
  const clearTeamDownstream = useCallback((next, region, teamName, fromRound) => {
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
  }, []);

  const clearMammalDownstream = useCallback((b, reg, teamName, fromRound) => {
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
  }, []);

  const handlePick = useCallback((region, rIdx, gIdx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const game = next[region].rounds[rIdx][gIdx];
      if (!game) return prev;
      if (side === null) {
        if (game.winner) clearTeamDownstream(next, region, game.winner.name, rIdx + 1);
        game.winner = null;
        if (isAdmin) saveOfficialBracket(next).catch(console.warn);
        return next;
      }
      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked || clicked.isFFPlaceholder) return prev;
      if (game.winner?.name === clicked.name) {
        game.winner = null; clearTeamDownstream(next, region, clicked.name, rIdx + 1);
        if (isAdmin) saveOfficialBracket(next).catch(console.warn);
        return next;
      }
      game.winner = clicked;
      const loser = side === 'top' ? game.bottom : game.top;
      if (loser) clearTeamDownstream(next, region, loser.name, rIdx + 1);
      if (rIdx < 3) {
        const ng = next[region].rounds[rIdx + 1][Math.floor(gIdx / 2)];
        const nSide = gIdx % 2 === 0 ? 'top' : 'bottom';
        ng[nSide] = clicked; if (ng.winner?.name !== clicked.name) ng.winner = null;
      }
      if (rIdx === 3) {
        const fi = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
        const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
        next.finalFour[fi][fSide] = clicked; if (next.finalFour[fi].winner?.name !== clicked.name) next.finalFour[fi].winner = null;
      }
      if (isAdmin) saveOfficialBracket(next).catch(console.warn);
      return next;
    });
  }, [locked, isAdmin, clearTeamDownstream]);

  const handleFFPick = useCallback((idx, side) => {
    if (locked && !isAdmin) return;
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ff = next.finalFour[idx];
      const clicked = ff[side];
      if (!clicked) return prev;
      if (ff.winner?.name === clicked.name) {
        ff.winner = null; const cSide = idx === 0 ? 'top' : 'bottom';
        next.championship[cSide] = null; next.championship.winner = null;
        if (isAdmin) saveOfficialBracket(next).catch(console.warn); return next;
      }
      ff.winner = clicked; const cSide = idx === 0 ? 'top' : 'bottom';
      next.championship[cSide] = clicked; if (next.championship.winner?.name !== clicked.name) next.championship.winner = null;
      if (isAdmin) saveOfficialBracket(next).catch(console.warn); return next;
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
      if (isAdmin) saveOfficialBracket(next).catch(console.warn);
      return next;
    });
  }, [locked, isAdmin]);

  const handleChampScore = useCallback((field, val) =>
    setBracket(prev => ({ ...prev, championship: { ...prev.championship, [field]: val } })), []);

  const handleFirstFourPick = useCallback((key, winner, region, seed) => {
    if (locked && !isAdmin) return;
    const isUnpick = firstFourPicks[key] === winner.name;
    setFirstFourPicks(prev => {
      if (prev[key] === winner.name) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: winner.name };
    });
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const r64 = next[region]?.rounds[0];
      if (!r64) return prev;
      r64.forEach(game => {
        ['top','bottom'].forEach(side => {
          const slot = game[side];
          const slotSeed = Number(slot?.seed);
          if (slotSeed === Number(seed)) {
            if (isUnpick) {
              // Clear from round 1 onwards — we handle R64 slot manually below
              clearTeamDownstream(next, region, winner.name, 1);
              const original = ffPlaceholders[key];
              if (original) game[side] = { ...original };
            } else if (slot?.isFFPlaceholder || slot?.name === winner.name) {
              game[side] = { ...winner, isFFPlaceholder: false };
            }
          }
        });
      });
      if (isAdmin) saveOfficialBracket(next).catch(console.warn);
      return next;
    });
  }, [locked, isAdmin, firstFourPicks, ffPlaceholders, clearTeamDownstream]);

  // ── MAMMAL PICK HANDLERS ──────────────────────────────────────────────────
  const handleMammalPick = useCallback((region, rIdx, gIdx, side) => {
    if (mammalLocked && !isAdmin) return;
    setMammalBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const game = next[region]?.rounds?.[rIdx]?.[gIdx];
      if (!game) return prev;
      if (side === null) {
        if (game.winner) clearMammalDownstream(next, region, game.winner.name, rIdx + 1);
        game.winner = null; if (isAdmin) saveMammalOfficialBracket(next).catch(console.warn); return next;
      }
      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked) return prev;
      if (game.winner?.name === clicked.name) {
        game.winner = null; clearMammalDownstream(next, region, clicked.name, rIdx + 1);
        if (isAdmin) saveMammalOfficialBracket(next).catch(console.warn); return next;
      }
      game.winner = clicked;
      const loser = side === 'top' ? game.bottom : game.top;
      if (loser) clearMammalDownstream(next, region, loser.name, rIdx + 1);
      if (rIdx < 3) {
        const ng = next[region].rounds[rIdx + 1]?.[Math.floor(gIdx / 2)];
        if (ng) { const nSide = gIdx % 2 === 0 ? 'top' : 'bottom'; ng[nSide] = clicked; if (ng.winner?.name !== clicked.name) ng.winner = null; }
      }
      if (rIdx === 3) {
        const fi = { East: 0, West: 0, South: 1, Midwest: 1 }[region];
        const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region];
        if (next.finalFour?.[fi]) { next.finalFour[fi][fSide] = clicked; if (next.finalFour[fi].winner?.name !== clicked.name) next.finalFour[fi].winner = null; }
      }
      if (isAdmin) saveMammalOfficialBracket(next).catch(console.warn);
      return next;
    });
  }, [mammalLocked, isAdmin, clearMammalDownstream]);

  const handleMammalFFPick = useCallback((idx, side) => {
    if (mammalLocked && !isAdmin) return;
    setMammalBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ff = next.finalFour[idx]; const clicked = ff[side];
      if (!clicked) return prev;
      if (ff.winner?.name === clicked.name) {
        ff.winner = null; const cSide = idx === 0 ? 'top' : 'bottom';
        next.championship[cSide] = null; next.championship.winner = null;
        if (isAdmin) saveMammalOfficialBracket(next).catch(console.warn); return next;
      }
      ff.winner = clicked; const cSide = idx === 0 ? 'top' : 'bottom';
      next.championship[cSide] = clicked; if (next.championship.winner?.name !== clicked.name) next.championship.winner = null;
      if (isAdmin) saveMammalOfficialBracket(next).catch(console.warn); return next;
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
      if (isAdmin) saveMammalOfficialBracket(next).catch(console.warn);
      return next;
    });
  }, [mammalLocked, isAdmin]);

  const handleMammalFirstFourPick = useCallback((key, winner, region, seed) => {
    if (mammalLocked && !isAdmin) return;
    const isUnpick = mammalFirstFourPicks[key] === winner.name;
    setMammalFirstFourPicks(prev => {
      if (prev[key] === winner.name) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: winner.name };
    });

    const applyPick = (prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const r64 = next[region]?.rounds[0];
      if (!r64) return prev;
      r64.forEach(game => {
        ['top','bottom'].forEach(side => {
          const slot = game[side];
          const slotSeed = Number(slot?.seed);
          if (slotSeed === Number(seed)) {
            if (isUnpick) {
              clearMammalDownstream(next, region, winner.name, 1);
              const original = mammalFfPlaceholders[key];
              if (original) game[side] = { ...original };
            } else if (slot?.isFFPlaceholder || slot?.name === winner.name) {
              game[side] = { ...winner, isFFPlaceholder: false };
            }
          }
        });
      });
      return next;
    };

    setMammalBracket(applyPick);
    if (isAdmin) {
      setMammalOfficialBracket(prev => {
        const next = applyPick(prev || {});
        saveMammalOfficialBracket(next).catch(console.warn);
        return next;
      });
    }
  }, [mammalLocked, isAdmin, mammalFirstFourPicks, mammalFfPlaceholders, clearMammalDownstream]);

  // ── CLEAR ALL PICKS ───────────────────────────────────────────────────────
  const handleClearPicks = useCallback((isMammal) => {
    setConfirmDialog({
      message: `Are you sure you want to clear all your ${isMammal ? 'Mammal Madness' : 'basketball'} picks? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        const stripWinners = (b) => {
          const n = JSON.parse(JSON.stringify(b));
          ['East','West','South','Midwest'].forEach(r => {
            n[r]?.rounds?.forEach(round => round.forEach(g => { g.winner = null; }));
          });
          if (n.finalFour) n.finalFour.forEach(ff => { ff.winner = null; });
          if (n.championship) { n.championship.winner = null; n.championship.scoreTop = ''; n.championship.scoreBottom = ''; }
          return n;
        };
        if (isMammal) {
          const fresh = mammalOfficialBracket ? stripWinners(mammalOfficialBracket) : buildInitialBracketFromTeams(makePlaceholderMammalRoster());
          setMammalBracket(applyFirstFourPicks(fresh, {})); setMammalFirstFourPicks({}); setMammalRosterMismatch(false);
        } else {
          const fresh = officialBracket ? stripWinners(officialBracket) : buildInitialBracket();
          setBracket(applyFirstFourPicks(fresh, {})); setFirstFourPicks({}); setRosterMismatch(false);
        }
      }
    });
  }, [officialBracket, mammalOfficialBracket]);

  // ── SAVE TOURNAMENT YEAR ──────────────────────────────────────────────────
  const handleSaveYear = async () => {
    const yr = parseInt(yearDraft);
    if (!yr || yr < 2000 || yr > 2100) return;
    setYearSaving(true);
    try {
      await setDoc(doc(db, 'tournament', 'config'), { year: yr }, { merge: true });
      setTournamentYear(yr);
    } catch (e) { alert('Failed to save year: ' + e.message); }
    setYearSaving(false);
  };

  // ── SAVE BB REGION NAMES ──────────────────────────────────────────────────
  const handleSaveBbRegionNames = async (names) => {
    setBbRegionNames(names);
    try { await setDoc(doc(db, 'tournament', 'config'), { bbRegionNames: names }, { merge: true }); }
    catch (e) { console.warn('Failed to save bb region names:', e); }
  };

  // ── SAVE SOURCES ──────────────────────────────────────────────────────────
  const handleSaveBbSources = useCallback(async (sources) => {
    setBbSources(sources);
    try { await setDoc(doc(db, 'admin', 'bbSources'), { sources }); }
    catch (e) { console.warn('Failed to save bb sources:', e); }
  }, []);

  const handleSaveMammalSources = useCallback(async (sources) => {
    setMammalSources(sources);
    try { await setDoc(doc(db, 'admin', 'mammalSources'), { sources }); }
    catch (e) { console.warn('Failed to save mammal sources:', e); }
  }, []);

  // ── REMOVE USER ───────────────────────────────────────────────────────────
  const handleRemoveUser = useCallback(async (uid) => {
    setRemovingUser(uid);
    try {
      await Promise.all([
        deleteDoc(doc(db, 'brackets',         uid)).catch(() => {}),
        deleteDoc(doc(db, 'brackets_mammals', uid)).catch(() => {}),
        deleteDoc(doc(db, 'leaderboard',      uid)).catch(() => {}),
        deleteDoc(doc(db, 'leaderboard_mammals', uid)).catch(() => {}),
        deleteDoc(doc(db, 'users',            uid)).catch(() => {}),
      ]);
    } catch (e) { console.warn('Failed to remove user:', e); }
    setRemovingUser(null);
  }, []);

  // ── VIEW USER BRACKET ────────────────────────────────────────────────────
  const handleViewBracket = useCallback(async (uid, displayName, isMammal) => {
    setLoadingBracket(uid + (isMammal ? '-mm' : ''));
    try {
      const snap = await getDoc(doc(db, isMammal ? 'brackets_mammals' : 'brackets', uid));
      if (snap.exists()) {
        const raw = snap.data().bracket;
        const bracket = raw ? JSON.parse(raw) : null;
        if (bracket) setViewingBracket({ uid, displayName, bracket, isMammal });
      }
    } catch (e) { console.warn('Failed to load bracket:', e); }
    setLoadingBracket(null);
  }, []);

  // ── CLEAR BASKETBALL ROSTER ───────────────────────────────────────────────
  const handleClearBbRoster = useCallback(async () => {
    try {
      await Promise.all([
        deleteDoc(doc(db, 'admin', 'teamRoster')).catch(() => {}),
        deleteDoc(doc(db, 'admin', 'officialBracket')).catch(() => {}),
      ]);
      setOfficialBracket(null);
      setBracket(buildInitialBracket());
    } catch (e) { console.warn('Failed to clear bb roster:', e); }
  }, []);

  // ── CLEAR MAMMAL ROSTER ───────────────────────────────────────────────────
  const handleClearMammalRoster = useCallback(async () => {
    try {
      await Promise.all([
        deleteDoc(doc(db, 'admin', 'mammalRoster')).catch(() => {}),
        deleteDoc(doc(db, 'admin', 'officialBracket_mammals')).catch(() => {}),
      ]);
      setMammalOfficialBracket(null);
      setMammalBracket(buildInitialBracketFromTeams(makePlaceholderMammalRoster()));
    } catch (e) { console.warn('Failed to clear mammal roster:', e); }
  }, []);

  // ── CLEAR BASKETBALL RESEARCH ─────────────────────────────────────────────
  const handleClearBbResearch = useCallback(async () => {
    try {
      await deleteDoc(doc(db, 'admin', 'researchData')).catch(() => {});
      setResearchData({});
      setSelectedTeam(null);
    } catch (e) { console.warn('Failed to clear bb research:', e); }
  }, []);

  // ── CLEAR MAMMAL RESEARCH ─────────────────────────────────────────────────
  const handleClearMammalResearch = useCallback(async () => {
    try {
      await deleteDoc(doc(db, 'admin', 'researchData_mammals')).catch(() => {});
      setMammalResearchData({});
      setMammalSelectedAnimal(null);
    } catch (e) { console.warn('Failed to clear mammal research:', e); }
  }, []);

  // ── CLEAR ALL USER BRACKETS ───────────────────────────────────────────────
  const handleClearAllBrackets = useCallback(async (isMammal) => {
    try {
      const colName = isMammal ? 'brackets_mammals' : 'brackets';
      const lbName  = isMammal ? 'leaderboard_mammals' : 'leaderboard';
      const [bracketSnap, lbSnap] = await Promise.all([
        getDocs(collection(db, colName)),
        getDocs(collection(db, lbName)),
      ]);
      await Promise.all([
        ...bracketSnap.docs.map(d => deleteDoc(d.ref)),
        ...lbSnap.docs.map(d => deleteDoc(d.ref)),
      ]);
      if (isMammal) setMammalLeaderboard([]);
      else setLeaderboard([]);
    } catch (e) { console.warn('Failed to clear brackets:', e); }
  }, []);

  // ── FIRESTORE SAVE WITH RETRY (handles ad blocker / network blips) ──────────
  const saveWithRetry = useCallback(async (saveFn, data, label) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { await saveFn(data); return true; }
      catch (e) {
        console.warn('Firestore save failed (' + label + ', attempt ' + (attempt+1) + '):', e.message);
        if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
    console.error('Firestore save permanently failed for ' + label + ' -- data kept in memory only');
    return false;
  }, []);

  // ── GENERATE RESEARCH (per region or all) ────────────────────────────────
  const handleGenerateResearch = useCallback(async (roster, onlyRegion) => {
    const regions = onlyRegion ? [onlyRegion] : ['East','West','South','Midwest'];
    const teams = [];
    regions.forEach(region => {
      (roster[region] || []).forEach(t => { if (!t.firstFour && t.name && !t.name.startsWith('Seed')) teams.push({ name: t.name, seed: t.seed, region }); });
    });
    if (!teams.length) return;
    setGenerating(true); setGenError('');
    setGenProgress({ done: 0, total: teams.length, current: teams[0].name });
    const allData = {};
    try {
      const snap = await getDoc(doc(db, 'admin', 'researchData'));
      if (snap.exists()) Object.assign(allData, snap.data().teams || {});
    } catch {}
    for (let i = 0; i < teams.length; i++) {
      const { name, seed, region } = teams[i];
      setGenProgress({ done: i, total: teams.length, current: name });
      try {
        const espnId = (roster[region] || []).find(t => t.name === name)?.espnId || '';
        const card = await generateResearchForTeam(name, seed, region, espnId, bbSources);
        if (card) {
          allData[name] = { ...card, seed, region };
          await saveWithRetry(saveResearchData, allData, name);
          setResearchData({ ...allData });
        }
      } catch (e) {
        const isDaily = e.message.includes('Daily') || e.message.includes('tomorrow');
        const isConfig = e.message.includes('400') || e.message.includes('invalid_request');
        setGenError(e.message);
        console.warn('Research gen failed:', name, e);
        if (isDaily || isConfig) break; // fatal errors — stop generation
      }
      // 8s between requests = 7.5/min, under 15/min free tier limit
      if (i < teams.length - 1) await new Promise(r => setTimeout(r, 8000));
    }
    setGenProgress(prev => ({ ...prev, done: teams.length, current: '' }));
    setGenerating(false);
    if (Object.keys(allData).length > 0) setSelectedTeam(Object.keys(allData)[0]);
  }, [saveWithRetry, bbSources]);

  // ── GENERATE MAMMAL RESEARCH — Phase 2: fetch images with confirmed Latin names ──
  const handleFetchMammalImages = useCallback(async (reviewedAnimals, allData) => {
    setLatinReview(null);
    setMammalGenerating(true);
    setMammalGenProgress({ done: 0, total: reviewedAnimals.length, current: reviewedAnimals[0]?.name || '' });
    for (let i = 0; i < reviewedAnimals.length; i++) {
      const { name, latinName } = reviewedAnimals[i];
      setMammalGenProgress({ done: i, total: reviewedAnimals.length, current: name });
      try {
        // Call generate.js in image-fetch-only mode
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fetchImagesOnly: true, latinName }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.result && allData[name]) {
            allData[name] = { ...allData[name], ...data.result };
          }
        }
      } catch (e) { console.warn('Image fetch failed for', name, e); }
      // Small delay between image fetches
      if (i < reviewedAnimals.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    // Save everything to Firestore once all images are fetched
    await saveWithRetry(saveMammalResearchData, allData, 'final');
    setMammalResearchData({ ...allData });
    setMammalGenProgress(prev => ({ ...prev, done: reviewedAnimals.length, current: '' }));
    setMammalGenerating(false);
    if (Object.keys(allData).length > 0) { setMammalSelectedAnimal(Object.keys(allData)[0]); setTab('research'); setActiveTournament('mammals'); }
  }, [saveWithRetry]);

  // ── REFETCH MAMMAL IMAGES — uses Latin names already in Firestore ─────────
  const handleRefetchMammalImages = useCallback(async (onlyRegion) => {
    // Load existing research data from Firestore
    const allData = {};
    try {
      const snap = await getDoc(doc(db, 'admin', 'researchData_mammals'));
      if (snap.exists()) Object.assign(allData, snap.data().teams || {});
    } catch {}

    // Filter to the requested region, must have a latinName
    const animals = Object.entries(allData)
      .filter(([, card]) => {
        if (!card.latinName) return false;
        if (onlyRegion && card.region !== onlyRegion) return false;
        return true;
      })
      .map(([name, card]) => ({ name, latinName: card.latinName }));

    if (!animals.length) {
      setMammalGenError('No Latin names found for this region. Generate text content first.');
      return;
    }

    setMammalGenerating(true);
    setMammalGenError('');
    setMammalGenProgress({ done: 0, total: animals.length, current: animals[0].name });

    for (let i = 0; i < animals.length; i++) {
      const { name, latinName } = animals[i];
      setMammalGenProgress({ done: i, total: animals.length, current: name });
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fetchImagesOnly: true, latinName }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.result && allData[name]) {
            allData[name] = { ...allData[name], ...data.result };
            await saveWithRetry(saveMammalResearchData, allData, name);
            // Merge into existing state rather than replacing to avoid stale data
            setMammalResearchData(prev => ({ ...prev, [name]: allData[name] }));
          }
        }
      } catch (e) { console.warn('Image refetch failed for', name, e); }
      if (i < animals.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    setMammalGenProgress(prev => ({ ...prev, done: animals.length, current: '' }));
    setMammalGenerating(false);
  }, [saveWithRetry]);

  // ── GENERATE MAMMAL RESEARCH — Phase 1: generate text + Latin names ──────
  const handleGenerateMammalResearch = useCallback(async (roster, onlyRegion) => {
    const regions = onlyRegion ? [onlyRegion] : ['East','West','South','Midwest'];
    const animals = [];
    regions.forEach(region => {
      (roster[region] || []).forEach(a => { if (!a.firstFour && a.name) animals.push({ name: a.name, seed: a.seed, region }); });
    });
    if (!animals.length) return;
    setMammalGenerating(true); setMammalGenError('');
    setMammalGenProgress({ done: 0, total: animals.length, current: animals[0].name });
    const allData = {};
    try {
      const snap = await getDoc(doc(db, 'admin', 'researchData_mammals'));
      if (snap.exists()) Object.assign(allData, snap.data().teams || {});
    } catch {}

    // Phase 1: generate text content only (no images yet)
    const textOnlyAnimals = [];
    for (let i = 0; i < animals.length; i++) {
      const { name, seed, region } = animals[i];
      setMammalGenProgress({ done: i, total: animals.length, current: name });
      try {
        // Pass textOnly flag so generate.js skips image fetching
        const mmPrompt = `You are a nature educator writing organism profiles for middle school students (grades 6-8).
Generate a fun, age-appropriate JSON profile for: ${name} (${region} Region, Seed #${seed}) competing in March Mammal Madness.
IMPORTANT: First identify the Latin (scientific) name for ${name}. If the provided source materials contain a Latin name for this organism, use that exact Latin name. Otherwise determine it from your knowledge.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"latinName":"Genus species","habitat":"2-3 sentence description of where this organism lives","diet":"2-3 sentences on what it eats and how it hunts or forages","funFacts":["interesting fact 1","interesting fact 2","interesting fact 3"],"size":"weight and length/height","lifespan":"X-Y years","speed":"top speed if known, or movement description","superpower":"1 sentence on this organism's most impressive ability or adaptation","battleStrength":"1-2 sentence fun assessment of how this organism would do in a bracket battle and why"}
Keep all language at a middle school reading level. Make it engaging and educational. No graphic violence descriptions.`;
        const card = await callAI(mmPrompt, mammalSources, true);
        if (card) {
          allData[name] = { ...card, seed, region };
          textOnlyAnimals.push({ name, latinName: card.latinName || name, seed, region });
          // Save text-only data immediately so progress isn't lost
          setMammalResearchData({ ...allData });
        }
      } catch (e) {
        const isDaily = e.message.includes('Daily') || e.message.includes('tomorrow');
        const isConfig = e.message.includes('400') || e.message.includes('invalid_request');
        setMammalGenError(e.message);
        console.warn('Mammal research gen failed:', name, e);
        if (isDaily || isConfig) break;
      }
      if (i < animals.length - 1) await new Promise(r => setTimeout(r, 8000));
    }
    // Phase 1 complete — show Latin name review before fetching images
    setMammalGenProgress(prev => ({ ...prev, done: animals.length, current: '' }));
    setMammalGenerating(false);
    if (textOnlyAnimals.length > 0) {
      // Show review screen — phase 2 (image fetching) happens after confirmation
      setLatinReview({ animals: textOnlyAnimals, allData });
    }
  }, [saveWithRetry, mammalSources]);

  // ── GENERATE ONE MAMMAL ───────────────────────────────────────────────────
  const handleGenerateOneMammal = useCallback(async (animalName) => {
    setMammalGeneratingOne(animalName);
    try {
      // Read seed/region from current state directly
      const currentCard = mammalResearchData[animalName];
      const seed = currentCard?.seed || 1;
      const region = currentCard?.region || '';
      const card = await generateMammalResearch(animalName, seed, region);
      if (card) {
        const updated = { ...card, seed, region };
        await saveOneMammalResearch(animalName, updated);
        setMammalResearchData(prev => ({ ...prev, [animalName]: updated }));
      }
    } catch (e) { console.warn('Failed to generate for', animalName, e); }
    setMammalGeneratingOne(null);
  }, [mammalResearchData]);

  // ── EDIT RESEARCH FIELD ───────────────────────────────────────────────────
  const applyField = (card, path, val) => {
    const out = JSON.parse(JSON.stringify(card || {}));
    const parts = path.split('.');
    let obj = out;
    for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
    obj[parts[parts.length - 1]] = val;
    return out;
  };

  const handleResearchFieldSave = useCallback(async (teamName, fieldPath, value) => {
    setResearchData(prev => {
      const next = { ...prev, [teamName]: applyField(prev[teamName], fieldPath, value) };
      saveOneTeamResearch(teamName, next[teamName]).catch(console.warn);
      return next;
    });
  }, []);

  const handleMammalResearchFieldSave = useCallback(async (animalName, fieldPath, value) => {
    setMammalResearchData(prev => {
      const next = { ...prev, [animalName]: applyField(prev[animalName], fieldPath, value) };
      saveOneMammalResearch(animalName, next[animalName]).catch(console.warn);
      return next;
    });
  }, []);

  const handleTeamsSaved = useCallback((newBracket) => {
    setBracket(newBracket); setOfficialBracket(newBracket);
  }, []);

  // ── LOGIN SCREEN ──────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: ACCENT2, fontSize: 18 }} role="status">Loading...</div>
    </div>
  );

  if (!user) return (
    <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 88, marginBottom: 12 }} role="img" aria-label="Basketball">🏀</div>
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
          <span style={{ fontWeight: 900, marginRight: 8 }} aria-hidden="true">G</span> Sign in with Google
        </button>
      </div>
    </div>
  );

  const tabs = [
    { id: 'bracket',     label: 'Bracket'     },
    { id: 'research',    label: 'Research'    },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'upsetguide',  label: 'Upset Guide' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  // ── BRACKET RENDER HELPER ─────────────────────────────────────────────────
  const renderBracket = (isMammal) => {
    // ── Layout constants ──────────────────────────────────────────────────────
    const CW = 240;           // one column width (1 unit)
    const SH = 89;            // one game slot height (1 unit)
    const FF_SCALE = 1.25;    // Final Four / Championship scale factor
    // A scaled game occupies FF_SCALE× the space of a regular game in layout
    const FF_W = Math.round(CW * FF_SCALE);   // 360px
    const FF_H = Math.round(SH * FF_SCALE);   // 134px
    // The spine must be tall enough to contain the championship box.
    // Champ box content: title row (~30px) + scaled horizontal slot (~FF_H * 0.75) + winner badge (~32px)
    const CHAMP_BOX_H = 30 + Math.round(FF_H * 0.75) + 32 + 20; // ~182px with padding
    const SPINE_H = CHAMP_BOX_H + 16; // add top+bottom padding inside spine bar
    // FF games sit SH/2 (half a unit) from the spine edge
    const FF_GAP = Math.round(SH / 2); // 0.5 unit clearance
    const TOP_H = 8 * SH;   // 712px — height of each bracket half
    const BOT_H = TOP_H;

    const activeBracket        = isMammal ? (isAdmin ? (mammalOfficialBracket || mammalBracket) : mammalBracket) : bracket;
    const regionNames          = isMammal ? mammalRegionNames : bbRegionNames;
    const onPick               = isMammal ? handleMammalPick : handlePick;
    const onFFPick             = isMammal ? handleMammalFFPick : handleFFPick;
    const onChampPick          = isMammal ? handleMammalChampPick : handleChampPick;
    const onFirstFourPick      = isMammal ? handleMammalFirstFourPick : handleFirstFourPick;
    const activeFirstFourPicks = isMammal ? mammalFirstFourPicks : firstFourPicks;
    const isLocked             = isMammal ? mammalLocked : locked;
    const champColor           = isMammal ? 'rgba(134,239,172,0.5)'  : 'rgba(245,158,11,0.65)';
    const champBg              = isMammal ? 'linear-gradient(135deg,rgba(134,239,172,0.15),rgba(22,163,74,0.10))' : 'linear-gradient(135deg,rgba(245,158,11,0.18),rgba(124,58,237,0.14))';
    const champEmoji           = isMammal ? '🦁' : '🏆';
    const champGoldColor       = isMammal ? '#86efac' : GOLD2;



    const ROUND_ABS = [
      [0, 89, 178, 267, 356, 445, 534, 623],
      [44.5, 222.5, 400.5, 578.5],
      [133.5, 489.5],
      [311.5],
    ];

    // ── Scaled game wrapper ───────────────────────────────────────────────────
    // Uses CSS transform:scale so GameSlot internal font/icon sizes scale up
    // while the wrapper reserves the correct FF_W × FF_H layout space.
    const ScaledGame = ({ children, isHoriz }) => {
      // Horizontal championship slot is wider than tall; use FF_W for both axes
      const wrapH = isHoriz ? Math.round(FF_H * 0.72) : FF_H;
      return (
        <div style={{ width: FF_W, height: wrapH, position: 'relative', overflow: 'visible' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: CW,
            transformOrigin: 'top left',
            transform: `scale(${FF_SCALE})`,
          }}>
            {children}
          </div>
        </div>
      );
    };

    // ── Round columns ─────────────────────────────────────────────────────────
    const RoundCol = ({ region, rIdx, flip, dir }) => {
      const games     = activeBracket[region]?.rounds[rIdx] || [];
      const positions = ROUND_ABS[rIdx];
      return (
        <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative', boxSizing: 'border-box' }}>
          {games.map((game, gIdx) => {
            const pos = positions[gIdx] ?? gIdx * SH;
            return (
              <div key={gIdx} style={{ position: 'absolute', left: 0, right: 0, ...(dir === 'top' ? { top: pos } : { bottom: pos }) }}>
                <GameSlot game={game} locked={isLocked && !isAdmin} flipped={flip} roundIdx={rIdx}
                  liveScores={isMammal ? {} : liveScores}
                  onPick={side => onPick(region, rIdx, gIdx, side)}
                  onMatchup={(a, b) => {
                    setResearchMatchup({ teamA: a, teamB: b, label: `${regionNames[region] || region} — ${['R64','R32','S16','E8'][rIdx]}`, isMammal });
                    setTab('research');
                    setActiveTournament(isMammal ? 'mammals' : 'basketball');
                  }} />
              </div>
            );
          })}
        </div>
      );
    };

    // ── Spine cell — 1.5× label font ─────────────────────────────────────────
    const SpineCell = ({ label, sub, color, borderLeft = true }) => (
      <div style={{ width: CW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: borderLeft ? '1px solid rgba(255,255,255,0.08)' : 'none', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ height: SPINE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
          {sub && <div style={{ fontSize: 15, color: '#777', fontStyle: 'italic', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    );

    // Final Four labels using custom region names
    const ff0Label = `Final Four — ${regionNames.East || 'East'} vs. ${regionNames.West || 'West'}`;
    const ff1Label = `Final Four — ${regionNames.South || 'South'} vs. ${regionNames.Midwest || 'Midwest'}`;

    // ── Layout constants (continued) ─────────────────────────────────────────
    // No FF columns in the bracket — FF games only appear in the top banner.
    // Total bracket width is always 4+3+4 columns.
    const TOTAL_W = CW * 11;

    // Region labels sit at the S16/E8 boundary (3 cols from each region's outer edge).
    // East/South: left edge aligned to their E8 left edge  = CW*3 from left
    // West/Midwest: right edge aligned to their E8 right edge = CW*3 from right
    const LEFT_LBL_X  = CW * 3;          // East/South left edge
    const RIGHT_LBL_X = CW * 3;          // West/Midwest right edge (from right)

    const RegionLabel = ({ name, color, isRight, isBottom }) => (
      <div style={{
        position: 'absolute',
        width: CW * 2,
        height: SH * 2,
        ...(isRight  ? { right: RIGHT_LBL_X } : { left: LEFT_LBL_X }),
        ...(isBottom ? { top: 0 }             : { bottom: 0 }),
        display: 'flex',
        alignItems: 'center',
        justifyContent: isRight ? 'flex-end' : 'flex-start',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}>
        <span style={{
          fontSize: labelFontSize(name), fontWeight: 900, color, opacity: 0.18,
          letterSpacing: 2, textTransform: 'uppercase', userSelect: 'none',
          lineHeight: 1, whiteSpace: 'nowrap',
        }}>{name}</span>
      </div>
    );

    // ── Connector lines ───────────────────────────────────────────────────────
    // Single full-width SVG per half, TOTAL_W wide x TOP_H tall.
    // Solid colors, 3px, fully opaque. zIndex: 1 so region labels (zIndex: 0
    // but rendered later in DOM) stay on top — labels use pointer-events:none
    // so this doesn't affect interactivity.
    //
    // Game midpoint y from absolute game position:
    //   GameSlot outer div: padding '8px 8px 0 0'
    //   top team row height: 36px
    //   divider: 1px (midpoint at 0.5px)
    //   → offset = 8 + 36 + 0.5 = 44.5px from game's absolute top
    const GAME_MID_OFFSET     = 50;
    const GAME_MID_OFFSET_BOT = SH - GAME_MID_OFFSET;
    const LINE_COLORS = ['#60a5fa', '#a78bfa', '#fbbf24', '#ef4444']; // R64→R32, R32→S16, S16→E8, E8→FF
    const STUB = CW * 0.45;

    const BracketConnectors = ({ dir }) => {
      const H = TOP_H;
      const lines = [];

      // y-midpoint of a game at absolute position 'pos'
      const getMid = (pos) =>
        dir === 'top'
          ? pos + GAME_MID_OFFSET
          : H - pos - GAME_MID_OFFSET_BOT;

      // ── R64→R32→S16→E8 connectors for one region ─────────────────────────
      // xBase: SVG x of this region's R64 left edge
      // flip: false = East/South (R64 leftmost), true = West/Midwest (R64 rightmost)
      const addRegionLines = (xBase, flip) => {
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const color         = LINE_COLORS[rIdx];
          const fromPositions = ROUND_ABS[rIdx];
          const toPositions   = ROUND_ABS[rIdx + 1];

          // Right edge of 'from' column within SVG coords
          // flip=false: R64 is col 0, R32 is col 1, etc. — right edge = xBase + (rIdx+1)*CW
          // flip=true:  R64 is col 3 from left, R32 is col 2, etc.
          //             right edge of col rIdx (from right) = xBase + (3-rIdx)*CW
          const xFrom   = xBase + (flip ? (3 - rIdx) * CW : (rIdx + 1) * CW);
          const xStub   = flip ? xFrom - STUB : xFrom + STUB;
          const xParent = flip ? xFrom - CW + STUB : xFrom + CW - STUB;

          toPositions.forEach((toPos, tIdx) => {
            const c1 = fromPositions[tIdx * 2];
            const c2 = fromPositions[tIdx * 2 + 1];
            if (c1 == null || c2 == null) return;
            const y1   = getMid(c1);
            const y2   = getMid(c2);
            const yMid = getMid(toPos);
            lines.push(
              <g key={`r-${xBase}-${rIdx}-${tIdx}`} stroke={color} strokeWidth="3" strokeLinecap="round" fill="none">
                <line x1={xFrom}   y1={y1}   x2={xStub}   y2={y1}   />
                <line x1={xFrom}   y1={y2}   x2={xStub}   y2={y2}   />
                <line x1={xStub}   y1={y1}   x2={xStub}   y2={y2}   />
                <line x1={xStub}   y1={yMid} x2={xParent} y2={yMid} />
              </g>
            );
          });
        }
      };

      // ── E8 → Final Four connectors ────────────────────────────────────────
      // The FF game is centered in the CW*3 center column (x = CW*4 to CW*7).
      // FF game visual dimensions (scaled):
      //   FF_W wide, centered → left edge = CW*4 + (CW*3 - FF_W) / 2
      //   FF game sits at bottom of top-half column (paddingBottom: FF_GAP)
      //   → top edge y = TOP_H - FF_GAP - FF_H  (for 'top' dir)
      //   → midpoint y = top edge + GAME_MID_OFFSET
      const ffCenterX  = CW * 4 + (CW * 3) / 2;          // horizontal center of FF game
      const ffLeftEdge  = CW * 4 + (CW * 3 - FF_W) / 2;   // left edge of FF game box
      const ffRightEdge = ffLeftEdge + FF_W;                // right edge

      // FF game top edge y within the half-div
      const ffTopY = dir === 'top'
        ? TOP_H - FF_GAP - FF_H   // bottom-aligned: top edge is this far from top
        : FF_GAP;                  // top-aligned for bottom half

      // Midpoint of FF game's team divider
      const ffMidY = dir === 'top'
        ? ffTopY + GAME_MID_OFFSET
        : ffTopY + GAME_MID_OFFSET;

      // E8 game position: ROUND_ABS[3][0] = 311.5 (single E8 game per region)
      const e8Pos  = ROUND_ABS[3][0];
      const e8MidY = getMid(e8Pos);
      const e8Color = LINE_COLORS[3];

      // East E8 (right edge at x = CW*4) → FF left edge
      const eastE8Right = CW * 4;
      const eastStubX   = eastE8Right + STUB;
      lines.push(
        <g key="e8-ff-east" stroke={e8Color} strokeWidth="3" strokeLinecap="round" fill="none">
          {/* Horizontal stub from E8 right edge */}
          <line x1={eastE8Right} y1={e8MidY}  x2={eastStubX}  y2={e8MidY}  />
          {/* Vertical to FF midpoint y */}
          <line x1={eastStubX}   y1={e8MidY}  x2={eastStubX}  y2={ffMidY}  />
          {/* Horizontal to FF left edge */}
          <line x1={eastStubX}   y1={ffMidY}  x2={ffLeftEdge} y2={ffMidY}  />
        </g>
      );

      // West E8 (left edge at x = CW*7) → FF right edge
      const westE8Left = CW * 7;
      const westStubX  = westE8Left - STUB;
      lines.push(
        <g key="e8-ff-west" stroke={e8Color} strokeWidth="3" strokeLinecap="round" fill="none">
          <line x1={westE8Left}  y1={e8MidY}  x2={westStubX}  y2={e8MidY}  />
          <line x1={westStubX}   y1={e8MidY}  x2={westStubX}  y2={ffMidY}  />
          <line x1={westStubX}   y1={ffMidY}  x2={ffRightEdge} y2={ffMidY} />
        </g>
      );

      // Draw region lines (behind E8→FF lines)
      addRegionLines(0, false);       // East (top) / South (bot)
      addRegionLines(CW * 7, true);   // West (top) / Midwest (bot)

      return (
        <svg
          width={TOTAL_W} height={H}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: -1 }}
          aria-hidden="true"
        >
          {lines}
        </svg>
      );
    };

    // FF games sit FF_GAP below/above the spine in the center column.
    // Center column is TOP_H tall; FF game sits at bottom with FF_GAP padding.
    const FF_CENTER_H = TOP_H; // same height as region columns — no extra space needed

    return (
      <div style={{ width: TOTAL_W }}>

        {/* ── TOP HALF ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', height: TOP_H }}>
          {/* SVG first in DOM so all sibling elements paint on top of it */}
          <BracketConnectors dir="top" />
          <RegionLabel name={regionNames.East || 'East'} color={RC.East} isRight={false} isBottom={false} />
          <RegionLabel name={regionNames.West || 'West'} color={RC.West} isRight={true}  isBottom={false} />

          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="East" rIdx={rIdx} flip={false} dir="top" />)}

          {/* Center — FF[0] game sits FF_GAP above the spine (at bottom of this column) */}
          <div style={{ width: CW * 3, flexShrink: 0, height: FF_CENTER_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: FF_GAP, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff0Label}</div>
              <ScaledGame>
                <GameSlot game={activeBracket.finalFour?.[0]} onPick={s => onFFPick(0, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} />
              </ScaledGame>
            </div>
          </div>

          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="West" rIdx={rIdx} flip={true} dir="top" />)}
        </div>

        {/* ── SPINE ── */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '2px solid rgba(255,255,255,0.15)', borderBottom: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
          <SpineCell label="Round of 64" sub='"First Round"'   color={ROUND_BORDER_COLORS[0]} borderLeft={false} />
          <SpineCell label="Round of 32" sub='"Second Round"'  color={ROUND_BORDER_COLORS[1]} />
          <SpineCell label="Sweet 16"    sub='"Sweet Sixteen"' color={ROUND_BORDER_COLORS[2]} />
          <SpineCell label="Elite Eight" sub='"Elite Eight"'   color={ROUND_BORDER_COLORS[3]} />

          <div style={{ width: CW * 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 16px', background: champBg, border: `2px solid ${champColor}`, borderRadius: 12, animation: 'champGlow 3s ease-in-out infinite', minWidth: FF_W + 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }} aria-hidden="true">{champEmoji}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: champGoldColor, letterSpacing: 1, fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap' }}>Championship</span>
                <span style={{ fontSize: 18 }} aria-hidden="true">{champEmoji}</span>
              </div>
              <ScaledGame isHoriz>
                <GameSlot game={activeBracket.championship} onPick={onChampPick}
                  locked={isLocked && !isAdmin} isChampionship isHorizontal
                  onScoreChange={isMammal ? undefined : handleChampScore}
                  roundIdx={-1} liveScores={isMammal ? {} : liveScores} />
              </ScaledGame>
              {activeBracket.championship?.winner && (
                <div style={{ textAlign: 'center', padding: '4px 14px', background: isMammal ? 'rgba(134,239,172,0.15)' : 'rgba(245,158,11,0.18)', borderRadius: 6, border: `1px solid ${isMammal ? 'rgba(134,239,172,0.4)' : 'rgba(245,158,11,0.5)'}` }}>
                  <div style={{ fontSize: 10, color: champGoldColor, letterSpacing: 1.5 }}>🎉 CHAMPION</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>{activeBracket.championship.winner.name}</div>
                </div>
              )}
            </div>
          </div>

          <SpineCell label="Elite Eight" sub='"Elite Eight"'   color={ROUND_BORDER_COLORS[3]} />
          <SpineCell label="Sweet 16"    sub='"Sweet Sixteen"' color={ROUND_BORDER_COLORS[2]} />
          <SpineCell label="Round of 32" sub='"Second Round"'  color={ROUND_BORDER_COLORS[1]} />
          <SpineCell label="Round of 64" sub='"First Round"'   color={ROUND_BORDER_COLORS[0]} />
        </div>

        {/* ── BOTTOM HALF ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', height: TOP_H }}>
          {/* SVG first in DOM so all sibling elements paint on top of it */}
          <BracketConnectors dir="bot" />
          <RegionLabel name={regionNames.South   || 'South'}   color={RC.South}   isRight={false} isBottom={true} />
          <RegionLabel name={regionNames.Midwest || 'Midwest'} color={RC.Midwest} isRight={true}  isBottom={true} />

          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="South" rIdx={rIdx} flip={false} dir="bot" />)}

          {/* Center — FF[1] game sits FF_GAP below the spine (at top of this column) */}
          <div style={{ width: CW * 3, flexShrink: 0, height: FF_CENTER_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: FF_GAP, position: 'relative' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <ScaledGame>
                <GameSlot game={activeBracket.finalFour?.[1]} onPick={s => onFFPick(1, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} />
              </ScaledGame>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff1Label}</div>
            </div>
          </div>

          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="Midwest" rIdx={rIdx} flip={true} dir="bot" />)}
        </div>

      </div>
    );
  };

  // ── FIRST FOUR PANELL (above bracket, for mobile/overview) ─────────────────
  const renderFirstFourPanel = (isMammal, onMatchup = null) => {
    const activeFF = isMammal ? mammalFFGamesList : ffGamesList;
    const activeFirstFourPicks = isMammal ? mammalFirstFourPicks : firstFourPicks;
    const regionNames = isMammal ? mammalRegionNames : bbRegionNames;
    const onFirstFourPick = isMammal ? handleMammalFirstFourPick : handleFirstFourPick;
    const isLocked = (isMammal ? mammalLocked : locked) && !isAdmin;
    if (!activeFF.length) return null;
    return (
      <div style={{ marginBottom: 20, padding: '16px 18px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', letterSpacing: 2, marginBottom: 2 }}>FIRST FOUR — PLAY-IN GAMES</div>
        <div style={{ fontSize: 11, color: '#777', marginBottom: 14 }}>Pick who wins each play-in game and advances into the main bracket</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {activeFF.map(({ region, seed, ffTeams, key }) => {
            const pick = activeFirstFourPicks[key];
            const canMatchup = onMatchup && ffTeams.length >= 2;
            return (
              <FFGameCard key={key} region={region} seed={seed} ffTeams={ffTeams} pick={pick}
                isLocked={isLocked} onFirstFourPick={onFirstFourPick} keyStr={key}
                regionNames={regionNames} canMatchup={canMatchup} onMatchup={onMatchup} />
            );
          })}

        </div>
      </div>
    );
  };

  // ── SCROLLABLE BRACKET WRAPPER ────────────────────────────────────────────
  const renderScrollBracket = (isMammal, scrollClass) => (
    <>
      <div className={`${scrollClass}-top bscroll-top`} style={{ overflowX: 'auto', overflowY: 'hidden', height: 12, marginBottom: 2 }}
        onScroll={e => { const b = document.querySelector(`.${scrollClass}`); if (b) b.scrollLeft = e.currentTarget.scrollLeft; }}>
        <div style={{ minWidth: `${240 * 11}px`, height: 1 }} />
      </div>
      <div className={`${scrollClass} bscroll`} style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, cursor: 'grab', WebkitOverflowScrolling: 'touch' }}
        onScroll={e => { const t = document.querySelector(`.${scrollClass}-top`); if (t) t.scrollLeft = e.currentTarget.scrollLeft; }}
        onMouseDown={e => {
          const el = e.currentTarget; el.style.cursor = 'grabbing';
          const startX = e.pageX - el.offsetLeft, startScroll = el.scrollLeft;
          const onMove = mv => { el.scrollLeft = startScroll - (mv.pageX - el.offsetLeft - startX); };
          const onUp = () => { el.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        }}>
        <div style={{ display: 'inline-block', paddingBottom: 8 }}>
          {renderBracket(isMammal)}
        </div>
      </div>
    </>
  );

  // ── SCORE BAR ─────────────────────────────────────────────────────────────
  const renderScoreBar = (isMammal) => {
    const s = isMammal ? mammalScore : score;
    const rank = isMammal ? mammalMyRank : myRank;
    const board = isMammal ? mammalLeaderboard : leaderboard;
    const isLocked = isMammal ? mammalLocked : locked;
    const color = isMammal ? '#86efac' : ACCENT2;
    const borderColor = isMammal ? 'rgba(134,239,172,0.25)' : undefined;
    return (
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14, ...(borderColor ? { borderColor } : {}) }}>
        <div>
          <div style={{ fontSize: 11, color: '#777', letterSpacing: 1, textTransform: 'uppercase' }}>{isMammal ? 'Your Mammal Score' : 'Your Score'}</div>
          <div style={{ fontSize: 38, fontWeight: 700, color, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
            {s} <span style={{ fontSize: 14, color: '#888' }}>/ 1,920 pts</span>
          </div>
          {!isMammal && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>ESPN scoring (max 1,920)</div>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: isLocked ? '#e74c3c' : '#22c55e', marginBottom: 6 }}>
            {isLocked ? '🔒 Brackets Locked' : '🟢 Picks Open'}
          </div>
          {isAdmin && (
            <button style={{ ...S.btn(isLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 12, padding: '6px 16px' }}
              aria-label={isLocked ? 'Unlock brackets' : 'Lock all brackets'}
              onClick={() => setConfirmDialog({
                message: `Are you sure you want to ${isLocked ? 'unlock' : 'lock'} all ${isMammal ? 'Mammal Madness' : 'basketball'} brackets?`,
                onConfirm: async () => {
                  setConfirmDialog(null);
                  const nl = !isLocked;
                  if (isMammal) { setMammalLocked(nl); await setMammalTournamentLocked(nl); }
                  else { setLocked(nl); await setTournamentLocked(nl); }
                }
              })}>
              {isLocked ? 'Unlock Brackets' : 'Lock All Brackets'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#777' }}>School Rank</div>
            <div style={{ fontSize: 34, fontWeight: 700, color, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>
              {rank > 0 ? `#${rank}` : '-'}
            </div>
            <div style={{ fontSize: 11, color: '#888' }}>of {board.length || '-'} entries</div>
          </div>
          <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), padding: '5px 14px', fontSize: 11 }}
            aria-label="Clear all picks" onClick={() => handleClearPicks(isMammal)}>
            Clear Picks
          </button>
          {saving
            ? <span style={{ fontSize: 11, color: '#777' }}>Saving...</span>
            : (isMammal ? mammalLastSaved : lastSaved) && <span style={{ fontSize: 11, color: '#166534' }}>✓ Saved</span>}
        </div>
      </div>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
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
          @keyframes champGlow { 0%,100%{box-shadow:0 0 24px rgba(245,158,11,0.3)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.6)} }
          @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
          .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
          :focus-visible { outline: 2px solid #4ade80; outline-offset: 2px; }
          @media (max-width: 600px) {
            .bracket-tab-padding { padding: 10px !important; }
            .score-bar-font { font-size: 28px !important; }
            .research-grid { grid-template-columns: 1fr !important; }
            .research-card-header { font-size: 20px !important; }
            .leaderboard-container { padding: 12px !important; }
          }
        `}</style>

        <OfflineBar />

        {confirmDialog && (
          <ConfirmDialog
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
        {latinReview && (
          <LatinNameReviewModal
            review={latinReview}
            onConfirm={handleFetchMammalImages}
            onCancel={() => setLatinReview(null)}
          />
        )}
        {viewingBracket && (
          <ViewBracketModal data={viewingBracket} onClose={() => setViewingBracket(null)} />
        )}

        <header style={S.header}>
          <div style={S.logo}>🏀 MARCH MADNESS {tournamentYear}</div>
          <nav style={{ display: 'flex', gap: 4 }} role="navigation" aria-label="Main navigation">
            {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</button>)}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user.photoURL && <img src={user.photoURL} alt={`${user.displayName} avatar`} width={28} height={28} style={{ borderRadius: '50%' }} />}
            <span style={{ fontSize: 13, color: '#888' }}>{user.displayName?.split(' ')[0]}</span>
            {isTeacher && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: GOLD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
            <button onClick={logOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }} aria-label="Sign out">Sign out</button>
          </div>
        </header>

        <main style={{ paddingBottom: 60 }}>

          {/* ══ BRACKET TAB ══ */}
          {tab === 'bracket' && (
            <div style={{ padding: 20 }} className="bracket-tab-padding">
              {/* Tournament Switcher */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}
                role="tablist" aria-label="Tournament selector">
                <button role="tab" aria-selected={activeTournament === 'basketball'} onClick={() => setActiveTournament('basketball')}
                  style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>
                  🏀 Basketball
                </button>
                <button role="tab" aria-selected={activeTournament === 'mammals'} onClick={() => setActiveTournament('mammals')}
                  style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>
                  🦁 Mammal Madness
                </button>
              </div>

              {activeTournament === 'basketball' && (
                <>
                  {renderScoreBar(false)}
                  {rosterMismatch && !isAdmin && (
                    <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: GOLD2, marginBottom: 2 }}>⚠️ Roster Updated</div>
                        <div style={{ fontSize: 12, color: '#aaa' }}>The team roster has changed since you last saved. Use "Clear Picks" to reset to the new bracket.</div>
                      </div>
                      <button style={{ ...S.btn('#92400e', GOLD2), padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={() => handleClearPicks(false)}>Clear Picks</button>
                    </div>
                  )}
                  {renderScrollBracket(false, 'bscroll-bb')}
                  {renderFirstFourPanel(false, (a, b) => { setResearchMatchup({ teamA: a, teamB: b, label: 'First Four Play-in', isMammal: false }); setTab('research'); setActiveTournament('basketball'); })}
                </>
              )}

              {activeTournament === 'mammals' && (
                <>
                  {renderScoreBar(true)}
                  {/* Show generating indicator on bracket tab too */}
                  {mammalGenerating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.3)' }} role="status" aria-live="polite">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#86efac', fontSize: 13 }}>⏳ Generating animal facts in background... ({mammalGenProgress.done}/{mammalGenProgress.total})</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', background: '#86efac', borderRadius: 2, width: `${mammalGenProgress.total ? (mammalGenProgress.done / mammalGenProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                  {renderScrollBracket(true, 'bscroll-mm')}
                  {renderFirstFourPanel(true, (a, b) => { setResearchMatchup({ teamA: a, teamB: b, label: 'First Four Play-in', isMammal: true }); setTab('research'); setActiveTournament('mammals'); })}
                </>
              )}
            </div>
          )}

          {/* ══ RESEARCH TAB ══ */}
          {tab === 'research' && (
            <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}
                role="tablist" aria-label="Research tournament selector">
                <button role="tab" aria-selected={activeTournament === 'basketball'} onClick={() => { setActiveTournament('basketball'); setResearchMatchup(null); }}
                  style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>🏀 Basketball</button>
                <button role="tab" aria-selected={activeTournament === 'mammals'} onClick={() => { setActiveTournament('mammals'); setResearchMatchup(null); }}
                  style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>🦁 Mammal Madness</button>
              </div>

              {/* Matchup view */}
              {researchMatchup && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
                    <button onClick={() => setResearchMatchup(null)}
                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 14px', color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ← Back to Browse
                    </button>
                    <span style={{ fontSize: 13, color: '#ccc', fontWeight: 600 }}>{researchMatchup.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0, alignItems: 'start' }}>
                    <div style={{ borderRadius: '12px 0 0 12px', border: '1px solid rgba(99,102,241,0.3)', overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.05))', padding: '10px 16px', borderBottom: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#a5b4fc', fontFamily: "'Playfair Display', serif" }}>{researchMatchup.teamA}</span>
                      </div>
                      <div style={{ padding: 16 }}>
                        {researchMatchup.isMammal
                          ? (mammalResearchData[researchMatchup.teamA] ? <MammalResearchCard animalName={researchMatchup.teamA} card={mammalResearchData[researchMatchup.teamA]} isAdmin={false} onGenerate={() => {}} generating={false} /> : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No animal data yet</div>)
                          : (researchData[researchMatchup.teamA] ? <ResearchCard teamName={researchMatchup.teamA} card={researchData[researchMatchup.teamA]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} /> : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No research data yet</div>)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 12px', alignSelf: 'stretch', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#444', letterSpacing: 2 }} aria-hidden="true">VS</div>
                    </div>
                    <div style={{ borderRadius: '0 12px 12px 0', border: '1px solid rgba(251,146,60,0.3)', overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(135deg,rgba(251,146,60,0.2),rgba(251,146,60,0.05))', padding: '10px 16px', borderBottom: '1px solid rgba(251,146,60,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: '#fdba74', fontFamily: "'Playfair Display', serif" }}>{researchMatchup.teamB}</span>
                      </div>
                      <div style={{ padding: 16 }}>
                        {researchMatchup.isMammal
                          ? (mammalResearchData[researchMatchup.teamB] ? <MammalResearchCard animalName={researchMatchup.teamB} card={mammalResearchData[researchMatchup.teamB]} isAdmin={false} onGenerate={() => {}} generating={false} /> : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No animal data yet</div>)
                          : (researchData[researchMatchup.teamB] ? <ResearchCard teamName={researchMatchup.teamB} card={researchData[researchMatchup.teamB]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} /> : <div style={{ padding: 32, textAlign: 'center', color: '#555', fontSize: 13 }}>No research data yet</div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!researchMatchup && activeTournament === 'basketball' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 6 }}>Team Research Hub</h2>
                  {generating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.4)' }} role="status" aria-live="polite">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#6366f1', fontSize: 14, fontWeight: 700 }}>Generating research data...</span>
                        <span style={{ color: '#888', fontSize: 13 }}>{genProgress.done} / {genProgress.total}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', background: '#6366f1', borderRadius: 3, width: `${genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>Currently fetching: {genProgress.current}</div>
                    </div>
                  )}
                  {genError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }} role="alert">⚠️ {genError}</div>}
                  {isAdmin && <p style={{ color: '#777', fontSize: 13, marginBottom: 16 }}>As admin, click any field to edit it directly.</p>}
                  {allTeamNames.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777' }}>
                      <div style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">📊</div>
                      <div style={{ fontSize: 16, marginBottom: 8 }}>No research data yet</div>
                      <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin → 🏀 Basketball → Generate Facts' : 'Check back after the admin generates research'}</div>
                    </div>
                  ) : (
                    <>
                      {ffTeamNames.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: '#818cf8', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>First Four Play-in Teams</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="list">
                            {ffTeamNames.map(t => (
                              <button key={t} role="listitem" style={{ ...S.btn(selectedTeam === t ? '#6366f1' : 'rgba(99,102,241,0.1)', selectedTeam === t ? '#fff' : '#a5b4fc'), padding: '7px 16px', fontSize: 13, border: '1px solid rgba(99,102,241,0.3)' }}
                                aria-pressed={selectedTeam === t} onClick={() => setSelectedTeam(t)}>{t}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }} role="list" aria-label="Team list">
                        {allTeamNames.map(t => (
                          <button key={t} role="listitem" style={{ ...S.btn(selectedTeam === t ? ACCENT : 'rgba(255,255,255,0.05)', selectedTeam === t ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }}
                            aria-pressed={selectedTeam === t} onClick={() => setSelectedTeam(t)}>{t}</button>
                        ))}
                      </div>
                      {selectedTeam && <ResearchCard teamName={selectedTeam} card={researchData[selectedTeam]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />}
                    </>
                  )}
                </>
              )}

              {!researchMatchup && activeTournament === 'mammals' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#86efac', marginBottom: 6 }}>🦁 Animal Research Hub</h2>
                  {mammalGenerating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.3)' }} role="status" aria-live="polite">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#86efac', fontSize: 14, fontWeight: 700 }}>Generating animal facts...</span>
                        <span style={{ color: '#888', fontSize: 13 }}>{mammalGenProgress.done} / {mammalGenProgress.total}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', background: '#86efac', borderRadius: 3, width: `${mammalGenProgress.total ? (mammalGenProgress.done / mammalGenProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>Currently generating: {mammalGenProgress.current}</div>
                    </div>
                  )}
                  {mammalGenError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }} role="alert">⚠️ {mammalGenError}</div>}
                  {isAdmin && <p style={{ color: '#777', fontSize: 13, marginBottom: 16 }}>As admin, click "Generate Facts" on any animal card to auto-populate it.</p>}
                  {allAnimalNames.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777', borderColor: 'rgba(134,239,172,0.15)' }}>
                      <div style={{ fontSize: 40, marginBottom: 16 }} aria-hidden="true">🦁</div>
                      <div style={{ fontSize: 16, marginBottom: 8 }}>No animal data yet</div>
                      <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin → Mammal Madness → Auto-Generate Animal Facts' : 'Check back after the admin sets up the animals'}</div>
                    </div>
                  ) : (
                    <>
                      {mammalFfTeamNames.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: '#818cf8', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>First Four Play-in Organisms</div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="list">
                            {mammalFfTeamNames.map(a => (
                              <button key={a} role="listitem" style={{ ...S.btn(mammalSelectedAnimal === a ? '#6366f1' : 'rgba(99,102,241,0.1)', mammalSelectedAnimal === a ? '#fff' : '#a5b4fc'), padding: '7px 16px', fontSize: 13, border: '1px solid rgba(99,102,241,0.3)' }}
                                aria-pressed={mammalSelectedAnimal === a} onClick={() => setMammalSelectedAnimal(a)}>{a}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }} role="list" aria-label="Animal list">
                        {allAnimalNames.map(a => (
                          <button key={a} role="listitem" style={{ ...S.btn(mammalSelectedAnimal === a ? '#16a34a' : 'rgba(255,255,255,0.05)', mammalSelectedAnimal === a ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }}
                            aria-pressed={mammalSelectedAnimal === a} onClick={() => setMammalSelectedAnimal(a)}>{a}</button>
                        ))}
                      </div>
                      {mammalSelectedAnimal && (
                        <MammalResearchCard
                          animalName={mammalSelectedAnimal}
                          card={mammalResearchData[mammalSelectedAnimal]}
                          isAdmin={isAdmin}
                          onFieldSave={handleMammalResearchFieldSave}
                          generating={mammalGeneratingOne === mammalSelectedAnimal}
                          onGenerate={handleGenerateOneMammal}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ UPSET GUIDE TAB ══ */}
          {tab === 'upsetguide' && (
            <div style={{ padding: 24, maxWidth: 860, margin: '0 auto' }}>
              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 8, fontSize: 28 }}>🎯 Upset Guide</h2>
                <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
                  This guide uses data from the past 10 NCAA Tournaments to help you make smarter bracket picks.
                  It looks at patterns in how teams have performed to find clues about who might pull off a surprise win — called an <strong style={{ color: ACCENT2 }}>upset</strong>.
                </p>
                <div style={{ padding: '12px 16px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 10, fontSize: 13, color: '#aaa', lineHeight: 1.7 }}>
                  <strong style={{ color: ACCENT2 }}>How to read fractions in this guide:</strong> When you see something like <strong style={{ color: '#fff' }}>8/10 = 0.80</strong>, it means 8 out of 10 times (80% of the time) that thing happened. The decimal is just another way to write the same number — 8 ÷ 10 = 0.80.
                </div>
              </div>

              {/* Glossary */}
              <div style={{ ...S.card, marginBottom: 24, borderColor: 'rgba(99,102,241,0.3)' }}>
                <h3 style={{ color: '#a5b4fc', marginBottom: 12 }}>📖 Stat Glossary</h3>
                <p style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>These are the stats you'll see referenced throughout this guide. You don't need to memorize them — just use this as a reference.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['AdjOE', 'Adjusted Offensive Efficiency — how many points a team scores per 100 possessions, adjusted for opponent strength. Higher ranking = better offense.'],
                    ['AdjDE', 'Adjusted Defensive Efficiency — how many points a team gives up per 100 possessions. Higher ranking = better defense.'],
                    ['EFG%', 'Effective Field Goal % — shooting percentage that gives extra credit for 3-pointers. Higher ranking = better shooting.'],
                    ['EFGD%', 'Opponent Effective Field Goal % — how well a team limits opponent shooting. Higher ranking = better at stopping opponent shots.'],
                    ['TOR', 'Turnover Rate — how often a team turns the ball over. Higher ranking = fewer turnovers (good).'],
                    ['TORD', 'Opponent Turnover Rate — how often a team forces opponent turnovers. Higher ranking = forces more turnovers (good).'],
                    ['ORB', 'Offensive Rebound % — how often a team grabs its own missed shots. Higher ranking = better offensive rebounding.'],
                    ['DRB', 'Defensive Rebound % — how often a team grabs opponent missed shots. Higher ranking = better defensive rebounding.'],
                    ['3P%', '3-Point % — how well a team shoots from 3-point range. Higher ranking = better 3-point shooting.'],
                    ['3PRD', 'Opponent 3-Point Rate — how often opponents shoot 3s against this team. Higher ranking = allows fewer 3-point attempts.'],
                    ['Tempo', 'How fast a team plays (possessions per game). A low tempo = slow pace = fewer total possessions in the game.'],
                    ['BARTHAG', 'Overall power rating — basically how good a team is overall. Like a grade for the whole team.'],
                    ['Coach S16', 'How many times a coach has reached the Sweet 16 before. More experience can matter in big moments.'],
                  ].map(([abbr, def]) => (
                    <div key={abbr} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 2 }}>{abbr}</div>
                      <div style={{ fontSize: 11, color: '#777', lineHeight: 1.5 }}>{def}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Idea Box */}
              <div style={{ ...S.card, marginBottom: 24, borderColor: 'rgba(245,158,11,0.3)' }}>
                <h3 style={{ color: GOLD2, marginBottom: 10 }}>💡 The Big Idea: Why Do Upsets Happen?</h3>
                <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.8 }}>
                  Think of it this way: if a 1 seed and a 16 seed played 1,000 games against each other, the 1 seed would almost certainly win most of them. But in a real tournament, they only play <strong style={{ color: GOLD2 }}>once</strong>. That one game can go wrong for anyone.
                </p>
                <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.8, marginTop: 8 }}>
                  Upsets are more likely when:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {[
                    ['🐢 Slow pace', 'Fewer total possessions = more variance = underdogs need fewer lucky plays to win'],
                    ['🎯 3-point shooting', 'A hot shooting night from deep can erase a talent gap fast'],
                    ['🔄 Turnover battles', 'If the underdog forces turnovers, they can control more possessions than expected'],
                    ['🎓 Experienced coaches', "Coaches who've been here before tend to keep their teams calm under pressure"],
                  ].map(([icon, text]) => (
                    <div key={icon} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.15)' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon.split(' ')[0]}</span>
                      <div>
                        <span style={{ color: GOLD2, fontWeight: 700, fontSize: 13 }}>{icon.split(' ').slice(1).join(' ')}: </span>
                        <span style={{ color: '#aaa', fontSize: 13 }}>{text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Round by Round */}
              <h3 style={{ color: ACCENT2, fontFamily: "'Playfair Display', serif", marginBottom: 16, fontSize: 20 }}>🏀 First Round Matchup Guide</h3>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                For each matchup below, we show what the data says about when upsets happen. The fractions show how often each scenario led to the favorite winning over the past 10 tournaments.
              </p>

              {[
                {
                  matchup: '1 vs. 16',
                  record: '38/40 = 0.95',
                  recordNote: '1 seeds win 38 out of 40 times (95% of the time)',
                  color: '#ef4444',
                  scenarios: [
                    { label: 'Watch out if the 1 seed plays very slowly', detail: "When the 1 seed's tempo ranks outside the top 300 (super slow), the 1 seed is only 8/10 = 0.80. Otherwise they're 30/30 = 1.00.", tip: 'A slow game gives the underdog more chances for lucky plays.' },
                    { label: 'Watch out if the 16 seed is great at turnovers', detail: 'When the 16 seed has both TOR and TORD ranked in the top 70, the 1 seed is only 1/3 = 0.33. Otherwise 37/37 = 1.00.', tip: 'This year: No matchups meet either scenario. Safe to pick all 1 seeds.' },
                  ],
                  thisYear: 'No matchups meet either upset scenario this year. All 1 seeds look safe.',
                },
                {
                  matchup: '2 vs. 15',
                  record: '36/40 = 0.90',
                  recordNote: '2 seeds win 36 out of 40 times (90% of the time)',
                  color: '#f97316',
                  scenarios: [
                    { label: 'Watch out if the 2 seed has weak defense', detail: "When the 2 seed's AdjDE ranks outside the top 25, they're only 10/14 = 0.71. With top-25 defense, they're 26/26 = 1.00.", tip: 'Even favorites lose more when their defense is shaky.' },
                    { label: 'Watch out if the 15 seed shoots inside well AND limits 3s', detail: "When the 15 seed's 2P%D and 3PRD are both in the top 140, the 2 seed is 13/17 = 0.76. Otherwise 23/23 = 1.00.', tip: 'This year: Purdue meets the first scenario. Idaho meets the second. They don't play each other though." },
                  ],
                  thisYear: "Purdue has weaker defense. Idaho has solid defensive stats. They don't play each other so no perfect upset scenario.",
                },
                {
                  matchup: '3 vs. 14',
                  record: '35/40 = 0.875',
                  recordNote: '3 seeds win 35 out of 40 times (87.5% of the time)',
                  color: '#eab308',
                  scenarios: [
                    { label: 'Watch out if the 3 seed turns it over a lot', detail: "When the 3 seed's TOR ranks outside the top 200, they're only 5/8 = 0.625. Otherwise 30/32 = 0.94.", tip: 'Turnovers give underdogs extra possessions — free chances to score.' },
                    { label: 'Watch out if the 14 seed forces LOTS of turnovers', detail: "When the 14 seed's TORD is in the top 25, the 3 seed is only 1/4 = 0.25. Otherwise 34/36 = 0.94.", tip: 'This year: Michigan State meets the first scenario. North Dakota St. has the best TORD of all 14 seeds (ranked 59th).' },
                  ],
                  thisYear: 'Michigan State turns it over a lot (scenario 1). North Dakota St. forces turnovers well. This could be an upset worth considering.',
                },
                {
                  matchup: '4 vs. 13',
                  record: '32/40 = 0.80',
                  recordNote: '4 seeds win 32 out of 40 times (80% of the time)',
                  color: '#22c55e',
                  scenarios: [
                    { label: 'Watch out if the 4 seed plays slowly', detail: "When the 4 seed's tempo ranks outside the top 250, they're only 5/9 = 0.56. Otherwise 27/31 = 0.87.", tip: 'Slow pace again — fewer possessions means more unpredictable outcomes.' },
                    { label: 'Watch out if the 13 seed shoots really well', detail: "When the 13 seed's EFG% is in the top 40, the 4 seed is 13/18 = 0.72. Otherwise 19/22 = 0.86.", tip: 'This year: No teams meet either scenario. 4 seeds look safe.' },
                  ],
                  thisYear: 'No 13 seeds meet the upset criteria this year. 4 seeds look relatively safe.',
                },
                {
                  matchup: '5 vs. 12',
                  record: '27/40 = 0.675',
                  recordNote: '5 seeds win 27 out of 40 times (67.5% of the time) — this is the most common first-round upset!',
                  color: '#06b6d4',
                  scenarios: [
                    { label: "Watch out if the 5 seed can't force turnovers", detail: "When the 5 seed's TORD ranks outside the top 175, they're only 9/16 = 0.56. Otherwise 18/24 = 0.75.", tip: "A 5 seed that can't create turnovers gives the 12 seed more chances." },
                    { label: "Watch out if the 12 seed has great shot defense", detail: "When the 12 seed's EFGD% is in the top 50, the 5 seed is only 8/17 = 0.47 — basically a coin flip! Otherwise 19/23 = 0.83.", tip: 'This year: Wisconsin and Texas Tech meet scenario 1. Northern Iowa meets scenario 2. None play each other directly.' },
                  ],
                  thisYear: '5 vs 12 is the most popular upset pick every year. Wisconsin has the worst TORD of all 5 seeds (ranked 324th) AND the weakest BARTHAG of all 5 seeds. Worth considering.',
                },
                {
                  matchup: '6 vs. 11',
                  record: '19/40 = 0.475',
                  recordNote: '6 seeds actually LOSE more than they win! Only 19 out of 40 times (47.5%) do 6 seeds win.',
                  color: '#8b5cf6',
                  scenarios: [
                    { label: 'Watch out if the 6 seed turns it over a lot', detail: "When the 6 seed's TOR ranks outside the top 140, they're only 3/12 = 0.25. Otherwise 16/28 = 0.57.", tip: 'At this seed, even a small weakness gets punished.' },
                    { label: "Watch out if the 11 seed's coach has more experience", detail: "When the 11 seed's coach has at least as many Sweet 16 appearances as the 6 seed's coach, the 6 seed is only 7/25 = 0.28. Otherwise 12/15 = 0.80.", tip: 'This year: Louisville and Tennessee meet scenario 1. South Florida, Texas, and NC State meet scenario 2. Louisville vs. South Florida looks like a great upset pick.' },
                  ],
                  thisYear: "Louisville vs. South Florida: Louisville has turnover issues AND South Florida's coach has more experience. When both happen, 6 seeds are 1/8 = 0.125. Strong upset pick.",
                },
                {
                  matchup: '7 vs. 10',
                  record: '25/40 = 0.625',
                  recordNote: '7 seeds win 25 out of 40 times (62.5% of the time)',
                  color: '#ec4899',
                  scenarios: [
                    { label: 'Watch out if the 7 seed shoots poorly', detail: "When the 7 seed's EFG% ranks outside the top 120, they're only 7/16 = 0.44. Otherwise 18/24 = 0.75.", tip: 'Struggling to shoot efficiently is a red flag for any favorite.' },
                    { label: 'Watch out if the 10 seed has elite defense', detail: "When the 10 seed's AdjDE is in the top 30, the 7 seed is only 4/13 = 0.31. Otherwise 21/27 = 0.78.", tip: "This year: No teams meet either scenario. Texas A&M and Saint Mary's are each the closest to their scenarios." },
                  ],
                  thisYear: "No perfect upset scenarios, but Texas A&M vs. Saint Mary's could be interesting. Neither team looks dominant.",
                },
                {
                  matchup: '8 vs. 9',
                  record: '18/40 = 0.45',
                  recordNote: '8 seeds actually lose more than they win! Only 18 out of 40 (45%). This is basically a coin flip.',
                  color: '#14b8a6',
                  scenarios: [
                    { label: 'Watch out if the 9 seed plays slower', detail: 'When the 9 seed plays with a slower tempo than the 8 seed, the 8 seed is only 5/21 = 0.24! Otherwise 13/19 = 0.68.', tip: 'Slower tempo favors the underdog in close matchups.' },
                    { label: "Watch out if the 9 seed's coach has more Sweet 16s", detail: "When the 9 seed's coach has been to more Sweet 16s, the 8 seed is only 5/19 = 0.26. Otherwise 13/21 = 0.62.", tip: 'This year: Clemson/Iowa and Georgia/Saint Louis meet scenario 1. Ohio State/TCU meets scenario 2.' },
                  ],
                  thisYear: 'Three toss-up matchups this year. Villanova looks like the safest 8 seed. The other three matchups are genuinely hard to call.',
                },
              ].map(({ matchup, record, recordNote, color, scenarios, thisYear }) => (
                <div key={matchup} style={{ ...S.card, marginBottom: 20, borderColor: `${color}44` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ background: color, color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 16, fontWeight: 800, fontFamily: "'Playfair Display', serif", flexShrink: 0 }}>
                      {matchup}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{record}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{recordNote}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {scenarios.map((s, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: color, marginBottom: 4 }}>⚠️ {s.label}</div>
                        <div style={{ fontSize: 13, color: '#ccc', marginBottom: 4 }}>{s.detail}</div>
                        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>💡 {s.tip}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 14px', background: `${color}15`, borderRadius: 8, border: `1px solid ${color}33`, fontSize: 13, color: '#ccc', lineHeight: 1.6 }}>
                    <strong style={{ color }}>This year: </strong>{thisYear}
                  </div>
                </div>
              ))}

              {/* General Metrics */}
              <h3 style={{ color: ACCENT2, fontFamily: "'Playfair Display', serif", marginBottom: 16, marginTop: 32, fontSize: 20 }}>📊 General Patterns by Seed Group</h3>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                These are the stats that most often separate winners from losers in each seed group. Average rankings are out of ~360 teams.
                <strong style={{ color: ACCENT2 }}> Lower number = better rank</strong> (1st is best, 360th is worst).
              </p>

              {[
                {
                  title: '1–4 Seeds: What Keeps Favorites Safe',
                  color: '#ef4444',
                  description: 'Higher-seeded favorites tend to survive when they have these qualities. Watch out for 1-4 seeds that are weak in these areas.',
                  metrics: [
                    { name: 'AdjDE (Defense)', winners: '25th', losers: '41st', note: 'Good defense protects leads' },
                    { name: 'TORD (Force turnovers)', winners: '155th', losers: '214th', note: 'Disrupting opponents matters' },
                    { name: '3P%D (Limit opponent 3s)', winners: '87th', losers: '102nd', note: 'Underdogs love 3-point shooting' },
                    { name: 'Tempo (Game speed)', winners: '154th', losers: '196th', note: 'Faster pace benefits favorites' },
                  ],
                  best: [['1 seed', 'Michigan'], ['2 seed', 'Iowa State'], ['3 seed', 'Gonzaga'], ['4 seed', 'Nebraska']],
                  worst: [['1 seed', 'Florida'], ['2 seed', 'Purdue'], ['3 seed', 'Illinois'], ['4 seed', 'Alabama']],
                },
                {
                  title: '5–8 Seeds: What Helps Slight Favorites',
                  color: '#f97316',
                  description: 'These seeds are favorites but still vulnerable. Offense matters most here.',
                  metrics: [
                    { name: 'AdjOE (Offense)', winners: '34th', losers: '44th', note: 'Scoring well is the top indicator' },
                    { name: 'EFG% (Shooting)', winners: '94th', losers: '107th', note: 'Efficient shooting helps a lot' },
                    { name: 'TOR (Ball security)', winners: '90th', losers: '130th', note: 'Don't give the ball away' },
                    { name: 'Tempo (Game speed)', winners: '209th', losers: '180th', note: 'Slower pace helps 5-8 seeds (opposite of 1-4!)' },
                  ],
                  best: [['5 seed', 'Wisconsin'], ['6 seed', 'BYU'], ['7 seed', 'UCLA'], ['8 seed', 'Ohio State']],
                  worst: [['5 seed', 'St. John's'], ['6 seed', 'Tennessee'], ['7 seed', 'Saint Mary's'], ['8 seed', 'Villanova']],
                },
                {
                  title: '9–12 Seeds: What Helps Underdogs',
                  color: '#22c55e',
                  description: 'These underdogs can pull off upsets with strong defense, turnover forcing, and experienced coaches.',
                  metrics: [
                    { name: 'AdjDE (Defense)', winners: '52nd', losers: '72nd', note: 'Defense wins in upset games' },
                    { name: 'EFGD% (Limit opponent shooting)', winners: '90th', losers: '100th', note: 'Make opponents miss' },
                    { name: 'TORD (Force turnovers)', winners: '140th', losers: '153rd', note: 'Create extra possessions' },
                    { name: 'Coach S16 (Coach experience)', winners: '2.5 Sweet 16s', losers: '0.9 Sweet 16s', note: 'Experienced coaches make a big difference here' },
                  ],
                  best: [['9 seed', 'TCU'], ['10 seed', 'Texas A&M'], ['11 seed', 'South Florida'], ['12 seed', 'Northern Iowa']],
                  worst: [['9 seed', 'Saint Louis'], ['10 seed', 'UCF'], ['11 seed', 'Texas'], ['12 seed', 'Akron']],
                },
                {
                  title: '13–16 Seeds: Cinderella Checklist',
                  color: '#8b5cf6',
                  description: 'The biggest upsets. Look for teams that shoot 3s well, win the turnover battle, and score efficiently.',
                  metrics: [
                    { name: 'EFG% (Shooting)', winners: '82nd', losers: '112th', note: 'Cinderellas shoot efficiently' },
                    { name: 'TOR (Ball security)', winners: '117th', losers: '154th', note: 'Take care of the ball' },
                    { name: '3P% (3-point shooting)', winners: '111th', losers: '125th', note: 'Threes are how upsets happen' },
                    { name: '3PR (Shoot lots of 3s)', winners: '156th', losers: '183rd', note: 'More 3-point attempts = more chances' },
                  ],
                  best: [['13 seed', 'Hofstra'], ['14 seed', 'Wright St.'], ['15 seed', 'Queens'], ['16 seed', 'UMBC']],
                  worst: [['13 seed', 'Hawaii'], ['14 seed', 'Penn'], ['15 seed', 'Furman'], ['16 seed', 'Prairie View']],
                },
              ].map(({ title, color, description, metrics, best, worst }) => (
                <div key={title} style={{ ...S.card, marginBottom: 20, borderColor: `${color}44` }}>
                  <h4 style={{ color, marginBottom: 6, fontSize: 15 }}>{title}</h4>
                  <p style={{ color: '#888', fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>{description}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {metrics.map(m => (
                      <div key={m.name} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>{m.name}</div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, color: '#22c55e' }}>✓ Winners: {m.winners}</span>
                          <span style={{ fontSize: 11, color: '#ef4444' }}>✗ Losers: {m.losers}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{m.note}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 10, color: '#22c55e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Best by these metrics</div>
                      {best.map(([seed, team]) => (
                        <div key={seed} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#555', minWidth: 50 }}>{seed}:</span>
                          <span style={{ color: '#ccc', fontWeight: 600 }}>{team}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 10, color: '#ef4444', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>Most vulnerable</div>
                      {worst.map(([seed, team]) => (
                        <div key={seed} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: '#555', minWidth: 50 }}>{seed}:</span>
                          <span style={{ color: '#ccc', fontWeight: 600 }}>{team}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Sweet 16 Section */}
              <h3 style={{ color: ACCENT2, fontFamily: "'Playfair Display', serif", marginBottom: 16, marginTop: 32, fontSize: 20 }}>🔥 Picking Your Sweet 16</h3>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Getting to the Sweet 16 is where points really start to add up in your bracket. Here's what the data says about which teams from each group tend to make it.
              </p>
              {[
                { seeds: '1 Seeds', made: '32/40 = 0.80', color: '#ef4444', notes: [
                  'Arizona is the strongest — meets both key scenarios (low turnover rate + good rebounding).',
                  'Florida is the most vulnerable — worst metrics of the 1 seeds.',
                  'All 1 seeds are still strong picks for the Sweet 16.',
                ]},
                { seeds: '2 Seeds', made: '25/40 = 0.625', color: '#f97316', notes: [
                  'Houston is the standout — meets both key criteria (top-20 offense AND defense).',
                  'When both criteria are met, 2 seeds are 13/13 = 1.00 historically.',
                  'Iowa State and Purdue are slightly more vulnerable this year.',
                ]},
                { seeds: '7 Seeds', made: '9/40 = 0.225', color: '#22c55e', notes: [
                  'UCLA is the best 7 seed — meets both key criteria (3-point shooting + top-20 offense).',
                  "When a 7 seed meets both criteria, they're 4/5 = 0.80 historically.",
                  'Could UCLA cause some chaos?',
                ]},
                { seeds: '5 Seeds', made: '16/40 = 0.40', color: '#06b6d4', notes: [
                  'St. John's, Vanderbilt, and Wisconsin meet the key tempo criteria.',
                  'Texas Tech does not meet either key scenario — most vulnerable 5 seed.',
                  "When a 5 seed meets both criteria, they're 5/5 = 1.00 historically.",
                ]},
              ].map(({ seeds, made, color, notes }) => (
                <div key={seeds} style={{ ...S.card, marginBottom: 16, borderColor: `${color}44` }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ background: color, color: '#fff', borderRadius: 6, padding: '4px 12px', fontSize: 14, fontWeight: 700 }}>{seeds}</div>
                    <div style={{ fontSize: 14, color: '#fff', fontWeight: 600 }}>{made} make the Sweet 16</div>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {notes.map((n, i) => <li key={i} style={{ fontSize: 13, color: '#bbb', lineHeight: 1.6 }}>{n}</li>)}
                  </ul>
                </div>
              ))}

              {/* Elite 8 */}
              <h3 style={{ color: ACCENT2, fontFamily: "'Playfair Display', serif", marginBottom: 16, marginTop: 32, fontSize: 20 }}>⚡ Elite 8 & Beyond</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {[
                  { round: 'Elite 8', seeds: '1 Seeds', stat: '25/40 = 0.625', color: '#ef4444', tip: "Arizona and Michigan look strongest. Duke's weak 3PRD (lets opponents shoot lots of 3s) is a concern. Florida looks vulnerable." },
                  { round: 'Elite 8', seeds: '2 Seeds', stat: '16/40 = 0.40', color: '#f97316', tip: 'UConn and Houston meet both key criteria and are 16/29 = 0.55 historically when they do. Purdue and Iowa State do not meet both criteria — historically 0/11.' },
                  { round: 'Final Four', seeds: '1 Seeds', stat: '18/40 = 0.45', color: '#8b5cf6', tip: "Only Duke meets the top-5 AdjOE criteria. Arizona was strong all the way until here — their stats are close but don't technically qualify." },
                  { round: 'Championship', seeds: 'Champions', stat: '10 champions analyzed', color: GOLD2, tip: '70% of champions ranked in the top 5 nationally for offense. Duke fits many champion metrics but has a concerning 3PRD (341st). Arizona and Michigan are also strong picks.' },
                ].map(({ round, seeds, stat, color, tip }) => (
                  <div key={round + seeds} style={{ ...S.card, borderColor: `${color}44` }}>
                    <div style={{ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>{round} — {seeds}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{stat}</div>
                    <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>{tip}</div>
                  </div>
                ))}
              </div>

              {/* Miscellaneous Tips */}
              <h3 style={{ color: ACCENT2, fontFamily: "'Playfair Display', serif", marginBottom: 16, marginTop: 8, fontSize: 20 }}>🎲 Bonus Tips</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {[
                  { icon: '📋', title: 'First Four teams are at a disadvantage', body: '11 seeds overall make the second round 52.5% of the time (21/40). But First Four at-large teams only make it 40% of the time (8/20) and reach the Sweet 16 just 10% of the time (2/20). Playing an extra game and traveling more takes a toll.' },
                  { icon: '🏫', title: 'The conference with the most teams usually underperforms', body: 'Historically, the conference that sends the most teams to the tournament tends to be overseeded. This year the SEC sent 10 teams. Consider being slightly skeptical of SEC teams outside the top seeds.' },
                  { icon: '🌟', title: 'Champions usually have scoring depth', body: 'All 10 recent champions had at least 3 players averaging 10+ points per game. None had a single player averaging 20+ points. Teams that share the ball and have multiple weapons tend to go furthest. Keep this in mind when picking your champion.' },
                ].map(({ icon, title, body }) => (
                  <div key={title} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: 24, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{title}</div>
                      <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', padding: '16px', color: '#555', fontSize: 12, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8 }}>
                Analysis based on data from the past 10 NCAA Tournaments. All stats from Bart Torvik's college basketball database.
              </div>
            </div>
          )}

          {/* ══ LEADERBOARD TAB ══ */}
          {tab === 'leaderboard' && (
            <div style={{ padding: 24, maxWidth: 660, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}
                role="tablist" aria-label="Leaderboard tournament selector">
                <button role="tab" aria-selected={activeTournament === 'basketball'} onClick={() => setActiveTournament('basketball')}
                  style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>🏀 Basketball</button>
                <button role="tab" aria-selected={activeTournament === 'mammals'} onClick={() => setActiveTournament('mammals')}
                  style={{ padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>🦁 Mammal Madness</button>
              </div>

              {activeTournament === 'basketball' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 20 }}>Leaderboard</h2>
                  <div style={S.card}>
                    {studentBoard.length > 0 && <div style={{ fontSize: 11, color: '#888', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Students</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}>
                      <span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Name</span><span>Points</span>
                    </div>
                    {studentBoard.length === 0
                      ? <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>No entries yet — be the first!</div>
                      : studentBoard.map((e, i) => (
                        <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === user?.uid ? 'rgba(22,163,74,0.08)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === user?.uid ? '1px solid rgba(22,163,74,0.25)' : '1px solid transparent' }}
                          aria-label={`Rank ${i+1}: ${e.displayName}, ${e.score} points`}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? ACCENT2 : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#444', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                          {e.photoURL ? <img src={e.photoURL} alt={`${e.displayName} avatar`} width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#777' }} aria-hidden="true">?</div>}
                          <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? ACCENT2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                          <button onClick={() => handleViewBracket(e.uid, e.displayName, false)} disabled={loadingBracket === e.uid}
                            style={{ ...S.btn('rgba(22,163,74,0.12)', '#86efac'), padding: '3px 10px', fontSize: 11, border: '1px solid rgba(22,163,74,0.25)', flexShrink: 0 }}>
                            {loadingBracket === e.uid ? '...' : 'View'}
                          </button>
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
                          {e.photoURL ? <img src={e.photoURL} alt={`${e.displayName} avatar`} width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#777' }}>?</div>}
                          <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? GOLD2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                          <button onClick={() => handleViewBracket(e.uid, e.displayName, false)} disabled={loadingBracket === e.uid}
                            style={{ ...S.btn('rgba(245,158,11,0.12)', GOLD2), padding: '3px 10px', fontSize: 11, border: `1px solid rgba(245,158,11,0.25)`, flexShrink: 0 }}>
                            {loadingBracket === e.uid ? '...' : 'View'}
                          </button>
                          <span style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTournament === 'mammals' && (
                <>
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
                          {e.photoURL ? <img src={e.photoURL} alt={`${e.displayName} avatar`} width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111' }}>?</div>}
                          <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? '#86efac' : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                          <button onClick={() => handleViewBracket(e.uid, e.displayName, true)} disabled={loadingBracket === e.uid + '-mm'}
                            style={{ ...S.btn('rgba(134,239,172,0.12)', '#86efac'), padding: '3px 10px', fontSize: 11, border: '1px solid rgba(134,239,172,0.25)', flexShrink: 0 }}>
                            {loadingBracket === e.uid + '-mm' ? '...' : 'View'}
                          </button>
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
                          {e.photoURL ? <img src={e.photoURL} alt={`${e.displayName} avatar`} width={26} height={26} style={{ borderRadius: '50%' }} /> : <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#111' }}>?</div>}
                          <span style={{ flex: 1, fontWeight: e.uid === user?.uid ? 700 : 400, color: e.uid === user?.uid ? GOLD2 : '#bbb', fontSize: 14 }}>{formatName(e.displayName)}{e.uid === user?.uid ? ' (You)' : ''}</span>
                          <button onClick={() => handleViewBracket(e.uid, e.displayName, true)} disabled={loadingBracket === e.uid + '-mm'}
                            style={{ ...S.btn('rgba(245,158,11,0.12)', GOLD2), padding: '3px 10px', fontSize: 11, border: `1px solid rgba(245,158,11,0.25)`, flexShrink: 0 }}>
                            {loadingBracket === e.uid + '-mm' ? '...' : 'View'}
                          </button>
                          <span style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ ADMIN TAB ══ */}
          {tab === 'admin' && isAdmin && (
            <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c', boxShadow: '0 0 6px #e74c3c' }} aria-hidden="true" />
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', margin: 0 }}>Admin Panel</h2>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }} role="tablist" aria-label="Admin sections">
                {[['dashboard','Dashboard'],['teams','🏀 Basketball'],['mammals','🦁 Mammal Madness'],['users','👥 Users'],['help','Help']].map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={adminSubTab === id}
                    style={{ ...S.navBtn(adminSubTab === id), borderBottom: adminSubTab === id ? '2px solid #e74c3c' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }}
                    onClick={() => setAdminSubTab(id)}>{label}</button>
                ))}
              </div>

              {adminSubTab === 'dashboard' && (
                <>
                  {generating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.4)' }} role="status" aria-live="polite">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#6366f1', fontSize: 14, fontWeight: 700 }}>Generating research data...</span>
                        <span style={{ color: '#888', fontSize: 13 }}>{genProgress.done} / {genProgress.total}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', background: '#6366f1', borderRadius: 3, width: `${genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>Currently fetching: {genProgress.current}</div>
                    </div>
                  )}
                  {genError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }} role="alert">⚠️ {genError}</div>}

                  <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
                    <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
                    <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Updates the year shown on the login screen and header for all users.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)} aria-label="Tournament year"
                        style={{ ...S.input, width: 110, padding: '8px 12px', fontSize: 16 }} />
                      <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px' }} onClick={handleSaveYear} disabled={yearSaving}>
                        {yearSaving ? 'Saving...' : 'Update Year'}
                      </button>
                      <span style={{ fontSize: 12, color: '#777' }}>Currently: <strong style={{ color: ACCENT2 }}>{tournamentYear}</strong></span>
                    </div>
                  </div>

                  <div style={{ ...S.card, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 16 }}>
                    <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                      Use the <strong style={{ color: ACCENT2 }}>Bracket tab</strong> to enter official game results — your picks become the answer key and update all scores live.<br /><br />
                      Use <strong style={{ color: ACCENT2 }}>Admin → 🏀 Basketball</strong> every March after Selection Sunday to enter teams. No code editing needed.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {[['Total Entries', leaderboard.length], ['Avg Score', leaderboard.length ? Math.round(leaderboard.reduce((a,e) => a+(e.score||0),0)/leaderboard.length)+' pts' : '-'], ['Status', locked ? '🔒 Locked' : '🟢 Open']].map(([l,v]) => (
                      <div key={l} style={{ ...S.card, textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif" }}>{v}</div>
                        <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {adminSubTab === 'teams' && (
                <>
                  <TeamEntryPanel
                    onTeamsSaved={handleTeamsSaved}
                    onRequestGenerateResearch={handleGenerateResearch}
                    regionNames={bbRegionNames}
                    onRegionNamesChange={handleSaveBbRegionNames}
                    sourcesData={bbSources}
                    onSaveSources={handleSaveBbSources}
                  />
                  {/* ── Danger Zone ── */}
                  <div style={{ marginTop: 40, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 24 }}>
                    <div style={{ fontSize: 11, color: '#e74c3c', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>⚠️ Danger Zone</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 220 }}>
                        <h4 style={{ color: '#f87171', marginBottom: 6 }}>Clear Basketball Roster</h4>
                        <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Deletes the team roster and official bracket. Use at the start of a new season.</p>
                        <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }}
                          onClick={() => setConfirmDialog({ message: 'Delete the basketball roster and official bracket? This cannot be undone.', onConfirm: async () => { setConfirmDialog(null); await handleClearBbRoster(); } })}>
                          Clear Roster &amp; Bracket
                        </button>
                      </div>
                      <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 220 }}>
                        <h4 style={{ color: '#f87171', marginBottom: 6 }}>Clear Basketball Research</h4>
                        <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Deletes all scouting reports. Save them elsewhere first if you want to reference them next year.</p>
                        <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }}
                          onClick={() => setConfirmDialog({ message: 'Delete all basketball research cards? This cannot be undone.', onConfirm: async () => { setConfirmDialog(null); await handleClearBbResearch(); } })}>
                          Clear Research
                        </button>
                      </div>
                      <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 220 }}>
                        <h4 style={{ color: '#f87171', marginBottom: 6 }}>Clear All User Brackets</h4>
                        <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Deletes every student and teacher basketball bracket and resets the leaderboard.</p>
                        <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }}
                          onClick={() => setConfirmDialog({ message: 'Delete ALL user basketball brackets and leaderboard scores? This cannot be undone.', onConfirm: async () => { setConfirmDialog(null); await handleClearAllBrackets(false); } })}>
                          Clear All Brackets
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {adminSubTab === 'mammals' && (
                <>
                  {mammalGenerating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.3)' }} role="status" aria-live="polite">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#86efac', fontSize: 14, fontWeight: 700 }}>Generating animal facts...</span>
                        <span style={{ color: '#888', fontSize: 13 }}>{mammalGenProgress.done} / {mammalGenProgress.total}</span>
                      </div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                        <div style={{ height: '100%', background: '#86efac', borderRadius: 3, width: `${mammalGenProgress.total ? (mammalGenProgress.done / mammalGenProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>Currently generating: {mammalGenProgress.current}</div>
                    </div>
                  )}
                  {mammalGenError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }} role="alert">⚠️ {mammalGenError}</div>}
                  <div style={{ ...S.card, borderColor: 'rgba(134,239,172,0.2)', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ color: '#86efac', marginBottom: 4 }}>Mammal Bracket Lock</h3>
                        <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Status: <span style={{ color: mammalLocked ? '#e74c3c' : '#22c55e', fontWeight: 700 }}>{mammalLocked ? '🔒 Locked' : '🟢 Open'}</span></p>
                      </div>
                      <button style={{ ...S.btn(mammalLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 13, padding: '8px 20px' }}
                        onClick={() => setConfirmDialog({ message: `${mammalLocked ? 'Unlock' : 'Lock'} all Mammal Madness brackets?`, onConfirm: async () => { setConfirmDialog(null); const nl = !mammalLocked; setMammalLocked(nl); await setMammalTournamentLocked(nl); } })}>
                        {mammalLocked ? 'Unlock Brackets' : 'Lock All Brackets'}
                      </button>
                    </div>
                  </div>
                  <MammalEntryPanel
                    onAnimalsSaved={(nb) => { setMammalBracket(nb); setMammalOfficialBracket(nb); }}
                    onRequestGenerateMammalResearch={handleGenerateMammalResearch}
                    onRefetchImages={handleRefetchMammalImages}
                    regionNames={mammalRegionNames}
                    onRegionNamesChange={setMammalRegionNames}
                    sourcesData={mammalSources}
                    onSaveSources={handleSaveMammalSources}
                  />
                  {/* ── Danger Zone ── */}
                  <div style={{ marginTop: 40, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 24 }}>
                    <div style={{ fontSize: 11, color: '#e74c3c', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>⚠️ Danger Zone</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 220 }}>
                        <h4 style={{ color: '#f87171', marginBottom: 6 }}>Clear Mammal Roster</h4>
                        <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Deletes the animal roster and official mammal bracket. Use at the start of a new season.</p>
                        <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }}
                          onClick={() => setConfirmDialog({ message: 'Delete the mammal roster and official bracket? This cannot be undone.', onConfirm: async () => { setConfirmDialog(null); await handleClearMammalRoster(); } })}>
                          Clear Roster &amp; Bracket
                        </button>
                      </div>
                      <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 220 }}>
                        <h4 style={{ color: '#f87171', marginBottom: 6 }}>Clear Mammal Research</h4>
                        <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Deletes all organism profiles and images. Save them elsewhere first if you want to reference them.</p>
                        <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }}
                          onClick={() => setConfirmDialog({ message: 'Delete all mammal research cards and images? This cannot be undone.', onConfirm: async () => { setConfirmDialog(null); await handleClearMammalResearch(); } })}>
                          Clear Research
                        </button>
                      </div>
                      <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 220 }}>
                        <h4 style={{ color: '#f87171', marginBottom: 6 }}>Clear All User Brackets</h4>
                        <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>Deletes every student and teacher mammal bracket and resets the mammal leaderboard.</p>
                        <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }}
                          onClick={() => setConfirmDialog({ message: 'Delete ALL user mammal brackets and leaderboard scores? This cannot be undone.', onConfirm: async () => { setConfirmDialog(null); await handleClearAllBrackets(true); } })}>
                          Clear All Brackets
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {adminSubTab === 'users' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ color: ACCENT2, marginBottom: 4 }}>Active Users</h3>
                      <p style={{ color: '#777', fontSize: 13, margin: 0 }}>{allUsers.length} registered user{allUsers.length !== 1 ? 's' : ''}. Removing a user deletes their brackets, scores, and profile but not their Google account.</p>
                    </div>
                  </div>
                  {allUsers.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>No users yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {allUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')).map(u => (
                        <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                          {u.photoURL
                            ? <img src={u.photoURL} alt={u.displayName} width={32} height={32} style={{ borderRadius: '50%', flexShrink: 0 }} />
                            : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#888', flexShrink: 0 }}>{(u.displayName || '?').charAt(0)}</div>
                          }
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>{u.displayName || 'Anonymous'}</div>
                            <div style={{ fontSize: 11, color: '#555' }}>{u.email || u.uid}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#444', marginRight: 8 }}>
                            {u.lastSeen?.seconds ? new Date(u.lastSeen.seconds * 1000).toLocaleDateString() : ''}
                          </div>
                          <button
                            onClick={() => setConfirmDialog({
                              message: `Remove ${u.displayName || 'this user'}? This deletes their brackets and scores but not their Google account.`,
                              onConfirm: async () => { setConfirmDialog(null); await handleRemoveUser(u.uid); }
                            })}
                            disabled={removingUser === u.uid}
                            style={{ ...S.btn('rgba(239,68,68,0.15)', '#f87171'), padding: '5px 14px', fontSize: 12, border: '1px solid rgba(239,68,68,0.3)', flexShrink: 0 }}>
                            {removingUser === u.uid ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                      Teachers appear in a separate leaderboard section with a 🍎 label.<br /><br />
                      1. Have the teacher sign into the app once.<br />
                      2. Go to Firebase Console → Authentication → Users and copy their UID.<br />
                      3. Go to Firestore → <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>teachers</code> collection → Add document with that UID as Document ID.<br />
                      4. They sign out and back in — Teacher badge appears automatically.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(99,102,241,0.25)' }}>
                    <h3 style={{ color: '#a5b4fc', marginBottom: 14 }}>🤖 AI Research Generation</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      Research is generated using the Claude API via a secure Vercel serverless function. Your API key is never exposed to the browser.<br /><br />
                      To update your Claude API key: go to Vercel → your project → Settings → Environment Variables → update <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>ANTHROPIC_KEY</code>.<br /><br />
                      Credits are managed at <strong style={{ color: '#a5b4fc' }}>console.anthropic.com</strong> → Plans &amp; Billing. $5 of credits covers approximately 60–80 full generation runs.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.2)' }}>
                    <h3 style={{ color: ACCENT2, marginBottom: 14 }}>📅 New Season Checklist</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      At the start of each new tournament season:<br /><br />
                      1. Update the tournament year in Admin → Dashboard.<br />
                      2. Go to Admin → 🏀 Basketball → Danger Zone → Clear Roster &amp; Bracket, then re-enter teams after Selection Sunday.<br />
                      3. Go to Admin → 🦁 Mammal Madness → Danger Zone → Clear Roster &amp; Bracket, then re-enter the new animals.<br />
                      4. Use Admin → 👥 Users → Remove to clear out old student brackets, or use the "Clear All Brackets" buttons.<br />
                      5. Generate fresh research for both tournaments.<br />
                      6. Unlock brackets when ready for students to submit picks.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
