// src/firestoreService.js
// All Firestore read/write operations in one place.
// You never need to edit this file.

import {
  doc, getDoc, setDoc,
  collection, query, orderBy, limit,
  serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

// ── USER BRACKET ──────────────────────────────────────────────────────────────

export async function saveBracket(uid, bracketData, displayName, photoURL) {
  await setDoc(doc(db, 'brackets', uid), {
    bracket:     JSON.stringify(bracketData),
    displayName: displayName || 'Anonymous',
    photoURL:    photoURL || null,
    updatedAt:   serverTimestamp(),
  }, { merge: true });
}

export async function loadBracket(uid) {
  const snap = await getDoc(doc(db, 'brackets', uid));
  if (!snap.exists()) return null;
  const raw = snap.data().bracket;
  return raw ? JSON.parse(raw) : null;
}

// ── OFFICIAL RESULTS BRACKET (admin writes, everyone reads) ───────────────────

export async function saveOfficialBracket(bracketData) {
  await setDoc(doc(db, 'admin', 'officialBracket'), {
    bracket:   JSON.stringify(bracketData),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToOfficialBracket(callback) {
  return onSnapshot(doc(db, 'admin', 'officialBracket'), snap => {
    if (snap.exists()) callback(JSON.parse(snap.data().bracket));
  });
}

// ── TOURNAMENT CONFIG (locked status) ─────────────────────────────────────────

export function subscribeToConfig(callback) {
  return onSnapshot(doc(db, 'tournament', 'config'), snap => {
    if (snap.exists()) callback(snap.data());
    else callback({ locked: false });
  });
}

export async function setTournamentLocked(locked) {
  await setDoc(doc(db, 'tournament', 'config'), {
    locked,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────

/**
 * Update a user's leaderboard entry.
 * isTeacher flag is stored so the leaderboard can separate students and teachers.
 */
export async function updateLeaderboardEntry(uid, displayName, photoURL, score, isTeacher = false) {
  await setDoc(doc(db, 'leaderboard', uid), {
    displayName: displayName || 'Anonymous',
    photoURL:    photoURL || null,
    score,
    isTeacher:   !!isTeacher,
    updatedAt:   serverTimestamp(),
  }, { merge: true });
}

export function subscribeToLeaderboard(callback, n = 200) {
  const q = query(
    collection(db, 'leaderboard'),
    orderBy('score', 'desc'),
    limit(n)
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map((d, i) => ({ uid: d.id, rank: i + 1, ...d.data() })));
  });
}

// ── ADMIN CHECK ───────────────────────────────────────────────────────────────

export async function checkIsAdmin(uid) {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}

// ── TEACHER CHECK ─────────────────────────────────────────────────────────────

export async function checkIsTeacher(uid) {
  const snap = await getDoc(doc(db, 'teachers', uid));
  return snap.exists();
}

// ── TEAM RESEARCH DATA ────────────────────────────────────────────────────────
// Research cards for all 64 teams, stored in Firestore.
// Admin can auto-generate via AI and then manually edit any field.

/** Load all research data — returns object keyed by team name */
export async function loadResearchData() {
  const snap = await getDoc(doc(db, 'admin', 'researchData'));
  if (!snap.exists()) return {};
  return snap.data().teams || {};
}

/** Save all research data at once */
export async function saveResearchData(teamsObj) {
  await setDoc(doc(db, 'admin', 'researchData'), {
    teams:     teamsObj,
    updatedAt: serverTimestamp(),
  });
}

/** Save a single team's research card (used when admin edits one team) */
export async function saveOneTeamResearch(teamName, cardData) {
  const snap = await getDoc(doc(db, 'admin', 'researchData'));
  const existing = snap.exists() ? (snap.data().teams || {}) : {};
  existing[teamName] = cardData;
  await setDoc(doc(db, 'admin', 'researchData'), {
    teams:     existing,
    updatedAt: serverTimestamp(),
  });
}

/** Subscribe to live research data updates */
export function subscribeToResearchData(callback) {
  return onSnapshot(doc(db, 'admin', 'researchData'), snap => {
    if (snap.exists()) callback(snap.data().teams || {});
    else callback({});
  });
}
