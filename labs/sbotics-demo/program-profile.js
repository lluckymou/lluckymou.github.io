import { parse } from "./vendor/acorn-8.8.1/acorn.mjs";
import {
  ReducCommands,
  ReducGrammar,
  RobotComponentApi,
  RobotGlobalApi
} from "./programming-api-registry.generated.js?imp-ux-03-blockly-drawer-controls-20261101-1";
import { PROGRAM_SANDBOX_PROFILE_V1 } from "./program-sandbox-profile.js?imp-ux-03-sandbox-profile-20261030-2";

const SOURCE_LIMIT = 1024 * 1024;
const GENERATED_LIMIT = 1024 * 1024;
const NODE_LIMIT = 100_000;
const DEPTH_LIMIT = 256;
const IDENTIFIER_LIMIT = 128;
const COMMENT_LITERAL_LIMIT = 64 * 1024;
const DIAGNOSTIC_LIMIT = 100;
const COMPILER_VERSION = "sbotics-js-profile-v1";
const INSTRUMENTATION_VERSION = "sbotics-cooperative-yield-v1";
const SANDBOX_PROTOCOL_VERSION = PROGRAM_SANDBOX_PROFILE_V1.protocolVersion;

const FORBIDDEN_GLOBALS = new Set([
  "window", "document", "globalThis", "self", "parent", "top", "frames",
  "navigator", "location", "history", "fetch", "XMLHttpRequest", "WebSocket",
  "EventSource", "Worker", "SharedWorker", "importScripts", "localStorage",
  "sessionStorage", "indexedDB", "caches", "serviceWorker", "process", "require",
  "module", "exports", "Deno", "Bun", "WebAssembly", "SharedArrayBuffer", "Atomics",
  "Proxy", "Reflect", "setTimeout", "setInterval", "setImmediate", "requestAnimationFrame",
  "cancelAnimationFrame", "queueMicrotask", "postMessage", "eval", "Function"
]);
const FORBIDDEN_MEMBER_NAMES = new Set(["__proto__", "prototype", "constructor", "__sbotics"]);
const SAFE_GLOBALS = new Set(["Math", "Number", "String", "Boolean", "Array", "Object", "JSON", "Infinity", "NaN", "undefined"]);
const SAFE_MATH_MEMBERS = new Set(["E", "LN2", "LN10", "LOG2E", "LOG10E", "PI", "SQRT1_2", "SQRT2", "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh", "cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor", "fround", "hypot", "imul", "log", "log10", "log1p", "log2", "max", "min", "pow", "round", "sign", "sin", "sinh", "sqrt", "tan", "tanh", "trunc", "random"]);
const ROOT_ROBOT_MEMBERS = new Set([
  "components", "component", "componentNames", "inclinationDeg", "compassDeg", "speed",
  "wait", "random", "clamp", "map", "round", "modulo", "toNumber", "toBoolean", "console", "debug"
]);

const componentTypeByPlaceableId = new Map();
for (const component of RobotComponentApi.types) {
  for (const placeableTypeId of component.placeableTypeIds || []) componentTypeByPlaceableId.set(placeableTypeId, component);
}
const componentTypeById = new Map(RobotComponentApi.types.map((type) => [type.typeId, type]));
const componentByName = (inventory) => new Map((inventory || []).map((item) => [String(item.name || item.codeName || ""), item]));

function locationAt(source, offset) {
  const bounded = Math.max(0, Math.min(source.length, Number(offset) || 0));
  let line = 1;
  let lastBreak = -1;
  for (let index = 0; index < bounded; index += 1) {
    if (source.charCodeAt(index) === 10) {
      line += 1;
      lastBreak = index;
    }
  }
  return { line, column: bounded - lastBreak };
}

function rangeAt(source, start, end) {
  return { start: locationAt(source, start), end: locationAt(source, end) };
}

function byteLength(value) {
  return new TextEncoder().encode(String(value)).length;
}

function addDiagnostic(list, source, code, start = 0, end = start, severity = "error", params = {}) {
  if (list.length >= DIAGNOSTIC_LIMIT) {
    list.truncatedCount = (list.truncatedCount || 0) + 1;
    return;
  }
  list.push({ code, severity, ...rangeAt(source, start, end), params });
}

function childNodes(node) {
  const result = [];
  for (const [key, value] of Object.entries(node || {})) {
    if (["start", "end", "loc", "range", "raw", "comments", "tokens"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item.type === "string") result.push(item);
    } else if (value && typeof value.type === "string") result.push(value);
  }
  return result;
}

function walk(node, visit, context = {}, depth = 0) {
  if (!node || typeof node.type !== "string") return;
  visit(node, context, depth);
  if (depth >= DEPTH_LIMIT) return;
  const nextContext = node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression"
    ? { ...context, asyncFunction: Boolean(node.async), functionDepth: (context.functionDepth || 0) + 1 }
    : context;
  for (const child of childNodes(node)) walk(child, visit, nextContext, depth + 1);
}

function memberName(node) {
  if (!node || node.type !== "MemberExpression") return null;
  if (!node.computed && node.property?.type === "Identifier") return node.property.name;
  if (node.computed && node.property?.type === "Literal" && typeof node.property.value === "string") return node.property.value;
  return null;
}

function memberPath(node) {
  const result = [];
  let current = node;
  while (current?.type === "MemberExpression") {
    const name = memberName(current);
    if (name === null) return null;
    result.unshift(name);
    current = current.object;
  }
  if (current?.type === "Identifier") result.unshift(current.name);
  else if (current?.type === "CallExpression" && current.callee?.type === "MemberExpression" && current.callee.object?.name === "robot" && memberName(current.callee) === "component") {
    result.unshift("<robot.component>");
  } else return null;
  return result;
}

function memberRoot(node) {
  let current = node;
  while (current?.type === "MemberExpression") current = current.object;
  if (current?.type === "Identifier") return current.name;
  if (current?.type === "CallExpression" && current.callee?.type === "MemberExpression" && current.callee.object?.name === "robot" && memberName(current.callee) === "component") return "<robot.component>";
  return null;
}

function isIdentifierReference(node, parent, key) {
  if (!parent) return true;
  if ((parent.type === "MemberExpression" || parent.type === "Property") && key === "property" && !parent.computed && !parent.shorthand) return false;
  if (parent.type === "Property" && key === "key" && !parent.computed && !parent.shorthand) return false;
  if (parent.type === "VariableDeclarator" && key === "id") return false;
  if ((parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression") && key === "id") return false;
  if ((parent.type === "FunctionDeclaration" || parent.type === "FunctionExpression" || parent.type === "ArrowFunctionExpression") && key === "params") return false;
  if (parent.type === "CatchClause" && key === "param") return false;
  if (parent.type === "LabeledStatement" && key === "label") return false;
  if (parent.type === "BreakStatement" && key === "label") return false;
  if (parent.type === "ContinueStatement" && key === "label") return false;
  if (parent.type === "ExportSpecifier") return false;
  return true;
}

function parentIndex(program) {
  const parents = new WeakMap();
  walk(program, (node) => {
    for (const [key, value] of Object.entries(node)) {
      if (["start", "end", "loc", "range", "raw"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((child) => child && typeof child.type === "string" && parents.set(child, { node, key }));
      else if (value && typeof value.type === "string") parents.set(value, { node, key });
    }
  });
  return parents;
}

function patternNames(pattern, names) {
  if (!pattern) return;
  if (pattern.type === "Identifier") names.add(pattern.name);
  else if (pattern.type === "RestElement") patternNames(pattern.argument, names);
  else if (pattern.type === "AssignmentPattern") patternNames(pattern.left, names);
  else if (pattern.type === "ArrayPattern") pattern.elements.forEach((item) => patternNames(item, names));
  else if (pattern.type === "ObjectPattern") pattern.properties.forEach((item) => patternNames(item.type === "RestElement" ? item.argument : item.value, names));
}

function localAndParameterNames(program) {
  const names = new Set(["robot", "main"]);
  walk(program, (node) => {
    if (node.type === "VariableDeclarator") patternNames(node.id, names);
    else if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(node.type)) {
      patternNames(node.id, names);
      node.params.forEach((parameter) => patternNames(parameter, names));
    } else if (node.type === "CatchClause") patternNames(node.param, names);
  });
  return names;
}

function isDirectNativeCall(node, parentInfo, expectedPath) {
  const parent = parentInfo?.node;
  return parent?.type === "CallExpression" && parent.callee === node && memberPath(node)?.join(".") === expectedPath && parent.arguments.length === 0;
}

function entrypointInfo(program, diagnostics, source) {
  const entrypoints = [];
  for (const statement of program.body || []) {
    if (statement.type === "FunctionDeclaration" && statement.id?.name === "main") {
      entrypoints.push({ node: statement, exported: false, wrapper: statement });
      continue;
    }
    if (statement.type === "ExportNamedDeclaration" && statement.declaration?.type === "FunctionDeclaration" && statement.declaration.id?.name === "main" && !(statement.specifiers || []).length && !statement.source) {
      entrypoints.push({ node: statement.declaration, exported: true, wrapper: statement });
    }
  }
  if (entrypoints.length !== 1) {
    addDiagnostic(diagnostics, source, "JS_ENTRYPOINT", 0, Math.min(source.length, 1), "error", { reason: "count" });
    return null;
  }
  const entry = entrypoints[0];
  const fn = entry.node;
  if (!fn.async || fn.generator || fn.params.length !== 1 || fn.params[0]?.type !== "Identifier" || fn.params[0].name !== "robot") {
    addDiagnostic(diagnostics, source, "JS_ENTRYPOINT", fn.start, fn.end, "error", { reason: "signature" });
  }
  return entry;
}

function safeTopLevelInitializer(node) {
  if (!node) return true;
  if (node.type === "Literal") return true;
  if (node.type === "Identifier") return SAFE_GLOBALS.has(node.name) || ["true", "false", "null"].includes(node.name);
  if (node.type === "ArrayExpression") return node.elements.every((item) => item && safeTopLevelInitializer(item));
  if (node.type === "ObjectExpression") return node.properties.every((property) => property.type === "Property" && property.kind === "init" && !property.method && safeTopLevelInitializer(property.value));
  if (node.type === "UnaryExpression" && ["+", "-", "!", "~"].includes(node.operator)) return safeTopLevelInitializer(node.argument);
  if (node.type === "BinaryExpression" && ["+", "-", "*", "/", "%", "**", "===", "!==", "==", "!=", "<", "<=", ">", ">="].includes(node.operator)) {
    return safeTopLevelInitializer(node.left) && safeTopLevelInitializer(node.right);
  }
  return false;
}

function validateTopLevel(program, diagnostics, source, entry) {
  const allowedDeclaration = entry?.wrapper;
  for (const statement of program.body || []) {
    if (statement === allowedDeclaration || statement.type === "EmptyStatement") continue;
    if (statement.type === "FunctionDeclaration") continue;
    if (statement.type === "VariableDeclaration") {
      if (statement.kind === "var" || statement.declarations.some((declaration) => declaration.id.type !== "Identifier" || !safeTopLevelInitializer(declaration.init))) {
        addDiagnostic(diagnostics, source, "JS_TOP_LEVEL_SIDE_EFFECT", statement.start, statement.end);
      }
      continue;
    }
    if (statement.type === "ExpressionStatement" && statement.directive) continue;
    addDiagnostic(diagnostics, source, "JS_TOP_LEVEL_SIDE_EFFECT", statement.start, statement.end);
  }
}

function apiTypeForInventoryItem(item) {
  return componentTypeById.get(item?.apiTypeId || item?.typeId) || componentTypeByPlaceableId.get(item?.partId || item?.typeId);
}

function componentReference(node, inventoryByName) {
  const path = memberPath(node);
  if (path?.[0] === "robot" && path[1] === "components" && path.length === 3) {
    const item = inventoryByName.get(path[2]);
    return { name: path[2], item, type: apiTypeForInventoryItem(item), nameNode: node.property };
  }
  if (node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.object?.name === "robot" && memberName(node.callee) === "component") {
    const nameArgument = node.arguments?.[0];
    if (nameArgument?.type === "Literal" && typeof nameArgument.value === "string") {
      const item = inventoryByName.get(nameArgument.value);
      return { name: nameArgument.value, item, type: apiTypeForInventoryItem(item), nameNode: nameArgument };
    }
  }
  return null;
}

function registeredMembers(type) {
  return new Set([...(type?.readings || []).map((item) => item.name), ...(type?.commands || []).map((item) => item.name)]);
}

function validateApiMembers(program, diagnostics, source, componentInventory) {
  const inventoryByName = componentByName(componentInventory);
  const contextAvailable = Array.isArray(componentInventory);
  const parents = parentIndex(program);
  const globalNames = new Set(RobotGlobalApi.members.map((item) => item.name.split(".")[0]));
  globalNames.add("components");
  globalNames.add("component");
  globalNames.add("inclinationDeg");
  globalNames.add("compassDeg");
  globalNames.add("speed");
  globalNames.add("componentNames");
  const knownNames = localAndParameterNames(program);
  SAFE_GLOBALS.forEach((name) => knownNames.add(name));
  ["console", "robot"].forEach((name) => knownNames.add(name));

  walk(program, (node) => {
    if (node.type !== "Identifier") return;
    const parentInfo = parents.get(node);
    if (!isIdentifierReference(node, parentInfo?.node, parentInfo?.key)) return;
    if (FORBIDDEN_GLOBALS.has(node.name)) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_GLOBAL", node.start, node.end, "error", { name: node.name });
    else if (!knownNames.has(node.name)) {
      const dateNow = node.name === "Date" && parentInfo?.node?.type === "MemberExpression" && parentInfo.node.object === node && isDirectNativeCall(parentInfo.node, parents.get(parentInfo.node), "Date.now");
      const performanceNow = node.name === "performance" && parentInfo?.node?.type === "MemberExpression" && parentInfo.node.object === node && isDirectNativeCall(parentInfo.node, parents.get(parentInfo.node), "performance.now");
      if (!dateNow && !performanceNow) addDiagnostic(diagnostics, source, "JS_UNKNOWN_GLOBAL", node.start, node.end, "error", { name: node.name });
    }
  });

  walk(program, (node) => {
    if (node.type === "MemberExpression") {
      const property = memberName(node);
      const path = memberPath(node);
      const parent = parents.get(node)?.node;
      if (FORBIDDEN_MEMBER_NAMES.has(property)) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.property.start, node.property.end, "error", { name: property });
      if (["robot", "<robot.component>", ...SAFE_GLOBALS].includes(memberRoot(node)) && node.computed && property === null) addDiagnostic(diagnostics, source, "JS_DYNAMIC_CAPABILITY_LOOKUP", node.property.start, node.property.end);
      if (path?.[0] === "console") {
        if (!node.computed && ["log", "warn", "error", "clear"].includes(property)) return;
        addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.property.start, node.property.end, "error", { name: property || "computed" });
      }
      if (path?.[0] === "Date" || path?.[0] === "performance") {
        const allowedPath = path.join(".");
        const expected = path[0] === "Date" ? "Date.now" : "performance.now";
        const callInfo = parents.get(node);
        if (allowedPath !== expected || !isDirectNativeCall(node, callInfo, expected)) {
          addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.property.start, node.property.end, "error", { name: allowedPath });
        }
      }
      if (path?.[0] === "Math" && path.length > 1 && (!SAFE_MATH_MEMBERS.has(path[1]) || path.length > 2)) {
        addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.property.start, node.property.end, "error", { name: path.slice(1).join(".") });
      }
      if (path?.[0] === "Math" && node.computed && node.property.type !== "Literal") {
        addDiagnostic(diagnostics, source, "JS_DYNAMIC_CAPABILITY_LOOKUP", node.property.start, node.property.end);
      }
      if (path?.join(".") === "Math.random") {
        const parent = parents.get(node)?.node;
        if (parent?.type !== "CallExpression" || parent.callee !== node) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.property.start, node.property.end, "error", { name: "Math.random" });
      }
      if (path?.[0] === "robot") {
        if (FORBIDDEN_MEMBER_NAMES.has(property)) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.property.start, node.property.end, "error", { name: property });
        if (node.object?.type === "Identifier" && node.object.name === "robot" && property && !globalNames.has(property)) {
          addDiagnostic(diagnostics, source, "JS_API_MEMBER_UNKNOWN", node.property.start, node.property.end, "error", { name: property });
        }
        if (path.length >= 3 && path[1] !== "components" && path[1] !== "console" && path[1] !== "debug") {
          addDiagnostic(diagnostics, source, "JS_API_MEMBER_UNKNOWN", node.property.start, node.property.end, "error", { name: path.slice(1).join(".") });
        }
        if (path[1] === "console" && path.length > 3 || path[1] === "debug" && path.length > 3) {
          addDiagnostic(diagnostics, source, "JS_API_MEMBER_UNKNOWN", node.property.start, node.property.end, "error", { name: path.slice(1).join(".") });
        }
        if (node.object?.type === "MemberExpression" && memberPath(node.object)?.join(".") === "robot.console" && property) {
          const exists = RobotGlobalApi.members.some((item) => item.name === `console.${property}`);
          if (!exists) addDiagnostic(diagnostics, source, "JS_API_MEMBER_UNKNOWN", node.property.start, node.property.end, "error", { name: `console.${property}` });
        }
        if (node.object?.type === "MemberExpression" && memberPath(node.object)?.join(".") === "robot.debug" && property) {
          const exists = RobotGlobalApi.members.some((item) => item.name === `debug.${property}`);
          if (!exists) addDiagnostic(diagnostics, source, "JS_API_MEMBER_UNKNOWN", node.property.start, node.property.end, "error", { name: `debug.${property}` });
        }
        if (node.computed && node.property.type !== "Literal") addDiagnostic(diagnostics, source, "JS_DYNAMIC_CAPABILITY_LOOKUP", node.property.start, node.property.end);
      }
      if (path?.join(".") === "robot.components" || path?.[0] === "robot" && path[1] === "components" && path.length === 3) {
        const isDirectReceiver = parent?.type === "MemberExpression" && parent.object === node && memberName(parent) !== null;
        if (!isDirectReceiver) addDiagnostic(diagnostics, source, "JS_DYNAMIC_CAPABILITY_LOOKUP", node.start, node.end);
      }
      const reference = componentReference(node.object, inventoryByName);
      if (reference && property) {
        if (!contextAvailable) return;
        if (!reference.item) {
          addDiagnostic(diagnostics, source, "COMPONENT_MISSING", reference.nameNode?.start ?? node.start, reference.nameNode?.end ?? node.end, "error", { componentName: reference.name });
          return;
        }
        const allowed = registeredMembers(reference.type);
        if (!allowed.has(property)) {
          const matchingType = RobotComponentApi.types.find((candidate) => registeredMembers(candidate).has(property));
          if (matchingType) addDiagnostic(diagnostics, source, "COMPONENT_WRONG_TYPE", node.property.start, node.property.end, "error", { componentName: reference.name, expectedType: matchingType.typeId, member: property });
          else addDiagnostic(diagnostics, source, "JS_API_MEMBER_UNKNOWN", node.property.start, node.property.end, "error", { name: `${reference.type?.typeId || "component"}.${property}` });
        }
      }
      if (path?.[0] === "robot" && path[1] === "components" && path.length === 3) {
        const reference = componentReference(node, inventoryByName);
        const parentInfo = parents.get(node);
        if (contextAvailable && reference && !reference.item && !(parentInfo?.node?.type === "MemberExpression" && parentInfo.node.object === node)) {
          addDiagnostic(diagnostics, source, "COMPONENT_MISSING", reference.nameNode?.start ?? node.start, reference.nameNode?.end ?? node.end, "error", { componentName: reference.name });
        }
      }
      if (node.type === "MemberExpression" && node.object?.type === "CallExpression" && node.object.callee?.type === "MemberExpression" && node.object.callee.object?.name === "robot" && memberName(node.object.callee) === "component") {
        const reference = componentReference(node.object, inventoryByName);
        if (contextAvailable && reference && !reference.item) {
          addDiagnostic(diagnostics, source, "COMPONENT_MISSING", reference.nameNode?.start ?? node.start, reference.nameNode?.end ?? node.end, "error", { componentName: reference.name });
        }
      }
      return;
    }
    if (node.type === "CallExpression" && node.callee?.type === "Identifier" && ["eval", "Function"].includes(node.callee.name)) {
      addDiagnostic(diagnostics, source, "JS_FORBIDDEN_CAPABILITY", node.callee.start, node.callee.end, "error", { name: node.callee.name });
    }
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
      const path = memberPath(node.callee);
      if (path?.join(".") === "Math.random") return;
      if (path?.join(".") === "Date.now" || path?.join(".") === "performance.now") return;
      if (path?.[0] === "Math" && !SAFE_MATH_MEMBERS.has(path[1])) {
        addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.callee.property.start, node.callee.property.end, "error", { name: path.slice(1).join(".") });
      }
    }
    if (node.type === "NewExpression") addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: "new" });
    if (node.type === "UnaryExpression" && node.operator === "delete") addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: "delete" });
  });
}

function inferSimpleJavaScriptType(node, variableTypes, inventoryByName) {
  if (!node) return null;
  if (node.type === "Literal") {
    if (node.value === null) return "null";
    return typeof node.value === "number" ? "number" : typeof node.value === "string" ? "string" : typeof node.value === "boolean" ? "boolean" : null;
  }
  if (node.type === "Identifier") return variableTypes.get(node.name) || null;
  if (node.type === "UnaryExpression") return node.operator === "!" ? "boolean" : ["+", "-", "~"].includes(node.operator) ? "number" : null;
  if (node.type === "BinaryExpression") {
    if (["==", "!=", "===", "!==", "<", "<=", ">", ">=", "in", "instanceof"].includes(node.operator)) return "boolean";
    if (node.operator === "+") {
      const left = inferSimpleJavaScriptType(node.left, variableTypes, inventoryByName);
      const right = inferSimpleJavaScriptType(node.right, variableTypes, inventoryByName);
      if (left === "string" || right === "string") return "string";
      if (left === "number" && right === "number") return "number";
      return null;
    }
    if (["-", "*", "/", "%", "**", "<<", ">>", ">>>", "|", "&", "^"].includes(node.operator)) return "number";
  }
  if (node.type === "ArrayExpression") return "array";
  if (node.type === "ObjectExpression") {
    const properties = new Map(node.properties.filter((item) => item.type === "Property" && !item.computed).map((item) => [item.key.name || item.key.value, item.value]));
    if (["r", "g", "b"].every((key) => properties.has(key) && inferSimpleJavaScriptType(properties.get(key), variableTypes, inventoryByName) === "number")) return "RGB";
    return "object";
  }
  if (node.type === "MemberExpression") {
    const component = componentReference(node.object, inventoryByName);
    const reading = component?.type?.readings?.find((item) => item.name === memberName(node));
    if (["number", "string", "boolean"].includes(reading?.type)) return reading.type;
    const path = memberPath(node);
    if (path?.[0] === "robot") {
      const member = RobotGlobalApi.members.find((item) => item.name === path.slice(1).join("."));
      const propertyType = member?.type || member?.valueType;
      if (["number", "string", "boolean"].includes(propertyType)) return propertyType;
    }
    return null;
  }
  if (node.type === "CallExpression") {
    const path = memberPath(node.callee);
    const fullPath = path?.join(".") || "";
    if (["Number", "robot.toNumber", "robot.random", "robot.clamp", "robot.map", "robot.round", "robot.modulo"].includes(fullPath)) return "number";
    if (["String", "robot.toString"].includes(fullPath)) return "string";
    if (["Boolean", "robot.toBoolean"].includes(fullPath)) return "boolean";
    if (path?.[0] === "Math") return "number";
    if (path?.[0] === "robot") {
      const member = RobotGlobalApi.members.find((item) => item.name === path.slice(1).join("."));
      const resultType = member?.signature?.match(/\):\s*(number|string|boolean)\b/)?.[1];
      if (resultType) return resultType;
    }
  }
  return null;
}

function simpleParameterTypes(signature) {
  if (!signature || signature.includes(" | ")) return null;
  const parameters = signature.match(/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\(([^)]*)\)/)?.[1];
  if (parameters === undefined) return null;
  if (!parameters.trim()) return [];
  return parameters.split(",").map((parameter) => parameter.trim().match(/^(?:\.\.\.)?([A-Za-z_$][\w$]*)\??\s*:\s*(number|string|boolean|unknown)\b/)?.[2] || null);
}

function validateInferredTypes(program, diagnostics, source, componentInventory) {
  const inventoryByName = componentByName(Array.isArray(componentInventory) ? componentInventory : []);
  const variableTypes = new Map();
  const ambiguousNames = new Set();
  walk(program, (node) => {
    if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier" || !node.init) return;
    const inferred = inferSimpleJavaScriptType(node.init, variableTypes, inventoryByName);
    if (!["number", "string", "boolean"].includes(inferred) || ambiguousNames.has(node.id.name)) return;
    if (variableTypes.has(node.id.name) && variableTypes.get(node.id.name) !== inferred) {
      variableTypes.delete(node.id.name);
      ambiguousNames.add(node.id.name);
      return;
    }
    variableTypes.set(node.id.name, inferred);
  });

  const warnMismatch = (name, expected, expression) => {
    const actual = inferSimpleJavaScriptType(expression, variableTypes, inventoryByName);
    if (!["number", "string", "boolean"].includes(expected) || !["number", "string", "boolean"].includes(actual) || actual === expected) return;
    addDiagnostic(diagnostics, source, "JS_TYPE_MISMATCH", expression.start, expression.end, "warning", { name, expected, actual });
  };

  walk(program, (node) => {
    if (node.type === "AssignmentExpression" && node.operator === "=" && node.left.type === "Identifier") {
      const expected = variableTypes.get(node.left.name);
      if (expected) warnMismatch(node.left.name, expected, node.right);
      return;
    }
    if (node.type !== "CallExpression" || node.callee?.type !== "MemberExpression") return;
    const component = componentReference(node.callee.object, inventoryByName);
    const componentCommand = component?.type?.commands?.find((item) => item.name === memberName(node.callee));
    if (componentCommand) {
      (componentCommand.parameters || []).forEach((parameter, index) => warnMismatch(parameter.name || memberName(node.callee), parameter.type, node.arguments[index]));
      return;
    }
    const path = memberPath(node.callee);
    if (path?.[0] !== "robot") return;
    const globalCommand = RobotGlobalApi.members.find((item) => item.name === path.slice(1).join("."));
    const parameterTypes = simpleParameterTypes(globalCommand?.signature);
    if (!parameterTypes) return;
    parameterTypes.forEach((type, index) => warnMismatch(`argument ${index + 1}`, type, node.arguments[index]));
  });
}

function scanReducComponentDiagnostics(source, locale, componentInventory) {
  const diagnostics = [];
  const names = componentByName(Array.isArray(componentInventory) ? componentInventory : []);
  const commands = new Map();
  const legacyCommands = new Map();
  for (const record of ReducCommands.records) {
    const spelling = record.spellings?.[locale];
    if (spelling && record.componentType) commands.set(spelling, record);
    const legacySpelling = record.legacySpellings?.[locale];
    if (legacySpelling && legacySpelling !== spelling) legacyCommands.set(legacySpelling, record);
  }
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "#" || (char === "/" && source[index + 1] === "/")) {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === '"') {
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") index += 2;
        else if (source[index++] === '"') break;
      }
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1;
      const spelling = source.slice(start, index);
      let cursor = index;
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      if (source[cursor] !== "(") continue;
      const legacyCommand = legacyCommands.get(spelling);
      if (legacyCommand) {
        addDiagnostic(diagnostics, source, "REDUC_LEGACY_SOURCE", start, index, "warning", {
          name: spelling,
          replacement: legacyCommand.spellings?.[locale] || ""
        });
        addDiagnostic(diagnostics, source, "REDUC_LEGACY_COMMAND_CASE", start, index, "error", {
          name: spelling,
          replacement: legacyCommand.spellings?.[locale] || ""
        });
        continue;
      }
      const command = commands.get(spelling);
      if (!command) continue;
      cursor += 1;
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      if (source[cursor] !== '"') continue;
      const nameStart = cursor;
      cursor += 1;
      let closed = false;
      while (cursor < source.length) {
        if (source[cursor] === "\\") cursor += 2;
        else if (source[cursor++] === '"') { closed = true; break; }
      }
      if (!closed) continue;
      let name = "";
      try { name = JSON.parse(source.slice(nameStart, cursor)); } catch { continue; }
      const item = names.get(name);
      if (!item) {
        addDiagnostic(diagnostics, source, "COMPONENT_MISSING", nameStart, cursor, "error", { componentName: name });
        continue;
      }
      const component = apiTypeForInventoryItem(item);
      if (component?.typeId !== command.componentType) {
        addDiagnostic(diagnostics, source, "COMPONENT_WRONG_TYPE", nameStart, cursor, "error", { componentName: name, expectedType: command.componentType });
      }
      continue;
    }
    index += 1;
  }
  return diagnostics;
}

function parseJavaScript(source, componentInventory) {
  const diagnostics = [];
  const comments = [];
  if (byteLength(source) > SOURCE_LIMIT) {
    addDiagnostic(diagnostics, source, "JS_SOURCE_TOO_LARGE", 0, source.length);
    return { diagnostics, ast: null, entry: null };
  }
  let program;
  try {
    program = parse(source, {
      ecmaVersion: 2022,
      sourceType: "module",
      allowHashBang: false,
      onComment: comments
    });
  } catch (error) {
    const start = Number.isInteger(error?.pos) ? error.pos : 0;
    const end = Number.isInteger(error?.raisedAt) ? error.raisedAt : Math.min(source.length, start + 1);
    addDiagnostic(diagnostics, source, "JS_SYNTAX", start, end);
    return { diagnostics, ast: null, entry: null };
  }

  let nodeCount = 0;
  walk(program, (node, context, depth) => {
    nodeCount += 1;
    if (nodeCount === NODE_LIMIT + 1) addDiagnostic(diagnostics, source, "JS_AST_TOO_LARGE", node.start, node.end);
    if (depth === DEPTH_LIMIT) addDiagnostic(diagnostics, source, "JS_NESTING_TOO_DEEP", node.start, node.end);
    if (node.type === "Identifier" && [...node.name].length > IDENTIFIER_LIMIT) addDiagnostic(diagnostics, source, "JS_IDENTIFIER_TOO_LONG", node.start, node.end);
    if (node.type === "Literal" && byteLength(source.slice(node.start, node.end)) > COMMENT_LITERAL_LIMIT) addDiagnostic(diagnostics, source, "JS_LITERAL_TOO_LARGE", node.start, node.end);
    if (node.type === "VariableDeclaration" && node.kind === "var") addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: "var" });
    if (["ClassDeclaration", "ClassExpression", "WithStatement", "TaggedTemplateExpression", "TemplateLiteral", "YieldExpression", "MetaProperty", "ImportExpression", "ThisExpression", "Super", "ChainExpression", "SpreadElement", "RestElement", "DebuggerStatement", "LabeledStatement"].includes(node.type)) {
      addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: node.type });
    }
    if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") && node.generator) {
      addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: "generator" });
    }
    if (node.type === "ForOfStatement" && node.await) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: "for-await" });
    if (["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"].includes(node.type) && !context.asyncFunction) {
      addDiagnostic(diagnostics, source, "JS_LOOP_REQUIRES_ASYNC", node.start, node.end);
    }
    if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration" || node.type === "ImportDeclaration") {
      addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MODULE_SYNTAX", node.start, node.end);
    }
    if (node.type === "Property" && (node.kind !== "init" || node.method || node.computed)) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_SYNTAX", node.start, node.end, "error", { syntax: "object-method-or-computed-key" });
    if (node.type === "Property" && FORBIDDEN_MEMBER_NAMES.has(node.key?.name || node.key?.value)) addDiagnostic(diagnostics, source, "JS_FORBIDDEN_MEMBER", node.key.start, node.key.end, "error", { name: node.key.name || node.key.value });
  });

  for (const comment of comments) {
    const start = Number.isInteger(comment.start) ? comment.start : 0;
    const end = Number.isInteger(comment.end) ? comment.end : start;
    if (byteLength(source.slice(start, end)) > COMMENT_LITERAL_LIMIT) addDiagnostic(diagnostics, source, "JS_COMMENT_TOO_LARGE", start, end);
  }
  const entry = entrypointInfo(program, diagnostics, source);
  validateTopLevel(program, diagnostics, source, entry);
  validateApiMembers(program, diagnostics, source, componentInventory);
  validateInferredTypes(program, diagnostics, source, componentInventory);
  return { diagnostics, diagnosticCountTruncated: diagnostics.truncatedCount || 0, ast: program, entry };
}

function lineStarts(source) {
  const result = [0];
  for (let index = 0; index < source.length; index += 1) if (source.charCodeAt(index) === 10) result.push(index + 1);
  return result;
}

function positionAtOffsetWithStarts(source, offset, starts) {
  const target = Math.max(0, Math.min(source.length, offset));
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= target) low = middle;
    else high = middle;
  }
  return { line: low + 1, column: target - starts[low] + 1 };
}

function applyEdits(source, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end || (a.order || 0) - (b.order || 0));
  let cursor = 0;
  let result = "";
  for (const edit of sorted) {
    if (edit.start < cursor) continue;
    result += source.slice(cursor, edit.start);
    result += edit.text;
    cursor = edit.end;
  }
  result += source.slice(cursor);
  return { source: result, edits: sorted };
}

function mapOffset(offset, edits) {
  return offsetMapper(edits)(offset);
}

function offsetMapper(edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end || (a.order || 0) - (b.order || 0));
  const deltasBefore = [];
  let delta = 0;
  sorted.forEach((edit, index) => {
    deltasBefore[index] = delta;
    delta += edit.text.length - (edit.end - edit.start);
  });
  return (offset) => {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sorted[middle].start <= offset) low = middle + 1;
      else high = middle;
    }
    const index = low - 1;
    if (index < 0) return offset;
    const edit = sorted[index];
    if (offset <= edit.end && edit.end > edit.start) return edit.start + deltasBefore[index];
    const deltaAfter = deltasBefore[index] + edit.text.length - (edit.end - edit.start);
    return offset + deltaAfter;
  };
}

function mapSegments(source, transformed, edits) {
  const starts = lineStarts(source);
  const transformedStarts = lineStarts(transformed);
  const mapOffsetToTransformed = offsetMapper(edits);
  const cutsByLine = new Map();
  const addCut = (offset) => {
    const lineIndex = positionAtOffsetWithStarts(source, offset, starts).line - 1;
    const cuts = cutsByLine.get(lineIndex) || new Set();
    cuts.add(offset);
    cutsByLine.set(lineIndex, cuts);
  };
  edits.forEach((edit) => { addCut(edit.start); addCut(edit.end); });
  const segments = [];
  for (let lineIndex = 0; lineIndex < starts.length; lineIndex += 1) {
    const lineStart = starts[lineIndex];
    const lineEnd = lineIndex + 1 < starts.length ? starts[lineIndex + 1] - 1 : source.length;
    const cuts = new Set([lineStart, lineEnd, ...(cutsByLine.get(lineIndex) || [])]);
    const sortedCuts = [...cuts].sort((a, b) => a - b);
    for (let index = 0; index + 1 < sortedCuts.length; index += 1) {
      const authoredStart = sortedCuts[index];
      const authoredEnd = sortedCuts[index + 1];
      if (authoredEnd <= authoredStart) continue;
      const start = positionAtOffsetWithStarts(source, authoredStart, starts);
      const end = positionAtOffsetWithStarts(source, authoredEnd, starts);
      const generated = positionAtOffsetWithStarts(transformed, mapOffsetToTransformed(authoredStart), transformedStarts);
      segments.push({ generated, authored: { ...start, endLine: end.line, endColumn: end.column } });
    }
  }
  if (!segments.length) segments.push({ generated: { line: 1, column: 1 }, authored: { line: 1, column: 1, endLine: 1, endColumn: 1 } });
  return segments;
}

function apiTransforms(source, ast) {
  const edits = [];
  walk(ast, (node) => {
    if (node.type === "CallExpression" && node.callee?.type === "MemberExpression") {
      const path = memberPath(node.callee)?.join(".");
      if (path === "Math.random") edits.push({ start: node.start, end: node.end, text: "robot.random()", order: 10 });
      if (path === "Date.now") edits.push({ start: node.start, end: node.end, text: "robot.__sbotics.clock.dateNow()", order: 10 });
      if (path === "performance.now") edits.push({ start: node.start, end: node.end, text: "robot.__sbotics.clock.performanceNow()", order: 10 });
    }
    if (node.type === "MemberExpression" && node.object?.type === "Identifier" && node.object.name === "console") {
      const member = memberName(node);
      if (["log", "warn", "error", "clear"].includes(member)) edits.push({ start: node.start, end: node.end, text: `robot.console.${member}`, order: 11 });
    }
  });
  return edits;
}

function loopTransforms(ast, source, exportEdit, yieldStatement = "await robot.wait(0);") {
  const edits = [];
  walk(ast, (node, context) => {
    if (!["ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement"].includes(node.type)) return;
    if (!context.asyncFunction || !node.body) return;
    const shift = exportEdit && node.start >= exportEdit.start ? exportEdit.text.length : 0;
    const bodyStart = node.body.start + shift;
    const bodyEnd = node.body.end + shift;
    if (node.body.type === "BlockStatement") edits.push({ start: bodyStart + 1, end: bodyStart + 1, text: yieldStatement, order: 20 });
    else {
      edits.push({ start: bodyStart, end: bodyStart, text: `{ ${yieldStatement} `, order: 20 });
      edits.push({ start: bodyEnd, end: bodyEnd, text: " }", order: 21 });
    }
  });
  return edits;
}

function composeMap(source, firstEdits, secondEdits) {
  const first = applyEdits(source, firstEdits);
  const second = applyEdits(first.source, secondEdits);
  const base = mapSegments(source, first.source, firstEdits);
  const starts = lineStarts(source);
  const firstMapper = offsetMapper(firstEdits);
  const secondMapper = offsetMapper(secondEdits);
  const secondStarts = lineStarts(second.source);
  return base.map((segment) => {
    const authoredStart = (starts[Math.max(0, segment.authored.line - 1)] || 0) + Math.max(0, segment.authored.column - 1);
    const generatedOffset = firstMapper(authoredStart);
    const instrumentedOffset = secondMapper(generatedOffset);
    return { generated: positionAtOffsetWithStarts(second.source, instrumentedOffset, secondStarts), authored: segment.authored };
  });
}

function collectInstrumentationEdits(source, ast, exportEdit, yieldStatement) {
  const transformed = apiTransforms(source, ast);
  const prefixEdits = exportEdit ? [exportEdit] : [];
  const generated = applyEdits(source, prefixEdits);
  const shiftPosition = (offset) => mapOffset(offset, prefixEdits);
  const adjusted = transformed.map((edit) => ({ ...edit, start: shiftPosition(edit.start), end: shiftPosition(edit.end) }));
  const loops = loopTransforms(ast, source, exportEdit, yieldStatement);
  return [...adjusted, ...loops];
}

function exportInsertion(source, entry) {
  if (!entry || entry.exported) return null;
  return { start: entry.node.start, end: entry.node.start, text: "export ", order: 0 };
}

function cryptoRandomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function validateProgramSource({ source = "", language = "javascript", locale = "pt-BR", componentInventory = null } = {}) {
  const text = String(source ?? "");
  if (language === "reduc") {
    const diagnostics = scanReducComponentDiagnostics(text, locale === "en-US" ? "en-US" : "pt-BR", componentInventory);
    return { diagnostics, diagnosticCountTruncated: diagnostics.truncatedCount || 0 };
  }
  const result = parseJavaScript(text, componentInventory);
  return { diagnostics: result.diagnostics, diagnosticCountTruncated: result.diagnosticCountTruncated || 0 };
}

export async function buildJavaScriptArtifact({ source = "", programId = "", authoredRevision = 0, componentInventory = null } = {}) {
  const text = String(source ?? "");
  const parsed = parseJavaScript(text, componentInventory);
  if (!parsed.ast || parsed.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics: parsed.diagnostics, diagnosticCountTruncated: parsed.diagnosticCountTruncated || 0 };
  }

  const exportEdit = exportInsertion(text, parsed.entry);
  const generated = applyEdits(text, exportEdit ? [exportEdit] : []);
  const instrumentationEdits = collectInstrumentationEdits(text, parsed.ast, exportEdit);
  const instrumented = applyEdits(generated.source, instrumentationEdits);
  if (byteLength(instrumented.source) > GENERATED_LIMIT) {
    const diagnostics = [];
    addDiagnostic(diagnostics, text, "JS_GENERATED_TOO_LARGE", 0, text.length);
    return { ok: false, diagnostics, diagnosticCountTruncated: 0 };
  }

  const authoredToGeneratedMap = mapSegments(text, generated.source, exportEdit ? [exportEdit] : []);
  const generatedToInstrumentedMap = mapSegments(generated.source, instrumented.source, instrumentationEdits);
  const composedMap = composeMap(text, exportEdit ? [exportEdit] : [], instrumentationEdits);
  const authoredSha256 = await sha256(text);
  const generatedModuleSha256 = await sha256(instrumented.source);
  const composedMapSha256 = await sha256(JSON.stringify(composedMap));
  const artifact = {
    buildId: cryptoRandomId(),
    programId: String(programId),
    authoredRevision: Number(authoredRevision) || 1,
    authoredSha256,
    language: "javascript",
    languageVersion: "javascript-v1",
    compilerVersion: COMPILER_VERSION,
    instrumentationVersion: INSTRUMENTATION_VERSION,
    generatedModuleUtf8: instrumented.source,
    generatedModuleSha256,
    sandboxProfileVersion: PROGRAM_SANDBOX_PROFILE_V1.id,
    authoredToGeneratedMap,
    generatedToInstrumentedMap,
    composedMapSha256,
    sandboxProtocolVersion: SANDBOX_PROTOCOL_VERSION,
    createdAt: new Date().toISOString()
  };
  return { ok: true, diagnostics: parsed.diagnostics, diagnosticCountTruncated: 0, artifact };
}

export async function buildGeneratedJavaScriptArtifact({
  generatedSource = "",
  authoredSource = "",
  sourceMap = [],
  programId = "",
  authoredRevision = 0,
  language = "reduc"
} = {}) {
  const source = String(generatedSource || "");
  const authored = String(authoredSource || "");
  if (byteLength(authored) > SOURCE_LIMIT || byteLength(source) > GENERATED_LIMIT) {
    return { ok: false, diagnostics: [{ code: "JS_GENERATED_TOO_LARGE", severity: "error", start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }], diagnosticCountTruncated: 0 };
  }
  const entryPattern = /^export async function main\(__reduc, __debug = \{ pause: async \(\) => \{\} \}\) \{/gm;
  const entries = [...source.matchAll(entryPattern)];
  if (entries.length !== 1) {
    return { ok: false, diagnostics: [{ code: "JS_ENTRYPOINT", severity: "error", start: { line: 1, column: 1 }, end: { line: 1, column: 2 } }], diagnosticCountTruncated: 0 };
  }
  const reducerBindings = ReducCommands.records.map((record) => {
    const member = String(record.javascriptLowering || "").split(".").at(-1);
    return `${member}: (...args) => robot.__sbotics.reduc(${JSON.stringify(record.commandId)}, args)`;
  }).join(",\n    ");
  const renamed = source.replace(entryPattern, "async function __generatedProgram(__reduc, __debug) {");
  const wrapped = `${renamed}\nexport async function main(robot) {\n  const __reduc = Object.freeze({\n    ${reducerBindings}\n  });\n  const __debug = Object.freeze({ pause: () => robot.debug.pause(), yield: () => robot.wait(0) });\n  return __generatedProgram(__reduc, __debug);\n}\n`;
  let ast;
  try {
    ast = parse(wrapped, { ecmaVersion: 2022, sourceType: "module", allowHashBang: false });
  } catch (error) {
    const start = Number.isInteger(error?.pos) ? error.pos : 0;
    return { ok: false, diagnostics: [{ code: "JS_SYNTAX", severity: "error", start: positionAtOffsetWithStarts(wrapped, start, lineStarts(wrapped)), end: positionAtOffsetWithStarts(wrapped, Math.min(wrapped.length, start + 1), lineStarts(wrapped)) }], diagnosticCountTruncated: 0 };
  }
  let nodeCount = 0;
  let tooLarge = false;
  let tooDeep = false;
  walk(ast, (_node, _context, depth) => {
    nodeCount += 1;
    if (nodeCount > NODE_LIMIT) tooLarge = true;
    if (depth > DEPTH_LIMIT) tooDeep = true;
  });
  if (tooLarge || tooDeep) {
    const code = tooLarge ? "JS_AST_TOO_LARGE" : "JS_NESTING_TOO_DEEP";
    return { ok: false, diagnostics: [{ code, severity: "error", start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }], diagnosticCountTruncated: 0 };
  }
  const instrumentationEdits = collectInstrumentationEdits(wrapped, ast, null, "await __debug.yield();");
  const instrumented = applyEdits(wrapped, instrumentationEdits);
  if (byteLength(instrumented.source) > GENERATED_LIMIT) {
    return { ok: false, diagnostics: [{ code: "JS_GENERATED_TOO_LARGE", severity: "error", start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }], diagnosticCountTruncated: 0 };
  }
  const authoredSha256 = await sha256(authored);
  const generatedModuleSha256 = await sha256(instrumented.source);
  const composedMapSha256 = await sha256(JSON.stringify(sourceMap || []));
  return {
    ok: true,
    diagnostics: [],
    diagnosticCountTruncated: 0,
    artifact: {
      buildId: cryptoRandomId(),
      programId: String(programId),
      authoredRevision: Number(authoredRevision) || 1,
      authoredSha256,
      language,
      languageVersion: `${language}-v1`,
      compilerVersion: COMPILER_VERSION,
      instrumentationVersion: INSTRUMENTATION_VERSION,
      generatedModuleUtf8: instrumented.source,
      generatedModuleSha256,
      sandboxProfileVersion: PROGRAM_SANDBOX_PROFILE_V1.id,
      authoredToGeneratedMap: sourceMap || [],
      generatedToInstrumentedMap: mapSegments(wrapped, instrumented.source, instrumentationEdits),
      composedMapSha256,
      sandboxProtocolVersion: SANDBOX_PROTOCOL_VERSION,
      createdAt: new Date().toISOString()
    }
  };
}

export const PROGRAM_PROFILE_LIMITS = Object.freeze({
  sourceBytes: SOURCE_LIMIT,
  generatedBytes: GENERATED_LIMIT,
  astNodes: NODE_LIMIT,
  nesting: DEPTH_LIMIT,
  identifierCodePoints: IDENTIFIER_LIMIT,
  commentOrLiteralBytes: COMMENT_LITERAL_LIMIT,
  diagnostics: DIAGNOSTIC_LIMIT
});
