import { useState } from 'react';

const inputStyle = { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' };

export function EditableField({ value, onSave, color = '#ccc', large = false, multiline = false, label = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value);
  const [saving,  setSaving]  = useState(false);
  const commit = async () => { setSaving(true); await onSave(draft); setSaving(false); setEditing(false); };
  if (!editing) return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }} onClick={() => { setDraft(value); setEditing(true); }}>
      <span style={{ color, fontSize: large ? 38 : 13, fontWeight: large ? 700 : 400, lineHeight: 1.5, flex: 1 }}>{value || '-'}</span>
      <span style={{ fontSize: 10, color: '#888', marginTop: large ? 6 : 2, flexShrink: 0 }}>edit</span>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {multiline
        ? <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={3} style={{ ...inputStyle, resize: 'vertical', fontSize: 13, padding: '8px 12px' }} />
        : <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus style={{ ...inputStyle, fontSize: large ? 18 : 13, padding: '6px 12px' }} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: '#22c55e', color: '#fff' }} onClick={commit} disabled={saving}>{saving ? '...' : 'Save'}</button>
        <button style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.07)', color: '#888' }} onClick={() => setEditing(false)}>Cancel</button>
      </div>
    </div>
  );
}
