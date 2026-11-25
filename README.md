Você está assumindo o desenvolvimento de **DrizzyCraft: Setor 09**, um jogo de terror de sobrevivência 3D (Three.js + React + TypeScript + Web Audio) focado em rodar a **60 FPS estáveis no mobile** (e suporte completo a PC/Gamepad).

### Estado Atual do Projeto (Fase 1 100% Concluída)
- **Visual & Arquitetura (`models.ts`, `mansionMap.ts`, `textures.ts`):** Modelos micro-voxel de alta densidade (`VoxelSculptor` + Vertex AO), iluminação PBR real (`PMREMGenerator` + `metalnessMap`), texturas 32×32 (`NearestFilter`), mapa com *trim-kit* arquitetônico em camadas, vidros sujos/trincados otimizados (`MeshStandardMaterial`), céu noturno e água viva com shader `onBeforeCompile` e poças dinâmicas.
- **Engine, Áudio & Cutscenes (`HorrorEngine.ts`, `audio.ts`):** Física *spring-damper* em 1ª pessoa, áudio 100% procedural/orgânico (zero 8-bit) com oclusão sonora (`BiquadFilterNode`) através de paredes, cutscenes com `CatmullRomCurve3` e retratos 3D iluminados renderizados offscreen em cache.
- **UI & Qualidade (`App.tsx`, `GameHud.tsx`, `SettingsModal.tsx`):** Design system tático VHS/industrial, biblioteca própria de ícones SVG customizados, minimapa vetorial, configurações 100% funcionais e suíte de testes automatizados (`modelAudit.test.ts`, `worldAudit.test.ts`, `playthrough.test.ts`).

### Regras Inegociáveis do Projeto
1. **Performance Mobile (60 FPS):** Use `InstancedMesh`, pools de objetos e `dispose()` completo em qualquer canvas/renderer auxiliar. Evite materiais pesados como `transmission` do `MeshPhysicalMaterial`.
2. **Zero Regressão:** Não simplifique nenhum modelo micro-voxel, shader, áudio ou UI já prontos da Fase 1.
3. **Acabamento Comercial:** Proibido usar emojis crus na interface (use apenas os ícones SVG customizados) e proibido criar botões, perks ou controles decorativos/mockados.
4. **Validação:** Toda entrega deve passar limpa em `npx tsc --noEmit`, `npm run build` e `npm test`.

Confirme que analisou a estrutura do repositório e está pronto para receber o prompt da **Fase 2** (4 Finais Cinematográficos, Rank S–C, Save v4, Loja 3D, Perks e Conquistas).
