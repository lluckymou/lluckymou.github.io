import { compileRobotGroups, FIXED_TICK_SECONDS, PHYSICS_PROFILE, ROBOT_GROUND_SURFACE_OFFSET, robotSpawnPose, SEESAW_PROFILE, SimulationPhysics } from "./simulation-physics.js?imp-ux-02-seeded-randomization-20261027-1";
import { arenaTileIsRamp, pathTracksForOccurrences, roundArenaScoreTotal } from "./arena-model.js?imp-ux-02-arena-score-rounding-20261027-1";
import { BOX_GROWTH_MAX, BOX_MATERIALS, BOX_SOURCE_VARIANTS, boxDimensions, normalizedBoxSourceScale } from "./box-profile.js?imp-ux-02-box-source-20260928-1";

const CELL_SIZE = 10;
const LEVEL_HEIGHT = 3.6505;
export const RESCUE_POINT_SOURCE_ANCHOR = Object.freeze({ x: 2.506, z: -5.852 });
export const RESCUE_TRIGGER_SCALE = 0.9;
export const RESCUE_TRIGGER_WIDTH = CELL_SIZE * RESCUE_TRIGGER_SCALE;
export const RESCUE_TRIGGER_DEPTH = CELL_SIZE * RESCUE_TRIGGER_SCALE;
export const RESCUE_TRIGGER_HEIGHT = 2.2 * RESCUE_TRIGGER_SCALE;
const RESCUE_POINT_FLOOR_OFFSET = -0.41;
const ROBOT_SURFACE_HEIGHT = 0.34 + (6 * ((CELL_SIZE * 1.05) / (17 * 6))) + 0.08;
const RAMP_SURFACE_ANGLE = Math.atan2(LEVEL_HEIGHT, CELL_SIZE);
const RAMP_OBJECT_PARENT_Y = 1.83;
const RAMP_OBJECT_PARENT_Z_SCALE = 1.07;

export const SIMULATION_ROBOT_FOOTPRINT_TILES = 1.05;
export const SIMULATION_ROBOT_GRID_LENGTH = 17;
export const SIMULATION_ROBOT_SOURCE_CELL_SIZE = 6;
export const SIMULATION_ROBOT_SCALE = (CELL_SIZE * SIMULATION_ROBOT_FOOTPRINT_TILES) / (SIMULATION_ROBOT_GRID_LENGTH * SIMULATION_ROBOT_SOURCE_CELL_SIZE);
export const SIMULATION_ROBOT_WHEEL_RADIUS = SIMULATION_ROBOT_SOURCE_CELL_SIZE * SIMULATION_ROBOT_SCALE;
export const SIMULATION_ROBOT_SURFACE_HEIGHT = ROBOT_SURFACE_HEIGHT;
const ROBOT_WORLD_SCALE = SIMULATION_ROBOT_SOURCE_CELL_SIZE * SIMULATION_ROBOT_SCALE;
const PEN_TRAIL_MAX_POINTS = 1024;

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
const dynamicTypes = new Set(["box", "cuboid", "sphere", "cylinder", "wedge", "pyramid", "corner", "liveVictim", "deadVictim", "rescueKit", "zul"]);
const prefabDynamicTypes = new Set(["liveVictim", "deadVictim", "rescueKit"]);
const collisionTypes = new Set(["plane", "box", "cuboid", "sphere", "cylinder", "wedge", "pyramid", "corner", "zul", "seesaw"]);
const GAME_STOPPER_RADIUS = 3.7;
const GAME_STOPPER_HEIGHT = 3;
const STARTER_RESCUE_KIT_KEY = "__starter-rescue-kit";
const STARTER_RESCUE_KIT_SCALE = Object.freeze({ x: 1.25, y: 1.25, z: 1.25 });
const ROBOT_SPAWN_LIFT_MAX = 0.05;
export const ROBOT_MANUAL_CONTROL_PROFILE = Object.freeze({
  version: "robot-manual-velocity-v1",
  manualTranslationSpeed: 1.5,
  manualYawSpeed: 80,
  tapStepSeconds: 0.25,
  minimumMultiplier: 0,
  maximumMultiplier: 3,
  multiplierStep: 0.1
});
const manualSpeedMultiplier = (speed) => {
  const value = Number(speed);
  return clamp(Number.isFinite(value) ? value : 1, ROBOT_MANUAL_CONTROL_PROFILE.minimumMultiplier, ROBOT_MANUAL_CONTROL_PROFILE.maximumMultiplier);
};
const END_GOAL_STABILITY_SECONDS = 5;
const LACK_OF_PROGRESS_FAILURE_DISPLAY_SECONDS = 3;
const LACK_OF_PROGRESS_FAILURE_REASON = "routineLackProgressReasonNotMoving";
const COMPONENT_TYPE_IDS = new Set([
  "controller",
  "buzzer",
  "light",
  "pen",
  "servo",
  "colorSensor",
  "wedgeColorSensor",
  "ultrasonicSensor",
  "wedgeUltrasonicSensor",
  "touchSensor",
  "camera"
]);
const SENSOR_SOURCE_SCALE = (CELL_SIZE * SIMULATION_ROBOT_FOOTPRINT_TILES) / (SIMULATION_ROBOT_GRID_LENGTH * SIMULATION_ROBOT_SOURCE_CELL_SIZE);
const COMPONENT_DEFAULT_NAMES = Object.freeze({
  controller: "Controller",
  buzzer: "Buzzer",
  light: "Light",
  pen: "Pen",
  servo: "Servomotor",
  colorSensor: "ColorSensor",
  wedgeColorSensor: "WedgeColorSensor",
  ultrasonicSensor: "UltrasonicSensor",
  wedgeUltrasonicSensor: "WedgeUltrasonicSensor",
  touchSensor: "TouchSensor",
  camera: "Camera"
});

export function wedgeUltrasonicRayFrame(points = []) {
  // The source Center Ray is rotated -45° around X. Project the loaded wedge
  // mesh onto that ray direction and use the exposed hypotenuse face center
  // as the shared origin for the same narrow, outward fan used by Ultrasonic.
  const direction = { x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 };
  if (!Array.isArray(points) || points.length < 4) return null;
  const projection = (point) => point[0] * direction.x + point[1] * direction.y + point[2] * direction.z;
  let tipProjection = -Infinity;
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 3 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])) continue;
    tipProjection = Math.max(tipProjection, projection(point));
  }
  if (!Number.isFinite(tipProjection)) return null;
  const origin = [0, 0, 0];
  let tipVertexCount = 0;
  for (const point of points) {
    if (!Array.isArray(point) || point.length < 3 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])) continue;
    if (tipProjection - projection(point) > 1e-4) continue;
    origin[0] += point[0];
    origin[1] += point[1];
    origin[2] += point[2];
    tipVertexCount += 1;
  }
  if (!tipVertexCount) return null;
  origin[0] /= tipVertexCount;
  origin[1] /= tipVertexCount;
  origin[2] /= tipVertexCount;
  return {
    origin: { x: origin[0], y: origin[1], z: origin[2] },
    direction
  };
}

function hashSeed(value) {
  // ponytail: synchronous 32-bit hash keeps this local fixture tick-safe; the
  // production runtime must replace it with the approved SHA-256 framed stream.
  let hash = 2166136261;
  for (const character of String(value || "sBotics")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function generateRuntimeSeed() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID().replaceAll("-", "");
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(0, 32);
}

function randomUnit(seed, key) {
  let value = hashSeed(`${seed}\u0000${key}`);
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

export function environmentNormalSample(seed, key) {
  const first = Math.max(1 / 4294967296, randomUnit(seed, `${key}:normal:u1`));
  const second = randomUnit(seed, `${key}:normal:u2`);
  const value = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return Math.max(-3, Math.min(3, value));
}

function resolveBoxRuntime(object = {}, objectKey = "", environmentSeed = "sBotics") {
  const variantIndex = Math.min(BOX_SOURCE_VARIANTS.length - 1, Math.floor(randomUnit(environmentSeed, `box:${objectKey}:variant`) * BOX_SOURCE_VARIANTS.length));
  const growth = randomUnit(environmentSeed, `box:${objectKey}:growth`) * BOX_GROWTH_MAX;
  const materialIndex = Math.min(BOX_MATERIALS.length - 1, Math.floor(randomUnit(environmentSeed, `box:${objectKey}:material`) * BOX_MATERIALS.length));
  const variant = BOX_SOURCE_VARIANTS[variantIndex];
  const dimensions = boxDimensions(normalizedBoxSourceScale(object.scale), variant, growth);
  return {
    variantId: variant.id,
    variantIndex,
    growth: round(growth, 5),
    material: BOX_MATERIALS[materialIndex],
    width: round(dimensions.width, 5),
    height: round(dimensions.height, 5),
    depth: round(dimensions.depth, 5),
    anchor: { x: Number(object.position?.x) || 0, y: Number(object.position?.y) || 0, z: Number(object.position?.z) || 0 }
  };
}

function worldPoint(tile, local = {}) {
  return {
    x: (Number(tile?.x) || 0) * CELL_SIZE + (Number(local.x) || 0),
    z: -((Number(tile?.z) || 0) * CELL_SIZE + (Number(local.z) || 0)),
    y: (Number(tile?.y) || 0) * LEVEL_HEIGHT + ROBOT_SURFACE_HEIGHT + (Number(local.y) || 0)
  };
}

export function robotSpawnPreviewPose({ path = [], pathStatus = "invalid", tiles = [], spawnOverride = null } = {}) {
  const points = pathStatus === "valid" && Array.isArray(path) && path.length
    ? path.map((occurrence) => worldPoint(occurrence))
    : (() => {
        const source = (Array.isArray(tiles) ? tiles : []).find((tile) => tile?.emptyTile !== true && tile?.definition?.emptyTile !== true);
        return source ? [worldPoint(source)] : [];
      })();
  if (!points.length) return null;

  const override = spawnOverride && ["x", "y", "z"].every((axis) => Number.isFinite(Number(spawnOverride[axis])))
    ? spawnOverride
    : null;
  let selectedIndex = 0;
  if (override && pathStatus === "valid") {
    let nearestDistance = Infinity;
    points.forEach((point, index) => {
      const distance = Math.hypot(Number(override.x) - point.x, Number(override.z) - point.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        selectedIndex = index;
      }
    });
  }
  const selected = override || points[selectedIndex];
  const next = points[Math.min(selectedIndex + 1, points.length - 1)] || selected;
  return {
    x: Number(selected.x) || 0,
    y: Number(selected.y) || ROBOT_SURFACE_HEIGHT,
    z: Number(selected.z) || 0,
    groundY: (Number(selected.y) || ROBOT_SURFACE_HEIGHT) - ROBOT_SURFACE_HEIGHT + ROBOT_GROUND_SURFACE_OFFSET,
    yaw: Number.isFinite(Number(override?.yaw)) ? Number(override.yaw) : Math.atan2(next.x - selected.x, next.z - selected.z),
    velocity: 0,
    angularVelocity: 0,
    fullyStopped: true,
    grounded: true
  };
}

function worldObjectPoint(tile, local = {}) {
  const tileYaw = -((Number(tile?.rotation) || 0) * Math.PI) / 180;
  let localPoint = {
    x: Number(local.x) || 0,
    y: Number(local.y) || 0,
    z: -(Number(local.z) || 0)
  };
  if (arenaTileIsRamp(tile)) {
    const scaledZ = localPoint.z * RAMP_OBJECT_PARENT_Z_SCALE;
    localPoint = {
      x: localPoint.x,
      y: Math.cos(RAMP_SURFACE_ANGLE) * localPoint.y - Math.sin(RAMP_SURFACE_ANGLE) * scaledZ + RAMP_OBJECT_PARENT_Y,
      z: Math.sin(RAMP_SURFACE_ANGLE) * localPoint.y + Math.cos(RAMP_SURFACE_ANGLE) * scaledZ
    };
  }
  const rotatedLocal = rotateYaw(localPoint, tileYaw);
  return {
    x: (Number(tile?.x) || 0) * CELL_SIZE + rotatedLocal.x,
    z: -((Number(tile?.z) || 0) * CELL_SIZE) + rotatedLocal.z,
    y: (Number(tile?.y) || 0) * LEVEL_HEIGHT + rotatedLocal.y
  };
}

function distance2d(first, second) {
  return Math.hypot((first?.x || 0) - (second?.x || 0), (first?.z || 0) - (second?.z || 0));
}

function scorePoints(value, attempt = 1) {
  if (typeof value === "number") return Number(value) || 0;
  if (!value || typeof value !== "object") return 0;
  const attempts = value.attempt_points || value.attemptPoints || [];
  const attemptRule = value.attempts?.[attempt - 1];
  const attemptPoints = attempts[attempt - 1] ?? attemptRule?.points;
  return (Number(value.points) || 0) + (Number(attemptPoints) || 0);
}

function scoreMultiplier(value, attempt = 1) {
  if (!value || typeof value !== "object") return 1;
  const attempts = value.attempt_multipliers || value.attemptMultipliers || [];
  const attemptRule = value.attempts?.[attempt - 1];
  const base = value.multiplier == null ? 1 : Number.isFinite(Number(value.multiplier)) ? Number(value.multiplier) : 1;
  const selected = attempts[attempt - 1] ?? attemptRule?.multiplier;
  const attemptMultiplier = selected == null ? 1 : Number.isFinite(Number(selected)) ? Number(selected) : 1;
  return base * attemptMultiplier;
}

function endGoalLopPenaltyScore(value, internalAttempts, attempt, maxPoints) {
  const count = Math.max(0, Math.floor(Number(internalAttempts) || 0));
  const attemptIndex = Math.max(0, Math.floor(Number(attempt) || 1) - 1);
  const cap = Math.max(0, Number(maxPoints) || 0);
  const source = value && typeof value === "object" ? value : { points: Number(value) || 0, multiplier: 1 };
  const sourceAttemptPointsValue = source.attempt_points || source.attemptPoints;
  const sourceAttemptMultipliersValue = source.attempt_multipliers || source.attemptMultipliers;
  const sourceAttemptPoints = Array.isArray(sourceAttemptPointsValue) ? sourceAttemptPointsValue : [];
  const sourceAttemptMultipliers = Array.isArray(sourceAttemptMultipliersValue) ? sourceAttemptMultipliersValue : [];
  const sourceAttemptRules = Array.isArray(source.attempts) ? source.attempts : [];
  const configured = (Number(source.points) || 0) !== 0
    || (Number.isFinite(Number(source.multiplier)) ? Number(source.multiplier) : 1) !== 1
    || sourceAttemptPoints.some((entry) => (Number(entry) || 0) !== 0)
    || sourceAttemptMultipliers.some((entry) => (entry == null ? 1 : Number(entry)) !== 1)
    || sourceAttemptRules.some((entry) => (Number(entry?.points) || 0) !== 0 || (entry?.multiplier == null ? 1 : Number(entry.multiplier)) !== 1);
  const adjusted = {
    ...source,
    points: (Number(source.points) || 0) * count,
    multiplier: Math.pow(source.multiplier == null || !Number.isFinite(Number(source.multiplier)) ? 1 : Number(source.multiplier), count)
  };
  if (Math.abs(adjusted.points) > cap) adjusted.points = -cap;

  const attemptPointsKey = Array.isArray(source.attempt_points) ? "attempt_points" : Array.isArray(source.attemptPoints) ? "attemptPoints" : null;
  if (attemptPointsKey) {
    adjusted[attemptPointsKey] = [...source[attemptPointsKey]];
    if (attemptIndex < adjusted[attemptPointsKey].length) adjusted[attemptPointsKey][attemptIndex] = (Number(adjusted[attemptPointsKey][attemptIndex]) || 0) * count;
  }
  const attemptMultipliersKey = Array.isArray(source.attempt_multipliers) ? "attempt_multipliers" : Array.isArray(source.attemptMultipliers) ? "attemptMultipliers" : null;
  if (attemptMultipliersKey) {
    adjusted[attemptMultipliersKey] = [...source[attemptMultipliersKey]];
    if (attemptIndex < adjusted[attemptMultipliersKey].length) {
      const selected = adjusted[attemptMultipliersKey][attemptIndex];
      adjusted[attemptMultipliersKey][attemptIndex] = Math.pow(selected == null || !Number.isFinite(Number(selected)) ? 1 : Number(selected), count);
    }
  }
  if (Array.isArray(source.attempts)) {
    adjusted.attempts = source.attempts.map((entry, index) => {
      if (index !== attemptIndex || !entry || typeof entry !== "object") return entry;
      const selectedMultiplier = entry.multiplier == null || !Number.isFinite(Number(entry.multiplier)) ? 1 : Number(entry.multiplier);
      return {
        ...entry,
        points: entry.points == null ? entry.points : (Number(entry.points) || 0) * count,
        multiplier: Math.pow(selectedMultiplier, count)
      };
    });
  }
  return {
    points: scorePoints(adjusted, attemptIndex + 1),
    multiplier: scoreMultiplier(adjusted, attemptIndex + 1),
    internalAttempts: count,
    maxPoints: cap,
    configured
  };
}

function scaledScorePoints(value, attempt = 1, scale = 1) {
  return scorePoints(value, attempt) * Math.max(1, Math.round(Number(scale) || 1));
}

function scaledScoreMultiplier(value, attempt = 1, scale = 1) {
  return Math.pow(scoreMultiplier(value, attempt), Math.max(1, Math.round(Number(scale) || 1)));
}

function directionBetween(first, second) {
  if (!first || !second) return "unknown";
  const dx = Number(second.x) - Number(first.x);
  const dz = Number(second.z) - Number(first.z);
  if (Math.abs(dx) >= Math.abs(dz) && dx > 0) return "east";
  if (Math.abs(dx) >= Math.abs(dz) && dx < 0) return "west";
  if (dz > 0) return "south";
  if (dz < 0) return "north";
  return "same";
}

export function rescuePointLocalFrame(object = {}) {
  const position = object.position || {};
  const scale = object.scale || {};
  const objectScale = {
    x: Number(scale.x) || 1,
    y: Number(scale.y) || 1,
    z: Number(scale.z) || 1
  };
  // Keep this in the rendered local frame: Arena Z is mirrored and Unity Y
  // rotation is negated by arenaLocalRotation in ThreeStage.
  const objectYaw = -((Number(object.rotation?.y) || 0) * Math.PI) / 180;
  const anchor = rotateYaw({
    x: RESCUE_POINT_SOURCE_ANCHOR.x * objectScale.x,
    y: 0,
    z: RESCUE_POINT_SOURCE_ANCHOR.z * objectScale.z
  }, objectYaw);
  return {
    position: { x: Number(position.x) || 0, y: Number(position.y) || 0, z: -(Number(position.z) || 0) },
    scale: objectScale,
    objectYaw,
    anchor
  };
}

export function rescueTriggerOffsets(scaleX = 1, scaleZ = 1) {
  const fullWidth = CELL_SIZE * Math.abs(Number(scaleX) || 1);
  const fullDepth = CELL_SIZE * Math.abs(Number(scaleZ) || 1);
  const width = RESCUE_TRIGGER_WIDTH * Math.abs(Number(scaleX) || 1);
  const depth = RESCUE_TRIGGER_DEPTH * Math.abs(Number(scaleZ) || 1);
  return {
    offsetX: -(fullWidth - width) / 2,
    // The source triangle's right-angle corner is (-X,-Z). Keep that corner
    // fixed while the 90% trigger grows inward along both catheti.
    offsetZ: -(fullDepth - depth) / 2
  };
}

function rescueTriggerProjection(tile = {}, object = {}) {
  const frame = rescuePointLocalFrame(object);
  const tileYaw = -((Number(tile.rotation) || 0) * Math.PI) / 180;
  const local = { x: frame.position.x + frame.anchor.x, y: 0, z: frame.position.z + frame.anchor.z };
  const tileOrigin = { x: (Number(tile.x) || 0) * CELL_SIZE, z: -((Number(tile.z) || 0) * CELL_SIZE) };
  const rotatedLocal = rotateYaw(local, tileYaw);
  const offsets = rescueTriggerOffsets(frame.scale.x, frame.scale.z);
  return {
    center: {
      x: tileOrigin.x + rotatedLocal.x,
      y: (Number(tile.y) || 0) * LEVEL_HEIGHT + frame.position.y + RESCUE_POINT_FLOOR_OFFSET,
      z: tileOrigin.z + rotatedLocal.z
    },
    width: RESCUE_TRIGGER_WIDTH * Math.abs(frame.scale.x),
    depth: RESCUE_TRIGGER_DEPTH * Math.abs(frame.scale.z),
    height: RESCUE_TRIGGER_HEIGHT * Math.abs(frame.scale.y),
    offsetX: offsets.offsetX,
    offsetZ: offsets.offsetZ,
    rotationY: ((tileYaw + frame.objectYaw) * 180) / Math.PI,
    triangleOrientation: "source"
  };
}

export function checkpointProjectionForPath(occurrences = []) {
  return occurrences.flatMap((occurrence, index) => {
    if (!occurrence?.checkpoint) return [];
    const next = occurrences[index + 1] || null;
    const previous = occurrences[index - 1] || null;
    const target = next || occurrence;
    const source = next ? occurrence : previous;
    return [{
      id: `${occurrence.tileId || "tile"}:checkpoint:${index}`,
      tileId: occurrence.tileId,
      occurrenceIndex: Number(occurrence.index ?? index),
      direction: directionBetween(source, target),
      from: source ? { x: source.x, y: source.y || 0, z: source.z } : null,
      to: target ? { x: target.x, y: target.y || 0, z: target.z } : null
    }];
  });
}

function objectRadius(object = {}) {
  if (object.type === "box" && object.boxRuntime) return Math.max(0.7, Math.max(Number(object.boxRuntime.width) || 0, Number(object.boxRuntime.depth) || 0) / 2);
  const scale = object.scale || {};
  const largest = Math.max(Math.abs(Number(scale.x) || 1), Math.abs(Number(scale.z) || 1));
  if (object.type === "liveVictim" || object.type === "deadVictim") return Math.max(0.65, largest * 0.82);
  if (object.type === "rescueKit") return Math.max(0.55, largest * 0.62);
  if (object.type === "seesaw") return 3.5;
  return Math.max(0.7, largest * 1.3);
}

function axisVector(axis) {
  const vectors = {
    "+X": { x: 1, y: 0, z: 0 },
    "-X": { x: -1, y: 0, z: 0 },
    "+Y": { x: 0, y: 1, z: 0 },
    "-Y": { x: 0, y: -1, z: 0 },
    "+Z": { x: 0, y: 0, z: 1 },
    "-Z": { x: 0, y: 0, z: -1 }
  };
  return vectors[axis] || null;
}

function cross(first, second) {
  return {
    x: first.y * second.z - first.z * second.y,
    y: first.z * second.x - first.x * second.z,
    z: first.x * second.y - first.y * second.x
  };
}

function add(first, second) {
  return { x: first.x + second.x, y: first.y + second.y, z: first.z + second.z };
}

function scaleVector(value, factor) {
  return { x: value.x * factor, y: value.y * factor, z: value.z * factor };
}

function rotateYaw(value, yaw) {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { x: value.x * cos + value.z * sin, y: value.y, z: -value.x * sin + value.z * cos };
}

function mirrorRobotDirection(value) {
  return { x: -value.x, y: value.y, z: value.z };
}

function rotateByQuaternion(q, value) {
  const uv = cross({ x: q.x, y: q.y, z: q.z }, value);
  const uuv = cross({ x: q.x, y: q.y, z: q.z }, uv);
  return {
    x: value.x + 2 * (q.w * uv.x + uuv.x),
    y: value.y + 2 * (q.w * uv.y + uuv.y),
    z: value.z + 2 * (q.w * uv.z + uuv.z)
  };
}

function orientationBasis(orientation = {}) {
  const up = axisVector(orientation.up) || axisVector("+Y");
  const forward = axisVector(orientation.forward) || axisVector("+Z");
  return { right: cross(up, forward), up, forward };
}

function componentName(typeId, names, instanceId, parts) {
  if (typeId === "controller") return COMPONENT_DEFAULT_NAMES.controller;
  if (names?.[instanceId]) return names[instanceId];
  const ordinal = parts.filter((part) => (part.typeId || part.id) === typeId).findIndex((part) => (part.instanceId || part.id) === instanceId) + 1;
  return `${COMPONENT_DEFAULT_NAMES[typeId] || typeId}${ordinal || 1}`;
}

export class SimulationRuntime {
  constructor(input = null) {
    this.physics = null;
    this.buzzerAudioContext = null;
    this.buzzerAudioNodes = new Map();
    if (input) {
      try {
        this.configure(input);
      } catch (error) {
        this.dispose();
        throw error;
      }
    }
  }

  dispose() {
    this.stopAllBuzzerAudio();
    try { void this.buzzerAudioContext?.close?.(); } catch {}
    this.buzzerAudioContext = null;
    this.physics?.dispose?.();
    this.physics = null;
  }

  configure(input = {}) {
    this.stopAllBuzzerAudio();
    this.physics?.dispose?.();
    this.physics = new SimulationPhysics();
    this.input = clone(input);
    this.arenaId = input.arenaId || "";
    this.robotId = input.robotId || "";
    this.programId = input.programId || "";
    this.tiles = Array.isArray(input.tiles) ? clone(input.tiles) : [];
    this.tileById = new Map(this.tiles.map((tile) => [tile.id, tile]));
    this.settings = clone(input.settings || {});
    this.setPath(input.path, input.runtimeConfig);
    this.segmentIndex = 0;
    this.spawnOverride = input.spawnOverride ? clone(input.spawnOverride) : null;
    this.robotDocument = clone(input.robot || {});
    this.robotNames = clone(this.robotDocument.names || {});
    this.robotOrientations = clone(this.robotDocument.orientations || {});
    this.robotRuntime = this.compileRobotRuntime(this.robotDocument);
    this.robotParts = (Array.isArray(this.robotDocument.parts) ? this.robotDocument.parts : []).map((part) => {
      const id = part.instanceId || part.id;
      return {
        ...part,
        parentInstanceId: this.robotDocument.anchors?.[id] || part.parentInstanceId || part.parentId || null,
        orientation: this.robotOrientations[id] || part.orientation || { up: "+Y", forward: "+Z" }
      };
    });
    this.robotPhysicsBlueprint = input.robotPhysicsBlueprint || null;
    this.arenaObjectColliderBlueprint = input.arenaObjectColliderBlueprint || null;
    this.starterKitSetup = clone(input.starterKitSetup || { enabled: false });
    this.starterKitColliderBlueprint = this.arenaObjectColliderBlueprint?.objects?.[STARTER_RESCUE_KIT_KEY] || null;
    this.componentEntries = this.buildComponentEntries(this.robotDocument);
    this.componentStates = this.createComponentStates();
    this.components = {};
    this.robotJoints = {};
    this.arenaGenerationSeed = String(input.arenaGenerationSeed || input.arenaSeed || "sBotics");
    this.environmentSeed = String(input.environmentSeed || generateRuntimeSeed());
    this.seed = this.environmentSeed;
    this.localSimulation = input.localSimulation !== false;
    this.lastRobotSpawnElevation = 0;
    this.resetBeforeStart = input.resetBeforeStart === true;
    this.status = "idle";
    this.started = false;
    this.time = 0;
    this.elapsedTime = 0;
    this.attemptTime = 0;
    this.tickCount = 0;
    this.accumulator = 0;
    this.physicsAccumulator = 0;
    this.physicsTickCount = 0;
    this.attempt = Math.max(1, Number(input.attempt) || 1);
    this.events = [];
    this.eventSequence = 0;
    this.visualReplayRecorder = null;
    this.visualReplayCameraProvider = null;
    this.visualReplayPendingKind = null;
    this.visualReplayLastTick = -1;
    this.pathIndex = 0;
    this.currentTileId = null;
    this.lastPhysicalTileId = null;
    this.lastScoredOccurrence = -1;
    this.scoredExitOccurrences = new Set();
    this.enteredOccurrences = new Set();
    this.visitedOccurrences = [];
    this.deviationCount = 0;
    this.pathSkipCount = 0;
    this.skippedOccurrences = [];
    this.pathAttempt = 0;
    this.advanceCount = 0;
    this.totalInternalAttempts = 0;
    this.advancePenaltySecondsApplied = 0;
    this.stalledSeconds = 0;
    this.endGoalStableSeconds = 0;
    this.lackOfProgress = { phase: "idle", remainingSeconds: 0, reasonKey: "" };
    this.lackOfProgressLatched = false;
    this.lackOfProgressFailureUntil = 0;
    this.lastRobotPosition = { x: 0, z: 0 };
    this.manualCommand = null;
    this.manualMotionActive = false;
    this.manualBlockedNoticeShown = false;
    this.scoreCents = 0;
    this.baseScoreCents = 0;
    this.multiplier = 1;
    this.rescuedVictimIds = new Set();
    this.sensors = { color: "baseplate", luminosity: 0, ultrasonic: -1, touch: false, cameraFrame: 0 };
    this.motors = { left: 0, right: 0 };
    this.trackingStatus = this.pathStatus === "valid" ? "notStarted" : "outOfPath";
    this.robot = robotSpawnPose(this.spawnRobot(), { ...this.robotDocument, parts: this.robotParts }, this.robotPhysicsBlueprint);
    this.pathIndex = this.nearestPathIndex();
    this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
    this.lastScoredOccurrence = this.spawnOverride && this.pathIndex > 0 ? this.pathIndex - 1 : -1;
    this.gameStoppers = this.buildGameStoppers();
    this.objects = this.buildObjects();
    this.physics.build({
      tiles: this.tiles,
      objects: this.objects,
      robot: this.robot,
      robotParts: this.robotParts,
      robotDocument: { ...this.robotDocument, parts: this.robotParts },
      robotPhysicsBlueprint: this.robotPhysicsBlueprint,
      arenaObjectColliderBlueprint: this.arenaObjectColliderBlueprint
    });
    this.physics.commandRobotJoints({ locked: true });
    this.physics.bootstrap();
    this.syncRobotFromPhysics();
    this.robotJoints = this.physics.robotJointStates();
    this.currentTileId = this.arenaTileUnderRobot();
    this.lastPhysicalTileId = this.currentTileId;
    this.alignPathIndexToCurrentTile();
    this.updateComponentReadings();
    this.lastEvent = null;
    this.emit("runtime-configured", { arenaGenerationSeed: this.arenaGenerationSeed, environmentSeed: this.environmentSeed });
    this.lastRobotPosition = { x: this.robot.x, z: this.robot.z };
    return this.snapshot();
  }

  setPath(path = {}, runtimeConfig = this.runtimeConfig || {}) {
    const definition = path || {};
    this.input = { ...(this.input || {}), path: clone(definition), runtimeConfig: clone(runtimeConfig || {}) };
    this.path = clone(definition.occurrences || []);
    this.pathIndicesByTileId = new Map();
    this.path.forEach((occurrence, index) => {
      const indexes = this.pathIndicesByTileId.get(occurrence.tileId) || [];
      indexes.push(index);
      this.pathIndicesByTileId.set(occurrence.tileId, indexes);
    });
    this.pathSegments = pathTracksForOccurrences(this.path);
    this.pathEnabled = this.settings.path_arena !== false;
    this.pathStatus = this.pathEnabled ? definition.status || "invalid" : "disabled";
    this.runtimeConfig = clone(runtimeConfig || {});
    this.spawnPolicy = this.runtimeConfig.path?.spawnPolicy || (this.pathStatus === "valid" ? "path-start" : "fallback-first-tile");
  }

  compileRobotRuntime(robot = {}) {
    const parts = Array.isArray(robot.parts) ? clone(robot.parts) : [];
    const topology = compileRobotGroups({ ...robot, parts });
    return {
      id: robot.id || this.robotId,
      partCount: parts.length,
      groups: topology.groups.map(({ id, partIds, rootPartId, parentGroupId, jointPartId }) => ({ id, partIds, rootPartId, parentGroupId, jointPartId }))
    };
  }

  buildComponentEntries(robot = {}) {
    const parts = Array.isArray(robot.parts) ? robot.parts : [];
    return parts.flatMap((part) => {
      const typeId = part.typeId || part.id;
      const instanceId = part.instanceId || part.id;
      if (!instanceId || !COMPONENT_TYPE_IDS.has(typeId)) return [];
      return [{
        id: instanceId,
        instanceId,
        typeId,
        name: componentName(typeId, robot.names || {}, instanceId, parts),
        part: clone(part),
        orientation: clone(robot.orientations?.[instanceId] || { up: "+Y", forward: "+Z" })
      }];
    });
  }

  createComponentStates() {
    return new Map(this.componentEntries.map((entry) => {
      const base = { id: entry.id, typeId: entry.typeId, name: entry.name };
      if (entry.typeId === "light") return [entry.id, { ...base, lit: false, color: { r: 65, g: 70, b: 144 }, lampBrightness: 100 }];
      if (entry.typeId === "buzzer") return [entry.id, { ...base, playing: false, frequencyHz: 50, wave: "square", audioAvailable: true }];
      if (entry.typeId === "pen") return [entry.id, { ...base, working: false, color: { r: 255, g: 128, b: 0 }, trailPoints: [], trailSegments: 0 }];
      return [entry.id, base];
    }));
  }

  startBuzzerAudio(componentId, state) {
    const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextCtor) return false;
    try {
      this.stopBuzzerAudio(componentId);
      this.buzzerAudioContext ||= new AudioContextCtor();
      const context = this.buzzerAudioContext;
      if (context.state === "suspended") void context.resume().catch(() => {});
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.connect(context.destination);
      let source;
      if (state.wave === "noise") {
        const frameCount = Math.max(1, Math.floor(context.sampleRate));
        const buffer = context.createBuffer(1, frameCount, context.sampleRate);
        const channel = buffer.getChannelData(0);
        for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
        source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.value = Math.max(0.05, state.frequencyHz / 50);
      } else {
        source = context.createOscillator();
        source.type = state.wave === "sawtooth" ? "sawtooth" : "square";
        source.frequency.setValueAtTime(state.frequencyHz, context.currentTime);
      }
      source.connect(gain);
      source.start();
      this.buzzerAudioNodes.set(componentId, { source, gain });
      return true;
    } catch {
      this.stopBuzzerAudio(componentId);
      return false;
    }
  }

  stopBuzzerAudio(componentId) {
    const nodes = this.buzzerAudioNodes.get(componentId);
    if (!nodes) return;
    this.buzzerAudioNodes.delete(componentId);
    try { nodes.source.stop(); } catch {}
    try { nodes.source.disconnect(); } catch {}
    try { nodes.gain.disconnect(); } catch {}
  }

  stopAllBuzzerAudio() {
    [...(this.buzzerAudioNodes?.keys?.() || [])].forEach((id) => this.stopBuzzerAudio(id));
  }

  componentFrame(entry) {
    const position = entry.part.position || entry.part.gridPosition || { x: 0, y: 0, z: 0 };
    const physicsFrame = this.physics?.robotPartFrame?.(entry.id);
    const robotOrigin = physicsFrame?.origin || { x: this.robot.x, y: this.robot.y, z: this.robot.z };
    const partOffset = rotateYaw({
      x: -(Number(position.x) || 0) * ROBOT_WORLD_SCALE,
      y: (Number(position.y) || 0) * ROBOT_WORLD_SCALE,
      z: (Number(position.z) || 0) * ROBOT_WORLD_SCALE
    }, this.robot.yaw);
    const origin = physicsFrame?.origin || add(robotOrigin, partOffset);
    const basis = orientationBasis(physicsFrame?.orientation || entry.orientation);
    const localDirection = (local) => add(add(scaleVector(basis.right, local.x), scaleVector(basis.up, local.y)), scaleVector(basis.forward, local.z));
    const direction = (local) => {
      const mirrored = mirrorRobotDirection(localDirection(local));
      return physicsFrame?.groupRotation
        ? rotateByQuaternion(physicsFrame.groupRotation, mirrored)
        : rotateYaw(mirrored, this.robot.yaw);
    };
    return {
      origin,
      basis,
      point: (local) => add(origin, direction(local)),
      direction
    };
  }

  componentNoise(componentId, channel, amplitude) {
    return (randomUnit(this.environmentSeed, `component:${componentId}:${channel}:attempt:${this.attempt}:tick:${this.physicsTickCount || this.tickCount}`) - 0.5) * 2 * amplitude;
  }

  sampleUltrasonic(entry) {
    const frame = this.componentFrame(entry);
    const wedge = entry.typeId === "wedgeUltrasonicSensor";
    const wedgeFrame = wedge ? this.robotPhysicsBlueprint?.parts?.[entry.id]?.sensorRayFrame : null;
    if (wedge && !wedgeFrame) throw new Error(`Wedge Ultrasonic ray frame is unavailable for ${entry.id}`);
    const centerDirection = wedge ? wedgeFrame.direction : { x: 0, y: 0, z: 1 };
    const rays = [-1, 0, 1].map((offset) => {
      const angle = offset * Math.PI / 180;
      const localOrigin = wedge ? wedgeFrame.origin : { x: 0, y: 0, z: 3.03 };
      const localDirection = {
        x: centerDirection.x * Math.cos(angle) + centerDirection.z * Math.sin(angle),
        y: centerDirection.y,
        z: centerDirection.z * Math.cos(angle) - centerDirection.x * Math.sin(angle)
      };
      const hit = this.physics?.raycast(
        frame.point({ x: localOrigin.x * SENSOR_SOURCE_SCALE, y: localOrigin.y * SENSOR_SOURCE_SCALE, z: localOrigin.z * SENSOR_SOURCE_SCALE }),
        frame.direction(localDirection),
        32
      );
      const rawDistance = hit?.distance >= 0 ? hit.distance : -1;
      const distance = rawDistance < 0
        ? -1
        : clamp(rawDistance + this.componentNoise(entry.id, `ultrasonic:${offset}`, 0.015), 0, 32);
      return {
        id: offset === 0 ? "center" : offset < 0 ? "left" : "right",
        hit: distance >= 0,
        distance: round(distance),
        colliderKey: hit?.colliderKey || "",
        localOrigin: wedge
          ? { x: localOrigin.x, y: localOrigin.y, z: localOrigin.z }
          : { x: 0, y: 0, z: 3.03 },
        localDirection
      };
    });
    const hitRays = rays.filter((ray) => ray.hit);
    return {
      hit: hitRays.length > 0,
      distance: hitRays.length ? Math.min(...hitRays.map((ray) => ray.distance)) : -1,
      rays
    };
  }

  sampleColor(entry) {
    return {
      sampled: false,
      colorName: "",
      rgb: null,
      seesNonBlack: false,
      luminosity: null
    };
  }

  recordPenTrailPoints() {
    this.componentEntries.forEach((entry) => {
      if (entry.typeId !== "pen") return;
      const state = this.componentStates.get(entry.id);
      if (!state?.working) return;
      const frame = this.componentFrame(entry);
      const point = frame.point({ x: 0, y: 3 * SENSOR_SOURCE_SCALE, z: 0 });
      const previous = state.trailPoints.at(-1);
      if (previous && Math.hypot(point.x - previous.x, point.y - previous.y, point.z - previous.z) < 0.012) return;
      state.trailPoints.push({ x: round(point.x, 4), y: round(point.y, 4), z: round(point.z, 4) });
      if (state.trailPoints.length > PEN_TRAIL_MAX_POINTS) state.trailPoints.splice(0, state.trailPoints.length - PEN_TRAIL_MAX_POINTS);
      state.trailSegments = Math.max(0, state.trailPoints.length - 1);
    });
  }

  sampleTouch(entry) {
    const physicalAnalog = Number(this.physics?.touchSensorAnalog(entry.id));
    const analog = clamp(Number.isFinite(physicalAnalog) ? physicalAnalog : 0, 0, 1);
    const tick = this.physicsTickCount || this.tickCount;
    const noise = environmentNormalSample(
      this.environmentSeed,
      `environment-randomization-v1:touch-analog:${entry.id}:attempt:${this.attempt}:tick:${tick}`
    ) * 0.01;
    return {
      contact: this.physics?.touchSensorContact(entry.id) === true,
      analog: round(clamp(analog + noise, 0, 1), 4)
    };
  }

  sampleComponent(entry) {
    const state = this.componentStates.get(entry.id) || {};
    const typeId = entry.typeId;
    if (typeId === "controller") {
      return {
        inclinationDeg: 0,
        compassDeg: (this.robot.yaw * 180 / Math.PI + 360) % 360,
        speed: Math.abs(this.robot.velocity || 0),
        componentNames: this.componentEntries.filter((item) => item.typeId !== "controller").map((item) => item.name)
      };
    }
    if (typeId === "servo") {
      const joint = this.robotJoints[entry.id] || {};
      return {
        locked: joint.locked !== false,
        angleDeg: Number(joint.angleDeg) || 0,
        velocityDegPerSecond: Number(joint.velocityDegPerSecond) || 0,
        targetDegPerSecond: Number(joint.targetDegPerSecond) || 0
      };
    }
    if (typeId === "ultrasonicSensor" || typeId === "wedgeUltrasonicSensor") return this.sampleUltrasonic(entry);
    if (typeId === "colorSensor" || typeId === "wedgeColorSensor") return this.sampleColor(entry);
    if (typeId === "touchSensor") return this.sampleTouch(entry);
    if (typeId === "light") return { lit: Boolean(state.lit), color: clone(state.color), lampBrightness: clamp(Math.round(Number.isFinite(Number(state.lampBrightness)) ? Number(state.lampBrightness) : 100), 0, 100) };
    if (typeId === "buzzer") return { playing: Boolean(state.playing), frequencyHz: Number(state.frequencyHz) || 50, wave: state.wave || "square", audioAvailable: state.audioAvailable !== false };
    if (typeId === "pen") return { working: Boolean(state.working), color: clone(state.color), trailPoints: clone(state.trailPoints || []), trailSegments: Number(state.trailSegments) || 0 };
    if (typeId === "camera") return { frame: this.physicsTickCount || this.tickCount, width: 128, height: 128, live: true };
    return {};
  }

  updateComponentReadings() {
    this.recordPenTrailPoints();
    this.components = Object.fromEntries(this.componentEntries.map((entry) => [entry.id, {
      id: entry.id,
      typeId: entry.typeId,
      name: entry.name,
      position: clone(entry.part.position || { x: 0, y: 0, z: 0 }),
      orientation: clone(entry.orientation),
      frame: this.tickCount,
      readings: this.sampleComponent(entry)
    }]));
    return this.components;
  }

  componentById(componentId) {
    return this.componentEntries.find((entry) => entry.id === componentId) || null;
  }

  fallbackWaypoints() {
    const source = this.tiles.find((tile) => tile?.emptyTile !== true && tile?.definition?.emptyTile !== true);
    return source ? [worldPoint(source)] : [];
  }

  waypoints() {
    return this.path.length && this.pathStatus === "valid"
      ? this.path.map((occurrence) => worldPoint(occurrence))
      : this.fallbackWaypoints();
  }

  nearestPathIndex(position = this.robot) {
    if (this.pathStatus !== "valid" || !this.path.length) return 0;
    const points = this.waypoints();
    let nearest = 0;
    let nearestDistance = Infinity;
    points.forEach((point, index) => {
      const candidate = distance2d(position, point);
      if (candidate < nearestDistance) { nearestDistance = candidate; nearest = index; }
    });
    return nearest;
  }

  arenaTileUnderRobot() {
    const hit = this.physics?.raycast(
      { x: this.robot?.x || 0, y: this.robot?.y || 0, z: this.robot?.z || 0 },
      { x: 0, y: -1, z: 0 },
      500,
      (key) => key.includes(":floor:") || key.includes(":ramp:")
    );
    if (!hit?.colliderKey) return null;
    return this.tiles.find((tile) => tile.id && hit.colliderKey.startsWith(`${tile.id}:`))?.id || null;
  }

  alignPathIndexToCurrentTile() {
    if (this.pathStatus !== "valid" || !this.currentTileId) return false;
    const candidates = this.pathIndicesByTileId.get(this.currentTileId) || [];
    if (!candidates.length) return false;
    const preferred = this.pathIndex;
    const selected = candidates.reduce((best, index) => Math.abs(index - preferred) < Math.abs(best - preferred) ? index : best, candidates[0]);
    this.pathIndex = selected;
    this.segmentIndex = this.segmentIndexForOccurrence(selected);
    if (this.spawnOverride && selected > 0) this.lastScoredOccurrence = selected - 1;
    return true;
  }

  nextOccurrenceForTile(tileId, afterIndex = this.pathIndex) {
    const candidates = this.pathIndicesByTileId.get(tileId) || [];
    return candidates.find((index) => index > afterIndex) ?? -1;
  }

  isRescueZoneOccurrence(index) {
    const tile = this.tileById.get(this.path[index]?.tileId);
    return tile?.flags?.rescueZone === true || tile?.definition?.flags?.rescueZone === true;
  }

  rescueZoneRunEnd(startIndex) {
    let end = startIndex;
    while (end + 1 < this.path.length && this.isRescueZoneOccurrence(end + 1)) end += 1;
    return end;
  }

  rescueZoneRunForTile(tileId) {
    const physicalTile = this.tileById.get(tileId);
    if (physicalTile?.flags?.rescueZone !== true && physicalTile?.definition?.flags?.rescueZone !== true) return null;
    if (this.isRescueZoneOccurrence(this.pathIndex)) {
      let start = this.pathIndex;
      while (start > 0 && this.isRescueZoneOccurrence(start - 1)) start -= 1;
      return { start, end: this.rescueZoneRunEnd(start) };
    }
    const start = this.pathIndex + 1;
    if (!this.isRescueZoneOccurrence(start)) return null;
    const end = this.rescueZoneRunEnd(start);
    return this.path.slice(start, end + 1).some((occurrence) => occurrence.tileId === tileId) ? { start, end } : null;
  }

  pathSizeForCheckpoint(index) {
    let previousCheckpoint = -1;
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      if (this.path[cursor]?.checkpoint) {
        previousCheckpoint = cursor;
        break;
      }
    }
    if (previousCheckpoint < 0) return 1;
    const rescueTiles = this.path.slice(previousCheckpoint + 1, index + 1)
      .filter((occurrence) => {
        const tile = this.tileById.get(occurrence.tileId);
        return tile?.flags?.rescueZone === true || tile?.definition?.flags?.rescueZone === true;
      }).length;
    return Math.max(1, (index - previousCheckpoint) - Math.max(0, rescueTiles - 1));
  }

  scorePathRules(rules, reason, detail = {}) {
    const attempt = this.pathAttempt + 1;
    let points = 0;
    let multiplier = 1;
    const inputs = [];
    rules.forEach((rule, index) => {
      const scale = Math.max(1, Math.round(Number(rule.scale) || 1));
      const basePoints = scorePoints(rule.score, attempt);
      const rulePoints = scaledScorePoints(rule.score, attempt, scale);
      const ruleMultiplier = scaledScoreMultiplier(rule.score, attempt, scale);
      inputs.push({
        component: rule.component || `score-input-${index + 1}`,
        attempt,
        basePoints: round(basePoints, 2),
        scale,
        points: round(rulePoints, 2),
        multiplier: ruleMultiplier
      });
      points += rulePoints;
      multiplier *= ruleMultiplier;
      this.awardScore(rulePoints, ruleMultiplier, reason, {
        ...detail,
        pathAttempt: this.pathAttempt,
        scoreComponent: rule.component || `score-input-${index + 1}`,
        scoreBasePoints: round(basePoints, 2),
        scoreScale: scale
      });
    });
    return { points, multiplier, inputs };
  }

  scoreTileExit(index, source) {
    if (index < 0 || index >= this.path.length || this.scoredExitOccurrences.has(index) || !this.enteredOccurrences.has(index)) return null;
    const occurrence = this.path[index];
    const tile = this.tileById.get(occurrence.tileId);
    if (!tile) return null;
    const rules = [{ score: tile.exitScore, component: "tile-exit" }];
    if (tile.flags?.checkpoint === true && !occurrence.checkpointAccepted) {
      rules.push({ score: this.runtimeConfig.scoring?.pathSizeExit, scale: this.pathSizeForCheckpoint(index), component: "path-size-checkpoint-exit" });
    }
    if (arenaTileIsRamp(tile)) rules.push({ score: this.runtimeConfig.scoring?.rampExit, component: "ramp-exit" });
    if (occurrence.checkpointAccepted) rules.push({ score: this.runtimeConfig.scoring?.checkpointExit, component: "placed-checkpoint-exit" });
    const result = this.scorePathRules(rules, "tile-exit", { tileId: occurrence.tileId, occurrenceIndex: index, pathAttempt: this.pathAttempt, pathSegment: this.segmentIndex + 1, pathTotal: this.pathSegments.length, source });
    this.scoredExitOccurrences.add(index);
    this.emit("tile-exit", { tileId: occurrence.tileId, index, source, pathAttempt: this.pathAttempt, pathSegment: this.segmentIndex + 1, pathTotal: this.pathSegments.length, points: round(result.points, 2), scoreInputs: result.inputs, checkpoint: Boolean(occurrence.checkpoint), ramp: arenaTileIsRamp(tile) });
    return result;
  }

  lackOfProgressSeconds(short = true) {
    const key = short ? "short_lack_of_progress_time" : "long_lack_of_progress_time";
    const configured = Number(this.settings[key]);
    if (Number.isFinite(configured)) return Math.max(0, configured);
    return short ? 10 : 30;
  }

  requestLackOfProgress(reasonKey, seconds) {
    if (this.settings.lack_of_progress !== true || this.lackOfProgressLatched) return;
    const duration = Math.max(0, Number(seconds) || 0);
    const current = this.lackOfProgress;
    if (current.phase === "failure") return;
    if (current.phase === "countdown" && duration >= current.remainingSeconds - 1e-9) return;
    const severity = reasonKey === "routineLackProgressReasonOutOfLine" ? "long" : "short";
    this.lackOfProgress = { phase: "countdown", remainingSeconds: duration, durationSeconds: duration, reasonKey, severity };
    this.emit("lack-of-progress-start", { reason: reasonKey, seconds: duration });
  }

  clearLackOfProgress() {
    if (this.lackOfProgress.phase === "failure") return;
    this.lackOfProgress = { phase: "idle", remainingSeconds: 0, reasonKey: "", severity: "" };
    this.lackOfProgressLatched = false;
  }

  applyRescueSegmentMultiplierPenalty() {
    if (this.settings.use_rescue_checkpoint_lack_of_progress_penalty !== true || this.pathStatus !== "valid") return false;
    const penalty = Number(this.settings.rescue_checkpoint_lack_of_progress_penalty);
    if (!Number.isFinite(penalty) || penalty <= 0) return false;

    const segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
    const segment = this.currentPathSegment(segmentIndex);
    if (!segment) return false;
    const nextSegment = this.currentPathSegment(segmentIndex + 1);
    const intervalStart = segment.checkpointOccurrence ?? segment.startOccurrence;
    // Unity PathHasRescue includes the next checkpoint in this interval.
    const intervalEnd = nextSegment?.checkpointOccurrence ?? segment.endOccurrence;
    const containsRescue = this.path.slice(intervalStart, intervalEnd + 1)
      .some((_, offset) => this.isRescueZoneOccurrence(intervalStart + offset));
    if (!containsRescue) return false;

    const previousMultiplier = this.multiplier;
    this.multiplier = round(Math.max(1, previousMultiplier - penalty), 6);
    this.refreshScoreTotal();
    this.emit("rescue-segment-multiplier-penalty", {
      penalty: round(penalty, 6),
      previousMultiplier: round(previousMultiplier, 6),
      totalMultiplier: this.multiplier,
      pathSegment: segmentIndex + 1,
      pathTotal: this.pathSegments.length,
      pathAttempt: this.pathAttempt,
      occurrenceIndex: this.pathIndex,
      tileId: this.path[this.pathIndex]?.tileId || null
    });
    return true;
  }

  advanceLackOfProgress(delta) {
    if (this.settings.lack_of_progress !== true) {
      this.clearLackOfProgress();
      return;
    }
    if (this.lackOfProgress.phase !== "countdown" || this.lackOfProgressLatched) return;
    const remainingSeconds = Math.max(0, this.lackOfProgress.remainingSeconds - delta);
    if (remainingSeconds > 1e-9) {
      this.lackOfProgress = { ...this.lackOfProgress, remainingSeconds };
      return;
    }
    const reasonKey = this.lackOfProgress.reasonKey || LACK_OF_PROGRESS_FAILURE_REASON;
    const seconds = this.lackOfProgress.durationSeconds ?? this.lackOfProgress.remainingSeconds;
    this.lackOfProgress = { ...this.lackOfProgress, phase: "failure", remainingSeconds: 0, reasonKey };
    this.lackOfProgressLatched = true;
    this.lackOfProgressFailureUntil = this.time + LACK_OF_PROGRESS_FAILURE_DISPLAY_SECONDS;
    this.emit("lack-of-progress", { seconds: round(seconds), reason: reasonKey });
    if (this.settings.force_advance === true) {
      this.applyRescueSegmentMultiplierPenalty();
      this.advance();
    }
  }

  segmentIndexForOccurrence(index = this.pathIndex) {
    if (!this.pathSegments.length) return 0;
    const numericIndex = clamp(Math.round(Number(index) || 0), 0, Math.max(0, this.path.length - 1));
    const segment = this.pathSegments.find((candidate) => numericIndex >= candidate.startOccurrence && numericIndex <= candidate.endOccurrence);
    return segment?.segmentIndex ?? this.pathSegments.length - 1;
  }

  currentPathSegment(index = this.segmentIndex) {
    const numericIndex = Math.round(Number(index));
    return Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < this.pathSegments.length
      ? this.pathSegments[numericIndex]
      : null;
  }

  segmentStartOccurrence(index = this.segmentIndex) {
    return this.currentPathSegment(index)?.startOccurrence ?? 0;
  }

  spawnRobot(occurrenceIndex = null, { useOverride = true } = {}) {
    const points = this.waypoints();
    const explicitPoint = Number.isInteger(occurrenceIndex) ? points[occurrenceIndex] : null;
    if (explicitPoint) {
      const next = points[Math.min(occurrenceIndex + 1, points.length - 1)] || explicitPoint;
      return {
        ...explicitPoint,
        groundY: (Number(explicitPoint.y) || ROBOT_SURFACE_HEIGHT) - ROBOT_SURFACE_HEIGHT + ROBOT_GROUND_SURFACE_OFFSET,
        yaw: Math.atan2(next.x - explicitPoint.x, next.z - explicitPoint.z),
        velocity: 0,
        angularVelocity: 0,
        fullyStopped: true,
        grounded: true
      };
    }
    return robotSpawnPreviewPose({
      path: this.path,
      pathStatus: this.pathStatus,
      tiles: this.tiles,
      spawnOverride: useOverride ? this.spawnOverride : null
    });
  }

  resolveRandomVictimPosition(tile, object, attempt = this.attempt) {
    const position = object.position || {};
    if (object.positionRandom !== true) return worldObjectPoint(tile, position);
    const x = -3.25 + randomUnit(this.environmentSeed, `victim:${tile.id}:${object.id}:x:${attempt}`) * 6.5;
    const z = -3.25 + randomUnit(this.environmentSeed, `victim:${tile.id}:${object.id}:z:${attempt}`) * 6.5;
    return worldObjectPoint(tile, { ...position, x, z });
  }

  buildGameStoppers() {
    return this.tiles
      .filter((tile) => tile?.flags?.endGoal || tile?.definition?.flags?.endGoal)
      .map((tile) => ({
        id: `${tile.id}:game-stopper`,
        tileId: tile.id,
        position: worldPoint(tile),
        radius: GAME_STOPPER_RADIUS,
        height: GAME_STOPPER_HEIGHT,
        triggerOnly: true,
        visible: false
      }));
  }

  finalGameStopperOverlaps() {
    const finalOccurrence = this.path[this.path.length - 1];
    if (!finalOccurrence || this.pathIndex !== this.path.length - 1) return false;
    return this.gameStoppers.some((stopper) => stopper.tileId === finalOccurrence.tileId && distance2d(this.robot, stopper.position) <= stopper.radius);
  }

  buildObjects() {
    const objects = this.tiles.flatMap((tile) => (tile.objects || []).map((source, index) => {
      const object = clone(source || {});
      const key = `${tile.id}:${object.id || `object-${index + 1}`}`;
      const sourcePosition = this.resolveRandomVictimPosition(tile, object);
      const boxRuntime = object.type === "box" ? resolveBoxRuntime(object, key, this.environmentSeed) : null;
      const colliderBlueprint = this.arenaObjectColliderBlueprint?.objects?.[key] || null;
      const position = boxRuntime
        ? { ...sourcePosition, y: sourcePosition.y + boxRuntime.height / 2 }
        : sourcePosition;
      const blueprintPosition = colliderBlueprint?.bodyPosition
        ? { x: colliderBlueprint.bodyPosition[0], y: colliderBlueprint.bodyPosition[1], z: colliderBlueprint.bodyPosition[2] }
        : null;
      const runtimePositionOwnsPose = ["box", "liveVictim", "deadVictim"].includes(object.type);
      const mass = Number(object.mass) || 0;
      const dynamic = dynamicTypes.has(object.type) && (mass > 0 || (mass === 0 && prefabDynamicTypes.has(object.type)));
      return {
        key,
        tileId: tile.id,
        id: object.id || `object-${index + 1}`,
        type: object.type || "none",
        label: object.label || object.id || object.type || "object",
        evacuationRole: object.evacuationRole || "",
        evacuationBonus: clone(object.evacuationBonus || {}),
        rescueScore: clone(object.rescueScore || 0),
        mass,
        dynamic,
        resetEveryAttempt: object.resetEveryAttempt !== false,
        position: { ...position },
        initialPosition: { ...position },
        physicsPosition: !runtimePositionOwnsPose && blueprintPosition ? blueprintPosition : { ...position },
        rotation: colliderBlueprint?.bodyRotation || null,
        physicsRotation: colliderBlueprint?.bodyRotation || null,
        initialPhysicsRotation: colliderBlueprint?.bodyRotation || null,
        physicsScale: boxRuntime
          ? [boxRuntime.width, boxRuntime.height, boxRuntime.depth]
          : colliderBlueprint?.bodyScale || [Number(object.scale?.x) || 1, Number(object.scale?.y) || 1, Number(object.scale?.z) || 1],
        colliderBlueprint,
        scale: { x: Number(object.scale?.x) || 1, y: Number(object.scale?.y) || 1, z: Number(object.scale?.z) || 1 },
        velocity: { x: 0, y: 0, z: 0 },
        visible: true,
        rescued: false,
        resolved: false,
        resolution: "active",
        colliderRadius: collisionTypes.has(object.type) ? objectRadius({ ...object, boxRuntime }) : ["liveVictim", "deadVictim", "rescueKit"].includes(object.type) ? objectRadius(object) : 0,
        seesawAngle: object.type === "seesaw" ? SEESAW_PROFILE.initialAngleRadians : 0,
        boxRuntime,
        rescueTrigger: object.type === "evacuationPoint" && (tile.definition?.sourceArena || tile.sourceArena)
          ? rescueTriggerProjection(tile, object)
          : null,
        source: object
      };
    }));
    return objects;
  }

  setStarterKitSetup(setup = { enabled: false }, arenaObjectColliderBlueprint = this.arenaObjectColliderBlueprint) {
    this.starterKitSetup = clone(setup || { enabled: false });
    this.arenaObjectColliderBlueprint = arenaObjectColliderBlueprint || this.arenaObjectColliderBlueprint;
    this.starterKitColliderBlueprint = this.arenaObjectColliderBlueprint?.objects?.[STARTER_RESCUE_KIT_KEY] || null;
    this.input = { ...(this.input || {}), starterKitSetup: clone(this.starterKitSetup), arenaObjectColliderBlueprint: this.arenaObjectColliderBlueprint };
  }

  setEnvironmentSeed(seed) {
    const nextSeed = String(seed || generateRuntimeSeed());
    if (nextSeed === this.environmentSeed) return false;
    this.environmentSeed = nextSeed;
    this.seed = nextSeed;
    this.input = { ...(this.input || {}), environmentSeed: nextSeed };
    this.objects = this.objects.map((object) => {
      if (object.type !== "box" || !object.source) return object;
      const boxRuntime = resolveBoxRuntime(object.source, object.key, nextSeed);
      if (JSON.stringify(boxRuntime) === JSON.stringify(object.boxRuntime)) return object;
      const physicsState = this.physics?.state(object.key);
      const currentPosition = physicsState?.position || object.position;
      const previousHeight = Number(object.boxRuntime?.height) || 0;
      const position = {
        ...currentPosition,
        y: (Number(currentPosition?.y) || 0) + ((Number(boxRuntime.height) || 0) - previousHeight) / 2
      };
      const tile = this.tileById.get(object.tileId) || {};
      const anchor = worldObjectPoint(tile, object.source.position || {});
      const nextObject = {
        ...object,
        boxRuntime,
        position,
        physicsPosition: { ...position },
        initialPosition: { ...object.initialPosition, y: anchor.y + (Number(boxRuntime.height) || 0) / 2 },
        physicsScale: [boxRuntime.width, boxRuntime.height, boxRuntime.depth],
        colliderBlueprint: null,
        colliderRadius: objectRadius({ ...object, boxRuntime })
      };
      if (physicsState) {
        nextObject.rotation = physicsState.rotation;
        nextObject.physicsRotation = physicsState.rotation;
        nextObject.velocity = physicsState.velocity;
        nextObject.angularVelocity = physicsState.angularVelocity;
      }
      if (this.physics && !this.physics.replaceRuntimeObjectBody(nextObject, physicsState)) {
        throw new Error(`seeded Box collider is unavailable: ${object.key}`);
      }
      return nextObject;
    });
    return true;
  }

  sampleRobotSpawnElevation(transitionKey) {
    return this.localSimulation
      ? randomUnit(this.environmentSeed, `own-128:robot-spawn:${transitionKey}`) * ROBOT_SPAWN_LIFT_MAX
      : 0;
  }

  removeStarterKitFromRun() {
    const existing = this.objects.find((object) => object.key === STARTER_RESCUE_KIT_KEY);
    if (!existing) return;
    this.physics?.removeRuntimeObject?.(STARTER_RESCUE_KIT_KEY);
    this.objects = this.objects.filter((object) => object.key !== STARTER_RESCUE_KIT_KEY);
  }

  prepareStarterKitForStart() {
    const setup = this.starterKitSetup;
    if (this.settings.start_with_rescue_kit !== true || setup?.enabled !== true || !setup.mount?.position) {
      this.removeStarterKitFromRun();
      return;
    }
    const colliderBlueprint = this.starterKitColliderBlueprint || this.arenaObjectColliderBlueprint?.objects?.[STARTER_RESCUE_KIT_KEY];
    if (!colliderBlueprint?.shapes?.length) throw new Error("starter Rescue Kit source collider is unavailable");
    const mount = {
      position: setup.mount.position,
      rotation: setup.mount.rotation || { x: 0, y: 0, z: 0, w: 1 }
    };
    const pose = this.physics.worldPoseFromRobotRelative(mount, this.robot);
    const tileId = this.path[0]?.tileId || this.tiles[0]?.id || "";
    const kit = {
      key: STARTER_RESCUE_KIT_KEY,
      tileId,
      id: STARTER_RESCUE_KIT_KEY,
      type: "rescueKit",
      label: "Starter Rescue Kit",
      evacuationRole: "",
      evacuationBonus: {},
      rescueScore: this.runtimeConfig.scoring?.starterKit || 0,
      mass: 0.2,
      dynamic: true,
      resetEveryAttempt: false,
      position: { ...pose.position },
      initialPosition: { ...pose.position },
      physicsPosition: { ...pose.position },
      rotation: pose.rotation,
      physicsRotation: pose.rotation,
      initialPhysicsRotation: pose.rotation,
      physicsScale: colliderBlueprint.bodyScale || [STARTER_RESCUE_KIT_SCALE.x, STARTER_RESCUE_KIT_SCALE.y, STARTER_RESCUE_KIT_SCALE.z],
      colliderBlueprint,
      scale: { ...STARTER_RESCUE_KIT_SCALE },
      velocity: { x: 0, y: 0, z: 0 },
      visible: true,
      rescued: false,
      resolved: false,
      resolution: "active",
      colliderRadius: 0.6,
      seesawAngle: 0,
      source: { type: "rescueKit", position: { ...pose.position }, rotation: pose.rotation, returnWithRobot: this.settings.return_rescue_kits_with_robot !== false }
    };
    const existing = this.objects.find((object) => object.key === STARTER_RESCUE_KIT_KEY);
    if (!existing) {
      if (!this.physics.addRuntimeDynamicObject(kit)) throw new Error("starter Rescue Kit source collider is invalid");
      this.objects.push(kit);
      return;
    }
    Object.assign(existing, kit);
    if (!this.physics.setRuntimeObjectPose(STARTER_RESCUE_KIT_KEY, pose.position, pose.rotation)) {
      this.physics.removeRuntimeObject(STARTER_RESCUE_KIT_KEY);
      if (!this.physics.addRuntimeDynamicObject(existing)) throw new Error("starter Rescue Kit source collider is invalid");
    }
  }

  resetRandomVictimPositionsForPlay() {
    this.objects = this.objects.map((object) => {
      if (!object.resetEveryAttempt || object.resolved || !["liveVictim", "deadVictim"].includes(object.type) || object.source?.positionRandom !== true) return object;
      const position = this.resolveRandomVictimPosition(this.tileById.get(object.tileId), object.source, this.attempt);
      const physicsRotation = object.initialPhysicsRotation || object.physicsRotation || object.rotation;
      this.physics?.setRuntimeObjectPose(object.key, position, physicsRotation);
      return { ...object, position, physicsPosition: { ...position }, physicsRotation, rotation: physicsRotation, velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } };
    });
  }

  beginRoutine() {
    this.status = "idle";
    this.started = false;
    this.time = 0;
    this.elapsedTime = 0;
    this.attemptTime = 0;
    this.tickCount = 0;
    this.accumulator = 0;
    this.physicsAccumulator = 0;
    this.physicsTickCount = 0;
    this.attempt = 1;
    this.events = [];
    this.eventSequence = 0;
    this.lastEvent = null;
    this.pathAttempt = 0;
    this.advanceCount = 0;
    this.totalInternalAttempts = 0;
    this.lastRobotSpawnElevation = 0;
    this.advancePenaltySecondsApplied = 0;
    this.baseScoreCents = 0;
    this.scoreCents = 0;
    this.multiplier = 1;
    this.rescuedVictimIds = new Set();
    this.scoredExitOccurrences = new Set();
    this.enteredOccurrences = new Set();
    this.visitedOccurrences = [];
    this.deviationCount = 0;
    this.pathSkipCount = 0;
    this.skippedOccurrences = [];
    this.stalledSeconds = 0;
    this.endGoalStableSeconds = 0;
    this.lackOfProgress = { phase: "idle", remainingSeconds: 0, reasonKey: "" };
    this.lackOfProgressLatched = false;
    this.lackOfProgressFailureUntil = 0;
    this.manualCommand = null;
    this.manualMotionActive = false;
    this.manualBlockedNoticeShown = false;
    this.spawnOverride = null;
    this.resetRandomVictimPositionsForPlay();
    this.physics?.stopRobotManualMovement?.();
    this.physics?.commandRobotJoints?.({ locked: true, targetDegPerSecond: 0 });
    this.syncRobotFromPhysics();
    this.robotJoints = this.physics?.robotJointStates?.() || {};
    this.robot.velocity = 0;
    this.robot.angularVelocity = 0;
    this.robot.fullyStopped = true;
    this.currentTileId = this.arenaTileUnderRobot();
    this.lastPhysicalTileId = this.currentTileId;
    this.alignPathIndexToCurrentTile();
    this.lastScoredOccurrence = this.pathIndex > 0 ? this.pathIndex - 1 : -1;
    this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
    this.trackingStatus = this.pathStatus === "valid" ? "notStarted" : "outOfPath";
    this.lastRobotPosition = { x: this.robot.x, z: this.robot.z };
    this.motors = { left: 0, right: 0 };
    this.updateComponentReadings();
    return this.snapshot();
  }

  start() {
    if (this.status === "paused") return this.snapshot();
    if (["completed", "stopped", "error"].includes(this.status)) this.resetAttempt(this.attempt, { countInternalAttempt: false });
    const starting = !this.started;
    if (starting) {
      const spawnElevation = this.sampleRobotSpawnElevation("play");
      this.lastRobotSpawnElevation = spawnElevation;
      if (this.physics?.applyRobotVerticalOffset(spawnElevation)) this.syncRobotFromPhysics();
      this.prepareStarterKitForStart();
    }
    this.status = "running";
    if (!this.started) {
      this.started = true;
      this.emit("routine-start", { seed: this.environmentSeed, arenaGenerationSeed: this.arenaGenerationSeed, mode: this.programId ? "program" : "manual-debug", spawnElevation: this.lastRobotSpawnElevation });
    } else {
      this.emit("routine-resumed");
    }
    if (this.pathStatus === "valid" && this.path.length) this.updateTracking(0);
    return this.snapshot();
  }

  pause() {
    if (this.status === "running") {
      this.status = "paused";
      this.manualCommand = null;
      this.physics?.stopRobotManualMovement();
      this.manualMotionActive = false;
      this.emit("routine-paused");
    } else if (this.status === "paused") {
      this.status = "running";
      this.emit("routine-resumed");
    }
    return this.snapshot();
  }

  stop(reason = "user") {
    const alreadyTerminal = ["completed", "stopped", "error"].includes(this.status);
    this.stopAllBuzzerAudio();
    this.physics?.commandRobotJoints({ locked: true, targetDegPerSecond: 0 });
    this.componentStates?.forEach((component) => {
      if (component.typeId === "buzzer") component.playing = false;
      if (component.typeId === "light") component.lit = false;
      if (component.typeId === "pen") component.working = false;
    });
    if (alreadyTerminal) {
      this.robotJoints = this.physics?.robotJointStates?.() || {};
      this.updateComponentReadings();
      return this.snapshot();
    }
    this.status = "stopped";
    this.manualCommand = null;
    this.physics?.stopRobotManualMovement();
    this.manualMotionActive = false;
    this.robot.velocity = 0;
    this.robot.angularVelocity = 0;
    this.robot.fullyStopped = true;
    this.robotJoints = this.physics?.robotJointStates?.() || {};
    this.updateComponentReadings();
    this.emit("routine-stopped", { reason });
    return this.snapshot();
  }

  settleStoppedPose() {
    this.physics?.stopRobotManualMovement?.();
    this.physics?.commandRobotJoints?.({ locked: true, targetDegPerSecond: 0 });
    this.syncRobotFromPhysics();
    this.status = "stopped";
    this.manualCommand = null;
    this.manualMotionActive = false;
    this.robot.velocity = 0;
    this.robot.angularVelocity = 0;
    this.robot.fullyStopped = true;
    this.spawnOverride = { ...this.robot };
    this.robotJoints = this.physics?.robotJointStates?.() || {};
    this.currentTileId = this.arenaTileUnderRobot();
    this.lastPhysicalTileId = this.currentTileId;
    this.lastRobotPosition = { x: this.robot.x, z: this.robot.z };
    this.updateComponentReadings();
    return this.snapshot();
  }

  captureRobotContactingRescueKitPoses() {
    const returningKitPoses = new Map();
    if (this.settings.return_rescue_kits_with_robot === false) return returningKitPoses;
    this.objects.forEach((object) => {
      if (object.type !== "rescueKit" || object.resolved || !this.physics?.isRobotContacting?.(object.key)) return;
      const relativePose = this.physics.captureRobotRelativePose?.(object.key);
      if (!relativePose) return;
      // Unity's RespawnKit adds this separation before returning a contacting
      // kit to the Robot-relative pose on either ON_RESET transition.
      relativePose.position.y -= 0.01;
      returningKitPoses.set(object.key, relativePose);
    });
    return returningKitPoses;
  }

  resetAttempt(attempt = this.attempt, { countInternalAttempt = true } = {}) {
    this.stopAllBuzzerAudio();
    const returningKitPoses = this.captureRobotContactingRescueKitPoses();
    if (countInternalAttempt) this.applyRescueSegmentMultiplierPenalty();
    this.attempt = Math.max(1, Number(attempt) || 1);
    if (countInternalAttempt) this.totalInternalAttempts += 1;
    this.manualCommand = null;
    this.manualMotionActive = false;
    this.pathAttempt += 1;
    this.status = "idle";
    // Routine time and fixed-tick identity belong to the whole run. A new
    // attempt resets only attempt-local state; resetting either here makes a
    // lack-of-progress recovery appear to rewind the global clock.
    this.attemptTime = 0;
    this.accumulator = 0;
    this.physicsAccumulator = 0;
    this.physicsTickCount = 0;
    this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
    const segmentStart = this.segmentStartOccurrence(this.segmentIndex);
    this.pathIndex = segmentStart;
    this.trackingStatus = this.pathStatus === "valid" ? "notStarted" : "outOfPath";
    // A new attempt reverses to the beginning of the current checkpoint
    // segment. It must not fall back to occurrence zero, and it must not use
    // a stopped-placement override from before the routine started.
    this.robot = robotSpawnPose(this.spawnRobot(segmentStart, { useOverride: false }), { ...this.robotDocument, parts: this.robotParts }, this.robotPhysicsBlueprint);
    const spawnElevation = this.sampleRobotSpawnElevation(`attempt:${this.attempt}:transition:${this.totalInternalAttempts}`);
    this.robot.y += spawnElevation;
    this.lastRobotSpawnElevation = spawnElevation;
    this.spawnOverride = null;
    this.pathIndex = segmentStart;
    this.objects = this.objects.map((object) => {
      if (object.resolved) return { ...object, visible: false, velocity: { x: 0, y: 0, z: 0 } };
      const tile = this.tileById.get(object.tileId) || {};
      const source = object.source || {};
      const randomPosition = object.type === "liveVictim" || object.type === "deadVictim";
      const relativePose = returningKitPoses.get(object.key);
      const returnedPose = relativePose ? this.physics.worldPoseFromRobotRelative(relativePose, this.robot) : null;
      const resetPosition = object.resetEveryAttempt
        ? (randomPosition && source.positionRandom === true ? this.resolveRandomVictimPosition(tile, source, this.attempt) : { ...object.initialPosition })
        : { ...object.position };
      const position = returnedPose?.position || resetPosition;
      const physicsRotation = returnedPose?.rotation || (object.resetEveryAttempt ? object.initialPhysicsRotation : (object.rotation || object.physicsRotation));
      return { ...object, position, physicsPosition: { ...position }, physicsRotation, rotation: physicsRotation, velocity: { x: 0, y: 0, z: 0 }, visible: true, rescued: false, resolution: "active", seesawAngle: object.type === "seesaw" ? SEESAW_PROFILE.initialAngleRadians : 0 };
    });
    this.physics?.dispose?.();
    this.physics = new SimulationPhysics();
    this.physics.build({
      tiles: this.tiles,
      objects: this.objects,
      robot: this.robot,
      robotParts: this.robotParts,
      robotDocument: { ...this.robotDocument, parts: this.robotParts },
      robotPhysicsBlueprint: this.robotPhysicsBlueprint,
      arenaObjectColliderBlueprint: this.arenaObjectColliderBlueprint
    });
    this.physics.commandRobotJoints({ locked: true });
    this.physics.bootstrap();
    this.syncRobotFromPhysics();
    this.robotJoints = this.physics.robotJointStates();
    this.currentTileId = this.arenaTileUnderRobot();
    this.lastPhysicalTileId = this.currentTileId;
    this.alignPathIndexToCurrentTile();
    this.deviationCount = 0;
    this.pathSkipCount = 0;
    this.stalledSeconds = 0;
    this.endGoalStableSeconds = 0;
    this.lackOfProgress = { phase: "idle", remainingSeconds: 0, reasonKey: "" };
    this.lackOfProgressLatched = false;
    this.lackOfProgressFailureUntil = 0;
    this.lastRobotPosition = { x: this.robot.x, z: this.robot.z };
    this.sensors = { color: "baseplate", luminosity: 0, ultrasonic: -1, touch: false, cameraFrame: 0 };
    this.motors = { left: 0, right: 0 };
    this.componentStates = this.createComponentStates();
    this.updateComponentReadings();
    this.manualCommand = null;
    this.emit("new-attempt", { attempt: this.attempt, totalInternalAttempts: this.totalInternalAttempts, spawnElevation });
    return this.snapshot();
  }

  commandWhileStopped(direction, speed = 1, { persistent = false } = {}) {
    if (!(this.status === "idle" || this.status === "stopped")) return this.snapshot();
    const amount = manualSpeedMultiplier(speed);
    const commands = {
      forward: { throttle: amount, turn: 0 },
      back: { throttle: -amount, turn: 0 },
      left: { throttle: 0, turn: -amount },
      right: { throttle: 0, turn: amount }
    };
    const selected = commands[direction];
    if (!selected) return this.snapshot();
    this.manualCommand = { ...selected, speedMultiplier: amount, remaining: persistent ? Infinity : ROBOT_MANUAL_CONTROL_PROFILE.tapStepSeconds, direction, persistent };
    const snapshot = this.tickPhysics(FIXED_TICK_SECONDS, { manual: this.manualCommand, source: "manual" });
    this.spawnOverride = { ...snapshot.robot };
   this.pathIndex = this.nearestPathIndex();
   this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
    if (this.lastScoredOccurrence < 0) this.lastScoredOccurrence = this.pathIndex > 0 ? this.pathIndex - 1 : -1;
    this.visitedOccurrences = [];
    this.enteredOccurrences.clear();
    this.trackingStatus = this.pathStatus === "valid" ? "notStarted" : "outOfPath";
    this.updateComponentReadings();
    this.emit("manual-spawn-move", {
      direction,
      speed: amount,
      translationSpeed: ROBOT_MANUAL_CONTROL_PROFILE.manualTranslationSpeed * amount,
      yawSpeed: ROBOT_MANUAL_CONTROL_PROFILE.manualYawSpeed * amount,
      profileVersion: ROBOT_MANUAL_CONTROL_PROFILE.version,
      occurrenceIndex: this.pathIndex
    });
    return this.snapshot();
  }

  releaseManualCommand() {
    this.manualCommand = null;
    this.motors = { left: 0, right: 0 };
    this.physics?.stopRobotManualMovement();
    this.manualMotionActive = false;
    this.syncRobotFromPhysics();
    if (["idle", "stopped"].includes(this.status)) this.spawnOverride = { ...this.robot };
    return this.snapshot();
  }

  command(direction, speed = 1, { persistent = false } = {}) {
    if (["idle", "stopped"].includes(this.status)) return this.commandWhileStopped(direction, speed, { persistent });
    if (!["running", "paused"].includes(this.status)) return this.snapshot();
    if (this.runtimeConfig.routine?.allowChangePosition === false) {
      if (!this.manualBlockedNoticeShown) {
        this.manualBlockedNoticeShown = true;
        this.emit("manual-movement-blocked", { reason: "change-position-disabled" });
      }
      return this.snapshot();
    }
    if (this.status !== "running") return this.snapshot();
    const amount = manualSpeedMultiplier(speed);
    const commands = {
      forward: { throttle: amount, turn: 0 },
      back: { throttle: -amount, turn: 0 },
      left: { throttle: 0, turn: -amount },
      right: { throttle: 0, turn: amount }
    };
    const selected = commands[direction];
    if (!selected) return this.snapshot();
    this.manualCommand = { ...selected, speedMultiplier: amount, remaining: persistent ? Infinity : ROBOT_MANUAL_CONTROL_PROFILE.tapStepSeconds, direction, persistent };
    this.emit("manual-input", {
      direction,
      speed: amount,
      translationSpeed: ROBOT_MANUAL_CONTROL_PROFILE.manualTranslationSpeed * amount,
      yawSpeed: ROBOT_MANUAL_CONTROL_PROFILE.manualYawSpeed * amount,
      profileVersion: ROBOT_MANUAL_CONTROL_PROFILE.version
    });
    return this.tick(FIXED_TICK_SECONDS, { manual: this.manualCommand, source: "manual" });
  }

  skipPathThreshold() {
    return Math.max(0, Math.round(Number(this.runtimeConfig.routine?.skipPathAttemptThreshold ?? this.settings.skip_path_threshold) || 0));
  }

  shouldForceAdvanceAtThreshold() {
    const threshold = this.skipPathThreshold();
    return this.runtimeConfig.routine?.forceAdvance === true && threshold > 0 && this.pathAttempt + 1 >= threshold;
  }

  canAdvance() {
    const threshold = this.skipPathThreshold();
    return this.runtimeConfig.routine?.advanceButton !== false || (threshold > 0 && this.pathAttempt >= threshold);
  }

  advance(reason = "manual-advance") {
    if (!this.canAdvance()) {
      this.emit("advance-blocked", { reason: "advance-disabled" });
      return this.snapshot();
    }
    if (this.pathStatus !== "valid" || this.status !== "running") return this.snapshot();
    const threshold = this.skipPathThreshold();
    const eligible = threshold > 0 && this.pathAttempt >= threshold;
    const penaltySeconds = eligible ? 0 : Math.max(0, Number(this.runtimeConfig.routine?.advancePenaltySeconds ?? this.settings.advance_penalty) || 0);
    if (penaltySeconds > 0) {
      this.time += penaltySeconds;
      this.elapsedTime += penaltySeconds;
      this.attemptTime += penaltySeconds;
     this.advancePenaltySecondsApplied += penaltySeconds;
      this.emit("advance-penalty", { seconds: round(penaltySeconds), threshold, skippedPaths: this.pathSkipCount, attemptsOnPath: this.pathAttempt });
      const limitSeconds = Math.max(0, Number(this.settings.time_limit_minutes) || 0) * 60;
      if (limitSeconds > 0 && this.time >= limitSeconds && this.settings.stop_game_on_time_limit !== false) {
        this.status = "completed";
        this.emit("time-limit", { seconds: round(this.time), source: "advance-penalty" });
        return this.snapshot();
      }
    }
    this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
    const nextSegment = this.currentPathSegment(this.segmentIndex + 1);
    if (!nextSegment) {
      this.status = "completed";
      this.emit("routine-completed", { reason: "advance-finished", source: reason });
      return this.snapshot();
    }

    const returningKitPoses = this.captureRobotContactingRescueKitPoses();
    this.totalInternalAttempts += 1;
    const spawnElevation = this.sampleRobotSpawnElevation(`advance:${this.advanceCount + 1}:transition:${this.totalInternalAttempts}`);
    const previousOccurrence = this.pathIndex;
    const targetOccurrence = nextSegment.startOccurrence;
    const skipped = Math.max(0, targetOccurrence - previousOccurrence - 1);
    const skippedStart = Math.max(this.lastScoredOccurrence + 1, previousOccurrence + 1);
    const skippedEnd = targetOccurrence;
    this.pathIndex = targetOccurrence;
    this.segmentIndex = nextSegment.segmentIndex;
    this.pathSkipCount += skipped;
    if (skippedEnd >= skippedStart) {
      this.skippedOccurrences.push(...Array.from({ length: skippedEnd - skippedStart + 1 }, (_, offset) => skippedStart + offset));
    }
    // Advance is a path skip. Mark the destination as already passed for the
    // score-once ledger, but do not execute any tile/checkpoint entrance score.
    // The next legitimate tile entered after the checkpoint can still score.
    this.lastScoredOccurrence = Math.max(this.lastScoredOccurrence, targetOccurrence);
    const target = worldPoint(this.path[targetOccurrence]);
    // Advance teleports to the checkpoint. Reuse the exact spawn orientation
    // calculation so the robot faces the first tile of the new segment now,
    // instead of only after New Attempt rebuilds its pose.
    const targetPose = robotSpawnPose(this.spawnRobot(targetOccurrence, { useOverride: false }), { ...this.robotDocument, parts: this.robotParts }, this.robotPhysicsBlueprint);
    this.robot.x = target.x;
    this.robot.y = target.y + spawnElevation;
    this.robot.z = target.z;
    this.robot.groundY = targetPose.groundY;
    this.robot.yaw = targetPose.yaw;
    this.robot.velocity = 0;
    this.robot.angularVelocity = 0;
    this.robot.fullyStopped = true;
    this.spawnOverride = null;
    this.physics?.setRobotPose(this.robot, this.robot.yaw, spawnElevation);
    this.syncRobotFromPhysics();
    this.lastRobotSpawnElevation = spawnElevation;
    if (returningKitPoses.size) {
      this.objects = this.objects.map((object) => {
        const relativePose = returningKitPoses.get(object.key);
        const returnedPose = relativePose ? this.physics?.worldPoseFromRobotRelative(relativePose, this.robot) : null;
        if (!returnedPose) return object;
        this.physics?.setRuntimeObjectPose(object.key, returnedPose.position, returnedPose.rotation);
        return {
          ...object,
          position: { ...returnedPose.position },
          physicsPosition: { ...returnedPose.position },
          rotation: returnedPose.rotation,
          physicsRotation: returnedPose.rotation,
          velocity: { x: 0, y: 0, z: 0 },
          angularVelocity: { x: 0, y: 0, z: 0 }
        };
      });
    }
    this.lastRobotPosition = { x: this.robot.x, z: this.robot.z };
    this.currentTileId = this.arenaTileUnderRobot() || this.path[targetOccurrence]?.tileId || null;
    this.lastPhysicalTileId = this.currentTileId;
    this.trackingStatus = "tracking";
    this.stalledSeconds = 0;
    this.endGoalStableSeconds = 0;
    this.updateComponentReadings();
    this.pathAttempt = 0;
    this.advanceCount += 1;
    if (skipped > 0) this.emit("path-skip", { from: previousOccurrence, to: targetOccurrence, skipped, source: "advance" });
    this.emit("advance", {
      occurrenceIndex: targetOccurrence,
      segmentIndex: this.segmentIndex,
      checkpointTileId: this.path[targetOccurrence]?.tileId || null,
      reason,
      eligible,
      penaltySeconds: round(penaltySeconds),
      skippedPaths: this.pathSkipCount,
      attemptsOnPath: this.pathAttempt,
      totalInternalAttempts: this.totalInternalAttempts,
      spawnElevation
    });
    return this.snapshot();
  }

  tick(deltaSeconds = FIXED_TICK_SECONDS, controls = {}) {
    if (this.status !== "running") return this.snapshot();
    const delta = clamp(Number(deltaSeconds) || FIXED_TICK_SECONDS, 0, 0.25);
    this.accumulator += delta;
    let manual = controls.manual || this.manualCommand;
    let processed = 0;
    while (this.accumulator + 1e-9 >= FIXED_TICK_SECONDS && processed < 16 && this.status === "running") {
      this.accumulator -= FIXED_TICK_SECONDS;
      this.processTick(FIXED_TICK_SECONDS, manual, controls.source || "runtime", true);
      if (manual && Number.isFinite(manual.remaining) && manual.remaining <= 1e-9) manual = null;
      processed += 1;
    }
    return this.snapshot();
  }

  tickPhysics(deltaSeconds = FIXED_TICK_SECONDS, controls = {}) {
    const delta = clamp(Number(deltaSeconds) || FIXED_TICK_SECONDS, 0, 0.25);
    this.physicsAccumulator += delta;
    let manual = controls.manual || this.manualCommand;
    let processed = 0;
    while (this.physicsAccumulator + 1e-9 >= FIXED_TICK_SECONDS && processed < 16) {
      this.physicsAccumulator -= FIXED_TICK_SECONDS;
      this.processTick(FIXED_TICK_SECONDS, manual, controls.source || "physics", false);
      if (manual && Number.isFinite(manual.remaining) && manual.remaining <= 1e-9) manual = null;
      processed += 1;
    }
    return this.snapshot();
  }

  arenaColliderDebugRender() {
    return this.physics?.arenaColliderDebugRender?.() || null;
  }

  syncRobotFromPhysics() {
    const physical = this.physics?.robotState?.();
    if (!physical) return;
    this.robot = { ...this.robot, ...physical };
  }

  processTick(delta, manual, source, routineActive = true) {
    this.physicsTickCount += 1;
    if (routineActive) {
      this.tickCount += 1;
      this.time += delta;
      this.elapsedTime = this.time;
      this.attemptTime += delta;
    }
    if (routineActive && this.lackOfProgress.phase === "failure" && this.time >= this.lackOfProgressFailureUntil) {
      const nextAttempt = this.attempt + 1;
      this.resetAttempt(nextAttempt, { countInternalAttempt: true });
      this.start();
      this.emit("lack-of-progress-reset", { reason: "notMoving", previousAttempt: nextAttempt - 1 });
      this.captureVisualReplayIfNeeded();
      return;
    }
    let stopManualAfterStep = false;
    if (manual) {
      const throttle = clamp(Number(manual.throttle) || 0, -2, 2);
      const turn = clamp(Number(manual.turn) || 0, -2, 2);
      this.motors.left = clamp(throttle - turn, -2, 2);
      this.motors.right = clamp(throttle + turn, -2, 2);
      const multiplier = manualSpeedMultiplier(manual.speedMultiplier);
      this.physics?.setRobotManualVelocity(
        throttle,
        turn,
        ROBOT_MANUAL_CONTROL_PROFILE.manualTranslationSpeed * multiplier,
        ROBOT_MANUAL_CONTROL_PROFILE.manualYawSpeed * multiplier
      );
      this.manualMotionActive = true;
      if (this.manualCommand && Number.isFinite(this.manualCommand.remaining)) {
        this.manualCommand.remaining -= delta;
        if (this.manualCommand.remaining <= 1e-9) {
          this.manualCommand = null;
          stopManualAfterStep = true;
        }
      }
    } else {
      this.motors.left = 0;
      this.motors.right = 0;
      if (this.manualMotionActive) {
        this.physics?.stopRobotManualMovement();
        this.manualMotionActive = false;
      } else this.physics?.driveRobot(0, 0);
    }
    this.physics?.step();
    if (stopManualAfterStep) {
      this.physics?.stopRobotManualMovement();
      this.manualMotionActive = false;
    }
    this.syncRobotFromPhysics();
    if (!routineActive && ["idle", "stopped"].includes(this.status) && (manual || stopManualAfterStep)) this.spawnOverride = { ...this.robot };
    this.robotJoints = this.physics.robotJointStates();
    this.updateObjects(delta, { gameplay: routineActive });
    if (routineActive) this.updateTracking(delta);
    this.updateComponentReadings();
    const limitSeconds = Math.max(0, Number(this.settings.time_limit_minutes) || 0) * 60;
    if (routineActive && limitSeconds > 0 && this.time >= limitSeconds && this.settings.stop_game_on_time_limit !== false) {
      this.status = "completed";
      this.emit("time-limit", { seconds: round(this.time, 3), source });
    }
    this.captureVisualReplayIfNeeded();
  }

  commandServo(action = "setTargetVelocity", targetDegPerSecond = 0, componentId = null) {
    if (!this.physics) return this.snapshot();
    const servoId = componentId && this.componentById(componentId)?.typeId === "servo"
      ? componentId
      : this.componentEntries.find((entry) => entry.typeId === "servo")?.id;
    if (!servoId) return this.snapshot();
    const command = {};
    if (action === "unlock") command.lockedById = { [servoId]: false };
    else if (action === "lock") command.lockedById = { [servoId]: true };
    if (action === "stop") command.targetById = { [servoId]: 0 };
    else if (action === "setTargetVelocity" || action === "apply") {
      command.targetById = { [servoId]: targetDegPerSecond };
    }
    this.physics.commandRobotJoints(command);
    this.robotJoints = this.physics.robotJointStates();
    this.updateComponentReadings();
    this.emit("servo-command", { command: action, componentId: servoId });
    return this.snapshot();
  }

  commandAllServos(action = "unlock") {
    if (!this.physics) return this.snapshot();
    if (action === "stop") this.physics.commandRobotJoints({ targetDegPerSecond: 0 });
    else if (action === "lock") this.physics.commandRobotJoints({ locked: true });
    else if (action === "unlock") this.physics.commandRobotJoints({ locked: false });
    this.robotJoints = this.physics.robotJointStates();
    this.updateComponentReadings();
    this.emit("servo-command", { command: `${action}-all` });
    return this.snapshot();
  }

  commandComponent(componentId, action = "", payload = {}) {
    const entry = this.componentById(componentId);
    if (!entry) return this.snapshot();
    if (entry.typeId === "servo") {
      return this.commandServo(action, payload.targetDegPerSecond ?? 0, componentId);
    }
    const state = this.componentStates.get(componentId);
    if (!state) return this.snapshot();
    const channel = (value, fallback) => Number.isFinite(Number(value)) ? clamp(Math.round(Number(value)), 0, 255) : fallback;
    if (entry.typeId === "light") {
      if (action === "turnOn") {
        state.lit = true;
        state.color = {
          r: channel(payload.color?.r, 255),
          g: channel(payload.color?.g, 255),
          b: channel(payload.color?.b, 255)
        };
      } else if (action === "turnOff") state.lit = false;
      else if (action === "setLampBrightness" && Number.isFinite(Number(payload.lampBrightness))) {
        state.lampBrightness = clamp(Math.round(Number(payload.lampBrightness)), 0, 100);
      }
    } else if (entry.typeId === "buzzer") {
      if (action === "stop") {
        this.stopBuzzerAudio(componentId);
        state.playing = false;
      } else if (action === "play") {
        state.frequencyHz = clamp(Number(payload.frequencyHz) || state.frequencyHz || 50, 1, 20000);
        state.wave = ["square", "sawtooth", "noise"].includes(payload.wave) ? payload.wave : "square";
        state.playing = true;
        state.audioAvailable = this.startBuzzerAudio(componentId, state);
      }
    } else if (entry.typeId === "pen") {
      if (action === "turnOn") {
        state.working = true;
        state.color = {
          r: channel(payload.color?.r, 255),
          g: channel(payload.color?.g, 128),
          b: channel(payload.color?.b, 0)
        };
      } else if (action === "turnOff") state.working = false;
      else if (action === "clear") { state.trailPoints = []; state.trailSegments = 0; }
    } else if (entry.typeId === "camera" && action === "snap") {
      state.lastCaptureFrame = this.tickCount;
    }
    this.updateComponentReadings();
    this.emit("component-command", { componentId, typeId: entry.typeId, command: action });
    return this.snapshot();
  }

  updateObjects(delta, { gameplay = true } = {}) {
    this.sensors.touch = false;
    this.objects.forEach((object) => {
      if (!object.visible || object.resolved) return;
      if (object.type === "seesaw") {
        const seesawState = this.physics?.seesawState(object.key);
        if (seesawState) {
          object.seesawAngle = seesawState.angle;
          object.angularVelocity = { x: seesawState.velocity, y: 0, z: 0 };
        }
      } else {
        const physicsState = this.physics?.state(object.key);
        if (physicsState) {
          object.position = physicsState.position;
          object.rotation = physicsState.rotation;
          object.velocity = physicsState.velocity;
          object.angularVelocity = physicsState.angularVelocity;
        }
      }
      if (this.physics?.contacts.has(object.key)) {
        this.sensors.touch = true;
        this.emit("object-pushed", { objectId: object.id, tileId: object.tileId, type: object.type });
      }
      if (object.type === "seesaw") object.seesawAngle = clamp(Number(object.seesawAngle) || 0, SEESAW_PROFILE.hingeMinRadians, SEESAW_PROFILE.hingeMaxRadians);
      if (gameplay && ["liveVictim", "deadVictim", "rescueKit"].includes(object.type)) this.tryResolveRescue(object);
    });
  }

  tryResolveRescue(object) {
    const trigger = this.physics?.rescueReady(object.key);
    if (!trigger) return;
    const evacuation = this.objects.find((candidate) => candidate.key === trigger.key && candidate.type === "evacuationPoint" && candidate.visible);
    if (!evacuation) return;
    const liveRemaining = this.objects.some((candidate) => candidate.type === "liveVictim" && !candidate.resolved);
    if (object.type === "deadVictim" && this.runtimeConfig.rescue?.requireLivingBeforeDead === true && liveRemaining) {
      object.resolved = true;
      object.rescued = false;
      object.visible = false;
      object.resolution = "rejected-dead";
      this.physics.disableObject(object.key);
      this.emit("rescue-rejected", { objectId: object.id, tileId: object.tileId, reason: "living-victim-remains" });
      return;
    }
    object.resolved = true;
    object.rescued = true;
    object.visible = false;
    object.resolution = "rescued";
    this.physics.disableObject(object.key);
    const scoringAttempt = this.pathAttempt + 1;
    const bonusKey = `Object${object.type[0]?.toUpperCase() || ""}${object.type.slice(1)}`;
    const bonus = evacuation.evacuationBonus?.[bonusKey]
      ?? evacuation.evacuationBonus?.[object.type]
      ?? evacuation.evacuationBonus?.[evacuation.evacuationRole]
      ?? 0;
    const rescuePoints = scorePoints(object.rescueScore, scoringAttempt);
    const rescueMultiplier = scoreMultiplier(object.rescueScore, scoringAttempt);
    const bonusPoints = scorePoints(bonus, scoringAttempt);
    const bonusMultiplier = scoreMultiplier(bonus, scoringAttempt);
    if (["liveVictim", "deadVictim"].includes(object.type)) {
      this.rescuedVictimIds.add(object.id);
      this.refreshScoreTotal();
    }
    const scoreDetail = { objectId: object.id, tileId: object.tileId, evacuationId: evacuation.id, pathAttempt: this.pathAttempt };
    this.awardScore(rescuePoints, rescueMultiplier, "rescue", { ...scoreDetail, scoreComponent: "object-rescue" });
    if (bonusPoints !== 0 || bonusMultiplier !== 1) {
      this.awardScore(bonusPoints, bonusMultiplier, "rescue-bonus", { ...scoreDetail, scoreComponent: "evacuation-area-bonus" });
    }
    const points = rescuePoints + bonusPoints;
    this.emit("rescue", { objectId: object.id, tileId: object.tileId, points: round(points, 2), evacuationId: evacuation.id });
    if (object.type === "rescueKit") this.emit("starter-kit-delivered", { objectId: object.id });
    const victims = this.objects.filter((candidate) => ["liveVictim", "deadVictim"].includes(candidate.type));
    if (this.runtimeConfig.rescue?.endWhenAllVictimsRescued && victims.length && victims.every((victim) => victim.resolved)) {
      this.status = "completed";
      this.emit("all-victims-rescued");
    }
  }

  updateTracking(delta) {
    if (this.pathStatus !== "valid" || !this.path.length) {
      this.trackingStatus = "outOfPath";
      this.currentTileId = null;
      this.sensors.color = "baseplate";
      this.sensors.luminosity = 0;
      this.sensors.ultrasonic = -1;
      this.sensors.cameraFrame = this.tickCount;
      return;
    }
    const points = this.waypoints();
    let nearestDistance = Infinity;
    points.forEach((point) => {
      const candidate = distance2d(this.robot, point);
      if (candidate < nearestDistance) nearestDistance = candidate;
    });
    const previousStatus = this.trackingStatus;
    const movement = distance2d(this.robot, this.lastRobotPosition);
    const physicsSpeed = Number(this.robot.speedMagnitude);
    const fallbackSpeed = delta > 0 ? movement / delta : Math.abs(Number(this.robot.velocity) || 0);
    const speed = Number.isFinite(physicsSpeed) ? Math.max(0, physicsSpeed) : fallbackSpeed;
    const moving = speed >= 0.25;
    const tileId = this.arenaTileUnderRobot();
    const tileChanged = tileId !== this.lastPhysicalTileId;
    const physicalTile = tileId ? this.tileById.get(tileId) : null;
    const onOutOfBoundsTile = physicalTile?.flags?.outOfBounds === true || physicalTile?.definition?.flags?.outOfBounds === true;
    const rescueZoneRun = !onOutOfBoundsTile && tileId ? this.rescueZoneRunForTile(tileId) : null;
    if (onOutOfBoundsTile) {
      this.stalledSeconds = 0;
    } else if (rescueZoneRun) {
      this.stalledSeconds = 0;
      this.clearLackOfProgress();
    } else if (moving) {
      this.stalledSeconds = 0;
      if (this.lackOfProgress.reasonKey === LACK_OF_PROGRESS_FAILURE_REASON) this.clearLackOfProgress();
    } else if (!this.lackOfProgressLatched) {
      this.stalledSeconds += delta;
    }
    this.lastRobotPosition = { x: this.robot.x, z: this.robot.z };
    this.currentTileId = tileId;
    const currentOccurrence = this.path[this.pathIndex];
    if (!tileId || onOutOfBoundsTile) {
      this.trackingStatus = "outOfBounds";
      this.requestLackOfProgress("routineLackProgressReasonOutOfBounds", this.lackOfProgressSeconds(true));
    } else if (rescueZoneRun) {
      if (this.pathIndex < rescueZoneRun.end) {
        if (!this.isRescueZoneOccurrence(this.pathIndex)) this.scoreTileExit(this.pathIndex, "tracking");
        this.lastScoredOccurrence = Math.max(this.lastScoredOccurrence, rescueZoneRun.end - 1);
        this.pathIndex = rescueZoneRun.end;
        this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
      }
      if (!this.enteredOccurrences.has(rescueZoneRun.end) && this.lastScoredOccurrence < rescueZoneRun.end) {
        this.registerPathProgress(rescueZoneRun.end, "tracking", { history: false });
      }
      this.trackingStatus = "rescueZone";
      this.stalledSeconds = 0;
      this.clearLackOfProgress();
    } else if (tileId === currentOccurrence?.tileId) {
      this.trackingStatus = "tracking";
      if (tileChanged || previousStatus !== "tracking") {
        this.clearLackOfProgress();
        if (tileChanged) this.stalledSeconds = 0;
      }
      if (this.lastScoredOccurrence < this.pathIndex) this.registerPathProgress(this.pathIndex, "spawn");
    } else {
      const nextOccurrence = this.nextOccurrenceForTile(tileId, this.pathIndex);
      if (nextOccurrence === this.pathIndex + 1) {
        this.scoreTileExit(this.pathIndex, "tracking");
        this.pathIndex = nextOccurrence;
        this.segmentIndex = this.segmentIndexForOccurrence(this.pathIndex);
        this.registerPathProgress(this.pathIndex, "tracking");
        this.trackingStatus = "tracking";
        this.stalledSeconds = 0;
        this.clearLackOfProgress();
      } else if (nextOccurrence > this.pathIndex + 1) {
        this.trackingStatus = "pathSkip";
        this.requestLackOfProgress("routineLackProgressReasonPathSkip", this.lackOfProgressSeconds(true));
        if (tileChanged) {
          const skipped = nextOccurrence - this.pathIndex - 1;
          this.pathSkipCount += skipped;
          this.skippedOccurrences.push(...Array.from({ length: skipped }, (_, offset) => this.pathIndex + offset + 1));
          this.emit("path-skip", { from: this.pathIndex, to: nextOccurrence, skipped, tileId });
        }
      } else if ((this.pathIndicesByTileId.get(tileId) || []).length) {
        const adjacentPreviousOccurrence = (this.pathIndicesByTileId.get(tileId) || []).some((index) => index < this.pathIndex && this.pathIndex - index <= 1);
        if (adjacentPreviousOccurrence) {
          this.trackingStatus = "outOfLine";
          this.requestLackOfProgress("routineLackProgressReasonOutOfLine", this.lackOfProgressSeconds(false));
        } else {
          this.trackingStatus = "pathSkip";
          this.requestLackOfProgress("routineLackProgressReasonPathSkip", this.lackOfProgressSeconds(true));
        }
      } else {
        const selectedTilePoint = worldPoint(this.tileById.get(tileId));
        const currentLinePoint = worldPoint(currentOccurrence);
        const lineTileDistance = Math.hypot(
          selectedTilePoint.x - currentLinePoint.x,
          selectedTilePoint.y - currentLinePoint.y,
          selectedTilePoint.z - currentLinePoint.z
        );
        this.trackingStatus = Math.round(lineTileDistance) <= CELL_SIZE ? "outOfLine" : "outOfPath";
        const isLong = this.trackingStatus === "outOfLine";
        const reasonKey = isLong ? "routineLackProgressReasonOutOfLine" : "routineLackProgressReasonOutOfPath";
        this.requestLackOfProgress(reasonKey, this.lackOfProgressSeconds(!isLong));
      }
    }
    if (["outOfBounds", "outOfLine", "outOfPath", "pathSkip"].includes(this.trackingStatus)
      && (tileChanged || this.trackingStatus !== previousStatus)) this.deviationCount += 1;
    this.lastPhysicalTileId = tileId;
    if (!rescueZoneRun && this.settings.lack_of_progress === true && !this.lackOfProgressLatched) {
      const noMovementThreshold = this.lackOfProgressSeconds(true);
      if (this.stalledSeconds > noMovementThreshold) this.requestLackOfProgress(LACK_OF_PROGRESS_FAILURE_REASON, noMovementThreshold);
      this.advanceLackOfProgress(delta);
    } else if (!rescueZoneRun && this.settings.lack_of_progress !== true) {
      this.clearLackOfProgress();
    }
    this.sensors.color = nearestDistance <= 3.7 ? "black-line" : "baseplate";
    this.sensors.luminosity = Math.max(0, Math.round(100 - nearestDistance * 12));
    const next = points[Math.min(this.pathIndex + 1, points.length - 1)];
    this.sensors.ultrasonic = next ? round(distance2d(this.robot, next) / CELL_SIZE, 3) : -1;
    this.sensors.cameraFrame = this.tickCount;
    const atGoal = this.finalGameStopperOverlaps();
    if (this.settings.end_on_endgoal !== false && atGoal && this.trackingStatus === "tracking") {
      if (this.robot.fullyStopped) this.endGoalStableSeconds += delta;
      else this.endGoalStableSeconds = 0;
      if (this.endGoalStableSeconds + 1e-9 >= END_GOAL_STABILITY_SECONDS) {
        this.scoreTileExit(this.path.length - 1, "end-goal");
        const goalTile = this.tileById.get(this.path.at(-1)?.tileId);
        const penalty = endGoalLopPenaltyScore(
          this.runtimeConfig.scoring?.endGoalPenalty || 0,
          this.totalInternalAttempts,
          this.pathAttempt + 1,
          goalTile?.exitScore?.points
        );
        this.awardScore(penalty.points, penalty.multiplier, "end-goal", {
          stableSeconds: END_GOAL_STABILITY_SECONDS,
          pathAttempt: this.pathAttempt,
          scoreComponent: "end-goal-lop-penalty",
          totalInternalAttempts: penalty.internalAttempts,
          penaltyCapPoints: penalty.maxPoints,
          emitUnchanged: penalty.configured
        });
        this.status = "completed";
        this.emit("end-goal-complete", { stableSeconds: END_GOAL_STABILITY_SECONDS });
      }
    } else {
      this.endGoalStableSeconds = 0;
    }
  }

  registerPathProgress(index, source, { history = true } = {}) {
    if (this.pathStatus !== "valid" || !this.path.length) return;
    const previousSegment = this.segmentIndex;
    const nextSegment = this.segmentIndexForOccurrence(index);
    if (index <= this.lastScoredOccurrence) {
      this.segmentIndex = Math.max(this.segmentIndex, nextSegment);
      return;
    }
    if (index !== this.lastScoredOccurrence + 1) return;
    const occurrence = this.path[index];
    if (!occurrence) return;
    const tile = this.tileById.get(occurrence.tileId);
    const rules = [{ score: tile?.enterScore, component: "tile-enter" }];
    if (tile?.flags?.checkpoint === true && !occurrence.checkpointAccepted) {
      rules.push({ score: this.runtimeConfig.scoring?.pathSizeEntrance, scale: this.pathSizeForCheckpoint(index), component: "path-size-checkpoint-enter" });
    }
    if (tile && arenaTileIsRamp(tile)) rules.push({ score: this.runtimeConfig.scoring?.rampEntrance, component: "ramp-enter" });
    if (occurrence.checkpointAccepted) rules.push({ score: this.runtimeConfig.scoring?.checkpointEntrance, component: "placed-checkpoint-enter" });
    const result = this.scorePathRules(rules, "tile-enter", { tileId: occurrence.tileId, occurrenceIndex: index, pathAttempt: this.pathAttempt, pathSegment: nextSegment + 1, pathTotal: this.pathSegments.length, source });
    this.enteredOccurrences.add(index);
    if (history && !this.isRescueZoneOccurrence(index)) this.visitedOccurrences.push(index);
    this.emit("tile-enter", { tileId: occurrence.tileId, index, source, pathAttempt: this.pathAttempt, pathSegment: nextSegment + 1, pathTotal: this.pathSegments.length, points: round(result.points, 2), scoreInputs: result.inputs, checkpoint: Boolean(occurrence.checkpoint), ramp: tile ? arenaTileIsRamp(tile) : false });
    this.lastScoredOccurrence = index;
    this.segmentIndex = nextSegment;
    // Attempts belong to the current checkpoint segment. Crossing an
    // ordinary tile must not erase the failed-attempt count; only arriving at
    // a later checkpoint starts the next segment's attempt counter.
    if (source !== "spawn" && nextSegment > previousSegment) this.pathAttempt = 0;
 }

  awardScore(points, multiplier = 1, reason = "score", detail = {}) {
    const numericPoints = Number(points) || 0;
    const multiplierValue = Number(multiplier);
    const numericMultiplier = Number.isFinite(multiplierValue) ? multiplierValue : 1;
    const { emitUnchanged = false, ...eventDetail } = detail;
    if (this.settings.scoring === false) {
      if (numericPoints !== 0 || numericMultiplier !== 1) this.emit("score-disabled", { reason, ...detail });
      return;
    }
    if (numericPoints === 0 && numericMultiplier === 1 && !emitUnchanged) return;
    this.baseScoreCents += Math.round(numericPoints * 100);
    this.multiplier = round(this.multiplier * numericMultiplier, 6);
    this.refreshScoreTotal();
    this.emit("score", { reason, points: round(numericPoints, 2), multiplier: numericMultiplier, total: round(this.scoreCents / 100, 2), ...eventDetail });
  }

  refreshScoreTotal() {
    const multiplier = this.settings.multiplier_powered_by_victims_rescued === true
      ? Math.pow(this.multiplier, this.rescuedVictimIds.size)
      : this.multiplier;
    const rawTotal = Math.round(this.baseScoreCents * multiplier) / 100;
    const total = roundArenaScoreTotal(rawTotal, this.settings.score_rounding_mode);
    this.scoreCents = Math.round(total * 100);
  }

  setVisualReplayRecorder(recorder = null, cameraProvider = null) {
    this.visualReplayRecorder = recorder;
    this.visualReplayCameraProvider = typeof cameraProvider === "function" ? cameraProvider : null;
    this.visualReplayPendingKind = null;
    this.visualReplayLastTick = -1;
    if (recorder && this.started) this.captureVisualReplayIfNeeded("keyframe");
  }

  passiveVisualState() {
    const entities = {};
    const yaw = Number(this.robot?.yaw) || 0;
    entities["robot-root"] = {
      position: [Number(this.robot?.x) || 0, Number(this.robot?.y) || 0, Number(this.robot?.z) || 0],
      rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)],
      visible: true
    };
    Object.entries(this.physics?.robotGroupStates?.() || {}).forEach(([groupId, pose]) => {
      const translation = pose.translation || {};
      const rotation = pose.rotation || {};
      entities[`robot-group:${groupId}`] = {
        position: [Number(translation.x) || 0, Number(translation.y) || 0, Number(translation.z) || 0],
        rotation: [Number(rotation.x) || 0, Number(rotation.y) || 0, Number(rotation.z) || 0, Number.isFinite(Number(rotation.w)) ? Number(rotation.w) : 1],
        visible: true
      };
    });
    this.objects.forEach((object) => {
      if (!object.dynamic && !["box", "seesaw", "liveVictim", "deadVictim", "rescueKit"].includes(object.type)) return;
      const rotation = object.rotation || object.physicsRotation || {};
      const visualState = {
        type: String(object.type || "none"),
        dynamic: object.dynamic === true,
        visible: object.visible !== false,
        resolved: object.resolved === true,
        rescued: object.rescued === true,
        resolution: String(object.resolution || "active")
      };
      if (Number.isFinite(Number(object.seesawAngle))) visualState.seesawAngle = Number(object.seesawAngle);
      if (object.boxRuntime) {
        visualState.boxWidth = Number(object.boxRuntime.width) || 0;
        visualState.boxHeight = Number(object.boxRuntime.height) || 0;
        visualState.boxDepth = Number(object.boxRuntime.depth) || 0;
        visualState.boxMaterial = String(object.boxRuntime.material || "");
      }
      entities[`arena-object:${object.key}`] = {
        position: [Number(object.position?.x) || 0, Number(object.position?.y) || 0, Number(object.position?.z) || 0],
        rotation: [Number(rotation.x) || 0, Number(rotation.y) || 0, Number(rotation.z) || 0, Number.isFinite(Number(rotation.w)) ? Number(rotation.w) : 1],
        ...(object.scale ? { scale: [Number(object.scale.x) || 1, Number(object.scale.y) || 1, Number(object.scale.z) || 1] } : {}),
        visible: object.visible !== false,
        visualState
      };
    });
    const visualComponents = {};
    this.componentEntries.forEach((entry) => {
      const component = this.componentStates.get(entry.id);
      if (!component) return;
      const color = [
        Math.max(0, Math.min(255, Math.round(Number(component.color?.r) || 0))),
        Math.max(0, Math.min(255, Math.round(Number(component.color?.g) || 0))),
        Math.max(0, Math.min(255, Math.round(Number(component.color?.b) || 0)))
      ];
      if (entry.typeId === "light") {
        visualComponents[entry.id] = {
          typeId: "light",
          lit: Boolean(component.lit),
          color,
          lampBrightness: Math.max(0, Math.min(100, Number(component.lampBrightness) || 0))
        };
      } else if (entry.typeId === "pen") {
        visualComponents[entry.id] = {
          typeId: "pen",
          working: component.working === true,
          color,
          trailPoints: (component.trailPoints || []).map((point) => [Number(point.x) || 0, Number(point.y) || 0, Number(point.z) || 0])
        };
      }
    });
    let camera = null;
    try { camera = this.visualReplayCameraProvider?.(); } catch {}
    return {
      tick: Math.max(0, Math.round(Number(this.tickCount) || 0)),
      timeMicros: Math.max(0, Math.round((Number(this.time) || 0) * 1_000_000)),
      entities,
      visualComponents,
      ...(camera && typeof camera === "object" ? {
        camera: {
          orbitX: Number(camera.orbitX) || 0,
          orbitY: Number(camera.orbitY) || 0,
          zoom: Number(camera.zoom) > 0 ? Number(camera.zoom) : 1
        }
      } : {})
    };
  }

  captureVisualReplayIfNeeded(forcedKind = null) {
    if (!this.visualReplayRecorder || !this.started || !this.localSimulation) return;
    const tick = Math.max(0, Math.round(Number(this.tickCount) || 0));
    const pendingKind = forcedKind || this.visualReplayPendingKind;
    if (!pendingKind && tick % 5 !== 0) return;
    if (tick === this.visualReplayLastTick && !pendingKind) return;
    const terminalTypes = new Set(["routine-stopped", "routine-completed", "routine-error", "time-limit", "end-goal-complete"]);
    const kind = pendingKind
      ? terminalTypes.has(pendingKind) ? "terminal" : "important"
      : tick % 60 === 0 ? "keyframe" : "sample";
    const recorder = this.visualReplayRecorder;
    try {
      recorder.capture(this.passiveVisualState(), kind);
    } catch (error) {
      recorder.fail(error);
      if (this.visualReplayRecorder === recorder) {
        this.visualReplayRecorder = null;
        this.visualReplayCameraProvider = null;
      }
    }
    this.visualReplayLastTick = tick;
    this.visualReplayPendingKind = null;
  }

  emit(type, detail = {}) {
    const event = { time: round(this.time, 3), attemptTime: round(this.attemptTime, 3), tick: this.tickCount, attempt: this.attempt, ...detail, type, sequence: ++this.eventSequence };
    this.events.push(event);
    this.lastEvent = event;
    if (this.events.length > 160) this.events.shift();
    if (["routine-stopped", "routine-completed", "routine-error", "time-limit", "end-goal-complete"].includes(type)) this.visualReplayPendingKind = type;
    else if (type === "component-command" && ["light", "pen"].includes(detail.typeId)) this.visualReplayPendingKind = type;
    else if (["routine-paused", "routine-resumed", "new-attempt", "advance", "path-skip", "rescue", "rescue-rejected", "starter-kit-delivered", "all-victims-rescued", "lack-of-progress-reset"].includes(type)) this.visualReplayPendingKind = type;
  }

  snapshot() {
    this.captureVisualReplayIfNeeded();
    const projections = this.pathStatus === "valid" ? checkpointProjectionForPath(this.path) : [];
    const segment = this.pathStatus === "valid" ? this.currentPathSegment(this.segmentIndex) : null;
    const segmentTileIndex = segment ? Math.max(0, this.pathIndex - segment.startOccurrence) : null;
    const segmentTileTotal = segment ? Math.max(0, segment.endOccurrence - segment.startOccurrence + 1) : 0;
    return {
      status: this.status,
      mode: this.programId ? "program" : "manual-debug",
      arenaId: this.arenaId,
      robotId: this.robotId,
      programId: this.programId,
      starterKitSetup: clone(this.starterKitSetup),
      seed: this.environmentSeed,
      arenaGenerationSeed: this.arenaGenerationSeed,
      robotSpawnElevation: round(this.lastRobotSpawnElevation, 5),
      time: round(this.time, 3),
      elapsedTime: round(this.elapsedTime, 3),
      attemptTime: round(this.attemptTime, 3),
      tick: this.tickCount,
      physicsTick: this.physicsTickCount,
      attempt: this.attempt,
      robot: clone(this.robot),
      robotRuntime: clone(this.robotRuntime),
      robotGroupPoses: clone(this.physics?.robotGroupStates?.() || {}),
      robotColliders: clone(this.physics?.robotColliderStates?.() || []),
      robotJoints: clone(this.robotJoints),
      components: clone(this.components),
      lackOfProgress: clone(this.lackOfProgress),
      manual: {
        allowed: this.runtimeConfig.routine?.allowChangePosition !== false,
        blocked: this.runtimeConfig.routine?.allowChangePosition === false,
        command: this.manualCommand ? this.manualCommand.direction : null,
        speedMultiplier: Number(this.manualCommand?.speedMultiplier) || 0,
        manualTranslationSpeed: ROBOT_MANUAL_CONTROL_PROFILE.manualTranslationSpeed,
        manualYawSpeed: ROBOT_MANUAL_CONTROL_PROFILE.manualYawSpeed,
        profileVersion: ROBOT_MANUAL_CONTROL_PROFILE.version,
        physicsProfile: "rapier-dynamic-rigidbody-v1"
      },
      tracking: {
        enabled: this.pathEnabled && this.pathStatus === "valid" && this.path.length > 0,
        status: this.trackingStatus,
        currentTileId: this.pathStatus === "valid" && this.trackingStatus !== "rescueZone" ? this.currentTileId : null,
        pathTileId: this.pathStatus === "valid" ? this.path[this.pathIndex]?.tileId || null : null,
        occurrenceIndex: this.pathStatus === "valid" ? this.pathIndex : null,
        tileProgress: this.pathStatus === "valid" ? Math.min(this.pathIndex + 1, this.path.length) : 0,
        tileTotal: this.pathStatus === "valid" ? this.path.length : 0,
        segmentIndex: this.pathStatus === "valid" ? this.segmentIndex : null,
        segment: this.pathStatus === "valid" ? this.segmentIndex + 1 : 0,
        total: this.pathStatus === "valid" ? this.pathSegments.length : 0,
        segmentStartOccurrence: segment?.startOccurrence ?? null,
        segmentEndOccurrence: segment?.endOccurrence ?? null,
        segmentStartTileId: segment?.checkpointTileId || null,
        segmentTileIndex: segment ? segmentTileIndex + 1 : null,
        segmentTileTotal,
        deviationCount: this.deviationCount,
        pathSkipCount: this.pathSkipCount,
        visitedOccurrences: [...this.visitedOccurrences],
        visitedTileIds: this.visitedOccurrences.map((index) => this.path[index]?.tileId).filter(Boolean),
        skippedOccurrences: [...this.skippedOccurrences],
        lineFollowing: this.trackingStatus === "tracking" && this.sensors.color === "black-line",
        endGoalStableSeconds: round(this.endGoalStableSeconds, 3),
        checkpointProjections: projections
      },
      routine: {
        resetBeforeStart: this.resetBeforeStart,
        replayableBaseline: this.resetBeforeStart,
        advanceCount: this.advanceCount,
        totalInternalAttempts: this.totalInternalAttempts,
        advancePenaltySecondsApplied: round(this.advancePenaltySecondsApplied),
        skipPathThreshold: this.skipPathThreshold(),
        pathAttempt: this.pathAttempt,
        segmentIndex: this.segmentIndex,
        segment: this.pathStatus === "valid" ? this.segmentIndex + 1 : 0,
        segmentTotal: this.pathStatus === "valid" ? this.pathSegments.length : 0,
        skipPathEligible: this.skipPathThreshold() > 0 && this.pathAttempt >= this.skipPathThreshold()
      },
      path: { status: this.pathStatus, spawnPolicy: this.spawnPolicy, tracks: clone(this.pathSegments) },
     rescueTriggers: this.physics?.rescueTriggerStates?.() || [],
      finishLaneDetectors: this.gameStoppers.map((stopper) => ({ ...stopper, position: { x: round(stopper.position.x), y: round(stopper.position.y), z: round(stopper.position.z) } })),
      settings: clone(this.settings),
      score: { points: round(this.scoreCents / 100, 2), multiplier: this.multiplier, basePoints: round(this.baseScoreCents / 100, 2) },
      motors: clone(this.motors),
      sensors: clone(this.sensors),
      objects: this.objects.map((object) => ({
        key: object.key,
        id: object.id,
        type: object.type,
        tileId: object.tileId,
        dynamic: object.dynamic,
        label: object.label,
        visible: object.visible,
        position: { x: round(object.position.x), y: round(object.position.y), z: round(object.position.z) },
        rotation: object.rotation ? clone(object.rotation) : null,
        velocity: { x: round(object.velocity.x), y: round(object.velocity.y), z: round(object.velocity.z) },
        offsetY: round(object.position.y - (object.initialPosition?.y || object.position.y)),
        seesawAngle: round(object.seesawAngle, 4),
        rescued: object.rescued,
        resolved: object.resolved,
        resolution: object.resolution,
        boxRuntime: object.boxRuntime ? clone(object.boxRuntime) : null
      })),
      lastEvent: this.lastEvent ? clone(this.lastEvent) : null,
      events: clone(this.events.slice(-20))
    };
  }
}
