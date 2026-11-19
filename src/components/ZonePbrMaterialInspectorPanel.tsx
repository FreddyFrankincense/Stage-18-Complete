import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BuildingParametricOverride,
  JeffriesPbrMaterialSpec,
  STAGE18_APARTMENTS,
  Stage18ApartmentUnit
} from '../data/stage18Data';
import {
  renderPbrShaderBallToCanvas,
  synthesizeJeffriesPbrMapsToCanvases
} from './JeffriesPbrMaterialLab';
import { computeReflectivityMetrics } from './JeffriesPbrMaterialSwatchGallery';
import {
  Box,
  CheckCircle2,
  Columns,
  Download,
  Eye,
  Film,
  Layers,
  Sliders,
  Sparkles,
  Sun
} from 'lucide-react';

export type ViewportGeometryShadingMode = 'pbr_textured' | 'clay_geometry' | 'wireframe_overlay';

interface ZonePbrMaterialInspectorPanelProps {
  selectedApartment: Stage18ApartmentUnit;
  onSelectApartment: (apt: Stage18ApartmentUnit) => void;
  aptOverride?: BuildingParametricOverride;
  jeffriesPbrMaterials: JeffriesPbrMaterialSpec[];
  onUpdateJeffriesPbrMaterials?: (updated: JeffriesPbrMaterialSpec[]) => void;
  selectedMaterialId?: string;
  onSelectMaterialId?: (id: string) => void;
  geometryShadingMode: ViewportGeometryShadingMode;
  onChangeGeometryShadingMode: (mode: ViewportGeometryShadingMode) => void;
  onOpenFullPbrStudio?: (materialId: string) => void;
  onCloseSplitView?: () => void;
}

/**
 * Generates zone-specific PBR material specifications for the 6 courtyard neighbor zones
 * so selecting any building in the 3D Workbench displays its authentic forced-perspective
 * brick, stucco, limestone, cast-iron, and window glass PBR texture maps.
 */
function getNeighborZonePbrMaterials(
  apt: Stage18ApartmentUnit,
  fpScale = 0.85
): JeffriesPbrMaterialSpec[] {
  const brickPitchIn = (2.67 * fpScale).toFixed(2);

  if (apt.id === 'apt-thorwald') {
    return [
      {
        id: 'thorwald_scenic_red_brick',
        blenderMaterialName: 'MAT_Thorwald_Scenic_Red_Brick_082x',
        name: `Scenic Molded Red-Brown Brick (${brickPitchIn}" Forced-Perspective Course Pitch)`,
        shortLabel: 'Scenic Red Brick (0.82×)',
        category: 'plaster',
        patternType: 'oak_parquet',
        targetThreeSlot: 'walls',
        targetBlenderMeshes: ['North_Thorwald_Tenement_Facade'],
        filmStillRef: {
          smpteTimecode: '00:07:19:10',
          frameNumber: 10528,
          focalLengthMm: 35,
          sceneTitle: 'Courtyard Daylight Sweep — North Tenement Masonry & Fire Escape',
          opticalObservation: `Hal Pereira compressed the brick course height to ${brickPitchIn}" (0.82x scale) with recessed charcoal-lime mortar joints and vertical rain-soot streaking beneath the 4 railroad window sills.`,
          lightingCondition: 'Direct Afternoon Courtyard Key (4800K) at 52° Elevation'
        },
        surfaceProperties: {
          baseColorHex: '#8B3A2B',
          secondaryColorHex: '#5E2419',
          accentColorHex: '#6B655E',
          roughness: 0.85,
          roughnessVariance: 0.12,
          metalness: 0.02,
          ior: 1.54,
          specularWeight: 0.32,
          clearcoatWeight: 0.0,
          clearcoatRoughness: 0.5,
          sheenWeight: 0.1,
          sheenRoughness: 0.7,
          transmissionWeight: 0.0,
          anisotropicWeight: 0.0,
          anisotropicRotation: 0.0,
          subsurfaceWeight: 0.0,
          subsurfaceRadiusMm: [0, 0, 0],
          bumpHeightMm: 3.2,
          normalStrength: 0.92,
          uvScale: 8.5,
          edgeWearFactor: 0.42
        },
        blenderOptimization: {
          bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
          shaderNodesUsed: [
            'ShaderNodeTexBrick (0.82x Z-Scaled Course Pitch)',
            'ShaderNodeAmbientOcclusion (Sill Soot Mask)',
            'ShaderNodeBump (3.2mm Mortar Recess)'
          ],
          cyclesOptimizationNotes:
            'Scales procedural brick Z-frequency by 1/0.82 so 152mm Kilfitt telephoto close-ups match the 4K remux brick count.',
          agxColorManagementNote: 'Preserves rich Eastmancolor terracotta reds without saturation clipping.',
          memoryFootprintNote: 'Procedural triplanar shader + 512px CanvasTexture in WebGL.'
        }
      },
      {
        id: 'thorwald_limestone_lintels',
        blenderMaterialName: 'MAT_Thorwald_Indiana_Limestone_Trim',
        name: 'Weathered Indiana Buff Limestone Window Lintels, Sills & Cornice',
        shortLabel: 'Limestone Lintels & Sills',
        category: 'plaster',
        patternType: 'sage_plaster',
        targetThreeSlot: 'mullions',
        targetBlenderMeshes: ['North_Cornice_Belt', 'Thorwald_Window_Sills'],
        filmStillRef: {
          smpteTimecode: '00:44:18:12',
          frameNumber: 63739,
          focalLengthMm: 152,
          sceneTitle: '152mm Telephoto Inspection of Thorwald Window Sill & Latch',
          opticalObservation:
            'Porous oolitic limestone sills with pitted micro-relief, chalky matte roughness (0.72), and dark urban soot accumulation along the top drip edge.',
          lightingCondition: 'Oblique Courtyard Sunlight + Skylight Bounce Fill'
        },
        surfaceProperties: {
          baseColorHex: '#D6D3D1',
          secondaryColorHex: '#A8A29E',
          accentColorHex: '#57534E',
          roughness: 0.72,
          roughnessVariance: 0.1,
          metalness: 0.0,
          ior: 1.48,
          specularWeight: 0.38,
          clearcoatWeight: 0.0,
          clearcoatRoughness: 0.5,
          sheenWeight: 0.12,
          sheenRoughness: 0.6,
          transmissionWeight: 0.0,
          anisotropicWeight: 0.0,
          anisotropicRotation: 0.0,
          subsurfaceWeight: 0.03,
          subsurfaceRadiusMm: [0.5, 0.4, 0.3],
          bumpHeightMm: 1.4,
          normalStrength: 0.65,
          uvScale: 6.0,
          edgeWearFactor: 0.35
        },
        blenderOptimization: {
          bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
          shaderNodesUsed: ['ShaderNodeTexNoise', 'ShaderNodeBevel', 'ShaderNodeBump'],
          cyclesOptimizationNotes: 'Uses procedural oolitic grain noise and bevel normal softening.',
          agxColorManagementNote: 'Neutral warm stone balance at 68% diffuse reflectance.',
          memoryFootprintNote: 'Zero bitmap VRAM overhead.'
        }
      },
      {
        id: 'thorwald_cast_iron_fire_escape',
        blenderMaterialName: 'MAT_Thorwald_Cast_Iron_Fire_Escape',
        name: 'Black Alkyd Enamel Cast-Iron Fire Escape Landings & Ladder',
        shortLabel: 'Cast-Iron Fire Escape',
        category: 'metal',
        patternType: 'chrome_vulcanite',
        targetThreeSlot: 'chrome_camera',
        targetBlenderMeshes: ['Thorwald_Fire_Escape_Balconies'],
        filmStillRef: {
          smpteTimecode: '01:28:05:14',
          frameNumber: 126720,
          focalLengthMm: 75,
          sceneTitle: 'Lisa Climbing the Cast-Iron Fire Escape into Thorwald Window',
          opticalObservation:
            'Heavy painted structural iron slats with semi-gloss black alkyd paint (Roughness 0.38, Metalness 0.82) and worn metallic highlights on the ladder rungs.',
          lightingCondition: 'Night Practical Window Spill (2850K) + Moonlight Sky Rim'
        },
        surfaceProperties: {
          baseColorHex: '#1E293B',
          secondaryColorHex: '#0F172A',
          accentColorHex: '#64748B',
          roughness: 0.38,
          roughnessVariance: 0.14,
          metalness: 0.82,
          ior: 2.1,
          specularWeight: 0.78,
          clearcoatWeight: 0.22,
          clearcoatRoughness: 0.25,
          sheenWeight: 0.0,
          sheenRoughness: 0.5,
          transmissionWeight: 0.0,
          anisotropicWeight: 0.35,
          anisotropicRotation: 0.0,
          subsurfaceWeight: 0.0,
          subsurfaceRadiusMm: [0, 0, 0],
          bumpHeightMm: 1.1,
          normalStrength: 0.6,
          uvScale: 10.0,
          edgeWearFactor: 0.3
        },
        blenderOptimization: {
          bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
          shaderNodesUsed: ['ShaderNodeAmbientOcclusion', 'ShaderNodeTexVoronoi', 'ShaderNodeBsdfPrincipled'],
          cyclesOptimizationNotes: 'Pointiness edge wear exposes raw wrought iron on step treads.',
          agxColorManagementNote: 'Maintains deep shadow detail under night lighting.',
          memoryFootprintNote: 'Shared procedural iron material across all fire escape tiers.'
        }
      },
      {
        id: 'thorwald_floral_wallpaper_glass',
        blenderMaterialName: 'MAT_Thorwald_Railroad_Window_Glass',
        name: '1950s Cylinder Sash Glass & Warm Amber Interior Practical Glow',
        shortLabel: 'Sash Glass & Interior Glow',
        category: 'glass',
        patternType: 'crown_glass',
        targetThreeSlot: 'glass',
        targetBlenderMeshes: ['Thorwald_Sash_Window_Panes'],
        filmStillRef: {
          smpteTimecode: '00:26:40:00',
          frameNumber: 38361,
          focalLengthMm: 152,
          sceneTitle: 'Night Stakeout — Thorwald Bedroom & Hallway Practical Lamps',
          opticalObservation:
            'Recessed double-hung glass panes with 2950K tungsten practical emission and subtle wavy reflection of the courtyard.',
          lightingCondition: '2950K Interior Tungsten Practicals'
        },
        surfaceProperties: {
          baseColorHex: '#FDE68A',
          secondaryColorHex: '#92400E',
          accentColorHex: '#FFFFFF',
          roughness: 0.12,
          roughnessVariance: 0.06,
          metalness: 0.05,
          ior: 1.517,
          specularWeight: 0.62,
          clearcoatWeight: 0.25,
          clearcoatRoughness: 0.08,
          sheenWeight: 0.0,
          sheenRoughness: 0.5,
          transmissionWeight: 0.78,
          anisotropicWeight: 0.0,
          anisotropicRotation: 0.0,
          subsurfaceWeight: 0.0,
          subsurfaceRadiusMm: [0, 0, 0],
          bumpHeightMm: 0.2,
          normalStrength: 0.22,
          uvScale: 3.0,
          edgeWearFactor: 0.2
        },
        blenderOptimization: {
          bsdfVersion: 'Principled BSDF v2 + Light Path Bypass',
          shaderNodesUsed: ['ShaderNodeLightPath', 'ShaderNodeBsdfTransparent', 'ShaderNodeBsdfPrincipled'],
          cyclesOptimizationNotes: 'Allows Thorwald 2950K interior point lights to illuminate the courtyard without glass caustics noise.',
          agxColorManagementNote: 'Warm amber practical glow calibrated for AgX.',
          memoryFootprintNote: 'Single-pass transparent shadow shader.'
        }
      }
    ];
  }

  // Generic neighbor zone material stack tailored to West Wing, East Studio, Basement, or Alley
  const isEast = apt.id === 'apt-composer';
  const isSculptor = apt.id === 'apt-sculptor';
  return [
    {
      id: `${apt.id}_primary_facade`,
      blenderMaterialName: `MAT_${apt.id.replace('apt-', '').toUpperCase()}_Facade_Masonry`,
      name: isEast
        ? 'East Wing Painted Cream-Grey Stucco & Masonry Facade'
        : isSculptor
        ? 'Excavated Stage 18 Sub-Floor Poured Concrete & Garden Retaining Wall'
        : `West Wing Buff-Cream Brick Facade (${brickPitchIn}" Course Pitch)`,
      shortLabel: isEast ? 'Cream-Grey Stucco' : isSculptor ? 'Excavated Concrete' : 'Buff-Cream Brick',
      category: 'plaster',
      patternType: isEast || isSculptor ? 'sage_plaster' : 'oak_parquet',
      targetThreeSlot: 'walls',
      targetBlenderMeshes: [apt.designation],
      filmStillRef: {
        smpteTimecode: apt.remuxTimestamps[0] || '00:02:28:00',
        frameNumber: 3548,
        focalLengthMm: apt.focalLengthRef || 75,
        sceneTitle: `${apt.name} — Exterior Facade & Forced-Perspective Calibration`,
        opticalObservation:
          apt.materialsAndFinishes[0] ||
          `Forced-perspective scenic masonry scaled to ${fpScale.toFixed(2)}x relative to L.B. Jefferies's camera tripod.`,
        lightingCondition: 'Stage 18 Rigged Daylight & Practical Fill'
      },
      surfaceProperties: {
        baseColorHex: isEast ? '#78716C' : isSculptor ? '#3F3F46' : '#A6835A',
        secondaryColorHex: isEast ? '#57534E' : isSculptor ? '#27272A' : '#78716C',
        accentColorHex: '#D6D3D1',
        roughness: isEast ? 0.78 : isSculptor ? 0.88 : 0.8,
        roughnessVariance: 0.11,
        metalness: 0.04,
        ior: 1.5,
        specularWeight: 0.35,
        clearcoatWeight: 0.0,
        clearcoatRoughness: 0.5,
        sheenWeight: 0.1,
        sheenRoughness: 0.6,
        transmissionWeight: 0.0,
        anisotropicWeight: 0.0,
        anisotropicRotation: 0.0,
        subsurfaceWeight: 0.0,
        subsurfaceRadiusMm: [0, 0, 0],
        bumpHeightMm: 2.1,
        normalStrength: 0.75,
        uvScale: 7.0,
        edgeWearFactor: 0.3
      },
      blenderOptimization: {
        bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
        shaderNodesUsed: ['ShaderNodeTexBrick', 'ShaderNodeTexNoise', 'ShaderNodeBump'],
        cyclesOptimizationNotes: `Calibrated for ${fpScale.toFixed(2)}x forced-perspective scale at ${apt.floorLevel}.`,
        agxColorManagementNote: 'Balanced mid-tone diffuse albedo for courtyard bounce.',
        memoryFootprintNote: 'Procedural triplanar mapping.'
      }
    },
    {
      id: `${apt.id}_interior_finish`,
      blenderMaterialName: `MAT_${apt.id.replace('apt-', '').toUpperCase()}_Hero_Interior`,
      name: apt.materialsAndFinishes[1] || 'Scenic Splayed Interior Wall & Set Dressing Shader',
      shortLabel: isEast ? 'Grand Piano Lacquer & Slate' : 'Interior Walls & Trim',
      category: isEast ? 'wood' : 'fabric',
      patternType: isEast ? 'painted_mullion' : 'wool_boucle',
      targetThreeSlot: 'mullions',
      targetBlenderMeshes: [`${apt.id}_Interior_Walls`],
      filmStillRef: {
        smpteTimecode: apt.remuxTimestamps[1] || apt.remuxTimestamps[0] || '00:22:10:04',
        frameNumber: 31888,
        focalLengthMm: apt.focalLengthRef || 75,
        sceneTitle: `${apt.name} — Splayed Interior Room & Set Dressing`,
        opticalObservation:
          apt.materialsAndFinishes[2] ||
          apt.materialsAndFinishes[1] ||
          'Splayed interior room surfaces painted for high contrast through window casements.',
        lightingCondition: 'Interior Practical Tungsten + Window Rim'
      },
      surfaceProperties: {
        baseColorHex: isEast ? '#1E3A8A' : '#9D174D',
        secondaryColorHex: isEast ? '#0F172A' : '#831843',
        accentColorHex: '#FDE68A',
        roughness: isEast ? 0.08 : 0.68,
        roughnessVariance: 0.08,
        metalness: isEast ? 0.15 : 0.0,
        ior: 1.52,
        specularWeight: isEast ? 0.92 : 0.4,
        clearcoatWeight: isEast ? 0.95 : 0.1,
        clearcoatRoughness: 0.05,
        sheenWeight: isEast ? 0.0 : 0.55,
        sheenRoughness: 0.45,
        transmissionWeight: 0.0,
        anisotropicWeight: 0.0,
        anisotropicRotation: 0.0,
        subsurfaceWeight: 0.0,
        subsurfaceRadiusMm: [0, 0, 0],
        bumpHeightMm: 0.75,
        normalStrength: 0.45,
        uvScale: 5.0,
        edgeWearFactor: 0.2
      },
      blenderOptimization: {
        bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
        shaderNodesUsed: ['ShaderNodeBsdfPrincipled', 'ShaderNodeBump'],
        cyclesOptimizationNotes: 'Optimized for interior shadowbox sightlines from Jeffries nodal point.',
        agxColorManagementNote: 'Technicolor dye-transfer interior contrast profile.',
        memoryFootprintNote: 'Lightweight procedural shader.'
      }
    }
  ];
}

export default function ZonePbrMaterialInspectorPanel({
  selectedApartment,
  onSelectApartment,
  aptOverride,
  jeffriesPbrMaterials,
  onUpdateJeffriesPbrMaterials,
  selectedMaterialId,
  onSelectMaterialId,
  geometryShadingMode,
  onChangeGeometryShadingMode,
  onOpenFullPbrStudio,
  onCloseSplitView
}: ZonePbrMaterialInspectorPanelProps) {
  const isJeffriesZone = selectedApartment.id === 'apt-jeffries';

  const zoneMaterials = useMemo(() => {
    if (isJeffriesZone) {
      return jeffriesPbrMaterials;
    }
    return getNeighborZonePbrMaterials(
      selectedApartment,
      aptOverride?.forcedPerspectiveScaleFactor ?? 0.85
    );
  }, [isJeffriesZone, jeffriesPbrMaterials, selectedApartment, aptOverride]);

  const [localSelectedMatId, setLocalSelectedMatId] = useState<string>(
    selectedMaterialId || zoneMaterials[0]?.id || ''
  );
  const [soloChannel, setSoloChannel] = useState<
    'all_four' | 'albedo' | 'roughness' | 'normal' | 'bump'
  >('all_four');
  const [lightAngleDeg, setLightAngleDeg] = useState<number>(36);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMaterialId && zoneMaterials.some((m) => m.id === selectedMaterialId)) {
      setLocalSelectedMatId(selectedMaterialId);
    } else if (zoneMaterials[0]) {
      setLocalSelectedMatId(zoneMaterials[0].id);
    }
  }, [selectedMaterialId, zoneMaterials]);

  const activeMaterial = useMemo(() => {
    return zoneMaterials.find((m) => m.id === localSelectedMatId) || zoneMaterials[0];
  }, [zoneMaterials, localSelectedMatId]);

  const albedoRef = useRef<HTMLCanvasElement | null>(null);
  const roughRef = useRef<HTMLCanvasElement | null>(null);
  const normalRef = useRef<HTMLCanvasElement | null>(null);
  const bumpRef = useRef<HTMLCanvasElement | null>(null);
  const shaderBallRef = useRef<HTMLCanvasElement | null>(null);

  const handleSelectMaterial = (mat: JeffriesPbrMaterialSpec) => {
    setLocalSelectedMatId(mat.id);
    if (onSelectMaterialId) {
      onSelectMaterialId(mat.id);
    }
  };

  const handleUpdateSurfaceProperty = <
    K extends keyof JeffriesPbrMaterialSpec['surfaceProperties']
  >(
    key: K,
    val: JeffriesPbrMaterialSpec['surfaceProperties'][K]
  ) => {
    if (!isJeffriesZone || !onUpdateJeffriesPbrMaterials || !activeMaterial) return;
    const next = jeffriesPbrMaterials.map((m) =>
      m.id === activeMaterial.id
        ? {
            ...m,
            surfaceProperties: {
              ...m.surfaceProperties,
              [key]: val
            }
          }
        : m
    );
    onUpdateJeffriesPbrMaterials(next);
  };

  const handleExportActiveMaps = () => {
    if (!activeMaterial) return;
    const maps = synthesizeJeffriesPbrMapsToCanvases(activeMaterial, 512);
    const items = [
      { c: maps.albedoCanvas, suffix: 'BaseColor_sRGB' },
      { c: maps.roughnessCanvas, suffix: 'Roughness_Linear' },
      { c: maps.normalCanvas, suffix: 'Normal_OpenGL' },
      { c: maps.bumpCanvas, suffix: 'Height_Bump_mm' }
    ];
    items.forEach((item, idx) => {
      window.setTimeout(() => {
        const a = document.createElement('a');
        a.href = item.c.toDataURL('image/png');
        a.download = `${activeMaterial.blenderMaterialName}_${item.suffix}.png`;
        a.click();
      }, idx * 130);
    });
    setExportNotice(`Exported 4 PBR PNG maps for ${activeMaterial.shortLabel}`);
    window.setTimeout(() => setExportNotice(null), 2800);
  };

  // Synthesize the 4 PBR texture canvases + live 3D shader ball whenever activeMaterial or lightAngleDeg changes
  useEffect(() => {
    if (!activeMaterial) return;
    const res = 220;
    const maps = synthesizeJeffriesPbrMapsToCanvases(activeMaterial, res);

    const drawTo = (src: HTMLCanvasElement, dst: HTMLCanvasElement | null) => {
      if (!dst) return;
      dst.width = res;
      dst.height = res;
      const ctx = dst.getContext('2d');
      if (ctx) ctx.drawImage(src, 0, 0);
    };

    drawTo(maps.albedoCanvas, albedoRef.current);
    drawTo(maps.roughnessCanvas, roughRef.current);
    drawTo(maps.normalCanvas, normalRef.current);
    drawTo(maps.bumpCanvas, bumpRef.current);

    renderPbrShaderBallToCanvas(shaderBallRef.current, activeMaterial, {
      size: 160,
      mapResolution: res,
      lightAzimuthDeg: lightAngleDeg,
      lightElevationDeg: 40,
      outerRingMode: 'studio_vignette'
    });
  }, [activeMaterial, lightAngleDeg, soloChannel]);

  if (!activeMaterial) return null;
  const sp = activeMaterial.surfaceProperties;
  const refl = computeReflectivityMetrics(sp);

  return (
    <aside
      aria-label="Zone Material Inspector Side-by-Side Panel"
      className="w-full lg:w-[460px] xl:w-[510px] h-full bg-[#12161F] border-l border-white/15 flex flex-col overflow-hidden shrink-0 select-none z-20"
    >
      {/* Top Inspector Header */}
      <div className="px-4 py-3 bg-[#0B0D11] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Columns className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
              LIVE SIDE-BY-SIDE 3D GEOMETRY &amp; MATERIAL INSPECTOR
            </span>
          </div>
          <h2 className="text-sm font-bold text-white font-display truncate mt-0.5">
            {selectedApartment.designation} · {selectedApartment.name}
          </h2>
        </div>

        {onCloseSplitView && (
          <button
            onClick={onCloseSplitView}
            className="px-2.5 py-1 text-[11px] font-mono rounded bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white transition-colors shrink-0"
            title="Collapse Side-by-Side Material Inspector"
          >
            Full 3D View →
          </button>
        )}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* 1. 3D Geometry vs. PBR Shading Comparison Bar */}
        <div className="p-3 rounded-xl bg-[#0B0D11] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-sky-400" />
              LEFT 3D VIEWPORT GEOMETRY MODE
            </span>
            <span className="text-[10px] font-mono text-emerald-400">Live WebGL Sync</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'pbr_textured', label: 'Full PBR Textured' },
                { id: 'clay_geometry', label: 'Clay Massing' },
                { id: 'wireframe_overlay', label: 'PBR + Wireframe' }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => onChangeGeometryShadingMode(m.id)}
                className={`py-1.5 px-2 rounded-lg font-mono text-[11px] transition-colors ${
                  geometryShadingMode === m.id
                    ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                    : 'bg-[#12161F] text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Selected Architectural Zone Switcher Strip */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>INSPECTING STAGE 18 ZONE:</span>
            <span className="text-amber-300">
              POV Scale {(aptOverride?.forcedPerspectiveScaleFactor ?? 1.0).toFixed(2)}× · Splay{' '}
              {(aptOverride?.cameraSightlineSplayDeg ?? 0) >= 0 ? '+' : ''}
              {(aptOverride?.cameraSightlineSplayDeg ?? 0).toFixed(1)}°
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {STAGE18_APARTMENTS.map((apt) => {
              const isSelected = apt.id === selectedApartment.id;
              return (
                <button
                  key={apt.id}
                  onClick={() => onSelectApartment(apt)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono whitespace-nowrap shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-[#0B0D11] text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {apt.id === 'apt-jeffries' ? '★ Jeffries #2B (8 PBR)' : apt.name.split("'s")[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Zone Material Selector Swatches */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-300 font-semibold">
              APPLIED PBR MATERIALS ({zoneMaterials.length})
            </span>
            <button
              onClick={handleExportActiveMaps}
              className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-mono text-[10px] font-semibold flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Export 4 Maps (.png)
            </button>
          </div>

          {exportNotice && (
            <div className="px-3 py-1.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{exportNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            {zoneMaterials.map((mat) => {
              const isAct = mat.id === activeMaterial.id;
              const matRefl = computeReflectivityMetrics(mat.surfaceProperties);
              return (
                <button
                  key={mat.id}
                  onClick={() => handleSelectMaterial(mat)}
                  className={`p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                    isAct
                      ? 'bg-amber-500/15 border-amber-400 shadow-sm'
                      : 'bg-[#0B0D11] border-white/10 hover:border-white/25'
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded border border-white/20 shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${mat.surfaceProperties.baseColorHex} 55%, ${mat.surfaceProperties.secondaryColorHex} 100%)`
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-white truncate">
                      {mat.shortLabel}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 tabular-nums truncate">
                      R:{mat.surfaceProperties.roughness.toFixed(2)} · Refl:{matRefl.effectiveReflectivityPercent}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Active Material Shader Ball + Roughness & Reflectivity Readout */}
        <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-white/10 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-mono text-amber-400 truncate">
                {activeMaterial.blenderMaterialName}
              </div>
              <h3 className="text-xs font-bold text-white leading-snug mt-0.5">
                {activeMaterial.name}
              </h3>
            </div>
            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono uppercase text-slate-200 shrink-0">
              {activeMaterial.category}
            </span>
          </div>

          <div className="grid grid-cols-12 gap-3 items-center">
            {/* Live Shaded PBR Sphere */}
            <div className="col-span-5 flex flex-col items-center bg-[#12161F] border border-white/10 rounded-lg p-2">
              <canvas
                ref={shaderBallRef}
                className="w-28 h-28 rounded border border-white/10"
              />
              <div className="w-full mt-1.5">
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span className="flex items-center gap-0.5">
                    <Sun className="w-2.5 h-2.5 text-amber-400" />
                    Key Angle
                  </span>
                  <span className="text-slate-200 tabular-nums">{lightAngleDeg}°</span>
                </div>
                <input
                  type="range"
                  min={-75}
                  max={75}
                  value={lightAngleDeg}
                  onChange={(e) => setLightAngleDeg(Number(e.target.value))}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer mt-0.5"
                />
              </div>
            </div>

            {/* Roughness, Reflectivity, Bump & IOR Telemetry Cards */}
            <div className="col-span-7 space-y-2 font-mono text-[10px] tabular-nums">
              <div className="p-2 rounded-lg bg-[#12161F] border border-white/5">
                <div className="flex justify-between text-slate-400">
                  <span>SURFACE ROUGHNESS</span>
                  <span className="text-sky-300 font-bold">{sp.roughness.toFixed(2)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${Math.round(sp.roughness * 100)}%` }}
                  />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  Micro-Variance ±{sp.roughnessVariance.toFixed(2)} · Coat {sp.clearcoatWeight.toFixed(2)}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#12161F] border border-white/5">
                <div className="flex justify-between text-slate-400">
                  <span>SURFACE REFLECTIVITY</span>
                  <span className="text-amber-300 font-bold">
                    {refl.effectiveReflectivityPercent}% (F0 {refl.f0Percent}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${refl.effectiveReflectivityPercent}%` }}
                  />
                </div>
                <div className="text-[9px] text-slate-400 mt-0.5">
                  {refl.specularLabel} · Sheen {sp.sheenWeight.toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                <div className="p-1.5 rounded bg-[#12161F] border border-white/5">
                  <span className="text-slate-400 block">BUMP RELIEF</span>
                  <span className="text-emerald-300 font-semibold">{sp.bumpHeightMm.toFixed(2)} mm</span>
                </div>
                <div className="p-1.5 rounded bg-[#12161F] border border-white/5">
                  <span className="text-slate-400 block">NORMAL STRENGTH</span>
                  <span className="text-indigo-300 font-semibold">{sp.normalStrength.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 5. 4-Channel PBR Texture Maps Grid (with Channel Solo / Loupe Selector) */}
        <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-mono text-white font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              SYNTHESIZED PBR TEXTURE MAPS
            </span>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all_four', label: '2×2 Grid' },
                  { id: 'albedo', label: 'Albedo' },
                  { id: 'roughness', label: 'Rough' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'bump', label: 'Bump' }
                ] as const
              ).map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSoloChannel(ch.id)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                    soloChannel === ch.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-[#12161F] text-slate-400 hover:text-white border border-white/10'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`grid ${
              soloChannel === 'all_four' ? 'grid-cols-2' : 'grid-cols-1'
            } gap-2.5`}
          >
            {(soloChannel === 'all_four' || soloChannel === 'albedo') && (
              <div className="p-2 rounded-lg bg-[#12161F] border border-white/10">
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-amber-300 font-semibold">1. ALBEDO (sRGB)</span>
                  <span className="text-slate-400">{sp.baseColorHex}</span>
                </div>
                <canvas
                  ref={albedoRef}
                  className="w-full aspect-square rounded border border-white/10"
                />
              </div>
            )}

            {(soloChannel === 'all_four' || soloChannel === 'roughness') && (
              <div className="p-2 rounded-lg bg-[#12161F] border border-white/10">
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-sky-300 font-semibold">2. ROUGHNESS (Linear)</span>
                  <span className="text-slate-400">R={sp.roughness.toFixed(2)}</span>
                </div>
                <canvas
                  ref={roughRef}
                  className="w-full aspect-square rounded border border-white/10"
                />
              </div>
            )}

            {(soloChannel === 'all_four' || soloChannel === 'normal') && (
              <div className="p-2 rounded-lg bg-[#12161F] border border-white/10">
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-indigo-300 font-semibold">3. NORMAL (OpenGL +Y)</span>
                  <span className="text-slate-400">Str {sp.normalStrength.toFixed(2)}</span>
                </div>
                <canvas
                  ref={normalRef}
                  className="w-full aspect-square rounded border border-white/10"
                />
              </div>
            )}

            {(soloChannel === 'all_four' || soloChannel === 'bump') && (
              <div className="p-2 rounded-lg bg-[#12161F] border border-white/10">
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-emerald-300 font-semibold">4. HEIGHT / BUMP</span>
                  <span className="text-slate-400">{sp.bumpHeightMm.toFixed(2)} mm</span>
                </div>
                <canvas
                  ref={bumpRef}
                  className="w-full aspect-square rounded border border-white/10"
                />
              </div>
            )}
          </div>
        </div>

        {/* 6. Live Surface Calibration Sliders (for Jeffries Hero Materials) + Film-Still Provenance */}
        {isJeffriesZone && onUpdateJeffriesPbrMaterials && (
          <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-white/10 space-y-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between text-white font-semibold">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                LIVE PBR SURFACE TUNING
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Updates 3D Pane
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>Roughness</span>
                  <span className="text-sky-300 tabular-nums">{sp.roughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.98}
                  step={0.01}
                  value={sp.roughness}
                  onChange={(e) => handleUpdateSurfaceProperty('roughness', Number(e.target.value))}
                  className="w-full accent-sky-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>Specular IOR</span>
                  <span className="text-amber-300 tabular-nums">{sp.ior.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={1.3}
                  max={2.5}
                  step={0.01}
                  value={sp.ior}
                  onChange={(e) => handleUpdateSurfaceProperty('ior', Number(e.target.value))}
                  className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>Bump Depth</span>
                  <span className="text-emerald-300 tabular-nums">{sp.bumpHeightMm.toFixed(2)}mm</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={3.5}
                  step={0.05}
                  value={sp.bumpHeightMm}
                  onChange={(e) =>
                    handleUpdateSurfaceProperty('bumpHeightMm', Number(e.target.value))
                  }
                  className="w-full accent-emerald-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>Coat / Sheen</span>
                  <span className="text-indigo-300 tabular-nums">
                    {Math.max(sp.clearcoatWeight, sp.sheenWeight).toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={
                    activeMaterial.category === 'fabric' ? sp.sheenWeight : sp.clearcoatWeight
                  }
                  onChange={(e) =>
                    handleUpdateSurfaceProperty(
                      activeMaterial.category === 'fabric' ? 'sheenWeight' : 'clearcoatWeight',
                      Number(e.target.value)
                    )
                  }
                  className="w-full accent-indigo-400 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. 1954 4K Remux Film-Still Provenance Card */}
        <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-amber-500/25 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <Film className="w-3 h-3" />
              FILM-STILL OPTICAL EVIDENCE
            </span>
            <span className="text-slate-300 tabular-nums">
              SMPTE {activeMaterial.filmStillRef.smpteTimecode} ·{' '}
              {activeMaterial.filmStillRef.focalLengthMm}mm
            </span>
          </div>
          <div className="text-xs font-semibold text-white">
            {activeMaterial.filmStillRef.sceneTitle}
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {activeMaterial.filmStillRef.opticalObservation}
          </p>
        </div>

        {onOpenFullPbrStudio && (
          <button
            onClick={() => onOpenFullPbrStudio(activeMaterial.id)}
            className="w-full py-2 px-3 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Expand Full-Screen 8-Shader PBR Studio
          </button>
        )}
      </div>
    </aside>
  );
}
