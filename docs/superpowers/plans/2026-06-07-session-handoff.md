# Session Handoff — 2026-06-07

## Project
Hart Middle School March Madness Bracket Challenge  
**Stack:** React 18 + Vite + Firebase, inline styles only, no CSS files except a `<style>` JSX block inside `App.jsx`.  
**Single file:** all UI is in `src/App.jsx` (~2600 lines). Nothing else changes.  
**Deploy:** Vercel, auto-deploys on push to `main`.  
**Repo:** `https://github.com/samcastillo71-cmd/March-Madness`

---

## Canonical Palette (LOCKED — never modify)

| Token | Value | Use |
|---|---|---|
| `PAGE_BG` | `#E8E2D8` | Page background |
| `CARD_BG` | `#F4EFE6` | Card surfaces |
| `TEXT` | `#1A1208` | Primary text |
| `NAVY` | `#091828` | Header, dark surfaces |
| `GREEN` | `#1A4332` | Primary action |
| `GOLD` | `#C4952A` | Accent, badges |
| `MINT_BG` | `#C2EDD5` | Winner chip bg |
| `MINT_FG` | `#1E6B47` | Winner chip fg, superior stat highlight |
| `BORDER` | `#C8BFB0` | Dividers, tile borders |
| `MUTED` | `#7A7068` | Secondary text |
| `NAVY_MID` | `#1C3558` | Mid-dark surfaces |
| `NAVY_LIGHT` | `#B8CBE8` | Nav inactive text (dark bg only) |

Global CSS reset in `index.html`: `*, *::before, *::after { box-sizing: border-box; }` — applies to all elements.

---

## What Was Completed This Session

The `2026-06-06-bracket-redesign.md` plan (10 tasks) was fully executed, then 3 post-deployment visual bug fixes were applied.

### Plan Tasks (all shipped)
1. Palette & contrast corrections (research tabs, Regenerate btn, FF labels)
2. Tile size reduction: CW 240→210, SH 136→116, compare zone 34→22px
3. Spine row removed → championship renders as standalone centered section
4. First Four panel moved above bracket scroll
5. Guttered columns (20px between each round), connector routing, round headers
6. Scroll fade gradients + zoom toggle (persists in localStorage)
7. Tile flare: pick pulse animation, team color stripe, upset badge, research dot
8. CompareModal redesign: slide-up, hero headers, stat bars, grouped sections
9. Confetti on bracket completion (63/63 picks)
10. Push to remote

### Post-Deployment Visual Bug Fixes (3 commits after plan)

**Commit `63cc526` — Connector centering math**
- `GAME_MID_OFFSET`: 50 → 55 (= 44px top team + 11px half of 22px compare zone)
- `GAME_MID_OFFSET_BOT`: 39 → 55 (same logic from bottom)
- TBD row height: `height: 36` → `minHeight: 44, boxSizing: border-box` — so tiles are always 110px whether teams are TBD or filled
- `ffMidY`: `ffTopY + GAME_MID_OFFSET` → `ffTopY + Math.round(GAME_MID_OFFSET * FF_SCALE)` — corrects for the 1.25x FF tile scale

**Commit `a096ef5` — Z-index: tiles above connectors**
- Added `zIndex: 2` to RoundCol outer div
- Added `position: 'relative', zIndex: 2` to both FF center divs (top and bottom half)
- SVG (BracketConnectors) remains at `zIndex: 1`

**Commit `9598f01` — TBD height + stacking context isolation**
- Fixed root cause of top-region misalignment: when `canCompare` is false (either team TBD), the compare zone was rendering as a `height: 1` divider, making the tile 89px instead of 110px. Wrapped the divider in a `height: 22` container to keep tile height constant.
- Added `isolation: 'isolate'` to both TOP HALF and BOTTOM HALF flex containers, creating a proper CSS stacking context so SVG z=1 / RoundCols z=2 ordering is unambiguous.

---

## Current Architecture — Bracket Layout

```
renderBracket(isMammal) → inside App()
  renderScrollBracket → zoom + scroll fades wrapper

Key constants (inside renderBracket):
  CW = 210, SH = 116, FF_SCALE = 1.25
  GUTTER = 20 (gap between round columns)
  STUB = 8 (connector stub length in px)
  TOTAL_W = CW * 11 + GUTTER * 10   (full bracket width)
  TOP_H = SH * 8 = 928              (height of each half)
  FF_W = Math.round(CW * 1.25)      (= 263)
  FF_H = Math.round(SH * 1.25)      (= 145)
  FF_GAP = Math.round(SH / 2)       (= 58)
  GAME_MID_OFFSET = 55              (top half: connector y = tile_top + 55)
  GAME_MID_OFFSET_BOT = 55          (bottom half: connector y = H - tile_bottom - 55)

ROUND_ABS positions (top of each game tile from container edge):
  R64: [0, 116, 232, 348, 464, 580, 696, 812]
  R32: [58, 290, 522, 754]
  S16: [174, 638]
  E8:  [406]

Layout structure:
  <div width={TOTAL_W}>
    <RoundHeaders row>
    <div display:flex, isolation:isolate>   ← TOP HALF (East + West)
      <BracketConnectors dir="top" />      ← SVG, position:absolute, zIndex:1
      4x RoundCol (East, rIdx 0-3)         ← position:relative, zIndex:2
      <FF center div zIndex:2>             ← top FF game + label
      4x RoundCol (West, rIdx 3-0, flip)   ← position:relative, zIndex:2
    </div>
    <Championship standalone section>
    <div display:flex, isolation:isolate>   ← BOTTOM HALF (South + Midwest)
      <BracketConnectors dir="bot" />      ← SVG, position:absolute, zIndex:1
      4x RoundCol (South)
      <FF center div zIndex:2>
      4x RoundCol (Midwest, flip)
    </div>
  </div>

Tile geometry (box-sizing: border-box globally):
  GameSlot total height = 110px:
    Top Team row:    minHeight 44px
    Compare zone:    22px (always, even when TBD — wrapped in height:22 container)
    Bottom Team row: minHeight 44px
  Connector line y = tile_top + 55 for top half, H - tile_bottom - 55 for bottom half

BracketConnectors connector geometry (East side example):
  xFrom = tile right edge (exits into gutter)
  xStub = xFrom + STUB (8px into gutter)
  xParent = xFrom + COL - STUB (enters parent tile — hidden by tile background via z-ordering)
  Vertical line at xStub connects the two child game mids
  Horizontal from xStub to xParent at the parent game's yMid
```

---

## Key Component Locations (approximate lines)

| Component / Function | Line |
|---|---|
| `GameSlot` (memo component) | ~206 |
| `Team` (inside GameSlot) | ~228 |
| Compare zone render (canCompare / divider) | ~303 |
| `CompareModal` | ~596 |
| `renderBracket` constants | ~1970 |
| `BracketConnectors` | ~2060 |
| `addRegionLines` | ~2065 |
| `RoundCol` | ~2031 |
| `GAME_MID_OFFSET` | ~2058 |
| TOP HALF flex container | ~2124 |
| BOTTOM HALF flex container | ~2158 |
| `<style>` JSX block | ~2430 |

---

## Known State / Potential Issues

The connector visual fix relies on `isolation: 'isolate'` ensuring that tile backgrounds (z=2) cover connector lines that extend into tile areas. If connectors still show through tiles on any browser/platform, the fallback fix is to change `BracketConnectors` SVG to `zIndex: -1` and give its containing flex container an explicit `z-index: 0` instead of just `isolation`.

The connector lines in the gutter are correct. Lines that extend INTO tile areas are intentional (they become invisible because tile backgrounds cover them). The connector appears to terminate at the tile edge, which is the intended visual.

No outstanding functional bugs are known. The deployment is current as of commit `9598f01`.

---

## How to Continue

1. Pull latest: `git pull`
2. Install deps (if fresh machine): `npm install` in `C:\Users\Samca\Projects\March-Madness`
3. Dev server: `npm run dev`
4. Deploy: `git push` (Vercel auto-deploys)
5. All work goes in `src/App.jsx` only
