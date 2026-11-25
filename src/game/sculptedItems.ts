import * as THREE from 'three';
import {
  CassetteTapeDefinition,
  NoisePropDefinition,
  WorldPickupType,
} from './types';
import {
  VoxelMat,
  VoxelSculptor,
  createSculptedMesh,
} from './voxelSculptor';

/**
 * Helper that builds a sculpted item mesh.
 * `standalone = true` allocates fresh materials (for camera-mounted 1st-person viewmodel so world rebuilds never dispose it).
 * `standalone = false` shares cached world BufferGeometry + world material pack for 60 FPS mobile performance.
 */
function buildItemSculpt(
  key: string,
  standalone: boolean,
  sculptFn: () => THREE.BufferGeometry
): THREE.Mesh {
  return createSculptedMesh(`item_${key}`, sculptFn, {
    castShadow: !standalone,
    receiveShadow: true,
    standalone,
  });
}

function buildFlashlightGeo(): THREE.BufferGeometry {
  // High-density 18x18x32 tactical flashlight: knurled grip, stepped chamfered bezel,
  // deep parabolic reflector dish, rubberized thumb switch, pocket clip, tail lanyard ring
  const v = new VoxelSculptor(18, 18, 32, 0.0155);
  const cx = 8.5;
  const cy = 8.5;

  // Tail cap with stepped grip ribs + lanyard eyelet
  v.fillCylinderZ(cx, cy, 1, 5, 3.6, 0x1e293b, VoxelMat.Metal);
  v.fillCylinderZ(cx, cy, 2, 2, 4.1, 0x334155, VoxelMat.Metal);
  v.fillCylinderZ(cx, cy, 4, 4, 4.1, 0x334155, VoxelMat.Metal);
  // Lanyard ring on rear
  v.fillBox(7, 7, 0, 10, 10, 0, 0x94a3b8, VoxelMat.Metal);
  v.carveBox(8, 8, 0, 9, 9, 0);

  // Main cylindrical aluminum barrel + diamond knurling ridges
  v.fillCylinderZ(cx, cy, 5, 20, 3.3, 0x111827, VoxelMat.Fabric);
  for (let z = 6; z <= 19; z += 2) {
    v.fillCylinderZ(cx, cy, z, z, 3.6, 0x1f2937, VoxelMat.Metal, 2.7);
    // Cut vertical knurling grooves around barrel
    for (const [gx, gy] of [[5, 8], [12, 8], [8, 5], [8, 12], [6, 6], [11, 6], [6, 11], [11, 11]]) {
      v.set(gx, gy, z, 0x0f172a, VoxelMat.Fabric);
    }
  }

  // Steel tactical pocket clip mounted along right side (+X)
  v.fillBox(12, 8, 7, 13, 9, 17, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(11, 8, 7, 12, 9, 8, 0x64748b, VoxelMat.Metal);
  v.set(13, 8, 18, 0xcbd5e1, VoxelMat.Metal);

  // Sleek recessed rubberized thumb switch housing + compact amber power button on top (+Y)
  v.fillBeveledBox(7, 11, 15, 10, 13, 20, 0x334155, VoxelMat.Metal, 'top');
  v.fillBox(8, 13, 17, 9, 14, 19, 0x0f172a, VoxelMat.Fabric);
  v.fillBox(8, 14, 18, 9, 14, 18, 0xf59e0b, VoxelMat.Emissive);
  // Compact mode indicator micro-LEDs (normal + UV purple)
  v.set(7, 13, 16, 0x22c55e, VoxelMat.Emissive);
  v.set(10, 13, 16, 0xa855f7, VoxelMat.Emissive);

  // Stepped heat-sink cooling fins neck
  for (let z = 20; z <= 24; z++) {
    const r = z % 2 === 0 ? 4.9 : 4.1;
    v.fillCylinderZ(cx, cy, z, z, r, 0x334155, VoxelMat.Metal);
  }

  // Flared crenellated strike bezel head (z = 25..31)
  v.fillCylinderZ(cx, cy, 25, 30, 5.8, 0x1e293b, VoxelMat.Metal);
  // Tactical crenellated crown teeth at front rim (z = 31)
  v.fillCylinderZ(cx, cy, 31, 31, 5.8, 0x64748b, VoxelMat.Metal, 4.4);
  v.carveBox(7, 13, 31, 10, 16, 31);
  v.carveBox(7, 1, 31, 10, 4, 31);
  v.carveBox(1, 7, 31, 4, 10, 31);
  v.carveBox(13, 7, 31, 16, 10, 31);

  // Hollow internal chrome parabolic reflector dish
  v.fillCylinderZ(cx, cy, 27, 30, 4.5, 0, VoxelMat.Empty);
  v.fillCylinderZ(cx, cy, 26, 26, 3.6, 0xe2e8f0, VoxelMat.Metal);
  v.fillCylinderZ(cx, cy, 27, 28, 4.3, 0xcbd5e1, VoxelMat.Metal, 3.2);
  v.fillCylinderZ(cx, cy, 29, 29, 4.6, 0xe2e8f0, VoxelMat.Metal, 3.8);

  // Protective glass front bezel ring (leaving center open for dynamic UV-switchable flashlight_lens mesh)
  v.fillCylinderZ(cx, cy, 30, 30, 4.5, 0xbae6fd, VoxelMat.Glass, 2.8);

  v.applyTactileGrain(101, 0.04);
  return v.build({ anchor: [cx, cy, 15] }).geometry;
}

function buildStunGunGeo(): THREE.BufferGeometry {
  // High-density 18x22x30 industrial stun gun: ergonomic rubberized grip, chassis vents,
  // wound copper induction coils, side capacitor cylinder, cyan charge gauge, twin electrodes
  const v = new VoxelSculptor(18, 22, 30, 0.0155);

  // Ergonomic angled rubberized handle with finger grooves
  for (let y = 1; y <= 9; y++) {
    const zOff = Math.round((9 - y) * 0.35);
    v.fillBeveledBox(6, y, 4 + zOff, 11, y, 10 + zOff, 0x111827, VoxelMat.Fabric, 'vertical');
    if (y % 2 === 0) {
      v.fillBox(6, y, 5 + zOff, 11, y, 5 + zOff, 0x1f2937, VoxelMat.Fabric);
    }
  }
  // Reinforced metal buttplate + trigger guard + yellow trigger
  v.fillBox(5, 0, 6, 12, 1, 13, 0x475569, VoxelMat.Metal);
  v.fillBox(8, 5, 11, 9, 5, 16, 0x334155, VoxelMat.Metal);
  v.fillBox(8, 5, 16, 9, 9, 16, 0x334155, VoxelMat.Metal);
  v.fillBox(8, 7, 12, 9, 9, 13, 0xfacc15, VoxelMat.Metal);

  // Main upper industrial chassis (chamfered steel + dark polymer shroud)
  v.fillBeveledBox(4, 10, 3, 13, 17, 23, 0x1e293b, VoxelMat.Matte, 'all');
  // Recessed side cooling vents along chassis
  v.carveLouvers(4, 12, 7, 4, 15, 14, 2);
  v.carveLouvers(13, 12, 7, 13, 15, 14, 2);
  // Yellow/black high-voltage warning stripe band
  v.fillBox(4, 11, 15, 13, 11, 18, 0xfacc15, VoxelMat.Matte);
  v.fillBox(4, 11, 16, 13, 11, 16, 0x0f172a, VoxelMat.Matte);

  // Top sight rail + glowing 4-bar cyan charge gauge
  v.fillBox(6, 18, 4, 11, 19, 21, 0x334155, VoxelMat.Metal);
  v.carveBox(7, 19, 6, 10, 19, 18);
  for (let z = 7; z <= 15; z += 2) {
    v.fillBox(7, 19, z, 10, 19, z, 0x38bdf8, VoxelMat.Emissive);
  }
  // Rear iron sight notches
  v.fillBox(6, 20, 4, 7, 21, 5, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(10, 20, 4, 11, 21, 5, 0x94a3b8, VoxelMat.Metal);

  // Exposed wound copper induction coils protruding from both sides (z = 16..22)
  for (let z = 16; z <= 22; z++) {
    const col = z % 2 === 0 ? 0xd97706 : 0xb45309;
    v.fillBox(3, 12, z, 4, 16, z, col, VoxelMat.Metal);
    v.fillBox(13, 12, z, 14, 16, z, col, VoxelMat.Metal);
  }
  // Under-barrel blue high-voltage capacitor cell + glass voltage tube
  v.fillCylinderZ(8.5, 9, 15, 22, 2.2, 0x0284c7, VoxelMat.Metal);
  v.fillBox(7, 8, 17, 10, 8, 20, 0x7dd3fc, VoxelMat.Glass);

  // Front insulator bulkhead + twin protruding stepped chrome electrodes + plasma arc bridge
  v.fillBeveledBox(4, 11, 23, 13, 17, 24, 0x475569, VoxelMat.Metal, 'vertical');
  // Left & right forked electrodes
  v.fillBox(5, 13, 25, 6, 15, 29, 0xe2e8f0, VoxelMat.Metal);
  v.fillBox(11, 13, 25, 12, 15, 29, 0xe2e8f0, VoxelMat.Metal);
  // Insulator ceramic collars around electrode bases
  v.fillBox(4, 12, 25, 7, 16, 26, 0x0f172a, VoxelMat.Fabric);
  v.fillBox(10, 12, 25, 13, 16, 26, 0x0f172a, VoxelMat.Fabric);
  // Glowing cyan arc tips + faint micro-spark between prongs
  v.set(6, 14, 29, 0x7dd3fc, VoxelMat.Emissive);
  v.set(11, 14, 29, 0x7dd3fc, VoxelMat.Emissive);
  v.fillLine(7, 14, 28, 10, 14, 28, 0x38bdf8, VoxelMat.Emissive, 0);

  v.applyTactileGrain(102, 0.04);
  return v.build({ anchor: [8.5, 11, 14] }).geometry;
}

function buildKeyGeo(keyColor: number, accentColor: number, toothPattern: number): THREE.BufferGeometry {
  // High-density 18x12x32 ornate key: hollow carved bow, split steel keyring,
  // stepped decorative collar, grooved shaft & unique serrated bitting teeth
  const v = new VoxelSculptor(18, 12, 32, 0.0115);

  // Steel split keyring looping through the bow at rear (z = 0..7)
  v.fillLine(5, 5, 1, 12, 5, 1, 0xcbd5e1, VoxelMat.Metal, 0);
  v.fillLine(5, 5, 1, 4, 6, 4, 0x94a3b8, VoxelMat.Metal, 0);
  v.fillLine(12, 5, 1, 13, 6, 4, 0x94a3b8, VoxelMat.Metal, 0);
  v.fillLine(4, 6, 4, 7, 6, 7, 0xcbd5e1, VoxelMat.Metal, 0);
  v.fillLine(13, 6, 4, 10, 6, 7, 0xcbd5e1, VoxelMat.Metal, 0);

  // Ornate beveled hollow bow (head of key: z = 6..15, x = 3..14)
  v.fillBeveledBox(3, 4, 6, 14, 7, 15, keyColor, VoxelMat.Metal, 'all');
  // Carve decorative clover/diamond hollow cutout inside bow
  v.carveBox(6, 3, 9, 11, 8, 12);
  v.carveBox(7, 3, 8, 10, 8, 13);
  // Colored tag / jewel inlay on bow face
  v.fillBox(4, 7, 9, 5, 7, 12, accentColor, VoxelMat.Emissive);
  v.fillBox(12, 7, 9, 13, 7, 12, accentColor, VoxelMat.Emissive);

  // Stepped ornate collar transition (z = 16..18)
  v.fillBox(6, 3, 16, 11, 8, 16, accentColor, VoxelMat.Metal);
  v.fillBox(7, 4, 17, 10, 7, 17, keyColor, VoxelMat.Metal);
  v.fillBox(6, 3, 18, 11, 8, 18, accentColor, VoxelMat.Metal);

  // Grooved cylindrical/octagonal key blade shaft (z = 19..30)
  v.fillBox(7, 4, 19, 10, 7, 30, keyColor, VoxelMat.Metal);
  // Longitudinal keyway flute carved along top & bottom of shaft
  v.carveBox(8, 7, 20, 9, 7, 29);
  v.carveBox(8, 4, 20, 9, 4, 29);
  // Tapered front tip
  v.fillBox(8, 5, 31, 9, 6, 31, keyColor, VoxelMat.Metal);

  // Unique serrated key bitting teeth (+X side, z = 21..29)
  const depths =
    toothPattern === 0
      ? [4, 2, 5, 3, 5]
      : toothPattern === 1
      ? [5, 3, 2, 5, 4]
      : toothPattern === 2
      ? [3, 5, 4, 2, 5]
      : [5, 4, 5, 3, 5];
  for (let i = 0; i < depths.length; i++) {
    const zPos = 21 + i * 2;
    v.fillBox(11, 5, zPos, 10 + depths[i], 6, zPos, keyColor, VoxelMat.Metal);
    if (i < depths.length - 1) {
      v.fillBox(11, 5, zPos + 1, 10 + Math.min(depths[i], depths[i + 1]) - 1, 6, zPos + 1, accentColor, VoxelMat.Metal);
    }
  }
  // Master key gets symmetric double-bitted ward teeth on both sides!
  if (toothPattern === 3) {
    for (let i = 0; i < depths.length; i++) {
      const zPos = 21 + i * 2;
      v.fillBox(7 - depths[i], 5, zPos, 6, 6, zPos, keyColor, VoxelMat.Metal);
    }
  }

  return v.build({ anchor: [9, 5.5, 16] }).geometry;
}

function buildCrowbarGeo(): THREE.BufferGeometry {
  // High-density 16x34x18 forged steel crowbar: hexagonal red shaft, knurled grip tape,
  // curved swan-neck forged split-claw tip, beveled flat chisel pry tail
  const v = new VoxelSculptor(16, 34, 18, 0.0175);

  // Main forged octagonal/hexagonal steel shaft (y = 5..24, x = 6..9, z = 7..10)
  v.fillBeveledBox(6, 5, 7, 9, 24, 10, 0xb91c1c, VoxelMat.Metal, 'vertical');
  // Black ribbed electrical grip tape wrapped around center handle (y = 9..17)
  for (let y = 9; y <= 17; y++) {
    const col = y % 2 === 0 ? 0x111827 : 0x1f2937;
    v.fillBeveledBox(5, y, 6, 10, y, 11, col, VoxelMat.Fabric, 'vertical');
  }
  // Scratched raw forged steel wear strips along shaft edges
  v.fillBox(6, 6, 8, 6, 8, 9, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(9, 18, 8, 9, 23, 9, 0x94a3b8, VoxelMat.Metal);

  // Beveled flat chisel tail at bottom (y = 0..5, curving slightly -Z)
  v.fillLine(7.5, 5, 8.5, 7.5, 2, 6, 0x94a3b8, VoxelMat.Metal, 1.3);
  v.fillBox(5, 0, 4, 10, 2, 6, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(5, 0, 3, 10, 0, 4, 0xe2e8f0, VoxelMat.Metal); // sharpened pry edge

  // Curved gooseneck forged hook at top (y = 24..33, arching toward +Z)
  v.fillLine(7.5, 24, 8.5, 7.5, 29, 9.5, 0xb91c1c, VoxelMat.Metal, 1.4);
  v.fillLine(7.5, 29, 9.5, 7.5, 32, 12.5, 0x94a3b8, VoxelMat.Metal, 1.4);
  v.fillLine(7.5, 32, 12.5, 7.5, 30, 15.5, 0xcbd5e1, VoxelMat.Metal, 1.3);
  // Forged split-claw nail puller notch at very tip (x = 5..10 with V-slot carved in middle!)
  v.fillBox(5, 27, 15, 10, 30, 17, 0xd1d5db, VoxelMat.Metal);
  v.carveBox(7, 26, 15, 8, 29, 17);
  v.fillBox(5, 26, 16, 6, 27, 17, 0xf1f5f9, VoxelMat.Metal);
  v.fillBox(9, 26, 16, 10, 27, 17, 0xf1f5f9, VoxelMat.Metal);

  return v.build({ anchor: [7.5, 16, 9] }).geometry;
}

function buildCrowbarRodGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(14, 30, 14, 0.017);
  v.fillBeveledBox(5, 2, 5, 8, 27, 8, 0x94a3b8, VoxelMat.Metal, 'vertical');
  // Threaded coupling end at top + chisel end at bottom + dark grip tape
  for (let y = 23; y <= 27; y += 2) {
    v.fillBox(4, y, 4, 9, y, 9, 0x64748b, VoxelMat.Metal);
  }
  for (let y = 9; y <= 17; y++) {
    v.fillBeveledBox(4, y, 4, 9, y, 9, y % 2 === 0 ? 0x1e293b : 0x334155, VoxelMat.Fabric, 'vertical');
  }
  v.fillBox(4, 0, 5, 9, 2, 8, 0xe2e8f0, VoxelMat.Metal);
  v.fillBox(5, 19, 5, 8, 21, 8, 0xb91c1c, VoxelMat.Matte);
  return v.build({ anchor: [7, 14, 7] }).geometry;
}

function buildCrowbarHookGeo(): THREE.BufferGeometry {
  const v = new VoxelSculptor(16, 20, 20, 0.016);
  // Socket collar at bottom
  v.fillCylinderY(7.5, 1, 6, 6.5, 3.2, 0x475569, VoxelMat.Metal);
  v.fillCylinderY(7.5, 1, 4, 6.5, 1.5, 0, VoxelMat.Empty);
  // Forged red-painted curved claw arch
  v.fillLine(7.5, 6, 6.5, 7.5, 14, 8, 0xdc2626, VoxelMat.Metal, 1.7);
  v.fillLine(7.5, 14, 8, 7.5, 17, 13, 0xb91c1c, VoxelMat.Metal, 1.6);
  v.fillLine(7.5, 17, 13, 7.5, 13, 17, 0xcbd5e1, VoxelMat.Metal, 1.5);
  // Split nail-pulling twin prongs
  v.fillBox(4, 9, 16, 11, 13, 18, 0xe2e8f0, VoxelMat.Metal);
  v.carveBox(7, 8, 16, 8, 12, 19);
  return v.build({ anchor: [7.5, 9, 10] }).geometry;
}

function buildWireCuttersGeo(): THREE.BufferGeometry {
  // High-density 20x10x30 heavy bolt/wire cutters: ergonomic insulated red rubber grips,
  // double-hinged riveted pivot jaw, serrated forged dark steel blades
  const v = new VoxelSculptor(20, 10, 30, 0.0145);

  // Left & right curved insulated rubber handles (z = 1..17)
  v.fillLine(4, 4.5, 2, 7.5, 4.5, 17, 0xdc2626, VoxelMat.Fabric, 1.7);
  v.fillLine(15, 4.5, 2, 11.5, 4.5, 17, 0xdc2626, VoxelMat.Fabric, 1.7);
  // Grip ridges + yellow safety collar stops near pivot
  for (let z = 3; z <= 13; z += 3) {
    v.fillBox(2, 3, z, 7, 6, z, 0x991b1b, VoxelMat.Fabric);
    v.fillBox(12, 3, z, 17, 6, z, 0x991b1b, VoxelMat.Fabric);
  }
  v.fillBox(5, 3, 15, 8, 6, 16, 0xfacc15, VoxelMat.Matte);
  v.fillBox(11, 3, 15, 14, 6, 16, 0xfacc15, VoxelMat.Matte);

  // Heavy double-bolted forged steel pivot box (z = 17..22)
  v.fillBeveledBox(6, 2, 17, 13, 7, 22, 0x475569, VoxelMat.Metal, 'all');
  // Brass pivot bolt heads top & bottom
  v.fillCylinderY(9.5, 1, 8, 19.5, 1.4, 0xf59e0b, VoxelMat.Metal);
  // Secondary linkage pins
  v.fillCylinderY(7, 2, 7, 21, 0.9, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(12, 2, 7, 21, 0.9, 0x94a3b8, VoxelMat.Metal);

  // Curved pincer cutter jaws (z = 22..29) with central cutting gap
  v.fillLine(7, 4.5, 22, 6, 4.5, 26, 0x94a3b8, VoxelMat.Metal, 1.4);
  v.fillLine(6, 4.5, 26, 8.5, 4.5, 29, 0xe2e8f0, VoxelMat.Metal, 1.1);
  v.fillLine(12, 4.5, 22, 13, 4.5, 26, 0x94a3b8, VoxelMat.Metal, 1.4);
  v.fillLine(13, 4.5, 26, 10.5, 4.5, 29, 0xe2e8f0, VoxelMat.Metal, 1.1);
  v.carveBox(9, 2, 23, 10, 7, 27);

  return v.build({ anchor: [9.5, 4.5, 15] }).geometry;
}

function buildFuseGeo(): THREE.BufferGeometry {
  // High-density 16x16x26 industrial glass/ceramic cartridge fuse with brass end caps,
  // translucent glass sleeve showing twisted glowing filament coil inside!
  const v = new VoxelSculptor(16, 16, 26, 0.013);
  const cx = 7.5;
  const cy = 7.5;

  // Ribbed brass contact ferrules at both ends + blade tabs
  v.fillCylinderZ(cx, cy, 2, 7, 4.4, 0xd97706, VoxelMat.Metal);
  v.fillCylinderZ(cx, cy, 4, 4, 4.8, 0xf59e0b, VoxelMat.Metal);
  v.fillCylinderZ(cx, cy, 18, 23, 4.4, 0xd97706, VoxelMat.Metal);
  v.fillCylinderZ(cx, cy, 21, 21, 4.8, 0xf59e0b, VoxelMat.Metal);
  // Flat copper bayonet contact blades protruding at ends
  v.fillBox(6, 6, 0, 9, 9, 2, 0xfbbf24, VoxelMat.Metal);
  v.fillBox(6, 6, 23, 9, 9, 25, 0xfbbf24, VoxelMat.Metal);

  // Translucent outer glass cylinder sleeve
  v.fillCylinderZ(cx, cy, 8, 17, 4.1, 0xbae6fd, VoxelMat.Glass, 3.0);
  // Protective ceramic frame ribs along sides
  v.fillBox(3, 7, 7, 4, 8, 18, 0x334155, VoxelMat.Matte);
  v.fillBox(11, 7, 7, 12, 8, 18, 0x334155, VoxelMat.Matte);

  // Glowing coiled golden/cyan high-voltage filament inside the glass tube!
  for (let z = 8; z <= 17; z++) {
    const ang = z * 1.1;
    const fx = Math.round(cx + Math.cos(ang) * 1.6);
    const fy = Math.round(cy + Math.sin(ang) * 1.6);
    v.set(fx, fy, z, 0xfef08a, VoxelMat.Emissive);
    v.set(Math.round(cx), Math.round(cy), z, 0xf59e0b, VoxelMat.Emissive);
  }
  return v.build({ anchor: [cx, cy, 13] }).geometry;
}

function buildThrowableCanGeo(): THREE.BufferGeometry {
  // High-density 16x22x16 dented retro soda/ration tin can with rolled aluminum rims,
  // pull-tab lid, creased dent on one side, striped label
  const v = new VoxelSculptor(16, 22, 16, 0.0115);
  const cx = 7.5;
  const cz = 7.5;

  // Rolled bottom & top aluminum rims
  v.fillCylinderY(cx, 0, 1, cz, 5.2, 0xcbd5e1, VoxelMat.Metal);
  v.fillCylinderY(cx, 19, 21, cz, 5.2, 0xe2e8f0, VoxelMat.Metal);
  // Recessed top lid dish + pull-tab ring
  v.fillCylinderY(cx, 21, 21, cz, 4.1, 0, VoxelMat.Empty);
  v.fillCylinderY(cx, 20, 20, cz, 4.1, 0x94a3b8, VoxelMat.Metal);
  v.fillBox(6, 21, 6, 9, 21, 10, 0xf1f5f9, VoxelMat.Metal);
  v.carveBox(7, 21, 8, 8, 21, 9);

  // Main cylindrical body with crimson/white/gold vintage label bands
  v.fillCylinderY(cx, 2, 18, cz, 5.5, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(cx, 4, 16, cz, 5.6, 0xb91c1c, VoxelMat.Matte, 4.6);
  v.fillCylinderY(cx, 8, 12, cz, 5.6, 0xfef3c7, VoxelMat.Matte, 4.6);
  v.fillCylinderY(cx, 9, 11, cz, 5.7, 0xdc2626, VoxelMat.Matte, 4.9);

  // Organic dent carved on one side so it looks authentically scavenged
  v.carveBox(11, 8, 6, 14, 13, 9);
  v.fillBox(11, 9, 7, 11, 12, 8, 0x64748b, VoxelMat.Metal);

  v.applyTactileGrain(108, 0.05);
  return v.build({ anchor: [cx, 10, cz] }).geometry;
}

function buildBatteryGeo(): THREE.BufferGeometry {
  // High-density 18x20x16 industrial lithium flashlight battery pack with copper terminals,
  // ribbed grip housing, glowing green charge indicator bar
  const v = new VoxelSculptor(18, 20, 16, 0.012);
  v.fillBeveledBox(3, 1, 3, 14, 16, 12, 0x1e293b, VoxelMat.Matte, 'all');
  // Yellow hazard top collar
  v.fillBeveledBox(3, 12, 3, 14, 15, 12, 0xeab308, VoxelMat.Matte, 'vertical');
  // Grip side ribs
  for (let y = 3; y <= 10; y += 2) {
    v.fillBox(2, y, 5, 3, y, 10, 0x334155, VoxelMat.Fabric);
    v.fillBox(14, y, 5, 15, y, 10, 0x334155, VoxelMat.Fabric);
  }
  // Twin raised copper terminals on top
  v.fillCylinderY(5.5, 17, 19, 7.5, 1.8, 0xd97706, VoxelMat.Metal);
  v.fillCylinderY(11.5, 17, 19, 7.5, 1.8, 0x94a3b8, VoxelMat.Metal);
  // Glowing green charge LEDs on front face
  v.fillBox(6, 5, 12, 11, 9, 13, 0x0f172a, VoxelMat.Matte);
  v.fillBox(7, 6, 13, 10, 6, 13, 0x22c55e, VoxelMat.Emissive);
  v.fillBox(7, 8, 13, 10, 8, 13, 0x4ade80, VoxelMat.Emissive);
  return v.build({ anchor: [8.5, 9, 7.5] }).geometry;
}

function buildStunAmmoGeo(): THREE.BufferGeometry {
  // High-density 16x22x16 high-voltage blue arc cartridge with glass window & glowing core
  const v = new VoxelSculptor(16, 22, 16, 0.012);
  const cx = 7.5;
  const cz = 7.5;
  v.fillCylinderY(cx, 0, 3, cz, 4.6, 0x334155, VoxelMat.Metal);
  v.fillCylinderY(cx, 17, 20, cz, 4.6, 0x475569, VoxelMat.Metal);
  v.fillCylinderY(cx, 4, 16, cz, 4.2, 0x0284c7, VoxelMat.Metal, 3.2);
  // Translucent viewport band with glowing cyan plasma core inside
  v.fillCylinderY(cx, 6, 14, cz, 4.4, 0x7dd3fc, VoxelMat.Glass, 3.3);
  v.fillCylinderY(cx, 5, 15, cz, 2.1, 0x38bdf8, VoxelMat.Emissive);
  // Protective vertical steel cage struts
  for (const [sx, sz] of [[3, 7], [12, 7], [7, 3], [7, 12]]) {
    v.fillBox(sx, 3, sz, sx, 17, sz, 0x94a3b8, VoxelMat.Metal);
  }
  // Top twin brass contact pins
  v.fillBox(5, 20, 7, 6, 21, 8, 0xfbbf24, VoxelMat.Metal);
  v.fillBox(9, 20, 7, 10, 21, 8, 0xfbbf24, VoxelMat.Metal);
  return v.build({ anchor: [cx, 10, cz] }).geometry;
}

function buildStunCoilGeo(): THREE.BufferGeometry {
  // Wound copper induction spool on ceramic bobbin with terminal leads
  const v = new VoxelSculptor(18, 22, 18, 0.012);
  const cx = 8.5;
  const cz = 8.5;
  // Ceramic spool end flanges
  v.fillCylinderY(cx, 1, 3, cz, 6.2, 0x334155, VoxelMat.Matte);
  v.fillCylinderY(cx, 17, 19, cz, 6.2, 0x334155, VoxelMat.Matte);
  // Layered copper windings with alternating shade ridges
  for (let y = 4; y <= 16; y++) {
    const r = y % 2 === 0 ? 5.1 : 4.5;
    const col = y % 2 === 0 ? 0xd97706 : 0xb45309;
    v.fillCylinderY(cx, y, y, cz, r, col, VoxelMat.Metal);
  }
  // Glowing cyan core rod protruding top & bottom
  v.fillCylinderY(cx, 0, 21, cz, 1.8, 0x38bdf8, VoxelMat.Emissive);
  // Copper wire terminal leads sticking out
  v.fillLine(13, 3, 8, 16, 6, 8, 0xf59e0b, VoxelMat.Metal, 0);
  v.fillLine(4, 17, 8, 1, 14, 8, 0xf59e0b, VoxelMat.Metal, 0);
  return v.build({ anchor: [cx, 10, cz] }).geometry;
}

function buildStunCellGeo(): THREE.BufferGeometry {
  // High-capacity twin capacitor cell pack strapped with steel bands
  const v = new VoxelSculptor(20, 20, 14, 0.0125);
  v.fillCylinderY(6, 1, 17, 6.5, 3.8, 0x0369a1, VoxelMat.Metal);
  v.fillCylinderY(13, 1, 17, 6.5, 3.8, 0x0369a1, VoxelMat.Metal);
  // Steel strap brackets holding the twin cells together
  v.fillBeveledBox(2, 4, 2, 17, 6, 11, 0x475569, VoxelMat.Metal, 'vertical');
  v.fillBeveledBox(2, 12, 2, 17, 14, 11, 0x475569, VoxelMat.Metal, 'vertical');
  // Glowing cyan energy level windows
  v.fillBox(5, 7, 10, 7, 11, 10, 0x7dd3fc, VoxelMat.Emissive);
  v.fillBox(12, 7, 10, 14, 11, 10, 0x7dd3fc, VoxelMat.Emissive);
  // Copper jumper busbar across top terminals
  v.fillCylinderY(6, 17, 19, 6.5, 1.4, 0xf59e0b, VoxelMat.Metal);
  v.fillCylinderY(13, 17, 19, 6.5, 1.4, 0xf59e0b, VoxelMat.Metal);
  v.fillBox(6, 18, 6, 13, 19, 7, 0xd97706, VoxelMat.Metal);
  return v.build({ anchor: [9.5, 9.5, 6.5] }).geometry;
}

function buildFlareGeo(): THREE.BufferGeometry {
  // Emergency road flare: ribbed crimson wax-paper cylinder, striker cap, brass rim, glowing igniter tip
  const v = new VoxelSculptor(14, 28, 14, 0.012);
  const cx = 6.5;
  const cz = 6.5;
  v.fillCylinderY(cx, 1, 21, cz, 3.6, 0xdc2626, VoxelMat.Matte);
  // White/yellow warning label wrap
  v.fillCylinderY(cx, 8, 14, cz, 3.8, 0xfef3c7, VoxelMat.Matte, 3.0);
  v.fillCylinderY(cx, 10, 12, cz, 3.9, 0x0f172a, VoxelMat.Matte, 3.2);
  // Ribbed base grip & wire stand foot
  v.fillCylinderY(cx, 0, 3, cz, 4.1, 0x1e293b, VoxelMat.Fabric);
  v.fillLine(2, 1, 6.5, 11, 1, 6.5, 0x94a3b8, VoxelMat.Metal, 0);
  // Brass collar + glowing orange/yellow phosphor striker tip
  v.fillCylinderY(cx, 21, 23, cz, 4.0, 0xf59e0b, VoxelMat.Metal);
  v.fillCylinderY(cx, 24, 26, cz, 3.2, 0xfb923c, VoxelMat.Emissive);
  v.fillCylinderY(cx, 26, 27, cz, 2.0, 0xfef08a, VoxelMat.Emissive);
  return v.build({ anchor: [cx, 13, cz] }).geometry;
}

/**
 * 100% Unified Sculpted Micro-Voxel Item Builder.
 * Shared verbatim between world pickups AND 1st-person held viewmodels!
 */
export function createSculptedItemModel(
  itemType: WorldPickupType,
  standalone = false
): THREE.Group {
  const g = new THREE.Group();

  switch (itemType) {
    case 'flashlight': {
      const body = buildItemSculpt('flashlight', standalone, buildFlashlightGeo);
      body.rotation.y = Math.PI;
      g.add(body);
      // Dynamic UV-switchable faceted lens sitting right inside the crenellated reflector dish!
      // Preserves exact `name = 'flashlight_lens'` contract used by setUvMode() in models.ts!
      const lensGeo = new THREE.CylinderGeometry(0.056, 0.048, 0.022, 8);
      lensGeo.rotateX(Math.PI / 2);
      const lens = new THREE.Mesh(
        lensGeo,
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xfef08a,
          emissiveIntensity: 1.6,
          roughness: 0.14,
          metalness: 0.1,
        })
      );
      lens.position.set(0, 0, -0.215);
      lens.name = 'flashlight_lens';
      g.add(lens);
      break;
    }
    case 'stun_gun': {
      const stun = buildItemSculpt('stun_gun', standalone, buildStunGunGeo);
      stun.rotation.y = Math.PI;
      g.add(stun);
      break;
    }
    case 'red_key': {
      g.add(buildItemSculpt('red_key', standalone, () => buildKeyGeo(0xdc2626, 0xfca5a5, 0)));
      break;
    }
    case 'blue_key': {
      g.add(buildItemSculpt('blue_key', standalone, () => buildKeyGeo(0x2563eb, 0x93c5fd, 1)));
      break;
    }
    case 'basement_key': {
      g.add(buildItemSculpt('basement_key', standalone, () => buildKeyGeo(0x16a34a, 0x86efac, 2)));
      break;
    }
    case 'master_key': {
      g.add(buildItemSculpt('master_key', standalone, () => buildKeyGeo(0xf59e0b, 0xfef08a, 3)));
      break;
    }
    case 'crowbar': {
      g.add(buildItemSculpt('crowbar', standalone, buildCrowbarGeo));
      break;
    }
    case 'crowbar_rod': {
      g.add(buildItemSculpt('crowbar_rod', standalone, buildCrowbarRodGeo));
      break;
    }
    case 'crowbar_hook': {
      g.add(buildItemSculpt('crowbar_hook', standalone, buildCrowbarHookGeo));
      break;
    }
    case 'wire_cutters': {
      g.add(buildItemSculpt('wire_cutters', standalone, buildWireCuttersGeo));
      break;
    }
    case 'fuse': {
      g.add(buildItemSculpt('fuse', standalone, buildFuseGeo));
      break;
    }
    case 'throwable_can': {
      g.add(buildItemSculpt('throwable_can', standalone, buildThrowableCanGeo));
      break;
    }
    case 'battery': {
      g.add(buildItemSculpt('battery', standalone, buildBatteryGeo));
      break;
    }
    case 'stun_ammo': {
      g.add(buildItemSculpt('stun_ammo', standalone, buildStunAmmoGeo));
      break;
    }
    case 'stun_coil': {
      g.add(buildItemSculpt('stun_coil', standalone, buildStunCoilGeo));
      break;
    }
    case 'stun_cell': {
      g.add(buildItemSculpt('stun_cell', standalone, buildStunCellGeo));
      break;
    }
    case 'flare': {
      g.add(buildItemSculpt('flare', standalone, buildFlareGeo));
      break;
    }
  }

  return g;
}

function buildCassetteRecorderGeo(): THREE.BufferGeometry {
  // High-density 28x14x22 retro analog VHS/Cassette deck + protruding tape with
  // translucent window revealing twin toothed reels and dark magnetic tape ribbon!
  const v = new VoxelSculptor(28, 14, 22, 0.016);

  // Main charcoal industrial deck chassis with rubber feet
  v.fillBeveledBox(1, 1, 1, 26, 9, 20, 0x1e293b, VoxelMat.Matte, 'all');
  for (const [fx, fz] of [[2, 2], [25, 2], [2, 19], [25, 19]]) {
    v.fillBox(fx, 0, fz, fx + 1, 1, fz + 1, 0x0f172a, VoxelMat.Fabric);
  }
  // Brushed aluminum faceplate bezel & recessed tape bay
  v.fillBox(2, 9, 2, 25, 10, 19, 0x475569, VoxelMat.Metal);
  v.carveBox(4, 9, 4, 20, 10, 14);

  // Detailed VHS / Cassette shell seated inside the bay
  v.fillBeveledBox(4, 9, 4, 20, 11, 14, 0x111827, VoxelMat.Matte, 'top');
  // Warm amber paper label strip on cassette top
  v.fillBox(6, 11, 5, 18, 11, 7, 0xd97706, VoxelMat.Matte);
  v.fillBox(7, 11, 6, 17, 11, 6, 0xfef3c7, VoxelMat.Matte);
  // Translucent acrylic cassette window (z = 8..12) revealing twin toothed spools & magnetic ribbon!
  v.carveBox(6, 10, 8, 18, 11, 12);
  // Dark magnetic tape ribbon stretched across interior
  v.fillBox(6, 9, 9, 18, 9, 11, 0x1c1917, VoxelMat.Fabric);
  // Left & right white toothed tape reels
  v.fillCylinderY(9, 9, 10, 10, 1.8, 0xf8fafc, VoxelMat.Matte);
  v.fillCylinderY(15, 9, 10, 10, 1.8, 0xf8fafc, VoxelMat.Matte);
  v.set(9, 10, 10, 0x0f172a, VoxelMat.Metal);
  v.set(15, 10, 10, 0x0f172a, VoxelMat.Metal);
  // Translucent cover pane over reels
  v.fillBox(6, 11, 8, 18, 11, 12, 0xcbd5e1, VoxelMat.Glass);

  // Speaker grille slots on right side (x = 21..25)
  for (let z = 4; z <= 14; z += 2) {
    v.fillBox(22, 10, z, 24, 10, z, 0x090d14, VoxelMat.Fabric);
  }

  // Row of 5 physical mechanical push-buttons along front edge (PLAY/STOP/FF/REW/REC)
  const btnColors = [0x94a3b8, 0x94a3b8, 0x22c55e, 0x94a3b8, 0xdc2626];
  for (let i = 0; i < 5; i++) {
    const bx = 4 + i * 3;
    v.fillBox(bx, 8, 16, bx + 1, 11, 18, btnColors[i], VoxelMat.Metal);
  }
  // Volume rotary dial on front-right + carrying handle bracket on rear
  v.fillCylinderY(23, 10, 12, 17, 1.4, 0xcbd5e1, VoxelMat.Metal);
  v.fillBox(7, 5, 0, 20, 6, 0, 0x64748b, VoxelMat.Metal);

  v.applyTactileGrain(120, 0.04);
  return v.build({ anchor: [14, 0, 11] }).geometry;
}

export function createSculptedCassetteRecorderVisual(tape: CassetteTapeDefinition): {
  group: THREE.Group;
  ledMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  group.position.set(tape.x, tape.y, tape.z);

  const deck = createSculptedMesh('prop_cassette_recorder', buildCassetteRecorderGeo, {
    castShadow: true,
    receiveShadow: true,
  });
  group.add(deck);

  // Dynamic REC status LED (turns green once listened!)
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.9,
    roughness: 0.2,
  });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.032, 0.042), ledMat);
  led.position.set(0.16, 0.175, 0.08);
  group.add(led);

  return { group, ledMat };
}

function buildNoiseBottlesGeo(): THREE.BufferGeometry {
  // Cluster of 4 sculpted translucent glass bottles (2 upright, 1 tilted, 1 shattered neck + glass shards!)
  const v = new VoxelSculptor(28, 20, 28, 0.022);

  // Upright green glass bottle #1
  v.fillCylinderY(8, 0, 9, 9, 2.8, 0x166534, VoxelMat.Glass);
  v.fillCylinderY(8, 10, 12, 9, 1.9, 0x15803d, VoxelMat.Glass);
  v.fillCylinderY(8, 13, 18, 9, 1.2, 0x22c55e, VoxelMat.Glass);
  v.fillCylinderY(8, 18, 19, 9, 1.5, 0xd97706, VoxelMat.Metal); // rusted cap
  v.fillCylinderY(8, 3, 7, 9, 2.9, 0xfef3c7, VoxelMat.Matte, 2.4); // paper label

  // Upright amber bottle #2
  v.fillCylinderY(19, 0, 8, 11, 2.6, 0x92400e, VoxelMat.Glass);
  v.fillCylinderY(19, 9, 11, 11, 1.8, 0xb45309, VoxelMat.Glass);
  v.fillCylinderY(19, 12, 16, 11, 1.1, 0xd97706, VoxelMat.Glass);
  v.fillCylinderY(19, 3, 6, 11, 2.7, 0xd6d3d1, VoxelMat.Matte, 2.2);

  // Fallen horizontal bottle #3 rolling across front
  v.fillCylinderX(6, 14, 2.5, 20, 2.4, 0x15803d, VoxelMat.Glass);
  v.fillCylinderX(15, 20, 2.5, 20, 1.1, 0x22c55e, VoxelMat.Glass);

  // Broken glass shards scattered around base
  for (const [sx, sz, col] of [
    [13, 14, 0x4ade80],
    [15, 16, 0x86efac],
    [22, 18, 0xfbbf24],
    [4, 15, 0x4ade80],
    [11, 6, 0x86efac],
  ]) {
    v.fillBox(sx, 0, sz, sx + 1, 0, sz + 1, col, VoxelMat.Glass);
    v.set(sx + 1, 1, sz, col, VoxelMat.Glass);
  }

  return v.build({ anchor: [14, 0, 14] }).geometry;
}

function buildNoiseCansGeo(): THREE.BufferGeometry {
  // Cluster of 5 dented aluminum & rusty tin cans stacked/toppled on floor
  const v = new VoxelSculptor(28, 16, 28, 0.022);

  // Upright cans
  v.fillCylinderY(8, 0, 8, 9, 2.7, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderY(8, 2, 6, 9, 2.8, 0xb91c1c, VoxelMat.Matte, 2.3);
  v.fillCylinderY(8, 8, 8, 9, 2.0, 0, VoxelMat.Empty);

  v.fillCylinderY(18, 0, 9, 10, 2.6, 0xcbd5e1, VoxelMat.Metal);
  v.fillCylinderY(18, 2, 7, 10, 2.7, 0x1d4ed8, VoxelMat.Matte, 2.2);
  v.fillCylinderY(18, 9, 9, 10, 1.9, 0, VoxelMat.Empty);

  // Stacked angled top can
  v.fillCylinderY(13, 8, 15, 9, 2.4, 0x64748b, VoxelMat.Metal);
  v.fillCylinderY(13, 10, 13, 9, 2.5, 0xd97706, VoxelMat.Matte, 2.0);

  // Two fallen crushed cans on front
  v.fillCylinderX(6, 13, 2, 19, 2.2, 0x94a3b8, VoxelMat.Metal);
  v.fillCylinderX(8, 11, 2, 19, 2.3, 0x15803d, VoxelMat.Matte, 1.8);
  v.fillCylinderZ(20, 2, 15, 22, 2.1, 0xcbd5e1, VoxelMat.Metal);
  v.fillCylinderZ(20, 2, 17, 20, 2.2, 0xdc2626, VoxelMat.Matte, 1.7);

  return v.build({ anchor: [14, 0, 14] }).geometry;
}

export function createSculptedNoisePropVisual(np: NoisePropDefinition): THREE.Group {
  const group = new THREE.Group();
  group.position.set(np.x, np.y, np.z);
  const mesh = createSculptedMesh(
    `noise_${np.kind}`,
    np.kind === 'bottles' ? buildNoiseBottlesGeo : buildNoiseCansGeo,
    { castShadow: true, receiveShadow: true }
  );
  group.add(mesh);
  return group;
}
