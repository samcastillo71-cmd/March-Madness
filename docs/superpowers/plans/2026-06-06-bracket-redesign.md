# Bracket Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the bracket tab's visual quality and usability — fix connector lines, reduce tile density, add flare (color stripes, upset badges, pick pulse, research dots), redesign the compare modal, and fix research tab contrast failures.

**Architecture:** All changes are to `src/App.jsx` only. The file is ~2450 lines, organized as: imports → theme constants → component definitions → main `App()` function → render. Bracket rendering lives inside `renderBracket()` (~line 1896). `CompareModal` is a standalone component (~line 527). `GameSlot` sub-components are at ~line 195. CSS lives in a `<style>` JSX block at ~line 2300.

**Tech Stack:** React 18, Vite, Firebase, inline styles + `<style>` JSX block, `canvas-confetti` (already installed)

---

## Files
- Modify: `src/App.jsx`

---

## Task 1: Palette & Contrast Quick Fixes

Six independent one-line fixes. All are palette/contrast corrections with no layout impact.

**Files:** Modify `src/App.jsx`

- [ ] **Step 1a: Fix research tab divider color (2 locations)**

Find line ~2519 and line ~2645. Both have:
```jsx
borderBottom: '1px solid rgba(255,255,255,0.08)'
```
Change both to:
```jsx
borderBottom: '1px solid rgba(9,24,40,0.12)'
```

- [ ] **Step 1b: Fix basketball research region tab contrast (line ~2521)**

Line ~2521, the `button` inside the basketball teams tab:
```jsx
// OLD
<button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0 }} onClick={() => setBbActiveRegion(r)}>
```
```jsx
// NEW — add color override
<button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0, color: bbActiveRegion === r ? '#fff' : '#1A1208' }} onClick={() => setBbActiveRegion(r)}>
```

- [ ] **Step 1c: Fix basketball compare region tab contrast (line ~2570)**

Line ~2570, the `button` inside the compare region picker:
```jsx
// OLD
<button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '6px 14px', fontSize: 12, flexShrink: 0 }} onClick={() => setBbActiveRegion(r)}>
```
```jsx
// NEW
<button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '6px 14px', fontSize: 12, flexShrink: 0, color: bbActiveRegion === r ? '#fff' : '#1A1208' }} onClick={() => setBbActiveRegion(r)}>
```

- [ ] **Step 1d: Fix mammal research region tab contrast (line ~2647)**

Line ~2647:
```jsx
// OLD
<button key={r} style={{ ...S.navBtn(mammalActiveRegion === r), borderBottom: mammalActiveRegion === r ? '2px solid #86efac' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0 }} onClick={() => setMammalActiveRegion(r)}>
```
```jsx
// NEW
<button key={r} style={{ ...S.navBtn(mammalActiveRegion === r), borderBottom: mammalActiveRegion === r ? '2px solid #86efac' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0, color: mammalActiveRegion === r ? '#fff' : '#1A1208' }} onClick={() => setMammalActiveRegion(r)}>
```

- [ ] **Step 1e: Fix Mammal Regenerate button color (line ~466)**

```jsx
// OLD
style={{ ...S.btn('#6366f1', '#fff'), padding: '7px 16px', fontSize: 12, flexShrink: 0 }}
```
```jsx
// NEW
style={{ ...S.btn(GREEN, '#fff'), padding: '7px 16px', fontSize: 12, flexShrink: 0 }}
```

- [ ] **Step 1f: Fix ResearchCard bracket tip border (line ~434)**

```jsx
// OLD
<div style={{ padding: 12, background: 'rgba(22,163,74,0.07)', borderRadius: 8, border: '1px solid rgba(22,163,74,0.18)', fontSize: 13, color: '#7A7068', lineHeight: 1.5 }}>Bracket tip: ...
```
```jsx
// NEW
<div style={{ padding: 12, background: 'rgba(30,107,71,0.07)', borderRadius: 8, border: '1px solid rgba(30,107,71,0.18)', fontSize: 13, color: '#7A7068', lineHeight: 1.5 }}>Bracket tip: ...
```

- [ ] **Step 1g: Fix Final Four label colors (lines ~2042 and ~2087)**

Line ~2042:
```jsx
// OLD
<div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff0Label}</div>
```
```jsx
// NEW
<div style={{ fontSize: 13, fontWeight: 800, color: MINT_FG, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff0Label}</div>
```

Line ~2087 (same change, `ff1Label`):
```jsx
// OLD
<div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff1Label}</div>
```
```jsx
// NEW
<div style={{ fontSize: 13, fontWeight: 800, color: MINT_FG, letterSpacing: 1.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{ff1Label}</div>
```

- [ ] **Step 1h: Verify build compiles**

Run: `npm run build` in `C:\Users\Samca\Projects\March-Madness`
Expected: Build succeeds with no errors.

- [ ] **Step 1i: Commit**

```
git add src/App.jsx
git commit -m "fix: palette and contrast corrections (research tabs, regenerate btn, FF labels)"
```

---

## Task 2: Tile Size Reduction

Reduce `CW` (card width) from 240→210 and `SH` (slot height) from 136→116. Recalculate `ROUND_ABS` for new SH. Shrink compare zone from 34px→22px.

**Files:** Modify `src/App.jsx`

- [ ] **Step 2a: Update bracket constants (line ~1897)**

```jsx
// OLD
const CW = 240, SH = 136, FF_SCALE = 1.25;
```
```jsx
// NEW
const CW = 210, SH = 116, FF_SCALE = 1.25;
```

- [ ] **Step 2b: Update ROUND_ABS (lines ~1917–1922)**

```jsx
// OLD
const ROUND_ABS = [
  [0,136,272,408,544,680,816,952],
  [68,340,612,884],
  [204,748],
  [476],
];
```
```jsx
// NEW  — recalculated for SH=116 (R32 offset = SH/2 = 58; S16 = 3*SH/2 = 174; E8 = 7*SH/2 = 406 → 3.5*SH)
const ROUND_ABS = [
  [0, 116, 232, 348, 464, 580, 696, 812],
  [58, 290, 522, 754],
  [174, 638],
  [406],
];
```

- [ ] **Step 2c: Shrink compare zone in CSS style block (line ~2327)**

```css
/* OLD */
.compare-zone { position:relative; height:34px; cursor:pointer; overflow:hidden; user-select:none; }
```
```css
/* NEW */
.compare-zone { position:relative; height:22px; cursor:pointer; overflow:hidden; user-select:none; }
```

- [ ] **Step 2d: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2e: Commit**

```
git add src/App.jsx
git commit -m "feat: reduce tile footprint (CW 240→210, SH 136→116, compare zone 34→22px)"
```

---

## Task 3: Spine Row → Championship Standalone

Remove the spine row (round labels + championship box). Extract the championship box into its own centered section between the bracket halves. Round labels will be added as column headers in Task 5.

**Files:** Modify `src/App.jsx`

- [ ] **Step 3a: Extract championship box markup**

Note the championship box JSX inside the spine row (lines ~2055–2073). You'll need this content for the standalone section. It looks like:
```jsx
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
```

- [ ] **Step 3b: Replace the entire spine section with standalone championship box**

Find the `{/* SPINE */}` block — lines ~2049–2078:
```jsx
{/* SPINE */}
<div style={{ display: 'flex', alignItems: 'stretch', borderTop: '2px solid rgba(255,255,255,0.15)', borderBottom: '2px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.03)' }}>
  <SpineCell label="Round of 64" ... />
  ... (all SpineCell and championship box contents)
</div>
```

Replace the entire `{/* SPINE */}` block with:
```jsx
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
```

- [ ] **Step 3c: Remove SpineCell component definition (line ~1967–1974)**

The `SpineCell` inner component is no longer used. Find and delete:
```jsx
const SpineCell = ({ label, sub, color, borderLeft = true }) => (
  <div style={{ width: CW, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: borderLeft ? '1px solid rgba(255,255,255,0.08)' : 'none', background: 'rgba(255,255,255,0.04)' }}>
    <div style={{ height: SPINE_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
      {sub && <div style={{ fontSize: 15, color: '#777', fontStyle: 'italic', marginTop: 3 }}>{sub}</div>}
    </div>
  </div>
);
```

- [ ] **Step 3d: Remove SPINE_H variable (line ~1900)**

Find and delete:
```jsx
const SPINE_H = CHAMP_BOX_H + 16;
```

Note: keep `CHAMP_BOX_H` — it's still used by `ScaledGame` via `FF_H`.

- [ ] **Step 3e: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds, no "SpineCell is not defined" or similar errors.

- [ ] **Step 3f: Commit**

```
git add src/App.jsx
git commit -m "feat: remove spine row, championship renders as standalone centered section"
```

---

## Task 4: Move First Four Panel Above Bracket

The First Four panel currently renders below the bracket scroll. Move it above so students fill play-in games before encountering the main bracket.

**Files:** Modify `src/App.jsx`

- [ ] **Step 4a: Locate the bracket tab render block (~line 2413)**

Find the section that renders the basketball bracket tab. It currently looks like:
```jsx
{activeTournament === 'basketball' && (
  <>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderScoreBar(false)}</div>
    {renderScrollBracket(false, 'bscroll-bb')}
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderFirstFourPanel(false)}</div>
  </>
)}
```

Change to:
```jsx
{activeTournament === 'basketball' && (
  <>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderScoreBar(false)}</div>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderFirstFourPanel(false)}</div>
    {renderScrollBracket(false, 'bscroll-bb')}
  </>
)}
```

- [ ] **Step 4b: Do the same for the mammal tournament block**

Find the mammal block (a few lines below):
```jsx
{activeTournament === 'mammals' && (
  <>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderScoreBar(true)}</div>
    {mammalGenerating && (...)}
    {renderScrollBracket(true, 'bscroll-mm')}
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderFirstFourPanel(true)}</div>
  </>
)}
```

Change to:
```jsx
{activeTournament === 'mammals' && (
  <>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderScoreBar(true)}</div>
    <div style={{ maxWidth: 900, margin: '0 auto' }}>{renderFirstFourPanel(true)}</div>
    {mammalGenerating && (...)}
    {renderScrollBracket(true, 'bscroll-mm')}
  </>
)}
```

- [ ] **Step 4c: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4d: Commit**

```
git add src/App.jsx
git commit -m "feat: move First Four panel above bracket scroll"
```

---

## Task 5: Guttered Columns, Connector Fix, Round Headers

This is the core structural change. Adds 20px gaps between round columns, fixes connector line visibility (z-index: -1 → 1), routes connectors through the gutters, and adds round column headers.

**Files:** Modify `src/App.jsx`

- [ ] **Step 5a: Add GUTTER constant and update TOTAL_W (inside renderBracket, ~line 1977)**

Find:
```jsx
const TOTAL_W = CW * 11;
```
Replace with:
```jsx
const GUTTER = 20;
const TOTAL_W = CW * 11 + GUTTER * 10;
```

- [ ] **Step 5b: Update STUB constant (inside renderBracket, ~line 1903)**

Find:
```jsx
const STUB = CW * 0.45;
```
Replace with:
```jsx
const STUB = 8;
```

- [ ] **Step 5c: Update RoundCol to include gutter spacing**

Find the `RoundCol` component definition (inside `renderBracket`, ~line 1950):
```jsx
const RoundCol = ({ region, rIdx, flip, dir }) => {
  const games = activeBracket[region]?.rounds[rIdx] || [];
  const positions = ROUND_ABS[rIdx];
  return (
    <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative' }}>
```

Replace the outer `<div>` style only (keep interior identical):
```jsx
const RoundCol = ({ region, rIdx, flip, dir }) => {
  const games = activeBracket[region]?.rounds[rIdx] || [];
  const positions = ROUND_ABS[rIdx];
  return (
    <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative', marginRight: GUTTER }}>
```

- [ ] **Step 5d: Update Final Four center section widths**

Inside the top half and bottom half divs, find the center FF section:
```jsx
<div style={{ width: CW * 3, flexShrink: 0, height: TOP_H, ...
```
These two sections (top and bottom) use `CW * 3` which needs to account for gutters too:
```jsx
<div style={{ width: CW * 3 + GUTTER * 2, flexShrink: 0, height: TOP_H, ...
```
Apply this change to **both** center FF divs (one in the top half, one in the bottom half).

- [ ] **Step 5e: Fix BracketConnectors z-index (line ~2010)**

Find the SVG return line in `BracketConnectors`:
```jsx
return <svg width={TOTAL_W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: -1 }}>{lines}</svg>;
```
Change `zIndex: -1` to `zIndex: 1`:
```jsx
return <svg width={TOTAL_W} height={H} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}>{lines}</svg>;
```

- [ ] **Step 5f: Update BracketConnectors x-coordinate math to use gutters**

The `addRegionLines` function computes `xFrom` using `CW` multiples. With gutters, each column is spaced by `(CW + GUTTER)` instead of `CW`. Find `addRegionLines` (~line 1985):

```jsx
// OLD
const addRegionLines = (xBase, flip) => {
  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const color = LINE_COLORS[rIdx];
    const fromPositions = ROUND_ABS[rIdx], toPositions = ROUND_ABS[rIdx + 1];
    const xFrom = xBase + (flip ? (3 - rIdx) * CW : (rIdx + 1) * CW);
    const xStub = flip ? xFrom - STUB : xFrom + STUB;
    const xParent = flip ? xFrom - CW + STUB : xFrom + CW - STUB;
```

```jsx
// NEW — multiply column index by (CW + GUTTER) instead of CW
const addRegionLines = (xBase, flip) => {
  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const color = LINE_COLORS[rIdx];
    const fromPositions = ROUND_ABS[rIdx], toPositions = ROUND_ABS[rIdx + 1];
    const COL = CW + GUTTER;
    const xFrom = xBase + (flip ? (3 - rIdx) * COL : (rIdx + 1) * COL) - (flip ? 0 : GUTTER);
    const xStub = flip ? xFrom - STUB : xFrom + STUB;
    const xParent = flip ? xFrom - COL + STUB : xFrom + COL - STUB;
```

- [ ] **Step 5g: Update E8→FF connector x coordinates**

Find the two E8→FF connector lines (~lines 2005–2008):
```jsx
const eastE8Right = CW * 4, eastStubX = eastE8Right + STUB;
...
const westE8Left = CW * 7, westStubX = westE8Left - STUB;
```
Replace with gutter-aware math:
```jsx
const eastE8Right = CW * 4 + GUTTER * 3, eastStubX = eastE8Right + STUB;
...
const westE8Left = CW * 7 + GUTTER * 7, westStubX = westE8Left - STUB;
```

Also update `ffLeftEdge`/`ffRightEdge` (~line 2001):
```jsx
// OLD
const ffLeftEdge = CW * 4 + (CW * 3 - FF_W) / 2, ffRightEdge = ffLeftEdge + FF_W;
```
```jsx
// NEW
const ffLeftEdge = CW * 4 + GUTTER * 3 + (CW * 3 + GUTTER * 2 - FF_W) / 2, ffRightEdge = ffLeftEdge + FF_W;
```

- [ ] **Step 5h: Add round column header labels**

After `const RoundCol = ...` definition (after the closing `};` of `RoundCol`), add a new component:
```jsx
const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8'];
const RoundHeader = ({ rIdx }) => (
  <div style={{ width: CW, flexShrink: 0, marginRight: GUTTER, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#7A7068', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6 }}>
    {ROUND_LABELS[rIdx]}
  </div>
);
```

Then, above the top half div (line ~2037), add a header row:
```jsx
{/* ROUND HEADERS */}
<div style={{ display: 'flex', width: TOTAL_W, paddingTop: 4 }}>
  {[0,1,2,3].map(rIdx => <RoundHeader key={`hdr-east-${rIdx}`} rIdx={rIdx} />)}
  <div style={{ width: CW * 3 + GUTTER * 2, flexShrink: 0, textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#7A7068', textTransform: 'uppercase', letterSpacing: 1, paddingBottom: 6 }}>Final Four / Championship</div>
  {[3,2,1,0].map(rIdx => <RoundHeader key={`hdr-west-${rIdx}`} rIdx={rIdx} />)}
</div>
```

- [ ] **Step 5i: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5j: Visual check — open dev server**

Run: `npm run dev`
Open browser, navigate to Bracket tab. Verify:
- Connector lines are now visible (not hidden behind tiles)
- Gaps are visible between round columns
- Round header labels appear above each column
- Championship section is centered between halves

- [ ] **Step 5k: Commit**

```
git add src/App.jsx
git commit -m "feat: guttered columns, connector z-index fix, connector routing, round headers"
```

---

## Task 6: Bracket Wrapper UX — Scroll Fades + Zoom Toggle

**Files:** Modify `src/App.jsx`

- [ ] **Step 6a: Add zoom state**

Inside the main `App()` function, after the other bracket-related state declarations, add:
```jsx
const [bracketZoomed, setBracketZoomed] = useState(() => {
  try { return localStorage.getItem('mm-bracket-zoom') === 'out'; } catch { return false; }
});
```

- [ ] **Step 6b: Add scroll-position state for fade gradients**

Add two refs for the scroll containers:
```jsx
const bbScrollRef = useRef(null);
const mmScrollRef = useRef(null);
const [bbScrollPos, setBbScrollPos] = useState({ atStart: true, atEnd: false });
const [mmScrollPos, setMmScrollPos] = useState({ atStart: true, atEnd: false });
```

Add a scroll handler helper:
```jsx
const getScrollPos = (el) => ({
  atStart: el.scrollLeft <= 4,
  atEnd: el.scrollLeft >= el.scrollWidth - el.clientWidth - 4,
});
```

- [ ] **Step 6c: Update renderScrollBracket to include fade gradients and zoom**

Find `renderScrollBracket` (~line 2139):
```jsx
const renderScrollBracket = (isMammal, scrollClass) => (
  <div className={`${scrollClass} bscroll`} style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, cursor: 'grab', WebkitOverflowScrolling: 'touch' }}
    onMouseDown={...}>
    <div style={{ display: 'inline-block', paddingBottom: 8 }}>{renderBracket(isMammal)}</div>
  </div>
);
```

Replace with:
```jsx
const renderScrollBracket = (isMammal, scrollClass) => {
  const scrollRef = isMammal ? mmScrollRef : bbScrollRef;
  const scrollPos = isMammal ? mmScrollPos : bbScrollPos;
  const setScrollPos = isMammal ? setMmScrollPos : setBbScrollPos;
  return (
    <div style={{ position: 'relative' }}>
      {/* Zoom toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
        <button
          onClick={() => setBracketZoomed(z => {
            const next = !z;
            try { localStorage.setItem('mm-bracket-zoom', next ? 'out' : 'in'); } catch {}
            return next;
          })}
          style={{ ...S.btn('rgba(9,24,40,0.08)', '#7A7068'), padding: '4px 12px', fontSize: 11, boxShadow: 'none', border: '1px solid rgba(9,24,40,0.15)' }}
        >
          {bracketZoomed ? 'Zoom in' : 'Zoom out'}
        </button>
      </div>
      {/* Scroll fade — left */}
      {!scrollPos.atStart && (
        <div style={{ position: 'absolute', left: 0, top: 30, bottom: 0, width: 40, background: 'linear-gradient(to right, #E8E2D8, transparent)', pointerEvents: 'none', zIndex: 10 }} />
      )}
      {/* Scroll fade — right */}
      {!scrollPos.atEnd && (
        <div style={{ position: 'absolute', right: 0, top: 30, bottom: 0, width: 40, background: 'linear-gradient(to left, #E8E2D8, transparent)', pointerEvents: 'none', zIndex: 10 }} />
      )}
      <div
        ref={scrollRef}
        className={`${scrollClass} bscroll`}
        style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 4, cursor: 'grab', WebkitOverflowScrolling: 'touch' }}
        onScroll={e => setScrollPos(getScrollPos(e.currentTarget))}
        onMouseDown={e => {
          const el = e.currentTarget; el.style.cursor = 'grabbing';
          const startX = e.pageX - el.offsetLeft, startScroll = el.scrollLeft;
          const onMove = mv => { el.scrollLeft = startScroll - (mv.pageX - el.offsetLeft - startX); };
          const onUp = () => { el.style.cursor = 'grab'; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
          window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        }}
      >
        <div style={{ display: 'inline-block', paddingBottom: 8, transform: bracketZoomed ? 'scale(0.72)' : 'scale(1)', transformOrigin: 'top left', transition: 'transform 200ms ease-out' }}>
          {renderBracket(isMammal)}
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 6d: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6e: Commit**

```
git add src/App.jsx
git commit -m "feat: bracket scroll fade gradients and zoom toggle"
```

---

## Task 7: Tile Flare

Add 6 visual enhancements to the `GameSlot`/tile layer: pick pulse animation, team color stripe, seed context label (R64), lock state indicator, upset badge, research availability dot, and compare zone hover label update.

**Files:** Modify `src/App.jsx`

- [ ] **Step 7a: Add pick pulse keyframe to CSS style block**

In the `<style>` JSX block (~line 2326), add after the existing `@keyframes fadeIn`:
```css
@keyframes pickPulse { 0%{transform:scale(1)} 40%{transform:scale(1.05)} 100%{transform:scale(1)} }
.mm-tile-picked { animation: pickPulse 180ms ease-out; }
```

- [ ] **Step 7b: Trigger pulse on pick — in GameSlot Team component**

Inside `GameSlot`, find where a team row is clicked (the `onClick` that fires `onPick`). The pick div has `className={!locked && !isFF ? (isW ? 'mm-tile mm-tile-win' : 'mm-tile') : ''}`. 

Add a `pickedKey` state to `GameSlot` to track the last-picked side:
```jsx
const [pulseSide, setPulseSide] = useState(null);
```

Then in the Team render, update the className to add the pulse class when this side was just picked:
```jsx
className={!locked && !isFF ? (isW ? 'mm-tile mm-tile-win' : 'mm-tile') + (pulseSide === side ? ' mm-tile-picked' : '') : ''}
```

Update the onClick of the pick div to also set pulseSide:
```jsx
onClick={() => { if (!locked && !isFF) { onPick?.(side); setPulseSide(side); setTimeout(() => setPulseSide(null), 200); } }}
```

Note: `GameSlot` is a `memo`-wrapped component. `useState` is valid inside it. Find the `function GameSlot(...)` definition (~line 196) and add `const [pulseSide, setPulseSide] = useState(null);` near the top of the function body.

- [ ] **Step 7c: Add team color stripe**

In GameSlot's Team render for the horizontal row (line ~258), the div already has `boxShadow: isW ? \`inset 3px 0 0 ${MINT_FG}\` : 'inset 3px 0 0 transparent'`. This is the existing winner stripe. For non-mammal games, also show the team's `team.color` when picked.

Update to:
```jsx
boxShadow: isW ? `inset 3px 0 0 ${isMammal ? MINT_FG : (team.color || MINT_FG)}` : 'inset 3px 0 0 transparent'
```

Note: `isMammal` is already passed as a prop to `GameSlot`.

- [ ] **Step 7d: Add seed context label on R64 tiles**

Inside `GameSlot`, the `roundIdx` prop is 0 for R64. After the bottom Team render (before the `isLiveGame` LIVE banner div), add:
```jsx
{roundIdx === 0 && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
  <div style={{ textAlign: 'center', fontSize: 9, color: '#7A7068', paddingBottom: 3, letterSpacing: 0.5 }}>
    {`#${top.seed} vs #${bottom.seed}`}
  </div>
)}
```

- [ ] **Step 7e: Add lock state indicator to tile**

The `GameSlot` already has a `.locked-stamp` element for locked brackets (line ~328). Check if `locked-stamp` CSS exists in the style block. If it does, it already renders "LOCKED". The spec asks for a Lucide `Lock` icon in the top-right of the tile instead. The existing locked-stamp already shows `<Lock size={10} ... />LOCKED`. This is already implemented — verify it's visible. If it is, skip this step.

- [ ] **Step 7f: Add upset badge**

Inside `GameSlot`'s Team row render, after the team name span, add an upset indicator. An upset occurs when `isW` (this team won) AND `team.seed > opponent.seed` (lower seed beats higher seed, noting seed 1 = best).

In the Team component inside GameSlot, `top` and `bottom` are in scope. The opponent of `top` is `bottom` and vice versa. Add this inside the Team row div, after the name span:
```jsx
{isW && !isMammal && (() => {
  const opponent = side === 'top' ? bottom : top;
  if (team?.seed && opponent?.seed && Number(team.seed) > Number(opponent.seed)) {
    return <span style={{ fontSize: 8, fontWeight: 800, color: '#C4952A', background: 'rgba(196,149,42,0.12)', border: '1px solid rgba(196,149,42,0.35)', borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>UPSET</span>;
  }
  return null;
})()}
```

- [ ] **Step 7g: Add research availability dot**

`GameSlot` receives `mammalResearchData` as a prop for mammal games. For basketball games, we need to pass `researchData` too. 

First, add `researchData` prop to all `GameSlot` usages inside `RoundCol` and the FF/championship calls:
- In `RoundCol`'s `GameSlot` render, add `researchData={isMammal ? {} : researchData}`
- In the FF `GameSlot` calls, add `researchData={isMammal ? {} : researchData}`
- In the championship `GameSlot` call, add `researchData={isMammal ? {} : researchData}`

Then in `GameSlot`'s function signature, add `researchData = {}` to the destructured props.

Inside the `GameSlot` return JSX, add a research dot for any team that has data. Add this inside the outer slot wrapper `<div>` (after `<Team team={top} side="top" />`), as a positioned element:
```jsx
{(() => {
  const hasResearchTop = isMammal ? !!mammalResearchData[top?.name] : !!researchData[top?.name];
  const hasResearchBot = isMammal ? !!mammalResearchData[bottom?.name] : !!researchData[bottom?.name];
  if (!hasResearchTop && !hasResearchBot) return null;
  return (
    <div style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: MINT_FG, opacity: 0.7 }} title="Research available" />
  );
})()}
```

The outer GameSlot wrapper already has `position: 'relative'` (line ~293).

- [ ] **Step 7h: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7i: Commit**

```
git add src/App.jsx
git commit -m "feat: tile flare — pick pulse, color stripe, seed context, upset badge, research dot"
```

---

## Task 8: Compare Modal Redesign

Rebuild `CompareModal` with real visual presence, slide-up animation, stat comparison bars, and a pick CTA. The component is entirely self-contained at lines 527–579.

**Files:** Modify `src/App.jsx`

- [ ] **Step 8a: Replace CompareModal entirely**

Delete lines 527–579 (from `// ── COMPARE MODAL` through the closing `}`) and replace with:

```jsx
// ── COMPARE MODAL ─────────────────────────────────────────────────────────────
function CompareModal({ teamA, teamB, cardA, cardB, isMammal, onClose, onPick, isLocked }) {
  const NUMERIC_STATS = isMammal
    ? [['Size', 'size'], ['Speed', 'speed'], ['Lifespan', 'lifespan']]
    : [['KenPom', 'kenpom'], ['Offense', 'offense'], ['Defense', 'defense'], ['Pace', 'pace']];
  const PERF_STATS = isMammal
    ? [['Habitat', 'habitat'], ['Diet', 'diet']]
    : [['Rank', 'rank'], ['Conference', 'conference'], ['Record', 'record']];
  const SCOUT_STATS = isMammal
    ? [['Battle Strength', 'battleStrength'], ['Superpower', 'superpower']]
    : [['Odds', 'odds'], ['Strengths', 'strengths'], ['Weaknesses', 'weaknesses']];

  const parseNum = (v) => { if (!v) return null; const n = parseFloat(String(v).replace(/[^0-9.-]/g, '')); return isNaN(n) ? null : n; };

  const StatBar = ({ label, keyName }) => {
    const vA = cardA?.[keyName], vB = cardB?.[keyName];
    const nA = parseNum(vA), nB = parseNum(vB);
    const hasBar = nA !== null && nB !== null;
    const aWins = hasBar && (keyName === 'rank' ? nA < nB : nA > nB);
    const bWins = hasBar && !aWins;
    const total = hasBar ? nA + nB : 1;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ flex: 1, textAlign: 'right' }}>
          {hasBar && <div style={{ height: 4, borderRadius: 2, background: aWins ? MINT_FG : 'rgba(255,255,255,0.12)', marginBottom: 4, width: `${(nA / total) * 100}%`, marginLeft: 'auto' }} />}
          <span style={{ fontSize: 12, color: aWins ? '#fff' : 'rgba(255,255,255,0.38)', fontWeight: aWins ? 700 : 400 }}>{vA || '—'}</span>
        </div>
        <div style={{ width: 90, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, flexShrink: 0 }}>{label}</div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <span style={{ fontSize: 12, color: bWins ? '#fff' : 'rgba(255,255,255,0.38)', fontWeight: bWins ? 700 : 400 }}>{vB || '—'}</span>
          {hasBar && <div style={{ height: 4, borderRadius: 2, background: bWins ? MINT_FG : 'rgba(255,255,255,0.12)', marginTop: 4, width: `${(nB / total) * 100}%` }} />}
        </div>
      </div>
    );
  };

  const TextStat = ({ label, keyName }) => {
    const vA = cardA?.[keyName], vB = cardB?.[keyName];
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ flex: 1, textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{vA || '—'}</div>
        <div style={{ width: 90, textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, flexShrink: 0, paddingTop: 2 }}>{label}</div>
        <div style={{ flex: 1, textAlign: 'left', fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{vB || '—'}</div>
      </div>
    );
  };

  const SectionLabel = ({ label }) => (
    <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2, marginTop: 14, marginBottom: 2 }}>{label}</div>
  );

  const accentA = isMammal ? MINT_FG : (teamA?.color || MINT_FG);
  const accentB = isMammal ? MINT_FG : (teamB?.color || MINT_FG);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, maxWidth: 520, width: '100%', marginTop: 20, animation: 'modalSlideUp 240ms cubic-bezier(0.32,0.72,0,1) both', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px 0' }}>
          <button onClick={onClose} aria-label="Close" style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Team hero */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 0 16px' }}>
          {/* Team A */}
          <div style={{ flex: 1, textAlign: 'right', padding: '8px 16px 0', borderTop: `3px solid ${accentA}` }}>
            {!isMammal && teamA?.espnId && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><TeamLogo espnId={teamA.espnId} name={teamA.name} size={64} /></div>}
            {isMammal && cardA?.wikiImageUrl && <img src={cardA.wikiImageUrl} alt={teamA.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block', marginLeft: 'auto', marginBottom: 8 }} />}
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 2 }}>#{teamA?.seed}</div>
            <div style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{teamA?.name}</div>
          </div>
          {/* VS */}
          <div style={{ width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>VS</span>
            <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>
          {/* Team B */}
          <div style={{ flex: 1, textAlign: 'left', padding: '8px 16px 0', borderTop: `3px solid ${accentB}` }}>
            {!isMammal && teamB?.espnId && <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}><TeamLogo espnId={teamB.espnId} name={teamB.name} size={64} /></div>}
            {isMammal && cardB?.wikiImageUrl && <img src={cardB.wikiImageUrl} alt={teamB.name} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 8 }} />}
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 2 }}>#{teamB?.seed}</div>
            <div style={{ fontFamily: "'Libre Bodoni', serif", fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{teamB?.name}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ padding: '0 20px 8px' }}>
          <SectionLabel label={isMammal ? 'Profile' : 'Performance'} />
          {PERF_STATS.map(([label, key]) => <TextStat key={key} label={label} keyName={key} />)}
          <SectionLabel label={isMammal ? 'Stats' : 'Analytics'} />
          {NUMERIC_STATS.map(([label, key]) => <StatBar key={key} label={label} keyName={key} />)}
          <SectionLabel label="Scouting" />
          {SCOUT_STATS.map(([label, key]) => <TextStat key={key} label={label} keyName={key} />)}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {!isLocked && onPick && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <button
                onClick={() => { onPick('top'); onClose(); }}
                style={{ flex: 1, padding: '11px 8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              >
                {teamA?.name} wins
              </button>
              <button
                onClick={() => { onPick('bottom'); onClose(); }}
                style={{ flex: 1, padding: '11px 8px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 150ms' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              >
                {teamB?.name} wins
              </button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8b: Add modalSlideUp keyframe to CSS style block**

In the `<style>` JSX block, add:
```css
@keyframes modalSlideUp { from{opacity:0;transform:translateY(40px)} to{opacity:1;transform:translateY(0)} }
```

- [ ] **Step 8c: Pass onPick and isLocked to CompareModal**

Find where `compareModal` state is used to render `CompareModal` (search for `<CompareModal`). It should look like:
```jsx
{compareModal && <CompareModal teamA={compareModal.teamA} teamB={compareModal.teamB} cardA={compareModal.cardA} cardB={compareModal.cardB} isMammal={compareModal.isMammal} onClose={() => setCompareModal(null)} />}
```

The `onPick` callback needs to trigger the actual bracket pick for the relevant game. The `compareModal` state object (set by `handleCompare`) contains the teams but not the game slot info needed to fire a pick. 

The simplest approach: the pick buttons in the modal trigger a `onPick(side)` that navigates to the bracket and picks — but since picks require knowing the region, round, and game index, this wiring is complex. 

**Simplified approach for this version:** Pass `onPick` as a no-op but still render the pick buttons. They will close the modal without making a pick. The student can then tap the tile. Leave a comment for the future enhancement.

```jsx
{compareModal && <CompareModal
  teamA={compareModal.teamA}
  teamB={compareModal.teamB}
  cardA={compareModal.cardA}
  cardB={compareModal.cardB}
  isMammal={compareModal.isMammal}
  onClose={() => setCompareModal(null)}
  onPick={null}
  isLocked={compareModal.isMammal ? mammalLocked : locked}
/>}
```

Setting `onPick={null}` hides the pick buttons (since the condition `!isLocked && onPick &&` gates them). This avoids wiring complexity while still shipping the redesigned modal.

- [ ] **Step 8d: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8e: Visual check**

Run: `npm run dev`, open bracket, click a compare zone. Verify:
- Modal slides up from below
- Teams show with logo/image headers
- Stats display in sections with bars for numeric fields
- Superior stats highlighted
- Close button is a proper icon button

- [ ] **Step 8f: Commit**

```
git add src/App.jsx
git commit -m "feat: CompareModal redesign — slide-up animation, stat bars, hero headers, grouped sections"
```

---

## Task 9: Bracket Complete Confetti

Fire a one-time confetti burst when the student completes all 63 picks. Uses the existing `canvas-confetti` library (already installed and imported).

**Files:** Modify `src/App.jsx`

- [ ] **Step 9a: Add a completion ref near the top of App()**

Inside the main `App()` function, near other refs:
```jsx
const bracketCompleteRef = useRef(false);
const mammalCompleteRef = useRef(false);
```

- [ ] **Step 9b: Add completion confetti trigger inside renderBracket**

Inside `renderBracket`, after the line `const isComplete = totalPicks >= 63;` (around line 1937), add:

```jsx
const completeRef = isMammal ? mammalCompleteRef : bracketCompleteRef;
if (!isComplete) {
  completeRef.current = false;
} else if (!completeRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  completeRef.current = true;
  setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#C4952A', '#1E6B47', '#B8CBE8', '#091828'] }), 0);
}
```

- [ ] **Step 9c: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 9d: Commit**

```
git add src/App.jsx
git commit -m "feat: confetti burst when student completes all 63 bracket picks"
```

---

## Task 10: Push to Remote

- [ ] **Step 10a: Push all commits**

```
git push origin main
```

---

## Verification Checklist

After all tasks complete:

- [ ] Connector lines visible on basketball and mammal brackets
- [ ] Connectors route through gutters, not through tile text
- [ ] Round column headers readable above each column
- [ ] Championship section centered between bracket halves, spine row gone
- [ ] First Four panel appears above bracket scroll
- [ ] Zoom toggle works and persists across page reload
- [ ] Scroll edge fades appear when bracket is scrollable
- [ ] R64 tiles show "# vs #" seed context
- [ ] Picked tiles show team color stripe
- [ ] Lower-seed pick shows UPSET badge
- [ ] Pick pulse fires on selection (180ms scale animation)
- [ ] Research dot visible on tiles with research data
- [ ] Compare modal slides up on open
- [ ] Compare modal has solid dark card surface
- [ ] Stats render in sections with bars for numeric fields
- [ ] Superior stat is highlighted, inferior is dimmed
- [ ] Modal close button is a proper icon button
- [ ] Research tab region labels pass contrast check (dark text on light bg)
- [ ] Mammal Regenerate button is green, not indigo
- [ ] All colors on palette — no `#4ade80`, `#34d399`, `#6366f1`
- [ ] Confetti fires once at 63/63, resets when picks cleared
- [ ] Build passes with `npm run build`
