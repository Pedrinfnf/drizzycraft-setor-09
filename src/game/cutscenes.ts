import * as THREE from 'three';
import { gridToWorld } from './mansionMap';
import type { CutsceneCameraKeyframe, CutsceneId, DialogueStep, EndingId } from './types';

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
export const INTRO_CUTSCENE: CutsceneDefinition = {
  id: 'intro',
  chapterTitle: 'CAPÍTULO 1 — SETOR 09',
  subtitle: 'O Turno Perdido • Complexo de Pesquisa Interditado',
  showSurvivor: true,
  diddyBackdropSteps: [3, 4],
  cameras: [
    // 0: High wide cinematic establishing crane over the moonlit courtyard wall & Sector 09 facade
    { pos: [14.8, 3.85, 29.8], lookAt: [12.0, 2.0, 23.0], fov: 64, shake: 0.004 },
    // 1: Vaulting down into the courtyard gravel beside the rain-slicked cobbles
    { pos: [12.6, 1.95, 27.6], lookAt: [11.4, 1.35, 25.0], fov: 68, shake: 0.015 },
    // 2: Rapid pan back as the heavy perimeter gate slams shut with an electronic deadbolt
    { pos: [11.2, 1.68, 25.4], lookAt: [12.0, 1.55, 29.5], fov: 58, shake: 0.022 },
    // 3: Dramatic dolly toward the illuminated reception corridor where P. Drizzy's silhouette looms
    { pos: [13.5, 1.72, 26.2], lookAt: [12.0, 1.85, 21.8], fov: 52, shake: 0.01 },
    // 4: Intimate eye-level transition into 1st-person perspective right at the reception threshold
    { pos: [12.0, 1.65, 25.9], lookAt: [12.0, 1.58, 22.8], fov: 74, shake: 0.005 },
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
 * Arrastado pelo corredor escuro até as celas subterrâneas enquanto a porta blindada fecha com estrondo.
 */
export const ENDING_BAD_CUTSCENE: CutsceneDefinition = {
  id: 'ending_bad',
  chapterTitle: 'FINAL RUIM — CONTENÇÃO DO SETOR 09',
  subtitle: 'Celas Subterrâneas • Protocolo de Isolamento Ativado',
  showSurvivor: true,
  diddyBackdropSteps: [0, 1, 2],
  cameras: [
    // 0: Low erratic floor-level POV being dragged backward along the wet basement corridor
    { pos: [14.6, -2.85, 19.4], lookAt: [14.2, -2.1, 14.5], fov: 72, shake: 0.036 },
    // 1: Tight Dutch-angle close-up looking up at P. Drizzy towering at the threshold of Cela 09
    { pos: [14.1, -2.55, 15.2], lookAt: [14.2, -1.65, 12.6], fov: 50, shake: 0.026 },
    // 2: Violent jolt as the heavy blast cell door slams shut in front of the lens
    { pos: [14.2, -2.15, 12.9], lookAt: [14.2, -2.05, 11.1], fov: 46, shake: 0.042 },
    // 3: Cold slow pull-out into the claustrophobic dark cell as the radio fades out
    { pos: [14.2, -2.0, 10.6], lookAt: [14.2, -2.1, 13.8], fov: 58, shake: 0.01 },
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
 * GOOD ENDING — "Fuga pelo Portão Norte"
 * Escapando pelo Portão Blindado Norte rumo à floresta noturna enquanto P. Drizzy observa pelas grades.
 */
export const ENDING_GOOD_CUTSCENE: CutsceneDefinition = {
  id: 'ending_good',
  chapterTitle: 'FUGA PELO PORTÃO NORTE',
  subtitle: 'Good Ending • Perímetro Superado & Sinal do Nível -2',
  showSurvivor: true,
  diddyBackdropSteps: [1],
  cameras: [
    // 0: Heroic low-angle push as the massive Armored North Gate unlocks & parts open into night forest
    { pos: [12.0, 1.55, 2.5], lookAt: [12.0, 1.68, -1.8], fov: 62, shake: 0.01 },
    // 1: Dramatic whip-pan back toward the iron bars as P. Drizzy watches/charges behind the closing gate
    { pos: [14.2, 2.05, 1.2], lookAt: [12.0, 1.72, 6.4], fov: 50, shake: 0.024 },
    // 2: Wide moonlit forest crane framing the survivor catching their breath outside the perimeter
    { pos: [9.6, 2.1, -0.8], lookAt: [12.0, 1.55, 2.2], fov: 58, shake: 0.007 },
    // 3: Ominous slow push-in toward the sealed crimson Nível -2 hatch humming under the complex
    { pos: [12.0, 3.2, 5.2], lookAt: [12.0, 0.8, 1.2], fov: 46, shake: 0.014 },
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
 * REAL ENDING — "Resgate no Nível -2"
 * Cortando o lacre do Alçapão Blindado Vermelho após ouvir Vigia Marcos vivo no rádio e descendo ao Nível -2.
 */
export const ENDING_REAL_CUTSCENE: CutsceneDefinition = {
  id: 'ending_real',
  chapterTitle: 'FINAL REAL — RESGATE NO NÍVEL -2',
  subtitle: 'Escotilha Blindada Aberta • Descida ao Laboratório Ômega',
  showSurvivor: true,
  diddyBackdropSteps: [2],
  cameras: [
    // 0: Tight tactical shot on the crimson armored Level -2 hatch as the wire cutters snap the heavy lock
    { pos: [gridToWorld(16.6), 1.45, gridToWorld(4.9)], lookAt: [gridToWorld(17.5), 0.45, gridToWorld(3.8)], fov: 54, shake: 0.018 },
    // 1: Orbital push as the pressurized red hatch swings upward releasing subterranean vapor
    { pos: [gridToWorld(18.7), 1.85, gridToWorld(4.7)], lookAt: [gridToWorld(17.5), 0.72, gridToWorld(3.8)], fov: 60, shake: 0.014 },
    // 2: Tense whip-pan down the North Wing corridor as P. Drizzy roars too late to stop the descent
    { pos: [gridToWorld(17.5), 1.75, gridToWorld(4.2)], lookAt: [gridToWorld(14.0), 1.7, gridToWorld(8.5)], fov: 48, shake: 0.026 },
    // 3: Dramatic vertical crane descending straight into the illuminated stairwell of Level -2
    { pos: [gridToWorld(17.5), 2.3, gridToWorld(3.8)], lookAt: [gridToWorld(17.5), -1.8, gridToWorld(3.6)], fov: 66, shake: 0.012 },
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
 * SECRET ENDING — "Dossiê Ômega Exposto"
 * Vazando os arquivos confidenciais do Projeto Ômega no Terminal Ômega, revelando a origem de P. Drizzy
 * e o acobertamento do Diretor Artur Neves antes de escapar do complexo.
 */
export const ENDING_SECRET_CUTSCENE: CutsceneDefinition = {
  id: 'ending_secret',
  chapterTitle: 'FINAL SECRETO — DOSSIÊ ÔMEGA EXPOSTO',
  subtitle: 'Terminal Ômega Decodificado • Verdade Transmitida ao Exterior',
  showSurvivor: true,
  diddyBackdropSteps: [2],
  cameras: [
    // 0: Close dramatic dolly into the glowing Terminal Ômega CRT bank in the basement
    { pos: [gridToWorld(24.2), -2.05, gridToWorld(5.3)], lookAt: [gridToWorld(25.5), -2.25, gridToWorld(4.2)], fov: 50, shake: 0.01 },
    // 1: Slow orbital arc around the survivor as encrypted Project Omega dossiers stream to external frequencies
    { pos: [gridToWorld(26.7), -1.8, gridToWorld(5.6)], lookAt: [gridToWorld(25.2), -2.15, gridToWorld(4.2)], fov: 56, shake: 0.008 },
    // 2: Sudden intense cut to the basement tunnel where P. Drizzy roars as emergency alarms purge the sector
    { pos: [gridToWorld(23.2), -1.9, gridToWorld(6.4)], lookAt: [gridToWorld(19.5), -1.95, gridToWorld(9.8)], fov: 48, shake: 0.028 },
    // 3: Triumphant high wide shot beyond the open North Gate under the night sky as the leak finishes
    { pos: [12.0, 2.75, -1.6], lookAt: [12.0, 1.6, 4.5], fov: 64, shake: 0.006 },
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
