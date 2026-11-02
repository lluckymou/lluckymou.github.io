import { buildGeneratedJavaScriptArtifact, buildJavaScriptArtifact, validateProgramSource } from "./program-profile.js?imp-ux-03-blockly-drawer-controls-20261101-1";
import { transpilePythonLike } from "./python-like-transpiler.js?imp-ux-03-blockly-drawer-controls-20261101-1";
import { compileReduc } from "./reduc-compiler.js?imp-ux-03-blockly-drawer-controls-20261101-1";
import { compileBlocks, convertBlocksToReduc } from "./blocks-compiler.js?imp-ux-03-blockly-drawer-controls-20261101-1";

function validate(input) {
  if (input.language === "pythonlike") return transpilePythonLike(input);
  if (input.language === "reduc") return compileReduc(input);
  if (input.language === "blocks") return compileBlocks(input);
  return validateProgramSource(input);
}

function transpile(input) {
  const result = transpilePythonLike(input);
  if (!result.ok) return result;
  const locale = input.targetLocale === "pt-BR" ? "pt-BR" : "en-US";
  const compiled = compileReduc({ source: result.generatedSource, locale, componentInventory: input.componentInventory });
  const mapDiagnostic = (diagnostic) => {
    const mapPosition = (position, edge) => {
      if (!position) return position;
      const row = result.sourceMap.find((entry) => entry.generatedLine === position.line);
      return row?.source?.[edge] || position;
    };
    return { ...diagnostic, start: mapPosition(diagnostic.start, "start"), end: mapPosition(diagnostic.end, "end") };
  };
  const compileDiagnostics = (compiled.diagnostics || []).map(mapDiagnostic);
  const diagnostics = [...(result.diagnostics || []), ...compileDiagnostics];
  return {
    ...result,
    ok: compiled.ok && !diagnostics.some((item) => item.severity !== "warning"),
    diagnostics,
    diagnosticCountTruncated: Math.max(result.diagnosticCountTruncated || 0, compiled.diagnosticCountTruncated || 0),
    conversionWarnings: compileDiagnostics.filter((item) => item.severity === "warning")
  };
}

async function build(input) {
  if (input.language === "javascript") return buildJavaScriptArtifact(input);

  let generated;
  let authoredSource = String(input.source || "");
  let language = input.language;
  if (language === "pythonlike") {
    const transpiled = transpilePythonLike(input);
    if (!transpiled.ok) return transpiled;
    const compiled = compileReduc({ source: transpiled.generatedSource, locale: "en-US", componentInventory: input.componentInventory });
    const mapPosition = (position, edge) => {
      if (!position) return position;
      const row = transpiled.sourceMap.find((entry) => entry.generatedLine === position.line);
      return row?.source?.[edge] ? row.source[edge] : position;
    };
    const mapDiagnostic = (diagnostic) => ({ ...diagnostic, start: mapPosition(diagnostic.start, "start"), end: mapPosition(diagnostic.end, "end") });
    if (!compiled.ok) {
      return {
        ...transpiled,
        ok: false,
        diagnostics: [...(transpiled.diagnostics || []), ...(compiled.diagnostics || []).map(mapDiagnostic)],
        diagnosticCountTruncated: Math.max(transpiled.diagnosticCountTruncated || 0, compiled.diagnosticCountTruncated || 0),
        convertedJavaScriptSource: "",
        artifact: undefined
      };
    }
    generated = compiled;
    const pythonRows = new Map(transpiled.sourceMap.map((row) => [row.generatedLine, row.source]));
    generated.sourceMap = (compiled.sourceMap || []).map((row) => ({
      generatedLine: row.generatedLine,
      source: pythonRows.get(row.source?.line) || row.source || null
    })).filter((row) => row.source);
  } else if (language === "reduc") {
    generated = compileReduc(input);
    if (!generated.ok) return generated;
  } else if (language === "blocks") {
    generated = compileBlocks(input);
    if (!generated.ok) return generated;
    let reducEquivalentSource = "";
    try {
      const reducEquivalent = convertBlocksToReduc(input);
      if (reducEquivalent.ok) reducEquivalentSource = String(reducEquivalent.generatedSource || "");
    } catch {}
    generated = {
      ...generated,
      reducEquivalentSource
    };
    authoredSource = JSON.stringify(input.document || {});
  } else {
    return { ok: false, diagnostics: [{ code: "JS_ENTRYPOINT", severity: "error", start: { line: 1, column: 1 }, end: { line: 1, column: 1 }, params: { reason: "language" } }], diagnosticCountTruncated: 0 };
  }

  const artifactResult = await buildGeneratedJavaScriptArtifact({
    generatedSource: generated.generatedSource,
    authoredSource,
    sourceMap: generated.sourceMap || [],
    programId: input.programId,
    authoredRevision: input.authoredRevision,
    language
  });
  return {
    ...generated,
    ok: artifactResult.ok,
    diagnostics: [...(generated.diagnostics || []), ...(artifactResult.diagnostics || [])],
    diagnosticCountTruncated: Math.max(generated.diagnosticCountTruncated || 0, artifactResult.diagnosticCountTruncated || 0),
    artifact: artifactResult.artifact,
    buildFailure: artifactResult.ok ? "" : "artifact"
  };
}

function convertPythonLikeToJavaScript(input, transpiled = transpilePythonLike(input)) {
  if (!transpiled.ok) return transpiled;
  const converted = compileReduc({
    source: transpiled.generatedSource,
    locale: "en-US",
    componentInventory: input.componentInventory
  });
  const mapPosition = (position, edge) => {
    if (!position) return position;
    const row = transpiled.sourceMap.find((entry) => entry.generatedLine === position.line);
    return row?.source?.[edge] ? row.source[edge] : position;
  };
  const mapDiagnostic = (diagnostic) => ({
    ...diagnostic,
    start: mapPosition(diagnostic.start, "start"),
    end: mapPosition(diagnostic.end, "end")
  });
  return {
    ...transpiled,
    ok: converted.ok,
    diagnostics: [...(transpiled.diagnostics || []), ...(converted.diagnostics || []).map(mapDiagnostic)],
    diagnosticCountTruncated: Math.max(converted.diagnosticCountTruncated || 0, transpiled.diagnosticCountTruncated || 0),
    convertedJavaScriptSource: converted.convertedJavaScriptSource || "",
    conversionWarnings: (converted.conversionWarnings || []).map(mapDiagnostic),
    sourceMap: transpiled.sourceMap
  };
}

self.addEventListener("message", async (event) => {
  const request = event.data || {};
  const { requestId, kind } = request;
  try {
    if (kind === "validate") {
      const input = request.input || {};
      const result = validate(input);
      self.postMessage({ requestId, kind, result });
      return;
    }
    if (kind === "transpile") {
      const result = transpile(request.input || {});
      self.postMessage({ requestId, kind, result });
      return;
    }
    if (kind === "convert-pythonlike-to-javascript") {
      const result = convertPythonLikeToJavaScript(request.input || {});
      self.postMessage({ requestId, kind, result });
      return;
    }
    if (kind === "convert-blocks-to-reduc") {
      const result = convertBlocksToReduc(request.input || {});
      self.postMessage({ requestId, kind, result });
      return;
    }
    if (kind === "build") {
      const result = await build(request.input || {});
      self.postMessage({ requestId, kind, result });
      return;
    }
    self.postMessage({ requestId, kind, error: { code: "UNKNOWN_REQUEST" } });
  } catch (error) {
    self.postMessage({ requestId, kind, error: { code: "LOCAL_BUILD_FAILED", message: String(error?.message || error) } });
  }
});
