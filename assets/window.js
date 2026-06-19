'use strict';

/* Lightweight OS-style window viewer.
   LlucWindow.open({ title, url, banner })
   - Desktop only (caller decides; on mobile, navigate/open-tab instead).
   - Draggable by the title bar. Click to focus (raise z-index).
   - ✕ closes. ⤢ pops the page out to a new tab (and closes the window).
   - The page loads in an <iframe>; if it never loads within a timeout
     (e.g. blocked by X-Frame-Options), it falls back to an "open in a new
     tab" panel so the user is never stuck.
   - A url of '' or '#' renders a "coming soon" panel (chrome still works). */
(function () {
  let zTop = 3000;
  let opened = 0;
  let styled = false;

  function injectStyle() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = `
.lw-win {
  position: fixed; width: 640px; max-width: calc(100vw - 32px);
  height: 460px; max-height: calc(100vh - 32px);
  background: var(--bg-solid, #f2f0eb); border: 1px solid rgb(var(--ink, 0 0 0) / .4);
  box-shadow: 0 24px 60px rgba(0,0,0,.28), 0 2px 0 rgb(255 255 255 / .14) inset;
  color: rgb(var(--ink, 0 0 0));
  display: flex; flex-direction: column; overflow: hidden;
  border-radius: 8px; animation: lw-pop .22s cubic-bezier(.23,1,.32,1);
}
@keyframes lw-pop { from { opacity: 0; transform: scale(.96) translateY(8px); } }
.lw-bar {
  flex: 0 0 auto; height: 38px; display: flex; align-items: center;
  padding: 0 12px; gap: 10px; cursor: grab; user-select: none;
  background: linear-gradient(rgb(var(--ink, 0 0 0) / .05), rgb(var(--ink, 0 0 0) / .1));
  border-bottom: 1px solid rgb(var(--ink, 0 0 0) / .18);
}
.lw-bar.lw-grab { cursor: grabbing; }
.lw-dots { display: flex; gap: 8px; flex: 0 0 auto; }
.lw-dot {
  width: 14px; height: 14px; border-radius: 50%; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; color: rgba(0,0,0,0); line-height: 1; border: 1px solid rgb(0 0 0 / .18);
}
.lw-dot:hover { filter: brightness(.82); }
.lw-close { background: #ff5f57; }
.lw-max   { background: #28c840; }
.lw-title {
  flex: 1 1 auto; text-align: center; font-family: 'Paperlogy', sans-serif;
  font-size: .8rem; color: rgb(var(--ink, 0 0 0)); white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; opacity: .8;
}
.lw-spacer { flex: 0 0 44px; }
.lw-body { flex: 1 1 auto; position: relative; background: #fff; overflow: hidden; }
.lw-frame { width: 100%; height: 100%; border: 0; display: block; }
.lw-loader {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: var(--bg-solid, #f2f0eb);
}
.lw-spin {
  width: 20px; height: 20px; border: 1.5px solid rgb(var(--ink, 0 0 0) / .12);
  border-top-color: rgb(var(--ink, 0 0 0) / .4); border-radius: 50%;
  animation: lw-spin .65s linear infinite;
}
@keyframes lw-spin { to { transform: rotate(360deg); } }
.lw-fallback {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px; text-align: center;
  padding: 24px; background: var(--bg-solid, #f2f0eb); font-family: 'Paperlogy', sans-serif;
}
.lw-fallback img {
  width: 100%; max-width: 320px; aspect-ratio: 4/3; object-fit: cover;
  border: 1px solid rgb(var(--ink, 0 0 0) / .2); border-radius: 4px;
}
.lw-fallback p { margin: 0; color: rgb(var(--ink, 0 0 0) / .62); font-size: .85rem; }
.lw-open {
  font-family: 'Paperlogy', sans-serif; font-size: .82rem; cursor: pointer;
  background: rgb(var(--ink, 0 0 0)); color: var(--bg-solid, #f2f0eb); border: none; padding: 8px 18px;
  border-radius: 3px; transition: opacity .2s;
}
.lw-open:hover { opacity: .75; }
.lw-resize {
  position: absolute; right: 0; bottom: 0; width: 18px; height: 18px;
  cursor: nwse-resize; z-index: 4; touch-action: none;
  background: linear-gradient(135deg, transparent 0 48%, rgb(var(--ink, 0 0 0) / .3) 48% 56%, transparent 56% 66%, rgb(var(--ink, 0 0 0) / .3) 66% 74%, transparent 74%);
}
.lw-soon { font-size: .62rem; letter-spacing: .22em; text-transform: uppercase; color: #8a6d00;
  background: repeating-linear-gradient(45deg,#f3e08a 0 6px,#e8c200 6px 12px); padding: 3px 9px; border-radius: 2px; }
`;
    document.head.appendChild(s);
  }

  function open(opts) {
    injectStyle();
    const real = opts.url && opts.url !== '#';

    const win = document.createElement('div');
    win.className = 'lw-win';
    win.style.zIndex = ++zTop;
    // caller may pin an exact size/position (e.g. me.html's focused viewer); else cascade
    if (opts.width)  win.style.width  = opts.width  + 'px';
    if (opts.height) win.style.height = opts.height + 'px';
    if (opts.left != null && opts.top != null) {
      win.style.left = opts.left + 'px';
      win.style.top  = opts.top  + 'px';
    } else {
      const off = (opened % 5) * 26;
      win.style.left = `calc(50% - 320px + ${off}px)`;
      win.style.top  = `calc(50% - 230px + ${off}px)`;
    }
    opened++;

    const bar = document.createElement('div'); bar.className = 'lw-bar';
    bar.innerHTML =
      `<div class="lw-dots"><span class="lw-dot lw-close" title="close">✕</span>` +
      (real ? `<span class="lw-dot lw-max" title="open in new tab">⤢</span>` : ``) +
      `</div><div class="lw-title"></div><div class="lw-spacer"></div>`;
    bar.querySelector('.lw-title').textContent = opts.title || '';

    const body = document.createElement('div'); body.className = 'lw-body';
    const grip = document.createElement('div'); grip.className = 'lw-resize'; grip.title = 'resize';
    win.appendChild(bar); win.appendChild(body); win.appendChild(grip);
    document.body.appendChild(win);
    let frameEl = null;

    let closed = false;
    function close() { if (closed) return; closed = true; win.remove(); if (opts.onClose) opts.onClose(); }
    function popOut() { if (!real) return; window.open(opts.url, '_blank', 'noopener'); close(); }
    function moveBy(dx, dy) {                         // keyboard nudging - glides to the new spot
      const r = win.getBoundingClientRect();
      const x = Math.max(4, Math.min(window.innerWidth - 60, r.left + dx));
      const y = Math.max(4, Math.min(window.innerHeight - 38, r.top + dy));
      win.style.transition = 'left .18s ease, top .18s ease';
      win.style.left = x + 'px'; win.style.top = y + 'px';
      win.style.right = 'auto'; win.style.bottom = 'auto';
    }
    const api = { el: win, isReal: real, close, popOut, moveBy, focus() { win.style.zIndex = ++zTop; } };

    // Resize from the bottom-right corner
    let rz = false, rw = 0, rh = 0, rsx = 0, rsy = 0;
    grip.addEventListener('pointerdown', e => {
      e.stopPropagation(); rz = true;
      win.style.transition = 'none';                 // mouse interaction is instant, not glided
      const r = win.getBoundingClientRect();
      rw = r.width; rh = r.height; rsx = e.clientX; rsy = e.clientY;
      win.style.left = r.left + 'px'; win.style.top = r.top + 'px';
      win.style.right = 'auto'; win.style.bottom = 'auto';
      if (frameEl) frameEl.style.pointerEvents = 'none';
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', e => {
      if (!rz) return;
      win.style.width = Math.max(300, rw + (e.clientX - rsx)) + 'px';
      win.style.height = Math.max(220, rh + (e.clientY - rsy)) + 'px';
    });
    function endRz() { rz = false; if (frameEl) frameEl.style.pointerEvents = ''; }
    grip.addEventListener('pointerup', endRz);
    grip.addEventListener('pointercancel', endRz);

    bar.querySelector('.lw-close').addEventListener('click', close);
    const maxBtn = bar.querySelector('.lw-max');
    if (maxBtn) maxBtn.addEventListener('click', popOut);

    // Focus → raise
    win.addEventListener('pointerdown', () => { win.style.zIndex = ++zTop; });

    // Drag by the bar
    let dx = 0, dy = 0, dragging = false;
    bar.addEventListener('pointerdown', e => {
      if (e.target.classList.contains('lw-dot')) return;
      dragging = true; bar.classList.add('lw-grab');
      win.style.transition = 'none';                 // dragging follows the cursor instantly
      const r = win.getBoundingClientRect();
      win.style.left = r.left + 'px'; win.style.top = r.top + 'px';
      win.style.right = 'auto'; win.style.bottom = 'auto';
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener('pointermove', e => {
      if (!dragging) return;
      let x = e.clientX - dx, y = e.clientY - dy;
      x = Math.max(4, Math.min(window.innerWidth - 60, x));
      y = Math.max(4, Math.min(window.innerHeight - 38, y));
      win.style.left = x + 'px'; win.style.top = y + 'px';
    });
    function endDrag() { dragging = false; bar.classList.remove('lw-grab'); }
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    if (!real) { renderSoon(body, opts); return api; }

    // Live iframe with timeout fallback
    body.innerHTML = `<div class="lw-loader"><span class="lw-spin"></span></div>`;
    const frame = document.createElement('iframe');
    frame.className = 'lw-frame';
    frame.src = opts.url;
    frameEl = frame;
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; renderFallback(body, opts); } }, 3500);
    frame.addEventListener('load', () => {
      if (settled) return; settled = true; clearTimeout(timer);
      const loader = body.querySelector('.lw-loader'); if (loader) loader.remove();
    });
    body.appendChild(frame);
    return api;
  }

  function hostOf(url) { try { return new URL(url, location.href).hostname; } catch (e) { return 'the site'; } }

  function renderFallback(body, opts) {
    body.innerHTML =
      `<div class="lw-fallback">` +
      (opts.banner ? `<img src="${opts.banner}" alt="" onerror="this.remove()">` : ``) +
      `<p>This one doesn't like being embedded.</p>` +
      `<button class="lw-open">open ${hostOf(opts.url)} ↗</button></div>`;
    body.querySelector('.lw-open').addEventListener('click', () => window.open(opts.url, '_blank', 'noopener'));
  }

  function renderSoon(body, opts) {
    body.innerHTML =
      `<div class="lw-fallback">` +
      (opts.banner ? `<img src="${opts.banner}" alt="" onerror="this.remove()">` : ``) +
      `<span class="lw-soon">coming soon</span>` +
      `<p>${opts.blurb || 'A write-up is on its way.'}</p></div>`;
  }

  window.LlucWindow = { open: open };
}());
