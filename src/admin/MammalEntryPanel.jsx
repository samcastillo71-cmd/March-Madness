import { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { saveMammalRoster, saveMammalOfficialBracket } from '../firestoreService';
import { buildInitialBracketFromTeams } from '../bracketData';

const ACCENT  = '#16a34a';
const ACCENT2 = '#4ade80';
const RC = { East: '#93c5fd', West: '#fca5a5', South: '#86efac', Midwest: '#fdba74' };

const S = {
  card:   { background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20 },
  btn:    (bg = ACCENT, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? ACCENT : 'transparent', color: a ? '#fff' : '#999', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
};

export function MammalEntryPanel({ onAnimalsSaved, onRequestGenerateMammalResearch, onRefetchImages, regionNames, onRegionNamesChange, sourcesData, onSaveSources }) {
  const [roster, setRoster] = useState({
    East:    Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })),
    West:    Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })),
    South:   Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })),
    Midwest: Array(16).fill(null).map((_,i) => ({ seed:i+1, name:'', firstFour:false })),
  });
  const [activeRegion, setActiveRegion] = useState('East');
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied]   = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'admin', 'mammalRoster'));
        if (snap.exists()) {
          const d = snap.data();
          if (d._regionNames) onRegionNamesChange(d._regionNames);
          delete d.updatedAt; delete d._regionNames;
          setRoster(d);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const updateAnimal = (region, idx, field, value) => {
    setRoster(prev => { const n = JSON.parse(JSON.stringify(prev)); n[region][idx][field] = value; return n; });
    setSaved(false); setApplied(false);
  };

  if (loading) return <div style={{ color: '#999', padding: 20 }}>Loading...</div>;
  return (
    <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(134,239,172,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ color: '#86efac', marginBottom: 4 }}>Set Up Mammal Madness Animals</h3>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#86efac', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', flexShrink: 0 }}>Region Names:</span>
            {['East','West','South','Midwest'].map(r => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: RC[r], fontWeight: 700 }}>{r}:</span>
                <input value={regionNames[r]} onChange={e => onRegionNamesChange({ ...regionNames, [r]: e.target.value })} placeholder={r} style={{ ...S.input, width: 120, padding: '4px 8px', fontSize: 12, borderColor: (regionNames[r] || '').length > 15 ? '#f59e0b' : undefined }} />
                {(regionNames[r] || '').length > 15 && <span style={{ fontSize: 10, color: '#f59e0b' }} title="Long names may wrap in the bracket view.">⚠️</span>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...S.btn(saved ? '#22c55e' : ACCENT, '#fff'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setSaving(true); try { await saveMammalRoster({ ...roster, _regionNames: regionNames }); setSaved(true); } catch(e) { alert('Save failed: ' + e.message); } setSaving(false); }} disabled={saving}>{saving ? 'Saving...' : saved ? 'Saved' : 'Save Roster'}</button>
          <button style={{ ...S.btn(applied ? '#22c55e' : '#f59e0b', '#000'), padding: '8px 20px', fontSize: 13 }} onClick={async () => { setApplying(true); try { const nb = buildInitialBracketFromTeams(roster); await saveMammalOfficialBracket(nb); setApplied(true); onAnimalsSaved(nb, roster); } catch(e) { alert('Apply failed: ' + e.message); } setApplying(false); }} disabled={applying}>{applying ? 'Applying...' : applied ? 'Applied!' : 'Apply to Bracket'}</button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', minWidth: 100 }}>Generate Facts:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(99,102,241,0.3)', '#a5b4fc'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(99,102,241,0.5)' }} onClick={() => onRequestGenerateMammalResearch(roster, r)}>{regionNames[r] || r}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#999', alignSelf: 'center', minWidth: 100 }}>Re-fetch Images:</span>
              {['East','West','South','Midwest'].map(r => (
                <button key={r} style={{ ...S.btn('rgba(20,184,166,0.2)', '#5eead4'), padding: '6px 14px', fontSize: 12, border: '1px solid rgba(20,184,166,0.4)' }} onClick={() => onRefetchImages && onRefetchImages(r)}>{regionNames[r] || r}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {onSaveSources && (
        <div style={{ ...S.card, marginBottom: 16, borderColor: 'rgba(99,102,241,0.25)' }}>
          <h3 style={{ color: '#a5b4fc', marginBottom: 4, fontSize: 15 }}>Research Sources</h3>
          <p style={{ color: '#777', fontSize: 12, marginBottom: 10 }}>URLs the AI will read before generating animal facts.</p>
          {sourcesData.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
              <span style={{ flex: 1, fontSize: 12, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name} — {s.url}</span>
              <button onClick={() => onSaveSources(sourcesData.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input id="mm-src-name" placeholder="Source name" style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 12 }} />
            <input id="mm-src-url" placeholder="URL" style={{ ...S.input, flex: 2, padding: '6px 10px', fontSize: 12 }} />
            <button style={{ ...S.btn('#6366f1', '#fff'), padding: '6px 14px', fontSize: 12 }} onClick={() => {
              const name = document.getElementById('mm-src-name').value.trim();
              const url  = document.getElementById('mm-src-url').value.trim();
              if (!url) return;
              onSaveSources([...sourcesData, { url, name: name || url, primary: true }]);
              document.getElementById('mm-src-name').value = '';
              document.getElementById('mm-src-url').value = '';
            }}>+ Add</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['East','West','South','Midwest'].map(r => (
          <button key={r} style={{ ...S.navBtn(activeRegion === r), borderBottom: activeRegion === r ? `2px solid ${RC[r]}` : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setActiveRegion(r)}>
            <span style={{ color: RC[r], marginRight: 6 }}>●</span>{regionNames[r] || r}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {(roster[activeRegion] || []).map((animal, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <input type="number" min="1" max="16" value={animal.seed} onChange={e => updateAnimal(activeRegion, idx, 'seed', parseInt(e.target.value) || e.target.value)} style={{ ...S.input, width: 48, padding: '6px 6px', fontSize: 13, textAlign: 'center' }} />
            <input placeholder="Animal name" value={animal.name} onChange={e => updateAnimal(activeRegion, idx, 'name', e.target.value)} style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 13 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={animal.firstFour} onChange={e => updateAnimal(activeRegion, idx, 'firstFour', e.target.checked)} />
              <span style={{ fontSize: 11, color: animal.firstFour ? '#818cf8' : '#888', fontWeight: animal.firstFour ? 700 : 400 }}>FF</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
