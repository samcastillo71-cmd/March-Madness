# Handoff Log — March Madness Bracket Challenge

---

## Handoff: 2026-06-07 — BRACKET VISUAL POLISH + MAMMAL BUG FIX

### Current State
**Committed and pushed to `main` (commit `ec23aa2`). Vercel deploy triggered. Live at `march-madness-ruby.vercel.app`.**

### What Was Done This Session (Jun 7)

| Item | Status |
|---|---|
| Connector lines showing through tiles: added `background: '#E8E2D8'` to game slot wrapper divs (opaque cover) | ✅ |
| Mammal bracket picks filling in basketball teams: race condition between `loadMammalBracket` and `subscribeToMammalOfficialBracket`. Fixed with `cancelled` flag + `isAdmin` guard. Non-admin only gets basketball initial state cleared if they have no animal teams yet | ✅ |
| Connector rounded joins: switched from `<polyline strokeLinejoin="round">` (invisible at 3px stroke width) to `<path>` with explicit quadratic bezier curves at 5px corner radius | ✅ |
| Round header floating bar: removed broken `position: sticky` (was fighting scroll inside `transform: scale()` ancestor and covering R64 tiles). Header now scrolls with bracket. Kept glass/shadow visual. | ✅ |
| R64 tile spacing: `SH` increased 116→126, giving 16px gap between tiles (was 6px). `ROUND_ABS` made dynamic from SH. | ✅ |
| Championship tile too small: `ScaledGame` now accepts `innerW` prop. Championship uses `innerW={300}` (375px displayed at 1.25x). Horizontal Team gets `flex: 1` + name truncation. Score inputs 44→36px. | ✅ |
| Championship glow effect: radial gold gradient (`rgba(196,149,42,0.08)`) on bracket container background, centered at championship position. Visible through column gutters. | ✅ |

### Architecture Notes

**Bracket layout constants (`renderBracket`):**
- `SH = 126` (slot height, up from 116)
- `TOP_H = 8 * SH = 1008`
- `FF_GAP = Math.floor(SH / 2) = 63`
- `FF_H = Math.round(SH * FF_SCALE) = 157`
- `FF_W = Math.round(CW * FF_SCALE) = 263`
- `ROUND_ABS` is now 4 arrays derived from SH at render time — do NOT hardcode these again

**Connector geometry (`BracketConnectors`):**
- `CR = 5` (corner radius constant, local to BracketConnectors)
- Each bracket connector is a `<path>` with two quadratic beziers per connector arm
- `topPath`: `M xFrom,y1 H xStub-sdx*CR Q xStub,y1 xStub,y1+s1*CR V yMid-s1*CR Q xStub,yMid xStub+sdx*CR,yMid H xParent`
- `botPath`: `M xFrom,y2 H xStub-sdx*CR Q xStub,y2 xStub,y2+s2*CR V yMid`
- E8→FF connectors use the same pattern (two elbows, one path each)

**Championship sizing:**
- `ScaledGame` component signature: `({ children, innerW })` — `innerW` defaults to `CW=210` if omitted
- Championship passes `innerW={300}` → displayed width `Math.round(300 * 1.25) = 375px`
- Championship card `minWidth: Math.round(300 * FF_SCALE) + 40`
- Horizontal Team: `flex: 1`, `minWidth: 80`, `padding: '10px 10px'`; name span has `overflow: hidden, textOverflow: ellipsis, whiteSpace: nowrap`

**Mammal bracket non-admin initialization (`subscribeToMammalOfficialBracket` callback):**
- `isAdmin` receives official bracket directly (no check)
- Non-admin: `setMammalBracket(prev => ...)` — only replaces prev if `!hasAnimalTeams` (no team without `espnId`). If they have animal picks already, prev is kept unchanged.
- The `cancelled` flag in the `useEffect([uid, isAdmin])` prevents the Firestore `loadMammalBracket` read from overwriting state after subscription sets it.

### Remaining Deferred Items
- Inspect in browser whether all connector paths look geometrically correct at both bracket orientations (top/bottom halves have mirrored Y-axis via `getMid`)
- Possible: region labels are still not visible (noted earlier, deprioritized) — check if they're present and just need a z-index bump
- `window.confirm()` in teacher remove-student (~line 2840) — can upgrade to `ConfirmDialog`
- Mobile header collapse (not urgent)

---

## Handoff: 2026-06-05 — UI AUDIT COMPLETE + DEPLOYED

### Current State
**All changes merged to `main` and live on production (`march-madness-ruby.vercel.app`).** PR #2 merged (commit `8d34bfb`). `ui-audit-polish` branch deleted.

### What Was Done This Session (Jun 4–5)

| Item | Status |
|---|---|
| Seed-matchup picker (basketball): 16-button blob → 8 paired `1fr/vs/1fr` matchup rows (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15) | ✅ |
| Seed-matchup picker (mammal): same layout for all 4 regions | ✅ |
| First Four handling in picker: seeds with 2 teams render as stacked button pairs | ✅ |
| ResearchCard Team Stats: 7-item orphaned grid → numeric chips (Rank, KenPom, Offense, Defense, Pace) + Coach/Conference text row | ✅ |
| `alert()` → inline errors: all 9 blocking dialogs replaced across TeamEntryPanel, MammalEntryPanel, admin year update, teacher roster, mark-as-teacher | ✅ |
| PR #2 merged to `main`, deployed to production | ✅ |

### Architecture Notes

**Matchup picker:** Both pickers are IIFE blocks that build a `bySeed` map, then iterate `R64_SEED_MATCHUPS` (imported from `bracketData.js`) to render 8 rows. Each row: `gridTemplateColumns: '1fr 28px 1fr'`. First Four seeds with 2 teams render as stacked buttons (`flexDirection: column, gap: 3`). Selected button gets navy/green fill; unselected gets `rgba(9,24,40,0.06)`.

**ResearchCard stats:** 5 numeric chips (`flex: '1 1 52px'`, `fontSize: 18`, `fontVariantNumeric: 'tabular-nums'`) above a 2-col grid for Coach/Conference. Admin mode renders `EditableField` in chip slots.

**Inline errors:** Each location has its own state variable. Error clears on next successful action. Pattern: `padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171'` + `<AlertTriangle size={13} />`. Mark-as-Teacher also has a green success variant.

### Remaining Deferred Items
- `window.confirm()` in teacher remove-student (line ~2840) — could be upgraded to the existing `ConfirmDialog` component
- Mobile header collapse (not urgent — students use Chromebooks)
- Icon library: Lucide → Phosphor (non-trivial swap, low urgency)

---

## Handoff: 2026-06-04 (evening) — RESEARCH TAB ITEMS 4 + 6

### Current State
**All changes committed on `ui-audit-polish` branch (building on commit 9ec2547). NOT pushed, NOT deployed.**

### What Was Done This Session

| Item | Status |
|---|---|
| Item 4 — Seed-matchup picker (basketball): 16-button blob replaced with 8 paired `1fr/vs/1fr` grid rows (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15) | ✅ |
| Item 4 — Seed-matchup picker (mammal): same matchup-row layout for all 4 mammal regions | ✅ |
| Item 4 — First Four handling: seeds with 2 teams render as stacked buttons within their matchup slot | ✅ |
| Item 6 — ResearchCard Team Stats: 7-item 2-col grid replaced with numeric stat chips (Rank, KenPom, Offense, Defense, Pace) + Coach/Conference text row | ✅ |
| `R64_SEED_MATCHUPS` imported into App.jsx from bracketData.js | ✅ |

### Architecture Notes

**Matchup picker structure:** Both basketball and mammal pickers are now IIFE blocks that build a `bySeed` map from `bbTeamsByRegion`/`mammalAnimalsByRegion`, then iterate `R64_SEED_MATCHUPS` to render 8 rows. Each row is a `gridTemplateColumns: '1fr 28px 1fr'` grid with the home team column, a "vs" label, and the away team column. First Four seeds with 2 teams at the same seed render as stacked buttons (`flexDirection: column, gap: 3`) in their slot. Selected button gets navy/green fill; unselected gets the subtle `rgba(9,24,40,0.06)` fill.

**ResearchCard stats layout:** Numeric stats (Rank, KenPom, Offense, Defense, Pace) are now `flex: '1 1 52px'` chip tiles with `fontSize: 18` bold value display and `fontVariantNumeric: 'tabular-nums'`. Admin mode renders `EditableField` in place of the value div. Coach and Conference remain as the original `1fr 1fr` grid below the chips, using the existing `field()` helper. Zero orphaned cells.

### Build Status
- `npm run build` — PASSES clean (pre-existing chunk size warning only)
- Branch: `ui-audit-polish`
- NOT pushed. NOT deployed. Push and merge PR #2 to deploy.

### Remaining Deferred Items
- `alert()` → inline errors in admin panels (8 occurrences: lines ~783, 784, 988, 989, 1734, 2751, 2763, 2977, 2980)
- Mobile header collapse (not urgent)
- Icon library: Lucide → Phosphor (non-trivial swap, low urgency)

---

## Handoff: 2026-06-04 — UI AUDIT PASS 2: BANNER FIXES, BRACKET SPACING, RESEARCH TAB POLISH

### Current State
**All changes committed on `ui-audit-polish` branch (commit 9ec2547). NOT pushed, NOT deployed.** Build passes clean. PR #2 is still open — this session's commit is on top of it. Push and merge when ready to deploy.

### What Was Done This Session

| Item | Status |
|---|---|
| Bracket tile gap: SH 120→136, ROUND_ABS recalculated — 10px gap between tiles | ✅ |
| Basketball ResearchCard banner: swap blurry ESPN crop URL for crisp square logo, right-side positioned at 85% opacity with text-protective gradient | ✅ |
| MammalResearchCard banner: wiki photo moved to right half (42% opacity), phylopic silhouette boosted to 48%, gradient updated | ✅ |
| `100vh` → `100dvh` across all 7 full-height containers | ✅ |
| `aria-label="Main navigation"` on `<nav>` | ✅ |
| Research tab compare: promoted to persistent header button on both hubs; old buried ghost button removed | ✅ |
| Research tab: all dark-mode color tokens purged from compare picker panels, progress bars, mammal animal buttons | ✅ |
| Mammal hub h2: `#86efac` (low-contrast) → `GREEN` (`#1A4332`) | ✅ |
| Mammal animal picker buttons: `#16a34a` → `GREEN`, `#aaa` → `#7A7068` | ✅ |
| Battle videos: single-column stack → `auto-fill minmax(440px, 1fr)` 2-per-row grid | ✅ |
| Visual separator (2px hairline + 28px padding) between picker zone and research card on both tabs | ✅ |

### Architecture Notes

**Bracket spacing math:** Tile render height is ~126px (44px top team + 34px compare zone + 44px bottom team + 4px border). With SH=136, gap = 136−126 = 10px. All ROUND_ABS values, TOP_H, FF_H, FF_GAP, CHAMP_BOX_H derive from SH automatically. GAME_MID_OFFSET unchanged at 50.

**Compare flow (research tab):** Compare button lives in the hub h2 flex row. Disabled (opacity 0.35) until a team/animal is selected. Clicking toggles `comparePicking` — header label flips to "Cancel Compare". The old two-step buried ghost button is gone. `comparePicking` resets on tournament switch (TournamentSelector already calls `setComparePicking(false)`).

**ESPN banner URL:** Changed from the combiner crop URL (`w=900&h=225&scale=crop`) to the plain square PNG (`/ncaa/500/{espnId}.png`). Logo is 108×108px, right-side positioned, `objectFit: contain`, with `drop-shadow` and a left-heavy gradient overlay.

### Build Status
- `npm run build` — PASSES clean (pre-existing chunk size warning only)
- Branch: `ui-audit-polish`, commit `9ec2547`
- NOT pushed. NOT deployed. Run `git push` then merge PR #2.

### NEXT SESSION: Research Tab Items 4 + 6 (deferred this session)

The audit identified two further research tab improvements that were not implemented:

**Item 4 — Seed-matchup picker:**
Replace the wrapping blob of 16 team/animal buttons with 8 paired rows organized by bracket matchup (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15). Each row shows both competitors side by side with a "vs" separator. Need to read `bbTeamsByRegion` / `mammalAnimalsByRegion` structure and handle First Four (two teams at same seed) before implementing. Check `bracketData.js` for `R64_SEED_MATCHUPS`.

**Item 6 — ResearchCard stats layout:**
Current 2-column grid has 7 items (orphaned last cell). Numeric stats (Rank, KenPom, Offense, Defense, Pace) and text fields (Coach, Conference) have different visual weight and shouldn't share the same box treatment. Separate into: compact numeric stat chips + text fields in their own row.

### Other Deferred Items (lower priority)
- `alert()` → inline errors in admin panels (8 occurrences: lines ~783, 784, 988, 989, 1734, 2751, 2763, 2977, 2980)
- Mobile header collapse (not urgent — students use Chromebooks)
- Icon library: Lucide → Phosphor (non-trivial swap, low urgency)

---

## Handoff: 2026-06-03 — UI AUDIT PASS 1: CONTRAST, EMOJIS, NAV, POLISH

### Current State
**PR open at `ui-audit-polish` branch.** All changes are committed and pushed. Build passes clean. Production (`march-madness-ruby.vercel.app`) is still on `main` — merge the PR to deploy.

### What Was Done This Session

| Item | Status |
|---|---|
| Full UI audit using `design-taste-frontend`, `high-end-visual-design`, `ui-ux-pro-max`, `redesign-existing-projects` skills | ✅ |
| Critical WCAG fix: `ResearchCard` text (`#ccc`/`#bbb`/`#999`) on cream background — all values now dark palette tokens | ✅ |
| Critical WCAG fix: `MammalResearchCard` facts, fun facts, size/lifespan/speed — same contrast fix | ✅ |
| Inner cell backgrounds/borders in both research cards — switched from invisible white-on-white to navy-tinted | ✅ |
| Active nav tab fix — active background was NAVY on equally-dark header (invisible); changed to `#1C3558` | ✅ |
| All emojis removed — Championship spine uses `Trophy` icon, errors use `AlertTriangle`, animal empty state uses `Search` | ✅ |
| `loading="lazy"` on `TeamLogo` `<img>` — defers up to 128 ESPN requests on bracket mount | ✅ |
| `font-variant-numeric: tabular-nums` on all score displays (score bar, rank, leaderboard, podium, teacher tab) | ✅ |
| Em-dash in Final Four labels replaced with colon | ✅ |
| `text-wrap: balance` on sign-in and onboarding `h1` | ✅ |
| Committed, pushed, PR #2 open | ✅ |

### Architecture Notes

**No behavior changes.** This is a pure visual/polish pass — no logic, no Firestore, no API changes. All icons used (`Trophy`, `AlertTriangle`, `Search`) were already imported from `lucide-react`.

**Canonical palette unchanged.** All new text colors (`#1A1208`, `#3A3028`, `#7A7068`) are existing palette tokens from CLAUDE.md. No new colors introduced.

**Research card context:** Both `ResearchCard` (basketball) and `MammalResearchCard` were built against a dark-theme assumption, then the app switched to warm cream. The inner cells used `rgba(255,255,255,0.03–0.04)` backgrounds and `#ccc`/`#bbb` text — invisible on cream. Now use `rgba(9,24,40,0.03–0.04)` backgrounds and dark text.

### Build Status
- `npm run build` — PASSES clean (pre-existing chunk size warning only)
- Branch: `ui-audit-polish`, PR #2
- Production: still on `main` — merge PR to deploy

### What Still Needs Smoke Testing
Sam should merge PR and verify:
- Research cards (both basketball and mammal) show readable dark text on cream cards
- Active nav tab is visibly distinct on the dark header
- No emoji visible anywhere in the app
- Championship spine shows Trophy icons

### NEXT SESSION: UI Audit Pass 2 (Images + Remaining Items)
The audit identified one deferred item the user wants to address separately:

- **Images in research cards**: the basketball `ResearchCard` banner uses a blurred ESPN logo as a low-contrast background image (opacity 0.4 on a dark gradient). The mammal card uses Wikipedia thumbnail similarly. Discuss whether to improve these or introduce real hero imagery for the cards.

Other potential next UI work (from the audit, lower priority):
- `alert()` in admin panels → inline error messages (admin-only, low impact)
- Icon library: currently Lucide (functional but default AI choice). Phosphor would differentiate but is a non-trivial swap.
- Mobile header overflow: logo + nav + user info at narrow widths — no responsive collapse exists yet.

---

## Handoff: 2026-06-03 — ESPN IMPORT + CSV IMPORT + TEAM COLORS, FULLY DEPLOYED

### Current State
**All systems live at `march-madness-ruby.vercel.app`.** This session added two team roster import methods and wired team colors into the bracket compare button. Everything is committed, pushed, and deployed.

### What Was Done This Session

| Item | Status |
|---|---|
| `api/import-bracket.js` — new serverless function, fetches ESPN tournament bracket server-side (no CORS), parses regions/seeds/ESPN IDs, batch-fetches team colors | ✅ |
| Admin Teams panel: "Auto-Import from ESPN" button — one click after Selection Sunday, populates all 64 teams | ✅ |
| Admin Teams panel: "Import from Spreadsheet" section — download CSV template, fill in Excel/Google Sheets, paste back and parse | ✅ |
| Sample data table in CSV section — 10 rows of real 2024 tournament data showing exact format (region, seed, name, ESPN ID, First Four) | ✅ |
| CSV parser: validates regions, seeds, flags bad rows with specific error messages | ✅ |
| Team colors stored in roster objects (`color`, `alternateColor` fields from ESPN teams API) | ✅ |
| GameSlot compare zone: uses `team.color` for basketball compare fills instead of fixed navy; falls back to navy if no color stored | ✅ |
| Committed and pushed — 2 commits this session (d33bcd6, 14fa5c7) | ✅ |

### Architecture Notes

**ESPN Import (`api/import-bracket.js`)**:
- GET endpoint (no auth needed — admin-only button in UI)
- Tries ESPN tournaments API → follows `$ref` to bracket data → parses multiple response shapes (groups, games, rounds)
- Normalizes region names: East/West/South/Midwest
- Batch-fetches colors from `site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{id}` in groups of 8
- Returns `{ success, roster: { East, West, South, Midwest }, teamCount }`
- **Only works after Selection Sunday (mid-March).** Returns a clear error message otherwise — CSV import is the year-round fallback.

**CSV Import Format**:
```
Region,Seed,Team Name,ESPN ID,First Four
East,1,Duke,150,no
East,11,Duquesne,213,no
East,11,UAB,5596,yes
```
- First Four pairs: same seed number, both marked `yes`
- Region must be exactly `East`, `West`, `South`, or `Midwest`
- ESPN ID is the number from the URL: espn.com/mens-college-basketball/team/_/id/**150**/duke

**Team Colors in Compare Zone**:
- Colors stored directly on team objects in the roster (`color: "003087"`)
- Flow through `buildInitialBracketFromTeams` automatically (spreads `...t`)
- `GameSlot` reads `top?.color` and `bottom?.color` — no extra props needed
- Format: 6-char hex WITHOUT the `#` (ESPN's format) → prepend `#` in the component

### Build Status
- `npm run build` — PASSES clean (pre-existing chunk size warning only)
- Deployed: `march-madness-ruby.vercel.app`
- Git: clean, all committed and pushed

### What Still Needs Manual Smoke Test
Same as before — Sam needs to sign in and verify bracket/teacher/admin tabs work. No new smoke test items from this session (import is admin-only and only meaningful in March).

### NEXT SESSION: UI Audit
Start the next session with a full UI audit using these skills (invoke all before touching any code):

1. `design-taste-frontend` — the primary audit skill. Has a full Redesign Protocol (Section 11) for existing projects: audit brand tokens, IA, patterns to preserve vs. retire, dial values for the current design. Run this first.
2. `high-end-visual-design` — Awwwards-tier visual standards checklist. Use for the "impeccable" bar — runs against the Pre-Output Checklist (Section 8) to flag what doesn't meet agency-level quality.
3. `ui-ux-pro-max` — comprehensive UX audit layer. Catch interaction, accessibility, and usability issues that the visual skills miss.
4. `redesign-existing-projects` — name says it: specific protocol for auditing and improving existing projects.

**Key context for the UI audit session**: The app uses inline styles only (no CSS files, no Tailwind). All theme constants are at the top of `src/App.jsx`. The canonical palette is locked in CLAUDE.md and must not change. The audit should identify improvements within the existing stack — no framework changes.

---

## Handoff: 2026-06-02 — POST-PHASE 2 HARDENING + UI POLISH, FULLY DEPLOYED

### Current State
**All systems live at `march-madness-ruby.vercel.app`.** This session hardened security, fixed teacher permissions, added infrastructure (Firestore rules, favicon, service account), and applied a full UI polish pass validated by `ui-ux-pro-max` and `frontend-design` skills.

### What Was Done This Session

| Item | Status |
|---|---|
| Firestore Security Rules deployed (via Firebase CLI) | ✅ |
| Rules v2: `isAdmin()` helper, admin emails bypass all user-keyed collections | ✅ |
| Teacher actions API (`/api/teacher-action.js`) — Admin SDK, school-scoped | ✅ |
| Teacher roster: Remove + Edit School now route through API (not blocked by rules) | ✅ |
| `firebase-admin` v13 installed, `FIREBASE_SERVICE_ACCOUNT` in Vercel production | ✅ |
| Privacy Policy: cream theme + accurate Google Sign-In auth language | ✅ |
| Terms of Service: cream theme + accurate auth language | ✅ |
| SVG favicon: navy rounded square, cream bracket diagram, gold champion dot | ✅ |
| Vercel.json: `handle: "filesystem"` before SPA rewrite (favicon 404 fix) | ✅ |
| UI polish: `button:hover` brightness, `button:focus-visible` ring | ✅ |
| UI polish: bracket tile `mm-tile` hover (left-shift + bg, 44px touch target) | ✅ |
| UI polish: leaderboard `mm-lb-row` hover lift | ✅ |
| UI polish: podium cards `mm-podium` spring hover | ✅ |
| UI polish: shimmer skeleton replaces static loading screen | ✅ |
| UI polish: `prefers-reduced-motion` guards on all new animations | ✅ |

### Architecture Notes

**Teacher Actions API** (`api/teacher-action.js`):
- POST `{ idToken, action, targetUid, school? }`
- Actions: `removeStudent` | `editSchool`
- Verifies Firebase ID token server-side using Admin SDK
- Checks caller email against `admin/teachers` Firestore doc
- Teachers: scoped to their school only (reads `users/{targetUid}.school` to verify)
- Admin emails: bypass school check entirely
- Env var: `FIREBASE_SERVICE_ACCOUNT` (full JSON, set in Vercel production)
- **Note:** Teachers can remove and edit-school students at their school. Admins can do anything. Students cannot act on other users' data.

**Firestore Security Rules** (`firestore.rules`):
- `isAdmin()` helper: checks `request.auth.token.email` against the two admin emails
- User-keyed collections: `own uid OR isAdmin()`
- `tournament/` and `admin/`: `isAdmin()` only
- Deploy: `firebase deploy --only firestore:rules` (Firebase CLI installed, logged in)

**Known Limitation:**
Teachers' "Edit School" and "Remove" in the roster use the API endpoint, not the Firestore client directly. This is correct — Firestore rules can't check teacher role from the auth token (no custom claims). Admin emails can still do these operations directly via the Firestore client (rules allow by email).

### Build Status
- `npm run build` — PASSES clean (pre-existing chunk size warning only)
- Deployed: `march-madness-ruby.vercel.app`
- Git: clean, all committed and pushed, 7 commits this session

### What Still Needs Manual Smoke Test (authenticated)
Sign in as yourself and verify:
- Onboarding bento grid (new account) or skip straight to bracket
- Bracket tab: completion bar, tiles spaced correctly, confetti on champion pick
- Leaderboard: top-3 podium, sticky your-rank bar
- Teacher tab (sign in as a teacher): roster loads, Remove/Edit School work
- Admin tab: People sub-tab (superAdmins + teachers), Mammal video IDs

---

## Handoff: 2026-06-02 — PHASE 2 COMPLETE, FULLY DEPLOYED AND COMMITTED

### Current State
**Phase 2 is complete, fully committed, and deployed to `march-madness-ruby.vercel.app`.**

All 12 implementation tasks shipped (14 commits total). All files are clean — no unstaged changes. The `admin/superAdmins` Firestore doc has been created manually with both Sam's emails (`sam.castillo71@gmail.com` and `scastillo@rcs-k12.us`).

### What Was Implemented

| Feature | Status |
|---|---|
| Email-based role system (superAdmins/teachers Firestore docs) | ✅ |
| Password admin removed entirely | ✅ |
| Tab visibility by role (Student/Teacher/Admin) | ✅ |
| Claymorphism tokens globally (card, btn, tiles) | ✅ |
| Sign-in: animated underline + dot bg pattern | ✅ |
| Onboarding: 2×2 bento grid with spring bounce + checkmark | ✅ |
| Bracket SH 120px + new ROUND_ABS | ✅ |
| Bracket completion bar (X/63 picks) | ✅ |
| Champion pick confetti (canvas-confetti) | ✅ |
| Locked stamp overlay on tiles | ✅ |
| Research: empty state icon, line-clamp CSS | ✅ |
| Research: Mammal Battle Videos (YouTube embeds) | ✅ |
| Leaderboard: top-3 podium cards | ✅ |
| Leaderboard: sticky your-rank bar | ✅ |
| Leaderboard: live score flash | ✅ |
| Teacher tab: class leaderboard + student roster + battle videos | ✅ |
| Admin People sub-tab: manage superAdmins + teachers | ✅ |
| Admin Mammal sub-tab: YouTube video ID fields | ✅ |

### Manual Setup — DONE ✅

`admin/superAdmins` Firestore doc created with:
```
emails: ["sam.castillo71@gmail.com", "scastillo@rcs-k12.us"]
```

Both emails get the Admin tab on sign-in.

### Security Notes (action recommended before next school year)

Add Firestore Security Rules in Firebase console (Rules tab):

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /brackets/{uid}           { allow read: if request.auth != null; allow write: if request.auth.uid == uid; }
    match /brackets_mammals/{uid}   { allow read: if request.auth != null; allow write: if request.auth.uid == uid; }
    match /leaderboard/{uid}        { allow read: if request.auth != null; allow write: if request.auth.uid == uid; }
    match /leaderboard_mammals/{uid}{ allow read: if request.auth != null; allow write: if request.auth.uid == uid; }
    match /tournament/{doc}         { allow read: if request.auth != null; allow write: if false; }
    match /admin/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.email == 'sam.castillo71@gmail.com';
    }
  }
}
```

### Build Status
- `npm run build` — PASSES clean (pre-existing chunk size warning only)
- Deployed: `march-madness-ruby.vercel.app`
- Plan file: `docs/superpowers/plans/2026-06-02-phase2-implementation.md`

---

## Handoff: 2026-06-02 — PHASE 2 SPEC COMPLETE, READY FOR IMPLEMENTATION (superseded)

### Current State
**Local files are correct and build clean.** Phase 1 (cream redesign + Google Auth + school onboarding + leaderboard school filter) is fully implemented and deployed to `march-madness-ruby.vercel.app`. Phase 2 design spec is complete — ready to implement in a fresh session.

**Domain confirmed:** `rcs-k12.us` — already set in `src/firebase.js` and `src/App.jsx`.

**What's already in local files (do not re-implement):**
- Google Sign-In (`signInWithPopup`, `onAuthStateChanged`), `uid` = Firebase Auth uid
- Cream palette (`#E8E2D8` bg, `#F4EFE6` cards, `#091828` navy, `#1A4332` green)
- Libre Bodoni headings + Public Sans body
- GameSlot compare zone (34px CSS hover animation)
- New Year Reset button (`deleteAllBrackets()` in admin dashboard)
- School onboarding (one-time, 4 schools: Hart / Van Hoosen / Reuther / West)
- School badge + filter pills on leaderboard (basketball + mammal)
- `getUserProfile` / `saveUserProfile` in `firestoreService.js`
- `school` param in `updateLeaderboardEntry` / `updateMammalLeaderboardEntry`
- `profileLoaded` state guards onboarding from flashing

---

### Phase 2 Spec — Full Feature List

#### 1. Role System (replaces password admin)
- **Hierarchy:** Admin > Teacher > Student
- **Storage:**
  - `admin/superAdmins` doc: `{ emails: ["sam.castillo71@gmail.com"] }` — multiple allowed
  - `admin/teachers` doc: `{ "email@rcs-k12.us": { school: "Hart" }, ... }`
- **On sign-in:** check user email against both docs → set `isAdmin` / `isTeacher` / `teacherSchool` in state
- **Remove:** password modal, `localStorage mm_admin` flag, `setupMode` / `adminPwInput` state, `showAdminLogin` state, `checkAdminPassword` / `adminExists` / `setAdminPassword` from firestoreService
- **First-time setup:** Sam manually creates `admin/superAdmins` doc in Firebase console with his email once after deploy. All future admin management is in-app.
- **Tab visibility:**

| Tab | Student | Teacher | Admin |
|---|---|---|---|
| Bracket | ✓ | ✓ | ✓ |
| Research | ✓ | ✓ | ✓ |
| Leaderboard | ✓ | ✓ | ✓ |
| Teacher | — | ✓ | ✓ |
| Admin | — | — | ✓ |

#### 2. Onboarding Screen (upgrade existing)
- **Trigger:** one-time after first sign-in, never shown again if `school` is set in profile
- **School change:** students cannot change own school; teachers can change students at their school; admin can change anyone — via "Edit School" dropdown in Users sub-tab
- **UI redesign — 2×2 bento grid of school cards** instead of stacked buttons:
  - Each card: Lucide `School` icon + school name in Libre Bodoni 18px bold
  - Card style: claymorphism (`18px` radius, double shadow, `2px` border, `#F4EFE6` bg)
  - Hover: `translateY(-3px)` + shadow deepens (`200ms ease-out`)
  - Click: spring bounce `scale(0.96)→1.02→1.0` at `250ms cubic-bezier(0.34,1.56,0.64,1)`, then green checkmark overlay (`400ms`), then proceed
  - School labels: **Hart · Van Hoosen · Reuther · West** (no "Middle School")
  - Subtext: "Your school will show on the leaderboard. Ask your teacher if you need to change it."

#### 3. Claymorphism Design System (apply globally)
Apply to every card, button, game tile, modal, and pill across all screens:

| Token | Value |
|---|---|
| Card border | `2px solid rgba(9,24,40,0.20)` |
| Card shadow | `4px 6px 14px rgba(9,24,40,0.10), inset -1px -1px 4px rgba(255,255,255,0.8)` |
| Card radius | `18px` |
| Button press | `scale(0.96)` + `200ms ease-out` |
| Button shadow | `3px 4px 10px rgba(9,24,40,0.15)` |
| Interactive radius | `12px` |
| Spring bounce | `cubic-bezier(0.34, 1.56, 0.64, 1)` on bracket picks |

#### 4. Sign-In Screen
- Keep existing layout and copy
- Apply claymorphism card treatment
- Animated underline under heading: `width 0→100%` at `600ms ease-out` on load
- Subtle animated background: diagonal dot/line pattern `rgba(9,24,40,0.04)` on `20s` loop
- Both animations respect `prefers-reduced-motion`

#### 5. Bracket Tab
- **Tile spacing:** SH `105→120px` (~31px visual gap between tiles). Recalculate ROUND_ABS:
  - R64: `[0,120,240,360,480,600,720,840]`
  - R32: `[60,300,540,780]`
  - R16: `[180,660]`
  - R8: `[420]`
  - TOP_H: `8 * 120 = 960`
  - GAME_MID_OFFSET_BOT: stays hardcoded `39` (tile height unchanged)
- **Game tile claymorphism:** `2px` border, double shadow, `10px` radius, winner row gets `3px solid #1E6B47` left accent
- **Bracket completion bar:** 8px tall, above bracket below score bar. Segments by round (R64/R32/S16/E8/FF/Champ), each a darker navy shade. Label: "X/63 picks made". At 63/63: "Complete!" + confetti burst.
- **Champion confetti:** `canvas-confetti` (~3kb). On champion pick: 1.5s burst in navy + green + gold `#C4952A`. Skip if `prefers-reduced-motion`.
- **"Locked In" stamp:** On tournament lock: each tile briefly shows diagonal red `LOCKED` stamp — `opacity 0→1→0.6`, `rotate -15deg`, `600ms`. Settles to lock icon overlay, cursor `not-allowed`.
- **Spring bounce on picks:** Team row click: `scale(0.97)→1.02→1.0`, `250ms cubic-bezier(0.34,1.56,0.64,1)`

#### 6. Research Tab
- Claymorphism card treatment on all scouting/animal cards
- Long text fields (`scouting report`, `habitat`): `line-clamp: 4` + "Show more" toggle
- Empty state: telescope icon + "Research data will appear once the admin generates it."
- **Mammal Battle Videos section** (top of Mammal Research tab):
  - One claymorphism card per round that has a video ID entered by admin
  - Embedded YouTube player (`click-to-play` only, `preload="none"`)
  - Card shows: round name, matchup title, thumbnail + play button overlay
  - Admin enters YouTube video ID per round in Admin → Mammal sub-tab

#### 7. Leaderboard Tab
- **Top 3 podium cards** above ranked list:
  - #1: larger card, gold `#C4952A` border, trophy icon
  - #2: silver `#A8A8A8` border
  - #3: bronze `#CD7F32` border
- **Sticky "Your Rank" bar:** if user is outside visible top 10, a sticky bottom bar shows their rank + score
- **Live score flash:** when `onSnapshot` fires a score update, the changed value briefly flashes `rgba(30,107,71,0.3)→transparent` over `800ms`
- Filter pills get claymorphism treatment (spring bounce on selection)

#### 8. Teacher Tab (new)
- Visible to teachers and admin
- Header: "[School Name] — Your Class"
- **Class Leaderboard:** filtered to teacher's school, toggles Basketball / Mammal Madness
- **Roster view:** all students from teacher's school — columns: Name, School, BB Score, Mammal Score, Submitted (yes/no), Actions
  - "Remove" button: confirms via `ConfirmDialog`, calls `deleteBracketAndScore(uid)` for both tournaments
  - "Edit School" dropdown: teacher can reassign a student at their school to correct a mistake
- **Mammal Battle Videos:** same YouTube cards as Research tab — teacher view for projecting in class

#### 9. Admin Tab — New "People" Sub-tab
Add to existing Dashboard / Basketball / Mammal / Users / Help sub-tabs:
- **People sub-tab:**
  - **Admins section:** list of emails in `admin/superAdmins`, add/remove buttons
  - **Teachers section:** list with email + assigned school, add (email + school dropdown) / remove buttons
- **Mammal sub-tab addition:** per-round YouTube video ID input. Each round has a text field for the video ID (not full URL — just the ID like `dQw4w9WgXcQ`). Save button updates `admin/mammalBattleVideos` doc.
- **Users sub-tab addition:** "Edit School" dropdown per student (admin can change any student's school, writes to `users/{uid}`)

#### 10. New Firestore Docs
- `admin/superAdmins`: `{ emails: [...] }`
- `admin/teachers`: `{ "email": { school: "Hart" }, ... }`
- `admin/mammalBattleVideos`: `{ "Round 1": "videoId", "Round 2": "videoId", ... }`
- `users/{uid}`: already exists with `{ school, updatedAt }` — no change needed

---

### What Still Works Unchanged
- Basketball + Mammal bracket architecture
- All Firestore collections (`brackets`, `leaderboard`, `brackets_mammals`, `leaderboard_mammals`, `admin/officialBracket`, etc.)
- GameSlot compare zone animation
- Live ESPN scores
- AI research generation (`api/generate.js`)
- New Year Reset button

---

### Build Status
- `npm run build` — PASSES clean
- Dev server running on `localhost:5173`

### Next Steps for Implementation Session
1. Paste this full handoff as context
2. Invoke `superpowers:writing-plans` to convert spec into a step-by-step implementation plan
3. Implement role system first (it gates everything else)
4. Then claymorphism tokens (global, touch everything)
5. Then onboarding upgrade
6. Then Teacher tab
7. Then per-screen improvements (bracket spacing, confetti, leaderboard podium, research videos)
8. Build check after each major section
9. Deploy once all passes locally

---

## Handoff: 2026-06-01 — REDESIGN IMPLEMENTED, READY FOR LOCAL TEST + DEPLOY

### Current State

**Implementation is complete and builds clean.** Local files now have the full redesign. Do NOT deploy without first testing locally with `npm run dev`.

**One open item:** The Google Auth `hd` domain hint in `src/firebase.js` is set to `rochester.k12.mi.us` but the actual domain may be `rcs-k12.mi.us` or something similar. Confirm with Sam which Google Workspace domain the school uses — it's the part after `@` in student Google accounts. Update `firebase.js` line 18 and re-deploy.

**DO NOT assume the old code is correct.** Previous sessions destroyed work by deploying stale local files. The local files are now the canonical implementation.

---

### What Was Implemented (2026-06-01 session)

All four files modified:

**`src/firebase.js`**
- Added `getAuth`, `GoogleAuthProvider`, `auth`, `googleProvider` exports
- `hd` domain hint set to `rochester.k12.mi.us` — VERIFY THIS DOMAIN

**`src/firestoreService.js`**
- Added `writeBatch` to imports
- Added `deleteAllBrackets()` — batch-deletes brackets, brackets_mammals, leaderboard, leaderboard_mammals (not admin/config/research)

**`index.html`**
- Fonts: Playfair Display/Source Sans 3 → Libre Bodoni/Public Sans
- Body background: `#080c18` → `#E8E2D8`

**`src/App.jsx`** — full redesign:
- Theme: warm cream palette (#E8E2D8 bg, #F4EFE6 cards, #091828 navy, #1A4332 green, #C2EDD5/#1E6B47 winner mint)
- Auth: username login → Firebase Google Sign-In (signInWithPopup + onAuthStateChanged)
- Login screen: single "Sign in with school Google" button, Libre Bodoni heading
- GameSlot compare zone: 34px zone between team rows, pure CSS hover animation — navy two-tone for basketball, habitat-based colors for mammals (HABITAT_COLORS map at top of file)
- Admin panel: New Year Reset button (calls deleteAllBrackets()), emoji removed from tabs
- All emojis replaced with Lucide icons (LogIn, Lock, Check, Settings, AlertTriangle, Trophy)
- All old constants (ACCENT, ACCENT2, GOLD, GOLD2) removed; NAVY/GREEN/MINT_BG/MINT_FG replace them
- All `'Playfair Display', serif` → `'Libre Bodoni', serif` globally

---

### Files State
- `src/firebase.js` — UPDATED (Google Auth added)
- `src/firestoreService.js` — UPDATED (deleteAllBrackets added)
- `src/App.jsx` — UPDATED (full redesign, ~2300 lines, inline styles only)
- `index.html` — UPDATED (fonts + body bg)
- `CLAUDE.md` — Already had canonical colors from 2026-06-01 brainstorm session

### Build Status
- `npm run build` — PASSES, zero errors (chunk size warning is pre-existing, not new)
- Dev server: `npm run dev` — tested, starts correctly

---

### Next Steps (in order)

1. **Confirm the school Google Workspace domain** — ask Sam: "What's the domain after @ in your school Google accounts?" It's probably `rochester.k12.mi.us` or `rcs-k12.mi.us`. Update `src/firebase.js` line 18:
   ```js
   googleProvider.setCustomParameters({ hd: 'CORRECT-DOMAIN-HERE' });
   ```
   If unsure, remove the `hd` line entirely (removes domain filter from account picker, no security impact).

2. **Test locally** — `npm run dev` then open localhost and click "Sign in with school Google". Verify:
   - Cream/warm background loads
   - Google popup appears
   - After sign-in: bracket tiles are light with navy borders
   - Hover over a game tile with 2 teams → compare zone animates
   - Admin panel: tab labels have no emojis, dashboard has "New Year Reset" button

3. **Deploy to Vercel** — only after local test confirms everything works.

---

### Critical Context (carry forward)

- All styles are inline (no CSS files). Theme constants at top of `src/App.jsx`.
- Two tournaments: Basketball (NAVY #091828) and Mammal Madness (GREEN #1A4332). Same architecture, separate Firestore collections.
- Google Auth uid = Firebase Auth uid = Firestore document key. Old username-keyed docs are orphaned (acceptable — end of year).
- Admin password is still plaintext in Firestore (`admin/auth`). Admin flow unchanged — password dialog + localStorage `mm_admin` flag.
- `isTeacher` defaults to false for all Google Auth users (was localStorage-based, not preserved through auth change).
- Existing brackets from username-era are unreachable but not deleted. "New Year Reset" button will delete them when ready.
- The `hd` parameter in GoogleAuthProvider is just a UI hint (pre-fills domain in Google account picker). It does NOT restrict which accounts can sign in — that would require Firebase Auth domain rules. Current setup: any Google account can authenticate.
- Plan file at: `docs/superpowers/plans/2026-06-02-redesign-implementation.md`

---

## Handoff: 2026-05-23

### Current Task State
No active code changes. This session was focused entirely on setting up Claude Code tooling — specifically MCP servers and plugins. The March Madness app codebase itself was not modified (only `.gitignore` has unstaged changes from a prior session).

### Key Decisions
- **Sequential-thinking MCP via npx**: Chose `@modelcontextprotocol/server-sequential-thinking` installed via `claude mcp add` (local scope) rather than a plugin marketplace, since it wasn't available in `claude-plugins-official`.
- **Handoff plugin from thepushkarp/handoff**: Added as a separate marketplace (`/plugin marketplace add https://github.com/thepushkarp/handoff`) then installed separately — combining both commands in one line caused a fatal git clone error.

### Modified Files
- None in source code. Only `.gitignore` has unstaged changes (pre-existing from a prior session).
- `C:\Users\Samca\.claude.json` — sequential-thinking MCP server entry added (project-local scope).

### Blockers / Open Questions
- The `claude doctor` command could not be captured — it runs interactively and doesn't return output via the Bash tool. Run `! claude doctor` directly in the Claude Code prompt to see health status.
- The `/plugin marketplace add https://github.com/vercel-labs/agent-skills` command from earlier in the session result was not confirmed — unclear if it succeeded or was abandoned.

### Next Steps
1. Verify the sequential-thinking MCP server is active by checking `/mcp` in a new session.
2. Review any unstaged changes to `.gitignore` and decide whether to commit or discard.
3. Return to March Madness app development — no feature work was started this session.
4. If continuing with plugins: check `/plugin list` to confirm all installed plugins are active.

### Critical Context
- The March Madness app lives entirely in `src/App.jsx` (~2,245 lines). All styling is inline — no CSS files.
- Firebase Firestore is the backend; real-time listeners (`onSnapshot`) keep all clients in sync.
- There is no authentication — users identify by typing a username (stored as the Firestore doc ID).
- Admin password is plaintext in Firestore (`admin/auth`) — intentional for a school hobby app.
- The `/plugin` command errors if you combine two commands on one line (the second command gets appended to the URL, causing a malformed git clone URL).

### Model Summary
- Session goal: set up Claude Code MCP and plugin tooling, no app code changes.
- Added `sequential-thinking` MCP server (local scope, via `npx @modelcontextprotocol/server-sequential-thinking`).
- Installed `handoff` plugin from `https://github.com/thepushkarp/handoff` marketplace.
- Plugins reloaded: 16 plugins, 13 skills, 16 agents, 10 hooks, 4 plugin MCP servers active.
- App codebase untouched; branch is up to date with `origin/main`.
- Only modified file: `.gitignore` (unstaged, pre-existing).
- No blockers for future app development — environment is now better equipped.
- `claude doctor` could not be verified in-session (requires interactive terminal).
- Plugin marketplace `vercel-labs/agent-skills` install status unconfirmed.

### Handoff Context (paste into next session)
```
Continuing work on March Madness Bracket Challenge app (C:\Users\Samca\projects\March-Madness).
Branch: main, up to date with origin/main.
Last session: tooling setup only — no app code changed.

New tooling available this session:
- sequential-thinking MCP server (local scope, auto-starts via npx)
- handoff plugin installed and active

To verify MCP: run /mcp in Claude Code prompt.
To verify plugins: run /plugin list.

The app is a React 18 + Vite + Firebase Firestore SPA.
All UI lives in src/App.jsx (~2,245 lines, inline styles only).
No CSS files — all styles use the S.* constants and inline style={{}}.
Firebase real-time listeners keep all clients in sync via onSnapshot.
No auth — username IS the Firestore document ID.

Unstaged change: .gitignore — review with `git diff .gitignore` before committing.
Next app work: TBD — no feature branch was opened this session.
```

---
---

## Handoff: 2026-05-23T14:35:22Z (auto-saved before compaction)

### Compaction Metadata
- Trigger: (unknown)
- Custom instructions: (none)
- Transcript: (unknown)
- CWD: (unknown)

### Last User Message (transcript tail)
(unavailable - transcript missing)

### Last Assistant Message (transcript tail)
(unavailable - transcript missing)

### Git Snapshot
- Branch: main
- Status:
 M .gitignore
 M src/App.jsx
?? docs/
?? package-lock.json
- Recent commits:
73c3c2c Merge pull request #1 from samcastillo71-cmd/claude/magical-planck-Mlr6V
d280ae1 Add CLAUDE.md with full project context
583dcd6 Update App.jsx
01a9a84 Update App.jsx
647d137 Update App.jsx

### Model Summary
(TODO: fill after compaction — 8–12 bullets)

### Handoff Context (paste into next session)
(TODO: fill after compaction — 10–20 lines of concrete resume instructions)

---

---

## Handoff: 2026-06-02 — DESIGN FINALIZED, READY FOR IMPLEMENTATION

### Current State
Design is fully approved and spec is written. No implementation code has been written yet. Local `src/` files are still stale (5/23 dark green + username login). The next session should go straight to implementation.

**DO NOT DEPLOY until local files are fully rewritten and tested with `npm run dev`.**

### Design Spec
Full spec at: `docs/superpowers/specs/2026-06-02-redesign-design.md`

### Finalized Decisions
- **Typography:** Libre Bodoni (headings) + Public Sans (body/UI)
- **Background:** `#E8E2D8` (warm gray-cream)
- **Basketball navy:** `#091828` (midnight, not Michigan blue)
- **Forest green:** `#1A4332`
- **Winner row:** `#C2EDD5` mint bg + `#1E6B47` checkmark
- **Compare animation (basketball):** 10+9 — two-tone navy color clash from top+bottom edges + bracket corner connectors + 3D extruded "COMPARE" text (font-size 13, 4-layer text-shadow)
- **Compare animation (mammal):** Habitat split — colors read from `researchData[animal.name].habitat` via keyword map; fallback to forest green split
- **Auth:** Firebase Google Sign-In popup, `user.uid` as Firestore key, `user.displayName` as name
- **Admin:** Add "New Year Reset" button — batch deletes brackets + leaderboard collections
- **Icons:** Lucide React throughout, zero emojis anywhere
- **CLAUDE.md:** Updated with canonical palette and auth — future sessions will not revert theme

### Files to modify (in order)
1. `src/firebase.js` — add `getAuth`, `GoogleAuthProvider`
2. `src/firestoreService.js` — add `deleteAllBrackets()` batch delete
3. `src/App.jsx` — new theme constants, Google auth flow, GameSlot compare zone, login screen, admin reset button, emoji removal
4. `index.html` — body background `#E8E2D8`
5. `CLAUDE.md` — already updated this session

### Habitat color map (for compare zone in App.jsx)
```js
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
```

### Mockup files (reference only, not deployed)
- `docs/design-mockup.html` — palette, typography, tile states
- `docs/design-mockup-compare.html` — basketball compare animation (10+9)
- `docs/habitat-mockup.html` — mammal habitat split compare animation

---

## Handoff: 2026-06-01 — UI REDESIGN + GOOGLE AUTH SESSION

### ⚠️ READ THIS FIRST — CRITICAL SESSION CONTINUITY WARNING

**Previous sessions kept destroying the user's work.** Every new session read the local files (last saved 5/23), assumed dark-green + no-auth was correct, deployed that, and wiped the actual design. **DO NOT DEPLOY ANYTHING until local files match the intended design.** Always write changes to disk before deploying.

---

### Current Task State

The app needs a **complete UI redesign** AND **Google auth** reimplemented. Both were built in previous sessions but were deployed without being saved locally. The 5/23 local files are stale — they are the fallback state, not the intended state.

**What exists on disk right now (5/23 code):**
- Dark green theme (`#0a1a0e` bg, `#16a34a` accent) — NOT the intended design
- Username-based login (no auth) — NOT the intended design

**What was fixed in this session (2026-06-01) — currently in local files:**
- `handleUsernameSubmit`: fixed returning-user bracket loading (was setting bracket to raw Firestore doc instead of parsed object)
- `extractFFPlaceholders`: added null guard for malformed bracket data  
- `subscribeToOfficialBracket` / `subscribeToMammalOfficialBracket`: added try/catch around JSON.parse in onSnapshot callbacks
- Added `appReady` state to prevent blank screen on post-login render
- These ARE saved in local files but production has NOT been properly updated

**Production URL:** `https://march-madness-ruby.vercel.app`
Was rolled back to May 31 deployment — which is the same stale 5/23 code.

---

### Intended Design (rebuild this)

**Color Scheme:**
- Page background: Paper / off-white / cream (light, print-like — NOT dark)
- Basketball tournament: Midnight navy borders and accents
- Mammal Madness tournament: Forest green borders and accents  
- Vibe: Clean, school-appropriate, bracket-sheet aesthetic for middle schoolers

**Game Tile — Compare Button:**
- The Compare button belongs BETWEEN the two competitors inside the game tile (between top team row and bottom team row), NOT at the bottom of the tile
- It should have visual flair — a styled divider/button element, not a plain subtle gray text link
- Current code puts it at the bottom as a low-contrast text row — that's wrong
- The divider between top and bottom team is the natural home for this; style it as a small badge/button (e.g. "⚡ Compare" or "VS · Compare") with a highlight color so students notice it

**Google Authentication:**
- School Gmail login via Firebase Auth (Google Sign-In)
- Popup approach is fine (redirect was tried for Go Guardian avoidance but popup works)
- Firebase Auth uid becomes the Firestore document key (replaces username-as-uid)
- displayName comes from Google account — no separate name entry needed
- Admin access remains password-based (unchanged)

---

### Next Steps (in order)

1. **Load skills first** before touching any code:
   - `superpowers:brainstorming`
   - `frontend-design:frontend-design`
   - `ui-ux-pro-max:ui-ux-pro-max`
2. Agree on full color palette with Sam (get exact hex values)
3. Implement Google Auth in `src/firebase.js` and `src/App.jsx`
4. Redesign all inline styles with paper/navy/forest palette
5. Test locally (`npm run dev`) before ANY deploy
6. Update `CLAUDE.md` with the full color palette so no future session reverts it
7. Deploy to production only after local files are confirmed correct

---

### Critical Context

- All styles are inline — no CSS files. Theme constants at top of `src/App.jsx` lines 25-48.
- Two parallel tournaments: Basketball (navy) and Mammal Madness (green). Same architecture, separate Firestore collections.
- App is for Hart Middle School, Rochester Community Schools MI. Middle schoolers on school Chromebooks.
- `src/App.jsx` is ~2,500 lines — one big file, all components inside.
- This project is NOT a git repo locally. Versioning is via Vercel deploy history only.
- **Root cause of lost work:** Previous sessions made changes in memory, deployed, but never wrote to local files. Next session read local files, assumed correct, deployed stale code. This MUST NOT happen again.

---

### Model Summary

- App: March Madness bracket challenge, Hart Middle School, React 18 + Vite + Firebase + Vercel
- Local files are stale (5/23) — dark green + username login — NOT the intended design
- Intended: paper background, midnight navy (basketball), forest green (mammal), Google auth (school Gmail popup)
- This session fixed 4 bugs in local files but did not complete the redesign or auth
- Production rolled back to May 31 (also stale — same 5/23 code)
- Next session must load brainstorming + frontend-design + ui-ux-pro-max skills first
- Must write ALL changes to local files before deploying — non-negotiable
- Must update CLAUDE.md with finalized color palette to prevent future regression
- Existing Firestore data (username-keyed) will be orphaned after Google Auth switch — confirm with Sam if that's OK (likely fine, end of year)

---

### Handoff Context (paste into next session)

```
Continuing: March Madness Bracket Challenge — Hart Middle School
Project: C:\Users\Samca\Projects\March-Madness
Production: march-madness-ruby.vercel.app

CRITICAL — STALE LOCAL FILES: src/ was last saved 5/23. It has dark green theme and 
username login. That is NOT the intended design. Previous sessions built the real 
design but deployed without saving locally, so it got wiped.

NEEDS TO BE REBUILT:
1. UI: paper/cream background, midnight navy accents (basketball), forest green (mammal)
   - Print-like bracket aesthetic for middle school students
   - Was built using frontend-design + ui-ux-pro-max skills — use those again
2. AUTH: Google Sign-In popup (school Gmail) via Firebase Auth
   - Firebase Auth uid replaces username string as Firestore doc key
   - displayName from Google account, no separate name entry
   - Admin stays password-based

WORKFLOW: Write local files FIRST. Test with npm run dev. Then deploy.
NEVER deploy without confirming local files match the intended state.

After design is final, update CLAUDE.md with the exact color palette hex values
so no future session can accidentally revert the theme.

Start by invoking these skills IN THIS ORDER:
1. superpowers:brainstorming
2. frontend-design:frontend-design  
3. ui-ux-pro-max:ui-ux-pro-max

GAME TILE COMPARE BUTTON:
- Must sit BETWEEN the two competitor rows inside each game tile (not at the bottom)
- Needs visual flair — styled badge/button, not the current plain gray text
- Something like "⚡ Compare" or a VS divider with a highlight — students should notice it
- Current code: bottom of GameSlot as a low-contrast div — redesign this entirely

Key files:
- src/App.jsx (~2500 lines, inline styles, theme constants at lines 25-48)
- src/firebase.js (add getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged)
- src/firestoreService.js (uid becomes Firebase Auth uid — same functions, different input)
- index.html (body background matches paper bg)
- CLAUDE.md (update color palette section after design is finalized)
```

---
