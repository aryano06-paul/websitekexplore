// PASSX — wallet: saved tickets grouped into upcoming / past, live mini
// countdowns, inline cancel confirmation with collapse animation + undo toast.
import { getEvent } from './data.js';
import {
  $, $$, esc, isPast, pad, splitTime, onTick, ticketCard, ticket3D, ctaHTML,
  initShell, toast, measureCtas, updateWalletCount, longDate,
} from './ui.js';
import * as store from './store.js';
import {
  initMotion, reveal, ticket3d, gsap, Flip, canAnimate, refresh,
} from './motion.js';

const host = $('[data-wallet]');
const totalEl = $('[data-wallet-total]');
let stopTick = null;

function entries() {
  return store.getTickets()
    .map((t) => ({ t, ev: getEvent(t.eventId) }))
    .filter((x) => x.ev);
}

function countdownText(ev) {
  const diff = new Date(ev.date).getTime() - Date.now();
  if (diff <= 0) return `Ended · ${longDate(ev.date)}`;
  const { d, h, m, s } = splitTime(diff);
  return `Starts in ${d ? `${pad(d)}d ` : ''}${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function ticketHTML({ t, ev }) {
  const past = isPast(ev);
  return `
  <article class="wticket${past ? ' wticket--past' : ''}" data-code="${esc(t.code)}" aria-label="Ticket ${esc(t.code)} for ${esc(ev.title)}">
    ${ticketCard(t, ev)}
    <div class="wticket__bar" data-bar>
      <span class="wticket__count" data-mini="${esc(ev.id)}">${esc(countdownText(ev))}</span>
      <div class="wticket__actions">
        <a class="btn btn--ghost btn--sm" href="event.html?id=${encodeURIComponent(ev.id)}">Event details</a>
        ${past ? '' : '<button class="btn btn--ghost btn--sm" type="button" data-cancel>Cancel ticket</button>'}
      </div>
    </div>
  </article>`;
}

function groupHTML(id, label, list) {
  if (!list.length) return '';
  return `
  <section class="wallet-group" aria-labelledby="${id}">
    <div class="wallet-group__title">
      <h2 class="h-display" id="${id}">${label}</h2>
      <span class="chip chip--surface" data-group-count>${pad(list.length)}</span>
    </div>
    <div class="wallet-list" data-reveal-group>${list.map(ticketHTML).join('')}</div>
  </section>`;
}

function updateTotals() {
  const n = store.getTickets().length;
  totalEl.textContent = `${pad(n)} ${n === 1 ? 'ticket' : 'tickets'}`;
  $$('.wallet-group').forEach((g) => {
    const c = $('[data-group-count]', g);
    if (c) c.textContent = pad($$('.wticket', g).length);
  });
  updateWalletCount();
}

function render() {
  const all = entries();
  const upcoming = all.filter((x) => !isPast(x.ev)).sort((a, b) => new Date(a.ev.date) - new Date(b.ev.date));
  const past = all.filter((x) => isPast(x.ev)).sort((a, b) => new Date(b.ev.date) - new Date(a.ev.date));

  if (!all.length) {
    host.innerHTML = `
    <div class="wallet-empty">
      ${ticket3D()}
      <h2 class="h-display h-section">No tickets yet</h2>
      <p>Book a seat and your QR ticket lands here, with a live countdown to the doors.</p>
      ${ctaHTML({ label: 'Explore Events', href: 'index.html#events' })}
    </div>`;
    measureCtas(host);
    ticket3d($('.ticket3d', host));
  } else {
    host.innerHTML = groupHTML('g-upcoming', 'Upcoming', upcoming) + groupHTML('g-past', 'Past', past);
  }
  updateTotals();
  reveal(host);
  refresh();
}

/* ---------------- Cancel with inline confirm + undo ---------------- */
function askCancel(card) {
  const bar = $('[data-bar]', card);
  const original = bar.innerHTML;
  bar.innerHTML = `
    <div class="confirm" role="group" aria-label="Confirm cancellation">
      <p>Cancel this ticket? Your seats go back on sale.</p>
      <button class="btn btn--danger btn--sm" type="button" data-yes>Yes, cancel</button>
      <button class="btn btn--ghost btn--sm" type="button" data-no>Keep it</button>
    </div>`;
  if (canAnimate) gsap.from($('.confirm', bar), { opacity: 0, y: -8, duration: 0.3, ease: 'power3.out', clearProps: 'all' });
  const keep = () => {
    bar.innerHTML = original;
    $('[data-cancel]', bar).focus();
  };
  $('[data-no]', bar).addEventListener('click', keep);
  $('[data-yes]', bar).addEventListener('click', () => cancel(card));
  bar.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('.confirm', bar)) keep(); }, { once: false });
  $('[data-no]', bar).focus();
}

function cancel(card) {
  const code = card.dataset.code;
  const removed = store.removeTicket(code);
  if (!removed) return;
  const ev = getEvent(removed.ticket.eventId);

  const finish = () => {
    const group = card.closest('.wallet-group');
    const others = $$('.wticket, .wallet-group', host).filter((el) => el !== card && !card.contains(el));
    const state = canAnimate && Flip ? Flip.getState(others) : null;
    card.remove();
    const groupEmpty = group && !$('.wticket', group);
    if (groupEmpty) group.remove();
    if (!store.getTickets().length) {
      render();
    } else {
      updateTotals();
      if (state) Flip.from(state, { duration: 0.5, ease: 'power3.inOut', onComplete: refresh });
      else refresh();
    }
    const focusTarget = $('.wticket [data-cancel]', host) || $('.wallet-empty .cta', host) || $('h1');
    if (focusTarget) {
      if (focusTarget.tagName === 'H1') focusTarget.setAttribute('tabindex', '-1');
      focusTarget.focus({ preventScroll: true });
    }
  };

  if (canAnimate) {
    gsap.to(card, {
      opacity: 0, scale: 0.92, y: -10, duration: 0.35, ease: 'power2.in', onComplete: finish,
    });
  } else {
    finish();
  }

  toast(`Ticket for ${ev ? ev.title : 'event'} cancelled.`, {
    actionLabel: 'Undo',
    duration: 5000,
    onAction: () => {
      store.restoreTicket(removed);
      render();
      toast('Ticket restored.');
    },
  });
}

/* ---------------- Boot ---------------- */
initShell();
render();
initMotion();
reveal();

host.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-cancel]');
  if (btn) askCancel(btn.closest('.wticket'));
});

stopTick = onTick(() => {
  $$('[data-mini]', host).forEach((el) => {
    const ev = getEvent(el.dataset.mini);
    if (ev) el.textContent = countdownText(ev);
  });
});
window.addEventListener('pagehide', () => { if (stopTick) stopTick(); });

// Keep the wallet in sync if tickets change in another tab.
window.addEventListener('storage', (e) => {
  if (e.key === 'px.tickets' || e.key === 'px.seats') render();
});

