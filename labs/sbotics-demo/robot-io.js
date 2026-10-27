/*
 * Robot document and orientation bridge.
 *
 * The legacy runtime writes Quaternion.Euler(x, y, z) to the instantiated
 * prefab root. Unity applies those Euler values in ZXY order. The workshop
 * keeps a small canonical Orientation24 value instead of persisting either
 * Euler triples or quaternions, then derives the renderer-friendly values.
 */
(function () {
  "use strict";

  const AXES = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
  const AXIS_VECTORS = {
    "+X": { x: 1, y: 0, z: 0 },
    "-X": { x: -1, y: 0, z: 0 },
    "+Y": { x: 0, y: 1, z: 0 },
    "-Y": { x: 0, y: -1, z: 0 },
    "+Z": { x: 0, y: 0, z: 1 },
    "-Z": { x: 0, y: 0, z: -1 }
  };
  const LEGACY_KEY_BASE64 = "JCZWRVPvlhQ0iSkIIxqeRyE6TFWHg6f2qP1tbK0del8=";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8", { fatal: true });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeQuaternion(value) {
    const length = Math.hypot(value.x, value.y, value.z, value.w) || 1;
    return { x: value.x / length, y: value.y / length, z: value.z / length, w: value.w / length };
  }

  function quaternionMultiply(first, second) {
    return normalizeQuaternion({
      x: first.w * second.x + first.x * second.w + first.y * second.z - first.z * second.y,
      y: first.w * second.y - first.x * second.z + first.y * second.w + first.z * second.x,
      z: first.w * second.z + first.x * second.y - first.y * second.x + first.z * second.w,
      w: first.w * second.w - first.x * second.x - first.y * second.y - first.z * second.z
    });
  }

  function quaternionFromAxis(axis, radians) {
    const half = radians / 2;
    const sine = Math.sin(half);
    const cosine = Math.cos(half);
    return axis === "x"
      ? { x: sine, y: 0, z: 0, w: cosine }
      : axis === "y"
        ? { x: 0, y: sine, z: 0, w: cosine }
        : { x: 0, y: 0, z: sine, w: cosine };
  }

  // Unity's default Quaternion.Euler order is Z-X-Y. In Three's Euler API
  // that extrinsic order is represented by the YXZ composition, so keep the
  // Unity formula explicit instead of passing the values through Three's
  // differently-conventioned ZXY helper.
  function unityEulerToQuaternion(rotation = {}) {
    const x = Number(rotation.x || 0) * Math.PI / 180;
    const y = Number(rotation.y || 0) * Math.PI / 180;
    const z = Number(rotation.z || 0) * Math.PI / 180;
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);
    return normalizeQuaternion({
      x: s1 * c2 * c3 + c1 * s2 * s3,
      y: c1 * s2 * c3 - s1 * c2 * s3,
      z: c1 * c2 * s3 - s1 * s2 * c3,
      w: c1 * c2 * c3 + s1 * s2 * s3
    });
  }

  function rotateVector(quaternion, vector) {
    const tx = 2 * (quaternion.y * vector.z - quaternion.z * vector.y);
    const ty = 2 * (quaternion.z * vector.x - quaternion.x * vector.z);
    const tz = 2 * (quaternion.x * vector.y - quaternion.y * vector.x);
    return {
      x: vector.x + quaternion.w * tx + quaternion.y * tz - quaternion.z * ty,
      y: vector.y + quaternion.w * ty + quaternion.z * tx - quaternion.x * tz,
      z: vector.z + quaternion.w * tz + quaternion.x * ty - quaternion.y * tx
    };
  }

  function nearestAxis(vector) {
    const values = [Math.abs(vector.x), Math.abs(vector.y), Math.abs(vector.z)];
    const index = values.indexOf(Math.max(...values));
    if (index === 0) return vector.x < 0 ? "-X" : "+X";
    if (index === 1) return vector.y < 0 ? "-Y" : "+Y";
    return vector.z < 0 ? "-Z" : "+Z";
  }

  function orientationKey(value) {
    return `${value?.up || ""}|${value?.forward || ""}`;
  }

  function orientationFromQuaternion(quaternion) {
    const normalized = normalizeQuaternion(quaternion);
    const orientation = {
      up: nearestAxis(rotateVector(normalized, AXIS_VECTORS["+Y"])),
      forward: nearestAxis(rotateVector(normalized, AXIS_VECTORS["+Z"]))
    };
    if (orientation.up === orientation.forward || orientation.up === `-${orientation.forward}`) {
      throw new Error("orientation axes are not perpendicular");
    }
    return orientation;
  }

  function orientationToQuaternion(orientation) {
    const up = AXIS_VECTORS[normalizeAxis(orientation?.up)];
    const forward = AXIS_VECTORS[normalizeAxis(orientation?.forward)];
    if (!up || !forward || (up.x * forward.x + up.y * forward.y + up.z * forward.z) !== 0) {
      throw new Error("invalid Orientation24");
    }
    // The transformed local basis is [right, up, forward].
    const right = {
      x: up.y * forward.z - up.z * forward.y,
      y: up.z * forward.x - up.x * forward.z,
      z: up.x * forward.y - up.y * forward.x
    };
    const m00 = right.x, m01 = up.x, m02 = forward.x;
    const m10 = right.y, m11 = up.y, m12 = forward.y;
    const m20 = right.z, m21 = up.z, m22 = forward.z;
    const trace = m00 + m11 + m22;
    let quaternion;
    if (trace > 0) {
      const scale = Math.sqrt(trace + 1) * 2;
      quaternion = { x: (m21 - m12) / scale, y: (m02 - m20) / scale, z: (m10 - m01) / scale, w: 0.25 * scale };
    } else if (m00 > m11 && m00 > m22) {
      const scale = Math.sqrt(1 + m00 - m11 - m22) * 2;
      quaternion = { x: 0.25 * scale, y: (m01 + m10) / scale, z: (m02 + m20) / scale, w: (m21 - m12) / scale };
    } else if (m11 > m22) {
      const scale = Math.sqrt(1 + m11 - m00 - m22) * 2;
      quaternion = { x: (m01 + m10) / scale, y: 0.25 * scale, z: (m12 + m21) / scale, w: (m02 - m20) / scale };
    } else {
      const scale = Math.sqrt(1 + m22 - m00 - m11) * 2;
      quaternion = { x: (m02 + m20) / scale, y: (m12 + m21) / scale, z: 0.25 * scale, w: (m10 - m01) / scale };
    }
    return normalizeQuaternion(quaternion);
  }

  function normalizeAxis(value) {
    if (typeof value !== "string") return "";
    const normalized = value.trim().toUpperCase().replace(/^([+-])([XYZ])$/, "$1$2");
    return AXIS_VECTORS[normalized] ? normalized : "";
  }

  const orientationEulerLookup = new Map();
  for (const x of [0, 90, 180, 270]) {
    for (const y of [0, 90, 180, 270]) {
      for (const z of [0, 90, 180, 270]) {
        const orientation = orientationFromQuaternion(unityEulerToQuaternion({ x, y, z }));
        const key = orientationKey(orientation);
        const candidate = { x, y, z };
        const current = orientationEulerLookup.get(key);
        const turnCost = (value) => Math.min(value, 360 - value);
        const score = turnCost(x) + turnCost(y) + turnCost(z);
        const currentScore = current ? current.score : Infinity;
        if (!current || score < currentScore || (score === currentScore && `${x},${y},${z}` < `${current.value.x},${current.value.y},${current.value.z}`)) {
          orientationEulerLookup.set(key, { value: candidate, score });
        }
      }
    }
  }

  function unityEulerToOrientation(rotation = {}) {
    return orientationFromQuaternion(unityEulerToQuaternion(rotation));
  }

  function orientationToEuler(orientation) {
    const entry = orientationEulerLookup.get(orientationKey({ up: normalizeAxis(orientation?.up), forward: normalizeAxis(orientation?.forward) }));
    if (!entry) throw new Error("orientation is outside Orientation24");
    return { ...entry.value };
  }

  function rotateOrientation(orientation, axis, direction) {
    const normalizedAxis = String(axis || "").toLowerCase();
    if (!["x", "y", "z"].includes(normalizedAxis) || ![-1, 1].includes(Number(direction))) throw new Error("invalid rotation command");
    const current = orientationToQuaternion(orientation);
    const turn = quaternionFromAxis(normalizedAxis, Number(direction) * Math.PI / 2);
    return orientationFromQuaternion(quaternionMultiply(turn, current));
  }

  function canonicalStringify(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("non-finite JSON number");
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
    if (typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
    }
    throw new Error("unsupported JSON value");
  }

  async function sha256Hex(value) {
    if (!globalThis.crypto?.subtle) return "";
    const digest = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function decodeBase64(value, label = "Base64") {
    if (typeof value !== "string" || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`${label} inválido`);
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  function decodeText(bytes) {
    return decoder.decode(bytes);
  }

  async function decryptLegacyData(value) {
    const envelope = JSON.parse(decodeText(decodeBase64(value, "data")));
    if (!envelope || typeof envelope !== "object" || typeof envelope.iv !== "string" || typeof envelope.value !== "string" || typeof envelope.mac !== "string") throw new Error("envelope legado inválido");
    const iv = decodeBase64(envelope.iv, "IV");
    const ciphertext = decodeBase64(envelope.value, "ciphertext");
    if (iv.length !== 16 || !/^[0-9a-f]{64}$/i.test(envelope.mac)) throw new Error("envelope legado inválido");
    if (!globalThis.crypto?.subtle) throw new Error("este navegador não oferece a conversão legada");
    const keyBytes = decodeBase64(LEGACY_KEY_BASE64, "legacy key");
    const hmacKey = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const mac = Uint8Array.from(envelope.mac.match(/.{2}/g), (byte) => parseInt(byte, 16));
    const valid = await globalThis.crypto.subtle.verify("HMAC", hmacKey, mac, encoder.encode(envelope.iv + envelope.value));
    if (!valid) throw new Error("assinatura do arquivo legado não confere");
    const aesKey = await globalThis.crypto.subtle.importKey("raw", keyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
    const plaintext = await globalThis.crypto.subtle.decrypt({ name: "AES-CBC", iv }, aesKey, ciphertext);
    return JSON.parse(decoder.decode(plaintext));
  }

  function error(message, code = "invalid-robot-file") {
    const problem = new Error(message);
    problem.code = code;
    return problem;
  }

  function assertIntegerCoordinate(position, label, bounds) {
    if (!position || typeof position !== "object" || ["x", "y", "z"].some((axis) => !Number.isInteger(position[axis]))) throw error(`${label} precisa usar coordenadas inteiras.`, "invalid-coordinate");
    if (bounds && (position.x < bounds.x[0] || position.x > bounds.x[1] || position.y < bounds.y[0] || position.y > bounds.y[1] || position.z < bounds.z[0] || position.z > bounds.z[1])) throw error(`${label} está fora dos limites do Workshop.`, "out-of-bounds");
    return { x: position.x, y: position.y, z: position.z };
  }

  function positionKey(position) {
    return `${position.x},${position.y},${position.z}`;
  }

  function mapMaterial(value, colors) {
    if (value === undefined || value === null || value === "") return undefined;
    const raw = String(value);
    const withoutPrefix = raw.replace(/^Color/, "");
    const normalized = withoutPrefix.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[\s_]+/g, "-").toLowerCase();
    const match = colors.find(([id]) => id === raw) || colors.find(([id]) => id === normalized);
    if (!match) throw error(`materialId/color desconhecido: ${raw}`, "invalid-material");
    return match[0];
  }

  const COMPONENT_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

  function normalizeComponentName(value) {
    return typeof value === "string" ? value.normalize("NFC").trim() : "";
  }

  function componentNameProblem(value, options = {}, usedNames = null) {
    const normalized = normalizeComponentName(value);
    if (!normalized || !COMPONENT_NAME_PATTERN.test(normalized)) return "invalid";
    if (options.reservedNames?.has(normalized.toLowerCase())) return "reserved";
    if (usedNames?.has(normalized)) return "duplicate";
    return "";
  }

  function componentNameError(problem) {
    if (problem === "duplicate") return error("nome de componente duplicado.", "duplicate-component-name");
    return error("nome de componente inválido; use um identificador JavaScript curto.", "invalid-component-name");
  }

  function validateName(value, options = {}, usedNames = null) {
    const normalized = normalizeComponentName(value);
    const problem = componentNameProblem(normalized, options, usedNames);
    if (problem) throw componentNameError(problem);
    return normalized;
  }

  function suggestedComponentName(typeId, options = {}, usedNames = new Set()) {
    const configuredStem = options.nameStems?.[typeId] || typeId || "component";
    const stem = String(configuredStem).replace(/[^A-Za-z0-9_$]/g, "") || "component";
    const safeStem = /^[A-Za-z_$]/.test(stem) ? stem : `component${stem}`;
    let suffix = 1;
    let candidate = `${safeStem}${suffix}`;
    while (usedNames.has(candidate) || options.reservedNames?.has(candidate.toLowerCase())) {
      suffix += 1;
      candidate = `${safeStem}${suffix}`;
    }
    return candidate;
  }

  function mapComponentName(rawValue, typeId, instanceId, position, sourceIndex, options, usedNames) {
    const rawName = rawValue === undefined || rawValue === null ? "" : String(rawValue);
    const problem = componentNameProblem(rawName, options, usedNames);
    if (!problem) {
      const name = validateName(rawName, options, usedNames);
      usedNames.add(name);
      return { name, migration: null };
    }
    const name = suggestedComponentName(typeId, options, usedNames);
    usedNames.add(name);
    return {
      name,
      migration: {
        sourceIndex,
        instanceId,
        oldName: rawName,
        proposedName: name,
        acceptedName: name,
        reason: problem,
        position: { x: position.x, y: position.y, z: position.z }
      }
    };
  }

  function sourceTypeId(value, options) {
    const raw = String(value || "");
    const exact = options.typeAliases[raw] || options.typeAliases[raw.toLowerCase()];
    if (!exact || exact === "controller") throw error(`peça desconhecida: ${raw || "(vazia)"}`, "unknown-part");
    return exact;
  }

  function mapRobotRecords(records, name, format, options) {
    if (!Array.isArray(records) || records.length > options.maxBlocks) throw error("o arquivo excede o limite de peças.", "too-many-parts");
    const parts = [{ instanceId: "controller", typeId: "controller", position: { x: 0, y: 0, z: 0 }, parentInstanceId: null, parentFace: null }];
    const names = {};
    const colors = {};
    const rotations = {};
    const orientations = {};
    const anchors = {};
    const positions = new Map([["0,0,0", "controller"]]);
    const pending = [];
    const usedNames = new Set();
    const notices = [];
    const componentNameMap = [];
    records.forEach((record, index) => {
      if (!record || typeof record !== "object") throw error(`peça ${index + 1} inválida.`, "invalid-part");
      const typeId = sourceTypeId(format === "legacy-sBot" ? record.type : record.typeId, options);
      const position = assertIntegerCoordinate(record.position, `posição da peça ${index + 1}`, options.bounds);
      const key = positionKey(position);
      if (positions.has(key)) throw error(`há mais de uma peça na posição ${key}.`, "duplicate-position");
      let orientation;
      if (format === "legacy-sBot") {
        const rotation = record.rotation;
        if (!rotation || ["x", "y", "z"].some((axis) => !Number.isInteger(rotation[axis])) || ["x", "y", "z"].some((axis) => rotation[axis] % 90 !== 0)) throw error(`rotação da peça ${index + 1} não é um quarto de volta válido.`, "invalid-rotation");
        orientation = unityEulerToOrientation(rotation);
      } else {
        orientation = { up: normalizeAxis(record.orientation?.up), forward: normalizeAxis(record.orientation?.forward) };
        orientationToQuaternion(orientation);
      }
      const instanceId = `${typeId}-${index + 1}`;
      positions.set(key, instanceId);
      orientations[instanceId] = orientation;
      rotations[instanceId] = orientationToEuler(orientation);
      const explicitName = record.name !== undefined && record.name !== null;
      if (options.nameableTypeIds.has(typeId) && (format === "legacy-sBot" || explicitName)) {
        const mappedName = mapComponentName(record.name, typeId, instanceId, position, index, options, usedNames);
        names[instanceId] = mappedName.name;
        if (mappedName.migration) {
          componentNameMap.push(mappedName.migration);
          notices.push({
            code: "component-name-migrated",
            sourceIndex: index,
            oldName: mappedName.migration.oldName,
            proposedName: mappedName.migration.proposedName,
            reason: mappedName.migration.reason
          });
        }
      } else if (explicitName) {
        throw error(`a peça ${index + 1} não aceita nome de componente.`, "invalid-component-name");
      }
      const materialValue = format === "legacy-sBot" ? record.color : record.materialId;
      if (materialValue !== undefined && materialValue !== null && materialValue !== "") {
        if (!options.paintableTypeIds.has(typeId)) throw error(`a peça ${index + 1} não aceita cor persistida.`, "invalid-material");
        colors[instanceId] = mapMaterial(materialValue, options.colors);
      }
      if (format === "legacy-sBot") {
        for (const obsolete of ["price", "_price", "cost", "totalPrice", "totalCost"]) {
          if (Object.prototype.hasOwnProperty.call(record, obsolete)) notices.push({ code: "discarded-obsolete-price", sourceIndex: index, field: obsolete });
        }
        pending.push({ instanceId, position, parentPosition: assertIntegerCoordinate(record.anchor, `âncora da peça ${index + 1}`, options.bounds) });
      } else {
        pending.push({ instanceId, position, parentPosition: record.parentPosition === undefined ? null : assertIntegerCoordinate(record.parentPosition, `parentPosition da peça ${index + 1}`, options.bounds) });
        if (record.config !== undefined) throw error("configuração persistida não é suportada nesta versão.", "unsupported-config");
      }
      parts.push({ instanceId, typeId, position, parentInstanceId: null, parentFace: null });
    });
    const partsById = new Map(parts.map((part) => [part.instanceId, part]));
    pending.forEach(({ instanceId, position, parentPosition }) => {
      if (!parentPosition) throw error("apenas o Controller pode ficar sem parentPosition.", "missing-parent");
      const parentId = positions.get(positionKey(parentPosition));
      if (!parentId) throw error(`parentPosition ausente para ${positionKey(position)}.`, "missing-parent");
      const delta = { x: position.x - parentPosition.x, y: position.y - parentPosition.y, z: position.z - parentPosition.z };
      const distance = Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z);
      if (distance !== 1) throw error(`parentPosition de ${positionKey(position)} não é adjacente.`, "non-adjacent-parent");
      const face = AXES.find((axis) => AXIS_VECTORS[axis].x === delta.x && AXIS_VECTORS[axis].y === delta.y && AXIS_VECTORS[axis].z === delta.z);
      const part = partsById.get(instanceId);
      part.parentInstanceId = parentId;
      part.parentFace = face;
      anchors[instanceId] = parentId;
    });
    parts.slice(1).forEach((part) => {
      const visited = new Set([part.instanceId]);
      let cursor = part.parentInstanceId;
      while (cursor && cursor !== "controller") {
        if (visited.has(cursor)) throw error(`a hierarquia cria um ciclo na posição ${positionKey(part.position)}.`, "parent-cycle");
        visited.add(cursor);
        cursor = partsById.get(cursor)?.parentInstanceId;
      }
      if (!cursor) throw error(`a peça ${positionKey(part.position)} não alcança o Controller.`, "disconnected-parent");
    });
    return { name: typeof name === "string" && name.trim() ? name.trim() : options.fallbackName, format, state: { parts, names, colors, rotations, orientations, anchors }, blockCount: records.length, notices, componentNameMap };
  }

  function allowedKeys(value, keys, label) {
    for (const key of Object.keys(value || {})) if (!keys.has(key)) throw error(`${label} contém o campo não suportado “${key}”.`, "unknown-field");
  }

  async function parseRobotText(text, extension, options = {}) {
    const config = {
      maxBytes: 2 * 1024 * 1024,
      maxBlocks: 4912,
      bounds: { x: [-8, 8], y: [-4, 12], z: [-8, 8] },
      colors: [],
      paintableTypeIds: new Set(),
      nameableTypeIds: new Set(),
      typeAliases: {},
      reservedNames: new Set(),
      nameStems: {},
      partRegistryVersion: "robot-registry-v1",
      fallbackName: "Robô importado",
      ...options
    };
    if (typeof text !== "string" || encoder.encode(text).length > config.maxBytes) throw error("o arquivo de robô é maior que 2 MiB.", "file-too-large");
    if (text.charCodeAt(0) === 0xfeff) throw error("o arquivo contém BOM; salve-o como UTF-8 puro.", "invalid-utf8");
    let root;
    try { root = JSON.parse(text); } catch { throw error("o arquivo não contém JSON válido.", "invalid-json"); }
    if (!root || typeof root !== "object" || Array.isArray(root)) throw error("o arquivo de robô precisa conter um objeto JSON.", "invalid-envelope");
    if (root.kind === "robot" || Array.isArray(root.parts)) {
      allowedKeys(root, new Set(["kind", "schemaVersion", "name", "thumbnailBackgroundColor", "partRegistryVersion", "parts", "metadata"]), "documento moderno");
      if (root.kind !== "robot" || root.schemaVersion !== 1 || !Array.isArray(root.parts)) throw error("versão ou tipo do RobotDocumentV1 inválido.", "invalid-schema");
      if (typeof root.name !== "string" || !root.name.trim()) throw error("o RobotDocumentV1 precisa de um nome.", "invalid-name");
      if (root.thumbnailBackgroundColor !== undefined && (typeof root.thumbnailBackgroundColor !== "string" || !/^#[0-9a-f]{6}$/i.test(root.thumbnailBackgroundColor))) throw error("a cor de fundo da thumbnail precisa usar o formato #RRGGBB.", "invalid-thumbnail-background");
      if (root.partRegistryVersion !== config.partRegistryVersion) throw error("a versão do catálogo de peças deste arquivo não é compatível.", "registry-version");
      if (root.metadata?.documentSha256) {
        const expected = String(root.metadata.documentSha256).toLowerCase();
        const withoutHash = clone(root);
        delete withoutHash.metadata.documentSha256;
        if (!Object.keys(withoutHash.metadata || {}).length) delete withoutHash.metadata;
        const actual = await sha256Hex(canonicalStringify(withoutHash));
        // Older prototype exports hashed the same document while retaining an
        // empty metadata object. Accept that exact historical representation
        // after the canonical form fails; any content change still fails both
        // integrity checks.
        let validHash = Boolean(actual && actual === expected);
        if (!validHash) {
          const legacyWithoutHash = clone(root);
          delete legacyWithoutHash.metadata.documentSha256;
          const legacyActual = await sha256Hex(canonicalStringify(legacyWithoutHash));
          validHash = Boolean(legacyActual && legacyActual === expected);
        }
        if (!validHash) throw error("o hash do RobotDocumentV1 não confere.", "hash-mismatch");
      }
      root.parts.forEach((part, index) => allowedKeys(part, new Set(["typeId", "position", "orientation", "parentPosition", "name", "materialId"]), `peça moderna ${index + 1}`));
      const controller = root.parts.filter((part) => part?.typeId === "controller");
      if (controller.length !== 1 || positionKey(controller[0].position || {}) !== "0,0,0" || controller[0].parentPosition !== undefined) throw error("o RobotDocumentV1 precisa ter exatamente um Controller na origem.", "invalid-controller");
      orientationToQuaternion(controller[0].orientation);
      const records = root.parts.filter((part) => part?.typeId !== "controller");
      const mapped = mapRobotRecords(records, root.name, "modern-json", config);
      if (root.thumbnailBackgroundColor !== undefined) mapped.state.thumbnailBackgroundColor = root.thumbnailBackgroundColor.toLowerCase();
      mapped.format = "modern-json";
      return mapped;
    }
    let payload = root;
    let format = "legacy-sBot";
    if (typeof root.data === "string") {
      payload = await decryptLegacyData(root.data);
      format = "legacy-sBot-encrypted";
    } else if (root.data && typeof root.data === "object") {
      payload = root.data;
    }
    if (!payload || !Array.isArray(payload.blocks)) throw error("o arquivo não é um RobotDocumentV1 nem um .sBot/.sb reconhecível.", "unknown-format");
    const mapped = mapRobotRecords(payload.blocks, root.name || payload.name, "legacy-sBot", config);
    mapped.format = format;
    return mapped;
  }

  globalThis.sboticsRobotIO = Object.freeze({
    axes: Object.freeze([...AXES]),
    canonicalStringify,
    clone,
    orientationFromQuaternion,
    orientationKey,
    orientationToEuler,
    orientationToQuaternion,
    parseRobotText,
    rotateOrientation,
    sha256Hex,
    unityEulerToOrientation,
    unityEulerToQuaternion
  });
})();
