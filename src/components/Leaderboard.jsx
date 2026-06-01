import { useState } from 'react';
import { useAuth }  from '../auth/AuthContext';
import { Avatar }   from './Avatar';

const SCHOOL_LABELS = {
  hart: 'Hart', van_hoosen: 'Van Hoosen', west: 'West', reuther: 'Reuther',
};

export function Leaderboard({ entries, isMammal, onViewBracket }) {
  const { school: mySchool, firebaseUser } = useAuth();
  const [showAll, setShowAll] = useState(false);

  const visible   = showAll ? entries : entries.filter(e => e.school === mySchool);
  const bannerBg  = isMammal ? 'var(--mm-banner)' : 'var(--bb-banner)';
  const accentClr = isMammal ? 'var(--mm-accent)' : 'var(--bb-accent)';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setShowAll(v => !v)} style={{
          fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700,
          letterSpacing: 1, textTransform: 'uppercase', padding: '5px 14px',
          border: '1.5px solid var(--ink)', borderRadius: 4, cursor: 'pointer',
          background: showAll ? 'var(--ink)' : 'var(--paper-wt)',
          color: showAll ? '#fff' : 'var(--ink)',
          boxShadow: showAll ? 'none' : '2px 2px 0 var(--ink)',
          transition: 'all 0.12s',
        }}>
          {showAll ? 'My School' : 'All Schools'}
        </button>
      </div>

      <div style={{ border: '2px solid var(--ink)', borderRadius: 10, overflow: 'hidden',
        boxShadow: '4px 4px 0 var(--ink)', background: 'var(--paper-wt)' }}>
        <div style={{ background: bannerBg, borderBottom: `2px solid ${accentClr}`,
          padding: '11px 16px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center' }}>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 16,
            fontWeight: 900, fontStyle: 'italic', color: '#fff' }}>
            {showAll ? 'All Schools' : (SCHOOL_LABELS[mySchool] ?? 'My School')}
          </span>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9,
            color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5 }}>
            {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {visible.length === 0 && (
          <p style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--ink-low)',
            fontStyle: 'italic', fontSize: 14 }}>
            No entries yet — be the first!
          </p>
        )}

        {visible.map((entry, i) => {
          const rankColors = { 1: '#B8880A', 2: '#888', 3: '#9B6B3C' };
          const isMe = entry.uid === firebaseUser?.uid;
          return (
            <div key={entry.uid} onClick={() => onViewBracket(entry.uid, entry.displayName, isMammal)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                borderBottom: '1px solid var(--rule)', cursor: 'pointer',
                background: isMe ? 'rgba(42,122,79,0.06)' : 'transparent',
                outline: isMe ? '2px solid var(--bb-win)' : 'none',
                outlineOffset: -2, transition: 'background 0.1s' }}>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 15,
                fontWeight: 900, minWidth: 22, textAlign: 'center',
                color: rankColors[i + 1] ?? 'var(--rule)' }}>
                {i + 1}
              </span>
              <Avatar name={entry.displayName} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.displayName}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                  {entry.isTeacher && (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 8,
                      letterSpacing: 1, textTransform: 'uppercase',
                      color: isMammal ? 'var(--mm-accent)' : 'var(--bb-accent)' }}>
                      Teacher
                    </span>
                  )}
                  {showAll && entry.school && (
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 8,
                      letterSpacing: 1, color: 'var(--ink-low)' }}>
                      {SCHOOL_LABELS[entry.school] ?? entry.school}
                    </span>
                  )}
                </div>
              </div>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 17,
                fontWeight: 900, color: 'var(--ink)' }}>
                {entry.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
