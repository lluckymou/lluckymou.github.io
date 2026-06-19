// Resolve the assets/ base from this script's own URL, so font fetches work
// whether the page is at the site root (index.html) or in a subfolder (labs/…).
var ASSET_BASE = (function () {
  var s = document.currentScript || document.querySelector('script[src$="render.js"]');
  return s ? s.src.replace(/render\.js(\?.*)?$/, '') : 'assets/';
})();

var cvProportional      = false;
var showTonic           = false;
var halfSpace           = false;
var syllableCompression = 'none';
var numberCompression   = '2';
var syllCompress        = false;
var noExternalPad       = false;
var currentLanguage     = 'pt';
var currentFont         = 'handwritten';

// ── Syllable grouping for compression ────────────────────────────────────────

function groupSyllables(sylls, mode) {
  const n = sylls.length;
  if (mode === 'none' || n <= 1) return sylls.map(s => [s]);

  if (mode === 'bi') {
    if (n === 2) return [sylls.slice()];
    return sylls.map(s => [s]);
  }

  if (mode === 'bi-forced') {
    const gs = [];
    for (let i = 0; i < n; i += 2)
      gs.push(i + 1 < n ? [sylls[i], sylls[i + 1]] : [sylls[i]]);
    return gs;
  }

  if (mode === 'tri') {
    if (n === 2) return [sylls.slice()];
    if (n === 3) return [sylls.slice()];
    return sylls.map(s => [s]);
  }

  if (mode === 'tri-forced') {
    const gs = [];
    let i = 0;
    while (i < n) {
      const take = (n - i >= 3) ? 3 : (n - i);
      gs.push(sylls.slice(i, i + take));
      i += take;
    }
    return gs;
  }

  if (mode === 'quad') {
    if (n % 3 === 0) {
      const gs = [];
      for (let i = 0; i < n; i += 3) gs.push(sylls.slice(i, i + 3));
      return gs;
    }
    const gs = [];
    const fours = Math.floor(n / 4);
    const rem   = n % 4;
    let i = 0;
    for (let k = 0; k < fours; k++) { gs.push(sylls.slice(i, i + 4)); i += 4; }
    if (rem === 3) gs.push(sylls.slice(i, i + 3));
    else if (rem === 2) gs.push(sylls.slice(i, i + 2));
    else if (rem === 1) gs.push([sylls[i]]);
    return gs;
  }

  return sylls.map(s => [s]);
}

// ── Accent / normalization tables ────────────────────────────────────────────

const TO_PLAIN = {
  á:'a',à:'a',â:'a',ã:'a',ä:'a',
  é:'e',è:'e',ê:'e',ë:'e',
  í:'i',ì:'i',î:'i',ï:'i',
  ó:'o',ò:'o',ô:'o',õ:'o',ö:'o',
  ú:'u',ù:'u',û:'u',ü:'u',
  ç:'c',
  Á:'A',À:'A',Â:'A',Ã:'A',
  É:'E',È:'E',Ê:'E',
  Í:'I',Ì:'I',Î:'I',
  Ó:'O',Ò:'O',Ô:'O',Õ:'O',
  Ú:'U',Ù:'U',Û:'U',
  Ç:'C',
};

// For display: strip vowel accents, keep Ç as ç (→ cedilha.svg), ü→u
const TO_DISPLAY = {
  á:'a',à:'a',â:'a',ã:'a',
  é:'e',è:'e',ê:'e',
  í:'i',ì:'i',î:'i',
  ó:'o',ò:'o',ô:'o',õ:'o',
  ú:'u',ù:'u',û:'u',ü:'u',Ü:'u',
  ç:'ç',Ç:'ç',
};

function displayNorm(word) {
  return [...word].map(c => TO_DISPLAY[c] ?? c.toLowerCase()).join('');
}

function plainNorm(word) {
  return [...word].map(c => TO_PLAIN[c] ?? c.toLowerCase()).join('');
}

// ── Accent-type map ───────────────────────────────────────────────────────────

const ACCENT_TYPE = {
  á:'acute', é:'acute', í:'acute', ó:'acute', ú:'acute',
  à:'grave', è:'grave', ì:'grave', ò:'grave', ù:'grave',
  â:'circumflex', ê:'circumflex', ô:'circumflex',
  ã:'tilde', õ:'tilde',
};

function getAccentType(syll) {
  for (const ch of syll) { if (ACCENT_TYPE[ch]) return ACCENT_TYPE[ch]; }
  return null;
}

// ── Vowel sets ────────────────────────────────────────────────────────────────

const V_PLAIN    = new Set([...'aeiou']);
const V_ACCENTED = new Set([...'áàâãéèêíìîóòôõúùû']);
const V_ALL      = new Set([...V_PLAIN, ...V_ACCENTED]);
const isV        = c => V_ALL.has(c);
const isVPlain   = c => V_PLAIN.has(c);

const GRAPHIC_ACCENT = /[áàâãéèêíìîóòôõúùûÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛ]/;

// Inseparable consonant clusters (go to next syllable as a unit)
const CLUSTERS = new Set([
  'br','cr','dr','fr','gr','pr','tr','vr',
  'bl','cl','fl','gl','pl','tl',
  'ch','lh','nh',
  'gu','qu',   // digraph units (u is a glide before any vowel)
]);

// ── Syllabification ──────────────────────────────────────────────────────────

// Nasal vowels that form diphthongs with a following o/e
const NASAL_V = new Set([...'ãõ']);

function syllabify(word) {
  const wOrig = word.toLowerCase();   // accents preserved, used for nasal check
  const w = [...wOrig].map(c => TO_PLAIN[c] ?? c).join('');
  const n = w.length;
  if (n <= 1) return [wOrig];

  // 'u' after g/q and before any vowel is a glide, not a syllabic vowel
  const isGlideU = (i) =>
    w[i] === 'u' && i > 0 &&
    (w[i - 1] === 'g' || w[i - 1] === 'q') &&
    i + 1 < n && isVPlain(w[i + 1]);

  // Collect vowel indices (excluding glide u's; y is a vowel when not before another vowel)
  const vIdx = [];
  for (let i = 0; i < n; i++) {
    if (isVPlain(w[i]) && !isGlideU(i)) vIdx.push(i);
    else if (w[i] === 'y' && (i === n - 1 || !isVPlain(w[i + 1]))) vIdx.push(i);
  }
  if (vIdx.length === 0) return [word.toLowerCase()];
  if (vIdx.length === 1) return [word.toLowerCase()];

  // Build cut positions (start of each new syllable)
  const cuts = new Set([0]);

  for (let k = 0; k < vIdx.length - 1; k++) {
    const v1 = vIdx[k], v2 = vIdx[k + 1];

    // Consonants sitting between the two vowels
    const cBetween = [];
    for (let j = v1 + 1; j < v2; j++) cBetween.push({ ch: w[j], pos: j });
    const nc = cBetween.length;

    if (nc === 0) {
      // Adjacent vowels - check for diphthong vs hiatus
      const c2 = w[v2];
      // Falling diphthong: i/u is semivowel UNLESS it carries a graphic accent
      const v2HasAccent = GRAPHIC_ACCENT.test(wOrig[v2]);
      const isFalling = (c2 === 'i' || c2 === 'u') && !v2HasAccent;
      // Nasal diphthong: ã/õ + o or e (não, mão, leões…)
      const isNasalDiph = NASAL_V.has(wOrig[v1]) && (c2 === 'o' || c2 === 'e');
      if (isFalling || isNasalDiph) {
        // Diphthong - no cut
      } else {
        cuts.add(v2);           // Hiatus - cut before second vowel
      }
    } else if (nc === 1) {
      cuts.add(cBetween[0].pos);  // Single consonant → goes with next syllable
    } else {
      const c0 = cBetween[0].ch, c1 = cBetween[1].ch;
      const first2 = c0 + c1;
      const last2  = cBetween[nc - 2].ch + cBetween[nc - 1].ch;

      if (c0 === c1 && nc === 2) {
        // Double consonant (ss, rr, cc…) - split between them
        cuts.add(cBetween[1].pos);
      } else if (CLUSTERS.has(first2)) {
        // Inseparable cluster at front - both go with next syllable
        cuts.add(cBetween[0].pos);
      } else if (nc >= 2 && CLUSTERS.has(last2)) {
        // Last two form a cluster - cut before that cluster
        cuts.add(cBetween[nc - 2].pos);
      } else {
        // Default: split after first consonant
        cuts.add(cBetween[1].pos);
      }
    }
  }

  cuts.add(n);
  const sorted = [...cuts].sort((a, b) => a - b);

  // Slice from wOrig (lowercased with accents) so accents are preserved
  const sylls = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const s = wOrig.slice(sorted[i], sorted[i + 1]);
    if (s) sylls.push(s);
  }
  return sylls;
}

// ── Stress detection ─────────────────────────────────────────────────────────

function tonicIndex(sylls) {
  // 1. Graphic accent
  for (let i = 0; i < sylls.length; i++) {
    if (GRAPHIC_ACCENT.test(sylls[i])) return { idx: i, graphic: true };
  }

  // 2. Oxytone endings: R L Z X I U
  const last = sylls.at(-1);
  if (last && /[rlzxiu]$/i.test(last)) {
    return { idx: sylls.length - 1, graphic: false };
  }

  // 3. Paroxytone (default)
  return { idx: Math.max(0, sylls.length - 2), graphic: false };
}

// ── English syllabification (Hypher, bramstein/hypher, MIT) ──────────────────

var enHypher = null;
(function initHypher() {
  if (window.Hypher && window.hyphenationEnUS) {
    enHypher = new window.Hypher(window.hyphenationEnUS);
  }
})();

function syllabifyEN(word) {
  const w = word.toLowerCase();
  if (enHypher) return enHypher.hyphenate(w);
  return [w]; // fallback: treat whole word as one syllable
}

// ── English syllable coda detection ──────────────────────────────────────────

function splitSyllableCoda(syll) {
  const vowels = new Set('aeiouy');
  let lastVowelIdx = -1;
  for (let i = 0; i < syll.length; i++) {
    if (vowels.has(syll[i])) lastVowelIdx = i;
  }
  if (lastVowelIdx < 0 || lastVowelIdx === syll.length - 1) return { main: syll, coda: '' };
  return { main: syll.slice(0, lastVowelIdx + 1), coda: syll.slice(lastVowelIdx + 1) };
}

async function buildEnglishSyllBlock(displaySyll, accentType, forceReload = false) {
  const { main, coda } = splitSyllableCoda(displaySyll);
  if (!coda) return buildBlock(displaySyll, displaySyll, false, accentType, false, forceReload);

  const block = document.createElement('div');
  block.className = 'block syll-compressed';
  block.dataset.orig = displaySyll;

  if (accentType) {
    const data = await getSVG('', accentType, forceReload);
    if (data.ok) {
      const wrap = document.createElement('div');
      wrap.className = 'accent-mark';
      const svg = data.el.cloneNode(true);
      svg.setAttribute('preserveAspectRatio', 'none');
      wrap.appendChild(svg);
      block.appendChild(wrap);
    }
  }

  const mainDiv = document.createElement('div');
  mainDiv.className = 'syll-main';
  const mainLetters = document.createElement('div');
  mainLetters.className = 'letters';
  await buildLetterSlots(mainLetters, main, forceReload, { isTop: true, isBottom: false });
  mainDiv.appendChild(mainLetters);
  block.appendChild(mainDiv);

  const codaDiv = document.createElement('div');
  codaDiv.className = 'syll-coda';
  const codaLetters = document.createElement('div');
  codaLetters.className = 'letters';
  await buildLetterSlots(codaLetters, coda, forceReload, { isTop: false, isBottom: true });
  codaDiv.appendChild(codaLetters);
  block.appendChild(codaDiv);

  return block;
}

// ── Width proportions ────────────────────────────────────────────────────────

// Natural aspect ratio of letter I: advanceWidth(214) / capHeight(701)
const I_RATIO = 214 / 701;
// Visual slot width for regular I in multi-char syllables (thinner than natural)
const I_SLOT  = 0.18;

// M and W have horizontally complex strokes - force equal distribution when present
const COMPLEX_WIDE = new Set(['m', 'w']);


// O kerning: O steals slot from letters whose strokes leave open space near the O boundary
// (circle tapers at top/bottom, these letters have content in corners that doesn't meet O)
const O_KERN_NEIGHBORS = new Set(['i', 'x', 'k', 'c']);
const O_KERN_AMOUNT    = 0.5; // max fraction of block width transferred per adjacent pair

function widths(chars) {
  const isVow = c => 'aeiouç'.includes(c);

  // I and apostrophe are thin glyphs - fixed narrow slot
  const isThin = c => c === 'i' || c === "'";
  const rest = chars.filter(c => !isThin(c));
  if (rest.length === 0) {
    return chars.map(() => I_SLOT);
  }

  const iTotal = (chars.length - rest.length) * I_SLOT;
  const rem    = Math.max(0.05, 1 - iTotal);

  // Non-I chars: equal when toggle off, else vowels get 1.33x consonant slot
  let restWidths;
  if (!cvProportional) {
    restWidths = rest.map(() => rem / rest.length);
  } else {
    const VOWEL_RATIO = 1.33;
    const isV = rest.map(c => isVow(c));
    const nV  = isV.filter(Boolean).length;
    const nC  = rest.length - nV;
    const wC  = rem / (VOWEL_RATIO * nV + nC);
    const wV  = VOWEL_RATIO * wC;
    restWidths = isV.map(v => v ? wV : wC);
  }

  const result = [];
  let ri = 0;
  for (const c of chars) {
    if (isThin(c)) result.push(I_SLOT);
    else result.push(restWidths[ri++]);
  }

  // Apply O kerning after base widths are set
  const oIdx = chars.indexOf('o');
  if (oIdx >= 0) {
    const tryKern = (neighborIdx) => {
      if (neighborIdx < 0 || neighborIdx >= chars.length) return;
      if (!O_KERN_NEIGHBORS.has(chars[neighborIdx])) return;
      const boost = Math.min(O_KERN_AMOUNT, result[neighborIdx] * 0.3);
      result[neighborIdx] -= boost;
      result[oIdx]        += boost;
    };
    tryKern(oIdx - 1);
    tryKern(oIdx + 1);
  }

  return result;
}

// ── SVG cache & loader ────────────────────────────────────────────────────────

var cache = new Map();

const PUNCT = {
  '.':'period', ',':'comma', '"':'quotation', '!':'exclamation', '?':'question',
  '/':'slash',  ':':'colon', ';':'semicolon',   '-':'hyphen',
  '(':'lparen', ')':'rparen',
};

const IS_PUNCT = new Set(Object.keys(PUNCT));

// Minimum padding around glyph content, as fraction of the SVG's viewBox height.
// Lower = tighter fill; raise if strokes get clipped.
var GLYPH_PAD_RATIO = 0.075;

const PUNCT_KEYS = new Set(Object.values(PUNCT));

function tightenViewBox(svg, vb) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1000px;height:1000px;visibility:hidden;';
  svg.setAttribute('width', '1000');
  svg.setAttribute('height', '1000');
  host.appendChild(svg);
  document.body.appendChild(host);
  let tightBbox = null;
  try {
    const els = svg.querySelectorAll('path,rect,circle,ellipse,line,polyline,polygon');
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const el of els) {
      const bb = el.getBBox();
      x0 = Math.min(x0, bb.x);         y0 = Math.min(y0, bb.y);
      x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height);
    }
    if (isFinite(x0)) {
      const pad = vb[3] * GLYPH_PAD_RATIO;
      svg.setAttribute('viewBox', `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`);
      tightBbox = { x0, y0, x1, y1 };
    }
  } finally {
    document.body.removeChild(host);
    host.removeChild(svg);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
  }
  return tightBbox;
}

// Adjusts a cloned SVG's viewBox to only include padding on the specified internal sides.
// padL/padR/padT/padB: true = this side faces another glyph (keep padding), false = external (remove padding).
function setSlotViewBox(svgClone, data, padL, padR, padT, padB) {
  if (!noExternalPad || !data.tightBbox) return;
  const bb  = data.tightBbox;
  const pad = data.vbH * GLYPH_PAD_RATIO;
  const x0  = padL ? bb.x0 - pad : bb.x0;
  const y0  = padT ? bb.y0 - pad : bb.y0;
  const x1  = padR ? bb.x1 + pad : bb.x1;
  const y1  = padB ? bb.y1 + pad : bb.y1;
  svgClone.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
}

async function getSVG(ch, keyOverride = null, forceReload = false) {
  const key = keyOverride ?? (ch === 'ç' ? 'cedilha' : (PUNCT[ch] ?? ch.toLowerCase()));
  if (!forceReload && cache.has(key)) return cache.get(key);

  const tryLoad = async (font) => {
    const url = forceReload ? `${ASSET_BASE}fonts/${font}/${key}.svg?v=${Date.now()}` : `${ASSET_BASE}fonts/${font}/${key}.svg`;
    const r = await fetch(url, forceReload ? { cache: 'no-cache' } : {});
    if (!r.ok) throw new Error(r.status);
    const txt = await r.text();
    const dp  = new DOMParser();
    const doc = dp.parseFromString(txt, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg || doc.querySelector('parsererror')) throw new Error('parse');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    const vbAttr = svg.getAttribute('viewBox');
    const vb = vbAttr ? vbAttr.split(' ').map(Number) : [0, 0, 100, 100];
    const tightBbox = (!PUNCT_KEYS.has(key) && key !== 'apostrophe') ? tightenViewBox(svg, vb) : null;
    return { ok: true, el: svg, vbW: vb[2], vbH: vb[3], tightBbox };
  };

  try {
    const res = await tryLoad(currentFont);
    cache.set(key, res);
    return res;
  } catch (e) {
    // If the requested font doesn't provide the symbol, fall back to the default
    // handwritten font. If currentFont already is handwritten, mark as missing.
    if (currentFont !== 'handwritten') {
      try {
        const res2 = await tryLoad('handwritten');
        cache.set(key, res2);
        return res2;
      } catch (e2) {
        cache.set(key, { ok: false, ch: ch.toUpperCase() });
        return cache.get(key);
      }
    } else {
      cache.set(key, { ok: false, ch: ch.toUpperCase() });
      return cache.get(key);
    }
  }
}

// ── Number block builder ──────────────────────────────────────────────────────

async function buildNumberBlock(digits, forceReload = false) {
  const block = document.createElement('div');
  block.className = 'block';
  block.dataset.orig = digits.join('');
  const letters = document.createElement('div');
  letters.className = 'letters';
  const w = (100 / digits.length).toFixed(3) + '%';
  for (let i = 0; i < digits.length; i++) {
    const d = digits[i];
    const slot = document.createElement('div');
    slot.className = 'lslot';
    slot.style.width = w;
    const data = await getSVG(d, null, forceReload);
    if (data.ok) {
      const svg = data.el.cloneNode(true);
      svg.setAttribute('preserveAspectRatio', 'none');
      setSlotViewBox(svg, data, i > 0, i < digits.length - 1, false, false);
      slot.appendChild(svg);
    } else {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      fb.textContent = d;
      slot.appendChild(fb);
    }
    letters.appendChild(slot);
  }
  block.appendChild(letters);
  return block;
}

// ── Block builder ─────────────────────────────────────────────────────────────

// Appends letter lslots for displaySyll into the given container element.
// rowOpts.isTop / rowOpts.isBottom: whether this row sits at the top/bottom edge of the block.
// When noExternalPad is active, external edges receive no padding.
async function buildLetterSlots(container, displaySyll, forceReload, rowOpts = {}) {
  const { isTop = true, isBottom = true } = rowOpts;
  const chars = [...displaySyll];
  if (chars.length === 1 && chars[0] === 'i') {
    const slot = document.createElement('div');
    slot.className = 'lslot';
    slot.style.width = '100%';
    const data = await getSVG('i', null, forceReload);
    if (data.ok) {
      const svg = data.el.cloneNode(true);
      svg.setAttribute('preserveAspectRatio', 'none');
      setSlotViewBox(svg, data, false, false, !isTop, !isBottom);
      slot.appendChild(svg);
    }
    container.appendChild(slot);
  } else {
    const ws = widths(chars);
    for (let i = 0; i < chars.length; i++) {
      const slot = document.createElement('div');
      slot.className = 'lslot';
      slot.style.width = (ws[i] * 100).toFixed(3) + '%';
      if (chars[i] === "'") {
        slot.style.marginRight = '-10%';
      }
      const data = await getSVG(chars[i], chars[i] === 'i' ? 'i_bar' : chars[i] === "'" ? 'apostrophe' : null, forceReload);
      if (data.ok) {
        const svg = data.el.cloneNode(true);
        svg.setAttribute('preserveAspectRatio', 'none');
        setSlotViewBox(svg, data, i > 0, i < chars.length - 1, !isTop, !isBottom);
        slot.appendChild(svg);
      } else {
        const fb = document.createElement('div');
        fb.className = 'fallback';
        fb.textContent = data.ch ?? chars[i].toUpperCase();
        slot.appendChild(fb);
      }
      container.appendChild(slot);
    }
  }
}

// Builds a custom block from [content], using / as a row separator.
async function buildCustomBlock(content, forceReload = false) {
  const block = document.createElement('div');
  block.className = 'block';
  block.dataset.orig = '[' + content + ']';

  const rows = content.split('/').map(r => r.trim()).filter(Boolean);
  if (rows.length === 0) return block;

  if (rows.length === 1) {
    const letters = document.createElement('div');
    letters.className = 'letters';
    await buildLetterSlots(letters, rows[0].toLowerCase(), forceReload, { isTop: true, isBottom: true });
    block.appendChild(letters);
  } else {
    for (let ri = 0; ri < rows.length; ri++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'comp-row';
      await buildLetterSlots(rowDiv, rows[ri].toLowerCase(), forceReload, {
        isTop: ri === 0,
        isBottom: ri === rows.length - 1,
      });
      block.appendChild(rowDiv);
    }
  }
  return block;
}

// Builds a compressed multi-syllable block (2, 3, or 4 syllables).
async function buildCompressedBlock(syllsInGroup, forceReload = false) {
  const block = document.createElement('div');
  block.className = 'block compressed';
  block.dataset.orig = syllsInGroup.join('');

  const n = syllsInGroup.length;
  const accentType = syllsInGroup.map(getAccentType).filter(Boolean).at(-1) ?? null;

  const appendAccentMark = async (small) => {
    if (!accentType) return;
    const key  = accentType;
    const data = await getSVG('', key, forceReload);
    if (!data.ok) return;
    const wrap = document.createElement('div');
    wrap.className = small ? 'accent-mark half' : 'accent-mark';
    const svg = data.el.cloneNode(true);
    svg.setAttribute('preserveAspectRatio', 'none');
    wrap.appendChild(svg);
    block.appendChild(wrap);
  };

  if (n === 2) {
    await appendAccentMark(false);
    for (let si = 0; si < syllsInGroup.length; si++) {
      const row = document.createElement('div');
      row.className = 'comp-row';
      await buildLetterSlots(row, displayNorm(syllsInGroup[si]), forceReload, {
        isTop: si === 0,
        isBottom: si === syllsInGroup.length - 1,
      });
      block.appendChild(row);
    }
  } else if (n === 3) {
    await appendAccentMark(true);
    const topPair = document.createElement('div');
    topPair.className = 'comp-pair-row';
    for (const syll of syllsInGroup.slice(0, 2)) {
      const half = document.createElement('div');
      half.className = 'comp-half';
      await buildLetterSlots(half, displayNorm(syll), forceReload, { isTop: true, isBottom: false });
      topPair.appendChild(half);
    }
    block.appendChild(topPair);
    const bot = document.createElement('div');
    bot.className = 'comp-row';
    await buildLetterSlots(bot, displayNorm(syllsInGroup[2]), forceReload, { isTop: false, isBottom: true });
    block.appendChild(bot);
  } else if (n === 4) {
    await appendAccentMark(true);
    for (let r = 0; r < 2; r++) {
      const pair = document.createElement('div');
      pair.className = 'comp-pair-row';
      for (let c = 0; c < 2; c++) {
        const half = document.createElement('div');
        half.className = 'comp-half';
        await buildLetterSlots(half, displayNorm(syllsInGroup[r * 2 + c]), forceReload, {
          isTop: r === 0,
          isBottom: r === 1,
        });
        pair.appendChild(half);
      }
      block.appendChild(pair);
    }
  }

  return block;
}

async function buildBlock(displaySyll, origSyll, isTonic, accentType, isPunct, forceReload = false) {
  const block = document.createElement('div');
  block.className = isPunct ? 'block punct' : 'block';
  block.dataset.orig = origSyll;

  if (isPunct) {
    const letters = document.createElement('div');
    letters.className = 'letters';
    const data = await getSVG(displaySyll, null, forceReload);
    const slot = document.createElement('div');
    slot.className = 'lslot';
    const slotPx = '!?()'.includes(displaySyll) ? `var(--punct-tall-size)` : `var(--punct-dot-size)`;
    slot.style.height = slotPx;
    slot.style.width  = slotPx;
    if (data.ok) {
      const svg = data.el.cloneNode(true);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      slot.appendChild(svg);
    } else {
      const fb = document.createElement('div');
      fb.className = 'fallback';
      fb.textContent = data.ch ?? displaySyll.toUpperCase();
      slot.appendChild(fb);
    }
    letters.appendChild(slot);
    block.appendChild(letters);
    return block;
  }

  // Accent mark SVG at top
  if (accentType) {
    const data = await getSVG('', accentType, forceReload);
    if (data.ok) {
      const wrap = document.createElement('div');
      wrap.className = 'accent-mark';
      const svg = data.el.cloneNode(true);
      svg.setAttribute('preserveAspectRatio', 'none');
      wrap.appendChild(svg);
      block.appendChild(wrap);
    }
  }

  const letters = document.createElement('div');
  letters.className = 'letters';
  await buildLetterSlots(letters, displaySyll, forceReload);
  block.appendChild(letters);

  // Stress mark SVG at bottom
  if (isTonic) {
    const data = await getSVG('', 'stressed-syllable', forceReload);
    if (data.ok) {
      const wrap = document.createElement('div');
      wrap.className = 'stress-mark';
      const svg = data.el.cloneNode(true);
      svg.setAttribute('preserveAspectRatio', 'none');
      wrap.appendChild(svg);
      block.appendChild(wrap);
    }
  }

  return block;
}

function buildSpaceBlock() {
  const b = document.createElement('div');
  b.className = 'block space';
  if (halfSpace) b.style.width = 'calc(var(--bs) * 0.5)';
  return b;
}

// ── Render ────────────────────────────────────────────────────────────────────

// \n separated from other whitespace so Enter creates a real line break
const TOK_RE    = /\[[^\]]*\]|[a-záàâãéèêíìîóòôõúùûüçA-ZÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÜÇ]+(?:'[a-zA-Z]+)*|\d+|[가-힣ᄀ-ᇿ㄰-㆏]+|[^\S\n]+|\n|[^\s]/g;
const WORD_RE   = /^[a-záàâãéèêíìîóòôõúùûüç]+(?:'[a-z]+)*$/i;
const HANGUL_RE = /^[가-힣ᄀ-ᇿ㄰-㆏]+$/;

function buildHangulBlock(char) {
  const block = document.createElement('div');
  block.className = 'block';
  block.dataset.orig = char;
  const inner = document.createElement('div');
  inner.className = 'hangul-char';
  inner.textContent = char;
  block.appendChild(inner);
  return block;
}

async function render(forceReload = false) {
  if (currentLanguage === 'en') return renderEN(forceReload);
  return renderPT(forceReload);
}

async function renderEN(forceReload = false) {
  const inp    = document.getElementById('inp');
  const raw    = inp.value;
  const canvas = document.getElementById('canvas');

  const hadFocus = document.activeElement === inp;
  const selStart = inp.selectionStart;
  const selEnd   = inp.selectionEnd;

  canvas.style.minHeight = '';
  canvas.innerHTML = '';

  if (!raw.trim()) {
    canvas.appendChild(inp);
    canvas.style.minHeight = '200px';
    if (hadFocus) { inp.focus(); try { inp.setSelectionRange(selStart, selEnd); } catch {} }
    return;
  }

  const frag = document.createDocumentFragment();
  let lastBlock = null;
  const append = (b) => { frag.appendChild(b); lastBlock = b; };

  for (const tok of raw.match(TOK_RE) ?? []) {
    if (tok === '\n') {
      if (lastBlock) lastBlock.style.marginRight = '100%';
    } else if (tok[0] === '[') {
      append(await buildCustomBlock(tok.slice(1, -1), forceReload));
    } else if (/^\s/.test(tok)) {
      append(buildSpaceBlock());
    } else if (/^\d+$/.test(tok)) {
      const gs = numberCompression === 'none' ? 1 : parseInt(numberCompression);
      for (let i = 0; i < tok.length; i += gs) {
        const chunk = [...tok.slice(i, i + gs)];
        if (chunk.length === 1) {
          append(await buildBlock(chunk[0], chunk[0], false, false, false, forceReload));
        } else {
          append(await buildNumberBlock(chunk, forceReload));
        }
      }
    } else if (WORD_RE.test(tok)) {
      const wordParts = tok.split("'");
      for (let pi = 0; pi < wordParts.length; pi++) {
        const part = wordParts[pi];
        if (!part) continue;
        const sylls = syllabifyEN(part);
        const groups = groupSyllables(sylls, syllableCompression);
        for (let gi = 0; gi < groups.length; gi++) {
          const group = groups[gi];
          const prependApo = pi > 0 && gi === 0;
          if (group.length === 1) {
            const syll       = group[0];
            const accentType = getAccentType(syll);
            const display    = (prependApo ? "'" : '') + displayNorm(syll);
            if (syllCompress) {
              append(await buildEnglishSyllBlock(display, accentType, forceReload));
            } else {
              append(await buildBlock(display, syll, false, accentType, false, forceReload));
            }
          } else {
            const groupCopy = [...group];
            if (prependApo) groupCopy[0] = "'" + groupCopy[0];
            append(await buildCompressedBlock(groupCopy, forceReload));
          }
        }
      }
    } else if (HANGUL_RE.test(tok)) {
      for (const ch of [...tok]) append(buildHangulBlock(ch));
    } else if (IS_PUNCT.has(tok)) {
      append(await buildBlock(tok, tok, false, false, true, forceReload));
    }
  }

  canvas.appendChild(frag);
  canvas.appendChild(inp);

  if (hadFocus) {
    inp.focus();
    try { inp.setSelectionRange(selStart, selEnd); } catch {}
  }

  if (inp.scrollHeight > canvas.offsetHeight) {
    canvas.style.minHeight = inp.scrollHeight + 'px';
  }
}

async function renderPT(forceReload = false) {
  const inp    = document.getElementById('inp');
  const raw    = inp.value;
  const canvas = document.getElementById('canvas');

  // Track focus so re-appending the textarea doesn't steal/lose it
  const hadFocus = document.activeElement === inp;
  const selStart = inp.selectionStart;
  const selEnd   = inp.selectionEnd;

  canvas.style.minHeight = '';   // reset before touching innerHTML
  canvas.innerHTML = '';

  if (!raw.trim()) {
    canvas.appendChild(inp);
    canvas.style.minHeight = '200px';
    if (hadFocus) { inp.focus(); try { inp.setSelectionRange(selStart, selEnd); } catch {} }
    return;
  }

  const frag = document.createDocumentFragment();
  let lastBlock = null;

  const append = (b) => { frag.appendChild(b); lastBlock = b; };

  for (const tok of raw.match(TOK_RE) ?? []) {
    if (tok === '\n') {
      if (lastBlock) lastBlock.style.marginRight = '100%';
    } else if (tok[0] === '[') {
      append(await buildCustomBlock(tok.slice(1, -1), forceReload));
    } else if (/^\s/.test(tok)) {
      append(buildSpaceBlock());
    } else if (/^\d+$/.test(tok)) {
      const gs = numberCompression === 'none' ? 1 : parseInt(numberCompression);
      for (let i = 0; i < tok.length; i += gs) {
        const chunk = [...tok.slice(i, i + gs)];
        if (chunk.length === 1) {
          append(await buildBlock(chunk[0], chunk[0], false, false, false, forceReload));
        } else {
          append(await buildNumberBlock(chunk, forceReload));
        }
      }
    } else if (WORD_RE.test(tok)) {
      const wordParts = tok.split("'");
      for (let pi = 0; pi < wordParts.length; pi++) {
        const part = wordParts[pi];
        if (!part) continue;
        const sylls = syllabify(part);
        const { idx: tIdx } = tonicIndex(sylls);
        const markTonic = showTonic && sylls.length >= 3;
        const groups = groupSyllables(sylls, syllableCompression);
        let si = 0;
        for (let gi = 0; gi < groups.length; gi++) {
          const group = groups[gi];
          const prependApo = pi > 0 && gi === 0;
          if (group.length === 1) {
            const orig       = group[0];
            const accentType = getAccentType(orig);
            const display    = (prependApo ? "'" : '') + displayNorm(orig);
            const isTonic    = markTonic && !accentType && si === tIdx;
            append(await buildBlock(display, orig, isTonic, accentType, false, forceReload));
          } else {
            const groupCopy = [...group];
            if (prependApo) groupCopy[0] = "'" + groupCopy[0];
            append(await buildCompressedBlock(groupCopy, forceReload));
          }
          si += group.length;
        }
      }
    } else if (HANGUL_RE.test(tok)) {
      for (const ch of [...tok]) append(buildHangulBlock(ch));
    } else if (IS_PUNCT.has(tok)) {
      append(await buildBlock(tok, tok, false, false, true, forceReload));
    }
  }

  canvas.appendChild(frag);
  canvas.appendChild(inp);

  if (hadFocus) {
    inp.focus();
    try { inp.setSelectionRange(selStart, selEnd); } catch {}
  }

  // Grow canvas if textarea content needs more height than the blocks provide
  if (inp.scrollHeight > canvas.offsetHeight) {
    canvas.style.minHeight = inp.scrollHeight + 'px';
  }
}

// ── renderToPanel ─────────────────────────────────────────────────────────────

async function renderToPanel(text, canvasEl, theme) {
  const prevCV     = cvProportional;
  const prevSC     = syllCompress;
  const prevSyllC  = syllableCompression;
  const prevNumC   = numberCompression;
  const prevTonic  = showTonic;
  const prevHalf   = halfSpace;
  const prevNoExt  = noExternalPad;

  cvProportional      = theme.cvProportional ?? theme.cvProportional_ ?? false;
  syllCompress        = theme.syllComp      ?? theme.syllComp_ ?? theme.compressSyllables ?? theme.compress_syllables ?? false;
  syllableCompression = theme.syllableCompression ?? theme.syllable_compression ?? 'none';
  numberCompression   = theme.numberCompression   ?? theme.number_compression   ?? '2';
  showTonic           = (theme.showTonic ?? theme.showTonic_) ?? false;
  halfSpace           = (theme.halfSpace ?? theme.halfSpace_) ?? false;
  noExternalPad       = theme.noExternalPad ?? false;

  // Allow theme to request a specific font folder (e.g. 'square' or 'handwritten')
  // and allow theme to tweak global glyph padding (padRatio / pad_ratio).
  // When either changes we must clear the SVG cache so tightened viewBoxes are recalculated.
  let _cacheClearedForTheme = false;
  if (theme.font && theme.font !== currentFont) {
    currentFont = theme.font;
    cache.clear();
    _cacheClearedForTheme = true;
  }
  const padVal = (theme.padRatio ?? theme.pad_ratio);
  if (padVal != null && padVal !== GLYPH_PAD_RATIO) {
    GLYPH_PAD_RATIO = padVal;
    if (!_cacheClearedForTheme) cache.clear();
    _cacheClearedForTheme = true;
  }

  const bs = theme.blockSize ?? 30;
  canvasEl.style.setProperty('--bs',             bs + 'px');
  canvasEl.style.setProperty('--glyph-stroke',   (theme.stroke ?? 2) + 'px');
  canvasEl.style.setProperty('--col-gap',         (theme.colGap ?? 4) + 'px');
  canvasEl.style.setProperty('--row-gap',         (theme.rowGap ?? 14) + 'px');
  canvasEl.style.setProperty('--accent-h',        (bs * (theme.accentH ?? 0.23)) + 'px');
  canvasEl.style.setProperty('--stress-h',        (bs * (theme.stressH ?? 0.075)) + 'px');
  canvasEl.style.setProperty('--punct-dot-size',  (bs * 0.75) + 'px');
  canvasEl.style.setProperty('--punct-tall-size', (bs * 0.9) + 'px');
  const overflowEnabled = theme.overflowStrokes ?? theme.overflow_strokes ?? true;
  canvasEl.classList.toggle('overflow-strokes', overflowEnabled);
  const rounded = theme.roundedStrokes ?? theme.rounded_strokes ?? true;
  canvasEl.classList.toggle('square-strokes', !rounded);

  canvasEl.innerHTML = '';

  if (!text.trim()) {
    cvProportional = prevCV; syllCompress = prevSC; syllableCompression = prevSyllC;
    numberCompression = prevNumC; showTonic = prevTonic; halfSpace = prevHalf;
    return;
  }

  const lang = currentLanguage;
  const frag = document.createDocumentFragment();
  let lastBlock = null;
  const append = (b) => { frag.appendChild(b); lastBlock = b; };

  for (const tok of text.match(TOK_RE) ?? []) {
    if (tok === '\n') {
      if (lastBlock) lastBlock.style.marginRight = '100%';
    } else if (tok[0] === '[') {
      append(await buildCustomBlock(tok.slice(1, -1)));
    } else if (/^\s/.test(tok)) {
      append(buildSpaceBlock());
    } else if (/^\d+$/.test(tok)) {
      const gs = numberCompression === 'none' ? 1 : parseInt(numberCompression);
      for (let i = 0; i < tok.length; i += gs) {
        const chunk = [...tok.slice(i, i + gs)];
        if (chunk.length === 1) append(await buildBlock(chunk[0], chunk[0], false, false, false));
        else append(await buildNumberBlock(chunk));
      }
    } else if (WORD_RE.test(tok)) {
      const wordParts = tok.split("'");
      for (let pi = 0; pi < wordParts.length; pi++) {
        const part = wordParts[pi];
        if (!part) continue;
        if (lang === 'en') {
          const sylls  = syllabifyEN(part);
          const groups = groupSyllables(sylls, syllableCompression);
          for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi];
            const prependApo = pi > 0 && gi === 0;
            if (group.length === 1) {
              const syll = group[0];
              const accentType = getAccentType(syll);
              const display = (prependApo ? "'" : '') + displayNorm(syll);
              if (syllCompress) append(await buildEnglishSyllBlock(display, accentType));
              else append(await buildBlock(display, syll, false, accentType, false));
            } else {
              const gc = [...group];
              if (prependApo) gc[0] = "'" + gc[0];
              append(await buildCompressedBlock(gc));
            }
          }
        } else {
          const sylls = syllabify(part);
          const { idx: tIdx } = tonicIndex(sylls);
          const markTonic = showTonic && sylls.length >= 3;
          const groups = groupSyllables(sylls, syllableCompression);
          let si = 0;
          for (let gi = 0; gi < groups.length; gi++) {
            const group = groups[gi];
            const prependApo = pi > 0 && gi === 0;
            if (group.length === 1) {
              const orig = group[0];
              const accentType = getAccentType(orig);
              const display = (prependApo ? "'" : '') + displayNorm(orig);
              const isTonic = markTonic && !accentType && si === tIdx;
              append(await buildBlock(display, orig, isTonic, accentType, false));
            } else {
              const gc = [...group];
              if (prependApo) gc[0] = "'" + gc[0];
              append(await buildCompressedBlock(gc));
            }
            si += group.length;
          }
        }
      }
    } else if (HANGUL_RE.test(tok)) {
      for (const ch of [...tok]) append(buildHangulBlock(ch));
    } else if (IS_PUNCT.has(tok)) {
      append(await buildBlock(tok, tok, false, false, true));
    }
  }

  canvasEl.appendChild(frag);

  cvProportional      = prevCV;
  syllCompress        = prevSC;
  syllableCompression = prevSyllC;
  numberCompression   = prevNumC;
  showTonic           = prevTonic;
  halfSpace           = prevHalf;
  noExternalPad       = prevNoExt;
}

