// PASSX — shared UI: helpers, icons, templates, shell (nav/menu/theme/footer),
// toasts, modals, countdowns and the deterministic QR generator.

import { EVENTS, getSpeaker } from './data.js';
import * as store from './store.js';
import { gsap, canAnimate, reduced, lockScroll, unlockScroll } from './motion.js';

export const $ = (sel, scope = document) => scope.querySelector(sel);
export const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

/** Escape any text before it goes into HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/* ------------------------------------------------------------------ */
/* Icons — inline SVG, stroke 2, round caps                            */
/* ------------------------------------------------------------------ */
const P = {
  arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  arrowDownLeft: '<path d="M17 7 7 17"/><path d="M16 17H7V8"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  ticket: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/><path d="M15 5v2"/><path d="M15 11v2"/><path d="M15 17v2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 9h16"/><path d="M4 15h16"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2"/><path d="M3 10h18"/>',
  camera: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  play: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  briefcase: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 11v5"/><path d="M8 8v.01"/><path d="M12 16v-5"/><path d="M16 16v-3a2 2 0 0 0-4 0"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
};

export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Formatting (always IST, so dates read the same everywhere)          */
/* ------------------------------------------------------------------ */
const TZ = 'Asia/Kolkata';
const fmtDay = new Intl.DateTimeFormat('en-IN', { day: '2-digit', timeZone: TZ });
const fmtMon = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: TZ });
const fmtLong = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
const fmtTime = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });

export const dateChip = (iso) => `${fmtDay.format(new Date(iso))} ${fmtMon.format(new Date(iso)).slice(0, 3).toUpperCase()}`;
export const longDate = (iso) => fmtLong.format(new Date(iso)).replace(/,/g, '').toUpperCase();
export const timeOf = (iso) => fmtTime.format(new Date(iso));
export const timeRange = (ev) => `${timeOf(ev.date)} – ${ev.endTime}`;
export const price = (p) => (p === 0 ? 'Free' : `₹${p.toLocaleString('en-IN')}`);
export const pad = (n) => String(n).padStart(2, '0');

export const isPast = (ev) => new Date(ev.date).getTime() <= Date.now();
export const upcomingEvents = () => EVENTS.filter((e) => !isPast(e)).sort((a, b) => new Date(a.date) - new Date(b.date));
export const nextEvent = () => upcomingEvents()[0] || null;

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */
export function imgTag({ src, alt, w = 900, h = 675, cls = 'photo', label = 'PASSX', eager = false, attrs = '' }) {
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" width="${w}" height="${h}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-label="${esc(label)}" ${attrs}>`;
}

export function eventCard(ev) {
  const past = isPast(ev);
  const left = store.seatsLeft(ev);
  const seatsNote = past ? 'Closed' : left === 0 ? 'Sold out' : `${left} seats left`;
  return `
  <article class="ecard${past ? ' ecard--past' : ''}" data-id="${esc(ev.id)}" data-flip-id="${esc(ev.id)}">
    <a class="ecard__link photo-hover" href="event.html?id=${encodeURIComponent(ev.id)}" data-cursor="view">
      <div class="ecard__media">
        ${imgTag({ src: ev.image, alt: `${ev.title} — ${ev.category} event in ${ev.city}`, label: ev.category })}
        <span class="chip chip--cat">${esc(ev.category)}</span>
        <span class="chip chip--date">${esc(dateChip(ev.date))}</span>
      </div>
      <div class="ecard__body">
        <h3 class="ecard__title">${esc(ev.title)}</h3>
        <p class="ecard__venue">${esc(ev.venue)} · ${esc(ev.city)}</p>
        <p class="ecard__desc">${esc(ev.short)}</p>
        <div class="ecard__foot">
          <span class="ecard__price">${esc(price(ev.price))}<span class="ecard__seats">${esc(seatsNote)}</span></span>
          <span class="arrow-circle" aria-hidden="true">${icon('arrowUpRight')}</span>
        </div>
      </div>
    </a>
    ${past ? '<span class="stamp" aria-hidden="true">Closed</span>' : ''}
  </article>`;
}

export function speakerCard(sp, cls = 'speaker') {
  return `
  <article class="${cls}">
    <div class="speaker__photo">${imgTag({ src: sp.photo, alt: `Portrait of ${sp.name}`, w: 600, h: 800, label: sp.name })}</div>
    <h3 class="speaker__name">${esc(sp.name)}</h3>
    <p class="speaker__role">${esc(sp.role)}</p>
  </article>`;
}

/** The lime ticket SVG (notched sides + perforation). `back` renders the darker shadow copy. */
export function ticketSVG({ word = 'TICKET', back = false } = {}) {
  const outline = 'M24 0H358A22 22 0 0 0 402 0H496A24 24 0 0 1 520 24V98A22 22 0 0 0 520 142V216A24 24 0 0 1 496 240H402A22 22 0 0 0 358 240H24A24 24 0 0 1 0 216V142A22 22 0 0 0 0 98V24A24 24 0 0 1 24 0Z';
  if (back) {
    return `<svg viewBox="-2 -2 524 244" aria-hidden="true" focusable="false"><path d="${outline}" fill="currentColor"/></svg>`;
  }
  let dots = '';
  for (let y = 34; y <= 206; y += 17.2) dots += `<circle cx="380" cy="${y.toFixed(1)}" r="3.6"/>`;
  return `<svg viewBox="-2 -2 524 244" aria-hidden="true" focusable="false">
    <path class="ticket-svg__body" d="${outline}"/>
    <g class="ticket-svg__ink">
      <text class="ticket-svg__small" x="34" y="50" font-size="15">PASSX · ADMIT ONE</text>
      <text class="ticket-svg__word" x="190" y="160" font-size="84" text-anchor="middle" textLength="300" lengthAdjust="spacingAndGlyphs">${esc(word)}</text>
      <text class="ticket-svg__small" x="34" y="208" font-size="13">SEAT · ROW · GATE</text>
      ${dots}
      <text class="ticket-svg__small" x="452" y="120" font-size="15" text-anchor="middle" transform="rotate(90 452 120)">NO. 0042</text>
    </g>
  </svg>`;
}

export function ticket3D({ cls = '', word = 'TICKET' } = {}) {
  return `
  <div class="ticket3d ${cls}" aria-hidden="true">
    <div class="ticket3d__tilt"><div class="ticket3d__bob"><div class="ticket3d__stack">
      <div class="ticket3d__back">${ticketSVG({ back: true })}</div>
      <div class="ticket3d__front">${ticketSVG({ word })}</div>
    </div></div></div>
  </div>`;
}

/** Small lime ticket used in empty states. */
export function miniTicketSVG() {
  return `<svg class="empty__ticket" viewBox="0 0 24 24" fill="currentColor" stroke="var(--lime-border)" stroke-width="0.6" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/><path d="M15 6.5v1.6M15 11.2v1.6M15 15.9v1.6" stroke="#1C1B33" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

/** Lime ticket card used for booking success and in the wallet. */
export function ticketCard(ticket, ev) {
  const speakers = ev.speakers.map(getSpeaker).filter(Boolean).map((s) => s.name).join(', ');
  return `
  <div class="ticket">
    <span class="ticket__notch ticket__side ticket__side--l" aria-hidden="true"></span>
    <div class="ticket__main">
      <div class="ticket__brand"><span>PASSX · ${esc(ev.category)}</span><span>${esc(ev.city)}</span></div>
      <h3 class="ticket__title">${esc(ev.title)}</h3>
      <dl class="ticket__meta">
        <div><dt>Attendee</dt><dd>${esc(ticket.name)}</dd></div>
        <div><dt>Tickets</dt><dd>${esc(ticket.qty)} × ${ev.price === 0 ? 'Free entry' : 'Admit one'}</dd></div>
        <div><dt>Date</dt><dd>${esc(longDate(ev.date))}</dd></div>
        <div><dt>Time</dt><dd>${esc(timeRange(ev))}</dd></div>
        <div style="grid-column:1/-1"><dt>Venue</dt><dd>${esc(ev.venue)}, ${esc(ev.city)}</dd></div>
        ${speakers ? `<div style="grid-column:1/-1"><dt>With</dt><dd>${esc(speakers)}</dd></div>` : ''}
      </dl>
    </div>
    <div class="ticket__stub">
      <span class="ticket__notch ticket__notch--a" aria-hidden="true"></span>
      <span class="ticket__notch ticket__notch--b" aria-hidden="true"></span>
      <div class="qr">${qrSVG(ticket.code)}</div>
      <span class="ticket__code">${esc(ticket.code)}</span>
      <span class="ticket__count">Admit ${esc(ticket.qty)}</span>
    </div>
    <span class="ticket__notch ticket__side ticket__side--r" aria-hidden="true"></span>
  </div>`;
}

export function ctaHTML({ label, href, tag = 'a', attrs = '', cls = '' }) {
  const inner = `<span class="cta__pill">${esc(label)}</span><span class="cta__circle" aria-hidden="true">${icon('arrowUpRight')}<span class="cta__spinner"></span></span>`;
  return tag === 'a'
    ? `<a class="cta ${cls}" href="${esc(href)}" data-cursor="book" ${attrs}>${inner}</a>`
    : `<button class="cta ${cls}" data-cursor="book" ${attrs}>${inner}</button>`;
}

/* ------------------------------------------------------------------ */
/* Deterministic QR-style SVG                                          */
/* ------------------------------------------------------------------ */
export function qrSVG(text) {
  const N = 25;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let a = h;
  const rnd = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const dark = Array.from({ length: N }, () => new Array(N).fill(false));
  const fixed = Array.from({ length: N }, () => new Array(N).fill(false));

  const square = (ox, oy, size, ring) => {
    for (let y = -1; y <= size; y++) {
      for (let x = -1; x <= size; x++) {
        const X = ox + x; const Y = oy + y;
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        fixed[Y][X] = true;
        const inside = x >= 0 && y >= 0 && x < size && y < size;
        const edge = inside && (x === 0 || y === 0 || x === size - 1 || y === size - 1);
        const core = x >= ring && y >= ring && x < size - ring && y < size - ring;
        dark[Y][X] = edge || core;
      }
    }
  };
  square(0, 0, 7, 2);
  square(N - 7, 0, 7, 2);
  square(0, N - 7, 7, 2);
  square(N - 9, N - 9, 5, 2);
  for (let i = 8; i < N - 8; i++) {
    dark[6][i] = i % 2 === 0; fixed[6][i] = true;
    dark[i][6] = i % 2 === 0; fixed[i][6] = true;
  }
  let d = '';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!fixed[y][x]) dark[y][x] = rnd() > 0.52;
      if (dark[y][x]) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return `<svg viewBox="-1 -1 ${N + 2} ${N + 2}" shape-rendering="crispEdges" role="img" aria-label="QR code ${esc(text)}"><rect x="-1" y="-1" width="${N + 2}" height="${N + 2}" fill="#fff"/><path d="${d}" fill="#1C1B33"/></svg>`;
}

/* ------------------------------------------------------------------ */
/* Countdowns — one shared 1s ticker                                   */
/* ------------------------------------------------------------------ */
const tickers = new Set();
let tickTimer = null;
export function onTick(fn) {
  tickers.add(fn);
  if (!tickTimer) tickTimer = setInterval(() => tickers.forEach((f) => f()), 1000);
  return () => {
    tickers.delete(fn);
    if (!tickers.size) { clearInterval(tickTimer); tickTimer = null; }
  };
}

export function splitTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Renders DAYS | HOURS | MINUTE | SECOND blocks (DAYS only when > 24h). */
export function mountCountdown(el, iso, { endedText = 'This show has ended.', onEnd } = {}) {
  const target = new Date(iso).getTime();
  let shape = '';
  let stop = () => {};
  const render = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      el.innerHTML = `<p class="countdown--ended">${esc(endedText)}</p>`;
      el.removeAttribute('role');
      stop();
      if (onEnd) onEnd();
      return;
    }
    const t = splitTime(diff);
    const parts = t.d > 0
      ? [['d', t.d, 'Days'], ['h', t.h, 'Hours'], ['m', t.m, 'Minute'], ['s', t.s, 'Second']]
      : [['h', t.h, 'Hours'], ['m', t.m, 'Minute'], ['s', t.s, 'Second']];
    const nextShape = parts.map((p) => p[0]).join('');
    if (nextShape !== shape) {
      shape = nextShape;
      el.classList.add('countdown');
      el.innerHTML = parts.map(([k, , label]) => `<div class="countdown__block"><span class="countdown__num" data-k="${k}">00</span><span class="countdown__label">${label}</span></div>`).join('');
    }
    parts.forEach(([k, v]) => {
      const n = el.querySelector(`[data-k="${k}"]`);
      const txt = pad(v);
      if (n.textContent !== txt) n.textContent = txt;
    });
  };
  render();
  if (target > Date.now()) stop = onTick(render);
  return () => stop();
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */
function toastRegion() {
  let region = $('.toasts');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toasts';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  return region;
}

export function toast(message, { actionLabel, onAction, duration = 4200 } = {}) {
  const region = toastRegion();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast__msg">${esc(message)}</span>${actionLabel ? `<button type="button" class="toast__action">${esc(actionLabel)}</button>` : ''}<button type="button" class="icon-btn icon-btn--plain toast__close" aria-label="Dismiss notification">${icon('close')}</button>`;
  region.append(el);
  if (canAnimate) gsap.from(el, { y: 40, opacity: 0, duration: 0.45, ease: 'power3.out' });

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    if (!el.isConnected) return;
    if (canAnimate) gsap.to(el, { y: 20, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: () => el.remove() });
    else el.remove();
  };
  timer = setTimeout(dismiss, duration);
  el.querySelector('.toast__close').addEventListener('click', dismiss);
  if (actionLabel) {
    el.querySelector('.toast__action').addEventListener('click', () => {
      dismiss();
      if (onAction) onAction();
    });
  }
  return { dismiss, el };
}

/* ------------------------------------------------------------------ */
/* Focus trap                                                          */
/* ------------------------------------------------------------------ */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function focusables(container) {
  return $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null || el === document.activeElement);
}
export function trapTab(e, container) {
  if (e.key !== 'Tab') return;
  const items = focusables(container);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
    e.preventDefault(); first.focus();
  }
}

/* ------------------------------------------------------------------ */
/* Legal / info modals (native <dialog>)                               */
/* ------------------------------------------------------------------ */
const MODALS = {
  terms: {
    title: 'Terms',
    body: `<p>PASSX is a student project built for K Explore. Bookings are stored only in your browser and are not real tickets.</p>
      <h3>Bookings</h3><p>You can hold up to four tickets per event per email address. Cancelled tickets release their seats straight away.</p>
      <h3>Changes</h3><p>Organisers may update line-ups or timings. We’ll show any change on the event page.</p>
      <h3>Conduct</h3><p>Everyone attending agrees to the PASSX code of conduct.</p>`,
  },
  privacy: {
    title: 'Privacy',
    body: `<p>We don’t run a server. Your name, email, phone number and tickets stay in this browser’s localStorage and never leave your device.</p>
      <h3>What we store</h3><p>Your tickets, seat counts, theme preference and newsletter email.</p>
      <h3>Removing data</h3><p>Cancel your tickets in the wallet, or clear this site’s data in your browser settings.</p>`,
  },
  conduct: {
    title: 'Code of conduct',
    body: `<p>PASSX events are for everyone. We expect every attendee, speaker and volunteer to:</p>
      <h3>Be kind</h3><p>No harassment, discrimination or intimidation of any kind.</p>
      <h3>Respect space</h3><p>Ask before photographing people, and follow venue safety staff.</p>
      <h3>Speak up</h3><p>If something feels wrong, find anyone in a lime PASSX lanyard. We will act on it.</p>`,
  },
};

export function openModal(kind, trigger) {
  const data = MODALS[kind];
  if (!data) return;
  let dlg = $('#px-modal');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'px-modal';
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', 'px-modal-title');
    dlg.setAttribute('data-lenis-prevent', '');
    document.body.append(dlg);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => {
      unlockScroll();
      const back = dlg._trigger;
      dlg._trigger = null;
      if (back && back.isConnected) back.focus();
    });
  }
  dlg.innerHTML = `<div class="modal__inner">
    <div class="modal__head"><h2 class="h-display modal__title" id="px-modal-title">${esc(data.title)}</h2>
    <button type="button" class="icon-btn icon-btn--ghost" data-modal-close aria-label="Close dialog">${icon('close')}</button></div>
    <div class="modal__body">${data.body}</div></div>`;
  dlg.querySelector('[data-modal-close]').addEventListener('click', () => dlg.close());
  dlg._trigger = trigger || document.activeElement;
  if (typeof dlg.showModal === 'function') {
    lockScroll();
    dlg.showModal();
    if (canAnimate) gsap.from(dlg, { y: 30, opacity: 0, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity' });
  }
}

/* ------------------------------------------------------------------ */
/* Shell: theme, nav, menu, newsletter, legal links, CTA measuring     */
/* ------------------------------------------------------------------ */
function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function syncThemeToggles() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  $$('.theme-toggle').forEach((b) => {
    b.setAttribute('aria-label', `Switch to ${next} theme`);
    b.setAttribute('aria-pressed', String(currentTheme() === 'light'));
  });
}

function applyTheme(next, origin) {
  const rootEl = document.documentElement;
  const set = () => {
    rootEl.dataset.theme = next;
    store.setTheme(next);
    syncThemeToggles();
  };

  if (typeof document.startViewTransition === 'function' && !reduced) {
    rootEl.classList.add('vt-theme');
    const t = document.startViewTransition(set);
    t.ready.then(() => {
      const { x, y } = origin;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      rootEl.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    t.finished.finally(() => rootEl.classList.remove('vt-theme'));
  } else {
    rootEl.classList.add('theme-fading');
    set();
    setTimeout(() => rootEl.classList.remove('theme-fading'), 400);
  }
}

function initTheme() {
  syncThemeToggles();
  $$('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.getBoundingClientRect();
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    });
  });
}

function initMenu() {
  const btn = $('.menu-btn');
  const menu = $('#menu');
  if (!btn || !menu) return;
  const links = $$('.menu__link span', menu);
  let open = false;

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    else trapTab(e, menu);
  };

  function show() {
    if (open) return;
    open = true;
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    lockScroll();
    document.addEventListener('keydown', onKey);
    if (canAnimate) {
      gsap.fromTo(menu, { yPercent: -100 }, { yPercent: 0, duration: 0.55, ease: 'power3.out' });
      gsap.fromTo(links, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'power4.out', stagger: 0.07, delay: 0.15 });
    }
    $('.menu__close', menu).focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKey);
    const done = () => {
      menu.hidden = true;
      unlockScroll();
      if (restoreFocus) btn.focus();
    };
    if (canAnimate) gsap.to(menu, { yPercent: -100, duration: 0.45, ease: 'power3.in', onComplete: done });
    else done();
  }

  btn.addEventListener('click', show);
  $('.menu__close', menu).addEventListener('click', () => close());
  // Navigating from the menu: close first so Lenis is unlocked before scrolling.
  $$('a', menu).forEach((a) => a.addEventListener('click', () => close({ restoreFocus: false })));
  matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) close({ restoreFocus: false }); });
}

function initNewsletter() {
  const form = $('#newsletter');
  if (!form) return;
  const input = $('input', form);
  const msg = $('.newsletter__msg', form);
  const existing = store.getNewsletter();
  if (existing) {
    msg.textContent = `You’re on the list as ${existing.email}.`;
    msg.className = 'newsletter__msg is-ok';
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = input.value.trim().toLowerCase();
    const ok = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(email);
    if (!ok) {
      msg.textContent = email ? 'That email doesn’t look right. Try name@example.com.' : 'Enter your email to subscribe.';
      msg.className = 'newsletter__msg is-error';
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    store.setNewsletter(email);
    input.removeAttribute('aria-invalid');
    input.value = '';
    msg.textContent = `You’re in! Drops land in ${email} first.`;
    msg.className = 'newsletter__msg is-ok';
  });
}

/** CTA hover: the pill grows exactly 4px. scaleX factor is measured per element. */
function initCtas(scope = document) {
  const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => {
    entries.forEach((en) => {
      const wdt = en.contentRect.width;
      if (wdt > 0) en.target.closest('.cta').style.setProperty('--grow', ((wdt + 4) / wdt).toFixed(4));
    });
  }) : null;
  $$('.cta', scope).forEach((c) => {
    if (!c.hasAttribute('data-cursor')) c.setAttribute('data-cursor', 'book');
    const pill = $('.cta__pill', c);
    if (ro && pill && !c.dataset.measured) { c.dataset.measured = '1'; ro.observe(pill); }
  });
}
export const measureCtas = initCtas;

export function updateWalletCount() {
  const n = store.getTickets().filter((t) => {
    const ev = EVENTS.find((e) => e.id === t.eventId);
    return ev && !isPast(ev);
  }).length;
  $$('[data-wallet-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
  $$('.wallet-link').forEach((a) => a.setAttribute('aria-label', n ? `My tickets (${n} upcoming)` : 'My tickets'));
}

export function initShell() {
  toastRegion();
  initTheme();
  initMenu();
  initNewsletter();
  initCtas();
  updateWalletCount();
  $$('[data-modal]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.modal, b)));
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
}
