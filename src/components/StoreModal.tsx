import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Film,
  Lock,
  Play,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import {
  ACHIEVEMENT_CATALOG,
  DIDDY_SKIN_COSMETICS,
  FLASHLIGHT_COSMETICS,
  GLOVE_COSMETICS,
  MAX_EQUIPPED_PERKS,
  PERK_CATALOG,
  getPerkRequirementStatus,
  saveSystem,
  type ProgressionStateV4,
} from '../game/saveSystem';
import {
  LORE_CHARACTER_PROFILES,
  type CharacterPortraitId,
} from '../game/portraitRenderer';
import type {
  AchievementCategory,
  DiddySkinId,
  EndingId,
  FlashlightColorId,
  GloveSkinId,
  PerkId,
} from '../game/types';
import {
  CoinSvgIcon,
  GalleryFilmSvgIcon,
  PerkSvgIcon,
  StoreBagSvgIcon,
  TrophySvgIcon,
} from './icons/GameIcons';
import { Stage3DViewport } from './Stage3DViewport';

export interface StoreModalProps {
  progression: ProgressionStateV4;
  onClose: () => void;
  onProgressionChange: (next: ProgressionStateV4) => void;
  onReplayEnding: (endingId: EndingId) => void;
  onDiddySkinChanged?: (skin: DiddySkinId) => void;
  onPlayClick?: () => void;
}

type MainTab = 'perks' | 'cosmetics' | 'achievements' | 'gallery';
type CosmeticSubTab = 'flashlight' | 'gloves' | 'diddy';
type AchievementFilter = 'all' | AchievementCategory;

interface EndingGalleryMeta {
  id: EndingId;
  code: string;
  title: string;
  subtitle: string;
  routeHint: string;
  accentClass: string;
  badgeClass: string;
}

const ENDING_GALLERY_META: readonly EndingGalleryMeta[] = [
  {
    id: 'bad',
    code: 'FINAL 01 // BAD ENDING',
    title: 'Contenção do Setor 09',
    subtitle: 'Capturado por P. Drizzy e arrastado para as celas do subsolo.',
    routeHint: 'Desbloqueado ao ser capturado em definitivo pelo Sujeito 09.',
    accentClass: 'border-red-500/50 bg-red-950/20',
    badgeClass: 'bg-red-950/90 border-red-500/70 text-red-300',
  },
  {
    id: 'good',
    code: 'FINAL 02 // GOOD ENDING',
    title: 'Fuga pelo Portão Norte',
    subtitle: 'Restaure o gerador, abra o cofre do subsolo e escape pelo Portão Blindado.',
    routeHint: 'Conclua a rota principal recuperando a Chave Mestra no cofre.',
    accentClass: 'border-emerald-500/50 bg-emerald-950/20',
    badgeClass: 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300',
  },
  {
    id: 'real',
    code: 'FINAL 03 // REAL ENDING',
    title: 'Resgate no Nível -2',
    subtitle: 'Corte a trava do Alçapão Vermelho e desça para resgatar o Vigia Marcos.',
    routeHint: 'Use o Alicate de Corte no Alçapão do Nível -2 após rastrear o sinal de Marcos.',
    accentClass: 'border-cyan-500/50 bg-cyan-950/20',
    badgeClass: 'bg-cyan-950/90 border-cyan-500/70 text-cyan-300',
  },
  {
    id: 'secret',
    code: 'FINAL 04 // SECRET ENDING',
    title: 'Dossiê Ômega Exposto',
    subtitle: 'Decifre o Terminal Secreto de 5 dígitos e vaze os arquivos do Projeto Ômega.',
    routeHint: 'Encontre todas as marcas UV, consulte o quadro de tradução e acesse o Terminal Ômega.',
    accentClass: 'border-violet-500/50 bg-violet-950/20',
    badgeClass: 'bg-violet-950/90 border-violet-500/70 text-violet-300',
  },
];

const CHAR_ACCENT_STYLES: Record<
  'amber' | 'emerald' | 'red' | 'cyan' | 'violet',
  { border: string; badge: string; dot: string }
> = {
  amber: {
    border: 'border-amber-500/50',
    badge: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
    dot: 'bg-amber-400',
  },
  emerald: {
    border: 'border-emerald-500/50',
    badge: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
    dot: 'bg-emerald-400',
  },
  red: {
    border: 'border-red-500/50',
    badge: 'bg-red-950/80 border-red-500/60 text-red-300',
    dot: 'bg-red-500',
  },
  cyan: {
    border: 'border-cyan-500/50',
    badge: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300',
    dot: 'bg-cyan-400',
  },
  violet: {
    border: 'border-violet-500/50',
    badge: 'bg-violet-950/80 border-violet-500/60 text-violet-300',
    dot: 'bg-violet-400',
  },
};

export const StoreModal: React.FC<StoreModalProps> = ({
  progression,
  onClose,
  onProgressionChange,
  onReplayEnding,
  onDiddySkinChanged,
  onPlayClick,
}) => {
  const [mainTab, setMainTab] = useState<MainTab>('perks');
  const [cosmeticSubTab, setCosmeticSubTab] = useState<CosmeticSubTab>('flashlight');
  const [previewFlashlight, setPreviewFlashlight] = useState<FlashlightColorId>(
    progression.cosmetics.equippedFlashlight
  );
  const [previewGlove, setPreviewGlove] = useState<GloveSkinId>(
    progression.cosmetics.equippedGloves
  );
  const [previewDiddySkin, setPreviewDiddySkin] = useState<DiddySkinId>(
    progression.cosmetics.equippedDiddySkin
  );
  const [achFilter, setAchFilter] = useState<AchievementFilter>('all');
  const [selectedCharId, setSelectedCharId] = useState<CharacterPortraitId>('diddy');

  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [importInput, setImportInput] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        onPlayClick?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, onPlayClick]);

  useEffect(() => {
    if (!feedback) return;
    const t = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(t);
  }, [feedback]);

  const showFeedback = (kind: 'ok' | 'err', text: string) => {
    setFeedback({ kind, text });
  };

  const unclaimedCount = useMemo(() => {
    let count = 0;
    for (const def of ACHIEVEMENT_CATALOG) {
      const rec = progression.achievements[def.id];
      if (rec?.unlocked && !rec.claimed) count += 1;
    }
    return count;
  }, [progression.achievements]);

  const unlockedAchCount = useMemo(() => {
    let count = 0;
    for (const def of ACHIEVEMENT_CATALOG) {
      if (progression.achievements[def.id]?.unlocked) count += 1;
    }
    return count;
  }, [progression.achievements]);

  const filteredAchievements = useMemo(() => {
    if (achFilter === 'all') return ACHIEVEMENT_CATALOG;
    return ACHIEVEMENT_CATALOG.filter((a) => a.category === achFilter);
  }, [achFilter]);

  const selectedCharProfile = useMemo(
    () =>
      LORE_CHARACTER_PROFILES.find((c) => c.id === selectedCharId) ?? LORE_CHARACTER_PROFILES[0],
    [selectedCharId]
  );

  // Handlers
  const handleBuyPerk = (perkId: PerkId) => {
    onPlayClick?.();
    const res = saveSystem.buyPerk(perkId);
    onProgressionChange(res.progression);
    showFeedback(res.ok ? 'ok' : 'err', res.message);
  };

  const handleTogglePerk = (perkId: PerkId) => {
    onPlayClick?.();
    const res = saveSystem.toggleEquipPerk(perkId);
    onProgressionChange(res.progression);
    showFeedback(res.ok ? 'ok' : 'err', res.message);
  };

  const handleBuyOrEquipFlashlight = (id: FlashlightColorId) => {
    onPlayClick?.();
    setPreviewFlashlight(id);
    const res = saveSystem.buyOrEquipFlashlight(id);
    onProgressionChange(res.progression);
    showFeedback(res.ok ? 'ok' : 'err', res.message);
  };

  const handleBuyOrEquipGloves = (id: GloveSkinId) => {
    onPlayClick?.();
    setPreviewGlove(id);
    const res = saveSystem.buyOrEquipGloves(id);
    onProgressionChange(res.progression);
    showFeedback(res.ok ? 'ok' : 'err', res.message);
  };

  const handleBuyOrEquipDiddySkin = (id: DiddySkinId) => {
    onPlayClick?.();
    setPreviewDiddySkin(id);
    const res = saveSystem.buyOrEquipDiddySkin(id);
    onProgressionChange(res.progression);
    if (res.ok) {
      onDiddySkinChanged?.(id);
    }
    showFeedback(res.ok ? 'ok' : 'err', res.message);
  };

  const handleClaimAchievement = (id: (typeof ACHIEVEMENT_CATALOG)[number]['id']) => {
    onPlayClick?.();
    const res = saveSystem.claimAchievementReward(id);
    onProgressionChange(res.progression);
    if (res.ok) {
      showFeedback('ok', `+${res.coinsAwarded} Moedas de Sobrevivência resgatadas!`);
    }
  };

  const handleExportBackup = () => {
    onPlayClick?.();
    const code = saveSystem.exportBackup();
    setBackupCode(code);
    showFeedback('ok', 'Código de Backup Save v4 gerado.');
  };

  const handleCopyBackup = async () => {
    onPlayClick?.();
    if (!backupCode) return;
    try {
      await navigator.clipboard.writeText(backupCode);
      showFeedback('ok', 'Código copiado para a área de transferência.');
    } catch {
      showFeedback('err', 'Selecione e copie o código manualmente.');
    }
  };

  const handleImportBackup = () => {
    onPlayClick?.();
    const res = saveSystem.importBackup(importInput);
    if (!res.ok || !res.data) {
      showFeedback('err', res.error ?? 'Falha ao importar backup.');
      return;
    }
    onProgressionChange(res.data.progression);
    setImportInput('');
    showFeedback('ok', 'Backup Save v4 restaurado com sucesso!');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Central Tática e Loja 3D"
      data-testid="store-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-6xl h-full max-h-[94vh] flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Tactical Header */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-amber-500/35 bg-slate-950/92 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-1.5 h-7 bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.7)] shrink-0" />
            <div className="min-w-0">
              <h2 className="font-horror text-lg sm:text-2xl font-extrabold tracking-wider uppercase text-white leading-none truncate">
                CENTRAL TÁTICA · SETOR 09
              </h2>
              <div className="text-[10px] font-tech uppercase tracking-[0.16em] text-amber-400/90 mt-0.5 truncate">
                PERKS · LOJA 3D · CONQUISTAS · DOSSIÊ ÔMEGA
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live Survival Coins Balance */}
            <div
              data-testid="store-coins-balance"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-950/55 border border-amber-500/60 text-amber-200"
            >
              <CoinSvgIcon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="font-tech font-extrabold text-xs sm:text-sm tracking-wide">
                {progression.survivalCoins.toLocaleString('pt-BR')}
              </span>
              <span className="hidden md:inline text-[10px] font-tech uppercase text-amber-300/80">
                MOEDAS
              </span>
            </div>

            <button
              type="button"
              data-testid="store-close-btn"
              onClick={() => {
                onPlayClick?.();
                onClose();
              }}
              aria-label="Fechar central tática"
              className="horror-btn horror-btn-danger px-3 py-1.5 text-[11px] font-tech font-bold uppercase text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* 4 Main Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Seções da Central Tática"
          className="grid grid-cols-4 gap-1.5 px-3 py-2 sm:px-5 bg-slate-950/95 border-b border-slate-800 shrink-0"
        >
          {(
            [
              {
                id: 'perks' as const,
                label: 'Perks Táticos',
                short: 'Perks',
                badge: `${progression.equippedPerks.length}/${MAX_EQUIPPED_PERKS}`,
                renderIcon: () => <PerkSvgIcon className="w-4 h-4 shrink-0" />,
              },
              {
                id: 'cosmetics' as const,
                label: 'Loja 3D Cosméticos',
                short: 'Loja 3D',
                badge: null,
                renderIcon: () => <StoreBagSvgIcon className="w-4 h-4 shrink-0" />,
              },
              {
                id: 'achievements' as const,
                label: 'Conquistas',
                short: 'Conquistas',
                badge: unclaimedCount > 0 ? `+${unclaimedCount}` : `${unlockedAchCount}/24`,
                highlight: unclaimedCount > 0,
                renderIcon: () => <TrophySvgIcon className="w-4 h-4 shrink-0" />,
              },
              {
                id: 'gallery' as const,
                label: 'Galeria & Inspetor 3D',
                short: 'Galeria 3D',
                badge: `${progression.unlockedEndings.length}/4`,
                renderIcon: () => <GalleryFilmSvgIcon className="w-4 h-4 shrink-0" />,
              },
            ]
          ).map((t) => {
            const active = mainTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                data-testid={`store-tab-${t.id}`}
                aria-selected={active}
                onClick={() => {
                  onPlayClick?.();
                  setMainTab(t.id);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1.5 sm:px-2.5 text-[10px] sm:text-xs font-tech font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                  active
                    ? 'bg-red-950/75 border-amber-400 text-amber-200 shadow-[0_0_14px_rgba(245,158,11,0.22)]'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100'
                }`}
              >
                {t.renderIcon()}
                <span className="hidden sm:inline truncate">{t.label}</span>
                <span className="sm:hidden truncate">{t.short}</span>
                {t.badge && (
                  <span
                    className={`hidden md:inline-block px-1.5 py-0.5 text-[9px] font-tech font-extrabold border ${
                      t.highlight
                        ? 'bg-amber-500/25 border-amber-400 text-amber-200 animate-pulse'
                        : active
                        ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Instant Feedback Strip */}
        {feedback && (
          <div
            role="status"
            className={`px-4 py-1.5 text-xs font-tech font-bold uppercase tracking-wider border-b shrink-0 flex items-center justify-between ${
              feedback.kind === 'ok'
                ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                : 'bg-red-950/85 border-red-500/50 text-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-current opacity-75 hover:opacity-100 cursor-pointer"
              aria-label="Dispensar aviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto horror-scroll p-3 sm:p-5">
          {/* ================================================================
              ABA 1 — PERKS TÁTICOS
              ================================================================ */}
          {mainTab === 'perks' && (
            <div className="space-y-4">
              {/* Top Equipped Slots Bar */}
              <div className="p-3 bg-slate-950/85 border border-amber-500/35">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="text-xs font-horror tracking-wider uppercase text-amber-300">
                    LOADOUT ATIVO ({progression.equippedPerks.length}/{MAX_EQUIPPED_PERKS} SLOTS)
                  </div>
                  <div className="text-[10px] font-tech uppercase text-slate-400">
                    APLICADO AUTOMATICAMENTE AO INICIAR A PARTIDA
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {Array.from({ length: MAX_EQUIPPED_PERKS }).map((_, idx) => {
                    const equippedId = progression.equippedPerks[idx];
                    const def = equippedId
                      ? PERK_CATALOG.find((p) => p.id === equippedId)
                      : null;
                    return (
                      <div
                        key={idx}
                        data-testid={`equipped-perk-slot-${idx}`}
                        className={`flex items-center justify-between gap-2 p-2.5 border ${
                          def
                            ? 'bg-emerald-950/35 border-emerald-500/60 text-emerald-100'
                            : 'bg-slate-900/60 border-dashed border-slate-700 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {def ? (
                            <PerkSvgIcon
                              kind={def.iconKind}
                              className="w-7 h-7 text-emerald-400 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 border border-slate-700/80 bg-slate-950/80 flex items-center justify-center text-[10px] font-tech text-slate-600 shrink-0">
                              0{idx + 1}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold uppercase tracking-wide truncate">
                              {def ? def.name : `SLOT TÁTICO 0${idx + 1} VAZIO`}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {def ? def.shortDesc : 'Equipe uma Perk desbloqueada abaixo'}
                            </div>
                          </div>
                        </div>
                        {def && (
                          <button
                            type="button"
                            onClick={() => handleTogglePerk(def.id)}
                            aria-label={`Desequipar ${def.name}`}
                            className="horror-btn px-2 py-1 text-[10px] font-tech uppercase text-red-300 border-red-500/40 shrink-0 cursor-pointer"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All 12 Perks Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PERK_CATALOG.map((perk) => {
                  const unlocked = progression.unlockedPerks.includes(perk.id);
                  const equipped = progression.equippedPerks.includes(perk.id);
                  const req = getPerkRequirementStatus(progression, perk.id);
                  const canAfford = progression.survivalCoins >= perk.cost;
                  const slotsFull = progression.equippedPerks.length >= MAX_EQUIPPED_PERKS;
                  const isPrestige = perk.tier === 'prestige';

                  return (
                    <div
                      key={perk.id}
                      data-testid={`perk-card-${perk.id}`}
                      className={`flex flex-col justify-between p-3 border transition-colors ${
                        equipped
                          ? 'bg-emerald-950/30 border-emerald-400/75 shadow-[0_0_16px_rgba(16,185,129,0.14)]'
                          : isPrestige
                          ? 'bg-gradient-to-b from-purple-950/30 to-slate-950/90 border-purple-500/50'
                          : 'bg-slate-900/80 border-slate-700/85'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <PerkSvgIcon
                              kind={perk.iconKind}
                              className={`w-9 h-9 shrink-0 ${
                                equipped
                                  ? 'text-emerald-400'
                                  : isPrestige
                                  ? 'text-purple-400'
                                  : 'text-amber-400'
                              }`}
                            />
                            <div className="min-w-0">
                              <h3 className="text-sm font-horror font-extrabold tracking-wider uppercase text-white leading-tight truncate">
                                {perk.name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span
                                  className={`px-1.5 py-0.5 text-[9px] font-tech font-bold uppercase border ${
                                    isPrestige
                                      ? 'bg-purple-950/80 border-purple-400/70 text-purple-200'
                                      : 'bg-slate-800/90 border-slate-600 text-slate-300'
                                  }`}
                                >
                                  {isPrestige ? 'PRESTÍGIO' : 'BASE'}
                                </span>
                                {equipped && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-tech font-bold uppercase bg-emerald-950/90 border border-emerald-400/70 text-emerald-300">
                                    ATIVA
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs font-semibold text-amber-200/95 mt-2.5">
                          {perk.shortDesc}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {perk.detailedDesc}
                        </p>

                        {/* Exact Prestige Lock Reason */}
                        {!unlocked && !req.met && req.reason && (
                          <div className="mt-2.5 p-2 bg-red-950/55 border border-red-500/50 text-[10px] font-tech text-red-200 flex items-start gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                            <span>{req.reason}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/90">
                        {unlocked ? (
                          <button
                            type="button"
                            data-testid={`perk-action-${perk.id}`}
                            disabled={!equipped && slotsFull}
                            onClick={() => handleTogglePerk(perk.id)}
                            className={`w-full py-1.5 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                              equipped
                                ? 'bg-emerald-900/75 border-emerald-400 text-emerald-100 hover:bg-emerald-800/80'
                                : slotsFull
                                ? 'bg-slate-900 border-slate-700 text-slate-500 cursor-not-allowed'
                                : 'horror-btn text-amber-200'
                            }`}
                          >
                            {equipped ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Equipada · Remover</span>
                              </>
                            ) : slotsFull ? (
                              <span>Limite {MAX_EQUIPPED_PERKS}/{MAX_EQUIPPED_PERKS} Atingido</span>
                            ) : (
                              <span>Equipar no Loadout</span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid={`perk-action-${perk.id}`}
                            disabled={!req.met || !canAfford}
                            onClick={() => handleBuyPerk(perk.id)}
                            className={`w-full py-1.5 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 ${
                              req.met && canAfford
                                ? 'horror-btn border-amber-400/80 text-amber-200 cursor-pointer'
                                : 'bg-slate-950/90 border-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {!req.met ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Requisito Bloqueado</span>
                              </>
                            ) : (
                              <>
                                <CoinSvgIcon className="w-4 h-4" />
                                <span>
                                  Comprar · {perk.cost.toLocaleString('pt-BR')}
                                </span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 2 — LOJA 3D COSMÉTICOS
              ================================================================ */}
          {mainTab === 'cosmetics' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: Live 3D Stage Viewport */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <Stage3DViewport
                  mode={cosmeticSubTab}
                  flashlightId={previewFlashlight}
                  gloveId={previewGlove}
                  diddySkinId={previewDiddySkin}
                  className="w-full h-64 sm:h-80 lg:h-[420px]"
                  label={
                    cosmeticSubTab === 'flashlight'
                      ? 'INSPEÇÃO 3D · LANTERNA TÁTICA'
                      : cosmeticSubTab === 'gloves'
                      ? 'INSPEÇÃO 3D · LUVAS 1ª PESSOA'
                      : 'INSPEÇÃO 3D · SUJEITO 09 (P. DRIZZY)'
                  }
                />
                <div className="p-2.5 bg-slate-950/85 border border-slate-800 text-[11px] font-tech text-slate-400 flex items-center justify-between">
                  <span>COSMÉTICOS PURAMENTE VISUAIS</span>
                  <span className="text-amber-300">60 FPS MOBILE</span>
                </div>
              </div>

              {/* Right: Sub-tabs & Cosmetic Catalog */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                {/* 3 Sub-tabs */}
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'flashlight' as const, label: 'Cores de Lanterna' },
                      { id: 'gloves' as const, label: 'Luvas 1ª Pessoa' },
                      { id: 'diddy' as const, label: 'Visuais P. Drizzy' },
                    ]
                  ).map((st) => {
                    const active = cosmeticSubTab === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        data-testid={`cosmetic-subtab-${st.id}`}
                        onClick={() => {
                          onPlayClick?.();
                          setCosmeticSubTab(st.id);
                        }}
                        className={`py-2 px-2 text-[10px] sm:text-xs font-tech font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                          active
                            ? 'bg-amber-950/65 border-amber-400 text-amber-200'
                            : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>

                {/* Flashlight Colors List */}
                {cosmeticSubTab === 'flashlight' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FLASHLIGHT_COSMETICS.map((item) => {
                      const owned = progression.cosmetics.unlockedFlashlights.includes(item.id);
                      const equipped = progression.cosmetics.equippedFlashlight === item.id;
                      const selected = previewFlashlight === item.id;
                      const canAfford = progression.survivalCoins >= item.cost;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setPreviewFlashlight(item.id)}
                          className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                            selected
                              ? 'bg-slate-900 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.18)]'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-4 h-4 rounded-full border border-white/40 shrink-0 shadow"
                                  style={{ backgroundColor: item.swatchCss }}
                                />
                                <h4 className="text-sm font-horror font-bold uppercase tracking-wider text-white truncate">
                                  {item.name}
                                </h4>
                              </div>
                              {equipped && (
                                <span className="px-1.5 py-0.5 text-[9px] font-tech font-bold uppercase bg-emerald-950 border border-emerald-400/70 text-emerald-300 shrink-0">
                                  EQUIPADA
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                              {item.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            data-testid={`cosmetic-flashlight-${item.id}`}
                            disabled={!owned && !canAfford}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyOrEquipFlashlight(item.id);
                            }}
                            className={`mt-3 w-full py-1.5 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 ${
                              equipped
                                ? 'bg-emerald-950/75 border-emerald-500/70 text-emerald-200 cursor-default'
                                : owned
                                ? 'horror-btn text-amber-200 cursor-pointer'
                                : canAfford
                                ? 'horror-btn border-amber-400/80 text-amber-200 cursor-pointer'
                                : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {equipped ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Equipada</span>
                              </>
                            ) : owned ? (
                              <span>Equipar</span>
                            ) : (
                              <>
                                <CoinSvgIcon className="w-4 h-4" />
                                <span>Comprar · {item.cost}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Gloves List */}
                {cosmeticSubTab === 'gloves' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {GLOVE_COSMETICS.map((item) => {
                      const owned = progression.cosmetics.unlockedGloves.includes(item.id);
                      const equipped = progression.cosmetics.equippedGloves === item.id;
                      const selected = previewGlove === item.id;
                      const canAfford = progression.survivalCoins >= item.cost;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setPreviewGlove(item.id)}
                          className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                            selected
                              ? 'bg-slate-900 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.18)]'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-4 h-4 rounded-sm border border-white/35 shrink-0"
                                  style={{ backgroundColor: item.swatchCss }}
                                />
                                <h4 className="text-sm font-horror font-bold uppercase tracking-wider text-white truncate">
                                  {item.name}
                                </h4>
                              </div>
                              {equipped && (
                                <span className="px-1.5 py-0.5 text-[9px] font-tech font-bold uppercase bg-emerald-950 border border-emerald-400/70 text-emerald-300 shrink-0">
                                  EQUIPADA
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                              {item.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            data-testid={`cosmetic-glove-${item.id}`}
                            disabled={!owned && !canAfford}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyOrEquipGloves(item.id);
                            }}
                            className={`mt-3 w-full py-1.5 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 ${
                              equipped
                                ? 'bg-emerald-950/75 border-emerald-500/70 text-emerald-200 cursor-default'
                                : owned
                                ? 'horror-btn text-amber-200 cursor-pointer'
                                : canAfford
                                ? 'horror-btn border-amber-400/80 text-amber-200 cursor-pointer'
                                : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {equipped ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Equipada</span>
                              </>
                            ) : owned ? (
                              <span>Equipar</span>
                            ) : (
                              <>
                                <CoinSvgIcon className="w-4 h-4" />
                                <span>Comprar · {item.cost}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* P. Drizzy Skins List */}
                {cosmeticSubTab === 'diddy' && (
                  <div className="grid grid-cols-1 gap-2.5">
                    {DIDDY_SKIN_COSMETICS.map((item) => {
                      const owned = progression.cosmetics.unlockedDiddySkins.includes(item.id);
                      const equipped = progression.cosmetics.equippedDiddySkin === item.id;
                      const selected = previewDiddySkin === item.id;
                      const canAfford = progression.survivalCoins >= item.cost;

                      return (
                        <div
                          key={item.id}
                          onClick={() => setPreviewDiddySkin(item.id)}
                          className={`p-3 border cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            selected
                              ? 'bg-slate-900 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.18)]'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                                style={{ backgroundColor: item.swatchCss }}
                              />
                              <h4 className="text-sm font-horror font-bold uppercase tracking-wider text-white truncate">
                                {item.name}
                              </h4>
                              {equipped && (
                                <span className="px-1.5 py-0.5 text-[9px] font-tech font-bold uppercase bg-emerald-950 border border-emerald-400/70 text-emerald-300 shrink-0">
                                  ATIVO NO COMPLEXO
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {item.description}
                            </p>
                          </div>

                          <button
                            type="button"
                            data-testid={`cosmetic-diddy-${item.id}`}
                            disabled={!owned && !canAfford}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyOrEquipDiddySkin(item.id);
                            }}
                            className={`sm:w-44 shrink-0 py-1.5 px-3 text-xs font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 ${
                              equipped
                                ? 'bg-emerald-950/75 border-emerald-500/70 text-emerald-200 cursor-default'
                                : owned
                                ? 'horror-btn text-amber-200 cursor-pointer'
                                : canAfford
                                ? 'horror-btn border-amber-400/80 text-amber-200 cursor-pointer'
                                : 'bg-slate-950 border-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            {equipped ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Equipado</span>
                              </>
                            ) : owned ? (
                              <span>Equipar Visual</span>
                            ) : (
                              <>
                                <CoinSvgIcon className="w-4 h-4" />
                                <span>Comprar · {item.cost}</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 3 — CONQUISTAS + BACKUP SAVE V4
              ================================================================ */}
          {mainTab === 'achievements' && (
            <div className="space-y-4">
              {/* Summary + Category Filter Pills */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-slate-950/85 border border-slate-800">
                <div className="flex items-center gap-2.5">
                  <TrophySvgIcon className="w-6 h-6 shrink-0" />
                  <div>
                    <div className="text-xs font-horror font-bold uppercase tracking-wider text-white">
                      CONQUISTAS DESBLOQUEADAS: {unlockedAchCount} / {ACHIEVEMENT_CATALOG.length}
                    </div>
                    <div className="text-[10px] font-tech uppercase text-slate-400">
                      {unclaimedCount > 0
                        ? `${unclaimedCount} RECOMPENSA(S) PRONTA(S) PARA RESGATE`
                        : 'RESGATE MOEDAS DE SOBREVIVÊNCIA AO CONCLUIR METAS'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                  {(
                    [
                      { id: 'all' as const, label: 'Todas' },
                      { id: 'story' as const, label: 'História' },
                      { id: 'challenge' as const, label: 'Desafio' },
                      { id: 'exploration' as const, label: 'Exploração' },
                      { id: 'arsenal' as const, label: 'Arsenal' },
                    ]
                  ).map((cat) => {
                    const active = achFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        data-testid={`ach-filter-${cat.id}`}
                        onClick={() => {
                          onPlayClick?.();
                          setAchFilter(cat.id);
                        }}
                        className={`px-2.5 py-1 text-[10px] font-tech font-bold uppercase tracking-wider border cursor-pointer ${
                          active
                            ? 'bg-amber-950/75 border-amber-400 text-amber-200'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-100'
                        }`}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Achievements List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {filteredAchievements.map((ach) => {
                  const rec = progression.achievements[ach.id] ?? {
                    progress: 0,
                    unlocked: false,
                    unlockedAt: null,
                    claimed: false,
                  };
                  const pct = Math.min(100, Math.round((rec.progress / Math.max(1, ach.target)) * 100));
                  const isSecretHidden = Boolean(ach.hidden && !rec.unlocked);
                  const canClaim = rec.unlocked && !rec.claimed;

                  return (
                    <div
                      key={ach.id}
                      data-testid={`achievement-card-${ach.id}`}
                      className={`p-3 border flex flex-col justify-between gap-2.5 ${
                        canClaim
                          ? 'bg-amber-950/30 border-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.16)]'
                          : rec.claimed
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-slate-900/75 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <TrophySvgIcon
                            className={`w-7 h-7 shrink-0 mt-0.5 ${
                              rec.unlocked ? 'opacity-100' : 'opacity-35 grayscale'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-horror font-bold uppercase tracking-wider text-white">
                                {isSecretHidden ? 'ARQUIVO CONFIDENCIAL' : ach.title}
                              </h4>
                              <span className="px-1.5 py-0.5 text-[9px] font-tech uppercase bg-slate-950 border border-slate-700 text-slate-400">
                                {ach.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              {isSecretHidden
                                ? 'Execute ações táticas secretas no Setor 09 para revelar este registro.'
                                : ach.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-950/90 border border-amber-500/40 text-amber-300 text-[11px] font-tech font-bold shrink-0">
                          <CoinSvgIcon className="w-3.5 h-3.5" />
                          <span>+{ach.rewardCoins}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-[10px] font-tech text-slate-400 mb-1">
                            <span>PROGRESSO</span>
                            <span>
                              {rec.progress}/{ach.target} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-950 border border-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                rec.unlocked ? 'bg-emerald-400' : 'bg-amber-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {canClaim ? (
                          <button
                            type="button"
                            data-testid={`claim-ach-${ach.id}`}
                            onClick={() => handleClaimAchievement(ach.id)}
                            className="horror-btn border-amber-400 bg-amber-900/60 text-amber-100 px-3 py-1.5 text-[11px] font-tech font-extrabold uppercase tracking-wider cursor-pointer shrink-0 whitespace-nowrap"
                          >
                            Resgatar +{ach.rewardCoins}
                          </button>
                        ) : rec.claimed ? (
                          <span className="px-2.5 py-1 text-[10px] font-tech font-bold uppercase bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 flex items-center gap-1 shrink-0">
                            <Check className="w-3 h-3" />
                            Resgatado
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-[10px] font-tech uppercase text-slate-500 shrink-0">
                            Bloqueada
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Compact Collapsible Save v4 Backup Export/Import Panel */}
              <div className="border border-slate-700/90 bg-slate-950/85">
                <button
                  type="button"
                  data-testid="backup-panel-toggle"
                  onClick={() => {
                    onPlayClick?.();
                    setBackupOpen((v) => !v);
                  }}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-tech font-bold uppercase tracking-wider text-slate-300 hover:text-amber-300 cursor-pointer"
                >
                  <span>Backup Portátil Save v4 (Exportar / Importar Progresso)</span>
                  {backupOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {backupOpen && (
                  <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Export */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-tech uppercase text-amber-300">
                        Exportar Código Save v4
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleExportBackup}
                          className="horror-btn px-3 py-1.5 text-[11px] font-tech font-bold uppercase flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Gerar Código</span>
                        </button>
                        {backupCode && (
                          <button
                            type="button"
                            onClick={handleCopyBackup}
                            className="horror-btn px-3 py-1.5 text-[11px] font-tech font-bold uppercase flex items-center gap-1.5 cursor-pointer text-emerald-300"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar</span>
                          </button>
                        )}
                      </div>
                      <textarea
                        readOnly
                        value={backupCode}
                        placeholder="Clique em Gerar Código para exportar seu progresso completo..."
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 p-2 text-[10px] font-tech text-slate-200 resize-none select-text focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Import */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-tech uppercase text-cyan-300">
                        Importar Código Save v4
                      </div>
                      <textarea
                        value={importInput}
                        onChange={(e) => setImportInput(e.target.value)}
                        placeholder="Cole aqui um código DC09V4:... válido"
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 p-2 text-[10px] font-tech text-slate-200 resize-none select-text focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        disabled={!importInput.trim()}
                        onClick={handleImportBackup}
                        className={`horror-btn px-3 py-1.5 text-[11px] font-tech font-bold uppercase flex items-center gap-1.5 ${
                          importInput.trim()
                            ? 'text-cyan-200 border-cyan-500/60 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Restaurar Backup</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 4 — GALERIA DE FINAIS & INSPETOR 3D DE PERSONAGENS
              ================================================================ */}
          {mainTab === 'gallery' && (
            <div className="space-y-5">
              {/* Section A: 4 Endings Gallery */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Film className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-horror font-extrabold uppercase tracking-wider text-white">
                      GALERIA DE FINAIS CINEMATOGRÁFICOS ({progression.unlockedEndings.length}/4)
                    </h3>
                  </div>
                  <span className="text-[10px] font-tech uppercase text-slate-400">
                    REASSISTA QUALQUER FINAL DESBLOQUEADO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {ENDING_GALLERY_META.map((end) => {
                    const unlocked = progression.unlockedEndings.includes(end.id);
                    return (
                      <div
                        key={end.id}
                        data-testid={`ending-card-${end.id}`}
                        className={`p-3 border flex flex-col justify-between gap-2.5 ${
                          unlocked
                            ? end.accentClass
                            : 'bg-slate-950/85 border-slate-800 opacity-85'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`px-1.5 py-0.5 text-[9px] font-tech font-bold uppercase border ${
                                unlocked
                                  ? end.badgeClass
                                  : 'bg-slate-900 border-slate-700 text-slate-500'
                              }`}
                            >
                              {end.code}
                            </span>
                            {!unlocked && <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                          </div>
                          <h4 className="text-sm font-horror font-extrabold uppercase tracking-wider text-white mt-2">
                            {unlocked ? end.title : 'FINAL BLOQUEADO'}
                          </h4>
                          <p className="text-[11px] text-slate-300/90 mt-1 leading-snug">
                            {unlocked ? end.subtitle : end.routeHint}
                          </p>
                        </div>

                        <button
                          type="button"
                          data-testid={`replay-ending-${end.id}`}
                          disabled={!unlocked}
                          onClick={() => {
                            onPlayClick?.();
                            onReplayEnding(end.id);
                          }}
                          className={`w-full py-1.5 px-2.5 text-[11px] font-tech font-bold uppercase tracking-wider border flex items-center justify-center gap-1.5 ${
                            unlocked
                              ? 'horror-btn text-amber-200 border-amber-400/70 cursor-pointer'
                              : 'bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          {unlocked ? (
                            <>
                              <Play className="w-3.5 h-3.5" />
                              <span>Reassistir Cutscene</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Não Desbloqueado</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section B: 3D Character Inspector (5 Characters) */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-horror font-extrabold uppercase tracking-wider text-white">
                    INSPETOR 3D DE PERSONAGENS · ARQUIVO CONFIDENCIAL
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {LORE_CHARACTER_PROFILES.map((char) => {
                      const active = selectedCharId === char.id;
                      return (
                        <button
                          key={char.id}
                          type="button"
                          data-testid={`inspector-char-${char.id}`}
                          onClick={() => {
                            onPlayClick?.();
                            setSelectedCharId(char.id);
                          }}
                          className={`px-2.5 py-1 text-[10px] font-tech font-bold uppercase tracking-wider border cursor-pointer transition-colors ${
                            active
                              ? 'bg-red-950/75 border-amber-400 text-amber-200'
                              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-100'
                          }`}
                        >
                          {char.name.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  <div className="lg:col-span-5">
                    <Stage3DViewport
                      mode="character"
                      characterId={selectedCharProfile.id}
                      diddySkinId={progression.cosmetics.equippedDiddySkin}
                      className="w-full h-64 sm:h-80 lg:h-[360px]"
                      label={`MODELO 3D · ${selectedCharProfile.codename}`}
                    />
                  </div>

                  <div
                    className={`lg:col-span-7 p-4 bg-slate-950/90 border flex flex-col justify-between gap-3 ${
                      CHAR_ACCENT_STYLES[selectedCharProfile.accent].border
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <div className="text-[10px] font-tech uppercase tracking-[0.18em] text-slate-400">
                            {selectedCharProfile.codename}
                          </div>
                          <h4 className="text-xl font-horror font-extrabold uppercase tracking-wider text-white mt-0.5">
                            {selectedCharProfile.name}
                          </h4>
                          <div className="text-xs text-slate-300 mt-0.5">
                            {selectedCharProfile.role}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-tech font-bold uppercase border ${
                              CHAR_ACCENT_STYLES[selectedCharProfile.accent].badge
                            }`}
                          >
                            {selectedCharProfile.clearance}
                          </span>
                          <span className="text-[10px] font-tech uppercase text-slate-400 flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                CHAR_ACCENT_STYLES[selectedCharProfile.accent].dot
                              }`}
                            />
                            {selectedCharProfile.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        {selectedCharProfile.summary}
                      </p>

                      <div>
                        <div className="text-[10px] font-tech font-bold uppercase tracking-[0.16em] text-amber-400 mb-1.5">
                          NOTAS DO DOSSIÊ CONFIDENCIAL
                        </div>
                        <ul className="space-y-1.5">
                          {selectedCharProfile.dossierNotes.map((note, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-slate-300 pl-3 border-l-2 border-amber-500/50 leading-relaxed"
                            >
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-tech uppercase text-slate-500">
                      <span>ARQUIVO ÔMEGA // SETOR 09</span>
                      <span>MODELO VOXEL EM TEMPO REAL</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
