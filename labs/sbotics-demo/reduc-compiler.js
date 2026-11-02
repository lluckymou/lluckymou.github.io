import { ReducCommands, ReducGrammar } from "./programming-api-registry.generated.js?imp-ux-03-blockly-drawer-controls-20261101-1";

const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const MAX_NESTING = 256;
const TYPES = new Set(["number", "string", "boolean"]);
const DEFAULTS = Object.freeze({ number: "0", string: '""', boolean: "false" });
const COMMANDS = new Map(ReducCommands.records.map((record) => [record.commandId, record]));

const makeKeywordMap = (locale) => {
  const map = new Map();
  const record = ReducGrammar.locales[locale] || ReducGrammar.locales["pt-BR"];
  for (const [semantic, spelling] of Object.entries(record.keywords || {})) map.set(spelling, semantic);
  for (const [semantic, spelling] of Object.entries(record.types || {})) map.set(spelling, `type:${semantic}`);
  for (const [semantic, spelling] of Object.entries(record.literals || {})) map.set(spelling, `literal:${semantic}`);
  return map;
};

function byteLength(value) { return new TextEncoder().encode(String(value)).length; }
function point(line, column) { return { line, column }; }

function compileReduc(input = {}) {
  const source = String(input.source ?? "");
  const locale = input.locale === "en-US" ? "en-US" : "pt-BR";
  const diagnostics = [];
  const add = (code, token, params = {}, severity = "error", endToken = token) => {
    if (diagnostics.length >= MAX_DIAGNOSTICS) return;
    const at = token || { line: 1, column: 1 };
    const end = endToken || at;
    diagnostics.push({ code, severity, params, start: point(at.line, at.column), end: point(end.endLine || end.line, end.endColumn || end.column + 1) });
  };
  if (byteLength(source) > MAX_SOURCE_BYTES) {
    add("REDUC_RANGE", { line: 1, column: 1 }, { name: "source" });
    return { ok: false, diagnostics };
  }

  const keywords = makeKeywordMap(locale);
  const tokens = lex(source, keywords, add);
  let cursor = 0;
  let nesting = 0;
  let loopDepth = 0;
  let switchDepth = 0;
  let repeatDepth = 0;
  let currentCallable = null;
  let writeGenerated = () => {};
  const variables = new Map();
  const functions = new Map();
  const variableKey = (name, scope = "global") => scope === "global" ? name : `${scope}::${name}`;
  const getVariable = (name) => variables.get(currentCallable ? variableKey(name, currentCallable.name) : name) || variables.get(name);
  const componentInventory = Array.isArray(input.componentInventory) ? input.componentInventory : [];
  const commandsBySpelling = new Map();
  const legacyBySpelling = new Map();
  const localizedName = (record) => record.spellings?.[locale];
  for (const record of ReducCommands.records) {
    const name = localizedName(record);
    if (name) commandsBySpelling.set(name, record);
    const legacy = record.legacySpellings?.[locale];
    if (legacy) legacyBySpelling.set(legacy, record);
  }
  const peek = (offset = 0) => tokens[Math.min(cursor + offset, tokens.length - 1)];
  const take = () => tokens[cursor++];
  const is = (value) => peek().value === value;
  const consume = (value) => is(value) ? take() : null;
  const expect = (value, message = value) => {
    if (is(value)) return take();
    add("REDUC_SYNTAX", peek(), { syntax: message });
    return { type: "missing", value, raw: value, line: peek().line, column: peek().column, endColumn: peek().column };
  };
  const skipLines = () => { while (peek().type === "NEWLINE") take(); };
  const typeAt = (token) => token?.type === "keyword" && String(token.value).startsWith("type:") ? token.value.slice(5) : null;
  const nameAt = () => peek().type === "identifier" ? take() : null;
  const tokenRange = (node) => node?.token || peek();

  function parseProgram() {
    const globals = [];
    const declarations = [];
    skipLines();
    while (typeAt(peek())) {
      globals.push(parseVariableDeclaration("global"));
      skipLines();
    }
    predeclareCallables(cursor);
    while (is("task") || is("function")) {
      declarations.push(parseCallableDeclaration());
      skipLines();
    }
    if (!consume("begin")) add("REDUC_SYNTAX", peek(), { syntax: locale === "pt-BR" ? "inicio" : "begin" });
    const body = parseStatementList(new Set(["end", "EOF"]), false);
    skipLines();
    expect("end", locale === "pt-BR" ? "fim" : "end");
    skipLines();
    if (peek().type !== "EOF") add("REDUC_SYNTAX", peek(), { syntax: "EOF" });
    return { type: "Program", globals, declarations, body, token: tokens[0] };
  }

  function predeclareCallables(startIndex) {
    let index = startIndex;
    const at = () => tokens[Math.min(index, tokens.length - 1)];
    const isTypeToken = (token) => Boolean(typeAt(token));
    const isPunctuation = (value) => at().type === "punctuation" && at().value === value;
    const isKeyword = (value) => at().type === "keyword" && at().value === value;
    while (at().type !== "EOF") {
      while (at().type === "NEWLINE") index += 1;
      if (isKeyword("begin") || at().type === "EOF") break;
      if (at().type !== "keyword" || !["task", "function"].includes(at().value)) { index += 1; continue; }
      const kindToken = at();
      const kind = kindToken.value;
      index += 1;
      let returnType = "void";
      if (kind === "function") {
        if (!isTypeToken(at())) { index += 1; continue; }
        returnType = typeAt(at());
        index += 1;
      }
      const nameToken = at();
      if (nameToken.type !== "identifier") { index += 1; continue; }
      index += 1;
      const parameters = [];
      if (isKeyword("with")) {
        index += 1;
        while (at().type !== "EOF" && !isPunctuation("{") && !isKeyword("begin")) {
          if (isPunctuation(",") || at().type === "NEWLINE") { index += 1; continue; }
          if (!isTypeToken(at())) { index += 1; continue; }
          const paramType = typeAt(at());
          const paramTypeToken = at();
          index += 1;
          const paramName = at();
          if (paramName.type !== "identifier") { index += 1; continue; }
          index += 1;
          let initial = null;
          if (at().type === "operator" && at().value === "=") {
            initial = { valueType: paramType };
            index += 1;
            let depth = 0;
            while (at().type !== "EOF") {
              if (depth === 0 && (isPunctuation(",") || isPunctuation("{") || isKeyword("begin"))) break;
              if (isPunctuation("(")) depth += 1;
              else if (isPunctuation(")")) depth = Math.max(0, depth - 1);
              index += 1;
            }
          }
          parameters.push({ name: paramName.value, valueType: paramType, initial, token: paramName, typeToken: paramTypeToken });
          if (isPunctuation(",")) index += 1;
          else if (!isPunctuation("{") && !isKeyword("begin")) index += 1;
        }
      }
      functions.set(nameToken.value, { type: "CallableDeclaration", kind, name: nameToken.value, returnType, parameters, body: [], token: kindToken, nameToken, predeclared: true });
      if (isPunctuation("{")) {
        let depth = 0;
        do {
          if (isPunctuation("{")) depth += 1;
          else if (isPunctuation("}")) depth -= 1;
          index += 1;
        } while (depth > 0 && at().type !== "EOF");
      } else if (isKeyword("begin")) {
        let depth = 0;
        do {
          if (isKeyword("begin")) depth += 1;
          else if (isKeyword("end")) depth -= 1;
          index += 1;
        } while (depth > 0 && at().type !== "EOF");
      }
    }
  }

  function registerVariable(nameToken, type, scope) {
    if (!nameToken) return;
    const name = nameToken.value;
    if (name.length > 128) add("REDUC_RANGE", nameToken, { name });
    if (keywords.has(name) || commandsBySpelling.has(name) || legacyBySpelling.has(name) || ["robot", "console", "debug"].includes(name)) {
      add("REDUC_DUPLICATE_SYMBOL", nameToken, { name });
      return;
    }
    const key = variableKey(name, scope);
    if (variables.has(key)) add("REDUC_DUPLICATE_SYMBOL", nameToken, { name });
    else variables.set(key, { type, scope, token: nameToken });
  }

  function parseVariableDeclaration(scope) {
    const typeToken = take();
    const type = typeAt(typeToken) || "number";
    const nameToken = nameAt();
    if (!nameToken) add("REDUC_SYNTAX", peek(), { syntax: "identifier" });
    registerVariable(nameToken, type, scope);
    let initial = null;
    if (consume("=")) initial = parseExpression(0);
    if (initial && initial.valueType !== type) add("REDUC_TYPE", initial.token, { name: nameToken?.value || "", expected: type, actual: initial.valueType || "unknown" }, "error", initial.endToken);
    return { type: "VariableDeclaration", name: nameToken?.value || "invalid", valueType: type, initial, token: typeToken, nameToken };
  }

  function parseCallableDeclaration() {
    const kindToken = take();
    const kind = kindToken.value;
    let returnType = "void";
    let nameToken;
    if (kind === "function") {
      returnType = typeAt(peek()) || "number";
      if (typeAt(peek())) take(); else add("REDUC_SYNTAX", peek(), { syntax: "return type" });
      nameToken = nameAt();
    } else nameToken = nameAt();
    if (!nameToken) { add("REDUC_SYNTAX", peek(), { syntax: "identifier" }); nameToken = { value: "invalid", line: peek().line, column: peek().column }; }
    if (functions.has(nameToken.value) && !functions.get(nameToken.value)?.predeclared || commandsBySpelling.has(nameToken.value) || keywords.has(nameToken.value)) add("REDUC_DUPLICATE_SYMBOL", nameToken, { name: nameToken.value });
    const callable = { type: "CallableDeclaration", kind, name: nameToken.value, returnType, parameters: [], body: [], token: kindToken, nameToken };
    functions.set(callable.name, callable);
    if (consume("with")) {
      let sawDefault = false;
      do {
        const paramType = typeAt(peek());
        if (!paramType) { add("REDUC_SYNTAX", peek(), { syntax: "parameter type" }); break; }
        const paramTypeToken = take();
        const paramName = nameAt();
        if (!paramName) { add("REDUC_SYNTAX", peek(), { syntax: "parameter name" }); break; }
        let initial = null;
        if (consume("=")) initial = parseExpression(0);
        if (initial) sawDefault = true;
        else if (sawDefault) add("REDUC_SYNTAX", paramName, { syntax: "required parameters before default parameters" });
        if (initial && initial.valueType !== paramType) add("REDUC_TYPE", initial.token, { name: paramName.value, expected: paramType, actual: initial.valueType || "unknown" }, "error", initial.endToken);
        registerVariable(paramName, paramType, callable.name);
        callable.parameters.push({ name: paramName.value, valueType: paramType, initial, token: paramName });
      } while (consume(","));
    }
    const previousCallable = currentCallable;
    currentCallable = callable;
    if (consume("{")) { callable.body = parseStatementList(new Set(["}", "EOF"]), true); expect("}"); }
    else if (consume("begin")) { callable.body = parseStatementList(new Set(["end", "EOF"]), true); expect("end"); }
    else { add("REDUC_SYNTAX", peek(), { syntax: "function body" }); skipToLineEnd(); }
    currentCallable = previousCallable;
    return callable;
  }

  function parseStatementList(stopValues = new Set(), local = false) {
    if (++nesting > MAX_NESTING) { add("REDUC_RANGE", peek(), { name: "nesting" }); nesting--; return []; }
    const statements = [];
    while (peek().type !== "EOF" && !stopValues.has(peek().value)) {
      if (peek().type === "NEWLINE") { take(); continue; }
      const before = cursor;
      if (typeAt(peek())) {
        if (!local) add("REDUC_CONTEXT", peek(), { name: "declaration" });
        statements.push(parseVariableDeclaration(local ? currentCallable?.name || "local" : "invalid"));
      } else {
        const statement = parseStatement();
        if (statement) statements.push(statement);
      }
      if (cursor === before) { add("REDUC_SYNTAX", take(), { syntax: "statement" }); }
      if (peek().type === "NEWLINE") take();
    }
    nesting--;
    return statements;
  }

  function parseBraceSuite() {
    const body = parseStatementList(new Set(["}", "EOF"]), false);
    expect("}");
    return body;
  }

  function parseStatement() {
    const value = peek().value;
    if (value === "if") return parseIf();
    if (value === "while") return parseWhile();
    if (value === "for") return parseFor();
    if (value === "repeat") return parseRepeat();
    if (value === "do") return parseDoWhile();
    if (value === "switchText") return parseSwitch();
    if (value === "break") { const token = take(); if (!loopDepth && !switchDepth) add("REDUC_CONTEXT", token, { name: "break" }); if (is("(")) add("REDUC_SYNTAX", peek(), { syntax: "break statement without parentheses" }); return { type: "Break", token }; }
    if (value === "continue") { const token = take(); if (!loopDepth) add("REDUC_CONTEXT", token, { name: "continue" }); if (is("(")) add("REDUC_SYNTAX", peek(), { syntax: "continue statement without parentheses" }); return { type: "Continue", token }; }
    if (value === "return") {
      const token = take();
      const noValue = ["NEWLINE", "EOF"].includes(peek().type) || ["}", "end"].includes(peek().value);
      const expression = noValue ? null : parseExpression(0);
      if (!currentCallable) add("REDUC_CONTEXT", token, { name: "return" });
      else if (currentCallable.kind === "task" && expression) add("REDUC_CONTEXT", token, { name: "value return from task" });
      else if (currentCallable.kind === "function" && !expression) add("REDUC_TYPE", token, { name: "return", expected: currentCallable.returnType, actual: "void" });
      else if (expression && expression.valueType !== currentCallable.returnType) add("REDUC_TYPE", expression.token, { name: "return", expected: currentCallable.returnType, actual: expression.valueType || "unknown" }, "error", expression.endToken);
      return { type: "Return", expression, token };
    }
    if (peek().type === "identifier") {
      const name = take();
      if (consume("=")) { const expression = parseExpression(0); const variable = getVariable(name.value); if (!variable) add("REDUC_UNKNOWN_SYMBOL", name, { name: name.value }); else if (variable.type !== expression.valueType) add("REDUC_TYPE", expression.token, { name: name.value, expected: variable.type, actual: expression.valueType || "unknown" }, "error", expression.endToken); return { type: "Assignment", name: name.value, expression, token: name }; }
      if (consume("(")) { const args = parseArgumentsAfterOpen(); return makeCall(name, args, true); }
      add("REDUC_UNKNOWN_SYMBOL", name, { name: name.value });
      return { type: "Invalid", token: name };
    }
    add("REDUC_SYNTAX", peek(), { syntax: "statement" });
    skipToLineEnd();
    return null;
  }

  function parseIf() {
    const token = take(); expect("("); const condition = parseExpression(0); expect(")");
    if (condition.valueType !== "boolean") add("REDUC_TYPE", condition.token, { name: "condition", expected: "boolean", actual: condition.valueType || "unknown" }, "error", condition.endToken);
    expect("then", locale === "pt-BR" ? "entao" : "then"); expect("{"); const consequent = parseBraceSuite(); let alternate = null;
    while (peek().type === "NEWLINE") take();
    if (consume("else")) {
      if (consume("if")) { cursor--; alternate = [parseIf()]; }
      else { expect("{"); alternate = parseBraceSuite(); }
    }
    return { type: "If", condition, consequent, alternate, token };
  }

  function parseWhile() {
    const token = take(); expect("("); const condition = parseExpression(0); expect(")");
    if (condition.valueType !== "boolean") add("REDUC_TYPE", condition.token, { name: "condition", expected: "boolean", actual: condition.valueType || "unknown" }, "error", condition.endToken);
    expect("do", locale === "pt-BR" ? "farei" : "do"); expect("{"); loopDepth++; const body = parseBraceSuite(); loopDepth--; return { type: "While", condition, body, token };
  }

  function parseFor() {
    const token = take(); const variableToken = nameAt();
    if (!variableToken) add("REDUC_SYNTAX", peek(), { syntax: "global number variable" });
    const variable = variables.get(variableToken?.value);
    if (!variable) add("REDUC_UNKNOWN_SYMBOL", variableToken || peek(), { name: variableToken?.value || "" });
    else if (variable.type !== "number" || variable.scope !== "global") add("REDUC_TYPE", variableToken, { name: variableToken.value, expected: "global number", actual: variable.type });
    expect("from"); const from = parseExpression(0); expect("to"); const to = parseExpression(0); expect("step"); const step = parseExpression(0);
    for (const expr of [from, to, step]) if (expr.valueType !== "number") add("REDUC_TYPE", expr.token, { name: "for range", expected: "number", actual: expr.valueType || "unknown" }, "error", expr.endToken);
    if (step.type === "Literal" && step.value === 0) add("REDUC_RANGE", step.token, { name: "step" });
    expect("do", locale === "pt-BR" ? "farei" : "do"); expect("{"); loopDepth++; const body = parseBraceSuite(); loopDepth--; return { type: "For", name: variableToken?.value || "invalid", from, to, step, body, token };
  }

  function parseRepeat() {
    const token = take(); const count = parseExpression(0);
    if (count.valueType !== "number") add("REDUC_TYPE", count.token, { name: "repeat count", expected: "number", actual: count.valueType || "unknown" }, "error", count.endToken);
    if (count.type === "Literal" && (!Number.isInteger(count.value) || count.value < 0)) add("REDUC_RANGE", count.token, { name: "repeat count" });
    if (repeatDepth) add("REDUC_CONTEXT", token, { name: "nested repeat" });
    if (is("times")) take(); else add("REDUC_SYNTAX", peek(), { syntax: locale === "pt-BR" ? "vezes" : "times" });
    let body;
    loopDepth++; repeatDepth++;
    if (consume("{")) body = parseBraceSuite();
    else if (consume("begin")) { body = parseStatementList(new Set(["end", "EOF"])); expect("end"); }
    else { add("REDUC_SYNTAX", peek(), { syntax: "{" }); body = []; }
    loopDepth--; repeatDepth--;
    return { type: "Repeat", count, body, token };
  }

  function parseDoWhile() {
    const token = take();
    let body = [];
    loopDepth++;
    if (consume("begin")) { body = parseStatementList(new Set(["end", "EOF"])); expect("end"); }
    else if (consume("{")) body = parseBraceSuite();
    else { add("REDUC_SYNTAX", peek(), { syntax: "do block" }); }
    loopDepth--;
    expect("while"); expect("("); const condition = parseExpression(0); expect(")");
    if (condition.valueType !== "boolean") add("REDUC_TYPE", condition.token, { name: "condition", expected: "boolean", actual: condition.valueType || "unknown" }, "error", condition.endToken);
    return { type: "DoWhile", condition, body, token };
  }

  function parseSwitch() {
    const token = take(); expect("("); const expression = parseExpression(0); expect(")"); expect("{");
    if (expression.valueType !== "string") add("REDUC_TYPE", expression.token, { name: "switch", expected: "string", actual: expression.valueType || "unknown" }, "error", expression.endToken);
    const cases = []; let defaultBody = null;
    switchDepth++;
    while (peek().type !== "EOF" && !is("}")) {
      skipLines();
      if (is("}")) break;
      if (consume("case")) {
        const value = take();
        if (value.type !== "string") add("REDUC_TYPE", value, { name: "case", expected: "string", actual: value.type }, "error", value);
        expect(":"); cases.push({ value: value.value, body: parseCaseBody(), token: value });
      } else if (consume("default")) {
        expect(":"); defaultBody = parseCaseBody();
      } else { add("REDUC_SYNTAX", peek(), { syntax: "case/default" }); skipToLineEnd(); }
    }
    switchDepth--; expect("}"); return { type: "Switch", expression, cases, defaultBody, token };
  }

  function parseCaseBody() {
    const body = [];
    skipLines();
    while (peek().type !== "EOF" && !["case", "default", "}"].includes(peek().value)) {
      if (peek().type === "NEWLINE") { take(); continue; }
      const before = cursor; const statement = parseStatement(); if (statement) body.push(statement);
      if (cursor === before) take(); if (peek().type === "NEWLINE") take();
    }
    return body;
  }

  function parseArgumentsAfterOpen() {
    const args = [];
    if (consume(")")) return args;
    do { args.push(parseExpression(0)); } while (consume(","));
    expect(")");
    return args;
  }

  function makeCall(nameToken, args, statement) {
    const name = nameToken.value;
    const record = commandsBySpelling.get(name);
    if (!record && legacyBySpelling.has(name)) {
      const old = legacyBySpelling.get(name);
      add("REDUC_LEGACY_COMMAND_CASE", nameToken, { name, replacement: localizedName(old) });
      return { type: "CommandCall", command: old, args, returnType: old.signature?.returns || "void", token: nameToken, statement };
    }
    if (name === "Pausar" || name === "DebugPause" || name === "PausarDepuracao") {
      if (args.length) add("REDUC_ARITY", nameToken, { name, expected: 0, actual: args.length });
      return { type: "DebugPause", args, returnType: "void", token: nameToken, statement };
    }
    const breakRecord = COMMANDS.get("reduc.interromper");
    if (name === localizedName(breakRecord) || name === "break") {
      if (args.length) add("REDUC_ARITY", nameToken, { name, expected: 0, actual: args.length });
      if (!statement) add("REDUC_TYPE", nameToken, { name, expected: "statement", actual: "void" });
      if (!loopDepth && !switchDepth) add("REDUC_CONTEXT", nameToken, { name: "interromper" });
      return { type: "Break", token: nameToken, statement };
    }
    if (record) {
      const parameters = record.signature?.parameters || [];
      if (args.length !== parameters.length) add("REDUC_ARITY", nameToken, { name, expected: parameters.length, actual: args.length });
      parameters.forEach((parameter, index) => {
        const arg = args[index]; if (!arg) return;
        if (arg.valueType !== parameter.type) add("REDUC_TYPE", arg.token, { name: parameter.name, expected: parameter.type, actual: arg.valueType || "unknown" }, "error", arg.endToken);
        if (parameter.name === "componentName" && arg.type === "Literal" && arg.valueType === "string") {
          const component = componentInventory.find((item) => String(item.name || item.codeName) === arg.value);
          if (!component) add("COMPONENT_MISSING", arg.token, { componentName: arg.value }, "error", arg.endToken);
          else if ((component.apiTypeId || component.typeId || component.partId) && (component.apiTypeId || component.typeId || component.partId) !== record.componentType) add("COMPONENT_WRONG_TYPE", arg.token, { componentName: arg.value, componentType: record.componentType }, "error", arg.endToken);
        }
      });
      if (!statement && (record.signature?.returns || "void") === "void") add("REDUC_TYPE", nameToken, { name, expected: "value", actual: "void" });
      return { type: "CommandCall", command: record, args, returnType: record.signature?.returns || "void", token: nameToken, statement };
    }
    const callable = functions.get(name);
    if (callable) {
      const required = callable.parameters.filter((parameter) => !parameter.initial).length;
      if (args.length < required || args.length > callable.parameters.length) add("REDUC_ARITY", nameToken, { name, expected: `${required}-${callable.parameters.length}`, actual: args.length });
      callable.parameters.forEach((param, index) => { const arg = args[index]; if (arg && arg.valueType !== param.valueType) add("REDUC_TYPE", arg.token, { name: param.name, expected: param.valueType, actual: arg.valueType || "unknown" }, "error", arg.endToken); });
      return { type: "UserCall", name, args, returnType: callable.returnType, token: nameToken, statement };
    }
    add("REDUC_UNKNOWN_SYMBOL", nameToken, { name });
    return { type: "UnknownCall", name, args, returnType: "unknown", token: nameToken, statement };
  }

  const PRECEDENCE = { or: 2, and: 3, "==": 4, "!=": 4, "<": 5, "<=": 5, ">": 5, ">=": 5, "+": 6, "-": 6, "*": 7, "/": 7, "%": 7 };
  function parseExpression(minPrecedence = 0) {
    let left = parsePrimary();
    while (true) {
      const op = peek().value;
      const precedence = PRECEDENCE[op];
      if (!precedence || precedence < minPrecedence) break;
      const operator = take(); const right = parseExpression(precedence + 1);
      let resultType = "unknown";
      if (["and", "or"].includes(op)) { resultType = "boolean"; for (const expr of [left, right]) if (expr.valueType !== "boolean") add("REDUC_TYPE", expr.token, { name: op, expected: "boolean", actual: expr.valueType || "unknown" }, "error", expr.endToken); }
      else if (["==", "!="].includes(op)) { resultType = "boolean"; if (left.valueType !== right.valueType) add("REDUC_TYPE", right.token, { name: op, expected: left.valueType || "same type", actual: right.valueType || "unknown" }, "error", right.endToken); }
      else if (["<", "<=", ">", ">="].includes(op)) { resultType = "boolean"; for (const expr of [left, right]) if (expr.valueType !== "number") add("REDUC_TYPE", expr.token, { name: op, expected: "number", actual: expr.valueType || "unknown" }, "error", expr.endToken); }
      else if (op === "+" && left.valueType === "string" && right.valueType === "string") resultType = "string";
      else { resultType = "number"; for (const expr of [left, right]) if (expr.valueType !== "number") add("REDUC_TYPE", expr.token, { name: op, expected: "number", actual: expr.valueType || "unknown" }, "error", expr.endToken); }
      if (["/", "%"].includes(op) && right.type === "Literal" && right.value === 0) add("REDUC_ZERO_DIVISOR", right.token, {}, "error", right.endToken);
      left = { type: "Binary", operator: op, left, right, valueType: resultType, token: left.token, endToken: right.endToken || right.token };
    }
    return left;
  }

  function parsePrimary() {
    const token = take();
    if (token.type === "operator" && token.value === "!") { const value = parsePrimary(); if (value.valueType !== "boolean") add("REDUC_TYPE", value.token, { name: "!", expected: "boolean", actual: value.valueType || "unknown" }, "error", value.endToken); return { type: "Unary", operator: "!", value, valueType: "boolean", token, endToken: value.endToken || value.token }; }
    if (token.type === "operator" && token.value === "-") { const value = parsePrimary(); add("REDUC_UNSUPPORTED_NEGATIVE_LITERAL", token, {}, "error", value.endToken || token); return { type: "Unary", operator: "-", value, valueType: "number", token, endToken: value.endToken || token }; }
    if (token.type === "number") return { type: "Literal", value: token.value, valueType: "number", token, endToken: token };
    if (token.type === "string") return { type: "Literal", value: token.value, valueType: "string", token, endToken: token };
    if (token.type === "keyword" && token.value.startsWith("literal:")) return { type: "Literal", value: token.value.endsWith("true"), valueType: "boolean", token, endToken: token };
    if (token.value === "(") { const value = parseExpression(0); const end = expect(")"); value.endToken = end; return value; }
    if (token.type === "identifier") {
      if (consume("(")) { const args = parseArgumentsAfterOpen(); return makeCall(token, args, false); }
      const variable = getVariable(token.value);
      if (!variable) add("REDUC_UNKNOWN_SYMBOL", token, { name: token.value });
      return { type: "Identifier", name: token.value, valueType: variable?.type || "unknown", token, endToken: token };
    }
    add("REDUC_SYNTAX", token, { syntax: "expression" });
    return { type: "Literal", value: null, valueType: "unknown", token, endToken: token };
  }

  function skipToLineEnd() { while (!["NEWLINE", "EOF"].includes(peek().type)) take(); }

  const ast = parseProgram();
  validateFunctionReturns(ast);
  const errors = diagnostics.some((diagnostic) => diagnostic.severity !== "warning");
  const generated = errors ? "" : emitProgram(ast);
  const conversion = errors ? { source: "", warnings: [] } : emitConvertedJsProgram(ast);
  return { ok: !errors, diagnostics, ast: errors ? undefined : ast, generatedSource: generated, convertedJavaScriptSource: conversion.source, conversionWarnings: conversion.warnings, sourceMap: errors ? [] : generated.split("\n").map((_, index) => ({ generatedLine: index + 1, source: sourceMapEntryForLine(ast, index + 1) })).filter((row) => row.source) };

  function validateFunctionReturns(program) {
    for (const declaration of program.declarations) {
      if (declaration.kind !== "function") continue;
      const alwaysReturns = (body) => {
        for (const statement of body || []) {
          if (statement.type === "Return") return true;
          if (statement.type === "If" && statement.alternate && alwaysReturns(statement.consequent) && alwaysReturns(statement.alternate)) return true;
        }
        return false;
      };
      if (!alwaysReturns(declaration.body)) add("REDUC_MISSING_RETURN", declaration.nameToken || declaration.token, { name: declaration.name });
      for (const statement of declaration.body) if (statement.type === "Return" && (!statement.expression || statement.expression.valueType !== declaration.returnType)) {
        if (statement.expression) add("REDUC_TYPE", statement.expression.token, { name: "return", expected: declaration.returnType, actual: statement.expression.valueType || "unknown" }, "error", statement.expression.endToken);
      }
    }
  }

  function emitProgram(program) {
    const lines = ["// Generated locally from rEduc v2. This artifact is not executed by the editor.", "export async function main(__reduc, __debug = { pause: async () => {} }) {"];
    const sources = [];
    writeGenerated = (text, node, indent = "  ") => { lines.push(`${indent}${text}`); sources.push({ generatedLine: lines.length, source: node?.token ? point(node.token.line, node.token.column) : null }); };
    for (const declaration of program.globals) writeGenerated(`let ${safeName(declaration.name)} = ${declaration.initial ? emitExpr(declaration.initial) : DEFAULTS[declaration.valueType]};`, declaration);
    for (const declaration of program.declarations) {
      const args = declaration.parameters.map((parameter) => `${safeName(parameter.name)}${parameter.initial ? ` = ${emitExpr(parameter.initial)}` : ""}`).join(", ");
      writeGenerated(`async function ${safeName(declaration.name)}(${args}) {`, declaration);
      for (const statement of declaration.body) emitStatement(statement, "  ");
      writeGenerated("}", declaration);
    }
    for (const statement of program.body) emitStatement(statement, "  ");
    lines.push("}");
    emitProgram.sourceRows = sources;
    return lines.join("\n");
  }

  function emitStatement(node, indent) {
    if (!node) return;
    if (node.type === "VariableDeclaration") { writeGenerated(`${indent}let ${safeName(node.name)} = ${node.initial ? emitExpr(node.initial) : DEFAULTS[node.valueType]};`, node, ""); return; }
    if (node.type === "Assignment") { writeGenerated(`${indent}${safeName(node.name)} = ${emitExpr(node.expression)};`, node, ""); return; }
    if (node.type === "CommandCall" || node.type === "UserCall") {
      const call = node.type === "CommandCall" ? `${node.command.javascriptLowering}(${node.args.map(emitExpr).join(", ")})` : `${safeName(node.name)}(${node.args.map(emitExpr).join(", ")})`;
      const asynchronous = node.type === "UserCall" || node.type === "CommandCall" && String(node.command.execution || "").includes("async-cancellable");
      writeGenerated(`${indent}${asynchronous ? "await " : ""}${call};`, node, ""); return;
    }
    if (node.type === "Break") { writeGenerated(`${indent}break;`, node, ""); return; }
    if (node.type === "Continue") { writeGenerated(`${indent}continue;`, node, ""); return; }
    if (node.type === "DebugPause") { writeGenerated(`${indent}await __debug.pause();`, node, ""); return; }
    if (node.type === "Return") { writeGenerated(`${indent}return${node.expression ? ` ${emitExpr(node.expression)}` : ""};`, node, ""); return; }
    if (node.type === "If") {
      writeGenerated(`${indent}if (${emitExpr(node.condition)}) {`, node, ""); node.consequent.forEach((child) => emitStatement(child, `${indent}  `));
      if (!node.alternate) writeGenerated(`${indent}}`, node, "");
      else { writeGenerated(`${indent}} else {`, node, ""); node.alternate.forEach((child) => emitStatement(child, `${indent}  `)); writeGenerated(`${indent}}`, node, ""); }
      return;
    }
    if (node.type === "While" || node.type === "DoWhile") {
      if (node.type === "While") { writeGenerated(`${indent}while (${emitExpr(node.condition)}) {`, node, ""); node.body.forEach((child) => emitStatement(child, `${indent}  `)); writeGenerated(`${indent}}`, node, ""); }
      else { writeGenerated(`${indent}do {`, node, ""); node.body.forEach((child) => emitStatement(child, `${indent}  `)); writeGenerated(`${indent}} while (${emitExpr(node.condition)});`, node, ""); }
      return;
    }
    if (node.type === "For") { writeGenerated(`${indent}for (${safeName(node.name)} = ${emitExpr(node.from)}; ${emitExpr(node.step)} >= 0 ? ${safeName(node.name)} <= ${emitExpr(node.to)} : ${safeName(node.name)} >= ${emitExpr(node.to)}; ${safeName(node.name)} += ${emitExpr(node.step)}) {`, node, ""); node.body.forEach((child) => emitStatement(child, `${indent}  `)); writeGenerated(`${indent}}`, node, ""); return; }
    if (node.type === "Repeat") { const temp = `__repeat_${node.token.line}_${node.token.column}`; writeGenerated(`${indent}for (let ${temp} = 0; ${temp} < ${emitExpr(node.count)}; ${temp} += 1) {`, node, ""); node.body.forEach((child) => emitStatement(child, `${indent}  `)); writeGenerated(`${indent}}`, node, ""); }
    if (node.type === "Switch") { writeGenerated(`${indent}switch (${emitExpr(node.expression)}) {`, node, ""); node.cases.forEach((entry) => { writeGenerated(`${indent}  case ${JSON.stringify(entry.value)}:`, entry, ""); entry.body.forEach((child) => emitStatement(child, `${indent}    `)); writeGenerated(`${indent}    break;`, entry, ""); }); if (node.defaultBody) { writeGenerated(`${indent}  default:`, node, ""); node.defaultBody.forEach((child) => emitStatement(child, `${indent}    `)); writeGenerated(`${indent}    break;`, node, ""); } writeGenerated(`${indent}}`, node, ""); }
  }

  function emitExpr(node) {
    if (!node) return "undefined";
    if (node.type === "Literal") return typeof node.value === "string" ? JSON.stringify(node.value) : String(node.value);
    if (node.type === "Identifier") return safeName(node.name);
    if (node.type === "Binary") return `(${emitExpr(node.left)} ${node.operator === "and" ? "&&" : node.operator === "or" ? "||" : node.operator} ${emitExpr(node.right)})`;
    if (node.type === "Unary") return `(${node.operator}${emitExpr(node.value)})`;
    if (node.type === "CommandCall") return `${node.command.javascriptLowering}(${node.args.map(emitExpr).join(", ")})`;
    if (node.type === "UserCall") return `(await ${safeName(node.name)}(${node.args.map(emitExpr).join(", ")}))`;
    return "undefined";
  }

  function sourceMapEntryForLine(program, generatedLine) {
    return emitProgram.sourceRows?.find((row) => row.generatedLine === generatedLine)?.source || null;
  }

  function emitConvertedJsProgram(program) {
    const lines = ["async function main(robot) {"];
    const warnings = [];
    const warned = new Set();
    let needsManual = false;
    const write = (text, indent = "  ") => lines.push(`${indent}${text}`);
    const warn = (record, node, reason) => {
      const key = `${record.commandId}:${reason}`;
      if (warned.has(key)) return;
      warned.add(key);
      warnings.push({ code: "REDUC_JS_CONVERSION_WARNING", severity: "warning", params: { command: localizedName(record), reason }, start: point(node.token?.line || 1, node.token?.column || 1), end: point(node.token?.line || 1, (node.token?.endColumn || node.token?.column || 1) + 1) });
    };
    const jsCall = (node) => {
      const record = node.command;
      const args = node.args || [];
      const arg = (index) => emitConvertedExpr(args[index]);
      const component = () => `robot.component(${arg(0)})`;
      const id = record.commandId;
      const calls = {
        "reduc.abrir_console": () => "robot.console.open()",
        "reduc.escrever": () => `robot.console.print(${arg(0)})`,
        "reduc.escrever_linha": () => `robot.console.println(${arg(0)})`,
        "reduc.limpar_console": () => "robot.console.clear()",
        "reduc.aleatorio": () => `robot.random(${arg(0)}, ${arg(1)})`,
        "reduc.limitar": () => `robot.clamp(${arg(0)}, ${arg(1)}, ${arg(2)})`,
        "reduc.mapeamento": () => `robot.map(${args.map((_, index) => arg(index)).join(", ")})`,
        "reduc.arredondar": () => `robot.round(${arg(0)}, ${arg(1)})`,
        "reduc.modulo": () => `Math.abs(${arg(0)})`,
        "reduc.resto": () => `(((${arg(0)} % ${arg(1)}) + ${arg(1)}) % ${arg(1)})`,
        "reduc.virar_numero": () => `robot.toNumber(${arg(0)})`,
        "reduc.virar_booleano": () => `robot.toBoolean(${arg(0)})`,
        "reduc.virar_texto": () => `String(${arg(0)})`,
        "reduc.concatenar": () => `(String(${arg(0)}) + String(${arg(1)}))`,
        "reduc.pi": () => "Math.PI",
        "reduc.raiz_quadrada": () => `Math.sqrt(${arg(0)})`,
        "reduc.seno": () => `Math.sin((${arg(0)} * Math.PI) / 180)`,
        "reduc.cosseno": () => `Math.cos((${arg(0)} * Math.PI) / 180)`,
        "reduc.tangente": () => `Math.tan((${arg(0)} * Math.PI) / 180)`,
        "reduc.arco_seno": () => `(Math.asin(${arg(0)}) * 180) / Math.PI`,
        "reduc.arco_cosseno": () => `(Math.acos(${arg(0)}) * 180) / Math.PI`,
        "reduc.arco_tangente": () => `(Math.atan(${arg(0)}) * 180) / Math.PI`,
        "reduc.bussola": () => "robot.compassDeg",
        "reduc.direcao": () => "robot.compassDeg",
        "reduc.inclinacao": () => "robot.inclinationDeg",
        "reduc.velocidade": () => "robot.speed",
        "reduc.carimbo_hora": () => "Date.now() / 1000",
        "reduc.carimbo_milissegundo": () => "Date.now()",
        "reduc.esperar": () => `robot.wait(${arg(0)})`,
        "reduc.pausa": () => `robot.wait(${arg(0)})`,
        "reduc.colorido": () => `${component()}.seesNonBlack`,
        "reduc.cor_azul": () => `${component()}.color.b`,
        "reduc.cor_verde": () => `${component()}.color.g`,
        "reduc.cor_vermelho": () => `${component()}.color.r`,
        "reduc.luminosidade": () => { warn(record, node, "luminosity"); return `(0.2126 * ${component()}.color.r + 0.7152 * ${component()}.color.g + 0.0722 * ${component()}.color.b)`; },
        "reduc.luz": () => { warn(record, node, "luminosity"); return `(0.2126 * ${component()}.color.r + 0.7152 * ${component()}.color.g + 0.0722 * ${component()}.color.b)`; },
        "reduc.cor": () => { warn(record, node, "color-name"); needsManual = true; return `__manualConversion(${JSON.stringify(localizedName(record))})`; },
        "reduc.definir_motor": () => { warn(record, node, "motor-force"); return `${component()}.setTargetVelocity(${arg(2)})`; },
        "reduc.motor": () => `${component()}.setTargetVelocity(${arg(1)})`,
        "reduc.angulo_motor": () => `${component()}.angleDeg`,
        "reduc.velocidade_motor": () => `${component()}.velocityDegPerSecond`,
        "reduc.velocidade_alvo_motor": () => `${component()}.targetDegPerSecond`,
        "reduc.forca_motor": () => { warn(record, node, "motor-force-reading"); needsManual = true; return `__manualConversion(${JSON.stringify(localizedName(record))})`; },
        "reduc.travar_motor": () => `(${arg(1)} ? ${component()}.lock() : ${component()}.unlock())`,
        "reduc.ligar_caneta": () => `${component()}.turnOn({ r: ${arg(1)}, g: ${arg(2)}, b: ${arg(3)} })`,
        "reduc.desligar_caneta": () => `${component()}.turnOff()`,
        "reduc.apagar_caneta": () => `${component()}.clear()`,
        "reduc.ligar_luz": () => `${component()}.turnOn({ r: ${arg(1)}, g: ${arg(2)}, b: ${arg(3)} })`,
        "reduc.desligar_luz": () => `${component()}.turnOff()`,
        "reduc.esta_tocando": () => `${component()}.playing`,
        "reduc.tocar_frequencia": () => `${component()}.playHz(${arg(1)})`,
        "reduc.tocar_nota": () => `${component()}.playNote(${arg(1)})`,
        "reduc.parar_som": () => `${component()}.stop()`,
        "reduc.tem_algo": () => `${component()}.hit`,
        "reduc.ultra_ve_algo": () => `${component()}.hit`,
        "reduc.ultra": () => `${component()}.distance`,
        "reduc.ultrassonico": () => `${component()}.distance`,
        "reduc.toque": () => `${component()}.contact`
      };
      const call = calls[id];
      if (!call) { warn(record, node, "manual-review"); needsManual = true; return { source: `__manualConversion(${JSON.stringify(localizedName(record))})`, asynchronous: false }; }
      return { source: call(), asynchronous: String(record.execution || "").includes("async-cancellable") };
    };
    const emitConvertedExpr = (node) => {
      if (!node) return "undefined";
      if (node.type === "Literal") return typeof node.value === "string" ? JSON.stringify(node.value) : String(node.value);
      if (node.type === "Identifier") return safeName(node.name);
      if (node.type === "Binary") return `(${emitConvertedExpr(node.left)} ${node.operator === "and" ? "&&" : node.operator === "or" ? "||" : node.operator} ${emitConvertedExpr(node.right)})`;
      if (node.type === "Unary") return `(${node.operator}${emitConvertedExpr(node.value)})`;
      if (node.type === "CommandCall") return jsCall(node).source;
      if (node.type === "UserCall") return `(await ${safeName(node.name)}(${node.args.map(emitConvertedExpr).join(", ")}))`;
      return "undefined";
    };
    const emitStatement = (node, indent = "  ") => {
      if (!node) return;
      if (node.type === "VariableDeclaration") { write(`let ${safeName(node.name)} = ${node.initial ? emitConvertedExpr(node.initial) : DEFAULTS[node.valueType]};`, indent); return; }
      if (node.type === "Assignment") { write(`${safeName(node.name)} = ${emitConvertedExpr(node.expression)};`, indent); return; }
      if (node.type === "CommandCall") { const call = jsCall(node); write(`${call.asynchronous ? "await " : ""}${call.source};`, indent); return; }
      if (node.type === "UserCall") { write(`await ${safeName(node.name)}(${node.args.map(emitConvertedExpr).join(", ")});`, indent); return; }
      if (node.type === "Break") { write("break;", indent); return; }
      if (node.type === "Continue") { write("continue;", indent); return; }
      if (node.type === "DebugPause") { write("await robot.debug.pause();", indent); return; }
      if (node.type === "Return") { write(`return${node.expression ? ` ${emitConvertedExpr(node.expression)}` : ""};`, indent); return; }
      if (node.type === "If") { write(`if (${emitConvertedExpr(node.condition)}) {`, indent); node.consequent.forEach((child) => emitStatement(child, `${indent}  `)); if (node.alternate) { write("} else {", indent); node.alternate.forEach((child) => emitStatement(child, `${indent}  `)); } write("}", indent); return; }
      if (node.type === "While") { write(`while (${emitConvertedExpr(node.condition)}) {`, indent); node.body.forEach((child) => emitStatement(child, `${indent}  `)); write("}", indent); return; }
      if (node.type === "DoWhile") { write("do {", indent); node.body.forEach((child) => emitStatement(child, `${indent}  `)); write(`} while (${emitConvertedExpr(node.condition)});`, indent); return; }
      if (node.type === "For") { const name = safeName(node.name); write(`for (${name} = ${emitConvertedExpr(node.from)}; ${emitConvertedExpr(node.step)} >= 0 ? ${name} <= ${emitConvertedExpr(node.to)} : ${name} >= ${emitConvertedExpr(node.to)}; ${name} += ${emitConvertedExpr(node.step)}) {`, indent); node.body.forEach((child) => emitStatement(child, `${indent}  `)); write("}", indent); return; }
      if (node.type === "Repeat") { const temporary = `__repeat_${node.token.line}_${node.token.column}`; write(`for (let ${temporary} = 0; ${temporary} < ${emitConvertedExpr(node.count)}; ${temporary} += 1) {`, indent); node.body.forEach((child) => emitStatement(child, `${indent}  `)); write("}", indent); return; }
      if (node.type === "Switch") { write(`switch (${emitConvertedExpr(node.expression)}) {`, indent); node.cases.forEach((entry) => { write(`case ${JSON.stringify(entry.value)}:`, `${indent}  `); entry.body.forEach((child) => emitStatement(child, `${indent}    `)); write("break;", `${indent}  `); }); if (node.defaultBody) { write("default:", `${indent}  `); node.defaultBody.forEach((child) => emitStatement(child, `${indent}    `)); write("break;", `${indent}  `); } write("}", indent); }
    };
    if (program.globals.length) {
      for (const declaration of program.globals) emitStatement(declaration);
    }
    const manualHelperLine = lines.length;
    for (const declaration of program.declarations) {
      const args = declaration.parameters.map((parameter) => `${safeName(parameter.name)}${parameter.initial ? ` = ${emitConvertedExpr(parameter.initial)}` : ""}`).join(", ");
      write(`async function ${safeName(declaration.name)}(${args}) {`);
      declaration.body.forEach((statement) => emitStatement(statement));
      write("}");
    }
    program.body.forEach((statement) => emitStatement(statement));
    if (needsManual) lines.splice(manualHelperLine, 0, "  const __manualConversion = (command) => { throw command; };");
    write("}", "");
    const source = lines.join("\n");
    if (byteLength(source) > MAX_SOURCE_BYTES) return { source: "", warnings: [] };
    return { source, warnings };
  }
}

function safeName(name) { return /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(String(name)) ? name : "invalidIdentifier"; }

function lex(source, keywords, add) {
  const tokens = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const emit = (type, value, raw, line, column, endColumn) => tokens.push({ type, value, raw, line, column, endColumn });
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]; const lineNo = lineIndex + 1;
    let offset = 0;
    while (line[offset] === " " || line[offset] === "\t") offset++;
    const remainder = line.slice(offset);
    if (!remainder.trim() || remainder.startsWith("#") || remainder.startsWith("//")) { emit("NEWLINE", "\n", "\n", lineNo, line.length + 1, line.length + 1); continue; }
    let i = offset;
    while (i < line.length) {
      const char = line[i];
      if (char === " " || char === "\t") { i++; continue; }
      if (char === "#" || line.slice(i, i + 2) === "//") break;
      const start = i;
      if (/[A-Za-z_]/.test(char)) {
        i++; while (i < line.length && /[A-Za-z0-9_]/.test(line[i])) i++;
        const raw = line.slice(start, i); const keyword = keywords.get(raw);
        emit(keyword ? "keyword" : "identifier", keyword || raw, raw, lineNo, start + 1, i + 1); continue;
      }
      if (/[0-9]/.test(char)) {
        i++; while (i < line.length && /[0-9]/.test(line[i])) i++;
        if (line[i] === "." && /[0-9]/.test(line[i + 1] || "")) { i++; while (i < line.length && /[0-9]/.test(line[i])) i++; }
        if (/[eE]/.test(line[i] || "")) { const exp = i++; if (/[+-]/.test(line[i] || "")) i++; if (!/[0-9]/.test(line[i] || "")) i = exp; else while (/[0-9]/.test(line[i] || "")) i++; }
        const raw = line.slice(start, i); const value = Number(raw);
        if (!Number.isFinite(value)) add("REDUC_NONFINITE", { line: lineNo, column: start + 1, endColumn: i + 1 }, { name: raw });
        emit("number", Number.isFinite(value) ? value : 0, raw, lineNo, start + 1, i + 1); continue;
      }
      if (char === '"') {
        i++; let decoded = ""; let closed = false;
        while (i < line.length) { const current = line[i++]; if (current === '"') { closed = true; break; } if (current === "\\") { const next = line[i++]; const escapes = { "\\": "\\", '"': '"', n: "\n", r: "\r", t: "\t" }; if (!(next in escapes)) add("REDUC_LEXICAL", { line: lineNo, column: i, endColumn: i + 1 }, { name: next || "" }); decoded += escapes[next] ?? ""; } else decoded += current; }
        if (!closed) add("REDUC_LEXICAL", { line: lineNo, column: start + 1, endColumn: line.length + 1 }, { name: "unterminated string" });
        if (byteLength(decoded) > 65536) add("REDUC_RANGE", { line: lineNo, column: start + 1, endColumn: i + 1 }, { name: "string literal" });
        emit("string", decoded, line.slice(start, i), lineNo, start + 1, i + 1); continue;
      }
      const pair = line.slice(i, i + 2);
      if (["==", "!=", "<=", ">="].includes(pair)) { i += 2; emit("operator", pair, pair, lineNo, start + 1, i + 1); continue; }
      if ("+-*/%<>!=".includes(char)) { i++; emit("operator", char, char, lineNo, start + 1, i + 1); continue; }
      if ("(){}:,".includes(char)) { i++; emit("punctuation", char, char, lineNo, start + 1, i + 1); continue; }
      if (char === ";") add("REDUC_SYNTAX", { line: lineNo, column: start + 1, endColumn: start + 2 }, { syntax: "newline; semicolons are unsupported" });
      else add("REDUC_LEXICAL", { line: lineNo, column: start + 1, endColumn: start + 2 }, { name: char });
      i++;
    }
    emit("NEWLINE", "\n", "\n", lineNo, line.length + 1, line.length + 1);
  }
  emit("EOF", "EOF", "", lines.length, (lines.at(-1) || "").length + 1, (lines.at(-1) || "").length + 1);
  return tokens;
}

export { compileReduc };
