import { useState } from 'react';
import { useAuth }  from '../auth/AuthContext';
import { setSchoolLocked, setMammalSchoolLocked } from '../firestoreService';

const SCHOOL_LABELS = {
  hart: 'Hart', van_hoosen: 'Van Hoosen', west: 'West', reuther: 'Reuther',
};

export function TeacherPanel({ config, mammalConfig, activeTournament, leaderboard, mammalLeaderboard }) {
  const { school } = useAuth();
  const cfg      = activeTournament === 'basketball' ? config : mammalConfig;
  const isLocked = cfg?.school_locks?.[school] ?? false;
  const [saving, setSaving] = useState(false);

  async function toggleLock() {
    setSaving(true);
    try {
      if (activeTournament === 'basketball') await setSchoolLocked(school, !isLocked);
      else                                   await setMammalSchoolLocked(school, !isLocked);
    } finally { setSaving(false); }
  }

  const myEntries = (activeTournament === 'basketball' ? leaderboard : mammalLeaderboard)
    .filter(e => e.school === school);

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22,
        fontWeight: 900, marginBottom: 20 }}>
        {SCHOOL_LABELS[school] ?? school} — Teacher Panel
      </h2>

      <div style={{ border: '2px solid var(--ink)', borderRadius: 8, padding: 18,
        boxShadow: '3px 3px 0 var(--ink)', marginBottom: 20,
        background: 'var(--paper-wt)' }}>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700,
          fontSize: 16, marginBottom: 10 }}>Bracket Submissions</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-mid)', marginBottom: 14 }}>
          {isLocked ? "🔒 Your school's brackets are locked." : '🔓 Submissions open for your school.'}
        </p>
        <button onClick={toggleLock} disabled={saving} style={{
          padding: '9px 20px', background: isLocked ? 'var(--bb-win)' : '#C8302A',
          color: '#fff', border: 'none', borderRadius: 6,
          fontFamily: 'Lato, sans-serif', fontWeight: 900, fontSize: 13, cursor: 'pointer',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? '…' : isLocked ? 'Unlock My School' : 'Lock My School'}
        </button>
        <p style={{ fontSize: 11, color: 'var(--ink-low)', marginTop: 10 }}>
          This only affects your school. The global lock is controlled by the district admin.
        </p>
      </div>

      <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 700,
        fontSize: 16, marginBottom: 12 }}>
        {SCHOOL_LABELS[school]} Entries ({myEntries.length})
      </h3>
      {myEntries.map(e => (
        <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', border: '1px solid var(--rule)', borderRadius: 6,
          marginBottom: 6, background: 'var(--paper-wt)', fontSize: 13 }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{e.displayName}</span>
          <span style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900 }}>{e.score}</span>
        </div>
      ))}
      {myEntries.length === 0 && (
        <p style={{ color: 'var(--ink-low)', fontStyle: 'italic', fontSize: 13 }}>
          No entries from your school yet.
        </p>
      )}
    </div>
  );
}
