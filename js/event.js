// PASSX — event detail page (event.html?id=...).
import { EVENTS, getEvent, getSpeaker } from './data.js';
import {
  $, esc, icon, imgTag, longDate, timeRange, price, isPast, mountCountdown, eventCard, speakerCard,
  ticket3D, initShell, measureCtas, ctaHTML, pad, updateWalletCount,
} from './ui.js';
import * as store from './store.js';
import {
  initMotion, reveal, colorOnScroll, ticket3d, canAnimate,
} from './motion.js';
import { initBooking } from './form.js';

const main = $('#main');
const params = new URLSearchParams(location.search);
const ev = getEvent(params.get('id') || '');

function setMeta(title, description) {
  document.title = title;
  const set = (sel, attr, val) => { const el = $(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', description);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', description);
}

/* ---------------- Invalid id ---------------- */
function renderGate() {
  setMeta('Wrong gate — PASSX', 'This event could not be found on PASSX.');
  main.innerHTML = `
  <section class="container gate" aria-labelledby="gate-title">
    ${ticket3D({ cls: 'ticket3d--sm', word: '404' })}
    <p class="label label--accent" data-intro>Error 404 · Event not found</p>
    <h1 class="h-display h-hero" id="gate-title" data-intro>Wrong gate</h1>
    <p data-intro>We couldn’t find that event. The link may be broken, or the show has moved. Everything that’s on is one tap away.</p>
    <div data-intro>${ctaHTML({ label: 'Back to all events', href: 'index.html#events' })}</div>
  </section>`;
}

/* ---------------- Box office ---------------- */
function boxOfficeHTML() {
  const left = store.seatsLeft(ev);
  const past = isPast(ev);
  const soldOut = !past && left === 0;
  let action;
  if (past) action = ctaHTML({ label: 'Sales closed', tag: 'button', attrs: 'type="button" disabled', cls: 'cta--block' });
  else if (soldOut) action = ctaHTML({ label: 'Sold out', tag: 'button', attrs: 'type="button" disabled', cls: 'cta--block' });
  else action = ctaHTML({ label: 'Get Ticket', tag: 'button', attrs: 'type="button" data-open-booking aria-haspopup="dialog" aria-controls="booking"', cls: 'cta--block' });

  return `
    <h2 class="label label--accent" id="bo-title">Box office</h2>
    <p class="box-office__price">${esc(price(ev.price))}</p>
    <dl class="box-office__rows">
      <div><dt>Date</dt><dd>${esc(longDate(ev.date))}</dd></div>
      <div><dt>Time</dt><dd>${esc(timeRange(ev))}</dd></div>
      <div><dt>Venue</dt><dd>${esc(ev.venue)}, ${esc(ev.city)}</dd></div>
    </dl>
    <div class="seats">
      <div class="seats__track" role="meter" aria-label="Seats left" aria-valuemin="0" aria-valuemax="${ev.seatsTotal}" aria-valuenow="${left}" aria-valuetext="${left} of ${ev.seatsTotal} seats left">
        <div class="seats__fill" data-seats-fill></div>
      </div>
      <p class="seats__text"><strong data-seats-left>${pad(left)}</strong> / ${ev.seatsTotal} seats left</p>
    </div>
    ${action}
    <p class="box-office__note">${past ? 'This event has already happened.' : 'Up to 4 tickets per booking · Instant QR ticket'}</p>`;
}

function updateSeats() {
  const left = store.seatsLeft(ev);
  const fill = $('[data-seats-fill]');
  const meter = $('.seats__track');
  const label = $('[data-seats-left]');
  if (fill) fill.style.setProperty('--p', (left / ev.seatsTotal).toFixed(4));
  if (label) label.textContent = pad(left);
  if (meter) {
    meter.setAttribute('aria-valuenow', String(left));
    meter.setAttribute('aria-valuetext', `${left} of ${ev.seatsTotal} seats left`);
  }
}

function renderBoxOffice() {
  const box = $('.box-office');
  box.innerHTML = boxOfficeHTML();
  measureCtas(box);
  updateSeats();
}

/* ---------------- Event page ---------------- */
function related() {
  const others = EVENTS.filter((e) => e.id !== ev.id && !isPast(e));
  const score = (e) => (e.category === ev.category ? 0 : e.city === ev.city ? 1 : 2);
  return others.sort((a, b) => score(a) - score(b) || new Date(a.date) - new Date(b.date)).slice(0, 3);
}

function renderEvent() {
  const past = isPast(ev);
  setMeta(`${ev.title} — PASSX`, ev.short);
  const speakers = ev.speakers.map(getSpeaker).filter(Boolean);

  main.innerHTML = `
  <section class="container ev-head" aria-labelledby="ev-title">
    <a class="back-link" href="index.html#events">${icon('arrowDownLeft')} All events</a>
    <div class="toolbar__filters" data-intro>
      <span class="chip chip--violet">${esc(ev.category)}</span>
      ${ev.featured ? '<span class="chip chip--date">Featured</span>' : ''}
      ${past ? '<span class="chip chip--surface">Closed</span>' : ''}
    </div>
    <h1 class="h-display ev-title" id="ev-title" data-intro>${esc(ev.title)}</h1>
    <p class="ev-meta" data-intro>
      <span>${icon('calendar')}${esc(longDate(ev.date))}</span>
      <span>${icon('clock')}${esc(timeRange(ev))}</span>
      <span>${icon('pin')}${esc(ev.venue)}, ${esc(ev.city)}</span>
      <span>${icon('ticket')}${esc(price(ev.price))}</span>
    </p>
    <figure class="ev-hero" data-intro>
      ${imgTag({ src: ev.image, alt: `${ev.title} — ${ev.category} event at ${ev.venue}`, w: 1600, h: 900, cls: 'ev-hero__color', label: ev.category, eager: true, attrs: 'fetchpriority="high"' })}
      ${imgTag({ src: ev.image, alt: '', w: 1600, h: 900, cls: 'ev-hero__gray', label: ev.category, eager: true, attrs: 'aria-hidden="true" data-gray' })}
    </figure>
  </section>

  <section class="container" aria-label="Countdown">
    <div class="card ev-count">
      <p class="label label--accent">${past ? 'Event status' : 'Doors open in'}</p>
      <div data-ev-countdown role="timer" aria-label="Time until ${esc(ev.title)} starts"></div>
    </div>
  </section>

  <div class="container ev-layout">
    <aside class="card box-office" aria-labelledby="bo-title"></aside>
    <div class="ev-main">
      <section aria-labelledby="about-title">
        <h2 class="h-display" id="about-title" data-reveal>About the event</h2>
        <div class="ev-desc" data-reveal>${ev.description.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
      </section>
      <section aria-labelledby="order-title">
        <h2 class="h-display" id="order-title" data-reveal>Running order</h2>
        <ol class="lineup" data-reveal-group>
          ${ev.lineup.map((l) => `<li><time datetime="${esc(l.time)}">${esc(l.time)}</time><span>${esc(l.item)}</span></li>`).join('')}
        </ol>
      </section>
      ${speakers.length ? `
      <section aria-labelledby="sp-title">
        <h2 class="h-display" id="sp-title" data-reveal>${speakers.length > 1 ? 'Speakers' : 'Speaker'}</h2>
        <div class="mini-speakers" data-reveal-group>${speakers.map((s) => speakerCard(s, 'speaker mini-speaker')).join('')}</div>
      </section>` : ''}
    </div>
  </div>

  <section class="container section" aria-labelledby="also-title">
    <div class="section-head">
      <h2 class="h-display h-section" id="also-title" data-reveal>Also happening</h2>
      <a class="btn btn--violet" href="index.html#events">All events ${icon('arrowUpRight')}</a>
    </div>
    <div class="egrid" data-reveal-group>${related().map(eventCard).join('')}</div>
  </section>`;

  renderBoxOffice();
  mountCountdown($('[data-ev-countdown]'), ev.date, {
    endedText: 'This show has ended.',
    onEnd: () => { if (!past) renderBoxOffice(); },
  });
}

/* ---------------- Boot ---------------- */
initShell();
if (!ev) {
  renderGate();
  initMotion();
  ticket3d($('.gate .ticket3d'));
} else {
  renderEvent();
  initMotion();
  reveal();
  colorOnScroll($('[data-gray]'));

  // Seats bar fills in once painted.
  const fill = $('[data-seats-fill]');
  if (fill && canAnimate) {
    const target = fill.style.getPropertyValue('--p');
    fill.style.setProperty('--p', '0');
    requestAnimationFrame(() => requestAnimationFrame(() => fill.style.setProperty('--p', target)));
  }

  const booking = initBooking({
    event: ev,
    onBooked: () => { updateSeats(); updateWalletCount(); if (store.seatsLeft(ev) === 0) renderBoxOffice(); },
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open-booking]');
    if (btn) booking.open(btn);
  });
  if (params.get('book') === '1' && !isPast(ev) && store.seatsLeft(ev) > 0) {
    setTimeout(() => booking.open($('[data-open-booking]')), canAnimate ? 700 : 0);
  }
}
