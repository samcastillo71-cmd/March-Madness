// src/firestoreService.js
// No Google authentication — identity is name-based with localStorage UUID.
// Admin access is password-based, stored in Firestore.

import {
  doc, getDoc, setDoc, deleteDoc, getDocs,
  collection, query, orderBy, limit,
  serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

// ── USER BRACKET ──────────────────────────────────────────────────────────────

export async function saveBracket(uid, bracketData, displayName) {
  await setDoc(doc(db, 'brackets', uid), {
    bracket:     JSON.stringify(bracketData),
    displayName: displayName || 'Anonymous',
    updatedAt:   serverTimestamp(),
  }, { merge: true });
}

export async function loadBracket(uid) {
  const snap = await getDoc(doc(db, 'brackets', uid));
  if (!snap.exists()) return null;
  const raw = snap.data().bracket;
  return raw ? JSON.parse(raw) : null;
}

// Find a bracket by display name (for returning users on new devices)
export async function findBracketByName(displayName) {
  if (!displayName?.trim()) return null;
  const snap = await getDocs(collection(db, 'brackets'));
  const name = displayName.trim().toLowerCase();
  const match = snap.docs.find(d => (d.data().displayName || '').toLowerCase() === name);
  if (!match) return null;
  const raw = match.data().bracket;
  return { uid: match.id, bracket: raw ? JSON.parse(raw) : null };
}

// ── OFFICIAL RESULTS BRACKET ──────────────────────────────────────────────────

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

// ── TOURNAMENT CONFIG ─────────────────────────────────────────────────────────

export function subscribeToConfig(callback) {
  return onSnapshot(doc(db, 'tournament', 'config'), snap => {
    if (snap.exists()) callback(snap.data());
    else callback({ locked: false });
  });
}

export async function setTournamentLocked(locked) {
  await setDoc(doc(db, 'tournament', 'config'), { locked, updatedAt: serverTimestamp() }, { merge: true });
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────

export async function updateLeaderboardEntry(uid, displayName, score, isTeacher = false) {
  await setDoc(doc(db, 'leaderboard', uid), {
    displayName: displayName || 'Anonymous',
    score,
    isTeacher:   !!isTeacher,
    updatedAt:   serverTimestamp(),
  }, { merge: true });
}

export function subscribeToLeaderboard(callback, n = 200) {
  const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(n));
  return onSnapshot(q, snap => {
    callback(snap.docs.map((d, i) => ({ uid: d.id, rank: i + 1, ...d.data() })));
  });
}

// ── ADMIN PASSWORD ────────────────────────────────────────────────────────────
// Password is stored as a plain string in Firestore under admin/auth.
// This is acceptable for a school hobby app — no PII is gated behind it,
// only the ability to enter results and manage the bracket.

export async function getAdminPasswordHash() {
  const snap = await getDoc(doc(db, 'admin', 'auth'));
  if (!snap.exists()) return null;
  return snap.data().password || null;
}

export async function setAdminPassword(password) {
  await setDoc(doc(db, 'admin', 'auth'), { password, updatedAt: serverTimestamp() });
}

export async function checkAdminPassword(password) {
  const snap = await getDoc(doc(db, 'admin', 'auth'));
  if (!snap.exists()) return false;
  return snap.data().password === password;
}

export async function adminExists() {
  const snap = await getDoc(doc(db, 'admin', 'auth'));
  return snap.exists() && !!snap.data().password;
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
  await setDoc(doc(db, 'admin', 'researchData'), { teams: teamsObj, updatedAt: serverTimestamp() });
}

export async function saveOneTeamResearch(teamName, cardData) {
  const snap = await getDoc(doc(db, 'admin', 'researchData'));
  const existing = snap.exists() ? (snap.data().teams || {}) : {};
  existing[teamName] = cardData;
  await setDoc(doc(db, 'admin', 'researchData'), { teams: existing, updatedAt: serverTimestamp() });
}

export function subscribeToResearchData(callback) {
  return onSnapshot(doc(db, 'admin', 'researchData'), snap => {
    if (!snap.exists()) { callback({}); return; }
    const d = snap.data();
    if (d.teams && typeof d.teams === 'object') { callback(d.teams); return; }
    const teams = {};
    Object.entries(d).forEach(([k, v]) => {
      if (k !== 'updatedAt' && typeof v === 'object' && v !== null) teams[k] = v;
    });
    callback(teams);
  });
}

// ── MAMMAL TOURNAMENT ─────────────────────────────────────────────────────────

export async function saveMammalBracket(uid, bracketData, displayName) {
  await setDoc(doc(db, 'brackets_mammals', uid), {
    bracket:     JSON.stringify(bracketData),
    displayName: displayName || 'Anonymous',
    updatedAt:   serverTimestamp(),
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
  await setDoc(doc(db, 'tournament', 'config_mammals'), { locked, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateMammalLeaderboardEntry(uid, displayName, score, isTeacher = false) {
  await setDoc(doc(db, 'leaderboard_mammals', uid), {
    displayName: displayName || 'Anonymous',
    score,
    isTeacher:   !!isTeacher,
    updatedAt:   serverTimestamp(),
  }, { merge: true });
}

export function subscribeToMammalLeaderboard(callback, n = 200) {
  const q = query(collection(db, 'leaderboard_mammals'), orderBy('score', 'desc'), limit(n));
  return onSnapshot(q, snap => {
    callback(snap.docs.map((d, i) => ({ uid: d.id, rank: i + 1, ...d.data() })));
  });
}

export async function saveMammalResearchData(teamsObj) {
  await setDoc(doc(db, 'admin', 'researchData_mammals'), { teams: teamsObj, updatedAt: serverTimestamp() });
}

export async function saveOneMammalResearch(animalName, cardData) {
  const snap = await getDoc(doc(db, 'admin', 'researchData_mammals'));
  const existing = snap.exists() ? (snap.data().teams || {}) : {};
  existing[animalName] = cardData;
  await setDoc(doc(db, 'admin', 'researchData_mammals'), { teams: existing, updatedAt: serverTimestamp() });
}

export function subscribeToMammalResearchData(callback) {
  return onSnapshot(doc(db, 'admin', 'researchData_mammals'), snap => {
    if (snap.exists()) callback(snap.data().teams || {});
    else callback({});
  });
}

export async function saveMammalRoster(rosterData) {
  await setDoc(doc(db, 'admin', 'mammalRoster'), { ...rosterData, updatedAt: serverTimestamp() });
}

// ── LEADERBOARD ADMIN HELPERS ─────────────────────────────────────────────────

export async function getAllBracketUids(isMammal = false) {
  const snap = await getDocs(collection(db, isMammal ? 'brackets_mammals' : 'brackets'));
  return snap.docs.map(d => ({ uid: d.id, displayName: d.data().displayName }));
}

export async function deleteBracketAndScore(uid, isMammal = false) {
  await Promise.all([
    deleteDoc(doc(db, isMammal ? 'brackets_mammals' : 'brackets', uid)).catch(() => {}),
    deleteDoc(doc(db, isMammal ? 'leaderboard_mammals' : 'leaderboard', uid)).catch(() => {}),
  ]);
}
