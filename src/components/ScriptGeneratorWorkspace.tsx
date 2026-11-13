import React, { useMemo, useState } from 'react';
import {
  CuratedReferenceFrame,
  LIGHTING_SCENARIOS,
  LightingScenarioPreset
} from '../data/stage18Data';
import {
  generateBlenderArchitectureScript,
  generateCyclesLightingAndCamerasScript,
  generateFfmpegExtractionScript,
  generateFspyCalibrationGuideJson,
  ScriptGeneratorConfig
} from '../utils/scriptGenerators';
import {
  Check,
  Code2,
  Copy,
  Download,
  FileCode,
  FolderOpen,
  Sliders,
  Terminal
} from 'lucide-react';

interface ScriptGeneratorWorkspaceProps {
  curatedFrames: CuratedReferenceFrame[];
  activeLighting: LightingScenarioPreset;
  onSelectLighting: (scenario: LightingScenarioPreset) => void;
  initialScriptTab?: 'ffmpeg' | 'fspy' | 'architecture' | 'lighting';
}

export default function ScriptGeneratorWorkspace({
  curatedFrames,
  activeLighting,
  onSelectLighting,
  initialScriptTab = 'ffmpeg'
}: ScriptGeneratorWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'ffmpeg' | 'fspy' | 'architecture' | 'lighting'>(
    initialScriptTab
  );
  const [mkvFilePath, setMkvFilePath] = useState('/media/archive/Rear_Window_1954_4K_UHD_Remux.mkv');
  const [outputDir, setOutputDir] = useState('./stage18_reference_plates');
  const [pngBitDepth, setPngBitDepth] = useState<'16bit_rgb48le' | '8bit_rgb24'>('16bit_rgb48le');
  const [hdrToneMapping, setHdrToneMapping] = useState<
    'zscale_linear_bt709' | 'hable_filmic' | 'mobius_agx_prep'
  >('zscale_linear_bt709');
  const [scaleUnit, setScaleUnit] = useState<'imperial_feet' | 'metric_meters'>('imperial_feet');
  const [enableFrustumLodCulling, setEnableFrustumLodCulling] = useState(true);
  const [cyclesSamples, setCyclesSamples] = useState(2048);
  const [copiedFlag, setCopiedFlag] = useState(false);

  const config: ScriptGeneratorConfig = useMemo(
    () => ({
      mkvFilePath,
      outputDir,
      pngBitDepth,
      hdrToneMapping,
      scaleUnit,
      brickDetailMode: 'procedural_shader_plus_projection',
      enableFrustumLodCulling,
      cyclesSamples,
      activeLightingScenario: activeLighting,
      curatedFrames
    }),
    [
      mkvFilePath,
      outputDir,
      pngBitDepth,
      hdrToneMapping,
      scaleUnit,
      enableFrustumLodCulling,
      cyclesSamples,
      activeLighting,
      curatedFrames
    ]
  );

  const scripts = useMemo(
    () => ({
      ffmpeg: {
        filename: '01_extract_4k_remux_frames.sh',
        language: 'bash',
        title: '01. Lossless 4K MKV Keyframe & Median Clean-Plate Extractor (FFmpeg)',
        content: generateFfmpegExtractionScript(config)
      },
      fspy: {
        filename: '02_fspy_optical_calibration_guide.json',
        language: 'json',
        title: '02. Mitchell BNC & Exakta VX Optical Calibration Spec (fSpy + Brick Metrology)',
        content: generateFspyCalibrationGuideJson(config)
      },
      architecture: {
        filename: '03_build_stage18_architecture.py',
        language: 'python',
        title: '03. Paramount Stage 18 & Jeffries Apartment Procedural Builder (Blender bpy)',
        content: generateBlenderArchitectureScript(config)
      },
      lighting: {
        filename: '04_setup_cycles_lighting_and_cameras.py',
        language: 'python',
        title: '04. Cycles Light Groups, AgX Color & Hero Camera Background Loader (Blender bpy)',
        content: generateCyclesLightingAndCamerasScript(config)
      }
    }),
    [config]
  );

  const currentScript = scripts[activeTab];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentScript.content);
    setCopiedFlag(true);
    window.setTimeout(() => setCopiedFlag(false), 1800);
  };

  const handleDownloadSingle = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllKit = () => {
    Object.values(scripts).forEach((s, idx) => {
      window.setTimeout(() => {
        handleDownloadSingle(s.filename, s.content);
      }, idx * 200);
    });
  };

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <p className="text-xs font-mono text-amber-400">
            AUTOMATED PYTHON (BPY) &amp; FFMPEG PIPELINE COMPILER
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display mt-1">
            Stage 18 Blender 4.2 &amp; FFmpeg Script Generator
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
            Configure your local 75 GB <code className="text-amber-300">.mkv</code> file path, HDR10
            transfer curve, and Stage 18 scale parameters. All four scripts dynamically compile
            around your {curatedFrames.filter((f) => f.includedInExport).length} pinned Hero
            Reference Frames.
          </p>
        </div>

        <button
          onClick={handleDownloadAllKit}
          className="px-4 py-2.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Download All 4 Pipeline Scripts
        </button>
      </div>

      {/* Main 2-Column Split: Left = Configuration Controls | Right = Live Code Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (4 cols): Pipeline Parameters */}
        <div className="lg:col-span-4 bg-[#12161F] border border-white/10 rounded-xl p-5 space-y-5 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <Sliders className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white font-display">
              Pipeline Compiler Parameters
            </h2>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">
              Local 75 GB 4K Blu-ray Remux Path (.mkv)
            </label>
            <input
              type="text"
              value={mkvFilePath}
              onChange={(e) => setMkvFilePath(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">
              Extracted Reference Plates Output Directory
            </label>
            <input
              type="text"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">PNG Bit Depth</label>
              <select
                value={pngBitDepth}
                onChange={(e) => setPngBitDepth(e.target.value as '16bit_rgb48le' | '8bit_rgb24')}
                className="w-full px-2.5 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono"
              >
                <option value="16bit_rgb48le">16-bit (rgb48le)</option>
                <option value="8bit_rgb24">8-bit (rgb24)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Blender Scene Units</label>
              <select
                value={scaleUnit}
                onChange={(e) => setScaleUnit(e.target.value as 'imperial_feet' | 'metric_meters')}
                className="w-full px-2.5 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono"
              >
                <option value="imperial_feet">Imperial Feet (Stage 18)</option>
                <option value="metric_meters">Metric Meters (0.3048)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 mb-1 font-medium">
              HDR10 (BT.2020 PQ) to SDR/Linear Transfer Mapping
            </label>
            <select
              value={hdrToneMapping}
              onChange={(e) =>
                setHdrToneMapping(
                  e.target.value as 'zscale_linear_bt709' | 'hable_filmic' | 'mobius_agx_prep'
                )
              }
              className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono"
            >
              <option value="zscale_linear_bt709">zscale PQ → Linear → BT.709 Full</option>
              <option value="hable_filmic">Hable Filmic Desat=0 (Preserves Brick Hues)</option>
              <option value="mobius_agx_prep">Mobius Highlight Roll-Off for Blender AgX</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-medium">
                Active Cycles Lighting Rig
              </label>
              <select
                value={activeLighting.id}
                onChange={(e) => {
                  const found = LIGHTING_SCENARIOS.find((l) => l.id === e.target.value);
                  if (found) onSelectLighting(found);
                }}
                className="w-full px-2.5 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100"
              >
                {LIGHTING_SCENARIOS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.shortLabel} ({l.cyclesKelvinKey}K)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-medium">Cycles Path Samples</label>
              <input
                type="number"
                step={256}
                min={256}
                max={8192}
                value={cyclesSamples}
                onChange={(e) => setCyclesSamples(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={enableFrustumLodCulling}
              onChange={(e) => setEnableFrustumLodCulling(e.target.checked)}
              className="rounded accent-amber-500"
            />
            <span>
              Prioritize Tier 1 LOD Collections by User Hero Frames (Solves Barrier 06 VRAM)
            </span>
          </label>
        </div>

        {/* Right Column (8 cols): Script Viewer & Downloader */}
        <div className="lg:col-span-8 bg-[#12161F] border border-white/10 rounded-xl overflow-hidden">
          {/* Script Module Selector Tabs */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-[#0B0D11] border-b border-white/10 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'ffmpeg', label: '01_extract_4k_remux_frames.sh' },
                  { id: 'fspy', label: '02_fspy_calibration.json' },
                  { id: 'architecture', label: '03_build_stage18_architecture.py' },
                  { id: 'lighting', label: '04_setup_cycles_lighting.py' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-[#12161F] text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-xs font-medium bg-[#1A202C] text-slate-200 hover:text-white border border-white/10 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {copiedFlag ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    Copy Code
                  </>
                )}
              </button>

              <button
                onClick={() => handleDownloadSingle(currentScript.filename, currentScript.content)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download {currentScript.filename}
              </button>
            </div>
          </div>

          <div className="px-5 py-3 bg-[#12161F] border-b border-white/10 text-xs text-slate-300 font-medium">
            {currentScript.title}
          </div>

          <pre className="p-5 text-xs font-mono text-slate-200 bg-[#080A0E] overflow-x-auto max-h-[580px] leading-relaxed">
            <code>{currentScript.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
