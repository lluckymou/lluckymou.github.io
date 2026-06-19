'use strict';

/* ── lluc.dev time-of-day theming ─────────────────────────────────────────────
   The index page runs a full sun/moon simulation and persists a snapshot of the
   current sky to localStorage ("lluc.scene"). Every OTHER main-world page reads
   that snapshot and dresses itself in a matching palette, so the whole site
   breathes with the same day the visitor left running on the home page.

   The clock keeps moving even while you read: we advance the saved hour at the
   index's own pace (1 real second = 1 sim minute), so a long read can carry you
   from afternoon into sunset into night. Moon phase + eclipses come straight from
   the snapshot (they're either slow or momentary, not worth re-simulating here).

   Themes:
     day         whitemode — bright cream daylight
     dawn        glossy light gradient (warm yellow → soft blue)
     sunset      glossy deep gradient (orange → purple)
     eclipse-day dracula — a solar eclipse swallows the day
     blood-moon  reddish dark — a lunar eclipse (night eclipse)
     full-moon   soft dark mode (the moon lights the night)
     new-moon    deepest dark mode (a moonless night)
     moon        neutral dark mode (any other lunar phase)
*/
(function () {
  const DEFAULT = 'day';

  function readScene() {
    try { return JSON.parse(localStorage.getItem('lluc.scene')); }
    catch (e) { return null; }
  }

  // The current clock hour for a snapshot. Off the index the day still turns,
  // but VERY slowly — 10 real seconds = 1 sim minute (a full day ≈ 4 real
  // hours). The index sets the starting time; everywhere else drifts from it.
  function sceneHour(scene, now) {
    if (!scene) return null;
    now = now || Date.now();
    const ageSec = Math.max(0, (now - (scene.savedAt || now)) / 1000);
    const h = (scene.hour != null ? scene.hour : 12) + ageSec / 600;
    return ((h % 24) + 24) % 24;
  }

  // Resolve a theme key from a scene snapshot.
  function resolve(scene, now) {
    if (!scene) return DEFAULT;

    if ((scene.solarEcl || 0) > 0.45) return 'eclipse-day';
    if ((scene.lunarEcl || 0) > 0.40) return 'blood-moon';

    const hour = sceneHour(scene, now);

    const sr = scene.sr != null ? scene.sr : 6;   // seasonal sunrise
    const ss = scene.ss != null ? scene.ss : 18;  // seasonal sunset

    if (hour >= sr - 0.8 && hour < sr + 1.4) return 'dawn';
    if (hour >= sr + 1.4 && hour < ss - 1.4) return 'day';
    if (hour >= ss - 1.4 && hour < ss + 1.0) return 'sunset';

    // night → flavoured by the moon's lit fraction (0 new … 1 full)
    const il = scene.moonIllum != null ? scene.moonIllum : 0;
    if (il > 0.82) return 'full-moon';
    if (il < 0.10) return 'new-moon';
    return 'moon';
  }

  let current = null;
  let varCache = {};
  let _transTimer = null;
  let _liveReady = false;    // true once init() has finished its first refresh
  let _refreshPaused = false; // set by pauseRefresh() to block storage/interval updates
  let _bgOverlayOff = false;  // the index drives visuals via its canvas — no body crossfade

  // CSS can transition a background COLOUR but not a background gradient, so the
  // glossy themes (dawn, sunset) would otherwise snap in/out. To crossfade them
  // we snapshot the OLD background into a layer pinned BEHIND all page content
  // and dissolve it out, letting the new background show through underneath.
  //
  // For that layer to sit IN FRONT of the body's (new) background yet BEHIND the
  // content, <body> must be its own stacking context — otherwise a z-index:-1
  // child paints behind the body's own opaque background and is never seen.
  // `isolation: isolate` makes body a stacking context with zero layout impact.
  function _bgCrossfade() {
    if (_bgOverlayOff || !document.body) return;
    document.body.style.isolation = 'isolate';
    const cs  = getComputedStyle(document.body);
    const img = cs.backgroundImage, col = cs.backgroundColor;
    const ov = document.createElement('div');
    ov.style.cssText =
      'position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:1;' +
      'background-color:' + col + ';' +
      (img && img !== 'none' ? 'background-image:' + img + ';' : '') +
      'transition:opacity 5s ease;';
    document.body.appendChild(ov);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { ov.style.opacity = '0'; });
    });
    setTimeout(function () { ov.remove(); }, 5400);
  }

  function apply(key, animate) {
    if (!key || key === current) return;
    if (animate && _liveReady && current) _bgCrossfade();   // capture OLD bg before the flip
    current = key;
    if (animate && _liveReady) {
      document.documentElement.classList.add('theme-transitioning');
      clearTimeout(_transTimer);
      _transTimer = setTimeout(function () {
        document.documentElement.classList.remove('theme-transitioning');
      }, 11000);
    } else if (!_liveReady) {
      // Suppress the base CSS transitions during the very first apply so the page
      // opens already at the correct colour — no default-to-themed fade on load.
      document.documentElement.classList.add('theme-no-transition');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          document.documentElement.classList.remove('theme-no-transition');
        });
      });
    }
    document.documentElement.dataset.theme = key;
    varCache = {};                 // palette changed → drop cached token reads
  }

  // Read a themed CSS custom property (cached until the theme flips). Lets the
  // canvas effects — the cursor "wind" trails — recolour with the palette
  // without hammering getComputedStyle every frame.
  function cssVar(name, fallback) {
    if (varCache[name] == null) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      varCache[name] = v || fallback || '';
    }
    return varCache[name];
  }

  function refresh() { if (_refreshPaused) return; apply(resolve(readScene(), Date.now()), true); }
  function pauseRefresh()  { _refreshPaused = true;  }
  function resumeRefresh() { _refreshPaused = false; refresh(); }

  // The index drives this directly from its render loop with LIVE sim values,
  // so the nav + ESC menu track the sky frame-for-frame as you scrub time.
  function applyLive(sceneLike) {
    // When the index (or any live driver) publishes a live scene, enable
    // live transitions and apply with animation so the chrome crossfades.
    _liveReady = true; // ensure live-mode transitions are active for apply()
    apply(resolve(Object.assign({ savedAt: Date.now() }, sceneLike), Date.now()), true);
  }

  function init(opts) {
    opts = opts || {};
    refresh();           // _liveReady is still false here → no animation class
    _liveReady = true;   // from here on, theme changes while live get the 10s fade
    if (opts.live === false) { _bgOverlayOff = true; return; } // index drives applyLive
    // re-resolve periodically so the slow drift rolls the palette over the bands
    setInterval(refresh, opts.interval || 15000);
    window.addEventListener('storage', function (e) { if (e.key === 'lluc.scene') refresh(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
  }

  // Apply an initial theme synchronously at parse time → no flash of the wrong
  // palette before the page reveals. Pages still call init() for live updates.
  try { refresh(); } catch (e) { /* no storage — stays on the default */ }

  window.LlucTheme = { resolve, sceneHour, apply, refresh, applyLive, init, readScene, cssVar, DEFAULT, pauseRefresh, resumeRefresh };
})();
