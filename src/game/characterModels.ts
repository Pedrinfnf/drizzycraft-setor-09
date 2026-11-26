import * as THREE from 'three';
import type { MaterialPack } from './textures';
import { createSculptedMesh, VoxelMat, VoxelSculptor } from './voxelSculptor';

/**
 * High-Density Sculpted Micro-Voxel Lore Characters for DrizzyCraft: Setor 09.
 * Every character is built on a fine discrete VoxelSculptor grid with Baked Vertex AO,
 * edge wear, and multi-channel PBR materials (Matte, Metal, Emissive, Glass, Fabric)
 * so both in-world cutscenes AND 3-point-lit 3D offscreen portraits look razor-sharp.
 */

/**
 * 1. PROTAGONISTA (Investigador / Sobrevivente do Setor 09)
 * Layered hooded tactical windbreaker with draped collar hood folds, rugged field backpack
 * with chest straps & brass buckles, cargo pants with knee pockets, laced sneakers/boots,
 * sculpted micro-voxel face & tousled hair, tactical fingerless gloves & wristwatch.
 */
export function createSculptedSurvivorCharacterRig(_pack: MaterialPack): THREE.Group {
  const root = new THREE.Group();

  // Full-body high-density micro-voxel sculpt (22 x 36 x 16 @ 0.044m -> ~1.58m tall + hair crown)
  const bodyMesh = createSculptedMesh('char_protagonist_v3', () => {
    const v = new VoxelSculptor(22, 38, 16, 0.045);

    // Sculpted sneakers / tactical boots with treaded rubber soles & ankle collars (y=0..4)
    for (const x0 of [6, 12]) {
      // Sole tread
      v.fillBox(x0, 0, 5, x0 + 3, 0, 10, 0x111318, VoxelMat.Matte);
      v.fillBox(x0, 1, 9, x0 + 3, 1, 10, 0xd4d4d8, VoxelMat.Matte); // rubber toe-cap stripe
      // Boot upper with beveled instep
      v.fillBeveledBox(x0, 1, 5, x0 + 3, 3, 9, 0x1e222b, VoxelMat.Fabric, 'top');
      // Lace eyelets (metallic)
      v.set(x0 + 1, 2, 9, 0x94a3b8, VoxelMat.Metal);
      v.set(x0 + 2, 2, 9, 0x94a3b8, VoxelMat.Metal);
      v.set(x0 + 1, 3, 8, 0x94a3b8, VoxelMat.Metal);
      v.set(x0 + 2, 3, 8, 0x94a3b8, VoxelMat.Metal);

      // Cargo pants legs with articulated knee seams & side pockets (y=4..15)
      v.fillBox(x0, 4, 5, x0 + 3, 15, 8, 0x262d3a, VoxelMat.Fabric);
      // Knee reinforcement patches
      v.fillBox(x0, 8, 8, x0 + 3, 10, 9, 0x1f2632, VoxelMat.Fabric);
      // Side cargo pocket flaps
      const sideX = x0 === 6 ? x0 - 1 : x0 + 4;
      v.fillBox(sideX, 10, 5, sideX, 13, 8, 0x1d232e, VoxelMat.Fabric);
      v.set(sideX, 13, 6, 0x94a3b8, VoxelMat.Metal); // pocket snap
    }

    // Pelvis & tactical utility belt with metallic buckle & pouches (y=15..16)
    v.fillBox(6, 15, 5, 15, 16, 8, 0x1a1e26, VoxelMat.Fabric);
    v.fillBox(5, 16, 5, 16, 16, 9, 0x181512, VoxelMat.Fabric);
    v.fillBox(10, 16, 9, 11, 16, 9, 0xd97706, VoxelMat.Metal); // brass buckle
    v.fillBox(6, 15, 9, 7, 16, 9, 0x292524, VoxelMat.Fabric); // belt pouch

    // Hooded tactical windbreaker / jacket torso with fabric folds & inner shirt (y=17..28)
    v.fillBeveledBox(5, 17, 4, 16, 28, 9, 0x254873, VoxelMat.Fabric, 'vertical');
    // Subtle fabric shade pleats along jacket hem & ribs
    v.fillBox(5, 17, 4, 16, 17, 9, 0x1d3a5e, VoxelMat.Fabric);
    v.fillBox(6, 19, 9, 8, 20, 9, 0x1c385a, VoxelMat.Fabric); // left pocket fold
    v.fillBox(13, 19, 9, 15, 20, 9, 0x1c385a, VoxelMat.Fabric); // right pocket fold
    // Open central zipper placket revealing dark charcoal inner hoodie/tee
    v.fillBox(9, 18, 9, 12, 27, 9, 0x1c212b, VoxelMat.Fabric);
    v.fillBox(9, 18, 9, 9, 27, 9, 0x94a3b8, VoxelMat.Metal); // zipper teeth L
    v.fillBox(12, 18, 9, 12, 27, 9, 0x94a3b8, VoxelMat.Metal); // zipper teeth R
    // Backpack shoulder straps crossing chest with metallic chest clip!
    v.fillBox(7, 18, 9, 8, 28, 10, 0x2c303a, VoxelMat.Fabric);
    v.fillBox(13, 18, 9, 14, 28, 10, 0x2c303a, VoxelMat.Fabric);
    v.fillBox(8, 23, 10, 13, 23, 10, 0x1e222b, VoxelMat.Fabric); // sternum strap
    v.fillBox(10, 23, 10, 11, 23, 10, 0xd97706, VoxelMat.Metal); // brass sternum buckle
    v.set(7, 25, 10, 0x38bdf8, VoxelMat.Emissive); // clipped mini LED beacon

    // Draped sculpted jacket hood bunched behind collar & shoulders (y=26..30, z=2..5)
    v.fillBeveledBox(6, 26, 2, 15, 29, 5, 0x1d3a5e, VoxelMat.Fabric, 'top');
    v.fillBox(7, 27, 3, 14, 29, 4, 0x152c47, VoxelMat.Fabric); // hood interior shadow fold
    // High upturned jacket collar framing neck
    v.fillBox(7, 28, 5, 14, 29, 8, 0x254873, VoxelMat.Fabric);
    v.clear(9, 28, 8);
    v.clear(10, 28, 8);
    v.clear(11, 28, 8);
    v.clear(12, 28, 8);

    // Rugged field backpack on back (z=0..3) with flap, pockets & brass buckles
    v.fillBeveledBox(6, 17, 0, 15, 26, 3, 0x3b4252, VoxelMat.Fabric, 'all');
    v.fillBox(7, 18, 0, 14, 21, 0, 0x4c566a, VoxelMat.Fabric); // lower pouch
    v.fillBox(7, 24, 0, 14, 26, 1, 0x2e3440, VoxelMat.Fabric); // top flap
    v.set(8, 23, 0, 0xd97706, VoxelMat.Metal);
    v.set(13, 23, 0, 0xd97706, VoxelMat.Metal);
    // Rolled sleeping mat strapped underneath backpack
    v.fillBox(6, 16, 1, 15, 17, 2, 0x5c4033, VoxelMat.Fabric);

    // Detailed jacket arms + elbow folds + ribbed cuffs + wristwatch + gloved hands
    for (const [ax0, ax1, isLeft] of [
      [2, 4, true],
      [17, 19, false],
    ] as const) {
      // Shoulder cap
      v.fillBeveledBox(ax0, 25, 5, ax1, 28, 8, 0x2a5282, VoxelMat.Fabric, 'top');
      // Sleeve with subtle elbow crease
      v.fillBox(ax0, 19, 5, ax1, 24, 8, 0x254873, VoxelMat.Fabric);
      v.fillBox(ax0, 21, 5, ax1, 22, 8, 0x1e3c61, VoxelMat.Fabric);
      // Ribbed dark cuff
      v.fillBox(ax0, 17, 5, ax1, 18, 8, 0x181c24, VoxelMat.Fabric);
      // Tactical watch on left wrist
      if (isLeft) {
        v.fillBox(ax0, 17, 8, ax1, 17, 9, 0x334155, VoxelMat.Metal);
        v.set(ax0 + 1, 17, 9, 0x38bdf8, VoxelMat.Emissive);
      }
      // Fingerless tactical glove + skin fingers
      v.fillBox(ax0, 15, 5, ax1, 16, 8, 0x1f242d, VoxelMat.Fabric);
      v.fillBox(ax0, 14, 5, ax1, 14, 8, 0xd8a682, VoxelMat.Matte);
    }

    // Neck (y=28..30)
    v.fillBox(9, 28, 5, 12, 30, 8, 0xc99672, VoxelMat.Matte);

    // Sculpted micro-voxel head (y=30..36, x=7..14, z=4..10)
    v.fillBeveledBox(7, 30, 4, 14, 36, 9, 0xd8a682, VoxelMat.Matte, 'all');
    // Subtle chin/jaw contour & ears
    v.fillBox(8, 30, 5, 13, 30, 9, 0xc99672, VoxelMat.Matte);
    v.set(6, 32, 6, 0xc99672, VoxelMat.Matte);
    v.set(6, 33, 6, 0xc99672, VoxelMat.Matte);
    v.set(15, 32, 6, 0xc99672, VoxelMat.Matte);
    v.set(15, 33, 6, 0xc99672, VoxelMat.Matte);
    // Nose bridge relief
    v.set(10, 32, 10, 0xdfb18f, VoxelMat.Matte);
    v.set(11, 32, 10, 0xdfb18f, VoxelMat.Matte);
    // Expressive eyes & brow ridge
    v.fillBox(8, 34, 9, 9, 34, 9, 0x2b1d14, VoxelMat.Matte); // brow L
    v.fillBox(12, 34, 9, 13, 34, 9, 0x2b1d14, VoxelMat.Matte); // brow R
    v.set(8, 33, 9, 0xf8fafc, VoxelMat.Matte); // sclera L
    v.set(9, 33, 9, 0x1e293b, VoxelMat.Matte); // pupil L
    v.set(12, 33, 9, 0x1e293b, VoxelMat.Matte); // pupil R
    v.set(13, 33, 9, 0xf8fafc, VoxelMat.Matte); // sclera R
    // Mouth line
    v.fillBox(10, 31, 9, 11, 31, 9, 0x9a684e, VoxelMat.Matte);

    // Layered tousled dark brown micro-voxel hair volume (y=34..37)
    v.fillBeveledBox(7, 35, 3, 14, 37, 9, 0x291c15, VoxelMat.Fabric, 'top');
    v.fillBox(7, 31, 3, 14, 35, 4, 0x211610, VoxelMat.Fabric); // back hair
    v.fillBox(7, 33, 4, 7, 35, 8, 0x291c15, VoxelMat.Fabric); // sideburn L
    v.fillBox(14, 33, 4, 14, 35, 8, 0x291c15, VoxelMat.Fabric); // sideburn R
    // Front swept fringe locks
    v.fillBox(8, 35, 9, 10, 36, 10, 0x33231a, VoxelMat.Fabric);
    v.fillBox(11, 36, 9, 13, 36, 10, 0x291c15, VoxelMat.Fabric);
    v.set(9, 35, 10, 0x3c291f, VoxelMat.Fabric);

    return v.build({ anchor: [11, 0, 7] }).geometry;
  });
  root.add(bodyMesh);

  return root;
}

export interface SculptedArticulatedSurvivorRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  leftForeArm: THREE.Group;
  rightArm: THREE.Group;
  rightForeArm: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  heldItemGroup: THREE.Group;
}

/**
 * High-Density Sculpted Articulated Micro-Voxel Survivor Rig (11 VoxelSculptor parts with Baked Vertex AO):
 * Replaces blocky box dummies across Multiplayer Allies & Cutscenes with the exact sculpted
 * windbreaker hood, zipper, chest straps, brass buckles, backpack, digital tactical watch,
 * cargo knee pads, laced boots, expressive micro-voxel face & layered hair of the flagship protagonist!
 */
export function createSculptedArticulatedSurvivorRig(jacketHex = 0x254873): SculptedArticulatedSurvivorRig {
  const root = new THREE.Group();
  const s = 0.044;
  const keyPrefix = `char_art_surv_${jacketHex.toString(16)}`;
  const jacketDark = ((jacketHex >> 1) & 0x7f7f7f) | 0x0a1420;

  // 1. Pelvis & Tactical Utility Belt (brass buckle + side belt pouch)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.72, 0);
  root.add(pelvis);

  const pelvisMesh = createSculptedMesh(`${keyPrefix}_pelvis`, () => {
    const v = new VoxelSculptor(14, 5, 10, s);
    v.fillBeveledBox(1, 0, 2, 12, 3, 7, 0x1a1e26, VoxelMat.Fabric, 'horizontal');
    v.fillBox(0, 2, 2, 13, 3, 8, 0x181512, VoxelMat.Fabric); // tactical leather belt
    v.fillBox(6, 2, 8, 7, 3, 8, 0xd97706, VoxelMat.Metal); // brass buckle
    v.fillBox(2, 1, 8, 4, 3, 9, 0x292524, VoxelMat.Fabric); // front belt pouch
    v.fillBox(10, 1, 8, 11, 2, 8, 0x334155, VoxelMat.Metal); // utility carabiner
    return v.build({ anchor: [7, 2, 5] }).geometry;
  });
  pelvis.add(pelvisMesh);

  // 2. Sculpted Hooded Windbreaker Torso + Open Zipper + Chest Straps + Rugged Field Backpack
  const torso = new THREE.Group();
  torso.position.set(0, 0.08, 0);
  pelvis.add(torso);

  const torsoMesh = createSculptedMesh(`${keyPrefix}_torso`, () => {
    const v = new VoxelSculptor(16, 16, 14, s);
    // Main beveled windbreaker torso
    v.fillBeveledBox(2, 0, 5, 13, 12, 10, jacketHex, VoxelMat.Fabric, 'vertical');
    v.fillBox(2, 0, 5, 13, 1, 10, jacketDark, VoxelMat.Fabric); // lower hem pleat
    v.fillBox(3, 2, 10, 5, 4, 11, jacketDark, VoxelMat.Fabric); // pocket L
    v.fillBox(10, 2, 10, 12, 4, 11, jacketDark, VoxelMat.Fabric); // pocket R
    // Open zipper placket + metallic zipper teeth
    v.fillBox(6, 1, 10, 9, 11, 10, 0x1c212b, VoxelMat.Fabric);
    v.fillBox(6, 1, 10, 6, 11, 10, 0x94a3b8, VoxelMat.Metal);
    v.fillBox(9, 1, 10, 9, 11, 10, 0x94a3b8, VoxelMat.Metal);
    // Crossing backpack shoulder straps + sternum buckle + glowing cyan beacon
    v.fillBox(4, 1, 10, 5, 12, 11, 0x2c303a, VoxelMat.Fabric);
    v.fillBox(10, 1, 10, 11, 12, 11, 0x2c303a, VoxelMat.Fabric);
    v.fillBox(5, 6, 11, 10, 6, 11, 0x1e222b, VoxelMat.Fabric);
    v.fillBox(7, 6, 11, 8, 6, 11, 0xd97706, VoxelMat.Metal);
    v.set(4, 9, 11, 0x38bdf8, VoxelMat.Emissive);
    // Draped jacket hood & high collar
    v.fillBeveledBox(3, 10, 3, 12, 13, 6, jacketDark, VoxelMat.Fabric, 'top');
    v.fillBox(4, 11, 4, 11, 13, 5, 0x152c47, VoxelMat.Fabric);
    v.fillBox(4, 12, 6, 11, 13, 9, jacketHex, VoxelMat.Fabric);
    v.clear(6, 12, 9); v.clear(7, 12, 9); v.clear(8, 12, 9); v.clear(9, 12, 9);
    // Rugged field backpack + pockets + brass clasps + rolled sleeping mat
    v.fillBeveledBox(3, 1, 0, 12, 10, 4, 0x3b4252, VoxelMat.Fabric, 'all');
    v.fillBox(4, 2, 0, 11, 5, 1, 0x4c566a, VoxelMat.Fabric);
    v.fillBox(4, 8, 0, 11, 10, 2, 0x2e3440, VoxelMat.Fabric);
    v.set(5, 7, 0, 0xd97706, VoxelMat.Metal);
    v.set(10, 7, 0, 0xd97706, VoxelMat.Metal);
    v.fillBox(3, 0, 1, 12, 1, 3, 0x5c4033, VoxelMat.Fabric);
    return v.build({ anchor: [8, 0, 8] }).geometry;
  });
  torso.add(torsoMesh);

  // 3. Sculpted Micro-Voxel Head (jaw, ears, nose, expressive eyes, brows, layered tousled hair & fringe)
  const head = new THREE.Group();
  head.position.set(0, 0.56, 0);
  torso.add(head);

  const headMesh = createSculptedMesh(`${keyPrefix}_head`, () => {
    const v = new VoxelSculptor(12, 12, 10, s);
    // Neck
    v.fillBox(4, 0, 3, 7, 2, 6, 0xc99672, VoxelMat.Matte);
    // Head volume + ears + nose
    v.fillBeveledBox(2, 2, 2, 9, 8, 7, 0xd8a682, VoxelMat.Matte, 'all');
    v.fillBox(3, 2, 3, 8, 2, 7, 0xc99672, VoxelMat.Matte);
    v.set(1, 4, 4, 0xc99672, VoxelMat.Matte);
    v.set(1, 5, 4, 0xc99672, VoxelMat.Matte);
    v.set(10, 4, 4, 0xc99672, VoxelMat.Matte);
    v.set(10, 5, 4, 0xc99672, VoxelMat.Matte);
    v.set(5, 4, 8, 0xdfb18f, VoxelMat.Matte);
    v.set(6, 4, 8, 0xdfb18f, VoxelMat.Matte);
    // Expressive eyes, brows & mouth
    v.fillBox(3, 6, 7, 4, 6, 7, 0x2b1d14, VoxelMat.Matte);
    v.fillBox(7, 6, 7, 8, 6, 7, 0x2b1d14, VoxelMat.Matte);
    v.set(3, 5, 7, 0xf8fafc, VoxelMat.Matte);
    v.set(4, 5, 7, 0x1e293b, VoxelMat.Matte);
    v.set(7, 5, 7, 0x1e293b, VoxelMat.Matte);
    v.set(8, 5, 7, 0xf8fafc, VoxelMat.Matte);
    v.fillBox(5, 3, 7, 6, 3, 7, 0x9a684e, VoxelMat.Matte);
    // Layered tousled dark brown hair + sideburns + swept front fringe
    v.fillBeveledBox(2, 7, 1, 9, 10, 7, 0x291c15, VoxelMat.Fabric, 'top');
    v.fillBox(2, 3, 1, 9, 7, 2, 0x211610, VoxelMat.Fabric);
    v.fillBox(2, 5, 2, 2, 7, 6, 0x291c15, VoxelMat.Fabric);
    v.fillBox(9, 5, 2, 9, 7, 6, 0x291c15, VoxelMat.Fabric);
    v.fillBox(3, 7, 7, 5, 8, 8, 0x33231a, VoxelMat.Fabric);
    v.fillBox(6, 8, 7, 8, 8, 8, 0x291c15, VoxelMat.Fabric);
    v.set(4, 7, 8, 0x3c291f, VoxelMat.Fabric);
    return v.build({ anchor: [6, 1, 5] }).geometry;
  });
  head.add(headMesh);

  // Helper for sculpted upper arm & elbow-jointed forearm + fingerless glove + watch (left)
  const buildArm = (isLeft: boolean): { upper: THREE.Group; fore: THREE.Group } => {
    const upper = new THREE.Group();
    upper.position.set(isLeft ? -0.31 : 0.31, 0.49, 0);
    const upperMesh = createSculptedMesh(`${keyPrefix}_uarm_${isLeft ? 'l' : 'r'}`, () => {
      const v = new VoxelSculptor(5, 8, 6, s);
      v.fillBeveledBox(0, 4, 1, 4, 7, 4, jacketHex, VoxelMat.Fabric, 'top'); // shoulder cap
      v.fillBox(0, 0, 1, 4, 4, 4, jacketDark, VoxelMat.Fabric); // bicep sleeve + elbow crease
      return v.build({ anchor: [2, 6, 3] }).geometry;
    });
    upper.add(upperMesh);

    const fore = new THREE.Group();
    fore.position.set(0, -0.26, 0);
    const foreMesh = createSculptedMesh(`${keyPrefix}_farm_${isLeft ? 'l' : 'r'}`, () => {
      const v = new VoxelSculptor(5, 8, 6, s);
      v.fillBox(0, 4, 1, 4, 7, 4, jacketHex, VoxelMat.Fabric); // forearm sleeve
      v.fillBox(0, 3, 1, 4, 3, 4, 0x181c24, VoxelMat.Fabric); // ribbed cuff
      if (isLeft) {
        v.fillBox(0, 3, 4, 4, 3, 5, 0x334155, VoxelMat.Metal);
        v.set(2, 3, 5, 0x38bdf8, VoxelMat.Emissive); // glowing tactical wristwatch
      }
      v.fillBox(0, 1, 1, 4, 2, 4, 0x1f242d, VoxelMat.Fabric); // fingerless tactical glove
      v.fillBox(0, 0, 1, 4, 0, 4, 0xd8a682, VoxelMat.Matte); // fingers
      return v.build({ anchor: [2, 7, 3] }).geometry;
    });
    fore.add(foreMesh);
    upper.add(fore);
    return { upper, fore };
  };

  const armL = buildArm(true);
  torso.add(armL.upper);
  const armR = buildArm(false);
  torso.add(armR.upper);

  const heldItemGroup = new THREE.Group();
  heldItemGroup.position.set(0, -0.31, 0.1);
  armR.fore.add(heldItemGroup);

  // Helper for sculpted thigh (cargo pants + pocket) & knee-jointed shin + laced boot
  const buildLeg = (isLeft: boolean): { thigh: THREE.Group; shin: THREE.Group } => {
    const thigh = new THREE.Group();
    thigh.position.set(isLeft ? -0.12 : 0.12, -0.02, 0);
    const thighMesh = createSculptedMesh(`${keyPrefix}_thigh_${isLeft ? 'l' : 'r'}`, () => {
      const v = new VoxelSculptor(6, 9, 6, s);
      v.fillBox(1, 0, 1, 4, 8, 4, 0x262d3a, VoxelMat.Fabric);
      // Side cargo pocket flap + metallic snap
      const sideX = isLeft ? 0 : 5;
      v.fillBox(sideX, 2, 1, sideX, 5, 4, 0x1d232e, VoxelMat.Fabric);
      v.set(sideX, 5, 2, 0x94a3b8, VoxelMat.Metal);
      // Knee reinforcement pad
      v.fillBox(1, 0, 4, 4, 2, 5, 0x1f2632, VoxelMat.Fabric);
      return v.build({ anchor: [3, 8, 3] }).geometry;
    });
    thigh.add(thighMesh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.35, 0);
    const shinMesh = createSculptedMesh(`${keyPrefix}_shin_${isLeft ? 'l' : 'r'}`, () => {
      const v = new VoxelSculptor(6, 9, 8, s);
      v.fillBox(1, 4, 1, 4, 8, 4, 0x262d3a, VoxelMat.Fabric); // lower trouser
      v.fillBeveledBox(1, 1, 1, 4, 3, 5, 0x1e222b, VoxelMat.Fabric, 'top'); // tactical boot upper
      v.fillBox(1, 0, 1, 4, 0, 6, 0x111318, VoxelMat.Matte); // treaded sole
      v.fillBox(1, 1, 5, 4, 1, 6, 0xd4d4d8, VoxelMat.Matte); // rubber toe cap stripe
      v.set(2, 2, 5, 0x94a3b8, VoxelMat.Metal); // metallic lace eyelets
      v.set(3, 2, 5, 0x94a3b8, VoxelMat.Metal);
      v.set(2, 3, 4, 0x94a3b8, VoxelMat.Metal);
      v.set(3, 3, 4, 0x94a3b8, VoxelMat.Metal);
      return v.build({ anchor: [3, 8, 3] }).geometry;
    });
    shin.add(shinMesh);
    thigh.add(shin);
    return { thigh, shin };
  };

  const legL = buildLeg(true);
  pelvis.add(legL.thigh);
  const legR = buildLeg(false);
  pelvis.add(legR.thigh);

  return {
    root,
    pelvis,
    torso,
    head,
    leftArm: armL.upper,
    leftForeArm: armL.fore,
    rightArm: armR.upper,
    rightForeArm: armR.fore,
    leftLeg: legL.thigh,
    leftShin: legL.shin,
    rightLeg: legR.thigh,
    rightShin: legR.shin,
    heldItemGroup,
  };
}

/**
 * 2. VIGIA MARCOS (Guarda de Segurança Noturno — Guarita do Setor 09)
 * Navy security uniform with metallic brass badge, peaked security cap + emblem,
 * tactical radio comms headset with boom mic, shoulder-mounted walkie-talkie with antenna
 * & live green status LED, belt flashlight holster, weathered face with mustache.
 */
export function createVigiaMarcosRig(_pack: MaterialPack): THREE.Group {
  const root = new THREE.Group();

  const mesh = createSculptedMesh('char_vigia_marcos_v1', () => {
    const v = new VoxelSculptor(22, 38, 16, 0.046);

    // Polished duty boots (y=0..4)
    for (const x0 of [6, 12]) {
      v.fillBox(x0, 0, 5, x0 + 3, 0, 10, 0x090a0d, VoxelMat.Matte);
      v.fillBeveledBox(x0, 1, 5, x0 + 3, 3, 9, 0x14171f, VoxelMat.Matte, 'top');
      // Dark slate duty trousers (y=4..15)
      v.fillBox(x0, 4, 5, x0 + 3, 15, 8, 0x1a2232, VoxelMat.Fabric);
      v.fillBox(x0 === 6 ? x0 : x0 + 3, 4, 6, x0 === 6 ? x0 : x0 + 3, 15, 7, 0x25334a, VoxelMat.Fabric); // uniform stripe
    }

    // Heavy security duty belt with brass buckle, belt flashlight & key clip (y=15..17)
    v.fillBox(5, 15, 4, 16, 17, 9, 0x161412, VoxelMat.Fabric);
    v.fillBox(10, 15, 9, 11, 17, 9, 0xd4af37, VoxelMat.Metal); // brass buckle
    // Belt flashlight holster (left hip)
    v.fillBox(4, 13, 6, 5, 16, 7, 0x27272a, VoxelMat.Metal);
    v.set(4, 16, 7, 0xfef08a, VoxelMat.Emissive);
    // Belt keyring / handcuffs pouch (right hip)
    v.fillBox(16, 14, 6, 17, 16, 8, 0x94a3b8, VoxelMat.Metal);

    // Navy Sector 09 Security Uniform Shirt with dark tactical vest trim (y=17..28)
    v.fillBeveledBox(5, 17, 4, 16, 28, 9, 0x1e3454, VoxelMat.Fabric, 'vertical');
    // Button placket & dark tie
    v.fillBox(10, 18, 9, 11, 27, 9, 0x132036, VoxelMat.Fabric);
    v.set(10, 26, 9, 0x111827, VoxelMat.Fabric); // tie knot
    v.set(11, 26, 9, 0x111827, VoxelMat.Fabric);
    // Chest pockets with flaps
    v.fillBox(6, 21, 9, 8, 24, 9, 0x182b47, VoxelMat.Fabric);
    v.fillBox(13, 21, 9, 15, 24, 9, 0x182b47, VoxelMat.Fabric);
    // Gleaming metallic Setor 09 Security Badge on left chest!
    v.fillBox(13, 25, 9, 15, 26, 10, 0xfbbf24, VoxelMat.Metal);
    v.set(14, 25, 10, 0xfef08a, VoxelMat.Metal);
    // Shoulder epaulets with metallic rank studs
    v.fillBox(5, 28, 5, 7, 28, 8, 0x132036, VoxelMat.Fabric);
    v.set(6, 28, 7, 0xfbbf24, VoxelMat.Metal);
    v.fillBox(14, 28, 5, 16, 28, 8, 0x132036, VoxelMat.Fabric);
    v.set(15, 28, 7, 0xfbbf24, VoxelMat.Metal);

    // Shoulder-mounted Walkie-Talkie Radio + tall whip antenna + glowing green TX LED!
    v.fillBox(6, 24, 9, 8, 27, 10, 0x18181b, VoxelMat.Matte);
    v.set(7, 26, 10, 0x22c55e, VoxelMat.Emissive); // green radio active LED
    v.fillBox(6, 27, 9, 6, 32, 9, 0x334155, VoxelMat.Metal); // whip antenna rising past collar!
    v.set(6, 32, 9, 0x94a3b8, VoxelMat.Metal);

    // Uniform sleeves with Sector 09 arm patch & hands
    for (const [ax0, ax1] of [
      [2, 4],
      [17, 19],
    ] as const) {
      v.fillBeveledBox(ax0, 24, 5, ax1, 28, 8, 0x1e3454, VoxelMat.Fabric, 'top');
      v.fillBox(ax0, 18, 5, ax1, 23, 8, 0x1a2e4a, VoxelMat.Fabric);
      // Arm badge patch
      const outerX = ax0 === 2 ? ax0 : ax1;
      v.fillBox(outerX, 24, 6, outerX, 25, 7, 0xd97706, VoxelMat.Metal);
      // Cuff & hand
      v.fillBox(ax0, 17, 5, ax1, 17, 8, 0x132036, VoxelMat.Fabric);
      v.fillBox(ax0, 14, 5, ax1, 16, 8, 0xc8926e, VoxelMat.Matte);
    }

    // Neck & crisp shirt collar (y=28..30)
    v.fillBox(8, 28, 5, 13, 29, 8, 0xe2e8f0, VoxelMat.Fabric);
    v.fillBox(9, 28, 5, 12, 30, 8, 0xbe8864, VoxelMat.Matte);

    // Sculpted weathered face (y=30..35, x=7..14, z=4..9)
    v.fillBeveledBox(7, 30, 4, 14, 35, 9, 0xc8926e, VoxelMat.Matte, 'all');
    // Jaw stubble / beard shadow
    v.fillBox(7, 30, 5, 14, 31, 9, 0xa87658, VoxelMat.Matte);
    // Mustache
    v.fillBox(9, 31, 10, 12, 31, 10, 0x3b2f2a, VoxelMat.Fabric);
    // Nose bridge
    v.set(10, 32, 10, 0xd29c78, VoxelMat.Matte);
    v.set(11, 32, 10, 0xd29c78, VoxelMat.Matte);
    // Stern eyes & heavy brows
    v.fillBox(8, 34, 9, 9, 34, 9, 0x3b2f2a, VoxelMat.Fabric);
    v.fillBox(12, 34, 9, 13, 34, 9, 0x3b2f2a, VoxelMat.Fabric);
    v.set(8, 33, 9, 0xf8fafc, VoxelMat.Matte);
    v.set(9, 33, 9, 0x1e293b, VoxelMat.Matte);
    v.set(12, 33, 9, 0x1e293b, VoxelMat.Matte);
    v.set(13, 33, 9, 0xf8fafc, VoxelMat.Matte);
    // Side hair graying slightly at temples
    v.fillBox(7, 32, 3, 14, 34, 4, 0x3f3a36, VoxelMat.Fabric);
    v.set(7, 33, 5, 0x6b7280, VoxelMat.Fabric);
    v.set(14, 33, 5, 0x6b7280, VoxelMat.Fabric);

    // Tactical Radio Headset on right ear + curved boom mic toward mouth!
    v.fillBox(6, 31, 6, 6, 34, 8, 0x18181b, VoxelMat.Metal);
    v.set(6, 32, 7, 0x22c55e, VoxelMat.Emissive); // headset comm LED
    v.fillBox(6, 31, 8, 6, 31, 10, 0x334155, VoxelMat.Metal); // boom arm
    v.fillBox(7, 31, 10, 8, 31, 10, 0x18181b, VoxelMat.Matte); // mic foam tip

    // Peaked Security Guard Cap with brim visor + metallic front emblem (y=35..37)
    v.fillBeveledBox(7, 35, 3, 14, 37, 9, 0x15253e, VoxelMat.Fabric, 'top');
    v.fillBox(7, 35, 9, 14, 35, 11, 0x0d1522, VoxelMat.Matte); // extended cap visor
    v.fillBox(10, 36, 9, 11, 37, 10, 0xfbbf24, VoxelMat.Metal); // gold cap badge!

    return v.build({ anchor: [11, 0, 7] }).geometry;
  });
  root.add(mesh);
  return root;
}

/**
 * 3. DRA. HELENA VASCONCELOS (Chefe de Pesquisa — Composto 09 / Projeto Ômega)
 * Off-white lab coat with open lapels over dark charcoal turtleneck, bio-containment
 * glowing emerald Composto 09 vial clipped to coat pocket, metallic ID lanyard,
 * protective safety goggles pushed onto brow, sculpted auburn hair bun.
 */
export function createOmegaScientistRig(_pack: MaterialPack): THREE.Group {
  const root = new THREE.Group();

  const mesh = createSculptedMesh('char_omega_scientist_v1', () => {
    const v = new VoxelSculptor(22, 38, 16, 0.044);

    // Lab shoes & dark clinical trousers (y=0..15)
    for (const x0 of [6, 12]) {
      v.fillBeveledBox(x0, 0, 5, x0 + 3, 2, 9, 0x18181b, VoxelMat.Matte, 'top');
      v.fillBox(x0, 3, 5, x0 + 3, 15, 8, 0x1f2937, VoxelMat.Fabric);
    }

    // Long sculpted lab coat hem & open front panels (y=11..28)
    v.fillBox(5, 11, 4, 16, 16, 5, 0xdbe2ea, VoxelMat.Fabric); // coat back skirt
    v.fillBox(5, 11, 5, 7, 16, 8, 0xe2e8f0, VoxelMat.Fabric); // coat left flap
    v.fillBox(14, 11, 5, 16, 16, 8, 0xe2e8f0, VoxelMat.Fabric); // coat right flap

    // Lab coat torso + dark teal/charcoal turtleneck underneath (y=17..28)
    v.fillBeveledBox(5, 17, 4, 16, 28, 9, 0xe5ebf1, VoxelMat.Fabric, 'vertical');
    v.fillBox(9, 17, 9, 12, 28, 9, 0x1e293b, VoxelMat.Fabric); // inner turtleneck
    // Crisp coat lapels
    v.fillBox(8, 22, 9, 8, 27, 10, 0xf1f5f9, VoxelMat.Fabric);
    v.fillBox(13, 22, 9, 13, 27, 10, 0xf1f5f9, VoxelMat.Fabric);
    // ID Lanyard + Omega clearance card
    v.fillBox(9, 24, 10, 12, 24, 10, 0x7c3aed, VoxelMat.Fabric); // purple lanyard strap
    v.fillBox(10, 21, 10, 11, 23, 10, 0xf8fafc, VoxelMat.Metal); // clearance badge
    v.set(10, 22, 10, 0x38bdf8, VoxelMat.Emissive); // hologram strip
    // Chest pocket with glowing emerald Composto 09 sample vial!
    v.fillBox(14, 21, 9, 15, 23, 10, 0xcbd5e1, VoxelMat.Fabric);
    v.fillBox(14, 23, 10, 14, 25, 10, 0x10b981, VoxelMat.Emissive); // glowing Composto 09 vial
    v.set(14, 26, 10, 0x94a3b8, VoxelMat.Metal); // metal vial cap

    // Lab coat sleeves + latex nitrile lab gloves (teal-cyan)
    for (const [ax0, ax1] of [
      [2, 4],
      [17, 19],
    ] as const) {
      v.fillBeveledBox(ax0, 18, 5, ax1, 28, 8, 0xe2e8f0, VoxelMat.Fabric, 'top');
      v.fillBox(ax0, 14, 5, ax1, 17, 8, 0x0ea5e9, VoxelMat.Matte); // nitrile gloves
    }

    // Turtleneck collar & neck (y=28..30)
    v.fillBox(8, 28, 5, 13, 29, 8, 0x1e293b, VoxelMat.Fabric);
    v.fillBox(9, 29, 5, 12, 30, 8, 0xdfb294, VoxelMat.Matte);

    // Sculpted face (y=30..36)
    v.fillBeveledBox(7, 30, 4, 14, 36, 9, 0xe7bda0, VoxelMat.Matte, 'all');
    v.set(10, 32, 10, 0xf0c8ac, VoxelMat.Matte);
    v.set(11, 32, 10, 0xf0c8ac, VoxelMat.Matte);
    // Sharp eyes & dark rimmed lab glasses
    v.fillBox(8, 33, 10, 9, 34, 10, 0xbae6fd, VoxelMat.Glass);
    v.fillBox(12, 33, 10, 13, 34, 10, 0xbae6fd, VoxelMat.Glass);
    v.set(10, 34, 10, 0x334155, VoxelMat.Metal); // bridge
    v.set(11, 34, 10, 0x334155, VoxelMat.Metal);
    v.set(9, 33, 9, 0x0f172a, VoxelMat.Matte);
    v.set(12, 33, 9, 0x0f172a, VoxelMat.Matte);
    v.fillBox(10, 31, 9, 11, 31, 9, 0xb46969, VoxelMat.Matte);

    // Sculpted dark auburn hair + neat tied-back bun & safety goggles on forehead
    v.fillBeveledBox(7, 35, 3, 14, 37, 9, 0x5c241b, VoxelMat.Fabric, 'top');
    v.fillBox(7, 31, 3, 14, 35, 4, 0x4a1c15, VoxelMat.Fabric);
    v.fillBox(7, 32, 4, 7, 35, 7, 0x5c241b, VoxelMat.Fabric);
    v.fillBox(14, 32, 4, 14, 35, 7, 0x5c241b, VoxelMat.Fabric);
    // Hair bun at back of head
    v.fillBeveledBox(9, 32, 1, 12, 35, 3, 0x4a1c15, VoxelMat.Fabric, 'all');
    // Protective bio-safety goggles resting on hair crown
    v.fillBox(7, 35, 9, 14, 36, 10, 0x475569, VoxelMat.Metal);
    v.fillBox(8, 35, 10, 9, 36, 10, 0x38bdf8, VoxelMat.Glass);
    v.fillBox(12, 35, 10, 13, 36, 10, 0x38bdf8, VoxelMat.Glass);

    return v.build({ anchor: [11, 0, 7] }).geometry;
  });
  root.add(mesh);
  return root;
}

/**
 * 4. DIRETOR ARTUR NEVES (Diretor Executivo — Projeto Ômega / Setor 09)
 * Imposing dark charcoal double-breasted executive overcoat, crisp white collar,
 * crimson silk tie, gleaming gold Omega lapel insignia, silver-streaked slicked hair,
 * sharp metallic spectacles, stern commanding expression.
 */
export function createOmegaDirectorRig(_pack: MaterialPack): THREE.Group {
  const root = new THREE.Group();

  const mesh = createSculptedMesh('char_omega_director_v1', () => {
    const v = new VoxelSculptor(22, 38, 16, 0.047);

    // Executive dress shoes & charcoal suit trousers (y=0..15)
    for (const x0 of [6, 12]) {
      v.fillBeveledBox(x0, 0, 5, x0 + 3, 2, 10, 0x09090b, VoxelMat.Metal, 'top');
      v.fillBox(x0, 3, 5, x0 + 3, 15, 8, 0x18181b, VoxelMat.Fabric);
    }

    // Long executive overcoat tails (y=10..16)
    v.fillBox(5, 10, 4, 16, 16, 5, 0x14151a, VoxelMat.Fabric);
    v.fillBox(5, 10, 5, 7, 16, 8, 0x181a20, VoxelMat.Fabric);
    v.fillBox(14, 10, 5, 16, 16, 8, 0x181a20, VoxelMat.Fabric);

    // Broad double-breasted dark executive coat torso (y=17..28)
    v.fillBeveledBox(4, 17, 4, 17, 28, 9, 0x181a21, VoxelMat.Fabric, 'vertical');
    // Broad structured shoulder pads
    v.fillBox(4, 27, 4, 17, 28, 9, 0x20232d, VoxelMat.Fabric);
    // Double-breasted gold metallic buttons
    for (const by of [19, 21, 23]) {
      v.set(8, by, 9, 0xd4af37, VoxelMat.Metal);
      v.set(13, by, 9, 0xd4af37, VoxelMat.Metal);
    }
    // Crisp white dress shirt V-neck & deep crimson silk tie
    v.fillBox(9, 23, 9, 12, 28, 9, 0xe5e7eb, VoxelMat.Fabric);
    v.fillBox(10, 22, 10, 11, 27, 10, 0x991b1b, VoxelMat.Fabric); // crimson tie
    v.set(10, 27, 10, 0xdc2626, VoxelMat.Fabric); // tie knot highlight
    // Gleaming Gold Omega Lapel Pin (left lapel)
    v.fillBox(14, 25, 9, 15, 26, 10, 0xf59e0b, VoxelMat.Metal);
    v.set(14, 26, 10, 0xfef08a, VoxelMat.Emissive); // subtle gold-amber glint
    // High executive upturned collar
    v.fillBox(7, 28, 4, 14, 30, 6, 0x181a21, VoxelMat.Fabric);

    // Coat sleeves + white dress cuffs + leather gloves
    for (const [ax0, ax1] of [
      [1, 3],
      [18, 20],
    ] as const) {
      v.fillBeveledBox(ax0, 18, 5, ax1, 28, 8, 0x181a21, VoxelMat.Fabric, 'top');
      v.fillBox(ax0, 17, 5, ax1, 17, 8, 0xe5e7eb, VoxelMat.Fabric); // crisp cuff
      v.set(ax0 === 1 ? ax0 : ax1, 17, 7, 0xd4af37, VoxelMat.Metal); // gold cufflink
      v.fillBox(ax0, 14, 5, ax1, 16, 8, 0x111216, VoxelMat.Fabric); // black leather gloves
    }

    // Neck (y=28..30)
    v.fillBox(9, 28, 5, 12, 30, 8, 0xc79b7e, VoxelMat.Matte);

    // Stern angular micro-voxel face (y=30..36)
    v.fillBeveledBox(7, 30, 4, 14, 36, 9, 0xd2a78a, VoxelMat.Matte, 'all');
    // Sharp cheekbones & nose
    v.set(10, 32, 10, 0xdcb396, VoxelMat.Matte);
    v.set(11, 32, 10, 0xdcb396, VoxelMat.Matte);
    // Silver trimmed goatee/chin line & stern mouth
    v.fillBox(10, 30, 9, 11, 30, 9, 0x9ca3af, VoxelMat.Fabric);
    v.fillBox(9, 31, 9, 12, 31, 9, 0x7c5340, VoxelMat.Matte);
    // Silver-gray eyebrows & piercing eyes behind thin metallic spectacles
    v.fillBox(8, 34, 9, 9, 34, 9, 0x9ca3af, VoxelMat.Fabric);
    v.fillBox(12, 34, 9, 13, 34, 9, 0x9ca3af, VoxelMat.Fabric);
    v.set(9, 33, 9, 0x0f172a, VoxelMat.Matte);
    v.set(12, 33, 9, 0x0f172a, VoxelMat.Matte);
    // Metallic-rimmed glasses catching light
    v.fillBox(8, 33, 10, 9, 33, 10, 0xd4af37, VoxelMat.Metal);
    v.fillBox(12, 33, 10, 13, 33, 10, 0xd4af37, VoxelMat.Metal);
    v.fillBox(10, 33, 10, 11, 33, 10, 0xd4af37, VoxelMat.Metal);

    // Slicked-back silver-streaked hair (y=34..37)
    v.fillBeveledBox(7, 35, 3, 14, 37, 9, 0x4b5563, VoxelMat.Fabric, 'top');
    v.fillBox(7, 31, 3, 14, 35, 4, 0x374151, VoxelMat.Fabric);
    v.fillBox(7, 33, 4, 7, 35, 8, 0x9ca3af, VoxelMat.Fabric); // silver temples L
    v.fillBox(14, 33, 4, 14, 35, 8, 0x9ca3af, VoxelMat.Fabric); // silver temples R
    v.fillBox(9, 36, 8, 12, 37, 9, 0xd1d5db, VoxelMat.Fabric); // silver crest

    return v.build({ anchor: [11, 0, 7] }).geometry;
  });
  root.add(mesh);
  return root;
}
