import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  JeffriesPbrCategory,
  JeffriesPbrMaterialSpec
} from '../data/stage18Data';
import {
  renderPbrShaderBallToCanvas,
  synthesizeJeffriesPbrMapsToCanvases
} from './JeffriesPbrMaterialLab';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Grid,
  Sliders,
  Sparkles
} from 'lucide-react';

interface JeffriesPbrMaterialSwatchGalleryProps {
  materials: JeffriesPbrMaterialSpec[];
  selectedMaterialId?: string;
  onSelectMaterial?: (material: JeffriesPbrMaterialSpec) => void;
  onUpdateMaterialProperty?: (
    materialId: string,
    updates: Partial<JeffriesPbrMaterialSpec['surfaceProperties']>
  ) => void;
  onOpenFullPbrStudio?: (materialId: string) => void;
  onFocusJeffriesApartmentIn3D?: () => void;
  defaultExpanded?: boolean;
}

/**
 * Computes physical normal-incidence Fresnel reflectance F0 (%) blended with metallic reflectance
 * and clearcoat contribution for display in the PBR swatch gallery.
 */
export function computeReflectivityMetrics(sp: JeffriesPbrMaterialSpec['surfaceProperties']): {
  f0Percent: number;
  effectiveReflectivityPercent: number;
  specularLabel: string;
} {
  const dielectricF0 = Math.pow((sp.ior - 1) / (sp.ior + 1), 2);
  // Blend dielectric F0 (~2%-18%) with metallic specular reflectance (~88% for chrome/brass)
  const baseF0 = dielectricF0 * (1 - sp.metalness) + 0.88 * sp.metalness;
  const f0Percent = Number((baseF0 * 100).toFixed(1));

  // Effective perceived surface reflectivity accounting for specular weight, clearcoat, and smoothness (1 - roughness)
  const smoothness = 1 - sp.roughness;
  const effective = Math.min(
    99,
    Math.max(
      2,
      Math.round(
        (baseF0 * 55 +
          sp.specularWeight * smoothness * 38 +
          sp.clearcoatWeight * (1 - sp.clearcoatRoughness) * 22) *
          100 *
          0.01
      )
    )
  );

  const specularLabel =
    sp.metalness >= 0.5
      ? `Metallic ${(sp.metalness * 100).toFixed(0)}%`
      : sp.clearcoatWeight >= 0.2
      ? `Coat ${(sp.clearcoatWeight * 100).toFixed(0)}% · IOR ${sp.ior.toFixed(2)}`
      : sp.transmissionWeight >= 0.5
      ? `Trans ${(sp.transmissionWeight * 100).toFixed(0)}% · IOR ${sp.ior.toFixed(3)}`
      : `Spec ${(sp.specularWeight * 100).toFixed(0)}% · IOR ${sp.ior.toFixed(2)}`;

  return {
    f0Percent,
    effectiveReflectivityPercent: effective,
    specularLabel
  };
}

interface SwatchCanvasPreviewProps {
  material: JeffriesPbrMaterialSpec;
}

function SwatchCanvasPreview({ material }: SwatchCanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    renderPbrShaderBallToCanvas(canvasRef.current, material, {
      size: 96,
      mapResolution: 96,
      lightAzimuthDeg: -30,
      lightElevationDeg: 38,
      outerRingMode: 'albedo_tile'
    });
  }, [material]);

  return (
    <canvas
      ref={canvasRef}
      className="w-14 h-14 rounded-lg border border-white/15 shrink-0 shadow-inner"
      title={`${material.name} — Live 3D Sphere + 2D Texture Tile Swatch`}
    />
  );
}

export default function JeffriesPbrMaterialSwatchGallery({
  materials,
  selectedMaterialId,
  onSelectMaterial,
  onUpdateMaterialProperty,
  onOpenFullPbrStudio,
  onFocusJeffriesApartmentIn3D,
  defaultExpanded = false
}: JeffriesPbrMaterialSwatchGalleryProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
  const [categoryFilter, setCategoryFilter] = useState<'all' | JeffriesPbrCategory>('all');
  const [editingSwatchId, setEditingSwatchId] = useState<string | null>(null);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const filteredMaterials = useMemo(() => {
    if (categoryFilter === 'all') return materials;
    return materials.filter((m) => m.category === categoryFilter);
  }, [materials, categoryFilter]);

  const handleQuickExportSwatchPng = (mat: JeffriesPbrMaterialSpec, e: React.MouseEvent) => {
    e.stopPropagation();
    const maps = synthesizeJeffriesPbrMapsToCanvases(mat, 512);
    const a = document.createElement('a');
    a.href = maps.albedoCanvas.toDataURL('image/png');
    a.download = `${mat.blenderMaterialName}_BaseColor_sRGB.png`;
    a.click();
  };

  return (
    <section
      aria-label="Jeffries Apartment PBR Material Swatch Gallery"
      className="w-80 sm:w-88 bg-[#12161F]/95 border border-white/15 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
    >
      {/* Header Bar */}
      <div className="px-3.5 py-2.5 bg-[#0B0D11]/90 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Grid className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-white font-display truncate">
              Jeffries PBR Material Gallery ({materials.length})
            </h3>
            <p className="text-[10px] font-mono text-slate-400 truncate">
              APT 2B Swatches · Roughness &amp; Reflectivity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onFocusJeffriesApartmentIn3D && (
            <button
              onClick={onFocusJeffriesApartmentIn3D}
              className="px-2 py-1 text-[10px] font-mono font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
              title="Aim 3D Viewport at L.B. Jefferies's Apartment (#2B)"
            >
              <Eye className="w-3 h-3" />
              APT 2B
            </button>
          )}
          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/5 transition-colors"
            title={isExpanded ? 'Collapse PBR Swatch Gallery' : 'Expand PBR Swatch Gallery'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2.5">
          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {(
              [
                { id: 'all', label: 'All (8)' },
                { id: 'wood', label: 'Wood (3)' },
                { id: 'plaster', label: 'Plaster (2)' },
                { id: 'glass', label: 'Glass' },
                { id: 'fabric', label: 'Fabric' },
                { id: 'metal', label: 'Metal' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  categoryFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-[#0B0D11] text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable Swatch Cards List */}
          <div className="max-h-[calc(100vh-380px)] overflow-y-auto space-y-2 pr-0.5">
            {filteredMaterials.map((mat) => {
              const sp = mat.surfaceProperties;
              const refl = computeReflectivityMetrics(sp);
              const isSelected = selectedMaterialId === mat.id;
              const isInlineEditing = editingSwatchId === mat.id;

              return (
                <div
                  key={mat.id}
                  onClick={() => onSelectMaterial && onSelectMaterial(mat)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400/70 shadow-md'
                      : 'bg-[#0B0D11]/90 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Live Shaded 3D Swatch Sphere + 2D Texture Tile */}
                    <SwatchCanvasPreview material={mat} />

                    {/* Swatch Metadata + Roughness & Reflectivity Telemetry */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">
                              {mat.shortLabel}
                            </span>
                            <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase rounded bg-white/10 text-slate-300 shrink-0">
                              {mat.category}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            SMPTE {mat.filmStillRef.smpteTimecode} · Bump {sp.bumpHeightMm.toFixed(2)}mm
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSwatchId((prev) => (prev === mat.id ? null : mat.id));
                            }}
                            className={`p-1 rounded border text-[10px] transition-colors ${
                              isInlineEditing
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-[#12161F] text-slate-300 border-white/10 hover:text-white'
                            }`}
                            title="Quick-Tune Roughness & Reflectivity"
                          >
                            <Sliders className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleQuickExportSwatchPng(mat, e)}
                            className="p-1 rounded bg-[#12161F] text-slate-300 border border-white/10 hover:text-amber-300 transition-colors"
                            title="Download Albedo PNG Map"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Roughness & Reflectivity Bar Readouts */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5 font-mono text-[10px] tabular-nums">
                        {/* Roughness Meter */}
                        <div className="p-1.5 rounded bg-[#12161F] border border-white/5">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>ROUGHNESS</span>
                            <span className="text-sky-300 font-semibold">
                              {sp.roughness.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-sky-400 rounded-full"
                              style={{ width: `${Math.round(sp.roughness * 100)}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                            Var ±{sp.roughnessVariance.toFixed(2)}
                          </div>
                        </div>

                        {/* Reflectivity Meter */}
                        <div className="p-1.5 rounded bg-[#12161F] border border-white/5">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>REFLECTIVITY</span>
                            <span className="text-amber-300 font-semibold">
                              {refl.effectiveReflectivityPercent}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${refl.effectiveReflectivityPercent}%` }}
                            />
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5 truncate">
                            F0 {refl.f0Percent}% · {refl.specularLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Optional Inline Roughness & Reflectivity Micro-Sliders */}
                  {isInlineEditing && onUpdateMaterialProperty && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2.5 pt-2 border-t border-white/10 space-y-2 text-[10px] font-mono"
                    >
                      <div>
                        <div className="flex justify-between text-slate-300 mb-0.5">
                          <span>Tune Surface Roughness</span>
                          <span className="text-sky-300 tabular-nums">{sp.roughness.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.02}
                          max={0.98}
                          step={0.01}
                          value={sp.roughness}
                          onChange={(e) =>
                            onUpdateMaterialProperty(mat.id, {
                              roughness: Number(e.target.value)
                            })
                          }
                          className="w-full accent-sky-400 h-1 bg-slate-800 rounded cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-300 mb-0.5">
                          <span>Tune Specular Reflectivity Weight</span>
                          <span className="text-amber-300 tabular-nums">
                            {sp.specularWeight.toFixed(2)} (IOR {sp.ior.toFixed(2)})
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.05}
                          max={1.0}
                          step={0.02}
                          value={sp.specularWeight}
                          onChange={(e) =>
                            onUpdateMaterialProperty(mat.id, {
                              specularWeight: Number(e.target.value)
                            })
                          }
                          className="w-full accent-amber-400 h-1 bg-slate-800 rounded cursor-pointer"
                        />
                      </div>

                      {onOpenFullPbrStudio && (
                        <button
                          type="button"
                          onClick={() => onOpenFullPbrStudio(mat.id)}
                          className="w-full py-1 px-2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-semibold flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          Open 4-Map PBR Texture Synthesizer →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer Action to Open Full 4-Channel PBR Studio */}
          {onOpenFullPbrStudio && (
            <button
              type="button"
              onClick={() => onOpenFullPbrStudio(selectedMaterialId || materials[0]?.id || '')}
              className="w-full py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Open Full 4-Map PBR Studio &amp; Export PNGs
            </button>
          )}
        </div>
      )}
    </section>
  );
}
