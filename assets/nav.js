'use strict';

(function () {
  // Resolve the assets/ base from this script's own URL so the font-faces, the
  // paper grain and the lazy tree load from anywhere (root pages OR /labs/).
  const _self = document.currentScript || document.querySelector('script[src$="nav.js"]');
  const ASSETS = _self ? _self.src.replace(/nav\.js(\?.*)?$/, '') : 'assets/';

  // ── Two worlds ──────────────────────────────────────────────────────────────
  // The main site (lluc.dev) and the labs (lluc labs, an experimentation zone).
  const MAIN = [
    { title: 'home',  desc: 'presentation',       url: 'index.html', num: '00' },
    { title: 'about', desc: 'who I am',        url: 'me.html',    num: '01' },
    { title: 'blog',  desc: 'philosophy',      url: 'blog.html',  num: '02' },
    { title: 'map',   desc: "where I've been", url: 'map.html',   num: '03' },
    { title: 'labs',  desc: 'experiments',   url: 'labs.html',  num: '04' },
  ];
  const LABS = [
    { title: 'labs',     desc: 'experiments',     url: 'labs.html',      num: '00' },
    { title: 'glyphs',   desc: 'syllable blocks', url: 'englglyph.html', num: '01' },
    { title: 'cassette', desc: 'stylish covers',  url: 'cassette.html',  num: '02' },
    { title: '용',       desc: 'soon',            url: '#',              num: '03' },
    { title: 'insta',    desc: 'post generator',  url: 'insta.html',     num: '04' },
    { title: 'lluc.dev', desc: 'back home',     url: 'index.html',     num: '05' },
  ];

  const LABS_PAGES = ['labs.html', 'cassette.html', 'englglyph.html', 'insta.html'];
  function thisPage() { return window.location.pathname.split('/').pop() || 'index.html'; }
  const IN_LABS = LABS_PAGES.indexOf(thisPage()) >= 0;

  // Navigate to url, flagging that we left via the in-site nav so the index can
  // restore the running simulation hour instead of replaying the intro glide.
  function navigate(url) {
    try { sessionStorage.setItem('lluc.keepSim', '1'); } catch (e) {}
    window.location.href = url;
  }
  // Keep that flag a strict one-shot: a non-index destination clears it on load,
  // so it only ever survives for the single hop that set it. (The index reads it
  // from its own inline script, which runs before this on that page.)
  if (thisPage() !== 'index.html') { try { sessionStorage.removeItem('lluc.keepSim'); } catch (e) {} }

  // Labs pages live in /labs/. The nav uses bare filenames; this prefixes them
  // for the current location: from the root, labs → "labs/x"; from inside labs,
  // the root pages → "../x" and sibling labs pages stay bare.
  function resolveUrl(u) {
    if (u === '#') return u;
    const isLabs = LABS_PAGES.indexOf(u) >= 0;
    if (IN_LABS) return isLabs ? u : '../' + u;
    return isLabs ? 'labs/' + u : u;
  }
  const PAGES   = IN_LABS ? LABS : MAIN;

  const N           = PAGES.length;
  const TOTAL_SLOTS = N * 3;
  const HALF        = Math.floor(TOTAL_SLOTS / 2);
  const WHEEL_R     = 200;
  const WHEEL_STEP  = 25;
  const WHEEL_STEP_MOBILE = 40;
  function getStep() { return window.innerWidth <= 768 ? WHEEL_STEP_MOBILE : WHEEL_STEP; }
  const DRAG_STEP   = 65;

  let activeIndex = 0;
  let isOpen      = false;
  let wheelAccum  = 0;

  const slotEls     = [];
  const baseIndex   = [];
  const shortcutEls = [];

  let savedScrollY = 0;
  function lockScroll() {
    savedScrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top      = -savedScrollY + 'px';
    document.body.style.width    = '100%';
  }
  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top      = '';
    document.body.style.width    = '';
    window.scrollTo(0, savedScrollY);
  }

  function gcText(text) {
    return [...text].map(ch => '<span class="gc">' + ch + '</span>').join('');
  }

  function currentPage() {
    const p = window.location.pathname.split('/').pop() || 'index.html';
    const i = PAGES.findIndex(x => x.url === p);
    return i >= 0 ? i : 0;
  }

  function inject() {
    activeIndex = currentPage();
    if (IN_LABS) document.documentElement.classList.add('world-labs');

    const fontFace = document.createElement('style');
    fontFace.textContent = `
      @font-face { font-family: 'Myoungjo'; src: url('${ASSETS}fonts/YES24MyoungjoBold.ttf'); font-weight: 700; }
      @font-face { font-family: 'Paperlogy'; src: url('${ASSETS}fonts/Paperlogy-4Regular.ttf'); font-weight: 400; font-display: swap; }
      @font-face { font-family: 'Paperlogy'; src: url('${ASSETS}fonts/Paperlogy-6SemiBold.ttf'); font-weight: 600; font-display: swap; }
    `;
    document.head.appendChild(fontFace);

    const style = document.createElement('style');
    style.textContent = `
/* ── Universal page nav ── */
.page-nav {
  position: sticky; top: 0; z-index: 1100;
  flex-shrink: 0; margin-left: calc(50% - 50vw);
  /* longhand, not the background shorthand: a var() inside a shorthand becomes a
     pending-substitution value that won't fire the background-color transition,
     so the nav tint would snap between sky bands instead of crossfading. */
  background-color: var(--nav-bar, rgba(242,240,235,0.92));
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgb(var(--ink, 0 0 0) / .13);
  line-height: 1.5; font-size: 16px;
  font-family: 'Paperlogy', sans-serif; letter-spacing: normal; word-break: normal;
}
.nav-inner {
  box-sizing: border-box;
  display: flex; justify-content: space-between; align-items: center;
  max-width: min(75vw, 1500px); margin: 0 auto;
  padding: 1.25rem 16px;
}
.nav-left { display: flex; align-items: center; gap: 0.5rem; }
.page-nav a { color: rgb(var(--ink, 0 0 0) / .73); text-decoration: none; font-size: 0.82rem; letter-spacing: 0; opacity: 1; transition: color .6s ease, opacity .15s; }
.page-nav a:hover { opacity: 0.55; }
.nav-logo { height: 0.9rem; margin-top: -2px; width: auto; display: block; filter: var(--nav-logo-filter, brightness(0) opacity(0.35)); transition: filter .6s ease, -webkit-filter .6s ease; }
    .nav-logo { height: 0.9rem; margin-top: -2px; width: auto; display: block;
      filter: brightness(var(--nav-logo-brightness, 0)) invert(var(--nav-logo-invert, 0)) sepia(var(--nav-logo-sepia, 0)) saturate(var(--nav-logo-saturate, 1)) hue-rotate(var(--nav-logo-hue, 0deg));
      opacity: var(--nav-logo-opacity, 0.35);
      transition: filter 5s ease, -webkit-filter 5s ease, opacity 5s ease;
      will-change: filter, opacity; }
.nav-dim { color: rgb(var(--ink, 0 0 0) / .3); font-size: 0.82rem; letter-spacing: 0; }
.nav-hint {
  font-family: 'Paperlogy', sans-serif; font-size: 0.65rem;
  letter-spacing: .18em; text-transform: uppercase;
  color: rgb(var(--ink, 0 0 0) / .55); cursor: pointer; transition: color .2s; white-space: nowrap;
}
.nav-hint:hover { color: rgb(var(--ink, 0 0 0) / .9); }
/* no lingering blue focus ring after a tap/click; keep it for keyboard users */
.nav-logo-link, .nav-hamburger-mobile, .nav-hint { -webkit-tap-highlight-color: transparent; }
.nav-logo-link:focus:not(:focus-visible),
.nav-hamburger-mobile:focus:not(:focus-visible),
.nav-hint:focus:not(:focus-visible) { outline: none; }
@media (max-width: 768px) { .nav-hint { display: none; } .nav-inner { max-width: none !important; } }

/* ── Thin scrollbar ── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(var(--ink, 0 0 0) / .18); border-radius: 2px; }
::-webkit-scrollbar-thumb:hover { background: rgb(var(--ink, 0 0 0) / .32); }
html { scrollbar-width: thin; scrollbar-color: rgb(var(--ink, 0 0 0) / .18) transparent; }

/* ── Overlay ── */
#nav-overlay {
  position: fixed; inset: 0; z-index: 2147483000;   /* above any lw-win (they start at 3000 and climb) */
  background-color: var(--nav-panel, rgb(242 240 235 / 85%));
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  opacity: 0; pointer-events: none;
  transition: opacity .28s ease;
  display: flex; align-items: center;
  overflow: hidden; touch-action: none;
  /* hard reset so the menu never inherits each page's body typography */
  font-family: 'Paperlogy', sans-serif; letter-spacing: normal; word-break: normal; line-height: normal;
}
#nav-overlay.open { opacity: 1; pointer-events: all; }
#nav-overlay::before {
  content: ''; position: absolute; inset: 0;
  background: url('${ASSETS}paper-grain.svg') repeat;
  opacity: var(--grain, .08); pointer-events: none; z-index: 0;
}

/* ── Desktop bezel ── */
#nav-bezel {
  position: relative; width: 560px; height: 100%;
  display: flex; align-items: center;
  overflow: hidden; flex-shrink: 0;
}
.nav-arc-ring {
  position: absolute; border-radius: 50%; border: 1px solid rgb(var(--ink, 0 0 0) / .1);
  top: 50%; transform: translateY(-50%);
  pointer-events: none; z-index: 0;
  width: 332.5px; height: 340px; left: -170px;
}
#nav-items-wrap {
  position: relative; left: 80px;
  height: 580px; width: 480px;
  perspective: 800px; perspective-origin: 0 50%;
  z-index: 1;
}
#nav-items {
  position: absolute; left: 32px; top: 50%;
  width: 448px; transform-style: preserve-3d;
  transition: transform .5s cubic-bezier(.23,1,.32,1);
  will-change: transform;
}

/* ── Items ── */
.ni {
  position: absolute; top: -40px; left: 0; width: 100%; height: 80px;
  display: flex; align-items: center; gap: 16px;
  cursor: pointer; user-select: none;
  backface-visibility: hidden; transition: opacity .5s;
  will-change: transform, opacity;
}
.ni-bullet {
  font-size: 1.5rem; line-height: 1; color: rgb(var(--ink, 0 0 0) / .82); flex-shrink: 0; width: 24px;
  opacity: 0; transform: translateX(-10px); transition: opacity .3s, transform .3s;
}
.ni.act .ni-bullet { opacity: 1; transform: translateX(0); }
.ni-num {
  font-family: 'Myoungjo', serif; font-weight: 700; font-size: 2.6rem; line-height: 1;
  color: rgb(var(--ink, 0 0 0)); min-width: 2.6ch; flex-shrink: 0;
  transition: color .25s, font-size .35s;
}
.ni.act .ni-num { color: rgb(var(--ink, 0 0 0) / .82); font-size: 3.1rem; }
.ni-right {
  padding-top: 5px; opacity: 0; transform: translateX(-10px);
  transition: opacity .32s, transform .32s; pointer-events: none;
}
.ni.act .ni-right { opacity: 1; transform: translateX(0); }
#nav-overlay.open .ni.act .ni-right { pointer-events: auto; }
.ni-title {
  font-family: 'Paperlogy', sans-serif; font-weight: 700; font-size: 1rem;
  color: rgb(var(--ink, 0 0 0)); line-height: 1.15; margin-bottom: 6px;
}
.ni-desc {
  font-family: 'Paperlogy', sans-serif; font-weight: 400; font-size: .6rem;
  letter-spacing: .12em; text-transform: uppercase;
  color: rgb(var(--ink, 0 0 0)); opacity: .38; line-height: 1.5;
}

/* ── Num / title / desc gc cells ── */
.ni-num   .gc { display: inline-block; width: 1ch; text-align: center; white-space: pre; letter-spacing: 0; }
.ni-title .gc { display: inline-block; width: 2ch; text-align: start; white-space: pre; letter-spacing: 0; }
.ni-desc  .gc { display: inline-block; width: 2ch; text-align: start; white-space: pre; letter-spacing: 0; }

/* ── Desktop close hint ── */
#nav-close-hint {
  position: absolute; top: 26px; right: 30px;
  font-family: 'Paperlogy', sans-serif; font-weight: 400; font-size: .52rem;
  letter-spacing: .22em; text-transform: uppercase;
  color: rgb(var(--ink, 0 0 0)); opacity: .6; cursor: pointer;
  transition: opacity .2s; line-height: 1.8; text-align: right; z-index: 5;
}
#nav-close-hint:hover { opacity: .92; font-weight: 700; }

/* ── Mobile side marks ── */
#nav-side-marks {
  display: none; position: absolute;
  left: 0; right: 0; top: 50%; transform: translateY(-50%);
  pointer-events: none; z-index: 2;
  justify-content: space-between; align-items: center;
  padding: 0 22px;
}
.nav-mark { font-size: 1.1rem; color: rgb(var(--ink, 0 0 0) / .35); line-height: 1; display: block; }
.nav-mark-r { transform: scaleX(-1); }

/* ── Mobile hamburger in nav ── */
.nav-hamburger-mobile {
  display: none; background: none; border: none; cursor: pointer;
  font-size: 1.1rem; color: rgb(var(--ink, 0 0 0) / .38); padding: 0;
  line-height: 1; align-items: center; justify-content: center;
  transition: color .2s;
}
.nav-hamburger-mobile:hover { color: rgb(var(--ink, 0 0 0) / .6); }

/* ── Mobile close button ── */
#nav-close-btn {
  display: none; position: absolute; top: 12px; right: 12px;
  width: 64px; height: 64px; border: none; background: none;
  font-size: 1.6rem; cursor: pointer;
  align-items: center; justify-content: center;
  color: rgb(var(--ink, 0 0 0) / .3); z-index: 10; line-height: 1;
}
#nav-close-btn:active { color: rgb(var(--ink, 0 0 0) / .65); }

/* ── Mobile layout ── */
@media (max-width: 768px) {
  #nav-overlay { flex-direction: column; align-items: center; justify-content: center; }

  #nav-bezel {
    width: 100%; height: 100%; flex-direction: column;
    align-items: center; justify-content: flex-start; overflow: visible;
    padding-top: 0vh; /* lift the barrel up, leaving room for the tree below */
  }
  /* align the marks with the active item, which sits at the centre of the
     lifted barrel (bezel padding-top 7vh + half of the 480px wrap), not the bezel */
  #nav-side-marks { top: 50%; }

  .nav-arc-ring {
    position: absolute; left: 50%;
    top: calc(0vh + 240px);
    transform: translate(-50%, -50%);
    width: 300px; height: 300px;
  }

  #nav-items-wrap {
    left: 0; height: 480px; width: 100%;
    perspective: 650px; perspective-origin: 50% 50%;
  }

  #nav-items { left: 0; width: 100%; }

  .ni {
    flex-direction: column; align-items: center; justify-content: center;
    gap: 4px; height: 120px; top: -60px;
  }
  .ni-bullet { display: none; }
  .ni-num { min-width: auto; font-size: 2.2rem; }
  .ni.act .ni-num { font-size: 2.6rem; }
  .ni-right { padding-top: 0; text-align: center; transform: none; }
  .ni.act .ni-right { transform: none; }

  #nav-side-marks { display: flex; }

  #nav-close-hint { display: none; }
  #nav-close-btn { display: flex; }

  .nav-hamburger-mobile { display: flex !important; }
}

/* ── Fast scroll ── */
#nav-overlay.fast-scroll .ni,
#nav-overlay.fast-scroll .ni-bullet,
#nav-overlay.fast-scroll .ni-right { transition: none; }

/* ── Labs world: hazard-tape "experimentation zone" indicator ── */
html.world-labs .page-nav {
  border-top: 6px solid transparent;
  border-bottom: 0;                 /* border-image paints every bordered side - kill the bottom so the tape is top-only */
  border-image: repeating-linear-gradient(45deg, #e8c200 0 12px, #1a1a1a 12px 24px) 6;
  box-shadow: 0 1px 0 rgba(0,0,0,.13);   /* restore the thin divider the bottom border used to give */
}
#nav-overlay.is-labs { background: rgb(244 238 224 / 72%); }
#nav-overlay.is-labs::after {
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 6; opacity: .8;
  background:
    repeating-linear-gradient(45deg, #e8c200 0 12px, #1a1a1a 12px 24px) top    / 100% 8px no-repeat,
    repeating-linear-gradient(45deg, #e8c200 0 12px, #1a1a1a 12px 24px) bottom / 100% 8px no-repeat;
}

/* ── Desktop shortcut panel (bottom-right corner) ── */
#nav-shortcuts {
  position: absolute; right: 30px; bottom: 26px; top: auto; transform: none;
  z-index: 5; display: flex; flex-direction: column; gap: 0;
  text-align: right; user-select: none;
  border-right: 1px solid rgb(var(--ink, 0 0 0) / .2); padding-right: 14px;
}
.nav-sc-head {
  font-family: 'Paperlogy', sans-serif; font-weight: 600; font-size: .38rem; letter-spacing: .24em;
  text-transform: uppercase; color: rgb(var(--ink, 0 0 0) / .45); margin-bottom: 7px; margin-right: -.24em;
}
.nav-sc {
  font-family: 'Paperlogy', sans-serif; font-weight: 500; cursor: pointer;
  padding: 4px 0; color: rgb(var(--ink, 0 0 0)); opacity: .62;
  transition: opacity .2s, transform .25s;
  display: flex; align-items: baseline; justify-content: flex-end; gap: 8px;
}
.nav-sc:hover { opacity: 1; transform: translateX(-3px); }
.nav-sc.sc-act { opacity: 1; }
.nav-sc.sc-act .nav-sc-title { font-weight: 700; }
.nav-sc.sc-act .nav-sc-num { opacity: 1; }
.nav-sc-num { font-size: .39rem; font-weight: 600; letter-spacing: .12em; opacity: .5; min-width: 2ch; padding-top: 2px; text-align: right; margin-right: -.12em; }
.nav-sc-main { display: flex; flex-direction: column; align-items: flex-end; }
.nav-sc-title { font-size: .68rem; font-weight: 600; line-height: 1.05; text-align: right; }
.nav-sc-desc { font-size: .36rem; font-weight: 500; letter-spacing: .1em; text-transform: uppercase; opacity: .55; margin-top: 2px; text-align: right; margin-right: -.1em; }
.nav-sc-dead { cursor: default; }
.nav-sc-dead:hover { opacity: .62; transform: none; }
@media (max-width: 900px) { #nav-shortcuts { display: none; } }

/* ── Tree behind the menu (desktop) ── */
#nav-tree { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; opacity: .72; }

/* ── Page loading ── */
body { transition: opacity 0.3s ease; }
html.js-loading body { opacity: 0; pointer-events: none; }
html.js-loading::after {
  content: ''; position: fixed; top: 50%; left: 50%;
  width: 18px; height: 18px; margin: -9px 0 0 -9px;
  border: 1.5px solid rgb(var(--ink, 0 0 0) / .1); border-top-color: rgb(var(--ink, 0 0 0) / .3);
  border-radius: 50%; animation: js-loading-spin .65s linear infinite;
  z-index: 9999; pointer-events: none;
}
@keyframes js-loading-spin { to { transform: rotate(360deg); } }

/* ── Right cluster: sun · esc · hamburger ── */
.nav-right { display: flex; align-items: center; gap: .8rem; }
.nav-sun {
  background: none; border: none; padding: 0; cursor: pointer; line-height: 0;
  color: rgb(var(--ink, 0 0 0) / .5); transition: color .2s, transform .4s cubic-bezier(.23,1,.32,1);
  -webkit-tap-highlight-color: transparent;
}
.nav-sun:hover { color: rgb(var(--ink, 0 0 0) / .92); transform: rotate(55deg); }
.nav-sun:focus:not(:focus-visible) { outline: none; }
.nav-sun svg { width: 15px; height: 15px; display: block; }
@media (max-width: 768px) { .nav-sun svg { width: 18px; height: 18px; } }

/* ── Sky window (the sun button) — an lw-bar-style panel you DRAG over the
   page on desktop; on mobile a rounded card over a blurred backdrop you tap
   outside to dismiss. Chrome recolours with the time-of-day theme. ── */
#sky-modal {
  position: fixed; inset: 0; z-index: 2147483600;
  pointer-events: none;                 /* desktop: window floats, the page stays usable */
  opacity: 0; transition: opacity .2s ease;
  font-family: 'Paperlogy', sans-serif; letter-spacing: normal; word-break: normal;
}
#sky-modal.open { opacity: 1; }
#sky-modal.open .sky-win { pointer-events: auto; }   /* only catch clicks while open */
.sky-win {
  position: fixed; top: 72px; right: 22px; width: 296px; pointer-events: none;
  background-color: var(--bg-solid, #f2f0eb);
  border: 1px solid rgb(var(--ink, 0 0 0) / .4); border-radius: 9px; overflow: hidden;
  color: rgb(var(--ink, 0 0 0));
  box-shadow: 0 24px 60px rgb(0 0 0 / .3), 0 2px 0 rgb(255 255 255 / .12) inset;
  animation: sky-pop .22s cubic-bezier(.23,1,.32,1);
}
@keyframes sky-pop { from { opacity: 0; transform: scale(.96) translateY(8px); } }
.sky-bar {
  height: 38px; display: flex; align-items: center; gap: 10px; padding: 0 12px;
  cursor: grab; user-select: none;
  background: rgb(var(--ink, 0 0 0) / .035);
  border-bottom: 1px solid rgb(var(--ink, 0 0 0) / .1);
}
.sky-bar.grab { cursor: grabbing; }
.sky-close { width: 14px; height: 14px; border-radius: 50%; background: #ff5f57; border: 1px solid rgb(0 0 0 / .18); cursor: pointer; flex: 0 0 auto; }
.sky-close:hover { filter: brightness(.85); }
.sky-bartitle { flex: 1; text-align: center; font-size: .54rem; letter-spacing: .24em; text-transform: uppercase; opacity: .5; }
.sky-barspacer { width: 14px; flex: 0 0 auto; }
.sky-body { padding: 16px 17px 15px; }
.sky-orbit { display: block; width: 92px; height: 92px; margin: 0 auto 8px; }
.sky-row { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 9px 0; border-top: 1px solid rgb(var(--ink, 0 0 0) / .08); }
.sky-k { font-size: .55rem; letter-spacing: .18em; text-transform: uppercase; opacity: .5; white-space: nowrap; padding-top: .2em; }
.sky-v { font-size: .94rem; font-weight: 600; text-align: right; line-height: 1.3; }
.sky-v small { display: block; font-size: .62rem; font-weight: 400; opacity: .62; letter-spacing: .02em; margin-top: 2px; }
.sky-v .sky-ecl { color: var(--blue, #bd93f9); font-weight: 600; }
.sky-time { font-family: 'Myoungjo', serif; font-size: 1.4rem; font-weight: 700; }
.sky-go {
  display: block; width: 100%; margin-top: 15px; padding: 10px; cursor: pointer;
  border: 1px solid rgb(var(--ink, 0 0 0) / .35); border-radius: 8px; background: transparent;
  color: rgb(var(--ink, 0 0 0)); font-family: 'Paperlogy', sans-serif; font-weight: 600;
  font-size: .6rem; letter-spacing: .2em; text-transform: uppercase; transition: background .2s, border-color .2s;
}
.sky-go:hover { background: rgb(var(--ink, 0 0 0) / .08); border-color: rgb(var(--ink, 0 0 0) / .6); }
.sky-orbit .o-ring  { fill: none; stroke: rgb(var(--ink, 0 0 0) / .22); stroke-width: 1.5; }
.sky-orbit .o-sun   { fill: rgb(var(--ink, 0 0 0) / .4); }
.sky-orbit .o-earth { fill: var(--blue, #bd93f9); }
.sky-orbit .o-hand  { stroke: var(--blue, #bd93f9); stroke-width: 1.8; stroke-linecap: round; }
@media (max-width: 768px) {
  #sky-modal {
    pointer-events: none;
    background: rgb(0 0 0 / .34); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 20px;
  }
  #sky-modal.open { pointer-events: auto; }
  .sky-win { position: static; width: min(90vw, 340px); border-radius: 16px; }
  .sky-bar { display: none; }          /* mobile: no title bar — tap outside to close */
}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'nav-overlay';
    if (IN_LABS) overlay.classList.add('is-labs');

    const bezel   = document.createElement('div'); bezel.id = 'nav-bezel';
    const arc     = document.createElement('div'); arc.className = 'nav-arc-ring';
    bezel.appendChild(arc);

    const wrap    = document.createElement('div'); wrap.id = 'nav-items-wrap';
    const itemsEl = document.createElement('div'); itemsEl.id = 'nav-items';

    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const slotOffset = i - HALF;
      const pageIdx = ((activeIndex + slotOffset) % N + N) % N;
      const pg = PAGES[pageIdx];

      const el     = document.createElement('div'); el.className = 'ni';
      const bullet = document.createElement('div'); bullet.className = 'ni-bullet'; bullet.textContent = '◗';
      const num    = document.createElement('div'); num.className = 'ni-num'; num.innerHTML = gcText(pg.num);
      const right  = document.createElement('div'); right.className = 'ni-right';
      const title  = document.createElement('div'); title.className = 'ni-title'; title.textContent = pg.title;
      const desc   = document.createElement('div'); desc.className  = 'ni-desc';  desc.textContent   = pg.desc;
      right.appendChild(title); right.appendChild(desc);
      el.appendChild(bullet); el.appendChild(num); el.appendChild(right);
      el._numEl = num; el._titleEl = title; el._descEl = desc;

      baseIndex.push(activeIndex + slotOffset);
      el.style.transform = 'rotateX(' + (-(activeIndex + slotOffset) * getStep()) + 'deg) translateZ(' + WHEEL_R + 'px)';

      el.addEventListener('click', () => {
        if (dragMoved) return;
        const idx = slotEls.indexOf(el);
        const bi  = baseIndex[idx];
        const offset = bi - activeIndex;
        if (offset === 0) {
          const url = PAGES[((bi % N) + N) % N].url;
          if (url !== '#') navigate(resolveUrl(url));
        } else {
          activeIndex = bi; paint();
        }
      });
      slotEls.push(el);
      itemsEl.appendChild(el);
    }

    // Mobile side marks
    const sideMarks = document.createElement('div'); sideMarks.id = 'nav-side-marks';
    const markL = document.createElement('span'); markL.className = 'nav-mark nav-mark-l'; markL.textContent = '◗';
    const markR = document.createElement('span'); markR.className = 'nav-mark nav-mark-r'; markR.textContent = '◗';
    sideMarks.appendChild(markL); sideMarks.appendChild(markR);
    wrap.appendChild(sideMarks);

    wrap.appendChild(itemsEl);
    bezel.appendChild(wrap);
    overlay.appendChild(bezel);

    const closeHint = document.createElement('div'); closeHint.id = 'nav-close-hint';
    closeHint.innerHTML = 'ESC to close<br><br>scroll or use the arrow keys to navigate<br>click or press enter to access page';
    closeHint.addEventListener('click', close);
    overlay.appendChild(closeHint);

    const closeBtn = document.createElement('button'); closeBtn.id = 'nav-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', close);
    overlay.appendChild(closeBtn);

    // Desktop side shortcut panel: click spins the barrel to the item, then navigates
    const shortcutsEl = document.createElement('div'); shortcutsEl.id = 'nav-shortcuts';
    const scHead = document.createElement('div'); scHead.className = 'nav-sc-head';
    scHead.textContent = IN_LABS ? 'lluc labs' : 'lluc.dev';
    shortcutsEl.appendChild(scHead);
    PAGES.forEach((pg, i) => {
      const sc = document.createElement('div');
      sc.className = 'nav-sc' + (pg.url === '#' ? ' nav-sc-dead' : '');
      sc.innerHTML = '<span class="nav-sc-main"><span class="nav-sc-title">' + pg.title + '</span>' +
        '<span class="nav-sc-desc">' + pg.desc + '</span></span>' +
        '<span class="nav-sc-num">' + pg.num + '</span>';
      sc.addEventListener('click', () => { if (!dragMoved) goTo(i); });
      shortcutsEl.appendChild(sc);
      shortcutEls.push(sc);
    });
    overlay.appendChild(shortcutsEl);

    overlay.addEventListener('click', e => { if (!dragMoved && e.target === overlay) close(); });

    document.body.appendChild(overlay);
    paint();

    // ── Wheel scroll ──────────────────────────────────────────────────────────
    let fastScrollTimer = null;
    function setFastScroll() {
      overlay.classList.add('fast-scroll');
      clearTimeout(fastScrollTimer);
      fastScrollTimer = setTimeout(() => overlay.classList.remove('fast-scroll'), 150);
    }
    overlay.addEventListener('wheel', e => {
      e.preventDefault();
      setFastScroll();
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) > 80) { activeIndex += Math.sign(wheelAccum); wheelAccum = 0; paint(); }
    }, { passive: false });

    // ── Drag / swipe with inertia ──────────────────────────────────────────────
    let dragActive = false;
    let dragMoved  = false;
    let dragLastY  = 0;
    let dragLastT  = 0;
    let dragAccum  = 0;
    let dragVelY   = 0;
    let inertiaRaf = null;

    function cancelInertia() { cancelAnimationFrame(inertiaRaf); inertiaRaf = null; }

    overlay.addEventListener('pointerdown', e => {
      if (closeHint.contains(e.target) || closeBtn.contains(e.target) || shortcutsEl.contains(e.target)) return;
      e.preventDefault(); // blocks native drag/text-selection
      cancelInertia();
      dragActive = true; dragMoved = false;
      dragLastY = e.clientY; dragLastT = e.timeStamp;
      dragAccum = 0; dragVelY = 0;
    });

    document.addEventListener('pointermove', e => {
      if (!dragActive) return;
      const dy = dragLastY - e.clientY;   // negated: drag down → lower index (natural list-scroll feel)
      const dt = Math.max(1, e.timeStamp - dragLastT);
      dragVelY = dy / dt * 16;
      if (Math.abs(dy) > 3) dragMoved = true;
      dragAccum += dy;
      const steps = Math.trunc(dragAccum / DRAG_STEP);
      if (steps !== 0) {
        activeIndex += steps;
        dragAccum -= steps * DRAG_STEP;
        setFastScroll();
        paint();
      }
      dragLastY = e.clientY; dragLastT = e.timeStamp;
    }, { passive: true });

    function endDrag() {
      if (!dragActive) return;
      dragActive = false;
      if (Math.abs(dragVelY) > 1.5) {
        let vel = dragVelY;
        let acc = 0;
        (function flick() {
          vel *= 0.86; acc += vel;
          const steps = Math.trunc(acc / DRAG_STEP);
          if (steps !== 0) { activeIndex += steps; acc -= steps * DRAG_STEP; paint(); }
          if (Math.abs(vel) > 0.5) inertiaRaf = requestAnimationFrame(flick);
        }());
      }
      setTimeout(() => { dragMoved = false; }, 0);
    }

    document.addEventListener('pointerup',     endDrag, { passive: true });
    document.addEventListener('pointercancel', endDrag, { passive: true });

    // ── Keyboard ──────────────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (skyModal && skyModal.classList.contains('open')) { closeSky(); return; }
        isOpen ? close() : open(); return;
      }
      if (!isOpen) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex++; paint(); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); activeIndex--; paint(); }
      if (e.key === 'Enter') {
        const url = PAGES[((activeIndex % N) + N) % N].url;
        if (url !== '#') navigate(resolveUrl(url));
      }
      // number key → spin to that page and go, like the side shortcuts
      if (/^[0-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10);
        if (idx < N) { e.preventDefault(); goTo(idx); }
      }
    });

    const logoLink = document.querySelector('.nav-logo-link');
    if (logoLink) {
      logoLink.addEventListener('click', e => { e.preventDefault(); toggle(); });
    }

    // Right cluster: [sun] [esc hint] [hamburger]. Grouping them lets the nav's
    // space-between keep the logo pinned left and this trio pinned right; the sun
    // sits to the LEFT of the esc hint (desktop) and the hamburger (mobile).
    const navInner = document.querySelector('.nav-inner');
    if (navInner) {
      let cluster = navInner.querySelector('.nav-right');
      if (!cluster) {
        cluster = document.createElement('span');
        cluster.className = 'nav-right';
        const hint = navInner.querySelector('.nav-hint');
        if (hint) cluster.appendChild(hint);          // move the esc hint into the cluster
        navInner.appendChild(cluster);
      }

      // The sky-status sun — every main page EXCEPT labs (white tool zone) and the
      // index itself (it already IS the live sky; no need to report on it there).
      if (!IN_LABS && thisPage() !== 'index.html') {
        const sunBtn = document.createElement('button');
        sunBtn.className = 'nav-sun';
        sunBtn.setAttribute('aria-label', 'Sky status');
        sunBtn.innerHTML = SUN_SVG;
        sunBtn.addEventListener('click', openSky);
        cluster.insertBefore(sunBtn, cluster.firstChild);   // left of esc / hamburger
        skyBtn = sunBtn;                                     // anchor the window to it
      }

      const hamburger = document.createElement('button');
      hamburger.className = 'nav-hamburger-mobile';
      hamburger.textContent = '☰';
      hamburger.setAttribute('aria-label', 'Menu');
      hamburger.addEventListener('click', toggle);
      cluster.appendChild(hamburger);                  // rightmost
    }

    document.querySelectorAll('.nav-hint').forEach(el => {
      el.addEventListener('click', () => toggle());
    });

    document.documentElement.classList.remove('js-loading');
  }

  function paint() {
    document.getElementById('nav-items').style.transform =
      'translateY(-50%) rotateX(' + (activeIndex * getStep()) + 'deg)';

    slotEls.forEach((el, i) => {
      let offset = baseIndex[i] - activeIndex;
      offset = ((offset + HALF) % TOTAL_SLOTS + TOTAL_SLOTS) % TOTAL_SLOTS - HALF;
      baseIndex[i] = activeIndex + offset;
      el.style.transform = 'rotateX(' + (-baseIndex[i] * getStep()) + 'deg) translateZ(' + WHEEL_R + 'px)';

      const pageIdx = ((baseIndex[i] % N) + N) % N;
      el._numEl.innerHTML     = gcText(PAGES[pageIdx].num);
      el._titleEl.textContent = PAGES[pageIdx].title;
      el._descEl.textContent  = PAGES[pageIdx].desc;

      el.style.opacity = String(Math.max(0, 1 - Math.abs(offset) * 0.2));
      el.classList.toggle('act', offset === 0);
    });

    if (shortcutEls.length) {
      const act = ((activeIndex % N) + N) % N;
      shortcutEls.forEach((el, i) => el.classList.toggle('sc-act', i === act));
    }
  }

  // Spin the barrel to a page then navigate (used by the desktop shortcut panel)
  function goTo(t) {
    if (PAGES[t].url === '#') return;
    const url = resolveUrl(PAGES[t].url);
    const mod = ((activeIndex % N) + N) % N;
    let delta = ((t - mod) % N + N) % N;
    if (delta > N / 2) delta -= N;
    if (delta === 0) { navigate(url); return; }
    activeIndex += delta; paint();
    setTimeout(() => { navigate(url); }, 540);
  }

  function toggle() { isOpen ? close() : open(); }

  // ── Sky status modal (the sun button) ───────────────────────────────────────
  const SUN_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<circle cx="12" cy="12" r="4.1" fill="currentColor" stroke="none"/>' +
    '<line x1="12" y1="1.4" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.6"/>' +
    '<line x1="1.4" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.6" y2="12"/>' +
    '<line x1="4.3" y1="4.3" x2="6.1" y2="6.1"/><line x1="17.9" y1="17.9" x2="19.7" y2="19.7"/>' +
    '<line x1="4.3" y1="19.7" x2="6.1" y2="17.9"/><line x1="17.9" y1="6.1" x2="19.7" y2="4.3"/></svg>';

  const MOON_EMOJI = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
  function moonName(phase) {            // phase: 0/1 = new, .5 = full
    const p = ((phase % 1) + 1) % 1;
    if (p < 0.03 || p >= 0.97) return 'New moon';
    if (p < 0.22) return 'Waxing crescent';
    if (p < 0.28) return 'First quarter';
    if (p < 0.47) return 'Waxing gibbous';
    if (p < 0.53) return 'Full moon';
    if (p < 0.72) return 'Waning gibbous';
    if (p < 0.78) return 'Last quarter';
    return 'Waning crescent';
  }
  function moonEmoji(phase) { return MOON_EMOJI[Math.round((((phase % 1) + 1) % 1) * 8) % 8]; }

  // ── Simulation math for dev theme jumps on non-index pages ─────────────────
  // Mirrors the index.html ocean formulas so the sky-orbit animates realistically.
  const _SIM = (function () {
    const MC = 29.53, YD = 365;
    const ML = [31,28,31,30,31,30,31,31,30,31,30,31];
    const SE = ['❄️','❄️','🌸','🌸','🌸','☀️','☀️','☀️','🍂','🍂','🍂','❄️'];
    const S4 = ['winter','winter','spring','spring','spring','summer','summer','summer','autumn','autumn','autumn','winter'];
    const SN = ['겨울','겨울','봄','봄','봄','여름','여름','여름','가을','가을','가을','겨울'];
    function lerp(a,b,t){ return a+(b-a)*t; }
    function bodyAt(hr,T,D,P){
      let H=hr-T; H=((H+12)%24+24)%24-12;
      const half=D/2;
      if(Math.abs(H)<half) return {elev:P*Math.cos(Math.PI*H/D),up:true};
      const nh=(Math.abs(H)-half)/(12-half);
      return {elev:-0.30*Math.sin(Math.PI/2*nh),up:false};
    }
    function sunEl(sN){ return {T:12,D:12+3.2*sN,P:lerp(0.52,0.92,(sN+1)/2)}; }
    function moonEl(sN,ph){
      const mD=sN*Math.cos(2*Math.PI*ph);
      return {T:12+ph*24+3.2,D:12+3.2*mD,P:lerp(0.52,0.92,(mD+1)/2)};
    }
    function upF(e){ return Math.max(0,Math.min(1,(e+0.14)*5.5)); }
    function sceneAt(d, moonRef) {
      const tod=((d%1)+1)%1, dayP=((d%YD)+YD)%YD, di=Math.floor(dayP);
      const sN=-Math.cos(2*Math.PI*(di+10)/YD), s01=(sN+1)/2;
      const sr=6-1.6*sN, ss=18+1.6*sN, hr=tod*24;
      const phase=(((d-moonRef)/MC)%1+1)%1;
      const moonIllum=(1-Math.cos(2*Math.PI*phase))/2;
      const sB=bodyAt(hr,sunEl(sN).T,sunEl(sN).D,sunEl(sN).P);
      const mB=bodyAt(hr,moonEl(sN,phase).T,moonEl(sN,phase).D,moonEl(sN,phase).P);
      const sunUp=upF(sB.elev), moonUp=upF(mB.elev);
      const eq=Math.max(0,1-Math.abs(2*s01-1)/0.12);
      const nN=Math.max(0,1-Math.min(phase,1-phase)/0.06);
      const nF=Math.max(0,1-Math.abs(phase-0.5)/0.06);
      const solarEcl=nN*eq*sunUp*moonUp*0.9, lunarEcl=nF*eq*moonUp*(1-sunUp);
      const yf=dayP/YD; let rem=di,mo=0;
      while(mo<11&&rem>=ML[mo]){rem-=ML[mo];mo++;}
      return {hour:hr,sr,ss,moonIllum,solarEcl,lunarEcl,truePhase:phase,
              timeOfDay:tod,yearFrac:yf,month:mo+1,day:rem+1,
              seasonEmoji:SE[mo],season:SN[mo],season4:S4[mo],savedAt:Date.now()};
    }
    function findNext(startD, target, moonRef) {
      // First moment the target theme occurs → land at the midpoint of that
      // block (its peak). Small MIN so we never skip the nearest occurrence.
      const T=window.LlucTheme; if(!T) return null;
      const STEP=1/48, MIN=0.25;
      for(let d=startD+MIN;d<startD+2000;d+=STEP){
        if(T.resolve(sceneAt(d,moonRef))===target){
          let e=d+STEP;
          while(e<startD+2000 && T.resolve(sceneAt(e,moonRef))===target) e+=STEP;
          return (d+e)*0.5;
        }
      }
      return null;
    }
    function fromScene(scene) {
      if(!scene) return null;
      let doy=(scene.day||1)-1; const mo=(scene.month||1)-1;
      for(let m=0;m<mo;m++) doy+=ML[m];
      const ageSec=Math.max(0,(Date.now()-(scene.savedAt||Date.now()))/1000);
      const hr=((scene.hour||12)+ageSec/600)%24;
      const days=doy+hr/24;
      const phase=scene.truePhase!=null?scene.truePhase:0.5;
      return {days, moonRef:days-phase*MC};
    }
    return {sceneAt, findNext, fromScene};
  })();

  let _devJumpRunning = false;  // block concurrent dev jumps on non-index pages

  // Smoothly hand the foliage from one season to the next via a CROSSFADE — the
  // tree never disappears. We snapshot the current tree's pixels into a ghost
  // layered exactly on top, rebuild the real tree to the new season UNDERNEATH
  // (so it's already drawing), then dissolve the ghost away. No gap, no flash.
  function _fadeRegenTree(newSeason) {
    const swap = () => {
      if (navTree       && navTree.setSeason)       navTree.setSeason(newSeason);
      if (window.meTree && window.meTree.setSeason) window.meTree.setSeason(newSeason);
    };
    const cv = document.getElementById('tree');
    const r  = cv && cv.getBoundingClientRect();
    if (!cv || !cv.width || !r || !r.width) { swap(); return; }  // no visible tree → just rebuild

    let ghost;
    try {
      ghost = document.createElement('canvas');
      ghost.width = cv.width; ghost.height = cv.height;
      ghost.getContext('2d').drawImage(cv, 0, 0);     // freeze the old foliage
    } catch (e) { swap(); return; }
    const cs = getComputedStyle(cv);
    ghost.style.cssText =
      'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;' +
      'width:' + r.width + 'px;height:' + r.height + 'px;' +
      'z-index:' + (cs.zIndex === 'auto' ? '0' : cs.zIndex) + ';' +
      'pointer-events:none;opacity:' + (cs.opacity || '1') + ';transition:opacity 1.4s ease;';
    cv.parentNode.insertBefore(ghost, cv.nextSibling);

    swap();                                            // new season draws under the ghost

    requestAnimationFrame(() => requestAnimationFrame(() => { ghost.style.opacity = '0'; }));
    setTimeout(() => ghost.remove(), 1600);
  }

  // Two-phase orbit animation for non-index pages — mirrors the index's dev jump.
  // Phase 1 (PHASE1): the time-of-day hand rotates to the target hour (axial spin).
  // Phase 2 (PHASE2): the orbit ring advances whole days to the target date/season,
  // the hand frozen. Both phases are LINEAR (no easing → no slideshow stutter at the
  // Math.floor edges). The theme colour switches ONCE at the start.
  function _devJumpNonIndex(targetTheme) {
    if(_devJumpRunning) return;
    const T=window.LlucTheme; if(!T) return;
    const sim=_SIM.fromScene(T.readScene());
    if(!sim) return;
    const targetDays=_SIM.findNext(sim.days,targetTheme,sim.moonRef);
    if(!targetDays) return;   // theme not found within the scan window (unreachable in practice)
    _devJumpRunning=true;
    // Pause storage-event refresh so the index writing localStorage every 400 ms
    // can't override the target theme while the animation is running.
    T.pauseRefresh();
    T.apply(targetTheme,true);
    const fromDays=sim.days;
    const fromSeason  =_SIM.sceneAt(fromDays,   sim.moonRef).season4;
    const fromHour  =((fromDays   %1)+1)%1;
    const toHour    =((targetDays %1)+1)%1;
    const hourTravel= toHour>=fromHour ? toHour-fromHour : 1-fromHour+toHour;
    // 1 full revolution + remaining arc — always a visible axial spin.
    const phase1End = fromDays+1+hourTravel;
    const fraction  =((phase1End%1)+1)%1;
    const fromInt   = Math.floor(phase1End);
    const toInt     = Math.floor(targetDays+(fraction-(((targetDays%1)+1)%1)));
    const dayRange  = Math.max(1, toInt-fromInt);
    // Phase 2 paced at ~22 ms PER WHOLE DAY (no fixed floor) so each Math.floor
    // step is a quick ~1° orbit tick — continuous motion, not a slideshow — and
    // short hops finish fast. Mirrors the index's _devJumpTheme exactly.
    const PHASE1 = Math.max(1200, Math.min(4000, ((1+hourTravel)/0.8*1000)|0));
    const PHASE2 = Math.max(120, Math.min(8000, (dayRange*22)|0));
    const startMs=performance.now();
    clearInterval(skyTimer); skyTimer=null;
    let curSeason=fromSeason;
    function frame(){
      const elapsed=performance.now()-startMs;
      let simDays;
      if(elapsed<PHASE1){
        const t=Math.min(1,elapsed/PHASE1);
        simDays=fromDays+(phase1End-fromDays)*t;
      } else {
        const t=Math.min(1,(elapsed-PHASE1)/PHASE2);
        // Integer-only day advance keeps the hour-hand frozen.
        const intAdv=Math.floor((toInt-fromInt)*t);
        simDays=fromInt+intAdv+fraction;
      }
      const sc=_SIM.sceneAt(simDays,sim.moonRef);
      // Fade the foliage over EXACTLY when the simulated season rolls over —
      // not on click — so the tree changes as the world reaches that season.
      if(sc.season4!==curSeason){ curSeason=sc.season4; _fadeRegenTree(sc.season4); }
      if(skyModal) fillSky(sc);
      if(elapsed<PHASE1+PHASE2){ requestAnimationFrame(frame); return; }
      _devJumpRunning=false;
      try{ localStorage.setItem('lluc.scene',JSON.stringify(sc)); }catch(e){}
      T.resumeRefresh();  // re-enables storage/interval theme updates
      if(skyModal&&skyModal.classList.contains('open'))
        skyTimer=setInterval(fillSky,1000);
    }
    requestAnimationFrame(frame);
  }

  let skyModal = null, skyTimer = null, skyBtn = null;
  function openSky() {
    if (!skyModal) buildSky();
    fillSky();
    // anchor the window just below + right-aligned to the sun button that opens
    // it, and reset to that spot on every open (even after a previous drag)
    const win = skyModal.querySelector('.sky-win');
    if (skyBtn && win) {
      const r = skyBtn.getBoundingClientRect();
      win.style.left = 'auto';
      win.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      win.style.top = (r.bottom + 10) + 'px';
    }
    skyModal.classList.add('open');
    clearInterval(skyTimer);
    skyTimer = setInterval(fillSky, 1000);     // tick the slow clock while open
  }
  function closeSky() { if (skyModal) skyModal.classList.remove('open'); clearInterval(skyTimer); skyTimer = null; }
  function buildSky() {
    skyModal = document.createElement('div');
    skyModal.id = 'sky-modal';
    skyModal.innerHTML =
      '<div class="sky-win" role="dialog" aria-label="Sky status">' +
        '<div class="sky-bar"><span class="sky-close" title="close"></span>' +
          '<span class="sky-bartitle">sky · now</span><span class="sky-barspacer"></span></div>' +
        '<div class="sky-body">' +
          '<svg class="sky-orbit" viewBox="0 0 100 100"></svg>' +
          '<div class="sky-row"><span class="sky-k">Time</span><span class="sky-v sky-time" data-f="time">—</span></div>' +
          '<div class="sky-row"><span class="sky-k">Earth</span><span class="sky-v" data-f="earth">—</span></div>' +
          '<div class="sky-row"><span class="sky-k">Season</span><span class="sky-v" data-f="season">—</span></div>' +
          '<div class="sky-row"><span class="sky-k">Moon</span><span class="sky-v" data-f="moon">—</span></div>' +
          '<button class="sky-go">change</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(skyModal);
    skyModal.addEventListener('click', e => { if (e.target === skyModal) closeSky(); });  // mobile: tap outside
    skyModal.querySelector('.sky-close').addEventListener('click', closeSky);
    skyModal.querySelector('.sky-go').addEventListener('click', () => { navigate(resolveUrl('index.html')); });

    // Drag the window by its bar (desktop) — same feel as the project windows.
    const win = skyModal.querySelector('.sky-win');
    const bar = skyModal.querySelector('.sky-bar');
    let dragging = false, ox = 0, oy = 0;
    bar.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('sky-close')) return;
      dragging = true; bar.classList.add('grab');
      const r = win.getBoundingClientRect();
      win.style.left = r.left + 'px'; win.style.top = r.top + 'px'; win.style.right = 'auto';
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', e => {
      if (!dragging) return;
      const x = Math.max(4, Math.min(window.innerWidth - 60, e.clientX - ox));
      const y = Math.max(4, Math.min(window.innerHeight - 38, e.clientY - oy));
      win.style.left = x + 'px'; win.style.top = y + 'px';
    });
    const endDrag = () => { dragging = false; bar.classList.remove('grab'); };
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    const DEV_CYCLE = ['day', 'eclipse-day', 'sunset', 'blood-moon', 'full-moon', 'moon', 'new-moon', 'dawn'];
    skyModal.querySelector('.sky-orbit').addEventListener('click', function () {
      const cur = document.documentElement.dataset.theme || 'day';
      const next = DEV_CYCLE[(DEV_CYCLE.indexOf(cur) + 1) % DEV_CYCLE.length];
      if (window._devJumpTheme) {
        window._devJumpTheme(next);
      } else {
        // Persist an immediate target scene so navigation away keeps the choice
        try {
          const T = window.LlucTheme;
          if (T && _SIM) {
            const sim = _SIM.fromScene(T.readScene());
            if (sim) {
              const targetDays = _SIM.findNext(sim.days, next, sim.moonRef);
              if (targetDays != null) {
                const sc = _SIM.sceneAt(targetDays, sim.moonRef);
                try { localStorage.setItem('lluc.scene', JSON.stringify(sc)); } catch (e) {}
              }
            }
          }
        } catch (e) { /* ignore storage errors */ }
        _devJumpNonIndex(next);
      }
    });
  }
  function fillSky(override) {
    if (!skyModal || !window.LlucTheme) return;
    const s = override || LlucTheme.readScene();
    const set = (f, html) => { const el = skyModal.querySelector('[data-f="' + f + '"]'); if (el) el.innerHTML = html; };
    const orbit = skyModal.querySelector('.sky-orbit');

    if (!s) {
      set('time', '—'); set('earth', '—<small>visit index</small>');
      set('season', '—'); set('moon', '—'); orbit.innerHTML = '';
      return;
    }

    // the index sets the time; off it, the day drifts very slowly (see sceneHour)
    const hour = LlucTheme.sceneHour(s);
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
    set('time', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));

    // Earth riding its yearly orbit, with a bar through it for the time of day
    const yf = s.yearFrac != null ? s.yearFrac : 0;
    const a = yf * 2 * Math.PI - Math.PI / 2;
    const ex = 50 + 38 * Math.cos(a), ey = 50 + 38 * Math.sin(a);
    const ha = hour / 24 * 2 * Math.PI, hl = 7;
    orbit.innerHTML =
      '<circle class="o-ring" cx="50" cy="50" r="38"/>' +
      '<circle class="o-sun" cx="50" cy="50" r="3.4"/>' +
      '<line class="o-hand" x1="' + (ex - hl * Math.cos(ha)).toFixed(1) + '" y1="' + (ey - hl * Math.sin(ha)).toFixed(1) +
        '" x2="' + (ex + hl * Math.cos(ha)).toFixed(1) + '" y2="' + (ey + hl * Math.sin(ha)).toFixed(1) + '"/>' +
      '<circle class="o-earth" cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="4.4"/>';
    set('earth', Math.round(yf * 360) + '°<small>annual orbit</small>');

    set('season', s.seasonEmoji || '—');

    const phase = s.truePhase != null ? s.truePhase : 0.5;
    let moonHtml = moonEmoji(phase);
    if ((s.solarEcl || 0) > 0.45)      moonHtml += '<small class="sky-ecl">☀ solar eclipse</small>';
    else if ((s.lunarEcl || 0) > 0.40) moonHtml += '<small class="sky-ecl">🌑 lunar eclipse</small>';
    set('moon', moonHtml);
  }

  // ── A freshly-grown tree behind the menu (desktop only) ──
  let navTree = null, navTreeCanvas = null, navMouse = null;
  function ensureTree(cb) {
    if (window.LlucTree) return cb();
    let s = document.querySelector('script[data-lluc-tree]');
    if (s) { s.addEventListener('load', cb); return; }
    s = document.createElement('script');
    s.src = ASSETS + 'tree.js'; s.setAttribute('data-lluc-tree', '');
    s.addEventListener('load', cb);
    document.head.appendChild(s);
  }
  function openNavTree() {
    if (IN_LABS) return;                                  // labs menu stays bare (hazard tape, no tree)
    const overlay = document.getElementById('nav-overlay');
    const mob = window.innerWidth <= 768;
    ensureTree(() => {
      if (!isOpen || navTree) return;
      navTreeCanvas = document.createElement('canvas');
      navTreeCanvas.id = 'nav-tree';
      overlay.insertBefore(navTreeCanvas, overlay.firstChild);
      navTree = LlucTree.create(navTreeCanvas, {
        leaves: true, sensitivity: 1.3, branchVariety: true, leafBunch: 4,
        season: ((window.LlucTheme && LlucTheme.readScene()) || {}).season4 || 'summer',

        // desktop: big tree, trunk ~2/3 right · mobile: centred tree filling the freed bottom
        baseLen: (W, H) => mob ? Math.min(H * 0.13, 130) : Math.min(H * 0.27, 280),
        layout: (W, H) => mob ? { rootX: W * 0.5, rootY: H * 1.0 } : { rootX: W * 0.66, rootY: H * 1.0 }
      });
      navMouse = e => { if (navTree) navTree.setMouse(e.clientX / window.innerWidth); };
      overlay.addEventListener('pointermove', navMouse, { passive: true });
    });
  }
  function closeNavTree() {
    const overlay = document.getElementById('nav-overlay');
    if (navMouse) { overlay.removeEventListener('pointermove', navMouse); navMouse = null; }
    if (navTree) { navTree.destroy(); navTree = null; }
    if (navTreeCanvas) { navTreeCanvas.remove(); navTreeCanvas = null; }
  }

  function open() {
    isOpen = true;
    activeIndex = currentPage();
    paint();
    document.getElementById('nav-overlay').classList.add('open');
    lockScroll();
    openNavTree();
    // let pages pause their own background animations while the menu is up
    document.dispatchEvent(new CustomEvent('lluc:menu', { detail: { open: true } }));
  }

  function close() {
    isOpen = false;
    document.getElementById('nav-overlay').classList.remove('open');
    unlockScroll();
    closeNavTree();
    document.dispatchEvent(new CustomEvent('lluc:menu', { detail: { open: false } }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
}());
