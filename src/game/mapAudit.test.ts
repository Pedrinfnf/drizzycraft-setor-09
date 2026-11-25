import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Box3, Vector3 } from 'three';
import {
  CELL_FLOOR,
  CELL_SIZE,
  CELL_WALL,
  FLOOR_0_Y,
  FLOOR_MINUS_1_Y,
  WALL_SWITCH_HEIGHT,
  WALL_SWITCH_WALL_OFFSET,
  cellIdx,
  collectFloorObstacleBoxes,
  computeFurnitureBox3,
  computeLightSwitchBox3,
  generateMansionLayout,
  gridToWorld,
  inBounds,
  worldToGrid,
} from './mansionMap';
import { FLASHLIGHT_CONFIG } from './HorrorEngine';

const ROOT = process.cwd();

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

describe('Scenario Polish & Bugfix Audit (mapAudit.test.ts)', () => {
  it('calibrates flashlight (Normal & UV), spill SpotLight, scene target, and viewmodel shadow exclusion', () => {
    assert.ok(
      FLASHLIGHT_CONFIG.intensity >= 12 && FLASHLIGHT_CONFIG.intensity <= 26,
      `Flashlight intensity ${FLASHLIGHT_CONFIG.intensity} must be calibrated in [12, 26]`
    );
    assert.equal(FLASHLIGHT_CONFIG.intensity, 18);
    assert.equal(FLASHLIGHT_CONFIG.distance, 18);
    assert.ok(Math.abs(FLASHLIGHT_CONFIG.angle - Math.PI / 5.2) < 1e-6);
    assert.equal(FLASHLIGHT_CONFIG.penumbra, 0.78);
    assert.equal(FLASHLIGHT_CONFIG.decay, 1.8);

    assert.equal(FLASHLIGHT_CONFIG.spillIntensity, 3.2);
    assert.equal(FLASHLIGHT_CONFIG.spillDistance, 7.5);
    assert.ok(Math.abs(FLASHLIGHT_CONFIG.spillAngle - Math.PI / 2.3) < 1e-6);
    assert.equal(FLASHLIGHT_CONFIG.spillPenumbra, 1.0);

    assert.equal(FLASHLIGHT_CONFIG.uvIntensity, 14);
    assert.equal(FLASHLIGHT_CONFIG.uvDistance, 13);
    assert.equal(FLASHLIGHT_CONFIG.uvColor, 0x8b2cf5);
    assert.ok(Math.abs(FLASHLIGHT_CONFIG.uvAngle - Math.PI / 4.2) < 1e-6);
    assert.equal(FLASHLIGHT_CONFIG.uvPenumbra, 0.75);

    const engineSrc = readSrc('src/game/HorrorEngine.ts');
    assert.ok(engineSrc.includes('this.scene.add(this.flashlight);'), 'flashlight must be attached to scene');
    assert.ok(engineSrc.includes('this.scene.add(this.flashlightSpill);'), 'flashlightSpill must be attached to scene');
    assert.ok(engineSrc.includes('this.scene.add(this.flashlightTarget);'), 'flashlightTarget must be attached to scene');
    assert.ok(engineSrc.includes('this.flashlightSpill.castShadow = false;'), 'flashlightSpill must not cast shadows');
    assert.ok(
      engineSrc.includes('this.heldItemRig.root.traverse') && engineSrc.includes('obj.castShadow = false;'),
      'heldItemRig meshes must have castShadow = false so flashlight never blocks its own beam'
    );
  });

  it('removes 100% of ugly geometric light cones and uses calibrated emissive tubes + physical lighting', () => {
    const engineSrc = readSrc('src/game/HorrorEngine.ts');
    assert.ok(!engineSrc.includes('ConeGeometry'), 'No ConeGeometry allowed on ceiling lights');
    assert.ok(!engineSrc.includes('lightConeMeshes'), 'lightConeMeshes must be completely removed');
    assert.ok(!engineSrc.includes('coneGeo'), 'Hanging cylinder coneGeo must be completely removed');
    assert.ok(!engineSrc.includes('Warm eerie haze shaft'), 'Artificial indoor lamp god-ray planes must be removed');
    assert.ok(engineSrc.includes('emissiveIntensity: 2.0'), 'Ceiling fixtures must have calibrated emissive tubes');
    assert.ok(engineSrc.includes('this.scene.environmentIntensity = 0.65;'), 'PMREM environmentIntensity must be 0.65');
    assert.ok(engineSrc.includes('this.renderer.toneMappingExposure = 1.08'), 'ACES toneMappingExposure must be 1.08');
    assert.ok(engineSrc.includes('new THREE.PointLight(0xffcf99, 6.2, 14, 2.0)'), 'Room PointLights must use physical decay=2.0');
  });

  it('mounts 100% of wall light switches flush on solid walls at floorY+1.25 with ZERO Box3 collisions across seeds', () => {
    const seeds = [202509, 101, 404, 7777, 99999];
    for (const seed of seeds) {
      const layout = generateMansionLayout(seed, 'hard');
      assert.equal(layout.lightSwitches.length, 6, `Expected 6 wall light switches for seed ${seed}`);

      const obs0 = collectFloorObstacleBoxes(layout, 0);
      const obsM1 = collectFloorObstacleBoxes(layout, -1);

      for (const sw of layout.lightSwitches) {
        const room = layout.rooms.find((r) => r.id === sw.roomId && r.floor === sw.floor);
        assert.ok(room, `Switch ${sw.id} references unknown roomId '${sw.roomId}' on floor ${sw.floor}`);

        const floorY = sw.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
        assert.ok(
          Math.abs(sw.y - (floorY + WALL_SWITCH_HEIGHT)) < 1e-4,
          `Switch ${sw.id} height ${sw.y} must be floorY + ${WALL_SWITCH_HEIGHT}`
        );

        const grid = sw.floor === 0 ? layout.floor0 : layout.floorMinus1;
        const nx = Math.round(Math.sin(sw.facingYaw));
        const nz = Math.round(Math.cos(sw.facingYaw));
        assert.equal(Math.abs(nx) + Math.abs(nz), 1, `Switch ${sw.id} must face an orthogonal room direction`);

        // Sample 0.08m behind switch -> MUST be solid CELL_WALL
        const behindGx = worldToGrid(sw.x - nx * 0.08);
        const behindGz = worldToGrid(sw.z - nz * 0.08);
        assert.ok(inBounds(behindGx, behindGz), `Switch ${sw.id} behind cell out of bounds`);
        assert.equal(
          grid[cellIdx(behindGx, behindGz)],
          CELL_WALL,
          `Switch ${sw.id} is floating! Cell behind (${behindGx},${behindGz}) is not CELL_WALL`
        );

        // Sample 0.15m in front of switch -> MUST be walkable CELL_FLOOR
        const frontGx = worldToGrid(sw.x + nx * 0.15);
        const frontGz = worldToGrid(sw.z + nz * 0.15);
        assert.ok(inBounds(frontGx, frontGz), `Switch ${sw.id} front cell out of bounds`);
        assert.equal(
          grid[cellIdx(frontGx, frontGz)],
          CELL_FLOOR,
          `Switch ${sw.id} front cell (${frontGx},${frontGz}) is not walkable CELL_FLOOR`
        );

        // Verify exact 0.02m wall offset (flush, zero z-fighting, zero floating!)
        const expectedWallFace =
          nx > 0
            ? (behindGx + 1) * CELL_SIZE
            : nx < 0
            ? behindGx * CELL_SIZE
            : nz > 0
            ? (behindGz + 1) * CELL_SIZE
            : behindGz * CELL_SIZE;
        const actualCoord = nx !== 0 ? sw.x : sw.z;
        const offsetFromWall = Math.abs(actualCoord - expectedWallFace);
        assert.ok(
          Math.abs(offsetFromWall - WALL_SWITCH_WALL_OFFSET) < 0.005,
          `Switch ${sw.id} offset from wall face is ${offsetFromWall.toFixed(4)}m, expected ${WALL_SWITCH_WALL_OFFSET}m`
        );

        // Verify ZERO THREE.Box3 intersections with ANY furniture/prop on the same floor
        const swBox = computeLightSwitchBox3(sw);
        const floorObs = sw.floor === 0 ? obs0 : obsM1;
        for (let oi = 0; oi < floorObs.length; oi++) {
          assert.ok(
            !swBox.intersectsBox(floorObs[oi]),
            `Switch ${sw.id} at (${sw.x.toFixed(2)}, ${sw.y.toFixed(2)}, ${sw.z.toFixed(2)}) intersects obstacle #${oi} on floor ${sw.floor}`
          );
        }
      }
    }
  });

  it('prevents z-fighting on decals/trims, avoids duplicate coplanar walls/doors, and keeps 100% of doorways clear', () => {
    const layout = generateMansionLayout(202509, 'hard');

    // No duplicate doors occupying the same cell on the same floor
    const doorCells = new Set<string>();
    for (const d of layout.doors) {
      const span = d.spanCells || 2;
      for (let i = 0; i < span; i++) {
        const gx = d.axis === 'x' ? d.gx + i : d.gx;
        const gz = d.axis === 'z' ? d.gz + i : d.gz;
        const key = `${d.floor}:${gx},${gz}`;
        assert.ok(!doorCells.has(key), `Duplicate coplanar door cell detected at ${key} (${d.id})`);
        doorCells.add(key);

        // Every doorway passage must be 100% unobstructed by floor-standing furniture!
        const doorCenterX = gridToWorld(gx);
        const doorCenterZ = gridToWorld(gz);
        const floorY = d.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
        const passageBox = new Box3(
          new Vector3(doorCenterX - 0.55, floorY + 0.1, doorCenterZ - 0.55),
          new Vector3(doorCenterX + 0.55, floorY + 2.1, doorCenterZ + 0.55)
        );
        for (const f of layout.furniture) {
          if (f.floor !== d.floor) continue;
          const fBox = computeFurnitureBox3(f, 0.0);
          assert.ok(
            !passageBox.intersectsBox(fBox),
            `Furniture ${f.id} obstructs doorway ${d.id} at cell (${gx},${gz})`
          );
        }
      }
    }

    // Verify z-fighting mitigations in HorrorEngine.ts
    const engineSrc = readSrc('src/game/HorrorEngine.ts');
    const polyOffsetCount = (engineSrc.match(/polygonOffset:\s*true/g) ?? []).length;
    assert.ok(
      polyOffsetCount >= 4,
      `Expected >= 4 polygonOffset materials in HorrorEngine.ts (AO, shadow slats, cobwebs, leaves), found ${polyOffsetCount}`
    );
    assert.ok(engineSrc.includes('const trimOffset = 0.022;'), 'Baseboards must have >= 0.02m wall offset');
    assert.ok(engineSrc.includes('const dadoCenterOffset = 0.058;'), 'Dado rails must have >= 0.02m wall clearance');
    assert.ok(engineSrc.includes('const windowOffset = 0.024;'), 'Windows must have >= 0.02m wall offset');
  });

  it('keeps polished MeshPhysicalMaterial water with Schlick Fresnel & flashlight reflection + fog:false sky', () => {
    const waterSrc = readSrc('src/game/waterSystem.ts');
    assert.ok(waterSrc.includes('MeshPhysicalMaterial'), 'Water must use MeshPhysicalMaterial');
    assert.ok(waterSrc.includes('roughness: 0.03'), 'Water roughness must be 0.03');
    assert.ok(waterSrc.includes('metalness: 0.2'), 'Water metalness must be 0.2');
    assert.ok(waterSrc.includes('clearcoat: 1.0'), 'Water clearcoat must be 1.0');
    assert.ok(waterSrc.includes('uFlashPos') && waterSrc.includes('setFlashlightUniforms'), 'Water must reflect player flashlight');

    const modelsSrc = readSrc('src/game/models.ts');
    const skyStart = modelsSrc.indexOf('export function createNightSkyRig');
    assert.ok(skyStart > 0, 'createNightSkyRig must exist in models.ts');
    const skyChunk = modelsSrc.slice(skyStart);
    const fogFalseMatches = (skyChunk.match(/fog:\s*false/g) ?? []).length;
    assert.ok(fogFalseMatches >= 6, `Expected fog: false across all night sky materials, found ${fogFalseMatches}`);
  });
});
