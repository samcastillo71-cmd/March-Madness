// api/teacher-action.js — Privileged teacher actions via Firebase Admin SDK
// Teachers cannot write to other users' Firestore docs via client SDK (security rules).
// This endpoint verifies the caller is a teacher, scopes actions to their school,
// then performs the write server-side using the Admin SDK (bypasses rules).
//
// Required env var: FIREBASE_SERVICE_ACCOUNT — full service account JSON as a string.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ADMIN_EMAILS = ['sam.castillo71@gmail.com', 'scastillo@rcs-k12.us'];
const VALID_SCHOOLS = ['Hart', 'Van Hoosen', 'Reuther', 'West'];
const USER_COLLECTIONS = ['brackets', 'brackets_mammals', 'leaderboard', 'leaderboard_mammals'];

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return initializeApp({ credential: cert(serviceAccount) });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }
  }

  const { idToken, action, targetUid, school } = body || {};
  if (!idToken || !action || !targetUid) {
    return res.status(400).json({ error: 'Missing required fields: idToken, action, targetUid' });
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[teacher-action] FIREBASE_SERVICE_ACCOUNT not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const app = getAdminApp();
  const adminAuth = getAuth(app);
  const adminDb = getFirestore(app);

  // Verify caller's Firebase ID token
  let callerToken;
  try {
    callerToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const callerEmail = callerToken.email;
  const isAdmin = ADMIN_EMAILS.includes(callerEmail);

  // Non-admins must be a registered teacher
  let callerSchool = null;
  if (!isAdmin) {
    const teachersSnap = await adminDb.doc('admin/teachers').get();
    const teachers = teachersSnap.exists ? teachersSnap.data() : {};
    if (!teachers[callerEmail]) {
      return res.status(403).json({ error: 'Not authorized: not a registered teacher' });
    }
    callerSchool = teachers[callerEmail].school;
  }

  // Teachers: verify target student is at the same school
  if (!isAdmin) {
    const targetSnap = await adminDb.doc(`users/${targetUid}`).get();
    if (!targetSnap.exists) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const targetSchool = targetSnap.data().school;
    if (targetSchool !== callerSchool) {
      return res.status(403).json({ error: 'Student is not at your school' });
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  if (action === 'removeStudent') {
    await Promise.all(
      USER_COLLECTIONS.map(col =>
        adminDb.doc(`${col}/${targetUid}`).delete().catch(() => {})
      )
    );
    return res.status(200).json({ ok: true });
  }

  if (action === 'editSchool') {
    if (!school) return res.status(400).json({ error: 'Missing school' });
    if (!VALID_SCHOOLS.includes(school)) return res.status(400).json({ error: 'Invalid school' });
    await adminDb.doc(`users/${targetUid}`).set(
      { school, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
