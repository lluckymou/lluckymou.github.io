export const BOX_SOURCE_BASE_SCALE = Object.freeze({ x: 1.1, y: 0, z: 0.6 });

// Unity __sBotics__BoxObject adds these values after Tile.CreateObject applies
// the authored transform. The web projection keeps the lower face anchored.
export const BOX_SOURCE_VARIANTS = Object.freeze([
  Object.freeze({ id: "small", sourceIndex: 0, positionY: 1.2, scaleY: 2.6, scaleZ: 1.4 }),
  Object.freeze({ id: "medium", sourceIndex: 1, positionY: 1.5, scaleY: 3.2, scaleZ: 1.5 }),
  Object.freeze({ id: "large", sourceIndex: 2, positionY: 1.75, scaleY: 3.7, scaleZ: 1.6 })
]);

export const BOX_GROWTH_MAX = 0.05;
export const BOX_MATERIALS = Object.freeze([
  "ColorWhite", "ColorGray", "ColorDarkGray", "ColorBlack", "ColorGreen", "ColorLime",
  "ColorTeal", "ColorCyan", "ColorBlue", "ColorPurple", "ColorMagenta", "ColorPink",
  "ColorRed", "ColorBrown", "ColorOrange", "ColorYellow"
]);

const finitePositive = (value, fallback) => Number.isFinite(Number(value)) && Math.abs(Number(value)) > 1e-6
  ? Math.abs(Number(value))
  : fallback;

export function normalizedBoxSourceScale(scale = {}) {
  return {
    x: finitePositive(scale.x, BOX_SOURCE_BASE_SCALE.x),
    y: Number.isFinite(Number(scale.y)) ? Math.max(0, Number(scale.y)) : BOX_SOURCE_BASE_SCALE.y,
    z: finitePositive(scale.z, BOX_SOURCE_BASE_SCALE.z)
  };
}

export function boxDimensions(scale = BOX_SOURCE_BASE_SCALE, variant = BOX_SOURCE_VARIANTS[1], growth = 0) {
  const source = normalizedBoxSourceScale(scale);
  const factor = 1 + Math.max(0, Math.min(BOX_GROWTH_MAX, Number(growth) || 0));
  return {
    width: source.x * factor,
    height: (source.y + variant.scaleY) * factor,
    depth: (source.z + variant.scaleZ) * factor
  };
}

export function largestBoxDimensions() {
  return boxDimensions(BOX_SOURCE_BASE_SCALE, BOX_SOURCE_VARIANTS[2], 0);
}
