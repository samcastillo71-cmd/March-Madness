# Research Tab UX — Design Spec
**Date:** 2026-05-23
**Scope:** Student-facing research tab improvements + head-to-head comparison modal

---

## Overview

Two features:
1. **Region tabs** — replace the flat A–Z button list in the Research tab with 4 region tabs, each showing that region's 16 teams/animals sorted by seed.
2. **Head-to-head comparison modal** — side-by-side stat comparison triggered from the bracket (per-matchup button) and from the research tab (compare mode).

Both features apply to basketball and mammal tournaments. Mammal region display names are customizable and change each year.

---

## Feature 1: Region Tabs

### Research Tab Navigation

Replace `allTeamNames.map(button)` and `allAnimalNames.map(button)` with:

- 4 region tab buttons (East / West / South / Midwest internal keys, shown with custom display names from `bbRegionNames` / `mammalRegionNames`)
- Active tab highlighted using existing `S.navBtn(active)` style
- Tab row scrolls horizontally if custom region names are long
- Below the tabs: list of teams/animals in the active region, sorted by seed ascending, each button showing `#seed — Name`
- Clicking a team/animal sets `selectedTeam` / `mammalSelectedAnimal` as before
- Default active tab: first region where at least one team/animal has a generated research card (i.e., exists as a key in `researchData` / `mammalResearchData`). If no region has any data, default to `'East'`.
- The existing auto-select `useEffect` (selects first team on load) should be updated to also set `bbActiveRegion` / `mammalActiveRegion` to that team's region, so the correct tab is highlighted when the card auto-loads.

### New State

```js
const [bbActiveRegion,     setBbActiveRegion]     = useState('East');
const [mammalActiveRegion, setMammalActiveRegion] = useState('East');
```

### New Derived Data

**Basketball — `bbTeamsByRegion`:**
Derived via `useMemo` from `officialBracket ?? bracket`. For each of the 4 regions, read `rounds[0]` (8 games). For each game, extract `top` and `bottom`. If a slot is `isFFPlaceholder`, use its `ffTeams` array entries instead. Filter to teams that exist in `researchData`. Sort by seed ascending.

Result shape:
```js
{ East: [{name, seed, espnId}, ...], West: [...], South: [...], Midwest: [...] }
```

**Mammal — `mammalAnimalsByRegion`:**
Derived via `useMemo` from `mammalResearchData`. Group by `card.region` (fall back to `'East'` if missing). Sort each group by `card.seed` ascending.

Result shape:
```js
{ East: [{name, seed}, ...], West: [...], South: [...], Midwest: [...] }
```

### Admin Warning for Long Region Names

In `TeamEntryPanel` and `MammalEntryPanel`, below each region name `<input>`, add a soft warning when `regionName.length > 15`:

> ⚠️ Long names may wrap in the bracket view.

Yellow text (`#f59e0b`), no hard character limit.

---

## Feature 2: Head-to-Head Comparison Modal

### `CompareModal` Component

**Props:**
```js
{ teamA, teamB, cardA, cardB, isMammal, onClose }
```

**Layout:**
- Fixed overlay, `zIndex: 2000`, same pattern as existing lightbox
- Max width 700px, scrollable vertically
- Header row: Team A name + seed | VS | Team B name + seed
  - Basketball: show `TeamLogo` for each team
  - Mammal: show `wikiImageUrl` thumbnail (or animal initial fallback)
- Stats grid: one row per stat — `[Team A value] | [stat label] | [Team B value]`
- If `cardA` or `cardB` is missing/empty: show "No data yet" in that column
- Close button (×) top-right

**Basketball stats (in order):**
rank, conference, record, KenPom, offense, defense, pace, championship odds, strengths (1 line), weaknesses (1 line)

**Mammal stats (in order):**
habitat, diet, superpower, battle strength, size, speed, lifespan

No color-coding to indicate "better" — stats aren't comparably directional across both sports and animals.

### App State

```js
const [compareModal, setCompareModal] = useState(null);
// shape: { teamA, teamB, cardA, cardB, isMammal } | null
```

### Trigger 1 — GameSlot (bracket)

Add optional `onCompare` prop to `GameSlot`:

```js
GameSlot({ ..., onCompare })
```

**Render condition:** Show a small full-width "Compare" footer bar at the bottom of the slot only when:
- Both `top` and `bottom` are non-null
- Neither is `isFFPlaceholder`
- `onCompare` prop is provided

**Styling:** Thin bar below the bottom team row (above the existing LIVE/FINAL bar if present). Small text, muted color, full-width clickable.

**Handler in App:**
```js
const handleCompare = (teamA, teamB, isMammal) => {
  const data = isMammal ? mammalResearchData : researchData;
  setCompareModal({
    teamA: teamA.name, teamB: teamB.name,
    cardA: data[teamA.name] ?? null,
    cardB: data[teamB.name] ?? null,
    isMammal,
  });
};
```

Thread `onCompare` through `renderBracket` → `RoundCol` → `GameSlot`, and also to Final Four and Championship game slots.

### Trigger 2 — Research Tab

**New state:**
```js
const [comparePicking, setComparePicking] = useState(false);
```

**UI when `!comparePicking`:**
Show a small "Compare" button in its own row between the region tabs and the research card. Only shown when a team/animal is selected. Styled as a secondary button (muted, not the primary green).

**UI when `comparePicking`:**
- Show label: "Select a team to compare with [selected team name]"
- Show region tabs + team list again (same as normal navigation)
- Show "Cancel" button that sets `comparePicking = false`
- Clicking any team/animal in the list calls:
  ```js
  setCompareModal({ teamA: selectedTeam, teamB: clickedTeam, cardA, cardB, isMammal });
  setComparePicking(false);
  ```

**On modal close:**
```js
setCompareModal(null);
setComparePicking(false);
```

Both basketball and mammal research tabs get this behavior.

---

## Files Changed

- `src/App.jsx` — all changes (new state, new derived data, `CompareModal` component, `GameSlot` prop addition, research tab render, bracket render threading)
- No changes to `firestoreService.js`, `bracketData.js`, or `api/generate.js`

---

## Out of Scope (Spec 2)

- Per-animal supplementary source URLs
- Research card completeness indicators
- These require changes to `api/generate.js` and the Firestore data model
