import * as THREE from 'three';
import type {
  ArgCluePlacement,
  CassetteTapeDefinition,
  DiddyAnimState,
  DiddySkinId,
  DoorDefinition,
  BunkerCameraDefinition,
  FurniturePropDefinition,
  GloveSkinId,
  HidingSpotDefinition,
  ItemType,
  NoisePropDefinition,
  RechargeStationDefinition,
  SafeDefinition,
  TutorialPlaqueDefinition,
  UvMarkDefinition,
  WorkbenchDefinition,
  WorldItemSpawn,
  WorldPickupType,
} from './types';
import { getGloveCosmetic } from './saveSystem';
import {
  createUvMarkTexture,
  type MaterialPack,
} from './textures';
import {
  createSculptedCassetteRecorderVisual,
  createSculptedItemModel,
  createSculptedNoisePropVisual,
} from './sculptedItems';
import {
  createSculptedAnimatedFanVisual,
  createSculptedCctvSecretSignVisual,
  createSculptedCluePlaqueVisual,
  createSculptedCourtyardPillarVisual,
  createSculptedDirtyGlassWindowVisual,
  createSculptedDoorVisual,
  createSculptedBunkerDoorButtonVisual,
  createSculptedHidingSpotVisual,
  createSculptedRechargeStationVisual,
  createSculptedSafeVisual,
  createSculptedSecurityCameraVisual,
  createSculptedServerRackVisual,
  createSculptedSwayingTarpVisual,
  createSculptedTutorialPlaqueVisual,
  createSculptedWallClockVisual,
  createSculptedWallLightSwitchVisual,
  createSculptedWorkbenchVisual,
} from './sculptedArchitecture';
import { createSculptedFurnitureVisual } from './sculptedFurniture';
import { createSculptedMesh, VoxelMat, VoxelSculptor } from './voxelSculptor';
import {
  createOmegaDirectorRig,
  createOmegaScientistRig,
  createSculptedSurvivorCharacterRig,
  createVigiaMarcosRig,
} from './characterModels';

export { createOmegaDirectorRig, createOmegaScientistRig, createVigiaMarcosRig };

/**
 * Clean Blocky Voxel 11-Pivot Hierarchical Articulated Rig for P. Diddy.
 * Built strictly from crisp voxel boxes + NearestFilter pixel-art textures (authentic Craft horror style).
 */
export interface DiddyArticulatedRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  keyring: THREE.Group;
  shoulderL: THREE.Group;
  upperArmL: THREE.Group;
  forearmL: THREE.Group;
  shoulderR: THREE.Group;
  upperArmR: THREE.Group;
  forearmR: THREE.Group;
  hipL: THREE.Group;
  thighL: THREE.Group;
  shinL: THREE.Group;
  hipR: THREE.Group;
  thighR: THREE.Group;
  shinR: THREE.Group;
  eyeLeftMat: THREE.MeshStandardMaterial;
  eyeRightMat: THREE.MeshStandardMaterial;
  pulseMats?: THREE.MeshStandardMaterial[];
  animTime: number;
  currentBlendState: DiddyAnimState;
}

function damp(cur: number, target: number, lambda: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}

export function createDiddyArticulatedRig(
  pack: MaterialPack,
  skinId: DiddySkinId = 'classic_s09'
): DiddyArticulatedRig {
  const root = new THREE.Group();
  const isUnstable = skinId === 'unstable_exp';
  const isArmored = skinId === 'armored_proto';
  const pulseMats: THREE.MeshStandardMaterial[] = [];

  // Crisp blocky voxel contact shadow
  const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: pack.contactShadowTex,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.018;
  root.add(shadowMesh);

  // Clean Craft Voxel Materials (classic_s09 stays 100% identical to Phase 1)
  const coatMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0x0c1916 : isArmored ? 0x1c222e : 0x151720,
    roughness: isArmored ? 0.62 : 0.86,
    metalness: isArmored ? 0.24 : 0.04,
  });
  const lapelMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0x132a24 : isArmored ? 0x2d3748 : 0x252838,
    roughness: isArmored ? 0.48 : 0.68,
    metalness: isArmored ? 0.35 : 0.1,
  });
  const suitFrontMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0xc8f5e5 : isArmored ? 0xdbe4ef : 0xffffff,
    map: pack.diddySuitTex,
    roughness: 0.78,
    metalness: 0.06,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0x574838 : 0x6b432d,
    roughness: 0.76,
    metalness: 0.02,
  });
  const faceFrontMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0xdbfce7 : 0xffffff,
    map: pack.diddyFaceTex,
    roughness: 0.74,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x141114,
    roughness: 0.92,
    metalness: 0.02,
  });
  const glassesMat = new THREE.MeshStandardMaterial({
    color: 0x0a0b10,
    roughness: 0.14,
    metalness: 0.45,
    envMapIntensity: 1.15,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0x34d399 : isArmored ? 0x94a3b8 : 0xf5c542,
    roughness: 0.22,
    metalness: 1.0,
    envMapIntensity: 1.1,
    emissive: isUnstable ? 0x065f46 : isArmored ? 0x1e293b : 0x3b2804,
    emissiveIntensity: isUnstable ? 0.45 : 0.24,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: 0xe2ddd4,
    roughness: 0.84,
    metalness: 0.02,
  });
  const gloveMat = new THREE.MeshStandardMaterial({
    color: isArmored ? 0x1e2430 : 0x16171d,
    roughness: 0.48,
    metalness: isArmored ? 0.35 : 0.12,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0x0a1412 : isArmored ? 0x171c26 : 0x13151d,
    roughness: 0.88,
    metalness: 0.04,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c10,
    roughness: 0.34,
    metalness: 0.16,
  });

  // Glowing voxel pixel eyes visible in the dark
  const eyeColorHex = isUnstable ? 0x34d399 : isArmored ? 0xf97316 : 0xff3b2f;
  const eyeEmissiveHex = isUnstable ? 0x10b981 : isArmored ? 0xea580c : 0xff241a;
  const eyeLeftMat = new THREE.MeshStandardMaterial({
    color: eyeColorHex,
    emissive: eyeEmissiveHex,
    emissiveIntensity: 1.7,
    roughness: 0.2,
  });
  const eyeRightMat = new THREE.MeshStandardMaterial({
    color: eyeColorHex,
    emissive: eyeEmissiveHex,
    emissiveIntensity: 1.7,
    roughness: 0.2,
  });

  // Pelvis root (~2.05m tall proportional Craft silhouette)
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.96, 0);
  root.add(pelvis);

  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.26), coatMat);
  pelvis.add(pelvisMesh);

  // Voxel overcoat tails
  const coatTailBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.06), coatMat);
  coatTailBack.position.set(0, -0.22, -0.11);
  pelvis.add(coatTailBack);

  const coatTailL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.24), coatMat);
  coatTailL.position.set(-0.18, -0.2, 0);
  pelvis.add(coatTailL);

  const coatTailR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.24), coatMat);
  coatTailR.position.set(0.18, -0.2, 0);
  pelvis.add(coatTailR);

  // Torso (clean Craft 8x12x4 voxel proportions with pixel-art suit front + 3D voxel gold chain)
  const torso = new THREE.Group();
  torso.position.set(0, 0.09, 0);
  pelvis.add(torso);

  const torsoMats = [coatMat, coatMat, coatMat, coatMat, suitFrontMat, coatMat];
  // Broad imposing foreman shoulders (visually explains why P. Drizzy cannot fit in vents!)
  const chestMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.65, 0.3), torsoMats);
  chestMesh.position.set(0, 0.325, 0);
  chestMesh.castShadow = true;
  torso.add(chestMesh);

  // Glossy black-green Composto 09 serum stains & industrial shoulder pads
  const oozeMat = new THREE.MeshStandardMaterial({
    color: 0x064e3b,
    emissive: 0x15803d,
    emissiveIntensity: 0.55,
    roughness: 0.14,
    metalness: 0.28,
  });
  const oilPatch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.315), oozeMat);
  oilPatch.position.set(0.16, 0.42, 0.005);
  torso.add(oilPatch);

  for (const sx of [-0.31, 0.31]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.32), lapelMat);
    pad.position.set(sx, 0.63, 0);
    torso.add(pad);
  }

  // Raised blocky voxel collar & heavy brass belt buckle
  const collarBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.07), lapelMat);
  collarBack.position.set(0, 0.66, -0.12);
  torso.add(collarBack);

  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.075, 0.045), goldMat);
  beltBuckle.position.set(0, 0.04, 0.158);
  torso.add(beltBuckle);

  // Signature P. Drizzy dangling metallic belt chain & heavy Setor 09 foreman keyring (True PBR metalness=1.0!)
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4ef,
    roughness: 0.18,
    metalness: 1.0,
    envMapIntensity: 1.15,
  });
  const keyring = new THREE.Group();
  keyring.position.set(0.28, 0.02, 0.11);
  torso.add(keyring);
  for (let i = 0; i < 3; i++) {
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.055, 0.032), steelMat);
    link.position.set(0, -0.04 - i * 0.05, 0);
    keyring.add(link);
  }
  const ringLoop = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.024), goldMat);
  ringLoop.position.set(0, -0.2, 0);
  keyring.add(ringLoop);
  for (const kx of [-0.022, 0.022]) {
    const keyBlade = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.09, 0.018), steelMat);
    keyBlade.position.set(kx, -0.27, 0.008);
    keyBlade.rotation.z = kx * 6;
    keyring.add(keyBlade);
  }

  // Heavy industrial steel neck chain + Setor 09 Foreman tag
  const chainL = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.21, 0.034), steelMat);
  chainL.position.set(-0.08, 0.49, 0.162);
  torso.add(chainL);
  const chainR = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.21, 0.034), steelMat);
  chainR.position.set(0.08, 0.49, 0.162);
  torso.add(chainR);
  const chainBot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.034, 0.034), steelMat);
  chainBot.position.set(0, 0.39, 0.162);
  torso.add(chainBot);
  const medallion = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.04), goldMat);
  medallion.position.set(0, 0.32, 0.168);
  torso.add(medallion);
  // Additive close-up refinement: notched suit lapels + gold medallion bezel rim
  for (const lx of [-0.145, 0.145]) {
    const lapelStrip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.32, 0.028), lapelMat);
    lapelStrip.position.set(lx, 0.48, 0.156);
    lapelStrip.rotation.z = lx < 0 ? -0.14 : 0.14;
    torso.add(lapelStrip);
  }
  const medallionCore = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.062, 0.048), coatMat);
  medallionCore.position.set(0, 0.32, 0.17);
  torso.add(medallionCore);
  const medallionPin = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.028, 0.054), goldMat);
  medallionPin.position.set(0, 0.32, 0.172);
  torso.add(medallionPin);

  // Neck & Classic Crisp 8x8x8 Cube Voxel Head + Articulated Voxel Jaw
  const neck = new THREE.Group();
  neck.position.set(0, 0.65, 0);
  torso.add(neck);

  const neckBlock = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.08, 0.19), skinMat);
  neckBlock.position.y = 0.03;
  neck.add(neckBlock);

  const head = new THREE.Group();
  head.position.set(0, 0.06, 0);
  neck.add(head);

  const headMats = [skinMat, skinMat, hairMat, skinMat, faceFrontMat, hairMat];
  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), headMats);
  cranium.position.y = 0.22;
  cranium.castShadow = true;
  head.add(cranium);

  // Crisp blocky voxel hair cap
  const hairCap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.09, 0.44), hairMat);
  hairCap.position.set(0, 0.41, 0);
  head.add(hairCap);

  // 3D Cracked Dark Sunglasses Frame + Temple Arms + Metallic Bridge Rivet + Glowing Crimson Eyes
  const shadesBridge = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.095, 0.055), glassesMat);
  shadesBridge.position.set(0, 0.24, 0.215);
  head.add(shadesBridge);
  const bridgeRivet = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.026, 0.064), goldMat);
  bridgeRivet.position.set(0, 0.268, 0.218);
  head.add(bridgeRivet);
  for (const tx of [-0.222, 0.222]) {
    const templeArm = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.036, 0.34), glassesMat);
    templeArm.position.set(tx, 0.255, 0.06);
    head.add(templeArm);
  }
  const lensCrack = new THREE.Mesh(
    new THREE.BoxGeometry(0.014, 0.078, 0.016),
    new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
  );
  lensCrack.position.set(-0.11, 0.24, 0.244);
  lensCrack.rotation.z = 0.42;
  head.add(lensCrack);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.05, 0.03), eyeLeftMat);
  eyeL.position.set(-0.095, 0.24, 0.238);
  head.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.05, 0.03), eyeRightMat);
  eyeR.position.set(0.095, 0.24, 0.238);
  head.add(eyeR);

  // Subtle Additive Fake-Bloom Eye Halo Sprites so P. Drizzy's glowing eyes pierce the darkness cleanly on ALL tiers!
  const eyeHaloMat = new THREE.SpriteMaterial({
    map: pack.glowHaloTex,
    color: isUnstable ? 0x10b981 : isArmored ? 0xf97316 : 0xff3a1a,
    transparent: true,
    opacity: 0.68,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const ex of [-0.095, 0.095]) {
    const halo = new THREE.Sprite(eyeHaloMat);
    halo.position.set(ex, 0.24, 0.258);
    halo.scale.set(0.25, 0.25, 1);
    head.add(halo);
  }

  // Subtle cold moonlight Rim-Light silhouette strips on shoulders & head crest
  const rimMat = new THREE.MeshStandardMaterial({
    color: isUnstable ? 0x10b981 : isArmored ? 0x94a3b8 : 0x3b4d78,
    emissive: isUnstable ? 0x10b981 : isArmored ? 0x64748b : 0x3b5998,
    emissiveIntensity: isUnstable ? 0.65 : 0.34,
    roughness: 0.65,
  });
  const rimHead = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.025, 0.45), rimMat);
  rimHead.position.set(0, 0.455, 0);
  head.add(rimHead);
  const rimShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.025, 0.31), rimMat);
  rimShoulder.position.set(0, 0.67, 0);
  torso.add(rimShoulder);

  // Articulated Voxel Jaw for menacing jumpscare roar
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.08, 0.05);
  head.add(jaw);

  const jawBlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 0.26), hairMat);
  jawBlock.position.set(0, -0.025, 0.06);
  jaw.add(jawBlock);

  const teethBlock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.028, 0.03), shirtMat);
  teethBlock.position.set(0, 0.02, 0.18);
  jaw.add(teethBlock);

  // Pure Voxel Blocky Arms (Shoulder -> UpperArm -> Forearm + White Cuff + Gloved Voxel Hand)
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.36, 0.56, 0);
    torso.add(shoulder);

    const upperArm = new THREE.Group();
    shoulder.add(upperArm);
    const upperMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.34, 0.2), coatMat);
    upperMesh.position.y = -0.15;
    upperMesh.castShadow = true;
    upperArm.add(upperMesh);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.32, 0);
    upperArm.add(forearm);
    const foreMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.18), coatMat);
    foreMesh.position.y = -0.14;
    forearm.add(foreMesh);

    const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.045, 0.185), shirtMat);
    cuff.position.y = -0.28;
    forearm.add(cuff);

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.16), gloveMat);
    hand.position.y = -0.36;
    forearm.add(hand);

    return { shoulder, upperArm, forearm };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Pure Voxel Blocky Legs (Hip -> Thigh -> Shin + Voxel Shoe)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.135, -0.06, 0);
    pelvis.add(hip);

    const thigh = new THREE.Group();
    hip.add(thigh);
    const thighMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.22), pantsMat);
    thighMesh.position.y = -0.22;
    thighMesh.castShadow = true;
    thigh.add(thighMesh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.44, 0);
    thigh.add(shin);
    const shinMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), pantsMat);
    shinMesh.position.y = -0.2;
    shin.add(shinMesh);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.11, 0.3), shoeMat);
    shoe.position.set(0, -0.41, 0.045);
    shin.add(shoe);

    return { hip, thigh, shin };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Skin-specific additive 3D geometry (classic_s09 remains 100% untouched)
  if (isUnstable) {
    const veinMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 1.9,
      roughness: 0.18,
      metalness: 0.15,
    });
    const veinCoreMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      emissive: 0x34d399,
      emissiveIntensity: 2.3,
      roughness: 0.12,
      metalness: 0.1,
    });
    pulseMats.push(veinMat, veinCoreMat);

    // Pulsing Composto 09 veins across torso chest & spine
    const chestVeinA = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.42, 0.025), veinMat);
    chestVeinA.position.set(-0.14, 0.36, 0.158);
    chestVeinA.rotation.z = -0.34;
    torso.add(chestVeinA);

    const chestVeinB = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.46, 0.026), veinCoreMat);
    chestVeinB.position.set(0.11, 0.34, 0.16);
    chestVeinB.rotation.z = 0.28;
    torso.add(chestVeinB);

    const chestVeinCross = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.032, 0.024), veinMat);
    chestVeinCross.position.set(0.0, 0.26, 0.159);
    chestVeinCross.rotation.z = -0.14;
    torso.add(chestVeinCross);

    const spineVein = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.028), veinCoreMat);
    spineVein.position.set(0, 0.34, -0.156);
    torso.add(spineVein);

    // Pulsing veins along arms & forearms
    for (const arm of [leftArm, rightArm]) {
      const upperVein = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.214), veinMat);
      upperVein.position.set(0, -0.15, 0);
      upperVein.rotation.z = 0.18;
      arm.upperArm.add(upperVein);

      const foreVein = new THREE.Mesh(new THREE.BoxGeometry(0.194, 0.2, 0.03), veinCoreMat);
      foreVein.position.set(0, -0.14, 0);
      foreVein.rotation.y = 0.2;
      arm.forearm.add(foreVein);
    }

    // Glowing temple & forehead fracture veins on head
    for (const hx of [-0.216, 0.216]) {
      const templeVein = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.22, 0.036), veinCoreMat);
      templeVein.position.set(hx, 0.25, 0.08);
      templeVein.rotation.x = 0.32;
      head.add(templeVein);
    }
    const browVein = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.028, 0.026), veinMat);
    browVein.position.set(0.04, 0.34, 0.214);
    browVein.rotation.z = -0.18;
    head.add(browVein);
  } else if (isArmored) {
    const armorSteelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.26,
      metalness: 0.92,
      envMapIntensity: 1.2,
    });
    const armorDarkMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.38,
      metalness: 0.82,
      envMapIntensity: 1.0,
    });
    const visorGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xdc2626,
      emissiveIntensity: 2.0,
      roughness: 0.14,
      metalness: 0.35,
    });

    // Ballistic steel chest containment plate & back harness
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.42, 0.06), armorSteelMat);
    chestPlate.position.set(0, 0.39, 0.165);
    torso.add(chestPlate);

    const chestCenterPlate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.075), armorDarkMat);
    chestCenterPlate.position.set(0, 0.41, 0.172);
    torso.add(chestCenterPlate);

    const chestIndicator = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.082), visorGlowMat);
    chestIndicator.position.set(0, 0.46, 0.175);
    torso.add(chestIndicator);

    const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.44, 0.055), armorDarkMat);
    backPlate.position.set(0, 0.38, -0.165);
    torso.add(backPlate);

    // Layered ballistic shoulder pauldrons
    for (const sx of [-0.36, 0.36]) {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.15, 0.34), armorSteelMat);
      pauldron.position.set(sx, 0.62, 0);
      pauldron.rotation.z = sx < 0 ? 0.22 : -0.22;
      torso.add(pauldron);

      const pauldronTrim = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.35), armorDarkMat);
      pauldronTrim.position.set(sx, 0.56, 0);
      pauldronTrim.rotation.z = sx < 0 ? 0.22 : -0.22;
      torso.add(pauldronTrim);
    }

    // Forearm containment vambraces
    for (const arm of [leftArm, rightArm]) {
      const vambrace = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.22, 0.21), armorDarkMat);
      vambrace.position.set(0, -0.13, 0);
      arm.forearm.add(vambrace);
    }

    // Tactical amber-crimson visor frame over face & brow
    const visorFrameTop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.14), armorSteelMat);
    visorFrameTop.position.set(0, 0.32, 0.205);
    head.add(visorFrameTop);

    const visorFrameBot = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.045, 0.12), armorDarkMat);
    visorFrameBot.position.set(0, 0.18, 0.205);
    head.add(visorFrameBot);

    const visorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.068, 0.045), visorGlowMat);
    visorStrip.position.set(0, 0.248, 0.248);
    head.add(visorStrip);

    for (const vx of [-0.23, 0.23]) {
      const visorMount = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.28), armorSteelMat);
      visorMount.position.set(vx, 0.25, 0.1);
      head.add(visorMount);
    }
  }

  return {
    root,
    pelvis,
    torso,
    neck,
    head,
    jaw,
    keyring,
    shoulderL: leftArm.shoulder,
    upperArmL: leftArm.upperArm,
    forearmL: leftArm.forearm,
    shoulderR: rightArm.shoulder,
    upperArmR: rightArm.upperArm,
    forearmR: rightArm.forearm,
    hipL: leftLeg.hip,
    thighL: leftLeg.thigh,
    shinL: leftLeg.shin,
    hipR: rightLeg.hip,
    thighR: rightLeg.thigh,
    shinR: rightLeg.shin,
    eyeLeftMat,
    eyeRightMat,
    ...(pulseMats.length > 0 ? { pulseMats } : {}),
    animTime: 0,
    currentBlendState: 'idle',
  };
}

/**
 * High-Density Sculpted Micro-Voxel Survivor Model used in Intro & Ending Cutscenes
 * (layered tactical windbreaker jacket, utility backpack with straps, cargo pants, laced boots & face).
 */
export function createVoxelSurvivorRig(pack: MaterialPack): THREE.Group {
  return createSculptedSurvivorCharacterRig(pack);
}

/**
 * Smooth hierarchical procedural animation blender across all states.
 */
export function updateDiddyRigAnimation(
  rig: DiddyArticulatedRig,
  state: DiddyAnimState,
  dt: number
): void {
  rig.currentBlendState = state;
  const speedMult =
    state === 'chase'
      ? 11.2
      : state === 'jumpscare'
      ? 18.0
      : state === 'breach_door'
      ? 9.0
      : state === 'patrol'
      ? 5.0
      : 2.6;
  rig.animTime += dt * speedMult;
  const t = rig.animTime;
  const blend = state === 'jumpscare' ? 24 : 11;

  let pelvisY = 0.96;
  let pelvisRoll = 0;
  let torsoPitch = 0;
  let torsoYaw = 0;
  let headYaw = 0;
  let headPitch = 0;
  let headRoll = 0;
  let jawPitch = 0;
  let keyringSwing = 0;

  let armLPitch = 0;
  let armLRoll = 0.08;
  let foreLPitch = -0.14;
  let armRPitch = 0;
  let armRRoll = -0.08;
  let foreRPitch = -0.14;

  let thighLPitch = 0;
  let shinLPitch = 0;
  let thighRPitch = 0;
  let shinRPitch = 0;
  let eyeGlow = 1.5;

  if (state === 'patrol') {
    const s = Math.sin(t);
    const c = Math.cos(t);
    pelvisY = 0.96 + Math.abs(s) * 0.045;
    pelvisRoll = s * 0.055;
    torsoPitch = 0.09;
    torsoYaw = -s * 0.085;
    headYaw = Math.sin(t * 0.35) * 0.26;
    headPitch = 0.04;
    keyringSwing = s * 0.32;
    armLPitch = -s * 0.4;
    foreLPitch = -0.22 - Math.max(0, -s) * 0.16;
    armRPitch = s * 0.4;
    foreRPitch = -0.22 - Math.max(0, s) * 0.16;
    thighLPitch = s * 0.46;
    shinLPitch = Math.max(0, -c) * 0.5;
    thighRPitch = -s * 0.46;
    shinRPitch = Math.max(0, c) * 0.5;
    eyeGlow = 1.65;
  } else if (state === 'chase') {
    const s = Math.sin(t);
    const c = Math.cos(t);
    pelvisY = 0.9 + Math.abs(s) * 0.08;
    pelvisRoll = s * 0.085;
    torsoPitch = 0.4; // Aggressive forward-leaning hunter sprint
    torsoYaw = -s * 0.18;
    headPitch = -0.26;
    headYaw = s * 0.06;
    headRoll = s * 0.05;
    jawPitch = 0.18 + Math.abs(s) * 0.09;
    keyringSwing = s * 0.65;
    armLPitch = -0.52 - s * 0.94;
    foreLPitch = -0.78 - Math.max(0, -s) * 0.36;
    armRPitch = -0.52 + s * 0.94;
    foreRPitch = -0.78 - Math.max(0, s) * 0.36;
    thighLPitch = s * 0.86;
    shinLPitch = Math.max(0, -c) * 0.92;
    thighRPitch = -s * 0.86;
    shinRPitch = Math.max(0, c) * 0.92;
    eyeGlow = 3.4;
  } else if (state === 'investigate') {
    // Eerie attentive head-tilt pause when hearing a noise!
    const scan = Math.sin(t * 0.6);
    pelvisY = 0.96 + Math.sin(t * 1.1) * 0.015;
    torsoPitch = 0.08;
    torsoYaw = scan * 0.22;
    headYaw = scan * 0.68;
    headPitch = 0.05;
    headRoll = 0.24 * Math.cos(t * 0.45);
    keyringSwing = Math.sin(t * 1.4) * 0.12;
    armLPitch = -0.15;
    foreLPitch = -0.4;
    armRPitch = -0.18;
    foreRPitch = -0.38;
    eyeGlow = 2.4;
  } else if (state === 'breach_door') {
    const slam = Math.sin(t * 1.1);
    torsoPitch = 0.18;
    torsoYaw = -0.28;
    armRPitch = -1.3 + slam * 0.5;
    foreRPitch = -0.32;
    armLPitch = 0.22;
    foreLPitch = -0.28;
    keyringSwing = slam * 0.55;
    eyeGlow = 2.9;
  } else if (state === 'search_hiding') {
    const s = Math.sin(t);
    pelvisY = 0.94 + Math.abs(s) * 0.045;
    torsoPitch = 0.26;
    headPitch = -0.1;
    headRoll = 0.14;
    armLPitch = -0.92 + s * 0.18;
    foreLPitch = -0.32;
    armRPitch = -0.92 - s * 0.18;
    foreRPitch = -0.32;
    thighLPitch = s * 0.58;
    thighRPitch = -s * 0.58;
    eyeGlow = 3.5;
  } else if (state === 'stunned') {
    const wobble = Math.sin(t * 1.4);
    pelvisY = 0.9;
    torsoPitch = -0.12;
    torsoYaw = wobble * 0.24;
    headYaw = -wobble * 0.42;
    headPitch = -0.24;
    headRoll = wobble * 0.2;
    armLPitch = -1.55;
    armLRoll = -0.22;
    foreLPitch = -1.0;
    armRPitch = -1.55;
    armRRoll = 0.22;
    foreRPitch = -1.0;
    eyeGlow = 0.6;
  } else if (state === 'jumpscare') {
    const shake = Math.sin(t * 2.2);
    pelvisY = 0.98 + Math.sin(t * 1.5) * 0.035;
    torsoPitch = 0.18;
    headPitch = -0.05 + shake * 0.08;
    headYaw = shake * 0.16;
    headRoll = shake * 0.14;
    jawPitch = 0.46 + Math.abs(shake) * 0.16;
    armLPitch = -1.52 + shake * 0.22;
    armLRoll = 0.22;
    foreLPitch = -0.38;
    armRPitch = -1.52 - shake * 0.22;
    armRRoll = -0.22;
    foreRPitch = -0.38;
    keyringSwing = shake * 0.7;
    eyeGlow = 5.4;
  } else {
    const breath = Math.sin(t * 0.8);
    pelvisY = 0.96 + breath * 0.015;
    torsoPitch = 0.03 + breath * 0.02;
    armLPitch = 0.04;
    armRPitch = 0.04;
    eyeGlow = 1.35;
  }

  rig.pelvis.position.y = damp(rig.pelvis.position.y, pelvisY, blend, dt);
  rig.pelvis.rotation.z = damp(rig.pelvis.rotation.z, pelvisRoll, blend, dt);
  rig.torso.rotation.x = damp(rig.torso.rotation.x, torsoPitch, blend, dt);
  rig.torso.rotation.y = damp(rig.torso.rotation.y, torsoYaw, blend, dt);
  rig.neck.rotation.y = damp(rig.neck.rotation.y, headYaw, blend, dt);
  rig.head.rotation.x = damp(rig.head.rotation.x, headPitch, blend, dt);
  rig.head.rotation.z = damp(rig.head.rotation.z, headRoll, blend, dt);
  rig.jaw.rotation.x = damp(rig.jaw.rotation.x, jawPitch, blend * 1.4, dt);
  rig.keyring.rotation.z = damp(rig.keyring.rotation.z, keyringSwing, blend, dt);

  rig.upperArmL.rotation.x = damp(rig.upperArmL.rotation.x, armLPitch, blend, dt);
  rig.shoulderL.rotation.z = damp(rig.shoulderL.rotation.z, armLRoll, blend, dt);
  rig.forearmL.rotation.x = damp(rig.forearmL.rotation.x, foreLPitch, blend, dt);

  rig.upperArmR.rotation.x = damp(rig.upperArmR.rotation.x, armRPitch, blend, dt);
  rig.shoulderR.rotation.z = damp(rig.shoulderR.rotation.z, armRRoll, blend, dt);
  rig.forearmR.rotation.x = damp(rig.forearmR.rotation.x, foreRPitch, blend, dt);

  rig.thighL.rotation.x = damp(rig.thighL.rotation.x, thighLPitch, blend, dt);
  rig.shinL.rotation.x = damp(rig.shinL.rotation.x, shinLPitch, blend, dt);
  rig.thighR.rotation.x = damp(rig.thighR.rotation.x, thighRPitch, blend, dt);
  rig.shinR.rotation.x = damp(rig.shinR.rotation.x, shinRPitch, blend, dt);

  rig.eyeLeftMat.emissiveIntensity = damp(rig.eyeLeftMat.emissiveIntensity, eyeGlow, 10, dt);
  rig.eyeRightMat.emissiveIntensity = rig.eyeLeftMat.emissiveIntensity;

  if (rig.pulseMats && rig.pulseMats.length > 0) {
    const wave = 0.5 + 0.5 * Math.sin(rig.animTime * 0.85);
    const stateScale =
      state === 'jumpscare'
        ? 2.2
        : state === 'chase'
        ? 1.65
        : state === 'stunned'
        ? 0.45
        : 1.0;
    const targetEmissive = (1.15 + wave * 1.45) * stateScale;
    for (let i = 0; i < rig.pulseMats.length; i++) {
      const m = rig.pulseMats[i];
      const offsetMult = i % 2 === 0 ? 1.0 : 1.25;
      m.emissiveIntensity = damp(m.emissiveIntensity, targetEmissive * offsetMult, 8, dt);
    }
  }
}

export interface DoorVisual {
  def: DoorDefinition;
  group: THREE.Group;
  leafPivot: THREE.Group;
  blastPanel: THREE.Group | null;
  plankGroup: THREE.Group | null;
  padlockMesh: THREE.Mesh | null;
  ledMesh: THREE.Mesh | null;
  doorHeight: number;
}

/**
 * High-density Micro-Voxel Sculpted Door Builder:
 * Double stepped jambs, pinned hinges, lever handles, key escutcheons, barred cracked viewports,
 * nail-splintered planks, brass padlocks, and corrugated Cabine 09-A vertical blast doors.
 */
export function createDoorVisual(def: DoorDefinition, pack: MaterialPack, cellSize: number): DoorVisual {
  return createSculptedDoorVisual(def, pack, cellSize);
}

export interface HidingSpotVisual {
  def: HidingSpotDefinition;
  group: THREE.Group;
  doorPivot: THREE.Group | null;
}

export function createHidingSpotVisual(def: HidingSpotDefinition, pack: MaterialPack): HidingSpotVisual {
  return createSculptedHidingSpotVisual(def, pack);
}

/**
 * High-Density Micro-Voxel Sculpted 3D Model Builder for ALL Collectible & Equippable Items.
 * Uses discrete 3D VoxelSculptor grids with Greedy Meshing, Hidden Face Culling & Baked Vertex AO.
 * Pass `standalone = true` for camera-mounted 1st-person viewmodel tools so they are never disposed by world rebuilds.
 */
export function createVoxelItemModel(itemType: WorldPickupType, standalone = false): THREE.Group {
  return createSculptedItemModel(itemType, standalone);
}

export function createItemPickupMesh(
  item: WorldItemSpawn,
  contactShadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(item.x, item.y, item.z);

  // Only add a crisp flush contact shadow for tabletop/floor items (nested drawer items sit inside wood)
  if (!item.drawerId) {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.38),
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.095;
    group.add(shadow);
  }

  const voxelModel = createVoxelItemModel(item.itemType, false);
  voxelModel.scale.multiplyScalar(item.drawerId ? 0.88 : 1.04);
  if (item.drawerId) {
    // Lay keys/tools flat inside hollow drawer so they fit naturally inside the tray
    if (
      item.itemType === 'red_key' ||
      item.itemType === 'blue_key' ||
      item.itemType === 'basement_key' ||
      item.itemType === 'master_key' ||
      item.itemType === 'crowbar_rod' ||
      item.itemType === 'crowbar_hook' ||
      item.itemType === 'wire_cutters'
    ) {
      voxelModel.rotation.x = Math.PI / 2;
      voxelModel.rotation.z = 0.32;
    } else if (item.itemType === 'battery' || item.itemType === 'flare') {
      voxelModel.rotation.z = Math.PI / 2;
      voxelModel.rotation.y = 0.25;
    }
  }
  group.add(voxelModel);

  return group;
}

export interface HeldItemViewmodelRig {
  root: THREE.Group;
  handGroup: THREE.Group;
  itemAnchor: THREE.Group;
  models: Record<ItemType, THREE.Group>;
  activeItem: ItemType;
  setActiveItem: (item: ItemType) => void;
  setUvMode: (uvOn: boolean) => void;
  setGloveSkin: (gloveSkinId: GloveSkinId) => void;
  setFlashlightColor: (lensHex: number) => void;
}

function darkenHex(hex: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

function buildSculptedArmHandMesh(gloveSkinId: GloveSkinId): THREE.Mesh {
  const cosmetic = getGloveCosmetic(gloveSkinId);
  const sleeveCreaseHex =
    gloveSkinId === 'urban_default' ? 0x223d66 : darkenHex(cosmetic.sleeveHex, 0.78);
  const knuckleMat = gloveSkinId === 'omega_carbon' ? VoxelMat.Emissive : VoxelMat.Matte;

  const mesh = createSculptedMesh(
    null,
    () => {
      const v = new VoxelSculptor(10, 10, 26, 0.0145);
      // Tactical jacket forearm sleeve with fold creases (z=12..25)
      v.fillBeveledBox(2, 2, 12, 8, 8, 25, cosmetic.sleeveHex, VoxelMat.Fabric, 'horizontal');
      v.fillBox(2, 4, 15, 8, 5, 16, sleeveCreaseHex, VoxelMat.Fabric);
      v.fillBox(2, 4, 20, 8, 5, 21, sleeveCreaseHex, VoxelMat.Fabric);
      // Ribbed elastic cuff & snap button (z=9..11)
      v.fillBeveledBox(1, 1, 9, 9, 9, 11, cosmetic.cuffHex, VoxelMat.Fabric, 'horizontal');
      v.set(9, 5, 10, 0x94a3b8, VoxelMat.Metal);
      // Digital tactical field wristwatch on wrist (z=7..8)
      v.fillBox(2, 2, 7, 8, 8, 8, 0x18181b, VoxelMat.Fabric);
      v.fillBox(3, 8, 7, 7, 9, 8, 0x334155, VoxelMat.Metal);
      v.fillBox(4, 9, 7, 6, 9, 8, 0x38bdf8, VoxelMat.Emissive);
      // Fingerless tactical glove over palm & knuckles (z=2..6)
      v.fillBeveledBox(2, 2, 2, 8, 7, 6, cosmetic.gloveHex, VoxelMat.Fabric, 'vertical');
      // Reinforced knuckle guard ridge (glowing cyan carbon filament on omega_carbon)
      v.fillBox(2, 7, 2, 8, 7, 3, cosmetic.knuckleHex, knuckleMat);
      // Exposed fingers wrapping forward around grip (z=0..1)
      v.fillBox(2, 3, 0, 8, 6, 1, 0xd6a47c, VoxelMat.Matte);
      v.set(4, 4, 0, 0xbd8962, VoxelMat.Matte);
      v.set(6, 4, 0, 0xbd8962, VoxelMat.Matte);
      // Articulated opposable thumb gripping inner side (x=0..1, z=1..4)
      v.fillBox(0, 4, 2, 2, 6, 4, cosmetic.gloveHex, VoxelMat.Fabric);
      v.fillBox(0, 5, 1, 1, 6, 2, 0xd6a47c, VoxelMat.Matte);
      return v.build({ anchor: [5, 5, 6] }).geometry;
    },
    { standalone: true }
  );
  mesh.position.set(0.025, -0.048, 0.045);
  mesh.rotation.set(0.14, -0.1, 0.06);
  return mesh;
}

/**
 * 1st-Person Micro-Voxel Sculpted Right-Hand Viewmodel Rig:
 * Displays a sculpted tactical jacket sleeve, ribbed cuff, glowing digital field watch,
 * fingerless tactical glove & articulated voxel hand holding ANY of the 15 sculpted tools!
 */
export function createHeldItemViewmodelRig(
  gloveSkinId: GloveSkinId = 'urban_default'
): HeldItemViewmodelRig {
  const root = new THREE.Group();
  root.position.set(0.31, -0.26, -0.5);

  const handGroup = new THREE.Group();
  root.add(handGroup);

  let currentGloveSkin: GloveSkinId = gloveSkinId;
  let sculptedArmHand: THREE.Mesh = buildSculptedArmHandMesh(gloveSkinId);
  handGroup.add(sculptedArmHand);

  const itemAnchor = new THREE.Group();
  itemAnchor.position.set(-0.01, 0.02, -0.045);
  handGroup.add(itemAnchor);

  const allTypes: ItemType[] = [
    'flashlight',
    'stun_gun',
    'throwable_can',
    'red_key',
    'blue_key',
    'basement_key',
    'crowbar',
    'crowbar_rod',
    'crowbar_hook',
    'stun_coil',
    'stun_cell',
    'fuse',
    'wire_cutters',
    'master_key',
    'flare',
  ];

  const models = {} as Record<ItemType, THREE.Group>;
  let flashlightLensMat: THREE.MeshStandardMaterial | null = null;
  let currentFlashlightLensHex = 0xfff8dc;
  let uvModeActive = false;

  for (const t of allTypes) {
    // Standalone = true so camera-mounted tools own independent materials not cleared on world rebuild
    const m = createVoxelItemModel(t, true);
    if (t === 'flashlight') {
      m.position.set(0, 0.01, -0.02);
      const lens = m.getObjectByName('flashlight_lens') as THREE.Mesh | undefined;
      if (lens && lens.material instanceof THREE.MeshStandardMaterial) {
        flashlightLensMat = lens.material;
      }
    } else if (t === 'stun_gun') {
      m.scale.setScalar(0.95);
      m.position.set(-0.02, 0.03, -0.06);
    } else if (t === 'throwable_can') {
      m.scale.setScalar(0.8);
      m.position.set(-0.01, 0.04, -0.04);
    } else if (t === 'crowbar' || t === 'crowbar_rod') {
      m.scale.setScalar(0.68);
      m.rotation.set(-0.22, -0.45, 0.32);
      m.position.set(-0.04, 0.07, -0.1);
    } else if (t === 'wire_cutters') {
      m.scale.setScalar(0.82);
      m.rotation.set(-0.35, -0.25, 0.15);
      m.position.set(-0.02, 0.05, -0.06);
    } else if (t === 'fuse' || t === 'stun_coil' || t === 'stun_cell' || t === 'crowbar_hook') {
      m.scale.setScalar(0.75);
      m.rotation.set(-0.2, -0.3, 0.1);
      m.position.set(-0.02, 0.04, -0.05);
    } else if (t === 'flare') {
      m.rotation.set(-0.28, 0, 0.16);
      m.position.set(0, 0.06, -0.03);
    } else {
      m.scale.setScalar(0.62);
      m.rotation.set(-0.18, -0.35, 0.14);
      m.position.set(-0.005, 0.015, -0.045);
    }
    m.visible = t === 'flashlight';
    itemAnchor.add(m);
    models[t] = m;
  }

  const applyFlashlightLens = () => {
    if (!flashlightLensMat) return;
    if (uvModeActive) {
      flashlightLensMat.color.setHex(0xe879f9);
      flashlightLensMat.emissive.setHex(0xa855f7);
      flashlightLensMat.emissiveIntensity = 2.4;
    } else {
      flashlightLensMat.color.setHex(currentFlashlightLensHex);
      flashlightLensMat.emissive.setHex(
        currentFlashlightLensHex === 0xfff8dc ? 0xffdf85 : currentFlashlightLensHex
      );
      flashlightLensMat.emissiveIntensity = 1.7;
    }
  };

  const rig: HeldItemViewmodelRig = {
    root,
    handGroup,
    itemAnchor,
    models,
    activeItem: 'flashlight',
    setActiveItem(item: ItemType) {
      this.activeItem = item;
      for (const k of allTypes) {
        this.models[k].visible = k === item;
      }
    },
    setUvMode(uvOn: boolean) {
      uvModeActive = uvOn;
      applyFlashlightLens();
    },
    setGloveSkin(nextSkin: GloveSkinId) {
      if (nextSkin === currentGloveSkin) return;
      currentGloveSkin = nextSkin;
      const nextMesh = buildSculptedArmHandMesh(nextSkin);
      handGroup.remove(sculptedArmHand);
      sculptedArmHand.geometry.dispose();
      sculptedArmHand = nextMesh;
      handGroup.add(sculptedArmHand);
    },
    setFlashlightColor(lensHex: number) {
      currentFlashlightLensHex = lensHex;
      applyFlashlightLens();
    },
  };

  return rig;
}

export function createSafeVisual(safe: SafeDefinition, pack: MaterialPack): {
  group: THREE.Group;
  doorPivot: THREE.Group;
  screenMat: THREE.MeshStandardMaterial;
} {
  return createSculptedSafeVisual(safe, pack);
}

export function createCluePlaqueVisual(clue: ArgCluePlacement): THREE.Group {
  return createSculptedCluePlaqueVisual(clue);
}

export function createNoisePropVisual(prop: NoisePropDefinition): THREE.Group {
  return createSculptedNoisePropVisual(prop);
}

export function createCourtyardPillarVisual(
  pillar: { x: number; z: number; height: number; hasLantern?: boolean },
  pack: MaterialPack
): THREE.Group {
  return createSculptedCourtyardPillarVisual(pillar, pack);
}

/**
 * Sculpted Voxel Craft Workbench (Oficina & Subsolo) for combining loose tool parts!
 */
export function createWorkbenchVisual(wb: WorkbenchDefinition, pack: MaterialPack): THREE.Group {
  return createSculptedWorkbenchVisual(wb, pack);
}

/**
 * Wall-Mounted Sculpted Voxel Flashlight Recharge Station (buzzes loudly when charging!).
 */
export function createRechargeStationVisual(
  st: RechargeStationDefinition,
  pack: MaterialPack
): { group: THREE.Group; statusMat: THREE.MeshStandardMaterial } {
  return createSculptedRechargeStationVisual(st, pack);
}

/**
 * Retro Micro-Voxel Sculpted Cassette Tape Recorder Prop (glows red REC indicator until listened).
 */
export function createCassetteRecorderVisual(tape: CassetteTapeDefinition): {
  group: THREE.Group;
  ledMat: THREE.MeshStandardMaterial;
} {
  return createSculptedCassetteRecorderVisual(tape);
}

/**
 * Ceiling-mounted Sculpted Security Camera for Cabine 09-A CCTV System (CAM 01..CAM 06).
 */
export function createSecurityCameraVisual(cam: BunkerCameraDefinition): THREE.Group {
  return createSculptedSecurityCameraVisual(cam);
}

/**
 * Prominent Wall-Mounted Sculpted Cabine 09-A Blast Door Control Box (Left / Right Security Door).
 */
export function createBunkerDoorButtonVisual(
  btn: { x: number; y: number; z: number; facingYaw: number; side: 'left' | 'right' }
): { group: THREE.Group; buttonMat: THREE.MeshStandardMaterial } {
  return createSculptedBunkerDoorButtonVisual(btn);
}

/**
 * Framed Micro-Voxel Wall Tutorial Plaque (Reception).
 */
export function createTutorialPlaqueVisual(plaque: TutorialPlaqueDefinition): THREE.Group {
  return createSculptedTutorialPlaqueVisual(plaque);
}

/**
 * UV Fluorescent Wall Mark (Zero Z-fighting via polygonOffset, subtle physical smudge hint, vivid neon UV glow!).
 */
export function createUvMarkVisual(mark: UvMarkDefinition): {
  group: THREE.Group;
  mat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  group.position.set(mark.x, mark.y, mark.z);
  group.rotation.y = mark.facingYaw;

  // Barely noticeable physical chalk/resin smudge hint on the wall so keen observers suspect UV ink
  const smudgeMat = new THREE.MeshStandardMaterial({
    color: 0x3b2c4a,
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const smudge = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), smudgeMat);
  smudge.position.z = 0.022;
  group.add(smudge);

  const tex = createUvMarkTexture(mark.symbolChar, mark.title);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf0abfc,
    map: tex,
    emissive: 0xc026d3,
    emissiveIntensity: 2.6,
    transparent: true,
    opacity: 0.035,
    roughness: 0.3,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), mat);
  plane.position.z = 0.032;
  plane.renderOrder = 3;
  group.add(plane);

  return { group, mat };
}

/**
 * Functional Industrial Wall Light Switch (high-density micro-voxel sculpted breaker enclosure,
 * corner bolts, guard rails, conduit collars, pivoting lever & red/green LED).
 */
export function createWallLightSwitchVisual(sw: {
  x: number;
  y: number;
  z: number;
  facingYaw: number;
  isOn: boolean;
}): {
  group: THREE.Group;
  lever: THREE.Mesh;
  ledMat: THREE.MeshStandardMaterial;
} {
  return createSculptedWallLightSwitchVisual(sw);
}

/**
 * Living Environment Props & Dirty Cracked Reflective Glass Window re-exports.
 */
export function createAnimatedFanVisual(kind: 'ceiling' | 'desk'): {
  group: THREE.Group;
  bladePivot: THREE.Group;
} {
  return createSculptedAnimatedFanVisual(kind);
}

export function createWallClockVisual(): {
  group: THREE.Group;
  minuteHand: THREE.Group;
  secondHand: THREE.Group;
} {
  return createSculptedWallClockVisual();
}

export function createServerRackVisual(): {
  group: THREE.Group;
  ledMats: THREE.MeshStandardMaterial[];
} {
  return createSculptedServerRackVisual();
}

export function createSwayingTarpVisual(): {
  group: THREE.Group;
  swayPivot: THREE.Group;
} {
  return createSculptedSwayingTarpVisual();
}

export function createDirtyGlassWindowVisual(
  widthM: number,
  heightM: number,
  pack: MaterialPack
): THREE.Group {
  return createSculptedDirtyGlassWindowVisual(widthM, heightM, pack);
}

/**
 * Secret Cell Green CCTV-Only Code Sign (visible through CAM 06!).
 */
export function createCctvSecretSignVisual(
  x: number,
  y: number,
  z: number,
  code: string
): THREE.Group {
  return createSculptedCctvSecretSignVisual(x, y, z, code);
}

export interface FurnitureVisual {
  def: FurniturePropDefinition;
  group: THREE.Group;
  animatedPart: THREE.Object3D | null;
  contentsAnchor: THREE.Group | null;
  statusMat: THREE.MeshStandardMaterial | null;
}

/**
 * High-Density Micro-Voxel Sculpted Furniture & Environmental Storytelling Prop Builder.
 * Covers all 37 FurnitureKinds with Greedy Meshing, Hidden Face Culling & Baked Vertex AO.
 */
export function createFurnitureVisual(
  prop: FurniturePropDefinition,
  pack: MaterialPack,
  symbolMap?: { symbol: string; digit: string }[]
): FurnitureVisual {
  return createSculptedFurnitureVisual(prop, pack, symbolMap);
}

/**
 * Orbiting Voxel Electric Stun Sparks attached to P. Diddy when hit by the Stun Gun!
 */
export function createStunSparksRig(): THREE.Group {
  const group = new THREE.Group();
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const sparkMat2 = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      i % 2 === 0 ? sparkMat : sparkMat2
    );
    cube.position.set(Math.cos(a) * 0.52, 0.5 + (i % 4) * 0.42, Math.sin(a) * 0.52);
    group.add(cube);
  }
  group.visible = false;
  return group;
}

/**
 * Subtle pulsing ground beacon ring + glow halo for player-dropped items so they never get lost in dark corners!
 */
export function createDroppedItemGlowRing(pack: MaterialPack, hexColor = 0xfbbf24): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.28, 16),
    new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.14;
  ring.name = 'drop_ring';
  g.add(ring);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: pack.glowHaloTex,
      color: hexColor,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.position.y = 0.04;
  halo.scale.set(0.68, 0.68, 1);
  halo.name = 'drop_halo';
  g.add(halo);
  return g;
}

/**
 * Specular reflective abandoned puddle with optional animated falling ceiling water drop & expanding ripple ring!
 */
export interface PuddleVisual {
  group: THREE.Group;
  dropMesh: THREE.Mesh | null;
  rippleMesh: THREE.Mesh | null;
  rippleMat: THREE.MeshBasicMaterial | null;
  phase: number;
  floor: -1 | 0;
  x: number;
  z: number;
}

export function createPuddleVisual(
  puddle: { floor: -1 | 0; x: number; y: number; z: number; radius: number; hasDrip?: boolean },
  pack: MaterialPack,
  seedIdx: number
): PuddleVisual {
  const group = new THREE.Group();
  group.position.set(puddle.x, puddle.y, puddle.z);

  // Dark moss/sludge rim around the puddle
  const rim = new THREE.Mesh(
    new THREE.CircleGeometry(puddle.radius * 1.16, 12),
    new THREE.MeshStandardMaterial({
      color: puddle.floor === -1 ? 0x162925 : 0x1e2c22,
      roughness: 0.92,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    })
  );
  rim.rotation.x = -Math.PI / 2;
  group.add(rim);

  // Reflective dark mirror water surface (picks up PMREM night sky & flashlight specular highlights!)
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(puddle.radius, 12),
    new THREE.MeshStandardMaterial({
      color: puddle.floor === -1 ? 0x163842 : 0x1b345c,
      emissive: puddle.floor === -1 ? 0x0a2026 : 0x132647,
      emissiveIntensity: 0.34,
      roughness: 0.06,
      metalness: 0.78,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.004;
  group.add(water);

  let dropMesh: THREE.Mesh | null = null;
  let rippleMesh: THREE.Mesh | null = null;
  let rippleMat: THREE.MeshBasicMaterial | null = null;

  if (puddle.hasDrip) {
    dropMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.1, 0.038),
      new THREE.MeshBasicMaterial({ color: 0x99f6e4, transparent: true, opacity: 0.85 })
    );
    dropMesh.position.y = 2.6;
    group.add(dropMesh);

    rippleMat = new THREE.MeshBasicMaterial({
      map: pack.waterDripRingTex,
      color: 0x99f6e4,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    rippleMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), rippleMat);
    rippleMesh.rotation.x = -Math.PI / 2;
    rippleMesh.position.y = 0.01;
    group.add(rippleMesh);
  }

  return {
    group,
    dropMesh,
    rippleMesh,
    rippleMat,
    phase: (seedIdx * 1.37) % 3.2,
    floor: puddle.floor,
    x: puddle.x,
    z: puddle.z,
  };
}

/**
 * Cinematic Atmospheric Night Sky Rig above the Courtyard Pergola:
 * - Custom GLSL Atmospheric Night Dome (indigo zenith -> steel-blue misty horizon + moonlight Mie scatter halo)
 * - 420 Crisp Twinkling Stars via custom per-star phase ShaderMaterial
 * - 64x64 Cratered Pixel Full Moon + Layered Lunar Halo
 * - Slow-Drifting Dark Voxel Clouds
 * - Distant Sector 09 Industrial Perimeter Silhouettes (Water Tower, Watch Towers, Smokestacks + Blinking Red Beacon)
 */
export interface NightSkyRig {
  group: THREE.Group;
  starsMat: THREE.ShaderMaterial;
  cloudGroup: THREE.Group;
  beaconMat: THREE.MeshBasicMaterial;
  update(elapsedSec: number): void;
}

export function createNightSkyRig(pack: MaterialPack, centerX: number, centerZ: number): NightSkyRig {
  const group = new THREE.Group();
  group.position.set(centerX, 0, centerZ);

  const moonLocalPos = new THREE.Vector3(-15, 36, -24);
  const moonDir = moonLocalPos.clone().normalize();

  // 1. Custom GLSL Atmospheric Night Sky Dome (midnight indigo zenith -> cold steel-blue horizon mist + moon Mie halo)
  const domeGeo = new THREE.SphereGeometry(78, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const domeMat = new THREE.ShaderMaterial({
    uniforms: {
      uMoonDir: { value: moonDir },
      uZenithColor: { value: new THREE.Color(0x050b1c) },
      uMidSkyColor: { value: new THREE.Color(0x0c1a38) },
      uHorizonColor: { value: new THREE.Color(0x1b3054) },
      uMoonGlowColor: { value: new THREE.Color(0x6095d8) },
    },
    vertexShader: `
      varying vec3 vLocalDir;
      void main() {
        vLocalDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uMoonDir;
      uniform vec3 uZenithColor;
      uniform vec3 uMidSkyColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uMoonGlowColor;
      varying vec3 vLocalDir;
      void main() {
        vec3 dir = normalize(vLocalDir);
        float elev = clamp(dir.y, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uMidSkyColor, smoothstep(0.0, 0.34, elev));
        col = mix(col, uZenithColor, smoothstep(0.28, 0.92, elev));
        float moonDot = max(0.0, dot(dir, normalize(uMoonDir)));
        float mieWide = pow(moonDot, 6.0) * 0.24;
        float mieCore = pow(moonDot, 38.0) * 0.52;
        col += uMoonGlowColor * (mieWide + mieCore);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(domeGeo, domeMat));

  // 2. Crisp 64x64 Pixel-Art Cratered Full Moon high over the North-West Courtyard!
  // Soft bluish-silver moonlight atmospheric halo rendered BEHIND the cratered moon so craters never blow out
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: pack.glowHaloTex,
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      fog: false,
      depthWrite: false,
    })
  );
  moonHalo.position.copy(moonLocalPos).multiplyScalar(1.02);
  moonHalo.scale.set(22, 22, 1);
  moonHalo.renderOrder = 1;
  group.add(moonHalo);

  const moonMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8.6, 8.6),
    new THREE.MeshBasicMaterial({
      map: pack.moonTex,
      transparent: true,
      fog: false,
      depthWrite: false,
      toneMapped: false,
    })
  );
  moonMesh.position.copy(moonLocalPos);
  moonMesh.lookAt(centerX, 1.6, centerZ);
  moonMesh.renderOrder = 2;
  group.add(moonMesh);

  // 3. 420 Crisp Twinkling Stars with natural Mulberry32 uniform hemisphere scatter (zero spiral artifacts!)
  const starCount = 420;
  const starPositions = new Float32Array(starCount * 3);
  const starPhases = new Float32Array(starCount);
  const starSizes = new Float32Array(starCount);
  const starColors = new Float32Array(starCount * 3);

  let rngState = 0x5e709a1f;
  const nextRand = (): number => {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = 0; i < starCount; i++) {
    const theta = nextRand() * Math.PI * 2;
    // Uniform hemisphere elevation above horizon (cosPhi in [0.16..0.99])
    const cosPhi = 0.16 + nextRand() * 0.83;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const r = 64 + nextRand() * 8;
    starPositions[i * 3] = sinPhi * Math.cos(theta) * r;
    starPositions[i * 3 + 1] = cosPhi * r + 4;
    starPositions[i * 3 + 2] = sinPhi * Math.sin(theta) * r;
    starPhases[i] = nextRand() * Math.PI * 2;
    const sizeRoll = nextRand();
    starSizes[i] = sizeRoll > 0.92 ? 4.8 : sizeRoll > 0.72 ? 3.3 : 2.1;
    // Subtle spectral star tints: ice-blue, pure white, pale gold
    const tintRoll = nextRand();
    if (tintRoll < 0.28) {
      starColors[i * 3] = 0.72; starColors[i * 3 + 1] = 0.86; starColors[i * 3 + 2] = 1.0;
    } else if (tintRoll < 0.45) {
      starColors[i * 3] = 1.0; starColors[i * 3 + 1] = 0.93; starColors[i * 3 + 2] = 0.78;
    } else {
      starColors[i * 3] = 0.90; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 1.0;
    }
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(starPhases, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starsMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSize;
      attribute vec3 color;
      uniform float uTime;
      varying float vTwinkle;
      varying vec3 vColor;
      void main() {
        vColor = color;
        float tw = 0.58 + 0.42 * sin(uTime * (1.4 + mod(aPhase, 2.2)) + aPhase * 4.0);
        vTwinkle = tw;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (0.85 + 0.3 * tw);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float dist = max(abs(c.x), abs(c.y));
        if (dist > 0.48) discard;
        float core = smoothstep(0.48, 0.12, dist);
        gl_FragColor = vec4(vColor, core * vTwinkle);
      }
    `,
    transparent: true,
    fog: false,
    depthWrite: false,
  });
  group.add(new THREE.Points(starGeo, starsMat));

  // 4. Slow-drifting discrete dark blocky voxel night clouds high above the pergola
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0x111f3c,
    transparent: true,
    opacity: 0.52,
    fog: false,
    depthWrite: false,
  });
  const cloudOffsets: [number, number, number, number, number][] = [
    [-20, 23, -12, 13, 5],
    [11, 25, -15, 16, 6],
    [-7, 22, 13, 14, 5],
    [17, 24, 9, 12, 5],
    [0, 26, -4, 11, 4],
    [-26, 24, 6, 10, 4],
  ];
  for (const [cx, cy, cz, w, d] of cloudOffsets) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, d), cloudMat);
    c.position.set(cx, cy, cz);
    cloudGroup.add(c);
  }
  group.add(cloudGroup);

  // 5. Distant Sector 09 Industrial Perimeter Silhouettes beyond Courtyard Walls!
  const silMat = new THREE.MeshBasicMaterial({
    color: 0x0a1326,
    fog: false,
  });
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    fog: false,
    toneMapped: false,
  });

  // Elevated Sector 09 Water Tower (North-West skyline)
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-28, 0, -34);
  for (const [lx, lz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 14, 0.45), silMat);
    leg.position.set(lx, 7, lz);
    towerGroup.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.4, 5.6), silMat);
  tank.position.set(0, 15.8, 0);
  towerGroup.add(tank);
  const tankRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.2, 4.2), silMat);
  tankRoof.position.set(0, 18.6, 0);
  towerGroup.add(tankRoof);
  const towerBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), beaconMat);
  towerBeacon.position.set(0, 19.6, 0);
  towerGroup.add(towerBeacon);
  group.add(towerGroup);

  // Distant Twin Smokestacks + Security Watchtower (North-East skyline)
  for (const [sx, sz, sh] of [[24, -36, 21], [30, -33, 17], [-34, -10, 15], [35, 16, 14]] as [number, number, number][]) {
    const stack = new THREE.Mesh(new THREE.BoxGeometry(2.2, sh, 2.2), silMat);
    stack.position.set(sx, sh * 0.5, sz);
    group.add(stack);
  }
  const stackBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), beaconMat);
  stackBeacon.position.set(24, 21.5, -36);
  group.add(stackBeacon);

  // Guard Watchtower Silhouette (South-West skyline)
  const watchBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 11.5, 2.6), silMat);
  watchBase.position.set(-32, 5.75, 24);
  group.add(watchBase);
  const watchCab = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 4.2), silMat);
  watchCab.position.set(-32, 12.6, 24);
  group.add(watchCab);

  return {
    group,
    starsMat,
    cloudGroup,
    beaconMat,
    update(elapsedSec: number) {
      starsMat.uniforms.uTime.value = elapsedSec;
      cloudGroup.position.x = Math.sin(elapsedSec * 0.045) * 4.2;
      cloudGroup.position.z = Math.cos(elapsedSec * 0.032) * 2.2;
      const blink = Math.sin(elapsedSec * 3.1) > 0.25 ? 1.0 : 0.14;
      beaconMat.color.setRGB(blink, 0.12 * blink, 0.12 * blink);
    },
  };
}

