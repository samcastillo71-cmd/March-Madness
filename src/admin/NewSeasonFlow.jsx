import { useState } from 'react';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { setTournamentLocked, setMammalTournamentLocked } from '../firestoreService';
import { ConfirmDialog } from '../components/ConfirmDialog';

const SCHOOLS = ['hart', 'van_hoosen', 'west', 'reuther'];

const STEPS = [
  'Update year in config',
  'Clear basketball roster & official bracket',
  'Clear basketball research',
  'Clear all basketball brackets & leaderboard',
  'Clear mammal roster & official bracket',
  'Clear mammal research',
  'Clear all mammal brackets & leaderboard',
  'Unlock all locks',
];

export function NewSeasonFlow({ currentYear }) {
  const [confirm,  setConfirm]  = useState(false);
  const [running,  setRunning]  = useState(false);
  const [progress, setProgress] = useState(-1);
  const [done,     setDone]     = useState(false);
  const newYear = (currentYear ?? 2026) + 1;

  async function run() {
    setRunning(true); setProgress(0);
    const step = async (fn) => { await fn(); setProgress(p => p + 1); };

    try {
      await step(() => setDoc(doc(db, 'tournament', 'config'), { year: newYear }, { merge: true }));
      await step(() => Promise.all([
        setDoc(doc(db, 'admin', 'teamRoster'),      { teams: {} }),
        setDoc(doc(db, 'admin', 'officialBracket'), { bracket: '' }),
      ]));
      await step(() => setDoc(doc(db, 'admin', 'researchData'), { teams: {} }));
      await step(async () => {
        const [b, l] = await Promise.all([
          getDocs(collection(db, 'brackets')),
          getDocs(collection(db, 'leaderboard')),
        ]);
        await Promise.all([...b.docs, ...l.docs].map(d => deleteDoc(d.ref)));
      });
      await step(() => Promise.all([
        setDoc(doc(db, 'admin', 'mammalRoster'),            { animals: {} }),
        setDoc(doc(db, 'admin', 'officialBracket_mammals'), { bracket: '' }),
      ]));
      await step(() => setDoc(doc(db, 'admin', 'researchData_mammals'), { animals: {} }));
      await step(async () => {
        const [mb, ml] = await Promise.all([
          getDocs(collection(db, 'brackets_mammals')),
          getDocs(collection(db, 'leaderboard_mammals')),
        ]);
        await Promise.all([...mb.docs, ...ml.docs].map(d => deleteDoc(d.ref)));
      });
      await step(() => Promise.all([
        setTournamentLocked(false),
        setMammalTournamentLocked(false),
        setDoc(doc(db, 'tournament', 'config'),
          { school_locks: Object.fromEntries(SCHOOLS.map(s => [s, false])) }, { merge: true }),
        setDoc(doc(db, 'tournament', 'config_mammals'),
          { school_locks: Object.fromEntries(SCHOOLS.map(s => [s, false])) }, { merge: true }),
      ]));
      setDone(true);
    } finally { setRunning(false); }
  }

  if (done) return (
    <div style={{ padding: 24 }}>
      <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 20,
        color: 'var(--bb-win)', fontWeight: 900 }}>
        ✓ Season {newYear} ready
      </p>
      <p style={{ color: 'var(--ink-mid)', marginTop: 8, fontSize: 13 }}>
        Enter new rosters and generate research when ready.
      </p>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 460 }}>
      <h3 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
        Start New Season
      </h3>
      <p style={{ color: 'var(--ink-mid)', fontSize: 13, marginBottom: 20 }}>
        Clears all data from both tournaments and sets the year to {newYear}.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <li key={i} style={{ fontSize: 12, padding: '4px 0',
            fontWeight: progress > i ? 700 : 400,
            color: progress > i ? 'var(--bb-win)' : progress === i ? 'var(--ink)' : 'var(--ink-low)' }}>
            {progress > i ? '✓' : progress === i && running ? '→' : '○'} {s}
          </li>
        ))}
      </ul>

      {!running && (
        <button onClick={() => setConfirm(true)} style={{
          padding: '11px 24px', background: '#C8302A', color: '#fff',
          border: 'none', borderRadius: 6, fontFamily: 'Lato, sans-serif',
          fontWeight: 900, fontSize: 14, cursor: 'pointer',
        }}>
          Start New Season →
        </button>
      )}
      {running && (
        <p style={{ color: 'var(--ink-mid)', fontSize: 13 }}>
          Running… step {Math.min(progress + 1, STEPS.length)}/{STEPS.length}
        </p>
      )}

      {confirm && (
        <ConfirmDialog
          message={`Permanently delete ALL bracket data from both tournaments and start ${newYear}? This cannot be undone.`}
          onConfirm={() => { setConfirm(false); run(); }}
          onCancel={() => setConfirm(false)}
        />
      )}
    </div>
  );
}
