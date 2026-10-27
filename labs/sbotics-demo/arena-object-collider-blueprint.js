import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";

export function buildArenaObjectColliderBlueprint(tiles = [], simulationObjects = new Map()) {
  const objects = {};
  for (const tile of tiles) {
    for (const [index, object] of (tile.objects || []).entries()) {
      if (!object || object.type === "none" || object.label === "Random" && object.material === "ColorMagenta") continue;
      const id = object.id || `object-${index + 1}`;
      const key = `${tile.id}:${id}`;
      if (Number(object.mass) < 0 || object.physics === "visualOnly") continue;
      const visual = simulationObjects.get(key);
      const modelRequired = ["rescueKit", "wedge", "pyramid", "corner", "zul"].includes(object.type);
      if (!visual) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "visual" };
      const jobs = [];
      visual.traverse((item) => jobs.push(...(item.userData.robotModelJobs || [])));
      const pending = jobs.find((job) => job.status === "loading");
      if (pending) return { ready: false, reason: "loading", objectKey: key, typeId: object.type };
      const failed = jobs.find((job) => job.status === "failed");
      if (failed) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, assetPath: failed.path, shapeId: "source-mesh" };

      visual.updateWorldMatrix(true, true);
      const bodyPosition = visual.getWorldPosition(new THREE.Vector3());
      const bodyRotation = visual.getWorldQuaternion(new THREE.Quaternion());
      const bodyScale = visual.getWorldScale(new THREE.Vector3());
      const inverseRotation = bodyRotation.clone().invert();
      const wantedShapes = new Map();
      const isSolidModel = (item) => item.isMesh && item.userData.physicsRole === "solid";
      visual.traverse((item) => {
        if (!item.isMesh || !item.geometry?.getAttribute("position")) return;
        let shapeId = String(item.userData.arenaPhysicsShapeId || "");
        if (!shapeId && modelRequired && isSolidModel(item)) shapeId = String(item.userData.physicsShapeId || "mesh");
        if (!shapeId) return;
        const positions = item.geometry.getAttribute("position");
        item.updateWorldMatrix(true, false);
        const shapeKind = String(item.userData.arenaPhysicsShapeKind || "");
        if (shapeKind === "box" || shapeKind === "capsule") {
          const itemPosition = item.getWorldPosition(new THREE.Vector3());
          const center = itemPosition.sub(bodyPosition).applyQuaternion(inverseRotation).toArray();
          const itemRotation = item.getWorldQuaternion(new THREE.Quaternion());
          const relativeRotation = inverseRotation.clone().multiply(itemRotation);
          const scale = item.getWorldScale(new THREE.Vector3());
          let shape;
          if (shapeKind === "box") {
            item.geometry.computeBoundingBox();
            const localSize = item.geometry.boundingBox.getSize(new THREE.Vector3());
            shape = {
              id: shapeId,
              kind: "box",
              center,
              halfExtents: [localSize.x * scale.x / 2, localSize.y * scale.y / 2, localSize.z * scale.z / 2],
              rotation: { x: relativeRotation.x, y: relativeRotation.y, z: relativeRotation.z, w: relativeRotation.w }
            };
          } else {
            const worldAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(itemRotation);
            const localAxis = worldAxis.applyQuaternion(inverseRotation).normalize();
            const radius = 0.5 * Math.max(Math.abs(scale.x), Math.abs(scale.z));
            shape = {
              id: shapeId,
              kind: "capsule",
              center,
              axis: localAxis.toArray(),
              radius,
              halfHeight: Math.max(0, Math.abs(scale.y) - radius)
            };
          }
          wantedShapes.set(shapeId, shape);
          return;
        }
        const point = new THREE.Vector3();
        const values = [];
        const seen = new Set();
        for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex += 1) {
          point.fromBufferAttribute(positions, vertexIndex).applyMatrix4(item.matrixWorld).sub(bodyPosition).applyQuaternion(inverseRotation);
          if (![point.x, point.y, point.z].every(Number.isFinite)) continue;
          const value = [point.x, point.y, point.z];
          if (shapeId === "plane") {
            values.push(value);
            continue;
          }
          const signature = value.map((entry) => Math.round(entry * 1e5)).join(",");
          if (seen.has(signature)) continue;
          seen.add(signature);
          values.push(value);
        }
        if (!wantedShapes.has(shapeId)) wantedShapes.set(shapeId, { id: shapeId, kind: shapeId === "plane" ? "trimesh" : "convex", points: [], indices: [] });
        const shape = wantedShapes.get(shapeId);
        const baseIndex = shape.points.length;
        shape.points.push(...values);
        if (shape.kind === "trimesh") {
          const meshIndices = item.geometry.index ? Array.from(item.geometry.index.array) : Array.from({ length: positions.count }, (_, vertexIndex) => vertexIndex);
          shape.indices.push(...meshIndices.map((vertexIndex) => baseIndex + vertexIndex));
        }
      });
      const shapes = [...wantedShapes.values()];
      if (object.type === "rescueKit") {
        const meshShape = shapes.find((shape) => shape.kind === "convex");
        if (meshShape) {
          let hull;
          try {
            hull = new ConvexGeometry(meshShape.points.map((point) => new THREE.Vector3(point[0], point[1], point[2])));
          } catch {
            return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "source-mesh" };
          }
          const position = hull.getAttribute("position");
          const points = [];
          const seen = new Set();
          const point = new THREE.Vector3();
          for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
            point.fromBufferAttribute(position, vertexIndex);
            const values = [point.x, point.y, point.z];
            const signature = values.map((value) => Math.round(value * 1e5)).join(",");
            if (!values.every(Number.isFinite) || seen.has(signature)) continue;
            seen.add(signature);
            points.push(values);
          }
          hull.dispose();
          if (points.length < 4) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "source-mesh" };
          meshShape.points = points;
        }
      }
      if (modelRequired && !shapes.length) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "source-mesh" };
      if (object.type === "plane" && !shapes.some((shape) => shape.kind === "trimesh")) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "plane" };
      if (object.type === "evacuationPoint" && !["floor", "wall"].every((id) => shapes.some((shape) => shape.id === id))) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "floor-or-wall" };
      if (object.type === "seesaw" && !["support", "axle"].every((id) => shapes.some((shape) => shape.id === id))) return { ready: false, reason: "missing", objectKey: key, typeId: object.type, shapeId: "support-or-axle" };
      objects[key] = {
        bodyPosition: bodyPosition.toArray(),
        bodyRotation: { x: bodyRotation.x, y: bodyRotation.y, z: bodyRotation.z, w: bodyRotation.w },
        bodyScale: bodyScale.toArray(),
        shapes
      };
    }
  }
  return { ready: true, objects };
}
