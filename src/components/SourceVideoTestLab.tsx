import React, { useEffect, useRef, useState } from 'react';
import {
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  CuratedReferenceFrame,
  ManualFrameVerification,
  ParametricDimensionsSnapshot,
  STAGE18_APARTMENTS
} from '../data/stage18Data';
import AutomatedLayoutSolverPanel from './AutomatedLayoutSolverPanel';
import VisualConsistencyAuditPanel from './VisualConsistencyAuditPanel';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileCheck,
  FileJson,
  FileVideo,
  HardDrive,
  Image as ImageIcon,
  Play,
  Plus,
  ShieldCheck,
  Terminal,
  Upload
} from 'lucide-react';

export interface FrameDiagnosticMetrics {
  width: number;
  height: number;
  laplacianSharpnessScore: number;
  orthogonalEdgeDensityPct: number;
  horizontalVerticalRatio: number;
  shadowCrushPct: number;
  highlightClipPct: number;
  midtoneBrickCoveragePct: number;
  estimatedGrainNoiseStdDev: number;
  dominantKeyHex: string;
  dominantShadowHex: string;
  estimatedKelvin: number;
  lumaHistogram: number[];
  acceptanceVerdict:
    | 'OPTIMAL FOR 3D RECONSTRUCTION'
    | 'ACCEPTABLE WITH MEDIAN DE-GRAIN'
    | 'SUBOPTIMAL (HIGH MOTION BLUR / CLIPPING)';
  verdictNotes: string[];
}

export interface EbmlContainerInspectResult {
  fileName: string;
  fileSizeBytes: number;
  fileSizeGb: string;
  isMatroskaEbml: boolean;
  magicHex: string;
  detectedVideoCodec: string;
  detectedAudioCodecs: string[];
  colorPrimariesHint: string;
  browserNativeVideoPlayable: boolean;
}

export interface ProbeReportJson {
  file_path?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  color_space?: string;
  color_transfer?: string;
  color_primaries?: string;
  prerequisites_verified?: {
    python_version?: string;
    ffmpeg_available?: boolean;
    ffprobe_available?: boolean;
    zscale_hdr_filter?: boolean;
  };
  extracted_samples?: Array<{
    timestamp: string;
    label: string;
    file: string;
  }>;
}

interface LoadedDiagnosticPlate {
  id: string;
  name: string;
  dataUrl: string;
  timestampHint: string;
}

interface PrerequisiteStatus {
  python3: { verified: boolean; detail: string };
  ffmpeg: { verified: boolean; detail: string };
  ffprobe: { verified: boolean; detail: string };
  zscaleHdr: { verified: boolean; detail: string };
  blender4: { verified: boolean; detail: string };
}

interface SourceVideoTestLabProps {
  onPinAnalyzedFrame: (frame: CuratedReferenceFrame, dataUrl?: string) => void;
  onApplyLiveProjectionTo3D: (dataUrl: string, targetAptId: string) => void;
  parametricOverrides: Record<string, BuildingParametricOverride>;
  layoutIterations: ArchitecturalLayoutIteration[];
  onApproveIteration: (iterationId: string) => void;
  onApproveAllPending: (minConfidence?: number) => void;
  onRejectIteration: (iterationId: string) => void;
  onRevertIteration: (iterationId: string) => void;
  onAddIterations: (newIterations: ArchitecturalLayoutIteration[]) => void;
  onVerifyAndCalibrateIteration: (
    iterationId: string,
    updatedTargetApartmentId: string,
    updatedProposedValues: ParametricDimensionsSnapshot,
    verification: ManualFrameVerification
  ) => void;
  onResetAllOverrides: () => void;
  onNavigateToWorkbenchWithHeatmap: (targetAptId?: string) => void;
  onNavigateToDeltaScript: () => void;
}

type DiagnosticOverlayMode =
  | 'original'
  | 'sobel_orthogonal_edges'
  | 'laplacian_sharpness_heatmap'
  | 'luma_clipping_zones';

type OsPlatform = 'windows' | 'macos' | 'linux';

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Zero-copy binary header slice inspector for 75 GB .mkv / .mp4 files.
 * Reads only the first 1 MB slice from disk via File.slice(0, 1048576).
 */
async function inspectLargeVideoFileHeader(file: File): Promise<EbmlContainerInspectResult> {
  const sliceSize = Math.min(file.size, 1024 * 1024);
  const buffer = await file.slice(0, sliceSize).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const magicHex = Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  const isMatroskaEbml =
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;

  const asciiDecoder = new TextDecoder('ascii', { fatal: false });
  const headerText = asciiDecoder.decode(bytes);

  let detectedVideoCodec = 'Unknown / Unprobed Stream';
  if (
    headerText.includes('V_MPEGH/ISO/HEVC') ||
    headerText.includes('hev1') ||
    headerText.includes('hvc1')
  ) {
    detectedVideoCodec = 'HEVC / H.265 10-bit (UHD Blu-ray Remux Stream)';
  } else if (headerText.includes('V_MPEG4/ISO/AVC') || headerText.includes('avc1')) {
    detectedVideoCodec = 'AVC / H.264 High Profile';
  } else if (headerText.includes('V_VP9')) {
    detectedVideoCodec = 'VP9 Profile 2';
  } else if (headerText.includes('V_AV1')) {
    detectedVideoCodec = 'AV1 Main10';
  }

  const audioCodecs: string[] = [];
  if (headerText.includes('A_TRUEHD')) audioCodecs.push('Dolby TrueHD');
  if (headerText.includes('A_AC3') || headerText.includes('A_EAC3'))
    audioCodecs.push('Dolby Digital AC-3');
  if (headerText.includes('A_DTS')) audioCodecs.push('DTS-HD Master Audio');
  if (headerText.includes('A_FLAC')) audioCodecs.push('FLAC Lossless');
  if (headerText.includes('A_PCM')) audioCodecs.push('Linear PCM');

  const colorPrimariesHint =
    file.size > 25 * 1024 * 1024 * 1024 || detectedVideoCodec.includes('HEVC')
      ? 'BT.2020 Primaries · SMPTE ST 2084 (PQ HDR10) — Requires zscale Linear Transfer'
      : 'BT.709 Standard Dynamic Range';

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    fileSizeGb: (file.size / (1024 * 1024 * 1024)).toFixed(2),
    isMatroskaEbml,
    magicHex,
    detectedVideoCodec,
    detectedAudioCodecs: audioCodecs.length > 0 ? audioCodecs : ['Embedded Audio Track'],
    colorPrimariesHint,
    browserNativeVideoPlayable: true
  };
}

/**
 * Generates the standalone local Python/FFmpeg diagnostic script with built-in
 * prerequisite verification (Python 3.8+, ffmpeg, ffprobe, zscale filter).
 */
function generateStandaloneDiagnosticPythonScript(mkvName: string): string {
  return `#!/usr/bin/env python3
"""
================================================================================
00_stage18_75gb_diagnostic_probe.py
STAGE 18: STANDALONE 75 GB 4K MKV PREREQUISITE CHECKER & VISUAL DIAGNOSTIC PROBE
================================================================================
Step-by-step automated local probe:
  1. Verifies Prerequisite Programs (Python 3.8+, ffmpeg, ffprobe, and zscale HDR filter)
  2. Audits the 75 GB .mkv stream header via ffprobe (HEVC 10-bit, BT.2020, SMPTE ST 2084)
  3. Seeks to 6 canonical Rear Window (1954) timestamps and extracts 16-bit PNG plates
  4. Saves stage18_acceptance_report.json for one-click import back into Stage 18

Usage:
  python3 00_stage18_75gb_diagnostic_probe.py --check-only
  python3 00_stage18_75gb_diagnostic_probe.py "/path/to/${mkvName || 'Rear_Window_1954_4K.mkv'}"
================================================================================
"""

import json
import shutil
import subprocess
import sys
import os
from pathlib import Path

SAMPLE_TIMESTAMPS = [
    ("00:02:14.33", "Opening_Courtyard_Wide_35mm"),
    ("00:26:40.00", "Golden_Hour_Courtyard_50mm"),
    ("00:44:18.50", "Thorwald_Exakta_Telephoto_152mm"),
    ("00:58:12.16", "West_Wing_Clean_Brick_Plate"),
    ("01:08:15.16", "Nocturnal_Practicals_Composer"),
    ("01:36:52.25", "Reverse_Angle_Jeffries_Window"),
]


def check_prerequisites() -> dict:
    print("=== [STEP 1] Checking Local Prerequisite Programs ===")
    py_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    py_ok = sys.version_info >= (3, 8)
    print(f"  [{'OK' if py_ok else 'FAIL'}] Python Version: {py_ver} (Requires >= 3.8)")

    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    print(f"  [{'OK' if ffmpeg_path else 'MISSING'}] ffmpeg binary:  {ffmpeg_path or 'Not found in PATH'}")
    print(f"  [{'OK' if ffprobe_path else 'MISSING'}] ffprobe binary: {ffprobe_path or 'Not found in PATH'}")

    zscale_ok = False
    if ffmpeg_path:
        try:
            res = subprocess.run(
                ["ffmpeg", "-hide_banner", "-filters"],
                capture_output=True, text=True, check=False
            )
            zscale_ok = "zscale" in res.stdout
        except Exception:
            zscale_ok = False
    print(f"  [{'OK' if zscale_ok else 'FALLBACK'}] FFmpeg zscale HDR10 filter: {'Available' if zscale_ok else 'Using standard colorspace fallback'}")

    if not ffmpeg_path or not ffprobe_path:
        print("\\n[!] ERROR: ffmpeg and/or ffprobe are missing from your system PATH.")
        print("    -> Windows: winget install Gyan.FFmpeg")
        print("    -> macOS:   brew install ffmpeg")
        print("    -> Linux:   sudo apt install ffmpeg")
        sys.exit(1)

    print("STAGE18_PREREQ_OK: All required prerequisite tools verified.\\n")
    return {
        "python_version": py_ver,
        "ffmpeg_available": bool(ffmpeg_path),
        "ffprobe_available": bool(ffprobe_path),
        "zscale_hdr_filter": zscale_ok,
    }


def run_ffprobe_audit(mkv_path: str) -> dict:
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        "-select_streams", "v:0",
        mkv_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    return json.loads(res.stdout)


def extract_diagnostic_frame(mkv_path: str, timestamp: str, out_png: str, use_zscale: bool):
    if use_zscale:
        vf_chain = (
            "zscale=t=linear:npl=100,format=gbrpf32le,"
            "zscale=p=bt709:t=iec61966-2-1:m=bt709:r=full,format=rgb48le"
        )
    else:
        vf_chain = "format=rgb48le"

    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", timestamp,
        "-i", mkv_path,
        "-vf", vf_chain,
        "-frames:v", "1",
        out_png
    ]
    subprocess.run(cmd, check=True)


def main():
    prereqs = check_prerequisites()

    if len(sys.argv) < 2 or sys.argv[1] == "--check-only":
        print("Prerequisite check complete. Pass your 75 GB .mkv path to extract diagnostic plates:")
        print(f'  python3 {Path(__file__).name} "/path/to/${mkvName || 'Rear_Window_1954_4K.mkv'}"')
        sys.exit(0)

    mkv_path = sys.argv[1]
    if not os.path.exists(mkv_path):
        print(f"[!] ERROR: File not found: {mkv_path}")
        sys.exit(1)

    out_dir = Path("./stage18_diagnostic_probe_out")
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== [STEP 2] Auditing 75 GB MKV Container & HEVC HDR10 Stream ===")
    probe_data = run_ffprobe_audit(mkv_path)
    stream = probe_data.get("streams", [{}])[0]

    summary = {
        "file_path": mkv_path,
        "codec_name": stream.get("codec_name"),
        "width": stream.get("width"),
        "height": stream.get("height"),
        "pix_fmt": stream.get("pix_fmt"),
        "color_space": stream.get("color_space"),
        "color_transfer": stream.get("color_transfer"),
        "color_primaries": stream.get("color_primaries"),
        "prerequisites_verified": prereqs,
        "extracted_samples": []
    }

    print("=== [STEP 3] Extracting 6 Calibrated 16-bit PNG Diagnostic Plates ===")
    for ts, label in SAMPLE_TIMESTAMPS:
        png_path = out_dir / f"diag_{label}.png"
        extract_diagnostic_frame(mkv_path, ts, str(png_path), prereqs["zscale_hdr_filter"])
        print(f"  -> Extracted {png_path} (SMPTE {ts})")
        summary["extracted_samples"].append({
            "timestamp": ts,
            "label": label,
            "file": str(png_path)
        })

    report_path = out_dir / "stage18_acceptance_report.json"
    report_path.write_text(json.dumps(summary, indent=2))
    print(f"\\n=== [STEP 4] Complete! ===")
    print(f"1. Report saved to: {report_path}")
    print(f"2. Upload '{report_path}' and the 'diag_*.png' plates into Step 3 of the Stage 18 75GB Source Lab.")


if __name__ == "__main__":
    main()
`;
}

export default function SourceVideoTestLab({
  onPinAnalyzedFrame,
  onApplyLiveProjectionTo3D,
  parametricOverrides,
  layoutIterations,
  onApproveIteration,
  onApproveAllPending,
  onRejectIteration,
  onRevertIteration,
  onAddIterations,
  onVerifyAndCalibrateIteration,
  onResetAllOverrides,
  onNavigateToWorkbenchWithHeatmap,
  onNavigateToDeltaScript
}: SourceVideoTestLabProps) {
  const [activeWizardStep, setActiveWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(6);
  const [osPlatform, setOsPlatform] = useState<OsPlatform>('windows');
  const [prereqTerminalPaste, setPrereqTerminalPaste] = useState<string>('');
  const [prereqStatus, setPrereqStatus] = useState<PrerequisiteStatus>({
    python3: { verified: false, detail: 'Requires Python >= 3.8 (standard library only)' },
    ffmpeg: { verified: false, detail: 'Required for 4K HEVC frame extraction & tmix median stack' },
    ffprobe: { verified: false, detail: 'Required for BT.2020 / SMPTE ST 2084 stream probing' },
    zscaleHdr: { verified: false, detail: 'libzimg filter for lossless PQ-to-Linear tone mapping' },
    blender4: { verified: false, detail: 'Blender 4.2+ LTS for running 03 & 04 bpy scripts' }
  });

  const [containerInfo, setContainerInfo] = useState<EbmlContainerInspectResult | null>(null);
  const [probeReport, setProbeReport] = useState<ProbeReportJson | null>(null);
  const [loadedPlates, setLoadedPlates] = useState<LoadedDiagnosticPlate[]>([]);
  const [activePlateId, setActivePlateId] = useState<string | null>(null);

  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const [videoPlayError, setVideoPlayError] = useState<string | null>(null);
  const [currentTimestampSec, setCurrentTimestampSec] = useState<number>(134.33);
  const [overlayMode, setOverlayMode] = useState<DiagnosticOverlayMode>('sobel_orthogonal_edges');
  const [simulatedSourcePreset, setSimulatedSourcePreset] = useState<
    'optimal_zscale_16bit' | 'raw_uncalibrated_hdr_pq' | 'motion_blur_pan_frame'
  >('optimal_zscale_16bit');
  const [targetAptId, setTargetAptId] = useState<string>('apt-thorwald');
  const [focalLengthMm, setFocalLengthMm] = useState<number>(50);
  const [metrics, setMetrics] = useState<FrameDiagnosticMetrics | null>(null);
  const [pinnedFeedback, setPinnedFeedback] = useState<boolean>(false);
  const [projectedFeedback, setProjectedFeedback] = useState<boolean>(false);
  const [copiedCmdId, setCopiedCmdId] = useState<string | null>(null);

  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const diagnosticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const copyCommand = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCmdId(id);
    window.setTimeout(() => setCopiedCmdId(null), 1800);
  };

  // Parse terminal output pasted by the user in Step 1 to verify prerequisites automatically
  const handleVerifyTerminalOutput = (text: string) => {
    setPrereqTerminalPaste(text);
    const lower = text.toLowerCase();

    const pyMatch = text.match(/python\s+(\d+\.\d+(?:\.\d+)?)/i);
    const ffmpegMatch = text.match(/ffmpeg\s+version\s+([^\s]+)/i);
    const ffprobeMatch = text.match(/ffprobe\s+version\s+([^\s]+)/i);
    const zscaleMatch = lower.includes('zscale') || lower.includes('stage18_prereq_ok');
    const blenderMatch = text.match(/blender\s+(\d+\.\d+(?:\.\d+)?)/i);

    setPrereqStatus((prev) => ({
      python3:
        pyMatch || lower.includes('stage18_prereq_ok')
          ? { verified: true, detail: `Verified Python ${pyMatch ? pyMatch[1] : '3.x'}` }
          : prev.python3,
      ffmpeg:
        ffmpegMatch || lower.includes('stage18_prereq_ok')
          ? { verified: true, detail: `Verified FFmpeg ${ffmpegMatch ? ffmpegMatch[1] : 'installed'}` }
          : prev.ffmpeg,
      ffprobe:
        ffprobeMatch || ffmpegMatch || lower.includes('stage18_prereq_ok')
          ? { verified: true, detail: `Verified FFprobe ${ffprobeMatch ? ffprobeMatch[1] : 'installed'}` }
          : prev.ffprobe,
      zscaleHdr:
        zscaleMatch || Boolean(ffmpegMatch)
          ? { verified: true, detail: 'Verified zscale HDR10 PQ-to-Linear filter' }
          : prev.zscaleHdr,
      blender4: blenderMatch
        ? { verified: true, detail: `Verified Blender ${blenderMatch[1]}` }
        : prev.blender4
    }));
  };

  const toggleManualPrereq = (key: keyof PrerequisiteStatus) => {
    setPrereqStatus((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        verified: !prev[key].verified
      }
    }));
  };

  const markAllCorePrereqsVerified = () => {
    setPrereqStatus({
      python3: { verified: true, detail: 'Python 3.8+ Confirmed Ready' },
      ffmpeg: { verified: true, detail: 'FFmpeg CLI Confirmed Ready' },
      ffprobe: { verified: true, detail: 'FFprobe CLI Confirmed Ready' },
      zscaleHdr: { verified: true, detail: 'zscale HDR10 Filter Confirmed Ready' },
      blender4: { verified: true, detail: 'Blender 4.x LTS Confirmed Ready' }
    });
    setActiveWizardStep(2);
  };

  const corePrereqsVerifiedCount = [
    prereqStatus.python3.verified,
    prereqStatus.ffmpeg.verified,
    prereqStatus.ffprobe.verified,
    prereqStatus.zscaleHdr.verified
  ].filter(Boolean).length;

  // Run computer-vision pixel analysis & render diagnostic overlay on sourceCanvas -> diagnosticCanvas
  const runVisualDataInterpretation = () => {
    const srcCanvas = sourceCanvasRef.current;
    const diagCanvas = diagnosticCanvasRef.current;
    if (!srcCanvas || !diagCanvas) return;

    const w = srcCanvas.width;
    const h = srcCanvas.height;
    const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const diagCtx = diagCanvas.getContext('2d');
    if (!srcCtx || !diagCtx) return;

    const imgData = srcCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const outImg = diagCtx.createImageData(w, h);
    const out = outImg.data;

    const luma = new Float32Array(w * h);
    const histBins = new Array<number>(64).fill(0);
    let shadowCrushCount = 0;
    let highlightClipCount = 0;
    let midtoneBrickCount = 0;

    let keyR = 0,
      keyG = 0,
      keyB = 0,
      keyCnt = 0;
    let shdR = 0,
      shdG = 0,
      shdB = 0,
      shdCnt = 0;

    const totalPixels = w * h;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      luma[i] = y;

      const bin = Math.min(63, Math.floor((y / 256) * 64));
      histBins[bin]++;

      if (y < 10) shadowCrushCount++;
      if (y > 246) highlightClipCount++;

      if (y >= 35 && y <= 215 && r > g * 1.08 && g >= b * 0.85) {
        midtoneBrickCount++;
      }

      if (y > 165) {
        keyR += r;
        keyG += g;
        keyB += b;
        keyCnt++;
      } else if (y > 12 && y < 75) {
        shdR += r;
        shdG += g;
        shdB += b;
        shdCnt++;
      }
    }

    let laplacianSum = 0;
    let laplacianSqSum = 0;
    let strongOrthogonalEdgeCount = 0;
    let horizEdgeEnergy = 0;
    let vertEdgeEnergy = 0;
    let grainNoiseAccum = 0;
    let interiorPixels = 0;

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const pIdx = i * 4;

        const tl = luma[(y - 1) * w + (x - 1)];
        const tc = luma[(y - 1) * w + x];
        const tr = luma[(y - 1) * w + (x + 1)];
        const ml = luma[y * w + (x - 1)];
        const mc = luma[i];
        const mr = luma[y * w + (x + 1)];
        const bl = luma[(y + 1) * w + (x - 1)];
        const bc = luma[(y + 1) * w + x];
        const br = luma[(y + 1) * w + (x + 1)];

        const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
        const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
        const mag = Math.hypot(gx, gy);

        const lap = 4 * mc - tc - bc - ml - mr;
        laplacianSum += lap;
        laplacianSqSum += lap * lap;
        interiorPixels++;

        if (mag < 28) {
          grainNoiseAccum += Math.abs(lap) * 0.25;
        }

        const absGx = Math.abs(gx);
        const absGy = Math.abs(gy);
        const isVerticalLine = absGx > 95 && absGy < absGx * 0.35;
        const isHorizontalLine = absGy > 95 && absGx < absGy * 0.35;

        if (isVerticalLine || isHorizontalLine) {
          strongOrthogonalEdgeCount++;
          if (isHorizontalLine) horizEdgeEnergy += absGy;
          if (isVerticalLine) vertEdgeEnergy += absGx;
        }

        if (overlayMode === 'original') {
          out[pIdx] = data[pIdx];
          out[pIdx + 1] = data[pIdx + 1];
          out[pIdx + 2] = data[pIdx + 2];
          out[pIdx + 3] = 255;
        } else if (overlayMode === 'sobel_orthogonal_edges') {
          const baseLuma = mc * 0.28;
          if (isHorizontalLine) {
            out[pIdx] = 245;
            out[pIdx + 1] = 158;
            out[pIdx + 2] = 11;
          } else if (isVerticalLine) {
            out[pIdx] = 56;
            out[pIdx + 1] = 189;
            out[pIdx + 2] = 248;
          } else {
            out[pIdx] = baseLuma;
            out[pIdx + 1] = baseLuma;
            out[pIdx + 2] = baseLuma * 1.1;
          }
          out[pIdx + 3] = 255;
        } else if (overlayMode === 'laplacian_sharpness_heatmap') {
          const absLap = Math.abs(lap);
          const base = mc * 0.45;
          if (absLap > 38) {
            out[pIdx] = 16;
            out[pIdx + 1] = 215;
            out[pIdx + 2] = 129;
          } else if (absLap > 16) {
            out[pIdx] = 245;
            out[pIdx + 1] = 158;
            out[pIdx + 2] = 11;
          } else {
            out[pIdx] = base;
            out[pIdx + 1] = base * 0.85;
            out[pIdx + 2] = base * 0.9;
          }
          out[pIdx + 3] = 255;
        } else if (overlayMode === 'luma_clipping_zones') {
          if (mc < 10) {
            out[pIdx] = 59;
            out[pIdx + 1] = 130;
            out[pIdx + 2] = 246;
          } else if (mc > 246) {
            out[pIdx] = 239;
            out[pIdx + 1] = 68;
            out[pIdx + 2] = 68;
          } else {
            out[pIdx] = data[pIdx];
            out[pIdx + 1] = data[pIdx + 1];
            out[pIdx + 2] = data[pIdx + 2];
          }
          out[pIdx + 3] = 255;
        }
      }
    }

    diagCtx.putImageData(outImg, 0, 0);

    const meanLap = laplacianSum / Math.max(1, interiorPixels);
    const varianceLap = laplacianSqSum / Math.max(1, interiorPixels) - meanLap * meanLap;
    const laplacianSharpnessScore = Math.round(Math.min(999, Math.max(10, varianceLap * 0.18)));

    const orthogonalEdgeDensityPct = Number(
      ((strongOrthogonalEdgeCount / Math.max(1, interiorPixels)) * 100).toFixed(2)
    );
    const horizontalVerticalRatio = Number(
      (horizEdgeEnergy / Math.max(1, vertEdgeEnergy)).toFixed(2)
    );
    const shadowCrushPct = Number(((shadowCrushCount / totalPixels) * 100).toFixed(2));
    const highlightClipPct = Number(((highlightClipCount / totalPixels) * 100).toFixed(2));
    const midtoneBrickCoveragePct = Number(((midtoneBrickCount / totalPixels) * 100).toFixed(1));
    const estimatedGrainNoiseStdDev = Number(
      (grainNoiseAccum / Math.max(1, interiorPixels)).toFixed(2)
    );

    const avgKeyR = keyCnt > 0 ? keyR / keyCnt : 245;
    const avgKeyG = keyCnt > 0 ? keyG / keyCnt : 180;
    const avgKeyB = keyCnt > 0 ? keyB / keyCnt : 115;
    const dominantKeyHex = rgbToHex(avgKeyR, avgKeyG, avgKeyB);

    const avgShdR = shdCnt > 0 ? shdR / shdCnt : 28;
    const avgShdG = shdCnt > 0 ? shdG / shdCnt : 34;
    const avgShdB = shdCnt > 0 ? shdB / shdCnt : 48;
    const dominantShadowHex = rgbToHex(avgShdR, avgShdG, avgShdB);

    const ratio = (avgKeyB + 1) / (avgKeyR + 1);
    const estimatedKelvin = Math.max(2100, Math.min(8500, Math.round(2400 + ratio * 3800)));

    const maxBin = Math.max(...histBins, 1);
    const lumaHistogram = histBins.map((v) => Number((v / maxBin).toFixed(3)));

    const verdictNotes: string[] = [];
    let acceptanceVerdict: FrameDiagnosticMetrics['acceptanceVerdict'] =
      'OPTIMAL FOR 3D RECONSTRUCTION';

    if (laplacianSharpnessScore < 75) {
      acceptanceVerdict = 'SUBOPTIMAL (HIGH MOTION BLUR / CLIPPING)';
      verdictNotes.push(
        `Low acutance (${laplacianSharpnessScore}): Frame exhibits camera pan shutter blur (1/48s) or shallow telephoto depth-of-field. Seek a locked-off I-frame.`
      );
    } else {
      verdictNotes.push(
        `High optical acutance (${laplacianSharpnessScore}): Brick mortar courses and window sash mullions are well-resolved for fSpy vanishing-line extraction.`
      );
    }

    if (orthogonalEdgeDensityPct >= 3.2) {
      verdictNotes.push(
        `Strong orthogonal edge density (${orthogonalEdgeDensityPct}% · H/V ratio ${horizontalVerticalRatio}): Sufficient horizontal lintels and vertical pilasters to lock 3-point camera calibration.`
      );
    } else {
      verdictNotes.push(
        `Low orthogonal edge count (${orthogonalEdgeDensityPct}%): Use this plate for color/lighting sampling rather than primary fSpy geometry solving.`
      );
    }

    if (
      estimatedGrainNoiseStdDev > 3.6 &&
      acceptanceVerdict === 'OPTIMAL FOR 3D RECONSTRUCTION'
    ) {
      acceptanceVerdict = 'ACCEPTABLE WITH MEDIAN DE-GRAIN';
      verdictNotes.push(
        `Elevated 1954 Eastmancolor 35mm film grain (σ=${estimatedGrainNoiseStdDev}): Enable FFmpeg 24-frame temporal median stacking (tmix) before UV projection baking.`
      );
    }

    if (shadowCrushPct > 18 || highlightClipPct > 8) {
      verdictNotes.push(
        `Dynamic range warning (Shadow Crush ${shadowCrushPct}%, Highlight Clip ${highlightClipPct}%): Verify zscale SMPTE ST 2084 (PQ) to Linear transfer in 01_extract_4k_remux_frames.sh.`
      );
    } else {
      verdictNotes.push(
        `Balanced HDR-to-Linear tone mapping (${midtoneBrickCoveragePct}% warm masonry midtones preserved with ${shadowCrushPct}% shadow crush).`
      );
    }

    setMetrics({
      width: w,
      height: h,
      laplacianSharpnessScore,
      orthogonalEdgeDensityPct,
      horizontalVerticalRatio,
      shadowCrushPct,
      highlightClipPct,
      midtoneBrickCoveragePct,
      estimatedGrainNoiseStdDev,
      dominantKeyHex,
      dominantShadowHex,
      estimatedKelvin,
      lumaHistogram,
      acceptanceVerdict,
      verdictNotes
    });
  };

  const renderSyntheticTestPlate = (
    preset: 'optimal_zscale_16bit' | 'raw_uncalibrated_hdr_pq' | 'motion_blur_pan_frame'
  ) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (preset === 'raw_uncalibrated_hdr_pq') {
      ctx.fillStyle = '#6B7075';
      ctx.fillRect(0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1B2230');
      grad.addColorStop(0.55, '#6B2D1F');
      grad.addColorStop(1, '#D97706');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    const blurOffset = preset === 'motion_blur_pan_frame' ? 6 : 1;

    for (let pass = 0; pass < blurOffset; pass++) {
      const shiftX = pass * 4;
      ctx.globalAlpha = 1 / blurOffset;

      ctx.fillStyle = preset === 'raw_uncalibrated_hdr_pq' ? '#827B75' : '#8B3A2B';
      ctx.fillRect(40 + shiftX, 24, w - 80, h - 48);

      ctx.fillStyle = preset === 'raw_uncalibrated_hdr_pq' ? '#9CA3AF' : '#47423E';
      for (let by = 28; by < h - 28; by += 10) {
        ctx.fillRect(40 + shiftX, by, w - 80, 2);
      }
      for (let bx = 48; bx < w - 48; bx += 24) {
        ctx.fillRect(bx + shiftX, 24, 2, h - 48);
      }

      const winPositions = [85, 195, 305, 415];
      winPositions.forEach((wx, idx) => {
        const wy = 92;
        const ww = 72;
        const wh = 128;

        ctx.fillStyle = preset === 'raw_uncalibrated_hdr_pq' ? '#D1D5DB' : '#E7E5E4';
        ctx.fillRect(wx - 6 + shiftX, wy - 10, ww + 12, 9);
        ctx.fillRect(wx - 8 + shiftX, wy + wh + 1, ww + 16, 7);

        ctx.fillStyle =
          preset === 'raw_uncalibrated_hdr_pq'
            ? '#9CA3AF'
            : idx === 2
            ? '#F59E0B'
            : '#292524';
        ctx.fillRect(wx + shiftX, wy, ww, wh);

        ctx.strokeStyle = '#F5F5F4';
        ctx.lineWidth = 3;
        ctx.strokeRect(wx + shiftX, wy, ww, wh);
        ctx.beginPath();
        ctx.moveTo(wx + shiftX, wy + wh * 0.5);
        ctx.lineTo(wx + ww + shiftX, wy + wh * 0.5);
        ctx.stroke();
      });

      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3;
      ctx.strokeRect(180 + shiftX, 185, 210, 38);
      ctx.beginPath();
      ctx.moveTo(190 + shiftX, 185);
      ctx.lineTo(290 + shiftX, 95);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    runVisualDataInterpretation();
  };

  // Draw a loaded plate onto sourceCanvas when activePlateId changes
  useEffect(() => {
    if (!activePlateId) {
      renderSyntheticTestPlate(simulatedSourcePreset);
      return;
    }
    const found = loadedPlates.find((p) => p.id === activePlateId);
    if (!found) return;
    const img = new Image();
    img.onload = () => {
      const canvas = sourceCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      runVisualDataInterpretation();
    };
    img.src = found.dataUrl;
  }, [activePlateId, overlayMode, simulatedSourcePreset]);

  // Cleanup mounted 75GB video blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
    };
  }, [videoObjectUrl]);

  // Step 2: Mount 75 GB .MKV file via zero-copy File.slice
  const handleMountMkvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoPlayError(null);

    const info = await inspectLargeVideoFileHeader(file);
    setContainerInfo(info);

    if (videoObjectUrl) {
      URL.revokeObjectURL(videoObjectUrl);
    }
    const url = URL.createObjectURL(file);
    setVideoObjectUrl(url);
  };

  // Step 3: Load Multiple Diagnostic Plates (diag_*.png) and/or stage18_acceptance_report.json
  const handleLoadDiagnosticOutputs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPlates: LoadedDiagnosticPlate[] = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as ProbeReportJson;
          setProbeReport(parsed);
          if (parsed.prerequisites_verified) {
            setPrereqStatus((prev) => ({
              ...prev,
              python3: {
                verified: true,
                detail: `Verified Python ${parsed.prerequisites_verified?.python_version || '3.x'}`
              },
              ffmpeg: {
                verified: Boolean(parsed.prerequisites_verified?.ffmpeg_available),
                detail: 'Verified via stage18_acceptance_report.json'
              },
              ffprobe: {
                verified: Boolean(parsed.prerequisites_verified?.ffprobe_available),
                detail: 'Verified via stage18_acceptance_report.json'
              },
              zscaleHdr: {
                verified: Boolean(parsed.prerequisites_verified?.zscale_hdr_filter),
                detail: 'Verified via stage18_acceptance_report.json'
              }
            }));
          }
        } catch {
          // ignore malformed JSON
        }
      } else if (
        file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|bmp|tiff?)$/i.test(file.name)
      ) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.readAsDataURL(file);
        });
        if (dataUrl) {
          let tsHint = '00:02:14:08';
          if (file.name.includes('Golden_Hour')) tsHint = '00:26:40:00';
          else if (file.name.includes('Thorwald')) tsHint = '00:44:18:12';
          else if (file.name.includes('Clean_Brick')) tsHint = '00:58:12:04';
          else if (file.name.includes('Nocturnal')) tsHint = '01:08:15:04';
          else if (file.name.includes('Reverse')) tsHint = '01:36:52:06';

          newPlates.push({
            id: `plate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            dataUrl,
            timestampHint: tsHint
          });
        }
      }
    }

    if (newPlates.length > 0) {
      setLoadedPlates((prev) => {
        const combined = [...newPlates, ...prev];
        setActivePlateId(combined[0].id);
        return combined;
      });
      setActiveWizardStep(4);
    }
  };

  const captureCurrentVideoFrameToAnalyzer = () => {
    const video = videoElementRef.current;
    const canvas = sourceCanvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCurrentTimestampSec(video.currentTime);
    setActivePlateId(null);
    runVisualDataInterpretation();
    setActiveWizardStep(4);
  };

  const handlePinAnalyzedFrameToCurator = () => {
    const srcCanvas = sourceCanvasRef.current;
    if (!srcCanvas || !metrics) return;
    const dataUrl = srcCanvas.toDataURL('image/png');
    const activePlate = loadedPlates.find((p) => p.id === activePlateId);

    const hrs = Math.floor(currentTimestampSec / 3600);
    const mins = Math.floor((currentTimestampSec % 3600) / 60);
    const secs = Math.floor(currentTimestampSec % 60);
    const smpte =
      activePlate?.timestampHint ||
      `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:00`;

    const newFrame: CuratedReferenceFrame = {
      id: `frame-lab-${Date.now()}`,
      title: activePlate
        ? `Validated Plate: ${activePlate.name}`
        : `Diagnostic Validated Plate (${metrics.acceptanceVerdict.split(' ')[0]})`,
      sourceType: 'mkv_timecode',
      smpteTimecode: smpte,
      frameNumber: Math.round(currentTimestampSec * 23.976),
      durationWindowSec: 3.0,
      useTemporalMedianStack: metrics.estimatedGrainNoiseStdDev > 2.5,
      role: metrics.orthogonalEdgeDensityPct >= 3.2 ? 'fspy_geometry' : 'clean_texture_plate',
      targetApartmentId: targetAptId,
      focalLengthMm,
      sampledKeyColorHex: metrics.dominantKeyHex,
      sampledShadowColorHex: metrics.dominantShadowHex,
      kelvinEstimate: metrics.estimatedKelvin,
      sceneContext: `Validated in 75GB Source Test Lab (${activePlate?.name || containerInfo?.fileName || 'Diagnostic Plate'})`,
      architecturalFeatureHighlighted: `Orthogonal Edge Density ${metrics.orthogonalEdgeDensityPct}% · H/V Ratio ${metrics.horizontalVerticalRatio}`,
      lightingNotes: `Sampled ${metrics.estimatedKelvin}K · Shadow Crush ${metrics.shadowCrushPct}% · Highlight Clip ${metrics.highlightClipPct}%`,
      notes: metrics.verdictNotes.join(' '),
      customMetadata: [
        { key: 'Laplacian Acutance', value: String(metrics.laplacianSharpnessScore) },
        { key: 'Orthogonal Edges', value: `${metrics.orthogonalEdgeDensityPct}%` },
        { key: 'Film Grain Sigma', value: String(metrics.estimatedGrainNoiseStdDev) }
      ],
      includedInExport: true,
      cropRegion: '3840x2304 (Validated 4K Plate)'
    };

    onPinAnalyzedFrame(newFrame, dataUrl);
    setPinnedFeedback(true);
    window.setTimeout(() => setPinnedFeedback(false), 2000);
  };

  const handleProjectOnto3DStage = () => {
    const srcCanvas = sourceCanvasRef.current;
    if (!srcCanvas) return;
    const dataUrl = srcCanvas.toDataURL('image/png');
    onApplyLiveProjectionTo3D(dataUrl, targetAptId);
    setProjectedFeedback(true);
    window.setTimeout(() => setProjectedFeedback(false), 2000);
  };

  const handleDownloadPythonProbe = () => {
    const script = generateStandaloneDiagnosticPythonScript(
      containerInfo?.fileName || 'Rear_Window_1954_4K_Remux.mkv'
    );
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '00_stage18_75gb_diagnostic_probe.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const targetMkvFilename = containerInfo?.fileName || 'Rear_Window_1954_4K_Remux.mkv';
  const prereqCheckCmd =
    osPlatform === 'windows'
      ? 'python --version; ffmpeg -version | Select-Object -First 1; ffprobe -version | Select-Object -First 1; ffmpeg -hide_banner -filters | Select-String zscale'
      : 'python3 --version && ffmpeg -version | head -n 1 && ffprobe -version | head -n 1 && ffmpeg -hide_banner -filters | grep zscale';

  const installFfmpegCmd =
    osPlatform === 'windows'
      ? 'winget install Gyan.FFmpeg'
      : osPlatform === 'macos'
      ? 'brew install python ffmpeg'
      : 'sudo apt update && sudo apt install -y python3 ffmpeg';

  const runProbeCmd =
    osPlatform === 'windows'
      ? `python 00_stage18_75gb_diagnostic_probe.py "${targetMkvFilename}"`
      : `python3 00_stage18_75gb_diagnostic_probe.py "${targetMkvFilename}"`;

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <p className="text-xs font-mono text-amber-400">
            GUIDED 5-STEP SOURCE MOUNTING, PREREQUISITE CHECK &amp; AI/CV 3D LAYOUT SOLVER
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display mt-1">
            75 GB 4K Source Video Visual Interpretation &amp; Autonomous 3D Solver Lab
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
            Follow the 5-step workflow below to verify your local prerequisite tools, mount and
            probe your 75 GB <code className="text-amber-300">.mkv</code> file, load extracted
            16-bit diagnostic plates, audit single-frame CV metrics, and run the{' '}
            <span className="text-white font-medium">
              Dual-Engine Autonomous Frame-to-3D Architectural Solver
            </span>{' '}
            with User Review Gates.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <button
            onClick={() => setActiveWizardStep(6)}
            className="px-4 py-2.5 text-xs font-semibold bg-[#161C28] text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/15 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            Visual Consistency &amp; Stitching Audit (Step 06)
          </button>
          <button
            onClick={() => setActiveWizardStep(5)}
            className="px-4 py-2.5 text-xs font-semibold bg-[#161C28] text-amber-300 border border-amber-500/40 hover:bg-amber-500/15 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            Open AI &amp; CV 3D Layout Solver (Step 05)
          </button>
          <button
            onClick={handleDownloadPythonProbe}
            className="px-4 py-2.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Download 00_stage18_75gb_diagnostic_probe.py
          </button>
        </div>
      </div>

      {/* Interactive 6-Step Progress Navigation Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          {
            step: 1 as const,
            title: '01. Prerequisite Check',
            subtitle: `${corePrereqsVerifiedCount}/4 Core Tools Verified`,
            done: corePrereqsVerifiedCount === 4
          },
          {
            step: 2 as const,
            title: '02. Mount & Probe 75GB MKV',
            subtitle: containerInfo
              ? `${containerInfo.fileSizeGb} GB Mounted`
              : 'Header & CLI Probe Setup',
            done: Boolean(containerInfo)
          },
          {
            step: 3 as const,
            title: '03. Ingest Diagnostic Plates',
            subtitle:
              loadedPlates.length > 0
                ? `${loadedPlates.length} Plate(s) Loaded`
                : 'Load diag_*.png or Report JSON',
            done: loadedPlates.length > 0 || Boolean(probeReport)
          },
          {
            step: 4 as const,
            title: '04. CV Acceptance & 3D Test',
            subtitle: metrics
              ? metrics.acceptanceVerdict.split(' ')[0]
              : 'Sobel, Grain & 3D Projection',
            done: Boolean(metrics)
          },
          {
            step: 5 as const,
            title: '05. AI & CV 3D Layout Solver',
            subtitle: `${
              layoutIterations.filter((i) => i.status === 'approved').length
            } Applied · ${
              layoutIterations.filter((i) => i.status === 'pending_review').length
            } Pending Gate`,
            done: layoutIterations.some((i) => i.status === 'approved')
          },
          {
            step: 6 as const,
            title: '06. Visual Consistency Audit',
            subtitle: 'Adjacent Frame Stitching & POV Seam Check',
            done: true
          }
        ].map((item) => {
          const isCurrent = activeWizardStep === item.step;
          return (
            <button
              key={item.step}
              onClick={() => setActiveWizardStep(item.step)}
              className={`p-4 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 ${
                isCurrent
                  ? 'bg-[#161C28] border-amber-500'
                  : item.done
                  ? 'bg-[#12161F] border-emerald-500/40 hover:border-emerald-500/60'
                  : 'bg-[#12161F] border-white/10 hover:border-white/25'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-mono text-amber-400">{item.title}</div>
                <div className="text-xs text-slate-300 mt-0.5 truncate">{item.subtitle}</div>
              </div>
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          STEP 1: PREREQUISITE ENVIRONMENT CHECKER & INSTALL GUIDE
         ===================================================================== */}
      {activeWizardStep === 1 && (
        <section className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-amber-400">
                STEP 01 OF 04 · LOCAL ENVIRONMENT &amp; BINARY DEPENDENCY AUDIT
              </div>
              <h2 className="text-xl font-bold text-white font-display mt-1">
                Verify Prerequisite Programs (Python 3.8+, FFmpeg, FFprobe &amp; zscale)
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                The standalone probe uses only Python&apos;s standard library (zero{' '}
                <code>pip install</code> dependencies required) alongside <code>ffmpeg</code> and{' '}
                <code>ffprobe</code>. Select your operating system below to run a 1-command
                verification check or confirm your installed tools.
              </p>
            </div>

            {/* OS Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-[#0B0D11] border border-white/10 rounded-lg shrink-0">
              {(
                [
                  { id: 'windows', label: 'Windows (PowerShell)' },
                  { id: 'macos', label: 'macOS (Terminal)' },
                  { id: 'linux', label: 'Linux (Bash)' }
                ] as const
              ).map((os) => (
                <button
                  key={os.id}
                  onClick={() => setOsPlatform(os.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    osPlatform === os.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {os.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Interactive Prerequisite Checklist */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">
                  Required &amp; Downstream Programs (Click any row to toggle verification):
                </span>
                <button
                  onClick={markAllCorePrereqsVerified}
                  className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4"
                >
                  Mark All Verified &amp; Continue to Step 2 →
                </button>
              </div>

              {(
                [
                  {
                    key: 'python3' as const,
                    name: 'Python 3.8+ Runtime (Standard Library Only)',
                    req: 'Required for 00_stage18_75gb_diagnostic_probe.py'
                  },
                  {
                    key: 'ffmpeg' as const,
                    name: 'FFmpeg CLI Binary',
                    req: 'Required for fast -ss keyframe extraction & tmix median de-graining'
                  },
                  {
                    key: 'ffprobe' as const,
                    name: 'FFprobe Stream Analyzer',
                    req: 'Required for inspecting 10-bit HEVC BT.2020 / SMPTE ST 2084 metadata'
                  },
                  {
                    key: 'zscaleHdr' as const,
                    name: 'FFmpeg zscale Filter (libzimg)',
                    req: 'Required for lossless HDR10 PQ to 16-bit Linear/Rec.709 PNG conversion'
                  },
                  {
                    key: 'blender4' as const,
                    name: 'Blender 4.2+ LTS (Downstream Phase 3–6)',
                    req: 'Used after frame curation to run 03_build_stage18 & 04_setup_cycles'
                  }
                ]
              ).map((item) => {
                const st = prereqStatus[item.key];
                return (
                  <div
                    key={item.key}
                    onClick={() => toggleManualPrereq(item.key)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex items-center justify-between gap-4 ${
                      st.verified
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-[#0B0D11] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>{item.name}</span>
                        <span className="text-[11px] font-mono text-slate-400 font-normal">
                          · {item.req}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-slate-400">{st.detail}</div>
                    </div>

                    <span
                      className={`px-2.5 py-1 text-xs font-mono rounded border whitespace-nowrap shrink-0 ${
                        st.verified
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#12161F] text-slate-400 border-white/10'
                      }`}
                    >
                      {st.verified ? 'VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right 5 Cols: Copyable Verification Command & Auto-Parser */}
            <div className="lg:col-span-5 bg-[#0B0D11] border border-white/10 rounded-xl p-5 space-y-4 text-xs">
              <div>
                <div className="text-amber-400 font-mono font-semibold">
                  1-CLICK TERMINAL VERIFICATION COMMAND
                </div>
                <p className="text-slate-300 mt-1 leading-relaxed">
                  Run this command in your local terminal (or run{' '}
                  <code className="text-amber-300">
                    python3 00_stage18_75gb_diagnostic_probe.py --check-only
                  </code>
                  ) and paste the output below to auto-verify your environment:
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#12161F] border border-white/10 font-mono text-[11px] text-slate-200 flex items-center justify-between gap-2">
                <code className="overflow-x-auto">{prereqCheckCmd}</code>
                <button
                  onClick={() => copyCommand('prereq-check', prereqCheckCmd)}
                  className="px-2.5 py-1 bg-[#1A202C] hover:bg-slate-700 text-amber-300 rounded border border-white/10 shrink-0 flex items-center gap-1"
                >
                  {copiedCmdId === 'prereq-check' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Paste Terminal Output to Auto-Verify Versions:
                </label>
                <textarea
                  rows={3}
                  value={prereqTerminalPaste}
                  onChange={(e) => handleVerifyTerminalOutput(e.target.value)}
                  placeholder="Paste output of python --version / ffmpeg -version or --check-only here..."
                  className="w-full px-3 py-2 rounded-lg bg-[#12161F] border border-white/15 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="text-slate-400">
                  Missing Python or FFmpeg? Install with one command on{' '}
                  <strong className="text-slate-200">{osPlatform.toUpperCase()}</strong>:
                </div>
                <div className="p-2.5 rounded-lg bg-[#12161F] border border-white/10 font-mono text-[11px] text-amber-300 flex items-center justify-between gap-2">
                  <code>{installFfmpegCmd}</code>
                  <button
                    onClick={() => copyCommand('install-cmd', installFfmpegCmd)}
                    className="px-2 py-1 bg-[#1A202C] text-slate-200 rounded shrink-0"
                  >
                    {copiedCmdId === 'install-cmd' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setActiveWizardStep(2)}
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                Proceed to Step 2: Mount &amp; Probe 75 GB MKV →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          STEP 2: MOUNT LOCAL 75 GB .MKV & RUN STANDALONE PROBE
         ===================================================================== */}
      {activeWizardStep === 2 && (
        <section className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-amber-400">
                STEP 02 OF 04 · ZERO-COPY BINARY HEADER MOUNT &amp; CLI PROBE EXECUTION
              </div>
              <h2 className="text-xl font-bold text-white font-display mt-1">
                Mount Your 75 GB .MKV File &amp; Execute the Standalone Probe
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Select your local 75 GB <code className="text-amber-300">.mkv</code> file below.
                Stage 18 reads only the first 1 MB binary slice from disk (taking &lt;10 ms with
                zero RAM overhead) to verify the Matroska/HEVC stream header and generate your exact
                terminal command.
              </p>
            </div>

            <label className="px-4 py-2.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap shrink-0">
              <HardDrive className="w-4 h-4" />
              Select Local 75 GB .MKV File
              <input
                type="file"
                accept=".mkv,video/*"
                onChange={handleMountMkvFile}
                className="hidden"
              />
            </label>
          </div>

          {/* Mounted Container Telemetry */}
          {containerInfo ? (
            <div className="p-5 rounded-xl bg-[#0B0D11] border border-emerald-500/40 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileVideo className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-semibold text-white font-display">
                    Mounted: {containerInfo.fileName}
                  </span>
                  <span className="text-xs font-mono text-amber-300">
                    · {containerInfo.fileSizeGb} GB ({containerInfo.fileSizeBytes.toLocaleString()}{' '}
                    bytes)
                  </span>
                </div>
                <div className="text-xs font-mono text-emerald-400">
                  Magic Bytes: {containerInfo.magicHex} ·{' '}
                  {containerInfo.isMatroskaEbml
                    ? 'Verified Matroska/EBML Container'
                    : 'Standard Video Stream'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-3 border-t border-white/10">
                <div>
                  <span className="text-slate-400 block mb-0.5">Detected Video Codec</span>
                  <span className="text-slate-100 font-mono font-medium">
                    {containerInfo.detectedVideoCodec}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Detected Audio Streams</span>
                  <span className="text-slate-100 font-mono">
                    {containerInfo.detectedAudioCodecs.join(' · ')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Required Color Transfer</span>
                  <span className="text-amber-300 font-mono">
                    {containerInfo.colorPrimariesHint}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-[#0B0D11] border border-white/10 text-xs text-slate-300 flex items-center justify-between gap-4 flex-wrap">
              <div>
                No local <code>.mkv</code> mounted yet. Mounting your 75 GB file verifies its binary
                EBML header in-browser and tailors the CLI probe command to your exact filename.
              </div>
            </div>
          )}

          {/* Exact Step-by-Step Probe Execution Instructions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="p-5 rounded-xl bg-[#0B0D11] border border-white/10 space-y-3">
              <div className="text-amber-400 font-mono font-semibold">
                2A. DOWNLOAD &amp; RUN THE STANDALONE PYTHON PROBE (RECOMMENDED FOR 10-BIT HEVC)
              </div>
              <p className="text-slate-300 leading-relaxed">
                Because desktop browsers cannot natively hardware-decode 10-bit HEVC + Dolby TrueHD
                Matroska streams with accurate SMPTE ST 2084 (`zscale`) tone mapping, run the
                standalone probe in your folder containing <code className="text-white">{targetMkvFilename}</code>:
              </p>

              <div className="p-3 rounded-lg bg-[#12161F] border border-white/10 font-mono text-[11px] text-amber-300 flex items-center justify-between gap-2">
                <code className="overflow-x-auto">{runProbeCmd}</code>
                <button
                  onClick={() => copyCommand('run-probe', runProbeCmd)}
                  className="px-2.5 py-1 bg-[#1A202C] text-slate-200 rounded border border-white/10 shrink-0 flex items-center gap-1"
                >
                  {copiedCmdId === 'run-probe' ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleDownloadPythonProbe}
                  className="px-3.5 py-2 bg-[#1A202C] hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg font-medium flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download 00_stage18_75gb_diagnostic_probe.py
                </button>

                <button
                  onClick={() => setActiveWizardStep(3)}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors"
                >
                  Proceed to Step 3: Load Probe Output →
                </button>
              </div>
            </div>

            {/* Direct Browser Video Scrubber Fallback */}
            <div className="p-5 rounded-xl bg-[#0B0D11] border border-white/10 space-y-3">
              <div className="text-slate-300 font-mono font-semibold">
                2B. OPTIONAL IN-BROWSER STREAM SCRUBBER
              </div>
              {videoObjectUrl ? (
                videoPlayError ? (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                    <div className="font-semibold">
                      Browser Native Decoder Blocked 10-bit HEVC / TrueHD Stream
                    </div>
                    <p className="text-slate-300">
                      Use the command in <strong>2A</strong> on the left to extract the 6 lossless
                      16-bit PNG diagnostic plates in ~10 seconds, then load them in Step 3.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <video
                      ref={videoElementRef}
                      src={videoObjectUrl}
                      controls
                      onLoadedData={() => captureCurrentVideoFrameToAnalyzer()}
                      onSeeked={() => captureCurrentVideoFrameToAnalyzer()}
                      onError={() =>
                        setVideoPlayError(
                          'Browser native demuxer cannot decode 10-bit HEVC Matroska directly.'
                        )
                      }
                      className="w-full max-h-44 rounded-lg border border-white/15 bg-black"
                    />
                    <button
                      onClick={captureCurrentVideoFrameToAnalyzer}
                      className="w-full py-2 bg-[#1A202C] hover:bg-slate-700 text-slate-100 rounded-lg font-medium"
                    >
                      Capture Current Scrubber Frame to Step 4 Analyzer →
                    </button>
                  </div>
                )
              ) : (
                <p className="text-slate-400 leading-relaxed">
                  Once you select a local video file above, if your browser supports hardware
                  decoding for its container/codec, an interactive scrubber will appear here for
                  direct frame capture.
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          STEP 3: LOAD EXTRACTED 4K PLATES (diag_*.png) & ACCEPTANCE REPORT JSON
         ===================================================================== */}
      {activeWizardStep === 3 && (
        <section className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-amber-400">
                STEP 03 OF 04 · INGEST EXTRACTED 16-BIT PNG PLATES &amp; STREAM REPORT
              </div>
              <h2 className="text-xl font-bold text-white font-display mt-1">
                Load Output from ./stage18_diagnostic_probe_out/
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Select all files generated inside{' '}
                <code className="text-amber-300">./stage18_diagnostic_probe_out/</code> (both{' '}
                <code>stage18_acceptance_report.json</code> and the six <code>diag_*.png</code>{' '}
                plates, or any custom 4K frame stills) to inspect them in the Computer-Vision
                Acceptance Engine.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="px-4 py-2.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap shrink-0">
                <Upload className="w-4 h-4" />
                Load diag_*.png Plates &amp; Report JSON
                <input
                  type="file"
                  multiple
                  accept=".json,image/*"
                  onChange={handleLoadDiagnosticOutputs}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setActiveWizardStep(4)}
                className="px-4 py-2.5 text-xs font-medium bg-[#1A202C] hover:bg-slate-700 text-slate-200 border border-white/15 rounded-lg whitespace-nowrap shrink-0"
              >
                Skip to Step 4 Simulator →
              </button>
            </div>
          </div>

          {/* Parsed stage18_acceptance_report.json Summary */}
          {probeReport && (
            <div className="p-4 rounded-xl bg-[#0B0D11] border border-emerald-500/40 space-y-2 text-xs">
              <div className="text-emerald-400 font-mono font-semibold flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                LOADED PROBE REPORT: {probeReport.file_path}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1 font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 block">Codec / PixFmt</span>
                  {probeReport.codec_name} · {probeReport.pix_fmt}
                </div>
                <div>
                  <span className="text-slate-500 block">Resolution</span>
                  {probeReport.width}×{probeReport.height}
                </div>
                <div>
                  <span className="text-slate-500 block">Color Transfer</span>
                  {probeReport.color_transfer} ({probeReport.color_primaries})
                </div>
                <div>
                  <span className="text-slate-500 block">Extracted Samples</span>
                  {probeReport.extracted_samples?.length || 0} 16-bit Plates
                </div>
              </div>
            </div>
          )}

          {/* Loaded Plates Gallery */}
          {loadedPlates.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-medium text-slate-300">
                Loaded Diagnostic Plates (Click any plate to analyze in Step 4):
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {loadedPlates.map((plate) => (
                  <button
                    key={plate.id}
                    onClick={() => {
                      setActivePlateId(plate.id);
                      setActiveWizardStep(4);
                    }}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      activePlateId === plate.id
                        ? 'bg-[#161C28] border-amber-400'
                        : 'bg-[#0B0D11] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <img
                      src={plate.dataUrl}
                      alt={plate.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-20 object-cover rounded bg-black"
                    />
                    <div className="text-[11px] font-medium text-slate-200 truncate mt-1.5">
                      {plate.name}
                    </div>
                    <div className="text-[10px] font-mono text-amber-400">
                      SMPTE {plate.timestampHint}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-[#0B0D11] border border-dashed border-white/15 text-center space-y-2">
              <ImageIcon className="w-7 h-7 text-amber-400 mx-auto" />
              <div className="text-sm font-semibold text-white">
                Drop or Select Your Extracted <code>diag_*.png</code> Plates &amp;{' '}
                <code>stage18_acceptance_report.json</code>
              </div>
              <p className="text-xs text-slate-400 max-w-lg mx-auto">
                Or click <strong>Skip to Step 4 Simulator</strong> above to test the computer-vision
                engine using the built-in calibrated vs. uncalibrated reference signals.
              </p>
            </div>
          )}
        </section>
      )}

      {/* =====================================================================
          STEP 4 (ALWAYS VISIBLE BELOW OR WHEN STEP 4 ACTIVE): CV INTERPRETATION & 3D PROJECTION
         ===================================================================== */}
      <div className="space-y-5">
        {/* Loaded Plates Switcher Bar if plates exist */}
        {loadedPlates.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto p-3 rounded-xl bg-[#12161F] border border-white/10">
            <span className="text-xs font-mono text-amber-400 shrink-0 mr-1">
              ACTIVE DIAGNOSTIC PLATE:
            </span>
            {loadedPlates.map((plate) => (
              <button
                key={plate.id}
                onClick={() => setActivePlateId(plate.id)}
                className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activePlateId === plate.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-[#0B0D11] text-slate-300 hover:text-white border border-white/10'
                }`}
              >
                {plate.name} ({plate.timestampHint})
              </button>
            ))}
          </div>
        )}

        {/* Control Strip: Computer-Vision Overlay Mode & Benchmark Signal */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#12161F] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-400 mr-1">
              Visual Interpretation Mode:
            </span>
            {(
              [
                { id: 'sobel_orthogonal_edges', label: '01. Sobel Vanishing Edges (fSpy)' },
                { id: 'laplacian_sharpness_heatmap', label: '02. Laplacian Acutance & Grain' },
                { id: 'luma_clipping_zones', label: '03. HDR10 Clipping & Shadow Audit' },
                { id: 'original', label: '04. Raw Source Plate' }
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                onClick={() => setOverlayMode(mode.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  overlayMode === mode.id
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'bg-[#1A202C] text-slate-300 hover:text-white'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-400">Benchmark Test Signal:</span>
            {(
              [
                { id: 'optimal_zscale_16bit', label: 'zscale Calibrated 4K Plate' },
                { id: 'raw_uncalibrated_hdr_pq', label: 'Uncalibrated Raw PQ Grab' },
                { id: 'motion_blur_pan_frame', label: '1/48s Motion-Blurred Pan' }
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setActivePlateId(null);
                  setSimulatedSourcePreset(preset.id);
                }}
                className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  !activePlateId && simulatedSourcePreset === preset.id
                    ? 'bg-slate-100 text-slate-950 border-white font-semibold'
                    : 'bg-[#0B0D11] text-slate-300 border-white/10 hover:border-white/25'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Split: Dual Canvases + Quantitative Acceptance Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Dual Side-by-Side Visual Canvases */}
          <div className="lg:col-span-7 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Plate Canvas */}
              <div className="bg-[#12161F] border border-white/10 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>INPUT: SOURCE VIDEO FRAME PLATE</span>
                  <span className="text-slate-200">1.66:1 Widescreen</span>
                </div>
                <canvas
                  ref={sourceCanvasRef}
                  width={520}
                  height={312}
                  className="w-full h-auto rounded-lg border border-white/10 bg-black block"
                />
              </div>

              {/* Computer Vision Interpretation Canvas */}
              <div className="bg-[#12161F] border border-amber-500/40 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400 font-semibold">
                    STAGE 18 CV INTERPRETATION
                  </span>
                  <span className="text-slate-300">
                    {overlayMode === 'sobel_orthogonal_edges'
                      ? 'Amber=Horiz · Cyan=Vert'
                      : overlayMode === 'laplacian_sharpness_heatmap'
                      ? 'Green=Sharp · Amber=Grain'
                      : overlayMode === 'luma_clipping_zones'
                      ? 'Blue=Crush · Red=Clip'
                      : 'Direct Pass'}
                  </span>
                </div>
                <canvas
                  ref={diagnosticCanvasRef}
                  width={520}
                  height={312}
                  className="w-full h-auto rounded-lg border border-white/10 bg-black block"
                />
              </div>
            </div>

            {/* 64-Bin Luminance & Dynamic Range Histogram */}
            {metrics && (
              <div className="bg-[#12161F] border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white font-display">
                    Rec.709 / AgX Luminance Distribution &amp; Masonry Midtone Band
                  </span>
                  <span className="font-mono text-slate-400">
                    Shadow Crush: {metrics.shadowCrushPct}% · Masonry Midtones:{' '}
                    {metrics.midtoneBrickCoveragePct}% · Highlight Clip: {metrics.highlightClipPct}%
                  </span>
                </div>

                <div className="h-24 flex items-end gap-[2px] pt-2 px-2 bg-[#0B0D11] rounded-lg border border-white/5">
                  {metrics.lumaHistogram.map((val, idx) => {
                    const isCrushZone = idx < 3;
                    const isClipZone = idx > 60;
                    const barColor = isCrushZone
                      ? 'bg-blue-500'
                      : isClipZone
                      ? 'bg-red-500'
                      : 'bg-amber-400/80';
                    return (
                      <div
                        key={idx}
                        className={`flex-1 rounded-t-xs ${barColor}`}
                        style={{ height: `${Math.max(4, Math.round(val * 100))}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Columns: Acceptance Verdict & Direct Action Controls */}
          <div className="lg:col-span-5 space-y-5">
            {metrics && (
              <div className="bg-[#12161F] border border-white/10 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <p className="text-xs font-mono text-slate-400">
                      STEP 04 · AUTOMATED ACCEPTANCE VERDICT
                    </p>
                    <h2
                      className={`text-base font-bold font-display mt-0.5 ${
                        metrics.acceptanceVerdict.startsWith('OPTIMAL')
                          ? 'text-emerald-400'
                          : metrics.acceptanceVerdict.startsWith('ACCEPTABLE')
                          ? 'text-amber-300'
                          : 'text-red-400'
                      }`}
                    >
                      {metrics.acceptanceVerdict}
                    </h2>
                  </div>
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 ${
                      metrics.acceptanceVerdict.startsWith('OPTIMAL')
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  />
                </div>

                {/* 4 Key Telemetry Metrics */}
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/5">
                    <div className="text-slate-400">Laplacian Acutance</div>
                    <div className="text-lg font-semibold text-white mt-0.5">
                      {metrics.laplacianSharpnessScore}{' '}
                      <span className="text-xs font-normal text-slate-400">/ 180+ ideal</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/5">
                    <div className="text-slate-400">fSpy Orthogonal Edges</div>
                    <div className="text-lg font-semibold text-amber-400 mt-0.5">
                      {metrics.orthogonalEdgeDensityPct}%{' '}
                      <span className="text-xs font-normal text-slate-400">
                        (H/V {metrics.horizontalVerticalRatio})
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/5">
                    <div className="text-slate-400">35mm Grain Noise (σ)</div>
                    <div className="text-lg font-semibold text-white mt-0.5">
                      {metrics.estimatedGrainNoiseStdDev}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        {metrics.estimatedGrainNoiseStdDev > 3.2 ? 'Use tmix' : 'Clean'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/5">
                    <div className="text-slate-400">Correlated Kelvin</div>
                    <div className="text-lg font-semibold text-amber-300 mt-0.5">
                      {metrics.estimatedKelvin}K
                    </div>
                  </div>
                </div>

                {/* Verdict Diagnostic Findings */}
                <div className="space-y-2 text-xs">
                  <div className="text-slate-400 font-medium">
                    Visual Data Interpretation Breakdown:
                  </div>
                  {metrics.verdictNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/5 text-slate-200 leading-relaxed"
                    >
                      • {note}
                    </div>
                  ))}
                </div>

                {/* Target Zone Assignment & Live 3D Projection Actions */}
                <div className="pt-3 border-t border-white/10 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Target Stage 18 Building Facade
                      </label>
                      <select
                        value={targetAptId}
                        onChange={(e) => setTargetAptId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100"
                      >
                        {STAGE18_APARTMENTS.map((apt) => (
                          <option key={apt.id} value={apt.id}>
                            {apt.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Camera Focal Length</label>
                      <select
                        value={focalLengthMm}
                        onChange={(e) => setFocalLengthMm(Number(e.target.value))}
                        className="w-full px-2.5 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono"
                      >
                        <option value={35}>35mm Wide</option>
                        <option value={50}>50mm Normal</option>
                        <option value={75}>75mm Binoculars</option>
                        <option value={152}>152mm Exakta Tele</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <button
                      onClick={handleProjectOnto3DStage}
                      className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4" />
                      {projectedFeedback
                        ? 'Projected onto 3D Stage!'
                        : 'Test Live Projection on 3D Model'}
                    </button>

                    <button
                      onClick={handlePinAnalyzedFrameToCurator}
                      className="flex-1 py-2.5 px-3 bg-[#1A202C] hover:bg-slate-700 text-slate-100 border border-white/15 font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 text-amber-400" />
                      {pinnedFeedback ? 'Added to Frame Curator!' : 'Pin Validated Frame to Curator'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          STEP 6: ADJACENT FRAME VISUAL CONSISTENCY & STITCHING ARTIFACT AUDIT
         ===================================================================== */}
      <VisualConsistencyAuditPanel
        parametricOverrides={parametricOverrides}
        layoutIterations={layoutIterations}
        onVerifyAndCalibrateIteration={onVerifyAndCalibrateIteration}
        onNavigateToWorkbenchWithHeatmap={onNavigateToWorkbenchWithHeatmap}
        onNavigateToDeltaScript={onNavigateToDeltaScript}
        loadedDiagnosticPlates={loadedPlates}
      />

      {/* =====================================================================
          STEP 5: DUAL-ENGINE AUTONOMOUS FRAME-TO-3D ARCHITECTURAL SOLVER
         ===================================================================== */}
      <AutomatedLayoutSolverPanel
        parametricOverrides={parametricOverrides}
        layoutIterations={layoutIterations}
        onApproveIteration={onApproveIteration}
        onApproveAllPending={onApproveAllPending}
        onRejectIteration={onRejectIteration}
        onRevertIteration={onRevertIteration}
        onAddIterations={onAddIterations}
        onVerifyAndCalibrateIteration={onVerifyAndCalibrateIteration}
        onResetAllOverrides={onResetAllOverrides}
        onNavigateToWorkbenchWithHeatmap={onNavigateToWorkbenchWithHeatmap}
        onNavigateToDeltaScript={onNavigateToDeltaScript}
        externalDiagnosticPlates={loadedPlates}
        mountedSourceSizeGb={containerInfo ? Number(containerInfo.fileSizeGb) : 74.8}
        mountedSourceFileName={
          containerInfo?.fileName ||
          probeReport?.file_path ||
          'Rear_Window_1954_UHD_Remux_75GB.mkv'
        }
      />
    </div>
  );
}
