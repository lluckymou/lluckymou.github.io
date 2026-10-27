// Collision authority transcribed from enabled prefab Collider components
// joined in robot-registry-evidence.generated.json. Dimensions/centers use
// prefab-local Unity units except explicit ownerOverride records; render-only
// parts never add a collider here.
const box = (id, center, size, { sensor = false, ownerOverride = null } = {}) => ({
  id, kind: "box", sourceComponent: "BoxCollider", center, size, sensor,
  ...(ownerOverride ? { ownerOverride } : {})
});

const capsule = (id, size) => ({
  id,
  kind: "capsule",
  sourceComponent: "CapsuleCollider",
  center: [0, 0, 0],
  radius: Math.min(size[0], size[2]) / 2,
  height: size[1],
  axis: [0, 1, 0],
  sensor: false
});

const mesh = (id) => ({ id, kind: "mesh", sourceComponent: "MeshCollider", sensor: false });

export const ROBOT_COLLIDER_SPECS = Object.freeze({
  controller: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  cube: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  wedge: Object.freeze([mesh("mesh")]),
  hinge: Object.freeze([capsule("body", [0.5000001, 1, 0.5000001])]),
  smallWheel: Object.freeze([mesh("wheel")]),
  largeWheel: Object.freeze([mesh("wheel")]),
  slab: Object.freeze([box("body", [0, -0.25, 0], [1, 0.5, 1])]),
  pyramid: Object.freeze([mesh("mesh")]),
  corner: Object.freeze([mesh("mesh")]),
  buzzer: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  light: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  servo: Object.freeze([capsule("body", [0.80000016, 1, 0.80000016])]),
  colorSensor: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  ultrasonicSensor: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  touchSensor: Object.freeze([
    box("body", [0, 0, -0.1], [1, 1, 0.8]),
    box("probe", [0, 0, 0.4], [0.8, 0.8, 1 / 3], { sensor: true, ownerOverride: "OWN-074" })
  ]),
  camera: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  pen: Object.freeze([box("body", [0, 0, 0], [1, 1, 1])]),
  wedgeColorSensor: Object.freeze([mesh("mesh")]),
  wedgeUltrasonicSensor: Object.freeze([mesh("mesh")])
});

export function robotColliderNeedsMesh(typeId) {
  return (ROBOT_COLLIDER_SPECS[typeId] || []).some((shape) => shape.kind === "mesh");
}

function boxPoints(center, size) {
  return [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [
    center[0] + x * size[0] / 2,
    center[1] + y * size[1] / 2,
    center[2] + z * size[2] / 2
  ])));
}

function capsulePoints(shape, radialSegments = 16, hemisphereSteps = 4) {
  const { center, radius, height } = shape;
  const middleHalfHeight = Math.max(0, height / 2 - radius);
  const points = [];
  for (let step = 0; step <= hemisphereSteps; step += 1) {
    const theta = step * Math.PI / (2 * hemisphereSteps);
    const radial = radius * Math.sin(theta);
    const capOffset = radius * Math.cos(theta);
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = segment * Math.PI * 2 / radialSegments;
      const x = radial * Math.cos(angle);
      const z = radial * Math.sin(angle);
      points.push(
        [center[0] + x, center[1] + middleHalfHeight + capOffset, center[2] + z],
        [center[0] + x, center[1] - middleHalfHeight - capOffset, center[2] + z]
      );
    }
  }
  return points;
}

export function robotPrimitiveColliderPoints(shape) {
  if (shape.kind === "box") return boxPoints(shape.center, shape.size);
  if (shape.kind === "capsule") return capsulePoints(shape);
  return [];
}

export function robotPrimitiveColliderVolume(shape) {
  if (shape.kind === "box") return shape.size.reduce((volume, size) => volume * size, 1);
  if (shape.kind === "capsule") {
    const cylinderHeight = Math.max(0, shape.height - 2 * shape.radius);
    return Math.PI * shape.radius ** 2 * cylinderHeight + 4 * Math.PI * shape.radius ** 3 / 3;
  }
  return 0;
}
