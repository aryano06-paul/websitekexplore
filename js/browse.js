// PASSX — event browser: search (debounced), multi-category filter, city filter,
// sort, "upcoming only", URL sync and GSAP Flip transitions between states.
import { EVENTS, CATEGORIES, CITIES } from './data.js';
import { $, $$, esc, eventCard, isPast, pad, miniTicketSVG } from './ui.js';
import * as store from './store.js';
import {
  gsap, Flip, canAnimate, settleGroup, refresh, scrollToTarget,
} from './motion.js';

const SORTS = ['soonest', 'price', 'seats'];
const state = { q: '', cats: new Set(), city: '', sort: 'soonest', upcoming: false };

let grid; let input; let sortSel; let upSwitch; let countEl; let emptyEl;
let catHost; let cityHost; let cityRow; let cityToggle;
const cardById = new Map();
let settled = false;

/* ---------------- URL <-> state ---------------- */
function readURL() {
  const p = new URLSearchParams(location.search);
  state.q = (p.get('q') || '').slice(0, 80);
  const cats = (p.get('cat') || '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
  state.cats = new Set(CATEGORIES.filter((c) => cats.includes(c.toLowerCase())));
  const city = (p.get('city') || '').toLowerCase();
  state.city = CITIES.find((c) => c.toLowerCase() === city) || '';
  state.sort = SORTS.includes(p.get('sort')) ? p.get('sort') : 'soonest';
  state.upcoming = p.get('upcoming') === '1';
}

function writeURL() {
  const p = new URLSearchParams(location.search);
  ['q', 'cat', 'city', 'sort', 'upcoming'].forEach((k) => p.delete(k));
  if (state.q.trim()) p.set('q', state.q.trim());
  if (state.cats.size) p.set('cat', [...state.cats].join(','));
  if (state.city) p.set('city', state.city);
  if (state.sort !== 'soonest') p.set('sort', state.sort);
  if (state.upcoming) p.set('upcoming', '1');
  const qs = p.toString().replace(/%2C/g, ',');
  history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
}

/* ---------------- Filtering + sorting ---------------- */
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function results() {
  const terms = norm(state.q.trim()).split(/\s+/).filter(Boolean);
  const list = EVENTS.filter((ev) => {
    if (state.cats.size && !state.cats.has(ev.category)) return false;
    if (state.city && ev.city !== state.city) return false;
    if (state.upcoming && isPast(ev)) return false;
    if (terms.length) {
      const hay = norm(`${ev.title} ${ev.category} ${ev.venue} ${ev.city} ${ev.short}`);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  const time = (ev) => new Date(ev.date).getTime();
  const cmp = {
    soonest: (a, b) => time(a) - time(b),
    price: (a, b) => a.price - b.price || time(a) - time(b),
    seats: (a, b) => store.seatsLeft(a) - store.seatsLeft(b) || time(a) - time(b),
  }[state.sort];

  const upcoming = list.filter((e) => !isPast(e)).sort(cmp);
  const past = list.filter(isPast).sort((a, b) => time(b) - time(a));
  return [...upcoming, ...past];
}

/* ---------------- Rendering ---------------- */
function pillHTML(label, pressed, attrs) {
  return `<button type="button" class="pill" aria-pressed="${pressed}" ${attrs}>${esc(label)}</button>`;
}

function renderPills() {
  catHost.innerHTML = pillHTML('All', state.cats.size === 0, 'data-cat=""')
    + CATEGORIES.map((c) => pillHTML(c, state.cats.has(c), `data-cat="${esc(c)}"`)).join('');
  cityHost.innerHTML = pillHTML('All cities', !state.city, 'data-city=""')
    + CITIES.map((c) => pillHTML(c, state.city === c, `data-city="${esc(c)}"`)).join('');
}

function syncControls() {
  if (input.value !== state.q) input.value = state.q;
  sortSel.value = state.sort;
  upSwitch.checked = state.upcoming;
  $$('[data-cat]', catHost).forEach((b) => {
    const c = b.dataset.cat;
    b.setAttribute('aria-pressed', String(c ? state.cats.has(c) : state.cats.size === 0));
  });
  $$('[data-city]', cityHost).forEach((b) => {
    b.setAttribute('aria-pressed', String((b.dataset.city || '') === state.city));
  });
}

function buildGrid() {
  grid.innerHTML = EVENTS.map(eventCard).join('');
  $$('.ecard', grid).forEach((el) => cardById.set(el.dataset.id, el));
  emptyEl = document.createElement('div');
  emptyEl.className = 'empty';
  emptyEl.hidden = true;
  emptyEl.innerHTML = `${miniTicketSVG()}
    <h3 class="h-display empty__title">Nothing on the bill</h3>
    <p>No events match those filters. Try a different search or clear everything.</p>
    <button type="button" class="pill" aria-pressed="true" data-clear>Clear filters</button>`;
  grid.append(emptyEl);
  $('[data-clear]', emptyEl).addEventListener('click', clearAll);
}

function apply({ animate = true } = {}) {
  const list = results();
  const ids = new Set(list.map((e) => e.id));
  const cards = [...cardById.values()];
  const useFlip = animate && canAnimate && Flip;

  if (useFlip && !settled) { settleGroup(grid); settled = true; }
  const flipState = useFlip ? Flip.getState(cards) : null;

  cards.forEach((c) => { c.style.display = ids.has(c.dataset.id) ? '' : 'none'; });
  list.forEach((ev) => grid.append(cardById.get(ev.id)));
  grid.append(emptyEl);
  emptyEl.hidden = list.length > 0;

  const n = list.length;
  countEl.textContent = `${pad(n)} ${n === 1 ? 'event' : 'events'}`;
  syncControls();
  writeURL();

  if (flipState) {
    Flip.from(flipState, {
      duration: 0.6,
      ease: 'power3.inOut',
      absolute: true,
      stagger: 0.02,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.5, delay: 0.1, ease: 'power3.out' }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.3, ease: 'power2.in' }),
      onComplete: refresh,
    });
    if (!emptyEl.hidden) gsap.fromTo(emptyEl, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'transform,opacity' });
  } else {
    refresh();
  }
}

function clearAll() {
  state.q = '';
  state.cats.clear();
  state.city = '';
  state.upcoming = false;
  state.sort = 'soonest';
  apply();
  input.focus();
}

/* ---------------- Wiring ---------------- */
function toggleCities(force) {
  const open = force ?? cityRow.hidden;
  cityRow.hidden = !open;
  cityToggle.setAttribute('aria-expanded', String(open));
  const plus = cityToggle.querySelector('svg');
  if (plus) plus.style.transform = open ? 'rotate(45deg)' : '';
  if (open && canAnimate) gsap.fromTo(cityRow, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' });
  refresh();
}

const isTyping = (el) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export function initBrowser() {
  grid = $('#event-grid');
  if (!grid) return;
  input = $('#q');
  sortSel = $('#sort');
  upSwitch = $('#upcoming');
  countEl = $('[data-count]');
  catHost = $('[data-cat-pills]');
  cityHost = $('[data-city-pills]');
  cityRow = $('#cities');
  cityToggle = $('[data-city-toggle]');

  readURL();
  renderPills();
  buildGrid();
  apply({ animate: false });
  if (state.city) toggleCities(true);

  let t = null;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = input.value; apply(); }, 200);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) { input.value = ''; state.q = ''; apply(); }
  });
  sortSel.addEventListener('change', () => { state.sort = sortSel.value; apply(); });
  upSwitch.addEventListener('change', () => { state.upcoming = upSwitch.checked; apply(); });

  catHost.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const c = b.dataset.cat;
    if (!c) state.cats.clear();
    else if (state.cats.has(c)) state.cats.delete(c);
    else state.cats.add(c);
    apply();
  });
  cityHost.addEventListener('click', (e) => {
    const b = e.target.closest('[data-city]');
    if (!b) return;
    state.city = b.dataset.city || '';
    apply();
  });
  cityToggle.addEventListener('click', () => toggleCities());

  const toolbar = $('#schedule');
  $('[data-focus-search]').addEventListener('click', () => {
    scrollToTarget(toolbar);
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (document.querySelector('dialog[open], .drawer:not([hidden]), #menu:not([hidden])')) return;
    e.preventDefault();
    scrollToTarget(toolbar);
    input.focus({ preventScroll: true });
  });
}
