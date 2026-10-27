// Runtime assets are bundled with this IMP so the folder can be copied and
// served independently from the repository and its original source tree.
const ASSETS = "./assets";

export const tileSurfacePath = (fileName) => fileName ? `${ASSETS}/default-tiles/tile_lines/${fileName}` : "";

export const asset = Object.freeze({
  icon: `${ASSETS}/branding/icon.png`,
  logo: `${ASSETS}/branding/logo.png`,
  wordmark: `${ASSETS}/branding/sBotics.png`,
  obrLogo: `${ASSETS}/logo-obr.png`,
  medals: Object.freeze({
    beginner: `${ASSETS}/medals/beginner.png`,
    experienced: `${ASSETS}/medals/experienced.png`,
    professional: `${ASSETS}/medals/professional.png`
  }),
  line: tileSurfacePath("start-line.png"),
  standardTilePackages: `${ASSETS}/default-tiles/default-tile-packages-sanitized.json`
});

export const tileImage = Object.freeze({
  start: tileSurfacePath("start-line.png"),
  line: tileSurfacePath("straight-line.png"),
  zigzag: tileSurfacePath("multi-zig-zag.png"),
  v: tileSurfacePath("v.png"),
  curve: tileSurfacePath("90-curve.png"),
  "t-intersection": tileSurfacePath("t-intersection.png"),
  "curve-circular": tileSurfacePath("simple-curve.png"),
  "curve-duo-circular": tileSurfacePath("duo-simple-curve.png"),
  "curve-long-circular": tileSurfacePath("long-circular-curve.png"),
  "curve-circular-step": tileSurfacePath("smooth-step-curve.png"),
  "curve-duo-circular-step": tileSurfacePath("duo-smooth-step-curve.png"),
  "curve-diagonal": tileSurfacePath("diagonal-step-curve.png"),
  "curve-duo-diagonal": tileSurfacePath("duo-diagonal-step.png"),
  "curve-square": tileSurfacePath("90-curve.png"),
  "curve-step": tileSurfacePath("step-curve.png"),
  "curve-small-long-square": tileSurfacePath("short-long-curve.png"),
  "curve-long-square": tileSurfacePath("long-curve.png"),
  "curve-diagonal-bump": tileSurfacePath("diagonal-step-curve.png"),
  intersection: tileSurfacePath("intersection.png"),
  gap: tileSurfacePath("gap.png"),
  gaps: tileSurfacePath("gaps.png"),
  "gap-intersection": tileSurfacePath("gap-intersection.png"),
  goal: tileSurfacePath("half-straight-line.png"),
  random: tileSurfacePath("simple-curve.png")
});

const ARENA_MODELS = `${ASSETS}/models/arena`;
export const ROBOT_SOURCE_ASSETS = Object.freeze({
  wedge: `${ARENA_MODELS}/WedgeObject.fbx`,
  pyramid: `${ARENA_MODELS}/Pyramid.fbx`,
  corner: `${ARENA_MODELS}/corner.fbx`,
  rescueKit: `${ARENA_MODELS}/kit_medium_poly.fbx`,
  zul: `${ASSETS}/models/robot/zulLowPolyFIX2.fbx`,
  led: `${ASSETS}/models/led/Led_RGB_LowPoly.fbx`
});

export const ROBOT_NOISE_TEXTURE = `${ASSETS}/textures/noise.png`;
export const RESCUE_AREA = `${ARENA_MODELS}/RescueArea.fbx`;
export const ARENA_RAMP = `${ARENA_MODELS}/rampa.fbx`;
