# March Madness Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stale dark-green/username-login codebase with the finalized warm-cream palette, Google Sign-In, GameSlot compare zone animation, admin New Year Reset button, and Lucide icons throughout.

**Architecture:** Four targeted file edits. App.jsx is a single-file monolith (~2,245 lines, all inline styles). Firebase Auth wraps the existing uid/displayName state machine — nothing else in the data or bracket logic changes. The compare zone uses pure CSS custom properties (--fill-top/--fill-bottom set inline per tile) with class-based hover transitions injected into the existing `<style>` block.

**Tech Stack:** React 18, Vite 5, Firebase 10 (Auth + Firestore), Lucide React, Libre Bodoni + Public Sans (Google Fonts)

---

## Task 1: Install lucide-react

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
cd C:\Users\Samca\Projects\March-Madness && npm install lucide-react
```

Expected: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Verify**

```bash
node -e "require('./node_modules/lucide-react')" && echo OK
```

Expected: `OK`

---

## Task 2: Update `src/firebase.js` — add Google Auth exports

**Files:**
- Modify: `src/firebase.js`

Current file is 14 lines. Replace in full.

- [ ] **Step 1: Write new firebase.js**

Replace the entire file content with:

```js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: 'harts.rochester.k12.mi.us' });
```

---

## Task 3: Update `src/firestoreService.js` — add deleteAllBrackets()

**Files:**
- Modify: `src/firestoreService.js` (append to end)

- [ ] **Step 1: Add batch import and deleteAllBrackets function**

Add `writeBatch` to the existing firebase/firestore import at the top of the file.

The current import line (line 5-9):
```js
import {
  doc, getDoc, setDoc, deleteDoc, getDocs,
  collection, query, orderBy, limit,
  serverTimestamp, onSnapshot,
} from 'firebase/firestore';
```

Replace with:
```js
import {
  doc, getDoc, setDoc, deleteDoc, getDocs,
  collection, query, orderBy, limit,
  serverTimestamp, onSnapshot, writeBatch,
} from 'firebase/firestore';
```

- [ ] **Step 2: Append deleteAllBrackets function at end of file**

Append after the last export:

```js
// ── NEW YEAR RESET ────────────────────────────────────────────────────────────
// Batch-deletes all user documents from both tournaments.
// Does NOT touch admin/, tournament/ config, or research data.
export async function deleteAllBrackets() {
  const COLLECTIONS = ['brackets', 'brackets_mammals', 'leaderboard', 'leaderboard_mammals'];
  for (const col of COLLECTIONS) {
    const snap = await getDocs(collection(db, col));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
}
```

---

## Task 4: Update `index.html` — body background + fonts

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace font import and body styles**

Replace:
```html
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #080c18; font-family: 'Source Sans 3', sans-serif; }
    </style>
```

With:
```html
    <link href="https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;500;700&family=Public+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #E8E2D8; font-family: 'Public Sans', sans-serif; }
    </style>
```

---

## Task 5: Update `src/App.jsx` — imports + theme constants

**Files:**
- Modify: `src/App.jsx` lines 1-48

This is the largest conceptual change — replacing the dark green theme with the warm-cream palette.

- [ ] **Step 1: Replace import block and theme constants block**

Replace the entire block from line 1 to line 48 (the `// ── HELPERS` comment is the boundary):

Old (lines 1-48):
```js
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
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? ACCENT : 'transparent', color: a ? '#fff' : '#7A7068', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
  tag:    (color) => ({ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }),
};
```

New:
```js
// src/App.jsx
import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { Component } from 'react';
import { doc, setDoc, getDoc, deleteDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { LogIn, Lock, Unlock, Check, Settings, AlertTriangle, Trophy } from 'lucide-react';
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
  saveMammalRoster, checkAdminPassword, adminExists, setAdminPassword,
  deleteBracketAndScore, getAllBracketUids, deleteAllBrackets,
} from './firestoreService';
import {
  CURRENT_YEAR, buildInitialBracket, buildInitialBracketFromTeams, calcScore,
} from './bracketData';

// ── THEME ─────────────────────────────────────────────────────────────────────
const NAVY     = '#091828';
const GREEN    = '#1A4332';
const MINT_BG  = '#C2EDD5';
const MINT_FG  = '#1E6B47';
const RC = { East: '#93c5fd', West: '#fca5a5', South: '#86efac', Midwest: '#fdba74' };
const ROUND_COLORS = [
  'rgba(9,24,40,0.06)', 'rgba(9,24,40,0.09)',
  'rgba(9,24,40,0.12)', 'rgba(9,24,40,0.15)', 'rgba(26,67,50,0.12)',
];
const ROUND_BORDER_COLORS = [
  'rgba(9,24,40,0.3)', 'rgba(9,24,40,0.4)',
  'rgba(9,24,40,0.5)', 'rgba(9,24,40,0.6)', 'rgba(26,67,50,0.5)',
];

const S = {
  app:    { minHeight: '100vh', background: '#E8E2D8', color: '#1A1208', fontFamily: "'Public Sans', sans-serif" },
  header: { background: 'rgba(9,24,40,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(28,53,88,0.6)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Libre Bodoni', serif", fontSize: 19, fontWeight: 700, color: '#B8CBE8', letterSpacing: 1 },
  card:   { background: '#F4EFE6', border: '1px solid #C8BFB0', borderRadius: 12, padding: 20 },
  btn:    (bg = NAVY, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? NAVY : 'transparent', color: a ? '#fff' : '#B8CBE8', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.7)', border: '1px solid #C8BFB0', borderRadius: 8, color: '#1A1208', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
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
```

---

## Task 6: Update `src/App.jsx` — ErrorBoundary, OfflineBar, TeamLogo, ConfirmDialog

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: ErrorBoundary — update colors and remove emoji**

Replace in ErrorBoundary render:
```jsx
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏀</div>
          <h2 style={{ color: '#f87171', fontFamily: "'Playfair Display', serif", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Your bracket picks are saved. Try reloading the page.</p>
          <button style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </div>
```

With:
```jsx
      <div style={{ minHeight: '100vh', background: '#E8E2D8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <Trophy size={48} color="#091828" style={{ marginBottom: 16 }} />
          <h2 style={{ color: '#c0392b', fontFamily: "'Libre Bodoni', serif", marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: '#7A7068', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>Your bracket picks are saved. Try reloading the page.</p>
          <button style={{ background: '#091828', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </div>
```

- [ ] **Step 2: OfflineBar — update colors**

Replace:
```jsx
  return <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '6px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600 }}>You are offline — picks will save when you reconnect</div>;
```

With:
```jsx
  return <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '6px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600, fontFamily: "'Public Sans', sans-serif" }}>You are offline — picks will save when you reconnect</div>;
```

- [ ] **Step 3: TeamLogo fallback circle — update background**

Replace:
```jsx
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#14532d,#166534)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
```

With:
```jsx
    <span style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#091828,#1C3558)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.42, fontWeight: 800, color: '#fff', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }}>
```

- [ ] **Step 4: ConfirmDialog — update colors, replace ⚠️ emoji**

Replace in ConfirmDialog:
```jsx
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
```

With:
```jsx
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...S.card, maxWidth: 360, textAlign: 'center', padding: 32 }}>
        <AlertTriangle size={28} color="#c0392b" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, color: '#1A1208', marginBottom: 24, lineHeight: 1.6 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button style={S.btn('#c0392b')} onClick={onConfirm}>Confirm</button>
          <button style={S.btn('#C8BFB0', '#1A1208')} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
```

- [ ] **Step 5: Avatar — update nameToColor palette**

Replace:
```js
  const colors = ['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0891b2','#059669','#d97706'];
```

With:
```js
  const colors = ['#091828','#1A4332','#1C3558','#4A2060','#8B3A3A','#2A5C6E','#1E6B47','#7A4A1A'];
```

---

## Task 7: Update `src/App.jsx` — GameSlot (compare zone rewrite)

**Files:**
- Modify: `src/App.jsx`

This is the most visual change. GameSlot gets two new props (`isMammal`, `mammalResearchData`) and the compare zone replaces the plain divider and bottom Compare link.

- [ ] **Step 1: Replace GameSlot signature and scoreInput constant**

Replace:
```js
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };
```

With:
```js
const scoreInput = { width: 60, background: 'rgba(255,255,255,0.7)', border: '1px solid #C8BFB0', borderRadius: 4, color: '#1A1208', padding: '2px 6px', fontSize: 11, fontFamily: 'inherit' };
```

Replace GameSlot function signature:
```js
const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onCompare }) {
```

With:
```js
const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onCompare, isMammal = false, mammalResearchData = {} }) {
```

- [ ] **Step 2: Inside GameSlot, replace slotBg/slotBorder and Team component styles**

Replace:
```js
  const slotBg     = isChampionship ? 'rgba(245,158,11,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(245,158,11,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];
```

With:
```js
  const slotBg     = isChampionship ? 'rgba(196,149,42,0.08)' : ROUND_COLORS[roundIdx] || ROUND_COLORS[0];
  const slotBorder = isChampionship ? 'rgba(196,149,42,0.4)'  : ROUND_BORDER_COLORS[roundIdx] || ROUND_BORDER_COLORS[0];
  const accentColor = isMammal ? GREEN : NAVY;
  const compareColors = (() => {
    if (!isMammal) return BB_COMPARE;
    const tc = getHabitatColor(top?.name, mammalResearchData);
    const bc = getHabitatColor(bottom?.name, mammalResearchData);
    return { top: tc.top, bottom: bc.bottom };
  })();
```

- [ ] **Step 3: Replace Team component — vertical layout winner highlight**

In the vertical Team component, replace winner highlight style. Find:
```js
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? 'linear-gradient(90deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.3 : 1, transition: 'background .12s' }}>
```

With:
```js
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? MINT_BG : '#F4EFE6', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.4 : 1, transition: 'background .12s' }}>
```

Replace the seed color in vertical Team (the seed span):
```js
        <span style={{ fontSize: 10, color: isW ? ACCENT2 : '#666', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 14, fontWeight: isW ? 700 : 500, color: isW ? ACCENT2 : isL ? '#3a3a3a' : '#d0d0d0', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
```

With:
```js
        <span style={{ fontSize: 10, color: isW ? MINT_FG : '#7A7068', fontWeight: 700, minWidth: 14, textDecoration: isL ? 'line-through' : 'none' }}>{team.seed}</span>
        <span style={{ fontSize: team.name?.length > 18 ? 11 : team.name?.length > 13 ? 13 : 14, fontWeight: isW ? 700 : 500, color: isW ? MINT_FG : isL ? '#C8BFB0' : '#1A1208', textDecoration: isL ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: hasLive ? 80 : 140, flex: 1 }}>
```

Replace the vertical winner checkmark:
```js
        {isW && !hasLive && <span style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, color: ACCENT2, fontSize: 11 }}>✓</span>}
```

With:
```js
        {isW && !hasLive && <Check size={13} color={MINT_FG} style={{ marginLeft: flipped ? 0 : 'auto', marginRight: flipped ? 'auto' : 0, flexShrink: 0 }} />}
```

- [ ] **Step 4: Replace vertical GameSlot return — add compare zone, remove old compare link**

Replace the vertical (non-isHorizontal) return block:

```jsx
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
```

With:
```jsx
  const canCompare = onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder;
  return (
    <div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
      <Team team={top} side="top" />
      {canCompare ? (
        <div
          className="compare-zone"
          onClick={() => onCompare(top, bottom)}
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
    </div>
  );
```

- [ ] **Step 5: Remove compare link from horizontal layout**

In the horizontal GameSlot return, remove the trailing compare div:
```jsx
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
        </div>
      )}
```

Delete this block entirely from the horizontal return.

Also update horizontal Team winner background in the horizontal layout:
```js
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px', background: isW ? 'linear-gradient(180deg,rgba(22,163,74,.3),rgba(22,163,74,.08))' : 'rgba(0,0,0,0.25)', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 6, opacity: isL ? 0.3 : 1, transition: 'background .12s', minWidth: 100, border: isW ? '1px solid rgba(22,163,74,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
```

With:
```js
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 14px', background: isW ? MINT_BG : '#F4EFE6', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 6, opacity: isL ? 0.4 : 1, transition: 'background .12s', minWidth: 100, border: isW ? `1px solid ${MINT_FG}` : '1px solid #C8BFB0' }}>
```

---

## Task 8: Update `src/App.jsx` — Google Auth (state, useEffects, handlers, login screen)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace username state declarations in App()**

Find the state block in App() (around line 896):
```js
  const [uid,          setUid]          = useState(null);
  const [displayName,  setDisplayName]  = useState('');
  const [nameInput,      setNameInput]      = useState('');
  const [studentIdInput, setStudentIdInput] = useState('');
  const [nameLoading,    setNameLoading]    = useState(false);
  const [nameError,      setNameError]      = useState('');
  const [nameStep, setNameStep] = useState('username'); // 'username' | 'new-name'
  const [isTeacher,    setIsTeacher]    = useState(false);
  const [appReady,     setAppReady]     = useState(false); // true after uid set + subscriptions init
```

Replace with:
```js
  const [uid,          setUid]          = useState(null);
  const [displayName,  setDisplayName]  = useState('');
  const [authLoading,  setAuthLoading]  = useState(false);
  const [authError,    setAuthError]    = useState('');
  const [isTeacher,    setIsTeacher]    = useState(false);
  const [appReady,     setAppReady]     = useState(false);
```

- [ ] **Step 2: Replace localStorage restore useEffect with onAuthStateChanged**

Find:
```js
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
```

Replace with:
```js
  // ── FIREBASE AUTH STATE ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        const savedIsAdmin = localStorage.getItem('mm_admin') === 'true';
        setUid(user.uid);
        setDisplayName(user.displayName || 'Student');
        setIsAdmin(savedIsAdmin);
      } else {
        setUid(null);
        setDisplayName('');
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);
```

- [ ] **Step 3: Replace username handlers with Google Sign-In handler**

Find and replace the entire block from `// ── NAME ENTRY HANDLERS` through `const handleNameSubmit = handleUsernameSubmit;`:

Old block (lines ~1197-1258):
```js
  // ── NAME ENTRY HANDLERS ──────────────────────────────────────────────────────
// Step 1: student enters username — check if they exist already
const handleUsernameSubmit = async () => {
  ...
};

// Step 2 (new users only): student enters their display name
const handleNewNameSubmit = async () => {
  ...
};

const handleNameSubmit = handleUsernameSubmit;
```

Replace with:
```js
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
```

- [ ] **Step 4: Replace handleSignOut**

Find:
```js
const handleSignOut = () => {
  localStorage.removeItem('mm_uid');
  localStorage.removeItem('mm_name');
  localStorage.removeItem('mm_teacher');
  localStorage.removeItem('mm_admin');
  setUid(null); setDisplayName(''); setIsAdmin(false); setIsTeacher(false);
  setAppReady(false);
  setBracket(buildInitialBracket()); setMammalBracket(buildInitialBracket());
  setFirstFourPicks({}); setMammalFirstFourPicks({});
  setStudentIdInput(''); setNameInput(''); setNameStep('username');
  setTab('bracket');
};
```

Replace with:
```js
  const handleSignOut = async () => {
    localStorage.removeItem('mm_admin');
    setIsAdmin(false); setIsTeacher(false);
    setBracket(buildInitialBracket()); setMammalBracket(buildInitialBracket());
    setFirstFourPicks({}); setMammalFirstFourPicks({});
    setAppReady(false);
    setTab('bracket');
    await signOut(auth); // triggers onAuthStateChanged → setUid(null)
  };
```

- [ ] **Step 5: Replace login screen (!uid return)**

Find the `// ── NAME ENTRY SCREEN` block (lines ~1962-2032) — the entire `if (!uid) return (...)` block. Replace with:

```jsx
  // ── SIGN-IN SCREEN ────────────────────────────────────────────────────────
  if (!uid) return (
    <>
      <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 36, minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 48, fontWeight: 700, color: NAVY, letterSpacing: 2, lineHeight: 1.1 }}>MARCH MADNESS<br />{tournamentYear}</h1>
          <p style={{ color: '#7A7068', fontSize: 16, marginTop: 10 }}>Hart Middle School · School-Wide Bracket Challenge</p>
        </div>
        <div style={{ ...S.card, textAlign: 'center', maxWidth: 380, padding: '36px 40px', width: '100%' }}>
          {authError && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{authError}</div>}
          <button
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            style={{ ...S.btn(NAVY), width: '100%', fontSize: 16, padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <LogIn size={20} />
            {authLoading ? 'Signing in...' : 'Sign in with school Google'}
          </button>
          <p style={{ color: '#7A7068', fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>
            Use your school account (@harts.rochester.k12.mi.us)
          </p>
        </div>
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', display: 'flex', justifyContent: 'center', gap: 20, borderTop: '1px solid #C8BFB0', background: '#E8E2D8' }}>
        <button onClick={() => setLegalPage('privacy')} style={{ background: 'none', border: 'none', color: '#7A7068', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Privacy Policy</button>
        <button onClick={() => setLegalPage('terms')} style={{ background: 'none', border: 'none', color: '#7A7068', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Terms of Service</button>
      </div>
    </>
  );
```

- [ ] **Step 6: Update loading screen**

Find:
```jsx
  if (uid && !appReady) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏀</div>
        <div style={{ fontSize: 16, color: ACCENT2, fontWeight: 700 }}>Loading your bracket...</div>
      </div>
    </div>
  );
```

Replace with:
```jsx
  if (uid && !appReady) return (
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <Trophy size={48} color={NAVY} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 16, color: NAVY, fontWeight: 700 }}>Loading your bracket...</div>
      </div>
    </div>
  );
```

---

## Task 9: Update `src/App.jsx` — Admin modal, header, TournamentSelector, style block

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Admin password modal — update colors and replace emoji**

Find in admin password modal:
```jsx
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', marginBottom: 6 }}>{setupMode ? 'Set Admin Password' : 'Admin Access'}</h2>
```

Replace with:
```jsx
        <Lock size={32} color="#c0392b" style={{ marginBottom: 12 }} />
        <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: '#c0392b', marginBottom: 6 }}>{setupMode ? 'Set Admin Password' : 'Admin Access'}</h2>
```

Also in the modal, update the `S.btn` calls that use hard-coded red:
Replace `S.btn('#e74c3c')` with `S.btn('#c0392b')` throughout the admin modal.

Update the admin modal's card to be light:
```jsx
      <div style={{ ...S.card, maxWidth: 380, width: '100%', padding: '36px 40px', textAlign: 'center' }}>
```
(Already uses S.card which is now light — no change needed here.)

Update the admin modal background:
```jsx
    <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
```
(S.app is now light — no change needed.)

Update the input fields inside modal (they already use S.input which is now light).

- [ ] **Step 2: TournamentSelector — remove emojis**

Find:
```jsx
      <button onClick={() => { setActiveTournament('basketball'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'basketball' ? ACCENT : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#888', transition: 'all .15s' }}>🏀 Basketball</button>
      <button onClick={() => { setActiveTournament('mammals'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'mammals' ? '#16a34a' : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#888', transition: 'all .15s' }}>🦁 Mammal Madness</button>
```

Replace with:
```jsx
      <button onClick={() => { setActiveTournament('basketball'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'basketball' ? NAVY : 'transparent', color: activeTournament === 'basketball' ? '#fff' : '#7A7068', transition: 'all .15s' }}>Basketball</button>
      <button onClick={() => { setActiveTournament('mammals'); setComparePicking(false); }} style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: activeTournament === 'mammals' ? GREEN : 'transparent', color: activeTournament === 'mammals' ? '#fff' : '#7A7068', transition: 'all .15s' }}>Mammal Madness</button>
```

Also update the TournamentSelector container:
```jsx
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid rgba(255,255,255,0.08)' }}>
```

Replace with:
```jsx
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20, background: 'rgba(9,24,40,0.06)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid #C8BFB0' }}>
```

- [ ] **Step 3: Header — remove emoji, update logo font, add Settings icon for Admin**

Find:
```jsx
          <div style={S.logo}>🏀 MARCH MADNESS {tournamentYear}</div>
```

Replace with:
```jsx
          <div style={S.logo}>MARCH MADNESS {tournamentYear}</div>
```

Find:
```jsx
            <button style={S.navBtn(tab === 'admin' && isAdmin)} onClick={handleOpenAdmin}>⚙️ Admin</button>
```

Replace with:
```jsx
            <button style={{ ...S.navBtn(tab === 'admin' && isAdmin), display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={handleOpenAdmin}><Settings size={14} />Admin</button>
```

Update the "Exit" button color:
```jsx
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>Exit</button>
```

Replace with:
```jsx
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', color: '#B8CBE8', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>Exit</button>
```

Update saving/saved colors in header (they use `#166534`):
```jsx
            {saving && <span style={{ fontSize: 11, color: '#555' }}>Saving...</span>}
            {!saving && lastSaved && <span style={{ fontSize: 11, color: '#166534' }}>Saved ✓</span>}
```

Replace with:
```jsx
            {saving && <span style={{ fontSize: 11, color: '#B8CBE8' }}>Saving...</span>}
            {!saving && lastSaved && <span style={{ fontSize: 11, color: MINT_BG, display: 'inline-flex', alignItems: 'center', gap: 3 }}><Check size={11} />Saved</span>}
```

Update Teacher/Admin badges in header:
```jsx
            {isTeacher && <span style={{ fontSize: 10, background: 'rgba(245,158,11,0.15)', color: GOLD, border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
            {isAdmin && <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>ADMIN</span>}
```

Replace with:
```jsx
            {isTeacher && <span style={{ fontSize: 10, background: 'rgba(196,149,42,0.2)', color: '#C4952A', border: '1px solid rgba(196,149,42,0.4)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>TEACHER</span>}
            {isAdmin && <span style={{ fontSize: 10, background: 'rgba(192,57,43,0.2)', color: '#e74c3c', border: '1px solid rgba(192,57,43,0.4)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>ADMIN</span>}
```

- [ ] **Step 4: Update the `<style>` block — add compare zone CSS, update scrollbar + keyframes**

Find the inline `<style>` block (in the main App return):
```jsx
        <style>{`
          .bscroll { scrollbar-width: thin; scrollbar-color: rgba(22,163,74,0.5) rgba(255,255,255,0.04); }
          .bscroll::-webkit-scrollbar { height: 10px; }
          .bscroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb { background: rgba(22,163,74,0.5); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb:hover { background: rgba(22,163,74,0.8); }
          @keyframes champGlow { 0%,100%{box-shadow:0 0 24px rgba(245,158,11,0.3)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.6)} }
          @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        `}</style>
```

Replace with:
```jsx
        <style>{`
          .bscroll { scrollbar-width: thin; scrollbar-color: rgba(9,24,40,0.4) rgba(200,191,176,0.3); }
          .bscroll::-webkit-scrollbar { height: 10px; }
          .bscroll::-webkit-scrollbar-track { background: rgba(200,191,176,0.3); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb { background: rgba(9,24,40,0.4); border-radius: 5px; }
          .bscroll::-webkit-scrollbar-thumb:hover { background: rgba(9,24,40,0.7); }
          @keyframes champGlow { 0%,100%{box-shadow:0 0 24px rgba(196,149,42,0.3)} 50%{box-shadow:0 0 40px rgba(196,149,42,0.6)} }
          @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
          /* ── COMPARE ZONE ─────────────────────────────────────── */
          .compare-zone { position:relative; height:34px; cursor:pointer; overflow:hidden; user-select:none; }
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
        `}</style>
```

---

## Task 10: Update `src/App.jsx` — Admin panel (New Year Reset + emoji removal + Lucide icons)

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add New Year Reset button to admin dashboard**

Find the end of the dashboard stats grid in the admin panel (after the stats cards):
```jsx
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                    {[['Total Entries', leaderboard.length], ['Avg Score', ...], ['Status', ...]].map(...)}
                  </div>
                </>
              )}
```

After the closing `</div>` of the stats grid and before `</>`, add:

```jsx
                  <div style={{ ...S.card, borderColor: 'rgba(192,57,43,0.25)', marginTop: 16 }}>
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
```

- [ ] **Step 2: Remove emojis from admin tab labels**

Find:
```jsx
              {[['dashboard','Dashboard'],['teams','🏀 Basketball'],['mammals','🦁 Mammal Madness'],['users','👥 Users'],['help','Help']].map(([id, label]) => (
```

Replace with:
```jsx
              {[['dashboard','Dashboard'],['teams','Basketball'],['mammals','Mammal Madness'],['users','Users'],['help','Help']].map(([id, label]) => (
```

- [ ] **Step 3: Update admin panel header color**

Find:
```jsx
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', margin: 0 }}>Admin Panel</h2>
```

Replace with:
```jsx
              <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: '#c0392b', margin: 0 }}>Admin Panel</h2>
```

- [ ] **Step 4: Update admin dashboard heading colors**

Replace occurrences of `color: ACCENT2` in admin section with `color: '#1E6B47'` (MINT_FG — the readable dark green) for headings.

Specifically find in dashboard:
```jsx
                    <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
```

Replace with:
```jsx
                    <h3 style={{ color: NAVY, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
```

---

## Task 11: Update `src/App.jsx` — Pass isMammal+mammalResearchData to all GameSlot calls in renderBracket

**Files:**
- Modify: `src/App.jsx`

The `renderBracket(isMammal)` function builds the bracket view. Every `<GameSlot ...>` call inside it needs `isMammal={isMammal}` and `mammalResearchData={mammalResearchData}`.

- [ ] **Step 1: Find all GameSlot calls inside renderBracket and add new props**

Search for `<GameSlot` in App.jsx. For each occurrence inside `renderBracket`:
- Add `isMammal={isMammal}` 
- Add `mammalResearchData={isMammal ? mammalResearchData : {}}`

The GameSlot calls in renderBracket use a `RoundCol` component and `ScaledGame` wrappers. The `RoundCol` renders `GameSlot` internally. Trace through and ensure props are threaded.

If `RoundCol` is an inline function inside `renderBracket`, simply add the props there. If `GameSlot` is called directly, add the two props directly.

Look for the pattern `onCompare={onCompareGame}` — every GameSlot with `onCompare` prop should also get:
```jsx
isMammal={isMammal}
mammalResearchData={isMammal ? mammalResearchData : {}}
```

---

## Task 12: Verify locally with `npm run dev`

**Files:**
- None

- [ ] **Step 1: Start dev server**

```bash
cd C:\Users\Samca\Projects\March-Madness && npm run dev
```

Expected: `Local: http://localhost:5173/`

- [ ] **Step 2: Check for compile errors**

Expected: no TypeScript/Babel errors in console. The Vite output should show `ready in XXXms`.

- [ ] **Step 3: Verify in browser (manual checklist)**

Open http://localhost:5173/ and check:
1. Background is warm cream `#E8E2D8` (not dark green, not dark navy)
2. Login screen shows Libre Bodoni heading + "Sign in with school Google" button
3. Clicking sign-in button attempts Google popup (may fail on localhost if domain restricted — that's OK)
4. After signing in: bracket renders with cream/navy tiles
5. Hover over a game tile with 2 real teams → compare zone animates (fills from top/bottom, COMPARE text appears)
6. Admin tab shows without emoji labels
7. Admin dashboard has "New Year Reset" button at bottom

---

## Self-Review

**Spec coverage check:**
- [x] Typography: Libre Bodoni / Public Sans — Task 4 (index.html) + Task 5 (S.logo, S.app)
- [x] Palette: all canonical colors via NAVY/GREEN/MINT constants — Task 5
- [x] GameSlot compare zone: pure CSS hover animation — Task 7
- [x] Habitat colors: HABITAT_COLORS map + getHabitatColor() — Task 5
- [x] Google Auth: signInWithPopup + onAuthStateChanged — Task 8
- [x] Login screen: single Google button, Libre Bodoni heading — Task 8
- [x] Admin New Year Reset: deleteAllBrackets() + button — Tasks 3 + 10
- [x] Lucide icons: LogIn, Lock, Check, Settings, AlertTriangle, Trophy — Task 5 import + Tasks 6/7/9
- [x] Emojis removed: login, header, ErrorBoundary, ConfirmDialog, admin tabs — Tasks 6/9/10
- [x] index.html body background — Task 4
- [x] findBracketByName removed from imports (no longer needed with Google Auth) — Task 5

**Type consistency check:**
- `compareColors` computed in GameSlot using `BB_COMPARE` / `getHabitatColor()` — matches habitat map in Task 5
- `deleteAllBrackets()` called in admin panel matches export added in Task 3
- `handleGoogleSignIn` defined in Task 8 Step 3, used in login screen Task 8 Step 5
- `NAVY`, `GREEN`, `MINT_BG`, `MINT_FG` defined in Task 5, used throughout Tasks 6-11

**Placeholder scan:** None found — all steps contain complete code.
