import { Box3, Vector3 } from 'three';
import type {
  ArgCluePlacement,
  CassetteTapeDefinition,
  Difficulty,
  DoorDefinition,
  FloorId,
  BunkerCameraDefinition,
  FurniturePropDefinition,
  HidingSpotDefinition,
  ItemType,
  LightSwitchDefinition,
  NoisePropDefinition,
  OmegaDossierDefinition,
  RechargeStationDefinition,
  RoomDefinition,
  SafeDefinition,
  StairwayDefinition,
  SurfaceType,
  TutorialPlaqueDefinition,
  UvMarkDefinition,
  VentDuctDefinition,
  WorkbenchDefinition,
  WorldItemSpawn,
  WorldPickupType,
} from './types';
import { getDifficultyConfig } from './difficulty';

export const WALL_SWITCH_WALL_OFFSET = 0.02;
export const WALL_SWITCH_HEIGHT = 1.25;
export const WALL_SWITCH_JAMB_OFFSET = 0.45;

export const OMEGA_DOSSIERS: OmegaDossierDefinition[] = [
  {
    id: 'omega_01',
    code: 'DOSSIÊ ÔMEGA-01',
    title: 'COMPOSTO 09 · SORO SINTÉTICO',
    clearance: 'NÍVEL 4 · RESTRITO',
    date: 'NOITE 06 · 21:40',
    body: 'Amostras do Composto 09 armazenadas no Depósito Químico apresentaram viscosidade negro-esverdeada e regeneração muscular extrema. Exposição prolongada gera agressividade territorial, fotossensibilidade severa e deterioração cognitiva irreversível.',
  },
  {
    id: 'omega_02',
    code: 'DOSSIÊ ÔMEGA-02',
    title: 'SUJEITO 09 — "P. DRIZZY"',
    clearance: 'NÍVEL 5 · CONTENÇÃO',
    date: 'NOITE 09 · 02:14',
    body: 'Ex-encarregado de segurança do bloco exposto ao vazamento da Noite 09. Massa corporal aumentada impede acesso a dutos metálicos de ventilação. Mantém memória muscular de patrulha e carrega o molho de chaves do setor preso ao cinto. Evite contato visual direto.',
  },
  {
    id: 'omega_03',
    code: 'DOSSIÊ ÔMEGA-03',
    title: 'EVACUAÇÃO & NÍVEL -2 (LAB. ÔMEGA)',
    clearance: 'NÍVEL 5 · PROTOCOLO FINAL',
    date: 'NOITE 09 · 03:05',
    body: 'Após a quebra de contenção, a diretoria pregou o Portão Norte e isolou o Alçapão do Nível -2 no vestíbulo de saída. O portão externo para a rua só libera destravamento manual pelo painel central do Laboratório Ômega (-2). Nenhum resgate foi autorizado.',
  },
];

export const GRID_W = 36;
export const GRID_H = 36;
export const CELL_SIZE = 1.6;
export const FLOOR_0_Y = 0;
export const FLOOR_MINUS_1_Y = -4.0;
export const GROUND_CEILING_H = 3.6;
export const BASEMENT_CEILING_H = 3.0;
export const VENT_CEILING_H = 1.32;

// Cell encoding
export const CELL_VOID = 0;
export const CELL_FLOOR = 1;
export const CELL_WALL = 2;
export const CELL_STAIR = 3;
export const CELL_COURTYARD = 4; // Open night sky above on Floor 0
export const CELL_VENT = 5; // Low metallic ventilation duct (crouch-only for player, impassable for P. Diddy!)

export interface FurnitureCollider {
  id: string;
  kind: FurniturePropDefinition['kind'];
  floor: FloorId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  blocksLos: boolean;
}

export interface MansionLayout {
  seed: number;
  presetIndex: number;
  floor0: Uint8Array;
  floorMinus1: Uint8Array;
  surface0: SurfaceType[];
  surfaceMinus1: SurfaceType[];
  rooms: RoomDefinition[];
  doors: DoorDefinition[];
  vents: VentDuctDefinition[];
  stairways: StairwayDefinition[];
  hidingSpots: HidingSpotDefinition[];
  items: WorldItemSpawn[];
  clues: ArgCluePlacement[];
  uvMarks: UvMarkDefinition[];
  symbolMap: { symbol: string; digit: string }[];
  secretTerminalCode: string;
  cameraSecretCode: string;
  safe: SafeDefinition;
  noiseProps: NoisePropDefinition[];
  workbenches: WorkbenchDefinition[];
  rechargeStations: RechargeStationDefinition[];
  cassettes: CassetteTapeDefinition[];
  bunkerCameras: BunkerCameraDefinition[];
  tutorialPlaques: TutorialPlaqueDefinition[];
  furniture: FurniturePropDefinition[];
  furnitureColliders: FurnitureCollider[];
  bunkerButtons: {
    id: string;
    side: 'left' | 'right';
    doorId: string;
    floor: FloorId;
    x: number;
    y: number;
    z: number;
    facingYaw: number;
  }[];
  cctvMonitorPos: { x: number; y: number; z: number; floor: FloorId };
  spawnPoint: { x: number; y: number; z: number; yaw: number; floor: FloorId };
  diddySpawnPoint: { x: number; y: number; z: number; floor: FloorId };
  patrolWaypoints: { x: number; y: number; z: number; floor: FloorId }[];
  ceilingLights: {
    x: number;
    y: number;
    z: number;
    floor: FloorId;
    flickerSeed: number;
    color: number;
    isSecurityOffice?: boolean;
  }[];
  courtyardPillars: { x: number; z: number; height: number; hasLantern?: boolean }[];
  lightSwitches: LightSwitchDefinition[];
  puddles: { id: string; floor: FloorId; x: number; y: number; z: number; radius: number; hasDrip?: boolean }[];
  cobwebs: { id: string; floor: FloorId; x: number; y: number; z: number; rotY: number; scale: number }[];
  grassTufts: { id: string; x: number; z: number; scale: number; rotY: number; isDryLeaves?: boolean }[];
  steamVents: { id: string; x: number; y: number; z: number }[];
}

export function gridToWorld(g: number): number {
  return (g + 0.5) * CELL_SIZE;
}

export function worldToGrid(w: number): number {
  return Math.floor(w / CELL_SIZE);
}

export function cellIdx(gx: number, gz: number): number {
  return gz * GRID_W + gx;
}

export function inBounds(gx: number, gz: number): boolean {
  return gx >= 0 && gx < GRID_W && gz >= 0 && gz < GRID_H;
}

export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fillRect(
  grid: Uint8Array,
  surfaces: SurfaceType[],
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  cellVal: number,
  surf: SurfaceType
): void {
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (!inBounds(x, z)) continue;
      const i = cellIdx(x, z);
      grid[i] = cellVal;
      surfaces[i] = surf;
    }
  }
}

function buildPerimeterWalls(grid: Uint8Array): void {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  const wallCoords: [number, number][] = [];
  for (let z = 0; z < GRID_H; z++) {
    for (let x = 0; x < GRID_W; x++) {
      if (grid[cellIdx(x, z)] !== CELL_VOID) continue;
      for (const [dx, dz] of dirs) {
        const nx = x + dx;
        const nz = z + dz;
        if (inBounds(nx, nz)) {
          const neighbor = grid[cellIdx(nx, nz)];
          if (
            neighbor === CELL_FLOOR ||
            neighbor === CELL_STAIR ||
            neighbor === CELL_COURTYARD ||
            neighbor === CELL_VENT
          ) {
            wallCoords.push([x, z]);
            break;
          }
        }
      }
    }
  }
  for (const [x, z] of wallCoords) {
    grid[cellIdx(x, z)] = CELL_WALL;
  }
}

/**
 * Wide, smooth staircases connecting Ground Floor (0.0m) <-> Underground (-4.0m).
 * Exact 2-cell width matches door_basement_gate & door_east_gate 100% — ZERO side gaps!
 */
export const STAIRWAYS: StairwayDefinition[] = [
  {
    id: 'stair_west',
    name: 'Escada Oeste do Subsolo',
    gxMin: 5,
    gxMax: 6,
    gzTop: 8,
    gzBottom: 3,
    gateDoorId: 'door_basement_gate',
  },
  {
    id: 'stair_east',
    name: 'Escada Leste do Subsolo',
    gxMin: 29,
    gxMax: 30,
    gzTop: 8,
    gzBottom: 3,
    gateDoorId: 'door_east_gate',
  },
];

export const ROOMS: RoomDefinition[] = [
  // Ground Floor (Floor 0) — Complexo Setor 09
  { id: 'hall', name: 'Recepção · Setor 09', floor: 0, x0: 15, z0: 30, x1: 20, z1: 33, surface: 'stone', zoneId: 'start' },
  { id: 'security_office', name: 'Guarita de Vigilância (Cabine 09-A)', floor: 0, x0: 9, z0: 30, x1: 13, z1: 33, surface: 'tile', zoneId: 'start' },
  { id: 'courtyard', name: 'Pátio Interno · Setor 09', floor: 0, x0: 10, z0: 21, x1: 25, z1: 29, surface: 'stone', zoneId: 'start' },
  { id: 'corridor', name: 'Passagem Central', floor: 0, x0: 16, z0: 10, x1: 19, z1: 20, surface: 'wood', zoneId: 'start' },
  { id: 'west_wing', name: 'Refeitório · Ala Oeste', floor: 0, x0: 4, z0: 13, x1: 7, z1: 33, surface: 'tile', zoneId: 'start' },
  { id: 'east_wing', name: 'Oficina · Ala Leste', floor: 0, x0: 27, z0: 13, x1: 31, z1: 31, surface: 'wood', zoneId: 'start' },
  { id: 'north_gallery', name: 'Corredor Norte', floor: 0, x0: 4, z0: 10, x1: 31, z1: 12, surface: 'concrete', zoneId: 'start' },
  { id: 'exit_vestibule', name: 'Portão Norte · Vestíbulo', floor: 0, x0: 15, z0: 2, x1: 20, z1: 8, surface: 'stone', zoneId: 'exit' },
  // Layer 1 Locked Thematic Wings (100% sealed doorways)
  { id: 'office', name: 'Arquivo Morto · Ala Vermelha', floor: 0, x0: 10, z0: 14, x1: 14, z1: 19, surface: 'wood', zoneId: 'red_wing' },
  { id: 'library', name: 'Enfermaria · Ala Azul', floor: 0, x0: 21, z0: 14, x1: 25, z1: 19, surface: 'tile', zoneId: 'blue_wing' },
  { id: 'stair_west_top', name: 'Escada Oeste', floor: 0, x0: 5, z0: 3, x1: 6, z1: 8, surface: 'concrete', zoneId: 'basement' },
  { id: 'stair_east_top', name: 'Escada Leste', floor: 0, x0: 29, z0: 3, x1: 30, z1: 8, surface: 'concrete', zoneId: 'basement' },

  // Underground Floor (Floor -1) — Full 360° Perimeter Loop + Generator + Chemical Depot + Secret Chamber
  { id: 'flooded_corridor', name: 'Subsolo · Túnel de Manutenção', floor: -1, x0: 5, z0: 11, x1: 30, z1: 14, surface: 'basement_wet', zoneId: 'basement' },
  { id: 'south_tunnel', name: 'Subsolo · Túnel Sul', floor: -1, x0: 5, z0: 28, x1: 30, z1: 30, surface: 'basement_wet', zoneId: 'basement' },
  { id: 'generator', name: 'Subsolo · Sala dos Geradores', floor: -1, x0: 13, z0: 3, x1: 22, z1: 9, surface: 'concrete', zoneId: 'basement' },
  { id: 'secret_chamber', name: 'Subsolo · Câmara Ômega', floor: -1, x0: 24, z0: 3, x1: 27, z1: 9, surface: 'tile', zoneId: 'secret_chamber' },
  { id: 'boiler', name: 'Subsolo · Caldeira', floor: -1, x0: 9, z0: 16, x1: 14, z1: 26, surface: 'basement_wet', zoneId: 'basement' },
  { id: 'depot', name: 'Subsolo · Depósito Químico', floor: -1, x0: 16, z0: 16, x1: 19, z1: 25, surface: 'concrete', zoneId: 'basement_depot' },
  { id: 'cells', name: 'Subsolo · Celas de Contenção', floor: -1, x0: 21, z0: 16, x1: 26, z1: 26, surface: 'tile', zoneId: 'basement' },

  // Chapter 1 Remaster Expansion (25+ Interconnected Rooms): Outer Garden, Tool Shed, Garage, Secret Attic, Owner Archives & Steam Vault
  { id: 'outer_garden', name: 'Pátio Externo & Jardim Cercado', floor: 0, x0: 21, z0: 30, x1: 26, z1: 33, surface: 'stone', zoneId: 'start' },
  { id: 'tool_shed', name: 'Galpão de Ferramentas (Acorrentado)', floor: 0, x0: 27, z0: 32, x1: 31, z1: 34, surface: 'wood', zoneId: 'start' },
  { id: 'garage', name: 'Garagem & Oficina · Carro de Fuga', floor: 0, x0: 32, z0: 15, x1: 34, z1: 28, surface: 'concrete', zoneId: 'start' },
  { id: 'owner_archives', name: 'Sala de Arquivos do Dono (Estante Falsa)', floor: 0, x0: 8, z0: 3, x1: 13, z1: 8, surface: 'wood', zoneId: 'red_wing' },
  { id: 'secret_attic', name: 'Sótão Secreto · Elevador de Carga Cap. 2', floor: 0, x0: 22, z0: 3, x1: 27, z1: 8, surface: 'wood', zoneId: 'blue_wing' },
  { id: 'steam_vault', name: 'Subsolo · Galeria das Válvulas de Vapor', floor: -1, x0: 5, z0: 16, x1: 7, z1: 26, surface: 'basement_wet', zoneId: 'basement' },
];

export interface CreakingBoardTrap {
  id: string;
  floor: FloorId;
  x: number;
  z: number;
  radius: number;
}

/** Wooden floorboards that emit a loud creak unless crossed while crouching */
export const CREAKING_FLOORBOARDS: readonly CreakingBoardTrap[] = [
  { id: 'creak_corridor_1', floor: 0, x: gridToWorld(17.5), z: gridToWorld(16.0), radius: 1.35 },
  { id: 'creak_garden_1', floor: 0, x: gridToWorld(23.5), z: gridToWorld(31.5), radius: 1.45 },
  { id: 'creak_east_1', floor: 0, x: gridToWorld(29.0), z: gridToWorld(22.0), radius: 1.35 },
  { id: 'creak_archives_1', floor: 0, x: gridToWorld(11.0), z: gridToWorld(6.0), radius: 1.35 },
];

export interface DiaryLorePage {
  id: string;
  title: { 'pt-BR': string; 'en-US': string; 'es-ES': string };
  body: { 'pt-BR': string; 'en-US': string; 'es-ES': string };
}

/** 4 Chapter 1 Lore Diary Pages bridging the Mansion (Chapter 1) directly into Sector 09 Deep Complex (Chapter 2) */
export const CHAPTER1_DIARY_PAGES: readonly DiaryLorePage[] = [
  {
    id: 'diary_1',
    title: {
      'pt-BR': 'Página 01 — A Guarita 09-A',
      'en-US': 'Page 01 — Security Bunker 09-A',
      'es-ES': 'Página 01 — Caseta de Vigilancia 09-A',
    },
    body: {
      'pt-BR': 'O Diretor Neves instalou portas hidráulicas na Cabine 09-A e um sinalizador sonoro remoto para afastar o Sujeito 09 dos corredores. Se a bateria zerar, as portas abrem.',
      'en-US': 'Director Neves installed hydraulic blast doors in Cabin 09-A and a remote acoustic lure to pull Subject 09 away from the halls. If the reserve battery hits zero, the doors release.',
      'es-ES': 'El Director Neves instaló puertas hidráulicas en la Cabina 09-A y una señal sonora remota para alejar al Sujeto 09. Si la batería cae a cero, las puertas se abren.',
    },
  },
  {
    id: 'diary_2',
    title: {
      'pt-BR': 'Página 02 — A Estante Falsa & O Carro',
      'en-US': 'Page 02 — The False Bookshelf & Getaway Car',
      'es-ES': 'Página 02 — La Estantería Falsa y el Auto',
    },
    body: {
      'pt-BR': 'Os dois emblemas (Sol e Lua) abrem a estante falsa do Arquivo Morto. Na garagem leste há uma viatura funcional: só precisa da bateria, galão de gasolina e a chave do portão.',
      'en-US': 'The two emblems (Sun & Moon) slide open the false bookshelf in the Archives. In the east garage sits a working getaway car: it only needs a battery, gas can, and garage key.',
      'es-ES': 'Los dos emblemas (Sol y Luna) abren la estantería falsa. En el garaje este hay un auto funcional: solo falta batería, gasolina y la llave del portón.',
    },
  },
  {
    id: 'diary_3',
    title: {
      'pt-BR': 'Página 03 — Protocolo de 4 Etapas do Portão',
      'en-US': 'Page 03 — 4-Stage Gate Escape Protocol',
      'es-ES': 'Página 03 — Protocolo de Escape de 4 Etapas',
    },
    body: {
      'pt-BR': 'Para abrir o Portão Norte: 2 fusíveis no porão, cortar 2 correntes com alicate pesado, Chave Mestra + senha de 6 dígitos (metade na Cabine 09-A, metade no Sótão) e aguentar 15s de sirene.',
      'en-US': 'To open the North Gate: restore 2 basement fuses, cut 2 heavy chains, insert Master Key + 6-digit code (split between Cabin 09-A and Attic), and survive 15s of siren.',
      'es-ES': 'Para abrir el Portón Norte: 2 fusibles en el sótano, cortar 2 cadenas, Llave Maestra + código de 6 dígitos (Cabina 09-A y Ático) y resistir 15s de sirena.',
    },
  },
  {
    id: 'diary_4',
    title: {
      'pt-BR': 'Página 04 — O Elevador de Carga (Capítulo 2)',
      'en-US': 'Page 04 — The Hidden Cargo Elevator (Chapter 2)',
      'es-ES': 'Página 04 — El Elevador de Carga (Capítulo 2)',
    },
    body: {
      'pt-BR': 'Atrás do Sótão Secreto existe um elevador de carga que desce direto para os 36 setores profundos do Laboratório Ômega. É para lá que levaram os outros sobreviventes...',
      'en-US': 'Behind the Secret Attic lies a hidden cargo elevator descending straight into the 36 deep sectors of the Omega Facility. That is where they took the other survivors...',
      'es-ES': 'Detrás del Ático Secreto existe un elevador de carga que baja directo a los 36 sectores profundos del Laboratorio Omega. Allí llevaron a los demás sobrevivientes...',
    },
  },
];

export interface DubbedAudioTape {
  id: string;
  speaker: 'marcos' | 'helena';
  lines: { 'pt-BR': string; 'en-US': string; 'es-ES': string };
}

export const CHAPTER1_DUBBED_TAPES: readonly DubbedAudioTape[] = [
  {
    id: 'ch1_tape_01',
    speaker: 'marcos',
    lines: {
      'pt-BR': 'Fita 01 — Marcos falando da Cabine 09-A. Não pise nas tábuas soltas do corredor sem agachar! Use a Câmera Polaroid no rosto dele se precisar de 3 segundos para fugir.',
      'en-US': 'Tape 01 — Marcos reporting from Cabin 09-A. Never step on loose floorboards standing up! Flash the Polaroid Camera in his face if you need 3 seconds to escape.',
      'es-ES': 'Cinta 01 — Marcos desde Cabina 09-A. ¡No pises las tablas sueltas sin agacharte! Usa el flash de la Cámara Polaroid si necesitas 3 segundos para huir.',
    },
  },
  {
    id: 'ch1_tape_02',
    speaker: 'helena',
    lines: {
      'pt-BR': 'Fita 02 — Dra. Helena. A interferência neural piora no breu e perto do Sujeito 09. Fique junto dos aliados, use a lanterna ou tome o Supressor de Frequência antes de descer ao Capítulo 2.',
      'en-US': 'Tape 02 — Dr. Helena. Neural interference worsens in pitch dark and near Subject 09. Stay near allies, keep lights on, or take Frequency Suppressor pills before descending to Chapter 2.',
      'es-ES': 'Cinta 02 — Dra. Helena. La interferencia neural empeora en la oscuridad cerca del Sujeto 09. Quédate con aliados, usa luz o toma el Supresor de Frecuencia antes del Capítulo 2.',
    },
  },
];

export const VENT_DUCTS: VentDuctDefinition[] = [
  { id: 'vent_west', name: 'Duto Oeste (Refeitório ↔ Pátio)', floor: 0, x0: 8, z0: 26, x1: 9, z1: 26 },
  { id: 'vent_east', name: 'Duto Leste (Pátio ↔ Oficina)', floor: 0, x0: 26, z0: 26, x1: 26, z1: 26 },
  { id: 'vent_basement', name: 'Duto Subsolo (Caldeira ↔ Celas)', floor: -1, x0: 15, z0: 26, x1: 20, z1: 26 },
];

interface ItemAnchor {
  id: string;
  floor: FloorId;
  gx: number;
  gz: number;
  zoneId: string;
  roomId: string;
  roomName: string;
  yOffset: number;
  facingYaw?: number;
  drawerId?: string;
  needsSideTable?: boolean;
}

const KEY_AND_TOOL_ANCHORS: ItemAnchor[] = [
  // Layer 0: Open Starting Area (ZERO locked doors — EVERY anchor rests on a real 3D table/crate or inside a hollow drawer!)
  { id: 'a_courtyard_west', floor: 0, gx: 11.2, gz: 24.0, zoneId: 'start', roomId: 'courtyard', roomName: 'Pátio Interno', yOffset: 0.94, needsSideTable: true },
  { id: 'a_courtyard_east', floor: 0, gx: 23.8, gz: 24.0, zoneId: 'start', roomId: 'courtyard', roomName: 'Pátio Interno', yOffset: 0.94, needsSideTable: true },
  { id: 'a_west_dining', floor: 0, gx: 5.5, gz: 21.0, zoneId: 'start', roomId: 'west_wing', roomName: 'Refeitório', yOffset: 0.98 }, // rests on furn_dining_1!
  { id: 'a_west_north', floor: 0, gx: 5.5, gz: 15.0, zoneId: 'start', roomId: 'west_wing', roomName: 'Refeitório', yOffset: 0.98 }, // rests on furn_dining_2!
  { id: 'a_east_workshop', floor: 0, gx: 30.5, gz: 30.2, zoneId: 'start', roomId: 'east_wing', roomName: 'Oficina', yOffset: 1.07 }, // rests on furn_crate_1!
  { id: 'a_east_north', floor: 0, gx: 29.2, gz: 15.2, zoneId: 'start', roomId: 'east_wing', roomName: 'Oficina', yOffset: 0.94, needsSideTable: true },
  { id: 'a_gallery_west', floor: 0, gx: 10.6, gz: 10.6, zoneId: 'start', roomId: 'north_gallery', roomName: 'Corredor Norte', yOffset: 0.94, needsSideTable: true },
  { id: 'a_gallery_east', floor: 0, gx: 24.4, gz: 10.6, zoneId: 'start', roomId: 'north_gallery', roomName: 'Corredor Norte', yOffset: 0.94, needsSideTable: true },
  { id: 'a_security_drawer', floor: 0, gx: 12.2, gz: 33.15, zoneId: 'start', roomId: 'security_office', roomName: 'Sala de Segurança', yOffset: 0.72, drawerId: 'furn_drawer_bunker_r' },
  { id: 'a_corridor_alcove', floor: 0, gx: 18.6, gz: 14.5, zoneId: 'start', roomId: 'corridor', roomName: 'Passagem Central', yOffset: 0.94, needsSideTable: true },
  { id: 'a_shop_drawer', floor: 0, gx: 30.8, gz: 17.5, zoneId: 'start', roomId: 'east_wing', roomName: 'Oficina', yOffset: 0.72, drawerId: 'furn_drawer_shop' },

  // Layer 1: Red Wing (Arquivo Morto — behind Red Door)
  { id: 'a_office_drawer', floor: 0, gx: 13.5, gz: 14.25, zoneId: 'red_wing', roomId: 'office', roomName: 'Arquivo Morto', yOffset: 0.72, drawerId: 'furn_drawer_office' },
  { id: 'a_office_table', floor: 0, gx: 11.4, gz: 18.4, zoneId: 'red_wing', roomId: 'office', roomName: 'Arquivo Morto', yOffset: 0.94, needsSideTable: true },
  { id: 'a_office_corner', floor: 0, gx: 13.4, gz: 18.4, zoneId: 'red_wing', roomId: 'office', roomName: 'Arquivo Morto', yOffset: 0.94, needsSideTable: true },

  // Layer 1: Blue Wing (Enfermaria — behind Blue Door)
  { id: 'a_library_drawer', floor: 0, gx: 21.5, gz: 14.25, zoneId: 'blue_wing', roomId: 'library', roomName: 'Enfermaria', yOffset: 0.72, drawerId: 'furn_drawer_med' },
  { id: 'a_library_bed', floor: 0, gx: 24.5, gz: 14.8, zoneId: 'blue_wing', roomId: 'library', roomName: 'Enfermaria', yOffset: 1.07 }, // rests on furn_bed_1!
  { id: 'a_library_corner', floor: 0, gx: 21.8, gz: 18.4, zoneId: 'blue_wing', roomId: 'library', roomName: 'Enfermaria', yOffset: 0.94, needsSideTable: true },

  // Layer 2: Underground Basement (Unlocked by Basement Key)
  { id: 'a_boiler_table', floor: -1, gx: 10.6, gz: 24.4, zoneId: 'basement', roomId: 'boiler', roomName: 'Subsolo · Caldeira', yOffset: 0.94, needsSideTable: true },
  { id: 'a_boiler_bench', floor: -1, gx: 13.4, gz: 18.2, zoneId: 'basement', roomId: 'boiler', roomName: 'Subsolo · Caldeira', yOffset: 0.94, needsSideTable: true },
  { id: 'a_cells_table', floor: -1, gx: 24.8, gz: 24.6, zoneId: 'basement', roomId: 'cells', roomName: 'Subsolo · Celas', yOffset: 0.94, needsSideTable: true },
  { id: 'a_cells_bedside', floor: -1, gx: 22.0, gz: 18.2, zoneId: 'basement', roomId: 'cells', roomName: 'Subsolo · Celas', yOffset: 0.94, needsSideTable: true },
  { id: 'a_generator_table', floor: -1, gx: 14.4, gz: 4.5, zoneId: 'basement', roomId: 'generator', roomName: 'Sala dos Geradores', yOffset: 0.94, needsSideTable: true },

  // Layer 2: Underground Chemical Depot (Behind Crowbar Planks)
  { id: 'a_depot_crate', floor: -1, gx: 17.2, gz: 22.8, zoneId: 'basement_depot', roomId: 'depot', roomName: 'Depósito Químico', yOffset: 0.94, needsSideTable: true },
  { id: 'a_depot_rack', floor: -1, gx: 18.4, gz: 18.0, zoneId: 'basement_depot', roomId: 'depot', roomName: 'Depósito Químico', yOffset: 0.94, needsSideTable: true },
];

// ALL 8 ARG Clue Plaques pinned FLUSH against real solid walls with exact facingYaw!
const CLUE_ANCHORS: ItemAnchor[] = [
  // Layer 0 Clues
  { id: 'c_hall_note', floor: 0, gx: 20.44, gz: 32.2, zoneId: 'start', roomId: 'hall', roomName: 'Recepção', yOffset: 1.52, facingYaw: -Math.PI / 2 },
  { id: 'c_west_wall', floor: 0, gx: 3.56, gz: 22.0, zoneId: 'start', roomId: 'west_wing', roomName: 'Refeitório', yOffset: 1.52, facingYaw: Math.PI / 2 },
  { id: 'c_east_wall', floor: 0, gx: 31.44, gz: 22.0, zoneId: 'start', roomId: 'east_wing', roomName: 'Oficina', yOffset: 1.52, facingYaw: -Math.PI / 2 },
  // Layer 1 Clues
  { id: 'c_office_frame', floor: 0, gx: 9.56, gz: 16.5, zoneId: 'red_wing', roomId: 'office', roomName: 'Arquivo Morto', yOffset: 1.52, facingYaw: Math.PI / 2 },
  { id: 'c_library_book', floor: 0, gx: 23.0, gz: 19.44, zoneId: 'blue_wing', roomId: 'library', roomName: 'Enfermaria', yOffset: 1.52, facingYaw: Math.PI },
  // Layer 2 Clues
  { id: 'c_boiler_pipe', floor: -1, gx: 8.56, gz: 22.5, zoneId: 'basement', roomId: 'boiler', roomName: 'Subsolo · Caldeira', yOffset: 1.46, facingYaw: Math.PI / 2 },
  { id: 'c_cells_wall', floor: -1, gx: 26.44, gz: 22.5, zoneId: 'basement', roomId: 'cells', roomName: 'Subsolo · Celas', yOffset: 1.46, facingYaw: -Math.PI / 2 },
  { id: 'c_depot_tag', floor: -1, gx: 15.56, gz: 20.0, zoneId: 'basement_depot', roomId: 'depot', roomName: 'Depósito Químico', yOffset: 1.46, facingYaw: Math.PI / 2 },
];

const CLUE_FLAVORS: { title: string; template: string }[] = [
  { title: 'Anotação do Vigia Marcos', template: 'Rabiscado no crachá da guarita: "Se o portão travar, 1º dígito do Cofre do Gerador = {D}".' },
  { title: 'Memorando · Projeto Ômega', template: 'Carimbo de evacuação da Noite 09: "Posição 2 do painel do cofre: {D}".' },
  { title: 'Prontuário · Sujeito 09', template: 'Escrito às pressas atrás da ficha clínica do P. Drizzy: "3º dígito do cofre — {D}".' },
  { title: 'Arranhão na Tubulação', template: 'Gravado a canivete na saída do subsolo: "Último dígito (4º) para a Chave Mestra: {D}".' },
];

export interface ProgressionPlacementCandidate {
  keyZones: Record<'red_key' | 'blue_key' | 'basement_key' | 'crowbar' | 'master_key', string>;
  craftCrowbarZones?: [string, string]; // optional [crowbar_rod zone, crowbar_hook zone]
  fuseZone?: string;
  clueZones: string[];
  safeZone: string;
  safeRewardItem: 'master_key' | 'crowbar' | 'red_key' | 'blue_key';
}

/**
 * Pure Mathematical BFS Reachability & Strict 3-Layer Validator — GUARANTEES ZERO SOFTLOCKS!
 * Supports BOTH direct Crowbar pickup AND Crafting Crowbar (Rod + Hook at Workbench in 'start').
 */
export function verifyLayoutSolvable(candidate: ProgressionPlacementCandidate): boolean {
  // 1. Strict anti-self-lock checks
  if (candidate.keyZones.red_key === 'red_wing') return false;
  if (candidate.keyZones.blue_key === 'blue_wing') return false;
  if (
    candidate.keyZones.basement_key === 'basement' ||
    candidate.keyZones.basement_key === 'basement_depot' ||
    candidate.keyZones.basement_key === 'safe_reward'
  ) {
    return false;
  }
  if (candidate.keyZones.crowbar === 'basement_depot') return false;

  // 2. Layer 0 ('start') MUST guarantee an immediate opening progression item
  const hasLayer0Opener =
    candidate.keyZones.red_key === 'start' ||
    candidate.keyZones.blue_key === 'start' ||
    candidate.keyZones.crowbar === 'start';
  if (!hasLayer0Opener) return false;

  // 3. Monotonic BFS fixpoint reachability simulation
  const reachableZones = new Set<string>(['start']);
  const ownedItems = new Set<string>();
  let safeOpened = false;

  for (let pass = 0; pass < 14; pass++) {
    let changed = false;

    for (const [item, zone] of Object.entries(candidate.keyZones)) {
      if (zone !== 'safe_reward' && reachableZones.has(zone) && !ownedItems.has(item)) {
        ownedItems.add(item);
        changed = true;
      }
    }

    // Check craftable crowbar parts (Workbench is in 'start' -> Oficina!)
    if (candidate.craftCrowbarZones) {
      const [zRod, zHook] = candidate.craftCrowbarZones;
      if (reachableZones.has(zRod) && reachableZones.has(zHook) && !ownedItems.has('crowbar')) {
        ownedItems.add('crowbar');
        changed = true;
      }
    }

    if (candidate.fuseZone && reachableZones.has(candidate.fuseZone) && !ownedItems.has('fuse')) {
      ownedItems.add('fuse');
      changed = true;
    }

    if (ownedItems.has('red_key') && !reachableZones.has('red_wing')) {
      reachableZones.add('red_wing');
      changed = true;
    }
    if (ownedItems.has('blue_key') && !reachableZones.has('blue_wing')) {
      reachableZones.add('blue_wing');
      changed = true;
    }
    if (ownedItems.has('basement_key') && !reachableZones.has('basement')) {
      reachableZones.add('basement');
      changed = true;
    }
    if (
      reachableZones.has('basement') &&
      ownedItems.has('crowbar') &&
      !reachableZones.has('basement_depot')
    ) {
      reachableZones.add('basement_depot');
      changed = true;
    }

    const allCluesReachable = candidate.clueZones.every((z) => reachableZones.has(z));
    const fuseReady = !candidate.fuseZone || ownedItems.has('fuse');
    if (
      !safeOpened &&
      reachableZones.has(candidate.safeZone) &&
      allCluesReachable &&
      fuseReady
    ) {
      safeOpened = true;
      if (!ownedItems.has(candidate.safeRewardItem)) {
        ownedItems.add(candidate.safeRewardItem);
      }
      changed = true;
    }

    if (!changed) break;
  }

  const allCluesFound = candidate.clueZones.every((z) => reachableZones.has(z));
  const fuseReady = !candidate.fuseZone || ownedItems.has('fuse');
  return (
    safeOpened &&
    allCluesFound &&
    fuseReady &&
    ownedItems.has('crowbar') &&
    ownedItems.has('master_key')
  );
}

/**
 * Strict 3-Layer Progression Presets:
 *  - Layer 0 ('start'): 1st Wing Key + Craftable Crowbar Parts (Rod + Hook -> Workbench!) + Stun Gun + Clue #1
 *  - Layer 1 ('red_wing' / 'blue_wing'): Basement Key + Fuse + Second Wing Key + Wire Cutters + Clues #2-#3
 *  - Layer 2 ('basement' / 'safe_reward'): Clue #4 + Safe ('master_key') + Generator Lever!
 */
interface PresetDef {
  keyZones: Record<'red_key' | 'blue_key' | 'basement_key' | 'crowbar' | 'master_key', string>;
  craftCrowbarZones: [string, string];
  fuseZone: string;
  clueZones: [string, string, string, string];
  safeRewardItem: 'master_key';
}

const PROGRESSION_PRESETS: PresetDef[] = [
  {
    keyZones: {
      red_key: 'start',
      crowbar: 'start', // Craftable via crowbar_rod + crowbar_hook in 'start' (and verified!)
      blue_key: 'red_wing',
      basement_key: 'blue_wing',
      master_key: 'safe_reward',
    },
    craftCrowbarZones: ['start', 'start'],
    fuseZone: 'red_wing',
    clueZones: ['start', 'red_wing', 'blue_wing', 'basement'],
    safeRewardItem: 'master_key',
  },
  {
    keyZones: {
      blue_key: 'start',
      crowbar: 'start',
      red_key: 'blue_wing',
      basement_key: 'red_wing',
      master_key: 'safe_reward',
    },
    craftCrowbarZones: ['start', 'start'],
    fuseZone: 'blue_wing',
    clueZones: ['start', 'blue_wing', 'red_wing', 'basement'],
    safeRewardItem: 'master_key',
  },
  {
    keyZones: {
      red_key: 'start',
      blue_key: 'start',
      crowbar: 'red_wing',
      basement_key: 'blue_wing',
      master_key: 'safe_reward',
    },
    craftCrowbarZones: ['start', 'red_wing'],
    fuseZone: 'blue_wing',
    clueZones: ['start', 'red_wing', 'blue_wing', 'basement'],
    safeRewardItem: 'master_key',
  },
  {
    keyZones: {
      blue_key: 'start',
      red_key: 'start',
      basement_key: 'red_wing',
      crowbar: 'blue_wing',
      master_key: 'safe_reward',
    },
    craftCrowbarZones: ['start', 'blue_wing'],
    fuseZone: 'red_wing',
    clueZones: ['start', 'blue_wing', 'red_wing', 'basement_depot'],
    safeRewardItem: 'master_key',
  },
];

function buildArchitectureGrids(): {
  floor0: Uint8Array;
  floorMinus1: Uint8Array;
  surface0: SurfaceType[];
  surfaceMinus1: SurfaceType[];
} {
  const floor0 = new Uint8Array(GRID_W * GRID_H);
  const floorMinus1 = new Uint8Array(GRID_W * GRID_H);
  const surface0: SurfaceType[] = new Array(GRID_W * GRID_H).fill('concrete');
  const surfaceMinus1: SurfaceType[] = new Array(GRID_W * GRID_H).fill('basement_wet');

  // ---- GROUND FLOOR (FLOOR 0) ----
  // 1. Recepção (South Gatehouse — open, with tutorial boards!)
  fillRect(floor0, surface0, 15, 30, 20, 33, CELL_FLOOR, 'stone');
  // 2. Sala de Segurança Cabine 09-A (between Refeitório and Recepção, hermetically sealed except 2 blast doors!)
  fillRect(floor0, surface0, 9, 30, 13, 33, CELL_FLOOR, 'tile');
  // 3. Pátio Interno Voxel (open night sky!)
  fillRect(floor0, surface0, 10, 21, 25, 29, CELL_COURTYARD, 'stone');
  // Solid north wall separating Courtyard from SecurityBunker (Cabine 09-A) (keeps Reception x=15..20 wide open!)
  fillRect(floor0, surface0, 9, 29, 14, 29, CELL_VOID, 'stone');
  // 4. Passagem Central (connects Pátio <-> Corredor Norte)
  fillRect(floor0, surface0, 16, 10, 19, 20, CELL_FLOOR, 'wood');
  // 5. Refeitório · Ala Oeste (full height z=13..33 so it links to Cabine 09-A Left Blast Door!)
  fillRect(floor0, surface0, 4, 13, 7, 33, CELL_FLOOR, 'tile');
  // 6. Oficina · Ala Leste
  fillRect(floor0, surface0, 27, 13, 31, 31, CELL_FLOOR, 'wood');
  // 7. Corredor Norte (links all 3 north-south routes cleanly!)
  fillRect(floor0, surface0, 4, 10, 31, 12, CELL_FLOOR, 'concrete');
  // 8. Portão de Saída Principal (North)
  fillRect(floor0, surface0, 15, 2, 20, 8, CELL_FLOOR, 'stone');

  // Open passages between Pátio & Side Wings (top connectors at gz=21..22; vents sit lower at gz=26!)
  fillRect(floor0, surface0, 8, 21, 9, 22, CELL_FLOOR, 'stone');
  fillRect(floor0, surface0, 26, 21, 26, 22, CELL_FLOOR, 'stone');

  // Cabine 09-A Blast Door openings (exact 2-cell width at gz=31..32, flanked by solid walls!)
  fillRect(floor0, surface0, 8, 31, 8, 32, CELL_FLOOR, 'tile'); // Left Cabine 09-A Blast Door
  fillRect(floor0, surface0, 14, 31, 14, 32, CELL_FLOOR, 'tile'); // Right Cabine 09-A Blast Door

  // Ground-Floor Voxel Ventilation Ducts (CELL_VENT = 5 — crouch-only tactical flanking!)
  fillRect(floor0, surface0, 8, 26, 9, 26, CELL_VENT, 'vent_metal'); // Refeitório <-> Pátio
  fillRect(floor0, surface0, 26, 26, 26, 26, CELL_VENT, 'vent_metal'); // Pátio <-> Oficina

  // 9. Arquivo Morto (Red Wing — sealed except 2-cell Red Door at gx=15, gz=16..17)
  fillRect(floor0, surface0, 10, 14, 14, 19, CELL_FLOOR, 'wood');
  fillRect(floor0, surface0, 15, 16, 15, 17, CELL_FLOOR, 'wood');

  // 10. Enfermaria (Blue Wing — sealed except 2-cell Blue Door at gx=20, gz=16..17)
  fillRect(floor0, surface0, 21, 14, 25, 19, CELL_FLOOR, 'tile');
  fillRect(floor0, surface0, 20, 16, 20, 17, CELL_FLOOR, 'tile');

  // Exit doorway (exact 2-cell span gx=17..18, gz=9)
  fillRect(floor0, surface0, 17, 9, 18, 9, CELL_FLOOR, 'stone');

  // 11. Exact 2-cell wide Staircases to Underground (zero side gaps!)
  for (const st of STAIRWAYS) {
    fillRect(floor0, surface0, st.gxMin, st.gzBottom, st.gxMax, st.gzTop, CELL_STAIR, 'concrete');
    fillRect(floor0, surface0, st.gxMin, st.gzTop + 1, st.gxMax, st.gzTop + 1, CELL_FLOOR, 'concrete');
  }

  buildPerimeterWalls(floor0);

  // ---- UNDERGROUND FLOOR (FLOOR -1) ----
  // Full 360° perimeter loop
  fillRect(floorMinus1, surfaceMinus1, 5, 11, 30, 14, CELL_FLOOR, 'basement_wet');
  fillRect(floorMinus1, surfaceMinus1, 5, 28, 30, 30, CELL_FLOOR, 'basement_wet');
  fillRect(floorMinus1, surfaceMinus1, 5, 15, 7, 27, CELL_FLOOR, 'basement_wet');
  fillRect(floorMinus1, surfaceMinus1, 28, 15, 30, 27, CELL_FLOOR, 'basement_wet');

  // Sala dos Geradores (North Center — Safe + Generator Lever + Subsolo Workbench)
  fillRect(floorMinus1, surfaceMinus1, 13, 3, 22, 9, CELL_FLOOR, 'concrete');
  fillRect(floorMinus1, surfaceMinus1, 17, 10, 18, 10, CELL_FLOOR, 'concrete');

  // Câmara Secreta (North-East — behind Wire Cutters Gate at gx=25..26, gz=10!)
  fillRect(floorMinus1, surfaceMinus1, 24, 3, 27, 9, CELL_FLOOR, 'tile');
  fillRect(floorMinus1, surfaceMinus1, 25, 10, 26, 10, CELL_FLOOR, 'tile');

  // Caldeira (West-Center — loopable north & south)
  fillRect(floorMinus1, surfaceMinus1, 9, 16, 14, 26, CELL_FLOOR, 'basement_wet');
  fillRect(floorMinus1, surfaceMinus1, 11, 15, 12, 15, CELL_FLOOR, 'basement_wet');
  fillRect(floorMinus1, surfaceMinus1, 11, 27, 12, 27, CELL_FLOOR, 'basement_wet');

  // Depósito Químico (Center — sealed behind Crowbar Planks at gx=17..18, gz=15!)
  fillRect(floorMinus1, surfaceMinus1, 16, 16, 19, 25, CELL_FLOOR, 'concrete');
  fillRect(floorMinus1, surfaceMinus1, 17, 15, 18, 15, CELL_FLOOR, 'concrete');

  // Underground Vent Duct (Caldeira <-> Celas right below the Depot, crouch-only!)
  fillRect(floorMinus1, surfaceMinus1, 15, 26, 20, 26, CELL_VENT, 'vent_metal');

  // Celas (East-Center — loopable north & south)
  fillRect(floorMinus1, surfaceMinus1, 21, 16, 26, 26, CELL_FLOOR, 'tile');
  fillRect(floorMinus1, surfaceMinus1, 23, 15, 24, 15, CELL_FLOOR, 'tile');
  fillRect(floorMinus1, surfaceMinus1, 23, 27, 24, 27, CELL_FLOOR, 'tile');

  // Underground Stair landings & UNOBSTRUCTED bottom exit tunnels into the Underground!
  for (const st of STAIRWAYS) {
    fillRect(floorMinus1, surfaceMinus1, st.gxMin, st.gzBottom, st.gxMax, st.gzTop, CELL_STAIR, 'concrete');
    // Solid underground landing at the bottom (z=2..3) AND walkable under-stair floor under the high top (z=8..10)
    fillRect(floorMinus1, surfaceMinus1, st.gxMin, 2, st.gxMax, 2, CELL_FLOOR, 'basement_wet');
    fillRect(floorMinus1, surfaceMinus1, st.gxMin, st.gzTop + 1, st.gxMax, 10, CELL_FLOOR, 'basement_wet');
  }
  // West Stair bottom exit (z=2..4) connects directly EAST to Generator & SOUTH via x=8..9 into Túnel de Manutenção!
  fillRect(floorMinus1, surfaceMinus1, 7, 2, 12, 4, CELL_FLOOR, 'basement_wet');
  fillRect(floorMinus1, surfaceMinus1, 8, 5, 9, 10, CELL_FLOOR, 'basement_wet');
  // East Stair bottom exit (z=2..3) connects directly WEST via x=28 into Túnel de Manutenção (never bypassing Secret Chamber)!
  fillRect(floorMinus1, surfaceMinus1, 28, 2, 28, 10, CELL_FLOOR, 'basement_wet');

  buildPerimeterWalls(floorMinus1);

  return { floor0, floorMinus1, surface0, surfaceMinus1 };
}

function buildDoors(): DoorDefinition[] {
  return [
    // SecurityBunker (Cabine 09-A) Dual Electric Blast Doors (start OPEN, slam CLOSED via wall buttons!)
    {
      id: 'door_bunker_left',
      name: 'Porta Hidráulica Oeste (Cabine 09-A)',
      floor: 0,
      gx: 8,
      gz: 31,
      spanCells: 2,
      axis: 'z',
      lockType: 'bunker_blast',
      zoneA: 'start',
      zoneB: 'start',
      isOpen: true,
      isUnlocked: true,
      openProgress: 1,
    },
    {
      id: 'door_bunker_right',
      name: 'Porta Hidráulica Leste (Cabine 09-A)',
      floor: 0,
      gx: 14,
      gz: 31,
      spanCells: 2,
      axis: 'z',
      lockType: 'bunker_blast',
      zoneA: 'start',
      zoneB: 'start',
      isOpen: true,
      isUnlocked: true,
      openProgress: 1,
    },
    // Layer 1 Progression Doors
    {
      id: 'door_red',
      name: 'Porta Vermelha (Arquivo Morto)',
      floor: 0,
      gx: 15,
      gz: 16,
      spanCells: 2,
      axis: 'z',
      lockType: 'red_key',
      zoneA: 'start',
      zoneB: 'red_wing',
      isOpen: false,
      isUnlocked: false,
      openProgress: 0,
    },
    {
      id: 'door_blue',
      name: 'Porta Azul (Enfermaria)',
      floor: 0,
      gx: 20,
      gz: 16,
      spanCells: 2,
      axis: 'z',
      lockType: 'blue_key',
      zoneA: 'start',
      zoneB: 'blue_wing',
      isOpen: false,
      isUnlocked: false,
      openProgress: 0,
    },
    // Underground Stair Gates (exact 2-cell span -> ZERO side gaps!)
    {
      id: 'door_basement_gate',
      name: 'Grade do Subsolo (Oeste)',
      floor: 0,
      gx: 5,
      gz: 9,
      spanCells: 2,
      axis: 'x',
      lockType: 'basement_key',
      zoneA: 'start',
      zoneB: 'basement',
      isOpen: false,
      isUnlocked: false,
      openProgress: 0,
    },
    {
      id: 'door_east_gate',
      name: 'Grade do Subsolo (Leste)',
      floor: 0,
      gx: 29,
      gz: 9,
      spanCells: 2,
      axis: 'x',
      lockType: 'basement_key',
      zoneA: 'start',
      zoneB: 'basement',
      isOpen: false,
      isUnlocked: false,
      openProgress: 0,
    },
    // Underground Boarded Chemical Depot
    {
      id: 'door_depot_planks',
      name: 'Depósito Químico (Tábuas)',
      floor: -1,
      gx: 17,
      gz: 15,
      spanCells: 2,
      axis: 'x',
      lockType: 'crowbar_planks',
      zoneA: 'basement',
      zoneB: 'basement_depot',
      isOpen: false,
      isUnlocked: false,
      planksRemoved: false,
      openProgress: 0,
    },
    // Underground Secret Chamber Gate (Wire Cutters — Real/Secret ARG Layer!)
    {
      id: 'door_secret_gate',
      name: 'Grade da Câmara Secreta (Cadeado de Aço)',
      floor: -1,
      gx: 25,
      gz: 10,
      spanCells: 2,
      axis: 'x',
      lockType: 'wire_cutters',
      zoneA: 'basement',
      zoneB: 'secret_chamber',
      isOpen: false,
      isUnlocked: false,
      openProgress: 0,
    },
    // Main Exit Gate
    {
      id: 'door_exit',
      name: 'Portão de Saída Principal',
      floor: 0,
      gx: 17,
      gz: 9,
      spanCells: 2,
      axis: 'x',
      lockType: 'master_exit',
      zoneA: 'start',
      zoneB: 'exit',
      isExit: true,
      isOpen: false,
      isUnlocked: false,
      planksRemoved: false,
      electronicUnlocked: false,
      openProgress: 0,
    },
  ];
}

function buildHidingSpots(): HidingSpotDefinition[] {
  return [
    { id: 'hide_courtyard_table', kind: 'under_table', floor: 0, x: gridToWorld(12), y: FLOOR_0_Y, z: gridToWorld(27), facingYaw: -Math.PI / 2, roomId: 'courtyard' },
    { id: 'hide_west_locker', kind: 'locker', floor: 0, x: gridToWorld(4.3), y: FLOOR_0_Y, z: gridToWorld(24), facingYaw: Math.PI / 2, roomId: 'west_wing' },
    { id: 'hide_east_locker', kind: 'locker', floor: 0, x: gridToWorld(30.7), y: FLOOR_0_Y, z: gridToWorld(24), facingYaw: -Math.PI / 2, roomId: 'east_wing' },
    { id: 'hide_corridor_locker', kind: 'locker', floor: 0, x: gridToWorld(19.2), y: FLOOR_0_Y, z: gridToWorld(19.2), facingYaw: -Math.PI / 2, roomId: 'corridor' },
    { id: 'hide_office_table', kind: 'under_table', floor: 0, x: gridToWorld(12), y: FLOOR_0_Y, z: gridToWorld(16.5), facingYaw: Math.PI / 2, roomId: 'office' },
    { id: 'hide_library_table', kind: 'under_table', floor: 0, x: gridToWorld(23), y: FLOOR_0_Y, z: gridToWorld(16.5), facingYaw: -Math.PI / 2, roomId: 'library' },
    { id: 'hide_north_locker', kind: 'locker', floor: 0, x: gridToWorld(13), y: FLOOR_0_Y, z: gridToWorld(10.3), facingYaw: 0, roomId: 'north_gallery' },
    { id: 'hide_basement_locker1', kind: 'locker', floor: -1, x: gridToWorld(6.3), y: FLOOR_MINUS_1_Y, z: gridToWorld(13.5), facingYaw: Math.PI / 2, roomId: 'flooded_corridor' },
    { id: 'hide_boiler_locker', kind: 'locker', floor: -1, x: gridToWorld(9.3), y: FLOOR_MINUS_1_Y, z: gridToWorld(20), facingYaw: Math.PI / 2, roomId: 'boiler' },
    { id: 'hide_cells_bed', kind: 'under_bed', floor: -1, x: gridToWorld(25.2), y: FLOOR_MINUS_1_Y, z: gridToWorld(21), facingYaw: -Math.PI / 2, roomId: 'cells' },
    { id: 'hide_south_locker', kind: 'locker', floor: -1, x: gridToWorld(18), y: FLOOR_MINUS_1_Y, z: gridToWorld(29.7), facingYaw: Math.PI, roomId: 'south_tunnel' },
  ];
}

function buildNoiseProps(): NoisePropDefinition[] {
  return [
    { id: 'np_courtyard', kind: 'bottles', floor: 0, x: gridToWorld(14.5), y: FLOOR_0_Y, z: gridToWorld(25.5), triggered: false, cooldown: 0 },
    { id: 'np_west', kind: 'tin_cans', floor: 0, x: gridToWorld(6.2), y: FLOOR_0_Y, z: gridToWorld(19.5), triggered: false, cooldown: 0 },
    { id: 'np_east', kind: 'bottles', floor: 0, x: gridToWorld(28.5), y: FLOOR_0_Y, z: gridToWorld(19.5), triggered: false, cooldown: 0 },
    { id: 'np_gallery', kind: 'tin_cans', floor: 0, x: gridToWorld(20.5), y: FLOOR_0_Y, z: gridToWorld(11.4), triggered: false, cooldown: 0 },
    { id: 'np_basement_1', kind: 'bottles', floor: -1, x: gridToWorld(15.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(12.6), triggered: false, cooldown: 0 },
    { id: 'np_basement_2', kind: 'tin_cans', floor: -1, x: gridToWorld(22.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(28.8), triggered: false, cooldown: 0 },
  ];
}

function buildWorkbenches(): WorkbenchDefinition[] {
  return [
    {
      id: 'wb_workshop',
      name: 'Bancada de Craft · Oficina',
      floor: 0,
      x: gridToWorld(30.4),
      y: FLOOR_0_Y,
      z: gridToWorld(26),
      facingYaw: -Math.PI / 2,
    },
    {
      id: 'wb_generator',
      name: 'Bancada de Craft · Subsolo',
      floor: -1,
      x: gridToWorld(13.8),
      y: FLOOR_MINUS_1_Y,
      z: gridToWorld(7.2),
      facingYaw: Math.PI / 2,
    },
  ];
}

function buildRechargeStations(): RechargeStationDefinition[] {
  return [
    {
      id: 'rc_security',
      name: 'Estação de Recarga · Segurança',
      floor: 0,
      x: gridToWorld(11),
      y: FLOOR_0_Y + 1.35,
      z: gridToWorld(33.35),
      facingYaw: Math.PI,
      cooldown: 0,
    },
    {
      id: 'rc_workshop',
      name: 'Estação de Recarga · Oficina',
      floor: 0,
      x: gridToWorld(31.35),
      y: FLOOR_0_Y + 1.35,
      z: gridToWorld(20),
      facingYaw: -Math.PI / 2,
      cooldown: 0,
    },
  ];
}

function buildCassettes(): CassetteTapeDefinition[] {
  return [
    {
      id: 'tape_1',
      title: 'Fita #1 · Turno da Noite 09',
      roomName: 'Guarita de Vigilância (Cabine 09-A)',
      floor: 0,
      x: gridToWorld(10.0),
      y: FLOOR_0_Y + 0.72,
      z: gridToWorld(33.15),
      drawerId: 'furn_drawer_bunker',
      transcript:
        '"Vigia Marcos aqui. As portas blindadas desta guarita seguram o P. Drizzy pelos botões da parede, mas drenam a bateria do bloco. Vigie os corredores pelo Monitor CCTV — desde o vazamento do Composto 09, ele não reconhece mais ninguém."',
      listened: false,
    },
    {
      id: 'tape_2',
      title: 'Fita #2 · Fuga pelos Dutos',
      roomName: 'Refeitório · Ala Oeste',
      floor: 0,
      x: gridToWorld(4.35),
      y: FLOOR_0_Y + 0.72,
      z: gridToWorld(31.5),
      drawerId: 'furn_drawer_dining',
      transcript:
        '"O pessoal da noite abandonou o refeitório às pressas. Soltei a grade do duto metálico da parede — o P. Drizzy ficou largo demais depois da mutação e não consegue passar por ali. Agache e use os dutos se ele te cercar."',
      listened: false,
    },
    {
      id: 'tape_3',
      title: 'Fita #3 · Oficina & Rastro UV',
      roomName: 'Oficina · Ala Leste',
      floor: 0,
      x: gridToWorld(30.4),
      y: FLOOR_0_Y + 1.07,
      z: gridToWorld(26.35),
      transcript:
        '"Deixei o esquema do Pé de Cabra na Bancada: junte a Haste de Aço e o Gancho para arrancar as tábuas que os cientistas pregaram na saída. E ligue o modo UV da lanterna — pintei cifras fluorescentes nas paredes levando ao Projeto Ômega."',
      listened: false,
    },
    {
      id: 'tape_4',
      title: 'Fita #4 · O Blecaute do Setor 09',
      roomName: 'Subsolo · Celas de Contenção',
      floor: -1,
      x: gridToWorld(25.65),
      y: FLOOR_MINUS_1_Y + 0.72,
      z: gridToWorld(17.5),
      drawerId: 'furn_drawer_cells',
      transcript:
        '"Cela 09 arrombada por dentro... Se você desceu atrás de mim, o disjuntor do bloco cai assim que destrancam a grade do Subsolo. Encontre o Fusível Industrial, religue a Sala dos Geradores e abra o cofre — eu precisei descer para o Nível -2!"',
      listened: false,
    },
  ];
}

function buildBunkerCameras(cameraSecretCode: string): BunkerCameraDefinition[] {
  return [
    {
      id: 'cam_01',
      label: 'CAM 01',
      roomName: 'Pátio Interno Voxel',
      floor: 0,
      x: gridToWorld(10.6),
      y: FLOOR_0_Y + 2.65,
      z: gridToWorld(28.4),
      lookX: gridToWorld(19.0),
      lookY: FLOOR_0_Y + 1.05,
      lookZ: gridToWorld(23.0),
    },
    {
      id: 'cam_02',
      label: 'CAM 02',
      roomName: 'Passagem Central',
      floor: 0,
      x: gridToWorld(17.5),
      y: FLOOR_0_Y + 3.1,
      z: gridToWorld(20),
      lookX: gridToWorld(17.5),
      lookY: FLOOR_0_Y + 1.1,
      lookZ: gridToWorld(11),
    },
    {
      id: 'cam_03',
      label: 'CAM 03',
      roomName: 'Refeitório · Ala Oeste',
      floor: 0,
      x: gridToWorld(6.6),
      y: FLOOR_0_Y + 3.05,
      z: gridToWorld(14),
      lookX: gridToWorld(5.5),
      lookY: FLOOR_0_Y + 1.0,
      lookZ: gridToWorld(28),
    },
    {
      id: 'cam_04',
      label: 'CAM 04',
      roomName: 'Oficina · Ala Leste',
      floor: 0,
      x: gridToWorld(27.6),
      y: FLOOR_0_Y + 3.05,
      z: gridToWorld(14),
      lookX: gridToWorld(30),
      lookY: FLOOR_0_Y + 1.0,
      lookZ: gridToWorld(27),
    },
    {
      id: 'cam_05',
      label: 'CAM 05',
      roomName: 'Subsolo · Túnel Norte',
      floor: -1,
      x: gridToWorld(8),
      y: FLOOR_MINUS_1_Y + 2.55,
      z: gridToWorld(12.5),
      lookX: gridToWorld(24),
      lookY: FLOOR_MINUS_1_Y + 1.0,
      lookZ: gridToWorld(12.5),
    },
    {
      id: 'cam_06',
      label: 'CAM 06',
      roomName: 'Câmara Secreta (Subsolo)',
      floor: -1,
      x: gridToWorld(25.5),
      y: FLOOR_MINUS_1_Y + 2.5,
      z: gridToWorld(8.2),
      lookX: gridToWorld(25.5),
      lookY: FLOOR_MINUS_1_Y + 1.45,
      lookZ: gridToWorld(3.0),
      secretCodeHint: cameraSecretCode,
    },
  ];
}

function buildTutorialPlaques(): TutorialPlaqueDefinition[] {
  return [
    {
      id: 'tut_1',
      title: 'LANTERNA & LUZ UV',
      lines: ['[F] Ligar Lanterna', '[V] Modo Luz UV Roxa', 'UV revela cifras Omega', 'Recarregue nas Estacoes!'],
      floor: 0,
      x: gridToWorld(20.42),
      y: FLOOR_0_Y + 1.65,
      z: gridToWorld(31.5),
      facingYaw: -Math.PI / 2,
    },
    {
      id: 'tut_2',
      title: 'DUTOS & FURTIVIDADE',
      lines: ['[C] Agachar nos Dutos', 'P. Drizzy nao passa ali!', '[E] Armarios & Mesas', 'Jogue Latas p/ distrair'],
      floor: 0,
      x: gridToWorld(15.6),
      y: FLOOR_0_Y + 1.65,
      z: gridToWorld(33.42),
      facingYaw: Math.PI,
    },
    {
      id: 'tut_3',
      title: 'GUARITA & DEFESA',
      lines: ['Sala Cabine 09-A a Esquerda!', 'Cameras CCTV + 2 Portas', 'Bancada junta 2 pecas', 'Stun atordoa P. Drizzy!'],
      floor: 0,
      x: gridToWorld(19.4),
      y: FLOOR_0_Y + 1.65,
      z: gridToWorld(33.42),
      facingYaw: Math.PI,
    },
  ];
}

function buildFurniture(): FurniturePropDefinition[] {
  return [
    // Recepção · Setor 09 — Balcão do Vigia Marcos (rádio+crachá), Placa de Interdição torta, Gaveta, Plantas e Luminária
    { id: 'furn_drawer_reception', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(15.45), y: FLOOR_0_Y, z: gridToWorld(32.5), facingYaw: Math.PI / 2, label: 'Gaveta da Recepção', opened: false, openProgress: 0 },
    { id: 'furn_radio_desk', kind: 'radio_desk', floor: 0, x: gridToWorld(18.1), y: FLOOR_0_Y, z: gridToWorld(33.05), facingYaw: Math.PI, label: 'Rádio do Vigia Marcos' },
    { id: 'furn_broken_glass', kind: 'broken_glass_counter', floor: 0, x: gridToWorld(19.42), y: FLOOR_0_Y, z: gridToWorld(33.05), facingYaw: Math.PI },
    { id: 'furn_marcos_badge', kind: 'marcos_badge', floor: 0, x: gridToWorld(17.1), y: FLOOR_0_Y, z: gridToWorld(32.45), facingYaw: 0.42 },
    { id: 'furn_interdiction_board', kind: 'interdiction_board', floor: 0, x: gridToWorld(20.42), y: FLOOR_0_Y + 1.7, z: gridToWorld(30.35), facingYaw: -Math.PI / 2 },
    { id: 'furn_plant_rec_l', kind: 'potted_plant', floor: 0, x: gridToWorld(15.3), y: FLOOR_0_Y, z: gridToWorld(30.3), facingYaw: 0 },
    { id: 'furn_plant_rec_r', kind: 'potted_plant', floor: 0, x: gridToWorld(20.1), y: FLOOR_0_Y, z: gridToWorld(30.3), facingYaw: 0 },
    { id: 'furn_lamp_rec', kind: 'standing_lamp', floor: 0, x: gridToWorld(20.1), y: FLOOR_0_Y, z: gridToWorld(33.1), facingYaw: 0 },

    // Sala de Segurança Cabine 09-A — Bancada CCTV com PC+Teclado+Mouse, Cadeira derrubada+Café, 2 Gavetas, Planta Baixa & Cabos
    { id: 'furn_bunker_desk', kind: 'desk_monitor', floor: 0, x: gridToWorld(11), y: FLOOR_0_Y, z: gridToWorld(30.25), facingYaw: 0, label: 'Monitor CCTV' },
    { id: 'furn_coffee_spill', kind: 'coffee_spill', floor: 0, x: gridToWorld(11.0), y: FLOOR_0_Y, z: gridToWorld(31.9), facingYaw: 0.35 },
    { id: 'furn_drawer_bunker', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(10.0), y: FLOOR_0_Y, z: gridToWorld(33.15), facingYaw: Math.PI, label: 'Gaveta da Segurança (Fita)', opened: false, openProgress: 0 },
    { id: 'furn_drawer_bunker_r', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(12.2), y: FLOOR_0_Y, z: gridToWorld(33.15), facingYaw: Math.PI, label: 'Gaveta de Suprimentos Cabine 09-A', opened: false, openProgress: 0 },
    { id: 'furn_frame_bunker', kind: 'wall_frame', floor: 0, x: gridToWorld(11.0), y: FLOOR_0_Y + 2.22, z: gridToWorld(29.56), facingYaw: 0, variant: 2 },
    { id: 'furn_cable_bunker', kind: 'cable_conduit', floor: 0, x: gridToWorld(12.6), y: FLOOR_0_Y + 2.6, z: gridToWorld(29.56), facingYaw: 0 },

    // Pátio Interno — Banco quebrado, Placa de Alas, Câmera CCTV, Plantas & Aviso de Quarentena
    { id: 'furn_bench_broken', kind: 'bench_broken', floor: 0, x: gridToWorld(17.5), y: FLOOR_0_Y, z: gridToWorld(28.0), facingYaw: 0.16 },
    { id: 'furn_wing_sign', kind: 'wing_sign', floor: 0, x: gridToWorld(17.5), y: FLOOR_0_Y, z: gridToWorld(22.4), facingYaw: 0 },
    { id: 'furn_cctv_cy', kind: 'wall_cctv', floor: 0, x: gridToWorld(10.8), y: FLOOR_0_Y + 2.65, z: gridToWorld(20.56), facingYaw: 0 },
    { id: 'furn_plant_cy1', kind: 'potted_plant', floor: 0, x: gridToWorld(10.4), y: FLOOR_0_Y, z: gridToWorld(21.4), facingYaw: 0 },
    { id: 'furn_plant_cy2', kind: 'potted_plant', floor: 0, x: gridToWorld(24.6), y: FLOOR_0_Y, z: gridToWorld(21.4), facingYaw: 0 },
    { id: 'furn_frame_cy1', kind: 'wall_frame', floor: 0, x: gridToWorld(16.0), y: FLOOR_0_Y + 1.8, z: gridToWorld(20.56), facingYaw: 0, variant: 0 },

    // Refeitório · Ala Oeste — Mesas, Grade de Duto solta no chão, Gaveta, Quadro & Luminária
    { id: 'furn_dining_1', kind: 'dining_table', floor: 0, x: gridToWorld(5.5), y: FLOOR_0_Y, z: gridToWorld(21), facingYaw: 0 },
    { id: 'furn_dining_2', kind: 'dining_table', floor: 0, x: gridToWorld(5.5), y: FLOOR_0_Y, z: gridToWorld(15), facingYaw: 0 },
    { id: 'furn_cafeteria_trays', kind: 'cafeteria_trays', floor: 0, x: gridToWorld(4.35), y: FLOOR_0_Y, z: gridToWorld(18.4), facingYaw: 0.25 },
    { id: 'furn_vent_grate', kind: 'vent_grate_loose', floor: 0, x: gridToWorld(7.1), y: FLOOR_0_Y, z: gridToWorld(26.15), facingYaw: -Math.PI / 2 },
    { id: 'furn_drawer_dining', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(4.35), y: FLOOR_0_Y, z: gridToWorld(31.5), facingYaw: Math.PI / 2, label: 'Gaveta do Refeitório', opened: false, openProgress: 0 },
    { id: 'furn_frame_dining', kind: 'wall_frame', floor: 0, x: gridToWorld(3.56), y: FLOOR_0_Y + 1.75, z: gridToWorld(28.0), facingYaw: Math.PI / 2, variant: 3 },
    { id: 'furn_lamp_dining', kind: 'standing_lamp', floor: 0, x: gridToWorld(7.1), y: FLOOR_0_Y, z: gridToWorld(14.0), facingYaw: 0 },

    // Oficina · Ala Leste — Caixotes, Barril, Esquema do Pé-de-Cabra, Caixa de Fusíveis estourada, Câmera & Gaveta
    { id: 'furn_crate_1', kind: 'crate', floor: 0, x: gridToWorld(30.5), y: FLOOR_0_Y, z: gridToWorld(30.2), facingYaw: 0.06 },
    { id: 'furn_barrel_1', kind: 'barrel', floor: 0, x: gridToWorld(27.5), y: FLOOR_0_Y, z: gridToWorld(29.5), facingYaw: 0 },
    { id: 'furn_wb_schematic', kind: 'workbench_schematic', floor: 0, x: gridToWorld(31.44), y: FLOOR_0_Y + 1.85, z: gridToWorld(26.0), facingYaw: -Math.PI / 2 },
    { id: 'furn_fuse_busted', kind: 'fuse_box_busted', floor: 0, x: gridToWorld(31.44), y: FLOOR_0_Y + 1.55, z: gridToWorld(23.6), facingYaw: -Math.PI / 2 },
    { id: 'furn_cctv_shop', kind: 'wall_cctv', floor: 0, x: gridToWorld(31.44), y: FLOOR_0_Y + 2.75, z: gridToWorld(15.2), facingYaw: -Math.PI / 2 },
    { id: 'furn_drawer_shop', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(30.8), y: FLOOR_0_Y, z: gridToWorld(17.5), facingYaw: -Math.PI / 2, label: 'Gaveta da Oficina', opened: false, openProgress: 0 },
    { id: 'furn_frame_shop', kind: 'wall_frame', floor: 0, x: gridToWorld(31.44), y: FLOOR_0_Y + 1.75, z: gridToWorld(28.5), facingYaw: -Math.PI / 2, variant: 5 },
    { id: 'furn_cable_shop', kind: 'cable_conduit', floor: 0, x: gridToWorld(31.44), y: FLOOR_0_Y + 2.5, z: gridToWorld(25.0), facingYaw: -Math.PI / 2 },

    // Passagem Central, Corredor Norte & Vestíbulo de Saída (Alçapão Nível -2!)
    { id: 'furn_frame_corr', kind: 'wall_frame', floor: 0, x: gridToWorld(15.56), y: FLOOR_0_Y + 1.75, z: gridToWorld(12.2), facingYaw: Math.PI / 2, variant: 0 },
    { id: 'furn_exit_pry', kind: 'exit_pry_marks', floor: 0, x: gridToWorld(15.0), y: FLOOR_0_Y, z: gridToWorld(11.2), facingYaw: 0.28 },
    { id: 'furn_level2_hatch', kind: 'level2_hatch', floor: 0, x: gridToWorld(17.5), y: FLOOR_0_Y, z: gridToWorld(3.8), facingYaw: 0, label: 'Alçapão · Nível -2 (Lab. Ômega)' },
    { id: 'furn_cable_north', kind: 'cable_conduit', floor: 0, x: gridToWorld(12.0), y: FLOOR_0_Y + 2.6, z: gridToWorld(9.56), facingYaw: 0 },
    { id: 'furn_cable_north2', kind: 'cable_conduit', floor: 0, x: gridToWorld(23.0), y: FLOOR_0_Y + 2.6, z: gridToWorld(9.56), facingYaw: 0 },

    // Arquivo Morto (Ala Vermelha) — Estantes, Arquivo Tombado c/ papéis Ômega, Retrato Sujeito 09, Quadro Tradução UV
    { id: 'furn_shelf_1', kind: 'bookshelf', floor: 0, x: gridToWorld(10.15), y: FLOOR_0_Y, z: gridToWorld(14.8), facingYaw: Math.PI / 2 },
    { id: 'furn_shelf_2', kind: 'bookshelf', floor: 0, x: gridToWorld(10.15), y: FLOOR_0_Y, z: gridToWorld(18.5), facingYaw: Math.PI / 2 },
    { id: 'furn_filing_toppled', kind: 'filing_toppled', floor: 0, x: gridToWorld(11.6), y: FLOOR_0_Y, z: gridToWorld(14.6), facingYaw: 0.32 },
    { id: 'furn_swivel_office', kind: 'swivel_chair', floor: 0, x: gridToWorld(11.8), y: FLOOR_0_Y, z: gridToWorld(17.9), facingYaw: 0.65 },
    { id: 'furn_drawer_office', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(13.5), y: FLOOR_0_Y, z: gridToWorld(14.25), facingYaw: 0, label: 'Arquivo de Gavetas', opened: false, openProgress: 0 },
    { id: 'furn_translation_board', kind: 'translation_board', floor: 0, x: gridToWorld(12), y: FLOOR_0_Y + 1.6, z: gridToWorld(13.56), facingYaw: 0, label: 'Quadro de Tradução UV' },
    { id: 'furn_frame_subject09', kind: 'wall_frame', floor: 0, x: gridToWorld(12.0), y: FLOOR_0_Y + 1.75, z: gridToWorld(19.44), facingYaw: Math.PI, variant: 1 },
    { id: 'furn_lamp_office', kind: 'standing_lamp', floor: 0, x: gridToWorld(14.1), y: FLOOR_0_Y, z: gridToWorld(18.9), facingYaw: 0 },

    // Enfermaria (Ala Azul) — Macas, Suporte de Soro Composto 09, ECG Paciente 09, Armário Médico
    { id: 'furn_bed_1', kind: 'bed_medical', floor: 0, x: gridToWorld(24.5), y: FLOOR_0_Y, z: gridToWorld(14.8), facingYaw: -Math.PI / 2 },
    { id: 'furn_bed_2', kind: 'bed_medical', floor: 0, x: gridToWorld(24.5), y: FLOOR_0_Y, z: gridToWorld(18.5), facingYaw: -Math.PI / 2 },
    { id: 'furn_iv_stand', kind: 'iv_stand', floor: 0, x: gridToWorld(23.7), y: FLOOR_0_Y, z: gridToWorld(16.8), facingYaw: -0.35 },
    { id: 'furn_drawer_med', kind: 'drawer_cabinet', floor: 0, x: gridToWorld(21.5), y: FLOOR_0_Y, z: gridToWorld(14.25), facingYaw: 0, label: 'Armário Médico', opened: false, openProgress: 0 },
    { id: 'furn_plant_med', kind: 'potted_plant', floor: 0, x: gridToWorld(21.2), y: FLOOR_0_Y, z: gridToWorld(18.9), facingYaw: 0 },
    { id: 'furn_frame_med', kind: 'wall_frame', floor: 0, x: gridToWorld(23.0), y: FLOOR_0_Y + 1.75, z: gridToWorld(13.56), facingYaw: 0, variant: 4 },

    // Subsolo — Tubulações, Tambor Vazando Composto 09, Placa Cela 09, Cilindros de Amostra na Câmara Ômega, Alavanca & Terminal
    { id: 'furn_pipes_1', kind: 'pipe_cluster', floor: -1, x: gridToWorld(9.4), y: FLOOR_MINUS_1_Y, z: gridToWorld(16.5), facingYaw: 0 },
    { id: 'furn_pipes_2', kind: 'pipe_cluster', floor: -1, x: gridToWorld(29.6), y: FLOOR_MINUS_1_Y, z: gridToWorld(19), facingYaw: Math.PI / 2 },
    { id: 'furn_barrel_chem1', kind: 'barrel', floor: -1, x: gridToWorld(16.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(24.2), facingYaw: 0 },
    { id: 'furn_barrel_chem2', kind: 'barrel', floor: -1, x: gridToWorld(18.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(24.2), facingYaw: 0 },
    { id: 'furn_chem_ooze', kind: 'chemical_barrel_ooze', floor: -1, x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(21.2), facingYaw: 0.42 },
    { id: 'furn_crate_base', kind: 'crate', floor: -1, x: gridToWorld(6.2), y: FLOOR_MINUS_1_Y, z: gridToWorld(26), facingYaw: 0 },
    { id: 'furn_cell_sign_09', kind: 'cell_sign_09', floor: -1, x: gridToWorld(26.42), y: FLOOR_MINUS_1_Y + 1.72, z: gridToWorld(19.6), facingYaw: -Math.PI / 2 },
    { id: 'furn_cell_bent_bars', kind: 'cell_bent_bars', floor: -1, x: gridToWorld(26.15), y: FLOOR_MINUS_1_Y, z: gridToWorld(19.2), facingYaw: -Math.PI / 2 },
    { id: 'furn_drawer_cells', kind: 'drawer_cabinet', floor: -1, x: gridToWorld(25.65), y: FLOOR_MINUS_1_Y, z: gridToWorld(17.5), facingYaw: -Math.PI / 2, label: 'Gaveta das Celas', opened: false, openProgress: 0 },
    { id: 'furn_cable_base', kind: 'cable_conduit', floor: -1, x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y + 2.3, z: gridToWorld(10.56), facingYaw: 0 },
    { id: 'furn_generator_lever', kind: 'generator_lever', floor: -1, x: gridToWorld(21.4), y: FLOOR_MINUS_1_Y, z: gridToWorld(5.5), facingYaw: -Math.PI / 2, label: 'Alavanca do Gerador' },
    { id: 'furn_spec_1', kind: 'specimen_cylinder', floor: -1, x: gridToWorld(24.3), y: FLOOR_MINUS_1_Y, z: gridToWorld(4.9), facingYaw: 0.25 },
    { id: 'furn_spec_2', kind: 'specimen_cylinder', floor: -1, x: gridToWorld(26.7), y: FLOOR_MINUS_1_Y, z: gridToWorld(4.9), facingYaw: -0.25 },
    { id: 'furn_secret_terminal', kind: 'secret_terminal', floor: -1, x: gridToWorld(25.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(4.2), facingYaw: 0, label: 'Terminal Ômega (5 Dígitos)' },
  ];
}

export function getItemLabel(t: WorldPickupType): string {
  switch (t) {
    case 'flashlight': return 'Lanterna Voxel';
    case 'stun_gun': return 'Arma de Stun';
    case 'stun_ammo': return 'Carga de Stun';
    case 'throwable_can': return 'Lata Arremessável';
    case 'red_key': return 'Chave Vermelha';
    case 'blue_key': return 'Chave Azul';
    case 'basement_key': return 'Chave do Subsolo';
    case 'crowbar': return 'Pé de Cabra';
    case 'crowbar_rod': return 'Haste de Aço (Craft)';
    case 'crowbar_hook': return 'Gancho Metálico (Craft)';
    case 'stun_coil': return 'Bobina Elétrica (Craft)';
    case 'stun_cell': return 'Célula de Carga (Craft)';
    case 'fuse': return 'Fusível Industrial';
    case 'wire_cutters': return 'Alicate de Corte';
    case 'master_key': return 'Chave Mestra';
    case 'flare': return 'Sinalizador';
    case 'battery': return 'Pilha de Lanterna';
  }
}

export function getItemDescription(t: WorldPickupType): string {
  switch (t) {
    case 'flashlight': return 'Ilumina corredores escuros do Setor 09. Pressione [V] para alternar o Modo Luz UV roxa.';
    case 'stun_gun': return 'Dispara arco elétrico de alta voltagem que atordoa o P. Drizzy (12s Easy · 9s Hard · 6s Nightmare).';
    case 'stun_ammo': return 'Recarrega +1 disparo elétrico na sua Arma de Stun.';
    case 'throwable_can': return 'Lata metálica arremessável. Cria eco metálico onde cair para distrair o P. Drizzy.';
    case 'red_key': return 'Destranca a Porta Vermelha do Arquivo Morto (Térreo).';
    case 'blue_key': return 'Destranca a Porta Azul da Enfermaria (Térreo).';
    case 'basement_key': return 'Abre as Grades Oeste e Leste das escadas para o Subsolo.';
    case 'crowbar': return 'Arranca as tábuas do Depósito Químico (Subsolo) e do Portão Norte de Saída.';
    case 'crowbar_rod': return 'Peça de Craft: combine com o Gancho Metálico em uma Bancada para montar o Pé de Cabra.';
    case 'crowbar_hook': return 'Peça de Craft: combine com a Haste de Aço em uma Bancada para montar o Pé de Cabra.';
    case 'stun_coil': return 'Peça de Craft: combine com a Célula de Carga na Bancada para fabricar +1 Carga de Stun.';
    case 'stun_cell': return 'Peça de Craft: combine com a Bobina Elétrica na Bancada para fabricar +1 Carga de Stun.';
    case 'fuse': return 'Instale na Sala dos Geradores (Subsolo) para religar a energia durante o Blecaute.';
    case 'wire_cutters': return 'Corta as correntes de aço da Câmara Ômega no Subsolo (visível pela CAM 06).';
    case 'master_key': return 'Chave final do Cofre do Gerador. Destranca o Portão Norte de Saída!';
    case 'flare': return 'Sinalizador luminoso de emergência: atordoa e afasta o P. Drizzy por instantes.';
    case 'battery': return 'Recarrega +42% da bateria da sua Lanterna Voxel instantaneamente.';
  }
}

export function generateMansionLayout(seed: number, difficulty: Difficulty): MansionLayout {
  const rng = createRng(seed);
  const { floor0, floorMinus1, surface0, surfaceMinus1 } = buildArchitectureGrids();
  const doors = buildDoors();
  const hidingSpots = buildHidingSpots();
  const noiseProps = buildNoiseProps();

  // Select a verified 3-layer preset deterministically from seed
  const presetIndex = Math.floor(rng() * PROGRESSION_PRESETS.length);
  const preset = PROGRESSION_PRESETS[presetIndex];

  const isSolvable = verifyLayoutSolvable({
    keyZones: preset.keyZones,
    craftCrowbarZones: preset.craftCrowbarZones,
    fuseZone: preset.fuseZone,
    clueZones: preset.clueZones,
    safeZone: 'basement',
    safeRewardItem: preset.safeRewardItem,
  });
  if (!isSolvable) {
    throw new Error(`Invariant failure: preset ${presetIndex} failed BFS solvability!`);
  }

  // Generate 4-digit Safe code + 5-digit Secret Terminal code + UV Symbol Map
  const safeDigits = [
    String(Math.floor(rng() * 9) + 1),
    String(Math.floor(rng() * 10)),
    String(Math.floor(rng() * 10)),
    String(Math.floor(rng() * 9) + 1),
  ];
  const safeCode = safeDigits.join('');

  const symbols = ['▲', '◆', '★', '✦', '✚'];
  const secretDigits = symbols.map(() => String(Math.floor(rng() * 9) + 1));
  const symbolMap = symbols.map((symbol, i) => ({ symbol, digit: secretDigits[i] }));
  const secretTerminalCode = secretDigits.join('');
  // Last 3 digits appear exclusively on CAM 06 inside the Secret Chamber!
  const cameraSecretCode = `${secretDigits[2]}${secretDigits[3]}${secretDigits[4]}`;

  const furniture = buildFurniture();
  const usedAnchorIds = new Set<string>();
  const usedRoomsInZone = new Map<string, Set<string>>();
  const placedCoords: { floor: FloorId; x: number; z: number }[] = [];

  // Smart RNG Dispersion: spread items across DIFFERENT rooms and enforce >= 3.2m minimum spacing!
  const pickAnchorInZone = (zoneId: string, pool: ItemAnchor[], preferDrawer = false): ItemAnchor => {
    const unused = pool.filter((a) => a.zoneId === zoneId && !usedAnchorIds.has(a.id));
    const fallback = pool.filter((a) => a.zoneId === zoneId);
    const baseList = unused.length > 0 ? unused : fallback;

    const roomSet = usedRoomsInZone.get(zoneId) ?? new Set<string>();
    const wellSpaced = baseList.filter((a) => {
      const ax = gridToWorld(a.gx);
      const az = gridToWorld(a.gz);
      return placedCoords.every((p) => p.floor !== a.floor || Math.hypot(p.x - ax, p.z - az) >= 3.2);
    });
    const freshRoomList = (wellSpaced.length > 0 ? wellSpaced : baseList).filter(
      (a) => !roomSet.has(a.roomId)
    );
    let list = freshRoomList.length > 0 ? freshRoomList : wellSpaced.length > 0 ? wellSpaced : baseList;
    if (preferDrawer) {
      const drawerCandidates = list.filter((a) => Boolean(a.drawerId));
      if (drawerCandidates.length > 0) list = drawerCandidates;
    }

    const chosen = list[Math.floor(rng() * list.length)];
    usedAnchorIds.add(chosen.id);
    roomSet.add(chosen.roomId);
    usedRoomsInZone.set(zoneId, roomSet);
    placedCoords.push({ floor: chosen.floor, x: gridToWorld(chosen.gx), z: gridToWorld(chosen.gz) });
    return chosen;
  };

  const addedSupportKeys = new Set<string>();
  const ensureTableUnder = (floor: FloorId, x: number, z: number, keyId: string): number => {
    const baseY = floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    if (!addedSupportKeys.has(keyId)) {
      addedSupportKeys.add(keyId);
      furniture.push({
        id: `furn_support_${keyId}`,
        kind: 'side_table',
        floor,
        x,
        y: baseY,
        z,
        facingYaw: 0,
      });
    }
    // side_table top sits at baseY + 0.84; items sit flush at +0.94!
    return baseY + 0.94;
  };

  const items: WorldItemSpawn[] = [];
  const spawnItemInZone = (
    id: string,
    itemType: WorldPickupType,
    zoneId: string,
    preferDrawer = false
  ) => {
    const anchor = pickAnchorInZone(zoneId, KEY_AND_TOOL_ANCHORS, preferDrawer);
    const wx = gridToWorld(anchor.gx);
    const wz = gridToWorld(anchor.gz);
    const baseY = anchor.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    let wy = baseY + anchor.yOffset;
    if (!anchor.drawerId && anchor.needsSideTable) {
      wy = ensureTableUnder(anchor.floor, wx, wz, anchor.id);
    }
    items.push({
      id,
      itemType,
      label: getItemLabel(itemType),
      floor: anchor.floor,
      x: wx,
      y: wy,
      z: wz,
      zoneId: anchor.zoneId,
      collected: false,
      drawerId: anchor.drawerId,
    });
  };

  // 1. Core Good Ending Keys & Direct Crowbar (spread across distinct rooms!)
  const directItems: ('red_key' | 'blue_key' | 'basement_key' | 'crowbar')[] = [
    'red_key',
    'blue_key',
    'basement_key',
    'crowbar',
  ];
  for (const itemType of directItems) {
    spawnItemInZone(`item_${itemType}`, itemType, preset.keyZones[itemType], false);
  }

  // 2. Craft Workbench Pieces (Rod + Hook -> alternate Crowbar craft; Coil + Cell -> extra Stun Ammo!)
  spawnItemInZone('item_crowbar_rod', 'crowbar_rod', preset.craftCrowbarZones[0], false);
  spawnItemInZone('item_crowbar_hook', 'crowbar_hook', preset.craftCrowbarZones[1], true);
  spawnItemInZone('item_stun_coil', 'stun_coil', 'start', true);
  spawnItemInZone('item_stun_cell', 'stun_cell', 'basement', false);

  // 3. Industrial Fuse (restores power after Blackout!)
  spawnItemInZone('item_fuse', 'fuse', preset.fuseZone, false);

  // 4. Piggy-Style Stun Gun (1 loaded shot) + 2 Extra Stun Ammo Pickups!
  spawnItemInZone('item_stun_gun', 'stun_gun', 'start', false);
  spawnItemInZone('item_stun_ammo_1', 'stun_ammo', 'red_wing', true);
  spawnItemInZone('item_stun_ammo_2', 'stun_ammo', 'basement', false);

  // 5. Wire Cutters (Real/Secret ARG layer -> opens Secret Chamber in Underground!)
  spawnItemInZone('item_wire_cutters', 'wire_cutters', 'blue_wing', true);

  // 6. Throwable Distraction Cans (EVERY can sits solidly on a table/crate or on the floor — ZERO floating!)
  const throwableSpots: { floor: FloorId; x: number; y: number; z: number; zone: string; onTable?: boolean }[] = [
    { floor: 0, x: gridToWorld(15.6), y: FLOOR_0_Y + 0.12, z: gridToWorld(28.0), zone: 'start' }, // resting cleanly on Courtyard stone!
    { floor: 0, x: gridToWorld(6.8), y: FLOOR_0_Y + 0.12, z: gridToWorld(27.5), zone: 'start' }, // resting cleanly on Refeitório floor (clear of dining table anchor)!
    { floor: 0, x: gridToWorld(27.5), y: FLOOR_0_Y + 1.15, z: gridToWorld(29.5), zone: 'start' }, // resting cleanly on Oficina Barrel!
    { floor: -1, x: gridToWorld(6.2), y: FLOOR_MINUS_1_Y + 1.07, z: gridToWorld(26.0), zone: 'basement' }, // resting cleanly on Subsolo Crate!
  ];
  throwableSpots.forEach((sp, idx) => {
    items.push({
      id: `item_can_${idx}`,
      itemType: 'throwable_can',
      label: getItemLabel('throwable_can'),
      floor: sp.floor,
      x: sp.x,
      y: sp.y,
      z: sp.z,
      zoneId: sp.zone,
      collected: false,
    });
  });

  // 7. Master Key stored inside the Underground Generator Safe
  const safeX = gridToWorld(17.5);
  const safeY = FLOOR_MINUS_1_Y + 0.55;
  const safeZ = gridToWorld(3.6);
  const safeRewardId = 'item_master_key';
  items.push({
    id: safeRewardId,
    itemType: 'master_key',
    label: getItemLabel('master_key'),
    floor: -1,
    x: safeX,
    y: safeY + 0.3,
    z: safeZ + 0.4,
    zoneId: 'safe_reward',
    collected: false,
    insideSafe: true,
  });

  const safe: SafeDefinition = {
    id: 'safe_generator',
    name: 'Cofre do Gerador',
    floor: -1,
    x: safeX,
    y: safeY,
    z: safeZ,
    facingYaw: 0,
    zoneId: 'basement',
    code: safeCode,
    unlocked: false,
    rewardItemId: safeRewardId,
  };

  // 8. Place 4 ARG Clues pinned FLUSH on actual walls!
  const usedClueIds = new Set<string>();
  const clues: ArgCluePlacement[] = [];
  for (let dIdx = 0; dIdx < 4; dIdx++) {
    const z = preset.clueZones[dIdx];
    const candidates = CLUE_ANCHORS.filter((a) => a.zoneId === z && !usedClueIds.has(a.id));
    const fallback = CLUE_ANCHORS.filter((a) => a.zoneId === z);
    const list = candidates.length > 0 ? candidates : fallback;
    const chosen = list[Math.floor(rng() * list.length)];
    usedClueIds.add(chosen.id);

    const flavor = CLUE_FLAVORS[dIdx];
    clues.push({
      id: `clue_${dIdx}`,
      digitIndex: dIdx as 0 | 1 | 2 | 3,
      digitValue: safeDigits[dIdx],
      title: flavor.title,
      roomId: chosen.roomId,
      roomName: chosen.roomName,
      flavorText: flavor.template.replace('{D}', safeDigits[dIdx]),
      floor: chosen.floor,
      x: gridToWorld(chosen.gx),
      y: (chosen.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y) + chosen.yOffset,
      z: gridToWorld(chosen.gz),
      facingYaw: chosen.facingYaw ?? 0,
      zoneId: chosen.zoneId,
      discovered: false,
    });
  }

  // 9. Place UV Fluorescent Marks (only glowing clearly under UV Light!)
  const uvMarks: UvMarkDefinition[] = [
    {
      id: 'uv_1',
      kind: 'symbol_digit',
      floor: 0,
      x: gridToWorld(13.5),
      y: FLOOR_0_Y + 1.55,
      z: gridToWorld(20.56),
      facingYaw: 0,
      symbolChar: symbols[0],
      digitValue: secretDigits[0],
      title: 'Cifra UV #1',
      roomName: 'Pátio Interno',
      discovered: false,
    },
    {
      id: 'uv_2',
      kind: 'symbol_digit',
      floor: 0,
      x: gridToWorld(21.5),
      y: FLOOR_0_Y + 1.55,
      z: gridToWorld(20.56),
      facingYaw: 0,
      symbolChar: symbols[1],
      digitValue: secretDigits[1],
      title: 'Cifra UV #2',
      roomName: 'Pátio Interno',
      discovered: false,
    },
    {
      id: 'uv_3',
      kind: 'symbol_digit',
      floor: 0,
      x: gridToWorld(25.44),
      y: FLOOR_0_Y + 1.55,
      z: gridToWorld(16.5),
      facingYaw: -Math.PI / 2,
      symbolChar: symbols[2],
      digitValue: secretDigits[2],
      title: 'Cifra UV #3',
      roomName: 'Enfermaria',
      discovered: false,
    },
    {
      id: 'uv_4',
      kind: 'symbol_digit',
      floor: -1,
      x: gridToWorld(17.5),
      y: FLOOR_MINUS_1_Y + 1.45,
      z: gridToWorld(30.44),
      facingYaw: Math.PI,
      symbolChar: symbols[3],
      digitValue: secretDigits[3],
      title: 'Cifra UV #4',
      roomName: 'Subsolo · Túnel Sul',
      discovered: false,
    },
    {
      id: 'uv_5',
      kind: 'symbol_digit',
      floor: -1,
      x: gridToWorld(13.56),
      y: FLOOR_MINUS_1_Y + 1.45,
      z: gridToWorld(5.5),
      facingYaw: Math.PI / 2,
      symbolChar: symbols[4],
      digitValue: secretDigits[4],
      title: 'Cifra UV #5',
      roomName: 'Sala dos Geradores',
      discovered: false,
    },
  ];

  // 10. Place Battery Packs — GUARANTEED inside hollow drawers & resting flush on real tables/crates!
  const diffCfg = getDifficultyConfig(difficulty);
  const batterySpots: { floor: FloorId; x: number; y: number; z: number; drawerId?: string; makeTableId?: string }[] = [
    // #0 inside Reception Hollow Drawer (so player immediately finds items inside drawers!)
    { floor: 0, x: gridToWorld(15.45), y: FLOOR_0_Y + 0.72, z: gridToWorld(32.5), drawerId: 'furn_drawer_reception' },
    // #1 resting on dedicated Refeitório South-West side table (clear of dining table RNG anchors!)
    { floor: 0, x: gridToWorld(4.5), y: FLOOR_0_Y + 0.96, z: gridToWorld(29.0), makeTableId: 'bat_dining_sw' },
    // #2 resting on Courtyard east side table
    { floor: 0, x: gridToWorld(23.5), y: FLOOR_0_Y + 0.96, z: gridToWorld(27.5), makeTableId: 'bat_cy_e' },
    // #3 resting on Oficina Workbench corner
    { floor: 0, x: gridToWorld(30.4), y: FLOOR_0_Y + 1.13, z: gridToWorld(25.6) },
    // #4 resting on North Gallery side table
    { floor: 0, x: gridToWorld(14.5), y: FLOOR_0_Y + 0.96, z: gridToWorld(10.5), makeTableId: 'bat_ng' },
    // #5 resting on Subsolo Barrel
    { floor: -1, x: gridToWorld(16.5), y: FLOOR_MINUS_1_Y + 1.17, z: gridToWorld(24.2) },
    // #6 resting on Subsolo Workbench corner
    { floor: -1, x: gridToWorld(13.8), y: FLOOR_MINUS_1_Y + 1.13, z: gridToWorld(6.8) },
    // #7 resting on Subsolo South Tunnel side table
    { floor: -1, x: gridToWorld(18.0), y: FLOOR_MINUS_1_Y + 0.96, z: gridToWorld(28.5), makeTableId: 'bat_sub_s' },
  ];
  for (let i = 0; i < Math.min(diffCfg.batteryPackCount, batterySpots.length); i++) {
    const sp = batterySpots[i];
    let wy = sp.y;
    if (sp.makeTableId) {
      wy = ensureTableUnder(sp.floor, sp.x, sp.z, sp.makeTableId) + 0.04;
    }
    items.push({
      id: `battery_${i}`,
      itemType: 'battery',
      label: 'Pilha de Lanterna',
      floor: sp.floor,
      x: sp.x,
      y: wy,
      z: sp.z,
      zoneId: sp.floor === 0 ? 'start' : 'basement',
      collected: false,
      drawerId: sp.drawerId,
    });
  }

  // Player spawns in Recepção (South) looking North toward the illuminated Voxel Courtyard
  const spawnPoint = {
    x: gridToWorld(17.5),
    y: FLOOR_0_Y,
    z: gridToWorld(32.0),
    yaw: 0,
    floor: 0 as FloorId,
  };

  // P. Diddy spawns FAR opposite player in the North-West wing (~39m away!)
  const diddySpawnPoint = {
    x: gridToWorld(5.5),
    y: FLOOR_0_Y,
    z: gridToWorld(11.0),
    floor: 0 as FloorId,
  };

  const patrolWaypoints: { x: number; y: number; z: number; floor: FloorId }[] = [
    { x: gridToWorld(5.5), y: FLOOR_0_Y, z: gridToWorld(11.0), floor: 0 },
    { x: gridToWorld(17.5), y: FLOOR_0_Y, z: gridToWorld(11.0), floor: 0 },
    { x: gridToWorld(29.5), y: FLOOR_0_Y, z: gridToWorld(11.0), floor: 0 },
    { x: gridToWorld(29.5), y: FLOOR_0_Y, z: gridToWorld(25.0), floor: 0 },
    { x: gridToWorld(17.5), y: FLOOR_0_Y, z: gridToWorld(25.0), floor: 0 },
    { x: gridToWorld(5.5), y: FLOOR_0_Y, z: gridToWorld(25.0), floor: 0 },
    { x: gridToWorld(17.5), y: FLOOR_0_Y, z: gridToWorld(16.0), floor: 0 },
    { x: gridToWorld(12.0), y: FLOOR_MINUS_1_Y, z: gridToWorld(12.5), floor: -1 },
    { x: gridToWorld(24.0), y: FLOOR_MINUS_1_Y, z: gridToWorld(12.5), floor: -1 },
    { x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y, z: gridToWorld(7.0), floor: -1 },
    { x: gridToWorld(12.0), y: FLOOR_MINUS_1_Y, z: gridToWorld(29.0), floor: -1 },
    { x: gridToWorld(24.0), y: FLOOR_MINUS_1_Y, z: gridToWorld(29.0), floor: -1 },
  ];

  // Narrative Sector Lighting Palette:
  // - Recepção / Oficina / Corredor: warm sodium tungsten
  // - Sala de Segurança Cabine 09-A: pale phosphor teal CRT glow
  // - Enfermaria (Azul): icy clinical sterile blue
  // - Vestíbulo de Saída (Alçapão Nível -2): emergency crimson red
  // - Subsolo Caldeira: warm rusty boiler amber
  // - Subsolo Depósito Químico: toxic Composto 09 green
  // - Subsolo Câmara Ômega: bright phosphor green
  const ceilingLights = [
    { x: gridToWorld(17.5), y: GROUND_CEILING_H - 0.25, z: gridToWorld(31.5), floor: 0 as FloorId, flickerSeed: 1.1, color: 0xffd299 },
    { x: gridToWorld(11.0), y: GROUND_CEILING_H - 0.25, z: gridToWorld(31.5), floor: 0 as FloorId, flickerSeed: 1.7, color: 0x99f6e4, isSecurityOffice: true },
    { x: gridToWorld(17.5), y: GROUND_CEILING_H - 0.25, z: gridToWorld(15.5), floor: 0 as FloorId, flickerSeed: 2.3, color: 0xffc88a },
    { x: gridToWorld(5.5), y: GROUND_CEILING_H - 0.25, z: gridToWorld(21.0), floor: 0 as FloorId, flickerSeed: 3.7, color: 0xffe4b8 },
    { x: gridToWorld(29.0), y: GROUND_CEILING_H - 0.25, z: gridToWorld(21.0), floor: 0 as FloorId, flickerSeed: 4.5, color: 0xffb86b },
    { x: gridToWorld(17.5), y: GROUND_CEILING_H - 0.25, z: gridToWorld(11.0), floor: 0 as FloorId, flickerSeed: 5.9, color: 0xffba73 },
    { x: gridToWorld(12.0), y: GROUND_CEILING_H - 0.25, z: gridToWorld(16.5), floor: 0 as FloorId, flickerSeed: 6.4, color: 0xfca5a5 }, // Arquivo Morto warm crimson-amber
    { x: gridToWorld(23.0), y: GROUND_CEILING_H - 0.25, z: gridToWorld(16.5), floor: 0 as FloorId, flickerSeed: 7.2, color: 0x7dd3fc }, // Enfermaria icy clinical blue!
    { x: gridToWorld(17.5), y: GROUND_CEILING_H - 0.25, z: gridToWorld(4.0), floor: 0 as FloorId, flickerSeed: 7.4, color: 0xef4444 }, // Vestíbulo / Alçapão Nível -2 emergency red!
    // Crisp Stairwell lights so every step down to the Underground is clearly illuminated!
    { x: gridToWorld(5.5), y: GROUND_CEILING_H - 0.4, z: gridToWorld(6.0), floor: 0 as FloorId, flickerSeed: 7.5, color: 0xfde68a },
    { x: gridToWorld(29.5), y: GROUND_CEILING_H - 0.4, z: gridToWorld(6.0), floor: 0 as FloorId, flickerSeed: 7.8, color: 0xfde68a },
    { x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(12.5), floor: -1 as FloorId, flickerSeed: 8.1, color: 0x5eead4 },
    { x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(6.5), floor: -1 as FloorId, flickerSeed: 9.3, color: 0x34d399 },
    { x: gridToWorld(12.0), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(21.0), floor: -1 as FloorId, flickerSeed: 10.6, color: 0xfb923c }, // Caldeira warm rust amber!
    { x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(20.5), floor: -1 as FloorId, flickerSeed: 11.0, color: 0x22c55e }, // Depósito Químico toxic Composto 09 green!
    { x: gridToWorld(23.5), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(21.0), floor: -1 as FloorId, flickerSeed: 11.4, color: 0x67e8f9 }, // Celas sterile cyan-cold
    { x: gridToWorld(25.5), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(6.0), floor: -1 as FloorId, flickerSeed: 12.2, color: 0x4ade80 }, // Câmara Ômega phosphor green!
    { x: gridToWorld(8.5), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(5.5), floor: -1 as FloorId, flickerSeed: 12.6, color: 0x5eead4 },
    { x: gridToWorld(28.0), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.2, z: gridToWorld(5.5), floor: -1 as FloorId, flickerSeed: 12.9, color: 0x5eead4 },
  ];

  const courtyardPillars = [
    { x: gridToWorld(14), z: gridToWorld(27), height: GROUND_CEILING_H, hasLantern: true },
    { x: gridToWorld(21), z: gridToWorld(27), height: GROUND_CEILING_H, hasLantern: true },
    { x: gridToWorld(14), z: gridToWorld(23), height: GROUND_CEILING_H, hasLantern: true },
    { x: gridToWorld(21), z: gridToWorld(23), height: GROUND_CEILING_H, hasLantern: true },
  ];

  const workbenches = buildWorkbenches();
  const rechargeStations = buildRechargeStations();
  const tutorialPlaques = buildTutorialPlaques();

  // Physical Wall Door Buttons mounted FLUSH inside the SecurityBunker (Cabine 09-A) right beside BOTH Blast Doors!
  const bunkerButtons = [
    {
      id: 'btn_bunker_left',
      side: 'left' as const,
      doorId: 'door_bunker_left',
      floor: 0 as FloorId,
      x: gridToWorld(8.57), // inner west wall face is 8.5 -> 0.11m proud inside the room!
      y: FLOOR_0_Y + 1.32,
      z: gridToWorld(30.35), // right beside Left Blast Door north jamb!
      facingYaw: Math.PI / 2,
    },
    {
      id: 'btn_bunker_right',
      side: 'right' as const,
      doorId: 'door_bunker_right',
      floor: 0 as FloorId,
      x: gridToWorld(13.43), // inner east wall face is 13.5 -> 0.11m proud inside the room!
      y: FLOOR_0_Y + 1.32,
      z: gridToWorld(30.35), // right beside Right Blast Door north jamb!
      facingYaw: -Math.PI / 2,
    },
  ];

  // Functional Industrial Wall Light Switches mounted strictly flush on solid walls (0.02m offset,
  // height floorY + 1.25m, 0.45m beside doorway jambs) with THREE.Box3 collision avoidance against all props!
  const lightSwitches = placeWallLightSwitches({
    floor0,
    floorMinus1,
    rooms: ROOMS,
    doors,
    furniture,
    hidingSpots,
    workbenches,
    rechargeStations,
    tutorialPlaques,
    uvMarks,
    clues,
    safe,
    bunkerButtons,
  });

  // Abandoned Complex Atmosphere: Reflective Organic Puddles (with ceiling water drops in Subsolo), Corner Cobwebs, Courtyard Grass/Leaves & Pipe Steam Vents
  const puddles = [
    { id: 'pud_cy_1', floor: 0 as FloorId, x: gridToWorld(17.2), y: FLOOR_0_Y + 0.014, z: gridToWorld(25.2), radius: 1.45, hasDrip: false },
    { id: 'pud_cy_2', floor: 0 as FloorId, x: gridToWorld(12.3), y: FLOOR_0_Y + 0.014, z: gridToWorld(22.4), radius: 1.05, hasDrip: false },
    { id: 'pud_cy_3', floor: 0 as FloorId, x: gridToWorld(22.4), y: FLOOR_0_Y + 0.014, z: gridToWorld(26.6), radius: 1.12, hasDrip: false },
    { id: 'pud_sub_1', floor: -1 as FloorId, x: gridToWorld(12.5), y: FLOOR_MINUS_1_Y + 0.014, z: gridToWorld(12.5), radius: 1.35, hasDrip: true },
    { id: 'pud_sub_2', floor: -1 as FloorId, x: gridToWorld(22.5), y: FLOOR_MINUS_1_Y + 0.014, z: gridToWorld(12.4), radius: 1.25, hasDrip: true },
    { id: 'pud_sub_3', floor: -1 as FloorId, x: gridToWorld(11.5), y: FLOOR_MINUS_1_Y + 0.014, z: gridToWorld(21.5), radius: 1.3, hasDrip: true },
    { id: 'pud_sub_4', floor: -1 as FloorId, x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y + 0.014, z: gridToWorld(29.0), radius: 1.2, hasDrip: true },
    { id: 'pud_sub_5', floor: -1 as FloorId, x: gridToWorld(17.5), y: FLOOR_MINUS_1_Y + 0.014, z: gridToWorld(17.2), radius: 1.15, hasDrip: true },
  ];

  const cobwebs = [
    { id: 'web_hall_1', floor: 0 as FloorId, x: gridToWorld(15.25), y: GROUND_CEILING_H - 0.55, z: gridToWorld(30.25), rotY: Math.PI / 4, scale: 1.05 },
    { id: 'web_hall_2', floor: 0 as FloorId, x: gridToWorld(20.15), y: GROUND_CEILING_H - 0.55, z: gridToWorld(33.15), rotY: -Math.PI * 0.75, scale: 0.95 },
    { id: 'web_bunker', floor: 0 as FloorId, x: gridToWorld(9.25), y: GROUND_CEILING_H - 0.55, z: gridToWorld(30.25), rotY: Math.PI / 4, scale: 0.9 },
    { id: 'web_west', floor: 0 as FloorId, x: gridToWorld(4.25), y: GROUND_CEILING_H - 0.55, z: gridToWorld(13.3), rotY: Math.PI / 4, scale: 1.1 },
    { id: 'web_east', floor: 0 as FloorId, x: gridToWorld(30.9), y: GROUND_CEILING_H - 0.55, z: gridToWorld(13.3), rotY: -Math.PI / 4, scale: 1.1 },
    { id: 'web_office', floor: 0 as FloorId, x: gridToWorld(10.3), y: GROUND_CEILING_H - 0.55, z: gridToWorld(19.1), rotY: Math.PI * 0.75, scale: 1.0 },
    { id: 'web_lib', floor: 0 as FloorId, x: gridToWorld(25.0), y: GROUND_CEILING_H - 0.55, z: gridToWorld(19.1), rotY: -Math.PI * 0.75, scale: 1.0 },
    { id: 'web_sub_1', floor: -1 as FloorId, x: gridToWorld(5.3), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.45, z: gridToWorld(11.3), rotY: Math.PI / 4, scale: 1.15 },
    { id: 'web_sub_2', floor: -1 as FloorId, x: gridToWorld(29.8), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.45, z: gridToWorld(29.8), rotY: -Math.PI * 0.75, scale: 1.1 },
    { id: 'web_sub_3', floor: -1 as FloorId, x: gridToWorld(13.4), y: FLOOR_MINUS_1_Y + BASEMENT_CEILING_H - 0.45, z: gridToWorld(3.3), rotY: Math.PI / 4, scale: 1.0 },
  ];

  const grassTufts = [
    { id: 'gt_1', x: gridToWorld(10.6), z: gridToWorld(28.3), scale: 0.72, rotY: 0.4, isDryLeaves: true },
    { id: 'gt_2', x: gridToWorld(14.5), z: gridToWorld(27.5), scale: 0.62, rotY: 1.1 },
    { id: 'gt_3', x: gridToWorld(20.5), z: gridToWorld(27.4), scale: 0.66, rotY: 2.3 },
    { id: 'gt_4', x: gridToWorld(24.4), z: gridToWorld(28.4), scale: 0.78, rotY: 0.9, isDryLeaves: true },
    { id: 'gt_5', x: gridToWorld(13.5), z: gridToWorld(22.6), scale: 0.58, rotY: 1.7 },
    { id: 'gt_6', x: gridToWorld(21.6), z: gridToWorld(22.5), scale: 0.64, rotY: 2.9 },
    { id: 'gt_7', x: gridToWorld(10.7), z: gridToWorld(21.6), scale: 0.7, rotY: 0.2, isDryLeaves: true },
    { id: 'gt_8', x: gridToWorld(24.5), z: gridToWorld(21.7), scale: 0.68, rotY: 1.9, isDryLeaves: true },
    { id: 'gt_9', x: gridToWorld(16.2), z: gridToWorld(22.1), scale: 0.52, rotY: 0.7 },
    { id: 'gt_10', x: gridToWorld(19.2), z: gridToWorld(26.7), scale: 0.54, rotY: 2.5 },
  ];

  const steamVents = [
    { id: 'sv_boiler', x: gridToWorld(9.4), y: FLOOR_MINUS_1_Y + 1.45, z: gridToWorld(16.75) },
    { id: 'sv_east_pipe', x: gridToWorld(29.35), y: FLOOR_MINUS_1_Y + 1.45, z: gridToWorld(19.0) },
    { id: 'sv_gen_pipe', x: gridToWorld(15.6), y: FLOOR_MINUS_1_Y + 1.35, z: gridToWorld(17.4) },
  ];

  return {
    seed,
    presetIndex,
    floor0,
    floorMinus1,
    surface0,
    surfaceMinus1,
    rooms: ROOMS,
    doors,
    vents: VENT_DUCTS,
    stairways: STAIRWAYS,
    hidingSpots,
    items,
    clues,
    uvMarks,
    symbolMap,
    secretTerminalCode,
    cameraSecretCode,
    safe,
    noiseProps,
    workbenches,
    rechargeStations,
    cassettes: buildCassettes(),
    bunkerCameras: buildBunkerCameras(cameraSecretCode),
    tutorialPlaques,
    furniture,
    furnitureColliders: buildFurnitureColliders(furniture),
    bunkerButtons,
    cctvMonitorPos: { x: gridToWorld(11), y: FLOOR_0_Y + 1.15, z: gridToWorld(30.55), floor: 0 },
    spawnPoint,
    diddySpawnPoint,
    patrolWaypoints,
    ceilingLights,
    courtyardPillars,
    lightSwitches,
    puddles,
    cobwebs,
    grassTufts,
    steamVents,
  };
}

/**
 * Computes an accurate world-space THREE.Box3 bounding volume (with slight clearance pad)
 * for any furniture prop so wall-mounted switches never overlap or clip into furniture.
 */
export function computeFurnitureBox3(f: FurniturePropDefinition, pad = 0.06): Box3 {
  let hx = 0.45;
  let hz = 0.45;
  let yMin = f.y;
  let yMax = f.y + 1.1;

  switch (f.kind) {
    case 'drawer_cabinet':
      hx = 0.52; hz = 0.38; yMax = f.y + 1.12; break;
    case 'bookshelf':
      hx = 0.72; hz = 0.34; yMax = f.y + 2.25; break;
    case 'desk_monitor':
    case 'radio_desk':
    case 'broken_glass_counter':
      hx = 0.85; hz = 0.48; yMax = f.y + 1.45; break;
    case 'dining_table':
      hx = 0.95; hz = 0.55; yMax = f.y + 0.95; break;
    case 'bed_medical':
      hx = 0.58; hz = 1.05; yMax = f.y + 1.05; break;
    case 'potted_plant':
      hx = 0.34; hz = 0.34; yMax = f.y + 1.45; break;
    case 'standing_lamp':
      hx = 0.32; hz = 0.32; yMax = f.y + 1.95; break;
    case 'crate':
    case 'barrel':
    case 'chemical_barrel_ooze':
      hx = 0.46; hz = 0.46; yMax = f.y + 1.05; break;
    case 'pipe_cluster':
      hx = 0.48; hz = 0.48; yMax = f.y + 2.6; break;
    case 'generator_lever':
    case 'secret_terminal':
      hx = 0.65; hz = 0.45; yMax = f.y + 1.85; break;
    case 'specimen_cylinder':
      hx = 0.48; hz = 0.48; yMax = f.y + 2.35; break;
    case 'bench_broken':
      hx = 0.85; hz = 0.42; yMax = f.y + 0.9; break;
    case 'wing_sign':
      hx = 0.45; hz = 0.35; yMax = f.y + 1.75; break;
    case 'iv_stand':
      hx = 0.34; hz = 0.34; yMax = f.y + 1.95; break;
    case 'filing_toppled':
      hx = 0.62; hz = 0.52; yMax = f.y + 0.85; break;
    case 'swivel_chair':
      hx = 0.38; hz = 0.38; yMax = f.y + 1.05; break;
    case 'cell_bent_bars':
      hx = 0.55; hz = 0.32; yMax = f.y + 2.4; break;
    case 'wall_frame':
    case 'interdiction_board':
    case 'workbench_schematic':
    case 'translation_board':
    case 'cell_sign_09':
      hx = 0.58; hz = 0.22; yMin = f.y - 0.48; yMax = f.y + 0.48; break;
    case 'fuse_box_busted':
      hx = 0.34; hz = 0.24; yMin = f.y - 0.36; yMax = f.y + 0.36; break;
    case 'wall_cctv':
    case 'cable_conduit':
      hx = 0.45; hz = 0.24; yMin = f.y - 0.25; yMax = f.y + 0.25; break;
    case 'marcos_badge':
    case 'coffee_spill':
    case 'cafeteria_trays':
    case 'vent_grate_loose':
    case 'exit_pry_marks':
    case 'level2_hatch':
      hx = 0.42; hz = 0.42; yMax = f.y + 0.25; break;
    default:
      hx = 0.45; hz = 0.45; yMax = f.y + 1.2; break;
  }

  const c = Math.abs(Math.cos(f.facingYaw));
  const s = Math.abs(Math.sin(f.facingYaw));
  const rx = hx * c + hz * s + pad;
  const rz = hx * s + hz * c + pad;
  return new Box3(new Vector3(f.x - rx, yMin - pad, f.z - rz), new Vector3(f.x + rx, yMax + pad, f.z + rz));
}

/**
 * Computes the world-space THREE.Box3 for a mounted wall light switch (casing + lever + vertical conduit).
 */
export function computeLightSwitchBox3(sw: LightSwitchDefinition): Box3 {
  const c = Math.abs(Math.cos(sw.facingYaw));
  const s = Math.abs(Math.sin(sw.facingYaw));
  // Local width 0.26m (X), depth 0.14m (Z from 0..+0.14), height from -0.22 to +1.10 (includes conduit)
  const hx = 0.14 * c + 0.12 * s;
  const hz = 0.14 * s + 0.12 * c;
  const nx = Math.sin(sw.facingYaw);
  const nz = Math.cos(sw.facingYaw);
  const cx = sw.x + nx * 0.05;
  const cz = sw.z + nz * 0.05;
  return new Box3(
    new Vector3(cx - hx, sw.y - 0.22, cz - hz),
    new Vector3(cx + hx, sw.y + 1.1, cz + hz)
  );
}

interface ObstacleSourceSet {
  floor0: Uint8Array;
  floorMinus1: Uint8Array;
  rooms: RoomDefinition[];
  doors: DoorDefinition[];
  furniture: FurniturePropDefinition[];
  hidingSpots: HidingSpotDefinition[];
  workbenches: WorkbenchDefinition[];
  rechargeStations: RechargeStationDefinition[];
  tutorialPlaques: TutorialPlaqueDefinition[];
  uvMarks: UvMarkDefinition[];
  clues: ArgCluePlacement[];
  safe: SafeDefinition;
  bunkerButtons: { x: number; y: number; z: number; floor: FloorId }[];
}

export function collectFloorObstacleBoxes(src: Omit<ObstacleSourceSet, 'floor0' | 'floorMinus1' | 'rooms' | 'doors'>, floor: FloorId): Box3[] {
  const boxes: Box3[] = [];
  for (const f of src.furniture) {
    if (f.floor === floor) boxes.push(computeFurnitureBox3(f, 0.06));
  }
  for (const h of src.hidingSpots) {
    if (h.floor === floor) {
      boxes.push(
        new Box3(new Vector3(h.x - 0.62, h.y, h.z - 0.62), new Vector3(h.x + 0.62, h.y + 2.2, h.z + 0.62))
      );
    }
  }
  for (const wb of src.workbenches) {
    if (wb.floor === floor) {
      boxes.push(
        new Box3(new Vector3(wb.x - 0.9, wb.y, wb.z - 0.65), new Vector3(wb.x + 0.9, wb.y + 1.35, wb.z + 0.65))
      );
    }
  }
  for (const rs of src.rechargeStations) {
    if (rs.floor === floor) {
      boxes.push(
        new Box3(new Vector3(rs.x - 0.5, rs.y, rs.z - 0.5), new Vector3(rs.x + 0.5, rs.y + 2.0, rs.z + 0.5))
      );
    }
  }
  for (const tp of src.tutorialPlaques) {
    if (tp.floor === floor) {
      boxes.push(
        new Box3(new Vector3(tp.x - 0.65, tp.y - 0.55, tp.z - 0.65), new Vector3(tp.x + 0.65, tp.y + 0.55, tp.z + 0.65))
      );
    }
  }
  for (const u of src.uvMarks) {
    if (u.floor === floor) {
      boxes.push(
        new Box3(new Vector3(u.x - 0.52, u.y - 0.52, u.z - 0.52), new Vector3(u.x + 0.52, u.y + 0.52, u.z + 0.52))
      );
    }
  }
  for (const cl of src.clues) {
    if (cl.floor === floor) {
      boxes.push(
        new Box3(new Vector3(cl.x - 0.35, cl.y - 0.35, cl.z - 0.35), new Vector3(cl.x + 0.35, cl.y + 0.35, cl.z + 0.35))
      );
    }
  }
  if (src.safe.floor === floor) {
    boxes.push(
      new Box3(
        new Vector3(src.safe.x - 0.55, src.safe.y, src.safe.z - 0.55),
        new Vector3(src.safe.x + 0.55, src.safe.y + 1.3, src.safe.z + 0.55)
      )
    );
  }
  for (const btn of src.bunkerButtons) {
    if (btn.floor === floor) {
      boxes.push(
        new Box3(new Vector3(btn.x - 0.32, btn.y - 0.4, btn.z - 0.32), new Vector3(btn.x + 0.32, btn.y + 0.4, btn.z + 0.32))
      );
    }
  }
  return boxes;
}

function placeWallLightSwitches(src: ObstacleSourceSet): LightSwitchDefinition[] {
  const specs: { id: string; roomId: string; roomName: string; floor: FloorId }[] = [
    { id: 'sw_reception', roomId: 'hall', roomName: 'Recepção · Setor 09', floor: 0 },
    { id: 'sw_cafeteria', roomId: 'west_wing', roomName: 'Refeitório · Ala Oeste', floor: 0 },
    { id: 'sw_workshop', roomId: 'east_wing', roomName: 'Oficina · Ala Leste', floor: 0 },
    { id: 'sw_archive', roomId: 'office', roomName: 'Arquivo Morto · Ala Vermelha', floor: 0 },
    { id: 'sw_infirmary', roomId: 'library', roomName: 'Enfermaria · Ala Azul', floor: 0 },
    { id: 'sw_generator', roomId: 'generator', roomName: 'Subsolo · Sala dos Geradores', floor: -1 },
  ];

  const obstaclesByFloor: Record<FloorId, Box3[]> = {
    0: collectFloorObstacleBoxes(src, 0),
    [-1]: collectFloorObstacleBoxes(src, -1),
  };

  const placed: LightSwitchDefinition[] = [];

  for (const spec of specs) {
    const rm = src.rooms.find((r) => r.id === spec.roomId && r.floor === spec.floor);
    if (!rm) continue;
    const grid = spec.floor === 0 ? src.floor0 : src.floorMinus1;
    const floorY = spec.floor === 0 ? FLOOR_0_Y : FLOOR_MINUS_1_Y;
    const swY = floorY + WALL_SWITCH_HEIGHT;
    const floorObstacles = obstaclesByFloor[spec.floor];

    // Collect explicit doors touching this room perimeter so doorway jambs get top priority
    const roomDoors = src.doors.filter((d) => {
      if (d.floor !== spec.floor) return false;
      return d.gx >= rm.x0 - 2 && d.gx <= rm.x1 + 2 && d.gz >= rm.z0 - 2 && d.gz <= rm.z1 + 2;
    });

    interface MountCandidate {
      x: number;
      z: number;
      facingYaw: number;
      priority: number;
      distScore: number;
    }
    const candidates: MountCandidate[] = [];

    const isDoorCellAt = (gx: number, gz: number): boolean => {
      for (const d of roomDoors) {
        const span = d.spanCells || 2;
        if (d.axis === 'x' && gz === d.gz && gx >= d.gx && gx < d.gx + span) return true;
        if (d.axis === 'z' && gx === d.gx && gz >= d.gz && gz < d.gz + span) return true;
      }
      return false;
    };

    const inspectWallEdge = (
      wallGx: number,
      wallGz: number,
      floorGx: number,
      floorGz: number,
      nx: number,
      nz: number,
      tx: number,
      tz: number
    ) => {
      if (!inBounds(wallGx, wallGz) || !inBounds(floorGx, floorGz)) return;
      if (grid[cellIdx(wallGx, wallGz)] !== CELL_WALL) return;
      if (grid[cellIdx(floorGx, floorGz)] !== CELL_FLOOR) return;

      const facingYaw =
        nx > 0 ? Math.PI / 2 : nx < 0 ? -Math.PI / 2 : nz > 0 ? 0 : Math.PI;
      // Exact wall face coordinate in world space
      const faceX = nx > 0 ? (wallGx + 1) * CELL_SIZE : nx < 0 ? wallGx * CELL_SIZE : gridToWorld(wallGx);
      const faceZ = nz > 0 ? (wallGz + 1) * CELL_SIZE : nz < 0 ? wallGz * CELL_SIZE : gridToWorld(wallGz);
      const baseX = faceX + nx * WALL_SWITCH_WALL_OFFSET;
      const baseZ = faceZ + nz * WALL_SWITCH_WALL_OFFSET;

      // Check both tangent neighbors along the wall for doorway openings!
      let addedJamb = false;
      for (const dirSign of [-1, 1]) {
        const nGx = wallGx + tx * dirSign;
        const nGz = wallGz + tz * dirSign;
        if (!inBounds(nGx, nGz)) continue;
        const nCell = grid[cellIdx(nGx, nGz)];
        const neighborIsOpening = nCell === CELL_FLOOR || nCell === CELL_COURTYARD || nCell === CELL_STAIR;
        if (neighborIsOpening) {
          // Doorway edge is between (wallGx, wallGz) and (nGx, nGz).
          // Place switch strictly WALL_SWITCH_JAMB_OFFSET (0.45m) inside the solid wall cell away from the doorway edge!
          const offsetFromCellCenter = (CELL_SIZE * 0.5 - WALL_SWITCH_JAMB_OFFSET) * dirSign;
          const cx = baseX + tx * offsetFromCellCenter;
          const cz = baseZ + tz * offsetFromCellCenter;
          const isExplicitDoor = isDoorCellAt(nGx, nGz);
          candidates.push({
            x: cx,
            z: cz,
            facingYaw,
            priority: isExplicitDoor ? 0 : 1,
            distScore: 0,
          });
          addedJamb = true;
        }
      }

      if (!addedJamb) {
        let minDoorDist = 99;
        for (const d of roomDoors) {
          const dist = Math.hypot(gridToWorld(d.gx) - baseX, gridToWorld(d.gz) - baseZ);
          if (dist < minDoorDist) minDoorDist = dist;
        }
        candidates.push({
          x: baseX,
          z: baseZ,
          facingYaw,
          priority: 2,
          distScore: minDoorDist,
        });
      }
    };

    // Scan all 4 interior perimeter walls of the room
    for (let gz = rm.z0; gz <= rm.z1; gz++) {
      inspectWallEdge(rm.x0 - 1, gz, rm.x0, gz, 1, 0, 0, 1); // West wall (faces +X)
      inspectWallEdge(rm.x1 + 1, gz, rm.x1, gz, -1, 0, 0, 1); // East wall (faces -X)
    }
    for (let gx = rm.x0; gx <= rm.x1; gx++) {
      inspectWallEdge(gx, rm.z0 - 1, gx, rm.z0, 0, 1, 1, 0); // North wall (faces +Z)
      inspectWallEdge(gx, rm.z1 + 1, gx, rm.z1, 0, -1, 1, 0); // South wall (faces -Z)
    }

    candidates.sort((a, b) => a.priority - b.priority || a.distScore - b.distScore);

    let chosen: MountCandidate | null = null;
    for (const cand of candidates) {
      const testSw: LightSwitchDefinition = {
        id: spec.id,
        roomId: spec.roomId,
        roomName: spec.roomName,
        floor: spec.floor,
        x: cand.x,
        y: swY,
        z: cand.z,
        facingYaw: cand.facingYaw,
        isOn: true,
      };
      const swBox = computeLightSwitchBox3(testSw);
      let overlaps = false;
      for (const obs of floorObstacles) {
        if (swBox.intersectsBox(obs)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        for (const prev of placed) {
          if (prev.floor === spec.floor && Math.hypot(prev.x - cand.x, prev.z - cand.z) < 0.65) {
            overlaps = true;
            break;
          }
        }
      }
      if (!overlaps) {
        chosen = cand;
        break;
      }
    }

    if (chosen) {
      placed.push({
        id: spec.id,
        roomId: spec.roomId,
        roomName: spec.roomName,
        floor: spec.floor,
        x: chosen.x,
        y: swY,
        z: chosen.z,
        facingYaw: chosen.facingYaw,
        isOn: true,
      });
    }
  }

  return placed;
}

// ---- COLLISION, VENT DUCTS, DUAL-FLOOR STAIRS (ZERO TELEPORT UNDERNEATH!) & FOG OF WAR ----

/**
 * Height-aware staircase ramp evaluator:
 * - When `currentY` is omitted, returns the raw stair ramp elevation at (x, z).
 * - When `currentY` is provided, ONLY engages the ramp if the actor is within 1.25m vertically
 *   of the ramp surface (`Math.abs(currentY - stairY) <= 1.25`).
 * - Walking on Floor -1 (-4.0m) underneath the upper half of the staircase returns
 *   `{ onStair: false, underStair: true, y: FLOOR_MINUS_1_Y }` so the player NEVER teleports upward!
 */
export function getStairHeightAt(
  x: number,
  z: number,
  currentY?: number
): { onStair: boolean; underStair: boolean; y: number; stair: StairwayDefinition | null; rawStairY: number } {
  const gx = x / CELL_SIZE;
  const gz = z / CELL_SIZE;
  for (const st of STAIRWAYS) {
    if (gx >= st.gxMin - 0.05 && gx <= st.gxMax + 1.05 && gz >= st.gzBottom - 0.1 && gz <= st.gzTop + 1.1) {
      const t = Math.max(0, Math.min(1, (gz - (st.gzBottom + 0.5)) / (st.gzTop - st.gzBottom)));
      const stairY = FLOOR_MINUS_1_Y + t * (FLOOR_0_Y - FLOOR_MINUS_1_Y);

      if (currentY !== undefined && currentY < stairY - 1.25) {
        return {
          onStair: false,
          underStair: true,
          y: FLOOR_MINUS_1_Y,
          stair: st,
          rawStairY: stairY,
        };
      }

      return {
        onStair: true,
        underStair: false,
        y: stairY,
        stair: st,
        rawStairY: stairY,
      };
    }
  }
  return { onStair: false, underStair: false, y: FLOOR_0_Y, stair: null, rawStairY: FLOOR_0_Y };
}

export function getFloorFromY(y: number): FloorId {
  return y < -2.0 ? -1 : 0;
}

export function isPositionInVent(layout: MansionLayout, x: number, z: number, floor: FloorId): boolean {
  const gx = worldToGrid(x);
  const gz = worldToGrid(z);
  if (!inBounds(gx, gz)) return false;
  const grid = floor === 0 ? layout.floor0 : layout.floorMinus1;
  return grid[cellIdx(gx, gz)] === CELL_VENT;
}

export function getRoomAt(
  layout: MansionLayout,
  x: number,
  z: number,
  floor: FloorId
): RoomDefinition | null {
  const gx = worldToGrid(x);
  const gz = worldToGrid(z);
  const grid = floor === 0 ? layout.floor0 : layout.floorMinus1;
  if (inBounds(gx, gz) && grid[cellIdx(gx, gz)] === CELL_VENT) {
    return {
      id: 'vent_duct',
      name: floor === 0 ? 'Duto de Ventilação' : 'Duto do Subsolo',
      floor,
      x0: gx,
      z0: gz,
      x1: gx,
      z1: gz,
      surface: 'vent_metal',
      zoneId: 'start',
    };
  }
  for (const r of layout.rooms) {
    if (r.floor === floor && gx >= r.x0 && gx <= r.x1 && gz >= r.z0 && gz <= r.z1) {
      return r;
    }
  }
  return null;
}

export function getSurfaceAt(
  layout: MansionLayout,
  x: number,
  z: number,
  floor: FloorId
): SurfaceType {
  const gx = worldToGrid(x);
  const gz = worldToGrid(z);
  if (!inBounds(gx, gz)) return 'concrete';
  return floor === 0
    ? layout.surface0[cellIdx(gx, gz)]
    : layout.surfaceMinus1[cellIdx(gx, gz)];
}

export function isDoorBlockingCell(
  doors: DoorDefinition[],
  gx: number,
  gz: number,
  floor: FloorId,
  forEnemy = false
): DoorDefinition | null {
  for (const d of doors) {
    if (d.floor !== floor) continue;
    const span = d.spanCells || 2;
    const matches =
      d.axis === 'x'
        ? gz === d.gz && gx >= d.gx && gx < d.gx + span
        : gx === d.gx && gz >= d.gz && gz < d.gz + span;
    if (!matches) continue;

    // Powered SecurityBunker Hydraulic Doors block BOTH player and P. Diddy when closed!
    if (d.lockType === 'bunker_blast') {
      if (!d.isOpen && d.openProgress < 0.72) return d;
      return null;
    }

    if (!d.isUnlocked) return d;
    if (!d.isOpen && d.openProgress < 0.65 && !forEnemy) return d;
  }
  return null;
}

export function isCellSolidForActor(
  layout: MansionLayout,
  gx: number,
  gz: number,
  floor: FloorId,
  isEnemy = false,
  isCrouching = false
): { solid: boolean; hitDoor: boolean; blockedByVentStanding: boolean } {
  if (!inBounds(gx, gz)) return { solid: true, hitDoor: false, blockedByVentStanding: false };
  const grid = floor === 0 ? layout.floor0 : layout.floorMinus1;
  const val = grid[cellIdx(gx, gz)];
  if (val === CELL_VOID || val === CELL_WALL) {
    return { solid: true, hitDoor: false, blockedByVentStanding: false };
  }
  // Voxel Ventilation Ducts: P. Diddy can NEVER enter; Player can ONLY enter while crouching!
  if (val === CELL_VENT) {
    if (isEnemy) {
      return { solid: true, hitDoor: false, blockedByVentStanding: false };
    }
    if (!isCrouching) {
      return { solid: true, hitDoor: false, blockedByVentStanding: true };
    }
  }
  if (isDoorBlockingCell(layout.doors, gx, gz, floor, isEnemy) !== null) {
    return { solid: true, hitDoor: true, blockedByVentStanding: false };
  }
  return { solid: false, hitDoor: false, blockedByVentStanding: false };
}

const SOLID_FURNITURE_KINDS = new Set<FurniturePropDefinition['kind']>([
  'bookshelf',
  'desk_monitor',
  'radio_desk',
  'broken_glass_counter',
  'dining_table',
  'drawer_cabinet',
  'side_table',
  'bed_medical',
  'crate',
  'barrel',
  'chemical_barrel_ooze',
  'pipe_cluster',
  'generator_lever',
  'secret_terminal',
  'specimen_cylinder',
  'bench_broken',
  'filing_toppled',
  'potted_plant',
  'standing_lamp',
  'cell_bent_bars',
]);

/**
 * Generates solid AABB colliders (`CanCollide = true`) + Line-of-Sight occlusion heights
 * for every physical furniture/prop in the mansion.
 * Non-blocking wall decals and floor hatches are excluded automatically.
 */
export function buildFurnitureColliders(furniture: FurniturePropDefinition[]): FurnitureCollider[] {
  const out: FurnitureCollider[] = [];
  for (const f of furniture) {
    if (!SOLID_FURNITURE_KINDS.has(f.kind)) continue;
    const box = computeFurnitureBox3(f, -0.05);
    const height = Math.max(0.4, box.max.y - f.y);
    if (box.max.x <= box.min.x || box.max.z <= box.min.z) continue;
    out.push({
      id: f.id,
      kind: f.kind,
      floor: f.floor,
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
      height,
      blocksLos: height >= 0.8,
    });
  }
  return out;
}

/**
 * Exact 2D slab ray-vs-AABB intersection test (zero allocations, 60 FPS mobile safe).
 */
export function segmentIntersectsAabb2D(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-8) {
    if (x0 < minX || x0 > maxX) return false;
  } else {
    const invD = 1 / dx;
    let t1 = (minX - x0) * invD;
    let t2 = (maxX - x0) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  if (Math.abs(dz) < 1e-8) {
    if (z0 < minZ || z0 > maxZ) return false;
  } else {
    const invD = 1 / dz;
    let t1 = (minZ - z0) * invD;
    let t2 = (maxZ - z0) * invD;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  return tMax >= 0 && tMin <= 1;
}

/**
 * Returns true if any solid furniture collider on `floor` with height >= `targetEyeHeight`
 * obstructs the sightline segment (x0,z0) -> (x1,z1).
 */
export function isSightlineBlockedByFurniture(
  layout: MansionLayout,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  floor: FloorId,
  targetEyeHeight = 1.55
): boolean {
  const colliders = layout.furnitureColliders;
  if (!colliders || colliders.length === 0) return false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.floor !== floor || !c.blocksLos || c.height < targetEyeHeight) continue;
    // Ignore collider if either endpoint is literally inside it (e.g. interacting flush with a desk)
    const p0Inside = x0 >= c.minX && x0 <= c.maxX && z0 >= c.minZ && z0 <= c.maxZ;
    const p1Inside = x1 >= c.minX && x1 <= c.maxX && z1 >= c.minZ && z1 <= c.maxZ;
    if (p0Inside || p1Inside) continue;
    if (segmentIntersectsAabb2D(x0, z0, x1, z1, c.minX, c.maxX, c.minZ, c.maxZ)) {
      return true;
    }
  }
  return false;
}

/**
 * Pure grid-marching line-of-sight check for projectile/raycast systems (e.g., Stun Gun & AI).
 * Returns false if any wall, void, closed/locked door, or tall solid furniture lies between (x0, z0) and (x1, z1).
 */
export function hasWallLineOfSight(
  layout: MansionLayout,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  floor: FloorId,
  targetEyeHeight = 1.55
): boolean {
  const dist = Math.hypot(x1 - x0, z1 - z0);
  if (dist < 0.05) return true;
  const steps = Math.max(2, Math.ceil(dist / 0.25));
  const grid = floor === 0 ? layout.floor0 : layout.floorMinus1;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = x0 + (x1 - x0) * t;
    const sz = z0 + (z1 - z0) * t;
    const gx = worldToGrid(sx);
    const gz = worldToGrid(sz);
    if (!inBounds(gx, gz)) return false;
    const cell = grid[cellIdx(gx, gz)];
    if (cell === CELL_VOID || cell === CELL_WALL) return false;
    if (isDoorBlockingCell(layout.doors, gx, gz, floor, false) !== null) return false;
  }
  if (isSightlineBlockedByFurniture(layout, x0, z0, x1, z1, floor, targetEyeHeight)) {
    return false;
  }
  return true;
}

/**
 * Airtight 2D Circle-vs-Grid Wall-Sliding Collision with Height-Aware Dual-Floor Staircase
 * (ZERO upward teleport when walking under stairs!) & Vent Crouch Check!
 */
export function resolveWorldMovement(
  layout: MansionLayout,
  x: number,
  y: number,
  z: number,
  dx: number,
  dz: number,
  radius: number,
  isEnemy = false,
  isCrouching = false
): { x: number; y: number; z: number; floor: FloorId; hitWall: boolean; blockedByVentStanding: boolean } {
  const stairNow = getStairHeightAt(x, z, y);
  const floor: FloorId = stairNow.onStair ? (y < -2.0 ? -1 : 0) : getFloorFromY(y);
  const isWalkingUnderStair = !stairNow.onStair && floor === -1;

  const checkPos = (
    cx: number,
    cz: number,
    fl: FloorId
  ): { collides: boolean; hitDoor: boolean; blockedByVentStanding: boolean } => {
    // Prevent walking into the low-headroom concrete underside of the lower steps (z=4..6) when already underneath on Floor -1!
    if (isWalkingUnderStair) {
      const stAt = getStairHeightAt(cx, cz, y);
      if (stAt.underStair && stAt.rawStairY - FLOOR_MINUS_1_Y < 1.95) {
        return { collides: true, hitDoor: false, blockedByVentStanding: false };
      }
    }

    const minGx = worldToGrid(cx - radius);
    const maxGx = worldToGrid(cx + radius);
    const minGz = worldToGrid(cz - radius);
    const maxGz = worldToGrid(cz + radius);
    let hitDoor = false;
    let blockedByVentStanding = false;

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const res = isCellSolidForActor(layout, gx, gz, fl, isEnemy, isCrouching);
        if (!res.solid) continue;
        const boxMinX = gx * CELL_SIZE;
        const boxMaxX = boxMinX + CELL_SIZE;
        const boxMinZ = gz * CELL_SIZE;
        const boxMaxZ = boxMinZ + CELL_SIZE;
        const closestX = Math.max(boxMinX, Math.min(cx, boxMaxX));
        const closestZ = Math.max(boxMinZ, Math.min(cz, boxMaxZ));
        const distSq = (cx - closestX) * (cx - closestX) + (cz - closestZ) * (cz - closestZ);
        if (distSq < radius * radius) {
          if (res.hitDoor) hitDoor = true;
          if (res.blockedByVentStanding) blockedByVentStanding = true;
          return { collides: true, hitDoor, blockedByVentStanding };
        }
      }
    }

    // Solid Furniture Colliders (`CanCollide = true`): prevent Players AND P. Drizzy from walking through tables, cabinets, drawers, beds, counters!
    const colliders = layout.furnitureColliders;
    if (colliders && colliders.length > 0) {
      const rSq = radius * radius;
      for (let i = 0; i < colliders.length; i++) {
        const fc = colliders[i];
        if (fc.floor !== fl) continue;
        const closestX = Math.max(fc.minX, Math.min(cx, fc.maxX));
        const closestZ = Math.max(fc.minZ, Math.min(cz, fc.maxZ));
        const dxC = cx - closestX;
        const dzC = cz - closestZ;
        if (dxC * dxC + dzC * dzC < rSq) {
          // If actor started overlapping (e.g. stepping out of an adjacent hiding spot), allow escape movement that moves away from center
          const origClosestX = Math.max(fc.minX, Math.min(x, fc.maxX));
          const origClosestZ = Math.max(fc.minZ, Math.min(z, fc.maxZ));
          const origDistSq = (x - origClosestX) * (x - origClosestX) + (z - origClosestZ) * (z - origClosestZ);
          if (origDistSq < rSq) {
            const centerX = (fc.minX + fc.maxX) * 0.5;
            const centerZ = (fc.minZ + fc.maxZ) * 0.5;
            const curCenterDistSq = (cx - centerX) * (cx - centerX) + (cz - centerZ) * (cz - centerZ);
            const origCenterDistSq = (x - centerX) * (x - centerX) + (z - centerZ) * (z - centerZ);
            if (curCenterDistSq > origCenterDistSq) {
              continue;
            }
          }
          return { collides: true, hitDoor: false, blockedByVentStanding: false };
        }
      }
    }

    return { collides: false, hitDoor: false, blockedByVentStanding: false };
  };

  let nx = x;
  let nz = z;
  let hitWall = false;
  let blockedByVentStanding = false;

  const totalDist = Math.hypot(dx, dz);
  const subSteps = Math.max(1, Math.ceil(totalDist / 0.25));
  const stepDx = dx / subSteps;
  const stepDz = dz / subSteps;

  for (let s = 0; s < subSteps; s++) {
    const tryX = nx + stepDx;
    const resX = checkPos(tryX, nz, floor);
    if (!resX.collides) {
      nx = tryX;
    } else {
      hitWall = true;
      if (resX.blockedByVentStanding) blockedByVentStanding = true;
      if (!resX.hitDoor && !resX.blockedByVentStanding && Math.abs(stepDz) < 0.001) {
        if (!checkPos(tryX, nz + 0.12, floor).collides) nz += 0.05;
        else if (!checkPos(tryX, nz - 0.12, floor).collides) nz -= 0.05;
      }
    }

    const tryZ = nz + stepDz;
    const resZ = checkPos(nx, tryZ, floor);
    if (!resZ.collides) {
      nz = tryZ;
    } else {
      hitWall = true;
      if (resZ.blockedByVentStanding) blockedByVentStanding = true;
      if (!resZ.hitDoor && !resZ.blockedByVentStanding && Math.abs(stepDx) < 0.001) {
        if (!checkPos(nx + 0.12, tryZ, floor).collides) nx += 0.05;
        else if (!checkPos(nx - 0.12, tryZ, floor).collides) nx -= 0.05;
      }
    }
  }

  const stairAfter = getStairHeightAt(nx, nz, y);
  const ny = stairAfter.onStair
    ? stairAfter.y
    : stairAfter.underStair
    ? FLOOR_MINUS_1_Y
    : floor === 0
    ? FLOOR_0_Y
    : FLOOR_MINUS_1_Y;
  const nextFloor: FloorId = stairAfter.onStair ? (ny < -2.0 ? -1 : 0) : floor;

  return { x: nx, y: ny, z: nz, floor: nextFloor, hitWall, blockedByVentStanding };
}

/**
 * STRICT Fog of War Grid (ZERO SPOILERS):
 * Tracks ONLY cells physically visited/seen by the player on each floor.
 */
export class StrictFogOfWar {
  readonly floor0 = new Uint8Array(GRID_W * GRID_H);
  readonly floorMinus1 = new Uint8Array(GRID_W * GRID_H);

  reset(): void {
    this.floor0.fill(0);
    this.floorMinus1.fill(0);
  }

  revealAround(worldX: number, worldZ: number, floor: FloorId, radiusCells = 3.6): void {
    const cgx = worldToGrid(worldX);
    const cgz = worldToGrid(worldZ);
    const target = floor === 0 ? this.floor0 : this.floorMinus1;
    const rCeil = Math.ceil(radiusCells);
    const rSq = radiusCells * radiusCells;
    for (let dz = -rCeil; dz <= rCeil; dz++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dz * dz > rSq) continue;
        const gx = cgx + dx;
        const gz = cgz + dz;
        if (!inBounds(gx, gz)) continue;
        target[cellIdx(gx, gz)] = 1;
      }
    }
  }

  isExplored(gx: number, gz: number, floor: FloorId): boolean {
    if (!inBounds(gx, gz)) return false;
    return (floor === 0 ? this.floor0 : this.floorMinus1)[cellIdx(gx, gz)] === 1;
  }

  getExploredPercentage(layout: MansionLayout): number {
    let totalWalkable = 0;
    let exploredWalkable = 0;
    for (let i = 0; i < GRID_W * GRID_H; i++) {
      if (
        layout.floor0[i] === CELL_FLOOR ||
        layout.floor0[i] === CELL_STAIR ||
        layout.floor0[i] === CELL_COURTYARD ||
        layout.floor0[i] === CELL_VENT
      ) {
        totalWalkable++;
        if (this.floor0[i] === 1) exploredWalkable++;
      }
      if (
        layout.floorMinus1[i] === CELL_FLOOR ||
        layout.floorMinus1[i] === CELL_STAIR ||
        layout.floorMinus1[i] === CELL_VENT
      ) {
        totalWalkable++;
        if (this.floorMinus1[i] === 1) exploredWalkable++;
      }
    }
    return totalWalkable === 0 ? 0 : Math.min(100, Math.round((exploredWalkable / totalWalkable) * 100));
  }

  toBase64(floor: FloorId): string {
    const arr = floor === 0 ? this.floor0 : this.floorMinus1;
    const packed = new Uint8Array(Math.ceil(arr.length / 8));
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) packed[i >> 3] |= 1 << (i & 7);
    }
    let bin = '';
    for (let i = 0; i < packed.length; i++) bin += String.fromCharCode(packed[i]);
    if (typeof btoa === 'function') return btoa(bin);
    return Buffer.from(packed).toString('base64');
  }

  fromBase64(floor: FloorId, encoded: string): void {
    if (!encoded) return;
    const target = floor === 0 ? this.floor0 : this.floorMinus1;
    target.fill(0);
    try {
      let bytes: Uint8Array;
      if (typeof atob === 'function') {
        const bin = atob(encoded);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        bytes = new Uint8Array(Buffer.from(encoded, 'base64'));
      }
      for (let i = 0; i < target.length; i++) {
        if ((bytes[i >> 3] & (1 << (i & 7))) !== 0) target[i] = 1;
      }
    } catch {
      // Ignore malformed base64 safely
    }
  }
}
