import React, { useEffect, useState } from 'react';
import {
  Gamepad2,
  Globe,
  Keyboard,
  LayoutGrid,
  RotateCcw,
  Sliders,
  Smartphone,
  Volume2,
  X,
} from 'lucide-react';
import { GRAPHICS_PROFILES } from '../game/settings';
import { DEFAULT_KEYBINDS } from '../game/saveManager';
import type {
  CustomKeybinds,
  FpsLimit,
  GamepadProfile,
  GameSettings,
  GraphicsQuality,
  HoldToggleMode,
  JoystickMode,
  Language,
  MinimapPosition,
  MinimapSizeOption,
  ShadowQualityLevel,
  StickCurve,
  SubtitleSize,
  TextureQualityLevel,
} from '../game/types';

interface SettingsModalProps {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
  onReset: () => void;
  onOpenHudEditor: () => void;
  onClose: () => void;
}

type TabId = 'locale' | 'video' | 'audio' | 'controls' | 'hud' | 'gameplay';

const QUALITY_LIST: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];

const KEYBIND_LABELS: { key: keyof CustomKeybinds; label: string }[] = [
  { key: 'moveForward', label: 'Avançar' },
  { key: 'moveBack', label: 'Recuar' },
  { key: 'moveLeft', label: 'Esquerda' },
  { key: 'moveRight', label: 'Direita' },
  { key: 'sprint', label: 'Correr' },
  { key: 'crouch', label: 'Agachar' },
  { key: 'interact', label: 'Interagir' },
  { key: 'flashlight', label: 'Lanterna' },
];

const LANGUAGE_OPTIONS: { id: Language; label: string; tag: string }[] = [
  { id: 'pt-BR', label: 'Português (BR)', tag: 'PT-BR' },
  { id: 'en-US', label: 'English (US)', tag: 'EN-US' },
  { id: 'es-ES', label: 'Español (ES)', tag: 'ES-ES' },
];

function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'SHIFT';
  if (code === 'ControlLeft' || code === 'ControlRight') return 'CTRL';
  if (code === 'Space') return 'ESPAÇO';
  return code.toUpperCase();
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onChange,
  onReset,
  onOpenHudEditor,
  onClose,
}) => {
  const [tab, setTab] = useState<TabId>('video');
  const [rebindingKey, setRebindingKey] = useState<keyof CustomKeybinds | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rebindingKey) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code !== 'Escape') {
          const nextKeybinds: CustomKeybinds = {
            ...DEFAULT_KEYBINDS,
            ...(settings.controls.keybinds ?? {}),
            [rebindingKey]: e.code,
          };
          onChange({
            ...settings,
            controls: { ...settings.controls, keybinds: nextKeybinds },
          });
        }
        setRebindingKey(null);
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, onChange, rebindingKey, settings]);

  const localeState = settings.locale ?? {
    language: 'pt-BR' as Language,
    dubbing: true,
    subtitleBgOpacity: 0.85,
  };

  const updateLocale = (patch: Partial<GameSettings['locale']>) => {
    onChange({
      ...settings,
      locale: { ...localeState, ...patch },
    });
  };

  const updateAudio = (patch: Partial<GameSettings['audio']>) => {
    onChange({ ...settings, audio: { ...settings.audio, ...patch } });
  };

  const updateControls = (patch: Partial<GameSettings['controls']>) => {
    onChange({ ...settings, controls: { ...settings.controls, ...patch } });
  };

  const updateVideo = (patch: Partial<GameSettings['video']>) => {
    onChange({ ...settings, video: { ...settings.video, ...patch } });
  };

  const updateGameplay = (patch: Partial<GameSettings['gameplay']>) => {
    onChange({ ...settings, gameplay: { ...settings.gameplay, ...patch } });
  };

  const applyQualityPreset = (q: GraphicsQuality) => {
    const shadowsByQ: Record<GraphicsQuality, ShadowQualityLevel> = {
      low: 'off',
      medium: 'medium',
      high: 'high',
      ultra: 'ultra',
    };
    const texByQ: Record<GraphicsQuality, TextureQualityLevel> = {
      low: 'low',
      medium: 'medium',
      high: 'high',
      ultra: 'high',
    };
    const waterByQ: Record<GraphicsQuality, 'low' | 'high'> = {
      low: 'low',
      medium: 'low',
      high: 'high',
      ultra: 'high',
    };
    onChange({
      ...settings,
      graphicsQuality: q,
      video: {
        ...settings.video,
        shadowsOverride: 'auto',
        postProcessingOverride: 'auto',
        shadowsLevel: shadowsByQ[q],
        textureQuality: texByQ[q],
        waterQuality: waterByQ[q],
        waterReflections: q !== 'low',
        volumetricDust: q !== 'low',
        rainParticles: true,
        resolutionScale: q === 'low' ? 0.8 : 1.0,
      },
    });
  };

  const customHudCount = Object.keys(settings.controls.hudCustomLayout ?? {}).length;
  const keybinds: CustomKeybinds = { ...DEFAULT_KEYBINDS, ...(settings.controls.keybinds ?? {}) };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Configurações"
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <div className="horror-panel tactical-grid-bg w-full max-w-4xl max-h-full flex flex-col overflow-hidden text-slate-100 animate-tactical-in">
        {/* Tactical Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/35 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.65)] shrink-0" />
            <div>
              <h2 className="font-horror text-lg sm:text-2xl font-extrabold tracking-wider uppercase text-white leading-none">
                CONFIGURAÇÕES · SETOR 09
              </h2>
              <div className="text-[10px] font-tech uppercase tracking-[0.16em] text-emerald-400 mt-0.5">
                APLICADO EM TEMPO REAL · AUTO-SALVO
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              aria-label="Restaurar padrão"
              className="horror-btn px-2.5 py-1.5 text-[11px] font-tech font-bold uppercase text-slate-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Padrão</span>
            </button>
            <button
              type="button"
              data-testid="settings-close-btn"
              onClick={onClose}
              aria-label="Fechar configurações"
              className="horror-btn horror-btn-danger px-3 py-1.5 text-[11px] font-tech font-bold uppercase text-white flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* 6-Category AAA Tabs */}
        <div
          role="tablist"
          aria-label="Categorias de configurações"
          className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 px-3 py-2 sm:px-4 bg-slate-950/95 border-b border-slate-800 shrink-0"
        >
          {(
            [
              { id: 'locale', label: 'Idioma', Icon: Globe },
              { id: 'video', label: 'Gráficos', Icon: Sliders },
              { id: 'audio', label: 'Áudio', Icon: Volume2 },
              { id: 'controls', label: 'Controles', Icon: Gamepad2 },
              { id: 'hud', label: 'HUD/Touch', Icon: Smartphone },
              { id: 'gameplay', label: 'Gameplay', Icon: LayoutGrid },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                type="button"
                data-testid={`settings-tab-${id}`}
                aria-selected={active}
                onClick={() => {
                  setRebindingKey(null);
                  setTab(id);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-1.5 text-[10px] sm:text-xs font-tech font-bold uppercase tracking-wider border cursor-pointer transition-all whitespace-nowrap ${
                  active
                    ? 'bg-red-950/75 border-amber-400 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.24)]'
                    : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto horror-scroll px-3 py-3 sm:px-4 sm:py-4 space-y-3">
          {/* TAB 1: IDIOMA & DUBLAGEM */}
          {tab === 'locale' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-950/85 border border-slate-800 space-y-2">
                <div className="text-[11px] font-tech font-bold uppercase tracking-wider text-amber-300">
                  Idioma da Interface, Dossiês &amp; Dublagem
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LANGUAGE_OPTIONS.map((opt) => {
                    const active = localeState.language === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`locale-lang-${opt.id}`}
                        aria-pressed={active}
                        onClick={() => updateLocale({ language: opt.id })}
                        className={`p-2.5 border text-left transition-all cursor-pointer flex items-center justify-between ${
                          active
                            ? 'bg-red-950/65 border-amber-400 text-white shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                            : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <span className="font-horror text-sm font-bold tracking-wide">
                          {opt.label}
                        </span>
                        <span className="text-[10px] font-tech font-bold text-amber-300">
                          {opt.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow
                  label="Dublagem de Voz (Rádio & Cutscenes)"
                  sublabel="Narração sintetizada para falas do Vigia Marcos, fitas VHS e alertas"
                  checked={localeState.dubbing}
                  testId="toggle-locale-dubbing"
                  onToggle={() => updateLocale({ dubbing: !localeState.dubbing })}
                />
                <SliderRow
                  id="locale-dub-volume"
                  label="Volume da Dublagem & Vozes"
                  value={Math.round(settings.audio.voiceTapes * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ voiceTapes: v / 100 })}
                />
                <ToggleRow
                  label="Legendas de Rádio & Fitas"
                  sublabel="Exibir transcrições sincronizadas na parte inferior da tela"
                  checked={settings.audio.subtitles}
                  testId="toggle-locale-subtitles"
                  onToggle={() => updateAudio({ subtitles: !settings.audio.subtitles })}
                />
                <SegmentRow<SubtitleSize>
                  label="Tamanho das Legendas"
                  value={settings.audio.subtitleSize ?? 'md'}
                  options={[
                    { id: 'sm', text: 'P' },
                    { id: 'md', text: 'M' },
                    { id: 'lg', text: 'G' },
                  ]}
                  onChange={(val) => updateAudio({ subtitleSize: val })}
                />
                <SliderRow
                  id="locale-subtitle-bg"
                  label="Opacidade do Fundo das Legendas"
                  value={Math.round((localeState.subtitleBgOpacity ?? 0.85) * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateLocale({ subtitleBgOpacity: v / 100 })}
                />
              </div>
            </div>
          )}

          {/* TAB 2: GRÁFICOS & PÓS-PROC */}
          {tab === 'video' && (
            <div className="space-y-3">
              {/* 4 Quick Quality Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {QUALITY_LIST.map((q) => {
                  const prof = GRAPHICS_PROFILES[q];
                  const active = settings.graphicsQuality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      data-testid={`graphics-preset-${q}`}
                      aria-pressed={active}
                      onClick={() => applyQualityPreset(q)}
                      className={`p-2.5 text-left border cursor-pointer transition-colors ${
                        active
                          ? 'bg-red-950/65 border-amber-400 text-white'
                          : 'bg-slate-900/85 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-display text-base font-extrabold uppercase tracking-wider leading-none">
                        {prof.label}
                      </div>
                      <div className="text-[9px] font-mono-num text-amber-300/90 mt-1">
                        {q === 'low' || q === 'medium' ? '60 FPS MOBILE' : 'PC / ULTRA PBR'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Core Video & Post-Processing Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SliderRow
                  id="video-res-scale"
                  label="Escala de Resolução"
                  value={Math.min(100, Math.max(50, Math.round(settings.video.resolutionScale * 100)))}
                  min={50}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateVideo({ resolutionScale: v / 100 })}
                />
                <SegmentRow<string>
                  label="Limite de FPS"
                  value={String(settings.video.fpsLimit ?? 60)}
                  options={[
                    { id: '30', text: '30' },
                    { id: '60', text: '60' },
                    { id: '120', text: '120 / Max' },
                  ]}
                  onChange={(val) => updateVideo({ fpsLimit: Number(val) as FpsLimit })}
                />
                <SliderRow
                  id="video-render-dist"
                  label="Distância Render / Culling"
                  value={Math.round((settings.video.renderDistance ?? 1.0) * 100)}
                  min={50}
                  max={150}
                  suffix="%"
                  onChange={(v) => updateVideo({ renderDistance: v / 100 })}
                />
                <SliderRow
                  id="video-vhs-intensity"
                  label="Intensidade VHS / Cromática"
                  value={Math.round((settings.video.vhsIntensity ?? 0.65) * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateVideo({ vhsIntensity: v / 100 })}
                />
                <SliderRow
                  id="video-brightness"
                  label="Brilho / Gama"
                  value={Math.round(settings.video.brightness * 100)}
                  min={65}
                  max={150}
                  suffix="%"
                  onChange={(v) => updateVideo({ brightness: v / 100 })}
                />
                <SliderRow
                  id="video-contrast"
                  label="Contraste da Imagem"
                  value={Math.round((settings.video.contrast ?? 1.0) * 100)}
                  min={75}
                  max={135}
                  suffix="%"
                  onChange={(v) => updateVideo({ contrast: v / 100 })}
                />
                <SliderRow
                  id="video-fog"
                  label="Densidade da Neblina"
                  value={Math.round((settings.video.fogDensity ?? 1.0) * 100)}
                  min={50}
                  max={160}
                  suffix="%"
                  onChange={(v) => updateVideo({ fogDensity: v / 100 })}
                />
              </div>

              {/* Granular PBR / Shadows / Water / Bloom Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SegmentRow<ShadowQualityLevel>
                  label="Sombras Dinâmicas"
                  value={settings.video.shadowsLevel ?? 'medium'}
                  options={[
                    { id: 'off', text: 'Desl' },
                    { id: 'low', text: 'Bx' },
                    { id: 'medium', text: 'Méd' },
                    { id: 'high', text: 'Alt' },
                    { id: 'ultra', text: 'Ult' },
                  ]}
                  onChange={(val) =>
                    updateVideo({
                      shadowsLevel: val,
                      shadowsOverride: val === 'off' ? 'off' : 'on',
                    })
                  }
                />
                <SegmentRow<TextureQualityLevel>
                  label="Qualidade PBR / Texturas"
                  value={settings.video.textureQuality ?? 'high'}
                  options={[
                    { id: 'low', text: 'Baixo' },
                    { id: 'medium', text: 'Médio' },
                    { id: 'high', text: 'Alto' },
                  ]}
                  onChange={(val) => updateVideo({ textureQuality: val })}
                />
                <SegmentRow<'low' | 'high'>
                  label="Qualidade da Água"
                  value={settings.video.waterQuality ?? 'high'}
                  options={[
                    { id: 'low', text: 'Leve' },
                    { id: 'high', text: 'Alto PBR' },
                  ]}
                  onChange={(val) => updateVideo({ waterQuality: val })}
                />
                <SegmentRow<'auto' | 'on' | 'off'>
                  label="Bloom & Pós-Proc."
                  value={settings.video.postProcessingOverride}
                  options={[
                    { id: 'auto', text: 'Auto' },
                    { id: 'on', text: 'On' },
                    { id: 'off', text: 'Off' },
                  ]}
                  onChange={(val) => updateVideo({ postProcessingOverride: val })}
                />
              </div>

              {/* Visual Feature Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow
                  label="Reflexos Fresnel da Água"
                  sublabel="Reflexo da lua, lâmpadas e feixe da lanterna nas poças"
                  checked={settings.video.waterReflections ?? true}
                  onToggle={() =>
                    updateVideo({ waterReflections: !(settings.video.waterReflections ?? true) })
                  }
                />
                <ToggleRow
                  label="Poeira Volumétrica"
                  sublabel="Partículas suspensas iluminadas pela lanterna"
                  checked={settings.video.volumetricDust}
                  onToggle={() => updateVideo({ volumetricDust: !settings.video.volumetricDust })}
                />
                <ToggleRow
                  label="Chuva & Garoa no Pátio"
                  sublabel="Gotas caindo na área aberta e ondulações na água"
                  checked={settings.video.rainParticles ?? true}
                  onToggle={() =>
                    updateVideo({ rainParticles: !(settings.video.rainParticles ?? true) })
                  }
                />
                <ToggleRow
                  label="Contador de FPS"
                  sublabel="Exibir taxa de quadros no canto superior direito"
                  checked={settings.video.showFps}
                  onToggle={() => updateVideo({ showFps: !settings.video.showFps })}
                />
                <ToggleRow
                  label="Tempo de Quadro (Frame Time ms)"
                  sublabel="Exibe latência por frame (ms) ao lado do contador de FPS"
                  checked={settings.video.showFrameTime ?? false}
                  testId="toggle-frame-time"
                  onToggle={() =>
                    updateVideo({ showFrameTime: !(settings.video.showFrameTime ?? false) })
                  }
                />
              </div>
            </div>
          )}

          {/* TAB 3: ÁUDIO & ACÚSTICA */}
          {tab === 'audio' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SliderRow
                  id="audio-master"
                  label="Volume Geral (Master)"
                  value={Math.round(settings.audio.master * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ master: v / 100, muted: false })}
                />
                <SliderRow
                  id="audio-tapes"
                  label="Vozes / Dublagem / Fitas VHS"
                  value={Math.round(settings.audio.voiceTapes * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ voiceTapes: v / 100 })}
                />
                <SliderRow
                  id="audio-sfx"
                  label="Efeitos Sonoros (SFX)"
                  value={Math.round(settings.audio.sfx * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ sfx: v / 100 })}
                />
                <SliderRow
                  id="audio-music"
                  label="Ambiente & Clima"
                  value={Math.round(settings.audio.music * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ music: v / 100 })}
                />
                <SliderRow
                  id="audio-tension"
                  label="Música & Tensão Dinâmica"
                  value={Math.round((settings.audio.tension ?? 0.85) * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ tension: v / 100 })}
                />
                <SliderRow
                  id="audio-chase"
                  label="Batimento & Perseguição"
                  value={Math.round((settings.audio.chaseHeartbeat ?? 0.9) * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateAudio({ chaseHeartbeat: v / 100 })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow
                  label="Oclusão Sonora (Paredes/Portas)"
                  sublabel="Abafa passos e grunhidos do P. Drizzy atrás de paredes"
                  checked={settings.audio.soundOcclusion ?? true}
                  onToggle={() =>
                    updateAudio({ soundOcclusion: !(settings.audio.soundOcclusion ?? true) })
                  }
                />
                <ToggleRow
                  label="Modo Áudio Noturno"
                  sublabel="Comprime picos de sustos e graves para jogar à noite"
                  checked={settings.audio.nightMode ?? false}
                  testId="toggle-night-audio"
                  onToggle={() =>
                    updateAudio({ nightMode: !(settings.audio.nightMode ?? false) })
                  }
                />
              </div>

              <div className="flex items-center justify-between p-2.5 bg-slate-900/80 border border-slate-700">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Silenciar Todos os Canais
                  </div>
                  <div className="text-[11px] text-slate-400">Corte imediato de áudio geral</div>
                </div>
                <button
                  type="button"
                  aria-pressed={settings.audio.muted}
                  onClick={() => updateAudio({ muted: !settings.audio.muted })}
                  className={`px-3 py-1 text-xs font-bold uppercase border cursor-pointer whitespace-nowrap ${
                    settings.audio.muted
                      ? 'bg-red-900 border-red-400 text-white'
                      : 'bg-slate-800 border-slate-600 text-slate-200'
                  }`}
                >
                  {settings.audio.muted ? 'Mudo' : 'Ativo'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CONTROLES & GAMEPAD */}
          {tab === 'controls' && (
            <div className="space-y-2.5">
              {/* Dual-Profile Gamepad Mode Selector */}
              <div className="p-2.5 bg-slate-900/90 border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Perfil de Controle (Gamepad)</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Auto detecta Bluetooth DS4 no Android e controles Xbox/PC nativamente.
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(
                    [
                      { id: 'auto', text: 'Auto' },
                      { id: 'standard', text: 'Padrão' },
                      { id: 'ds4_android', text: 'DS4 Android' },
                    ] as { id: GamepadProfile; text: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`gamepad-profile-${opt.id}`}
                      aria-pressed={settings.controls.gamepadProfile === opt.id}
                      onClick={() => updateControls({ gamepadProfile: opt.id })}
                      className={`px-2 py-1 text-[10px] font-mono-num font-bold uppercase border cursor-pointer whitespace-nowrap ${
                        settings.controls.gamepadProfile === opt.id
                          ? 'bg-amber-700 border-amber-300 text-white'
                          : 'bg-slate-800 border-slate-600 text-slate-300'
                      }`}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SliderRow
                  id="ctrl-look-x"
                  label="Sensibilidade Eixo X"
                  value={Math.round((settings.controls.lookSensitivityX ?? 1.0) * 100)}
                  min={30}
                  max={250}
                  suffix="%"
                  onChange={(v) => updateControls({ lookSensitivityX: v / 100, lookSensitivity: v / 100 })}
                />
                <SliderRow
                  id="ctrl-look-y"
                  label="Sensibilidade Eixo Y"
                  value={Math.round((settings.controls.lookSensitivityY ?? 1.0) * 100)}
                  min={30}
                  max={250}
                  suffix="%"
                  onChange={(v) => updateControls({ lookSensitivityY: v / 100 })}
                />
                <SliderRow
                  id="ctrl-crouch-mult"
                  label="Multiplicador Agachado"
                  value={Math.round((settings.controls.crouchSensitivityMult ?? 0.75) * 100)}
                  min={30}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateControls({ crouchSensitivityMult: v / 100 })}
                />
                <SliderRow
                  id="ctrl-cam-smooth"
                  label="Suavização de Câmera"
                  value={Math.round((settings.controls.cameraSmoothing ?? 0.12) * 100)}
                  min={0}
                  max={85}
                  suffix="%"
                  onChange={(v) => updateControls({ cameraSmoothing: v / 100 })}
                />
                <SliderRow
                  id="ctrl-touch"
                  label="Sensibilidade Toque"
                  value={Math.round(settings.controls.touchSensitivity * 100)}
                  min={40}
                  max={250}
                  suffix="%"
                  onChange={(v) => updateControls({ touchSensitivity: v / 100 })}
                />
                <SliderRow
                  id="ctrl-gamepad-sens"
                  label="Sensibilidade Gamepad"
                  value={Math.round(settings.controls.gamepadSensitivity * 100)}
                  min={40}
                  max={250}
                  suffix="%"
                  onChange={(v) => updateControls({ gamepadSensitivity: v / 100 })}
                />
                <SliderRow
                  id="ctrl-deadzone-l"
                  label="Deadzone Analógico Esq."
                  value={Math.round(settings.controls.gamepadDeadzone * 100)}
                  min={5}
                  max={35}
                  suffix="%"
                  onChange={(v) => updateControls({ gamepadDeadzone: v / 100 })}
                />
                <SliderRow
                  id="ctrl-deadzone-r"
                  label="Deadzone Analógico Dir."
                  value={Math.round(
                    (settings.controls.gamepadDeadzoneRight ?? settings.controls.gamepadDeadzone) * 100
                  )}
                  min={5}
                  max={35}
                  suffix="%"
                  onChange={(v) => updateControls({ gamepadDeadzoneRight: v / 100 })}
                />
                <SliderRow
                  id="ctrl-rumble-strength"
                  label="Intensidade Vibração / Rumble"
                  value={Math.round((settings.controls.rumbleStrength ?? 0.85) * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateControls({ rumbleStrength: v / 100, rumble: v > 0 })}
                />
                <SegmentRow<StickCurve>
                  label="Curva do Analógico"
                  value={settings.controls.stickCurve ?? 'exponential'}
                  options={[
                    { id: 'linear', text: 'Linear' },
                    { id: 'exponential', text: 'Exponencial' },
                  ]}
                  onChange={(val) => updateControls({ stickCurve: val })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow
                  label="Inverter Eixo Y"
                  sublabel="Inverte olhar vertical (Mouse / Toque / Controle)"
                  checked={settings.controls.invertY}
                  activeLabel="Invertido"
                  inactiveLabel="Normal"
                  onToggle={() => updateControls({ invertY: !settings.controls.invertY })}
                />
                <ToggleRow
                  label="Assistência Magnética de Mira"
                  sublabel="Facilita mirar em chaves, portas e interruptores próximos"
                  checked={settings.controls.interactionAssist ?? true}
                  onToggle={() =>
                    updateControls({
                      interactionAssist: !(settings.controls.interactionAssist ?? true),
                    })
                  }
                />
              </div>

              {/* Interactive PC Keybind Remapper */}
              <div className="p-2.5 bg-slate-950/85 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Remapeamento de Teclas (PC)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRebindingKey(null);
                      updateControls({ keybinds: { ...DEFAULT_KEYBINDS } });
                    }}
                    className="horror-btn px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300 cursor-pointer"
                  >
                    Restaurar Teclas
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {KEYBIND_LABELS.map(({ key, label }) => {
                    const isListening = rebindingKey === key;
                    return (
                      <button
                        key={String(key)}
                        type="button"
                        onClick={() => setRebindingKey(isListening ? null : key)}
                        className={`p-1.5 border text-left flex items-center justify-between gap-1 cursor-pointer ${
                          isListening
                            ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                            : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        <span className="text-[10px] uppercase text-slate-400 truncate">{label}</span>
                        <span className="text-[10px] font-mono-num font-extrabold text-amber-300 shrink-0">
                          {isListening ? 'TECLE...' : formatKeyCode(keybinds[key])}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HUD & TOUCH MOBILE */}
          {tab === 'hud' && (
            <div className="space-y-2.5">
              {/* Prominent Mobile HUD Layout Editor Launcher */}
              <div className="p-3 bg-amber-950/30 border border-amber-500/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="text-xs sm:text-sm font-display font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                    <LayoutGrid className="w-4 h-4" />
                    <span>Editor Interativo de Layout Touch</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Arraste o joystick e todos os botões na tela, ajuste tamanho e transparência individual.
                    {customHudCount > 0 ? ' (Layout personalizado ativo)' : ' (Usando layout padrão)'}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="open-hud-editor-btn"
                  onClick={onOpenHudEditor}
                  className="horror-btn-danger px-3.5 py-2 text-xs font-extrabold uppercase tracking-wider text-white flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Abrir Editor HUD</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SliderRow
                  id="hud-scale"
                  label="Escala Geral do HUD"
                  value={Math.round((settings.controls.hudScale ?? 1.0) * 100)}
                  min={75}
                  max={125}
                  suffix="%"
                  onChange={(v) => updateControls({ hudScale: v / 100 })}
                />
                <SliderRow
                  id="hud-opacity"
                  label="Opacidade do HUD"
                  value={Math.round((settings.controls.hudOpacity ?? 0.96) * 100)}
                  min={40}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateControls({ hudOpacity: v / 100 })}
                />
                <SegmentRow<MinimapSizeOption>
                  label="Tamanho do Minimapa"
                  value={settings.controls.minimapSize ?? 'md'}
                  options={[
                    { id: 'sm', text: 'P' },
                    { id: 'md', text: 'M' },
                    { id: 'lg', text: 'G' },
                  ]}
                  onChange={(val) => updateControls({ minimapSize: val })}
                />
                <SegmentRow<MinimapPosition>
                  label="Posição do Minimapa"
                  value={settings.controls.minimapPosition ?? 'top-right'}
                  options={[
                    { id: 'top-right', text: 'Direita' },
                    { id: 'top-left', text: 'Esquerda' },
                  ]}
                  onChange={(val) => updateControls({ minimapPosition: val })}
                />
                <SliderRow
                  id="minimap-opacity"
                  label="Opacidade do Minimapa"
                  value={Math.round((settings.controls.minimapOpacity ?? 0.94) * 100)}
                  min={40}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateControls({ minimapOpacity: v / 100 })}
                />
                <SegmentRow<JoystickMode>
                  label="Estilo do Joystick"
                  value={settings.controls.joystickMode}
                  options={[
                    { id: 'fixed', text: 'Fixo' },
                    { id: 'floating', text: 'Flutuante' },
                  ]}
                  onChange={(val) => updateControls({ joystickMode: val })}
                />
                <SliderRow
                  id="ctrl-btn-scale"
                  label="Escala Botões Mobile"
                  value={Math.round(settings.controls.mobileButtonScale * 100)}
                  min={85}
                  max={130}
                  suffix="%"
                  onChange={(v) => updateControls({ mobileButtonScale: v / 100 })}
                />
                <SliderRow
                  id="ctrl-btn-opacity"
                  label="Opacidade Botões Mobile"
                  value={Math.round(settings.controls.mobileButtonOpacity * 100)}
                  min={35}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateControls({ mobileButtonOpacity: v / 100 })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <ToggleRow
                  label="Modo Canhoto (Inverter Lados Touch)"
                  sublabel="Espelha o joystick para a direita e ações para a esquerda"
                  checked={settings.controls.leftHanded ?? false}
                  testId="toggle-left-handed"
                  onToggle={() =>
                    updateControls({ leftHanded: !(settings.controls.leftHanded ?? false) })
                  }
                />
                <ToggleRow
                  label="Mira Dinâmica Contextual"
                  sublabel="Altera o ícone da mira em itens, portas e esconderijos"
                  checked={settings.controls.dynamicCrosshair ?? true}
                  onToggle={() =>
                    updateControls({ dynamicCrosshair: !(settings.controls.dynamicCrosshair ?? true) })
                  }
                />
                <ToggleRow
                  label="Indicador Visual de Ruído"
                  sublabel="Barras acústicas de passos no canto superior"
                  checked={settings.gameplay.showNoiseIndicator}
                  onToggle={() =>
                    updateGameplay({ showNoiseIndicator: !settings.gameplay.showNoiseIndicator })
                  }
                />
                <ToggleRow
                  label="Timer de Speedrun (MM:SS.ms)"
                  sublabel="Exibe cronômetro de precisão no topo da tela durante a fuga"
                  checked={settings.gameplay.showSpeedrunTimer ?? false}
                  testId="toggle-speedrun-timer"
                  onToggle={() =>
                    updateGameplay({
                      showSpeedrunTimer: !(settings.gameplay.showSpeedrunTimer ?? false),
                    })
                  }
                />
              </div>
            </div>
          )}

          {/* TAB 6: GAMEPLAY, REDE & ACESSIBILIDADE */}
          {tab === 'gameplay' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <SliderRow
                  id="video-fov"
                  label="Campo de Visão (FOV)"
                  value={settings.video.fov}
                  min={60}
                  max={110}
                  suffix="°"
                  onChange={(v) => updateVideo({ fov: v })}
                />
                <SliderRow
                  id="gp-headbob"
                  label="Head-Bob & Tremor"
                  value={Math.min(100, Math.round(settings.gameplay.headBobIntensity * 100))}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(v) => updateGameplay({ headBobIntensity: v / 100 })}
                />
                <SliderRow
                  id="gp-vignette"
                  label="Intensidade da Vinheta"
                  value={Math.round((settings.gameplay.vignetteIntensity ?? 1.0) * 100)}
                  min={25}
                  max={150}
                  suffix="%"
                  onChange={(v) => updateGameplay({ vignetteIntensity: v / 100 })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SegmentRow<HoldToggleMode>
                  label="Correr (Sprint)"
                  value={settings.gameplay.sprintMode ?? 'hold'}
                  options={[
                    { id: 'hold', text: 'Segurar' },
                    { id: 'toggle', text: 'Alternar' },
                  ]}
                  onChange={(val) => updateGameplay({ sprintMode: val })}
                />
                <SegmentRow<HoldToggleMode>
                  label="Agachar (Crouch)"
                  value={settings.gameplay.crouchMode ?? 'toggle'}
                  options={[
                    { id: 'hold', text: 'Segurar' },
                    { id: 'toggle', text: 'Alternar' },
                  ]}
                  onChange={(val) => updateGameplay({ crouchMode: val })}
                />
                <ToggleRow
                  label="Contorno / Destaque de Itens"
                  sublabel="Realça itens interativos e itens dropados no chão"
                  checked={settings.gameplay.itemOutline ?? true}
                  onToggle={() =>
                    updateGameplay({ itemOutline: !(settings.gameplay.itemOutline ?? true) })
                  }
                />
                <ToggleRow
                  label="Exibir Ping (ms)"
                  sublabel="Mostra latência de rede em tempo real nas salas Multiplayer"
                  checked={settings.gameplay.showPing ?? true}
                  testId="toggle-show-ping"
                  onToggle={() =>
                    updateGameplay({ showPing: !(settings.gameplay.showPing ?? true) })
                  }
                />
                <ToggleRow
                  label="Filtro de Chat Multiplayer"
                  sublabel="Oculta palavras impróprias no chat do lobby e partida"
                  checked={settings.gameplay.chatFilter ?? true}
                  testId="toggle-chat-filter"
                  onToggle={() =>
                    updateGameplay({ chatFilter: !(settings.gameplay.chatFilter ?? true) })
                  }
                />
                <ToggleRow
                  label="Dicas de Objetivo"
                  sublabel="Mostra o próximo passo de fuga no Setor 09"
                  checked={settings.gameplay.showObjectiveHints}
                  onToggle={() =>
                    updateGameplay({ showObjectiveHints: !settings.gameplay.showObjectiveHints })
                  }
                />
                <ToggleRow
                  label="Assistência: Prender Respiração"
                  sublabel="Amplia a zona segura ao se esconder do P. Drizzy"
                  checked={settings.gameplay.holdBreathAssist}
                  onToggle={() =>
                    updateGameplay({ holdBreathAssist: !settings.gameplay.holdBreathAssist })
                  }
                />
                <ToggleRow
                  label="Alertas Visuais de Áudio"
                  sublabel="Indica passos pesados próximos para acessibilidade"
                  checked={settings.gameplay.visualAudioCues}
                  onToggle={() =>
                    updateGameplay({ visualAudioCues: !settings.gameplay.visualAudioCues })
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SliderRowProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  id,
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}) => (
  <div className="p-2.5 bg-slate-950/85 border border-slate-800 hover:border-slate-700 flex flex-col gap-1.5 transition-colors">
    <div className="flex items-center justify-between gap-2">
      <label
        htmlFor={id}
        className="text-[11px] font-tech font-bold uppercase tracking-wider text-slate-200 truncate"
      >
        {label}
      </label>
      <span className="text-[11px] font-tech font-bold text-amber-400 shrink-0">
        {value}
        {suffix}
      </span>
    </div>
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full tactical-range cursor-pointer"
    />
  </div>
);

interface ToggleRowProps {
  label: string;
  sublabel: string;
  checked: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
  testId?: string;
  onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  sublabel,
  checked,
  activeLabel = 'Ligado',
  inactiveLabel = 'Deslig.',
  testId,
  onToggle,
}) => (
  <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950/85 border border-slate-800 hover:border-slate-700 transition-colors">
    <div className="min-w-0">
      <div className="text-[11px] font-tech font-bold uppercase tracking-wider text-slate-200 truncate">
        {label}
      </div>
      <div className="text-[10px] text-slate-400 leading-snug">{sublabel}</div>
    </div>
    <button
      type="button"
      data-testid={testId}
      aria-pressed={checked}
      onClick={onToggle}
      className={`px-3 py-1 text-[10px] font-tech font-bold uppercase border cursor-pointer shrink-0 whitespace-nowrap transition-all ${
        checked
          ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.28)]'
          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
      }`}
    >
      {checked ? activeLabel : inactiveLabel}
    </button>
  </div>
);

interface SegmentRowProps<T extends string> {
  label: string;
  value: T;
  options: { id: T; text: string }[];
  onChange: (val: T) => void;
}

function SegmentRow<T extends string>({ label, value, options, onChange }: SegmentRowProps<T>) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-950/85 border border-slate-800 hover:border-slate-700 transition-colors">
      <span className="text-[11px] font-tech font-bold uppercase tracking-wider text-slate-200 truncate">
        {label}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-2 py-1 text-[10px] font-tech font-bold uppercase border cursor-pointer whitespace-nowrap transition-all ${
              value === opt.id
                ? 'bg-amber-600/90 border-amber-300 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}
