// src/App.jsx
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Component } from 'react';
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import {
  saveBracket, loadBracket, findBracketByName,
  saveOfficialBracket, subscribeToOfficialBracket,
  subscribeToConfig, setTournamentLocked,
  subscribeToLeaderboard, updateLeaderboardEntry,
  saveResearchData, saveOneTeamResearch, subscribeToResearchData,
  saveMammalBracket, loadMammalBracket,
  saveMammalOfficialBracket, subscribeToMammalOfficialBracket,
  subscribeToMammalConfig, setMammalTournamentLocked,
  subscribeToMammalLeaderboard, updateMammalLeaderboardEntry,
  saveMammalResearchData, saveOneMammalResearch, subscribeToMammalResearchData,
  saveMammalRoster, checkAdminPassword, adminExists, setAdminPassword,
  deleteBracketAndScore, getAllBracketUids,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, buildInitialBracketFromTeams, calcScore,
} from './bracketData';

// ── THEME ─────────────────────────────────────────────────────────────────────
const ACCENT  = '#16a34a';
const ACCENT2 = '#4ade80';
const GOLD    = '#f59e0b';
const GOLD2   = '#fcd34d';
const RC = { East: '#93c5fd', West: '#fca5a5', South: '#86efac', Midwest: '#fdba74' };
const ROUND_COLORS = [
  'rgba(96,165,250,0.22)', 'rgba(167,139,250,0.22)',
  'rgba(251,191,36,0.18)', 'rgba(239,68,68,0.22)', 'rgba(16,185,129,0.25)',
];
const ROUND_BORDER_COLORS = [
  'rgba(96,165,250,0.6)', 'rgba(167,139,250,0.6)',
  'rgba(251,191,36,0.55)', 'rgba(239,68,68,0.6)', 'rgba(52,211,153,0.7)',
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
  const colors = ['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0891b2','#059669','#d97706'];
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
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏀</div>
          <h2 style={{ color: '#f87171', fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Your bracket picks are saved. Try reloading the page.</p>
          <button style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => window.location.reload()}>Reload Page</button>
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
  return <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '6px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>You are offline — picks will save when you reconnect</div>;
}

// ── TEAM LOGO ─────────────────────────────────────────────────────────────────
const TeamLogo = memo(function TeamLogo({ espnId, name, size = 22 }) {
  const [err, setErr] = useState(false);
  if (!espnId || err) return (
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#14532d,#166534)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
      {name?.charAt(0) || '?'}
    </span>
  );
  return <img src={`https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, background: '#fff' }} onError={() => setErr(true)} />;
});

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

// ── GAME SLOT ─────────────────────────────────────────────────────────────────
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };

function findLiveScore(liveScores, teamName) {
  if (!teamName || !liveScores) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(teamName);
  const exact = Object.entries(liveScores).find(([k]) => norm(k) === target);
  if (exact) return exact[1];
  const sub = Object.entries(liveScores).find(([k]) => { const nk = norm(k); return nk.includes(target) || target.includes(nk); });
  return sub ? sub[1] : null;
}

const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onCompare }) {
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
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px', background: isW ? 'linear-gradient(180deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 6, opacity: isL ? 0.3 : 1, transition: 'background .12s', minWidth: 100, border: isW ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={36} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700 }}>{team.seed}</span>
        <span style={{ fontSize: 14, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textAlign: 'center', maxWidth: 120, lineHeight: 1.2 }}>{isFF ? 'TBD' : team.name}</span>
        {hasLive && live && <span style={{ fontSize: 18, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888' }}>{live.score}</span>}
        {isW && <span style={{ color: ACCENT2, fontSize: 13 }}>✓</span>}
      </div>
    );
    return (
      <div onClick={() => !locked && !isFF && onPick?.(side)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? 'linear-gradient(90deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.3 : 1, transition: 'background .12s' }}>
        <TeamLogo espnId={team.espnId} name={team.name} size={20} />
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 14, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
          {isFF ? 'First Four Winner' : team.name}
        </span>
        {hasLive && live && <span style={{ fontSize: 13, fontWeight: 800, color: isFinal && live.winner ? ACCENT2 : isLiveGame && isLiveWinning ? '#facc15' : '#888', minWidth: 24, textAlign: 'right', flexShrink: 0 }}>{live.score}</span>}
        {isW && !hasLive && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: ACCENT2, fontSize: 11 }}>✓</span>}
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
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
        </div>
      )}
    </div>
  );

  return (
    <div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
      <Team team={top} side="top" />
      <div style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} />
      <Team team={bottom} side="bottom" />
      {isLiveGame && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '2px 8px', background: 'rgba(239,68,68,0.12)', borderTop: '1px solid rgba(239,68,68,0.2)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'livePulse 1.2s ease-in-out infinite' }} /><span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span></div>}
      {isFinal && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 8px', background: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(255,255,255,0.06)' }}><span style={{ fontSize: 10, color: '#777', fontWeight: 700 }}>FINAL</span></div>}
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#777', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
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
                {isAdmin ? <EditableField value={p.name} label="name" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.name`, v)} /> : <span style={{ fontWeight: 700 }}>{p.name}</span>}
                {isAdmin ? <EditableField value={p.pos} label="pos" onSave={v => onFieldSave(teamName, `keyPlayers.${i}.pos`, v)} /> : <span style={{ color: '#999', fontSize: 12 }}>{p.pos}</span>}
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
          <div style={{ padding: 12, background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.18)', fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>Bracket tip: Advancing this team deep rewards strong point upside relative to their championship probability.</div>
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
        {phyloPicUrl && !imgErrors['phylopic'] && <img src={phyloPicUrl} alt={`${animalName} silhouette`} onError={() => handleImgError('phylopic')} style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', height: 120, opacity: 0.35, filter: 'brightness(0)', objectFit: 'contain' }} />}
        {wikiImageUrl && !imgErrors['wiki-header'] && <img src={wikiImageUrl} alt={animalName} onError={() => handleImgError('wiki-header')} style={{ position: 'absolute', left: 0, top: 0, width: '45%', height: '100%', objectFit: 'cover', opacity: 0.25 }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,0.5) 0%,transparent 60%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>{region} Region · Seed #{card?.seed || ''}</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#fff', margin: 0, fontSize: 26, textShadow: '0 2px 8px rgba(0,0,0,0.8)', lineHeight: 1.1 }}>{animalName}</h2>
            {card?.latinName && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', marginTop: 3 }}>{card.latinName}</div>}
          </div>
          {isAdmin && <button onClick={() => onGenerate(animalName)} disabled={generating} style={{ ...S.btn('#6366f1', '#fff'), padding: '7px 16px', fontSize: 12, flexShrink: 0 }}>{generating ? 'Generating...' : 'Regenerate'}</button>}
        </div>
      </div>
      {empty ? (
        <div style={{ ...S.card, borderRadius: '0 0 12px 12px', borderTop: 'none', color: '#666', fontSize: 14, fontStyle: 'italic', textAlign: 'center', padding: 32 }}>{isAdmin ? 'No data yet — click "Regenerate" to auto-populate.' : 'Organism facts coming soon!'}</div>
      ) : (
        <div style={{ ...S.card, borderRadius: '0 0 12px 12px', borderTop: 'none', borderColor: `${bgLight}44` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[['Habitat','habitat'],['Diet & Hunting','diet'],['Superpower','superpower'],['Battle Strength','battleStrength']].map(([label, fld]) => (
              <div key={fld} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 11, color: bgLight, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{label}</div>
                {isAdmin && onFieldSave ? <EditableField value={card[fld]} label={fld} onSave={v => onFieldSave(animalName, fld, v)} color="#ccc" multiline /> : <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{card[fld] || '-'}</div>}
              </div>
            ))}
            {galleryImages.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)', gridColumn: '1 / -1' }}>
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
                  <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: -12, right: -12, background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: 28, height: 28, color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              </div>
            )}
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

// ── VIEW BRACKET MODAL ────────────────────────────────────────────────────────
function ViewBracketModal({ data, onClose }) {
  const { displayName, bracket, isMammal } = data;
  const regions = ['East', 'West', 'South', 'Midwest'];
  const rounds = ['R64','R32','S16','E8'];
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ ...S.card, maxWidth: 700, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: isMammal ? '#86efac' : ACCENT2, margin: 0 }}>{displayName}'s Bracket</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {regions.map(region => (
            <div key={region} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: isMammal ? '#86efac' : ACCENT2, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>{region}</div>
              {(bracket[region]?.rounds || []).slice(0, 4).map((roundGames, rIdx) => (
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
            </div>
          ))}
          {bracket.championship?.winner && (
            <div style={{ padding: 16, background: 'rgba(245,158,11,0.08)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: GOLD2, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Champion</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GOLD2, fontFamily: "'Playfair Display', serif" }}>{bracket.championship.winner.name}</div>
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

function TeamEntryPanel({ onTeamsSaved, onRequestGenerateResearch, regionNames, onRegionNamesChange, sourcesData, onSaveSources }) {
  const [roster,       setRoster]       = useState(makePlaceholderRoster());
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

  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading roster...</div>;
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: ACCENT2, marginBottom: 4 }}>Set Up This Year's Teams</h3>
          <p style={{ color: '#999', fontSize: 13 }}>Enter all 64 teams after Selection Sunday.</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: ACCENT2, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
            {['East','West','South','Midwest'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
                <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12, borderColor: (regionNames[r] || '').length > 15 ? '#f59e0b' : undefined }} />
                {(regionNames[r] || '').length > 15 && <span style={{ fontSize: 10, color: '#f59e0b' }} title="Long names may wrap in the bracket view.">⚠️</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Year:</span>
            <input type="number" value={roster.year} onChange={e => { setRoster(p => ({ ...p, year: parseInt(e.target.value) })); setSaved(false); }} style={{ ...S.input, width: 82, padding: '6px 10px', fontSize: 13 }} />
          </div>
          <button style={{ ...S.btn(saved ? '#22c55e' : ACCENT, '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setSaving(true); try { await setDoc(doc(db, 'admin', 'teamRoster'), { ...roster, _regionNames: regionNames, updatedAt: serverTimestamp() }); setSaved(true); } catch(e) { alert('Save failed: ' + e.message); } setSaving(false); }} disabled={saving}>{saving ? 'Saving...' : saved ? 'Roster Saved' : 'Save Roster'}</button>
          {saved && <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setApplying(true); try { const nb = buildInitialBracketFromTeams(roster); await saveOfficialBracket(nb); setApplied(true); onTeamsSaved(nb, roster); } catch(e) { alert('Apply failed: ' + e.message); } setApplying(false); }} disabled={applying}>{applying ? 'Applying...' : applied ? 'Applied!' : 'Apply to Bracket'}</button>}
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
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>●</span>{regionNames[r] || r}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(roster[activeRegion] || []).map((team, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <input type="number" min="1" max="16" value={team.seed} onChange={e => updateTeam(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)} style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Team name" value={team.name} onChange={e => updateTeam(activeRegion, idx, 'name', e.target.value)} style={{ ...S.input, flex: 2, padding: '6px 10px', fontSize: 13 }} />
            <input placeholder="ESPN ID" value={team.espnId} onChange={e => updateTeam(activeRegion, idx, 'espnId', e.target.value)} style={{ ...S.input, width: 80, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={team.firstFour} onChange={e => updateTeam(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: team.firstFour ? '#818cf8' : '#888', whiteSpace: 'nowrap', fontWeight: team.firstFour ? 700 : 400 }}>FF</span>
            </label>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: '8px 14px', background: 'rgba(96,165,250,0.07)', borderRadius: 8, border: '1px solid rgba(96,165,250,0.2)', fontSize: 12, color: '#93c5fd' }}>
        ESPN ID tip: espn.com/mens-college-basketball/team/_/id/<strong>150</strong>/duke
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
                {(regionNames[r] || '').length > 15 && <span style={{ fontSize: 10, color: '#f59e0b' }} title="Long names may wrap in the bracket view.">⚠️</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...S.btn(saved ? '#22c55e' : ACCENT, '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setSaving(true); try { await saveMammalRoster({ ...roster, _regionNames: regionNames }); setSaved(true); } catch(e) { alert('Save failed: ' + e.message); } setSaving(false); }} disabled={saving}>{saving ? 'Saving...' : saved ? 'Saved' : 'Save Roster'}</button>
          <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setApplying(true); try { const nb = buildInitialBracketFromTeams(roster); await saveMammalOfficialBracket(nb); setApplied(true); onAnimalsSaved(nb, roster); } catch(e) { alert('Apply failed: ' + e.message); } setApplying(false); }} disabled={applying}>{applying ? 'Applying...' : applied ? 'Applied!' : 'Apply to Bracket'}</button>
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
  return (
    <div style={{ minHeight: '100vh', background: '#0a1a0e', color: '#e8f5ee', fontFamily: "'Source Sans 3', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 16px', color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 32 }}>← Back</button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 4, fontSize: 32 }}>Privacy Policy</h1>
        <div style={{ marginBottom: 32, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, color: '#888' }}>
          <div><strong style={{ color: '#aaa' }}>Application:</strong> Hart Middle School March Madness Bracket Challenge</div>
          <div><strong style={{ color: '#aaa' }}>Operated by:</strong> Science Teacher, Hart Middle School, Rochester Community Schools</div>
          <div><strong style={{ color: '#aaa' }}>Last Updated:</strong> March 2026</div>
        </div>
        {[
          ['1. Introduction', 'This Privacy Policy describes how the Hart Middle School March Madness Bracket Challenge ("the Application") collects, uses, and protects information about its users. This Application is an educational tool developed and operated by a Science Teacher at Hart Middle School, Rochester Community Schools. It is not a commercial product and is not affiliated with any outside organization.'],
          ['2. Authentication', 'This Application does not require any account creation, login, or authentication. Users access the app by entering a display name of their choice. No passwords, email addresses, or credentials of any kind are collected or stored. The Application does not integrate with Google Sign-In or any other third-party authentication service.'],
          ['3. Information Collected', null],
          ['4. Use of Information', 'Information collected is used solely to save the user\'s bracket picks between sessions, display the user\'s name on the leaderboard, and calculate and display the user\'s score. The Application does not use collected information for advertising, profiling, or any purpose unrelated to the bracket competition.'],
          ['5. Data Storage and Security', 'All user data is stored in Google Firebase, a cloud infrastructure service provided by Google LLC, subject to Google\'s enterprise security standards. No external parties have access to user data stored within the Application. The application operator does not share data with any third party, vendor, or external service. All data is encrypted in transit using TLS.'],
          ['6. Data Retention', 'User data is retained only for the duration of the tournament period. At the conclusion of each tournament season, all data is reviewed and cleared by the school administrator. Administrators can delete any user\'s data at any time upon request.'],
          ['7. Children\'s Privacy', 'This Application is designed for use under direct teacher supervision within a school setting. The Application collects no personal information beyond a self-chosen display name. No information is sold, shared, or disclosed to third parties. No behavioral advertising or tracking is conducted. School administrators retain the ability to review and delete all data upon request.'],
          ['8. AI-Generated Content', 'This Application uses artificial intelligence (Claude, provided by Anthropic, PBC) to generate educational content. Student data is never used as input to the AI content generation system.'],
          ['9. Contact Information', 'Rochester Community Schools'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom: 28 }}>
            <h2 style={{ color: ACCENT2, fontSize: 16, marginBottom: 10, fontFamily: "'Playfair Display', serif", borderBottom: '1px solid rgba(22,163,74,0.2)', paddingBottom: 6 }}>{title}</h2>
            {title === '3. Information Collected' && (
              <div>
                <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8, marginBottom: 8 }}>The Application collects only the following:</p>
                <ul style={{ color: '#ccc', fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
                  <li><strong style={{ color: '#fff' }}>Display Name</strong> — a name chosen by the user at the time they first visit the app. This can be any name the user chooses; the Application does not verify identity.</li>
                  <li><strong style={{ color: '#fff' }}>Bracket Picks</strong> — the tournament predictions entered by the user.</li>
                  <li><strong style={{ color: '#fff' }}>Score</strong> — a numerical score calculated automatically based on the user's picks and tournament results.</li>
                </ul>
                <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8, marginTop: 8 }}>The Application does <strong style={{ color: '#fff' }}>not</strong> collect email addresses, passwords, device identifiers, location data, browsing history, or any information from sources outside the Application.</p>
              </div>
            )}
            {body && <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8 }}>{body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TERMS OF SERVICE ──────────────────────────────────────────────────────────
function TermsOfServicePage({ onBack }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a1a0e', color: '#e8f5ee', fontFamily: "'Source Sans 3', sans-serif", padding: '40px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '7px 16px', color: '#aaa', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 32 }}>← Back</button>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 4, fontSize: 32 }}>Terms of Service</h1>
        <div style={{ marginBottom: 32, padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, color: '#888' }}>
          <div><strong style={{ color: '#aaa' }}>Application:</strong> Hart Middle School March Madness Bracket Challenge</div>
          <div><strong style={{ color: '#aaa' }}>Operated by:</strong> Science Teacher, Hart Middle School, Rochester Community Schools</div>
          <div><strong style={{ color: '#aaa' }}>Last Updated:</strong> March 2026</div>
        </div>
        {[
          ['1. Agreement to Terms', 'By accessing or using the Hart Middle School March Madness Bracket Challenge ("the Application"), you agree to be bound by these Terms. If you do not agree, you may not use the Application. These Terms apply to all users including students, teachers, and school staff of Rochester Community Schools.'],
          ['2. Description', 'The Application is an educational web application facilitating school-based bracket prediction competitions tied to the NCAA Men\'s Basketball Tournament and the March Mammal Madness competition organized by Arizona State University. It is not a commercial product and is provided solely for educational purposes.'],
          ['3. Access', 'Access to the Application is open to currently enrolled students, teachers, and staff at Hart Middle School, as well as such other individuals as may be expressly authorized by the school administrator. The Application does not require a login or account. Users identify themselves by entering a display name.'],
          ['4. Acceptable Use', 'Users may complete bracket predictions, review educational content, and view the leaderboard. Users may not attempt to manipulate scores or results, use the Application for purposes other than the bracket competition, or engage in any conduct that violates Rochester Community Schools\' Acceptable Use Policy.'],
          ['5. Leaderboard and Scoring', 'Scores are calculated automatically based on results entered by the school administrator. The leaderboard, including participant names and scores, is visible to all users of the Application. By participating, users consent to their display name and score being visible to other users.'],
          ['6. Disclaimer of Warranties', 'THE APPLICATION IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND. THE APPLICATION OPERATOR DOES NOT WARRANT THAT THE APPLICATION WILL BE UNINTERRUPTED OR ERROR-FREE.'],
          ['7. Governing Law', 'These Terms shall be governed by the laws of the State of Michigan and applicable federal education law including FERPA and COPPA.'],
          ['8. Contact Information', 'Rochester Community Schools'],
        ].map(([title, body]) => (
          <div key={title} style={{ marginBottom: 28 }}>
            <h2 style={{ color: ACCENT2, fontSize: 16, marginBottom: 10, fontFamily: "'Playfair Display', serif", borderBottom: '1px solid rgba(22,163,74,0.2)', paddingBottom: 6 }}>{title}</h2>
            <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8 }}>{body}</p>
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
  const [nameInput,      setNameInput]      = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [nameLoading,    setNameLoading]    = useState(false);
  const [nameError,      setNameError]      = useState('');
  const [nameStep, setNameStep] = useState('username'); // 'username' | 'new-name'
  const [isTeacher,    setIsTeacher]    = useState(false);

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  const [isAdmin,       setIsAdmin]      = useState(false);
  const [adminPwInput,  setAdminPwInput] = useState('');
  const [adminPwError,  setAdminPwError] = useState('');
  const [adminPwLoading,setAdminPwLoading] = useState(false);
  const [showAdminLogin,setShowAdminLogin] = useState(false);
  const [setupMode,     setSetupMode]    = useState(false);
  const [newAdminPw,    setNewAdminPw]   = useState('');
  const [newAdminPw2,   setNewAdminPw2]  = useState('');

  // ── APP STATE ─────────────────────────────────────────────────────────────
  const [tab,              setTab]             = useState('bracket');
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
  const [yearDraft,        setYearDraft]       = useState(String(CURRENT_YEAR));
  const [yearSaving,       setYearSaving]      = useState(false);
  const [liveScores,       setLiveScores]      = useState({});
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

  // ── RESTORE SESSION FROM LOCALSTORAGE ─────────────────────────────────────
  useEffect(() => {
    const savedUid       = localStorage.getItem('mm_uid');
    const savedName      = localStorage.getItem('mm_name');
    const savedIsTeacher = localStorage.getItem('mm_teacher') === 'true';
    const savedIsAdmin   = localStorage.getItem('mm_admin')   === 'true';
    if (savedUid && savedName) {
      setUid(savedUid);
      setDisplayName(savedName);
      setIsTeacher(savedIsTeacher);
      setIsAdmin(savedIsAdmin);
    }
  }, []);

  // ── LOAD BRACKET ONCE UID IS SET ──────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    (async () => {
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
    const u3 = subscribeToLeaderboard(setLeaderboard);
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
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [uid, isAdmin]);

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
        if (hasPicks) await updateLeaderboardEntry(uid, displayName, score, isTeacher);
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
        if (hasPicks) await updateMammalLeaderboardEntry(uid, displayName, mammalScore, isTeacher);
        setMammalLastSaved(new Date());
      } catch (e) { console.warn('Mammal save failed:', e); }
    }, 3000);
    return () => clearTimeout(mammalSaveTimer.current);
  }, [mammalBracket, mammalFirstFourPicks, uid, displayName, mammalLocked, isAdmin, mammalScore, isTeacher]);

  // ── NAME ENTRY HANDLERS ──────────────────────────────────────────────────────
// Step 1: student enters username — check if they exist already
const handleUsernameSubmit = async () => {
  const id = studentIdInput.trim();
  if (!id) { setNameError('Please enter your username.'); return; }
  if (id.length < 3) { setNameError('Username must be at least 3 characters.'); return; }
  setNameLoading(true); setNameError('');
  try {
    const bracketSnap = await getDoc(doc(db, 'brackets', id));
    if (bracketSnap.exists()) {
      // Returning user — load their saved name and bracket, skip name step
      const savedName = bracketSnap.data().displayName || id;
      const existing = bracketSnap.data();
      if (existing._firstFourPicks) {
        const { _firstFourPicks, displayName: _dn, ...b } = existing;
        setFirstFourPicks(_firstFourPicks);
        setBracket(applyFirstFourPicks(b, _firstFourPicks));
      } else {
        const { displayName: _dn, ...b } = existing;
        setBracket(b);
      }
      localStorage.setItem('mm_uid', id);
      localStorage.setItem('mm_name', savedName);
      localStorage.setItem('mm_teacher', 'false');
      localStorage.setItem('mm_admin', 'false');
      setUid(id);
      setDisplayName(savedName);
    } else {
      // New user — need a display name
      setNameStep('new-name');
    }
  } catch (e) {
    setNameError('Something went wrong. Please try again.');
    console.warn('Username submit error:', e);
  }
  setNameLoading(false);
};

// Step 2 (new users only): student enters their display name
const handleNewNameSubmit = async () => {
  const name = nameInput.trim();
  const id   = studentIdInput.trim();
  if (!name) { setNameError('Please enter your first and last name.'); return; }
  if (name.length < 2) { setNameError('Name must be at least 2 characters.'); return; }
  setNameLoading(true); setNameError('');
  try {
    localStorage.setItem('mm_uid', id);
    localStorage.setItem('mm_name', name);
    localStorage.setItem('mm_teacher', 'false');
    localStorage.setItem('mm_admin', 'false');
    setUid(id);
    setDisplayName(name);
  } catch (e) {
    setNameError('Something went wrong. Please try again.');
    console.warn('New name submit error:', e);
  }
  setNameLoading(false);
};

const handleNameSubmit = handleUsernameSubmit;

// ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
const handleAdminLogin = async () => {
  if (!adminPwInput.trim()) { setAdminPwError('Enter the admin password.'); return; }
  setAdminPwLoading(true); setAdminPwError('');
  try {
    const ok = await checkAdminPassword(adminPwInput.trim());
    if (ok) {
      setIsAdmin(true);
      localStorage.setItem('mm_admin', 'true');
      setShowAdminLogin(false);
      setAdminPwInput('');
      setTab('admin');
    } else {
      setAdminPwError('Incorrect password.');
    }
  } catch (e) { setAdminPwError('Error checking password. Try again.'); }
  setAdminPwLoading(false);
};

const handleAdminSetup = async () => {
  if (!newAdminPw.trim()) { setAdminPwError('Enter a password.'); return; }
  if (newAdminPw !== newAdminPw2) { setAdminPwError('Passwords do not match.'); return; }
  setAdminPwLoading(true); setAdminPwError('');
  try {
    await setAdminPassword(newAdminPw.trim());
    setIsAdmin(true);
    localStorage.setItem('mm_admin', 'true');
    setSetupMode(false);
    setShowAdminLogin(false);
    setTab('admin');
  } catch (e) { setAdminPwError('Failed to set password. Try again.'); }
  setAdminPwLoading(false);
};

const handleOpenAdmin = async () => {
  if (isAdmin) { setTab('admin'); return; }
  const exists = await adminExists();
  if (!exists) setSetupMode(true);
  else setSetupMode(false);
  setShowAdminLogin(true);
};

const handleSignOut = () => {
  localStorage.removeItem('mm_uid');
  localStorage.removeItem('mm_name');
  localStorage.removeItem('mm_teacher');
  localStorage.removeItem('mm_admin');
  setUid(null); setDisplayName(''); setIsAdmin(false); setIsTeacher(false);
  setBracket(buildInitialBracket()); setMammalBracket(buildInitialBracket());
  setFirstFourPicks({}); setMammalFirstFourPicks({});
  setStudentIdInput(''); setNameInput(''); setNameStep('username');
  setTab('bracket');
};

  // Step 2: student enters school ID, used as unique identifier
  const handleIdSubmit = async () => {
    const id   = studentIdInput.trim();
    const name = nameInput.trim();
    if (!id) { setNameError('Please enter your school ID.'); return; }
    if (id.length < 3) { setNameError('ID must be at least 3 characters.'); return; }
    setNameLoading(true); setNameError('');
    try {
      const existing = await loadBracket(id);
      if (existing) {
        const bracketSnap = await getDoc(doc(db, 'brackets', id));
        const savedName = bracketSnap.exists() ? bracketSnap.data().displayName : name;
        if (existing._firstFourPicks) {
          const { _firstFourPicks, ...b } = existing;
          setFirstFourPicks(_firstFourPicks);
          setBracket(applyFirstFourPicks(b, _firstFourPicks));
        } else setBracket(existing);
        localStorage.setItem('mm_uid', id);
        localStorage.setItem('mm_name', savedName);
        localStorage.setItem('mm_teacher', 'false');
        localStorage.setItem('mm_admin', 'false');
        setUid(id);
        setDisplayName(savedName);
      } else {
        localStorage.setItem('mm_uid', id);
        localStorage.setItem('mm_name', name);
        localStorage.setItem('mm_teacher', 'false');
        localStorage.setItem('mm_admin', 'false');
        setUid(id);
        setDisplayName(name);
      }
    } catch (e) {
      setNameError('Something went wrong. Please try again.');
      console.warn('ID submit error:', e);
    }
    setNameLoading(false);
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
    try { await setDoc(doc(db, 'tournament', 'config'), { year: yr }, { merge: true }); setTournamentYear(yr); } catch (e) { alert('Failed: ' + e.message); }
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
    const CW = 240, SH = 89, FF_SCALE = 1.25;
    const FF_W = Math.round(CW * FF_SCALE), FF_H = Math.round(SH * FF_SCALE);
    const CHAMP_BOX_H = 30 + Math.round(FF_H * 0.75) + 32 + 20;
    const SPINE_H = CHAMP_BOX_H + 16;
    const FF_GAP = Math.round(SH / 2);
    const TOP_H = 8 * SH;
    const STUB = CW * 0.45;

    const activeBracket = isMammal ? (isAdmin ? (mammalOfficialBracket || mammalBracket) : mammalBracket) : bracket;
    const regionNames   = isMammal ? mammalRegionNames : bbRegionNames;
    const onPick        = isMammal ? handleMammalPick : handlePick;
    const onFFPick      = isMammal ? handleMammalFFPick : handleFFPick;
    const onChampPick   = isMammal ? handleMammalChampPick : handleChampPick;
    const isLocked      = isMammal ? mammalLocked : locked;
    const champColor    = isMammal ? 'rgba(134,239,172,0.5)' : 'rgba(245,158,11,0.65)';
    const champBg       = isMammal ? 'linear-gradient(135deg,rgba(134,239,172,0.15),rgba(22,163,74,0.10))' : 'linear-gradient(135deg,rgba(245,158,11,0.18),rgba(124,58,237,0.14))';
    const champEmoji    = isMammal ? '🦁' : '🏆';
    const champGold     = isMammal ? '#86efac' : GOLD2;

    const ROUND_ABS = [
      [0,89,178,267,356,445,534,623],
      [44.5,222.5,400.5,578.5],
      [133.5,489.5],
      [311.5],
    ];

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
                <GameSlot game={game} locked={isLocked && !isAdmin} flipped={flip} roundIdx={rIdx} liveScores={isMammal ? {} : liveScores} onPick={side => onPick(region, rIdx, gIdx, side)} onCompare={onCompareGame} />
              </div>
            );
          })}
        </div>
      );
    };

    const SpineCell = ({ label, sub, color, borderLeft = true }) => (
      <div style={{ width: CW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: borderLeft ? '1px solid rgba(255,255,255,0.08)' : 'none', background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ height: SPINE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
          {sub && <div style={{ fontSize: 15, color: '#777', fontStyle: 'italic', marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
    );

    const LINE_COLORS = ['#60a5fa','#a78bfa','#fbbf24','#ef4444'];
    const TOTAL_W = CW * 11;
    const GAME_MID_OFFSET = 50, GAME_MID_OFFSET_BOT = SH - GAME_MID_OFFSET;

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

    const ff0Label = `Final Four — ${regionNames.East || 'East'} vs. ${regionNames.West || 'West'}`;
    const ff1Label = `Final Four — ${regionNames.South || 'South'} vs. ${regionNames.Midwest || 'Midwest'}`;

    return (
      <div style={{ width: TOTAL_W }}>
        {/* TOP HALF */}
        <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', height: TOP_H }}>
          <BracketConnectors dir="top" />
          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="East" rIdx={rIdx} flip={false} dir="top" />)}
          <div style={{ width: CW * 3, flexShrink: 0, height: TOP_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: FF_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff0Label}</div>
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[0]} onPick={s => onFFPick(0, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} /></ScaledGame>
            </div>
          </div>
          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="West" rIdx={rIdx} flip={true} dir="top" />)}
        </div>

        {/* SPINE */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderTop: '2px solid rgba(255,255,255,0.15)', borderBottom: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
          <SpineCell label="Round of 64" sub='"First Round"' color={ROUND_BORDER_COLORS[0]} borderLeft={false} />
          <SpineCell label="Round of 32" sub='"Second Round"' color={ROUND_BORDER_COLORS[1]} />
          <SpineCell label="Sweet 16" sub='"Sweet Sixteen"' color={ROUND_BORDER_COLORS[2]} />
          <SpineCell label="Elite Eight" sub='"Elite Eight"' color={ROUND_BORDER_COLORS[3]} />
          <div style={{ width: CW * 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 16px', background: champBg, border: `2px solid ${champColor}`, borderRadius: 12, animation: 'champGlow 3s ease-in-out infinite', minWidth: FF_W + 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>{champEmoji}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: champGold, letterSpacing: 1, fontFamily: "'Playfair Display', serif", whiteSpace: 'nowrap' }}>Championship</span>
                <span style={{ fontSize: 18 }}>{champEmoji}</span>
              </div>
              <ScaledGame isHoriz>
                <GameSlot game={activeBracket.championship} onPick={onChampPick} locked={isLocked && !isAdmin} isChampionship isHorizontal onScoreChange={isMammal ? undefined : handleChampScore} roundIdx={-1} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} />
              </ScaledGame>
              {activeBracket.championship?.winner && (
                <div style={{ textAlign: 'center', padding: '4px 14px', background: isMammal ? 'rgba(134,239,172,0.15)' : 'rgba(245,158,11,0.18)', borderRadius: 6, border: `1px solid ${isMammal ? 'rgba(134,239,172,0.4)' : 'rgba(245,158,11,0.5)'}` }}>
                  <div style={{ fontSize: 10, color: champGold, letterSpacing: 1.5 }}>CHAMPION</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'Playfair Display', serif" }}>{activeBracket.championship.winner.name}</div>
                </div>
              )}
            </div>
          </div>
          <SpineCell label="Elite Eight" sub='"Elite Eight"' color={ROUND_BORDER_COLORS[3]} />
          <SpineCell label="Sweet 16" sub='"Sweet Sixteen"' color={ROUND_BORDER_COLORS[2]} />
          <SpineCell label="Round of 32" sub='"Second Round"' color={ROUND_BORDER_COLORS[1]} />
          <SpineCell label="Round of 64" sub='"First Round"' color={ROUND_BORDER_COLORS[0]} />
        </div>

        {/* BOTTOM HALF */}
        <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', height: TOP_H }}>
          <BracketConnectors dir="bot" />
          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="South" rIdx={rIdx} flip={false} dir="bot" />)}
          <div style={{ width: CW * 3, flexShrink: 0, height: TOP_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: FF_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[1]} onPick={s => onFFPick(1, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} /></ScaledGame>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff1Label}</div>
            </div>
          </div>
          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="Midwest" rIdx={rIdx} flip={true} dir="bot" />)}
        </div>
      </div>
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
      <div style={{ marginBottom: 20, padding: '16px 18px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#818cf8', letterSpacing: 2, marginBottom: 2 }}>FIRST FOUR — PLAY-IN GAMES</div>
        <div style={{ fontSize: 11, color: '#777', marginBottom: 14 }}>Pick who wins each play-in game and advances into the main bracket</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {activeFF.map(({ region, seed, ffTeams, key }) => {
            const pick = activePicks[key];
            return (
              <div key={key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 14px', minWidth: 210 }}>
                <div style={{ fontSize: 10, color: RC[region], fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{rNames[region] || region} — #{seed} seed play-in</div>
                {(ffTeams || []).map(team => {
                  const isPick = pick === team.name;
                  const isLoser = pick && pick !== team.name;
                  return (
                    <div key={team.name} onClick={() => !isLocked && onPick(key, team, region, seed)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, marginBottom: 5, cursor: isLocked ? 'default' : 'pointer', background: isPick ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)', border: isPick ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)', transition: 'all .12s', opacity: isLoser ? 0.35 : 1 }}>
                      <TeamLogo espnId={team.espnId} name={team.name} size={20} />
                      <span style={{ fontSize: 10, color: '#777', fontWeight: 700, minWidth: 14 }}>{team.seed}</span>
                      <span style={{ fontSize: 12, fontWeight: isPick ? 700 : 400, color: isPick ? '#a5b4fc' : '#bbb', flex: 1 }}>{team.name}</span>
                      {isPick && <span style={{ color: '#818cf8', fontSize: 13 }}>✓</span>}
                    </div>
                  );
                })}
                {pick ? <div style={{ fontSize: 10, color: '#777', textAlign: 'center', marginTop: 4 }}>{pick} advances as #{seed} seed</div>
                      : <div style={{ fontSize: 10, color: '#888', textAlign: 'center', marginTop: 4 }}>pick a winner</div>}
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
    const color = isMammal ? '#86efac' : ACCENT2;
    return (
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14, ...(isMammal ? { borderColor: 'rgba(134,239,172,0.25)' } : {}) }}>
        <div>
          <div style={{ fontSize: 11, color: '#777', letterSpacing: 1, textTransform: 'uppercase' }}>{isMammal ? 'Mammal Score' : 'Your Score'}</div>
          <div style={{ fontSize: 38, fontWeight: 700, color, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{s} <span style={{ fontSize: 14, color: '#888' }}>/ 1,920 pts</span></div>
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
            <div style={{ fontSize: 34, fontWeight: 700, color, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{rank > 0 ? `#${rank}` : '-'}</div>
            <div style={{ fontSize: 11, color: '#888' }}>of {board.length || '-'} entries</div>
          </div>
          <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), padding: '5px 14px', fontSize: 11 }} onClick={() => handleClearPicks(isMammal)}>Clear Picks</button>
          {saving && !isMammal ? <span style={{ fontSize: 11, color: '#777' }}>Saving...</span> : (isMammal ? mammalLastSaved : lastSaved) ? <span style={{ fontSize: 11, color: '#166534' }}>Saved ✓</span> : null}
        </div>
      </div>
    );
  };

  // ── LEGAL PAGES ───────────────────────────────────────────────────────────
  if (legalPage === 'privacy') return <PrivacyPolicyPage onBack={() => setLegalPage(null)} />;
  if (legalPage === 'terms')   return <TermsOfServicePage onBack={() => setLegalPage(null)} />;

  // ── ADMIN PASSWORD MODAL ──────────────────────────────────────────────────
  if (showAdminLogin) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ ...S.card, maxWidth: 380, width: '100%', padding: '36px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', marginBottom: 6 }}>{setupMode ? 'Set Admin Password' : 'Admin Access'}</h2>
        {setupMode ? (
          <>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>No admin password exists yet. Create one now — you'll use this to access the admin panel.</p>
            <input type="password" placeholder="New password" value={newAdminPw} onChange={e => setNewAdminPw(e.target.value)} style={{ ...S.input, marginBottom: 10 }} />
            <input type="password" placeholder="Confirm password" value={newAdminPw2} onChange={e => setNewAdminPw2(e.target.value)} style={{ ...S.input, marginBottom: 16 }} onKeyDown={e => e.key === 'Enter' && handleAdminSetup()} />
          </>
        ) : (
          <>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>Enter the admin password to continue.</p>
            <input type="password" placeholder="Admin password" value={adminPwInput} onChange={e => setAdminPwInput(e.target.value)} style={{ ...S.input, marginBottom: 16 }} onKeyDown={e => e.key === 'Enter' && handleAdminLogin()} autoFocus />
          </>
        )}
        {adminPwError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{adminPwError}</div>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...S.btn('rgba(255,255,255,0.07)', '#888'), flex: 1 }} onClick={() => { setShowAdminLogin(false); setAdminPwInput(''); setNewAdminPw(''); setNewAdminPw2(''); setAdminPwError(''); }}>Cancel</button>
          <button style={{ ...S.btn('#e74c3c'), flex: 1 }} onClick={setupMode ? handleAdminSetup : handleAdminLogin} disabled={adminPwLoading}>{adminPwLoading ? '...' : setupMode ? 'Set Password' : 'Enter'}</button>
        </div>
      </div>
    </div>
  );


  // ── NAME ENTRY SCREEN ─────────────────────────────────────────────────────
  if (!uid) return (
    <>
      <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 88, marginBottom: 12 }}>🏀</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, color: ACCENT2, letterSpacing: 2, lineHeight: 1.1 }}>MARCH MADNESS<br />{tournamentYear}</h1>
          <p style={{ color: '#777', fontSize: 16, marginTop: 10 }}>School-Wide Bracket Challenge</p>
        </div>
        <div style={{ ...S.card, textAlign: 'center', maxWidth: 400, padding: '36px 40px', width: '100%' }}>

          {/* Step 1: Enter username (all users) */}
          {nameStep === 'username' && (
            <>
              <p style={{ color: '#aaa', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Enter your username</p>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>
                Returning? Enter your username to pick up where you left off.
              </p>
              <p style={{ color: '#555', fontSize: 12, marginBottom: 20 }}>
                New here? Pick any username you'll remember — example: <span style={{ color: ACCENT2, fontFamily: 'monospace', fontSize: 13 }}>HoopsFan22</span>
              </p>
              <input
                placeholder="Your username"
                value={studentIdInput}
                onChange={e => { setStudentIdInput(e.target.value); setNameError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleUsernameSubmit()}
                style={{ ...S.input, marginBottom: 16, fontSize: 16, textAlign: 'center', letterSpacing: 1 }}
                autoFocus
              />
              {nameError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{nameError}</div>}
              <button style={{ ...S.btn(), width: '100%', fontSize: 16, padding: '12px 22px' }} onClick={handleUsernameSubmit} disabled={nameLoading}>
                {nameLoading ? 'Checking...' : 'Continue'}
              </button>
            </>
          )}

          {/* Step 2: New users only — enter display name */}
          {nameStep === 'new-name' && (
            <>
              <div style={{ marginBottom: 20, padding: '10px 14px', background: 'rgba(22,163,74,0.08)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.2)', fontSize: 13, color: ACCENT2 }}>
                Username <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{studentIdInput}</span> is available!
              </div>
              <p style={{ color: '#aaa', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>What's your name?</p>
              <p style={{ color: '#666', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
                Enter your first and last name. This is how you'll appear on the leaderboard. You won't need to enter this again.
              </p>
              <input
                placeholder="First and last name"
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleNewNameSubmit()}
                style={{ ...S.input, marginBottom: 16, fontSize: 16, textAlign: 'center' }}
                autoFocus
              />
              {nameError && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{nameError}</div>}
              <button style={{ ...S.btn(), width: '100%', fontSize: 16, padding: '12px 22px' }} onClick={handleNewNameSubmit} disabled={nameLoading}>
                {nameLoading ? 'Setting up...' : "Let's Go!"}
              </button>
              <button onClick={() => { setNameStep('username'); setNameError(''); }} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 12 }}>
                Back
              </button>
            </>
          )}

        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', display: 'flex', justifyContent: 'center', gap: 20, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,26,14,0.95)' }}>
        <button onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Privacy Policy</button>
        <button onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Terms of Service</button>
      </div>
    </>
  );

  // ── MAIN TABS ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'bracket',     label: 'Bracket'     },
    { id: 'research',    label: 'Research'    },
    { id: 'leaderboard', label: 'Leaderboard' },
  ];

  const TournamentSelector = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={() => { setActiveTournament('basketball'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>🏀 Basketball</button>
      <button onClick={() => { setActiveTournament('mammals'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>🦁 Mammal Madness</button>
    </div>
  );

  return (
    <ErrorBoundary>
      <div style={S.app}>
        <style>{`
          .bscroll { scrollbar-width: thin; scrollbar-color: rgba(22,163,74,0.5) rgba(255,255,255,0.04); }
          .bscroll::-webkit-scrollbar { height: 10px; }
          .bscroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb { background: rgba(22,163,74,0.5); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb:hover { background: rgba(22,163,74,0.8); }
          @keyframes champGlow { 0%,100%{box-shadow:0 0 24px rgba(245,158,11,0.3)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.6)} }
          @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        `}</style>

        <OfflineBar />
        {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
        {viewingBracket && <ViewBracketModal data={viewingBracket} onClose={() => setViewingBracket(null)} />}
        {compareModal && <CompareModal {...compareModal} onClose={() => { setCompareModal(null); setComparePicking(false); }} />}

        <header style={S.header}>
          <div style={S.logo}>🏀 MARCH MADNESS {tournamentYear}</div>
          <nav style={{ display: 'flex', gap: 4 }}>
            {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
            <button style={S.navBtn(tab === 'admin' && isAdmin)} onClick={handleOpenAdmin}>⚙️ Admin</button>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={displayName} size={28} />
            <span style={{ fontSize: 13, color: '#888' }}>{formatName(displayName)}</span>
            {isTeacher && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: GOLD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
            {isAdmin && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>ADMIN</span>}
            {saving && <span style={{ fontSize: 11, color: '#555' }}>Saving...</span>}
            {!saving && lastSaved && <span style={{ fontSize: 11, color: '#166534' }}>Saved ✓</span>}
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>Exit</button>
          </div>
        </header>

        <main style={{ paddingBottom: 60 }}>

          {/* ══ BRACKET TAB ══ */}
          {tab === 'bracket' && (
            <div style={{ padding: 20 }}>
              <TournamentSelector />
              {activeTournament === 'basketball' && (
                <>
                  {renderScoreBar(false)}
                  {renderScrollBracket(false, 'bscroll-bb')}
                  {renderFirstFourPanel(false)}
                </>
              )}
              {activeTournament === 'mammals' && (
                <>
                  {renderScoreBar(true)}
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
                  {renderFirstFourPanel(true)}
                </>
              )}
            </div>
          )}

          {/* ══ RESEARCH TAB ══ */}
          {tab === 'research' && (
            <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
              <TournamentSelector />
              {activeTournament === 'basketball' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 6 }}>Team Research Hub</h2>
                  {generating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.4)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#6366f1', fontSize: 14, fontWeight: 700 }}>Generating research...</span><span style={{ color: '#888', fontSize: 13 }}>{genProgress.done} / {genProgress.total}</span></div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', background: '#6366f1', borderRadius: 3, width: `${genProgress.total ? (genProgress.done / genProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} /></div>
                      {genProgress.current && <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>Currently: {genProgress.current}</div>}
                    </div>
                  )}
                  {genError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>⚠️ {genError}</div>}
                  {allTeamNames.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777' }}><div style={{ fontSize: 40, marginBottom: 16 }}>📊</div><div style={{ fontSize: 16, marginBottom: 8 }}>No research data yet</div><div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin → 🏀 Basketball → Generate Research' : 'Check back after the admin generates research'}</div></div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 0, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['East','West','South','Midwest'].map(r => (
                          <button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0 }} onClick={() => setBbActiveRegion(r)}>
                            {bbRegionNames[r] || r}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 24px' }}>
                        {(bbTeamsByRegion[bbActiveRegion] || []).length === 0
                          ? <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic' }}>No teams in this region yet.</div>
                          : (bbTeamsByRegion[bbActiveRegion] || []).map(t => (
                              <button key={t.name} style={{ ...S.btn(selectedTeam === t.name ? ACCENT : 'rgba(255,255,255,0.05)', selectedTeam === t.name ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => { setSelectedTeam(t.name); setComparePicking(false); }}>
                                #{t.seed} {t.name}
                              </button>
                            ))
                        }
                      </div>
                      {selectedTeam && !comparePicking && (
                        <div style={{ marginBottom: 12 }}>
                          <button style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#888', padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }} onClick={() => setComparePicking(true)}>
                            Compare with another team
                          </button>
                        </div>
                      )}
                      {comparePicking && (
                        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: '#a5b4fc' }}>Select a team to compare with <strong style={{ color: '#4ade80' }}>{selectedTeam}</strong></span>
                            <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }} onClick={() => setComparePicking(false)}>Cancel</button>
                          </div>
                          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                            {['East','West','South','Midwest'].map(r => (
                              <button key={r} style={{ background: bbActiveRegion === r ? 'rgba(22,163,74,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${bbActiveRegion === r ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)'}`, color: bbActiveRegion === r ? '#4ade80' : '#888', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, flexShrink: 0 }} onClick={() => setBbActiveRegion(r)}>
                                {bbRegionNames[r] || r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(bbTeamsByRegion[bbActiveRegion] || []).filter(t => t.name !== selectedTeam).map(t => {
                              const teamAObj = Object.values(bbTeamsByRegion).flat().find(x => x.name === selectedTeam) || { name: selectedTeam, seed: '?' };
                              return (
                                <button key={t.name} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                                  onClick={() => { setCompareModal({ teamA: teamAObj, teamB: t, cardA: researchData[selectedTeam] ?? null, cardB: researchData[t.name] ?? null, isMammal: false }); setComparePicking(false); }}>
                                  #{t.seed} {t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {selectedTeam && <ResearchCard teamName={selectedTeam} card={researchData[selectedTeam]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />}
                    </>
                  )}
                </>
              )}
              {activeTournament === 'mammals' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#86efac', marginBottom: 6 }}>🦁 Animal Research Hub</h2>
                  {mammalGenerating && (
                    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ color: '#86efac', fontSize: 14, fontWeight: 700 }}>Generating animal facts...</span><span style={{ color: '#888', fontSize: 13 }}>{mammalGenProgress.done} / {mammalGenProgress.total}</span></div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}><div style={{ height: '100%', background: '#86efac', borderRadius: 3, width: `${mammalGenProgress.total ? (mammalGenProgress.done / mammalGenProgress.total) * 100 : 0}%`, transition: 'width 0.3s' }} /></div>
                    </div>
                  )}
                  {mammalGenError && <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171' }}>⚠️ {mammalGenError}</div>}
                  {allAnimalNames.length === 0 ? (
                    <div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777', borderColor: 'rgba(134,239,172,0.15)' }}><div style={{ fontSize: 40, marginBottom: 16 }}>🦁</div><div style={{ fontSize: 16, marginBottom: 8 }}>No animal data yet</div><div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin → Mammal Madness → Generate Facts' : 'Check back after the admin sets up the animals'}</div></div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 0, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['East','West','South','Midwest'].map(r => (
                          <button key={r} style={{ ...S.navBtn(mammalActiveRegion === r), borderBottom: mammalActiveRegion === r ? '2px solid #86efac' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0 }} onClick={() => setMammalActiveRegion(r)}>
                            {mammalRegionNames[r] || r}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 24px' }}>
                        {(mammalAnimalsByRegion[mammalActiveRegion] || []).length === 0
                          ? <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic' }}>No animals in this region yet.</div>
                          : (mammalAnimalsByRegion[mammalActiveRegion] || []).map(a => (
                              <button key={a.name} style={{ ...S.btn(mammalSelectedAnimal === a.name ? '#16a34a' : 'rgba(255,255,255,0.05)', mammalSelectedAnimal === a.name ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => { setMammalSelectedAnimal(a.name); setComparePicking(false); }}>
                                #{a.seed} {a.name}
                              </button>
                            ))
                        }
                      </div>
                      {mammalSelectedAnimal && !comparePicking && (
                        <div style={{ marginBottom: 12 }}>
                          <button style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#888', padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }} onClick={() => setComparePicking(true)}>
                            Compare with another animal
                          </button>
                        </div>
                      )}
                      {comparePicking && (
                        <div style={{ background: 'rgba(134,239,172,0.05)', border: '1px solid rgba(134,239,172,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: '#86efac' }}>Select an animal to compare with <strong style={{ color: '#86efac' }}>{mammalSelectedAnimal}</strong></span>
                            <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }} onClick={() => setComparePicking(false)}>Cancel</button>
                          </div>
                          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                            {['East','West','South','Midwest'].map(r => (
                              <button key={r} style={{ background: mammalActiveRegion === r ? 'rgba(134,239,172,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${mammalActiveRegion === r ? 'rgba(134,239,172,0.4)' : 'rgba(255,255,255,0.08)'}`, color: mammalActiveRegion === r ? '#86efac' : '#888', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, flexShrink: 0 }} onClick={() => setMammalActiveRegion(r)}>
                                {mammalRegionNames[r] || r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(mammalAnimalsByRegion[mammalActiveRegion] || []).filter(a => a.name !== mammalSelectedAnimal).map(a => {
                              const animalAObj = Object.values(mammalAnimalsByRegion).flat().find(x => x.name === mammalSelectedAnimal) || { name: mammalSelectedAnimal, seed: '?' };
                              return (
                                <button key={a.name} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                                  onClick={() => { setCompareModal({ teamA: animalAObj, teamB: a, cardA: mammalResearchData[mammalSelectedAnimal] ?? null, cardB: mammalResearchData[a.name] ?? null, isMammal: true }); setComparePicking(false); }}>
                                  #{a.seed} {a.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {mammalSelectedAnimal && <MammalResearchCard animalName={mammalSelectedAnimal} card={mammalResearchData[mammalSelectedAnimal]} isAdmin={isAdmin} onFieldSave={handleMammalResearchFieldSave} generating={mammalGeneratingOne === mammalSelectedAnimal} onGenerate={handleGenerateOneMammal} />}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ LEADERBOARD TAB ══ */}
          {tab === 'leaderboard' && (
            <div style={{ padding: 24, maxWidth: 660, margin: '0 auto' }}>
              <TournamentSelector />
              {activeTournament === 'basketball' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: ACCENT2, marginBottom: 20 }}>Leaderboard</h2>
                  <div style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}><span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Name</span><span>Points</span></div>
                    {leaderboard.length === 0 ? <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>No entries yet — be the first!</div>
                      : leaderboard.map((e, i) => (
                        <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === uid ? 'rgba(22,163,74,0.08)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === uid ? '1px solid rgba(22,163,74,0.25)' : '1px solid transparent' }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? ACCENT2 : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#888', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                          <Avatar name={e.displayName} size={26} />
                          <span style={{ flex: 1, fontWeight: e.uid === uid ? 700 : 400, color: e.uid === uid ? ACCENT2 : '#bbb', fontSize: 14 }}>
                            {formatName(e.displayName)}{e.uid === uid ? ' (You)' : ''}
                            {e.isTeacher && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,0.15)', color: GOLD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>TEACHER</span>}
                          </span>
                          <button onClick={() => handleViewBracket(e.uid, e.displayName, false)} disabled={loadingBracket === e.uid} style={{ ...S.btn('rgba(22,163,74,0.12)', '#86efac'), padding: '3px 10px', fontSize: 11, border: '1px solid rgba(22,163,74,0.25)', flexShrink: 0 }}>{loadingBracket === e.uid ? '...' : 'View'}</button>
                          <span style={{ fontSize: 20, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
              {activeTournament === 'mammals' && (
                <>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#86efac', marginBottom: 20 }}>🦁 Mammal Madness Leaderboard</h2>
                  <div style={{ ...S.card, borderColor: 'rgba(134,239,172,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', padding: '0 12px 10px', letterSpacing: 1, textTransform: 'uppercase' }}><span>Rank</span><span style={{ flex: 1, marginLeft: 54 }}>Name</span><span>Points</span></div>
                    {mammalLeaderboard.length === 0 ? <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>No mammal entries yet!</div>
                      : mammalLeaderboard.map((e, i) => (
                        <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', background: e.uid === uid ? 'rgba(134,239,172,0.08)' : 'transparent', borderRadius: 8, marginBottom: 3, border: e.uid === uid ? '1px solid rgba(134,239,172,0.25)' : '1px solid transparent' }}>
                          <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? '#86efac' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#888', minWidth: 30, fontFamily: "'Playfair Display', serif" }}>#{i+1}</span>
                          <Avatar name={e.displayName} size={26} />
                          <span style={{ flex: 1, fontWeight: e.uid === uid ? 700 : 400, color: e.uid === uid ? '#86efac' : '#bbb', fontSize: 14 }}>
                            {formatName(e.displayName)}{e.uid === uid ? ' (You)' : ''}
                            {e.isTeacher && <span style={{ marginLeft: 6, fontSize: 10, background: 'rgba(245,158,11,0.15)', color: GOLD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>TEACHER</span>}
                          </span>
                          <button onClick={() => handleViewBracket(e.uid, e.displayName, true)} disabled={loadingBracket === e.uid + '-mm'} style={{ ...S.btn('rgba(134,239,172,0.12)', '#86efac'), padding: '3px 10px', fontSize: 11, border: '1px solid rgba(134,239,172,0.25)', flexShrink: 0 }}>{loadingBracket === e.uid + '-mm' ? '...' : 'View'}</button>
                          <span style={{ fontSize: 20, fontWeight: 700, color: '#86efac', fontFamily: "'Playfair Display', serif" }}>{e.score}</span>
                        </div>
                      ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ ADMIN TAB ══ */}
          {tab === 'admin' && isAdmin && (
            <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c', boxShadow: '0 0 6px #e74c3c' }} />
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', margin: 0 }}>Admin Panel</h2>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[['dashboard','Dashboard'],['teams','🏀 Basketball'],['mammals','🦁 Mammal Madness'],['users','👥 Users'],['help','Help']].map(([id, label]) => (
                  <button key={id} style={{ ...S.navBtn(adminSubTab === id), borderBottom: adminSubTab === id ? '2px solid #e74c3c' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setAdminSubTab(id)}>{label}</button>
                ))}
              </div>

              {adminSubTab === 'dashboard' && (
                <>
                  <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
                    <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
                    <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Updates the year shown on the entry screen and header for all users.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)} style={{ ...S.input, width: 110, padding: '8px 12px', fontSize: 16 }} />
                      <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px' }} onClick={handleSaveYear} disabled={yearSaving}>{yearSaving ? 'Saving...' : 'Update Year'}</button>
                      <span style={{ fontSize: 12, color: '#777' }}>Currently: <strong style={{ color: ACCENT2 }}>{tournamentYear}</strong></span>
                    </div>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
                    <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Admin Password</h3>
                    <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Change the password used to access this admin panel.</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input type="password" placeholder="New password" id="new-admin-pw" style={{ ...S.input, flex: 1, padding: '8px 12px' }} />
                      <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px', flexShrink: 0 }} onClick={async () => {
                        const val = document.getElementById('new-admin-pw').value.trim();
                        if (!val) return;
                        await setAdminPassword(val);
                        document.getElementById('new-admin-pw').value = '';
                        alert('Password updated.');
                      }}>Update</button>
                    </div>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 16 }}>
                    <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                      Use the <strong style={{ color: ACCENT2 }}>Bracket tab</strong> to enter official game results — your picks become the answer key and update all scores live.<br /><br />
                      Use <strong style={{ color: ACCENT2 }}>Admin → 🏀 Basketball</strong> every March after Selection Sunday to enter teams.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {[['Total Entries', leaderboard.length], ['Avg Score', leaderboard.length ? Math.round(leaderboard.reduce((a,e) => a+(e.score||0),0)/leaderboard.length)+' pts' : '-'], ['Status', locked ? 'Locked' : 'Open']].map(([l,v]) => (
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
                  <h3 style={{ color: ACCENT2, marginBottom: 4 }}>User Entries</h3>
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
                        if (!match) { alert('User not found on leaderboard.'); return; }
                        await setDoc(doc(db, 'leaderboard', match.uid), { isTeacher: true }, { merge: true });
                        document.getElementById('teacher-name').value = '';
                        alert(`${match.displayName} marked as Teacher.`);
                      }}>Mark as Teacher</button>
                    </div>
                  </div>
                </div>
              )}

              {adminSubTab === 'help' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={S.card}>
                    <h3 style={{ color: ACCENT2, marginBottom: 14 }}>How Admin Access Works</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      There is no longer a Google login requirement. Anyone can visit the app and enter their name to participate.<br /><br />
                      Admin access is protected by the password you set in Dashboard → Admin Password. To give someone else admin access, share the password with them — they can click "Admin" in the nav and enter it.<br /><br />
                      Admin status is stored in the browser. If you clear your browser storage, you'll need to re-enter the password.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(245,158,11,0.25)' }}>
                    <h3 style={{ color: GOLD2, marginBottom: 14 }}>Marking Teachers</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      Go to Admin → Users tab. Find the teacher's name on the leaderboard, then use the "Mark as Teacher" field at the bottom. They'll get a Teacher badge on the leaderboard.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.2)' }}>
                    <h3 style={{ color: ACCENT2, marginBottom: 14 }}>New Season Checklist</h3>
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
