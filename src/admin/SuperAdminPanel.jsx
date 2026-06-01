import { useState }    from 'react';
import { doc, setDoc, deleteDoc, getDocs, collection } from 'firebase/firestore';
import { db }           from '../firebase';
import { setAdminPassword, deleteBracketAndScore, setDeadline } from '../firestoreService';
import { setTournamentLocked, setMammalTournamentLocked } from '../firestoreService';
import { buildInitialBracket } from '../bracketData';
import { Avatar }       from '../components/Avatar';
import { TeamEntryPanel }   from './TeamEntryPanel';
import { MammalEntryPanel } from './MammalEntryPanel';
import { NewSeasonFlow }    from './NewSeasonFlow';

const ACCENT  = '#16a34a';
const ACCENT2 = '#4ade80';
const GOLD2   = '#fcd34d';

const S = {
  card:   { background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.30)', borderRadius: 12, padding: 20 },
  btn:    (bg = ACCENT, fg = '#fff') => ({ padding: '10px 22px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: bg, color: fg, letterSpacing: 0.3 }),
  navBtn: a => ({ padding: '7px 15px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: a ? ACCENT : 'transparent', color: a ? '#fff' : '#999', transition: 'all .15s' }),
  input:  { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(22,163,74,0.35)', borderRadius: 8, color: '#fff', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%' },
};

export function SuperAdminPanel({
  config, tournamentYear, yearDraft, setYearDraft, yearSaving, handleSaveYear,
  locked, setLocked, mammalLocked, setMammalLocked,
  leaderboard, setLeaderboard, mammalLeaderboard, setMammalLeaderboard,
  bbRegionNames, handleSaveBbRegionNames,
  mammalRegionNames, setMammalRegionNames,
  bbSources, handleSaveBbSources,
  mammalSources, handleSaveMammalSources,
  handleGenerateResearch, handleGenerateMammalResearch, handleRefetchMammalImages,
  setBracket, setOfficialBracket, setMammalBracket, setMammalOfficialBracket,
  setResearchData, setSelectedTeam, setMammalResearchData, setMammalSelectedAnimal,
  setConfirmDialog,
}) {
  const [adminSubTab, setAdminSubTab] = useState('dashboard');

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#e74c3c', boxShadow: '0 0 6px #e74c3c' }} />
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#e74c3c', margin: 0 }}>Admin Panel</h2>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {[['dashboard','Dashboard'],['teams','🏀 Basketball'],['mammals','🦁 Mammal Madness'],['users','👥 Users'],['new-season','🗓 New Season'],['help','Help']].map(([id, label]) => (
          <button key={id} style={{ ...S.navBtn(adminSubTab === id), borderBottom: adminSubTab === id ? '2px solid #e74c3c' : '2px solid transparent', borderRadius: '6px 6px 0 0', padding: '8px 18px' }} onClick={() => setAdminSubTab(id)}>{label}</button>
        ))}
      </div>

      {adminSubTab === 'dashboard' && (
        <>
          <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
            <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Tournament Year</h3>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Updates the year shown on the entry screen and header for all users.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="number" value={yearDraft} onChange={e => setYearDraft(e.target.value)} style={{ ...S.input, width: 110, padding: '8px 12px', fontSize: 16 }} />
              <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px' }} onClick={handleSaveYear} disabled={yearSaving}>{yearSaving ? 'Saving...' : 'Update Year'}</button>
              <span style={{ fontSize: 12, color: '#777' }}>Currently: <strong style={{ color: ACCENT2 }}>{tournamentYear}</strong></span>
            </div>
          </div>

          <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: ACCENT2, marginBottom: 4, fontSize: 15 }}>Basketball Lock</h3>
                <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Status: <span style={{ color: locked ? '#e74c3c' : '#22c55e', fontWeight: 700 }}>{locked ? 'Locked' : 'Open'}</span></p>
              </div>
              <button style={{ ...S.btn(locked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 13, padding: '8px 20px' }}
                onClick={() => setConfirmDialog({ message: `${locked ? 'Unlock' : 'Lock'} all Basketball brackets?`, onConfirm: async () => { setConfirmDialog(null); const nl = !locked; setLocked(nl); await setTournamentLocked(nl); } })}>
                {locked ? 'Unlock' : 'Lock All'}
              </button>
            </div>
          </div>

          <div style={{ ...S.card, borderColor: 'rgba(134,239,172,0.2)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: '#86efac', marginBottom: 4, fontSize: 15 }}>Mammal Lock</h3>
                <p style={{ color: '#999', fontSize: 13, margin: 0 }}>Status: <span style={{ color: mammalLocked ? '#e74c3c' : '#22c55e', fontWeight: 700 }}>{mammalLocked ? 'Locked' : 'Open'}</span></p>
              </div>
              <button style={{ ...S.btn(mammalLocked ? '#22c55e' : '#e74c3c', '#fff'), fontSize: 13, padding: '8px 20px' }}
                onClick={() => setConfirmDialog({ message: `${mammalLocked ? 'Unlock' : 'Lock'} all Mammal Madness brackets?`, onConfirm: async () => { setConfirmDialog(null); const nl = !mammalLocked; setMammalLocked(nl); await setMammalTournamentLocked(nl); } })}>
                {mammalLocked ? 'Unlock' : 'Lock All'}
              </button>
            </div>
          </div>

          <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
            <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Bracket Deadline</h3>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>After this time, brackets auto-lock for all students regardless of the manual lock setting. Leave blank for no deadline.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="datetime-local"
                defaultValue={config?.deadline ? config.deadline.slice(0, 16) : ''}
                onChange={e => setDeadline(e.target.value ? new Date(e.target.value).toISOString() : '')}
                style={{ ...S.input, width: 'auto', padding: '8px 12px', fontSize: 13 }}
              />
              {config?.deadline && (
                <button style={{ ...S.btn('rgba(239,68,68,0.2)', '#f87171'), fontSize: 12, padding: '8px 14px' }}
                  onClick={() => setDeadline('')}>
                  Clear
                </button>
              )}
              {config?.deadline && <span style={{ fontSize: 12, color: '#555' }}>Currently: <strong style={{ color: ACCENT2 }}>{new Date(config.deadline).toLocaleString()}</strong></span>}
            </div>
          </div>

          <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.3)', marginBottom: 16 }}>
            <h3 style={{ color: ACCENT2, marginBottom: 8, fontSize: 15 }}>Admin Password</h3>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 12 }}>Change the password used to access this admin panel.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="password" placeholder="New password" id="new-admin-pw" style={{ ...S.input, flex: 1, padding: '8px 12px' }} />
              <button style={{ ...S.btn(ACCENT, '#fff'), padding: '8px 20px', flexShrink: 0 }} onClick={async () => {
                const val = document.getElementById('new-admin-pw').value.trim();
                if (!val) return;
                await setAdminPassword(val);
                document.getElementById('new-admin-pw').value = '';
                alert('Password updated.');
              }}>Update</button>
            </div>
          </div>

          <div style={{ ...S.card, borderColor: 'rgba(231,76,60,0.2)', marginBottom: 16 }}>
            <p style={{ color: '#999', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              Use the <strong style={{ color: ACCENT2 }}>Bracket tab</strong> to enter official game results — your picks become the answer key and update all scores live.<br /><br />
              Use <strong style={{ color: ACCENT2 }}>Admin → 🏀 Basketball</strong> every March after Selection Sunday to enter teams.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[['Total Entries', leaderboard.length], ['Avg Score', leaderboard.length ? Math.round(leaderboard.reduce((a,e) => a+(e.score||0),0)/leaderboard.length)+' pts' : '-'], ['Status', locked ? 'Locked' : 'Open']].map(([l,v]) => (
              <div key={l} style={{ ...S.card, textAlign: 'center' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT2, fontFamily: "'Playfair Display', serif" }}>{v}</div>
                <div style={{ fontSize: 11, color: '#777', marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {adminSubTab === 'teams' && (
        <>
          <TeamEntryPanel
            onTeamsSaved={(nb) => { setBracket(nb); setOfficialBracket(nb); }}
            onRequestGenerateResearch={handleGenerateResearch}
            regionNames={bbRegionNames}
            onRegionNamesChange={handleSaveBbRegionNames}
            sourcesData={bbSources}
            onSaveSources={handleSaveBbSources}
          />
          <div style={{ marginTop: 40, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 24 }}>
            <div style={{ fontSize: 11, color: '#e74c3c', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>⚠️ Danger Zone</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                ['Clear Basketball Roster', 'Deletes the team roster and official bracket.', async () => { await Promise.all([deleteDoc(doc(db, 'admin', 'teamRoster')).catch(()=>{}), deleteDoc(doc(db, 'admin', 'officialBracket')).catch(()=>{})]); setOfficialBracket(null); setBracket(buildInitialBracket()); }],
                ['Clear Basketball Research', 'Deletes all scouting reports.', async () => { await deleteDoc(doc(db, 'admin', 'researchData')).catch(()=>{}); setResearchData({}); setSelectedTeam(null); }],
                ['Clear All User Brackets', 'Resets the leaderboard.', async () => { const [bs, ls] = await Promise.all([getDocs(collection(db, 'brackets')), getDocs(collection(db, 'leaderboard'))]); await Promise.all([...bs.docs.map(d => deleteDoc(d.ref)), ...ls.docs.map(d => deleteDoc(d.ref))]); setLeaderboard([]); }],
              ].map(([title, desc, action]) => (
                <div key={title} style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 200 }}>
                  <h4 style={{ color: '#f87171', marginBottom: 6 }}>{title}</h4>
                  <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>{desc}</p>
                  <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }} onClick={() => setConfirmDialog({ message: `${title}? This cannot be undone.`, onConfirm: async () => { setConfirmDialog(null); await action(); } })}>{title}</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {adminSubTab === 'mammals' && (
        <>
          <MammalEntryPanel
            onAnimalsSaved={(nb) => { setMammalBracket(nb); setMammalOfficialBracket(nb); }}
            onRequestGenerateMammalResearch={handleGenerateMammalResearch}
            onRefetchImages={handleRefetchMammalImages}
            regionNames={mammalRegionNames}
            onRegionNamesChange={setMammalRegionNames}
            sourcesData={mammalSources}
            onSaveSources={handleSaveMammalSources}
          />
          <div style={{ marginTop: 40, borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: 24 }}>
            <div style={{ fontSize: 11, color: '#e74c3c', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 16 }}>⚠️ Danger Zone</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                ['Clear Mammal Roster', 'Deletes the animal roster and bracket.', async () => { await Promise.all([deleteDoc(doc(db, 'admin', 'mammalRoster')).catch(()=>{}), deleteDoc(doc(db, 'admin', 'officialBracket_mammals')).catch(()=>{})]); setMammalOfficialBracket(null); setMammalBracket(buildInitialBracket()); }],
                ['Clear Mammal Research', 'Deletes all organism profiles.', async () => { await deleteDoc(doc(db, 'admin', 'researchData_mammals')).catch(()=>{}); setMammalResearchData({}); setMammalSelectedAnimal(null); }],
                ['Clear All Mammal Brackets', 'Resets the mammal leaderboard.', async () => { const [bs, ls] = await Promise.all([getDocs(collection(db, 'brackets_mammals')), getDocs(collection(db, 'leaderboard_mammals'))]); await Promise.all([...bs.docs.map(d => deleteDoc(d.ref)), ...ls.docs.map(d => deleteDoc(d.ref))]); setMammalLeaderboard([]); }],
              ].map(([title, desc, action]) => (
                <div key={title} style={{ ...S.card, borderColor: 'rgba(239,68,68,0.25)', flex: 1, minWidth: 200 }}>
                  <h4 style={{ color: '#f87171', marginBottom: 6 }}>{title}</h4>
                  <p style={{ color: '#777', fontSize: 12, marginBottom: 12 }}>{desc}</p>
                  <button style={{ ...S.btn('#7f1d1d', '#fca5a5'), padding: '7px 16px', fontSize: 12, border: '1px solid rgba(239,68,68,0.4)' }} onClick={() => setConfirmDialog({ message: `${title}? This cannot be undone.`, onConfirm: async () => { setConfirmDialog(null); await action(); } })}>{title}</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {adminSubTab === 'users' && (
        <div>
          <h3 style={{ color: ACCENT2, marginBottom: 4 }}>User Entries</h3>
          <p style={{ color: '#777', fontSize: 13, marginBottom: 20 }}>All users who have submitted a bracket. Removing a user deletes their bracket and score.</p>
          {leaderboard.length === 0 ? <div style={{ ...S.card, textAlign: 'center', padding: 40, color: '#666' }}>No users yet</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {leaderboard.map(e => (
                <div key={e.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                  <Avatar name={e.displayName} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: '#ccc', fontWeight: 500 }}>{e.displayName || 'Anonymous'}</div>
                    <div style={{ fontSize: 11, color: '#555' }}>Score: {e.score} pts {e.isTeacher ? '· Teacher' : ''}</div>
                  </div>
                  <button onClick={() => setConfirmDialog({ message: `Remove ${e.displayName}? This deletes their bracket and score.`, onConfirm: async () => { setConfirmDialog(null); await deleteBracketAndScore(e.uid, false); await deleteBracketAndScore(e.uid, true); } })} style={{ ...S.btn('rgba(239,68,68,0.15)', '#f87171'), padding: '5px 14px', fontSize: 12, border: '1px solid rgba(239,68,68,0.3)', flexShrink: 0 }}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 16 }}>
            <h4 style={{ color: '#777', marginBottom: 10, fontSize: 13 }}>Mark a user as Teacher (appears with Teacher badge on leaderboard)</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="teacher-name" placeholder="Exact display name" style={{ ...S.input, flex: 1, padding: '8px 12px', fontSize: 13 }} />
              <button style={{ ...S.btn('#f59e0b', '#000'), padding: '8px 16px', fontSize: 13, flexShrink: 0 }} onClick={async () => {
                const name = document.getElementById('teacher-name').value.trim();
                if (!name) return;
                const match = leaderboard.find(e => e.displayName?.toLowerCase() === name.toLowerCase());
                if (!match) { alert('User not found on leaderboard.'); return; }
                await setDoc(doc(db, 'leaderboard', match.uid), { isTeacher: true }, { merge: true });
                document.getElementById('teacher-name').value = '';
                alert(`${match.displayName} marked as Teacher.`);
              }}>Mark as Teacher</button>
            </div>
          </div>
        </div>
      )}

      {adminSubTab === 'new-season' && (
        <NewSeasonFlow currentYear={tournamentYear} />
      )}

      {adminSubTab === 'help' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={S.card}>
            <h3 style={{ color: ACCENT2, marginBottom: 14 }}>How Admin Access Works</h3>
            <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
              Admin access is granted to accounts that have the <code>superAdmin: true</code> flag set in Firestore under <code>users/&#123;uid&#125;</code>. Teachers with a <code>@rochester.k12.mi.us</code> email get the Teacher Panel automatically.<br /><br />
              Students see no admin tab.
            </p>
          </div>
          <div style={{ ...S.card, borderColor: 'rgba(245,158,11,0.25)' }}>
            <h3 style={{ color: GOLD2, marginBottom: 14 }}>Marking Teachers</h3>
            <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
              Go to Admin → Users tab. Find the teacher's name on the leaderboard, then use the "Mark as Teacher" field at the bottom. They'll get a Teacher badge on the leaderboard.
            </p>
          </div>
          <div style={{ ...S.card, borderColor: 'rgba(22,163,74,0.2)' }}>
            <h3 style={{ color: ACCENT2, marginBottom: 14 }}>New Season</h3>
            <p style={{ color: '#888', fontSize: 14, lineHeight: 1.75 }}>
              Use Admin → 🗓 New Season to reset all data at the start of a new year. This clears all brackets, leaderboards, rosters, and research, and increments the year.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
