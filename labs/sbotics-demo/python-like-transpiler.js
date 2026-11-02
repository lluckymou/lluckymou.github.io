import { PythonLikeGrammar, ReducCommands, ReducGrammar, RobotComponentApi } from "./programming-api-registry.generated.js?imp-ux-03-blockly-drawer-controls-20261101-1";

const SOURCE_LIMIT = PythonLikeGrammar.limits.sourceBytes;
const DIAGNOSTIC_LIMIT = PythonLikeGrammar.limits.diagnostics;
const DEPTH_LIMIT = PythonLikeGrammar.limits.maximumNesting;
const CONVERSION_HELPERS = new Set(["reduc.virar_booleano", "reduc.virar_numero", "reduc.virar_texto"]);
const commands = ReducCommands.records.filter((record) => !CONVERSION_HELPERS.has(record.commandId) && record.commandId !== "reduc.interromper");
const commandBySpelling = new Map(commands.map((record) => [record.pythonLikeSpellings?.["en-US"], record]).filter(([name]) => name));
const reservedIdentifiers = new Set([
  ...Object.values(ReducGrammar.locales["en-US"].keywords),
  ...Object.values(ReducGrammar.locales["en-US"].types),
  ...Object.values(ReducGrammar.locales["en-US"].literals),
  ...ReducCommands.records.map((record) => record.spellings?.["en-US"]),
  ...commands.map((record) => record.pythonLikeSpellings?.["en-US"]),
  "if", "elif", "else", "while", "for", "in", "range", "def", "break", "continue", "pass", "and", "or", "not",
  "robot", "components", "componentNames", "console", "debug"
].filter(Boolean));
const componentTypeById = new Map(RobotComponentApi.types.map((type) => [type.typeId, type]));
const componentTypeByPlaceableId = new Map();
for (const type of RobotComponentApi.types) for (const partId of type.placeableTypeIds || []) componentTypeByPlaceableId.set(partId, type);

function utf8Size(value) {
  return new TextEncoder().encode(value).byteLength;
}

function createDiagnostics(source) {
  const diagnostics = [];
  diagnostics.source = source;
  diagnostics.add = (code, line, column, endColumn = column + 1, params = {}) => {
    if (diagnostics.length >= DIAGNOSTIC_LIMIT) {
      diagnostics.truncatedCount = (diagnostics.truncatedCount || 0) + 1;
      return;
    }
    diagnostics.push({
      code,
      severity: code === "PYTHONLIKE_TYPE" || code === "PYTHONLIKE_VARIABLE_TYPE" ? "warning" : "error",
      start: { line: Math.max(1, line), column: Math.max(1, column) },
      end: { line: Math.max(1, line), column: Math.max(column + 1, endColumn) },
      params
    });
  };
  return diagnostics;
}

function cleanLineText(text) {
  let quote = "";
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (quote) { if (character === quote) quote = ""; continue; }
    if (character === "\"" || character === "'") { quote = character; continue; }
    if (character === "#") return text.slice(0, index);
  }
  return text;
}

function sourceLines(source, diagnostics, tabSize) {
  let offset = 0;
  const result = String(source).split(/\r\n|\n|\r/).map((raw, index) => {
    let indentation = 0;
    let prefixLength = 0;
    while (raw[prefixLength] === " " || raw[prefixLength] === "\t") {
      if (raw[prefixLength] === "\t") {
        diagnostics.add("PYTHONLIKE_INDENT", index + 1, prefixLength + 1, prefixLength + 2, { reason: "tab", tabSize });
        indentation += tabSize;
      } else indentation += 1;
      prefixLength += 1;
    }
    const content = cleanLineText(raw.slice(prefixLength));
    const trimmed = content.trimEnd();
    const line = { number: index + 1, offset, raw, indentation, column: prefixLength + 1, text: trimmed };
    offset += raw.length + 1;
    return line;
  });
  return result;
}

function decodeString(raw, line, column, diagnostics) {
  const body = raw.slice(1, -1);
  let value = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character !== "\\") { value += character; continue; }
    const escaped = body[++index];
    const replacements = { "\\": "\\", "'": "'", '"': '"', n: "\n", r: "\r", t: "\t" };
    if (!(escaped in replacements)) {
      diagnostics.add("PYTHONLIKE_SYNTAX", line, column + index, column + index + 1, { reason: "escape" });
      value += escaped || "";
    } else value += replacements[escaped];
  }
  return value;
}

function tokenizeExpression(text, line, baseColumn, diagnostics) {
  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (/\s/.test(character)) { index += 1; continue; }
    const start = index;
    if (character === "'" || character === '"') {
      const quote = character;
      index += 1;
      let escaped = false;
      while (index < text.length) {
        const current = text[index++];
        if (escaped) { escaped = false; continue; }
        if (current === "\\") { escaped = true; continue; }
        if (current === quote) break;
      }
      if (text[index - 1] !== quote) {
        diagnostics.add("PYTHONLIKE_SYNTAX", line, baseColumn + start, baseColumn + text.length, { reason: "string" });
        break;
      }
      const raw = text.slice(start, index);
      tokens.push({ kind: "string", value: decodeString(raw, line, baseColumn + start, diagnostics), raw, start, end: index });
      continue;
    }
    const number = text.slice(index).match(/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
    if (number) {
      index += number[0].length;
      const value = Number(number[0]);
      if (!Number.isFinite(value)) diagnostics.add("PYTHONLIKE_SYNTAX", line, baseColumn + start, baseColumn + index, { reason: "non-finite-number" });
      tokens.push({ kind: "number", value, raw: number[0], start, end: index });
      continue;
    }
    const identifier = text.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifier) {
      index += identifier[0].length;
      tokens.push({ kind: "identifier", value: identifier[0], raw: identifier[0], start, end: index });
      continue;
    }
    const operator = ["<=", ">=", "==", "!="].find((candidate) => text.startsWith(candidate, index));
    if (operator) {
      index += operator.length;
      tokens.push({ kind: "operator", value: operator, raw: operator, start, end: index });
      continue;
    }
    if ("()+-*/%<>,".includes(character)) {
      index += 1;
      tokens.push({ kind: "operator", value: character, raw: character, start, end: index });
      continue;
    }
    diagnostics.add("PYTHONLIKE_UNSUPPORTED", line, baseColumn + index, baseColumn + index + 1, { syntax: character });
    index += 1;
  }
  let nesting = 0;
  let maximumNesting = 0;
  for (const token of tokens) {
    if (token.value === "(") { nesting += 1; maximumNesting = Math.max(maximumNesting, nesting); }
    else if (token.value === ")") nesting = Math.max(0, nesting - 1);
  }
  if (maximumNesting > DEPTH_LIMIT) {
    diagnostics.add("PYTHONLIKE_NESTING", line, baseColumn, baseColumn + text.length);
    return [{ kind: "invalid", value: "", raw: "", start: 0, end: text.length }, { kind: "eof", value: "", raw: "", start: text.length, end: text.length }];
  }
  tokens.push({ kind: "eof", value: "", raw: "", start: index, end: index });
  return tokens;
}

const PRECEDENCE = Object.freeze({ or: 1, and: 2, "==": 3, "!=": 3, "<": 3, "<=": 3, ">": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 });

function parseExpression(text, line, baseColumn, diagnostics) {
  const tokens = tokenizeExpression(text, line, baseColumn, diagnostics);
  let cursor = 0;
  const peek = () => tokens[cursor] || tokens.at(-1);
  const take = () => tokens[cursor++] || tokens.at(-1);
  const fail = (token = peek()) => diagnostics.add("PYTHONLIKE_SYNTAX", line, baseColumn + token.start, baseColumn + Math.max(token.end, token.start + 1), { reason: "expression" });
  const parsePrimary = () => {
    const token = take();
    if (token.kind === "number") return { kind: "literal", value: token.value, valueType: "number", raw: token.raw, token };
    if (token.kind === "string") return { kind: "literal", value: token.value, valueType: "text", raw: token.raw, token };
    if (token.kind === "identifier" && token.value === "True") return { kind: "literal", value: true, valueType: "boolean", raw: "True", token };
    if (token.kind === "identifier" && token.value === "False") return { kind: "literal", value: false, valueType: "boolean", raw: "False", token };
    if (token.value === "(") {
      const expression = parseBinary(1);
      if (peek().value !== ")") fail(); else take();
      return { ...expression, parenthesized: true };
    }
    if (token.kind === "identifier") {
      if (peek().value !== "(") return { kind: "identifier", name: token.value, token };
      take();
      const args = [];
      if (peek().value !== ")") {
        while (true) {
          args.push(parseBinary(1));
          if (peek().value === ",") { take(); if (peek().value === ")") break; continue; }
          break;
        }
      }
      if (peek().value !== ")") fail(); else take();
      return { kind: "call", name: token.value, args, token };
    }
    fail(token);
    return { kind: "invalid", token };
  };
  const parseUnary = () => {
    const token = peek();
    if (token.value === "not") {
      take();
      return { kind: "unary", operator: token.value, argument: parseBinary(3), token };
    }
    if (token.value === "+" || token.value === "-") {
      take();
      return { kind: "unary", operator: token.value, argument: parseUnary(), token };
    }
    return parsePrimary();
  };
  const parseBinary = (minimum) => {
    let left = parseUnary();
    while (true) {
      const token = peek();
      const precedence = PRECEDENCE[token.value];
      if (!precedence || precedence < minimum) break;
      take();
      const right = parseBinary(precedence + 1);
      if (precedence === 3 && left.kind === "binary" && left.precedence === 3) {
        diagnostics.add("PYTHONLIKE_UNSUPPORTED", line, baseColumn + token.start, baseColumn + token.end, { syntax: "chained comparison" });
      }
      left = { kind: "binary", operator: token.value, left, right, token, precedence };
    }
    return left;
  };
  const expression = parseBinary(1);
  if (peek().kind !== "eof") fail(peek());
  const stamp = (node) => {
    if (!node) return;
    if (node.token) { node.token.line = line; node.token.column = baseColumn + node.token.start; }
    if (node.kind === "call") node.args.forEach(stamp);
    else if (node.kind === "unary") stamp(node.argument);
    else if (node.kind === "binary") { stamp(node.left); stamp(node.right); }
  };
  stamp(expression);
  return expression;
}

function expressionColumn(text, line) {
  const offset = line.text.indexOf(text);
  return line.column + Math.max(0, offset);
}

function literalDefaultType(expression) {
  if (expression?.kind === "literal") return expression.valueType;
  if (expression?.kind === "unary" && ["+", "-"].includes(expression.operator) && expression.argument?.kind === "literal" && expression.argument.valueType === "number") return "number";
  return null;
}

class PythonLikeParser {
  constructor(source, diagnostics, tabSize) {
    this.source = source;
    this.diagnostics = diagnostics;
    this.tabSize = tabSize;
    this.lines = sourceLines(source, diagnostics, tabSize);
    this.cursor = 0;
    this.nodes = 0;
    this.suiteDepth = 0;
  }

  nextMeaningful(from = this.cursor) {
    let index = from;
    while (index < this.lines.length && !this.lines[index].text.trim()) index += 1;
    return index;
  }

  addNode(node, line) {
    this.nodes += 1;
    if (this.nodes > 100000) this.diagnostics.add("PYTHONLIKE_SOURCE_TOO_LARGE", line.number, line.column, line.column + 1, { reason: "node-limit" });
    return { ...node, line: line.number, column: line.column, endColumn: line.column + Math.max(1, line.text.length), depth: 0 };
  }

  parse() {
    const functions = [];
    const moduleBody = [];
    let main = null;
    this.cursor = this.nextMeaningful();
    while (this.cursor < this.lines.length) {
      const line = this.lines[this.cursor];
      const text = line.text.trim();
      if (line.indentation !== 0) {
        this.diagnostics.add("PYTHONLIKE_INDENT", line.number, 1, line.column, { reason: "unexpected-indent" });
        this.cursor += 1;
        continue;
      }
      this.cursor += 1;
      if (text.startsWith("def ")) {
        const callable = this.parseFunctionDefinition(line, text);
        if (!callable) continue;
        if (callable.name === "main") {
          if (main) this.diagnostics.add("PYTHONLIKE_DUPLICATE_FUNCTION", line.number, line.column, line.column + text.length, { name: "main" });
          else main = callable;
        } else functions.push(callable);
      } else moduleBody.push(this.parseStatement(line, text));
      this.cursor = this.nextMeaningful();
    }
    if (main && moduleBody.length) {
      const line = this.lines.find((candidate) => moduleBody.some((node) => node.line === candidate.number));
      this.diagnostics.add("PYTHONLIKE_UNSUPPORTED", line?.number || 1, line?.column || 1, line?.column + (line?.text.length || 1), { syntax: "module statements beside def main()" });
    }
    return { body: main?.body || moduleBody, functions, wrapped: Boolean(main), main };
  }

  parseFunctionDefinition(line, text) {
    const header = text.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\((.*)\)\s*(?:->\s*([A-Za-z_][A-Za-z0-9_]*))?:$/);
    if (!header) {
      this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + text.length, { reason: "function-definition" });
      return null;
    }
    const name = header[1];
    const returnType = this.annotationType(header[3], line);
    const parameters = [];
    const rawParameters = header[2].trim() ? this.splitRangeArguments(header[2], line) : [];
    let sawDefault = false;
    for (const rawParameter of rawParameters) {
      const match = rawParameter.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:\s*:\s*([A-Za-z_][A-Za-z0-9_]*))?(?:\s*=\s*(.+))?$/);
      if (!match) {
        this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + text.length, { reason: "function-parameter" });
        continue;
      }
      const parameter = { name: match[1], typeHint: this.annotationType(match[2], line), defaultExpression: null, line: line.number, column: line.column };
      if (match[3]) {
        sawDefault = true;
        parameter.defaultExpression = parseExpression(match[3], line.number, expressionColumn(match[3], line), this.diagnostics);
        if (!literalDefaultType(parameter.defaultExpression)) this.diagnostics.add("PYTHONLIKE_UNSUPPORTED", line.number, line.column, line.column + text.length, { syntax: "non-literal parameter default" });
      } else if (sawDefault) this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + text.length, { reason: "required parameter after default" });
      parameters.push(parameter);
    }
    const node = this.addNode({ kind: "function", name, parameters, returnTypeHint: returnType, body: [] }, line);
    if (reservedIdentifiers.has(name)) this.diagnostics.add("PYTHONLIKE_RESERVED_NAME", line.number, line.column, line.column + text.length, { name });
    if (name === "main" && (parameters.length || returnType)) this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + text.length, { reason: "main-signature" });
    for (const parameter of parameters) {
      if (reservedIdentifiers.has(parameter.name)) this.diagnostics.add("PYTHONLIKE_RESERVED_NAME", line.number, line.column, line.column + text.length, { name: parameter.name });
      const defaultType = literalDefaultType(parameter.defaultExpression);
      if (defaultType && parameter.typeHint && parameter.typeHint !== defaultType) {
        this.diagnostics.add("PYTHONLIKE_TYPE", line.number, line.column, line.column + text.length, { name: parameter.name, expected: parameter.typeHint, actual: defaultType });
      }
    }
    node.body = this.parseSuite(line, 0);
    return node;
  }

  annotationType(value, line) {
    if (!value) return null;
    const types = { int: "number", float: "number", number: "number", str: "text", string: "text", text: "text", bool: "boolean", boolean: "boolean" };
    if (types[value]) return types[value];
    this.diagnostics.add("PYTHONLIKE_UNSUPPORTED", line.number, line.column, line.column + line.text.length, { syntax: `type annotation ${value}` });
    return null;
  }

  parseSuite(parentLine, parentIndent) {
    const nextIndex = this.nextMeaningful();
    if (nextIndex >= this.lines.length) {
      this.diagnostics.add("PYTHONLIKE_INDENT", parentLine.number, parentLine.column, parentLine.column + parentLine.text.trim().length, { reason: "empty-suite" });
      return [];
    }
    const next = this.lines[nextIndex];
    if (this.suiteDepth >= DEPTH_LIMIT) {
      this.diagnostics.add("PYTHONLIKE_NESTING", parentLine.number, parentLine.column, parentLine.column + parentLine.text.trim().length);
      this.cursor = nextIndex;
      while (this.cursor < this.lines.length && this.lines[this.cursor].indentation > parentIndent) this.cursor += 1;
      return [];
    }
    if (next.indentation !== parentIndent + this.tabSize) {
      this.diagnostics.add("PYTHONLIKE_INDENT", next.number, 1, next.column, { reason: "expected-spaces", tabSize: this.tabSize });
      if (next.indentation <= parentIndent) return [];
    }
    this.suiteDepth += 1;
    const body = this.parseBlock(parentIndent + this.tabSize, []);
    this.suiteDepth -= 1;
    return body;
  }

  parseBlock(expectedIndent, stops) {
    const body = [];
    while (true) {
      this.cursor = this.nextMeaningful();
      if (this.cursor >= this.lines.length) break;
      const line = this.lines[this.cursor];
      const text = line.text.trim();
      if (line.indentation < expectedIndent) break;
      if (line.indentation > expectedIndent) {
        this.diagnostics.add("PYTHONLIKE_INDENT", line.number, 1, line.column, { reason: "unexpected-indent" });
        this.cursor += 1;
        continue;
      }
      if (stops.some((word) => text === `${word}:` || text.startsWith(`${word} `))) break;
      this.cursor += 1;
      body.push(this.parseStatement(line, text));
      if (body.length > 100000) break;
    }
    return body;
  }

  parseStatement(line, text) {
    if (/^(import|from|class|async|await|lambda|try|except|finally|with|yield|global|nonlocal|del|assert|raise)\b/.test(text)) {
      this.diagnostics.add("PYTHONLIKE_UNSUPPORTED", line.number, line.column, line.column + text.length, { syntax: text.split(/\s|\(/)[0] });
      return this.addNode({ kind: "pass" }, line);
    }
    if (/^def\b/.test(text)) {
      this.diagnostics.add("PYTHONLIKE_UNSUPPORTED", line.number, line.column, line.column + text.length, { syntax: "custom function" });
      return this.addNode({ kind: "pass" }, line);
    }
    if (text === "return") return this.addNode({ kind: "return", expression: null }, line);
    if (text.startsWith("return ")) {
      const raw = text.slice(7).trim();
      return this.addNode({ kind: "return", expression: parseExpression(raw, line.number, expressionColumn(raw, line), this.diagnostics) }, line);
    }
    if (text === "break") return this.addNode({ kind: "break" }, line);
    if (text === "continue") return this.addNode({ kind: "continue" }, line);
    if (text === "pass") return this.addNode({ kind: "pass" }, line);
    if (text.startsWith("if ") && text.endsWith(":")) return this.parseIf(line, text);
    if (text.startsWith("while ") && text.endsWith(":")) {
      const rawCondition = text.slice(6, -1).trim();
      const node = this.addNode({ kind: "while", condition: parseExpression(rawCondition, line.number, expressionColumn(rawCondition, line), this.diagnostics), body: [] }, line);
      node.body = this.parseSuite(line, line.indentation);
      return node;
    }
    const loop = text.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+range\((.*)\):$/);
    if (loop) {
      const args = this.splitRangeArguments(loop[2], line);
      const expressions = args.map((raw) => parseExpression(raw, line.number, expressionColumn(raw, line), this.diagnostics));
      const node = this.addNode({ kind: "for-range", variable: loop[1], args: expressions, body: [] }, line);
      node.body = this.parseSuite(line, line.indentation);
      return node;
    }
    if (/\b(range|\(|\[|\{|\bclass\b|\bdef\b)/.test(text) && !/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(text) && text.startsWith("for ")) {
      this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + text.length, { reason: "for-range" });
      return this.addNode({ kind: "pass" }, line);
    }
    const assignment = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)(.+)$/);
    if (assignment) {
      const raw = assignment[2].trim();
      return this.addNode({ kind: "assign", name: assignment[1], expression: parseExpression(raw, line.number, expressionColumn(raw, line), this.diagnostics) }, line);
    }
    const expression = parseExpression(text, line.number, line.column, this.diagnostics);
    if (expression.kind !== "call") this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + text.length, { reason: "statement" });
    return this.addNode({ kind: "call-statement", expression }, line);
  }

  splitRangeArguments(text, line) {
    const parts = [];
    let quote = "";
    let escaped = false;
    let depth = 0;
    let start = 0;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (escaped) { escaped = false; continue; }
      if (character === "\\") { escaped = true; continue; }
      if (quote) { if (character === quote) quote = ""; continue; }
      if (character === "'" || character === '"') { quote = character; continue; }
      if (character === "(") depth += 1;
      if (character === ")") depth -= 1;
      if (character === "," && depth === 0) { parts.push(text.slice(start, index).trim()); start = index + 1; }
    }
    parts.push(text.slice(start).trim());
    if (parts.some((part) => !part) || parts.length < 1 || parts.length > 3) {
      this.diagnostics.add("PYTHONLIKE_SYNTAX", line.number, line.column, line.column + line.text.length, { reason: "range-arity" });
      return parts.filter(Boolean).slice(0, 3);
    }
    return parts;
  }

  parseIf(line, text) {
    const branches = [];
    const firstCondition = text.slice(3, -1).trim();
    branches.push({ condition: parseExpression(firstCondition, line.number, expressionColumn(firstCondition, line), this.diagnostics), body: this.parseSuite(line, line.indentation), line: line.number, column: line.column, endColumn: line.column + line.text.length });
    let otherwise = [];
    let otherwiseLine = null;
    while (true) {
      const nextIndex = this.nextMeaningful();
      if (nextIndex >= this.lines.length) break;
      const next = this.lines[nextIndex];
      const nextText = next.text.trim();
      if (next.indentation !== line.indentation || !((nextText.startsWith("elif ") && nextText.endsWith(":")) || nextText === "else:")) break;
      this.cursor = nextIndex + 1;
      if (nextText === "else:") {
        otherwiseLine = { line: next.number, column: next.column, endColumn: next.column + next.text.length };
        otherwise = this.parseSuite(next, next.indentation);
        break;
      }
      const rawCondition = nextText.slice(5, -1).trim();
      branches.push({ condition: parseExpression(rawCondition, next.number, expressionColumn(rawCondition, next), this.diagnostics), body: this.parseSuite(next, next.indentation), line: next.number, column: next.column, endColumn: next.column + next.text.length });
    }
    return this.addNode({ kind: "if", branches, otherwise, otherwiseLine }, line);
  }
}

function apiTypeForInventoryItem(item) {
  return componentTypeById.get(item?.apiTypeId || item?.typeId) || componentTypeByPlaceableId.get(item?.partId || item?.typeId) || null;
}

function inferExpressionType(expression, variableTypes, diagnostics, options = {}) {
  if (expression?.token?.line) options = { ...options, line: expression.token.line, column: expression.token.column };
  const report = (...args) => { if (!options.silent) diagnostics.add(...args); };
  if (!expression) return "unknown";
  if (expression.kind === "literal") return expression.valueType;
  if (expression.kind === "identifier") {
    if (variableTypes.has(expression.name)) return variableTypes.get(expression.name);
    if (options.reportUnknown !== false) report("PYTHONLIKE_UNKNOWN_NAME", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { name: expression.name });
    return "unknown";
  }
  if (expression.kind === "call") {
    const record = commandBySpelling.get(expression.name);
    if (!record) {
      const callable = options.functions?.get(expression.name);
      if (callable) {
        const parameters = callable.parameters || [];
        const required = parameters.filter((parameter) => !parameter.defaultExpression).length;
        if (expression.args.length < required || expression.args.length > parameters.length) report("PYTHONLIKE_ARITY", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { name: expression.name, expected: `${required}-${parameters.length}`, actual: expression.args.length });
        for (let index = 0; index < expression.args.length; index += 1) {
          const actual = inferExpressionType(expression.args[index], variableTypes, diagnostics, options);
          const expected = parameters[index]?.type;
          if (expected && actual !== "unknown" && actual !== expected) report("PYTHONLIKE_TYPE", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { name: expression.name, parameter: parameters[index]?.name, expected, actual });
        }
        return callable.returnType || "unknown";
      }
      if (options.reportUnknown !== false) report("PYTHONLIKE_UNKNOWN_COMMAND", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { name: expression.name });
      return "unknown";
    }
    const parameters = record.signature?.parameters || [];
    if (expression.args.length !== parameters.length) report("PYTHONLIKE_ARITY", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { name: expression.name, expected: parameters.length, actual: expression.args.length });
    for (let index = 0; index < expression.args.length; index += 1) {
      const actual = inferExpressionType(expression.args[index], variableTypes, diagnostics, options);
      const expected = parameters[index]?.type === "string" ? "text" : parameters[index]?.type;
      if (expected && actual !== "unknown" && actual !== expected) report("PYTHONLIKE_TYPE", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { name: expression.name, parameter: parameters[index]?.name, expected, actual });
      if (parameters[index]?.name === "componentName" && expression.args[index]?.kind === "literal" && expression.args[index].valueType === "text" && Array.isArray(options.componentInventory)) {
        const name = expression.args[index].value;
        const item = options.componentInventory.find((candidate) => String(candidate.name || candidate.codeName) === name);
        if (!item) report("COMPONENT_MISSING", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { componentName: name });
        else if (record.componentType && apiTypeForInventoryItem(item)?.typeId !== record.componentType) report("COMPONENT_WRONG_TYPE", options.line || 1, options.column || 1, (options.column || 1) + expression.name.length, { componentName: name, expectedType: record.componentType });
      }
    }
    return record.signature?.returns === "void" ? "void" : record.signature?.returns === "string" ? "text" : record.signature?.returns || "unknown";
  }
  if (expression.kind === "unary") {
    const type = inferExpressionType(expression.argument, variableTypes, diagnostics, options);
    const expected = expression.operator === "not" ? "boolean" : "number";
    if (type !== "unknown" && type !== expected) report("PYTHONLIKE_TYPE", options.line || 1, options.column || 1, (options.column || 1) + 1, { expected, actual: type });
    return expected;
  }
  if (expression.kind === "binary") {
    const left = inferExpressionType(expression.left, variableTypes, diagnostics, options);
    const right = inferExpressionType(expression.right, variableTypes, diagnostics, options);
    const operator = expression.operator;
    let expected = "number";
    let output = "number";
    if (operator === "and" || operator === "or") { expected = "boolean"; output = "boolean"; }
    else if (["==", "!=", "<", "<=", ">", ">="].includes(operator)) {
      expected = operator === "==" || operator === "!=" ? left : "number";
      output = "boolean";
    } else if (operator === "+" && (left === "text" || right === "text")) {
      if (left === "unknown" || right === "unknown") { expected = "unknown"; output = "unknown"; }
      else { expected = "text"; output = "text"; }
    }
    if (left !== "unknown" && expected !== "unknown" && left !== expected) report("PYTHONLIKE_TYPE", options.line || 1, options.column || 1, (options.column || 1) + 1, { expected, actual: left });
    if (right !== "unknown") {
      const expectedRight = operator === "==" || operator === "!=" ? left : expected;
      if (expectedRight !== "unknown" && right !== expectedRight) report("PYTHONLIKE_TYPE", options.line || 1, options.column || 1, (options.column || 1) + 1, { expected: expectedRight, actual: right });
    }
    return output;
  }
  return "unknown";
}

function walkStatements(statements, visit, depth = 0) {
  for (const statement of statements || []) {
    visit(statement, depth);
    if (statement.kind === "if") {
      for (const branch of statement.branches) walkStatements(branch.body, visit, depth + 1);
      walkStatements(statement.otherwise, visit, depth + 1);
    } else if (statement.kind === "while" || statement.kind === "for-range") walkStatements(statement.body, visit, depth + 1);
  }
}

function variableDeclarations(program, diagnostics, options) {
  const types = new Map(options.seedTypes || []);
  const externalTypes = options.externalTypes || new Map();
  const visibleTypes = () => new Map([...externalTypes, ...types]);
  const assignmentNodes = [];
  const variableNodes = [];
  walkStatements(program.body, (node) => {
    if (node.kind === "assign") { assignmentNodes.push(node); variableNodes.push({ name: node.name, node }); }
    if (node.kind === "for-range") {
      variableNodes.push({ name: node.variable, node });
      if (!types.has(node.variable)) types.set(node.variable, "number");
    }
  });
  for (const { name, node } of variableNodes) {
    if (reservedIdentifiers.has(name)) diagnostics.add("PYTHONLIKE_RESERVED_NAME", node.line, node.column, node.endColumn, { name });
  }
  for (let pass = 0; pass < assignmentNodes.length + 1; pass += 1) {
    let changed = false;
    for (const node of assignmentNodes) {
      if (types.has(node.name)) continue;
      const type = inferExpressionType(node.expression, visibleTypes(), diagnostics, { ...options, line: node.line, column: node.column, reportUnknown: false });
      if (["number", "text", "boolean"].includes(type)) { types.set(node.name, type); changed = true; }
    }
    if (!changed) break;
  }
  for (const node of assignmentNodes) {
    const expected = types.get(node.name);
    const actual = inferExpressionType(node.expression, visibleTypes(), diagnostics, { ...options, line: node.line, column: node.column, reportUnknown: true });
    if (actual === "void") diagnostics.add("PYTHONLIKE_TYPE", node.line, node.column, node.endColumn, { expected: "number, text or boolean", actual: "void" });
    else if (expected && actual !== "unknown" && expected !== actual) diagnostics.add("PYTHONLIKE_VARIABLE_TYPE", node.line, node.column, node.endColumn, { name: node.name, expected, actual });
  }
  return types;
}

function walkExpression(expression, visit) {
  if (!expression) return;
  visit(expression);
  if (expression.kind === "call") expression.args.forEach((argument) => walkExpression(argument, visit));
  else if (expression.kind === "unary") walkExpression(expression.argument, visit);
  else if (expression.kind === "binary") { walkExpression(expression.left, visit); walkExpression(expression.right, visit); }
}

function walkStatementExpressions(statements, visitStatement, visitExpressionNode) {
  walkStatements(statements, (statement, depth) => {
    visitStatement?.(statement, depth);
    if (statement.kind === "assign") walkExpression(statement.expression, visitExpressionNode);
    else if (statement.kind === "call-statement") walkExpression(statement.expression, visitExpressionNode);
    else if (statement.kind === "return") walkExpression(statement.expression, visitExpressionNode);
    else if (statement.kind === "if") statement.branches.forEach((branch) => walkExpression(branch.condition, visitExpressionNode));
    else if (statement.kind === "while") walkExpression(statement.condition, visitExpressionNode);
    else if (statement.kind === "for-range") statement.args.forEach((argument) => walkExpression(argument, visitExpressionNode));
  });
}

function allReturnNodes(statements) {
  const returns = [];
  walkStatements(statements, (statement) => { if (statement.kind === "return") returns.push(statement); });
  return returns;
}

function inferCallableTypes(program, diagnostics, componentInventory) {
  const functions = new Map();
  for (const callable of program.functions || []) {
    if (functions.has(callable.name)) diagnostics.add("PYTHONLIKE_DUPLICATE_FUNCTION", callable.line, callable.column, callable.endColumn, { name: callable.name });
    else functions.set(callable.name, callable);
    const returns = allReturnNodes(callable.body);
    const hasValueReturn = returns.some((statement) => statement.expression);
    const hasBareReturn = returns.some((statement) => !statement.expression);
    if (hasValueReturn && hasBareReturn) diagnostics.add("PYTHONLIKE_RETURN", callable.line, callable.column, callable.endColumn, { name: callable.name, reason: "mixed-return" });
    callable.kind = hasValueReturn || callable.returnTypeHint ? "function" : "task";
    callable.returnType = callable.kind === "task" ? "void" : callable.returnTypeHint || "unknown";
    for (const parameter of callable.parameters) {
      const defaultType = literalDefaultType(parameter.defaultExpression);
      parameter.type = parameter.typeHint || defaultType || "unknown";
    }
  }
  for (const callable of functions.values()) {
    if (callable.name === "main") diagnostics.add("PYTHONLIKE_DUPLICATE_FUNCTION", callable.line, callable.column, callable.endColumn, { name: callable.name });
    if (callable.parameters.some((parameter) => functions.has(parameter.name))) diagnostics.add("PYTHONLIKE_RESERVED_NAME", callable.line, callable.column, callable.endColumn, { name: callable.name });
  }

  const silentDiagnostics = { add() {} };
  let globalTypes = new Map();
  let localTypes = new Map();
  let localDeclarationTypes = new Map();
  const maximumPasses = (functions.size + 1) * 4 + 8;
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;
    globalTypes = variableDeclarations(program, silentDiagnostics, { componentInventory, functions, silent: true, reportUnknown: false });
    localTypes = new Map();
    localDeclarationTypes = new Map();
    for (const callable of functions.values()) {
      const seedTypes = new Map(callable.parameters.map((parameter) => [parameter.name, parameter.type]));
      const declared = variableDeclarations({ body: callable.body }, silentDiagnostics, {
        componentInventory, functions, seedTypes, externalTypes: globalTypes, silent: true, reportUnknown: false
      });
      localDeclarationTypes.set(callable.name, declared);
      localTypes.set(callable.name, new Map([...globalTypes, ...declared]));
    }

    const visitCallSites = (statements, scopeTypes) => walkStatementExpressions(statements, null, (expression) => {
      if (expression.kind !== "call") return;
      const callable = functions.get(expression.name);
      if (!callable) return;
      for (let index = 0; index < Math.min(expression.args.length, callable.parameters.length); index += 1) {
        const parameter = callable.parameters[index];
        const actual = inferExpressionType(expression.args[index], scopeTypes, silentDiagnostics, { componentInventory, functions, silent: true, reportUnknown: false });
        if (parameter.type === "unknown" && ["number", "text", "boolean"].includes(actual)) { parameter.type = actual; changed = true; }
      }
    });
    visitCallSites(program.body, globalTypes);
    for (const callable of functions.values()) visitCallSites(callable.body, localTypes.get(callable.name) || globalTypes);

    for (const callable of functions.values()) {
      if (callable.kind !== "function" || callable.returnType !== "unknown") continue;
      const scopeTypes = localTypes.get(callable.name) || globalTypes;
      for (const statement of allReturnNodes(callable.body)) {
        const type = inferExpressionType(statement.expression, scopeTypes, silentDiagnostics, { componentInventory, functions, silent: true, reportUnknown: false });
        if (["number", "text", "boolean"].includes(type)) { callable.returnType = type; changed = true; break; }
      }
    }
    if (!changed) break;
  }

  globalTypes = variableDeclarations(program, diagnostics, { componentInventory, functions, reportUnknown: false });
  localTypes = new Map();
  localDeclarationTypes = new Map();
  for (const callable of functions.values()) {
    const seedTypes = new Map(callable.parameters.map((parameter) => [parameter.name, parameter.type]));
    const declared = variableDeclarations({ body: callable.body }, diagnostics, { componentInventory, functions, seedTypes, externalTypes: globalTypes, reportUnknown: false });
    const locals = new Map([...globalTypes, ...declared]);
    localDeclarationTypes.set(callable.name, declared);
    localTypes.set(callable.name, locals);
    for (const parameter of callable.parameters) {
      if (parameter.type === "unknown") diagnostics.add("PYTHONLIKE_FUNCTION_TYPE", callable.line, callable.column, callable.endColumn, { name: callable.name, parameter: parameter.name });
    }
    const returns = allReturnNodes(callable.body);
    if (callable.kind === "function") {
      if (callable.returnType === "unknown") diagnostics.add("PYTHONLIKE_FUNCTION_TYPE", callable.line, callable.column, callable.endColumn, { name: callable.name, parameter: "return type" });
      for (const statement of returns) {
        if (!statement.expression) diagnostics.add("PYTHONLIKE_RETURN", statement.line, statement.column, statement.endColumn, { name: callable.name, reason: "missing-value" });
        else {
          const actual = inferExpressionType(statement.expression, locals, diagnostics, { componentInventory, functions, line: statement.line, column: statement.column });
          if (callable.returnType !== "unknown" && actual !== "unknown" && actual !== callable.returnType) diagnostics.add("PYTHONLIKE_RETURN", statement.line, statement.column, statement.endColumn, { name: callable.name, reason: `expected-${callable.returnType}-got-${actual}` });
        }
      }
      if (!statementListAlwaysReturns(callable.body)) diagnostics.add("PYTHONLIKE_RETURN", callable.line, callable.column, callable.endColumn, { name: callable.name, reason: "missing-path" });
    } else {
      for (const statement of returns) if (statement.expression) diagnostics.add("PYTHONLIKE_RETURN", statement.line, statement.column, statement.endColumn, { name: callable.name, reason: "task-value" });
    }
    for (const parameter of callable.parameters) {
      const defaultType = literalDefaultType(parameter.defaultExpression);
      if (defaultType && parameter.type !== "unknown" && defaultType !== parameter.type) diagnostics.add("PYTHONLIKE_TYPE", callable.line, callable.column, callable.endColumn, { name: parameter.name, expected: parameter.type, actual: defaultType });
    }
  }

  for (const callable of functions.values()) {
    const scopeTypes = localTypes.get(callable.name) || globalTypes;
    walkStatementExpressions(callable.body, null, (expression) => {
      if (expression.kind === "call" && functions.has(expression.name)) inferExpressionType(expression, scopeTypes, diagnostics, { componentInventory, functions, line: expression.token?.line || callable.line, column: expression.token?.column || callable.column });
    });
  }
  walkStatementExpressions(program.body, null, (expression) => {
    if (expression.kind === "call" && functions.has(expression.name)) inferExpressionType(expression, globalTypes, diagnostics, { componentInventory, functions, line: expression.token?.line || 1, column: expression.token?.column || 1 });
  });
  return { functions, globalTypes, localTypes, localDeclarationTypes };
}

function statementListAlwaysReturns(statements) {
  for (const statement of statements || []) {
    if (statement.kind === "return") return true;
    if (statement.kind === "if" && statement.otherwise.length && statement.branches.every((branch) => statementListAlwaysReturns(branch.body)) && statementListAlwaysReturns(statement.otherwise)) return true;
  }
  return false;
}

function orderedCallables(functions) {
  return [...functions.values()];
}

function createLocalNameMaps(functions, localDeclarationTypes, globalTypes) {
  const maps = new Map();
  for (const callable of functions.values()) {
    const names = new Map();
    const declarations = localDeclarationTypes.get(callable.name) || new Map();
    for (const name of declarations.keys()) names.set(name, name);
    maps.set(callable.name, names);
  }
  return maps;
}

function validateStatementTypes(statements, variableTypes, diagnostics, options, loopDepth = 0) {
  for (const statement of statements || []) {
    if (statement.kind === "assign") inferExpressionType(statement.expression, variableTypes, diagnostics, { ...options, line: statement.line, column: statement.column });
    else if (statement.kind === "call-statement") {
      const type = inferExpressionType(statement.expression, variableTypes, diagnostics, { ...options, line: statement.line, column: statement.column });
      const userFunction = statement.expression.kind === "call" && options.functions?.get(statement.expression.name)?.kind === "function";
      if (!userFunction && type !== "void" && type !== "unknown") diagnostics.add("PYTHONLIKE_SYNTAX", statement.line, statement.column, statement.endColumn, { reason: "call-result-must-be-used" });
    } else if (statement.kind === "break" && loopDepth === 0) diagnostics.add("PYTHONLIKE_BREAK_CONTEXT", statement.line, statement.column, statement.endColumn);
    else if (statement.kind === "continue" && loopDepth === 0) diagnostics.add("PYTHONLIKE_CONTINUE_CONTEXT", statement.line, statement.column, statement.endColumn);
    else if (statement.kind === "if") {
      for (const branch of statement.branches) {
        const type = inferExpressionType(branch.condition, variableTypes, diagnostics, { ...options, line: branch.line, column: branch.column });
        if (type !== "boolean" && type !== "unknown") diagnostics.add("PYTHONLIKE_TYPE", branch.line, branch.column, branch.column + 2, { expected: "boolean", actual: type });
        validateStatementTypes(branch.body, variableTypes, diagnostics, options, loopDepth);
      }
      validateStatementTypes(statement.otherwise, variableTypes, diagnostics, options, loopDepth);
    } else if (statement.kind === "while") {
      const type = inferExpressionType(statement.condition, variableTypes, diagnostics, { ...options, line: statement.line, column: statement.column });
      if (type !== "boolean" && type !== "unknown") diagnostics.add("PYTHONLIKE_TYPE", statement.line, statement.column, statement.column + 5, { expected: "boolean", actual: type });
      validateStatementTypes(statement.body, variableTypes, diagnostics, options, loopDepth + 1);
    } else if (statement.kind === "for-range") {
      if (variableTypes.get(statement.variable) && variableTypes.get(statement.variable) !== "number") diagnostics.add("PYTHONLIKE_VARIABLE_TYPE", statement.line, statement.column, statement.endColumn, { name: statement.variable, expected: "number", actual: variableTypes.get(statement.variable) });
      if (![1, 2, 3].includes(statement.args.length)) diagnostics.add("PYTHONLIKE_SYNTAX", statement.line, statement.column, statement.endColumn, { reason: "range-arity" });
      statement.args.forEach((argument) => {
        const type = inferExpressionType(argument, variableTypes, diagnostics, { ...options, line: statement.line, column: statement.column });
        if (type !== "number" && type !== "unknown") diagnostics.add("PYTHONLIKE_TYPE", statement.line, statement.column, statement.endColumn, { expected: "number", actual: type });
      });
      if (statement.args.length === 3) {
        const step = statement.args[2];
        const stepValue = step.kind === "literal" ? step.value : step.kind === "unary" && ["+", "-"].includes(step.operator) && step.argument?.kind === "literal" ? (step.operator === "-" ? -step.argument.value : step.argument.value) : NaN;
        if (!Number.isInteger(stepValue) || stepValue === 0) diagnostics.add("PYTHONLIKE_RANGE_STEP", statement.line, statement.column, statement.endColumn);
      }
      validateStatementTypes(statement.body, variableTypes, diagnostics, options, loopDepth + 1);
    } else if (statement.kind === "return" && options.allowReturn !== true) {
      diagnostics.add("PYTHONLIKE_RETURN", statement.line, statement.column, statement.endColumn, { name: "main", reason: "outside-function" });
    }
  }
}

function emitExpression(expression, functions = new Map(), names = new Map(), locale = "en-US", grammar = ReducGrammar.locales[locale]) {
  if (!expression) return "";
  if (expression.kind === "literal") return expression.valueType === "text" ? JSON.stringify(expression.value) : expression.valueType === "boolean" ? grammar.literals[expression.value ? "true" : "false"] : expression.raw;
  if (expression.kind === "identifier") return names.get(expression.name) || expression.name;
  if (expression.kind === "call") {
    const record = commandBySpelling.get(expression.name);
    const spelling = record?.spellings?.[locale] || expression.name;
    const args = expression.args.map((argument) => emitExpression(argument, functions, names, locale, grammar));
    return `${spelling}(${args.join(", ")})`;
  }
  if (expression.kind === "unary") {
    const value = emitExpression(expression.argument, functions, names, locale, grammar);
    if (expression.operator === "not") return `!(${value})`;
    if (expression.operator === "+") return `(${value})`;
    return `(0 - (${value}))`;
  }
  if (expression.kind === "binary") {
    const operator = expression.operator === "and" ? grammar.keywords.and : expression.operator === "or" ? grammar.keywords.or : expression.operator;
    return `(${emitExpression(expression.left, functions, names, locale, grammar)} ${operator} ${emitExpression(expression.right, functions, names, locale, grammar)})`;
  }
  return "0";
}

function normalizedRangeArguments(node) {
  const one = { kind: "literal", value: 1, valueType: "number", raw: "1" };
  const zero = { kind: "literal", value: 0, valueType: "number", raw: "0" };
  if (node.args.length === 1) return { start: zero, stop: node.args[0], step: one };
  if (node.args.length === 2) return { start: node.args[0], stop: node.args[1], step: one };
  if (node.args.length === 3) return { start: node.args[0], stop: node.args[1], step: node.args[2] };
  return null;
}

function collectRangeTemporaries(statements, variableTypes, scopeId = 0, reserved = []) {
  const names = new Set([...variableTypes.keys(), ...reserved]);
  const byNode = new WeakMap();
  const declarations = [];
  let index = 0;
  walkStatements(statements, (node) => {
    if (node.kind !== "for-range" || !normalizedRangeArguments(node)) return;
    let start;
    let stop;
    do {
      start = `__pythonlike_range_${scopeId}_${index}_start`;
      stop = `__pythonlike_range_${scopeId}_${index}_stop`;
      index += 1;
    } while (names.has(start) || names.has(stop));
    names.add(start);
    names.add(stop);
    byNode.set(node, { start, stop });
    declarations.push({ name: start, node }, { name: stop, node });
  });
  return { byNode, declarations };
}

function createEmitter(source, diagnostics, rangeTemporaries, tabSize, functions = new Map(), locale = "en-US") {
  const output = [];
  const sourceMap = [];
  const indentUnit = " ".repeat(tabSize);
  const grammar = ReducGrammar.locales[locale] || ReducGrammar.locales["en-US"];
  const keyword = grammar.keywords;
  const append = (text, node = null) => {
    output.push(text);
    sourceMap.push(node ? { generatedLine: output.length, source: { start: { line: node.line, column: node.column }, end: { line: node.line, column: node.endColumn } } } : { generatedLine: output.length, source: null });
  };
  const statements = (nodes, indent = 1, activeRanges = rangeTemporaries, continueAction = null, names = new Map()) => {
    for (const node of nodes || []) {
      const pad = indentUnit.repeat(indent);
      const localName = (name) => names.get(name) || name;
      if (node.kind === "assign") append(`${pad}${localName(node.name)} = ${emitExpression(node.expression, functions, names, locale, grammar)}`, node);
      else if (node.kind === "call-statement") {
        if (node.expression.kind === "call" && node.expression.name === "break") append(`${pad}${keyword.break}`, node);
        else append(`${pad}${emitExpression(node.expression, functions, names, locale, grammar)}`, node);
      } else if (node.kind === "break") append(`${pad}${keyword.break}`, node);
      else if (node.kind === "continue") {
        if (continueAction) append(`${pad}${continueAction}`, node);
        append(`${pad}${keyword.continue}`, node);
      } else if (node.kind === "return") append(`${pad}${keyword.return}${node.expression ? ` ${emitExpression(node.expression, functions, names, locale, grammar)}` : ""}`, node);
      else if (node.kind === "pass") append(`${pad}# pass`, node);
      else if (node.kind === "while") {
        append(`${pad}${keyword.while} (${emitExpression(node.condition, functions, names, locale, grammar)}) ${keyword.do} {`, node);
        statements(node.body, indent + 1, activeRanges, null, names);
        append(`${pad}}`, node);
      } else if (node.kind === "for-range") {
        const range = normalizedRangeArguments(node);
        const temporary = activeRanges.byNode.get(node);
        if (!range || !temporary) {
          append(`${pad}${keyword.while} (${grammar.literals.false}) ${keyword.do} {`, node);
          statements(node.body, indent + 1, activeRanges, null, names);
          append(`${pad}}`, node);
          continue;
        }
        const stepText = emitExpression(range.step, functions, names, locale, grammar);
        const stepValue = range.step.kind === "literal" ? range.step.value : range.step.kind === "unary" && range.step.operator === "-" && range.step.argument?.kind === "literal" ? -range.step.argument.value : range.step.kind === "unary" && range.step.operator === "+" && range.step.argument?.kind === "literal" ? range.step.argument.value : 1;
        const positiveStep = stepValue > 0;
        const comparison = positiveStep ? "<" : ">";
        const iterator = localName(node.variable);
        const increment = `${iterator} = ${iterator} + (${stepText})`;
        append(`${pad}${temporary.start} = ${emitExpression(range.start, functions, names, locale, grammar)}`, node);
        append(`${pad}${temporary.stop} = ${emitExpression(range.stop, functions, names, locale, grammar)}`, node);
        append(`${pad}${iterator} = ${temporary.start}`, node);
        append(`${pad}${keyword.while} (${iterator} ${comparison} ${temporary.stop}) ${keyword.do} {`, node);
        statements(node.body, indent + 1, activeRanges, increment, names);
        append(`${pad}${indentUnit}${increment}`, node);
        append(`${pad}}`, node);
      } else if (node.kind === "if") {
        node.branches.forEach((branch, index) => {
          append(`${pad}${index ? `${keyword.else} ${keyword.if}` : keyword.if} (${emitExpression(branch.condition, functions, names, locale, grammar)}) ${keyword.then} {`, branch);
          statements(branch.body, indent + 1, activeRanges, continueAction, names);
          append(`${pad}}`, branch);
        });
        if (node.otherwise.length) {
          append(`${pad}${keyword.else} {`, node.otherwiseLine || node);
          statements(node.otherwise, indent + 1, activeRanges, continueAction, names);
          append(`${pad}}`, node.otherwiseLine || node);
        }
      }
    }
  };
  return { output, sourceMap, append, statements, source, diagnostics };
}

export function transpilePythonLike({ source = "", componentInventory = null, tabSize = 4, targetLocale = "en-US" } = {}) {
  const text = String(source ?? "");
  const indentSize = [2, 3, 4].includes(Number(tabSize)) ? Number(tabSize) : 4;
  const locale = targetLocale === "pt-BR" ? "pt-BR" : "en-US";
  const grammar = ReducGrammar.locales[locale];
  const diagnostics = createDiagnostics(text);
  if (utf8Size(text) > SOURCE_LIMIT) {
    diagnostics.add("PYTHONLIKE_SOURCE_TOO_LARGE", 1, 1, 2, { limit: SOURCE_LIMIT });
    return { ok: false, diagnostics, diagnosticCountTruncated: 0, generatedSource: "", sourceMap: [] };
  }
  const parser = new PythonLikeParser(text, diagnostics, indentSize);
  const program = parser.parse();
  const inferred = inferCallableTypes(program, diagnostics, componentInventory);
  const { functions, globalTypes, localTypes, localDeclarationTypes } = inferred;
  const functionOptions = { componentInventory, functions };
  validateStatementTypes(program.body, globalTypes, diagnostics, functionOptions);
  for (const callable of functions.values()) validateStatementTypes(callable.body, localTypes.get(callable.name) || globalTypes, diagnostics, { ...functionOptions, allowReturn: true });
  for (const statement of allReturnNodes(program.body)) diagnostics.add("PYTHONLIKE_RETURN", statement.line, statement.column, statement.endColumn, { name: "main", reason: "outside-function" });
  const checkNesting = (statements) => walkStatements(statements, (node, depth) => {
    if (["if", "while", "for-range"].includes(node.kind) && depth >= DEPTH_LIMIT) diagnostics.add("PYTHONLIKE_NESTING", node.line, node.column, node.endColumn);
  });
  checkNesting(program.body);
  for (const callable of functions.values()) checkNesting(callable.body);

  const localNames = createLocalNameMaps(functions, localDeclarationTypes, globalTypes);
  const rangeTemporaries = collectRangeTemporaries(program.body, globalTypes, 0, [...functions.keys()]);
  const orderedFunctions = orderedCallables(functions);
  const emitter = createEmitter(text, diagnostics, rangeTemporaries, indentSize, functions, locale);
  const firstDeclaration = (statements, name) => {
    let found = null;
    walkStatements(statements, (node) => { if (!found && (node.kind === "assign" && node.name === name || node.kind === "for-range" && node.variable === name)) found = node; });
    return found;
  };
  const localizedType = (type) => grammar.types[type === "text" ? "string" : type] || type;
  for (const [name, type] of globalTypes) emitter.append(`${localizedType(type)} ${name}`, firstDeclaration(program.body, name));
  for (const declaration of rangeTemporaries.declarations) emitter.append(`${grammar.types.number} ${declaration.name}`, declaration.node);
  for (const [functionIndex, callable] of orderedFunctions.entries()) {
    const declarations = localDeclarationTypes.get(callable.name) || new Map();
    const names = localNames.get(callable.name) || new Map();
    const callableRanges = collectRangeTemporaries(callable.body, declarations, functionIndex + 1, [...globalTypes.keys(), ...functions.keys(), ...names.values()]);
    const params = callable.parameters.map((parameter) => `${localizedType(parameter.type)} ${names.get(parameter.name) || parameter.name}${parameter.defaultExpression ? ` = ${emitExpression(parameter.defaultExpression, functions, names, locale, grammar)}` : ""}`).join(", ");
    const withParams = params ? ` ${grammar.keywords.with} ${params}` : "";
    const signature = callable.kind === "function" ? `${grammar.keywords.function} ${localizedType(callable.returnType)} ${callable.name}${withParams}` : `${grammar.keywords.task} ${callable.name}${withParams}`;
    emitter.append(`${signature} {`, callable);
    for (const [name, type] of declarations) {
      if (callable.parameters.some((parameter) => parameter.name === name)) continue;
      emitter.append(`${localizedType(type)} ${names.get(name) || name}`, firstDeclaration(callable.body, name));
    }
    for (const declaration of callableRanges.declarations) emitter.append(`${grammar.types.number} ${declaration.name}`, declaration.node);
    emitter.statements(callable.body, 1, callableRanges, null, names);
    emitter.append("}", callable);
  }
  emitter.append(grammar.keywords.begin);
  emitter.statements(program.body);
  emitter.append(grammar.keywords.end);
  const generatedSource = emitter.output.join("\n");
  if (utf8Size(generatedSource) > SOURCE_LIMIT) diagnostics.add("PYTHONLIKE_SOURCE_TOO_LARGE", 1, 1, 2, { limit: SOURCE_LIMIT, reason: "output" });
  const uniqueDiagnostics = [...new Map(diagnostics.map((item) => [`${item.code}:${item.start.line}:${item.start.column}:${JSON.stringify(item.params)}`, item])).values()];
  if (diagnostics.truncatedCount) uniqueDiagnostics.truncatedCount = diagnostics.truncatedCount;
  const errors = uniqueDiagnostics.filter((item) => item.severity === "error");
  return { ok: errors.length === 0, diagnostics: uniqueDiagnostics, diagnosticCountTruncated: uniqueDiagnostics.truncatedCount || 0, generatedSource: errors.length ? "" : generatedSource, sourceMap: emitter.sourceMap };
}

export const PYTHONLIKE_COMMANDS = Object.freeze(commands.map((record) => record.commandId));
