'use strict';

/* Reusable procedural tree that sways in the wind (canvas 2D, no deps).
   LlucTree.create(canvas, opts) → controller.

   opts:
     baseLen(W,H)   → trunk segment length (drives overall size). default min(H*0.2,175)
     layout(W,H)    → { rootX, rootY, trunkBaseX?, trunkBaseY? }
                      if trunkBaseY is given, a long trunk is drawn from
                      (trunkBaseX,trunkBaseY) up to the canopy root.
     leaves  (bool) → drifting leaves
     leafBunch (int)→ draw a cluster of up to ~N leaves at each tip (fuller canopy)
     minLeafLen     → stop branching once a segment is shorter than this (default 14)
     maxDepth       → hard cap on recursion depth (default 9)
     maxDPR         → clamp device-pixel-ratio of the backing store (default 2)
     maxPixels      → cap total backing-store pixels (fill-rate budget; default none)
     sky     (false | {stops:[[pos,color],...]}) → optional gradient backdrop
     sun     (bool) → soft glow (off by default - keep it simple)
     shadow  (bool) → ground shadow under a grounded tree
     branchColor / trunkColor → optional foreground colours for themed exports
     seed          → deterministic shape/foliage seed; omit for random generation
     sensitivity    → how strongly the pointer affects the wind (default 1)

   controller: { regenerate(), setDepth(n), setMouse(xFrac), gust(dx), destroy(), get wind() } */
(function () {
  function seedNumber(seed) {
    if (seed == null || seed === '') return (Math.random() * 0xffffffff) >>> 0;
    if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
    let hash = 2166136261;
    for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return hash >>> 0;
  }

  function makeRng(seed) {
    let value = seedNumber(seed);
    return function rng() {
      value = (value + 0x6D2B79F5) | 0;
      let t = Math.imul(value ^ value >>> 15, 1 | value);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const rand = (a, b, rng) => a + rng() * (b - a);

  // ── Seasonal foliage palettes ────────────────────────────────────────────────
  const LEAF   = ['rgba(122,140,72,0.50)', 'rgba(150,168,92,0.46)', 'rgba(186,160,70,0.50)', 'rgba(196,122,58,0.40)']; // summer
  const AUTUMN = ['rgba(202,92,38,0.55)', 'rgba(216,142,42,0.55)', 'rgba(178,58,38,0.5)', 'rgba(150,104,40,0.5)', 'rgba(120,70,34,0.5)'];
  const BROWN  = ['rgba(120,86,54,0.7)', 'rgba(96,68,44,0.72)', 'rgba(142,102,66,0.66)'];   // winter's few dead leaves
  const SPRING = ['rgba(126,176,92,0.5)', 'rgba(158,196,104,0.5)', 'rgba(104,166,84,0.5)']; // fresh greens
  const PINK   = ['rgba(255,170,200,0.82)', 'rgba(255,142,182,0.82)', 'rgba(255,196,216,0.85)']; // blossoms
  const SNOW   = 'rgba(245,248,255,0.92)';
  const pick = (a, rng) => a[rng() * a.length | 0];

  // One foliage point for a season → { col, kind } or null (a bare twig, winter).
  function pickLeaf(season, rng) {
    if (season === 'winter') {
      if (rng() < 0.5)  return null;                       // mostly bare
      if (rng() < 0.5)  return { col: SNOW, kind: 'snow' };// half the rest = snow
      return { col: pick(BROWN, rng), kind: 'leaf' };       // the other half = brown
    }
    if (season === 'autumn') return { col: pick(AUTUMN, rng), kind: 'leaf' };
    if (season === 'spring') return rng() < 0.3 ? { col: pick(PINK, rng), kind: 'flower' } : { col: pick(SPRING, rng), kind: 'leaf' };
    return { col: pick(LEAF, rng), kind: 'leaf' };           // summer
  }

  function makeNode(angle, len, depth, vary, lb, minLen, maxD, season, rng) {
    const node = { angle, len, depth, phase: rand(0, 6.283, rng), children: [] };
    if (len < minLen || depth > maxD) {
      node.leaf = true;
      if (lb) {                                   // a fuller cluster of leaves at each tip
        node.bunch = [];
        const cnt = 2 + (rng() * lb | 0);
        for (let k = 0; k < cnt; k++) {
          const lf = pickLeaf(season, rng);
          if (!lf) continue;                      // winter: leave the twig bare
          const a = rand(0, 6.283, rng), d = rand(0, 7, rng);
          node.bunch.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, rs: rand(0.65, 1.3, rng), col: lf.col, kind: lf.kind });
        }
      } else {
        node.lf = pickLeaf(season, rng);          // single leaf (may be null in winter)
      }
      return node;
    }
    const n = depth < 2 ? 2 : (rng() < 0.22 ? 3 : 2);
    const spread = rand(0.34, 0.62, rng);
    for (let i = 0; i < n; i++) {
      let off = n === 2 ? (i ? 1 : -1) * spread * rand(0.7, 1.1, rng) : (i - 1) * spread;
      off += rand(-0.1, 0.1, rng);
      // from the 2nd branch level, allow asymmetric cuts (≈½, ¼ …) per child for height/shape variety
      const ratio = (vary && depth >= 1)
        ? (rng() < 0.34 ? rand(0.28, 0.5, rng) : rand(0.55, 0.82, rng))
        : rand(0.68, 0.78, rng);
      node.children.push(makeNode(off, len * ratio, depth + 1, vary, lb, minLen, maxD, season, rng));
    }
    return node;
  }

  function create(canvas, opts) {
    opts = opts || {};
    const ctx = canvas.getContext('2d');
    const sens = opts.sensitivity || 1;
    const branchColor = opts.branchColor || null;
    const trunkColor = opts.trunkColor || 'hsl(28,30%,14%)';
    let season = opts.season || 'summer';       // 'winter'|'spring'|'summer'|'autumn'
    let seed = opts.seed;
    let maxDepth = opts.maxDepth == null ? 9 : opts.maxDepth;
    let rng = makeRng(seed);
    let W = 0, H = 0, DPR = 1, root = null, raf = null, running = true;
    let wind = 0.7, mouseX = 0.5, gust = 0, cycleProgress = null, cycleWind = 0;
    // Reused buckets for the hot path. Branch geometry still gets recomputed
    // every frame, but canvas state changes are batched by branch depth.
    const batch = { branches: [], trunk: [], leaves: [] };
    const drift = [];

    const baseLen = () => opts.baseLen ? opts.baseLen(W, H) : Math.min(H * 0.2, 175);
    const spawn = () => {
      const lf = pickLeaf(season, rng) || { col: SNOW, kind: 'snow' };   // winter bare → falling snow
      const x = rand(0, 1, rng), y = rand(-0.15, 0.55, rng);
      return { x, y, baseX: x, baseY: y, pathX: rand(-0.36, 0.36, rng), wave: rand(0.02, 0.11, rng), wavePhase: rand(0, 6.28, rng), fallCurve: rand(0.82, 1.18, rng), vr: rand(-1, 1, rng), s: rand(3, 6, rng), sp: rand(0.25, 0.6, rng), ph: rand(0, 6.28, rng), col: lf.col, kind: lf.kind };
    };
    function resetDrift() {
      drift.length = 0;
      if (opts.leaves) for (let i = 0; i < (opts.leafCount != null ? opts.leafCount : 16); i++) drift.push(spawn());
    }
    function build() {
      rng = makeRng(seed);
      // minLeafLen / maxDepth trim the (exponentially numerous) deepest twigs - the
      // cheapest way to cut node count without changing the tree's silhouette much.
      root = makeNode(-Math.PI / 2, baseLen(), 0, opts.branchVariety,
        opts.leafBunch, opts.minLeafLen || 14, maxDepth, season, rng);
      resetDrift();
    }

    function resize() {
      const prevW = W, prevH = H;
      DPR = Math.min(window.devicePixelRatio || 1, opts.maxDPR || 2);
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      let bw = Math.round(W * DPR), bh = Math.round(H * DPR);
      // optional backing-store pixel budget: keeps a tall window from costing far
      // more fill-rate than a short one (drawing stays in CSS px via the transform).
      const maxPx = opts.maxPixels || 0;
      if (maxPx && bw * bh > maxPx) {
        const s = Math.sqrt(maxPx / (bw * bh));
        bw = Math.max(1, Math.round(bw * s)); bh = Math.max(1, Math.round(bh * s));
      }
      canvas.width = bw; canvas.height = bh;
      ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
      // rebuild when W changes (rotation/resize); H-only changes are normally the mobile
      // browser chrome bar showing/hiding. Set rebuildOnHeightChange:true to also rebuild on H.
      if (!root || W !== prevW || (opts.rebuildOnHeightChange && H !== prevH)) build();
    }
    window.addEventListener('resize', resize);

    function resetBatch() {
      for (const bucket of batch.branches) if (bucket) bucket.length = 0;
      batch.trunk.length = 0;
      batch.leaves.length = 0;
    }

    function addSegment(bucket, x, y, x2, y2) {
      bucket.push(x, y, x2, y2);
    }

    function drawNode(node, x, y, pAbs, t) {
      const sway = wind * 0.024 * (node.depth / 9) * Math.sin(t + node.phase + node.depth * 0.5);
      const abs = pAbs + node.angle + sway;
      const x2 = x + Math.cos(abs) * node.len, y2 = y + Math.sin(abs) * node.len;
      let branchBucket = batch.branches[node.depth];
      if (!branchBucket) branchBucket = batch.branches[node.depth] = [];
      addSegment(branchBucket, x, y, x2, y2);
      if (node.leaf) {
        const r = 3.4 + Math.sin(t * 2 + node.phase) * 0.8 + 2.4;
        if (node.bunch) {                                 // fuller foliage (opt-in via leafBunch)
          for (let k = 0; k < node.bunch.length; k++) {
            const b = node.bunch[k];
            batch.leaves.push(b.col, x2 + b.dx, y2 + b.dy, r * b.rs);
          }
        } else if (node.lf) {
          batch.leaves.push(node.lf.col, x2, y2, r);
        }
      } else {
        for (const c of node.children) drawNode(c, x2, y2, abs, t);
      }
    }

    function strokeSegments(segments, width, color) {
      if (!segments.length) return;
      ctx.beginPath();
      for (let i = 0; i < segments.length; i += 4) {
        ctx.moveTo(segments[i], segments[i + 1]);
        ctx.lineTo(segments[i + 2], segments[i + 3]);
      }
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.stroke();
    }

    function flushBatch() {
      ctx.lineCap = 'round';

      // The long mobile trunk has its own depth-0 colour and keeps its curve.
      if (batch.trunk.length) {
        ctx.beginPath();
        ctx.moveTo(batch.trunk[0], batch.trunk[1]);
        ctx.quadraticCurveTo(batch.trunk[2], batch.trunk[3], batch.trunk[4], batch.trunk[5]);
        ctx.lineWidth = 12;
        ctx.strokeStyle = trunkColor;
        ctx.stroke();
      }
      for (let depth = 0; depth < batch.branches.length; depth++) {
        const segments = batch.branches[depth];
        if (!segments || !segments.length) continue;
        const fallback = 'hsl(28,' + (30 - depth) + '%,' + (15 + depth * 2.2) + '%)';
        const color = typeof branchColor === 'function' ? branchColor(depth, fallback) : (branchColor || fallback);
        strokeSegments(segments, Math.max(0.7, 9 - depth * 0.95), color);
      }

      // Keep leaves as individual fills so their translucent overlap remains
      // visually equivalent to the old renderer.
      for (let i = 0; i < batch.leaves.length; i += 4) {
        ctx.fillStyle = batch.leaves[i];
        ctx.beginPath();
        ctx.arc(batch.leaves[i + 1], batch.leaves[i + 2], batch.leaves[i + 3], 0, 6.2832);
        ctx.fill();
      }
    }

    const t0 = performance.now();
    function frame(now) {
      if (!running) return;
      const t = (now - t0) / 1000;
      const cycleAngle = cycleProgress == null ? t : cycleProgress * Math.PI * 2;
      const target = cycleProgress == null
        ? 0.6 + 0.5 * Math.sin(t * 0.5) + 0.3 * Math.sin(t * 1.3) + (mouseX - 0.5) * 1.3 * sens + gust
        : 0.6 + 0.5 * Math.sin(cycleAngle) + 0.3 * Math.sin(cycleAngle * 2) + (mouseX - 0.5) * 1.3 * sens + cycleWind;
      if (cycleProgress == null) { wind += (target - wind) * 0.05; gust *= 0.90; }
      else { wind = target; gust = 0; }

      ctx.clearRect(0, 0, W, H);
      if (opts.sky) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        (opts.sky.stops || [[0, '#e9e4d6'], [1, '#e7e1cf']]).forEach(s => g.addColorStop(s[0], s[1]));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (opts.sun) {
        const sx = W * 0.74, sy = H * 0.24, rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.5);
        rg.addColorStop(0, 'rgba(255,248,226,0.45)'); rg.addColorStop(1, 'rgba(255,248,226,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      }

      resetBatch();
      const L = opts.layout ? opts.layout(W, H) : { rootX: W * 0.54, rootY: H * 0.99 };
      ctx.lineCap = 'round';
      let rx = L.rootX, ry = L.rootY;
      if (L.trunkBaseY != null) {
        // Long trunk (e.g. mobile): run it straight up to the first branching point and
        // branch from there - there's no separate root segment, so the join is seamless.
        const topX = rx + Math.sin(cycleAngle) * wind * 7;
        const rootAbs = root ? root.angle : -Math.PI / 2;     // depth-0 doesn't sway → vertical
        const rootLen = root ? root.len : baseLen();
        const bxt = topX + Math.cos(rootAbs) * rootLen;       // first branching point
        const byt = ry + Math.sin(rootAbs) * rootLen;
        batch.trunk.push(
          L.trunkBaseX, L.trunkBaseY,
          (L.trunkBaseX + bxt) / 2 + Math.sin(cycleAngle) * wind * 6, (L.trunkBaseY + byt) / 2,
          bxt, byt
        );
        if (root) for (const c of root.children) drawNode(c, bxt, byt, rootAbs, cycleAngle);
      } else {
        if (opts.shadow) {
          ctx.fillStyle = 'rgba(60,45,30,0.10)';
          ctx.beginPath(); ctx.ellipse(rx, ry, W * 0.2, 16, 0, 0, 6.2832); ctx.fill();
        }
        if (root) drawNode(root, rx, ry, 0, cycleAngle);
      }
      flushBatch();

      if (opts.leaves) for (const d of drift) {
        if (cycleProgress == null) {
          d.y += d.sp * 0.0016; d.x += Math.sin(t + d.ph) * 0.0006 + wind * 0.0008; d.ph += 0.02;
          if (d.y > 1.12) { Object.assign(d, spawn()); d.y = -0.1; }
        } else {
          const p = Math.max(0, Math.min(1, cycleProgress));
          const fall = Math.pow(p, d.fallCurve);
          d.y = -0.14 + 1.36 * fall;
          d.x = d.baseX + (d.pathX + cycleWind * 0.32) * fall + Math.sin(cycleAngle * 2 + d.wavePhase) * d.wave * fall;
        }
        ctx.save(); ctx.translate(d.x * W, d.y * H); ctx.rotate((cycleProgress == null ? t : cycleAngle) * d.vr + d.ph);
        ctx.fillStyle = d.col; ctx.beginPath();
        if (d.kind === 'leaf') ctx.ellipse(0, 0, d.s, d.s * 0.5, 0, 0, 6.2832);
        else ctx.arc(0, 0, d.s * 0.6, 0, 6.2832);     // snow / blossom fall as round dots
        ctx.fill(); ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    }

    resize();
    raf = requestAnimationFrame(frame);

    return {
      regenerate: build,
      setSeed(s) { seed = s; build(); },
      setDepth(n) { maxDepth = Math.max(1, Math.floor(Number(n) || 1)); build(); },
      setLeafCount(n) { opts.leafCount = Math.max(0, Math.floor(Number(n) || 0)); resetDrift(); },
      setSeason(s) { season = s; build(); },
      setMouse: x => { mouseX = x; },
      gust: dx => { gust += dx; },
      setCycleProgress(p) { cycleProgress = p == null ? null : Math.max(0, Math.min(1, Number(p) || 0)); },
      setCycleWind(dx) { cycleWind = Number(dx) || 0; },
      pause() { if (running) { running = false; cancelAnimationFrame(raf); } },
      resume() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
      destroy() { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); },
      get seed() { return seed; },
      get wind() { return wind; }
    };
  }

  // A falling particle for a season - never null (winter's bare picks fall as snow).
  // Shared with the blog's cursor-wind so its leaves match the tree's foliage.
  function driftLeaf(season) { return pickLeaf(season, Math.random) || { col: SNOW, kind: 'snow' }; }

  window.LlucTree = { create, leaf: driftLeaf };
}());
