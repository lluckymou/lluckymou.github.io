import { BlocksRegistry, ReducCommands, ReducGrammar } from "./programming-api-registry.generated.js?imp-ux-03-blockly-drawer-controls-20261101-1";

const COMMAND_BY_BLOCK = new Map(ReducCommands.records.map((record) => [record.blockly?.type, record]).filter(([type]) => type));
const STRUCTURAL = new Map((BlocksRegistry.structuralBlocks || []).map((record) => [record.typeId, record]));
const STRUCTURAL_HUES = Object.freeze({
  program_entry: 190,
  number_literal: 42,
  text_literal: 318,
  boolean_literal: 52,
  variable_get: 34,
  variable_set: 28,
  variable_declare: 24,
  arithmetic: 276,
  logic_compare: 268,
  logic_not: 286,
  logic_and_or: 252,
  if_then_else: 142,
  while_loop: 132,
  do_while_loop: 120,
  repeat_count: 108,
  for_range: 96,
  switch_text: 302,
  switch_case: 290,
  switch_default: 282,
  break_loop: 6,
  continue_loop: 2,
  task_declare: 218,
  function_declare: 228,
  user_call: 205,
  return_value: 214,
  debug_pause: 196
});
const COMMAND_HUES = Object.freeze({
  control: 25,
  math: 276,
  servo: 128,
  colorSensor: 344,
  console: 190,
  controller: 48,
  time: 208,
  buzzer: 318,
  ultrasonicSensor: 12,
  pen: 148,
  conversion: 252,
  light: 58,
  touchSensor: 0
});
export function commandBlockHue(category) { return COMMAND_HUES[category] ?? 198; }
const typeCheck = (type) => ({ number: "Number", string: "String", boolean: "Boolean" })[type] || null;
const defaults = { number: "0", string: '""', boolean: "false" };
const paramInputName = (index) => `ARG_${index}`;
let activeBlockLocale = "pt-BR";
let activeBlockTranslate = (key) => key;
let activeBlockUiTranslate = (key) => key;
let activeBlockSymbols = [];
let activeComponentInventory = () => [];
let activeBlockDocument = null;
let activeCallableOptions = [];

const TOOLBOX_COMMAND_CATEGORIES = Object.freeze({
  controller_motors: ["controller", "servo"],
  sensors: ["colorSensor", "touchSensor", "ultrasonicSensor"],
  outputs: ["pen", "light", "buzzer"]
});

const componentReferenceKey = (robotId, componentId) => JSON.stringify([String(robotId || ""), String(componentId || "")]);
const legacyComponentReferenceKey = (blockId, componentName) => `legacy:${encodeURIComponent(String(blockId || ""))}:${encodeURIComponent(String(componentName || ""))}`;
const currentComponentInventory = () => {
  try {
    const inventory = typeof activeComponentInventory === "function" ? activeComponentInventory() : activeComponentInventory;
    return Array.isArray(inventory) ? inventory : [];
  } catch { return []; }
};
const componentTypeFor = (item) => item?.apiTypeId || item?.typeId || item?.partId || "";
const componentLabel = (item) => String(item?.codeName || item?.name || "");
const compatibleComponentInventory = (componentType) => currentComponentInventory().filter((item) => componentTypeFor(item) === componentType);

export function blockCommandToolboxContents(categoryId) {
  const categories = new Set(TOOLBOX_COMMAND_CATEGORIES[categoryId] || []);
  if (!categories.size) return [];
  return ReducCommands.records
    .filter((record) => categories.has(record.category))
    .filter((record) => {
      const requiresNamedComponent = (record.signature?.parameters || []).some((parameter) => parameter.name === "componentName");
      return !requiresNamedComponent || compatibleComponentInventory(record.componentType).length > 0;
    })
    .map((record) => ({ kind: "block", type: record.blockly.type }));
}

function blockVariableSymbols(workspace) {
  if (workspace) {
    activeBlockSymbols = workspace.getAllBlocks(false)
      .filter((block) => block.type === "variable_declare")
      .map((block) => ({ id: String(block.getFieldValue("SYMBOL_ID") || ""), name: String(block.getFieldValue("NAME") || "?"), type: String(block.getFieldValue("VALUE_TYPE") || "number") }))
      .filter((item) => item.id);
  }
  return activeBlockSymbols;
}

export function refreshBlockVariableSelectors(workspace) {
  return blockVariableSymbols(workspace);
}

export function restoreBlockComponentReferences(workspace, sourceDocument = null) {
  const sourceNodes = new Map((sourceDocument?.blocks || []).map((node) => [String(node.id), node]));
  for (const block of workspace?.getAllBlocks?.(false) || []) {
    const record = COMMAND_BY_BLOCK.get(block.type);
    if (!(record?.signature?.parameters || []).some((parameter) => parameter.name === "componentName")) continue;
    const saved = sourceNodes.get(String(block.id));
    const fields = saved?.fields || {};
    const robotId = String(fields.COMPONENT_ROBOT_ID || block.getFieldValue("COMPONENT_ROBOT_ID") || "");
    const componentId = String(fields.COMPONENT_ID || block.getFieldValue("COMPONENT_ID") || "");
    const componentName = String(fields.COMPONENT_NAME || block.getFieldValue("COMPONENT_NAME") || "");
    if (componentId && robotId && block.getField("COMPONENT_REF")) block.setFieldValue(componentReferenceKey(robotId, componentId), "COMPONENT_REF");
    else if (componentName && block.getField("COMPONENT_REF")) block.setFieldValue(legacyComponentReferenceKey(block.id, componentName), "COMPONENT_REF");
  }
}

function blockVariableFlyoutText(workspace, actionLabel, helperLabel) {
  const buttonText = `\uEA60\u00A0${actionLabel}`;
  const document = workspace?.getInjectionDiv?.()?.ownerDocument;
  const context = document?.createElement?.("canvas")?.getContext?.("2d");
  if (!context) return { buttonText, helperText: helperLabel };
  context.font = '750 13px "sBotics Icons", "Noto Sans", Arial, sans-serif';
  const buttonTextWidth = context.measureText(buttonText).width;
  const buttonPaddingUnitWidth = context.measureText("\u2002").width;
  context.font = '400 12px "Noto Sans", Arial, sans-serif';
  const helperWidth = context.measureText(helperLabel).width;
  const helperPaddingUnitWidth = context.measureText("\u2002").width;
  const hostWidth = Number(workspace?.getInjectionDiv?.()?.getBoundingClientRect?.().width || 0);
  const toolboxWidth = Number(workspace?.getToolbox?.()?.getDiv?.()?.getBoundingClientRect?.().width || 0);
  const flyoutScale = Math.max(0.1, Number(workspace?.getFlyout?.()?.getFlyoutScale?.() || 1));
  const availableWidth = hostWidth ? Math.max(0, hostWidth - toolboxWidth - 24) / flyoutScale : 360;
  const targetWidth = Math.max(buttonTextWidth + 10, helperWidth, Math.min(400, availableWidth));
  const buttonPaddingCount = buttonPaddingUnitWidth > 0
    ? Math.max(0, Math.floor((targetWidth - 10 - buttonTextWidth) / (2 * buttonPaddingUnitWidth)))
    : 0;
  const helperPaddingCount = helperPaddingUnitWidth > 0
    ? Math.max(0, Math.floor((targetWidth - helperWidth) / (2 * helperPaddingUnitWidth)))
    : 0;
  const buttonPadding = "\u2002".repeat(buttonPaddingCount);
  const helperPadding = "\u2002".repeat(helperPaddingCount);
  return {
    buttonText: `${buttonPadding}${buttonText}${buttonPadding}`,
    helperText: `${helperPadding}${helperLabel}${helperPadding}`
  };
}

export function blockVariableToolboxContents(Blockly, workspace, translateUi = (key) => key) {
  const uiT = typeof translateUi === "function" ? translateUi : (key) => key;
  const blocks = (type, fields = {}) => ({ kind: "block", type, ...(Object.keys(fields).length ? { fields } : {}) });
  const symbols = refreshBlockVariableSelectors(workspace);
  const flyoutText = blockVariableFlyoutText(workspace, uiT("programBlockCreateVariable"), uiT("programBlockCreateVariableHint"));
  const contents = [
    { kind: "sep", gap: 8 },
    {
      kind: "button",
      text: flyoutText.buttonText,
      callbackKey: "SBOTICS_CREATE_VARIABLE",
      "web-class": "sbotics-variable-create-action"
    },
    { kind: "sep", gap: symbols.length ? 32 : 12 }
  ];
  if (!symbols.length) contents.push(
    { kind: "label", text: flyoutText.helperText, "web-class": "sbotics-variable-help" },
    { kind: "sep", gap: 12 }
  );
  contents.push(
    blocks("number_literal"), blocks("text_literal"), blocks("boolean_literal")
  );
  if (symbols.length) {
    contents.push({ kind: "sep", gap: 24 });
    for (const symbol of symbols) {
      contents.push(blocks("variable_get", { SYMBOL_ID: symbol.id }));
      contents.push(blocks("variable_set", { SYMBOL_ID: symbol.id }));
    }
  }
  return contents;
}

function commandLabelKey(commandId) { return `programApiCommand_${String(commandId || "").replace(/[^A-Za-z0-9]+/g, "_")}`; }

function registerBlockDefinitions(Blockly, { locale, translate, translateUi = translate, translateCategories = translateUi, componentInventory = [], document = null } = {}) {
  activeBlockLocale = locale === "en-US" ? "en-US" : "pt-BR";
  activeBlockTranslate = typeof translate === "function" ? translate : (key) => key;
  activeBlockUiTranslate = typeof translateUi === "function" ? translateUi : activeBlockTranslate;
  activeBlockDocument = document || null;
  activeBlockSymbols = (document?.blocks || []).filter((node) => node.typeId === "variable_declare")
    .map((node) => ({ name: String(node.fields?.NAME || "?"), id: String(node.fields?.SYMBOL_ID || ""), type: String(node.fields?.VALUE_TYPE || "number") })).filter((item) => item.id);
  activeComponentInventory = typeof componentInventory === "function" ? componentInventory : () => Array.isArray(componentInventory) ? componentInventory : [];
  activeCallableOptions = (document?.blocks || []).filter((node) => ["task_declare", "function_declare"].includes(node.typeId))
    .map((node) => [String(node.fields?.NAME || "?"), String(node.fields?.SYMBOL_ID || "")]).filter((item) => item[1]);
  const t = (key) => activeBlockTranslate(key);
  const uiT = (key) => activeBlockUiTranslate(key);
  const translatedTooltip = (key, fallback) => {
    const value = uiT(key);
    return value && value !== key ? value : fallback;
  };
  const label = (id) => { const key = `programBlock_${id}`; const value = t(key); return value === key ? id.replaceAll("_", " ") : value; };
  const symbolDropdown = (numberOnly = false) => new Blockly.FieldDropdown(() => {
    const symbols = activeBlockSymbols.filter((item) => !numberOnly || item.type === "number").map((item) => [item.name, item.id]);
    return symbols.length ? symbols : [[t("programBlockNoVariables") || "?", ""]];
  });
  const input = (block, name, check = null, text = "") => {
    const value = block.appendValueInput(name);
    if (check) value.setCheck(check);
    if (text) value.appendField(text);
    return value;
  };
  const field = (block, name, value, type = "text") => {
    const Field = type === "dropdown" ? Blockly.FieldDropdown : Blockly.FieldTextInput;
    const control = type === "dropdown" ? new Field(value) : new Field(String(value));
    block.appendDummyInput().appendField(control, name);
  };
  const newSymbolId = () => `sym_${Math.random().toString(36).slice(2, 8)}`;
  const appendHiddenField = (blockInput, name, value = "") => {
    const hiddenField = new Blockly.FieldTextInput(String(value));
    blockInput.appendField(hiddenField, name);
    hiddenField.setVisible(false);
    return hiddenField;
  };
  const appendHiddenSymbolField = (blockInput, value) => appendHiddenField(blockInput, "SYMBOL_ID", value);
  const compatibleComponents = (componentType) => compatibleComponentInventory(componentType);
  const componentOptions = (record, block) => {
    const compatible = compatibleComponents(record.componentType);
    const options = new Map();
    for (const item of compatible) {
      const key = componentReferenceKey(item.robotId, item.instanceId || item.componentId || item.id);
      if (key !== componentReferenceKey("", "")) options.set(key, [componentLabel(item), key]);
    }
    const unavailableLabel = activeBlockUiTranslate("programBlockComponentUnavailable") || "not on selected Robot";
    const wrongTypeLabel = activeBlockUiTranslate("programBlockComponentWrongType") || "wrong component type";
    const persistedNode = (activeBlockDocument?.blocks || []).find((node) => String(node.id) === String(block.id) && node.typeId === block.type);
    const fields = persistedNode?.fields || {};
    const selectedRobotId = String(block.getFieldValue("COMPONENT_ROBOT_ID") || fields.COMPONENT_ROBOT_ID || "");
    const selectedComponentId = String(block.getFieldValue("COMPONENT_ID") || fields.COMPONENT_ID || "");
    const selectedName = String(block.getFieldValue("COMPONENT_NAME") || fields.COMPONENT_NAME || "");
    if (selectedRobotId && selectedComponentId) {
      const key = componentReferenceKey(selectedRobotId, selectedComponentId);
      const exists = compatible.some((item) => String(item.robotId || "") === selectedRobotId && String(item.instanceId || item.componentId || item.id || "") === selectedComponentId);
      if (!exists && selectedName) {
        const selectedItem = currentComponentInventory().find((item) => String(item.robotId || "") === selectedRobotId && String(item.instanceId || item.componentId || item.id || "") === selectedComponentId);
        options.set(key, [`${selectedName} · ${selectedItem ? wrongTypeLabel : unavailableLabel}`, key]);
      }
    } else if (selectedName) {
      const key = legacyComponentReferenceKey(block.id, selectedName);
      options.set(key, [`${selectedName} · ${unavailableLabel}`, key]);
    }
    if (!options.size) return [[activeBlockUiTranslate("programBlockNoComponents") || "No compatible components", ""]];
    return [...options.values()];
  };
  const setComponentReference = (block, component) => {
    if (!component) return;
    block.setFieldValue(String(component.instanceId || component.componentId || component.id || ""), "COMPONENT_ID");
    block.setFieldValue(String(componentLabel(component)), "COMPONENT_NAME");
    block.setFieldValue(String(component.robotId || ""), "COMPONENT_ROBOT_ID");
  };
  const define = (typeId, init) => {
    if (Blockly.Blocks[typeId]) return;
    Blockly.Blocks[typeId] = { init() { init.call(this); this.setColour(STRUCTURAL_HUES[typeId] ?? 204); this.setTooltip(translatedTooltip(`programBlock_${typeId}`, label(typeId))); } };
  };
  const statement = (block) => { block.setPreviousStatement(true); block.setNextStatement(true); };

  define("program_entry", function () { this.appendDummyInput().appendField(label("program_entry")); this.appendStatementInput("BODY").appendField(label("body")); this.setTooltip(translatedTooltip("programBlock_program_entry", label("program_entry"))); });
  define("number_literal", function () { this.appendDummyInput().appendField(label("number_literal")).appendField(new Blockly.FieldNumber(0), "VALUE"); this.setOutput(true, "Number"); });
  define("text_literal", function () { this.appendDummyInput().appendField(label("text_literal")).appendField(new Blockly.FieldTextInput(""), "VALUE"); this.setOutput(true, "String"); });
  define("boolean_literal", function () { this.appendDummyInput().appendField(label("boolean_literal")).appendField(new Blockly.FieldDropdown([[t("programBlockTrue") || "true", "true"], [t("programBlockFalse") || "false", "false"]]), "VALUE"); this.setOutput(true, "Boolean"); });
  define("variable_get", function () { this.appendDummyInput().appendField(label("variable_get")).appendField(symbolDropdown(), "SYMBOL_ID"); this.setOutput(true); this.setTooltip(translatedTooltip("programBlockVariableGetHelp", label("variable_get"))); });
  define("variable_set", function () { this.appendDummyInput().appendField(label("variable_set")).appendField(symbolDropdown(), "SYMBOL_ID"); input(this, "VALUE", null, "="); statement(this); });
  define("variable_declare", function () {
    const declaration = this.appendDummyInput()
      .appendField(label("variable_declare"))
      .appendField(new Blockly.FieldTextInput(t("programBlockDefaultVariableName") || "variavel"), "NAME")
      .appendField(new Blockly.FieldDropdown([
        [t("programBlockTypeNumber") || "number", "number"],
        [t("programBlockTypeText") || "text", "string"],
        [t("programBlockTypeBoolean") || "boolean", "boolean"]
      ]), "VALUE_TYPE");
    appendHiddenSymbolField(declaration, newSymbolId());
    input(this, "INIT");
    statement(this);
  });
  define("arithmetic", function () { this.appendDummyInput().appendField(new Blockly.FieldDropdown([["+", "+"], ["−", "-"], ["×", "*"], ["÷", "/"], ["%", "%"]]), "OPERATOR"); input(this, "LEFT"); input(this, "RIGHT"); this.setOutput(true); this.setInputsInline(true); });
  define("logic_compare", function () { input(this, "LEFT"); this.appendDummyInput().appendField(new Blockly.FieldDropdown([["=", "=="], ["≠", "!="], ["<", "<"], ["≤", "<="], [">", ">"], ["≥", ">="]]), "OPERATOR"); input(this, "RIGHT"); this.setOutput(true, "Boolean"); this.setInputsInline(true); });
  define("logic_not", function () { input(this, "VALUE", "Boolean", label("logic_not")); this.setOutput(true, "Boolean"); });
  define("logic_and_or", function () { input(this, "LEFT", "Boolean"); this.appendDummyInput().appendField(new Blockly.FieldDropdown([[t("programBlockAnd") || "and", "and"], [t("programBlockOr") || "or", "or"]]), "OPERATOR"); input(this, "RIGHT", "Boolean"); this.setOutput(true, "Boolean"); this.setInputsInline(true); });
  define("if_then_else", function () { input(this, "CONDITION", "Boolean", label("if_then_else")); this.appendStatementInput("THEN").appendField(label("then")); this.appendStatementInput("ELSE").appendField(label("else")); statement(this); });
  define("while_loop", function () { input(this, "CONDITION", "Boolean", label("while_loop")); this.appendStatementInput("BODY").appendField(label("body")); statement(this); });
  define("do_while_loop", function () { this.appendStatementInput("BODY").appendField(label("body")); input(this, "CONDITION", "Boolean", label("while_loop")); statement(this); });
  define("repeat_count", function () { input(this, "COUNT", "Number", label("repeat_count")); this.appendStatementInput("BODY").appendField(label("body")); statement(this); });
  define("for_range", function () { this.appendDummyInput().appendField(symbolDropdown(true), "SYMBOL_ID"); input(this, "FROM", "Number", label("from")); input(this, "TO", "Number", label("to")); input(this, "STEP", "Number", label("step")); this.appendStatementInput("BODY").appendField(label("body")); statement(this); });
  define("switch_text", function () { input(this, "VALUE", "String", label("switch_text")); this.appendStatementInput("CASES").appendField(label("cases")); statement(this); });
  define("switch_case", function () { this.appendDummyInput().appendField(label("switch_case")).appendField(new Blockly.FieldTextInput(""), "CASE_VALUE"); this.appendStatementInput("BODY").appendField(label("body")); statement(this); });
  define("switch_default", function () { this.appendDummyInput().appendField(label("switch_default")); this.appendStatementInput("BODY").appendField(label("body")); statement(this); });
  define("break_loop", function () { this.appendDummyInput().appendField(label("break_loop")); statement(this); });
  define("continue_loop", function () { this.appendDummyInput().appendField(label("continue_loop")); statement(this); });
  define("task_declare", function () {
    const declaration = this.appendDummyInput()
      .appendField(label("task_declare"))
      .appendField(new Blockly.FieldTextInput(t("programBlockDefaultTaskName") || "tarefa"), "NAME");
    appendHiddenSymbolField(declaration, newSymbolId());
    this.appendStatementInput("BODY").appendField(label("body"));
  });
  define("function_declare", function () {
    const declaration = this.appendDummyInput()
      .appendField(label("function_declare"))
      .appendField(new Blockly.FieldDropdown([
        [t("programBlockTypeNumber") || "number", "number"],
        [t("programBlockTypeText") || "text", "string"],
        [t("programBlockTypeBoolean") || "boolean", "boolean"]
      ]), "RETURN_TYPE")
      .appendField(new Blockly.FieldTextInput(t("programBlockDefaultFunctionName") || "funcao"), "NAME");
    appendHiddenSymbolField(declaration, newSymbolId());
    this.appendStatementInput("BODY").appendField(label("body"));
  });
  define("user_call", function () { this.appendDummyInput().appendField(label("user_call")).appendField(new Blockly.FieldDropdown(() => activeCallableOptions.length ? activeCallableOptions : [[t("programBlockNoFunctions") || "?", ""]]), "SYMBOL_ID"); this.setPreviousStatement(true); this.setNextStatement(true); });
  define("return_value", function () { input(this, "VALUE", null, label("return_value")); statement(this); });
  define("debug_pause", function () { this.appendDummyInput().appendField(t("programBlock_debug_pause") || "Pausar"); statement(this); });

  for (const record of ReducCommands.records) {
    const typeId = record.blockly?.type;
    if (!typeId || Blockly.Blocks[typeId]) continue;
    Blockly.Blocks[typeId] = {
      init() {
        const spelling = record.spellings?.[activeBlockLocale] || record.name;
        this.appendDummyInput().appendField(spelling);
        const params = record.signature?.parameters || [];
        params.forEach((parameter, index) => {
          if (parameter.name === "componentName") {
            const components = compatibleComponents(record.componentType);
            const persistedNode = (activeBlockDocument?.blocks || []).find((node) => String(node.id) === String(this.id) && node.typeId === this.type);
            const persistedFields = persistedNode?.fields || {};
            const hasPersistedComponent = Boolean(persistedFields.COMPONENT_ID || persistedFields.COMPONENT_NAME);
            if (!components.length && !hasPersistedComponent) {
              const componentInput = this.appendDummyInput();
              componentInput.appendField(new Blockly.FieldTextInput(""), "COMPONENT_NAME");
              appendHiddenField(componentInput, "COMPONENT_ID");
              appendHiddenField(componentInput, "COMPONENT_ROBOT_ID");
            } else {
              const componentInput = this.appendDummyInput();
              const selector = new Blockly.FieldDropdown(
                () => componentOptions(record, this),
                (value) => {
                  const match = compatibleComponents(record.componentType).find((item) => componentReferenceKey(item.robotId, item.instanceId || item.componentId || item.id) === value);
                  if (match) setComponentReference(this, match);
                  return value;
                }
              );
              componentInput.appendField(selector, "COMPONENT_REF");
              appendHiddenField(componentInput, "COMPONENT_NAME");
              appendHiddenField(componentInput, "COMPONENT_ID");
              appendHiddenField(componentInput, "COMPONENT_ROBOT_ID");
              const first = components[0];
              if (!persistedNode && first && !this.getFieldValue("COMPONENT_NAME")) setComponentReference(this, first);
            }
          } else {
            const parameterKey = `programBlockParameter_${parameter.name}`;
            const translatedParameter = t(parameterKey);
            const display = translatedParameter === parameterKey ? parameter.name.replace(/([a-z])([A-Z])/g, "$1 $2") : translatedParameter;
            const arg = this.appendValueInput(paramInputName(index)).setCheck(typeCheck(parameter.type));
            arg.appendField(display);
          }
        });
        const outputType = typeCheck(record.blockly?.outputType || record.signature?.returns);
        if (outputType) this.setOutput(true, outputType); else statement(this);
        const tooltipKey = commandLabelKey(record.commandId);
        this.setTooltip(translatedTooltip(tooltipKey, record.semantics || spelling));
        this.setColour(commandBlockHue(record.category));
      }
    };
  }

  return createToolbox(Blockly, t, locale, translateCategories);
}

function createToolbox(Blockly, t, locale, translateCategories = t) {
  const categoryT = typeof translateCategories === "function" ? translateCategories : t;
  const structural = (typeId) => ({ kind: "block", type: typeId });
  const commandTypeIds = (category) => ReducCommands.records.filter((record) => record.category === category).map((record) => structural(record.blockly.type));
  const categoryNames = {
    lifecycle: "programBlockCategory_lifecycle", variables: "programBlockCategory_variables", logic: "programBlockCategory_logic",
    loops: "programBlockCategory_loops", tasks_functions: "programBlockCategory_tasks_functions", math_text: "programBlockCategory_math_text",
    controller_motors: "programBlockCategory_controller_motors", sensors: "programBlockCategory_sensors", outputs: "programBlockCategory_outputs", time_console: "programBlockCategory_time_console"
  };
  const structuralByCategory = {
    lifecycle: ["program_entry"], variables: ["number_literal", "text_literal", "boolean_literal", "variable_get", "variable_set", "variable_declare"],
    logic: ["logic_compare", "logic_not", "logic_and_or", "if_then_else", "switch_text", "switch_case", "switch_default"], loops: ["while_loop", "do_while_loop", "repeat_count", "for_range", "break_loop", "continue_loop"],
    tasks_functions: ["task_declare", "function_declare", "user_call", "return_value"], math_text: ["arithmetic"]
  };
  const commandCategories = { math_text: ["math", "conversion"], time_console: ["time", "console"] };
  const categoryColours = {
    lifecycle: "#2f9fb7", variables: "#e09a36", logic: "#9562d4", loops: "#4bb86b",
    tasks_functions: "#4b83d3", math_text: "#df6652", controller_motors: "#ceb13c",
    sensors: "#c85d96", outputs: "#42aa9c", time_console: "#6685b4"
  };
  const contents = (BlocksRegistry.toolbox || []).map((category) => {
    const categoryKey = categoryNames[category.id] || category.id;
    const translatedCategory = categoryT(categoryKey);
    if (category.id === "variables") return {
      kind: "category",
      name: translatedCategory === categoryKey ? category.id.replaceAll("_", " ") : translatedCategory,
      colour: categoryColours[category.id],
      custom: "SBOTICS_VARIABLES"
    };
    if (Object.hasOwn(TOOLBOX_COMMAND_CATEGORIES, category.id)) return {
      kind: "category",
      name: translatedCategory === categoryKey ? category.id.replaceAll("_", " ") : translatedCategory,
      colour: categoryColours[category.id],
      custom: `SBOTICS_COMMANDS_${category.id}`
    };
    const types = [...(structuralByCategory[category.id] || [])].map(structural);
    for (const commandCategory of commandCategories[category.id] || []) types.push(...commandTypeIds(commandCategory));
    if (category.id === "time_console") types.push(structural("debug_pause"));
    return {
      kind: "category",
      name: translatedCategory === categoryKey ? category.id.replaceAll("_", " ") : translatedCategory,
      colour: categoryColours[category.id],
      contents: types
    };
  }).filter((category) => category.custom || category.contents?.length);
  return { kind: "categoryToolbox", contents };
}

function compileBlocks(input = {}) {
  const document = input.document || {};
  const locale = document.locale === "en-US" ? "en-US" : "pt-BR";
  const nodes = Array.isArray(document.blocks) ? document.blocks : [];
  const nodeById = new Map();
  const diagnostics = [];
  let diagnosticCountTruncated = 0;
  const add = (code, node, params = {}) => {
    if (diagnostics.length >= 100) { diagnosticCountTruncated++; return; }
    diagnostics.push({ code, params, blockId: String(node?.id || ""), start: { line: 1, column: 1 }, end: { line: 1, column: 1 } });
  };
  if (nodes.length > 100000) add("BLOCK_RANGE", null, { name: "block count" });
  try { if (new TextEncoder().encode(JSON.stringify(document)).length > 5 * 1024 * 1024) add("BLOCK_RANGE", null, { name: "document size" }); } catch { add("BLOCK_SCHEMA", null, { name: "document" }); }
  if (document.schemaVersion !== 1) add("BLOCK_SCHEMA", null, { name: "schemaVersion" });
  for (const node of nodes) {
    const id = String(node?.id || "");
    if (!id || nodeById.has(id)) add("BLOCK_DUPLICATE_ID", node); else nodeById.set(id, node);
    if (!STRUCTURAL.has(node.typeId) && !COMMAND_BY_BLOCK.has(node.typeId) && !["debug_pause", "switch_case", "switch_default"].includes(node.typeId)) add("BLOCK_UNKNOWN_TYPE", node, { name: node.typeId || "" });
  }
  const declarations = new Map();
  const declarationNames = new Set();
  const reservedNames = new Set([
    ...ReducCommands.records.flatMap((record) => Object.values(record.spellings || {})),
    ...Object.values(ReducGrammar.locales[locale]?.keywords || {}),
    ...Object.values(ReducGrammar.locales[locale]?.types || {}),
    ...Object.values(ReducGrammar.locales[locale]?.literals || {}),
    ...["robot", "console", "debug", "begin", "end", "if", "else", "while", "for", "break", "continue", "return", "task", "function"]
  ]);
  for (const node of nodes.filter((item) => item.typeId === "variable_declare")) {
    const id = String(node.fields?.SYMBOL_ID || ""); const name = String(node.fields?.NAME || ""); const valueType = node.fields?.VALUE_TYPE;
    if (!id || declarations.has(id)) add("BLOCK_DUPLICATE_ID", node);
    else declarations.set(id, { id, name, type: valueType, node });
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name)) add("BLOCK_INVALID_NAME", node, { name });
    if (declarationNames.has(name) || reservedNames.has(name)) add("BLOCK_DUPLICATE_NAME", node, { name });
    declarationNames.add(name);
    if (!typeCheck(valueType)) add("BLOCK_TYPE", node, { name });
  }
  const visited = new Set();
  const expressionStack = new Set();
  const stackContext = { loops: 0, switchDepth: 0, repeatDepth: 0, functionType: null };
  const callableById = new Map(nodes.filter((node) => ["task_declare", "function_declare"].includes(node.typeId))
    .map((node) => [String(node.fields?.SYMBOL_ID || ""), { name: String(node.fields?.NAME || ""), typeId: node.typeId, returnType: node.fields?.RETURN_TYPE || "void", node }]));
  for (const callable of callableById.values()) {
    if (!callable.node.fields?.SYMBOL_ID || declarations.has(String(callable.node.fields.SYMBOL_ID))) add("BLOCK_DUPLICATE_ID", callable.node);
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(callable.name)) add("BLOCK_INVALID_NAME", callable.node, { name: callable.name });
    if (declarationNames.has(callable.name) || reservedNames.has(callable.name)) add("BLOCK_DUPLICATE_NAME", callable.node, { name: callable.name });
    declarationNames.add(callable.name);
    if (callable.typeId === "function_declare" && !typeCheck(callable.returnType)) add("BLOCK_TYPE", callable.node, { name: callable.returnType });
  }
  const get = (node, name) => { const id = node?.inputs?.[name]?.blockId; return id ? nodeById.get(String(id)) || null : null; };
  const checkInput = (node, name, expected = null, context = stackContext, displayName = name) => {
    const child = get(node, name);
    if (!child) { add("BLOCK_MISSING_INPUT", node, { name: displayName }); return { code: "undefined", type: "unknown" }; }
    const expr = expression(child, { ...context, depth: (context.depth || 0) + 1 });
    if (expected && expr.type !== expected) add("BLOCK_TYPE", child, { name, expected, actual: expr.type });
    return expr;
  };
  const getSymbol = (node, fieldName = "SYMBOL_ID") => {
    const id = String(node.fields?.[fieldName] || ""); const symbol = declarations.get(id);
    if (!symbol) add("BLOCK_UNKNOWN_SYMBOL", node);
    return symbol;
  };
  function expression(node, context) {
    if (!node) return { code: "undefined", type: "unknown" };
    if ((context.depth || 0) >= 256) { add("BLOCK_RANGE", node, { name: "nesting" }); return { code: "undefined", type: "unknown" }; }
    if (expressionStack.has(String(node.id))) { add("BLOCK_CYCLE", node, { name: "input" }); return { code: "undefined", type: "unknown" }; }
    expressionStack.add(String(node.id));
    visited.add(String(node.id));
    if (node.typeId === "number_literal") { const value = Number(node.fields?.VALUE); if (!Number.isFinite(value)) add("BLOCK_TYPE", node, { name: "number" }); expressionStack.delete(String(node.id)); return { code: Number.isFinite(value) ? String(value) : "0", type: "number" }; }
    if (node.typeId === "text_literal") { const value = String(node.fields?.VALUE || ""); if (new TextEncoder().encode(value).length > 65536) add("BLOCK_RANGE", node, { name: "text literal" }); expressionStack.delete(String(node.id)); return { code: JSON.stringify(value), type: "string" }; }
    if (node.typeId === "boolean_literal") { expressionStack.delete(String(node.id)); return { code: node.fields?.VALUE === "true" || node.fields?.VALUE === true ? "true" : "false", type: "boolean" }; }
    if (node.typeId === "variable_get") { const symbol = getSymbol(node); expressionStack.delete(String(node.id)); return { code: symbol?.name || "invalidIdentifier", type: symbol?.type || "unknown" }; }
    if (["arithmetic", "logic_compare", "logic_and_or"].includes(node.typeId)) {
      const left = checkInput(node, "LEFT"); const right = checkInput(node, "RIGHT"); const op = String(node.fields?.OPERATOR || (node.typeId === "arithmetic" ? "+" : "=="));
      if (left.type !== right.type) add("BLOCK_TYPE", node, { expected: left.type, actual: right.type, name: op });
      if (node.typeId === "logic_and_or") { expressionStack.delete(String(node.id)); return { code: `(${left.code} ${op === "and" ? "&&" : "||"} ${right.code})`, type: "boolean" }; }
      if (node.typeId === "logic_compare") { expressionStack.delete(String(node.id)); return { code: `(${left.code} ${op} ${right.code})`, type: "boolean" }; }
      if (op !== "+" && (left.type !== "number" || right.type !== "number")) add("BLOCK_TYPE", node, { expected: "number", actual: left.type, name: op });
      const rightNode = get(node, "RIGHT");
      if (["/", "%"].includes(op) && rightNode?.typeId === "number_literal" && Number(rightNode.fields?.VALUE) === 0) add("BLOCK_ZERO_DIVISOR", node, {});
      expressionStack.delete(String(node.id)); return { code: `(${left.code} ${op} ${right.code})`, type: op === "+" && left.type === "string" ? "string" : "number" };
    }
    if (node.typeId === "logic_not") { const value = checkInput(node, "VALUE", "boolean", { ...context, depth: (context.depth || 0) + 1 }); expressionStack.delete(String(node.id)); return { code: `(!${value.code})`, type: "boolean" }; }
    const record = COMMAND_BY_BLOCK.get(node.typeId);
    if (record) {
      const args = [];
      (record.signature?.parameters || []).forEach((parameter, index) => {
        if (parameter.name === "componentName") {
          const componentName = String(node.fields?.COMPONENT_NAME || "");
          const componentId = String(node.fields?.COMPONENT_ID || "");
          const componentRobotId = String(node.fields?.COMPONENT_ROBOT_ID || "");
          const component = (input.componentInventory || []).find((item) => String(item.instanceId || item.componentId || item.id || "") === componentId
            && String(item.robotId || "") === componentRobotId);
          if (!component || !componentId || !componentRobotId) add("COMPONENT_MISSING", node, { componentName });
          else if (componentTypeFor(component) !== record.componentType) add("COMPONENT_WRONG_TYPE", node, { componentName, componentType: record.componentType });
          args.push(JSON.stringify(componentName));
        }
        else args.push(checkInput(node, paramInputName(index), parameter.type, context, parameter.name).code);
      });
      const type = record.signature?.returns || "void";
      expressionStack.delete(String(node.id));
      return { code: `${record.javascriptLowering}(${args.join(", ")})`, type, asynchronous: String(record.execution || "").includes("async-cancellable") };
    }
    add("BLOCK_TYPE", node, { name: node.typeId, expected: "expression", actual: "statement" });
    expressionStack.delete(String(node.id));
    return { code: "undefined", type: "unknown" };
  }
  function chain(id, context = stackContext) {
    let result = "";
    let nextId = id;
    let depth = 0;
    while (nextId) {
      if (depth++ > 100000) { add("BLOCK_CYCLE", nodeById.get(String(nextId)), { name: "next" }); break; }
      const node = nodeById.get(String(nextId));
      if (!node) break;
      if (visited.has(String(node.id))) { add("BLOCK_CYCLE", node, { name: "connection" }); break; }
      visited.add(String(node.id));
      if (!node.disabled) result += statement(node, context);
      nextId = node.next ? String(node.next) : "";
    }
    return result;
  }
  function nested(node, name, context) { const id = node.inputs?.[name]?.blockId; if (!id) return ""; if ((context.depth || 0) >= 256) { add("BLOCK_RANGE", node, { name: "nesting" }); return ""; } return chain(id, { ...context, depth: (context.depth || 0) + 1 }); }
  function switchCases(node, context) {
    const indent = "  ";
    let result = "";
    let id = node.inputs?.CASES?.blockId ? String(node.inputs.CASES.blockId) : "";
    let count = 0;
    let hasDefault = false;
    const caseValues = new Set();
    const nextContext = { ...context, switchDepth: context.switchDepth + 1, depth: (context.depth || 0) + 1 };
    while (id) {
      if (count++ >= 64) { add("BLOCK_RANGE", node, { name: "switch cases" }); break; }
      const branch = nodeById.get(id);
      if (!branch || visited.has(id)) { add("BLOCK_CYCLE", branch || node, { name: "switch case" }); break; }
      if (!["switch_case", "switch_default"].includes(branch.typeId)) { add("BLOCK_TYPE", branch, { expected: "switch case", actual: branch.typeId }); break; }
      visited.add(id);
      if (branch.typeId === "switch_case") {
        const caseValue = String(branch.fields?.CASE_VALUE || "");
        if (caseValues.has(caseValue)) add("BLOCK_DUPLICATE_CASE", branch, { name: caseValue });
        caseValues.add(caseValue);
        result += `${indent}  case ${JSON.stringify(caseValue)}:\n${nested(branch, "BODY", nextContext)}${indent}    break;\n`;
      } else {
        if (hasDefault) add("BLOCK_DUPLICATE_CASE", branch, { name: "default" });
        hasDefault = true;
        result += `${indent}  default:\n${nested(branch, "BODY", nextContext)}${indent}    break;\n`;
      }
      id = branch.next ? String(branch.next) : "";
    }
    if (!count) add("BLOCK_SWITCH_CASES", node, {});
    return result;
  }
  function statement(node, context) {
    const indent = "  ";
    const child = (name, next = context) => nested(node, name, next);
    const expressionStatement = (expr) => `${indent}${expr.asynchronous ? "await " : ""}${expr.code};\n`;
    if (node.typeId === "variable_declare") {
      if (context.main && !context.functionType) add("BLOCK_CONTEXT", node, { name: "global variable declaration" });
      const symbol = declarations.get(String(node.fields?.SYMBOL_ID || "")); const type = symbol?.type || "number"; const initial = node.inputs?.INIT?.blockId ? checkInput(node, "INIT", type, context).code : defaults[type];
      return `${indent}let ${symbol?.name || "invalidIdentifier"} = ${initial};\n`;
    }
    if (node.typeId === "variable_set") { const symbol = getSymbol(node); const value = checkInput(node, "VALUE", symbol?.type || null, context); return `${indent}${symbol?.name || "invalidIdentifier"} = ${value.code};\n`; }
    if (node.typeId === "program_entry") return child("BODY", { ...context, main: true });
    if (node.typeId === "if_then_else") { const condition = checkInput(node, "CONDITION", "boolean", context); return `${indent}if (${condition.code}) {\n${child("THEN", context)}${indent}} else {\n${child("ELSE", context)}${indent}}\n`; }
    if (node.typeId === "while_loop") { const condition = checkInput(node, "CONDITION", "boolean", context); return `${indent}while (${condition.code}) {\n${child("BODY", { ...context, loops: context.loops + 1 })}${indent}}\n`; }
    if (node.typeId === "do_while_loop") { const condition = checkInput(node, "CONDITION", "boolean", context); return `${indent}do {\n${child("BODY", { ...context, loops: context.loops + 1 })}${indent}} while (${condition.code});\n`; }
    if (node.typeId === "repeat_count") { const count = checkInput(node, "COUNT", "number", context); if (context.repeatDepth) add("BLOCK_CONTEXT", node, { name: "repeat" }); const countNode = get(node, "COUNT"); if (countNode?.typeId === "number_literal" && (!Number.isInteger(Number(countNode.fields?.VALUE)) || Number(countNode.fields?.VALUE) < 0)) add("BLOCK_RANGE", countNode, { name: "repeat count" }); const id = String(node.id).replace(/[^A-Za-z0-9_]/g, "_"); return `${indent}for (let __repeat_${id} = 0; __repeat_${id} < ${count.code}; __repeat_${id} += 1) {\n${child("BODY", { ...context, loops: context.loops + 1, repeatDepth: context.repeatDepth + 1 })}${indent}}\n`; }
    if (node.typeId === "for_range") { const symbol = getSymbol(node); if (symbol?.type !== "number") add("BLOCK_TYPE", node, { name: symbol?.name || "", expected: "number", actual: symbol?.type || "unknown" }); const from = checkInput(node, "FROM", "number", context); const to = checkInput(node, "TO", "number", context); const step = checkInput(node, "STEP", "number", context); const stepNode = get(node, "STEP"); if (stepNode?.typeId === "number_literal" && Number(stepNode.fields?.VALUE) === 0) add("BLOCK_RANGE", stepNode, { name: "step" }); const name = symbol?.name || "invalidIdentifier"; return `${indent}for (${name} = ${from.code}; ${step.code} >= 0 ? ${name} <= ${to.code} : ${name} >= ${to.code}; ${name} += ${step.code}) {\n${child("BODY", { ...context, loops: context.loops + 1 })}${indent}}\n`; }
    if (node.typeId === "break_loop") { if (!context.loops && !context.switchDepth) add("BLOCK_CONTEXT", node, { name: "break" }); return `${indent}break;\n`; }
    if (node.typeId === "continue_loop") { if (!context.loops) add("BLOCK_CONTEXT", node, { name: "continue" }); return `${indent}continue;\n`; }
    if (node.typeId === "debug_pause") return `${indent}await __debug.pause();\n`;
    if (node.typeId === "switch_text") { const value = checkInput(node, "VALUE", "string", context); return `${indent}switch (${value.code}) {\n${switchCases(node, context)}${indent}}\n`; }
    if (node.typeId === "return_value") { if (!context.functionType) add("BLOCK_CONTEXT", node, { name: "return" }); const value = checkInput(node, "VALUE", context.functionType, context); return `${indent}return ${value.code};\n`; }
    if (node.typeId === "task_declare" || node.typeId === "function_declare") return "";
    if (node.typeId === "user_call") {
      const callable = callableById.get(String(node.fields?.SYMBOL_ID || ""));
      if (!callable) { add("BLOCK_UNKNOWN_SYMBOL", node); return ""; }
      if ((callable.node.mutation?.parameters || []).length) { add("BLOCK_ARITY", node, { name: callable.name }); return ""; }
      return `${indent}await ${callable.name}(__reduc, __debug);\n`;
    }
    if (COMMAND_BY_BLOCK.has(node.typeId)) { const expr = expression(node, context); if (expr.type !== "void") return expressionStatement(expr); return expressionStatement(expr); }
    if (node.disabled) return "";
    if (!STRUCTURAL.has(node.typeId)) add("BLOCK_UNKNOWN_TYPE", node, { name: node.typeId || "" });
    return "";
  }

  const roots = nodes.filter((node) => !nodes.some((parent) => String(parent.next || "") === String(node.id) || Object.values(parent.inputs || {}).some((item) => String(item?.blockId || "") === String(node.id))));
  const entries = nodes.filter((node) => node.typeId === "program_entry");
  if (entries.length !== 1) add("BLOCK_ENTRY_COUNT", entries[0] || roots[0], { count: entries.length });
  const source = ["// Generated locally from BlocksDocumentV1; this artifact is not executed by the editor."];
  for (const node of roots.filter((item) => item.typeId === "variable_declare")) source.push(chain(String(node.id)));
  for (const node of roots.filter((item) => ["task_declare", "function_declare"].includes(item.typeId))) {
    const callable = callableById.get(String(node.fields?.SYMBOL_ID || ""));
    if (!callable || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(callable.name)) { add("BLOCK_INVALID_NAME", node, { name: callable?.name || "" }); continue; }
    const functionType = node.typeId === "function_declare" ? callable.returnType : null;
    const body = chain(node.inputs?.BODY?.blockId, { ...stackContext, functionType });
    source.push(`async function ${callable.name}(__reduc, __debug = { pause: async () => {} }) {\n${body}}`);
    if (functionType && !body.includes("return ")) add("REDUC_MISSING_RETURN", node, { name: callable.name });
  }
  source.push("export async function main(__reduc, __debug = { pause: async () => {} }) {");
  const rootEntry = entries[0];
  if (rootEntry) source.push(chain(String(rootEntry.id)));
  for (const node of roots) if (node !== rootEntry && !["variable_declare", "task_declare", "function_declare"].includes(node.typeId) && !node.disabled) add("BLOCK_ORPHAN", node, { name: node.typeId });
  source.push("}");
  const generatedSource = source.join("\n");
  if (new TextEncoder().encode(generatedSource).length > 1024 * 1024) add("BLOCK_RANGE", rootEntry, { name: "generated code" });
  return { ok: diagnostics.length === 0, diagnostics, diagnosticCountTruncated, generatedSource: diagnostics.length ? "" : generatedSource, sourceMap: [] };
}

function convertBlocksToReduc(input = {}) {
  const validation = compileBlocks(input);
  if (!validation.ok) return validation;
  const document = input.document || {};
  const locale = document.locale === "en-US" ? "en-US" : "pt-BR";
  const language = ReducGrammar.locales[locale];
  const nodes = Array.isArray(document.blocks) ? document.blocks : [];
  const nodeById = new Map(nodes.map((node) => [String(node.id), node]));
  const variables = new Map(nodes.filter((node) => node.typeId === "variable_declare").map((node) => [String(node.fields?.SYMBOL_ID || ""), { name: String(node.fields?.NAME || ""), type: node.fields?.VALUE_TYPE || "number" }]));
  const callables = new Map(nodes.filter((node) => ["task_declare", "function_declare"].includes(node.typeId)).map((node) => [String(node.fields?.SYMBOL_ID || ""), { name: String(node.fields?.NAME || ""), typeId: node.typeId, returnType: node.fields?.RETURN_TYPE || "void", node }]));
  const commandByType = COMMAND_BY_BLOCK;
  const diagnostics = [];
  const add = (code, node, params = {}) => diagnostics.push({ code, params, blockId: String(node?.id || ""), start: { line: 1, column: 1 }, end: { line: 1, column: 1 } });
  const get = (node, name) => { const id = node?.inputs?.[name]?.blockId; return id ? nodeById.get(String(id)) || null : null; };
  const expr = (node) => {
    if (!node) return "";
    const type = node.typeId;
    if (type === "number_literal") return String(Number(node.fields?.VALUE));
    if (type === "text_literal") return JSON.stringify(String(node.fields?.VALUE || ""));
    if (type === "boolean_literal") return language.literals[node.fields?.VALUE === "true" || node.fields?.VALUE === true ? "true" : "false"];
    if (type === "variable_get") return variables.get(String(node.fields?.SYMBOL_ID || ""))?.name || "";
    if (["arithmetic", "logic_compare", "logic_and_or"].includes(type)) {
      const left = expr(get(node, "LEFT")); const right = expr(get(node, "RIGHT")); const op = String(node.fields?.OPERATOR || "+");
      return `(${left} ${op === "and" ? language.keywords.and : op === "or" ? language.keywords.or : op} ${right})`;
    }
    if (type === "logic_not") return `!${expr(get(node, "VALUE"))}`;
    const command = commandByType.get(type);
    if (command) {
      const name = command.spellings?.[locale] || command.name;
      const args = (command.signature?.parameters || []).map((parameter, index) => parameter.name === "componentName"
        ? JSON.stringify(String(node.fields?.COMPONENT_NAME || ""))
        : expr(get(node, paramInputName(index))));
      return `${name}(${args.join(", ")})`;
    }
    if (type === "user_call") {
      const callable = callables.get(String(node.fields?.SYMBOL_ID || ""));
      return callable ? `${callable.name}()` : "";
    }
    return "";
  };
  const body = (id, level, requireNonempty = false, owner = null) => {
    const lines = [];
    let next = id ? String(id) : "";
    const seen = new Set();
    while (next) {
      if (seen.has(next)) { add("BLOCK_CYCLE", nodeById.get(next), { name: "next" }); break; }
      seen.add(next);
      const node = nodeById.get(next);
      if (!node) break;
      if (!node.disabled) lines.push(...statement(node, level));
      next = node.next ? String(node.next) : "";
    }
    if (requireNonempty && !lines.length) add("BLOCK_MISSING_INPUT", owner, { name: "body" });
    return lines;
  };
  const statement = (node, level) => {
    const pad = "    ".repeat(level);
    const typed = (symbol) => `${language.types[symbol.type]} ${symbol.name}`;
    const child = (name, required = false) => body(node.inputs?.[name]?.blockId, level + 1, required, node);
    if (node.typeId === "variable_declare") {
      const symbol = variables.get(String(node.fields?.SYMBOL_ID || ""));
      const initial = get(node, "INIT");
      return [`${pad}${typed(symbol || { name: "invalid", type: "number" })}${initial ? ` = ${expr(initial)}` : ""}`];
    }
    if (node.typeId === "variable_set") return [`${pad}${variables.get(String(node.fields?.SYMBOL_ID || ""))?.name || "invalid"} = ${expr(get(node, "VALUE"))}`];
    if (node.typeId === "program_entry") return child("BODY");
    if (node.typeId === "if_then_else") {
      const lines = [`${pad}${language.keywords.if} (${expr(get(node, "CONDITION"))}) ${language.keywords.then} {`, ...child("THEN", true), `${pad}}`];
      const alternate = child("ELSE");
      if (alternate.length) lines.push(`${pad}${language.keywords.else} {`, ...alternate, `${pad}}`);
      return lines;
    }
    if (node.typeId === "while_loop") return [`${pad}${language.keywords.while} (${expr(get(node, "CONDITION"))}) ${language.keywords.do} {`, ...child("BODY", true), `${pad}}`];
    if (node.typeId === "do_while_loop") return [`${pad}${language.keywords.do} {`, ...body(node.inputs?.BODY?.blockId, level + 1, true, node), `${pad}} ${language.keywords.while} (${expr(get(node, "CONDITION"))})`];
    if (node.typeId === "repeat_count") return [`${pad}${language.keywords.repeat} ${expr(get(node, "COUNT"))} ${language.keywords.times} {`, ...body(node.inputs?.BODY?.blockId, level + 1, true, node), `${pad}}`];
    if (node.typeId === "for_range") {
      const name = variables.get(String(node.fields?.SYMBOL_ID || ""))?.name || "invalid";
      return [`${pad}${language.keywords.for} ${name} ${language.keywords.from} ${expr(get(node, "FROM"))} ${language.keywords.to} ${expr(get(node, "TO"))} ${language.keywords.step} ${expr(get(node, "STEP"))} ${language.keywords.do} {`, ...child("BODY", true), `${pad}}`];
    }
    if (node.typeId === "break_loop") return [`${pad}${language.keywords.break}`];
    if (node.typeId === "continue_loop") return [`${pad}${language.keywords.continue}`];
    if (node.typeId === "debug_pause") return [`${pad}Pausar()`];
    if (node.typeId === "switch_text") {
      const lines = [`${pad}${language.keywords.switchText} (${expr(get(node, "VALUE"))}) {`];
      let id = node.inputs?.CASES?.blockId ? String(node.inputs.CASES.blockId) : "";
      const seen = new Set();
      while (id && !seen.has(id)) {
        seen.add(id); const branch = nodeById.get(id); if (!branch) break;
        const isDefault = branch.typeId === "switch_default";
        lines.push(`${pad}  ${language.keywords[isDefault ? "default" : "case"]}${isDefault ? "" : ` ${JSON.stringify(String(branch.fields?.CASE_VALUE || ""))}`}:`);
        lines.push(...body(branch.inputs?.BODY?.blockId, level + 2));
        id = branch.next ? String(branch.next) : "";
      }
      lines.push(`${pad}}`);
      return lines;
    }
    if (node.typeId === "return_value") return [`${pad}${language.keywords.return} ${expr(get(node, "VALUE"))}`];
    if (node.typeId === "user_call") { const callable = callables.get(String(node.fields?.SYMBOL_ID || "")); return [`${pad}${callable?.name || "invalid"}()`]; }
    if (commandByType.has(node.typeId)) return [`${pad}${expr(node)}`];
    return [];
  };
  const roots = nodes.filter((node) => !nodes.some((parent) => String(parent.next || "") === String(node.id) || Object.values(parent.inputs || {}).some((item) => String(item?.blockId || "") === String(node.id))));
  const globals = roots.filter((node) => node.typeId === "variable_declare");
  const callablesRoot = roots.filter((node) => ["task_declare", "function_declare"].includes(node.typeId));
  const entry = nodes.find((node) => node.typeId === "program_entry");
  const lines = [];
  for (const node of globals) lines.push(...statement(node, 0));
  for (const node of callablesRoot) {
    const callable = callables.get(String(node.fields?.SYMBOL_ID || ""));
    if (!callable) continue;
    const header = callable.typeId === "task_declare" ? `${language.keywords.task} ${callable.name}` : `${language.keywords.function} ${language.types[callable.returnType]} ${callable.name}`;
    lines.push(header, "{", ...body(node.inputs?.BODY?.blockId, 1, callable.typeId === "function_declare", node), "}");
  }
  lines.push(language.keywords.begin, ...body(entry?.inputs?.BODY?.blockId, 1, false, entry), language.keywords.end);
  const generatedSource = lines.join("\n");
  if (new TextEncoder().encode(generatedSource).length > 1024 * 1024) add("BLOCK_RANGE", entry, { name: "converted source" });
  return { ok: diagnostics.length === 0, diagnostics: diagnostics.slice(0, 100), diagnosticCountTruncated: Math.max(0, diagnostics.length - 100), generatedSource: diagnostics.length ? "" : generatedSource, sourceMap: [] };
}

export { registerBlockDefinitions, compileBlocks, convertBlocksToReduc };
