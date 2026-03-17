// src/firestoreService.js
// All Firestore read/write operations in one place.
// You never need to edit this file.

import {
  doc, getDoc, setDoc, deleteDoc, getDocs,
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

// ── USER REGISTRY ─────────────────────────────────────────────────────────────
// Every user is registered on sign-in so admins can manage roles without
// ever touching Firebase Console.

export async function registerUser(uid, displayName, photoURL, email) {
  await setDoc(doc(db, 'users', uid), {
    displayName: displayName || 'Anonymous',
    photoURL:    photoURL || null,
    email:       email || null,
    lastSeen:    serverTimestamp(),
  }, { merge: true });
}

export function subscribeToAllUsers(callback) {
  return onSnapshot(collection(db, 'users'), snap => {
    callback(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  });
}

// ── ROLE MANAGEMENT ───────────────────────────────────────────────────────────

export async function grantTeacherRole(uid) {
  await setDoc(doc(db, 'teachers', uid), { grantedAt: serverTimestamp() });
}

export async function revokeTeacherRole(uid) {
  await deleteDoc(doc(db, 'teachers', uid));
}

export async function grantAdminRole(uid) {
  await setDoc(doc(db, 'admins', uid), { grantedAt: serverTimestamp() });
}

export async function revokeAdminRole(uid) {
  await deleteDoc(doc(db, 'admins', uid));
}

export async function loadTeacherUids() {
  const snap = await getDocs(collection(db, 'teachers'));
  return new Set(snap.docs.map(d => d.id));
}

export async function loadAdminUids() {
  const snap = await getDocs(collection(db, 'admins'));
  return new Set(snap.docs.map(d => d.id));
}

// ── TEAM RESEARCH DATA ────────────────────────────────────────────────────────

export async function loadResearchData() {
  const snap = await getDoc(doc(db, 'admin', 'researchData'));
  if (!snap.exists()) return {};
  const d = snap.data();
  if (d.teams && typeof d.teams === 'object') return d.teams;
  const teams = {};
  Object.entries(d).forEach(([k, v]) => {
    if (k !== 'updatedAt' && typeof v === 'object' && v !== null) teams[k] = v;
  });
  return teams;
}

export async function saveResearchData(teamsObj) {
  await setDoc(doc(db, 'admin', 'researchData'), {
    teams:     teamsObj,
    updatedAt: serverTimestamp(),
  });
}

export async function saveOneTeamResearch(teamName, cardData) {
  const snap = await getDoc(doc(db, 'admin', 'researchData'));
  const existing = snap.exists() ? (snap.data().teams || {}) : {};
  existing[teamName] = cardData;
  await setDoc(doc(db, 'admin', 'researchData'), {
    teams:     existing,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToResearchData(callback) {
  return onSnapshot(doc(db, 'admin', 'researchData'), snap => {
    if (!snap.exists()) { callback({}); return; }
    const d = snap.data();
    if (d.teams && typeof d.teams === 'object') {
      callback(d.teams);
    } else {
      // Flat format — migrate by picking only team-shaped entries
      const teams = {};
      Object.entries(d).forEach(([k, v]) => {
        if (k !== 'updatedAt' && typeof v === 'object' && v !== null) {
          teams[k] = v;
        }
      });
      callback(teams);
    }
  });
}

// ── MAMMALS TOURNAMENT ────────────────────────────────────────────────────────

export async function saveMammalBracket(uid, bracketData, displayName, photoURL) {
  await setDoc(doc(db, 'brackets_mammals', uid), {
    bracket: JSON.stringify(bracketData), displayName: displayName || 'Anonymous',
    photoURL: photoURL || null, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function loadMammalBracket(uid) {
  const snap = await getDoc(doc(db, 'brackets_mammals', uid));
  if (!snap.exists()) return null;
  const raw = snap.data().bracket;
  return raw ? JSON.parse(raw) : null;
}

export async function saveMammalOfficialBracket(bracketData) {
  await setDoc(doc(db, 'admin', 'officialBracket_mammals'), {
    bracket: JSON.stringify(bracketData), updatedAt: serverTimestamp(),
  });
}

export function subscribeToMammalOfficialBracket(callback) {
  return onSnapshot(doc(db, 'admin', 'officialBracket_mammals'), snap => {
    if (snap.exists()) callback(JSON.parse(snap.data().bracket));
  });
}

export function subscribeToMammalConfig(callback) {
  return onSnapshot(doc(db, 'tournament', 'config_mammals'), snap => {
    if (snap.exists()) callback(snap.data());
    else callback({ locked: false });
  });
}

export async function setMammalTournamentLocked(locked) {
  await setDoc(doc(db, 'tournament', 'config_mammals'), {
    locked, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function updateMammalLeaderboardEntry(uid, displayName, photoURL, score, isTeacher = false) {
  await setDoc(doc(db, 'leaderboard_mammals', uid), {
    displayName: displayName || 'Anonymous', photoURL: photoURL || null,
    score, isTeacher: !!isTeacher, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeToMammalLeaderboard(callback, n = 200) {
  const q = query(collection(db, 'leaderboard_mammals'), orderBy('score', 'desc'), limit(n));
  return onSnapshot(q, snap => {
    callback(snap.docs.map((d, i) => ({ uid: d.id, rank: i + 1, ...d.data() })));
  });
}

export async function saveMammalResearchData(teamsObj) {
  await setDoc(doc(db, 'admin', 'researchData_mammals'), {
    teams: teamsObj, updatedAt: serverTimestamp(),
  });
}

export async function saveOneMammalResearch(animalName, cardData) {
  const snap = await getDoc(doc(db, 'admin', 'researchData_mammals'));
  const existing = snap.exists() ? (snap.data().teams || {}) : {};
  existing[animalName] = cardData;
  await setDoc(doc(db, 'admin', 'researchData_mammals'), {
    teams: existing, updatedAt: serverTimestamp(),
  });
}

export function subscribeToMammalResearchData(callback) {
  return onSnapshot(doc(db, 'admin', 'researchData_mammals'), snap => {
    if (snap.exists()) callback(snap.data().teams || {});
    else callback({});
  });
}

export async function saveMammalRoster(rosterData) {
  await setDoc(doc(db, 'admin', 'mammalRoster'), {
    ...rosterData, updatedAt: serverTimestamp(),
  });
}
