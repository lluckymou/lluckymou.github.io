import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { buildArenaObjectColliderBlueprint } from "./arena-object-collider-blueprint.js?imp-ux-02-arena-object-colliders-20261027-6";
import { ARENA_RAMP, RESCUE_AREA, ROBOT_NOISE_TEXTURE, ROBOT_SOURCE_ASSETS, tileImage } from "./asset-registry.js?imp-ux-02-standalone-assets-20261027-1";
import { ARENA_TILE_BASEPLATE_THICKNESS as ARENA_BASE_THICKNESS, ARENA_TILE_THIN_BASEPLATE_THICKNESS, ARENA_TILE_WALL_CENTER_Y, ARENA_TILE_WALL_SIDE_IDS, ARENA_TILE_WALL_SIDE_LAYOUT, arenaRampObjectTransform, arenaTileIsRamp, arenaTileWallPoint, arenaTileVisuals, arenaTileWallVerticalOffset } from "./arena-model.js?imp-ux-02-out-of-bounds-20261027-1";
import { RESCUE_POINT_SOURCE_ANCHOR, RESCUE_TRIGGER_SCALE, SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SOURCE_CELL_SIZE, SIMULATION_ROBOT_SURFACE_HEIGHT, environmentNormalSample, rescueTriggerOffsets, wedgeUltrasonicRayFrame } from "./simulation-runtime.js?imp-ux-02-routine-visual-replay-20261027-2";
import { SEESAW_PROFILE } from "./simulation-physics.js?imp-ux-02-seeded-randomization-20261027-1";
import { largestBoxDimensions } from "./box-profile.js?imp-ux-02-box-source-20260928-1";
import { isRobotColliderMesh } from "./robot-collider-geometry.js?imp-ux-02-component-sensor-feedback-20261023-14";
import { waitForRobotModelJobs } from "./robot-model-readiness.js?imp-ux-02-component-sensor-feedback-20261023-14";
import { ROBOT_COLLIDER_SPECS, robotColliderNeedsMesh, robotPrimitiveColliderPoints, robotPrimitiveColliderVolume } from "./robot-collider-specs.js?imp-ux-02-component-sensor-feedback-20261023-14";

const CELL_SIZE = 10;
const ROBOT_MODEL_READY_TIMEOUT_MS = 3000;
const ARENA_TILE_IMAGE_SIZE = CELL_SIZE + 0.04;
const arenaSurfaceImagePath = (entry, definition = entry?.definition) => {
  if (entry?.surfaceImageSuppressed) return "";
  if (entry?.imagePath) return entry.imagePath;
  if (entry?.images && Object.prototype.hasOwnProperty.call(entry.images, "surface")) return entry.images.surface?.path || "";
  return tileImage[entry?.image || definition?.image];
};
const LEVEL_HEIGHT = 3.6505;
const ARENA_BASE_TOP = 0.31;
const ARENA_BASE_BOTTOM = -ARENA_BASE_THICKNESS / 2;
const ARENA_SURFACE_PLANE_Y = ARENA_BASE_TOP + 0.03;
const RESCUE_EDITOR_VOLUME_SCALE = RESCUE_TRIGGER_SCALE;
const RESCUE_TRIGGER_HEIGHT = 2.2;
const ARENA_RAMP_PLATE_THICKNESS = ARENA_BASE_THICKNESS;
const ARENA_RAMP_TARGET_HIGH = ARENA_BASE_TOP + LEVEL_HEIGHT;
const ARENA_RAMP_SURFACE_ANGLE = Math.atan2(ARENA_RAMP_TARGET_HIGH - ARENA_BASE_TOP, CELL_SIZE);
const ARENA_RAMP_IMAGE_LENGTH = Math.hypot(CELL_SIZE, LEVEL_HEIGHT) + 0.04;
const tileBaseThickness = (visuals) => visuals?.thin === true ? ARENA_TILE_THIN_BASEPLATE_THICKNESS : ARENA_BASE_THICKNESS;
const tileBaseTopY = (thickness) => ARENA_BASE_BOTTOM + thickness;
const tileBaseCenterY = (thickness) => ARENA_BASE_BOTTOM + thickness / 2;
const tileSurfacePlaneY = (thickness) => tileBaseTopY(thickness) + 0.03;
const ARENA_SUPPORT_WALL_THICKNESS = 0.48;
const ARENA_SUPPORT_WALL_EDGE = CELL_SIZE / 2 - ARENA_SUPPORT_WALL_THICKNESS / 2;
const EVACUATION_L1_WALL_HEIGHT = 0.16282256;
const EVACUATION_PREVIOUS_L2_WALL_HEIGHT = 0.9846736;
const EVACUATION_L2_WALL_HEIGHT = EVACUATION_PREVIOUS_L2_WALL_HEIGHT * 2;
const ZUL_SOURCE_HEIGHT = 4.9105029958520245;
const DIAGNOSTICS_RESCUE_TRIGGER_COLOR = 0xbd44b3;
const DIAGNOSTICS_GAME_STOPPER_COLOR = 0xffbd59;
const ARENA_SPECIAL_OUTLINE_SCALE = 0.8;
const ARENA_SELECTION_OUTLINE_SCALE = 1.06;
const ROBOT_CELL_SIZE = 6;
// Unity's Robot frame is mirrored on X in Three.js; collider vertices use the
// same reflection when they are compiled into the Rapier group frames.
const ROBOT_VISUAL_MIRROR_X = -1;
const ROBOT_SHADOW_LIGHT_POSITION = new THREE.Vector3(-42, 62, 36);
const ROBOT_BOTTOM_FILL_LIGHT_OFFSET = new THREE.Vector3(-18, -42, -24);
const ROBOT_SHADOW_CAMERA_PADDING = ROBOT_CELL_SIZE * 0.5;
const ROBOT_NOISE_TILE_SIZE = 32;
const ROBOT_NOISE_WEDGE_TILE_SIZE = 40;
const ROBOT_NOISE_LARGE_WHEEL_TILE_SIZE = 64;
const ROBOT_NOISE_SOURCE_GRID = 8;
const ROBOT_NOISE_VISIBLE_MIN = 0.56;
const ROBOT_NOISE_SOURCE_MIN = 0.63;
const ROBOT_NOISE_SOURCE_RANGE = 0.37;
// Keep the source/canvas resolution unchanged: UV scale controls the authored
// world size, so special wedge/wheel tile sizes remain relative to their part.
const ROBOT_NOISE_WORLD_SCALE = 2;
// Blend half-way back toward the base material instead of making the Robot
// mesh transparent; this preserves depth, shadows and sensor-facing surfaces.
const ROBOT_NOISE_PATTERN_EFFECT = 0.5;
const ARENA_NOISE_TILE_SIZE = 128;
const ARENA_NOISE_SOURCE_GRID = 8;
const ARENA_NOISE_VARIANT_ORIGINS = Array.from({ length: 32 }, (_, index) => ({ x: (index * 3 + 1) % ARENA_NOISE_SOURCE_GRID, y: (index * 5 + 2) % ARENA_NOISE_SOURCE_GRID }));
const ROBOT_RENDER_FPS_CAP = 60;
const ROBOT_CAMERA_POLAR_MIN = 0;
const ROBOT_CAMERA_POLAR_MAX = Math.PI;
const ARENA_CAMERA_POLAR_MAX = Math.PI / 2;
const ARENA_SHADOW_MAP_SIZE = 4096;
const ARENA_SHADOW_BIAS = -0.00035;
const ARENA_SHADOW_NORMAL_BIAS = 0.025;
const ARENA_SHADOW_PADDING = CELL_SIZE * 0.25;
const STARTER_RESCUE_KIT_KEY = "__starter-rescue-kit";
const STARTER_RESCUE_KIT_SCALE = Object.freeze({ x: 1.25, y: 1.25, z: 1.25 });
const STARTER_RESCUE_KIT_HALF_EXTENT = STARTER_RESCUE_KIT_SCALE.x / 2;
const STARTER_RESCUE_KIT_PREVIEW_GAP = 0.22;
const ARENA_WHITE_MATERIAL_HEX = 0xffffff;
const ARENA_NOON_SUN_COLOR = new THREE.Color(0xfffdf9);
const ARENA_HORIZON_SUN_COLOR = new THREE.Color(0xffa66f);
const ARENA_NOON_SKY_COLOR = new THREE.Color(0xf3f8fb);
const ARENA_HORIZON_SKY_COLOR = new THREE.Color(0x7895aa);
const ARENA_NOON_GROUND_COLOR = new THREE.Color(0xcbd3d5);
const ARENA_HORIZON_GROUND_COLOR = new THREE.Color(0x53636e);
const ARENA_NOON_AMBIENT_COLOR = new THREE.Color(0xf4faff);
const ARENA_HORIZON_AMBIENT_COLOR = new THREE.Color(0xb4c3cc);
const ROBOT_NOISE_VARIANT_ORIGINS = Array.from({ length: 16 }, (_, index) => ({ x: index % ROBOT_NOISE_SOURCE_GRID, y: (Math.floor(index / ROBOT_NOISE_SOURCE_GRID) * 4 + (index * 3 + 1) % ROBOT_NOISE_SOURCE_GRID) % ROBOT_NOISE_SOURCE_GRID }));
const ROBOT_PEN_TIP_QUATERNION = { x: 0.5, y: -0.5, z: -0.5, w: -0.5 };
const ROBOT_SOURCE_HALF_TURN_X_QUATERNION = { x: 1, y: 0, z: 0, w: 0 };
// RobotManager replaces the instantiated prefab root rotation with the
// saved block rotation. WedgeObject.fbx contains a -90° X model node; Unity
// bakes that model node into the imported MeshFilter while FBXLoader keeps it
// as a child transform. This half-turn converts the loader frame to the
// Unity prefab frame. The source child frame is composed before this value
// (child * correction); the sensor Quads are already native Unity primitives
// in the canonical frame and must not receive the FBX correction.
const ROBOT_WEDGE_FRAME_CORRECTION_QUATERNION = { x: 0, y: 1, z: 0, w: 0 };
function multiplyRobotQuaternions(first, second) {
  return {
    x: first.w * second.x + first.x * second.w + first.y * second.z - first.z * second.y,
    y: first.w * second.y - first.x * second.z + first.y * second.w + first.z * second.x,
    z: first.w * second.z + first.x * second.y - first.y * second.x + first.z * second.w,
    w: first.w * second.w - first.x * second.x - first.y * second.y - first.z * second.z
  };
}
const ROBOT_WEDGE_MESH_FRAME_QUATERNION = ROBOT_WEDGE_FRAME_CORRECTION_QUATERNION;
const ROBOT_WEDGE_COLOR_CHILD_QUATERNION = { x: 0, y: 1, z: 0, w: 0 };
const ROBOT_WEDGE_COLOR_MESH_FRAME_QUATERNION = multiplyRobotQuaternions(ROBOT_WEDGE_COLOR_CHILD_QUATERNION, ROBOT_WEDGE_FRAME_CORRECTION_QUATERNION);
const ROBOT_WEDGE_ULTRASONIC_CHILD_QUATERNION = { x: 0, y: 0.70710677, z: -0.70710677, w: 0 };
const ROBOT_WEDGE_ULTRASONIC_MESH_FRAME_QUATERNION = multiplyRobotQuaternions(ROBOT_WEDGE_ULTRASONIC_CHILD_QUATERNION, ROBOT_WEDGE_FRAME_CORRECTION_QUATERNION);
const ROBOT_CORNER_MESH_FRAME_QUATERNION = multiplyRobotQuaternions(ROBOT_SOURCE_HALF_TURN_X_QUATERNION, ROBOT_WEDGE_FRAME_CORRECTION_QUATERNION);
const ROBOT_WEDGE_ULTRASONIC_FACE_QUATERNION = { x: 0, y: 0.92387956, z: -0.38268343, w: 0 };
const ROBOT_WEDGE_COLOR_FACE_QUATERNION = { x: 0.9238796, y: 0, z: 0, w: -0.38268325 };
const ROBOT_LIGHT_GLASS_BASE_OPACITY = 0.3;
const ROBOT_LIGHT_GLASS_LIT_OPACITY = ROBOT_LIGHT_GLASS_BASE_OPACITY * 1.5;
const ROBOT_LIGHT_GLOW_INTENSITY = 3;
const ROBOT_LIGHT_GLOW_DISTANCE = SIMULATION_ROBOT_SOURCE_CELL_SIZE * SIMULATION_ROBOT_SCALE;
const TOUCH_BUTTON_WIDTH = ROBOT_CELL_SIZE * 0.8;
const TOUCH_BUTTON_DEPTH = ROBOT_CELL_SIZE / 3;
const TOUCH_BUTTON_REST_Z = ROBOT_CELL_SIZE * 0.4;
const TOUCH_BUTTON_PRESSED_Z = ROBOT_CELL_SIZE * 0.25;
const ROBOT_COLOR_SENSOR_FACE_ROTATION = { x: -Math.PI / 2, y: 0, z: 0 };
const ROBOT_PAINTABLE_PART_IDS = new Set(["cube", "wedge", "hinge", "smallWheel", "largeWheel", "slab", "pyramid", "corner"]);
const ROBOT_PART_IDS = [
  "controller", "cube", "wedge", "hinge", "smallWheel", "largeWheel", "buzzer", "light", "servo",
  "colorSensor", "ultrasonicSensor", "touchSensor", "slab", "camera", "pen", "pyramid",
  "wedgeColorSensor", "wedgeUltrasonicSensor", "corner"
];
// These solid neighbors fill the LED's adjacent cell face enough that keeping
// the transparent LED glass face creates coplanar flicker. Wedges are included
// because their authored flat faces are the faces that can meet the LED cell.
const ROBOT_LED_FULL_FACE_NEIGHBOR_IDS = new Set([
  "controller", "cube", "wedge", "largeWheel", "slab", "pyramid", "corner", "buzzer", "light",
  "colorSensor", "ultrasonicSensor", "pen", "wedgeColorSensor", "wedgeUltrasonicSensor"
]);
const ROBOT_GRID_FACE_DIRECTIONS = Object.freeze([
  { key: "+x", x: 1, y: 0, z: 0 },
  { key: "-x", x: -1, y: 0, z: 0 },
  { key: "+y", x: 0, y: 1, z: 0 },
  { key: "-y", x: 0, y: -1, z: 0 },
  { key: "+z", x: 0, y: 0, z: 1 },
  { key: "-z", x: 0, y: 0, z: -1 }
]);
const ROBOT_PAINT_HEX = {
  white: 0xf5f4ee,
  gray: 0x6d7888,
  "dark-gray": 0x313c4c,
  black: 0x05090d,
  green: 0x20763a,
  lime: 0x27eb0d,
  teal: 0x15917c,
  cyan: 0x3aafd9,
  blue: 0x232254,
  purple: 0x792aab,
  magenta: 0xbd44b3,
  pink: 0xed8dac,
  red: 0xe21b25,
  brown: 0x6a360c,
  orange: 0xff5719,
  yellow: 0xd9d823
};
const ZUL_GAME_MATERIAL_HEX = Object.freeze({ ...ROBOT_PAINT_HEX, white: 0xffffff });
const ROBOT_BLACK_SURFACE_HEX = 0x111b24;
const ROBOT_GLOBAL_FALLBACK_HEX = ROBOT_PAINT_HEX.white;
const ROBOT_DEFAULT_HEX = {
  controller: 0x232254,
  cube: ROBOT_PAINT_HEX.white,
  wedge: ROBOT_PAINT_HEX.white,
  hinge: ROBOT_PAINT_HEX.white,
  smallWheel: ROBOT_PAINT_HEX.black,
  largeWheel: ROBOT_PAINT_HEX.black,
  buzzer: ROBOT_PAINT_HEX.black,
  light: 0x303842,
  servo: 0x303842,
  colorSensor: ROBOT_PAINT_HEX.teal,
  ultrasonicSensor: ROBOT_PAINT_HEX.purple,
  touchSensor: ROBOT_PAINT_HEX.gray,
  slab: ROBOT_PAINT_HEX.white,
  camera: 0x303842,
  pen: 0x303842,
  pyramid: ROBOT_PAINT_HEX.white,
  wedgeColorSensor: ROBOT_PAINT_HEX.teal,
  wedgeUltrasonicSensor: ROBOT_PAINT_HEX.purple,
  corner: ROBOT_PAINT_HEX.white
};

function servoArrowGeometry(radius, length = 2.4, width = 1.1, thickness = 0.08) {
  const half = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(0, length / 2);
  shape.lineTo(half, 0.2);
  shape.lineTo(half * 0.52, 0.2);
  shape.lineTo(half * 0.52, -length / 2);
  shape.lineTo(-half * 0.52, -length / 2);
  shape.lineTo(-half * 0.52, 0.2);
  shape.lineTo(-half, 0.2);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const tangent = position.getY(index);
    const vertical = position.getX(index);
    const radial = radius + position.getZ(index);
    const angle = tangent / radius;
    position.setXYZ(index, radial * Math.sin(angle), vertical, radial * Math.cos(angle));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function checkpointWedgeGeometry(side = 1.8, thickness = 0.12) {
  const half = side / 2;
  const triangleHeight = side * Math.sqrt(3) / 2;
  const baseZ = -triangleHeight / 3;
  const tipZ = triangleHeight * 2 / 3;
  const vertices = [
    -half, 0, baseZ, half, 0, baseZ, 0, 0, tipZ,
    -half, thickness, baseZ, half, thickness, baseZ, 0, thickness, tipZ
  ];
  const indices = [
    0, 1, 2, 3, 5, 4,
    0, 3, 4, 0, 4, 1,
    1, 2, 5, 1, 5, 4,
    2, 0, 3, 2, 3, 5
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function checkpointDirectionAngle(direction) {
  return {
    north: 0,
    east: Math.PI / 2,
    south: Math.PI,
    west: -Math.PI / 2
  }[direction] || 0;
}

function arenaScoreSideLabelSprite(text, opacity = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 72;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "700 28px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const radius = 12;
  const left = 4;
  const top = 4;
  const width = canvas.width - 8;
  const height = canvas.height - 8;
  context.beginPath();
  context.moveTo(left + radius, top);
  context.lineTo(left + width - radius, top);
  context.quadraticCurveTo(left + width, top, left + width, top + radius);
  context.lineTo(left + width, top + height - radius);
  context.quadraticCurveTo(left + width, top + height, left + width - radius, top + height);
  context.lineTo(left + radius, top + height);
  context.quadraticCurveTo(left, top + height, left, top + height - radius);
  context.lineTo(left, top + radius);
  context.quadraticCurveTo(left, top, left + radius, top);
  context.closePath();
  context.fillStyle = "rgba(11, 28, 39, 0.94)";
  context.fill();
  context.strokeStyle = "rgba(47, 169, 194, 0.96)";
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = "#f2fbff";
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.arenaScoreSideLabel = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.scale.set(2.7, 0.76, 1);
  sprite.material.opacity = opacity;
  sprite.renderOrder = 8;
  sprite.userData.debugOnly = true;
  return sprite;
}

function arenaScoreSideStatusSprite(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const cyan = "#53b8cc";
  const red = "#f06a78";
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = kind === "blocked" ? red : cyan;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = 10;
  context.lineCap = "round";
  if (kind === "blocked") {
    context.beginPath();
    context.arc(48, 48, 30, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(26, 70);
    context.lineTo(70, 26);
    context.stroke();
  } else {
    context.beginPath();
    context.arc(48, 48, 30, -5.35, 0);
    context.stroke();
    context.beginPath();
    context.moveTo(79, 60);
    context.lineTo(67, 44);
    context.lineTo(89, 44);
    context.closePath();
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.arenaScoreSideStatus = kind;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  sprite.scale.set(0.95, 0.95, 1);
  sprite.renderOrder = 9;
  sprite.userData.debugOnly = true;
  return sprite;
}

// This is a bounded source-informed OBR Estadual visual fixture. It intentionally
// proves spatial density and named Tile states; canonical hidden-layout materialization
// remains the later Arena-generation slice.
const OBR_VISUAL_FIXTURE = [
  { id: "start", x: -5, z: 0, image: "start", checkpoint: true },
  { id: "line-a", x: -4, z: 0, image: "line" },
  { id: "markable", x: -3, z: 0, image: "line", markable: true },
  { id: "checkpoint", x: -2, z: 0, image: "line", checkpointPlaced: true },
  { id: "random-curve", x: -1, z: 0, image: "random", random: true, rotation: 1 },
  { id: "curve-a", x: 0, z: 0, image: "curve", rotation: 1 },
  { id: "line-b", x: 0, z: 1, image: "line", rotation: 1 },
  { id: "box-lane", x: 1, z: 1, image: "gap", objects: ["box", "cylinder"] },
  { id: "curve-b", x: 2, z: 1, image: "curve", rotation: 2 },
  { id: "random-straight", x: 3, z: 1, image: "line", random: true },
  { id: "marked-intersection", x: -2, z: 1, image: "intersection", markedContent: true },
  { id: "curve-c", x: -3, z: 1, image: "curve", rotation: 3 },
  { id: "line-c", x: -4, z: 1, image: "line", rotation: 1 },
  { id: "elevated-line", x: -4, z: 2, y: 1, image: "line", rotation: 1 },
  { id: "elevated-curve", x: -3, z: 2, y: 1, image: "curve", rotation: 2 },
  { id: "seesaw", x: -2, z: 2, y: 1, image: "line", objects: ["seesaw"] },
  { id: "line-d", x: -1, z: 2, image: "line" },
  { id: "goal", x: 0, z: 2, image: "goal", goal: true },
  { id: "line-e", x: 1, z: 2, image: "line" },
  { id: "random-curve-b", x: 2, z: 2, image: "random", random: true, rotation: 2 },
  { id: "rescue-0", x: 3, z: -1, image: null, rescue: true },
  { id: "rescue-1", x: 4, z: -1, image: null, rescue: true },
  { id: "rescue-2", x: 5, z: -1, image: null, rescue: true },
  { id: "rescue-3", x: 3, z: 0, image: null, rescue: true },
  { id: "rescue-4", x: 4, z: 0, image: null, rescue: true, objects: ["rescue"] },
  { id: "rescue-5", x: 5, z: 0, image: null, rescue: true },
  { id: "rescue-6", x: 3, z: 1, image: null, rescue: true },
  { id: "rescue-7", x: 4, z: 1, image: null, rescue: true },
  { id: "rescue-8", x: 5, z: 1, image: null, rescue: true }
];

function color(value) {
  return new THREE.Color(value);
}

function material(value, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: value, roughness: 0.66, metalness: 0.02, ...extra });
}

function robotOcclusionBoxGeometry(size, hiddenFaces = new Set()) {
  const half = size / 2;
  const faces = [
    ["+x", [[half, -half, -half], [half, half, -half], [half, half, half], [half, -half, half]]],
    ["-x", [[-half, -half, half], [-half, half, half], [-half, half, -half], [-half, -half, -half]]],
    ["+y", [[-half, half, -half], [-half, half, half], [half, half, half], [half, half, -half]]],
    ["-y", [[-half, -half, half], [-half, -half, -half], [half, -half, -half], [half, -half, half]]],
    ["+z", [[half, -half, half], [half, half, half], [-half, half, half], [-half, -half, half]]],
    ["-z", [[-half, -half, -half], [-half, half, -half], [half, half, -half], [half, -half, -half]]]
  ];
  const positions = [];
  const indices = [];
  faces.forEach(([key, corners]) => {
    if (hiddenFaces.has(key)) return;
    const offset = positions.length / 3;
    corners.forEach((corner) => positions.push(...corner));
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function arenaObjectOpacity(object) {
  if (object?.type === "evacuationPoint") return 1;
  const value = Number(object?.opacity);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

function arenaObjectMaterialOptions(object, extra = {}) {
  const opacity = arenaObjectOpacity(object);
  return { ...extra, transparent: opacity < 0.999, opacity, depthWrite: opacity >= 0.999 };
}

function arenaVisualColor(value, fallback = ARENA_WHITE_MATERIAL_HEX) {
  if (value === "white") return ARENA_WHITE_MATERIAL_HEX;
  return ROBOT_PAINT_HEX[value] ?? fallback;
}
const ARENA_OBJECT_MATERIAL_COLOR_IDS = Object.freeze({
  ColorWhite: "white", ColorGray: "gray", ColorDarkGray: "dark-gray", ColorBlack: "black",
  ColorGreen: "green", ColorLime: "lime", ColorTeal: "teal", ColorCyan: "cyan",
  ColorBlue: "blue", ColorPurple: "purple", ColorMagenta: "magenta", ColorPink: "pink",
  ColorRed: "red", ColorBrown: "brown", ColorOrange: "orange", ColorYellow: "yellow"
});
function arenaObjectMaterialColor(value) {
  return arenaVisualColor(ARENA_OBJECT_MATERIAL_COLOR_IDS[value]);
}

function robotNoiseVariantIndex(position = {}) {
  const x = Math.trunc(Number(position.x) || 0);
  const y = Math.trunc(Number(position.y) || 0);
  const z = Math.trunc(Number(position.z) || 0);
  return (((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % ROBOT_NOISE_VARIANT_ORIGINS.length;
}

function arenaNoiseHash(position = {}) {
  const x = Math.trunc(Number(position.x) || 0);
  const y = Math.trunc(Number(position.y) || 0);
  const z = Math.trunc(Number(position.z) || 0);
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0;
}

function arenaNoiseVariant(position = {}) {
  const hash = arenaNoiseHash(position);
  return {
    index: hash % ARENA_NOISE_VARIANT_ORIGINS.length,
    rotation: ((hash >>> 7) % 4) * (Math.PI / 2)
  };
}

function sourceCoordinate(value) {
  return value * CELL_SIZE;
}

// Unity's Arena coordinates use +Z away from the WebGL camera. Three.js uses
// -Z as the camera-facing forward convention, so Arena data crosses this
// boundary with a reflected Z and the matching Y-rotation sign.
function arenaWorldX(value) {
  return sourceCoordinate(value);
}

function arenaWorldZ(value) {
  return -sourceCoordinate(value);
}

function arenaLocalPosition(position = {}) {
  return { x: Number(position.x) || 0, y: Number(position.y) || 0, z: -(Number(position.z) || 0) };
}

function arenaLocalRotation(rotation = {}) {
  return { x: -(Number(rotation.x) || 0), y: -(Number(rotation.y) || 0), z: Number(rotation.z) || 0 };
}

function disposeObject(root) {
  root.traverse((item) => {
    if (!item.userData.sharedAssetGeometry) item.geometry?.dispose?.();
    if (item.material?.map?.userData?.arenaScoreSideLabel) item.material.map.dispose();
    if (Array.isArray(item.material)) item.material.forEach((entry) => entry.dispose?.());
    else item.material?.dispose?.();
    [item.userData.starterKitStandardMaterial, item.userData.starterKitGhostMaterial]
      .filter((entry) => entry && entry !== item.material)
      .forEach((entry) => entry.dispose?.());
  });
}

function visibleWorldBounds(root) {
  const bounds = new THREE.Box3();
  if (!root) return bounds;
  root.updateWorldMatrix(true, true);
  const includeVisible = (object, ancestorsVisible = true) => {
    if (!ancestorsVisible || !object.visible || object.userData?.shadowBoundsExcluded) return;
    if (object.isMesh && object.geometry) bounds.expandByObject(object);
    object.children.forEach((child) => includeVisible(child));
  };
  includeVisible(root);
  return bounds;
}

class ThreeStage {
  constructor({ interactive = true } = {}) {
    this.interactive = interactive;
    this.scope = "arena-editor";
    this.passiveReplayMode = false;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "three-stage-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.dataset.renderer = "threejs";
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x152636, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.AgXToneMapping ?? THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
    this.cameraTarget = new THREE.Vector3();
    this.cameraViewDirection = new THREE.Vector3();
    this.cameraStableUp = new THREE.Vector3();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.textureLoader = new THREE.TextureLoader();
    this.fbxLoader = new FBXLoader();
    this.textures = new Map();
    this.robotAssetCache = new Map();
    this.arenaAssetCache = new Map();
    this.robotNoiseSourceRef = null;
    this.robotNoiseVariants = new Map();
    this.robotNoiseVariantCanvases = new Map();
    this.arenaNoiseSourceRef = null;
    this.arenaNoiseVariants = new Map();
    this.arenaNoiseVariantCanvases = new Map();
    this.robotTextureGeometryCache = new Map();
    this.pickables = [];
    this.pickTargets = new Map();
    this.robotComponents = new Map();
    this.robotPenTrails = new Map();
    this.sensorCaptureTargets = new Map();
    this.sensorCaptureLastAt = new Map();
    this.diagnosticsSelectionOutlines = new Map();
    this.sensorCaptureCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 16);
    this.sensorCaptureColorCamera = new THREE.OrthographicCamera(-0.155, 0.155, 0.155, -0.155, 0.01, 32);
    this.robotColliderBlueprint = null;
    this.robotPhysicsProjected = false;
    this.diagnosticsRobotColliderLines = [];
    this.editorLayers = [];
    this.arenaOutlines = new Map();
    this.markableOutlinesHidden = null;
    this.mode = "";
    this.workshopPartsKey = "";
    this.arenaKey = "";
    this.trackingVisualStateKey = "";
    this.selectionOutline = null;
    this.selectionOutlineMode = "none";
    this.selectionHighlight = false;
    this.groupOutlines = [];
    this.groupHighlightKey = "";
    this.workshopTarget = new THREE.Vector3(0, 2.5, 0);
    this.workshopCameraRadius = 110;
    this.simulatorRobot = null;
    this.simulatorRobotBasePose = null;
    this.simulationObjects = new Map();
    this.arenaObjectColliderBlueprintCache = null;
    this.starterKitColliderBlueprintCache = null;
    this.starterRescueKitGhost = null;
    this.starterRescueKitColliderSource = null;
    this.diagnosticsSensorOverlays = new Map();
    this.diagnosticsRobotColliderOverlay = null;
    this.diagnosticsRobotColliderKey = "";
    this.diagnosticsArenaColliderOverlay = null;
    this.arenaShadowRoot = null;
    this.arenaPlacementSurface = null;
    this.arenaPlacementGrid = null;
    this.arenaPlacementGhost = null;
    this.arenaPlacementTarget = null;
    this.host = null;
    this.spec = null;
    this.pointerStart = null;
    this.renderQueued = false;
    this.showFps = false;
    this.fpsOverlay = null;
    this.fpsAnimationHandle = null;
    this.fpsFrameCount = 0;
    this.fpsSampleStartedAt = 0;
    this.fpsLastRenderAt = 0;
    this.renderLastAt = 0;
    this.pendingAssetPromises = new Set();
    this.fpsTick = (timestamp) => this.updateFps(timestamp);
    this.workshopLightGlass = null;
    this.workshopLightGlassNextIndex = 0;
    this.workshopLightModelMeshes = [];
    this.robotPartsForRendering = [];
    this.workshopFillLight = null;
    this.workshopBottomFillLight = null;
    this.arenaAmbientFillLight = null;
    this.environmentHemisphereLight = null;
    this.workshopRimLight = null;
    this.workshopKeyLight = null;
    this.shadowCameraDefaults = null;
    this.resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => this.resize());

    this.addEnvironment();
    if (this.interactive) {
      this.canvas.addEventListener("pointerdown", (event) => {
        this.pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      });
      this.canvas.addEventListener("pointerup", (event) => this.pick(event));
      this.canvas.addEventListener("pointercancel", () => { this.pointerStart = null; });
      // The shell captures the pointer on #stage for camera gestures; listen at
      // document level too so a click still reaches the spatial editor after
      // that capture retargets pointerup away from the canvas.
      document.addEventListener("pointerup", (event) => this.pick(event));
      document.addEventListener("pointermove", (event) => this.updateArenaPlacementPointer(event));
      document.addEventListener("pointercancel", () => { this.pointerStart = null; });
    }
  }

  trackAssetPromise(promise) {
    const tracked = Promise.resolve(promise);
    this.pendingAssetPromises.add(tracked);
    tracked.then(() => this.pendingAssetPromises.delete(tracked), () => this.pendingAssetPromises.delete(tracked));
    return tracked;
  }

  async whenAssetsReady() {
    while (this.pendingAssetPromises.size) await Promise.allSettled([...this.pendingAssetPromises]);
  }

  addEnvironment() {
    this.environmentHemisphereLight = new THREE.HemisphereLight(0xa9d9ee, 0x294655, 2.3);
    this.scene.add(this.environmentHemisphereLight);
    const key = new THREE.DirectionalLight(0xffd6a8, 2.8);
    key.position.copy(ROBOT_SHADOW_LIGHT_POSITION);
    key.castShadow = true;
    key.shadow.mapSize.set(ARENA_SHADOW_MAP_SIZE, ARENA_SHADOW_MAP_SIZE);
    key.shadow.bias = ARENA_SHADOW_BIAS;
    key.shadow.normalBias = ARENA_SHADOW_NORMAL_BIAS;
    this.workshopKeyLight = key;
    this.shadowCameraDefaults = {
      left: key.shadow.camera.left,
      right: key.shadow.camera.right,
      top: key.shadow.camera.top,
      bottom: key.shadow.camera.bottom,
      near: key.shadow.camera.near,
      far: key.shadow.camera.far
    };
    this.scene.add(key.target);
    this.scene.add(key);
    this.workshopRimLight = new THREE.PointLight(0x2fa9c2, 35, 170, 2);
    this.workshopRimLight.position.set(18, 22, -32);
    this.workshopRimLight.visible = false;
    this.scene.add(this.workshopRimLight);
    this.arenaAmbientFillLight = new THREE.AmbientLight(0xfff8ee, 0.12);
    this.arenaAmbientFillLight.visible = false;
    this.scene.add(this.arenaAmbientFillLight);
    // Workshop-only ambient fill keeps unlit faces readable without adding a
    // second shadow map or flattening the existing directional shadows.
    this.workshopFillLight = new THREE.AmbientLight(0xa9c7d8, 0.78);
    this.workshopFillLight.visible = false;
    this.scene.add(this.workshopFillLight);
    // A non-shadowing lower directional fill keeps the underside legible
    // while the key light remains the only light that writes a shadow map.
    const bottomFill = new THREE.DirectionalLight(0x76a9c7, 1.05);
    bottomFill.castShadow = false;
    bottomFill.visible = false;
    this.workshopBottomFillLight = bottomFill;
    this.scene.add(bottomFill.target);
    this.scene.add(bottomFill);
  }

  mount(host) {
    if (!host) return;
    if (this.host !== host || this.canvas.parentElement !== host) {
      this.resizeObserver?.disconnect();
      this.host = host;
      host.replaceChildren(this.canvas);
      host.classList.add("three-stage-host");
      this.resizeObserver?.observe(host);
    }
    this.ensureFpsOverlay(host);
    this.ensureRoutineLackProgressOverlay(host);
    this.resize();
  }

  ensureFpsOverlay(host) {
    if (!host) return;
    if (!this.fpsOverlay) {
      this.fpsOverlay = document.createElement("div");
      this.fpsOverlay.className = "three-stage-fps";
      this.fpsOverlay.setAttribute("role", "status");
      this.fpsOverlay.setAttribute("aria-live", "polite");
      this.fpsOverlay.textContent = "FPS —";
      this.fpsOverlay.hidden = true;
    }
    if (this.fpsOverlay.parentElement !== host) host.append(this.fpsOverlay);
  }

  setFpsEnabled(enabled) {
    const next = Boolean(enabled && this.host && this.canvas.parentElement === this.host);
    this.ensureFpsOverlay(this.host);
    if (next === this.showFps) {
      if (this.fpsOverlay) this.fpsOverlay.hidden = !next;
      return;
    }
    this.showFps = next;
    if (!next) {
      if (this.fpsAnimationHandle !== null && globalThis.cancelAnimationFrame) globalThis.cancelAnimationFrame(this.fpsAnimationHandle);
      this.fpsAnimationHandle = null;
      this.fpsFrameCount = 0;
      this.fpsLastRenderAt = 0;
      if (this.fpsOverlay) this.fpsOverlay.hidden = true;
      return;
    }
    this.fpsFrameCount = 0;
    this.fpsSampleStartedAt = globalThis.performance?.now?.() ?? Date.now();
    this.fpsLastRenderAt = 0;
    this.fpsOverlay.hidden = false;
    this.fpsOverlay.textContent = "FPS —";
    this.fpsAnimationHandle = globalThis.requestAnimationFrame?.(this.fpsTick) ?? null;
  }

  ensureRoutineLackProgressOverlay(host) {
    if (!host) return;
    if (!this.routineLackProgressOverlay) {
      const overlay = document.createElement("div");
      overlay.className = "routine-lack-progress-overlay";
      overlay.hidden = true;
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.setAttribute("aria-atomic", "true");
      const number = document.createElement("strong");
      number.className = "routine-lack-progress-number";
      const title = document.createElement("span");
      title.className = "routine-lack-progress-title";
      const reason = document.createElement("strong");
      reason.className = "routine-lack-progress-reason";
      overlay.append(number, title, reason);
      this.routineLackProgressOverlay = { root: overlay, number, title, reason };
    }
    if (this.routineLackProgressOverlay.root.parentElement !== host) host.append(this.routineLackProgressOverlay.root);
  }

  updateRoutineLackProgressOverlay(state = null) {
    const overlay = this.routineLackProgressOverlay;
    if (!overlay) return;
    const active = state && ["countdown", "failure"].includes(state.phase);
    overlay.root.hidden = !active;
    if (!active) return;
    const countdown = state.phase === "countdown";
    overlay.root.dataset.phase = state.phase;
    overlay.number.hidden = !countdown;
    overlay.title.hidden = countdown;
    overlay.reason.hidden = countdown;
    if (countdown) {
      const number = String(Math.max(1, Math.trunc(Number(state.number) || 1)));
      if (overlay.number.textContent !== number) overlay.number.textContent = number;
    }
    else {
      overlay.title.textContent = state.title || "";
      overlay.reason.textContent = state.reason || "";
    }
  }

  updateFps(timestamp) {
    if (!this.showFps || !this.host || this.canvas.parentElement !== this.host) {
      this.setFpsEnabled(false);
      return;
    }
    const now = Number.isFinite(timestamp) ? timestamp : (globalThis.performance?.now?.() ?? Date.now());
    if (this.fpsLastRenderAt && now - this.fpsLastRenderAt < 1000 / ROBOT_RENDER_FPS_CAP) {
      this.fpsAnimationHandle = globalThis.requestAnimationFrame?.(this.fpsTick) ?? null;
      return;
    }
    this.fpsLastRenderAt = now;
    this.render();
    this.fpsFrameCount += 1;
    const elapsed = now - this.fpsSampleStartedAt;
    if (elapsed >= 500) {
      const fps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.fpsOverlay.textContent = `FPS ${fps}`;
      this.fpsFrameCount = 0;
      this.fpsSampleStartedAt = now;
    }
    this.fpsAnimationHandle = globalThis.requestAnimationFrame?.(this.fpsTick) ?? null;
  }

  update(spec) {
    this.spec = spec;
    this.updateRoutineLackProgressOverlay(spec.routineLackProgressOverlay || null);
    if (this.canvas) {
      this.canvas.dataset.arenaPathEnabled = String(spec.arenaRuntimeConfig?.path?.enabled !== false);
      this.canvas.dataset.arenaSpawnPolicy = spec.arenaRuntimeConfig?.path?.spawnPolicy || "path-start";
      this.canvas.dataset.arenaOpenEdgeCount = String(spec.arenaRuntimeConfig?.path?.openEdges?.length || 0);
      this.canvas.dataset.arenaScoringEnabled = String(spec.arenaRuntimeConfig?.scoring?.enabled !== false);
      this.canvas.dataset.arenaStopOnTimeLimit = String(spec.arenaRuntimeConfig?.routine?.stopOnTimeLimit !== false);
      this.canvas.dataset.arenaHardEvacuationPoint = String(spec.arenaSettings?.hard_evacuation_point === true);
      const arenaEntries = Array.isArray(spec.arenaTiles) ? spec.arenaTiles : [];
      this.canvas.dataset.arenaEmptyTileCount = String(arenaEntries.filter((entry) => entry.emptyTile === true || entry.definition?.emptyTile === true).length);
      this.canvas.dataset.arenaFinishLaneCount = String(arenaEntries.flatMap((entry) => entry.objects || []).filter((object) => object.type === "plane" && object.label === "Finish Lane").length);
      this.canvas.dataset.arenaVisualOnlyRampCount = String(arenaEntries.filter((entry) => entry.visualOnlyRamp === true || entry.definition?.visualOnlyRamp === true).length);
      this.canvas.dataset.arenaDefaultRampInstanceCount = String(arenaEntries.filter((entry) => entry.rampInstance === true).length);
      const evacuationObjects = arenaEntries.flatMap((entry) => (entry.objects || []).filter((object) => object.type === "evacuationPoint"));
      this.canvas.dataset.arenaEvacuationObjectCount = String(evacuationObjects.length);
      this.canvas.dataset.arenaEvacuationRoles = [...new Set(evacuationObjects.map((object) => object.evacuationRole).filter(Boolean))].join(",");
      const randomResources = spec.arenaRuntimeConfig?.randomization?.resources || [];
      this.canvas.dataset.arenaRandomResourceCount = String(randomResources.length);
      this.canvas.dataset.arenaRandomResourceTypes = randomResources.map((resource) => resource.type).join(",");
      this.canvas.dataset.arenaTimeOfDay = spec.arenaSettings?.time_of_day || "12:00";
      if (this.scope === "simulation") {
        this.canvas.dataset.simulationRuntimeStatus = spec.simulationRuntime?.status || "ready";
        this.canvas.dataset.simulationRuntimePathSize = String(spec.simulationRuntime?.tracking?.total || spec.arenaRuntimeConfig?.path?.occurrences?.length || 0);
        this.canvas.dataset.simulationRuntimePathSegment = String(spec.simulationRuntime?.tracking?.segment || 0);
        this.canvas.dataset.simulationRuntimeTrackingStatus = spec.simulationRuntime?.tracking?.status || "outOfPath";
        this.canvas.dataset.simulationCheckpointArrowCount = String(spec.simulationRuntime?.tracking?.checkpointProjections?.length || spec.simulationCheckpointProjections?.length || 0);
        this.canvas.dataset.simulationSelection = spec.simulationSelection || "";
        this.canvas.dataset.simulationRuntimeScore = String(spec.simulationRuntime?.score?.points || 0);
        this.canvas.dataset.simulationRobotPose = spec.simulationRuntime?.robot ? JSON.stringify({ x: Number(spec.simulationRuntime.robot.x) || 0, y: Number(spec.simulationRuntime.robot.y) || 0, z: Number(spec.simulationRuntime.robot.z) || 0 }) : "";
      }
    }
    const mode = spec.section === "robots" ? "workshop" : "arena";
    const workshopPartsKey = mode === "workshop" ? JSON.stringify(spec.robotParts || []) : "";
    const simulatorRobotKey = this.scope === "simulation" ? { id: spec.simulatorRobot?.id || "", parts: spec.simulatorRobot?.parts || [], colors: spec.simulatorRobot?.colors || {}, rotations: spec.simulatorRobot?.rotations || {}, orientations: spec.simulatorRobot?.orientations || {} } : null;
    const arenaKey = mode === "arena" ? JSON.stringify({ section: spec.section || "simulator", id: spec.arenaId || "", model: spec.arenaModel || null, tiles: spec.arenaTiles || [], objectPreview: spec.arenaObjectPreview || null, objectThumbnail: spec.arenaObjectThumbnail || null, runtime: spec.arenaRuntimeConfig || null, simulatorRobot: simulatorRobotKey, arenaGridVisible: spec.arenaGridVisible !== false, hardEvacuationPoint: spec.arenaSettings?.hard_evacuation_point === true, scoreSideLabels: spec.arenaScoreSideLabels || null, placement: spec.arenaPlacement ? { tileId: spec.arenaPlacement.tileId || "", rotation: spec.arenaPlacement.rotation || 0, height: spec.arenaPlacement.y || 0 } : null, trackingCheckpoints: this.scope === "simulation" && spec.diagnostics ? spec.simulationRuntime?.tracking?.checkpointProjections || [] : null, preflightCheckpointSetup: this.scope === "simulation" && spec.preflightCheckpointSetup ? { selectable: spec.preflightCheckpointSelectableTileIds || [], selected: spec.preflightCheckpointSelectedTileIds || [] } : null }) : "";
    if (this.mode !== mode || (mode === "workshop" && this.workshopPartsKey !== workshopPartsKey) || (mode === "arena" && this.arenaKey !== arenaKey)) {
      this.build(mode);
      this.mode = mode;
      this.workshopPartsKey = workshopPartsKey;
      this.arenaKey = arenaKey;
    }
    this.applyState();
    this.refreshMarkableOutlines();
    this.refreshTrackingOutlines();
    this.updateCamera(spec.camera);
    this.setFpsEnabled(spec.showFps === true);
    this.requestRender();
  }

  updateSimulationFrame(simulationRuntime, routineLackProgressOverlay = null, simulationArenaColliderDebug = null, simulationDiagnosticsArenaCollidersVisible = false) {
    if (this.scope !== "simulation" || this.mode !== "arena" || !this.spec) return;
    this.spec = {
      ...this.spec,
      simulationRuntime,
      simulationArenaColliderDebug,
      simulationDiagnosticsArenaCollidersVisible,
      routineLackProgressOverlay,
      simulatorRobot: this.spec.simulatorRobot
        ? { ...this.spec.simulatorRobot, pose: simulationRuntime?.robot || null }
        : this.spec.simulatorRobot
    };
    this.updateRoutineLackProgressOverlay(routineLackProgressOverlay);
    this.applyState();
    this.refreshMarkableOutlines();
    this.refreshTrackingOutlines();
    this.requestRender();
  }

  applyPassiveReplayFrame(entities = {}, visualComponents = {}, cameraState = null) {
    if (!this.passiveReplayMode || !this.spec) return;
    const root = entities["robot-root"] || {};
    const rootPosition = Array.isArray(root.position) ? root.position : [0, SIMULATION_ROBOT_SURFACE_HEIGHT, 0];
    const rootRotation = Array.isArray(root.rotation) ? root.rotation : [0, 0, 0, 1];
    const [qx, qy, qz, qw] = rootRotation;
    const robot = {
      x: Number(rootPosition[0]) || 0,
      y: Number(rootPosition[1]) || SIMULATION_ROBOT_SURFACE_HEIGHT,
      z: Number(rootPosition[2]) || 0,
      yaw: Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qz * qz))
    };
    const robotGroupPoses = {};
    const objects = [];
    Object.entries(entities).forEach(([entityId, pose]) => {
      if (entityId.startsWith("robot-group:")) {
        const groupId = entityId.slice("robot-group:".length);
        const position = pose.position || [0, 0, 0];
        const rotation = pose.rotation || [0, 0, 0, 1];
        robotGroupPoses[groupId] = {
          translation: { x: Number(position[0]) || 0, y: Number(position[1]) || 0, z: Number(position[2]) || 0 },
          rotation: { x: Number(rotation[0]) || 0, y: Number(rotation[1]) || 0, z: Number(rotation[2]) || 0, w: Number.isFinite(Number(rotation[3])) ? Number(rotation[3]) : 1 }
        };
        return;
      }
      if (!entityId.startsWith("arena-object:")) return;
      const visualState = pose.visualState || {};
      const position = pose.position || [0, 0, 0];
      const rotation = pose.rotation || [0, 0, 0, 1];
      const object = {
        key: entityId.slice("arena-object:".length),
        type: String(visualState.type || "none"),
        dynamic: visualState.dynamic === true,
        visible: pose.visible !== false && visualState.visible !== false,
        resolved: visualState.resolved === true,
        rescued: visualState.rescued === true,
        resolution: String(visualState.resolution || "active"),
        position: { x: Number(position[0]) || 0, y: Number(position[1]) || 0, z: Number(position[2]) || 0 },
        rotation: { x: Number(rotation[0]) || 0, y: Number(rotation[1]) || 0, z: Number(rotation[2]) || 0, w: Number.isFinite(Number(rotation[3])) ? Number(rotation[3]) : 1 }
      };
      if (visualState.seesawAngle != null) object.seesawAngle = Number(visualState.seesawAngle) || 0;
      if (visualState.type === "box") {
        object.boxRuntime = {
          width: Number(visualState.boxWidth) || 0,
          height: Number(visualState.boxHeight) || 0,
          depth: Number(visualState.boxDepth) || 0,
          material: String(visualState.boxMaterial || "")
        };
      }
      objects.push(object);
    });
    const components = {};
    Object.entries(visualComponents || {}).forEach(([componentId, visual]) => {
      if (visual?.typeId === "light") {
        components[componentId] = {
          typeId: "light",
          readings: {
            lit: visual.lit === true,
            color: Array.isArray(visual.color)
              ? { r: Number(visual.color[0]) || 0, g: Number(visual.color[1]) || 0, b: Number(visual.color[2]) || 0 }
              : visual.color || { r: 0, g: 0, b: 0 },
            lampBrightness: Number(visual.lampBrightness) || 0
          }
        };
      } else if (visual?.typeId === "pen") {
        components[componentId] = {
          typeId: "pen",
          readings: {
            working: visual.working === true,
            color: Array.isArray(visual.color)
              ? { r: Number(visual.color[0]) || 0, g: Number(visual.color[1]) || 0, b: Number(visual.color[2]) || 0 }
              : visual.color || { r: 255, g: 128, b: 0 },
            trailPoints: (visual.trailPoints || []).map((point) => ({ x: Number(point[0]) || 0, y: Number(point[1]) || 0, z: Number(point[2]) || 0 }))
          }
        };
      }
    });
    const runtime = {
      status: "replay",
      robot,
      robotGroupPoses,
      robotRuntime: { groups: this.spec.simulationReplayRobotRuntimeGroups || [] },
      objects,
      components
    };
    this.spec.simulationRuntime = runtime;
    if (this.spec.simulatorRobot) this.spec.simulatorRobot = { ...this.spec.simulatorRobot, pose: robot };
    const recordedCamera = cameraState || this.spec.camera || {};
    this.spec.camera = {
      orbitX: Number(recordedCamera.orbitX) || 0,
      orbitY: Number(recordedCamera.orbitY) || 0,
      zoom: Number(recordedCamera.zoom) > 0 ? Number(recordedCamera.zoom) : 1,
      panX: 0,
      panY: 0,
      focusTileId: "",
      replayTarget: robot
    };
    this.updateCamera(this.spec.camera);
    this.applyState();
    this.requestRender();
  }

  build(mode) {
    this.clearDiagnosticsSelectionOutlines();
    this.clearDiagnosticsArenaColliderOverlay();
    disposeObject(this.world);
    this.world.clear();
    this.robotPenTrails.clear();
    this.pickables = [];
    this.pickTargets.clear();
    this.robotComponents.clear();
    this.robotColliderBlueprint = null;
    this.robotPhysicsProjected = false;
    this.diagnosticsRobotColliderLines = [];
    this.diagnosticsRobotColliderOverlay = null;
    this.diagnosticsRobotColliderKey = "";
    this.diagnosticsArenaColliderOverlay = null;
    this.workshopLightGlass = null;
    this.workshopLightGlassNextIndex = 0;
    this.workshopLightModelMeshes = [];
    this.robotPartsForRendering = [];
    this.editorLayers = [];
    this.arenaOutlines = new Map();
    this.markableOutlinesHidden = null;
    this.selectionOutline = null;
    this.selectionOutlineMode = "none";
    this.selectionHighlight = false;
    this.groupOutlines = [];
    this.groupHighlightKey = "";
    this.clearDiagnosticsRobotColliderOverlay();
    this.selectedId = "";
    this.arenaPlacementSurface = null;
    this.arenaPlacementGrid = null;
    this.arenaPlacementGhost = null;
    this.arenaShadowRoot = null;
    this.arenaKey = "";
    this.trackingVisualStateKey = "";
    this.renderLastAt = 0;
    this.renderer.shadowMap.enabled = true;
    if (this.workshopFillLight) this.workshopFillLight.visible = mode === "workshop";
    if (this.workshopBottomFillLight) this.workshopBottomFillLight.visible = mode === "workshop";
    if (this.workshopRimLight) this.workshopRimLight.visible = mode === "workshop";
    if (this.arenaAmbientFillLight) this.arenaAmbientFillLight.visible = mode === "arena";
    if (this.environmentHemisphereLight && mode === "workshop") {
      this.environmentHemisphereLight.color.set(0xa9d9ee);
      this.environmentHemisphereLight.groundColor.set(0x294655);
      this.environmentHemisphereLight.intensity = 2.3;
    }
    if (mode !== "workshop") this.resetKeyShadowCoverage();
    this.simulatorRobot = null;
    this.simulatorRobotBasePose = null;
    this.simulationObjects.clear();
    this.starterRescueKitGhost = null;
    this.starterRescueKitColliderSource = null;
    this.arenaObjectColliderBlueprintCache = null;
    this.starterKitColliderBlueprintCache = null;
    this.clearDiagnosticsSensorOverlays();
    this.clearDiagnosticsSelectionOutlines();
    delete this.canvas.dataset.workshopPartCount;
    delete this.canvas.dataset.workshopLayout;
    delete this.canvas.dataset.workshopSelectionBounds;
    delete this.canvas.dataset.arenaId;
    delete this.canvas.dataset.arenaModel;
    if (mode === "workshop") this.buildWorkshop();
    else this.buildArena();
  }

  resetKeyShadowCoverage() {
    const key = this.workshopKeyLight;
    if (!key) return;
    key.position.copy(ROBOT_SHADOW_LIGHT_POSITION);
    key.target.position.set(0, 0, 0);
    key.target.updateMatrixWorld();
    key.updateMatrixWorld();
    const camera = key.shadow.camera;
    Object.assign(camera, this.shadowCameraDefaults || {});
    camera.updateProjectionMatrix();
  }

  updateArenaLighting(settings = {}) {
    if (this.mode !== "arena" || !this.workshopKeyLight) return;
    const key = this.workshopKeyLight;
    const minutes = Math.max(360, Math.min(1080, Number(String(settings?.time_of_day || "12:00").split(":")[0]) * 60 + Number(String(settings?.time_of_day || "12:00").split(":")[1] || 0)));
    const daylightPosition = (minutes - 360) / 720;
    const daylight = Math.max(0, Math.sin(daylightPosition * Math.PI));
    const sunsetWarmth = Math.pow(1 - daylight, 1.35);
    const elevation = THREE.MathUtils.degToRad(8 + daylight * 82);
    const azimuth = THREE.MathUtils.lerp(-Math.PI * 0.78, Math.PI * 0.78, daylightPosition);
    const radius = 90;
    const bounds = visibleWorldBounds(this.arenaShadowRoot);
    const center = bounds.getCenter(new THREE.Vector3());
    key.position.set(
      center.x + Math.cos(azimuth) * Math.cos(elevation) * radius,
      center.y + Math.sin(elevation) * radius,
      center.z + Math.sin(azimuth) * Math.cos(elevation) * radius
    );
    key.target.position.copy(center);
    key.color.copy(ARENA_NOON_SUN_COLOR).lerp(ARENA_HORIZON_SUN_COLOR, sunsetWarmth);
    key.intensity = 1.7 + daylight * 1.55;
    if (this.environmentHemisphereLight) {
      this.environmentHemisphereLight.color.copy(ARENA_NOON_SKY_COLOR).lerp(ARENA_HORIZON_SKY_COLOR, sunsetWarmth * 0.56);
      this.environmentHemisphereLight.groundColor.copy(ARENA_NOON_GROUND_COLOR).lerp(ARENA_HORIZON_GROUND_COLOR, sunsetWarmth * 0.42);
      this.environmentHemisphereLight.intensity = 0.72 + daylight * 0.34;
    }
    if (this.arenaAmbientFillLight) {
      this.arenaAmbientFillLight.color.copy(ARENA_NOON_AMBIENT_COLOR).lerp(ARENA_HORIZON_AMBIENT_COLOR, sunsetWarmth * 0.5);
      this.arenaAmbientFillLight.intensity = 0.08 + daylight * 0.08;
    }
    key.target.updateMatrixWorld();
    key.updateMatrixWorld();
    this.fitArenaShadowCoverage(bounds);
  }

  fitArenaShadowCoverage(boundsOverride = null) {
    const key = this.workshopKeyLight;
    const root = this.arenaShadowRoot;
    if (!key || !root) return;
    const bounds = boundsOverride || visibleWorldBounds(root);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const lightDirection = new THREE.Vector3().subVectors(key.position, key.target.position).normalize();
    if (lightDirection.lengthSq() < 1e-6) lightDirection.set(-0.55, 0.75, 0.45).normalize();
    key.target.position.copy(center);
    key.position.copy(center).addScaledVector(lightDirection, 110);
    key.target.updateMatrixWorld();
    key.updateMatrixWorld();
    const camera = key.shadow.camera;
    camera.position.copy(key.position);
    camera.lookAt(key.target.position);
    camera.updateMatrixWorld(true);
    const viewPoint = new THREE.Vector3();
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    let near = Infinity;
    let far = -Infinity;
    [bounds.min.x, bounds.max.x].forEach((x) => [bounds.min.y, bounds.max.y].forEach((y) => [bounds.min.z, bounds.max.z].forEach((z) => {
      viewPoint.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      left = Math.min(left, viewPoint.x);
      right = Math.max(right, viewPoint.x);
      bottom = Math.min(bottom, viewPoint.y);
      top = Math.max(top, viewPoint.y);
      const depth = -viewPoint.z;
      near = Math.min(near, depth);
      far = Math.max(far, depth);
    })));
    const padding = ARENA_SHADOW_PADDING;
    camera.left = left - padding;
    camera.right = right + padding;
    camera.bottom = bottom - padding;
    camera.top = top + padding;
    camera.near = Math.max(0.1, near - padding);
    camera.far = Math.max(camera.near + 1, far + padding);
    camera.updateProjectionMatrix();
  }

  fitWorkshopShadowCoverage() {
    const key = this.workshopKeyLight;
    if (!key || !this.robotComponents.size) return;
    const bounds = new THREE.Box3();
    const extent = ROBOT_CELL_SIZE;
    this.robotComponents.forEach((group) => {
      const { x, y, z } = group.position;
      bounds.expandByPoint(new THREE.Vector3(x - extent, y - extent, z - extent));
      bounds.expandByPoint(new THREE.Vector3(x + extent, y + extent, z + extent));
    });
    const center = bounds.getCenter(new THREE.Vector3());
    key.target.position.copy(center);
    key.position.copy(center).add(ROBOT_SHADOW_LIGHT_POSITION);
    key.target.updateMatrixWorld();
    key.updateMatrixWorld();
    const bottomFill = this.workshopBottomFillLight;
    if (bottomFill) {
      bottomFill.target.position.copy(center);
      bottomFill.position.copy(center).add(ROBOT_BOTTOM_FILL_LIGHT_OFFSET);
      bottomFill.target.updateMatrixWorld();
      bottomFill.updateMatrixWorld();
    }

    const camera = key.shadow.camera;
    camera.position.copy(key.position);
    camera.lookAt(key.target.position);
    camera.updateMatrixWorld(true);
    const viewPoint = new THREE.Vector3();
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    let near = Infinity;
    let far = -Infinity;
    [bounds.min.x, bounds.max.x].forEach((x) => [bounds.min.y, bounds.max.y].forEach((y) => [bounds.min.z, bounds.max.z].forEach((z) => {
      viewPoint.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
      left = Math.min(left, viewPoint.x);
      right = Math.max(right, viewPoint.x);
      bottom = Math.min(bottom, viewPoint.y);
      top = Math.max(top, viewPoint.y);
      const depth = -viewPoint.z;
      near = Math.min(near, depth);
      far = Math.max(far, depth);
    })));
    const padding = ROBOT_SHADOW_CAMERA_PADDING;
    camera.left = left - padding;
    camera.right = right + padding;
    camera.bottom = bottom - padding;
    camera.top = top + padding;
    camera.near = Math.max(0.1, near - padding);
    camera.far = Math.max(camera.near + 1, far + padding);
    camera.updateProjectionMatrix();
  }

  texture(path, colorSpace = THREE.SRGBColorSpace) {
    const cacheKey = `${path}|${colorSpace}`;
    if (this.textures.has(cacheKey)) return this.textures.get(cacheKey);
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    this.trackAssetPromise(ready);
    const texture = this.textureLoader.load(path, () => {
      if (path === ROBOT_NOISE_TEXTURE) this.refreshRobotNoiseVariants(texture);
      if (path === ROBOT_NOISE_TEXTURE) this.refreshArenaNoiseVariants(texture);
      resolveReady(texture);
      this.requestRender();
    }, undefined, () => {
      this.canvas.dataset.assetError = "true";
      rejectReady(new Error(`Unable to load ${path}`));
      document.dispatchEvent(new CustomEvent("sbotics-three-asset-error", { detail: { path } }));
    });
    texture.colorSpace = colorSpace;
    this.textures.set(cacheKey, texture);
    return texture;
  }

  arenaSurfaceOverlayMaterial(map, options = {}) {
    // Tile images contain authored line colors and are also ColorSensor input.
    // Keep scene lighting from lifting their dark pixels.
    return new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 1, toneMapped: false, ...options });
  }

  robotNoiseTileSizeForObject(object) {
    let current = object;
    let typeId = "";
    while (current) {
      if (!typeId && current.userData?.sourceTypeId) typeId = current.userData.sourceTypeId;
      current = current.parent;
    }
    return ["wedge", "wedgeColorSensor", "wedgeUltrasonicSensor"].includes(typeId)
      ? ROBOT_NOISE_WEDGE_TILE_SIZE
      : typeId === "largeWheel"
        ? ROBOT_NOISE_LARGE_WHEEL_TILE_SIZE
        : ROBOT_NOISE_TILE_SIZE;
  }

  robotNoiseUvScaleForObject(object) {
    return ROBOT_NOISE_TILE_SIZE / (this.robotNoiseTileSizeForObject(object) * ROBOT_CELL_SIZE * ROBOT_NOISE_WORLD_SCALE);
  }

  robotSurfaceMaterial(group, tone, materialOptions = {}) {
    const noise = this.robotNoiseTextureForObject(group);
    const options = { roughness: 0.78, map: noise, ...materialOptions };
    if (tone === ROBOT_PAINT_HEX.black) {
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "color")) options.color = ROBOT_BLACK_SURFACE_HEX;
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "roughnessMap")) options.roughnessMap = noise;
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "roughness")) options.roughness = 0.2;
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "metalness")) options.metalness = 0.12;
      // A black albedo multiplies the diffuse noise down to near zero. Keep
      // the part visually black, but let the same noise subtly modulate a
      // dark emissive lift so texture remains readable on unlit wheel faces.
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "emissive")) options.emissive = color(0x0a141d);
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "emissiveMap")) options.emissiveMap = noise;
      if (!Object.prototype.hasOwnProperty.call(materialOptions, "emissiveIntensity")) options.emissiveIntensity = 0.34;
    }
    return material(tone, options);
  }

  scaleRobotPrimitiveUvs(geometry, uvScale) {
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    if (!position || !uv) return geometry;
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    const third = new THREE.Vector3();
    const scaleFace = (start) => {
      first.fromBufferAttribute(position, start);
      second.fromBufferAttribute(position, start + 1);
      third.fromBufferAttribute(position, start + 2);
      const uScale = first.distanceTo(second) * uvScale;
      const vScale = first.distanceTo(third) * uvScale;
      for (let index = start; index < start + 4 && index < uv.count; index += 1) {
        uv.setXY(index, uv.getX(index) * uScale, uv.getY(index) * vScale);
      }
    };
    if (geometry.type === "PlaneGeometry") {
      scaleFace(0);
    } else if (geometry.type === "BoxGeometry") {
      for (let start = 0; start + 3 < uv.count; start += 4) scaleFace(start);
    } else if (geometry.type === "CylinderGeometry") {
      const parameters = geometry.parameters || {};
      const radialSegments = Math.max(3, Math.floor(parameters.radialSegments || 24));
      const heightSegments = Math.max(1, Math.floor(parameters.heightSegments || 1));
      const sideVertexCount = (radialSegments + 1) * (heightSegments + 1);
      const capVertexCount = radialSegments * 2 + 1;
      const topCapStart = sideVertexCount;
      const bottomCapStart = topCapStart + capVertexCount;
      const radiusTop = Number(parameters.radiusTop ?? parameters.radius ?? 0);
      const radiusBottom = Number(parameters.radiusBottom ?? parameters.radius ?? radiusTop);
      const circumference = Number(parameters.thetaLength || Math.PI * 2);
      const sideUScale = radiusTop * circumference * uvScale;
      const sideVScale = Number(parameters.height || 0) * uvScale;
      for (let index = 0; index < Math.min(sideVertexCount, uv.count); index += 1) {
        uv.setXY(index, uv.getX(index) * sideUScale, uv.getY(index) * sideVScale);
      }
      const scaleCap = (start, radius) => {
        const capScale = radius * 2 * uvScale;
        for (let index = start; index < start + capVertexCount && index < uv.count; index += 1) {
          uv.setXY(index, 0.5 + (uv.getX(index) - 0.5) * capScale, 0.5 + (uv.getY(index) - 0.5) * capScale);
        }
      };
      scaleCap(topCapStart, radiusTop);
      scaleCap(bottomCapStart, radiusBottom);
    } else {
      return geometry;
    }
    uv.needsUpdate = true;
    return geometry;
  }

  projectRobotModelUvs(geometry, worldScale, uvScale, localMatrix = null) {
    const mapped = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    const position = mapped.getAttribute("position");
    if (!position) return mapped;
    const uv = new THREE.Float32BufferAttribute(new Float32Array(position.count * 2), 2);
    const first = new THREE.Vector3();
    const second = new THREE.Vector3();
    const third = new THREE.Vector3();
    const nextFirst = new THREE.Vector3();
    const nextSecond = new THREE.Vector3();
    const nextThird = new THREE.Vector3();
    const edge = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const nextNormal = new THREE.Vector3();
    const bitangent = new THREE.Vector3();
    const relative = new THREE.Vector3();
    const readPosition = (target, index) => {
      target.fromBufferAttribute(position, index);
      if (localMatrix) target.applyMatrix4(localMatrix);
      return target.multiply(worldScale);
    };
    for (let start = 0; start + 2 < position.count;) {
      readPosition(first, start);
      readPosition(second, start + 1);
      readPosition(third, start + 2);
      edge.subVectors(second, first);
      normal.crossVectors(edge, new THREE.Vector3().subVectors(third, first)).normalize();
      if (normal.lengthSq() === 0) {
        start += 3;
        continue;
      }
      const planeOffset = normal.dot(first);
      let end = start + 3;
      while (end + 2 < position.count) {
        readPosition(nextFirst, end);
        readPosition(nextSecond, end + 1);
        readPosition(nextThird, end + 2);
        nextNormal.crossVectors(new THREE.Vector3().subVectors(nextSecond, nextFirst), new THREE.Vector3().subVectors(nextThird, nextFirst)).normalize();
        if (nextNormal.lengthSq() === 0 || Math.abs(normal.dot(nextNormal)) < 0.999 || Math.abs(normal.dot(nextFirst) - planeOffset) > 0.001) break;
        end += 3;
      }
      edge.normalize();
      bitangent.crossVectors(normal, edge).normalize();
      for (let index = start; index < end; index += 1) {
        readPosition(relative, index).sub(first);
        uv.setXY(index, relative.dot(edge) * uvScale, relative.dot(bitangent) * uvScale);
      }
      start = end;
    }
    mapped.setAttribute("uv", uv);
    return mapped;
  }

  robotModelGeometryFor(group, geometry, path, worldScale, localMatrix = null) {
    const tileSize = this.robotNoiseTileSizeForObject(group);
    const profile = [geometry.uuid, path, tileSize, worldScale.x, worldScale.y, worldScale.z, localMatrix?.elements.join(",") || ""].join(":");
    if (this.robotTextureGeometryCache.has(profile)) return this.robotTextureGeometryCache.get(profile);
    const mapped = this.projectRobotModelUvs(geometry, worldScale, this.robotNoiseUvScaleForObject(group), localMatrix);
    this.robotTextureGeometryCache.set(profile, mapped);
    return mapped;
  }

  refreshRobotNoiseVariants(source) {
    this.robotNoiseSourceRef = source;
    this.robotNoiseVariants.forEach((_, cacheKey) => {
      const [tileSize, variant] = cacheKey.split(":").map(Number);
      this.drawRobotNoiseVariant(variant, tileSize, cacheKey);
    });
  }

  drawRobotNoiseVariant(variant, tileSize = ROBOT_NOISE_TILE_SIZE, cacheKey = `${tileSize}:${variant}`) {
    const source = this.robotNoiseSourceRef?.image;
    const canvas = this.robotNoiseVariantCanvases.get(cacheKey);
    if (!source || !canvas) return;
    const width = source.naturalWidth || source.width || 0;
    const height = source.naturalHeight || source.height || 0;
    if (!width || !height) return;
    const cropSize = Math.min(tileSize, width, height);
    const origin = ROBOT_NOISE_VARIANT_ORIGINS[variant];
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || !origin) return;
    context.imageSmoothingEnabled = false;
    const maxSourceX = Math.max(0, width - cropSize);
    const maxSourceY = Math.max(0, height - cropSize);
    const sourceX = Math.round((origin.x / (ROBOT_NOISE_SOURCE_GRID - 1)) * maxSourceX);
    const sourceY = Math.round((origin.y / (ROBOT_NOISE_SOURCE_GRID - 1)) * maxSourceY);
    context.clearRect(0, 0, tileSize, tileSize);
    context.drawImage(source, sourceX, sourceY, cropSize, cropSize, 0, 0, tileSize, tileSize);
    const pixels = context.getImageData(0, 0, tileSize, tileSize);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const sourceValue = pixels.data[index] / 255;
      const normalized = Math.max(0, Math.min(1, (sourceValue - ROBOT_NOISE_SOURCE_MIN) / ROBOT_NOISE_SOURCE_RANGE));
      const noiseValue = (ROBOT_NOISE_VISIBLE_MIN + normalized * (1 - ROBOT_NOISE_VISIBLE_MIN)) * 255;
      const visibleValue = Math.round(255 - ((255 - noiseValue) * ROBOT_NOISE_PATTERN_EFFECT));
      pixels.data[index] = visibleValue;
      pixels.data[index + 1] = visibleValue;
      pixels.data[index + 2] = visibleValue;
    }
    context.putImageData(pixels, 0, 0);
    this.robotNoiseVariants.get(cacheKey).needsUpdate = true;
  }

  refreshArenaNoiseVariants(source) {
    this.arenaNoiseSourceRef = source;
    this.arenaNoiseVariants.forEach((_, cacheKey) => {
      const [tileSize, variant, rotationIndex] = cacheKey.split(":").map(Number);
      this.drawArenaNoiseVariant(variant, rotationIndex, tileSize, cacheKey);
    });
  }

  drawArenaNoiseVariant(variant, rotationIndex, tileSize = ARENA_NOISE_TILE_SIZE, cacheKey = `${tileSize}:${variant}:${rotationIndex}`) {
    const source = this.arenaNoiseSourceRef?.image;
    const canvas = this.arenaNoiseVariantCanvases.get(cacheKey);
    if (!source || !canvas) return;
    const width = source.naturalWidth || source.width || 0;
    const height = source.naturalHeight || source.height || 0;
    const origin = ARENA_NOISE_VARIANT_ORIGINS[variant];
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!width || !height || !origin || !context) return;
    context.imageSmoothingEnabled = false;
    const cropSize = Math.min(tileSize, width, height);
    const maxSourceX = Math.max(0, width - cropSize);
    const maxSourceY = Math.max(0, height - cropSize);
    const sourceX = Math.round((origin.x / (ARENA_NOISE_SOURCE_GRID - 1)) * maxSourceX);
    const sourceY = Math.round((origin.y / (ARENA_NOISE_SOURCE_GRID - 1)) * maxSourceY);
    context.clearRect(0, 0, tileSize, tileSize);
    context.save();
    context.translate(tileSize / 2, tileSize / 2);
    context.rotate(rotationIndex * (Math.PI / 2));
    context.drawImage(source, sourceX, sourceY, cropSize, cropSize, -tileSize / 2, -tileSize / 2, tileSize, tileSize);
    context.restore();
    const pixels = context.getImageData(0, 0, tileSize, tileSize);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const sourceValue = pixels.data[index] / 255;
      const normalized = Math.max(0, Math.min(1, (sourceValue - ROBOT_NOISE_SOURCE_MIN) / ROBOT_NOISE_SOURCE_RANGE));
      const visibleValue = Math.round((ROBOT_NOISE_VISIBLE_MIN + normalized * (1 - ROBOT_NOISE_VISIBLE_MIN)) * 255);
      pixels.data[index] = visibleValue;
      pixels.data[index + 1] = visibleValue;
      pixels.data[index + 2] = visibleValue;
    }
    context.putImageData(pixels, 0, 0);
    this.arenaNoiseVariants.get(cacheKey).needsUpdate = true;
  }

  arenaNoiseTextureForPosition(position = {}) {
    const { index, rotation } = arenaNoiseVariant(position);
    const rotationIndex = Math.round(rotation / (Math.PI / 2)) % 4;
    const cacheKey = `${ARENA_NOISE_TILE_SIZE}:${index}:${rotationIndex}`;
    if (this.arenaNoiseVariants.has(cacheKey)) return this.arenaNoiseVariants.get(cacheKey);
    if (!this.arenaNoiseSourceRef) this.arenaNoiseSourceRef = this.texture(ROBOT_NOISE_TEXTURE);
    const canvas = document.createElement("canvas");
    canvas.width = ARENA_NOISE_TILE_SIZE;
    canvas.height = ARENA_NOISE_TILE_SIZE;
    const context = canvas.getContext("2d");
    context.fillStyle = "#eeeeee";
    context.fillRect(0, 0, ARENA_NOISE_TILE_SIZE, ARENA_NOISE_TILE_SIZE);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.arenaNoiseVariants.set(cacheKey, texture);
    this.arenaNoiseVariantCanvases.set(cacheKey, canvas);
    this.drawArenaNoiseVariant(index, rotationIndex, ARENA_NOISE_TILE_SIZE, cacheKey);
    return texture;
  }

  robotNoiseTextureForPosition(position = {}, tileSize = ROBOT_NOISE_TILE_SIZE) {
    const variant = robotNoiseVariantIndex(position);
    const cacheKey = `${tileSize}:${variant}`;
    if (this.robotNoiseVariants.has(cacheKey)) return this.robotNoiseVariants.get(cacheKey);
    if (!this.robotNoiseSourceRef) this.robotNoiseSourceRef = this.texture(ROBOT_NOISE_TEXTURE);
    const canvas = document.createElement("canvas");
    canvas.width = tileSize;
    canvas.height = tileSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "#eeeeee";
    context.fillRect(0, 0, tileSize, tileSize);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.NoColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.robotNoiseVariants.set(cacheKey, texture);
    this.robotNoiseVariantCanvases.set(cacheKey, canvas);
    this.drawRobotNoiseVariant(variant, tileSize, cacheKey);
    return texture;
  }

  robotGridPositionFor(object) {
    let current = object;
    while (current) {
      if (current.userData?.gridPosition) return current.userData.gridPosition;
      current = current.parent;
    }
    return { x: 0, y: 0, z: 0 };
  }

  robotNoiseTextureForObject(object) {
    return this.robotNoiseTextureForPosition(this.robotGridPositionFor(object), this.robotNoiseTileSizeForObject(object));
  }

  robotPartSpecFor(group) {
    const instanceId = group.userData.sourceInstanceId || group.userData.instanceId;
    return this.robotPartsForRendering.find((part) => {
      const partId = part?.instanceId || part?.key || part?.id;
      return partId === instanceId;
    }) || null;
  }

  robotPartOrientationQuaternion(group) {
    const instanceId = group.userData.sourceInstanceId || group.userData.instanceId;
    const part = this.robotPartSpecFor(group);
    const orientation = this.spec?.simulatorRobot?.orientations?.[instanceId]
      || part?.orientation
      || this.spec?.robotPartOrientations?.[instanceId]
      || this.spec?.robotPartOrientations?.[group.userData.sourceTypeId]
      || { up: "+Y", forward: "+Z" };
    const rotation = this.spec?.simulatorRobot?.rotations?.[instanceId]
      || part?.rotation
      || this.spec?.robotPartRotations?.[instanceId]
      || this.spec?.robotPartRotations?.[group.userData.sourceTypeId]
      || {};
    const io = globalThis.sboticsRobotIO;
    const rawQuaternion = orientation && io?.orientationToQuaternion
      ? io.orientationToQuaternion(orientation)
      : rotation && io?.unityEulerToQuaternion
        ? io.unityEulerToQuaternion(rotation)
        : null;
    const quaternionValues = rawQuaternion ? ["x", "y", "z", "w"].map((key) => Number(rawQuaternion[key])) : [];
    if (quaternionValues.length === 4 && quaternionValues.every(Number.isFinite)) {
      return new THREE.Quaternion(...quaternionValues).normalize();
    }
    if (rotation) {
      return new THREE.Quaternion().setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(Number(rotation.x) || 0),
        THREE.MathUtils.degToRad(Number(rotation.y) || 0),
        THREE.MathUtils.degToRad(Number(rotation.z) || 0)
      ));
    }
    return new THREE.Quaternion();
  }

  robotLocalFaceForWorldDirection(group, direction) {
    const local = new THREE.Vector3(direction.x, direction.y, direction.z)
      .applyQuaternion(this.robotPartOrientationQuaternion(group).invert());
    const axis = ["x", "y", "z"].sort((first, second) => Math.abs(local[second]) - Math.abs(local[first]))[0];
    return `${local[axis] >= 0 ? "+" : "-"}${axis}`;
  }

  robotLightOccludedFaces(group) {
    const position = group.userData.gridPosition || {};
    const hiddenFaces = new Set();
    ROBOT_GRID_FACE_DIRECTIONS.forEach((direction) => {
      const neighbor = this.robotPartsForRendering.find((part) => {
        const neighborPosition = part?.position || part?.gridPosition;
        return neighborPosition
          && Number(neighborPosition.x) === Number(position.x) + direction.x
          && Number(neighborPosition.y) === Number(position.y) + direction.y
          && Number(neighborPosition.z) === Number(position.z) + direction.z;
      });
      const neighborTypeId = neighbor?.typeId || neighbor?.id;
      if (ROBOT_LED_FULL_FACE_NEIGHBOR_IDS.has(neighborTypeId)) {
        hiddenFaces.add(this.robotLocalFaceForWorldDirection(group, direction));
      }
    });
    return hiddenFaces;
  }

  buildWorkshop() {
    const robot = new THREE.Group();
    robot.name = "RobotPartsRail";
    robot.scale.x = ROBOT_VISUAL_MIRROR_X;
    this.world.add(robot);
    const suppliedParts = Array.isArray(this.spec?.robotParts) ? this.spec.robotParts.map((part, index) => {
      if (typeof part === "string") return { instanceId: part, typeId: part, position: { x: index, y: 0, z: 0 } };
      const typeId = part?.typeId || part?.id;
      return { ...part, instanceId: part?.instanceId || part?.key || `${typeId || "part"}${index + 1}`, typeId, position: part?.position || part?.gridPosition || { x: index, y: 0, z: 0 } };
    }).filter((part) => ROBOT_PART_IDS.includes(part.typeId)) : [];
    const parts = suppliedParts.length ? suppliedParts : [{ instanceId: "controller", typeId: "controller", position: { x: 0, y: 0, z: 0 } }];
    // LED glass needs per-instance face visibility, so keep the small number
    // of LED enclosures as ordinary meshes instead of one all-faces instance.
    this.robotPartsForRendering = parts;
    parts.forEach((part) => this.addRobotPart(robot, part.typeId, part.position, part.instanceId, part));
    const denseWorkshop = parts.length >= 64;
    this.renderer.shadowMap.enabled = !denseWorkshop;
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, denseWorkshop ? 1 : 1.5));
    this.resize();
    this.canvas.dataset.workshopPartCount = String(parts.length);
    this.canvas.dataset.workshopLayout = "logical-grid:1x1x1;default:controller-only";
    this.canvas.dataset.workshopSelectionBounds = "1x1x1";
    this.fitWorkshopShadowCoverage();
    this.workshopTarget.set(0, 2.5, 0);
    this.workshopCameraRadius = 110;
  }

  updateWorkshopLightGlass() {
    if (!this.workshopLightGlass) return;
    this.robotComponents.forEach((group) => {
      const index = group.userData.lightGlassIndex;
      if (!Number.isInteger(index)) return;
      group.updateMatrix();
      this.workshopLightGlass.setMatrixAt(index, group.matrix);
      this.workshopLightGlass.setColorAt?.(index, this.simulationLightColor(group));
    });
    this.workshopLightGlass.instanceMatrix.needsUpdate = true;
    if (this.workshopLightGlass.instanceColor) this.workshopLightGlass.instanceColor.needsUpdate = true;
  }

  updateWorkshopLightModels() {
    if (!this.workshopLightModelMeshes.length) return;
    this.robotComponents.forEach((group) => {
      const index = group.userData.lightModelIndex;
      if (!Number.isInteger(index)) return;
      group.updateMatrix();
      this.workshopLightModelMeshes.forEach((mesh) => {
        mesh.setMatrixAt(index, group.matrix);
        mesh.setColorAt?.(index, this.simulationLightColor(group));
      });
    });
    this.workshopLightModelMeshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  simulationLightColor(group) {
    const state = this.spec?.simulationRuntime?.components?.[group.userData.sourceInstanceId || group.userData.instanceId]?.readings;
    if (!state) return new THREE.Color(0x414690);
    if (!state?.lit) return new THREE.Color(0x555a88);
    return new THREE.Color(
      (Number(state.color?.r) || 0) / 255,
      (Number(state.color?.g) || 0) / 255,
      (Number(state.color?.b) || 0) / 255
    );
  }

  applyLightVisual(group) {
    if (group.userData.sourceTypeId !== "light") return;
    const state = this.spec?.simulationRuntime?.components?.[group.userData.sourceInstanceId || group.userData.instanceId]?.readings;
    // The robot editor has no runtime reading to apply. Leave the authored
    // blue LED material intact instead of recoloring it to the simulation's
    // unlit fallback.
    if (!state) return;
    const colorValue = this.simulationLightColor(group);
    const glass = group.userData.simulationLightGlass;
    if (glass?.material) glass.material.opacity = state.lit ? ROBOT_LIGHT_GLASS_LIT_OPACITY : ROBOT_LIGHT_GLASS_BASE_OPACITY;
    const glow = group.userData.simulationLightGlow;
    if (glow) {
      const lampBrightness = Number.isFinite(Number(state.lampBrightness)) ? Math.max(0, Math.min(100, Number(state.lampBrightness))) : 100;
      glow.color.copy(colorValue);
      glow.intensity = state.lit ? ROBOT_LIGHT_GLOW_INTENSITY * lampBrightness / 100 : 0;
      glow.visible = state.lit === true;
    }
    group.traverse((item) => {
      if (!item.isMesh || item === this.workshopLightGlass) return;
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      materials.forEach((material) => {
        if (!material?.color) return;
        material.color.copy(colorValue);
        if (material.emissive) material.emissive.copy(state?.lit ? colorValue : new THREE.Color(0x000000));
        if (material.emissiveIntensity !== undefined) material.emissiveIntensity = state?.lit ? 1.2 : 0.1;
      });
    });
  }

  applyTouchVisual(group) {
    if (group.userData.sourceTypeId !== "touchSensor") return;
    const button = group.userData.simulationTouchProbe;
    if (!button) return;
    const readings = this.spec?.simulationRuntime?.components?.[group.userData.sourceInstanceId || group.userData.instanceId]?.readings;
    button.position.z = readings?.contact === true ? TOUCH_BUTTON_PRESSED_Z : TOUCH_BUTTON_REST_Z;
  }

  robotPartColor(id, instanceId = id) {
    const painted = this.spec?.robotPartColors?.[instanceId] ?? this.spec?.robotPartColors?.[id];
    return ROBOT_PAINT_HEX[painted] ?? (ROBOT_PAINTABLE_PART_IDS.has(id) ? ROBOT_GLOBAL_FALLBACK_HEX : ROBOT_DEFAULT_HEX[id] ?? ROBOT_GLOBAL_FALLBACK_HEX);
  }

  robotMesh(group, geometry, tone, options = {}) {
    const { position, rotation, quaternion, paintable = false, materialOptions = {}, sourceRole, castShadow = true, receiveShadow = true } = options;
    const mappedGeometry = this.scaleRobotPrimitiveUvs(geometry, this.robotNoiseUvScaleForObject(group));
    const mesh = new THREE.Mesh(mappedGeometry, this.robotSurfaceMaterial(group, tone, materialOptions));
    if (position) mesh.position.set(position.x || 0, position.y || 0, position.z || 0);
    if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    if (quaternion) mesh.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    if (paintable) group.userData.paintableMeshes.push(mesh);
    mesh.userData.sourceRole = sourceRole || "";
    mesh.userData.physicsRole = options.physicsRole || (geometry.type === "PlaneGeometry" ? "visual" : "solid");
    mesh.userData.physicsShapeId = options.physicsShapeId || "body";
    group.add(mesh);
    return mesh;
  }

  facePanel(group, position, rotation, size, tone, materialOptions = {}) {
    return this.robotMesh(group, new THREE.PlaneGeometry(size, size), tone, { position, rotation, materialOptions });
  }

  mergeRobotModelMeshes(root) {
    root.updateMatrixWorld(true);
    const inverseRoot = root.matrixWorld.clone().invert();
    const materialGroups = new Map();
    const sourceMeshes = [];
    root.traverse((item) => {
      if (!item.isMesh || !item.geometry) return;
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      if (materials.length !== 1) return;
      const geometry = item.geometry.clone();
      const relativeMatrix = new THREE.Matrix4().multiplyMatrices(inverseRoot, item.matrixWorld);
      geometry.applyMatrix4(relativeMatrix);
      const material = materials[0];
      const key = material?.uuid || item.name;
      if (!materialGroups.has(key)) materialGroups.set(key, { material, geometries: [] });
      materialGroups.get(key).geometries.push(geometry);
      sourceMeshes.push(item);
    });
    if (sourceMeshes.length < 2) return false;
    const mergedMeshes = [];
    for (const entry of materialGroups.values()) {
      const geometry = mergeGeometries(entry.geometries, false);
      if (!geometry) {
        materialGroups.forEach((group) => group.geometries.forEach((item) => item.dispose()));
        return false;
      }
      mergedMeshes.push({ geometry, material: entry.material });
    }
    sourceMeshes.forEach((item) => item.parent?.remove(item));
    mergedMeshes.forEach(({ geometry, material }) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.sourceRole = "Light/LED + Diode (merged source meshes)";
      root.add(mesh);
    });
    return true;
  }

  loadInstancedLightModel(parent, count) {
    const path = ROBOT_SOURCE_ASSETS.led;
    const assetPromise = this.trackAssetPromise(this.robotAssetCache.get(path) ?? new Promise((resolve, reject) => this.fbxLoader.load(path, resolve, undefined, reject)));
    this.robotAssetCache.set(path, assetPromise);
    assetPromise.then((template) => {
      if (!parent.parent || this.workshopLightGlass?.count !== count) return;
      const sourceMesh = template.clone(true);
      this.mergeRobotModelMeshes(sourceMesh);
      sourceMesh.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(sourceMesh);
      const center = bounds.getCenter(new THREE.Vector3());
      const extent = Math.max(...bounds.getSize(new THREE.Vector3()).toArray(), 0.001);
      const importedScale = sourceMesh.scale.clone();
      const normalizedScale = 3.8 / extent;
      const sourceScale = { x: normalizedScale, y: normalizedScale, z: normalizedScale };
      const frame = new THREE.Group();
      frame.position.set(0, -1.2, 0);
      frame.quaternion.set(-0.7071068, 0, 0, 0.7071068);
      sourceMesh.position.set(-center.x * sourceScale.x, -center.y * sourceScale.y, -center.z * sourceScale.z);
      sourceMesh.scale.set(importedScale.x * sourceScale.x, importedScale.y * sourceScale.y, importedScale.z * sourceScale.z);
      frame.add(sourceMesh);
      frame.updateMatrixWorld(true);
      const instances = [];
      sourceMesh.traverse((item) => {
        if (!item.isMesh) return;
        const geometry = item.geometry.clone();
        geometry.applyMatrix4(item.matrixWorld);
        const material = item.material?.clone?.() ?? item.material;
        if (material) {
          material.vertexColors = true;
          material.needsUpdate = true;
        }
        const mesh = new THREE.InstancedMesh(geometry, material, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.sourceRole = "Light/LED + Diode (instanced source mesh)";
        parent.add(mesh);
        instances.push(mesh);
      });
      this.workshopLightModelMeshes = instances;
      this.updateWorkshopLightModels();
      sourceMesh.traverse((item) => { if (item.isMesh) item.geometry?.dispose?.(); });
      this.requestRender();
    }).catch(() => {
      this.canvas.dataset.assetError = "true";
      document.dispatchEvent(new CustomEvent("sbotics-three-asset-error", { detail: { path } }));
    });
  }

  loadRobotModel(group, path, options = {}) {
    const {
      maxSize = ROBOT_CELL_SIZE * 0.92,
      position = {},
      rotation,
      quaternion,
      tone = 0xffffff,
      materialOptions = {},
      paintable = false,
      preserveMaterials = false,
      fixedMaterialSlots = null,
      physicsShapeIdByMeshName = null,
      bottomAnchor = false,
      mergeMeshes = false,
      castShadow = true,
      receiveShadow = true,
      scale,
      physicsRole = "solid",
      physicsShapeId = "mesh",
      sourceRole = path
    } = options;
    const assetPromise = this.trackAssetPromise(this.robotAssetCache.get(path) ?? new Promise((resolve, reject) => this.fbxLoader.load(path, resolve, undefined, reject)));
    this.robotAssetCache.set(path, assetPromise);
    group.userData.robotModelJobs ||= [];
    const job = { path, options: { ...options }, assetPromise, status: "loading", promise: null };
    group.userData.robotModelJobs.push(job);
    job.promise = assetPromise.then((template) => {
      if (job.status !== "loading") return false;
      const sourceMesh = template.clone(true);
      if (mergeMeshes) this.mergeRobotModelMeshes(sourceMesh);
      sourceMesh.traverse((item) => {
        if (!item.isMesh) return;
        if (!mergeMeshes) item.userData.sharedAssetGeometry = true;
        item.userData.physicsRole = physicsRole;
        item.userData.physicsShapeId = physicsShapeIdByMeshName?.[item.name] || physicsShapeId;
        item.userData.sourceRole = sourceRole;
        const fixedSlots = fixedMaterialSlots?.[item.name];
        if (fixedSlots) {
          item.geometry = item.geometry.clone();
          item.userData.sharedAssetGeometry = false;
          const indexByMaterial = new Map(fixedSlots.sourceIndices.map((sourceIndex, index) => [sourceIndex, index]));
          item.geometry.groups.forEach((entry) => {
            const targetIndex = indexByMaterial.get(entry.materialIndex);
            if (targetIndex === undefined) throw new Error(`Zul source material slot ${entry.materialIndex} is not assigned for ${item.name}`);
            entry.materialIndex = targetIndex;
          });
          item.material = fixedSlots.colors.map((colorId) => material(ZUL_GAME_MATERIAL_HEX[colorId], materialOptions));
        } else if (!preserveMaterials) item.material = this.robotSurfaceMaterial(group, tone, materialOptions);
        else if (Array.isArray(item.material)) item.material = item.material.map((entry) => entry.clone());
        else item.material = item.material?.clone?.() ?? item.material;
        item.castShadow = castShadow;
        item.receiveShadow = receiveShadow;
        if (paintable) group.userData.paintableMeshes.push(item);
      });
      sourceMesh.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(sourceMesh);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const importedScale = sourceMesh.scale.clone();
      const extent = Math.max(size.x, size.y, size.z, 0.001);
      const frame = new THREE.Group();
      frame.position.set(position.x || 0, position.y || 0, position.z || 0);
      if (rotation) frame.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
      if (quaternion) frame.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
      const normalizedScale = maxSize / extent;
      const sourceScale = {
        x: normalizedScale * (scale?.x ?? 1),
        y: normalizedScale * (scale?.y ?? 1),
        z: normalizedScale * (scale?.z ?? 1)
      };
      // Object3D position is not affected by its own scale. Scale the
      // centering translation too, otherwise off-origin FBX files (notably
      // Pyramid) drift away from their logical slot.
      sourceMesh.position.set(
        -center.x * sourceScale.x,
        -(bottomAnchor ? bounds.min.y : center.y) * sourceScale.y,
        -center.z * sourceScale.z
      );
      // FBXLoader can already provide a unit conversion on the root (the LED
      // asset uses 0.1). Preserve it and apply the scene normalization on top.
      sourceMesh.scale.set(importedScale.x * sourceScale.x, importedScale.y * sourceScale.y, importedScale.z * sourceScale.z);
      if (!preserveMaterials) {
        const worldScale = new THREE.Vector3(importedScale.x * sourceScale.x, importedScale.y * sourceScale.y, importedScale.z * sourceScale.z);
        sourceMesh.traverse((item) => {
          if (item.isMesh) item.geometry = this.robotModelGeometryFor(group, item.geometry, path, worldScale, item.matrix);
        });
      }
      sourceMesh.userData.sourceRole = sourceRole;
      frame.userData.sourceRole = sourceRole;
      frame.add(sourceMesh);
      group.add(frame);
      this.applyRobotPaint(group);
      this.applyLightVisual(group);
      this.applyTouchVisual(group);
      job.status = "ready";
      this.requestRender();
      return true;
    }).catch(() => {
      if (job.status !== "loading") return false;
      if (this.robotAssetCache.get(path) === assetPromise) this.robotAssetCache.delete(path);
      job.status = "failed";
      group.userData.sourceAssetMissing = path;
      this.canvas.dataset.assetError = "true";
      document.dispatchEvent(new CustomEvent("sbotics-three-asset-error", { detail: { path } }));
      return false;
    });
  }

  addRobotPart(parent, id, gridPosition, pickId = id, metadata = {}) {
    const group = new THREE.Group();
    group.name = `RobotPart:${id}`;
    group.position.set(gridPosition.x * ROBOT_CELL_SIZE, gridPosition.y * ROBOT_CELL_SIZE, gridPosition.z * ROBOT_CELL_SIZE);
    group.userData.sourceTypeId = id;
    group.userData.instanceId = pickId;
    group.userData.sourceInstanceId = metadata.sourceInstanceId || metadata.instanceId || pickId;
    group.userData.gridPosition = { x: gridPosition.x, y: gridPosition.y, z: gridPosition.z };
    group.userData.parentInstanceId = metadata.parentInstanceId || null;
    group.userData.parentFace = metadata.parentFace || null;
    group.userData.paintableMeshes = [];
    switch (id) {
      case "controller": this.buildController(group); break;
      case "cube": this.buildCube(group); break;
      case "wedge": this.buildWedge(group); break;
      case "hinge": this.buildHinge(group); break;
      case "smallWheel": this.buildWheel(group, false); break;
      case "largeWheel": this.buildWheel(group, true); break;
      case "buzzer": this.buildBuzzer(group); break;
      case "light": this.buildLight(group); break;
      case "servo": this.buildServo(group); break;
      case "colorSensor": this.buildColorSensor(group, false); break;
      case "ultrasonicSensor": this.buildUltrasonic(group, false); break;
      case "touchSensor": this.buildTouchSensor(group); break;
      case "slab": this.buildSlab(group); break;
      case "camera": this.buildCamera(group); break;
      case "pen": this.buildPen(group); break;
      case "pyramid": this.buildPyramid(group); break;
      case "wedgeColorSensor": this.buildWedgeColorSensor(group); break;
      case "wedgeUltrasonicSensor": this.buildWedgeUltrasonicSensor(group); break;
      case "corner": this.buildCorner(group); break;
      default: return null;
    }
    const slot = new THREE.Mesh(new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    slot.frustumCulled = false;
    slot.userData.pickId = pickId;
    slot.userData.pickKind = "robot";
    slot.userData.sourceRole = "logical-selection-slot";
    slot.userData.physicsRole = "visual";
    group.add(slot);
    this.pickTargets.set(pickId, group);
    this.pickables.push(slot);
    parent.add(group);
    this.robotComponents.set(pickId, group);
    return group;
  }

  buildController(group) {
    const body = this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), ROBOT_DEFAULT_HEX.controller);
    const faces = [
      [0, 0, 3.03, 0, 0], [0, 0, -3.03, 0, Math.PI], [3.03, 0, 0, 0, Math.PI / 2], [-3.03, 0, 0, 0, -Math.PI / 2], [0, 3.03, 0, -Math.PI / 2, 0], [0, -3.03, 0, Math.PI / 2, 0]
    ];
    faces.forEach(([x, y, z, rx, ry]) => {
      const panel = this.facePanel(group, { x, y, z }, { x: rx, y: ry, z: 0 }, 5.1, 0x792aab);
      const plaque = this.robotMesh(panel, new THREE.BoxGeometry(1.85, 1.85, 0.06), 0xe1b6f2, { position: { z: 0.04 } });
      plaque.userData.sourceRole = "controller-board-memory-plaque";
      this.robotMesh(panel, new THREE.BoxGeometry(0.82, 0.9, 0.08), 0x792aab, { position: { z: 0.09 } });
      for (const offset of [-0.72, 0.72]) {
        this.robotMesh(panel, new THREE.BoxGeometry(0.16, 0.34, 0.08), 0x792aab, { position: { x: offset, z: 0.09 } });
        this.robotMesh(panel, new THREE.BoxGeometry(0.34, 0.16, 0.08), 0x792aab, { position: { y: offset, z: 0.09 } });
      }
    });
    body.userData.sourceRole = "robot-controller-body";
  }

  buildCube(group) {
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), this.robotPartColor("cube"), { paintable: true });
  }

  buildWedge(group) {
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.wedge, {
      maxSize: ROBOT_CELL_SIZE,
      quaternion: ROBOT_WEDGE_MESH_FRAME_QUATERNION,
      tone: this.robotPartColor("wedge"),
      paintable: true,
      sourceRole: "VFC-ROB-WEDGE/RightTriangle"
    });
  }

  buildHinge(group) {
    // Unity Hinge is a thin square Cube around a compact vertical Cylinder.
    // Both share the root origin; moving the plate down made the part float.
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, 0.3, ROBOT_CELL_SIZE), this.robotPartColor("hinge"), {
      paintable: true, sourceRole: "Hinge/Base", physicsShapeId: "base"
    });
    this.robotMesh(group, new THREE.CylinderGeometry(1.5, 1.5, ROBOT_CELL_SIZE, 24), 0x8b96a4, {
      sourceRole: "Hinge/Pivot", physicsShapeId: "pivot"
    });
  }

  buildWheel(group, large) {
    const radius = large ? ROBOT_CELL_SIZE : ROBOT_CELL_SIZE / 2;
    this.robotMesh(group, new THREE.CylinderGeometry(radius, radius, ROBOT_CELL_SIZE, 24), this.robotPartColor(large ? "largeWheel" : "smallWheel"), {
      paintable: true, sourceRole: large ? "Large Wheel/Cylinder" : "Small Wheel/Cylinder", physicsShapeId: "wheel"
    });
    // The serialized Unity rotation owns the wheel axle. The source prefab's
    // -90° root rotation is replaced by RobotManager during load, so the
    // cylinder itself stays on its native Y axis here.
  }

  buildBuzzer(group) {
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), ROBOT_DEFAULT_HEX.buzzer);
    const faces = [
      [{ y: 3.03 }, { x: -Math.PI / 2, y: 0, z: 0 }], [{ z: -3.03 }, { x: 0, y: Math.PI, z: 0 }],
      [{ x: -3.03 }, { x: 0, y: -Math.PI / 2, z: 0 }], [{ z: 3.03 }, { x: 0, y: 0, z: 0 }],
      [{ x: 3.03 }, { x: 0, y: Math.PI / 2, z: 0 }], [{ y: -3.03 }, { x: Math.PI / 2, y: 0, z: 0 }]
    ];
    // Unity's Buzzer prefab is a black body with one smaller gray Quad on
    // every face; the lighter center is intentionally visible from all six
    // orientations.
    faces.forEach(([position, rotation]) => this.facePanel(group, position, rotation, 4.5, ROBOT_PAINT_HEX.gray, { side: THREE.DoubleSide }));
  }

  buildLight(group) {
    const glassMaterial = new THREE.MeshBasicMaterial({ color: 0x9498db, transparent: true, opacity: ROBOT_LIGHT_GLASS_BASE_OPACITY, side: THREE.DoubleSide, depthWrite: false });
    const glass = new THREE.Mesh(
      robotOcclusionBoxGeometry(ROBOT_CELL_SIZE, this.robotLightOccludedFaces(group)),
      glassMaterial
    );
    glass.renderOrder = 3;
    glass.userData.sourceRole = "Light/External Glass + Internal Glass (occluded faces)";
    glass.userData.physicsRole = "solid";
    glass.userData.physicsShapeId = "body";
    group.userData.simulationLightGlass = glass;
    group.add(glass);
    const glow = new THREE.PointLight(0xffffff, 0, ROBOT_LIGHT_GLOW_DISTANCE, 2);
    glow.position.set(0, -1.2, 0);
    glow.visible = false;
    glow.castShadow = false;
    glow.userData.sourceRole = "Light/Commanded RGB Glow";
    group.userData.simulationLightGlow = glow;
    group.add(glow);
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.led, {
      maxSize: 3.8,
      position: { y: -1.2 },
      quaternion: { x: -0.7071068, y: 0, z: 0, w: 0.7071068 },
      tone: 0x414690,
      materialOptions: { emissive: color(0x2e3d9b), emissiveIntensity: 0.65, metalness: 0.08 },
      castShadow: false,
      receiveShadow: false,
      physicsRole: "visual",
      sourceRole: "Light/LED + Diode"
    });
  }

  buildServo(group) {
    // The wrapped arrow tangent defines the positive user-facing direction
    // around local +Y; SimulationPhysics converts that sign to Rapier's
    // reflected rigid-group frame.
    // Unity's Servomotor root and its child named Cube both use Cylinder
    // meshes. The child is a short, wider gray cylinder nested at the root
    // origin; the arrows are attached to that child's radial sides.
    this.robotMesh(group, new THREE.CylinderGeometry(ROBOT_CELL_SIZE * 0.4, ROBOT_CELL_SIZE * 0.4, ROBOT_CELL_SIZE, 24), ROBOT_PAINT_HEX["dark-gray"], {
      sourceRole: "Servomotor/Cylinder", physicsShapeId: "body"
    });
    this.robotMesh(group, new THREE.CylinderGeometry(ROBOT_CELL_SIZE * 0.5, ROBOT_CELL_SIZE * 0.5, ROBOT_CELL_SIZE * 0.2, 24), ROBOT_PAINT_HEX.gray, {
      sourceRole: "Servomotor/Inner Cylinder", physicsShapeId: "ring"
    });
    const arrows = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    arrows.forEach((rotation) => this.robotMesh(group, servoArrowGeometry(ROBOT_CELL_SIZE * 0.5 + 0.012, 1.25, 0.7), ROBOT_PAINT_HEX["dark-gray"], {
      rotation: { y: rotation }, materialOptions: { side: THREE.DoubleSide }, castShadow: false, receiveShadow: false,
      sourceRole: "Servomotor/Arrow", physicsRole: "visual"
    }));
  }

  buildPen(group) {
    // The logical Pen cell is a strict 2/3 yellow base plus a 1/3 yellow
    // pyramid above it; the two orange ribbons wrap the full base section.
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE * (2 / 3), ROBOT_CELL_SIZE), ROBOT_PAINT_HEX.yellow, {
      position: { y: -ROBOT_CELL_SIZE / 6 }, sourceRole: "Pen/Body", physicsShapeId: "body"
    });
    [-2.45, 0.45].forEach((y) => this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE * 1.03, 0.34, ROBOT_CELL_SIZE * 1.03), ROBOT_PAINT_HEX.orange, {
      position: { y }, sourceRole: "Pen/Ribbon", physicsRole: "visual"
    }));
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.pyramid, {
      maxSize: ROBOT_CELL_SIZE,
      scale: { x: 1, y: 1, z: 1 / 3 },
      position: { y: ROBOT_CELL_SIZE / 3 },
      quaternion: ROBOT_PEN_TIP_QUATERNION,
      tone: ROBOT_PAINT_HEX.yellow,
      physicsShapeId: "tip",
      sourceRole: "Pen/Yellow Pyramid Tip"
    });
  }

  buildColorSensor(group, wedge) {
    if (wedge) return this.buildWedgeColorSensor(group);
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), this.robotPartColor("colorSensor"));
    // Color Sensor/Quad is attached just below the cube in Unity. Its
    // functional camera frame therefore points down at the default rotation.
    this.robotMesh(group, new THREE.PlaneGeometry(3, 3), 0x05090d, {
      position: { y: -3.03 },
      rotation: ROBOT_COLOR_SENSOR_FACE_ROTATION,
      materialOptions: { side: THREE.DoubleSide },
      sourceRole: "Color Sensor/Quad"
    });
  }

  buildWedgeColorSensor(group) {
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.wedge, {
      maxSize: ROBOT_CELL_SIZE,
      quaternion: ROBOT_WEDGE_COLOR_MESH_FRAME_QUATERNION,
      tone: this.robotPartColor("wedgeColorSensor"),
      sourceRole: "VFC-ROB-WEDGE-COLOR/RightTriangle"
    });
    this.robotMesh(group, new THREE.PlaneGeometry(3, 3), 0x05090d, {
      position: { x: 0, y: -0.03, z: 0.03 },
      quaternion: ROBOT_WEDGE_COLOR_FACE_QUATERNION,
      materialOptions: { side: THREE.DoubleSide },
      sourceRole: "Wedge Color Sensor/Quad"
    });
  }

  buildUltrasonic(group, wedge) {
    if (wedge) return this.buildWedgeUltrasonicSensor(group);
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), this.robotPartColor("ultrasonicSensor"));
    this.robotMesh(group, new THREE.PlaneGeometry(1.8, 1.8), 0x303842, { position: { x: -1.8, z: 3.03 }, rotation: { y: Math.PI }, materialOptions: { side: THREE.DoubleSide }, sourceRole: "Ultrasonic Sensor/Receiver" });
    this.robotMesh(group, new THREE.PlaneGeometry(1.5, 1.5), 0x303842, { position: { x: 1.8, z: 3.03 }, rotation: { y: Math.PI }, materialOptions: { side: THREE.DoubleSide }, sourceRole: "Ultrasonic Sensor/Sender" });
  }

  buildWedgeUltrasonicSensor(group) {
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.wedge, {
      maxSize: ROBOT_CELL_SIZE,
      quaternion: ROBOT_WEDGE_ULTRASONIC_MESH_FRAME_QUATERNION,
      tone: this.robotPartColor("wedgeUltrasonicSensor"),
      sourceRole: "VFC-ROB-WEDGE-ULTRASONIC/RightTriangle"
    });
    const face = ROBOT_WEDGE_ULTRASONIC_FACE_QUATERNION;
    // Unity places the two Quad primitives on the local X axis, with the
    // same tiny Y/Z lift that keeps them attached to the hypotenuse.
    this.robotMesh(group, new THREE.PlaneGeometry(1.8, 1.8), 0x303842, { position: { x: -1.8, y: 0.03, z: 0.03 }, quaternion: face, materialOptions: { side: THREE.DoubleSide }, sourceRole: "Wedge Ultrasonic Sensor/Receiver" });
    this.robotMesh(group, new THREE.PlaneGeometry(1.5, 1.5), 0x303842, { position: { x: 1.8, y: 0.03, z: 0.03 }, quaternion: face, materialOptions: { side: THREE.DoubleSide }, sourceRole: "Wedge Ultrasonic Sensor/Sender" });
  }

  buildTouchSensor(group) {
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE * 0.8), ROBOT_DEFAULT_HEX.touchSensor, {
      position: { z: -0.6 }, sourceRole: "Touch Sensor/Body", physicsShapeId: "body"
    });
    const button = this.robotMesh(group, new THREE.BoxGeometry(TOUCH_BUTTON_WIDTH, TOUCH_BUTTON_WIDTH, TOUCH_BUTTON_DEPTH), 0xff5719, {
      position: { z: TOUCH_BUTTON_REST_Z }, sourceRole: "Touch Sensor/Probe", physicsRole: "sensor", physicsShapeId: "probe"
    });
    group.userData.simulationTouchProbe = button;
  }

  buildSlab(group) {
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE * 0.5), this.robotPartColor("slab"), { position: { z: ROBOT_CELL_SIZE * 0.25 }, paintable: true });
  }

  buildCamera(group) {
    this.robotMesh(group, new THREE.BoxGeometry(ROBOT_CELL_SIZE, ROBOT_CELL_SIZE, ROBOT_CELL_SIZE), ROBOT_DEFAULT_HEX.camera);
    const lens = this.robotMesh(group, new THREE.PlaneGeometry(3.8, 2.6), 0x3aafd9, { position: { y: -3.03 }, rotation: ROBOT_COLOR_SENSOR_FACE_ROTATION, materialOptions: { emissive: color(0x22768e), emissiveIntensity: 0.75, side: THREE.DoubleSide }, sourceRole: "Camera/Quad" });
    const orientationMarker = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ color: 0xf23742, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    orientationMarker.position.set(1.62, 1, -0.02);
    orientationMarker.renderOrder = lens.renderOrder + 1;
    orientationMarker.castShadow = false;
    orientationMarker.receiveShadow = false;
    orientationMarker.userData.sourceRole = "Camera/Top Orientation Marker";
    orientationMarker.userData.physicsRole = "visual";
    orientationMarker.userData.physicsShapeId = "visual";
    lens.add(orientationMarker);
  }

  buildPyramid(group) {
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.pyramid, {
      maxSize: ROBOT_CELL_SIZE,
      quaternion: ROBOT_SOURCE_HALF_TURN_X_QUATERNION,
      tone: this.robotPartColor("pyramid"),
      paintable: true,
      sourceRole: "VFC-ROB-PYRAMID/Pyramid"
    });
  }

  buildCorner(group) {
    this.loadRobotModel(group, ROBOT_SOURCE_ASSETS.corner, {
      maxSize: ROBOT_CELL_SIZE,
      quaternion: ROBOT_CORNER_MESH_FRAME_QUATERNION,
      tone: this.robotPartColor("corner"),
      paintable: true,
      sourceRole: "VFC-ROB-CORNER/Corner"
    });
  }

  buildArena() {
    this.arenaObjectColliderBlueprintCache = null;
    const arena = new THREE.Group();
    arena.name = this.spec?.section === "arenas" ? "ArenaEditorDocument" : "OBREstadualVisualFixture";
    this.world.add(arena);
    this.arenaShadowRoot = arena;
    if (this.spec?.arenaObjectThumbnail) {
      const object = this.spec.arenaObjectThumbnail;
      const objectParent = new THREE.Group();
      objectParent.userData.arenaTileBaseplateColor = ARENA_WHITE_MATERIAL_HEX;
      objectParent.userData.arenaSupportColor = ROBOT_PAINT_HEX.orange;
      this.addArenaObject(objectParent, {
        id: "thumbnail-object",
        type: object.type,
        material: object.material || "ColorWhite",
        mass: 0,
        position: { x: 0, y: 0.8, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: object.scale || { x: 1, y: 1, z: 1 }
      });
      arena.add(objectParent);
      return;
    }
    this.canvas.dataset.arenaId = this.spec?.arenaId || "";
    this.canvas.dataset.arenaModel = this.spec?.arenaModel ? String(this.spec.arenaModel) : "";
    const entries = Array.isArray(this.spec?.arenaTiles)
      ? this.spec.arenaTiles
      : OBR_VISUAL_FIXTURE.map((entry) => ({ ...entry, rotation: (entry.rotation || 0) * 90, definition: { image: entry.image, sizeX: 1, sizeZ: 1, preview: "Line.png", flags: { markable: entry.markable, checkpoint: entry.checkpoint || entry.checkpointPlaced, randomType: entry.random ? "curve" : null, endGoal: entry.goal } } }));
   entries.forEach((entry) => this.addTile(arena, entry));
    this.addDiagnosticsInvisibleVolumeOutlines(arena);
   if (this.spec?.section === "arenas" && this.spec?.arenaScoreSideLabels?.active) this.addArenaScoreSideLabels(arena, this.spec.arenaScoreSideLabels);
    if (this.scope === "simulation" && this.spec?.section === "simulator" && this.spec.simulatorRobot?.id && Array.isArray(this.spec.simulatorRobot.parts) && this.spec.simulatorRobot.parts.length) {
      this.addSimulatorRobot(arena, this.spec.simulatorRobot);
      if (!this.passiveReplayMode) this.buildRobotColliderBlueprint(this.spec.simulatorRobot);
      this.updateStarterKitProjection(arena);
    }
    this.updateArenaLighting(this.spec?.arenaSettings);
    if (this.spec?.section === "arenas") this.addArenaPlacementGrid(arena);
    this.addArenaPlacementSurface(arena);
    if (this.spec?.section === "arenas") this.addArenaPlacementGhost(arena, this.spec.arenaPlacement);
  }

  checkpointProjectionsForEntry(entry) {
    if (this.spec?.preflight) {
      return (this.spec.simulationCheckpointProjections || []).filter((projection) => projection.tileId === entry.id);
    }
    const projections = [
      this.spec?.simulationRuntime?.tracking?.checkpointProjections,
      this.spec?.simulationCheckpointProjections,
      this.spec?.arenaRuntimeConfig?.path?.checkpointProjections
    ].find((candidate) => Array.isArray(candidate) && candidate.length) || [];
    const matched = projections.filter((projection) => projection.tileId === entry.id);
    if (matched.length) return matched;
    const pathStatus = this.spec?.simulationRuntime?.path?.status || this.spec?.arenaRuntimeConfig?.path?.status;
    if (pathStatus && pathStatus !== "valid") return [];
    if (this.scope === "simulation") return [];
    return [];
  }

  addCheckpointWedges(group, entry) {
    const projections = this.checkpointProjectionsForEntry(entry);
    if (!projections.length) return;
    const targetParent = group.userData.arenaRampOutlineParent || group;
    const sizeX = Math.max(1, Number(group.userData.arenaTileSizeX) || 1);
    const sizeZ = Math.max(1, Number(group.userData.arenaTileSizeZ) || 1);
    const tileRotation = THREE.MathUtils.degToRad(Number(entry.rotation) || 0);
    const slots = {
      north: { x: 0, z: 2.35, angle: 0, tangent: { x: 1, z: 0 } },
      east: { x: 2.35, z: 0, angle: Math.PI / 2, tangent: { x: 0, z: 1 } },
      south: { x: 0, z: -2.35, angle: Math.PI, tangent: { x: 1, z: 0 } },
      west: { x: -2.35, z: 0, angle: -Math.PI / 2, tangent: { x: 0, z: 1 } }
    };
    const grouped = new Map();
    projections.forEach((projection) => {
      const direction = slots[projection.direction] ? projection.direction : "north";
      if (!grouped.has(direction)) grouped.set(direction, []);
      grouped.get(direction).push(projection);
    });
    grouped.forEach((directionProjections, direction) => {
      const slot = slots[direction];
      directionProjections.forEach((projection, index) => {
      const wedge = new THREE.Mesh(
        checkpointWedgeGeometry(),
        new THREE.MeshBasicMaterial({ color: 0xf1a45b, transparent: true, opacity: 0.96, depthWrite: false, side: THREE.DoubleSide })
      );
      const tangentOffset = (index - (directionProjections.length - 1) / 2) * 1.05;
      const localSlot = new THREE.Vector3(
        slot.x + slot.tangent.x * tangentOffset,
        0,
        slot.z + slot.tangent.z * tangentOffset
      ).applyAxisAngle(new THREE.Vector3(0, 1, 0), tileRotation);
      wedge.position.set(
        ((sizeX - 1) * CELL_SIZE) / 2 + localSlot.x,
        (group.userData.arenaTileSurfacePlaneY ?? ARENA_SURFACE_PLANE_Y) + 0.14,
        -((sizeZ - 1) * CELL_SIZE) / 2 + localSlot.z
      );
      wedge.rotation.y = slot.angle + tileRotation;
      wedge.name = `CheckpointWedge:${entry.id}:${projection.occurrenceIndex ?? index}`;
      wedge.renderOrder = 5;
      wedge.castShadow = false;
      wedge.receiveShadow = false;
      wedge.userData.debugOnly = true;
      wedge.userData.arenaTileId = entry.id;
      wedge.userData.arenaCheckpointOccurrence = projection.occurrenceIndex ?? index;
      wedge.userData.arenaCheckpointDirection = projection.direction || "unknown";
      targetParent.add(wedge);
      this.editorLayers.push(wedge);
      });
    });
  }

  addArenaScoreSideLabels(parent, descriptor = {}) {
    if (!descriptor.active || !descriptor.tileId) return;
    const entry = (this.spec?.arenaTiles || []).find((tile) => tile.id === descriptor.tileId);
    if (!entry) return;
    const definition = entry.definition || {};
    const surfacePlaneY = tileSurfacePlaneY(tileBaseThickness(arenaTileVisuals(entry)));
    const sizeX = Math.max(1, Number(definition.sizeX) || 1);
    const sizeZ = Math.max(1, Number(definition.sizeZ) || 1);
    const spanX = (sizeX - 1) * CELL_SIZE;
    const spanZ = (sizeZ - 1) * CELL_SIZE;
    const centerX = spanX / 2;
    const centerZ = -spanZ / 2;
    const group = new THREE.Group();
    group.name = `ArenaScoreSideLabels:${entry.id}`;
    group.userData.debugOnly = true;
    const labelPositions = [
      ["A", { x: centerX, z: -spanZ - CELL_SIZE / 2 - 0.75 }],
      ["B", { x: spanX + CELL_SIZE / 2 + 0.75, z: centerZ }],
      ["a", { x: centerX, z: CELL_SIZE / 2 + 0.75 }],
      ["b", { x: -CELL_SIZE / 2 - 0.75, z: centerZ }]
    ];
    const positions = Object.fromEntries(labelPositions);
    labelPositions.forEach(([side, position]) => {
      const state = descriptor.states?.[side] || {};
      const sprite = arenaScoreSideLabelSprite(descriptor.labels?.[side] || side, state.blocked || state.self ? 0.5 : 1);
      if (!sprite) return;
      sprite.position.set(position.x, surfacePlaneY + 0.72, position.z);
      sprite.userData.arenaScoreSide = side;
      group.add(sprite);
      if (state.blocked || state.self) {
        const status = arenaScoreSideStatusSprite(state.self ? "loop" : "blocked");
        if (status) {
          status.position.set(position.x, surfacePlaneY + 1.55, position.z);
          status.userData.arenaScoreSide = side;
          status.userData.arenaScoreSideStatus = state.self ? "loop" : "blocked";
          group.add(status);
        }
      }
    });
    (descriptor.connections || []).forEach((connection, index) => {
      const from = positions[connection.from];
      const to = positions[connection.to];
      if (!from || !to) return;
      const start = new THREE.Vector3(from.x, surfacePlaneY + 0.98, from.z);
      const end = new THREE.Vector3(to.x, surfacePlaneY + 0.98, to.z);
      const direction = end.clone().sub(start);
      direction.y = 0;
      const length = direction.length();
      if (length < 0.01) return;
      direction.normalize();
      start.addScaledVector(direction, 1.35);
      end.addScaledVector(direction, -1.35);
      const lineMaterial = new THREE.MeshBasicMaterial({ color: 0x53b8cc, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, toneMapped: false });
      const thickSegment = (from, to, name) => {
        const delta = to.clone().sub(from);
        const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, delta.length(), 8), lineMaterial);
        segment.position.copy(from).add(to).multiplyScalar(0.5);
        segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        segment.name = name;
        segment.renderOrder = 7;
        segment.userData.debugOnly = true;
        return segment;
      };
      const line = thickSegment(start, end, `ArenaScoreConnection:${entry.id}:${connection.from}-${connection.to}:${index}`);
      group.add(line);
      const side = new THREE.Vector3(-direction.z, 0, direction.x);
      const arrowBack = end.clone().addScaledVector(direction, -0.7);
      const arrow = new THREE.Group();
      arrow.name = `ArenaScoreConnectionArrow:${entry.id}:${connection.from}-${connection.to}:${index}`;
      arrow.renderOrder = 7;
      arrow.userData.debugOnly = true;
      arrow.add(
        thickSegment(end, arrowBack.clone().addScaledVector(side, 0.34), `${arrow.name}:left`),
        thickSegment(end, arrowBack.clone().addScaledVector(side, -0.34), `${arrow.name}:right`)
      );
      group.add(arrow);
      this.editorLayers.push(line, arrow);
    });
    group.position.set(arenaWorldX(entry.x), (Number(entry.y) || 0) * LEVEL_HEIGHT, arenaWorldZ(entry.z));
    group.rotation.y = -(Number(entry.rotation) || 0) * Math.PI / 180;
    parent.add(group);
    this.editorLayers.push(group);
  }

  refreshMarkableOutlines() {
    const status = this.spec?.simulationRuntime?.status;
    const hidden = this.scope === "simulation" && !this.spec?.preflight && ["running", "paused"].includes(status);
    if (hidden === this.markableOutlinesHidden) return;
    this.markableOutlinesHidden = hidden;
    this.arenaOutlines.forEach((outlines) => outlines.forEach((outline) => {
      if (outline.userData?.arenaOutlineRole === "markable") outline.visible = !hidden;
    }));
  }

  refreshTrackingOutlines() {
    if (!this.world) return;
    const tracking = this.spec?.simulationRuntime?.tracking || {};
    const active = this.scope === "simulation" && this.spec?.diagnostics && !this.spec?.competitionActive
      && this.spec?.simulationRuntime?.status === "running" && tracking.enabled === true;
    const trackingState = {
      active: Boolean(active),
      currentTileId: active ? tracking.currentTileId || "" : "",
      status: active ? tracking.status || "" : "",
      visited: active ? tracking.visitedOccurrences || [] : []
    };
    const nextKey = JSON.stringify(trackingState);
    if (nextKey === this.trackingVisualStateKey) return;
    this.trackingVisualStateKey = nextKey;

    const staleMarkers = [];
    this.world.traverse((object) => {
      if (object.userData?.arenaTrackingRole) staleMarkers.push(object);
    });
    staleMarkers.forEach((marker) => {
      marker.parent?.remove(marker);
      marker.geometry?.dispose();
      if (Array.isArray(marker.material)) marker.material.forEach((material) => material?.dispose());
      else marker.material?.dispose();
    });
    this.editorLayers = this.editorLayers.filter((layer) => !layer.userData?.arenaTrackingRole);
    if (!active) return;

    const visitedTileIds = new Set(tracking.visitedTileIds || []);
    const tileGroups = [];
    this.world.traverse((object) => {
      if (object.userData?.arenaTileId && object.userData?.arenaTileSizeX) tileGroups.push(object);
    });
    tileGroups.forEach((group) => {
      const tileId = group.userData.arenaTileId;
      if (tracking.status !== "rescueZone" && tracking.currentTileId === tileId) {
        const outline = ["pathSkip", "outOfPath", "outOfBounds"].includes(tracking.status)
          ? { role: "error", color: 0xf06a78 }
          : tracking.status === "outOfLine"
            ? { role: "deviation", color: 0xf1a45b }
            : { role: "current", color: 0x3aafd9 };
        this.addTrackingOutline(group, outline.role, outline.color);
      } else if (visitedTileIds.has(tileId)) {
        this.addTrackingOutline(group, "traversed", 0x8f9aa8);
      }
    });
  }

  addTrackingOutline(group, role, outlineColor) {
    const rampParent = group.userData.arenaRampOutlineParent;
    const width = (group.userData.arenaTileSizeX || 1) * CELL_SIZE + 0.16;
    const depth = (group.userData.arenaTileSizeZ || 1) * CELL_SIZE + 0.16;
    const baseThickness = Number(group.userData.arenaTileBaseThickness) || ARENA_BASE_THICKNESS;
    let geometry;
    if (rampParent) geometry = this.createArenaRampEdgeGeometry(1.015, baseThickness);
    else {
      const sourceGeometry = new THREE.BoxGeometry(width, baseThickness + 0.16, depth);
      geometry = new THREE.EdgesGeometry(sourceGeometry);
      sourceGeometry.dispose();
    }
    const marker = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.92, depthTest: true, depthWrite: false }));
    if (!rampParent) marker.position.set(((group.userData.arenaTileSizeX || 1) - 1) * CELL_SIZE / 2, (group.userData.arenaTileBaseBottomY ?? ARENA_BASE_BOTTOM) + (baseThickness + 0.16) / 2, -((group.userData.arenaTileSizeZ || 1) - 1) * CELL_SIZE / 2);
    marker.renderOrder = 4;
    marker.userData.debugOnly = true;
    marker.userData.arenaTrackingRole = role;
    (rampParent || group).add(marker);
   this.editorLayers.push(marker);
 }

  addDiagnosticsInvisibleVolumeOutlines(parent) {
    if (this.scope !== "simulation" || !this.spec?.diagnostics || this.spec?.competitionActive) return;
    const runtime = this.spec.simulationRuntime || {};
    const addLine = (geometry, position, name, role, outlineColor, rotationY = 0) => {
      const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false }));
      line.name = name;
      line.position.set(Number(position?.x) || 0, Number(position?.y) || 0, Number(position?.z) || 0);
      line.rotation.y = THREE.MathUtils.degToRad(Number(rotationY) || 0);
      line.renderOrder = 7;
      line.userData.debugOnly = true;
      line.userData.diagnosticsPhysicsRole = role;
      parent.add(line);
      this.editorLayers.push(line);
    };
    (runtime.rescueTriggers || []).forEach((trigger) => {
      const width = Math.max(0.01, Number(trigger.width) || CELL_SIZE);
      const depth = Math.max(0.01, Number(trigger.depth) || CELL_SIZE);
      const height = Math.max(0.01, Number(trigger.height) || 2.2);
      const sourceTriangle = trigger.triangleOrientation === "source";
      const offsetX = Number(trigger.offsetX) || 0;
      const offsetZ = Number(trigger.offsetZ) || 0;
      const points = [
        [offsetX - width / 2, 0, offsetZ - depth / 2], [offsetX + width / 2, 0, offsetZ - depth / 2], [offsetX + (sourceTriangle ? -width / 2 : width / 2), 0, offsetZ + depth / 2],
        [offsetX - width / 2, height, offsetZ - depth / 2], [offsetX + width / 2, height, offsetZ - depth / 2], [offsetX + (sourceTriangle ? -width / 2 : width / 2), height, offsetZ + depth / 2]
      ];
      const edges = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
      const positions = edges.flatMap(([from, to]) => [...points[from], ...points[to]]);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      addLine(geometry, trigger.center, `DiagnosticsRescueTrigger:${trigger.objectId || trigger.key}`, "rescue-trigger", DIAGNOSTICS_RESCUE_TRIGGER_COLOR, trigger.rotationY);
    });
    if (this.spec?.arenaSettings?.end_on_endgoal !== false) {
      (runtime.finishLaneDetectors || []).forEach((detector) => {
        const radius = Math.max(0.01, Number(detector.radius) || 3.7);
        const height = Math.max(0.01, Number(detector.height) || 3);
        const sourceGeometry = new THREE.BoxGeometry(radius * 2, height, radius * 2);
        const geometry = new THREE.EdgesGeometry(sourceGeometry);
        sourceGeometry.dispose();
        addLine(geometry, detector.position, `DiagnosticsGameStopper:${detector.tileId || detector.id}`, "game-stopper", DIAGNOSTICS_GAME_STOPPER_COLOR);
      });
    }
  }

 addTile(parent, entry) {
    const definition = entry.definition || {};
    const group = new THREE.Group();
    group.userData.arenaTileId = entry.id;
    group.userData.arenaPlacementGhost = entry.userData?.arenaPlacementGhost === true;
    const level = entry.y || 0;
    group.position.set(arenaWorldX(entry.x), level * LEVEL_HEIGHT, arenaWorldZ(entry.z));
    group.rotation.y = -(entry.rotation || 0) * Math.PI / 180;
    const sizeX = Math.max(1, Number(definition.sizeX) || 1);
    const sizeZ = Math.max(1, Number(definition.sizeZ) || 1);
    const visuals = arenaTileVisuals(entry);
    const baseThickness = tileBaseThickness(visuals);
    const baseCenterY = tileBaseCenterY(baseThickness);
    const baseTopY = tileBaseTopY(baseThickness);
    const surfacePlaneY = tileSurfacePlaneY(baseThickness);
    const wallVerticalOffset = arenaTileWallVerticalOffset(entry);
    const isRamp = arenaTileIsRamp(entry);
    const baseplateColor = arenaVisualColor(visuals.baseplateColor);
    const supportColor = arenaVisualColor(visuals.supportColor, ROBOT_PAINT_HEX.orange);
    group.userData.arenaTileSizeX = sizeX;
    group.userData.arenaTileSizeZ = sizeZ;
    group.userData.arenaTileBaseThickness = baseThickness;
    group.userData.arenaTileBaseBottomY = ARENA_BASE_BOTTOM;
    group.userData.arenaTileBaseCenterY = baseCenterY;
    group.userData.arenaTileSurfacePlaneY = surfacePlaneY;
    const objectParent = isRamp ? this.createRampObjectParent(group) : group;
    objectParent.userData.arenaTileBaseplateColor = baseplateColor;
    objectParent.userData.arenaSupportColor = supportColor;
    objectParent.userData.arenaTileNoiseTexture = visuals.useNoiseTexture ? this.arenaNoiseTextureForPosition({ x: entry.x, y: entry.y || 0, z: entry.z }) : null;
    const cells = Array.from({ length: sizeX * sizeZ }, (_, index) => ({ x: index % sizeX, z: Math.floor(index / sizeX) }));
    cells.forEach((cell) => {
      if (isRamp) {
        this.addRampCell(group, cell, entry, visuals);
        return;
      }
      const baseGeometry = this.scaleRobotPrimitiveUvs(new THREE.BoxGeometry(CELL_SIZE, baseThickness, CELL_SIZE), 1 / CELL_SIZE);
      const noiseOptions = visuals.useNoiseTexture ? { map: this.arenaNoiseTextureForPosition({ x: entry.x + cell.x, y: entry.y || 0, z: entry.z + cell.z }) } : {};
      const base = new THREE.Mesh(baseGeometry, material(baseplateColor, noiseOptions));
      base.position.set(arenaWorldX(cell.x), baseCenterY, arenaWorldZ(cell.z));
      base.castShadow = Number(entry.y) > 0;
      base.receiveShadow = true;
      this.makePickable(base, entry.id, "tile");
      base.userData.arenaTileGroup = group;
      group.add(base);
      const imagePath = entry.goalPlaceholder === "duplicate" ? null : arenaSurfaceImagePath(entry, definition);
      if (imagePath) objectParent.userData.arenaTileImagePath = imagePath;
      if (imagePath) {
        // Slight overlap closes texture seams between adjacent 10×10 Tiles.
        const overlay = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_TILE_IMAGE_SIZE, ARENA_TILE_IMAGE_SIZE), this.arenaSurfaceOverlayMaterial(this.texture(imagePath)));
        overlay.rotation.x = -Math.PI / 2;
        overlay.position.set(arenaWorldX(cell.x), baseTopY + 0.012, arenaWorldZ(cell.z));
        overlay.renderOrder = 1;
        group.add(overlay);
      }
    });
    cells.forEach((cell) => {
      ARENA_TILE_WALL_SIDE_IDS.forEach((side) => {
        const wall = visuals.walls[side];
        if (!wall?.enabled) return;
        const layout = ARENA_TILE_WALL_SIDE_LAYOUT[side];
        const [halfX, halfY, halfZ] = layout.halfExtents;
        const geometry = this.scaleRobotPrimitiveUvs(new THREE.BoxGeometry(halfX * 2, halfY * 2, halfZ * 2), 1 / CELL_SIZE);
        if (isRamp) {
          const positions = geometry.getAttribute("position");
          for (let index = 0; index < positions.count; index += 1) {
            const point = arenaTileWallPoint(side, {
              x: positions.getX(index),
              y: positions.getY(index),
              z: positions.getZ(index)
            }, true, wallVerticalOffset);
            positions.setXYZ(index, point.x, point.y, point.z);
          }
          positions.needsUpdate = true;
          geometry.computeVertexNormals();
        }
        const noiseOptions = visuals.useWallNoise ? { map: this.arenaNoiseTextureForPosition({ x: entry.x + cell.x, y: entry.y || 0, z: entry.z + cell.z }) } : {};
        const wallMesh = new THREE.Mesh(geometry, material(arenaVisualColor(wall.color, ROBOT_PAINT_HEX.white), noiseOptions));
        if (isRamp) wallMesh.position.set(arenaWorldX(cell.x), 0, arenaWorldZ(cell.z));
        else wallMesh.position.set(arenaWorldX(cell.x) + layout.x, ARENA_TILE_WALL_CENTER_Y + wallVerticalOffset, arenaWorldZ(cell.z) + layout.z);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        this.makePickable(wallMesh, entry.id, "tile");
        wallMesh.userData.arenaTileGroup = group;
        group.add(wallMesh);
      });
    });
    if (visuals.supportType !== "disabled" && level > 0) this.addRaisedSupports(group, level, supportColor, visuals.supportType, entry.id);
    const invalidGoalPlaceholder = entry.goalPlaceholder === "duplicate";
    const objects = invalidGoalPlaceholder ? [] : [...(entry.objects || [])];
    const flags = entry.flags || definition.flags || {};
    if (this.spec?.section === "arenas") this.addArenaEditorInvisibleVolumeOutlines(group, entry, objects, flags);
    // `endGoal` is semantic Arena state; the canonical loader guarantees the
    // authored red Finish Lane payload before this renderer receives the Tile.
    // Advanced Arena editing also exposes the otherwise hidden GameStopper.
    if (flags.endGoal && this.spec?.arenaSettings?.end_on_endgoal !== false) this.addArenaSpecialOutline(group, 0xf06a78, "endGoal");
    if (entry.goalPlaceholder === "duplicate") this.addDuplicateGoalPlaceholder(group);
    if (flags.markedContent) {
      this.addMarkedIntersection(group);
      this.addArenaSpecialOutline(group, 0x50c878, "markedContent");
    }
    const checkpointProjections = this.checkpointProjectionsForEntry(entry);
    if (flags.checkpoint) {
      if (checkpointProjections.length) this.addCheckpointPlane(group);
      else this.addArenaSpecialOutline(group, 0xf1c75b, "checkpointSelection");
    } else if (checkpointProjections.length) {
      this.addCheckpointPlane(group);
    } else if (!this.passiveReplayMode && (this.spec?.preflightCheckpointSetup
      ? (this.spec.preflightCheckpointSelectableTileIds || []).includes(entry.id)
      : flags.markable) && !checkpointProjections.length) {
      this.addMarkablePin(group);
    }
    if (entry.tileOfTiles?.enabled) this.addRandomMarker(group);
    if (!invalidGoalPlaceholder && this.spec?.arenaObjectPreview && this.spec.arenaObjectPreview.id && this.spec.arenaObjectPreview._tileId === entry.id) objects.push(this.spec.arenaObjectPreview);
    objects.forEach((object, index) => {
      const visual = this.addArenaObject(objectParent, object, entry.tileId || definition.id);
      if (this.scope === "simulation" && visual && object?.type !== "none") {
        const objectId = object.id || `object-${index + 1}`;
        visual.userData.simulationObjectKey = `${entry.id}:${objectId}`;
        visual.userData.simulationBasePosition = visual.position.clone();
        visual.userData.simulationBaseRotation = visual.rotation.clone();
        this.simulationObjects.set(`${entry.id}:${objectId}`, visual);
      }
    });
    parent.add(group);
    if (entry.userData?.arenaPlacementGhost) this.applyArenaGhostStyle(group);
    return group;
  }

  addArenaEditorInvisibleVolumeOutlines(group, entry, objects = [], flags = {}) {
    const addLine = (geometry, position, name, role, outlineColor, parent = group) => {
      const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false }));
      line.name = name;
      line.position.set(Number(position?.x) || 0, Number(position?.y) || 0, Number(position?.z) || 0);
      line.renderOrder = 7;
      line.userData.debugOnly = true;
      line.userData.arenaEditorPhysicsRole = role;
      parent.add(line);
      this.editorLayers.push(line);
    };
    if (flags.endGoal) {
      const radius = 3.7;
      const height = 3;
      const sourceGeometry = new THREE.BoxGeometry(radius * 2, height, radius * 2);
      const geometry = new THREE.EdgesGeometry(sourceGeometry);
      sourceGeometry.dispose();
      addLine(geometry, { x: 0, y: SIMULATION_ROBOT_SURFACE_HEIGHT, z: 0 }, `ArenaEditorGameStopper:${entry.id}`, "game-stopper", DIAGNOSTICS_GAME_STOPPER_COLOR);
    }
  }

  addArenaEditorRescueTriggerVolume(anchor, object = {}, tileId = "") {
    const width = CELL_SIZE * RESCUE_EDITOR_VOLUME_SCALE;
    const depth = CELL_SIZE * RESCUE_EDITOR_VOLUME_SCALE;
    const height = RESCUE_TRIGGER_HEIGHT * RESCUE_EDITOR_VOLUME_SCALE;
    // Scale around the source wedge's right-angle corner: the reduced volume
    // keeps both catheti on the source catheti instead of sharing its diagonal.
    const { offsetX, offsetZ } = rescueTriggerOffsets();
    const points = [
      [offsetX - width / 2, 0, offsetZ - depth / 2], [offsetX + width / 2, 0, offsetZ - depth / 2], [offsetX - width / 2, 0, offsetZ + depth / 2],
      [offsetX - width / 2, height, offsetZ - depth / 2], [offsetX + width / 2, height, offsetZ - depth / 2], [offsetX - width / 2, height, offsetZ + depth / 2]
    ];
    const edges = [[0, 1], [1, 2], [2, 0], [3, 4], [4, 5], [5, 3], [0, 3], [1, 4], [2, 5]];
    const positions = edges.flatMap(([from, to]) => [...points[from], ...points[to]]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: DIAGNOSTICS_RESCUE_TRIGGER_COLOR, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false }));
    line.name = `ArenaEditorRescueTrigger:${tileId}:${object.id || "evacuation"}`;
    line.position.set(0, 0, 0);
    line.renderOrder = 7;
    line.userData.debugOnly = true;
    line.userData.arenaEditorPhysicsRole = "rescue-trigger";
    anchor.add(line);
    this.editorLayers.push(line);
  }

  createRampObjectParent(tileGroup) {
    const transform = arenaRampObjectTransform(ARENA_RAMP_SURFACE_ANGLE);
    const objectParent = new THREE.Group();
    objectParent.name = "RampObjects";
    objectParent.position.set(transform.position.x, transform.position.y, transform.position.z);
    objectParent.rotation.set(transform.rotation.x, transform.rotation.y, transform.rotation.z);
    objectParent.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    tileGroup.add(objectParent);
    return objectParent;
  }

  addArenaPlacementSurface(parent) {
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = -0.4;
    surface.userData.pickId = "arena-space";
    surface.userData.pickKind = "arena-space";
    this.arenaPlacementSurface = surface;
    parent.add(surface);
    this.pickables.push(surface);
  }

  addArenaPlacementGrid(parent) {
    const minX = -50;
    const maxX = 49;
    const minZ = -50;
    const maxZ = 49;
    const grid = new THREE.GridHelper(CELL_SIZE * 100, 100, 0x5e9aac, 0x31515f);
    grid.name = "ArenaPlacementGrid";
    grid.position.set(((minX + maxX) / 2) * CELL_SIZE, ARENA_SURFACE_PLANE_Y + 0.025, -((minZ + maxZ) / 2) * CELL_SIZE);
    grid.renderOrder = 2;
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((gridMaterial) => {
      gridMaterial.transparent = true;
      gridMaterial.opacity = 0.34;
      gridMaterial.depthWrite = false;
    });
    this.arenaPlacementGrid = grid;
    grid.visible = this.spec?.section === "arenas" && this.spec?.arenaGridVisible !== false;
    parent.add(grid);
  }

  addArenaPlacementGhost(parent, placement) {
    if (!placement?.definition) return;
    const ghostRoot = new THREE.Group();
    ghostRoot.name = "ArenaPlacementGhost";
    ghostRoot.userData.arenaPlacementGhost = true;
    parent.add(ghostRoot);
    this.arenaPlacementGhost = ghostRoot;
    if (Array.isArray(placement.placementTiles) && placement.placementTiles.length) {
      placement.placementTiles.forEach((tile) => {
        this.addTile(ghostRoot, {
          ...tile,
          x: tile.x || 0,
          z: tile.z || 0,
          y: 0,
          userData: { arenaPlacementGhost: true }
        });
      });
    } else {
      this.addTile(ghostRoot, {
        ...placement,
        id: "arena-placement-ghost",
        x: 0,
        z: 0,
        y: 0,
        rotation: 0,
        userData: { arenaPlacementGhost: true }
      });
    }
    this.arenaPlacementGhost.userData.arenaPlacementGhost = true;
    this.updateArenaPlacementGhost();
  }

  applyArenaGhostStyle(root) {
    if (!root) return;
    root.traverse((item) => {
      if (!item.isMesh && !item.isLine && !item.isLineSegments) return;
      if (item.userData?.pickKind) {
        item.visible = false;
        return;
      }
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      materials.forEach((ghostMaterial) => {
        if (!ghostMaterial) return;
        ghostMaterial.transparent = true;
        ghostMaterial.opacity = Math.min(Number(ghostMaterial.opacity) || 1, 0.34);
        ghostMaterial.depthWrite = false;
        if (ghostMaterial.emissive) {
          ghostMaterial.emissive.set(0x2fa9c2);
          ghostMaterial.emissiveIntensity = Math.max(ghostMaterial.emissiveIntensity || 0, 0.16);
        }
      });
      item.castShadow = false;
      item.receiveShadow = false;
      item.renderOrder = 4;
    });
  }

  updateArenaPlacementGhost() {
    if (this.arenaPlacementGrid) this.arenaPlacementGrid.visible = this.spec?.section === "arenas" && this.spec?.arenaGridVisible !== false;
    const placement = this.spec?.section === "arenas" && this.spec?.arenaMode === "place" ? this.spec.arenaPlacement : null;
    const ghost = this.arenaPlacementGhost;
    if (!ghost || !placement || !this.arenaPlacementTarget) {
      if (ghost) ghost.visible = false;
      return;
    }
    ghost.visible = true;
    ghost.position.set(arenaWorldX(this.arenaPlacementTarget.x), (Number(placement.y) || 0) * LEVEL_HEIGHT, arenaWorldZ(this.arenaPlacementTarget.z));
    ghost.rotation.y = -((Number(placement.rotation) || 0) * Math.PI) / 180;
    this.applyArenaGhostStyle(ghost);
  }

  addRampCell(parent, cell, entry, visuals = arenaTileVisuals(entry)) {
    const plateThickness = tileBaseThickness(visuals);
    const rampLowTopY = tileBaseTopY(plateThickness);
    const rampHighTopY = rampLowTopY + LEVEL_HEIGHT;
    const placeholder = new THREE.Group();
    placeholder.position.set(arenaWorldX(cell.x), 0, arenaWorldZ(cell.z));
    parent.add(placeholder);
    // Keep the rendered ramp plate separate from its structural supports. The
    // Tile's canonical selection target is this plate, even when the ray hits
    // a support wall or foot below it.
    const plate = new THREE.Group();
    plate.name = "RampPlate";
    placeholder.add(plate);
    if (!parent.userData.arenaRampOutlineParent) parent.userData.arenaRampOutlineParent = plate;
    const pick = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE, 0.2, CELL_SIZE), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pick.position.y = 0.05;
    this.makePickable(pick, entry.id, "tile");
    pick.userData.arenaTileGroup = parent;
    pick.userData.arenaRampOutlineParent = plate;
    placeholder.add(pick);
    if (visuals.supportType !== "disabled") this.addRampSupports(placeholder, entry, arenaVisualColor(visuals.supportColor, ROBOT_PAINT_HEX.orange), visuals.supportType);
    const assetPromise = this.trackAssetPromise(this.arenaAssetCache.get(ARENA_RAMP) ?? new Promise((resolve, reject) => this.fbxLoader.load(ARENA_RAMP, resolve, undefined, reject)));
    this.arenaAssetCache.set(ARENA_RAMP, assetPromise);
    assetPromise.then((asset) => {
      const sourceMesh = asset.clone(true);
      this.normalizeArenaRampAsset(sourceMesh, plateThickness);
      sourceMesh.traverse((item) => {
        if (!item.isMesh) return;
        item.userData.sharedAssetGeometry = false;
        const noiseOptions = visuals.useNoiseTexture ? { map: this.arenaNoiseTextureForPosition({ x: entry.x + cell.x, y: entry.y || 0, z: entry.z + cell.z }) } : {};
        item.material = material(arenaVisualColor(visuals.baseplateColor), { ...noiseOptions, side: THREE.DoubleSide });
        item.castShadow = true;
        item.receiveShadow = true;
      });
      plate.add(sourceMesh);
      if (entry.userData?.arenaPlacementGhost) this.applyArenaGhostStyle(sourceMesh);
      if (this.mode === "arena") this.fitArenaShadowCoverage();
      const imagePath = arenaSurfaceImagePath(entry);
      if (imagePath) {
        const overlay = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_TILE_IMAGE_SIZE, ARENA_RAMP_IMAGE_LENGTH), this.arenaSurfaceOverlayMaterial(this.texture(imagePath), { side: THREE.DoubleSide, depthWrite: false }));
        overlay.rotation.x = -Math.PI / 2 + ARENA_RAMP_SURFACE_ANGLE;
        overlay.position.set(0, (rampLowTopY + rampHighTopY) / 2 + 0.025, 0);
        overlay.renderOrder = 1;
        plate.add(overlay);
        if (entry.userData?.arenaPlacementGhost) this.applyArenaGhostStyle(overlay);
      }
      this.requestRender();
    }).catch(() => {
      placeholder.userData.sourceAssetMissing = true;
      document.dispatchEvent(new CustomEvent("sbotics-three-asset-error", { detail: { path: ARENA_RAMP } }));
    });
  }

  arenaRampPlatePoints(footprintScale = 1, plateThickness = ARENA_RAMP_PLATE_THICKNESS) {
    // Ramp.prefab is a baseplate: it keeps the same slab thickness as a flat
    // Tile, while its top follows the source incline. It is not a filled
    // triangle, so the side edge stays consistent with the neighboring bases.
    // Special outlines are inset along the ramp surface, not only on X/Z.
    // Scaling only X/Z makes the outline steeper than the ramp and visibly
    // crosses it.
    const scale = Math.max(0.01, Number(footprintScale) || 1);
    const lowTopY = tileBaseTopY(plateThickness);
    const highTopY = lowTopY + LEVEL_HEIGHT;
    const topCenterY = (lowTopY + highTopY) / 2;
    const halfRise = (LEVEL_HEIGHT * scale) / 2;
    const lowY = topCenterY - halfRise;
    const highY = topCenterY + halfRise;
    const bottomLowY = lowY - plateThickness;
    const bottomHighY = highY - plateThickness;
    const halfX = CELL_SIZE * scale / 2;
    const halfZ = CELL_SIZE * scale / 2;
    return {
      highLeft: [-halfX, highY, -halfZ],
      highRight: [halfX, highY, -halfZ],
      lowLeft: [-halfX, lowY, halfZ],
      lowRight: [halfX, lowY, halfZ],
      bottomHighLeft: [-halfX, bottomHighY, -halfZ],
      bottomHighRight: [halfX, bottomHighY, -halfZ],
      bottomLowLeft: [-halfX, bottomLowY, halfZ],
      bottomLowRight: [halfX, bottomLowY, halfZ]
    };
  }

  createArenaRampEdgeGeometry(footprintScale = 1, plateThickness = ARENA_RAMP_PLATE_THICKNESS) {
    const points = this.arenaRampPlatePoints(footprintScale, plateThickness);
    const edges = [
      ["highLeft", "highRight"], ["highRight", "lowRight"], ["lowRight", "lowLeft"], ["lowLeft", "highLeft"],
      ["bottomHighLeft", "bottomHighRight"], ["bottomHighRight", "bottomLowRight"], ["bottomLowRight", "bottomLowLeft"], ["bottomLowLeft", "bottomHighLeft"],
      ["highLeft", "bottomHighLeft"], ["highRight", "bottomHighRight"], ["lowLeft", "bottomLowLeft"], ["lowRight", "bottomLowRight"]
    ];
    const vertices = edges.flatMap(([first, second]) => [...points[first], ...points[second]]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }

  createArenaRampGeometry(plateThickness = ARENA_RAMP_PLATE_THICKNESS) {
    const points = this.arenaRampPlatePoints(1, plateThickness);
    const positions = [];
    const triangle = (first, second, third) => {
      positions.push(...points[first], ...points[second], ...points[third]);
    };
    // Keep every face wound outwards. The previous inward winding depended on
    // DoubleSide normal flipping, which made the sloped shell sensitive to
    // renderer/shadow-map angle changes and exposed diagonal shading seams.
    triangle("highLeft", "lowRight", "highRight");
    triangle("highLeft", "lowLeft", "lowRight");
    triangle("bottomHighLeft", "bottomHighRight", "bottomLowRight");
    triangle("bottomHighLeft", "bottomLowRight", "bottomLowLeft");
    triangle("bottomHighLeft", "highLeft", "highRight");
    triangle("bottomHighLeft", "highRight", "bottomHighRight");
    triangle("bottomHighLeft", "bottomLowLeft", "lowLeft");
    triangle("bottomHighLeft", "lowLeft", "highLeft");
    triangle("bottomHighRight", "lowRight", "bottomLowRight");
    triangle("bottomHighRight", "highRight", "lowRight");
    triangle("bottomLowLeft", "bottomLowRight", "lowRight");
    triangle("bottomLowLeft", "lowRight", "lowLeft");
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return this.projectRobotModelUvs(geometry, new THREE.Vector3(1, 1, 1), 1 / CELL_SIZE);
  }

  normalizeArenaRampAsset(root, plateThickness = ARENA_RAMP_PLATE_THICKNESS) {
    const geometry = this.createArenaRampGeometry(plateThickness);
    let primaryMesh = null;
    root.traverse((item) => {
      if (!item.isMesh) return;
      if (!primaryMesh) {
        primaryMesh = item;
        item.geometry = geometry;
      } else {
        item.visible = false;
      }
      item.position.set(0, 0, 0);
      item.rotation.set(0, 0, 0);
      item.scale.set(1, 1, 1);
      item.updateMatrix();
    });
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.updateMatrixWorld(true);
  }

  addClosedRampSupports(parent, entry, supportColor) {
    const level = Math.max(0, Number(entry?.y) || 0);
    const groundBottom = -ARENA_BASE_THICKNESS / 2;
    const highTop = ARENA_BASE_TOP + LEVEL_HEIGHT - ARENA_RAMP_PLATE_THICKNESS;
    const lowTop = ARENA_BASE_TOP - ARENA_RAMP_PLATE_THICKNESS;
    const highBottom = groundBottom - level * LEVEL_HEIGHT;
    const lowBottom = level > 0 ? groundBottom - LEVEL_HEIGHT : groundBottom;
    const highZ = -ARENA_SUPPORT_WALL_EDGE;
    const lowZ = ARENA_SUPPORT_WALL_EDGE;
    const addSideWall = (xMin, xMax) => {
      const points = [
        [xMin, highBottom, highZ], [xMax, highBottom, highZ], [xMax, lowBottom, lowZ], [xMin, lowBottom, lowZ],
        [xMin, highTop, highZ], [xMax, highTop, highZ], [xMax, lowTop, lowZ], [xMin, lowTop, lowZ]
      ];
      const triangles = [
        [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
        [0, 4, 5], [0, 5, 1], [1, 5, 6], [1, 6, 2],
        [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0]
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(triangles.flatMap((triangle) => triangle.flatMap((index) => points[index])), 3));
      geometry.computeVertexNormals();
      // The outer wall face meets the ramp plate side at the exact same
      // footprint plane. A small polygon offset gives the support a stable
      // ownership of that shared face instead of letting depth-buffer
      // precision flicker between two coplanar meshes.
      const wall = new THREE.Mesh(geometry, material(supportColor, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      wall.castShadow = false;
      wall.receiveShadow = true;
      this.makePickable(wall, entry.id, "tile");
      parent.add(wall);
    };
    addSideWall(-CELL_SIZE / 2, -ARENA_SUPPORT_WALL_EDGE);
    addSideWall(ARENA_SUPPORT_WALL_EDGE, CELL_SIZE / 2);
    const addEndWall = (z, bottom, top) => {
      const height = top - bottom;
      if (height <= 0.1) return;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(CELL_SIZE, height, ARENA_SUPPORT_WALL_THICKNESS), material(supportColor, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
      wall.position.set(0, (top + bottom) / 2, z);
      wall.castShadow = false;
      wall.receiveShadow = true;
      this.makePickable(wall, entry.id, "tile");
      parent.add(wall);
    };
    addEndWall(highZ, highBottom, highTop);
    addEndWall(lowZ, lowBottom, lowTop);
  }

  addRampSupports(parent, entry, supportColor = ROBOT_PAINT_HEX.orange, supportType = "corners") {
    if (supportType === "closed") {
      this.addClosedRampSupports(parent, entry, supportColor);
      return;
    }
    const level = Math.max(0, Number(entry?.y) || 0);
    const groundBottom = -ARENA_BASE_THICKNESS / 2;
    const highEndpointBottom = ARENA_BASE_TOP + LEVEL_HEIGHT - ARENA_RAMP_PLATE_THICKNESS;
    const lowEndpointBottom = ARENA_BASE_TOP - ARENA_RAMP_PLATE_THICKNESS;
    const rows = level > 0
      ? [
        { z: -4.85, bottomWorld: groundBottom, topWorld: level * LEVEL_HEIGHT + highEndpointBottom },
        { z: 4.85, bottomWorld: (level - 1) * LEVEL_HEIGHT + groundBottom, topWorld: level * LEVEL_HEIGHT + lowEndpointBottom }
      ]
      : [{ z: -4.85, bottomWorld: groundBottom, topWorld: highEndpointBottom }];
    rows.forEach(({ z, bottomWorld, topWorld }) => {
      const height = Math.max(0.1, topWorld - bottomWorld);
      const bottomLocal = bottomWorld - level * LEVEL_HEIGHT;
      const topLocal = topWorld - level * LEVEL_HEIGHT;
      const centerLocal = (topLocal + bottomLocal) / 2;
      [-4.85, 4.85].forEach((x) => {
        const support = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material(supportColor));
        support.position.set(x, centerLocal, z);
        support.scale.set(0.48, height, 0.48);
        support.castShadow = true;
        support.receiveShadow = true;
        this.makePickable(support, entry.id, "tile");
        parent.add(support);
      });
    });
  }

  createRescueKitVisual(parent, object, position, rotation, scale, { includeColliderSource = true } = {}) {
    const rescueKit = new THREE.Group();
    rescueKit.name = `ArenaObjectRescueKit:${object.id || "rescueKit"}`;
    rescueKit.position.set(position.x, position.y, position.z);
    rescueKit.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
    rescueKit.scale.set(scale.x, scale.y, scale.z);
    const visibleCube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material(0x3aafd9, arenaObjectMaterialOptions(object, { emissive: color(0x1a526a), emissiveIntensity: 0.45 })));
    visibleCube.name = "RescueKitVisibleCube";
    visibleCube.position.z = 0.07;
    rescueKit.add(visibleCube);
    if (includeColliderSource) {
      const colliderMesh = new THREE.Group();
      colliderMesh.name = "RescueKitSourceCollider";
      // Unity places the collider root at Z=-0.57 and its centered source mesh
      // spans Z=0..1. After the Arena's mirrored-Z conversion the hull center
      // and the nested visible cube both land at Three.js Z=+0.07.
      colliderMesh.position.z = 0.07;
      colliderMesh.visible = false;
      rescueKit.add(colliderMesh);
      if (Number(object.mass) >= 0 && object.physics !== "visualOnly") {
        this.loadRobotModel(colliderMesh, ROBOT_SOURCE_ASSETS.rescueKit, {
          maxSize: 1,
          sourceRole: "VFC-ARE-RESCUE-KIT / collider-only kit_medium_poly.fbx",
          castShadow: false,
          receiveShadow: false
        });
      }
    }
    parent.add(rescueKit);
    return rescueKit;
  }

  starterRobotWorldPose() {
    return this.spec?.simulationRuntime?.robot || this.spec?.simulatorRobot?.pose || this.simulatorRobotBasePose || null;
  }

  starterRescueKitMountFromHit(hit) {
    const robotPose = this.starterRobotWorldPose();
    if (!robotPose || !hit?.point) return null;
    const normal = hit.face?.normal?.clone();
    if (!normal) return null;
    hit.object.updateWorldMatrix(true, false);
    normal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
    const rootPosition = new THREE.Vector3(Number(robotPose.x) || 0, Number(robotPose.y) || SIMULATION_ROBOT_SURFACE_HEIGHT, Number(robotPose.z) || 0);
    const kitCenter = hit.point.clone().addScaledVector(normal, STARTER_RESCUE_KIT_HALF_EXTENT + STARTER_RESCUE_KIT_PREVIEW_GAP);
    const yaw = Number(robotPose.yaw) || 0;
    const localOffset = kitCenter.sub(rootPosition).applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
    return {
      position: { x: localOffset.x, y: localOffset.y, z: localOffset.z },
      rotation: { x: 0, y: 0, z: 0, w: 1 }
    };
  }

  defaultStarterRescueKitMount() {
    const robot = this.simulatorRobot;
    const robotPose = this.starterRobotWorldPose();
    if (!robot || !robotPose) return { position: { x: 0, y: 1.4, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } };
    robot.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    robot.traverse((item) => {
      if (!item.isMesh || !item.visible || item.userData?.debugOnly || item.userData?.pickKind) return;
      const meshBounds = new THREE.Box3().setFromObject(item);
      if (!meshBounds.isEmpty()) bounds.union(meshBounds);
    });
    const rootPositionY = Number(robotPose.y) || SIMULATION_ROBOT_SURFACE_HEIGHT;
    const topOffset = bounds.isEmpty()
      ? 1.4
      : bounds.max.y - rootPositionY + STARTER_RESCUE_KIT_HALF_EXTENT + STARTER_RESCUE_KIT_PREVIEW_GAP;
    return {
      position: { x: 0, y: topOffset, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 }
    };
  }

  styleStarterRescueKitVisual(visual, ghost = false) {
    if (!visual) return;
    const cube = visual.getObjectByName("RescueKitVisibleCube");
    if (!cube) return;
    cube.userData.starterKitStandardMaterial ||= cube.material;
    if (ghost) {
      visual.userData.shadowBoundsExcluded = true;
      let edges = cube.getObjectByName("RescueKitGhostEdges");
      if (!edges) {
        edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(cube.geometry),
          new THREE.LineBasicMaterial({ color: 0x30d5f5, depthTest: true, depthWrite: false, toneMapped: false })
        );
        edges.name = "RescueKitGhostEdges";
        edges.renderOrder = 4;
        cube.add(edges);
      }
      edges.visible = true;
      cube.userData.starterKitGhostMaterial ||= new THREE.MeshBasicMaterial({
        color: 0x3aafd9,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        toneMapped: false
      });
      cube.material = cube.userData.starterKitGhostMaterial;
    } else {
      visual.userData.shadowBoundsExcluded = false;
      const edges = cube.getObjectByName("RescueKitGhostEdges");
      if (edges) edges.visible = false;
      cube.material = cube.userData.starterKitStandardMaterial;
    }
    cube.castShadow = !ghost;
    cube.receiveShadow = !ghost;
    visual.renderOrder = ghost ? 3 : 0;
  }

  createStarterRescueKitColliderSource() {
    if (this.starterRescueKitColliderSource) return this.starterRescueKitColliderSource;
    const source = this.createRescueKitVisual(this.world, {
      id: STARTER_RESCUE_KIT_KEY,
      type: "rescueKit",
      material: "ColorCyan",
      mass: 0.2,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { ...STARTER_RESCUE_KIT_SCALE }
    }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { ...STARTER_RESCUE_KIT_SCALE });
    source.name = "StarterRescueKitColliderSource";
    source.visible = false;
    this.starterRescueKitColliderSource = source;
    return source;
  }

  updateStarterKitProjection(parent = this.arenaShadowRoot) {
    const runtimeKit = this.spec?.simulationRuntime?.objects?.find((object) => object.key === STARTER_RESCUE_KIT_KEY) || null;
    const mount = this.spec?.preflightKitPlacement || null;
    const showGhost = this.spec?.preflight === true && Boolean(mount?.position);
    const colliderRequired = this.starterRescueKitColliderRequired();
    if (!parent) return;
    if (!runtimeKit && !showGhost && !colliderRequired) {
      const existing = this.simulationObjects.get(STARTER_RESCUE_KIT_KEY);
      if (existing) {
        this.simulationObjects.delete(STARTER_RESCUE_KIT_KEY);
        existing.parent?.remove(existing);
        disposeObject(existing);
      }
      if (this.starterRescueKitGhost && this.starterRescueKitGhost !== existing) {
        this.starterRescueKitGhost.parent?.remove(this.starterRescueKitGhost);
        disposeObject(this.starterRescueKitGhost);
      }
      this.starterRescueKitGhost = null;
      return;
    }
    const createVisual = (name, { register = false } = {}) => {
      const visual = this.createRescueKitVisual(parent, {
        id: STARTER_RESCUE_KIT_KEY,
        type: "rescueKit",
        material: "ColorCyan",
        mass: 0.2,
        physics: "visualOnly",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { ...STARTER_RESCUE_KIT_SCALE }
      }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { ...STARTER_RESCUE_KIT_SCALE }, { includeColliderSource: false });
      visual.name = name;
      visual.userData.simulationObjectKey = STARTER_RESCUE_KIT_KEY;
      visual.userData.simulationBasePosition = visual.position.clone();
      visual.userData.simulationBaseRotation = visual.rotation.clone();
      if (register) this.simulationObjects.set(STARTER_RESCUE_KIT_KEY, visual);
      return visual;
    };
    let physicalVisual = this.simulationObjects.get(STARTER_RESCUE_KIT_KEY);
    if ((runtimeKit || showGhost || colliderRequired) && !physicalVisual) physicalVisual = createVisual("StarterRescueKit", { register: true });
    if (runtimeKit) {
      physicalVisual.visible = runtimeKit.visible !== false;
      this.styleStarterRescueKitVisual(physicalVisual, false);
      if (runtimeKit.position) physicalVisual.position.set(Number(runtimeKit.position.x) || 0, Number(runtimeKit.position.y) || 0, Number(runtimeKit.position.z) || 0);
      if (runtimeKit.rotation) physicalVisual.quaternion.set(runtimeKit.rotation.x, runtimeKit.rotation.y, runtimeKit.rotation.z, runtimeKit.rotation.w);
    }
    if (!showGhost) {
      if (this.starterRescueKitGhost && this.starterRescueKitGhost !== physicalVisual) this.starterRescueKitGhost.visible = false;
      if (physicalVisual && !runtimeKit) physicalVisual.visible = false;
      return;
    }
    const separateGhost = Boolean(runtimeKit);
    let ghost = this.starterRescueKitGhost;
    if (!ghost || !ghost.parent || (separateGhost && ghost === physicalVisual)) {
      ghost = separateGhost
        ? createVisual("StarterRescueKitGhost", { register: false })
        : physicalVisual || createVisual("StarterRescueKit", { register: true });
      ghost.name = separateGhost ? "StarterRescueKitGhost" : "StarterRescueKit";
      this.starterRescueKitGhost = ghost;
    }
    const robotPose = this.starterRobotWorldPose();
    if (!robotPose) {
      ghost.visible = false;
      return;
    }
    ghost.visible = true;
    this.styleStarterRescueKitVisual(ghost, true);
    const yaw = Number(robotPose.yaw) || 0;
    const offset = new THREE.Vector3(mount.position.x, mount.position.y, mount.position.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    ghost.position.set((Number(robotPose.x) || 0) + offset.x, (Number(robotPose.y) || SIMULATION_ROBOT_SURFACE_HEIGHT) + offset.y, (Number(robotPose.z) || 0) + offset.z);
    const robotRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const mountRotation = mount.rotation
      ? new THREE.Quaternion(mount.rotation.x, mount.rotation.y, mount.rotation.z, mount.rotation.w)
      : new THREE.Quaternion();
    ghost.quaternion.copy(robotRotation.multiply(mountRotation));
  }

  addArenaObject(parent, object, tileId = "") {
    if (!object || object.type === "none") return;
    // Random placeholders are editor indicators; their authored representation
    // is the Tile outline, never a magenta runtime object/plane.
    if (object.label === "Random" && object.material === "ColorMagenta") return;
    const position = arenaLocalPosition(object.position || { x: 0, y: 0.8, z: 0 });
    const rotation = arenaLocalRotation(object.rotation || { x: 0, y: 0, z: 0 });
    const scale = object.scale || { x: 1, y: 1, z: 1 };
    const isBox = object.type === "box";
    const boxPreviewDimensions = isBox ? largestBoxDimensions() : null;
    const editorObstaclePreview = this.spec?.section === "arenas" && object.type === "box" && ["scoring-00-obstacle", "scoring-01-curved-obstacle"].includes(tileId);
    const tone = arenaObjectMaterialColor(editorObstaclePreview ? "ColorRed" : object.material);
    if (object.type === "zul") {
      const zul = new THREE.Group();
      zul.name = `ArenaObjectZul:${object.id || "zul"}`;
      zul.position.set(position.x, position.y, position.z);
      zul.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
      zul.scale.set(scale.x, scale.y, scale.z);
      this.loadRobotModel(zul, ROBOT_SOURCE_ASSETS.zul, {
        maxSize: ZUL_SOURCE_HEIGHT,
        bottomAnchor: true,
        preserveMaterials: true,
        materialOptions: arenaObjectMaterialOptions(object),
        fixedMaterialSlots: {
          body: { sourceIndices: [0, 1, 3, 5], colors: ["cyan", "orange", "white", "blue"] },
          head: { sourceIndices: [0, 1], colors: ["cyan", "white"] },
          prancheta: { sourceIndices: [0, 1, 2], colors: ["gray", "white", "brown"] }
        },
        physicsShapeIdByMeshName: { body: "body", head: "head", prancheta: "clipboard" },
        sourceRole: "VFC-ARE-ZUL / zulLowPolyFIX2.fbx"
      });
      parent.add(zul);
      return zul;
    }
    if (object.type === "rescueKit") {
      return this.createRescueKitVisual(parent, object, position, rotation, scale);
    }
    let mesh = null;
    if (object.type === "plane") {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material(tone, arenaObjectMaterialOptions(object, { side: THREE.DoubleSide })));
      mesh.userData.arenaPhysicsShapeId = "plane";
    }
    if (object.type === "cuboid" || object.type === "box") mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material(tone, arenaObjectMaterialOptions(object)));
    if (object.type === "sphere" || object.type === "liveVictim" || object.type === "deadVictim") {
      const victimMaterial = object.type === "liveVictim"
        ? material(0xd4dade, arenaObjectMaterialOptions(object, { metalness: 0.58, roughness: 0.24 }))
        : object.type === "deadVictim"
          ? material(0x272d34, arenaObjectMaterialOptions(object, { metalness: 0.02, roughness: 0.88 }))
          : material(tone, arenaObjectMaterialOptions(object, { metalness: 0.35, roughness: 0.4 }));
      const victimRadius = ["liveVictim", "deadVictim"].includes(object.type) ? 1.2230963 / 2 : 0.5;
      mesh = new THREE.Mesh(new THREE.SphereGeometry(victimRadius, 20, 14), victimMaterial);
    }
    if (object.type === "cylinder") mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 24), material(tone, arenaObjectMaterialOptions(object)));
    if (["wedge", "pyramid", "corner"].includes(object.type)) {
      const workshopGeometry = {
        wedge: { asset: ROBOT_SOURCE_ASSETS.wedge, quaternion: ROBOT_WEDGE_MESH_FRAME_QUATERNION, role: "Ramp" },
        pyramid: { asset: ROBOT_SOURCE_ASSETS.pyramid, quaternion: ROBOT_SOURCE_HALF_TURN_X_QUATERNION, role: "Pyramid" },
        corner: { asset: ROBOT_SOURCE_ASSETS.corner, quaternion: ROBOT_CORNER_MESH_FRAME_QUATERNION, role: "Corner" }
      }[object.type];
      const workshopObject = new THREE.Group();
      workshopObject.name = `ArenaObject${object.type[0].toUpperCase()}${object.type.slice(1)}:${object.id || object.type}`;
      workshopObject.position.set(position.x, position.y, position.z);
      workshopObject.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
      workshopObject.scale.set(scale.x, scale.y, scale.z);
      this.loadRobotModel(workshopObject, workshopGeometry.asset, {
        maxSize: 1,
        quaternion: workshopGeometry.quaternion,
        tone,
        materialOptions: arenaObjectMaterialOptions(object),
        sourceRole: `Arena Object ${workshopGeometry.role} / Robot Workshop`
      });
      parent.add(workshopObject);
      return workshopObject;
    }
    if (object.type === "seesaw") {
      const seesaw = new THREE.Group();
      seesaw.position.set(position.x, position.y, position.z);
      seesaw.scale.set(scale.x, scale.y, scale.z);
      seesaw.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
      seesaw.userData.arenaTileBaseplateColor = parent.userData.arenaTileBaseplateColor;
      seesaw.userData.arenaSupportColor = parent.userData.arenaSupportColor;
      seesaw.userData.arenaTileImagePath = parent.userData.arenaTileImagePath;
      seesaw.userData.arenaTileNoiseTexture = parent.userData.arenaTileNoiseTexture;
      seesaw.userData.seesawPlateMass = Number(object.mass) || 0;
      seesaw.userData.seesawResetEveryAttempt = object.resetEveryAttempt !== false;
      this.addSeesaw(seesaw, object);
      parent.add(seesaw);
      return seesaw;
    }
    if (object.type === "evacuationPoint") {
      const evacuation = new THREE.Group();
      // Source EvacuationPoint transforms are authored around a 0.75-unit
      // prefab center; the procedural wedge owns the floor contact at y=0.
      // OBR keeps both random variants in the editor at one canonical
      // transform. Each variant keeps the complete source footprint; the
      // seeded materialization later keeps only the chosen role visible.
      const previewPair = object.evacuationPreviewPair === true;
      const role = object.evacuationRole;
      evacuation.userData.evacuationPreviewRole = role;
      // OBR random evacuation placeholders are authored at scale 0.25. The
      // prefab's local floor lift is scaled too, which would put this
      // procedural floor below the Tile. Compensate only for the local Y
      // anchor so every variant still rests on the same baseplate.
      const verticalScale = Math.max(0.01, Math.abs(Number(scale.y) || 1));
      evacuation.position.set(position.x, position.y - 0.75 + ARENA_SURFACE_PLANE_Y * (1 - verticalScale), position.z);
      evacuation.scale.set(scale.x, scale.y, scale.z);
      evacuation.renderOrder = previewPair ? role === "red" ? 2 : 1 : 0;
      evacuation.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
      const rescuePointAnchor = this.addEvacuationPointGeometry(evacuation, this.spec?.arenaSettings?.hard_evacuation_point === true, tone, { previewPair, opacity: arenaObjectOpacity(object) });
      if (this.spec?.section === "arenas" && rescuePointAnchor) this.addArenaEditorRescueTriggerVolume(rescuePointAnchor, object, parent.userData.arenaTileId);
      parent.add(evacuation);
      return evacuation;
    }
    if (!mesh) return;
    const horizontalPlane = object.type === "plane" && Math.abs(Math.abs(rotation.x) - 90) < 5;
    mesh.userData.simulationHorizontalPlane = horizontalPlane;
    const planeY = Math.max(ARENA_SURFACE_PLANE_Y, position.y + ARENA_BASE_TOP);
    mesh.position.set(position.x, isBox ? position.y + boxPreviewDimensions.height / 2 : horizontalPlane ? planeY : position.y, position.z);
    mesh.scale.set(isBox ? boxPreviewDimensions.width : scale.x, isBox ? boxPreviewDimensions.height : scale.y, isBox ? boxPreviewDimensions.depth : scale.z);
    mesh.rotation.set(THREE.MathUtils.degToRad(rotation.x), THREE.MathUtils.degToRad(rotation.y), THREE.MathUtils.degToRad(rotation.z));
    if (horizontalPlane) {
      // Authored physical planes must be opaque surfaces above the line image.
      // The line is rendered first at y=0.322; this plane is at least y=0.34.
      mesh.renderOrder = 3;
      const opacity = arenaObjectOpacity(object);
      mesh.material.transparent = opacity < 0.999;
      mesh.material.opacity = opacity;
      mesh.material.depthTest = true;
      mesh.material.depthWrite = opacity >= 0.999;
      if (object.material === "ColorGreen") {
        mesh.material.emissive = color(0x0a4c1e);
        mesh.material.emissiveIntensity = 0.55;
      }
    }
    mesh.castShadow = !horizontalPlane;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  addRaisedSupports(group, level, supportColor = ROBOT_PAINT_HEX.orange, supportType = "corners", tileId = "") {
    const height = level * LEVEL_HEIGHT;
    if (supportType === "closed") {
      const centerY = -height / 2 - ARENA_BASE_THICKNESS / 2;
      const walls = [
        [new THREE.BoxGeometry(CELL_SIZE, height, ARENA_SUPPORT_WALL_THICKNESS), 0, centerY, -ARENA_SUPPORT_WALL_EDGE],
        [new THREE.BoxGeometry(CELL_SIZE, height, ARENA_SUPPORT_WALL_THICKNESS), 0, centerY, ARENA_SUPPORT_WALL_EDGE],
        [new THREE.BoxGeometry(ARENA_SUPPORT_WALL_THICKNESS, height, CELL_SIZE), -ARENA_SUPPORT_WALL_EDGE, centerY, 0],
        [new THREE.BoxGeometry(ARENA_SUPPORT_WALL_THICKNESS, height, CELL_SIZE), ARENA_SUPPORT_WALL_EDGE, centerY, 0]
      ];
      walls.forEach(([geometry, x, y, z]) => {
        const wall = new THREE.Mesh(geometry, material(supportColor));
        wall.position.set(x, y, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.makePickable(wall, tileId, "tile");
        group.add(wall);
      });
      return;
    }
    [-4.85, 4.85].forEach((x) => [-4.85, 4.85].forEach((z) => {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.48, height, 0.48), material(supportColor));
      support.position.set(x, -height / 2 - ARENA_BASE_THICKNESS / 2, z);
      support.castShadow = true;
      this.makePickable(support, tileId, "tile");
      group.add(support);
    }));
  }

  addDuplicateGoalPlaceholder(group) {
    const xMaterial = material(0x6e0707, { emissive: color(0x2b0202), emissiveIntensity: 0.28, side: THREE.DoubleSide });
    const length = Math.sqrt(2) * CELL_SIZE + 0.2;
    [-1, 1].forEach((direction) => {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, length), xMaterial);
      mark.name = "DuplicateGoalX";
      mark.position.y = (group.userData.arenaTileSurfacePlaneY ?? ARENA_SURFACE_PLANE_Y) + 0.035;
      mark.rotation.y = direction * Math.PI / 4;
      mark.castShadow = false;
      mark.receiveShadow = false;
      mark.renderOrder = 4;
      group.add(mark);
    });
  }

  addMarkedIntersection(group) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), material(0x20763a, { emissive: color(0x0a4c1e), emissiveIntensity: 0.34 }));
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(0.55, group.userData.arenaTileSurfacePlaneY ?? ARENA_SURFACE_PLANE_Y, -0.55);
    mark.renderOrder = 3;
    group.add(mark);
  }

  addMarkablePin(group) {
    this.addArenaSpecialOutline(group, 0x50c878, "markable");
  }

  addCheckpointPlane(group) {
    const entry = this.spec?.arenaTiles?.find((tile) => tile.id === group.userData.arenaTileId) || { id: group.userData.arenaTileId, flags: { checkpoint: true } };
    this.addCheckpointWedges(group, entry);
  }

  addRandomMarker(group) {
    this.addArenaSpecialOutline(group, 0xc65ad4, "random");
  }

  addArenaSpecialOutline(group, outlineColor, role) {
    const rampParent = group.userData.arenaRampOutlineParent;
    const width = (group.userData.arenaTileSizeX || 1) * CELL_SIZE + 0.04;
    const depth = (group.userData.arenaTileSizeZ || 1) * CELL_SIZE + 0.04;
    const baseThickness = Number(group.userData.arenaTileBaseThickness) || ARENA_BASE_THICKNESS;
    const markerGeometry = rampParent
      ? this.createArenaRampEdgeGeometry(ARENA_SPECIAL_OUTLINE_SCALE, baseThickness)
      : new THREE.EdgesGeometry(new THREE.BoxGeometry(width, baseThickness + 0.08, depth));
    const marker = new THREE.LineSegments(markerGeometry, new THREE.LineBasicMaterial({ color: outlineColor, transparent: true, opacity: 0.96, depthTest: true, depthWrite: false }));
    if (!rampParent) marker.position.set(((group.userData.arenaTileSizeX || 1) - 1) * CELL_SIZE / 2, group.userData.arenaTileBaseCenterY ?? 0, -((group.userData.arenaTileSizeZ || 1) - 1) * CELL_SIZE / 2);
    if (!rampParent) marker.scale.set(ARENA_SPECIAL_OUTLINE_SCALE, 1, ARENA_SPECIAL_OUTLINE_SCALE);
    marker.renderOrder = 2;
    marker.userData.arenaTileId = group.userData.arenaTileId;
    marker.userData.arenaOutlineRole = role;
    (rampParent || group).add(marker);
    this.editorLayers.push(marker);
    const outlines = this.arenaOutlines.get(group.userData.arenaTileId) || [];
    outlines.push(marker);
    this.arenaOutlines.set(group.userData.arenaTileId, outlines);
  }

  addBox(parent, position, scale, tone) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(scale.x, scale.y, scale.z), material(tone));
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  }

  addCylinder(parent, position, tone) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 2.3, 24), material(tone));
    mesh.position.set(position.x, position.y, position.z);
    mesh.castShadow = true;
    parent.add(mesh);
  }

  addEvacuationPointGeometry(parent, hard = false, tone = 0x20272e, { previewPair = false, opacity = 1 } = {}) {
    // Unity's prefab is authored around this local anchor. Its L1/L2 wall
    // bounds are ~10.19×10.19, so the visible floor occupies one triangular
    // half of a 10×10 Tile instead of a small floating wedge at the origin.
    const width = CELL_SIZE;
    const depth = CELL_SIZE;
    const thickness = 0.12;
    const sourceAnchor = RESCUE_POINT_SOURCE_ANCHOR;
    // The random green/red pair is a render-only choice preview. Both
    // variants must retain the exact same source footprint, local anchor and
    // dimensions; opacity must never be solved by changing their geometry.
    const vertices = [
      -width / 2, 0, -depth / 2, width / 2, 0, -depth / 2, -width / 2, 0, depth / 2,
      -width / 2, thickness, -depth / 2, width / 2, thickness, -depth / 2, -width / 2, thickness, depth / 2
    ];
    const indices = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const effectiveOpacity = Math.min(1, Math.max(0, Number.isFinite(Number(opacity)) ? Number(opacity) : 1));
    const pairMaterial = { side: THREE.DoubleSide, transparent: effectiveOpacity < 0.999, opacity: effectiveOpacity, depthWrite: effectiveOpacity >= 0.999 };
    const anchor = new THREE.Group();
    anchor.name = "RescuePointSourceAnchor";
    anchor.position.set(sourceAnchor.x, ARENA_SURFACE_PLANE_Y, sourceAnchor.z);
    parent.add(anchor);
    const wedge = new THREE.Mesh(geometry, material(tone, pairMaterial));
    wedge.renderOrder = parent.renderOrder;
    wedge.position.set(0, 0, 0);
    wedge.userData.arenaPhysicsShapeId = "floor";
    wedge.castShadow = false;
    wedge.receiveShadow = true;
    anchor.add(wedge);
    const wallHeight = hard ? EVACUATION_L2_WALL_HEIGHT : EVACUATION_L1_WALL_HEIGHT;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.25703, wallHeight, 14.16), material(tone, pairMaterial));
    wall.name = hard ? "EvacuationPointL2Wall" : "EvacuationPointL1Wall";
    wall.position.set(0, wallHeight / 2, 0);
    wall.rotation.y = -Math.PI / 4;
    wall.userData.arenaPhysicsShapeId = "wall";
    wall.userData.arenaPhysicsShapeKind = "box";
    wall.renderOrder = parent.renderOrder;
    wall.castShadow = true;
    wall.receiveShadow = true;
    anchor.add(wall);
    return anchor;
  }

  addSeesaw(parent, object = {}) {
    const tileColor = parent.userData.arenaTileBaseplateColor || 0xf5f4ee;
    const supportColor = parent.userData.arenaSupportColor || ROBOT_PAINT_HEX.orange;
    const tileImagePath = parent.userData.arenaTileImagePath;
    const tileNoiseTexture = parent.userData.arenaTileNoiseTexture;
    const plateThickness = 0.12;
    const objectOpacity = arenaObjectOpacity(object);
    const objectMaterialOptions = { transparent: objectOpacity < 0.999, opacity: objectOpacity, depthWrite: objectOpacity >= 0.999 };

    // The seesaw is only the slanted movable source plate plus its fulcrum. The
    // containing flat Arena Tile already supplies the floor/baseplate; adding a
    // second lower slab creates a false extra surface and hides the obstacle.
    const seesawPivot = new THREE.Group();
    seesawPivot.name = "SeesawPivot";
    seesawPivot.position.y = SEESAW_PROFILE.pivotY;
    const platePivot = new THREE.Group();
    platePivot.name = "SeesawMovingPlate";
    platePivot.position.y = SEESAW_PROFILE.plateOffsetY;
    platePivot.rotation.x = ARENA_RAMP_SURFACE_ANGLE;
    platePivot.userData.seesawPlateMass = Number(object.mass) || 0;
    platePivot.userData.resetEveryAttempt = object.resetEveryAttempt !== false;
    const plateMaterial = material(tileColor, { side: THREE.DoubleSide, ...objectMaterialOptions, ...(tileNoiseTexture ? { map: tileNoiseTexture } : {}) });
    const plateGeometry = this.scaleRobotPrimitiveUvs(new THREE.BoxGeometry(9.7, plateThickness, 10), 1 / CELL_SIZE);
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    plate.name = "SeesawPlate";
    plate.castShadow = true;
    plate.receiveShadow = true;
    plate.userData.seesawPlateMass = platePivot.userData.seesawPlateMass;
    plate.userData.resetEveryAttempt = platePivot.userData.resetEveryAttempt;
    platePivot.add(plate);
    if (tileImagePath) {
      const overlay = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_TILE_IMAGE_SIZE, ARENA_TILE_IMAGE_SIZE), this.arenaSurfaceOverlayMaterial(this.texture(tileImagePath), { opacity: objectOpacity, depthWrite: objectOpacity >= 0.999, side: THREE.DoubleSide }));
      overlay.name = "SeesawPlateImage";
      overlay.rotation.x = -Math.PI / 2;
      overlay.position.y = plateThickness / 2 + 0.006;
      overlay.renderOrder = 4;
      platePivot.add(overlay);
    }
    seesawPivot.add(platePivot);
    parent.add(seesawPivot);
    parent.userData.seesawMovingPivot = seesawPivot;

    const support = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material(supportColor, objectMaterialOptions));
    support.name = "SeesawSourceSupport";
    support.userData.arenaPhysicsShapeId = "support";
    support.userData.arenaPhysicsShapeKind = "box";
    support.position.y = SEESAW_PROFILE.supportCenterY;
    support.scale.set(1, SEESAW_PROFILE.supportHalfHeight * 2, SEESAW_PROFILE.supportHalfDepth * 2);
    support.castShadow = true;
    support.receiveShadow = true;
    parent.add(support);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 24), material(supportColor, objectMaterialOptions));
    axle.name = "SeesawAxle";
    axle.userData.arenaPhysicsShapeId = "axle";
    axle.userData.arenaPhysicsShapeKind = "capsule";
    axle.position.y = SEESAW_PROFILE.axleY;
    axle.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    axle.scale.set(0.21678671, 0.4999938, 0.2038904);
    axle.castShadow = true;
    axle.receiveShadow = true;
    parent.add(axle);
  }

  addRescueArea(parent) {
    const rescue = new THREE.Group();
    rescue.position.set(sourceCoordinate(4), 0.36, sourceCoordinate(0));
    const wallMaterial = material(0xf5f4ee);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3, 28.8), wallMaterial);
    backWall.position.set(9.42, 1.5, 0);
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(19.6, 3, 0.36), wallMaterial);
    sideWall.position.set(0, 1.5, 9.42);
    rescue.add(backWall, sideWall);
    this.addRescueKit(rescue, new THREE.Vector3(-4.2, 0.9, -3));
    this.addVictim(rescue, new THREE.Vector3(1.5, 0.9, -1.6), 0xc6d2d9);
    this.addVictim(rescue, new THREE.Vector3(3.7, 0.9, 1.9), 0x303842);
    this.addEvacuationMesh(rescue);
    rescue.traverse((item) => { if (item.isMesh) { item.castShadow = true; item.receiveShadow = true; } });
    parent.add(rescue);
  }

  addRescueKit(parent, position) {
    const kit = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), material(0x3aafd9, { emissive: color(0x1a526a), emissiveIntensity: 0.45 }));
    kit.position.copy(position);
    parent.add(kit);
  }

  addVictim(parent, position, tone) {
    const victim = new THREE.Mesh(new THREE.SphereGeometry(0.82, 20, 14), material(tone, { metalness: 0.46, roughness: 0.34 }));
    victim.position.copy(position);
    parent.add(victim);
  }

  addEvacuationMesh(parent) {
    const placeholder = new THREE.Group();
    placeholder.position.set(-2.5, 0.05, 3.6);
    parent.add(placeholder);
    const assetPromise = this.trackAssetPromise(new Promise((resolve, reject) => this.fbxLoader.load(RESCUE_AREA, resolve, undefined, reject)));
    assetPromise.then((sourceMesh) => {
      sourceMesh.traverse((item) => {
        if (!item.isMesh) return;
        item.material = material(0x20272e, { roughness: 0.6, metalness: 0.16 });
        item.castShadow = true;
        item.receiveShadow = true;
      });
      const bounds = new THREE.Box3().setFromObject(sourceMesh);
      const size = bounds.getSize(new THREE.Vector3());
      const widest = Math.max(size.x, size.z, 0.001);
      sourceMesh.scale.setScalar(8.2 / widest);
      sourceMesh.rotation.y = Math.PI / 4;
      placeholder.add(sourceMesh);
      this.requestRender();
    }).catch(() => {
      placeholder.userData.sourceAssetMissing = true;
      document.dispatchEvent(new CustomEvent("sbotics-three-asset-error", { detail: { path: RESCUE_AREA } }));
    });
  }

  addSimulatorRobot(parent, robotSpec = {}) {
    if (!robotSpec?.id || robotSpec.spawnAvailable === false || !Array.isArray(robotSpec.parts) || !robotSpec.parts.length) return null;
    const robot = new THREE.Group();
    robot.name = "SimulatorRobot";
    const orientations = robotSpec.orientations || {};
    const rotations = robotSpec.rotations || {};
    this.robotPartsForRendering = robotSpec.parts.map((part) => {
      const id = part.instanceId || part.id;
      return { ...part, orientation: orientations[id] || part.orientation || { up: "+Y", forward: "+Z" }, rotation: rotations[id] || part.rotation || {} };
    });
    const pose = robotSpec.pose || { x: 0, y: SIMULATION_ROBOT_SURFACE_HEIGHT, z: 0, yaw: 0 };
    robot.position.set(Number(pose.x) || 0, Number(pose.y) || SIMULATION_ROBOT_SURFACE_HEIGHT, Number(pose.z) || 0);
    robot.rotation.y = Number(pose.yaw) || 0;
    robot.scale.set(ROBOT_VISUAL_MIRROR_X * SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SCALE);
    this.simulatorRobotBasePose = { x: robot.position.x, y: robot.position.y, z: robot.position.z, yaw: robot.rotation.y };
    this.robotPartsForRendering.forEach((part) => {
      const typeId = part.typeId || part.id;
      if (!ROBOT_PART_IDS.includes(typeId)) return;
      this.addRobotPart(robot, typeId, part.position || { x: 0, y: 0, z: 0 }, `sim-${part.instanceId || typeId}`, { ...part, sourceInstanceId: part.instanceId || typeId });
    });
    parent.add(robot);
    this.simulatorRobot = robot;
  }

  buildRobotColliderBlueprint(robotDocument = {}) {
    const parts = Array.isArray(robotDocument.parts) ? robotDocument.parts : [];
    this.robotColliderBlueprint = null;
    if (!parts.length) return { ready: false, reason: "missing" };
    const compiledParts = {};
    for (const part of parts) {
      const id = part.instanceId || part.id;
      const typeId = part.typeId || part.id;
      const component = this.robotComponents.get(`sim-${id}`);
      const sourceShapes = ROBOT_COLLIDER_SPECS[typeId];
      if (!sourceShapes?.length) return { ready: false, reason: "missing", partId: id, typeId, shapeId: "source-collider" };
      const meshShapes = sourceShapes.filter((shape) => shape.kind === "mesh");
      const requiredMeshIds = new Set(meshShapes.map((shape) => shape.id));
      const colliderJobs = (component?.userData.robotModelJobs || []).filter((job) => job.options?.physicsRole !== "visual");
      if (meshShapes.length && !component) return { ready: false, reason: "missing", partId: id, typeId, shapeId: meshShapes[0].id };
      const pendingColliderJob = colliderJobs.find((job) => job.status === "loading");
      if (meshShapes.length && pendingColliderJob) return { ready: false, reason: "loading", partId: id };
      const failedColliderJob = colliderJobs.find((job) => job.status === "failed");
      if (meshShapes.length && failedColliderJob) return { ready: false, reason: "missing", partId: id, typeId, assetPath: failedColliderJob.path, shapeId: meshShapes[0].id };

      const grouped = new Map();
      if (meshShapes.length) {
        component.updateWorldMatrix(true, true);
        const inverseComponent = component.matrixWorld.clone().invert();
        component.traverse((item) => {
          if (!isRobotColliderMesh(item, component)) return;
          const shapeId = String(item.userData.physicsShapeId || "body");
          if (!requiredMeshIds.has(shapeId)) return;
          const position = item.geometry.getAttribute("position");
          if (!position || position.count < 4) return;
          item.updateWorldMatrix(true, false);
          const relative = new THREE.Matrix4().multiplyMatrices(inverseComponent, item.matrixWorld);
          if (!grouped.has(shapeId)) grouped.set(shapeId, { points: [], seen: new Set() });
          const shape = grouped.get(shapeId);
          const point = new THREE.Vector3();
          for (let index = 0; index < position.count; index += 1) {
            point.fromBufferAttribute(position, index).applyMatrix4(relative);
            if (![point.x, point.y, point.z].every(Number.isFinite)) continue;
            const key = `${Math.round(point.x * 1e5)},${Math.round(point.y * 1e5)},${Math.round(point.z * 1e5)}`;
            if (shape.seen.has(key)) continue;
            shape.seen.add(key);
            shape.points.push([point.x, point.y, point.z]);
          }
        });
      }

      const shapes = [];
      for (const sourceShape of sourceShapes) {
        if (sourceShape.kind === "mesh") {
          const meshShape = grouped.get(sourceShape.id);
          if (!meshShape || meshShape.points.length < 4) return { ready: false, reason: "missing", partId: id, typeId, shapeId: sourceShape.id };
          const minimum = [Infinity, Infinity, Infinity];
          const maximum = [-Infinity, -Infinity, -Infinity];
          meshShape.points.forEach((point) => point.forEach((value, axis) => {
            minimum[axis] = Math.min(minimum[axis], value);
            maximum[axis] = Math.max(maximum[axis], value);
          }));
          const size = maximum.map((value, axis) => value - minimum[axis]);
          shapes.push({ ...sourceShape, points: meshShape.points, massWeight: Math.max(1e-6, size[0] * size[1] * size[2]) });
          continue;
        }
        const points = robotPrimitiveColliderPoints(sourceShape).map((point) => point.map((value) => value * 6));
        shapes.push({ ...sourceShape, points, massWeight: robotPrimitiveColliderVolume(sourceShape) * 216 });
      }
      const sensorRayFrame = typeId === "wedgeUltrasonicSensor"
        ? wedgeUltrasonicRayFrame(shapes.find((shape) => shape.id === "mesh")?.points)
        : null;
      if (typeId === "wedgeUltrasonicSensor" && !sensorRayFrame) return { ready: false, reason: "missing", partId: id, typeId, shapeId: "sensor-ray-frame" };
      const hasSolid = shapes.some((shape) => !shape.sensor);
      if (!hasSolid) return { ready: false, reason: "missing", partId: id, typeId, shapeId: "solid" };
      compiledParts[id] = {
        typeId,
        shapes,
        ...(sensorRayFrame ? { sensorRayFrame } : {}),
        jointFrame: ["hinge", "servo"].includes(typeId)
          ? { anchor: { x: 0, y: 0, z: 0 }, axis: { x: 0, y: 1, z: 0 } }
          : null
      };
    }
    const blueprint = { ready: true, parts: compiledParts };
    this.robotColliderBlueprint = blueprint;
    return blueprint;
  }

  buildArenaObjectColliderBlueprint(tiles = this.spec?.arenaTiles || []) {
    const signature = JSON.stringify(tiles);
    const baseBlueprint = this.arenaObjectColliderBlueprintCache?.signature === signature
      ? this.arenaObjectColliderBlueprintCache.blueprint
      : buildArenaObjectColliderBlueprint(tiles, this.simulationObjects);
    if (baseBlueprint.ready && this.arenaObjectColliderBlueprintCache?.signature !== signature) this.arenaObjectColliderBlueprintCache = { signature, blueprint: baseBlueprint };
    if (!baseBlueprint.ready || !this.starterRescueKitColliderRequired()) return baseBlueprint;
    let starterKitCollider = this.starterKitColliderBlueprintCache;
    if (!starterKitCollider) {
      const visual = this.createStarterRescueKitColliderSource();
      const syntheticTileId = "starter-rescue-kit-source";
      const syntheticObjectId = STARTER_RESCUE_KIT_KEY;
      const syntheticKey = `${syntheticTileId}:${syntheticObjectId}`;
      const kitBlueprint = buildArenaObjectColliderBlueprint(
        [{ id: syntheticTileId, objects: [{ id: syntheticObjectId, type: "rescueKit", mass: 0.2 }] }],
        new Map([[syntheticKey, visual]])
      );
      if (!kitBlueprint.ready) return kitBlueprint;
      starterKitCollider = kitBlueprint.objects[syntheticKey] || null;
      if (!starterKitCollider) return { ready: false, reason: "missing", objectKey: STARTER_RESCUE_KIT_KEY, typeId: "rescueKit", shapeId: "source-mesh" };
      this.starterKitColliderBlueprintCache = starterKitCollider;
    }
    return { ...baseBlueprint, objects: { ...baseBlueprint.objects, [STARTER_RESCUE_KIT_KEY]: starterKitCollider } };
  }

  starterRescueKitColliderRequired() {
    return this.spec?.starterKitColliderRequired === true
      || this.spec?.simulationRuntime?.objects?.some((object) => object.key === STARTER_RESCUE_KIT_KEY) === true;
  }

  async waitForArenaObjectColliderAssets(tiles = this.spec?.arenaTiles || [], { timeoutMs = ROBOT_MODEL_READY_TIMEOUT_MS } = {}) {
    const jobs = [];
    for (const tile of tiles) {
      for (const [index, object] of (tile.objects || []).entries()) {
        if (!object || Number(object.mass) < 0 || object.physics === "visualOnly") continue;
        if (!["rescueKit", "wedge", "pyramid", "corner", "zul"].includes(object.type)) continue;
        const key = `${tile.id}:${object.id || `object-${index + 1}`}`;
        const visual = this.simulationObjects.get(key);
        if (!visual) continue;
        visual.traverse((item) => jobs.push(...(item.userData.robotModelJobs || [])));
      }
    }
    if (this.starterRescueKitColliderRequired()) {
      const visual = this.starterKitColliderBlueprintCache ? null : this.createStarterRescueKitColliderSource();
      visual?.traverse((item) => jobs.push(...(item.userData.robotModelJobs || [])));
    }
    const outcome = await waitForRobotModelJobs(jobs, timeoutMs);
    if (outcome === "timeout") return { ready: false, reason: "timeout" };
    return this.buildArenaObjectColliderBlueprint(tiles);
  }

  retryFailedArenaObjectModelLoads(tiles = this.spec?.arenaTiles || []) {
    let retryCount = 0;
    for (const tile of tiles) {
      for (const [index, object] of (tile.objects || []).entries()) {
        if (!object || Number(object.mass) < 0 || object.physics === "visualOnly") continue;
        if (!["rescueKit", "wedge", "pyramid", "corner", "zul"].includes(object.type)) continue;
        const key = `${tile.id}:${object.id || `object-${index + 1}`}`;
        const visual = this.simulationObjects.get(key);
        if (!visual) continue;
        visual.traverse((item) => {
          const jobs = item.userData.robotModelJobs || [];
          const failed = jobs.filter((job) => job.status === "failed");
          if (!failed.length) return;
          item.userData.robotModelJobs = jobs.filter((job) => job.status !== "failed");
          item.userData.sourceAssetMissing = null;
          failed.forEach((job) => {
            this.loadRobotModel(item, job.path, job.options);
            retryCount += 1;
          });
        });
      }
    }
    if (this.starterRescueKitColliderRequired()) {
      const visual = this.starterRescueKitColliderSource;
      if (visual) visual.traverse((item) => {
        const jobs = item.userData.robotModelJobs || [];
        const failed = jobs.filter((job) => job.status === "failed");
        if (!failed.length) return;
        item.userData.robotModelJobs = jobs.filter((job) => job.status !== "failed");
        item.userData.sourceAssetMissing = null;
        failed.forEach((job) => {
          this.loadRobotModel(item, job.path, job.options);
          retryCount += 1;
        });
      });
    }
    return retryCount;
  }

  retryFailedRobotModelLoads(robotDocument = {}) {
    let retryCount = 0;
    for (const part of Array.isArray(robotDocument.parts) ? robotDocument.parts : []) {
      const id = part.instanceId || part.id;
      const component = this.robotComponents.get(`sim-${id}`);
      if (!component) continue;
      const jobs = component.userData.robotModelJobs || [];
      const failed = jobs.filter((job) => job.status === "failed");
      if (!failed.length) continue;
      component.userData.robotModelJobs = jobs.filter((job) => job.status !== "failed");
      component.userData.sourceAssetMissing = null;
      failed.forEach((job) => {
        this.loadRobotModel(component, job.path, job.options);
        retryCount += 1;
      });
    }
    return retryCount;
  }

  async waitForRobotColliderAssets(robotDocument = {}, { timeoutMs = ROBOT_MODEL_READY_TIMEOUT_MS } = {}) {
    const parts = Array.isArray(robotDocument.parts) ? robotDocument.parts : [];
    const jobs = parts.filter((part) => robotColliderNeedsMesh(part.typeId || part.id)).flatMap((part) => {
      const id = part.instanceId || part.id;
      return (this.robotComponents.get(`sim-${id}`)?.userData.robotModelJobs || [])
        .filter((job) => job.options?.physicsRole !== "visual");
    });
    const outcome = await waitForRobotModelJobs(jobs, timeoutMs);
    // A slow load is still in progress, not a failed asset. Keep the
    // existing jobs alive so a later completion can start physics.
    if (outcome === "timeout") return { ready: false, reason: "timeout" };
    const blueprint = this.buildRobotColliderBlueprint(robotDocument);
    return { ...blueprint, partId: blueprint.partId || null };
  }

  applyRobotPhysicsProjection(runtime = this.spec?.simulationRuntime) {
    const poses = runtime?.robotGroupPoses;
    const groups = runtime?.robotRuntime?.groups;
    if (!this.simulatorRobot || !poses || !Array.isArray(groups) || !groups.length) {
      this.resetRobotPhysicsProjection(runtime);
      return false;
    }
    const partsById = new Map(this.robotPartsForRendering.map((part) => [part.instanceId || part.id, part]));
    if (groups.some((group) => !poses[group.id] || !partsById.has(group.rootPartId || (group.id === "main" ? "controller" : group.id)))) return false;
    const rootScale = new THREE.Vector3(ROBOT_VISUAL_MIRROR_X * SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SCALE);
    this.simulatorRobot.position.set(0, 0, 0);
    this.simulatorRobot.quaternion.identity();
    this.simulatorRobot.scale.set(1, 1, 1);
    this.simulatorRobot.updateMatrix();
    for (const group of groups) {
      const pose = poses[group.id];
      const rootPart = partsById.get(group.rootPartId || (group.id === "main" ? "controller" : group.id));
      const position = rootPart.position || rootPart.gridPosition || { x: 0, y: 0, z: 0 };
      const bodyMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(pose.translation.x, pose.translation.y, pose.translation.z),
        new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w).normalize(),
        rootScale
      );
      for (const partId of group.partIds) {
        const part = partsById.get(partId);
        const component = this.robotComponents.get(`sim-${partId}`);
        if (!part || !component) continue;
        const partPosition = part.position || part.gridPosition || { x: 0, y: 0, z: 0 };
        const partMatrix = new THREE.Matrix4().compose(
          new THREE.Vector3(
            (Number(partPosition.x) - Number(position.x)) * ROBOT_CELL_SIZE,
            (Number(partPosition.y) - Number(position.y)) * ROBOT_CELL_SIZE,
            (Number(partPosition.z) - Number(position.z)) * ROBOT_CELL_SIZE
          ),
          this.robotPartOrientationQuaternion(component),
          new THREE.Vector3(1, 1, 1)
        );
        component.matrixAutoUpdate = false;
        component.matrix.multiplyMatrices(bodyMatrix, partMatrix);
        component.matrixWorldNeedsUpdate = true;
        component.userData.physicsGroupId = group.id;
      }
    }
    this.robotPhysicsProjected = true;
    this.simulatorRobot.updateMatrixWorld(true);
    return true;
  }

  resetRobotPhysicsProjection(runtime = this.spec?.simulationRuntime) {
    if (!this.simulatorRobot || !this.robotPhysicsProjected) return;
    const pose = runtime?.robot || this.simulatorRobotBasePose || { x: 0, y: SIMULATION_ROBOT_SURFACE_HEIGHT, z: 0, yaw: 0 };
    this.simulatorRobot.position.set(Number(pose.x) || 0, Number(pose.y) || SIMULATION_ROBOT_SURFACE_HEIGHT, Number(pose.z) || 0);
    this.simulatorRobot.rotation.set(0, Number(pose.yaw) || 0, 0);
    this.simulatorRobot.scale.set(ROBOT_VISUAL_MIRROR_X * SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SCALE, SIMULATION_ROBOT_SCALE);
    this.robotComponents.forEach((component) => {
      component.matrixAutoUpdate = true;
      const position = component.userData.gridPosition || { x: 0, y: 0, z: 0 };
      component.position.set(position.x * ROBOT_CELL_SIZE, position.y * ROBOT_CELL_SIZE, position.z * ROBOT_CELL_SIZE);
      component.quaternion.copy(this.robotPartOrientationQuaternion(component));
      delete component.userData.physicsGroupId;
    });
    this.robotPhysicsProjected = false;
    this.simulatorRobot.updateMatrixWorld(true);
  }

  makePickable(mesh, id, kind) {
    mesh.userData.pickId = id;
    mesh.userData.pickKind = kind;
    let current = mesh;
    while (current) {
      if (current.userData?.arenaPlacementGhost) return;
      current = current.parent;
    }
    if (!this.pickTargets.has(id)) this.pickTargets.set(id, mesh);
    this.pickables.push(mesh);
  }

  applyRobotPaint(group, instanceId = group.userData.sourceInstanceId || group.userData.instanceId) {
    const colorValue = this.robotPartColor(group.userData.sourceTypeId, instanceId);
    const displayColor = colorValue === ROBOT_PAINT_HEX.black ? ROBOT_BLACK_SURFACE_HEX : colorValue;
    group.userData.paintableMeshes?.forEach((mesh) => mesh.material?.color?.set(displayColor));
  }

  applyState() {
    if (!this.spec) return;
    this.updateArenaLighting(this.spec.arenaSettings);
    this.updateArenaPlacementGhost();
    const editorLayersVisible = this.spec.section === "arenas" || (!this.spec.competitionActive && (this.spec.diagnostics || this.spec.preflight));
    this.editorLayers.forEach((entry) => { entry.visible = editorLayersVisible; });
    if (this.mode === "arena" && this.scope === "simulation") {
      const pose = this.spec.simulationRuntime?.robot || this.spec.simulatorRobot?.pose;
      const physicsProjected = this.applyRobotPhysicsProjection(this.spec.simulationRuntime);
      if (!physicsProjected && this.simulatorRobot && pose) {
        this.resetRobotPhysicsProjection(this.spec.simulationRuntime);
        this.simulatorRobot.position.set(Number(pose.x) || 0, Number(pose.y) || SIMULATION_ROBOT_SURFACE_HEIGHT, Number(pose.z) || 0);
        this.simulatorRobot.rotation.y = Number(pose.yaw) || 0;
      }
      this.updateDiagnosticsRobotColliderOverlay();
      this.updateDiagnosticsArenaColliderOverlay();
      const objectStates = new Map((this.spec.simulationRuntime?.objects || []).map((object) => [object.key, object]));
      this.simulationObjects.forEach((visual, key) => {
        if (key === STARTER_RESCUE_KIT_KEY) return;
        const objectState = objectStates.get(key);
        if (!objectState) return;
        visual.visible = objectState.visible !== false;
        if (objectState.type === "box" && objectState.boxRuntime) {
          visual.scale.set(
            Number(objectState.boxRuntime.width) || visual.scale.x,
            Number(objectState.boxRuntime.height) || visual.scale.y,
            Number(objectState.boxRuntime.depth) || visual.scale.z
          );
          const boxMaterial = Array.isArray(visual.material) ? visual.material[0] : visual.material;
          if (boxMaterial?.color) boxMaterial.color.set(arenaObjectMaterialColor(objectState.boxRuntime.material));
        }
        // Static Arena content is already authored in its correct Tile-local
        // transform. Runtime projection must not reinterpret walls, planes,
        // rocks or other static meshes as world-position updates merely
        // because a Robot was selected and the runtime snapshot appeared.
        const synchronizesPosition = objectState.type === "box" || objectState.dynamic === true || ["liveVictim", "deadVictim", "rescueKit", "seesaw"].includes(objectState.type);
        if (!synchronizesPosition) return;
        const basePosition = visual.userData.simulationBasePosition;
        if (objectState.position && visual.parent) {
          // Tile/object parents carry the Arena cell translation, rotation and
          // (for ramps) the surface-aligned transform. When the Simulator
          // rebuilds the scene after loading a Robot, Three.js may not have
          // rendered those parents yet. Refresh the world matrices before
          // converting the runtime world position back to the object's local
          // frame; otherwise walls, rocks and rescue objects inherit stale
          // identity matrices and appear to explode across the Arena.
          visual.parent.updateWorldMatrix(true, false);
          const worldPosition = new THREE.Vector3(Number(objectState.position.x) || 0, Number(objectState.position.y) || 0, Number(objectState.position.z) || 0);
          if (visual.userData.simulationHorizontalPlane && basePosition) {
            // Runtime object positions use the authored local plane origin;
            // keep the renderer's physical surface lift when syncing a
            // horizontal Finish Lane after the robot is loaded.
            worldPosition.y = visual.parent.localToWorld(new THREE.Vector3(0, basePosition.y, 0)).y;
          }
          visual.parent.worldToLocal(worldPosition);
          visual.position.copy(worldPosition);
        } else if (basePosition) {
          visual.position.y = basePosition.y + (Number(objectState.offsetY) || 0);
        }
        const baseRotation = visual.userData.simulationBaseRotation;
        if (objectState.dynamic === true && objectState.rotation && visual.parent) {
          const parentRotation = visual.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
          visual.quaternion.copy(parentRotation.multiply(new THREE.Quaternion(objectState.rotation.x, objectState.rotation.y, objectState.rotation.z, objectState.rotation.w)));
        } else if (baseRotation) visual.rotation.copy(baseRotation);
        if (objectState.type === "seesaw") {
          const movingPivot = visual.userData.seesawMovingPivot;
          if (movingPivot) {
            const sourceAngle = Number.isFinite(Number(objectState.seesawAngle)) ? Number(objectState.seesawAngle) : SEESAW_PROFILE.initialAngleRadians;
            movingPivot.rotation.x = sourceAngle - SEESAW_PROFILE.initialAngleRadians;
          }
        }
      });
      this.updateStarterKitProjection();
    }
    if (this.mode === "workshop" || this.scope === "simulation") {
      this.robotComponents.forEach((component, instanceId) => {
        const sourceInstanceId = component.userData.sourceInstanceId || instanceId;
        if (!(this.scope === "simulation" && this.robotPhysicsProjected)) {
          component.matrixAutoUpdate = true;
          component.quaternion.copy(this.robotPartOrientationQuaternion(component));
        }
        // Simulator joint motion is projected from the moving group's Rapier
        // rigid-body pose; the renderer never rotates a motor mesh by itself.
        this.applyRobotPaint(component, sourceInstanceId);
        this.applyLightVisual(component);
        this.applyTouchVisual(component);
      });
      this.updateWorkshopLightModels();
      this.updateWorkshopLightGlass();
  }
    const showGroups = this.mode === "workshop" && this.spec.robotGroupsVisible === true;
    this.setGroupHighlights(showGroups ? this.spec.robotGroupAssignments : {}, showGroups ? this.spec.robotGroupColors : {});
    const selected = this.spec.section === "robots" ? this.spec.robotSelection : this.spec.simulationSelection || this.spec.threeSelection;
    const highlight = this.mode === "workshop"
      ? this.spec.robotMode === "inspect" && this.spec.robotSelectionHighlight !== false
      : this.scope === "simulation" ? this.spec.simulationSelectionHighlight === true : true;
    const diagnosticsSelections = this.scope === "simulation"
      && this.spec?.diagnostics === true
      && this.spec?.simulationSelectionHighlight === true
      && this.spec?.competitionActive !== true
      && Array.isArray(this.spec?.simulationDiagnosticsComponents)
      ? this.spec.simulationDiagnosticsComponents
      : [];
    if (diagnosticsSelections.length) {
      this.setSelection("", false);
      this.updateDiagnosticsSelectionOutlines();
    } else {
      this.clearDiagnosticsSelectionOutlines();
      this.setSelection(selected || "", highlight);
    }
    if (this.scope === "simulation") {
      this.updateRobotPenTrails();
      this.updateDiagnosticsSensorOverlays();
    }
  }

  removeHelper(helper) {
    if (!helper) return;
    this.world.remove(helper);
    helper.geometry?.dispose?.();
    if (Array.isArray(helper.material)) helper.material.forEach((entry) => entry.dispose?.());
    else helper.material?.dispose?.();
  }

  clearDiagnosticsSelectionOutlines() {
    this.diagnosticsSelectionOutlines.forEach((outline) => {
      outline.parent?.remove(outline);
      disposeObject(outline);
    });
    this.diagnosticsSelectionOutlines.clear();
  }

  updateDiagnosticsSelectionOutlines() {
    const selectedIds = [...new Set(this.spec?.simulationDiagnosticsComponents || [])];
    const selected = new Set(selectedIds);
    this.diagnosticsSelectionOutlines.forEach((outline, componentId) => {
      if (selected.has(componentId)) return;
      outline.parent?.remove(outline);
      disposeObject(outline);
      this.diagnosticsSelectionOutlines.delete(componentId);
    });
    const colors = this.spec?.simulationDiagnosticsSelectionColors || {};
    selectedIds.forEach((componentId) => {
      const component = this.robotComponents.get(`sim-${componentId}`);
      const slot = component?.children.find((child) => child.userData?.sourceRole === "logical-selection-slot");
      if (!slot?.geometry) return;
      let outline = this.diagnosticsSelectionOutlines.get(componentId);
      if (outline && outline.parent !== slot) {
        outline.parent?.remove(outline);
        disposeObject(outline);
        this.diagnosticsSelectionOutlines.delete(componentId);
        outline = null;
      }
      if (!outline) {
        outline = new THREE.LineSegments(new THREE.EdgesGeometry(slot.geometry), new THREE.LineBasicMaterial({
          color: 0x2fa9c2,
          transparent: true,
          opacity: 0.98,
          depthTest: true,
          depthWrite: false,
          toneMapped: false
        }));
        outline.name = `DiagnosticsSelectionOutline:${componentId}`;
        outline.userData.debugOnly = true;
        outline.userData.diagnosticsComponentId = componentId;
        outline.frustumCulled = false;
        outline.renderOrder = 20;
        outline.scale.setScalar(1.015);
        slot.add(outline);
        this.diagnosticsSelectionOutlines.set(componentId, outline);
      }
      outline.material.color.set(colors[componentId] || 0x2fa9c2);
    });
  }

  clearGroupHighlights() {
    this.groupOutlines.forEach((outline) => this.removeHelper(outline));
    this.groupOutlines = [];
  }

  setGroupHighlights(assignments = {}, colors = {}) {
    const entries = Object.entries(assignments).sort(([first], [second]) => first.localeCompare(second));
    const signature = JSON.stringify([entries, colors]);
    if (this.groupHighlightKey === signature) return;
    this.clearGroupHighlights();
    this.groupHighlightKey = signature;
    entries.forEach(([instanceId, groupId]) => {
      const target = this.robotComponents.get(instanceId);
      if (!target) return;
      target.updateWorldMatrix(true, false);
      const outline = new THREE.Box3Helper(
        new THREE.Box3().setFromCenterAndSize(target.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(ROBOT_CELL_SIZE + 0.22, ROBOT_CELL_SIZE + 0.22, ROBOT_CELL_SIZE + 0.22)),
        colors[groupId] || "#2fa9c2"
      );
      outline.material.transparent = true;
      outline.material.opacity = 0.82;
      outline.material.linewidth = 2.5;
      outline.material.depthTest = true;
      outline.material.depthWrite = false;
      outline.renderOrder = 1;
      this.groupOutlines.push(outline);
      this.world.add(outline);
    });
  }

  createInnerSelectionOutline(center, size = ROBOT_CELL_SIZE, inset = 0.45) {
    const half = size / 2 + 0.02;
    const inner = Math.max(0.04, half - inset);
    const vertices = [];
    const addLoop = (points) => {
      for (let index = 0; index < points.length; index += 1) {
        const first = points[index];
        const second = points[(index + 1) % points.length];
        vertices.push(...first, ...second);
      }
    };
    [-1, 1].forEach((sign) => {
      addLoop([[sign * half, -inner, -inner], [sign * half, inner, -inner], [sign * half, inner, inner], [sign * half, -inner, inner]]);
      addLoop([[-inner, sign * half, -inner], [inner, sign * half, -inner], [inner, sign * half, inner], [-inner, sign * half, inner]]);
      addLoop([[-inner, -inner, sign * half], [inner, -inner, sign * half], [inner, inner, sign * half], [-inner, inner, sign * half]]);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    const outline = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x9cecff, transparent: true, opacity: 0.98, depthTest: true, depthWrite: false }));
    outline.position.copy(center);
    outline.renderOrder = 2;
    return outline;
  }

  createArenaInnerSelectionOutline(target) {
    const tileGroup = target.userData.arenaTileGroup || target;
    tileGroup.updateWorldMatrix(true, false);
    const sizeX = Math.max(1, Number(tileGroup.userData.arenaTileSizeX) || 1);
    const sizeZ = Math.max(1, Number(tileGroup.userData.arenaTileSizeZ) || 1);
    const baseBottomY = Number(tileGroup.userData.arenaTileBaseBottomY ?? ARENA_BASE_BOTTOM);
    const baseThickness = Number(tileGroup.userData.arenaTileBaseThickness) || ARENA_BASE_THICKNESS;
    const bounds = new THREE.Box3(
      new THREE.Vector3(-CELL_SIZE / 2, baseBottomY, -CELL_SIZE / 2),
      new THREE.Vector3((sizeX - 0.5) * CELL_SIZE, baseBottomY + baseThickness, (sizeZ - 0.5) * CELL_SIZE)
    ).applyMatrix4(tileGroup.matrixWorld);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    size.x = Math.max(size.x * ARENA_SELECTION_OUTLINE_SCALE, size.x + 0.24);
    size.z = Math.max(size.z * ARENA_SELECTION_OUTLINE_SCALE, size.z + 0.24);
    size.y = Math.max(0.24, size.y + 0.14);
    const outline = new THREE.Box3Helper(new THREE.Box3().setFromCenterAndSize(center, size), 0x9cecff);
    outline.material.transparent = true;
    outline.material.opacity = 0.98;
    outline.material.depthTest = true;
    outline.material.depthWrite = false;
    outline.renderOrder = 3;
    return outline;
  }

  createArenaRampInnerSelectionOutline(target) {
    const parent = target.userData.arenaRampOutlineParent;
    const tileGroup = target.userData.arenaTileGroup || target;
    const baseThickness = Number(tileGroup.userData.arenaTileBaseThickness) || ARENA_BASE_THICKNESS;
    const lowTopY = tileBaseTopY(baseThickness);
    const outline = new THREE.LineSegments(this.createArenaRampEdgeGeometry(1, baseThickness), new THREE.LineBasicMaterial({ color: 0x9cecff, transparent: true, opacity: 0.98, depthTest: true, depthWrite: false }));
    const scale = ARENA_SELECTION_OUTLINE_SCALE;
    const centerY = lowTopY + LEVEL_HEIGHT / 2;
    outline.position.copy(parent.getWorldPosition(new THREE.Vector3()));
    outline.position.y += centerY * (1 - scale);
    outline.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()));
    outline.scale.setScalar(scale);
    outline.renderOrder = 3;
    return outline;
  }

  setSelection(id, highlight = true) {
    const target = this.pickTargets.get(id);
    const robotTarget = Boolean(target?.userData.sourceTypeId && (this.mode === "workshop" || this.scope === "simulation"));
    const arenaTarget = this.mode === "arena" && !robotTarget;
    const selectionMode = !id || !highlight ? "none" : robotTarget && this.spec.robotGroupsVisible === true ? "inner" : arenaTarget ? "arena-outer" : "outer";
    if (this.selectedId === id && this.selectionHighlight === highlight && this.selectionOutlineMode === selectionMode) return;
    this.selectedId = id;
    this.selectionHighlight = highlight;
    this.removeHelper(this.selectionOutline);
    this.selectionOutline = null;
    this.selectionOutlineMode = selectionMode;
    if (!id || !highlight) return;
    if (!target) return;
    target.updateWorldMatrix(true, false);
    const robotSelectionSize = this.scope === "simulation" ? ROBOT_CELL_SIZE * SIMULATION_ROBOT_SCALE : ROBOT_CELL_SIZE;
    const outline = robotTarget
      ? selectionMode === "inner"
        ? this.createInnerSelectionOutline(target.getWorldPosition(new THREE.Vector3()))
        : new THREE.Box3Helper(new THREE.Box3().setFromCenterAndSize(target.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(robotSelectionSize, robotSelectionSize, robotSelectionSize)), 0x2fa9c2)
      : arenaTarget
        ? target.userData.arenaRampOutlineParent
          ? this.createArenaRampInnerSelectionOutline(target)
          : this.createArenaInnerSelectionOutline(target)
      : new THREE.BoxHelper(target, 0x2fa9c2);
    outline.material.transparent = true;
    outline.material.opacity = 0.95;
    outline.material.linewidth = arenaTarget ? 3 : 2;
    outline.material.depthTest = true;
    outline.material.depthWrite = false;
    outline.renderOrder = 2;
    this.selectionOutline = outline;
    this.world.add(outline);
  }

  clearDiagnosticsRobotColliderOverlay() {
    this.diagnosticsRobotColliderLines.forEach((line) => {
      line.parent?.remove(line);
      disposeObject(line);
    });
    this.diagnosticsRobotColliderLines = [];
    this.diagnosticsRobotColliderOverlay = null;
    this.diagnosticsRobotColliderKey = "";
  }

  updateDiagnosticsRobotColliderOverlay() {
    const colliderBlueprint = this.spec?.simulationRobotColliderBlueprint?.ready === true
      ? this.spec.simulationRobotColliderBlueprint
      : this.robotColliderBlueprint;
    const visible = this.scope === "simulation"
      && this.mode === "arena"
      && this.spec?.diagnostics === true
      && this.spec?.competitionActive !== true
      && this.spec?.simulationDiagnosticsCollidersVisible === true
      && this.simulatorRobot
      && colliderBlueprint?.ready === true
      && Array.isArray(this.spec?.simulationRuntime?.robotColliders);
    if (!visible) {
      this.clearDiagnosticsRobotColliderOverlay();
      return;
    }
    const colliders = this.spec.simulationRuntime.robotColliders;
    const signature = JSON.stringify(colliders.map(({ id, groupId, partId, shapeId, sensor }) => ({ id, groupId, partId, shapeId, sensor })));
    if (this.diagnosticsRobotColliderOverlay && this.diagnosticsRobotColliderKey === signature) return;
    this.clearDiagnosticsRobotColliderOverlay();
    const colors = [0x31d7f0, 0xffbd59, 0xd994ff, 0x65d69b, 0xf17b72];
    const groupIds = [...new Set(colliders.map((collider) => collider.groupId))].sort((a, b) => a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b));
    const groupColors = new Map(groupIds.map((id, index) => [id, colors[index % colors.length]]));
    colliders.forEach((collider) => {
      const component = this.robotComponents.get(`sim-${collider.partId}`);
      const shape = colliderBlueprint.parts[collider.partId]?.shapes.find((entry) => entry.id === collider.shapeId);
      if (!component || !shape || shape.points.length < 4) return;
      let hull;
      try {
        if (shape.kind === "capsule") {
          hull = new THREE.CapsuleGeometry(
            shape.radius * 6,
            Math.max(0, shape.height - 2 * shape.radius) * 6,
            8,
            24
          );
          hull.translate(shape.center[0] * 6, shape.center[1] * 6, shape.center[2] * 6);
        } else if (shape.kind === "box") {
          hull = new THREE.BoxGeometry(shape.size[0] * 6, shape.size[1] * 6, shape.size[2] * 6);
          hull.translate(shape.center[0] * 6, shape.center[1] * 6, shape.center[2] * 6);
        } else {
          hull = new ConvexGeometry(shape.points.map((point) => new THREE.Vector3(point[0], point[1], point[2])));
        }
      } catch {
        return;
      }
      const geometry = new THREE.EdgesGeometry(hull, 8);
      hull.dispose();
      const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: collider.sensor ? 0xffbd59 : (groupColors.get(collider.groupId) || colors[0]),
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false
      }));
      line.name = `DiagnosticsRobotCollider:${collider.id}`;
      line.renderOrder = 20;
      line.userData.debugOnly = true;
      line.userData.physicsGroupId = collider.groupId || collider.id || "";
      line.userData.physicsPartId = collider.partId;
      line.userData.physicsSensor = collider.sensor === true;
      component.add(line);
      this.diagnosticsRobotColliderLines.push(line);
    });
    this.diagnosticsRobotColliderOverlay = true;
    this.diagnosticsRobotColliderKey = signature;
  }

  clearDiagnosticsArenaColliderOverlay() {
    const overlay = this.diagnosticsArenaColliderOverlay;
    if (!overlay) return;
    overlay.parent?.remove(overlay);
    disposeObject(overlay);
    this.diagnosticsArenaColliderOverlay = null;
  }

  updateDiagnosticsArenaColliderOverlay() {
    const buffers = this.spec?.simulationArenaColliderDebug;
    const visible = this.scope === "simulation"
      && this.mode === "arena"
      && this.spec?.diagnostics === true
      && this.spec?.competitionActive !== true
      && this.spec?.simulationDiagnosticsArenaCollidersVisible === true
      && buffers?.vertices?.length > 0
      && buffers?.colors?.length > 0;
    if (!visible) {
      this.clearDiagnosticsArenaColliderOverlay();
      return;
    }

    const vertices = buffers.vertices instanceof Float32Array ? buffers.vertices : new Float32Array(buffers.vertices);
    const rgba = buffers.colors instanceof Float32Array ? buffers.colors : new Float32Array(buffers.colors);
    const vertexCount = Math.floor(vertices.length / 3);
    const lineCount = vertexCount / 2;
    if (vertices.length % 3 || vertexCount % 2 || rgba.length < lineCount * 4) {
      this.clearDiagnosticsArenaColliderOverlay();
      return;
    }

    let overlay = this.diagnosticsArenaColliderOverlay;
    if (!overlay) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices.length), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setDrawRange(0, vertexCount);
      overlay = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false
      }));
      overlay.name = "DiagnosticsArenaColliderOverlay";
      overlay.renderOrder = 21;
      overlay.frustumCulled = false;
      overlay.userData.debugOnly = true;
      this.world.add(overlay);
      this.diagnosticsArenaColliderOverlay = overlay;
    }

    const geometry = overlay.geometry;
    let position = geometry.getAttribute("position");
    if (position.array.length !== vertices.length) {
      position = new THREE.BufferAttribute(new Float32Array(vertices.length), 3).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("position", position);
    }
    position.array.set(vertices);
    position.needsUpdate = true;

    let color = geometry.getAttribute("color");
    if (color.array.length !== vertexCount * 3) {
      color = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("color", color);
    }
    for (let line = 0; line < lineCount; line += 1) {
      const source = line * 4;
      for (let endpoint = 0; endpoint < 2; endpoint += 1) {
        const target = (line * 2 + endpoint) * 3;
        color.array[target] = rgba[source];
        color.array[target + 1] = rgba[source + 1];
        color.array[target + 2] = rgba[source + 2];
      }
    }
    color.needsUpdate = true;
    geometry.setDrawRange(0, vertexCount);
  }

  clearDiagnosticsSensorOverlays() {
    this.diagnosticsSensorOverlays.forEach((overlay) => {
      overlay.parent?.remove(overlay);
      disposeObject(overlay);
    });
    this.diagnosticsSensorOverlays.clear();
  }

  updateDiagnosticsSensorOverlays() {
    const selected = this.spec?.simulationDiagnosticsComponents || [];
    const runtimeComponents = this.spec?.simulationRuntime?.components || {};
    const visibleIds = new Set(selected.filter((id) => {
      const typeId = runtimeComponents[id]?.typeId;
      return typeId === "ultrasonicSensor" || typeId === "wedgeUltrasonicSensor";
    }));
    this.diagnosticsSensorOverlays.forEach((overlay, id) => {
      if (visibleIds.has(id)) return;
      overlay.parent?.remove(overlay);
      disposeObject(overlay);
      this.diagnosticsSensorOverlays.delete(id);
    });
    visibleIds.forEach((id) => {
      const component = this.robotComponents.get(`sim-${id}`);
      const rays = runtimeComponents[id]?.readings?.rays || [];
      if (!component || !rays.length) return;
      let overlay = this.diagnosticsSensorOverlays.get(id);
      if (!overlay) {
        overlay = new THREE.Group();
        overlay.name = `DiagnosticsSensorRays:${id}`;
        overlay.userData.debugOnly = true;
        component.add(overlay);
        this.diagnosticsSensorOverlays.set(id, overlay);
      }
      rays.forEach((ray, index) => {
        let line = overlay.children[index];
        if (!line) {
          line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }));
          line.renderOrder = 6;
          overlay.add(line);
        }
        const angle = ray.id === "left" ? -Math.PI / 180 : ray.id === "right" ? Math.PI / 180 : 0;
        const direction = ray.localDirection || { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
        const localOrigin = ray.localOrigin || { x: 0, y: 0, z: 3.03 };
        const length = (Number(ray.distance) >= 0 ? Number(ray.distance) : 32) / SIMULATION_ROBOT_SCALE;
        const start = new THREE.Vector3(localOrigin.x, localOrigin.y, localOrigin.z);
        const end = start.clone().add(new THREE.Vector3(direction.x, direction.y, direction.z).multiplyScalar(length));
        line.geometry.dispose();
        line.geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        line.material.color.set(ray.hit ? 0x7fe8a5 : 0xf1a45b);
        line.material.opacity = ray.hit ? 0.95 : 0.5;
      });
    });
  }

  robotFaceFromHit(hit) {
    const normal = hit?.face?.normal?.clone();
    if (!normal) return "+Y";
    normal.transformDirection(hit.object.matrixWorld).normalize();
    const axes = [
      [Math.abs(normal.x), normal.x >= 0 ? "+X" : "-X"],
      [Math.abs(normal.y), normal.y >= 0 ? "+Y" : "-Y"],
      [Math.abs(normal.z), normal.z >= 0 ? "+Z" : "-Z"]
    ];
    return axes.sort((first, second) => second[0] - first[0])[0][1];
  }

  arenaCameraTarget(focusTileId = "") {
    const allEntries = Array.isArray(this.spec?.arenaTiles) ? this.spec.arenaTiles : [];
    if (!allEntries.length) return new THREE.Vector3(0, 1.6, -5);
    const focusedEntries = focusTileId
      ? allEntries.filter((entry) => entry.id === focusTileId || entry.compositeId === focusTileId)
      : [];
    const entries = focusedEntries.length ? focusedEntries : allEntries;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    entries.forEach((entry) => {
      const definition = entry.definition || {};
      const sizeX = Math.max(1, Number(definition.sizeX) || 1);
      const sizeZ = Math.max(1, Number(definition.sizeZ) || 1);
      const quarterTurns = ((Math.round(Number(entry.rotation) || 0) / 90) % 4 + 4) % 4;
      for (let cellZ = 0; cellZ < sizeZ; cellZ += 1) {
        for (let cellX = 0; cellX < sizeX; cellX += 1) {
          let offsetX = cellX;
          let offsetZ = cellZ;
          if (quarterTurns === 1) [offsetX, offsetZ] = [cellZ, -cellX];
          else if (quarterTurns === 2) [offsetX, offsetZ] = [-cellX, -cellZ];
          else if (quarterTurns === 3) [offsetX, offsetZ] = [-cellZ, cellX];
          const centerX = (Number(entry.x) || 0) + offsetX;
          const centerZ = (Number(entry.z) || 0) + offsetZ;
          const worldX = arenaWorldX(centerX);
          const worldZ = arenaWorldZ(centerZ);
          minX = Math.min(minX, worldX - CELL_SIZE / 2);
          maxX = Math.max(maxX, worldX + CELL_SIZE / 2);
          minZ = Math.min(minZ, worldZ - CELL_SIZE / 2);
          maxZ = Math.max(maxZ, worldZ + CELL_SIZE / 2);
        }
      }
      const baseY = (Number(entry.y) || 0) * LEVEL_HEIGHT;
      const baseThickness = tileBaseThickness(arenaTileVisuals(entry));
      const localTopY = tileBaseTopY(baseThickness);
      const topY = baseY + (arenaTileIsRamp(entry) ? localTopY + LEVEL_HEIGHT : localTopY);
      minY = Math.min(minY, baseY + ARENA_BASE_BOTTOM);
      maxY = Math.max(maxY, topY);
    });
    return new THREE.Vector3(
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2
    );
  }

  updateCamera(cameraState = {}) {
    const workshop = this.mode === "workshop";
    const arena = this.mode === "arena";
    const replayTarget = this.passiveReplayMode ? cameraState.replayTarget : null;
    const target = replayTarget
      ? new THREE.Vector3(Number(replayTarget.x) || 0, Number(replayTarget.y) || 0, Number(replayTarget.z) || 0)
      : workshop ? this.workshopTarget.clone() : arena ? this.arenaCameraTarget(cameraState.focusTileId || "") : new THREE.Vector3(0, 1.6, 5);
    // Pan follows the grab gesture: move the scene with the pointer instead of
    // moving it in the opposite direction as the camera target shifts.
    if (!replayTarget) {
      target.x -= (cameraState.panX || 0) * 0.15;
      target.z -= (cameraState.panY || 0) * 0.15;
    }
    // Unity's Workshop camera starts on the -Z side of the robot. The web
    // isometric view keeps its 34° three-quarter angle, but must rotate that
    // starting azimuth by 180° or every robot appears left/right mirrored.
    const theta = THREE.MathUtils.degToRad((workshop ? 214 : arena ? 138 : 42) + (cameraState.orbitY || 0) * 0.22);
    const requestedPhi = THREE.MathUtils.degToRad(75 - (cameraState.orbitX || 0) * 0.18);
    const polarMax = this.mode === "workshop" ? ROBOT_CAMERA_POLAR_MAX : ARENA_CAMERA_POLAR_MAX;
    const phi = THREE.MathUtils.clamp(requestedPhi, ROBOT_CAMERA_POLAR_MIN, polarMax);
    const radius = (workshop ? this.workshopCameraRadius : 96) / (cameraState.zoom || 1);
    this.camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    this.cameraTarget.copy(target);
    // At the exact top/bottom pole, lookAt's default Y-up vector is parallel
    // to the view direction and can choose an arbitrary roll. Project world Y
    // onto the camera plane, with the azimuthal limiting vector as the stable
    // fallback at either pole, so the camera never spins by itself.
    this.cameraViewDirection.subVectors(target, this.camera.position).normalize();
    if (arena && cameraState.focusTileId && phi <= 0.001) {
      // Focused Tile view is a true top view. Keep screen up aligned to the
      // Arena world Z axis instead of deriving a diagonal roll from azimuth.
      this.cameraStableUp.set(0, 0, 1);
    } else {
      this.cameraStableUp.set(0, 1, 0).addScaledVector(this.cameraViewDirection, -this.cameraViewDirection.y);
    }
    if (this.cameraStableUp.lengthSq() < 1e-10) {
      const poleDirection = Math.cos(phi) >= 0 ? -1 : 1;
      this.cameraStableUp.set(poleDirection * Math.sin(theta), 0, poleDirection * Math.cos(theta));
    }
    this.camera.up.copy(this.cameraStableUp.normalize());
    this.camera.lookAt(target);
    this.requestRender();
  }

  updateArenaPlacementPointer(event) {
    if (this.passiveReplayMode) return;
    if (this.scope !== "arena-editor" || !this.host) return;
    const active = this.spec?.section === "arenas" && this.spec?.arenaMode === "place" && event.pointerType !== "touch";
    if (!active || document.querySelector("#stage")?.dataset.dragging === "true") {
      if (this.arenaPlacementTarget) {
        this.arenaPlacementTarget = null;
        this.updateArenaPlacementGhost();
        this.requestRender();
      }
      return;
    }
    const bounds = this.canvas.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      if (this.arenaPlacementTarget) {
        this.arenaPlacementTarget = null;
        this.updateArenaPlacementGhost();
        this.requestRender();
      }
      return;
    }
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.arenaPlacementSurface ? this.raycaster.intersectObject(this.arenaPlacementSurface, false)[0] : null;
    if (!hit) return;
    const target = { x: Math.round(hit.point.x / CELL_SIZE), z: Math.round(-hit.point.z / CELL_SIZE) };
    if (this.arenaPlacementTarget?.x === target.x && this.arenaPlacementTarget?.z === target.z) return;
    this.arenaPlacementTarget = target;
    this.updateArenaPlacementGhost();
    this.requestRender();
  }

  pick(event) {
    if (this.passiveReplayMode) return;
    if (!this.pointerStart || this.pointerStart.pointerId !== event.pointerId || !this.host) return;
    const distance = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    this.pointerStart = null;
    if (distance > 8) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.spec?.preflightKitSelectionEnabled && event.button === 0) {
      const robotHit = this.simulatorRobot
        ? this.raycaster.intersectObject(this.simulatorRobot, true).find(({ object }) => {
            if (!object.isMesh || !object.visible || object.userData?.pickKind === "robot" || object.userData?.debugOnly || object.userData?.sourceRole === "logical-selection-slot") return false;
            let ancestor = object.parent;
            while (ancestor && ancestor !== this.simulatorRobot) {
              if (!ancestor.visible || ancestor.userData?.debugOnly) return false;
              ancestor = ancestor.parent;
            }
            return true;
          })
        : null;
      if (!robotHit) return;
      const mount = this.starterRescueKitMountFromHit(robotHit);
      if (mount) document.dispatchEvent(new CustomEvent("sbotics-three-preflight-kit", { detail: { mount } }));
      return;
    }
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    let picked = hit?.object || null;
    while (picked && !picked.userData.pickId) picked = picked.parent;
    const pickId = picked?.userData?.pickId;
    if (this.scope === "simulation") {
      if (this.spec?.preflightStep === "checkpoints") {
        if (event.button === 0 && picked?.userData?.pickKind === "tile" && pickId) {
          document.dispatchEvent(new CustomEvent("sbotics-three-preflight-checkpoint", { detail: { tileId: pickId } }));
        }
        return;
      }
      if (this.spec?.preflightStep === "kit") return;
      if (!this.spec?.diagnostics || this.spec?.competitionActive || picked?.userData?.pickKind !== "robot" || !pickId) return;
      const component = this.robotComponents.get(pickId);
      document.dispatchEvent(new CustomEvent("sbotics-three-simulation-select", {
        detail: {
          id: pickId,
          sourceInstanceId: component?.userData?.sourceInstanceId || pickId.replace(/^sim-/, ""),
          typeId: component?.userData?.sourceTypeId || "controller",
          source: "scene"
        }
      }));
      return;
    }
    if (this.mode === "workshop" && this.spec?.section === "robots") {
      const robotMode = this.spec.robotMode || "inspect";
      if (event.button === 1) {
        if (pickId) document.dispatchEvent(new CustomEvent("sbotics-three-select", { detail: { id: pickId, kind: "robot", source: "scene", forceInspect: true } }));
      } else if (event.button === 2) {
        if (pickId && robotMode === "place") {
          document.dispatchEvent(new CustomEvent("sbotics-three-erase", { detail: { targetId: pickId, rightClick: true } }));
        } else if (pickId && robotMode === "paint") {
          document.dispatchEvent(new CustomEvent("sbotics-three-paint", { detail: { targetId: pickId, color: "white", rightClick: true } }));
        }
      } else if (event.button !== 0) {
        return;
      } else if (robotMode === "inspect") {
        document.dispatchEvent(new CustomEvent("sbotics-three-select", { detail: { id: pickId || "controller", kind: "robot", source: pickId ? "scene" : "blank", suppressHighlight: !pickId } }));
      } else if (pickId && robotMode === "place" && this.spec.selectedBlock) {
        document.dispatchEvent(new CustomEvent("sbotics-three-place", { detail: { targetId: pickId, face: this.robotFaceFromHit(hit) } }));
      } else if (pickId && robotMode === "paint") {
        document.dispatchEvent(new CustomEvent("sbotics-three-paint", { detail: { targetId: pickId } }));
      } else if (pickId && robotMode === "erase") {
        document.dispatchEvent(new CustomEvent("sbotics-three-erase", { detail: { targetId: pickId } }));
      }
      return;
    }
    if (this.mode === "arena" && this.spec?.section === "arenas") {
      const arenaMode = this.spec.arenaMode || "inspect";
      if (event.button === 1) {
        if (pickId && picked?.userData?.pickKind === "tile") document.dispatchEvent(new CustomEvent("sbotics-three-select", { detail: { id: pickId, kind: "tile", source: "scene", forceInspect: true } }));
        return;
      }
      if (event.button === 2 && arenaMode === "place" && pickId && picked?.userData?.pickKind === "tile") {
        document.dispatchEvent(new CustomEvent("sbotics-three-arena-erase", { detail: { targetId: pickId, rightClick: true } }));
        return;
      }
      if (event.button !== 0) return;
      if (arenaMode === "place") {
        if (picked?.userData?.pickKind === "arena-space") {
          const point = hit?.point;
          if (point) {
            this.arenaPlacementTarget = null;
            this.updateArenaPlacementGhost();
            document.dispatchEvent(new CustomEvent("sbotics-three-arena-place", { detail: { x: Math.round(point.x / CELL_SIZE), z: Math.round(-point.z / CELL_SIZE) } }));
          }
        } else if (pickId) {
          const point = hit?.point;
          if (point) {
            this.arenaPlacementTarget = null;
            this.updateArenaPlacementGhost();
            document.dispatchEvent(new CustomEvent("sbotics-three-arena-place", { detail: { x: Math.round(point.x / CELL_SIZE), z: Math.round(-point.z / CELL_SIZE) } }));
          }
        }
        return;
      }
      if (arenaMode === "erase") {
        if (pickId && picked?.userData?.pickKind === "tile") document.dispatchEvent(new CustomEvent("sbotics-three-arena-erase", { detail: { targetId: pickId } }));
        return;
      }
      const tilePickId = picked?.userData?.pickKind === "tile" ? pickId : "";
      document.dispatchEvent(new CustomEvent("sbotics-three-select", { detail: { id: tilePickId, kind: "tile", source: tilePickId ? "scene" : "void", deselect: !tilePickId } }));
      return;
    }
    if (!picked?.userData?.pickId) return;
    document.dispatchEvent(new CustomEvent("sbotics-three-select", { detail: { id: picked.userData.pickId, kind: picked.userData.pickKind, source: "scene" } }));
  }

  resize() {
    if (!this.host) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (this.showFps || this.renderQueued || !this.host) return;
    this.renderQueued = true;
    const renderFrame = (timestamp) => {
      if (!this.host || this.showFps) {
        this.renderQueued = false;
        return;
      }
      const now = Number.isFinite(timestamp) ? timestamp : (globalThis.performance?.now?.() ?? Date.now());
      const minimumFrameMs = 1000 / ROBOT_RENDER_FPS_CAP;
      const waitMs = this.renderLastAt ? minimumFrameMs - (now - this.renderLastAt) : 0;
      if (waitMs > 0) {
        globalThis.requestAnimationFrame(renderFrame);
        return;
      }
      this.renderQueued = false;
      this.renderLastAt = now;
      this.render();
    };
    globalThis.requestAnimationFrame(renderFrame);
  }

  render() {
    if (!this.host) return;
    this.selectionOutline?.update?.();
    this.renderer.render(this.scene, this.camera);
  }

  releaseSensorCaptureTargets() {
    this.sensorCaptureTargets.forEach((entry) => {
      try {
        entry?.target?.dispose?.();
      } catch {
        // Releasing Diagnostics resources must not interrupt popup or scene cleanup.
      }
    });
    this.sensorCaptureTargets.clear();
    this.sensorCaptureLastAt.clear();
  }

  ensureSensorCaptureTarget(key, width, height = width) {
    let entry = this.sensorCaptureTargets.get(key);
    if (entry?.width === width && entry?.height === height) return entry.target;
    entry?.target?.dispose?.();
    const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true, stencilBuffer: false, generateMipmaps: false });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.generateMipmaps = false;
    this.sensorCaptureTargets.set(key, { target, width, height });
    return target;
  }

  renderRobotSensorFrame(componentId, kind, size) {
    if (this.scope !== "simulation" || !this.spec?.diagnostics || this.spec?.competitionActive || !this.host || this.renderer?.getContext?.()?.isContextLost?.()) return null;
    const instanceId = `sim-${componentId}`;
    const component = this.robotComponents.get(instanceId);
    if (!component) return null;
    const expectedRole = kind === "camera" ? "Camera/Quad" : component.userData.sourceTypeId === "wedgeColorSensor" ? "Wedge Color Sensor/Quad" : "Color Sensor/Quad";
    let lens = null;
    component.traverse((object) => { if (!lens && object.userData?.sourceRole === expectedRole) lens = object; });
    if (!lens) return null;
    const now = globalThis.performance?.now?.() ?? Date.now();
    const lastAt = this.sensorCaptureLastAt.get(`${kind}:${componentId}`) || 0;
    if (now - lastAt < 90) return null;
    this.sensorCaptureLastAt.set(`${kind}:${componentId}`, now);

    component.updateWorldMatrix(true, false);
    lens.updateWorldMatrix(true, false);
    const camera = kind === "camera" ? this.sensorCaptureCamera : this.sensorCaptureColorCamera;
    const lensQuaternion = lens.getWorldQuaternion(new THREE.Quaternion());
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(lensQuaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(lensQuaternion).normalize();
    camera.position.copy(lens.getWorldPosition(new THREE.Vector3())).addScaledVector(forward, 0.015);
    camera.up.copy(up);
    camera.lookAt(camera.position.clone().add(forward));
    camera.aspect = 1;
    camera.near = 0.01;
    camera.far = kind === "camera" ? 16 : 32;
    if (kind === "camera") {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    } else {
      const lensScale = lens.getWorldScale(new THREE.Vector3());
      const halfSpan = Math.max(0.01, (Number(lens.geometry?.parameters?.width) || 3) * Math.abs(lensScale.x) / 2);
      camera.left = -halfSpan;
      camera.right = halfSpan;
      camera.top = halfSpan;
      camera.bottom = -halfSpan;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld(true);
    this.scene.updateMatrixWorld(true);

    const hidden = [];
    this.scene.traverse((object) => {
      if ((object.userData?.debugOnly || object === this.selectionOutline) && object.visible) {
        hidden.push(object);
        object.visible = false;
      }
    });
    this.editorLayers.forEach((layer) => {
      if (!layer.visible) return;
      hidden.push(layer);
      layer.visible = false;
    });
    this.diagnosticsRobotColliderLines.forEach((line) => {
      if (!line.visible) return;
      hidden.push(line);
      line.visible = false;
    });
    const targetKey = `${kind}:${size}`;
    const target = this.ensureSensorCaptureTarget(targetKey, size);
    const previousTarget = this.renderer.getRenderTarget();
    const previousViewport = this.renderer.getViewport(new THREE.Vector4());
    const previousScissor = this.renderer.getScissor(new THREE.Vector4());
    const previousScissorTest = this.renderer.getScissorTest();
    const pixels = new Uint8Array(size * size * 4);
    try {
      this.renderer.setRenderTarget(target);
      this.renderer.setViewport(0, 0, size, size);
      this.renderer.setScissor(0, 0, size, size);
      this.renderer.setScissorTest(false);
      this.renderer.render(this.scene, camera);
      this.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    } catch {
      return null;
    } finally {
      this.renderer.setRenderTarget(previousTarget);
      this.renderer.setViewport(previousViewport);
      this.renderer.setScissor(previousScissor);
      this.renderer.setScissorTest(previousScissorTest);
      hidden.forEach((object) => { object.visible = true; });
    }
    return { pixels, width: size, height: size, frame: Number(this.spec?.simulationRuntime?.physicsTick) || Number(this.spec?.simulationRuntime?.tick) || 0 };
  }

  captureRobotCameraFrame(componentId) {
    return this.renderRobotSensorFrame(componentId, "camera", 128);
  }

  sampleRobotColorSensor(componentId) {
    const rendered = this.renderRobotSensorFrame(componentId, "color", 5);
    if (!rendered) return null;
    const runtime = this.spec?.simulationRuntime || {};
    const seed = String(runtime.seed || runtime.environmentSeed || "");
    const attempt = Number(runtime.attempt) || 1;
    const noise = (channel, sigma) => seed
      ? environmentNormalSample(seed, `environment-randomization-v1:color:${componentId}:${channel}:attempt:${attempt}:tick:${rendered.frame}`) * sigma
      : 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let index = 0; index < rendered.pixels.length; index += 4) {
      red += rendered.pixels[index];
      green += rendered.pixels[index + 1];
      blue += rendered.pixels[index + 2];
    }
    const count = rendered.pixels.length / 4;
    const rgb = {
      r: Math.max(0, Math.min(255, Math.round(red / count + noise("red", 2)))),
      g: Math.max(0, Math.min(255, Math.round(green / count + noise("green", 2)))),
      b: Math.max(0, Math.min(255, Math.round(blue / count + noise("blue", 2))))
    };
    const referenceColors = [
      ["black", 0, 0, 0], ["white", 255, 255, 255], ["green", 0, 255, 0], ["red", 255, 0, 0],
      ["blue", 0, 0, 255], ["yellow", 255, 255, 0], ["magenta", 255, 0, 255], ["cyan", 0, 255, 255]
    ];
    const colorName = referenceColors.reduce((best, candidate) => {
      const distance = Math.abs(rgb.r - candidate[1]) + Math.abs(rgb.g - candidate[2]) + Math.abs(rgb.b - candidate[3]);
      return !best || distance < best.distance ? { name: candidate[0], distance } : best;
    }, null)?.name || "unknown";
    const rawBrightness = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    const brightness = Math.max(0, Math.min(100, (rawBrightness / 255) * 100 + noise("brightness", 1))) * 2.55;
    return { sampled: true, colorName, rgb, seesNonBlack: colorName !== "black", brightness, luminosity: brightness, frame: rendered.frame };
  }

  updateRobotPenTrails() {
    const runtimeComponents = this.spec?.simulationRuntime?.components || {};
    const pens = Object.entries(runtimeComponents).filter(([, component]) => component?.typeId === "pen");
    const visibleIds = new Set(pens.map(([id]) => id));
    this.robotPenTrails.forEach((entry, id) => {
      if (visibleIds.has(id)) return;
      entry.mesh.parent?.remove(entry.mesh);
      entry.mesh.geometry.dispose();
      entry.mesh.material.dispose();
      this.robotPenTrails.delete(id);
    });
    pens.forEach(([id, componentState]) => {
      const points = componentState.readings?.trailPoints || [];
      let entry = this.robotPenTrails.get(id);
      if (points.length < 2) {
        if (entry) { entry.mesh.visible = false; entry.geometryKey = ""; }
        return;
      }
      const colorValue = componentState.readings?.color || { r: 255, g: 128, b: 0 };
      if (!entry) {
        const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, depthWrite: false }));
        mesh.name = `RobotPenTrail:${id}`;
        mesh.renderOrder = 3;
        this.world.add(mesh);
        entry = { mesh, colorKey: "" };
        this.robotPenTrails.set(id, entry);
      }
      const colorKey = `${colorValue.r}:${colorValue.g}:${colorValue.b}`;
      if (entry.colorKey !== colorKey) {
        entry.mesh.material.color.setRGB(colorValue.r / 255, colorValue.g / 255, colorValue.b / 255, THREE.SRGBColorSpace);
        entry.colorKey = colorKey;
      }
      const first = points[0];
      const last = points[points.length - 1];
      const geometryKey = `${points.length}:${first.x},${first.y},${first.z}:${last.x},${last.y},${last.z}:${colorKey}`;
      if (entry.geometryKey === geometryKey && entry.mesh.visible) return;
      const vertices = [];
      const indices = [];
      const halfWidth = 0.045;
      points.forEach((point, index) => {
        const before = points[Math.max(0, index - 1)];
        const after = points[Math.min(points.length - 1, index + 1)];
        let dx = Number(after.x) - Number(before.x);
        let dz = Number(after.z) - Number(before.z);
        const length = Math.hypot(dx, dz) || 1;
        const sideX = -dz / length * halfWidth;
        const sideZ = dx / length * halfWidth;
        const y = Number(point.y) + 0.012;
        vertices.push(Number(point.x) + sideX, y, Number(point.z) + sideZ, Number(point.x) - sideX, y, Number(point.z) - sideZ);
        if (index > 0) {
          const offset = index * 2;
          indices.push(offset - 2, offset - 1, offset, offset - 1, offset + 1, offset);
        }
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeBoundingSphere();
      entry.mesh.geometry.dispose();
      entry.mesh.geometry = geometry;
      entry.mesh.visible = true;
      entry.geometryKey = geometryKey;
    });
  }
}

export { ThreeStage };
globalThis.sboticsArenaEditorStage = new ThreeStage();
// Compatibility alias for existing integrations; app.js chooses the active
// stage explicitly and never routes Simulator through this instance.
globalThis.sboticsThreeStage = globalThis.sboticsArenaEditorStage;
globalThis.dispatchEvent(new Event("sbotics-arena-editor-stage-ready"));
