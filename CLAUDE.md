# March Madness Bracket Challenge — Project Context

## What This App Is

A school bracket challenge web app built and operated by a science teacher at **Hart Middle School, Rochester Community Schools (Michigan)**. Students fill out tournament brackets, scores are auto-calculated, and a live leaderboard tracks everyone's standing. The app is deployed on Vercel and backed by Firebase Firestore. There is no login — users identify themselves by entering a username.

The app runs two parallel tournaments simultaneously:
1. **NCAA Basketball** — the standard 64-team March Madness bracket
2. **March Mammal Madness** — a bracket of animals, based on Arizona State University's annual educational competition

Both tournaments share the same data architecture, UI components, and scoring logic, with separate Firestore collections for each.

---

## Repository File Structure

```
/
├── CLAUDE.md                  # This file
├── index.html                 # HTML shell (Vite entry point)
├── package.json               # React 18, Firebase 10, Vite 5
├── vite.config.js             # Vite config with React plugin (minimal)
├── Vercel.json                # SPA rewrite rule: all non-/api/ routes → index.html
├── .env                       # Local env vars (gitignored)
├── .gitignore                 # Ignores .env, node_modules, dist, .DS_Store
├── api/
│   └── generate.js            # Vercel serverless function — Claude AI proxy + image fetching
└── src/
    ├── main.jsx               # React entry point (ReactDOM.createRoot)
    ├── App.jsx                # Entire application UI (~2,245 lines)
    ├── bracketData.js         # Bracket structure, seeding logic, scoring constants
    ├── firebase.js            # Firebase app init, exports `db` (Firestore instance)
    └── firestoreService.js    # All Firestore read/write/subscribe functions
```

---

## Tech Stack

- **Frontend:** React 18, Vite 5. All styling is inline (`style={{}}`), no CSS framework, no CSS files.
- **State management:** React `useState`/`useEffect`/`useCallback`/`useMemo`/`useRef` — no Redux or external state library.
- **Database:** Firebase Firestore (v10 SDK). Real-time listeners (`onSnapshot`) keep all clients in sync.
- **AI:** Claude Haiku via the Anthropic API. Calls go through `api/generate.js` (server-side) so the API key is never exposed to the browser.
- **Deployment:** Vercel. The `api/` directory is automatically treated as serverless functions. `Vercel.json` rewrites all non-API routes to `index.html` for SPA routing.
- **Images:** ESPN CDN for team logos, PhyloPic for animal silhouettes, Wikipedia/iNaturalist/Wikimedia Commons for animal photos.

---

## Environment Variables

**Vite frontend** (must be prefixed `VITE_` to be accessible in the browser):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

**Vercel serverless** (server-side only, never exposed to browser):
```
ANTHROPIC_KEY    # Anthropic API key for Claude Haiku calls
```

---

## Authentication & Identity

There is **no Google Sign-In or account system**. Identity works as follows:

1. User enters a **username** (used as their Firestore document ID / UID).
2. If the username exists in Firestore, their saved bracket and display name are loaded.
3. If new, they enter their **display name** (shown on leaderboard).
4. Both `uid` and `displayName` are persisted to `localStorage` (`mm_uid`, `mm_name`, `mm_teacher`, `mm_admin`) so users don't have to re-enter on return visits.

Admin access is separate — a password stored in Firestore under `admin/auth`. The admin password is stored in plaintext (intentional for a school hobby app; no PII is gated behind it).

---

## Firestore Data Model

All collections are at the top level of the Firestore database.

### Basketball Tournament
| Collection / Document | Contents |
|---|---|
| `brackets/{uid}` | User's basketball bracket picks (JSON-stringified), `displayName`, `updatedAt` |
| `leaderboard/{uid}` | `displayName`, `score`, `isTeacher`, `updatedAt` |
| `admin/officialBracket` | The authoritative bracket results set by admin (JSON-stringified) |
| `admin/teamRoster` | 64 teams across 4 regions set via admin panel each year |
| `admin/researchData` | AI-generated scouting cards keyed by team name (`{ teams: { "Duke": {...}, ... } }`) |
| `admin/bbSources` | URLs the AI reads before generating basketball scouting reports |
| `admin/auth` | Admin password (`{ password: "..." }`) |
| `tournament/config` | `{ locked: bool, year: number, bbRegionNames: {...} }` |

### Mammal Tournament
| Collection / Document | Contents |
|---|---|
| `brackets_mammals/{uid}` | User's mammal bracket picks (JSON-stringified), `displayName`, `updatedAt` |
| `leaderboard_mammals/{uid}` | `displayName`, `score`, `isTeacher`, `updatedAt` |
| `admin/officialBracket_mammals` | Authoritative mammal bracket results |
| `admin/mammalRoster` | 64 animals across 4 regions |
| `admin/researchData_mammals` | AI-generated animal fact cards keyed by animal name |
| `admin/mammalSources` | URLs the AI reads before generating animal facts |
| `tournament/config_mammals` | `{ locked: bool }` |

### Key behaviors
- Brackets are stored as **JSON strings** (not native Firestore maps) to avoid document size limits and simplify serialization.
- First Four picks are stored as `_firstFourPicks` inside the bracket document itself.
- Leaderboard is only updated when the user has made at least one pick in Round 1.
- All clients subscribe to `officialBracket`, `config`, `leaderboard`, and `researchData` via `onSnapshot` — changes made by admin propagate to all open tabs in real time.
- Auto-save is debounced 3 seconds after any pick change.

---

## Bracket Structure

Defined in `src/bracketData.js`.

A bracket object has this shape:
```js
{
  East:    { rounds: [ [8 games], [4 games], [2 games], [1 game] ] },
  West:    { rounds: [ ... ] },
  South:   { rounds: [ ... ] },
  Midwest: { rounds: [ ... ] },
  finalFour: [ { top, bottom, winner }, { top, bottom, winner } ],
  championship: { top, bottom, winner, scoreTop, scoreBottom },
}
```

Each game object: `{ top: Team | null, bottom: Team | null, winner: Team | null }`

Each team object: `{ seed, name, espnId, firstFour, isFFPlaceholder?, ffTeams? }`

**First Four:** When two teams share a seed and both have `firstFour: true`, a placeholder team is created with `isFFPlaceholder: true` and `ffTeams: [team1, team2]`. The user picks the FF winner before it appears in the R64 slot.

**Seeding order** for R64 matchups (from `R64_SEED_MATCHUPS`):
`[1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15]`

**Scoring** uses ESPN Tournament Challenge point values:
- R64: 10 pts, R32: 20, Sweet 16: 40, Elite 8: 80, Final Four: 160, Championship: 320

**Region → Final Four mapping:**
- East → finalFour[0] top, West → finalFour[0] bottom
- South → finalFour[1] top, Midwest → finalFour[1] bottom

---

## src/App.jsx — Component & Logic Overview

This is a single large file (~2,245 lines) containing all UI components and the main app logic. Key sections:

### Theme / Styles
- Dark green theme (`#0a1a0e` background, `#16a34a` accent).
- Style constants at top: `ACCENT`, `ACCENT2`, `GOLD`, `RC` (region colors), `ROUND_COLORS`, `ROUND_BORDER_COLORS`.
- `S` object holds reusable style objects (`S.card`, `S.btn()`, `S.input`, `S.navBtn()`, etc.).

### UI Components (all defined before `App()`)
| Component | Purpose |
|---|---|
| `ErrorBoundary` | Class component; catches render errors, shows reload prompt |
| `OfflineBar` | Banner shown when `navigator.onLine` is false |
| `TeamLogo` | ESPN CDN `<img>` with letter fallback on error |
| `ConfirmDialog` | Modal with confirm/cancel for destructive actions |
| `GameSlot` | Renders a single matchup (two teams, winner highlight, live score, FINAL badge). Supports vertical (default) and horizontal (championship) layouts |
| `EditableField` | Click-to-edit inline field used in admin research cards |
| `ResearchCard` | Basketball team scouting card (stats, key players, injuries, odds, scouting report) |
| `MammalResearchCard` | Animal fact card (habitat, diet, fun facts, gallery with lightbox, PhyloPic silhouette) |
| `ViewBracketModal` | Read-only bracket summary modal for viewing another user's picks from leaderboard |
| `TeamEntryPanel` | Admin panel for entering the 64 basketball teams each year |
| `MammalEntryPanel` | Admin panel for entering the 64 animals each year |
| `PrivacyPolicyPage` | Full privacy policy (COPPA/FERPA compliant for school use) |
| `TermsOfServicePage` | Full terms of service |
| `Avatar` | Colored initials circle, deterministic color from name hash |

### Main App State (inside `App()`)
- `uid`, `displayName` — current user identity
- `bracket`, `officialBracket`, `locked` — basketball bracket state
- `mammalBracket`, `mammalOfficialBracket`, `mammalLocked` — mammal bracket state
- `leaderboard`, `mammalLeaderboard` — live leaderboard arrays
- `researchData`, `mammalResearchData` — AI research cards keyed by name
- `firstFourPicks`, `mammalFirstFourPicks` — `{ "East-11": "Team Name" }` maps
- `liveScores` — fetched from ESPN scoreboard API every 60 seconds
- `activeTournament` — `'basketball'` | `'mammal'` (top-level tab)
- `tab` — `'bracket'` | `'research'` | `'leaderboard'` | `'admin'`
- `isAdmin`, `isTeacher` — role flags
- `bbRegionNames`, `mammalRegionNames` — customizable region display names

### Navigation Tabs
- **Basketball / Mammal Madness** — top-level toggle
- **Bracket** — main bracket picking UI
- **Research** — scouting cards (basketball) or animal fact cards (mammal)
- **Leaderboard** — ranked list of all participants with scores
- **Admin** — password-protected; only visible after login

### Pick Logic
- `makePickHandler` — generic factory used for both basketball and mammal picks. Handles toggling (click winner again to deselect), cascades winner forward through rounds, and clears downstream picks when a team is upset.
- `clearTeamDownstream` — removes a team from all later rounds when they're deselected.
- `makeFFPickHandler` — Final Four pick logic (populates championship slot).
- `makeChampHandler` — Championship pick logic.
- `makeFirstFourHandler` — First Four pick logic (resolves FF placeholder with the chosen team).
- Admin picks simultaneously update the official bracket in Firestore (all users see results update in real time).

### Live Scores
ESPN public scoreboard API is polled every 60 seconds:
`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard`

Scores are matched to teams by name (fuzzy match). Live games show a red pulsing dot; completed games show "FINAL".

---

## src/firestoreService.js — Service Layer

Pure Firestore CRUD. No business logic. Exports:

**Basketball:** `saveBracket`, `loadBracket`, `findBracketByName`, `saveOfficialBracket`, `subscribeToOfficialBracket`, `subscribeToConfig`, `setTournamentLocked`, `subscribeToLeaderboard`, `updateLeaderboardEntry`, `saveResearchData`, `saveOneTeamResearch`, `subscribeToResearchData`

**Mammal:** `saveMammalBracket`, `loadMammalBracket`, `saveMammalOfficialBracket`, `subscribeToMammalOfficialBracket`, `subscribeToMammalConfig`, `setMammalTournamentLocked`, `subscribeToMammalLeaderboard`, `updateMammalLeaderboardEntry`, `saveMammalResearchData`, `saveOneMammalResearch`, `subscribeToMammalResearchData`, `saveMammalRoster`

**Admin:** `checkAdminPassword`, `adminExists`, `setAdminPassword`, `deleteBracketAndScore`, `getAllBracketUids`

---

## api/generate.js — Serverless AI Proxy

Vercel serverless function at `/api/generate`. Handles two modes:

### Mode 1: Claude AI generation (default)
`POST /api/generate` with `{ prompt, sources, textOnly }`

1. Fetches text content from any provided `sources` URLs (Google Slides URLs are auto-converted to export/txt).
2. Prepends source text to the prompt.
3. Calls Claude Haiku (`claude-haiku-4-5-20251001`, with fallbacks to older Haiku models).
4. Parses JSON from Claude's response.
5. If `latinName` is in the result and `textOnly` is false, fetches images automatically (see Mode 2 behavior).
6. Returns `{ result: { ...parsed } }`.

### Mode 2: Image fetch only
`POST /api/generate` with `{ fetchImagesOnly: true, latinName: "..." }`

Fetches images in parallel from four sources:
- **PhyloPic** — silhouette SVG via the PhyloPic v2 API (autocomplete → nodes → image UUID)
- **Wikipedia** — thumbnail from REST summary API
- **iNaturalist** — up to 3 research-grade observation photos
- **Wikimedia Commons** — thumbnail via MediaWiki API

Returns `{ result: { phyloPicUrl, wikiImageUrl, galleryImages: [...] } }`.

### AI model fallback chain
`claude-haiku-4-5-20251001` → `claude-haiku-4-5` → `claude-3-5-haiku-20241022` → `claude-3-haiku-20240307`

Rate limit (429) responses trigger exponential backoff (60s, 90s, 120s). Daily quota errors are surfaced to the user. A retry with a stricter JSON-only prompt is attempted if the first parse fails. A skeleton fallback card is returned if all retries fail.

---

## Admin Panel Features

Access: click "Admin" in the header → enter admin password. First use prompts to set a password.

### Basketball Admin Sub-tabs
- **Dashboard** — lock/unlock bracket submissions, set tournament year, enter official game results by clicking teams in the bracket
- **Teams** — enter all 64 teams after Selection Sunday (name, seed, ESPN ID, First Four flag), set custom region names, configure AI research source URLs
- **Research** — view/edit AI-generated scouting cards per team; trigger AI generation by region; individual card regeneration

### Mammal Admin Sub-tabs
- **Dashboard** — lock/unlock mammal bracket, enter official results
- **Animals** — enter all 64 animals with seeds and First Four flags, set region names, configure source URLs
- **Research** — view/edit AI-generated animal fact cards; generate facts by region; re-fetch images by region

### Admin-specific behaviors
- When admin is logged in, their bracket IS the official bracket — picking a winner immediately saves to `admin/officialBracket` and propagates to all users.
- Admin can view and delete any user's bracket from the leaderboard.
- Admin flag is persisted in `localStorage` (`mm_admin=true`) so they stay logged in across page reloads.
- Teacher flag (`mm_teacher=true`) marks a leaderboard entry as teacher-owned (displayed differently on leaderboard).

---

## Annual Setup Workflow (each March)

1. After Selection Sunday, admin opens the Teams panel and enters all 64 teams with seeds and ESPN IDs.
2. Click "Save Roster", then "Apply to Bracket" — this builds the initial bracket structure and saves it as the official bracket.
3. Optionally add research source URLs (e.g., link to a Google Slides presentation with stats).
4. Click "Generate Research" per region — AI reads the sources and generates scouting cards for each team.
5. Unlock submissions so students can fill out their brackets.
6. As games are played, admin enters results by clicking winning teams in the bracket view.
7. Leaderboard scores update automatically for all users.
8. Repeat for Mammal Madness with the animal roster.

---

## Key Conventions & Gotchas

- **All styling is inline.** There are no `.css` files. All styles live in `App.jsx` as JS objects. When adding UI, follow the existing `S.*` style constants rather than introducing new styling patterns.
- **`bracketData.js` has a hardcoded `CURRENT_YEAR = 2025` and a 2000-era placeholder team list.** This is only used as a fallback when no roster has been set up in Firestore. The real teams come from `admin/teamRoster` in Firestore, applied via `buildInitialBracketFromTeams`.
- **Brackets are JSON-stringified** before saving to Firestore (not stored as native maps). Always parse with `JSON.parse` after loading.
- **Admin password is plaintext in Firestore.** This is intentional — no PII is protected by it, only the ability to enter scores.
- **The `uid` field is the username the student typed**, not a Firebase Auth UID. It's used directly as the Firestore document ID.
- **`isAdmin` in React state** is also persisted to `localStorage`. On load, both basketball and mammal official brackets are set to admin's bracket state if `isAdmin` is true.
- **Live score matching is fuzzy** — `findLiveScore` normalizes team names (lowercase, strip non-alphanumeric) and falls back to substring matching.
- **Auto-save is debounced 3 seconds** and only fires if the bracket actually changed (compared to `prevBracket.current`).
- **Region colors** are fixed: East=blue, West=red, South=green, Midwest=orange. These appear in `RC` in App.jsx and `REGION_BANNER_COLORS` for mammal cards.
- **Final Four seeding:** East/West play in one semifinal, South/Midwest in the other. East winner is `finalFour[0].top`, West is `finalFour[0].bottom`, South is `finalFour[1].top`, Midwest is `finalFour[1].bottom`.

---

## Privacy & Legal

The app includes full Privacy Policy and Terms of Service pages (accessible from the footer). Key points:
- No email, password, or personal identifiers collected beyond a self-chosen display name.
- Data stored in Google Firebase under enterprise security.
- Governed by Michigan law, FERPA, and COPPA.
- AI content generation (Claude) never receives student data as input.
- Data is cleared by the admin at the end of each tournament season.
