import React, { useEffect, useState } from 'react';
import { Lock, Play, Square, X } from 'lucide-react';
import type { JournalSnapshot } from '../game/types';
import {
  LORE_CHARACTER_PROFILES,
  type CharacterPortraitId,
} from '../game/portraitRenderer';
import {
  CharacterBadgeIcon,
  DossierFolderIcon,
  SafeDialIcon,
  UvLensIcon,
  VhsTapeIcon,
} from './icons/GameIcons';

interface JournalModalProps {
  journal: JournalSnapshot;
  portraits?: Record<CharacterPortraitId, string>;
  onClose: () => void;
}

type JournalTab = 'safe' | 'uv' | 'tapes' | 'dossiers' | 'characters';

export const JournalModal: React.FC<JournalModalProps> = ({
  journal,
  portraits,
  onClose,
}) => {
  const [tab, setTab] = useState<JournalTab>('safe');
  const [selectedTapeId, setSelectedTapeId] = useState<string | null>(
    () => journal.cassettes.find((c) => c.listened)?.id ?? journal.cassettes[0]?.id ?? null
  );
  const [playingTape, setPlayingTape] = useState<boolean>(false);
  const [selectedCharId, setSelectedCharId] = useState<CharacterPortraitId>('diddy');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyJ') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sortedClues = [...journal.clues].sort((a, b) => a.digitIndex - b.digitIndex);
  const discoveredClues = sortedClues.filter((c) => c.discovered).length;
  const discoveredUv = journal.uvMarks.filter((m) => m.discovered).length;
  const listenedTapes = journal.cassettes.filter((t) => t.listened).length;
  const dossiersUnlocked = journal.omegaDossiers.filter((d) => d.unlocked).length;

  const activeTape =
    journal.cassettes.find((c) => c.id === selectedTapeId) ?? journal.cassettes[0] ?? null;
  const activeProfile =
    LORE_CHARACTER_PROFILES.find((p) => p.id === selectedCharId) ?? LORE_CHARACTER_PROFILES[0];

  const accentBadgeMap = {
    amber: 'border-amber-400/70 bg-amber-950/50 text-amber-300',
    emerald: 'border-emerald-400/70 bg-emerald-950/50 text-emerald-300',
    red: 'border-red-500/80 bg-red-950/60 text-red-300',
    violet: 'border-purple-400/70 bg-purple-950/50 text-purple-300',
    cyan: 'border-cyan-400/70 bg-cyan-950/50 text-cyan-300',
  } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Diário de Investigação e Dossiês do Setor 09"
      data-testid="journal-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 select-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-4xl max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Confidential Folder Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-amber-500/35 bg-slate-950/85 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-950/75 border border-amber-500/60 text-amber-300 shrink-0">
              <DossierFolderIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-horror text-lg sm:text-xl font-extrabold tracking-wider text-amber-300 truncate">
                  PASTA CONFIDENCIAL · SETOR 09
                </h2>
                <span className="hidden sm:inline font-tech text-[9px] font-bold uppercase px-1.5 py-0.5 bg-red-950/80 border border-red-500/50 text-red-300">
                  SIGILO ÔMEGA
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-tech text-slate-400 truncate">
                NOTAS DO COFRE · PISTAS UV/ARG · FITAS VHS · DOSSIÊS · FICHAS DE PESSOAL
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="journal-close-btn"
            onClick={onClose}
            aria-label="Fechar diário"
            className="horror-btn horror-btn-danger px-3 py-1.5 text-xs font-tech font-bold uppercase flex items-center gap-1 cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fechar</span>
          </button>
        </div>

        {/* 5 Tactical Folder Tabs */}
        <div
          role="tablist"
          aria-label="Abas do Diário"
          className="grid grid-cols-5 border-b border-slate-700/80 bg-slate-950/90 shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'safe'}
            data-testid="journal-tab-safe"
            onClick={() => setTab('safe')}
            className={`py-2.5 px-1 text-[10px] sm:text-xs font-tech font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              tab === 'safe'
                ? 'border-amber-400 text-amber-300 bg-amber-950/35'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <SafeDialIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Cofre ({discoveredClues}/4)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'uv'}
            data-testid="journal-tab-uv"
            onClick={() => setTab('uv')}
            className={`py-2.5 px-1 text-[10px] sm:text-xs font-tech font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              tab === 'uv'
                ? 'border-purple-400 text-purple-300 bg-purple-950/35'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <UvLensIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">UV ({discoveredUv}/{journal.uvMarks.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tapes'}
            data-testid="journal-tab-tapes"
            onClick={() => setTab('tapes')}
            className={`py-2.5 px-1 text-[10px] sm:text-xs font-tech font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              tab === 'tapes'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-950/35'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <VhsTapeIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">VHS ({listenedTapes}/{journal.cassettes.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'dossiers'}
            data-testid="journal-tab-dossiers"
            onClick={() => setTab('dossiers')}
            className={`py-2.5 px-1 text-[10px] sm:text-xs font-tech font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              tab === 'dossiers'
                ? 'border-emerald-400 text-emerald-300 bg-emerald-950/35'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <DossierFolderIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Ômega ({dossiersUnlocked}/{journal.omegaDossiers.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'characters'}
            data-testid="journal-tab-characters"
            onClick={() => setTab('characters')}
            className={`py-2.5 px-1 text-[10px] sm:text-xs font-tech font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer border-b-2 transition-colors ${
              tab === 'characters'
                ? 'border-red-400 text-red-300 bg-red-950/35'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <CharacterBadgeIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Fichas (5)</span>
          </button>
        </div>

        {/* Scrollable Tab Body */}
        <div className="flex-1 overflow-y-auto horror-scroll p-3 sm:p-4">
          {/* TAB 1: SAFE NOTES */}
          {tab === 'safe' && (
            <div className="space-y-3">
              {/* Reconstructed 4-Digit Combination Strip */}
              <div className="p-3 bg-slate-950/85 border border-amber-500/40 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-tech text-[10px] uppercase tracking-[0.16em] text-amber-400 font-bold">
                    COMBINAÇÃO DO COFRE SUBTERRÂNEO
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Colete os 4 bilhetes de auditoria espalhados pelo Térreo e Subsolo.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {sortedClues.map((c) => (
                    <div
                      key={c.id}
                      className={`w-10 h-11 flex items-center justify-center font-tech text-xl font-black border ${
                        c.discovered
                          ? 'bg-amber-950/75 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.28)]'
                          : 'bg-slate-900 border-slate-700 text-slate-600'
                      }`}
                    >
                      {c.discovered ? c.digitValue : '?'}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sortedClues.map((clue) => (
                  <div
                    key={clue.id}
                    className={`p-3 border ${
                      clue.discovered
                        ? 'bg-amber-950/20 border-amber-500/60'
                        : 'bg-slate-950/75 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-tech uppercase tracking-wider text-amber-400">
                        DÍGITO #{clue.digitIndex + 1}
                      </span>
                      {clue.discovered ? (
                        <span className="font-tech text-lg font-extrabold text-amber-300">
                          [{clue.digitValue}]
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    {clue.discovered ? (
                      <>
                        <div className="font-horror text-sm font-bold text-white mt-1">
                          {clue.title} · {clue.roomName}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {clue.flavorText}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500 mt-2 italic">
                        Bilhete ainda não encontrado. Inspecione mesas e quadros do complexo.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: UV / ARG CLUES */}
          {tab === 'uv' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 bg-purple-950/30 border border-purple-500/60">
                  <div className="text-[10px] font-tech uppercase tracking-wider text-purple-300 font-bold">
                    QUADRO DE TRADUÇÃO · ARQUIVO MORTO
                  </div>
                  {journal.translationBoardSeen ? (
                    <div className="flex flex-wrap gap-1.5 mt-2 font-tech text-xs">
                      {journal.symbolMap.map((pair) => (
                        <span
                          key={pair.symbol}
                          className="px-2 py-1 bg-black/75 border border-purple-500/60 text-purple-200"
                        >
                          {pair.symbol} = <strong className="text-cyan-300">{pair.digit}</strong>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1.5 italic">
                      Ainda não inspecionado. Examine o quadro cifrado no Arquivo Morto (Sala Vermelha).
                    </p>
                  )}
                </div>

                <div className="p-3 bg-emerald-950/25 border border-emerald-500/60">
                  <div className="text-[10px] font-tech uppercase tracking-wider text-emerald-300 font-bold">
                    REGISTRO EXCLUSIVO · CAM 06 (SEGURANÇA)
                  </div>
                  {journal.cameraSecretHintSeen ? (
                    <div className="font-tech text-xl font-black text-emerald-300 mt-1.5 tracking-widest">
                      CÓDIGO: {journal.cameraSecretCode}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1.5 italic">
                      Acesse o Monitor CCTV na Sala de Segurança e alterne para a CAM 06.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {journal.uvMarks.map((mark) => (
                  <div
                    key={mark.id}
                    className={`p-3 border ${
                      mark.discovered
                        ? 'bg-purple-950/25 border-purple-400/75 shadow-[0_0_16px_rgba(192,132,252,0.12)]'
                        : 'bg-slate-950/75 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-horror text-sm font-bold text-white">{mark.title}</span>
                      {mark.discovered ? (
                        <span className="font-tech text-2xl text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]">
                          {mark.symbolChar}
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-600" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {mark.discovered
                        ? `Detectado em ${mark.roomName}. Converta usando o Quadro de Tradução.`
                        : 'Ative a Luz UV [V] na lanterna e escaneie paredes suspeitas do Setor 09.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VHS TAPES WITH ANIMATED CASSETTE DECK */}
          {tab === 'tapes' && (
            <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1.25fr] gap-3">
              {/* Tape List */}
              <div className="space-y-2">
                {journal.cassettes.map((tape) => {
                  const selected = activeTape?.id === tape.id;
                  return (
                    <button
                      key={tape.id}
                      type="button"
                      onClick={() => {
                        setSelectedTapeId(tape.id);
                        setPlayingTape(tape.listened);
                      }}
                      className={`w-full text-left p-2.5 border transition-all cursor-pointer ${
                        selected
                          ? 'bg-cyan-950/45 border-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.18)]'
                          : tape.listened
                          ? 'bg-slate-950/85 border-slate-700 hover:border-cyan-500/60'
                          : 'bg-slate-950/65 border-slate-800 opacity-75'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <VhsTapeIcon
                            className={`w-4 h-4 shrink-0 ${
                              tape.listened ? 'text-cyan-300' : 'text-slate-600'
                            }`}
                          />
                          <span className="font-horror text-sm font-bold text-white truncate">
                            {tape.title}
                          </span>
                        </div>
                        <span
                          className={`font-tech text-[9px] font-bold uppercase px-1.5 py-0.5 ${
                            tape.listened
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-900 text-slate-500 border border-slate-800'
                          }`}
                        >
                          {tape.listened ? 'OUVIDA' : 'OCULTA'}
                        </span>
                      </div>
                      <div className="text-[10px] font-tech text-slate-400 mt-1">
                        LOCAL: {tape.roomName}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Animated Visual VHS Cassette Player */}
              <div className="p-3.5 bg-slate-950/90 border border-cyan-500/45 flex flex-col justify-between gap-3">
                <div className="space-y-3">
                  {/* Visual Magnetic Tape Deck with Dual Spinning Reels */}
                  <div className="relative p-3 bg-gradient-to-b from-slate-900 to-black border border-slate-700 overflow-hidden">
                    <div className="absolute inset-0 tactical-scanlines opacity-55 pointer-events-none" />
                    <div className="flex items-center justify-between text-[9px] font-tech text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            playingTape && activeTape?.listened
                              ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]'
                              : 'bg-slate-600'
                          }`}
                        />
                        VHS DECK // S09-REC
                      </span>
                      <span className="text-cyan-300">
                        {activeTape?.listened ? (playingTape ? 'REPRODUZINDO' : 'PRONTO') : 'SEM FITA'}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-6 py-2 bg-slate-950/90 border border-slate-800">
                      {[0, 1].map((reel) => (
                        <svg
                          key={reel}
                          viewBox="0 0 40 40"
                          className={`w-12 h-12 text-cyan-300/85 ${
                            playingTape && activeTape?.listened ? 'animate-reel-spin' : ''
                          }`}
                          aria-hidden="true"
                        >
                          <circle cx="20" cy="20" r="17" fill="#0b0f18" stroke="currentColor" strokeWidth="1.8" />
                          <circle cx="20" cy="20" r="7" fill="#1e293b" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M20 4 V13 M20 27 V36 M4 20 H13 M27 20 H36" stroke="currentColor" strokeWidth="1.6" />
                          <circle cx="20" cy="20" r="2.2" fill="#f59e0b" />
                        </svg>
                      ))}
                    </div>
                  </div>

                  {activeTape?.listened ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-horror text-base font-bold text-cyan-300">
                          {activeTape.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPlayingTape((p) => !p)}
                          className="horror-btn px-2.5 py-1 text-[10px] font-tech font-bold uppercase flex items-center gap-1 text-cyan-200 cursor-pointer"
                        >
                          {playingTape ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          <span>{playingTape ? 'Pausar Deck' : 'Animar Deck'}</span>
                        </button>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed bg-black/55 border-l-2 border-cyan-400 p-2.5">
                        &ldquo;{activeTape.transcript}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      Fita ainda não localizada. Procure o gravador em{' '}
                      <strong className="text-slate-300">{activeTape?.roomName ?? 'Setor 09'}</strong>.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: OMEGA DOSSIERS */}
          {tab === 'dossiers' && (
            <div className="space-y-2.5">
              {journal.omegaDossiers.map((dossier) => (
                <div
                  key={dossier.id}
                  className={`p-3.5 border ${
                    dossier.unlocked
                      ? 'bg-emerald-950/20 border-emerald-500/65'
                      : 'bg-slate-950/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-tech uppercase tracking-wider text-emerald-400 font-bold">
                        {dossier.code} · {dossier.clearance}
                      </div>
                      <div className="font-horror text-base font-bold text-white mt-0.5">
                        {dossier.title}
                      </div>
                    </div>
                    {!dossier.unlocked && <Lock className="w-4 h-4 text-slate-600 shrink-0" />}
                  </div>
                  {dossier.unlocked ? (
                    <p className="text-xs sm:text-sm text-slate-200 mt-2 leading-relaxed">
                      {dossier.body}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1.5 italic">
                      Desbloqueie o Terminal Ômega (Câmara Secreta do Subsolo) com a cifra UV de 5 dígitos para descriptografar este documento.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: CHARACTER LORE FILES WITH 3D MICRO-VOXEL BUST RENDERS! */}
          {tab === 'characters' && (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3">
              {/* Character Roster Selector */}
              <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-1 md:pb-0">
                {LORE_CHARACTER_PROFILES.map((profile) => {
                  const active = profile.id === activeProfile.id;
                  const thumb = portraits?.[profile.id] ?? '';
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      data-testid={`journal-char-${profile.id}`}
                      onClick={() => setSelectedCharId(profile.id)}
                      className={`shrink-0 w-44 md:w-full p-2 border flex items-center gap-2.5 text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900/95 border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.22)]'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="w-11 h-11 shrink-0 bg-slate-950 border border-slate-700 overflow-hidden relative">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <CharacterBadgeIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-horror text-xs font-bold text-white truncate">
                          {profile.name}
                        </div>
                        <div className="font-tech text-[9px] text-slate-400 truncate">
                          {profile.role}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Character Confidential Dossier Card with Large 3D Render */}
              <div className="p-3.5 sm:p-4 bg-slate-950/90 border border-slate-700/80 flex flex-col sm:flex-row gap-4">
                {/* 3D Micro-Voxel Render Portrait Frame */}
                <div className="sm:w-44 shrink-0 space-y-2">
                  <div className="relative aspect-square w-36 sm:w-full mx-auto bg-black border-2 border-slate-600 overflow-hidden shadow-[0_10px_28px_rgba(0,0,0,0.85)]">
                    {portraits?.[activeProfile.id] ? (
                      <img
                        src={portraits[activeProfile.id]}
                        alt={activeProfile.name}
                        data-testid={`journal-char-render-${activeProfile.id}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        <CharacterBadgeIcon className="w-14 h-14" />
                      </div>
                    )}
                    <div className="absolute inset-0 tactical-scanlines opacity-55 pointer-events-none" />
                    <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-amber-400/80" />
                    <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-amber-400/80" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/80 px-2 py-0.5 text-[9px] font-tech uppercase tracking-widest text-center text-slate-300">
                      RENDER 3D // VOXEL
                    </div>
                  </div>

                  <div
                    className={`px-2 py-1 border text-center font-tech text-[9px] font-bold uppercase tracking-wider ${
                      accentBadgeMap[activeProfile.accent]
                    }`}
                  >
                    {activeProfile.status}
                  </div>
                </div>

                {/* Character Bio & Intelligence Notes */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="border-b border-slate-800 pb-2">
                    <div className="font-tech text-[10px] font-bold uppercase tracking-[0.16em] text-amber-400">
                      {activeProfile.codename}
                    </div>
                    <h3 className="font-horror text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                      {activeProfile.name}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-0.5 mt-1 text-[10px] font-tech text-slate-400">
                      <span>FUNÇÃO: <strong className="text-slate-200">{activeProfile.role}</strong></span>
                      <span>CREDENCIAL: <strong className="text-slate-200">{activeProfile.clearance}</strong></span>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {activeProfile.summary}
                  </p>

                  <div className="space-y-1.5">
                    <div className="font-tech text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      REGISTROS DE CAMPO
                    </div>
                    <ul className="space-y-1.5">
                      {activeProfile.dossierNotes.map((note, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-slate-300 pl-3 border-l-2 border-amber-500/60 leading-snug"
                        >
                          {note}
                        </li>
                      ))}
                    </ul>
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
