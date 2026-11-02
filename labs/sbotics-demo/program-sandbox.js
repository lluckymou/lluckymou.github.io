import { ReducCommands, RobotComponentApi } from "./programming-api-registry.generated.js?imp-ux-03-blockly-drawer-controls-20261101-1";
import { PROGRAM_SANDBOX_PROFILE_V1 } from "./program-sandbox-profile.js?imp-ux-03-sandbox-profile-20261030-2";

const PROTOCOL_VERSION = PROGRAM_SANDBOX_PROFILE_V1.protocolVersion;
const MAX_WORKER_MESSAGES_PER_SECOND = PROGRAM_SANDBOX_PROFILE_V1.workerMessagesPerSecond;
const MAX_HOST_MESSAGES_PER_SECOND = PROGRAM_SANDBOX_PROFILE_V1.hostMessagesPerSecond;
const MAX_MESSAGE_BYTES = PROGRAM_SANDBOX_PROFILE_V1.maxMessageBytes;
const MAX_PROGRAM_MODULE_BYTES = PROGRAM_SANDBOX_PROFILE_V1.maxProgramModuleBytes;
const MAX_PENDING_REQUESTS = PROGRAM_SANDBOX_PROFILE_V1.maxPendingRequests;
const MAX_CAMERA_BYTES = PROGRAM_SANDBOX_PROFILE_V1.maxCameraResultBytes;

function monotonicNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function randomToken() {
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.some((value) => value !== 0)) return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  throw new Error("SANDBOX_RANDOM_UNAVAILABLE");
}

function byteLength(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

function hashHex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifyArtifact(artifact) {
  if (!globalThis.crypto?.subtle || typeof artifact?.generatedModuleUtf8 !== "string" || !artifact.generatedModuleSha256) {
    throw new Error("SANDBOX_ARTIFACT_INVALID");
  }
  if (artifact.sandboxProtocolVersion !== PROGRAM_SANDBOX_PROFILE_V1.protocolVersion || artifact.sandboxProfileVersion !== PROGRAM_SANDBOX_PROFILE_V1.id) {
    throw new Error("SANDBOX_PROFILE_MISMATCH");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(artifact.generatedModuleUtf8));
  if (hashHex(digest) !== artifact.generatedModuleSha256) throw new Error("SANDBOX_ARTIFACT_HASH_MISMATCH");
  if (byteLength(artifact.generatedModuleUtf8) > MAX_PROGRAM_MODULE_BYTES) throw new Error("SANDBOX_ARTIFACT_TOO_LARGE");
}

function messageBytes(message) {
  try {
    if (message?.type === "start" && typeof message?.payload?.moduleSource === "string") {
      const { moduleSource: _moduleSource, ...metadata } = message.payload;
      return byteLength(JSON.stringify({ ...message, payload: metadata }));
    }
    if (message?.payload?.pixels instanceof Uint8Array) return message.payload.pixels.byteLength + 1024;
    return byteLength(JSON.stringify(message));
  } catch {
    return MAX_MESSAGE_BYTES + 1;
  }
}

function messageExceedsLimit(message) {
  if (message?.type === "start" && typeof message?.payload?.moduleSource === "string") {
    return byteLength(message.payload.moduleSource) > MAX_PROGRAM_MODULE_BYTES || messageBytes(message) > MAX_MESSAGE_BYTES;
  }
  return messageBytes(message) > MAX_MESSAGE_BYTES;
}

const RUNTIME_WORKER_BOOTSTRAP = String.raw`
let port = null;
let runId = "";
let capability = "";
let incomingSequence = 0;
let outgoingSequence = 0;
let incomingWindowAt = 0;
let incomingWindowCount = 0;
let outgoingWindowAt = 0;
let outgoingWindowCount = 0;
let pendingRequests = new Map();
let nextRequestId = 0;
let active = false;
let currentSnapshot = Object.freeze({ time: 0, tick: 0, physicsTick: 0, status: "idle", components: Object.freeze({}) });
let componentInventory = [];
let componentTypes = [];
let commandRecords = [];
let runLocale = "en-US";
let runEpochMs = 0;
let userCodeEnvironmentSeed = "";
let authoredExecutionSha256 = "";
let environmentRandomizationProfileVersion = "";
let randomDrawIndex = 0n;
const PROTOCOL_VERSION = ${PROGRAM_SANDBOX_PROFILE_V1.protocolVersion};
const MAX_MESSAGE_BYTES = ${PROGRAM_SANDBOX_PROFILE_V1.maxMessageBytes};
const MAX_PROGRAM_MODULE_BYTES = ${PROGRAM_SANDBOX_PROFILE_V1.maxProgramModuleBytes};
const MAX_PENDING_REQUESTS = ${PROGRAM_SANDBOX_PROFILE_V1.maxPendingRequests};
const MAX_MESSAGES_PER_SECOND = ${PROGRAM_SANDBOX_PROFILE_V1.workerMessagesPerSecond};
const MAX_HOST_MESSAGES_PER_SECOND = ${PROGRAM_SANDBOX_PROFILE_V1.hostMessagesPerSecond};
const MAX_CONSOLE_ENTRY_BYTES = ${PROGRAM_SANDBOX_PROFILE_V1.maxConsoleEntryBytes};
const HEARTBEAT_INTERVAL_MS = ${PROGRAM_SANDBOX_PROFILE_V1.heartbeatIntervalMs};
const nativeSetInterval = self.setInterval.bind(self);
const nativeClearInterval = self.clearInterval.bind(self);
const nativeNow = globalThis.performance?.now?.bind(globalThis.performance) || Date.now.bind(Date);
const nativeString = String;
const nativeEncode = TextEncoder.prototype.encode.bind(new TextEncoder());
const nativeStringify = JSON.stringify.bind(JSON);
let heartbeatTimer = null;

function byteLength(value) {
  return nativeEncode(nativeString(value)).byteLength;
}

function messageBytes(message) {
  try {
    if (message?.type === "start" && typeof message?.payload?.moduleSource === "string") {
      const { moduleSource: _moduleSource, ...metadata } = message.payload;
      return byteLength(nativeStringify({ ...message, payload: metadata }));
    }
    if (message?.payload?.pixels instanceof Uint8Array) return message.payload.pixels.byteLength + 1024;
    return byteLength(nativeStringify(message));
  } catch { return MAX_MESSAGE_BYTES + 1; }
}

function messageExceedsLimit(message) {
  if (message?.type === "start" && typeof message?.payload?.moduleSource === "string") {
    return byteLength(message.payload.moduleSource) > MAX_PROGRAM_MODULE_BYTES || messageBytes(message) > MAX_MESSAGE_BYTES;
  }
  return messageBytes(message) > MAX_MESSAGE_BYTES;
}

function fail(code, message) {
  if (!port) return;
  try { send("failed", { code: String(code || "PROGRAM_RUNTIME_ERROR"), message: String(message || code || "Program runtime failed").slice(0, 512) }); } catch {}
  if (heartbeatTimer !== null) nativeClearInterval(heartbeatTimer);
  heartbeatTimer = null;
  active = false;
  pendingRequests.forEach((request) => request.reject(new Error("RUN_ABORTED")));
  pendingRequests.clear();
  try { port.close(); } catch {}
}

function startHeartbeat() {
  if (heartbeatTimer !== null) return;
  heartbeatTimer = nativeSetInterval(() => {
    if (!active || !port) return;
    try { send("heartbeat", {}); }
    catch (error) { fail(error?.message || "SANDBOX_HEARTBEAT_FAILED", error?.message || String(error)); }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer !== null) nativeClearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function send(type, payload = {}, transfer = []) {
  if (!port) throw new Error("SANDBOX_PORT_CLOSED");
  const now = nativeNow();
  if (now - outgoingWindowAt >= 1000) { outgoingWindowAt = now; outgoingWindowCount = 0; }
  outgoingWindowCount += 1;
  if (outgoingWindowCount > MAX_MESSAGES_PER_SECOND) throw new Error("SANDBOX_RATE_LIMIT");
  const message = { protocol: PROTOCOL_VERSION, capability, runId, sequence: ++outgoingSequence, type, payload };
  if (messageExceedsLimit(message)) throw new Error("SANDBOX_MESSAGE_TOO_LARGE");
  port.postMessage(message, transfer);
}

function rpc(operation, args = {}) {
  if (!active) return Promise.reject(new Error("RUN_ABORTED"));
  if (pendingRequests.size >= MAX_PENDING_REQUESTS) return Promise.reject(new Error("REQUEST_LIMIT"));
  const requestId = String(++nextRequestId);
  return new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, operation });
    try { send("request", { requestId, operation, args }); }
    catch (error) { pendingRequests.delete(requestId); reject(error); }
  });
}

function sendCommand(componentName, method, args) {
  if (!active) throw new Error("RUN_ABORTED");
  send("command", { componentName, method, args });
}

function frozenCopy(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => frozenCopy(value[key]));
  return Object.freeze(value);
}

function componentType(typeId) {
  return componentTypes.find((type) => type.typeId === typeId || (type.placeableTypeIds || []).includes(typeId)) || null;
}

function liveReading(entry, name) {
  const reading = currentSnapshot.components[entry.instanceId]?.readings;
  if (!reading || !Object.prototype.hasOwnProperty.call(reading, name)) throw new Error("COMPONENT_INACTIVE");
  return reading[name];
}

function buildComponent(entry) {
  const contract = componentType(entry.typeId) || componentType(entry.apiTypeId);
  if (!contract) throw new Error("COMPONENT_WRONG_TYPE");
  const result = {};
  for (const reading of contract.readings || []) {
    Object.defineProperty(result, reading.name, { enumerable: true, configurable: false, get: () => liveReading(entry, reading.name) });
  }
  for (const command of contract.commands || []) {
    Object.defineProperty(result, command.name, {
      enumerable: true,
      configurable: false,
      value: (...args) => {
        if (entry.typeId === "camera" && command.name === "snap") return rpc("camera.snap", { componentName: entry.codeName }).then((capture) => {
          const width = 128;
          const height = 128;
          if (!capture || capture.width !== width || capture.height !== height || !(capture.pixels instanceof Uint8Array) || capture.pixels.length !== width * height * 4) throw new Error("CAMERA_RESULT_INVALID");
          return Array.from({ length: width }, (_, x) => Array.from({ length: height }, (_, y) => {
            const offset = ((height - 1 - y) * width + x) * 4;
            return { r: capture.pixels[offset], g: capture.pixels[offset + 1], b: capture.pixels[offset + 2] };
          }));
        });
        sendCommand(entry.codeName, command.name, args);
      }
    });
  }
  return Object.freeze(result);
}

const SHA256_INITIAL = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const SHA256_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];

function frame(parts) {
  const encoded = parts.map((part) => new TextEncoder().encode(String(part).normalize("NFC")));
  const length = encoded.reduce((sum, bytes) => sum + 4 + bytes.byteLength, 0);
  const result = new Uint8Array(length);
  const view = new DataView(result.buffer);
  let offset = 0;
  for (const bytes of encoded) {
    view.setUint32(offset, bytes.byteLength, false);
    offset += 4;
    result.set(bytes, offset);
    offset += bytes.byteLength;
  }
  return result;
}

function sha256Sync(input) {
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.byteLength] = 0x80;
  const bitLength = BigInt(input.byteLength) * 8n;
  for (let index = 0; index < 8; index += 1) padded[paddedLength - 1 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
  const hash = [...SHA256_INITIAL];
  const words = new Uint32Array(64);
  const rotateRight = (value, bits) => (value >>> bits) | (value << (32 - bits));
  for (let offset = 0; offset < padded.byteLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] = ((padded[base] << 24) | (padded[base + 1] << 16) | (padded[base + 2] << 8) | padded[base + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const a = words[index - 15];
      const b = words[index - 2];
      const sigma0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
      const sigma1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0; hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0;
    hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0; hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
  }
  const digest = new Uint8Array(32);
  const output = new DataView(digest.buffer);
  hash.forEach((word, index) => output.setUint32(index * 4, word, false));
  return digest;
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function nextRandomUnit() {
  const drawIndex = String(randomDrawIndex++);
  const key = sha256Sync(frame([
    "sbotics-environment-user-code-v1",
    environmentRandomizationProfileVersion,
    userCodeEnvironmentSeed,
    authoredExecutionSha256,
    drawIndex
  ]));
  const blockFrame = frame(["sbotics-arena-block-v1", bytesToHex(key)]);
  const blockInput = new Uint8Array(blockFrame.byteLength + 8);
  blockInput.set(blockFrame);
  const wordBytes = sha256Sync(blockInput);
  let word = 0n;
  for (let index = 0; index < 8; index += 1) word = (word << 8n) | BigInt(wordBytes[index]);
  const unit = Number(word) / 18446744073709551616;
  return unit < 1 ? unit : 1 - Number.EPSILON / 2;
}

function randomValue(...args) {
  if (!args.length) return nextRandomUnit();
  if (args.length === 1) {
    const max = Number(args[0]);
    if (!Number.isFinite(max) || max <= 0) throw new Error("INVALID_RANGE");
    return nextRandomUnit() * max;
  }
  if (args.length === 2) {
    const min = Number(args[0]); const max = Number(args[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) throw new Error("INVALID_RANGE");
    return min + nextRandomUnit() * (max - min);
  }
  throw new Error("INVALID_ARITY");
}

function boundedNumber(value, name) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) throw new Error("INVALID_NUMBER:" + name);
  return numeric;
}

function roundEven(value, places) {
  const numeric = boundedNumber(value, "value");
  const precision = boundedNumber(places, "decimalPlaces");
  if (!Number.isInteger(precision) || precision < 0 || precision > 15) throw new Error("OUT_OF_RANGE:decimalPlaces");
  const factor = 10 ** precision;
  const scaled = Math.abs(numeric) * factor;
  const floor = Math.floor(scaled);
  const fraction = scaled - floor;
  const rounded = fraction < 0.5 ? floor : fraction > 0.5 ? floor + 1 : floor % 2 === 0 ? floor : floor + 1;
  return Math.sign(numeric) * rounded / factor;
}

function positiveModulo(value, divisor) {
  const number = boundedNumber(value, "value"); const by = boundedNumber(divisor, "divisor");
  if (by === 0) throw new Error("DIVIDE_BY_ZERO");
  return ((number % by) + by) % by;
}

function parseNumber(value) {
  if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) throw new Error("INVALID_CONVERSION");
  const number = Number(value.trim());
  if (!Number.isFinite(number)) throw new Error("INVALID_CONVERSION");
  return number;
}

function robotFacade() {
  const byName = new Map(componentInventory.map((entry) => [entry.codeName, buildComponent(entry)]));
  const componentObject = Object.freeze(Object.fromEntries(byName.entries()));
  const robot = {};
  Object.defineProperties(robot, {
    components: { enumerable: true, value: componentObject },
    componentNames: { enumerable: true, get: () => Object.freeze([...byName.keys()]) },
    component: { enumerable: true, value: (name) => {
      const key = String(name);
      const component = byName.get(key);
      if (!component) throw new Error("COMPONENT_MISSING:" + key.slice(0, 96));
      return component;
    } },
    inclinationDeg: { enumerable: true, get: () => globalReading("inclinationDeg") },
    compassDeg: { enumerable: true, get: () => globalReading("compassDeg") },
    speed: { enumerable: true, get: () => globalReading("speed") },
    wait: { enumerable: true, value: (milliseconds) => {
      const value = boundedNumber(milliseconds, "milliseconds");
      if (value < 0 || value > ${PROGRAM_SANDBOX_PROFILE_V1.maxWaitSimulationMs}) return Promise.reject(new Error("OUT_OF_RANGE:milliseconds"));
      return rpc("wait", { milliseconds: value });
    } },
    random: { enumerable: true, value: (...args) => randomValue(...args) },
    clamp: { enumerable: true, value: (value, min, max) => {
      const v = boundedNumber(value, "value"); const lo = boundedNumber(min, "min"); const hi = boundedNumber(max, "max");
      if (lo > hi) throw new Error("INVALID_RANGE"); return Math.min(hi, Math.max(lo, v));
    } },
    map: { enumerable: true, value: (value, inMin, inMax, outMin, outMax) => {
      const v = boundedNumber(value, "value"); const lo = boundedNumber(inMin, "inMin"); const hi = boundedNumber(inMax, "inMax");
      const outLo = boundedNumber(outMin, "outMin"); const outHi = boundedNumber(outMax, "outMax");
      if (lo === hi) throw new Error("INVALID_RANGE"); return outLo + (v - lo) * (outHi - outLo) / (hi - lo);
    } },
    round: { enumerable: true, value: (value, places = 0) => roundEven(value, places) },
    modulo: { enumerable: true, value: (value, divisor) => positiveModulo(value, divisor) },
    toNumber: { enumerable: true, value: (value) => typeof value === "number" ? boundedNumber(value, "value") : typeof value === "boolean" ? Number(value) : parseNumber(value) },
    toBoolean: { enumerable: true, value: (value) => boundedNumber(value, "value") >= 1 },
    console: { enumerable: true, value: Object.freeze({
      print: (value) => send("console", { method: "print", values: [safeDisplayValue(value)] }),
      println: (value = "") => send("console", { method: "println", values: [safeDisplayValue(value)] }),
      log: (...values) => send("console", { method: "log", values: values.map(safeDisplayValue) }),
      warn: (...values) => send("console", { method: "warn", values: values.map(safeDisplayValue) }),
      error: (...values) => send("console", { method: "error", values: values.map(safeDisplayValue) }),
      clear: () => send("console", { method: "clear", values: [] }),
      open: () => send("console", { method: "open", values: [] })
    }) },
    debug: { enumerable: true, value: Object.freeze({ pause: () => rpc("debug.pause") }) },
    __sbotics: { enumerable: false, value: Object.freeze({
      reduc: (commandId, args) => reduceCommand(robot, commandId, args),
      clock: Object.freeze({
        dateNow: () => runEpochMs + Math.round(currentSnapshot.time * 1000),
        performanceNow: () => Number(currentSnapshot.time) * 1000
      })
    }) }
  });
  return Object.freeze(robot);
}

function truncateUtf8(value, maxBytes) {
  let result = "";
  let usedBytes = 0;
  for (const character of nativeString(value)) {
    const characterBytes = nativeEncode(character).byteLength;
    if (usedBytes + characterBytes > maxBytes) break;
    result += character;
    usedBytes += characterBytes;
  }
  return result;
}

function safeDisplayValue(value) {
  let display;
  if (typeof value === "string") display = value;
  else if (value === null || ["number", "boolean"].includes(typeof value)) display = nativeString(value);
  else {
    try { display = nativeStringify(value); }
    catch { display = "[value]"; }
  }
  return truncateUtf8(display, MAX_CONSOLE_ENTRY_BYTES);
}

function globalReading(name) {
  const entry = Object.values(currentSnapshot.components).find((item) => item.typeId === "controller");
  if (!entry?.readings || !Object.prototype.hasOwnProperty.call(entry.readings, name)) throw new Error("COMPONENT_INACTIVE");
  return entry.readings[name];
}

function reducerEntry(commandId) {
  const record = commandRecords.find((item) => item.commandId === commandId);
  if (!record) throw new Error("REDUC_UNKNOWN_SYMBOL");
  return record;
}

function componentFor(robot, name, typeId) {
  const component = robot.component(name);
  const inventory = componentInventory.find((entry) => entry.codeName === String(name));
  if (!inventory || inventory.typeId !== typeId && inventory.apiTypeId !== typeId) throw new Error("COMPONENT_WRONG_TYPE:" + String(name).slice(0, 96));
  return component;
}

function colorName(rgb) {
  if (!rgb) throw new Error("COMPONENT_INACTIVE");
  const names = runLocale === "pt-BR"
    ? [["Preto",0,0,0],["Branco",255,255,255],["Verde",0,255,0],["Vermelho",255,0,0],["Azul",0,0,255],["Amarelo",255,255,0],["Magenta",255,0,255],["Ciano",0,255,255]]
    : [["Black",0,0,0],["White",255,255,255],["Green",0,255,0],["Red",255,0,0],["Blue",0,0,255],["Yellow",255,255,0],["Magenta",255,0,255],["Cyan",0,255,255]];
  return names.reduce((best, item) => {
    const distance = Math.abs(rgb.r-item[1])+Math.abs(rgb.g-item[2])+Math.abs(rgb.b-item[3]);
    return !best || distance < best.distance ? { name: item[0], distance } : best;
  }, null).name;
}

function playFrequency(robot, componentName, frequencyHz) {
  componentFor(robot, componentName, "buzzer").playHz(frequencyHz, "square");
}

function reduceCommand(robot, commandId, args) {
  const record = reducerEntry(commandId);
  const name = record.name;
  const componentName = args?.[0];
  const numeric = (value, label = "value") => boundedNumber(value, label);
  if (name === "AbrirConsole") return robot.console.open();
  if (name === "Aleatorio") return randomValue(...args);
  if (["Bussola", "Direcao"].includes(name)) return robot.compassDeg;
  if (name === "Inclinacao") return robot.inclinationDeg;
  if (name === "Velocidade") return robot.speed;
  if (name === "Motor") return componentFor(robot, componentName, "servo").setTargetVelocity(numeric(args[1]));
  if (name === "AnguloMotor") return componentFor(robot, componentName, "servo").angleDeg;
  if (name === "VelocidadeMotor") return componentFor(robot, componentName, "servo").velocityDegPerSecond;
  if (name === "VelocidadeAlvoMotor") return componentFor(robot, componentName, "servo").targetDegPerSecond;
  if (name === "TravarMotor") return args[1] === true ? componentFor(robot, componentName, "servo").lock() : componentFor(robot, componentName, "servo").unlock();
  if (name === "LigarCaneta") return componentFor(robot, componentName, "pen").turnOn({ r: numeric(args[1]), g: numeric(args[2]), b: numeric(args[3]) });
  if (name === "DesligarCaneta") return componentFor(robot, componentName, "pen").turnOff();
  if (name === "ApagarCaneta") return componentFor(robot, componentName, "pen").clear();
  if (name === "LigarLuz") return componentFor(robot, componentName, "light").turnOn({ r: numeric(args[1]), g: numeric(args[2]), b: numeric(args[3]) });
  if (name === "DesligarLuz") return componentFor(robot, componentName, "light").turnOff();
  if (["Colorido", "Cor", "CorAzul", "CorVerde", "CorVermelho", "Luminosidade", "Luz"].includes(name)) {
    const component = componentFor(robot, componentName, "colorSensor");
    const rgb = component.color;
    if (name === "Colorido") return component.seesNonBlack;
    if (name === "Cor") return colorName(rgb);
    if (name === "CorAzul") return rgb.b;
    if (name === "CorVerde") return rgb.g;
    if (name === "CorVermelho") return rgb.r;
    if (name === "Luminosidade" || name === "Luz") return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  }
  if (name === "EstaTocando") return componentFor(robot, componentName, "buzzer").playing;
  if (name === "PararSom") return componentFor(robot, componentName, "buzzer").stop();
  if (name === "TocarFrequencia") {
    const hertz = numeric(args[1], "hertz"); if (hertz < 1 || hertz > 20000) throw new Error("OUT_OF_RANGE:hertz");
    return playFrequency(robot, componentName, hertz);
  }
  if (["TocarNota", "TocarSolfege"].includes(name)) {
    const raw = String(args[1] || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const notes = { c:32, d:36, e:41, f:43, g:49, a:55, b:61, do:32, re:36, mi:41, fa:43, sol:49, la:55, si:61 };
    const frequency = notes[raw]; if (!frequency) throw new Error("INVALID_NOTE");
    return playFrequency(robot, componentName, frequency);
  }
  if (["TemAlgo", "Ultra", "UltraVeAlgo", "Ultrassonico"].includes(name)) {
    const component = componentFor(robot, componentName, "ultrasonicSensor");
    return name === "TemAlgo" || name === "UltraVeAlgo" ? component.hit : component.distance;
  }
  if (name === "Toque") return componentFor(robot, componentName, "touchSensor").contact;
  if (name === "ToqueValor") return componentFor(robot, componentName, "touchSensor").analog;
  if (["CarimboHora", "CarimboMilissegundo"].includes(name)) {
    const milliseconds = runEpochMs + Math.round(currentSnapshot.time * 1000);
    return name === "CarimboHora" ? Math.floor(milliseconds / 1000) : milliseconds;
  }
  if (name === "Esperar" || name === "Pausa") return robot.wait(numeric(args[0], "milliseconds"));
  if (name === "Escrever") return robot.console.print(args[0]);
  if (name === "EscreverLinha") return robot.console.println(args[0]);
  if (name === "LimparConsole") return robot.console.clear();
  if (name === "ArcoCosseno") { const n=numeric(args[0]); if(n < -1 || n > 1) throw new Error("OUT_OF_RANGE:value"); return Math.acos(n)*180/Math.PI; }
  if (name === "ArcoSeno") { const n=numeric(args[0]); if(n < -1 || n > 1) throw new Error("OUT_OF_RANGE:value"); return Math.asin(n)*180/Math.PI; }
  if (name === "ArcoTangente") return Math.atan(numeric(args[0]))*180/Math.PI;
  if (name === "Arredondar") return roundEven(args[0], args[1]);
  if (name === "Concatenar") return String(args[0]) + String(args[1]);
  if (name === "Cosseno") return Math.cos(numeric(args[0])*Math.PI/180);
  if (name === "Limitar") return robot.clamp(args[0], args[1], args[2]);
  if (name === "Mapeamento") return robot.map(args[0], args[1], args[2], args[3], args[4]);
  if (name === "Modulo") return Math.abs(numeric(args[0]));
  if (name === "Pi") return Math.PI;
  if (name === "RaizQuadrada") { const n=numeric(args[0]); if(n < 0) throw new Error("OUT_OF_RANGE:value"); return Math.sqrt(n); }
  if (name === "Resto") { const n=numeric(args[0]); const by=numeric(args[1], "positiveDivisor"); if(by <= 0) throw new Error("OUT_OF_RANGE:positiveDivisor"); return positiveModulo(n, by); }
  if (name === "Seno") return Math.sin(numeric(args[0])*Math.PI/180);
  if (name === "Tangente") return Math.tan(numeric(args[0])*Math.PI/180);
  if (name === "VirarBooleano") return numeric(args[0]) >= 1;
  if (name === "VirarNumero") return parseNumber(args[0]);
  if (name === "VirarTexto") { const n=numeric(args[0]); return Object.is(n, -0) ? "0" : String(n); }
  if (name === "Interromper") throw new Error("REDUC_CONTEXT");
  throw new Error("REDUC_UNKNOWN_SYMBOL:" + String(record.commandId));
}

async function startProgram(message) {
  const payload = message.payload || {};
  if (active || typeof payload.moduleSource !== "string" || byteLength(payload.moduleSource) > MAX_PROGRAM_MODULE_BYTES) throw new Error("SANDBOX_START_INVALID");
  runId = message.runId;
  capability = message.capability;
  componentInventory = Array.isArray(payload.componentInventory) ? payload.componentInventory : [];
  componentTypes = Array.isArray(payload.componentTypes) ? payload.componentTypes : [];
  commandRecords = Array.isArray(payload.commandRecords) ? payload.commandRecords : [];
  runLocale = payload.locale === "pt-BR" ? "pt-BR" : "en-US";
  runEpochMs = Number(payload.runEpochMs) || 0;
  userCodeEnvironmentSeed = String(payload.environmentSeed || "");
  authoredExecutionSha256 = String(payload.authoredSha256 || "");
  environmentRandomizationProfileVersion = String(payload.environmentRandomizationProfileVersion || "");
  if (!userCodeEnvironmentSeed || !/^[a-f0-9]{64}$/.test(authoredExecutionSha256) || environmentRandomizationProfileVersion !== "environment-randomization-v1") throw new Error("ENVIRONMENT_RANDOMIZATION_PROFILE_INVALID");
  currentSnapshot = frozenCopy(payload.snapshot || currentSnapshot);
  active = true;
  startHeartbeat();
  const sourceUrl = URL.createObjectURL(new Blob([payload.moduleSource], { type: "text/javascript" }));
  let module;
  try { module = await import(sourceUrl); } finally { URL.revokeObjectURL(sourceUrl); }
  if (typeof module.main !== "function") throw new Error("SANDBOX_ENTRYPOINT_INVALID");
  const robot = robotFacade();
  const originalRandom = Math.random;
  try { Math.random = () => randomValue(); } catch {}
  const terminalConsole = Object.freeze({
    log: (...values) => send("console", { method: "log", values: values.map(safeDisplayValue) }),
    warn: (...values) => send("console", { method: "warn", values: values.map(safeDisplayValue) }),
    error: (...values) => send("console", { method: "error", values: values.map(safeDisplayValue) })
  });
  try { Object.defineProperty(self, "console", { configurable: true, enumerable: false, value: terminalConsole }); }
  catch { try { self.console = terminalConsole; } catch {} }
  send("started", {});
  try {
    await module.main(robot);
    if (active) { send("done", {}); active = false; stopHeartbeat(); }
  } catch (error) {
    fail(error?.message || "PROGRAM_RUNTIME_ERROR", error?.message || String(error));
  } finally {
    try { Math.random = originalRandom; } catch {}
  }
}

function receive(message) {
  if (!message || message.protocol !== PROTOCOL_VERSION || message.runId !== runId || message.capability !== capability || message.sequence !== incomingSequence + 1) {
    fail("SANDBOX_PROTOCOL_VIOLATION", "Invalid sandbox protocol message"); return;
  }
  if (messageExceedsLimit(message)) { fail("SANDBOX_MESSAGE_TOO_LARGE", "Sandbox message exceeded its bound"); return; }
  incomingSequence = message.sequence;
  const now = nativeNow();
  if (now - incomingWindowAt >= 1000) { incomingWindowAt = now; incomingWindowCount = 0; }
  incomingWindowCount += 1;
  if (incomingWindowCount > MAX_HOST_MESSAGES_PER_SECOND) { fail("SANDBOX_RATE_LIMIT", "Host message rate exceeded"); return; }
  const payload = message.payload || {};
  if (message.type === "start") { startProgram(message).catch((error) => fail(error?.message || "SANDBOX_START_FAILED", error?.message || String(error))); return; }
  if (message.type === "snapshot") { currentSnapshot = frozenCopy(payload.snapshot || currentSnapshot); return; }
  if (message.type === "response") {
    const pending = pendingRequests.get(String(payload.requestId));
    if (!pending) { fail("SANDBOX_PROTOCOL_VIOLATION", "Unknown request response"); return; }
    pendingRequests.delete(String(payload.requestId));
    if (payload.ok === true) pending.resolve(payload.result);
    else pending.reject(new Error(String(payload.error || "CAPABILITY_FAILED")));
    return;
  }
  if (message.type === "stop") {
    active = false;
    stopHeartbeat();
    pendingRequests.forEach((request) => request.reject(new Error("RUN_ABORTED")));
    pendingRequests.clear();
    try { port.close(); } catch {}
    return;
  }
  fail("SANDBOX_PROTOCOL_VIOLATION", "Unknown sandbox message");
}

self.addEventListener("message", (event) => {
  if (port || event.data?.type !== "attach" || !event.ports?.[0]) return;
  port = event.ports[0];
  runId = String(event.data.runId || "");
  capability = String(event.data.capability || "");
  if (!runId || !capability) { try { port.close(); } catch {} return; }
  port.onmessage = (portEvent) => receive(portEvent.data);
  port.start();
  send("ready", {});
});
`;

function sandboxDocument() {
  const workerSource = JSON.stringify(RUNTIME_WORKER_BOOTSTRAP);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"></head><body><script>
const workerSource = ${workerSource};
const allowedWorkerFailurePhases = new Set(['create', 'attach', 'policy', 'worker', 'message']);
const allowedWorkerFailureNames = new Set(['AbortError', 'DataCloneError', 'InvalidStateError', 'NetworkError', 'NotSupportedError', 'SecurityError', 'SyntaxError', 'TypeError']);
const allowedWorkerFailureClasses = new Set(['CSPBlocked', 'ModuleLoadFailed', 'OriginBlocked', 'WorkerLoadFailed']);
function classifyWorkerFailure(error) {
  const message = String(error?.message || '').toLowerCase();
  if (/content security policy|violates? (?:the )?(?:worker )?policy|refused to create.*worker/.test(message)) return 'CSPBlocked';
  if (/cross[- ]origin|same[- ]origin|access control|\bcors\b|opaque origin/.test(message)) return 'OriginBlocked';
  if (/mime type|module script|module worker|syntaxerror|unexpected token|not a module/.test(message)) return 'ModuleLoadFailed';
  if (/networkerror|failed to load|load failed|could not be loaded/.test(message)) return 'WorkerLoadFailed';
  return '';
}
function reportWorkerFailure(phase, error, runId, capability, failureClass = '') {
  const safePhase = allowedWorkerFailurePhases.has(phase) ? phase : 'worker';
  const errorName = String(error?.error?.name || error?.name || '');
  const safeErrorName = allowedWorkerFailureNames.has(errorName) ? errorName : '';
  const classifiedFailure = allowedWorkerFailureClasses.has(failureClass) ? failureClass : classifyWorkerFailure(error);
  parent.postMessage({
    type: 'sbotics-program-sandbox-worker-error',
    runId,
    capability,
    failurePhase: safePhase,
    failureName: safeErrorName,
    failureClass: classifiedFailure
  }, '*');
}
window.addEventListener('message', function(event) {
  if (event.source !== parent || event.origin === 'null' || event.data?.type !== 'sbotics-program-sandbox-init' || event.data?.protocol !== ${PROTOCOL_VERSION} || !event.ports || event.ports.length !== 1) return;
  window.removeEventListener('message', arguments.callee);
  let workerUrl = '';
  let worker = null;
  let port = null;
  let phase = 'create';
  const runId = event.data.runId;
  const capability = event.data.capability;
  window.addEventListener('securitypolicyviolation', function(policyEvent) {
    const directive = String(policyEvent.effectiveDirective || policyEvent.violatedDirective || '');
    if (!['worker-src', 'child-src', 'default-src', 'script-src'].includes(directive)) return;
    const blockedUri = String(policyEvent.blockedURI || '');
    if (blockedUri && !blockedUri.startsWith('blob:') && blockedUri !== 'blob' && blockedUri !== 'inline') return;
    reportWorkerFailure('policy', null, runId, capability, 'CSPBlocked');
  });
  try {
    workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    worker = new Worker(workerUrl, { type: 'classic', name: 'sbotics-local-program' });
    worker.onerror = function(workerEvent) { reportWorkerFailure('worker', workerEvent, runId, capability); };
    worker.onmessageerror = function() { reportWorkerFailure('message', null, runId, capability); };
    port = event.ports[0];
    phase = 'attach';
    worker.postMessage({ type: 'attach', runId, capability, port }, [port]);
    window.addEventListener('unload', function() { try { worker.terminate(); URL.revokeObjectURL(workerUrl); } catch {} });
  } catch (error) {
    try { worker?.terminate(); } catch {}
    try { port?.close(); } catch {}
    try { if (workerUrl) URL.revokeObjectURL(workerUrl); } catch {}
    reportWorkerFailure(phase, error, runId, capability);
  }
});
</script></body></html>`;
}

export class ProgramSandbox {
  constructor({ artifact, componentInventory = [], locale = "en-US", environmentSeed = "", initialSnapshot = null, onMessage = null, onError = null, onComplete = null } = {}) {
    this.artifact = artifact;
    this.componentInventory = componentInventory;
    this.locale = locale;
    this.environmentSeed = environmentSeed;
    this.initialSnapshot = initialSnapshot;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onComplete = onComplete;
    this.iframe = null;
    this.port = null;
    this.runId = randomToken();
    this.capability = randomToken();
    this.outgoingSequence = 0;
    this.incomingSequence = 0;
    this.messageWindowAt = 0;
    this.messageWindowCount = 0;
    this.hostMessageWindowAt = 0;
    this.hostMessageWindowCount = 0;
    this.pendingOperationRequests = new Map();
    this.preparedPromise = null;
    this.preparedResolve = null;
    this.preparedReject = null;
    this.launchPromise = null;
    this.launchResolve = null;
    this.launchReject = null;
    this.terminal = false;
    this.prepared = false;
    this.launched = false;
    this.started = false;
    this.readyTimer = null;
    this.startTimer = null;
    this.watchdogTimer = null;
    this.launchedAt = 0;
    this.lastHeartbeatAt = 0;
    this.lastProgressAt = 0;
    this.snapshotPhysicsTick = -1;
    this.windowMessageHandler = (event) => this.receiveFrameMessage(event);
  }

  async prepare() {
    await verifyArtifact(this.artifact);
    if (!globalThis.MessageChannel || !globalThis.crypto?.getRandomValues) throw new Error("SANDBOX_UNAVAILABLE");
    this.preparedPromise = new Promise((resolve, reject) => { this.preparedResolve = resolve; this.preparedReject = reject; });
    this.readyTimer = globalThis.setTimeout(() => {
      this.fail("SANDBOX_READY_TIMEOUT", "The isolated runner did not become ready in time", true);
    }, PROGRAM_SANDBOX_PROFILE_V1.sandboxReadyTimeoutMs);
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("title", "sBotics local program sandbox");
    iframe.tabIndex = -1;
    iframe.style.cssText = "position:fixed;width:1px;height:1px;left:-2px;top:-2px;border:0;opacity:0;pointer-events:none";
    iframe.srcdoc = sandboxDocument();
    this.iframe = iframe;
    globalThis.addEventListener("message", this.windowMessageHandler);
    iframe.addEventListener("load", () => {
      if (this.terminal || this.port) return;
      const channel = new MessageChannel();
      this.port = channel.port1;
      this.port.onmessage = (event) => this.receivePortMessage(event.data);
      this.port.onmessageerror = () => this.fail("SANDBOX_PROTOCOL_VIOLATION");
      this.port.start();
      try {
        iframe.contentWindow.postMessage({ type: "sbotics-program-sandbox-init", protocol: PROTOCOL_VERSION, runId: this.runId, capability: this.capability }, "*", [channel.port2]);
      } catch { this.fail("SANDBOX_UNAVAILABLE"); }
    }, { once: true });
    iframe.addEventListener("error", () => this.fail("SANDBOX_BOOT_FAILED"), { once: true });
    (document.body || document.documentElement).append(iframe);
    return this.preparedPromise;
  }

  launch(snapshot = this.initialSnapshot) {
    if (this.terminal || !this.prepared || this.launched || !this.port) throw new Error("SANDBOX_NOT_PREPARED");
    this.launched = true;
    this.launchedAt = monotonicNow();
    this.lastHeartbeatAt = this.launchedAt;
    this.lastProgressAt = this.launchedAt;
    this.launchPromise = new Promise((resolve, reject) => { this.launchResolve = resolve; this.launchReject = reject; });
    this.startTimer = globalThis.setTimeout(() => {
      this.fail("SANDBOX_START_TIMEOUT", "The Program did not enter its main function in time", true);
    }, PROGRAM_SANDBOX_PROFILE_V1.programStartTimeoutMs);
    this.watchdogTimer = globalThis.setInterval(() => this.checkWatchdog(), PROGRAM_SANDBOX_PROFILE_V1.watchdogCheckIntervalMs);
    try {
      this.send("start", {
        moduleSource: this.artifact.generatedModuleUtf8,
        authoredSha256: this.artifact.authoredSha256,
        componentInventory: this.componentInventory,
        componentTypes: RobotComponentApi.types.map((type) => ({
          typeId: type.typeId,
          placeableTypeIds: type.placeableTypeIds || [],
          readings: (type.readings || []).map((reading) => ({ name: reading.name })),
          commands: (type.commands || []).map((command) => ({ name: command.name, parameters: command.parameters || [] }))
        })),
        commandRecords: ReducCommands.records.map((record) => ({ commandId: record.commandId, name: record.name })),
        locale: this.locale,
        environmentSeed: this.environmentSeed,
        environmentRandomizationProfileVersion: "environment-randomization-v1",
        runEpochMs: Date.now(),
        snapshot: this.projectSnapshot(snapshot)
      });
    } catch (error) {
      this.fail(error?.message || "SANDBOX_START_FAILED");
    }
    return this.launchPromise;
  }

  send(type, payload = {}, transfer = []) {
    if (this.terminal || !this.port) throw new Error("RUN_TERMINAL");
    const now = monotonicNow();
    if (now - this.hostMessageWindowAt >= 1000) { this.hostMessageWindowAt = now; this.hostMessageWindowCount = 0; }
    this.hostMessageWindowCount += 1;
    if (this.hostMessageWindowCount > MAX_HOST_MESSAGES_PER_SECOND) throw new Error("SANDBOX_RATE_LIMIT");
    const message = { protocol: PROTOCOL_VERSION, runId: this.runId, capability: this.capability, sequence: ++this.outgoingSequence, type, payload };
    if (messageExceedsLimit(message)) throw new Error("SANDBOX_MESSAGE_TOO_LARGE");
    this.port.postMessage(message, transfer);
  }

  receiveFrameMessage(event) {
    const message = event.data;
    if (!this.iframe || event.source !== this.iframe.contentWindow || event.origin !== "null" || message?.type !== "sbotics-program-sandbox-worker-error" || message.runId !== this.runId || message.capability !== this.capability) return;
    const phase = ["create", "attach", "policy", "worker", "message"].includes(message.failurePhase) ? message.failurePhase : "worker";
    const errorName = ["AbortError", "DataCloneError", "InvalidStateError", "NetworkError", "NotSupportedError", "SecurityError", "SyntaxError", "TypeError"].includes(message.failureName) ? message.failureName : "";
    const failureClass = ["CSPBlocked", "ModuleLoadFailed", "OriginBlocked", "WorkerLoadFailed"].includes(message.failureClass) ? message.failureClass : "";
    this.fail("SANDBOX_WORKER_FAILED", "The isolated Worker could not start", false, `${phase}${failureClass ? `:${failureClass}` : errorName ? `:${errorName}` : ""}`);
  }

  receivePortMessage(message) {
    if (this.terminal || !message || message.protocol !== PROTOCOL_VERSION || message.runId !== this.runId || message.capability !== this.capability || message.sequence !== this.incomingSequence + 1) {
      this.fail("SANDBOX_PROTOCOL_VIOLATION"); return;
    }
    if (messageExceedsLimit(message)) { this.fail("SANDBOX_MESSAGE_TOO_LARGE"); return; }
    const now = Date.now();
    if (now - this.messageWindowAt >= 1000) { this.messageWindowAt = now; this.messageWindowCount = 0; }
    this.messageWindowCount += 1;
    if (this.messageWindowCount > MAX_WORKER_MESSAGES_PER_SECOND) { this.fail("SANDBOX_RATE_LIMIT"); return; }
    this.incomingSequence = message.sequence;
    const payload = message.payload || {};
    if (message.type === "heartbeat") {
      this.lastHeartbeatAt = monotonicNow();
      return;
    }
    this.lastProgressAt = monotonicNow();
    if (message.type === "ready") {
      if (this.prepared) { this.fail("SANDBOX_PROTOCOL_VIOLATION"); return; }
      if (this.readyTimer !== null) globalThis.clearTimeout(this.readyTimer);
      this.readyTimer = null;
      this.prepared = true;
      this.preparedResolve?.({ runId: this.runId });
      this.preparedResolve = null;
      this.preparedReject = null;
      return;
    }
    if (message.type === "started") {
      if (!this.launched || this.started) { this.fail("SANDBOX_PROTOCOL_VIOLATION"); return; }
      if (this.startTimer !== null) globalThis.clearTimeout(this.startTimer);
      this.startTimer = null;
      this.started = true;
      this.launchResolve?.({ runId: this.runId });
      this.launchResolve = null;
      this.launchReject = null;
      return;
    }
    if (message.type === "done") { this.finish(); return; }
    if (message.type === "failed") { this.fail(payload.code || "PROGRAM_RUNTIME_ERROR", payload.message || "Program execution failed", true); return; }
    if (!["request", "command", "console"].includes(message.type)) { this.fail("SANDBOX_PROTOCOL_VIOLATION"); return; }
    if (message.type === "request") {
      const requestId = String(payload.requestId || "");
      if (!requestId || requestId.length > 32 || this.pendingOperationRequests.has(requestId) || this.pendingOperationRequests.size >= MAX_PENDING_REQUESTS) {
        this.fail("SANDBOX_PROTOCOL_VIOLATION", "Invalid or excessive pending request", true);
        return;
      }
      this.pendingOperationRequests.set(requestId, { operation: String(payload.operation || ""), at: monotonicNow() });
    }
    try { this.onMessage?.({ type: message.type, payload, runId: this.runId, sandbox: this }); }
    catch (error) { this.fail(error?.message || "CAPABILITY_INVALID", error?.message || "Capability request failed", true); }
  }

  projectSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return { time: 0, tick: 0, physicsTick: 0, status: "idle", components: {} };
    const components = {};
    for (const [id, entry] of Object.entries(snapshot.components || {})) {
      components[id] = { typeId: String(entry.typeId || ""), name: String(entry.name || ""), readings: entry.readings && typeof entry.readings === "object" ? entry.readings : {} };
    }
    return { time: Number(snapshot.time) || 0, tick: Number(snapshot.tick) || 0, physicsTick: Number(snapshot.physicsTick) || 0, status: String(snapshot.status || "idle"), components };
  }

  updateSnapshot(snapshot) {
    if (this.terminal || !this.started) return;
    const projected = this.projectSnapshot(snapshot);
    if (projected.physicsTick === this.snapshotPhysicsTick) return;
    this.snapshotPhysicsTick = projected.physicsTick;
    try { this.send("snapshot", { snapshot: projected }); }
    catch (error) { this.fail(error?.message || "SANDBOX_MESSAGE_TOO_LARGE"); }
  }

  respond(requestId, { ok = true, result = undefined, error = "CAPABILITY_FAILED" } = {}, transfer = []) {
    if (this.terminal) return false;
    const normalizedRequestId = String(requestId);
    if (!this.pendingOperationRequests.has(normalizedRequestId)) {
      this.fail("SANDBOX_PROTOCOL_VIOLATION", "Response did not match a pending request", true);
      return false;
    }
    if (result?.pixels instanceof Uint8Array && result.pixels.byteLength > MAX_CAMERA_BYTES) {
      this.fail("SANDBOX_RESULT_TOO_LARGE");
      return false;
    }
    this.send("response", { requestId: normalizedRequestId, ok, result, error: String(error) }, transfer);
    this.lastProgressAt = monotonicNow();
    this.pendingOperationRequests.delete(normalizedRequestId);
    return true;
  }

  checkWatchdog() {
    if (this.terminal || !this.launched) return;
    const now = monotonicNow();
    if (this.started && now - this.lastHeartbeatAt > PROGRAM_SANDBOX_PROFILE_V1.heartbeatTimeoutMs) {
      this.fail("SANDBOX_HEARTBEAT_TIMEOUT", "The isolated runner stopped responding and was terminated", true);
      return;
    }
    for (const pending of this.pendingOperationRequests.values()) {
      if (pending.operation === "camera.snap" && now - pending.at > PROGRAM_SANDBOX_PROFILE_V1.cameraRequestTimeoutMs) {
        this.fail("CAMERA_TIMEOUT", "The Robot camera did not finish its bounded capture", true);
        return;
      }
    }
    const hasExpectedWait = [...this.pendingOperationRequests.values()].some(({ operation }) => operation === "wait" || operation === "debug.pause");
    if (this.started && !hasExpectedWait && now - this.lastProgressAt > PROGRAM_SANDBOX_PROFILE_V1.noProgressTimeoutMs) {
      this.fail("SANDBOX_NO_PROGRESS", "The Program stopped making progress and was terminated", true);
    }
  }

  finish() {
    if (this.terminal) return;
    this.terminal = true;
    this.cleanup("PROGRAM_COMPLETE");
    this.onComplete?.({ runId: this.runId });
  }

  fail(code, message = code, notify = false, diagnostic = "") {
    if (this.terminal) return;
    const shouldNotify = notify || this.started;
    this.terminal = true;
    this.cleanup(code);
    const error = new Error(String(code || "SANDBOX_FAILED"));
    if (diagnostic) error.diagnostic = String(diagnostic).slice(0, 80);
    this.preparedReject?.(error);
    this.launchReject?.(error);
    if (shouldNotify) this.onError?.({
      runId: this.runId,
      code: String(code || "PROGRAM_RUNTIME_ERROR"),
      message: `${String(message || code || "Program execution failed").slice(0, 420)}${diagnostic ? ` (${String(diagnostic).slice(0, 80)})` : ""}`,
      ...(diagnostic ? { diagnostic: String(diagnostic).slice(0, 80) } : {})
    });
    this.preparedResolve = null;
    this.preparedReject = null;
    this.launchResolve = null;
    this.launchReject = null;
  }

  terminate(reason = "USER_STOP") {
    if (this.terminal) return;
    try { this.send("stop", { reason: String(reason) }); } catch {}
    this.terminal = true;
    this.cleanup(reason);
    const error = new Error("RUN_ABORTED");
    this.preparedReject?.(error);
    this.launchReject?.(error);
    this.preparedResolve = null;
    this.preparedReject = null;
    this.launchResolve = null;
    this.launchReject = null;
  }

  cleanup(_reason) {
    if (this.readyTimer !== null) globalThis.clearTimeout(this.readyTimer);
    if (this.startTimer !== null) globalThis.clearTimeout(this.startTimer);
    if (this.watchdogTimer !== null) globalThis.clearInterval(this.watchdogTimer);
    this.readyTimer = null;
    this.startTimer = null;
    this.watchdogTimer = null;
    this.pendingOperationRequests.clear();
    globalThis.removeEventListener("message", this.windowMessageHandler);
    try { this.port?.close(); } catch {}
    this.port = null;
    this.iframe?.remove();
    this.iframe = null;
  }
}

export const PROGRAM_SANDBOX_LIMITS = Object.freeze({
  profileVersion: PROGRAM_SANDBOX_PROFILE_V1.id,
  protocolVersion: PROTOCOL_VERSION,
  messagesPerSecond: MAX_WORKER_MESSAGES_PER_SECOND,
  hostMessagesPerSecond: MAX_HOST_MESSAGES_PER_SECOND,
  messageBytes: MAX_MESSAGE_BYTES,
  programModuleBytes: MAX_PROGRAM_MODULE_BYTES,
  pendingRequests: MAX_PENDING_REQUESTS,
  commandQueue: PROGRAM_SANDBOX_PROFILE_V1.maxQueuedComponentCommands,
  cameraBytes: MAX_CAMERA_BYTES,
  waitSimulationMs: PROGRAM_SANDBOX_PROFILE_V1.maxWaitSimulationMs
});
