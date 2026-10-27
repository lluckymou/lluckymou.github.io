import RAPIER from "@dimforge/rapier3d-compat";
import { ARENA_TILE_WALL_CENTER_Y, ARENA_TILE_WALL_SIDE_IDS, ARENA_TILE_WALL_SIDE_LAYOUT, arenaTileIsRamp, arenaTileWallHullPoints, arenaTileVisuals, arenaTileWallVerticalOffset } from "./arena-model.js?imp-ux-02-out-of-bounds-20261027-1";

await RAPIER.init();

export const FIXED_TICK_SECONDS = 1 / 60;
export const PHYSICS_PROFILE = Object.freeze({
  gravityY: -9.81,
  // Internal Rapier motor cap. Servo Diagnostics and the future robot.* API
  // expose only the signed target velocity, never force tuning.
  servoMaxForce: 500,
  // Rapier velocity-motor damping is a fixed internal solver calibration.
  servoMotorDamping: 200,
  robotAdditionalSolverIterations: 4,
  victimRadius: 1.2230963 / 2,
  victimMass: 0.1,
  victimLinearDamping: 0.5,
  victimAngularDamping: 0.05,
  victimFriction: 1,
  victimRestitution: 1,
  defaultFriction: 0.8,
  defaultRestitution: 0.05,
  seesawMass: 10,
  seesawLimitRadians: 20 * Math.PI / 180
});
// Low-speed commands retain the smoother 12-tick transition. High-speed
// breakaway commands need 6 ticks so connected contacts do not settle first.
const SERVO_TARGET_RAMP_TICKS = 12;
const SERVO_HIGH_SPEED_TARGET_RAMP_TICKS = 6;
const SERVO_HIGH_SPEED_TARGET_THRESHOLD = 300;
// Rapier measures rotation against the reflected rigid-group frame, whose
// handedness is opposite the Servo's visible arrow convention.
const SERVO_RAPIER_DIRECTION_SIGN = -1;
function servoTargetRampTicks(targetDegPerSecond) {
  return Math.abs(Number(targetDegPerSecond) || 0) >= SERVO_HIGH_SPEED_TARGET_THRESHOLD
    ? SERVO_HIGH_SPEED_TARGET_RAMP_TICKS
    : SERVO_TARGET_RAMP_TICKS;
}
const SERVO_STALL_CONTACT_TICKS = 3;
const SERVO_STALL_SPEED_RATIO = 0.15;
const SERVO_STALL_MIN_SPEED_DEGREES = 5;
const SERVO_CONTACT_REFRESH_PEAK_SPEED_DEGREES = 100;
const SERVO_CONTACT_REFRESH_MAX_TICKS = 360; // Six seconds at the fixed 60 Hz tick.

const CELL_SIZE = 10;
const LEVEL_HEIGHT = 3.6505;
const BASE_THICKNESS = 0.62;
const BASE_TOP = BASE_THICKNESS / 2;
export const ROBOT_GROUND_SURFACE_OFFSET = BASE_TOP;
const RAMP_TARGET_HIGH = BASE_TOP + LEVEL_HEIGHT;
const RAMP_PLATE_THICKNESS = BASE_THICKNESS;
// Collision groups use one membership bit per physical role. The low word is
// the filter: Robot groups see each other per source joint settings, Arena
// geometry, authored obstacles and the Seesaw plate; static Arena geometry
// and ordinary obstacles never see the Seesaw.
const ROBOT_COLLISION_GROUPS = 0x0001000f;
const ARENA_STATIC_COLLISION_GROUPS = 0x00020007;
const NON_ROBOT_COLLISION_GROUPS = 0x00040007;
const SEESAW_PLATE_COLLISION_GROUPS = 0x00080001;
const ROBOT_SOURCE_SCALE = (CELL_SIZE * 1.05) / (17 * 6);
const ROBOT_GROUND_CLEARANCE = 0.08;
const TOUCH_SENSOR_PRESS_TRAVEL_WORLD = 0.15 * 6 * ROBOT_SOURCE_SCALE;
const ROBOT_PART_MASSES = Object.freeze({
  controller: 1,
  cube: 1,
  wedge: 0.5,
  hinge: 0.25,
  smallWheel: 0.75,
  largeWheel: 1.5,
  buzzer: 1,
  light: 0.75,
  servo: 2,
  colorSensor: 1,
  ultrasonicSensor: 1,
  touchSensor: 1,
  slab: 0.5,
  camera: 1,
  pen: 0.8,
  pyramid: 0.66,
  wedgeColorSensor: 0.5,
  wedgeUltrasonicSensor: 0.5,
  corner: 0.35
});
const ROBOT_TARGET_SPEED = 2.75;
const ROBOT_LINEAR_CONTROL_FORCE = 30;
const ROBOT_LATERAL_BRAKE_FORCE = 46;
const ROBOT_TARGET_ANGULAR_SPEED = 1.2;
const ROBOT_TURN_CONTROL_TORQUE = 110;
const ROBOT_LINEAR_BRAKE_FORCE = 42;
const ROBOT_ANGULAR_BRAKE_TORQUE = 38;
const ROBOT_MAX_SPEED = 5.5;
const ROBOT_MAX_ANGULAR_SPEED = 2.4;
export const SEESAW_PROFILE = Object.freeze({
  // Source prefab values are local to the Tile center; the runtime object
  // sits on the rendered Tile top, so all vertical anchors include BASE_TOP.
  pivotY: 1.07 + BASE_TOP,
  plateOffsetY: 0.614,
  supportCenterY: 0.7124 + BASE_TOP,
  supportHalfHeight: 1.4723223 / 2,
  supportHalfDepth: 0.21756832 / 2,
  axisHalfLength: 0.5,
  axleY: 1.444 + BASE_TOP,
  plateColliderHalfExtents: Object.freeze({ x: 4.85, y: 0.0284, z: 4.965185 }),
  plateColliderCenter: Object.freeze({ x: 0, y: 0.0551, z: 0.0348 }),
  // Unity's source `/` pose is -19°. Arena mirrors Z in the web scene, so
  // the equivalent local Three.js/Rapier pose is +19° around X.
  initialAngleDegrees: 19,
  initialAngleRadians: 19 * Math.PI / 180,
  hingeMinRadians: -19 * Math.PI / 180,
  // In the mirrored web frame, the source `/` pose is +19° and its only
  // allowed opposite pose is -19°, never a full half-turn around the axle.
  hingeMaxRadians: 19 * Math.PI / 180
});
const RESCUE_TRIGGER_WIDTH = CELL_SIZE;
const RESCUE_TRIGGER_DEPTH = CELL_SIZE;
const RESCUE_TRIGGER_HEIGHT = 2.2;
const RESCUE_TRIGGER_LOCAL_X = 0;
const RESCUE_TRIGGER_LOCAL_Z = 0;

const vec = (x = 0, y = 0, z = 0) => ({ x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 });
const rotationY = (degrees = 0) => ({ x: 0, y: Math.sin(Number(degrees) * Math.PI / 360), z: 0, w: Math.cos(Number(degrees) * Math.PI / 360) });
const rotationX = (degrees = 0) => ({ x: Math.sin(Number(degrees) * Math.PI / 360), y: 0, z: 0, w: Math.cos(Number(degrees) * Math.PI / 360) });
const rotationZ = (degrees = 0) => ({ x: 0, y: 0, z: Math.sin(Number(degrees) * Math.PI / 360), w: Math.cos(Number(degrees) * Math.PI / 360) });
const ROBOT_WORLD_SCALE = 6 * ROBOT_SOURCE_SCALE;

const AXIS_VECTOR = Object.freeze({
  "+X": { x: 1, y: 0, z: 0 }, "-X": { x: -1, y: 0, z: 0 },
  "+Y": { x: 0, y: 1, z: 0 }, "-Y": { x: 0, y: -1, z: 0 },
  "+Z": { x: 0, y: 0, z: 1 }, "-Z": { x: 0, y: 0, z: -1 }
});

const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});

function quaternionFromOrientation(orientation = {}) {
  const up = AXIS_VECTOR[String(orientation.up || "+Y").toUpperCase()];
  const forward = AXIS_VECTOR[String(orientation.forward || "+Z").toUpperCase()];
  if (!up || !forward || up.x * forward.x + up.y * forward.y + up.z * forward.z !== 0) {
    throw new Error("invalid robot part orientation");
  }
  const right = cross(up, forward);
  const m00 = right.x, m01 = up.x, m02 = forward.x;
  const m10 = right.y, m11 = up.y, m12 = forward.y;
  const m20 = right.z, m21 = up.z, m22 = forward.z;
  const trace = m00 + m11 + m22;
  let q;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    q = { w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
  }
  const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}

function quaternionMultiply(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

function arenaObjectColliderRotation(rotation = {}) {
  const x = -(Number(rotation.x) || 0);
  const y = -(Number(rotation.y) || 0);
  const z = Number(rotation.z) || 0;
  return quaternionMultiply(quaternionMultiply(rotationX(x), rotationY(y)), rotationZ(z));
}

function arenaObjectWorldRotation(tileRotation = 0, rotation = {}) {
  return quaternionMultiply(rotationY(-Number(tileRotation || 0)), arenaObjectColliderRotation(rotation));
}

function quaternionInverse(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function quaternionFromCapsuleAxis(axis) {
  const length = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const direction = { x: axis.x / length, y: axis.y / length, z: axis.z / length };
  const dot = direction.y;
  if (dot < -0.999999) return { x: 1, y: 0, z: 0, w: 0 };
  const q = { x: direction.z, y: 0, z: -direction.x, w: 1 + dot };
  const qLength = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / qLength, y: q.y / qLength, z: q.z / qLength, w: q.w / qLength };
}

function mirrorRobotQuaternion(q) {
  // Robot parts are reflected on X when mapped from the Unity source frame.
  // Conjugating a rotation by that reflection keeps the box's local axes
  // correct while preserving a proper rotation quaternion. Box geometry is
  // symmetric, so its local X sign does not change the represented shape.
  return { x: q.x, y: -q.y, z: -q.z, w: q.w };
}

function rotateVector(q, value) {
  const u = { x: q.x, y: q.y, z: q.z };
  const uv = cross(u, value);
  const uuv = cross(u, uv);
  return {
    x: value.x + 2 * (q.w * uv.x + uuv.x),
    y: value.y + 2 * (q.w * uv.y + uuv.y),
    z: value.z + 2 * (q.w * uv.z + uuv.z)
  };
}

function mirrorRobotVector(value) {
  return { x: -value.x, y: value.y, z: value.z };
}

function robotPartId(part = {}) {
  return String(part.instanceId || part.id || "");
}

function robotPartType(part = {}) {
  return String(part.typeId || part.id || "");
}

function robotPartOrientation(part = {}) {
  return quaternionFromOrientation(part.orientation || { up: "+Y", forward: "+Z" });
}

function robotMinimumY(topology, blueprint) {
  let minimum = Infinity;
  const controller = topology.byId.get(topology.controllerId);
  const controllerY = Number((controller.position || controller.gridPosition || {}).y) || 0;
  topology.parts.forEach((part) => {
    const id = robotPartId(part);
    const position = part.position || part.gridPosition || {};
    const orientation = robotPartOrientation(part);
    const colliderPart = blueprint?.parts?.[id];
    if (!colliderPart || !Array.isArray(colliderPart.shapes) || !colliderPart.shapes.length) throw new Error("robot part is missing its measured collider geometry");
    colliderPart.shapes.filter((shape) => shape.sensor !== true).forEach((shape) => {
      if (!Array.isArray(shape.points) || shape.points.length < 4 || shape.points.some((point) => !Array.isArray(point) || point.length < 3 || !point.slice(0, 3).every(Number.isFinite))) {
        throw new Error("robot collider geometry is incomplete");
      }
      shape.points.forEach((point) => {
      const local = rotateVector(orientation, vec(point[0], point[1], point[2]));
        minimum = Math.min(minimum, ((Number(position.y) - controllerY) * 6 + local.y) * ROBOT_SOURCE_SCALE);
      });
    });
  });
  if (!Number.isFinite(minimum)) throw new Error("robot has no solid collider geometry");
  return minimum;
}

export function robotSpawnPose(position = {}, robotDocument = {}, blueprint = null) {
  if (!["x", "y", "z"].every((axis) => position[axis] !== null && position[axis] !== undefined && Number.isFinite(Number(position[axis])))) throw new Error("robot spawn pose is invalid");
  if (position.groundY !== undefined && position.groundY !== null && !Number.isFinite(Number(position.groundY))) throw new Error("robot ground frame is invalid");
  const topology = compileRobotGroups(robotDocument);
  const minimumY = robotMinimumY(topology, blueprint);
  const groundY = position.groundY !== undefined && position.groundY !== null && Number.isFinite(Number(position.groundY))
    ? Number(position.groundY)
    : BASE_TOP;
  return {
    ...position,
    y: groundY + ROBOT_GROUND_CLEARANCE - minimumY,
    groundY,
    spawnMinimumY: minimumY
  };
}

export function compileRobotGroups(robot = {}) {
  const parts = Array.isArray(robot.parts) ? robot.parts : [];
  const anchors = robot.anchors || {};
  const byId = new Map();
  parts.forEach((part) => {
    const id = robotPartId(part);
    if (!id || byId.has(id)) throw new Error("invalid robot part identity");
    byId.set(id, part);
  });
  const controllers = parts.filter((part) => robotPartType(part) === "controller");
  if (controllers.length !== 1) throw new Error("robot must have one Controller");
  const controllerId = robotPartId(controllers[0]);
  const parentById = new Map();
  parts.forEach((part) => {
    const id = robotPartId(part);
    const parentId = anchors[id] || part.parentInstanceId || part.parentId || null;
    if (id === controllerId) {
      if (parentId) throw new Error("Controller cannot have a parent");
      parentById.set(id, null);
      return;
    }
    if (!parentId || !byId.has(parentId)) throw new Error("robot part has a missing parent");
    parentById.set(id, parentId);
  });
  parts.forEach((part) => {
    const visited = new Set();
    let cursor = part;
    while (cursor) {
      const id = robotPartId(cursor);
      if (visited.has(id)) throw new Error("robot ancestry contains a cycle");
      visited.add(id);
      if (id === controllerId) return;
      cursor = byId.get(parentById.get(id));
    }
    throw new Error("robot part is disconnected from the Controller");
  });

  const groupForPart = (part) => {
    const visited = new Set();
    let cursor = part;
    while (cursor) {
      const id = robotPartId(cursor);
      if (visited.has(id)) throw new Error("robot ancestry contains a cycle");
      visited.add(id);
      if (["hinge", "servo"].includes(robotPartType(cursor))) return id;
      cursor = byId.get(parentById.get(id));
    }
    return "main";
  };
  const groupsById = new Map([["main", { id: "main", rootPartId: controllerId, parentGroupId: null, jointPartId: null, partIds: [] }]]);
  parts.forEach((part) => {
    const id = robotPartId(part);
    const groupId = groupForPart(part);
    if (!groupsById.has(groupId)) {
      const parentPart = byId.get(parentById.get(groupId));
      groupsById.set(groupId, {
        id: groupId,
        rootPartId: groupId,
        jointPartId: groupId,
        parentGroupId: parentPart ? groupForPart(parentPart) : "main",
        partIds: []
      });
    }
    groupsById.get(groupId).partIds.push(id);
  });
  return {
    controllerId,
    parts,
    byId,
    parentById,
    partToGroup: Object.fromEntries(parts.map((part) => [robotPartId(part), groupForPart(part)])),
    groups: [...groupsById.values()]
  };
}

function worldObjectPoint(tile = {}, local = {}) {
  return vec(
    (Number(tile.x) || 0) * CELL_SIZE + (Number(local.x) || 0),
    (Number(tile.y) || 0) * LEVEL_HEIGHT + (Number(local.y) || 0),
    -((Number(tile.z) || 0) * CELL_SIZE + (Number(local.z) || 0))
  );
}

function tileWorldOrigin(tile = {}) {
  return vec((Number(tile.x) || 0) * CELL_SIZE, (Number(tile.y) || 0) * LEVEL_HEIGHT, -(Number(tile.z) || 0) * CELL_SIZE);
}

function tileRotationRadians(tile = {}) {
  return -((Number(tile.rotation) || 0) * Math.PI) / 180;
}

function rotateY(point = {}, radians = 0) {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return vec(
    (Number(point.x) || 0) * cos + (Number(point.z) || 0) * sin,
    Number(point.y) || 0,
    -(Number(point.x) || 0) * sin + (Number(point.z) || 0) * cos
  );
}

function tileWorldCellCenter(tile = {}, cellX = 0, cellZ = 0) {
  const origin = tileWorldOrigin(tile);
  const local = rotateY({ x: cellX * CELL_SIZE, y: 0, z: -cellZ * CELL_SIZE }, tileRotationRadians(tile));
  return vec(origin.x + local.x, origin.y, origin.z + local.z);
}

function rampPlatePoints() {
  const topCenterY = (BASE_TOP + RAMP_TARGET_HIGH) / 2;
  const halfRise = (RAMP_TARGET_HIGH - BASE_TOP) / 2;
  const lowY = topCenterY - halfRise;
  const highY = topCenterY + halfRise;
  const bottomLowY = lowY - RAMP_PLATE_THICKNESS;
  const bottomHighY = highY - RAMP_PLATE_THICKNESS;
  const halfX = CELL_SIZE / 2;
  const halfZ = CELL_SIZE / 2;
  return [
    [-halfX, highY, -halfZ], [halfX, highY, -halfZ],
    [-halfX, lowY, halfZ], [halfX, lowY, halfZ],
    [-halfX, bottomHighY, -halfZ], [halfX, bottomHighY, -halfZ],
    [-halfX, bottomLowY, halfZ], [halfX, bottomLowY, halfZ]
  ];
}

function sourceTileSize(tile = {}) {
  const definition = tile.definition || {};
  return {
    x: Math.max(1, Number(definition.sizeX) || 1),
    z: Math.max(1, Number(definition.sizeZ) || 1)
  };
}

function dynamicType(type) {
  return ["box", "cuboid", "sphere", "cylinder", "wedge", "pyramid", "corner", "liveVictim", "deadVictim", "rescueKit", "zul"].includes(type);
}

const prefabDynamicTypes = new Set(["liveVictim", "deadVictim", "rescueKit"]);

function colliderDescriptorsForObject(object = {}) {
  if (Number(object.mass) < 0 || object.source?.physics === "visualOnly" || object.physics === "visualOnly") return [];
  const profile = object.colliderBlueprint;
  if (profile?.shapes?.length) {
    return profile.shapes.map((shape) => {
      let desc = null;
      if (shape.kind === "trimesh") {
        if (!Array.isArray(shape.points) || shape.points.length < 3 || !Array.isArray(shape.indices) || shape.indices.length < 3) return null;
        desc = RAPIER.ColliderDesc.trimesh(
          new Float32Array(shape.points.flat()),
          new Uint32Array(shape.indices)
        );
      } else if (shape.kind === "box" && Array.isArray(shape.halfExtents) && shape.halfExtents.length === 3) {
        desc = RAPIER.ColliderDesc.cuboid(shape.halfExtents[0], shape.halfExtents[1], shape.halfExtents[2])
          .setTranslation(shape.center[0], shape.center[1], shape.center[2])
          .setRotation(shape.rotation);
      } else if (shape.kind === "capsule" && Array.isArray(shape.axis) && shape.axis.length === 3) {
        desc = RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius)
          .setTranslation(shape.center[0], shape.center[1], shape.center[2])
          .setRotation(quaternionFromCapsuleAxis(vec(shape.axis[0], shape.axis[1], shape.axis[2])));
      } else if (Array.isArray(shape.points) && shape.points.length >= 4) {
        const minimum = [Infinity, Infinity, Infinity];
        const maximum = [-Infinity, -Infinity, -Infinity];
        shape.points.forEach((point) => point.forEach((value, axis) => {
          minimum[axis] = Math.min(minimum[axis], value);
          maximum[axis] = Math.max(maximum[axis], value);
        }));
        const center = minimum.map((value, axis) => (value + maximum[axis]) / 2);
        const centered = shape.points.flatMap((point) => point.map((value, axis) => value - center[axis]));
        desc = RAPIER.ColliderDesc.convexHull(new Float32Array(centered));
        if (desc) desc.setTranslation(center[0], center[1], center[2]);
      }
      return desc?.setFriction(PHYSICS_PROFILE.defaultFriction).setRestitution(PHYSICS_PROFILE.defaultRestitution) || null;
    }).filter(Boolean);
  }

  const scale = object.physicsScale || [object.scale?.x, object.scale?.y, object.scale?.z];
  const sx = Math.max(0.001, Math.abs(Number(scale?.[0]) || 1));
  const sy = Math.max(0.001, Math.abs(Number(scale?.[1]) || 1));
  const sz = Math.max(0.001, Math.abs(Number(scale?.[2]) || 1));
  if (["liveVictim", "deadVictim"].includes(object.type)) {
    return [RAPIER.ColliderDesc.ball(PHYSICS_PROFILE.victimRadius * Math.max(sx, sy, sz))
      .setFriction(PHYSICS_PROFILE.victimFriction)
      .setRestitution(PHYSICS_PROFILE.victimRestitution)];
  }
  if (object.type === "sphere") return [RAPIER.ColliderDesc.ball(0.5 * Math.max(sx, sy, sz)).setFriction(PHYSICS_PROFILE.defaultFriction)];
  if (object.type === "cylinder") {
    const radius = 0.5 * Math.max(sx, sz);
    return [RAPIER.ColliderDesc.capsule(Math.max(0, sy - radius), radius).setFriction(PHYSICS_PROFILE.defaultFriction)];
  }
  if (["box", "cuboid"].includes(object.type)) return [RAPIER.ColliderDesc.cuboid(0.5 * sx, 0.5 * sy, 0.5 * sz).setFriction(PHYSICS_PROFILE.defaultFriction)];
  return [];
}

function dynamicBodyDesc(object, position, rotation = null) {
  const body = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setAdditionalMass(0)
    .setLinearDamping(object.type === "rescueKit" ? 1 : PHYSICS_PROFILE.victimLinearDamping)
    .setAngularDamping(object.type === "rescueKit" ? 1 : PHYSICS_PROFILE.victimAngularDamping)
    .setCcdEnabled(true)
    .setUserData({ key: object.key, type: object.type });
  return rotation ? body.setRotation(rotation) : body;
}

function staticBodyDesc(position = vec(), rotation = null) {
  const body = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
  return rotation ? body.setRotation(rotation) : body;
}

function ballInsideTriangle(position, radius, trigger) {
  const deltaX = position.x - trigger.center.x;
  const deltaZ = position.z - trigger.center.z;
  const yaw = (Number(trigger.rotationY) || 0) * Math.PI / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const localX = deltaX * cos - deltaZ * sin;
  const localZ = deltaX * sin + deltaZ * cos;
  const halfWidth = (Number(trigger.width) || RESCUE_TRIGGER_WIDTH) / 2 - radius;
  const halfDepth = (Number(trigger.depth) || RESCUE_TRIGGER_DEPTH) / 2 - radius;
  const shapeX = localX - (Number(trigger.offsetX) || 0);
  const shapeZ = localZ - (Number(trigger.offsetZ) || 0);
  // The solver may settle a sphere a few tenths of a millimeter below the
  // analytical floor plane. Keep the detector geometrically strict in X/Z,
  // but allow that contact tolerance vertically so a settled victim can be
  // rescued instead of depending on floating-point luck.
  const verticalTolerance = 0.02;
  const bottom = trigger.center.y + radius - verticalTolerance;
  const top = trigger.center.y + (Number(trigger.height) || RESCUE_TRIGGER_HEIGHT) - radius + verticalTolerance;
  if (halfWidth <= 0 || halfDepth <= 0 || position.y < bottom || position.y > top) return false;
  // The visible/source RescueArea is a right-triangle prism. Shrinking the
  // local bounds by the victim radius makes this a full-volume containment
  // test instead of accepting a partial edge overlap.
  if (shapeX < -halfWidth || shapeZ < -halfDepth || shapeX > halfWidth || shapeZ > halfDepth) return false;
  return trigger.triangleOrientation === "source"
    ? shapeX / halfWidth + shapeZ / halfDepth <= 0
    : shapeX / halfWidth - shapeZ / halfDepth <= 0;
}

export class SimulationPhysics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: PHYSICS_PROFILE.gravityY, z: 0 });
    this.world.timestep = FIXED_TICK_SECONDS;
    this.eventQueue = new RAPIER.EventQueue(true);
    this.bodies = new Map();
    this.colliders = new Map();
    this.triggers = new Map();
    this.robot = null;
    this.intersections = new Set();
    this.contacts = new Set();
    this.robotContactPairs = new Map();
    this.touchSensorContacts = new Map();
    this.seesaws = new Map();
    this.robotJoints = new Map();
    this.robotGroups = new Map();
    this.robotColliderRecords = [];
    this.robotGroupTopology = null;
    this.robotMinimumY = 0;
  }

  dispose() {
    this.eventQueue?.free?.();
    this.world?.free?.();
    this.bodies.clear();
    this.colliders.clear();
    this.triggers.clear();
    this.intersections.clear();
    this.contacts.clear();
    this.robotContactPairs.clear();
    this.touchSensorContacts.clear();
    this.seesaws.clear();
    this.robotJoints.clear();
    this.robotGroups.clear();
    this.robotColliderRecords = [];
    this.robotGroupTopology = null;
    this.robot = null;
  }

  createStaticBox(key, position, halfExtents, rotation = null, options = {}) {
    const body = this.world.createRigidBody(staticBodyDesc(position, rotation));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(options.friction ?? PHYSICS_PROFILE.defaultFriction)
        .setRestitution(options.restitution ?? PHYSICS_PROFILE.defaultRestitution)
        .setCollisionGroups(options.collisionGroups ?? 0xffffffff),
      body
    );
    this.bodies.set(key, body);
    this.colliders.set(collider.handle, { key, type: options.type || "static" });
    return { body, collider };
  }

  createStaticConvexHull(key, position, points, rotation = null, options = {}) {
    const body = this.world.createRigidBody(staticBodyDesc(position, rotation));
    const descriptor = RAPIER.ColliderDesc.convexHull(new Float32Array(points.flatMap(({ x, y, z }) => [x, y, z])));
    if (!descriptor) {
      this.world.removeRigidBody(body);
      throw new Error(`Arena collider hull is invalid: ${key}`);
    }
    const collider = this.world.createCollider(
      descriptor
        .setFriction(options.friction ?? PHYSICS_PROFILE.defaultFriction)
        .setRestitution(options.restitution ?? PHYSICS_PROFILE.defaultRestitution)
        .setCollisionGroups(options.collisionGroups ?? 0xffffffff),
      body
    );
    this.bodies.set(key, body);
    this.colliders.set(collider.handle, { key, type: options.type || "static" });
    return { body, collider };
  }

  createArenaStatics(tiles = []) {
    tiles.forEach((tile) => {
      const size = sourceTileSize(tile);
      const isRamp = arenaTileIsRamp(tile);
      const tileVisuals = arenaTileVisuals(tile);
      const wallVerticalOffset = arenaTileWallVerticalOffset(tile);
      const tileYaw = tileRotationRadians(tile);
      const wallRotation = rotationY(-(Number(tile.rotation) || 0));
      for (let x = 0; x < size.x; x += 1) {
        for (let z = 0; z < size.z; z += 1) {
          const key = `${tile.id}:${isRamp ? "ramp" : "floor"}:${x}:${z}`;
          const position = tileWorldCellCenter(tile, x, z);
          const rotation = rotationY(-(Number(tile.rotation) || 0));
          if (isRamp) {
            const vertices = new Float32Array(rampPlatePoints().flat());
            const body = this.world.createRigidBody(staticBodyDesc(position, rotation));
            const collider = this.world.createCollider(
              // The ramp plate is a convex prism. A convex hull keeps the
              // sloped top two-sided and avoids the one-sided triangle
              // winding failure that lets a dynamic robot fall through it.
              RAPIER.ColliderDesc.convexHull(vertices)
                .setFriction(PHYSICS_PROFILE.defaultFriction)
                .setRestitution(PHYSICS_PROFILE.defaultRestitution)
                .setCollisionGroups(ARENA_STATIC_COLLISION_GROUPS),
              body
            );
            this.bodies.set(key, body);
            this.colliders.set(collider.handle, { key, type: "ramp" });
          } else {
            this.createStaticBox(
              key,
              position,
              vec(CELL_SIZE / 2, BASE_THICKNESS / 2, CELL_SIZE / 2),
              rotation,
              { collisionGroups: ARENA_STATIC_COLLISION_GROUPS }
            );
          }
          ARENA_TILE_WALL_SIDE_IDS.forEach((side) => {
            if (!tileVisuals.walls[side]?.enabled) return;
            const layout = ARENA_TILE_WALL_SIDE_LAYOUT[side];
            if (isRamp) {
              this.createStaticConvexHull(
                `${key}:wall:${side}`,
                position,
                arenaTileWallHullPoints(side, true, wallVerticalOffset),
                rotation,
                { collisionGroups: ARENA_STATIC_COLLISION_GROUPS, type: "tile-wall" }
              );
              return;
            }
            const offset = rotateY({ x: layout.x, y: 0, z: layout.z }, tileYaw);
            this.createStaticBox(
              `${key}:wall:${side}`,
              vec(position.x + offset.x, position.y + ARENA_TILE_WALL_CENTER_Y + wallVerticalOffset, position.z + offset.z),
              vec(layout.halfExtents[0], layout.halfExtents[1], layout.halfExtents[2]),
              wallRotation,
              { collisionGroups: ARENA_STATIC_COLLISION_GROUPS, type: "tile-wall" }
            );
          });
        }
      }
    });
  }

  robotPartPosition(part = {}) {
    const position = part.position || part.gridPosition || {};
    if (!["x", "y", "z"].every((axis) => position[axis] !== null && position[axis] !== undefined && Number.isInteger(Number(position[axis])))) throw new Error("robot part position is invalid");
    return vec(Number(position.x), Number(position.y), Number(position.z));
  }

  robotColliderBlueprintFor(partId, blueprint) {
    const part = blueprint?.parts?.[partId];
    if (!part || !Array.isArray(part.shapes) || !part.shapes.length) throw new Error("robot part is missing its measured collider geometry");
    if (part.shapes.some((shape) => !Array.isArray(shape.points) || shape.points.length < 4 || shape.points.some((point) => !Array.isArray(point) || point.length < 3 || !point.slice(0, 3).every(Number.isFinite)))) {
      throw new Error("robot collider geometry is invalid");
    }
    if (["hinge", "servo"].includes(part.typeId)) {
      const frame = part.jointFrame;
      if (!frame || ![frame.anchor, frame.axis].every((value) => value && ["x", "y", "z"].every((axis) => Number.isFinite(Number(value[axis]))))) {
        throw new Error("robot joint frame is missing or invalid");
      }
      if (Math.hypot(Number(frame.axis.x), Number(frame.axis.y), Number(frame.axis.z)) < 1e-6) throw new Error("robot joint axis is invalid");
    }
    return part;
  }

  robotWorldPartPosition(part, controllerPosition, rootPosition, rootRotation) {
    const partPosition = this.robotPartPosition(part);
    const local = mirrorRobotVector({
      x: (partPosition.x - controllerPosition.x) * ROBOT_WORLD_SCALE,
      y: (partPosition.y - controllerPosition.y) * ROBOT_WORLD_SCALE,
      z: (partPosition.z - controllerPosition.z) * ROBOT_WORLD_SCALE
    });
    const offset = rotateVector(rootRotation, local);
    return vec(rootPosition.x + offset.x, rootPosition.y + offset.y, rootPosition.z + offset.z);
  }

  createRobotGroupBodies(topology, rootPosition, rootRotation) {
    const controller = topology.byId.get(topology.controllerId);
    const controllerPosition = this.robotPartPosition(controller);
    topology.groups.forEach((group) => {
      const rootPart = topology.byId.get(group.rootPartId);
      const position = group.id === "main"
        ? rootPosition
        : this.robotWorldPartPosition(rootPart, controllerPosition, rootPosition, rootRotation);
      const userData = { key: group.id === "main" ? "robot" : `robot-group:${group.id}`, type: group.id === "main" ? "robot" : robotPartType(rootPart), groupId: group.id };
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setRotation(rootRotation)
        .setLinearDamping(0.05)
        .setAngularDamping(0.05)
        .setCcdEnabled(true)
        // Extra iterations apply to the robot's contact and joint island.
        .setAdditionalSolverIterations(PHYSICS_PROFILE.robotAdditionalSolverIterations)
        .setUserData(userData);
      const body = this.world.createRigidBody(desc);
      const record = { ...group, body, rootPart };
      this.robotGroups.set(group.id, record);
      this.bodies.set(group.id === "main" ? "robot" : `robot-group:${group.id}`, body);
      if (group.id === "main") this.robot = { body, collider: null, key: "robot" };
    });
  }

  createRobotGroupColliders(topology, blueprint) {
    topology.groups.forEach((group) => {
      const groupRecord = this.robotGroups.get(group.id);
      const groupRootPosition = this.robotPartPosition(groupRecord.rootPart);
      group.partIds.forEach((partId) => {
        const part = topology.byId.get(partId);
        const typeId = robotPartType(part);
        const mass = ROBOT_PART_MASSES[typeId];
        if (!Number.isFinite(mass)) throw new Error("robot part has no registered mass");
        const shapeRecords = this.robotColliderBlueprintFor(partId, blueprint).shapes;
        const solidWeight = shapeRecords.filter((shape) => shape.sensor !== true)
          .reduce((sum, shape) => sum + Math.max(0, Number(shape.massWeight) || 1), 0);
        if (solidWeight <= 0) throw new Error("robot part has no solid collider geometry");
        const partPosition = this.robotPartPosition(part);
        const partOrientation = robotPartOrientation(part);
        shapeRecords.forEach((shape, shapeIndex) => {
          if (!Array.isArray(shape.points) || shape.points.length < 4) throw new Error("robot collider geometry is incomplete");
          const sourceOffset = {
            x: (partPosition.x - groupRootPosition.x) * 6,
            y: (partPosition.y - groupRootPosition.y) * 6,
            z: (partPosition.z - groupRootPosition.z) * 6
          };
          const solverPoints = [];
          shape.points.forEach((point) => {
            const rotated = rotateVector(partOrientation, vec(point[0], point[1], point[2]));
            const mirrored = mirrorRobotVector({
              x: sourceOffset.x + rotated.x,
              y: sourceOffset.y + rotated.y,
              z: sourceOffset.z + rotated.z
            });
            solverPoints.push(mirrored.x * ROBOT_SOURCE_SCALE, mirrored.y * ROBOT_SOURCE_SCALE, mirrored.z * ROBOT_SOURCE_SCALE);
          });
          const localMinimum = vec(Infinity, Infinity, Infinity);
          const localMaximum = vec(-Infinity, -Infinity, -Infinity);
          for (let index = 0; index + 2 < solverPoints.length; index += 3) {
            const point = vec(solverPoints[index], solverPoints[index + 1], solverPoints[index + 2]);
            localMinimum.x = Math.min(localMinimum.x, point.x);
            localMinimum.y = Math.min(localMinimum.y, point.y);
            localMinimum.z = Math.min(localMinimum.z, point.z);
            localMaximum.x = Math.max(localMaximum.x, point.x);
            localMaximum.y = Math.max(localMaximum.y, point.y);
            localMaximum.z = Math.max(localMaximum.z, point.z);
          }
          const localBoundsCenter = vec(
            (localMinimum.x + localMaximum.x) / 2,
            (localMinimum.y + localMaximum.y) / 2,
            (localMinimum.z + localMaximum.z) / 2
          );
          const localBoundsHalfExtents = vec(
            (localMaximum.x - localMinimum.x) / 2,
            (localMaximum.y - localMinimum.y) / 2,
            (localMaximum.z - localMinimum.z) / 2
          );
          // Rapier's convex hull must be centered in its own collider frame.
          // Keeping a distant group-relative offset in the vertices produced
          // false deep contacts and explosive impulses at touching faces.
          const centeredPoints = solverPoints.map((value, index) => value - localBoundsCenter[["x", "y", "z"][index % 3]]);
          let desc;
          if (shape.kind === "capsule") {
            const shapeCenter = vec(shape.center[0] * 6, shape.center[1] * 6, shape.center[2] * 6);
            const rotatedCenter = rotateVector(partOrientation, shapeCenter);
            const colliderCenter = mirrorRobotVector({
              x: sourceOffset.x + rotatedCenter.x,
              y: sourceOffset.y + rotatedCenter.y,
              z: sourceOffset.z + rotatedCenter.z
            });
            const sourceAxis = rotateVector(partOrientation, vec(shape.axis[0], shape.axis[1], shape.axis[2]));
            const colliderAxis = mirrorRobotVector(sourceAxis);
            const radius = shape.radius * 6 * ROBOT_SOURCE_SCALE;
            const halfHeight = Math.max(0, shape.height / 2 - shape.radius) * 6 * ROBOT_SOURCE_SCALE;
            desc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
              .setTranslation(colliderCenter.x * ROBOT_SOURCE_SCALE, colliderCenter.y * ROBOT_SOURCE_SCALE, colliderCenter.z * ROBOT_SOURCE_SCALE)
              .setRotation(quaternionFromCapsuleAxis(colliderAxis));
          } else if (shape.kind === "box") {
            desc = RAPIER.ColliderDesc.cuboid(
              shape.size[0] * 3 * ROBOT_SOURCE_SCALE,
              shape.size[1] * 3 * ROBOT_SOURCE_SCALE,
              shape.size[2] * 3 * ROBOT_SOURCE_SCALE
            )
              .setTranslation(localBoundsCenter.x, localBoundsCenter.y, localBoundsCenter.z)
              .setRotation(mirrorRobotQuaternion(partOrientation));
          } else {
            desc = RAPIER.ColliderDesc.convexHull(new Float32Array(centeredPoints));
            if (!desc) throw new Error("robot collider mesh is not a valid convex shape");
            desc.setTranslation(localBoundsCenter.x, localBoundsCenter.y, localBoundsCenter.z);
          }
          const isSensor = shape.sensor === true;
          if (isSensor) desc.setSensor(true).setMass(0);
          else {
            const weight = Math.max(0, Number(shape.massWeight) || 1) / solidWeight;
            desc.setMass(mass * weight);
          }
          desc.setFriction(["smallWheel", "largeWheel"].includes(typeId) ? 1.4 : PHYSICS_PROFILE.defaultFriction)
            .setRestitution(PHYSICS_PROFILE.defaultRestitution)
            .setCollisionGroups(ROBOT_COLLISION_GROUPS)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
          const collider = this.world.createCollider(desc, groupRecord.body);
          const touchSensorId = isSensor && typeId === "touchSensor" ? partId : "";
          const colliderId = `${partId}:${shape.id || shapeIndex}`;
          const metadata = { key: "robot", type: isSensor ? "touch-probe" : typeId, partId, groupId: group.id, shapeId: shape.id || String(shapeIndex), touchSensorId, localBoundsCenter: vec(), localBoundsHalfExtents };
          this.colliders.set(collider.handle, metadata);
          this.robotColliderRecords.push({ id: colliderId, partId, typeId, groupId: group.id, shapeId: metadata.shapeId, sensor: isSensor, localBoundsCenter: vec(), localBoundsHalfExtents, collider });
          if (touchSensorId && !this.touchSensorContacts.has(touchSensorId)) this.touchSensorContacts.set(touchSensorId, new Set());
          if (group.id === "main" && !this.robot.collider && !isSensor) this.robot.collider = collider;
        });
      });
    });
  }

  createRobotJoints(topology, blueprint) {
    topology.groups.filter((group) => group.jointPartId).forEach((group) => {
      const part = topology.byId.get(group.jointPartId);
      const typeId = robotPartType(part);
      const partBlueprint = this.robotColliderBlueprintFor(group.jointPartId, blueprint);
      const frame = partBlueprint.jointFrame;
      const partOrientation = robotPartOrientation(part);
      const sourceAnchor = rotateVector(partOrientation, vec(frame.anchor?.x, frame.anchor?.y, frame.anchor?.z));
      const childAnchor = mirrorRobotVector({
        x: sourceAnchor.x * ROBOT_SOURCE_SCALE,
        y: sourceAnchor.y * ROBOT_SOURCE_SCALE,
        z: sourceAnchor.z * ROBOT_SOURCE_SCALE
      });
      const childGroup = this.robotGroups.get(group.id);
      const parentGroup = this.robotGroups.get(group.parentGroupId || "main");
      const anchorOffsetWorld = rotateVector(childGroup.body.rotation(), childAnchor);
      const childTranslation = childGroup.body.translation();
      const anchorWorld = vec(childTranslation.x + anchorOffsetWorld.x, childTranslation.y + anchorOffsetWorld.y, childTranslation.z + anchorOffsetWorld.z);
      const parentTranslation = parentGroup.body.translation();
      const parentRelative = vec(anchorWorld.x - parentTranslation.x, anchorWorld.y - parentTranslation.y, anchorWorld.z - parentTranslation.z);
      const parentAnchor = rotateVector(quaternionInverse(parentGroup.body.rotation()), parentRelative);
      const sourceAxis = rotateVector(partOrientation, vec(frame.axis?.x ?? 0, frame.axis?.y ?? 1, frame.axis?.z ?? 0));
      const axisLocal = mirrorRobotVector(sourceAxis);
      const axisLength = Math.hypot(axisLocal.x, axisLocal.y, axisLocal.z) || 1;
      axisLocal.x /= axisLength;
      axisLocal.y /= axisLength;
      axisLocal.z /= axisLength;
      const record = {
        id: group.jointPartId,
        typeId,
        groupId: group.id,
        parentGroupId: group.parentGroupId || "main",
        body: childGroup.body,
        parentBody: parentGroup.body,
        parentAnchor,
        childAnchor,
        axisLocal,
        locked: typeId === "servo",
        lockedAngle: 0,
        force: PHYSICS_PROFILE.servoMaxForce,
        targetDegPerSecond: 0,
        motorAppliedTargetDegPerSecond: 0,
        motorRampStartDegPerSecond: 0,
        motorRampDurationTicks: SERVO_TARGET_RAMP_TICKS,
        motorRampTick: SERVO_TARGET_RAMP_TICKS,
        stallContactTicks: 0,
        peakVelocitySinceTarget: 0,
        contactRefreshUsed: false,
        contactRefreshActive: false,
        contactRefreshTicks: 0,
        contactHooksActive: false
      };
      if (typeId === "servo") {
        this.createLockedServoJoint(record, false);
      } else this.createRevoluteRobotJoint(record, false);
      this.robotJoints.set(record.id, record);
    });
  }

  createLockedServoJoint(record, wakeUp = true) {
    const frame1 = { x: 0, y: 0, z: 0, w: 1 };
    const frame2 = quaternionMultiply(
      quaternionInverse(record.body.rotation()),
      record.parentBody.rotation()
    );
    const joint = this.world.createImpulseJoint(
      RAPIER.JointData.fixed(record.parentAnchor, frame1, record.childAnchor, frame2),
      record.parentBody,
      record.body,
      wakeUp
    );
    // A locked Servo is represented by the source runtime's FixedJoint.
    // Unity leaves FixedJoint.enableCollision disabled by default, so the
    // connected Robot groups must not push against each other while locked.
    joint.setContactsEnabled(false);
    record.joint = joint;
  }

  createRevoluteRobotJoint(record, wakeUp = true) {
    const parentRotation = record.parentBody.rotation();
    const childAxis = rotateVector(
      quaternionInverse(record.body.rotation()),
      rotateVector(parentRotation, record.axisLocal)
    );
    const joint = this.world.createImpulseJoint(
      RAPIER.JointData.revoluteWithAxes(record.parentAnchor, record.childAnchor, record.axisLocal, childAxis),
      record.parentBody,
      record.body,
      wakeUp
    );
    joint.setContactsEnabled(true);
    record.joint = joint;
    return joint;
  }

  createRobot(position = vec(), yaw = 0, robotDocument = {}, blueprint = null) {
    if (!blueprint?.ready) throw new Error("robot collider geometry is unavailable");
    this.robotGroups.clear();
    this.robotJoints.clear();
    this.robotColliderRecords = [];
    this.touchSensorContacts.clear();
    const topology = compileRobotGroups(robotDocument);
    const spawnPose = Number.isFinite(Number(position.spawnMinimumY)) ? position : robotSpawnPose(position, robotDocument, blueprint);
    const minimumY = Number(spawnPose.spawnMinimumY);
    const groundY = Number(spawnPose.groundY);
    const rootPosition = vec(spawnPose.x, spawnPose.y, spawnPose.z);
    const rootRotation = rotationY(yaw * 180 / Math.PI);
    this.robotMinimumY = minimumY;
    this.robotGroupTopology = topology;
    this.createRobotGroupBodies(topology, rootPosition, rootRotation);
    this.createRobotGroupColliders(topology, blueprint);
    this.createRobotJoints(topology, blueprint);
    this.robot.groundY = groundY;
    this.robot.spawnMinimumY = minimumY;
    return this.robot;
  }

  setRobotPose(position = vec(), yaw = 0, spawnElevation = 0) {
    if (!this.robot?.body) throw new Error("robot physics groups are not compiled");
    const root = this.robot.body;
    const oldRootPosition = root.translation();
    const oldRootRotation = root.rotation();
    const groundY = position.groundY !== undefined && position.groundY !== null && Number.isFinite(Number(position.groundY))
      ? Number(position.groundY)
      : this.robot.groundY;
    const lift = Math.max(0, Number(spawnElevation) || 0);
    const nextPosition = vec(position.x, groundY + ROBOT_GROUND_CLEARANCE - this.robotMinimumY + lift, position.z);
    const nextRotation = rotationY(yaw * 180 / Math.PI);
    const inverseOldRotation = quaternionInverse(oldRootRotation);
    const deltaRotation = quaternionMultiply(nextRotation, inverseOldRotation);
    this.robotGroups.forEach((group) => {
      const previous = group.body.translation();
      const relative = rotateVector(inverseOldRotation, vec(previous.x - oldRootPosition.x, previous.y - oldRootPosition.y, previous.z - oldRootPosition.z));
      const rotated = rotateVector(nextRotation, relative);
      group.body.setTranslation(vec(nextPosition.x + rotated.x, nextPosition.y + rotated.y, nextPosition.z + rotated.z), true);
      group.body.setRotation(quaternionMultiply(deltaRotation, group.body.rotation()), true);
      group.body.setLinvel(vec(), true);
      group.body.setAngvel(vec(), true);
      group.body.wakeUp();
    });
    this.robot.groundY = groundY;
  }

  applyRobotVerticalOffset(offset = 0) {
    const lift = Math.max(0, Number(offset) || 0);
    if (!lift || !this.robotGroups.size) return false;
    this.robotGroups.forEach(({ body }) => {
      const position = body.translation();
      body.setTranslation(vec(position.x, position.y + lift, position.z), true);
      body.setLinvel(vec(), true);
      body.setAngvel(vec(), true);
      body.wakeUp();
    });
    return true;
  }

  moveRobot(position = vec(), yaw = 0) {
    this.setRobotPose(position, yaw);
  }

  robotState() {
    const state = this.state("robot");
    if (!state) return null;
    const forwardVector = rotateVector(state.rotation, { x: 0, y: 0, z: 1 });
    const yaw = Math.atan2(forwardVector.x, forwardVector.z);
    const horizontalSpeed = Math.hypot(state.velocity.x, state.velocity.z);
    const forwardSpeed = state.velocity.x * forwardVector.x + state.velocity.z * forwardVector.z;
    return {
      ...state.position,
      groundY: this.robot.groundY,
      yaw,
      velocity: forwardSpeed,
      speedMagnitude: Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z),
      angularVelocity: state.angularVelocity.y,
      fullyStopped: horizontalSpeed < 0.02 && Math.abs(state.angularVelocity.y) < 0.02,
      grounded: state.position.y + this.robotMinimumY <= this.robot.groundY + ROBOT_GROUND_CLEARANCE + 0.04
    };
  }

  robotGroupStates() {
    return Object.fromEntries([...this.robotGroups.entries()].map(([id, group]) => {
      const translation = group.body.translation();
      const rotation = group.body.rotation();
      return [id, {
        id,
        rootPartId: group.rootPartId,
        partIds: [...group.partIds],
        parentGroupId: group.parentGroupId,
        translation: vec(translation.x, translation.y, translation.z),
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
      }];
    }));
  }

  robotPartFrame(instanceId) {
    const id = String(instanceId || "");
    const topology = this.robotGroupTopology;
    const part = topology?.byId.get(id);
    const groupId = topology?.partToGroup[id];
    const group = groupId ? this.robotGroups.get(groupId) : null;
    if (!part || !group) return null;
    const rootPart = topology.byId.get(group.rootPartId);
    const partPosition = this.robotPartPosition(part);
    const rootPosition = this.robotPartPosition(rootPart);
    const localOffset = mirrorRobotVector({
      x: (partPosition.x - rootPosition.x) * ROBOT_WORLD_SCALE,
      y: (partPosition.y - rootPosition.y) * ROBOT_WORLD_SCALE,
      z: (partPosition.z - rootPosition.z) * ROBOT_WORLD_SCALE
    });
    const groupRotation = group.body.rotation();
    const rotatedOffset = rotateVector(groupRotation, localOffset);
    const groupPosition = group.body.translation();
    return {
      origin: vec(groupPosition.x + rotatedOffset.x, groupPosition.y + rotatedOffset.y, groupPosition.z + rotatedOffset.z),
      groupRotation: { x: groupRotation.x, y: groupRotation.y, z: groupRotation.z, w: groupRotation.w },
      orientation: part.orientation || { up: "+Y", forward: "+Z" },
      groupId
    };
  }

  robotColliderStates() {
    return this.robotColliderRecords.map(({ collider, ...record }) => {
      const rotation = collider.rotation();
      const body = collider.parent();
      const bodyTranslation = body?.translation();
      const metadata = this.colliders.get(collider.handle);
      return {
        ...record,
        worldPosition: this.colliderWorldPosition(collider, metadata),
        worldBoundsSize: this.colliderWorldBoundsSize(collider, metadata),
        worldRotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
        bodyPosition: bodyTranslation ? vec(bodyTranslation.x, bodyTranslation.y, bodyTranslation.z) : null
      };
    });
  }

  colliderWorldPosition(collider, metadata = this.colliders.get(collider?.handle)) {
    if (!collider) return null;
    const position = collider.translation();
    const center = metadata?.localBoundsCenter;
    if (!center) return vec(position.x, position.y, position.z);
    const offset = rotateVector(collider.rotation(), center);
    return vec(position.x + offset.x, position.y + offset.y, position.z + offset.z);
  }

  colliderWorldBoundsSize(collider, metadata = this.colliders.get(collider?.handle)) {
    const half = metadata?.localBoundsHalfExtents;
    if (!collider || !half) return null;
    // Collider bounds are measured in the attached rigid-body's local frame.
    // Primitive capsules may also have a local rotation inside that frame.
    const rotation = collider.parent()?.rotation?.() || collider.rotation();
    const minimum = vec(Infinity, Infinity, Infinity);
    const maximum = vec(-Infinity, -Infinity, -Infinity);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const corner = rotateVector(rotation, { x: half.x * x, y: half.y * y, z: half.z * z });
      minimum.x = Math.min(minimum.x, corner.x);
      minimum.y = Math.min(minimum.y, corner.y);
      minimum.z = Math.min(minimum.z, corner.z);
      maximum.x = Math.max(maximum.x, corner.x);
      maximum.y = Math.max(maximum.y, corner.y);
      maximum.z = Math.max(maximum.z, corner.z);
    }
    return vec(maximum.x - minimum.x, maximum.y - minimum.y, maximum.z - minimum.z);
  }

  touchSensorContact(instanceId) {
    return (this.touchSensorContacts.get(String(instanceId))?.size || 0) > 0;
  }

  touchSensorAnalog(instanceId) {
    const id = String(instanceId);
    const contacts = this.touchSensorContacts.get(id);
    if (!contacts?.size) return 0;
    const probe = this.robotColliderRecords.find((record) => record.partId === id && record.shapeId === "probe" && record.sensor);
    if (!probe) return 0;
    let deepestPenetration = 0;
    contacts.forEach((handle) => {
      const other = this.world.getCollider(handle);
      if (!other) return;
      const contact = probe.collider.contactCollider(other, 0);
      if (contact && Number.isFinite(contact.distance)) deepestPenetration = Math.max(deepestPenetration, -contact.distance);
    });
    return Math.max(0, Math.min(1, deepestPenetration / TOUCH_SENSOR_PRESS_TRAVEL_WORLD));
  }

  limitRobotVelocity() {
    if (!this.robot?.body) return;
    const velocity = this.robot.body.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (horizontalSpeed <= ROBOT_MAX_SPEED) return;
    const scale = ROBOT_MAX_SPEED / horizontalSpeed;
    this.robot.body.setLinvel({ x: velocity.x * scale, y: velocity.y, z: velocity.z * scale }, true);
  }

  limitRobotAngularVelocity() {
    if (!this.robot?.body) return;
    const angularVelocity = this.robot.body.angvel();
    if (Math.abs(angularVelocity.y) <= ROBOT_MAX_ANGULAR_SPEED) return;
    this.robot.body.setAngvel({ x: angularVelocity.x, y: Math.sign(angularVelocity.y) * ROBOT_MAX_ANGULAR_SPEED, z: angularVelocity.z }, true);
  }

  brakeRobot() {
    if (!this.robot?.body) return;
    const body = this.robot.body;
    const velocity = body.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (horizontalSpeed > 1e-4) {
      body.addForce({ x: -velocity.x * ROBOT_LINEAR_BRAKE_FORCE, y: 0, z: -velocity.z * ROBOT_LINEAR_BRAKE_FORCE }, true);
    }
    const angularVelocity = body.angvel();
    if (Math.abs(angularVelocity.y) > 1e-4) body.addTorque({ x: 0, y: -angularVelocity.y * ROBOT_ANGULAR_BRAKE_TORQUE, z: 0 }, true);
    if (horizontalSpeed < 0.015) body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
    if (Math.abs(angularVelocity.y) < 0.015) body.setAngvel({ x: angularVelocity.x, y: 0, z: angularVelocity.z }, true);
  }

  driveRobot(throttle = 0, turn = 0) {
    if (!this.robot?.body) return;
    const body = this.robot.body;
    // Rapier retains added forces between steps. These controls calculate a
    // fresh force for each tick, so discard the previous tick's values first.
    body.resetForces(false);
    body.resetTorques(false);
    const rotation = body.rotation();
    const signedThrottle = Math.max(-2, Math.min(2, Number(throttle) || 0));
    const signedTurn = Math.max(-2, Math.min(2, Number(turn) || 0));
    const projectedForward = rotateVector(rotation, { x: 0, y: 0, z: 1 });
    const forwardLength = Math.hypot(projectedForward.x, projectedForward.z) || 1;
    const forward = { x: projectedForward.x / forwardLength, y: 0, z: projectedForward.z / forwardLength };
    const velocity = body.linvel();
    const forwardSpeed = velocity.x * forward.x + velocity.z * forward.z;
    const right = { x: forward.z, z: -forward.x };
    const lateralSpeed = velocity.x * right.x + velocity.z * right.z;
    const angularVelocity = body.angvel().y;
    if (Math.abs(signedThrottle) > 1e-5 || Math.abs(signedTurn) > 1e-5) {
      const targetSpeed = signedThrottle * ROBOT_TARGET_SPEED;
      const speedError = targetSpeed - forwardSpeed;
      if (Math.abs(signedThrottle) > 1e-5) {
        body.addForce({ x: forward.x * speedError * ROBOT_LINEAR_CONTROL_FORCE, y: 0, z: forward.z * speedError * ROBOT_LINEAR_CONTROL_FORCE }, true);
      } else if (Math.abs(forwardSpeed) > 1e-4) {
        body.addForce({ x: -forward.x * forwardSpeed * ROBOT_LINEAR_BRAKE_FORCE, y: 0, z: -forward.z * forwardSpeed * ROBOT_LINEAR_BRAKE_FORCE }, true);
      }
      if (Math.abs(lateralSpeed) > 1e-4) body.addForce({ x: -right.x * lateralSpeed * ROBOT_LATERAL_BRAKE_FORCE, y: 0, z: -right.z * lateralSpeed * ROBOT_LATERAL_BRAKE_FORCE }, true);
      if (Math.abs(signedTurn) > 1e-5) {
        const targetAngularSpeed = signedTurn * ROBOT_TARGET_ANGULAR_SPEED;
        body.addTorque({ x: 0, y: (targetAngularSpeed - angularVelocity) * ROBOT_TURN_CONTROL_TORQUE, z: 0 }, true);
      } else if (Math.abs(angularVelocity) > 1e-4) {
        body.addTorque({ x: 0, y: -angularVelocity * ROBOT_ANGULAR_BRAKE_TORQUE, z: 0 }, true);
      }
    } else {
      this.brakeRobot();
    }
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (horizontalSpeed > ROBOT_MAX_SPEED) {
      const scale = ROBOT_MAX_SPEED / horizontalSpeed;
      body.setLinvel({ x: velocity.x * scale, y: velocity.y, z: velocity.z * scale }, true);
    }
  }

  setRobotManualVelocity(throttle = 0, turn = 0, translationSpeed = 0, yawSpeedDegrees = 0) {
    const body = this.robot?.body;
    if (!body) return;
    const amount = (value) => Math.max(-2, Math.min(2, Number(value) || 0));
    const rotation = body.rotation();
    const projectedForward = rotateVector(rotation, { x: 0, y: 0, z: 1 });
    const forwardLength = Math.hypot(projectedForward.x, projectedForward.z) || 1;
    const forward = { x: projectedForward.x / forwardLength, z: projectedForward.z / forwardLength };
    const velocity = body.linvel();
    const angularVelocity = body.angvel();
    const linearSpeed = amount(throttle) * Math.max(0, Number(translationSpeed) || 0);
    const yawSpeed = amount(turn) * Math.max(0, Number(yawSpeedDegrees) || 0) * Math.PI / 180;
    body.setLinvel({ x: forward.x * linearSpeed, y: velocity.y, z: forward.z * linearSpeed }, true);
    body.setAngvel({ x: angularVelocity.x, y: yawSpeed, z: angularVelocity.z }, true);
  }

  stopRobotManualMovement() {
    this.robotGroups.forEach(({ body }) => {
      const velocity = body.linvel();
      const angularVelocity = body.angvel();
      body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
      body.setAngvel({ x: angularVelocity.x, y: 0, z: angularVelocity.z }, true);
    });
  }

  commandRobotJoints(command = {}) {
    this.robotJoints.forEach((record) => {
      const explicitTarget = command.targetById?.[record.id] ?? command.targetDegPerSecond;
      const hasTargetCommand = explicitTarget !== undefined;
      const targetDegPerSecond = !hasTargetCommand
        ? record.targetDegPerSecond
        : Math.max(-500, Math.min(500, Number(explicitTarget) || 0));
      const force = PHYSICS_PROFILE.servoMaxForce;
      const wasLocked = record.locked;
      const requestedLock = command.lockedById?.[record.id] ?? command.locked ?? record.locked;
      // Applying a nonzero target is also the Servo's implicit unlock command.
      const targetAutoUnlock = record.typeId === "servo" && hasTargetCommand && targetDegPerSecond !== 0;
      const locked = targetAutoUnlock ? false : requestedLock;
      record.force = force;
      record.targetDegPerSecond = targetDegPerSecond;
      if (record.typeId !== "servo") return;
      if (locked === true) {
        if (!record.locked) {
          record.lockedAngle = this.jointAngle(record);
          this.world.removeImpulseJoint(record.joint, false);
          record.locked = true;
          this.createLockedServoJoint(record, true);
        }
        record.motorAppliedTargetDegPerSecond = 0;
        record.motorRampStartDegPerSecond = 0;
        record.motorRampDurationTicks = SERVO_TARGET_RAMP_TICKS;
        record.motorRampTick = record.motorRampDurationTicks;
        record.stallContactTicks = 0;
        record.contactRefreshUsed = false;
        record.contactRefreshActive = false;
        record.contactRefreshTicks = 0;
        this.setServoContactHooks(record, false);
      } else if (locked === false) {
        if (record.locked) {
          this.world.removeImpulseJoint(record.joint, false);
          record.locked = false;
          this.createRevoluteRobotJoint(record, true);
          record.motorAppliedTargetDegPerSecond = 0;
        }
        if (targetDegPerSecond === 0) {
          record.motorAppliedTargetDegPerSecond = 0;
          record.motorRampStartDegPerSecond = 0;
          record.motorRampDurationTicks = SERVO_TARGET_RAMP_TICKS;
          record.motorRampTick = record.motorRampDurationTicks;
          record.stallContactTicks = 0;
          record.contactRefreshUsed = false;
          record.contactRefreshActive = false;
          record.contactRefreshTicks = 0;
          this.setServoContactHooks(record, false);
        } else if (hasTargetCommand || wasLocked) {
          // Ramp from measured motion, not the old target: a stopped motor at
          // a hard contact must be able to reverse without inheriting +500.
          record.motorRampStartDegPerSecond = this.jointAngularVelocity(record) * SERVO_RAPIER_DIRECTION_SIGN * 180 / Math.PI;
          record.motorAppliedTargetDegPerSecond = record.motorRampStartDegPerSecond;
          record.motorRampDurationTicks = servoTargetRampTicks(targetDegPerSecond);
          record.motorRampTick = 0;
          record.stallContactTicks = 0;
          record.peakVelocitySinceTarget = Math.abs(this.jointAngularVelocity(record) * 180 / Math.PI);
          record.contactRefreshUsed = false;
          record.contactRefreshActive = false;
          record.contactRefreshTicks = 0;
          this.setServoContactHooks(record, false);
        }
        record.joint.setMotorMaxForce(Math.max(0, force));
        record.joint.configureMotorVelocity(record.motorAppliedTargetDegPerSecond * SERVO_RAPIER_DIRECTION_SIGN * Math.PI / 180, PHYSICS_PROFILE.servoMotorDamping);
        // Rapier may leave a connected body asleep after a motor target changes.
        // Wake both sides now so the next fixed tick applies the new command.
        record.body.wakeUp();
        record.parentBody.wakeUp();
      }
    });
  }

  robotGroupHasConnectedContacts(record) {
    return this.robotColliderRecords
      .filter((collider) => collider.groupId === record.groupId && !collider.sensor)
      .some((collider) => {
        let connected = false;
        this.world.contactPairsWith(collider.collider, (other) => {
          if (this.colliders.get(other.handle)?.groupId === record.parentGroupId) connected = true;
        });
        return connected;
      });
  }

  setServoContactHooks(record, enabled) {
    if (record.contactHooksActive === enabled) return;
    this.robotColliderRecords
      .filter((collider) => collider.groupId === record.groupId && !collider.sensor)
      .forEach((collider) => collider.collider.setActiveHooks(enabled ? RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS : RAPIER.ActiveHooks.NONE));
    record.contactHooksActive = enabled;
  }

  prepareServoMotors() {
    const refreshContacts = [];
    this.robotJoints.forEach((record) => {
      if (record.typeId !== "servo" || record.locked) return;
      if (record.motorRampTick < record.motorRampDurationTicks) {
        record.motorRampTick += 1;
        const fraction = record.motorRampTick / record.motorRampDurationTicks;
        record.motorAppliedTargetDegPerSecond = record.motorRampStartDegPerSecond
          + (record.targetDegPerSecond - record.motorRampStartDegPerSecond) * fraction;
        record.joint.configureMotorVelocity(record.motorAppliedTargetDegPerSecond * SERVO_RAPIER_DIRECTION_SIGN * Math.PI / 180, PHYSICS_PROFILE.servoMotorDamping);
      }
      const speed = Math.abs(this.jointAngularVelocity(record) * 180 / Math.PI);
      record.peakVelocitySinceTarget = Math.max(record.peakVelocitySinceTarget, speed);
      const targetMagnitude = Math.abs(record.targetDegPerSecond);
      if (!record.contactRefreshUsed
        && targetMagnitude > 0
        && record.peakVelocitySinceTarget < SERVO_CONTACT_REFRESH_PEAK_SPEED_DEGREES
        && speed < Math.max(SERVO_STALL_MIN_SPEED_DEGREES, targetMagnitude * SERVO_STALL_SPEED_RATIO)
        && this.robotGroupHasConnectedContacts(record)) {
        record.stallContactTicks += 1;
      } else {
        record.stallContactTicks = 0;
      }
      if (!record.contactRefreshUsed && record.stallContactTicks >= SERVO_STALL_CONTACT_TICKS) {
        record.contactRefreshUsed = true;
        record.contactRefreshActive = true;
      }
      if (record.contactRefreshActive) {
        record.contactRefreshTicks += 1;
        this.setServoContactHooks(record, true);
        refreshContacts.push(record);
      }
    });
    return refreshContacts;
  }

  jointAngle(record) {
    const parentRotation = record.parentBody.rotation();
    const bodyRotation = record.body.rotation();
    const relative = quaternionMultiply(quaternionInverse(parentRotation), bodyRotation);
    const projected = relative.x * record.axisLocal.x + relative.y * record.axisLocal.y + relative.z * record.axisLocal.z;
    const raw = 2 * Math.atan2(projected, relative.w);
    return Math.atan2(Math.sin(raw), Math.cos(raw));
  }

  jointAngularVelocity(record) {
    const parentRotation = record.parentBody.rotation();
    const worldAxis = rotateVector(parentRotation, record.axisLocal);
    const parentVelocity = record.parentBody.angvel();
    const bodyVelocity = record.body.angvel();
    return (bodyVelocity.x - parentVelocity.x) * worldAxis.x
      + (bodyVelocity.y - parentVelocity.y) * worldAxis.y
      + (bodyVelocity.z - parentVelocity.z) * worldAxis.z;
  }

  robotJointStates() {
    return Object.fromEntries([...this.robotJoints.entries()].map(([id, record]) => {
      const directionSign = record.typeId === "servo" ? SERVO_RAPIER_DIRECTION_SIGN : 1;
      return [id, {
        id,
        typeId: record.typeId,
        locked: record.locked,
        angleDeg: Number((this.jointAngle(record) * directionSign * 180 / Math.PI).toFixed(3)),
        velocityDegPerSecond: Number((this.jointAngularVelocity(record) * directionSign * 180 / Math.PI).toFixed(3)),
        force: record.force,
        targetDegPerSecond: record.targetDegPerSecond
      }];
    }));
  }

  createDynamicObject(object, position, rotation = null) {
    const descriptions = colliderDescriptorsForObject(object);
    if (!descriptions.length) return null;
    const body = this.world.createRigidBody(dynamicBodyDesc(object, object.physicsPosition || position, object.physicsRotation || rotation));
    const colliders = descriptions.map((desc) => {
      desc.setMass((Number(object.mass) || PHYSICS_PROFILE.victimMass) / descriptions.length);
      desc.setCollisionGroups(NON_ROBOT_COLLISION_GROUPS);
      desc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const collider = this.world.createCollider(desc, body);
      this.colliders.set(collider.handle, { key: object.key, type: object.type });
      return collider;
    });
    const record = { body, collider: colliders[0], colliders, key: object.key, type: object.type };
    this.bodies.set(object.key, body);
    return record;
  }

  addRuntimeDynamicObject(object) {
    if (!object?.key || !this.world || this.bodies.has(object.key)) return null;
    return this.createDynamicObject(object, object.physicsPosition || object.position, object.physicsRotation || null);
  }

  removeRuntimeObject(key) {
    const body = this.bodies.get(key);
    if (body) {
      for (const [handle, collider] of this.colliders) {
        if (collider.key === key) this.colliders.delete(handle);
      }
      this.world.removeRigidBody(body);
    }
    this.bodies.delete(key);
    this.robotContactPairs.delete(key);
    this.contacts.delete(key);
    return Boolean(body);
  }

  replaceRuntimeObjectBody(object, previousState = null) {
    if (!object?.key || !this.world) return false;
    const previous = previousState || this.state(object.key);
    this.removeRuntimeObject(object.key);
    if (Number(object.mass) < 0 || object.source?.physics === "visualOnly" || object.physics === "visualOnly") return true;
    const position = object.physicsPosition || object.position;
    const rotation = object.physicsRotation || object.rotation || null;
    const mass = Number(object.mass) || 0;
    const hasDynamicBody = dynamicType(object.type) && (mass > 0 || (mass === 0 && prefabDynamicTypes.has(object.type)));
    if (hasDynamicBody) {
      const record = this.createDynamicObject(object, position, rotation);
      if (!record) return false;
      if (previous) {
        record.body.setLinvel(previous.velocity, true);
        record.body.setAngvel(previous.angularVelocity, true);
      }
      return true;
    }
    const descriptions = colliderDescriptorsForObject(object);
    if (!descriptions.length) return false;
    const body = this.world.createRigidBody(staticBodyDesc(position, rotation));
    descriptions.forEach((description) => {
      description.setCollisionGroups(NON_ROBOT_COLLISION_GROUPS);
      const collider = this.world.createCollider(description, body);
      this.colliders.set(collider.handle, { key: object.key, type: object.type });
    });
    this.bodies.set(object.key, body);
    return true;
  }

  setRuntimeObjectPose(key, position, rotation = null) {
    const body = this.bodies.get(key);
    if (!body) return false;
    this.robotContactPairs.delete(key);
    this.contacts.delete(key);
    body.setTranslation(vec(position?.x, position?.y, position?.z), true);
    if (rotation) body.setRotation(rotation, true);
    body.setLinvel(vec(), true);
    body.setAngvel(vec(), true);
    body.wakeUp();
    return true;
  }

  isRobotContacting(key) {
    return Boolean(this.robotContactPairs.get(key)?.size);
  }

  captureRobotRelativePose(key) {
    const objectBody = this.bodies.get(key);
    const robotBody = this.robot?.body;
    if (!objectBody || !robotBody) return null;
    const robotPosition = robotBody.translation();
    const objectPosition = objectBody.translation();
    const robotRotation = robotBody.rotation();
    const inverseRobotRotation = quaternionInverse(robotRotation);
    return {
      position: rotateVector(inverseRobotRotation, vec(
        objectPosition.x - robotPosition.x,
        objectPosition.y - robotPosition.y,
        objectPosition.z - robotPosition.z
      )),
      rotation: quaternionMultiply(inverseRobotRotation, objectBody.rotation())
    };
  }

  worldPoseFromRobotRelative(relativePose, robotPose) {
    const robotRotation = rotationY((Number(robotPose?.yaw) || 0) * 180 / Math.PI);
    const offset = rotateVector(robotRotation, relativePose?.position || vec());
    return {
      position: vec(
        (Number(robotPose?.x) || 0) + offset.x,
        (Number(robotPose?.y) || 0) + offset.y,
        (Number(robotPose?.z) || 0) + offset.z
      ),
      rotation: quaternionMultiply(robotRotation, relativePose?.rotation || rotationY(0))
    };
  }

  createSeesaw(object, position, rotation = null) {
    const bodyPosition = object.physicsPosition || position;
    const bodyRotation = object.physicsRotation || rotation || rotationY(0);
    const scale = object.physicsScale || [1, 1, 1];
    const sx = Math.max(0.001, Math.abs(Number(scale[0]) || 1));
    const sy = Math.max(0.001, Math.abs(Number(scale[1]) || 1));
    const sz = Math.max(0.001, Math.abs(Number(scale[2]) || 1));
    const pivotOffset = rotateVector(bodyRotation, vec(0, SEESAW_PROFILE.pivotY * sy, 0));
    const pivot = vec(bodyPosition.x + pivotOffset.x, bodyPosition.y + pivotOffset.y, bodyPosition.z + pivotOffset.z);
    const supportDescriptions = colliderDescriptorsForObject(object);
    if (!supportDescriptions.length) throw new Error(`Seesaw source support colliders are invalid: ${object.key}`);
    const supportBody = this.world.createRigidBody(staticBodyDesc(bodyPosition, bodyRotation));
    supportDescriptions.forEach((desc) => {
      desc.setCollisionGroups(ARENA_STATIC_COLLISION_GROUPS).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
      const collider = this.world.createCollider(desc, supportBody);
      this.colliders.set(collider.handle, { key: object.key, type: "seesaw-support" });
    });
    this.bodies.set(`${object.key}:supports`, supportBody);
    const fulcrumBody = this.world.createRigidBody(staticBodyDesc(pivot, bodyRotation));
    this.bodies.set(`${object.key}:fulcrum`, fulcrumBody);
    const plateOffset = rotateVector(bodyRotation, vec(0, SEESAW_PROFILE.plateOffsetY * sy, 0));
    const platePosition = vec(pivot.x + plateOffset.x, pivot.y + plateOffset.y, pivot.z + plateOffset.z);
    const initialAngle = SEESAW_PROFILE.initialAngleRadians;
    const jointAnchor = {
      x: 0,
      y: -SEESAW_PROFILE.plateOffsetY * sy * Math.cos(initialAngle),
      z: SEESAW_PROFILE.plateOffsetY * sy * Math.sin(initialAngle)
    };
    const initialRotation = quaternionMultiply(bodyRotation, rotationX(SEESAW_PROFILE.initialAngleDegrees));
    const plateBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(platePosition.x, platePosition.y, platePosition.z)
        .setRotation(initialRotation)
        // The source fulcrum balances the plate; gravity must not create an
        // autonomous flip before the robot contacts it.
        .setGravityScale(0)
        .setAdditionalMass(0)
        .setLinearDamping(0)
        .setAngularDamping(0.05)
        .setCcdEnabled(true)
        .setUserData({ key: object.key, type: "seesaw" })
    );
    const plateCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        SEESAW_PROFILE.plateColliderHalfExtents.x * sx,
        SEESAW_PROFILE.plateColliderHalfExtents.y * sy,
        SEESAW_PROFILE.plateColliderHalfExtents.z * sz
      )
        .setTranslation(
          SEESAW_PROFILE.plateColliderCenter.x * sx,
          SEESAW_PROFILE.plateColliderCenter.y * sy,
          SEESAW_PROFILE.plateColliderCenter.z * sz
        )
        .setMass(Number(object.mass) > 0 ? Number(object.mass) : PHYSICS_PROFILE.seesawMass)
        .setFriction(PHYSICS_PROFILE.defaultFriction)
        .setRestitution(PHYSICS_PROFILE.defaultRestitution)
        .setCollisionGroups(SEESAW_PLATE_COLLISION_GROUPS)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      plateBody
    );
    const joint = this.world.createImpulseJoint(
      RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, jointAnchor, { x: 1, y: 0, z: 0 }),
      fulcrumBody,
      plateBody,
      true
    );
    joint.setLimits(SEESAW_PROFILE.hingeMinRadians, SEESAW_PROFILE.hingeMaxRadians);
    this.bodies.set(object.key, plateBody);
    this.colliders.set(plateCollider.handle, { key: object.key, type: "seesaw" });
    this.seesaws.set(object.key, { body: plateBody, collider: plateCollider, joint, initialPosition: platePosition, initialRotation, initialAngle });
    return this.seesaws.get(object.key);
  }

  createEvacuationTrigger(object, tile) {
    const projection = object.rescueTrigger || null;
    const root = projection?.center || vec(object.position?.x, object.position?.y, object.position?.z);
    const center = projection?.center ? vec(root.x, root.y, root.z) : vec(root.x + RESCUE_TRIGGER_LOCAL_X, root.y - 0.44, root.z + RESCUE_TRIGGER_LOCAL_Z);
    const width = Number(projection?.width) || RESCUE_TRIGGER_WIDTH;
    const depth = Number(projection?.depth) || RESCUE_TRIGGER_DEPTH;
    const height = Number(projection?.height) || RESCUE_TRIGGER_HEIGHT;
    const triangleOrientation = projection?.triangleOrientation || "legacy";
    const offsetX = Number(projection?.offsetX) || 0;
    const offsetZ = Number(projection?.offsetZ) || 0;
    const body = this.world.createRigidBody(staticBodyDesc(center, projection?.rotationY === undefined ? null : rotationY(projection.rotationY)));
    const sourceTriangle = triangleOrientation === "source";
    const backX = sourceTriangle ? -width / 2 : width / 2;
    const points = new Float32Array([
      -width / 2, 0, -depth / 2,
      width / 2, 0, -depth / 2,
      backX, 0, depth / 2,
      -width / 2, height, -depth / 2,
      width / 2, height, -depth / 2,
      backX, height, depth / 2
    ]);
    for (let index = 0; index < points.length; index += 3) {
      points[index] += offsetX;
      points[index + 2] += offsetZ;
    }
    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) throw new Error(`evacuation trigger collider is invalid for ${object.key}`);
    desc.setSensor(true).setCollisionGroups(NON_ROBOT_COLLISION_GROUPS).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = this.world.createCollider(desc, body);
    const trigger = { key: object.key, objectId: object.id, tileId: tile.id, center, width, depth, height, offsetX, offsetZ, rotationY: projection?.rotationY || 0, triangleOrientation, collider, body };
    this.triggers.set(object.key, trigger);
    this.colliders.set(collider.handle, { key: object.key, type: "rescue-trigger", trigger: true });
    return trigger;
  }

  build({ tiles = [], objects = [], robot = vec(), robotParts = [], robotDocument = null, robotPhysicsBlueprint = null } = {}) {
    const robotSource = robotDocument || { parts: robotParts };
    const spawnPose = Number.isFinite(Number(robot.spawnMinimumY)) ? robot : robotSpawnPose(robot, robotSource, robotPhysicsBlueprint);
    this.createArenaStatics(tiles);
    this.createRobot(spawnPose, spawnPose.yaw, robotSource, robotPhysicsBlueprint);
    objects.forEach((object) => {
      const tile = tiles.find((candidate) => candidate.id === object.tileId);
      if (!tile || object.type === "none") return;
      const position = vec(object.position?.x, object.position?.y, object.position?.z);
      const physicsPosition = object.physicsPosition || position;
      const sourceRotation = object.source?.rotation || object.rotation || {};
      const worldRotation = object.physicsRotation || arenaObjectWorldRotation(tile.rotation, sourceRotation);
      const mass = Number(object.mass) || 0;
      if (mass < 0 || object.source?.physics === "visualOnly" || object.physics === "visualOnly") return;
      const hasDynamicBody = dynamicType(object.type) && (mass > 0 || (mass === 0 && prefabDynamicTypes.has(object.type)));
      if (hasDynamicBody && !this.createDynamicObject(object, physicsPosition, worldRotation)) throw new Error(`Arena object has no valid collider: ${object.key}`);
      if (object.type === "seesaw") this.createSeesaw(object, physicsPosition, worldRotation);
      if (object.type === "evacuationPoint") {
        this.createEvacuationTrigger(object, tile);
        const descriptions = colliderDescriptorsForObject(object);
        if (!descriptions.length) throw new Error(`EvacuationPoint source colliders are missing: ${object.key}`);
        const body = this.world.createRigidBody(staticBodyDesc(physicsPosition, worldRotation));
        descriptions.forEach((desc) => {
          desc.setCollisionGroups(NON_ROBOT_COLLISION_GROUPS);
          const collider = this.world.createCollider(desc, body);
          this.colliders.set(collider.handle, { key: object.key, type: "evacuationPoint" });
        });
        this.bodies.set(object.key, body);
      } else if (!hasDynamicBody && object.type !== "seesaw") {
        const descriptions = colliderDescriptorsForObject(object);
        if (!descriptions.length) throw new Error(`Arena object has no valid collider: ${object.key}`);
        const body = this.world.createRigidBody(staticBodyDesc(physicsPosition, worldRotation));
        descriptions.forEach((desc) => {
          desc.setCollisionGroups(NON_ROBOT_COLLISION_GROUPS);
          const collider = this.world.createCollider(desc, body);
          this.colliders.set(collider.handle, { key: object.key, type: object.type });
        });
        this.bodies.set(object.key, body);
      }
    });
  }

  step() {
    this.intersections.clear();
    this.contacts.clear();
    const contactRefreshes = this.prepareServoMotors();
    if (contactRefreshes.length) {
      // Explicitly run Rapier's impulse solver for the moving Servo groups'
      // contacts while they break out of a connected-group stall. The hook
      // returns COMPUTE_IMPULSE for every pair; it never suppresses contacts.
      const hooks = {
        filterContactPair: () => RAPIER.SolverFlags.COMPUTE_IMPULSE,
        filterIntersectionPair: () => true
      };
      this.world.step(this.eventQueue, hooks);
      contactRefreshes.forEach((record) => {
        const speed = Math.abs(this.jointAngularVelocity(record) * 180 / Math.PI);
        if (speed >= Math.max(25, Math.abs(record.targetDegPerSecond) * SERVO_STALL_SPEED_RATIO)
          || record.contactRefreshTicks >= SERVO_CONTACT_REFRESH_MAX_TICKS) {
          record.contactRefreshActive = false;
          this.setServoContactHooks(record, false);
        }
      });
    } else {
      this.world.step(this.eventQueue);
    }
    this.robotJoints.forEach((record) => {
      if (record.typeId === "servo" && !record.locked) {
        record.peakVelocitySinceTarget = Math.max(record.peakVelocitySinceTarget, Math.abs(this.jointAngularVelocity(record) * 180 / Math.PI));
      }
    });
    this.limitRobotVelocity();
    this.limitRobotAngularVelocity();
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => this.processCollisionEvent(handle1, handle2, started));
  }

  processCollisionEvent(handle1, handle2, started) {
    const first = this.colliders.get(handle1);
    const second = this.colliders.get(handle2);
    if (!first || !second) return;
    const touchSensor = first.touchSensorId ? first : second.touchSensorId ? second : null;
    if (touchSensor) {
      const otherHandle = touchSensor === first ? handle2 : handle1;
      const other = touchSensor === first ? second : first;
      if (other.key !== "robot" && !other.trigger) {
        const contacts = this.touchSensorContacts.get(touchSensor.touchSensorId) || new Set();
        if (started) contacts.add(otherHandle);
        else contacts.delete(otherHandle);
        if (contacts.size) this.touchSensorContacts.set(touchSensor.touchSensorId, contacts);
        else this.touchSensorContacts.delete(touchSensor.touchSensorId);
      }
    }
    const robotObject = first.key === "robot" ? second : second.key === "robot" ? first : null;
    if (robotObject?.type === "rescueKit") {
      const pairs = this.robotContactPairs.get(robotObject.key) || new Set();
      const pairKey = [handle1, handle2].sort((a, b) => a - b).join(":");
      if (started) pairs.add(pairKey);
      else pairs.delete(pairKey);
      if (pairs.size) this.robotContactPairs.set(robotObject.key, pairs);
      else this.robotContactPairs.delete(robotObject.key);
    }
    if (!started) return;
    const trigger = first.trigger ? first : second.trigger ? second : null;
    const object = first.trigger ? second : second.trigger ? first : null;
    if (trigger && object) this.intersections.add(`${trigger.key}|${object.key}`);
    if (robotObject && ["liveVictim", "deadVictim", "rescueKit"].includes(robotObject.type)) this.contacts.add(robotObject.key);
  }

  bootstrap() {
    // Rapier refreshes its broad phase during a step, so synchronize once
    // before exposing the initial simulation snapshot.
    this.world.step(this.eventQueue);
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => this.processCollisionEvent(handle1, handle2, started));
    this.intersections.clear();
    this.contacts.clear();
  }

  raycast(origin, direction, maxDistance = 32, includeCollider = null) {
    const length = Math.hypot(Number(direction?.x) || 0, Number(direction?.y) || 0, Number(direction?.z) || 0) || 1;
    const ray = new RAPIER.Ray(
      vec(origin?.x, origin?.y, origin?.z),
      vec((Number(direction?.x) || 0) / length, (Number(direction?.y) || 0) / length, (Number(direction?.z) || 0) / length)
    );
    const hit = this.world.castRay(
      ray,
      Math.max(0, Number(maxDistance) || 0),
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (collider) => {
        const meta = this.colliders.get(collider.handle);
        const key = String(meta?.key || "");
        return key !== "robot" && !key.startsWith("robot-joint:")
          && (typeof includeCollider !== "function" || includeCollider(key, meta?.type || "unknown"));
      }
    );
    if (!hit) return null;
    const meta = this.colliders.get(hit.collider.handle);
    return {
      distance: Number(hit.timeOfImpact) || -1,
      colliderKey: meta?.key || "",
      colliderType: meta?.type || "unknown"
    };
  }

  state(key) {
    const body = this.bodies.get(key);
    if (!body || !body.isValid()) return null;
    const position = body.translation();
    const rotation = body.rotation();
    const velocity = body.linvel();
    const angularVelocity = body.angvel();
    return {
      position: vec(position.x, position.y, position.z),
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      velocity: vec(velocity.x, velocity.y, velocity.z),
      angularVelocity: vec(angularVelocity.x, angularVelocity.y, angularVelocity.z)
    };
  }

  arenaColliderDebugRender() {
    if (typeof this.world?.debugRender !== "function") return null;
    return this.world.debugRender(undefined, (collider) => this.colliders.get(collider.handle)?.key !== "robot");
  }

  seesawState(key) {
    const record = this.seesaws.get(key);
    if (!record) return null;
    const state = this.state(key);
    if (!state) return null;
    const absoluteAngle = 2 * Math.atan2(state.rotation.x, state.rotation.w);
    const angle = Math.max(SEESAW_PROFILE.hingeMinRadians, Math.min(SEESAW_PROFILE.hingeMaxRadians, absoluteAngle));
    return { angle, velocity: state.angularVelocity.x };
  }

  rescueReady(objectKey) {
    const state = this.state(objectKey);
    if (!state) return null;
    for (const trigger of this.triggers.values()) {
      if (ballInsideTriangle(state.position, PHYSICS_PROFILE.victimRadius, trigger)) return trigger;
    }
    return null;
  }

  rescueTriggerStates() {
    return [...this.triggers.values()].map((trigger) => ({
      key: trigger.key,
      objectId: trigger.objectId,
      tileId: trigger.tileId,
      center: { ...trigger.center },
      width: trigger.width || RESCUE_TRIGGER_WIDTH,
      depth: trigger.depth || RESCUE_TRIGGER_DEPTH,
      height: trigger.height || RESCUE_TRIGGER_HEIGHT,
      offsetX: trigger.offsetX || 0,
      offsetZ: trigger.offsetZ || 0,
      rotationY: trigger.rotationY || 0,
      triangleOrientation: trigger.triangleOrientation || "legacy",
      shape: "right-triangle-prism"
    }));
  }

  disableObject(objectKey) {
    const body = this.bodies.get(objectKey);
    if (body?.isValid()) body.setEnabled(false);
  }

  resetObject(objectKey, position) {
    const body = this.bodies.get(objectKey);
    if (!body) return;
    body.setTranslation(position, true);
    body.setLinvel(vec(), true);
    body.setAngvel(vec(), true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.wakeUp();
  }
}

export { RAPIER, worldObjectPoint };
