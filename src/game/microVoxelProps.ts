import * as THREE from 'three';

/**
 * DrizzyCraft: Setor 09 — High-Detail Micro-Voxel 3D Prop, Tool, Puzzle & Setpiece Module
 *
 * Rules enforced:
 * - MICRO_VOXEL_STANDARD: Every prop, tool, puzzle, and setpiece is composed of 6 to 45+ distinct
 *   micro-voxel THREE.Mesh sub-pieces with depth variation, distinct PBR roughness/metalness, and emissive accents.
 * - MOBILE_60FPS: Shared PBR material cache for static parts + zero per-frame allocations in update loops.
 */

export type MicroVoxelToolId =
  | 'polaroid_camera'
  | 'oil_can'
  | 'crowbar'
  | 'wire_cutters'
  | 'gas_can'
  | 'car_battery'
  | 'alarm_clock';

export const MICRO_VOXEL_TOOL_IDS: readonly MicroVoxelToolId[] = [
  'polaroid_camera',
  'oil_can',
  'crowbar',
  'wire_cutters',
  'gas_can',
  'car_battery',
  'alarm_clock',
] as const;

// ---------------------------------------------------------------------------
// Shared PBR Material Registry (zero redundant shader compilations on mobile)
// ---------------------------------------------------------------------------

interface PbrSpec {
  color: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  side?: THREE.Side;
}

const sharedMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

function sharedMat(spec: PbrSpec): THREE.MeshStandardMaterial {
  const r = spec.roughness ?? 0.72;
  const m = spec.metalness ?? 0.08;
  const em = spec.emissive ?? 0x000000;
  const ei = spec.emissiveIntensity ?? 0;
  const tr = spec.transparent ?? false;
  const op = spec.opacity ?? 1;
  const dw = spec.depthWrite ?? !tr;
  const sd = spec.side ?? THREE.FrontSide;
  const key = `${spec.color}|${r}|${m}|${em}|${ei}|${tr ? 1 : 0}|${op}|${dw ? 1 : 0}|${sd}`;

  let mat = sharedMaterialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      roughness: r,
      metalness: m,
      emissive: em,
      emissiveIntensity: ei,
      transparent: tr,
      opacity: op,
      depthWrite: dw,
      side: sd,
    });
    sharedMaterialCache.set(key, mat);
  }
  return mat;
}

function uniqueMat(spec: PbrSpec): THREE.MeshStandardMaterial {
  const tr = spec.transparent ?? false;
  return new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.roughness ?? 0.45,
    metalness: spec.metalness ?? 0.15,
    emissive: spec.emissive ?? 0x000000,
    emissiveIntensity: spec.emissiveIntensity ?? 0,
    transparent: tr,
    opacity: spec.opacity ?? 1,
    depthWrite: spec.depthWrite ?? !tr,
    side: spec.side ?? THREE.FrontSide,
  });
}

export function disposeSharedMicroVoxelMaterials(): void {
  for (const mat of sharedMaterialCache.values()) {
    mat.dispose();
  }
  sharedMaterialCache.clear();
}

// ---------------------------------------------------------------------------
// Micro-Voxel Primitive Assembly Helpers
// ---------------------------------------------------------------------------

function addBox(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = 0,
  ry = 0,
  rz = 0,
  castShadow = true,
  name?: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    mesh.rotation.set(rx, ry, rz);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function addCyl(
  parent: THREE.Object3D,
  rt: number,
  rb: number,
  h: number,
  segs: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  rx = 0,
  ry = 0,
  rz = 0,
  castShadow = true,
  name?: string
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
  mesh.position.set(x, y, z);
  if (rx !== 0 || ry !== 0 || rz !== 0) {
    mesh.rotation.set(rx, ry, rz);
  }
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// 1. SEVEN NEW TOOLS (WORLD & VIEWMODEL) + COMPANION GLASS BOTTLE
// ---------------------------------------------------------------------------

function assemblePolaroidCamera(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'polaroid_camera_body';

  const retroWhite = sharedMat({ color: 0xe9e6dc, roughness: 0.62, metalness: 0.04 });
  const warmGrey = sharedMat({ color: 0xb9b4a8, roughness: 0.7, metalness: 0.06 });
  const matteBlack = sharedMat({ color: 0x16181e, roughness: 0.78, metalness: 0.14 });
  const chrome = sharedMat({ color: 0xdbe4ef, roughness: 0.18, metalness: 0.96 });
  const lensGlass = sharedMat({
    color: 0x1e3a5f,
    roughness: 0.08,
    metalness: 0.35,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.86,
  });
  const redButton = sharedMat({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.08,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.22,
  });
  const flashTube = sharedMat({
    color: 0xf8fafc,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.45,
  });
  const photoPaper = sharedMat({ color: 0xf8fafc, roughness: 0.52, metalness: 0.02 });
  const photoImage = sharedMat({ color: 0x1e293b, roughness: 0.42, metalness: 0.04 });

  // Lower dark grey stepped base
  addBox(g, 0.22, 0.045, 0.19, 0, -0.055, 0.01, matteBlack, 0, 0, 0, castShadow);
  // Main retro off-white camera body
  addBox(g, 0.21, 0.095, 0.16, 0, 0.01, -0.005, retroWhite, 0, 0, 0, castShadow);
  // Stepped upper forehead housing
  addBox(g, 0.20, 0.052, 0.11, 0, 0.072, 0.018, retroWhite, -0.14, 0, 0, castShadow);
  // Rear contoured grey back cover
  addBox(g, 0.195, 0.088, 0.036, 0, 0.012, -0.092, warmGrey, 0, 0, 0, castShadow);
  // Side grip cheek strips
  addBox(g, 0.018, 0.082, 0.14, -0.11, 0.008, -0.005, warmGrey, 0, 0, 0, castShadow);
  addBox(g, 0.018, 0.082, 0.14, 0.11, 0.008, -0.005, warmGrey, 0, 0, 0, castShadow);

  // 5-band retro rainbow stripe down center faceplate (emissive accents)
  const stripeColors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x3b82f6];
  for (let i = 0; i < stripeColors.length; i++) {
    const col = stripeColors[i];
    const stripeMat = sharedMat({
      color: col,
      roughness: 0.42,
      metalness: 0.05,
      emissive: col,
      emissiveIntensity: 0.35,
    });
    const sx = (i - 2) * 0.009;
    addBox(g, 0.0075, 0.09, 0.01, sx, -0.005, 0.076, stripeMat, 0, 0, 0, castShadow);
  }

  // Cylindrical black lens barrel + inner chrome ring + optical glass element
  addCyl(g, 0.044, 0.048, 0.042, 10, 0, 0.016, 0.086, matteBlack, Math.PI * 0.5, 0, 0, castShadow);
  addCyl(g, 0.034, 0.036, 0.018, 10, 0, 0.016, 0.105, chrome, Math.PI * 0.5, 0, 0, castShadow);
  addCyl(g, 0.028, 0.028, 0.012, 10, 0, 0.016, 0.111, lensGlass, Math.PI * 0.5, 0, 0, castShadow);

  // Top-left optical viewfinder hood & glass window
  addBox(g, 0.044, 0.036, 0.048, -0.068, 0.078, 0.055, matteBlack, 0, 0, 0, castShadow);
  addBox(g, 0.03, 0.022, 0.008, -0.068, 0.078, 0.08, lensGlass, 0, 0, 0, castShadow);

  // Red shutter button + collar on front-right
  addCyl(g, 0.015, 0.017, 0.012, 8, 0.074, 0.022, 0.078, matteBlack, Math.PI * 0.5, 0, 0, castShadow);
  addCyl(g, 0.011, 0.011, 0.018, 8, 0.074, 0.022, 0.085, redButton, Math.PI * 0.5, 0, 0, castShadow);

  // Emissive xenon flash bar housing + glowing flash tube
  addBox(g, 0.078, 0.034, 0.028, 0.048, 0.078, 0.066, matteBlack, 0, 0, 0, castShadow);
  addBox(g, 0.064, 0.02, 0.012, 0.048, 0.078, 0.08, flashTube, 0, 0, 0, castShadow, 'polaroid_flash_tube');

  // Front photo ejection slot & emerging Polaroid print
  addBox(g, 0.155, 0.014, 0.018, 0, -0.058, 0.106, matteBlack, 0, 0, 0, castShadow);
  addBox(g, 0.132, 0.005, 0.065, 0, -0.06, 0.132, photoPaper, 0.08, 0, 0, castShadow);
  addBox(g, 0.112, 0.006, 0.042, 0, -0.058, 0.128, photoImage, 0.08, 0, 0, castShadow);

  return g;
}

function assembleOilCan(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'oil_can_body';

  const steel = sharedMat({ color: 0x94a3b8, roughness: 0.34, metalness: 0.88 });
  const darkSteel = sharedMat({ color: 0x475569, roughness: 0.45, metalness: 0.82 });
  const brass = sharedMat({ color: 0xd97706, roughness: 0.28, metalness: 0.92 });
  const labelYellow = sharedMat({ color: 0xeab308, roughness: 0.65, metalness: 0.08 });
  const oilDrip = sharedMat({
    color: 0x1c1917,
    roughness: 0.1,
    metalness: 0.35,
    emissive: 0x064e3b,
    emissiveIntensity: 0.35,
  });

  // Flared base rim
  addCyl(g, 0.078, 0.084, 0.018, 10, 0, -0.095, 0, darkSteel, 0, 0, 0, castShadow);
  // Main metallic ribbed reservoir cylinder
  addCyl(g, 0.074, 0.076, 0.165, 10, 0, -0.005, 0, steel, 0, 0, 0, castShadow);
  // 3 horizontal embossed metallic ribs
  addCyl(g, 0.079, 0.079, 0.012, 10, 0, -0.052, 0, darkSteel, 0, 0, 0, castShadow);
  addCyl(g, 0.079, 0.079, 0.012, 10, 0, -0.005, 0, darkSteel, 0, 0, 0, castShadow);
  addCyl(g, 0.079, 0.079, 0.012, 10, 0, 0.042, 0, darkSteel, 0, 0, 0, castShadow);
  // Tapered upper dome shoulder
  addCyl(g, 0.042, 0.074, 0.042, 10, 0, 0.095, 0, steel, 0, 0, 0, castShadow);
  // Threaded brass cap collar + knurled top nut
  addCyl(g, 0.036, 0.038, 0.022, 8, 0, 0.125, 0, brass, 0, 0, 0, castShadow);
  addCyl(g, 0.028, 0.032, 0.016, 6, 0, 0.142, 0, brass, 0, 0, 0, castShadow);

  // 3-segment curved rear handle
  addBox(g, 0.016, 0.016, 0.068, 0, 0.056, -0.098, darkSteel, 0.2, 0, 0, castShadow);
  addBox(g, 0.018, 0.115, 0.018, 0, -0.002, -0.128, darkSteel, 0, 0, 0, castShadow);
  addBox(g, 0.016, 0.016, 0.068, 0, -0.058, -0.098, darkSteel, -0.2, 0, 0, castShadow);

  // Angled tapered spout (2 segments) + glossy oil drip tip
  addCyl(g, 0.014, 0.022, 0.11, 8, 0, 0.168, 0.052, brass, 0.68, 0, 0, castShadow);
  addCyl(g, 0.006, 0.013, 0.115, 8, 0, 0.242, 0.128, brass, 0.82, 0, 0, castShadow);
  addCyl(g, 0.007, 0.004, 0.022, 6, 0, 0.272, 0.172, oilDrip, 0.1, 0, 0, castShadow);

  // Embossed front industrial label badge
  addBox(g, 0.064, 0.044, 0.008, 0, -0.005, 0.078, labelYellow, 0, 0, 0, castShadow);

  return g;
}

function assembleCrowbar(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'crowbar_body';

  const redPaint = sharedMat({ color: 0xb91c1c, roughness: 0.48, metalness: 0.35 });
  const rawSteel = sharedMat({ color: 0xcbd5e1, roughness: 0.26, metalness: 0.94 });
  const darkIron = sharedMat({ color: 0x334155, roughness: 0.52, metalness: 0.85 });
  const gripTape = sharedMat({ color: 0x111827, roughness: 0.9, metalness: 0.04 });

  // Hexagonal painted red main shaft
  addCyl(g, 0.017, 0.017, 0.46, 6, 0, 0, 0, redPaint, Math.PI * 0.5, 0, 0, castShadow);
  // Exposed raw steel front transition neck
  addCyl(g, 0.016, 0.017, 0.08, 6, 0, 0.005, 0.26, darkIron, Math.PI * 0.5 - 0.12, 0, 0, castShadow);
  // Beveled flat pry blade at front end
  addBox(g, 0.042, 0.012, 0.075, 0, 0.016, 0.325, rawSteel, -0.22, 0, 0, castShadow);
  addBox(g, 0.046, 0.006, 0.032, 0, 0.025, 0.368, rawSteel, -0.34, 0, 0, castShadow);

  // Rear curved gooseneck bend (2 angled segments)
  addCyl(g, 0.016, 0.017, 0.08, 6, 0, 0.024, -0.255, redPaint, Math.PI * 0.5 + 0.58, 0, 0, castShadow);
  addCyl(g, 0.015, 0.016, 0.075, 6, 0, 0.068, -0.292, darkIron, Math.PI * 0.5 + 1.48, 0, 0, castShadow);

  // Split V-notch gooseneck claw prongs (claw base + left & right prongs)
  addBox(g, 0.044, 0.014, 0.034, 0, 0.098, -0.275, rawSteel, 0.42, 0, 0, castShadow);
  addBox(g, 0.014, 0.01, 0.056, -0.016, 0.112, -0.236, rawSteel, 0.24, 0.08, 0, castShadow);
  addBox(g, 0.014, 0.01, 0.056, 0.016, 0.112, -0.236, rawSteel, 0.24, -0.08, 0, castShadow);

  // 4 black ribbed rubberized grip tape bands
  for (let i = 0; i < 4; i++) {
    const gz = -0.12 + i * 0.052;
    addCyl(g, 0.0205, 0.0205, 0.028, 6, 0, 0, gz, gripTape, Math.PI * 0.5, 0, 0, castShadow);
  }

  return g;
}

function assembleWireCutters(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'wire_cutters_body';

  const rubberYellow = sharedMat({ color: 0xeab308, roughness: 0.76, metalness: 0.04 });
  const rubberBlack = sharedMat({ color: 0x18181b, roughness: 0.88, metalness: 0.05 });
  const forgedSteel = sharedMat({ color: 0x94a3b8, roughness: 0.3, metalness: 0.92 });
  const hardenedEdge = sharedMat({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.98 });
  const rivetSteel = sharedMat({ color: 0x475569, roughness: 0.35, metalness: 0.9 });

  // Dual long ergonomic rubberized handles (2 angled segments per handle)
  addBox(g, 0.024, 0.026, 0.16, -0.046, 0, -0.145, rubberYellow, 0, -0.14, 0, castShadow);
  addBox(g, 0.024, 0.026, 0.16, 0.046, 0, -0.145, rubberYellow, 0, 0.14, 0, castShadow);
  addBox(g, 0.022, 0.024, 0.11, -0.068, 0, -0.255, rubberYellow, 0, -0.05, 0, castShadow);
  addBox(g, 0.022, 0.024, 0.11, 0.068, 0, -0.255, rubberYellow, 0, 0.05, 0, castShadow);

  // Textured black grip collars on each handle (4 pieces)
  addBox(g, 0.028, 0.029, 0.026, -0.05, 0, -0.165, rubberBlack, 0, -0.14, 0, castShadow);
  addBox(g, 0.028, 0.029, 0.026, 0.05, 0, -0.165, rubberBlack, 0, 0.14, 0, castShadow);
  addBox(g, 0.027, 0.028, 0.026, -0.066, 0, -0.235, rubberBlack, 0, -0.06, 0, castShadow);
  addBox(g, 0.027, 0.028, 0.026, 0.066, 0, -0.235, rubberBlack, 0, 0.06, 0, castShadow);

  // Inner steel handle shanks leading into pivot (2 pieces)
  addBox(g, 0.018, 0.018, 0.095, -0.024, 0, -0.032, forgedSteel, 0, -0.26, 0, castShadow);
  addBox(g, 0.018, 0.018, 0.095, 0.024, 0, -0.032, forgedSteel, 0, 0.26, 0, castShadow);

  // Pivot cheek plates (top & bottom) + central steel rivet bolt (3 pieces)
  addBox(g, 0.052, 0.008, 0.058, 0, 0.015, 0.026, rivetSteel, 0, 0, 0, castShadow);
  addBox(g, 0.052, 0.008, 0.058, 0, -0.015, 0.026, rivetSteel, 0, 0, 0, castShadow);
  addCyl(g, 0.013, 0.013, 0.044, 8, 0, 0, 0.026, hardenedEdge, 0, 0, 0, castShadow);

  // Dual short hardened angled cutting jaws (2 outer jaws + 2 honed blade edges)
  addBox(g, 0.02, 0.024, 0.092, -0.019, 0, 0.088, forgedSteel, 0, 0.22, 0, castShadow);
  addBox(g, 0.02, 0.024, 0.092, 0.019, 0, 0.088, forgedSteel, 0, -0.22, 0, castShadow);
  addBox(g, 0.008, 0.016, 0.072, -0.008, 0, 0.094, hardenedEdge, 0, 0.16, 0, castShadow);
  addBox(g, 0.008, 0.016, 0.072, 0.008, 0, 0.094, hardenedEdge, 0, -0.16, 0, castShadow);

  return g;
}

function assembleGasCan(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'gas_can_body';

  const jerryRed = sharedMat({ color: 0xb91c1c, roughness: 0.44, metalness: 0.36 });
  const darkRed = sharedMat({ color: 0x7f1d1d, roughness: 0.55, metalness: 0.3 });
  const capBlack = sharedMat({ color: 0x18181b, roughness: 0.72, metalness: 0.12 });
  const spoutYellow = sharedMat({ color: 0xfacc15, roughness: 0.48, metalness: 0.08 });
  const steelTrim = sharedMat({ color: 0x64748b, roughness: 0.4, metalness: 0.85 });

  // Main jerrycan body tank + recessed bottom skid plate
  addBox(g, 0.16, 0.3, 0.26, 0, -0.02, 0, jerryRed, 0, 0, 0, castShadow);
  addBox(g, 0.172, 0.022, 0.272, 0, -0.168, 0, darkRed, 0, 0, 0, castShadow);

  // Raised X-embossing ribs on BOTH sides (4 diagonal bars)
  addBox(g, 0.012, 0.22, 0.022, 0.084, -0.02, 0, darkRed, 0.68, 0, 0, castShadow);
  addBox(g, 0.012, 0.22, 0.022, 0.084, -0.02, 0, darkRed, -0.68, 0, 0, castShadow);
  addBox(g, 0.012, 0.22, 0.022, -0.084, -0.02, 0, darkRed, 0.68, 0, 0, castShadow);
  addBox(g, 0.012, 0.22, 0.022, -0.084, -0.02, 0, darkRed, -0.68, 0, 0, castShadow);

  // Front & rear vertical seam weld flanges
  addBox(g, 0.022, 0.28, 0.014, 0, -0.02, 0.134, darkRed, 0, 0, 0, castShadow);
  addBox(g, 0.022, 0.28, 0.014, 0, -0.02, -0.134, darkRed, 0, 0, 0, castShadow);

  // Integrated top tubular carry handle (3 posts + top horizontal rail)
  addBox(g, 0.036, 0.056, 0.024, 0, 0.155, -0.095, jerryRed, 0, 0, 0, castShadow);
  addBox(g, 0.036, 0.056, 0.024, 0, 0.155, -0.015, jerryRed, 0, 0, 0, castShadow);
  addBox(g, 0.036, 0.056, 0.024, 0, 0.155, 0.055, jerryRed, 0, 0, 0, castShadow);
  addBox(g, 0.04, 0.024, 0.178, 0, 0.184, -0.02, jerryRed, 0, 0, 0, castShadow);

  // Cap collar + threaded locking cap
  addCyl(g, 0.028, 0.032, 0.028, 8, 0, 0.142, 0.098, steelTrim, 0.25, 0, 0, castShadow);
  addCyl(g, 0.026, 0.028, 0.022, 8, 0, 0.165, 0.105, capBlack, 0.25, 0, 0, castShadow);

  // Yellow & black angled pour spout (2 segments)
  addCyl(g, 0.015, 0.021, 0.085, 8, 0, 0.205, 0.132, spoutYellow, 0.56, 0, 0, castShadow);
  addCyl(g, 0.011, 0.014, 0.068, 8, 0, 0.245, 0.182, capBlack, 0.92, 0, 0, castShadow);

  // Flammable hazard diamond badge
  addBox(g, 0.008, 0.056, 0.056, 0.086, 0.052, 0.06, spoutYellow, Math.PI * 0.25, 0, 0, castShadow);

  return g;
}

function assembleCarBattery(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'car_battery_body';

  const casingBlack = sharedMat({ color: 0x17191e, roughness: 0.72, metalness: 0.12 });
  const lidGrey = sharedMat({ color: 0x475569, roughness: 0.58, metalness: 0.22 });
  const termRed = sharedMat({
    color: 0xdc2626,
    roughness: 0.42,
    metalness: 0.25,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.28,
  });
  const termNeg = sharedMat({ color: 0x1e293b, roughness: 0.42, metalness: 0.4 });
  const leadMetal = sharedMat({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.94 });
  const labelCyan = sharedMat({
    color: 0x0ea5e9,
    roughness: 0.5,
    metalness: 0.08,
    emissive: 0x0369a1,
    emissiveIntensity: 0.25,
  });

  // Main heavy polypropylene casing + bottom flange
  addBox(g, 0.3, 0.21, 0.19, 0, -0.015, 0, casingBlack, 0, 0, 0, castShadow);
  addBox(g, 0.318, 0.02, 0.205, 0, -0.115, 0, casingBlack, 0, 0, 0, castShadow);

  // Vertical side reinforcement ribs (4 pieces)
  for (const rx of [-0.095, 0.095]) {
    addBox(g, 0.022, 0.19, 0.014, rx, -0.015, 0.098, casingBlack, 0, 0, 0, castShadow);
    addBox(g, 0.022, 0.19, 0.014, rx, -0.015, -0.098, casingBlack, 0, 0, 0, castShadow);
  }

  // Recessed grey sealed top lid + outer bezel lip
  addBox(g, 0.308, 0.028, 0.198, 0, 0.098, 0, lidGrey, 0, 0, 0, castShadow);
  addBox(g, 0.26, 0.014, 0.145, 0, 0.116, 0, casingBlack, 0, 0, 0, castShadow);

  // 6 individual cylindrical electrolyte cell vent caps
  for (let i = 0; i < 6; i++) {
    const vx = -0.1 + i * 0.04;
    addCyl(g, 0.013, 0.013, 0.016, 6, vx, 0.125, -0.024, lidGrey, 0, 0, 0, castShadow);
  }

  // Positive (+) red clamp collar + lead terminal post + voxel plus marker
  addCyl(g, 0.022, 0.024, 0.018, 8, -0.105, 0.122, 0.048, termRed, 0, 0, 0, castShadow);
  addCyl(g, 0.012, 0.014, 0.036, 8, -0.105, 0.144, 0.048, leadMetal, 0, 0, 0, castShadow);
  addBox(g, 0.028, 0.008, 0.008, -0.068, 0.124, 0.048, termRed, 0, 0, 0, castShadow);
  addBox(g, 0.008, 0.008, 0.028, -0.068, 0.124, 0.048, termRed, 0, 0, 0, castShadow);

  // Negative (-) black clamp collar + lead terminal post + minus marker
  addCyl(g, 0.022, 0.024, 0.018, 8, 0.105, 0.122, 0.048, termNeg, 0, 0, 0, castShadow);
  addCyl(g, 0.012, 0.014, 0.036, 8, 0.105, 0.144, 0.048, leadMetal, 0, 0, 0, castShadow);
  addBox(g, 0.028, 0.008, 0.008, 0.068, 0.124, 0.048, leadMetal, 0, 0, 0, castShadow);

  // Folding carry handle (2 side hinge arms + top grip crossbar)
  addBox(g, 0.014, 0.072, 0.016, -0.155, 0.118, 0, lidGrey, 0, 0, -0.18, castShadow);
  addBox(g, 0.014, 0.072, 0.016, 0.155, 0.118, 0, lidGrey, 0, 0, 0.18, castShadow);
  addBox(g, 0.295, 0.018, 0.024, 0, 0.156, 0, casingBlack, 0, 0, 0, castShadow);

  // Front 12V specification sticker plate
  addBox(g, 0.14, 0.072, 0.008, 0, 0.005, 0.098, labelCyan, 0, 0, 0, castShadow);

  return g;
}

function assembleAlarmClock(castShadow: boolean): THREE.Group {
  const g = new THREE.Group();
  g.name = 'alarm_clock_body';

  const brassBody = sharedMat({ color: 0xb45309, roughness: 0.34, metalness: 0.85 });
  const chrome = sharedMat({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.96 });
  const dialCream = sharedMat({
    color: 0xfef3c7,
    roughness: 0.6,
    metalness: 0.02,
    emissive: 0x78350f,
    emissiveIntensity: 0.18,
  });
  const glassFront = sharedMat({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.32,
  });
  const handBlack = sharedMat({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
  const handRed = sharedMat({
    color: 0xef4444,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x991b1b,
    emissiveIntensity: 0.4,
  });

  // Main cylindrical metallic clock housing + rear backplate + wind-up key
  addCyl(g, 0.085, 0.085, 0.068, 12, 0, 0, 0, brassBody, Math.PI * 0.5, 0, 0, castShadow);
  addCyl(g, 0.078, 0.078, 0.012, 12, 0, 0, -0.036, chrome, Math.PI * 0.5, 0, 0, castShadow);
  addBox(g, 0.036, 0.014, 0.018, 0, 0, -0.048, chrome, 0, 0, 0.3, castShadow);

  // Stepped chrome bezel rim + cream face + glass cover
  addCyl(g, 0.09, 0.09, 0.016, 12, 0, 0, 0.034, chrome, Math.PI * 0.5, 0, 0, castShadow);
  addCyl(g, 0.076, 0.076, 0.008, 12, 0, 0, 0.039, dialCream, Math.PI * 0.5, 0, 0, castShadow);
  addCyl(g, 0.079, 0.079, 0.006, 12, 0, 0, 0.052, glassFront, Math.PI * 0.5, 0, 0, false);

  // Clock hands (hour, minute, red alarm pointer, center pin)
  addBox(g, 0.009, 0.044, 0.006, -0.008, 0.014, 0.045, handBlack, 0, 0, 0.52, castShadow);
  addBox(g, 0.007, 0.062, 0.006, 0.016, 0.018, 0.046, handBlack, 0, 0, -0.78, castShadow);
  addBox(g, 0.005, 0.052, 0.005, 0, -0.02, 0.047, handRed, 0, 0, 0.1, castShadow);
  addCyl(g, 0.009, 0.009, 0.01, 6, 0, 0, 0.048, brassBody, Math.PI * 0.5, 0, 0, castShadow);

  // Twin chrome alarm bells + mounting posts (4 pieces)
  addCyl(g, 0.008, 0.008, 0.034, 6, -0.058, 0.088, 0, chrome, 0, 0, 0.55, castShadow);
  addCyl(g, 0.008, 0.008, 0.034, 6, 0.058, 0.088, 0, chrome, 0, 0, -0.55, castShadow);
  addCyl(g, 0.022, 0.042, 0.032, 10, -0.074, 0.106, 0, chrome, 0, 0, 0.55, castShadow);
  addCyl(g, 0.022, 0.042, 0.032, 10, 0.074, 0.106, 0, chrome, 0, 0, -0.55, castShadow);

  // Center hammer post + striker ball
  addCyl(g, 0.005, 0.005, 0.048, 6, 0, 0.102, 0, chrome, 0, 0, 0, castShadow);
  addBox(g, 0.022, 0.014, 0.014, 0, 0.126, 0, brassBody, 0, 0, 0, castShadow);

  // 2 angled brass bottom feet
  addCyl(g, 0.01, 0.014, 0.036, 6, -0.055, -0.092, 0, brassBody, 0, 0, -0.45, castShadow);
  addCyl(g, 0.01, 0.014, 0.036, 6, 0.055, -0.092, 0, brassBody, 0, 0, 0.45, castShadow);

  return g;
}

/**
 * Companion translucent green glass distraction bottle (10 distinct micro-voxel sub-pieces).
 */
export function createGlassBottleWorldModel(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'world_glass_bottle';

  const greenGlass = sharedMat({
    color: 0x15803d,
    roughness: 0.1,
    metalness: 0.12,
    emissive: 0x052e16,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.72,
  });
  const thickGlass = sharedMat({
    color: 0x166534,
    roughness: 0.12,
    metalness: 0.15,
    transparent: true,
    opacity: 0.86,
  });
  const liquidMat = sharedMat({
    color: 0x22c55e,
    roughness: 0.18,
    metalness: 0.05,
    emissive: 0x14532d,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.64,
  });
  const labelPaper = sharedMat({ color: 0xe7e5e4, roughness: 0.88, metalness: 0.02 });
  const corkMat = sharedMat({ color: 0xa16207, roughness: 0.92, metalness: 0.02 });

  // Thick punted glass base
  addCyl(g, 0.046, 0.048, 0.022, 10, 0, 0.011, 0, thickGlass, 0, 0, 0, true);
  // Lower & mid translucent body segments
  addCyl(g, 0.047, 0.046, 0.085, 10, 0, 0.064, 0, greenGlass, 0, 0, 0, true);
  addCyl(g, 0.046, 0.047, 0.065, 10, 0, 0.138, 0, greenGlass, 0, 0, 0, true);
  // Internal sloshing residue liquid core
  addCyl(g, 0.037, 0.037, 0.058, 8, 0, 0.056, 0, liquidMat, 0, 0, 0, false);
  // Weathered vintage paper label band + dark stripe
  addCyl(g, 0.0485, 0.0485, 0.062, 10, 0, 0.105, 0, labelPaper, 0, 0, 0, true);
  addBox(g, 0.036, 0.014, 0.006, 0, 0.108, 0.048, thickGlass, 0, 0, 0, true);
  // Tapered bottle shoulder
  addCyl(g, 0.019, 0.045, 0.052, 10, 0, 0.195, 0, greenGlass, 0, 0, 0, true);
  // Tall narrow neck
  addCyl(g, 0.017, 0.019, 0.072, 10, 0, 0.256, 0, greenGlass, 0, 0, 0, true);
  // Flanged glass pouring lip
  addCyl(g, 0.021, 0.02, 0.014, 10, 0, 0.296, 0, thickGlass, 0, 0, 0, true);
  // Cork stopper
  addCyl(g, 0.015, 0.013, 0.024, 8, 0, 0.312, 0, corkMat, 0, 0, 0, true);

  return g;
}

function buildToolGeometryById(id: MicroVoxelToolId, castShadow: boolean): THREE.Group {
  switch (id) {
    case 'polaroid_camera':
      return assemblePolaroidCamera(castShadow);
    case 'oil_can':
      return assembleOilCan(castShadow);
    case 'crowbar':
      return assembleCrowbar(castShadow);
    case 'wire_cutters':
      return assembleWireCutters(castShadow);
    case 'gas_can':
      return assembleGasCan(castShadow);
    case 'car_battery':
      return assembleCarBattery(castShadow);
    case 'alarm_clock':
      return assembleAlarmClock(castShadow);
  }
}

export function createToolWorldModel(id: MicroVoxelToolId): THREE.Group {
  const root = new THREE.Group();
  root.name = `world_${id}`;
  const inner = buildToolGeometryById(id, true);
  // Subtle world pickup presentation elevation so base sits cleanly above floor/table
  inner.position.set(0, 0.14, 0);
  root.add(inner);
  return root;
}

export function createToolViewModel(id: MicroVoxelToolId): THREE.Group {
  const root = new THREE.Group();
  root.name = `viewmodel_${id}`;
  const inner = buildToolGeometryById(id, false);

  // Calibrated 1st-person right-hand framing per tool silhouette
  switch (id) {
    case 'polaroid_camera':
      inner.position.set(0.02, -0.02, -0.05);
      inner.rotation.set(0.06, Math.PI - 0.18, 0.04);
      inner.scale.setScalar(1.12);
      break;
    case 'oil_can':
      inner.position.set(0.04, -0.05, -0.06);
      inner.rotation.set(0.18, Math.PI + 0.25, 0.1);
      inner.scale.setScalar(1.05);
      break;
    case 'crowbar':
      inner.position.set(0.06, -0.08, -0.14);
      inner.rotation.set(-0.28, Math.PI + 0.14, -0.22);
      inner.scale.setScalar(0.95);
      break;
    case 'wire_cutters':
      inner.position.set(0.04, -0.05, -0.1);
      inner.rotation.set(-0.18, Math.PI + 0.12, 0.14);
      inner.scale.setScalar(1.05);
      break;
    case 'gas_can':
      inner.position.set(0.08, -0.14, -0.12);
      inner.rotation.set(0.08, Math.PI * 0.62, 0.05);
      inner.scale.setScalar(0.88);
      break;
    case 'car_battery':
      inner.position.set(0.0, -0.15, -0.18);
      inner.rotation.set(0.12, Math.PI - 0.08, 0);
      inner.scale.setScalar(0.86);
      break;
    case 'alarm_clock':
      inner.position.set(0.03, -0.04, -0.06);
      inner.rotation.set(0.1, Math.PI - 0.24, 0.05);
      inner.scale.setScalar(1.15);
      break;
  }

  root.add(inner);
  return root;
}

// ---------------------------------------------------------------------------
// 2. SECURITY BUNKER (CABINE 09-A) SETPIECE
// ---------------------------------------------------------------------------

export interface SecurityBunkerRig {
  root: THREE.Group;
  fanBlades: THREE.Group;
  blinkingLeds: THREE.Mesh[];
  lureLever: THREE.Group;
  batteryBars: THREE.Mesh[];
  blastDoorPistons: THREE.Group[];
  update: (elapsedSec: number, batteryRatio?: number, lureActive?: boolean) => void;
}

export function createSecurityBunkerSetpiece(): SecurityBunkerRig {
  const root = new THREE.Group();
  root.name = 'security_bunker_cabine_09a';

  const steelDark = sharedMat({ color: 0x1e293b, roughness: 0.56, metalness: 0.78 });
  const steelMid = sharedMat({ color: 0x334155, roughness: 0.46, metalness: 0.84 });
  const steelLight = sharedMat({ color: 0x64748b, roughness: 0.34, metalness: 0.9 });
  const chrome = sharedMat({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.96 });
  const cableRubber = sharedMat({ color: 0x0f172a, roughness: 0.86, metalness: 0.08 });
  const hazardYellow = sharedMat({ color: 0xfacc15, roughness: 0.5, metalness: 0.2 });
  const hazardBlack = sharedMat({ color: 0x111827, roughness: 0.65, metalness: 0.15 });
  const crtBody = sharedMat({ color: 0x272b36, roughness: 0.64, metalness: 0.42 });
  const crtScanline = sharedMat({
    color: 0x0f3d2e,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0x22c55e,
    emissiveIntensity: 0.85,
  });
  const crtAmber = sharedMat({
    color: 0x451a03,
    roughness: 0.15,
    metalness: 0.1,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
  });

  // --- Beveled metallic control console desk ---
  addBox(root, 2.35, 0.09, 0.92, 0, 0.82, 0, steelMid); // Main tabletop
  addBox(root, 2.26, 0.05, 0.86, 0, 0.75, 0, steelDark); // Underside bevel
  addBox(root, 2.35, 0.14, 0.28, 0, 0.92, -0.34, steelDark); // Raised monitor shelf
  addBox(root, 0.16, 0.78, 0.84, -1.06, 0.39, 0, steelDark); // Left pedestal leg
  addBox(root, 0.16, 0.78, 0.84, 1.06, 0.39, 0, steelDark); // Right pedestal leg
  addBox(root, 1.96, 0.62, 0.08, 0, 0.38, -0.34, steelDark); // Rear modesty panel
  addBox(root, 2.32, 0.09, 0.12, 0, 0.86, 0.44, steelLight, 0.35, 0, 0); // Angled wrist bolster

  // --- Voxel keyboard ---
  addBox(root, 0.56, 0.032, 0.22, -0.14, 0.88, 0.22, cableRubber, 0.08, 0, 0);
  addBox(root, 0.5, 0.016, 0.038, -0.14, 0.9, 0.155, steelLight, 0.08, 0, 0);
  addBox(root, 0.5, 0.016, 0.038, -0.14, 0.896, 0.205, steelLight, 0.08, 0, 0);
  addBox(root, 0.5, 0.016, 0.038, -0.14, 0.892, 0.255, steelLight, 0.08, 0, 0);
  addBox(root, 0.22, 0.016, 0.028, -0.14, 0.888, 0.295, steelMid, 0.08, 0, 0);

  // --- Glowing tactical buttons ---
  addBox(root, 0.42, 0.04, 0.24, 0.46, 0.88, 0.2, steelDark, 0.12, 0, 0);
  const btnColors = [0xef4444, 0x38bdf8, 0x22c55e, 0xf59e0b, 0xa855f7, 0xef4444];
  for (let i = 0; i < btnColors.length; i++) {
    const col = btnColors[i];
    const row = Math.floor(i / 3);
    const colIdx = i % 3;
    const bMat = sharedMat({
      color: col,
      roughness: 0.25,
      metalness: 0.1,
      emissive: col,
      emissiveIntensity: 1.25,
    });
    addBox(
      root,
      0.068,
      0.028,
      0.056,
      0.35 + colIdx * 0.11,
      0.91 - row * 0.012,
      0.14 + row * 0.1,
      bMat,
      0.12,
      0,
      0
    );
  }

  // --- Remote Lure pull-lever ---
  addBox(root, 0.14, 0.075, 0.24, 0.88, 0.89, 0.18, steelDark);
  addBox(root, 0.036, 0.02, 0.18, 0.88, 0.93, 0.18, cableRubber);
  const lureLever = new THREE.Group();
  lureLever.name = 'bunker_lure_lever';
  lureLever.position.set(0.88, 0.92, 0.18);
  addCyl(lureLever, 0.014, 0.014, 0.24, 8, 0, 0.11, 0, chrome);
  addCyl(lureLever, 0.026, 0.026, 0.12, 8, 0, 0.23, 0, sharedMat({ color: 0xdc2626, roughness: 0.35, metalness: 0.15 }), 0, 0, Math.PI * 0.5);
  addBox(lureLever, 0.03, 0.028, 0.03, 0, 0.23, 0, hazardYellow);
  lureLever.rotation.x = -0.36;
  root.add(lureLever);

  // --- 4 Deep-housing CRT monitors with curved-step bezels & emissive scanline screens ---
  const crtLayout: [number, number, number][] = [
    [-0.78, 1.22, 0.24],
    [-0.26, 1.22, 0.08],
    [0.26, 1.22, -0.08],
    [0.78, 1.22, -0.24],
  ];
  for (let i = 0; i < crtLayout.length; i++) {
    const [mx, my, rotY] = crtLayout[i];
    const mon = new THREE.Group();
    mon.position.set(mx, my, -0.22);
    mon.rotation.y = rotY;
    // Deep CRT rear tube housing + main chassis + stepped front bezel + emissive screen
    addBox(mon, 0.32, 0.26, 0.24, 0, 0, -0.18, crtBody);
    addBox(mon, 0.44, 0.38, 0.16, 0, 0, -0.01, crtBody);
    addBox(mon, 0.46, 0.4, 0.04, 0, 0, 0.075, steelMid);
    addBox(mon, 0.37, 0.29, 0.02, 0, 0.015, 0.092, i === 2 ? crtAmber : crtScanline);
    // Pedestal neck
    addBox(mon, 0.14, 0.08, 0.14, 0, -0.21, -0.02, steelDark);
    root.add(mon);
  }

  // --- Thick wall conduit cables ---
  addCyl(root, 0.042, 0.042, 2.25, 8, -0.92, 1.45, -0.56, cableRubber);
  addCyl(root, 0.035, 0.035, 2.25, 8, -0.8, 1.45, -0.56, steelDark);
  addCyl(root, 0.038, 0.038, 1.8, 8, 0, 2.38, -0.56, cableRubber, 0, 0, Math.PI * 0.5);
  addBox(root, 0.32, 0.26, 0.14, -0.86, 2.38, -0.54, steelMid); // Junction box

  // --- Server rack with blinking LED array ---
  const rackX = -1.55;
  addBox(root, 0.62, 2.08, 0.68, rackX, 1.04, -0.15, steelDark);
  addBox(root, 0.56, 0.06, 0.64, rackX, 2.08, -0.15, steelMid);
  const blinkingLeds: THREE.Mesh[] = [];
  const ledColors = [0x22c55e, 0x38bdf8, 0xf59e0b, 0xef4444, 0x22c55e, 0x38bdf8];
  for (let u = 0; u < 4; u++) {
    const uy = 0.42 + u * 0.42;
    addBox(root, 0.54, 0.32, 0.06, rackX, uy, 0.19, steelMid);
    addBox(root, 0.44, 0.08, 0.07, rackX, uy - 0.07, 0.2, cableRubber); // Cooling vent louver
  }
  for (let i = 0; i < ledColors.length; i++) {
    const col = ledColors[i];
    const ledMat = uniqueMat({
      color: col,
      emissive: col,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.05,
    });
    const led = addBox(
      root,
      0.032,
      0.024,
      0.02,
      rackX - 0.18 + (i % 3) * 0.075,
      1.72 - Math.floor(i / 3) * 0.42,
      0.225,
      ledMat,
      0,
      0,
      0,
      false,
      `bunker_led_${i}`
    );
    blinkingLeds.push(led);
  }

  // --- Spinning exhaust fan (`fanBlades`) ---
  const fanX = 0.0;
  const fanY = 2.08;
  const fanZ = -0.52;
  addBox(root, 0.62, 0.62, 0.16, fanX, fanY, fanZ, steelDark);
  addCyl(root, 0.26, 0.26, 0.18, 12, fanX, fanY, fanZ + 0.01, steelMid, Math.PI * 0.5, 0, 0);
  // Protective fan cage bars
  addBox(root, 0.54, 0.02, 0.02, fanX, fanY, fanZ + 0.11, chrome);
  addBox(root, 0.02, 0.54, 0.02, fanX, fanY, fanZ + 0.11, chrome);

  const fanBlades = new THREE.Group();
  fanBlades.name = 'bunker_fan_blades';
  fanBlades.position.set(fanX, fanY, fanZ + 0.04);
  addCyl(fanBlades, 0.055, 0.055, 0.06, 8, 0, 0, 0, chrome, Math.PI * 0.5, 0, 0);
  for (let b = 0; b < 4; b++) {
    const angle = (b * Math.PI) / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.21, 0.014), steelLight);
    blade.position.set(Math.cos(angle) * 0.125, Math.sin(angle) * 0.125, 0);
    blade.rotation.set(0.26, 0, angle - Math.PI * 0.5);
    blade.castShadow = true;
    fanBlades.add(blade);
  }
  root.add(fanBlades);

  // --- Auxiliary battery LED indicator strip (`batteryBars`) ---
  const meterX = 1.06;
  addBox(root, 0.24, 0.66, 0.1, meterX, 1.56, -0.48, steelDark);
  addBox(root, 0.18, 0.58, 0.04, meterX, 1.56, -0.42, cableRubber);
  const batteryBars: THREE.Mesh[] = [];
  const barColors = [0xef4444, 0xf97316, 0xfacc15, 0x84cc16, 0x22c55e];
  for (let i = 0; i < barColors.length; i++) {
    const col = barColors[i];
    const barMat = uniqueMat({
      color: col,
      emissive: col,
      emissiveIntensity: 1.35,
      roughness: 0.22,
      metalness: 0.05,
    });
    const bar = addBox(
      root,
      0.14,
      0.075,
      0.025,
      meterX,
      1.34 + i * 0.11,
      -0.395,
      barMat,
      0,
      0,
      0,
      false,
      `bunker_battery_bar_${i}`
    );
    batteryBars.push(bar);
  }

  // --- Animated Hydraulic Blast Door Pistons with yellow/black hazard stripes ---
  const blastDoorPistons: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const px = side * 1.62;
    const pz = 0.72;
    // Heavy blast door jamb + hazard stripe header blocks
    addBox(root, 0.26, 2.35, 0.28, px, 1.175, pz, steelDark);
    for (let s = 0; s < 4; s++) {
      addBox(
        root,
        0.28,
        0.16,
        0.3,
        px,
        0.24 + s * 0.18,
        pz,
        s % 2 === 0 ? hazardYellow : hazardBlack
      );
    }
    const pistonGroup = new THREE.Group();
    pistonGroup.name = side < 0 ? 'bunker_blast_piston_left' : 'bunker_blast_piston_right';
    pistonGroup.position.set(px - side * 0.18, 1.98, pz);
    addCyl(pistonGroup, 0.068, 0.068, 0.56, 8, 0, 0.2, 0, hazardYellow);
    addCyl(pistonGroup, 0.036, 0.036, 0.52, 8, 0, -0.22, 0, chrome);
    addBox(pistonGroup, 0.16, 0.08, 0.16, 0, -0.48, 0, steelMid);
    root.add(pistonGroup);
    blastDoorPistons.push(pistonGroup);
  }

  return {
    root,
    fanBlades,
    blinkingLeds,
    lureLever,
    batteryBars,
    blastDoorPistons,
    update(elapsedSec: number, batteryRatio = 1, lureActive = false) {
      fanBlades.rotation.z = elapsedSec * 5.4;
      for (let i = 0; i < blinkingLeds.length; i++) {
        const mat = blinkingLeds[i].material as THREE.MeshStandardMaterial;
        const pulse = Math.sin(elapsedSec * (3.2 + i * 1.15) + i * 1.7);
        mat.emissiveIntensity = pulse > 0.1 ? 1.85 : 0.12;
      }
      const litCount = Math.ceil(Math.max(0, Math.min(1, batteryRatio)) * batteryBars.length);
      for (let i = 0; i < batteryBars.length; i++) {
        const mat = batteryBars[i].material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = i < litCount ? 1.45 : 0.06;
      }
      lureLever.rotation.x = lureActive ? 0.42 : -0.36;
      const pistonBob = Math.sin(elapsedSec * 1.8) * 0.025;
      for (let i = 0; i < blastDoorPistons.length; i++) {
        blastDoorPistons[i].position.y = 1.98 + pistonBob;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 3. NEW MANSION WINGS & ARCHITECTURAL DETAIL SETPIECES
// ---------------------------------------------------------------------------

export interface GarageEscapeCarRig {
  root: THREE.Group;
  hoodPivot: THREE.Group;
  headlights: THREE.Mesh[];
  batterySlot: THREE.Group;
  fuelCap: THREE.Mesh;
  wheels: THREE.Group[];
}

export function createGarageEscapeCarRig(): GarageEscapeCarRig {
  const root = new THREE.Group();
  root.name = 'garage_escape_car';

  const bodyPaint = sharedMat({ color: 0x1e3a5f, roughness: 0.42, metalness: 0.45 });
  const bodyTrim = sharedMat({ color: 0x0f172a, roughness: 0.65, metalness: 0.25 });
  const chrome = sharedMat({ color: 0xdbe4ef, roughness: 0.2, metalness: 0.96 });
  const tireMat = sharedMat({ color: 0x141518, roughness: 0.9, metalness: 0.05 });
  const glassMat = sharedMat({
    color: 0x93c5fd,
    roughness: 0.1,
    metalness: 0.25,
    transparent: true,
    opacity: 0.48,
  });
  const engineMetal = sharedMat({ color: 0x64748b, roughness: 0.44, metalness: 0.85 });
  const rustAccent = sharedMat({ color: 0x7c2d12, roughness: 0.82, metalness: 0.35 });
  const headGlow = uniqueMat({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.1,
  });
  const tailGlow = sharedMat({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.15,
    roughness: 0.2,
    metalness: 0.1,
  });

  // Lower chassis undercarriage + front & rear bumpers
  addBox(root, 1.84, 0.24, 4.18, 0, 0.44, 0, bodyTrim);
  addBox(root, 1.94, 0.18, 0.22, 0, 0.46, 2.15, chrome);
  addBox(root, 1.94, 0.18, 0.22, 0, 0.46, -2.15, chrome);

  // Main side body panels, rear trunk deck, front fenders leaving open engine bay
  addBox(root, 1.86, 0.48, 2.65, 0, 0.78, -0.72, bodyPaint); // Cabin lower & trunk
  addBox(root, 0.32, 0.46, 1.48, -0.77, 0.78, 1.32, bodyPaint); // Left front fender
  addBox(root, 0.32, 0.46, 1.48, 0.77, 0.78, 1.32, bodyPaint); // Right front fender
  addBox(root, 1.86, 0.42, 0.14, 0, 0.76, 2.02, bodyPaint); // Front nose fascia
  addBox(root, 1.12, 0.24, 0.08, 0, 0.74, 2.09, bodyTrim); // Radiator grille

  // Glowing headlights + chrome bezels + taillights
  const headlights: THREE.Mesh[] = [];
  for (const sx of [-0.68, 0.68]) {
    addBox(root, 0.3, 0.2, 0.08, sx, 0.78, 2.07, chrome);
    const hl = addBox(root, 0.24, 0.14, 0.05, sx, 0.78, 2.11, headGlow, 0, 0, 0, false);
    headlights.push(hl);
    addBox(root, 0.28, 0.16, 0.06, sx, 0.82, -2.07, tailGlow, 0, 0, 0, false);
  }

  // Upper cabin roof, 4 roof pillars, front windshield & rear glass
  addBox(root, 1.62, 0.1, 1.72, 0, 1.56, -0.35, bodyPaint); // Roof
  addBox(root, 0.1, 0.56, 0.12, -0.74, 1.28, 0.46, bodyPaint, -0.26, 0, 0); // A-pillar L
  addBox(root, 0.1, 0.56, 0.12, 0.74, 1.28, 0.46, bodyPaint, -0.26, 0, 0); // A-pillar R
  addBox(root, 0.12, 0.56, 0.16, -0.74, 1.28, -1.16, bodyPaint, 0.2, 0, 0); // C-pillar L
  addBox(root, 0.12, 0.56, 0.16, 0.74, 1.28, -1.16, bodyPaint, 0.2, 0, 0); // C-pillar R
  addBox(root, 1.46, 0.52, 0.05, 0, 1.28, 0.48, glassMat, -0.34, 0, 0, false); // Windshield
  addBox(root, 1.44, 0.48, 0.05, 0, 1.28, -1.18, glassMat, 0.28, 0, 0, false); // Rear glass

  // Open hood pivot revealing engine block & battery bay
  const hoodPivot = new THREE.Group();
  hoodPivot.name = 'escape_car_hood';
  hoodPivot.position.set(0, 1.02, 0.62);
  addBox(hoodPivot, 1.52, 0.07, 1.38, 0, 0.02, 0.7, bodyPaint);
  addBox(hoodPivot, 1.32, 0.04, 1.18, 0, -0.02, 0.7, bodyTrim); // Hood liner
  hoodPivot.rotation.x = -0.62; // Propped open!
  root.add(hoodPivot);
  // Metal hood prop rod
  addCyl(root, 0.015, 0.015, 0.76, 6, 0.68, 1.24, 1.48, chrome, 0.24, 0, 0);

  // Detailed exposed engine bay (V8 block, air filter drum, radiator, battery slot)
  addBox(root, 0.62, 0.42, 0.72, 0, 0.74, 1.32, engineMetal);
  addCyl(root, 0.2, 0.2, 0.12, 10, 0, 0.99, 1.32, rustAccent); // Air cleaner drum
  addBox(root, 1.06, 0.36, 0.12, 0, 0.74, 1.88, bodyTrim); // Radiator core

  const batterySlot = new THREE.Group();
  batterySlot.name = 'escape_car_battery_slot';
  batterySlot.position.set(-0.46, 0.76, 1.56);
  addBox(batterySlot, 0.34, 0.04, 0.24, 0, -0.1, 0, engineMetal); // Battery tray
  addBox(
    batterySlot,
    0.04,
    0.04,
    0.16,
    -0.12,
    0,
    -0.12,
    sharedMat({ color: 0xdc2626, roughness: 0.6, metalness: 0.15 })
  ); // Red cable lead
  root.add(batterySlot);

  // Side recessed fuel cap hatch on right rear fender
  const fuelCap = addCyl(
    root,
    0.085,
    0.085,
    0.04,
    8,
    0.94,
    0.86,
    -1.46,
    chrome,
    0,
    0,
    Math.PI * 0.5,
    true,
    'escape_car_fuel_cap'
  );

  // 4 detailed wheels (tire + alloy rim + chrome hubcap = 3 meshes each)
  const wheels: THREE.Group[] = [];
  const wheelPos: [number, number][] = [
    [-0.94, 1.32],
    [0.94, 1.32],
    [-0.94, -1.28],
    [0.94, -1.28],
  ];
  for (let i = 0; i < wheelPos.length; i++) {
    const [wx, wz] = wheelPos[i];
    const wg = new THREE.Group();
    wg.position.set(wx, 0.36, wz);
    addCyl(wg, 0.36, 0.36, 0.26, 12, 0, 0, 0, tireMat, 0, 0, Math.PI * 0.5);
    addCyl(wg, 0.21, 0.21, 0.28, 10, 0, 0, 0, engineMetal, 0, 0, Math.PI * 0.5);
    addCyl(wg, 0.1, 0.1, 0.3, 8, 0, 0, 0, chrome, 0, 0, Math.PI * 0.5);
    root.add(wg);
    wheels.push(wg);
  }

  return { root, hoodPivot, headlights, batterySlot, fuelCap, wheels };
}

export interface ToolShedRig {
  root: THREE.Group;
  padlockGroup: THREE.Group;
  doorPivot: THREE.Group;
}

export function createToolShedRig(): ToolShedRig {
  const root = new THREE.Group();
  root.name = 'tool_shed_rig';

  const concrete = sharedMat({ color: 0x64748b, roughness: 0.92, metalness: 0.04 });
  const plankDark = sharedMat({ color: 0x452b18, roughness: 0.88, metalness: 0.04 });
  const plankMid = sharedMat({ color: 0x5c3a21, roughness: 0.85, metalness: 0.04 });
  const roofTin = sharedMat({ color: 0x3f4752, roughness: 0.62, metalness: 0.72 });
  const ironMat = sharedMat({ color: 0x1f2937, roughness: 0.45, metalness: 0.88 });
  const brassMat = sharedMat({ color: 0xd97706, roughness: 0.28, metalness: 0.92 });
  const redPaint = sharedMat({ color: 0xb91c1c, roughness: 0.52, metalness: 0.25 });

  // Concrete foundation slab
  addBox(root, 2.7, 0.14, 2.4, 0, 0.07, 0, concrete);

  // Corner framing posts (4 pieces)
  for (const [cx, cz] of [
    [-1.22, -1.08],
    [1.22, -1.08],
    [-1.22, 1.08],
    [1.22, 1.08],
  ]) {
    const h = cz < 0 ? 2.15 : 2.52;
    addBox(root, 0.14, h, 0.14, cx, 0.14 + h * 0.5, cz, plankDark);
  }

  // Planked walls (back, left, right, front flanking door jambs)
  addBox(root, 2.44, 2.1, 0.1, 0, 1.19, -1.08, plankMid);
  addBox(root, 0.1, 2.32, 2.16, -1.22, 1.3, 0, plankMid);
  addBox(root, 0.1, 2.32, 2.16, 1.22, 1.3, 0, plankMid);
  // Horizontal wall batten planks
  addBox(root, 2.5, 0.1, 0.06, 0, 1.2, -1.14, plankDark);
  addBox(root, 0.06, 0.1, 2.2, -1.28, 1.3, 0, plankDark);
  addBox(root, 0.06, 0.1, 2.2, 1.28, 1.3, 0, plankDark);

  // Front wall flanks & doorframe header
  addBox(root, 0.68, 2.46, 0.1, -0.88, 1.37, 1.08, plankMid);
  addBox(root, 0.68, 2.46, 0.1, 0.88, 1.37, 1.08, plankMid);
  addBox(root, 1.14, 0.42, 0.14, 0, 2.41, 1.08, plankDark);

  // Hinged shed door with Z-brace
  const doorPivot = new THREE.Group();
  doorPivot.name = 'tool_shed_door';
  doorPivot.position.set(-0.52, 0.14, 1.1);
  addBox(doorPivot, 1.02, 2.04, 0.08, 0.51, 1.02, 0, plankMid);
  addBox(doorPivot, 0.96, 0.12, 0.04, 0.51, 1.82, 0.05, plankDark);
  addBox(doorPivot, 0.96, 0.12, 0.04, 0.51, 0.26, 0.05, plankDark);
  addBox(doorPivot, 0.12, 1.65, 0.04, 0.51, 1.04, 0.05, plankDark, 0, 0, 0.48);
  root.add(doorPivot);

  // Chained padlock on doorframe (`padlockGroup`)
  const padlockGroup = new THREE.Group();
  padlockGroup.name = 'tool_shed_padlock';
  padlockGroup.position.set(0.46, 1.18, 1.18);
  addBox(padlockGroup, 0.24, 0.055, 0.03, 0, 0.04, 0, ironMat); // Iron hasp
  addBox(padlockGroup, 0.05, 0.08, 0.03, -0.06, -0.02, 0.02, ironMat); // Chain link 1
  addBox(padlockGroup, 0.05, 0.08, 0.03, 0.06, -0.02, 0.02, ironMat); // Chain link 2
  addCyl(padlockGroup, 0.032, 0.032, 0.05, 8, 0, -0.04, 0.03, ironMat, Math.PI * 0.5, 0, 0); // Shackle
  addBox(padlockGroup, 0.1, 0.11, 0.05, 0, -0.11, 0.03, brassMat); // Brass padlock body
  root.add(padlockGroup);

  // Slanted corrugated roof with eaves & exposed rafters
  addBox(root, 3.05, 0.1, 2.86, 0, 2.54, 0, roofTin, -0.17, 0, 0);
  for (const rx of [-1.05, 0, 1.05]) {
    addBox(root, 0.1, 0.12, 2.75, rx, 2.44, 0, plankDark, -0.17, 0, 0);
  }

  // Interior tool shelf + hanging tool props
  addBox(root, 2.1, 0.07, 0.42, 0, 1.18, -0.8, plankDark);
  addBox(root, 2.1, 0.07, 0.42, 0, 1.66, -0.8, plankDark);
  addCyl(root, 0.11, 0.11, 0.24, 8, -0.62, 1.34, -0.78, redPaint); // Paint tin
  addBox(root, 0.36, 0.18, 0.22, 0.45, 1.31, -0.78, ironMat); // Metal toolbox

  return { root, padlockGroup, doorPivot };
}

export interface OuterGardenRig {
  root: THREE.Group;
  lampEmissive: THREE.Mesh;
  update: (elapsedSec: number) => void;
}

export function createOuterGardenProps(): OuterGardenRig {
  const root = new THREE.Group();
  root.name = 'outer_garden_props';

  const hedgeCore = sharedMat({ color: 0x14331b, roughness: 0.94, metalness: 0.02 });
  const hedgeOuter = sharedMat({ color: 0x1e4d28, roughness: 0.9, metalness: 0.02 });
  const hedgeMoss = sharedMat({ color: 0x2d6a36, roughness: 0.88, metalness: 0.02 });
  const stoneDark = sharedMat({ color: 0x4b5563, roughness: 0.9, metalness: 0.05 });
  const stoneLight = sharedMat({ color: 0x6b7280, roughness: 0.86, metalness: 0.06 });
  const ironMat = sharedMat({ color: 0x1f2937, roughness: 0.42, metalness: 0.88 });
  const lampGlass = sharedMat({
    color: 0xfef3c7,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: 0.4,
  });
  const lampBulbMat = uniqueMat({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.85,
    roughness: 0.18,
    metalness: 0.05,
  });

  // Multi-layered voxel hedges (left & rear garden hedge cluster)
  addBox(root, 2.2, 1.05, 0.72, -1.65, 0.525, -1.25, hedgeCore);
  addBox(root, 0.78, 0.68, 0.84, -2.25, 0.44, -1.22, hedgeOuter);
  addBox(root, 0.88, 0.76, 0.86, -1.45, 0.68, -1.26, hedgeOuter);
  addBox(root, 0.72, 0.62, 0.82, -0.82, 0.42, -1.2, hedgeMoss);
  addBox(root, 0.54, 0.36, 0.56, -1.75, 1.08, -1.24, hedgeMoss);

  // Broken stone statue on stepped pedestal
  const sx = 0.25;
  const sz = -1.1;
  addBox(root, 1.05, 0.22, 1.05, sx, 0.11, sz, stoneDark); // Bottom plinth
  addBox(root, 0.78, 0.68, 0.78, sx, 0.56, sz, stoneLight); // Pedestal column
  addBox(root, 0.86, 0.14, 0.86, sx, 0.96, sz, stoneDark); // Pedestal cornice
  addBox(root, 0.44, 0.58, 0.34, sx, 1.32, sz, stoneLight); // Cracked statue torso
  addBox(root, 0.18, 0.34, 0.18, sx - 0.28, 1.42, sz, stoneLight, 0, 0, 0.32); // Broken shoulder stump
  addBox(root, 0.26, 0.28, 0.26, sx + 0.56, 0.14, sz + 0.62, stoneLight, 0.24, 0.5, 0.4); // Fallen head fragment

  // Flickering wrought-iron streetlamp
  const lx = 1.65;
  const lz = -0.65;
  addCyl(root, 0.16, 0.24, 0.38, 8, lx, 0.19, lz, ironMat); // Fluted base
  addCyl(root, 0.065, 0.09, 2.75, 8, lx, 1.72, lz, ironMat); // Tall post
  addBox(root, 0.48, 0.06, 0.06, lx, 2.86, lz, ironMat); // Decorative cross-arm
  addCyl(root, 0.06, 0.24, 0.2, 6, lx, 3.46, lz, ironMat); // Lantern cap hood
  addBox(root, 0.28, 0.34, 0.28, lx, 3.22, lz, lampGlass, 0, 0, 0, false); // Glass housing
  const lampEmissive = addBox(
    root,
    0.12,
    0.18,
    0.12,
    lx,
    3.21,
    lz,
    lampBulbMat,
    0,
    0,
    0,
    false,
    'garden_streetlamp_bulb'
  );

  // Irregular mossy stepping stones (5 stones curving forward)
  const stones: [number, number, number, number, number][] = [
    [-0.95, 0.25, 0.52, 0.44, 0.18],
    [-0.32, 0.62, 0.48, 0.42, -0.22],
    [0.35, 0.92, 0.56, 0.45, 0.12],
    [0.98, 1.24, 0.46, 0.4, -0.3],
    [1.56, 1.52, 0.54, 0.44, 0.25],
  ];
  for (let i = 0; i < stones.length; i++) {
    const [px, pz, w, d, rot] = stones[i];
    addBox(root, w, 0.07, d, px, 0.035, pz, i % 2 === 0 ? stoneLight : stoneDark, 0, rot, 0);
  }

  return {
    root,
    lampEmissive,
    update(elapsedSec: number) {
      const n = Math.sin(elapsedSec * 19.3) * Math.sin(elapsedSec * 7.1);
      lampBulbMat.emissiveIntensity = n > 0.68 ? 0.22 : 1.75 + 0.25 * Math.sin(elapsedSec * 4.2);
    },
  };
}

export interface SecretAtticRig {
  root: THREE.Group;
  projectorBeam: THREE.Mesh;
  projectorLens: THREE.Mesh;
  update: (elapsedSec: number) => void;
}

export function createSecretAtticProps(): SecretAtticRig {
  const root = new THREE.Group();
  root.name = 'secret_attic_props';

  const rafterWood = sharedMat({ color: 0x422816, roughness: 0.88, metalness: 0.04 });
  const crateWood = sharedMat({ color: 0x7c5332, roughness: 0.84, metalness: 0.04 });
  const crateFrame = sharedMat({ color: 0x52341c, roughness: 0.88, metalness: 0.05 });
  const cabinetSteel = sharedMat({ color: 0x475569, roughness: 0.56, metalness: 0.72 });
  const folderManila = sharedMat({ color: 0xd6c08d, roughness: 0.85, metalness: 0.02 });
  const brassPull = sharedMat({ color: 0xd97706, roughness: 0.3, metalness: 0.9 });
  const projBody = sharedMat({ color: 0x1e293b, roughness: 0.52, metalness: 0.68 });
  const projLensMat = uniqueMat({
    color: 0xfef9c3,
    emissive: 0xfde68a,
    emissiveIntensity: 1.9,
    roughness: 0.12,
    metalness: 0.1,
  });
  const projBeamMat = uniqueMat({
    color: 0xfef3c7,
    emissive: 0xfde68a,
    emissiveIntensity: 0.65,
    roughness: 0.4,
    metalness: 0,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Slanted wooden roof rafters (2 A-frames + ridge beam + collar ties = 7 pieces)
  for (const rz of [-1.2, 1.2]) {
    addBox(root, 0.14, 2.65, 0.16, -1.05, 2.25, rz, rafterWood, 0, 0, -0.68);
    addBox(root, 0.14, 2.65, 0.16, 1.05, 2.25, rz, rafterWood, 0, 0, 0.68);
    addBox(root, 2.1, 0.12, 0.14, 0, 2.38, rz, rafterWood); // Collar tie
  }
  addBox(root, 0.18, 0.2, 2.85, 0, 3.24, 0, rafterWood); // Ridge beam

  // Stacked wooden crates with corner battens (left corner)
  const cratePositions: [number, number, number, number, number][] = [
    [-1.4, 0.35, -0.65, 0.7, 0.06],
    [-0.62, 0.3, -0.78, 0.6, -0.14],
    [-1.22, 0.96, -0.72, 0.54, 0.22],
  ];
  for (const [cx, cy, cz, sz, rot] of cratePositions) {
    const cg = new THREE.Group();
    cg.position.set(cx, cy, cz);
    cg.rotation.y = rot;
    addBox(cg, sz, sz, sz, 0, 0, 0, crateWood);
    addBox(cg, sz + 0.04, 0.07, sz + 0.04, 0, sz * 0.44, 0, crateFrame);
    addBox(cg, sz + 0.04, 0.07, sz + 0.04, 0, -sz * 0.44, 0, crateFrame);
    root.add(cg);
  }

  // Metal filing cabinets with half-open drawers & protruding folders (right side)
  const fx = 1.32;
  const fz = -0.6;
  addBox(root, 0.54, 1.34, 0.62, fx, 0.67, fz, cabinetSteel); // Cabinet 1
  addBox(root, 0.48, 0.28, 0.05, fx, 1.12, fz + 0.32, cabinetSteel); // Closed top drawer
  addBox(root, 0.12, 0.03, 0.03, fx, 1.12, fz + 0.36, brassPull);
  // Half-open middle drawer with manila files spilling out
  addBox(root, 0.46, 0.26, 0.42, fx, 0.78, fz + 0.44, cabinetSteel);
  addBox(root, 0.12, 0.03, 0.03, fx, 0.78, fz + 0.66, brassPull);
  addBox(root, 0.38, 0.24, 0.04, fx - 0.02, 0.86, fz + 0.46, folderManila, 0.16, 0.05, 0);
  addBox(root, 0.36, 0.24, 0.04, fx + 0.02, 0.85, fz + 0.54, folderManila, -0.12, -0.04, 0);
  // Second tilted cabinet beside it
  addBox(root, 0.52, 1.02, 0.58, fx - 0.58, 0.51, fz - 0.1, cabinetSteel, 0, 0.14, 0);

  // Vintage slide projector on wooden table casting an emissive light cone
  addBox(root, 0.64, 0.07, 0.56, 0, 0.74, 0.75, crateFrame); // Table top
  addBox(root, 0.07, 0.72, 0.07, -0.26, 0.36, 0.52, crateFrame);
  addBox(root, 0.07, 0.72, 0.07, 0.26, 0.36, 0.52, crateFrame);
  addBox(root, 0.07, 0.72, 0.07, -0.26, 0.36, 0.98, crateFrame);
  addBox(root, 0.07, 0.72, 0.07, 0.26, 0.36, 0.98, crateFrame);

  // Projector housing + slide carousel tray + glowing lens + emissive volumetric beam
  addBox(root, 0.32, 0.16, 0.34, 0, 0.86, 0.75, projBody);
  addCyl(root, 0.15, 0.15, 0.06, 12, 0, 0.98, 0.76, cabinetSteel); // Carousel slide wheel
  const projectorLens = addCyl(
    root,
    0.045,
    0.052,
    0.1,
    10,
    0,
    0.87,
    0.55,
    projLensMat,
    Math.PI * 0.5,
    0,
    0,
    false,
    'attic_projector_lens'
  );
  const projectorBeam = addCyl(
    root,
    0.045,
    0.68,
    1.85,
    12,
    0,
    0.92,
    -0.42,
    projBeamMat,
    Math.PI * 0.5 - 0.05,
    0,
    0,
    false,
    'attic_projector_beam'
  );

  return {
    root,
    projectorBeam,
    projectorLens,
    update(elapsedSec: number) {
      const flicker = 0.88 + 0.12 * Math.sin(elapsedSec * 24.0) * Math.cos(elapsedSec * 9.5);
      projLensMat.emissiveIntensity = 1.9 * flicker;
      projBeamMat.opacity = 0.16 * flicker;
    },
  };
}

// --- Mansion Detail Setpieces (Chandelier, Fireplace, Grandfather Clock) ---

export function createChandelierRig(): { root: THREE.Group; chandelierPivot: THREE.Group } {
  const root = new THREE.Group();
  root.name = 'mansion_chandelier';

  const iron = sharedMat({ color: 0x1c1e24, roughness: 0.42, metalness: 0.88 });
  const brass = sharedMat({ color: 0xd97706, roughness: 0.28, metalness: 0.92 });
  const candleWax = sharedMat({ color: 0xfef3c7, roughness: 0.75, metalness: 0.02 });
  const flameMat = sharedMat({
    color: 0xfef08a,
    emissive: 0xf97316,
    emissiveIntensity: 1.9,
    roughness: 0.15,
    metalness: 0,
  });
  const crystal = sharedMat({
    color: 0xe0f2fe,
    roughness: 0.08,
    metalness: 0.18,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.72,
  });

  // Ceiling rosette anchor
  addCyl(root, 0.14, 0.16, 0.06, 8, 0, 0, 0, iron);

  const chandelierPivot = new THREE.Group();
  chandelierPivot.name = 'chandelier_pivot';
  chandelierPivot.position.set(0, -0.03, 0);
  root.add(chandelierPivot);

  // Suspension chain + center iron core + lower crystal finial
  addCyl(chandelierPivot, 0.022, 0.022, 0.68, 6, 0, -0.34, 0, iron);
  addCyl(chandelierPivot, 0.12, 0.08, 0.18, 8, 0, -0.74, 0, iron);
  addCyl(chandelierPivot, 0.02, 0.06, 0.14, 6, 0, -0.89, 0, crystal, 0, 0, 0, false);

  // 4 radial forged iron arms with brass cups, wax candles, glowing flames & hanging crystal prisms
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    addBox(chandelierPivot, 0.42, 0.036, 0.036, dx * 0.24, -0.74, dz * 0.24, iron, 0, -a, 0);
    addCyl(chandelierPivot, 0.055, 0.038, 0.04, 8, dx * 0.44, -0.7, dz * 0.44, brass);
    addCyl(chandelierPivot, 0.026, 0.026, 0.13, 6, dx * 0.44, -0.62, dz * 0.44, candleWax);
    addBox(chandelierPivot, 0.024, 0.048, 0.024, dx * 0.44, -0.53, dz * 0.44, flameMat, 0, 0, 0, false);
    addBox(chandelierPivot, 0.032, 0.11, 0.032, dx * 0.44, -0.81, dz * 0.44, crystal, 0, Math.PI * 0.25, 0, false);
  }

  return { root, chandelierPivot };
}

export function createFireplaceRig(): {
  root: THREE.Group;
  emberLight: THREE.PointLight;
  emberMeshes: THREE.Mesh[];
} {
  const root = new THREE.Group();
  root.name = 'mansion_fireplace';

  const brickDark = sharedMat({ color: 0x4b2421, roughness: 0.9, metalness: 0.05 });
  const stoneMantel = sharedMat({ color: 0x57534e, roughness: 0.86, metalness: 0.06 });
  const sootBlack = sharedMat({ color: 0x111317, roughness: 0.96, metalness: 0.04 });
  const ironGrate = sharedMat({ color: 0x1f2937, roughness: 0.5, metalness: 0.85 });
  const charredLog = sharedMat({ color: 0x291c16, roughness: 0.94, metalness: 0.02 });

  // Hearth slab, pillars, mantel shelf, chimney breast, recessed firebox
  addBox(root, 1.92, 0.14, 0.86, 0, 0.07, 0.08, stoneMantel);
  addBox(root, 0.36, 1.18, 0.62, -0.72, 0.72, -0.02, brickDark);
  addBox(root, 0.36, 1.18, 0.62, 0.72, 0.72, -0.02, brickDark);
  addBox(root, 1.12, 1.12, 0.14, 0, 0.68, -0.26, sootBlack); // Back firebox wall
  addBox(root, 1.98, 0.14, 0.74, 0, 1.36, 0.02, stoneMantel); // Carved mantel shelf
  addBox(root, 1.54, 1.24, 0.54, 0, 2.04, -0.06, brickDark); // Upper chimney breast

  // Iron grate & 3 crossed charred firewood logs
  addBox(root, 0.82, 0.05, 0.34, 0, 0.22, -0.02, ironGrate);
  addCyl(root, 0.07, 0.075, 0.68, 7, -0.06, 0.3, -0.04, charredLog, 0, 0.22, Math.PI * 0.5);
  addCyl(root, 0.065, 0.07, 0.64, 7, 0.08, 0.34, 0.02, charredLog, 0, -0.35, Math.PI * 0.5);
  addCyl(root, 0.06, 0.065, 0.54, 7, 0, 0.42, -0.02, charredLog, 0.25, 0.1, Math.PI * 0.42);

  // Glowing embers & flickering flame voxels (5 pieces)
  const emberMeshes: THREE.Mesh[] = [];
  const emberSpecs: [number, number, number, number, number, number][] = [
    [-0.2, 0.26, 0.05, 0.14, 0.07, 0xea580c],
    [0.02, 0.28, 0.02, 0.18, 0.09, 0xf97316],
    [0.22, 0.26, -0.03, 0.14, 0.07, 0xdc2626],
    [-0.08, 0.48, 0.0, 0.12, 0.22, 0xf59e0b],
    [0.1, 0.52, 0.02, 0.1, 0.26, 0xfacc15],
  ];
  for (let i = 0; i < emberSpecs.length; i++) {
    const [ex, ey, ez, w, h, col] = emberSpecs[i];
    const emMat = uniqueMat({
      color: col,
      emissive: col,
      emissiveIntensity: 1.7,
      roughness: 0.2,
      metalness: 0,
    });
    const m = addBox(root, w, h, w, ex, ey, ez, emMat, 0, i * 0.4, 0, false);
    emberMeshes.push(m);
  }

  const emberLight = new THREE.PointLight(0xff7b29, 2.2, 7.5, 1.8);
  emberLight.position.set(0, 0.55, 0.32);
  root.add(emberLight);

  return { root, emberLight, emberMeshes };
}

export function createGrandfatherClockRig(): { root: THREE.Group; pendulumPivot: THREE.Group } {
  const root = new THREE.Group();
  root.name = 'mansion_grandfather_clock';

  const mahogany = sharedMat({ color: 0x3b1d12, roughness: 0.64, metalness: 0.08 });
  const trimWood = sharedMat({ color: 0x522a1a, roughness: 0.58, metalness: 0.1 });
  const brass = sharedMat({ color: 0xeab308, roughness: 0.24, metalness: 0.94 });
  const ivoryDial = sharedMat({ color: 0xfef3c7, roughness: 0.55, metalness: 0.02 });
  const handBlack = sharedMat({ color: 0x0f172a, roughness: 0.4, metalness: 0.3 });
  const glassFront = sharedMat({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.26,
  });

  // Stepped plinth base
  addBox(root, 0.64, 0.14, 0.44, 0, 0.07, 0, mahogany);
  addBox(root, 0.56, 0.34, 0.38, 0, 0.31, 0, trimWood);

  // Hollow trunk cabinet (back + left & right walls + glass door) so pendulum is visible!
  addBox(root, 0.48, 1.12, 0.08, 0, 1.04, -0.14, mahogany);
  addBox(root, 0.08, 1.12, 0.34, -0.2, 1.04, 0, mahogany);
  addBox(root, 0.08, 1.12, 0.34, 0.2, 1.04, 0, mahogany);
  addBox(root, 0.34, 1.02, 0.02, 0, 1.04, 0.16, glassFront, 0, 0, 0, false);

  // Clock head hood + crown molding + decorative finials
  addBox(root, 0.58, 0.56, 0.4, 0, 1.88, 0, mahogany);
  addBox(root, 0.66, 0.1, 0.46, 0, 2.21, 0, trimWood);
  addCyl(root, 0.025, 0.045, 0.14, 6, -0.24, 2.33, 0, brass);
  addCyl(root, 0.025, 0.045, 0.14, 6, 0.24, 2.33, 0, brass);
  addCyl(root, 0.032, 0.055, 0.18, 6, 0, 2.35, 0, brass);

  // Ivory dial face + brass bezel + hands
  addCyl(root, 0.19, 0.19, 0.03, 12, 0, 1.88, 0.2, brass, Math.PI * 0.5, 0, 0);
  addCyl(root, 0.165, 0.165, 0.035, 12, 0, 1.88, 0.205, ivoryDial, Math.PI * 0.5, 0, 0);
  addBox(root, 0.018, 0.1, 0.012, -0.02, 1.91, 0.228, handBlack, 0, 0, 0.45);
  addBox(root, 0.014, 0.13, 0.012, 0.03, 1.92, 0.23, handBlack, 0, 0, -0.62);

  // Articulated brass pendulum (`pendulumPivot`)
  const pendulumPivot = new THREE.Group();
  pendulumPivot.name = 'clock_pendulum_pivot';
  pendulumPivot.position.set(0, 1.54, 0.02);
  addCyl(pendulumPivot, 0.012, 0.012, 0.72, 6, 0, -0.36, 0, brass);
  addCyl(pendulumPivot, 0.085, 0.085, 0.035, 10, 0, -0.76, 0, brass, Math.PI * 0.5, 0, 0);
  root.add(pendulumPivot);

  return { root, pendulumPivot };
}

export interface MansionDetailRig {
  root: THREE.Group;
  chandelierPivot: THREE.Group;
  fireplaceGroup: THREE.Group;
  emberLight: THREE.PointLight;
  emberMeshes: THREE.Mesh[];
  grandfatherClockGroup: THREE.Group;
  pendulumPivot: THREE.Group;
  update: (elapsedSec: number) => void;
}

export function createMansionDetailProps(): MansionDetailRig {
  const root = new THREE.Group();
  root.name = 'mansion_detail_props';

  const chandelier = createChandelierRig();
  chandelier.root.position.set(0, 3.2, 0);
  root.add(chandelier.root);

  const fireplace = createFireplaceRig();
  fireplace.root.position.set(-1.8, 0, -1.5);
  root.add(fireplace.root);

  const clock = createGrandfatherClockRig();
  clock.root.position.set(1.8, 0, -1.5);
  root.add(clock.root);

  return {
    root,
    chandelierPivot: chandelier.chandelierPivot,
    fireplaceGroup: fireplace.root,
    emberLight: fireplace.emberLight,
    emberMeshes: fireplace.emberMeshes,
    grandfatherClockGroup: clock.root,
    pendulumPivot: clock.pendulumPivot,
    update(elapsedSec: number) {
      chandelier.chandelierPivot.rotation.z = Math.sin(elapsedSec * 1.15) * 0.075;
      chandelier.chandelierPivot.rotation.x = Math.cos(elapsedSec * 0.85) * 0.035;
      clock.pendulumPivot.rotation.z = Math.sin(elapsedSec * Math.PI) * 0.16;

      const flameFlicker = 0.82 + 0.18 * Math.sin(elapsedSec * 13.7) + 0.1 * Math.cos(elapsedSec * 23.1);
      fireplace.emberLight.intensity = 2.2 * flameFlicker;
      for (let i = 0; i < fireplace.emberMeshes.length; i++) {
        const m = fireplace.emberMeshes[i];
        const mat = m.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 1.4 + 0.55 * Math.sin(elapsedSec * (9 + i * 2.3) + i);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// 4. PUZZLES & 4-STAGE FINAL GATE
// ---------------------------------------------------------------------------

export interface FalseBookshelfRig {
  root: THREE.Group;
  shelfPivot: THREE.Group;
  emblemSunSlot: THREE.Group;
  emblemMoonSlot: THREE.Group;
  sunGlow: THREE.Mesh;
  moonGlow: THREE.Mesh;
}

export function createFalseBookshelfRig(): FalseBookshelfRig {
  const root = new THREE.Group();
  root.name = 'puzzle_false_bookshelf';

  const woodDark = sharedMat({ color: 0x3b1f13, roughness: 0.72, metalness: 0.06 });
  const woodMid = sharedMat({ color: 0x542c1a, roughness: 0.68, metalness: 0.06 });
  const stonePedestal = sharedMat({ color: 0x475569, roughness: 0.78, metalness: 0.16 });
  const goldTrim = sharedMat({ color: 0xf59e0b, roughness: 0.25, metalness: 0.92 });
  const silverTrim = sharedMat({ color: 0xcbd5e1, roughness: 0.22, metalness: 0.94 });
  const ironRail = sharedMat({ color: 0x1e293b, roughness: 0.45, metalness: 0.85 });

  // Hidden floor slide track rail
  addBox(root, 2.8, 0.03, 0.12, 0.4, 0.015, 0, ironRail);

  const shelfPivot = new THREE.Group();
  shelfPivot.name = 'false_bookshelf_body';
  root.add(shelfPivot);

  // Tall wooden bookcase carcass
  addBox(shelfPivot, 1.88, 0.14, 0.52, 0, 0.07, 0, woodDark); // Plinth
  addBox(shelfPivot, 1.94, 0.14, 0.56, 0, 2.38, 0, woodDark); // Top cornice
  addBox(shelfPivot, 0.1, 2.24, 0.48, -0.89, 1.22, 0, woodMid); // Left side
  addBox(shelfPivot, 0.1, 2.24, 0.48, 0.89, 1.22, 0, woodMid); // Right side
  addBox(shelfPivot, 1.76, 2.24, 0.06, 0, 1.22, -0.21, woodDark); // Backboard

  // 4 interior shelf planks
  const shelfYs = [0.52, 1.02, 1.54, 1.96];
  for (const sy of shelfYs) {
    addBox(shelfPivot, 1.72, 0.05, 0.44, 0, sy, 0.01, woodMid);
  }

  // Varied colored voxel books across shelves (12 distinct books)
  const bookPalette = [0x991b1b, 0x1e3a8a, 0x166534, 0x92400e, 0x581c87, 0x334155];
  const bookPlacements: [number, number, number, number, number][] = [
    [-0.68, 0.545, 0.08, 0.34, 0],
    [-0.56, 0.545, 0.07, 0.31, 0],
    [-0.45, 0.545, 0.09, 0.36, -0.06],
    [0.42, 0.545, 0.08, 0.32, 0],
    [0.54, 0.545, 0.09, 0.35, 0.08],
    [-0.66, 1.565, 0.08, 0.31, 0],
    [-0.54, 1.565, 0.07, 0.29, 0],
    [-0.38, 1.565, 0.08, 0.33, -0.14],
    [0.45, 1.565, 0.09, 0.32, 0],
    [0.62, 1.565, 0.08, 0.3, 0.1],
    [-0.22, 1.985, 0.09, 0.31, 0],
    [0.18, 1.985, 0.08, 0.32, -0.08],
  ];
  for (let i = 0; i < bookPlacements.length; i++) {
    const [bx, baseY, bw, bh, tilt] = bookPlacements[i];
    const bMat = sharedMat({ color: bookPalette[i % bookPalette.length], roughness: 0.78, metalness: 0.04 });
    addBox(shelfPivot, bw, bh, 0.3, bx, baseY + bh * 0.5, 0.04, bMat, 0, 0, tilt);
  }

  // 2 Illuminated Emblem Pedestals on centerpiece shelf (y = 1.045)
  const emblemSunSlot = new THREE.Group();
  emblemSunSlot.name = 'emblem_sun_slot';
  emblemSunSlot.position.set(-0.42, 1.05, 0.08);
  addBox(emblemSunSlot, 0.32, 0.08, 0.28, 0, 0.04, 0, stonePedestal);
  addCyl(emblemSunSlot, 0.11, 0.12, 0.06, 8, 0, 0.16, 0.04, goldTrim, Math.PI * 0.5, 0, 0);
  const sunGlow = addCyl(
    emblemSunSlot,
    0.075,
    0.075,
    0.07,
    8,
    0,
    0.16,
    0.05,
    uniqueMat({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.4, roughness: 0.2 }),
    Math.PI * 0.5,
    0,
    0,
    false
  );
  shelfPivot.add(emblemSunSlot);

  const emblemMoonSlot = new THREE.Group();
  emblemMoonSlot.name = 'emblem_moon_slot';
  emblemMoonSlot.position.set(0.42, 1.05, 0.08);
  addBox(emblemMoonSlot, 0.32, 0.08, 0.28, 0, 0.04, 0, stonePedestal);
  addCyl(emblemMoonSlot, 0.11, 0.12, 0.06, 8, 0, 0.16, 0.04, silverTrim, Math.PI * 0.5, 0, 0);
  const moonGlow = addCyl(
    emblemMoonSlot,
    0.075,
    0.075,
    0.07,
    8,
    0,
    0.16,
    0.05,
    uniqueMat({ color: 0xbae6fd, emissive: 0x38bdf8, emissiveIntensity: 1.4, roughness: 0.2 }),
    Math.PI * 0.5,
    0,
    0,
    false
  );
  shelfPivot.add(emblemMoonSlot);

  return { root, shelfPivot, emblemSunSlot, emblemMoonSlot, sunGlow, moonGlow };
}

export interface InteractivePianoRig {
  root: THREE.Group;
  keyMeshes: THREE.Mesh[];
  pedals: THREE.Mesh[];
}

export function createInteractivePianoRig(): InteractivePianoRig {
  const root = new THREE.Group();
  root.name = 'puzzle_interactive_piano';

  const ebonyWood = sharedMat({ color: 0x1c1412, roughness: 0.36, metalness: 0.18 });
  const walnutPanel = sharedMat({ color: 0x3b1f14, roughness: 0.44, metalness: 0.12 });
  const ivoryKey = sharedMat({ color: 0xf8fafc, roughness: 0.32, metalness: 0.04 });
  const blackKey = sharedMat({ color: 0x0f172a, roughness: 0.35, metalness: 0.12 });
  const brass = sharedMat({ color: 0xeab308, roughness: 0.24, metalness: 0.94 });
  const sheetPaper = sharedMat({ color: 0xfef3c7, roughness: 0.85, metalness: 0.02 });

  // Upright piano cabinet structure
  addBox(root, 1.58, 0.72, 0.52, 0, 0.36, -0.06, ebonyWood); // Lower body
  addBox(root, 1.58, 0.64, 0.46, 0, 1.04, -0.09, walnutPanel); // Upper soundboard
  addBox(root, 1.66, 0.08, 0.54, 0, 1.38, -0.06, ebonyWood); // Top lid cornice
  addBox(root, 1.56, 0.09, 0.38, 0, 0.74, 0.28, ebonyWood); // Keybed shelf
  addBox(root, 0.1, 0.72, 0.1, -0.71, 0.36, 0.38, ebonyWood); // Left front leg
  addBox(root, 0.1, 0.72, 0.1, 0.71, 0.36, 0.38, ebonyWood); // Right front leg
  addBox(root, 0.09, 0.2, 0.34, -0.74, 0.86, 0.26, ebonyWood); // Left cheek block
  addBox(root, 0.09, 0.2, 0.34, 0.74, 0.86, 0.26, ebonyWood); // Right cheek block

  // Music stand & sheet music
  addBox(root, 0.66, 0.04, 0.1, 0, 0.98, 0.18, ebonyWood);
  addBox(root, 0.54, 0.32, 0.02, 0, 1.13, 0.14, sheetPaper, -0.22, 0, 0);
  addBox(root, 0.08, 0.03, 0.03, 0, 0.99, 0.21, brass);

  // Individual white keys (10) & black sharp keys (7)
  const keyMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const kx = -0.585 + i * 0.13;
    const wKey = addBox(
      root,
      0.116,
      0.045,
      0.28,
      kx,
      0.805,
      0.3,
      ivoryKey,
      0,
      0,
      0,
      true,
      `piano_white_key_${i}`
    );
    keyMeshes.push(wKey);
  }
  const sharpIndices = [0, 1, 3, 4, 5, 7, 8];
  for (let i = 0; i < sharpIndices.length; i++) {
    const idx = sharpIndices[i];
    const kx = -0.52 + idx * 0.13;
    const bKey = addBox(
      root,
      0.068,
      0.05,
      0.17,
      kx,
      0.84,
      0.24,
      blackKey,
      0,
      0,
      0,
      true,
      `piano_black_key_${i}`
    );
    keyMeshes.push(bKey);
  }

  // 3 Brass foot pedals
  const pedals: THREE.Mesh[] = [];
  for (const px of [-0.14, 0, 0.14]) {
    const p = addBox(root, 0.055, 0.032, 0.16, px, 0.08, 0.24, brass, 0.12, 0, 0);
    pedals.push(p);
  }

  return { root, keyMeshes, pedals };
}

export interface SteamValvesRig {
  root: THREE.Group;
  valveWheels: THREE.Group[];
  steamCloud: THREE.Group;
  gaugeNeedle: THREE.Mesh;
  update: (elapsedSec: number, pressureRatio?: number) => void;
}

export function createSteamValvesRig(): SteamValvesRig {
  const root = new THREE.Group();
  root.name = 'puzzle_steam_valves';

  const ironPipe = sharedMat({ color: 0x334155, roughness: 0.56, metalness: 0.82 });
  const rustPipe = sharedMat({ color: 0x5c3626, roughness: 0.72, metalness: 0.58 });
  const valveRed = sharedMat({ color: 0xdc2626, roughness: 0.4, metalness: 0.45 });
  const brass = sharedMat({ color: 0xd97706, roughness: 0.28, metalness: 0.92 });
  const dialFace = sharedMat({ color: 0xf8fafc, roughness: 0.45, metalness: 0.05 });
  const steamMat = uniqueMat({
    color: 0xe2e8f0,
    emissive: 0x94a3b8,
    emissiveIntensity: 0.22,
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });

  // Main horizontal iron header manifold & bolted flange collars
  addCyl(root, 0.11, 0.11, 2.35, 10, 0, 1.15, 0, ironPipe, 0, 0, Math.PI * 0.5);
  addCyl(root, 0.08, 0.08, 2.1, 10, 0, 0.52, -0.06, rustPipe, 0, 0, Math.PI * 0.5);
  for (const fx of [-0.95, 0, 0.95]) {
    addCyl(root, 0.15, 0.15, 0.07, 8, fx, 1.15, 0, rustPipe, 0, 0, Math.PI * 0.5);
    addCyl(root, 0.075, 0.075, 1.25, 8, fx, 0.62, -0.02, ironPipe); // Vertical risers
    addBox(root, 0.16, 0.12, 0.22, fx, 1.15, -0.14, ironPipe); // Wall bracket
  }

  // Analog pressure gauge dial with rotating red needle
  addCyl(root, 0.14, 0.14, 0.08, 10, 0, 1.56, 0.02, brass, Math.PI * 0.5, 0, 0);
  addCyl(root, 0.115, 0.115, 0.09, 10, 0, 1.56, 0.025, dialFace, Math.PI * 0.5, 0, 0);
  addCyl(root, 0.03, 0.03, 0.26, 6, 0, 1.34, 0.02, brass); // Gauge stem
  const gaugeNeedle = addBox(root, 0.016, 0.095, 0.015, 0, 1.56, 0.08, valveRed, 0, 0, -0.6);

  // 3 Rotatable Red Valve Wheels (`valveWheels`)
  const valveWheels: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const vx = -0.68 + i * 0.68;
    const vy = 1.15;
    addCyl(root, 0.04, 0.04, 0.16, 8, vx, vy, 0.14, brass, Math.PI * 0.5, 0, 0); // Valve stem

    const wheel = new THREE.Group();
    wheel.name = `steam_valve_wheel_${i}`;
    wheel.position.set(vx, vy, 0.24);
    addCyl(wheel, 0.042, 0.042, 0.045, 8, 0, 0, 0, brass, Math.PI * 0.5, 0, 0); // Center nut
    // Cross spokes + 4 rim bar segments
    addBox(wheel, 0.34, 0.032, 0.028, 0, 0, 0, valveRed);
    addBox(wheel, 0.032, 0.34, 0.028, 0, 0, 0, valveRed);
    addBox(wheel, 0.26, 0.042, 0.042, 0, 0.17, 0, valveRed);
    addBox(wheel, 0.26, 0.042, 0.042, 0, -0.17, 0, valveRed);
    addBox(wheel, 0.042, 0.26, 0.042, 0.17, 0, 0, valveRed);
    addBox(wheel, 0.042, 0.26, 0.042, -0.17, 0, 0, valveRed);
    root.add(wheel);
    valveWheels.push(wheel);
  }

  // Translucent volumetric steam cloud group (`steamCloud`)
  const steamCloud = new THREE.Group();
  steamCloud.name = 'steam_valve_cloud';
  steamCloud.position.set(0.95, 1.38, 0.12);
  const puffOffsets: [number, number, number, number][] = [
    [0, 0, 0, 0.22],
    [0.08, 0.22, 0.06, 0.3],
    [-0.08, 0.42, 0.04, 0.36],
    [0.06, 0.65, -0.02, 0.42],
    [-0.04, 0.88, 0.08, 0.34],
  ];
  for (let i = 0; i < puffOffsets.length; i++) {
    const [px, py, pz, s] = puffOffsets[i];
    addBox(steamCloud, s, s * 0.82, s, px, py, pz, steamMat, i * 0.2, i * 0.5, 0, false);
  }
  root.add(steamCloud);

  return {
    root,
    valveWheels,
    steamCloud,
    gaugeNeedle,
    update(elapsedSec: number, pressureRatio = 0.75) {
      const clamped = Math.max(0, Math.min(1, pressureRatio));
      gaugeNeedle.rotation.z = 1.2 - clamped * 2.4 + Math.sin(elapsedSec * 9.0) * 0.05 * clamped;
      steamCloud.visible = clamped > 0.05;
      if (steamCloud.visible) {
        steamMat.opacity = 0.12 + clamped * 0.32;
        const children = steamCloud.children;
        for (let i = 0; i < children.length; i++) {
          const puff = children[i];
          const phase = (elapsedSec * 1.15 + i * 0.24) % 1;
          puff.position.y = phase * 1.05;
          const sc = 0.65 + phase * 0.9;
          puff.scale.set(sc, sc * 0.85, sc);
        }
      }
    },
  };
}

export interface FourStageFinalGateRig {
  root: THREE.Group;
  leftGateDoor: THREE.Group;
  rightGateDoor: THREE.Group;
  hydraulicPistons: THREE.Group[];
  chainGroups: THREE.Group[];
  fuseMeshes: THREE.Mesh[];
  keypadLed: THREE.Mesh;
  strobeBeacon: THREE.Group;
  strobeLight: THREE.Mesh;
  update: (elapsedSec: number, sirenActive?: boolean, openProgress?: number) => void;
}

export function createFourStageFinalGateRig(): FourStageFinalGateRig {
  const root = new THREE.Group();
  root.name = 'puzzle_four_stage_final_gate';

  const steelHeavy = sharedMat({ color: 0x1e293b, roughness: 0.48, metalness: 0.86 });
  const steelBar = sharedMat({ color: 0x475569, roughness: 0.36, metalness: 0.92 });
  const chrome = sharedMat({ color: 0xdbe4ef, roughness: 0.2, metalness: 0.96 });
  const hazardYellow = sharedMat({ color: 0xfacc15, roughness: 0.46, metalness: 0.22 });
  const chainIron = sharedMat({ color: 0x27272a, roughness: 0.52, metalness: 0.88 });
  const padlockBrass = sharedMat({ color: 0xd97706, roughness: 0.28, metalness: 0.92 });
  const wireRed = sharedMat({ color: 0xef4444, roughness: 0.6, metalness: 0.1 });
  const wireBlue = sharedMat({ color: 0x3b82f6, roughness: 0.6, metalness: 0.1 });
  const wireYellow = sharedMat({ color: 0xeab308, roughness: 0.6, metalness: 0.1 });
  const strobeDome = sharedMat({
    color: 0xef4444,
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.48,
  });

  // Top & bottom heavy steel guide rails + side jambs (4 pieces)
  addBox(root, 3.4, 0.16, 0.32, 0, 2.74, 0, steelHeavy); // Top rail
  addBox(root, 3.4, 0.08, 0.32, 0, 0.04, 0, steelHeavy); // Bottom rail
  addBox(root, 0.28, 2.8, 0.38, -1.66, 1.4, 0, steelHeavy); // Left jamb
  addBox(root, 0.28, 2.8, 0.38, 1.66, 1.4, 0, steelHeavy); // Right jamb

  // Double steel barred sliding gate doors (`leftGateDoor`, `rightGateDoor`)
  const buildGateLeaf = (name: string, side: -1 | 1): THREE.Group => {
    const leaf = new THREE.Group();
    leaf.name = name;
    leaf.position.set(side * 0.74, 0.08, 0);
    // Outer frame rails + lower hazard kickplate + 4 vertical prison-grade bars
    addBox(leaf, 1.42, 0.12, 0.14, 0, 2.52, 0, steelHeavy);
    addBox(leaf, 1.42, 0.18, 0.14, 0, 0.09, 0, hazardYellow);
    addBox(leaf, 0.12, 2.56, 0.14, -0.66, 1.28, 0, steelHeavy);
    addBox(leaf, 0.12, 2.56, 0.14, 0.66, 1.28, 0, steelHeavy);
    for (let b = 0; b < 4; b++) {
      const bx = -0.42 + b * 0.28;
      addCyl(leaf, 0.032, 0.032, 2.38, 8, bx, 1.32, 0, steelBar);
    }
    return leaf;
  };
  const leftGateDoor = buildGateLeaf('final_gate_left_door', -1);
  const rightGateDoor = buildGateLeaf('final_gate_right_door', 1);
  root.add(leftGateDoor);
  root.add(rightGateDoor);

  // 2 Animated Hydraulic Pistons (`hydraulicPistons`)
  const hydraulicPistons: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pg = new THREE.Group();
    pg.name = side < 0 ? 'final_gate_piston_left' : 'final_gate_piston_right';
    pg.position.set(side * 1.42, 2.32, 0.22);
    addCyl(pg, 0.075, 0.075, 0.62, 8, side * -0.15, 0, 0, hazardYellow, 0, 0, Math.PI * 0.5);
    addCyl(pg, 0.038, 0.038, 0.58, 8, side * -0.58, 0, 0, chrome, 0, 0, Math.PI * 0.5);
    addBox(pg, 0.14, 0.16, 0.16, side * 0.12, 0, 0, steelHeavy);
    root.add(pg);
    hydraulicPistons.push(pg);
  }

  // 2 Heavy Chains + Padlocks across center seam (`chainGroups`)
  const chainGroups: THREE.Group[] = [];
  for (let c = 0; c < 2; c++) {
    const cy = c === 0 ? 1.02 : 1.72;
    const cg = new THREE.Group();
    cg.name = `final_gate_chain_${c}`;
    cg.position.set(0, cy, 0.15);
    addBox(cg, 0.16, 0.05, 0.04, -0.22, 0, 0, chainIron, 0, 0, 0.12);
    addBox(cg, 0.16, 0.05, 0.04, 0, 0, 0.02, chainIron, 0.4, 0, 0);
    addBox(cg, 0.16, 0.05, 0.04, 0.22, 0, 0, chainIron, 0, 0, -0.12);
    addCyl(cg, 0.035, 0.035, 0.05, 8, 0, -0.05, 0.04, chrome, Math.PI * 0.5, 0, 0); // Shackle
    addBox(cg, 0.11, 0.13, 0.055, 0, -0.12, 0.04, padlockBrass); // Heavy brass padlock
    root.add(cg);
    chainGroups.push(cg);
  }

  // Open Breaker Box on left jamb with 2 fuse slots (`fuseMeshes`) & colored wires
  const bx = -1.66;
  const by = 1.42;
  const bz = 0.25;
  addBox(root, 0.34, 0.48, 0.14, bx, by, bz, steelHeavy); // Breaker cabinet
  addBox(root, 0.03, 0.46, 0.32, bx - 0.18, by, bz + 0.14, steelBar, 0, -0.35, 0); // Open door
  const fuseMeshes: THREE.Mesh[] = [];
  for (let f = 0; f < 2; f++) {
    const fx = bx - 0.06 + f * 0.12;
    const fuseMat = uniqueMat({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.35,
      roughness: 0.2,
      metalness: 0.35,
    });
    const fm = addCyl(root, 0.026, 0.026, 0.16, 8, fx, by + 0.08, bz + 0.07, fuseMat, 0, 0, 0, true, `final_gate_fuse_${f}`);
    fuseMeshes.push(fm);
  }
  // 3 Colored insulated wires running out of breaker box
  addCyl(root, 0.012, 0.012, 0.36, 6, bx - 0.07, by - 0.28, bz + 0.04, wireRed);
  addCyl(root, 0.012, 0.012, 0.36, 6, bx, by - 0.28, bz + 0.04, wireBlue);
  addCyl(root, 0.012, 0.012, 0.36, 6, bx + 0.07, by - 0.28, bz + 0.04, wireYellow);

  // Emissive 6-digit security keypad on right jamb
  const kx = 1.66;
  const ky = 1.42;
  const kz = 0.24;
  addBox(root, 0.24, 0.34, 0.09, kx, ky, kz, steelHeavy);
  addBox(
    root,
    0.18,
    0.07,
    0.02,
    kx,
    ky + 0.1,
    kz + 0.05,
    sharedMat({ color: 0x0f172a, emissive: 0x22c55e, emissiveIntensity: 0.9, roughness: 0.2 })
  );
  // 2x3 micro-voxel keypad button matrix blocks
  for (let row = 0; row < 2; row++) {
    addBox(root, 0.16, 0.04, 0.025, kx, ky - 0.01 - row * 0.075, kz + 0.05, chrome);
  }
  const keypadLedMat = uniqueMat({
    color: 0xef4444,
    emissive: 0xef4444,
    emissiveIntensity: 1.5,
    roughness: 0.2,
  });
  const keypadLed = addBox(root, 0.036, 0.036, 0.025, kx + 0.075, ky + 0.145, kz + 0.05, keypadLedMat, 0, 0, 0, false);

  // Rotating red strobe beacon above center lintel for 15s siren (`strobeBeacon`)
  addCyl(root, 0.13, 0.15, 0.08, 8, 0, 2.86, 0.12, steelHeavy); // Beacon base
  addCyl(root, 0.11, 0.12, 0.22, 10, 0, 3.01, 0.12, strobeDome, 0, 0, 0, false); // Translucent crimson dome
  const strobeBeacon = new THREE.Group();
  strobeBeacon.name = 'final_gate_strobe_beacon';
  strobeBeacon.position.set(0, 2.98, 0.12);
  addBox(strobeBeacon, 0.07, 0.14, 0.04, 0, 0, -0.02, chrome); // Spinning reflector mirror
  const strobeLightMat = uniqueMat({
    color: 0xff2222,
    emissive: 0xef4444,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const strobeLight = addBox(strobeBeacon, 0.065, 0.12, 0.065, 0, 0, 0.035, strobeLightMat, 0, 0, 0, false);
  root.add(strobeBeacon);

  return {
    root,
    leftGateDoor,
    rightGateDoor,
    hydraulicPistons,
    chainGroups,
    fuseMeshes,
    keypadLed,
    strobeBeacon,
    strobeLight,
    update(elapsedSec: number, sirenActive = false, openProgress = 0) {
      const clamped = Math.max(0, Math.min(1, openProgress));
      const slide = clamped * 1.15;
      leftGateDoor.position.x = -0.74 - slide;
      rightGateDoor.position.x = 0.74 + slide;

      if (sirenActive) {
        strobeBeacon.rotation.y = elapsedSec * 11.5;
        strobeLightMat.emissiveIntensity = 1.6 + 1.4 * Math.abs(Math.sin(elapsedSec * 9.0));
      } else {
        strobeLightMat.emissiveIntensity = 0.2;
      }
    },
  };
}

export interface PuzzleAndFinalGateBundle {
  root: THREE.Group;
  falseBookshelf: FalseBookshelfRig;
  interactivePiano: InteractivePianoRig;
  steamValves: SteamValvesRig;
  fourStageFinalGate: FourStageFinalGateRig;
}

export function createPuzzleAndFinalGateRigs(): PuzzleAndFinalGateBundle {
  const root = new THREE.Group();
  root.name = 'puzzle_and_final_gate_bundle';

  const falseBookshelf = createFalseBookshelfRig();
  falseBookshelf.root.position.set(-4.0, 0, 0);
  root.add(falseBookshelf.root);

  const interactivePiano = createInteractivePianoRig();
  interactivePiano.root.position.set(-1.4, 0, 0);
  root.add(interactivePiano.root);

  const steamValves = createSteamValvesRig();
  steamValves.root.position.set(1.4, 0, 0);
  root.add(steamValves.root);

  const fourStageFinalGate = createFourStageFinalGateRig();
  fourStageFinalGate.root.position.set(5.2, 0, 0);
  root.add(fourStageFinalGate.root);

  return {
    root,
    falseBookshelf,
    interactivePiano,
    steamValves,
    fourStageFinalGate,
  };
}

// ---------------------------------------------------------------------------
// 5. AUTOMATED QA HELPERS & FULL MODEL REGISTRY
// ---------------------------------------------------------------------------

/**
 * Counts every distinct THREE.Mesh sub-piece inside an Object3D hierarchy.
 */
export function countMeshSubPieces(obj: THREE.Object3D): number {
  let count = 0;
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      count++;
    }
  });
  return count;
}

/**
 * Exhaustive registry of every micro-voxel tool, prop, setpiece, and puzzle builder
 * for automated headless QA verification (all entries guaranteed >= 6 distinct Mesh sub-pieces).
 */
export const NEW_MICRO_VOXEL_BUILDERS: Record<string, () => THREE.Object3D> = {
  // 7 World Tools
  tool_world_polaroid_camera: () => createToolWorldModel('polaroid_camera'),
  tool_world_oil_can: () => createToolWorldModel('oil_can'),
  tool_world_crowbar: () => createToolWorldModel('crowbar'),
  tool_world_wire_cutters: () => createToolWorldModel('wire_cutters'),
  tool_world_gas_can: () => createToolWorldModel('gas_can'),
  tool_world_car_battery: () => createToolWorldModel('car_battery'),
  tool_world_alarm_clock: () => createToolWorldModel('alarm_clock'),

  // 7 First-Person Tool Viewmodels
  tool_viewmodel_polaroid_camera: () => createToolViewModel('polaroid_camera'),
  tool_viewmodel_oil_can: () => createToolViewModel('oil_can'),
  tool_viewmodel_crowbar: () => createToolViewModel('crowbar'),
  tool_viewmodel_wire_cutters: () => createToolViewModel('wire_cutters'),
  tool_viewmodel_gas_can: () => createToolViewModel('gas_can'),
  tool_viewmodel_car_battery: () => createToolViewModel('car_battery'),
  tool_viewmodel_alarm_clock: () => createToolViewModel('alarm_clock'),

  // Companion Glass Distraction Bottle
  glass_bottle_world: () => createGlassBottleWorldModel(),

  // Security Bunker (Cabine 09-A) Setpiece
  security_bunker_setpiece: () => createSecurityBunkerSetpiece().root,

  // New Mansion Wings & Architectural Detail Setpieces
  garage_escape_car: () => createGarageEscapeCarRig().root,
  tool_shed: () => createToolShedRig().root,
  outer_garden_props: () => createOuterGardenProps().root,
  secret_attic_props: () => createSecretAtticProps().root,
  mansion_chandelier: () => createChandelierRig().root,
  mansion_fireplace: () => createFireplaceRig().root,
  mansion_grandfather_clock: () => createGrandfatherClockRig().root,
  mansion_detail_props: () => createMansionDetailProps().root,

  // Puzzles & 4-Stage Final Gate
  puzzle_false_bookshelf: () => createFalseBookshelfRig().root,
  puzzle_interactive_piano: () => createInteractivePianoRig().root,
  puzzle_steam_valves: () => createSteamValvesRig().root,
  puzzle_four_stage_final_gate: () => createFourStageFinalGateRig().root,
  puzzle_and_final_gate_bundle: () => createPuzzleAndFinalGateRigs().root,
};
