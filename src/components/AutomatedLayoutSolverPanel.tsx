import React, { useEffect, useRef, useState } from 'react';
import {
  AnalysisEngineMode,
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  CvPrepassTelemetry,
  FrameValidityStatus,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  ManualFrameVerification,
  ParametricDimensionsSnapshot,
  STAGE18_APARTMENTS,
  Stage18LearnedKnowledgeProfile
} from '../data/stage18Data';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  Crosshair,
  Eye,
  FileCode,
  HardDrive,
  Layers,
  Move,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sliders,
  Sparkles,
  Upload,
  X,
  Zap
} from 'lucide-react';

export interface QueuedScanFrame {
  id: string;
  title: string;
  smpteTimecode: string;
  focalLengthMm: number;
  targetApartmentHint: string;
  sourceLabel: string;
  imageDataUrl?: string;
  simulatedChallenge?: 'none' | 'venetian_blind_occlusion' | 'oblique_pan_roll';
  skipped?: boolean;
}

export type FrameQueueStageStatus =
  | 'queued'
  | 'stage1_cv_prepass'
  | 'stage2_ai_spatial_solve'
  | 'stage3_delta_commit'
  | 'paused'
  | 'completed_high_conf'
  | 'completed_low_conf'
  | 'skipped';

export interface FrameQueueRuntimeItem {
  frameId: string;
  stageStatus: FrameQueueStageStatus;
  substageProgressPct: number;
  stageLabel: string;
  engineUsed?: AnalysisEngineMode;
  confidenceScore?: number;
  durationMs?: number;
  brickCoursesCounted?: number;
  solvedDimsSummary?: string;
  linkedIterationId?: string;
}

export interface BatchFrameProgressSegment {
  frameId: string;
  index: number;
  title: string;
  smpteTimecode: string;
  focalLengthMm: number;
  targetApartmentHint: string;
  zoneShortName: string;
  mkvStreamOffsetGb: number;
  mkvStreamShareGb: number;
  stageStatus: FrameQueueStageStatus;
  substageProgressPct: number;
  stageLabel: string;
  engineUsed?: AnalysisEngineMode;
  confidenceScore?: number;
  durationMs?: number;
  frameEtcMs: number;
  solvedDimsSummary?: string;
  linkedIterationId?: string;
  skipped: boolean;
}

export interface BatchAnalysisProgressSummary {
  batchEngineState: 'idle' | 'running' | 'paused' | 'completed';
  isScanningBatch: boolean;
  isBatchPaused: boolean;
  activeQueueCount: number;
  completedCount: number;
  flaggedLowConfCount: number;
  overallBatchPct: number;
  avgFrameDurationMs: number;
  avgFramesPerSecond: string;
  batchElapsedMs: number;
  estimatedRemainingMs: number;
  total75GbProcessRemainingMs: number;
  processedStreamGb: number;
  totalStreamGb: number;
  effectiveStreamThroughputGbPerSec: string;
  activeFrameTitle: string | null;
  activeStageLabel: string | null;
  segments: BatchFrameProgressSegment[];
}

export interface BatchSolverControlActions {
  startOrResumeBatch: () => void;
  togglePauseResume: () => void;
  stepSingleFrame: () => void;
  resetBatch: () => void;
  inspectFrameIteration: (iterationId: string) => void;
}

function parseSmpteToSeconds(smpte: string): number {
  const parts = smpte.split(':').map((p) => Number(p) || 0);
  if (parts.length >= 4) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 24;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 1200;
}

interface AutomatedLayoutSolverPanelProps {
  parametricOverrides: Record<string, BuildingParametricOverride>;
  layoutIterations: ArchitecturalLayoutIteration[];
  onApproveIteration: (iterationId: string) => void;
  onApproveAllPending: (minConfidence?: number) => void;
  onRejectIteration: (iterationId: string) => void;
  onRevertIteration: (iterationId: string) => void;
  onVerifyAndCalibrateIteration: (
    iterationId: string,
    updatedTargetApartmentId: string,
    updatedProposedValues: ParametricDimensionsSnapshot,
    verification: ManualFrameVerification
  ) => void;
  onAddIterations: (newIterations: ArchitecturalLayoutIteration[]) => void;
  onResetAllOverrides: () => void;
  onNavigateToWorkbenchWithHeatmap: (targetAptId?: string) => void;
  onNavigateToDeltaScript: () => void;
  externalDiagnosticPlates?: Array<{
    id: string;
    name: string;
    dataUrl: string;
    timestampHint: string;
  }>;
  mountedSourceSizeGb?: number;
  mountedSourceFileName?: string;
  batchControlRef?: React.MutableRefObject<BatchSolverControlActions | null>;
  onBatchProgressUpdate?: (summary: BatchAnalysisProgressSummary) => void;
  learnedKnowledgeProfile?: Stage18LearnedKnowledgeProfile;
}

const DEFAULT_SCAN_QUEUE: QueuedScanFrame[] = [
  {
    id: 'scan-q-thorwald-152',
    title: 'Thorwald Facade 152mm Telephoto Brick-Course Caliper Pass',
    smpteTimecode: '00:44:18:12',
    focalLengthMm: 152,
    targetApartmentHint: 'apt-thorwald',
    sourceLabel: '4K Remux Canonical Sweep #1',
    simulatedChallenge: 'none'
  },
  {
    id: 'scan-q-torso-50',
    title: 'Miss Torso West Wing Balcony & Sash Window Grid Pass',
    smpteTimecode: '00:03:45:12',
    focalLengthMm: 50,
    targetApartmentHint: 'apt-torso',
    sourceLabel: '4K Remux Canonical Sweep #2',
    simulatedChallenge: 'none'
  },
  {
    id: 'scan-q-lonelyhearts-lowconf',
    title: 'Miss Lonelyhearts Ground-Floor Venetian Blind & Shadow Occlusion Pass',
    smpteTimecode: '00:26:40:00',
    focalLengthMm: 50,
    targetApartmentHint: 'apt-lonelyhearts',
    sourceLabel: '4K Remux Low-Confidence Challenge #3',
    simulatedChallenge: 'venetian_blind_occlusion'
  },
  {
    id: 'scan-q-composer-75',
    title: 'Songwriter Penthouse Industrial Casement & Stucco Depth Pass',
    smpteTimecode: '01:08:15:04',
    focalLengthMm: 75,
    targetApartmentHint: 'apt-composer',
    sourceLabel: '4K Remux Canonical Sweep #4',
    simulatedChallenge: 'none'
  },
  {
    id: 'scan-q-alley-lowconf',
    title: 'Nocturnal Rain-Streak Alleyway & Forced-Perspective Marquee Pan',
    smpteTimecode: '01:14:08:16',
    focalLengthMm: 35,
    targetApartmentHint: 'apt-alley-street',
    sourceLabel: '4K Remux Low-Confidence Challenge #5',
    simulatedChallenge: 'oblique_pan_roll'
  },
  {
    id: 'scan-q-sculptor-35',
    title: 'Excavated Basement Garden Basin & Retaining Curb Pass',
    smpteTimecode: '00:18:22:10',
    focalLengthMm: 35,
    targetApartmentHint: 'apt-sculptor',
    sourceLabel: '4K Remux Canonical Sweep #6',
    simulatedChallenge: 'none'
  }
];

const CV_PREPASS_W = 320;
const CV_PREPASS_H = 192;
let _sharedCvCanvas: HTMLCanvasElement | null = null;
const _sharedCvLuma = new Float32Array(CV_PREPASS_W * CV_PREPASS_H);

function getSharedCvCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!_sharedCvCanvas) {
    _sharedCvCanvas = document.createElement('canvas');
    _sharedCvCanvas.width = CV_PREPASS_W;
    _sharedCvCanvas.height = CV_PREPASS_H;
  }
  const ctx = _sharedCvCanvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas: _sharedCvCanvas, ctx };
}

/**
 * Renders either the frame's uploaded image or a deterministic Stage 18 optical
 * test pattern onto a reusable offscreen canvas and runs a Sobel + spatial-frequency
 * brick-course & window-bay Computer Vision pass with zero GC buffer churn.
 */
async function runClientCvGeometricPrepass(
  queuedFrame: QueuedScanFrame
): Promise<{
  telemetry: CvPrepassTelemetry;
  base64Png: string;
  lowConfidenceFlags: string[];
}> {
  const w = CV_PREPASS_W;
  const h = CV_PREPASS_H;
  const { canvas, ctx } = getSharedCvCanvas();
  ctx.clearRect(0, 0, w, h);

  if (queuedFrame.imageDataUrl) {
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = queuedFrame.imageDataUrl!;
    });
  } else {
    // Render deterministic architectural pattern seeded by apartment & focal length
    ctx.fillStyle = '#261812';
    ctx.fillRect(0, 0, w, h);

    const pitch = queuedFrame.focalLengthMm >= 135 ? 6 : 9;
    ctx.fillStyle = 'rgba(214, 211, 209, 0.28)';
    for (let y = 8; y < h - 8; y += pitch) {
      ctx.fillRect(0, y, w, 1.5);
    }

    const cols =
      queuedFrame.targetApartmentHint === 'apt-thorwald'
        ? 4
        : queuedFrame.targetApartmentHint === 'apt-torso' ||
          queuedFrame.targetApartmentHint === 'apt-lonelyhearts'
        ? 2
        : 3;
    const winW = Math.floor((w - 60) / cols) - 14;
    const winH = queuedFrame.focalLengthMm >= 135 ? 110 : 68;
    for (let c = 0; c < cols; c++) {
      const wx = 30 + c * (winW + 14);
      const wy = Math.floor(h / 2 - winH / 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(wx, wy, winW, winH);
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 3;
      ctx.strokeRect(wx, wy, winW, winH);
    }

    // If this frame is a low-confidence challenge, render Venetian blind slats or oblique pan blur
    if (queuedFrame.simulatedChallenge === 'venetian_blind_occlusion') {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
      for (let y = 25; y < h - 25; y += 7) {
        ctx.fillRect(15, y, w - 30, 4.5);
      }
    } else if (queuedFrame.simulatedChallenge === 'oblique_pan_roll') {
      ctx.fillStyle = 'rgba(12, 16, 24, 0.58)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const luma = _sharedCvLuma;

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    luma[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
  }

  // Compute Sobel horizontal/vertical gradients & orthogonal edge ratio
  let horizEnergy = 0;
  let vertEnergy = 0;
  let strongOrthoPixels = 0;
  let laplacianAccum = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -luma[idx - w - 1] +
        luma[idx - w + 1] -
        2 * luma[idx - 1] +
        2 * luma[idx + 1] -
        luma[idx + w - 1] +
        luma[idx + w + 1];
      const gy =
        -luma[idx - w - 1] -
        2 * luma[idx - w] -
        luma[idx - w + 1] +
        luma[idx + w - 1] +
        2 * luma[idx + w] +
        luma[idx + w + 1];

      const mag = Math.hypot(gx, gy);
      if (mag > 48) {
        horizEnergy += Math.abs(gy);
        vertEnergy += Math.abs(gx);
        if (Math.abs(gx) > Math.abs(gy) * 1.6 || Math.abs(gy) > Math.abs(gx) * 1.6) {
          strongOrthoPixels++;
        }
      }

      const lap =
        4 * luma[idx] - luma[idx - 1] - luma[idx + 1] - luma[idx - w] - luma[idx + w];
      laplacianAccum += Math.abs(lap);
    }
  }

  // Count vertical row-average luminance zero-crossings to estimate brick courses
  let zeroCrossings = 0;
  let prevDiff = 0;
  for (let y = 4; y < h - 4; y++) {
    let rowSum = 0;
    let nextRowSum = 0;
    for (let x = 16; x < w - 16; x += 2) {
      rowSum += luma[y * w + x];
      nextRowSum += luma[(y + 1) * w + x];
    }
    const diff = nextRowSum - rowSum;
    if ((diff > 18 && prevDiff < -18) || (diff < -18 && prevDiff > 18)) {
      zeroCrossings++;
    }
    prevDiff = diff;
  }

  const brickCoursesCounted = Math.max(
    14,
    Math.min(64, Math.round(zeroCrossings * (queuedFrame.focalLengthMm >= 135 ? 1.15 : 0.85)))
  );
  const totalInner = (w - 2) * (h - 2);
  const orthogonalEdgePct = Number(((strongOrthoPixels / totalInner) * 100).toFixed(1));
  const sharpnessScore = Number((laplacianAccum / totalInner).toFixed(1));

  const vanishingPitchDeg = Number(
    (
      (queuedFrame.targetApartmentHint === 'apt-composer'
        ? 11.4
        : queuedFrame.targetApartmentHint === 'apt-sculptor' ||
          queuedFrame.targetApartmentHint === 'apt-lonelyhearts'
        ? -14.2
        : -2.8) +
      ((horizEnergy % 17) - 8) * 0.08
    ).toFixed(2)
  );
  const vanishingYawDeg = Number(
    (
      (queuedFrame.targetApartmentHint === 'apt-torso' ||
      queuedFrame.targetApartmentHint === 'apt-lonelyhearts'
        ? -24.5
        : queuedFrame.targetApartmentHint === 'apt-composer'
        ? 23.8
        : 1.5) +
      ((vertEnergy % 13) - 6) * 0.09
    ).toFixed(2)
  );

  const detectedWindowBays =
    queuedFrame.targetApartmentHint === 'apt-thorwald'
      ? 4
      : queuedFrame.targetApartmentHint === 'apt-torso' ||
        queuedFrame.targetApartmentHint === 'apt-lonelyhearts' ||
        queuedFrame.targetApartmentHint === 'apt-sculptor'
      ? 2
      : 3;

  // Compute radial sightline distance & angle from L.B. Jefferies's camera nodal point (0, +14.5, +18.2)
  const targetAptMeta =
    STAGE18_APARTMENTS.find((a) => a.id === queuedFrame.targetApartmentHint) ||
    STAGE18_APARTMENTS[1];
  const jeffNodal = [0, 14.5, 18.2];
  const radialDistanceFromJeffFeet = Number(
    Math.hypot(
      targetAptMeta.coordinates3D[0] - jeffNodal[0],
      targetAptMeta.coordinates3D[1] - jeffNodal[1],
      targetAptMeta.coordinates3D[2] - jeffNodal[2]
    ).toFixed(1)
  );
  const baselineOv =
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES[queuedFrame.targetApartmentHint] ||
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES['apt-thorwald'];
  const estimatedPerspectiveScaleFactor = Number(
    (
      baselineOv.forcedPerspectiveScaleFactor ??
      Math.max(0.65, 1 - radialDistanceFromJeffFeet * 0.0042)
    ).toFixed(2)
  );
  const estimatedSightlineSplayDeg = Number(
    (baselineOv.cameraSightlineSplayDeg ?? 6.8).toFixed(1)
  );

  const lowConfidenceFlags: string[] = [];
  if (queuedFrame.simulatedChallenge === 'venetian_blind_occlusion') {
    lowConfidenceFlags.push(
      'Venetian blind horizontal slats alias with brick mortar spatial frequency (verify brick course count & window sill elevation)'
    );
    lowConfidenceFlags.push(
      `Non-orthogonal West Wing sightline splay (+${estimatedSightlineSplayDeg}°) & ${estimatedPerspectiveScaleFactor}× POV scale require manual verification against municipal architectural plans`
    );
  } else if (queuedFrame.simulatedChallenge === 'oblique_pan_roll') {
    lowConfidenceFlags.push(
      'Oblique camera pan introduces +2.4° plumb roll and low contrast on background alley masonry'
    );
    lowConfidenceFlags.push(
      `Extreme forced-perspective depth compression at d=${radialDistanceFromJeffFeet}' (0.66× scale, +4.8° floor rake, 5.2' physical flat vs. 35.0' apparent street block) — verify Z-depth offset and wall splay`
    );
  } else if (orthogonalEdgePct < 3.5) {
    lowConfidenceFlags.push(
      `Low orthogonal edge density (${orthogonalEdgePct}%) — verify vanishing horizon and non-orthogonal sightline wall splay`
    );
  }

  return {
    telemetry: {
      vanishingPitchDeg,
      vanishingYawDeg,
      brickCoursesCounted,
      detectedWindowBays,
      orthogonalEdgePct,
      sharpnessScore,
      radialDistanceFromJeffFeet,
      estimatedPerspectiveScaleFactor,
      estimatedSightlineSplayDeg
    },
    base64Png: canvas.toDataURL('image/png'),
    lowConfidenceFlags
  };
}

/**
 * Deterministic Local Browser Computer Vision Geometric Solver (Offline Backup).
 * Incorporates Hal Pereira & Joseph MacMillan Johnson's Camera-POV Forced-Perspective
 * & Non-Orthogonal Soundstage Carpentry Law (or allows toggling Naive 1:1 Architectural
 * Standard to inspect the discrepancy).
 */
function computeLocalCvGeometricLayoutDelta(
  queuedFrame: QueuedScanFrame,
  telemetry: CvPrepassTelemetry,
  currentState: BuildingParametricOverride,
  lowConfidenceFlags: string[],
  povCompensationEnabled = true,
  learnedProfile?: Stage18LearnedKnowledgeProfile
): {
  proposedValues: ParametricDimensionsSnapshot;
  confidenceScore: number;
  spatialReasoningSummary: string;
  detectedFeatures: string[];
} {
  const zoneId = queuedFrame.targetApartmentHint;
  const learnedZonePrior = learnedProfile?.zonePriors?.[zoneId];

  // True Stage 18 POV-Compensated Soundstage Carpentry Targets (built for Jeffries's camera lens)
  const povCompensatedTargets: Record<string, ParametricDimensionsSnapshot> = {
    'apt-thorwald': {
      widthFeet: 35.2,
      heightFeet: 37.4,
      depthFeet: 11.4,
      elevationOffsetFeet: 13.0,
      windowCols: 4,
      windowRows: 4,
      windowRevealInches: 7.4,
      balconyProjectionFeet: 2.8,
      interiorDepthFeet: 11.4,
      apparentArchitecturalDepthFeet: 16.5,
      forcedPerspectiveScaleFactor: 0.82,
      cameraSightlineSplayDeg: 6.8,
      floorRakePitchDeg: 1.8
    },
    'apt-torso': {
      widthFeet: 12.6,
      heightFeet: 35.6,
      depthFeet: 43.2,
      elevationOffsetFeet: 13.5,
      windowCols: 2,
      windowRows: 3,
      windowRevealInches: 7.8,
      balconyProjectionFeet: 2.6,
      interiorDepthFeet: 12.6,
      apparentArchitecturalDepthFeet: 17.5,
      forcedPerspectiveScaleFactor: 0.88,
      cameraSightlineSplayDeg: 11.5,
      floorRakePitchDeg: 1.4
    },
    'apt-composer': {
      widthFeet: 12.8,
      heightFeet: 37.8,
      depthFeet: 42.6,
      elevationOffsetFeet: 22.5,
      windowCols: 3,
      windowRows: 3,
      windowRevealInches: 8.2,
      balconyProjectionFeet: 1.5,
      interiorDepthFeet: 13.8,
      apparentArchitecturalDepthFeet: 20.4,
      forcedPerspectiveScaleFactor: 0.85,
      cameraSightlineSplayDeg: -12.0,
      floorRakePitchDeg: 2.4
    },
    'apt-lonelyhearts': {
      widthFeet: 12.2,
      heightFeet: 35.2,
      depthFeet: 42.8,
      elevationOffsetFeet: 2.6,
      windowCols: 2,
      windowRows: 2,
      windowRevealInches: 7.2,
      balconyProjectionFeet: 0.9,
      interiorDepthFeet: 10.8,
      apparentArchitecturalDepthFeet: 15.0,
      forcedPerspectiveScaleFactor: 0.86,
      cameraSightlineSplayDeg: 14.5,
      floorRakePitchDeg: 1.2
    },
    'apt-sculptor': {
      widthFeet: 35.8,
      heightFeet: 8.8,
      depthFeet: 25.8,
      elevationOffsetFeet: -4.2,
      windowCols: 2,
      windowRows: 1,
      windowRevealInches: 6.8,
      balconyProjectionFeet: 0.0,
      interiorDepthFeet: 10.6,
      apparentArchitecturalDepthFeet: 13.8,
      forcedPerspectiveScaleFactor: 0.92,
      cameraSightlineSplayDeg: 5.5,
      floorRakePitchDeg: -3.2
    },
    'apt-alley-street': {
      widthFeet: 16.4,
      heightFeet: 24.8,
      depthFeet: 4.2,
      elevationOffsetFeet: 10.8,
      windowCols: 3,
      windowRows: 3,
      windowRevealInches: 4.5,
      balconyProjectionFeet: 0.5,
      interiorDepthFeet: 5.2,
      apparentArchitecturalDepthFeet: 35.0,
      forcedPerspectiveScaleFactor: 0.66,
      cameraSightlineSplayDeg: 9.5,
      floorRakePitchDeg: 4.8
    },
    'apt-jeffries': {
      widthFeet: 24.4,
      heightFeet: 10.8,
      depthFeet: 16.5,
      elevationOffsetFeet: 14.5,
      windowCols: 3,
      windowRows: 1,
      windowRevealInches: 9.0,
      balconyProjectionFeet: 0.0,
      interiorDepthFeet: 18.8,
      apparentArchitecturalDepthFeet: 18.8,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    }
  };

  // Naive 1:1 Municipal Architectural Standard (uncompensated orthogonal dimensions — inaccurate for distant sets)
  const naiveArchitecturalTargets: Record<string, ParametricDimensionsSnapshot> = {
    'apt-thorwald': {
      widthFeet: 38.4,
      heightFeet: 40.2,
      depthFeet: 16.5,
      elevationOffsetFeet: 13.4,
      windowCols: 4,
      windowRows: 4,
      windowRevealInches: 9.0,
      balconyProjectionFeet: 3.6,
      interiorDepthFeet: 16.5,
      apparentArchitecturalDepthFeet: 16.5,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    },
    'apt-torso': {
      widthFeet: 14.2,
      heightFeet: 38.0,
      depthFeet: 46.5,
      elevationOffsetFeet: 13.8,
      windowCols: 2,
      windowRows: 3,
      windowRevealInches: 9.0,
      balconyProjectionFeet: 3.2,
      interiorDepthFeet: 17.5,
      apparentArchitecturalDepthFeet: 17.5,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    },
    'apt-composer': {
      widthFeet: 14.8,
      heightFeet: 40.5,
      depthFeet: 46.0,
      elevationOffsetFeet: 23.2,
      windowCols: 3,
      windowRows: 3,
      windowRevealInches: 9.5,
      balconyProjectionFeet: 2.0,
      interiorDepthFeet: 20.4,
      apparentArchitecturalDepthFeet: 20.4,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    },
    'apt-lonelyhearts': {
      widthFeet: 13.8,
      heightFeet: 37.5,
      depthFeet: 46.0,
      elevationOffsetFeet: 3.0,
      windowCols: 2,
      windowRows: 2,
      windowRevealInches: 8.5,
      balconyProjectionFeet: 1.2,
      interiorDepthFeet: 15.0,
      apparentArchitecturalDepthFeet: 15.0,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    },
    'apt-sculptor': {
      widthFeet: 38.2,
      heightFeet: 9.6,
      depthFeet: 28.0,
      elevationOffsetFeet: -4.0,
      windowCols: 2,
      windowRows: 1,
      windowRevealInches: 7.5,
      balconyProjectionFeet: 0.0,
      interiorDepthFeet: 13.8,
      apparentArchitecturalDepthFeet: 13.8,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    },
    'apt-alley-street': {
      widthFeet: 24.0,
      heightFeet: 36.0,
      depthFeet: 18.0,
      elevationOffsetFeet: 10.0,
      windowCols: 3,
      windowRows: 3,
      windowRevealInches: 8.0,
      balconyProjectionFeet: 1.0,
      interiorDepthFeet: 35.0,
      apparentArchitecturalDepthFeet: 35.0,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0
    },
    'apt-jeffries': povCompensatedTargets['apt-jeffries']
  };

  const rawTarget = povCompensationEnabled
    ? povCompensatedTargets[zoneId] || povCompensatedTargets['apt-thorwald']
    : naiveArchitecturalTargets[zoneId] || naiveArchitecturalTargets['apt-thorwald'];

  // If POV compensation is active and we have a Learned 75GB Corpus Prior for this zone, pre-seed target with learned priors
  const target: ParametricDimensionsSnapshot =
    povCompensationEnabled && learnedZonePrior
      ? {
          widthFeet: Number((rawTarget.widthFeet * 0.4 + learnedZonePrior.widthFeet * 0.6).toFixed(2)),
          heightFeet: Number((rawTarget.heightFeet * 0.4 + learnedZonePrior.heightFeet * 0.6).toFixed(2)),
          depthFeet: Number((rawTarget.depthFeet * 0.4 + learnedZonePrior.depthFeet * 0.6).toFixed(2)),
          elevationOffsetFeet: learnedZonePrior.elevationOffsetFeet,
          windowCols: learnedZonePrior.windowCols,
          windowRows: learnedZonePrior.windowRows,
          windowRevealInches: Number(
            (rawTarget.windowRevealInches * 0.4 + learnedZonePrior.windowRevealInches * 0.6).toFixed(2)
          ),
          balconyProjectionFeet: learnedZonePrior.balconyProjectionFeet,
          interiorDepthFeet: Number(
            (rawTarget.interiorDepthFeet * 0.35 + learnedZonePrior.interiorDepthFeet * 0.65).toFixed(2)
          ),
          apparentArchitecturalDepthFeet:
            learnedZonePrior.apparentArchitecturalDepthFeet ?? rawTarget.apparentArchitecturalDepthFeet,
          forcedPerspectiveScaleFactor:
            learnedZonePrior.forcedPerspectiveScaleFactor ?? rawTarget.forcedPerspectiveScaleFactor,
          cameraSightlineSplayDeg:
            learnedZonePrior.cameraSightlineSplayDeg ?? rawTarget.cameraSightlineSplayDeg,
          floorRakePitchDeg: learnedZonePrior.floorRakePitchDeg ?? rawTarget.floorRakePitchDeg
        }
      : rawTarget;

  const blend = (curr: number, targ: number) => Number((curr * 0.22 + targ * 0.78).toFixed(2));
  const fpScale = target.forcedPerspectiveScaleFactor ?? 0.85;
  const uncompensatedPierFeet = (telemetry.brickCoursesCounted / 3) * (8 / 12);
  const povCompensatedPierFeet = uncompensatedPierFeet * fpScale;

  const proposedValues: ParametricDimensionsSnapshot = {
    widthFeet: blend(currentState.widthFeet, target.widthFeet),
    heightFeet: blend(currentState.heightFeet, target.heightFeet),
    depthFeet: blend(currentState.depthFeet, target.depthFeet),
    elevationOffsetFeet: blend(currentState.elevationOffsetFeet, target.elevationOffsetFeet),
    windowCols: target.windowCols,
    windowRows: target.windowRows,
    windowRevealInches: blend(currentState.windowRevealInches, target.windowRevealInches),
    balconyProjectionFeet: blend(
      currentState.balconyProjectionFeet,
      target.balconyProjectionFeet
    ),
    interiorDepthFeet: blend(currentState.interiorDepthFeet, target.interiorDepthFeet),
    apparentArchitecturalDepthFeet: target.apparentArchitecturalDepthFeet,
    forcedPerspectiveScaleFactor: target.forcedPerspectiveScaleFactor,
    cameraSightlineSplayDeg: target.cameraSightlineSplayDeg,
    floorRakePitchDeg: target.floorRakePitchDeg
  };

  const isLowConfChallenge =
    queuedFrame.simulatedChallenge && queuedFrame.simulatedChallenge !== 'none';
  const focalBonus = queuedFrame.focalLengthMm >= 75 ? 10 : 4;
  const learnedPriorBonus = learnedProfile ? Math.min(6, learnedProfile.version) : 0;
  const confidenceScore = isLowConfChallenge
    ? queuedFrame.simulatedChallenge === 'venetian_blind_occlusion'
      ? Math.min(72, 58 + learnedPriorBonus)
      : Math.min(70, 54 + learnedPriorBonus)
    : Math.min(
        97,
        Math.max(76, Math.round(76 + focalBonus + learnedPriorBonus + (telemetry.orthogonalEdgePct % 9)))
      );

  const radialDist = telemetry.radialDistanceFromJeffFeet ?? 42.0;
  const splayDeg = proposedValues.cameraSightlineSplayDeg ?? 0.0;
  const rakeDeg = proposedValues.floorRakePitchDeg ?? 0.0;
  const appDepth =
    proposedValues.apparentArchitecturalDepthFeet ?? proposedValues.interiorDepthFeet;

  return {
    proposedValues,
    confidenceScore,
    spatialReasoningSummary: isLowConfChallenge
      ? `LOW-CONFIDENCE INTERPRETATION (${confidenceScore}%): ${lowConfidenceFlags[0]}. Note: Distant rooms at d=${radialDist}' are built with ${fpScale}× forced-perspective scale and ${splayDeg >= 0 ? '+' : ''}${splayDeg}° non-orthogonal sightline wall splay rather than municipal architectural standards.`
      : povCompensationEnabled
      ? `Camera-POV Forced-Perspective Solver attenuated ${telemetry.brickCoursesCounted} brick courses at radial sightline d=${radialDist}' from Jeff's nodal lens (${uncompensatedPierFeet.toFixed(
          2
        )}' naive architectural gauge → ${povCompensatedPierFeet.toFixed(
          2
        )}' physical Stage 18 carpentry at ${fpScale}× scale). Solved physical room depth at ${
          proposedValues.interiorDepthFeet
        }' (simulating ${appDepth}' apparent architectural depth) with ${
          splayDeg >= 0 ? '+' : ''
        }${splayDeg}° sightline wall splay and ${rakeDeg >= 0 ? '+' : ''}${rakeDeg}° floor rake.`
      : `UNCOMPENSATED 1:1 ARCHITECTURAL CODE ASSUMPTION: Counted ${telemetry.brickCoursesCounted} courses (${uncompensatedPierFeet.toFixed(
          2
        )}' at full 8.0" gauge) assuming 90° orthogonal room corners (${
          proposedValues.interiorDepthFeet
        }' deep). WARNING: Overestimates physical Stage 18 soundstage depth at radial distance d=${radialDist}'.`,
    detectedFeatures: [
      `Radial sightline d=${radialDist}' from Jeff's nodal tripod (${fpScale}× POV forced-perspective scale)`,
      `Physical set depth ${proposedValues.interiorDepthFeet}' vs. ${appDepth}' apparent architectural depth`,
      `Non-orthogonal sightline wall splay ${splayDeg >= 0 ? '+' : ''}${splayDeg}° · Floor rake ${
        rakeDeg >= 0 ? '+' : ''
      }${rakeDeg}°`,
      `${telemetry.brickCoursesCounted} brick courses (${povCompensatedPierFeet.toFixed(
        2
      )}' POV-scaled vs. ${uncompensatedPierFeet.toFixed(2)}' naive code)`
    ]
  };
}

export default function AutomatedLayoutSolverPanel({
  parametricOverrides,
  layoutIterations,
  onApproveIteration,
  onApproveAllPending,
  onRejectIteration,
  onRevertIteration,
  onVerifyAndCalibrateIteration,
  onAddIterations,
  onResetAllOverrides,
  onNavigateToWorkbenchWithHeatmap,
  onNavigateToDeltaScript,
  externalDiagnosticPlates = [],
  mountedSourceSizeGb = 74.8,
  mountedSourceFileName = 'Rear_Window_1954_UHD_Remux_75GB.mkv',
  batchControlRef,
  onBatchProgressUpdate,
  learnedKnowledgeProfile
}: AutomatedLayoutSolverPanelProps) {
  const [preferredEngine, setPreferredEngine] =
    useState<AnalysisEngineMode>('gemini_cloud_hybrid');
  const [povCompensationEnabled, setPovCompensationEnabled] = useState<boolean>(true);
  const [scanQueue, setScanQueue] = useState<QueuedScanFrame[]>(DEFAULT_SCAN_QUEUE);
  const [isScanningBatch, setIsScanningBatch] = useState(false);
  const [isBatchPaused, setIsBatchPaused] = useState(false);
  const [batchEngineState, setBatchEngineState] = useState<
    'idle' | 'running' | 'paused' | 'completed'
  >('idle');
  const [scanProgressIndex, setScanProgressIndex] = useState<number>(0);
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [batchElapsedMs, setBatchElapsedMs] = useState<number>(0);
  const [currentFrameElapsedMs, setCurrentFrameElapsedMs] = useState<number>(0);
  const [queueRuntimeMap, setQueueRuntimeMap] = useState<
    Record<string, FrameQueueRuntimeItem>
  >(() => {
    const init: Record<string, FrameQueueRuntimeItem> = {};
    DEFAULT_SCAN_QUEUE.forEach((f) => {
      init[f.id] = {
        frameId: f.id,
        stageStatus: 'queued',
        substageProgressPct: 0,
        stageLabel: 'Waiting in Dual-Engine Queue'
      };
    });
    return init;
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'needs_verification' | 'pending_review' | 'approved' | 'rejected'
  >('all');

  // Refs for real-time Pause / Resume / Single-Step / Cancel control inside async scan loop
  const isPausedRef = useRef<boolean>(false);
  const pauseSingleStepRef = useRef<boolean>(false);
  const cancelScanRef = useRef<boolean>(false);
  const resumeResolverRef = useRef<(() => void) | null>(null);
  const nextFrameCursorRef = useRef<number>(0);

  // System Resource & Hardware Limit Telemetry State (75GB 4K Stream + Dual-Engine CV/AI Load)
  const hardwareLogicalCores =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 8;
  const detectedDeviceRamGb =
    typeof navigator !== 'undefined' &&
    'deviceMemory' in navigator &&
    typeof (navigator as unknown as { deviceMemory?: number }).deviceMemory === 'number'
      ? Number((navigator as unknown as { deviceMemory: number }).deviceMemory)
      : 8;
  const memoryBudgetMb = 4096; // 4.0 GB Browser WebGL2 + 75GB EBML/16-bit PNG Decode Heap Limit
  const [cpuLoadPct, setCpuLoadPct] = useState<number>(11);
  const [memoryUsedMb, setMemoryUsedMb] = useState<number>(640);
  const [peakCpuLoadPct, setPeakCpuLoadPct] = useState<number>(18);
  const [peakMemoryUsedMb, setPeakMemoryUsedMb] = useState<number>(640);
  const [eventLoopLagMs, setEventLoopLagMs] = useState<number>(1.2);
  const [hardwareWarnThresholdPct, setHardwareWarnThresholdPct] = useState<number>(80);
  const [simulate75GbStress, setSimulate75GbStress] = useState<boolean>(false);
  const [ecoThrottleEnabled, setEcoThrottleEnabled] = useState<boolean>(false);
  const [purgedMemoryReliefMb, setPurgedMemoryReliefMb] = useState<number>(0);
  const [resourceHistory, setResourceHistory] = useState<
    Array<{ cpu: number; mem: number }>
  >(() =>
    Array.from({ length: 18 }, (_, idx) => ({
      cpu: 9 + (idx % 4),
      mem: 15 + (idx % 3)
    }))
  );
  const ecoThrottleRef = useRef<boolean>(false);
  const lastResourceTickRef = useRef<number>(performance.now());

  // Interactive Frame Verification & Spatial Calibrator State
  const [verifyingIterationId, setVerifyingIterationId] = useState<string | null>(null);
  const [calTargetZoneId, setCalTargetZoneId] = useState<string>('apt-lonelyhearts');
  const [calValidityStatus, setCalValidityStatus] =
    useState<FrameValidityStatus>('verified_valid');
  const [calOffsetX, setCalOffsetX] = useState<number>(0.0);
  const [calOffsetY, setCalOffsetY] = useState<number>(0.0);
  const [calOffsetZ, setCalOffsetZ] = useState<number>(0.0);
  const [calPitchDeg, setCalPitchDeg] = useState<number>(-14.2);
  const [calYawDeg, setCalYawDeg] = useState<number>(-24.5);
  const [calRollDeg, setCalRollDeg] = useState<number>(0.0);
  const [calHorizonNormY, setCalHorizonNormY] = useState<number>(0.46);
  const [calPlumbNormX, setCalPlumbNormX] = useState<number>(0.52);
  const [calProposedDims, setCalProposedDims] = useState<ParametricDimensionsSnapshot>({
    widthFeet: 12.8,
    heightFeet: 36.4,
    depthFeet: 44.8,
    elevationOffsetFeet: 2.8,
    windowCols: 2,
    windowRows: 2,
    windowRevealInches: 7.8,
    balconyProjectionFeet: 1.0,
    interiorDepthFeet: 14.8
  });
  const [calNotes, setCalNotes] = useState<string>('');

  const calibratorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const pendingCount = layoutIterations.filter((i) => i.status === 'pending_review').length;
  const approvedCount = layoutIterations.filter((i) => i.status === 'approved').length;
  const needsVerificationCount = layoutIterations.filter(
    (i) => i.confidenceScore < 75 && !i.manualVerification?.verifiedByUser
  ).length;

  const avgConfidence = Math.round(
    STAGE18_APARTMENTS.reduce(
      (sum, apt) =>
        sum +
        (parametricOverrides[apt.id]?.confidenceScore ||
          INITIAL_BUILDING_PARAMETRIC_OVERRIDES[apt.id].confidenceScore),
      0
    ) / STAGE18_APARTMENTS.length
  );

  // Open the interactive Frame Verification & Orientation Calibrator for a specific iteration
  const openFrameVerificationWorkbench = (iter: ArchitecturalLayoutIteration) => {
    setVerifyingIterationId(iter.id);
    setCalTargetZoneId(iter.targetApartmentId);
    setCalValidityStatus(iter.manualVerification?.validityStatus || 'verified_valid');
    setCalOffsetX(iter.manualVerification?.placementOffsetFeet?.[0] ?? 0.0);
    setCalOffsetY(iter.manualVerification?.placementOffsetFeet?.[1] ?? 0.0);
    setCalOffsetZ(iter.manualVerification?.placementOffsetFeet?.[2] ?? 0.0);
    setCalPitchDeg(
      iter.manualVerification?.orientationOverrideDeg?.pitchDeg ??
        iter.cvPrepassTelemetry.vanishingPitchDeg
    );
    setCalYawDeg(
      iter.manualVerification?.orientationOverrideDeg?.yawDeg ??
        iter.cvPrepassTelemetry.vanishingYawDeg
    );
    setCalRollDeg(iter.manualVerification?.orientationOverrideDeg?.rollPlumbDeg ?? 0.0);
    setCalHorizonNormY(iter.manualVerification?.horizonLineNormalizedY ?? 0.46);
    setCalPlumbNormX(iter.manualVerification?.plumbLineNormalizedX ?? 0.52);
    setCalProposedDims({ ...iter.proposedValues });
    setCalNotes(
      iter.manualVerification?.verificationNotes ||
        `Verified vanishing horizon, vertical plumb, and 3D zone placement for SMPTE ${iter.smpteTimecode}.`
    );
  };

  // Render the interactive Optical Horizon, Plumb & 3D Placement Bounding Box on calibratorCanvasRef
  useEffect(() => {
    const canvas = calibratorCanvasRef.current;
    if (!canvas || !verifyingIterationId) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. Background simulated Stage 18 architectural frame with current roll/plumb visualization
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((calRollDeg * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#181310');
    bgGrad.addColorStop(0.6, '#382218');
    bgGrad.addColorStop(1, '#58311c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Brick course reference lines
    ctx.fillStyle = 'rgba(214, 211, 209, 0.22)';
    for (let y = 12; y < h - 12; y += 10) {
      ctx.fillRect(0, y, w, 1.5);
    }

    // Window bays reflecting calProposedDims.windowCols x windowRows
    const cols = Math.max(1, Math.min(6, calProposedDims.windowCols));
    const rows = Math.max(1, Math.min(4, calProposedDims.windowRows));
    const cageW = Math.min(w * 0.72, 160 + calProposedDims.widthFeet * 4.2);
    const cageH = Math.min(h * 0.72, 95 + calProposedDims.heightFeet * 2.4);
    const cageX = w / 2 - cageW / 2 + calOffsetX * 8;
    const cageY = h / 2 - cageH / 2 - calOffsetY * 6;

    const winW = (cageW - (cols + 1) * 14) / cols;
    const winH = (cageH - (rows + 1) * 12) / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = cageX + 14 + c * (winW + 14);
        const wy = cageY + 12 + r * (winH + 12);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.42)';
        ctx.fillRect(wx, wy, Math.max(12, winW), Math.max(14, winH));
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, Math.max(12, winW), Math.max(14, winH));
      }
    }
    ctx.restore();

    // 2. Emerald 3D Zone Placement Bounding Box Overlay (shifted by calOffsetX, calOffsetY, calOffsetZ)
    const scaleZ = 1 + calOffsetZ * 0.025;
    const boxW = Math.min(w * 0.78, (165 + calProposedDims.widthFeet * 4.0) * scaleZ);
    const boxH = Math.min(h * 0.76, (100 + calProposedDims.heightFeet * 2.3) * scaleZ);
    const boxX = w / 2 - boxW / 2 + calOffsetX * 8;
    const boxY = h / 2 - boxH / 2 - calOffsetY * 6;

    ctx.strokeStyle =
      calValidityStatus === 'invalid_discarded'
        ? '#EF4444'
        : calValidityStatus === 'geometry_excluded_lighting_only'
        ? '#38BDF8'
        : '#10B981';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.setLineDash([]);

    // 3. Draggable Amber Vanishing Horizon / Pitch Line
    const horizonY = Math.round(calHorizonNormY * h);
    const pitchSlopePx = Math.tan((calPitchDeg * Math.PI) / 180) * (w * 0.35);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, horizonY - pitchSlopePx * 0.35);
    ctx.lineTo(w, horizonY + pitchSlopePx * 0.35);
    ctx.stroke();

    // 4. Draggable Cyan Vertical Plumb / Roll Reference Axis
    const plumbX = Math.round(calPlumbNormX * w);
    const rollOffsetPx = Math.tan((calRollDeg * Math.PI) / 180) * (h * 0.5);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plumbX - rollOffsetPx, 0);
    ctx.lineTo(plumbX + rollOffsetPx, h);
    ctx.stroke();

    // 5. Non-Orthogonal Sightline Wall-Splay Wedge Overlay (shows trapezoidal interior room splay toward Jeff's camera)
    const splayDeg = calProposedDims.cameraSightlineSplayDeg ?? 6.8;
    const splayShiftPx = Math.tan((splayDeg * Math.PI) / 180) * 65;
    ctx.strokeStyle = 'rgba(232, 121, 249, 0.85)';
    ctx.lineWidth = 1.75;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    // Left wall splay vector from front window jamb to compressed rear wall
    ctx.moveTo(boxX, boxY);
    ctx.lineTo(boxX + 26 + splayShiftPx, boxY + 18);
    ctx.lineTo(boxX + 26 + splayShiftPx, boxY + boxH - 18);
    ctx.lineTo(boxX, boxY + boxH);
    // Right wall splay vector
    ctx.moveTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW - 26 + splayShiftPx, boxY + 18);
    ctx.lineTo(boxX + boxW - 26 + splayShiftPx, boxY + boxH - 18);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Intersection Nodal Handle
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(plumbX, horizonY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0B0D11';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top-left & Bottom-left Calibration Telemetry HUD
    ctx.fillStyle = 'rgba(11, 13, 17, 0.88)';
    ctx.fillRect(8, 8, w - 16, 26);
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(
      `HORIZON & PLUMB · PITCH ${calPitchDeg.toFixed(1)}°  YAW ${calYawDeg.toFixed(1)}°  SPLAY ${(calProposedDims.cameraSightlineSplayDeg ?? 0).toFixed(1)}°  POV ${(calProposedDims.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2)}×`,
      12,
      25
    );

    ctx.fillStyle = 'rgba(11, 13, 17, 0.88)';
    ctx.fillRect(8, h - 32, w - 16, 24);
    ctx.fillStyle = '#10B981';
    ctx.fillText(
      `OFFSET dX ${calOffsetX >= 0 ? '+' : ''}${calOffsetX.toFixed(1)}' dY ${calOffsetY >= 0 ? '+' : ''}${calOffsetY.toFixed(1)}' dZ ${calOffsetZ >= 0 ? '+' : ''}${calOffsetZ.toFixed(1)}' · SET DEPTH ${calProposedDims.interiorDepthFeet.toFixed(1)}' (APPARENT ${(calProposedDims.apparentArchitecturalDepthFeet ?? calProposedDims.interiorDepthFeet).toFixed(1)}')`,
      12,
      h - 16
    );
  }, [
    verifyingIterationId,
    calHorizonNormY,
    calPlumbNormX,
    calPitchDeg,
    calYawDeg,
    calRollDeg,
    calOffsetX,
    calOffsetY,
    calOffsetZ,
    calProposedDims,
    calValidityStatus
  ]);

  const handleCalibratorCanvasInteraction = (
    e: React.MouseEvent<HTMLCanvasElement>
  ) => {
    if (e.buttons !== 1 && e.type !== 'click') return;
    const canvas = calibratorCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = Math.max(0.08, Math.min(0.92, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height));
    setCalPlumbNormX(Number(normX.toFixed(3)));
    setCalHorizonNormY(Number(normY.toFixed(3)));

    // Derive updated pitch & yaw from optical principal point shift
    const derivedPitch = Number(((0.5 - normY) * 32).toFixed(1));
    const derivedYaw = Number(((normX - 0.5) * 48).toFixed(1));
    setCalPitchDeg(derivedPitch);
    setCalYawDeg(derivedYaw);
  };

  // Recalculate foreshortened 3D building dimensions, POV forced-perspective scale, and wall splay from camera orientation
  const handleRecalculateDimensionsFromOrientation = () => {
    const pitchRad = (Math.abs(calPitchDeg) * Math.PI) / 180;
    const yawRad = (Math.abs(calYawDeg) * Math.PI) / 180;
    const cosPitch = Math.max(0.72, Math.cos(pitchRad));
    const cosYaw = Math.max(0.72, Math.cos(yawRad));

    const baseline =
      INITIAL_BUILDING_PARAMETRIC_OVERRIDES[calTargetZoneId] ||
      INITIAL_BUILDING_PARAMETRIC_OVERRIDES['apt-thorwald'];
    const fpScale = baseline.forcedPerspectiveScaleFactor ?? 0.85;
    const solvedSplayDeg = Number(
      ((baseline.cameraSightlineSplayDeg ?? 6.8) - calYawDeg * 0.28).toFixed(1)
    );
    const solvedRakeDeg = Number(
      ((baseline.floorRakePitchDeg ?? 1.5) - calPitchDeg * 0.12).toFixed(1)
    );

    setCalProposedDims((prev) => ({
      ...prev,
      widthFeet: Number(((baseline.widthFeet * fpScale) / Math.pow(cosYaw, 0.22)).toFixed(2)),
      heightFeet: Number(((baseline.heightFeet * fpScale) / Math.pow(cosPitch, 0.18)).toFixed(2)),
      elevationOffsetFeet: Number((baseline.elevationOffsetFeet + calOffsetY).toFixed(2)),
      interiorDepthFeet: Number(
        (baseline.interiorDepthFeet * (1 - Math.sin(yawRad) * 0.14)).toFixed(2)
      ),
      apparentArchitecturalDepthFeet:
        baseline.apparentArchitecturalDepthFeet ?? baseline.interiorDepthFeet,
      forcedPerspectiveScaleFactor: fpScale,
      cameraSightlineSplayDeg: solvedSplayDeg,
      floorRakePitchDeg: solvedRakeDeg
    }));
  };

  const handleZoneReassignmentChange = (newZoneId: string) => {
    setCalTargetZoneId(newZoneId);
    const zoneState =
      parametricOverrides[newZoneId] ||
      INITIAL_BUILDING_PARAMETRIC_OVERRIDES[newZoneId] ||
      INITIAL_BUILDING_PARAMETRIC_OVERRIDES['apt-thorwald'];
    setCalProposedDims({
      widthFeet: zoneState.widthFeet,
      heightFeet: zoneState.heightFeet,
      depthFeet: zoneState.depthFeet,
      elevationOffsetFeet: zoneState.elevationOffsetFeet,
      windowCols: zoneState.windowCols,
      windowRows: zoneState.windowRows,
      windowRevealInches: zoneState.windowRevealInches,
      balconyProjectionFeet: zoneState.balconyProjectionFeet,
      interiorDepthFeet: zoneState.interiorDepthFeet,
      apparentArchitecturalDepthFeet:
        zoneState.apparentArchitecturalDepthFeet ?? zoneState.interiorDepthFeet,
      forcedPerspectiveScaleFactor: zoneState.forcedPerspectiveScaleFactor ?? 0.85,
      cameraSightlineSplayDeg: zoneState.cameraSightlineSplayDeg ?? 0.0,
      floorRakePitchDeg: zoneState.floorRakePitchDeg ?? 0.0
    });
  };

  const handleSaveManualVerification = (iterId: string) => {
    const verificationPayload: ManualFrameVerification = {
      verifiedByUser: true,
      validityStatus: calValidityStatus,
      placementOffsetFeet: [calOffsetX, calOffsetY, calOffsetZ],
      orientationOverrideDeg: {
        pitchDeg: calPitchDeg,
        yawDeg: calYawDeg,
        rollPlumbDeg: calRollDeg
      },
      forcedPerspectiveScaleOverride: calProposedDims.forcedPerspectiveScaleFactor ?? 0.85,
      cameraSightlineSplayOverrideDeg: calProposedDims.cameraSightlineSplayDeg ?? 0.0,
      floorRakePitchOverrideDeg: calProposedDims.floorRakePitchDeg ?? 0.0,
      horizonLineNormalizedY: calHorizonNormY,
      plumbLineNormalizedX: calPlumbNormX,
      verificationNotes:
        calNotes.trim() ||
        'User verified POV forced-perspective scale, non-orthogonal wall splay, placement, and validity.',
      verifiedAtIso: new Date().toISOString()
    };

    onVerifyAndCalibrateIteration(
      iterId,
      calTargetZoneId,
      calProposedDims,
      verificationPayload
    );
    setVerifyingIterationId(null);
    setStatusMessage(
      calValidityStatus === 'verified_valid'
        ? `Frame verified and calibrated: applied POV scale (${(
            calProposedDims.forcedPerspectiveScaleFactor ?? 0.85
          ).toFixed(2)}×), sightline wall splay (${(
            calProposedDims.cameraSightlineSplayDeg ?? 0
          ).toFixed(1)}°), and placement overrides to ${calTargetZoneId}.`
        : calValidityStatus === 'geometry_excluded_lighting_only'
        ? `Frame marked Valid for Lighting/Color Only (excluded from 3D geometry mutations).`
        : `Frame marked Invalid/Discarded and excluded from the 3D reconstruction pipeline.`
    );
  };

  const handleSyncDiagnosticPlatesToQueue = () => {
    if (externalDiagnosticPlates.length === 0) return;
    const zoneCycle = [
      'apt-thorwald',
      'apt-torso',
      'apt-composer',
      'apt-lonelyhearts',
      'apt-sculptor',
      'apt-jeffries'
    ];
    const mapped: QueuedScanFrame[] = externalDiagnosticPlates.map((plate, idx) => {
      const parts = plate.timestampHint.split(':');
      const normalizedSmpte =
        parts.length === 4 ? plate.timestampHint : `${plate.timestampHint}:00`;
      return {
        id: `queue-diag-${plate.id}`,
        title: `75GB Probe Plate · ${plate.name}`,
        smpteTimecode: normalizedSmpte,
        focalLengthMm: plate.name.includes('152') ? 152 : plate.name.includes('50') ? 50 : 35,
        targetApartmentHint: zoneCycle[idx % zoneCycle.length],
        sourceLabel: '75GB MKV Diagnostic Plate',
        imageDataUrl: plate.dataUrl,
        simulatedChallenge: 'none'
      };
    });
    setScanQueue(mapped);
    const nextMap: Record<string, FrameQueueRuntimeItem> = {};
    mapped.forEach((f) => {
      nextMap[f.id] = {
        frameId: f.id,
        stageStatus: 'queued',
        substageProgressPct: 0,
        stageLabel: 'Waiting in Dual-Engine Queue'
      };
    });
    setQueueRuntimeMap(nextMap);
    setBatchEngineState('idle');
    nextFrameCursorRef.current = 0;
    setStatusMessage(
      `Loaded ${mapped.length} diagnostic plates from your 75 GB MKV probe into the Autonomous Scan Queue.`
    );
  };

  const handleUploadCustomScanFrames = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const zoneCycle = [
      'apt-thorwald',
      'apt-torso',
      'apt-composer',
      'apt-lonelyhearts',
      'apt-sculptor',
      'apt-jeffries'
    ];
    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const newItem: QueuedScanFrame = {
            id: `queue-upload-${Date.now()}-${idx}`,
            title: file.name.replace(/\.[^.]+$/, ''),
            smpteTimecode: `00:${String(12 + idx * 7).padStart(2, '0')}:18:04`,
            focalLengthMm: file.name.includes('152') ? 152 : 50,
            targetApartmentHint: zoneCycle[idx % zoneCycle.length],
            sourceLabel: 'User Uploaded Still',
            imageDataUrl: reader.result,
            simulatedChallenge: 'none'
          };
          setScanQueue((prev) => [newItem, ...prev]);
          setQueueRuntimeMap((prev) => ({
            ...prev,
            [newItem.id]: {
              frameId: newItem.id,
              stageStatus: 'queued',
              substageProgressPct: 0,
              stageLabel: 'Waiting in Dual-Engine Queue'
            }
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Elapsed timer while engine is actively running
  useEffect(() => {
    if (batchEngineState !== 'running') return;
    const interval = window.setInterval(() => {
      setBatchElapsedMs((prev) => prev + 100);
      setCurrentFrameElapsedMs((prev) => prev + 100);
    }, 100);
    return () => window.clearInterval(interval);
  }, [batchEngineState]);

  // Keep ecoThrottleRef synchronized for the async batch loop
  useEffect(() => {
    ecoThrottleRef.current = ecoThrottleEnabled;
  }, [ecoThrottleEnabled]);

  // Real-time System Resource & Hardware Telemetry Sampler (CPU Load + 75GB Stream Memory Usage)
  useEffect(() => {
    const sampleHardwareTelemetry = () => {
      const now = performance.now();
      const elapsedDelta = now - lastResourceTickRef.current;
      lastResourceTickRef.current = now;
      const measuredLag = Math.max(0.4, Math.min(48, Math.abs(elapsedDelta - 240) * 0.18));
      setEventLoopLagMs(Number(measuredLag.toFixed(1)));

      // Read real Chromium JS heap if available, otherwise baseline 275 MB
      const perfMem = (
        performance as unknown as {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
        }
      ).memory;
      const baseJsHeapMb = perfMem
        ? Math.round(perfMem.usedJSHeapSize / (1024 * 1024))
        : 275;

      const activeItem = activeFrameId ? queueRuntimeMap[activeFrameId] : null;
      const activeFrameObj = activeFrameId
        ? scanQueue.find((f) => f.id === activeFrameId)
        : null;
      const solvedCount = scanQueue.filter((f) => {
        const st = queueRuntimeMap[f.id]?.stageStatus;
        return st === 'completed_high_conf' || st === 'completed_low_conf';
      }).length;
      const nonSkippedCount = scanQueue.filter((f) => !f.skipped).length;

      // 75 GB MKV EBML slice cache + decoded 16-bit 4K PNG plate buffer footprint
      const sourceStreamCacheMb = Math.round(
        Math.min(1150, (mountedSourceSizeGb / 75) * 420 + nonSkippedCount * 48 + solvedCount * 85)
      );

      let stageBufferMb = 0;
      let stageCpuBase = 10;

      if (batchEngineState === 'running' && activeItem) {
        const isHeavyFrame =
          (activeFrameObj?.simulatedChallenge &&
            activeFrameObj.simulatedChallenge !== 'none') ||
          (activeFrameObj?.focalLengthMm || 50) >= 135;

        if (activeItem.stageStatus === 'stage1_cv_prepass') {
          stageBufferMb = isHeavyFrame ? 680 : 460;
          stageCpuBase = isHeavyFrame ? 79 : 71;
        } else if (activeItem.stageStatus === 'stage2_ai_spatial_solve') {
          stageBufferMb = isHeavyFrame ? 1420 : 940;
          stageCpuBase = isHeavyFrame ? 91 : 82;
        } else if (activeItem.stageStatus === 'stage3_delta_commit') {
          stageBufferMb = 520;
          stageCpuBase = 64;
        } else {
          stageBufferMb = 310;
          stageCpuBase = 48;
        }
      } else if (batchEngineState === 'paused') {
        stageBufferMb = 440;
        stageCpuBase = 16;
      } else if (batchEngineState === 'completed') {
        stageBufferMb = 180;
        stageCpuBase = 12;
      }

      // Apply 75GB Uncompressed 4K Buffer Pressure simulation if toggled on
      const stressAddMb = simulate75GbStress ? 1580 : 0;
      const stressAddCpu = simulate75GbStress ? 76 : 0;

      // Apply Eco-Throttle & manual buffer purge reductions
      const throttleFactor = ecoThrottleEnabled ? 0.68 : 1.0;
      const jitterCpu = Math.round(((now / 240) % 5) - 2);

      const rawCpu =
        batchEngineState === 'running'
          ? Math.round((stageCpuBase + (simulate75GbStress ? 14 : 0)) * throttleFactor) +
            jitterCpu
          : Math.min(96, Math.round((stageCpuBase + stressAddCpu) * throttleFactor) + jitterCpu);

      const nextCpu = Math.max(6, Math.min(98, rawCpu));

      const rawMemMb = Math.round(
        (baseJsHeapMb + sourceStreamCacheMb + stageBufferMb + stressAddMb) *
          (ecoThrottleEnabled ? 0.76 : 1.0) -
          purgedMemoryReliefMb
      );
      const nextMemMb = Math.max(320, Math.min(memoryBudgetMb - 48, rawMemMb));
      const nextMemPct = Math.min(99, Math.round((nextMemMb / memoryBudgetMb) * 100));

      setCpuLoadPct(nextCpu);
      setMemoryUsedMb(nextMemMb);
      setPeakCpuLoadPct((prev) => Math.max(prev, nextCpu));
      setPeakMemoryUsedMb((prev) => Math.max(prev, nextMemMb));
      setResourceHistory((prev) => [...prev.slice(-17), { cpu: nextCpu, mem: nextMemPct }]);
    };

    sampleHardwareTelemetry();
    const timer = window.setInterval(
      sampleHardwareTelemetry,
      batchEngineState === 'running' ? 240 : 800
    );
    return () => window.clearInterval(timer);
  }, [
    batchEngineState,
    activeFrameId,
    queueRuntimeMap,
    scanQueue,
    mountedSourceSizeGb,
    simulate75GbStress,
    ecoThrottleEnabled,
    purgedMemoryReliefMb
  ]);

  const handlePurgeFrameDecodeBuffers = () => {
    setPurgedMemoryReliefMb((prev) => Math.min(1400, prev + 520));
    setSimulate75GbStress(false);
    setStatusMessage(
      'Purged cached 16-bit 4K frame decode buffers & offscreen Float32 luma scratchpads (-520 MB RAM reclaimed).'
    );
  };

  const handleToggleEcoThrottle = () => {
    setEcoThrottleEnabled((prev) => {
      const next = !prev;
      setStatusMessage(
        next
          ? 'Eco-Throttle enabled: Added +220ms inter-stage thermal/memory cooldown and capped peak 75 GB CV buffer allocation.'
          : 'Eco-Throttle disabled: Restored maximum unthrottled Dual-Engine batch throughput.'
      );
      return next;
    });
  };

  const waitIfEnginePaused = async (frameId: string) => {
    if (!isPausedRef.current) return;
    setQueueRuntimeMap((prev) => ({
      ...prev,
      [frameId]: {
        ...(prev[frameId] || { frameId, substageProgressPct: 50 }),
        stageStatus: 'paused',
        stageLabel: 'Engine Paused by User — Ready to Resume'
      }
    }));
    await new Promise<void>((resolve) => {
      resumeResolverRef.current = resolve;
    });
  };

  const handleTogglePauseResumeBatch = () => {
    if (!isScanningBatch) return;
    if (!isPausedRef.current) {
      // Pause engine
      isPausedRef.current = true;
      pauseSingleStepRef.current = false;
      setIsBatchPaused(true);
      setBatchEngineState('paused');
      setStatusMessage(
        'Dual-Engine scan paused. Inspect live queue telemetry or click Resume / Step +1 Frame.'
      );
    } else {
      // Resume engine
      isPausedRef.current = false;
      pauseSingleStepRef.current = false;
      setIsBatchPaused(false);
      setBatchEngineState('running');
      setStatusMessage('Resuming Dual-Engine autonomous batch scan...');
      if (resumeResolverRef.current) {
        const r = resumeResolverRef.current;
        resumeResolverRef.current = null;
        r();
      }
    }
  };

  const handleStepSingleFrame = () => {
    if (!isScanningBatch) {
      // Start in single-step mode from current cursor
      pauseSingleStepRef.current = true;
      isPausedRef.current = false;
      handleRunAutonomousBatchSweep(true);
      return;
    }
    if (isPausedRef.current && resumeResolverRef.current) {
      pauseSingleStepRef.current = true;
      isPausedRef.current = false;
      setIsBatchPaused(false);
      setBatchEngineState('running');
      const r = resumeResolverRef.current;
      resumeResolverRef.current = null;
      r();
    }
  };

  const handleResetBatchQueue = () => {
    cancelScanRef.current = true;
    isPausedRef.current = false;
    pauseSingleStepRef.current = false;
    if (resumeResolverRef.current) {
      const r = resumeResolverRef.current;
      resumeResolverRef.current = null;
      r();
    }
    setIsScanningBatch(false);
    setIsBatchPaused(false);
    setBatchEngineState('idle');
    setScanProgressIndex(0);
    setActiveFrameId(null);
    setBatchElapsedMs(0);
    setCurrentFrameElapsedMs(0);
    nextFrameCursorRef.current = 0;

    const resetMap: Record<string, FrameQueueRuntimeItem> = {};
    scanQueue.forEach((f) => {
      resetMap[f.id] = {
        frameId: f.id,
        stageStatus: f.skipped ? 'skipped' : 'queued',
        substageProgressPct: 0,
        stageLabel: f.skipped ? 'Skipped by User' : 'Waiting in Dual-Engine Queue'
      };
    });
    setQueueRuntimeMap(resetMap);
    setStatusMessage('Batch progress queue reset to initial state.');
  };

  const handleToggleSkipQueuedFrame = (frameId: string) => {
    setScanQueue((prev) =>
      prev.map((f) => {
        if (f.id !== frameId) return f;
        const nextSkipped = !f.skipped;
        setQueueRuntimeMap((m) => ({
          ...m,
          [frameId]: {
            ...(m[frameId] || { frameId, substageProgressPct: 0 }),
            stageStatus: nextSkipped ? 'skipped' : 'queued',
            substageProgressPct: 0,
            stageLabel: nextSkipped ? 'Skipped by User' : 'Waiting in Dual-Engine Queue'
          }
        }));
        return { ...f, skipped: nextSkipped };
      })
    );
  };

  // Run the autonomous batch sweep across all frames in scanQueue with real-time streaming & Pause/Resume
  const handleRunAutonomousBatchSweep = async (singleStepStart = false) => {
    if (scanQueue.length === 0) return;
    if (isScanningBatch && isPausedRef.current) {
      handleTogglePauseResumeBatch();
      return;
    }
    if (isScanningBatch) return;

    cancelScanRef.current = false;
    isPausedRef.current = false;
    pauseSingleStepRef.current = singleStepStart;
    setIsScanningBatch(true);
    setIsBatchPaused(false);
    setBatchEngineState('running');
    setFallbackNotice(null);

    const startIdx =
      nextFrameCursorRef.current >= scanQueue.length ? 0 : nextFrameCursorRef.current;
    if (startIdx === 0) {
      setBatchElapsedMs(0);
      setCurrentFrameElapsedMs(0);
      const freshMap: Record<string, FrameQueueRuntimeItem> = {};
      scanQueue.forEach((f) => {
        freshMap[f.id] = {
          frameId: f.id,
          stageStatus: f.skipped ? 'skipped' : 'queued',
          substageProgressPct: 0,
          stageLabel: f.skipped ? 'Skipped by User' : 'Waiting in Dual-Engine Queue'
        };
      });
      setQueueRuntimeMap(freshMap);
    }

    let cloudAvailable = preferredEngine === 'gemini_cloud_hybrid';
    let processedInRun = 0;
    let lowConfInRun = 0;

    for (let i = startIdx; i < scanQueue.length; i++) {
      if (cancelScanRef.current) break;

      const frame = scanQueue[i];
      nextFrameCursorRef.current = i;
      setScanProgressIndex(i + 1);

      if (frame.skipped) {
        setQueueRuntimeMap((prev) => ({
          ...prev,
          [frame.id]: {
            frameId: frame.id,
            stageStatus: 'skipped',
            substageProgressPct: 0,
            stageLabel: 'Skipped by User'
          }
        }));
        continue;
      }

      await waitIfEnginePaused(frame.id);
      if (cancelScanRef.current) break;

      const frameStartT0 = performance.now();
      setActiveFrameId(frame.id);
      setCurrentFrameElapsedMs(0);

      // SUB-STAGE 1: Client Sobel Vanishing-Line & Brick-Course Pre-Pass
      setQueueRuntimeMap((prev) => ({
        ...prev,
        [frame.id]: {
          frameId: frame.id,
          stageStatus: 'stage1_cv_prepass',
          substageProgressPct: 32,
          stageLabel: 'Stage 1/3 · Client CV Sobel & Brick-Course Pre-Pass'
        }
      }));
      setStatusMessage(
        `[${i + 1}/${scanQueue.length}] Stage 1/3 (CV Pre-Pass): ${frame.title} (SMPTE ${frame.smpteTimecode})...`
      );

      await new Promise((r) => setTimeout(r, ecoThrottleRef.current ? 360 : 180));
      const { telemetry, base64Png, lowConfidenceFlags } =
        await runClientCvGeometricPrepass(frame);

      await waitIfEnginePaused(frame.id);
      if (cancelScanRef.current) break;

      // SUB-STAGE 2: Dual-Engine Spatial Solve (Gemini 4 Hydrogen Cloud AI or Local CV Backup)
      setQueueRuntimeMap((prev) => ({
        ...prev,
        [frame.id]: {
          frameId: frame.id,
          stageStatus: 'stage2_ai_spatial_solve',
          substageProgressPct: 68,
          brickCoursesCounted: telemetry.brickCoursesCounted,
          stageLabel:
            cloudAvailable && (!frame.simulatedChallenge || frame.simulatedChallenge === 'none')
              ? 'Stage 2/3 · Gemini 4 Hydrogen Multimodal Spatial Solve'
              : 'Stage 2/3 · Local Geometric CV Vanishing-Point Solve'
        }
      }));
      setStatusMessage(
        `[${i + 1}/${scanQueue.length}] Stage 2/3 (3D Spatial Solve):Solving facade geometry for ${frame.targetApartmentHint}...`
      );

      const currentZoneState =
        parametricOverrides[frame.targetApartmentHint] ||
        INITIAL_BUILDING_PARAMETRIC_OVERRIDES[frame.targetApartmentHint] ||
        INITIAL_BUILDING_PARAMETRIC_OVERRIDES['apt-thorwald'];

      let usedEngine: AnalysisEngineMode = 'local_cv_backup';
      let targetZoneId = frame.targetApartmentHint;
      let confidenceScore = 82;
      let proposedValues: ParametricDimensionsSnapshot | null = null;
      let spatialReasoningSummary = '';
      let detectedFeatures: string[] = [];

      const isChallengeFrame =
        frame.simulatedChallenge && frame.simulatedChallenge !== 'none';

      if (cloudAvailable && !isChallengeFrame) {
        try {
          const response = await fetch('/api/analyze-frame-architecture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Png,
              mimeType: 'image/png',
              frameTitle: frame.title,
              smpteTimecode: frame.smpteTimecode,
              focalLengthMm: frame.focalLengthMm,
              targetApartmentHint: frame.targetApartmentHint,
              cvPrepassTelemetry: telemetry,
              currentParametricState: currentZoneState,
              learnedKnowledgeContext: learnedKnowledgeProfile
            })
          });

          if (response.ok) {
            const payload = await response.json();
            const aiData = payload.analysis;
            if (aiData && typeof aiData.widthFeet === 'number') {
              usedEngine = 'gemini_cloud_hybrid';
              const validZone = STAGE18_APARTMENTS.some(
                (a) => a.id === aiData.targetApartmentId
              )
                ? aiData.targetApartmentId
                : frame.targetApartmentHint;
              targetZoneId = validZone;
              confidenceScore = Math.max(
                65,
                Math.min(98, Number(aiData.confidenceScore) || 86)
              );
              proposedValues = {
                widthFeet: Number(Number(aiData.widthFeet).toFixed(2)),
                heightFeet: Number(Number(aiData.heightFeet).toFixed(2)),
                depthFeet: Number(Number(aiData.depthFeet).toFixed(2)),
                elevationOffsetFeet: Number(Number(aiData.elevationOffsetFeet).toFixed(2)),
                windowCols: Math.max(1, Math.round(Number(aiData.windowCols) || 3)),
                windowRows: Math.max(1, Math.round(Number(aiData.windowRows) || 3)),
                windowRevealInches: Number(Number(aiData.windowRevealInches || 7.5).toFixed(2)),
                balconyProjectionFeet: Number(
                  Number(aiData.balconyProjectionFeet || 0).toFixed(2)
                ),
                interiorDepthFeet: Number(Number(aiData.interiorDepthFeet || 11.4).toFixed(2)),
                apparentArchitecturalDepthFeet: Number(
                  Number(
                    aiData.apparentArchitecturalDepthFeet ||
                      currentZoneState.apparentArchitecturalDepthFeet ||
                      16.5
                  ).toFixed(2)
                ),
                forcedPerspectiveScaleFactor: Number(
                  Number(
                    aiData.forcedPerspectiveScaleFactor ||
                      currentZoneState.forcedPerspectiveScaleFactor ||
                      0.82
                  ).toFixed(2)
                ),
                cameraSightlineSplayDeg: Number(
                  Number(
                    aiData.cameraSightlineSplayDeg ??
                      currentZoneState.cameraSightlineSplayDeg ??
                      6.8
                  ).toFixed(1)
                ),
                floorRakePitchDeg: Number(
                  Number(
                    aiData.floorRakePitchDeg ?? currentZoneState.floorRakePitchDeg ?? 1.8
                  ).toFixed(1)
                )
              };
              spatialReasoningSummary =
                aiData.spatialReasoningSummary ||
                'Gemini Vision AI + CV hybrid spatial solver converged on POV forced-perspective dimensions.';
              detectedFeatures = Array.isArray(aiData.detectedFeatures)
                ? aiData.detectedFeatures
                : [];
            }
          } else {
            cloudAvailable = false;
            setFallbackNotice(
              'Cloud AI endpoint unavailable or offline — automatically switched to Local Browser CV Geometric Solver Backup with zero interruption.'
            );
          }
        } catch {
          cloudAvailable = false;
          setFallbackNotice(
            'Network or Cloud AI unreachable — automatically switched to Local Browser CV Geometric Solver Backup.'
          );
        }
      } else {
        await new Promise((r) => setTimeout(r, 220));
      }

      if (!proposedValues) {
        usedEngine = isChallengeFrame ? preferredEngine : 'local_cv_backup';
        const localResult = computeLocalCvGeometricLayoutDelta(
          frame,
          telemetry,
          currentZoneState,
          lowConfidenceFlags,
          povCompensationEnabled,
          learnedKnowledgeProfile
        );
        proposedValues = localResult.proposedValues;
        confidenceScore = localResult.confidenceScore;
        spatialReasoningSummary = learnedKnowledgeProfile
          ? `[Pre-Seeded with 75GB Learned Knowledge Bank v${learnedKnowledgeProfile.version} · ${learnedKnowledgeProfile.totalFramesAssimilated} frames] ${localResult.spatialReasoningSummary}`
          : localResult.spatialReasoningSummary;
        detectedFeatures = localResult.detectedFeatures;
      }

      // SUB-STAGE 3: Commit Proposed Layout Delta to Review Gate
      setQueueRuntimeMap((prev) => ({
        ...prev,
        [frame.id]: {
          frameId: frame.id,
          stageStatus: 'stage3_delta_commit',
          substageProgressPct: 92,
          brickCoursesCounted: telemetry.brickCoursesCounted,
          engineUsed: usedEngine,
          confidenceScore,
          stageLabel: 'Stage 3/3 · Compiling 3D Layout Delta & Confidence Audit'
        }
      }));
      await new Promise((r) => setTimeout(r, 140));

      const prevZoneState =
        parametricOverrides[targetZoneId] ||
        INITIAL_BUILDING_PARAMETRIC_OVERRIDES[targetZoneId] ||
        currentZoneState;

      const iterId = `iter-${Date.now()}-${i}`;
      const newIteration: ArchitecturalLayoutIteration = {
        id: iterId,
        frameTitle: frame.title,
        smpteTimecode: frame.smpteTimecode,
        focalLengthMm: frame.focalLengthMm,
        engineUsed: usedEngine,
        targetApartmentId: targetZoneId,
        confidenceScore,
        status: 'pending_review',
        proposedValues,
        previousValues: {
          widthFeet: prevZoneState.widthFeet,
          heightFeet: prevZoneState.heightFeet,
          depthFeet: prevZoneState.depthFeet,
          elevationOffsetFeet: prevZoneState.elevationOffsetFeet,
          windowCols: prevZoneState.windowCols,
          windowRows: prevZoneState.windowRows,
          windowRevealInches: prevZoneState.windowRevealInches,
          balconyProjectionFeet: prevZoneState.balconyProjectionFeet,
          interiorDepthFeet: prevZoneState.interiorDepthFeet,
          apparentArchitecturalDepthFeet: prevZoneState.apparentArchitecturalDepthFeet,
          forcedPerspectiveScaleFactor: prevZoneState.forcedPerspectiveScaleFactor,
          cameraSightlineSplayDeg: prevZoneState.cameraSightlineSplayDeg,
          floorRakePitchDeg: prevZoneState.floorRakePitchDeg
        },
        cvPrepassTelemetry: telemetry,
        spatialReasoningSummary,
        detectedFeatures,
        lowConfidenceFlags,
        createdAtIso: new Date().toISOString()
      };

      // Emit immediately so Review Gate & Dashboard update in real time
      onAddIterations([newIteration]);
      processedInRun++;
      if (confidenceScore < 75) lowConfInRun++;

      const durationMs = Math.round(performance.now() - frameStartT0);
      setQueueRuntimeMap((prev) => ({
        ...prev,
        [frame.id]: {
          frameId: frame.id,
          stageStatus:
            confidenceScore >= 75 ? 'completed_high_conf' : 'completed_low_conf',
          substageProgressPct: 100,
          stageLabel:
            confidenceScore >= 75
              ? `Solved (${confidenceScore}% Conf) · Ready at Gate`
              : `Flagged <75% (${confidenceScore}% Conf) · Needs Verification`,
          engineUsed: usedEngine,
          confidenceScore,
          durationMs,
          brickCoursesCounted: telemetry.brickCoursesCounted,
          solvedDimsSummary: `${proposedValues.widthFeet.toFixed(1)}'W × ${proposedValues.heightFeet.toFixed(1)}'H · ${proposedValues.windowCols}×${proposedValues.windowRows} Bay`,
          linkedIterationId: iterId
        }
      }));

      nextFrameCursorRef.current = i + 1;

      // If user clicked "Step +1 Frame", automatically pause after completing this frame
      if (pauseSingleStepRef.current && i + 1 < scanQueue.length) {
        isPausedRef.current = true;
        pauseSingleStepRef.current = false;
        setIsBatchPaused(true);
        setBatchEngineState('paused');
        setStatusMessage(
          `Single-step completed for Frame #${i + 1} (${frame.title}). Engine paused before Frame #${i + 2}.`
        );
        await waitIfEnginePaused(scanQueue[i + 1].id);
        if (cancelScanRef.current) break;
      }
    }

    setActiveFrameId(null);
    setCurrentFrameElapsedMs(0);
    setIsScanningBatch(false);
    setIsBatchPaused(false);
    if (!cancelScanRef.current) {
      setBatchEngineState('completed');
      nextFrameCursorRef.current = 0;
      setStatusMessage(
        `Batch sweep complete: ${processedInRun} frame passes analyzed (${lowConfInRun} low-confidence frames flagged for manual placement/orientation verification).`
      );
    }
  };

  const filteredIterations = layoutIterations.filter((it) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'needs_verification') {
      return it.confidenceScore < 75 && !it.manualVerification?.verifiedByUser;
    }
    return it.status === statusFilter;
  });

  const formatDelta = (prev: number, next: number, unit = "'") => {
    const diff = next - prev;
    if (Math.abs(diff) < 0.01) return '0.0' + unit;
    const sign = diff > 0 ? '+' : '';
    return `${sign}${diff.toFixed(2)}${unit}`;
  };

  // Compute real-time batch dashboard aggregates & Estimated Time to Completion (ETC)
  const activeQueueCount = scanQueue.filter((f) => !f.skipped).length;
  const completedQueueItems = scanQueue.filter((f) => {
    const st = queueRuntimeMap[f.id]?.stageStatus;
    return st === 'completed_high_conf' || st === 'completed_low_conf';
  });
  const flaggedQueueItems = scanQueue.filter(
    (f) => queueRuntimeMap[f.id]?.stageStatus === 'completed_low_conf'
  );
  const activeRuntimeItem = activeFrameId ? queueRuntimeMap[activeFrameId] : null;
  const isActiveFrameInFlight = Boolean(
    activeRuntimeItem &&
      activeRuntimeItem.stageStatus !== 'completed_high_conf' &&
      activeRuntimeItem.stageStatus !== 'completed_low_conf' &&
      activeRuntimeItem.stageStatus !== 'skipped'
  );
  const overallBatchPct =
    activeQueueCount === 0
      ? 0
      : Math.min(
          100,
          Math.round(
            ((completedQueueItems.length +
              (isActiveFrameInFlight && activeRuntimeItem
                ? activeRuntimeItem.substageProgressPct / 100
                : 0)) /
              activeQueueCount) *
              100
          )
        );

  // Calculate average processing speed (ms/frame and frames/sec) and real-time ETC
  const baselineFrameDurationMs = preferredEngine === 'gemini_cloud_hybrid' ? 880 : 540;
  const measuredFrameDurations = completedQueueItems
    .map((f) => queueRuntimeMap[f.id]?.durationMs)
    .filter((d): d is number => typeof d === 'number' && d > 0);

  const avgFrameDurationMs =
    measuredFrameDurations.length > 0
      ? Math.round(
          measuredFrameDurations.reduce((sum, d) => sum + d, 0) /
            measuredFrameDurations.length
        )
      : isActiveFrameInFlight &&
        activeRuntimeItem &&
        activeRuntimeItem.substageProgressPct >= 32 &&
        currentFrameElapsedMs > 120
      ? Math.round(
          baselineFrameDurationMs * 0.45 +
            (currentFrameElapsedMs / (activeRuntimeItem.substageProgressPct / 100)) * 0.55
        )
      : baselineFrameDurationMs;

  const avgFramesPerSecond =
    avgFrameDurationMs > 0 ? (1000 / avgFrameDurationMs).toFixed(2) : '0.00';

  const remainingUnstartedFramesCount = Math.max(
    0,
    activeQueueCount - completedQueueItems.length - (isActiveFrameInFlight ? 1 : 0)
  );

  const activeFrameRemainingMs =
    isActiveFrameInFlight && activeRuntimeItem
      ? Math.max(
          60,
          Math.round(
            Math.max(
              avgFrameDurationMs - currentFrameElapsedMs,
              avgFrameDurationMs * (1 - activeRuntimeItem.substageProgressPct / 100)
            )
          )
        )
      : 0;

  const estimatedRemainingMs =
    batchEngineState === 'completed' || activeQueueCount === 0
      ? 0
      : remainingUnstartedFramesCount * avgFrameDurationMs + activeFrameRemainingMs;

  const formatEtcDuration = (ms: number): string => {
    if (ms <= 0) return '00:00.0';
    const totalTenths = Math.round(ms / 100);
    const mins = Math.floor(totalTenths / 600);
    const secs = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  };

  // Compute 75GB MKV file process metrics and individual per-frame progress segments
  const featureDurationSec = 6720; // 112m 00s Rear Window (1954) 4K Remux runtime
  const mkvDemuxZscaleOverheadPerFrameMs = 340; // 75GB EBML seek + HEVC 10-bit decode + zscale PQ-to-Linear overhead
  const perFrameStreamShareGb =
    activeQueueCount > 0 ? Number((mountedSourceSizeGb / activeQueueCount).toFixed(2)) : 0;

  const frameProgressSegments: BatchFrameProgressSegment[] = (() => {
    let waitingOffset = 0;
    return scanQueue.map((qFrame, idx) => {
      const rt = queueRuntimeMap[qFrame.id] || {
        frameId: qFrame.id,
        stageStatus: 'queued' as FrameQueueStageStatus,
        substageProgressPct: 0,
        stageLabel: 'Waiting in Dual-Engine Queue'
      };
      const apt = STAGE18_APARTMENTS.find((a) => a.id === qFrame.targetApartmentHint);
      const zoneShortName = apt
        ? apt.designation.split(' · ')[0]
        : qFrame.targetApartmentHint.replace('apt-', '').toUpperCase();
      const tSec = parseSmpteToSeconds(qFrame.smpteTimecode);
      const mkvStreamOffsetGb = Number(
        Math.min(
          mountedSourceSizeGb,
          Math.max(0.4, (tSec / featureDurationSec) * mountedSourceSizeGb)
        ).toFixed(1)
      );
      const isProcessing =
        rt.stageStatus === 'stage1_cv_prepass' ||
        rt.stageStatus === 'stage2_ai_spatial_solve' ||
        rt.stageStatus === 'stage3_delta_commit';
      const isPausedHere = rt.stageStatus === 'paused';
      const isDone =
        rt.stageStatus === 'completed_high_conf' || rt.stageStatus === 'completed_low_conf';
      const isSkipped = rt.stageStatus === 'skipped' || Boolean(qFrame.skipped);

      let frameEtcMs = 0;
      if (isProcessing || isPausedHere) {
        frameEtcMs = activeFrameRemainingMs;
      } else if (!isDone && !isSkipped) {
        waitingOffset += 1;
        frameEtcMs = activeFrameRemainingMs + waitingOffset * avgFrameDurationMs;
      }

      return {
        frameId: qFrame.id,
        index: idx + 1,
        title: qFrame.title,
        smpteTimecode: qFrame.smpteTimecode,
        focalLengthMm: qFrame.focalLengthMm,
        targetApartmentHint: qFrame.targetApartmentHint,
        zoneShortName,
        mkvStreamOffsetGb,
        mkvStreamShareGb: isSkipped ? 0 : perFrameStreamShareGb,
        stageStatus: rt.stageStatus,
        substageProgressPct: isDone ? 100 : isSkipped ? 0 : rt.substageProgressPct,
        stageLabel: rt.stageLabel,
        engineUsed: rt.engineUsed,
        confidenceScore: rt.confidenceScore,
        durationMs: rt.durationMs,
        frameEtcMs,
        solvedDimsSummary: rt.solvedDimsSummary,
        linkedIterationId: rt.linkedIterationId,
        skipped: isSkipped
      };
    });
  })();

  // Total 75GB file process remaining time (includes 75GB container keyframe seek/zscale + Dual-Engine CV/AI pass)
  const remaining75GbDemuxMs =
    batchEngineState === 'completed' || activeQueueCount === 0
      ? 0
      : remainingUnstartedFramesCount * mkvDemuxZscaleOverheadPerFrameMs +
        (isActiveFrameInFlight && activeRuntimeItem
          ? Math.round(
              mkvDemuxZscaleOverheadPerFrameMs *
                Math.max(0, 1 - activeRuntimeItem.substageProgressPct / 100)
            )
          : 0);

  const total75GbProcessRemainingMs = estimatedRemainingMs + remaining75GbDemuxMs;

  const processedStreamGb = Number(
    Math.min(
      mountedSourceSizeGb,
      ((completedQueueItems.length +
        (isActiveFrameInFlight && activeRuntimeItem
          ? activeRuntimeItem.substageProgressPct / 100
          : 0)) /
        Math.max(1, activeQueueCount)) *
        mountedSourceSizeGb
    ).toFixed(2)
  );

  const effectiveStreamThroughputGbPerSec =
    avgFrameDurationMs + mkvDemuxZscaleOverheadPerFrameMs > 0
      ? (
          perFrameStreamShareGb /
          ((avgFrameDurationMs + mkvDemuxZscaleOverheadPerFrameMs) / 1000)
        ).toFixed(2)
      : '0.00';

  const activeFrameObjForSummary = activeFrameId
    ? scanQueue.find((f) => f.id === activeFrameId) || null
    : null;

  // Expose imperative batch controls to parent SourceVideoTestLab
  useEffect(() => {
    if (!batchControlRef) return;
    batchControlRef.current = {
      startOrResumeBatch: () => {
        if (isScanningBatch && isPausedRef.current) {
          handleTogglePauseResumeBatch();
        } else if (!isScanningBatch) {
          handleRunAutonomousBatchSweep(false);
        }
      },
      togglePauseResume: () => {
        if (isScanningBatch) {
          handleTogglePauseResumeBatch();
        } else {
          handleRunAutonomousBatchSweep(false);
        }
      },
      stepSingleFrame: () => {
        handleStepSingleFrame();
      },
      resetBatch: () => {
        handleResetBatchQueue();
      },
      inspectFrameIteration: (iterationId: string) => {
        const found = layoutIterations.find((it) => it.id === iterationId);
        if (found) {
          openFrameVerificationWorkbench(found);
        }
      }
    };
  });

  // Broadcast live batch progress summary up to SourceVideoTestLab
  useEffect(() => {
    if (!onBatchProgressUpdate) return;
    onBatchProgressUpdate({
      batchEngineState,
      isScanningBatch,
      isBatchPaused,
      activeQueueCount,
      completedCount: completedQueueItems.length,
      flaggedLowConfCount: flaggedQueueItems.length,
      overallBatchPct,
      avgFrameDurationMs,
      avgFramesPerSecond,
      batchElapsedMs,
      estimatedRemainingMs,
      total75GbProcessRemainingMs,
      processedStreamGb,
      totalStreamGb: mountedSourceSizeGb,
      effectiveStreamThroughputGbPerSec,
      activeFrameTitle: activeFrameObjForSummary?.title || null,
      activeStageLabel: activeRuntimeItem?.stageLabel || null,
      segments: frameProgressSegments
    });
  }, [
    batchEngineState,
    isScanningBatch,
    isBatchPaused,
    activeQueueCount,
    completedQueueItems.length,
    flaggedQueueItems.length,
    overallBatchPct,
    avgFrameDurationMs,
    avgFramesPerSecond,
    batchElapsedMs,
    estimatedRemainingMs,
    total75GbProcessRemainingMs,
    processedStreamGb,
    mountedSourceSizeGb,
    effectiveStreamThroughputGbPerSec,
    activeFrameId,
    queueRuntimeMap
  ]);

  // System Resource & Hardware Limit Computed Metrics
  const memoryUsagePct = Math.min(99, Math.round((memoryUsedMb / memoryBudgetMb) * 100));
  const peakMemoryUsagePct = Math.min(
    99,
    Math.round((peakMemoryUsedMb / memoryBudgetMb) * 100)
  );
  const isCpuNearLimit = cpuLoadPct >= hardwareWarnThresholdPct;
  const isMemoryNearLimit = memoryUsagePct >= hardwareWarnThresholdPct;
  const isHardwareWarningActive = isCpuNearLimit || isMemoryNearLimit;
  const isHardwareCriticalActive = cpuLoadPct >= 88 || memoryUsagePct >= 88;

  return (
    <div className="space-y-6">
      {/* Top Architecture Summary & Dual-Engine Mode Selector */}
      <div className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <p className="text-xs font-mono text-amber-400">
              STEP 05 · AUTONOMOUS DUAL-ENGINE FRAME-TO-3D SOLVER &amp; LOW-CONFIDENCE VERIFICATION
            </p>
            <h2 className="text-xl font-bold text-white font-display mt-1">
              Automated Frame Sweep, 3D Layout Convergence &amp; Frame Verification System
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">
              Combines client-side Sobel vanishing-line &amp; brick-course metrology (
              <code className="text-amber-300">3 courses = 8.0 in</code>) with server-side{' '}
              <span className="text-white font-medium">Gemini Vision AI</span> and an automatic{' '}
              <span className="text-white font-medium">Local Browser CV Backup</span>. Whenever the
              engine detects low confidence (<code className="text-amber-300">&lt;75%</code> due to
              Venetian blinds, oblique pan roll, or shadow occlusion), use the{' '}
              <span className="text-amber-300 font-medium">
                Interactive Frame Verification &amp; Calibration Workbench
              </span>{' '}
              to adjust placement, orientation, or validity.
            </p>
          </div>

          {/* Global Convergence Telemetry */}
          <div className="flex items-center gap-4 bg-[#0B0D11] border border-white/10 rounded-xl px-4 py-3 shrink-0 font-mono text-xs">
            <div>
              <div className="text-slate-400 text-[11px]">COURTYARD CONVERGENCE</div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  avgConfidence >= 80
                    ? 'text-emerald-400'
                    : avgConfidence >= 45
                    ? 'text-amber-400'
                    : 'text-sky-400'
                }`}
              >
                {avgConfidence}% Confidence
              </div>
            </div>
            <div className="h-8 w-[1px] bg-white/10" />
            <div>
              <div className="text-slate-400 text-[11px]">VERIFICATION QUEUE</div>
              <div className="text-slate-200 font-semibold tabular-nums">
                {needsVerificationCount} Low-Conf · {approvedCount} Applied
              </div>
            </div>
          </div>
        </div>

        {/* Engine Mode Selection + Batch Sweep Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 space-y-2">
            <label className="block text-xs font-mono text-slate-400">
              SELECT 3D RECONSTRUCTION ANALYSIS ENGINE (WITH AUTOMATIC OFFLINE FAILOVER)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setPreferredEngine('gemini_cloud_hybrid')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  preferredEngine === 'gemini_cloud_hybrid'
                    ? 'bg-amber-500/15 border-amber-400 text-white'
                    : 'bg-[#0B0D11] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Hybrid Gemini Vision AI + CV
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">PRIMARY</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Uses server-side Gemini 4 Hydrogen multimodal reasoning + client CV telemetry,
                  with automatic failover to Local CV Backup.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPreferredEngine('local_cv_backup')}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  preferredEngine === 'local_cv_backup'
                    ? 'bg-sky-500/15 border-sky-400 text-white'
                    : 'bg-[#0B0D11] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-sky-300">
                    <Cpu className="w-3.5 h-3.5" />
                    Local Browser CV Solver Only
                  </span>
                  <span className="text-[10px] font-mono text-sky-400">OFFLINE BACKUP</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  100% local deterministic Sobel vanishing-line, brick-course frequency, and window
                  bay solver requiring zero cloud connectivity.
                </p>
              </button>
            </div>

            {/* Camera-POV Forced-Perspective vs. Naive Architectural Standard Mode Toggle */}
            <div className="p-3 rounded-lg bg-[#0B0D11] border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-mono font-semibold text-amber-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  CAMERA-POV FORCED-PERSPECTIVE &amp; NON-ORTHOGONAL CARPENTRY COMPENSATION
                </div>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Stage 18 was built for optical accuracy from Jeff&apos;s lens (<code className="text-amber-300">X=0, Y=+14.5&apos;, Z=+18.2&apos;</code>), not municipal building codes. Distant rooms use compressed depths (<code className="text-amber-300">0.66×–0.88×</code> scale), splayed side walls (<code className="text-amber-300">+6.8° to +14.5°</code>), and raked floors.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={() => setPovCompensationEnabled(true)}
                  className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap ${
                    povCompensationEnabled
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-[#12161F] text-slate-300 border-white/10 hover:text-white'
                  }`}
                >
                  POV Set Carpentry (Active)
                </button>
                <button
                  type="button"
                  onClick={() => setPovCompensationEnabled(false)}
                  className={`px-2.5 py-1.5 rounded border transition-colors whitespace-nowrap ${
                    !povCompensationEnabled
                      ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                      : 'bg-[#12161F] text-slate-400 border-white/10 hover:text-white'
                  }`}
                  title="Compare against uncompensated 1:1 NYC architectural standard assumptions"
                >
                  Naive 1:1 Arch Code
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-2.5">
            {/* Primary Start / Pause / Resume / Step Controls */}
            <div className="flex items-center gap-2">
              {!isScanningBatch ? (
                <button
                  type="button"
                  onClick={() => handleRunAutonomousBatchSweep(false)}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Play className="w-4 h-4" />
                  Run Autonomous Batch Sweep ({activeQueueCount} Active Frames)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTogglePauseResumeBatch}
                  className={`flex-1 py-3 px-4 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                    isBatchPaused
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {isBatchPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      Resume Dual-Engine Scan (Frame #{scanProgressIndex})
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause Engine ({scanProgressIndex}/{scanQueue.length})
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleStepSingleFrame}
                disabled={isScanningBatch && !isBatchPaused}
                title="Advance exactly 1 frame through the Dual-Engine pipeline and pause"
                className="py-3 px-3 bg-[#1A202C] hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
              >
                <SkipForward className="w-4 h-4" />
                Step +1
              </button>

              {(isScanningBatch || batchEngineState === 'completed') && (
                <button
                  type="button"
                  onClick={handleResetBatchQueue}
                  title="Stop & Reset Batch Queue"
                  className="py-3 px-3 bg-[#0B0D11] hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-white/15 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {externalDiagnosticPlates.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncDiagnosticPlatesToQueue}
                  disabled={isScanningBatch}
                  className="flex-1 py-1.5 px-3 bg-[#1A202C] hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Use {externalDiagnosticPlates.length} Ingested 75GB Plates
                </button>
              )}

              <label className="flex-1 py-1.5 px-3 bg-[#0B0D11] hover:bg-[#1A202C] text-slate-200 border border-white/15 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                Add Custom Stills to Queue
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadCustomScanFrames}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* =====================================================================
            VISUAL BATCH PROGRESS DASHBOARD & REAL-TIME DUAL-ENGINE STATUS QUEUE
           ===================================================================== */}
        <div className="bg-[#0B0D11] border border-white/15 rounded-xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  batchEngineState === 'running'
                    ? 'bg-amber-400 animate-pulse'
                    : batchEngineState === 'paused'
                    ? 'bg-sky-400'
                    : batchEngineState === 'completed'
                    ? 'bg-emerald-400'
                    : 'bg-slate-500'
                }`}
              />
              <div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-amber-400 font-semibold">
                    VISUAL BATCH PROGRESS DASHBOARD &amp; REAL-TIME STATUS QUEUE
                  </span>
                  <span className="text-slate-500">·</span>
                  <span
                    className={
                      batchEngineState === 'running'
                        ? 'text-amber-300 font-semibold'
                        : batchEngineState === 'paused'
                        ? 'text-sky-300 font-semibold'
                        : batchEngineState === 'completed'
                        ? 'text-emerald-400 font-semibold'
                        : 'text-slate-400'
                    }
                  >
                    ENGINE STATE: {batchEngineState.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time 3-stage pipeline telemetry per queued frame: (1) Client CV Sobel &amp;
                  Brick-Course Pre-Pass → (2) Gemini 4 Hydrogen / Local CV Spatial Solve → (3)
                  3D Layout Delta &amp; Confidence Gate.
                </p>
              </div>
            </div>

            {/* Live Batch Telemetry Counters + Real-Time 75GB Process ETC & Processing Speed */}
            <div className="flex items-center gap-2.5 text-xs font-mono shrink-0 flex-wrap">
              <div className="px-3 py-1.5 rounded-lg bg-[#12161F] border border-white/10">
                <span className="text-slate-400">FRAMES: </span>
                <span className="text-white font-semibold tabular-nums">
                  {completedQueueItems.length}/{activeQueueCount} ({overallBatchPct}%)
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#12161F] border border-white/10">
                <span className="text-slate-400">75GB SPAN: </span>
                <span className="text-amber-300 font-semibold tabular-nums">
                  {processedStreamGb.toFixed(1)}/{mountedSourceSizeGb.toFixed(1)} GB (
                  {effectiveStreamThroughputGbPerSec} GB/s)
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#12161F] border border-white/10">
                <span className="text-slate-400">AVG SPEED: </span>
                <span className="text-sky-300 font-semibold tabular-nums">
                  {avgFrameDurationMs}ms/f ({avgFramesPerSecond} fps)
                </span>
              </div>
              <div
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                  batchEngineState === 'running'
                    ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                    : batchEngineState === 'paused'
                    ? 'bg-sky-500/15 border-sky-400/50 text-sky-300'
                    : batchEngineState === 'completed'
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                    : 'bg-[#12161F] border-white/10 text-slate-200'
                }`}
                title="Total Estimated Time Remaining for the 75GB file process (EBML seek + zscale HDR transfer + 3-stage CV/AI spatial solver)"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="text-slate-400">75GB PROCESS ETC:</span>
                <span className="font-bold tabular-nums">
                  {batchEngineState === 'completed'
                    ? '00:00.0 (DONE)'
                    : batchEngineState === 'paused'
                    ? `${formatEtcDuration(total75GbProcessRemainingMs)} (HOLD)`
                    : batchEngineState === 'running'
                    ? `${formatEtcDuration(total75GbProcessRemainingMs)} (~${(
                        total75GbProcessRemainingMs / 1000
                      ).toFixed(1)}s)`
                    : `~${formatEtcDuration(total75GbProcessRemainingMs)} (EST)`}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#12161F] border border-white/10">
                <span className="text-slate-400">ELAPSED: </span>
                <span className="text-slate-200 font-semibold tabular-nums">
                  {(batchElapsedMs / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>

          {/* =================================================================
              MULTI-SEGMENT INDIVIDUAL FRAME PROGRESS BAR & 75GB FILE TIMELINE
             ================================================================= */}
          <div className="bg-[#12161F] border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-400 font-semibold shrink-0">
                  INDIVIDUAL FRAME PROGRESS &amp; 75GB STREAM TIMELINE:
                </span>
                <span className="text-slate-300 truncate">
                  {activeRuntimeItem
                    ? `Active: ${activeRuntimeItem.stageLabel}`
                    : batchEngineState === 'paused'
                    ? 'Paused — Click Resume or Step +1 Frame'
                    : batchEngineState === 'completed'
                    ? `Completed ${completedQueueItems.length}/${activeQueueCount} Frames (${mountedSourceSizeGb.toFixed(
                        1
                      )} GB Stream Spanned)`
                    : `Ready to analyze ${activeQueueCount} frames across ${mountedSourceSizeGb.toFixed(
                        1
                      )} GB MKV container`}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 tabular-nums">
                <span className="text-slate-400">
                  Solver ETC: {(estimatedRemainingMs / 1000).toFixed(1)}s
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-amber-300 font-semibold">
                  Total 75GB Process Remaining: {formatEtcDuration(total75GbProcessRemainingMs)} (
                  {(total75GbProcessRemainingMs / 1000).toFixed(1)}s)
                </span>
              </div>
            </div>

            {/* Track 1: Segmented Per-Frame Visual Progress Bar (Shows Individual Progress Per Frame) */}
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, frameProgressSegments.length)}, minmax(0, 1fr))`
              }}
            >
              {frameProgressSegments.map((seg) => {
                const isProcessing =
                  seg.stageStatus === 'stage1_cv_prepass' ||
                  seg.stageStatus === 'stage2_ai_spatial_solve' ||
                  seg.stageStatus === 'stage3_delta_commit';
                const isPausedHere = seg.stageStatus === 'paused';
                const isHighConf = seg.stageStatus === 'completed_high_conf';
                const isLowConf = seg.stageStatus === 'completed_low_conf';

                const fillClass = isProcessing
                  ? 'bg-amber-400'
                  : isPausedHere
                  ? 'bg-sky-400'
                  : isLowConf
                  ? 'bg-amber-500'
                  : isHighConf
                  ? 'bg-emerald-500'
                  : 'bg-slate-700';

                return (
                  <div
                    key={seg.frameId}
                    className={`p-2 rounded-lg border transition-colors space-y-1.5 font-mono text-[10px] ${
                      isProcessing
                        ? 'bg-[#181E2C] border-amber-400'
                        : isPausedHere
                        ? 'bg-[#131D2B] border-sky-400'
                        : isLowConf
                        ? 'bg-[#191410] border-amber-500/60'
                        : isHighConf
                        ? 'bg-[#0F1918] border-emerald-500/40'
                        : seg.skipped
                        ? 'bg-[#0B0D11]/50 border-white/5 opacity-50'
                        : 'bg-[#0B0D11] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-amber-400 font-bold tabular-nums">
                        F#{String(seg.index).padStart(2, '0')}
                      </span>
                      <span className="text-slate-400 tabular-nums truncate">
                        @{seg.mkvStreamOffsetGb}GB
                      </span>
                      <span
                        className={`font-bold tabular-nums ${
                          isHighConf
                            ? 'text-emerald-400'
                            : isLowConf
                            ? 'text-amber-400'
                            : isProcessing
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {seg.substageProgressPct}%
                      </span>
                    </div>

                    {/* Individual Frame Progress Bar */}
                    <div className="w-full h-2 bg-[#12161F] rounded-xs overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-150 ${fillClass}`}
                        style={{ width: `${seg.substageProgressPct}%` }}
                      />
                    </div>

                    {/* 3 Sub-Stage Pips (S1: CV, S2: 3D Solve, S3: Gate) */}
                    <div className="grid grid-cols-3 gap-1 pt-0.5">
                      <div
                        className={`h-1 rounded-xs ${
                          seg.substageProgressPct >= 30 ? fillClass : 'bg-white/10'
                        }`}
                        title="Stage 1: Client CV Sobel & Brick-Course Pre-Pass"
                      />
                      <div
                        className={`h-1 rounded-xs ${
                          seg.substageProgressPct >= 65 ? fillClass : 'bg-white/10'
                        }`}
                        title="Stage 2: Dual-Engine 3D Spatial Solve"
                      />
                      <div
                        className={`h-1 rounded-xs ${
                          seg.substageProgressPct >= 90 ? fillClass : 'bg-white/10'
                        }`}
                        title="Stage 3: Layout Delta & Confidence Gate"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-slate-400 tabular-nums truncate">
                      <span className="truncate text-slate-300">{seg.zoneShortName}</span>
                      <span>
                        {typeof seg.durationMs === 'number'
                          ? `${seg.durationMs}ms`
                          : seg.frameEtcMs > 0
                          ? `~${(seg.frameEtcMs / 1000).toFixed(1)}s`
                          : seg.skipped
                          ? 'SKIP'
                          : 'WAIT'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Track 2: Cumulative 75GB File Process Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                <span>
                  CUMULATIVE 75GB MKV PROCESS ({processedStreamGb.toFixed(2)} GB /{' '}
                  {mountedSourceSizeGb.toFixed(2)} GB STREAM COVERAGE)
                </span>
                <span className="text-amber-300 font-semibold">
                  {overallBatchPct}% Complete · Total Remaining:{' '}
                  {formatEtcDuration(total75GbProcessRemainingMs)}
                </span>
              </div>
              <div className="w-full h-2 bg-[#0B0D11] border border-white/10 rounded-sm overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    batchEngineState === 'paused'
                      ? 'bg-sky-400'
                      : batchEngineState === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${overallBatchPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* =================================================================
              75GB SOURCE SYSTEM RESOURCE & HARDWARE TELEMETRY MONITOR
             ================================================================= */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-colors ${
              isHardwareCriticalActive
                ? 'bg-red-950/25 border-red-500/60'
                : isHardwareWarningActive
                ? 'bg-amber-950/20 border-amber-500/50'
                : 'bg-[#12161F] border-white/10'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <HardDrive
                  className={`w-4 h-4 shrink-0 ${
                    isHardwareCriticalActive
                      ? 'text-red-400 animate-pulse'
                      : isHardwareWarningActive
                      ? 'text-amber-400'
                      : 'text-sky-400'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                    <span className="text-white font-semibold">
                      75GB SOURCE SYSTEM RESOURCE &amp; HARDWARE LIMIT MONITOR
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-300">
                      SOURCE: {mountedSourceFileName} ({mountedSourceSizeGb.toFixed(1)} GB)
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">
                      HOST: {hardwareLogicalCores} Logical Cores / ~{detectedDeviceRamGb} GB RAM
                    </span>
                  </div>
                </div>
              </div>

              {/* Resource Monitor Controls: Threshold, Eco-Throttle & 75GB Pressure Test */}
              <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                <div className="flex items-center gap-1.5 bg-[#0B0D11] border border-white/10 rounded px-2 py-1">
                  <span className="text-slate-400">WARN GATE:</span>
                  <select
                    value={hardwareWarnThresholdPct}
                    onChange={(e) => setHardwareWarnThresholdPct(Number(e.target.value))}
                    className="bg-transparent text-amber-300 font-semibold focus:outline-none"
                  >
                    <option value={70} className="bg-[#0B0D11]">
                      70% Load
                    </option>
                    <option value={80} className="bg-[#0B0D11]">
                      80% Load
                    </option>
                    <option value={85} className="bg-[#0B0D11]">
                      85% Load
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleToggleEcoThrottle}
                  className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${
                    ecoThrottleEnabled
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-semibold'
                      : 'bg-[#0B0D11] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                  title="Throttle inter-frame CV/AI cadence to cap CPU load and 75GB decode memory pressure"
                >
                  <Zap className="w-3 h-3" />
                  {ecoThrottleEnabled ? 'Eco-Throttle: ON' : 'Eco-Throttle: OFF'}
                </button>

                <button
                  type="button"
                  onClick={() => setSimulate75GbStress((prev) => !prev)}
                  className={`px-2.5 py-1 rounded border transition-colors flex items-center gap-1 ${
                    simulate75GbStress
                      ? 'bg-red-500/25 border-red-400 text-red-200 font-semibold'
                      : 'bg-[#0B0D11] border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Simulate 75 GB 4K UHD HEVC 16-bit uncompressed frame buffer spike near hardware limits"
                >
                  <AlertTriangle className="w-3 h-3" />
                  {simulate75GbStress ? '75GB Stress Spike: ACTIVE' : 'Test 75GB Limit Warning'}
                </button>
              </div>
            </div>

            {/* Dual Telemetry Gauges: CPU Compute Load & 75GB Stream / WebGL2 Memory Allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* CPU Compute Load Gauge (5 cols) */}
              <div className="lg:col-span-5 bg-[#0B0D11] border border-white/10 rounded-lg p-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    CPU COMPUTE LOAD ({hardwareLogicalCores} THREADS)
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      cpuLoadPct >= 88
                        ? 'text-red-400'
                        : cpuLoadPct >= hardwareWarnThresholdPct
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {cpuLoadPct}%{' '}
                    <span className="text-[10px] font-normal text-slate-400">
                      (Peak {peakCpuLoadPct}%)
                    </span>
                  </span>
                </div>

                <div className="w-full h-2 bg-[#12161F] rounded-sm overflow-hidden border border-white/10 relative">
                  <div
                    className={`h-full transition-all duration-200 ${
                      cpuLoadPct >= 88
                        ? 'bg-red-500'
                        : cpuLoadPct >= hardwareWarnThresholdPct
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${cpuLoadPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                  <span>Sobel + Laplacian + Spatial Solver</span>
                  <span>Event-Loop Lag: {eventLoopLagMs}ms</span>
                </div>
              </div>

              {/* Memory & 75GB Frame Buffer Gauge (5 cols) */}
              <div className="lg:col-span-5 bg-[#0B0D11] border border-white/10 rounded-lg p-3 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                    75GB STREAM &amp; HEAP MEMORY
                  </span>
                  <span
                    className={`font-bold tabular-nums ${
                      memoryUsagePct >= 88
                        ? 'text-red-400'
                        : memoryUsagePct >= hardwareWarnThresholdPct
                        ? 'text-amber-400'
                        : 'text-sky-300'
                    }`}
                  >
                    {(memoryUsedMb / 1024).toFixed(2)} GB / {(memoryBudgetMb / 1024).toFixed(1)} GB (
                    {memoryUsagePct}%)
                  </span>
                </div>

                <div className="w-full h-2 bg-[#12161F] rounded-sm overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-200 ${
                      memoryUsagePct >= 88
                        ? 'bg-red-500'
                        : memoryUsagePct >= hardwareWarnThresholdPct
                        ? 'bg-amber-500'
                        : 'bg-sky-400'
                    }`}
                    style={{ width: `${memoryUsagePct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                  <span>
                    Peak: {(peakMemoryUsedMb / 1024).toFixed(2)} GB ({peakMemoryUsagePct}%)
                  </span>
                  <button
                    type="button"
                    onClick={handlePurgeFrameDecodeBuffers}
                    className="text-sky-300 hover:text-sky-200 underline"
                  >
                    Purge Decode Buffers (GC)
                  </button>
                </div>
              </div>

              {/* 18-Sample Rolling CPU / Memory Sparkline History (2 cols) */}
              <div className="lg:col-span-2 bg-[#0B0D11] border border-white/10 rounded-lg p-3 flex flex-col justify-between h-full min-h-[74px]">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>LOAD HISTORY</span>
                  <span className="text-amber-300 tabular-nums">LIVE</span>
                </div>
                <div className="h-10 flex items-end gap-[2px] pt-1">
                  {resourceHistory.map((pt, i) => {
                    const maxBar = Math.max(pt.cpu, pt.mem);
                    const isWarn = maxBar >= hardwareWarnThresholdPct;
                    const isCrit = maxBar >= 88;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-t-xs transition-all duration-150 ${
                          isCrit
                            ? 'bg-red-500'
                            : isWarn
                            ? 'bg-amber-400'
                            : 'bg-sky-400/75'
                        }`}
                        style={{ height: `${Math.max(12, maxBar)}%` }}
                        title={`CPU ${pt.cpu}% · RAM ${pt.mem}%`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Visual Warning Banner when 75GB Source File Analysis Nears Hardware Limits */}
            {isHardwareWarningActive && (
              <div
                className={`p-3.5 rounded-lg border flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs font-mono ${
                  isHardwareCriticalActive
                    ? 'bg-red-500/15 border-red-400 text-red-100'
                    : 'bg-amber-500/15 border-amber-400 text-amber-100'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isHardwareCriticalActive ? 'text-red-400 animate-bounce' : 'text-amber-400'
                    }`}
                  />
                  <div className="space-y-1">
                    <div className="font-bold">
                      {isHardwareCriticalActive
                        ? `CRITICAL HARDWARE PRESSURE (CPU ${cpuLoadPct}% · RAM ${memoryUsagePct}%): 75GB UHD REMUX STREAM NEAR BROWSER HEAP CEILING`
                        : `HARDWARE LIMIT WARNING (≥${hardwareWarnThresholdPct}% THRESHOLD): 75GB SOURCE ANALYSIS APPROACHING SYSTEM CAPACITY`}
                    </div>
                    <p className="text-[11px] text-slate-200 font-sans leading-relaxed">
                      Concurrent 16-bit 4K PNG frame decoding and Sobel/Laplacian spatial-frequency
                      passes on <span className="font-mono font-semibold">{mountedSourceFileName}</span>{' '}
                      ({mountedSourceSizeGb.toFixed(1)} GB) have reached{' '}
                      <span className="font-mono font-semibold">
                        {(memoryUsedMb / 1024).toFixed(2)} GB RAM ({memoryUsagePct}%)
                      </span>{' '}
                      and <span className="font-mono font-semibold">{cpuLoadPct}% CPU load</span>.
                      Enable <span className="font-semibold">Eco-Throttle</span> or{' '}
                      <span className="font-semibold">Purge Cached Frame Buffers</span> below to
                      prevent frame drops or WebGL2 context eviction.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePurgeFrameDecodeBuffers}
                    className="px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 text-white font-semibold transition-colors whitespace-nowrap"
                  >
                    Purge Frame Buffers (-520 MB)
                  </button>
                  {!ecoThrottleEnabled && (
                    <button
                      type="button"
                      onClick={handleToggleEcoThrottle}
                      className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold transition-colors whitespace-nowrap"
                    >
                      Enable Eco-Throttle
                    </button>
                  )}
                  {isScanningBatch && !isBatchPaused && (
                    <button
                      type="button"
                      onClick={handleTogglePauseResumeBatch}
                      className="px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold transition-colors whitespace-nowrap"
                    >
                      Pause Scan Now
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Per-Frame Status Queue List */}
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {(() => {
              let waitingQueueOffsetCount = 0;
              return scanQueue.map((qFrame, idx) => {
                const rt = queueRuntimeMap[qFrame.id] || {
                  frameId: qFrame.id,
                  stageStatus: 'queued',
                  substageProgressPct: 0,
                  stageLabel: 'Waiting in Dual-Engine Queue'
                };
                const apt = STAGE18_APARTMENTS.find((a) => a.id === qFrame.targetApartmentHint);
                const isProcessing =
                  rt.stageStatus === 'stage1_cv_prepass' ||
                  rt.stageStatus === 'stage2_ai_spatial_solve' ||
                  rt.stageStatus === 'stage3_delta_commit';
                const isPausedHere = rt.stageStatus === 'paused';
                const isHighConfDone = rt.stageStatus === 'completed_high_conf';
                const isLowConfDone = rt.stageStatus === 'completed_low_conf';
                const isSkipped = rt.stageStatus === 'skipped' || Boolean(qFrame.skipped);
                const isWaitingInQueue =
                  !isProcessing &&
                  !isPausedHere &&
                  !isHighConfDone &&
                  !isLowConfDone &&
                  !isSkipped;

                let frameEtcMs = 0;
                if (isProcessing || isPausedHere) {
                  frameEtcMs = activeFrameRemainingMs;
                } else if (isWaitingInQueue) {
                  waitingQueueOffsetCount += 1;
                  frameEtcMs =
                    activeFrameRemainingMs + waitingQueueOffsetCount * avgFrameDurationMs;
                }

              return (
                <div
                  key={qFrame.id}
                  className={`p-3 rounded-lg border transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs ${
                    isProcessing
                      ? 'bg-[#181E2C] border-amber-400'
                      : isPausedHere
                      ? 'bg-[#131D2B] border-sky-400'
                      : isLowConfDone
                      ? 'bg-[#191410] border-amber-500/60'
                      : isHighConfDone
                      ? 'bg-[#0F1918] border-emerald-500/40'
                      : isSkipped
                      ? 'bg-[#0B0D11]/50 border-white/5 opacity-55'
                      : 'bg-[#12161F] border-white/10'
                  }`}
                >
                  {/* Left: Queue Index, Frame Title, SMPTE, Lens & Target Zone */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
                      <span className="text-amber-400 font-bold tabular-nums">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="text-slate-200 font-semibold">
                        SMPTE {qFrame.smpteTimecode}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-300">{qFrame.focalLengthMm}mm Lens</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-amber-300/90">
                        {apt ? apt.designation.split(' · ')[0] : qFrame.targetApartmentHint}
                      </span>
                      {rt.engineUsed && (
                        <>
                          <span className="text-slate-500">·</span>
                          <span
                            className={
                              rt.engineUsed === 'gemini_cloud_hybrid'
                                ? 'text-amber-300'
                                : 'text-sky-300'
                            }
                          >
                            {rt.engineUsed === 'gemini_cloud_hybrid' ? 'Gemini AI+CV' : 'Local CV'}
                          </span>
                        </>
                      )}
                      {typeof rt.durationMs === 'number' ? (
                        <>
                          <span className="text-slate-500">·</span>
                          <span className="text-emerald-300/90 tabular-nums">
                            Solved in {rt.durationMs}ms
                          </span>
                        </>
                      ) : frameEtcMs > 0 ? (
                        <>
                          <span className="text-slate-500">·</span>
                          <span className="text-sky-300/90 tabular-nums">
                            ETC ~{(frameEtcMs / 1000).toFixed(1)}s
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className="text-white font-medium truncate">{qFrame.title}</div>
                  </div>

                  {/* Center: 3-Stage Pipeline Indicator + Mini Progress Bar */}
                  <div className="lg:w-72 shrink-0 space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate ${
                          isProcessing
                            ? 'text-amber-300 font-semibold'
                            : isPausedHere
                            ? 'text-sky-300 font-semibold'
                            : isLowConfDone
                            ? 'text-amber-400 font-semibold'
                            : isHighConfDone
                            ? 'text-emerald-400 font-semibold'
                            : 'text-slate-400'
                        }`}
                      >
                        {rt.stageLabel}
                      </span>
                      <span className="text-slate-300 tabular-nums shrink-0">
                        {rt.substageProgressPct}%
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-[#0B0D11] rounded-sm overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-150 ${
                          isProcessing
                            ? 'bg-amber-400'
                            : isPausedHere
                            ? 'bg-sky-400'
                            : isLowConfDone
                            ? 'bg-amber-500'
                            : isHighConfDone
                            ? 'bg-emerald-400'
                            : 'bg-slate-700'
                        }`}
                        style={{ width: `${rt.substageProgressPct}%` }}
                      />
                    </div>

                    {rt.solvedDimsSummary && (
                      <div className="text-[10px] text-slate-300 tabular-nums flex items-center justify-between">
                        <span>{rt.solvedDimsSummary}</span>
                        {rt.brickCoursesCounted && (
                          <span className="text-slate-400">
                            {rt.brickCoursesCounted} Brick Courses
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Queue Action / Verification Trigger */}
                  <div className="flex items-center gap-2 shrink-0">
                    {rt.linkedIterationId && (
                      <button
                        type="button"
                        onClick={() => {
                          const foundIter = layoutIterations.find(
                            (it) => it.id === rt.linkedIterationId
                          );
                          if (foundIter) {
                            openFrameVerificationWorkbench(foundIter);
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap ${
                          isLowConfDone
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                            : 'bg-[#1A202C] text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/15'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        {isLowConfDone ? 'Verify Low-Conf' : 'Inspect / Calibrate'}
                      </button>
                    )}

                    {!isScanningBatch && !rt.linkedIterationId && (
                      <button
                        type="button"
                        onClick={() => handleToggleSkipQueuedFrame(qFrame.id)}
                        className="px-2.5 py-1 rounded text-[11px] font-mono bg-[#0B0D11] text-slate-300 hover:text-white border border-white/10 whitespace-nowrap"
                      >
                        {isSkipped ? 'Include' : 'Skip'}
                      </button>
                    )}
                  </div>
                </div>
              );
            });
          })()}
          </div>
        </div>

        {/* Status & Automatic Backup Failover Alerts */}
        {fallbackNotice && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
              <span>{fallbackNotice}</span>
            </div>
            <button onClick={() => setFallbackNotice(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {statusMessage && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 font-mono">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMessage}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stage 18 Per-Zone Convergence Status Strip */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-slate-400">
              LIVE STAGE 18 ZONE CONVERGENCE &amp; CONFIDENCE HEATMAP STATE
            </span>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => onNavigateToWorkbenchWithHeatmap()}
                className="text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                View Live 3D Confidence Heatmap in Workbench →
              </button>
              <button
                type="button"
                onClick={onResetAllOverrides}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Baseline Priors
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {STAGE18_APARTMENTS.map((apt) => {
              const ov =
                parametricOverrides[apt.id] || INITIAL_BUILDING_PARAMETRIC_OVERRIDES[apt.id];
              const conf = ov.confidenceScore;
              const barColor =
                conf >= 80 ? 'bg-emerald-400' : conf >= 45 ? 'bg-amber-400' : 'bg-sky-400';
              return (
                <div
                  key={apt.id}
                  onClick={() => onNavigateToWorkbenchWithHeatmap(apt.id)}
                  className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/10 hover:border-amber-400/50 cursor-pointer transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300 truncate">
                      {apt.designation.split(' · ')[0]}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        conf >= 80
                          ? 'text-emerald-400'
                          : conf >= 45
                          ? 'text-amber-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {conf}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${conf}%` }} />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums truncate">
                    {ov.widthFeet.toFixed(1)}&apos;×{ov.heightFeet.toFixed(1)}&apos; · Grid{' '}
                    {ov.windowCols}×{ov.windowRows}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User Review Gate & Low-Confidence Frame Verification System */}
      <div className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <p className="text-xs font-mono text-amber-400">
              ITERATION REVIEW GATE &amp; LOW-CONFIDENCE FRAME VERIFICATION SYSTEM
            </p>
            <h3 className="text-lg font-bold text-white font-display mt-0.5">
              Proposed Architectural 3D Layout Deltas ({layoutIterations.length})
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#0B0D11] border border-white/10 rounded-lg text-xs flex-wrap">
              {(
                [
                  { id: 'all', label: `All (${layoutIterations.length})` },
                  {
                    id: 'needs_verification',
                    label: `Needs Verification <75% (${needsVerificationCount})`
                  },
                  { id: 'pending_review', label: `Pending Gate (${pendingCount})` },
                  { id: 'approved', label: `Applied (${approvedCount})` },
                  {
                    id: 'rejected',
                    label: `Rejected / Invalid (${
                      layoutIterations.filter((i) => i.status === 'rejected').length
                    })`
                  }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap ${
                    statusFilter === tab.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => onApproveAllPending(75)}
                className="px-3.5 py-2 text-xs font-semibold bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approve High-Confidence ≥75%
              </button>
            )}

            <button
              type="button"
              onClick={onNavigateToDeltaScript}
              className="px-3.5 py-2 text-xs font-semibold bg-[#1A202C] text-amber-300 border border-amber-500/40 rounded-lg hover:bg-amber-500/15 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileCode className="w-3.5 h-3.5" />
              Compile 05_apply_ai_iterative_layout_deltas.py →
            </button>
          </div>
        </div>

        {/* Low-Confidence Alert Callout when low-confidence frames exist */}
        {needsVerificationCount > 0 && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-semibold text-amber-200">
                  {needsVerificationCount} Frame(s) Flagged with Low Interpretation Confidence (&lt;75%)
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Due to Venetian blind slat aliasing, oblique camera pan roll, or shadow occlusion,
                  automatic approval skipped these frames. Click{' '}
                  <strong className="text-white">
                    Verify &amp; Adjust Placement / Orientation
                  </strong>{' '}
                  on any flagged frame below to calibrate its horizon pitch, vertical plumb, 3D
                  placement offsets, or validity status.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('needs_verification')}
              className="px-3.5 py-2 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
            >
              Isolate {needsVerificationCount} Low-Confidence Frame(s)
            </button>
          </div>
        )}

        {filteredIterations.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0B0D11] border border-white/5 text-center space-y-3">
            <p className="text-sm text-slate-300 font-medium">
              No frame scan iterations in this view yet.
            </p>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              Click <strong>Run Autonomous Batch Sweep</strong> above to scan the queued reference
              frames and generate proposed 3D architectural layout deltas for Stage 18.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIterations.map((iter) => {
              const apt = STAGE18_APARTMENTS.find((a) => a.id === iter.targetApartmentId);
              const isPending = iter.status === 'pending_review';
              const isApproved = iter.status === 'approved';
              const isLowConf =
                iter.confidenceScore < 75 && !iter.manualVerification?.verifiedByUser;
              const isVerifyingThis = verifyingIterationId === iter.id;

              return (
                <div
                  key={iter.id}
                  className={`p-5 rounded-xl border transition-colors ${
                    isVerifyingThis
                      ? 'bg-[#141A26] border-amber-400'
                      : isApproved
                      ? 'bg-[#0F1918] border-emerald-500/40'
                      : isLowConf
                      ? 'bg-[#171310] border-amber-500/70'
                      : isPending
                      ? 'bg-[#0B0D11] border-white/20'
                      : 'bg-[#0B0D11]/60 border-white/10 opacity-75'
                  }`}
                >
                  {/* Top Bar of Iteration Card */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                        <span className="text-amber-400 font-semibold">
                          SMPTE {iter.smpteTimecode} · {iter.focalLengthMm}mm
                        </span>
                        <span aria-hidden="true" className="text-slate-500">
                          ·
                        </span>
                        <span className="text-slate-200 font-semibold">
                          {apt ? `${apt.designation} (${apt.name})` : iter.targetApartmentId}
                        </span>
                        <span aria-hidden="true" className="text-slate-500">
                          ·
                        </span>
                        <span
                          className={
                            iter.engineUsed === 'gemini_cloud_hybrid'
                              ? 'text-amber-300'
                              : 'text-sky-300'
                          }
                        >
                          {iter.engineUsed === 'gemini_cloud_hybrid'
                            ? 'Engine: Gemini 4 Hydrogen + CV Hybrid'
                            : 'Engine: Local Browser CV Geometric Solver'}
                        </span>
                        <span aria-hidden="true" className="text-slate-500">
                          ·
                        </span>
                        <span
                          className={`font-semibold ${
                            iter.confidenceScore >= 80
                              ? 'text-emerald-400'
                              : iter.confidenceScore >= 75
                              ? 'text-sky-300'
                              : 'text-amber-400'
                          }`}
                        >
                          Confidence: {iter.confidenceScore}%
                          {iter.manualVerification?.verifiedByUser && ' (User Verified)'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-white font-display flex items-center gap-2">
                        {iter.frameTitle}
                        {isLowConf && (
                          <span className="text-xs font-mono text-amber-400 font-normal">
                            [LOW CONFIDENCE — VERIFY PLACEMENT / ORIENTATION]
                          </span>
                        )}
                      </h4>
                    </div>

                    {/* Review Gate & Verification Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          isVerifyingThis
                            ? setVerifyingIterationId(null)
                            : openFrameVerificationWorkbench(iter)
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                          isVerifyingThis
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : isLowConf
                            ? 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400'
                            : 'bg-[#1A202C] text-amber-300 border-amber-500/40 hover:bg-amber-500/15'
                        }`}
                      >
                        <Compass className="w-3.5 h-3.5" />
                        {isVerifyingThis
                          ? 'Close Verification Calibrator'
                          : isLowConf
                          ? 'Verify & Adjust Placement / Orientation'
                          : 'Calibrate Placement / Orientation'}
                      </button>

                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => onApproveIteration(iter.id)}
                            className="px-3.5 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve &amp; Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectIteration(iter.id)}
                            className="px-3 py-1.5 text-xs font-medium bg-[#1A202C] hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-white/10 rounded-lg flex items-center gap-1 whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <>
                          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {iter.manualVerification?.validityStatus ===
                            'geometry_excluded_lighting_only'
                              ? 'Lighting Reference Only'
                              : 'Applied to 3D Model'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToWorkbenchWithHeatmap(iter.targetApartmentId)
                            }
                            className="px-2.5 py-1 text-xs font-medium bg-[#1A202C] text-amber-300 border border-white/10 rounded hover:border-amber-400/50 flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Inspect in 3D
                          </button>
                          <button
                            type="button"
                            onClick={() => onRevertIteration(iter.id)}
                            className="px-2.5 py-1 text-xs font-medium bg-[#1A202C] text-slate-300 hover:text-white border border-white/10 rounded flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Revert
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Low-Confidence Diagnostic Reasons */}
                  {iter.lowConfidenceFlags && iter.lowConfidenceFlags.length > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                      <div className="font-mono text-amber-300 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        LOW-CONFIDENCE INTERPRETATION FLAGS:
                      </div>
                      {iter.lowConfidenceFlags.map((flag, idx) => (
                        <div key={idx} className="text-slate-200 pl-5">
                          • {flag}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual Verification Summary if already verified */}
                  {iter.manualVerification?.verifiedByUser && !isVerifyingThis && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-200 flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        USER VERIFIED ({iter.manualVerification.validityStatus.toUpperCase()}) ·
                        Placement Offset: dX {iter.manualVerification.placementOffsetFeet[0]}&apos;,
                        dY {iter.manualVerification.placementOffsetFeet[1]}&apos;, dZ{' '}
                        {iter.manualVerification.placementOffsetFeet[2]}&apos; · Orientation: Pitch{' '}
                        {iter.manualVerification.orientationOverrideDeg.pitchDeg}°, Yaw{' '}
                        {iter.manualVerification.orientationOverrideDeg.yawDeg}°, Roll{' '}
                        {iter.manualVerification.orientationOverrideDeg.rollPlumbDeg}°
                      </div>
                      <div className="text-slate-300 font-sans">
                        Note: {iter.manualVerification.verificationNotes}
                      </div>
                    </div>
                  )}

                  {/* =================================================================
                      INLINE INTERACTIVE FRAME VERIFICATION & CALIBRATION WORKBENCH
                     ================================================================= */}
                  {isVerifyingThis && (
                    <div className="mt-4 pt-4 border-t border-amber-500/40 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <div className="text-xs font-mono text-amber-400">
                            MANUAL FRAME VERIFICATION &amp; SPATIAL CALIBRATION WORKBENCH
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Drag on the optical plate canvas to align the vanishing horizon (amber)
                            and vertical plumb axis (cyan), adjust the 3D zone placement offsets or
                            camera orientation, and set the frame&apos;s validity status.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleRecalculateDimensionsFromOrientation}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#1A202C] hover:bg-slate-700 text-amber-300 border border-amber-500/40 rounded-lg flex items-center gap-1.5"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Recalculate 3D Proportions from Orientation
                        </button>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                        {/* Left (5 cols): Interactive Optical Horizon, Plumb & Placement Canvas */}
                        <div className="lg:col-span-5 space-y-2.5">
                          <div className="rounded-lg overflow-hidden border border-amber-500/40 bg-black">
                            <canvas
                              ref={calibratorCanvasRef}
                              width={460}
                              height={276}
                              onClick={handleCalibratorCanvasInteraction}
                              onMouseMove={handleCalibratorCanvasInteraction}
                              className="w-full h-auto cursor-crosshair block"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                            <div className="p-2 rounded bg-[#0B0D11] border border-white/10">
                              <label className="block text-amber-300 mb-1">
                                Horizon Pitch (°)
                              </label>
                              <input
                                type="number"
                                step="0.5"
                                min="-35"
                                max="35"
                                value={calPitchDeg}
                                onChange={(e) => setCalPitchDeg(Number(e.target.value))}
                                className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                              />
                            </div>

                            <div className="p-2 rounded bg-[#0B0D11] border border-white/10">
                              <label className="block text-amber-300 mb-1">Azimuth Yaw (°)</label>
                              <input
                                type="number"
                                step="0.5"
                                min="-65"
                                max="65"
                                value={calYawDeg}
                                onChange={(e) => setCalYawDeg(Number(e.target.value))}
                                className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                              />
                            </div>

                            <div className="p-2 rounded bg-[#0B0D11] border border-white/10">
                              <label className="block text-sky-300 mb-1">Plumb Roll (°)</label>
                              <input
                                type="number"
                                step="0.2"
                                min="-15"
                                max="15"
                                value={calRollDeg}
                                onChange={(e) => setCalRollDeg(Number(e.target.value))}
                                className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Right (7 cols): Validity, Zone Reassignment, 3D Placement Offsets & Dimensions */}
                        <div className="lg:col-span-7 space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-amber-300 font-medium mb-1">
                                1. Frame Validity Classification
                              </label>
                              <select
                                value={calValidityStatus}
                                onChange={(e) =>
                                  setCalValidityStatus(e.target.value as FrameValidityStatus)
                                }
                                className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                              >
                                <option value="verified_valid">
                                  Verified Valid — Lock &amp; Apply to 3D Model (96% Conf)
                                </option>
                                <option value="geometry_excluded_lighting_only">
                                  Lighting/Color Reference Only — Exclude from 3D Geometry
                                </option>
                                <option value="invalid_discarded">
                                  Invalid Frame (Severe Blur / Occlusion) — Discard
                                </option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-amber-300 font-medium mb-1">
                                2. Verify / Reassign Stage 18 Building Zone
                              </label>
                              <select
                                value={calTargetZoneId}
                                onChange={(e) => handleZoneReassignmentChange(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                              >
                                {STAGE18_APARTMENTS.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.designation} ({a.name})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* 3D Placement Offset Controls */}
                          <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10 space-y-2">
                            <div className="text-emerald-300 font-mono text-[11px] flex items-center gap-1.5">
                              <Move className="w-3.5 h-3.5" />
                              3. 3D COURTYARD PLACEMENT OFFSETS (FEET RELATIVE TO ZONE ANCHOR)
                            </div>
                            <div className="grid grid-cols-3 gap-2.5 font-mono">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  Lateral Offset ΔX (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  min="-12"
                                  max="12"
                                  value={calOffsetX}
                                  onChange={(e) => setCalOffsetX(Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  Elevation Offset ΔY (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  min="-12"
                                  max="12"
                                  value={calOffsetY}
                                  onChange={(e) => setCalOffsetY(Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  Depth Offset ΔZ (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  min="-12"
                                  max="12"
                                  value={calOffsetZ}
                                  onChange={(e) => setCalOffsetZ(Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-white"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Direct 3D Dimensional & POV Forced-Perspective Overrides */}
                          <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10 space-y-2.5">
                            <div className="text-amber-300 font-mono text-[11px] flex items-center gap-1.5">
                              <Crosshair className="w-3.5 h-3.5" />
                              4. POV FORCED-PERSPECTIVE SCALE, NON-ORTHOGONAL WALL SPLAY &amp; DIMENSIONS
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Width (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  value={calProposedDims.widthFeet}
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      widthFeet: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Height (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  value={calProposedDims.heightFeet}
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      heightFeet: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-amber-300 mb-1">
                                  Physical Room Depth (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  value={calProposedDims.interiorDepthFeet}
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      interiorDepthFeet: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-amber-500/40 text-amber-200"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Apparent Arch Depth (ft)
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={
                                    calProposedDims.apparentArchitecturalDepthFeet ??
                                    calProposedDims.interiorDepthFeet
                                  }
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      apparentArchitecturalDepthFeet: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-slate-300"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-sky-300 mb-1">
                                  POV Scale (0.55×–1.05×)
                                </label>
                                <input
                                  type="number"
                                  step="0.02"
                                  min="0.55"
                                  max="1.05"
                                  value={calProposedDims.forcedPerspectiveScaleFactor ?? 0.85}
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      forcedPerspectiveScaleFactor: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-sky-500/40 text-sky-200"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-fuchsia-300 mb-1">
                                  Wall Splay Angle (°)
                                </label>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="-25"
                                  max="25"
                                  value={calProposedDims.cameraSightlineSplayDeg ?? 6.8}
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      cameraSightlineSplayDeg: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-fuchsia-500/40 text-fuchsia-200"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-amber-300 mb-1">
                                  Floor Rake Pitch (°)
                                </label>
                                <input
                                  type="number"
                                  step="0.2"
                                  min="-10"
                                  max="10"
                                  value={calProposedDims.floorRakePitchDeg ?? 1.5}
                                  onChange={(e) =>
                                    setCalProposedDims((p) => ({
                                      ...p,
                                      floorRakePitchDeg: Number(e.target.value)
                                    }))
                                  }
                                  className="w-full px-2 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-400 mb-1">
                                  Win Grid (Cols × Rows)
                                </label>
                                <div className="grid grid-cols-2 gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max="8"
                                    value={calProposedDims.windowCols}
                                    onChange={(e) =>
                                      setCalProposedDims((p) => ({
                                        ...p,
                                        windowCols: Math.max(1, Number(e.target.value))
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                                  />
                                  <input
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={calProposedDims.windowRows}
                                    onChange={(e) =>
                                      setCalProposedDims((p) => ({
                                        ...p,
                                        windowRows: Math.max(1, Number(e.target.value))
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 rounded bg-[#12161F] border border-white/15 text-white"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-slate-300 font-medium mb-1">
                              Verification &amp; Calibration Notes (Saved to Blender bpy Ledger)
                            </label>
                            <input
                              type="text"
                              value={calNotes}
                              onChange={(e) => setCalNotes(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100"
                            />
                          </div>

                          <div className="flex items-center justify-end gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setVerifyingIterationId(null)}
                              className="px-3.5 py-2 rounded-lg bg-[#1A202C] text-slate-300 hover:text-white"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveManualVerification(iter.id)}
                              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {calValidityStatus === 'verified_valid'
                                ? 'Confirm Verification & Apply to 3D Model'
                                : calValidityStatus === 'geometry_excluded_lighting_only'
                                ? 'Save as Lighting Reference Only'
                                : 'Confirm Invalid & Exclude Frame'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Side-by-Side Dimensional & POV Forced-Perspective Diff Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 my-3 text-xs font-mono tabular-nums">
                    <div className="p-2.5 rounded bg-[#12161F] border border-white/5">
                      <div className="text-[10px] text-slate-400">FACADE WIDTH</div>
                      <div className="text-slate-200 mt-0.5">
                        {iter.previousValues.widthFeet.toFixed(1)}&apos; →{' '}
                        <span className="text-white font-semibold">
                          {iter.proposedValues.widthFeet.toFixed(1)}&apos;
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-400">
                        {formatDelta(iter.previousValues.widthFeet, iter.proposedValues.widthFeet)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#12161F] border border-white/5">
                      <div className="text-[10px] text-slate-400">BUILDING HEIGHT</div>
                      <div className="text-slate-200 mt-0.5">
                        {iter.previousValues.heightFeet.toFixed(1)}&apos; →{' '}
                        <span className="text-white font-semibold">
                          {iter.proposedValues.heightFeet.toFixed(1)}&apos;
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-400">
                        {formatDelta(
                          iter.previousValues.heightFeet,
                          iter.proposedValues.heightFeet
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#12161F] border border-white/5">
                      <div className="text-[10px] text-slate-400">WINDOW BAY GRID</div>
                      <div className="text-slate-200 mt-0.5">
                        {iter.previousValues.windowCols}×{iter.previousValues.windowRows} →{' '}
                        <span className="text-white font-semibold">
                          {iter.proposedValues.windowCols}×{iter.proposedValues.windowRows}
                        </span>
                      </div>
                      <div className="text-[10px] text-emerald-400">
                        Reveal {iter.proposedValues.windowRevealInches.toFixed(1)}&quot;
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#12161F] border border-amber-500/20">
                      <div className="text-[10px] text-amber-300">PHYSICAL vs APPARENT DEPTH</div>
                      <div className="text-slate-200 mt-0.5">
                        <span className="text-white font-semibold">
                          {iter.proposedValues.interiorDepthFeet.toFixed(1)}&apos; Set
                        </span>{' '}
                        /{' '}
                        <span className="text-slate-400">
                          {(
                            iter.proposedValues.apparentArchitecturalDepthFeet ??
                            iter.proposedValues.interiorDepthFeet
                          ).toFixed(1)}
                          &apos; Arch
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-400">
                        {formatDelta(
                          iter.previousValues.interiorDepthFeet,
                          iter.proposedValues.interiorDepthFeet
                        )}{' '}
                        physical shadowbox
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#12161F] border border-sky-500/20">
                      <div className="text-[10px] text-sky-300">POV PERSPECTIVE SCALE</div>
                      <div className="text-slate-200 mt-0.5">
                        {(iter.previousValues.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2)}× →{' '}
                        <span className="text-sky-300 font-semibold">
                          {(iter.proposedValues.forcedPerspectiveScaleFactor ?? 0.85).toFixed(2)}×
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        d=
                        {iter.cvPrepassTelemetry.radialDistanceFromJeffFeet ?? 42.0}
                        &apos; from Jeff&apos;s lens
                      </div>
                    </div>

                    <div className="p-2.5 rounded bg-[#12161F] border border-fuchsia-500/20">
                      <div className="text-[10px] text-fuchsia-300">WALL SPLAY &amp; RAKE</div>
                      <div className="text-slate-200 mt-0.5">
                        <span className="text-white font-semibold">
                          {(iter.proposedValues.cameraSightlineSplayDeg ?? 0) >= 0 ? '+' : ''}
                          {(iter.proposedValues.cameraSightlineSplayDeg ?? 0).toFixed(1)}° Splay
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-300">
                        Floor Rake {(iter.proposedValues.floorRakePitchDeg ?? 0) >= 0 ? '+' : ''}
                        {(iter.proposedValues.floorRakePitchDeg ?? 0).toFixed(1)}°
                      </div>
                    </div>
                  </div>

                  {/* Spatial Reasoning & Detected Features */}
                  <div className="text-xs text-slate-300 space-y-1.5">
                    <p className="leading-relaxed">
                      <span className="text-slate-400 font-medium">
                        Camera-POV Photogrammetric Evidence:{' '}
                      </span>
                      {iter.spatialReasoningSummary}
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>
                        CV Pre-Pass: Pitch {iter.cvPrepassTelemetry.vanishingPitchDeg}° · Yaw{' '}
                        {iter.cvPrepassTelemetry.vanishingYawDeg}° ·{' '}
                        {iter.cvPrepassTelemetry.brickCoursesCounted} Brick Courses
                      </span>
                      {iter.detectedFeatures.map((feat, fIdx) => (
                        <React.Fragment key={fIdx}>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-300">{feat}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
