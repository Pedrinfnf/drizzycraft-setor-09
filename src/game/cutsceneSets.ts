import * as THREE from 'three';
import { createSculptedArticulatedSurvivorRig } from './characterModels';

export type PeerAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'crouch_idle'
  | 'crouch_walk'
  | 'downed_crawl'
  | 'captured';

export interface ArticulatedPeerRig {
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
  flashlightCone: THREE.Mesh;
  nametagSprite: THREE.Sprite | null;
  nametagCanvas: HTMLCanvasElement | null;
  nametagTexture: THREE.CanvasTexture | null;
  lastTagKey: string;
  animTime: number;
  currentHeldItem: string | null;
}

function makeBox(
  w: number,
  h: number,
  d: number,
  color: number,
  emissive = 0x000000,
  emissiveIntensity = 0
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.14,
    emissive,
    emissiveIntensity,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Builds the flagship High-Density Sculpted Articulated Micro-Voxel Survivor character rig
 * (11 VoxelSculptor parts with Baked Vertex AO — elbows, knees, layered hair, hood, backpack,
 * tactical belt, watch & laced boots) for Multiplayer Allies AND Choreographed Cutscenes!
 */
export function createArticulatedPeerRig(withNametag = true, jacketHex = 0x254873): ArticulatedPeerRig {
  const sculpted = createSculptedArticulatedSurvivorRig(jacketHex);
  const {
    root,
    pelvis,
    torso,
    head,
    leftArm,
    leftForeArm,
    rightArm,
    rightForeArm,
    leftLeg,
    leftShin,
    rightLeg,
    rightShin,
    heldItemGroup,
  } = sculpted;

  // Sculpted tactical flashlight mounted cleanly in right hand
  const defaultFlash = makeBox(0.065, 0.065, 0.26, 0x334155);
  defaultFlash.name = 'item_body';
  heldItemGroup.add(defaultFlash);
  const bezel = makeBox(0.085, 0.085, 0.05, 0x1e293b);
  bezel.position.z = 0.11;
  heldItemGroup.add(bezel);
  const lens = makeBox(0.06, 0.06, 0.025, 0xfef08a, 0xfef08a, 2.0);
  lens.position.z = 0.145;
  lens.name = 'item_lens';
  heldItemGroup.add(lens);

  // Soft translucent volumetric flashlight beam cone visible on remote teammates
  const coneGeo = new THREE.ConeGeometry(0.62, 3.6, 12, 1, true);
  coneGeo.translate(0, -1.8, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfef3c7,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const flashlightCone = new THREE.Mesh(coneGeo, coneMat);
  flashlightCone.position.set(0, 0, 0.16);
  heldItemGroup.add(flashlightCone);

  // Floating 3D Nametag Sprite (Nickname + Platform + Speaking Wave + Captured Alert)
  let nametagSprite: THREE.Sprite | null = null;
  let nametagCanvas: HTMLCanvasElement | null = null;
  let nametagTexture: THREE.CanvasTexture | null = null;
  if (withNametag && typeof document !== 'undefined') {
    nametagCanvas = document.createElement('canvas');
    nametagCanvas.width = 512;
    nametagCanvas.height = 144;
    nametagTexture = new THREE.CanvasTexture(nametagCanvas);
    nametagTexture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: nametagTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    nametagSprite = new THREE.Sprite(spriteMat);
    nametagSprite.position.set(0, 2.08, 0);
    nametagSprite.scale.set(1.75, 0.5, 1);
    nametagSprite.renderOrder = 25;
    root.add(nametagSprite);
  }

  return {
    root,
    pelvis,
    torso,
    head,
    leftArm,
    leftForeArm,
    rightArm,
    rightForeArm,
    leftLeg,
    leftShin,
    rightLeg,
    rightShin,
    heldItemGroup,
    flashlightCone,
    nametagSprite,
    nametagCanvas,
    nametagTexture,
    lastTagKey: '',
    animTime: 0,
    currentHeldItem: 'flashlight',
  };
}

export function updatePeerHeldItem(
  rig: ArticulatedPeerRig,
  heldItem: string | null,
  flashlightOn: boolean,
  uvOn: boolean
): void {
  const mat = rig.flashlightCone.material as THREE.MeshBasicMaterial;
  rig.flashlightCone.visible = flashlightOn;
  mat.color.setHex(uvOn ? 0xa855f7 : 0xfef3c7);

  const key = heldItem || 'flashlight';
  if (rig.currentHeldItem === key) return;
  rig.currentHeldItem = key;

  const body = rig.heldItemGroup.getObjectByName('item_body') as THREE.Mesh | undefined;
  const lens = rig.heldItemGroup.getObjectByName('item_lens') as THREE.Mesh | undefined;
  if (!body || !lens) return;
  const bMat = body.material as THREE.MeshStandardMaterial;
  const lMat = lens.material as THREE.MeshStandardMaterial;

  if (key === 'stun_gun') {
    body.scale.set(1.2, 1.35, 1.15);
    bMat.color.setHex(0x0f172a);
    lMat.color.setHex(0x38bdf8);
    lMat.emissive.setHex(0x38bdf8);
  } else if (key === 'crowbar') {
    body.scale.set(0.65, 0.65, 2.2);
    bMat.color.setHex(0x991b1b);
    lMat.color.setHex(0x94a3b8);
    lMat.emissive.setHex(0x000000);
  } else if (key.includes('key')) {
    body.scale.set(0.7, 0.5, 0.85);
    bMat.color.setHex(
      key === 'red_key' ? 0xef4444 : key === 'blue_key' ? 0x3b82f6 : 0xf59e0b
    );
    lMat.color.setHex(0xfde047);
    lMat.emissive.setHex(0xf59e0b);
  } else if (key === 'flare') {
    body.scale.set(0.8, 0.8, 1.1);
    bMat.color.setHex(0xdc2626);
    lMat.color.setHex(0xf97316);
    lMat.emissive.setHex(0xf97316);
  } else {
    body.scale.set(1, 1, 1);
    bMat.color.setHex(0x334155);
    lMat.color.setHex(uvOn ? 0xc084fc : 0xfef08a);
    lMat.emissive.setHex(uvOn ? 0xa855f7 : 0xfef08a);
  }
}

export function updatePeerNametag(
  rig: ArticulatedPeerRig,
  opts: {
    nickname: string;
    platform: 'pc' | 'touch' | 'gamepad';
    speaking: boolean;
    captured: boolean;
    distanceMeters: number;
  }
): void {
  if (!rig.nametagCanvas || !rig.nametagTexture) return;
  const distRounded = Math.round(opts.distanceMeters);
  const key = `${opts.nickname}|${opts.platform}|${opts.speaking ? 1 : 0}|${opts.captured ? 1 : 0}|${opts.captured ? distRounded : 0}`;
  if (rig.lastTagKey === key) return;
  rig.lastTagKey = key;

  const ctx = rig.nametagCanvas.getContext('2d');
  if (!ctx) return;
  const w = rig.nametagCanvas.width;
  const h = rig.nametagCanvas.height;
  ctx.clearRect(0, 0, w, h);

  // Captured red alert ribbon on top
  if (opts.captured) {
    ctx.fillStyle = 'rgba(185, 28, 28, 0.92)';
    ctx.fillRect(66, 8, w - 132, 42);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.strokeRect(66, 8, w - 132, 42);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`PRESO NA CELA · ${distRounded}m`, w / 2, 29);
  }

  // Main dark tactical pill
  const pillY = opts.captured ? 58 : 38;
  const pillH = 66;
  ctx.fillStyle = opts.speaking ? 'rgba(6, 78, 59, 0.90)' : 'rgba(10, 14, 24, 0.84)';
  ctx.fillRect(36, pillY, w - 72, pillH);
  ctx.strokeStyle = opts.captured
    ? '#ef4444'
    : opts.speaking
    ? '#34d399'
    : 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(36, pillY, w - 72, pillH);

  // Platform badge
  const platText = opts.platform === 'touch' ? 'MOB' : opts.platform === 'gamepad' ? 'PAD' : 'PC';
  ctx.fillStyle = opts.platform === 'touch' ? '#0ea5e9' : '#f59e0b';
  ctx.fillRect(50, pillY + 14, 72, 38);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#090d16';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(platText, 86, pillY + 34);

  // Nickname
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.fillText(opts.nickname.slice(0, 16), 136, pillY + 35);

  // Green voice wave bars when speaking
  if (opts.speaking) {
    ctx.fillStyle = '#34d399';
    const bx = w - 96;
    ctx.fillRect(bx, pillY + 26, 7, 16);
    ctx.fillRect(bx + 12, pillY + 16, 7, 36);
    ctx.fillRect(bx + 24, pillY + 22, 7, 24);
    ctx.fillRect(bx + 36, pillY + 14, 7, 40);
  }

  rig.nametagTexture.needsUpdate = true;
}

/**
 * Smooth 30Hz/60Hz procedural limb animation for Remote Peers & Cutscene Survivors across all 6 states:
 * idle, walk, run, crouch_idle, crouch_walk, captured.
 */
export function updatePeerRigAnimation(
  rig: ArticulatedPeerRig,
  state: PeerAnimState,
  pitch: number,
  dt: number
): void {
  const rate =
    state === 'run'
      ? 11.5
      : state === 'walk'
      ? 6.6
      : state === 'crouch_walk'
      ? 5.0
      : 2.2;
  rig.animTime += dt * rate;
  const t = rig.animTime;
  const s = Math.sin(t);
  const k = Math.min(1, dt * 14);

  let pelvisY = 0.72;
  let pelvisPitch = 0;
  let torsoPitch = 0;
  let armLPitch = 0;
  let foreLPitch = -0.15;
  let armRPitch = -0.35;
  let foreRPitch = -0.45;
  let legLPitch = 0;
  let shinLPitch = 0;
  let legRPitch = 0;
  let shinRPitch = 0;
  const c = Math.cos(t);

  if (state === 'idle') {
    pelvisY = 0.72 + Math.sin(t * 0.9) * 0.014;
    armLPitch = Math.sin(t * 0.7) * 0.05;
    foreLPitch = -0.18;
    armRPitch = -0.42 + Math.sin(t * 0.6) * 0.03;
    foreRPitch = -0.52;
  } else if (state === 'walk') {
    pelvisY = 0.72 + Math.abs(s) * 0.038;
    torsoPitch = 0.07;
    legLPitch = s * 0.52;
    shinLPitch = Math.max(0, -c) * 0.55;
    legRPitch = -s * 0.52;
    shinRPitch = Math.max(0, c) * 0.55;
    armLPitch = -s * 0.42;
    foreLPitch = -0.25 - Math.max(0, -s) * 0.2;
    armRPitch = -0.55 + s * 0.14;
    foreRPitch = -0.48;
  } else if (state === 'run') {
    pelvisY = 0.68 + Math.abs(s) * 0.072;
    torsoPitch = 0.25;
    legLPitch = s * 0.92;
    shinLPitch = Math.max(0, -c) * 1.05;
    legRPitch = -s * 0.92;
    shinRPitch = Math.max(0, c) * 1.05;
    armLPitch = -s * 0.85;
    foreLPitch = -0.65 - Math.max(0, -s) * 0.35;
    armRPitch = -0.68 + s * 0.25;
    foreRPitch = -0.6;
  } else if (state === 'crouch_idle') {
    pelvisY = 0.48;
    torsoPitch = 0.34;
    legLPitch = -0.55;
    shinLPitch = 0.95;
    legRPitch = -0.45;
    shinRPitch = 0.85;
    armLPitch = -0.15;
    foreLPitch = -0.35;
    armRPitch = -0.62;
    foreRPitch = -0.45;
  } else if (state === 'crouch_walk') {
    pelvisY = 0.48 + Math.abs(s) * 0.03;
    torsoPitch = 0.38;
    legLPitch = -0.45 + s * 0.42;
    shinLPitch = 0.85 + Math.max(0, -c) * 0.35;
    legRPitch = -0.45 - s * 0.42;
    shinRPitch = 0.85 + Math.max(0, c) * 0.35;
    armLPitch = -0.2 - s * 0.24;
    foreLPitch = -0.38;
    armRPitch = -0.66 + s * 0.12;
    foreRPitch = -0.48;
  } else if (state === 'downed_crawl') {
    pelvisY = 0.24;
    pelvisPitch = 1.25;
    torsoPitch = -0.2;
    armLPitch = -0.9 + s * 0.35;
    foreLPitch = -0.4;
    armRPitch = -0.9 - s * 0.35;
    foreRPitch = -0.4;
    legLPitch = 0.15 - s * 0.2;
    shinLPitch = 0.35;
    legRPitch = 0.15 + s * 0.2;
    shinRPitch = 0.35;
  } else if (state === 'captured') {
    pelvisY = 0.42;
    torsoPitch = 0.22;
    legLPitch = -1.1;
    shinLPitch = 1.15;
    legRPitch = -1.1;
    shinRPitch = 1.15;
    armLPitch = -0.35 + Math.sin(t * 1.4) * 0.08;
    foreLPitch = -0.65;
    armRPitch = -0.35 - Math.sin(t * 1.4) * 0.08;
    foreRPitch = -0.65;
  }

  const clampedPitch = Math.max(-0.7, Math.min(0.7, pitch));
  rig.pelvis.position.y += (pelvisY - rig.pelvis.position.y) * k;
  rig.pelvis.rotation.x += (pelvisPitch - rig.pelvis.rotation.x) * k;
  rig.torso.rotation.x += (torsoPitch - rig.torso.rotation.x) * k;
  rig.head.rotation.x += (-clampedPitch * 0.75 - rig.head.rotation.x) * k;
  rig.leftArm.rotation.x += (armLPitch - rig.leftArm.rotation.x) * k;
  rig.leftForeArm.rotation.x += (foreLPitch - rig.leftForeArm.rotation.x) * k;
  rig.rightArm.rotation.x += (armRPitch - clampedPitch * 0.55 - rig.rightArm.rotation.x) * k;
  rig.rightForeArm.rotation.x += (foreRPitch - rig.rightForeArm.rotation.x) * k;
  rig.leftLeg.rotation.x += (legLPitch - rig.leftLeg.rotation.x) * k;
  rig.leftShin.rotation.x += (shinLPitch - rig.leftShin.rotation.x) * k;
  rig.rightLeg.rotation.x += (legRPitch - rig.rightLeg.rotation.x) * k;
  rig.rightShin.rotation.x += (shinRPitch - rig.rightShin.rotation.x) * k;
}

// ============================================================================
// Dedicated Enclosed 3D Cutscene Sets (ZERO Void / ZERO Abyss!)
// ============================================================================

export interface DedicatedCutsceneSetsRig {
  root: THREE.Group;
  sets: Record<'gate_road' | 'basement_tunnel' | 'helipad_roof' | 'containment_cell', THREE.Group>;
  gateLeftPivot: THREE.Group;
  gateRightPivot: THREE.Group;
  cellDoorPivot: THREE.Group;
  helicopterGroup: THREE.Group;
  helicopterMainRotor: THREE.Group;
  helicopterTailRotor: THREE.Group;
  strobeRed: THREE.Mesh;
  strobeBlue: THREE.Mesh;
  carBeaconRed: THREE.Mesh;
  carBeaconBlue: THREE.Mesh;
  cellCageLight: THREE.PointLight;
}

function buildPineTree(x: number, y: number, z: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  const trunk = makeBox(0.36, 1.8, 0.36, 0x3b2618);
  trunk.position.y = 0.9;
  g.add(trunk);
  const c1 = makeBox(2.1, 1.2, 2.1, 0x132a1d);
  c1.position.y = 2.1;
  g.add(c1);
  const c2 = makeBox(1.5, 1.1, 1.5, 0x183625);
  c2.position.y = 3.1;
  g.add(c2);
  const c3 = makeBox(0.9, 0.9, 0.9, 0x1f452f);
  c3.position.y = 4.0;
  g.add(c3);
  return g;
}

function buildStreetLamp(x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const pole = makeBox(0.16, 4.8, 0.16, 0x1e293b);
  pole.position.y = 2.4;
  g.add(pole);
  const arm = makeBox(0.9, 0.12, 0.14, 0x334155);
  arm.position.set(0.38, 4.75, 0);
  g.add(arm);
  const bulb = makeBox(0.32, 0.12, 0.24, 0xfef08a, 0xfde047, 2.4);
  bulb.position.set(0.75, 4.65, 0);
  g.add(bulb);
  return g;
}

export function buildDedicatedCutsceneSets(): DedicatedCutsceneSetsRig {
  const root = new THREE.Group();

  // --------------------------------------------------------------------------
  // 1. GOOD ENDING SET: Portão Principal / Estrada Exterior (x=120, y=0, z=-18)
  // --------------------------------------------------------------------------
  const gateRoad = new THREE.Group();
  gateRoad.visible = false;
  root.add(gateRoad);

  // Solid ground & asphalt road
  const roadGround = makeBox(38, 0.4, 34, 0x18211b);
  roadGround.position.set(120, -0.2, -18);
  gateRoad.add(roadGround);

  const asphalt = makeBox(10, 0.08, 32, 0x1c1f26);
  asphalt.position.set(120, 0.04, -18);
  gateRoad.add(asphalt);

  for (let z = -31; z <= -5; z += 3.2) {
    const dash = makeBox(0.22, 0.09, 1.4, 0xeab308, 0xca8a04, 0.35);
    dash.position.set(120, 0.05, z);
    gateRoad.add(dash);
  }

  // Perimeter stone walls + iron North Gate at z = -9.6
  for (const wx of [109, 131]) {
    const wall = makeBox(12, 3.8, 0.9, 0x334155);
    wall.position.set(wx, 1.9, -9.6);
    gateRoad.add(wall);
  }
  for (const px of [115.2, 124.8]) {
    const pillar = makeBox(1.1, 4.4, 1.1, 0x475569);
    pillar.position.set(px, 2.2, -9.6);
    gateRoad.add(pillar);
    const lantern = makeBox(0.35, 0.35, 0.35, 0xf59e0b, 0xf59e0b, 2.0);
    lantern.position.set(px, 4.55, -9.6);
    gateRoad.add(lantern);
  }
  const archBeam = makeBox(10.6, 0.65, 0.9, 0x1e293b);
  archBeam.position.set(120, 4.2, -9.6);
  gateRoad.add(archBeam);

  // Animated Double Iron Gate Doors
  const gateLeftPivot = new THREE.Group();
  gateLeftPivot.position.set(115.8, 0, -9.6);
  for (let i = 0; i < 6; i++) {
    const bar = makeBox(0.11, 3.6, 0.11, 0x0f172a);
    bar.position.set(0.4 + i * 0.72, 1.8, 0);
    gateLeftPivot.add(bar);
  }
  const railL = makeBox(4.2, 0.18, 0.14, 0x1e293b);
  railL.position.set(2.1, 1.8, 0);
  gateLeftPivot.add(railL);
  gateRoad.add(gateLeftPivot);

  const gateRightPivot = new THREE.Group();
  gateRightPivot.position.set(124.2, 0, -9.6);
  for (let i = 0; i < 6; i++) {
    const bar = makeBox(0.11, 3.6, 0.11, 0x0f172a);
    bar.position.set(-0.4 - i * 0.72, 1.8, 0);
    gateRightPivot.add(bar);
  }
  const railR = makeBox(4.2, 0.18, 0.14, 0x1e293b);
  railR.position.set(-2.1, 1.8, 0);
  gateRightPivot.add(railR);
  gateRoad.add(gateRightPivot);

  // Background Sector 09 courtyard silhouette wall behind P. Drizzy (z = -3.8)
  const backFacade = makeBox(36, 7.0, 1.0, 0x1e2430);
  backFacade.position.set(120, 3.5, -3.6);
  gateRoad.add(backFacade);

  // Exterior street lamps & pine trees framing the road
  gateRoad.add(buildStreetLamp(114.2, 0, -14.5));
  gateRoad.add(buildStreetLamp(125.8, 0, -21.5));
  gateRoad.add(buildStreetLamp(114.2, 0, -28.0));
  for (const [tx, tz, sc] of [
    [108, -13, 1.2],
    [107, -19, 1.4],
    [109, -26, 1.15],
    [131, -14, 1.3],
    [133, -21, 1.25],
    [130, -28, 1.4],
    [112, -32, 1.5],
    [127, -32, 1.35],
  ]) {
    gateRoad.add(buildPineTree(tx, 0, tz, sc));
  }

  // 3D Micro-Voxel Getaway Patrol / Rescue Car at [123.6, 0, -23.0]
  const carGroup = new THREE.Group();
  carGroup.position.set(123.6, 0, -23.0);
  carGroup.rotation.y = -0.25;
  const carChassis = makeBox(2.2, 0.78, 4.6, 0x0f172a);
  carChassis.position.y = 0.65;
  carGroup.add(carChassis);
  const carCabin = makeBox(1.95, 0.72, 2.2, 0xe2e8f0);
  carCabin.position.set(0, 1.34, -0.2);
  carGroup.add(carCabin);
  const windshield = makeBox(1.82, 0.54, 2.26, 0x0ea5e9, 0x0284c7, 0.25);
  windshield.position.set(0, 1.36, -0.2);
  carGroup.add(windshield);
  for (const [wx, wz] of [
    [-1.08, 1.35],
    [1.08, 1.35],
    [-1.08, -1.35],
    [1.08, -1.35],
  ]) {
    const wheel = makeBox(0.32, 0.56, 0.56, 0x09090b);
    wheel.position.set(wx, 0.3, wz);
    carGroup.add(wheel);
  }
  const headL = makeBox(0.42, 0.2, 0.1, 0xfef9c3, 0xfef08a, 3.0);
  headL.position.set(-0.72, 0.72, -2.32);
  carGroup.add(headL);
  const headR = makeBox(0.42, 0.2, 0.1, 0xfef9c3, 0xfef08a, 3.0);
  headR.position.set(0.72, 0.72, -2.32);
  carGroup.add(headR);
  const carBeaconRed = makeBox(0.55, 0.18, 0.26, 0xef4444, 0xef4444, 2.8);
  carBeaconRed.position.set(-0.34, 1.78, -0.2);
  carGroup.add(carBeaconRed);
  const carBeaconBlue = makeBox(0.55, 0.18, 0.26, 0x3b82f6, 0x3b82f6, 2.8);
  carBeaconBlue.position.set(0.34, 1.78, -0.2);
  carGroup.add(carBeaconBlue);
  gateRoad.add(carGroup);

  const roadLight1 = new THREE.PointLight(0xfde68a, 3.2, 22);
  roadLight1.position.set(120, 4.4, -14);
  gateRoad.add(roadLight1);
  const roadLight2 = new THREE.PointLight(0x93c5fd, 2.8, 22);
  roadLight2.position.set(123, 3.5, -23);
  gateRoad.add(roadLight2);

  // --------------------------------------------------------------------------
  // 2. REAL ENDING SET: Túnel de Fuga do Subsolo + Resgate (x=120, y=-4, z=14)
  // --------------------------------------------------------------------------
  const basementTunnel = new THREE.Group();
  basementTunnel.visible = false;
  root.add(basementTunnel);

  const tunFloor = makeBox(16, 0.4, 30, 0x1e242c);
  tunFloor.position.set(120, -4.2, 14);
  basementTunnel.add(tunFloor);
  const tunCeil = makeBox(16, 0.4, 20, 0x14181f);
  tunCeil.position.set(120, -0.4, 18);
  basementTunnel.add(tunCeil);
  for (const wx of [112.4, 127.6]) {
    const wall = makeBox(0.8, 4.4, 30, 0x26303d);
    wall.position.set(wx, -2.0, 14);
    basementTunnel.add(wall);
  }
  const backTunWall = makeBox(16, 4.4, 0.8, 0x1b222c);
  backTunWall.position.set(120, -2.0, 28.6);
  basementTunnel.add(backTunWall);
  const frontBayWall = makeBox(16, 4.4, 0.8, 0x1e293b);
  frontBayWall.position.set(120, -2.0, -0.6);
  basementTunnel.add(frontBayWall);

  // Bulkhead ribs & glowing emergency light strips along tunnel
  for (let z = 9; z <= 25; z += 4) {
    const strip = makeBox(2.4, 0.14, 0.24, 0x22d3ee, 0x06b6d4, 2.2);
    strip.position.set(120, -0.7, z);
    basementTunnel.add(strip);
  }
  // Security bulkhead bars separating P. Drizzy
  for (let bx = 114; bx <= 126; bx += 0.9) {
    const bar = makeBox(0.12, 3.6, 0.12, 0x475569);
    bar.position.set(bx, -2.2, 18.6);
    basementTunnel.add(bar);
  }

  // Rescue Van waiting in the illuminated escape bay at [120, -4, 3.8]
  const van = new THREE.Group();
  van.position.set(120, -4.0, 3.8);
  const vanBody = makeBox(2.6, 1.9, 4.8, 0xf1f5f9);
  vanBody.position.y = 1.25;
  van.add(vanBody);
  const vanStripe = makeBox(2.68, 0.35, 4.84, 0x0ea5e9, 0x0284c7, 0.5);
  vanStripe.position.y = 1.1;
  van.add(vanStripe);
  const vanBeacon = makeBox(0.9, 0.2, 0.3, 0xf59e0b, 0xf59e0b, 2.6);
  vanBeacon.position.set(0, 2.3, 0.5);
  van.add(vanBeacon);
  basementTunnel.add(van);

  const tunLight1 = new THREE.PointLight(0x38bdf8, 3.4, 20);
  tunLight1.position.set(120, -1.2, 16);
  basementTunnel.add(tunLight1);
  const tunLight2 = new THREE.PointLight(0xfef08a, 3.4, 20);
  tunLight2.position.set(120, -0.8, 5);
  basementTunnel.add(tunLight2);

  // --------------------------------------------------------------------------
  // 3. SECRET ENDING SET: Heliponto + Helicóptero 3D (x=180, y=6, z=14)
  // --------------------------------------------------------------------------
  const helipadRoof = new THREE.Group();
  helipadRoof.visible = false;
  root.add(helipadRoof);

  // Concrete rooftop deck & parapets
  const deck = makeBox(30, 0.8, 30, 0x262d38);
  deck.position.set(180, 5.6, 14);
  helipadRoof.add(deck);

  // Glowing yellow H pad markings
  const hLeft = makeBox(0.65, 0.06, 6.2, 0xfacc15, 0xeab308, 0.8);
  hLeft.position.set(177.8, 6.03, 12.2);
  helipadRoof.add(hLeft);
  const hRight = makeBox(0.65, 0.06, 6.2, 0xfacc15, 0xeab308, 0.8);
  hRight.position.set(182.2, 6.03, 12.2);
  helipadRoof.add(hRight);
  const hCross = makeBox(4.8, 0.06, 0.65, 0xfacc15, 0xeab308, 0.8);
  hCross.position.set(180, 6.03, 12.2);
  helipadRoof.add(hCross);

  // Perimeter safety railings + 4 corner floodlight towers
  for (const [rx, rz, rw, rd] of [
    [180, 0.2, 29, 0.25],
    [180, 27.8, 29, 0.25],
    [165.4, 14, 0.25, 28],
    [194.6, 14, 0.25, 28],
  ]) {
    const rail = makeBox(rw, 1.2, rd, 0x475569);
    rail.position.set(rx, 6.6, rz);
    helipadRoof.add(rail);
  }
  for (const [fx, fz] of [
    [167, 2],
    [193, 2],
    [167, 26],
    [193, 26],
  ]) {
    helipadRoof.add(buildStreetLamp(fx, 6.0, fz));
  }
  // Fenced helipad security barrier keeping P. Drizzy back at z=21.6
  for (let bx = 172; bx <= 188; bx += 1.0) {
    const post = makeBox(0.12, 2.8, 0.12, 0x334155);
    post.position.set(bx, 7.4, 21.6);
    helipadRoof.add(post);
  }

  // Detailed 3D Micro-Voxel Evacuation Helicopter at [180, 6.0, 12.2]
  const helicopterGroup = new THREE.Group();
  helicopterGroup.position.set(180, 6.0, 12.2);
  helipadRoof.add(helicopterGroup);

  // Landing skids
  for (const sx of [-1.25, 1.25]) {
    const skid = makeBox(0.18, 0.16, 4.4, 0x334155);
    skid.position.set(sx, 0.1, 0);
    helicopterGroup.add(skid);
    for (const sz of [-1.1, 1.1]) {
      const strut = makeBox(0.14, 0.72, 0.14, 0x475569);
      strut.position.set(sx, 0.48, sz);
      helicopterGroup.add(strut);
    }
  }
  // Fuselage + cockpit glass + tail boom
  const fuselage = makeBox(2.3, 1.85, 5.2, 0x1e293b);
  fuselage.position.set(0, 1.75, 0);
  helicopterGroup.add(fuselage);
  const rescueStripe = makeBox(2.38, 0.34, 4.9, 0xf97316, 0xea580c, 0.6);
  rescueStripe.position.set(0, 1.6, 0);
  helicopterGroup.add(rescueStripe);
  const cockpit = makeBox(2.05, 0.95, 1.65, 0x38bdf8, 0x0ea5e9, 0.55);
  cockpit.position.set(0, 1.95, -2.2);
  helicopterGroup.add(cockpit);
  const tailBoom = makeBox(0.58, 0.62, 4.8, 0x334155);
  tailBoom.position.set(0, 2.0, 4.6);
  helicopterGroup.add(tailBoom);
  const tailFin = makeBox(0.2, 1.6, 0.85, 0xf97316);
  tailFin.position.set(0, 2.55, 6.8);
  helicopterGroup.add(tailFin);

  // Spinning Main Rotor
  const helicopterMainRotor = new THREE.Group();
  helicopterMainRotor.position.set(0, 2.95, 0);
  const mast = makeBox(0.32, 0.45, 0.32, 0x64748b);
  helicopterMainRotor.add(mast);
  const bladeA = makeBox(9.2, 0.08, 0.34, 0x0f172a);
  bladeA.position.y = 0.2;
  helicopterMainRotor.add(bladeA);
  const bladeB = makeBox(0.34, 0.08, 9.2, 0x0f172a);
  bladeB.position.y = 0.2;
  helicopterMainRotor.add(bladeB);
  helicopterGroup.add(helicopterMainRotor);

  // Spinning Tail Rotor
  const helicopterTailRotor = new THREE.Group();
  helicopterTailRotor.position.set(0.32, 2.55, 6.8);
  const tBladeA = makeBox(0.06, 1.45, 0.16, 0x0f172a);
  helicopterTailRotor.add(tBladeA);
  const tBladeB = makeBox(0.06, 0.16, 1.45, 0x0f172a);
  helicopterTailRotor.add(tBladeB);
  helicopterGroup.add(helicopterTailRotor);

  // Blinking Strobe Lights
  const strobeRed = makeBox(0.24, 0.24, 0.24, 0xef4444, 0xef4444, 3.0);
  strobeRed.position.set(-1.25, 2.1, 0.6);
  helicopterGroup.add(strobeRed);
  const strobeBlue = makeBox(0.24, 0.24, 0.24, 0x22c55e, 0x22c55e, 3.0);
  strobeBlue.position.set(1.25, 2.1, 0.6);
  helicopterGroup.add(strobeBlue);

  const heliLight1 = new THREE.PointLight(0xe0f2fe, 4.0, 28);
  heliLight1.position.set(180, 12.5, 14);
  helipadRoof.add(heliLight1);
  const heliLight2 = new THREE.PointLight(0xfef08a, 3.0, 24);
  heliLight2.position.set(180, 10.0, 22);
  helipadRoof.add(heliLight2);

  // --------------------------------------------------------------------------
  // 4. BAD ENDING / CAPTURE SET: Sala de Contenção / Cela 09 (x=120, y=-4, z=62)
  // --------------------------------------------------------------------------
  const containmentCell = new THREE.Group();
  containmentCell.visible = false;
  root.add(containmentCell);

  const cellFloor = makeBox(16, 0.4, 16, 0x1b2028);
  cellFloor.position.set(120, -4.2, 62);
  containmentCell.add(cellFloor);
  const cellCeil = makeBox(16, 0.4, 16, 0x11151c);
  cellCeil.position.set(120, -0.4, 62);
  containmentCell.add(cellCeil);
  for (const [wx, wz, ww, wd] of [
    [120, 54.4, 16, 0.8],
    [120, 69.6, 16, 0.8],
    [112.4, 62, 0.8, 16],
    [127.6, 62, 0.8, 16],
  ]) {
    const w = makeBox(ww, 4.2, wd, 0x262f3b);
    w.position.set(wx, -2.1, wz);
    containmentCell.add(w);
  }
  // Cell partition iron bars at z = 62.6 with slamming central door
  for (let bx = 113.2; bx <= 126.8; bx += 0.72) {
    if (bx > 118.8 && bx < 121.2) continue;
    const bar = makeBox(0.1, 3.6, 0.1, 0x475569);
    bar.position.set(bx, -2.2, 62.6);
    containmentCell.add(bar);
  }
  const cellDoorPivot = new THREE.Group();
  cellDoorPivot.position.set(118.9, -4.0, 62.6);
  for (let i = 0; i < 4; i++) {
    const bar = makeBox(0.11, 3.6, 0.11, 0x64748b);
    bar.position.set(0.3 + i * 0.55, 1.8, 0);
    cellDoorPivot.add(bar);
  }
  const doorPlate = makeBox(2.2, 0.25, 0.16, 0x334155);
  doorPlate.position.set(1.1, 1.7, 0);
  cellDoorPivot.add(doorPlate);
  containmentCell.add(cellDoorPivot);

  // Furnished Cell 09 props (steel bunk bed + desk + overhead cage bulb)
  const bunk = makeBox(2.2, 0.75, 1.0, 0x334155);
  bunk.position.set(115.6, -3.62, 57.2);
  containmentCell.add(bunk);
  const mattress = makeBox(2.05, 0.2, 0.9, 0x64748b);
  mattress.position.set(115.6, -3.16, 57.2);
  containmentCell.add(mattress);
  const cageBulb = makeBox(0.36, 0.22, 0.36, 0xf59e0b, 0xf59e0b, 2.2);
  cageBulb.position.set(120, -0.75, 60.5);
  containmentCell.add(cageBulb);
  const cellCageLight = new THREE.PointLight(0xf59e0b, 3.2, 16);
  cellCageLight.position.set(120, -1.0, 61.5);
  containmentCell.add(cellCageLight);

  return {
    root,
    sets: {
      gate_road: gateRoad,
      basement_tunnel: basementTunnel,
      helipad_roof: helipadRoof,
      containment_cell: containmentCell,
    },
    gateLeftPivot,
    gateRightPivot,
    cellDoorPivot,
    helicopterGroup,
    helicopterMainRotor,
    helicopterTailRotor,
    strobeRed,
    strobeBlue,
    carBeaconRed,
    carBeaconBlue,
    cellCageLight,
  };
}
