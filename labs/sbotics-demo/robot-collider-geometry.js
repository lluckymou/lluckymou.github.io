// Decorations remain visual when nested inside another visual-only mesh.
export function isRobotColliderMesh(item, component) {
  if (!item.isMesh || !item.geometry || item.geometry.type === "PlaneGeometry") return false;
  for (let ancestor = item; ancestor && ancestor !== component; ancestor = ancestor.parent) {
    if (ancestor.userData.physicsRole === "visual" || ancestor.userData.sourceRole === "logical-selection-slot") return false;
  }
  return true;
}
