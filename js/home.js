// PASSX — homepage entry.
import { SPONSORS, SPEAKERS, CATEGORIES, CITIES } from './data.js';
import {
  $, initShell, mountCountdown, nextEvent, upcomingEvents, qrSVG, speakerCard, dateChip, ticket3D, measureCtas,
} from './ui.js';
import { initMotion, reveal, parallax, ticket3d, reduced } from './motion.js';
import { initBrowser } from './browse.js';

function renderSponsors() {
  const host = $('[data-sponsors]');
  if (host) host.innerHTML = SPONSORS.map((s) => s.svg).join('');
}

function renderNext() {
  const ev = nextEvent();
  const name = $('[data-next-name]');
  const cta = $('[data-next-cta]');
  const qr = $('[data-next-qr]');
  const link = $('[data-next-link]');
  const count = $('[data-next-countdown]');

  if (!ev) {
    name.textContent = 'New dates dropping soon';
    count.innerHTML = '<p class="countdown--ended">Stay tuned.</p>';
    qr.innerHTML = qrSVG('PASSX');
    return;
  }
  const href = `event.html?id=${encodeURIComponent(ev.id)}`;
  name.textContent = `${ev.title} · ${dateChip(ev.date)}`;
  count.setAttribute('aria-label', `Countdown to ${ev.title}`);
  mountCountdown(count, ev.date, { endedText: 'Doors are open!', onEnd: () => setTimeout(renderNext, 1500) });
  qr.innerHTML = qrSVG(`PASSX:${ev.id}`);
  link.href = href;
  link.setAttribute('aria-label', `Get yours — open ${ev.title}`);
  cta.href = `${href}&book=1`;
  $('.cta__pill', cta).textContent = `Book Your Seat for ${ev.title}`;
  measureCtas(cta.parentElement);
}

function renderStats() {
  const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = String(v).padStart(2, '0'); };
  set('events', upcomingEvents().length);
  set('cities', CITIES.length);
  set('cats', CATEGORIES.length);
}

function renderTicket() {
  const host = $('[data-ticket-host]');
  if (host) host.innerHTML = ticket3D();
}

function renderSpeakers() {
  const track = $('[data-speakers]');
  if (!track) return;
  track.innerHTML = SPEAKERS.map((s) => speakerCard(s)).join('');
  track.setAttribute('data-reveal-group', '');
}

/** Draggable scroll-snap carousel with prev/next + arrow keys. */
function initCarousel() {
  const track = $('[data-speakers]');
  if (!track) return;
  const step = () => {
    const card = track.querySelector('.speaker');
    return card ? card.getBoundingClientRect().width + 20 : 300;
  };
  const go = (dir) => track.scrollBy({ left: dir * step(), behavior: reduced ? 'auto' : 'smooth' });

  $('[data-sp-prev]').addEventListener('click', () => go(-1));
  $('[data-sp-next]').addEventListener('click', () => go(1));
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  track.addEventListener('dragstart', (e) => e.preventDefault());

  let down = false; let moved = false; let startX = 0; let startLeft = 0;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
  });
  window.addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) { moved = true; track.classList.add('is-dragging'); }
    if (moved) track.scrollLeft = startLeft - dx;
  }, { passive: true });
  const end = () => {
    if (!down) return;
    down = false;
    if (!moved) return;
    // Re-enabling scroll-snap lets the browser settle onto the nearest card.
    const left = track.scrollLeft;
    track.classList.remove('is-dragging');
    const s = step();
    track.scrollLeft = left;
    track.scrollTo({ left: Math.round(left / s) * s, behavior: reduced ? 'auto' : 'smooth' });
  };
  window.addEventListener('pointerup', end, { passive: true });
  window.addEventListener('pointercancel', end, { passive: true });
}

initShell();
renderSponsors();
renderNext();
renderStats();
renderTicket();
renderSpeakers();
initBrowser();
initCarousel();
initMotion();
reveal();
parallax();
ticket3d($('[data-ticket-host] .ticket3d'));

