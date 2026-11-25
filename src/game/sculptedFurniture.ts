import * as THREE from 'three';
import { FurniturePropDefinition } from './types';
import {
  MaterialPack,
  createFacilitySignTexture,
  createMarcosBadgeTexture,
  createTranslationBoardTexture,
  createWallPosterTexture,
} from './textures';
import {
  VoxelMat,
  VoxelSculptor,
  createSculptedMesh,
} from './voxelSculptor';
import {
  buildSculptedWallFrameGeo,
  createSculptedSignPlate,
} from './sculptedArchitecture';

export interface SculptedFurnitureVisual {
  def: FurniturePropDefinition;
  group: THREE.Group;
  animatedPart: THREE.Object3D | null;
  contentsAnchor: THREE.Group | null;
  statusMat: THREE.MeshStandardMaterial | null;
}

// ============================================================================
// HIGH-DENSITY MICRO-VOXEL GEOMETRY BUILDERS (ZERO PLAIN BOXES)
// ============================================================================

function buildBookshelfGeo(): THREE.BufferGeometry {
  // 26x42x11 carved hardwood archive bookcase: stepped crown molding, recessed kick base,
  // 4 shelves loaded with 24+ varied colored books, archive boxes, manila binders & tilted volumes
  const v = new VoxelSculptor(26, 42, 11, 0.056);

  // Carved carcass: back panel, thick chamfered side cheeks, stepped top crown & bottom plinth
  v.fillBox(1, 1, 1, 24, 40, 2, 0x3b2414, VoxelMat.Matte); // back panel
  v.fillBox(1, 0, 1, 2, 40, 9, 0x5c3a21, VoxelMat.Matte); // left side
  v.fillBox(23, 0, 1, 24, 40, 9, 0x5c3a21, VoxelMat.Matte); // right side
  v.fillBeveledBox(0, 0, 1, 25, 2, 10, 0x452915, VoxelMat.Matte, 'top'); // bottom kick plinth
  v.fillBeveledBox(0, 39, 0, 25, 41, 10, 0x4a2c17, VoxelMat.Matte, 'top'); // top crown molding

  const bookColors = [
    0x991b1b, 0x1e3a8a, 0x14532d, 0x92400e, 0x581c87, 0x334155, 0x7c2d12, 0x115e59,
  ];
  const shelfYs = [3, 12, 21, 30];
  shelfYs.forEach((sy, row) => {
    // Slightly thicker shelf plank with subtle sag groove in middle
    v.fillBox(2, sy, 2, 23, sy + 1, 9, 0x6b4426, VoxelMat.Matte);
    if (row === 1 || row === 2) {
      v.carveBox(10, sy + 1, 8, 15, sy + 1, 9);
    }

    // Individual books, archive boxes & leaning tomes per shelf
    let bx = 3;
    let bi = 0;
    while (bx < 21) {
      if ((row === 0 && bx === 14) || (row === 3 && bx === 4)) {
        // Cardboard archive file box with label & finger pull hole!
        v.fillBeveledBox(bx, sy + 2, 3, bx + 5, sy + 7, 8, 0xb89f78, VoxelMat.Matte, 'top');
        v.fillBox(bx + 1, sy + 4, 8, bx + 4, sy + 6, 8, 0xf5f0e1, VoxelMat.Matte);
        v.set(bx + 2, sy + 3, 8, 0x1c1917, VoxelMat.Matte);
        bx += 7;
        continue;
      }
      if ((row + bi) % 6 === 4 && bx < 19) {
        // Diagonal leaning book resting against neighbor!
        const col = bookColors[(row * 5 + bi) % bookColors.length];
        v.fillLine(bx, sy + 2, 5, bx + 2, sy + 7, 5, col, VoxelMat.Matte, 1.0);
        bx += 4;
        bi++;
        continue;
      }
      const bw = 1 + ((row + bi) % 2);
      const bh = 5 + ((row * 3 + bi * 7) % 3);
      const col = bookColors[(row * 5 + bi) % bookColors.length];
      v.fillBox(bx, sy + 2, 3, bx + bw - 1, sy + 1 + bh, 8, col, VoxelMat.Matte);
      // Gold spine band accent on tall volumes
      if (bh >= 6) {
        v.fillBox(bx, sy + bh - 1, 8, bx + bw - 1, sy + bh - 1, 8, 0xd97706, VoxelMat.Metal);
      }
      bx += bw + 1;
      bi++;
    }
  });

  v.applyTactileGrain(501, 0.06);
  return v.build({ anchor: [13, 0, 5.5] }).geometry;
}

function buildSecurityDeskGeo(): THREE.BufferGeometry {
  // 36x28x20 Cabine 09-A Security Console Desk:
  // - Heavy beveled steel desk + left 3-drawer pedestal + rear cable tray
  // - Detailed PC tower on right floor/desk edge with perforated mesh grille, internal fan blades, glowing power LED & rear cables
  // - Dual deep sculpted CRT monitor shells with bezels, control buttons, rear vents & yellow post-it notes
  // - Mechanical keyboard with individual raised keycaps + ergonomic mouse with scroll wheel & curved cord
  // - Night-guard coffee mug with handle + paper logbook
  const v = new VoxelSculptor(36, 28, 20, 0.056);

  // Heavy steel tabletop (y = 14..16) with dark rubber bumper lip
  v.fillBeveledBox(0, 14, 1, 35, 16, 18, 0x334155, VoxelMat.Metal, 'top');
  v.fillBox(1, 16, 2, 34, 16, 17, 0x1e293b, VoxelMat.Matte);
  // Modesty rear modesty panel + cable channel
  v.fillBox(2, 4, 2, 33, 13, 3, 0x1e293b, VoxelMat.Metal);

  // Left 3-drawer steel pedestal cabinet (x = 1..10)
  v.fillBeveledBox(1, 1, 3, 10, 13, 16, 0x334155, VoxelMat.Metal, 'vertical');
  for (const dy of [2, 6, 10]) {
    v.fillBox(2, dy, 16, 9, dy + 2, 17, 0x475569, VoxelMat.Metal);
    v.fillBox(4, dy + 1, 17, 7, dy + 1, 17, 0x94a3b8, VoxelMat.Metal); // chrome drawer pull
  }
  // Right heavy steel frame legs + PC TOWER standing underneath right side (x = 26..33, y = 1..13)!
  v.fillBox(33, 0, 3, 34, 13, 16, 0x334155, VoxelMat.Metal);
  // PC Tower chassis (x = 25..31, y = 1..13, z = 4..16)
  v.fillBeveledBox(25, 1, 4, 31, 13, 16, 0x111827, VoxelMat.Metal, 'vertical');
  // Perforated front intake grille + visible glowing cyan/slate internal cooling fan blades!
  v.carveLouvers(26, 3, 16, 30, 8, 16, 2);
  v.fillBox(27, 4, 15, 29, 7, 15, 0x38bdf8, VoxelMat.Metal); // fan hub
  v.set(28, 6, 15, 0x0ea5e9, VoxelMat.Emissive);
  // 5.25" optical drive bays + power/HDD LEDs on upper PC front
  v.fillBox(26, 10, 16, 30, 11, 16, 0x334155, VoxelMat.Matte);
  v.set(26, 9, 16, 0x22c55e, VoxelMat.Emissive); // green power LED
  v.set(28, 9, 16, 0xf59e0b, VoxelMat.Emissive); // amber HDD blink LED
  // Tangled rear cable bundle snaking from PC tower up to monitors
  v.fillLine(28, 10, 3, 25, 17, 3, 0x0f172a, VoxelMat.Fabric, 0);
  v.fillLine(27, 8, 3, 12, 17, 3, 0x0f172a, VoxelMat.Fabric, 0);

  // Dual deep sculpted CRT Security Monitors (left x=4..16, right x=19..31, y=17..27)
  for (const mx0 of [4, 19]) {
    // Articulated tilt pedestal stand
    v.fillBeveledBox(mx0 + 3, 17, 6, mx0 + 9, 17, 11, 0x1e293b, VoxelMat.Metal, 'top');
    v.fillBox(mx0 + 5, 18, 7, mx0 + 7, 19, 9, 0x334155, VoxelMat.Metal);
    // Deep CRT tapered rear cathode-ray housing
    v.fillBeveledBox(mx0 + 2, 20, 3, mx0 + 10, 26, 7, 0x334155, VoxelMat.Matte, 'all');
    v.carveLouvers(mx0 + 3, 25, 4, mx0 + 9, 26, 6, 2); // top heat vents
    // Front stepped bezel frame (hollow screen bay where monitor_crt plane sits!)
    v.fillBeveledBox(mx0, 19, 7, mx0 + 12, 27, 13, 0x475569, VoxelMat.Matte, 'all');
    v.carveBox(mx0 + 1, 20, 11, mx0 + 11, 26, 13);
    // Physical control buttons + glowing green power LED along bottom bezel
    v.set(mx0 + 2, 19, 13, 0x94a3b8, VoxelMat.Metal);
    v.set(mx0 + 4, 19, 13, 0x94a3b8, VoxelMat.Metal);
    v.set(mx0 + 10, 19, 13, 0x22c55e, VoxelMat.Emissive);
    // Sticky yellow Post-It note stuck on monitor bezel corner!
    v.fillBox(mx0 + 10, 24, 13, mx0 + 12, 26, 13, 0xfef08a, VoxelMat.Matte);
  }

  // Mechanical Keyboard with individual sculpted raised keycap rows! (x = 9..21, z = 14..17)
  v.fillBeveledBox(9, 17, 14, 21, 17, 17, 0x1e293b, VoxelMat.Matte, 'top');
  for (let kx = 10; kx <= 20; kx += 2) {
    v.set(kx, 18, 15, 0xcbd5e1, VoxelMat.Matte);
    v.set(kx, 18, 16, 0x94a3b8, VoxelMat.Matte);
  }
  v.fillBox(13, 18, 17, 17, 18, 17, 0xe2e8f0, VoxelMat.Matte); // spacebar
  v.set(10, 18, 15, 0xef4444, VoxelMat.Matte); // red ESC keycap!

  // Ergonomic mouse with scroll wheel + curved rubber cord (x = 24..26, z = 15..17)
  v.fillBeveledBox(24, 17, 15, 26, 18, 17, 0x334155, VoxelMat.Matte, 'top');
  v.set(25, 18, 15, 0x94a3b8, VoxelMat.Metal); // scroll wheel
  v.fillLine(25, 17, 14, 25, 17, 10, 0x0f172a, VoxelMat.Fabric, 0);

  // Guard's ceramic coffee mug with dark coffee & side handle on far right (x = 31..33, z = 14..16)
  v.fillCylinderY(32, 17, 19, 15, 1.3, 0xe2e8f0, VoxelMat.Matte);
  v.set(32, 19, 15, 0x3b1d0c, VoxelMat.Matte); // dark coffee inside
  v.set(34, 18, 15, 0xe2e8f0, VoxelMat.Matte); // handle loop

  v.applyTactileGrain(502, 0.04);
  return v.build({ anchor: [18, 0, 10] }).geometry;
}

function buildCrateGeo(): THREE.BufferGeometry {
  // 18x18x18 reinforced industrial cargo crate with recessed plank panels, diagonal X-bracing,
  // iron corner brackets & stenciled warning marks
  const v = new VoxelSculptor(18, 18, 18, 0.054);
  // Inner recessed plank cube
  v.fillBox(1, 1, 1, 16, 16, 16, 0x7c5333, VoxelMat.Matte);
  // Outer thick perimeter framing rails on all 12 edges
  v.fillHollowBox(0, 0, 0, 17, 17, 17, 2, 0x5c3a21, VoxelMat.Matte);
  // Re-fill recessed panels slightly inward so frame sticks out in true 3D relief!
  v.fillBox(2, 2, 1, 15, 15, 16, 0x855a37, VoxelMat.Matte);
  v.fillBox(1, 2, 2, 16, 15, 15, 0x855a37, VoxelMat.Matte);
  v.fillBox(2, 1, 2, 15, 16, 15, 0x855a37, VoxelMat.Matte);
  // Diagonal bracing battens on all 4 side faces
  for (let i = 3; i <= 14; i++) {
    v.set(i, i, 0, 0x6b4426, VoxelMat.Matte);
    v.set(i, i, 17, 0x6b4426, VoxelMat.Matte);
    v.set(0, i, i, 0x6b4426, VoxelMat.Matte);
    v.set(17, i, i, 0x6b4426, VoxelMat.Matte);
  }
  // Forged steel corner armor brackets on all 8 corners
  for (const cx of [0, 16]) {
    for (const cy of [0, 16]) {
      for (const cz of [0, 16]) {
        v.fillBox(cx, cy, cz, cx + 1, cy + 1, cz + 1, 0x475569, VoxelMat.Metal);
      }
    }
  }
  // Stenciled amber cargo stripe on front
  v.fillBox(5, 13, 16, 12, 14, 16, 0xd97706, VoxelMat.Matte);

  v.applyTactileGrain(503, 0.07, 3);
  return v.build({ anchor: [9, 0, 9] }).geometry;
}

function buildBarrelGeo(): THREE.BufferGeometry {
  // 16x22x16 corrugated industrial steel drum with raised rolling hoops, recessed lid & twin bung plugs
  const v = new VoxelSculptor(16, 22, 16, 0.048);
  const cx = 7.5;
  const cz = 7.5;
  v.fillCylinderY(cx, 0, 21, cz, 6.4, 0x14532d, VoxelMat.Metal);
  // Raised rolling bead hoops at bottom, mid-lower, mid-upper, top
  for (const hy of [1, 7, 14, 20]) {
    v.fillCylinderY(cx, hy, hy + 1, cz, 7.0, 0x166534, VoxelMat.Metal);
  }
  // Yellow/black biohazard warning band around center
  v.fillCylinderY(cx, 9, 12, cz, 6.6, 0xfacc15, VoxelMat.Matte, 5.5);
  v.fillCylinderY(cx, 10, 11, cz, 6.7, 0x0f172a, VoxelMat.Matte, 5.8);
  // Recessed top dish with raised 2" & 3/4" steel bung plugs
  v.fillCylinderY(cx, 21, 21, cz, 5.4, 0, VoxelMat.Empty);
  v.fillCylinderY(cx, 20, 20, cz, 5.4, 0x1e293b, VoxelMat.Metal);
  v.fillCylinderY(5, 21, 21, 6, 1.3, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(10, 21, 21, 9, 0.9, 0xd97706, VoxelMat.Metal);

  v.applyTactileGrain(504, 0.05);
  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

function buildPipeClusterGeo(): THREE.BufferGeometry {
  // 24x44x14 triple industrial chamfered vertical pipes with bolted flanges, cross-manifold,
  // circular pressure gauge with needle, and red spoked handwheel valve!
  const v = new VoxelSculptor(24, 44, 14, 0.064);

  // 3 Vertical chamfered industrial pipes (left, center, right) with bolted flange couplings
  const pipeXs = [4.5, 11.5, 18.5];
  pipeXs.forEach((px, idx) => {
    const col = idx === 1 ? 0x6b4226 : 0x475569;
    v.fillCylinderY(px, 0, 43, 5.5, 2.1, col, VoxelMat.Metal);
    for (const fy of [6, 18, 30, 40]) {
      v.fillCylinderY(px, fy, fy + 1, 5.5, 3.0, 0x334155, VoxelMat.Metal);
      // Flange bolts
      v.set(Math.round(px - 2), fy + 1, 8, 0x94a3b8, VoxelMat.Metal);
      v.set(Math.round(px + 2), fy + 1, 8, 0x94a3b8, VoxelMat.Metal);
    }
  });

  // Horizontal copper bypass manifold connecting pipes at y = 21
  v.fillCylinderX(4, 19, 21, 5.5, 1.4, 0xb45309, VoxelMat.Metal);
  // Wall mounting strut brackets behind pipes
  for (const by of [10, 26, 36]) {
    v.fillBox(1, by, 1, 22, by + 1, 3, 0x1e293b, VoxelMat.Metal);
  }

  // Sculpted Red Spoked Valve Wheel protruding forward from center pipe (y = 21, z = 8..12)
  v.fillCylinderZ(11.5, 21, 7, 11, 1.1, 0x94a3b8, VoxelMat.Metal); // valve stem
  v.fillCylinderZ(11.5, 21, 11, 12, 4.4, 0xdc2626, VoxelMat.Metal, 3.0); // red outer rim
  v.fillLine(8, 21, 11, 15, 21, 11, 0xb91c1c, VoxelMat.Metal, 0); // spokes
  v.fillLine(11, 17, 11, 11, 25, 11, 0xb91c1c, VoxelMat.Metal, 0);
  v.fillCylinderZ(11.5, 21, 11, 12, 1.2, 0xf59e0b, VoxelMat.Metal); // brass center nut

  // Circular Pressure Manometer Gauge mounted on left pipe (x = 4.5, y = 25, z = 8..10)
  v.fillCylinderZ(4.5, 25, 7, 9, 2.8, 0xd97706, VoxelMat.Metal); // brass bezel
  v.fillCylinderZ(4.5, 25, 9, 9, 2.0, 0xf8fafc, VoxelMat.Matte); // white dial face
  v.fillLine(4.5, 25, 9, 6, 26, 9, 0xdc2626, VoxelMat.Emissive, 0); // red pressure needle
  v.fillCylinderZ(4.5, 25, 10, 10, 2.2, 0xbae6fd, VoxelMat.Glass); // glass face

  v.applyTactileGrain(505, 0.05);
  return v.build({ anchor: [12, 0, 5.5] }).geometry;
}

function buildMedicalBedPropGeo(): THREE.BufferGeometry {
  // 34x22x18 medical examination gurney with caster wheels, hydraulic lift base,
  // folded chrome rails, crumpled stained mattress & clinical clipboard at foot!
  const v = new VoxelSculptor(34, 22, 18, 0.058);

  // 4 swivel caster wheels + tubular chrome base carriage
  for (const [lx, lz] of [[3, 3], [30, 3], [3, 14], [30, 14]]) {
    v.fillBox(lx, 0, lz, lx, 1, lz + 1, 0x0f172a, VoxelMat.Fabric);
    v.fillBox(lx, 2, lz, lx, 9, lz, 0x94a3b8, VoxelMat.Metal);
  }
  // Lower oxygen tank tray + cyan medical oxygen cylinder underneath!
  v.fillBox(4, 3, 4, 29, 4, 13, 0x334155, VoxelMat.Metal);
  v.fillCylinderX(9, 23, 6, 8.5, 2.1, 0x0284c7, VoxelMat.Metal);
  v.fillBox(24, 5, 8, 25, 7, 9, 0xd97706, VoxelMat.Metal); // brass valve

  // Upper tubular steel gurney deck + raised headboard/footboard + side chrome guardrails
  v.fillBeveledBox(2, 9, 2, 31, 11, 15, 0x64748b, VoxelMat.Metal, 'vertical');
  v.fillBox(2, 11, 2, 3, 20, 15, 0x94a3b8, VoxelMat.Metal);
  v.carveBox(2, 12, 4, 3, 18, 13);
  v.fillBox(30, 11, 2, 31, 16, 15, 0x94a3b8, VoxelMat.Metal);
  v.carveBox(30, 12, 4, 31, 14, 13);
  // Chrome side rails
  v.fillBox(8, 15, 2, 25, 15, 2, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(8, 15, 15, 25, 15, 15, 0xcbd5e1, VoxelMat.Metal);
  for (const rx of [10, 23]) {
    v.fillBox(rx, 11, 2, rx, 15, 2, 0x94a3b8, VoxelMat.Metal);
    v.fillBox(rx, 11, 15, rx, 15, 15, 0x94a3b8, VoxelMat.Metal);
  }

  // Crumpled clinical mattress, wrinkled light-blue sheet, blood/chemical stain & pillow
  v.fillBeveledBox(4, 11, 3, 29, 13, 14, 0xdbeafe, VoxelMat.Fabric, 'top');
  v.fillBeveledBox(12, 13, 3, 28, 14, 14, 0x93c5fd, VoxelMat.Fabric, 'top');
  v.fillBox(15, 14, 6, 19, 14, 10, 0x16a34a, VoxelMat.Fabric); // Composto 09 residue stain!
  v.fillBeveledBox(4, 13, 5, 10, 16, 12, 0xf8fafc, VoxelMat.Fabric, 'all');
  v.carveBox(6, 16, 7, 8, 16, 10);

  v.applyTactileGrain(506, 0.04);
  return v.build({ anchor: [17, 0, 9] }).geometry;
}

function buildDiningTableGeo(): THREE.BufferGeometry {
  // 34x18x18 Refeitório cafeteria dining table: planked beveled top, steel trussed legs with shoes,
  // 2 stamped steel lunch trays, dented cup, spilled soup bowl & abandoned fork
  const v = new VoxelSculptor(34, 18, 18, 0.056);

  // Thick planked tabletop with beveled edge & seam lines (y = 13..15 -> 0.84m top!)
  v.fillBeveledBox(0, 13, 0, 33, 15, 17, 0x7c5333, VoxelMat.Matte, 'top');
  for (const pz of [4, 9, 13]) {
    v.fillBox(1, 15, pz, 32, 15, pz, 0x4a2f1a, VoxelMat.Matte);
  }
  // Recessed perimeter apron + diagonal steel corner trusses
  v.fillBox(2, 11, 2, 31, 12, 15, 0x4a2f1a, VoxelMat.Matte);
  v.carveBox(4, 11, 4, 29, 12, 13);
  for (const [lx, lz] of [[2, 2], [30, 2], [2, 14], [30, 14]]) {
    v.fillBox(lx, 2, lz, lx + 1, 12, lz + 1, 0x3b2414, VoxelMat.Matte);
    v.fillBox(lx, 0, lz, lx + 1, 1, lz + 1, 0x334155, VoxelMat.Metal);
  }
  // Lower H-stretcher footrest rail
  v.fillBox(3, 3, 8, 30, 4, 9, 0x334155, VoxelMat.Metal);
  v.fillBox(2, 3, 3, 3, 4, 14, 0x334155, VoxelMat.Metal);
  v.fillBox(30, 3, 3, 31, 4, 14, 0x334155, VoxelMat.Metal);

  // Cafeteria storytelling clutter on top: 2 compartmentalized steel trays + dented mug!
  v.fillBox(4, 16, 4, 12, 16, 10, 0x94a3b8, VoxelMat.Metal);
  v.carveBox(5, 16, 5, 8, 16, 7);
  v.fillBox(5, 16, 5, 8, 16, 7, 0x64748b, VoxelMat.Metal);
  v.fillBox(21, 16, 7, 29, 16, 13, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(16, 16, 17, 6, 1.3, 0xd97706, VoxelMat.Metal); // dented tin cup

  v.applyTactileGrain(507, 0.06);
  return v.build({ anchor: [17, 0, 9] }).geometry;
}

function buildSideTableGeo(isBasement: boolean): THREE.BufferGeometry {
  // 18x16x14 sturdy support table (exact top at y = 0.82m so anchored pickups sit flush!)
  const vs = 0.052;
  const v = new VoxelSculptor(18, 16, 14, vs);
  const topCol = isBasement ? 0x475569 : 0x7c5333;
  const legCol = isBasement ? 0x334155 : 0x4a2f1a;
  const matCh = isBasement ? VoxelMat.Metal : VoxelMat.Matte;

  // Beveled thick top slab (y = 14..15 -> 16 * 0.052 = 0.832m!)
  v.fillBeveledBox(0, 14, 0, 17, 15, 13, topCol, matCh, 'top');
  // Recessed half-open drawer with brass pull under top
  v.fillBox(2, 11, 2, 15, 13, 12, legCol, matCh);
  v.fillBox(4, 11, 12, 13, 13, 13, isBasement ? 0x64748b : 0x8a5e3c, matCh);
  v.fillBox(7, 12, 13, 10, 12, 13, 0xf59e0b, VoxelMat.Metal); // brass handle
  // 4 chamfered legs + floor shoes + lower slatted shelf
  for (const [lx, lz] of [[1, 1], [15, 1], [1, 11], [15, 11]]) {
    v.fillBox(lx, 2, lz, lx + 1, 13, lz + 1, legCol, matCh);
    v.fillBox(lx, 0, lz, lx + 1, 1, lz + 1, 0x1e293b, VoxelMat.Metal);
  }
  v.fillBox(2, 4, 2, 15, 4, 11, topCol, matCh);
  for (let x = 4; x <= 13; x += 3) {
    v.carveBox(x, 4, 3, x, 4, 10); // slatted lower shelf gaps!
  }
  v.applyTactileGrain(508 + (isBasement ? 1 : 0), 0.05);
  return v.build({ anchor: [9, 0, 7] }).geometry;
}

function buildDrawerCarcassGeo(): THREE.BufferGeometry {
  // 20x22x16 hollow wood/brass sliding drawer cabinet carcass!
  // Upper front bay (y = 12..19, z = 4..15) is GENUINELY HOLLOW for sliding tray!
  const v = new VoxelSculptor(20, 22, 16, 0.05);

  // Sculpted corner feet + recessed toe-kick
  for (const [fx, fz] of [[1, 1], [17, 1], [1, 13], [17, 13]]) {
    v.fillBox(fx, 0, fz, fx + 1, 1, fz + 1, 0x2b190d, VoxelMat.Matte);
  }
  // Lower cabinet body with carved decorative bottom drawer + brass bail pull (y = 2..11)
  v.fillBeveledBox(1, 2, 1, 18, 11, 14, 0x5c3a21, VoxelMat.Matte, 'vertical');
  v.fillBeveledBox(3, 3, 14, 16, 10, 15, 0x7c5333, VoxelMat.Matte, 'all');
  v.fillBox(7, 6, 15, 12, 7, 15, 0xf59e0b, VoxelMat.Metal); // brass handle

  // Hollow upper carcass walls (left, right, back) + steel drawer runner rails
  v.fillBox(1, 12, 1, 2, 19, 14, 0x5c3a21, VoxelMat.Matte);
  v.fillBox(17, 12, 1, 18, 19, 14, 0x5c3a21, VoxelMat.Matte);
  v.fillBox(1, 12, 1, 18, 19, 2, 0x452915, VoxelMat.Matte);
  // Steel slide rails inside hollow bay
  v.fillBox(3, 14, 3, 3, 15, 13, 0x64748b, VoxelMat.Metal);
  v.fillBox(16, 14, 3, 16, 15, 13, 0x64748b, VoxelMat.Metal);

  // Thick overhanging beveled wood top slab (y = 20..21)
  v.fillBeveledBox(0, 20, 0, 19, 21, 15, 0x6b4426, VoxelMat.Matte, 'top');

  v.applyTactileGrain(509, 0.06);
  return v.build({ anchor: [10, 0, 8] }).geometry;
}

function buildDrawerTrayGeo(): THREE.BufferGeometry {
  // Hollow 5-wall sliding drawer box with chamfered front face, brass pull & side dove-tail trim
  const v = new VoxelSculptor(16, 8, 14, 0.05);
  // Bottom tray floor
  v.fillBox(1, 0, 1, 14, 0, 12, 0x3b2414, VoxelMat.Matte);
  // Left, right & back walls (top open!)
  v.fillBox(1, 1, 1, 1, 5, 12, 0x4a2f1a, VoxelMat.Matte);
  v.fillBox(14, 1, 1, 14, 5, 12, 0x4a2f1a, VoxelMat.Matte);
  v.fillBox(1, 1, 1, 14, 5, 1, 0x4a2f1a, VoxelMat.Matte);
  // Carved front face panel + stepped bevel + gleaming brass handle + nameplate
  v.fillBeveledBox(0, 0, 12, 15, 7, 13, 0x7c5333, VoxelMat.Matte, 'all');
  v.fillBox(5, 3, 13, 10, 4, 13, 0xf59e0b, VoxelMat.Metal);
  v.fillBox(6, 5, 13, 9, 6, 13, 0xcbd5e1, VoxelMat.Metal); // label holder

  v.applyTactileGrain(510, 0.05);
  return v.build({ anchor: [8, 4, 7] }).geometry;
}

function buildPottedPlantGeo(): THREE.BufferGeometry {
  // 18x32x18 ribbed terracotta planter with drip saucer, granular soil, gnarled woody trunk & layered fern foliage
  const v = new VoxelSculptor(18, 32, 18, 0.045);
  const cx = 8.5;
  const cz = 8.5;
  // Drip saucer + tapered ribbed terracotta pot
  v.fillCylinderY(cx, 0, 1, cz, 5.8, 0x7c2d12, VoxelMat.Matte);
  v.fillCylinderY(cx, 2, 5, cz, 4.6, 0x9a3412, VoxelMat.Matte);
  v.fillCylinderY(cx, 6, 9, cz, 5.3, 0xb45309, VoxelMat.Matte);
  v.fillCylinderY(cx, 9, 10, cz, 6.0, 0x9a3412, VoxelMat.Matte, 4.4); // flared pot rim
  // Dark soil mound
  v.fillCylinderY(cx, 9, 10, cz, 4.5, 0x291c14, VoxelMat.Fabric);
  // Gnarled branching trunk
  v.fillLine(8.5, 10, 8.5, 8, 17, 8.5, 0x5c3a21, VoxelMat.Matte, 1.0);
  v.fillLine(8, 16, 8.5, 5, 22, 6, 0x5c3a21, VoxelMat.Matte, 0.6);
  v.fillLine(8, 17, 8.5, 12, 23, 11, 0x5c3a21, VoxelMat.Matte, 0.6);
  // Asymmetric multi-tiered voxel foliage clusters (deep emerald + sunlit tips)
  v.fillBeveledBox(3, 18, 3, 14, 24, 14, 0x166534, VoxelMat.Fabric, 'all');
  v.carveBox(7, 18, 3, 10, 20, 4);
  v.carveBox(13, 21, 7, 14, 23, 10);
  v.fillBeveledBox(5, 23, 5, 13, 28, 13, 0x15803d, VoxelMat.Fabric, 'all');
  v.fillBeveledBox(6, 27, 6, 11, 31, 11, 0x22c55e, VoxelMat.Fabric, 'all');
  // Drooping frond tips
  for (const [fx, fy, fz] of [[2, 20, 8], [15, 21, 9], [8, 22, 2], [9, 19, 15]]) {
    v.fillBox(fx, fy, fz, fx + 1, fy + 1, fz + 1, 0x16a34a, VoxelMat.Fabric);
  }
  v.applyTactileGrain(511, 0.06);
  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

function buildCableConduitGeo(): THREE.BufferGeometry {
  // 42x12x6 dual industrial chamfered conduit pipes, central bolted junction pull-box,
  // 4 yellow steel wall clamps & sagging braided cable loop
  const v = new VoxelSculptor(42, 12, 6, 0.062);
  v.fillCylinderX(0, 41, 8, 2.5, 1.3, 0x475569, VoxelMat.Metal);
  v.fillCylinderX(0, 41, 3, 2.5, 1.3, 0x334155, VoxelMat.Metal);
  // Central armored junction pull-box with screw lid
  v.fillBeveledBox(17, 1, 0, 24, 10, 5, 0x334155, VoxelMat.Metal, 'all');
  v.set(18, 2, 5, 0x94a3b8, VoxelMat.Metal);
  v.set(23, 2, 5, 0x94a3b8, VoxelMat.Metal);
  v.set(18, 9, 5, 0x94a3b8, VoxelMat.Metal);
  v.set(23, 9, 5, 0x94a3b8, VoxelMat.Metal);
  v.set(20, 5, 5, 0x22c55e, VoxelMat.Emissive); // tiny status indicator
  // 4 Yellow saddle clamps gripping both conduits
  for (const cx of [4, 12, 29, 37]) {
    v.fillBox(cx, 1, 0, cx + 1, 10, 4, 0xeab308, VoxelMat.Metal);
  }
  // Sagging loose insulated cable drooping under junction box
  v.fillLine(22, 2, 3, 27, 0, 4, 0x0f172a, VoxelMat.Fabric, 0);
  v.fillLine(27, 0, 4, 33, 2, 3, 0x0f172a, VoxelMat.Fabric, 0);
  return v.build({ anchor: [21, 6, 1] }).geometry;
}

function buildStandingLampGeo(): THREE.BufferGeometry {
  // 14x40x14 sculpted vintage floor lamp: weighted cast-iron stepped base, fluted brass stem,
  // pull-chain tassel, scalloped hollow lampshade with glowing inner amber bulb & finial
  const v = new VoxelSculptor(14, 40, 14, 0.052);
  const cx = 6.5;
  const cz = 6.5;
  v.fillCylinderY(cx, 0, 1, cz, 5.2, 0x1e293b, VoxelMat.Metal);
  v.fillCylinderY(cx, 2, 3, cz, 3.6, 0x334155, VoxelMat.Metal);
  // Fluted brass pole with decorative collars
  v.fillCylinderY(cx, 4, 34, cz, 1.0, 0xb45309, VoxelMat.Metal);
  for (const cy of [10, 20, 30]) {
    v.fillCylinderY(cx, cy, cy + 1, cz, 1.7, 0xd97706, VoxelMat.Metal);
  }
  // Brass pull-chain hanging down beside bulb
  v.fillBox(9, 28, 6, 9, 32, 6, 0xf59e0b, VoxelMat.Metal);
  // Tapered pleated cream/amber vintage lampshade (hollow bottom & top!)
  v.fillCylinderY(cx, 31, 33, cz, 5.6, 0xfde68a, VoxelMat.Fabric, 4.4);
  v.fillCylinderY(cx, 34, 36, cz, 4.8, 0xfef3c7, VoxelMat.Fabric, 3.7);
  v.fillCylinderY(cx, 37, 38, cz, 3.8, 0xfde68a, VoxelMat.Fabric, 2.8);
  // Warm glowing filament bulb inside shade + brass top finial
  v.fillCylinderY(cx, 32, 35, cz, 1.8, 0xfef08a, VoxelMat.Emissive);
  v.fillCylinderY(cx, 38, 39, cz, 1.2, 0xd97706, VoxelMat.Metal);
  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

function buildGeneratorChassisGeo(): THREE.BufferGeometry {
  // 30x28x22 massive industrial diesel-electric substation generator with radiator louvers,
  // twin top exhaust stacks, flywheel cover, voltage gauges & hazard base skids
  const v = new VoxelSculptor(30, 28, 22, 0.058);

  // Heavy I-beam steel base skids with yellow/black hazard bumper
  v.fillBox(0, 0, 1, 29, 2, 20, 0x1e293b, VoxelMat.Metal);
  for (let x = 1; x <= 28; x += 2) {
    v.set(x, 1, 20, x % 4 === 1 ? 0xfacc15 : 0x0f172a, VoxelMat.Matte);
  }
  // Main armored turbine/diesel housing
  v.fillBeveledBox(2, 3, 2, 27, 23, 18, 0x334155, VoxelMat.Metal, 'all');
  // Deep recessed louvered radiator vents on front-left & sides
  v.carveLouvers(4, 6, 17, 13, 18, 18, 2);
  v.fillBox(4, 6, 16, 13, 18, 16, 0x0f172a, VoxelMat.Metal);
  v.carveLouvers(2, 6, 5, 2, 18, 14, 2);
  v.carveLouvers(27, 6, 5, 27, 18, 14, 2);

  // Twin vertical rusted exhaust muffler stacks + heat shields rising from top (y = 23..27)
  v.fillCylinderY(7, 23, 27, 6, 2.1, 0x475569, VoxelMat.Metal);
  v.fillCylinderY(14, 23, 27, 6, 2.1, 0x475569, VoxelMat.Metal);
  v.fillCylinderY(7, 27, 27, 6, 1.2, 0, VoxelMat.Empty);
  v.fillCylinderY(14, 27, 27, 6, 1.2, 0, VoxelMat.Empty);
  // Top high-voltage ceramic insulator bushings & copper busbar
  for (const ix of [20, 24]) {
    v.fillCylinderY(ix, 23, 26, 8, 1.4, 0xd97706, VoxelMat.Metal);
    v.fillCylinderY(ix, 24, 24, 8, 1.9, 0xe2e8f0, VoxelMat.Matte);
  }

  // Front control console panel on right half (x = 16..26) with dual analog dials & fuse bay
  v.fillBox(16, 7, 18, 26, 20, 19, 0x1e293b, VoxelMat.Metal);
  v.fillBox(17, 15, 19, 20, 18, 19, 0xe2e8f0, VoxelMat.Matte); // gauge 1
  v.set(18, 16, 19, 0xef4444, VoxelMat.Emissive);
  v.fillBox(22, 15, 19, 25, 18, 19, 0xe2e8f0, VoxelMat.Matte); // gauge 2
  v.set(23, 17, 19, 0x22c55e, VoxelMat.Emissive);
  // Ceramic fuse socket housing below gauges
  v.fillBox(17, 9, 19, 21, 13, 19, 0x0f172a, VoxelMat.Matte);
  v.fillBox(18, 10, 19, 20, 12, 19, 0xd97706, VoxelMat.Metal);

  v.applyTactileGrain(512, 0.05);
  return v.build({ anchor: [15, 0, 11] }).geometry;
}

function buildGeneratorLeverHandleGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(10, 16, 6, 0.032);
  v.fillBeveledBox(3, 0, 1, 6, 3, 4, 0x475569, VoxelMat.Metal, 'all');
  v.fillBox(4, 3, 2, 5, 12, 3, 0xcbd5e1, VoxelMat.Metal);
  v.fillBeveledBox(1, 12, 1, 8, 15, 4, 0xfacc15, VoxelMat.Fabric, 'all');
  return v.build({ anchor: [5, 1, 2.5] }).geometry;
}

function buildSecretTerminalGeo(): THREE.BufferGeometry {
  // 22x34x16 Projeto Ômega Mainframe Terminal: angled console desk, twin reel-to-reel tape drives
  // behind translucent glass, glowing violet/cyan status racks, sculpted keyboard & floor cables!
  const v = new VoxelSculptor(22, 34, 16, 0.054);

  // Lower mainframe server cabinet with cooling louvers & purple LED activity strips
  v.fillBeveledBox(2, 0, 2, 19, 15, 12, 0x1e293b, VoxelMat.Metal, 'vertical');
  v.carveLouvers(4, 2, 12, 17, 9, 12, 2);
  v.fillBox(4, 11, 12, 17, 13, 13, 0x0f172a, VoxelMat.Matte);
  for (let x = 5; x <= 15; x += 3) {
    v.set(x, 12, 13, x % 2 === 0 ? 0xa855f7 : 0x38bdf8, VoxelMat.Emissive);
  }

  // Protruding angled keyboard console shelf (y = 14..17, z = 11..15)
  v.fillBeveledBox(1, 14, 9, 20, 16, 15, 0x334155, VoxelMat.Metal, 'top');
  for (let kx = 3; kx <= 17; kx += 2) {
    v.set(kx, 17, 13, 0xcbd5e1, VoxelMat.Matte);
    v.set(kx, 17, 14, 0x94a3b8, VoxelMat.Matte);
  }

  // Upper CRT monitor & twin reel-to-reel magnetic tape drive head (y = 17..33)
  v.fillBeveledBox(2, 17, 2, 19, 32, 11, 0x334155, VoxelMat.Metal, 'all');
  // Recessed CRT screen bay (z = 10..11, y = 19..26)
  v.carveBox(4, 19, 10, 17, 26, 11);
  // Top twin reel-to-reel data spools behind translucent glass panel (y = 27..31)!
  v.carveBox(4, 27, 10, 17, 31, 11);
  v.fillCylinderZ(7, 29, 9, 10, 1.8, 0xe2e8f0, VoxelMat.Metal);
  v.fillCylinderZ(14, 29, 9, 10, 1.8, 0xe2e8f0, VoxelMat.Metal);
  v.set(7, 29, 10, 0xa855f7, VoxelMat.Emissive);
  v.set(14, 29, 10, 0xa855f7, VoxelMat.Emissive);
  v.fillBox(4, 27, 11, 17, 31, 11, 0xc084fc, VoxelMat.Glass);

  // Heavy data cables trailing out side
  v.fillLine(19, 4, 5, 21, 0, 8, 0x0f172a, VoxelMat.Fabric, 0);
  v.fillLine(2, 5, 5, 0, 0, 9, 0x0f172a, VoxelMat.Fabric, 0);

  return v.build({ anchor: [11, 0, 8] }).geometry;
}

// ============================================================================
// ENVIRONMENTAL STORYTELLING PROPS (ALL 16 EXISTING + 5 NEW HIGH-DETAIL PROPS)
// ============================================================================

function buildRadioDeskGeo(): THREE.BufferGeometry {
  // 34x26x18 Vigia Marcos's Reception Security Counter:
  // slatted wood counter front, recessed security tray, sculpted VHF dispatch radio console
  // with glowing amber frequency dial, telescoping whip antenna, coiled mic handset, logbook & cup!
  const v = new VoxelSculptor(34, 26, 18, 0.056);

  // Counter base plinth + recessed vertical wooden paneling slats across front
  v.fillBox(1, 0, 2, 32, 2, 16, 0x291c14, VoxelMat.Matte);
  v.fillBox(1, 2, 2, 32, 14, 15, 0x5c3a21, VoxelMat.Matte);
  for (let x = 3; x <= 30; x += 3) {
    v.fillBox(x, 3, 15, x + 1, 13, 16, 0x73492a, VoxelMat.Matte);
  }
  // Thick overhanging marble/wood counter slab (y = 15..16)
  v.fillBeveledBox(0, 15, 0, 33, 16, 17, 0x7c5333, VoxelMat.Matte, 'top');
  v.fillBox(1, 16, 1, 32, 16, 16, 0x4a2f1a, VoxelMat.Matte);

  // Sculpted VHF Dispatch Radio Console on center-left (x = 5..16, y = 17..22)
  v.fillBeveledBox(5, 17, 5, 16, 22, 12, 0x1e293b, VoxelMat.Metal, 'all');
  // Speaker grille louvers on left side of radio
  v.carveLouvers(6, 18, 12, 10, 21, 12, 1);
  // Glowing amber analog frequency tuning dial + red TX LED
  v.fillBox(11, 20, 12, 15, 21, 12, 0xf59e0b, VoxelMat.Emissive);
  v.set(15, 18, 12, 0xef4444, VoxelMat.Emissive);
  v.fillBox(12, 18, 12, 13, 18, 13, 0x94a3b8, VoxelMat.Metal); // tuning knob
  // Telescoping chrome antenna rising high at rear!
  v.fillBox(6, 22, 6, 6, 25, 6, 0xcbd5e1, VoxelMat.Metal);
  // Handset microphone + coiled black cord resting on desk beside radio
  v.fillLine(16, 18, 10, 18, 17, 13, 0x0f172a, VoxelMat.Fabric, 0);
  v.fillBeveledBox(17, 17, 12, 20, 18, 14, 0x111827, VoxelMat.Fabric, 'top');

  // Open guard shift logbook with pen & coffee ring stain on right side
  v.fillBox(22, 17, 7, 30, 17, 13, 0xf1f5f9, VoxelMat.Matte);
  v.fillBox(26, 17, 7, 26, 17, 13, 0x64748b, VoxelMat.Matte); // spine crease
  v.fillLine(28, 18, 8, 30, 18, 11, 0x2563eb, VoxelMat.Metal, 0); // pen

  v.applyTactileGrain(520, 0.05);
  return v.build({ anchor: [17, 0, 9] }).geometry;
}

function buildCoffeeSpillGeo(): THREE.BufferGeometry {
  // 22x12x22 overturned ceramic guard mug, dark spreading coffee puddle relief,
  // soaked paper napkin & cracked saucer shards!
  const v = new VoxelSculptor(22, 10, 22, 0.036);
  // Organic irregular dark coffee puddle on floor (y = 0)
  v.fillCylinderY(11, 0, 0, 11, 6.2, 0x2e170a, VoxelMat.Glass);
  v.fillCylinderY(15, 0, 0, 14, 4.0, 0x3b1d0c, VoxelMat.Glass);
  v.fillCylinderY(7, 0, 0, 14, 3.2, 0x291308, VoxelMat.Glass);
  // Overturned ceramic mug lying horizontally with curved handle & hollow interior
  v.fillCylinderX(4, 9, 3, 8, 2.5, 0xe2e8f0, VoxelMat.Matte);
  v.fillCylinderX(7, 9, 3, 8, 1.5, 0x2e170a, VoxelMat.Matte); // dark interior
  v.fillBox(5, 5, 7, 7, 6, 9, 0xe2e8f0, VoxelMat.Matte); // mug handle
  v.carveBox(6, 5, 7, 6, 5, 9);
  // Crumpled coffee-stained paper napkin & clipboard edge nearby
  v.fillBeveledBox(13, 1, 6, 18, 2, 11, 0xd6ccb8, VoxelMat.Fabric, 'top');
  v.fillBox(14, 2, 8, 16, 2, 10, 0x6b3a1d, VoxelMat.Fabric);
  // Stray yellow pencil & broken mug ceramic chip
  v.fillLine(8, 1, 16, 14, 1, 18, 0xfacc15, VoxelMat.Matte, 0);
  v.set(14, 1, 18, 0xf43f5e, VoxelMat.Fabric);
  return v.build({ anchor: [11, 0, 11] }).geometry;
}

function buildBenchBrokenGeo(): THREE.BufferGeometry {
  // 34x18x14 weathered courtyard wooden bench: ornate cast-iron scroll armrests,
  // individual slatted seat & backrest planks, with right leg buckled & broken boards!
  const v = new VoxelSculptor(34, 18, 14, 0.056);

  // Left intact cast-iron scroll frame & armrest (x = 3..4)
  v.fillBox(3, 0, 2, 4, 15, 3, 0x1e293b, VoxelMat.Metal);
  v.fillBox(3, 0, 11, 4, 10, 12, 0x1e293b, VoxelMat.Metal);
  v.fillBox(3, 7, 3, 4, 8, 11, 0x334155, VoxelMat.Metal);
  v.fillBox(3, 10, 4, 4, 11, 12, 0x334155, VoxelMat.Metal); // curved armrest

  // Right snapped/buckled iron leg (collapsed lower on right!)
  v.fillBox(29, 0, 2, 30, 11, 3, 0x1e293b, VoxelMat.Metal);
  v.fillLine(29, 0, 11, 32, 6, 12, 0x334155, VoxelMat.Metal, 0.8);

  // Individual slatted seat planks sagging toward the broken right side!
  for (const pz of [4, 7, 10]) {
    for (let x = 2; x <= 31; x++) {
      const sag = x > 18 ? Math.floor((x - 18) * 0.25) : 0;
      if (x === 23 && pz === 10) continue; // snapped missing wood chunk!
      v.fillBox(x, 7 - sag, pz, x, 8 - sag, pz + 1, 0x6b4426, VoxelMat.Matte);
    }
  }
  // Slatted backrest planks with snapped gap on right
  for (const py of [11, 14]) {
    for (let x = 2; x <= 26; x++) {
      const sag = x > 17 ? Math.floor((x - 17) * 0.22) : 0;
      v.fillBox(x, py - sag, 2, x, py + 1 - sag, 3, 0x7c5333, VoxelMat.Matte);
    }
  }
  // Fallen broken wooden plank lying on ground in front
  v.fillLine(20, 0, 12, 30, 1, 13, 0x5c3a21, VoxelMat.Matte, 0.7);

  v.applyTactileGrain(522, 0.07);
  return v.build({ anchor: [17, 0, 7] }).geometry;
}

function buildWingSignPostGeo(): THREE.BufferGeometry {
  // 24x40x12 freestanding courtyard iron signpost with concrete plinth, fluted steel post,
  // dual opposing beveled arrow blades & top warning beacon cap
  const v = new VoxelSculptor(24, 40, 12, 0.056);
  // Concrete octagonal plinth
  v.fillBeveledBox(8, 0, 2, 15, 4, 9, 0x475569, VoxelMat.Matte, 'vertical');
  // Steel post with riveted base flange
  v.fillCylinderY(11.5, 4, 38, 5.5, 1.4, 0x334155, VoxelMat.Metal);
  v.fillBeveledBox(9, 37, 3, 14, 39, 8, 0x1e293b, VoxelMat.Metal, 'top');
  v.fillBox(10, 36, 4, 13, 36, 7, 0xf59e0b, VoxelMat.Emissive); // warm directional beacon
  // Left arrow sign backing (ALA OESTE)
  v.fillBox(1, 28, 5, 14, 33, 6, 0x1e293b, VoxelMat.Metal);
  v.fillBox(2, 29, 6, 13, 32, 6, 0xd97706, VoxelMat.Matte);
  v.set(0, 30, 5, 0xf59e0b, VoxelMat.Metal);
  v.set(0, 31, 5, 0xf59e0b, VoxelMat.Metal);
  // Right arrow sign backing (ALA LESTE)
  v.fillBox(10, 21, 5, 22, 26, 6, 0x1e293b, VoxelMat.Metal);
  v.fillBox(11, 22, 6, 21, 25, 6, 0x2563eb, VoxelMat.Matte);
  v.set(23, 23, 5, 0x38bdf8, VoxelMat.Metal);
  v.set(23, 24, 5, 0x38bdf8, VoxelMat.Metal);
  return v.build({ anchor: [12, 0, 6] }).geometry;
}

function buildWallCctvGeo(): THREE.BufferGeometry {
  // Wall-mounted articulated CCTV camera with wall plate, angled arm, stepped hood, glass lens & red LED
  const v = new VoxelSculptor(16, 16, 24, 0.026);
  // Bolted steel wall mount plate (z = 0..1)
  v.fillBeveledBox(4, 4, 0, 11, 11, 1, 0x334155, VoxelMat.Metal, 'vertical');
  // Articulated cantilever arm extending forward + downward tilt
  v.fillLine(7.5, 8, 1, 7.5, 8, 9, 0x475569, VoxelMat.Metal, 1.0);
  v.fillBeveledBox(6, 6, 8, 9, 10, 11, 0x1e293b, VoxelMat.Metal, 'all');
  // Stepped camera body + overhanging sun-visor
  v.fillBeveledBox(3, 3, 10, 12, 11, 20, 0xdbe4ee, VoxelMat.Matte, 'all');
  v.fillBox(2, 11, 9, 13, 12, 23, 0x334155, VoxelMat.Metal);
  v.carveLouvers(3, 5, 12, 3, 9, 17, 2);
  v.carveLouvers(12, 5, 12, 12, 9, 17, 2);
  // Multi-layer lens barrel + optical glass + red REC LED
  v.fillCylinderZ(7.5, 6.5, 20, 22, 3.2, 0x111827, VoxelMat.Metal);
  v.fillCylinderZ(7.5, 6.5, 22, 23, 2.2, 0x0c4a6e, VoxelMat.Glass);
  v.fillBox(10, 9, 21, 11, 10, 21, 0xef4444, VoxelMat.Emissive);
  // Power cable loop
  v.fillLine(9, 6, 1, 11, 4, 6, 0x0f172a, VoxelMat.Fabric, 0);
  v.fillLine(11, 4, 6, 9, 5, 10, 0x0f172a, VoxelMat.Fabric, 0);
  return v.build({ anchor: [7.5, 8, 0] }).geometry;
}

function buildVentGrateLooseGeo(): THREE.BufferGeometry {
  // 22x5x18 pried-off louvered steel ventilation duct grille lying askew on the floor + loose screws!
  const v = new VoxelSculptor(22, 6, 18, 0.042);
  // Outer bent steel flange perimeter
  v.fillBox(1, 0, 1, 20, 2, 16, 0x475569, VoxelMat.Metal);
  v.carveBox(3, 0, 3, 18, 2, 14);
  // Individual angled louver blades running across opening
  for (let z = 4; z <= 13; z += 2) {
    v.fillBox(3, 1, z, 18, 2, z, 0x64748b, VoxelMat.Metal);
  }
  // Center divider rib & bent corner tab (pried with crowbar!)
  v.fillBox(10, 1, 2, 11, 2, 15, 0x334155, VoxelMat.Metal);
  v.fillLine(1, 2, 1, 3, 5, 3, 0x64748b, VoxelMat.Metal, 0.6);
  // Scattered loose hex screws & dust clump on floor beside grate
  for (const [sx, sz] of [[0, 15], [21, 3], [19, 17], [4, 17]]) {
    v.set(sx, 0, sz, 0xcbd5e1, VoxelMat.Metal);
  }
  v.applyTactileGrain(525, 0.05);
  return v.build({ anchor: [11, 0, 9] }).geometry;
}

function buildFuseBoxBustedGeo(): THREE.BufferGeometry {
  // 18x22x10 smashed industrial breaker cabinet: torn open bent door, exposed charred copper busbars,
  // empty ceramic fuse clips, dangling severed wires & glowing amber/blue short-circuit sparks!
  const v = new VoxelSculptor(18, 22, 10, 0.042);
  // Main steel wall enclosure (hollow open interior!)
  v.fillBox(1, 2, 0, 14, 19, 5, 0x334155, VoxelMat.Metal);
  v.carveBox(2, 3, 1, 13, 18, 5);
  // Top & bottom armored conduit pipes
  v.fillCylinderY(5, 19, 21, 2, 1.3, 0x64748b, VoxelMat.Metal);
  v.fillCylinderY(10, 19, 21, 2, 1.3, 0x64748b, VoxelMat.Metal);
  v.fillCylinderY(7, 0, 2, 2, 1.5, 0x475569, VoxelMat.Metal);
  // Charred dark interior backplate + exposed vertical copper busbars + ceramic breaker clips
  v.fillBox(2, 3, 1, 13, 18, 1, 0x111827, VoxelMat.Matte);
  v.fillBox(4, 5, 2, 5, 16, 2, 0xd97706, VoxelMat.Metal);
  v.fillBox(10, 5, 2, 11, 16, 2, 0xd97706, VoxelMat.Metal);
  for (const by of [6, 10, 14]) {
    v.fillBox(6, by, 2, 9, by + 1, 3, 0x475569, VoxelMat.Matte);
  }
  // Bent steel cabinet door hanging wide open to the right (+X, +Z)
  v.fillLine(14, 3, 5, 17, 3, 9, 0x475569, VoxelMat.Metal, 0.4);
  for (let y = 3; y <= 18; y++) {
    v.fillLine(14, y, 5, 17, y, 9, 0x475569, VoxelMat.Metal, 0);
  }
  // Dangling severed red/blue cables + sparking blue arc tips!
  v.fillLine(5, 8, 2, 3, 4, 7, 0xdc2626, VoxelMat.Fabric, 0);
  v.fillLine(10, 11, 2, 12, 6, 8, 0x2563eb, VoxelMat.Fabric, 0);
  v.set(3, 4, 7, 0x38bdf8, VoxelMat.Emissive);
  v.set(12, 6, 8, 0xfef08a, VoxelMat.Emissive);
  return v.build({ anchor: [8, 11, 0] }).geometry;
}

function buildExitPryMarksGeo(): THREE.BufferGeometry {
  // 28x8x22 splintered plank debris, snapped rusted nails, cracked wood chunks & floor pry marks
  const v = new VoxelSculptor(28, 7, 22, 0.044);
  // Shattered barricade timber planks crossed on the floor
  v.fillLine(2, 1, 5, 24, 1, 9, 0x854d0e, VoxelMat.Matte, 1.1);
  v.fillLine(6, 2, 16, 23, 1, 6, 0x713f12, VoxelMat.Matte, 1.0);
  v.fillLine(4, 0, 12, 15, 0, 19, 0x92400e, VoxelMat.Matte, 0.8);
  // Protruding bent iron nails sticking up from broken wood
  for (const [nx, ny, nz] of [[6, 3, 6], [19, 3, 8], [10, 4, 14], [14, 3, 11]]) {
    v.fillBox(nx, ny, nz, nx, ny + 2, nz, 0x94a3b8, VoxelMat.Metal);
  }
  // Wood splinters & dust scattered around
  for (const [sx, sz] of [[3, 17], [22, 15], [17, 3], [11, 20], [25, 12]]) {
    v.fillBox(sx, 0, sz, sx + 2, 0, sz + 1, 0xa16207, VoxelMat.Matte);
  }
  v.applyTactileGrain(527, 0.08);
  return v.build({ anchor: [14, 0, 11] }).geometry;
}

function buildLevel2HatchGeo(): THREE.BufferGeometry {
  // 34x10x34 massive bolted steel floor bulkhead hatch to Nível -2 (Laboratório Ômega):
  // octagonal armored coaming ring, diamond-plate twin doors, red spoked submarine wheel,
  // hazard striping & eerie emerald Projeto Ômega glow seeping through the sealed center seam!
  const v = new VoxelSculptor(34, 10, 34, 0.062);
  const cx = 16.5;
  const cz = 16.5;

  // Heavy outer bolted steel coaming rim
  v.fillBeveledBox(1, 0, 1, 32, 3, 32, 0x1e293b, VoxelMat.Metal, 'top');
  // Yellow/black industrial hazard stripe perimeter border
  for (let i = 2; i <= 31; i += 2) {
    const col = i % 4 === 2 ? 0xfacc15 : 0x0f172a;
    v.fillBox(i, 3, 2, i + 1, 3, 3, col, VoxelMat.Matte);
    v.fillBox(i, 3, 30, i + 1, 3, 31, col, VoxelMat.Matte);
    v.fillBox(2, 3, i, 3, 3, i + 1, col, VoxelMat.Matte);
    v.fillBox(30, 3, i, 31, 3, i + 1, col, VoxelMat.Matte);
  }
  // Heavy recessed armored bulkhead doors with raised structural ribs & corner bolts
  v.fillBeveledBox(4, 2, 4, 29, 4, 29, 0x334155, VoxelMat.Metal, 'top');
  for (let i = 7; i <= 26; i += 5) {
    v.fillBox(i, 4, 5, i, 4, 28, 0x475569, VoxelMat.Metal);
  }
  // Eerie glowing green seam from Laboratório Ômega Nível -2 below!
  v.fillBox(5, 4, 16, 28, 4, 17, 0x22c55e, VoxelMat.Emissive);
  // Heavy hinge blocks along north & south edges
  for (const hx of [8, 23]) {
    v.fillBox(hx, 4, 3, hx + 2, 5, 5, 0x64748b, VoxelMat.Metal);
    v.fillBox(hx, 4, 28, hx + 2, 5, 30, 0x64748b, VoxelMat.Metal);
  }
  // Raised submarine-style red spoked locking wheel on center!
  v.fillCylinderY(cx, 4, 7, cz, 1.5, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(cx, 7, 8, cz, 5.5, 0xdc2626, VoxelMat.Metal, 3.8);
  v.fillLine(11, 7, 16.5, 22, 7, 16.5, 0xb91c1c, VoxelMat.Metal, 0);
  v.fillLine(16.5, 7, 11, 16.5, 7, 22, 0xb91c1c, VoxelMat.Metal, 0);
  v.fillCylinderY(cx, 8, 9, cz, 1.3, 0xf59e0b, VoxelMat.Metal);

  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

function buildFilingToppledGeo(): THREE.BufferGeometry {
  // 30x16x22 overturned 4-drawer steel archive cabinet lying on its side with busted drawers
  // & scattered Projeto Ômega manila dossiers spilled across the floor!
  const v = new VoxelSculptor(30, 15, 22, 0.056);

  // Overturned dark slate filing cabinet shell lying horizontally (x = 2..22, y = 0..12, z = 4..15)
  v.fillBeveledBox(2, 0, 4, 22, 12, 15, 0x334155, VoxelMat.Metal, 'all');
  // 4 Drawer faces along +Z side, two of them slammed open spilling files!
  for (let d = 0; d < 4; d++) {
    const dx0 = 3 + d * 5;
    const isPulled = d === 1 || d === 3;
    const pullZ = isPulled ? 19 : 15;
    v.fillBox(dx0, 1, 14, dx0 + 3, 11, pullZ, 0x475569, VoxelMat.Metal);
    if (isPulled) {
      v.carveBox(dx0 + 1, 2, 14, dx0 + 2, 11, pullZ - 1);
      // Manila dossiers crammed & spilling out of open drawer!
      v.fillBox(dx0 + 1, 2, 15, dx0 + 2, 10, pullZ - 1, 0xe7d6b4, VoxelMat.Matte);
    }
    v.fillBox(dx0 + 1, 5, pullZ, dx0 + 2, 7, pullZ, 0xcbd5e1, VoxelMat.Metal); // chrome pull
  }
  // Scattered white/manila classified papers & red-stamped folder on floor in front
  const papers: [number, number, number][] = [
    [6, 19, 0xf1f5f9],
    [13, 20, 0xe7d6b4],
    [24, 14, 0xf8fafc],
    [25, 9, 0xdc2626], // confidential red folder!
    [19, 20, 0xf1f5f9],
    [26, 17, 0xe7d6b4],
  ];
  for (const [px, pz, col] of papers) {
    v.fillBox(px, 0, pz, px + 3, 0, pz + 2, col, VoxelMat.Matte);
  }
  v.applyTactileGrain(529, 0.05);
  return v.build({ anchor: [15, 0, 11] }).geometry;
}

function buildIvStandGeo(): THREE.BufferGeometry {
  // 16x40x16 hospital rolling stainless-steel IV stand: 5-star caster base, telescoping pole,
  // twin top hooks, translucent glowing green Composto 09 IV drip bag & curled tubing!
  const v = new VoxelSculptor(16, 40, 16, 0.048);
  const cx = 7.5;
  const cz = 7.5;

  // 5-leg caster rolling base
  const legEnds: [number, number][] = [[2, 7], [13, 7], [7, 2], [4, 13], [11, 13]];
  for (const [lx, lz] of legEnds) {
    v.fillLine(cx, 2, cz, lx, 1, lz, 0x94a3b8, VoxelMat.Metal, 0.4);
    v.fillBox(lx, 0, lz, lx, 1, lz, 0x0f172a, VoxelMat.Fabric); // caster wheel
  }
  // Telescoping stainless steel pole + height lock collar
  v.fillCylinderY(cx, 2, 22, cz, 1.1, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(cx, 22, 24, cz, 1.6, 0x1e293b, VoxelMat.Fabric); // twist lock knob
  v.fillCylinderY(cx, 24, 38, cz, 0.7, 0xe2e8f0, VoxelMat.Metal);
  // Twin curved top hanger hooks
  v.fillLine(cx, 38, cz, 3, 39, cz, 0xcbd5e1, VoxelMat.Metal, 0);
  v.fillLine(cx, 38, cz, 12, 39, cz, 0xcbd5e1, VoxelMat.Metal, 0);
  v.set(3, 38, cz, 0xcbd5e1, VoxelMat.Metal);
  v.set(12, 38, cz, 0xcbd5e1, VoxelMat.Metal);

  // Translucent IV infusion bag filled with eerie glowing Composto 09 green serum!
  v.fillBox(2, 31, 6, 5, 37, 9, 0xbae6fd, VoxelMat.Glass);
  v.fillBox(3, 32, 7, 4, 35, 8, 0x4ade80, VoxelMat.Emissive); // glowing Composto 09 serum!
  // Drip chamber & hanging flexible translucent IV tube looping down pole
  v.fillBox(3, 29, 7, 4, 30, 8, 0xe0f2fe, VoxelMat.Glass);
  v.fillLine(3, 29, 7, 5, 22, 10, 0x99f6e4, VoxelMat.Glass, 0);
  v.fillLine(5, 22, 10, 7, 15, 9, 0x99f6e4, VoxelMat.Glass, 0);
  v.fillLine(7, 15, 9, 4, 10, 11, 0x99f6e4, VoxelMat.Glass, 0);

  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

function buildChemicalBarrelOozeGeo(): THREE.BufferGeometry {
  // 28x16x28 corroded ruptured biohazard barrel lying tilted in a glowing emerald Composto 09 puddle!
  const v = new VoxelSculptor(28, 16, 28, 0.052);

  // Glowing emerald toxic Composto 09 spill puddle spreading across floor (y = 0)
  v.fillCylinderY(16, 0, 0, 16, 8.5, 0x15803d, VoxelMat.Emissive);
  v.fillCylinderY(18, 0, 0, 17, 5.5, 0x4ade80, VoxelMat.Emissive);
  v.fillCylinderY(10, 0, 0, 20, 4.2, 0x22c55e, VoxelMat.Emissive);
  // Bubbling translucent green ooze blisters on puddle surface
  for (const [bx, bz] of [[19, 15], [15, 21], [22, 18]]) {
    v.fillBox(bx, 1, bz, bx + 1, 1, bz + 1, 0x86efac, VoxelMat.Emissive);
  }

  // Corroded horizontal steel barrel lying on its side (x = 4..18, y = 1..12, z = 5..16)
  v.fillCylinderX(4, 18, 6.5, 10.5, 5.4, 0x14532d, VoxelMat.Metal);
  for (const hx of [5, 10, 15, 18]) {
    v.fillCylinderX(hx, hx, 6.5, 10.5, 5.9, 0x713f12, VoxelMat.Metal); // rusted rolling ribs
  }
  v.fillCylinderX(10, 13, 6.5, 10.5, 5.6, 0xfacc15, VoxelMat.Matte, 4.8);
  // Jagged corroded rupture hole oozing glowing green Compound 09 stream down into puddle!
  v.carveBox(14, 4, 13, 18, 8, 16);
  v.fillBox(15, 5, 14, 17, 7, 15, 0x4ade80, VoxelMat.Emissive);
  v.fillLine(16, 5, 15, 17, 1, 16, 0x22c55e, VoxelMat.Emissive, 1.0);

  v.applyTactileGrain(531, 0.06);
  return v.build({ anchor: [14, 0, 14] }).geometry;
}

function buildSpecimenCylinderGeo(): THREE.BufferGeometry {
  // 18x42x18 tall Projeto Ômega biological containment stasis tank:
  // octagonal heavy steel base & crown with gauges/valves, 4 armored strut bars,
  // tall translucent glass tank, glowing green liquid core, rising bubbles & dark suspended specimen!
  const v = new VoxelSculptor(18, 42, 18, 0.056);
  const cx = 8.5;
  const cz = 8.5;

  // Heavy octagonal steel base console (y = 0..7) with yellow hazard stripe & pressure dial
  v.fillCylinderY(cx, 0, 2, cz, 7.6, 0x1e293b, VoxelMat.Metal);
  v.fillCylinderY(cx, 3, 7, cz, 6.8, 0x334155, VoxelMat.Metal);
  v.fillCylinderY(cx, 3, 4, cz, 7.0, 0xfacc15, VoxelMat.Matte, 6.2);
  v.fillBox(6, 5, 15, 11, 7, 16, 0x0f172a, VoxelMat.Matte); // base console gauge
  v.fillBox(7, 6, 16, 10, 6, 16, 0x22c55e, VoxelMat.Emissive);

  // Heavy top cap & ceiling breather pipes (y = 35..41)
  v.fillCylinderY(cx, 35, 39, cz, 6.8, 0x334155, VoxelMat.Metal);
  v.fillCylinderY(cx, 39, 41, cz, 5.4, 0x1e293b, VoxelMat.Metal);
  v.fillCylinderY(cx, 39, 41, cz, 2.0, 0xd97706, VoxelMat.Metal); // top brass valve

  // 4 external armored steel vertical cage struts around glass cylinder
  for (const [sx, sz] of [[3, 3], [14, 3], [3, 14], [14, 14]]) {
    v.fillBox(sx, 7, sz, sx, 35, sz, 0x475569, VoxelMat.Metal);
  }
  // Translucent outer glass cylinder wall (y = 8..34)
  v.fillCylinderY(cx, 8, 34, cz, 5.8, 0x99f6e4, VoxelMat.Glass, 4.9);

  // Glowing Composto 09 internal green suspension core + bright bubbles + dark organic specimen silhouette!
  v.fillCylinderY(cx, 8, 9, cz, 4.6, 0x4ade80, VoxelMat.Emissive); // bottom illuminator glow
  v.fillCylinderY(cx, 33, 34, cz, 4.6, 0x22c55e, VoxelMat.Emissive); // top illuminator glow
  // Dark organic coiled biological specimen floating in center (y = 14..28)
  v.fillCylinderY(cx, 15, 25, cz, 2.3, 0x111827, VoxelMat.Fabric);
  v.fillBeveledBox(6, 24, 6, 11, 29, 11, 0x1f2937, VoxelMat.Fabric, 'all');
  v.set(7, 26, 11, 0xef4444, VoxelMat.Emissive); // eerie glowing eyes inside specimen tank!
  v.set(10, 26, 11, 0xef4444, VoxelMat.Emissive);
  // Floating glowing green serum bubbles around specimen
  for (const [bx, by, bz] of [
    [5, 13, 10],
    [11, 18, 6],
    [6, 22, 12],
    [12, 27, 10],
    [7, 31, 6],
  ]) {
    v.set(bx, by, bz, 0x86efac, VoxelMat.Emissive);
  }

  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

function buildMarcosBadgeBaseGeo(): THREE.BufferGeometry {
  // Fallen laminated ID holder frame + metal alligator clip + curled braided blue lanyard cord!
  const v = new VoxelSculptor(22, 4, 24, 0.016);
  // Curled blue lanyard fabric strap looping around on floor/desk
  v.fillLine(11, 0, 5, 6, 0, 2, 0x1d4ed8, VoxelMat.Fabric, 0.6);
  v.fillLine(6, 0, 2, 2, 0, 7, 0x1e40af, VoxelMat.Fabric, 0.6);
  v.fillLine(2, 0, 7, 5, 0, 14, 0x1d4ed8, VoxelMat.Fabric, 0.6);
  v.fillLine(11, 0, 5, 16, 0, 3, 0x1d4ed8, VoxelMat.Fabric, 0.6);
  v.fillLine(16, 0, 3, 19, 0, 9, 0x1e40af, VoxelMat.Fabric, 0.6);
  // Steel alligator clip + split ring
  v.fillBox(10, 1, 5, 12, 2, 8, 0xcbd5e1, VoxelMat.Metal);
  // Thick plastic laminated ID badge casing (flat on surface)
  v.fillBeveledBox(6, 0, 8, 16, 1, 22, 0x334155, VoxelMat.Matte, 'top');
  // Small broken glass shard glittering beside badge
  v.fillBox(18, 0, 17, 20, 1, 19, 0xbae6fd, VoxelMat.Glass);
  return v.build({ anchor: [11, 0, 12] }).geometry;
}

function buildBrokenGlassCounterGeo(): THREE.BufferGeometry {
  // Shattered tempered reception glass security divider frame with jagged glass teeth & floor shards!
  const v = new VoxelSculptor(28, 22, 12, 0.045);
  // Heavy aluminum base channel & side frame posts
  v.fillBox(1, 0, 4, 26, 2, 7, 0x334155, VoxelMat.Metal);
  v.fillBox(1, 2, 4, 3, 21, 7, 0x475569, VoxelMat.Metal);
  v.fillBox(24, 2, 4, 26, 21, 7, 0x475569, VoxelMat.Metal);
  v.fillBox(1, 20, 4, 26, 21, 7, 0x334155, VoxelMat.Metal);
  // Jagged broken glass shards still clinging to perimeter channels!
  v.fillBox(3, 2, 5, 9, 10, 6, 0xbae6fd, VoxelMat.Glass);
  v.carveBox(6, 7, 5, 9, 10, 6);
  v.fillBox(19, 2, 5, 23, 13, 6, 0x93c5fd, VoxelMat.Glass);
  v.carveBox(19, 8, 5, 21, 13, 6);
  v.fillBox(3, 15, 5, 13, 19, 6, 0xbae6fd, VoxelMat.Glass);
  v.carveBox(8, 15, 5, 13, 17, 6);
  // Sparkling shattered glass fragments scattered across ground/counter around frame
  for (const [sx, sz] of [[5, 9], [11, 10], [16, 9], [21, 11], [8, 2], [17, 1], [13, 8]]) {
    v.fillBox(sx, 0, sz, sx + 1, 0, sz + 1, 0xe0f2fe, VoxelMat.Glass);
  }
  return v.build({ anchor: [14, 0, 5.5] }).geometry;
}

function buildCafeteriaTraysGeo(): THREE.BufferGeometry {
  // Stack of stamped stainless steel cafeteria trays, overturned tray, dented tin cup & bent cutlery!
  const v = new VoxelSculptor(22, 12, 20, 0.036);
  // Stack of 3 compartmentalized steel trays on left
  for (let t = 0; t < 3; t++) {
    const ty = t * 2;
    v.fillBox(2, ty, 3, 13, ty + 1, 12, t % 2 === 0 ? 0x94a3b8 : 0xcbd5e1, VoxelMat.Metal);
    v.carveBox(3, ty + 1, 4, 7, ty + 1, 7);
    v.carveBox(9, ty + 1, 4, 12, ty + 1, 7);
    v.carveBox(3, ty + 1, 9, 12, ty + 1, 11);
  }
  // Fallen tilted tray on right + spilled ration bowl & mug
  v.fillLine(13, 1, 12, 20, 4, 16, 0x94a3b8, VoxelMat.Metal, 1.0);
  v.fillCylinderY(16, 0, 3, 7, 2.3, 0xd97706, VoxelMat.Metal);
  v.fillCylinderY(16, 3, 3, 7, 1.5, 0x451a03, VoxelMat.Matte);
  v.fillCylinderY(9, 6, 9, 6, 1.4, 0xe2e8f0, VoxelMat.Matte); // tin cup atop stack
  return v.build({ anchor: [11, 0, 10] }).geometry;
}

function buildCellBentBarsGeo(): THREE.BufferGeometry {
  // 28x38x14 Cell 09 P. Drizzy breakout grating: heavy steel cell frame with center iron bars
  // violently pried & bent OUTWARD by brute strength + scratched tally marks on bulkhead!
  const v = new VoxelSculptor(28, 38, 14, 0.062);
  // Heavy concrete/steel bulkhead border frame
  v.fillBox(0, 0, 1, 27, 37, 4, 0x334155, VoxelMat.Metal);
  v.carveBox(3, 2, 0, 24, 34, 5);
  // Horizontal reinforcement cross-rails
  v.fillBox(2, 12, 2, 25, 13, 3, 0x475569, VoxelMat.Metal);
  v.fillBox(2, 25, 2, 25, 26, 3, 0x475569, VoxelMat.Metal);
  // Straight outer iron cell bars
  for (const bx of [5, 9, 18, 22]) {
    v.fillBox(bx, 2, 2, bx + 1, 34, 3, 0x64748b, VoxelMat.Metal);
  }
  // Violently pried & outward-bent center bars (bent out to +Z = 11!)
  v.fillLine(12, 2, 2.5, 10, 18, 10, 0x94a3b8, VoxelMat.Metal, 0.8);
  v.fillLine(10, 18, 10, 12, 34, 2.5, 0x94a3b8, VoxelMat.Metal, 0.8);
  v.fillLine(15, 2, 2.5, 17, 19, 11, 0x94a3b8, VoxelMat.Metal, 0.8);
  v.fillLine(17, 19, 11, 15, 34, 2.5, 0x94a3b8, VoxelMat.Metal, 0.8);
  // Scratched prisoner tally marks & claw gouges on left steel frame pillar
  for (let ty = 15; ty <= 21; ty += 2) {
    v.fillBox(1, ty, 4, 2, ty, 4, 0xe2e8f0, VoxelMat.Metal);
  }
  v.fillLine(1, 15, 4, 2, 21, 4, 0xef4444, VoxelMat.Matte, 0);
  return v.build({ anchor: [14, 0, 3] }).geometry;
}

function buildSwivelChairGeo(): THREE.BufferGeometry {
  // 18x26x18 ergonomic 5-star rolling office swivel chair with casters, gas lift piston,
  // contoured cushioned seat, side armrests & curved ribbed backrest!
  const v = new VoxelSculptor(18, 26, 18, 0.048);
  const cx = 8.5;
  const cz = 8.5;

  // 5-star caster base legs + rubber wheels
  const feet: [number, number][] = [[2, 8], [15, 8], [8, 2], [4, 14], [13, 14]];
  for (const [fx, fz] of feet) {
    v.fillLine(cx, 3, cz, fx, 1, fz, 0x1e293b, VoxelMat.Metal, 0.5);
    v.fillBox(fx, 0, fz, fx, 1, fz, 0x0f172a, VoxelMat.Fabric);
  }
  // Chrome gas lift cylinder + tilt mechanism box
  v.fillCylinderY(cx, 3, 10, cz, 1.2, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(6, 9, 6, 11, 10, 11, 0x1e293b, VoxelMat.Metal);
  // Contoured padded dark leather seat cushion
  v.fillBeveledBox(3, 11, 3, 14, 13, 14, 0x1f2937, VoxelMat.Fabric, 'all');
  // Curved side armrests on steel brackets
  for (const ax of [2, 15]) {
    v.fillBox(ax, 12, 7, ax, 16, 9, 0x334155, VoxelMat.Metal);
    v.fillBeveledBox(ax, 16, 5, ax, 17, 13, 0x111827, VoxelMat.Fabric, 'top');
  }
  // Spine support bar & ergonomic curved ribbed backrest (z = 2..4, y = 14..25)
  v.fillBox(7, 11, 2, 10, 16, 3, 0x334155, VoxelMat.Metal);
  v.fillBeveledBox(3, 15, 2, 14, 25, 4, 0x1f2937, VoxelMat.Fabric, 'all');
  v.fillBox(5, 17, 4, 12, 23, 4, 0x334155, VoxelMat.Fabric); // lumbar cushion relief
  return v.build({ anchor: [cx, 0, cz] }).geometry;
}

// ============================================================================
// MAIN SCULPTED FURNITURE FACTORY (100% COVERAGE OF ALL 37 FurnitureKinds)
// ============================================================================

export function createSculptedFurnitureVisual(
  prop: FurniturePropDefinition,
  pack: MaterialPack,
  symbolMap?: { symbol: string; digit: string }[]
): SculptedFurnitureVisual {
  const group = new THREE.Group();
  group.position.set(prop.x, prop.y, prop.z);
  group.rotation.y = prop.facingYaw;

  let animatedPart: THREE.Object3D | null = null;
  let contentsAnchor: THREE.Group | null = null;
  let statusMat: THREE.MeshStandardMaterial | null = null;

  switch (prop.kind) {
    case 'bookshelf': {
      group.add(createSculptedMesh('furn_bookshelf', buildBookshelfGeo, { castShadow: true }));
      break;
    }
    case 'desk_monitor': {
      group.add(createSculptedMesh('furn_desk_monitor', buildSecurityDeskGeo, { castShadow: true }));
      // Glowing live CRT screen planes seated cleanly inside the sculpted CRT monitor bezels!
      for (const mx of [-0.42, 0.42]) {
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), pack.materials.monitor_crt);
        screen.position.set(mx, 1.29, 0.14);
        group.add(screen);
      }
      // Sculpted ergonomic 5-star swivel chair pulled slightly back in front of console
      const chair = createSculptedMesh('furn_swivel_chair', buildSwivelChairGeo, { castShadow: true });
      chair.position.set(-0.22, 0, 0.92);
      chair.rotation.y = 0.28;
      group.add(chair);
      break;
    }
    case 'crate': {
      group.add(createSculptedMesh('furn_crate', buildCrateGeo, { castShadow: true }));
      break;
    }
    case 'barrel': {
      group.add(createSculptedMesh('furn_barrel', buildBarrelGeo, { castShadow: true }));
      break;
    }
    case 'pipe_cluster': {
      group.add(createSculptedMesh('furn_pipe_cluster', buildPipeClusterGeo, { castShadow: true }));
      break;
    }
    case 'bed_medical': {
      group.add(createSculptedMesh('furn_bed_medical', buildMedicalBedPropGeo, { castShadow: true }));
      break;
    }
    case 'dining_table': {
      group.add(createSculptedMesh('furn_dining_table', buildDiningTableGeo, { castShadow: true }));
      break;
    }
    case 'side_table': {
      const isBase = prop.floor === -1;
      group.add(
        createSculptedMesh(
          isBase ? 'furn_side_table_base' : 'furn_side_table_wood',
          () => buildSideTableGeo(isBase),
          { castShadow: true }
        )
      );
      break;
    }
    case 'drawer_cabinet': {
      // Sculpted hollow carcass + sliding sculpted drawer tray preserving exact contentsAnchor!
      group.add(createSculptedMesh('furn_drawer_carcass', buildDrawerCarcassGeo, { castShadow: true }));

      const drawer = new THREE.Group();
      drawer.position.set(0, 0.79, 0.03);
      drawer.add(createSculptedMesh('furn_drawer_tray', buildDrawerTrayGeo, { castShadow: true }));

      contentsAnchor = new THREE.Group();
      contentsAnchor.position.set(0, -0.1, 0.02);
      drawer.add(contentsAnchor);

      group.add(drawer);
      animatedPart = drawer;
      break;
    }
    case 'wall_frame': {
      const frame = createSculptedMesh('furn_wall_frame_geo', () =>
        buildSculptedWallFrameGeo(1.18, 1.46, 0x4a2f1a, 0xd97706, true)
      );
      // Organic subtle crooked tilt so hallways feel genuinely abandoned!
      const tilt = ((prop.variant ?? 0) % 2 === 0 ? 1 : -1) * 0.035;
      frame.rotation.z = tilt;
      group.add(frame);

      const tex = createWallPosterTexture(prop.variant ?? 0);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(0.96, 1.22),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: tex,
          emissive: 0x1e293b,
          emissiveIntensity: 0.34,
          roughness: 0.76,
        })
      );
      art.position.z = 0.055;
      art.rotation.z = tilt;
      group.add(art);
      break;
    }
    case 'potted_plant': {
      group.add(createSculptedMesh('furn_potted_plant', buildPottedPlantGeo, { castShadow: true }));
      break;
    }
    case 'cable_conduit': {
      group.add(createSculptedMesh('furn_cable_conduit', buildCableConduitGeo));
      break;
    }
    case 'standing_lamp': {
      group.add(createSculptedMesh('furn_standing_lamp', buildStandingLampGeo, { castShadow: true }));
      break;
    }
    case 'translation_board': {
      const pairs = symbolMap ?? [
        { symbol: '▲', digit: '3' },
        { symbol: '◆', digit: '7' },
        { symbol: '●', digit: '1' },
        { symbol: '■', digit: '9' },
        { symbol: '★', digit: '4' },
      ];
      const frame = createSculptedMesh('furn_translation_frame', () =>
        buildSculptedWallFrameGeo(1.48, 1.14, 0x2e1065, 0xa855f7, true)
      );
      frame.position.y = 1.65;
      group.add(frame);

      const tex = createTranslationBoardTexture(pairs);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.26, 0.92),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: tex,
          emissive: 0x3b0764,
          emissiveIntensity: 0.62,
          roughness: 0.65,
        })
      );
      board.position.set(0, 1.65, 0.055);
      group.add(board);
      break;
    }
    case 'generator_lever': {
      group.add(createSculptedMesh('furn_generator_chassis', buildGeneratorChassisGeo, { castShadow: true }));

      statusMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 1.85,
        roughness: 0.2,
      });
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.12), statusMat);
      bulb.position.set(0.32, 1.32, 0.56);
      group.add(bulb);

      const leverPivot = new THREE.Group();
      leverPivot.position.set(0.42, 0.96, 0.54);
      leverPivot.rotation.x = -0.6;
      leverPivot.add(createSculptedMesh('furn_generator_lever_arm', buildGeneratorLeverHandleGeo));
      group.add(leverPivot);
      animatedPart = leverPivot;
      break;
    }
    case 'secret_terminal': {
      group.add(createSculptedMesh('furn_secret_terminal', buildSecretTerminalGeo, { castShadow: true }));
      statusMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 1.65,
        roughness: 0.2,
      });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.42), statusMat);
      screen.position.set(0, 1.24, 0.19);
      group.add(screen);
      break;
    }
    case 'interdiction_board': {
      const sign = createSculptedSignPlate(
        'furn_interdiction_frame',
        1.56,
        0.92,
        'INTERDITADO · SETOR 09',
        'QUIMICO NIVEL 4 — ACESSO PROIBIDO',
        '#ef4444',
        '#181214',
        0x7f1d1d,
        0xfacc15
      );
      sign.rotation.z = -0.075; // hanging crooked by one loosened corner bolt!
      group.add(sign);
      break;
    }
    case 'radio_desk': {
      group.add(createSculptedMesh('furn_radio_desk', buildRadioDeskGeo, { castShadow: true }));
      // Vigia Marcos's laminated badge resting right on the reception counter edge!
      const badge = createSculptedMesh('furn_marcos_badge_geo', buildMarcosBadgeBaseGeo);
      badge.position.set(-0.56, 0.955, 0.18);
      badge.rotation.y = 0.42;
      group.add(badge);
      const badgeArt = new THREE.Mesh(
        new THREE.PlaneGeometry(0.14, 0.21),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: createMarcosBadgeTexture(),
          roughness: 0.4,
        })
      );
      badgeArt.rotation.x = -Math.PI / 2;
      badgeArt.position.set(-0.56, 0.985, 0.21);
      badgeArt.rotation.z = -0.42;
      group.add(badgeArt);
      break;
    }
    case 'coffee_spill': {
      group.add(createSculptedMesh('furn_coffee_spill', buildCoffeeSpillGeo));
      break;
    }
    case 'bench_broken': {
      group.add(createSculptedMesh('furn_bench_broken', buildBenchBrokenGeo, { castShadow: true }));
      break;
    }
    case 'wing_sign': {
      group.add(createSculptedMesh('furn_wing_sign_post', buildWingSignPostGeo, { castShadow: true }));
      const signPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.16, 0.42),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: createFacilitySignTexture('<- REFEITORIO · OFICINA ->', 'SETOR 09 · PATIO CENTRAL', '#f59e0b', '#0f172a'),
          emissive: 0x1e293b,
          emissiveIntensity: 0.38,
          roughness: 0.6,
        })
      );
      signPlate.position.set(0, 1.56, 0.08);
      group.add(signPlate);
      break;
    }
    case 'wall_cctv': {
      group.add(createSculptedMesh('furn_wall_cctv', buildWallCctvGeo));
      break;
    }
    case 'vent_grate_loose': {
      group.add(createSculptedMesh('furn_vent_grate_loose', buildVentGrateLooseGeo));
      break;
    }
    case 'workbench_schematic': {
      const frame = createSculptedMesh('furn_wb_schematic_frame', () =>
        buildSculptedWallFrameGeo(1.38, 1.05, 0x1e3a8a, 0x60a5fa, true)
      );
      group.add(frame);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(1.16, 0.84),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: createWallPosterTexture(5),
          emissive: 0x1e3a8a,
          emissiveIntensity: 0.45,
          roughness: 0.65,
        })
      );
      art.position.z = 0.055;
      group.add(art);
      break;
    }
    case 'fuse_box_busted': {
      group.add(createSculptedMesh('furn_fuse_box_busted', buildFuseBoxBustedGeo));
      break;
    }
    case 'exit_pry_marks': {
      group.add(createSculptedMesh('furn_exit_pry_marks', buildExitPryMarksGeo));
      break;
    }
    case 'level2_hatch': {
      group.add(createSculptedMesh('furn_level2_hatch', buildLevel2HatchGeo, { receiveShadow: true }));
      const hatchSign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.22, 0.42),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: createFacilitySignTexture('NIVEL -2 · LAB. OMEGA', 'SELADO · ACESSO RESTRITO', '#22c55e', '#091512'),
          emissive: 0x14532d,
          emissiveIntensity: 0.65,
          roughness: 0.5,
        })
      );
      hatchSign.rotation.x = -Math.PI / 2;
      hatchSign.position.set(0, 0.27, 0.62);
      group.add(hatchSign);
      break;
    }
    case 'filing_toppled': {
      group.add(createSculptedMesh('furn_filing_toppled', buildFilingToppledGeo, { castShadow: true }));
      break;
    }
    case 'iv_stand': {
      group.add(createSculptedMesh('furn_iv_stand', buildIvStandGeo, { castShadow: true }));
      break;
    }
    case 'chemical_barrel_ooze': {
      group.add(createSculptedMesh('furn_chemical_barrel_ooze', buildChemicalBarrelOozeGeo, { castShadow: true }));
      break;
    }
    case 'cell_sign_09': {
      const sign = createSculptedSignPlate(
        'furn_cell_sign_09_frame',
        1.48,
        0.74,
        'CELA 09 — P. DRIZZY',
        'CONTENCAO MAXIMA · SUJEITO 09',
        '#ef4444',
        '#140b0d',
        0x334155,
        0xef4444
      );
      group.add(sign);
      break;
    }
    case 'specimen_cylinder': {
      group.add(createSculptedMesh('furn_specimen_cylinder', buildSpecimenCylinderGeo, { castShadow: true }));
      break;
    }
    case 'marcos_badge': {
      group.add(createSculptedMesh('furn_marcos_badge_geo', buildMarcosBadgeBaseGeo));
      const badgeArt = new THREE.Mesh(
        new THREE.PlaneGeometry(0.15, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: createMarcosBadgeTexture(),
          roughness: 0.4,
        })
      );
      badgeArt.rotation.x = -Math.PI / 2;
      badgeArt.position.set(0, 0.036, 0.03);
      group.add(badgeArt);
      break;
    }
    case 'broken_glass_counter': {
      group.add(createSculptedMesh('furn_broken_glass_counter', buildBrokenGlassCounterGeo));
      break;
    }
    case 'cafeteria_trays': {
      group.add(createSculptedMesh('furn_cafeteria_trays', buildCafeteriaTraysGeo));
      break;
    }
    case 'cell_bent_bars': {
      group.add(createSculptedMesh('furn_cell_bent_bars', buildCellBentBarsGeo, { castShadow: true }));
      break;
    }
    case 'swivel_chair': {
      group.add(createSculptedMesh('furn_swivel_chair', buildSwivelChairGeo, { castShadow: true }));
      break;
    }
  }

  return { def: prop, group, animatedPart, contentsAnchor, statusMat };
}
