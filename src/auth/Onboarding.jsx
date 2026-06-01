import { useState } from 'react';
import { useAuth } from './AuthContext';
import { createOrUpdateUser } from '../firestoreService';

const SCHOOLS = [
  { id: 'hart',       label: 'Hart MS' },
  { id: 'van_hoosen', label: 'Van Hoosen MS' },
  { id: 'west',       label: 'West MS' },
  { id: 'reuther',    label: 'Reuther MS' },
];

export function Onboarding() {
  const { firebaseUser, role } = useAuth();
  const [name,   setName]   = useState(firebaseUser?.displayName ?? '');
  const [school, setSchool] = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  async function submit() {
    if (!name.trim()) return setError('Enter a display name.');
    if (!school)      return setError('Select your school.');
    setSaving(true);
    try {
      await createOrUpdateUser(firebaseUser.uid, {
        email: firebaseUser.email, displayName: name.trim(), school, role,
      });
    } catch { setError('Something went wrong — try again.'); setSaving(false); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Lato, sans-serif', padding: '0 24px' }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 28,
          fontWeight: 900, marginBottom: 6 }}>
          Welcome to Bracket <em>Challenge</em>
        </h1>
        <p style={{ color: 'var(--ink-mid)', fontSize: 13, marginBottom: 28 }}>
          Signed in as {firebaseUser?.email}
        </p>

        <label style={{ display: 'block', fontWeight: 700, fontSize: 11,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6,
          color: 'var(--ink-mid)' }}>
          Display name (shown on leaderboard)
        </label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="First name or nickname"
          style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--ink)',
            borderRadius: 7, fontSize: 14, fontFamily: 'Lato, sans-serif',
            background: 'var(--paper-wt)', marginBottom: 20, outline: 'none',
            boxShadow: '2px 2px 0 var(--ink)', boxSizing: 'border-box' }} />

        <label style={{ display: 'block', fontWeight: 700, fontSize: 11,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
          color: 'var(--ink-mid)' }}>
          Your school
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {SCHOOLS.map(s => (
            <button key={s.id} onClick={() => setSchool(s.id)} style={{
              padding: '13px 10px', border: '2px solid var(--ink)', borderRadius: 7,
              fontFamily: 'Lato, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              background: school === s.id ? 'var(--bb-banner)' : 'var(--paper-wt)',
              color: school === s.id ? '#fff' : 'var(--ink)',
              boxShadow: school === s.id ? 'none' : '2px 2px 0 var(--ink)',
              transition: 'all 0.12s',
            }}>{s.label}</button>
          ))}
        </div>

        {error && <p style={{ color: '#C8302A', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={saving} style={{
          width: '100%', padding: 13, background: 'var(--ink)', color: '#fff',
          border: 'none', borderRadius: 7, fontFamily: 'Lato, sans-serif',
          fontWeight: 900, fontSize: 15, cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : "Let's go →"}
        </button>
      </div>
    </div>
  );
}
