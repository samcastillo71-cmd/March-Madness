# Research Tab UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add region tabs to the Research tab and a head-to-head comparison modal triggered from both the bracket and the research tab.

**Architecture:** All changes are in `src/App.jsx`. New derived state (`bbTeamsByRegion`, `mammalAnimalsByRegion`) groups teams/animals by region from the existing bracket/research data. A new `CompareModal` component renders a side-by-side stat layout. The `GameSlot` component gains an optional `onCompare` prop that renders a footer button when both teams are filled. The research tab gets a `comparePicking` flow for selecting a second team.

**Tech Stack:** React 18, inline styles only (no CSS files), existing `S.*` style constants, Firebase Firestore (read-only for this feature).

---

## File Map

| File | Change |
|------|--------|
| `src/App.jsx` | All changes — new state, new derived data, new `CompareModal` component, updated `GameSlot`, updated research tab render, updated `RoundCol`, threaded `onCompare` through `renderBracket` |

No changes to `firestoreService.js`, `bracketData.js`, or `api/generate.js`.

---

## Task 1: Add state and derived data

**File:** `src/App.jsx`

Locate the `// ── DERIVED STATE` block (~line 901). After the existing `useMemo` declarations for `allTeamNames`, `allAnimalNames`, `score`, `mammalScore`, `myRank`, `mammalMyRank`, `ffGamesList`, `mammalFFGamesList`, add the two new `useMemo` hooks. Then locate the four new `useState` declarations and add them with the other state near the top of `App()`.

- [ ] **Step 1: Add four new useState declarations**

Find this block (near line 854, inside `App()`):
```js
  const [selectedTeam,     setSelectedTeam]    = useState(null);
```

Add four new state declarations directly after the `comparePicking` / `compareModal` / `bbActiveRegion` / `mammalActiveRegion` group doesn't exist yet — add them anywhere in the state block, keeping related state together. Place after `selectedTeam`:

```js
  const [selectedTeam,        setSelectedTeam]        = useState(null);
  const [bbActiveRegion,      setBbActiveRegion]      = useState('East');
  const [compareModal,        setCompareModal]        = useState(null);
  const [comparePicking,      setComparePicking]      = useState(false);
```

And after `mammalSelectedAnimal`:
```js
  const [mammalSelectedAnimal,  setMammalSelectedAnimal]  = useState(null);
  const [mammalActiveRegion,    setMammalActiveRegion]    = useState('East');
```

- [ ] **Step 2: Add bbTeamsByRegion useMemo**

Find the end of the derived state block (the line with `mammalFFGamesList`):
```js
  const mammalFFGamesList = useMemo(() => Object.entries(mammalFfPlaceholders).map(([key, slot]) => { const [region] = key.split('-'); return { region, seed: slot.seed, ffTeams: slot.ffTeams, key }; }), [mammalFfPlaceholders]);
```

Add immediately after:
```js
  const bbTeamsByRegion = useMemo(() => {
    const src = officialBracket ?? bracket;
    const empty = { East: [], West: [], South: [], Midwest: [] };
    if (!src) return empty;
    const result = { East: [], West: [], South: [], Midwest: [] };
    ['East', 'West', 'South', 'Midwest'].forEach(region => {
      (src[region]?.rounds?.[0] || []).forEach(game => {
        ['top', 'bottom'].forEach(side => {
          const slot = game[side];
          if (!slot) return;
          if (slot.isFFPlaceholder) {
            (slot.ffTeams || []).forEach(t => result[region].push({ name: t.name, seed: t.seed, espnId: t.espnId }));
          } else {
            result[region].push({ name: slot.name, seed: slot.seed, espnId: slot.espnId });
          }
        });
      });
      result[region].sort((a, b) => a.seed - b.seed);
    });
    return result;
  }, [officialBracket, bracket]);

  const mammalAnimalsByRegion = useMemo(() => {
    const result = { East: [], West: [], South: [], Midwest: [] };
    Object.entries(mammalResearchData).forEach(([name, card]) => {
      const region = (card?.region && result[card.region] !== undefined) ? card.region : 'East';
      result[region].push({ name, seed: card?.seed ?? 999 });
    });
    ['East', 'West', 'South', 'Midwest'].forEach(r => result[r].sort((a, b) => a.seed - b.seed));
    return result;
  }, [mammalResearchData]);
```

- [ ] **Step 3: Replace the two auto-select useEffects**

Find the two auto-select effects added in a prior session:
```js
  // Auto-select first team/animal when research data first arrives
  useEffect(() => { if (allTeamNames.length > 0 && !selectedTeam) setSelectedTeam(allTeamNames[0]); }, [allTeamNames]);
  useEffect(() => { if (allAnimalNames.length > 0 && !mammalSelectedAnimal) setMammalSelectedAnimal(allAnimalNames[0]); }, [allAnimalNames]);
```

Replace with versions that also set the active region tab:
```js
  // Auto-select first team/animal when research data first arrives, and activate their region tab
  useEffect(() => {
    if (allTeamNames.length === 0 || selectedTeam) return;
    const regions = ['East', 'West', 'South', 'Midwest'];
    for (const region of regions) {
      const first = bbTeamsByRegion[region]?.find(t => allTeamNames.includes(t.name));
      if (first) { setBbActiveRegion(region); setSelectedTeam(first.name); return; }
    }
    setSelectedTeam(allTeamNames[0]);
  }, [allTeamNames, bbTeamsByRegion]);

  useEffect(() => {
    if (allAnimalNames.length === 0 || mammalSelectedAnimal) return;
    const regions = ['East', 'West', 'South', 'Midwest'];
    for (const region of regions) {
      if (mammalAnimalsByRegion[region]?.length > 0) {
        setMammalActiveRegion(region);
        setMammalSelectedAnimal(mammalAnimalsByRegion[region][0].name);
        return;
      }
    }
    setMammalSelectedAnimal(allAnimalNames[0]);
  }, [allAnimalNames, mammalAnimalsByRegion]);
```

- [ ] **Step 4: Verify in browser**

Run `npm run dev`, open `http://localhost:5173`. No visible UI change expected yet — confirm no console errors. Open DevTools → Console; should be clean.

- [ ] **Step 5: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add region tab state and derived data for research tab"
```

---

## Task 2: Basketball region tabs UI

**File:** `src/App.jsx` — research tab render (~line 1976)

- [ ] **Step 1: Replace flat team button list with region tabs + seeded list**

Find and replace this block inside the basketball research section:
```jsx
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                        {allTeamNames.map(t => <button key={t} style={{ ...S.btn(selectedTeam === t ? ACCENT : 'rgba(255,255,255,0.05)', selectedTeam === t ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => setSelectedTeam(t)}>{t}</button>)}
                      </div>
```

Replace with:
```jsx
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 0, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['East','West','South','Midwest'].map(r => (
                          <button key={r} style={{ ...S.navBtn(bbActiveRegion === r), borderBottom: bbActiveRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0 }} onClick={() => setBbActiveRegion(r)}>
                            {bbRegionNames[r] || r}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 24px' }}>
                        {(bbTeamsByRegion[bbActiveRegion] || []).length === 0
                          ? <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic' }}>No teams in this region yet.</div>
                          : (bbTeamsByRegion[bbActiveRegion] || []).map(t => (
                              <button key={t.name} style={{ ...S.btn(selectedTeam === t.name ? ACCENT : 'rgba(255,255,255,0.05)', selectedTeam === t.name ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => { setSelectedTeam(t.name); setComparePicking(false); }}>
                                #{t.seed} {t.name}
                              </button>
                            ))
                        }
                      </div>
```

- [ ] **Step 2: Verify in browser**

Go to Research tab → Basketball. Should see 4 region tab buttons. Clicking a region shows that region's teams sorted by seed with seed numbers visible. Clicking a team loads their card. If no bracket is set up in Firestore, all regions show "No teams yet" — that's correct.

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add region tabs to basketball research tab"
```

---

## Task 3: Mammal region tabs UI

**File:** `src/App.jsx` — mammal research section (~line 1999)

- [ ] **Step 1: Replace flat animal button list with region tabs + seeded list**

Find and replace:
```jsx
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                        {allAnimalNames.map(a => <button key={a} style={{ ...S.btn(mammalSelectedAnimal === a ? '#16a34a' : 'rgba(255,255,255,0.05)', mammalSelectedAnimal === a ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => setMammalSelectedAnimal(a)}>{a}</button>)}
                      </div>
```

Replace with:
```jsx
                      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 0, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['East','West','South','Midwest'].map(r => (
                          <button key={r} style={{ ...S.navBtn(mammalActiveRegion === r), borderBottom: mammalActiveRegion === r ? '2px solid #86efac' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px', flexShrink: 0 }} onClick={() => setMammalActiveRegion(r)}>
                            {mammalRegionNames[r] || r}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0 24px' }}>
                        {(mammalAnimalsByRegion[mammalActiveRegion] || []).length === 0
                          ? <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic' }}>No animals in this region yet.</div>
                          : (mammalAnimalsByRegion[mammalActiveRegion] || []).map(a => (
                              <button key={a.name} style={{ ...S.btn(mammalSelectedAnimal === a.name ? '#16a34a' : 'rgba(255,255,255,0.05)', mammalSelectedAnimal === a.name ? '#fff' : '#aaa'), padding: '7px 16px', fontSize: 13 }} onClick={() => { setMammalSelectedAnimal(a.name); setComparePicking(false); }}>
                                #{a.seed} {a.name}
                              </button>
                            ))
                        }
                      </div>
```

- [ ] **Step 2: Reset comparePicking when switching tournaments**

Find the `TournamentSelector` component or where `activeTournament` is set. Look for `setActiveTournament`. It will be in the tournament toggle buttons. Add `setComparePicking(false)` alongside any `setActiveTournament` call:

Search for `setActiveTournament(` — there will be one or two calls. Each one should also call `setComparePicking(false)`.

- [ ] **Step 3: Verify in browser**

Go to Research → Mammal Madness. Should see 4 region tabs using custom display names (if set by admin) or default East/West/South/Midwest. Teams sorted by seed. Switching tournament clears any compare picking state.

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add region tabs to mammal research tab"
```

---

## Task 4: Admin long-name warning

**File:** `src/App.jsx` — `TeamEntryPanel` (~line 569) and `MammalEntryPanel` (~line 672)

- [ ] **Step 1: Add warning to TeamEntryPanel region name inputs**

Find in `TeamEntryPanel`:
```jsx
              <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12 }} />
```

Replace with:
```jsx
              <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12, borderColor: (regionNames[r] || '').length > 15 ? '#f59e0b' : undefined }} />
              {(regionNames[r] || '').length > 15 && <span style={{ fontSize: 10, color: '#f59e0b' }} title="Long names may wrap in the bracket view.">⚠️</span>}
```

- [ ] **Step 2: Add warning to MammalEntryPanel region name inputs**

Find in `MammalEntryPanel` (same pattern, different location):
```jsx
              <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12 }} />
```

Replace with:
```jsx
              <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12, borderColor: (regionNames[r] || '').length > 15 ? '#f59e0b' : undefined }} />
              {(regionNames[r] || '').length > 15 && <span style={{ fontSize: 10, color: '#f59e0b' }} title="Long names may wrap in the bracket view.">⚠️</span>}
```

- [ ] **Step 3: Verify in browser**

Log in as admin → Basketball Teams → type a region name longer than 15 characters. The input border should turn amber and a ⚠️ should appear next to it. Short names should show no warning.

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add long region name warning in admin panels"
```

---

## Task 5: CompareModal component

**File:** `src/App.jsx` — add before `ViewBracketModal` (~line 435)

- [ ] **Step 1: Add CompareModal component**

Find the line:
```jsx
// ── VIEW BRACKET MODAL ────────────────────────────────────────────────────────
function ViewBracketModal({ data, onClose }) {
```

Insert the new component before it:
```jsx
// ── COMPARE MODAL ─────────────────────────────────────────────────────────────
function CompareModal({ teamA, teamB, cardA, cardB, isMammal, onClose }) {
  const bbStats = [
    ['Rank', 'rank'], ['Conference', 'conference'], ['Record', 'record'],
    ['KenPom', 'kenpom'], ['Offense', 'offense'], ['Defense', 'defense'],
    ['Pace', 'pace'], ['Odds', 'odds'], ['Strengths', 'strengths'], ['Weaknesses', 'weaknesses'],
  ];
  const mammalStats = [
    ['Habitat', 'habitat'], ['Diet', 'diet'], ['Superpower', 'superpower'],
    ['Battle Strength', 'battleStrength'], ['Size', 'size'], ['Speed', 'speed'], ['Lifespan', 'lifespan'],
  ];
  const stats = isMammal ? mammalStats : bbStats;
  const accent = isMammal ? '#86efac' : '#4ade80';
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20, maxWidth: 700, width: '100%', marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: accent, margin: 0, fontSize: 20 }}>Head-to-Head</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 20, gap: 8 }}>
          <div style={{ flex: 1, textAlign: 'right', paddingRight: 12 }}>
            {!isMammal && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}><TeamLogo espnId={teamA.espnId} name={teamA.name} size={44} /></div>}
            {isMammal && cardA?.wikiImageUrl && <img src={cardA.wikiImageUrl} alt={teamA.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block', marginLeft: 'auto', marginBottom: 6 }} />}
            <div style={{ fontSize: 11, color: accent }}>#{teamA.seed}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{teamA.name}</div>
          </div>
          <div style={{ fontSize: 13, color: '#444', fontWeight: 700, flexShrink: 0, paddingBottom: 4 }}>VS</div>
          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12 }}>
            {!isMammal && <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 6 }}><TeamLogo espnId={teamB.espnId} name={teamB.name} size={44} /></div>}
            {isMammal && cardB?.wikiImageUrl && <img src={cardB.wikiImageUrl} alt={teamB.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 6 }} />}
            <div style={{ fontSize: 11, color: accent }}>#{teamB.seed}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{teamB.name}</div>
          </div>
        </div>
        {stats.map(([label, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 0', gap: 8 }}>
            <div style={{ flex: 1, textAlign: 'right', fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
              {cardA ? (cardA[key] || <span style={{ color: '#333' }}>—</span>) : <span style={{ color: '#555', fontStyle: 'italic', fontSize: 12 }}>No data</span>}
            </div>
            <div style={{ width: 120, textAlign: 'center', fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, paddingTop: 2, flexShrink: 0 }}>{label}</div>
            <div style={{ flex: 1, textAlign: 'left', fontSize: 13, color: '#ccc', lineHeight: 1.5 }}>
              {cardB ? (cardB[key] || <span style={{ color: '#333' }}>—</span>) : <span style={{ color: '#555', fontStyle: 'italic', fontSize: 12 }}>No data</span>}
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 8, textAlign: 'right' }}>
          <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '7px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

```

- [ ] **Step 2: Add handleCompare to App and wire up modal render**

Find the `handleViewBracket` useCallback (~line 1508). Add `handleCompare` after it:
```js
  const handleCompare = useCallback((teamA, teamB, isMammal) => {
    const data = isMammal ? mammalResearchData : researchData;
    setCompareModal({
      teamA: { name: teamA.name, seed: teamA.seed, espnId: teamA.espnId },
      teamB: { name: teamB.name, seed: teamB.seed, espnId: teamB.espnId },
      cardA: data[teamA.name] ?? null,
      cardB: data[teamB.name] ?? null,
      isMammal,
    });
  }, [researchData, mammalResearchData]);
```

Find the modal render lines (~line 1909):
```jsx
        {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
        {viewingBracket && <ViewBracketModal data={viewingBracket} onClose={() => setViewingBracket(null)} />}
```

Add `CompareModal` render after `ViewBracketModal`:
```jsx
        {confirmDialog && <ConfirmDialog message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} />}
        {viewingBracket && <ViewBracketModal data={viewingBracket} onClose={() => setViewingBracket(null)} />}
        {compareModal && <CompareModal {...compareModal} onClose={() => { setCompareModal(null); setComparePicking(false); }} />}
```

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add CompareModal component and handleCompare handler"
```

---

## Task 6: Compare button in GameSlot + bracket wiring

**File:** `src/App.jsx` — `GameSlot` component (~line 170) and `renderBracket` (~line 1519)

- [ ] **Step 1: Add onCompare prop to GameSlot and render compare bar (vertical layout)**

Find the `GameSlot` function signature:
```js
const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false }) {
```

Replace with:
```js
const GameSlot = memo(function GameSlot({ game, onPick, locked, isChampionship, onScoreChange, flipped, roundIdx = 0, liveScores = {}, isHorizontal = false, onCompare }) {
```

Find the closing `</div>` of the vertical layout return — it's after the championship score inputs block:
```jsx
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#777', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
    </div>
  );
});
```

Add the compare bar before the final `</div>`:
```jsx
      {isChampionship && (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <input placeholder="Score 1" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={scoreInput} />
          <span style={{ color: '#777', fontSize: 11, alignSelf: 'center' }}>-</span>
          <input placeholder="Score 2" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={scoreInput} />
        </div>
      )}
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Add compare bar to horizontal layout (championship)**

Find the horizontal layout return (the `if (isHorizontal) return (` block). It ends with:
```jsx
  if (isHorizontal) return (
    <div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Team team={top} side="top" />
        ...
        <Team team={bottom} side="bottom" />
      </div>
    </div>
  );
```

Add the compare bar inside the outer div, after the inner `<div style={{ display: 'flex' }}>` closes:
```jsx
  if (isHorizontal) return (
    <div style={{ border: `2px solid ${slotBorder}`, borderRadius: 10, overflow: 'hidden', background: slotBg }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Team team={top} side="top" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 10px', gap: 4 }}>
          {isLiveGame && <><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /><span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>LIVE</span></>}
          {isFinal && <span style={{ fontSize: 10, color: '#777', fontWeight: 700 }}>FINAL</span>}
          <span style={{ fontSize: 18, fontWeight: 900, color: '#888' }}>VS</span>
          {isChampionship && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input placeholder="–" value={game.scoreTop || ''} onChange={e => onScoreChange?.('scoreTop', e.target.value)} style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
              <span style={{ color: '#777', fontSize: 13, alignSelf: 'center' }}>-</span>
              <input placeholder="–" value={game.scoreBottom || ''} onChange={e => onScoreChange?.('scoreBottom', e.target.value)} style={{ ...scoreInput, width: 44, textAlign: 'center' }} />
            </div>
          )}
        </div>
        <Team team={bottom} side="bottom" />
      </div>
      {onCompare && top && bottom && !top.isFFPlaceholder && !bottom.isFFPlaceholder && (
        <div onClick={() => onCompare(top, bottom)} style={{ textAlign: 'center', padding: '3px 8px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 10, color: '#666', letterSpacing: 0.5, userSelect: 'none' }}>
          Compare
        </div>
      )}
    </div>
  );
```

- [ ] **Step 3: Thread onCompare through RoundCol**

Find `RoundCol` inside `renderBracket`:
```jsx
    const RoundCol = ({ region, rIdx, flip, dir }) => {
      const games = activeBracket[region]?.rounds[rIdx] || [];
      const positions = ROUND_ABS[rIdx];
      return (
        <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative' }}>
          {games.map((game, gIdx) => {
            const pos = positions[gIdx] ?? gIdx * SH;
            return (
              <div key={gIdx} style={{ position: 'absolute', left: 0, right: 0, ...(dir === 'top' ? { top: pos } : { bottom: pos }) }}>
                <GameSlot game={game} locked={isLocked && !isAdmin} flipped={flip} roundIdx={rIdx} liveScores={isMammal ? {} : liveScores} onPick={side => onPick(region, rIdx, gIdx, side)} />
              </div>
            );
          })}
        </div>
      );
    };
```

Replace with:
```jsx
    const onCompareGame = (top, bottom) => handleCompare(top, bottom, isMammal);

    const RoundCol = ({ region, rIdx, flip, dir }) => {
      const games = activeBracket[region]?.rounds[rIdx] || [];
      const positions = ROUND_ABS[rIdx];
      return (
        <div style={{ width: CW, flexShrink: 0, height: TOP_H, position: 'relative' }}>
          {games.map((game, gIdx) => {
            const pos = positions[gIdx] ?? gIdx * SH;
            return (
              <div key={gIdx} style={{ position: 'absolute', left: 0, right: 0, ...(dir === 'top' ? { top: pos } : { bottom: pos }) }}>
                <GameSlot game={game} locked={isLocked && !isAdmin} flipped={flip} roundIdx={rIdx} liveScores={isMammal ? {} : liveScores} onPick={side => onPick(region, rIdx, gIdx, side)} onCompare={onCompareGame} />
              </div>
            );
          })}
        </div>
      );
    };
```

- [ ] **Step 4: Add onCompare to Final Four and Championship GameSlot instances**

Find the Final Four game slot for top half:
```jsx
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[0]} onPick={s => onFFPick(0, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} /></ScaledGame>
```
Replace with:
```jsx
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[0]} onPick={s => onFFPick(0, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} /></ScaledGame>
```

Find the Championship game slot:
```jsx
                <GameSlot game={activeBracket.championship} onPick={onChampPick} locked={isLocked && !isAdmin} isChampionship isHorizontal onScoreChange={isMammal ? undefined : handleChampScore} roundIdx={-1} liveScores={isMammal ? {} : liveScores} />
```
Replace with:
```jsx
                <GameSlot game={activeBracket.championship} onPick={onChampPick} locked={isLocked && !isAdmin} isChampionship isHorizontal onScoreChange={isMammal ? undefined : handleChampScore} roundIdx={-1} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} />
```

Find the Final Four game slot for bottom half:
```jsx
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[1]} onPick={s => onFFPick(1, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} /></ScaledGame>
```
Replace with:
```jsx
              <ScaledGame><GameSlot game={activeBracket.finalFour?.[1]} onPick={s => onFFPick(1, s)} locked={isLocked && !isAdmin} roundIdx={4} liveScores={isMammal ? {} : liveScores} onCompare={onCompareGame} /></ScaledGame>
```

- [ ] **Step 5: Verify in browser**

Go to Bracket tab. Every matchup where both teams are filled should show a small "Compare" bar at the bottom of the game slot. Clicking it should open the `CompareModal` with both teams' stats side by side. Matchups with TBD slots should not show the button.

- [ ] **Step 6: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add Compare button to bracket game slots"
```

---

## Task 7: Compare trigger from research tab

**File:** `src/App.jsx` — basketball and mammal research sections

- [ ] **Step 1: Add Compare button and pick mode to basketball research section**

Find this line in the basketball research section (just before the `{selectedTeam && <ResearchCard .../>}` line):
```jsx
                      {selectedTeam && <ResearchCard teamName={selectedTeam} card={researchData[selectedTeam]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />}
```

Replace with:
```jsx
                      {selectedTeam && !comparePicking && (
                        <div style={{ marginBottom: 12 }}>
                          <button style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#888', padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }} onClick={() => setComparePicking(true)}>
                            Compare with another team
                          </button>
                        </div>
                      )}
                      {comparePicking && (
                        <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: '#a5b4fc' }}>Select a team to compare with <strong style={{ color: '#4ade80' }}>{selectedTeam}</strong></span>
                            <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }} onClick={() => setComparePicking(false)}>Cancel</button>
                          </div>
                          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                            {['East','West','South','Midwest'].map(r => (
                              <button key={r} style={{ background: bbActiveRegion === r ? 'rgba(22,163,74,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${bbActiveRegion === r ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)'}`, color: bbActiveRegion === r ? '#4ade80' : '#888', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, flexShrink: 0 }} onClick={() => setBbActiveRegion(r)}>
                                {bbRegionNames[r] || r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(bbTeamsByRegion[bbActiveRegion] || []).filter(t => t.name !== selectedTeam).map(t => {
                              const teamAObj = Object.values(bbTeamsByRegion).flat().find(x => x.name === selectedTeam) || { name: selectedTeam, seed: '?' };
                              return (
                                <button key={t.name} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                                  onClick={() => { setCompareModal({ teamA: teamAObj, teamB: t, cardA: researchData[selectedTeam] ?? null, cardB: researchData[t.name] ?? null, isMammal: false }); setComparePicking(false); }}>
                                  #{t.seed} {t.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {selectedTeam && <ResearchCard teamName={selectedTeam} card={researchData[selectedTeam]} isAdmin={isAdmin} onFieldSave={handleResearchFieldSave} />}
```

- [ ] **Step 2: Add Compare button and pick mode to mammal research section**

Find just before the `{mammalSelectedAnimal && <MammalResearchCard .../>}` line in the mammal section:
```jsx
                      {mammalSelectedAnimal && <MammalResearchCard animalName={mammalSelectedAnimal} card={mammalResearchData[mammalSelectedAnimal]} isAdmin={isAdmin} onFieldSave={handleMammalResearchFieldSave} generating={mammalGeneratingOne === mammalSelectedAnimal} onGenerate={handleGenerateOneMammal} />}
```

Replace with:
```jsx
                      {mammalSelectedAnimal && !comparePicking && (
                        <div style={{ marginBottom: 12 }}>
                          <button style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#888', padding: '5px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }} onClick={() => setComparePicking(true)}>
                            Compare with another animal
                          </button>
                        </div>
                      )}
                      {comparePicking && (
                        <div style={{ background: 'rgba(134,239,172,0.05)', border: '1px solid rgba(134,239,172,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontSize: 13, color: '#86efac' }}>Select an animal to compare with <strong style={{ color: '#86efac' }}>{mammalSelectedAnimal}</strong></span>
                            <button style={{ background: 'rgba(255,255,255,0.07)', border: 'none', color: '#888', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }} onClick={() => setComparePicking(false)}>Cancel</button>
                          </div>
                          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                            {['East','West','South','Midwest'].map(r => (
                              <button key={r} style={{ background: mammalActiveRegion === r ? 'rgba(134,239,172,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${mammalActiveRegion === r ? 'rgba(134,239,172,0.4)' : 'rgba(255,255,255,0.08)'}`, color: mammalActiveRegion === r ? '#86efac' : '#888', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, flexShrink: 0 }} onClick={() => setMammalActiveRegion(r)}>
                                {mammalRegionNames[r] || r}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(mammalAnimalsByRegion[mammalActiveRegion] || []).filter(a => a.name !== mammalSelectedAnimal).map(a => {
                              const animalAObj = Object.values(mammalAnimalsByRegion).flat().find(x => x.name === mammalSelectedAnimal) || { name: mammalSelectedAnimal, seed: '?' };
                              return (
                                <button key={a.name} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#aaa', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                                  onClick={() => { setCompareModal({ teamA: animalAObj, teamB: a, cardA: mammalResearchData[mammalSelectedAnimal] ?? null, cardB: mammalResearchData[a.name] ?? null, isMammal: true }); setComparePicking(false); }}>
                                  #{a.seed} {a.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {mammalSelectedAnimal && <MammalResearchCard animalName={mammalSelectedAnimal} card={mammalResearchData[mammalSelectedAnimal]} isAdmin={isAdmin} onFieldSave={handleMammalResearchFieldSave} generating={mammalGeneratingOne === mammalSelectedAnimal} onGenerate={handleGenerateOneMammal} />}
```

- [ ] **Step 3: Verify in browser**

Go to Research tab. Select any team/animal. A "Compare with another team/animal" button should appear below the region tabs. Clicking it shows the region picker + team list. Selecting a second team opens the `CompareModal`. Clicking Cancel hides the picker. The current team is excluded from the comparison pick list.

- [ ] **Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add compare trigger from research tab"
```

---

## Self-Review Notes

- **Spec coverage:** All requirements covered — region tabs (Tasks 1–3), long name warning (Task 4), `CompareModal` (Task 5), bracket trigger (Task 6), research tab trigger (Task 7).
- **Type consistency:** `teamA`/`teamB` are `{ name, seed, espnId? }` objects throughout. `cardA`/`cardB` are research card objects or `null`. `onCompare(top, bottom)` signature matches everywhere it's called and received.
- **Edge cases handled:** No bracket data → empty arrays from `bbTeamsByRegion`, shows "No teams yet". No research card → "No data" shown in modal column. FF placeholder slots excluded from Compare button render condition.
