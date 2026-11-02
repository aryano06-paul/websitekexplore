// PASSX — localStorage wrapper. Every access is guarded: if storage is blocked
// (private mode, disabled cookies, quota), we fall back to an in-memory copy so
// the site keeps working for the current page view.

import { EVENTS } from './data.js';

const KEYS = {
  tickets: 'px.tickets',
  seats: 'px.seats',
  newsletter: 'px.newsletter',
  theme: 'px.theme',
};

const memory = new Map();

function readRaw(key) {
  try {
    const v = window.localStorage.getItem(key);
    if (v !== null) return v;
  } catch { /* storage blocked */ }
  return memory.has(key) ? memory.get(key) : null;
}

function writeRaw(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readJSON(key, fallback) {
  const raw = readRaw(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const writeJSON = (key, value) => writeRaw(key, JSON.stringify(value));

// ---------- Theme ----------
export function getTheme() {
  const t = readRaw(KEYS.theme);
  return t === 'light' || t === 'dark' ? t : null;
}
export const setTheme = (t) => writeRaw(KEYS.theme, t);

// ---------- Seats ----------
function seatOverrides() {
  const o = readJSON(KEYS.seats, {});
  return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
}

export function seatsLeft(ev) {
  const o = seatOverrides();
  const n = Number(o[ev.id]);
  const left = Number.isFinite(n) ? n : ev.seatsLeft;
  return Math.max(0, Math.min(ev.seatsTotal, left));
}

export function adjustSeats(ev, delta) {
  const o = seatOverrides();
  o[ev.id] = Math.max(0, Math.min(ev.seatsTotal, seatsLeft(ev) + delta));
  writeJSON(KEYS.seats, o);
  return o[ev.id];
}

// ---------- Tickets ----------
function isTicket(t) {
  return t && typeof t === 'object' && typeof t.code === 'string' && typeof t.eventId === 'string';
}

export function getTickets() {
  const list = readJSON(KEYS.tickets, []);
  return Array.isArray(list) ? list.filter(isTicket) : [];
}

const saveTickets = (list) => writeJSON(KEYS.tickets, list);

export function hasTicket(email, eventId) {
  const e = String(email).trim().toLowerCase();
  return getTickets().some((t) => t.eventId === eventId && t.email === e);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomInt(max) {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % max;
  } catch {
    return Math.floor(Math.random() * max);
  }
}

export function makeCode() {
  const taken = new Set(getTickets().map((t) => t.code));
  let code;
  do {
    let mid = '';
    for (let i = 0; i < 4; i++) mid += CODE_CHARS[randomInt(CODE_CHARS.length)];
    code = `PX-${mid}-${String(randomInt(100)).padStart(2, '0')}`;
  } while (taken.has(code));
  return code;
}

/** Books tickets: saves the ticket and decrements seats. Returns the ticket. */
export function addTicket({ eventId, name, email, phone, qty }) {
  const ev = EVENTS.find((e) => e.id === eventId);
  if (!ev) throw new Error('Unknown event');
  const ticket = {
    code: makeCode(),
    eventId,
    name,
    email: email.trim().toLowerCase(),
    phone,
    qty,
    bookedAt: new Date().toISOString(),
  };
  saveTickets([...getTickets(), ticket]);
  adjustSeats(ev, -qty);
  return ticket;
}

/** Cancels a ticket and restores its seats. Returns the removed ticket + its index (for undo). */
export function removeTicket(code) {
  const list = getTickets();
  const index = list.findIndex((t) => t.code === code);
  if (index === -1) return null;
  const [ticket] = list.splice(index, 1);
  saveTickets(list);
  const ev = EVENTS.find((e) => e.id === ticket.eventId);
  if (ev && new Date(ev.date) > new Date()) adjustSeats(ev, ticket.qty);
  return { ticket, index };
}

/** Restores a cancelled ticket at its original position and takes the seats again. */
export function restoreTicket({ ticket, index }) {
  const list = getTickets();
  if (list.some((t) => t.code === ticket.code)) return;
  list.splice(Math.min(index, list.length), 0, ticket);
  saveTickets(list);
  const ev = EVENTS.find((e) => e.id === ticket.eventId);
  if (ev && new Date(ev.date) > new Date()) adjustSeats(ev, -ticket.qty);
}

// ---------- Newsletter ----------
export function getNewsletter() {
  const n = readJSON(KEYS.newsletter, null);
  return n && typeof n.email === 'string' ? n : null;
}
export const setNewsletter = (email) =>
  writeJSON(KEYS.newsletter, { email, subscribedAt: new Date().toISOString() });
