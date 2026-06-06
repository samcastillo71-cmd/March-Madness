// src/App.jsx
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import confetti from 'canvas-confetti';
import { Component } from 'react';
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { Lock, Check, Settings, AlertTriangle, Trophy, School, Search, Menu, X } from 'lucide-react';
import {
  saveBracket, loadBracket,
  saveOfficialBracket, subscribeToOfficialBracket,
  subscribeToConfig, setTournamentLocked,
  subscribeToLeaderboard, updateLeaderboardEntry,
  saveResearchData, saveOneTeamResearch, subscribeToResearchData,
  saveMammalBracket, loadMammalBracket,
  saveMammalOfficialBracket, subscribeToMammalOfficialBracket,
  subscribeToMammalConfig, setMammalTournamentLocked,
  subscribeToMammalLeaderboard, updateMammalLeaderboardEntry,
  saveMammalResearchData, saveOneMammalResearch, subscribeToMammalResearchData,
  saveMammalRoster,
  deleteBracketAndScore, getAllBracketUids, deleteAllBrackets,
  getUserProfile, saveUserProfile,
  getUserRole, getSuperAdmins, saveSuperAdmins,
  getTeachers, saveTeachers,
  getMammalBattleVideos, saveMammalBattleVideos, subscribeToMammalBattleVideos,
  getAllUsers, updateUserSchool,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, buildInitialBracketFromTeams, calcScore, R64_SEED_MATCHUPS,
} from './bracketData';

// ── THEME ─────────────────────────────────────────────────────────────────────
const NAVY     = '#091828';
const GREEN    = '#1A4332';
const MINT_BG  = '#C2EDD5';
const MINT_FG  = '#1E6B47';
const RC = { East: '#93c5fd', West: '#fca5a5', South: '#86efac', Midwest: '#fdba74' };
const ROUND_COLORS = [
  'rgba(9,24,40,0.10)', 'rgba(9,24,40,0.13)',
  'rgba(9,24,40,0.16)', 'rgba(9,24,40,0.20)', 'rgba(26,67,50,0.15)',
];
const ROUND_BORDER_COLORS = [
  'rgba(9,24,40,0.40)', 'rgba(9,24,40,0.50)',
  'rgba(9,24,40,0.60)', 'rgba(9,24,40,0.70)', 'rgba(26,67,50,0.65)',
];

const S = {
  app:    { minHeight: '100dvh', background: '#E8E2D8', color: '#1A1208', fontFamily: "'Public Sans', sans-serif" },
  header: { background: 'rgba(9,24,40,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(28,53,88,0.6)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Libre Bodoni', serif", fontSize: 19, fontWeight: 700, color: '#B8CBE8', letterSpacing: 1 },
  card:   { background: '#F4EFE6', border: '2px solid rgba(9,24,40,0.20)', borderRadius: 18, padding: 20, boxShadow: '4px 6px 14px rgba(9,24,40,0.10), inset -1px -1px 4px rgba(255,255,255,0.8)' },
  btn:    (bg = NAVY, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3, boxShadow: '3px 4px 10px rgba(9,24,40,0.15)', transition: 'transform 200ms ease-out, box-shadow 200ms ease-out' }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? '#1C3558' : 'transparent', color: a ? '#fff' : '#B8CBE8', transition: 'background 150ms, color 150ms' }),
  input:  { background: 'rgba(255,255,255,0.7)', border: '1px solid #C8BFB0', borderRadius: 10, color: '#1A1208', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
  tag:    (color) => ({ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }),
};

// ── COMPARE ZONE COLORS ───────────────────────────────────────────────────────
const HABITAT_COLORS = {
  savanna:    { top: '#6B3E1A', bottom: '#A86030' },
  grassland:  { top: '#6B3E1A', bottom: '#A86030' },
  desert:     { top: '#8B5E2A', bottom: '#C4952A' },
  forest:     { top: '#0D2E1A', bottom: '#2A5C3A' },
  woodland:   { top: '#0D2E1A', bottom: '#2A5C3A' },
  ocean:      { top: '#003459', bottom: '#0E6E8C' },
  marine:     { top: '#003459', bottom: '#0E6E8C' },
  arctic:     { top: '#2B4C6F', bottom: '#5C8AAA' },
  tundra:     { top: '#2B4C6F', bottom: '#5C8AAA' },
  rainforest: { top: '#0B3D1E', bottom: '#1A6640' },
  mountain:   { top: '#3D3A50', bottom: '#6B6880' },
};
const FALLBACK_HABITAT = { top: '#0D2419', bottom: '#2A6348' };
const BB_COMPARE = { top: '#040C15', bottom: '#1E4A88' };

function getHabitatColor(animalName, researchData) {
  const h = ((researchData || {})[animalName]?.habitat || '').toLowerCase();
  for (const [key, colors] of Object.entries(HABITAT_COLORS)) {
    if (h.includes(key)) return colors;
  }
  return FALLBACK_HABITAT;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatName(displayName) {
  if (!displayName) return 'Anonymous';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].charAt(0)}. ${parts[parts.length - 1]}`;
}

// Deterministic color from name string
function nameToColor(name) {
  const colors = ['#091828','#1A4332','#1C3558','#4A2060','#8B3A3A','#2A5C6E','#1E6B47','#7A4A1A'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ name, size = 28 }) {
  const initials = (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const color = nameToColor(name);
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 800, color: '#fff', flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)' }}>
      {initials}
    </div>
  );
}

const labelFontSize = (name) => {
  const len = (name || '').length;
  if (len <= 4) return 120; if (len <= 6) return 96; if (len <= 8) return 76;
  if (len <= 10) return 60; if (len <= 12) return 50; if (len <= 14) return 42;
  return 34;
};

function applyField(card, path, val) {
  const out = JSON.parse(JSON.stringify(card || {}));
  const parts = path.split('.');
  let obj = out;
  for (let i = 0; i < parts.length - 1; i++) { if (!obj[parts[i]]) obj[parts[i]] = {}; obj = obj[parts[i]]; }
  obj[parts[parts.length - 1]] = val;
  return out;
}

// ── ERROR BOUNDARY ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100dvh', background: '#E8E2D8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <Trophy size={48} color="#091828" style={{ marginBottom: 16 }} />
          <h2 style={{ color: '#c0392b', fontFamily: "'Libre Bodoni', serif", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#7A7068', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Your bracket picks are saved. Try reloading the page.</p>
          <button style={{ background: '#091828', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => window.location.reload()}>Reload Page</button>
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
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '6px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600, fontFamily: "'Public Sans', sans-serif" }}>You are offline — picks will save when you reconnect</div>;
}

// ── TEAM LOGO ─────────────────────────────────────────────────────────────────
const TeamLogo = memo(function TeamLogo({ espnId, name, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!espnId || err) return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#091828,#1C3558)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
      {name?.charAt(0) || '?'}
    </span>
  );
  return <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`} alt={name} width={size} height={size} loading="lazy" style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#fff' }} onError={() => setErr(true)} />;
});

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onKeyDown={e => { if (e.key === 'Escape') onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-label={message} style={{ ...S.card, maxWidth: 360, textAlign: 'center', padding: 32 }}>
        <AlertTriangle size={28} color="#c0392b" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, color: '#1A1208', marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button style={S.btn('#c0392b')} onClick={onConfirm}>Confirm</button>
          <button ref={cancelRef} style={S.btn('#C8BFB0', '#1A1208')} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── GAME SLOT ─────────────────────────────────────────────────────────────────
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.7)', border: '1px solid #C8BFB0', borderRadius: 4, color: '#1A1208', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

function findLiveScore(liveScores, teamName) {
  if (!teamName || !liveScores) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(teamName);
  const exact = Object.entries(liveScores).find(([k]) => norm(k) === target);
  if (exact) return exact[1];
  const sub = Object.entries(liveScores).find(([k]) => { const nk = norm(k); return nk.includes(target) || target.includes(nk); });
  return sub ? sub[1] : null;
}

const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onCompare, isMammal = false, mammalResearchData = {} }) {
  if (!game) return null;
  const { top, bottom, winner } = game;
  const slotBg     = isChampionship ? 'rgba(196,149,42,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(196,149,42,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];
  const compareColors = (() => {
    if (!isMammal) {
      const tc = top?.color    ? `#${top.color}`    : BB_COMPARE.top;
      const bc = bottom?.color ? `#${bottom.color}` : BB_COMPARE.bottom;
      return { top: tc, bottom: bc };
    }
    const tc = getHabitatColor(top?.name, mammalResearchData);
    const bc = getHabitatColor(bottom?.name, mammalResearchData);
    return { top: tc.top, bottom: bc.bottom };
  })();
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
        role={!locked && !isFF ? 'button' : undefined}
        tabIndex={!locked && !isFF ? 0 : -1}
        onKeyDown={e => { if (!locked && !isFF && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick?.(side); } }}
        className={!locked && !isFF ? (isW ? 'mm-tile mm-tile-win' : 'mm-tile') : ''}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px', background: isW ? MINT_BG : '#F4EFE6', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 6, opacity: isL ? 0.4 : 1, transition: 'background .12s', minWidth: 100, border: isW ? `1px solid ${MINT_FG}` : '1px solid #C8BFB0' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={36} />
        <span style={{ fontSize: 10, color: isW ? MINT_FG : '#7A7068', fontWeight: 700 }}>{team.seed}</span>
        <span style={{ fontSize: 14, fontWeight: isW ? 700 : 500, color: isW ? MINT_FG : isL ? '#C8BFB0' : '#1A1208', textAlign: 'center', maxWidth: 120, lineHeight: 1.2 }}>{isFF ? 'TBD' : team.name}</span>
        {hasLive && live && <span style={{ fontSize: 18, fontWeight: 800, color: isFinal && live.winner ? MINT_FG : isLiveGame && isLiveWinning ? '#C4952A' : '#7A7068' }}>{live.score}</span>}
        {isW && <Check size={14} color={MINT_FG} />}
      </div>
    );
    return (
      <div onClick={() => !locked && !isFF && onPick?.(side)}
        role={!locked && !isFF ? 'button' : undefined}
        tabIndex={!locked && !isFF ? 0 : -1}
        onKeyDown={e => { if (!locked && !isFF && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick?.(side); } }}
        className={!locked && !isFF ? (isW ? 'mm-tile mm-tile-win' : 'mm-tile') : ''}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', minHeight: 44, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? MINT_BG : '#F4EFE6', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.4 : 1, transition: 'background .12s', boxShadow: isW ? `inset 3px 0 0 ${MINT_FG}` : 'inset 3px 0 0 transparent' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: isW ? MINT_FG : '#7A7068', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 14, fontWeight: isW ? 700 : 500, color: isW ? MINT_FG : isL ? '#C8BFB0' : '#1A1208', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
          {isFF ? 'First Four Winner' : team.name}
        </span>
        {hasLive && live && <span style={{ fontSize: 13, fontWeight: 800, color: isFinal && live.winner ? MINT_FG : isLiveGame && isLiveWinning ? '#C4952A' : '#7A7068', minWidth: 24, textAlign: 'right', flexShrink: 0 }}>{live.score}</span>}
        {isW && !hasLive && <Check size={13} color={MINT_FG} style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, flexShrink: 0 }} />}
      </div>
    );
  };

  if (isHorizontal) return (
    <div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Team team={top} side="top" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px', gap: 4 }}>
          {isLiveGame && <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /><span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span></>}
          {isFinal && <span style={{ fontSize: 10, color: '#777', fontWeight: 700 }}>FINAL</span>}
          <span style={{ fontSize: 18, fontWeight: 900, color: '#888' }}>VS</span>
          {isChampionship && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input placeholder="–" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
              <span style={{ color: '#777', fontSize: 13, alignSelf: 'center' }}>-</span>
              <input placeholder="–" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
            </div>
          )}
        </div>
        <Team team={bottom} side="bottom" />
      </div>
    </div>
  );

  const canCompare = onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder;
  return (
    <div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg, minWidth: 178, boxShadow: '4px 6px 14px rgba(9,24,40,0.08), inset -1px -1px 3px rgba(255,255,255,0.6)', position: 'relative' }}>
      <Team team={top} side="top" />
      {canCompare ? (
        <div
          className="compare-zone"
          role="button"
          tabIndex={0}
          onClick={() => onCompare(top, bottom)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCompare(top, bottom); } }}
          aria-label={`Compare ${top?.name} vs ${bottom?.name}`}
          style={{ '--cz-top': compareColors.top, '--cz-bot': compareColors.bottom }}
        >
          <div className="cz-fill-top" />
          <div className="cz-fill-bot" />
          <div className="cz-divider" />
          <div className="cz-vs">vs</div>
          <div className="cz-corner cz-tl" /><div className="cz-corner cz-tr" />
          <div className="cz-corner cz-bl" /><div className="cz-corner cz-br" />
          <div className="cz-conn cz-conn-l" /><div className="cz-conn cz-conn-r" />
          <div className="cz-label">COMPARE</div>
        </div>
      ) : (
        <div style={{ height: 1, background: '#C8BFB0' }} />
      )}
      <Team team={bottom} side="bottom" />
      {isLiveGame && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '2px 8px', background: 'rgba(239,68,68,0.10)', borderTop: '1px solid rgba(239,68,68,0.2)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} /><span style={{ fontSize: 10, color: '#e74c3c', fontWeight: 700 }}>LIVE</span></div>}
      {isFinal && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', background: 'rgba(200,191,176,0.3)', borderTop: '1px solid #C8BFB0' }}><span style={{ fontSize: 10, color: '#7A7068', fontWeight: 700 }}>FINAL</span></div>}
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid #C8BFB0' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#7A7068', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
      {locked && (
        <div className="locked-stamp">
          <span><Lock size={10} style={{ marginRight: 3, display: 'inline-block', verticalAlign: 'middle' }} />LOCKED</span>
        </div>
      )}
    </div>
  );
});

// ── EDITABLE FIELD ────────────────────────────────────────────────────────────
function EditableField({ value, onSave, color = '#ccc', large = false, multiline = false, label = '' }) {
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
        : <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus style={{ ...S.input, fontSize: large ? 18 : 13, padding: '6px 12px' }} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />}
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
  if (!card) return <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#888' }}>No data yet</div>;
  const espnId = card.espnId || '';
  const bannerUrl = espnId ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png` : '';
  const field = (path, value, opts = {}) => isAdmin
    ? <EditableField value={value} onSave={v => onFieldSave(teamName, path, v)} label={path} {...opts} />
    : <span style={{ color: opts.color || '#1A1208', fontSize: opts.large ? 38 : 13 }}>{value || '-'}</span>;
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ position: 'relative', height: 140, borderRadius: '12px 12px 0 0', overflow: 'hidden', background: 'linear-gradient(135deg,#0d2818,#1a3a2a)' }}>
        {bannerUrl && !bannerErr && <img src={bannerUrl} alt={teamName} onError={() => setBannerErr(true)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', height: 108, width: 108, objectFit: 'contain', opacity: 0.85, filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.55))' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,0.84) 42%,rgba(0,0,0,0.22) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 16, left: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{card.conference || ''}</div>
          <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: '#fff', margin: 0, fontSize: 24, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{teamName}</h2>
        </div>
        {card.record && <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '6px 12px', backdropFilter: 'blur(8px)' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>RECORD</div><div style={{ fontSize: 18, fontWeight: 700, color: MINT_FG }}>{card.record}</div></div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={S.card}>
          <h3 style={{ color: MINT_FG, marginBottom: 14, fontFamily: "'Libre Bodoni', serif" }}>Team Stats</h3>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {[['Rank','rank'],['KenPom','kenpom'],['Offense','offense'],['Defense','defense'],['Pace','pace']].map(([label, key]) => (
              <div key={key} style={{ background: 'rgba(9,24,40,0.06)', borderRadius: 8, padding: '8px 10px', flex: '1 1 52px', minWidth: 52 }}>
                <div style={{ fontSize: 9, color: '#7A7068', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>{label}</div>
                {isAdmin
                  ? <EditableField value={card[key]} onSave={v => onFieldSave(teamName, key, v)} label={key} />
                  : <div style={{ fontSize: 18, fontWeight: 700, color: '#1A1208', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{card[key] || '-'}</div>
                }
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['Coach','coach'],['Conference','conference']].map(([label, key]) => (
              <div key={key} style={{ background: 'rgba(9,24,40,0.04)', borderRadius: 6, padding: '8px 12px' }}>
                <div style={S.tag('#555')}>{label}</div>
                {field(key, card[key], { label })}
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <h3 style={{ color: MINT_FG, marginBottom: 12, fontFamily: "'Libre Bodoni', serif" }}>Key Players</h3>
          {(card.keyPlayers || []).map((p, i) => (
            <div key={i} style={{ background: 'rgba(9,24,40,0.04)', borderRadius: 6, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                {isAdmin ? <EditableField value={p.name} label="name" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.name`, v)} /> : <span style={{ fontWeight: 700 }}>{p.name}</span>}
                {isAdmin ? <EditableField value={p.pos} label="pos" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} /> : <span style={{ color: '#7A7068', fontSize: 12 }}>{p.pos}</span>}
              </div>
              {isAdmin ? <EditableField value={p.stats} label="stats" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.stats`, v)} /> : <div style={{ fontSize: 13, color: '#7A7068', margin: '3px 0' }}>{p.stats}</div>}
              {isAdmin ? <EditableField value={p.note} label="note" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.note`, v)} color={MINT_FG} /> : <div style={{ fontSize: 12, color: MINT_FG, fontStyle: 'italic' }}>{p.note}</div>}
            </div>
          ))}
          <div style={{ padding: '10px 12px', background: 'rgba(231,76,60,0.07)', borderRadius: 6, border: '1px solid rgba(231,76,60,0.2)', marginTop: 8 }}>
            <div style={S.tag('#e74c3c')}>Injury Report</div>
            {field('injuries', card.injuries, { multiline: true, label: 'injuries' })}
          </div>
        </div>
        <div style={S.card}>
          <h3 style={{ color: MINT_FG, marginBottom: 12, fontFamily: "'Libre Bodoni', serif" }}>Scouting Report</h3>
          {[['Strengths','#22c55e','strengths'],['Weaknesses','#e74c3c','weaknesses'],['Analyst Note',MINT_FG,'analystNote']].map(([label, color, key]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={S.tag(color)}>{label}</div>
              {field(key, card[key], { color: '#3A3028', multiline: true, label })}
            </div>
          ))}
        </div>
        <div style={S.card}>
          <h3 style={{ color: MINT_FG, marginBottom: 10, fontFamily: "'Libre Bodoni', serif" }}>Championship Odds</h3>
          {field('odds', card.odds, { color: '#22c55e', large: true, label: 'odds' })}
          <div style={{ fontSize: 13, color: '#777', marginBottom: 16, marginTop: 6 }}>Consensus sportsbook odds to win it all</div>
          <div style={{ padding: 12, background: 'rgba(30,107,71,0.07)', borderRadius: 8, border: '1px solid rgba(30,107,71,0.18)', fontSize: 13, color: '#7A7068', lineHeight: 1.5 }}>Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.</div>
        </div>
      </div>
    </div>
  );
}

// ── MAMMAL RESEARCH CARD ──────────────────────────────────────────────────────
const REGION_BANNER_COLORS = { East: ['#1e3a5f','#2563eb'], West: ['#5f1e1e','#dc2626'], South: ['#1e4d2b','#16a34a'], Midwest: ['#4d3a1e','#d97706'] };

function MammalResearchCard({ animalName, card, isAdmin, onFieldSave, onGenerate, generating }) {
  const [imgErrors, setImgErrors] = useState({});
  const [lightbox, setLightbox]   = useState(null);
  const region = (card?.region && REGION_BANNER_COLORS[card.region]) ? card.region : 'East';
  const [bgDark, bgLight] = REGION_BANNER_COLORS[region];
  const galleryImages = card?.galleryImages || [];
  const phyloPicUrl   = card?.phyloPicUrl   || null;
  const wikiImageUrl  = card?.wikiImageUrl  || null;
  const empty = !card || Object.keys(card).length === 0;
  const handleImgError = (key) => setImgErrors(prev => ({ ...prev, [key]: true }));
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: 'relative', height: 160, borderRadius: '12px 12px 0 0', overflow: 'hidden', background: `linear-gradient(135deg,${bgDark} 0%,${bgLight} 100%)` }}>
        {wikiImageUrl && !imgErrors['wiki-header'] && <img src={wikiImageUrl} alt={animalName} onError={() => handleImgError('wiki-header')} style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', objectFit: 'cover', opacity: 0.42 }} />}
        {phyloPicUrl && !imgErrors['phylopic'] && <img src={phyloPicUrl} alt={`${animalName} silhouette`} onError={() => handleImgError('phylopic')} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', height: 115, opacity: 0.48, filter: 'brightness(0)', objectFit: 'contain' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,0.76) 40%,rgba(0,0,0,0.18) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{region} Region · Seed #{card?.seed || ''}</div>
            <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: '#fff', margin: 0, fontSize: 26, textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.1 }}>{animalName}</h2>
            {card?.latinName && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginTop: 3 }}>{card.latinName}</div>}
          </div>
          {isAdmin && <button onClick={() => onGenerate(animalName)} disabled={generating} style={{ ...S.btn(GREEN, '#fff'), padding: '7px 16px', fontSize: 12, flexShrink: 0 }}>{generating ? 'Generating...' : 'Regenerate'}</button>}
        </div>
      </div>
      {empty ? (
        <div style={{ ...S.card, borderRadius: '0 0 12px 12px', borderTop: 'none', color: '#666', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 32 }}>{isAdmin ? 'No data yet — click "Regenerate" to auto-populate.' : 'Organism facts coming soon!'}</div>
      ) : (
        <div style={{ ...S.card, borderRadius: '0 0 12px 12px', borderTop: 'none', borderColor: `${bgLight}44` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['Habitat','habitat'],['Diet & Hunting','diet'],['Superpower','superpower'],['Battle Strength','battleStrength']].map(([label, fld]) => (
              <div key={fld} style={{ background: 'rgba(9,24,40,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(9,24,40,0.08)' }}>
                <div style={{ fontSize: 11, color: bgLight, marginBottom: 6, fontWeight: 700 }}>{label}</div>
                {isAdmin && onFieldSave ? <EditableField value={card[fld]} label={fld} onSave={v => onFieldSave(animalName, fld, v)} color="#3A3028" multiline /> : <div style={{ fontSize: 14, color: '#3A3028', lineHeight: 1.6 }}>{card[fld] || '-'}</div>}
              </div>
            ))}
            {galleryImages.length > 0 && (
              <div style={{ background: 'rgba(9,24,40,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(9,24,40,0.08)', gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Photo Gallery</div>
                <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                  {galleryImages.map((img, i) => !imgErrors[`gallery-${i}`] && (
                    <div key={i} style={{ flexShrink: 0, textAlign: 'center' }}>
                      <img src={img.url} alt={`${animalName}`} onError={() => handleImgError(`gallery-${i}`)} onClick={() => setLightbox({ url: img.url, source: img.source, name: animalName })} style={{ height: 160, width: 200, objectFit: 'cover', borderRadius: 8, display: 'block', cursor: 'zoom-in' }} />
                      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{img.source}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {lightbox && (
              <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 20 }}>
                <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                  <img src={lightbox.url} alt={lightbox.name} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8, display: 'block' }} />
                  <button onClick={() => setLightbox(null)} aria-label="Close lightbox" style={{ position: 'absolute', top: -12, right: -12, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
            )}
            <div style={{ background: 'rgba(9,24,40,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(9,24,40,0.08)', gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Fun Facts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(card.funFacts || []).map((fact, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ color: bgLight, fontWeight: 700, flexShrink: 0 }}>{i+1}.</span>
                    <span style={{ fontSize: 14, color: '#3A3028', lineHeight: 1.6 }}>{fact}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, gridColumn: '1 / -1', flexWrap: 'wrap' }}>
              {[['Size', card.size], ['Lifespan', card.lifespan], ['Speed', card.speed]].map(([label, val]) => val && (
                <div key={label} style={{ background: `${bgLight}15`, borderRadius: 8, padding: '10px 16px', border: `1px solid ${bgLight}33`, flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: bgLight, marginBottom: 4, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#3A3028' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── COMPARE MODAL ─────────────────────────────────────────────────────────────
function CompareModal({ teamA, teamB, cardA, cardB, isMammal, onClose }) {
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
      <div onClick={e => e.stopPropagation()} style={{ background: isMammal ? 'rgba(22,163,74,0.10)' : 'rgba(9,24,40,0.10)', border: `1px solid ${isMammal ? 'rgba(22,163,74,0.30)' : 'rgba(9,24,40,0.25)'}`, borderRadius: 12, padding: 20, maxWidth: 700, width: '100%', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: accent, margin: 0, fontSize: 20 }}>Head-to-Head</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 20, gap: 8 }}>
          <div style={{ flex: 1, textAlign: 'right', paddingRight: 12 }}>
            {!isMammal && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TeamLogo espnId={teamA.espnId} name={teamA.name} size={44} /></div>}
            {isMammal && cardA?.wikiImageUrl && <img src={cardA.wikiImageUrl} alt={teamA.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block', marginLeft: 'auto', marginBottom: 6 }} />}
            <div style={{ fontSize: 11, color: accent }}>#{teamA.seed}</div>
            <div style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{teamA.name}</div>
          </div>
          <div style={{ fontSize: 13, color: '#444', fontWeight: 700, flexShrink: 0, paddingBottom: 4 }}>VS</div>
          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12 }}>
            {!isMammal && <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}><TeamLogo espnId={teamB.espnId} name={teamB.name} size={44} /></div>}
            {isMammal && cardB?.wikiImageUrl && <img src={cardB.wikiImageUrl} alt={teamB.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 6 }} />}
            <div style={{ fontSize: 11, color: accent }}>#{teamB.seed}</div>
            <div style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{teamB.name}</div>
          </div>
        </div>
        {stats.map(([label, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', borderTop: '1px solid rgba(0,0,0,0.10)', padding: '10px 0', gap: 8 }}>
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

// ── VIEW BRACKET MODAL ────────────────────────────────────────────────────────
function ViewBracketModal({ data, onClose }) {
  const { displayName, bracket, isMammal } = data;
  const regions = ['East', 'West', 'South', 'Midwest'];
  const rounds = ['R64','R32','S16','E8'];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ ...S.card, maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: isMammal ? '#86efac' : MINT_FG, margin: 0 }}>{displayName}'s Bracket</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {regions.map(region => (
            <div key={region} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: isMammal ? '#86efac' : MINT_FG, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>{region}</div>
              {(bracket[region]?.rounds || []).slice(0, 4).map((roundGames, rIdx) => (
                <div key={rIdx} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{rounds[rIdx]}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {roundGames.map((game, gIdx) => game.winner && (
                      <div key={gIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}>
                        {!isMammal && <TeamLogo espnId={game.winner?.espnId} name={game.winner?.name} size={16} />}
                        <span style={{ color: isMammal ? '#86efac' : MINT_FG, fontWeight: 600 }}>#{game.winner.seed}</span>
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
              <div style={{ fontSize: 11, color: '#C4952A', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Champion</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#C4952A', fontFamily: "'Libre Bodoni', serif" }}>{bracket.championship.winner.name}</div>
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

// ── BRACKET PICK HELPERS ──────────────────────────────────────────────────────
function extractFFPlaceholders(bracket) {
  if (!bracket || typeof bracket !== 'object') return {};
  const out = {};
  ['East','West','South','Midwest'].forEach(region => {
    (bracket[region]?.rounds?.[0] || []).forEach(game => {
      ['top','bottom'].forEach(side => {
        const slot = game[side];
        if (slot?.isFFPlaceholder && slot.ffTeams) out[`${region}-${slot.seed}`] = slot;
      });
    });
  });
  return out;
}

function applyFirstFourPicks(bracket, picks) {
  if (!picks || Object.keys(picks).length === 0) return bracket;
  const next = JSON.parse(JSON.stringify(bracket));
  Object.entries(picks).forEach(([key, winnerName]) => {
    const [region, seedStr] = key.split('-');
    const seed = parseInt(seedStr);
    if (!region || !seed) return;
    const r64 = next[region]?.rounds?.[0];
    if (!r64) return;
    r64.forEach(game => {
      ['top','bottom'].forEach(side => {
        const slot = game[side];
        if (slot?.isFFPlaceholder && Number(slot.seed) === seed) {
          const winner = slot.ffTeams?.find(t => t.name === winnerName);
          if (winner) game[side] = { ...winner, isFFPlaceholder: false };
        }
      });
    });
  });
  return next;
}

// ── ADMIN TEAM ENTRY PANEL ────────────────────────────────────────────────────
function makePlaceholderRoster() {
  return {
    year: new Date().getFullYear(),
    East:    Array(16).fill(null).map((_, i) => ({ seed: i+1, name: `Seed ${i+1}`, espnId: '', firstFour: false })),
    West:    Array(16).fill(null).map((_, i) => ({ seed: i+1, name: `Seed ${i+1}`, espnId: '', firstFour: false })),
    South:   Array(16).fill(null).map((_, i) => ({ seed: i+1, name: `Seed ${i+1}`, espnId: '', firstFour: false })),
    Midwest: Array(16).fill(null).map((_, i) => ({ seed: i+1, name: `Seed ${i+1}`, espnId: '', firstFour: false })),
  };
}

// Sample rows shown in the UI so the user can see the expected format.
// These are real 2024 tournament teams — replace with current year's teams each March.
const CSV_SAMPLE_ROWS = [
  { region: 'East',    seed: 1,  name: 'Connecticut',   espnId: '41',   ff: 'no'  },
  { region: 'East',    seed: 2,  name: 'Iowa State',    espnId: '66',   ff: 'no'  },
  { region: 'East',    seed: 11, name: 'Duquesne',      espnId: '213',  ff: 'no'  },
  { region: 'East',    seed: 11, name: 'UAB',           espnId: '5596', ff: 'yes' },
  { region: 'West',    seed: 1,  name: 'North Carolina', espnId: '153', ff: 'no'  },
  { region: 'West',    seed: 2,  name: 'Arizona',       espnId: '12',   ff: 'no'  },
  { region: 'South',   seed: 1,  name: 'Houston',       espnId: '248',  ff: 'no'  },
  { region: 'South',   seed: 2,  name: 'Marquette',     espnId: '269',  ff: 'no'  },
  { region: 'Midwest', seed: 1,  name: 'Purdue',        espnId: '2509', ff: 'no'  },
  { region: 'Midwest', seed: 2,  name: 'Tennessee',     espnId: '2633', ff: 'no'  },
];

const CSV_TEMPLATE_HEADER = 'Region,Seed,Team Name,ESPN ID,First Four\n';
const CSV_TEMPLATE_ROWS   = ['East','West','South','Midwest'].flatMap(r =>
  Array.from({ length: 16 }, (_, i) => `${r},${i + 1},Team Name Here,ESPN_ID_Here,no`)
).join('\n');

function parseRosterCSV(text) {
  const lines  = text.trim().split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Region'));
  const roster = { East: [], West: [], South: [], Midwest: [] };
  const errors = [];
  lines.forEach((line, i) => {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 4) { errors.push(`Row ${i + 2}: needs at least 4 columns (Region, Seed, Name, ESPN ID)`); return; }
    const [region, seedStr, name, espnId, ff = 'no'] = parts;
    if (!['East','West','South','Midwest'].includes(region)) { errors.push(`Row ${i + 2}: unknown region "${region}" — must be East, West, South, or Midwest`); return; }
    const seed = parseInt(seedStr);
    if (!seed || seed < 1 || seed > 16) { errors.push(`Row ${i + 2}: invalid seed "${seedStr}"`); return; }
    roster[region].push({
      seed, name, espnId,
      firstFour: ['yes','y','true','1'].includes(ff.toLowerCase()),
      color: null, alternateColor: null,
    });
  });
  for (const r of ['East','West','South','Midwest']) roster[r].sort((a, b) => a.seed - b.seed);
  return { roster, errors };
}

function TeamEntryPanel({ onTeamsSaved, onRequestGenerateResearch, regionNames, onRegionNamesChange, sourcesData, onSaveSources }) {
  const [roster,        setRoster]       = useState(makePlaceholderRoster());
  const [activeRegion,  setActiveRegion] = useState('East');
  const [saving,        setSaving]       = useState(false);
  const [saved,         setSaved]        = useState(false);
  const [applying,      setApplying]     = useState(false);
  const [applied,       setApplied]      = useState(false);
  const [loading,       setLoading]      = useState(true);
  const [importing,     setImporting]    = useState(false);
  const [importMsg,     setImportMsg]    = useState(null); // { type: 'ok'|'err', text }
  const [showCsv,       setShowCsv]      = useState(false);
  const [csvText,       setCsvText]      = useState('');
  const [csvErrors,     setCsvErrors]    = useState([]);
  const [actionError,   setActionError]  = useState('');

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'teamRoster'));
        if (snap.exists()) {
          const d = snap.data();
          if (d._regionNames) onRegionNamesChange(d._regionNames);
          delete d.updatedAt; delete d._regionNames;
          const hasNames = ['East','West','South','Midwest'].some(r => (d[r] || []).some(t => t.name?.trim() && !t.name.startsWith('Seed')));
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

  const handleESPNImport = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const res  = await fetch('/api/import-bracket');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setRoster(prev => ({
        ...prev,
        East:    data.roster.East    || prev.East,
        West:    data.roster.West    || prev.West,
        South:   data.roster.South   || prev.South,
        Midwest: data.roster.Midwest || prev.Midwest,
      }));
      setSaved(false); setApplied(false);
      setImportMsg({ type: 'ok', text: `Imported ${data.teamCount || 64} teams from ESPN. Colors also loaded for the compare button. Review the fields below, then save.` });
    } catch (err) {
      setImportMsg({ type: 'err', text: err.message });
    }
    setImporting(false);
  };

  const handleCSVImport = () => {
    const { roster: parsed, errors } = parseRosterCSV(csvText);
    if (errors.length) { setCsvErrors(errors); return; }
    const totalTeams = Object.values(parsed).reduce((s, r) => s + r.length, 0);
    if (totalTeams < 4) { setCsvErrors(['No valid rows found. Make sure you pasted the data rows (not just the header).']); return; }
    setCsvErrors([]);
    setRoster(prev => ({ ...prev, ...parsed }));
    setSaved(false); setApplied(false);
    setShowCsv(false);
    setCsvText('');
    setImportMsg({ type: 'ok', text: `Imported ${totalTeams} teams from spreadsheet. Review below, then save.` });
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE_HEADER + CSV_TEMPLATE_ROWS], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'bracket-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading roster...</div>;
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: MINT_FG, marginBottom: 4 }}>Set Up This Year's Teams</h3>
          <p style={{ color: '#999', fontSize: 13 }}>Enter all 64 teams after Selection Sunday.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Year:</span>
            <input type="number" value={roster.year} onChange={e => { setRoster(p => ({ ...p, year: parseInt(e.target.value) })); setSaved(false); }} style={{ ...S.input, width: 82, padding: '6px 10px', fontSize: 13 }} />
          </div>
          <button style={{ ...S.btn(saved ? MINT_FG : NAVY, '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setSaving(true); try { await setDoc(doc(db, 'admin', 'teamRoster'), { ...roster, _regionNames: regionNames, updatedAt: serverTimestamp() }); setSaved(true); setActionError(''); } catch(e) { setActionError('Save failed: ' + e.message); } setSaving(false); }} disabled={saving}>{saving ? 'Saving...' : saved ? 'Roster Saved ✓' : 'Save Roster'}</button>
          {saved && <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setApplying(true); try { const nb = buildInitialBracketFromTeams(roster); await saveOfficialBracket(nb); setApplied(true); setActionError(''); onTeamsSaved(nb, roster); } catch(e) { setActionError('Apply failed: ' + e.message); } setApplying(false); }} disabled={applying}>{applying ? 'Applying...' : applied ? 'Applied! ✓' : 'Apply to Bracket'}</button>}
          {applied && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center' }}>Generate Research:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(99,102,241,0.3)', '#a5b4fc'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(99,102,241,0.5)' }} onClick={() => onRequestGenerateResearch(roster, r)}>{regionNames[r] || r}</button>
              ))}
            </div>
          )}
        </div>
      </div>
      {actionError && (
        <div style={{ margin: '8px 0 0', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} />{actionError}
        </div>
      )}

      {/* ── IMPORT OPTIONS ── */}
      <div style={{ ...S.card, marginBottom: 16, background: 'rgba(9,24,40,0.04)', borderColor: 'rgba(9,24,40,0.12)' }}>
        <div style={{ fontSize: 12, color: MINT_FG, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Import Teams</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: importMsg ? 10 : 0 }}>
          <button
            style={{ ...S.btn(NAVY, '#fff'), padding: '8px 18px', fontSize: 13, opacity: importing ? 0.7 : 1 }}
            onClick={handleESPNImport}
            disabled={importing}
            title="Fetches the bracket from ESPN automatically. Only works after Selection Sunday in March."
          >
            {importing ? 'Importing from ESPN…' : 'Auto-Import from ESPN'}
          </button>
          <button
            style={{ ...S.btn(showCsv ? '#4f46e5' : '#6366f1', '#fff'), padding: '8px 18px', fontSize: 13 }}
            onClick={() => { setShowCsv(v => !v); setCsvErrors([]); }}
          >
            {showCsv ? 'Hide CSV Import' : 'Import from Spreadsheet'}
          </button>
        </div>

        {importMsg && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 12,
            background: importMsg.type === 'ok' ? 'rgba(30,107,71,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${importMsg.type === 'ok' ? 'rgba(30,107,71,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: importMsg.type === 'ok' ? MINT_FG : '#ef4444',
          }}>
            {importMsg.text}
          </div>
        )}

        {showCsv && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#7A7068' }}>
                1. Download the template, fill it in Excel or Google Sheets, then paste it back here.
              </span>
              <button style={{ ...S.btn('#374151', '#fff'), padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={downloadTemplate}>
                Download Template CSV
              </button>
            </div>

            {/* Sample data table */}
            <div style={{ marginBottom: 12, borderRadius: 8, border: '1px solid rgba(9,24,40,0.12)', overflow: 'hidden' }}>
              <div style={{ background: 'rgba(9,24,40,0.06)', padding: '6px 12px', fontSize: 11, color: '#7A7068', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                Sample format (2024 tournament — replace with current year)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'rgba(9,24,40,0.04)' }}>
                    {['Region','Seed','Team Name','ESPN ID','First Four'].map(h => (
                      <th key={h} style={{ padding: '5px 10px', textAlign: 'left', color: '#7A7068', fontWeight: 700, fontSize: 11, borderBottom: '1px solid rgba(9,24,40,0.1)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CSV_SAMPLE_ROWS.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(9,24,40,0.06)', background: i % 2 === 0 ? 'transparent' : 'rgba(9,24,40,0.02)' }}>
                      <td style={{ padding: '4px 10px', color: RC[row.region] || '#1A1208', fontWeight: 700 }}>{row.region}</td>
                      <td style={{ padding: '4px 10px', color: '#1A1208', fontFamily: 'monospace' }}>{row.seed}</td>
                      <td style={{ padding: '4px 10px', color: '#1A1208' }}>{row.name}</td>
                      <td style={{ padding: '4px 10px', color: '#1A1208', fontFamily: 'monospace' }}>{row.espnId}</td>
                      <td style={{ padding: '4px 10px', color: row.ff === 'yes' ? '#6366f1' : '#7A7068', fontWeight: row.ff === 'yes' ? 700 : 400 }}>{row.ff}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '6px 12px', fontSize: 11, color: '#7A7068', background: 'rgba(9,24,40,0.02)', borderTop: '1px solid rgba(9,24,40,0.08)' }}>
                First Four (FF) teams share a seed number — mark both as <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>yes</code> to flag them.
                ESPN ID: find it in the URL at espn.com/mens-college-basketball/team/_/id/<strong>41</strong>/connecticut
              </div>
            </div>
            <textarea
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setCsvErrors([]); }}
              placeholder={'Region,Seed,Team Name,ESPN ID,First Four\nEast,1,Duke,150,no\nEast,2,Alabama,333,no\n...'}
              style={{ ...S.input, width: '100%', boxSizing: 'border-box', height: 180, fontFamily: 'monospace', fontSize: 12, resize: 'vertical', padding: '10px 12px' }}
            />
            {csvErrors.length > 0 && (
              <div style={{ marginTop: 6, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6 }}>
                {csvErrors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#ef4444' }}>{e}</div>)}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button style={{ ...S.btn(MINT_FG, '#fff'), padding: '8px 18px', fontSize: 13 }} onClick={handleCSVImport} disabled={!csvText.trim()}>
                Parse & Fill Teams
              </button>
              <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
                ESPN ID tip: espn.com/mens-college-basketball/team/_/id/<strong>150</strong>/duke
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── REGION NAMES ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: MINT_FG, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
        {['East','West','South','Midwest'].map(r => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
            <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12, borderColor: (regionNames[r] || '').length > 15 ? '#f59e0b' : undefined }} />
            {(regionNames[r] || '').length > 15 && <AlertTriangle size={12} color="#f59e0b" title="Long names may wrap in the bracket view." style={{ flexShrink: 0 }} />}
          </div>
        ))}
      </div>

      {onSaveSources && (
        <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.25)' }}>
          <h3 style={{ color: '#a5b4fc', marginBottom: 4, fontSize: 15 }}>Research Sources</h3>
          <p style={{ color: '#777', fontSize: 12, marginBottom: 10 }}>URLs the AI will read before generating research.</p>
          {sourcesData.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
              <span style={{ flex: 1, fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name} — {s.url}</span>
              <button onClick={() => onSaveSources(sourcesData.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input id="src-name" placeholder="Source name" style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 12 }} />
            <input id="src-url" placeholder="URL" style={{ ...S.input, flex: 2, padding: '6px 10px', fontSize: 12 }} />
            <button style={{ ...S.btn('#6366f1', '#fff'), padding: '6px 14px', fontSize: 12 }} onClick={() => {
              const name = document.getElementById('src-name').value.trim();
              const url  = document.getElementById('src-url').value.trim();
              if (!url) return;
              onSaveSources([...sourcesData, { url, name: name || url, primary: true }]);
              document.getElementById('src-name').value = '';
              document.getElementById('src-url').value = '';
            }}>+ Add</button>
          </div>
        </div>
      )}

      {/* ── MANUAL TEAM GRID ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>●</span>{regionNames[r] || r}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(roster[activeRegion] || []).map((team, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.07)' }}>
            {team.color && <div style={{ width: 10, height: 10, borderRadius: '50%', background: `#${team.color}`, flexShrink: 0, border: '1px solid rgba(0,0,0,0.15)' }} title={`Team color: #${team.color}`} />}
            <input type="number" min="1" max="16" value={team.seed} onChange={e => updateTeam(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)} style={{ ...S.input, width: 44, padding: '5px 5px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Team name" value={team.name} onChange={e => updateTeam(activeRegion, idx, 'name', e.target.value)} style={{ ...S.input, flex: 2, padding: '5px 8px', fontSize: 13 }} />
            <input placeholder="ESPN ID" value={team.espnId} onChange={e => updateTeam(activeRegion, idx, 'espnId', e.target.value)} style={{ ...S.input, width: 76, padding: '5px 8px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={team.firstFour} onChange={e => updateTeam(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: team.firstFour ? '#818cf8' : '#888', whiteSpace: 'nowrap', fontWeight: team.firstFour ? 700 : 400 }}>FF</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAMMAL ENTRY PANEL ────────────────────────────────────────────────────────
function MammalEntryPanel({ onAnimalsSaved, onRequestGenerateMammalResearch, onRefetchImages, regionNames, onRegionNamesChange, sourcesData, onSaveSources }) {
  const [roster, setRoster] = useState({ East: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), West: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), South: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })), Midwest: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })) });
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const [applying, setApplying] = useState(false); const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'mammalRoster'));
        if (snap.exists()) { const d = snap.data(); if (d._regionNames) onRegionNamesChange(d._regionNames); delete d.updatedAt; delete d._regionNames; setRoster(d); }
      } catch {}
      setLoading(false);
    })();
  }, []);
  const updateAnimal = (region, idx, field, value) => { setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[region][idx][field] = value; return n; }); setSaved(false); setApplied(false); };
  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading...</div>;
  return (
    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: '#86efac', marginBottom: 4 }}>Set Up Mammal Madness Animals</h3>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#86efac', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
            {['East','West','South','Midwest'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
                <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12, borderColor: (regionNames[r] || '').length > 15 ? '#f59e0b' : undefined }} />
                {(regionNames[r] || '').length > 15 && <AlertTriangle size={12} color="#f59e0b" title="Long names may wrap in the bracket view." style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...S.btn(saved ? MINT_FG : NAVY, '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setSaving(true); try { await saveMammalRoster({ ...roster, _regionNames: regionNames }); setSaved(true); setActionError(''); } catch(e) { setActionError('Save failed: ' + e.message); } setSaving(false); }} disabled={saving}>{saving ? 'Saving...' : saved ? 'Saved' : 'Save Roster'}</button>
          <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setApplying(true); try { const nb = buildInitialBracketFromTeams(roster); await saveMammalOfficialBracket(nb); setApplied(true); setActionError(''); onAnimalsSaved(nb, roster); } catch(e) { setActionError('Apply failed: ' + e.message); } setApplying(false); }} disabled={applying}>{applying ? 'Applying...' : applied ? 'Applied!' : 'Apply to Bracket'}</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', minWidth: 100 }}>Generate Facts:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(99,102,241,0.3)', '#a5b4fc'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(99,102,241,0.5)' }} onClick={() => onRequestGenerateMammalResearch(roster, r)}>{regionNames[r] || r}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', minWidth: 100 }}>Re-fetch Images:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(20,184,166,0.2)', '#5eead4'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(20,184,166,0.4)' }} onClick={() => onRefetchImages && onRefetchImages(r)}>{regionNames[r] || r}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {actionError && (
        <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={13} />{actionError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>●</span>{regionNames[r] || r}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(roster[activeRegion] || []).map((animal, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <input type="number" min="1" max="16" value={animal.seed} onChange={e => updateAnimal(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)} style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Animal name" value={animal.name} onChange={e => updateAnimal(activeRegion, idx, 'name', e.target.value)} style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={animal.firstFour} onChange={e => updateAnimal(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: animal.firstFour ? '#818cf8' : '#888', fontWeight: animal.firstFour ? 700 : 400 }}>FF</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PRIVACY POLICY ────────────────────────────────────────────────────────────
function PrivacyPolicyPage({ onBack }) {
  const bodyColor = '#3A3028';
  const strongColor = '#1A1208';
  return (
    <div style={{ minHeight: '100dvh', background: '#E8E2D8', color: '#1A1208', fontFamily: "'Public Sans', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={onBack} style={{ background: '#F4EFE6', border: '2px solid rgba(9,24,40,0.20)', borderRadius: 10, padding: '7px 16px', color: '#3A3028', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 32, boxShadow: '3px 4px 10px rgba(9,24,40,0.10)' }}>← Back</button>
        <h1 style={{ fontFamily: "'Libre Bodoni', serif", color: MINT_FG, marginBottom: 4, fontSize: 32 }}>Privacy Policy</h1>
        <div style={{ marginBottom: 32, padding: '14px 16px', background: '#F4EFE6', borderRadius: 12, border: '2px solid rgba(9,24,40,0.12)', fontSize: 13, color: '#7A7068' }}>
          <div><strong style={{ color: '#1A1208' }}>Application:</strong> Hart Middle School March Madness Bracket Challenge</div>
          <div><strong style={{ color: '#1A1208' }}>Operated by:</strong> Science Teacher, Hart Middle School, Rochester Community Schools</div>
          <div><strong style={{ color: '#1A1208' }}>Last Updated:</strong> June 2026</div>
        </div>
        {[
          ['1. Introduction', 'This Privacy Policy describes how the Hart Middle School March Madness Bracket Challenge ("the Application") collects, uses, and protects information about its users. This Application is an educational tool developed and operated by a Science Teacher at Hart Middle School, Rochester Community Schools. It is not a commercial product and is not affiliated with any outside organization.'],
          ['2. Authentication', 'Users sign in with their school Google account (@rcs-k12.us) via Google Sign-In. The Application receives the user\'s Google display name and school email address at sign-in. Passwords are never seen or stored by the Application — authentication is handled entirely by Google. The school email is used solely to determine the user\'s role (student, teacher, or administrator) within the Application.'],
          ['3. Information Collected', null],
          ['4. Use of Information', 'Information collected is used solely to save the user\'s bracket picks between sessions, display the user\'s name on the leaderboard, calculate and display the user\'s score, and assign the user to their school. The Application does not use collected information for advertising, profiling, or any purpose unrelated to the bracket competition.'],
          ['5. Data Storage and Security', 'All user data is stored in Google Firebase, a cloud infrastructure service provided by Google LLC, subject to Google\'s enterprise security standards. No external parties have access to user data stored within the Application. The application operator does not share data with any third party, vendor, or external service. All data is encrypted in transit using TLS.'],
          ['6. Data Retention', 'User data is retained only for the duration of the tournament period. At the conclusion of each tournament season, all data is reviewed and cleared by the school administrator. Administrators can delete any user\'s data at any time upon request.'],
          ['7. Children\'s Privacy', 'This Application is designed for use under direct teacher supervision within a school setting. No information is sold, shared, or disclosed to third parties. No behavioral advertising or tracking is conducted. School administrators retain the ability to review and delete all data upon request.'],
          ['8. AI-Generated Content', 'This Application uses artificial intelligence (Claude, provided by Anthropic, PBC) to generate educational content about tournament participants. Student data is never used as input to the AI content generation system.'],
          ['9. Contact Information', 'Rochester Community Schools'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom: 28 }}>
            <h2 style={{ color: MINT_FG, fontSize: 16, marginBottom: 10, fontFamily: "'Libre Bodoni', serif", borderBottom: `1px solid rgba(30,107,71,0.2)`, paddingBottom: 6 }}>{title}</h2>
            {title === '3. Information Collected' && (
              <div>
                <p style={{ color: bodyColor, fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>The Application collects only the following:</p>
                <ul style={{ color: bodyColor, fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
                  <li><strong style={{ color: strongColor }}>Display Name</strong> — the user's name as provided by their school Google account.</li>
                  <li><strong style={{ color: strongColor }}>School Email</strong> — the user's @rcs-k12.us email address, used only to determine their role (student, teacher, or administrator). Never shared or used for any other purpose.</li>
                  <li><strong style={{ color: strongColor }}>School</strong> — the school selected by the user during onboarding (Hart, Van Hoosen, Reuther, or West), shown on the leaderboard.</li>
                  <li><strong style={{ color: strongColor }}>Bracket Picks</strong> — the tournament predictions entered by the user.</li>
                  <li><strong style={{ color: strongColor }}>Score</strong> — a numerical score calculated automatically based on the user's picks and tournament results.</li>
                </ul>
                <p style={{ color: bodyColor, fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>The Application does <strong style={{ color: strongColor }}>not</strong> collect passwords, device identifiers, location data, browsing history, or any information from sources outside the Application or the user's school Google account.</p>
              </div>
            )}
            {body && <p style={{ color: bodyColor, fontSize: 13, lineHeight: 1.8 }}>{body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TERMS OF SERVICE ──────────────────────────────────────────────────────────
function TermsOfServicePage({ onBack }) {
  return (
    <div style={{ minHeight: '100dvh', background: '#E8E2D8', color: '#1A1208', fontFamily: "'Public Sans', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={onBack} style={{ background: '#F4EFE6', border: '2px solid rgba(9,24,40,0.20)', borderRadius: 10, padding: '7px 16px', color: '#3A3028', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 32, boxShadow: '3px 4px 10px rgba(9,24,40,0.10)' }}>← Back</button>
        <h1 style={{ fontFamily: "'Libre Bodoni', serif", color: MINT_FG, marginBottom: 4, fontSize: 32 }}>Terms of Service</h1>
        <div style={{ marginBottom: 32, padding: '14px 16px', background: '#F4EFE6', borderRadius: 12, border: '2px solid rgba(9,24,40,0.12)', fontSize: 13, color: '#7A7068' }}>
          <div><strong style={{ color: '#1A1208' }}>Application:</strong> Hart Middle School March Madness Bracket Challenge</div>
          <div><strong style={{ color: '#1A1208' }}>Operated by:</strong> Science Teacher, Hart Middle School, Rochester Community Schools</div>
          <div><strong style={{ color: '#1A1208' }}>Last Updated:</strong> June 2026</div>
        </div>
        {[
          ['1. Agreement to Terms', 'By accessing or using the Hart Middle School March Madness Bracket Challenge ("the Application"), you agree to be bound by these Terms. If you do not agree, you may not use the Application. These Terms apply to all users including students, teachers, and school staff of Rochester Community Schools.'],
          ['2. Description', 'The Application is an educational web application facilitating school-based bracket prediction competitions tied to the NCAA Men\'s Basketball Tournament and the March Mammal Madness competition organized by Arizona State University. It is not a commercial product and is provided solely for educational purposes.'],
          ['3. Access', 'Access to the Application requires a school Google account (@rcs-k12.us). Sign-in is handled via Google Sign-In. Access is open to currently enrolled students, teachers, and staff at Rochester Community Schools schools, as well as such other individuals as may be expressly authorized by the school administrator.'],
          ['4. Acceptable Use', 'Users may complete bracket predictions, review educational content, and view the leaderboard. Users may not attempt to manipulate scores or results, use the Application for purposes other than the bracket competition, or engage in any conduct that violates Rochester Community Schools\' Acceptable Use Policy.'],
          ['5. Leaderboard and Scoring', 'Scores are calculated automatically based on results entered by the school administrator. The leaderboard, including participant names, school, and scores, is visible to all users of the Application. By participating, users consent to their display name, school, and score being visible to other users.'],
          ['6. Disclaimer of Warranties', 'THE APPLICATION IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND. THE APPLICATION OPERATOR DOES NOT WARRANT THAT THE APPLICATION WILL BE UNINTERRUPTED OR ERROR-FREE.'],
          ['7. Governing Law', 'These Terms shall be governed by the laws of the State of Michigan and applicable federal education law including FERPA and COPPA.'],
          ['8. Contact Information', 'Rochester Community Schools'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom: 28 }}>
            <h2 style={{ color: MINT_FG, fontSize: 16, marginBottom: 10, fontFamily: "'Libre Bodoni', serif", borderBottom: `1px solid rgba(30,107,71,0.2)`, paddingBottom: 6 }}>{title}</h2>
            <p style={{ color: '#3A3028', fontSize: 13, lineHeight: 1.8 }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI CALL ───────────────────────────────────────────────────────────────────
async function callAI(prompt, sources = [], textOnly = false) {
  const BACKOFF_MS = [60000, 90000, 120000];
  let attempt = 0;
  while (true) {
    let res;
    try {
      res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, sources, textOnly }) });
    } catch (e) { await new Promise(r => setTimeout(r, 15000)); continue; }
    if (res.status === 429) {
      const body = await res.text().catch(() => '');
      if (body.toLowerCase().includes('daily') || body.toLowerCase().includes('tomorrow')) throw new Error('Daily quota reached. Try again tomorrow.');
      await new Promise(r => setTimeout(r, BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]));
      continue;
    }
    if (!res.ok) throw new Error('AI proxy error ' + res.status);
    attempt = 0;
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.result ?? null;
  }
}

async function generateResearchForTeam(teamName, seed, region, espnId, sources = []) {
  const prompt = `You are writing a basketball team scouting report for middle school students (grades 6-8) for the ${new Date().getFullYear()} NCAA Tournament.
Write about: ${teamName} (${region} Region, Seed #${seed})
Use provided sources first. Fill every field with real information. Never leave blank.
Return ONLY valid JSON:
{"record":"W-L","rank":"#N or Unranked","coach":"Coach Name","conference":"Conference Name","kenpom":"#N","offense":"NNN.N","defense":"NN.N","pace":"NN.N","keyPlayers":[{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"brief note"},{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"brief note"}],"injuries":"None reported or description","odds":"+XXXX","strengths":"2-3 sentences","weaknesses":"2-3 sentences","analystNote":"1-2 sentences","espnId":"${espnId || ''}"}`;
  return callAI(prompt, sources);
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  // ── USER IDENTITY (no login) ──────────────────────────────────────────────
  const [uid,          setUid]          = useState(null);
  const [displayName,  setDisplayName]  = useState('');
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authError,    setAuthError]    = useState('');
  const [isTeacher,    setIsTeacher]    = useState(false);
  const [teacherSchool,setTeacherSchool]= useState(null);
  const [appReady,     setAppReady]     = useState(false);
  const [school,       setSchool]       = useState('');
  const [profileLoaded,setProfileLoaded] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState('all');
  const [mammalBattleVideos, setMammalBattleVideos] = useState({});
  const [selectedSchoolCard, setSelectedSchoolCard] = useState(null);
  const [flashedScores, setFlashedScores] = useState({});
  const [teacherRosterStudents, setTeacherRosterStudents] = useState([]);
  const [teacherRosterLoading, setTeacherRosterLoading] = useState(false);
  const [teacherActiveView, setTeacherActiveView] = useState('leaderboard');
  const [teacherTournament, setTeacherTournament] = useState('basketball');
  const [adminPeopleAdmins, setAdminPeopleAdmins] = useState([]);
  const [adminPeopleTeachers, setAdminPeopleTeachers] = useState({});
  const [adminPeopleLoading, setAdminPeopleLoading] = useState(false);
  const [adminNewAdminEmail, setAdminNewAdminEmail] = useState('');
  const [adminNewTeacherEmail, setAdminNewTeacherEmail] = useState('');
  const [adminNewTeacherSchool, setAdminNewTeacherSchool] = useState('Hart');
  const [adminMammalVideos, setAdminMammalVideos] = useState({});
  const [adminMammalVideosSaving, setAdminMammalVideosSaving] = useState(false);

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  const [isAdmin,      setIsAdmin]      = useState(false);

  // ── APP STATE ─────────────────────────────────────────────────────────────
  const [tab,              setTab]             = useState('bracket');
  const [menuOpen,         setMenuOpen]        = useState(false);
  const [bracket,          setBracket]         = useState(() => buildInitialBracket());
  const [officialBracket,  setOfficialBracket] = useState(null);
  const [locked,           setLocked]          = useState(false);
  const [leaderboard,      setLeaderboard]     = useState([]);
  const [saving,           setSaving]          = useState(false);
  const [lastSaved,        setLastSaved]       = useState(null);
  const [researchData,     setResearchData]    = useState({});
  const [selectedTeam,        setSelectedTeam]        = useState(null);
  const [bbActiveRegion,      setBbActiveRegion]      = useState('East');
  const [compareModal,        setCompareModal]        = useState(null);
  const [comparePicking,      setComparePicking]      = useState(false);
  const [adminSubTab,         setAdminSubTab]         = useState('dashboard');
  const [generating,       setGenerating]      = useState(false);
  const [genProgress,      setGenProgress]     = useState({ done: 0, total: 0, current: '' });
  const [genError,         setGenError]        = useState('');
  const [firstFourPicks,   setFirstFourPicks]  = useState({});
  const [ffPlaceholders,   setFfPlaceholders]  = useState({});
  const [tournamentYear,   setTournamentYear]  = useState(CURRENT_YEAR);
  const [yearDraft,          setYearDraft]          = useState(String(CURRENT_YEAR));
  const [yearSaving,         setYearSaving]         = useState(false);
  const [yearSaveError,      setYearSaveError]      = useState('');
  const [teacherRosterError, setTeacherRosterError] = useState('');
  const [markTeacherMsg,     setMarkTeacherMsg]     = useState(null);
  const [liveScores,         setLiveScores]         = useState({});
  const [activeTournament, setActiveTournament] = useState('basketball');
  const [confirmDialog,    setConfirmDialog]   = useState(null);
  const [bbRegionNames,    setBbRegionNames]   = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });
  const [bbSources,        setBbSources]       = useState([]);
  const [mammalSources,    setMammalSources]   = useState([]);
  const [viewingBracket,   setViewingBracket]  = useState(null);
  const [loadingBracket,   setLoadingBracket]  = useState(null);
  const [legalPage,        setLegalPage]       = useState(null);

  // Mammal state
  const [mammalBracket,         setMammalBracket]         = useState(() => buildInitialBracket());
  const [mammalOfficialBracket, setMammalOfficialBracket] = useState(null);
  const [mammalLocked,          setMammalLocked]          = useState(false);
  const [mammalLeaderboard,     setMammalLeaderboard]     = useState([]);
  const [mammalResearchData,    setMammalResearchData]    = useState({});
  const [mammalSelectedAnimal,  setMammalSelectedAnimal]  = useState(null);
  const [mammalActiveRegion,    setMammalActiveRegion]    = useState('East');
  const [mammalFirstFourPicks,  setMammalFirstFourPicks]  = useState({});
  const [mammalFfPlaceholders,  setMammalFfPlaceholders]  = useState({});
  const [mammalGenerating,      setMammalGenerating]      = useState(false);
  const [mammalGenProgress,     setMammalGenProgress]     = useState({ done: 0, total: 0, current: '' });
  const [mammalGenError,        setMammalGenError]        = useState('');
  const [mammalGeneratingOne,   setMammalGeneratingOne]   = useState(null);
  const [mammalRegionNames,     setMammalRegionNames]     = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });
  const [mammalLastSaved,       setMammalLastSaved]       = useState(null);

  const saveTimer       = useRef(null);
  const mammalSaveTimer = useRef(null);
  const prevBracket     = useRef(null);
  const prevFF          = useRef(null);
  const prevMBracket    = useRef(null);
  const prevMFF         = useRef(null);

  // ── DERIVED STATE ─────────────────────────────────────────────────────────
  const allTeamNames   = useMemo(() => Object.keys(researchData).sort(), [researchData]);
  const allAnimalNames = useMemo(() => Object.keys(mammalResearchData).sort(), [mammalResearchData]);
  const score          = useMemo(() => calcScore(bracket, officialBracket), [bracket, officialBracket]);
  const mammalScore    = useMemo(() => calcScore(mammalBracket, mammalOfficialBracket), [mammalBracket, mammalOfficialBracket]);
  const myRank         = useMemo(() => leaderboard.findIndex(e => e.uid === uid) + 1, [leaderboard, uid]);
  const mammalMyRank   = useMemo(() => mammalLeaderboard.findIndex(e => e.uid === uid) + 1, [mammalLeaderboard, uid]);
  const ffGamesList    = useMemo(() => Object.entries(ffPlaceholders).map(([key, slot]) => { const [region] = key.split('-'); return { region, seed: slot.seed, ffTeams: slot.ffTeams, key }; }), [ffPlaceholders]);
  const mammalFFGamesList = useMemo(() => Object.entries(mammalFfPlaceholders).map(([key, slot]) => { const [region] = key.split('-'); return { region, seed: slot.seed, ffTeams: slot.ffTeams, key }; }), [mammalFfPlaceholders]);

  const bbTeamsByRegion = useMemo(() => {
    const src = officialBracket ?? bracket;
    const empty = { East: [], West: [], South: [], Midwest: [] };
    if (!src) return empty;
    const result = { East: [], West: [], South: [], Midwest: [] };
    ['East', 'West', 'South', 'Midwest'].forEach(region => {
      (src[region]?.rounds?.[0] || []).forEach(game => {
        ['top', 'bottom'].forEach(side => {
          const slot = game[side];
          if (!slot) return;
          if (slot.isFFPlaceholder) {
            (slot.ffTeams || []).forEach(t => result[region].push({ name: t.name, seed: t.seed, espnId: t.espnId }));
          } else {
            result[region].push({ name: slot.name, seed: slot.seed, espnId: slot.espnId });
          }
        });
      });
      result[region].sort((a, b) => a.seed - b.seed);
    });
    return result;
  }, [officialBracket, bracket]);

  const mammalAnimalsByRegion = useMemo(() => {
    const result = { East: [], West: [], South: [], Midwest: [] };
    Object.entries(mammalResearchData).forEach(([name, card]) => {
      const region = (card?.region && result[card.region] !== undefined) ? card.region : 'East';
      result[region].push({ name, seed: card?.seed ?? 999 });
    });
    ['East', 'West', 'South', 'Midwest'].forEach(r => result[r].sort((a, b) => a.seed - b.seed));
    return result;
  }, [mammalResearchData]);

  // Auto-select first team/animal when research data first arrives, and activate their region tab
  useEffect(() => {
    if (allTeamNames.length === 0 || selectedTeam) return;
    const regions = ['East', 'West', 'South', 'Midwest'];
    for (const region of regions) {
      const first = bbTeamsByRegion[region]?.find(t => allTeamNames.includes(t.name));
      if (first) { setBbActiveRegion(region); setSelectedTeam(first.name); return; }
    }
    setSelectedTeam(allTeamNames[0]);
  }, [allTeamNames, bbTeamsByRegion]);

  useEffect(() => {
    if (allAnimalNames.length === 0 || mammalSelectedAnimal) return;
    const regions = ['East', 'West', 'South', 'Midwest'];
    for (const region of regions) {
      if (mammalAnimalsByRegion[region]?.length > 0) {
        setMammalActiveRegion(region);
        setMammalSelectedAnimal(mammalAnimalsByRegion[region][0].name);
        return;
      }
    }
    setMammalSelectedAnimal(allAnimalNames[0]);
  }, [allAnimalNames, mammalAnimalsByRegion]);

  // ── LOAD YEAR + SOURCES ───────────────────────────────────────────────────
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
      try { const s = await getDoc(doc(db, 'admin', 'bbSources')); if (s.exists() && s.data().sources) setBbSources(s.data().sources); } catch {}
      try { const s = await getDoc(doc(db, 'admin', 'mammalSources')); if (s.exists() && s.data().sources) setMammalSources(s.data().sources); } catch {}
    })();
  }, []);

  // ── FIREBASE AUTH STATE ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        setUid(user.uid);
        setDisplayName(user.displayName || 'Student');
        const role = await getUserRole(user.email);
        setIsAdmin(role.isAdmin);
        setIsTeacher(role.isTeacher);
        setTeacherSchool(role.teacherSchool);
      } else {
        setUid(null);
        setDisplayName('');
        setIsAdmin(false);
        setIsTeacher(false);
        setTeacherSchool(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // ── LOAD BRACKET ONCE UID IS SET ──────────────────────────────────────────
  useEffect(() => {
    if (!uid) { setSchool(''); setProfileLoaded(false); return; }
    (async () => {
      const profile = await getUserProfile(uid).catch(() => null);
      setSchool(profile?.school || '');
      setProfileLoaded(true);
      try {
        const saved = await loadBracket(uid);
        if (saved) {
          if (saved._firstFourPicks) {
            const { _firstFourPicks, ...b } = saved;
            setFirstFourPicks(_firstFourPicks);
            setBracket(applyFirstFourPicks(b, _firstFourPicks));
          } else setBracket(saved);
        }
      } catch (e) { console.warn('Failed to load bracket:', e); }
      try {
        const savedM = await loadMammalBracket(uid);
        if (savedM) {
          if (savedM._firstFourPicks) {
            const { _firstFourPicks, ...b } = savedM;
            setMammalFirstFourPicks(_firstFourPicks);
            setMammalBracket(applyFirstFourPicks(b, _firstFourPicks));
          } else setMammalBracket(savedM);
        }
      } catch (e) { console.warn('Failed to load mammal bracket:', e); }
    })();
  }, [uid]);

  // ── LIVE SUBSCRIPTIONS ────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    setAppReady(false);
    const u1 = subscribeToOfficialBracket(b => {
      setOfficialBracket(b);
      if (isAdmin) setBracket(b);
      setFfPlaceholders(prev => Object.keys(prev).length > 0 ? prev : extractFFPlaceholders(b));
    });
    const u2 = subscribeToConfig(cfg => {
      setLocked(cfg.locked ?? false);
      if (cfg.year) { setTournamentYear(cfg.year); setYearDraft(String(cfg.year)); }
      if (cfg.bbRegionNames) setBbRegionNames(cfg.bbRegionNames);
    });
    const u3 = subscribeToLeaderboard(entries => {
      setLeaderboard(prev => {
        const prevMap = Object.fromEntries(prev.map(e => [e.uid, e.score]));
        const flashed = {};
        entries.forEach(e => {
          if (prevMap[e.uid] !== undefined && prevMap[e.uid] !== e.score) {
            flashed[e.uid] = Date.now();
          }
        });
        if (Object.keys(flashed).length > 0) {
          setFlashedScores(f => ({ ...f, ...flashed }));
        }
        return entries;
      });
    });
    const u4 = subscribeToResearchData(data => {
      setResearchData(data);
      setSelectedTeam(prev => prev && data[prev] ? prev : (Object.keys(data)[0] || null));
    });
    const u5 = subscribeToMammalOfficialBracket(b => {
      setMammalOfficialBracket(b);
      if (isAdmin) setMammalBracket(b);
      setMammalFfPlaceholders(prev => Object.keys(prev).length > 0 ? prev : extractFFPlaceholders(b));
    });
    const u6 = subscribeToMammalConfig(cfg => setMammalLocked(cfg.locked ?? false));
    const u7 = subscribeToMammalLeaderboard(setMammalLeaderboard);
    const u8 = subscribeToMammalResearchData(data => {
      setMammalResearchData(data);
      setMammalSelectedAnimal(prev => prev && data[prev] ? prev : (Object.keys(data)[0] || null));
    });
    const u9 = subscribeToMammalBattleVideos(setMammalBattleVideos);
    // Mark app as ready after subscriptions are registered (they deliver data async)
    setAppReady(true);
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
  }, [uid, isAdmin]);

  // ── TEACHER ROSTER LOADER ────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'teacher' || !uid || !(isTeacher || isAdmin)) return;
    const schoolToFilter = teacherSchool || school;
    if (!schoolToFilter) return;
    setTeacherRosterLoading(true);
    getAllUsers().then(users => {
      setTeacherRosterStudents(users.filter(u => u.school === schoolToFilter));
      setTeacherRosterLoading(false);
    }).catch(() => setTeacherRosterLoading(false));
  }, [tab, uid, teacherSchool, school]);

  // ── ADMIN PEOPLE + VIDEOS LOADER ─────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'admin' || !isAdmin) return;
    setAdminPeopleLoading(true);
    Promise.all([getSuperAdmins(), getTeachers(), getMammalBattleVideos()]).then(([admins, teachers, videos]) => {
      setAdminPeopleAdmins(admins);
      setAdminPeopleTeachers(teachers);
      setAdminMammalVideos(videos);
      setAdminPeopleLoading(false);
    }).catch(() => setAdminPeopleLoading(false));
  }, [tab, isAdmin]);

  // ── LIVE SCORES ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
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
            const name = team.team?.displayName || '';
            const opp  = comp.competitors?.find(t => t.id !== team.id);
            scores[name] = { score: parseInt(team.score) || 0, oppScore: parseInt(opp?.score) || 0, period: event.status?.period, clock: event.status?.displayClock || '', state: status?.state, winner: team.winner ?? false };
          });
        });
        setLiveScores(scores);
      } catch {}
    };
    fetchScores();
    const interval = setInterval(fetchScores, 60_000);
    return () => clearInterval(interval);
  }, [uid]);

  // ── AUTO-SAVE (basketball) ────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || !displayName || (locked && !isAdmin)) return;
    const bStr = JSON.stringify(bracket), fStr = JSON.stringify(firstFourPicks);
    if (bStr === prevBracket.current && fStr === prevFF.current) return;
    prevBracket.current = bStr; prevFF.current = fStr;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveBracket(uid, { ...bracket, _firstFourPicks: firstFourPicks }, displayName);
        const hasPicks = ['East','West','South','Midwest'].some(r => bracket[r]?.rounds?.[0]?.some(g => g.winner));
        if (hasPicks) await updateLeaderboardEntry(uid, displayName, score, isTeacher, school);
        setLastSaved(new Date());
      } catch (e) { console.warn('Save failed:', e); }
      setSaving(false);
    }, 3000);
    return () => clearTimeout(saveTimer.current);
  }, [bracket, firstFourPicks, uid, displayName, locked, isAdmin, score, isTeacher]);

  // ── AUTO-SAVE (mammals) ───────────────────────────────────────────────────
  useEffect(() => {
    if (!uid || !displayName || (mammalLocked && !isAdmin)) return;
    const bStr = JSON.stringify(mammalBracket), fStr = JSON.stringify(mammalFirstFourPicks);
    if (bStr === prevMBracket.current && fStr === prevMFF.current) return;
    prevMBracket.current = bStr; prevMFF.current = fStr;
    clearTimeout(mammalSaveTimer.current);
    mammalSaveTimer.current = setTimeout(async () => {
      try {
        await saveMammalBracket(uid, { ...mammalBracket, _firstFourPicks: mammalFirstFourPicks }, displayName);
        const hasPicks = ['East','West','South','Midwest'].some(r => mammalBracket[r]?.rounds?.[0]?.some(g => g.winner));
        if (hasPicks) await updateMammalLeaderboardEntry(uid, displayName, mammalScore, isTeacher, school);
        setMammalLastSaved(new Date());
      } catch (e) { console.warn('Mammal save failed:', e); }
    }, 3000);
    return () => clearTimeout(mammalSaveTimer.current);
  }, [mammalBracket, mammalFirstFourPicks, uid, displayName, mammalLocked, isAdmin, mammalScore, isTeacher]);

  // ── GOOGLE AUTH ───────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setAuthLoading(true); setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged fires and sets uid/displayName
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setAuthError('Sign-in failed. Please try again.');
      }
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    setIsAdmin(false); setIsTeacher(false);
    setBracket(buildInitialBracket()); setMammalBracket(buildInitialBracket());
    setFirstFourPicks({}); setMammalFirstFourPicks({});
    setAppReady(false); setSchool(''); setProfileLoaded(false);
    setTeacherSchool(null);
    setTab('bracket');
    await signOut(auth);
  };

  const triggerChampionConfetti = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#091828', '#1E6B47', '#C4952A', '#B8CBE8', '#C2EDD5'],
      gravity: 1.1,
      scalar: 1.1,
      ticks: 200,
    });
  }, []);

  const handleSelectSchool = async (selectedSchool) => {
    await saveUserProfile(uid, { school: selectedSchool }).catch(() => {});
    setSchool(selectedSchool);
  };


  // ── PICK HANDLERS ─────────────────────────────────────────────────────────
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

  const makePickHandler = useCallback((setBracketFn, isLocked, saveOfficialFn) => (region, rIdx, gIdx, side) => {
    if (isLocked && !isAdmin) return;
    setBracketFn(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const game = next[region].rounds[rIdx][gIdx];
      if (!game) return prev;
      const clicked = side === 'top' ? game.top : game.bottom;
      if (!clicked || clicked.isFFPlaceholder) return prev;
if (game.winner?.name === clicked.name) {
        game.winner = null; clearTeamDownstream(next, region, clicked.name, rIdx + 1);
        if (isAdmin && saveOfficialFn) saveOfficialFn(next).catch(console.warn); return next;
      }
      game.winner = clicked;
      const loser = side === 'top' ? game.bottom : game.top;
      if (loser) clearTeamDownstream(next, region, loser.name, rIdx + 1);
      if (rIdx < 3) { const ng = next[region].rounds[rIdx + 1][Math.floor(gIdx / 2)]; const nSide = gIdx % 2 === 0 ? 'top' : 'bottom'; ng[nSide] = clicked; if (ng.winner?.name !== clicked.name) ng.winner = null; }
      if (rIdx === 3) { const fi = { East: 0, West: 0, South: 1, Midwest: 1 }[region]; const fSide = { East: 'top', West: 'bottom', South: 'top', Midwest: 'bottom' }[region]; next.finalFour[fi][fSide] = clicked; if (next.finalFour[fi].winner?.name !== clicked.name) next.finalFour[fi].winner = null; }
      if (isAdmin && saveOfficialFn) saveOfficialFn(next).catch(console.warn); return next;
    });
  }, [isAdmin, clearTeamDownstream]);

  const handlePick = useCallback((region, rIdx, gIdx, side) => {
    if (rIdx === 0) {
      setBracket(prev => {
        const game = prev[region]?.rounds[0]?.[gIdx];
        const clicked = side === 'top' ? game?.top : game?.bottom;
        if (clicked && game?.winner?.name === clicked.name) {
          setFirstFourPicks(fp => {
            const updated = { ...fp };
            const key = `${region}-${clicked.seed}`;
            if (updated[key] === clicked.name) { delete updated[key]; }
            return updated;
          });
        }
        return prev;
      });
    }
    makePickHandler(setBracket, locked, saveOfficialBracket)(region, rIdx, gIdx, side);
  }, [locked, isAdmin, makePickHandler, ffPlaceholders]);

  const handleMammalPick = useCallback((region, rIdx, gIdx, side) => {
    if (rIdx === 0) {
      setMammalBracket(prev => {
        const game = prev[region]?.rounds[0]?.[gIdx];
        const clicked = side === 'top' ? game?.top : game?.bottom;
        if (clicked && game?.winner?.name === clicked.name) {
          setMammalFirstFourPicks(fp => {
            const updated = { ...fp };
            const key = `${region}-${clicked.seed}`;
            if (updated[key] === clicked.name) { delete updated[key]; }
            return updated;
          });
        }
        return prev;
      });
    }
    makePickHandler(setMammalBracket, mammalLocked, saveMammalOfficialBracket)(region, rIdx, gIdx, side);
  }, [mammalLocked, isAdmin, makePickHandler, mammalFfPlaceholders]);
  const makeFFPickHandler = useCallback((setBracketFn, isLocked, saveOfficialFn) => (idx, side) => {
    if (isLocked && !isAdmin) return;
    setBracketFn(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const ff = next.finalFour[idx]; const clicked = ff[side];
      if (!clicked) return prev;
      if (ff.winner?.name === clicked.name) { ff.winner = null; const cSide = idx === 0 ? 'top' : 'bottom'; next.championship[cSide] = null; next.championship.winner = null; if (isAdmin && saveOfficialFn) saveOfficialFn(next).catch(console.warn); return next; }
      ff.winner = clicked; const cSide = idx === 0 ? 'top' : 'bottom';
      next.championship[cSide] = clicked; if (next.championship.winner?.name !== clicked.name) next.championship.winner = null;
      if (isAdmin && saveOfficialFn) saveOfficialFn(next).catch(console.warn); return next;
    });
  }, [isAdmin]);

  const handleFFPick       = useCallback(makeFFPickHandler(setBracket, locked, saveOfficialBracket), [locked, isAdmin, makeFFPickHandler]);
  const handleMammalFFPick = useCallback(makeFFPickHandler(setMammalBracket, mammalLocked, saveMammalOfficialBracket), [mammalLocked, isAdmin, makeFFPickHandler]);

  const makeChampHandler = useCallback((setBracketFn, isLocked, saveOfficialFn) => (side) => {
    if (isLocked && !isAdmin) return;
    setBracketFn(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const clicked = next.championship[side]; if (!clicked) return prev;
      if (next.championship.winner?.name === clicked.name) { next.championship.winner = null; return next; }
      next.championship.winner = clicked; if (isAdmin && saveOfficialFn) saveOfficialFn(next).catch(console.warn); return next;
    });
  }, [isAdmin]);

  const handleChampPick       = useCallback(makeChampHandler(setBracket, locked, saveOfficialBracket), [locked, isAdmin, makeChampHandler]);
  const handleMammalChampPick = useCallback(makeChampHandler(setMammalBracket, mammalLocked, saveMammalOfficialBracket), [mammalLocked, isAdmin, makeChampHandler]);
  const handleChampScore = useCallback((field, val) => setBracket(prev => ({ ...prev, championship: { ...prev.championship, [field]: val } })), []);

 const makeFirstFourHandler = useCallback((setBracketFn, setPicksFn, getPicksFn, getFfPlaceholders, isLocked, saveOfficialFn) => (key, winner, region, seed) => {
    if (isLocked && !isAdmin) return;
    const currentPicks = getPicksFn();
    const isUnpick = currentPicks[key] === winner.name;
    setPicksFn(prev => {
      if (prev[key] === winner.name) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: winner.name };
    });
    setBracketFn(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const r64 = next[region]?.rounds[0]; if (!r64) return prev;
      r64.forEach(game => {
        ['top','bottom'].forEach(side => {
          const slot = game[side];
          if (Number(slot?.seed) === Number(seed)) {
            if (isUnpick) {
              clearTeamDownstream(next, region, slot.name, 1);
              const original = getFfPlaceholders()[key];
              if (original) game[side] = { ...original };
            } else if (slot?.isFFPlaceholder || slot?.name === winner.name) {
              game[side] = { ...winner, isFFPlaceholder: false };
            }
          }
        });
      });
      if (isAdmin && saveOfficialFn) saveOfficialFn(next).catch(console.warn);
      return next;
    });
  }, [isAdmin, clearTeamDownstream]);

  // Sync FF picks when a team is cleared from inside the main bracket
  const syncFFPicksOnClear = useCallback((teamName, setPicksFn, getFfPlaceholders) => {
    const placeholders = getFfPlaceholders();
    setPicksFn(prev => {
      const updated = { ...prev };
      let changed = false;
      Object.entries(placeholders).forEach(([key, slot]) => {
        if (prev[key] === teamName) {
          delete updated[key];
          changed = true;
        }
      });
      return changed ? updated : prev;
    });
  }, []);

  const firstFourPicksRef = useRef(firstFourPicks);
  useEffect(() => { firstFourPicksRef.current = firstFourPicks; }, [firstFourPicks]);
  const mammalFirstFourPicksRef = useRef(mammalFirstFourPicks);
  useEffect(() => { mammalFirstFourPicksRef.current = mammalFirstFourPicks; }, [mammalFirstFourPicks]);

  const handleFirstFourPick = useCallback(
    makeFirstFourHandler(setBracket, setFirstFourPicks, () => firstFourPicksRef.current, () => ffPlaceholders, locked, saveOfficialBracket),
    [locked, isAdmin, ffPlaceholders, makeFirstFourHandler]
  );
  const handleMammalFirstFourPick = useCallback(
    makeFirstFourHandler(setMammalBracket, setMammalFirstFourPicks, () => mammalFirstFourPicksRef.current, () => mammalFfPlaceholders, mammalLocked, saveMammalOfficialBracket),
    [mammalLocked, isAdmin, mammalFfPlaceholders, makeFirstFourHandler]
  );

  const handleClearPicks = useCallback((isMammal) => {
    setConfirmDialog({
      message: `Clear all your ${isMammal ? 'Mammal Madness' : 'basketball'} picks? This cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        const stripWinners = b => {
          const n = JSON.parse(JSON.stringify(b));
          ['East','West','South','Midwest'].forEach(r => { n[r]?.rounds?.forEach(round => round.forEach(g => { g.winner = null; })); });
          if (n.finalFour) n.finalFour.forEach(ff => { ff.winner = null; });
          if (n.championship) { n.championship.winner = null; n.championship.scoreTop = ''; n.championship.scoreBottom = ''; }
          return n;
        };
        if (isMammal) { setMammalBracket(applyFirstFourPicks(stripWinners(mammalOfficialBracket || mammalBracket), {})); setMammalFirstFourPicks({}); }
        else { setBracket(applyFirstFourPicks(stripWinners(officialBracket || bracket), {})); setFirstFourPicks({}); }
      }
    });
  }, [officialBracket, mammalOfficialBracket, bracket, mammalBracket]);

  // ── ADMIN ACTIONS ─────────────────────────────────────────────────────────
  const handleSaveYear = async () => {
    const yr = parseInt(yearDraft);
    if (!yr || yr < 2000 || yr > 2100) return;
    setYearSaving(true);
    try { await setDoc(doc(db, 'tournament', 'config'), { year: yr }, { merge: true }); setTournamentYear(yr); setYearSaveError(''); } catch (e) { setYearSaveError(e.message); }
    setYearSaving(false);
  };

  const handleSaveBbRegionNames = async (names) => {
    setBbRegionNames(names);
    try { await setDoc(doc(db, 'tournament', 'config'), { bbRegionNames: names }, { merge: true }); } catch {}
  };
  const handleSaveBbSources = async (sources) => { setBbSources(sources); try { await setDoc(doc(db, 'admin', 'bbSources'), { sources }); } catch {} };
  const handleSaveMammalSources = async (sources) => { setMammalSources(sources); try { await setDoc(doc(db, 'admin', 'mammalSources'), { sources }); } catch {} };

  // ── RESEARCH GENERATION ───────────────────────────────────────────────────
  const handleGenerateResearch = useCallback(async (roster, onlyRegion) => {
    const regions = onlyRegion ? [onlyRegion] : ['East','West','South','Midwest'];
    const teams = [];
    regions.forEach(region => { (roster[region] || []).forEach(t => { if (!t.firstFour && t.name && !t.name.startsWith('Seed')) teams.push({ name: t.name, seed: t.seed, region, espnId: t.espnId || '' }); }); });
    if (!teams.length) return;
    setGenerating(true); setGenError('');
    setGenProgress({ done: 0, total: teams.length, current: teams[0].name });
    const allData = { ...researchData };
    for (let i = 0; i < teams.length; i++) {
      const { name, seed, region, espnId } = teams[i];
      setGenProgress({ done: i, total: teams.length, current: name });
      try {
        const card = await generateResearchForTeam(name, seed, region, espnId, bbSources);
        if (card) { allData[name] = { ...card, seed, region }; await saveResearchData(allData); setResearchData({ ...allData }); }
      } catch (e) {
        setGenError(e.message); console.warn('Research gen failed:', name, e);
        if (e.message.includes('Daily') || e.message.includes('tomorrow') || e.message.includes('400')) break;
      }
      if (i < teams.length - 1) await new Promise(r => setTimeout(r, 8000));
    }
    setGenProgress(prev => ({ ...prev, done: teams.length, current: '' }));
    setGenerating(false);
  }, [researchData, bbSources]);

  const handleGenerateMammalResearch = useCallback(async (roster, onlyRegion) => {
    const regions = onlyRegion ? [onlyRegion] : ['East','West','South','Midwest'];
    const animals = [];
    regions.forEach(region => { (roster[region] || []).forEach(a => { if (!a.firstFour && a.name) animals.push({ name: a.name, seed: a.seed, region }); }); });
    if (!animals.length) return;
    setMammalGenerating(true); setMammalGenError('');
    setMammalGenProgress({ done: 0, total: animals.length, current: animals[0].name });
    const allData = { ...mammalResearchData };
    for (let i = 0; i < animals.length; i++) {
      const { name, seed, region } = animals[i];
      setMammalGenProgress({ done: i, total: animals.length, current: name });
      try {
        const prompt = `Generate a fun organism profile for middle school students. Animal: ${name} (${region}, Seed #${seed}) in March Mammal Madness. Return ONLY valid JSON: {"latinName":"Genus species","habitat":"2-3 sentences","diet":"2-3 sentences","funFacts":["fact1","fact2","fact3"],"size":"weight and length","lifespan":"X-Y years","speed":"top speed","superpower":"1 sentence","battleStrength":"1-2 sentences"}`;
        const card = await callAI(prompt, mammalSources, true);
        if (card) { allData[name] = { ...card, seed, region }; setMammalResearchData({ ...allData }); }
      } catch (e) {
        setMammalGenError(e.message); console.warn('Mammal gen failed:', name, e);
        if (e.message.includes('Daily') || e.message.includes('tomorrow')) break;
      }
      if (i < animals.length - 1) await new Promise(r => setTimeout(r, 8000));
    }
    await saveMammalResearchData(allData);
    setMammalGenProgress(prev => ({ ...prev, done: animals.length, current: '' }));
    setMammalGenerating(false);
  }, [mammalResearchData, mammalSources]);

  const handleGenerateOneMammal = useCallback(async (animalName) => {
    setMammalGeneratingOne(animalName);
    try {
      const card = mammalResearchData[animalName];
      const prompt = `Generate a fun organism profile for middle school students. Animal: ${animalName} (Seed #${card?.seed || 1}) in March Mammal Madness. Return ONLY valid JSON: {"latinName":"Genus species","habitat":"2-3 sentences","diet":"2-3 sentences","funFacts":["fact1","fact2","fact3"],"size":"weight and length","lifespan":"X-Y years","speed":"top speed","superpower":"1 sentence","battleStrength":"1-2 sentences"}`;
      const result = await callAI(prompt, mammalSources, true);
      if (result) { const updated = { ...result, seed: card?.seed, region: card?.region }; await saveOneMammalResearch(animalName, updated); setMammalResearchData(prev => ({ ...prev, [animalName]: updated })); }
    } catch (e) { console.warn('Failed to generate for', animalName, e); }
    setMammalGeneratingOne(null);
  }, [mammalResearchData, mammalSources]);

  const handleRefetchMammalImages = useCallback(async (onlyRegion) => {
    const allData = { ...mammalResearchData };
    const animals = Object.entries(allData).filter(([, card]) => card.latinName && (!onlyRegion || card.region === onlyRegion)).map(([name, card]) => ({ name, latinName: card.latinName }));
    if (!animals.length) { setMammalGenError('No Latin names found. Generate text content first.'); return; }
    setMammalGenerating(true);
    for (let i = 0; i < animals.length; i++) {
      const { name, latinName } = animals[i];
      setMammalGenProgress({ done: i, total: animals.length, current: name });
      try {
        const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fetchImagesOnly: true, latinName }) });
        if (res.ok) { const data = await res.json(); if (data.result && allData[name]) { allData[name] = { ...allData[name], ...data.result }; setMammalResearchData(prev => ({ ...prev, [name]: allData[name] })); } }
      } catch (e) { console.warn('Image refetch failed for', name, e); }
      if (i < animals.length - 1) await new Promise(r => setTimeout(r, 300));
    }
    await saveMammalResearchData(allData);
    setMammalGenProgress(prev => ({ ...prev, done: animals.length, current: '' }));
    setMammalGenerating(false);
  }, [mammalResearchData]);

  const handleResearchFieldSave = useCallback(async (teamName, fieldPath, value) => {
    setResearchData(prev => { const next = { ...prev, [teamName]: applyField(prev[teamName], fieldPath, value) }; saveOneTeamResearch(teamName, next[teamName]).catch(console.warn); return next; });
  }, []);

  const handleMammalResearchFieldSave = useCallback(async (animalName, fieldPath, value) => {
    setMammalResearchData(prev => { const next = { ...prev, [animalName]: applyField(prev[animalName], fieldPath, value) }; saveOneMammalResearch(animalName, next[animalName]).catch(console.warn); return next; });
  }, []);

  const handleViewBracket = useCallback(async (entryUid, entryName, isMammal) => {
    setLoadingBracket(entryUid + (isMammal ? '-mm' : ''));
    try {
      const fn = isMammal ? loadMammalBracket : loadBracket;
      const b = await fn(entryUid);
      if (b) setViewingBracket({ uid: entryUid, displayName: entryName, bracket: b, isMammal });
    } catch (e) { console.warn('Failed to load bracket:', e); }
    setLoadingBracket(null);
  }, []);

  const handleCompare = useCallback((teamA, teamB, isMammal) => {
    const data = isMammal ? mammalResearchData : researchData;
    setCompareModal({
      teamA: { name: teamA.name, seed: teamA.seed, espnId: teamA.espnId },
      teamB: { name: teamB.name, seed: teamB.seed, espnId: teamB.espnId },
      cardA: data[teamA.name] ?? null,
      cardB: data[teamB.name] ?? null,
      isMammal,
    });
  }, [researchData, mammalResearchData]);

  // ── BRACKET RENDER ────────────────────────────────────────────────────────
  const renderBracket = (isMammal) => {
    const CW = 210, SH = 116, FF_SCALE = 1.25;
    const FF_W = Math.round(CW * FF_SCALE), FF_H = Math.round(SH * FF_SCALE);
    const CHAMP_BOX_H = 30 + Math.round(FF_H * 0.75) + 32 + 20;

    const FF_GAP = Math.round(SH / 2);
    const TOP_H = 8 * SH;
    const STUB = CW * 0.45;

    const activeBracket = isMammal ? (isAdmin ? (mammalOfficialBracket || mammalBracket) : mammalBracket) : bracket;
    const regionNames   = isMammal ? mammalRegionNames : bbRegionNames;
    const onPick        = isMammal ? handleMammalPick : handlePick;
    const onFFPick      = isMammal ? handleMammalFFPick : handleFFPick;
    const onChampPick   = isMammal
      ? (side) => { handleMammalChampPick(side); triggerChampionConfetti(); }
      : (side) => { handleChampPick(side); triggerChampionConfetti(); };
    const isLocked      = isMammal ? mammalLocked : locked;
    const champColor    = isMammal ? 'rgba(134,239,172,0.5)' : 'rgba(245,158,11,0.65)';
    const champBg       = isMammal ? 'linear-gradient(135deg,rgba(134,239,172,0.15),rgba(22,163,74,0.10))' : 'linear-gradient(135deg,rgba(245,158,11,0.18),rgba(124,58,237,0.14))';
    const champGold     = isMammal ? '#86efac' : '#C4952A';

    const ROUND_ABS = [
      [0, 116, 232, 348, 464, 580, 696, 812],
      [58, 290, 522, 754],
      [174, 638],
      [406],
    ];

    // Completion bar
    const countPicks = (b) => {
      if (!b) return 0;
      let n = 0;
      ['East','West','South','Midwest'].forEach(region => {
        (b[region]?.rounds || []).forEach(round => round.forEach(g => { if (g.winner) n++; }));
      });
      (b.finalFour || []).forEach(ff => { if (ff.winner) n++; });
      if (b.championship?.winner) n++;
      return n;
    };
    const totalPicks = isAdmin ? 0 : countPicks(activeBracket);
    const pickPct = Math.min(100, (totalPicks / 63) * 100);
    const isComplete = totalPicks >= 63;

    const ScaledGame = ({ children, isHoriz }) => {
      const wrapH = isHoriz ? Math.round(FF_H * 0.72) : FF_H;
      return (
        <div style={{ width: FF_W, height: wrapH, position: 'relative', overflow: 'visible' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: CW, transformOrigin: 'top left', transform: `scale(${FF_SCALE})` }}>{children}</div>
        </div>
      );
    };

    const onCompareGame = (top, bottom) => handleCompare(top, bottom, isMammal);

    const RoundCol = ({ region, rIdx, flip, dir }) => {
      const games = activeBracket[region]?.rounds[rIdx] || [];
      const positions = ROUND_ABS[rIdx];
      return (
        <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative' }}>
          {games.map((game, gIdx) => {
            const pos = positions[gIdx] ?? gIdx * SH;
            return (
              <div key={gIdx} style={{ position: 'absolute', left: 0, right: 0, ...(dir === 'top' ? { top: pos } : { bottom: pos }) }}>
                <GameSlot game={game} locked={isLocked && !isAdmin} flipped={flip} roundIdx={rIdx} liveScores={isMammal ? {} : liveScores} onPick={side => onPick(region, rIdx, gIdx, side)} onCompare={onCompareGame} isMammal={isMammal} mammalResearchData={isMammal ? mammalResearchData : {}} />
              </div>
            );
          })}
        </div>
      );
    };


    const LINE_COLORS = ['#60a5fa','#a78bfa','#fbbf24','#ef4444'];
    const TOTAL_W = CW * 11;
    const GAME_MID_OFFSET = 50, GAME_MID_OFFSET_BOT = 39;

    const BracketConnectors = ({ dir }) => {
      const H = TOP_H;
      const lines = [];
      const getMid = (pos) => dir === 'top' ? pos + GAME_MID_OFFSET : H - pos - GAME_MID_OFFSET_BOT;

      const addRegionLines = (xBase, flip) => {
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const color = LINE_COLORS[rIdx];
          const fromPositions = ROUND_ABS[rIdx], toPositions = ROUND_ABS[rIdx + 1];
          const xFrom = xBase + (flip ? (3 - rIdx) * CW : (rIdx + 1) * CW);
          const xStub = flip ? xFrom - STUB : xFrom + STUB;
          const xParent = flip ? xFrom - CW + STUB : xFrom + CW - STUB;
          toPositions.forEach((toPos, tIdx) => {
            const c1 = fromPositions[tIdx * 2], c2 = fromPositions[tIdx * 2 + 1];
            if (c1 == null || c2 == null) return;
            const y1 = getMid(c1), y2 = getMid(c2), yMid = getMid(toPos);
            lines.push(<g key={`r-${xBase}-${rIdx}-${tIdx}`} stroke={color} strokeWidth="3" strokeLinecap="round" fill="none"><line x1={xFrom} y1={y1} x2={xStub} y2={y1} /><line x1={xFrom} y1={y2} x2={xStub} y2={y2} /><line x1={xStub} y1={y1} x2={xStub} y2={y2} /><line x1={xStub} y1={yMid} x2={xParent} y2={yMid} /></g>);
          });
        }
      };

      const ffLeftEdge = CW * 4 + (CW * 3 - FF_W) / 2, ffRightEdge = ffLeftEdge + FF_W;
      const ffTopY = dir === 'top' ? TOP_H - FF_GAP - FF_H : FF_GAP;
      const ffMidY = ffTopY + GAME_MID_OFFSET;
      const e8Pos = ROUND_ABS[3][0], e8MidY = getMid(e8Pos), e8Color = LINE_COLORS[3];
      const eastE8Right = CW * 4, eastStubX = eastE8Right + STUB;
      lines.push(<g key="e8-ff-east" stroke={e8Color} strokeWidth="3" strokeLinecap="round" fill="none"><line x1={eastE8Right} y1={e8MidY} x2={eastStubX} y2={e8MidY} /><line x1={eastStubX} y1={e8MidY} x2={eastStubX} y2={ffMidY} /><line x1={eastStubX} y1={ffMidY} x2={ffLeftEdge} y2={ffMidY} /></g>);
      const westE8Left = CW * 7, westStubX = westE8Left - STUB;
      lines.push(<g key="e8-ff-west" stroke={e8Color} strokeWidth="3" strokeLinecap="round" fill="none"><line x1={westE8Left} y1={e8MidY} x2={westStubX} y2={e8MidY} /><line x1={westStubX} y1={e8MidY} x2={westStubX} y2={ffMidY} /><line x1={westStubX} y1={ffMidY} x2={ffRightEdge} y2={ffMidY} /></g>);
      addRegionLines(0, false); addRegionLines(CW * 7, true);
      return <svg width={TOTAL_W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: -1 }}>{lines}</svg>;
    };

    const ff0Label = `Final Four: ${regionNames.East || 'East'} vs. ${regionNames.West || 'West'}`;
    const ff1Label = `Final Four: ${regionNames.South || 'South'} vs. ${regionNames.Midwest || 'Midwest'}`;

    return (
      <>
      {!isAdmin && (
        <div style={{ marginBottom: 12, maxWidth: TOTAL_W }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#7A7068', fontWeight: 600 }}>
              {isComplete ? 'Bracket complete!' : `${totalPicks}/63 picks made`}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['R64','R32','S16','E8','FF','Champ'].map(label => (
                <span key={label} style={{ fontSize: 10, color: '#7A7068', padding: '1px 5px', borderRadius: 3, background: 'rgba(9,24,40,0.07)' }}>{label}</span>
              ))}
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(9,24,40,0.10)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pickPct}%`, background: isComplete ? MINT_FG : NAVY, borderRadius: 4, transition: 'width 0.4s ease-out' }} />
          </div>
        </div>
      )}
      <div style={{ width: TOTAL_W }}>
        {/* TOP HALF */}
        <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', height: TOP_H }}>
          <BracketConnectors dir="top" />
          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="East" rIdx={rIdx} flip={false} dir="top" />)}
          <div style={{ width: CW * 3, flexShrink: 0, height: TOP_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: FF_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: MINT_FG, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff0Label}</div>
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[0]} onPick={s => onFFPick(0, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} isMammal={isMammal} mammalResearchData={isMammal ? mammalResearchData : {}} /></ScaledGame>
            </div>
          </div>
          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="West" rIdx={rIdx} flip={true} dir="top" />)}
        </div>

        {/* CHAMPIONSHIP */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', borderTop: '1px solid rgba(9,24,40,0.12)', borderBottom: '1px solid rgba(9,24,40,0.12)', background: 'rgba(255,255,255,0.02)', marginTop: 4, marginBottom: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 16px', background: champBg, border: `2px solid ${champColor}`, borderRadius: 12, position: 'relative', minWidth: FF_W + 24 }}>
            <div style={{ position: 'absolute', inset: -2, borderRadius: 12, border: `2px solid ${champColor}`, animation: 'champGlow 3s ease-in-out infinite', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Trophy size={16} color={champGold} />
              <span style={{ fontSize: 16, fontWeight: 800, color: champGold, letterSpacing: 1, fontFamily: "'Libre Bodoni', serif", whiteSpace: 'nowrap' }}>Championship</span>
              <Trophy size={16} color={champGold} />
            </div>
            <ScaledGame isHoriz>
              <GameSlot game={activeBracket.championship} onPick={onChampPick} locked={isLocked && !isAdmin} isChampionship isHorizontal onScoreChange={isMammal ? undefined : handleChampScore} roundIdx={-1} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} isMammal={isMammal} mammalResearchData={isMammal ? mammalResearchData : {}} />
            </ScaledGame>
            {activeBracket.championship?.winner && (
              <div style={{ textAlign: 'center', padding: '4px 14px', background: isMammal ? 'rgba(134,239,172,0.15)' : 'rgba(245,158,11,0.18)', borderRadius: 6, border: `1px solid ${isMammal ? 'rgba(134,239,172,0.4)' : 'rgba(245,158,11,0.5)'}` }}>
                <div style={{ fontSize: 10, color: champGold, letterSpacing: 1.5 }}>CHAMPION</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Libre Bodoni', serif" }}>{activeBracket.championship.winner.name}</div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM HALF */}
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', height: TOP_H }}>
          <BracketConnectors dir="bot" />
          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="South" rIdx={rIdx} flip={false} dir="bot" />)}
          <div style={{ width: CW * 3, flexShrink: 0, height: TOP_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: FF_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[1]} onPick={s => onFFPick(1, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} isMammal={isMammal} mammalResearchData={isMammal ? mammalResearchData : {}} /></ScaledGame>
              <div style={{ fontSize: 13, fontWeight: 800, color: MINT_FG, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff1Label}</div>
            </div>
          </div>
          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="Midwest" rIdx={rIdx} flip={true} dir="bot" />)}
        </div>
      </div>
      </>
    );
  };

  // ── FIRST FOUR PANEL ──────────────────────────────────────────────────────
  const renderFirstFourPanel = (isMammal) => {
    const activeFF = isMammal ? mammalFFGamesList : ffGamesList;
    const activePicks = isMammal ? mammalFirstFourPicks : firstFourPicks;
    const rNames = isMammal ? mammalRegionNames : bbRegionNames;
    const onPick = isMammal ? handleMammalFirstFourPick : handleFirstFourPick;
    const isLocked = (isMammal ? mammalLocked : locked) && !isAdmin;
    if (!activeFF.length) return null;
    return (
      <div style={{ marginBottom: 20, padding: '16px 18px', background: 'rgba(9,24,40,0.07)', border: '1px solid rgba(9,24,40,0.22)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#B8CBE8', letterSpacing: 2, marginBottom: 2 }}>FIRST FOUR — PLAY-IN GAMES</div>
        <div style={{ fontSize: 11, color: '#7A7068', marginBottom: 14 }}>Pick who wins each play-in game and advances into the main bracket</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {activeFF.map(({ region, seed, ffTeams, key }) => {
            const pick = activePicks[key];
            return (
              <div key={key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(9,24,40,0.18)', borderRadius: 10, padding: '12px 14px', minWidth: 210 }}>
                <div style={{ fontSize: 10, color: RC[region], fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{rNames[region] || region} — #{seed} seed play-in</div>
                {(ffTeams || []).map(team => {
                  const isPick = pick === team.name;
                  const isLoser = pick && pick !== team.name;
                  return (
                    <div key={team.name} onClick={() => !isLocked && onPick(key, team, region, seed)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, marginBottom: 5, cursor: isLocked ? 'default' : 'pointer', background: isPick ? 'rgba(9,24,40,0.18)' : 'rgba(255,255,255,0.03)', border: isPick ? '1px solid rgba(9,24,40,0.45)' : '1px solid rgba(9,24,40,0.10)', transition: 'background 150ms, border-color 150ms', opacity: isLoser ? 0.35 : 1 }}>
                      <TeamLogo espnId={team.espnId} name={team.name} size={20} />
                      <span style={{ fontSize: 10, color: '#7A7068', fontWeight: 700, minWidth: 14 }}>{team.seed}</span>
                      <span style={{ fontSize: 12, fontWeight: isPick ? 700 : 400, color: isPick ? '#B8CBE8' : '#7A7068', flex: 1 }}>{team.name}</span>
                      {isPick && <Check size={13} color={MINT_FG} />}
                    </div>
                  );
                })}
                {pick ? <div style={{ fontSize: 10, color: MINT_FG, textAlign: 'center', marginTop: 4 }}>{pick} advances as #{seed} seed</div>
                      : <div style={{ fontSize: 10, color: '#7A7068', textAlign: 'center', marginTop: 4 }}>pick a winner</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── SCROLL BRACKET WRAPPER ────────────────────────────────────────────────
  const renderScrollBracket = (isMammal, scrollClass) => (
    <div className={`${scrollClass} bscroll`} style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, cursor: 'grab', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={e => {
        const el = e.currentTarget; el.style.cursor = 'grabbing';
        const startX = e.pageX - el.offsetLeft, startScroll = el.scrollLeft;
        const onMove = mv => { el.scrollLeft = startScroll - (mv.pageX - el.offsetLeft - startX); };
        const onUp = () => { el.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      }}>
      <div style={{ display: 'inline-block', paddingBottom: 8 }}>{renderBracket(isMammal)}</div>
    </div>
  );

  // ── SCORE BAR ─────────────────────────────────────────────────────────────
  const renderScoreBar = (isMammal) => {
    const s = isMammal ? mammalScore : score;
    const rank = isMammal ? mammalMyRank : myRank;
    const board = isMammal ? mammalLeaderboard : leaderboard;
    const isLocked = isMammal ? mammalLocked : locked;
    const color = isMammal ? GREEN : NAVY;
    return (
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14, ...(isMammal ? { borderColor: 'rgba(134,239,172,0.25)' } : {}) }}>
        <div>
          <div style={{ fontSize: 11, color: '#777', letterSpacing: 1, textTransform: 'uppercase' }}>{isMammal ? 'Mammal Score' : 'Your Score'}</div>
          <div style={{ fontSize: 38, fontWeight: 700, color, fontFamily: "'Libre Bodoni', serif", lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s} <span style={{ fontSize: 14, color: '#888' }}>/ 1,920 pts</span></div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: isLocked ? '#e74c3c' : '#22c55e', marginBottom: 6 }}>{isLocked ? 'Brackets Locked' : 'Picks Open'}</div>
          {isAdmin && (
            <button style={{ ...S.btn(isLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 12, padding: '6px 16px' }}
              onClick={() => setConfirmDialog({ message: `${isLocked ? 'Unlock' : 'Lock'} all ${isMammal ? 'Mammal Madness' : 'basketball'} brackets?`, onConfirm: async () => { setConfirmDialog(null); const nl = !isLocked; if (isMammal) { setMammalLocked(nl); await setMammalTournamentLocked(nl); } else { setLocked(nl); await setTournamentLocked(nl); } } })}>
              {isLocked ? 'Unlock Brackets' : 'Lock All Brackets'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#777' }}>School Rank</div>
            <div style={{ fontSize: 34, fontWeight: 700, color, fontFamily: "'Libre Bodoni', serif", lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{rank > 0 ? `#${rank}` : '-'}</div>
            <div style={{ fontSize: 11, color: '#888' }}>of {board.length || '-'} entries</div>
          </div>
          <button style={{ ...S.btn('transparent', '#8B3A3A'), border: '1.5px solid rgba(139,58,58,0.35)', boxShadow: 'none', padding: '5px 14px', fontSize: 11 }} onClick={() => handleClearPicks(isMammal)}>Clear Picks</button>
        </div>
      </div>
    );
  };

  // ── LEGAL PAGES ───────────────────────────────────────────────────────────
  if (legalPage === 'privacy') return <PrivacyPolicyPage onBack={() => setLegalPage(null)} />;
  if (legalPage === 'terms')   return <TermsOfServicePage onBack={() => setLegalPage(null)} />;

  // ── LOADING SCREEN ────────────────────────────────────────────────────────
  if (uid && (!appReady || !profileLoaded)) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div style={{ width: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div className="mm-skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="mm-skeleton" style={{ height: 14, width: '75%' }} />
            <div className="mm-skeleton" style={{ height: 11, width: '50%' }} />
          </div>
        </div>
        <div className="mm-skeleton" style={{ height: 80 }} />
        <div className="mm-skeleton" style={{ height: 80 }} />
        <div className="mm-skeleton" style={{ height: 80 }} />
      </div>
    </div>
  );

  // ── ONBOARDING SCREEN ─────────────────────────────────────────────────────
  const SCHOOLS = ['Hart', 'Van Hoosen', 'Reuther', 'West'];
  if (uid && appReady && profileLoaded && !school && !isAdmin) return (
    <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 32, padding: '0 16px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 36, fontWeight: 700, color: NAVY, marginBottom: 8, textWrap: 'balance' }}>
          Welcome, {displayName.split(' ')[0]}!
        </h1>
        <p style={{ color: '#7A7068', fontSize: 16 }}>Which school do you go to?</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 440, width: '100%' }}>
        {SCHOOLS.map(s => {
          const isSel = selectedSchoolCard === s;
          return (
            <button
              key={s}
              className="school-card"
              onClick={() => {
                if (selectedSchoolCard) return;
                setSelectedSchoolCard(s);
                setTimeout(() => handleSelectSchool(s), 450);
              }}
              style={{
                ...S.card,
                border: isSel ? `2px solid ${MINT_FG}` : '2px solid rgba(9,24,40,0.20)',
                background: isSel ? MINT_BG : '#F4EFE6',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                padding: '24px 16px',
                fontFamily: "'Libre Bodoni', serif", fontSize: 18, fontWeight: 700,
                color: isSel ? MINT_FG : NAVY,
                animation: isSel ? 'schoolCardBounce 250ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
              }}>
              <School size={32} color={isSel ? MINT_FG : NAVY} />
              {s}
              <span className={`school-card-check${isSel ? ' visible' : ''}`}>
                <Check size={18} color={MINT_FG} />
              </span>
            </button>
          );
        })}
      </div>
      <p style={{ color: '#7A7068', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
        Your school will show on the leaderboard. Ask your teacher if you need to change it.
      </p>
    </div>
  );

  // ── SIGN-IN SCREEN ────────────────────────────────────────────────────────
  if (!uid) return (
    <>
      <div style={{
        ...S.app,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 36, minHeight: '100dvh',
        backgroundImage: 'radial-gradient(rgba(9,24,40,0.04) 1.5px, transparent 1.5px)',
        backgroundSize: '24px 24px',
        animation: 'bgDrift 20s linear infinite',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="signin-underline" style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 48, fontWeight: 700, color: NAVY, letterSpacing: 2, lineHeight: 1.1, textWrap: 'balance' }}>
            MARCH MADNESS<br />{tournamentYear}
          </h1>
          <p style={{ color: '#7A7068', fontSize: 16, marginTop: 10 }}>Rochester Community Schools · Bracket Challenge</p>
        </div>
        <div style={{ ...S.card, textAlign: 'center', maxWidth: 380, padding: '36px 40px', width: '100%' }}>
          {authError && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{authError}</div>}
          <button
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            style={{ ...S.btn(NAVY), width: '100%', fontSize: 16, padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            {authLoading ? 'Signing in...' : 'Sign in with school Google'}
          </button>
          <p style={{ color: '#7A7068', fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
            Use your school account (@rcs-k12.us)
          </p>
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', display: 'flex', justifyContent: 'center', gap: 20, borderTop: '1px solid #C8BFB0', background: '#E8E2D8' }}>
        <button onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', color: '#7A7068', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Privacy Policy</button>
        <button onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', color: '#7A7068', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Terms of Service</button>
      </div>
    </>
  );

  // ── MAIN TABS ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'bracket',     label: 'Bracket'     },
    { id: 'research',    label: 'Research'    },
    { id: 'leaderboard', label: 'Leaderboard' },
    ...(isTeacher || isAdmin ? [{ id: 'teacher', label: 'Teacher' }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
  ];

  const TournamentSelector = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(9,24,40,0.06)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid #C8BFB0' }}>
      <button onClick={() => { setActiveTournament('basketball'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'basketball' ? NAVY : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#7A7068', transition: 'all .15s' }}>Basketball</button>
      <button onClick={() => { setActiveTournament('mammals'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'mammals' ? GREEN : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#7A7068', transition: 'all .15s' }}>Mammal Madness</button>
    </div>
  );

  return (
    <ErrorBoundary>
      <div style={S.app}>
        <style>{`
          .bscroll { scrollbar-width: thin; scrollbar-color: rgba(9,24,40,0.4) rgba(200,191,176,0.3); }
          .bscroll::-webkit-scrollbar { height: 10px; }
          .bscroll::-webkit-scrollbar-track { background: rgba(200,191,176,0.3); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb { background: rgba(9,24,40,0.4); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb:hover { background: rgba(9,24,40,0.7); }
          @keyframes champGlow { 0%,100%{opacity:0.4} 50%{opacity:1} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
          @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
          .compare-zone { position:relative; height:22px; cursor:pointer; overflow:hidden; user-select:none; }
          .cz-fill-top { position:absolute; top:0; left:0; right:0; height:0; background:var(--cz-top,#040C15); transition:height .24s ease-out; }
          .cz-fill-bot { position:absolute; bottom:0; left:0; right:0; height:0; background:var(--cz-bot,#1E4A88); transition:height .24s ease-out; }
          .cz-divider  { position:absolute; top:50%; left:0; right:0; height:1px; background:#C8BFB0; transform:translateY(-50%); pointer-events:none; }
          .cz-vs       { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:10px; color:#7A7068; font-weight:600; letter-spacing:2px; text-transform:uppercase; z-index:1; transition:opacity .1s; pointer-events:none; }
          .cz-corner   { position:absolute; width:5px; height:5px; border:2px solid rgba(255,255,255,0.75); opacity:0; transition:opacity .14s ease .2s; z-index:3; pointer-events:none; }
          .cz-tl { top:2px; left:4px; border-right:none; border-bottom:none; }
          .cz-tr { top:2px; right:4px; border-left:none; border-bottom:none; }
          .cz-bl { bottom:2px; left:4px; border-right:none; border-top:none; }
          .cz-br { bottom:2px; right:4px; border-left:none; border-top:none; }
          .cz-conn   { position:absolute; top:50%; height:1px; background:rgba(255,255,255,0.5); width:0; transform:translateY(-50%); transition:width .2s ease .2s; z-index:3; pointer-events:none; }
          .cz-conn-l { left:12px; }
          .cz-conn-r { right:12px; }
          .cz-label  { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:13px; letter-spacing:3.5px; text-transform:uppercase; text-shadow:1px 1px 0 rgba(0,0,0,.9),2px 2px 0 rgba(0,0,0,.7),3px 3px 0 rgba(0,0,0,.45),4px 4px 0 rgba(0,0,0,.25),5px 5px 12px rgba(0,0,0,.5); opacity:0; transform:translateY(4px); transition:opacity .14s ease .34s,transform .14s ease .34s; z-index:4; pointer-events:none; }
          .compare-zone:hover .cz-fill-top { height:52%; }
          .compare-zone:hover .cz-fill-bot { height:52%; }
          .compare-zone:hover .cz-vs       { opacity:0; }
          .compare-zone:hover .cz-corner   { opacity:1; }
          .compare-zone:hover .cz-conn-l   { width:22%; }
          .compare-zone:hover .cz-conn-r   { width:22%; }
          .compare-zone:hover .cz-label    { opacity:1; transform:translateY(0); }
          button:active { transform: scale(0.96); }
          button:hover:not(:disabled) { filter: brightness(1.08); }
          button:focus-visible { outline: 2px solid #1E6B47; outline-offset: 3px; border-radius: 8px; }
          button:disabled { cursor: not-allowed; }
          @media (min-width: 640px) { .mm-hamburger { display: none !important; } .mm-mobile-nav { display: none !important; } }
          @media (max-width: 639px) { .mm-desktop-nav { display: none !important; } .mm-user-label { display: none !important; } }
          select:focus-visible, input:focus-visible { outline: 2px solid #1E6B47; outline-offset: 2px; }
          .spring-pick { animation: springBounce 250ms cubic-bezier(0.34,1.56,0.64,1) forwards; }
          @keyframes springBounce { 0%{transform:scale(1)} 40%{transform:scale(0.97)} 70%{transform:scale(1.02)} 100%{transform:scale(1)} }
          @keyframes underlineGrow { from{width:0} to{width:100%} }
          @keyframes bgDrift { 0%{background-position:0 0} 100%{background-position:60px 60px} }
          .signin-underline { position:relative; display:inline-block; }
          .signin-underline::after { content:''; display:block; height:3px; background:linear-gradient(90deg,#091828,#1C3558); border-radius:2px; width:0; animation:underlineGrow 600ms ease-out forwards; animation-delay:200ms; }
          @keyframes schoolCardBounce { 0%{transform:scale(1)} 40%{transform:scale(0.96)} 70%{transform:scale(1.02)} 100%{transform:scale(1)} }
          .school-card { transition: transform 200ms ease-out, box-shadow 200ms ease-out, background 200ms; }
          .school-card:hover { transform: translateY(-3px); box-shadow: 6px 10px 20px rgba(9,24,40,0.15), inset -1px -1px 4px rgba(255,255,255,0.8) !important; }
          .school-card-check { opacity:0; transform:scale(0.5); transition: opacity 200ms, transform 200ms; }
          .school-card-check.visible { opacity:1; transform:scale(1); }
          .line-clamp-4 { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
          @keyframes scoreFlash { 0%{background:rgba(30,107,71,0.30)} 100%{background:transparent} }
          .score-flash { animation: scoreFlash 800ms ease-out forwards; border-radius: 4px; }
          @keyframes stampIn { 0%{opacity:0;transform:rotate(-15deg) scale(1.4)} 60%{opacity:1;transform:rotate(-15deg) scale(0.95)} 100%{opacity:0.65;transform:rotate(-15deg) scale(1)} }
          .locked-stamp { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:10; }
          .locked-stamp span { font-family:'Libre Bodoni',serif; font-size:13px; font-weight:900; color:#dc2626; border:2px solid #dc2626; padding:2px 8px; border-radius:3px; letter-spacing:3px; text-transform:uppercase; opacity:0.65; transform:rotate(-15deg); }
          .mm-tile { transition: background 0.15s, transform 0.12s !important; }
          .mm-tile:hover { transform: translateX(2px) !important; background: rgba(9,24,40,0.06) !important; }
          .mm-tile-win:hover { background: #afdfc5 !important; }
          .mm-lb-row { transition: transform 200ms ease-out, box-shadow 200ms ease-out !important; }
          .mm-lb-row:hover { transform: translateY(-2px); box-shadow: 6px 10px 20px rgba(9,24,40,0.13), inset -1px -1px 4px rgba(255,255,255,0.8) !important; }
          .mm-podium { transition: transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 220ms ease-out !important; cursor: default; }
          .mm-podium:hover { transform: translateY(-4px) scale(1.02); box-shadow: 8px 14px 28px rgba(9,24,40,0.16), inset -1px -1px 4px rgba(255,255,255,0.8) !important; }
          @keyframes shimmer { 0%{background-position:-800px 0} 100%{background-position:800px 0} }
          .mm-skeleton { background: linear-gradient(90deg, rgba(9,24,40,0.05) 25%, rgba(9,24,40,0.10) 50%, rgba(9,24,40,0.05) 75%); background-size:1600px 100%; animation: shimmer 1.6s ease-in-out infinite; border-radius: 10px; }
          @media (prefers-reduced-motion: reduce) {
            button:active { transform: none; }
            button:hover:not(:disabled) { filter: none; }
            .spring-pick { animation: none; }
            .signin-underline::after { animation:none; width:100%; }
            @keyframes bgDrift {}
            .school-card { transition:none; }
            .school-card:hover { transform:none; }
            .mm-tile { transition: background 0.15s !important; }
            .mm-tile:hover { transform: none !important; }
            .mm-lb-row:hover { transform: none; }
            .mm-podium:hover { transform: none; }
            .mm-skeleton { animation: none; background: rgba(9,24,40,0.06); }
          }
        `}</style>

        <OfflineBar />
        {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
        {viewingBracket && <ViewBracketModal data={viewingBracket} onClose={() => setViewingBracket(null)} />}
        {compareModal && <CompareModal {...compareModal} onClose={() => { setCompareModal(null); setComparePicking(false); }} />}

        <header style={S.header}>
          <div style={S.logo}>MARCH MADNESS {tournamentYear}</div>
          <nav aria-label="Main navigation" className="mm-desktop-nav" style={{ display: 'flex', gap: 4 }}>
            {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="mm-user-label" style={{ display: 'inline-flex' }}><Avatar name={displayName} size={28} /></span>
            <span className="mm-user-label" style={{ fontSize: 13, color: '#888' }}>{formatName(displayName)}</span>
            {isTeacher && <span className="mm-user-label" style={{ fontSize: 10, background: 'rgba(196,149,42,0.2)', color: '#C4952A', border: '1px solid rgba(196,149,42,0.4)', borderRadius: 8, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
            {isAdmin && <span className="mm-user-label" style={{ fontSize: 10, background: 'rgba(192,57,43,0.2)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 8, padding: '2px 6px', fontWeight: 700 }}>ADMIN</span>}
            {saving && <span className="mm-user-label" style={{ fontSize: 11, color: '#B8CBE8' }}>Saving...</span>}
            {!saving && lastSaved && <span className="mm-user-label" style={{ fontSize: 11, color: MINT_BG, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={11} />Saved</span>}
            <button className="mm-user-label" onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#B8CBE8', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Exit</button>
            <button
              className="mm-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{ display: 'none', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8 }}
            >
              {menuOpen ? <X size={22} color="#B8CBE8" /> : <Menu size={22} color="#B8CBE8" />}
            </button>
          </div>
        </header>

        {menuOpen && (
          <nav
            className="mm-mobile-nav"
            aria-label="Mobile navigation"
            onKeyDown={e => { if (e.key === 'Escape') setMenuOpen(false); }}
            style={{ display: 'none', position: 'fixed', top: 60, left: 0, right: 0, zIndex: 199, background: 'rgba(9,24,40,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(28,53,88,0.6)', padding: '8px 12px 14px', flexDirection: 'column', gap: 2 }}
          >
            {tabs.map(t => (
              <button key={t.id}
                style={{ ...S.navBtn(tab === t.id), textAlign: 'left', padding: '12px 14px', borderRadius: 10, fontSize: 14, width: '100%', boxSizing: 'border-box' }}
                onClick={() => { setTab(t.id); setMenuOpen(false); }}>
                {t.label}
              </button>
            ))}
            <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(28,53,88,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={displayName} size={24} />
              <span style={{ fontSize: 13, color: '#B8CBE8', flex: 1 }}>{formatName(displayName)}</span>
              {isTeacher && <span style={{ fontSize: 10, background: 'rgba(196,149,42,0.2)', color: '#C4952A', border: '1px solid rgba(196,149,42,0.4)', borderRadius: 8, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
              {isAdmin && <span style={{ fontSize: 10, background: 'rgba(192,57,43,0.2)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 8, padding: '2px 6px', fontWeight: 700 }}>ADMIN</span>}
              <button onClick={() => { handleSignOut(); setMenuOpen(false); }} style={{ background: 'none', border: 'none', color: '#B8CBE8', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Exit</button>
            </div>
          </nav>
        )}

        <main style={{ paddingBottom: 60 }}>

          {/* ══ BRACKET TAB ══ */}
          {tab === 'bracket' && (
            <div style={{ padding: 20, animation: 'fadeIn 200ms ease-out' }}>
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <TournamentSelector />
              </div>
              {activeTournament === 'basketball' && (
                <>
                  <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderScoreBar(false)}</div>
                  <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderFirstFourPanel(false)}</div>
                  {renderScrollBracket(false, 'bscroll-bb')}
                </>
              )}
              {activeTournament === 'mammals' && (
                <>
                  <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderScoreBar(true)}</div>
                  <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderFirstFourPanel(true)}</div>
                  {mammalGenerating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ color: '#86efac', fontSize: 13 }}>Generating animal facts... ({mammalGenProgress.done}/{mammalGenProgress.total})</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', background: '#86efac', borderRadius: 2, width: `${mammalGenProgress.total ? (mammalGenProgress.done / mammalGenProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                  {renderScrollBracket(true, 'bscroll-mm')}
                </>
              )}
            </div>
          )}

          {/* ══ RESEARCH TAB ══ */}
          {tab === 'research' && (
            <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto', animation: 'fadeIn 200ms ease-out' }}>
              <TournamentSelector />
              {activeTournament === 'basketball' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: MINT_FG, margin: 0 }}>Team Research Hub</h2>
                    {allTeamNames.length > 0 && (
                      <button
                        onClick={() => setComparePicking(p => !p)}
                        disabled={!selectedTeam}
                        style={{ ...S.btn(comparePicking ? 'rgba(9,24,40,0.10)' : NAVY, comparePicking ? '#1A1208' : '#fff'), padding: '7px 18px', fontSize: 13, opacity: selectedTeam ? 1 : 0.35 }}>
                        {comparePicking ? 'Cancel Compare' : 'Compare Teams'}
                      </button>
                    )}
                  </div>
                  {generating && (
                    <div style={{ ...S.card, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: NAVY, fontSize: 14, fontWeight: 700 }}>Generating research...</span><span style={{ color: '#7A7068', fontSize: 13 }}>{genProgress.done} / {genProgress.total}</span></div>
                      <div style={{ height: 6, background: 'rgba(9,24,40,0.08)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', background: NAVY, borderRadius: 3, width: `${genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} /></div>
                      {genProgress.current && <div style={{ fontSize: 12, color: '#7A7068', marginTop: 6 }}>Currently: {genProgress.current}</div>}
                    </div>
                  )}
                  {genError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} />{genError}</div>}
                  {allTeamNames.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
                      <Search size={40} color="#C8BFB0" style={{ marginBottom: 16 }} />
                      <div style={{ fontSize: 16, color: '#7A7068', marginBottom: 8 }}>No research data yet</div>
                      <div style={{ fontSize: 13, color: '#7A7068' }}>{isAdmin ? 'Go to Admin → Basketball → Generate Research' : 'Research data will appear once the admin generates it.'}</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 0, paddingBottom: 4, borderBottom: '1px solid rgba(9,24,40,0.12)' }}>
                        {['East','West','South','Midwest'].map(r => (
                          <button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0, color: bbActiveRegion === r ? '#fff' : '#1A1208' }} onClick={() => setBbActiveRegion(r)}>
                            {bbRegionNames[r] || r}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const regionTeams = bbTeamsByRegion[bbActiveRegion] || [];
                        if (regionTeams.length === 0) return (
                          <div style={{ margin: '14px 0 24px', color: '#666', fontSize: 13, fontStyle: 'italic' }}>No teams in this region yet.</div>
                        );
                        const bySeed = {};
                        regionTeams.forEach(t => { if (!bySeed[t.seed]) bySeed[t.seed] = []; bySeed[t.seed].push(t); });
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '14px 0 24px' }}>
                            {R64_SEED_MATCHUPS.map(([seedA, seedB]) => {
                              const sideA = bySeed[seedA] || [];
                              const sideB = bySeed[seedB] || [];
                              return (
                                <div key={`${seedA}v${seedB}`} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 4, alignItems: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {sideA.map(t => (
                                      <button key={t.name} style={{ ...S.btn(selectedTeam === t.name ? NAVY : 'rgba(9,24,40,0.06)', selectedTeam === t.name ? '#fff' : '#7A7068'), padding: '6px 10px', fontSize: 12, textAlign: 'left', width: '100%', boxShadow: selectedTeam === t.name ? '2px 2px 6px rgba(9,24,40,0.20)' : 'none' }}
                                        onClick={() => { setSelectedTeam(t.name); setComparePicking(false); }}>
                                        <span style={{ fontWeight: 700, fontSize: 10, opacity: 0.65, marginRight: 5 }}>#{t.seed}</span>{t.name}
                                      </button>
                                    ))}
                                  </div>
                                  <div style={{ textAlign: 'center', fontSize: 9, color: '#7A7068', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', userSelect: 'none' }}>vs</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {sideB.map(t => (
                                      <button key={t.name} style={{ ...S.btn(selectedTeam === t.name ? NAVY : 'rgba(9,24,40,0.06)', selectedTeam === t.name ? '#fff' : '#7A7068'), padding: '6px 10px', fontSize: 12, textAlign: 'left', width: '100%', boxShadow: selectedTeam === t.name ? '2px 2px 6px rgba(9,24,40,0.20)' : 'none' }}
                                        onClick={() => { setSelectedTeam(t.name); setComparePicking(false); }}>
                                        <span style={{ fontWeight: 700, fontSize: 10, opacity: 0.65, marginRight: 5 }}>#{t.seed}</span>{t.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {comparePicking && (
                        <div style={{ background: 'rgba(9,24,40,0.04)', border: '1px solid rgba(9,24,40,0.14)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: '#3A3028' }}>Pick a team to compare with <strong style={{ color: MINT_FG }}>{selectedTeam}</strong></span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                            {['East','West','South','Midwest'].map(r => (
                              <button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '6px 14px', fontSize: 12, flexShrink: 0, color: bbActiveRegion === r ? '#fff' : '#1A1208' }} onClick={() => setBbActiveRegion(r)}>
                                {bbRegionNames[r] || r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(bbTeamsByRegion[bbActiveRegion] || []).filter(t => t.name !== selectedTeam).map(t => {
                              const teamAObj = Object.values(bbTeamsByRegion).flat().find(x => x.name === selectedTeam) || { name: selectedTeam, seed: '?' };
                              return (
                                <button key={t.name} style={{ ...S.btn('rgba(9,24,40,0.06)', '#3A3028'), padding: '5px 12px', fontSize: 12 }}
                                  onClick={() => { setCompareModal({ teamA: teamAObj, teamB: t, cardA: researchData[selectedTeam] ?? null, cardB: researchData[t.name] ?? null, isMammal: false }); setComparePicking(false); }}>
                                  #{t.seed} {t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {selectedTeam && (
                        <div style={{ borderTop: '2px solid rgba(9,24,40,0.10)', paddingTop: 28, marginTop: 8 }}>
                          <ResearchCard teamName={selectedTeam} card={researchData[selectedTeam]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
              {activeTournament === 'mammals' && (
                <>
                  {Object.keys(mammalBattleVideos).filter(k => mammalBattleVideos[k]).length > 0 && (
                    <div style={{ marginBottom: 32 }}>
                      <h3 style={{ fontFamily: "'Libre Bodoni', serif", color: GREEN, marginBottom: 16, fontSize: 20 }}>Mammal Battle Videos</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 16 }}>
                        {Object.entries(mammalBattleVideos)
                          .filter(([, val]) => val)
                          .map(([round, videoId]) => (
                            <div key={round} style={{ ...S.card }}>
                              <div style={{ fontSize: 13, color: '#7A7068', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{round}</div>
                              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                                <iframe
                                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                  src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                                  title={`Mammal Battle ${round}`}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  loading="lazy"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: GREEN, margin: 0 }}>Animal Research Hub</h2>
                    {allAnimalNames.length > 0 && (
                      <button
                        onClick={() => setComparePicking(p => !p)}
                        disabled={!mammalSelectedAnimal}
                        style={{ ...S.btn(comparePicking ? 'rgba(26,67,50,0.12)' : GREEN, comparePicking ? '#1A1208' : '#fff'), padding: '7px 18px', fontSize: 13, opacity: mammalSelectedAnimal ? 1 : 0.35 }}>
                        {comparePicking ? 'Cancel Compare' : 'Compare Animals'}
                      </button>
                    )}
                  </div>
                  {mammalGenerating && (
                    <div style={{ ...S.card, marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: GREEN, fontSize: 14, fontWeight: 700 }}>Generating animal facts...</span><span style={{ color: '#7A7068', fontSize: 13 }}>{mammalGenProgress.done} / {mammalGenProgress.total}</span></div>
                      <div style={{ height: 6, background: 'rgba(9,24,40,0.08)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', background: GREEN, borderRadius: 3, width: `${mammalGenProgress.total ? (mammalGenProgress.done / mammalGenProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} /></div>
                    </div>
                  )}
                  {mammalGenError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={13} />{mammalGenError}</div>}
                  {allAnimalNames.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777', borderColor: 'rgba(134,239,172,0.15)' }}><Search size={40} color="#C8BFB0" style={{ marginBottom: 16 }} /><div style={{ fontSize: 16, marginBottom: 8 }}>No animal data yet</div><div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin → Mammal Madness → Generate Facts' : 'Check back after the admin sets up the animals'}</div></div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 0, paddingBottom: 4, borderBottom: '1px solid rgba(9,24,40,0.12)' }}>
                        {['East','West','South','Midwest'].map(r => (
                          <button key={r} style={{ ...S.navBtn(mammalActiveRegion === r), borderBottom: mammalActiveRegion === r ? '2px solid #86efac' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0, color: mammalActiveRegion === r ? '#fff' : '#1A1208' }} onClick={() => setMammalActiveRegion(r)}>
                            {mammalRegionNames[r] || r}
                          </button>
                        ))}
                      </div>
                      {(() => {
                        const regionAnimals = mammalAnimalsByRegion[mammalActiveRegion] || [];
                        if (regionAnimals.length === 0) return (
                          <div style={{ margin: '14px 0 24px', color: '#666', fontSize: 13, fontStyle: 'italic' }}>No animals in this region yet.</div>
                        );
                        const bySeed = {};
                        regionAnimals.forEach(a => { if (!bySeed[a.seed]) bySeed[a.seed] = []; bySeed[a.seed].push(a); });
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, margin: '14px 0 24px' }}>
                            {R64_SEED_MATCHUPS.map(([seedA, seedB]) => {
                              const sideA = bySeed[seedA] || [];
                              const sideB = bySeed[seedB] || [];
                              return (
                                <div key={`${seedA}v${seedB}`} style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', gap: 4, alignItems: 'center' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {sideA.map(a => (
                                      <button key={a.name} style={{ ...S.btn(mammalSelectedAnimal === a.name ? GREEN : 'rgba(9,24,40,0.06)', mammalSelectedAnimal === a.name ? '#fff' : '#7A7068'), padding: '6px 10px', fontSize: 12, textAlign: 'left', width: '100%', boxShadow: mammalSelectedAnimal === a.name ? '2px 2px 6px rgba(26,67,50,0.22)' : 'none' }}
                                        onClick={() => { setMammalSelectedAnimal(a.name); setComparePicking(false); }}>
                                        <span style={{ fontWeight: 700, fontSize: 10, opacity: 0.65, marginRight: 5 }}>#{a.seed}</span>{a.name}
                                      </button>
                                    ))}
                                  </div>
                                  <div style={{ textAlign: 'center', fontSize: 9, color: '#7A7068', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', userSelect: 'none' }}>vs</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {sideB.map(a => (
                                      <button key={a.name} style={{ ...S.btn(mammalSelectedAnimal === a.name ? GREEN : 'rgba(9,24,40,0.06)', mammalSelectedAnimal === a.name ? '#fff' : '#7A7068'), padding: '6px 10px', fontSize: 12, textAlign: 'left', width: '100%', boxShadow: mammalSelectedAnimal === a.name ? '2px 2px 6px rgba(26,67,50,0.22)' : 'none' }}
                                        onClick={() => { setMammalSelectedAnimal(a.name); setComparePicking(false); }}>
                                        <span style={{ fontWeight: 700, fontSize: 10, opacity: 0.65, marginRight: 5 }}>#{a.seed}</span>{a.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      {comparePicking && (
                        <div style={{ background: 'rgba(26,67,50,0.05)', border: '1px solid rgba(26,67,50,0.18)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: '#3A3028' }}>Pick an animal to compare with <strong style={{ color: GREEN }}>{mammalSelectedAnimal}</strong></span>
                          </div>
                          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                            {['East','West','South','Midwest'].map(r => (
                              <button key={r} style={{ ...S.navBtn(mammalActiveRegion === r), borderBottom: mammalActiveRegion === r ? '2px solid #86efac' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={() => setMammalActiveRegion(r)}>
                                {mammalRegionNames[r] || r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(mammalAnimalsByRegion[mammalActiveRegion] || []).filter(a => a.name !== mammalSelectedAnimal).map(a => {
                              const animalAObj = Object.values(mammalAnimalsByRegion).flat().find(x => x.name === mammalSelectedAnimal) || { name: mammalSelectedAnimal, seed: '?' };
                              return (
                                <button key={a.name} style={{ ...S.btn('rgba(26,67,50,0.08)', '#3A3028'), padding: '5px 12px', fontSize: 12 }}
                                  onClick={() => { setCompareModal({ teamA: animalAObj, teamB: a, cardA: mammalResearchData[mammalSelectedAnimal] ?? null, cardB: mammalResearchData[a.name] ?? null, isMammal: true }); setComparePicking(false); }}>
                                  #{a.seed} {a.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {mammalSelectedAnimal && (
                        <div style={{ borderTop: '2px solid rgba(26,67,50,0.15)', paddingTop: 28, marginTop: 8 }}>
                          <MammalResearchCard animalName={mammalSelectedAnimal} card={mammalResearchData[mammalSelectedAnimal]} isAdmin={isAdmin} onFieldSave={handleMammalResearchFieldSave} generating={mammalGeneratingOne === mammalSelectedAnimal} onGenerate={handleGenerateOneMammal} />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ LEADERBOARD TAB ══ */}
          {tab === 'leaderboard' && (
            <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', animation: 'fadeIn 200ms ease-out' }}>
              <TournamentSelector />
              {(() => {
                const lb = activeTournament === 'basketball' ? leaderboard : mammalLeaderboard;
                const isMammalLb = activeTournament === 'mammals';
                const accentColor = isMammalLb ? GREEN : NAVY;
                const top3 = lb.slice(0, 3);
                const filtered = lb.filter(e => schoolFilter === 'all' || e.school === schoolFilter);
                const myEntry = lb.find(e => e.uid === uid);
                const myRank = myEntry ? lb.indexOf(myEntry) + 1 : null;
                const isMyRankVisible = myRank !== null && myRank <= 13;
                const PODIUM_COLORS = ['#C4952A','#A8A8A8','#CD7F32'];
                return (
                  <>
                    {/* School filter pills */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                      {['all', ...SCHOOLS].map(f => (
                        <button key={f} onClick={() => setSchoolFilter(f)}
                          style={{ ...S.btn(schoolFilter === f ? accentColor : 'rgba(9,24,40,0.06)', schoolFilter === f ? '#fff' : '#5C5248'), padding: '6px 14px', fontSize: 12 }}>
                          {f === 'all' ? 'All Schools' : f}
                        </button>
                      ))}
                    </div>

                    {/* Top-3 Podium */}
                    {top3.length > 0 && schoolFilter === 'all' && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
                        {top3.map((entry, i) => (
                          <div key={entry.uid} className="mm-podium" style={{
                            ...S.card,
                            flex: i === 0 ? '1.2' : '1',
                            border: `2px solid ${PODIUM_COLORS[i]}`,
                            boxShadow: `4px 6px 14px rgba(9,24,40,0.10), inset -1px -1px 4px rgba(255,255,255,0.8), 0 0 0 1px ${PODIUM_COLORS[i]}40`,
                            textAlign: 'center',
                            padding: '20px 12px',
                          }}>
                            <div style={{ marginBottom: 8 }}>
                              {i === 0 ? <Trophy size={28} color={PODIUM_COLORS[0]} /> : <span style={{ color: PODIUM_COLORS[i], fontWeight: 900, fontSize: i === 0 ? 28 : 20 }}>#{i+1}</span>}
                            </div>
                            <Avatar name={entry.displayName} size={i === 0 ? 36 : 28} />
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1208', marginBottom: 2, marginTop: 6 }}>{formatName(entry.displayName)}</div>
                            {entry.school && <div style={{ fontSize: 11, color: '#7A7068', marginBottom: 6 }}>{entry.school}</div>}
                            <div style={{ fontSize: i === 0 ? 26 : 20, fontWeight: 900, color: PODIUM_COLORS[i], fontFamily: "'Libre Bodoni', serif", fontVariantNumeric: 'tabular-nums' }}>{entry.score}</div>
                            <div style={{ fontSize: 10, color: '#7A7068', textTransform: 'uppercase', letterSpacing: 1 }}>pts</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Full ranked list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filtered.length === 0
                        ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#7A7068' }}>No entries yet — be the first!</div>
                        : filtered.map((entry) => {
                          const isMe = entry.uid === uid;
                          const isFlashed = !!flashedScores[entry.uid];
                          return (
                            <div key={entry.uid} className={`mm-lb-row${isFlashed ? ' score-flash' : ''}`}
                              style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, border: isMe ? `2px solid ${accentColor}` : '2px solid rgba(9,24,40,0.20)' }}>
                              <span style={{ fontSize: 14, fontWeight: 900, color: '#7A7068', minWidth: 28 }}>#{entry.rank}</span>
                              <Avatar name={entry.displayName} size={28} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: isMe ? accentColor : '#1A1208', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatName(entry.displayName)}{isMe ? ' (You)' : ''}
                                </div>
                                {entry.school && <div style={{ fontSize: 11, color: '#7A7068' }}>{entry.school}</div>}
                              </div>
                              <button onClick={() => handleViewBracket(entry.uid, entry.displayName, isMammalLb)} disabled={loadingBracket === entry.uid + (isMammalLb ? '-mm' : '')} style={{ ...S.btn('rgba(9,24,40,0.06)', '#7A7068'), padding: '4px 10px', fontSize: 11, flexShrink: 0 }}>{loadingBracket === entry.uid + (isMammalLb ? '-mm' : '') ? '...' : 'View'}</button>
                              <span style={{ fontSize: 20, fontWeight: 900, color: accentColor, fontFamily: "'Libre Bodoni', serif", minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{entry.score}</span>
                            </div>
                          );
                        })}
                    </div>

                    {/* Sticky your-rank bar */}
                    {myEntry && !isMyRankVisible && (
                      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: accentColor, color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 -4px 20px rgba(9,24,40,0.25)' }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Your rank: #{myRank}</span>
                        <span style={{ fontSize: 18, fontWeight: 900 }}>{myEntry.score} pts</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ══ TEACHER TAB ══ */}
          {tab === 'teacher' && (isTeacher || isAdmin) && (
            <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', animation: 'fadeIn 200ms ease-out' }}>
              <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: NAVY, marginBottom: 4, fontSize: 24 }}>
                {teacherSchool || school} — Your Class
              </h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {['leaderboard','roster','videos'].map(v => (
                  <button key={v} onClick={() => setTeacherActiveView(v)}
                    style={{ ...S.btn(teacherActiveView === v ? NAVY : 'rgba(9,24,40,0.08)', teacherActiveView === v ? '#fff' : '#7A7068'), padding: '8px 18px', fontSize: 13 }}>
                    {v === 'leaderboard' ? 'Class Leaderboard' : v === 'roster' ? 'Student Roster' : 'Battle Videos'}
                  </button>
                ))}
              </div>

              {/* Class Leaderboard */}
              {teacherActiveView === 'leaderboard' && (() => {
                const schoolToFilter = teacherSchool || school;
                const lb = (teacherTournament === 'basketball' ? leaderboard : mammalLeaderboard)
                  .filter(e => e.school === schoolToFilter);
                return (
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button onClick={() => setTeacherTournament('basketball')} style={{ ...S.btn(teacherTournament === 'basketball' ? NAVY : 'rgba(9,24,40,0.08)', teacherTournament === 'basketball' ? '#fff' : '#7A7068'), padding: '6px 16px', fontSize: 12 }}>Basketball</button>
                      <button onClick={() => setTeacherTournament('mammals')} style={{ ...S.btn(teacherTournament === 'mammals' ? GREEN : 'rgba(9,24,40,0.08)', teacherTournament === 'mammals' ? '#fff' : '#7A7068'), padding: '6px 16px', fontSize: 12 }}>Mammal Madness</button>
                    </div>
                    {lb.length === 0
                      ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#7A7068' }}>No students from {schoolToFilter} have submitted yet.</div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {lb.map((entry, i) => (
                            <div key={entry.uid} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontSize: 14, fontWeight: 900, color: '#7A7068', minWidth: 28 }}>#{i + 1}</span>
                              <Avatar name={entry.displayName} size={24} />
                              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{formatName(entry.displayName)}</span>
                              <span style={{ fontSize: 18, fontWeight: 900, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{entry.score}</span>
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                );
              })()}

              {/* Student Roster */}
              {teacherActiveView === 'roster' && (
                <div>
                  {teacherRosterError && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={13} />{teacherRosterError}
                    </div>
                  )}
                  {teacherRosterLoading
                    ? <div style={{ textAlign: 'center', color: '#7A7068', padding: 40 }}>Loading roster...</div>
                    : teacherRosterStudents.length === 0
                    ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#7A7068' }}>No students from {teacherSchool || school} found.</div>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto auto', gap: 12, padding: '8px 16px', fontSize: 11, color: '#7A7068', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                          <span>Name</span><span>School</span><span>BB Score</span><span>Mammal</span><span>Edit School</span><span>Remove</span>
                        </div>
                        {teacherRosterStudents.map(student => {
                          const bbEntry = leaderboard.find(e => e.uid === student.uid);
                          const mmEntry = mammalLeaderboard.find(e => e.uid === student.uid);
                          const studentName = bbEntry?.displayName || mmEntry?.displayName || 'Unknown';
                          const callTeacherAction = async (action, extra = {}) => {
                            const idToken = await auth.currentUser.getIdToken();
                            const res = await fetch('/api/teacher-action', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ idToken, action, targetUid: student.uid, ...extra }),
                            });
                            if (!res.ok) {
                              const { error } = await res.json().catch(() => ({}));
                              throw new Error(error || 'Action failed');
                            }
                          };
                          return (
                            <div key={student.uid} style={{ ...S.card, padding: '10px 16px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto auto', gap: 12, alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentName}</span>
                              <span style={{ fontSize: 13, color: '#7A7068' }}>{student.school}</span>
                              <span style={{ fontWeight: 700 }}>{bbEntry?.score ?? '—'}</span>
                              <span style={{ fontWeight: 700 }}>{mmEntry?.score ?? '—'}</span>
                              <select
                                defaultValue={student.school}
                                onChange={async e => {
                                  const newSchool = e.target.value;
                                  if (!newSchool || newSchool === student.school) return;
                                  try {
                                    await callTeacherAction('editSchool', { school: newSchool });
                                    setTeacherRosterStudents(prev => prev.map(s => s.uid === student.uid ? { ...s, school: newSchool } : s));
                                    setTeacherRosterError('');
                                  } catch (err) {
                                    setTeacherRosterError(`Could not update school: ${err.message}`);
                                    e.target.value = student.school;
                                  }
                                }}
                                style={{ ...S.input, width: 'auto', padding: '4px 8px', fontSize: 12 }}
                              >
                                {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button onClick={() => {
                                if (!window.confirm(`Remove ${studentName}? This deletes their bracket and score.`)) return;
                                callTeacherAction('removeStudent')
                                  .then(() => { setTeacherRosterStudents(prev => prev.filter(s => s.uid !== student.uid)); setTeacherRosterError(''); })
                                  .catch(err => setTeacherRosterError(`Could not remove student: ${err.message}`));
                              }} style={{ ...S.btn('#c0392b'), padding: '4px 10px', fontSize: 11 }}>Remove</button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  }
                </div>
              )}

              {/* Battle Videos (teacher projection view) */}
              {teacherActiveView === 'videos' && (
                <div>
                  {Object.keys(mammalBattleVideos).filter(k => mammalBattleVideos[k]).length === 0
                    ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#7A7068' }}>No battle videos added yet. Ask the admin to add video IDs in Admin → Mammal.</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {Object.entries(mammalBattleVideos)
                          .filter(([, v]) => v)
                          .map(([round, videoId]) => (
                            <div key={round} style={{ ...S.card }}>
                              <div style={{ fontSize: 13, color: '#7A7068', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{round}</div>
                              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                                <iframe
                                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                  src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                                  title={`Mammal Battle ${round}`}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  loading="lazy"
                                />
                              </div>
                            </div>
                          ))
                        }
                      </div>
                  }
                </div>
              )}
            </div>
          )}

          {/* ══ ADMIN TAB ══ */}
          {tab === 'admin' && isAdmin && (
            <div style={{ padding: 24, maxWidth: 960, margin: '0 auto', animation: 'fadeIn 200ms ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c', boxShadow: '0 0 6px #e74c3c' }} />
                <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: '#c0392b', margin: 0 }}>Admin Panel</h2>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[['dashboard','Dashboard'],['teams','Basketball'],['mammals','Mammal Madness'],['users','Users'],['people','People'],['help','Help']].map(([id, label]) => (
                  <button key={id} style={{ ...S.navBtn(adminSubTab === id), borderBottom: adminSubTab === id ? '2px solid #e74c3c' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setAdminSubTab(id)}>{label}</button>
                ))}
              </div>

              {adminSubTab === 'dashboard' && (
                <>
                  <div style={{ ...S.card, borderColor: 'rgba(9,24,40,0.2)', marginBottom: 16 }}>
                    <h3 style={{ color: NAVY, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
                    <p style={{ color: '#7A7068', fontSize: 13, marginBottom: 12 }}>Updates the year shown on the entry screen and header for all users.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)} style={{ ...S.input, width: 110, padding: '8px 12px', fontSize: 16 }} />
                      <button style={{ ...S.btn(NAVY, '#fff'), padding: '8px 20px' }} onClick={handleSaveYear} disabled={yearSaving}>{yearSaving ? 'Saving...' : 'Update Year'}</button>
                      <span style={{ fontSize: 12, color: '#7A7068' }}>Currently: <strong style={{ color: NAVY }}>{tournamentYear}</strong></span>
                    </div>
                    {yearSaveError && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={13} />Year update failed: {yearSaveError}
                      </div>
                    )}
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(9,24,40,0.15)', marginBottom: 16 }}>
                    <p style={{ color: '#7A7068', fontSize: 13, margin: 0 }}>Admin access is now email-based. Manage admins and teachers in the <strong style={{ color: NAVY }}>People</strong> sub-tab.</p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(9,24,40,0.15)', marginBottom: 16 }}>
                    <p style={{ color: '#7A7068', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                      Use the <strong style={{ color: NAVY }}>Bracket tab</strong> to enter official game results — your picks become the answer key and update all scores live.<br /><br />
                      Use <strong style={{ color: NAVY }}>Admin → Basketball</strong> every March after Selection Sunday to enter teams.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
                    {[['Total Entries', leaderboard.length], ['Avg Score', leaderboard.length ? Math.round(leaderboard.reduce((a,e) => a+(e.score||0),0)/leaderboard.length)+' pts' : '-'], ['Status', locked ? 'Locked' : 'Open']].map(([l,v]) => (
                      <div key={l} style={{ ...S.card, textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, fontFamily: "'Libre Bodoni', serif" }}>{v}</div>
                        <div style={{ fontSize: 11, color: '#7A7068', marginTop: 4 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(192,57,43,0.25)' }}>
                    <h3 style={{ color: '#c0392b', marginBottom: 6, fontSize: 15 }}>New Year Reset</h3>
                    <p style={{ color: '#7A7068', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
                      Deletes all brackets and leaderboard entries for both tournaments. Does not delete rosters, research data, or tournament config. Use at the start of each new school year.
                    </p>
                    <button
                      style={{ ...S.btn('#c0392b'), fontSize: 13, padding: '8px 20px' }}
                      onClick={() => setConfirmDialog({
                        message: 'Delete ALL brackets and leaderboard entries for both tournaments? This cannot be undone.',
                        onConfirm: async () => {
                          setConfirmDialog(null);
                          await deleteAllBrackets();
                          setLeaderboard([]);
                          setMammalLeaderboard([]);
                        }
                      })}>
                      Clear All Data (New Year Reset)
                    </button>
                  </div>
                </>
              )}

              {adminSubTab === 'teams' && (
                <>
                  <TeamEntryPanel onTeamsSaved={(nb) => { setBracket(nb); setOfficialBracket(nb); }} onRequestGenerateResearch={handleGenerateResearch} regionNames={bbRegionNames} onRegionNamesChange={handleSaveBbRegionNames} sourcesData={bbSources} onSaveSources={handleSaveBbSources} />
                  <div style={{ marginTop: 40, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 24 }}>
                    <div style={{ fontSize: 11, color: '#e74c3c', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>⚠️ Danger Zone</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[
                        ['Clear Basketball Roster', 'Deletes the team roster and official bracket.', async () => { await Promise.all([deleteDoc(doc(db, 'admin', 'teamRoster')).catch(()=>{}), deleteDoc(doc(db, 'admin', 'officialBracket')).catch(()=>{})]); setOfficialBracket(null); setBracket(buildInitialBracket()); }],
                        ['Clear Basketball Research', 'Deletes all scouting reports.', async () => { await deleteDoc(doc(db, 'admin', 'researchData')).catch(()=>{}); setResearchData({}); setSelectedTeam(null); }],
                        ['Clear All User Brackets', 'Resets the leaderboard.', async () => { const [bs, ls] = await Promise.all([getDocs(collection(db, 'brackets')), getDocs(collection(db, 'leaderboard'))]); await Promise.all([...bs.docs.map(d => deleteDoc(d.ref)), ...ls.docs.map(d => deleteDoc(d.ref))]); setLeaderboard([]); }],
                      ].map(([title, desc, action]) => (
                        <div key={title} style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 200 }}>
                          <h4 style={{ color: '#f87171', marginBottom: 6 }}>{title}</h4>
                          <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>{desc}</p>
                          <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }} onClick={() => setConfirmDialog({ message: `${title}? This cannot be undone.`, onConfirm: async () => { setConfirmDialog(null); await action(); } })}>{title}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {adminSubTab === 'mammals' && (
                <>
                  {/* Mammal Battle Videos */}
                  <div style={{ ...S.card, marginBottom: 24 }}>
                    <h4 style={{ color: GREEN, marginBottom: 4, fontWeight: 700 }}>Mammal Battle Videos</h4>
                    <p style={{ fontSize: 12, color: '#7A7068', marginBottom: 16 }}>Enter YouTube video IDs (e.g. <code style={{ background: 'rgba(9,24,40,0.07)', padding: '1px 4px', borderRadius: 3 }}>dQw4w9WgXcQ</code>) for each round. Leave blank to hide.</p>
                    {['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Final Four', 'Championship'].map(round => (
                      <div key={round} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#1A1208', minWidth: 120 }}>{round}</label>
                        <input
                          value={adminMammalVideos[round] || ''}
                          onChange={e => setAdminMammalVideos(prev => ({ ...prev, [round]: e.target.value.trim() }))}
                          placeholder="YouTube video ID"
                          style={{ ...S.input, flex: 1, fontSize: 13 }}
                        />
                      </div>
                    ))}
                    <button
                      disabled={adminMammalVideosSaving}
                      onClick={async () => {
                        setAdminMammalVideosSaving(true);
                        try {
                          const clean = Object.fromEntries(Object.entries(adminMammalVideos).filter(([, v]) => v));
                          await saveMammalBattleVideos(clean);
                        } catch (e) { console.warn('Failed to save videos:', e); }
                        setAdminMammalVideosSaving(false);
                      }}
                      style={{ ...S.btn(GREEN), marginTop: 8 }}>
                      {adminMammalVideosSaving ? 'Saving...' : 'Save Videos'}
                    </button>
                  </div>

                  <div style={{ ...S.card, borderColor: 'rgba(134,239,172,0.2)', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div><h3 style={{ color: '#86efac', marginBottom: 4 }}>Mammal Bracket Lock</h3><p style={{ color: '#999', fontSize: 13, margin: 0 }}>Status: <span style={{ color: mammalLocked ? '#e74c3c' : '#22c55e', fontWeight: 700 }}>{mammalLocked ? 'Locked' : 'Open'}</span></p></div>
                      <button style={{ ...S.btn(mammalLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 13, padding: '8px 20px' }}
                        onClick={() => setConfirmDialog({ message: `${mammalLocked ? 'Unlock' : 'Lock'} all Mammal Madness brackets?`, onConfirm: async () => { setConfirmDialog(null); const nl = !mammalLocked; setMammalLocked(nl); await setMammalTournamentLocked(nl); } })}>
                        {mammalLocked ? 'Unlock' : 'Lock All'}
                      </button>
                    </div>
                  </div>
                  <MammalEntryPanel onAnimalsSaved={(nb) => { setMammalBracket(nb); setMammalOfficialBracket(nb); }} onRequestGenerateMammalResearch={handleGenerateMammalResearch} onRefetchImages={handleRefetchMammalImages} regionNames={mammalRegionNames} onRegionNamesChange={setMammalRegionNames} sourcesData={mammalSources} onSaveSources={handleSaveMammalSources} />
                  <div style={{ marginTop: 40, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 24 }}>
                    <div style={{ fontSize: 11, color: '#e74c3c', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>⚠️ Danger Zone</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[
                        ['Clear Mammal Roster', 'Deletes the animal roster and bracket.', async () => { await Promise.all([deleteDoc(doc(db, 'admin', 'mammalRoster')).catch(()=>{}), deleteDoc(doc(db, 'admin', 'officialBracket_mammals')).catch(()=>{})]); setMammalOfficialBracket(null); setMammalBracket(buildInitialBracket()); }],
                        ['Clear Mammal Research', 'Deletes all organism profiles.', async () => { await deleteDoc(doc(db, 'admin', 'researchData_mammals')).catch(()=>{}); setMammalResearchData({}); setMammalSelectedAnimal(null); }],
                        ['Clear All Mammal Brackets', 'Resets the mammal leaderboard.', async () => { const [bs, ls] = await Promise.all([getDocs(collection(db, 'brackets_mammals')), getDocs(collection(db, 'leaderboard_mammals'))]); await Promise.all([...bs.docs.map(d => deleteDoc(d.ref)), ...ls.docs.map(d => deleteDoc(d.ref))]); setMammalLeaderboard([]); }],
                      ].map(([title, desc, action]) => (
                        <div key={title} style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 200 }}>
                          <h4 style={{ color: '#f87171', marginBottom: 6 }}>{title}</h4>
                          <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>{desc}</p>
                          <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }} onClick={() => setConfirmDialog({ message: `${title}? This cannot be undone.`, onConfirm: async () => { setConfirmDialog(null); await action(); } })}>{title}</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {adminSubTab === 'users' && (
                <div>
                  <h3 style={{ color: MINT_FG, marginBottom: 4 }}>User Entries</h3>
                  <p style={{ color: '#777', fontSize: 13, marginBottom: 20 }}>All users who have submitted a bracket. Removing a user deletes their bracket and score.</p>
                  {leaderboard.length === 0 ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>No users yet</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {leaderboard.map(e => (
                        <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                          <Avatar name={e.displayName} size={32} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>{e.displayName || 'Anonymous'}</div>
                            <div style={{ fontSize: 11, color: '#555' }}>Score: {e.score} pts {e.isTeacher ? '· Teacher' : ''}</div>
                          </div>
                          <button onClick={() => setConfirmDialog({ message: `Remove ${e.displayName}? This deletes their bracket and score.`, onConfirm: async () => { setConfirmDialog(null); await deleteBracketAndScore(e.uid, false); await deleteBracketAndScore(e.uid, true); } })} style={{ ...S.btn('rgba(239,68,68,0.15)', '#f87171'), padding: '5px 14px', fontSize: 12, border: '1px solid rgba(239,68,68,0.3)', flexShrink: 0 }}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ color: '#777', marginBottom: 10, fontSize: 13 }}>Mark a user as Teacher (appears with Teacher badge on leaderboard)</h4>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input id="teacher-name" placeholder="Exact display name" style={{ ...S.input, flex: 1, padding: '8px 12px', fontSize: 13 }} />
                      <button style={{ ...S.btn('#f59e0b', '#000'), padding: '8px 16px', fontSize: 13, flexShrink: 0 }} onClick={async () => {
                        const name = document.getElementById('teacher-name').value.trim();
                        if (!name) return;
                        const match = leaderboard.find(e => e.displayName?.toLowerCase() === name.toLowerCase());
                        if (!match) { setMarkTeacherMsg({ type: 'error', text: 'User not found on leaderboard.' }); return; }
                        await setDoc(doc(db, 'leaderboard', match.uid), { isTeacher: true }, { merge: true });
                        document.getElementById('teacher-name').value = '';
                        setMarkTeacherMsg({ type: 'success', text: `${match.displayName} marked as Teacher.` });
                      }}>Mark as Teacher</button>
                    </div>
                    {markTeacherMsg && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: markTeacherMsg.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${markTeacherMsg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, fontSize: 13, color: markTeacherMsg.type === 'error' ? '#f87171' : '#22c55e', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {markTeacherMsg.type === 'error' && <AlertTriangle size={13} />}{markTeacherMsg.text}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {adminSubTab === 'people' && (
                <div>
                  <h3 style={{ fontFamily: "'Libre Bodoni', serif", color: NAVY, marginBottom: 20 }}>Manage Roles</h3>
                  {adminPeopleLoading
                    ? <div style={{ color: '#7A7068', padding: 20 }}>Loading...</div>
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Admins */}
                        <div style={{ ...S.card }}>
                          <h4 style={{ color: NAVY, marginBottom: 12, fontWeight: 700 }}>Super Admins</h4>
                          {adminPeopleAdmins.map(email => (
                            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(9,24,40,0.08)' }}>
                              <span style={{ fontSize: 14 }}>{email}</span>
                              <button onClick={() => {
                                const updated = adminPeopleAdmins.filter(e => e !== email);
                                setAdminPeopleAdmins(updated);
                                saveSuperAdmins(updated).catch(console.warn);
                              }} style={{ ...S.btn('#c0392b'), padding: '4px 10px', fontSize: 11 }}>Remove</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                            <input placeholder="Email address" value={adminNewAdminEmail} onChange={e => setAdminNewAdminEmail(e.target.value)} style={{ ...S.input, flex: 1 }} />
                            <button onClick={() => {
                              const email = adminNewAdminEmail.trim().toLowerCase();
                              if (!email || adminPeopleAdmins.includes(email)) return;
                              const updated = [...adminPeopleAdmins, email];
                              setAdminPeopleAdmins(updated);
                              saveSuperAdmins(updated).catch(console.warn);
                              setAdminNewAdminEmail('');
                            }} style={{ ...S.btn(NAVY), padding: '10px 18px', fontSize: 13, flexShrink: 0 }}>Add Admin</button>
                          </div>
                        </div>
                        {/* Teachers */}
                        <div style={{ ...S.card }}>
                          <h4 style={{ color: NAVY, marginBottom: 12, fontWeight: 700 }}>Teachers</h4>
                          {Object.entries(adminPeopleTeachers).filter(([k]) => k !== 'updatedAt').map(([email, data]) => (
                            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(9,24,40,0.08)' }}>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>{email}</div>
                                <div style={{ fontSize: 12, color: '#7A7068' }}>{data.school}</div>
                              </div>
                              <button onClick={() => {
                                const updated = { ...adminPeopleTeachers };
                                delete updated[email];
                                setAdminPeopleTeachers(updated);
                                saveTeachers(updated).catch(console.warn);
                              }} style={{ ...S.btn('#c0392b'), padding: '4px 10px', fontSize: 11 }}>Remove</button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                            <input placeholder="Teacher email" value={adminNewTeacherEmail} onChange={e => setAdminNewTeacherEmail(e.target.value)} style={{ ...S.input, flex: 2, minWidth: 200 }} />
                            <select value={adminNewTeacherSchool} onChange={e => setAdminNewTeacherSchool(e.target.value)} style={{ ...S.input, flex: 1, minWidth: 120 }}>
                              {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button onClick={() => {
                              const email = adminNewTeacherEmail.trim().toLowerCase();
                              if (!email) return;
                              const updated = { ...adminPeopleTeachers, [email]: { school: adminNewTeacherSchool } };
                              setAdminPeopleTeachers(updated);
                              saveTeachers(updated).catch(console.warn);
                              setAdminNewTeacherEmail('');
                            }} style={{ ...S.btn(NAVY), padding: '10px 18px', fontSize: 13, flexShrink: 0 }}>Add Teacher</button>
                          </div>
                        </div>
                      </div>
                    )
                  }
                </div>
              )}

              {adminSubTab === 'help' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={S.card}>
                    <h3 style={{ color: MINT_FG, marginBottom: 14 }}>How Admin Access Works</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      There is no longer a Google login requirement. Anyone can visit the app and enter their name to participate.<br /><br />
                      Admin access is protected by the password you set in Dashboard → Admin Password. To give someone else admin access, share the password with them — they can click "Admin" in the nav and enter it.<br /><br />
                      Admin status is stored in the browser. If you clear your browser storage, you'll need to re-enter the password.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(245,158,11,0.25)' }}>
                    <h3 style={{ color: '#C4952A', marginBottom: 14 }}>Marking Teachers</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      Go to Admin → Users tab. Find the teacher's name on the leaderboard, then use the "Mark as Teacher" field at the bottom. They'll get a Teacher badge on the leaderboard.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.2)' }}>
                    <h3 style={{ color: MINT_FG, marginBottom: 14 }}>New Season Checklist</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      1. Update the tournament year in Dashboard.<br />
                      2. Clear Basketball Roster & Research in Admin → 🏀 Basketball → Danger Zone.<br />
                      3. Clear Mammal Roster & Research in Admin → 🦁 Mammal Madness → Danger Zone.<br />
                      4. Clear all user brackets in both Danger Zones.<br />
                      5. Enter new teams and animals, apply to brackets, generate research.<br />
                      6. Unlock brackets when ready.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '8px 20px', display: 'flex', justifyContent: 'center', gap: 20, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,26,14,0.95)', zIndex: 100 }}>
          <button onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Privacy Policy</button>
          <button onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Terms of Service</button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
