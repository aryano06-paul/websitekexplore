// PASSX — registration drawer: open/close (drawer on desktop, bottom sheet on
// mobile), focus trap, validation, booking, success ticket + confetti.
import { EVENTS, getEvent } from './data.js';
import {
  $, $$, esc, icon, isPast, longDate, timeRange, ticketCard, toast, trapTab, dateChip,
} from './ui.js';
import * as store from './store.js';
import {
  gsap, canAnimate, reduced, lockScroll, unlockScroll,
} from './motion.js';

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const NAME_RE = /^[\p{L} .'-]+$/u;
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
const desktop = () => window.matchMedia('(min-width: 768px)').matches;

export function initBooking({ event: pageEvent, onBooked }) {
  const drawer = $('#booking');
  const panel = $('.drawer__panel', drawer);
  const backdrop = $('.drawer__backdrop', drawer);
  const form = $('#booking-form');
  const success = $('#booking-success');
  const title = $('#booking-title');
  const status = $('#form-status');
  const submit = $('button[type="submit"]', form);
  const submitLabel = $('.cta__pill', submit);
  const outside = $$('body > header, body > main, body > footer, body > .skip-link');

  const f = {
    name: $('#f-name'),
    email: $('#f-email'),
    phone: $('#f-phone'),
    event: $('#f-event'),
    qty: $('#f-qty'),
    coc: $('#f-coc'),
  };
  const hint = $('#f-event-hint');
  const qtyNote = $('#f-qty-note');
  const touched = new Set();
  let isOpen = false;
  let busy = false;
  let lastTrigger = null;

  /* ---------- Event select: upcoming with seats only ---------- */
  function fillEvents() {
    const options = EVENTS
      .filter((e) => !isPast(e) && store.seatsLeft(e) > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const current = f.event.value || pageEvent.id;
    f.event.innerHTML = options.map((e) => `<option value="${esc(e.id)}">${esc(e.title)} · ${esc(dateChip(e.date))}</option>`).join('');
    f.event.value = options.some((o) => o.id === current) ? current : (options[0] ? options[0].id : '');
    syncEventHint();
  }

  function selectedEvent() { return getEvent(f.event.value); }

  function maxQty() {
    const ev = selectedEvent();
    return ev ? Math.max(1, Math.min(4, store.seatsLeft(ev))) : 4;
  }

  function syncEventHint() {
    const ev = selectedEvent();
    if (!ev) { hint.textContent = ''; return; }
    const left = store.seatsLeft(ev);
    hint.textContent = `${longDate(ev.date)} · ${timeRange(ev)} · ${ev.venue}, ${ev.city}`;
    qtyNote.textContent = left < 4 ? `Only ${left} seat${left === 1 ? '' : 's'} left for this event.` : 'Up to 4 per booking.';
    f.qty.max = String(maxQty());
    syncStepper();
  }

  function syncStepper() {
    const n = Number(f.qty.value) || 0;
    $('[data-step="-1"]', form).disabled = n <= 1;
    $('[data-step="1"]', form).disabled = n >= maxQty();
  }

  /* ---------- Validation rules ---------- */
  const rules = {
    name() {
      const v = f.name.value.trim().replace(/\s+/g, ' ');
      if (!v) return 'Tell us your full name.';
      if (v.length < 2) return 'Your name needs at least 2 characters.';
      if (v.length > 50) return 'Keep your name under 50 characters.';
      if (!NAME_RE.test(v)) return 'Use letters, spaces and . \' - only.';
      if (!/\p{L}/u.test(v)) return 'Your name needs at least one letter.';
      return '';
    },
    email() {
      const v = f.email.value.trim().toLowerCase();
      if (!v) return 'We need an email to send your ticket.';
      if (!EMAIL_RE.test(v)) return 'That email doesn’t look right. Try name@example.com.';
      if (f.event.value && store.hasTicket(v, f.event.value)) {
        return { html: 'You already have a ticket for this one. <a href="wallet.html">Open your wallet</a>' };
      }
      return '';
    },
    phone() {
      const v = f.phone.value.replace(/[\s-]/g, '');
      if (!v) return 'Add a mobile number for venue updates.';
      if (!/^\d+$/.test(v)) return 'Use digits only (we’ve already added +91).';
      if (v.length !== 10) return `Mobile numbers have exactly 10 digits. You’ve entered ${v.length}.`;
      if (!/^[6-9]/.test(v)) return 'Indian mobile numbers start with 6, 7, 8 or 9.';
      return '';
    },
    event() {
      const ev = selectedEvent();
      if (!ev) return 'Pick an event to book.';
      if (isPast(ev)) return 'This event has already happened.';
      if (store.seatsLeft(ev) <= 0) return 'This event is sold out. Pick another one.';
      return '';
    },
    qty() {
      const raw = f.qty.value.trim();
      const n = Number(raw);
      if (!raw || !Number.isInteger(n) || n < 1) return 'Choose at least 1 ticket.';
      if (n > 4) return 'You can book up to 4 tickets at once.';
      const ev = selectedEvent();
      const left = ev ? store.seatsLeft(ev) : 0;
      if (ev && n > left) return `Only ${left} seat${left === 1 ? '' : 's'} left. Lower your ticket count.`;
      return '';
    },
    coc() {
      return f.coc.checked ? '' : 'Please agree to the code of conduct to continue.';
    },
  };

  function setError(key, result) {
    const input = f[key];
    const err = $(`#f-${key}-err`);
    const base = key === 'qty' ? 'f-qty-note' : key === 'event' ? 'f-event-hint' : '';
    if (result) {
      const html = typeof result === 'string' ? esc(result) : result.html;
      const isNew = err.hidden || err.dataset.msg !== html;
      err.innerHTML = `${icon('alert')}<span>${html}</span>`;
      err.dataset.msg = html;
      err.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [base, err.id].filter(Boolean).join(' '));
      if (isNew && !reduced) {
        err.classList.remove('is-shaking');
        void err.offsetWidth; // restart the animation
        err.classList.add('is-shaking');
      }
    } else {
      err.hidden = true;
      err.innerHTML = '';
      delete err.dataset.msg;
      input.removeAttribute('aria-invalid');
      if (base) input.setAttribute('aria-describedby', base);
      else input.removeAttribute('aria-describedby');
    }
  }

  function validate(key) {
    const r = rules[key]();
    setError(key, r);
    return !r;
  }

  function validateAll() {
    return Object.keys(rules).filter((k) => !validate(k));
  }

  /* ---------- Field behaviour ---------- */
  Object.entries(f).forEach(([key, input]) => {
    input.addEventListener('blur', () => {
      if (key === 'email') f.email.value = f.email.value.trim().toLowerCase();
      if (key === 'name') f.name.value = f.name.value.replace(/\s+/g, ' ').trim();
      if (key === 'event') return; // validated on change
      touched.add(key);
      validate(key);
    });
    input.addEventListener(key === 'coc' || key === 'event' ? 'change' : 'input', () => {
      if (key === 'phone') {
        const pos = input.selectionStart;
        const before = input.value;
        const cleaned = before.replace(/[\s-]/g, '');
        if (cleaned !== before) {
          input.value = cleaned;
          const removed = before.slice(0, pos ?? before.length).length - before.slice(0, pos ?? before.length).replace(/[\s-]/g, '').length;
          try { input.setSelectionRange((pos ?? cleaned.length) - removed, (pos ?? cleaned.length) - removed); } catch { /* type=tel supports it */ }
        }
      }
      if (key === 'qty') syncStepper();
      if (key === 'event') {
        syncEventHint();
        touched.add('event');
        if (Number(f.qty.value) > maxQty()) f.qty.value = String(maxQty());
        syncStepper();
        validate('event');
        if (touched.has('email')) validate('email');
        if (touched.has('qty')) validate('qty');
        return;
      }
      if (key === 'coc') touched.add('coc');
      if (touched.has(key)) validate(key);
    });
  });

  $$('[data-step]', form).forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = (Number(f.qty.value) || 1) + Number(btn.dataset.step);
      f.qty.value = String(Math.max(1, Math.min(maxQty(), n)));
      syncStepper();
      touched.add('qty');
      validate('qty');
    });
  });

  // Blur-validation inserts error text, which shifts the layout. If a mouse press
  // on a button/label blurred the previous field, mouseup would land on a moved
  // target and the click would be lost. Keep focus put during the press instead.
  $$('button, .check', form).forEach((el) => {
    el.addEventListener('mousedown', (e) => { if (e.button === 0) e.preventDefault(); });
  });

  /* ---------- Submit ---------- */
  function announce(msg) {
    status.textContent = '';
    requestAnimationFrame(() => { status.textContent = msg; });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    f.email.value = f.email.value.trim().toLowerCase();
    f.name.value = f.name.value.replace(/\s+/g, ' ').trim();
    Object.keys(rules).forEach((k) => touched.add(k));
    const bad = validateAll();
    if (bad.length) {
      announce(`${bad.length} ${bad.length === 1 ? 'field needs' : 'fields need'} attention before we can book.`);
      f[bad[0]].focus();
      return;
    }
    status.textContent = '';

    busy = true;
    submit.classList.add('is-loading');
    submit.setAttribute('aria-busy', 'true');
    submitLabel.textContent = 'Booking…';
    await wait(900);

    // Re-check in case seats changed in another tab while we "processed".
    const recheck = validateAll();
    if (recheck.length) {
      resetSubmit();
      announce(`${recheck.length} ${recheck.length === 1 ? 'field needs' : 'fields need'} attention before we can book.`);
      f[recheck[0]].focus();
      return;
    }

    const ev = selectedEvent();
    const ticket = store.addTicket({
      eventId: ev.id,
      name: f.name.value,
      email: f.email.value,
      phone: `+91${f.phone.value.replace(/[\s-]/g, '')}`,
      qty: Number(f.qty.value),
    });
    resetSubmit();
    showSuccess(ticket, ev);
    if (onBooked) onBooked(ticket);
  });

  function resetSubmit() {
    busy = false;
    submit.classList.remove('is-loading');
    submit.removeAttribute('aria-busy');
    submitLabel.textContent = 'Confirm booking';
  }

  /* ---------- Success: form morphs into the lime ticket ---------- */
  function showSuccess(ticket, ev) {
    const render = () => {
      form.hidden = true;
      success.hidden = false;
      title.textContent = 'Ticket booked';
      success.innerHTML = `
        <div class="success__head">
          <p class="label label--accent">Booking confirmed</p>
          <h3 class="h-display" tabindex="-1" data-success-title>You’re in!</h3>
          <p>${esc(ticket.qty)} ${ticket.qty === 1 ? 'ticket' : 'tickets'} saved to your wallet. Show the QR at the gate.</p>
        </div>
        <div class="success__ticket">${ticketCard(ticket, ev)}</div>
        <div class="success__actions">
          <a class="btn btn--violet" href="wallet.html">View in wallet ${icon('arrowUpRight')}</a>
          <button class="btn btn--ghost" type="button" data-done>Done</button>
        </div>`;
      $('[data-done]', success).addEventListener('click', () => close());
      $('[data-success-title]', success).focus({ preventScroll: true });
      $('.drawer__scroll', drawer).scrollTop = 0;

      const tk = $('.ticket', success);
      if (canAnimate) {
        gsap.timeline()
          .fromTo(tk, { rotationY: -100, scale: 0.86, opacity: 0, transformPerspective: 900 }, {
            rotationY: 12, scale: 1, opacity: 1, duration: 0.7, ease: 'power3.out',
          })
          .to(tk, { rotationY: 0, rotation: -2, duration: 0.35, ease: 'power2.out' })
          .to(tk, { rotation: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)', clearProps: 'transform' })
          .from($$('.success__head > *, .success__actions > *', success), {
            y: 16, opacity: 0, stagger: 0.06, duration: 0.4, ease: 'power3.out', clearProps: 'transform,opacity',
          }, 0.2);
        confetti(tk);
      }
      toast('Ticket booked. See you there.');
    };

    if (canAnimate) {
      gsap.to(form, { opacity: 0, scale: 0.96, duration: 0.25, ease: 'power2.in', onComplete: () => { gsap.set(form, { clearProps: 'all' }); render(); } });
    } else {
      render();
    }
  }

  /* ---------- Confetti (canvas, 1.2s, lime + violet rectangles) ---------- */
  function confetti(origin) {
    if (reduced) return;
    const c = document.createElement('canvas');
    c.className = 'confetti';
    c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth; const H = window.innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) { c.remove(); return; }
    ctx.scale(dpr, dpr);
    const r = origin.getBoundingClientRect();
    const ox = r.left + r.width / 2; const oy = r.top + r.height / 3;
    const parts = Array.from({ length: 110 }, () => ({
      x: ox + (Math.random() - 0.5) * r.width * 0.6,
      y: oy,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 13 - 4,
      w: 6 + Math.random() * 7,
      h: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: Math.random() < 0.55 ? '#E4FF5A' : '#6C4EF2',
    }));
    const start = performance.now();
    const frame = (now) => {
      const t = now - start;
      ctx.clearRect(0, 0, W, H);
      const alpha = Math.max(0, 1 - Math.max(0, t - 800) / 400);
      parts.forEach((p) => {
        p.vy += 0.38; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < 1200) requestAnimationFrame(frame);
      else c.remove();
    };
    requestAnimationFrame(frame);
  }

  /* ---------- Open / close ---------- */
  function resetForm() {
    form.reset();
    f.qty.value = '1';
    touched.clear();
    Object.keys(rules).forEach((k) => setError(k, ''));
    status.textContent = '';
    form.hidden = false;
    success.hidden = true;
    success.innerHTML = '';
    title.textContent = 'Get your ticket';
  }

  const onKey = (e) => {
    if (document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    trapTab(e, panel);
  };

  function open(trigger) {
    if (isOpen) return;
    isOpen = true;
    lastTrigger = trigger || document.activeElement;
    if (!success.hidden) resetForm();
    fillEvents();
    f.event.value = EVENTS.some((x) => x.id === pageEvent.id) && [...f.event.options].some((o) => o.value === pageEvent.id) ? pageEvent.id : f.event.value;
    syncEventHint();
    drawer.hidden = false;
    outside.forEach((el) => { el.inert = true; });
    lockScroll();
    document.addEventListener('keydown', onKey);
    if (canAnimate) {
      gsap.killTweensOf([panel, backdrop]);
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      gsap.fromTo(panel, desktop() ? { xPercent: 100, yPercent: 0, y: 0 } : { yPercent: 100, xPercent: 0, y: 0 }, {
        xPercent: 0, yPercent: 0, duration: 0.55, ease: 'power3.out',
      });
    }
    f.name.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.removeEventListener('keydown', onKey);
    const done = () => {
      drawer.hidden = true;
      outside.forEach((el) => { el.inert = false; });
      unlockScroll();
      if (!success.hidden) resetForm();
      if (lastTrigger && lastTrigger.isConnected) lastTrigger.focus({ preventScroll: true });
      else { const b = $('[data-open-booking]'); if (b) b.focus({ preventScroll: true }); }
      if (gsap) gsap.set(panel, { clearProps: 'transform' });
      else panel.style.transform = '';
    };
    if (canAnimate) {
      gsap.to(backdrop, { opacity: 0, duration: 0.3, ease: 'power2.in' });
      gsap.to(panel, {
        ...(desktop() ? { xPercent: 100 } : { yPercent: 100, y: 0 }),
        duration: 0.35,
        ease: 'power3.in',
        onComplete: done,
      });
    } else {
      done();
    }
  }

  $$('[data-drawer-close]', drawer).forEach((b) => b.addEventListener('click', () => close()));

  /* ---------- Swipe down to close (bottom sheet) ---------- */
  const handles = [$('.drawer__grab', drawer), $('.drawer__head', drawer)];
  let dragY = null; let startY = 0; let lastY = 0; let lastT = 0; let velocity = 0;
  handles.forEach((h) => {
    h.addEventListener('pointerdown', (e) => {
      if (desktop() || e.target.closest('button')) return;
      dragY = 0; startY = e.clientY; lastY = e.clientY; lastT = performance.now(); velocity = 0;
      h.setPointerCapture(e.pointerId);
    });
    h.addEventListener('pointermove', (e) => {
      if (dragY === null) return;
      const now = performance.now();
      velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY; lastT = now;
      dragY = e.clientY - startY;
      const y = dragY > 0 ? dragY : dragY * 0.2;
      if (gsap) gsap.set(panel, { y }); else panel.style.transform = `translateY(${y}px)`;
    });
    const end = () => {
      if (dragY === null) return;
      const shouldClose = dragY > 120 || velocity > 0.6;
      dragY = null;
      if (shouldClose) close();
      else if (gsap) gsap.to(panel, { y: 0, duration: 0.35, ease: 'power3.out' });
      else panel.style.transform = '';
    };
    h.addEventListener('pointerup', end);
    h.addEventListener('pointercancel', end);
  });

  fillEvents();
  return { open, close };
}
