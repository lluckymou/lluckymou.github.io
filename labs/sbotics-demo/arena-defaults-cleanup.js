(() => {
  const defaults = globalThis.sboticsArenaDefaults;
  if (!defaults || typeof defaults !== "object") return;
  const isMagentaPlaceholder = (object) => object?.material === "ColorMagenta" && (object?.label === "Random" || object?.type === "evacuationPoint");
  Object.values(defaults).forEach((arena) => {
    (arena?.tiles || []).forEach((tile) => {
      const randomTile = Boolean(tile?.flags?.randomType || tile?.tileOfTiles?.enabled || tile?.compositeTileOfTiles?.enabled);
      if (!randomTile || !Array.isArray(tile.objects)) return;
      const evacuationTemplate = tile.objects.find((object) => object?.type === "evacuationPoint" && object?.material === "ColorMagenta");
      if (evacuationTemplate) tile.randomEvacuationTemplate = evacuationTemplate;
      tile.objects = tile.objects.filter((object) => !isMagentaPlaceholder(object));
    });
  });

  // Precomputed empty XZ cells for the 24 standard OBR layouts only.
  // Each row is [z, firstX, lastX]; the cell positions were measured with occupancy across every Y.
  const OBR_OUT_OF_BOUNDS_ROWS = {
    "obr-estadual-01": [[-1,-1,12],[0,-1,-1],[0,12,12],[1,-1,-1],[1,12,12],[2,-1,-1],[2,12,12],[3,-1,12]],
    "obr-estadual-02": [[-1,-1,12],[0,-1,-1],[0,12,12],[1,-1,-1],[1,12,12],[2,-1,-1],[2,12,12],[3,-1,12]],
    "obr-estadual-03": [[-1,-1,12],[0,-1,-1],[0,12,12],[1,-1,-1],[1,12,12],[2,-1,-1],[2,12,12],[3,-1,12]],
    "obr-estadual-04": [[-1,-1,9],[0,-1,-1],[0,3,9],[1,-1,-1],[1,3,9],[2,-1,-1],[2,3,9],[3,-1,-1],[3,9,9],[4,-1,-1],[4,9,9],[5,-1,-1],[5,9,9],[6,-1,9]],
    "obr-estadual-05": [[1,-1,7],[2,-1,-1],[2,7,7],[3,-1,-1],[3,7,7],[4,-1,-1],[4,7,7],[5,-1,-1],[5,7,7],[6,-1,7]],
    "obr-estadual-06": [[-1,-1,9],[0,-1,-1],[0,3,9],[1,-1,-1],[1,3,9],[2,-1,-1],[2,3,9],[3,-1,-1],[3,9,9],[4,-1,-1],[4,9,9],[5,-1,-1],[5,9,9],[6,-1,9]],
    "obr-estadual-07": [[-1,0,7],[0,0,3],[0,7,7],[1,0,1],[1,7,7],[2,0,1],[2,7,7],[3,0,1],[3,7,7],[4,0,0],[4,7,7],[5,0,0],[5,7,7],[6,0,7]],
    "obr-estadual-08": [[-1,-1,7],[0,-1,1],[0,5,7],[1,-1,1],[1,5,7],[2,-1,1],[2,5,7],[3,-1,-1],[3,3,3],[3,7,7],[4,-1,-1],[4,3,3],[4,7,7],[5,-1,-1],[5,7,7],[6,-1,7]],
    "obr-estadual-09": [[-1,-1,8],[0,-1,3],[0,8,8],[1,-1,3],[1,8,8],[2,-1,3],[2,8,8],[3,-1,-1],[3,8,8],[4,-1,-1],[4,8,8],[5,-1,-1],[5,8,8],[6,-1,8]],
    "obr-estadual-10": [[-1,-1,7],[0,-1,-1],[0,4,7],[1,-1,-1],[1,4,7],[2,-1,-1],[2,4,7],[3,-1,-1],[3,5,7],[4,-1,-1],[4,5,7],[5,-1,1],[5,5,7],[6,-1,1],[6,7,7],[7,-1,1],[7,7,7],[8,-1,1],[8,7,7],[9,-1,7]],
    "obr-estadual-11": [[-1,-1,7],[0,-1,-1],[0,3,3],[0,7,7],[1,-1,-1],[1,1,1],[1,3,3],[1,5,5],[1,7,7],[2,-1,-1],[2,7,7],[3,-1,-1],[3,5,7],[4,-1,-1],[4,1,1],[4,5,7],[5,-1,-1],[5,5,7],[6,-1,7]],
    "obr-estadual-12": [[1,1,7],[2,1,1],[2,5,7],[3,1,1],[3,5,7],[4,1,1],[4,5,7],[5,1,1],[5,5,7],[6,1,1],[6,7,7],[7,1,1],[7,7,7],[8,1,1],[8,7,7],[9,1,7]],
    "obr-nacional-01": [[-1,-1,12],[0,-1,-1],[0,12,12],[1,-1,-1],[1,12,12],[2,-1,-1],[2,12,12],[3,-1,12]],
    "obr-nacional-02": [[-1,-1,12],[0,-1,-1],[0,12,12],[1,-1,-1],[1,12,12],[2,-1,-1],[2,12,12],[3,-1,12]],
    "obr-nacional-03": [[-1,-1,12],[0,-1,-1],[0,12,12],[1,-1,-1],[1,12,12],[2,-1,-1],[2,12,12],[3,-1,12]],
    "obr-nacional-04": [[-1,-1,9],[0,-1,-1],[0,3,5],[0,9,9],[1,-1,-1],[1,3,5],[1,9,9],[2,-1,-1],[2,3,5],[2,9,9],[3,-1,-1],[3,9,9],[4,-1,-1],[4,9,9],[5,-1,-1],[5,9,9],[6,-1,9]],
    "obr-nacional-05": [[-1,-1,7],[0,-1,-1],[0,7,7],[1,-1,-1],[1,7,7],[2,-1,-1],[2,7,7],[3,-1,-1],[3,7,7],[4,-1,-1],[4,7,7],[5,-1,-1],[5,7,7],[6,-1,7]],
    "obr-nacional-06": [[-1,-1,9],[0,-1,-1],[0,9,9],[1,-1,-1],[1,9,9],[2,-1,-1],[2,9,9],[3,-1,-1],[3,9,9],[4,-1,-1],[4,9,9],[5,-1,-1],[5,9,9],[6,-1,9]],
    "obr-nacional-07": [[-1,-1,7],[0,-1,1],[0,7,7],[1,-1,1],[1,7,7],[2,-1,1],[2,7,7],[3,-1,-1],[3,3,3],[3,7,7],[4,-1,-1],[4,3,3],[4,7,7],[5,-1,-1],[5,7,7],[6,-1,7]],
    "obr-nacional-08": [[-1,-1,7],[0,-1,1],[0,5,7],[1,-1,1],[1,5,7],[2,-1,1],[2,5,7],[3,-1,-1],[3,3,3],[3,7,7],[4,-1,-1],[4,3,3],[4,7,7],[5,-1,-1],[5,7,7],[6,-1,7]],
    "obr-nacional-09": [[-1,-1,11],[0,-1,1],[0,9,11],[1,-1,1],[1,9,11],[2,-1,1],[2,9,11],[3,-1,-1],[3,3,3],[3,7,7],[3,11,11],[4,-1,-1],[4,3,3],[4,7,7],[4,11,11],[5,-1,-1],[5,11,11],[6,-1,11]],
    "obr-nacional-10": [[-1,-1,7],[0,-1,-1],[0,3,7],[1,-1,-1],[1,3,7],[2,-1,-1],[2,3,7],[3,-1,-1],[3,5,7],[4,-1,-1],[4,5,7],[5,-1,-1],[5,5,7],[6,-1,-1],[6,7,7],[7,-1,-1],[7,7,7],[8,-1,-1],[8,7,7],[9,-1,7]],
    "obr-nacional-11": [[-1,-1,7],[0,-1,-1],[0,7,7],[1,-1,-1],[1,1,1],[1,3,3],[1,5,5],[1,7,7],[2,-1,-1],[2,7,7],[3,-1,-1],[3,7,7],[4,-1,-1],[4,1,1],[4,5,5],[4,7,7],[5,-1,-1],[5,7,7],[6,-1,7]],
    "obr-nacional-12": [[-1,-1,7],[0,-1,-1],[0,7,7],[1,-1,-1],[1,7,7],[2,-1,-1],[2,7,7],[3,-1,1],[3,5,7],[4,-1,1],[4,5,7],[5,-1,1],[5,5,7],[6,-1,-1],[6,7,7],[7,-1,-1],[7,7,7],[8,-1,-1],[8,7,7],[9,-1,7]]
  };
  Object.entries(OBR_OUT_OF_BOUNDS_ROWS).forEach(([arenaId, rows]) => {
    const arena = defaults[arenaId];
    if (!arena || !Array.isArray(arena.tiles)) return;
    arena.settings = { ...(arena.settings || {}), score_rounding_mode: "ceil" };
    if (arena.tiles.some((tile) => tile?.id?.startsWith(`${arenaId}-out-of-bounds-`))) return;
    let cellIndex = 1;
    rows.forEach(([z, firstX, lastX]) => {
      for (let x = firstX; x <= lastX; x += 1) {
        const score = { points: 0, multiplier: 1, attempts: [], attemptMultipliers: [] };
        arena.tiles.push({
          id: `${arenaId}-out-of-bounds-${String(cellIndex++).padStart(3, "0")}`,
          tileId: "important-00-empty",
          x,
          z,
          y: 0,
          rotation: 0,
          surface: "flat",
          emptyTile: true,
          flags: { markable: false, checkpoint: false, endGoal: false, rescueZone: false, outOfBounds: true, randomType: null, ramp: false },
          visuals: { baseplateColor: "dark-gray", useNoiseTexture: false, supportType: "disabled", useSupports: false, supportColor: "dark-gray", useWallNoise: false, thin: true },
          exits: { side_a: "blocked", side_b: "blocked", side_A: "blocked", side_B: "blocked" },
          enterScore: score,
          exitScore: { ...score, attempts: [], attemptMultipliers: [] },
          objects: []
        });
      }
    });
  });
})();
