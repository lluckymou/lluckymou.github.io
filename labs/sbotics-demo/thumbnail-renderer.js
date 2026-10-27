import * as THREE from "three";
import { asset } from "./asset-registry.js?imp-ux-02-standalone-assets-20261027-3";
import { ThreeStage } from "./three-stage.js?imp-ux-02-standalone-assets-20261027-1";

const THUMBNAIL_VERSION = "tile-3d-background-robot-arena-part-preview-v20";
const THUMBNAIL_SIZE = 128;
const THUMBNAIL_BACKGROUND_DEFAULT = "#152637";
const ROBOT_COMPONENT_PREVIEW_BACKGROUND = "#354048";
const THUMBNAIL_STORAGE_PREFIX = "sbotics.imp-ux-02.thumbnail.";
const descriptors = new Map();
const memoryCache = new Map();
const activeRequests = new Map();
let renderQueue = Promise.resolve();
let thumbnailStage = null;
let thumbnailHost = null;
let observerStarted = false;

function stableValue(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableValue);
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  return `${(hash >>> 0).toString(16).padStart(8, "0")}-${value.length.toString(16)}`;
}

function cacheKeyFor(kind, descriptor) {
  return `${THUMBNAIL_VERSION}:${kind}:${hashString(stableStringify(descriptor))}`;
}

// DEVICE-CACHE only: generated previews are disposable and never account data.
function storageKey(key) {
  return `${THUMBNAIL_STORAGE_PREFIX}${key}`;
}

function readStoredPreview(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  try {
    const value = globalThis.localStorage?.getItem(storageKey(key));
    if (value) memoryCache.set(key, value);
    return value || "";
  } catch {
    return "";
  }
}

function writeStoredPreview(key, value) {
  memoryCache.set(key, value);
  try {
    globalThis.localStorage?.setItem(storageKey(key), value);
  } catch {
    // A full or blocked local store must not prevent the current thumbnail.
  }
}

function nextFrame() {
  return new Promise((resolve) => {
    if (globalThis.requestAnimationFrame) requestAnimationFrame(() => requestAnimationFrame(resolve));
    else setTimeout(resolve, 32);
  });
}

function yieldToInterface() {
  return new Promise((resolve) => {
    if (globalThis.requestIdleCallback) requestIdleCallback(resolve, { timeout: 250 });
    else setTimeout(resolve, 32);
  });
}

function ensureRenderer() {
  if (thumbnailStage) return thumbnailStage;
  thumbnailHost = document.createElement("div");
  thumbnailHost.className = "thumbnail-renderer-host";
  thumbnailHost.style.cssText = "position:fixed;left:-10000px;top:0;width:128px;height:128px;overflow:hidden;pointer-events:none;opacity:0;";
  document.body.append(thumbnailHost);
  thumbnailStage = new ThreeStage({ interactive: false });
  thumbnailStage.mount(thumbnailHost);
  thumbnailStage.renderer.setPixelRatio(1);
  thumbnailStage.renderer.shadowMap.enabled = false;
  return thumbnailStage;
}

function fitCamera(stage, kind) {
  stage.world.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  stage.world.traverse((item) => {
    if (!item.isMesh && !item.isLine && !item.isLineSegments) return;
    const pickableTileSurface = kind === "tile" && item.userData?.pickKind === "tile";
    if (!item.visible || item.userData?.debugOnly || (item.userData?.pickKind && !pickableTileSurface)) return;
    if (item === stage.arenaPlacementSurface) return;
    const materials = Array.isArray(item.material) ? item.material : [item.material];
    if (materials.length && materials.every((material) => material?.transparent && Number(material.opacity) <= 0)) return;
    bounds.expandByObject(item);
  });
  if (bounds.isEmpty()) {
    bounds.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(10, 10, 10));
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z, 1);
  const fov = 38;
  const objectThumbnail = kind === "arena-object";
  const robotPartThumbnail = kind === "robot-part";
  const tileThumbnail = kind === "tile";
  const closeObjectThumbnail = objectThumbnail || robotPartThumbnail;
  const baseDistance = Math.max(robotPartThumbnail ? 2.2 : objectThumbnail ? 5.5 : tileThumbnail ? 12 : 24, (extent * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov * 0.5)) * (closeObjectThumbnail ? 1.1 : tileThumbnail ? 1.02 : 1.35));
  const distance = robotPartThumbnail ? baseDistance * 1.5 : baseDistance;
  const theta = THREE.MathUtils.degToRad(kind === "robot" || kind === "robot-part" ? 214 : 138);
  const phi = THREE.MathUtils.degToRad(tileThumbnail ? 50 : 68);
  stage.camera.fov = fov;
  stage.camera.aspect = 1;
  stage.camera.near = Math.max(0.1, distance * 0.01);
  stage.camera.far = Math.max(2000, distance * 8 + extent * 2);
  stage.camera.position.set(
    center.x + distance * Math.sin(phi) * Math.sin(theta),
    center.y + distance * Math.cos(phi),
    center.z + distance * Math.sin(phi) * Math.cos(theta)
  );
  stage.camera.lookAt(center);
  stage.camera.updateProjectionMatrix();
}

function thumbnailSpec(descriptor) {
  if (descriptor.kind === "arena-object") {
    return {
      section: "arena-object-thumbnail",
      locale: "pt-BR",
      camera: { zoom: 1, orbitX: 0, orbitY: 0, panX: 0, panY: 0 },
      arenaObjectThumbnail: {
        type: descriptor.objectType,
        material: descriptor.material || "ColorWhite",
        scale: descriptor.scale || { x: 1, y: 1, z: 1 }
      },
      arenaTiles: [],
      arenaSettings: {},
      arenaRuntimeConfig: null,
      arenaGridVisible: false,
      diagnostics: false,
      preflight: false,
      competitionActive: false,
      showFps: false
    };
  }
  if (descriptor.kind === "robot" || descriptor.kind === "robot-part") {
    return {
      section: "robots",
      locale: "pt-BR",
      camera: { zoom: 1, orbitX: 0, orbitY: 0, panX: 0, panY: 0 },
      robotMode: "inspect",
      robotParts: descriptor.kind === "robot-part"
        ? [{ instanceId: "component-preview", typeId: descriptor.typeId, position: { x: 0, y: 0, z: 0 } }]
        : descriptor.parts || [],
      robotPartColors: descriptor.colors || {},
      robotPartRotations: descriptor.rotations || {},
      robotPartOrientations: descriptor.orientations || {},
      robotSelection: "",
      robotSelectionHighlight: false,
      robotGroupsVisible: false,
      robotGroupAssignments: {},
      robotGroupColors: {},
      selectedBlock: null,
      robotPaintColor: "white",
      robotForceExclude: false,
      threeSelection: "",
      arenaTiles: [],
      arenaSettings: {},
      arenaRuntimeConfig: null,
      arenaGridVisible: false,
      diagnostics: false,
      preflight: false,
      competitionActive: false,
      showFps: false
    };
  }
  if (descriptor.kind === "tile") {
    return {
      section: "arenas",
      locale: "pt-BR",
      camera: { zoom: 1, orbitX: 0, orbitY: 0, panX: 0, panY: 0 },
      arenaMode: "inspect",
      arenaId: "tile-thumbnail",
      arenaModel: null,
      arenaTiles: descriptor.tiles || [],
      arenaSettings: {},
      arenaRuntimeConfig: null,
      arenaGridVisible: false,
      arenaPlacement: null,
      arenaObjectPreview: null,
      arenaScoreSideLabels: null,
      threeSelection: "",
      diagnostics: false,
      preflight: false,
      competitionActive: false,
      showFps: false
    };
  }
  return {
    section: "arenas",
    locale: "pt-BR",
    camera: { zoom: 1, orbitX: 0, orbitY: 0, panX: 0, panY: 0 },
    arenaMode: "inspect",
    arenaId: descriptor.arenaId || "thumbnail",
    arenaModel: descriptor.model || null,
    arenaTiles: descriptor.tiles || [],
    arenaSettings: descriptor.settings || {},
    arenaRuntimeConfig: null,
    arenaGridVisible: false,
    arenaPlacement: null,
    arenaObjectPreview: null,
    arenaScoreSideLabels: null,
    threeSelection: "",
    diagnostics: false,
    preflight: false,
    competitionActive: false,
    showFps: false
  };
}

async function renderPreview(descriptor) {
  const stage = ensureRenderer();
  stage.update(thumbnailSpec(descriptor));
  const backgroundColor = descriptor.kind === "tile"
    ? descriptor.backgroundColor || "#ffffff"
    : descriptor.backgroundColor || (descriptor.kind === "robot-part" ? ROBOT_COMPONENT_PREVIEW_BACKGROUND : THUMBNAIL_BACKGROUND_DEFAULT);
  stage.renderer.setClearColor(backgroundColor, 1);
  await Promise.race([
    stage.whenAssetsReady(),
    new Promise((resolve) => setTimeout(resolve, 1800))
  ]);
  await nextFrame();
  if (descriptor.kind === "robot-part" && descriptor.previewRotation) {
    const part = stage.robotComponents.get("component-preview");
    if (part) {
      const rotation = descriptor.previewRotation;
      part.quaternion.setFromEuler(new THREE.Euler(
        THREE.MathUtils.degToRad(Number(rotation.x) || 0),
        THREE.MathUtils.degToRad(Number(rotation.y) || 0),
        THREE.MathUtils.degToRad(Number(rotation.z) || 0),
        "XYZ"
      ));
    }
  }
  stage.renderer.shadowMap.enabled = false;
  fitCamera(stage, descriptor.kind);
  stage.renderer.render(stage.scene, stage.camera);
  return stage.canvas.toDataURL("image/webp", 0.82);
}

function thumbnailBadgeMarkup(element) {
  return element.dataset.thumbnailBadge === "obr"
    ? `<img class="thumbnail-badge thumbnail-badge-obr" src="${asset.obrLogo}" alt="" aria-hidden="true" />`
    : "";
}

function applyPreview(element, dataUrl) {
  if (!element?.isConnected || !dataUrl) return;
  element.classList.remove("is-loading", "is-failed");
  element.classList.add("is-ready");
  element.innerHTML = `<img class="thumbnail-preview-image" src="${dataUrl}" alt="" aria-hidden="true" />${thumbnailBadgeMarkup(element)}`;
}

function applyFailure(element) {
  if (!element?.isConnected) return;
  element.classList.remove("is-loading");
  element.classList.add("is-failed");
}

async function hydrateElement(element) {
  const key = element?.dataset?.thumbnailKey;
  if (!key || element.dataset.thumbnailStatus === "pending" || element.dataset.thumbnailStatus === "ready") return;
  if (element.closest("[hidden]")) return;
  const descriptor = descriptors.get(key);
  if (!descriptor) return;
  element.dataset.thumbnailStatus = "pending";
  const cached = readStoredPreview(key);
  if (cached) {
    element.dataset.thumbnailStatus = "ready";
    applyPreview(element, cached);
    return;
  }
  let request = activeRequests.get(key);
  if (!request) {
    request = renderQueue.then(async () => {
      await yieldToInterface();
      return renderPreview(descriptor);
    }).then((dataUrl) => {
      writeStoredPreview(key, dataUrl);
      return dataUrl;
    });
    renderQueue = request.catch(() => {});
    activeRequests.set(key, request);
    request.finally(() => activeRequests.delete(key));
  }
  try {
    const dataUrl = await request;
    document.querySelectorAll(`[data-thumbnail-key="${key}"]`).forEach((item) => {
      item.dataset.thumbnailStatus = "ready";
      applyPreview(item, dataUrl);
    });
  } catch {
    element.dataset.thumbnailStatus = "failed";
    applyFailure(element);
  }
}

function hydrate(root = document) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll("[data-thumbnail-key]").forEach((element) => { void hydrateElement(element); });
}

function startObserver() {
  if (observerStarted || !globalThis.MutationObserver || !document.body) return;
  observerStarted = true;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches?.("[data-thumbnail-key]")) void hydrateElement(node);
        hydrate(node);
      }
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
  hydrate(document);
}

export function registerThumbnail(kind, descriptor) {
  const normalized = { kind, ...descriptor };
  const key = cacheKeyFor(kind, normalized);
  descriptors.set(key, normalized);
  startObserver();
  return key;
}

export function thumbnailMarkup(kind, descriptor, fallbackMarkup, className = "", badge = "") {
  const key = registerThumbnail(kind, descriptor);
  const badgeMarkup = badge === "obr" ? `<img class="thumbnail-badge thumbnail-badge-obr" src="${asset.obrLogo}" alt="" aria-hidden="true" />` : "";
  return `<span class="thumbnail-preview ${className}" data-thumbnail-key="${key}" data-thumbnail-badge="${badge}" data-thumbnail-status="loading" aria-hidden="true">${fallbackMarkup}${badgeMarkup}</span>`;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startObserver, { once: true });
else startObserver();
