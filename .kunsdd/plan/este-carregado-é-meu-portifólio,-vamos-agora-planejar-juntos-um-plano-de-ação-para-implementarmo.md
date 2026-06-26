# Insta Post Generator — Implementation Plan

## Summary
Build a new labs page (`labs/insta.html`) that lets the user compose and preview an Instagram-style post background. The page reuses the existing sea (index.html), tree (tree.js), and sky rendering engines but replaces the live day-night cycle with manual, user-controlled settings. Layout is a preview panel (left/top on mobile) beside a settings panel (right/bottom on mobile). The output is a static canvas scene driven by user-chosen parameters.

## Source Request
> "vamos agora planejar juntos um plano de ação para implementarmos o gerador de posts no instagram hinted no 'labs/'. Esses posts na verdade serão mais o background do que o texto em si... na esquerda (ou no topo para celular) veremos o resultado, e na direita veremos as configurações para settar o post..."

---

## Architecture Decisions

1. **Single new file**: `labs/insta.html` — self-contained with inline `<style>` and `<script>`, matching the pattern of `labs/cassette.html` and `labs/englglyph.html`. No new JS modules; reuses `tree.js`, `nav.js`, `theme.js` (for palette/season definitions only — the live cycle is suppressed).

2. **Rendering reused from `index.html` and `me.html`**:
   - Sea background: copy the sky gradient + ocean swell + sun/moon + stars + clouds + glitter pipeline from `index.html`, but driven by a *paused* time value set by the user.
   - Trees: reuse `LlucTree.create()` from `tree.js`. Each tree instance gets its own tiny canvas layered over the background.
   - The "none" background reuses the flat paper-toned sky from `me.html` (`opts.sky` in tree.js, or a simple solid gradient).

3. **No day-night auto-cycle**: `theme.js` is loaded but `LlucTheme.init()` is NOT called with live updates. The scene stays frozen at the user's chosen time unless they change a setting.

4. **Wind**: Trees receive a steady sideways bias (`gust` or a direct `wind` offset) rather than the random oscillation. Direction (east/west) maps to positive/negative wind values.

5. **Tree layering**: Each tree runs on its own small canvas layered on top of the sea canvas. The tree's `layout` positions it at the bottom edge at the user-chosen X coordinate.

---

## Implementation Steps

### Step 1: Create `labs/insta.html` — HTML skeleton + CSS layout
- **Nav**: Standard page-nav from labs pages (same as `labs/labs.html`).
- **Layout**: CSS Grid or Flexbox with two panels:
  - Desktop: `grid-template-columns: 1fr minmax(320px, 420px)` (preview left, settings right).
  - Mobile: single column, preview on top, settings below.
- **Preview panel**: Contains a wrapper `<div>` that holds the background canvas (sea or none) and tree canvases. The wrapper respects the chosen aspect ratio (constrained by available width/height).
- **Settings panel**: A scrollable form-like column with sections for each setting group.
- **Update `labs/labs.html`**: Change the "insta" card from `dead` to a live `<a>` link pointing to `insta.html`.

### Step 2: Background rendering — sea mode
- Copy the core drawing functions from `index.html` into a self-contained renderer:
  - Palette keyframes (`KEYS` array, `getPalette()`, `lerp`, `lerpRGB`, `rgb`)
  - Sky gradient fill
  - Ocean swells (26 bands with tide, glitter, refraction)
  - Sun disc + glow
  - Moon disc + phases + eclipses
  - Stars (constellations + field) + planets
  - Clouds + weather
  - Horizon haze, vignette
- **Differences from index.html**:
  - The render loop only runs when settings change (or on a low-frequency RAF for the ocean swell animation — waves still animate, but time-of-day is frozen).
  - `totalDays` is replaced by a fixed `hour` (0–24) and a fixed `dayOfYear` (0–365) set by the user.
  - No drag/scrub interaction on the preview.
  - `horizonY` is adjustable via the settings slider (default 0.42 of canvas height).
- **Aspect ratio constraint**: The canvas is sized to fit inside the preview panel while maintaining the chosen ratio (1:1, 16:9, 3:4). Use CSS `aspect-ratio` on the wrapper, then size the canvas to fill it.

### Step 3: Background rendering — none mode
- "None" mode produces the flat paper-style background used in `me.html`'s header.
- Implementation: a simple `<canvas>` filled with a fixed gradient matching the `me.html` paper tone (e.g., `#e9e4d6` to `#e7e1cf`), or use `tree.js`'s built-in `sky` option with a single solid stop.
- This canvas still hosts trees and wind — it's just the background that differs.

### Step 4: Tree system — infinite tree instances
- Each tree is a small data object in a `trees[]` array.
- **Add tree button**: "Add tree" appends a new default tree to the array.
- **Remove tree button**: Each tree in the settings list has a remove (✕) button.
- Each tree renders on its own `<canvas>` element layered over the background canvas. The canvas is positioned absolutely inside the preview wrapper, sized to the full preview area.
- Tree parameters (stored per tree):
  - `algorithm`: `'esc'` (branchVariety: true) or `'me'` (branchVariety: false/undefined)
  - `height` → maps to `baseLen` (function of canvas height)
  - `trunkHeight` → when set, draws a long trunk from bottom to canopy via `layout.trunkBaseY`
  - `maxDepth` → branching depth cap (default 9)
  - `x` → horizontal position (0–100% of preview width), maps to `layout.rootX`
  - `season` → one of: `'winter'`, `'spring'`, `'summer'`, `'autumn'`
- On any tree parameter change, call `tree.regenerate()` or destroy and recreate.

### Step 5: Wind system
- A global wind setting with two controls:
  - **Direction**: east (→ right, positive) or west (← left, negative)
  - **Intensity**: 0 (calm) to 1 (strong gust)
- Wind is applied continuously: each frame, set a steady `gust()` or adjust the base wind offset on every tree.
- Rather than using the random oscillation, inject a steady offset: when wind is active, `tree.gust(direction * intensity * 0.1)` per frame (or similar small increment).
- This keeps the trees swaying in the chosen direction, matching the `me.html` wind feel.

### Step 6: Time-of-day / sun position controls
- When background is "sea":
  - **Hour slider**: 0–24 (time of day), drives the palette, sun position, moon position, stars.
  - **Day of year slider**: 0–365 (drives season for the sea — sun height, weather bias, day length). Can be labeled as "month" or "season".
  - **Horizon height slider**: 0.15–0.85 fraction of canvas height.
- When background is "none":
  - These controls are hidden or disabled (no sea to configure).
  - The sky color for the "none" canvas could optionally take a tint from the hour — but keep it simple: just a fixed paper tone.

### Step 7: Settings panel UI
Organized in collapsible sections or a vertical scroll:

1. **Canvas** 
   - Aspect ratio: three buttons/toggles (1:1, 16:9, 3:4)
2. **Background**
   - Mode: two buttons (sea / none)
3. **Sky** (visible only when mode = sea)
   - Time of day: range slider 0–24
   - Day of year: range slider 0–365 (or month selector)
   - Horizon height: range slider 15%–85%
4. **Wind**
   - Direction: east / west toggle
   - Intensity: range slider 0–1
5. **Trees** — list of added trees
   - Each tree gets a subsection with:
     - Algorithm: esc / me toggle
     - Height: range slider
     - Trunk height: range slider (0 = auto/default)
     - Max depth: range slider 3–12
     - X position: range slider 0–100%
     - Season: 4-button toggle (spring/summer/autumn/winter)
     - Remove button
   - "＋ Add tree" button at the bottom

### Step 8: Export / screenshot
- Optional: A "save as PNG" button that renders the current preview at a higher resolution and triggers a download.
- Use `canvas.toBlob()` or `canvas.toDataURL()` on the main background canvas and composite all tree canvases.
- This step can be deferred to a follow-up, but the architecture should support it (all canvases in one wrapper).

---

## Files to Modify

| File | Change |
|------|--------|
| `labs/insta.html` | **NEW** — the post generator page |
| `labs/labs.html` | Change insta card from `dead` div to live `<a href="insta.html">` |

---

## Reused Assets (no changes needed)

| Asset | Role |
|-------|------|
| `assets/tree.js` | Procedural tree rendering (`LlucTree.create`) |
| `assets/nav.js` | Navigation bar + ESC menu (loaded as-is) |
| `assets/content.css` | Base content styling |
| `assets/theme.js` | Loaded for `LlucTheme.cssVar()` — but `init()` not called with live updates |

---

## Risks & Mitigations

1. **Performance with many trees**: Each tree runs its own canvas + RAF. Mitigation: Cap at ~10 trees, pause trees that are scrolled out (though here all are visible). Use low `maxDPR`, `maxPixels` for each tree canvas.

2. **Sea rendering complexity**: The index.html draw loop is ~800 lines and deeply interwoven with the live time simulation. Mitigation: extract only the drawing functions (palette, sky, ocean, sun, moon, stars, clouds, glitter). Replace the live time variables with fixed values from settings. Keep the wave animation (it uses a `T` clock independent of time-of-day).

3. **Aspect ratio canvas sizing**: Need to ensure the canvas internal resolution matches the displayed size while respecting DPR. Mitigation: size the canvas wrapper with CSS `aspect-ratio`, then set canvas width/height to the wrapper's clientWidth/clientHeight × DPR.

4. **Tree canvas stacking**: Multiple canvases layered with `position: absolute` may cause z-ordering issues. Mitigation: use a flat array of canvases, all children of the same wrapper, with z-index matching array order.

5. **Mobile layout**: Settings panel below preview may push settings far down. Mitigation: make the preview reasonably compact on mobile (e.g., max-height: 50vh or 60vh) so settings are reachable.

---

## Test Plan

1. **Visual smoke test**: Open `labs/insta.html` in desktop and mobile viewports. Verify:
   - Preview and settings panels are visible side by side (desktop) / stacked (mobile).
   - Default sea background renders with ocean waves animating.
   - Changing aspect ratio resizes the preview correctly.
   - Switching to "none" mode shows the paper background.
2. **Tree test**: Add 3 trees. Change each tree's algorithm, height, season, position. Verify:
   - Trees appear at correct X positions.
   - "esc" trees have more asymmetric/varied branching than "me" trees.
   - Season change updates foliage colors (green → orange → bare+snow → pink blossoms).
   - Removing a tree works.
3. **Wind test**: Set wind east + intensity 1. Verify trees sway right. Switch to west, verify sway left. Set intensity 0, verify stillness.
4. **Sea settings test**: Change time-of-day slider and verify sky color, sun position, star visibility change. Change horizon slider and verify ocean area grows/shrinks.
5. **No auto-cycle test**: Leave the page open for several seconds — verify the sky does NOT change on its own (unlike index.html).
6. **Labs page**: Click the insta card on `labs/labs.html` and verify it navigates to the new page.
