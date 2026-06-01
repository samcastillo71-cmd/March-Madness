import { useState } from 'react';
import { useAuth }  from './AuthContext';
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
      // AuthContext's subscribeToUser will update userDoc → needsOnboarding becomes false
    } catch {
      setError('Something went wrong — try again.');
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1a1a1a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'inherit', padding: '0 24px',
    }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>🏀</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 26,
          fontWeight: 900, marginBottom: 6, color: '#e8d5a3', textAlign: 'center' }}>
          Welcome to Bracket Challenge
        </h1>
        <p style={{ color: '#777', fontSize: 13, marginBottom: 28, textAlign: 'center' }}>
          Signed in as {firebaseUser?.email}
        </p>

        <label style={{ display: 'block', fontWeight: 700, fontSize: 11,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6, color: '#888' }}>
          Display name (shown on leaderboard)
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="First name or nickname"
          style={{
            width: '100%', padding: '10px 14px',
            border: '1px solid #333', borderRadius: 8,
            fontSize: 14, background: '#222', color: '#fff',
            marginBottom: 20, outline: 'none', boxSizing: 'border-box',
          }}
        />

        <label style={{ display: 'block', fontWeight: 700, fontSize: 11,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, color: '#888' }}>
          Your school
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
          {SCHOOLS.map(s => (
            <button key={s.id} onClick={() => setSchool(s.id)} style={{
              padding: '13px 10px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
              border: '2px solid ' + (school === s.id ? '#22c55e' : '#333'),
              background: school === s.id ? 'rgba(34,197,94,0.15)' : '#222',
              color: school === s.id ? '#22c55e' : '#aaa',
              transition: 'all 0.12s',
            }}>{s.label}</button>
          ))}
        </div>

        {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</p>}

        <button onClick={submit} disabled={saving} style={{
          width: '100%', padding: 13, background: '#22c55e', color: '#000',
          border: 'none', borderRadius: 8, fontFamily: 'inherit',
          fontWeight: 900, fontSize: 15, cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving…' : "Let's go →"}
        </button>
      </div>
    </div>
  );
}
