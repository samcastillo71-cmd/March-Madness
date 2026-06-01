# RCS Bracket Challenge — Project Handoff

This is a living document. Each session appends a new entry. Start from the **bottom** for the most recent state.

---

## Handoff: 2026-06-01

### Current Task State

**Phase 0 complete and deployed to production. Phase 1 complete and committed to `feature/overhaul` branch. Phase 1 verified working in dev (Google Sign-in screen confirmed in browser). NOT yet pushed to GitHub or deployed.**

Branch: `feature/overhaul` (1 commit ahead of `origin/main`)
Last commit: `258ad0e feat: Phase 1 — Google Auth, user CRUD, school field, auth gate`

Phase 0 (all shipped to `main` + Vercel production):
- ✅ `.env` removed from git history, force pushed
- ✅ `vercel.json` casing fixed, `CURRENT_YEAR` removed
- ✅ Claude model simplified to `claude-haiku-4-5-20251001` in `api/generate.js`
- ✅ Firebase ID token auth added to `api/generate.js` (RCS accounts only, sources capped at 5)
- ✅ Firestore security rules deployed (no self-superAdmin, owner-only bracket writes)
- ✅ Old plaintext admin password doc (`admin/auth`) should be manually deleted in Firestore console

Phase 1 (committed to `feature/overhaul`, NOT pushed):
- ✅ `firebase.js` exports `auth` + `googleProvider`
- ✅ `firestoreService.js`: users CRUD, `school`/`uid` fields on all writes, `findBracketByName` removed, school lock + deadline functions added
- ✅ `src/auth/AuthContext.jsx` — Firebase Auth, RCS domain check, live user doc subscription
- ✅ `src/auth/GoogleSignIn.jsx` — Google sign-in button with domain error
- ✅ `src/auth/Onboarding.jsx` — school selector (Hart, Van Hoosen, West, Reuther)
- ✅ `App.jsx` — auth gate replaces username flow; old `if (!uid)` block left as unreachable dead code
- ✅ `main.jsx` — wrapped in `AuthProvider`
- ✅ Dev server verified: Google Sign-in screen showing correctly at localhost:5177

---

### Key Decisions

- **Google Auth over username system**: Firebase Auth + Google Sign-In restricted to `@rcs-k12.us` (students) and `@rochester.k12.mi.us` (teachers/staff). Domain check is post-auth in AuthContext AND enforced server-side via Firestore rules on `request.auth.token.email`.
- **`needsOnboarding` fix**: Correct formula is `isLoggedIn && !loading && !userDoc?.school` — original plan had a bug (`userDoc !== null` inverted for new users).
- **`superAdmin` is a manual Firestore flag**: Set directly in Firestore Console on `users/{uid}` → `superAdmin: true`. No UI to grant it.
- **`uid` stored in leaderboard docs**: `updateLeaderboardEntry` now writes `uid` as a field (not just document ID) so `Leaderboard.jsx` can read `entry.uid` for "my entry" highlight.
- **`role` field protected**: `createOrUpdateUser` merge path does NOT overwrite `role` — only the initial create sets it. Firestore rules also block client-side role self-escalation.
- **`firebase/auth` dynamic import in App.jsx**: `handleSignOut` uses `import('firebase/auth').then(...)` — harmless since `auth` module is already statically imported elsewhere.
- **UI overhaul (previous session) was lost**: A previous session did visual work that was never committed. Phase 2 of the plan covers a full visual redesign (Playfair Display, paper background, Tailwind v4) — this replaces that lost work.
- **Plan was revised this session**: `docs/superpowers/plans/2026-05-31-overhaul.md` was updated with all council + security review findings (Task 0.4 added, Task 0.5 added, needsOnboarding fixed, GameSlot constants specified, BracketConnector scroll fix, etc.)

---

### Modified Files (this session)

**Phase 0 (on `main`, pushed and deployed):**
- `api/generate.js` — auth header check, model simplified, sources capped
- `src/App.jsx` — removed `CURRENT_YEAR` import/usage
- `src/bracketData.js` — removed `CURRENT_YEAR` export
- `vercel.json` — kept (lowercase); `Vercel.json` deleted
- `firestore.rules` — created and deployed via Firebase Console (not in git)
- `docs/superpowers/plans/2026-05-31-overhaul.md` — major revision with all security/council fixes

**Phase 1 (on `feature/overhaul`, NOT pushed):**
- `src/firebase.js` — added `auth`, `googleProvider` exports
- `src/firestoreService.js` — users CRUD, school/uid fields, school locks, deadline, removed `findBracketByName` + admin password functions
- `src/auth/AuthContext.jsx` — new file
- `src/auth/GoogleSignIn.jsx` — new file
- `src/auth/Onboarding.jsx` — new file
- `src/main.jsx` — wrapped in `AuthProvider`
- `src/App.jsx` — auth gate, removed username/admin-password state + screens, school passed to all saves

---

### Blockers / Open Questions

- **`feature/overhaul` not pushed to GitHub yet** — push before starting Phase 2
- **`admin/auth` Firestore doc** (old plaintext password) — should be deleted manually in Firebase Console if not done yet: Firestore → `admin` collection → `auth` document → Delete
- **Firebase Auth domains** — `march-madness-tournament.firebaseapp.com` must be in Firebase Console → Authentication → Settings → Authorized domains. Add the Vercel production domain too.
- **`api/generate.js` token passing from client** — the server now requires a Bearer token, but App.jsx still calls `/api/generate` without one (client-side token passing is in Task 1.5 but wasn't completed — the `fetch` calls in App.jsx still need `Authorization: Bearer ${await firebaseUser.getIdToken()}` headers added). AI generation will return 401 until this is wired.
- **Old `if (!uid)` dead code in App.jsx** — still present as an unreachable fallback. Should be removed in Phase 2 cleanup.

---

### Next Steps

1. **Push `feature/overhaul` to GitHub**: `git push -u origin feature/overhaul`
2. **Fix `api/generate.js` client token**: Find all `fetch('/api/generate', ...)` calls in App.jsx and add `Authorization: Bearer ${await firebaseUser.getIdToken()}` header — `firebaseUser` comes from `useAuth()`
3. **Add Vercel production domain to Firebase Auth authorized domains**: Firebase Console → Authentication → Settings → Authorized domains → add `march-madness-ruby.vercel.app`
4. **Start Phase 2**: Tailwind v4 install + design tokens (Task 2.1), then BracketConnector (Task 2.2), GameSlot extraction (Task 2.3), BracketRegion (Task 2.4)
5. **Phase 3**: AdminPanel, SuperAdminPanel, TeacherPanel, NewSeasonFlow
6. **Phase 4**: Deadline countdown, Privacy Policy, final deploy

---

### Critical Context

- **`feature/overhaul` branch**: All Phases 1–4 go here. Deploy together at the end. Do NOT merge to `main` until all 4 phases are complete.
- **App.jsx still has old admin password code references** (`checkAdminPassword`, `adminExists`, `setAdminPassword` imported from firestoreService) — these were NOT removed from firestoreService.js yet (they're dead but still exported). Remove in Phase 2 cleanup.
- **`handleOpenAdmin` in App.jsx** still calls `adminExists()` and `setShowAdminLogin(true)` — these reference removed state. This will cause a runtime error if the admin button is clicked. The admin tab will be replaced in Phase 3 anyway, but be aware it's broken in the interim.
- **Dev server env**: `.env.local` was pulled via `vercel env pull .env.local` — this file exists locally and is gitignored. The dev server needs it to run.
- **The 400-line App.jsx goal** in Task 4.3 is not achievable as written — plan notes it will be ~700-900 lines after all Phase 2 extractions. That's acceptable.
- **`superAdmin` must be set manually**: After first sign-in with the operator's Google account (`sam.castillo71@gmail.com`), go to Firestore → `users/{uid}` → add field `superAdmin: true`. The UID appears in the Firebase Auth console after first sign-in.
- **Firestore rules are live on production** but NOT committed to the repo. The `firestore.rules` file mentioned in Task 0.4 should be created in the repo and committed.

---

### Model Summary

- **Goal**: Overhaul RCS Bracket Challenge — Google Auth, multi-school (Hart/Van Hoosen/West/Reuther), visual redesign, role-based admin
- **Phase 0**: Complete, deployed to production (`main` branch, Vercel)
- **Phase 1**: Complete, working in dev, committed to `feature/overhaul` — NOT pushed to GitHub
- **Phases 2–4**: Not started
- **Auth**: Google Sign-in working in browser; RCS domain check in AuthContext + Firestore rules; Onboarding school selector wired
- **Blocker**: Client-side token not passed to `/api/generate` — AI generation returns 401
- **Blocker**: Firebase Auth authorized domains need the Vercel prod URL added
- **Key file**: `docs/superpowers/plans/2026-05-31-overhaul.md` — revised with all security fixes, ~1900 lines, full code for all remaining phases
- **Dev server**: requires `.env.local` (gitignored, pull with `vercel env pull .env.local`)
- **superAdmin setup**: must be set manually in Firestore after operator's first Google sign-in
- **Visual overhaul**: Phase 2 will implement the full Playfair Display + paper background + Tailwind v4 redesign — previous session's lost UI work is replaced by this

---

### Handoff Context (paste into next session)

```
I'm working on the RCS Bracket Challenge app — a school bracket-picking web app for
4 Rochester Community Schools middle schools (Hart, Van Hoosen, West, Reuther).

Repo: samcastillo71-cmd/March-Madness (public)
Local clone: D:\Projects\March-Madness
Branch: feature/overhaul (NOT pushed to GitHub yet — push first)
Tech stack: React 18, Vite 5, Firebase 10 (Firestore + Auth), Vercel

CURRENT STATUS:
- Phase 0 (security hotfix): COMPLETE, deployed to production
- Phase 1 (Google Auth): COMPLETE, committed to feature/overhaul, NOT pushed
- Phases 2-4: NOT started

IMMEDIATE FIXES NEEDED BEFORE PHASE 2:
1. Push branch: git push -u origin feature/overhaul
2. Add /api/generate auth header: find all fetch('/api/generate') calls in App.jsx
   and add: Authorization: `Bearer ${await firebaseUser.getIdToken()}`
   firebaseUser comes from useAuth()
3. Firebase Console → Authentication → Settings → Authorized domains →
   add march-madness-ruby.vercel.app

THEN START PHASE 2:
- Task 2.1: Tailwind v4 install + design tokens (rm tailwind.config.js first)
- Task 2.2: BracketConnector (DOM-measured, ResizeObserver, offsetLeft not getBoundingClientRect)
- Task 2.3: GameSlot extraction (resolve ACCENT2/ROUND_COLORS/GOLD2 constants first)
- Task 2.4: BracketRegion (GAME_GAP=48px for Compare button)
- Task 2.5-2.6: remaining component extraction, App.jsx thinning

PLAN: docs/superpowers/plans/2026-05-31-overhaul.md (revised with all fixes)
SPEC: docs/superpowers/specs/2026-05-30-overhaul-design.md

KEY GOTCHAS:
- superAdmin must be set manually in Firestore after operator's first sign-in
- handleOpenAdmin in App.jsx is broken (references removed state) — replace in Phase 3
- admin/auth Firestore doc (old plaintext password) should be deleted manually
- firestore.rules not committed to repo — create the file and commit it
- Dev server needs .env.local (run: vercel env pull .env.local)
```

---

## Handoff: 2026-05-31

### Current Task State

**Planning phase complete. No code has been written yet.** This was a full design and planning session. Two documents were produced and committed to `main`:

- `docs/superpowers/specs/2026-05-30-overhaul-design.md` — the full design spec
- `docs/superpowers/plans/2026-05-31-overhaul.md` — the step-by-step implementation plan

The repo is cloned locally at `D:\Projects\March-Madness`. The live production app is at the Vercel deployment connected to `samcastillo71-cmd/March-Madness`. The app is live and being used — **Phase 0 of the plan should be the first thing executed** (security hotfix, ships to production immediately).

---

### Key Decisions

- **Google Auth over username system**: Replace typed-username identity with Google Sign-In restricted to `@rcs-k12.us` (students) and `@rochester.k12.mi.us` (teachers/staff). Post-auth email-domain check (not `hd` param) because two domains are needed.
- **Auto role detection from email domain**: `@rochester.k12.mi.us` → `teacher`, `@rcs-k12.us` → `student`. `superAdmin` is a manual Firestore flag on the operator's UID.
- **No UID migration**: Tournament data resets each season anyway. Old username-keyed documents become irrelevant at season start. No migration script.
- **School selector at onboarding**: All RCS students share `@rcs-k12.us` — the domain doesn't distinguish between Hart, Van Hoosen, West, Reuther. A one-time school selector screen at first login stores `school` in `users/{uid}`.
- **Four schools**: Hart, Van Hoosen, West, Reuther (all Rochester Community Schools middle schools). Firestore keys: `hart`, `van_hoosen`, `west`, `reuther`.
- **Visual design**: Playfair Display (headings) + Lato (body) + DM Mono (mono/labels). Paper background `#E4E0D6`. Basketball: midnight navy `#0D1B33` banners, forest green `#2A7A4F` winner highlight. Mammal Madness: deep forest `#1E3022` banners, leaf green `#5A8A3C` winner, earthy division colors.
- **Bracket connector lines**: DOM measurement via React refs + `useLayoutEffect` (not hardcoded SVG coordinates). `BracketConnector.jsx` re-measures after every render. `GAME_GAP = 48px` between paired game cards to fit the Compare button.
- **Tailwind v4**: Uses `@tailwindcss/vite` plugin (not the old PostCSS config approach). CSS custom properties in `src/styles/tokens.css` coexist with Tailwind utilities.
- **Claude model**: `claude-haiku-4-5` (no date suffix) in `api/generate.js`. Fallback chain removed.
- **Admin structure**: `AdminPanel.jsx` is a role gateway → `SuperAdminPanel` (full access) or `TeacherPanel` (school-scoped: lock/unlock own school, view own students). `NewSeasonFlow` is a single-button season reset (replaces the 7-step manual checklist).

---

### Modified Files (this session — not yet pushed)

The following are in `docs/` only. No source code has been changed yet:

- `docs/superpowers/specs/2026-05-30-overhaul-design.md` — has one unstaged change (minor wording fix to the Claude model ID note)
- `docs/superpowers/plans/2026-05-31-overhaul.md` — committed, clean

**Source files not yet touched:**
`src/App.jsx`, `src/firebase.js`, `src/firestoreService.js`, `api/generate.js`, `vite.config.js`, `Vercel.json`

---

### Blockers / Open Questions

- **`.env` in public repo**: The file appears committed to the public `samcastillo71-cmd/March-Madness` repo. Firebase keys are likely exposed. **This is the first thing to fix** — Task 0.1 in the plan. Rotate keys immediately.
- **School names confirmed**: Hart, Van Hoosen, West, Reuther — confirmed by the teacher directly.
- **Exact participating schools**: Operator (S. Castillo, Hart MS) confirmed all four. Plan reflects these.
- **Vercel project linked**: The repo deploys on Vercel but `vercel link` hasn't been run locally yet. Run it from `D:\Projects\March-Madness` before doing any `vercel env` commands.

---

### Next Steps

1. **Rotate Firebase keys immediately** (keys are exposed in the public repo)
2. **Run `vercel link`** from `D:\Projects\March-Madness` to connect the local clone to the Vercel project
3. **Execute Phase 0** (Tasks 0.1–0.3): remove `.env` from history, rotate keys, fix `vercel.json`, simplify Claude model — deploy to production
4. **Create feature branch**: `git checkout -b feature/overhaul`
5. **Execute Phase 1** (Tasks 1.1–1.5): Firebase Auth, firestoreService updates, AuthContext, GoogleSignIn, Onboarding, wire into App.jsx
6. **Execute Phase 2** (Tasks 2.1–2.6): Tailwind, design tokens, component extraction, BracketConnector, BracketRegion with compare gaps, Leaderboard
7. **Execute Phase 3** (Task 3.1): AdminPanel, SuperAdminPanel, TeacherPanel, NewSeasonFlow
8. **Execute Phase 4** (Tasks 4.1–4.3): deadline countdown, Privacy Policy update, final verification, deploy

Use the `superpowers:subagent-driven-development` or `superpowers:executing-plans` skill when ready to implement.

---

### Critical Context

- **Live app, real students**: The app is in production and being used by students. Phase 0 must ship as a hotfix to `main` immediately. All other phases go on `feature/overhaul` and deploy together.
- **`.env` security**: The `.env` file was accidentally committed to the public repo. All Firebase API keys must be rotated before any implementation work. Use `git filter-repo --path .env --invert-paths --force` then `git push --force-with-lease`.
- **No backward compat needed**: Old username-keyed Firestore documents (`brackets/jrodriguez`) are intentionally abandoned. Season resets annually, new season starts clean under Firebase Auth UIDs.
- **`findBracketByName` must be deleted**: This function scans the entire `brackets` collection. It only exists because there was no real auth. Delete it entirely — no replacement needed.
- **`isAdmin` from localStorage is the current security hole**: Any student can run `localStorage.setItem('mm_admin', 'true')` in DevTools. This is fixed by moving all role checks to `useAuth()` from AuthContext.
- **Two Firebase exports**: After Task 1.1, `firebase.js` exports three things: `db`, `auth`, `googleProvider`. Components that only need Firestore should still import `db`. Don't import `auth` everywhere.
- **Tailwind v4 is different from v3**: Uses `@tailwindcss/vite` plugin, no `tailwind.config.js` needed, CSS is `@import "tailwindcss"` not `@tailwind base/components/utilities`. Do not follow v3 docs.
- **`GAME_GAP = 48` in BracketRegion**: The gap between paired game cards is 48px — this is intentional to fit the Compare button (28px) with 10px padding above/below. Do not reduce it.
- **BracketConnector re-measures on every render**: No dependency array on `useLayoutEffect` is intentional. It needs to respond to any content size change. This is not a bug.
- **Two tournament palettes, one design system**: Basketball uses navy/blue/forest-green. Mammal Madness uses deep-forest/leaf-green/earthy-divisions. Both sit on the same paper background and use the same card component. The `isMammal` prop controls which palette applies.
- **School identity gap**: Email domain can't distinguish which of the 4 schools a student attends (`@rcs-k12.us` is used by all RCS students). The `Onboarding.jsx` school-selector screen at first login is the only mechanism. Do not skip it.
- **`superAdmin` flag is manually set**: There is no UI to grant super admin. Set it directly in Firestore: `users/{uid}` → `superAdmin: true`. The operator's UID is from their Google account.

---

### Model Summary

- **Goal**: Overhaul `samcastillo71-cmd/March-Madness` — a school bracket challenge app expanding from 1 to 4 middle schools (Hart, Van Hoosen, West, Reuther, Rochester Community Schools MI)
- **Status**: Planning complete. Zero source code changed. Spec + implementation plan committed to `main`.
- **Immediate priority**: Rotate exposed Firebase keys (`.env` committed to public repo)
- **Auth**: Replace username typing with Google Sign-In; two RCS domains; auto role detection; school selector at onboarding; `superAdmin` is a Firestore flag
- **Design**: Playfair Display + Lato + DM Mono; paper `#E4E0D6`; midnight navy `#0D1B33` BB banners; deep forest `#1E3022` MM banners; approved through iterative visual companion mockups
- **Architecture**: App.jsx (2245 lines, all inline styles) → split into 20+ components + Tailwind CSS v4
- **Bracket connectors**: DOM-measurement approach via `BracketConnector.jsx`; `GAME_GAP = 48px` for Compare button between paired games
- **Security fixed by plan**: `.env` history removal, `localStorage` admin exploit, vercel.json casing, Claude model chain simplification
- **Multi-school**: `school` field on all Firestore docs; per-school + global bracket locks; per-school leaderboard default + district toggle; `AdminPanel` → `SuperAdminPanel` or `TeacherPanel` based on role
- **New features**: Bracket deadline countdown, New Season one-button reset, research card print view, district leaderboard toggle
- **Plan file**: `docs/superpowers/plans/2026-05-31-overhaul.md` — 4 phases, 19 tasks, ~1800 lines with full code

---

### Handoff Context (paste into next session)

```
I'm working on the RCS Bracket Challenge app — a school bracket-picking web app for
4 Rochester Community Schools middle schools (Hart, Van Hoosen, West, Reuther).

Repo: samcastillo71-cmd/March-Madness (public)
Local clone: D:\Projects\March-Madness
Tech stack: React 18, Vite 5, Firebase 10 (Firestore + will add Auth), Tailwind v4, Vercel

CURRENT STATUS: Planning is done. No code changed yet. We need to start implementation.

FIRST: The .env file with Firebase keys is committed to the public repo.
Rotate keys immediately (Task 0.1 in the plan).

DOCUMENTS:
- Spec:  docs/superpowers/specs/2026-05-30-overhaul-design.md
- Plan:  docs/superpowers/plans/2026-05-31-overhaul.md
- This handoff: docs/handoff/HANDOFF.md

PLAN PHASES:
- Phase 0 (security hotfix — ship to main immediately): rotate keys, vercel.json fix, Claude model
- Phase 1 (feature branch: feature/overhaul): Google Auth, firestoreService, AuthContext
- Phase 2: Tailwind, component split, BracketConnector (DOM measurement), BracketRegion
- Phase 3: role-based admin (SuperAdmin / Teacher / Student)
- Phase 4: deadline countdown, Privacy Policy, final deploy

KEY DECISIONS ALREADY MADE (do not re-litigate):
- Google Auth: @rcs-k12.us (students), @rochester.k12.mi.us (teachers), post-auth domain check
- No UID migration — data resets each season, start clean under Firebase Auth UIDs
- Playfair Display + Lato + DM Mono fonts, paper #E4E0D6 background
- BB banners: #0D1B33 navy. MM banners: #1E3022 forest. Winner: forest/leaf green.
- BracketConnector uses DOM refs, not hardcoded SVG coordinates
- GAME_GAP = 48px between game pairs to fit the Compare button
- Tailwind v4 (@tailwindcss/vite, not PostCSS)
- Claude model in api/generate.js: claude-haiku-4-5 (no date suffix, no fallback chain)
- superAdmin is a manual Firestore flag — no UI to grant it

To start: invoke superpowers:subagent-driven-development or superpowers:executing-plans,
then work through the plan starting at Task 0.1.
```

---
