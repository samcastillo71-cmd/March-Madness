# March Madness Redesign — Design Spec
**Date:** 2026-06-02  
**Status:** Approved — ready for implementation

---

## Overview

Full UI redesign of the Hart Middle School March Madness bracket app plus Google Sign-In authentication. The current app (5/23 local files) has a dark green theme and username login — neither is correct. This spec defines the replacement.

---

## Color Palette (canonical — do not deviate)

| Role | Hex | Usage |
|---|---|---|
| Page background | `#E8E2D8` | Warm gray-cream, all pages |
| Card / tile surface | `#F4EFE6` | Game tiles, modals, cards |
| Primary text | `#1A1208` | All body text |
| Border / divider | `#C8BFB0` | Tile borders default, hairlines |
| Muted text | `#7A7068` | Labels, seeds, secondary info |
| **Basketball navy** | `#091828` | BB tile borders, headers, compare fill |
| Navy mid | `#1C3558` | Secondary navy surfaces |
| Navy light | `#B8CBE8` | Team logo circles (basketball) |
| **Forest green** | `#1A4332` | Mammal tile borders, headers |
| Green light | `#AACFBF` | Team logo circles (mammal) |
| **Winner mint bg** | `#C2EDD5` | Picked winner team row background |
| Winner mint fg | `#1E6B47` | Winner checkmark and text |

### Compare zone — habitat color map (mammal only)
| Habitat | Top fill | Bottom fill |
|---|---|---|
| Savanna / grassland | `#6B3E1A` | `#A86030` |
| Desert | `#8B5E2A` | `#C4952A` |
| Forest / woodland | `#0D2E1A` | `#2A5C3A` |
| Ocean / marine | `#003459` | `#0E6E8C` |
| Arctic / tundra | `#2B4C6F` | `#5C8AAA` |
| Rainforest | `#0B3D1E` | `#1A6640` |
| Mountain | `#3D3A50` | `#6B6880` |
| Basketball (no team colors) | `#040C15` | `#1E4A88` |
| Fallback (unknown habitat) | `#0D2419` | `#2A6348` |

---

## Typography

| Role | Font | Weight | Notes |
|---|---|---|---|
| Headings / titles | Libre Bodoni | 700 | Tournament name, region names, section headers |
| UI / body | Public Sans | 400–700 | All other text — team names, labels, buttons, body |

**Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Libre+Bodoni:wght@400;500;700&family=Public+Sans:wght@300;400;500;600;700&display=swap');
```

Replace current fonts: `Playfair Display` → `Libre Bodoni`, `Source Sans 3` → `Public Sans`.

---

## Game Tile Design

### Default state
- Border: 2px solid `#091828` (basketball) or `#1A4332` (mammal)
- Background: `#F4EFE6`
- Two team rows (40px tall each), team logo circle + seed + name
- **Compare zone** (34px tall) between the two rows: hairline with "vs" text centered

### Winner picked state
- Winning team row: background `#C2EDD5`, checkmark `#1E6B47` on right
- Losing team row: opacity 0.4

### Compare zone — hover trigger
Triggered on `.tile:hover` only when both `top` and `bottom` teams are non-null/non-placeholder. No trigger if either slot is TBD.

**Basketball animation (10+9):**
1. `fill-top` grows from top edge (background `#040C15`), `fill-bottom` grows from bottom edge (`#1E4A88`) — each to 52% height, 0.24s ease-out
2. Bracket corner ticks (4px × 4px L-shapes) appear at all four corners of the zone, 0.14s ease with 0.2s delay
3. Bracket connector lines draw inward from left/right edges to 22% width, 0.2s ease with 0.2s delay
4. "COMPARE" label fades in + translates up, 0.14s ease with 0.34s delay

**Mammal animation (habitat split):**
Same structure as basketball but fill colors come from habitat lookup:
- `researchData[top.name]?.habitat` → maps to top fill color
- `researchData[bottom.name]?.habitat` → maps to bottom fill color
- Habitat string matched case-insensitively against keyword map
- Fallback: `#0D2419` / `#2A6348` if no research data

**"COMPARE" text styling:**
```js
{
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 13,
  letterSpacing: 3.5,
  textTransform: 'uppercase',
  textShadow: '1px 1px 0 rgba(0,0,0,0.9), 2px 2px 0 rgba(0,0,0,0.7), 3px 3px 0 rgba(0,0,0,0.45), 4px 4px 0 rgba(0,0,0,0.25), 5px 5px 12px rgba(0,0,0,0.5)',
}
```

---

## Authentication

### Student flow (Google Sign-In)
1. Login screen shows: Libre Bodoni heading "MARCH MADNESS 2025", school name subhead, single "Sign in with school Google" button (Lucide `LogIn` icon, navy background)
2. `signInWithPopup(auth, googleProvider)` — popup approach (redirect caused Go Guardian issues)
3. On success: `user.uid` becomes Firestore document key, `user.displayName` becomes display name
4. No name entry step — display name comes from Google account
5. `onAuthStateChanged` listener drives app state instead of manual uid state

### Admin flow (unchanged)
- Small "Admin" link in footer or header triggers password input
- `checkAdminPassword()` unchanged — still Firestore `admin/auth` plaintext check
- Admin uid: Firebase Auth uid of admin's Google account (or separate admin flow TBD)

### Firebase changes needed
**`src/firebase.js`** — add:
```js
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ hd: 'harts.rochester.k12.mi.us' });
```

**`src/App.jsx`** — replace username state machine with:
```js
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
// onAuthStateChanged(auth, user => { setUid(user?.uid); setDisplayName(user?.displayName); })
```

### Data migration
Existing username-keyed Firestore docs are orphaned — not deleted, just unreachable. Acceptable since tournament year is ending. Admin "Clear All Data" button (see below) handles cleanup.

---

## Admin Panel Additions

### "New Year Reset" button
Location: Admin Dashboard tab, below lock/unlock controls  
Label: "Clear All Data (New Year Reset)"  
Action: Batch delete all documents in:
- `brackets/` collection
- `brackets_mammals/` collection  
- `leaderboard/` collection
- `leaderboard_mammals/` collection

Requires confirmation dialog before executing. Does NOT delete `admin/`, `tournament/` config docs, or research data.

---

## Icons

All emojis removed. Replace with **Lucide React** (`lucide-react` npm package).

Key replacements:
- Login icon: `Trophy` or none (typography carries the page)
- Sign-in button: `LogIn`
- Admin lock: `Lock` / `Unlock`
- Checkmark (winner): Unicode `✓` character or Lucide `Check`
- Any other emoji in codebase: audit and replace or remove

---

## Style Constants (S object — new values)

```js
const NAVY  = '#091828';
const GREEN = '#1A4332';
const MINT_BG = '#C2EDD5';
const MINT_FG = '#1E6B47';

const S = {
  app:    { minHeight: '100vh', background: '#E8E2D8', color: '#1A1208', fontFamily: "'Public Sans', sans-serif" },
  header: { background: 'rgba(9,24,40,0.97)', borderBottom: '1px solid rgba(28,53,88,0.6)', ... },
  card:   { background: '#F4EFE6', border: '1px solid #C8BFB0', borderRadius: 12, padding: 20 },
  btn:    (bg = NAVY, fg = '#fff') => ({ ... background: bg, color: fg, ... }),
  input:  { background: 'rgba(255,255,255,0.7)', border: '1px solid #C8BFB0', color: '#1A1208', ... },
}
```

---

## Scope Boundaries

**In scope:**
- Restyle all inline styles in `src/App.jsx` to use new palette/fonts
- Replace username login with Google Sign-In in `src/App.jsx` + `src/firebase.js`
- Rebuild `GameSlot` compare zone with hover animation
- Add "New Year Reset" button to admin panel
- Remove all emoji, add Lucide icons
- Update `index.html` body background color
- Update `CLAUDE.md` color palette section

**Out of scope:**
- Changing bracket logic, scoring, or Firestore data model
- Adding actual ESPN team color lookup (noted as future enhancement)
- Splitting `App.jsx` into multiple files (noted as future work)
- Any changes to `api/generate.js`

---

## Files to Modify

| File | Changes |
|---|---|
| `src/App.jsx` | All inline styles, login screen, GameSlot compare zone, auth flow, admin reset button, emoji removal |
| `src/firebase.js` | Add `getAuth`, `GoogleAuthProvider`, exports |
| `src/firestoreService.js` | Add `deleteAllBrackets()` batch delete function |
| `index.html` | Update `<body>` background color to `#E8E2D8` |
| `CLAUDE.md` | Update theme section with canonical color palette |
