import React, { useEffect, useRef, useState } from 'react';
import {
  BuildingParametricOverride,
  CameraOpticalPreset,
  CuratedReferenceFrame,
  JeffriesPbrMaterialSpec,
  LightingScenarioPreset,
  Stage18ApartmentUnit
} from '../data/stage18Data';
import {
  Camera,
  CheckCircle2,
  Columns,
  Download,
  Film,
  Layers,
  Pin,
  RefreshCw,
  Sparkles,
  Sun,
  Video,
  Wand2,
  X
} from 'lucide-react';

export type ConceptStylePresetId =
  | 'technicolor_1954'
  | 'pereira_gouache_concept'
  | 'cycles_agx_previs';

export interface ConceptReferenceBrief {
  conceptTitle: string;
  artDirectionSummary: string;
  cinematographyLightingNotes: string;
  forcedPerspectiveCallout: string;
  blenderCyclesShaderTips: string[];
}

interface ConceptualRenderGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  captureLive3DViewportDataUrl: () => string | null;
  selectedApartment: Stage18ApartmentUnit;
  aptOverride: BuildingParametricOverride;
  activeCameraPreset: CameraOpticalPreset;
  activeLighting: LightingScenarioPreset;
  jeffriesPbrMaterials: JeffriesPbrMaterialSpec[];
  onPinToFrameCurator?: (newFrame: CuratedReferenceFrame, dataUrl: string) => void;
  onApplyLiveProjectionTo3D?: (dataUrl: string) => void;
}

const STYLE_PRESETS: {
  id: ConceptStylePresetId;
  label: string;
  shortTag: string;
  description: string;
}[] = [
  {
    id: 'technicolor_1954',
    label: '1954 Technicolor Dye-Transfer Film Still',
    shortTag: 'Technicolor 1954',
    description:
      'Robert Burks ASC Eastmancolor 5248 / Technicolor dye-transfer grading with warm tungsten practical halation, deep courtyard cyan shadows, and 1.66:1 optical framing.'
  },
  {
    id: 'pereira_gouache_concept',
    label: 'Hal Pereira Art Dept Charcoal & Gouache',
    shortTag: 'Pereira Gouache',
    description:
      '1954 Paramount Art Department architectural charcoal contour lines, warm sepia/ochre gouache washes, and forced-perspective carpentry dimension callouts.'
  },
  {
    id: 'cycles_agx_previs',
    label: 'Blender 4.2 Cycles AgX Look-Dev Slate',
    shortTag: 'Cycles AgX Pre-Vis',
    description:
      'High-contrast AgX look-dev reference plate with PBR material swatch strip, Kelvin lighting key bar, and camera nodal telemetry slate for the 3D team.'
  }
];

function synthesizeStylisticConceptPlateOnCanvas(
  sourceViewportDataUrl: string | null,
  stylePreset: ConceptStylePresetId,
  apt: Stage18ApartmentUnit,
  ov: BuildingParametricOverride,
  cam: CameraOpticalPreset,
  light: LightingScenarioPreset,
  pbrMats: JeffriesPbrMaterialSpec[]
): Promise<string> {
  return new Promise((resolve) => {
    const W = 1280;
    const H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    const drawStylisticTreatmentAndSlate = (srcImg: HTMLImageElement | null) => {
      // 1. Base 3D Geometry & Lighting Layer
      if (srcImg) {
        ctx.drawImage(srcImg, 0, 0, W, H);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#1e1b18');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
      }

      // Read pixel buffer for stylistic post-processing
      const imgData = ctx.getImageData(0, 0, W, H);
      const d = imgData.data;

      if (stylePreset === 'technicolor_1954') {
        // Three-strip Technicolor dye-transfer curve: S-curve contrast + warm amber highlights + deep teal-indigo shadows + subtle film grain
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255;
          const g = d[i + 1] / 255;
          const b = d[i + 2] / 255;
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          // S-curve contrast
          const sc = luma * luma * (3 - 2 * luma);
          const ratio = luma > 0.001 ? sc / luma : 1.0;

          let nr = r * ratio;
          let ng = g * ratio;
          let nb = b * ratio;

          // Warm golden-amber push in mid/highs, deep Prussian blue in shadows
          nr = nr * 1.12 + sc * 0.06;
          ng = ng * 1.02 + sc * 0.02;
          nb = nb * 0.94 + (1 - sc) * 0.07;

          // Subtle 35mm photochemical grain
          const pxIdx = i >> 2;
          const gx = pxIdx % W;
          const gy = (pxIdx / W) | 0;
          const grain =
            (Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453 -
              Math.floor(Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453) -
              0.5) *
            0.035;

          d[i] = Math.min(255, Math.max(0, Math.round((nr + grain) * 255)));
          d[i + 1] = Math.min(255, Math.max(0, Math.round((ng + grain) * 255)));
          d[i + 2] = Math.min(255, Math.max(0, Math.round((nb + grain) * 255)));
        }
        ctx.putImageData(imgData, 0, 0);

        // Warm tungsten halation bloom + optical vignette
        const bloomGrad = ctx.createRadialGradient(
          W * 0.5,
          H * 0.45,
          W * 0.08,
          W * 0.5,
          H * 0.5,
          W * 0.65
        );
        bloomGrad.addColorStop(0, 'rgba(251, 191, 36, 0.14)');
        bloomGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.04)');
        bloomGrad.addColorStop(1, 'rgba(6, 9, 15, 0.58)');
        ctx.fillStyle = bloomGrad;
        ctx.fillRect(0, 0, W, H);
      } else if (stylePreset === 'pereira_gouache_concept') {
        // Hal Pereira 1954 Art Dept Charcoal & Gouache Illustration filter (Sobel edge ink + warm parchment wash)
        const copy = new Uint8ClampedArray(d);
        for (let y = 1; y < H - 1; y++) {
          for (let x = 1; x < W - 1; x++) {
            const idx = (y * W + x) * 4;
            const idxL = (y * W + (x - 1)) * 4;
            const idxR = (y * W + (x + 1)) * 4;
            const idxU = ((y - 1) * W + x) * 4;
            const idxD = ((y + 1) * W + x) * 4;

            const gx =
              (copy[idxR] - copy[idxL]) * 0.5 +
              (copy[idxR + 1] - copy[idxL + 1]) * 0.5;
            const gy =
              (copy[idxD] - copy[idxU]) * 0.5 +
              (copy[idxD + 1] - copy[idxU + 1]) * 0.5;
            const edge = Math.min(1, Math.sqrt(gx * gx + gy * gy) / 48);

            const r = copy[idx] / 255;
            const g = copy[idx + 1] / 255;
            const b = copy[idx + 2] / 255;
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;

            // Posterized gouache tonal bands on warm buff illustration board
            const tone = Math.round(luma * 6) / 6;
            const paperR = 0.22 + tone * 0.68 + r * 0.18;
            const paperG = 0.19 + tone * 0.58 + g * 0.14;
            const paperB = 0.15 + tone * 0.44 + b * 0.1;

            const inkMask = 1 - edge * 0.78;
            d[idx] = Math.min(255, Math.max(0, Math.round(paperR * inkMask * 255)));
            d[idx + 1] = Math.min(255, Math.max(0, Math.round(paperG * inkMask * 255)));
            d[idx + 2] = Math.min(255, Math.max(0, Math.round(paperB * inkMask * 255)));
          }
        }
        ctx.putImageData(imgData, 0, 0);

        // Architectural perspective drafting lines overlay
        ctx.save();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        const vpX = W * 0.5;
        const vpY = H * 0.46;
        for (let angle = -65; angle <= 65; angle += 26) {
          const rad = (angle * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(vpX, vpY);
          ctx.lineTo(vpX + Math.cos(rad) * W, vpY + Math.sin(rad) * H);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // Blender 4.2 Cycles AgX Pre-Vis Look-Dev grading
        for (let i = 0; i < d.length; i += 4) {
          let r = d[i] / 255;
          let g = d[i + 1] / 255;
          let b = d[i + 2] / 255;
          // AgX punchy shoulder roll-off
          r = Math.pow(r, 0.92) / (1 + r * 0.15);
          g = Math.pow(g, 0.92) / (1 + g * 0.15);
          b = Math.pow(b, 0.92) / (1 + b * 0.15);
          d[i] = Math.min(255, Math.max(0, Math.round(r * 255)));
          d[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
          d[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
        }
        ctx.putImageData(imgData, 0, 0);
      }

      // 2. Top & Bottom 1.66:1 Paramount Production Reference Slate Bars
      ctx.fillStyle = 'rgba(11, 13, 17, 0.88)';
      ctx.fillRect(0, 0, W, 52);
      ctx.fillRect(0, H - 76, W, 76);

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 52);
      ctx.lineTo(W, 52);
      ctx.moveTo(0, H - 76);
      ctx.lineTo(W, H - 76);
      ctx.stroke();

      // Top Slate Text
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(
        `PARAMOUNT STAGE 18 CONCEPTUAL STYLING PLATE · ${apt.designation}`,
        24,
        24
      );
      ctx.font = '12px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(
        `${apt.name} | Lens: ${cam.cameraBody} ${cam.focalLengthMm}mm (${cam.fovDegrees}° FOV) | Lighting: ${light.shortLabel} (${light.cyclesKelvinKey}K)`,
        24,
        42
      );

      // Right-aligned Style Tag in Top Slate
      const presetMeta = STYLE_PRESETS.find((p) => p.id === stylePreset)!;
      ctx.textAlign = 'right';
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#34d399';
      ctx.fillText(`STYLE: ${presetMeta.label.toUpperCase()}`, W - 24, 32);
      ctx.textAlign = 'left';

      // Bottom Slate: Forced-Perspective Geometry Telemetry + Active PBR Material Swatch Strip
      const fpScale = (ov.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2);
      const splay = (ov.cameraSightlineSplayDeg ?? 0).toFixed(1);
      const rake = (ov.floorRakePitchDeg ?? 0).toFixed(1);

      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(
        `GEOMETRY: ${ov.widthFeet.toFixed(1)}' W × ${ov.heightFeet.toFixed(1)}' H × ${ov.depthFeet.toFixed(1)}' D  |  ROOM DEPTH: ${ov.interiorDepthFeet.toFixed(1)}' Physical (${(ov.apparentArchitecturalDepthFeet ?? ov.interiorDepthFeet).toFixed(1)}' Apparent)`,
        24,
        H - 48
      );
      ctx.font = '12px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(
        `POV FORCED PERSPECTIVE: ${fpScale}× Scale  ·  Wall Splay: ${Number(splay) >= 0 ? '+' : ''}${splay}°  ·  Floor Rake: ${Number(rake) >= 0 ? '+' : ''}${rake}°  ·  Windows: ${ov.windowCols}×${ov.windowRows} (${ov.windowRevealInches.toFixed(1)}" Reveal)`,
        24,
        H - 24
      );

      // Draw PBR Material Swatches on Bottom-Right of Slate
      const swatchStartX = W - 24 - pbrMats.slice(0, 6).length * 46;
      pbrMats.slice(0, 6).forEach((m, idx) => {
        const sx = swatchStartX + idx * 46;
        const sy = H - 62;
        ctx.fillStyle = m.surfaceProperties.baseColorHex;
        ctx.fillRect(sx, sy, 38, 32);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(sx, sy, 38, 32);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`R${m.surfaceProperties.roughness.toFixed(2)}`, sx + 2, sy + 44);
      });

      resolve(canvas.toDataURL('image/png'));
    };

    if (sourceViewportDataUrl) {
      const img = new Image();
      img.onload = () => drawStylisticTreatmentAndSlate(img);
      img.onerror = () => drawStylisticTreatmentAndSlate(null);
      img.src = sourceViewportDataUrl;
    } else {
      drawStylisticTreatmentAndSlate(null);
    }
  });
}

export default function ConceptualRenderGeneratorModal({
  isOpen,
  onClose,
  captureLive3DViewportDataUrl,
  selectedApartment,
  aptOverride,
  activeCameraPreset,
  activeLighting,
  jeffriesPbrMaterials,
  onPinToFrameCurator,
  onApplyLiveProjectionTo3D
}: ConceptualRenderGeneratorModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<ConceptStylePresetId>('technicolor_1954');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [rawViewportUrl, setRawViewportUrl] = useState<string | null>(null);
  const [conceptRenderUrl, setConceptRenderUrl] = useState<string | null>(null);
  const [engineBadge, setEngineBadge] = useState<string>(
    'Standalone WebGL Framebuffer + 1954 Stylistic Compositor (Zero API Keys)'
  );
  const [brief, setBrief] = useState<ConceptReferenceBrief | null>(null);
  const [comparisonViewMode, setComparisonViewMode] = useState<'concept_only' | 'side_by_side'>(
    'side_by_side'
  );
  const [actionToast, setActionToast] = useState<string | null>(null);
  const lastAutoRunKeyRef = useRef<string>('');

  const runConceptGeneration = async (styleToUse: ConceptStylePresetId) => {
    setIsGenerating(true);
    setActionToast(null);

    const fpScale = (aptOverride.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2);
    const splayDeg = (aptOverride.cameraSightlineSplayDeg ?? 0).toFixed(1);
    const rakeDeg = (aptOverride.floorRakePitchDeg ?? 0).toFixed(1);
    const physDepth = (aptOverride.interiorDepthFeet ?? 11.4).toFixed(1);
    const appDepth = (aptOverride.apparentArchitecturalDepthFeet ?? 16.5).toFixed(1);
    const presetMeta = STYLE_PRESETS.find((p) => p.id === styleToUse) || STYLE_PRESETS[0];

    const fallbackLocalBrief: ConceptReferenceBrief = {
      conceptTitle: `${selectedApartment.designation} — ${presetMeta.label}`,
      artDirectionSummary: `Standalone conceptual reference rendering of ${selectedApartment.name} framed through ${activeCameraPreset.cameraBody} ${activeCameraPreset.focalLengthMm}mm (${activeCameraPreset.fovDegrees}° FOV) under ${activeLighting.shortLabel} (${activeLighting.cyclesKelvinKey}K). Preserves Hal Pereira's ${fpScale}× forced-perspective scale (${physDepth}' physical soundstage depth reading optically as ${appDepth}') with ${Number(splayDeg) >= 0 ? '+' : ''}${splayDeg}° non-orthogonal splayed side walls.`,
      cinematographyLightingNotes: `Calibrated to Robert Burks ASC's ${activeLighting.cyclesKelvinKey}K Stage 18 incandescent arc/tungsten rig (Sun Elevation ${activeLighting.sunElevationDeg}°, Azimuth ${activeLighting.sunAzimuthDeg}°). Maintain a 4:1 key-to-shadow contrast ratio across recessed ${aptOverride.windowRevealInches ?? 6.5}" masonry window reveals while preserving warm 2850K interior practical lamp falloff.`,
      forcedPerspectiveCallout: `Scale Factor ${fpScale}× · Wall Splay ${Number(splayDeg) >= 0 ? '+' : ''}${splayDeg}° · Floor Rake ${Number(rakeDeg) >= 0 ? '+' : ''}${rakeDeg}° · Massing ${(aptOverride.widthFeet ?? 35.2).toFixed(1)}' W × ${(aptOverride.heightFeet ?? 37.5).toFixed(1)}' H`,
      blenderCyclesShaderTips: [
        `Apply ${jeffriesPbrMaterials.slice(0, 3).map((m) => m.shortLabel).join(', ')} with OpenGL +Y tangent normals scaled by ${fpScale}×.`,
        `Use Blender 4.2 AgX Medium High Contrast view transform at ${activeLighting.cyclesKelvinKey}K to prevent saturation clipping on warm brick and tungsten window practicals.`,
        `Lock camera nodal origin to L.B. Jefferies's tripod (0, +14.5', +18.2') so the ${Number(splayDeg) >= 0 ? '+' : ''}${splayDeg}° trapezoidal wall cheat remains invisible.`
      ]
    };

    try {
      const liveCapture = captureLive3DViewportDataUrl();
      setRawViewportUrl(liveCapture);
      setBrief(fallbackLocalBrief);

      // 1. Synthesize the 1280x720 stylistic plate directly from the live 3D WebGL geometry & lighting framebuffer
      const localStylizedUrl = await synthesizeStylisticConceptPlateOnCanvas(
        liveCapture,
        styleToUse,
        selectedApartment,
        aptOverride,
        activeCameraPreset,
        activeLighting,
        jeffriesPbrMaterials
      );
      setConceptRenderUrl(localStylizedUrl);

      // 2. Request standalone server art-direction brief (optional, zero API keys required)
      const resp = await fetch('/api/generate-concept-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stylePreset: styleToUse,
          apartment: {
            id: selectedApartment.id,
            designation: selectedApartment.designation,
            name: selectedApartment.name,
            resident: selectedApartment.resident,
            floorLevel: selectedApartment.floorLevel,
            dimensionsFeet: selectedApartment.dimensionsFeet
          },
          parametricOverride: aptOverride,
          lighting: activeLighting,
          cameraPreset: activeCameraPreset,
          pbrMaterialNames: jeffriesPbrMaterials.map((m) => m.shortLabel)
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.brief) {
          setBrief(data.brief);
        }
      }
      setEngineBadge('Standalone WebGL Framebuffer + 1954 Stylistic Compositor (Zero API Keys)');
    } catch {
      setEngineBadge('Standalone WebGL Framebuffer + 1954 Stylistic Compositor (Zero API Keys)');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const runKey = `${selectedApartment.id}|${activeCameraPreset.id}|${activeLighting.id}|${selectedStyle}`;
    if (lastAutoRunKeyRef.current !== runKey) {
      lastAutoRunKeyRef.current = runKey;
      runConceptGeneration(selectedStyle);
    }
  }, [isOpen, selectedApartment.id, activeCameraPreset.id, activeLighting.id, selectedStyle]);

  if (!isOpen) return null;

  const handleDownloadConceptPng = () => {
    if (!conceptRenderUrl) return;
    const a = document.createElement('a');
    a.href = conceptRenderUrl;
    a.download = `Stage18_Concept_${selectedApartment.id}_${selectedStyle}.png`;
    a.click();
    setActionToast('Downloaded 1280×720 Conceptual Stylistic Reference Plate (.PNG)');
  };

  const handlePinToCurator = () => {
    if (!conceptRenderUrl || !onPinToFrameCurator) return;
    const presetMeta = STYLE_PRESETS.find((p) => p.id === selectedStyle)!;
    const newFrame: CuratedReferenceFrame = {
      id: `concept-${Date.now()}`,
      title: `[Concept Ref] ${selectedApartment.name} — ${presetMeta.shortTag}`,
      sourceType: 'web_archival_still',
      smpteTimecode: selectedApartment.remuxTimestamps[0] || '00:44:18:12',
      frameNumber: 63739,
      durationWindowSec: 2.0,
      useTemporalMedianStack: false,
      role: 'master_lighting_target',
      targetApartmentId: selectedApartment.id,
      focalLengthMm: activeCameraPreset.focalLengthMm,
      sampledKeyColorHex: activeLighting.sunColorHex,
      sampledShadowColorHex: activeLighting.groundHemiColorHex,
      kelvinEstimate: activeLighting.cyclesKelvinKey,
      sceneContext: brief?.artDirectionSummary || `${selectedApartment.designation} Stylistic Concept Reference`,
      architecturalFeatureHighlighted:
        brief?.forcedPerspectiveCallout ||
        `POV Scale ${(aptOverride.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2)}× · Wall Splay ${(aptOverride.cameraSightlineSplayDeg ?? 0).toFixed(1)}°`,
      lightingNotes:
        brief?.cinematographyLightingNotes ||
        `${activeLighting.shortLabel} (${activeLighting.cyclesKelvinKey}K · Sun ${activeLighting.sunElevationDeg}°)`,
      notes: brief?.blenderCyclesShaderTips?.join(' · ') || `Stylistic Concept Render (${presetMeta.label})`,
      includedInExport: true,
      customImageDataUrl: conceptRenderUrl
    };
    onPinToFrameCurator(newFrame, conceptRenderUrl);
    setActionToast(`Pinned "${newFrame.title}" to Frame Curator for team reference.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-6xl bg-[#0B0D11] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#12161F] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                  TEAM STYLISTIC REFERENCE GENERATOR
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {engineBadge}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white font-display">
                Conceptual Rendering Studio — {selectedApartment.name} ({selectedApartment.designation})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runConceptGeneration(selectedStyle)}
              disabled={isGenerating}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? 'Rendering Concept...' : 'Re-Render Current View'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 max-h-[calc(100vh-120px)] overflow-y-auto">
          {/* Style Preset Selector + View Mode Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#12161F] border border-white/10 rounded-xl p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                ART DIRECTION STYLE:
              </span>
              {STYLE_PRESETS.map((preset) => {
                const active = selectedStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedStyle(preset.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      active
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold shadow-sm'
                        : 'bg-[#0B0D11] text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {preset.shortTag}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setComparisonViewMode((prev) =>
                    prev === 'side_by_side' ? 'concept_only' : 'side_by_side'
                  )
                }
                className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0B0D11] text-slate-200 border border-white/15 hover:border-amber-400/50 flex items-center gap-1.5"
              >
                <Columns className="w-3.5 h-3.5 text-amber-400" />
                {comparisonViewMode === 'side_by_side'
                  ? 'Mode: 3D Geometry vs. Concept Split'
                  : 'Mode: Full-Width Concept Plate'}
              </button>
            </div>
          </div>

          {actionToast && (
            <div className="px-4 py-2.5 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionToast}</span>
            </div>
          )}

          {/* Visual Render Comparison Area */}
          <div
            className={`grid gap-4 ${
              comparisonViewMode === 'side_by_side' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'
            }`}
          >
            {comparisonViewMode === 'side_by_side' && (
              <div className="bg-[#12161F] border border-white/10 rounded-xl overflow-hidden flex flex-col">
                <div className="px-4 py-2.5 bg-[#0B0D11] border-b border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    SOURCE: LIVE 3D WORKBENCH GEOMETRY &amp; LIGHTING
                  </span>
                  <span className="text-slate-400">
                    {activeCameraPreset.focalLengthMm}mm · {activeLighting.cyclesKelvinKey}K
                  </span>
                </div>
                <div className="relative aspect-video bg-[#080A0E] flex items-center justify-center overflow-hidden">
                  {rawViewportUrl ? (
                    <img
                      src={rawViewportUrl}
                      alt="Raw 3D Workbench Geometry Capture"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-mono text-slate-500">
                      Capturing 3D WebGL Framebuffer...
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-[#12161F] border border-amber-500/40 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 bg-[#0B0D11] border-b border-amber-500/30 flex items-center justify-between text-xs font-mono">
                <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  CONCEPTUAL STYLISTIC REFERENCE RENDERING
                </span>
                <span className="text-emerald-300">
                  {STYLE_PRESETS.find((p) => p.id === selectedStyle)?.shortTag}
                </span>
              </div>
              <div className="relative aspect-video bg-[#080A0E] flex items-center justify-center overflow-hidden">
                {conceptRenderUrl ? (
                  <img
                    src={conceptRenderUrl}
                    alt="Conceptual Stylistic Reference Rendering"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs font-mono text-amber-300">
                    Synthesizing Conceptual Reference Plate...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Art Department & Cinematography Reference Brief */}
          {brief && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 bg-[#12161F] border border-white/10 rounded-xl p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-mono text-amber-400 font-semibold">
                    ART DEPARTMENT &amp; CINEMATOGRAPHY BRIEF
                  </span>
                  <span className="font-mono text-slate-400">{brief.conceptTitle}</span>
                </div>

                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-0.5">
                    Production Design &amp; Spatial Composition
                  </div>
                  <p className="text-slate-200 leading-relaxed">{brief.artDirectionSummary}</p>
                </div>

                <div>
                  <div className="text-[11px] font-mono text-slate-400 mb-0.5 flex items-center gap-1">
                    <Sun className="w-3 h-3 text-amber-400" />
                    Robert Burks ASC Lighting &amp; Exposure Key
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {brief.cinematographyLightingNotes}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-sky-500/30 font-mono text-[11px] text-sky-300">
                  {brief.forcedPerspectiveCallout}
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#12161F] border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-4 text-xs">
                <div className="space-y-2.5">
                  <div className="font-mono text-emerald-400 font-semibold border-b border-white/10 pb-2">
                    BLENDER 4.2 LOOK-DEV CHECKLIST FOR TEAM
                  </div>
                  <ul className="space-y-2 text-slate-300">
                    {brief.blenderCyclesShaderTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-snug">
                        <span className="text-amber-400 font-mono font-bold">0{idx + 1}.</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Team Export & Pin Actions */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadConceptPng}
                    className="flex-1 py-2 px-3 rounded-lg bg-amber-500 text-slate-950 font-semibold hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Concept PNG
                  </button>
                  {onPinToFrameCurator && (
                    <button
                      type="button"
                      onClick={handlePinToCurator}
                      className="flex-1 py-2 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 font-semibold transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      Pin to Frame Curator
                    </button>
                  )}
                  {onApplyLiveProjectionTo3D && conceptRenderUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyLiveProjectionTo3D(conceptRenderUrl);
                        setActionToast(
                          `Projected conceptual reference onto ${selectedApartment.name} in the 3D Workbench.`
                        );
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-[#0B0D11] text-slate-200 border border-white/15 hover:border-amber-400/50 font-medium transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5 text-amber-400" />
                      Project Concept Render onto 3D Stage Mesh
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
