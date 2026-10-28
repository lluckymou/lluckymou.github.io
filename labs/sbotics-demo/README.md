# sBotics `IMP-UX.02` prototype

Three.js visual continuation of the approved `IMP-UX.01` shell. The original folder remains unchanged so each UX gate is independently reviewable.

## Open

The folder is a self-contained static runtime: its images, fonts, 3D models, Three.js, Rapier and required loader modules are included under `assets/` and `vendor/`. No root `source/`, `node_modules/` or npm install is needed to run it.

From the folder itself, start any static HTTP server:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

Tile line art remains as separate PNG files under `assets/default-tiles/tile_lines/`; catalog and Robot-component thumbnails are generated dynamically in 3D, so pre-rendered `tile_icons/` and `robot-previews/` are not bundled. Robot-component previews use `#354048`, a 1.5× greater camera distance, and approved preview-only per-part rotations; complete Robot thumbnail backgrounds and persisted Robot orientations remain unchanged. In Robot Workshop Inspect, the scene-parts list appears only while the Controller is selected. `default-tile-packages-sanitized.json` remains because the Arena editor reads its object, score, exit and generation metadata; its unused icon references were removed. `assets/source-provenance.json` records original paths, hashes and Unity GUIDs where available. `assets/RIGHTS.md` preserves the project owner's branding authorization; vendored JavaScript, Codicons, Noto Sans, Noto Sans Mono, Noto Sans Symbols 2 and Noto Color Emoji keep their license notices beside the files; application text and emoji rendering use local fonts.

On narrow/touch screens, the shell follows the dynamic viewport and safe areas, mobile toast spacing avoids reserving hidden gesture help, Preferences fills the available height with its own scrollable content, and opening the profile emoji picker leaves Search unfocused until tapped.

Serve the folder at its own URL root (for example, copy `prototype/imp-ux-02/` to a static site's document root). If the host serves Rapier's `.wasm` file, it should use the standard `application/wasm` MIME type. Local libraries/preferences remain scoped to the browser origin where this folder is served.

## What changed

- `Simulação`, `Robôs` and `Arenas` mount one local Three.js renderer instead of the former CSS spatial mock.
- The Robot Workshop opens with the source-backed Trekker default robot. My Robots exposes the four bundled Unity defaults (Trekker, Obsidian, Bruna and Boryszin); the personal library starts empty. New/empty personal robots start with only the Controller.
- Robot files now export as canonical `RobotDocumentV1` JSON (with a deterministic document hash) and import both that format and legacy plain/encrypted `.sBot`/`.sb` files. The importer accepts the historical prototype hash that included an empty metadata object, while new exports use the normalized hash form; older duplicate/invalid component names enter the existing review/suggestion step instead of blocking the whole file. Legacy anchors, materials and Unity Z→X→Y Euler rotations are validated and converted to the Workshop's 24 orthogonal orientations before the personal copy is opened.
- Official robots are read-only: their dirty action is `Salvar cópia` / `Save a copy`. The copy opens automatically as the current personal robot, while later saves update that personal document. Switching robots or sections with dirty work opens Cancel/Discard/Save (or Save Copy) recovery instead of blocking with a toast.
- Every robot part has one invisible, camera-raycastable logical slot exactly `1×1×1`; the selection outline uses that slot rather than the rendered footprint, so the Large Wheel can visibly overhang without enlarging its selection. Inspect also exposes the same 19 stable targets as an accessible list. The six contextual quarter-turn controls now rotate the selected component in the scene as well as updating its orientation readout.
- Robot modes have separate interaction contracts: Inspect selects and edits a part, Place arms a sidebar piece and places it on the clicked face, Paint arms a default-white color and applies it on the next paintable-part click, and Erase deletes on click. Erase keeps **Forçar exclusão** off by default and asks for confirmation with the complete dependent closure before cascading; the Controller root remains protected.
- On desktop, keys `1`–`4` switch Robot Workshop modes with guarded keycap tooltips; shortcuts stay inert while focus is in a search, name editor, control, dialog or popup. Returning to Inspect selects the last placed part, and placing a servo or sensor returns to Inspect with that new part selected.
- Computer-only editing shortcuts keep the left button mode-dependent: Delete/Backspace removes the selected part from Inspect, middle-click always switches to Inspect and selects the part, right-click deletes in Place, paints white in Paint and is inert in Erase. A floating Edit history popup stores the last 20 document states and restores a chosen previous state; its Undo/Redo controls also respond to `Ctrl+Z`/`Ctrl+Y` (and `Ctrl+Shift+Z`).
- Inspecting the Controller exposes temporary group visualization: each rigid group gets a distinct, slightly expanded depth-tested slot outline and legend; selecting another part hides it. Individual parts can temporarily show their own group, while the selected slot uses a smaller inner surface frame. Groups follow the first Servo/Hinge in the directed anchor ancestry. Adjacent non-cyclic parent candidates are computed from the actual grid, and ambiguous parts expose a no-move anchor cycle control.
- Source-backed FBX models are loaded for Wedge, Pyramid, Corner, both inclined sensors and the Light's LED. The composite fixture keeps the Unity silhouettes for Hinge, Buzzer, Servo, Touch, Camera and Pen, including the inclined sensor planes, asymmetric ultrasonic eyes, glass LED enclosure and the Pen's all-yellow body/pyramid with two orange ribbons.
- Robot surfaces use the local 256×256 source `noise.png` through shared deterministic 32×32 crops; wedges use 40×40 crops for their larger diagonal face and Large Wheels use 64×64 crops for their curved 1.5× visual footprint. The crops are reused by logical coordinate and applied to the diffuse material so the noise remains visible under flat lighting without adding a texture per block. The renderer caps device pixels at 1.5×, uses one 512² directional shadow map fitted to the current Workshop bounds, renders on demand, caches repeated FBX templates and shares their geometry across rebuilds. Dense Workshops progressively reduce GPU work: repeated LED glass and low-poly LED meshes are instanced, LED source meshes sharing a material are merged, dense scenes use a 1× device-pixel ceiling and skip the shadow pass while preserving the normal quality path for smaller scenes.
- When `Mostrar FPS` / `Show FPS` is enabled in Preferences, the Three.js surfaces show a small live FPS pill in the lower-right corner of Simulator, Robot Workshop, Arena Editor and active event views; the continuous measurement loop is stopped when the preference or 3D surface is off. The shared render scheduler also caps normal interaction renders at 60 FPS, including camera drags on high-refresh displays.
- The Workshop adds a `0.78` ambient fill plus a non-shadowing lower directional fill only while the Robot scene is mounted, keeping unlit faces readable while preserving directional shadows. The fills do not cast shadows or allocate another shadow map.
- The 3D spaces use a clean dark background: no decorative star particles and no octagonal Workshop platform.
- The Arena is a source-informed **OBR Estadual visual fixture**: source local Tile images, Start, Goal/Finish Lane, marked intersection, random-Tile indicators, markable/checkpoint projections, elevated Tiles with four supports, boxes, rescue kit, victims, Seesaw and a local `RescueArea.fbx` render.
- The demo profile is **Lucas**. Personal Robot, Arena and Tile libraries start empty. User-created, copied and imported Arenas, Robots and Tiles persist across refreshes in a same-browser local demo store. Account preferences use a versioned local working copy; device layout, resource selection, unfinished drafts and generated thumbnails remain device-local. Code paths are marked `FUTURE-BACKEND`; there is no server sync yet. Program resources remain fixtures until their local persistence arrives in IMP-UX.03.
- Composite source presets are expanded when an Arena is loaded into their authored atomic `1×1` cell instances; the rescue-push fixture therefore uses nine source-backed cells for its `3×3` rescue room, never one selectable `3×3` Tile record.
- Opening Diagnostics during a local routine allows selecting the loaded robot/component in the 3D scene, moving it with WASD or the on-screen controls, and inspecting fixed-tick tracking, object-push, rescue, attempt and score events. Valid checkpoint occurrences render as thin orange directional wedges; repeated occurrences on one Tile keep separate directions.
- Diagnostics now derives one entry per functional Robot instance from the selected RobotDocument: Obsidian exposes its seven named Ultrasonic sensors, seven Servos, nine Color Sensors and three Touch Sensors with source-backed thumbnails, instance-scoped fixed-tick readings and selected Servo/Light/Buzzer/Pen actions. Component clicks remain inert while Diagnostics is closed; selected Ultrasonic rays are debug-only overlays.
- Routine path state now keeps checkpoint **trechos/segments** separate from scored line-tile occurrences: the topbar counter advances by checkpoint, tiles remain individually score-once, `Nova tentativa` respawns at the current segment checkpoint, and `Avançar` skips to the next checkpoint without awarding the skipped checkpoint or intervening tiles. OBR's `skip_path_threshold` still controls the locked → unlocked → re-locked Advance lifecycle.
- The Routine progress meter now counts path tile occurrences (`current tile / total path tiles`); it no longer uses the checkpoint-segment counter. The separate `Trecho X/Y` stat remains checkpoint-based.
- Routine attempt counters are also independent: `Tentativa` shows the attempt number inside the current checkpoint segment, while `tentativas totais` shows the global attempt count accumulated by the routine.
- `Restaurar seleção` persists the last materialized Arena random-resolution snapshot alongside the seed/difficulty and reapplies it immediately, so the restored Simulator opens with the same resolved Tiles and settings instead of waiting for a new roll.
- Selected Arena Tiles expose a localized **Visuals** section above Tile resources: baseplate color, support type (`Cantos/Corners`, `Fechado/Closed`, `Desativado/Disabled`) and support color use the same 16-color palette as Robot Workshop; missing visual fields default to white baseplate, corner supports and orange supports.
- Visuals also control the local `noise.png` baseplate texture. Rocky Plateau loads with noise disabled, full-cell Grass/Plane overlays folded into baseplate color, two full ramp planes folded into green ramps, and smaller River/Cyan planes preserved; changing Tile selection refreshes an open Objects window.
- The Objects window uses localized Robot-palette material names, calls the wedge object **Bloco inclinado / Inclined block**, shares the palette color mapping with Tile baseplates, and offers per-axis transform buttons with configurable steps plus an Advanced manual editor.
- Click a rendered Tile to open its contextual inspector. Mouse, touch and keyboard camera controls drive the Three.js camera with unrestricted horizontal orbit/pan accumulation, a lower default camera elevation, zoom-scaled pan sensitivity with fixed angular orbit sensitivity, a vertical polar range of `0°–180°` that allows exact top/bottom views without crossing either pole, and a broad `0.3×–64×` zoom range with constant-rate dolly sensitivity. By default, mouse uses grab-style drag and touch uses camera-style drag; **Inverter arrastar** in Preferences reverses both local directions.
- Continuous keyboard-action guideline: any command that represents held movement or zoom (`Z`/`X`, `-`/`=`/`+`, camera orbit/pan and future equivalent controls) must register state on `keydown`, apply motion from the animation loop, and clear it on `keyup`/blur. It must not perform a one-shot movement step directly inside `keydown`; discrete actions remain explicitly discrete and separately labeled.
- The camera context button and `R` return the camera to its initial position. The redundant bottom “selection/camera preserved” message is intentionally absent.

## Structure

The prototype now keeps the visual shell intact while giving the next rounds small, explicit boundaries:

- `app.js` is the browser composition root and UI/event coordinator.
- `user-data-store.js` is the single-user local demo store for explicitly saved personal Robots, Arenas and Tiles. Its `FUTURE-BACKEND` boundary is not account authentication or server sync; Programs join its local IndexedDB path in IMP-UX.03.
- `i18n.js` loads the local `i18n/pt-BR.json` and `i18n/en-US.json` catalogs with locale fallback and interpolation.
- `asset-registry.js` owns the local `assets/` paths and semantic image/model paths shared by the shell and Three.js.
- `arena-model.js` contains DOM-free Arena normalization, Tile footprints and path compilation.
- `simulation-physics.js` owns the disposable Rapier world, source-informed physics profile, static/dynamic colliders, rescue containment, Seesaw joint and Robot joint projection.
- `simulation-runtime.js` contains the local fixed-tick manual runtime, tracking, object contact and score-event fixture.
- `three-stage.js` remains the renderer bridge; its scene-specific extraction can happen as Arena and Routine runtime work grows.
- `scripts/prototype/check-imp-ux-02.mjs` is an optional repository-side structural check for locale parity, asset-boundary usage and Arena model invariants; it is not needed by the copied static runtime.

When working in the repository, the optional structural check can be run from its root with:

```bash
node --experimental-default-type=module scripts/prototype/check-imp-ux-02.mjs
```

## Boundary

This remains a local visual/debug prototype, with the bounded `OWN-068` physics release now enabled. The manual debug profile uses a disposable fixed-tick Three.js/Rapier world with source-backed masses, colliders, joints, victims, Seesaw and rescue fixtures; it does not claim canonical hidden OBR materialization, persistence, production/server authority, competition leases, passive replay physics or user-code execution. Static scene content, dynamic physics projection and visible UI updates must remain separate so closed Diagnostics and unchanged panels do no per-tick work.
