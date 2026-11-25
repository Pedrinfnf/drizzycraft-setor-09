import * as THREE from 'three';
import { gridToWorld } from './mansionMap';
import type { CutsceneCameraKeyframe, CutsceneId, DialogueStep, EndingId } from './types';

export interface CutsceneAnchors {
  setId: 'courtyard_intro' | 'gate_road' | 'basement_tunnel' | 'helipad_roof' | 'containment_cell';
  floor: 0 | -1;
  groundY: number;
  /** Valid solid bounding box (xMin, xMax, zMin, zMax) guaranteeing zero cameras/actors in void */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  survivorStart: [number, number, number];
  survivorEnd: [number, number, number];
  survivorFacingYaw: number;
  diddyStart: [number, number, number];
  diddyEnd: [number, number, number];
  diddyFacingYaw: number;
  vehiclePos?: [number, number, number];
}

export interface CutsceneDefinition {
  id: CutsceneId;
  chapterTitle: string;
  subtitle: string;
  cameras: CutsceneCameraKeyframe[];
  steps: DialogueStep[];
  /** Show voxel survivor character actor in scene */
  showSurvivor: boolean;
  /** Show menacing P. Drizzy silhouette in background during specific steps */
  diddyBackdropSteps: number[];
  /** Dedicated enclosed 3D cutscene set & choreographed actor anchors (zero void!) */
  anchors: CutsceneAnchors;
}

export interface EndingMetadata {
  id: EndingId;
  title: string;
  subtitle: string;
  routeHint: string;
  badgeColor: string;
}

export const ENDING_METADATA: Record<EndingId, EndingMetadata> = {
  bad: {
    id: 'bad',
    title: 'Contenção do Setor 09',
    subtitle: 'Bad Ending · Capturado pelo Sujeito 09',
    routeHint: 'Seja capturado por P. Drizzy e arrastado às celas de contenção do subsolo.',
    badgeColor: '#ef4444',
  },
  good: {
    id: 'good',
    title: 'Fuga pelo Portão Norte',
    subtitle: 'Good Ending · Rota Principal Concluída',
    routeHint:
      'Restaure o gerador, decifre o cofre de 4 dígitos, pegue a Chave Mestra e escape pelo Portão Norte.',
    badgeColor: '#10b981',
  },
  real: {
    id: 'real',
    title: 'Resgate no Nível -2',
    subtitle: 'Real Ending · Escotilha Blindada Aberta',
    routeHint:
      'Use o Alicate de Corte e siga o sinal de rádio do Vigia Marcos até o Alçapão Vermelho do Nível -2.',
    badgeColor: '#06b6d4',
  },
  secret: {
    id: 'secret',
    title: 'Dossiê Ômega Exposto',
    subtitle: 'Secret Ending · Verdade Revelada',
    routeHint:
      'Mapeie todas as cifras UV, traduza no Quadro e desbloqueie o Terminal Ômega de 5 dígitos antes de fugir.',
    badgeColor: '#a855f7',
  },
};

/**
 * CHAPTER 1 INTRO CUTSCENE — "Setor 09 — O Turno Perdido"
 * Lore: O jogador pula o muro atrás do amigo desaparecido Vigia Marcos.
 * O portão perimetral tranca eletronicamente e o rádio chiado do Marcos alerta sobre o Sujeito 09: P. Drizzy.
 */
const INTRO_CX = gridToWorld(17.5);

export const INTRO_CUTSCENE: CutsceneDefinition = {
  id: 'intro',
  chapterTitle: 'CAPÍTULO 1 — SETOR 09',
  subtitle: 'O Turno Perdido • Complexo de Pesquisa Interditado',
  showSurvivor: true,
  diddyBackdropSteps: [3, 4],
  anchors: {
    setId: 'courtyard_intro',
    floor: 0,
    groundY: 0,
    bounds: { minX: gridToWorld(12), maxX: gridToWorld(23), minZ: gridToWorld(20), maxZ: gridToWorld(33) },
    survivorStart: [INTRO_CX, 0, gridToWorld(30.4)],
    survivorEnd: [INTRO_CX, 0, gridToWorld(26.2)],
    survivorFacingYaw: Math.PI,
    diddyStart: [INTRO_CX - 1.4, 0, gridToWorld(22.6)],
    diddyEnd: [INTRO_CX + 0.4, 0, gridToWorld(23.5)],
    diddyFacingYaw: 0,
  },
  cameras: [
    // 0: High wide cinematic establishing crane over the moonlit courtyard wall & Sector 09 facade
    { pos: [INTRO_CX + 2.8, 3.35, gridToWorld(31.2)], lookAt: [INTRO_CX, 1.75, gridToWorld(24.8)], fov: 64, shake: 0.004 },
    // 1: Vaulting down into the courtyard gravel beside the rain-slicked cobbles
    { pos: [INTRO_CX + 1.5, 1.88, gridToWorld(29.8)], lookAt: [INTRO_CX - 0.3, 1.35, gridToWorld(26.5)], fov: 66, shake: 0.014 },
    // 2: Rapid pan back as the heavy perimeter gate slams shut with an electronic deadbolt
    { pos: [INTRO_CX - 1.2, 1.65, gridToWorld(28.2)], lookAt: [INTRO_CX, 1.55, gridToWorld(31.8)], fov: 58, shake: 0.02 },
    // 3: Dramatic dolly toward the illuminated reception corridor where P. Drizzy's silhouette looms
    { pos: [INTRO_CX + 1.6, 1.72, gridToWorld(27.5)], lookAt: [INTRO_CX, 1.72, gridToWorld(23.2)], fov: 52, shake: 0.01 },
    // 4: Intimate eye-level transition into 1st-person perspective right at the reception threshold
    { pos: [INTRO_CX, 1.65, gridToWorld(28.0)], lookAt: [INTRO_CX, 1.58, gridToWorld(24.5)], fov: 72, shake: 0.005 },
  ],
  steps: [
    {
      id: 'intro_1',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'tense',
      text: 'Complexo Setor 09... Marcos sumiu no meio do plantão há 3 horas. O carro dele ainda está lá fora.',
      minDisplaySec: 1.6,
      autoAdvanceSec: 5.0,
      cameraIndex: 0,
      soundCue: 'fence_vault',
    },
    {
      id: 'intro_2',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'alert',
      text: 'Droga... o portão perimetral travou por fora assim que eu pulei o muro! Só dá pra sair pelo Portão Blindado Norte.',
      minDisplaySec: 1.6,
      autoAdvanceSec: 5.0,
      cameraIndex: 2,
      soundCue: 'gate_slam',
    },
    {
      id: 'intro_3',
      speaker: 'radio',
      speakerName: 'RÁDIO DO VIGIA MARCOS',
      emotion: 'static',
      text: '...[chiado]... ei! Se alguém pegou minha frequência... NÃO FICA NO PÁTIO! O Composto 09 vazou e o P. Drizzy saiu da Cela 09!',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.5,
      cameraIndex: 1,
      soundCue: 'radio_static',
    },
    {
      id: 'intro_4',
      speaker: 'diddy',
      speakerName: 'P. DRIZZY (SUJEITO 09)',
      emotion: 'menacing',
      text: '...Passos no pátio. Novo visitante no Setor 09. O turno nunca acaba aqui dentro...',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.2,
      cameraIndex: 3,
      soundCue: 'drizzy_growl',
    },
    {
      id: 'intro_5',
      speaker: 'radio',
      speakerName: 'RÁDIO DO VIGIA MARCOS',
      emotion: 'alert',
      text: '...Escuta: a Guarita tem câmeras e portas blindadas. Decifre o cofre com a Luz UV, restaure a energia e fuja pelo Portão Norte!',
      minDisplaySec: 1.6,
      autoAdvanceSec: 5.2,
      cameraIndex: 4,
      soundCue: 'radio_static',
    },
  ],
};

/**
 * BAD ENDING — "Contenção do Setor 09"
 * Dedicated enclosed 3D Containment Cell 09 set (x=120, y=-4, z=62) — zero void!
 */
export const ENDING_BAD_CUTSCENE: CutsceneDefinition = {
  id: 'ending_bad',
  chapterTitle: 'FINAL RUIM — CONTENÇÃO DO SETOR 09',
  subtitle: 'Celas Subterrâneas • Protocolo de Isolamento Ativado',
  showSurvivor: true,
  diddyBackdropSteps: [0, 1, 2],
  anchors: {
    setId: 'containment_cell',
    floor: -1,
    groundY: -4.0,
    bounds: { minX: 112, maxX: 128, minZ: 54, maxZ: 70 },
    survivorStart: [120, -4.0, 65.2],
    survivorEnd: [120, -4.0, 60.4],
    survivorFacingYaw: 0,
    diddyStart: [120.2, -4.0, 66.8],
    diddyEnd: [120.0, -4.0, 63.1],
    diddyFacingYaw: Math.PI,
  },
  cameras: [
    // 0: Low erratic floor-level POV inside illuminated Containment Corridor looking up at P. Drizzy
    { pos: [121.6, -2.85, 65.8], lookAt: [120.0, -2.35, 62.0], fov: 68, shake: 0.032 },
    // 1: Tight close-up at the armored cell threshold as P. Drizzy looms above the survivor
    { pos: [118.8, -2.55, 63.6], lookAt: [120.0, -2.05, 62.6], fov: 50, shake: 0.024 },
    // 2: Heavy blast cell bars slamming shut right in front of the survivor
    { pos: [120.0, -2.35, 60.8], lookAt: [120.0, -2.25, 63.0], fov: 48, shake: 0.038 },
    // 3: Slow claustrophobic pull-out inside furnished Cell 09 under flickering cage light
    { pos: [120.4, -2.15, 58.2], lookAt: [120.0, -2.3, 62.6], fov: 58, shake: 0.01 },
  ],
  steps: [
    {
      id: 'bad_1',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'tense',
      text: 'Me solta...! O corredor do subsolo... não, para as celas não! A luz está apagando...',
      minDisplaySec: 1.6,
      autoAdvanceSec: 4.8,
      cameraIndex: 0,
      soundCue: 'drizzy_growl',
    },
    {
      id: 'bad_2',
      speaker: 'diddy',
      speakerName: 'P. DRIZZY (SUJEITO 09)',
      emotion: 'menacing',
      text: 'Ninguém sai do Setor 09 sem cumprir o turno. A Cela 09 estava vazia esperando um novo hóspede...',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.2,
      cameraIndex: 1,
      soundCue: 'drizzy_growl',
    },
    {
      id: 'bad_3',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'alert',
      text: 'NÃO! A porta blindada travou por fora! Marcos... alguém na frequência?!',
      minDisplaySec: 1.6,
      autoAdvanceSec: 4.6,
      cameraIndex: 2,
      soundCue: 'gate_slam',
    },
    {
      id: 'bad_4',
      speaker: 'radio',
      speakerName: 'RÁDIO DO VIGIA MARCOS',
      emotion: 'static',
      text: '...[chiado distante]... sinal perdido no setor das celas... aguenta firme... eu não consigo abrir daqui...',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.2,
      cameraIndex: 3,
      soundCue: 'radio_static',
    },
  ],
};

/**
 * GOOD ENDING — "Fuga pelo Portão Norte / Estrada"
 * Dedicated enclosed 3D exterior road set (x=120, y=0, z=-18): asphalt road, street lamps,
 * perimeter fence, trees, getaway patrol car & slamming iron North Gate — ZERO void!
 */
export const ENDING_GOOD_CUTSCENE: CutsceneDefinition = {
  id: 'ending_good',
  chapterTitle: 'FUGA PELO PORTÃO NORTE',
  subtitle: 'Good Ending • Estrada Exterior & Viatura de Fuga',
  showSurvivor: true,
  diddyBackdropSteps: [1, 2],
  anchors: {
    setId: 'gate_road',
    floor: 0,
    groundY: 0,
    bounds: { minX: 104, maxX: 136, minZ: -32, maxZ: -4 },
    survivorStart: [120, 0, -10.5],
    survivorEnd: [120, 0, -21.5],
    survivorFacingYaw: Math.PI,
    diddyStart: [120, 0, -6.2],
    diddyEnd: [120, 0, -9.2],
    diddyFacingYaw: Math.PI,
    vehiclePos: [123.6, 0, -23.0],
  },
  cameras: [
    // 0: Heroic low-angle push as survivor bursts through the iron North Gate onto the lit asphalt road
    { pos: [123.4, 1.65, -14.8], lookAt: [120.0, 1.45, -9.6], fov: 62, shake: 0.01 },
    // 1: Dramatic whip-pan toward the slamming iron gate as P. Drizzy charges and pounds furiously on the bars
    { pos: [117.2, 1.95, -13.6], lookAt: [120.0, 1.65, -9.4], fov: 50, shake: 0.022 },
    // 2: Wide exterior crane framing the street lamps, pine trees & survivor sprinting to the waiting getaway car
    { pos: [114.5, 2.7, -18.5], lookAt: [121.8, 1.2, -22.2], fov: 58, shake: 0.008 },
    // 3: Pull-back over the moonlit asphalt road as the getaway car headlights illuminate the escape
    { pos: [118.5, 3.1, -27.5], lookAt: [120.8, 1.4, -15.5], fov: 54, shake: 0.006 },
  ],
  steps: [
    {
      id: 'good_1',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'relieved',
      text: 'A trava eletrônica cedeu... consegui! O Portão Norte finalmente abriu para a floresta!',
      minDisplaySec: 1.5,
      autoAdvanceSec: 4.5,
      cameraIndex: 0,
      soundCue: 'door_open',
    },
    {
      id: 'good_2',
      speaker: 'diddy',
      speakerName: 'P. DRIZZY (SUJEITO 09)',
      emotion: 'menacing',
      text: 'VOCÊ ACHA QUE ESCAPOU PELAS GRADES?! O PROJETO ÔMEGA NÃO TERMINA NA SUPERFÍCIE!',
      minDisplaySec: 1.6,
      autoAdvanceSec: 4.8,
      cameraIndex: 1,
      soundCue: 'drizzy_growl',
    },
    {
      id: 'good_3',
      speaker: 'radio',
      speakerName: 'RÁDIO DO VIGIA MARCOS',
      emotion: 'static',
      text: '...[chiado forte]... EU TÔ VIVO! Consegui me trancar no Nível -2, nos Laboratórios Ômega! Mas a escotilha de emergência tá cedendo!',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.5,
      cameraIndex: 2,
      soundCue: 'radio_static',
    },
    {
      id: 'good_4',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'alert',
      text: 'Aguenta firme, Marcos! Eu saí vivo do Setor 09... mas ainda vou voltar para abrir aquela escotilha do Nível -2.',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.5,
      cameraIndex: 3,
      soundCue: 'hatch_hum',
    },
  ],
};

/**
 * REAL ENDING — "Resgate no Subsolo / Túnel de Fuga"
 * Dedicated enclosed 3D illuminated subterranean escape tunnel + exterior rescue stairs & rescue van
 * (x=120, y=-4..0, z=14) — ZERO void!
 */
export const ENDING_REAL_CUTSCENE: CutsceneDefinition = {
  id: 'ending_real',
  chapterTitle: 'FINAL REAL — TÚNEL DE FUGA & RESGATE',
  subtitle: 'Galeria Subterrânea • Saída de Emergência & Resgate do Marcos',
  showSurvivor: true,
  diddyBackdropSteps: [2],
  anchors: {
    setId: 'basement_tunnel',
    floor: -1,
    groundY: -4.0,
    bounds: { minX: 110, maxX: 130, minZ: 0, maxZ: 28 },
    survivorStart: [120, -4.0, 21.5],
    survivorEnd: [120, -4.0, 7.2],
    survivorFacingYaw: Math.PI,
    diddyStart: [120, -4.0, 25.5],
    diddyEnd: [120, -4.0, 19.5],
    diddyFacingYaw: Math.PI,
    vehiclePos: [120, -4.0, 3.8],
  },
  cameras: [
    // 0: Tactical tracking shot inside the illuminated concrete escape tunnel as survivor sprints ahead
    { pos: [122.4, -2.2, 18.2], lookAt: [120.0, -2.7, 21.2], fov: 58, shake: 0.014 },
    // 1: Dramatic low angle looking down the glowing emergency bulkhead lights toward the exit ramp
    { pos: [117.6, -2.1, 13.5], lookAt: [120.0, -2.5, 6.2], fov: 60, shake: 0.012 },
    // 2: Tense whip-pan back toward the sealed blast bulkhead as P. Drizzy roars behind the bars
    { pos: [118.4, -2.15, 14.8], lookAt: [120.0, -2.1, 20.5], fov: 48, shake: 0.024 },
    // 3: Wide heroic shot of the surface rescue bay & emergency van beacons welcoming the survivors
    { pos: [124.2, -1.6, 8.8], lookAt: [120.0, -2.6, 4.2], fov: 62, shake: 0.008 },
  ],
  steps: [
    {
      id: 'real_1',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'alert',
      text: 'O alicate rompeu a trava hidráulica! O Alçapão Vermelho do Nível -2 finalmente destravou!',
      minDisplaySec: 1.6,
      autoAdvanceSec: 4.8,
      cameraIndex: 0,
      soundCue: 'door_open',
    },
    {
      id: 'real_2',
      speaker: 'radio',
      speakerName: 'RÁDIO DO VIGIA MARCOS',
      emotion: 'relieved',
      text: '...[chiado clareando]... EU TÔ OUVINDO A ESCOTILHA ABRIR! Desce rápido pela escada de serviço — eu travei a sala de contenção lá embaixo!',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.4,
      cameraIndex: 1,
      soundCue: 'radio_static',
    },
    {
      id: 'real_3',
      speaker: 'diddy',
      speakerName: 'P. DRIZZY (SUJEITO 09)',
      emotion: 'menacing',
      text: 'NÃO DESÇA ATÉ O LABORATÓRIO ÔMEGA! O SUBSOLO PERTENCE AO COMPOSTO 09!',
      minDisplaySec: 1.6,
      autoAdvanceSec: 4.6,
      cameraIndex: 2,
      soundCue: 'drizzy_growl',
    },
    {
      id: 'real_4',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'tense',
      text: 'Tarde demais, Drizzy! Segura a posição, Marcos — estou descendo as escadas para o Nível -2 agora!',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.4,
      cameraIndex: 3,
      soundCue: 'hatch_hum',
    },
  ],
};

/**
 * SECRET ENDING — "Heliponto Ômega — Evacuação Aérea"
 * Dedicated floodlit elevated 3D Helipad platform (x=180, y=6, z=14) with animated 3D Helicopter
 * (spinning rotors + strobe beacons), safety railings & perimeter floodlights — ZERO void!
 */
export const ENDING_SECRET_CUTSCENE: CutsceneDefinition = {
  id: 'ending_secret',
  chapterTitle: 'FINAL SECRETO — EVACUAÇÃO DO HELIPONTO ÔMEGA',
  subtitle: 'Dossiê Ômega Transmitido • Decolagem sob Holofotes',
  showSurvivor: true,
  diddyBackdropSteps: [2],
  anchors: {
    setId: 'helipad_roof',
    floor: 0,
    groundY: 6.0,
    bounds: { minX: 166, maxX: 194, minZ: 0, maxZ: 28 },
    survivorStart: [180, 6.0, 22.8],
    survivorEnd: [180, 6.0, 14.5],
    survivorFacingYaw: Math.PI,
    diddyStart: [180, 6.0, 25.8],
    diddyEnd: [180, 6.0, 22.0],
    diddyFacingYaw: Math.PI,
    vehiclePos: [180, 6.0, 12.2],
  },
  cameras: [
    // 0: Heroic floodlit establishing shot of the glowing H helipad & spinning 3D rescue helicopter
    { pos: [187.5, 8.6, 21.5], lookAt: [180.0, 7.6, 13.0], fov: 58, shake: 0.01 },
    // 1: Low orbital tracking arc as the survivor sprints across the helipad deck toward the chopper
    { pos: [173.8, 7.7, 17.6], lookAt: [180.0, 7.4, 14.2], fov: 56, shake: 0.012 },
    // 2: Tense whip-pan toward the helipad access gate as P. Drizzy roars against the fenced perimeter
    { pos: [176.2, 7.9, 18.0], lookAt: [180.0, 7.8, 22.6], fov: 48, shake: 0.024 },
    // 3: Cinematic ascending crane as the strobe-lit helicopter lifts off over the Sector 09 night fog
    { pos: [188.5, 11.4, 23.2], lookAt: [180.0, 9.2, 12.2], fov: 62, shake: 0.014 },
  ],
  steps: [
    {
      id: 'secret_1',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'alert',
      text: 'Código de 5 dígitos aceito! Terminal Ômega desbloqueado — transmitindo todos os dossiês confidenciais para a rede externa!',
      minDisplaySec: 1.7,
      autoAdvanceSec: 5.2,
      cameraIndex: 0,
      soundCue: 'hatch_hum',
    },
    {
      id: 'secret_2',
      speaker: 'radio',
      speakerName: 'REGISTRO ÔMEGA // DRA. HELENA',
      emotion: 'static',
      text: '...[gravação vazada]... Diretor Artur Neves ordenou o acobertamento total. O antigo capataz virou o Sujeito 09 após exposição forçada ao Composto 09...',
      minDisplaySec: 1.9,
      autoAdvanceSec: 5.8,
      cameraIndex: 1,
      soundCue: 'radio_static',
    },
    {
      id: 'secret_3',
      speaker: 'diddy',
      speakerName: 'P. DRIZZY (SUJEITO 09)',
      emotion: 'menacing',
      text: 'DESLIGUE ESSE TERMINAL! NEVES TRANCARAM TODOS NÓS AQUI EMBAIXO — NINGUÉM PODE VER O QUE FIZERAM COMIGO!',
      minDisplaySec: 1.7,
      autoAdvanceSec: 5.0,
      cameraIndex: 2,
      soundCue: 'drizzy_growl',
    },
    {
      id: 'secret_4',
      speaker: 'survivor',
      speakerName: 'VOCÊ',
      emotion: 'relieved',
      text: 'Upload 100% concluído. O mundo inteiro já tem as provas do Projeto Ômega e do Diretor Neves. Hora de sair do Setor 09 para sempre.',
      minDisplaySec: 1.8,
      autoAdvanceSec: 5.4,
      cameraIndex: 3,
      soundCue: 'door_open',
    },
  ],
};

/** Backwards-compatible Phase 1 alias pointing to the Good Ending cutscene. */
export const ENDING_CUTSCENE: CutsceneDefinition = ENDING_GOOD_CUTSCENE;

export const ENDING_CUTSCENES: Record<EndingId, CutsceneDefinition> = {
  bad: ENDING_BAD_CUTSCENE,
  good: ENDING_GOOD_CUTSCENE,
  real: ENDING_REAL_CUTSCENE,
  secret: ENDING_SECRET_CUTSCENE,
};

export interface CutsceneSplineRig {
  posCurve: THREE.CatmullRomCurve3;
  lookCurve: THREE.CatmullRomCurve3;
  fovs: number[];
  shakes: number[];
  cameraCount: number;
}

const _splineCache = new Map<CutsceneId, CutsceneSplineRig>();

/**
 * Builds and caches smooth centripetal CatmullRomCurve3 trajectories for both
 * camera position and lookAt target, guaranteeing silky film-like dolly/crane motion.
 */
export function getCutsceneSplineRig(def: CutsceneDefinition): CutsceneSplineRig {
  const cached = _splineCache.get(def.id);
  if (cached) return cached;

  const posPts = def.cameras.map((c) => new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]));
  const lookPts = def.cameras.map((c) => new THREE.Vector3(c.lookAt[0], c.lookAt[1], c.lookAt[2]));
  const posCurve = new THREE.CatmullRomCurve3(posPts, false, 'centripetal', 0.45);
  const lookCurve = new THREE.CatmullRomCurve3(lookPts, false, 'centripetal', 0.45);

  const rig: CutsceneSplineRig = {
    posCurve,
    lookCurve,
    fovs: def.cameras.map((c) => c.fov ?? 64),
    shakes: def.cameras.map((c) => c.shake ?? 0.008),
    cameraCount: def.cameras.length,
  };
  _splineCache.set(def.id, rig);
  return rig;
}

/**
 * Evaluates smooth spline camera position, lookAt target, dynamic FOV, and
 * organic handheld tremor for a given step + local step progress (0..1).
 */
export function evaluateCutsceneSpline(
  def: CutsceneDefinition,
  stepIndex: number,
  stepProgress01: number,
  outPos: THREE.Vector3,
  outLookAt: THREE.Vector3
): { fov: number; shake: number; u: number } {
  const rig = getCutsceneSplineRig(def);
  const clampedStep = Math.max(0, Math.min(def.steps.length - 1, stepIndex));
  const curStep = def.steps[clampedStep];
  const nextStep = def.steps[Math.min(def.steps.length - 1, clampedStep + 1)];

  const maxIdx = Math.max(1, rig.cameraCount - 1);
  const uStart = Math.max(0, Math.min(1, curStep.cameraIndex / maxIdx));
  const uNext = Math.max(0, Math.min(1, nextStep.cameraIndex / maxIdx));
  const p = Math.max(0, Math.min(1, stepProgress01));
  // Smoothstep easing so every beat glides gently into the next camera angle
  const smoothP = p * p * (3 - 2 * p);
  const u = Math.max(0, Math.min(1, uStart + (uNext - uStart) * smoothP * 0.72));

  rig.posCurve.getPoint(u, outPos);
  rig.lookCurve.getPoint(u, outLookAt);

  // Interpolate dynamic FOV & shake smoothly along the spline parameter u
  const fIdx = u * maxIdx;
  const i0 = Math.floor(fIdx);
  const i1 = Math.min(maxIdx, i0 + 1);
  const frac = fIdx - i0;
  const fov = rig.fovs[i0] + (rig.fovs[i1] - rig.fovs[i0]) * frac;
  const shake = rig.shakes[i0] + (rig.shakes[i1] - rig.shakes[i0]) * frac;

  return { fov, shake, u };
}

export function getCutsceneScript(id: CutsceneId): CutsceneDefinition {
  switch (id) {
    case 'intro':
      return INTRO_CUTSCENE;
    case 'ending_bad':
      return ENDING_BAD_CUTSCENE;
    case 'ending_good':
    case 'ending':
      return ENDING_GOOD_CUTSCENE;
    case 'ending_real':
      return ENDING_REAL_CUTSCENE;
    case 'ending_secret':
      return ENDING_SECRET_CUTSCENE;
    default:
      return ENDING_GOOD_CUTSCENE;
  }
}

/**
 * Live Main Menu Camera — atmospheric slow handheld sway overlooking the
 * rain-slicked Sector 09 courtyard, moonlit pergola, puddles, and patrolling P. Drizzy.
 */
export function getTitleFlyoverCamera(timeSec: number): {
  pos: [number, number, number];
  lookAt: [number, number, number];
} {
  const t = timeSec;
  const px = gridToWorld(14.0) + Math.sin(t * 0.22) * 1.45;
  const py = 2.25 + Math.sin(t * 0.37) * 0.14;
  const pz = gridToWorld(28.4) + Math.cos(t * 0.18) * 0.85;
  const lx = gridToWorld(17.5) + Math.sin(t * 0.16) * 0.95;
  const ly = 1.52 + Math.cos(t * 0.29) * 0.08;
  const lz = gridToWorld(23.1);
  return {
    pos: [px, py, pz],
    lookAt: [lx, ly, lz],
  };
}
