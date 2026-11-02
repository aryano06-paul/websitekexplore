// PASSX — motion layer: Lenis smooth scroll wired to GSAP's ticker, scroll reveals,
// parallax, the 3D ticket, custom cursor, nav auto-hide and page transitions.
// Everything degrades gracefully: if GSAP/Lenis fail to load or the user prefers
// reduced motion, content is shown instantly and native scrolling is used.

const w = window;
const root = document.documentElement;

export const gsap = w.gsap || null;
export const ScrollTrigger = w.ScrollTrigger || null;
export const Flip = w.Flip || null;
export const reduced = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const canAnimate = Boolean(gsap) && !reduced;

const supportsCrossDocVT = 'onpagereveal' in w;
let lenis = null;
let lockCount = 0;
let initialised = false;

if (gsap) {
  if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  if (Flip) gsap.registerPlugin(Flip);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
export function initMotion() {
  if (initialised) return;
  initialised = true;

  // If the safety timer already revealed content (very slow CDN), skip intros.
  const late = root.classList.contains('motion-fallback');

  initLenis();
  initAnchors();
  initNav();
  initCursor();
  pageEnter();

  if (canAnimate && !late) {
    heroIntro();
  } else {
    root.classList.add('motion-ready');
  }
}

/* ------------------------------------------------------------------ */
/* Lenis                                                               */
/* ------------------------------------------------------------------ */
function initLenis() {
  if (reduced || !w.Lenis) return;
  lenis = new w.Lenis({ lerp: 0.1, smoothWheel: true });
  if (gsap) {
    if (ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}

export const getLenis = () => lenis;

/** Pause page scrolling (drawer, menu, modal). Reference-counted. */
export function lockScroll() {
  lockCount += 1;
  if (lockCount > 1) return;
  if (lenis) lenis.stop();
  else root.style.overflow = 'hidden';
}
export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) return;
  if (lenis) lenis.start();
  else root.style.overflow = '';
}

function navHeight() {
  const nav = document.querySelector('.nav');
  return nav ? nav.offsetHeight : 0;
}

/** Smooth-scroll to an element (or 0 for top) through Lenis when available. */
export function scrollToTarget(target, { focus = false } = {}) {
  const isTop = target === 0 || target === 'top';
  const el = isTop ? null : target;
  const goingUp = el ? el.getBoundingClientRect().top < 0 : true;
  const offset = goingUp ? -(navHeight() + 16) : -16;

  if (lenis) {
    lenis.scrollTo(isTop ? 0 : el, { offset: isTop ? 0 : offset, duration: 1.2 });
  } else if (isTop) {
    w.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  } else {
    const y = el.getBoundingClientRect().top + w.scrollY + offset;
    w.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  if (focus && el) {
    if (!el.hasAttribute('tabindex') && !el.matches('a,button,input,select,textarea')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}

/* ------------------------------------------------------------------ */
/* Links: in-page anchors through Lenis, cross-page through the wipe   */
/* ------------------------------------------------------------------ */
const normPath = (p) => p.replace(/index\.html$/, '');

function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download') || a.getAttribute('href').startsWith('mailto:')) return;

    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;

    const samePage = normPath(url.pathname) === normPath(location.pathname);
    if (samePage && url.hash) {
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id === 'top' ? 0 : document.getElementById(id);
      if (target === null) return;
      e.preventDefault();
      scrollToTarget(target, { focus: target !== 0 });
      if (url.search === location.search) history.replaceState(history.state, '', url.hash);
      return;
    }
    if (samePage && url.search === location.search && !url.hash) {
      e.preventDefault();
      scrollToTarget(0);
      return;
    }
    if (!/\.html$|\/$/.test(url.pathname)) return;

    // Cross-page: native view transitions handle it where supported.
    if (supportsCrossDocVT || reduced || !gsap) return;
    e.preventDefault();
    pageLeave(url.href);
  });

  // Respect a hash on arrival (e.g. index.html#events from another page).
  if (location.hash && location.hash.length > 1) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) {
      requestAnimationFrame(() => {
        const y = el.getBoundingClientRect().top + w.scrollY - navHeight() - 16;
        if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
        else w.scrollTo(0, y);
      });
    }
  }
}

/* ------------------------------------------------------------------ */
/* Page transitions (GSAP wipe fallback)                               */
/* ------------------------------------------------------------------ */
function pageLeave(href) {
  const panel = document.querySelector('.page-wipe');
  if (!panel) { location.href = href; return; }
  try { sessionStorage.setItem('px.wipe', '1'); } catch { /* storage blocked */ }
  gsap.fromTo(panel, { yPercent: 100, visibility: 'visible' }, {
    yPercent: 0,
    duration: 0.3,
    ease: 'power3.in',
    onComplete: () => { location.href = href; },
  });
}

function pageEnter() {
  const panel = document.querySelector('.page-wipe');
  if (!panel) return;
  if (root.classList.contains('is-entering')) {
    if (!gsap) { root.classList.remove('is-entering'); return; }
    gsap.set(panel, { yPercent: 0, visibility: 'visible' });
    root.classList.remove('is-entering');
    gsap.to(panel, {
      yPercent: -100,
      duration: 0.3,
      delay: 0.05,
      ease: 'power3.out',
      onComplete: () => gsap.set(panel, { yPercent: 100, visibility: 'hidden' }),
    });
  }
  // Coming back via bfcache: make sure the panel isn't left covering the page.
  w.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    root.classList.remove('is-entering');
    if (gsap) gsap.set(panel, { yPercent: 100, visibility: 'hidden' });
  });
}

/* ------------------------------------------------------------------ */
/* Hero headline intro                                                 */
/* ------------------------------------------------------------------ */
function heroIntro() {
  const words = document.querySelectorAll('.split .w > span');
  const icons = document.querySelectorAll('.split .h-icon');
  const intro = document.querySelectorAll('[data-intro]');

  // Lock the start state inline before lifting the CSS pre-paint state.
  // y:0 discards the px offset GSAP would otherwise parse from the CSS pre-paint transform.
  if (words.length) gsap.set(words, { y: 0, yPercent: 105 });
  if (icons.length) gsap.set(icons, { scale: 0 });
  if (intro.length) gsap.set(intro, { opacity: 0, y: 40 });
  root.classList.add('motion-ready');

  const tl = gsap.timeline({ delay: 0.15 });
  if (words.length) {
    tl.to(words, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.06 }, 0);
  }
  if (icons.length) {
    tl.to(icons, { scale: 1, duration: 0.7, ease: 'back.out(2.2)', stagger: 0.12 }, 0.35);
  }
  if (intro.length) {
    tl.to(intro, {
      opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, clearProps: 'transform',
    }, words.length ? 0.45 : 0);
  }
}

/* ------------------------------------------------------------------ */
/* Scroll reveals                                                      */
/* ------------------------------------------------------------------ */
const groupTriggers = new WeakMap();

export function reveal(scope = document) {
  if (!canAnimate || !ScrollTrigger) return;

  scope.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((el) => {
    el.setAttribute('data-revealed', '');
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  scope.querySelectorAll('[data-reveal-group]:not([data-revealed])').forEach((group) => {
    group.setAttribute('data-revealed', '');
    const items = [...group.children].filter((c) => !c.hidden && c.offsetParent !== null);
    if (!items.length) return;
    gsap.set(items, { y: 40, opacity: 0 });
    const triggers = ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.08, overwrite: true, clearProps: 'transform,opacity',
      }),
    });
    groupTriggers.set(group, triggers);
  });
}

/** Stop pending reveals for a group and show its children (used before a Flip). */
export function settleGroup(group) {
  const triggers = groupTriggers.get(group);
  if (!triggers) return;
  triggers.forEach((t) => t.kill());
  groupTriggers.delete(group);
  gsap.killTweensOf(group.children);
  gsap.set(group.children, { clearProps: 'transform,opacity' });
}

export function refresh() {
  if (ScrollTrigger) ScrollTrigger.refresh();
}

/* ------------------------------------------------------------------ */
/* Parallax: image tiles + 3D ticket                                   */
/* ------------------------------------------------------------------ */
export function parallax(scope = document) {
  if (!canAnimate || !ScrollTrigger) return;
  scope.querySelectorAll('[data-parallax]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -6, scale: 1.15 }, {
      yPercent: 6,
      scale: 1.15,
      ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/** Grayscale overlay that fades to reveal the colour photo as it scrolls in. */
export function colorOnScroll(overlay) {
  if (!overlay) return;
  if (!canAnimate || !ScrollTrigger) {
    overlay.style.opacity = '0';
    return;
  }
  gsap.to(overlay, {
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: overlay.parentElement, start: 'top 70%', end: 'center 35%', scrub: 0.6 },
  });
}

export function ticket3d(el) {
  if (!el || !canAnimate) return;
  const tilt = el.querySelector('.ticket3d__tilt');
  const bob = el.querySelector('.ticket3d__bob');
  let inView = true;

  gsap.to(bob, { y: -14, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });

  if (ScrollTrigger) {
    gsap.fromTo(el, { yPercent: 8, rotation: -3 }, {
      yPercent: -15,
      rotation: 4,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onToggle: (self) => { inView = self.isActive; },
      },
    });
  }

  if (finePointer && tilt) {
    const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.6, ease: 'power3.out' });
    const clamp = (v) => Math.max(-1, Math.min(1, v));
    w.addEventListener('pointermove', (e) => {
      if (!inView || e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const dx = clamp((e.clientX - (r.left + r.width / 2)) / (w.innerWidth / 2));
      const dy = clamp((e.clientY - (r.top + r.height / 2)) / (w.innerHeight / 2));
      ry(dx * 10);
      rx(-dy * 10);
    }, { passive: true });
  }
}

/* ------------------------------------------------------------------ */
/* Nav: hide on scroll down, show on scroll up                         */
/* ------------------------------------------------------------------ */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  let last = 0;
  let hidden = false;

  const show = () => {
    if (!hidden) return;
    hidden = false;
    gsap.to(nav, { yPercent: 0, duration: 0.45, ease: 'power3.out' });
  };
  const hide = () => {
    if (hidden) return;
    hidden = true;
    gsap.to(nav, { yPercent: -110, duration: 0.45, ease: 'power3.out' });
  };

  const onScroll = (y) => {
    nav.classList.toggle('is-scrolled', y > 8);
    if (reduced || !gsap) return;
    const delta = y - last;
    if (Math.abs(delta) < 4) return;
    if (delta > 0 && y > 160 && !nav.contains(document.activeElement)) hide();
    else if (delta < 0) show();
    last = y;
  };

  if (lenis) lenis.on('scroll', (l) => onScroll(l.scroll));
  else w.addEventListener('scroll', () => onScroll(w.scrollY), { passive: true });
  nav.addEventListener('focusin', () => { if (gsap) show(); });
  onScroll(w.scrollY);
}

/* ------------------------------------------------------------------ */
/* Custom cursor (desktop, fine pointer, motion allowed)               */
/* ------------------------------------------------------------------ */
function initCursor() {
  if (!finePointer || reduced || !gsap) return;

  const c = document.createElement('div');
  c.className = 'cursor is-hidden';
  c.setAttribute('aria-hidden', 'true');
  c.innerHTML = '<div class="cursor-ring"><span class="cursor-ring__circle"></span><span class="cursor-ring__label"></span></div><div class="cursor-dot"></div>';
  document.body.append(c);
  root.classList.add('has-cursor');

  const dot = c.querySelector('.cursor-dot');
  const ring = c.querySelector('.cursor-ring');
  const label = c.querySelector('.cursor-ring__label');
  const setDotX = gsap.quickSetter(dot, 'x', 'px');
  const setDotY = gsap.quickSetter(dot, 'y', 'px');
  const setRingX = gsap.quickSetter(ring, 'x', 'px');
  const setRingY = gsap.quickSetter(ring, 'y', 'px');

  let mx = -100; let my = -100; let rx = mx; let ry = my;
  let state = '';

  const setState = (next) => {
    if (next === state) return;
    state = next;
    label.textContent = next ? next.toUpperCase() : '';
    c.classList.toggle('is-active', Boolean(next));
  };

  w.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY;
    setDotX(mx); setDotY(my);
    c.classList.remove('is-hidden');
    const t = e.target instanceof Element ? e.target.closest('[data-cursor]') : null;
    setState(t ? t.getAttribute('data-cursor') : '');
  }, { passive: true });

  document.addEventListener('pointerleave', () => c.classList.add('is-hidden'));
  w.addEventListener('blur', () => c.classList.add('is-hidden'));

  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    setRingX(rx); setRingY(ry);
  });
}
