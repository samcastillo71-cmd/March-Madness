// src/App.jsx — Full rewrite with all fixes
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
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
  saveMammalRoster, registerUser, checkIsTeacher,
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
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: 'center', color: '#f87171' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>{this.state.error?.message}</div>
        <button style={S.btn()} onClick={() => this.setState({ error: null })}>Try Again</button>
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
        <span style={{ fontSize: 17, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
          {isFF ? 'FF Winner →' : team.name}
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
  if (!card) return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#888' }}>
      No data yet
    </div>
  );
  const field = (path, value, opts = {}) => isAdmin
    ? <EditableField value={value} onSave={v => onFieldSave(teamName, path, v)} label={path} {...opts} />
    : <span style={{ color: opts.color || '#ccc', fontSize: opts.large ? 38 : 13 }}>{value || '-'}</span>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
      <div style={S.card}>
        <h3 style={{ color: ACCENT2, marginBottom: 14, fontFamily: "'Playfair Display', serif" }}>{teamName}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['Record','record'],['Rank','rank'],['Coach','coach'],['Conference','conference'],['KenPom','kenpom'],['Offense','offense'],['Defense','defense'],['Pace','pace']].map(([label, key]) => (
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
          <button onClick={() => onGenerate(animalName)} disabled={generating}
            aria-label={`Generate facts for ${animalName}`}
            style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 18px', fontSize: 13 }}>
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
          {[['🌍 Habitat','habitat'],['🍖 Diet & Hunting','diet'],['⚡ Superpower','superpower'],['⚔️ Battle Strength','battleStrength']].map(([label, fld]) => (
            <div key={fld} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, color: '#86efac', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{label}</div>
              {isAdmin && onFieldSave
                ? <EditableField value={card[fld]} label={fld} onSave={v => onFieldSave(animalName, fld, v)} color="#ccc" multiline />
                : <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>{card[fld] || '—'}</div>}
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
  const urls = [
    'https://site.web.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/tournaments/22?region=us&lang=en',
    'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/tournaments/22',
  ];
  let data = null;
  for (const url of urls) {
    try { const res = await fetch(url); if (res.ok) { data = await res.json(); break; } } catch {}
  }
  if (!data) {
    try { const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=100&limit=64'); if (res.ok) data = await res.json(); } catch {}
  }
  if (!data) throw new Error('Could not reach ESPN API. Try again or enter teams manually.');
  const regionMap = { East: [], West: [], South: [], Midwest: [] };
  const regionNames = Object.keys(regionMap);
  const bracket = data.bracket || data.rounds?.[0] || data.tournament?.bracket;
  if (bracket) {
    const walkBracket = (node) => {
      if (!node) return;
      if (node.competitors) node.competitors.forEach(c => {
        const region = regionNames.find(r => c.region?.toLowerCase().includes(r.toLowerCase()));
        if (region && c.team) regionMap[region].push({ seed: c.seed, name: c.team.displayName || c.team.name, espnId: String(c.team.id || ''), firstFour: false });
      });
      (node.children || node.games || []).forEach(walkBracket);
    };
    walkBracket(bracket);
  }
  const groups = data.groups || data.regions || data.rounds?.[0]?.groups;
  if (groups && Object.values(regionMap).every(r => r.length === 0)) {
    groups.forEach(group => {
      const regionName = regionNames.find(r => group.name?.toLowerCase().includes(r.toLowerCase()) || group.abbreviation?.toLowerCase().includes(r.toLowerCase()[0]));
      if (!regionName) return;
      (group.teams || group.standings?.entries || []).forEach(entry => {
        const team = entry.team || entry;
        regionMap[regionName].push({ seed: entry.seed || entry.curatedRank?.current || 0, name: team.displayName || team.name || '', espnId: String(team.id || ''), firstFour: false });
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

// ── GEMINI API WITH RATE LIMIT HANDLING ───────────────────────────────────────
// Retries indefinitely on per-minute rate limits using progressive backoff.
// Only throws on daily quota exhaustion or non-recoverable errors.
async function callGemini(prompt) {
  const BACKOFF_MS = [60000, 90000, 120000]; // 1min, 1.5min, 2min progressive
  let rateLimitAttempt = 0;
  while (true) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
    } catch (e) {
      console.warn('Gemini network error, retrying in 15s:', e.message);
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }
    if (res.status === 429) {
      let errBody = '';
      try { errBody = await res.text(); } catch {}
      const isDaily = errBody.toLowerCase().includes('quota') && errBody.toLowerCase().includes('day');
      if (isDaily) throw new Error('Daily Gemini quota reached. Resets at midnight Pacific. Try again tomorrow.');
      const wait = BACKOFF_MS[Math.min(rateLimitAttempt, BACKOFF_MS.length - 1)];
      console.warn(`Rate limited (attempt ${rateLimitAttempt + 1}), waiting ${wait / 1000}s...`);
      rateLimitAttempt++;
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    rateLimitAttempt = 0;
    let data;
    try { data = await res.json(); } catch { throw new Error('Gemini returned invalid JSON response'); }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch (e) { console.warn('JSON parse failed:', text.slice(0, 200)); return null; }
  }
}

async function generateResearchForTeam(teamName, seed, region) {
  const prompt = `You are writing a basketball team scouting report for middle school students (grades 6-8) for the ${new Date().getFullYear()} NCAA Tournament.
Write about: ${teamName} (${region} Region, Seed #${seed})
Use simple, clear language that a 12-14 year old can easily understand. Avoid jargon — if you use a basketball term, briefly explain it.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"record":"W-L","rank":"#N AP or Unranked","coach":"Coach Name","conference":"Conference Name","kenpom":"#N","offense":"NNN.N","defense":"NN.N","pace":"NN.N","keyPlayers":[{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"simple 1-sentence note a student would understand"},{"name":"Player Name","pos":"G/F/C","stats":"XX.X PPG / X.X RPG","note":"simple 1-sentence note a student would understand"}],"injuries":"injury status or None reported","odds":"+XXXX or N/A","strengths":"2-3 sentences explaining what this team does well, written for a middle schooler","weaknesses":"2-3 sentences explaining where this team struggles, written for a middle schooler","analystNote":"1-2 sentences on why this team could surprise people in the tournament"}`;
  return callGemini(prompt);
}

async function generateMammalResearch(animalName, seed, region) {
  const prompt = `You are a nature educator writing animal profiles for middle school students (grades 6-8).
Generate a fun, age-appropriate JSON profile for: ${animalName} (${region} Region, Seed #${seed}) competing in March Mammal Madness.
Return ONLY valid JSON, no markdown, no explanation. Use this exact structure:
{"habitat":"2-3 sentence description of where this animal lives","diet":"2-3 sentences on what it eats and how it hunts or forages","funFacts":["interesting fact 1","interesting fact 2","interesting fact 3"],"size":"weight and length/height","lifespan":"X-Y years","speed":"top speed if known, or movement description","superpower":"1 sentence on this animal's most impressive ability or adaptation","battleStrength":"1-2 sentence fun assessment of how this animal would do in a bracket battle and why"}
Keep all language at a middle school reading level. Make it engaging and educational. No graphic violence descriptions.`;
  return callGemini(prompt);
}

// ── ADMIN TEAM ENTRY PANEL ────────────────────────────────────────────────────
function TeamEntryPanel({ onTeamsSaved, onRequestGenerateResearch, regionNames, onRegionNamesChange }) {
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
            <button style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={() => onRequestGenerateResearch(roster)}>
              ✨ Auto-Generate Research
            </button>
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
function MammalEntryPanel({ onAnimalsSaved, onRequestGenerateMammalResearch, regionNames, onRegionNamesChange }) {
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
          <button style={{ ...S.btn('#6366f1', '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={() => onRequestGenerateMammalResearch(roster)}>
            ✨ Auto-Generate Animal Facts
          </button>
        </div>
      </div>
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
  const [tournamentYear,   setTournamentYear]  = useState(CURRENT_YEAR);
  const [yearDraft,        setYearDraft]       = useState(String(CURRENT_YEAR));
  const [yearSaving,       setYearSaving]      = useState(false);
  const [liveScores,       setLiveScores]      = useState({});
  const [activeTournament, setActiveTournament] = useState('basketball');
  const [confirmDialog,    setConfirmDialog]   = useState(null); // { message, onConfirm }
  // Basketball region names (customizable)
  const [bbRegionNames,    setBbRegionNames]   = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });

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
  const [mammalRegionNames,     setMammalRegionNames]     = useState({ East: 'East', West: 'West', South: 'South', Midwest: 'Midwest' });

  const saveTimer         = useRef(null);
  const prevBracket       = useRef(null);
  const prevFF            = useRef(null);
  const mammalSaveTimer   = useRef(null);
  const prevMammalBracket = useRef(null);
  const prevMammalFF      = useRef(null);

  // ── MEMOIZED DERIVED STATE ────────────────────────────────────────────────
  const allTeamNames   = useMemo(() => Object.keys(researchData).sort(), [researchData]);
  const allAnimalNames = useMemo(() => Object.keys(mammalResearchData).sort(), [mammalResearchData]);
  const score          = useMemo(() => calcScore(bracket, officialBracket), [bracket, officialBracket]);
  const mammalScore    = useMemo(() => calcScore(mammalBracket, mammalOfficialBracket), [mammalBracket, mammalOfficialBracket]);
  const teacherBoard        = useMemo(() => leaderboard.filter(e => e.isTeacher), [leaderboard]);
  const studentBoard        = useMemo(() => leaderboard.filter(e => !e.isTeacher), [leaderboard]);
  const mammalTeacherBoard  = useMemo(() => mammalLeaderboard.filter(e => e.isTeacher), [mammalLeaderboard]);
  const mammalStudentBoard  = useMemo(() => mammalLeaderboard.filter(e => !e.isTeacher), [mammalLeaderboard]);
  const myRank       = useMemo(() => leaderboard.findIndex(e => e.uid === user?.uid) + 1, [leaderboard, user]);
  const mammalMyRank = useMemo(() => mammalLeaderboard.findIndex(e => e.uid === user?.uid) + 1, [mammalLeaderboard, user]);

  // FF games lists (memoized)
  const ffGamesList = useMemo(() => {
    const list = [];
    ['East','West','South','Midwest'].forEach(region => {
      (bracket[region]?.rounds[0] || []).forEach(game => {
        const hasFF = game?.top?.isFFPlaceholder || game?.bottom?.isFFPlaceholder;
        if (hasFF) {
          const ffTeam = game.top?.isFFPlaceholder ? game.top : game.bottom;
          const key = `${region}-${ffTeam.seed}`;
          if (!list.find(f => f.key === key) && ffTeam.ffTeams) {
            list.push({ region, seed: ffTeam.seed, ffTeams: ffTeam.ffTeams, key });
          }
        }
      });
    });
    return list;
  }, [bracket]);

  const mammalFFGamesList = useMemo(() => {
    const activeMammal = isAdmin ? (mammalOfficialBracket || mammalBracket) : mammalBracket;
    const list = [];
    ['East','West','South','Midwest'].forEach(region => {
      (activeMammal[region]?.rounds[0] || []).forEach(game => {
        const hasFF = game?.top?.isFFPlaceholder || game?.bottom?.isFFPlaceholder;
        if (hasFF) {
          const ffTeam = game.top?.isFFPlaceholder ? game.top : game.bottom;
          const key = `${region}-${ffTeam.seed}`;
          if (!list.find(f => f.key === key) && ffTeam.ffTeams) {
            list.push({ region, seed: ffTeam.seed, ffTeams: ffTeam.ffTeams, key });
          }
        }
      });
    });
    return list;
  }, [mammalBracket, mammalOfficialBracket, isAdmin]);

  // ── LOAD YEAR ─────────────────────────────────────────────────────────────
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
          if (saved._firstFourPicks) { setFirstFourPicks(saved._firstFourPicks); const { _firstFourPicks, ...b } = saved; setBracket(b); }
          else setBracket(saved);
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
            if (savedMammal._firstFourPicks) { setMammalFirstFourPicks(savedMammal._firstFourPicks); const { _firstFourPicks, ...b } = savedMammal; setMammalBracket(b); }
            else setMammalBracket(savedMammal);
          } else { setMammalBracket(ob); }
        } else {
          const savedMammal = await loadMammalBracket(fbUser.uid).catch(() => null);
          if (savedMammal) {
            if (savedMammal._firstFourPicks) { setMammalFirstFourPicks(savedMammal._firstFourPicks); const { _firstFourPicks, ...b } = savedMammal; setMammalBracket(b); }
            else setMammalBracket(savedMammal);
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
      if (isAdmin) setBracket(hasRealTeams ? b : buildInitialBracket());
      else setBracket(prev => {
        const userHasTeams = ['East','West','South','Midwest'].some(r => prev[r]?.rounds?.[0]?.some(g => g?.top?.name && !g.top.name.startsWith('Seed ')));
        return userHasTeams ? prev : (hasRealTeams ? prev : buildInitialBracket());
      });
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
      if (isAdmin) { setMammalBracket(b); return; }
      setMammalBracket(prev => {
        const officialSample = b['East']?.rounds?.[0]?.[0]?.top?.name;
        const userSample = prev['East']?.rounds?.[0]?.[0]?.top?.name;
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
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
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
        await updateLeaderboardEntry(user.uid, user.displayName, user.photoURL, score, isTeacher);
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
        await updateMammalLeaderboardEntry(user.uid, user.displayName, user.photoURL, mammalScore, isTeacher);
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
    setFirstFourPicks(prev => {
      if (prev[key] === winner.name) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: winner.name };
    });
    setBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const r64 = next[region]?.rounds[0];
      if (!r64) return prev;
      r64.forEach(game => {
        if (game.top?.isFFPlaceholder && game.top.seed === seed) game.top = { ...winner, isFFPlaceholder: false };
        if (game.bottom?.isFFPlaceholder && game.bottom.seed === seed) game.bottom = { ...winner, isFFPlaceholder: false };
      });
      return next;
    });
  }, [locked, isAdmin]);

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
    setMammalFirstFourPicks(prev => {
      if (prev[key] === winner.name) { const n = { ...prev }; delete n[key]; return n; }
      return { ...prev, [key]: winner.name };
    });
    setMammalBracket(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const r64 = next[region]?.rounds[0];
      if (!r64) return prev;
      r64.forEach(game => {
        if (game.top?.isFFPlaceholder && game.top.seed === seed) game.top = { ...winner, isFFPlaceholder: false };
        if (game.bottom?.isFFPlaceholder && game.bottom.seed === seed) game.bottom = { ...winner, isFFPlaceholder: false };
      });
      return next;
    });
  }, [mammalLocked, isAdmin]);

  // ── CLEAR ALL PICKS ───────────────────────────────────────────────────────
  const handleClearPicks = useCallback((isMammal) => {
    setConfirmDialog({
      message: `Are you sure you want to clear all your ${isMammal ? 'Mammal Madness' : 'basketball'} picks? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        if (isMammal) {
          const fresh = mammalOfficialBracket ? JSON.parse(JSON.stringify(mammalOfficialBracket)) : buildInitialBracketFromTeams(makePlaceholderMammalRoster());
          setMammalBracket(fresh); setMammalFirstFourPicks({});
        } else {
          const fresh = officialBracket ? JSON.parse(JSON.stringify(officialBracket)) : buildInitialBracket();
          setBracket(fresh); setFirstFourPicks({});
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

  // ── GENERATE ALL RESEARCH ─────────────────────────────────────────────────
  const handleGenerateResearch = useCallback(async (roster) => {
    const teams = [];
    ['East','West','South','Midwest'].forEach(region => {
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
        const card = await generateResearchForTeam(name, seed, region);
        if (card) {
          allData[name] = { ...card, seed, region };
          await saveWithRetry(saveResearchData, allData, name);
          setResearchData({ ...allData });
        }
      } catch (e) {
        const isDaily = e.message.includes('Daily') || e.message.includes('tomorrow');
        setGenError(e.message);
        console.warn('Research gen failed:', name, e);
        if (isDaily) break;
      }
      // 8s between requests = 7.5/min, under 15/min free tier limit
      if (i < teams.length - 1) await new Promise(r => setTimeout(r, 8000));
    }
    setGenProgress(prev => ({ ...prev, done: teams.length, current: '' }));
    setGenerating(false);
    if (Object.keys(allData).length > 0) setSelectedTeam(Object.keys(allData)[0]);
  }, [saveWithRetry]);

  // ── GENERATE ALL MAMMAL RESEARCH ──────────────────────────────────────────
  const handleGenerateMammalResearch = useCallback(async (roster) => {
    const animals = [];
    ['East','West','South','Midwest'].forEach(region => {
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
    for (let i = 0; i < animals.length; i++) {
      const { name, seed, region } = animals[i];
      setMammalGenProgress({ done: i, total: animals.length, current: name });
      try {
        const card = await generateMammalResearch(name, seed, region);
        if (card) {
          allData[name] = { ...card, seed, region };
          await saveWithRetry(saveMammalResearchData, allData, name);
          setMammalResearchData({ ...allData });
        }
      } catch (e) {
        const isDaily = e.message.includes('Daily') || e.message.includes('tomorrow');
        setMammalGenError(e.message);
        console.warn('Mammal research gen failed:', name, e);
        if (isDaily) break;
        // Skip this animal and continue for non-daily errors
      }
      // 8s between requests = 7.5/min, under 15/min free tier limit
      if (i < animals.length - 1) await new Promise(r => setTimeout(r, 8000));
    }
    setMammalGenProgress(prev => ({ ...prev, done: animals.length, current: '' }));
    setMammalGenerating(false);
    if (Object.keys(allData).length > 0) { setMammalSelectedAnimal(Object.keys(allData)[0]); setTab('research'); setActiveTournament('mammals'); }
  }, [saveWithRetry]);

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
    const ff0Label = `Final Four — ${regionNames.East || 'East'} vs ${regionNames.West || 'West'}`;
    const ff1Label = `Final Four — ${regionNames.South || 'South'} vs ${regionNames.Midwest || 'Midwest'}`;

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
        zIndex: 0,
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
    const GAME_MID_OFFSET     = 44.5; // px from game top to team divider
    const GAME_MID_OFFSET_BOT = SH - GAME_MID_OFFSET;

    const BracketConnectors = ({ dir }) => {
      const W = CW * 4;
      const H = TOP_H;
      const STUB = CW * 0.4;

      const makeLinesForRegion = (flip) => {
        const lines = [];
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const fromPositions = ROUND_ABS[rIdx];
          const toPositions   = ROUND_ABS[rIdx + 1];
          const gradId = `conn-${isMammal?'m':'b'}-${dir}-${flip?'f':'n'}-${rIdx}`;
          const color1 = ['#60a5fa','#a78bfa','#fbbf24'][rIdx];
          const color2 = ['#a78bfa','#fbbf24','#ef4444'][rIdx];
          const xFrom   = flip ? W - (rIdx + 1) * CW : (rIdx + 1) * CW;
          const xStub   = flip ? xFrom - STUB : xFrom + STUB;
          const xParent = flip ? xFrom - CW + STUB : xFrom + CW - STUB;

          toPositions.forEach((toPos, tIdx) => {
            const c1 = fromPositions[tIdx * 2];
            const c2 = fromPositions[tIdx * 2 + 1];
            if (c1 == null || c2 == null) return;
            const getMid = pos => dir === 'top' ? pos + GAME_MID_OFFSET : H - pos - GAME_MID_OFFSET_BOT;
            const y1   = getMid(c1);
            const y2   = getMid(c2);
            const yMid = getMid(toPos);
            lines.push(
              <g key={`${rIdx}-${tIdx}`}>
                <line x1={xFrom}  y1={y1}   x2={xStub}   y2={y1}   stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
                <line x1={xFrom}  y1={y2}   x2={xStub}   y2={y2}   stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
                <line x1={xStub}  y1={y1}   x2={xStub}   y2={y2}   stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
                <line x1={xStub}  y1={yMid} x2={xParent}  y2={yMid} stroke={`url(#${gradId})`} strokeWidth="1.5" strokeLinecap="round" />
              </g>
            );
          });
          lines.push(
            <defs key={`def-${rIdx}`}>
              <linearGradient id={gradId} x1={flip?'100%':'0%'} y1="0%" x2={flip?'0%':'100%'} y2="0%">
                <stop offset="0%"   stopColor={color1} stopOpacity="0.55" />
                <stop offset="100%" stopColor={color2} stopOpacity="0.55" />
              </linearGradient>
            </defs>
          );
        }
        return lines;
      };

      return (
        <>
          <svg width={CW*4} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 3, overflow: 'visible' }} aria-hidden="true">
            {makeLinesForRegion(false)}
          </svg>
          <svg width={CW*4} height={H} style={{ position: 'absolute', top: 0, right: 0, pointerEvents: 'none', zIndex: 3, overflow: 'visible' }} aria-hidden="true">
            {makeLinesForRegion(true)}
          </svg>
        </>
      );
    };

    // FF games sit FF_GAP below/above the spine in the center column.
    // Center column is TOP_H tall; FF game sits at bottom with FF_GAP padding.
    const FF_CENTER_H = TOP_H; // same height as region columns — no extra space needed

    return (
      <div style={{ width: TOTAL_W }}>

        {/* ── TOP HALF ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', position: 'relative', height: TOP_H }}>
          <RegionLabel name={regionNames.East || 'East'} color={RC.East} isRight={false} isBottom={false} />
          <RegionLabel name={regionNames.West || 'West'} color={RC.West} isRight={true}  isBottom={false} />

          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="East" rIdx={rIdx} flip={false} dir="top" />)}

          {/* Center — FF[0] game sits FF_GAP above the spine (at bottom of this column) */}
          <div style={{ width: CW * 3, flexShrink: 0, height: FF_CENTER_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: FF_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff0Label}</div>
              <ScaledGame>
                <GameSlot game={activeBracket.finalFour?.[0]} onPick={s => onFFPick(0, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} />
              </ScaledGame>
            </div>
          </div>

          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="West" rIdx={rIdx} flip={true} dir="top" />)}
          <BracketConnectors dir="top" />
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
          <RegionLabel name={regionNames.South   || 'South'}   color={RC.South}   isRight={false} isBottom={true} />
          <RegionLabel name={regionNames.Midwest || 'Midwest'} color={RC.Midwest} isRight={true}  isBottom={true} />

          {[0,1,2,3].map(rIdx => <RoundCol key={rIdx} region="South" rIdx={rIdx} flip={false} dir="bot" />)}

          {/* Center — FF[1] game sits FF_GAP below the spine (at top of this column) */}
          <div style={{ width: CW * 3, flexShrink: 0, height: FF_CENTER_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', paddingTop: FF_GAP }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <ScaledGame>
                <GameSlot game={activeBracket.finalFour?.[1]} onPick={s => onFFPick(1, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} />
              </ScaledGame>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff1Label}</div>
            </div>
          </div>

          {[3,2,1,0].map(rIdx => <RoundCol key={rIdx} region="Midwest" rIdx={rIdx} flip={true} dir="bot" />)}
          <BracketConnectors dir="bot" />
        </div>

      </div>
    );
  };

  // ── FIRST FOUR PANELL (above bracket, for mobile/overview) ─────────────────
  const renderFirstFourPanel = (isMammal) => {
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
            return (
              <div key={key} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '12px 14px', minWidth: 210 }}>
                <div style={{ fontSize: 10, color: RC[region], fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  {regionNames[region] || region} — #{seed} seed play-in
                </div>
                {ffTeams.map(team => {
                  const isPick = pick === team.name;
                  return (
                    <div key={team.name} onClick={() => !isLocked && onFirstFourPick(key, team, region, seed)}
                      role="button" tabIndex={isLocked ? -1 : 0} aria-pressed={isPick}
                      aria-label={`Pick ${team.name}`}
                      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isLocked) { e.preventDefault(); onFirstFourPick(key, team, region, seed); } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, marginBottom: 5, cursor: isLocked ? 'default' : 'pointer', background: isPick ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)', border: isPick ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)', transition: 'all .12s', outline: 'none' }}>
                      <TeamLogo espnId={team.espnId} name={team.name} size={20} />
                      <span style={{ fontSize: 10, color: '#777', fontWeight: 700, minWidth: 14 }}>{team.seed}</span>
                      <span style={{ fontSize: 12, fontWeight: isPick ? 700 : 400, color: isPick ? '#a5b4fc' : '#bbb', flex: 1 }}>{team.name}</span>
                      {isPick && <span style={{ color: '#818cf8', fontSize: 13 }} aria-hidden="true">✓</span>}
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
          {!isMammal && (saving
            ? <span style={{ fontSize: 11, color: '#777' }}>Saving...</span>
            : lastSaved && <span style={{ fontSize: 11, color: '#166534' }}>✓ Saved</span>)}
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
                  {renderFirstFourPanel(false)}
                  {renderScrollBracket(false, 'bscroll-bb')}
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
                  {renderFirstFourPanel(true)}
                  {renderScrollBracket(true, 'bscroll-mm')}
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
                        <span style={{ fontSize: 18 }} aria-hidden="true">{researchMatchup.isMammal ? '🦁' : '🏀'}</span>
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
                        <span style={{ fontSize: 18 }} aria-hidden="true">{researchMatchup.isMammal ? '🦁' : '🏀'}</span>
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
                      <div style={{ fontSize: 13 }}>{isAdmin ? 'Go to Admin → Set Up Teams → Auto-Generate Research' : 'Check back after the admin generates research'}</div>
                    </div>
                  ) : (
                    <>
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
                {[['dashboard','Dashboard'],['teams','Set Up Teams'],['mammals','🦁 Mammal Madness'],['help','Help']].map(([id, label]) => (
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
                      Use <strong style={{ color: ACCENT2 }}>Set Up Teams</strong> every March after Selection Sunday. No code editing needed.
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
                <TeamEntryPanel
                  onTeamsSaved={handleTeamsSaved}
                  onRequestGenerateResearch={handleGenerateResearch}
                  regionNames={bbRegionNames}
                  onRegionNamesChange={handleSaveBbRegionNames}
                />
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
                      Teachers appear in a separate leaderboard section with a 🍎 label.<br /><br />
                      1. Have the teacher sign into the app once.<br />
                      2. Go to Firebase Console → Authentication → Users and copy their UID.<br />
                      3. Go to Firestore → <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 3 }}>teachers</code> collection → Add document with that UID as Document ID.<br />
                      4. They sign out and back in — Teacher badge appears automatically.
                    </p>
                  </div>
                  <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.2)' }}>
                    <h3 style={{ color: '#f87171', marginBottom: 14 }}>⚠️ Security Note</h3>
                    <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
                      The Gemini API key is embedded in the client bundle. To protect your quota:<br />
                      1. Go to Google Cloud Console → Credentials → restrict your API key to your app's domain.<br />
                      2. Set HTTP referrer restrictions so the key only works from your Vercel URL.
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
