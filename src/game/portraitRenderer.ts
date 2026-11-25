import * as THREE from 'three';
import type { MaterialPack } from './textures';
import type { DiddySkinId } from './types';
import {
  createDiddyArticulatedRig,
  createOmegaDirectorRig,
  createOmegaScientistRig,
  createVigiaMarcosRig,
  createVoxelSurvivorRig,
} from './models';

export type CharacterPortraitId = 'survivor' | 'marcos' | 'diddy' | 'scientist' | 'director';

export interface CharacterLoreProfile {
  id: CharacterPortraitId;
  name: string;
  codename: string;
  role: string;
  clearance: string;
  status: string;
  accent: 'amber' | 'emerald' | 'red' | 'cyan' | 'violet';
  summary: string;
  dossierNotes: string[];
}

export const LORE_CHARACTER_PROFILES: readonly CharacterLoreProfile[] = [
  {
    id: 'survivor',
    name: 'Agente Sem Registro',
    codename: 'PROTAGONISTA // INV-09',
    role: 'Investigador Infiltrado',
    clearance: 'ACESSO CLANDESTINO',
    status: 'EM CAMPO — SETOR 09',
    accent: 'amber',
    summary:
      'Entrou clandestinamente no perímetro interditado do Setor 09 para investigar o desaparecimento da equipe noturna e os relatos sobre o Projeto Ômega.',
    dossierNotes: [
      'Equipado com lanterna tática dual-spectrum (Luz Branca + UV 365nm) e mochila de campo.',
      'Mantém contato intermitente por rádio com o Vigia Marcos na guarita externa.',
      'Objetivo primário: decifrar o cofre do subsolo, recuperar a Chave Mestra e escapar pelo Portão Norte.',
    ],
  },
  {
    id: 'marcos',
    name: 'Marcos Tavares',
    codename: 'VIGIA MARCOS // GUARITA',
    role: 'Chefe de Vigilância Noturna',
    clearance: 'NÍVEL 2 — SEGURANÇA',
    status: 'SINAL DE RÁDIO INSTÁVEL',
    accent: 'emerald',
    summary:
      'Veterano da segurança patrimonial do Setor 09. Permaneceu no posto após a evacuação de emergência para monitorar o sistema CCTV e impedir a fuga da Cela 09.',
    dossierNotes: [
      'Registrou a primeira queda do gerador e o vazamento do Composto 09 no corredor do subsolo.',
      'Escondeu chaves de contingência e instruções de bancada antes de perder contato com a sala de câmeras.',
      'Seu distintivo foi encontrado próximo ao balcão da recepção após o último turno.',
    ],
  },
  {
    id: 'diddy',
    name: 'Sujeito 09 ("P. Drizzy")',
    codename: 'AMEAÇA CLASSE-OMEGA // CELA 09',
    role: 'Ex-Capataz / Entidade Contaminada',
    clearance: 'CONTENÇÃO ROMPIDA',
    status: 'HOSTIL — CAÇANDO NO SETOR',
    accent: 'red',
    summary:
      'Antigo supervisor das operações subterrâneas submetido à exposição direta do Composto 09. Apresenta força sobre-humana, audição hiper-sensível e fotofobia agressiva.',
    dossierNotes: [
      'Carrega o chaveiro industrial metálico do turno noturno — o tilintar denuncia sua aproximação.',
      'Sua estatura larga impede a entrada nos dutos de ventilação estreitos do complexo.',
      'Vulnerável a descargas de alta voltagem (Taser improvisado) que paralisam seu sistema motor temporariamente.',
    ],
  },
  {
    id: 'scientist',
    name: 'Dra. Helena Vasconcelos',
    codename: 'DRA. HELENA // BIO-LAB 09',
    role: 'Chefe de Pesquisa — Composto 09',
    clearance: 'NÍVEL 4 — LABORATÓRIO',
    status: 'DESAPARECIDA',
    accent: 'violet',
    summary:
      'Bioquímica responsável pela formulação do Composto 09. Gravou fitas VHS clandestinas denunciando a militarização dos testes na Enfermaria e no Subsolo.',
    dossierNotes: [
      'Deixou marcas com tinta fluorescente UV pelas paredes para guiar investigadores sem alertar a Diretoria.',
      'Alertou que o protocolo de isolamento da Cela 09 falharia caso o gerador auxiliar sofresse curto-circuito.',
      'Último registro de áudio captado próximo ao Terminal Ômega no subsolo.',
    ],
  },
  {
    id: 'director',
    name: 'Diretor Artur Neves',
    codename: 'DIRETOR NEVES // PROJETO ÔMEGA',
    role: 'Diretor Executivo do Complexo',
    clearance: 'NÍVEL 5 — SIGILO ABSOLUTO',
    status: 'EVACUADO ANTES DO INCIDENTE',
    accent: 'cyan',
    summary:
      'Autoridade máxima do Projeto Ômega. Ordenou a interdição total do Setor 09 e o lacre do Portão Norte para encobrir as falhas de contenção do Sujeito 09.',
    dossierNotes: [
      'Codificou o cofre blindado do subsolo com dígitos dispersos em notas de auditoria.',
      'Autorizou o uso de portas blindadas de contenção na sala de monitoramento CCTV.',
      'Documentos internos apontam planos para reativar o Nível 2 após a limpeza do incidente.',
    ],
  },
];

interface PortraitStudioSpec {
  id: CharacterPortraitId;
  keyColor: number;
  keyIntensity: number;
  rimColor: number;
  rimIntensity: number;
  fillTop: number;
  fillBot: number;
  bgTop: string;
  bgBot: string;
  camPos: [number, number, number];
  lookAt: [number, number, number];
  modelYaw: number;
  build: (pack: MaterialPack) => THREE.Object3D;
}

const PORTRAIT_SIZE = 256;

function createDiddyPortraitSpec(diddySkinId: DiddySkinId): PortraitStudioSpec {
  if (diddySkinId === 'unstable_exp') {
    return {
      id: 'diddy',
      keyColor: 0xdcfce7,
      keyIntensity: 3.25,
      rimColor: 0x10b981,
      rimIntensity: 4.8,
      fillTop: 0x34d399,
      fillBot: 0x0a1f1a,
      bgTop: '#082a20',
      bgBot: '#030b09',
      camPos: [0.4, 1.9, 1.48],
      lookAt: [0.0, 1.72, 0.02],
      modelYaw: -0.25,
      build: (pack) => createDiddyArticulatedRig(pack, 'unstable_exp').root,
    };
  }
  if (diddySkinId === 'armored_proto') {
    return {
      id: 'diddy',
      keyColor: 0xfef3c7,
      keyIntensity: 3.4,
      rimColor: 0xf97316,
      rimIntensity: 4.6,
      fillTop: 0x94a3b8,
      fillBot: 0x1e2430,
      bgTop: '#261a14',
      bgBot: '#080709',
      camPos: [0.4, 1.9, 1.48],
      lookAt: [0.0, 1.72, 0.02],
      modelYaw: -0.25,
      build: (pack) => createDiddyArticulatedRig(pack, 'armored_proto').root,
    };
  }
  return {
    id: 'diddy',
    keyColor: 0xffdfd0,
    keyIntensity: 3.35,
    rimColor: 0xef4444,
    rimIntensity: 4.6,
    fillTop: 0x7c4a5c,
    fillBot: 0x1b1018,
    bgTop: '#290d14',
    bgBot: '#080306',
    camPos: [0.4, 1.9, 1.48],
    lookAt: [0.0, 1.72, 0.02],
    modelYaw: -0.25,
    build: (pack) => createDiddyArticulatedRig(pack, 'classic_s09').root,
  };
}

function getPortraitSpecs(diddySkinId: DiddySkinId): PortraitStudioSpec[] {
  return [
    {
      id: 'survivor',
      keyColor: 0xffe4bc,
      keyIntensity: 3.3,
      rimColor: 0x38bdf8,
      rimIntensity: 3.8,
      fillTop: 0x94a3b8,
      fillBot: 0x263449,
      bgTop: '#102033',
      bgBot: '#050912',
      camPos: [0.34, 1.44, 1.22],
      lookAt: [0.0, 1.35, 0.0],
      modelYaw: -0.22,
      build: (pack) => createVoxelSurvivorRig(pack),
    },
    {
      id: 'marcos',
      keyColor: 0xfff4d2,
      keyIntensity: 3.5,
      rimColor: 0x34d399,
      rimIntensity: 4.0,
      fillTop: 0x94a3b8,
      fillBot: 0x1e293b,
      bgTop: '#0c2922',
      bgBot: '#040a09',
      camPos: [-0.34, 1.49, 1.24],
      lookAt: [0.0, 1.38, 0.0],
      modelYaw: 0.24,
      build: (pack) => createVigiaMarcosRig(pack),
    },
    createDiddyPortraitSpec(diddySkinId),
    {
      id: 'scientist',
      keyColor: 0xe8f6ff,
      keyIntensity: 3.15,
      rimColor: 0xa855f7,
      rimIntensity: 3.8,
      fillTop: 0x818cf8,
      fillBot: 0x1e1b2e,
      bgTop: '#1b1433',
      bgBot: '#07050e',
      camPos: [-0.32, 1.42, 1.2],
      lookAt: [0.0, 1.33, 0.0],
      modelYaw: 0.22,
      build: (pack) => createOmegaScientistRig(pack),
    },
    {
      id: 'director',
      keyColor: 0xf1f5f9,
      keyIntensity: 3.35,
      rimColor: 0xf59e0b,
      rimIntensity: 4.1,
      fillTop: 0x94a3b8,
      fillBot: 0x1f191c,
      bgTop: '#241915',
      bgBot: '#070507',
      camPos: [0.36, 1.5, 1.26],
      lookAt: [0.0, 1.39, 0.0],
      modelYaw: -0.24,
      build: (pack) => createOmegaDirectorRig(pack),
    },
  ];
}

function renderPortraitSpecsBatch(
  renderer: THREE.WebGLRenderer,
  pack: MaterialPack,
  specs: PortraitStudioSpec[],
  envTexture?: THREE.Texture | null
): Partial<Record<CharacterPortraitId, string>> {
  const result: Partial<Record<CharacterPortraitId, string>> = {};
  if (typeof document === 'undefined') return result;

  let rt: THREE.WebGLRenderTarget | null = null;
  const prevTarget = renderer.getRenderTarget();
  const prevClearColor = new THREE.Color();
  renderer.getClearColor(prevClearColor);
  const prevClearAlpha = renderer.getClearAlpha();
  const prevAutoClear = renderer.autoClear;

  try {
    rt = new THREE.WebGLRenderTarget(PORTRAIT_SIZE, PORTRAIT_SIZE, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    });

    const outCanvas = document.createElement('canvas');
    outCanvas.width = PORTRAIT_SIZE;
    outCanvas.height = PORTRAIT_SIZE;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return result;

    const pixelBuf = new Uint8Array(PORTRAIT_SIZE * PORTRAIT_SIZE * 4);
    const imgData = outCtx.createImageData(PORTRAIT_SIZE, PORTRAIT_SIZE);

    const studioScene = new THREE.Scene();
    if (envTexture) {
      studioScene.environment = envTexture;
      studioScene.environmentIntensity = 1.05;
    }

    const studioCam = new THREE.PerspectiveCamera(31, 1, 0.1, 12);
    const hemi = new THREE.HemisphereLight(0x94a3b8, 0x1e293b, 1.35);
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.3);
    keyLight.position.set(1.6, 2.3, 2.5);
    const fillLight = new THREE.DirectionalLight(0xcbd5e1, 1.25);
    fillLight.position.set(-1.5, 1.4, 2.2);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 4.0);
    rimLight.position.set(-2.0, 2.3, -1.6);
    const bounceLight = new THREE.PointLight(0xd97706, 1.85, 6, 1.4);
    bounceLight.position.set(0.6, 1.15, 1.65);

    studioScene.add(hemi, keyLight, fillLight, rimLight, bounceLight);

    for (const spec of specs) {
      const rig = spec.build(pack);
      rig.rotation.y = spec.modelYaw;
      studioScene.add(rig);

      hemi.color.setHex(spec.fillTop);
      hemi.groundColor.setHex(spec.fillBot);
      keyLight.color.setHex(spec.keyColor);
      keyLight.intensity = spec.keyIntensity;
      rimLight.color.setHex(spec.rimColor);
      rimLight.intensity = spec.rimIntensity;
      bounceLight.color.setHex(spec.rimColor);

      studioCam.position.set(spec.camPos[0], spec.camPos[1], spec.camPos[2]);
      studioCam.lookAt(spec.lookAt[0], spec.lookAt[1], spec.lookAt[2]);
      studioCam.updateMatrixWorld(true);

      renderer.autoClear = true;
      renderer.setRenderTarget(rt);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, true, false);
      renderer.render(studioScene, studioCam);
      renderer.readRenderTargetPixels(rt, 0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE, pixelBuf);

      // Composite dramatic tactical backdrop + flipped WebGL portrait render + subtle rim vignette
      const grad = outCtx.createLinearGradient(0, 0, 0, PORTRAIT_SIZE);
      grad.addColorStop(0, spec.bgTop);
      grad.addColorStop(1, spec.bgBot);
      outCtx.fillStyle = grad;
      outCtx.fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);

      // Subtle colored studio rim aura behind bust
      const rimRgb = new THREE.Color(spec.rimColor);
      const aura = outCtx.createRadialGradient(
        PORTRAIT_SIZE * 0.5,
        PORTRAIT_SIZE * 0.42,
        18,
        PORTRAIT_SIZE * 0.5,
        PORTRAIT_SIZE * 0.42,
        PORTRAIT_SIZE * 0.55
      );
      aura.addColorStop(
        0,
        `rgba(${Math.round(rimRgb.r * 255)}, ${Math.round(rimRgb.g * 255)}, ${Math.round(rimRgb.b * 255)}, 0.30)`
      );
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      outCtx.fillStyle = aura;
      outCtx.fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);

      // Flip Y from WebGL bottom-up pixels into a temp canvas and composite alpha over backdrop
      const fgCanvas = document.createElement('canvas');
      fgCanvas.width = PORTRAIT_SIZE;
      fgCanvas.height = PORTRAIT_SIZE;
      const fgCtx = fgCanvas.getContext('2d');
      if (fgCtx) {
        const dst = imgData.data;
        for (let y = 0; y < PORTRAIT_SIZE; y++) {
          const srcRow = (PORTRAIT_SIZE - 1 - y) * PORTRAIT_SIZE * 4;
          const dstRow = y * PORTRAIT_SIZE * 4;
          for (let x = 0; x < PORTRAIT_SIZE * 4; x++) {
            dst[dstRow + x] = pixelBuf[srcRow + x];
          }
        }
        fgCtx.putImageData(imgData, 0, 0);
        outCtx.drawImage(fgCanvas, 0, 0);
      }

      // Subtle tactical vignette framing the bust
      const vig = outCtx.createRadialGradient(
        PORTRAIT_SIZE * 0.5,
        PORTRAIT_SIZE * 0.45,
        PORTRAIT_SIZE * 0.28,
        PORTRAIT_SIZE * 0.5,
        PORTRAIT_SIZE * 0.5,
        PORTRAIT_SIZE * 0.68
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.58)');
      outCtx.fillStyle = vig;
      outCtx.fillRect(0, 0, PORTRAIT_SIZE, PORTRAIT_SIZE);

      result[spec.id] = outCanvas.toDataURL('image/png');
      studioScene.remove(rig);
    }
  } catch {
    // Graceful fallback if headless WebGL readPixels fails
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.autoClear = prevAutoClear;
    rt?.dispose();
  }

  return result;
}

/**
 * Renders 256x256 offscreen 3-point-lit bust portraits directly from the actual
 * micro-voxel 3D character models using the existing WebGLRenderer (0 extra GPU contexts,
 * cached once at startup, 0 FPS cost during gameplay).
 */
export function renderAllCharacterPortraits(
  renderer: THREE.WebGLRenderer,
  pack: MaterialPack,
  envTexture?: THREE.Texture | null,
  diddySkinId: DiddySkinId = 'classic_s09'
): Record<CharacterPortraitId, string> {
  const rendered = renderPortraitSpecsBatch(
    renderer,
    pack,
    getPortraitSpecs(diddySkinId),
    envTexture
  );
  return {
    survivor: rendered.survivor ?? '',
    marcos: rendered.marcos ?? '',
    diddy: rendered.diddy ?? '',
    scientist: rendered.scientist ?? '',
    director: rendered.director ?? '',
  };
}

/**
 * Instant offscreen re-render for P. Drizzy's portrait when the player equips
 * a different skin in the 3D Store.
 */
export function renderDiddyPortrait(
  renderer: THREE.WebGLRenderer,
  pack: MaterialPack,
  diddySkinId: DiddySkinId,
  envTexture?: THREE.Texture | null
): string {
  const rendered = renderPortraitSpecsBatch(
    renderer,
    pack,
    [createDiddyPortraitSpec(diddySkinId)],
    envTexture
  );
  return rendered.diddy ?? '';
}
