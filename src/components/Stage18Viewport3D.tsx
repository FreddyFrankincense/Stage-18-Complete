import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BuildingParametricOverride,
  CAMERA_OPTICAL_PRESETS,
  CameraOpticalPreset,
  CuratedReferenceFrame,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  INITIAL_JEFFRIES_3D_ASSETS,
  INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS,
  Jeffries3DAssetSpec,
  JeffriesPbrMaterialSpec,
  LIGHTING_SCENARIOS,
  LightingScenarioPreset,
  STAGE18_APARTMENTS,
  Stage18ApartmentUnit
} from '../data/stage18Data';
import JeffriesPbrMaterialLab, {
  getPbrMaterialSignature,
  synthesizeJeffriesPbrMapsToCanvases
} from './JeffriesPbrMaterialLab';
import JeffriesPbrMaterialSwatchGallery from './JeffriesPbrMaterialSwatchGallery';
import ZonePbrMaterialInspectorPanel, {
  ViewportGeometryShadingMode
} from './ZonePbrMaterialInspectorPanel';
import ConceptualRenderGeneratorModal from './ConceptualRenderGeneratorModal';
import JeffriesAssetLibraryModal from './JeffriesAssetLibraryModal';
import {
  Activity,
  Camera,
  ChevronDown,
  ChevronUp,
  Columns,
  Compass,
  Crosshair,
  Layers,
  Package,
  Sparkles,
  Sun,
  Video,
  Wand2,
  X,
  Zap
} from 'lucide-react';

interface Stage18Viewport3DProps {
  selectedApartment: Stage18ApartmentUnit;
  onSelectApartment: (apt: Stage18ApartmentUnit) => void;
  activeCameraPreset: CameraOpticalPreset;
  onSelectCameraPreset: (preset: CameraOpticalPreset) => void;
  activeLighting: LightingScenarioPreset;
  onSelectLighting: (lighting: LightingScenarioPreset) => void;
  curatedFrames: CuratedReferenceFrame[];
  onNavigateToTab: (
    tab: 'workbench' | 'sourcelab' | 'frames' | 'plan' | 'scripts' | 'barriers'
  ) => void;
  liveProjectedTextureUrl?: string | null;
  onClearLiveProjection?: () => void;
  parametricOverrides?: Record<string, BuildingParametricOverride>;
  showConfidenceHeatmap?: boolean;
  onToggleConfidenceHeatmap?: () => void;
  jeffriesPbrMaterials?: JeffriesPbrMaterialSpec[];
  onUpdateJeffriesPbrMaterials?: (updated: JeffriesPbrMaterialSpec[]) => void;
  onOpenBlenderPbrScript?: () => void;
  onOpenBlenderAssetLibraryScript?: () => void;
  onPinConceptFrame?: (newFrame: CuratedReferenceFrame, dataUrl: string) => void;
  onApplyLiveProjection?: (dataUrl: string) => void;
}

// Reusable module-scope math objects to ensure zero GC inside the render loop
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();

function createProceduralBrickTexture(
  renderer: THREE.WebGLRenderer,
  baseHex: string,
  mortarHex: string,
  darkHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = mortarHex;
  ctx.fillRect(0, 0, 512, 512);

  const rows = 16;
  const cols = 8;
  const rowH = 512 / rows;
  const colW = 512 / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      ctx.fillStyle = (r * 7 + c * 13) % 3 === 0 ? darkHex : baseHex;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
      // Weathering speck
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      if ((r + c) % 2 === 0) {
        ctx.fillRect(x + 6, y + 5, colW * 0.4, rowH * 0.35);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function createProceduralWindowInteriorTexture(
  renderer: THREE.WebGLRenderer,
  wallHex: string,
  warmGlowHex: string,
  hasBlinds: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(128, 110, 15, 128, 128, 150);
  grad.addColorStop(0, warmGlowHex);
  grad.addColorStop(0.65, wallHex);
  grad.addColorStop(1, '#0f1319');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle interior picture frame & lamp silhouette
  ctx.fillStyle = 'rgba(20, 16, 12, 0.45)';
  ctx.fillRect(42, 64, 48, 36);
  ctx.fillRect(160, 120, 32, 85);

  if (hasBlinds) {
    ctx.fillStyle = 'rgba(30, 25, 20, 0.65)';
    for (let y = 0; y < 96; y += 10) {
      ctx.fillRect(0, y, 256, 6);
    }
  }

  // Double-hung sash crossbars
  ctx.strokeStyle = '#d6d3d1';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 248);
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export default function Stage18Viewport3D({
  selectedApartment,
  onSelectApartment,
  activeCameraPreset,
  onSelectCameraPreset,
  activeLighting,
  onSelectLighting,
  curatedFrames,
  onNavigateToTab,
  liveProjectedTextureUrl,
  onClearLiveProjection,
  parametricOverrides = INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  showConfidenceHeatmap = false,
  onToggleConfidenceHeatmap,
  jeffriesPbrMaterials = INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS,
  onUpdateJeffriesPbrMaterials,
  onOpenBlenderPbrScript,
  onOpenBlenderAssetLibraryScript,
  onPinConceptFrame,
  onApplyLiveProjection
}: Stage18Viewport3DProps) {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showSplitMaterialInspector, setShowSplitMaterialInspector] = useState(true);
  const [geometryShadingMode, setGeometryShadingMode] =
    useState<ViewportGeometryShadingMode>('pbr_textured');
  const [showInspector, setShowInspector] = useState(false);
  const [showPbrLabModal, setShowPbrLabModal] = useState(false);
  const [showAssetLibraryModal, setShowAssetLibraryModal] = useState(false);
  const [activeAssetId, setActiveAssetId] = useState<string>(INITIAL_JEFFRIES_3D_ASSETS[0].id);
  const [showConceptRenderModal, setShowConceptRenderModal] = useState(false);
  const [activePbrMaterialId, setActivePbrMaterialId] = useState<string>(
    jeffriesPbrMaterials[0]?.id || 'jeff_quarter_sawn_oak_floor'
  );
  const [showWireframeGrid, setShowWireframeGrid] = useState(false);
  const [showPovSightlineFrustum, setShowPovSightlineFrustum] = useState(true);
  const [flashPulseActive, setFlashPulseActive] = useState(false);
  const [hoveredAptName, setHoveredAptName] = useState<string | null>(null);
  const lastHoveredRef = useRef<string | null>(null);

  // Mutable refs for the WebGL loop so React state updates never recreate the scene
  const requestRenderRef = useRef<() => void>(() => {});
  const captureViewportPngRef = useRef<() => string | null>(() => null);
  const applyProjectedTextureRef = useRef<(url: string | null) => void>(() => {});
  const applyJeffriesPbrMaterialsRef = useRef<(specs: JeffriesPbrMaterialSpec[]) => void>(() => {});
  const cameraTargetPosRef = useRef(new THREE.Vector3(...activeCameraPreset.position));
  const cameraLookAtRef = useRef(new THREE.Vector3(...activeCameraPreset.target));
  const currentLookAtRef = useRef(new THREE.Vector3(...activeCameraPreset.target));
  const targetFovRef = useRef<number>(activeCameraPreset.fovDegrees);
  const isTransitioningCameraRef = useRef<boolean>(false);
  const flashIntensityRef = useRef<number>(0);
  const wireframeRef = useRef<boolean>(false);
  const povFrustumRef = useRef<boolean>(true);
  const geometryShadingModeRef = useRef<ViewportGeometryShadingMode>(geometryShadingMode);
  const heatmapModeRef = useRef<boolean>(showConfidenceHeatmap);
  const parametricOverridesRef =
    useRef<Record<string, BuildingParametricOverride>>(parametricOverrides);
  const activeLightingRef = useRef<LightingScenarioPreset>(activeLighting);
  const selectedAptIdRef = useRef<string>(selectedApartment.id);
  const onSelectApartmentRef = useRef(onSelectApartment);
  onSelectApartmentRef.current = onSelectApartment;

  // Sync 3D geometry shading comparison mode ('pbr_textured' | 'clay_geometry' | 'wireframe_overlay')
  useEffect(() => {
    geometryShadingModeRef.current = geometryShadingMode;
    requestRenderRef.current();
  }, [geometryShadingMode]);

  // Sync live projected texture URL changes
  useEffect(() => {
    applyProjectedTextureRef.current(liveProjectedTextureUrl || null);
  }, [liveProjectedTextureUrl]);

  // Sync L.B. Jefferies's 8 Film-Still PBR Materials into live 3D apartment meshes
  useEffect(() => {
    applyJeffriesPbrMaterialsRef.current(jeffriesPbrMaterials);
  }, [jeffriesPbrMaterials]);

  // Sync parametric overrides & confidence heatmap changes into WebGL loop
  useEffect(() => {
    parametricOverridesRef.current = parametricOverrides;
    requestRenderRef.current();
  }, [parametricOverrides]);

  useEffect(() => {
    heatmapModeRef.current = showConfidenceHeatmap;
    requestRenderRef.current();
  }, [showConfidenceHeatmap]);

  // Sync camera preset changes
  useEffect(() => {
    cameraTargetPosRef.current.set(...activeCameraPreset.position);
    cameraLookAtRef.current.set(...activeCameraPreset.target);
    targetFovRef.current = activeCameraPreset.fovDegrees;
    isTransitioningCameraRef.current = true;
    requestRenderRef.current();
  }, [activeCameraPreset]);

  // Sync selected apartment lookAt when in POV camera modes
  useEffect(() => {
    selectedAptIdRef.current = selectedApartment.id;
    if (activeCameraPreset.id !== 'cam-stage18-orbit' && selectedApartment.id !== 'apt-jeffries') {
      cameraLookAtRef.current.set(...selectedApartment.cameraLookAt);
      isTransitioningCameraRef.current = true;
    }
    requestRenderRef.current();
  }, [selectedApartment, activeCameraPreset.id]);

  // Sync lighting preset changes
  useEffect(() => {
    activeLightingRef.current = activeLighting;
    requestRenderRef.current();
  }, [activeLighting]);

  // Sync wireframe & POV frustum toggles
  useEffect(() => {
    wireframeRef.current = showWireframeGrid;
    requestRenderRef.current();
  }, [showWireframeGrid]);

  useEffect(() => {
    povFrustumRef.current = showPovSightlineFrustum;
    requestRenderRef.current();
  }, [showPovSightlineFrustum]);

  // Keyboard shortcut 'H' for collapsing/expanding the bottom HUD dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'h' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const triggerFlashbulb = () => {
    flashIntensityRef.current = 65.0;
    setFlashPulseActive(true);
    requestRenderRef.current();
    window.setTimeout(() => setFlashPulseActive(false), 900);
  };

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL Guard & Renderer Initialization
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = activeLightingRef.current.cyclesExposure;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(activeLightingRef.current.fogColorHex);
    scene.fog = new THREE.FogExp2(activeLightingRef.current.fogColorHex, 0.0065);

    // 2. Studio PMREM Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(
      activeCameraPreset.fovDegrees,
      container.clientWidth / container.clientHeight,
      0.2,
      300
    );
    camera.position.set(...activeCameraPreset.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...activeCameraPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 120;
    controls.minDistance = 1.5;

    // 4. Procedural Textures & Materials
    const redBrickTex = createProceduralBrickTexture(renderer, '#8B3A2B', '#6B655E', '#6E2B1E');
    const buffBrickTex = createProceduralBrickTexture(renderer, '#A6835A', '#78716C', '#8C6B45');
    const eastStuccoTex = createProceduralBrickTexture(renderer, '#78716C', '#57534E', '#655E57');
    const thorwaldWinTex = createProceduralWindowInteriorTexture(renderer, '#92400E', '#FDE68A', false);
    const torsoWinTex = createProceduralWindowInteriorTexture(renderer, '#9D174D', '#FBCFE8', false);
    const composerWinTex = createProceduralWindowInteriorTexture(renderer, '#1E3A8A', '#93C5FD', true);
    const lonelyWinTex = createProceduralWindowInteriorTexture(renderer, '#065F46', '#A7F3D0', true);

    const redBrickMat = new THREE.MeshStandardMaterial({
      map: redBrickTex,
      roughness: 0.85,
      metalness: 0.05
    });
    const buffBrickMat = new THREE.MeshStandardMaterial({
      map: buffBrickTex,
      roughness: 0.8,
      metalness: 0.05
    });
    const stuccoMat = new THREE.MeshStandardMaterial({
      map: eastStuccoTex,
      roughness: 0.78,
      metalness: 0.04
    });

    let currentProjectedTex: THREE.Texture | null = null;

    applyProjectedTextureRef.current = (url: string | null) => {
      if (currentProjectedTex) {
        currentProjectedTex.dispose();
        currentProjectedTex = null;
      }
      if (!url) {
        redBrickMat.map = redBrickTex;
        buffBrickMat.map = buffBrickTex;
        redBrickMat.needsUpdate = true;
        buffBrickMat.needsUpdate = true;
        requestRenderRef.current();
        return;
      }
      const loader = new THREE.TextureLoader();
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        currentProjectedTex = tex;
        redBrickMat.map = tex;
        buffBrickMat.map = tex;
        redBrickMat.needsUpdate = true;
        buffBrickMat.needsUpdate = true;
        requestRenderRef.current();
      });
    };

    if (liveProjectedTextureUrl) {
      applyProjectedTextureRef.current(liveProjectedTextureUrl);
    }
    const limestoneMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.65,
      metalness: 0.08
    });
    const darkIronMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.38,
      metalness: 0.82
    });
    const jeffWallMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8c3b4,
      roughness: 0.78,
      metalness: 0.0,
      ior: 1.45
    });

    const jeffTrimMat = new THREE.MeshPhysicalMaterial({
      color: 0xdcd6c6,
      roughness: 0.34,
      metalness: 0.0,
      ior: 1.49,
      clearcoat: 0.3,
      clearcoatRoughness: 0.24
    });
    const woodFloorMat = new THREE.MeshPhysicalMaterial({
      color: 0x6e472b,
      roughness: 0.38,
      metalness: 0.0,
      ior: 1.52,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18
    });
    const jeffBlindsMat = new THREE.MeshPhysicalMaterial({
      color: 0xb88e5a,
      roughness: 0.64,
      metalness: 0.0,
      ior: 1.47,
      sheen: 0.28,
      sheenRoughness: 0.48
    });
    const jeffUpholsteryMat = new THREE.MeshPhysicalMaterial({
      color: 0x8a6f5a,
      roughness: 0.84,
      metalness: 0.0,
      ior: 1.44,
      sheen: 0.88,
      sheenRoughness: 0.42
    });
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xd8dce2,
      metalness: 0.92,
      roughness: 0.22,
      ior: 2.48,
      clearcoat: 0.15
    });
    const blackMetalMat = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      metalness: 0.75,
      roughness: 0.38
    });
    const jeffPlasterCastMat = new THREE.MeshPhysicalMaterial({
      color: 0xeae6dc,
      roughness: 0.88,
      metalness: 0.0,
      ior: 1.46,
      sheen: 0.35,
      sheenRoughness: 0.6
    });
    const opticalGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xebf4f2,
      transparent: true,
      opacity: isSoftwareGl ? 0.24 : 0.38,
      roughness: 0.06,
      metalness: 0.0,
      ior: 1.517,
      clearcoat: 0.2,
      depthWrite: false
    });

    const slotTextureCache = new Map<string, { sig: string; textures: THREE.Texture[] }>();
    const slotToMaterialMap: Record<string, THREE.MeshPhysicalMaterial> = {
      floor: woodFloorMat,
      mullions: jeffTrimMat,
      walls: jeffWallMat,
      glass: opticalGlassMat,
      blinds: jeffBlindsMat,
      upholstery: jeffUpholsteryMat,
      chrome_camera: chromeMat,
      plaster_cast: jeffPlasterCastMat
    };

    applyJeffriesPbrMaterialsRef.current = (specs: JeffriesPbrMaterialSpec[]) => {
      const texRes = isSoftwareGl ? 64 : 128;
      const maxAniso = renderer.capabilities.getMaxAnisotropy();

      specs.forEach((spec) => {
        const targetMat = slotToMaterialMap[spec.targetThreeSlot];
        if (!targetMat) return;
        const sig = getPbrMaterialSignature(spec, texRes);
        const existingSlot = slotTextureCache.get(spec.targetThreeSlot);
        if (existingSlot && existingSlot.sig === sig) {
          // Material signature unchanged — skip redundant CanvasTexture creation & GPU upload
          return;
        }

        if (existingSlot) {
          existingSlot.textures.forEach((t) => t.dispose());
        }

        const sp = spec.surfaceProperties;
        const canvases = synthesizeJeffriesPbrMapsToCanvases(spec, texRes);
        const albedoTex = new THREE.CanvasTexture(canvases.albedoCanvas);
        albedoTex.colorSpace = THREE.SRGBColorSpace;
        albedoTex.wrapS = THREE.RepeatWrapping;
        albedoTex.wrapT = THREE.RepeatWrapping;
        albedoTex.repeat.set(Math.max(1, sp.uvScale * 0.5), Math.max(1, sp.uvScale * 0.5));
        albedoTex.anisotropy = maxAniso;

        const roughTex = new THREE.CanvasTexture(canvases.roughnessCanvas);
        roughTex.colorSpace = THREE.NoColorSpace;
        roughTex.wrapS = THREE.RepeatWrapping;
        roughTex.wrapT = THREE.RepeatWrapping;
        roughTex.repeat.copy(albedoTex.repeat);

        const normalTex = new THREE.CanvasTexture(canvases.normalCanvas);
        normalTex.colorSpace = THREE.NoColorSpace;
        normalTex.wrapS = THREE.RepeatWrapping;
        normalTex.wrapT = THREE.RepeatWrapping;
        normalTex.repeat.copy(albedoTex.repeat);

        slotTextureCache.set(spec.targetThreeSlot, {
          sig,
          textures: [albedoTex, roughTex, normalTex]
        });

        targetMat.color.set(sp.baseColorHex);
        if (spec.targetThreeSlot !== 'glass') {
          targetMat.map = albedoTex;
          targetMat.roughnessMap = roughTex;
          targetMat.normalMap = normalTex;
          targetMat.normalScale.set(
            sp.normalStrength * (sp.bumpHeightMm * 0.45),
            sp.normalStrength * (sp.bumpHeightMm * 0.45)
          );
        } else {
          targetMat.opacity = isSoftwareGl
            ? 0.24
            : THREE.MathUtils.clamp(1.0 - sp.transmissionWeight * 0.62, 0.18, 0.75);
        }

        targetMat.roughness = sp.roughness;
        targetMat.metalness = sp.metalness;
        targetMat.ior = sp.ior;
        targetMat.clearcoat = sp.clearcoatWeight;
        targetMat.clearcoatRoughness = sp.clearcoatRoughness;
        targetMat.sheen = sp.sheenWeight;
        targetMat.sheenRoughness = sp.sheenRoughness;
        if (sp.sheenWeight > 0.05) {
          targetMat.sheenColor = new THREE.Color(sp.accentColorHex);
        }
        targetMat.needsUpdate = true;
      });
      requestRenderRef.current();
    };

    applyJeffriesPbrMaterialsRef.current(jeffriesPbrMaterials);

    // Emissive Window Materials (updated dynamically by lighting scenario)
    const windowMaterials: THREE.MeshStandardMaterial[] = [];
    const makeWindowMat = (tex: THREE.CanvasTexture, emissiveHex: number) => {
      const m = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(emissiveHex),
        emissiveMap: tex,
        emissiveIntensity: 0.9,
        roughness: 0.25,
        metalness: 0.1
      });
      windowMaterials.push(m);
      return m;
    };

    const thorwaldWinMat = makeWindowMat(thorwaldWinTex, 0xf59e0b);
    const torsoWinMat = makeWindowMat(torsoWinTex, 0xfbbf24);
    const composerWinMat = makeWindowMat(composerWinTex, 0x60a5fa);
    const lonelyWinMat = makeWindowMat(lonelyWinTex, 0x34d399);

    // Track clickable apartment proxy meshes on Layer 1
    const interactiveZoneMeshes: THREE.Object3D[] = [];
    const highlightBoxes = new Map<string, THREE.LineSegments>();

    const registerApartmentZone = (
      apt: Stage18ApartmentUnit,
      group: THREE.Group,
      boundsSize: [number, number, number],
      boundsCenter: [number, number, number]
    ) => {
      const proxyGeo = new THREE.BoxGeometry(...boundsSize);
      const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
      const proxy = new THREE.Mesh(proxyGeo, proxyMat);
      proxy.position.set(...boundsCenter);
      proxy.userData = { apartment: apt };
      proxy.layers.enable(1);
      group.add(proxy);
      interactiveZoneMeshes.push(proxy);

      const edgesGeo = new THREE.EdgesGeometry(proxyGeo);
      const edgesMat = new THREE.LineBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: apt.id === selectedAptIdRef.current ? 0.9 : 0.0
      });
      const outline = new THREE.LineSegments(edgesGeo, edgesMat);
      outline.position.set(...boundsCenter);
      group.add(outline);
      highlightBoxes.set(apt.id, outline);
    };

    // Helper: Composite Sash Window Assembly (5 parts: stone lintel, stone sill, outer wood frame, recessed glass pane, upper sash bar)
    const createSashWindowGroup = (w: number, h: number, winMat: THREE.Material, openRatio = 0.25) => {
      const wg = new THREE.Group();
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.45, 0.4), limestoneMat);
      lintel.position.set(0, h / 2 + 0.2, 0.15);
      wg.add(lintel);

      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.3, 0.55), limestoneMat);
      sill.position.set(0, -h / 2 - 0.15, 0.2);
      wg.add(sill);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), jeffTrimMat);
      wg.add(frame);

      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.35, h - 0.35), winMat);
      pane.position.set(0, 0, 0.14);
      wg.add(pane);

      const sashRail = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.16, 0.32), jeffTrimMat);
      sashRail.position.set(0, (openRatio - 0.25) * h * 0.5, 0.16);
      wg.add(sashRail);

      return wg;
    };

    // =========================================================================
    // ZONE A: EXCAVATED COURTYARD BASEMENT & SCULPTOR'S GARDEN (Y = -4 to 0)
    // =========================================================================
    const courtyardGroup = new THREE.Group();
    scene.add(courtyardGroup);

    const floorSlab = new THREE.Mesh(
      new THREE.BoxGeometry(64, 1.0, 62),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 })
    );
    floorSlab.position.set(0, -4.5, -4);
    floorSlab.receiveShadow = true;
    courtyardGroup.add(floorSlab);

    // Excavated lower patio basin
    const gardenBasin = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.4, 26),
      new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.85 })
    );
    gardenBasin.position.set(2, -3.95, -15);
    gardenBasin.receiveShadow = true;
    courtyardGroup.add(gardenBasin);

    // Thorwald's Zinnia Flowerbed along North Wall
    const flowerbedGroup = new THREE.Group();
    const bedCurb = new THREE.Mesh(new THREE.BoxGeometry(16, 0.9, 3.6), limestoneMat);
    bedCurb.position.set(-8, -3.5, -21.5);
    flowerbedGroup.add(bedCurb);
    const soilMesh = new THREE.Mesh(
      new THREE.BoxGeometry(15.2, 0.95, 3.0),
      new THREE.MeshStandardMaterial({ color: 0x422006, roughness: 0.95 })
    );
    soilMesh.position.set(-8, -3.4, -21.5);
    flowerbedGroup.add(soilMesh);

    // Sculptor's Modernist Biomorphic Sculpture ("Hunger") — Multi-part composite model
    const sculptureGroup = new THREE.Group();
    sculptureGroup.position.set(11, -3.8, -16);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.4, 16), woodFloorMat);
    plinth.position.y = 0.7;
    sculptureGroup.add(plinth);
    const torsoSculpt = new THREE.Mesh(new THREE.TorusKnotGeometry(0.95, 0.28, 48, 12, 2, 3), limestoneMat);
    torsoSculpt.position.y = 2.4;
    sculptureGroup.add(torsoSculpt);
    flowerbedGroup.add(sculptureGroup);
    courtyardGroup.add(flowerbedGroup);

    const sculptorApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-sculptor')!;
    registerApartmentZone(sculptorApt, courtyardGroup, [22, 6, 14], [9, -1.5, -16]);

    // =========================================================================
    // ZONE B: NORTH WING — LARS THORWALD'S 4-ROOM RAILROAD TENEMENT
    // =========================================================================
    const thorwaldGroup = new THREE.Group();
    scene.add(thorwaldGroup);

    const northFacade = new THREE.Mesh(new THREE.BoxGeometry(36, 38, 12), redBrickMat);
    northFacade.position.set(-10, 15, -29);
    northFacade.castShadow = true;
    northFacade.receiveShadow = true;
    thorwaldGroup.add(northFacade);

    // Stepped Roof Cornice & Limestone Belt Courses
    const northCornice = new THREE.Mesh(new THREE.BoxGeometry(37.2, 1.4, 13.4), limestoneMat);
    northCornice.position.set(-10, 34.2, -29);
    thorwaldGroup.add(northCornice);

    // 4 Floors × 4 Railroad Windows across North Tenement
    const floorHeights = [2.5, 13.0, 22.5, 30.5];
    const windowXCoords = [-22, -14.5, -7.0, 0.5];
    floorHeights.forEach((fy, fIdx) => {
      windowXCoords.forEach((wx, wIdx) => {
        const isThorwaldUnit = fIdx === 1; // 2nd floor
        const winMesh = createSashWindowGroup(
          3.4,
          6.2,
          isThorwaldUnit ? thorwaldWinMat : lonelyWinMat,
          isThorwaldUnit && wIdx === 2 ? 0.65 : 0.15
        );
        winMesh.position.set(wx, fy, -22.9);
        thorwaldGroup.add(winMesh);
      });
    });

    // Cast-Iron Fire Escape Assembly on Thorwald Facade
    for (let f = 0; f < 3; f++) {
      const fy = floorHeights[f + 1] - 3.1;
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.22, 3.2), darkIronMat);
      balcony.position.set(-10.5, fy, -21.4);
      thorwaldGroup.add(balcony);

      const railFront = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.6, 0.12), darkIronMat);
      railFront.position.set(-10.5, fy + 1.3, -19.9);
      thorwaldGroup.add(railFront);

      if (f < 2) {
        const stairLadder = new THREE.Mesh(new THREE.BoxGeometry(1.4, 10.5, 0.2), darkIronMat);
        stairLadder.position.set(-10.5, fy + 4.8, -20.6);
        stairLadder.rotation.z = 0.48;
        thorwaldGroup.add(stairLadder);
      }
    }

    // Rooftop Cedar Water Tower (Composite 4-part structure)
    const waterTowerGroup = new THREE.Group();
    waterTowerGroup.position.set(-19, 34.8, -28);
    const towerLegs = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 5.0, 8, 1, true), darkIronMat);
    towerLegs.position.y = 2.5;
    waterTowerGroup.add(towerLegs);
    const tankDrum = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 6.2, 20), woodFloorMat);
    tankDrum.position.y = 7.8;
    waterTowerGroup.add(tankDrum);
    const tankRoof = new THREE.Mesh(new THREE.ConeGeometry(3.1, 2.2, 20), darkIronMat);
    tankRoof.position.y = 11.9;
    waterTowerGroup.add(tankRoof);
    thorwaldGroup.add(waterTowerGroup);

    const thorwaldApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-thorwald')!;
    registerApartmentZone(thorwaldApt, thorwaldGroup, [28, 8.5, 5], [-11, 13.0, -22.5]);

    // =========================================================================
    // ZONE C: WEST WING — MISS TORSO (#2D) & MISS LONELYHEARTS (#1C)
    // =========================================================================
    const westWingGroup = new THREE.Group();
    scene.add(westWingGroup);

    const westFacade = new THREE.Mesh(new THREE.BoxGeometry(12, 36, 44), buffBrickMat);
    westFacade.position.set(-29, 14, -4);
    westFacade.castShadow = true;
    westFacade.receiveShadow = true;
    westWingGroup.add(westFacade);

    const westCornice = new THREE.Mesh(new THREE.BoxGeometry(13.2, 1.2, 45), limestoneMat);
    westCornice.position.set(-29, 32.2, -4);
    westWingGroup.add(westCornice);

    // Miss Torso's Wide Ballet Studio Windows + Juliette Balcony
    [-9, -3].forEach((wz) => {
      const torsoWin = createSashWindowGroup(4.6, 6.8, torsoWinMat, 0.5);
      torsoWin.rotation.y = Math.PI / 2;
      torsoWin.position.set(-22.9, 13.5, wz);
      westWingGroup.add(torsoWin);
    });
    const torsoBalcony = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 11.5), darkIronMat);
    torsoBalcony.position.set(-21.8, 10.0, -6);
    westWingGroup.add(torsoBalcony);

    // Miss Lonelyhearts's Lower Ground Windows
    [-16, -11].forEach((wz) => {
      const lonelyWin = createSashWindowGroup(3.4, 5.8, lonelyWinMat, 0.35);
      lonelyWin.rotation.y = Math.PI / 2;
      lonelyWin.position.set(-22.9, 2.5, wz);
      westWingGroup.add(lonelyWin);
    });

    const torsoApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-torso')!;
    registerApartmentZone(torsoApt, westWingGroup, [5, 8.5, 13], [-22.5, 13.5, -6]);

    const lonelyApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-lonelyhearts')!;
    registerApartmentZone(lonelyApt, westWingGroup, [5, 7.5, 11], [-22.5, 2.5, -13.5]);

    // =========================================================================
    // ZONE D: EAST WING — THE SONGWRITER'S PENTHOUSE STUDIO (#3A)
    // =========================================================================
    const eastWingGroup = new THREE.Group();
    scene.add(eastWingGroup);

    const eastFacade = new THREE.Mesh(new THREE.BoxGeometry(12, 38, 44), stuccoMat);
    eastFacade.position.set(28, 15, -4);
    eastFacade.castShadow = true;
    eastFacade.receiveShadow = true;
    eastWingGroup.add(eastFacade);

    // Large Multi-Pane Industrial Studio Casement Window for Composer (#3A)
    const composerStudioWin = createSashWindowGroup(11.0, 8.2, composerWinMat, 0.4);
    composerStudioWin.rotation.y = -Math.PI / 2;
    composerStudioWin.position.set(21.9, 22.5, -8);
    eastWingGroup.add(composerStudioWin);

    // Lower East Wing Windows
    [-14, -4, 6].forEach((ez) => {
      const eWin = createSashWindowGroup(3.4, 6.0, thorwaldWinMat, 0.2);
      eWin.rotation.y = -Math.PI / 2;
      eWin.position.set(21.9, 12.5, ez);
      eastWingGroup.add(eWin);
    });

    const composerApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-composer')!;
    registerApartmentZone(composerApt, eastWingGroup, [5, 9.5, 13], [22, 22.5, -8]);

    // =========================================================================
    // ZONE E: NORTH ALLEYWAY & FORCED-PERSPECTIVE STREET BAR MARQUEE
    // =========================================================================
    const alleyGroup = new THREE.Group();
    scene.add(alleyGroup);

    const streetBackdrop = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 4), buffBrickMat);
    streetBackdrop.position.set(13, 10, -38);
    alleyGroup.add(streetBackdrop);

    // Illuminated Neon Bar Sign & Tavern Window in the Background Street
    const neonMarquee = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.4, 0.5),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 2.4
      })
    );
    neonMarquee.position.set(12.5, 8.5, -35.6);
    alleyGroup.add(neonMarquee);

    const alleyApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-alley-street')!;
    registerApartmentZone(alleyApt, alleyGroup, [12, 16, 6], [12.5, 8.0, -35.5]);

    // =========================================================================
    // ZONE F: FOREGROUND HERO INTERIOR — L.B. JEFFERIES'S APARTMENT (#2B)
    // =========================================================================
    const jeffInteriorGroup = new THREE.Group();
    scene.add(jeffInteriorGroup);

    // Floor, Ceiling, and Side Walls
    const jeffFloor = new THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>(
      new THREE.BoxGeometry(24, 0.6, 16),
      woodFloorMat
    );
    jeffFloor.position.set(0, 10.8, 22);
    jeffFloor.receiveShadow = true;
    jeffInteriorGroup.add(jeffFloor);

    const jeffCeiling = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 16), jeffWallMat);
    jeffCeiling.position.set(0, 21.2, 22);
    jeffInteriorGroup.add(jeffCeiling);

    const jeffLeftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10.4, 16), jeffWallMat);
    jeffLeftWall.position.set(-11.8, 16.0, 22);
    jeffInteriorGroup.add(jeffLeftWall);

    const jeffRightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10.4, 16), jeffWallMat);
    jeffRightWall.position.set(11.8, 16.0, 22);
    jeffInteriorGroup.add(jeffRightWall);

    // Three-Panel Bay Window Wall facing Courtyard (Z = +14.8)
    const lowerApronWall = new THREE.Mesh(new THREE.BoxGeometry(24, 2.2, 0.8), jeffWallMat);
    lowerApronWall.position.set(0, 11.9, 14.8);
    jeffInteriorGroup.add(lowerApronWall);

    const upperHeaderWall = new THREE.Mesh(new THREE.BoxGeometry(24, 2.0, 0.8), jeffWallMat);
    upperHeaderWall.position.set(0, 20.2, 14.8);
    jeffInteriorGroup.add(upperHeaderWall);

    const leftPillarWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 6.4, 0.8), jeffWallMat);
    leftPillarWall.position.set(-8.8, 16.0, 14.8);
    jeffInteriorGroup.add(leftPillarWall);

    const rightPillarWall = new THREE.Mesh(new THREE.BoxGeometry(6.2, 6.4, 0.8), jeffWallMat);
    rightPillarWall.position.set(8.8, 16.0, 14.8);
    jeffInteriorGroup.add(rightPillarWall);

    // Wide Wooden Window Sill & Vertical Bay Mullions
    const mainSill = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.28, 1.3), jeffTrimMat);
    mainSill.position.set(0, 13.0, 15.0);
    mainSill.receiveShadow = true;
    jeffInteriorGroup.add(mainSill);

    [-5.6, -2.2, 2.2, 5.6].forEach((mx) => {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.4, 0.65), jeffTrimMat);
      mullion.position.set(mx, 16.1, 14.8);
      mullion.castShadow = true;
      jeffInteriorGroup.add(mullion);
    });

    // Raised Center Sash Rail + Translucent Upper Glass Pane
    const raisedMeetingRail = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.2, 0.35), jeffTrimMat);
    raisedMeetingRail.position.set(0, 16.9, 14.8);
    jeffInteriorGroup.add(raisedMeetingRail);

    const upperBayGlass = new THREE.Mesh(new THREE.PlaneGeometry(11.0, 2.2), opticalGlassMat);
    upperBayGlass.position.set(0, 18.1, 14.75);
    upperBayGlass.renderOrder = 10;
    jeffInteriorGroup.add(upperBayGlass);

    // Split-Bamboo Matchstick Roll-Up Window Shades (3 Bays)
    const centerBambooRoll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 4.1, 14),
      jeffBlindsMat
    );
    centerBambooRoll.rotation.z = Math.PI / 2;
    centerBambooRoll.position.set(0, 19.05, 15.05);
    jeffInteriorGroup.add(centerBambooRoll);

    [-3.9, 3.9].forEach((bx) => {
      const flankBlindShade = new THREE.Mesh(
        new THREE.BoxGeometry(3.1, 2.1, 0.08),
        jeffBlindsMat
      );
      flankBlindShade.position.set(bx, 18.15, 15.05);
      jeffInteriorGroup.add(flankBlindShade);
    });

    // Hero Prop 1: Exakta VX 35mm SLR + Kilfitt 152mm/400mm Telephoto Lens on Tripod
    const cameraRigGroup = new THREE.Group();
    cameraRigGroup.position.set(1.25, 11.1, 16.3);

    // 3 Tripod Legs
    [-0.35, 0, 0.35].forEach((angleOffset, idx) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 3.1, 10), woodFloorMat);
      leg.position.set(angleOffset * 0.8, 1.45, idx === 1 ? -0.35 : 0.25);
      leg.rotation.z = -angleOffset * 0.25;
      cameraRigGroup.add(leg);
    });
    const exaktaBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.28), chromeMat);
    exaktaBody.position.set(0, 3.05, 0);
    cameraRigGroup.add(exaktaBody);

    const kilfittBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 1.45, 20), blackMetalMat);
    kilfittBarrel.rotation.x = Math.PI / 2;
    kilfittBarrel.position.set(0, 3.05, -0.82);
    cameraRigGroup.add(kilfittBarrel);

    const lensHoodRing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.22, 20), chromeMat);
    lensHoodRing.rotation.x = Math.PI / 2;
    lensHoodRing.position.set(0, 3.05, -1.55);
    cameraRigGroup.add(lensHoodRing);

    // Graflex Flashgun Dish Mounted Beside Camera
    const flashDish = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), chromeMat);
    flashDish.rotation.x = -Math.PI / 2;
    flashDish.position.set(-0.45, 3.25, -0.35);
    cameraRigGroup.add(flashDish);
    jeffInteriorGroup.add(cameraRigGroup);

    // Hero Prop 1B: Everest & Jennings Convalescent Wheelchair + Full-Leg Plaster Cast + Oriental Daybed
    const wheelchairGroup = new THREE.Group();
    wheelchairGroup.position.set(-0.15, 11.1, 18.1);
    const chairSeat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.32, 2.1),
      jeffUpholsteryMat
    );
    chairSeat.position.set(0, 1.65, 0);
    wheelchairGroup.add(chairSeat);

    const chairBack = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 2.3, 0.26),
      jeffUpholsteryMat
    );
    chairBack.position.set(0, 2.85, 0.95);
    chairBack.rotation.x = 0.12;
    wheelchairGroup.add(chairBack);

    // Left-Leg Calcified Plaster-of-Paris Orthopedic Cast extended toward window
    const plasterCastLeg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.19, 2.65, 16),
      jeffPlasterCastMat
    );
    plasterCastLeg.rotation.x = Math.PI / 2 - 0.18;
    plasterCastLeg.position.set(-0.32, 1.75, -1.45);
    wheelchairGroup.add(plasterCastLeg);

    // 24-Inch Spoked Rear Drive Wheels on Wheelchair
    [-1.08, 1.08].forEach((wx) => {
      const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 12, 24), chromeMat);
      wheelRim.rotation.y = Math.PI / 2;
      wheelRim.position.set(wx, 1.05, 0.35);
      wheelchairGroup.add(wheelRim);
    });
    jeffInteriorGroup.add(wheelchairGroup);

    // Hero Prop 1C: Mid-Century Tufted Studio Couch / Daybed + Bolsters + Walnut Plinth
    const daybedGroup = new THREE.Group();
    daybedGroup.position.set(5.4, 11.1, 20.4);
    const daybedPlinth = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.28, 3.2), woodFloorMat);
    daybedPlinth.position.y = 0.45;
    daybedGroup.add(daybedPlinth);
    const daybedMattress = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.65, 3.0),
      jeffUpholsteryMat
    );
    daybedMattress.position.y = 0.92;
    daybedGroup.add(daybedMattress);
    [-2.8, 2.8].forEach((bx) => {
      const bolster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 2.8, 16),
        jeffUpholsteryMat
      );
      bolster.rotation.x = Math.PI / 2;
      bolster.position.set(bx, 1.42, 0);
      daybedGroup.add(bolster);
    });
    jeffInteriorGroup.add(daybedGroup);

    // Hero Prop 1D: Danish Walnut Coffee Table & Slatted Magazine Rack in front of Daybed
    const coffeeTableGroup = new THREE.Group();
    coffeeTableGroup.position.set(3.2, 11.1, 20.1);
    const coffeeTop = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 3.8), woodFloorMat);
    coffeeTop.position.y = 1.38;
    coffeeTableGroup.add(coffeeTop);
    const coffeeShelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.06, 3.2), jeffBlindsMat);
    coffeeShelf.position.y = 0.78;
    coffeeTableGroup.add(coffeeShelf);
    jeffInteriorGroup.add(coffeeTableGroup);

    // Hero Prop 1E: Tri-Light Brass & Pleated Shantung Floor Lamp beside Couch
    const floorLampGroup = new THREE.Group();
    floorLampGroup.position.set(6.8, 11.1, 17.8);
    const floorLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.14, 20), chromeMat);
    floorLampBase.position.y = 0.07;
    floorLampGroup.add(floorLampBase);
    const floorLampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.6, 14), chromeMat);
    floorLampStem.position.y = 2.35;
    floorLampGroup.add(floorLampStem);
    const floorLampShade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.92, 1.05, 24, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.75,
        side: THREE.DoubleSide
      })
    );
    floorLampShade.position.y = 4.65;
    floorLampGroup.add(floorLampShade);
    jeffInteriorGroup.add(floorLampGroup);

    // Hero Prop 2: Swivel Cantilevered Lap Table, Bausch & Lomb Binoculars & Gooseneck Lamp
    const tableGroup = new THREE.Group();
    tableGroup.position.set(-2.4, 11.1, 17.2);
    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 1.4), woodFloorMat);
    tableTop.position.y = 2.25;
    tableGroup.add(tableTop);
    const binocLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 14), blackMetalMat);
    binocLeft.rotation.x = Math.PI / 2;
    binocLeft.position.set(0.35, 2.42, -0.15);
    tableGroup.add(binocLeft);
    const binocRight = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 14), blackMetalMat);
    binocRight.rotation.x = Math.PI / 2;
    binocRight.position.set(0.58, 2.42, -0.15);
    tableGroup.add(binocRight);
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.7, 16), chromeMat);
    lampBase.position.set(-0.6, 2.55, 0.2);
    tableGroup.add(lampBase);
    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.65, 20, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide
      })
    );
    lampShade.position.set(-0.6, 3.05, 0.2);
    tableGroup.add(lampShade);
    jeffInteriorGroup.add(tableGroup);

    // Hero Prop 3: 1953 Webcor Automatic Record Player & LP Stack on Rear Credenza
    const credenzaGroup = new THREE.Group();
    credenzaGroup.position.set(7.2, 11.1, 23.2);
    const credenzaCabinet = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.3, 1.6), woodFloorMat);
    credenzaCabinet.position.y = 1.15;
    credenzaGroup.add(credenzaCabinet);
    const recordPlayerBox = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.42, 1.2), jeffUpholsteryMat);
    recordPlayerBox.position.set(-0.3, 2.52, 0);
    credenzaGroup.add(recordPlayerBox);
    const vinylPlatter = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.04, 24), blackMetalMat);
    vinylPlatter.position.set(-0.3, 2.75, 0);
    credenzaGroup.add(vinylPlatter);
    jeffInteriorGroup.add(credenzaGroup);

    // Hero Prop 4: Drop-Leaf Gateleg Dining Table & 6-Panel Woven Split-Bamboo Privacy Screen
    const diningGroup = new THREE.Group();
    diningGroup.position.set(-5.8, 11.1, 22.8);
    const diningTop = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.12, 24), woodFloorMat);
    diningTop.position.y = 2.42;
    diningGroup.add(diningTop);
    const diningPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 2.4, 16), woodFloorMat);
    diningPedestal.position.y = 1.2;
    diningGroup.add(diningPedestal);
    jeffInteriorGroup.add(diningGroup);

    const bambooScreenGroup = new THREE.Group();
    bambooScreenGroup.position.set(-8.5, 11.1, 23.8);
    for (let p = 0; p < 5; p++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 5.8, 0.1), jeffBlindsMat);
      panel.position.set((p - 2) * 1.02, 2.9, (p % 2 === 0 ? 1 : -1) * 0.22);
      panel.rotation.y = (p % 2 === 0 ? 1 : -1) * 0.32;
      bambooScreenGroup.add(panel);
    }
    jeffInteriorGroup.add(bambooScreenGroup);

    const jeffApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-jeffries')!;
    registerApartmentZone(jeffApt, jeffInteriorGroup, [12, 7.5, 4.5], [0, 15.5, 16.0]);

    // =========================================================================
    // 5. STUDIO LIGHTING RIG (Key Sun, Sky Hemi, Neighbor Practicals, Flashbulb)
    // =========================================================================
    const sunKeyLight = new THREE.DirectionalLight(0xfdba74, 3.2);
    sunKeyLight.position.set(-22, 36, 14);
    sunKeyLight.castShadow = !isSoftwareGl;
    sunKeyLight.shadow.mapSize.width = 2048;
    sunKeyLight.shadow.mapSize.height = 2048;
    const d = 42;
    sunKeyLight.shadow.camera.left = -d;
    sunKeyLight.shadow.camera.right = d;
    sunKeyLight.shadow.camera.top = d;
    sunKeyLight.shadow.camera.bottom = -d;
    sunKeyLight.shadow.bias = -0.0005;
    sunKeyLight.shadow.normalBias = 0.02;
    scene.add(sunKeyLight);

    const skyHemiLight = new THREE.HemisphereLight(0x93c5fd, 0x451a03, 0.75);
    skyHemiLight.position.set(0, 45, 0);
    scene.add(skyHemiLight);

    const thorwaldPracticalLight = new THREE.PointLight(0xf59e0b, 2.5, 32, 1.6);
    thorwaldPracticalLight.position.set(-11, 13.5, -20);
    scene.add(thorwaldPracticalLight);

    const composerPracticalLight = new THREE.PointLight(0x60a5fa, 2.2, 30, 1.6);
    composerPracticalLight.position.set(19, 22.5, -8);
    scene.add(composerPracticalLight);

    const jeffInteriorLamp = new THREE.PointLight(0xfbbf24, 1.2, 18, 1.8);
    jeffInteriorLamp.position.set(-3.8, 14.5, 16.6);
    scene.add(jeffInteriorLamp);

    const flashbulbLight = new THREE.PointLight(0xfffbeb, 0, 95, 1.3);
    flashbulbLight.position.set(0, 14.8, 14.2);
    scene.add(flashbulbLight);

    // Optional Architectural Reference Grid
    const stageGrid = new THREE.GridHelper(90, 45, 0xf59e0b, 0x334155);
    stageGrid.position.set(0, -3.9, -4);
    stageGrid.visible = wireframeRef.current;
    scene.add(stageGrid);

    // Camera-POV Sightline Frustum & Non-Orthogonal Wall-Splay Rays from Jeffries's Nodal Tripod
    const povFrustumGroup = new THREE.Group();
    const jeffNodalOrigin = new THREE.Vector3(0, 14.5, 16.3);
    const frustumRayMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.42
    });
    const splayWedgeMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65
    });

    STAGE18_APARTMENTS.forEach((apt) => {
      if (apt.id === 'apt-jeffries') return;
      const targetPt = new THREE.Vector3(...apt.cameraLookAt);
      const rayGeo = new THREE.BufferGeometry().setFromPoints([jeffNodalOrigin, targetPt]);
      povFrustumGroup.add(new THREE.Line(rayGeo, frustumRayMat));

      // Draw splayed wall sightline indicator at each apartment target
      const ov =
        parametricOverridesRef.current[apt.id] || INITIAL_BUILDING_PARAMETRIC_OVERRIDES[apt.id];
      const splayRad = THREE.MathUtils.degToRad(ov?.cameraSightlineSplayDeg || 8.0);
      const depthDir = new THREE.Vector3()
        .subVectors(targetPt, jeffNodalOrigin)
        .normalize()
        .multiplyScalar((ov?.interiorDepthFeet || 11.0) * 0.45);
      const leftSplay = depthDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), splayRad);
      const rightSplay = depthDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -splayRad);
      const wedgeGeo = new THREE.BufferGeometry().setFromPoints([
        targetPt.clone().add(leftSplay),
        targetPt,
        targetPt.clone().add(rightSplay)
      ]);
      povFrustumGroup.add(new THREE.Line(wedgeGeo, splayWedgeMat));
    });
    povFrustumGroup.visible = povFrustumRef.current;
    scene.add(povFrustumGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // =========================================================================
    // 6. PACED ON-DEMAND & DAMPED RENDER LOOP
    // =========================================================================
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    // Diagnostic Confidence Heatmap Materials (Cyan <45%, Amber 45-79%, Emerald >=80%)
    const heatmapLowMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.55
    });
    const heatmapMedMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xb45309,
      emissiveIntensity: 0.4,
      roughness: 0.5
    });
    const heatmapHighMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      emissive: 0x047857,
      emissiveIntensity: 0.45,
      roughness: 0.45
    });

    const clayGeometryMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.62,
      metalness: 0.04
    });

    const getConfidenceMaterial = (
      conf: number,
      defaultMat: THREE.MeshStandardMaterial
    ): THREE.MeshStandardMaterial => {
      if (heatmapModeRef.current) {
        if (conf >= 80) return heatmapHighMat;
        if (conf >= 45) return heatmapMedMat;
        return heatmapLowMat;
      }
      if (geometryShadingModeRef.current === 'clay_geometry') {
        return clayGeometryMat;
      }
      return defaultMat;
    };

    const gardenDefaultMat = gardenBasin.material as THREE.MeshStandardMaterial;

    function applyDynamicLightingAndSceneState(dt: number) {
      const l = activeLightingRef.current;
      const elRad = THREE.MathUtils.degToRad(l.sunElevationDeg);
      const azRad = THREE.MathUtils.degToRad(l.sunAzimuthDeg);
      sunKeyLight.position.set(
        Math.sin(azRad) * Math.cos(elRad) * 45,
        Math.sin(elRad) * 45,
        Math.cos(azRad) * Math.cos(elRad) * 45
      );
      sunKeyLight.color.set(l.sunColorHex);
      sunKeyLight.intensity = l.sunIntensity;

      skyHemiLight.color.set(l.skyHemiColorHex);
      skyHemiLight.groundColor.set(l.groundHemiColorHex);
      skyHemiLight.intensity = l.ambientIntensity;

      thorwaldPracticalLight.intensity = l.practicalLampIntensity * 2.4;
      composerPracticalLight.intensity = l.practicalLampIntensity * 2.0;
      jeffInteriorLamp.intensity = l.jeffInteriorLampIntensity * 1.6;

      windowMaterials.forEach((m) => {
        m.emissiveIntensity = THREE.MathUtils.clamp(l.practicalLampIntensity * 0.65, 0.25, 2.8);
      });

      renderer.toneMappingExposure = l.cyclesExposure;
      (scene.background as THREE.Color).set(l.fogColorHex);
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.set(l.fogColorHex);
      }

      const isWireOverlay =
        wireframeRef.current || geometryShadingModeRef.current === 'wireframe_overlay';
      stageGrid.visible = isWireOverlay;
      povFrustumGroup.visible = povFrustumRef.current || isWireOverlay;

      // Apply Live Parametric Architectural Overrides, Camera-POV Forced-Perspective Scale, Non-Orthogonal Wall Splay & Floor Rake
      const ovMap = parametricOverridesRef.current;
      const baseMap = INITIAL_BUILDING_PARAMETRIC_OVERRIDES;

      const thorOv = ovMap['apt-thorwald'] || baseMap['apt-thorwald'];
      const thorOff = thorOv.placementOffsetFeet || [0, 0, 0];
      const thorSplayRad = THREE.MathUtils.degToRad((thorOv.cameraSightlineSplayDeg ?? 6.8) * 0.25);
      const thorRakeRad = THREE.MathUtils.degToRad((thorOv.floorRakePitchDeg ?? 1.8) * 0.35);
      northFacade.scale.set(
        thorOv.widthFeet / baseMap['apt-thorwald'].widthFeet,
        thorOv.heightFeet / baseMap['apt-thorwald'].heightFeet,
        thorOv.depthFeet / baseMap['apt-thorwald'].depthFeet
      );
      northFacade.position.set(
        -10 + thorOff[0],
        15 + (thorOv.elevationOffsetFeet - baseMap['apt-thorwald'].elevationOffsetFeet) + thorOff[1],
        -29 + thorOff[2]
      );
      northFacade.rotation.set(thorRakeRad, thorSplayRad, 0);
      northCornice.scale.x = northFacade.scale.x;
      northCornice.position.set(
        -10 + thorOff[0],
        34.2 + (thorOv.elevationOffsetFeet - baseMap['apt-thorwald'].elevationOffsetFeet) + thorOff[1],
        -29 + thorOff[2]
      );
      northCornice.rotation.set(thorRakeRad, thorSplayRad, 0);
      northFacade.material = getConfidenceMaterial(thorOv.confidenceScore, redBrickMat);

      const torsoOv = ovMap['apt-torso'] || baseMap['apt-torso'];
      const torsoOff = torsoOv.placementOffsetFeet || [0, 0, 0];
      const torsoSplayRad = THREE.MathUtils.degToRad((torsoOv.cameraSightlineSplayDeg ?? 11.5) * 0.22);
      const torsoRakeRad = THREE.MathUtils.degToRad((torsoOv.floorRakePitchDeg ?? 1.4) * 0.3);
      westFacade.scale.set(
        torsoOv.widthFeet / baseMap['apt-torso'].widthFeet,
        torsoOv.heightFeet / baseMap['apt-torso'].heightFeet,
        torsoOv.depthFeet / baseMap['apt-torso'].depthFeet
      );
      westFacade.position.set(
        -29 + torsoOff[0],
        14 + (torsoOv.elevationOffsetFeet - baseMap['apt-torso'].elevationOffsetFeet) + torsoOff[1],
        -4 + torsoOff[2]
      );
      westFacade.rotation.set(torsoRakeRad, torsoSplayRad, 0);
      westCornice.scale.z = westFacade.scale.z;
      westCornice.position.set(
        -29 + torsoOff[0],
        32.2 + (torsoOv.elevationOffsetFeet - baseMap['apt-torso'].elevationOffsetFeet) + torsoOff[1],
        -4 + torsoOff[2]
      );
      westCornice.rotation.set(torsoRakeRad, torsoSplayRad, 0);
      torsoBalcony.scale.x = Math.max(
        0.5,
        torsoOv.balconyProjectionFeet / Math.max(0.5, baseMap['apt-torso'].balconyProjectionFeet)
      );
      westFacade.material = getConfidenceMaterial(torsoOv.confidenceScore, buffBrickMat);

      const compOv = ovMap['apt-composer'] || baseMap['apt-composer'];
      const compOff = compOv.placementOffsetFeet || [0, 0, 0];
      const compSplayRad = THREE.MathUtils.degToRad((compOv.cameraSightlineSplayDeg ?? -12.0) * 0.22);
      const compRakeRad = THREE.MathUtils.degToRad((compOv.floorRakePitchDeg ?? 2.4) * 0.3);
      eastFacade.scale.set(
        compOv.widthFeet / baseMap['apt-composer'].widthFeet,
        compOv.heightFeet / baseMap['apt-composer'].heightFeet,
        compOv.depthFeet / baseMap['apt-composer'].depthFeet
      );
      eastFacade.position.set(
        28 + compOff[0],
        15 + (compOv.elevationOffsetFeet - baseMap['apt-composer'].elevationOffsetFeet) + compOff[1],
        -4 + compOff[2]
      );
      eastFacade.rotation.set(compRakeRad, compSplayRad, 0);
      eastFacade.material = getConfidenceMaterial(compOv.confidenceScore, stuccoMat);

      const sculpOv = ovMap['apt-sculptor'] || baseMap['apt-sculptor'];
      const sculpOff = sculpOv.placementOffsetFeet || [0, 0, 0];
      const sculpRakeRad = THREE.MathUtils.degToRad((sculpOv.floorRakePitchDeg ?? -3.2) * 0.35);
      gardenBasin.scale.set(
        sculpOv.widthFeet / baseMap['apt-sculptor'].widthFeet,
        1.0,
        sculpOv.depthFeet / baseMap['apt-sculptor'].depthFeet
      );
      gardenBasin.position.set(
        2 + sculpOff[0],
        -3.95 + (sculpOv.elevationOffsetFeet - baseMap['apt-sculptor'].elevationOffsetFeet) + sculpOff[1],
        -15 + sculpOff[2]
      );
      gardenBasin.rotation.x = sculpRakeRad;
      gardenBasin.material = getConfidenceMaterial(sculpOv.confidenceScore, gardenDefaultMat);

      const alleyOv = ovMap['apt-alley-street'] || baseMap['apt-alley-street'];
      const alleyOff = alleyOv.placementOffsetFeet || [0, 0, 0];
      const alleySplayRad = THREE.MathUtils.degToRad((alleyOv.cameraSightlineSplayDeg ?? 9.5) * 0.3);
      const alleyRakeRad = THREE.MathUtils.degToRad((alleyOv.floorRakePitchDeg ?? 4.8) * 0.35);
      streetBackdrop.scale.set(
        alleyOv.widthFeet / baseMap['apt-alley-street'].widthFeet,
        alleyOv.heightFeet / baseMap['apt-alley-street'].heightFeet,
        alleyOv.depthFeet / baseMap['apt-alley-street'].depthFeet
      );
      streetBackdrop.position.set(
        13 + alleyOff[0],
        10 + (alleyOv.elevationOffsetFeet - baseMap['apt-alley-street'].elevationOffsetFeet) + alleyOff[1],
        -38 + alleyOff[2]
      );
      streetBackdrop.rotation.set(alleyRakeRad, alleySplayRad, 0);
      streetBackdrop.material = getConfidenceMaterial(alleyOv.confidenceScore, buffBrickMat);

      const jeffOv = ovMap['apt-jeffries'] || baseMap['apt-jeffries'];
      jeffFloor.material = getConfidenceMaterial(jeffOv.confidenceScore, woodFloorMat);

      // Update selection outlines
      highlightBoxes.forEach((outline, id) => {
        const mat = outline.material as THREE.LineBasicMaterial;
        mat.opacity =
          id === selectedAptIdRef.current
            ? 0.95
            : isWireOverlay || heatmapModeRef.current
            ? 0.55
            : 0.0;
      });

      // Decay flashbulb pulse if active
      if (flashIntensityRef.current > 0.05) {
        flashIntensityRef.current = THREE.MathUtils.damp(flashIntensityRef.current, 0, 5.5, dt);
        flashbulbLight.intensity = flashIntensityRef.current;
      } else {
        flashIntensityRef.current = 0;
        flashbulbLight.intensity = 0;
      }
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;

        let needsMoreFrames = false;

        if (isTransitioningCameraRef.current) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraTargetPosRef.current.x, 6.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraTargetPosRef.current.y, 6.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraTargetPosRef.current.z, 6.5, dt);

          currentLookAtRef.current.x = THREE.MathUtils.damp(currentLookAtRef.current.x, cameraLookAtRef.current.x, 6.5, dt);
          currentLookAtRef.current.y = THREE.MathUtils.damp(currentLookAtRef.current.y, cameraLookAtRef.current.y, 6.5, dt);
          currentLookAtRef.current.z = THREE.MathUtils.damp(currentLookAtRef.current.z, cameraLookAtRef.current.z, 6.5, dt);
          controls.target.copy(currentLookAtRef.current);

          camera.fov = THREE.MathUtils.damp(camera.fov, targetFovRef.current, 7.0, dt);
          camera.updateProjectionMatrix();

          const posDist = camera.position.distanceTo(cameraTargetPosRef.current);
          const lookDist = controls.target.distanceTo(cameraLookAtRef.current);
          const fovDiff = Math.abs(camera.fov - targetFovRef.current);

          if (posDist < 0.03 && lookDist < 0.03 && fovDiff < 0.08) {
            isTransitioningCameraRef.current = false;
          } else {
            needsMoreFrames = true;
          }
        }

        if (flashIntensityRef.current > 0.05) {
          needsMoreFrames = true;
        }

        applyDynamicLightingAndSceneState(dt);
        controls.update();
        if (!heatmapModeRef.current && geometryShadingModeRef.current === 'clay_geometry') {
          scene.overrideMaterial = clayGeometryMat;
        } else {
          scene.overrideMaterial = null;
        }
        renderer.render(scene, camera);
        scene.overrideMaterial = null;

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    captureViewportPngRef.current = () => {
      try {
        applyDynamicLightingAndSceneState(0.016);
        controls.update();
        scene.overrideMaterial = null;
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL('image/png');
      } catch {
        return null;
      }
    };

    const onControlStart = () => {
      isTransitioningCameraRef.current = false;
    };
    const onControlChange = () => {
      currentLookAtRef.current.copy(controls.target);
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // Raycast click & hover on Layer 1
    _raycaster.layers.set(1);
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointer, camera);
      const hits = _raycaster.intersectObjects(interactiveZoneMeshes, false);
      if (hits.length > 0) {
        const apt = hits[0].object.userData.apartment as Stage18ApartmentUnit;
        if (apt) {
          onSelectApartmentRef.current(apt);
        }
      }
    };

    let lastHoverCheck = 0;
    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;
      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointer, camera);
      const hits = _raycaster.intersectObjects(interactiveZoneMeshes, false);
      if (hits.length > 0) {
        const apt = hits[0].object.userData.apartment as Stage18ApartmentUnit;
        const nextHover = apt ? `${apt.designation} · ${apt.name}` : null;
        if (lastHoveredRef.current !== nextHover) {
          lastHoveredRef.current = nextHover;
          setHoveredAptName(nextHover);
        }
        renderer.domElement.style.cursor = 'pointer';
      } else {
        if (lastHoveredRef.current !== null) {
          lastHoveredRef.current = null;
          setHoveredAptName(null);
        }
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      requestRender();
    };
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });
    resizeObserver.observe(container);

    // Initial render
    requestRender();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();

      // Dispose all GPU geometries, materials, and procedural textures to prevent VRAM leaks across tab switches
      if (currentProjectedTex) {
        currentProjectedTex.dispose();
      }
      slotTextureCache.forEach((entry) => entry.textures.forEach((t) => t.dispose()));
      slotTextureCache.clear();
      [
        redBrickTex,
        buffBrickTex,
        eastStuccoTex,
        thorwaldWinTex,
        torsoWinTex,
        composerWinTex,
        lonelyWinTex
      ].forEach((t) => t.dispose());
      [heatmapLowMat, heatmapMedMat, heatmapHighMat, clayGeometryMat].forEach((m) => m.dispose());
      if (scene.environment) {
        scene.environment.dispose();
      }
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const matchingFramesForApt = curatedFrames.filter(
    (f) => f.targetApartmentId === selectedApartment.id
  );
  const selectedAptOverride =
    parametricOverrides[selectedApartment.id] ||
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES[selectedApartment.id];

  return (
    <div className="flex w-full h-[calc(100vh-65px)] overflow-hidden bg-[#0B0D11] select-none">
      {/* LEFT PANE: Interactive 3D Geometry Viewport & HUD Overlays */}
      <div className="relative flex-1 h-full min-w-0 overflow-hidden">
        {/* Dedicated Isolated WebGL Canvas Container */}
        <div ref={canvasMountRef} className="w-full h-full" />

        {/* Live Comparison Header Pill when Side-by-Side Material Inspector is Active */}
        {showSplitMaterialInspector && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-20 hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#12161F]/95 border border-amber-500/35 shadow-xl text-[11px] font-mono">
            <Columns className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-300 font-semibold">SIDE-BY-SIDE COMPARISON</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-200">
              Left: 3D Geometry (
              {geometryShadingMode === 'pbr_textured'
                ? 'Full PBR Textured'
                : geometryShadingMode === 'clay_geometry'
                ? 'Clay Massing'
                : 'PBR + Wireframe'}
              )
            </span>
            <span className="text-slate-500">↔</span>
            <span className="text-emerald-300">
              Right: {selectedApartment.designation} PBR Material Inspector
            </span>
          </div>
        )}

        {/* Optical Viewfinder / Reticle Overlays (Non-obstructive, pointer-events-none) */}
        {activeCameraPreset.reticleMode === 'exakta_slr' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className="w-[460px] h-[460px] rounded-full border border-amber-400/30 flex items-center justify-center shadow-[0_0_0_9999px_rgba(6,8,12,0.52)]">
              <div className="w-24 h-24 rounded-full border border-amber-400/45 flex items-center justify-center">
                <div className="w-full h-[1px] bg-amber-400/40" />
              </div>
            </div>
          </div>
        )}

        {activeCameraPreset.reticleMode === 'binoculars' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
            <div className="flex items-center -space-x-16 shadow-[0_0_0_9999px_rgba(6,8,12,0.62)] rounded-full">
              <div className="w-[340px] h-[340px] rounded-full border border-slate-400/25" />
              <div className="w-[340px] h-[340px] rounded-full border border-slate-400/25" />
            </div>
          </div>
        )}

        {/* Top-Left Minimal Spec & Optical Telemetry Strip */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none">
          <div className="bg-[#12161F]/95 border border-white/10 rounded-lg px-3.5 py-2 shadow-xl">
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="text-amber-400 font-semibold">{activeCameraPreset.cameraBody}</span>
              <span aria-hidden="true">·</span>
              <span>{activeCameraPreset.lensModel}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-200">{activeCameraPreset.focalLengthMm}mm</span>
              <span aria-hidden="true">·</span>
              <span>FOV {activeCameraPreset.fovDegrees}°</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>Stage 18: 185&apos; × 50&apos; × 40&apos;</span>
              <span aria-hidden="true">·</span>
              <span>Lighting: {activeLighting.shortLabel} ({activeLighting.cyclesKelvinKey}K)</span>
              {hoveredAptName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300 font-medium">{hoveredAptName}</span>
                </>
              )}
            </div>
          </div>

          {/* Confidence Heatmap Legend when active */}
          {showConfidenceHeatmap && (
            <div className="bg-[#12161F]/95 border border-amber-500/40 rounded-lg px-3.5 py-2 shadow-xl flex items-center gap-4 text-[11px] font-mono">
              <span className="text-amber-300 font-semibold">3D CONFIDENCE HEATMAP:</span>
              <span className="flex items-center gap-1.5 text-sky-300">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-500" />
                &lt;45% Baseline Prior
              </span>
              <span className="flex items-center gap-1.5 text-amber-300">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500" />
                45–79% Partial Scan
              </span>
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                ≥80% Multi-Frame Locked
              </span>
            </div>
          )}

          {/* Sub-Component: L.B. Jefferies's Apartment (#2B) PBR Material Swatch Gallery */}
          <JeffriesPbrMaterialSwatchGallery
            materials={jeffriesPbrMaterials}
            selectedMaterialId={activePbrMaterialId}
            defaultExpanded={!showSplitMaterialInspector}
            onSelectMaterial={(mat) => setActivePbrMaterialId(mat.id)}
            onUpdateMaterialProperty={(matId, updates) => {
              if (!onUpdateJeffriesPbrMaterials) return;
              const updated = jeffriesPbrMaterials.map((m) =>
                m.id === matId
                  ? {
                      ...m,
                      surfaceProperties: {
                        ...m.surfaceProperties,
                        ...updates
                      }
                    }
                  : m
              );
              onUpdateJeffriesPbrMaterials(updated);
            }}
            onOpenFullPbrStudio={(matId) => {
              if (matId) setActivePbrMaterialId(matId);
              setShowPbrLabModal(true);
            }}
            onFocusJeffriesApartmentIn3D={() => {
              const jeffApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-jeffries');
              if (jeffApt) {
                onSelectApartment(jeffApt);
              }
              const orbitCam = CAMERA_OPTICAL_PRESETS.find((c) => c.id === 'cam-stage18-orbit');
              if (orbitCam) {
                onSelectCameraPreset(orbitCam);
              }
            }}
          />
        </div>

        {/* Top-Right Compact Apartment Spec Drawer & Split Comparison Toolbar */}
        <div className="absolute top-4 right-4 z-20 flex flex-wrap items-center justify-end gap-1.5 max-w-[68%]">
          <button
            onClick={() => onNavigateToTab('sourcelab')}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 border border-amber-400 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-md"
            title="Open the 75GB Video Ingest Lab to upload/mount your Rear Window video file and test frame extraction & 3D synthesis"
          >
            <Video className="w-3.5 h-3.5" />
            Upload / Test 75GB Video
          </button>
          <button
            onClick={() => setShowConceptRenderModal(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 border border-emerald-400 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-md"
            title="Generate a conceptual rendering of the current apartment geometry and lighting setup as a stylistic reference for the team"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate Concept Render
          </button>
          <button
            onClick={() =>
              setShowSplitMaterialInspector((prev) => {
                const next = !prev;
                if (next) setShowInspector(false);
                return next;
              })
            }
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showSplitMaterialInspector
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-[#12161F]/95 text-amber-300 border-amber-500/40 hover:bg-amber-500/15'
            }`}
            title="Toggle Live Side-by-Side 3D Geometry + Zone PBR Material Inspector Comparison View"
          >
            <Columns className="w-3.5 h-3.5" />
            {showSplitMaterialInspector ? 'Split Material Inspector: ON' : 'Split Material Inspector'}
          </button>
          {liveProjectedTextureUrl && onClearLiveProjection && (
            <button
              onClick={onClearLiveProjection}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" />
              Reset Live 4K Projection
            </button>
          )}
          {onToggleConfidenceHeatmap && (
            <button
              onClick={onToggleConfidenceHeatmap}
              className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                showConfidenceHeatmap
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-semibold'
                  : 'bg-[#12161F]/95 text-slate-200 border-white/10 hover:border-white/25'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {showConfidenceHeatmap ? 'Heatmap: ON' : 'Heatmap'}
            </button>
          )}
          <button
            onClick={() => setShowPovSightlineFrustum((prev) => !prev)}
            className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showPovSightlineFrustum
                ? 'bg-sky-500 text-slate-950 border-sky-400 font-semibold'
                : 'bg-[#12161F]/95 text-slate-200 border-white/10 hover:border-white/25'
            }`}
            title="Visualize L.B. Jefferies's Camera-POV Sightline Frustum & Non-Orthogonal Wall-Splay Wedges"
          >
            <Crosshair className="w-3.5 h-3.5" />
            {showPovSightlineFrustum ? 'POV Frustum: ON' : 'POV Frustum'}
          </button>
          <button
            onClick={() => setShowWireframeGrid((prev) => !prev)}
            className={`px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showWireframeGrid
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'bg-[#12161F]/95 text-slate-200 border-white/10 hover:border-white/25'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            {showWireframeGrid ? 'Grid: ON' : 'Stage Grid'}
          </button>
          <button
            onClick={() => setShowAssetLibraryModal(true)}
            className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showAssetLibraryModal
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-[#12161F]/95 text-amber-300 border-amber-500/40 hover:bg-amber-500/15'
            }`}
            title="Open L.B. Jeffries's Apartment (#2B) 12-Piece 3D Set Dressing & Furniture Asset Library"
          >
            <Package className="w-3.5 h-3.5" />
            3D Asset Library (12)
          </button>
          <button
            onClick={() => setShowPbrLabModal((prev) => !prev)}
            className={`px-2.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              showPbrLabModal
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                : 'bg-[#12161F]/95 text-amber-300 border-amber-500/40 hover:bg-amber-500/15'
            }`}
            title="Open L.B. Jefferies's Apartment (#2B) Film-Still Calibrated PBR Texture & Material Studio"
          >
            <Sparkles className="w-3.5 h-3.5" />
            PBR Studio (8)
          </button>
          <button
            onClick={() =>
              setShowInspector((prev) => {
                const next = !prev;
                if (next) setShowSplitMaterialInspector(false);
                return next;
              })
            }
            className="px-2.5 py-2 text-xs font-medium rounded-lg bg-[#12161F]/95 text-slate-200 border border-white/10 hover:border-white/25 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {showInspector ? 'Hide Zone Spec' : 'Zone Spec'}
          </button>
        </div>

      {/* Slide-Over Architectural Zone Specification Drawer (Collapsible) */}
      {showInspector && (
        <aside className="absolute top-16 right-6 z-20 w-84 max-h-[calc(100vh-220px)] overflow-y-auto bg-[#12161F]/95 border border-white/10 rounded-xl p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
            <div>
              <p className="text-[11px] font-mono text-amber-400 tracking-wide">
                {selectedApartment.designation}
              </p>
              <h2 className="text-base font-semibold text-white font-display mt-0.5">
                {selectedApartment.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedApartment.resident} · {selectedApartment.floorLevel}
              </p>
            </div>
          </div>

          <div className="py-3 space-y-3 text-xs">
            {/* Converged CV Parametric Dimensions + POV Forced-Perspective Box */}
            {selectedAptOverride && (
              <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/10 space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-semibold">POV FORCED-PERSPECTIVE 3D</span>
                  <span
                    className={`font-bold tabular-nums ${
                      selectedAptOverride.confidenceScore >= 80
                        ? 'text-emerald-400'
                        : selectedAptOverride.confidenceScore >= 45
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {selectedAptOverride.confidenceScore}% Confidence
                  </span>
                </div>
                <div className="text-slate-200 tabular-nums">
                  Massing: {selectedAptOverride.widthFeet.toFixed(1)}&apos; W ×{' '}
                  {selectedAptOverride.heightFeet.toFixed(1)}&apos; H ×{' '}
                  {selectedAptOverride.depthFeet.toFixed(1)}&apos; D
                </div>
                <div className="text-slate-300 tabular-nums">
                  Physical Room Depth:{' '}
                  <span className="text-amber-300 font-semibold">
                    {selectedAptOverride.interiorDepthFeet.toFixed(1)}&apos;
                  </span>{' '}
                  <span className="text-slate-400">
                    (Apparent Arch:{' '}
                    {(
                      selectedAptOverride.apparentArchitecturalDepthFeet ??
                      selectedAptOverride.interiorDepthFeet
                    ).toFixed(1)}
                    &apos;)
                  </span>
                </div>
                <div className="text-sky-300 tabular-nums text-[10px]">
                  POV Scale:{' '}
                  {(selectedAptOverride.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2)}× · Wall
                  Splay:{' '}
                  {(selectedAptOverride.cameraSightlineSplayDeg ?? 0) >= 0 ? '+' : ''}
                  {(selectedAptOverride.cameraSightlineSplayDeg ?? 0).toFixed(1)}° · Floor Rake:{' '}
                  {(selectedAptOverride.floorRakePitchDeg ?? 0) >= 0 ? '+' : ''}
                  {(selectedAptOverride.floorRakePitchDeg ?? 0).toFixed(1)}°
                </div>
                <div className="text-slate-300 tabular-nums text-[10px]">
                  Window Grid: {selectedAptOverride.windowCols}×{selectedAptOverride.windowRows} ·
                  Reveal {selectedAptOverride.windowRevealInches.toFixed(1)}&quot;
                </div>
                {selectedAptOverride.placementOffsetFeet && (
                  <div className="text-emerald-300 tabular-nums text-[10px]">
                    Verified Offset: ΔX {selectedAptOverride.placementOffsetFeet[0].toFixed(1)}&apos; ·
                    ΔY {selectedAptOverride.placementOffsetFeet[1].toFixed(1)}&apos; · ΔZ{' '}
                    {selectedAptOverride.placementOffsetFeet[2].toFixed(1)}&apos;
                  </div>
                )}
                {selectedAptOverride.orientationOverrideDeg && (
                  <div className="text-amber-300 tabular-nums text-[10px]">
                    Verified Camera: Pitch {selectedAptOverride.orientationOverrideDeg.pitchDeg}° ·
                    Yaw {selectedAptOverride.orientationOverrideDeg.yawDeg}° · Roll{' '}
                    {selectedAptOverride.orientationOverrideDeg.rollPlumbDeg}°
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] text-slate-400">
                  <span>SMPTE {selectedAptOverride.lastUpdatedSmpte}</span>
                  <button
                    onClick={() => onNavigateToTab('sourcelab')}
                    className="text-amber-300 hover:underline"
                  >
                    Run Frame Solver →
                  </button>
                </div>
              </div>
            )}

            <div>
              <div className="text-slate-400 mb-1">Dimensions & LOD Budget</div>
              <div className="text-slate-200 font-mono">{selectedApartment.dimensionsFeet}</div>
              <div className="text-amber-300/90 mt-0.5">{selectedApartment.furnishedStatus}</div>
            </div>

            <div>
              <div className="text-slate-400 mb-1">Required Set Decoration & Hero Props</div>
              <ul className="space-y-1 text-slate-300">
                {selectedApartment.keyProps.slice(0, 4).map((prop, i) => (
                  <li key={i} className="leading-snug">
                    • {prop}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-slate-400 mb-1">4K Blu-ray Remux SMPTE Reference Timestamps</div>
              <div className="font-mono text-slate-200">
                {selectedApartment.remuxTimestamps.join(' · ')}
              </div>
            </div>

            <div>
              <div className="text-slate-400 mb-1">Occlusion & Perspective Notes</div>
              <p className="text-slate-300 leading-relaxed">{selectedApartment.occlusionNotes}</p>
            </div>

            {/* L.B. Jefferies's Apartment (#2B) Film-Still PBR Material Suite Summary */}
            <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  JEFFRIES APT PBR SUITE (8 SHADERS)
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Blender 4.2 Ready</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {jeffriesPbrMaterials.slice(0, 6).map((mat) => (
                  <div
                    key={mat.id}
                    className="px-2 py-1 rounded bg-[#12161F] border border-white/5 flex items-center gap-1.5 text-[10px] font-mono"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0 border border-white/20"
                      style={{ backgroundColor: mat.surfaceProperties.baseColorHex }}
                    />
                    <span className="text-slate-200 truncate">{mat.shortLabel}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  onClick={() => setShowPbrLabModal(true)}
                  className="w-full py-1.5 px-2.5 rounded bg-amber-500 text-slate-950 font-semibold text-[11px] hover:bg-amber-400 transition-colors flex items-center justify-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Customize PBR Textures &amp; Maps
                </button>
              </div>
            </div>

            {matchingFramesForApt.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <div className="text-slate-400 mb-1.5">
                  Pinned Hero Frames ({matchingFramesForApt.length})
                </div>
                <div className="space-y-1.5">
                  {matchingFramesForApt.map((frame) => (
                    <div
                      key={frame.id}
                      className="p-2 rounded-lg bg-[#1A202C] border border-white/5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-slate-200 font-medium truncate">{frame.title}</div>
                        <div className="text-[11px] font-mono text-slate-400">
                          SMPTE {frame.smpteTimecode} · {frame.focalLengthMm}mm
                        </div>
                      </div>
                      <button
                        onClick={() => onNavigateToTab('frames')}
                        className="px-2 py-1 text-[11px] font-medium bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 transition-colors whitespace-nowrap shrink-0"
                      >
                        Curate
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Interactive Jeffries PBR Texture & Material Studio Modal Overlay */}
      {showPbrLabModal && onUpdateJeffriesPbrMaterials && (
        <div className="absolute inset-x-6 top-16 bottom-24 z-30 overflow-y-auto rounded-2xl bg-[#0B0D11]/95 border border-amber-500/40 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>LIVE 3D VIEWPORT MATERIAL LINK ACTIVE — CHANGES UPDATE APT 2B IN REAL TIME</span>
            </div>
            <button
              onClick={() => setShowPbrLabModal(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 text-white hover:bg-white/20 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Close PBR Studio
            </button>
          </div>
          <JeffriesPbrMaterialLab
            materials={jeffriesPbrMaterials}
            onUpdateMaterials={onUpdateJeffriesPbrMaterials}
            initialSelectedMaterialId={activePbrMaterialId}
            onOpenBlenderPbrScript={() => {
              setShowPbrLabModal(false);
              if (onOpenBlenderPbrScript) {
                onOpenBlenderPbrScript();
              } else {
                onNavigateToTab('scripts');
              }
            }}
            compactMode
          />
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Zero Viewport Occlusion) */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-[min(940px,94vw)] transition-transform duration-200"
        style={{
          transform: dockCollapsed ? 'translate(-50%, calc(100% - 32px))' : 'translate(-50%, 0)'
        }}
      >
        {/* Collapse / Expand Toggle Handle */}
        <div className="flex justify-center mb-1.5">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="px-3.5 py-1 text-xs font-medium bg-[#12161F] text-slate-300 hover:text-white border border-white/15 rounded-md shadow-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
                Show Controls (H)
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                Hide Controls (H)
              </>
            )}
          </button>
        </div>

        {/* Main Control Surface */}
        <div className="bg-[#12161F] border border-white/15 rounded-xl p-3.5 shadow-2xl space-y-3">
          {/* Row 1: Camera Lens / POV Selector + Flashbulb Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1 whitespace-nowrap shrink-0">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                Optics & POV:
              </span>
              {CAMERA_OPTICAL_PRESETS.map((preset) => {
                const isActive = activeCameraPreset.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => onSelectCameraPreset(preset)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'bg-[#1A202C] text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Lighting Presets & Graflex Flashbulb Trigger */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1 whitespace-nowrap shrink-0">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Stage Lighting:
              </span>
              {LIGHTING_SCENARIOS.map((light) => {
                const isActive = activeLighting.id === light.id;
                return (
                  <button
                    key={light.id}
                    onClick={() => onSelectLighting(light)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-100 text-slate-950 font-semibold'
                        : 'bg-[#1A202C] text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {light.shortLabel}
                  </button>
                );
              })}

              <button
                onClick={triggerFlashbulb}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  flashPulseActive
                    ? 'bg-red-500 text-white'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Fire Flashbulb
              </button>

              <button
                onClick={() => setShowAssetLibraryModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                title="Inspect L.B. Jeffries's 12 Set Dressing & Furniture 3D Assets"
              >
                <Package className="w-3.5 h-3.5" />
                Jeffries 3D Assets (12)
              </button>

              <button
                onClick={() => setShowConceptRenderModal(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                title="Generate Conceptual Stylistic Rendering of Current 3D Geometry & Lighting Setup"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Concept Render
              </button>
            </div>
          </div>

          {/* Row 2: Architectural Zone Hotspots */}
          <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-slate-400 mr-1 flex items-center gap-1 whitespace-nowrap shrink-0">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                Stage 18 Zones:
              </span>
              {STAGE18_APARTMENTS.map((apt) => {
                const isSelected = selectedApartment.id === apt.id;
                return (
                  <button
                    key={apt.id}
                    onClick={() => {
                      onSelectApartment(apt);
                      if (!showSplitMaterialInspector) {
                        setShowInspector(true);
                      }
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-medium'
                        : 'bg-[#1A202C] text-slate-300 hover:text-white'
                    }`}
                  >
                    {apt.name.split("'s")[0]}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onNavigateToTab('scripts')}
              className="px-3 py-1 text-xs font-medium text-amber-300 hover:text-amber-200 underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Generate Blender &amp; FFmpeg Scripts →
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* RIGHT PANE: Side-by-Side Live Comparison 'Material Inspector' Panel */}
      {showSplitMaterialInspector && (
        <ZonePbrMaterialInspectorPanel
          selectedApartment={selectedApartment}
          onSelectApartment={onSelectApartment}
          aptOverride={selectedAptOverride}
          jeffriesPbrMaterials={jeffriesPbrMaterials}
          onUpdateJeffriesPbrMaterials={onUpdateJeffriesPbrMaterials}
          selectedMaterialId={activePbrMaterialId}
          onSelectMaterialId={(id) => setActivePbrMaterialId(id)}
          geometryShadingMode={geometryShadingMode}
          onChangeGeometryShadingMode={setGeometryShadingMode}
          onOpenFullPbrStudio={(matId) => {
            if (matId) setActivePbrMaterialId(matId);
            setShowPbrLabModal(true);
          }}
          onCloseSplitView={() => setShowSplitMaterialInspector(false)}
        />
      )}

      {/* Conceptual Stylistic Reference Render Generator Modal */}
      <ConceptualRenderGeneratorModal
        isOpen={showConceptRenderModal}
        onClose={() => setShowConceptRenderModal(false)}
        captureLive3DViewportDataUrl={() => captureViewportPngRef.current()}
        selectedApartment={selectedApartment}
        aptOverride={selectedAptOverride}
        activeCameraPreset={activeCameraPreset}
        activeLighting={activeLighting}
        jeffriesPbrMaterials={jeffriesPbrMaterials}
        onPinToFrameCurator={onPinConceptFrame}
        onApplyLiveProjectionTo3D={onApplyLiveProjection}
      />

      {/* L.B. Jeffries Apartment (#2B) 12-Piece 3D Set Dressing & Furniture Asset Library Modal */}
      <JeffriesAssetLibraryModal
        isOpen={showAssetLibraryModal}
        onClose={() => setShowAssetLibraryModal(false)}
        jeffriesPbrMaterials={jeffriesPbrMaterials}
        initialAssetId={activeAssetId}
        onFocusAssetInApartment={(asset: Jeffries3DAssetSpec) => {
          setActiveAssetId(asset.id);
          const jeffApt = STAGE18_APARTMENTS.find((a) => a.id === 'apt-jeffries');
          if (jeffApt) {
            onSelectApartment(jeffApt);
          }
          const [ax, ay, az] = asset.apartmentPlacement.coordinatesFeet;
          cameraTargetPosRef.current.set(ax * 0.45, ay + 4.2, az - 5.2);
          cameraLookAtRef.current.set(ax, ay + 1.4, az);
          targetFovRef.current = 40;
          isTransitioningCameraRef.current = true;
          requestRenderRef.current();
        }}
        onOpenPbrMaterialStudio={(matId: string) => {
          setActivePbrMaterialId(matId);
          setShowPbrLabModal(true);
        }}
        onOpenBlenderAssetScriptTab={onOpenBlenderAssetLibraryScript}
      />
    </div>
  );
}
