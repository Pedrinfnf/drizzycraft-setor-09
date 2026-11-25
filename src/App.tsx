import { useCallback, useEffect, useRef, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { AchievementToast } from './components/AchievementToast';
import { AnalogHorrorOverlay } from './components/AnalogHorrorOverlay';
import { BackpackModal } from './components/BackpackModal';
import { CctvMonitorModal } from './components/CctvMonitorModal';
import { CutsceneOverlay } from './components/CutsceneOverlay';
import { GameHud } from './components/GameHud';
import { HudEditorModal } from './components/HudEditorModal';
import { JournalModal } from './components/JournalModal';
import { MissionReportModal } from './components/MissionReportModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { QuickInspectModal } from './components/QuickInspectModal';
import { SafeKeypadModal } from './components/SafeKeypadModal';
import { SecretTerminalModal } from './components/SecretTerminalModal';
import { SettingsModal } from './components/SettingsModal';
import { StatusModals } from './components/StatusModals';
import { StoreModal } from './components/StoreModal';
import { TitleScreen } from './components/TitleScreen';
import { TouchControls } from './components/TouchControls';
import { WorkbenchModal } from './components/WorkbenchModal';
import { WorldMapModal } from './components/WorldMapModal';
import { HorrorEngine } from './game/HorrorEngine';
import { authClient, type AuthSession } from './game/authClient';
import {
  applyNativeRangeValue,
  computeSliderNextValue,
  findSpatialNextIndex,
  MenuRepeatController,
  type NavDirection,
} from './game/gamepadNav';
import { normalizeGamepadState, type NormalizedGamepadState } from './game/inputManager';
import { saveSystem, type ProgressionStateV4 } from './game/saveSystem';
import { cloudSync, type CloudSyncState } from './game/cloudSync';
import { voiceDubbing } from './game/voiceDubbing';
import { multiplayerClient } from './network/MultiplayerClient';
import { proximityVoice, type VoiceSignalPayload } from './network/ProximityVoice';
import type { CharacterPortraitId } from './game/portraitRenderer';
import type {
  AchievementToastPayload,
  CutsceneUiState,
  Difficulty,
  EndingId,
  GameSettings,
  HudCustomLayout,
  HudSnapshot,
  ProfileProgress,
  SpeakerId,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  mode: 'title',
  difficulty: 'hard',
  floor: 0,
  roomName: 'Recepção · Guarita Setor 09',
  elapsedSec: 0,
  health: 2,
  maxHealth: 2,
  stamina: 100,
  battery: 100,
  flashlightOn: true,
  uvMode: false,
  crouching: false,
  inVent: false,
  sprinting: false,
  hiding: false,
  hidingKind: null,
  noiseLevel: 0,
  diddyDistance: 99,
  diddyState: 'patrol',
  dangerIntensity: 0,
  damageFlash: 0,
  activeSlot: 0,
  hotbar: [],
  backpackItems: [],
  backpackCapacity: 10,
  canDropActiveItem: false,
  collectedKeys: [],
  stunAmmo: 0,
  throwables: 0,
  cluesFound: 0,
  cluesTotal: 4,
  uvCluesFound: 0,
  cassettesFound: 0,
  cassettesTotal: 4,
  dossiersUnlockedCount: 0,
  safeUnlocked: false,
  blackoutActive: false,
  generatorFixed: false,
  fuseInstalled: false,
  terminalUnlocked: false,
  exitProgress: {
    planksRemoved: false,
    electronicUnlocked: false,
    masterUnlocked: false,
  },
  securityPowerPct: 100,
  securityLeftClosed: false,
  securityRightClosed: false,
  cctvOpen: false,
  cctvActiveCamIndex: 0,
  cctvCameras: [],
  workbenchOpen: false,
  terminalOpen: false,
  quickInspect: null,
  objectiveText: '',
  statusBanner: null,
  subtitleText: null,
  interactPrompt: null,
  reticleState: 'idle',
  fps: 60,
  contextualUseLabel: null,
  exploredPct: 0,
  keypadOpen: false,
  safeCodeHintDigits: [null, null, null, null],
  isMobileTouch: false,
  inputMode: 'pc',
  gamepadStyle: 'xbox',
  gamepadConnected: false,
  diddyInView: false,
  transitionFade: 0,
  graphicsQuality: 'medium',
  chapter2JustUnlocked: false,
  isNewBestTime: false,
  holdBreathActive: false,
  holdBreathProgress: 0,
  holdBreathGauge: 50,
  holdBreathZoneMin: 30,
  holdBreathZoneMax: 72,
  holdBreathHolding: false,
  holdBreathWarning: null,
  chromaticIntensity: 0,
  staminaExhausted: false,
};

function tryRequestMobileFullscreenLandscape(): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
      if (req && typeof (req as Promise<void>).catch === 'function') {
        (req as Promise<void>).catch(() => undefined);
      }
    }
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const orient = screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    if (isTouchDevice && orient?.lock) {
      orient.lock('landscape').catch(() => undefined);
    }
  } catch {
    // Graceful no-op on restricted browsers / iFrames
  }
}

function toggleFullscreenSmart(): void {
  try {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      const exit =
        document.exitFullscreen?.() ??
        (document as Document & { webkitExitFullscreen?: () => Promise<void> | void }).webkitExitFullscreen?.();
      if (exit && typeof (exit as Promise<void>).catch === 'function') {
        (exit as Promise<void>).catch(() => undefined);
      }
    } else {
      tryRequestMobileFullscreenLandscape();
    }
  } catch {
    // ignore
  }
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HorrorEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [cutscene, setCutscene] = useState<CutsceneUiState | null>(null);
  const [portraits, setPortraits] = useState<Record<CharacterPortraitId, string>>({
    survivor: '',
    marcos: '',
    diddy: '',
    scientist: '',
    director: '',
  });
  const [settings, setSettings] = useState<GameSettings>(() => saveSystem.getSettings());
  const [profile, setProfile] = useState<ProfileProgress>(() => saveSystem.getProfile());
  const [progression, setProgression] = useState<ProgressionStateV4>(() => saveSystem.getProgression());
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('hard');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [multiplayerOpen, setMultiplayerOpen] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => authClient.getSession());
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncState>(() => cloudSync.getStatus());
  const [activeMpRoom, setActiveMpRoom] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement)
  );
  const [micEnabled, setMicEnabled] = useState(false);
  const [mutedVoicePeers, setMutedVoicePeers] = useState<string[]>([]);
  const [itemRenders, setItemRenders] = useState<Record<string, string>>({});
  const [toastQueue, setToastQueue] = useState<AchievementToastPayload[]>([]);
  const [hudEditorOpen, setHudEditorOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [portraitTipDismissed, setPortraitTipDismissed] = useState(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth
  );

  // Track orientation & fullscreen changes for smart fullscreen toggle
  useEffect(() => {
    const onResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('fullscreenchange', onFsChange);
    };
  }, []);

  // Mount Three.js HorrorEngine ONCE — React HUD state updates NEVER recreate WebGLRenderer!
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const engine = new HorrorEngine(mount, {
      onHudUpdate: (nextHud) => setHud(nextHud),
      onCutsceneUpdate: (nextCs) => setCutscene(nextCs),
      onProfileUpdate: (nextProf) => setProfile(nextProf),
      onProgressionUpdate: (nextProg) => setProgression(nextProg),
      onAchievementUnlocked: (toast) => setToastQueue((prev) => [...prev, toast]),
      onPortraitsUpdate: (nextPortraits) => setPortraits(nextPortraits),
      onToggleJournal: () => {
        setMapOpen(false);
        setBackpackOpen(false);
        setJournalOpen((prev) => !prev);
      },
      onToggleBackpack: () => {
        setMapOpen(false);
        setJournalOpen(false);
        setBackpackOpen((prev) => !prev);
      },
      onToggleMap: () => {
        setJournalOpen(false);
        setBackpackOpen(false);
        setMapOpen((prev) => !prev);
      },
    });
    engineRef.current = engine;
    setPortraits(engine.getCharacterPortraits());
    setItemRenders(engine.getItemRenders());

    // Consume Google OAuth callback token if present in URL, or refresh existing remote session
    void authClient.consumeOAuthCallbackFromUrl().then((oauthSession) => {
      if (oauthSession) {
        setAuthSession(oauthSession);
      } else {
        void authClient.refreshSession().then((refreshed) => {
          if (refreshed && refreshed.mode === 'remote') {
            setAuthSession(refreshed);
          }
        });
      }
    });

    // Silent URL query params for automated visual verification
    const params = new URLSearchParams(window.location.search);
    if (params.get('cutscene') === '1') {
      engine.startNewGame('hard', false);
    } else if (params.get('autostart') === '1') {
      engine.startNewGame('hard', true);
      const sc = params.get('showcase');
      if (sc === 'courtyard' || sc === 'holdbreath' || sc === 'uv' || sc === 'cctv' || sc === 'workbench') {
        engine.preparePhase1Showcase(sc);
      } else if (params.get('uv') === '1') {
        engine.preparePhase1Showcase('uv');
      } else if (params.get('cctv') === '1') {
        engine.preparePhase1Showcase('cctv');
      } else if (params.get('workbench') === '1') {
        engine.preparePhase1Showcase('workbench');
      } else if (params.get('keypad') === '1') {
        engine.openSafeKeypad();
      }
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const anyEngineModalOpen =
    hud.keypadOpen ||
    hud.cctvOpen ||
    hud.workbenchOpen ||
    hud.terminalOpen ||
    hud.quickInspect !== null;

  // Global hotkeys for Map [M], ARG Journal [J], and Backpack [I / Tab] during active gameplay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (hud.mode !== 'playing' || anyEngineModalOpen || settingsOpen || hudEditorOpen) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        setJournalOpen(false);
        setBackpackOpen(false);
        setMapOpen((prev) => !prev);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        setMapOpen(false);
        setBackpackOpen(false);
        setJournalOpen((prev) => !prev);
      } else if (e.code === 'KeyI' || e.code === 'Tab') {
        e.preventDefault();
        setMapOpen(false);
        setJournalOpen(false);
        setBackpackOpen((prev) => !prev);
      } else if (e.code === 'Escape' && (backpackOpen || mapOpen || journalOpen)) {
        e.preventDefault();
        setBackpackOpen(false);
        setMapOpen(false);
        setJournalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.mode, anyEngineModalOpen, settingsOpen, hudEditorOpen, backpackOpen, mapOpen, journalOpen]);

  // Keep body data-input-mode / data-gamepad-style synced for console focus rings & CSS styling
  useEffect(() => {
    document.body.dataset.inputMode = hud.inputMode;
    document.body.dataset.gamepadStyle = hud.gamepadStyle;
  }, [hud.inputMode, hud.gamepadStyle]);

  // Bind Android Close-Shield & reactive Cloud Sync status badge
  useEffect(() => {
    cloudSync.bindAndroidCloseShield();
    return cloudSync.subscribeStatus(setCloudSyncStatus);
  }, []);

  useEffect(() => {
    if (authSession && authSession.mode === 'remote') {
      cloudSync.setCredentials({ uid: authSession.user.id, accessToken: authSession.token });
      const merged = saveSystem.applyCloudSave(authSession.cloudSave);
      setProfile(merged.profile);
      setProgression(merged.progression);
      setSettings(merged.settings);
    } else {
      cloudSync.setCredentials(null);
    }
  }, [authSession]);

  // Sync Voice Dubbing engine with live Language & Audio settings
  useEffect(() => {
    voiceDubbing.configure({
      language: settings.locale?.language ?? 'pt-BR',
      enabled: settings.locale?.dubbing !== false,
      volume: (settings.audio.master ?? 0.85) * (settings.audio.voiceTapes ?? 0.95),
      muted: settings.audio.muted,
    });
  }, [settings.locale, settings.audio.master, settings.audio.voiceTapes, settings.audio.muted]);

  // 30-35Hz Multiplayer Crossplay Sync Loop + Authoritative P. Drizzy/Door/Item Sync + Proximity Voice Chat
  useEffect(() => {
    if (!activeMpRoom || hud.mode !== 'playing') {
      engineRef.current?.setMultiplayerPeers([], null, false);
      proximityVoice.stop();
      setMicEnabled(false);
      return;
    }
    const eng = engineRef.current;
    const srv = eng?.getAuthoritativeServer();
    if (srv) {
      srv.onBroadcastDelta = (delta) => multiplayerClient.broadcastCompactDelta(delta);
      srv.onSelfHealSnapshot = (snap) => multiplayerClient.broadcastSelfHealSnapshot(snap);
    }

    // Immediate discrete world sync whenever any player unlocks/toggles doors, picks up items, or fixes generator
    if (eng) {
      eng.onWorldSyncEvent = (ev) => {
        if (ev.kind === 'door') {
          multiplayerClient.syncDoor(
            String(ev.payload.doorId || ''),
            Boolean(ev.payload.open),
            Boolean(ev.payload.locked)
          );
        } else if (ev.kind === 'item') {
          multiplayerClient.syncItem(String(ev.payload.itemId || ''), {
            collected: Boolean(ev.payload.collected),
            x: typeof ev.payload.x === 'number' ? ev.payload.x : undefined,
            y: typeof ev.payload.y === 'number' ? ev.payload.y : undefined,
            z: typeof ev.payload.z === 'number' ? ev.payload.z : undefined,
          });
        } else if (ev.kind === 'generator') {
          multiplayerClient.syncGenerator({
            powered: Boolean(ev.payload.powered),
            fuseInserted: Boolean(ev.payload.fuseInserted),
          });
        }
      };
    }

    // Start Proximity Voice Chat (WebRTC + STUN + WSS signaling)
    const localVoiceId = multiplayerClient.playerId || `p_${Date.now()}`;
    void proximityVoice.start(
      localVoiceId,
      (targetPeerId, sig) => multiplayerClient.sendVoiceSignal(targetPeerId, sig),
      false
    );

    const unsubVoice = multiplayerClient.on('voice_signal', (payload) => {
      const p = payload as { fromPeerId?: string; signal?: VoiceSignalPayload };
      if (p.fromPeerId && p.signal) {
        void proximityVoice.handleSignal(p.fromPeerId, p.signal);
      }
    });
    const unsubDoor = multiplayerClient.on('door_synced', (payload) => {
      const p = payload as { doorId?: string; open?: boolean; locked?: boolean };
      if (p.doorId) {
        engineRef.current?.applyRemoteDoorToggle(p.doorId, Boolean(p.open), !p.locked);
      }
    });
    const unsubItem = multiplayerClient.on('item_synced', (payload) => {
      const p = payload as { itemId?: string; collected?: boolean; x?: number; y?: number; z?: number };
      if (p.itemId) {
        engineRef.current?.applyRemoteItemSync(p.itemId, Boolean(p.collected), {
          x: p.x,
          y: p.y,
          z: p.z,
        });
      }
    });
    const unsubGen = multiplayerClient.on('generator_synced', (payload) => {
      const p = payload as { powered?: boolean };
      if (p.powered) {
        engineRef.current?.applyRemoteGeneratorFixed();
      }
    });
    const unsubDelta = multiplayerClient.on('compact_delta', (d) => {
      engineRef.current?.applyCompactDelta(d as never);
    });
    const unsubHeal = multiplayerClient.on('self_heal_snapshot', (s) => {
      engineRef.current?.applyReplicatedWorldSnapshot(s as never);
    });
    const unsubHost = multiplayerClient.on('host_migrated', (payload) => {
      const p = payload as { snapshot?: unknown };
      const promoted = engineRef.current?.promoteToHostFromSnapshot(p.snapshot as never);
      if (promoted) {
        promoted.onBroadcastDelta = (delta) => multiplayerClient.broadcastCompactDelta(delta);
        promoted.onSelfHealSnapshot = (snap) => multiplayerClient.broadcastSelfHealSnapshot(snap);
      }
    });

    let tickCount = 0;
    const timer = window.setInterval(() => {
      const curEng = engineRef.current;
      if (!curEng) return;
      tickCount++;
      const local = curEng.getLocalPlayerSyncState();
      const myNick = authSession?.user.nickname || 'Agente-09';
      const myPlat = hud.inputMode;
      const isSpeakingNow = proximityVoice.isLocalSpeaking();

      multiplayerClient.sendPlayerState({
        x: local.x,
        y: local.y,
        z: local.z,
        yaw: local.yaw,
        pitch: local.pitch,
        crouching: local.crouching,
        sprinting: local.sprinting,
        speaking: isSpeakingNow,
        flashlightOn: local.flashlightOn,
        uvOn: local.uvOn,
        heldItem: local.heldItem,
        captured: local.captured,
        spectating: local.captured,
        alive: local.alive,
        nickname: myNick,
        platform: myPlat,
      });

      // Authoritative Host broadcasts P. Drizzy at 30Hz & full world snapshot every 2.0s (Zero Parallel World!)
      const isHostNow =
        multiplayerClient.currentRoom?.hostId === multiplayerClient.playerId ||
        Boolean(curEng.getAuthoritativeServer());
      if (isHostNow) {
        multiplayerClient.broadcastCompactDelta(curEng.getAuthoritativeWorldDelta());
        if (tickCount % 60 === 0) {
          multiplayerClient.broadcastSelfHealSnapshot(curEng.exportAuthoritativeFullSnapshot());
        }
      }

      const sampledMap = multiplayerClient.getAllInterpolatedPeers(Date.now());
      const roomPlayers = multiplayerClient.currentRoom?.players ?? [];
      const voicePosMap: Record<string, { x: number; y: number; z: number }> = {};
      const peers = Object.entries(sampledMap).map(([id, snap]) => {
        const meta = roomPlayers.find((rp) => rp.id === id);
        voicePosMap[id] = { x: snap.x, y: snap.y, z: snap.z };
        return {
          id,
          x: snap.x,
          y: snap.y,
          z: snap.z,
          yaw: snap.yaw,
          pitch: snap.pitch,
          floor: (snap.y < -1.5 ? -1 : 0) as 0 | -1,
          alive: snap.alive !== false,
          crouching: Boolean(snap.crouching),
          sprinting: Boolean(snap.sprinting),
          speaking: Boolean(snap.speaking),
          captured: Boolean(snap.captured),
          flashlightOn: snap.flashlightOn !== false,
          uvOn: Boolean(snap.uvOn),
          heldItem: snap.heldItem ?? null,
          nickname: snap.nickname || meta?.nickname || 'Aliado',
          platform: snap.platform || meta?.platform || 'pc',
        };
      });
      curEng.setMultiplayerPeers(peers, multiplayerClient.pingMs, false);

      // Keep WebRTC mesh connected & update 3D spatial GainNode + StereoPannerNode
      const peerIds = roomPlayers.map((rp) => rp.id);
      if (tickCount % 15 === 1) {
        proximityVoice.syncPeers(peerIds);
      }
      proximityVoice.updateSpatialPositions(
        { x: local.x, y: local.y, z: local.z, yaw: local.yaw },
        voicePosMap
      );
    }, 33);

    return () => {
      window.clearInterval(timer);
      unsubVoice();
      unsubDoor();
      unsubItem();
      unsubGen();
      unsubDelta();
      unsubHeal();
      unsubHost();
      if (eng) eng.onWorldSyncEvent = null;
      if (srv) {
        srv.onBroadcastDelta = null;
        srv.onSelfHealSnapshot = null;
      }
    };
  }, [activeMpRoom, hud.mode, authSession?.user.nickname, hud.inputMode]);

  // Pause heavy 3D background world loop while full-screen menus (Store / Account / MP Hub) are open
  useEffect(() => {
    engineRef.current?.pauseBackgroundLoop(storeOpen || accountOpen || multiplayerOpen);
  }, [storeOpen, accountOpen, multiplayerOpen]);

  // Global Native Console / Gamepad Menu Navigation across Title, Pause, Settings, Store, Account, MP, Journal, Backpack, Keypads & Modals
  const menuNavActive =
    hud.mode !== 'playing' ||
    settingsOpen ||
    storeOpen ||
    accountOpen ||
    multiplayerOpen ||
    hudEditorOpen ||
    mapOpen ||
    journalOpen ||
    backpackOpen ||
    anyEngineModalOpen;

  // Auto-focus first actionable control whenever a menu/modal opens in gamepad mode
  useEffect(() => {
    if (!menuNavActive || hud.inputMode !== 'gamepad') return;
    const t = window.setTimeout(() => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(
        (d) => d.offsetParent !== null
      );
      const root: ParentNode = dialogs[dialogs.length - 1] ?? document.body;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !focusables.includes(active)) {
        // Prefer the first primary action (skip close X button if another control exists)
        const preferred =
          focusables.find((el) => !/fechar|sair|dispensar/i.test(el.getAttribute('aria-label') || '')) ??
          focusables[0];
        preferred?.focus();
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [
    menuNavActive,
    hud.inputMode,
    hud.mode,
    hud.cctvOpen,
    hud.keypadOpen,
    hud.workbenchOpen,
    hud.terminalOpen,
    hud.quickInspect,
    settingsOpen,
    hudEditorOpen,
    backpackOpen,
    journalOpen,
    mapOpen,
  ]);

  useEffect(() => {
    if (!menuNavActive || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let raf = 0;
    let prev: NormalizedGamepadState | null = null;
    const repeater = new MenuRepeatController();
    let lastMs = performance.now();

    const step = (nowMs: number) => {
      const dt = Math.min(0.1, (nowMs - lastMs) / 1000);
      lastMs = nowMs;

      const pads = navigator.getGamepads();
      const gp = pads ? Array.from(pads).find((p) => p && p.connected) : null;
      if (gp) {
        const st = normalizeGamepadState(
          gp,
          settings.controls.gamepadDeadzone ?? 0.14,
          settings.controls.gamepadProfile ?? 'auto'
        );
        if (st.anyActive) {
          engineRef.current?.notifyGamepadActivity(gp.id);
        }
        const edge = (c: boolean, p: boolean | undefined) => c && !p;

        // Always trap navigation inside the TOPMOST visible [role="dialog"] (supports Settings over Pause!)
        const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).filter(
          (d) => d.offsetParent !== null
        );
        const root: ParentNode = dialogs[dialogs.length - 1] ?? document.body;
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        // Determine cardinal direction (D-Pad takes priority over Left Stick)
        let activeDir: NavDirection | null = null;
        if (st.dpadUp) activeDir = 'up';
        else if (st.dpadDown) activeDir = 'down';
        else if (st.dpadLeft) activeDir = 'left';
        else if (st.dpadRight) activeDir = 'right';
        else if (Math.abs(st.moveX) > 0.52 || Math.abs(st.moveY) > 0.52) {
          activeDir =
            Math.abs(st.moveX) >= Math.abs(st.moveY)
              ? st.moveX > 0
                ? 'right'
                : 'left'
              : st.moveY > 0
              ? 'down'
              : 'up';
        }

        // Toggle-close shortcuts: D-Up closes Journal, D-Down closes Backpack, Touchpad/View closes Map
        let consumedToggle = false;
        if (journalOpen && edge(st.dpadUp, prev?.dpadUp) && !settingsOpen && !hudEditorOpen) {
          setJournalOpen(false);
          engineRef.current?.playUiClick();
          consumedToggle = true;
        } else if (backpackOpen && edge(st.dpadDown, prev?.dpadDown) && !settingsOpen && !hudEditorOpen) {
          setBackpackOpen(false);
          engineRef.current?.playUiClick();
          consumedToggle = true;
        } else if (mapOpen && edge(st.shareOrTouch, prev?.shareOrTouch) && !settingsOpen && !hudEditorOpen) {
          setMapOpen(false);
          engineRef.current?.playUiClick();
          consumedToggle = true;
        }

        const firedDir = consumedToggle ? null : repeater.update(dt, activeDir);
        if (firedDir && focusables.length > 0) {
          const activeEl = document.activeElement as HTMLElement | null;
          const isRangeFocused =
            activeEl instanceof HTMLInputElement &&
            activeEl.type === 'range' &&
            focusables.includes(activeEl);

          if (isRangeFocused && (firedDir === 'left' || firedDir === 'right')) {
            // Native Console Range Slider Scrubbing with Left/Right!
            const min = activeEl.min !== '' ? Number(activeEl.min) : 0;
            const max = activeEl.max !== '' ? Number(activeEl.max) : 100;
            const stepVal = activeEl.step !== '' && activeEl.step !== 'any' ? Number(activeEl.step) : 1;
            const cur = Number(activeEl.value);
            const nextVal = computeSliderNextValue(cur, min, max, stepVal, firedDir);
            if (applyNativeRangeValue(activeEl, nextVal)) {
              engineRef.current?.playUiClick();
            }
          } else {
            const curIdx = activeEl ? focusables.indexOf(activeEl) : -1;
            const rects = focusables.map((el) => {
              const r = el.getBoundingClientRect();
              return { x: r.left, y: r.top, w: r.width, h: r.height };
            });
            const nextIdx = findSpatialNextIndex(rects, curIdx, firedDir);
            const target = focusables[nextIdx];
            if (target) {
              target.focus();
              target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
              engineRef.current?.playUiClick();
            }
          }
        }

        // L1 / R1 cycles tabs inside Settings or Journal (CCTV handles its own L1/R1 cameras in HorrorEngine)
        if (!hud.cctvOpen && (edge(st.l1, prev?.l1) || edge(st.r1, prev?.r1))) {
          const tabs = Array.from(root.querySelectorAll<HTMLElement>('[role="tab"]'));
          if (tabs.length > 0) {
            const curTab = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
            const delta = edge(st.r1, prev?.r1) ? 1 : -1;
            const nextTab = tabs[(Math.max(0, curTab) + delta + tabs.length) % tabs.length];
            nextTab?.click();
            nextTab?.focus();
            engineRef.current?.playUiClick();
          }
        }

        // Cross / A activates focused control (or advances cutscene)
        if (edge(st.cross, prev?.cross)) {
          if (hud.mode === 'intro_cutscene' || hud.mode === 'ending_cutscene') {
            engineRef.current?.advanceCutscene();
          } else {
            const active = document.activeElement as HTMLElement | null;
            if (active && focusables.includes(active)) {
              if (!(active instanceof HTMLInputElement && active.type === 'range')) {
                active.click();
                engineRef.current?.playUiClick();
              }
            } else {
              focusables[0]?.focus();
            }
          }
        }

        // Circle / B closes topmost modal, resumes pause, or skips cutscene (CCTV handles its own Circle close)
        if (!hud.cctvOpen && edge(st.circle, prev?.circle)) {
          if (hud.mode === 'intro_cutscene' || hud.mode === 'ending_cutscene') {
            engineRef.current?.skipCutscene();
          } else if (hudEditorOpen) {
            setHudEditorOpen(false);
            setSettingsOpen(true);
            engineRef.current?.playUiClick();
          } else if (settingsOpen) {
            setSettingsOpen(false);
            engineRef.current?.playUiClick();
          } else if (backpackOpen) {
            setBackpackOpen(false);
            engineRef.current?.playUiClick();
          } else if (journalOpen) {
            setJournalOpen(false);
            engineRef.current?.playUiClick();
          } else if (mapOpen) {
            setMapOpen(false);
            engineRef.current?.playUiClick();
          } else if (hud.quickInspect) {
            engineRef.current?.closeQuickInspect();
          } else if (hud.keypadOpen) {
            engineRef.current?.closeSafeKeypad();
          } else if (hud.workbenchOpen) {
            engineRef.current?.closeWorkbench();
          } else if (hud.terminalOpen) {
            engineRef.current?.closeSecretTerminal();
          } else if (hud.mode === 'paused') {
            engineRef.current?.resumeGame();
          }
        }

        // Options / Start unpauses Pause Menu or closes top Settings/Inventory/Journal/Map overlay
        if (!hud.cctvOpen && edge(st.options, prev?.options)) {
          if (hudEditorOpen) setHudEditorOpen(false);
          else if (settingsOpen) setSettingsOpen(false);
          else if (backpackOpen) setBackpackOpen(false);
          else if (journalOpen) setJournalOpen(false);
          else if (mapOpen) setMapOpen(false);
          else if (hud.mode === 'paused') engineRef.current?.resumeGame();
          else if (hud.mode === 'intro_cutscene' || hud.mode === 'ending_cutscene') {
            engineRef.current?.skipCutscene();
          }
        }

        prev = st;
      } else {
        prev = null;
        repeater.reset();
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [
    menuNavActive,
    hud.mode,
    hud.cctvOpen,
    hud.quickInspect,
    hud.keypadOpen,
    hud.workbenchOpen,
    hud.terminalOpen,
    settingsOpen,
    hudEditorOpen,
    backpackOpen,
    journalOpen,
    mapOpen,
    settings.controls.gamepadDeadzone,
    settings.controls.gamepadProfile,
  ]);

  const handleSettingsChange = useCallback((next: GameSettings) => {
    const saved = saveSystem.updateSettings(next);
    setSettings(saved);
    engineRef.current?.applySettings(saved);
  }, []);

  const handleResetSettings = useCallback(() => {
    const fresh = saveSystem.resetSettings();
    setSettings(fresh);
    engineRef.current?.applySettings(fresh);
  }, []);

  const handleSaveHudLayout = useCallback(
    (layout: HudCustomLayout) => {
      const next: GameSettings = {
        ...settings,
        controls: {
          ...settings.controls,
          hudCustomLayout: layout,
        },
      };
      const saved = saveSystem.updateSettings(next);
      setSettings(saved);
      engineRef.current?.applySettings(saved);
      setHudEditorOpen(false);
      setSettingsOpen(true);
    },
    [settings]
  );

  const handleQuickSensitivityChange = useCallback(
    (mode: 'touch' | 'look', value: number) => {
      const next: GameSettings = {
        ...settings,
        controls: {
          ...settings.controls,
          ...(mode === 'touch' ? { touchSensitivity: value } : { lookSensitivity: value }),
        },
      };
      const saved = saveSystem.updateSettings(next);
      setSettings(saved);
      engineRef.current?.applySettings(saved);
    },
    [settings]
  );

  const handleToggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.toggleMute();
    setSettings(saveSystem.getSettings());
  }, []);

  const handleProgressionChange = useCallback((next: ProgressionStateV4) => {
    setProgression(next);
    setProfile(saveSystem.getProfile());
    engineRef.current?.syncProgressionCosmetics();
  }, []);

  const handleReplayEnding = useCallback((endingId: EndingId) => {
    setStoreOpen(false);
    engineRef.current?.replayEndingCutscene(endingId);
  }, []);

  const unclaimedAchievementsCount = Object.values(progression.achievements).filter(
    (a) => a.unlocked && !a.claimed
  ).length;

  const handleStartChapter1 = useCallback(() => {
    tryRequestMobileFullscreenLandscape();
    setMapOpen(false);
    setJournalOpen(false);
    setBackpackOpen(false);
    setSettingsOpen(false);
    setHudEditorOpen(false);
    engineRef.current?.startNewGame(selectedDifficulty, false);
  }, [selectedDifficulty]);

  const handleRestart = useCallback(() => {
    tryRequestMobileFullscreenLandscape();
    setMapOpen(false);
    setJournalOpen(false);
    setBackpackOpen(false);
    setSettingsOpen(false);
    setHudEditorOpen(false);
    engineRef.current?.startNewGame(selectedDifficulty, true);
  }, [selectedDifficulty]);

  const handleReturnToTitle = useCallback(() => {
    setMapOpen(false);
    setJournalOpen(false);
    setBackpackOpen(false);
    setSettingsOpen(false);
    setHudEditorOpen(false);
    engineRef.current?.returnToTitle();
  }, []);

  const handleBindMinimap = useCallback((canvas: HTMLCanvasElement | null) => {
    engineRef.current?.setMinimapCanvas(canvas);
  }, []);

  const handleBindFullMap = useCallback((canvas: HTMLCanvasElement | null) => {
    engineRef.current?.setFullMapCanvas(canvas);
  }, []);

  const handleBindCctvCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    engineRef.current?.setCctvCanvas(canvas);
  }, []);

  const handleVoiceBlip = useCallback((speaker: SpeakerId) => {
    engineRef.current?.playDialogueVoiceBlip(speaker);
  }, []);

  const showPortraitTip =
    hud.mode === 'playing' &&
    hud.inputMode === 'touch' &&
    isPortrait &&
    !portraitTipDismissed &&
    !anyEngineModalOpen &&
    !settingsOpen &&
    !hudEditorOpen;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#06070c]">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full" />

      {/* Title Screen */}
      {hud.mode === 'title' && !storeOpen && !accountOpen && !multiplayerOpen && (
        <TitleScreen
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
          onStartChapter1={() => setMultiplayerOpen(true)}
          onOpenPlaySelector={() => setMultiplayerOpen(true)}
          onOpenAccount={() => setAccountOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStore={() => setStoreOpen(true)}
          accountLabel={authSession?.user.nickname}
          isSignedIn={Boolean(authSession)}
          cloudSyncStatus={cloudSyncStatus}
          survivalCoins={progression.survivalCoins}
          equippedPerksCount={progression.equippedPerks.length}
          unclaimedAchievementsCount={unclaimedAchievementsCount}
          muted={settings.audio.muted}
          onToggleMute={handleToggleMute}
          profile={profile}
          inputMode={hud.inputMode}
          gamepadStyle={hud.gamepadStyle}
        />
      )}

      {/* Animated Live Achievement Unlock Toast */}
      <AchievementToast
        toast={toastQueue[0] ?? null}
        onDismiss={() => setToastQueue((prev) => prev.slice(1))}
      />

      {/* Tactical Cinematic Cutscene Overlay with 3D Rendered Portraits & PT/EN/ES Dubbing */}
      {cutscene && (hud.mode === 'intro_cutscene' || hud.mode === 'ending_cutscene') && (
        <CutsceneOverlay
          state={cutscene}
          portraits={portraits}
          inputMode={hud.inputMode}
          gamepadStyle={hud.gamepadStyle}
          onAdvance={() => engineRef.current?.advanceCutscene()}
          onSkip={() => engineRef.current?.skipCutscene()}
          onVoiceBlip={handleVoiceBlip}
          onSpeakStep={(speaker, text) => {
            const dubSpeaker =
              speaker === 'radio' ? 'marcos' : speaker === 'diddy' ? 'diddy' : 'survivor';
            voiceDubbing.speak(text, dubSpeaker);
          }}
          onStopSpeaking={() => voiceDubbing.stop()}
        />
      )}

      {/* Hiding, Proximity Chromatic Aberration & Configurable Vignette */}
      <AnalogHorrorOverlay hud={hud} vignetteIntensity={settings.gameplay.vignetteIntensity} />

      {/* Non-blocking Mobile Portrait Orientation Tip */}
      {showPortraitTip && (
        <div
          className="fixed left-1/2 top-16 -translate-x-1/2 z-30 horror-panel px-2.5 py-1.5 flex items-center gap-2 border border-amber-500/80 text-[11px] text-amber-200 max-w-[92%]"
          role="status"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0 rotate-90 text-amber-400" />
          <span>Gire o celular para horizontal para melhor visão</span>
          <button
            type="button"
            onClick={() => setPortraitTipDismissed(true)}
            aria-label="Dispensar aviso"
            className="p-0.5 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Gameplay HUD */}
      {hud.mode === 'playing' && (
        <>
          {hud.inputMode === 'touch' &&
            !anyEngineModalOpen &&
            !mapOpen &&
            !journalOpen &&
            !backpackOpen &&
            !settingsOpen &&
            !hudEditorOpen && (
              <TouchControls
                hud={hud}
                buttonScale={settings.controls.mobileButtonScale}
                buttonOpacity={settings.controls.mobileButtonOpacity}
                joystickMode={settings.controls.joystickMode}
                customLayout={settings.controls.hudCustomLayout}
                leftHanded={settings.controls.leftHanded}
                onJoystick={(nx, ny) => engineRef.current?.setMobileJoystick(nx, ny)}
                onLookDelta={(dx, dy) => engineRef.current?.addMobileLookDelta(dx, dy)}
                onSprintChange={(held) => engineRef.current?.setMobileSprint(held)}
                onHoldBreathChange={(held) => engineRef.current?.setMobileHoldBreath(held)}
                onToggleCrouch={() => engineRef.current?.toggleCrouch()}
                onToggleFlashlight={() => engineRef.current?.toggleFlashlight()}
                onContextualUse={() => engineRef.current?.triggerContextualUse()}
                onInteract={() => engineRef.current?.triggerInteract()}
                onDropActiveItem={() => engineRef.current?.dropInventoryItem()}
                onOpenBackpack={() => {
                  setMapOpen(false);
                  setJournalOpen(false);
                  setBackpackOpen(true);
                }}
                onPause={() => engineRef.current?.pauseGame()}
              />
            )}

          <GameHud
            hud={hud}
            settings={settings}
            muted={settings.audio.muted}
            itemRenders={itemRenders}
            onBindMinimapCanvas={handleBindMinimap}
            onOpenBackpack={() => {
              setMapOpen(false);
              setJournalOpen(false);
              setBackpackOpen(true);
            }}
            onOpenMap={() => {
              setJournalOpen(false);
              setBackpackOpen(false);
              setMapOpen(true);
            }}
            onOpenJournal={() => {
              setMapOpen(false);
              setBackpackOpen(false);
              setJournalOpen(true);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleMute={handleToggleMute}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreenSmart}
            mpActive={Boolean(activeMpRoom)}
            micEnabled={micEnabled}
            onToggleMic={() => {
              void proximityVoice.setMicEnabled(!micEnabled).then((ok) => {
                setMicEnabled(ok && !micEnabled);
              });
            }}
            voicePeers={(multiplayerClient.currentRoom?.players ?? [])
              .filter((p) => p.id !== multiplayerClient.playerId)
              .map((p) => ({ id: p.id, nickname: p.nickname }))}
            mutedVoicePeers={mutedVoicePeers}
            onToggleMutePeer={(peerId) => {
              const nextMuted = !mutedVoicePeers.includes(peerId);
              proximityVoice.setPeerMuted(peerId, nextMuted);
              setMutedVoicePeers((prev) =>
                nextMuted ? [...prev, peerId] : prev.filter((id) => id !== peerId)
              );
            }}
            onPause={() => engineRef.current?.pauseGame()}
            onSelectSlot={(idx) => engineRef.current?.selectHotbarSlot(idx)}
            onDropActiveItem={() => engineRef.current?.dropInventoryItem()}
            onInteractClick={() => engineRef.current?.triggerInteract()}
          />
        </>
      )}

      {/* FNAF Live 15 FPS 3D CCTV Security Monitor */}
      {hud.cctvOpen && hud.mode === 'playing' && (
        <CctvMonitorModal
          hud={hud}
          onBindCctvCanvas={handleBindCctvCanvas}
          onSelectCamera={(idx) => engineRef.current?.selectCctvCamera(idx)}
          onToggleDoor={(side) => engineRef.current?.toggleFnafDoor(side)}
          onClose={() => engineRef.current?.closeCctvMonitor()}
        />
      )}

      {/* Voxel Craft Workbench Modal */}
      {hud.workbenchOpen && hud.mode === 'playing' && (
        <WorkbenchModal
          hud={hud}
          itemRenders={itemRenders}
          onCraft={(recipe) =>
            engineRef.current?.craftRecipe(recipe) ?? { ok: false, message: 'ERRO' }
          }
          onClose={() => engineRef.current?.closeWorkbench()}
        />
      )}

      {/* 5-Digit Secret Terminal Modal */}
      {hud.terminalOpen && hud.mode === 'playing' && engineRef.current && (
        <SecretTerminalModal
          journal={engineRef.current.getJournalSnapshot()}
          onDigitTap={() => engineRef.current?.playKeypadTapSound()}
          onSubmitCode={(code) =>
            engineRef.current?.submitSecretTerminalCode(code) ?? { ok: false, message: 'ERRO' }
          }
          onClose={() => engineRef.current?.closeSecretTerminal()}
        />
      )}

      {/* Mobile-Friendly Custom 0-9 Safe Keypad */}
      {hud.keypadOpen && (
        <SafeKeypadModal
          discoveredDigits={hud.safeCodeHintDigits}
          onDigitTap={() => engineRef.current?.playKeypadTapSound()}
          onSubmitCode={(code) =>
            engineRef.current?.submitSafeCode(code) ?? { ok: false, message: 'ERRO' }
          }
          onClose={() => engineRef.current?.closeSafeKeypad()}
        />
      )}

      {/* Strict Fog-of-War Expanded Map Modal */}
      {mapOpen && hud.mode === 'playing' && (
        <WorldMapModal
          floor={hud.floor}
          exploredPct={hud.exploredPct}
          roomName={hud.roomName}
          onBindFullMapCanvas={handleBindFullMap}
          onClose={() => setMapOpen(false)}
        />
      )}

      {/* 1-Tap Quick Clue & Cassette Inspect Modal */}
      {hud.quickInspect && hud.mode === 'playing' && (
        <QuickInspectModal
          payload={hud.quickInspect}
          onClose={() => engineRef.current?.closeQuickInspect()}
        />
      )}

      {/* 10-Slot Backpack / Inventory & 3D Drop Modal */}
      {backpackOpen && hud.mode === 'playing' && (
        <BackpackModal
          hud={hud}
          itemRenders={itemRenders}
          onSelectHotbarSlot={(idx) => engineRef.current?.selectHotbarSlot(idx)}
          onReorderSlot={(from, to) => engineRef.current?.reorderInventorySlot(from, to)}
          onDropItem={(idx) => engineRef.current?.dropInventoryItem(idx)}
          onClose={() => setBackpackOpen(false)}
        />
      )}

      {/* Expanded ARG Clue, UV Cipher, Cassette, Omega Dossiers & 3D Character Files Journal Modal */}
      {journalOpen && hud.mode === 'playing' && engineRef.current && (
        <JournalModal
          journal={engineRef.current.getJournalSnapshot()}
          portraits={portraits}
          onClose={() => setJournalOpen(false)}
        />
      )}

      {/* Post-Match Animated Mission Report Dossier (Rank S-C & Survival Coins) */}
      {(hud.mode === 'victory' || hud.mode === 'defeat') && hud.lastMissionReport && !storeOpen && (
        <MissionReportModal
          report={hud.lastMissionReport}
          onPlayAgain={handleRestart}
          onReturnToTitle={handleReturnToTitle}
          onOpenStore={() => {
            handleReturnToTitle();
            setStoreOpen(true);
          }}
          onRankStampSound={() => engineRef.current?.playRankStampSound()}
        />
      )}

      {/* Pause Modal (and fallback Victory/Defeat if report unavailable) */}
      {(!hud.lastMissionReport || hud.mode === 'paused') && (
        <StatusModals
          hud={hud}
          profile={profile}
          settings={settings}
          onQuickSensitivityChange={handleQuickSensitivityChange}
          onResume={() => engineRef.current?.resumeGame()}
          onRestart={handleRestart}
          onOpenSettings={() => setSettingsOpen(true)}
          onReturnToTitle={handleReturnToTitle}
        />
      )}

      {/* 4-Tab Progression Hub: Perks, 3D Cosmetics Store, 24 Achievements & Gallery/Inspector */}
      {storeOpen && (
        <StoreModal
          progression={progression}
          onClose={() => setStoreOpen(false)}
          onProgressionChange={handleProgressionChange}
          onReplayEnding={handleReplayEnding}
          onDiddySkinChanged={() => engineRef.current?.syncProgressionCosmetics()}
          onPlayClick={() => engineRef.current?.playUiClick()}
        />
      )}

      {/* Account (Google OAuth + Email/Password + Guest Migration & Cloud Save) */}
      {accountOpen && (
        <AccountModal
          language={settings.locale?.language ?? 'pt-BR'}
          session={authSession}
          onSessionChange={(nextSession) => {
            setAuthSession(nextSession);
            setProgression(saveSystem.getProgression());
            setProfile(saveSystem.getProfile());
          }}
          onCloudSync={() => {
            setProgression(saveSystem.getProgression());
            setProfile(saveSystem.getProfile());
          }}
          onClose={() => setAccountOpen(false)}
        />
      )}

      {/* Solo vs. Crossplay Multiplayer Mode Selector, Room Browser, Creator & Lobby */}
      {multiplayerOpen && (
        <MultiplayerModal
          language={settings.locale?.language ?? 'pt-BR'}
          selectedDifficulty={selectedDifficulty}
          equippedPerksCount={progression.equippedPerks.length}
          nickname={authSession?.user.nickname ?? 'Agente-09'}
          inputMode={hud.inputMode}
          portraits={portraits}
          chatFilter={settings.gameplay.chatFilter !== false}
          onStartSolo={(diff) => {
            setSelectedDifficulty(diff);
            setActiveMpRoom(null);
            setMultiplayerOpen(false);
            tryRequestMobileFullscreenLandscape();
            engineRef.current?.startNewGame(diff, false);
          }}
          onStartMultiplayer={(roomCode, diff, seed) => {
            setSelectedDifficulty(diff);
            setActiveMpRoom(roomCode);
            setMultiplayerOpen(false);
            tryRequestMobileFullscreenLandscape();
            const isHost =
              multiplayerClient.currentRoom?.hostId === multiplayerClient.playerId;
            engineRef.current?.startNewGame(
              diff,
              true,
              seed,
              multiplayerClient.playerId ?? 'mp_local',
              isHost
            );
          }}
          onClose={() => setMultiplayerOpen(false)}
        />
      )}

      {/* Instant Auto-Saving 4-Tab Settings Modal */}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={handleSettingsChange}
          onReset={handleResetSettings}
          onOpenHudEditor={() => {
            setSettingsOpen(false);
            setHudEditorOpen(true);
          }}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreenSmart}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Interactive Fullscreen Mobile HUD Layout Editor */}
      {hudEditorOpen && (
        <HudEditorModal
          initialLayout={settings.controls.hudCustomLayout}
          globalScale={settings.controls.mobileButtonScale}
          globalOpacity={settings.controls.mobileButtonOpacity}
          onSave={handleSaveHudLayout}
          onClose={() => {
            setHudEditorOpen(false);
            setSettingsOpen(true);
          }}
        />
      )}

      {/* Native Console / Gamepad Footer Legend when navigating Modals, Pause, CCTV or Cutscenes */}
      {hud.inputMode === 'gamepad' &&
        menuNavActive &&
        !(hud.mode === 'title' && !settingsOpen && !hudEditorOpen) && (
          <div
            data-testid="console-nav-bar"
            className="pointer-events-none fixed bottom-2 left-1/2 -translate-x-1/2 z-[60] horror-panel px-3 py-1 border border-amber-500/70 flex items-center gap-3 text-[10px] sm:text-[11px] font-mono-num text-slate-200 whitespace-nowrap"
          >
            {hud.cctvOpen ? (
              hud.gamepadStyle === 'playstation' ? (
                <>
                  <span><strong className="text-amber-300">L1/R1</strong> Câmeras</span>
                  <span><strong className="text-amber-300">L2/R2</strong> Portas Esq/Dir</span>
                  <span><strong className="text-amber-300">✕</strong> Selecionar</span>
                  <span><strong className="text-amber-300">○</strong> Sair</span>
                </>
              ) : (
                <>
                  <span><strong className="text-amber-300">LB/RB</strong> Câmeras</span>
                  <span><strong className="text-amber-300">LT/RT</strong> Portas Esq/Dir</span>
                  <span><strong className="text-amber-300">A</strong> Selecionar</span>
                  <span><strong className="text-amber-300">B</strong> Sair</span>
                </>
              )
            ) : hud.mode === 'intro_cutscene' || hud.mode === 'ending_cutscene' ? (
              hud.gamepadStyle === 'playstation' ? (
                <>
                  <span><strong className="text-amber-300">✕</strong> Avançar</span>
                  <span><strong className="text-amber-300">○ / OPT</strong> Pular</span>
                </>
              ) : (
                <>
                  <span><strong className="text-amber-300">A</strong> Avançar</span>
                  <span><strong className="text-amber-300">B / MENU</strong> Pular</span>
                </>
              )
            ) : hud.gamepadStyle === 'playstation' ? (
              <>
                <span><strong className="text-amber-300">D-PAD</strong> Navegar</span>
                <span><strong className="text-amber-300">←→</strong> Ajustar Slider</span>
                {(settingsOpen || journalOpen) && (
                  <span><strong className="text-amber-300">L1/R1</strong> Abas</span>
                )}
                <span><strong className="text-amber-300">✕</strong> Confirmar</span>
                <span><strong className="text-amber-300">○</strong> Voltar</span>
              </>
            ) : (
              <>
                <span><strong className="text-amber-300">D-PAD</strong> Navegar</span>
                <span><strong className="text-amber-300">←→</strong> Ajustar Slider</span>
                {(settingsOpen || journalOpen) && (
                  <span><strong className="text-amber-300">LB/RB</strong> Abas</span>
                )}
                <span><strong className="text-amber-300">A</strong> Confirmar</span>
                <span><strong className="text-amber-300">B</strong> Voltar</span>
              </>
            )}
          </div>
        )}
    </div>
  );
}
