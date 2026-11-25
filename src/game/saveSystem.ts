import { DIFFICULTY_ORDER, doesDifficultyUnlockChapter2 } from './difficulty';
import { cloudSync } from './cloudSync';
import {
  DATASTORE_KEY,
  LEGACY_BEST_TIME_KEY,
  LEGACY_CAMPAIGN_SAVE_KEY,
  LEGACY_CHAPTER_PROGRESS_KEY,
  LEGACY_SETTINGS_KEY,
  applyChapter1CompletionToProfile,
  createDefaultProfile,
  createDefaultSettings,
  isChapter2UnlockedFromProfile,
  migrateFromStorage,
  sanitizeProfile,
  sanitizeSettings,
  type StorageLike,
} from './saveManager';
import type {
  AchievementCategory,
  AchievementId,
  AchievementToastPayload,
  ActiveRunSnapshotV3,
  DiddySkinId,
  Difficulty,
  EndingId,
  FlashlightColorId,
  GameSettings,
  GloveSkinId,
  MissionReportSnapshot,
  PerkId,
  ProfileProgress,
  RankGrade,
  RunTelemetry,
} from './types';

export const SAVE_V4_KEY = 'diddycraft_save_v4';
export const SAVE_V4_VERSION = 4 as const;
export const MAX_EQUIPPED_PERKS = 3;

export interface PerkDefinition {
  id: PerkId;
  name: string;
  shortDesc: string;
  detailedDesc: string;
  cost: number;
  tier: 'base' | 'prestige';
  iconKind:
    | 'stealth'
    | 'lungs'
    | 'hacker'
    | 'battery'
    | 'stamina'
    | 'taser'
    | 'scavenger'
    | 'hands'
    | 'acoustic'
    | 'adrenaline'
    | 'nightmare'
    | 'omega';
  requiresNightmare?: boolean;
  requiresAllDifficulties?: boolean;
}

export interface FlashlightCosmeticDef {
  id: FlashlightColorId;
  name: string;
  description: string;
  cost: number;
  beamHex: number;
  coneHex: number;
  lensHex: number;
  swatchCss: string;
}

export interface GloveCosmeticDef {
  id: GloveSkinId;
  name: string;
  description: string;
  cost: number;
  gloveHex: number;
  knuckleHex: number;
  cuffHex: number;
  sleeveHex: number;
  swatchCss: string;
}

export interface DiddySkinCosmeticDef {
  id: DiddySkinId;
  name: string;
  description: string;
  cost: number;
  coatHex: number;
  accentHex: number;
  eyeHex: number;
  swatchCss: string;
}

export interface AchievementDefinition {
  id: AchievementId;
  title: string;
  description: string;
  category: AchievementCategory;
  target: number;
  rewardCoins: number;
  hidden?: boolean;
}

export interface AchievementRecord {
  progress: number;
  unlocked: boolean;
  unlockedAt: number | null;
  claimed: boolean;
}

export interface CosmeticsStateV4 {
  unlockedFlashlights: FlashlightColorId[];
  equippedFlashlight: FlashlightColorId;
  unlockedGloves: GloveSkinId[];
  equippedGloves: GloveSkinId;
  unlockedDiddySkins: DiddySkinId[];
  equippedDiddySkin: DiddySkinId;
}

export interface ProgressionStateV4 {
  survivalCoins: number;
  totalCoinsEarned: number;
  soloDifficultiesBeaten: Difficulty[];
  unlockedEndings: EndingId[];
  bestRanksByDifficulty: Partial<Record<Difficulty, RankGrade>>;
  unlockedPerks: PerkId[];
  equippedPerks: PerkId[];
  cosmetics: CosmeticsStateV4;
  achievements: Record<AchievementId, AchievementRecord>;
  stats: {
    totalRuns: number;
    totalStuns: number;
    totalFlaresUsed: number;
    totalHoldBreathSurvived: number;
    totalCrafts: number;
    totalVhsListened: number;
    totalUvMarksFound: number;
    totalLightSwitchesToggled: number;
    totalVentTraversals: number;
  };
}

export interface SaveDataV4 {
  saveVersion: 4;
  updatedAt: number;
  profile: ProfileProgress;
  settings: GameSettings;
  activeRun: ActiveRunSnapshotV3 | null;
  progression: ProgressionStateV4;
}

export const PERK_CATALOG: readonly PerkDefinition[] = [
  {
    id: 'silent_steps',
    name: 'Passos Silenciosos',
    shortDesc: '-18% raio de ruído ao andar/correr',
    detailedDesc: 'Solados emborrachados táticos multiplicam o raio de ruído de passos por 0.82.',
    cost: 220,
    tier: 'base',
    iconKind: 'stealth',
  },
  {
    id: 'iron_lungs',
    name: 'Fôlego de Ferro',
    shortDesc: '+25% fôlego e zona segura ampliada',
    detailedDesc: 'Aumenta o controle de respiração em +25% e expande levemente a zona verde no esconderijo.',
    cost: 240,
    tier: 'base',
    iconKind: 'lungs',
  },
  {
    id: 'fast_hacker',
    name: 'Hacker Rápido',
    shortDesc: '-25% tempo em terminais, -15% energia Cabine 09-A',
    detailedDesc: 'Acelera leitura de terminais e pistas UV em 25% e reduz o gasto das portas blindadas em 15%.',
    cost: 280,
    tier: 'base',
    iconKind: 'hacker',
  },
  {
    id: 'extended_battery',
    name: 'Bateria Estendida',
    shortDesc: 'Capacidade máxima da Lanterna/UV em 125%',
    detailedDesc: 'Célula de lítio industrial eleva a carga máxima da lanterna e espectro UV para 125%.',
    cost: 260,
    tier: 'base',
    iconKind: 'battery',
  },
  {
    id: 'athlete_lungs',
    name: 'Pulmão de Atleta',
    shortDesc: '+15% regeneração de estamina',
    detailedDesc: 'Recupera estamina 15% mais rápido após encerrar sprints em perseguições.',
    cost: 230,
    tier: 'base',
    iconKind: 'stamina',
  },
  {
    id: 'spare_cartridge',
    name: 'Cartucho Reserva',
    shortDesc: '+1 carga extra inicial na Arma de Stun',
    detailedDesc: 'Comece a operação com 1 cartucho adicional de alta voltagem para o Taser.',
    cost: 340,
    tier: 'base',
    iconKind: 'taser',
  },
  {
    id: 'field_scavenger',
    name: 'Olho de Campo',
    shortDesc: '+15% eficiência em pilhas e estações',
    detailedDesc: 'Aproveitamento elétrico otimizado recupera +15% de energia extra em pilhas e recargas.',
    cost: 270,
    tier: 'base',
    iconKind: 'scavenger',
  },
  {
    id: 'steady_hands',
    name: 'Mãos Firmes',
    shortDesc: '+15% velocidade agachado e em dutos',
    detailedDesc: 'Movimentação tática mais fluida dentro dos dutos metálicos e ao se esgueirar.',
    cost: 290,
    tier: 'base',
    iconKind: 'hands',
  },
  {
    id: 'acoustic_sense',
    name: 'Sensor Acústico',
    shortDesc: '+3m de alcance nos alertas sonoros visuais',
    detailedDesc: 'Detecta a aproximação de passos pesados com antecedência sem remover a tensão.',
    cost: 300,
    tier: 'base',
    iconKind: 'acoustic',
  },
  {
    id: 'adrenaline_burst',
    name: 'Sobrecarga Tática',
    shortDesc: '+12% velocidade por 2.5s após atordoar',
    detailedDesc: 'Descarga controlada de adrenalina facilita o reposicionamento logo após um Stun.',
    cost: 320,
    tier: 'base',
    iconKind: 'adrenaline',
  },
  {
    id: 'nightmare_instinct',
    name: 'Instinto do Pesadelo',
    shortDesc: '+15% velocidade em ações críticas, -20% tremor',
    detailedDesc: 'Exclusiva Nightmare: acelera destrancar/arrombar/gerador em 15% e reduz tremor de adrenalina em 20%.',
    cost: 800,
    tier: 'prestige',
    iconKind: 'nightmare',
    requiresNightmare: true,
  },
  {
    id: 'omega_protocol',
    name: 'Protocolo Ômega',
    shortDesc: '-12% ruído, +15% bateria UV e +1 Flare inicial',
    detailedDesc: 'Endgame (4 dificuldades solo): combina furtividade (-12% ruído), eficiência UV (+15%) e +1 Flare Tático.',
    cost: 2500,
    tier: 'prestige',
    iconKind: 'omega',
    requiresAllDifficulties: true,
  },
];

export const FLASHLIGHT_COSMETICS: readonly FlashlightCosmeticDef[] = [
  {
    id: 'halogen',
    name: 'Halógena Clássica',
    description: 'Facho quente padrão de segurança noturna do Setor 09.',
    cost: 0,
    beamHex: 0xfff1d6,
    coneHex: 0xfde68a,
    lensHex: 0xfff8dc,
    swatchCss: '#fde68a',
  },
  {
    id: 'tactical_led',
    name: 'Branco Tático LED',
    description: 'Feixe branco frio de alto contraste para corredores escuros.',
    cost: 180,
    beamHex: 0xe6f4ff,
    coneHex: 0xbae6fd,
    lensHex: 0xf0f9ff,
    swatchCss: '#bae6fd',
  },
  {
    id: 'industrial_amber',
    name: 'Âmbar Industrial',
    description: 'Luz alaranjada anti-neblina usada nos túneis do subsolo.',
    cost: 240,
    beamHex: 0xffb347,
    coneHex: 0xf59e0b,
    lensHex: 0xfcd34d,
    swatchCss: '#f59e0b',
  },
  {
    id: 'night_vision',
    name: 'Verde Visão Noturna',
    description: 'Espectro esmeralda tático inspirado em óculos militares.',
    cost: 320,
    beamHex: 0x6ee7b7,
    coneHex: 0x10b981,
    lensHex: 0xa7f3d0,
    swatchCss: '#10b981',
  },
  {
    id: 'crimson',
    name: 'Carmesim Contenção',
    description: 'Feixe vermelho de emergência que preserva visão noturna.',
    cost: 380,
    beamHex: 0xff6b6b,
    coneHex: 0xef4444,
    lensHex: 0xfca5a5,
    swatchCss: '#ef4444',
  },
];

export const GLOVE_COSMETICS: readonly GloveCosmeticDef[] = [
  {
    id: 'urban_default',
    name: 'Urbano Padrão',
    description: 'Luva sem dedos tática com manga azul-ardósia do investigador.',
    cost: 0,
    gloveHex: 0x27272a,
    knuckleHex: 0x3f3f46,
    cuffHex: 0x1e293b,
    sleeveHex: 0x2b4c7e,
    swatchCss: '#3b82f6',
  },
  {
    id: 'tactical_black',
    name: 'Luvas Táticas Negras',
    description: 'Kevlar fosco com proteção de juntas reforçada para infiltração.',
    cost: 220,
    gloveHex: 0x0f1116,
    knuckleHex: 0x272a33,
    cuffHex: 0x111318,
    sleeveHex: 0x181c24,
    swatchCss: '#1e293b',
  },
  {
    id: 'insulated_yellow',
    name: 'Luvas Isolantes Amarelas',
    description: 'Borracha dielétrica industrial do setor de geradores.',
    cost: 280,
    gloveHex: 0xd97706,
    knuckleHex: 0xfbbf24,
    cuffHex: 0x78350f,
    sleeveHex: 0x334155,
    swatchCss: '#f59e0b',
  },
  {
    id: 'omega_carbon',
    name: 'Luvas Ômega Carbono',
    description: 'Fibra de carbono experimental com filamentos ciano-ômega.',
    cost: 460,
    gloveHex: 0x161b26,
    knuckleHex: 0x06b6d4,
    cuffHex: 0x0f172a,
    sleeveHex: 0x1e1b38,
    swatchCss: '#06b6d4',
  },
];

export const DIDDY_SKIN_COSMETICS: readonly DiddySkinCosmeticDef[] = [
  {
    id: 'classic_s09',
    name: 'Clássico Setor 09',
    description: 'Sobretudo escuro do capataz contaminado com chaveiro de aço.',
    cost: 0,
    coatHex: 0x151720,
    accentHex: 0xf5c542,
    eyeHex: 0xff241a,
    swatchCss: '#ef4444',
  },
  {
    id: 'unstable_exp',
    name: 'Experimento Instável',
    description: 'Veias emissivas pulsantes de Composto 09 atravessam o corpo.',
    cost: 480,
    coatHex: 0x0c1916,
    accentHex: 0x10b981,
    eyeHex: 0x34d399,
    swatchCss: '#10b981',
  },
  {
    id: 'armored_proto',
    name: 'Protocolo Blindado',
    description: 'Placas balísticas de contenção e visor tático carmesim.',
    cost: 650,
    coatHex: 0x1c222e,
    accentHex: 0x94a3b8,
    eyeHex: 0xf97316,
    swatchCss: '#94a3b8',
  },
];

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  // História (5)
  {
    id: 'ending_bad',
    title: 'Contenção Total',
    description: 'Desbloqueie o Bad Ending (capturado e levado às celas do Setor 09).',
    category: 'story',
    target: 1,
    rewardCoins: 100,
  },
  {
    id: 'ending_good',
    title: 'Portão Norte Superado',
    description: 'Conclua o Good Ending escapando pela rota principal do complexo.',
    category: 'story',
    target: 1,
    rewardCoins: 200,
  },
  {
    id: 'ending_real',
    title: 'Resgate no Nível -2',
    description: 'Desbloqueie o Real Ending abrindo o Alçapão Vermelho para salvar Marcos.',
    category: 'story',
    target: 1,
    rewardCoins: 350,
  },
  {
    id: 'ending_secret',
    title: 'Vazamento Ômega',
    description: 'Conclua o Secret Ending expondo todos os arquivos do Terminal Ômega.',
    category: 'story',
    target: 1,
    rewardCoins: 450,
  },
  {
    id: 'all_endings',
    title: 'Verdade Completa',
    description: 'Desbloqueie todos os 4 finais cinematográficos do Setor 09.',
    category: 'story',
    target: 4,
    rewardCoins: 600,
  },

  // Desafio (8)
  {
    id: 'beat_easy',
    title: 'Primeiro Turno',
    description: 'Escape do Setor 09 no modo Easy ou superior.',
    category: 'challenge',
    target: 1,
    rewardCoins: 120,
  },
  {
    id: 'beat_hard',
    title: 'Sobrevivente Veterano',
    description: 'Escape do Setor 09 no modo Hard.',
    category: 'challenge',
    target: 1,
    rewardCoins: 280,
  },
  {
    id: 'beat_nightmare',
    title: 'Pesadelo Concluído',
    description: 'Vença o modo Nightmare solo (1 golpe fatal).',
    category: 'challenge',
    target: 1,
    rewardCoins: 500,
  },
  {
    id: 'master_all_difficulties',
    title: 'Maestria do Setor 09',
    description: 'Conclua todas as 4 dificuldades solo.',
    category: 'challenge',
    target: 4,
    rewardCoins: 650,
  },
  {
    id: 'ghost_run',
    title: 'Fantasma no Corredor',
    description: 'Escape de uma partida com P. Drizzy ativo sem ser detectado (0 detecções).',
    category: 'challenge',
    target: 1,
    rewardCoins: 420,
  },
  {
    id: 'speedrun_6m',
    title: 'Fuga Relâmpago',
    description: 'Escape do Setor 09 em menos de 6 minutos.',
    category: 'challenge',
    target: 1,
    rewardCoins: 240,
  },
  {
    id: 'speedrun_4m',
    title: 'Velocidade Terminal',
    description: 'Escape do Setor 09 em menos de 4 minutos.',
    category: 'challenge',
    target: 1,
    rewardCoins: 450,
  },
  {
    id: 'rank_s_agent',
    title: 'Agente Classe S',
    description: 'Obtenha Rank S no Relatório Pós-Partida.',
    category: 'challenge',
    target: 1,
    rewardCoins: 400,
  },

  // Exploração (6)
  {
    id: 'vhs_archivist',
    title: 'Arquivista VHS',
    description: 'Ouça 10 fitas VHS/cassetes no total ao longo das partidas.',
    category: 'exploration',
    target: 10,
    rewardCoins: 220,
  },
  {
    id: 'uv_cryptographer',
    title: 'Criptógrafo UV',
    description: 'Registre 12 marcas fluorescentes com a Luz UV.',
    category: 'exploration',
    target: 12,
    rewardCoins: 240,
  },
  {
    id: 'omega_whistleblower',
    title: 'Infiltrado Ômega',
    description: 'Decifre o Terminal Secreto de 5 dígitos em uma partida.',
    category: 'exploration',
    target: 1,
    rewardCoins: 250,
  },
  {
    id: 'bunker_guardian',
    title: 'Guardião da Guarita',
    description: 'Opere o monitor CCTV e sobreviva mantendo energia na sala de segurança.',
    category: 'exploration',
    target: 3,
    rewardCoins: 180,
  },
  {
    id: 'shadow_crawler',
    title: 'Rato de Duto',
    description: 'Atravesse dutos de ventilação 15 vezes para despistar o predador.',
    category: 'exploration',
    target: 15,
    rewardCoins: 190,
  },
  {
    id: 'lights_out',
    title: 'Apagão Tático',
    description: 'Acione interruptores de parede 20 vezes para manipular a escuridão.',
    category: 'exploration',
    target: 20,
    rewardCoins: 160,
    hidden: true,
  },

  // Arsenal (5)
  {
    id: 'taser_specialist',
    title: 'Alta Voltagem',
    description: 'Aplique 10 atordoamentos em P. Drizzy com a Arma de Stun.',
    category: 'arsenal',
    target: 10,
    rewardCoins: 280,
  },
  {
    id: 'flare_tactician',
    title: 'Sinalizador Tático',
    description: 'Use 8 Flares Táticos para distrair ou iluminar o complexo.',
    category: 'arsenal',
    target: 8,
    rewardCoins: 200,
  },
  {
    id: 'breath_of_steel',
    title: 'Nervos de Aço',
    description: 'Sobreviva 10 vezes ao minigame de prender a respiração no esconderijo.',
    category: 'arsenal',
    target: 10,
    rewardCoins: 300,
  },
  {
    id: 'field_engineer',
    title: 'Engenheiro de Campo',
    description: 'Monte 5 ferramentas ou equipamentos na Bancada de Craft.',
    category: 'arsenal',
    target: 5,
    rewardCoins: 220,
  },
  {
    id: 'armory_collector',
    title: 'Arsenal Completo',
    description: 'Desbloqueie 6 itens entre Perks e Cosméticos na Central de Progressão.',
    category: 'arsenal',
    target: 6,
    rewardCoins: 320,
  },
];

const VALID_ENDINGS = new Set<EndingId>(['bad', 'good', 'real', 'secret']);
const VALID_PERKS = new Set<PerkId>(PERK_CATALOG.map((p) => p.id));
const VALID_FLASHLIGHTS = new Set<FlashlightColorId>(FLASHLIGHT_COSMETICS.map((c) => c.id));
const VALID_GLOVES = new Set<GloveSkinId>(GLOVE_COSMETICS.map((c) => c.id));
const VALID_DIDDY_SKINS = new Set<DiddySkinId>(DIDDY_SKIN_COSMETICS.map((c) => c.id));
const VALID_DIFFS = new Set<Difficulty>(DIFFICULTY_ORDER);
const VALID_RANKS = new Set<RankGrade>(['S', 'A', 'B', 'C']);

const RANK_ORDER: Record<RankGrade, number> = { S: 4, A: 3, B: 2, C: 1 };

export function createDefaultAchievements(): Record<AchievementId, AchievementRecord> {
  const out = {} as Record<AchievementId, AchievementRecord>;
  for (const def of ACHIEVEMENT_CATALOG) {
    out[def.id] = { progress: 0, unlocked: false, unlockedAt: null, claimed: false };
  }
  return out;
}

export function createDefaultProgression(): ProgressionStateV4 {
  return {
    survivalCoins: 0,
    totalCoinsEarned: 0,
    soloDifficultiesBeaten: [],
    unlockedEndings: [],
    bestRanksByDifficulty: {},
    unlockedPerks: [],
    equippedPerks: [],
    cosmetics: {
      unlockedFlashlights: ['halogen'],
      equippedFlashlight: 'halogen',
      unlockedGloves: ['urban_default'],
      equippedGloves: 'urban_default',
      unlockedDiddySkins: ['classic_s09'],
      equippedDiddySkin: 'classic_s09',
    },
    achievements: createDefaultAchievements(),
    stats: {
      totalRuns: 0,
      totalStuns: 0,
      totalFlaresUsed: 0,
      totalHoldBreathSurvived: 0,
      totalCrafts: 0,
      totalVhsListened: 0,
      totalUvMarksFound: 0,
      totalLightSwitchesToggled: 0,
      totalVentTraversals: 0,
    },
  };
}

export function createDefaultSaveV4(isMobileHint = false): SaveDataV4 {
  return {
    saveVersion: SAVE_V4_VERSION,
    updatedAt: Date.now(),
    profile: createDefaultProfile(),
    settings: createDefaultSettings(isMobileHint),
    activeRun: null,
    progression: createDefaultProgression(),
  };
}

function normalizeDifficultyAlias(raw: unknown): Difficulty | null {
  if (typeof raw !== 'string') return null;
  if (VALID_DIFFS.has(raw as Difficulty)) return raw as Difficulty;
  if (raw === 'normal') return 'practice';
  return null;
}

export function sanitizeProgression(
  raw: unknown,
  profileHint?: ProfileProgress
): ProgressionStateV4 {
  const def = createDefaultProgression();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const coins = Math.max(0, Math.floor(Number(r.survivalCoins ?? 0) || 0));
  const totalCoinsEarned = Math.max(coins, Math.floor(Number(r.totalCoinsEarned ?? coins) || 0));

  const soloSet = new Set<Difficulty>();
  if (Array.isArray(r.soloDifficultiesBeaten)) {
    for (const item of r.soloDifficultiesBeaten) {
      const d = normalizeDifficultyAlias(item);
      if (d) soloSet.add(d);
    }
  }
  // Sync any difficulties recorded in profile.completedDifficulties.ch1
  const ch1Done = profileHint?.completedDifficulties['ch1'] ?? [];
  for (const d of ch1Done) {
    if (VALID_DIFFS.has(d)) soloSet.add(d);
  }

  const endingsSet = new Set<EndingId>();
  if (Array.isArray(r.unlockedEndings)) {
    for (const e of r.unlockedEndings) {
      if (typeof e === 'string' && VALID_ENDINGS.has(e as EndingId)) {
        endingsSet.add(e as EndingId);
      }
    }
  }
  if (profileHint && profileHint.totalEscapes > 0 && endingsSet.size === 0) {
    endingsSet.add('good');
  }

  const bestRanksByDifficulty: Partial<Record<Difficulty, RankGrade>> = {};
  if (r.bestRanksByDifficulty && typeof r.bestRanksByDifficulty === 'object') {
    for (const [k, v] of Object.entries(r.bestRanksByDifficulty as Record<string, unknown>)) {
      const d = normalizeDifficultyAlias(k);
      if (d && typeof v === 'string' && VALID_RANKS.has(v as RankGrade)) {
        bestRanksByDifficulty[d] = v as RankGrade;
      }
    }
  }

  const unlockedPerks = Array.isArray(r.unlockedPerks)
    ? Array.from(
        new Set(
          r.unlockedPerks.filter((p): p is PerkId => typeof p === 'string' && VALID_PERKS.has(p as PerkId))
        )
      )
    : [];
  const unlockedPerkSet = new Set(unlockedPerks);
  const equippedPerks = Array.isArray(r.equippedPerks)
    ? Array.from(
        new Set(
          r.equippedPerks.filter(
            (p): p is PerkId => typeof p === 'string' && unlockedPerkSet.has(p as PerkId)
          )
        )
      ).slice(0, MAX_EQUIPPED_PERKS)
    : [];

  const cosRaw = (r.cosmetics && typeof r.cosmetics === 'object' ? r.cosmetics : {}) as Record<
    string,
    unknown
  >;
  const unlockedFlashlights = Array.from(
    new Set<FlashlightColorId>([
      'halogen',
      ...(Array.isArray(cosRaw.unlockedFlashlights)
        ? cosRaw.unlockedFlashlights.filter(
            (c): c is FlashlightColorId =>
              typeof c === 'string' && VALID_FLASHLIGHTS.has(c as FlashlightColorId)
          )
        : []),
    ])
  );
  const equippedFlashlight: FlashlightColorId =
    typeof cosRaw.equippedFlashlight === 'string' &&
    unlockedFlashlights.includes(cosRaw.equippedFlashlight as FlashlightColorId)
      ? (cosRaw.equippedFlashlight as FlashlightColorId)
      : 'halogen';

  const unlockedGloves = Array.from(
    new Set<GloveSkinId>([
      'urban_default',
      ...(Array.isArray(cosRaw.unlockedGloves)
        ? cosRaw.unlockedGloves.filter(
            (c): c is GloveSkinId => typeof c === 'string' && VALID_GLOVES.has(c as GloveSkinId)
          )
        : []),
    ])
  );
  const equippedGloves: GloveSkinId =
    typeof cosRaw.equippedGloves === 'string' &&
    unlockedGloves.includes(cosRaw.equippedGloves as GloveSkinId)
      ? (cosRaw.equippedGloves as GloveSkinId)
      : 'urban_default';

  const unlockedDiddySkins = Array.from(
    new Set<DiddySkinId>([
      'classic_s09',
      ...(Array.isArray(cosRaw.unlockedDiddySkins)
        ? cosRaw.unlockedDiddySkins.filter(
            (c): c is DiddySkinId => typeof c === 'string' && VALID_DIDDY_SKINS.has(c as DiddySkinId)
          )
        : []),
    ])
  );
  const equippedDiddySkin: DiddySkinId =
    typeof cosRaw.equippedDiddySkin === 'string' &&
    unlockedDiddySkins.includes(cosRaw.equippedDiddySkin as DiddySkinId)
      ? (cosRaw.equippedDiddySkin as DiddySkinId)
      : 'classic_s09';

  const achRaw = (r.achievements && typeof r.achievements === 'object' ? r.achievements : {}) as Record<
    string,
    unknown
  >;
  const achievements = createDefaultAchievements();
  for (const adef of ACHIEVEMENT_CATALOG) {
    const entry = achRaw[adef.id];
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      const prog = Math.max(0, Math.min(adef.target, Math.floor(Number(e.progress ?? 0) || 0)));
      const unlocked = Boolean(e.unlocked) || prog >= adef.target;
      achievements[adef.id] = {
        progress: unlocked ? adef.target : prog,
        unlocked,
        unlockedAt: unlocked ? Number(e.unlockedAt) || Date.now() : null,
        claimed: unlocked && Boolean(e.claimed),
      };
    }
  }

  const statsRaw = (r.stats && typeof r.stats === 'object' ? r.stats : {}) as Record<string, unknown>;
  const numStat = (k: string) => Math.max(0, Math.floor(Number(statsRaw[k] ?? 0) || 0));

  return {
    survivalCoins: coins,
    totalCoinsEarned,
    soloDifficultiesBeaten: Array.from(soloSet),
    unlockedEndings: Array.from(endingsSet),
    bestRanksByDifficulty,
    unlockedPerks,
    equippedPerks,
    cosmetics: {
      unlockedFlashlights,
      equippedFlashlight,
      unlockedGloves,
      equippedGloves,
      unlockedDiddySkins,
      equippedDiddySkin,
    },
    achievements,
    stats: {
      totalRuns: numStat('totalRuns'),
      totalStuns: numStat('totalStuns'),
      totalFlaresUsed: numStat('totalFlaresUsed'),
      totalHoldBreathSurvived: numStat('totalHoldBreathSurvived'),
      totalCrafts: numStat('totalCrafts'),
      totalVhsListened: numStat('totalVhsListened'),
      totalUvMarksFound: numStat('totalUvMarksFound'),
      totalLightSwitchesToggled: numStat('totalLightSwitchesToggled'),
      totalVentTraversals: numStat('totalVentTraversals'),
    },
  };
}

export function sanitizeSaveV4(raw: unknown, isMobileHint = false): SaveDataV4 {
  if (!raw || typeof raw !== 'object') return createDefaultSaveV4(isMobileHint);
  const obj = raw as Record<string, unknown>;
  const profile = sanitizeProfile(obj.profile);
  const settings = sanitizeSettings(obj.settings, isMobileHint);
  const progression = sanitizeProgression(obj.progression, profile);
  const activeRun =
    obj.activeRun && typeof obj.activeRun === 'object'
      ? (obj.activeRun as ActiveRunSnapshotV3)
      : null;

  return {
    saveVersion: SAVE_V4_VERSION,
    updatedAt: Number(obj.updatedAt) || Date.now(),
    profile,
    settings,
    activeRun,
    progression,
  };
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Migrates v1/v2/v3 storage into a validated SaveDataV4 envelope safely.
 * Corrupted JSON always falls back cleanly without throwing.
 */
export function migrateStorageToV4(
  storage: StorageLike,
  isMobileHint = false
): { data: SaveDataV4; migrated: boolean } {
  // 1. Direct v4 key
  const v4Raw = safeParseJson(storage.getItem(SAVE_V4_KEY));
  if (v4Raw && typeof v4Raw === 'object') {
    const obj = v4Raw as Record<string, unknown>;
    if (obj.saveVersion === SAVE_V4_VERSION) {
      return { data: sanitizeSaveV4(obj, isMobileHint), migrated: false };
    }
  }

  // 2. Check v3 datastore key or legacy v1/v2 keys via saveManager migration
  const hasV3OrLegacy =
    storage.getItem(DATASTORE_KEY) !== null ||
    storage.getItem(LEGACY_SETTINGS_KEY) !== null ||
    storage.getItem(LEGACY_CHAPTER_PROGRESS_KEY) !== null ||
    storage.getItem(LEGACY_BEST_TIME_KEY) !== null ||
    storage.getItem(LEGACY_CAMPAIGN_SAVE_KEY) !== null;

  if (hasV3OrLegacy) {
    const { data: v3Data } = migrateFromStorage(storage, isMobileHint);
    const upgraded = sanitizeSaveV4(
      {
        saveVersion: SAVE_V4_VERSION,
        updatedAt: v3Data.updatedAt,
        profile: v3Data.profile,
        settings: v3Data.settings,
        activeRun: v3Data.activeRun,
        progression: createDefaultProgression(),
      },
      isMobileHint
    );
    return { data: upgraded, migrated: true };
  }

  return { data: createDefaultSaveV4(isMobileHint), migrated: false };
}

/**
 * Computes transparent S–C Rank and Survival Coin payout from end-of-run telemetry.
 */
export function calculateMissionReport(
  telemetry: RunTelemetry,
  prevBestTimeSec: number | undefined,
  currentBalance: number,
  chapter2JustUnlocked: boolean
): MissionReportSnapshot {
  const isVictory = telemetry.endingId !== 'bad';
  const breakdown: { label: string; points: number }[] = [];

  // 1. Base completion score
  const basePts =
    telemetry.endingId === 'secret'
      ? 45
      : telemetry.endingId === 'real'
      ? 42
      : telemetry.endingId === 'good'
      ? 36
      : 10;
  breakdown.push({
    label:
      telemetry.endingId === 'secret'
        ? 'Final Secreto (Dossiê Ômega)'
        : telemetry.endingId === 'real'
        ? 'Final Real (Nível -2)'
        : telemetry.endingId === 'good'
        ? 'Fuga pelo Portão Norte'
        : 'Contenção do Setor 09',
    points: basePts,
  });

  // 2. Speed score (up to +25 pts for fast escape)
  let timePts = 0;
  if (isVictory) {
    if (telemetry.elapsedSec <= 240) timePts = 25;
    else if (telemetry.elapsedSec <= 360) timePts = 20;
    else if (telemetry.elapsedSec <= 540) timePts = 14;
    else if (telemetry.elapsedSec <= 780) timePts = 8;
    else timePts = 4;
  } else {
    timePts = Math.min(8, Math.floor(telemetry.elapsedSec / 60) * 2);
  }
  breakdown.push({ label: 'Eficiência de Tempo', points: timePts });

  // 3. Stealth / Low detection score (up to +20 pts)
  let stealthPts = 0;
  if (isVictory) {
    if (telemetry.detections === 0) stealthPts = 20;
    else if (telemetry.detections <= 2) stealthPts = 14;
    else if (telemetry.detections <= 4) stealthPts = 8;
    else stealthPts = 3;
  }
  breakdown.push({ label: 'Furtividade (Detecções)', points: stealthPts });

  // 4. Investigation & Tactical bonus (VHS, UV, Stuns, up to +15 pts)
  const intelPts = Math.min(
    15,
    telemetry.vhsCollected * 2 +
      telemetry.uvCluesCollected * 2 +
      Math.min(3, telemetry.stunsApplied) * 2
  );
  breakdown.push({ label: 'Coleta & Tática (VHS/UV/Stun)', points: intelPts });

  const totalScore = Math.max(0, Math.min(100, basePts + timePts + stealthPts + intelPts));

  let rank: RankGrade = 'C';
  if (isVictory && totalScore >= 85) rank = 'S';
  else if (isVictory && totalScore >= 68) rank = 'A';
  else if (totalScore >= 46) rank = 'B';
  else rank = 'C';

  // Survival Coins formula
  const baseCoins = isVictory ? 120 : 35;
  const rankBonus = rank === 'S' ? 140 : rank === 'A' ? 90 : rank === 'B' ? 45 : 15;
  const diffMult =
    telemetry.difficulty === 'nightmare'
      ? 1.85
      : telemetry.difficulty === 'hard'
      ? 1.4
      : telemetry.difficulty === 'easy'
      ? 1.0
      : 0.65;
  const difficultyBonus = Math.round((baseCoins + rankBonus) * (diffMult - 1));
  const endingBonus =
    telemetry.endingId === 'secret'
      ? 160
      : telemetry.endingId === 'real'
      ? 110
      : telemetry.endingId === 'good'
      ? 40
      : 0;

  const coinsEarned = Math.max(15, baseCoins + rankBonus + difficultyBonus + endingBonus);
  const roundedTime = Math.max(1, Math.round(telemetry.elapsedSec * 10) / 10);
  const isNewBestTime = isVictory && (prevBestTimeSec === undefined || roundedTime < prevBestTimeSec);

  return {
    endingId: telemetry.endingId,
    difficulty: telemetry.difficulty,
    elapsedSec: telemetry.elapsedSec,
    isNewBestTime,
    bestTimeSec: isVictory
      ? isNewBestTime
        ? roundedTime
        : prevBestTimeSec ?? roundedTime
      : prevBestTimeSec ?? null,
    detections: telemetry.detections,
    stunsApplied: telemetry.stunsApplied,
    vhsCollected: telemetry.vhsCollected,
    vhsTotal: telemetry.vhsTotal,
    uvCluesCollected: telemetry.uvCluesCollected,
    uvCluesTotal: telemetry.uvCluesTotal,
    exploredPct: telemetry.exploredPct,
    rank,
    rankScore: totalScore,
    rankBreakdown: breakdown,
    coinsEarned,
    coinBreakdown: {
      base: baseCoins,
      rankBonus,
      difficultyBonus,
      endingBonus,
    },
    newBalance: currentBalance + coinsEarned,
    chapter2JustUnlocked,
  };
}

/**
 * Checks whether a Perk's skill requirements are satisfied (before checking coins).
 */
export function getPerkRequirementStatus(
  progression: ProgressionStateV4,
  perkId: PerkId
): { met: boolean; reason: string | null } {
  const def = PERK_CATALOG.find((p) => p.id === perkId);
  if (!def) return { met: false, reason: 'Perk inválida' };

  const beaten = new Set(progression.soloDifficultiesBeaten);
  if (def.requiresNightmare && !beaten.has('nightmare')) {
    return { met: false, reason: 'Vença o modo Nightmare solo primeiro' };
  }
  if (def.requiresAllDifficulties) {
    const missing = DIFFICULTY_ORDER.filter((d) => !beaten.has(d));
    if (missing.length > 0) {
      return {
        met: false,
        reason: `Vença todas as 4 dificuldades solo (faltam: ${missing.length})`,
      };
    }
  }
  return { met: true, reason: null };
}

export function getPerkDef(id: PerkId): PerkDefinition {
  return PERK_CATALOG.find((p) => p.id === id) ?? PERK_CATALOG[0];
}

export function getFlashlightCosmetic(id: FlashlightColorId): FlashlightCosmeticDef {
  return FLASHLIGHT_COSMETICS.find((c) => c.id === id) ?? FLASHLIGHT_COSMETICS[0];
}

export function getGloveCosmetic(id: GloveSkinId): GloveCosmeticDef {
  return GLOVE_COSMETICS.find((c) => c.id === id) ?? GLOVE_COSMETICS[0];
}

export function getDiddySkinCosmetic(id: DiddySkinId): DiddySkinCosmeticDef {
  return DIDDY_SKIN_COSMETICS.find((c) => c.id === id) ?? DIDDY_SKIN_COSMETICS[0];
}

/**
 * Export / Import portable Save v4 backup code (base64-encoded UTF-8 JSON with prefix).
 */
const BACKUP_PREFIX = 'DC09V4:';

function encodeUtf8Base64(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function decodeUtf8Base64(b64: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportSaveBackupCode(data: SaveDataV4): string {
  const payload = JSON.stringify(sanitizeSaveV4(data));
  return `${BACKUP_PREFIX}${encodeUtf8Base64(payload)}`;
}

export function importSaveBackupCode(
  code: string,
  isMobileHint = false
): { ok: true; data: SaveDataV4 } | { ok: false; error: string } {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: 'Código de backup vazio.' };
  try {
    const jsonStr = trimmed.startsWith(BACKUP_PREFIX)
      ? decodeUtf8Base64(trimmed.slice(BACKUP_PREFIX.length))
      : trimmed;
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'Formato de backup inválido.' };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.saveVersion !== 3 && obj.saveVersion !== 4) {
      return { ok: false, error: 'Versão de save incompatível.' };
    }
    return { ok: true, data: sanitizeSaveV4(obj, isMobileHint) };
  } catch {
    return { ok: false, error: 'Código de backup corrompido ou malformado.' };
  }
}

export class SaveSystem {
  private cache: SaveDataV4 | null = null;
  private storageOverride: StorageLike | null = null;

  constructor(storageOverride?: StorageLike) {
    this.storageOverride = storageOverride ?? null;
  }

  private getStorage(): StorageLike | null {
    if (this.storageOverride) return this.storageOverride;
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private detectMobileHint(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.innerWidth <= 920 ||
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    );
  }

  load(): SaveDataV4 {
    if (this.cache) return this.cache;
    const storage = this.getStorage();
    const isMobile = this.detectMobileHint();
    if (!storage) {
      this.cache = createDefaultSaveV4(isMobile);
      return this.cache;
    }
    try {
      const { data, migrated } = migrateStorageToV4(storage, isMobile);
      this.cache = data;
      if (migrated || !storage.getItem(SAVE_V4_KEY)) {
        this.persist(data);
      }
      return data;
    } catch {
      this.cache = createDefaultSaveV4(isMobile);
      return this.cache;
    }
  }

  persist(data: SaveDataV4): void {
    const clean = sanitizeSaveV4(data, this.detectMobileHint());
    clean.updatedAt = Date.now();
    this.cache = clean;
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(SAVE_V4_KEY, JSON.stringify(clean));
        // Mirror core v3 slice for seamless backwards compatibility with existing v3 readers
        storage.setItem(
          DATASTORE_KEY,
          JSON.stringify({
            saveVersion: 3,
            updatedAt: clean.updatedAt,
            profile: clean.profile,
            settings: clean.settings,
            activeRun: clean.activeRun,
          })
        );
      } catch {
        // Ignore quota errors
      }
    }
    // Instant non-blocking cloud sync (keeps local <1ms write instant; flushes via keepalive on Android close)
    void cloudSync.uploadSave(clean);
  }

  getProgression(): ProgressionStateV4 {
    return this.load().progression;
  }

  getSettings(): GameSettings {
    return this.load().settings;
  }

  updateSettings(next: GameSettings): GameSettings {
    const cur = this.load();
    const clean = sanitizeSettings(next, this.detectMobileHint());
    this.persist({ ...cur, settings: clean });
    return clean;
  }

  resetSettings(): GameSettings {
    const cur = this.load();
    const fresh = createDefaultSettings(this.detectMobileHint());
    this.persist({ ...cur, settings: fresh });
    return fresh;
  }

  getProfile(): ProfileProgress {
    return this.load().profile;
  }

  isChapter2Unlocked(): boolean {
    return isChapter2UnlockedFromProfile(this.load().profile);
  }

  getEquippedPerks(): PerkId[] {
    return [...this.load().progression.equippedPerks];
  }

  hasPerkEquipped(id: PerkId): boolean {
    return this.load().progression.equippedPerks.includes(id);
  }

  getCosmetics(): CosmeticsStateV4 {
    return this.load().progression.cosmetics;
  }

  /**
   * Purchases a Perk if skill requirements and Survival Coins are met.
   */
  buyPerk(perkId: PerkId): { ok: boolean; message: string; progression: ProgressionStateV4 } {
    const cur = this.load();
    const prog = cur.progression;
    const def = PERK_CATALOG.find((p) => p.id === perkId);
    if (!def) return { ok: false, message: 'Perk desconhecida.', progression: prog };
    if (prog.unlockedPerks.includes(perkId)) {
      return { ok: false, message: 'Perk já desbloqueada.', progression: prog };
    }
    const req = getPerkRequirementStatus(prog, perkId);
    if (!req.met) {
      return { ok: false, message: req.reason ?? 'Requisito não cumprido.', progression: prog };
    }
    if (prog.survivalCoins < def.cost) {
      return {
        ok: false,
        message: `Moedas insuficientes (${prog.survivalCoins}/${def.cost}).`,
        progression: prog,
      };
    }

    const nextProg: ProgressionStateV4 = {
      ...prog,
      survivalCoins: prog.survivalCoins - def.cost,
      unlockedPerks: [...prog.unlockedPerks, perkId],
    };
    this.persist({ ...cur, progression: nextProg });
    this.syncCollectorAchievement();
    return { ok: true, message: `${def.name} desbloqueada!`, progression: this.load().progression };
  }

  toggleEquipPerk(perkId: PerkId): { ok: boolean; message: string; progression: ProgressionStateV4 } {
    const cur = this.load();
    const prog = cur.progression;
    if (!prog.unlockedPerks.includes(perkId)) {
      return { ok: false, message: 'Desbloqueie esta Perk primeiro.', progression: prog };
    }
    const isEquipped = prog.equippedPerks.includes(perkId);
    if (isEquipped) {
      const nextProg: ProgressionStateV4 = {
        ...prog,
        equippedPerks: prog.equippedPerks.filter((id) => id !== perkId),
      };
      this.persist({ ...cur, progression: nextProg });
      return { ok: true, message: 'Perk removida do loadout.', progression: this.load().progression };
    }
    if (prog.equippedPerks.length >= MAX_EQUIPPED_PERKS) {
      return {
        ok: false,
        message: `Limite de ${MAX_EQUIPPED_PERKS} Perks ativas atingido. Desequipe uma antes.`,
        progression: prog,
      };
    }
    const nextProg: ProgressionStateV4 = {
      ...prog,
      equippedPerks: [...prog.equippedPerks, perkId],
    };
    this.persist({ ...cur, progression: nextProg });
    return { ok: true, message: 'Perk equipada!', progression: this.load().progression };
  }

  buyOrEquipFlashlight(id: FlashlightColorId): {
    ok: boolean;
    message: string;
    progression: ProgressionStateV4;
  } {
    const cur = this.load();
    const prog = cur.progression;
    const def = FLASHLIGHT_COSMETICS.find((c) => c.id === id);
    if (!def) return { ok: false, message: 'Item inválido.', progression: prog };

    if (prog.cosmetics.unlockedFlashlights.includes(id)) {
      const nextProg: ProgressionStateV4 = {
        ...prog,
        cosmetics: { ...prog.cosmetics, equippedFlashlight: id },
      };
      this.persist({ ...cur, progression: nextProg });
      return { ok: true, message: `${def.name} equipada!`, progression: this.load().progression };
    }
    if (prog.survivalCoins < def.cost) {
      return { ok: false, message: 'Moedas insuficientes.', progression: prog };
    }
    const nextProg: ProgressionStateV4 = {
      ...prog,
      survivalCoins: prog.survivalCoins - def.cost,
      cosmetics: {
        ...prog.cosmetics,
        unlockedFlashlights: [...prog.cosmetics.unlockedFlashlights, id],
        equippedFlashlight: id,
      },
    };
    this.persist({ ...cur, progression: nextProg });
    this.syncCollectorAchievement();
    return { ok: true, message: `${def.name} adquirida e equipada!`, progression: this.load().progression };
  }

  buyOrEquipGloves(id: GloveSkinId): {
    ok: boolean;
    message: string;
    progression: ProgressionStateV4;
  } {
    const cur = this.load();
    const prog = cur.progression;
    const def = GLOVE_COSMETICS.find((c) => c.id === id);
    if (!def) return { ok: false, message: 'Item inválido.', progression: prog };

    if (prog.cosmetics.unlockedGloves.includes(id)) {
      const nextProg: ProgressionStateV4 = {
        ...prog,
        cosmetics: { ...prog.cosmetics, equippedGloves: id },
      };
      this.persist({ ...cur, progression: nextProg });
      return { ok: true, message: `${def.name} equipada!`, progression: this.load().progression };
    }
    if (prog.survivalCoins < def.cost) {
      return { ok: false, message: 'Moedas insuficientes.', progression: prog };
    }
    const nextProg: ProgressionStateV4 = {
      ...prog,
      survivalCoins: prog.survivalCoins - def.cost,
      cosmetics: {
        ...prog.cosmetics,
        unlockedGloves: [...prog.cosmetics.unlockedGloves, id],
        equippedGloves: id,
      },
    };
    this.persist({ ...cur, progression: nextProg });
    this.syncCollectorAchievement();
    return { ok: true, message: `${def.name} adquirida e equipada!`, progression: this.load().progression };
  }

  buyOrEquipDiddySkin(id: DiddySkinId): {
    ok: boolean;
    message: string;
    progression: ProgressionStateV4;
  } {
    const cur = this.load();
    const prog = cur.progression;
    const def = DIDDY_SKIN_COSMETICS.find((c) => c.id === id);
    if (!def) return { ok: false, message: 'Skin inválida.', progression: prog };

    if (prog.cosmetics.unlockedDiddySkins.includes(id)) {
      const nextProg: ProgressionStateV4 = {
        ...prog,
        cosmetics: { ...prog.cosmetics, equippedDiddySkin: id },
      };
      this.persist({ ...cur, progression: nextProg });
      return { ok: true, message: `${def.name} equipada!`, progression: this.load().progression };
    }
    if (prog.survivalCoins < def.cost) {
      return { ok: false, message: 'Moedas insuficientes.', progression: prog };
    }
    const nextProg: ProgressionStateV4 = {
      ...prog,
      survivalCoins: prog.survivalCoins - def.cost,
      cosmetics: {
        ...prog.cosmetics,
        unlockedDiddySkins: [...prog.cosmetics.unlockedDiddySkins, id],
        equippedDiddySkin: id,
      },
    };
    this.persist({ ...cur, progression: nextProg });
    this.syncCollectorAchievement();
    return { ok: true, message: `${def.name} adquirida e equipada!`, progression: this.load().progression };
  }

  /**
   * Increments an achievement's progress (or sets absolute value when absolute=true).
   * Returns an AchievementToastPayload if it JUST unlocked!
   */
  advanceAchievement(
    id: AchievementId,
    amount = 1,
    absolute = false
  ): AchievementToastPayload | null {
    const def = ACHIEVEMENT_CATALOG.find((a) => a.id === id);
    if (!def) return null;
    const cur = this.load();
    const rec = cur.progression.achievements[id];
    if (!rec || rec.unlocked) return null;

    const nextProgVal = Math.min(
      def.target,
      Math.max(rec.progress, absolute ? amount : rec.progress + amount)
    );
    const justUnlocked = nextProgVal >= def.target;

    const nextAchievements: Record<AchievementId, AchievementRecord> = {
      ...cur.progression.achievements,
      [id]: {
        progress: nextProgVal,
        unlocked: justUnlocked,
        unlockedAt: justUnlocked ? Date.now() : null,
        claimed: false,
      },
    };

    this.persist({
      ...cur,
      progression: {
        ...cur.progression,
        achievements: nextAchievements,
      },
    });

    if (!justUnlocked) return null;
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      rewardCoins: def.rewardCoins,
      category: def.category,
    };
  }

  claimAchievementReward(id: AchievementId): {
    ok: boolean;
    coinsAwarded: number;
    progression: ProgressionStateV4;
  } {
    const def = ACHIEVEMENT_CATALOG.find((a) => a.id === id);
    const cur = this.load();
    const rec = cur.progression.achievements[id];
    if (!def || !rec || !rec.unlocked || rec.claimed) {
      return { ok: false, coinsAwarded: 0, progression: cur.progression };
    }

    const nextProg: ProgressionStateV4 = {
      ...cur.progression,
      survivalCoins: cur.progression.survivalCoins + def.rewardCoins,
      totalCoinsEarned: cur.progression.totalCoinsEarned + def.rewardCoins,
      achievements: {
        ...cur.progression.achievements,
        [id]: { ...rec, claimed: true },
      },
    };
    this.persist({ ...cur, progression: nextProg });
    return { ok: true, coinsAwarded: def.rewardCoins, progression: this.load().progression };
  }

  private syncCollectorAchievement(): AchievementToastPayload | null {
    const prog = this.load().progression;
    const totalOwned =
      prog.unlockedPerks.length +
      Math.max(0, prog.cosmetics.unlockedFlashlights.length - 1) +
      Math.max(0, prog.cosmetics.unlockedGloves.length - 1) +
      Math.max(0, prog.cosmetics.unlockedDiddySkins.length - 1);
    return this.advanceAchievement('armory_collector', totalOwned, true);
  }

  /**
   * Records a finished run (any of the 4 endings), computes Rank S–C & Survival Coins,
   * updates solo difficulty unlocks, best times, endings, and evaluates end-of-run achievements.
   */
  recordRunResult(telemetry: RunTelemetry): {
    report: MissionReportSnapshot;
    profile: ProfileProgress;
    progression: ProgressionStateV4;
    newlyUnlockedAchievements: AchievementToastPayload[];
  } {
    const cur = this.load();
    const isVictory = telemetry.endingId !== 'bad';
    const prevBest = cur.profile.bestTimesSec['ch1']?.[telemetry.difficulty];

    let updatedProfile = cur.profile;
    let chapter2JustUnlocked = false;
    if (isVictory) {
      const chRes = applyChapter1CompletionToProfile(
        cur.profile,
        telemetry.difficulty,
        telemetry.elapsedSec,
        telemetry.safeUnlocked
      );
      updatedProfile = chRes.profile;
      chapter2JustUnlocked = chRes.chapter2JustUnlocked;
    } else {
      updatedProfile = sanitizeProfile({
        ...cur.profile,
        totalPlaytimeSec: cur.profile.totalPlaytimeSec + Math.max(1, telemetry.elapsedSec),
      });
    }

    const report = calculateMissionReport(
      telemetry,
      prevBest,
      cur.progression.survivalCoins,
      chapter2JustUnlocked
    );

    const endingsSet = new Set<EndingId>(cur.progression.unlockedEndings);
    endingsSet.add(telemetry.endingId);

    const soloSet = new Set<Difficulty>(cur.progression.soloDifficultiesBeaten);
    if (isVictory) {
      soloSet.add(telemetry.difficulty);
    }

    const bestRanks = { ...cur.progression.bestRanksByDifficulty };
    if (isVictory) {
      const prevRank = bestRanks[telemetry.difficulty];
      if (!prevRank || RANK_ORDER[report.rank] > RANK_ORDER[prevRank]) {
        bestRanks[telemetry.difficulty] = report.rank;
      }
    }

    const nextProgression: ProgressionStateV4 = {
      ...cur.progression,
      survivalCoins: cur.progression.survivalCoins + report.coinsEarned,
      totalCoinsEarned: cur.progression.totalCoinsEarned + report.coinsEarned,
      soloDifficultiesBeaten: Array.from(soloSet),
      unlockedEndings: Array.from(endingsSet),
      bestRanksByDifficulty: bestRanks,
      stats: {
        ...cur.progression.stats,
        totalRuns: cur.progression.stats.totalRuns + 1,
      },
    };

    this.persist({
      ...cur,
      profile: updatedProfile,
      progression: nextProgression,
      activeRun: null,
    });

    // Evaluate end-of-run achievements
    const toasts: AchievementToastPayload[] = [];
    const pushIf = (t: AchievementToastPayload | null) => {
      if (t) toasts.push(t);
    };

    if (telemetry.endingId === 'bad') pushIf(this.advanceAchievement('ending_bad', 1, true));
    if (telemetry.endingId === 'good') pushIf(this.advanceAchievement('ending_good', 1, true));
    if (telemetry.endingId === 'real') pushIf(this.advanceAchievement('ending_real', 1, true));
    if (telemetry.endingId === 'secret') pushIf(this.advanceAchievement('ending_secret', 1, true));
    pushIf(this.advanceAchievement('all_endings', endingsSet.size, true));

    if (isVictory) {
      if (telemetry.difficulty === 'easy' || doesDifficultyUnlockChapter2(telemetry.difficulty)) {
        pushIf(this.advanceAchievement('beat_easy', 1, true));
      }
      if (telemetry.difficulty === 'hard' || telemetry.difficulty === 'nightmare') {
        pushIf(this.advanceAchievement('beat_hard', 1, true));
      }
      if (telemetry.difficulty === 'nightmare') {
        pushIf(this.advanceAchievement('beat_nightmare', 1, true));
      }
      pushIf(this.advanceAchievement('master_all_difficulties', soloSet.size, true));

      if (telemetry.difficulty !== 'practice' && telemetry.detections === 0) {
        pushIf(this.advanceAchievement('ghost_run', 1, true));
      }
      if (telemetry.elapsedSec <= 360) {
        pushIf(this.advanceAchievement('speedrun_6m', 1, true));
      }
      if (telemetry.elapsedSec <= 240) {
        pushIf(this.advanceAchievement('speedrun_4m', 1, true));
      }
      if (report.rank === 'S') {
        pushIf(this.advanceAchievement('rank_s_agent', 1, true));
      }
    }

    return {
      report,
      profile: this.load().profile,
      progression: this.load().progression,
      newlyUnlockedAchievements: toasts,
    };
  }

  mergeFromCloud(remoteRaw: unknown): SaveDataV4 {
    const merged = mergeCloudSaveData(this.load(), remoteRaw);
    this.persist(merged);
    return this.load();
  }

  exportBackup(): string {
    return exportSaveBackupCode(this.load());
  }

  importBackup(code: string): { ok: boolean; error?: string; data?: SaveDataV4 } {
    const res = importSaveBackupCode(code, this.detectMobileHint());
    if (res.ok === false) return { ok: false, error: res.error };
    this.persist(res.data);
    return { ok: true, data: this.load() };
  }

  /**
   * Losslessly merges a Cloud Save v4 with the current local SaveDataV4,
   * persists locally AND pushes the merged superset back to Cloud Save.
   */
  applyCloudSave(remoteRaw: unknown): SaveDataV4 {
    const local = this.load();
    if (!remoteRaw || typeof remoteRaw !== 'object') {
      this.persist(local);
      return local;
    }
    const merged = mergeCloudSaveData(local, remoteRaw);
    this.persist(merged);
    return merged;
  }

  /** Helper for tests or full reset */
  resetCache(): void {
    this.cache = null;
  }
}

/**
 * Losslessly merges local Guest Save v4 with a Cloud Save v4:
 * - Takes max Survival Coins & totalCoinsEarned
 * - Unions unlocked endings, solo difficulties, perks, cosmetics, and chapters
 * - Takes best (fastest) clear times and highest achievement progress
 */
export function mergeCloudSaveData(local: SaveDataV4, remoteRaw: unknown): SaveDataV4 {
  const remote = sanitizeSaveV4(remoteRaw);
  const lp = local.progression;
  const rp = remote.progression;

  const mergedEndings = Array.from(new Set([...lp.unlockedEndings, ...rp.unlockedEndings]));
  const mergedSoloDiffs = Array.from(
    new Set([...lp.soloDifficultiesBeaten, ...rp.soloDifficultiesBeaten])
  );
  const mergedPerks = Array.from(new Set([...lp.unlockedPerks, ...rp.unlockedPerks]));
  const mergedFlashlights = Array.from(
    new Set([...lp.cosmetics.unlockedFlashlights, ...rp.cosmetics.unlockedFlashlights])
  );
  const mergedGloves = Array.from(
    new Set([...lp.cosmetics.unlockedGloves, ...rp.cosmetics.unlockedGloves])
  );
  const mergedDiddySkins = Array.from(
    new Set([...lp.cosmetics.unlockedDiddySkins, ...rp.cosmetics.unlockedDiddySkins])
  );

  const mergedAchievements = createDefaultAchievements();
  for (const def of ACHIEVEMENT_CATALOG) {
    const la = lp.achievements[def.id];
    const ra = rp.achievements[def.id];
    const progress = Math.max(la?.progress ?? 0, ra?.progress ?? 0);
    const unlocked = Boolean(la?.unlocked || ra?.unlocked || progress >= def.target);
    mergedAchievements[def.id] = {
      progress: unlocked ? def.target : progress,
      unlocked,
      unlockedAt: unlocked ? Math.min(la?.unlockedAt ?? Date.now(), ra?.unlockedAt ?? Date.now()) : null,
      claimed: Boolean(la?.claimed || ra?.claimed),
    };
  }

  const mergedCh1Diffs = Array.from(
    new Set([
      ...(local.profile.completedDifficulties['ch1'] ?? []),
      ...(remote.profile.completedDifficulties['ch1'] ?? []),
      ...mergedSoloDiffs,
    ])
  );
  const mergedTimes: Partial<Record<Difficulty, number>> = {
    ...(remote.profile.bestTimesSec['ch1'] ?? {}),
  };
  for (const [d, t] of Object.entries(local.profile.bestTimesSec['ch1'] ?? {}) as [
    Difficulty,
    number | undefined,
  ][]) {
    if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
      const prev = mergedTimes[d];
      if (prev === undefined || t < prev) mergedTimes[d] = t;
    }
  }

  return sanitizeSaveV4({
    saveVersion: SAVE_V4_VERSION,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
    profile: {
      ...local.profile,
      completedDifficulties: { ...remote.profile.completedDifficulties, ...local.profile.completedDifficulties, ch1: mergedCh1Diffs },
      bestTimesSec: { ...remote.profile.bestTimesSec, ...local.profile.bestTimesSec, ch1: mergedTimes },
      totalEscapes: Math.max(local.profile.totalEscapes, remote.profile.totalEscapes),
      totalPlaytimeSec: Math.max(local.profile.totalPlaytimeSec, remote.profile.totalPlaytimeSec),
      argSecretsSolved: Array.from(
        new Set([...local.profile.argSecretsSolved, ...remote.profile.argSecretsSolved])
      ),
    },
    settings: local.updatedAt >= remote.updatedAt ? local.settings : remote.settings,
    activeRun: local.activeRun ?? remote.activeRun,
    progression: {
      ...lp,
      survivalCoins: Math.max(lp.survivalCoins, rp.survivalCoins),
      totalCoinsEarned: Math.max(lp.totalCoinsEarned, rp.totalCoinsEarned),
      soloDifficultiesBeaten: mergedSoloDiffs,
      unlockedEndings: mergedEndings,
      unlockedPerks: mergedPerks,
      equippedPerks: lp.equippedPerks.length > 0 ? lp.equippedPerks : rp.equippedPerks,
      cosmetics: {
        unlockedFlashlights: mergedFlashlights,
        equippedFlashlight: lp.cosmetics.equippedFlashlight,
        unlockedGloves: mergedGloves,
        equippedGloves: lp.cosmetics.equippedGloves,
        unlockedDiddySkins: mergedDiddySkins,
        equippedDiddySkin: lp.cosmetics.equippedDiddySkin,
      },
      achievements: mergedAchievements,
      stats: {
        totalRuns: Math.max(lp.stats.totalRuns, rp.stats.totalRuns),
        totalStuns: Math.max(lp.stats.totalStuns, rp.stats.totalStuns),
        totalFlaresUsed: Math.max(lp.stats.totalFlaresUsed, rp.stats.totalFlaresUsed),
        totalHoldBreathSurvived: Math.max(
          lp.stats.totalHoldBreathSurvived,
          rp.stats.totalHoldBreathSurvived
        ),
        totalCrafts: Math.max(lp.stats.totalCrafts, rp.stats.totalCrafts),
        totalVhsListened: Math.max(lp.stats.totalVhsListened, rp.stats.totalVhsListened),
        totalUvMarksFound: Math.max(lp.stats.totalUvMarksFound, rp.stats.totalUvMarksFound),
        totalLightSwitchesToggled: Math.max(
          lp.stats.totalLightSwitchesToggled,
          rp.stats.totalLightSwitchesToggled
        ),
        totalVentTraversals: Math.max(lp.stats.totalVentTraversals, rp.stats.totalVentTraversals),
      },
    },
  });
}

export const saveSystem = new SaveSystem();
