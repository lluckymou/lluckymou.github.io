import { ReducCommands, ReducGrammar, RobotComponentApi, RobotGlobalApi } from "./programming-api-registry.generated.js?imp-ux-03-blockly-drawer-controls-20261101-1";
import { blockCommandToolboxContents, blockVariableToolboxContents, refreshBlockVariableSelectors, registerBlockDefinitions, restoreBlockComponentReferences } from "./blocks-compiler.js?imp-ux-03-blockly-drawer-controls-20261101-1";

const MONACO_ROOT = new URL("./vendor/monaco-editor-0.57.0/esm-browser-20261029-1/", import.meta.url);
const BLOCKLY_ROOT = new URL("./vendor/blockly-13.4.0/", import.meta.url);
const BLOCKLY_DISPLAY_SCALE = 0.82;

let monacoPromise = null;
let activeMonaco = null;
let blocklyPromise = null;
let activeEditor = null;
let activeWorkspace = null;
let activeBlockly = null;
let activeBlockUiTranslate = (key) => key;
let activeOverflowWidgetsNode = null;
let activeMonacoFindObserver = null;
let activeViewKey = "";
let activeSubscription = null;
let activeToolboxCloseObserver = null;
let activeToolboxCloseMutationObserver = null;
let activeToolboxCloseLayout = () => {};
let activeToolboxRequestedVisible = true;
let suppressTextChanges = false;
const models = new Map();
const editorViewStates = new Map();
const scripts = new Map();
const blocklyMessageCatalogs = new Map();
const registeredLanguageIds = new Set();
let apiProvidersRegistered = false;
let activeProgramApiContext = { locale: "pt-BR", componentInventory: () => [], translate: (key) => key, diagnostics: () => [] };

function translatedFindLabel(value) {
  const labels = [
    ["monacoFindDialogLabel", ["Find / Replace", "Localizar / Substituir"]],
    ["monacoFindLabel", ["Find", "Localizar"]],
    ["monacoPreviousMatch", ["Previous Match", "Find Previous", "Find Previous Match", "Correspondência anterior"]],
    ["monacoNextMatch", ["Next Match", "Find Next", "Find Next Match", "Próxima correspondência"]],
    ["monacoFindInSelection", ["Find in Selection", "Localizar na seleção"]],
    ["monacoClose", ["Close", "Fechar"]],
    ["monacoReplaceLabel", ["Replace", "Substituir"]],
    ["monacoReplaceAll", ["Replace All", "Substituir tudo"]],
    ["monacoToggleReplace", ["Toggle Replace", "Alternar substituição"]]
  ];
  const source = String(value || "");
  for (const [key, originals] of labels) {
    const localized = String(activeProgramApiContext.translate(key) || key);
    for (const original of originals) {
      if (source === original || source.startsWith(`${original} (`)) return `${localized}${source.slice(original.length)}`;
    }
    if (source === localized || source.startsWith(`${localized} (`)) return source;
  }
  return source;
}

function localizeMonacoFindWidget() {
  const roots = [activeEditor?.getDomNode?.(), activeOverflowWidgetsNode].filter(Boolean);
  if (!roots.length) return;
  const translate = activeProgramApiContext.translate || ((key) => key);
  const widget = roots.map((root) => root.querySelector(".find-widget")).find(Boolean);
  if (!widget) return;
  const setAttribute = (element, name, value) => {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  const dialogLabel = String(translate("monacoFindDialogLabel") || "Find / Replace");
  setAttribute(widget, "aria-label", dialogLabel);
  for (const input of widget.querySelectorAll(".find-part input")) {
    setAttribute(input, "aria-label", String(translate("monacoFindLabel") || "Find"));
    setAttribute(input, "placeholder", String(translate("monacoFindLabel") || "Find"));
  }
  for (const input of widget.querySelectorAll(".replace-part input")) {
    setAttribute(input, "aria-label", String(translate("monacoReplaceLabel") || "Replace"));
    setAttribute(input, "placeholder", String(translate("monacoReplaceLabel") || "Replace"));
  }
  for (const element of widget.querySelectorAll("[aria-label], [title]")) {
    const ariaLabel = element.getAttribute("aria-label");
    const title = element.getAttribute("title");
    const localizedAriaLabel = translatedFindLabel(ariaLabel);
    const localizedTitle = translatedFindLabel(title);
    if (ariaLabel && localizedAriaLabel !== ariaLabel) {
      setAttribute(element, "aria-label", localizedAriaLabel);
      if (!title) setAttribute(element, "title", localizedAriaLabel);
    }
    if (title && localizedTitle !== title) setAttribute(element, "title", localizedTitle);
  }
  const matches = widget.querySelector(".matchesCount");
  if (matches) {
    const label = String(matches.textContent || "").trim();
    if (["No results", "Nenhum resultado", String(translate("monacoNoResults") || "No results")].includes(label)) {
      const localized = String(translate("monacoNoResults") || "No results");
      if (matches.textContent !== localized) matches.textContent = localized;
    } else {
      const location = label.match(/^([?\d]+)\s+(?:of|de)\s+([\d]+\+?)$/);
      if (location) {
        const localized = String(translate("monacoMatchesLocation", { current: location[1], total: location[2] }) || `${location[1]} of ${location[2]}`);
        if (matches.textContent !== localized) matches.textContent = localized;
      }
    }
    if (matches.title) matches.title = String(translate("monacoMatchesLimitTitle") || matches.title);
  }
  for (const root of roots) {
    for (const hover of root.querySelectorAll(".monaco-hover [aria-label], .monaco-hover [title]")) {
      const label = hover.getAttribute("aria-label") || hover.getAttribute("title");
      if (!label) continue;
      const localized = translatedFindLabel(label);
      if (localized !== label) {
        if (hover.hasAttribute("aria-label")) setAttribute(hover, "aria-label", localized);
        if (hover.hasAttribute("title")) setAttribute(hover, "title", localized);
      }
    }
    for (const hover of root.querySelectorAll(".monaco-hover .hover-contents")) {
      const original = String(hover.textContent || "").trim();
      const localized = translatedFindLabel(original);
      if (localized !== original) hover.textContent = localized;
    }
  }
}

export function refreshProgramEditorLocale() {
  localizeMonacoFindWidget();
  const closeButton = activeWorkspace?.getInjectionDiv?.()?.querySelector(".blockly-mobile-toolbox-close");
  if (closeButton) {
    const label = String(activeBlockUiTranslate("programBlocksClose") || "Close block panel");
    closeButton.setAttribute("aria-label", label);
    closeButton.title = label;
  }
}

function ensureMonacoStylesheet() {
  const href = new URL("./vendor/monaco-editor-0.57.0/min/vs/editor/editor.main.css", import.meta.url).href;
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href === href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

async function loadMonaco() {
  if (monacoPromise) return monacoPromise;
  monacoPromise = (async () => {
    ensureMonacoStylesheet();
    globalThis.MonacoEnvironment = {
      getWorker(_moduleId, label) {
        const workerPath = "vs/editor/editor.worker.js";
        return new Worker(new URL(workerPath, MONACO_ROOT), {
          type: "module",
          name: `sbotics-monaco-${label || "editor"}`
        });
      }
    };

    const monaco = await import(new URL("vs/editor.js", MONACO_ROOT).href);
    await Promise.all([
      import(new URL("vs/languages/definitions/javascript/register.js", MONACO_ROOT).href),
      import(new URL("vs/editor/browser/coreCommands.js", MONACO_ROOT).href),
      import(new URL("vs/features/comment/register.js", MONACO_ROOT).href),
      import(new URL("vs/features/hover/register.js", MONACO_ROOT).href),
      import(new URL("vs/features/multicursor/register.js", MONACO_ROOT).href),
      import(new URL("vs/features/wordOperations/register.js", MONACO_ROOT).href),
      import(new URL("vs/features/find/register.js", MONACO_ROOT).href),
      import(new URL("vs/features/suggest/register.js", MONACO_ROOT).href),
      import(new URL("vs/features/parameterHints/register.js", MONACO_ROOT).href),
      import(new URL("vs/editor/contrib/suggest/browser/suggestController.js", MONACO_ROOT).href)
    ]);
    monaco.editor.setTheme("vs-dark");
    activeMonaco = monaco;
    return monaco;
  })().catch((error) => {
    monacoPromise = null;
    throw error;
  });
  return monacoPromise;
}

function registerReducLanguages(monaco) {
  for (const locale of ["pt-BR", "en-US"]) {
    const languageId = `reduc-${locale === "pt-BR" ? "pt-br" : "en-us"}`;
    if (registeredLanguageIds.has(languageId)) continue;
    const grammarLocale = ReducGrammar.locales[locale];
    const commandNames = ReducCommands.records.map((record) => record.spellings?.[locale]).filter(Boolean);
    monaco.languages.register({ id: languageId, aliases: [`rEduc (${locale})`] });
    monaco.languages.setMonarchTokensProvider(languageId, {
      defaultToken: "",
      tokenPostfix: ".reduc",
      keywords: Object.values(grammarLocale.keywords),
      typeKeywords: Object.values(grammarLocale.types),
      literals: Object.values(grammarLocale.literals),
      commandNames,
      tokenizer: {
        root: [
          [/#.*$/, "comment"],
          [/\/\/.*$/, "comment"],
          [/"/, { token: "string.quote", next: "@doubleString" }],
          [/'/, "string.invalid"],
          [/[A-Za-z_][\w]*/, {
            cases: {
              "@keywords": "keyword",
              "@typeKeywords": "type",
              "@literals": "constant.language",
              "@commandNames": "predefined",
              "@default": "identifier"
            }
          }],
          [/(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/, "number"],
          [/[{}()]/, "@brackets"],
          [/(?:<=|>=|==|!=|[!*\/%+\-=<>])/, "operator"],
          [/[,\.]/, "delimiter"],
          [/\s+/, "white"]
        ],
        doubleString: [
          [/[^\\"]+/, "string"],
          [/\\[\\"nrt]/, "string.escape"],
          [/\\./, "string.escape.invalid"],
          [/"/, { token: "string.quote", next: "@pop" }]
        ]
      }
    });
    monaco.languages.setLanguageConfiguration(languageId, {
      comments: { lineComment: "#" },
      brackets: [["{", "}"], ["(", ")"]],
      autoClosingPairs: [{ open: "(", close: ")" }, { open: "{", close: "}" }, { open: "\"", close: "\"" }],
      indentationRules: { increaseIndentPattern: /\{\s*(?:#.*)?$/ }
    });
    registeredLanguageIds.add(languageId);
  }
  if (registeredLanguageIds.has("pythonlike")) return;
  const pythonLikeCommands = ReducCommands.records
    .filter((record) => !["reduc.virar_booleano", "reduc.virar_numero", "reduc.virar_texto", "reduc.interromper"].includes(record.commandId))
    .map((record) => record.pythonLikeSpellings?.["en-US"]).filter(Boolean);
  monaco.languages.register({ id: "pythonlike", aliases: ["python-like"] });
  monaco.languages.setMonarchTokensProvider("pythonlike", {
    defaultToken: "",
    tokenPostfix: ".pythonlike",
    keywords: ["if", "elif", "else", "while", "for", "in", "range", "def", "break", "continue", "pass", "and", "or", "not"],
    literals: ["True", "False"],
    commandNames: pythonLikeCommands,
    tokenizer: {
      root: [
        [/#.*$/, "comment"],
        [/"/, { token: "string.quote", next: "@doubleString" }],
        [/'/, { token: "string.quote", next: "@singleString" }],
        [/[A-Za-z_][\w]*/, { cases: { "@keywords": "keyword", "@literals": "constant.language", "@commandNames": "predefined", "@default": "identifier" } }],
        [/(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/, "number"],
        [/[{}()\[\]]/, "@brackets"],
        [/(?:<=|>=|==|!=|[!*/%+\-=<>])/, "operator"],
        [/[,.:]/, "delimiter"],
        [/\s+/, "white"]
      ],
      doubleString: [[/[^\\"]+/, "string"], [/\\[\\"nrt]/, "string.escape"], [/\\./, "string.escape.invalid"], [/"/, { token: "string.quote", next: "@pop" }]],
      singleString: [[/[^\\']+/, "string"], [/\\[\\'"nrt]/, "string.escape"], [/\\./, "string.escape.invalid"], [/'/, { token: "string.quote", next: "@pop" }]]
    }
  });
  monaco.languages.setLanguageConfiguration("pythonlike", {
    comments: { lineComment: "#" },
    brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
    autoClosingPairs: [{ open: "(", close: ")" }, { open: "[", close: "]" }, { open: "{", close: "}" }, { open: "\"", close: "\"" }, { open: "'", close: "'" }],
    indentationRules: { increaseIndentPattern: /^\s*(?:if|elif|else|while|for|def)\b.*:\s*(?:#.*)?$/ }
  });
  registeredLanguageIds.add("pythonlike");
}

function componentTypeForInventoryItem(item) {
  return RobotComponentApi.types.find((type) => type.typeId === (item?.apiTypeId || item?.typeId)
    || (type.placeableTypeIds || []).includes(item?.partId || item?.typeId)) || null;
}

function signatureForCommand(record, locale, language = "") {
  const spelling = language === "pythonlike" ? record.pythonLikeSpellings?.["en-US"] : record.spellings?.[locale] || record.name;
  const parameters = (record.signature?.parameters || []).map((parameter) => `${parameter.name}:${parameter.type}`).join(", ");
  return `${spelling}(${parameters})${record.signature?.returns && record.signature.returns !== "void" ? `: ${record.signature.returns}` : ""}`;
}

function jsComponentMemberSignature(type, member) {
  const reading = (type?.readings || []).find((item) => item.name === member);
  if (reading) return `${member}: ${reading.type || "value"}`;
  const command = (type?.commands || []).find((item) => item.name === member);
  if (!command) return null;
  const parameters = (command.parameters || []).map((item) => `${item.name}:${item.type || "value"}`).join(", ");
  return `${command.async ? "async " : ""}${member}(${parameters})${command.result ? `: ${command.result}` : ""}`;
}

function jsRootMembers() {
  const duplicateJavaScriptHelpers = new Set(["random", "clamp", "map", "round", "modulo", "toNumber", "toBoolean"]);
  const members = RobotGlobalApi.members.filter((item) => !item.name.includes(".") && !duplicateJavaScriptHelpers.has(item.name)).map((item) => ({ name: item.name, signature: item.signature, detail: item.scheduling === "async-simulation-time" ? "Simulation-time wait" : "Robot API" }));
  if (RobotGlobalApi.members.some((item) => item.name.startsWith("console."))) members.push({ name: "console", signature: "console.log(value), console.warn(value), console.error(value), console.clear()", detail: "Local Robot console" });
  if (RobotGlobalApi.members.some((item) => item.name.startsWith("debug."))) members.push({ name: "debug", signature: "debug.pause()", detail: "Robot debugging" });
  for (const name of ["inclinationDeg", "compassDeg", "speed", "componentNames"]) members.push({ name, signature: `${name}: ${name === "componentNames" ? "readonly string[]" : "number"}`, detail: "Robot reading" });
  members.push({ name: "components", signature: "components[name]", detail: "Named component on the selected Robot" });
  members.push({ name: "component", signature: "component(name:string)", detail: "Validated component lookup" });
  return members;
}

function apiCompletions(monaco, language, model, position) {
  const locale = activeProgramApiContext.locale === "en-US" ? "en-US" : "pt-BR";
  const inventory = (activeProgramApiContext.componentInventory?.() || []).filter((item) => componentTypeForInventoryItem(item)?.nameable !== false);
  const line = model.getLineContent(position.lineNumber);
  const before = line.slice(0, position.column - 1);
  const prefix = model.getWordUntilPosition(position).word;
  const items = [];
  const kind = monaco.languages.CompletionItemKind;
  const add = (label, insertText, detail, completionKind = kind.Function, insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet) => {
    items.push({ label, insertText, detail, kind: completionKind, insertTextRules, range: new monaco.Range(position.lineNumber, position.column - prefix.length, position.lineNumber, position.column) });
  };

  if (language.startsWith("reduc-")) {
    for (const record of ReducCommands.records) {
      if (record.commandId === "reduc.interromper" && locale === "en-US") continue;
      const spelling = record.spellings?.[locale];
      if (!spelling) continue;
      const params = record.signature?.parameters || [];
      const snippets = params.map((parameter, index) => {
        if (parameter.type === "component-name" || parameter.name === "componentName") {
          return `"\${${index + 1}:${(inventory[0]?.name || inventory[0]?.codeName || (locale === "en-US" ? "componentName" : "nomeDoComponente"))}}"`;
        }
        const placeholder = parameter.name || "parameter" + (index + 1);
        return "${" + (index + 1) + ":" + placeholder + "}";
      });
      const snippet = `${spelling}(${snippets.join(", ")})`;
      add(spelling, snippet, signatureForCommand(record, locale, language));
    }
    return { suggestions: items };
  }

  if (language === "pythonlike") {
    for (const record of ReducCommands.records) {
      if (["reduc.virar_booleano", "reduc.virar_numero", "reduc.virar_texto", "reduc.interromper"].includes(record.commandId)) continue;
      const spelling = record.pythonLikeSpellings?.["en-US"];
      if (!spelling) continue;
      const params = record.signature?.parameters || [];
      const snippets = params.map((parameter, index) => {
        if (parameter.name === "componentName") {
          return `"\${${index + 1}:${(inventory[0]?.name || inventory[0]?.codeName || "componentName")}}"`;
        }
        const placeholder = parameter.name || "parameter" + (index + 1);
        return "${" + (index + 1) + ":" + placeholder + "}";
      });
      add(spelling, `${spelling}(${snippets.join(", ")})`, signatureForCommand(record, locale, language));
    }
    return { suggestions: items };
  }

  const componentMember = before.match(/robot\.components\.([A-Za-z_][\w]*)\.$/);
  const quotedComponentMember = before.match(/robot\.component\(\s*"((?:[^"\\]|\\.)*)"\s*\)\.$/);
  const bracketComponentMember = before.match(/robot\.components\[\s*"((?:[^"\\]|\\.)*)"\s*\]\.$/);
  const commandMember = before.match(/robot\.components\.[A-Za-z_][\w]*\.([A-Za-z_]\w*)?$/);
  const quotedCommandMember = before.match(/robot\.component\(\s*"((?:[^"\\]|\\.)*)"\s*\)\.([A-Za-z_]\w*)?$/);
  const bracketCommandMember = before.match(/robot\.components\[\s*"((?:[^"\\]|\\.)*)"\s*\]\.([A-Za-z_]\w*)?$/);
  const consoleMember = before.match(/robot\.console\.([A-Za-z_]\w*)?$/);
  const debugMember = before.match(/robot\.debug\.([A-Za-z_]\w*)?$/);
  const componentPath = componentMember?.[1] || quotedComponentMember?.[1] || bracketComponentMember?.[1];
  if (componentPath) {
    const item = inventory.find((candidate) => String(candidate.name || candidate.codeName) === componentPath);
    const type = componentTypeForInventoryItem(item);
    for (const entry of [...(type?.readings || []), ...(type?.commands || [])]) {
      const signature = jsComponentMemberSignature(type, entry.name);
      const parameters = entry.parameters || [];
      const snippets = parameters.map((parameter, index) => parameter.type === "RGB"
        ? `{ r: \${${index + 1}:255}, g: \${${index + 2}:255}, b: \${${index + 3}:255} }`
        : `\${${index + 1}:${parameter.name}}`);
      const insertText = entry.parameters ? `${entry.name}(${snippets.join(", ")})` : entry.name;
      add(entry.name, insertText, signature || "Robot component member");
    }
    return { suggestions: items };
  }
  if (commandMember || quotedCommandMember || bracketCommandMember) {
    const componentName = quotedCommandMember?.[1] || bracketCommandMember?.[1] || commandMember?.[0]?.match(/robot\.components\.([A-Za-z_][\w]*)/)?.[1];
    const item = inventory.find((candidate) => String(candidate.name || candidate.codeName) === componentName);
    const type = componentTypeForInventoryItem(item);
    for (const entry of [...(type?.readings || []), ...(type?.commands || [])]) {
      const signature = jsComponentMemberSignature(type, entry.name);
      add(entry.name, entry.name, signature || "Robot component member", entry.parameters ? kind.Function : kind.Field, monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet);
    }
    return { suggestions: items };
  }
  if (consoleMember) {
    for (const entry of RobotGlobalApi.members.filter((member) => member.name.startsWith("console."))) {
      const member = entry.name.slice("console.".length);
      const parameters = entry.signature.match(/\((.*?)\)/)?.[1]?.split(", ").filter(Boolean) || [];
      add(member, `${member}(${parameters.length ? "\${1:value}" : ""})`, entry.signature, kind.Function);
    }
    return { suggestions: items };
  }
  if (debugMember) {
    for (const entry of RobotGlobalApi.members.filter((member) => member.name.startsWith("debug."))) {
      const member = entry.name.slice("debug.".length);
      const parameters = entry.signature.match(/\((.*?)\)/)?.[1]?.split(", ").filter(Boolean) || [];
      add(member, `${member}(${parameters.length ? "\${1:value}" : ""})`, entry.signature, kind.Function);
    }
    return { suggestions: items };
  }
  if (/robot\.components\.$/.test(before)) {
    for (const item of inventory) {
      const name = String(item.name || item.codeName || "");
      if (!name) continue;
      add(name, `[${JSON.stringify(name)}]`, componentTypeForInventoryItem(item)?.typeId || "Robot component", kind.Property, monaco.languages.CompletionItemInsertTextRule.None);
    }
    return { suggestions: items };
  }
  if (/robot\.$/.test(before)) {
    for (const member of jsRootMembers()) {
      const name = member.name;
      const insertText = member.name === "components" ? "components" : member.name === "component" ? "component(\${1:name})" : member.name === "console" || member.name === "debug" ? member.name : `${member.name}(\${1})`;
      add(name, insertText, member.signature || member.detail, member.name === "components" || ["inclinationDeg", "compassDeg", "speed", "componentNames"].includes(member.name) ? kind.Property : kind.Function);
    }
    return { suggestions: items };
  }
  if (/(^|[^\w.])robot\.[A-Za-z_]\w*$/.test(before)) {
    for (const member of jsRootMembers()) {
      const insertText = member.name === "console" || member.name === "debug" || member.name === "components" ? member.name
        : member.name === "component" ? "component(\${1:name})"
          : ["inclinationDeg", "compassDeg", "speed", "componentNames"].includes(member.name) ? member.name
            : `${member.name}(\${1})`;
      add(member.name, insertText, member.signature || member.detail, ["console", "debug", "components", "inclinationDeg", "compassDeg", "speed", "componentNames"].includes(member.name) ? kind.Property : kind.Function);
    }
  }
  return { suggestions: items };
}

function signatureHelp(monaco, language, model, position) {
  const locale = activeProgramApiContext.locale === "en-US" ? "en-US" : "pt-BR";
  const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  if (language.startsWith("reduc-")) {
    const match = line.match(/([A-Za-z_]\w*)\s*\(([^()]*)$/);
    if (!match) return null;
    if (locale === "en-US" && line.match(/\bbreak\s*\(/)) return null;
    const record = ReducCommands.records.find((item) => item.spellings?.[locale] === match[1]);
    if (record?.commandId === "reduc.interromper" && locale === "en-US") return null;
    if (!record) return null;
    const parameterCount = match[2].trim() ? match[2].split(",").length : 0;
    return { value: { signatures: [{ label: signatureForCommand(record, locale, language), parameters: (record.signature?.parameters || []).map((parameter, index) => ({ label: `${locale === "en-US" ? "parameter" : "parâmetro"}${index + 1} · ${parameter.name}: ${parameter.type}` })) }], activeSignature: 0, activeParameter: Math.min(parameterCount, Math.max(0, (record.signature?.parameters || []).length - 1)) } };
  }
  if (language === "pythonlike") {
    const match = line.match(/([A-Za-z_]\w*)\s*\(([^()]*)$/);
    if (!match) return null;
    const record = ReducCommands.records.find((item) => item.pythonLikeSpellings?.["en-US"] === match[1]);
    if (!record || ["reduc.virar_booleano", "reduc.virar_numero", "reduc.virar_texto", "reduc.interromper"].includes(record.commandId)) return null;
    const parameterCount = match[2].trim() ? match[2].split(",").length : 0;
    return { value: { signatures: [{ label: signatureForCommand(record, locale, language), parameters: (record.signature?.parameters || []).map((parameter, index) => ({ label: `parameter${index + 1} · ${parameter.name}: ${parameter.type}` })) }], activeSignature: 0, activeParameter: Math.min(parameterCount, Math.max(0, (record.signature?.parameters || []).length - 1)) } };
  }
  const componentCall = line.match(/robot\.components\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(([^()]*)$/)
    || line.match(/robot\.component\(\s*"((?:[^"\\]|\\.)*)"\s*\)\.([A-Za-z_]\w*)\s*\(([^()]*)$/)
    || line.match(/robot\.components\[\s*"((?:[^"\\]|\\.)*)"\s*\]\.([A-Za-z_]\w*)\s*\(([^()]*)$/);
  if (componentCall) {
    const componentName = componentCall[1];
    const methodName = componentCall[2];
    const parameterCount = componentCall[3].trim() ? componentCall[3].split(",").length : 0;
    const component = (activeProgramApiContext.componentInventory?.() || []).find((item) => String(item.name || item.codeName) === componentName);
    const type = componentTypeForInventoryItem(component);
    const command = type?.commands?.find((item) => item.name === methodName);
    if (command) {
      const parameters = command.parameters || [];
      return { value: { signatures: [{ label: jsComponentMemberSignature(type, methodName), parameters: parameters.map((parameter) => ({ label: `${parameter.name}: ${parameter.type || "value"}${parameter.range ? ` ${parameter.range}` : ""}` })) }], activeSignature: 0, activeParameter: Math.min(parameterCount, Math.max(0, parameters.length - 1)) } };
    }
  }
  const match = line.match(/(?:robot\.)?([A-Za-z_]\w*)\s*\(([^()]*)$/);
  if (!match) return null;
  const member = match[1];
  const global = RobotGlobalApi.members.find((item) => item.name.split(".").at(-1) === member && (item.name.includes(".") || jsRootMembers().some((visible) => visible.name === member)));
  if (!global) return null;
  const parameterCount = match[2].trim() ? match[2].split(",").length : 0;
  const parameters = global.signature.match(/\((.*?)\)/)?.[1]?.split(", ").filter(Boolean) || [];
  return { value: { signatures: [{ label: global.signature, parameters: parameters.map((parameter) => ({ label: parameter })) }], activeSignature: 0, activeParameter: Math.min(parameterCount, Math.max(0, parameters.length - 1)) } };
}

function registerProgramApiProviders(monaco) {
  if (apiProvidersRegistered) return;
  for (const locale of ["pt-BR", "en-US"]) {
    const languageId = `reduc-${locale === "pt-BR" ? "pt-br" : "en-us"}`;
    monaco.languages.registerCompletionItemProvider(languageId, { triggerCharacters: ["(", ","], provideCompletionItems: (model, position) => apiCompletions(monaco, languageId, model, position) });
    monaco.languages.registerSignatureHelpProvider(languageId, { signatureHelpTriggerCharacters: ["(", ","], signatureHelpRetriggerCharacters: [","], provideSignatureHelp: (model, position) => signatureHelp(monaco, languageId, model, position) });
    monaco.languages.registerHoverProvider(languageId, { provideHover: (model, position) => hoverForProgramApi(monaco, languageId, model, position) });
  }
  monaco.languages.registerCompletionItemProvider("javascript", { triggerCharacters: [".", "(", '"'], provideCompletionItems: (model, position) => apiCompletions(monaco, "javascript", model, position) });
  monaco.languages.registerSignatureHelpProvider("javascript", { signatureHelpTriggerCharacters: ["(", ","], signatureHelpRetriggerCharacters: [","], provideSignatureHelp: (model, position) => signatureHelp(monaco, "javascript", model, position) });
  monaco.languages.registerHoverProvider("javascript", { provideHover: (model, position) => hoverForProgramApi(monaco, "javascript", model, position) });
  monaco.languages.registerCompletionItemProvider("pythonlike", { triggerCharacters: ["(", ","], provideCompletionItems: (model, position) => apiCompletions(monaco, "pythonlike", model, position) });
  monaco.languages.registerSignatureHelpProvider("pythonlike", { signatureHelpTriggerCharacters: ["(", ","], signatureHelpRetriggerCharacters: [","], provideSignatureHelp: (model, position) => signatureHelp(monaco, "pythonlike", model, position) });
  monaco.languages.registerHoverProvider("pythonlike", { provideHover: (model, position) => hoverForProgramApi(monaco, "pythonlike", model, position) });
  apiProvidersRegistered = true;
}

function hoverForProgramApi(monaco, language, model, position) {
  const wordInfo = model.getWordAtPosition(position);
  const word = wordInfo?.word;
  const locale = activeProgramApiContext.locale === "en-US" ? "en-US" : "pt-BR";
  const diagnostic = (activeProgramApiContext.diagnostics?.() || []).find((item) => {
    const start = item.start || {};
    const end = item.end || start;
    return start.line === position.lineNumber && position.column >= (start.column || 1)
      && position.column <= Math.max(start.column || 1, end.column || (start.column || 1) + 1);
  });
  if (!word && !diagnostic) return null;
  const range = diagnostic
    ? new monaco.Range(diagnostic.start?.line || position.lineNumber, diagnostic.start?.column || position.column, diagnostic.end?.line || diagnostic.start?.line || position.lineNumber, diagnostic.end?.column || diagnostic.start?.column || position.column)
    : new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn);
  if (word && language.startsWith("reduc-")) {
    const legacyRecord = ReducCommands.records.find((item) => item.legacySpellings?.[locale] === word && item.spellings?.[locale] !== word);
    if (legacyRecord) {
      const replacement = legacyRecord.spellings?.[locale] || "";
      return { range, contents: [{ value: activeProgramApiContext.translate("programApiLegacyCommandHover", { replacement }) }] };
    }
  }
  if (diagnostic) {
    const message = activeProgramApiContext.formatDiagnostic?.(diagnostic) || diagnostic.code;
    return { range, contents: [{ value: message }] };
  }
  let signature = null;
  let description = "";
  if (language.startsWith("reduc-")) {
    const legacyRecord = ReducCommands.records.find((item) => item.legacySpellings?.[locale] === word && item.spellings?.[locale] !== word);
    if (legacyRecord) {
      const replacement = legacyRecord.spellings?.[locale] || "";
      return {
        range,
        contents: [{ value: activeProgramApiContext.translate("programApiLegacyCommandHover", { replacement }) }]
      };
    }
    const record = ReducCommands.records.find((item) => item.spellings?.[locale] === word);
    if (record && !(record.commandId === "reduc.interromper" && locale === "en-US")) {
      signature = signatureForCommand(record, locale, language);
      const key = `programApiCommand_${String(record.commandId).replace(/[^A-Za-z0-9]+/g, "_")}`;
      description = activeProgramApiContext.translate(key);
      if (description === key) description = record.semantics || "";
    }
  } else if (language === "pythonlike") {
    const record = ReducCommands.records.find((item) => item.pythonLikeSpellings?.["en-US"] === word);
    if (record && !["reduc.virar_booleano", "reduc.virar_numero", "reduc.virar_texto", "reduc.interromper"].includes(record.commandId)) {
      signature = signatureForCommand(record, locale, language);
      const key = `programApiCommand_${String(record.commandId).replace(/[^A-Za-z0-9]+/g, "_")}`;
      description = activeProgramApiContext.translate(key);
      if (description === key) description = record.semantics || "";
    }
  } else {
    const line = model.getLineContent(position.lineNumber);
    const prefix = line.slice(0, position.column - 1);
    const component = prefix.match(/robot\.components\.([A-Za-z_][\w]*)\.[A-Za-z_\w]*$/) || prefix.match(/robot\.component\(\s*"((?:[^"\\]|\\.)*)"\s*\)\.[A-Za-z_\w]*$/) || prefix.match(/robot\.components\[\s*"((?:[^"\\]|\\.)*)"\s*\]\.([A-Za-z_]\w*)?$/);
    if (component) {
      const name = component[1];
      const item = (activeProgramApiContext.componentInventory?.() || []).find((candidate) => String(candidate.name || candidate.codeName) === name);
      signature = jsComponentMemberSignature(componentTypeForInventoryItem(item), word);
    }
    const global = RobotGlobalApi.members.find((member) => member.name.split(".").at(-1) === word && (prefix.includes("console.") || prefix.includes("debug.") || (prefix.includes("robot.") && (member.name.includes(".") || jsRootMembers().some((visible) => visible.name === word)))));
    if (global) signature = global.signature;
    const root = jsRootMembers().find((member) => member.name === word && prefix.includes("robot."));
    if (root) signature = root.signature || root.detail;
  }
  if (!signature) return null;
  return { range, contents: [{ value: `\`${signature}\`` }, ...(description ? [{ value: description }] : [])] };
}

function textLanguageId(language, locale) {
  if (language === "javascript") return "javascript";
  if (language === "pythonlike") return "pythonlike";
  return `reduc-${locale === "en-US" ? "en-us" : "pt-br"}`;
}

function modelKey(programId, language, locale) {
  return `${programId}:${language}:${language === "reduc" ? locale : ""}`;
}

function modelUri(monaco, programId, language, locale) {
  const fileExtension = language === "javascript" ? "js" : language === "pythonlike" ? "pylike" : "reduc";
  return monaco.Uri.parse(`file:///sbotics/programs/${encodeURIComponent(programId)}.${fileExtension}${language === "reduc" ? `?locale=${locale}` : ""}`);
}

function createTextModel(monaco, { programId, language, locale, source }) {
  const key = modelKey(programId, language, locale);
  let model = models.get(key);
  if (!model || model.isDisposed()) {
    model = monaco.editor.createModel(String(source ?? ""), textLanguageId(language, locale), modelUri(monaco, programId, language, locale));
    models.set(key, model);
  } else {
    monaco.editor.setModelLanguage(model, textLanguageId(language, locale));
    if (model.getValue() !== String(source ?? "")) {
      suppressTextChanges = true;
      model.setValue(String(source ?? ""));
      suppressTextChanges = false;
    }
  }
  return { model, key };
}

function runMonacoAction(editor, actionId) {
  const action = editor?.getAction?.(actionId);
  if (action) void action.run();
  else editor?.trigger?.("sbotics-editor-command", actionId, {});
}

function ensureScript(path) {
  const url = new URL(path, import.meta.url).href;
  if (scripts.has(url)) return scripts.get(url);
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Blockly asset could not be loaded: ${path}`));
    document.head.append(script);
  }).catch((error) => {
    scripts.delete(url);
    throw error;
  });
  scripts.set(url, promise);
  return promise;
}

async function loadBlockly(interfaceLocale) {
  if (!blocklyPromise) {
    blocklyPromise = (async () => {
      await ensureScript("vendor/blockly-13.4.0/blockly.min.js");
      return globalThis.Blockly;
    })().catch((error) => {
      blocklyPromise = null;
      throw error;
    });
  }
  const Blockly = await blocklyPromise;
  const localeFile = interfaceLocale === "en-US" ? "en.js" : "pt-br.js";
  if (!blocklyMessageCatalogs.has(localeFile)) {
    await ensureScript(`vendor/blockly-13.4.0/msg/${localeFile}`);
    blocklyMessageCatalogs.set(localeFile, { ...Blockly.Msg });
  }
  Blockly.setLocale(blocklyMessageCatalogs.get(localeFile));
  return Blockly;
}

function blockNodeFromBlockly(block) {
  const fields = {};
  for (const input of block.inputList || []) {
    for (const field of input.fieldRow || []) {
      if (!field?.name || typeof field.getValue !== "function") continue;
      const value = field.getValue();
      if (["string", "number", "boolean"].includes(typeof value)) fields[field.name] = value;
    }
  }
  const inputs = {};
  for (const input of block.inputList || []) {
    if (!input.name || !input.connection) continue;
    inputs[input.name] = input.connection.targetBlock()
      ? { blockId: input.connection.targetBlock().id }
      : null;
  }
  const node = {
    id: String(block.id),
    typeId: String(block.type),
    fields,
    inputs,
    disabled: !block.isEnabled(),
    collapsed: Boolean(block.isCollapsed())
  };
  const next = block.getNextBlock?.();
  if (next) node.next = String(next.id);
  const comment = block.getCommentText?.();
  if (comment) node.comment = comment;
  const mutation = block.saveExtraState?.();
  if (mutation && typeof mutation === "object") node.mutation = mutation;
  return node;
}

export function blocksDocumentFromWorkspace(workspace, locale = "pt-BR") {
  if (!workspace) return emptyBlocksDocument(locale);
  const allBlocks = workspace.getAllBlocks(false);
  const nodes = allBlocks.map(blockNodeFromBlockly);
  const positionById = {};
  for (const block of workspace.getTopBlocks(false)) {
    const point = block.getRelativeToSurfaceXY?.();
    if (point) positionById[block.id] = { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  }
  const selected = globalThis.Blockly?.common?.getSelected?.() || globalThis.Blockly?.selected;
  return {
    schemaVersion: 1,
    locale: locale === "en-US" ? "en-US" : "pt-BR",
    toolboxVersion: "sbotics-structural-registry-v1",
    blocks: nodes,
    topLevelOrder: workspace.getTopBlocks(false).map((block) => String(block.id)),
    layout: {
      positionById,
      viewport: {
        x: Number(workspace.scrollX) || 0,
        y: Number(workspace.scrollY) || 0,
        scale: (Number(workspace.scale) || BLOCKLY_DISPLAY_SCALE) / BLOCKLY_DISPLAY_SCALE
      },
      ...(selected?.id ? { selectedBlockId: String(selected.id) } : {})
    }
  };
}

export function emptyBlocksDocument(locale = "pt-BR") {
  return {
    schemaVersion: 1,
    locale: locale === "en-US" ? "en-US" : "pt-BR",
    toolboxVersion: "sbotics-structural-registry-v1",
    blocks: [],
    topLevelOrder: [],
    layout: { positionById: {}, viewport: { x: 0, y: 0, scale: 1 } }
  };
}

function serializeBlockNode(blockId, nodeById, seen = new Set()) {
  if (!blockId || seen.has(blockId)) return null;
  const node = nodeById.get(blockId);
  if (!node) return null;
  seen.add(blockId);
  const result = {
    type: node.typeId,
    id: node.id,
    ...(node.fields && Object.keys(node.fields).length ? { fields: node.fields } : {}),
    ...(node.disabled ? { disabled: true } : {}),
    ...(node.collapsed ? { collapsed: true } : {}),
    ...(node.mutation ? { extraState: node.mutation } : {})
  };
  const inputs = {};
  for (const [name, value] of Object.entries(node.inputs || {})) {
    const child = value?.blockId ? serializeBlockNode(value.blockId, nodeById, seen) : null;
    if (child) inputs[name] = { block: child };
  }
  if (Object.keys(inputs).length) result.inputs = inputs;
  const next = node.next ? serializeBlockNode(node.next, nodeById, seen) : null;
  if (next) result.next = { block: next };
  if (node.comment) result.icons = { comment: { text: node.comment } };
  return result;
}

function workspaceStateFromDocument(document, Blockly) {
  const nodes = Array.isArray(document?.blocks) ? document.blocks : [];
  const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
  const childIds = new Set();
  for (const node of nodes) {
    if (node.next) childIds.add(String(node.next));
    for (const input of Object.values(node.inputs || {})) if (input?.blockId) childIds.add(String(input.blockId));
  }
  const order = Array.isArray(document?.topLevelOrder) ? document.topLevelOrder.map(String) : [];
  const roots = [...new Set([...order, ...nodes.filter((node) => !childIds.has(String(node.id))).map((node) => String(node.id))])];
  const serializedBlocks = roots.map((id) => {
    const root = serializeBlockNode(id, nodeById);
    const position = document?.layout?.positionById?.[id];
    if (root && position) {
      root.x = Number(position.x) || 0;
      root.y = Number(position.y) || 0;
    }
    return root;
  }).filter(Boolean);
  return {
    blocks: { languageVersion: Blockly.VERSION || 0, blocks: serializedBlocks }
  };
}

function createBlocklyTheme(Blockly) {
  if (!Blockly.Theme?.defineTheme || !Blockly.Themes?.Classic) return Blockly.Themes?.Classic;
  return Blockly.Theme.defineTheme("sbotics-programming-dark", {
    base: Blockly.Themes.Classic,
    fontStyle: { family: '"Noto Sans", "Noto Color Emoji", sans-serif' },
    componentStyles: {
      workspaceBackgroundColour: "#202930",
      toolboxBackgroundColour: "#252e36",
      toolboxForegroundColour: "#e7edf1",
      flyoutBackgroundColour: "#2b353d",
      flyoutForegroundColour: "#e7edf1",
      flyoutOpacity: 1,
      scrollbarColour: "#7d8a95",
      scrollbarOpacity: 0.55,
      insertionMarkerColour: "#38c5de",
      insertionMarkerOpacity: 0.3,
      cursorColour: "#38c5de"
    }
  });
}

export async function mountMonacoEditor(container, options) {
  const monaco = await loadMonaco();
  registerReducLanguages(monaco);
  registerProgramApiProviders(monaco);
  if (!container?.isConnected) return null;
  const { programId, language, locale = "pt-BR", source = "", onChange = () => {} } = options;
  const tabSize = normalizeProgramTabSize(options.tabSize);
  activeProgramApiContext = {
    locale: locale === "en-US" ? "en-US" : "pt-BR",
    componentInventory: typeof options.componentInventory === "function" ? options.componentInventory : () => options.componentInventory || [],
    translate: typeof options.translate === "function" ? options.translate : (key) => key,
    diagnostics: typeof options.diagnostics === "function" ? options.diagnostics : () => [],
    formatDiagnostic: typeof options.formatDiagnostic === "function" ? options.formatDiagnostic : null
  };
  const { model, key } = createTextModel(monaco, { programId, language, locale, source });
  if (activeEditor && activeViewKey === key && activeEditor.getDomNode()?.parentElement === container) {
    activeEditor.updateOptions({ tabSize, indentSize: tabSize, insertSpaces: true, suggest: { preview: true, showInlineDetails: true } });
    activeEditor.layout();
    localizeMonacoFindWidget();
    return activeEditor;
  }
  disposeProgramEditor();
  container.replaceChildren();
  activeOverflowWidgetsNode = document.createElement("div");
  activeOverflowWidgetsNode.className = "program-editor-overflow-widgets";
  document.body.append(activeOverflowWidgetsNode);
  activeMonacoFindObserver?.disconnect?.();
  activeMonacoFindObserver = new MutationObserver(localizeMonacoFindWidget);
  activeMonacoFindObserver.observe(activeOverflowWidgetsNode, { childList: true, subtree: true });
  const editor = monaco.editor.create(container, {
    model,
    overflowWidgetsDomNode: activeOverflowWidgetsNode,
    automaticLayout: true,
    ariaLabel: options.ariaLabel || "Code editor",
    accessibilitySupport: "auto",
    hover: { enabled: true, delay: 150, sticky: true },
    suggest: { preview: true, showInlineDetails: true },
    fixedOverflowWidgets: true,
    theme: "vs-dark",
    fontFamily: '"Noto Sans Mono", Consolas, monospace',
    fontSize: 13,
    lineHeight: 21,
    tabSize,
    indentSize: tabSize,
    insertSpaces: true,
    wordWrap: "on",
    scrollBeyondLastLine: false,
    minimap: { enabled: false },
    guides: { indentation: true, bracketPairs: true },
    renderWhitespace: "selection",
    padding: { top: 14, bottom: 14 }
  });
  activeMonacoFindObserver.observe(editor.getDomNode(), { childList: true, subtree: true });
  const viewState = editorViewStates.get(key);
  if (viewState) editor.restoreViewState(viewState);
  activeEditor = editor;
  activeViewKey = key;
  activeSubscription = model.onDidChangeContent(() => {
    if (!suppressTextChanges) onChange(model.getValue());
  });
  monaco.editor.setModelMarkers(model, "sbotics-program", []);
  localizeMonacoFindWidget();
  requestAnimationFrame(() => editor.layout());
  return editor;
}

function normalizeProgramTabSize(value) {
  const size = Number(value);
  return [2, 3, 4].includes(size) ? size : 4;
}

export function setProgramEditorTabSize(value) {
  const tabSize = normalizeProgramTabSize(value);
  activeEditor?.updateOptions({ tabSize, indentSize: tabSize, insertSpaces: true });
  return tabSize;
}

export function setProgramEditorMarkers(markers = []) {
  const model = activeEditor?.getModel?.();
  if (!model || !activeMonaco) return false;
  activeMonaco.editor.setModelMarkers(model, "sbotics-program", markers);
  return true;
}

export function setProgramBlockDiagnostics(markers = []) {
  if (!activeWorkspace) return false;
  const byId = new Map();
  for (const marker of markers) {
    const id = String(marker.blockId || "");
    if (!id) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(String(marker.message || ""));
  }
  for (const block of activeWorkspace.getAllBlocks(false)) {
    block.setWarningText?.(byId.get(String(block.id))?.filter(Boolean).join("\n") || null, "sbotics-build");
  }
  return true;
}

export function focusMountedProgramBlock(blockId) {
  const block = activeWorkspace?.getBlockById?.(String(blockId || ""));
  if (!block) return false;
  block.select?.();
  activeWorkspace.centerOnBlock?.(block.id);
  activeWorkspace.getInjectionDiv?.()?.focus?.();
  return true;
}

export function focusMountedProgramPosition(lineNumber, column = 1) {
  if (!activeEditor) return false;
  const position = { lineNumber: Math.max(1, Number(lineNumber) || 1), column: Math.max(1, Number(column) || 1) };
  activeEditor.setPosition(position);
  activeEditor.revealPositionInCenter(position);
  activeEditor.focus();
  return true;
}

function blockWorkspaceStateForProgram(document, Blockly) {
  const layout = document?.layout?.viewport || {};
  return {
    serialized: workspaceStateFromDocument(document, Blockly),
    viewport: { x: Number(layout.x) || 0, y: Number(layout.y) || 0, scale: (Number(layout.scale) || 1) * BLOCKLY_DISPLAY_SCALE }
  };
}

export async function mountBlocklyEditor(container, options) {
  if (!container?.isConnected) return null;
  const Blockly = await loadBlockly(options.uiLocale || options.locale || "pt-BR");
  activeBlockUiTranslate = typeof options.translateUi === "function" ? options.translateUi : typeof options.translate === "function" ? options.translate : (key) => key;
  if (!container?.isConnected) return null;
  const toolbox = registerBlockDefinitions(Blockly, {
    locale: options.locale || "pt-BR",
    translate: options.translate,
    translateUi: options.translateUi,
    translateCategories: options.translateUi,
    componentInventory: options.componentInventory,
    document: options.document
  });
  if (activeWorkspace && activeViewKey === options.programId && activeWorkspace.getInjectionDiv?.() === container) {
    activeWorkspace.resizeContents?.();
    return activeWorkspace;
  }
  disposeProgramEditor();
  activeBlockly = Blockly;
  container.replaceChildren();
  const workspace = Blockly.inject(container, {
    media: new URL("media/", BLOCKLY_ROOT).href,
    toolbox,
    renderer: "zelos",
    theme: createBlocklyTheme(Blockly),
    trashcan: true,
    sounds: false,
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: {
      controls: true,
      wheel: true,
      startScale: BLOCKLY_DISPLAY_SCALE,
      maxScale: 1.6 * BLOCKLY_DISPLAY_SCALE,
      minScale: 0.45 * BLOCKLY_DISPLAY_SCALE,
      scaleSpeed: 1.12
    },
    grid: { spacing: 24, length: 3, colour: "#37434c", snap: false },
    maxBlocks: 10000,
    oneBasedIndex: true
  });
  const state = blockWorkspaceStateForProgram(options.document, Blockly);
  Blockly.Events.disable();
  try {
    if (state.serialized.blocks.blocks.length && Blockly.serialization?.workspaces?.load) {
      Blockly.serialization.workspaces.load(state.serialized, workspace);
    }
    restoreBlockComponentReferences(workspace, options.document);
    refreshBlockVariableSelectors(workspace);
    workspace.setScale?.(state.viewport.scale);
    workspace.scroll?.(state.viewport.x, state.viewport.y);
  } finally {
    Blockly.Events.enable();
  }
  const toolboxDiv = workspace.getToolbox?.()?.getDiv?.();
  if (toolboxDiv) toolboxDiv.id = "program-editor-toolbox";
  workspace.getToolbox?.()?.setVisible?.(options.toolboxVisible !== false);
  activeWorkspace = workspace;
  activeViewKey = options.programId;
  workspace.registerButtonCallback("SBOTICS_CREATE_VARIABLE", (button) => {
    options.onCreateVariable?.(button?.getFocusableElement?.());
  });
  workspace.registerToolboxCategoryCallback?.("SBOTICS_VARIABLES", () => blockVariableToolboxContents(Blockly, workspace, activeBlockUiTranslate));
  for (const categoryId of ["controller_motors", "sensors", "outputs"]) {
    workspace.registerToolboxCategoryCallback?.(`SBOTICS_COMMANDS_${categoryId}`, () => blockCommandToolboxContents(categoryId));
  }
  activeToolboxRequestedVisible = options.toolboxVisible !== false;
  const closeButton = document.createElement("button");
  closeButton.className = "blockly-mobile-toolbox-close";
  closeButton.type = "button";
  closeButton.hidden = options.toolboxVisible === false;
  const closeLabel = String(activeBlockUiTranslate("programBlocksClose") || "Close block panel");
  closeButton.setAttribute("aria-label", closeLabel);
  closeButton.title = closeLabel;
  closeButton.innerHTML = '<span class="ui-icon icon-close" aria-hidden="true"></span>';
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof options.onToolboxVisibilityChange === "function") options.onToolboxVisibilityChange(false);
    else setProgramBlocksToolboxVisible(false);
  });
  container.append(closeButton);
  const positionToolboxCloseButton = () => {
    if (!toolboxDiv || !activeToolboxRequestedVisible || toolboxDiv.hidden) {
      closeButton.hidden = true;
      return;
    }
    const hostBounds = container.getBoundingClientRect();
    const toolboxBounds = toolboxDiv.getBoundingClientRect();
    const toolboxApiVisible = activeWorkspace?.getToolbox?.()?.getVisible?.();
    const toolboxStyle = globalThis.getComputedStyle?.(toolboxDiv);
    const intersectsHost = toolboxBounds.right > hostBounds.left
      && toolboxBounds.left < hostBounds.right
      && toolboxBounds.bottom > hostBounds.top
      && toolboxBounds.top < hostBounds.bottom;
    if (toolboxApiVisible === false || toolboxStyle?.display === "none" || toolboxStyle?.visibility === "hidden" || !toolboxBounds.width || !toolboxBounds.height || !intersectsHost) {
      closeButton.hidden = true;
      return;
    }
    closeButton.hidden = false;
    const hostScaleX = container.offsetWidth / (hostBounds.width || 1);
    const right = (toolboxBounds.right - hostBounds.left) * hostScaleX;
    closeButton.style.left = `${Math.max(0, right - closeButton.offsetWidth - 6)}px`;
  };
  activeToolboxCloseLayout = positionToolboxCloseButton;
  activeToolboxCloseObserver?.disconnect();
  activeToolboxCloseObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(positionToolboxCloseButton)
    : null;
  activeToolboxCloseMutationObserver?.disconnect();
  activeToolboxCloseMutationObserver = typeof MutationObserver === "function"
    ? new MutationObserver(() => requestAnimationFrame(positionToolboxCloseButton))
    : null;
  activeToolboxCloseObserver?.observe(container);
  if (toolboxDiv) {
    activeToolboxCloseObserver?.observe(toolboxDiv);
    activeToolboxCloseMutationObserver?.observe(toolboxDiv, { attributes: true, attributeFilter: ["class", "style", "hidden", "aria-hidden"] });
  }
  positionToolboxCloseButton();
  const UI_EVENTS = new Set([
    Blockly.Events.SELECTED,
    Blockly.Events.TOOLBOX_ITEM_SELECT,
    Blockly.Events.THEME_CHANGE,
    Blockly.Events.CLICK
  ]);
  workspace.addChangeListener((event) => {
    if (event.isUiEvent || UI_EVENTS.has(event.type)) return;
    refreshBlockVariableSelectors(workspace);
    options.onChange(blocksDocumentFromWorkspace(workspace, options.locale));
  });
  requestAnimationFrame(() => Blockly.svgResize(workspace));
  return workspace;
}

export function createProgramVariableBlock({ name, type } = {}) {
  const workspace = activeWorkspace;
  const Blockly = activeBlockly;
  if (!workspace || !Blockly || !name || !["number", "string", "boolean"].includes(type)) return null;
  let block = null;
  Blockly.Events.disable();
  try {
    block = workspace.newBlock("variable_declare");
    block.setFieldValue(String(name), "NAME");
    block.setFieldValue(String(type), "VALUE_TYPE");
    block.initSvg();
    block.render();
    const roots = workspace.getTopBlocks(false).filter((candidate) => candidate !== block);
    const y = roots.reduce((bottom, candidate) => {
      const position = candidate.getRelativeToSurfaceXY?.();
      const height = candidate.getHeightWidth?.().height || 0;
      return Math.max(bottom, (Number(position?.y) || 0) + height + 32);
    }, 40);
    block.moveBy(40, y);
    refreshBlockVariableSelectors(workspace);
  } finally {
    Blockly.Events.enable();
  }
  if (!block) return null;
  Blockly.Events.fire(new Blockly.Events.BlockCreate(block));
  workspace.getToolbox?.()?.refreshSelection?.();
  return String(block.id);
}

export function disposeProgramEditor() {
  if (activeEditor) {
    const model = activeEditor.getModel?.();
    if (model && activeMonaco) activeMonaco.editor.setModelMarkers(model, "sbotics-program", []);
    const viewState = activeEditor.saveViewState?.();
    if (viewState && activeViewKey) editorViewStates.set(activeViewKey, viewState);
  }
  activeSubscription?.dispose?.();
  activeSubscription = null;
  activeMonacoFindObserver?.disconnect?.();
  activeMonacoFindObserver = null;
  activeToolboxCloseObserver?.disconnect?.();
  activeToolboxCloseObserver = null;
  activeToolboxCloseMutationObserver?.disconnect?.();
  activeToolboxCloseMutationObserver = null;
  activeToolboxCloseLayout = () => {};
  activeToolboxRequestedVisible = true;
  activeEditor?.dispose?.();
  activeEditor = null;
  activeOverflowWidgetsNode?.remove?.();
  activeOverflowWidgetsNode = null;
  activeWorkspace?.dispose?.();
  activeWorkspace = null;
  activeBlockly = null;
  activeViewKey = "";
}

export function setProgramBlocksToolboxVisible(visible) {
  const toolbox = activeWorkspace?.getToolbox?.();
  if (!toolbox?.setVisible) return false;
  activeToolboxRequestedVisible = Boolean(visible);
  toolbox.setVisible(activeToolboxRequestedVisible);
  activeWorkspace.resizeContents?.();
  activeBlockly?.svgResize?.(activeWorkspace);
  activeToolboxCloseLayout();
  return true;
}

export function refreshProgramBlocksToolbox() {
  const toolbox = activeWorkspace?.getToolbox?.();
  if (!toolbox) return false;
  toolbox.refreshSelection?.();
  activeToolboxCloseLayout();
  return true;
}

export function captureMountedProgramAuthoring(locale = "pt-BR") {
  if (activeWorkspace) {
    return { kind: "blocks", document: blocksDocumentFromWorkspace(activeWorkspace, locale) };
  }
  const model = activeEditor?.getModel?.();
  if (!model) return null;
  const language = model.getLanguageId();
  if (language.startsWith("reduc-")) {
    return { kind: "reduc", source: model.getValue(), locale: locale === "en-US" ? "en-US" : "pt-BR" };
  }
  if (language === "pythonlike") return { kind: "pythonlike", source: model.getValue() };
  return { kind: "javascript", source: model.getValue() };
}

export function replaceMountedProgramText(source) {
  if (!activeEditor) return false;
  const model = activeEditor.getModel();
  if (!model || model.getValue() === String(source ?? "")) return true;
  suppressTextChanges = true;
  model.setValue(String(source ?? ""));
  suppressTextChanges = false;
  return true;
}

export function forgetProgramEditorState(programId) {
  const prefix = `${programId}:`;
  for (const [key, model] of models) {
    if (!key.startsWith(prefix)) continue;
    if (!model.isDisposed()) model.dispose();
    models.delete(key);
    editorViewStates.delete(key);
  }
}

export function runProgramEditorCommand(command) {
  if (activeEditor) {
    const actionId = {
      undo: "undo",
      redo: "redo",
      find: "actions.find",
      replace: "editor.action.startFindReplaceAction",
      comment: "editor.action.commentLine",
      selectNextOccurrence: "editor.action.addSelectionToNextFindMatch",
      selectAllOccurrences: "editor.action.selectHighlights"
    }[command];
    if (actionId) {
      runMonacoAction(activeEditor, actionId);
      return true;
    }
  }
  if (activeWorkspace && (command === "undo" || command === "redo")) {
    activeWorkspace.undo(command === "redo");
    return true;
  }
  return false;
}
