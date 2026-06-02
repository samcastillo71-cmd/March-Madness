# Phase 2 Implementation Plan — March Madness Bracket Challenge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role system (email-based Admin/Teacher/Student), claymorphism visual upgrade, Teacher tab, and per-screen polish (bracket spacing, confetti, leaderboard podium, mammal battle videos).

**Architecture:** All UI lives in `src/App.jsx` (2505 lines, inline styles only). Firestore service functions are added to `src/firestoreService.js`. The role system replaces the password-based admin flow entirely. New Firestore docs: `admin/superAdmins`, `admin/teachers`, `admin/mammalBattleVideos`. No new files are created except the npm install for `canvas-confetti`.

**Tech Stack:** React 18, Vite 5, Firebase Firestore v10, Lucide React, canvas-confetti (new)

---

## File Map

| File | Change |
|---|---|
| `src/firestoreService.js` | Add role functions + mammalBattleVideos functions; remove password functions |
| `src/App.jsx` | Role system, claymorphism tokens, all 10 screen upgrades |
| `package.json` | Add `canvas-confetti` dependency |

---

## Task 1: Install canvas-confetti

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install canvas-confetti
```

Expected output: `added 1 package` (≈3kb, no peer deps)

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add canvas-confetti for champion pick animation"
```

---

## Task 2: Firestore Service — Role Functions

Add role-check functions and mammalBattleVideos CRUD. Do NOT yet remove the old password functions (Task 3 handles that after the role system is wired up in App.jsx).

**Files:**
- Modify: `src/firestoreService.js`

- [ ] **Step 1: Add role-check functions at the end of firestoreService.js**

Append these functions after the existing `deleteAllBrackets` function:

```js
// ── ROLE SYSTEM ───────────────────────────────────────────────────────────────
// Returns { isAdmin, isTeacher, teacherSchool } for the given email.
// Checks admin/superAdmins and admin/teachers docs in Firestore.
export async function getUserRole(email) {
  if (!email) return { isAdmin: false, isTeacher: false, teacherSchool: null };
  try {
    const [adminSnap, teachersSnap] = await Promise.all([
      getDoc(doc(db, 'admin', 'superAdmins')),
      getDoc(doc(db, 'admin', 'teachers')),
    ]);
    const admins = adminSnap.exists() ? (adminSnap.data().emails || []) : [];
    if (admins.includes(email)) {
      return { isAdmin: true, isTeacher: false, teacherSchool: null };
    }
    const teachers = teachersSnap.exists() ? teachersSnap.data() : {};
    if (teachers[email]) {
      return { isAdmin: false, isTeacher: true, teacherSchool: teachers[email].school || null };
    }
    return { isAdmin: false, isTeacher: false, teacherSchool: null };
  } catch {
    return { isAdmin: false, isTeacher: false, teacherSchool: null };
  }
}

// ── SUPERADMINS MANAGEMENT ───────────────────────────────────────────────────
export async function getSuperAdmins() {
  const snap = await getDoc(doc(db, 'admin', 'superAdmins'));
  return snap.exists() ? (snap.data().emails || []) : [];
}

export async function saveSuperAdmins(emails) {
  await setDoc(doc(db, 'admin', 'superAdmins'), { emails, updatedAt: serverTimestamp() });
}

// ── TEACHERS MANAGEMENT ───────────────────────────────────────────────────────
export async function getTeachers() {
  const snap = await getDoc(doc(db, 'admin', 'teachers'));
  return snap.exists() ? snap.data() : {};
}

export async function saveTeachers(teachersObj) {
  await setDoc(doc(db, 'admin', 'teachers'), { ...teachersObj, updatedAt: serverTimestamp() });
}

// ── MAMMAL BATTLE VIDEOS ──────────────────────────────────────────────────────
export async function getMammalBattleVideos() {
  const snap = await getDoc(doc(db, 'admin', 'mammalBattleVideos'));
  return snap.exists() ? snap.data() : {};
}

export async function saveMammalBattleVideos(videosObj) {
  await setDoc(doc(db, 'admin', 'mammalBattleVideos'), { ...videosObj, updatedAt: serverTimestamp() });
}

export function subscribeToMammalBattleVideos(callback) {
  return onSnapshot(doc(db, 'admin', 'mammalBattleVideos'), snap => {
    if (snap.exists()) {
      const { updatedAt, ...videos } = snap.data();
      callback(videos);
    } else {
      callback({});
    }
  });
}

// ── USERS (school edit by teacher/admin) ─────────────────────────────────────
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function updateUserSchool(uid, school) {
  await setDoc(doc(db, 'users', uid), { school, updatedAt: serverTimestamp() }, { merge: true });
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/firestoreService.js
git commit -m "feat: add role system and mammal battle video functions to firestoreService"
```

---

## Task 3: Role System in App.jsx — Wire Up + Remove Password Admin

This is the most invasive task. It touches:
1. Imports (add new functions, remove old password functions)
2. State variables (remove password state, add role state)
3. `onAuthStateChanged` handler (add role check)
4. Tab definition (add Teacher and Admin tabs conditionally)
5. Remove password modal render + `handleAdminLogin` / `handleAdminSetup` / `handleOpenAdmin`
6. Remove admin "Enter" button from header nav

**Files:**
- Modify: `src/App.jsx` lines 1–25 (imports), ~941–958 (state), ~1097–1112 (auth), ~1259–1299 (admin handlers), ~1979–1984 (tabs), ~2032–2046 (header), ~1882–1912 (admin modal render)

- [ ] **Step 1: Update imports in App.jsx**

Find the current firestoreService import block (lines 9–22). Replace the entire import:

```js
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
```

Note: `checkAdminPassword`, `adminExists`, `setAdminPassword` are removed from the import.

- [ ] **Step 2: Replace the role/admin state block**

Find the current state block (~lines 941–956):
```js
const [isTeacher,    setIsTeacher]    = useState(false);
const [appReady,     setAppReady]     = useState(false);
const [school,       setSchool]       = useState('');
const [profileLoaded,setProfileLoaded] = useState(false);
const [schoolFilter, setSchoolFilter] = useState('all');

// ── ADMIN ─────────────────────────────────────────────────────────────────
const [isAdmin,       setIsAdmin]      = useState(false);
const [adminPwInput,  setAdminPwInput] = useState('');
const [adminPwError,  setAdminPwError] = useState('');
const [adminPwLoading,setAdminPwLoading] = useState(false);
const [showAdminLogin,setShowAdminLogin] = useState(false);
const [setupMode,     setSetupMode]    = useState(false);
const [newAdminPw,    setNewAdminPw]   = useState('');
const [newAdminPw2,   setNewAdminPw2]  = useState('');
```

Replace with:
```js
const [isTeacher,    setIsTeacher]    = useState(false);
const [teacherSchool,setTeacherSchool]= useState(null);
const [appReady,     setAppReady]     = useState(false);
const [school,       setSchool]       = useState('');
const [profileLoaded,setProfileLoaded] = useState(false);
const [schoolFilter, setSchoolFilter] = useState('all');
const [mammalBattleVideos, setMammalBattleVideos] = useState({});

// ── ADMIN ─────────────────────────────────────────────────────────────────
const [isAdmin,      setIsAdmin]      = useState(false);
```

- [ ] **Step 3: Replace the onAuthStateChanged handler**

Find the current handler (lines ~1098–1112):
```js
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
```

Replace with:
```js
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
```

- [ ] **Step 4: Add mammalBattleVideos subscription**

Inside the `useEffect` that has `if (!uid) return;` (the live subscriptions block, ~line 1145), find the existing return cleanup:
```js
return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
```

Before that line, add:
```js
const u9 = subscribeToMammalBattleVideos(setMammalBattleVideos);
```

And update the return:
```js
return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); };
```

- [ ] **Step 5: Remove password admin state from handleSignOut**

Find `handleSignOut` (~line 1301). Remove the `localStorage.removeItem('mm_admin')` line:

```js
const handleSignOut = async () => {
  setIsAdmin(false); setIsTeacher(false);
  setBracket(buildInitialBracket()); setMammalBracket(buildInitialBracket());
  setFirstFourPicks({}); setMammalFirstFourPicks({});
  setAppReady(false); setSchool(''); setProfileLoaded(false);
  setTeacherSchool(null);
  setTab('bracket');
  await signOut(auth);
};
```

- [ ] **Step 6: Delete the old admin login handler functions**

Delete entirely:
- `handleAdminLogin` function (~lines 1259–1276)
- `handleAdminSetup` function (~lines 1278–1291)
- `handleOpenAdmin` function (~lines 1293–1299)

- [ ] **Step 7: Update the tabs array and nav**

Find the tabs definition (~line 1980):
```js
const tabs = [
  { id: 'bracket',     label: 'Bracket'     },
  { id: 'research',    label: 'Research'    },
  { id: 'leaderboard', label: 'Leaderboard' },
];
```

Replace with:
```js
const tabs = [
  { id: 'bracket',     label: 'Bracket'     },
  { id: 'research',    label: 'Research'    },
  { id: 'leaderboard', label: 'Leaderboard' },
  ...(isTeacher || isAdmin ? [{ id: 'teacher', label: 'Teacher' }] : []),
  ...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : []),
];
```

- [ ] **Step 8: Update the nav in the header**

Find the nav block in `<header>` (~line 2034–2036):
```js
<nav style={{ display: 'flex', gap: 4 }}>
  {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
  <button style={{ ...S.navBtn(tab === 'admin' && isAdmin), display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={handleOpenAdmin}><Settings size={14} />Admin</button>
</nav>
```

Replace with:
```js
<nav style={{ display: 'flex', gap: 4 }}>
  {tabs.map(t => <button key={t.id} style={S.navBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
</nav>
```

- [ ] **Step 9: Delete the admin password modal**

Find and delete the entire admin modal render block. It starts around line 1882 and looks like:
```js
{showAdminLogin && (
  <div style={{ position: 'fixed', ... }}>
    ...
  </div>
)}
```

Delete that entire `{showAdminLogin && ...}` block.

- [ ] **Step 10: Verify build**

```bash
npm run build
```

Expected: clean build. If there are "is not defined" errors, they're likely references to the deleted state vars — search and remove them.

- [ ] **Step 11: Test locally**

```bash
npm run dev
```

Open localhost. Sign in with Google. Verify:
- Student account (not sam.castillo71@gmail.com) shows only Bracket/Research/Leaderboard tabs
- No "Admin" button anywhere for students
- The `admin/superAdmins` doc will need to be created in Firebase console with `{ emails: ["sam.castillo71@gmail.com"] }` for admin access to work

- [ ] **Step 12: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace password admin with email-based role system (isAdmin/isTeacher from Firestore)"
```

---

## Task 4: Claymorphism Tokens — Global Style Upgrade

Apply claymorphism to every card, button, and tile across the app. This is done by:
1. Updating `S.card` and `S.btn` in the `S` object
2. Adding CSS keyframes and utility classes to the inline `<style>` block
3. Updating `GameSlot` tile styles

**Files:**
- Modify: `src/App.jsx` lines 42–51 (`S` object), lines 272–273 (`GameSlot` tile), lines 1996–2025 (`<style>` block)

- [ ] **Step 1: Update the S object**

Find the `S` object definition (lines ~42–51):
```js
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
```

Replace with:
```js
const S = {
  app:    { minHeight: '100vh', background: '#E8E2D8', color: '#1A1208', fontFamily: "'Public Sans', sans-serif" },
  header: { background: 'rgba(9,24,40,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(28,53,88,0.6)', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 },
  logo:   { fontFamily: "'Libre Bodoni', serif", fontSize: 19, fontWeight: 700, color: '#B8CBE8', letterSpacing: 1 },
  card:   { background: '#F4EFE6', border: '2px solid rgba(9,24,40,0.20)', borderRadius: 18, padding: 20, boxShadow: '4px 6px 14px rgba(9,24,40,0.10), inset -1px -1px 4px rgba(255,255,255,0.8)' },
  btn:    (bg = NAVY, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3, boxShadow: '3px 4px 10px rgba(9,24,40,0.15)', transition: 'transform 200ms ease-out, box-shadow 200ms ease-out' }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? NAVY : 'transparent', color: a ? '#fff' : '#B8CBE8', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.7)', border: '1px solid #C8BFB0', borderRadius: 10, color: '#1A1208', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
  tag:    (color) => ({ fontSize: 10, color, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }),
};
```

- [ ] **Step 2: Update GameSlot tile border radius and border**

Find the non-horizontal GameSlot return div (~line 273):
```js
<div style={{ border: `1px solid ${slotBorder}`, borderRadius: 6, overflow: 'hidden', background: slotBg, minWidth: 178 }}>
```

Replace with:
```js
<div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg, minWidth: 178, boxShadow: '4px 6px 14px rgba(9,24,40,0.08), inset -1px -1px 3px rgba(255,255,255,0.6)' }}>
```

Also find the winner row — in the `Team` inner component, find where `isW` renders with MINT_BG background:
```js
background: isW ? MINT_BG : '#F4EFE6',
```
Add a left accent border for the winner side. Find the vertical (non-horizontal) Team row div:
```js
style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? MINT_BG : '#F4EFE6', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.4 : 1, transition: 'background .12s' }}
```

Replace with:
```js
style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', height: 36, boxSizing: 'border-box', flexDirection: flipped ? 'row-reverse' : 'row', background: isW ? MINT_BG : '#F4EFE6', cursor: locked || isFF ? 'default' : 'pointer', borderRadius: 4, opacity: isL ? 0.4 : 1, transition: 'background .12s', borderLeft: isW ? `3px solid ${MINT_FG}` : 'none' }}
```

- [ ] **Step 3: Add CSS for button press and spring bounce**

In the `<style>` block inside the main return (~line 1996), add these rules after the existing animation definitions:
```css
button:active { transform: scale(0.96); }
.spring-pick { animation: springBounce 250ms cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes springBounce { 0%{transform:scale(1)} 40%{transform:scale(0.97)} 70%{transform:scale(1.02)} 100%{transform:scale(1)} }
@media (prefers-reduced-motion: reduce) { button:active { transform: none; } .spring-pick { animation: none; } }
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: apply claymorphism tokens globally (cards, buttons, GameSlot tiles)"
```

---

## Task 5: Sign-In Screen — Claymorphism + Animations

**Files:**
- Modify: `src/App.jsx` sign-in render block (~lines 1950–1977) and the `<style>` block

- [ ] **Step 1: Add sign-in CSS animations to the style block**

In the `<style>` block, add:
```css
@keyframes underlineGrow { from{width:0} to{width:100%} }
@keyframes bgDrift { 0%{background-position:0 0} 100%{background-position:60px 60px} }
.signin-underline::after { content:''; display:block; height:3px; background:linear-gradient(90deg,#091828,#1C3558); border-radius:2px; width:0; animation:underlineGrow 600ms ease-out forwards; animation-delay:200ms; }
@media (prefers-reduced-motion: reduce) { .signin-underline::after { animation:none; width:100%; } @keyframes bgDrift {} }
```

- [ ] **Step 2: Rewrite the sign-in screen render block**

Find the `if (!uid) return (` block (~line 1951) and replace the entire sign-in render with:

```jsx
if (!uid) return (
  <>
    <div style={{
      ...S.app,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 36, minHeight: '100vh',
      backgroundImage: 'radial-gradient(rgba(9,24,40,0.04) 1.5px, transparent 1.5px)',
      backgroundSize: '24px 24px',
      animation: 'bgDrift 20s linear infinite',
    }}>
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <h1 className="signin-underline" style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 48, fontWeight: 700, color: NAVY, letterSpacing: 2, lineHeight: 1.1, display: 'inline-block' }}>
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
          <LogIn size={20} />
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
```

- [ ] **Step 3: Verify build and check sign-in screen visually**

```bash
npm run dev
```

Open localhost. Verify:
- Dot grid pattern visible in background
- Heading underline animates from left to right after 200ms
- Card has claymorphism shadow/border

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: sign-in screen claymorphism card, animated heading underline, bg dot pattern"
```

---

## Task 6: Onboarding Screen — 2×2 Bento Grid

Replace the vertical stack of buttons with a 2×2 grid of school cards.

**Files:**
- Modify: `src/App.jsx` onboarding render block (~lines 1925–1948) and `<style>` block

- [ ] **Step 1: Add onboarding CSS to the style block**

```css
@keyframes schoolCardBounce { 0%{transform:scale(1)} 40%{transform:scale(0.96)} 70%{transform:scale(1.02)} 100%{transform:scale(1)} }
.school-card:hover { transform: translateY(-3px); box-shadow: 6px 10px 20px rgba(9,24,40,0.15), inset -1px -1px 4px rgba(255,255,255,0.8) !important; }
.school-card-check { opacity:0; transform:scale(0.5); transition: opacity 200ms, transform 200ms; }
.school-card-check.visible { opacity:1; transform:scale(1); }
```

- [ ] **Step 2: Add `School` to lucide-react import**

Find line 7:
```js
import { LogIn, Lock, Check, Settings, AlertTriangle, Trophy } from 'lucide-react';
```

Replace with:
```js
import { LogIn, Lock, Check, Settings, AlertTriangle, Trophy, School } from 'lucide-react';
```

- [ ] **Step 3: Add selectedSchoolCard state variable**

Add near the other state declarations:
```js
const [selectedSchoolCard, setSelectedSchoolCard] = useState(null);
```

- [ ] **Step 4: Rewrite the onboarding render block**

Find the block starting at `const SCHOOLS = ['Hart', 'Van Hoosen', 'Reuther', 'West'];` (~line 1926) and replace through the closing `);` of the onboarding return:

```jsx
const SCHOOLS = ['Hart', 'Van Hoosen', 'Reuther', 'West'];
if (uid && appReady && profileLoaded && !school && !isAdmin) return (
  <div style={{ ...S.app, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 32, padding: '0 16px' }}>
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 36, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
        Welcome, {displayName.split(' ')[0]}!
      </h1>
      <p style={{ color: '#7A7068', fontSize: 16 }}>Which school do you go to?</p>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 440, width: '100%' }}>
      {SCHOOLS.map(s => {
        const isSelected = selectedSchoolCard === s;
        return (
          <button
            key={s}
            className="school-card"
            onClick={() => {
              setSelectedSchoolCard(s);
              setTimeout(() => handleSelectSchool(s), 450);
            }}
            style={{
              ...S.card,
              border: isSelected ? `2px solid ${MINT_FG}` : '2px solid rgba(9,24,40,0.20)',
              background: isSelected ? MINT_BG : '#F4EFE6',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '24px 16px',
              fontFamily: "'Libre Bodoni', serif",
              fontSize: 18,
              fontWeight: 700,
              color: isSelected ? MINT_FG : NAVY,
              transition: 'transform 200ms ease-out, box-shadow 200ms ease-out, background 200ms',
              animation: isSelected ? 'schoolCardBounce 250ms cubic-bezier(0.34,1.56,0.64,1)' : 'none',
            }}>
            <School size={32} color={isSelected ? MINT_FG : NAVY} />
            {s}
            <span className={`school-card-check${isSelected ? ' visible' : ''}`}>
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
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Test onboarding locally**

Sign in with a Google account that has no saved school profile. Verify:
- 2×2 grid of school cards
- Hover lifts the card
- Click triggers spring bounce + green checkmark
- After 450ms, automatically saves school and proceeds to main app

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: onboarding 2x2 bento grid school picker with spring bounce and checkmark"
```

---

## Task 7: Bracket Tab — SH 120, Completion Bar, Champion Confetti, Locked Stamp

**Files:**
- Modify: `src/App.jsx` `renderBracket` function, `<style>` block
- Add: `canvas-confetti` import at top of file

- [ ] **Step 1: Add canvas-confetti import**

At the top of App.jsx, after the React import line, add:
```js
import confetti from 'canvas-confetti';
```

- [ ] **Step 2: Update bracket slot height and ROUND_ABS**

In `renderBracket` (~line 1628), find:
```js
const CW = 240, SH = 105, FF_SCALE = 1.25;
```

Replace with:
```js
const CW = 240, SH = 120, FF_SCALE = 1.25;
```

Then find ROUND_ABS (~line 1648):
```js
const ROUND_ABS = [
  [0,105,210,315,420,525,630,735],
  [52.5,262.5,472.5,682.5],
  [157.5,577.5],
  [367.5],
];
```

Replace with:
```js
const ROUND_ABS = [
  [0,120,240,360,480,600,720,840],
  [60,300,540,780],
  [180,660],
  [420],
];
```

`TOP_H` is derived from `8 * SH` which will now correctly be 960.

- [ ] **Step 3: Add completion bar computation and render**

Add a helper computation inside `renderBracket` after `const isLocked = ...`:

```js
// Completion bar: count user's picks out of 63
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
const totalPicks = countPicks(activeBracket);
const pickPct = Math.min(100, (totalPicks / 63) * 100);
const isComplete = totalPicks >= 63;
```

Then in the `return (...)` of `renderBracket`, before the `<div style={{ width: TOTAL_W }}>` that wraps the bracket grid, add:

```jsx
{/* Completion bar */}
<div style={{ marginBottom: 12 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
    <span style={{ fontSize: 12, color: '#7A7068', fontWeight: 600 }}>
      {isComplete ? 'Complete! 🎉' : `${totalPicks}/63 picks made`}
    </span>
    <div style={{ display: 'flex', gap: 4 }}>
      {['R64','R32','S16','E8','FF','Champ'].map((label, i) => (
        <span key={label} style={{ fontSize: 10, color: '#7A7068', padding: '1px 5px', borderRadius: 3, background: 'rgba(9,24,40,0.07)' }}>{label}</span>
      ))}
    </div>
  </div>
  <div style={{ height: 8, background: 'rgba(9,24,40,0.10)', borderRadius: 4, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${pickPct}%`, background: isComplete ? MINT_FG : NAVY, borderRadius: 4, transition: 'width 0.4s ease-out' }} />
  </div>
</div>
```

- [ ] **Step 4: Add champion confetti**

The champion pick is handled by `makeChampHandler`. Find the championship pick handler (search for `makeChampHandler` or `championship.winner`). The champ pick fires via `onChampPick`. 

Add a `useCallback`-wrapped confetti trigger. Add this near the other handlers (~after handleSignOut):

```js
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
```

Then find where the championship winner is set in `makeChampHandler`. Look for where `championship.winner` is assigned in a `setBracketFn`. After the setBracketFn call in the champ handler, call `triggerChampionConfetti()`.

The champion handler is used as `onChampPick`. Find the call sites in renderBracket and pass a wrapped version:

```js
const onChampPick = isMammal
  ? (side) => { handleMammalChampPick(side); triggerChampionConfetti(); }
  : (side) => { handleChampPick(side); triggerChampionConfetti(); };
```

Note: The existing `handleChampPick` and `handleMammalChampPick` are already defined. Just wrap them here inside `renderBracket`.

- [ ] **Step 5: Add locked stamp animation CSS**

In the `<style>` block add:
```css
@keyframes stampIn { 0%{opacity:0;transform:rotate(-15deg) scale(1.4)} 60%{opacity:1;transform:rotate(-15deg) scale(0.95)} 100%{opacity:0.65;transform:rotate(-15deg) scale(1)} }
.locked-stamp { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:10; }
.locked-stamp span { font-family:'Libre Bodoni',serif; font-size:13px; font-weight:900; color:#dc2626; border:2px solid #dc2626; padding:2px 8px; border-radius:3px; letter-spacing:3px; text-transform:uppercase; opacity:0.65; transform:rotate(-15deg); }
.locked-stamp.animating { animation: stampIn 600ms ease-out forwards; }
```

- [ ] **Step 6: Add locked state to GameSlot**

The `locked` prop in `GameSlot` is already passed. Add a visual lock stamp overlay. In `GameSlot`, after the closing `</div>` of the outer wrapper, add:

```jsx
{locked && (
  <div className="locked-stamp">
    <span><Lock size={10} style={{ marginRight: 3, display: 'inline-block', verticalAlign: 'middle' }} />LOCKED</span>
  </div>
)}
```

Make the outer wrapper `position: relative`:
```js
<div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg, minWidth: 178, boxShadow: '...', position: 'relative' }}>
```

- [ ] **Step 7: Verify build and test bracket**

```bash
npm run build && npm run dev
```

Test: fill out bracket picks. Check:
- Tiles are spaced ~31px apart visually
- Completion bar advances with each pick
- At 63 picks, bar turns green and shows "Complete!"
- Picking the champion triggers confetti burst

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: bracket SH 120px, completion bar, champion confetti, locked stamp overlay"
```

---

## Task 8: Research Tab — Claymorphism + Line-Clamp + Empty State + Mammal Battle Videos

**Files:**
- Modify: `src/App.jsx` research tab render section (~lines 2082–2300), `<style>` block

- [ ] **Step 1: Add line-clamp CSS**

In the `<style>` block add:
```css
.line-clamp-4 { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
```

- [ ] **Step 2: Update ResearchCard to use claymorphism**

`ResearchCard` already uses `S.card`. Since we updated `S.card` in Task 4, cards automatically get the new treatment. No code change needed here.

- [ ] **Step 3: Update empty state for research tab**

Find the empty state render in the basketball research section (~line 2098):
```jsx
<div style={{ ...S.card, textAlign: 'center', padding: 48, color: '#777' }}><div style={{ fontSize: 40, marginBottom: 16 }}>📊</div><div ...>No research data yet</div>...
```

Replace the emoji `📊` div with a Lucide icon. Add `Telescope` to the lucide imports, or use `Search` (Telescope may not exist in lucide). Use `Search` as the empty state icon:

Add `Search` to the import:
```js
import { LogIn, Lock, Check, Settings, AlertTriangle, Trophy, School, Search } from 'lucide-react';
```

Replace the basketball empty state:
```jsx
<div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
  <Search size={40} color="#C8BFB0" style={{ marginBottom: 16 }} />
  <div style={{ fontSize: 16, color: '#7A7068', marginBottom: 8 }}>No research data yet</div>
  <div style={{ fontSize: 13, color: '#7A7068' }}>{isAdmin ? 'Go to Admin → Basketball → Generate Research' : 'Research data will appear once the admin generates it.'}</div>
</div>
```

Do the same for the mammal research empty state (find the similar empty state check in the mammal research section).

- [ ] **Step 4: Add Mammal Battle Videos section at top of mammal research tab**

Find the mammal research tab render. It starts after `{activeTournament === 'mammals' && (` inside the research tab. Add the following block BEFORE the existing mammal research cards:

```jsx
{/* Mammal Battle Videos */}
{Object.keys(mammalBattleVideos).filter(round => mammalBattleVideos[round] && round !== 'updatedAt').length > 0 && (
  <div style={{ marginBottom: 32 }}>
    <h3 style={{ fontFamily: "'Libre Bodoni', serif", color: GREEN, marginBottom: 16, fontSize: 20 }}>
      Mammal Battle Videos
    </h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.entries(mammalBattleVideos)
        .filter(([key, val]) => key !== 'updatedAt' && val)
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
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: research tab claymorphism, empty state icon, mammal battle video embeds"
```

---

## Task 9: Leaderboard — Top-3 Podium, Sticky Your-Rank, Live Flash

**Files:**
- Modify: `src/App.jsx` leaderboard render section, `<style>` block

- [ ] **Step 1: Add live flash CSS**

In the `<style>` block add:
```css
@keyframes scoreFlash { 0%{background:rgba(30,107,71,0.30)} 100%{background:transparent} }
.score-flash { animation: scoreFlash 800ms ease-out forwards; border-radius: 4px; }
```

- [ ] **Step 2: Add score-flash tracking state**

Add near other state declarations:
```js
const [flashedScores, setFlashedScores] = useState({});
```

- [ ] **Step 3: Detect score changes in leaderboard snapshots**

The leaderboard is set via `subscribeToLeaderboard(setLeaderboard)`. Wrap the setter to detect score changes:

In the live subscriptions useEffect, find:
```js
const u3 = subscribeToLeaderboard(setLeaderboard);
```

Replace with:
```js
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
```

- [ ] **Step 4: Rewrite leaderboard tab render**

Find the leaderboard tab render (search for `{tab === 'leaderboard' && (`). It renders a list of entries. Replace the entire leaderboard tab content with:

```jsx
{tab === 'leaderboard' && (
  <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
    <TournamentSelector />
    {(() => {
      const lb = activeTournament === 'basketball' ? leaderboard : mammalLeaderboard;
      const top3 = lb.slice(0, 3);
      const rest = lb.slice(3);
      const myEntry = lb.find(e => e.uid === uid);
      const myRank = myEntry ? lb.indexOf(myEntry) + 1 : null;
      const isMyRankVisible = myRank !== null && myRank <= 10 + 3;
      const PODIUM_COLORS = ['#C4952A','#A8A8A8','#CD7F32'];
      const PODIUM_LABELS = ['#1','#2','#3'];

      return (
        <>
          {/* School filter pills */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['all','Hart','Van Hoosen','Reuther','West'].map(f => (
              <button key={f} onClick={() => setSchoolFilter(f)}
                style={{ ...S.btn(schoolFilter === f ? NAVY : 'rgba(9,24,40,0.06)', schoolFilter === f ? '#fff' : '#7A7068'), padding: '6px 14px', fontSize: 12 }}>
                {f === 'all' ? 'All Schools' : f}
              </button>
            ))}
          </div>

          {/* Top-3 Podium */}
          {top3.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'center' }}>
              {top3.map((entry, i) => (
                <div key={entry.uid} style={{
                  ...S.card,
                  flex: i === 0 ? '1.2' : '1',
                  border: `2px solid ${PODIUM_COLORS[i]}`,
                  boxShadow: `4px 6px 14px rgba(9,24,40,0.10), inset -1px -1px 4px rgba(255,255,255,0.8), 0 0 0 1px ${PODIUM_COLORS[i]}40`,
                  textAlign: 'center',
                  padding: '20px 12px',
                }}>
                  <div style={{ fontSize: i === 0 ? 28 : 20, marginBottom: 4 }}>
                    {i === 0 ? <Trophy size={28} color={PODIUM_COLORS[0]} /> : <span style={{ color: PODIUM_COLORS[i], fontWeight: 900 }}>{PODIUM_LABELS[i]}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1208', marginBottom: 2 }}>{formatName(entry.displayName)}</div>
                  {entry.school && <div style={{ fontSize: 11, color: '#7A7068', marginBottom: 6 }}>{entry.school}</div>}
                  <div style={{ fontSize: i === 0 ? 24 : 18, fontWeight: 900, color: PODIUM_COLORS[i] }}>{entry.score}</div>
                  <div style={{ fontSize: 10, color: '#7A7068', textTransform: 'uppercase', letterSpacing: 1 }}>pts</div>
                </div>
              ))}
            </div>
          )}

          {/* Ranked list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lb
              .filter(e => schoolFilter === 'all' || e.school === schoolFilter)
              .map((entry, idx) => {
                const isMe = entry.uid === uid;
                const flashKey = flashedScores[entry.uid];
                return (
                  <div key={entry.uid} className={flashKey ? 'score-flash' : ''}
                    style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, border: isMe ? `2px solid ${NAVY}` : '2px solid rgba(9,24,40,0.20)' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#7A7068', minWidth: 28 }}>#{entry.rank}</span>
                    <Avatar name={entry.displayName} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1208', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatName(entry.displayName)}</div>
                      {entry.school && <div style={{ fontSize: 11, color: '#7A7068' }}>{entry.school}</div>}
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{entry.score}</span>
                  </div>
                );
              })}
          </div>

          {/* Sticky your-rank bar */}
          {myEntry && !isMyRankVisible && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: NAVY, color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 -4px 20px rgba(9,24,40,0.25)' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Your rank: #{myRank}</span>
              <span style={{ fontSize: 18, fontWeight: 900 }}>{myEntry.score} pts</span>
            </div>
          )}
        </>
      );
    })()}
  </div>
)}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: leaderboard top-3 podium, sticky your-rank bar, live score flash"
```

---

## Task 10: Teacher Tab

Add a new tab visible to teachers and admins. Shows class leaderboard for teacher's school, student roster, and mammal battle videos.

**Files:**
- Modify: `src/App.jsx` — add teacher tab render in the `{tab === ...}` block area (~after leaderboard tab), and add a `TeacherRoster` fetch mechanism.

- [ ] **Step 1: Add teacher roster state**

Add near other state declarations:
```js
const [teacherRosterStudents, setTeacherRosterStudents] = useState([]);
const [teacherRosterLoading, setTeacherRosterLoading] = useState(false);
const [teacherActiveView, setTeacherActiveView] = useState('leaderboard');
const [teacherTournament, setTeacherTournament] = useState('basketball');
```

- [ ] **Step 2: Add a roster loader useEffect**

Add a useEffect that loads the roster when the teacher tab is active:

```js
useEffect(() => {
  if (tab !== 'teacher' || !uid) return;
  const schoolToFilter = teacherSchool || school;
  if (!schoolToFilter) return;
  setTeacherRosterLoading(true);
  getAllUsers().then(users => {
    const filtered = users.filter(u => u.school === schoolToFilter);
    setTeacherRosterStudents(filtered);
    setTeacherRosterLoading(false);
  }).catch(() => setTeacherRosterLoading(false));
}, [tab, uid, teacherSchool, school]);
```

- [ ] **Step 3: Add the teacher tab render block**

Add the following after the leaderboard tab block:

```jsx
{/* ══ TEACHER TAB ══ */}
{tab === 'teacher' && (isTeacher || isAdmin) && (
  <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
    <h2 style={{ fontFamily: "'Libre Bodoni', serif", color: NAVY, marginBottom: 4, fontSize: 24 }}>
      {teacherSchool || school} — Your Class
    </h2>
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
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
                    <span style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>{entry.score}</span>
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
        {teacherRosterLoading
          ? <div style={{ textAlign: 'center', color: '#7A7068', padding: 40 }}>Loading roster...</div>
          : teacherRosterStudents.length === 0
          ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#7A7068' }}>No students from {teacherSchool || school} found.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, padding: '8px 16px', fontSize: 11, color: '#7A7068', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                <span>Name</span><span>School</span><span>BB Score</span><span>Mammal Score</span><span>Actions</span>
              </div>
              {teacherRosterStudents.map(student => {
                const bbEntry = leaderboard.find(e => e.uid === student.uid);
                const mmEntry = mammalLeaderboard.find(e => e.uid === student.uid);
                return (
                  <div key={student.uid} style={{ ...S.card, padding: '10px 16px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{bbEntry?.displayName || mmEntry?.displayName || student.uid.slice(0, 8)}</span>
                    <span style={{ fontSize: 13, color: '#7A7068' }}>{student.school}</span>
                    <span style={{ fontWeight: 700 }}>{bbEntry?.score ?? '—'}</span>
                    <span style={{ fontWeight: 700 }}>{mmEntry?.score ?? '—'}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => {
                        if (!window.confirm(`Remove ${bbEntry?.displayName || student.uid} from the app? This deletes their bracket and leaderboard entry.`)) return;
                        deleteBracketAndScore(student.uid, false).catch(() => {});
                        deleteBracketAndScore(student.uid, true).catch(() => {});
                        setTeacherRosterStudents(prev => prev.filter(s => s.uid !== student.uid));
                      }} style={{ ...S.btn('#c0392b'), padding: '4px 10px', fontSize: 11 }}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    )}

    {/* Mammal Battle Videos (teacher projection view) */}
    {teacherActiveView === 'videos' && (
      <div>
        {Object.keys(mammalBattleVideos).filter(k => k !== 'updatedAt' && mammalBattleVideos[k]).length === 0
          ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#7A7068' }}>No battle videos added yet. Ask the admin to add video IDs in Admin → Mammal.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(mammalBattleVideos)
                .filter(([k, v]) => k !== 'updatedAt' && v)
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
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: teacher tab with class leaderboard, student roster, and mammal battle videos"
```

---

## Task 11: Admin People Sub-tab + Admin Mammal YouTube Video Fields

Add the People sub-tab to Admin (manage superAdmins + teachers lists) and the YouTube video ID fields to the Mammal sub-tab.

**Files:**
- Modify: `src/App.jsx` admin tab render section

- [ ] **Step 1: Add admin People state**

Add state variables for the People sub-tab:
```js
const [adminPeopleAdmins, setAdminPeopleAdmins] = useState([]);
const [adminPeopleTeachers, setAdminPeopleTeachers] = useState({});
const [adminPeopleLoading, setAdminPeopleLoading] = useState(false);
const [adminNewAdminEmail, setAdminNewAdminEmail] = useState('');
const [adminNewTeacherEmail, setAdminNewTeacherEmail] = useState('');
const [adminNewTeacherSchool, setAdminNewTeacherSchool] = useState('Hart');
const [adminMammalVideos, setAdminMammalVideos] = useState({});
const [adminMammalVideosSaving, setAdminMammalVideosSaving] = useState(false);
```

- [ ] **Step 2: Load People and Videos when admin tab opens**

Add a useEffect:
```js
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
```

- [ ] **Step 3: Find the admin sub-tab selector and add "People" sub-tab**

Inside the admin tab render, find where the admin sub-tabs are rendered (they look like `['Dashboard','Basketball','Mammal','Users','Help'].map(...)` or similar). Add 'People' to that list.

Search for `adminTab ===` or `setAdminTab` to find the admin sub-tab render. The exact structure depends on the current code. Look for a pattern like:
```jsx
{['Dashboard', 'Basketball', 'Mammal', 'Users', 'Help'].map(t => (
  <button key={t} style={...} onClick={() => setAdminTab(t)}>{t}</button>
))}
```

Add `'People'` to that array:
```jsx
{['Dashboard', 'Basketball', 'Mammal', 'Users', 'People', 'Help'].map(t => (
  <button key={t} style={...} onClick={() => setAdminTab(t)}>{t}</button>
))}
```

- [ ] **Step 4: Add the People sub-tab content**

Find where the admin sub-tab content is rendered (likely a series of `{adminTab === 'Dashboard' && ...}` blocks). Add after the last existing sub-tab content:

```jsx
{adminTab === 'People' && (
  <div>
    <h3 style={{ fontFamily: "'Libre Bodoni', serif", color: NAVY, marginBottom: 20 }}>Manage Roles</h3>
    {adminPeopleLoading
      ? <div style={{ color: '#7A7068', padding: 20 }}>Loading...</div>
      : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Admins section */}
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
              }} style={{ ...S.btn(NAVY), padding: '10px 18px', fontSize: 13 }}>Add Admin</button>
            </div>
          </div>

          {/* Teachers section */}
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
                {['Hart','Van Hoosen','Reuther','West'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => {
                const email = adminNewTeacherEmail.trim().toLowerCase();
                if (!email) return;
                const updated = { ...adminPeopleTeachers, [email]: { school: adminNewTeacherSchool } };
                setAdminPeopleTeachers(updated);
                saveTeachers(updated).catch(console.warn);
                setAdminNewTeacherEmail('');
              }} style={{ ...S.btn(NAVY), padding: '10px 18px', fontSize: 13 }}>Add Teacher</button>
            </div>
          </div>
        </div>
      )
    }
  </div>
)}
```

- [ ] **Step 5: Add YouTube video ID fields to Admin Mammal sub-tab**

Find the `{adminTab === 'Mammal' && (` or equivalent block inside the admin tab render. Near the top of the Mammal admin sub-tab content (after the title), add a video ID section:

```jsx
{/* Mammal Battle Videos */}
<div style={{ ...S.card, marginBottom: 24 }}>
  <h4 style={{ color: GREEN, marginBottom: 4, fontWeight: 700 }}>Mammal Battle Videos</h4>
  <p style={{ fontSize: 12, color: '#7A7068', marginBottom: 16 }}>Enter YouTube video IDs (e.g. <code>dQw4w9WgXcQ</code>) for each round. Leave blank to hide.</p>
  {['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Final Four', 'Championship'].map(round => (
    <div key={round} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#1A1208', minWidth: 110 }}>{round}</label>
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
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

- [ ] **Step 7: Test admin panel locally**

Sign in as sam.castillo71@gmail.com (after creating the `admin/superAdmins` doc in Firebase console). Verify:
- Admin tab is visible
- People sub-tab shows admin + teacher management
- Mammal sub-tab has video ID fields at the top
- Adding a teacher email + school and clicking "Add Teacher" writes to Firestore

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: admin People sub-tab (superAdmins + teachers mgmt) and mammal battle video ID fields"
```

---

## Task 12: Remove Old Password Admin Functions from firestoreService.js

Now that App.jsx no longer imports or calls the password functions, remove them.

**Files:**
- Modify: `src/firestoreService.js`

- [ ] **Step 1: Delete the old admin password functions**

In `src/firestoreService.js`, delete the entire `── ADMIN PASSWORD ──` section (lines ~97–121):
```js
// ── ADMIN PASSWORD ────────────────────────────────────────────────────────────
export async function getAdminPasswordHash() { ... }
export async function setAdminPassword(password) { ... }
export async function checkAdminPassword(password) { ... }
export async function adminExists() { ... }
```

Also update the comment at the top of the file:
Replace:
```js
// No Google authentication — identity is name-based with localStorage UUID.
// Admin access is password-based, stored in Firestore.
```
With:
```js
// Google Sign-In (Firebase Auth). Admin and Teacher roles are email-based (Firestore).
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: zero errors. If there are import errors in App.jsx, fix them.

- [ ] **Step 3: Commit**

```bash
git add src/firestoreService.js
git commit -m "refactor: remove old password-based admin functions from firestoreService"
```

---

## Task 13: Firebase Console Setup (Manual — Not Code)

This is a manual step Sam must do once after deploy.

- [ ] **Step 1: Create `admin/superAdmins` doc in Firebase console**

Go to [Firebase console](https://console.firebase.google.com) → Firestore → `admin` collection → create document `superAdmins`:
```json
{
  "emails": ["sam.castillo71@gmail.com"]
}
```

- [ ] **Step 2: Verify admin access**

Sign in at `march-madness-ruby.vercel.app` with sam.castillo71@gmail.com. The Admin tab should appear.

---

## Task 14: Final Build Check + Deploy

- [ ] **Step 1: Full clean build**

```bash
npm run build
```

Expected: zero errors. The chunk size warning for App.jsx is pre-existing and acceptable.

- [ ] **Step 2: Local smoke test**

```bash
npm run dev
```

Test as student: Bracket / Research / Leaderboard tabs visible. No Admin tab.
Test as teacher (after adding a teacher email to Firestore): Teacher tab visible.
Test as admin (sam.castillo71@gmail.com after Task 13): All 5 tabs visible.

Verify:
- Onboarding shows 2×2 bento grid
- Sign-in shows animated underline + dot bg
- Bracket tiles taller (SH=120), completion bar present
- Champion pick triggers confetti
- Leaderboard shows podium for top 3
- Mammal Research tab shows video embeds if videos are set
- Admin > Mammal has video ID fields
- Admin > People manages superAdmins + teachers

- [ ] **Step 3: Deploy to Vercel**

```bash
vercel --prod
```

Or push to main if Vercel CI is configured.

- [ ] **Step 4: Post-deploy smoke test**

Open `march-madness-ruby.vercel.app` in a private window. Verify sign-in works, tabs load correctly for a new student account.

---

## Self-Review: Spec Coverage Check

| Spec Item | Covered in Task |
|---|---|
| Role system (superAdmins/teachers docs) | Task 2, 3 |
| Email-based isAdmin/isTeacher on sign-in | Task 3 Step 3 |
| Remove password admin UI/state | Task 3 Steps 5-9, Task 12 |
| Tab visibility by role | Task 3 Steps 7-8 |
| Claymorphism card/button/tile tokens | Task 4 |
| Spring bounce on picks (CSS + active) | Task 4 Step 3 |
| Sign-in animated underline | Task 5 |
| Sign-in bg dot pattern | Task 5 |
| Sign-in prefers-reduced-motion | Task 5 (in CSS) |
| Onboarding 2×2 bento grid | Task 6 |
| Onboarding spring bounce + checkmark | Task 6 |
| Onboarding subtext | Task 6 |
| Bracket SH 120 + ROUND_ABS recalc | Task 7 |
| Bracket completion bar | Task 7 |
| Champion confetti (canvas-confetti) | Task 7 |
| Locked stamp overlay | Task 7 |
| GameSlot winner left accent | Task 4 |
| Research claymorphism | Task 4 (via S.card update) |
| Research empty state with icon | Task 8 |
| Research line-clamp CSS | Task 8 |
| Mammal Battle Videos in Research | Task 8 |
| Mammal Battle Videos subscription | Task 3 Step 4 |
| Leaderboard top-3 podium | Task 9 |
| Leaderboard sticky your-rank | Task 9 |
| Leaderboard live score flash | Task 9 |
| Teacher tab (class leaderboard) | Task 10 |
| Teacher tab (student roster + Remove) | Task 10 |
| Teacher tab (battle videos) | Task 10 |
| Admin People sub-tab | Task 11 |
| Admin Mammal YouTube video IDs | Task 11 |
| New Firestore docs | Task 2 |
| Firebase console manual setup | Task 13 |

All spec items are covered. No gaps found.
