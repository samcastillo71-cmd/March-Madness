# RCS Bracket Challenge — Overhaul Design Spec
**Date:** 2026-05-30  
**Status:** Approved for implementation  
**Author:** S. Castillo, Hart Middle School, Rochester Community Schools

---

## Context

The RCS Bracket Challenge is a school bracket-picking web app used across four Rochester Community Schools middle schools for both the NCAA Basketball tournament and the March Mammal Madness science education tournament (Arizona State University). Students fill out brackets, scores auto-calculate against the official bracket entered by the admin, and a live leaderboard tracks standings.

The current app was built for a single school (Hart Middle School) with no real authentication — students identify themselves by typing a username. As the app expands to four schools, several foundational problems need to be addressed before adding any new features: security gaps (Firebase keys in a public repo, admin access exploitable via browser DevTools), no school-level data isolation, and a 2,245-line monolithic `App.jsx` that makes UI changes painful. This overhaul addresses all of these simultaneously, delivers a full visual redesign, and adds Google Sign-In restricted to RCS accounts.

**Intended outcome:** A production-ready, multi-school bracket challenge app that any of the four RCS middle schools can use independently while competing on a shared district-wide leaderboard, with a polished UI that works well on Chromebooks and classroom projectors.

---

## Scope

Three parallel workstreams that ship together:

1. **Security & auth** — remove exposed secrets, add Google Sign-In, move roles to Firestore
2. **Code refactor** — split App.jsx into components, migrate to Tailwind CSS
3. **UI redesign** — visual overhaul using the approved design system

---

## 1. Security Fixes (do first, before anything else)

### 1.1 Exposed .env file
The `.env` file containing Firebase API keys is committed to a **public** GitHub repo.

**Fix:**
1. Immediately rotate all Firebase API keys in the Firebase Console
2. Remove `.env` from git history: `git filter-repo --path .env --invert-paths`
3. Confirm `.env` is in `.gitignore` (it already is per CLAUDE.md — the file was accidentally committed)
4. Add all env vars to Vercel project settings via `vercel env add`
5. Pull fresh: `vercel env pull .env.local` for local dev

### 1.2 Admin access via DevTools
Any student can open browser DevTools and run `localStorage.setItem('mm_admin', 'true')` to gain full admin access — entering official results, deleting brackets, locking the tournament.

**Fix:** Move all role checks to Firestore-backed auth (see Section 2). After this, `localStorage` flags are not trusted for any access decision.

### 1.3 vercel.json filename casing
File is currently `Vercel.json` (capital V). Vercel's deployment servers run Linux (case-sensitive).

**Fix:** Rename to `vercel.json`.

---

## 2. Authentication & Identity

### 2.1 Replace username system with Google Sign-In

**Current:** Students type a username → stored as Firestore document ID  
**New:** Google OAuth restricted to RCS accounts → Firebase Auth UID used everywhere

**Implementation:**
- Add `getAuth`, `GoogleAuthProvider`, `signInWithPopup` to `firebase.js`
- Restrict login to two domains post-auth (not via `hd` parameter, since students and teachers use different domains):
  ```js
  const allowed = ['rcs-k12.us', 'rochester.k12.mi.us'];
  const domain = user.email.split('@')[1];
  if (!allowed.includes(domain)) {
    await signOut(auth);
    showError('Sign in with your RCS school account.');
  }
  ```
- On successful sign-in, check `users/{uid}` in Firestore for existing profile
- If no profile exists → show onboarding screen (Section 2.2)
- If profile exists → load app normally

**Sign-in UI:** Google Sign In button in the header (already shown in design mockups). Single click, Google popup, done.

### 2.2 Onboarding screen (first login only)

After Google sign-in, first-time users see a single screen:
- Their Google display name shown (editable — some students go by nicknames)
- School selector: **Hart · Van Hoosen · West · Reuther** (4 buttons, one per school)
- "Let's go →" submits and creates their `users/{uid}` doc

Returning users skip this entirely.

### 2.3 Automatic role detection

```
@rochester.k12.mi.us  →  role: 'teacher'
@rcs-k12.us           →  role: 'student'
```

Role is written at onboarding and stored in Firestore. Super admin is a single manual Firestore flag (`superAdmin: true`) set on the operator's UID — no password required.

### 2.4 Firestore user document structure

```
users/{firebaseAuthUID}
  email:        "s.castillo@rochester.k12.mi.us"
  displayName:  "S. Castillo"       ← editable at onboarding
  school:       "hart"              ← set at onboarding
  role:         "teacher"           ← auto-detected from domain
  superAdmin:   true                ← manually set, false by default
  createdAt:    timestamp
```

### 2.5 No UID migration needed

Tournament data resets each season anyway. Old username-keyed brackets from prior seasons are historical artifacts. New season, new Google-Auth-keyed data. No migration script required.

### 2.6 Delete `findBracketByName`

This function scans the entire `brackets` collection to find a user by display name — it only exists because there was no real identity system. With Google Auth it is entirely unnecessary. Delete it.

---

## 3. Multi-School Data Model

### 3.1 Add `school` field to all user-generated documents

Every bracket and leaderboard entry gets a `school` field written at save time, sourced from the authenticated user's `users/{uid}.school`.

```
brackets/{uid}
  bracket:      "..."    ← JSON stringified (unchanged)
  displayName:  "J. Rodriguez"
  school:       "hart"   ← NEW
  updatedAt:    timestamp

leaderboard/{uid}
  displayName:  "J. Rodriguez"
  score:        240
  isTeacher:    false
  school:       "hart"   ← NEW
  updatedAt:    timestamp
```

Same pattern for `brackets_mammals` and `leaderboard_mammals`.

### 3.2 Tournament config — per-school locks

```
tournament/config
  locked:         false         ← global, super_admin only
  school_locks:
    hart:         false         ← teacher for that school
    van_hoosen:   false
    west:         false
    reuther:      false
  year:           2026
  deadline:       timestamp     ← NEW: auto-lock at this time
  bbRegionNames:  { East: "East", ... }

tournament/config_mammals
  locked:         false
  school_locks:   { ... }
```

A student's bracket is locked if `locked === true` OR `school_locks[user.school] === true`.

### 3.3 Leaderboard scoping

- **Default view:** per-school (only your school's entries)
- **Toggle:** "View All Schools" shows district-wide with school badge on each row
- Both views available to all users
- Teachers see their school's view by default with all student names visible

---

## 4. Admin & Teacher Role Capabilities

### 4.1 Super Admin (you — Hart teacher, `superAdmin: true`)

Full access to everything across all schools:
- Enter official results for both tournaments
- Set / apply team and animal rosters
- Trigger AI research generation (gated here — cost control)
- Lock/unlock tournament globally
- Manage all users across all schools
- Set bracket deadline
- Run "New Season" reset
- View district-wide data

### 4.2 Teacher (`role: 'teacher'`, `superAdmin: false`)

School-scoped access:
- Lock/unlock bracket **for their school only** (`school_locks[school]`)
- View their school's students in the Users panel
- Remove a student entry from their school's leaderboard
- View (not edit or regenerate) all research cards
- View district-wide leaderboard
- Cannot enter official results
- Cannot trigger AI generation
- Cannot touch another school's data

### 4.3 Student (`role: 'student'`)

- Fill out bracket (while unlocked)
- View leaderboard (own school default, district toggle)
- View research cards (read-only)
- No admin access

### 4.4 Admin tab restructure

**Super Admin sees:**
- Dashboard (official results, global lock, deadline setter, year, "New Season" button)
- Teams (basketball roster entry + AI sources)
- Animals (mammal roster entry + AI sources)
- Research (generate + edit AI cards)
- Users (all schools, all users, role management)
- Settings (app name, region names)

**Teacher sees:**
- Dashboard (school lock toggle, school stats only)
- Users (their school only — can remove entries)
- Research (read-only view)

### 4.5 New Season button

Replaces the manual 7-step checklist in the Help tab. One button, super admin only, with a confirmation dialog that lists exactly what will be cleared. Runs in sequence:
1. Update year in config
2. Clear basketball roster + official bracket
3. Clear basketball research
4. Clear all basketball user brackets + leaderboard
5. Clear mammal roster + official bracket
6. Clear mammal research
7. Clear all mammal user brackets + leaderboard
8. Unlock all locks (global + all school locks)

---

## 5. Visual Design System

### 5.1 Typography

| Role | Font | Usage |
|---|---|---|
| Display | Playfair Display 700/900 (serif) | Logo, region names, leaderboard title, section headers |
| Body | Lato 400/700/900 | Team names, scores, nav labels, body text |
| Mono | DM Mono 500 | Seeds, round labels, badges, hex codes |

Google Fonts import:
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Lato:wght@400;700;900&family=DM+Mono:wght@500&display=swap');
```

### 5.2 Color tokens

```css
/* Shared */
--paper:      #E4E0D6;   /* page background — aged paper */
--paper-wt:   #F0EDE5;   /* card face background */
--ink:        #1A1714;   /* borders, text */
--ink-mid:    #3D3830;
--ink-low:    #7A7268;
--rule:       #C8C2B4;   /* dividers */

/* Basketball */
--bb-banner:  #0D1B33;   /* midnight navy — header, region headers, lb header */
--bb-accent:  #2563EB;   /* accent stripe on banners */
--bb-win:     #2A7A4F;   /* winner highlight (forest green) */

/* Basketball region bars */
--east:       #1D6AE5;
--west:       #C8302A;
--south:      #1A7A45;
--midwest:    #C87A00;

/* Mammal Madness */
--mm-banner:  #1E3022;   /* deep forest — distinct from basketball */
--mm-accent:  #5A8A3C;   /* leaf green */
--mm-win:     #5A8A3C;

/* Mammal division bars (habitat-inspired) */
--div-predators:  #8B5E3C;   /* warm brown */
--div-herbivores: #6B8B3C;   /* leaf green */
--div-ocean:      #2A6B8B;   /* teal */
--div-nocturnal:  #5C3A8B;   /* violet */
```

### 5.3 Component style rules

- **Game cards:** 2px `--ink` border, `border-radius: 7px`, `box-shadow: 2px 2px 0 var(--ink)`, background `--paper-wt`
- **Hover state:** `transform: translate(-1px, -1px)`, shadow grows to `3px 3px`
- **Winner row:** background `--bb-win` or `--mm-win`, white text, bold
- **Loser row:** `opacity: 0.33`
- **Region header:** ink-colored bar, `--bb-banner` or `--mm-banner` fill, Playfair Display name, DM Mono round badge
- **Leaderboard card:** same border + shadow treatment, banner header matching tournament
- **Connector lines:** SVG paths generated dynamically (see Section 6)
- **Min tap target:** 40px height on all interactive rows (44px preferred)
- **Transitions:** `150ms ease-out` on hover states, `200ms ease-out` on winner highlight

### 5.4 Paper texture

Subtle SVG noise overlay on `body` background at `opacity: 0.055`. CSS only, no image asset needed.

---

## 6. Bracket Connector Lines (React refs approach)

Hardcoded SVG coordinates have caused alignment drift in previous iterations. The fix uses actual DOM measurements.

### 6.1 Implementation pattern

```jsx
// BracketConnector.jsx
import { useRef, useLayoutEffect, useState } from 'react';

export function BracketConnector({ leftGameRefs, rightGameRefs }) {
  const [paths, setPaths] = useState([]);
  const svgRef = useRef(null);

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();

    const newPaths = [];
    // Each pair of left games connects to one right game
    for (let i = 0; i < rightGameRefs.length; i++) {
      const topGame = leftGameRefs[i * 2]?.current;
      const botGame = leftGameRefs[i * 2 + 1]?.current;
      const rightGame = rightGameRefs[i]?.current;
      if (!topGame || !botGame || !rightGame) continue;

      const topRect = topGame.getBoundingClientRect();
      const botRect = botGame.getBoundingClientRect();
      const rightRect = rightGame.getBoundingClientRect();

      const x1 = topRect.right - svgRect.left;
      const y1 = topRect.top + topRect.height / 2 - svgRect.top;
      const y2 = botRect.top + botRect.height / 2 - svgRect.top;
      const xMid = x1 + (rightRect.left - svgRect.left - x1) / 2;
      const yMid = (y1 + y2) / 2;
      const x2 = rightRect.left - svgRect.left;
      const yRight = rightRect.top + rightRect.height / 2 - svgRect.top;

      newPaths.push(
        `M ${x1} ${y1} H ${xMid} V ${yMid}`,          // top arm down to mid
        `M ${x1} ${y2} H ${xMid} V ${yMid}`,          // bottom arm up to mid
        `M ${xMid} ${yMid} H ${x2}`,                  // horizontal to next round
      );
    }
    setPaths(newPaths);
  });  // re-measure on every render (handles resize, content changes)

  return (
    <svg
      ref={svgRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="var(--ink)" strokeWidth="2"
              fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
```

### 6.2 Usage in BracketRegion

Wrap the rounds row in `position: relative`. Pass `ref` arrays for each round's game cards. The connector SVG sits as an absolute overlay and never needs manual coordinates.

---

## 7. Component Architecture

### 7.1 File structure after refactor

```
src/
  main.jsx                     ← unchanged
  App.jsx                      ← thin: auth state + top-level routing only
  firebase.js                  ← add getAuth, GoogleAuthProvider
  firestoreService.js          ← add users CRUD; remove findBracketByName
  bracketData.js               ← CURRENT_YEAR removed (read from Firestore)

  auth/
    AuthContext.jsx            ← React context: user, role, school, superAdmin
    GoogleSignIn.jsx           ← sign-in button + post-auth domain check
    Onboarding.jsx             ← school selector + display name confirm (first login)

  components/
    GameSlot.jsx               ← single matchup (was inline in App.jsx)
    BracketRegion.jsx          ← one region: header + rounds + connectors
    BracketConnector.jsx       ← DOM-measurement SVG connector (Section 6)
    FinalFour.jsx              ← FF games + championship
    FirstFour.jsx              ← play-in game picker
    Leaderboard.jsx            ← per-school + district toggle
    ResearchCard.jsx           ← basketball scouting card
    MammalResearchCard.jsx     ← animal fact card with gallery
    AdminPanel.jsx             ← role-gated wrapper
    ConfirmDialog.jsx          ← reusable confirmation modal
    OfflineBar.jsx             ← offline indicator
    Avatar.jsx                 ← colored initials circle
    TeamLogo.jsx               ← ESPN CDN image with fallback
    ViewBracketModal.jsx       ← read-only bracket for leaderboard view

  pages/
    BracketPage.jsx            ← bracket tab content
    ResearchPage.jsx           ← research tab content
    LeaderboardPage.jsx        ← leaderboard tab content

  admin/
    SuperAdminPanel.jsx        ← full controls
    TeacherPanel.jsx           ← school-scoped controls
    TeamEntryPanel.jsx         ← basketball roster input
    MammalEntryPanel.jsx       ← animal roster input
    UsersPanel.jsx             ← user management (scoped by role)
    NewSeasonFlow.jsx          ← one-button season reset

  styles/
    tokens.css                 ← CSS custom properties (Section 5.2)
    base.css                   ← body, typography, paper texture
```

### 7.2 Tailwind setup

This is a Vite project. Install Tailwind v4 (Vite plugin approach):

```bash
npm install -D tailwindcss @tailwindcss/vite
```

```js
// vite.config.js
import tailwindcss from '@tailwindcss/vite'
export default { plugins: [tailwindcss()] }
```

```css
/* src/styles/base.css */
@import "tailwindcss";
```

CSS custom properties (`tokens.css`) coexist with Tailwind. Use `var(--bb-banner)` in Tailwind's arbitrary value syntax where needed: `bg-[var(--bb-banner)]`.

Remove all inline `style={{}}` objects from App.jsx during refactor. The `S.*` style constants are deleted.

---

## 8. Bug Fixes

| Bug | Fix |
|---|---|
| `isAdmin` reads localStorage (exploitable) | Read from `AuthContext` role instead |
| `calcScore` in render path | Wrap in `useMemo(calcScore, [bracket, officialBracket])` |
| Live score display on mammal bracket | Gate `findLiveScore` calls behind `activeTournament === 'basketball'` check |
| `beforeunload` — unsaved picks lost | Add `window.beforeunload` handler when `hasPendingChanges` ref is true |
| `CURRENT_YEAR = 2025` hardcoded | Remove constant; read `year` from `tournament/config` Firestore doc |
| `Vercel.json` wrong case | Rename to `vercel.json` |
| Claude model fallback chain | Simplify to `claude-haiku-4-5-20251001` only; remove stale fallbacks |

---

## 9. New Features

### 9.1 Bracket lock deadline + countdown

Add `deadline` timestamp to `tournament/config`. Header shows countdown: "Bracket closes in 2d 4h 12m". Client-side check auto-treats bracket as locked when `Date.now() > deadline`. Admin can still override with manual lock.

### 9.2 Research cards — print view

```css
@media print {
  header, nav, .admin-controls { display: none; }
  .research-card { break-inside: avoid; page-break-after: always; }
  .gallery { display: none; }
}
```

Visible to all users. Teachers can print animal fact cards or team scouting cards for classroom use.

### 9.3 District-wide leaderboard toggle

Leaderboard component has two modes toggled by a button:
- **My School** (default): filters to `school === currentUser.school`
- **All Schools**: shows all entries with a school badge chip on each row

### 9.4 Per-school bracket lock for teachers

Teacher dashboard shows a single "Lock My School's Bracket" / "Unlock" toggle. Writes to `tournament/config.school_locks[school]`. Separate from the global lock which only super_admin controls.

---

## 10. Privacy Policy Updates

The Privacy Policy must be fully rewritten before launch with Google Auth. Key changes:

- **App name:** "Rochester Community Schools Bracket Challenge" (remove Hart-specific name)
- **Operator:** Update to reflect multi-school operation
- **Data collected:** Add Google account email and profile name (currently falsely states "no credentials collected")
- **COPPA:** Explicitly state that student Google accounts are school-managed under RCS's Google Workspace for Education enterprise agreement, providing institutional COPPA coverage for users under 13
- **Google Auth:** Replace "No Google Sign-In" with accurate description of sign-in flow
- **Data retention:** Clarify that Firebase Auth UIDs persist across seasons while bracket data is cleared annually
- **Contact:** Update with accurate operator contact information

---

## 11. Verification Plan

### Before auth goes live
- [ ] Firebase keys rotated, old keys confirmed invalid
- [ ] `.env` removed from git history, no longer visible in GitHub UI
- [ ] Vercel env vars set and app builds/runs on `vercel dev`

### Auth verification
- [ ] Sign in with `@rcs-k12.us` student account → lands in app as student role
- [ ] Sign in with `@rochester.k12.mi.us` teacher account → lands as teacher role
- [ ] Sign in with personal Gmail → rejected with error message
- [ ] First login shows onboarding screen; second login skips it
- [ ] `users/{uid}` doc created with correct role + school
- [ ] `localStorage.setItem('mm_admin', 'true')` in DevTools has zero effect on admin access

### Role verification
- [ ] Student cannot see admin tab
- [ ] Teacher can see teacher dashboard, cannot see official results entry
- [ ] Teacher can lock their school's bracket without affecting other schools
- [ ] Super admin can do everything
- [ ] Editing a research card only available to super admin

### Multi-school verification
- [ ] Two accounts from different schools see only their school in leaderboard (default)
- [ ] Both see all schools when "All Schools" toggled
- [ ] Bracket saved by school A does not appear in school B's user list
- [ ] Teacher from school A cannot delete a student from school B

### Bracket connector verification
- [ ] With short team names (e.g., "Duke"): connectors align to card centers
- [ ] With long names (e.g., "North Carolina A&T"): connectors still align
- [ ] With emoji animal names (e.g., "🐆 Snow Leopard"): connectors align
- [ ] On window resize: connectors reposition correctly
- [ ] On mobile (375px width): bracket scrolls, connectors remain aligned within visible portion

### Design system verification
- [ ] Both tournament palettes render correctly side by side
- [ ] Print CSS produces clean one-card-per-page output
- [ ] Countdown timer counts down and matches lock behavior
- [ ] `prefers-reduced-motion` suppresses card hover animations
- [ ] All interactive elements have visible focus rings (keyboard nav)
- [ ] Text contrast passes 4.5:1 on both paper and banner backgrounds

---

## 12. Out of Scope (this iteration)

- Shareable bracket URLs (`/bracket/{uid}`)
- Push notifications for leaderboard changes
- Mobile-optimized bracket layout (horizontal scroll is acceptable for now)
- Bracket entry deadlines per-class-period (global + school locks cover this)
- Score tiebreaker on championship game prediction (exists in data model, not surfaced in leaderboard sorting)
