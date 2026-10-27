export const normalizeArenaNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const rounded = Number(number.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const roundArenaScoreTotal = (value, mode = "none") => {
  const score = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (mode === "ceil") return normalizeArenaNumber(Math.ceil(score));
  if (mode === "floor") return normalizeArenaNumber(Math.floor(score));
  if (mode === "trunc") return normalizeArenaNumber(Math.trunc(score));
  if (mode === "half") return normalizeArenaNumber(Math.round(score * 2) / 2);
  return normalizeArenaNumber(score);
};

export const normalizeArenaValue = (value) => {
  if (typeof value === "number") return normalizeArenaNumber(value);
  if (Array.isArray(value)) return value.map(normalizeArenaValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeArenaValue(child)]));
  return value;
};

export const cloneArenaValue = (value) => normalizeArenaValue(JSON.parse(JSON.stringify(value)));

export const ARENA_TILE_VISUAL_COLOR_IDS = Object.freeze([
  "white", "gray", "dark-gray", "black", "green", "lime", "teal", "cyan",
  "blue", "purple", "magenta", "pink", "red", "brown", "orange", "yellow"
]);
export const ARENA_TILE_SUPPORT_TYPE_IDS = Object.freeze(["corners", "closed", "disabled"]);
export const ARENA_TILE_WALL_SIDE_IDS = Object.freeze(["side_a", "side_A", "side_b", "side_B"]);
const ARENA_TILE_RAMP_BASE_Y = 0.31;
const ARENA_TILE_RAMP_RISE = 3.6505;
const ARENA_TILE_RAMP_HALF_LENGTH = 5;
const ARENA_TILE_LEGACY_WALL_HEIGHT = 3;
const ARENA_TILE_LEGACY_WALL_CENTER_Y = 1.4;
export const ARENA_TILE_WALL_HEIGHT = 4.0605;
export const ARENA_TILE_WALL_CENTER_Y = ARENA_TILE_LEGACY_WALL_CENTER_Y - ARENA_TILE_LEGACY_WALL_HEIGHT / 2 + ARENA_TILE_WALL_HEIGHT / 2;
export const ARENA_TILE_BASEPLATE_THICKNESS = 0.62;
export const ARENA_TILE_THIN_BASEPLATE_THICKNESS = 0.1;
export const ARENA_TILE_THIN_WALL_VERTICAL_OFFSET = -ARENA_TILE_BASEPLATE_THICKNESS / 2 - (ARENA_TILE_WALL_CENTER_Y - ARENA_TILE_WALL_HEIGHT / 2);
// Source sides: a=-Z, A=+Z, b=-X, B=+X. Web Z is mirrored at render/runtime boundaries.
export const ARENA_TILE_WALL_SIDE_LAYOUT = Object.freeze({
  side_a: Object.freeze({ x: 0, z: 4.825, halfExtents: Object.freeze([5, ARENA_TILE_WALL_HEIGHT / 2, 0.175]) }),
  side_A: Object.freeze({ x: 0, z: -4.825, halfExtents: Object.freeze([5, ARENA_TILE_WALL_HEIGHT / 2, 0.175]) }),
  side_b: Object.freeze({ x: -4.825, z: 0, halfExtents: Object.freeze([0.175, ARENA_TILE_WALL_HEIGHT / 2, 5]) }),
  side_B: Object.freeze({ x: 4.825, z: 0, halfExtents: Object.freeze([0.175, ARENA_TILE_WALL_HEIGHT / 2, 5]) })
});
export const arenaTileIsRamp = (tile = {}) => tile.surface === "ramp"
  || tile.definition?.surface === "ramp"
  || tile.flags?.ramp === true
  || tile.definition?.flags?.ramp === true;
const arenaTileRampSurfaceYAtZ = (z) => ARENA_TILE_RAMP_BASE_Y + ((ARENA_TILE_RAMP_HALF_LENGTH - Number(z)) / (ARENA_TILE_RAMP_HALF_LENGTH * 2)) * ARENA_TILE_RAMP_RISE;
export const arenaTileRampHeightOffsetAtZ = (z) => arenaTileRampSurfaceYAtZ(z) - ARENA_TILE_RAMP_BASE_Y;
export const arenaTileWallPoint = (side, point = {}, followsRamp = false, verticalOffset = 0) => {
  const layout = ARENA_TILE_WALL_SIDE_LAYOUT[side];
  if (!layout) return null;
  const x = layout.x + (Number(point.x) || 0);
  const z = layout.z + (Number(point.z) || 0);
  const followsIncline = side === "side_b" || side === "side_B";
  const rampZ = followsIncline ? z : layout.z;
  return {
    x,
    y: ARENA_TILE_WALL_CENTER_Y + (Number(point.y) || 0) + (followsRamp ? arenaTileRampHeightOffsetAtZ(rampZ) : 0) + (Number(verticalOffset) || 0),
    z
  };
};
export const arenaTileWallHullPoints = (side, followsRamp = false, verticalOffset = 0) => {
  const layout = ARENA_TILE_WALL_SIDE_LAYOUT[side];
  if (!layout) return [];
  const [halfX, halfY, halfZ] = layout.halfExtents;
  return [-1, 1].flatMap((xSign) => [-1, 1].flatMap((ySign) => [-1, 1].map((zSign) => arenaTileWallPoint(side, {
    x: xSign * halfX,
    y: ySign * halfY,
    z: zSign * halfZ
  }, followsRamp, verticalOffset))));
};
export const ARENA_TILE_ICON_BACKGROUND_COLORS = Object.freeze({ Scoring: "#acf760", Paths: "#705ff7", Curves: "#5d9df5", Important: "#f7925e", Advanced: "#792aab", Personal: "#ffffff" });
export const ARENA_TILE_VISUAL_DEFAULTS = Object.freeze({ baseplateColor: "white", useNoiseTexture: true, supportType: "corners", useSupports: true, supportColor: "orange", iconBackgroundColor: "#ffffff", thin: false });
export const arenaTileLegacyWallSideFromObject = (object) => {
  const type = object?.type || "";
  const name = object?.label || object?.name || "";
  const scale = object?.scale || {};
  const position = object?.position || {};
  if (!["cuboid", "ObjectCuboid"].includes(type) || !["Wall", "Wall 2"].includes(name)) return null;
  const scaleX = Number(scale.x);
  const scaleY = Number(scale.y);
  const scaleZ = Number(scale.z);
  const x = Number(position.x);
  const y = Number(position.y);
  const z = Number(position.z);
  const rotationY = Number(object?.rotation?.y) || 0;
  if (![scaleX, scaleY, scaleZ, x, y, z].every(Number.isFinite)) return null;
  if (Math.abs(Math.abs(scaleX) - 0.35) > 0.08 || Math.abs(scaleY - ARENA_TILE_LEGACY_WALL_HEIGHT) > 0.1 || Math.abs(scaleZ - 10) > 0.1 || Math.abs(y - ARENA_TILE_LEGACY_WALL_CENTER_Y) > 0.1) return null;
  if (Math.abs(Math.abs(x) - 4.85) <= 0.15 && Math.abs(z) <= 0.15 && Math.abs(rotationY) <= 1) return x > 0 ? "side_B" : "side_b";
  if (Math.abs(Math.abs(z) - 4.85) <= 0.15 && Math.abs(x) <= 0.15 && Math.abs(Math.abs(rotationY) - 90) <= 1) return z > 0 ? "side_A" : "side_a";
  return null;
};
export const arenaTileVisuals = (tile, definitionOverride = null) => {
  const visuals = tile?.visuals && typeof tile.visuals === "object" ? tile.visuals : {};
  const definition = definitionOverride || tile?.definition || tile || {};
  const sourceWalls = visuals.walls && typeof visuals.walls === "object" ? visuals.walls : {};
  const supportType = ARENA_TILE_SUPPORT_TYPE_IDS.includes(visuals.supportType) ? visuals.supportType : visuals.useSupports === false ? "disabled" : ARENA_TILE_VISUAL_DEFAULTS.supportType;
  const background = typeof visuals.iconBackgroundColor === "string" && /^#[0-9a-f]{6}$/i.test(visuals.iconBackgroundColor)
    ? visuals.iconBackgroundColor.toLowerCase()
    : ARENA_TILE_ICON_BACKGROUND_COLORS[definition?.group] || ARENA_TILE_VISUAL_DEFAULTS.iconBackgroundColor;
  return {
    baseplateColor: ARENA_TILE_VISUAL_COLOR_IDS.includes(visuals.baseplateColor) ? visuals.baseplateColor : ARENA_TILE_VISUAL_DEFAULTS.baseplateColor,
    useNoiseTexture: visuals.useNoiseTexture !== false,
    thin: visuals.thin === true,
    iconBackgroundColor: background,
    supportType,
    useSupports: supportType !== "disabled",
    supportColor: ARENA_TILE_VISUAL_COLOR_IDS.includes(visuals.supportColor) ? visuals.supportColor : ARENA_TILE_VISUAL_DEFAULTS.supportColor,
    useWallNoise: visuals.useWallNoise === true,
    walls: Object.fromEntries(ARENA_TILE_WALL_SIDE_IDS.map((side) => {
      const wall = sourceWalls[side] && typeof sourceWalls[side] === "object" ? sourceWalls[side] : {};
      return [side, {
        enabled: wall.enabled === true,
        color: ARENA_TILE_VISUAL_COLOR_IDS.includes(wall.color) ? wall.color : "white"
      }];
    }))
  };
};
export const arenaTileWallVerticalOffset = (tile) => arenaTileVisuals(tile).thin ? ARENA_TILE_THIN_WALL_VERTICAL_OFFSET : 0;

const ARENA_MATERIAL_VISUAL_COLORS = Object.freeze({
  ColorWhite: "white", ColorGray: "gray", ColorDarkGray: "dark-gray", ColorBlack: "black",
  ColorGreen: "green", ColorLime: "lime", ColorTeal: "teal", ColorCyan: "cyan",
  ColorBlue: "blue", ColorPurple: "purple", ColorMagenta: "magenta", ColorPink: "pink",
  ColorRed: "red", ColorBrown: "brown", ColorOrange: "orange", ColorYellow: "yellow"
});
const arenaObjectScaleIs = (object, x, y, z) => {
  const scale = object?.scale || {};
  return Math.abs(Number(scale.x) - x) < 1e-6 && Math.abs(Number(scale.y) - y) < 1e-6 && Math.abs(Number(scale.z) - z) < 1e-6;
};
const arenaFullTileVisualObject = (object) => arenaObjectScaleIs(object, 10, 10, 1) && (object?.type === "plane" || /grass/i.test(object?.label || ""));

export const normalizeRockyPlateauTiles = (tiles = []) => tiles.map((tile) => {
  const objects = Array.isArray(tile?.objects) ? tile.objects : [];
  const rockyTile52 = tile?.id === "rocky-tile-051" || tile?.tileId === "rocky-tile-051";
  const rockyTile24 = tile?.id === "rocky-tile-023" || tile?.tileId === "rocky-tile-023";
  const fullRampObjects = arenaTileIsRamp(tile) ? objects.filter((object) => arenaObjectScaleIs(object, 10, 5, 1)) : [];
  const fullTileObjects = objects.filter(arenaFullTileVisualObject);
  const rockyTile24Green = rockyTile24 ? objects.filter((object) => object?.type === "plane" && object?.material === "ColorGreen" && arenaObjectScaleIs(object, 10, 5, 1)) : [];
  const rampCleanup = fullRampObjects.length === 2;
  const removed = new Set(rampCleanup ? fullRampObjects : rockyTile24Green.length ? rockyTile24Green : fullTileObjects);
  const visualSource = rampCleanup || rockyTile24Green.length ? "green" : ARENA_MATERIAL_VISUAL_COLORS[fullTileObjects[0]?.material] || arenaTileVisuals(tile).baseplateColor;
  return {
    ...tile,
    ...(rockyTile52 ? {
      image: null,
      imagePath: null,
      images: { ...(tile.images || {}), surface: null },
      surfaceImageSuppressed: true
    } : {}),
    visuals: { ...arenaTileVisuals(tile), baseplateColor: visualSource, supportType: "closed", useSupports: true, supportColor: "dark-gray", useNoiseTexture: false },
    objects: objects.filter((object) => !removed.has(object))
  };
});

// Unity __sBotics__Tile.Objects applies this local parent to ramp objects:
// -20° around X, y=1.83 and Z scale 1.07. The mirrored WebGL Z frame reverses
// the X sign; the caller supplies the rendered surface angle so objects stay
// aligned with the actual ramp profile/landing.
export const arenaRampObjectTransform = (surfaceAngle) => ({
  position: { x: 0, y: 1.83, z: 0 },
  rotation: { x: Number(surfaceAngle) || 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1.07 }
});

export const arenaTileQuarterTurns = (tile) => ((Math.round(Number(tile?.rotation || 0) / 90) % 4) + 4) % 4;

export const arenaTileRotatedCellOffset = (x, z, quarterTurns) => {
  if (quarterTurns === 1) return { x: z, z: -x };
  if (quarterTurns === 2) return { x: -x, z: -z };
  if (quarterTurns === 3) return { x: -z, z: x };
  return { x, z };
};

export const arenaTileCells = (tile, definitionResolver) => {
  const definition = tile?.definition || (typeof definitionResolver === "function" ? definitionResolver(tile?.tileId) : definitionResolver);
  if (!definition) return [];
  const sizeX = Math.max(1, Number(definition.sizeX) || 1);
  const sizeZ = Math.max(1, Number(definition.sizeZ) || 1);
  const quarterTurns = arenaTileQuarterTurns(tile);
  return Array.from({ length: sizeX * sizeZ }, (_, index) => {
    const offset = arenaTileRotatedCellOffset(index % sizeX, Math.floor(index / sizeX), quarterTurns);
    return { x: tile.x + offset.x, z: tile.z + offset.z };
  });
};

export const arenaTileOccupies = (tile, x, z, definitionResolver) => arenaTileCells(tile, definitionResolver).some((cell) => cell.x === x && cell.z === z);

export const arenaTileOverlaps = (tile, other, definitionResolver) => arenaTileCells(tile, definitionResolver).some((cell) => arenaTileOccupies(other, cell.x, cell.z, definitionResolver));

const pathExitKeys = Object.freeze(["a", "b", "A", "B"]);
const pathNormalizeExit = (value) => {
  if (!value || value === "blocked") return null;
  const key = String(value).replace(/^exit_/, "");
  return pathExitKeys.includes(key) ? key : null;
};
const pathRotation = (tile) => ((Number(tile?.rotation) || 0) % 360 + 360) % 360;
const pathStartMove = (tile) => ({ 90: "left", 180: "up", 270: "right" }[pathRotation(tile)] || "down");
const pathMoveStep = (position, move) => ({
  up: { x: position.x, z: position.z + 1 },
  right: { x: position.x + 1, z: position.z },
  down: { x: position.x, z: position.z - 1 },
  left: { x: position.x - 1, z: position.z }
}[move] || null);

// Mirrors ArenaLoader.GenerateLine: start at the End tile, use the current
// tile's entrance/side conversion, and resolve ramp height transitions while
// walking backward until every authored checkpoint has been traversed.
const pathEntranceFromMove = (move, rotation) => ({
  up: { 0: "a", 90: "B", 180: "A", 270: "b" },
  right: { 0: "b", 90: "a", 180: "B", 270: "A" },
  down: { 0: "A", 90: "b", 180: "a", 270: "B" },
  left: { 0: "B", 90: "A", 180: "b", 270: "a" }
}[move]?.[rotation] || "B");
const pathNextMove = (rotation, exit) => ({
  0: { a: "down", b: "left", A: "up", B: "right" },
  90: { a: "left", b: "up", A: "right", B: "down" },
  180: { a: "up", b: "right", A: "down", B: "left" },
  270: { a: "right", b: "down", A: "left", B: "up" }
}[rotation]?.[exit] || null);

export function compileArenaPath(tiles = []) {
  const diagnostics = [];
  const openEdges = [];
  const byCoordinate = new Map();
  tiles.forEach((tile) => {
    const key = `${tile.x}:${tile.z}:${tile.y || 0}`;
    if (byCoordinate.has(key)) diagnostics.push({ code: "duplicate", tileId: tile.id });
    else byCoordinate.set(key, tile);
  });
  const findTile = (position) => {
    const exact = byCoordinate.get(`${position.x}:${position.z}:${position.y}`);
    if (exact) return { tile: exact, secondary: false };
    const below = byCoordinate.get(`${position.x}:${position.z}:${position.y - 1}`);
    return below ? { tile: below, secondary: true } : null;
  };
  const goal = tiles.find((tile) => tile.flags?.endGoal);
  if (!goal) diagnostics.push({ code: "noGoal" });
  let reversePath = goal ? [goal] : [];
  let lastCheckpointIndex = goal?.flags?.checkpoint ? 0 : -1;
  let current = goal;
  let currentSecondary = false;
  let pointer = goal ? { x: Number(goal.x) || 0, z: Number(goal.z) || 0, y: Number(goal.y) || 0 } : null;
  let lastMove = goal ? pathStartMove(goal) : null;
  const visitedStates = new Set();
  const maxSteps = Math.max(1, tiles.length * 3);
  for (let step = 0; current && pointer && step < maxSteps; step += 1) {
    const stateKey = `${current.id}:${pointer.x}:${pointer.z}:${pointer.y}:${lastMove}`;
    if (visitedStates.has(stateKey)) {
      diagnostics.push({ code: "loop", tileId: current.id });
      break;
    }
    visitedStates.add(stateKey);
    let usedSecondary = false;
    if (current !== goal) {
      const rotation = pathRotation(current);
      const entrance = pathEntranceFromMove(lastMove, rotation);
      const exit = pathNormalizeExit(current.exits?.[`side_${entrance}`]);
      lastMove = pathNextMove(rotation, exit);
      if (!lastMove) {
        if (!current.flags?.checkpoint) openEdges.push({ tileId: current.id, side: entrance, exit: current.exits?.[`side_${entrance}`] || "blocked" });
        break;
      }
      if (arenaTileIsRamp(current)) {
        if (entrance === "a") pointer.y += 1;
        else if (entrance === "A" && currentSecondary) {
          pointer.y -= 1;
          usedSecondary = true;
        }
      }
    }
    const nextPosition = pathMoveStep(pointer, lastMove);
    if (!nextPosition) break;
    nextPosition.y = pointer.y;
    const next = findTile(nextPosition);
    if (!next) {
      if (!current.flags?.checkpoint) openEdges.push({ tileId: current.id, side: lastMove, expected: nextPosition });
      break;
    }
    // A converted Arena can encounter the ramp below its upper landing before
    // the ramp node itself is visited. Keep that transition; the next loop
    // will let the ramp consume the pending height change.
    if (next.secondary && !usedSecondary && next.tile.surface !== "ramp") {
      openEdges.push({ tileId: current.id, side: lastMove, expected: nextPosition, reason: "height-transition" });
      break;
    }
    reversePath.push(next.tile);
    // Preserve the cursor height when the hit was the secondary tile below;
    // Unity keeps that elevated cursor until the ramp resolves it.
    pointer = { x: nextPosition.x, z: nextPosition.z, y: nextPosition.y };
    current = next.tile;
    currentSecondary = next.secondary;
    if (current.flags?.checkpoint) lastCheckpointIndex = reversePath.length - 1;
  }
  if (lastCheckpointIndex < 0) diagnostics.push({ code: "noCheckpoint" });
  const reverseSegment = lastCheckpointIndex >= 0 ? reversePath.slice(0, lastCheckpointIndex + 1) : [];
  const ordered = reverseSegment.reverse();
  const start = ordered.find((tile) => tile.flags?.checkpoint) || null;
  if (!start) diagnostics.push({ code: "noStart" });
  if (goal && (!ordered.length || ordered.at(-1)?.id !== goal.id)) diagnostics.push({ code: "disconnected" });
  const occurrences = ordered.map((tile, index) => ({ index, tileId: tile.id, x: tile.x, y: tile.y || 0, z: tile.z, checkpoint: Boolean(tile.flags?.checkpoint), endGoal: Boolean(tile.flags?.endGoal) }));
  const tracks = pathTracksForOccurrences(occurrences);
  const indexedOccurrences = occurrences.map((occurrence, index) => ({
    ...occurrence,
    segmentIndex: tracks.findIndex((track) => index >= track.startOccurrence && index <= track.endOccurrence)
  }));
  const edges = indexedOccurrences.slice(0, -1).map((occurrence, index) => ({ from: occurrence.tileId, to: indexedOccurrences[index + 1].tileId, heightDelta: indexedOccurrences[index + 1].y - occurrence.y }));
  return { status: diagnostics.length ? "invalid" : "valid", diagnostics, openEdges, startTileId: start?.id || null, goalTileId: goal?.id || null, size: indexedOccurrences.length, tracks, occurrences: indexedOccurrences, edges };
}

/**
 * A path occurrence is a scored/tracked tile. A track is the checkpoint
 * interval that contains those occurrences. Keeping this projection explicit
 * prevents the score-once rule from turning every tile into a new path.
 */
export function pathTracksForOccurrences(occurrences = []) {
  const list = Array.isArray(occurrences) ? occurrences : [];
  if (!list.length) return [];
  const starts = [0];
  list.forEach((occurrence, index) => {
    if (index > 0 && occurrence?.checkpoint) starts.push(index);
  });
  return starts.map((startOccurrence, index) => {
    const nextStart = starts[index + 1];
    const endOccurrence = nextStart === undefined ? list.length - 1 : nextStart - 1;
    return {
      index: index + 1,
      segmentIndex: index,
      startOccurrence,
      endOccurrence,
      checkpointOccurrence: startOccurrence,
      checkpointTileId: list[startOccurrence]?.tileId || null,
      tileIds: list.slice(startOccurrence, endOccurrence + 1).map((occurrence) => occurrence.tileId)
    };
  });
}

const scoreRuleAttemptValues = (rule, key, fallback) => {
  const direct = rule?.[key] ?? rule?.[key.replace("attempt_", "attempt")];
  if (Array.isArray(direct)) return direct.map((value) => Number.isFinite(Number(value)) ? Number(value) : fallback);
  const attemptKey = key === "attempt_multipliers" ? "multiplier" : "points";
  if (Array.isArray(rule?.attempts)) return rule.attempts.map((attempt) => Number.isFinite(Number(attempt?.[attemptKey])) ? Number(attempt[attemptKey]) : fallback);
  return [];
};

const scoreRulePeak = (rule) => {
  const source = rule && typeof rule === "object" ? rule : { points: Number(rule) || 0, multiplier: 1 };
  const points = Number.isFinite(Number(source.points)) ? Number(source.points) : 0;
  const multiplier = Number.isFinite(Number(source.multiplier)) ? Number(source.multiplier) : 1;
  const attemptPoints = scoreRuleAttemptValues(source, "attempt_points", 0);
  const attemptMultipliers = scoreRuleAttemptValues(source, "attempt_multipliers", 1);
  return {
    points: points + (attemptPoints.length ? Math.max(...attemptPoints) : 0),
    multiplier: multiplier * (attemptMultipliers.length ? Math.max(...attemptMultipliers) : 1)
  };
};

const scoreRulePeakScaled = (rule, scale = 1) => {
  const peak = scoreRulePeak(rule);
  const normalizedScale = Math.max(1, Math.round(Number(scale) || 1));
  return {
    points: peak.points * normalizedScale,
    multiplier: Math.pow(peak.multiplier, normalizedScale)
  };
};

const scoreSummaryAdd = (summary, rule, scale = 1) => {
  const peak = scoreRulePeakScaled(rule, scale);
  summary.basePoints += peak.points;
  summary.multiplier *= peak.multiplier;
};

/**
 * Compile the maximum possible base path score and its independent multiplier
 * product. This mirrors the source ArenaLoader/Tile.TotalPoints calculation,
 * while keeping the end-goal exit score explicit in the modern path model.
 */
export function arenaPathScoreSummary({ tiles = [], path = {}, settings = {} } = {}) {
  const occurrences = Array.isArray(path?.occurrences) ? path.occurrences : [];
  const byId = new Map((tiles || []).map((tile) => [tile?.id, tile]));
  const summary = { available: path?.status === "valid" && occurrences.length > 0, basePoints: 0, multiplier: 1, pathTileCount: occurrences.length, rescueObjectCount: 0, evacuationBonusCount: 0 };
  if (!summary.available) return { ...summary, maxScore: 0, maxScoreWithMultipliers: 0, medals: null };

  const previousCheckpointIndex = (index) => {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) if (occurrences[cursor]?.checkpoint) return cursor;
    return null;
  };
  occurrences.forEach((occurrence, index) => {
    const tile = byId.get(occurrence?.tileId);
    if (!tile) return;
    scoreSummaryAdd(summary, tile.enterScore);
    scoreSummaryAdd(summary, tile.exitScore);
    const isRamp = arenaTileIsRamp(tile);
    if (isRamp) {
      scoreSummaryAdd(summary, settings.ramp_entrance_score);
      scoreSummaryAdd(summary, settings.ramp_exit_score);
    }
    if (occurrence.checkpoint) {
      const previous = previousCheckpointIndex(index);
      const rescueCount = previous === null ? 0 : occurrences.slice(previous + 1, index + 1).filter((candidate) => {
        const rescueTile = byId.get(candidate?.tileId);
        return rescueTile?.flags?.rescueZone === true || rescueTile?.definition?.flags?.rescueZone === true;
      }).length;
      const pathSize = Math.max(1, (previous === null ? 1 : index - previous) - Math.max(0, rescueCount - 1));
      scoreSummaryAdd(summary, settings.path_size_checkpoint_entrance_score, pathSize);
      scoreSummaryAdd(summary, settings.path_size_checkpoint_exit_score, pathSize);
    }
  });

  const placeableCheckpoints = Math.max(0, Math.round(Number(settings.placeable_checkpoints) || 0));
  if (placeableCheckpoints) {
    scoreSummaryAdd(summary, settings.placeable_checkpoint_entrance_score, placeableCheckpoints);
    scoreSummaryAdd(summary, settings.placeable_checkpoint_exit_score, placeableCheckpoints);
  }

  (tiles || []).forEach((tile) => (tile?.objects || []).forEach((object) => {
    scoreSummaryAdd(summary, object?.rescueScore);
    if (object?.type === "liveVictim" || object?.type === "deadVictim") summary.rescueObjectCount += 1;
    Object.values(object?.evacuationBonus || {}).forEach((bonus) => {
      summary.evacuationBonusCount += 1;
      scoreSummaryAdd(summary, bonus);
    });
  }));
  if (settings.start_with_rescue_kit === true) scoreSummaryAdd(summary, settings.starter_rescue_kit_score);

  summary.basePoints = normalizeArenaNumber(summary.basePoints);
  summary.multiplier = normalizeArenaNumber(summary.multiplier);
  summary.maxScore = summary.basePoints;
  summary.maxScoreWithMultipliers = roundArenaScoreTotal(summary.basePoints * summary.multiplier, settings.score_rounding_mode);
  summary.medals = summary.basePoints > 0 ? {
    beginner: Math.ceil(summary.basePoints * 0.15),
    experienced: Math.ceil(summary.basePoints * 0.5),
    professional: Math.ceil(summary.basePoints)
  } : null;
  return summary;
}
