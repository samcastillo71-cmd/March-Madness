# Bracket Tab Redesign — Design Spec
**Project:** Hart Middle School March Madness Bracket Challenge  
**Date:** 2026-06-06  
**Stack:** React 18 + Vite + Firebase, inline styles only, canonical palette locked

---

## Palette Reference (locked — do not modify)

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

---

## 1. Bracket Structure

### 1.1 Column sizing

Reduce tile footprint to create breathing room without losing readability:

- `CW`: 240 → 210px  
- `SH`: 136 → 116px  
- Compare zone height: 34px → 22px  
- Team padding: 10px → 8px top/bottom  

### 1.2 Guttered columns (Approach B)

Add a 20px gap between each round column. This creates a visible gutter where connector lines can run without overlapping tile backgrounds.

- Each column renders inside a wrapper div of width `CW + 20` (230px)  
- Connector x-coordinates shift by `+20px` per column crossing  
- `TOTAL_W` recalculated to account for gutters: `CW * 8 + 20 * 7` (left half) × 2 + championship gap  

### 1.3 Round column headers

Add a label row above each round column. Labels: `"Round of 64"`, `"Round of 32"`, `"Sweet 16"`, `"Elite 8"`, `"Final Four"`, `"Championship"`. Style: `fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center'`. Position: `position: absolute` above the first tile in each column, `top: -28px`.

### 1.4 ROUND_ABS recalculation

Recalculate for `SH = 116`:

```
R64:  [0, 116, 232, 348, 464, 580, 696, 812]
R32:  [58, 290, 522, 754]
S16:  [174, 638]
E8:   [406]
```

### 1.5 Spine row

Remove the spine row entirely. The championship game renders as a standalone centered box between the two bracket halves. Style consistent with existing tile design. Label above it: `"Championship"`.

### 1.6 First Four panel

Move the First Four panel above the bracket scroll container, not below it. Students fill in First Four before encountering the main bracket.

### 1.7 Final Four labels

`#34d399` → `MINT_FG` (`#1E6B47`). The label text currently reads as a stray color outside the palette.

---

## 2. Connector Lines

### 2.1 Z-index fix

`BracketConnectors` SVG currently has `zIndex: -1` — connectors are invisible behind tile backgrounds.

Change to `zIndex: 1`. Tiles render at default stacking context; connectors float above them in the SVG layer. The SVG is already `pointerEvents: 'none'` so this does not affect interaction.

### 2.2 Connector routing

With guttered columns, connectors route through the 20px gutter gap rather than through tile middles. The stub length (`STUB`) narrows from `CW * 0.45` to `8px` — just enough to exit the tile edge and enter the gutter. The horizontal line runs through the gutter center. This eliminates the visual clutter of lines passing through opponent name text.

### 2.3 Connector color

Use `rgba(9,24,40,0.15)` for neutral connectors, `MINT_FG` at `rgba(30,107,71,0.5)` for connectors where a pick has been made. This gives visual feedback that the bracket is being filled in.

---

## 3. Tile Flare

### 3.1 Pick confirmation pulse

On tile selection, animate the tile: `transform: scale(1.0) → scale(1.05) → scale(1.0)` over 180ms total (90ms out, 90ms back). Use `requestAnimationFrame` or a CSS class toggle with the `fadeIn` keyframe approach already used in the app. This gives tactile feedback that a pick registered.

### 3.2 Team color stripe

Each basketball team tile gets a 3px left border using `team.color` (the ESPN hex value already stored in the team data). When no pick has been made, `borderLeft: '3px solid transparent'`. When picked, `borderLeft: '3px solid ${team.color}'`. For mammal tiles, use `MINT_FG` as the stripe color when picked.

### 3.3 Upset badge

When a lower-seeded team is picked over a higher-seeded team (higher seed number = lower seed rank), display a small badge on the tile: `"UPSET"`. Style: `fontSize: 9, fontWeight: 800, color: GOLD, background: rgba(196,149,42,0.12), border: '1px solid rgba(196,149,42,0.35)', borderRadius: 4, padding: '1px 5px'`. Position: top-right of the tile, inline with the team name.

### 3.4 Seed context label

On R64 tiles only, display the matchup seed notation below the team names: `"1 vs 16"`. Style: `fontSize: 9, color: MUTED, textAlign: 'center', paddingBottom: 4`. Only renders when both seeds are known.

### 3.5 Lock state indicator

When the bracket is locked (`bracketLocked === true`), tiles show a small lock icon (Lucide `Lock` at 10px) in the top-right corner instead of the pick affordance. Tile cursor changes to `default`. This makes the locked state visually obvious rather than just disabling clicks silently.

### 3.6 Research availability dot

For any team that has a `ResearchCard` entry, display a 4px filled circle (`borderRadius: '50%', width: 4, height: 4, background: MINT_FG`) in the tile's top-right area. On hover, a tooltip-style label: `"Research available"`. This signals to students that they can compare before picking.

### 3.7 Compare zone hover label

The compare zone (currently `"vs"` in 22px of space) animates to `"Compare →"` on hover. CSS transition: `opacity 150ms ease`. This makes the affordance obvious — students understand tapping the zone opens a comparison.

---

## 4. Bracket Wrapper UX

### 4.1 Scroll edge fade gradients

The horizontal scroll container gets left and right fade masks:

```js
// Left edge
position: 'absolute', left: 0, top: 0, bottom: 0, width: 40,
background: 'linear-gradient(to right, #E8E2D8, transparent)',
pointerEvents: 'none', zIndex: 10

// Right edge
position: 'absolute', right: 0, top: 0, bottom: 0, width: 40,
background: 'linear-gradient(to left, #E8E2D8, transparent)',
pointerEvents: 'none', zIndex: 10
```

These fade in/out based on scroll position (hidden at each extreme, visible when scrollable).

### 4.2 Zoom toggle

A small toggle button above the bracket: `"Zoom out"` / `"Zoom in"`. When zoomed out, the bracket wrapper gets `transform: scale(0.72), transformOrigin: 'top left'`. The wrapper's outer container adjusts height to account for the scale reduction: `height: naturalHeight * 0.72`. Zoomed state persists in `localStorage` per tournament.

### 4.3 Score bar mobile layout

The score bar currently uses `display: flex` with no wrap control. Add `flexWrap: 'wrap'` and `gap: 6` so stat chips stack gracefully at narrow widths rather than overflowing or compressing.

### 4.4 Bracket complete confetti

When `totalPicks === 63` (all games picked), trigger a one-time confetti burst. Use a lightweight CSS keyframe approach: generate 30 small `div` elements absolutely positioned, each with a random color from the palette (`GOLD`, `MINT_FG`, `GREEN`, `NAVY_LIGHT`), random horizontal position, and a `fall` keyframe animation (`translateY(-20px) → translateY(100vh)`, 1.2–2s duration, ease-in). Mount them in a `position: fixed` overlay, remove them after 2.5s. No external library.

---

## 5. Compare Modal Redesign

### 5.1 Entry animation

The modal card slides up on open: `translateY(40px) + opacity: 0 → translateY(0) + opacity: 1` over 240ms with `cubic-bezier(0.32, 0.72, 0, 1)`. This replaces the current instant mount.

### 5.2 Modal surface

The card background changes from `rgba(9,24,40,0.10)` to a solid `#0D1B2A`. This gives the modal actual visual presence against the dark overlay. Card border: `1px solid rgba(255,255,255,0.08)`. Card border-radius: `16px`. Max-width: `520px`.

### 5.3 Team hero headers

Replace the current 44px team images with a proper hero section at the top of the modal. Each team gets a half-panel (left team / right team, `50% / 50%`):

- Team logo or image at `72px`  
- Team name in Libre Baskerville at `20px`, `fontWeight: 700`, `color: #fff`  
- Seed badge: `fontSize: 10, background: rgba(255,255,255,0.1), borderRadius: 4, padding: '2px 6px'`  
- For basketball teams: a 3px top border using `team.color` as the accent stripe  
- For mammal teams: a 3px top border in `MINT_FG`  

The VS divider sits between the two panels: larger text (`32px`), `fontWeight: 900`, `color: rgba(255,255,255,0.25)`, with a thin vertical hairline either side.

### 5.4 Grouped stat sections

Stats render in three sections, each with a `10px uppercase tracking-wide` section label:

**Performance:** Rank, Record, KenPom rating  
**Analytics:** Offense rating, Defense rating, Pace  
**Scouting:** Strengths, Weaknesses, Tournament odds  

### 5.5 Visual comparison bars (numeric stats)

For all numeric stat fields (Rank, KenPom, Offense, Defense, Pace), each stat row renders a small horizontal bar pair:

```
Left team bar ████████░░  stat value  ░░████████ Right team bar
```

Each bar is `height: 4px, borderRadius: 2px`. Bar width is proportional to the stat value relative to the opponent. The superior value gets `background: MINT_FG`, the inferior gets `background: rgba(255,255,255,0.15)`. The stat value text: `fontSize: 11, color: #fff` for superior, `color: rgba(255,255,255,0.4)` for inferior.

### 5.6 "Who wins?" pick CTA

At the bottom of the modal, two full-width buttons (side by side, each `48%` width):

- Left: left team name, `background: rgba(255,255,255,0.08)`, `border: 1px solid rgba(255,255,255,0.15)`, `borderRadius: 10`, `color: #fff`, `fontSize: 13`, `fontWeight: 700`  
- Right: same, mirrored  

On click: picks that team as the winner in the bracket (same as tapping the tile), closes the modal. Buttons have `cursor: pointer` and a hover state: `background: rgba(255,255,255,0.14)`.

If the bracket is locked, these buttons are hidden.

### 5.7 "View Research" link

A small text link at the bottom of the modal: `"View full research →"`. `fontSize: 11, color: NAVY_LIGHT, cursor: 'pointer'`. Clicking it closes the modal, sets the active tab to `'research'`, and pre-selects the relevant team. For mammal tournaments, links to the mammal research section.

### 5.8 Close button

Replace the current plain `×` character with a proper icon button: Lucide `X` at `16px`, wrapped in a `28x28` button with `borderRadius: '50%'`, `background: rgba(255,255,255,0.08)`, `border: none`, `cursor: 'pointer'`. Positioned top-right of the modal card.

### 5.9 Off-palette color fix

`accent = '#4ade80'` for basketball → `MINT_FG` (`#1E6B47`). The `#86efac` mammal accent is acceptable but should also align to `MINT_FG` for consistency.

---

## 6. Research Tab Fixes

### 6.1 Region tab inactive text contrast

`S.navBtn` uses `color: '#B8CBE8'` for inactive state — designed for dark header backgrounds. On the page background (`#E8E2D8`), this gives ~1.3:1 contrast (WCAG fail).

At all four content-area region tab usages (lines ~2521, ~2570, ~2599, ~2649), override the inactive color:

```js
color: tab === activeTab ? '#fff' : TEXT  // #1A1208
```

This applies only to content-area tabs, not to the header nav where `#B8CBE8` is correct on `#091828` background.

### 6.2 Region tab row divider

`rgba(255,255,255,0.08)` → `rgba(9,24,40,0.12)`. The current value is nearly invisible on a light background.

### 6.3 Mammal Regenerate button

The Regenerate button in `MammalResearchCard` uses `#6366f1` (indigo). Change to `GREEN` (`#1A4332`) with white text.

### 6.4 Research card bracket tip border

The "Bracket tip" section uses `rgba(22,163,74,...)` (off-palette green). Change to `rgba(30,107,71,0.3)` (MINT_FG-based).

---

## 7. Research-Bracket Integration

### 7.1 Research dot on tiles

A 4px `MINT_FG` circle renders in the top-right area of any tile where research data exists for that team. Logic: check if `researchData[team.name]` (or the mammal equivalent) is non-null. This is a visual signal only — no tooltip on desktop, a `title` attribute on the element for accessibility.

### 7.2 "View Research" in CompareModal

As specified in §5.7. The link appears for any team that has research data. For teams without research data, the link is hidden.

---

## 8. Out of Scope

These items are explicitly excluded from this implementation:

- Tournament bracket expansion (NCAA field size changes). The `/ 1,920 pts` maximum would need a separate update when the expansion details are confirmed.  
- Changing the canonical palette.  
- Adding new Firebase collections or schema changes.  
- Changing the mobile hamburger nav behavior (already shipped).  
- Any changes to the Admin or Teacher tabs.  

---

## 9. Implementation Order

Recommended sequence to minimize regression risk:

1. **Research tab contrast fixes** — isolated, no layout impact (§6.1–6.4)  
2. **Score bar mobile fix** — one-line change (§4.3)  
3. **Final Four label color fix** — one-line change (§1.7)  
4. **CW/SH reduction + ROUND_ABS recalc** — verify layout before adding gutters (§1.1, §1.4)  
5. **Spine row removal + championship box** — removes ~30 lines (§1.5)  
6. **First Four panel relocation** — move render call (§1.6)  
7. **Guttered columns + connector routing** — layout math changes (§1.2, §2.2)  
8. **Connector z-index fix** — one-line change (§2.1)  
9. **Connector color (picks vs. empty)** — add pick-state logic to SVG (§2.3)  
10. **Round column headers** — add label row above columns (§1.3)  
11. **Scroll fade gradients** — wrapper decoration (§4.1)  
12. **Zoom toggle** — new state + transform wrapper (§4.2)  
13. **Team color stripe on tiles** — add borderLeft to tile style (§3.2)  
14. **Seed context label on R64** — add conditional text below names (§3.4)  
15. **Pick confirmation pulse** — CSS keyframe + class toggle (§3.1)  
16. **Lock state indicator** — conditional icon in tile (§3.5)  
17. **Upset badge** — conditional badge in tile (§3.3)  
18. **Research dot on tiles** — conditional dot in tile (§3.6, §7.1)  
19. **Compare zone hover label** — CSS hover state on zone (§3.7)  
20. **Compare modal redesign** — all §5 items together  
21. **Bracket complete confetti** — §4.4  

---

## 10. Verification Checklist

- [ ] Connector lines are visible on both basketball and mammal brackets  
- [ ] Connectors route through gutters, not through tile text  
- [ ] Picked connectors show MINT_FG color  
- [ ] R64 tiles show seed context  
- [ ] Picked tiles show team color stripe  
- [ ] Lower-seed picks show UPSET badge  
- [ ] Zoom toggle persists across page reload  
- [ ] Compare modal slides up on open  
- [ ] Compare modal pick buttons update bracket and close modal  
- [ ] "View Research" link in modal navigates to Research tab  
- [ ] Research tab region labels pass WCAG AA contrast  
- [ ] Score bar wraps cleanly at 375px width  
- [ ] All colors match canonical palette — no `#4ade80`, `#34d399`, `#6366f1`  
- [ ] Confetti fires once at 63/63 picks, not on every subsequent render  
- [ ] First Four panel appears above bracket scroll, not below  
- [ ] Spine row is gone  
- [ ] Championship game renders as standalone centered box  
