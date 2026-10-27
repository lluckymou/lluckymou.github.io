// FUTURE-BACKEND: these bounded, user-scoped IndexedDB replay chunks remain local in IMP-UX.02.
const DATABASE_VERSION = 1;
const POSITION_DEADBAND = 0.01;
const ROTATION_DEADBAND_DEGREES = 0.1;
const FULL_SAMPLE_TICKS = 5;
const KEYFRAME_TICKS = 60;
const FRAMES_PER_CHUNK = 12;
const IDENTITY_QUATERNION = Object.freeze([0, 0, 0, 1]);

const clone = (value) => JSON.parse(JSON.stringify(value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const sanitizeNamespace = (value) => String(value || "local-user").normalize("NFC").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "local-user";
const stableStringify = (value) => JSON.stringify(sortObject(value));

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionResult(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
  });
}

async function digestHex(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("Replay integrity hashing is unavailable");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function compressBytes(bytes) {
  if (typeof globalThis.CompressionStream !== "function") return { encoding: "identity", bytes };
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return { encoding: "gzip", bytes: new Uint8Array(buffer) };
}

async function decompressBytes(bytes, encoding) {
  if (encoding === "identity") return bytes;
  if (encoding !== "gzip" || typeof globalThis.DecompressionStream !== "function") throw new Error("Replay compression profile is unsupported");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function normalizedQuaternion(value) {
  const quaternion = Array.isArray(value)
    ? value.map((part) => finite(part))
    : [finite(value?.x), finite(value?.y), finite(value?.z), finite(value?.w, 1)];
  const length = Math.hypot(...quaternion);
  return length > 1e-8 ? quaternion.map((part) => part / length) : [...IDENTITY_QUATERNION];
}

function quaternionMultiply(first, second) {
  const [ax, ay, az, aw] = first;
  const [bx, by, bz, bw] = second;
  return normalizedQuaternion([
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz
  ]);
}

function quaternionInverse(value) {
  const [x, y, z, w] = normalizedQuaternion(value);
  return [-x, -y, -z, w];
}

function quaternionAngleDegrees(first, second) {
  const a = normalizedQuaternion(first);
  const b = normalizedQuaternion(second);
  const dot = Math.min(1, Math.max(-1, Math.abs(a.reduce((sum, part, index) => sum + part * b[index], 0))));
  return 2 * Math.acos(dot) * 180 / Math.PI;
}

function normalizeVisualPose(pose = {}) {
  return {
    position: Array.isArray(pose.position) ? pose.position.slice(0, 3).map((value) => finite(value)) : [0, 0, 0],
    rotation: normalizedQuaternion(pose.rotation),
    ...(Array.isArray(pose.scale) ? { scale: pose.scale.slice(0, 3).map((value) => finite(value, 1)) } : {}),
    ...(typeof pose.visible === "boolean" ? { visible: pose.visible } : {}),
    ...(pose.visualState && typeof pose.visualState === "object" ? { visualState: clone(pose.visualState) } : {})
  };
}

function normalizeVisualCamera(camera) {
  if (!camera || typeof camera !== "object") return null;
  return {
    orbitX: finite(camera.orbitX),
    orbitY: finite(camera.orbitY),
    zoom: finite(camera.zoom, 1) > 0 ? finite(camera.zoom, 1) : 1
  };
}

function visualStateEqual(first = {}, second = {}) {
  return stableStringify(first || {}) === stableStringify(second || {});
}

function visualComponentChange(next, previous) {
  if (next?.typeId !== "pen" || previous?.typeId !== "pen") return clone(next);
  const before = previous.trailPoints || [];
  const after = next.trailPoints || [];
  const prefix = before.length <= after.length && before.every((point, index) => stableStringify(point) === stableStringify(after[index]));
  if (prefix) return { typeId: "pen", working: next.working === true, color: clone(next.color || [255, 128, 0]), trailAppend: after.slice(before.length) };
  if (before.length === after.length && before.length > 1 && before.slice(1).every((point, index) => stableStringify(point) === stableStringify(after[index]))) {
    return { typeId: "pen", working: next.working === true, color: clone(next.color || [255, 128, 0]), trailDrop: 1, trailAppend: after.slice(-1) };
  }
  if (before.length === after.length && before.length > 1) {
    const maximumDrop = Math.min(128, before.length - 1);
    for (let drop = 2; drop <= maximumDrop; drop += 1) {
      if (before.slice(drop).every((point, index) => stableStringify(point) === stableStringify(after[index]))) {
        return { typeId: "pen", working: next.working === true, color: clone(next.color || [255, 128, 0]), trailDrop: drop, trailAppend: after.slice(-drop) };
      }
    }
  }
  return { typeId: "pen", working: next.working === true, color: clone(next.color || [255, 128, 0]), trailReset: true, trailPoints: clone(after) };
}

function applyVisualComponentChange(components, componentId, value) {
  if (value === null) {
    delete components[componentId];
    return;
  }
  if (value?.typeId === "pen" && (value.trailReset === true || Array.isArray(value.trailAppend))) {
    const previous = components[componentId];
    const points = value.trailReset === true
      ? clone(value.trailPoints || [])
      : [...(previous?.typeId === "pen" ? (previous.trailPoints || []).slice(Math.max(0, Number(value.trailDrop) || 0)) : []), ...(value.trailAppend || [])];
    components[componentId] = { typeId: "pen", working: value.working === true, color: clone(value.color || [255, 128, 0]), trailPoints: points };
    return;
  }
  components[componentId] = clone(value);
}

function visualComponentChangesBetween(nextComponents = {}, previousComponents = {}) {
  const changes = {};
  const ids = new Set([...Object.keys(nextComponents), ...Object.keys(previousComponents)]);
  ids.forEach((componentId) => {
    const next = nextComponents[componentId];
    const previous = previousComponents[componentId];
    if (stableStringify(next ?? null) === stableStringify(previous ?? null)) return;
    changes[componentId] = next == null ? null : visualComponentChange(next, previous);
  });
  return changes;
}

function positionsDiffer(first, second) {
  const dx = first[0] - second[0];
  const dy = first[1] - second[1];
  const dz = first[2] - second[2];
  return Math.hypot(dx, dy, dz) > POSITION_DEADBAND;
}

function buildPoseDeltas(entities, previous) {
  const deltas = [];
  const nextPrevious = new Map(previous);
  for (const [entityId, rawPose] of Object.entries(entities || {})) {
    const current = normalizeVisualPose(rawPose);
    const last = previous.get(entityId);
    if (!last) return null;
    const positionChanged = positionsDiffer(current.position, last.position);
    const rotationChanged = quaternionAngleDegrees(current.rotation, last.rotation) > ROTATION_DEADBAND_DEGREES;
    const scaleChanged = stableStringify(current.scale || null) !== stableStringify(last.scale || null);
    const visibleChanged = current.visible !== last.visible;
    const visualStateChanged = !visualStateEqual(current.visualState, last.visualState);
    if (!positionChanged && !rotationChanged && !scaleChanged && !visibleChanged && !visualStateChanged) continue;
    const inverseLastRotation = quaternionInverse(last.rotation);
    deltas.push({
      entityId,
      translation: positionChanged ? current.position.map((value, index) => value - last.position[index]) : [0, 0, 0],
      rotationDelta: rotationChanged ? quaternionMultiply(inverseLastRotation, current.rotation) : [...IDENTITY_QUATERNION],
      ...(scaleChanged ? { scale: current.scale || null } : {}),
      ...(visibleChanged ? { visible: current.visible } : {}),
      ...(visualStateChanged ? { visualState: current.visualState || {} } : {})
    });
    nextPrevious.set(entityId, current);
  }
  if (Object.keys(entities || {}).length !== previous.size) return null;
  return { deltas, previous: nextPrevious };
}

function expandFrameState(state, frame) {
  const next = state ? new Map(state) : new Map();
  if (Array.isArray(frame.poses)) {
    next.clear();
    frame.poses.forEach((entry) => next.set(entry.entityId, normalizeVisualPose(entry)));
  } else {
    (frame.deltas || []).forEach((delta) => {
      const previous = next.get(delta.entityId);
      if (!previous) return;
      const position = previous.position.map((value, index) => value + finite(delta.translation?.[index]));
      const rotation = quaternionMultiply(previous.rotation, delta.rotationDelta || IDENTITY_QUATERNION);
      const visualState = delta.visualState === undefined ? previous.visualState : clone(delta.visualState);
      next.set(delta.entityId, {
        ...previous,
        position,
        rotation,
        ...(delta.scale === undefined ? {} : delta.scale === null ? { scale: undefined } : { scale: delta.scale.slice() }),
        ...(delta.visible === undefined ? {} : { visible: delta.visible }),
        ...(visualState === undefined ? {} : { visualState })
      });
    });
  }
  return next;
}

function snapshotFromMap(map) {
  return Object.fromEntries([...map.entries()].map(([id, pose]) => [id, clone(pose)]));
}

function groupFrames(frames, maximum = FRAMES_PER_CHUNK) {
  const chunks = [];
  let current = [];
  for (const frame of frames) {
    current.push(frame);
    if (current.length >= maximum || ["keyframe", "important", "terminal"].includes(frame.kind)) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function compactFrameList(frames) {
  const expanded = [];
  let state = new Map();
  let visualComponents = {};
  frames.forEach((frame) => {
    state = expandFrameState(state, frame);
    if (frame.visualComponents) visualComponents = clone(frame.visualComponents);
    if (frame.visualComponentChanges) {
      for (const [componentId, value] of Object.entries(frame.visualComponentChanges)) {
        applyVisualComponentChange(visualComponents, componentId, value);
      }
    }
    expanded.push({ ...frame, entities: snapshotFromMap(state), visualComponents: clone(visualComponents) });
  });
  const retained = expanded.filter((frame) => {
    if (["keyframe", "important", "terminal"].includes(frame.kind)) return true;
    return Number.isInteger(frame.sampleOrdinal) && frame.sampleOrdinal % 2 === 0;
  });
  let previous = new Map();
  let previousComponents = {};
  return retained.map((frame) => {
    if (["keyframe", "important", "terminal"].includes(frame.kind) || !previous.size) {
      const poses = Object.entries(frame.entities).map(([entityId, pose]) => ({ entityId, ...normalizeVisualPose(pose) }));
      previous = new Map(poses.map((pose) => [pose.entityId, normalizeVisualPose(pose)]));
      previousComponents = clone(frame.visualComponents || {});
      return { tick: frame.tick, simulationTimeMicros: frame.simulationTimeMicros, sampleOrdinal: frame.sampleOrdinal ?? null, kind: frame.kind, poses, visualComponents: clone(previousComponents), ...(frame.camera ? { camera: clone(frame.camera) } : {}) };
    }
    const result = buildPoseDeltas(frame.entities, previous);
    if (!result) {
      const poses = Object.entries(frame.entities).map(([entityId, pose]) => ({ entityId, ...normalizeVisualPose(pose) }));
      previous = new Map(poses.map((pose) => [pose.entityId, normalizeVisualPose(pose)]));
      previousComponents = clone(frame.visualComponents || {});
      return { tick: frame.tick, simulationTimeMicros: frame.simulationTimeMicros, sampleOrdinal: frame.sampleOrdinal ?? null, kind: "keyframe", poses, visualComponents: clone(previousComponents), ...(frame.camera ? { camera: clone(frame.camera) } : {}) };
    }
    previous = result.previous;
    const visualComponentChanges = visualComponentChangesBetween(frame.visualComponents || {}, previousComponents);
    previousComponents = clone(frame.visualComponents || {});
    return { tick: frame.tick, simulationTimeMicros: frame.simulationTimeMicros, sampleOrdinal: frame.sampleOrdinal ?? null, kind: "sample", deltas: result.deltas, visualComponentChanges, ...(frame.camera ? { camera: clone(frame.camera) } : {}) };
  });
}

export class RoutineReplayStore {
  constructor(ownerNamespace = "local-user") {
    this.ownerNamespace = sanitizeNamespace(ownerNamespace);
    this.databaseName = `sbotics-routine-visual-replay-v1-${this.ownerNamespace}`;
    this.databasePromise = null;
  }

  open() {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB is unavailable"));
        return;
      }
      const request = globalThis.indexedDB.open(this.databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("scenes")) database.createObjectStore("scenes", { keyPath: "sha256" });
        if (!database.objectStoreNames.contains("manifests")) database.createObjectStore("manifests", { keyPath: "runId" });
        if (!database.objectStoreNames.contains("chunks")) database.createObjectStore("chunks", { keyPath: ["runId", "sequence"] });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB"));
      request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked"));
    });
    this.databasePromise.catch(() => { this.databasePromise = null; });
    return this.databasePromise;
  }

  async close() {
    const opening = this.databasePromise;
    if (!opening) return;
    try { (await opening).close(); } catch {}
    if (this.databasePromise === opening) this.databasePromise = null;
  }

  async encodeJson(value) {
    const rawBytes = new TextEncoder().encode(stableStringify(value));
    const sha256 = await digestHex(rawBytes);
    const packed = await compressBytes(rawBytes);
    return { rawBytes, sha256, encoding: packed.encoding, payload: packed.bytes.buffer.slice(packed.bytes.byteOffset, packed.bytes.byteOffset + packed.bytes.byteLength) };
  }

  async decodeRecord(record) {
    const stored = new Uint8Array(record.payload);
    const rawBytes = await decompressBytes(stored, record.encoding);
    const sha256 = await digestHex(rawBytes);
    if (sha256 !== record.sha256) throw new Error("Replay content hash mismatch");
    return JSON.parse(new TextDecoder().decode(rawBytes));
  }

  async beginRecording(runId, sceneSnapshot) {
    const database = await this.open();
    const sceneEncoded = await this.encodeJson(sceneSnapshot);
    const transaction = database.transaction(["scenes", "manifests"], "readwrite");
    const done = transactionResult(transaction);
    const scenes = transaction.objectStore("scenes");
    const existing = scenes.get(sceneEncoded.sha256);
    existing.onsuccess = () => {
      if (!existing.result) scenes.put({ sha256: sceneEncoded.sha256, encoding: sceneEncoded.encoding, payload: sceneEncoded.payload, storedByteLength: sceneEncoded.payload.byteLength });
    };
    transaction.objectStore("manifests").put({
      schemaVersion: 1,
      runId,
      ownerNamespace: this.ownerNamespace,
      sceneSnapshotSha256: sceneEncoded.sha256,
      passiveRendererProfileVersion: "passive-replay-render-v1",
      quality: "full-12fps",
      status: "incomplete",
      sampleFps: 12,
      chunks: [],
      sceneSnapshotStoredByteLength: sceneEncoded.payload.byteLength,
      storedByteLength: sceneEncoded.payload.byteLength,
      createdAt: new Date().toISOString()
    });
    await done;
    return sceneEncoded.sha256;
  }

  async writeChunk(runId, sequence, frames) {
    const database = await this.open();
    const encoded = await this.encodeJson(frames);
    const record = {
      runId,
      sequence,
      firstTick: Number(frames[0]?.tick) || 0,
      lastTick: Number(frames.at(-1)?.tick) || 0,
      frameCount: frames.length,
      sha256: encoded.sha256,
      encoding: encoded.encoding,
      storedByteLength: encoded.payload.byteLength,
      payload: encoded.payload
    };
    const transaction = database.transaction(["chunks", "manifests"], "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore("chunks").put(record);
    const manifests = transaction.objectStore("manifests");
    const request = manifests.get(runId);
    request.onsuccess = () => {
      const manifest = request.result;
      if (!manifest) {
        transaction.abort();
        return;
      }
      manifest.chunks = (manifest.chunks || []).filter((chunk) => chunk.sequence !== sequence);
      manifest.chunks.push({ sequence, firstTick: record.firstTick, lastTick: record.lastTick, sha256: record.sha256, storedByteLength: record.storedByteLength, encoding: record.encoding });
      manifest.chunks.sort((first, second) => first.sequence - second.sequence);
      manifest.storedByteLength = (Number(manifest.storedByteLength) || 0) + record.storedByteLength;
      manifests.put(manifest);
    };
    await done;
  }

  async finishRecording(runId, status = "complete") {
    const database = await this.open();
    const transaction = database.transaction("manifests", "readwrite");
    const done = transactionResult(transaction);
    const store = transaction.objectStore("manifests");
    const request = store.get(runId);
    request.onsuccess = () => {
      if (!request.result) return;
      request.result.status = status;
      request.result.finishedAt = new Date().toISOString();
      store.put(request.result);
    };
    await done;
  }

  async load(runId) {
    const database = await this.open();
    const readTransaction = database.transaction(["manifests", "scenes", "chunks"], "readonly");
    const done = transactionResult(readTransaction);
    const manifestPromise = requestResult(readTransaction.objectStore("manifests").get(runId));
    const chunkRange = globalThis.IDBKeyRange.bound([runId, 0], [runId, Number.MAX_SAFE_INTEGER]);
    const chunksPromise = requestResult(readTransaction.objectStore("chunks").getAll(chunkRange));
    const [manifest, chunkRecords] = await Promise.all([manifestPromise, chunksPromise]);
    await done;
    if (!manifest || manifest.status !== "complete") throw new Error("Replay manifest is missing or incomplete");
    if (manifest.passiveRendererProfileVersion !== "passive-replay-render-v1") throw new Error("Replay renderer profile is unsupported");
    if (!["full-12fps", "compact-6fps"].includes(manifest.quality)) throw new Error("Replay quality profile is unsupported");
    const sceneRecord = await this.get("scenes", manifest.sceneSnapshotSha256);
    if (!sceneRecord) throw new Error("Replay scene snapshot is missing");
    const sceneSnapshot = await this.decodeRecord(sceneRecord);
    const sortedChunks = chunkRecords.sort((first, second) => first.sequence - second.sequence);
    const frames = [];
    let expectedSequence = 0;
    for (const chunk of sortedChunks) {
      if (chunk.sequence !== expectedSequence++) throw new Error("Replay chunks are incomplete");
      const decoded = await this.decodeRecord(chunk);
      if (!Array.isArray(decoded) || decoded.length !== chunk.frameCount) throw new Error("Replay frame chunk is malformed");
      frames.push(...decoded);
    }
    if (!frames.length || frames[0].tick !== 0 || frames.at(-1).kind !== "terminal") throw new Error("Replay visual track is incomplete");
    return { manifest, sceneSnapshot, frames };
  }

  async get(storeName, key) {
    const database = await this.open();
    const transaction = database.transaction(storeName, "readonly");
    const done = transactionResult(transaction);
    const value = await requestResult(transaction.objectStore(storeName).get(key));
    await done;
    return value || null;
  }

  async compact(runId) {
    const loaded = await this.load(runId);
    if (loaded.manifest.quality === "compact-6fps") return false;
    const compacted = compactFrameList(loaded.frames);
    const packedChunks = [];
    const stagingRunId = `${runId}:compact:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const groups = groupFrames(compacted);
    for (let sequence = 0; sequence < groups.length; sequence += 1) {
      const encoded = await this.encodeJson(groups[sequence]);
      packedChunks.push({
        runId: stagingRunId,
        sequence,
        staging: true,
        stagingCreatedAt: Date.now(),
        firstTick: Number(groups[sequence][0]?.tick) || 0,
        lastTick: Number(groups[sequence].at(-1)?.tick) || 0,
        frameCount: groups[sequence].length,
        sha256: encoded.sha256,
        encoding: encoded.encoding,
        storedByteLength: encoded.payload.byteLength,
        payload: encoded.payload
      });
    }
    const database = await this.open();
    const stagingTransaction = database.transaction("chunks", "readwrite");
    const stagingDone = transactionResult(stagingTransaction);
    packedChunks.forEach((record) => stagingTransaction.objectStore("chunks").put(record));
    try {
      await stagingDone;
      const verifyTransaction = database.transaction("chunks", "readonly");
      const verifyDone = transactionResult(verifyTransaction);
      const stagedRecords = await requestResult(verifyTransaction.objectStore("chunks").getAll(globalThis.IDBKeyRange.bound([stagingRunId, 0], [stagingRunId, Number.MAX_SAFE_INTEGER])));
      await verifyDone;
      if (stagedRecords.length !== packedChunks.length) throw new Error("Replay compaction staging is incomplete");
      for (let index = 0; index < stagedRecords.length; index += 1) {
        const record = stagedRecords[index];
        const decoded = await this.decodeRecord(record);
        if (!Array.isArray(decoded) || decoded.length !== record.frameCount || record.sequence !== index) throw new Error("Replay compaction verification failed");
      }
      const finalChunks = stagedRecords.map(({ staging, stagingCreatedAt, ...record }) => ({ ...record, runId }));
      const transaction = database.transaction(["chunks", "manifests"], "readwrite");
      const done = transactionResult(transaction);
      const chunks = transaction.objectStore("chunks");
      const manifests = transaction.objectStore("manifests");
      const request = manifests.get(runId);
      let alreadyCompacted = false;
      request.onsuccess = () => {
        const manifest = request.result;
        if (!manifest || manifest.status !== "complete") {
          transaction.abort();
          return;
        }
        if (manifest.quality === "compact-6fps") {
          alreadyCompacted = true;
          stagedRecords.forEach((record) => chunks.delete([stagingRunId, record.sequence]));
          return;
        }
        if (manifest.quality !== "full-12fps") {
          transaction.abort();
          return;
        }
        (manifest.chunks || []).forEach((chunk) => chunks.delete([runId, chunk.sequence]));
        stagedRecords.forEach((record) => chunks.delete([stagingRunId, record.sequence]));
        finalChunks.forEach((record) => chunks.put(record));
        manifest.quality = "compact-6fps";
        manifest.sampleFps = 6;
        manifest.chunks = finalChunks.map((record) => ({ sequence: record.sequence, firstTick: record.firstTick, lastTick: record.lastTick, sha256: record.sha256, storedByteLength: record.storedByteLength, encoding: record.encoding }));
        manifest.storedByteLength = (Number(manifest.sceneSnapshotStoredByteLength) || 0) + finalChunks.reduce((sum, record) => sum + record.storedByteLength, 0);
        manifest.compactedAt = new Date().toISOString();
        manifests.put(manifest);
      };
      await done;
      return !alreadyCompacted;
    } catch (error) {
      const cleanupRead = database.transaction("chunks", "readonly");
      const cleanupReadDone = transactionResult(cleanupRead);
      const stagedRecords = await requestResult(cleanupRead.objectStore("chunks").getAll(globalThis.IDBKeyRange.bound([stagingRunId, 0], [stagingRunId, Number.MAX_SAFE_INTEGER]))).catch(() => []);
      await cleanupReadDone.catch(() => {});
      if (stagedRecords.length) {
        const cleanup = database.transaction("chunks", "readwrite");
        const cleanupDone = transactionResult(cleanup);
        stagedRecords.forEach((record) => cleanup.objectStore("chunks").delete([stagingRunId, record.sequence]));
        await cleanupDone.catch(() => {});
      }
      throw error;
    }
  }

  async deleteReplay(runId) {
    const database = await this.open();
    const read = database.transaction(["manifests", "chunks"], "readonly");
    const readDone = transactionResult(read);
    const manifest = await requestResult(read.objectStore("manifests").get(runId));
    const chunks = await requestResult(read.objectStore("chunks").getAll());
    await readDone;
    const write = database.transaction(["manifests", "chunks"], "readwrite");
    const done = transactionResult(write);
    write.objectStore("manifests").delete(runId);
    chunks.filter((record) => record.runId === runId || String(record.runId).startsWith(`${runId}:compact:`))
      .forEach((record) => write.objectStore("chunks").delete([record.runId, record.sequence]));
    await done;
    await this.collectScene(manifest?.sceneSnapshotSha256);
    return Boolean(manifest);
  }

  async cleanupTemporaryChunks(maxAgeMs = 60 * 60 * 1000) {
    const database = await this.open();
    const read = database.transaction("chunks", "readonly");
    const readDone = transactionResult(read);
    const chunks = await requestResult(read.objectStore("chunks").getAll());
    await readDone;
    const stale = chunks.filter((record) => record.staging === true && Date.now() - Number(record.stagingCreatedAt || 0) > maxAgeMs);
    if (!stale.length) return 0;
    const write = database.transaction("chunks", "readwrite");
    const done = transactionResult(write);
    stale.forEach((record) => write.objectStore("chunks").delete([record.runId, record.sequence]));
    await done;
    return stale.length;
  }

  async collectScene(sceneHash) {
    if (!sceneHash) return;
    const database = await this.open();
    const transaction = database.transaction(["manifests", "scenes"], "readwrite");
    const done = transactionResult(transaction);
    const manifests = transaction.objectStore("manifests");
    const request = manifests.getAll();
    request.onsuccess = () => {
      if (!request.result.some((manifest) => manifest.sceneSnapshotSha256 === sceneHash)) transaction.objectStore("scenes").delete(sceneHash);
    };
    await done;
  }

  async clearAll() {
    const database = await this.open();
    const transaction = database.transaction(["scenes", "manifests", "chunks"], "readwrite");
    const done = transactionResult(transaction);
    transaction.objectStore("scenes").clear();
    transaction.objectStore("manifests").clear();
    transaction.objectStore("chunks").clear();
    await done;
  }
}

export class RoutineVisualReplayRecorder {
  constructor(store, runId, sceneSnapshot, onStatus = () => {}) {
    this.store = store;
    this.runId = runId;
    this.onStatus = onStatus;
    this.previous = new Map();
    this.pendingFrames = [];
    this.chunkSequence = 0;
    this.writeQueue = Promise.resolve();
    this.lastTick = -1;
    this.failed = false;
    this.finished = false;
    this.pendingStatus = "recording";
    this.previousVisualComponents = {};
    this.ready = store.beginRecording(runId, sceneSnapshot).catch((error) => {
      this.fail(error);
      throw error;
    });
    this.ready.catch(() => {});
  }

  capture(state, kind = "sample") {
    if (this.failed || this.finished || !state || !Number.isFinite(Number(state.tick))) return;
    const tick = Math.max(0, Math.round(Number(state.tick)));
    if (kind === "sample" && tick % FULL_SAMPLE_TICKS !== 0) return;
    const sampleOrdinal = tick % FULL_SAMPLE_TICKS === 0 ? Math.floor(tick / FULL_SAMPLE_TICKS) : null;
    const keyframe = ["keyframe", "important", "terminal"].includes(kind) || !this.previous.size || tick % KEYFRAME_TICKS === 0;
    const entities = state.entities || {};
    const camera = normalizeVisualCamera(state.camera);
    let frame;
    if (keyframe) {
      const poses = Object.entries(entities).map(([entityId, pose]) => ({ entityId, ...normalizeVisualPose(pose) }));
      this.previous = new Map(poses.map((pose) => [pose.entityId, normalizeVisualPose(pose)]));
      this.previousVisualComponents = clone(state.visualComponents || {});
      frame = { tick, simulationTimeMicros: Math.max(0, Math.round(Number(state.timeMicros) || 0)), sampleOrdinal, kind: kind === "sample" ? "keyframe" : kind, poses, visualComponents: clone(this.previousVisualComponents), ...(camera ? { camera } : {}) };
    } else {
      const deltaResult = buildPoseDeltas(entities, this.previous);
      if (!deltaResult) {
        const poses = Object.entries(entities).map(([entityId, pose]) => ({ entityId, ...normalizeVisualPose(pose) }));
        this.previous = new Map(poses.map((pose) => [pose.entityId, normalizeVisualPose(pose)]));
        this.previousVisualComponents = clone(state.visualComponents || {});
        frame = { tick, simulationTimeMicros: Math.max(0, Math.round(Number(state.timeMicros) || 0)), sampleOrdinal, kind: "keyframe", poses, visualComponents: clone(this.previousVisualComponents), ...(camera ? { camera } : {}) };
      } else {
        this.previous = deltaResult.previous;
        const nextComponents = clone(state.visualComponents || {});
        const visualComponentChanges = visualComponentChangesBetween(nextComponents, this.previousVisualComponents);
        this.previousVisualComponents = nextComponents;
        frame = { tick, simulationTimeMicros: Math.max(0, Math.round(Number(state.timeMicros) || 0)), sampleOrdinal, kind: "sample", deltas: deltaResult.deltas, visualComponentChanges, ...(camera ? { camera } : {}) };
      }
    }
    this.lastTick = Math.max(this.lastTick, tick);
    this.pendingFrames.push(frame);
    if (this.pendingFrames.length >= FRAMES_PER_CHUNK || ["important", "terminal"].includes(frame.kind)) this.flush();
  }

  flush() {
    if (!this.pendingFrames.length || this.failed) return this.writeQueue;
    const frames = this.pendingFrames.splice(0);
    const sequence = this.chunkSequence++;
    this.writeQueue = this.writeQueue.then(async () => {
      await this.ready;
      await this.store.writeChunk(this.runId, sequence, frames);
    }).catch((error) => this.fail(error));
    return this.writeQueue;
  }

  async finish(state) {
    if (this.finished) return this.failed ? "unavailable" : this.pendingStatus;
    if (state) this.capture(state, "terminal");
    this.finished = true;
    await this.flush();
    await this.writeQueue;
    if (this.failed) return "unavailable";
    try {
      await this.ready;
      await this.store.finishRecording(this.runId, "complete");
      this.pendingStatus = "available";
      this.onStatus({ status: "available", quality: "full-12fps" });
      return "available";
    } catch (error) {
      this.fail(error);
      return "unavailable";
    }
  }

  fail(error) {
    if (this.failed) return;
    this.failed = true;
    this.pendingStatus = "unavailable";
    this.pendingFrames = [];
    void this.store.finishRecording(this.runId, "incomplete").catch(() => {});
    try { this.onStatus({ status: "unavailable", quality: "none", error }); } catch {}
  }
}

export function expandRoutineVisualFrames(frames = []) {
  let state = new Map();
  let visualComponents = {};
  return frames.map((frame) => {
    state = expandFrameState(state, frame);
    if (frame.visualComponents) visualComponents = clone(frame.visualComponents);
    if (frame.visualComponentChanges) {
      for (const [componentId, value] of Object.entries(frame.visualComponentChanges)) {
        applyVisualComponentChange(visualComponents, componentId, value);
      }
    }
    return { ...frame, entities: snapshotFromMap(state), visualComponents: clone(visualComponents) };
  });
}

export async function compactRoutineReplay(store, runId) {
  return store.compact(runId);
}
