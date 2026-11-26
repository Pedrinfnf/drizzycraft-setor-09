import {
  TRANSLATIONS,
  type TranslationKey,
} from './translations';
import type {
  CutsceneId,
  CutsceneSoundCue,
  DialogueStep,
  EndingId,
  Language,
  SpeakerId,
  WorldPickupType,
} from '../game/types';

// ============================================================================
// LANGUAGE CODES & NORMALIZATION
// ============================================================================

export type ShortLang = 'pt' | 'en' | 'es';
export type AnyLang = Language | ShortLang;
export type LangListener = (lang: ShortLang) => void;
export type TemplateVars = Record<string, string | number>;

const SHORT_TO_FULL: Record<ShortLang, Language> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

const FULL_TO_SHORT: Record<Language, ShortLang> = {
  'pt-BR': 'pt',
  'en-US': 'en',
  'es-ES': 'es',
};

export const SUPPORTED_SHORT_LANGS: readonly ShortLang[] = ['pt', 'en', 'es'] as const;

export function toShortLang(lang: AnyLang | string): ShortLang {
  if (lang === 'pt' || lang === 'en' || lang === 'es') return lang;
  if (lang === 'pt-BR' || lang === 'en-US' || lang === 'es-ES') {
    return FULL_TO_SHORT[lang];
  }
  const normalized = String(lang).trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  if (normalized.startsWith('es')) return 'es';
  return 'pt';
}

export function toFullLang(lang: AnyLang | string): Language {
  return SHORT_TO_FULL[toShortLang(lang)];
}

function interpolate(template: string, vars?: TemplateVars): string {
  if (!vars) return template;
  let result = template;
  for (const [k, v] of Object.entries(vars)) {
    result = result.split(`{${k}}`).join(String(v));
  }
  return result;
}

// ============================================================================
// EXTENDED GENERAL I18N STRINGS (COMPLEMENTS translations.ts WITHOUT MODIFYING IT)
// ============================================================================

const EXTENDED_PT = {
  // Security Bunker & Locations
  'location.bunker09a': 'Guarita de Vigilância (Cabine 09-A)',
  'location.courtyard': 'Pátio Interno',
  'location.westWing': 'Refeitório · Ala Oeste',
  'location.eastWing': 'Oficina · Ala Leste',
  'location.archives': 'Arquivo Morto',
  'location.infirmary': 'Enfermaria',
  'location.garage': 'Garagem Leste',
  'location.attic': 'Sótão Secreto',
  'location.basement': 'Subsolo · Nível -1',
  'location.generatorRoom': 'Sala dos Geradores',
  'location.containmentCells': 'Celas de Contenção',
  'location.chemicalStorage': 'Depósito Químico',
  'location.omegaChamber': 'Câmara Ômega',
  'location.northGate': 'Portão Norte de Saída',
  'location.level2': 'Nível -2 · Laboratórios Ômega',

  // Bunker & Telemetry UI
  'bunker.title': 'Guarita de Vigilância (Cabine 09-A)',
  'bunker.powerReserve': 'Reserva de Energia: {count}%',
  'bunker.leftDoor': 'Porta Blindada Esquerda',
  'bunker.rightDoor': 'Porta Blindada Direita',
  'bunker.remoteLure': 'Sinalizador Sonoro Remoto',
  'bunker.remoteLureReady': 'Sinalizador Remoto Pronto',
  'bunker.remoteLureCooldown': 'Recarga do Sinalizador: {sec}s',
  'bunker.sealed': 'VEDADA',
  'bunker.open': 'ABERTA',

  // Co-op / Life States / Neural Interference
  'coop.downed': 'CAÍDO · {sec}s',
  'coop.captured': 'CAPTURADO NA CELA',
  'coop.reviving': 'Reanimando {name}... ({count}%)',
  'coop.spectatingTarget': 'Observando: {name}',
  'coop.giveItemHint': 'Entregar {item} para {name}',
  'hud.neuralInterference': 'Interferência Neural',
  'hud.finalGateSiren': 'SIRENE DO PORTÃO · {sec}s',
  'hud.finalGateStage': 'Protocolo do Portão: {count}/4',
  'hud.diary': 'Diário de Lore',
  'hud.tapes': 'Fitas de Áudio',
  'hud.language': 'Idioma',

  // Journal / Diary / Tapes UI Labels
  'journal.diaryTab': 'Diário (4)',
  'journal.tapesTab': 'Fitas Áudio (2)',
  'journal.pageOf': 'Página {current}/{max}',
  'journal.playTape': 'Reproduzir Fita',
  'journal.stopTape': 'Parar Fita',
  'journal.tape1Title': 'Fita 01 · Vigia Marcos (Cabine 09-A)',
  'journal.tape2Title': 'Fita 02 · Dra. Helena (Interferência Neural)',

  // New Tool Item Translations (also served by getItemName / getItemDesc)
  'item.polaroid_camera.name': 'Câmera Polaroid',
  'item.polaroid_camera.desc': 'Flash de alta intensidade que cega e atordoa P. Drizzy por 3s e revela pistas ocultas.',
  'item.oil_can.name': 'Lata de Óleo',
  'item.oil_can.desc': 'Lubrifica dobradiças enferrujadas de portas e alavancas para abrir em silêncio absoluto.',
  'item.alarm_clock.name': 'Despertador Mecânico',
  'item.alarm_clock.desc': 'Atrai P. Drizzy para o local programado após alguns segundos com toque estridente.',
  'item.lockpick.name': 'Gazua Tática',
  'item.lockpick.desc': 'Arromba gavetas trancadas, armários de suprimentos e fechaduras simples sem fazer ruído.',
  'item.cell_key.name': 'Chave das Celas',
  'item.cell_key.desc': 'Destranca as grades das Celas de Contenção do Subsolo para resgatar aliados capturados.',
  'item.medkit.name': 'Kit Médico',
  'item.medkit.desc': 'Restaura saúde imediatamente ou reanima aliados caídos em metade do tempo.',
  'item.gas_can.name': 'Galão de Gasolina',
  'item.gas_can.desc': 'Combustível para abastecer a viatura de fuga estacionada na Garagem Leste.',
  'item.car_battery.name': 'Bateria Automotiva',
  'item.car_battery.desc': 'Bateria 12V pesada necessária para dar partida na viatura da Garagem Leste.',
  'item.garage_key.name': 'Chave da Garagem',
  'item.garage_key.desc': 'Destranca o portão metálico da Garagem Leste e libera a rota de fuga de carro.',
  'item.freq_pills.name': 'Supressor de Frequência',
  'item.freq_pills.desc': 'Reduz drasticamente a interferência neural causada pelo escuro e pela proximidade do Sujeito 09.',
  'item.emblem_sun.name': 'Emblema do Sol',
  'item.emblem_sun.desc': 'Medalhão dourado. Encaixe junto ao Emblema da Lua na Estante Falsa do Arquivo Morto.',
  'item.emblem_moon.name': 'Emblema da Lua',
  'item.emblem_moon.desc': 'Medalhão prateado. Encaixe junto ao Emblema do Sol na Estante Falsa do Arquivo Morto.',
  'item.yellow_key.name': 'Chave Amarela',
  'item.yellow_key.desc': 'Destranca a Porta Amarela da ala de manutenção do Setor 09.',
  'item.flashlight_uv.name': 'Lanterna Voxel (Modo UV)',
  'item.flashlight_uv.desc': 'Feixe ultravioleta que revela cifras ocultas, pegadas químicas e marcações do Projeto Ômega.',
  'item.cassette.name': 'Fita Cassete',
  'item.cassette.desc': 'Registro de áudio magnético contendo instruções e segredos do Setor 09.',
} as const;

export type ExtendedI18nKey = keyof typeof EXTENDED_PT;
export type I18nKey = TranslationKey | ExtendedI18nKey;

const EXTENDED_EN: Record<ExtendedI18nKey, string> = {
  // Security Bunker & Locations
  'location.bunker09a': 'Security Bunker (Cabin 09-A)',
  'location.courtyard': 'Inner Courtyard',
  'location.westWing': 'Cafeteria · West Wing',
  'location.eastWing': 'Workshop · East Wing',
  'location.archives': 'Dead Archive',
  'location.infirmary': 'Infirmary',
  'location.garage': 'East Garage',
  'location.attic': 'Secret Attic',
  'location.basement': 'Basement · Level -1',
  'location.generatorRoom': 'Generator Room',
  'location.containmentCells': 'Containment Cells',
  'location.chemicalStorage': 'Chemical Storage',
  'location.omegaChamber': 'Omega Chamber',
  'location.northGate': 'North Exit Gate',
  'location.level2': 'Level -2 · Omega Labs',

  // Bunker & Telemetry UI
  'bunker.title': 'Security Bunker (Cabin 09-A)',
  'bunker.powerReserve': 'Power Reserve: {count}%',
  'bunker.leftDoor': 'Left Blast Door',
  'bunker.rightDoor': 'Right Blast Door',
  'bunker.remoteLure': 'Remote Acoustic Lure',
  'bunker.remoteLureReady': 'Remote Lure Ready',
  'bunker.remoteLureCooldown': 'Lure Cooldown: {sec}s',
  'bunker.sealed': 'SEALED',
  'bunker.open': 'OPEN',

  // Co-op / Life States / Neural Interference
  'coop.downed': 'DOWNED · {sec}s',
  'coop.captured': 'CAPTURED IN CELL',
  'coop.reviving': 'Reviving {name}... ({count}%)',
  'coop.spectatingTarget': 'Spectating: {name}',
  'coop.giveItemHint': 'Give {item} to {name}',
  'hud.neuralInterference': 'Neural Interference',
  'hud.finalGateSiren': 'GATE SIREN · {sec}s',
  'hud.finalGateStage': 'Gate Protocol: {count}/4',
  'hud.diary': 'Lore Diary',
  'hud.tapes': 'Audio Tapes',
  'hud.language': 'Language',

  // Journal / Diary / Tapes UI Labels
  'journal.diaryTab': 'Diary (4)',
  'journal.tapesTab': 'Audio Tapes (2)',
  'journal.pageOf': 'Page {current}/{max}',
  'journal.playTape': 'Play Tape',
  'journal.stopTape': 'Stop Tape',
  'journal.tape1Title': 'Tape 01 · Guard Marcos (Cabin 09-A)',
  'journal.tape2Title': 'Tape 02 · Dr. Helena (Neural Interference)',

  // New Tool Item Translations
  'item.polaroid_camera.name': 'Polaroid Camera',
  'item.polaroid_camera.desc': 'High-intensity flash that blinds and stuns P. Drizzy for 3s and reveals hidden clues.',
  'item.oil_can.name': 'Oil Can',
  'item.oil_can.desc': 'Lubricates rusted door hinges and levers so they open in complete silence.',
  'item.alarm_clock.name': 'Alarm Clock',
  'item.alarm_clock.desc': 'Lures P. Drizzy to the armed spot after a few seconds with a loud mechanical ring.',
  'item.lockpick.name': 'Tactical Lockpick',
  'item.lockpick.desc': 'Quietly picks locked drawers, supply cabinets, and simple latches without making noise.',
  'item.cell_key.name': 'Cell Key',
  'item.cell_key.desc': 'Unlocks the Basement Containment Cell bars to rescue captured teammates.',
  'item.medkit.name': 'Medkit',
  'item.medkit.desc': 'Immediately restores health or revives downed teammates in half the time.',
  'item.gas_can.name': 'Gas Can',
  'item.gas_can.desc': 'Fuel canister needed to fill the getaway patrol car parked in the East Garage.',
  'item.car_battery.name': 'Car Battery',
  'item.car_battery.desc': 'Heavy 12V battery required to start the getaway car in the East Garage.',
  'item.garage_key.name': 'Garage Key',
  'item.garage_key.desc': 'Unlocks the East Garage metal shutter to open the getaway car escape route.',
  'item.freq_pills.name': 'Frequency Suppressor',
  'item.freq_pills.desc': 'Drastically lowers neural interference caused by pitch darkness and Subject 09 proximity.',
  'item.emblem_sun.name': 'Sun Emblem',
  'item.emblem_sun.desc': 'Golden medallion. Socket it alongside the Moon Emblem on the Dead Archive False Bookshelf.',
  'item.emblem_moon.name': 'Moon Emblem',
  'item.emblem_moon.desc': 'Silver medallion. Socket it alongside the Sun Emblem on the Dead Archive False Bookshelf.',
  'item.yellow_key.name': 'Yellow Key',
  'item.yellow_key.desc': 'Unlocks the Yellow Door to the Sector 09 maintenance wing.',
  'item.flashlight_uv.name': 'Voxel Flashlight (UV Mode)',
  'item.flashlight_uv.desc': 'Ultraviolet beam that reveals hidden ciphers, chemical footprints, and Project Omega markings.',
  'item.cassette.name': 'Cassette Tape',
  'item.cassette.desc': 'Magnetic audio recording containing instructions and classified Sector 09 logs.',
};

const EXTENDED_ES: Record<ExtendedI18nKey, string> = {
  // Security Bunker & Locations
  'location.bunker09a': 'Caseta de Vigilancia (Cabina 09-A)',
  'location.courtyard': 'Patio Interno',
  'location.westWing': 'Cafetería · Ala Oeste',
  'location.eastWing': 'Taller · Ala Este',
  'location.archives': 'Archivo Muerto',
  'location.infirmary': 'Enfermería',
  'location.garage': 'Garaje Este',
  'location.attic': 'Ático Secreto',
  'location.basement': 'Sótano · Nivel -1',
  'location.generatorRoom': 'Sala de Generadores',
  'location.containmentCells': 'Celdas de Contención',
  'location.chemicalStorage': 'Depósito Químico',
  'location.omegaChamber': 'Cámara Omega',
  'location.northGate': 'Portón Norte de Salida',
  'location.level2': 'Nivel -2 · Laboratorios Omega',

  // Bunker & Telemetry UI
  'bunker.title': 'Caseta de Vigilancia (Cabina 09-A)',
  'bunker.powerReserve': 'Reserva de Energía: {count}%',
  'bunker.leftDoor': 'Puerta Blindada Izquierda',
  'bunker.rightDoor': 'Puerta Blindada Derecha',
  'bunker.remoteLure': 'Señuelo Acústico Remoto',
  'bunker.remoteLureReady': 'Señuelo Remoto Listo',
  'bunker.remoteLureCooldown': 'Recarga del Señuelo: {sec}s',
  'bunker.sealed': 'SELLADA',
  'bunker.open': 'ABIERTA',

  // Co-op / Life States / Neural Interference
  'coop.downed': 'DERRIBADO · {sec}s',
  'coop.captured': 'CAPTURADO EN CELDA',
  'coop.reviving': 'Reanimando a {name}... ({count}%)',
  'coop.spectatingTarget': 'Observando: {name}',
  'coop.giveItemHint': 'Entregar {item} a {name}',
  'hud.neuralInterference': 'Interferencia Neural',
  'hud.finalGateSiren': 'SIRENA DEL PORTÓN · {sec}s',
  'hud.finalGateStage': 'Protocolo del Portón: {count}/4',
  'hud.diary': 'Diario de Lore',
  'hud.tapes': 'Cintas de Audio',
  'hud.language': 'Idioma',

  // Journal / Diary / Tapes UI Labels
  'journal.diaryTab': 'Diario (4)',
  'journal.tapesTab': 'Cintas Audio (2)',
  'journal.pageOf': 'Página {current}/{max}',
  'journal.playTape': 'Reproducir Cinta',
  'journal.stopTape': 'Detener Cinta',
  'journal.tape1Title': 'Cinta 01 · Guardia Marcos (Cabina 09-A)',
  'journal.tape2Title': 'Cinta 02 · Dra. Helena (Interferencia Neural)',

  // New Tool Item Translations
  'item.polaroid_camera.name': 'Cámara Polaroid',
  'item.polaroid_camera.desc': 'Flash de alta intensidad que ciega y aturde a P. Drizzy por 3s y revela pistas ocultas.',
  'item.oil_can.name': 'Aceitera',
  'item.oil_can.desc': 'Lubrica bisagras oxidadas de puertas y palancas para abrirlas en completo silencio.',
  'item.alarm_clock.name': 'Despertador Mecánico',
  'item.alarm_clock.desc': 'Atrae a P. Drizzy al lugar armado tras unos segundos con un timbre estridente.',
  'item.lockpick.name': 'Ganzúa Táctica',
  'item.lockpick.desc': 'Fuerza cajones cerrados, armarios de suministros y cerraduras simples sin hacer ruido.',
  'item.cell_key.name': 'Llave de las Celdas',
  'item.cell_key.desc': 'Abre las rejas de las Celdas de Contención del Sótano para rescatar aliados capturados.',
  'item.medkit.name': 'Botiquín Médico',
  'item.medkit.desc': 'Restaura salud al instante o reanima a aliados caídos en la mitad de tiempo.',
  'item.gas_can.name': 'Bidón de Gasolina',
  'item.gas_can.desc': 'Combustible necesario para llenar el vehículo de huida en el Garaje Este.',
  'item.car_battery.name': 'Batería de Auto',
  'item.car_battery.desc': 'Batería pesada de 12V necesaria para arrancar el auto de huida en el Garaje Este.',
  'item.garage_key.name': 'Llave del Garaje',
  'item.garage_key.desc': 'Abre el portón metálico del Garaje Este y habilita la ruta de escape en vehículo.',
  'item.freq_pills.name': 'Supresor de Frecuencia',
  'item.freq_pills.desc': 'Reduce drásticamente la interferencia neural causada por la oscuridad y la cercanía del Sujeto 09.',
  'item.emblem_sun.name': 'Emblema del Sol',
  'item.emblem_sun.desc': 'Medallón dorado. Colócalo junto al Emblema de la Luna en la Estantería Falsa del Archivo Muerto.',
  'item.emblem_moon.name': 'Emblema de la Luna',
  'item.emblem_moon.desc': 'Medallón plateado. Colócalo junto al Emblema del Sol en la Estantería Falsa del Archivo Muerto.',
  'item.yellow_key.name': 'Llave Amarilla',
  'item.yellow_key.desc': 'Abre la Puerta Amarilla del ala de mantenimiento del Sector 09.',
  'item.flashlight_uv.name': 'Linterna Voxel (Modo UV)',
  'item.flashlight_uv.desc': 'Haz ultravioleta que revela cifras ocultas, huellas químicas y marcas del Proyecto Omega.',
  'item.cassette.name': 'Cinta de Casete',
  'item.cassette.desc': 'Grabación de audio magnética con instrucciones y secretos clasificados del Sector 09.',
};

const EXTENDED_DICTS: Record<ShortLang, Record<ExtendedI18nKey, string>> = {
  pt: EXTENDED_PT,
  en: EXTENDED_EN,
  es: EXTENDED_ES,
};

/** Complete list of all 29 WorldPickupType IDs (27 ItemType + battery + stun_ammo) */
export const ALL_ITEM_IDS: readonly WorldPickupType[] = [
  'flashlight',
  'stun_gun',
  'stun_ammo',
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
  'battery',
  'polaroid_camera',
  'oil_can',
  'alarm_clock',
  'lockpick',
  'cell_key',
  'medkit',
  'gas_can',
  'car_battery',
  'garage_key',
  'freq_pills',
  'emblem_sun',
  'emblem_moon',
] as const;

// ============================================================================
// 3D INTERACTION PROMPTS (DOORS, LOCKS, TOOLS, PUZZLES, CO-OP, BUNKER)
// ============================================================================

const PROMPTS_PT = {
  // Doors (Open / Close / Named Doors)
  door_open: 'Abrir {name}',
  door_close: 'Fechar {name}',
  door_blue: 'Abrir Porta Azul (Enfermaria)',
  door_red: 'Abrir Porta Vermelha (Arquivo Morto)',
  door_yellow: 'Abrir Porta Amarela (Manutenção)',
  door_garage: 'Abrir Portão da Garagem Leste',
  door_basement: 'Abrir Grade do Subsolo',
  door_bunker: 'Acionar Porta Blindada · Cabine 09-A',
  door_bunker_close_left: 'Fechar Porta Blindada Esquerda (Cabine 09-A)',
  door_bunker_open_left: 'Abrir Porta Blindada Esquerda (Cabine 09-A)',
  door_bunker_close_right: 'Fechar Porta Blindada Direita (Cabine 09-A)',
  door_bunker_open_right: 'Abrir Porta Blindada Direita (Cabine 09-A)',
  door_final_gate: 'Abrir Portão Norte de Saída',

  // Unlock Actions (When player holds the required key/tool)
  door_unlock_blue: 'Destrancar Porta Azul (Chave Azul)',
  door_unlock_red: 'Destrancar Porta Vermelha (Chave Vermelha)',
  door_unlock_yellow: 'Destrancar Porta Amarela (Chave Amarela)',
  door_unlock_garage: 'Destrancar Garagem (Chave da Garagem)',
  door_unlock_basement: 'Destrancar Grade do Subsolo (Chave do Subsolo)',
  door_unlock_cell: 'Destrancar Cela de Contenção (Chave das Celas)',
  door_unlock_master: 'Destrancar Portão Norte (Chave Mestra)',

  // Locked States
  locked_blue_key: 'Trancada — Requer Chave Azul',
  locked_red_key: 'Trancada — Requer Chave Vermelha',
  locked_yellow_key: 'Trancada — Requer Chave Amarela',
  locked_garage_key: 'Trancada — Requer Chave da Garagem',
  locked_basement_key: 'Trancada — Requer Chave do Subsolo',
  locked_cell_key: 'Trancada — Requer Chave das Celas',
  locked_master_key: 'Trancada — Requer Chave Mestra',
  locked_crowbar: 'Bloqueada por Tábuas — Requer Pé de Cabra',
  locked_wire_cutters: 'Acorrentada — Requer Alicate de Corte',
  locked_lockpick: 'Trancada — Requer Gazua Tática',
  locked_bunker_power: 'Sem Energia na Guarita de Vigilância (Cabine 09-A)',
  locked_generic: 'Trancada — Requer {item}',

  // Tools & World Mechanisms
  use_crowbar: 'Arrancar Tábuas com Pé de Cabra',
  use_wire_cutters: 'Cortar Correntes com Alicate de Corte',
  use_oil_can: 'Lubrificar Dobradiças com Lata de Óleo (Silencioso)',
  use_polaroid: 'Disparar Flash da Câmera Polaroid',
  use_polaroid_clue: 'Fotografar Pista Oculta com Câmera Polaroid',
  use_alarm_clock: 'Armar Despertador Mecânico',
  use_lockpick: 'Arrombar Fechadura com Gazua Tática',
  use_medkit: 'Usar Kit Médico',
  use_freq_pills: 'Tomar Supressor de Frequência',
  install_car_battery: 'Instalar Bateria Automotiva na Viatura',
  pour_gas_can: 'Abastecer Viatura com Galão de Gasolina',
  car_escape: 'Ligar Viatura e Fugir pela Garagem Leste!',
  car_needs_parts: 'Viatura Incompleta — Requer Bateria, Gasolina e Chave da Garagem',
  install_fuse: 'Instalar Fusível Industrial no Gerador ({count}/2)',
  generator_lever: 'Acionar Alavanca do Gerador Principal',
  false_bookshelf: 'Inspecionar Estante Falsa (Requer Emblemas do Sol e da Lua)',
  place_emblem_sun: 'Encaixar Emblema do Sol na Estante Falsa',
  place_emblem_moon: 'Encaixar Emblema da Lua na Estante Falsa',
  false_bookshelf_open: 'Passagem Secreta da Estante Aberta',
  piano_play: 'Tocar Tecla do Piano ({name})',
  piano_inspect: 'Examinar Piano Antigo (Sequência Musical)',
  steam_valve: 'Fechar Válvula de Vapor ({count}/3)',
  final_gate_lever: 'Acionar Alavanca Hidráulica do Portão Norte (Sirene 15s!)',
  final_gate_siren: 'Portão Subindo — Resista à Sirene ({sec}s)',
  final_gate_incomplete: 'Protocolo do Portão Incompleto ({count}/4 Etapas)',

  // Co-op Interactions
  revive_ally: 'Reanimar {name} (Segure Interagir)',
  rescue_ally: 'Resgatar {name} da Cela de Contenção',
  give_item: 'Entregar {item} para {name}',

  // Pickups, Hiding, Furniture, Puzzles & Security Bunker
  pickup_item: 'Pegar {item}',
  hide_locker: 'Esconder no Armário Metálico',
  hide_under_table: 'Esconder Debaixo da Mesa',
  hide_under_bed: 'Esconder Debaixo da Maca',
  unhide: 'Sair do Esconderijo',
  drawer_open: 'Abrir Gaveta',
  drawer_close: 'Fechar Gaveta',
  drawer_locked: 'Gaveta Trancada — Requer Gazua Tática',
  safe_open: 'Abrir Cofre Digital (4 Dígitos)',
  safe_unlocked: 'Cofre Já Aberto',
  terminal_open: 'Acessar Terminal Ômega (5 Dígitos)',
  terminal_locked: 'Terminal Ômega Bloqueado — Mapeie as Cifras UV',
  bunker_monitor: 'Abrir Monitor CFTV · Guarita de Vigilância (Cabine 09-A)',
  bunker_remote_lure: 'Acionar Sinalizador Sonoro Remoto (Cabine 09-A)',
  bunker_lure_cooldown: 'Sinalizador Remoto em Recarga ({sec}s)',
  workbench: 'Usar Bancada de Craft',
  recharge_station: 'Recarregar Lanterna na Estação',
  cassette_play: 'Tocar Fita: {name}',
  cassette_replay: 'Reouvir Fita: {name}',
  diary_read: 'Ler Página do Diário: {name}',
  clue_inspect: 'Examinar Bilhete de Auditoria',
  uv_mark_inspect: 'Registrar Cifra UV',
  translation_board: 'Consultar Quadro de Tradução UV',
  level2_hatch: 'Abrir Escotilha Blindada do Nível -2',
  light_switch_on: 'Acender Luz da Sala',
  light_switch_off: 'Apagar Luz da Sala',
} as const;

export type PromptKind = keyof typeof PROMPTS_PT;

const PROMPTS_EN: Record<PromptKind, string> = {
  // Doors
  door_open: 'Open {name}',
  door_close: 'Close {name}',
  door_blue: 'Open Blue Door (Infirmary)',
  door_red: 'Open Red Door (Dead Archive)',
  door_yellow: 'Open Yellow Door (Maintenance)',
  door_garage: 'Open East Garage Shutter',
  door_basement: 'Open Basement Grate',
  door_bunker: 'Toggle Blast Door · Cabin 09-A',
  door_bunker_close_left: 'Close Left Blast Door (Cabin 09-A)',
  door_bunker_open_left: 'Open Left Blast Door (Cabin 09-A)',
  door_bunker_close_right: 'Close Right Blast Door (Cabin 09-A)',
  door_bunker_open_right: 'Open Right Blast Door (Cabin 09-A)',
  door_final_gate: 'Open North Exit Gate',

  // Unlock Actions
  door_unlock_blue: 'Unlock Blue Door (Blue Key)',
  door_unlock_red: 'Unlock Red Door (Red Key)',
  door_unlock_yellow: 'Unlock Yellow Door (Yellow Key)',
  door_unlock_garage: 'Unlock Garage (Garage Key)',
  door_unlock_basement: 'Unlock Basement Grate (Basement Key)',
  door_unlock_cell: 'Unlock Containment Cell (Cell Key)',
  door_unlock_master: 'Unlock North Gate (Master Key)',

  // Locked States
  locked_blue_key: 'Locked — Requires Blue Key',
  locked_red_key: 'Locked — Requires Red Key',
  locked_yellow_key: 'Locked — Requires Yellow Key',
  locked_garage_key: 'Locked — Requires Garage Key',
  locked_basement_key: 'Locked — Requires Basement Key',
  locked_cell_key: 'Locked — Requires Cell Key',
  locked_master_key: 'Locked — Requires Master Key',
  locked_crowbar: 'Boarded Up — Requires Crowbar',
  locked_wire_cutters: 'Chained Shut — Requires Wire Cutters',
  locked_lockpick: 'Locked — Requires Tactical Lockpick',
  locked_bunker_power: 'No Power in Security Bunker (Cabin 09-A)',
  locked_generic: 'Locked — Requires {item}',

  // Tools & World Mechanisms
  use_crowbar: 'Pry Planks with Crowbar',
  use_wire_cutters: 'Cut Chains with Wire Cutters',
  use_oil_can: 'Oil Hinges with Oil Can (Silent)',
  use_polaroid: 'Fire Polaroid Camera Flash',
  use_polaroid_clue: 'Photograph Hidden Clue with Polaroid Camera',
  use_alarm_clock: 'Arm Mechanical Alarm Clock',
  use_lockpick: 'Pick Lock with Tactical Lockpick',
  use_medkit: 'Use Medkit',
  use_freq_pills: 'Take Frequency Suppressor',
  install_car_battery: 'Install Car Battery in Getaway Car',
  pour_gas_can: 'Fuel Getaway Car with Gas Can',
  car_escape: 'Start Getaway Car & Escape via East Garage!',
  car_needs_parts: 'Car Incomplete — Needs Battery, Gas Can & Garage Key',
  install_fuse: 'Install Industrial Fuse in Generator ({count}/2)',
  generator_lever: 'Pull Main Generator Lever',
  false_bookshelf: 'Inspect False Bookshelf (Needs Sun & Moon Emblems)',
  place_emblem_sun: 'Insert Sun Emblem into False Bookshelf',
  place_emblem_moon: 'Insert Moon Emblem into False Bookshelf',
  false_bookshelf_open: 'False Bookshelf Secret Passage Open',
  piano_play: 'Play Piano Key ({name})',
  piano_inspect: 'Examine Antique Piano (Musical Sequence)',
  steam_valve: 'Close Steam Valve ({count}/3)',
  final_gate_lever: 'Pull North Gate Hydraulic Lever (15s Siren!)',
  final_gate_siren: 'Gate Rising — Survive the Siren ({sec}s)',
  final_gate_incomplete: 'Gate Protocol Incomplete ({count}/4 Stages)',

  // Co-op Interactions
  revive_ally: 'Revive {name} (Hold Interact)',
  rescue_ally: 'Rescue {name} from Containment Cell',
  give_item: 'Give {item} to {name}',

  // Pickups, Hiding, Furniture, Puzzles & Security Bunker
  pickup_item: 'Pick up {item}',
  hide_locker: 'Hide inside Metal Locker',
  hide_under_table: 'Hide under Table',
  hide_under_bed: 'Hide under Medical Bed',
  unhide: 'Exit Hiding Spot',
  drawer_open: 'Open Drawer',
  drawer_close: 'Close Drawer',
  drawer_locked: 'Locked Drawer — Requires Tactical Lockpick',
  safe_open: 'Open Digital Safe (4 Digits)',
  safe_unlocked: 'Safe Already Unlocked',
  terminal_open: 'Access Omega Terminal (5 Digits)',
  terminal_locked: 'Omega Terminal Locked — Map the UV Ciphers',
  bunker_monitor: 'Open CCTV Monitor · Security Bunker (Cabin 09-A)',
  bunker_remote_lure: 'Trigger Remote Acoustic Lure (Cabin 09-A)',
  bunker_lure_cooldown: 'Remote Lure Recharging ({sec}s)',
  workbench: 'Use Crafting Workbench',
  recharge_station: 'Recharge Flashlight at Station',
  cassette_play: 'Play Tape: {name}',
  cassette_replay: 'Replay Tape: {name}',
  diary_read: 'Read Diary Page: {name}',
  clue_inspect: 'Inspect Audit Note',
  uv_mark_inspect: 'Record UV Cipher',
  translation_board: 'Consult UV Translation Board',
  level2_hatch: 'Open Armored Level -2 Hatch',
  light_switch_on: 'Turn Room Light On',
  light_switch_off: 'Turn Room Light Off',
};

const PROMPTS_ES: Record<PromptKind, string> = {
  // Doors
  door_open: 'Abrir {name}',
  door_close: 'Cerrar {name}',
  door_blue: 'Abrir Puerta Azul (Enfermería)',
  door_red: 'Abrir Puerta Roja (Archivo Muerto)',
  door_yellow: 'Abrir Puerta Amarilla (Mantenimiento)',
  door_garage: 'Abrir Portón del Garaje Este',
  door_basement: 'Abrir Reja del Sótano',
  door_bunker: 'Accionar Puerta Blindada · Cabina 09-A',
  door_bunker_close_left: 'Cerrar Puerta Blindada Izquierda (Cabina 09-A)',
  door_bunker_open_left: 'Abrir Puerta Blindada Izquierda (Cabina 09-A)',
  door_bunker_close_right: 'Cerrar Puerta Blindada Derecha (Cabina 09-A)',
  door_bunker_open_right: 'Abrir Puerta Blindada Derecha (Cabina 09-A)',
  door_final_gate: 'Abrir Portón Norte de Salida',

  // Unlock Actions
  door_unlock_blue: 'Abrir Puerta Azul (Llave Azul)',
  door_unlock_red: 'Abrir Puerta Roja (Llave Roja)',
  door_unlock_yellow: 'Abrir Puerta Amarilla (Llave Amarilla)',
  door_unlock_garage: 'Abrir Garaje (Llave del Garaje)',
  door_unlock_basement: 'Abrir Reja del Sótano (Llave del Sótano)',
  door_unlock_cell: 'Abrir Celda de Contención (Llave de las Celdas)',
  door_unlock_master: 'Abrir Portón Norte (Llave Maestra)',

  // Locked States
  locked_blue_key: 'Cerrada — Requiere Llave Azul',
  locked_red_key: 'Cerrada — Requiere Llave Roja',
  locked_yellow_key: 'Cerrada — Requiere Llave Amarilla',
  locked_garage_key: 'Cerrada — Requiere Llave del Garaje',
  locked_basement_key: 'Cerrada — Requiere Llave del Sótano',
  locked_cell_key: 'Cerrada — Requiere Llave de las Celdas',
  locked_master_key: 'Cerrada — Requiere Llave Maestra',
  locked_crowbar: 'Bloqueada con Tablas — Requiere Palanca',
  locked_wire_cutters: 'Encadenada — Requiere Cizalla',
  locked_lockpick: 'Cerrada — Requiere Ganzúa Táctica',
  locked_bunker_power: 'Sin Energía en la Caseta de Vigilancia (Cabina 09-A)',
  locked_generic: 'Cerrada — Requiere {item}',

  // Tools & World Mechanisms
  use_crowbar: 'Arrancar Tablas con Palanca',
  use_wire_cutters: 'Cortar Cadenas con Cizalla',
  use_oil_can: 'Lubricar Bisagras con Aceitera (Silencioso)',
  use_polaroid: 'Disparar Flash de Cámara Polaroid',
  use_polaroid_clue: 'Fotografiar Pista Oculta con Cámara Polaroid',
  use_alarm_clock: 'Armar Despertador Mecánico',
  use_lockpick: 'Forzar Cerradura con Ganzúa Táctica',
  use_medkit: 'Usar Botiquín Médico',
  use_freq_pills: 'Tomar Supresor de Frecuencia',
  install_car_battery: 'Instalar Batería en el Vehículo',
  pour_gas_can: 'Llenar Tanque con Bidón de Gasolina',
  car_escape: '¡Arrancar Auto y Escapar por el Garaje Este!',
  car_needs_parts: 'Auto Incompleto — Falta Batería, Gasolina y Llave del Garaje',
  install_fuse: 'Instalar Fusible Industrial en el Generador ({count}/2)',
  generator_lever: 'Accionar Palanca del Generador Principal',
  false_bookshelf: 'Examinar Estantería Falsa (Requiere Emblemas Sol y Luna)',
  place_emblem_sun: 'Colocar Emblema del Sol en la Estantería Falsa',
  place_emblem_moon: 'Colocar Emblema de la Luna en la Estantería Falsa',
  false_bookshelf_open: 'Pasadizo Secreto de la Estantería Abierto',
  piano_play: 'Tocar Tecla del Piano ({name})',
  piano_inspect: 'Examinar Piano Antiguo (Secuencia Musical)',
  steam_valve: 'Cerrar Válvula de Vapor ({count}/3)',
  final_gate_lever: 'Accionar Palanca Hidráulica del Portón Norte (¡Sirena 15s!)',
  final_gate_siren: 'Portón Subiendo — Resiste la Sirena ({sec}s)',
  final_gate_incomplete: 'Protocolo del Portón Incompleto ({count}/4 Etapas)',

  // Co-op Interactions
  revive_ally: 'Reanimar a {name} (Mantén Interactuar)',
  rescue_ally: 'Rescatar a {name} de la Celda de Contención',
  give_item: 'Entregar {item} a {name}',

  // Pickups, Hiding, Furniture, Puzzles & Security Bunker
  pickup_item: 'Recoger {item}',
  hide_locker: 'Esconderse en el Casillero Metálico',
  hide_under_table: 'Esconderse Debajo de la Mesa',
  hide_under_bed: 'Esconderse Debajo de la Camilla',
  unhide: 'Salir del Escondite',
  drawer_open: 'Abrir Cajón',
  drawer_close: 'Cerrar Cajón',
  drawer_locked: 'Cajón Cerrado — Requiere Ganzúa Táctica',
  safe_open: 'Abrir Caja Fuerte Digital (4 Dígitos)',
  safe_unlocked: 'Caja Fuerte Ya Abierta',
  terminal_open: 'Acceder al Terminal Omega (5 Dígitos)',
  terminal_locked: 'Terminal Omega Bloqueado — Mapea las Cifras UV',
  bunker_monitor: 'Abrir Monitor CCTV · Caseta de Vigilancia (Cabina 09-A)',
  bunker_remote_lure: 'Activar Señuelo Acústico Remoto (Cabina 09-A)',
  bunker_lure_cooldown: 'Señuelo Remoto en Recarga ({sec}s)',
  workbench: 'Usar Banco de Crafteo',
  recharge_station: 'Recargar Linterna en la Estación',
  cassette_play: 'Reproducir Cinta: {name}',
  cassette_replay: 'Volver a Escuchar Cinta: {name}',
  diary_read: 'Leer Página del Diario: {name}',
  clue_inspect: 'Examinar Nota de Auditoría',
  uv_mark_inspect: 'Registrar Cifra UV',
  translation_board: 'Consultar Tablero de Traducción UV',
  level2_hatch: 'Abrir Escotilla Blindada del Nivel -2',
  light_switch_on: 'Encender Luz de la Sala',
  light_switch_off: 'Apagar Luz de la Sala',
};

const PROMPT_DICTS: Record<ShortLang, Record<PromptKind, string>> = {
  pt: PROMPTS_PT,
  en: PROMPTS_EN,
  es: PROMPTS_ES,
};

// ============================================================================
// HUD OBJECTIVES
// ============================================================================

const OBJECTIVES_PT = {
  explore_sector09: 'Explore o Setor 09 e procure chaves, ferramentas e pistas do Vigia Marcos.',
  reach_bunker_09a: 'Abrigue-se na Guarita de Vigilância (Cabine 09-A) e verifique o Monitor CFTV.',
  find_basement_key: 'Encontre a Chave do Subsolo para descer ao Nível -1.',
  restore_power_blackout: 'BLECAUTE ATIVO! Encontre os Fusíveis Industriais e religue o Gerador no Subsolo.',
  install_fuses: 'Instale os Fusíveis Industriais na Sala dos Geradores ({count}/2).',
  cut_chains: 'Corte as correntes de aço com o Alicate de Corte ({count}/2).',
  find_safe_clues: 'Colete os bilhetes do Cofre Subterrâneo ({count}/4).',
  unlock_safe: 'Abra o Cofre do Subsolo para recuperar a Chave Mestra.',
  find_master_key: 'Recupere a Chave Mestra e a senha do Portão Norte.',
  final_gate_protocol: 'Complete o Protocolo do Portão Norte ({count}/4 etapas concluídas).',
  survive_final_gate_siren: 'SIRENE ATIVA! Sobreviva por {sec}s enquanto o Portão Norte sobe!',
  escape_north_gate: 'Portão Norte aberto! Corra para a estrada e escape do Setor 09!',
  escape_garage_car: 'Rota da Garagem: instale Bateria, Gasolina e destranque com a Chave ({count}/3).',
  solve_false_bookshelf: 'Encaixe os Emblemas do Sol e da Lua na Estante Falsa ({count}/2).',
  solve_piano_puzzle: 'Toque a sequência correta no Piano Antigo para liberar a trava secreta.',
  close_steam_valves: 'Feche as válvulas de vapor superaquecidas no Subsolo ({count}/3).',
  rescue_marcos_level2: 'Ouça o rádio do Vigia Marcos e abra a Escotilha do Nível -2.',
  unlock_omega_terminal: 'Traduza as cifras UV e desbloqueie o Terminal Ômega (5 dígitos).',
  revive_teammate: 'Aliado caído! Corra para reanimar {name} antes que o tempo acabe!',
  rescue_captured_teammate: '{name} foi capturado! Use a Chave das Celas no Subsolo para resgatar.',
  wait_for_revive: 'Você está caído ({sec}s)! Aguarde um aliado reanimar você.',
  spectating_ally: 'Modo Espectador — Acompanhando {name}.',
  hide_from_drizzy: 'P. Drizzy está por perto! Esconda-se ou quebre a linha de visão.',
} as const;

export type ObjectiveKey = keyof typeof OBJECTIVES_PT;

const OBJECTIVES_EN: Record<ObjectiveKey, string> = {
  explore_sector09: 'Explore Sector 09 and search for keys, tools, and Guard Marcos’s clues.',
  reach_bunker_09a: 'Take shelter in the Security Bunker (Cabin 09-A) and check the CCTV Monitor.',
  find_basement_key: 'Find the Basement Key to descend to Level -1.',
  restore_power_blackout: 'BLACKOUT ACTIVE! Find the Industrial Fuses and restore the Basement Generator.',
  install_fuses: 'Install Industrial Fuses in the Generator Room ({count}/2).',
  cut_chains: 'Cut the steel chains with the Wire Cutters ({count}/2).',
  find_safe_clues: 'Collect the Basement Safe audit notes ({count}/4).',
  unlock_safe: 'Unlock the Basement Safe to retrieve the Master Key.',
  find_master_key: 'Retrieve the Master Key and the North Gate security code.',
  final_gate_protocol: 'Complete the North Gate Protocol ({count}/4 stages complete).',
  survive_final_gate_siren: 'SIREN ACTIVE! Survive for {sec}s while the North Gate rises!',
  escape_north_gate: 'North Gate is open! Sprint to the road and escape Sector 09!',
  escape_garage_car: 'Garage Route: install Car Battery, Gas Can, and unlock with Garage Key ({count}/3).',
  solve_false_bookshelf: 'Socket the Sun and Moon Emblems into the False Bookshelf ({count}/2).',
  solve_piano_puzzle: 'Play the correct sequence on the Antique Piano to release the hidden latch.',
  close_steam_valves: 'Shut down the overheated steam valves in the Basement ({count}/3).',
  rescue_marcos_level2: 'Listen to Guard Marcos’s radio and open the Level -2 Armored Hatch.',
  unlock_omega_terminal: 'Decode the UV ciphers and unlock the 5-digit Omega Terminal.',
  revive_teammate: 'Teammate down! Rush to revive {name} before time runs out!',
  rescue_captured_teammate: '{name} was captured! Use the Cell Key in the Basement to rescue them.',
  wait_for_revive: 'You are downed ({sec}s)! Wait for a teammate to revive you.',
  spectating_ally: 'Spectator Mode — Watching {name}.',
  hide_from_drizzy: 'P. Drizzy is hunting nearby! Hide or break line of sight.',
};

const OBJECTIVES_ES: Record<ObjectiveKey, string> = {
  explore_sector09: 'Explora el Sector 09 y busca llaves, herramientas y pistas del Guardia Marcos.',
  reach_bunker_09a: 'Refúgiate en la Caseta de Vigilancia (Cabina 09-A) y revisa el Monitor CCTV.',
  find_basement_key: 'Encuentra la Llave del Sótano para bajar al Nivel -1.',
  restore_power_blackout: '¡APAGÓN ACTIVO! Encuentra los Fusibles Industriales y restaura el Generador del Sótano.',
  install_fuses: 'Instala los Fusibles Industriales en la Sala de Generadores ({count}/2).',
  cut_chains: 'Corta las cadenas de acero con la Cizalla ({count}/2).',
  find_safe_clues: 'Recoge las notas de la Caja Fuerte del Sótano ({count}/4).',
  unlock_safe: 'Abre la Caja Fuerte del Sótano para recuperar la Llave Maestra.',
  find_master_key: 'Consigue la Llave Maestra y el código del Portón Norte.',
  final_gate_protocol: 'Completa el Protocolo del Portón Norte ({count}/4 etapas completadas).',
  survive_final_gate_siren: '¡SIRENA ACTIVA! ¡Sobrevive {sec}s mientras sube el Portón Norte!',
  escape_north_gate: '¡Portón Norte abierto! ¡Corre a la carretera y escapa del Sector 09!',
  escape_garage_car: 'Ruta del Garaje: instala Batería, Gasolina y abre con la Llave del Garaje ({count}/3).',
  solve_false_bookshelf: 'Coloca los Emblemas del Sol y la Luna en la Estantería Falsa ({count}/2).',
  solve_piano_puzzle: 'Toca la secuencia correcta en el Piano Antiguo para soltar el seguro secreto.',
  close_steam_valves: 'Cierra las válvulas de vapor sobrecalentadas en el Sótano ({count}/3).',
  rescue_marcos_level2: 'Escucha la radio del Guardia Marcos y abre la Escotilla del Nivel -2.',
  unlock_omega_terminal: 'Traduce las cifras UV y desbloquea el Terminal Omega (5 dígitos).',
  revive_teammate: '¡Aliado caído! ¡Corre a reanimar a {name} antes de que se acabe el tiempo!',
  rescue_captured_teammate: '¡{name} fue capturado! Usa la Llave de las Celdas en el Sótano para rescatarlo.',
  wait_for_revive: '¡Estás derribado ({sec}s)! Espera a que un aliado te reanime.',
  spectating_ally: 'Modo Espectador — Observando a {name}.',
  hide_from_drizzy: '¡P. Drizzy acecha cerca! Escóndete o rompe su línea de visión.',
};

const OBJECTIVE_DICTS: Record<ShortLang, Record<ObjectiveKey, string>> = {
  pt: OBJECTIVES_PT,
  en: OBJECTIVES_EN,
  es: OBJECTIVES_ES,
};

// ============================================================================
// DYNAMIC EVENT ALERTS / BANNERS
// ============================================================================

const ALERTS_PT = {
  blackout_started: '⚡ BLECAUTE NO SETOR 09! Os disjuntores caíram — restaure os Fusíveis no Subsolo!',
  blackout_restored: '✅ Energia restaurada! Iluminação e travas eletrônicas voltaram a operar.',
  thunder_storm: '🌩️ Relâmpago sobre o pátio! O trovão encobriu brevemente seus passos.',
  creaking_floorboard: '⚠️ Tábua solta rangeu alto! Agache ao atravessar pisos velhos para não alertar P. Drizzy!',
  player_downed: '🩸 {name} caiu! Reanime em até {sec}s antes que seja arrastado às celas!',
  self_downed: '🩸 Você foi derrubado! Resista por {sec}s até um aliado reanimar você.',
  player_revived: '💚 {name} foi reanimado e voltou à operação!',
  player_captured: '🔒 {name} foi trancado nas Celas de Contenção do Subsolo!',
  player_rescued: '🔓 {name} foi resgatado das Celas de Contenção!',
  spectating_mode: '👁️ Modo Espectador ativo — acompanhando {name}.',
  final_gate_siren_active: '🚨 SIRENE DO PORTÃO NORTE ATIVADA! P. Drizzy entrou em fúria — resista por {sec}s!',
  final_gate_opened: '🚪 PORTÃO NORTE TOTALMENTE ABERTO! Corra para a saída agora!',
  bunker_remote_lure_triggered: '📡 Sinalizador Sonoro da Cabine 09-A disparado! P. Drizzy foi atraído para longe.',
  bunker_remote_lure_cooldown: '⏳ Sinalizador Remoto da Cabine 09-A recarregando ({sec}s).',
  bunker_power_depleted: '🔋 Energia da Guarita de Vigilância (Cabine 09-A) esgotada! Portas blindadas destravaram!',
  bunker_door_sealed: '🛡️ Porta blindada da Cabine 09-A vedada. Atenção ao consumo de bateria!',
  neural_interference_high: '🧠 Interferência Neural crítica! Procure luz, aliados ou tome o Supressor de Frequência!',
  neural_interference_cleared: '💊 Supressor de Frequência ativado — interferência neural estabilizada.',
  polaroid_stun_hit: '📸 Flash Polaroid acertou em cheio! P. Drizzy cegado por {sec}s!',
  hinges_oiled: '🛢️ Dobradiças lubrificadas! Esta porta agora abre em silêncio absoluto.',
  alarm_clock_armed: '⏰ Despertador armado! Afaste-se antes do toque atrair P. Drizzy.',
  lockpick_success: '🔓 Fechadura aberta silenciosamente com a Gazua Tática!',
  bookshelf_opened: '📚 A Estante Falsa deslizou! Passagem secreta liberada no Arquivo Morto.',
  piano_solved: '🎹 Acorde secreto aceito! Um compartimento oculto se abriu.',
  steam_valve_closed: '🔧 Válvula de vapor fechada ({count}/3)! Pressão do corredor reduzida.',
  car_part_installed: '🚗 {item} instalado na viatura ({count}/3)!',
  car_ready: '🚗 Viatura pronta na Garagem Leste! Destranque o portão e fuja!',
  item_given: '🤝 Você entregou {item} para {name}.',
  item_received: '🤝 {name} entregou {item} para você.',
  drizzy_stunned: '⚡ P. Drizzy atordoado por {sec}s! Aproveite para fugir!',
  tape_saved_journal: '📼 {name} reproduzida! Transcrição salva no Diário.',
  diary_saved_journal: '📖 {name} adicionada ao Diário de Investigação.',
  safe_unlocked: '🔓 Cofre destravado com o código {code}! Chave Mestra liberada.',
  terminal_unlocked: '💻 Terminal Ômega desbloqueado! Dossiês confidenciais liberados.',
  inventory_full: '🎒 Mochila cheia! Largue ou entregue um item antes de pegar {item}.',
  need_item: '🔒 Requer {item} para realizar esta ação.',
} as const;

export type AlertKey = keyof typeof ALERTS_PT;

const ALERTS_EN: Record<AlertKey, string> = {
  blackout_started: '⚡ SECTOR 09 BLACKOUT! Breakers tripped — restore the Fuses in the Basement!',
  blackout_restored: '✅ Power restored! Lighting and electronic locks are back online.',
  thunder_storm: '🌩️ Lightning strikes over the courtyard! Thunder briefly masked your footsteps.',
  creaking_floorboard: '⚠️ Loose floorboard creaked loudly! Crouch over old boards to avoid alerting P. Drizzy!',
  player_downed: '🩸 {name} is down! Revive within {sec}s before they are dragged to the cells!',
  self_downed: '🩸 You are downed! Hang on for {sec}s until a teammate revives you.',
  player_revived: '💚 {name} has been revived and is back in the mission!',
  player_captured: '🔒 {name} was locked inside the Basement Containment Cells!',
  player_rescued: '🔓 {name} has been rescued from the Containment Cells!',
  spectating_mode: '👁️ Spectator Mode active — watching {name}.',
  final_gate_siren_active: '🚨 NORTH GATE SIREN ENGAGED! P. Drizzy is enraged — hold out for {sec}s!',
  final_gate_opened: '🚪 NORTH GATE FULLY OPEN! Sprint to the exit now!',
  bunker_remote_lure_triggered: '📡 Cabin 09-A Remote Acoustic Lure fired! P. Drizzy is drawn away.',
  bunker_remote_lure_cooldown: '⏳ Cabin 09-A Remote Lure recharging ({sec}s).',
  bunker_power_depleted: '🔋 Security Bunker (Cabin 09-A) power depleted! Blast doors released!',
  bunker_door_sealed: '🛡️ Cabin 09-A blast door sealed. Watch the battery drain!',
  neural_interference_high: '🧠 Critical Neural Interference! Seek light, teammates, or take Frequency Suppressor!',
  neural_interference_cleared: '💊 Frequency Suppressor active — neural interference stabilized.',
  polaroid_stun_hit: '📸 Direct Polaroid Flash! P. Drizzy blinded for {sec}s!',
  hinges_oiled: '🛢️ Hinges lubricated! This door now opens in complete silence.',
  alarm_clock_armed: '⏰ Alarm Clock armed! Move away before the ring lures P. Drizzy.',
  lockpick_success: '🔓 Lock picked silently with the Tactical Lockpick!',
  bookshelf_opened: '📚 The False Bookshelf slid aside! Secret passage revealed in the Dead Archive.',
  piano_solved: '🎹 Secret chord accepted! A hidden compartment clicked open.',
  steam_valve_closed: '🔧 Steam valve closed ({count}/3)! Corridor pressure reduced.',
  car_part_installed: '🚗 {item} installed on the getaway car ({count}/3)!',
  car_ready: '🚗 Getaway car ready in the East Garage! Unlock the shutter and escape!',
  item_given: '🤝 You gave {item} to {name}.',
  item_received: '🤝 {name} gave you {item}.',
  drizzy_stunned: '⚡ P. Drizzy stunned for {sec}s! Make your move!',
  tape_saved_journal: '📼 {name} played! Transcript saved to Journal.',
  diary_saved_journal: '📖 {name} added to your Investigation Journal.',
  safe_unlocked: '🔓 Safe unlocked with code {code}! Master Key retrieved.',
  terminal_unlocked: '💻 Omega Terminal unlocked! Classified dossiers decrypted.',
  inventory_full: '🎒 Backpack full! Drop or pass an item before picking up {item}.',
  need_item: '🔒 Requires {item} to perform this action.',
};

const ALERTS_ES: Record<AlertKey, string> = {
  blackout_started: '⚡ ¡APAGÓN EN EL SECTOR 09! Saltaron los disyuntores — ¡restaura los Fusibles en el Sótano!',
  blackout_restored: '✅ ¡Energía restaurada! La iluminación y las cerraduras electrónicas vuelven a funcionar.',
  thunder_storm: '🌩️ ¡Relámpago sobre el patio! El trueno ocultó brevemente tus pasos.',
  creaking_floorboard: '⚠️ ¡Tabla suelta crujió fuerte! ¡Agáchate al pisar tablas viejas para no alertar a P. Drizzy!',
  player_downed: '🩸 ¡{name} ha caído! ¡Reanímalo en {sec}s antes de que sea llevado a las celdas!',
  self_downed: '🩸 ¡Has sido derribado! Resiste {sec}s hasta que un aliado te reanime.',
  player_revived: '💚 ¡{name} fue reanimado y volvió a la operación!',
  player_captured: '🔒 ¡{name} fue encerrado en las Celdas de Contención del Sótano!',
  player_rescued: '🔓 ¡{name} fue rescatado de las Celdas de Contención!',
  spectating_mode: '👁️ Modo Espectador activo — observando a {name}.',
  final_gate_siren_active: '🚨 ¡SIRENA DEL PORTÓN NORTE ACTIVADA! P. Drizzy está furioso — ¡resiste {sec}s!',
  final_gate_opened: '🚪 ¡PORTÓN NORTE COMPLETAMENTE ABIERTO! ¡Corre hacia la salida ahora!',
  bunker_remote_lure_triggered: '📡 ¡Señuelo Acústico de Cabina 09-A disparado! P. Drizzy fue distraído.',
  bunker_remote_lure_cooldown: '⏳ Señuelo Remoto de Cabina 09-A recargando ({sec}s).',
  bunker_power_depleted: '🔋 ¡Energía de la Caseta de Vigilancia (Cabina 09-A) agotada! ¡Las puertas blindadas se abrieron!',
  bunker_door_sealed: '🛡️ Puerta blindada de Cabina 09-A sellada. ¡Vigila la batería!',
  neural_interference_high: '🧠 ¡Interferencia Neural crítica! ¡Busca luz, aliados o toma el Supresor de Frecuencia!',
  neural_interference_cleared: '💊 Supresor de Frecuencia activo — interferencia neural estabilizada.',
  polaroid_stun_hit: '📸 ¡Flash Polaroid directo! ¡P. Drizzy cegado por {sec}s!',
  hinges_oiled: '🛢️ ¡Bisagras lubricadas! Esta puerta ahora abre en completo silencio.',
  alarm_clock_armed: '⏰ ¡Despertador armado! Aléjate antes de que el timbre atraiga a P. Drizzy.',
  lockpick_success: '🔓 ¡Cerradura abierta en silencio con la Ganzúa Táctica!',
  bookshelf_opened: '📚 ¡La Estantería Falsa se deslizó! Pasadizo secreto abierto en el Archivo Muerto.',
  piano_solved: '🎹 ¡Acorde secreto aceptado! Se abrió un compartimento oculto.',
  steam_valve_closed: '🔧 ¡Válvula de vapor cerrada ({count}/3)! Presión del pasillo reducida.',
  car_part_installed: '🚗 ¡{item} instalado en el auto de huida ({count}/3)!',
  car_ready: '🚗 ¡Auto listo en el Garaje Este! ¡Abre el portón y escapa!',
  item_given: '🤝 Entregaste {item} a {name}.',
  item_received: '🤝 {name} te entregó {item}.',
  drizzy_stunned: '⚡ ¡P. Drizzy aturdido por {sec}s! ¡Aprovecha para escapar!',
  tape_saved_journal: '📼 ¡{name} reproducida! Transcripción guardada en el Diario.',
  diary_saved_journal: '📖 {name} añadida a tu Diario de Investigación.',
  safe_unlocked: '🔓 ¡Caja fuerte abierta con el código {code}! Llave Maestra liberada.',
  terminal_unlocked: '💻 ¡Terminal Omega desbloqueado! Expedientes confidenciales descifrados.',
  inventory_full: '🎒 ¡Mochila llena! Suelta o entrega un objeto antes de recoger {item}.',
  need_item: '🔒 Requiere {item} para realizar esta acción.',
};

const ALERT_DICTS: Record<ShortLang, Record<AlertKey, string>> = {
  pt: ALERTS_PT,
  en: ALERTS_EN,
  es: ALERTS_ES,
};

// ============================================================================
// 4 LORE DIARY PAGES (PT / EN / ES)
// ============================================================================

export interface LocalizedDiaryPage {
  id: string;
  pageNumber: number;
  title: string;
  subtitle: string;
  body: string;
}

const DIARY_PAGES: Record<ShortLang, readonly LocalizedDiaryPage[]> = {
  pt: [
    {
      id: 'diary_1',
      pageNumber: 1,
      title: 'Página 01 — Guarita de Vigilância (Cabine 09-A)',
      subtitle: 'Relatório de Segurança · Turno Noturno',
      body: 'O Diretor Neves instalou portas hidráulicas na Guarita de Vigilância (Cabine 09-A) e um sinalizador sonoro remoto para afastar o Sujeito 09 dos corredores. Se a bateria reserva zerar, as portas blindadas abrem automaticamente.',
    },
    {
      id: 'diary_2',
      pageNumber: 2,
      title: 'Página 02 — A Estante Falsa & A Viatura',
      subtitle: 'Anotações do Arquivo Morto · Rota da Garagem',
      body: 'Os dois emblemas (Sol e Lua) abrem a estante falsa do Arquivo Morto. Na Garagem Leste há uma viatura funcional: só precisa da Bateria Automotiva, do Galão de Gasolina e da Chave da Garagem para escapar.',
    },
    {
      id: 'diary_3',
      pageNumber: 3,
      title: 'Página 03 — Protocolo de 4 Etapas do Portão Norte',
      subtitle: 'Manual de Evacuação · Setor 09',
      body: 'Para abrir o Portão Norte: restaure 2 fusíveis no porão, corte 2 correntes pesadas com o Alicate de Corte, use a Chave Mestra + senha de 6 dígitos (metade na Cabine 09-A, metade no Sótão) e aguente 15s de sirene.',
    },
    {
      id: 'diary_4',
      pageNumber: 4,
      title: 'Página 04 — O Elevador de Carga (Capítulo 2)',
      subtitle: 'Dossiê Confidencial · Nível -2',
      body: 'Atrás do Sótão Secreto existe um elevador de carga que desce direto para os 36 setores profundos dos Laboratórios Ômega. Foi para lá que levaram o Vigia Marcos e os outros sobreviventes...',
    },
  ],
  en: [
    {
      id: 'diary_1',
      pageNumber: 1,
      title: 'Page 01 — Security Bunker (Cabin 09-A)',
      subtitle: 'Security Report · Night Shift',
      body: 'Director Neves installed hydraulic blast doors in the Security Bunker (Cabin 09-A) and a remote acoustic lure to pull Subject 09 away from the corridors. If the reserve battery hits zero, the armored doors release automatically.',
    },
    {
      id: 'diary_2',
      pageNumber: 2,
      title: 'Page 02 — The False Bookshelf & Getaway Car',
      subtitle: 'Dead Archive Notes · Garage Route',
      body: 'The two emblems (Sun & Moon) slide open the false bookshelf in the Dead Archive. In the East Garage sits a working getaway car: it only needs the Car Battery, Gas Can, and Garage Key to escape.',
    },
    {
      id: 'diary_3',
      pageNumber: 3,
      title: 'Page 03 — 4-Stage North Gate Protocol',
      subtitle: 'Evacuation Manual · Sector 09',
      body: 'To open the North Gate: restore 2 basement fuses, cut 2 heavy chains with Wire Cutters, insert the Master Key + 6-digit code (split between Cabin 09-A and the Attic), and survive 15s of siren.',
    },
    {
      id: 'diary_4',
      pageNumber: 4,
      title: 'Page 04 — The Hidden Cargo Elevator (Chapter 2)',
      subtitle: 'Classified Dossier · Level -2',
      body: 'Behind the Secret Attic lies a hidden cargo elevator descending straight into the 36 deep sectors of the Omega Labs. That is where they took Guard Marcos and the other survivors...',
    },
  ],
  es: [
    {
      id: 'diary_1',
      pageNumber: 1,
      title: 'Página 01 — Caseta de Vigilancia (Cabina 09-A)',
      subtitle: 'Informe de Seguridad · Turno Nocturno',
      body: 'El Director Neves instaló puertas hidráulicas en la Caseta de Vigilancia (Cabina 09-A) y un señuelo acústico remoto para alejar al Sujeto 09 de los pasillos. Si la batería de reserva cae a cero, las puertas blindadas se abren automáticamente.',
    },
    {
      id: 'diary_2',
      pageNumber: 2,
      title: 'Página 02 — La Estantería Falsa y el Auto',
      subtitle: 'Notas del Archivo Muerto · Ruta del Garaje',
      body: 'Los dos emblemas (Sol y Luna) deslizan la estantería falsa del Archivo Muerto. En el Garaje Este hay un vehículo funcional: solo necesita la Batería de Auto, el Bidón de Gasolina y la Llave del Garaje para escapar.',
    },
    {
      id: 'diary_3',
      pageNumber: 3,
      title: 'Página 03 — Protocolo de 4 Etapas del Portón Norte',
      subtitle: 'Manual de Evacuación · Sector 09',
      body: 'Para abrir el Portón Norte: restaura 2 fusibles en el sótano, corta 2 cadenas pesadas con la Cizalla, usa la Llave Maestra + código de 6 dígitos (mitad en Cabina 09-A, mitad en el Ático) y resiste 15s de sirena.',
    },
    {
      id: 'diary_4',
      pageNumber: 4,
      title: 'Página 04 — El Elevador de Carga (Capítulo 2)',
      subtitle: 'Expediente Clasificado · Nivel -2',
      body: 'Detrás del Ático Secreto existe un elevador de carga que desciende directo a los 36 sectores profundos de los Laboratorios Omega. Allí fue donde llevaron al Guardia Marcos y a los demás sobrevivientes...',
    },
  ],
};

// ============================================================================
// TIMED AUDIO TAPE SUBTITLES (FOR TapeAudioPlayer.ts — TAPE 1 & TAPE 2)
// ============================================================================

export interface TapeSubtitleCue {
  startSec: number;
  endSec: number;
  speaker: string;
  text: string;
}

const TAPE_SUBTITLES: Record<ShortLang, Record<1 | 2, readonly TapeSubtitleCue[]>> = {
  pt: {
    1: [
      {
        startSec: 0.0,
        endSec: 4.2,
        speaker: 'Vigia Marcos',
        text: 'Fita 01 — Vigia Marcos falando da Guarita de Vigilância (Cabine 09-A).',
      },
      {
        startSec: 4.2,
        endSec: 8.8,
        speaker: 'Vigia Marcos',
        text: 'Escuta bem: nunca pise nas tábuas soltas do corredor em pé — o rangido atrai o Sujeito 09 na hora!',
      },
      {
        startSec: 8.8,
        endSec: 13.6,
        speaker: 'Vigia Marcos',
        text: 'Se ele te encurralar, dispare a Câmera Polaroid no rosto dele para ganhar 3 segundos e fugir.',
      },
      {
        startSec: 13.6,
        endSec: 18.0,
        speaker: 'Vigia Marcos',
        text: 'E use o sinalizador remoto da Cabine 09-A quando precisar limpar o caminho até o Portão Norte.',
      },
    ],
    2: [
      {
        startSec: 0.0,
        endSec: 4.4,
        speaker: 'Dra. Helena',
        text: 'Fita 02 — Registro médico da Dra. Helena. A emissão do Composto 09 gerou interferência neural.',
      },
      {
        startSec: 4.4,
        endSec: 9.2,
        speaker: 'Dra. Helena',
        text: 'Os sintomas pioram no breu absoluto e sempre que o Sujeito 09 se aproxima de você.',
      },
      {
        startSec: 9.2,
        endSec: 13.8,
        speaker: 'Dra. Helena',
        text: 'Fique perto dos seus aliados, mantenha a lanterna acesa ou tome o Supressor de Frequência.',
      },
      {
        startSec: 13.8,
        endSec: 18.5,
        speaker: 'Dra. Helena',
        text: 'Se encontrar o elevador oculto atrás do sótão... prepare-se antes de descer aos Laboratórios Ômega.',
      },
    ],
  },
  en: {
    1: [
      {
        startSec: 0.0,
        endSec: 4.2,
        speaker: 'Guard Marcos',
        text: 'Tape 01 — Guard Marcos reporting from the Security Bunker (Cabin 09-A).',
      },
      {
        startSec: 4.2,
        endSec: 8.8,
        speaker: 'Guard Marcos',
        text: 'Listen closely: never step on loose hallway floorboards standing up — the creak draws Subject 09 instantly!',
      },
      {
        startSec: 8.8,
        endSec: 13.6,
        speaker: 'Guard Marcos',
        text: 'If he corners you, fire the Polaroid Camera flash in his face to buy 3 seconds to break away.',
      },
      {
        startSec: 13.6,
        endSec: 18.0,
        speaker: 'Guard Marcos',
        text: 'And trigger the Cabin 09-A remote acoustic lure whenever you need to clear the path to the North Gate.',
      },
    ],
    2: [
      {
        startSec: 0.0,
        endSec: 4.4,
        speaker: 'Dr. Helena',
        text: 'Tape 02 — Dr. Helena medical log. Compound 09 emissions are causing severe neural interference.',
      },
      {
        startSec: 4.4,
        endSec: 9.2,
        speaker: 'Dr. Helena',
        text: 'Symptoms intensify in pitch darkness and whenever Subject 09 closes in on your position.',
      },
      {
        startSec: 9.2,
        endSec: 13.8,
        speaker: 'Dr. Helena',
        text: 'Stay near your teammates, keep your flashlight on, or take Frequency Suppressor pills.',
      },
      {
        startSec: 13.8,
        endSec: 18.5,
        speaker: 'Dr. Helena',
        text: 'If you uncover the hidden elevator behind the attic... gear up before descending to the Omega Labs.',
      },
    ],
  },
  es: {
    1: [
      {
        startSec: 0.0,
        endSec: 4.2,
        speaker: 'Guardia Marcos',
        text: 'Cinta 01 — Guardia Marcos transmitiendo desde la Caseta de Vigilancia (Cabina 09-A).',
      },
      {
        startSec: 4.2,
        endSec: 8.8,
        speaker: 'Guardia Marcos',
        text: 'Escucha bien: nunca pises las tablas sueltas del pasillo de pie — ¡el crujido atrae al Sujeto 09 al instante!',
      },
      {
        startSec: 8.8,
        endSec: 13.6,
        speaker: 'Guardia Marcos',
        text: 'Si te acorrala, dispara el flash de la Cámara Polaroid a su rostro para ganar 3 segundos y escapar.',
      },
      {
        startSec: 13.6,
        endSec: 18.0,
        speaker: 'Guardia Marcos',
        text: 'Y activa el señuelo remoto de la Cabina 09-A cuando necesites despejar el camino hacia el Portón Norte.',
      },
    ],
    2: [
      {
        startSec: 0.0,
        endSec: 4.4,
        speaker: 'Dra. Helena',
        text: 'Cinta 02 — Registro médico de la Dra. Helena. La emisión del Compuesto 09 genera interferencia neural.',
      },
      {
        startSec: 4.4,
        endSec: 9.2,
        speaker: 'Dra. Helena',
        text: 'Los síntomas empeoran en la oscuridad total y cada vez que el Sujeto 09 se acerca a tu posición.',
      },
      {
        startSec: 9.2,
        endSec: 13.8,
        speaker: 'Dra. Helena',
        text: 'Quédate cerca de tus aliados, mantén la linterna encendida o toma el Supresor de Frecuencia.',
      },
      {
        startSec: 13.8,
        endSec: 18.5,
        speaker: 'Dra. Helena',
        text: 'Si encuentras el elevador oculto detrás del ático... prepárate antes de bajar a los Laboratorios Omega.',
      },
    ],
  },
};

// ============================================================================
// LOCALIZED CUTSCENES: INTRO (6s) + ALL 4 ENDINGS (BAD, GOOD, REAL, SECRET)
// ============================================================================

export type CanonicalCutsceneId =
  | 'intro'
  | 'ending_bad'
  | 'ending_good'
  | 'ending_real'
  | 'ending_secret';

export interface LocalizedCutsceneStep {
  id: string;
  speaker: SpeakerId;
  speakerName: string;
  emotion: DialogueStep['emotion'];
  text: string;
  minDisplaySec: number;
  autoAdvanceSec: number;
  cameraIndex: number;
  soundCue?: CutsceneSoundCue;
}

export interface LocalizedCutsceneMeta {
  chapterTitle: string;
  subtitle: string;
}

export interface LocalizedEndingMeta {
  id: EndingId;
  title: string;
  subtitle: string;
  routeHint: string;
}

function canonicalCutsceneId(cutsceneId: CutsceneId): CanonicalCutsceneId {
  return cutsceneId === 'ending' ? 'ending_good' : cutsceneId;
}

const CUTSCENE_META: Record<ShortLang, Record<CanonicalCutsceneId, LocalizedCutsceneMeta>> = {
  pt: {
    intro: {
      chapterTitle: 'CAPÍTULO 1 — SETOR 09',
      subtitle: 'O Turno Perdido • Complexo de Pesquisa Interditado',
    },
    ending_bad: {
      chapterTitle: 'FINAL RUIM — CONTENÇÃO DO SETOR 09',
      subtitle: 'Celas Subterrâneas • Protocolo de Isolamento Ativado',
    },
    ending_good: {
      chapterTitle: 'FUGA PELO PORTÃO NORTE',
      subtitle: 'Good Ending • Estrada Exterior & Viatura de Fuga',
    },
    ending_real: {
      chapterTitle: 'FINAL REAL — TÚNEL DE FUGA & RESGATE',
      subtitle: 'Galeria Subterrânea • Saída de Emergência & Resgate do Marcos',
    },
    ending_secret: {
      chapterTitle: 'FINAL SECRETO — EVACUAÇÃO DO HELIPONTO ÔMEGA',
      subtitle: 'Dossiê Ômega Transmitido • Decolagem sob Holofotes',
    },
  },
  en: {
    intro: {
      chapterTitle: 'CHAPTER 1 — SECTOR 09',
      subtitle: 'The Lost Shift • Quarantined Research Complex',
    },
    ending_bad: {
      chapterTitle: 'BAD ENDING — SECTOR 09 CONTAINMENT',
      subtitle: 'Underground Cells • Isolation Protocol Engaged',
    },
    ending_good: {
      chapterTitle: 'NORTH GATE ESCAPE',
      subtitle: 'Good Ending • Exterior Road & Getaway Car',
    },
    ending_real: {
      chapterTitle: 'REAL ENDING — ESCAPE TUNNEL & RESCUE',
      subtitle: 'Subterranean Gallery • Emergency Hatch & Marcos Rescue',
    },
    ending_secret: {
      chapterTitle: 'SECRET ENDING — OMEGA HELIPAD EVACUATION',
      subtitle: 'Omega Dossier Broadcast • Floodlit Liftoff',
    },
  },
  es: {
    intro: {
      chapterTitle: 'CAPÍTULO 1 — SECTOR 09',
      subtitle: 'El Turno Perdido • Complejo de Investigación Clausurado',
    },
    ending_bad: {
      chapterTitle: 'FINAL MALO — CONTENCIÓN DEL SECTOR 09',
      subtitle: 'Celdas Subterráneas • Protocolo de Aislamiento Activado',
    },
    ending_good: {
      chapterTitle: 'HUIDA POR EL PORTÓN NORTE',
      subtitle: 'Final Bueno • Carretera Exterior y Vehículo de Fuga',
    },
    ending_real: {
      chapterTitle: 'FINAL REAL — TÚNEL DE FUGA Y RESCATE',
      subtitle: 'Galería Subterránea • Escotilla de Emergencia y Rescate de Marcos',
    },
    ending_secret: {
      chapterTitle: 'FINAL SECRETO — EVACUACIÓN DEL HELIPUERTO OMEGA',
      subtitle: 'Expediente Omega Transmitido • Despegue bajo Reflectores',
    },
  },
};

const CUTSCENE_STEPS: Record<ShortLang, Record<CanonicalCutsceneId, readonly LocalizedCutsceneStep[]>> = {
  pt: {
    intro: [
      {
        id: 'intro_1',
        speaker: 'survivor',
        speakerName: 'VOCÊ',
        emotion: 'tense',
        text: 'Chuva forte no portão do Setor 09... o portão travou por fora assim que entramos!',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 0,
        soundCue: 'gate_slam',
      },
      {
        id: 'intro_2',
        speaker: 'radio',
        speakerName: 'RÁDIO · CABINE 09-A (MARCOS)',
        emotion: 'static',
        text: '...[chiado]... NÃO FICA NO PÁTIO! P. Drizzy saiu da Cela 09 — corram pra Guarita de Vigilância (Cabine 09-A)!',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 3,
        soundCue: 'radio_static',
      },
      {
        id: 'intro_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUJEITO 09)',
        emotion: 'menacing',
        text: '...Passos sob a chuva. Bem-vindos à Mansão do Setor 09...',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 4,
        soundCue: 'drizzy_growl',
      },
    ],
    ending_bad: [
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
    ending_good: [
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
    ending_real: [
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
    ending_secret: [
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
        text: 'DESLIGUE ESSE TERMINAL! NEVES TRANCOU TODOS NÓS AQUI EMBAIXO — NINGUÉM PODE VER O QUE FIZERAM COMIGO!',
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
  },
  en: {
    intro: [
      {
        id: 'intro_1',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'tense',
        text: 'Heavy rain at the Sector 09 gate... the perimeter bolt locked from outside the second we stepped in!',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 0,
        soundCue: 'gate_slam',
      },
      {
        id: 'intro_2',
        speaker: 'radio',
        speakerName: 'RADIO · CABIN 09-A (MARCOS)',
        emotion: 'static',
        text: '...[static]... GET OUT OF THE COURTYARD! P. Drizzy broke out of Cell 09 — run to the Security Bunker (Cabin 09-A)!',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 3,
        soundCue: 'radio_static',
      },
      {
        id: 'intro_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUBJECT 09)',
        emotion: 'menacing',
        text: '...Footsteps in the rain. Welcome to the Sector 09 Mansion...',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 4,
        soundCue: 'drizzy_growl',
      },
    ],
    ending_bad: [
      {
        id: 'bad_1',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'tense',
        text: 'Let go of me...! The basement corridor... no, not the containment cells! The lights are dying...',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.8,
        cameraIndex: 0,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'bad_2',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUBJECT 09)',
        emotion: 'menacing',
        text: 'Nobody leaves Sector 09 without finishing their shift. Cell 09 has been empty, waiting for a new guest...',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.2,
        cameraIndex: 1,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'bad_3',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'alert',
        text: 'NO! The armored cell door bolted from outside! Marcos... is anyone on this frequency?!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.6,
        cameraIndex: 2,
        soundCue: 'gate_slam',
      },
      {
        id: 'bad_4',
        speaker: 'radio',
        speakerName: 'GUARD MARCOS RADIO',
        emotion: 'static',
        text: '...[distant static]... signal lost in the cell block... hang on... I cannot override it from down here...',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.2,
        cameraIndex: 3,
        soundCue: 'radio_static',
      },
    ],
    ending_good: [
      {
        id: 'good_1',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'relieved',
        text: 'The electronic deadbolt gave way... I made it! The North Gate finally opened to the forest road!',
        minDisplaySec: 1.5,
        autoAdvanceSec: 4.5,
        cameraIndex: 0,
        soundCue: 'door_open',
      },
      {
        id: 'good_2',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUBJECT 09)',
        emotion: 'menacing',
        text: 'YOU THINK THOSE BARS CAN SAVE YOU?! PROJECT OMEGA DOES NOT END AT THE SURFACE!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.8,
        cameraIndex: 1,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'good_3',
        speaker: 'radio',
        speakerName: 'GUARD MARCOS RADIO',
        emotion: 'static',
        text: '...[heavy static]... I AM ALIVE! I sealed myself inside Level -2, in the Omega Labs! But the emergency hatch is giving way!',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.5,
        cameraIndex: 2,
        soundCue: 'radio_static',
      },
      {
        id: 'good_4',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'alert',
        text: 'Hold on, Marcos! I made it out of Sector 09 alive... and I am coming back to breach that Level -2 hatch.',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.5,
        cameraIndex: 3,
        soundCue: 'hatch_hum',
      },
    ],
    ending_real: [
      {
        id: 'real_1',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'alert',
        text: 'The wire cutters snapped the hydraulic latch! The Red Hatch to Level -2 finally unlocked!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.8,
        cameraIndex: 0,
        soundCue: 'door_open',
      },
      {
        id: 'real_2',
        speaker: 'radio',
        speakerName: 'GUARD MARCOS RADIO',
        emotion: 'relieved',
        text: '...[static clearing]... I HEAR THE HATCH OPENING! Climb down the service ladder fast — I locked down the containment bay below!',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.4,
        cameraIndex: 1,
        soundCue: 'radio_static',
      },
      {
        id: 'real_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUBJECT 09)',
        emotion: 'menacing',
        text: 'DO NOT DESCEND INTO THE OMEGA LAB! THE UNDERGROUND BELONGS TO COMPOUND 09!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.6,
        cameraIndex: 2,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'real_4',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'tense',
        text: 'Too late, Drizzy! Hold your position, Marcos — I am heading down into Level -2 right now!',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.4,
        cameraIndex: 3,
        soundCue: 'hatch_hum',
      },
    ],
    ending_secret: [
      {
        id: 'secret_1',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'alert',
        text: '5-digit cipher accepted! Omega Terminal unlocked — broadcasting every classified dossier to the outside network!',
        minDisplaySec: 1.7,
        autoAdvanceSec: 5.2,
        cameraIndex: 0,
        soundCue: 'hatch_hum',
      },
      {
        id: 'secret_2',
        speaker: 'radio',
        speakerName: 'OMEGA LOG // DR. HELENA',
        emotion: 'static',
        text: '...[leaked recording]... Director Artur Neves ordered a total cover-up. The former foreman became Subject 09 after forced exposure to Compound 09...',
        minDisplaySec: 1.9,
        autoAdvanceSec: 5.8,
        cameraIndex: 1,
        soundCue: 'radio_static',
      },
      {
        id: 'secret_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUBJECT 09)',
        emotion: 'menacing',
        text: 'SHUT DOWN THAT TERMINAL! NEVES LOCKED ALL OF US DOWN HERE — NOBODY CAN SEE WHAT THEY DID TO ME!',
        minDisplaySec: 1.7,
        autoAdvanceSec: 5.0,
        cameraIndex: 2,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'secret_4',
        speaker: 'survivor',
        speakerName: 'YOU',
        emotion: 'relieved',
        text: 'Upload 100% complete. The whole world now has proof of Project Omega and Director Neves. Time to leave Sector 09 forever.',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.4,
        cameraIndex: 3,
        soundCue: 'door_open',
      },
    ],
  },
  es: {
    intro: [
      {
        id: 'intro_1',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'tense',
        text: 'Lluvia intensa en el portón del Sector 09... ¡el cierre se bloqueó por fuera nada más entrar!',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 0,
        soundCue: 'gate_slam',
      },
      {
        id: 'intro_2',
        speaker: 'radio',
        speakerName: 'RADIO · CABINA 09-A (MARCOS)',
        emotion: 'static',
        text: '...[estática]... ¡NO TE QUEDES EN EL PATIO! P. Drizzy escapó de la Celda 09 — ¡corran a la Caseta de Vigilancia (Cabina 09-A)!',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 3,
        soundCue: 'radio_static',
      },
      {
        id: 'intro_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUJETO 09)',
        emotion: 'menacing',
        text: '...Pasos bajo la lluvia. Bienvenidos a la Mansión del Sector 09...',
        minDisplaySec: 1.0,
        autoAdvanceSec: 2.0,
        cameraIndex: 4,
        soundCue: 'drizzy_growl',
      },
    ],
    ending_bad: [
      {
        id: 'bad_1',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'tense',
        text: '¡Suéltame...! El pasillo del sótano... ¡no, a las celdas no! La luz se está apagando...',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.8,
        cameraIndex: 0,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'bad_2',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUJETO 09)',
        emotion: 'menacing',
        text: 'Nadie sale del Sector 09 sin cumplir su turno. La Celda 09 estaba vacía esperando a un nuevo huésped...',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.2,
        cameraIndex: 1,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'bad_3',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'alert',
        text: '¡NO! ¡La puerta blindada se cerró por fuera! Marcos... ¿hay alguien en la frecuencia?!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.6,
        cameraIndex: 2,
        soundCue: 'gate_slam',
      },
      {
        id: 'bad_4',
        speaker: 'radio',
        speakerName: 'RADIO DEL GUARDIA MARCOS',
        emotion: 'static',
        text: '...[estática lejana]... señal perdida en el bloque de celdas... aguanta... no puedo abrir desde aquí...',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.2,
        cameraIndex: 3,
        soundCue: 'radio_static',
      },
    ],
    ending_good: [
      {
        id: 'good_1',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'relieved',
        text: 'El cerrojo electrónico cedió... ¡lo logré! ¡El Portón Norte al fin se abrió hacia el bosque!',
        minDisplaySec: 1.5,
        autoAdvanceSec: 4.5,
        cameraIndex: 0,
        soundCue: 'door_open',
      },
      {
        id: 'good_2',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUJETO 09)',
        emotion: 'menacing',
        text: '¿CREES QUE ESCAPASTE TRAS LAS REJAS?! ¡EL PROYECTO OMEGA NO TERMINA EN LA SUPERFICIE!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.8,
        cameraIndex: 1,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'good_3',
        speaker: 'radio',
        speakerName: 'RADIO DEL GUARDIA MARCOS',
        emotion: 'static',
        text: '...[estática fuerte]... ¡ESTOY VIVO! ¡Logré encerrarme en el Nivel -2, en los Laboratorios Omega! ¡Pero la escotilla de emergencia está cediendo!',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.5,
        cameraIndex: 2,
        soundCue: 'radio_static',
      },
      {
        id: 'good_4',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'alert',
        text: '¡Aguanta, Marcos! Salí vivo del Sector 09... pero volveré para abrir esa escotilla del Nivel -2.',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.5,
        cameraIndex: 3,
        soundCue: 'hatch_hum',
      },
    ],
    ending_real: [
      {
        id: 'real_1',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'alert',
        text: '¡La cizalla rompió el seguro hidráulico! ¡La Escotilla Roja del Nivel -2 al fin se desbloqueó!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.8,
        cameraIndex: 0,
        soundCue: 'door_open',
      },
      {
        id: 'real_2',
        speaker: 'radio',
        speakerName: 'RADIO DEL GUARDIA MARCOS',
        emotion: 'relieved',
        text: '...[estática aclarándose]... ¡ESCUCHO LA ESCOTILLA ABRIRSE! Baja rápido por la escalera de servicio — ¡sellé la sala de contención allá abajo!',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.4,
        cameraIndex: 1,
        soundCue: 'radio_static',
      },
      {
        id: 'real_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUJETO 09)',
        emotion: 'menacing',
        text: '¡NO BAJES AL LABORATORIO OMEGA! ¡EL SUBSUELO PERTENECE AL COMPUESTO 09!',
        minDisplaySec: 1.6,
        autoAdvanceSec: 4.6,
        cameraIndex: 2,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'real_4',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'tense',
        text: '¡Demasiado tarde, Drizzy! Mantén la posición, Marcos — ¡estoy bajando al Nivel -2 ahora mismo!',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.4,
        cameraIndex: 3,
        soundCue: 'hatch_hum',
      },
    ],
    ending_secret: [
      {
        id: 'secret_1',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'alert',
        text: '¡Código de 5 dígitos aceptado! Terminal Omega desbloqueado — ¡transmitiendo todos los expedientes clasificados a la red externa!',
        minDisplaySec: 1.7,
        autoAdvanceSec: 5.2,
        cameraIndex: 0,
        soundCue: 'hatch_hum',
      },
      {
        id: 'secret_2',
        speaker: 'radio',
        speakerName: 'REGISTRO OMEGA // DRA. HELENA',
        emotion: 'static',
        text: '...[grabación filtrada]... El Director Artur Neves ordenó el encubrimiento total. El antiguo capataz se convirtió en el Sujeto 09 tras exposición forzada al Compuesto 09...',
        minDisplaySec: 1.9,
        autoAdvanceSec: 5.8,
        cameraIndex: 1,
        soundCue: 'radio_static',
      },
      {
        id: 'secret_3',
        speaker: 'diddy',
        speakerName: 'P. DRIZZY (SUJETO 09)',
        emotion: 'menacing',
        text: '¡APAGA ESE TERMINAL! ¡NEVES NOS ENCERRÓ A TODOS AQUÍ ABAJO — NADIE PUEDE VER LO QUE ME HICIERON!',
        minDisplaySec: 1.7,
        autoAdvanceSec: 5.0,
        cameraIndex: 2,
        soundCue: 'drizzy_growl',
      },
      {
        id: 'secret_4',
        speaker: 'survivor',
        speakerName: 'TÚ',
        emotion: 'relieved',
        text: 'Carga 100% completada. El mundo entero ya tiene las pruebas del Proyecto Omega y del Director Neves. Es hora de salir del Sector 09 para siempre.',
        minDisplaySec: 1.8,
        autoAdvanceSec: 5.4,
        cameraIndex: 3,
        soundCue: 'door_open',
      },
    ],
  },
};

const ENDING_META: Record<ShortLang, Record<EndingId, LocalizedEndingMeta>> = {
  pt: {
    bad: {
      id: 'bad',
      title: 'Contenção do Setor 09',
      subtitle: 'Final Ruim · Capturado pelo Sujeito 09',
      routeHint: 'Seja capturado por P. Drizzy e arrastado às celas de contenção do subsolo.',
    },
    good: {
      id: 'good',
      title: 'Fuga pelo Portão Norte',
      subtitle: 'Final Bom · Rota Principal Concluída',
      routeHint: 'Restaure o gerador, decifre o cofre de 4 dígitos, pegue a Chave Mestra e escape pelo Portão Norte.',
    },
    real: {
      id: 'real',
      title: 'Resgate no Nível -2',
      subtitle: 'Final Real · Escotilha Blindada Aberta',
      routeHint: 'Use o Alicate de Corte e siga o sinal de rádio do Vigia Marcos até o Alçapão Vermelho do Nível -2.',
    },
    secret: {
      id: 'secret',
      title: 'Dossiê Ômega Exposto',
      subtitle: 'Final Secreto · Verdade Revelada',
      routeHint: 'Mapeie todas as cifras UV, traduza no Quadro e desbloqueie o Terminal Ômega de 5 dígitos antes de fugir.',
    },
  },
  en: {
    bad: {
      id: 'bad',
      title: 'Sector 09 Containment',
      subtitle: 'Bad Ending · Captured by Subject 09',
      routeHint: 'Get captured by P. Drizzy and dragged down to the basement containment cells.',
    },
    good: {
      id: 'good',
      title: 'North Gate Escape',
      subtitle: 'Good Ending · Main Route Complete',
      routeHint: 'Restore the generator, crack the 4-digit safe, grab the Master Key, and escape through the North Gate.',
    },
    real: {
      id: 'real',
      title: 'Level -2 Rescue',
      subtitle: 'Real Ending · Armored Hatch Opened',
      routeHint: 'Use the Wire Cutters and follow Guard Marcos’s radio signal to the Red Hatch leading to Level -2.',
    },
    secret: {
      id: 'secret',
      title: 'Omega Dossier Exposed',
      subtitle: 'Secret Ending · Truth Revealed',
      routeHint: 'Map every UV cipher, decode them at the Translation Board, and unlock the 5-digit Omega Terminal before escaping.',
    },
  },
  es: {
    bad: {
      id: 'bad',
      title: 'Contención del Sector 09',
      subtitle: 'Final Malo · Capturado por el Sujeto 09',
      routeHint: 'Sé capturado por P. Drizzy y arrastrado a las celdas de contención del sótano.',
    },
    good: {
      id: 'good',
      title: 'Huida por el Portón Norte',
      subtitle: 'Final Bueno · Ruta Principal Completada',
      routeHint: 'Restaura el generador, descifra la caja fuerte de 4 dígitos, toma la Llave Maestra y escapa por el Portón Norte.',
    },
    real: {
      id: 'real',
      title: 'Rescate en el Nivel -2',
      subtitle: 'Final Real · Escotilla Blindada Abierta',
      routeHint: 'Usa la Cizalla y sigue la señal de radio del Guardia Marcos hasta la Escotilla Roja del Nivel -2.',
    },
    secret: {
      id: 'secret',
      title: 'Expediente Omega Expuesto',
      subtitle: 'Final Secreto · Verdad Revelada',
      routeHint: 'Mapea todas las cifras UV, tradúcelas en el Tablero y desbloquea el Terminal Omega de 5 dígitos antes de escapar.',
    },
  },
};

// ============================================================================
// REACTIVE GLOBAL I18N STORE
// ============================================================================

export class I18nStore {
  private currentLang: ShortLang = 'pt';
  private listeners = new Set<LangListener>();

  constructor(initialLang: AnyLang = 'pt') {
    this.currentLang = toShortLang(initialLang);
  }

  getLang(): ShortLang {
    return this.currentLang;
  }

  getFullLang(): Language {
    return SHORT_TO_FULL[this.currentLang];
  }

  setLang(lang: AnyLang): void {
    const next = toShortLang(lang);
    if (next === this.currentLang) return;
    this.currentLang = next;
    const snapshot = [...this.listeners];
    for (const listener of snapshot) {
      try {
        listener(next);
      } catch {
        // Never allow a faulty subscriber to break other React/Engine subscribers
      }
    }
  }

  subscribe(listener: LangListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Translates any key from either `translations.ts` or extended `i18n.ts` dictionaries.
   * Supports `{name}`, `{item}`, `{sec}`, `{count}`, `{code}`, and arbitrary `{var}` tokens.
   */
  t(key: I18nKey, vars?: TemplateVars, langOverride?: AnyLang): string {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    const fullLang = SHORT_TO_FULL[shortLang];

    const extDict = EXTENDED_DICTS[shortLang] as Record<string, string>;
    const baseDict = TRANSLATIONS[fullLang];
    const fallbackExt = EXTENDED_DICTS.pt as Record<string, string>;
    const fallbackBase = TRANSLATIONS['pt-BR'];

    const raw =
      extDict[key] ??
      baseDict[key] ??
      fallbackExt[key] ??
      fallbackBase[key] ??
      key;

    return interpolate(raw, vars);
  }

  getItemName(itemId: string, langOverride?: AnyLang): string {
    const key = `item.${itemId}.name` as I18nKey;
    return this.t(key, undefined, langOverride);
  }

  getItemDesc(itemId: string, langOverride?: AnyLang): string {
    const key = `item.${itemId}.desc` as I18nKey;
    return this.t(key, undefined, langOverride);
  }

  getPrompt(kind: PromptKind, vars?: TemplateVars, langOverride?: AnyLang): string {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    const template = PROMPT_DICTS[shortLang][kind] ?? PROMPT_DICTS.pt[kind] ?? kind;
    return interpolate(template, vars);
  }

  getObjective(key: ObjectiveKey, vars?: TemplateVars, langOverride?: AnyLang): string {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    const template = OBJECTIVE_DICTS[shortLang][key] ?? OBJECTIVE_DICTS.pt[key] ?? key;
    return interpolate(template, vars);
  }

  getAlert(key: AlertKey, vars?: TemplateVars, langOverride?: AnyLang): string {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    const template = ALERT_DICTS[shortLang][key] ?? ALERT_DICTS.pt[key] ?? key;
    return interpolate(template, vars);
  }

  getDiaryPages(langOverride?: AnyLang): LocalizedDiaryPage[] {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    return DIARY_PAGES[shortLang].map((page) => ({ ...page }));
  }

  getTapeSubtitles(tapeNumber: 1 | 2, langOverride?: AnyLang): TapeSubtitleCue[] {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    return TAPE_SUBTITLES[shortLang][tapeNumber].map((cue) => ({ ...cue }));
  }

  getCutsceneSteps(cutsceneId: CutsceneId, langOverride?: AnyLang): LocalizedCutsceneStep[] {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    const canonical = canonicalCutsceneId(cutsceneId);
    return CUTSCENE_STEPS[shortLang][canonical].map((step) => ({ ...step }));
  }

  getCutsceneMeta(cutsceneId: CutsceneId, langOverride?: AnyLang): LocalizedCutsceneMeta {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    const canonical = canonicalCutsceneId(cutsceneId);
    return { ...CUTSCENE_META[shortLang][canonical] };
  }

  getEndingMeta(endingId: EndingId, langOverride?: AnyLang): LocalizedEndingMeta {
    const shortLang = langOverride ? toShortLang(langOverride) : this.currentLang;
    return { ...ENDING_META[shortLang][endingId] };
  }
}

export const i18nStore = new I18nStore('pt');

// ============================================================================
// KEY INSPECTION & 100% PARITY VERIFICATION EXPORTS
// ============================================================================

export function getAllExtendedKeys(): ExtendedI18nKey[] {
  return Object.keys(EXTENDED_PT) as ExtendedI18nKey[];
}

export function getAllPromptKinds(): PromptKind[] {
  return Object.keys(PROMPTS_PT) as PromptKind[];
}

export function getAllObjectiveKeys(): ObjectiveKey[] {
  return Object.keys(OBJECTIVES_PT) as ObjectiveKey[];
}

export function getAllAlertKeys(): AlertKey[] {
  return Object.keys(ALERTS_PT) as AlertKey[];
}

export interface I18nParityReport {
  ok: boolean;
  errors: string[];
  counts: {
    baseKeys: number;
    extendedKeys: number;
    items: number;
    prompts: number;
    objectives: number;
    alerts: number;
    diaryPages: number;
    tapes: number;
    cutscenes: number;
  };
}

/**
 * Verifies 100% non-empty key parity across `pt`, `en`, and `es` for all dictionaries,
 * items, prompts, objectives, alerts, diary pages, audio tapes, and cutscenes.
 */
export function verifyI18nParity(): I18nParityReport {
  const errors: string[] = [];
  const baseKeys = Object.keys(TRANSLATIONS['pt-BR']);
  const extendedKeys = getAllExtendedKeys();
  const promptKinds = getAllPromptKinds();
  const objectiveKeys = getAllObjectiveKeys();
  const alertKeys = getAllAlertKeys();
  const cutsceneIds: CanonicalCutsceneId[] = [
    'intro',
    'ending_bad',
    'ending_good',
    'ending_real',
    'ending_secret',
  ];
  const endingIds: EndingId[] = ['bad', 'good', 'real', 'secret'];

  for (const lang of SUPPORTED_SHORT_LANGS) {
    const full = SHORT_TO_FULL[lang];

    // 1. Base translations.ts keys
    for (const k of baseKeys) {
      const val = TRANSLATIONS[full][k];
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors.push(`Missing/empty base key "${k}" in ${lang}`);
      }
    }

    // 2. Extended keys
    for (const k of extendedKeys) {
      const val = EXTENDED_DICTS[lang][k];
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors.push(`Missing/empty extended key "${k}" in ${lang}`);
      }
    }

    // 3. All 29 world pickup items
    for (const itemId of ALL_ITEM_IDS) {
      const name = i18nStore.getItemName(itemId, lang);
      const desc = i18nStore.getItemDesc(itemId, lang);
      if (!name || name === `item.${itemId}.name`) {
        errors.push(`Missing item name for "${itemId}" in ${lang}`);
      }
      if (!desc || desc === `item.${itemId}.desc`) {
        errors.push(`Missing item desc for "${itemId}" in ${lang}`);
      }
    }

    // 4. Prompts
    for (const p of promptKinds) {
      const val = PROMPT_DICTS[lang][p];
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors.push(`Missing/empty prompt "${p}" in ${lang}`);
      }
    }

    // 5. Objectives
    for (const o of objectiveKeys) {
      const val = OBJECTIVE_DICTS[lang][o];
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors.push(`Missing/empty objective "${o}" in ${lang}`);
      }
    }

    // 6. Alerts
    for (const a of alertKeys) {
      const val = ALERT_DICTS[lang][a];
      if (typeof val !== 'string' || val.trim().length === 0) {
        errors.push(`Missing/empty alert "${a}" in ${lang}`);
      }
    }

    // 7. Diary pages (4 pages)
    const pages = DIARY_PAGES[lang];
    if (pages.length !== 4) {
      errors.push(`Expected 4 diary pages in ${lang}, got ${pages.length}`);
    }
    for (const page of pages) {
      if (!page.title.trim() || !page.subtitle.trim() || !page.body.trim()) {
        errors.push(`Empty field in diary page "${page.id}" in ${lang}`);
      }
    }

    // 8. Timed Audio Tape Subtitles (Tape 1 & 2)
    for (const tapeNum of [1, 2] as const) {
      const cues = TAPE_SUBTITLES[lang][tapeNum];
      if (cues.length === 0) {
        errors.push(`Empty tape ${tapeNum} subtitles in ${lang}`);
      }
      if (cues.length !== TAPE_SUBTITLES.pt[tapeNum].length) {
        errors.push(`Tape ${tapeNum} cue count mismatch in ${lang}`);
      }
      for (const cue of cues) {
        if (!cue.text.trim() || !cue.speaker.trim() || cue.endSec <= cue.startSec) {
          errors.push(`Invalid cue timing/text in tape ${tapeNum} (${lang})`);
        }
      }
    }

    // 9. Cutscenes (Intro + 4 Endings) & Ending Metadata
    for (const cid of cutsceneIds) {
      const meta = CUTSCENE_META[lang][cid];
      if (!meta.chapterTitle.trim() || !meta.subtitle.trim()) {
        errors.push(`Empty cutscene meta for "${cid}" in ${lang}`);
      }
      const steps = CUTSCENE_STEPS[lang][cid];
      if (steps.length !== CUTSCENE_STEPS.pt[cid].length) {
        errors.push(`Cutscene "${cid}" step count mismatch in ${lang}`);
      }
      for (const step of steps) {
        if (!step.text.trim() || !step.speakerName.trim()) {
          errors.push(`Empty step "${step.id}" in cutscene "${cid}" (${lang})`);
        }
      }
    }

    for (const eid of endingIds) {
      const meta = ENDING_META[lang][eid];
      if (!meta.title.trim() || !meta.subtitle.trim() || !meta.routeHint.trim()) {
        errors.push(`Empty ending meta "${eid}" in ${lang}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      baseKeys: baseKeys.length,
      extendedKeys: extendedKeys.length,
      items: ALL_ITEM_IDS.length,
      prompts: promptKinds.length,
      objectives: objectiveKeys.length,
      alerts: alertKeys.length,
      diaryPages: 4,
      tapes: 2,
      cutscenes: cutsceneIds.length,
    },
  };
}
