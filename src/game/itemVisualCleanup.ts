import * as THREE from 'three';
import type { FloorId, WorldItemSpawn } from './types';

/**
 * Pure, testable collected-item visual lifecycle manager.
 * Guarantees that once a world item is picked up (or unlocked from the safe),
 * its 3D mesh, highlight/glow ring, contact shadow, and floor-chunk references
 * are completely removed from the scene so NO collected item can ever remain
 * frozen or floating in mid-air when `updateFloorVisibility` runs.
 */

export function removeFromChunkLists(
  mesh: THREE.Object3D,
  floor0Chunks: THREE.Object3D[],
  floorMinus1Chunks: THREE.Object3D[]
): void {
  const idx0 = floor0Chunks.indexOf(mesh);
  if (idx0 !== -1) floor0Chunks.splice(idx0, 1);
  const idxM1 = floorMinus1Chunks.indexOf(mesh);
  if (idxM1 !== -1) floorMinus1Chunks.splice(idxM1, 1);
}

/**
 * Detaches a world item mesh from tracking registries & floor-visibility chunk arrays
 * immediately upon pickup start, strips any glow ring / contact shadow so it cannot linger,
 * and returns the detached mesh (or null if none existed).
 */
export function detachCollectedItemMesh(
  itemId: string,
  itemMeshes: Map<string, THREE.Group>,
  floor0Chunks: THREE.Object3D[],
  floorMinus1Chunks: THREE.Object3D[]
): THREE.Group | null {
  const mesh = itemMeshes.get(itemId);
  if (!mesh) return null;

  itemMeshes.delete(itemId);
  removeFromChunkLists(mesh, floor0Chunks, floorMinus1Chunks);

  // Immediately strip dropped glow rings / contact shadows so nothing lingers during or after grab
  const toRemove: THREE.Object3D[] = [];
  mesh.traverse((child) => {
    if (child.name === 'dropped_glow_ring' || child.name === 'item_contact_shadow') {
      child.visible = false;
      toRemove.push(child);
    }
  });
  for (const child of toRemove) {
    if (child.parent) child.parent.remove(child);
  }

  return mesh;
}

/**
 * Finalizes removal of a collected item mesh after its grab animation finishes
 * (or immediately on safe unlock / reset): hides every descendant and detaches from scene graph.
 */
export function finalizeCollectedItemMesh(mesh: THREE.Object3D): void {
  mesh.visible = false;
  mesh.traverse((obj) => {
    obj.visible = false;
  });
  if (mesh.parent) {
    mesh.parent.remove(mesh);
  }
}

/**
 * Keeps only uncollected, non-safe world item meshes synchronized with active floor visibility.
 * Drawer-nested items are controlled by their parent drawer open progress instead.
 */
export function syncActiveWorldItemVisibility(
  items: readonly WorldItemSpawn[],
  itemMeshes: Map<string, THREE.Group>,
  activeFloor: FloorId,
  showBothNearStairs: boolean,
  isDrawerOpened: (drawerId: string) => boolean
): void {
  const show0 = showBothNearStairs || activeFloor === 0;
  const showMinus1 = showBothNearStairs || activeFloor === -1;

  for (const item of items) {
    const mesh = itemMeshes.get(item.id);
    if (!mesh) continue;
    if (item.collected || item.insideSafe) {
      finalizeCollectedItemMesh(mesh);
      itemMeshes.delete(item.id);
      continue;
    }
    const floorVisible = item.floor === 0 ? show0 : showMinus1;
    if (item.drawerId) {
      mesh.visible = floorVisible && isDrawerOpened(item.drawerId);
    } else {
      mesh.visible = floorVisible;
    }
  }
}
