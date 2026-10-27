import { ThreeStage } from "./three-stage.js?imp-ux-02-standalone-assets-20261027-1";

const cloneReplayValue = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

// Simulator owns a separate Three.js stage. It reuses only the source-backed
// Arena geometry builders; its WebGLRenderer, Scene, camera lifecycle and
// runtime snapshot are independent from the Arena editor renderer.
class SimulationStage {
  constructor() {
    this.renderer = new ThreeStage();
    this.renderer.scope = "simulation";
  }

  mount(host) {
    this.renderer.mount(host);
  }

  update(spec = {}) {
    const robot = spec.simulatorRobot || {};
    this.renderer.update({
      ...spec,
      section: "simulator",
      arenaMode: "inspect",
      robotParts: robot.parts || [],
      robotSelection: spec.simulationSelection || "",
      robotSelectionHighlight: spec.simulationSelectionHighlight === true,
      robotGroupsVisible: false,
      robotGroupAssignments: {},
      robotGroupColors: {},
      selectedBlock: null,
      robotPaintColor: "white",
      robotForceExclude: false,
      robotPartColors: robot.colors || {},
      robotPartRotations: robot.rotations || {},
      robotPartOrientations: robot.orientations || {},
      threeSelection: spec.simulationSelection || "",
      arenaObjectPreview: null,
      diagnostics: spec.diagnostics === true,
      preflight: spec.preflight === true,
      competitionActive: spec.competitionActive === true,
      simulationSelection: spec.simulationSelection || "",
      simulationDiagnosticsComponents: spec.simulationDiagnosticsComponents || [],
      simulationDiagnosticsCollidersVisible: spec.simulationDiagnosticsCollidersVisible === true,
      simulationDiagnosticsArenaCollidersVisible: spec.simulationDiagnosticsArenaCollidersVisible === true,
      simulationCheckpointProjections: spec.simulationCheckpointProjections || [],
      simulatorRobot: robot,
      simulationRuntime: spec.simulationRuntime || null
    });
  }

  updateSimulationFrame(snapshot, routineLackProgressOverlay = null, arenaColliderDebug = null, arenaCollidersVisible = false) {
    this.renderer.updateSimulationFrame(snapshot, routineLackProgressOverlay, arenaColliderDebug, arenaCollidersVisible);
  }

  capturePassiveReplayScene(robotRuntimeGroups = [], cameraState = null) {
    const spec = this.renderer.spec;
    if (!spec || spec.section !== "simulator" || !Array.isArray(spec.arenaTiles) || !spec.simulatorRobot) return null;
    const simulatorRobot = cloneReplayValue(spec.simulatorRobot);
    delete simulatorRobot.pose;
    const camera = cameraState || spec.camera || {};
    return {
      schemaVersion: 1,
      passiveRendererProfileVersion: "passive-replay-render-v1",
      locale: String(spec.locale || "pt-BR"),
      camera: {
        orbitX: Number(camera.orbitX) || 0,
        orbitY: Number(camera.orbitY) || 0,
        zoom: Number(camera.zoom) > 0 ? Number(camera.zoom) : 1
      },
      arenaId: String(spec.arenaId || ""),
      arenaModel: spec.arenaModel == null ? null : String(spec.arenaModel),
      arenaSettings: cloneReplayValue(spec.arenaSettings || {}),
      arenaTiles: cloneReplayValue(spec.arenaTiles),
      simulatorRobot,
      simulationCheckpointProjections: cloneReplayValue(spec.simulationRuntime?.tracking?.checkpointProjections || spec.simulationCheckpointProjections || []),
      robotRuntimeGroups: cloneReplayValue(robotRuntimeGroups)
    };
  }

  mountPassiveReplay(host, sceneSnapshot, frame) {
    if (!host || !sceneSnapshot || sceneSnapshot.passiveRendererProfileVersion !== "passive-replay-render-v1") return false;
    this.renderer.passiveReplayMode = true;
    this.renderer.mount(host);
    this.renderer.update({
      section: "simulator",
      locale: sceneSnapshot.locale || "pt-BR",
      camera: sceneSnapshot.camera || {},
      arenaSettings: sceneSnapshot.arenaSettings || {},
      arenaRuntimeConfig: null,
      arenaGridVisible: false,
      arenaId: sceneSnapshot.arenaId || "",
      arenaModel: sceneSnapshot.arenaModel || null,
      arenaTiles: sceneSnapshot.arenaTiles || [],
      robotParts: sceneSnapshot.simulatorRobot.parts || [],
      robotPartColors: sceneSnapshot.simulatorRobot.colors || {},
      robotPartRotations: sceneSnapshot.simulatorRobot.rotations || {},
      robotPartOrientations: sceneSnapshot.simulatorRobot.orientations || {},
      simulatorRobot: sceneSnapshot.simulatorRobot,
      simulationReplayRobotRuntimeGroups: sceneSnapshot.robotRuntimeGroups || [],
      simulationRuntime: { status: "replay", robot: sceneSnapshot.simulatorRobot.pose || null, robotRuntime: { groups: sceneSnapshot.robotRuntimeGroups || [] }, objects: [], components: {} },
      simulationCheckpointProjections: sceneSnapshot.simulationCheckpointProjections || [],
      simulationSelection: "",
      simulationSelectionHighlight: false,
      simulationDiagnosticsComponents: [],
      simulationDiagnosticsCollidersVisible: false,
      simulationDiagnosticsArenaCollidersVisible: false,
      simulationDiagnosticsSelectionColors: {},
      diagnostics: false,
      preflight: false,
      competitionActive: false,
      starterKitColliderRequired: false,
      preflightKitPlacement: null,
      showFps: false
    });
    this.renderer.applyPassiveReplayFrame(frame?.entities || {}, frame?.visualComponents || {}, frame?.camera || sceneSnapshot.camera);
    return true;
  }

  updatePassiveReplayFrame(frame) {
    if (!this.renderer.passiveReplayMode || !frame) return;
    this.renderer.applyPassiveReplayFrame(frame.entities || {}, frame.visualComponents || {}, frame.camera);
  }

  whenPassiveReplayAssetsReady() {
    return this.renderer.whenAssetsReady();
  }

  passiveReplayCanvas() {
    return this.renderer.canvas;
  }

  restorePassiveReplay() {
    this.renderer.passiveReplayMode = false;
    this.renderer.mount(document.querySelector("#stage-visual"));
    this.renderer.setFpsEnabled(false);
  }

  buildRobotColliderBlueprint(robotDocument) {
    return this.renderer.buildRobotColliderBlueprint(robotDocument);
  }

  buildArenaObjectColliderBlueprint(tiles) {
    return this.renderer.buildArenaObjectColliderBlueprint(tiles);
  }

  retryFailedArenaObjectModelLoads(tiles) {
    return this.renderer.retryFailedArenaObjectModelLoads(tiles);
  }

  waitForArenaObjectColliderAssets(tiles, options) {
    return this.renderer.waitForArenaObjectColliderAssets(tiles, options);
  }

  retryFailedRobotModelLoads(robotDocument) {
    return this.renderer.retryFailedRobotModelLoads(robotDocument);
  }

  waitForRobotColliderAssets(robotDocument, options) {
    return this.renderer.waitForRobotColliderAssets(robotDocument, options);
  }

  updateCamera(camera) {
    this.renderer.updateCamera(camera);
  }

  defaultStarterRescueKitMount() {
    return this.renderer.defaultStarterRescueKitMount();
  }

  resize() {
    this.renderer.resize();
  }

  applyState() {
    this.renderer.applyState();
  }

  captureRobotCameraFrame(componentId) {
    return this.renderer.captureRobotCameraFrame(componentId);
  }

  sampleRobotColorSensor(componentId) {
    return this.renderer.sampleRobotColorSensor(componentId);
  }

  releaseSensorCaptureTargets() {
    this.renderer.releaseSensorCaptureTargets();
  }

  pick(event) {
    this.renderer.pick(event);
  }
}

globalThis.sboticsSimulationStage = new SimulationStage();
globalThis.dispatchEvent(new Event("sbotics-simulation-stage-ready"));
