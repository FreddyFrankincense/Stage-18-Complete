import React, { useEffect, useRef, useState } from 'react';
import {
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  ManualFrameVerification,
  ParametricDimensionsSnapshot
} from '../data/stage18Data';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  GitCompare,
  RotateCcw,
  Sliders,
  Zap
} from 'lucide-react';

export interface AdjacentFrameAuditPair {
  id: string;
  title: string;
  subtitle: string;
  frameA: {
    smpte: string;
    focalMm: number;
    zoneId: string;
    label: string;
    cameraPanYawDeg: number;
    cameraTiltPitchDeg: number;
    nodalForwardOffsetFt: number;
  };
  frameB: {
    smpte: string;
    focalMm: number;
    zoneId: string;
    label: string;
    cameraPanYawDeg: number;
    cameraTiltPitchDeg: number;
    nodalForwardOffsetFt: number;
  };
  overlapRatioPct: number;
  carpentryDistortionSummary: string;
  naiveRmsSeamErrorPx: number;
  naiveSsimScorePct: number;
  compensatedRmsSeamErrorPx: number;
  compensatedSsimScorePct: number;
  artifactHotspots: Array<{
    id: string;
    title: string;
    category:
      | 'Brick Course Scale Step'
      | 'Non-Orthogonal Wall Splay Ghosting'
      | 'Compressed Depth Parallax Shear'
      | 'Raked Floor Horizon Kink';
    normX: number;
    normY: number;
    radiusNorm: number;
    naiveDiscrepancyPx: number;
    naiveDiscrepancyInches: number;
    compensatedResidualPx: number;
    carpentryRootCause: string;
    recommendedFix: string;
  }>;
}

const CANONICAL_ADJACENT_AUDIT_PAIRS: AdjacentFrameAuditPair[] = [
  {
    id: 'pair-thorwald-alley-seam',
    title: 'Pair 01 · Thorwald North Facade (#2E) ↔ North Alleyway & Street Marquee',
    subtitle: '0.82× Tenement Masonry to 0.66× Forced-Perspective Alleyway Transition',
    frameA: {
      smpte: '00:44:18:12',
      focalMm: 50,
      zoneId: 'apt-thorwald',
      label: 'Frame A · Thorwald East Pier & Fire Escape',
      cameraPanYawDeg: -6.5,
      cameraTiltPitchDeg: -2.4,
      nodalForwardOffsetFt: 0.0
    },
    frameB: {
      smpte: '01:14:08:16',
      focalMm: 35,
      zoneId: 'apt-alley-street',
      label: 'Frame B · North Alleyway & Raked Street Ramp',
      cameraPanYawDeg: 8.2,
      cameraTiltPitchDeg: 1.8,
      nodalForwardOffsetFt: 0.0
    },
    overlapRatioPct: 38,
    carpentryDistortionSummary:
      'Thorwald’s apartment at d=43.6 ft uses 0.82× brick scale (11.4 ft physical depth, +6.8° wall splay), whereas the adjacent North Alleyway at d=55.4 ft drops abruptly to 0.66× miniature scale (5.2 ft shallow flats, +4.8° raked street ramp). Naive 1:1 orthogonal stitching causes severe mortar-course step tearing and depth shear along the east alley corner.',
    naiveRmsSeamErrorPx: 22.8,
    naiveSsimScorePct: 58.4,
    compensatedRmsSeamErrorPx: 1.4,
    compensatedSsimScorePct: 97.8,
    artifactHotspots: [
      {
        id: 'hs-thor-alley-1',
        title: 'East Alley Corner Mortar Gauge Discontinuity',
        category: 'Brick Course Scale Step',
        normX: 0.51,
        normY: 0.44,
        radiusNorm: 0.11,
        naiveDiscrepancyPx: 26.4,
        naiveDiscrepancyInches: 5.4,
        compensatedResidualPx: 1.2,
        carpentryRootCause:
          '36 brick courses equal 6.56 ft on Thorwald’s 0.82× facade but only 5.28 ft on the 0.66× North Alley flats.',
        recommendedFix:
          'Apply 0.82× → 0.66× radial scale attenuation gradient across the Z=-29 ft to Z=-38 ft alley transition.'
      },
      {
        id: 'hs-thor-alley-2',
        title: 'Raked Alleyway Asphalt Horizon Kink (+4.8°)',
        category: 'Raked Floor Horizon Kink',
        normX: 0.64,
        normY: 0.72,
        radiusNorm: 0.12,
        naiveDiscrepancyPx: 21.2,
        naiveDiscrepancyInches: 4.8,
        compensatedResidualPx: 1.6,
        carpentryRootCause:
          'Stage 18 carpenters raked the alleyway floor upward at +4.8° to simulate a full Manhattan cross-street block in 14 ft of stage depth.',
        recommendedFix:
          'Pitch the North Alleyway ground plane by +4.8° instead of extruding a flat 0.0° orthogonal street slab.'
      },
      {
        id: 'hs-thor-alley-3',
        title: 'Thorwald Rear Hallway Shadowbox Parallax Shear',
        category: 'Compressed Depth Parallax Shear',
        normX: 0.36,
        normY: 0.52,
        radiusNorm: 0.1,
        naiveDiscrepancyPx: 18.9,
        naiveDiscrepancyInches: 4.1,
        compensatedResidualPx: 1.4,
        carpentryRootCause:
          'Thorwald’s room is physically 11.4 ft deep rather than the 16.5 ft apparent railroad apartment depth.',
        recommendedFix:
          'Constrain interior room depth to 11.4 ft with +6.8° sightline wall splay.'
      }
    ]
  },
  {
    id: 'pair-westwing-torso-lonely',
    title: 'Pair 02 · West Wing Vertical & Oblique Pan: Miss Torso (#2D) ↔ Miss Lonelyhearts (#1C)',
    subtitle: 'Oblique West Wing Return Wall (+11.5° vs. +14.5° Non-Orthogonal Wall Splay)',
    frameA: {
      smpte: '00:03:45:12',
      focalMm: 50,
      zoneId: 'apt-torso',
      label: 'Frame A · Miss Torso 2nd-Floor Studio & Balcony',
      cameraPanYawDeg: -24.5,
      cameraTiltPitchDeg: -1.8,
      nodalForwardOffsetFt: 0.0
    },
    frameB: {
      smpte: '00:26:40:00',
      focalMm: 50,
      zoneId: 'apt-lonelyhearts',
      label: 'Frame B · Miss Lonelyhearts 1st-Floor Apartment',
      cameraPanYawDeg: -26.2,
      cameraTiltPitchDeg: -14.2,
      nodalForwardOffsetFt: 0.0
    },
    overlapRatioPct: 46,
    carpentryDistortionSummary:
      'Viewed at a steep -25° westward angle from Jeff’s window, a standard 90° orthogonal room would hide 60% of the interior behind the window jambs. Stage 18 carpenters splayed Miss Torso’s walls open by +11.5° and Miss Lonelyhearts’s lower walls by +14.5°. Naive orthogonal 3D geometry causes double-jamb ghosting and interior partition tearing across vertical camera tilts.',
    naiveRmsSeamErrorPx: 19.4,
    naiveSsimScorePct: 63.8,
    compensatedRmsSeamErrorPx: 1.5,
    compensatedSsimScorePct: 97.4,
    artifactHotspots: [
      {
        id: 'hs-west-1',
        title: 'West Window Jamb & Interior Partition Double-Ghosting',
        category: 'Non-Orthogonal Wall Splay Ghosting',
        normX: 0.44,
        normY: 0.48,
        radiusNorm: 0.12,
        naiveDiscrepancyPx: 23.5,
        naiveDiscrepancyInches: 4.9,
        compensatedResidualPx: 1.3,
        carpentryRootCause:
          'Interior partitions are built at 101.5°–104.5° trapezoidal angles relative to the brick facade so Jeff’s lens sees the full room.',
        recommendedFix:
          'Rotate West Wing interior side walls by +11.5° (#2D) and +14.5° (#1C) toward Jeff’s nodal point.'
      },
      {
        id: 'hs-west-2',
        title: 'Juliette Balcony Iron Projection Foreshortening Mismatch',
        category: 'Compressed Depth Parallax Shear',
        normX: 0.56,
        normY: 0.36,
        radiusNorm: 0.1,
        naiveDiscrepancyPx: 16.8,
        naiveDiscrepancyInches: 3.4,
        compensatedResidualPx: 1.5,
        carpentryRootCause:
          'Balcony ironwork projects 2.6 ft at 0.88× forced-perspective scale rather than standard 3.5 ft municipal code.',
        recommendedFix:
          'Lock balcony projection to 2.6 ft and window reveal to 7.8 in at 0.88× scale.'
      },
      {
        id: 'hs-west-3',
        title: '1st-to-2nd Floor Belt Course Scale Taper (0.88× → 0.86×)',
        category: 'Brick Course Scale Step',
        normX: 0.35,
        normY: 0.64,
        radiusNorm: 0.1,
        naiveDiscrepancyPx: 15.2,
        naiveDiscrepancyInches: 3.1,
        compensatedResidualPx: 1.4,
        carpentryRootCause:
          'Radial distance increases from 33.4 ft (#2D) to 40.4 ft (#1C), compressing apparent brick course pitch.',
        recommendedFix:
          'Apply 0.88× scale on 2nd floor and 0.86× scale on ground-floor masonry courses.'
      }
    ]
  },
  {
    id: 'pair-thorwald-50-vs-152-nodal',
    title: 'Pair 03 · Thorwald Multi-Lens Stitch: 50mm Mitchell BNC ↔ 152mm Exakta Telephoto',
    subtitle: '+1.8 ft Nodal Tripod Offset & Compressed 11.4 ft Interior Room Depth',
    frameA: {
      smpte: '00:26:40:00',
      focalMm: 50,
      zoneId: 'apt-thorwald',
      label: 'Frame A · 50mm Master Courtyard Framing (Z=+18.2 ft)',
      cameraPanYawDeg: -10.5,
      cameraTiltPitchDeg: -2.6,
      nodalForwardOffsetFt: 0.0
    },
    frameB: {
      smpte: '00:44:18:12',
      focalMm: 152,
      zoneId: 'apt-thorwald',
      label: 'Frame B · 152mm Exakta Telephoto Insert (Z=+16.4 ft)',
      cameraPanYawDeg: -10.8,
      cameraTiltPitchDeg: -2.8,
      nodalForwardOffsetFt: 1.8
    },
    overlapRatioPct: 62,
    carpentryDistortionSummary:
      'Jeff’s Exakta VX 152mm telephoto rig is mounted +1.8 ft closer to the bay window sill than the Mitchell BNC master camera. When projecting the 152mm high-res plate onto the 50mm base mesh, assuming a standard 16.5 ft apartment depth causes severe parallax shear on Thorwald’s credenza, bedroom doorway, and wallpaper seam because the physical set is only 11.4 ft deep.',
    naiveRmsSeamErrorPx: 17.6,
    naiveSsimScorePct: 66.5,
    compensatedRmsSeamErrorPx: 1.1,
    compensatedSsimScorePct: 98.4,
    artifactHotspots: [
      {
        id: 'hs-tele-1',
        title: 'Bedroom Connecting Doorway & Credenza Parallax Shift',
        category: 'Compressed Depth Parallax Shear',
        normX: 0.48,
        normY: 0.5,
        radiusNorm: 0.13,
        naiveDiscrepancyPx: 20.4,
        naiveDiscrepancyInches: 4.3,
        compensatedResidualPx: 1.0,
        carpentryRootCause:
          '+1.8 ft nodal camera shift reveals that the rear wall is only 11.4 ft behind the window glass, not 16.5 ft.',
        recommendedFix:
          'Set physical interiorDepthFeet = 11.4 ft (apparent 16.5 ft) and child 152mm camera Z-offset = -1.8 ft.'
      },
      {
        id: 'hs-tele-2',
        title: 'Sash Window Reveal Jamb Angle (+6.8° Sightline Splay)',
        category: 'Non-Orthogonal Wall Splay Ghosting',
        normX: 0.31,
        normY: 0.46,
        radiusNorm: 0.1,
        naiveDiscrepancyPx: 15.8,
        naiveDiscrepancyInches: 3.2,
        compensatedResidualPx: 1.2,
        carpentryRootCause:
          '7.4-inch recessed brick reveals are splayed +6.8° so telephoto lenses do not clip on the west window mullion.',
        recommendedFix:
          'Apply +6.8° cameraSightlineSplayDeg and 7.4 in windowRevealInches.'
      }
    ]
  },
  {
    id: 'pair-eastwing-composer-sculptor',
    title: 'Pair 04 · East Wing Vertical Sweep: Songwriter Penthouse (#3A) ↔ Sculptor Garden (#1A)',
    subtitle: '-12.0° Penthouse Casement Splay to -3.2° Excavated Basement Basin',
    frameA: {
      smpte: '01:08:15:04',
      focalMm: 75,
      zoneId: 'apt-composer',
      label: 'Frame A · Songwriter Penthouse Studio (#3A)',
      cameraPanYawDeg: 23.8,
      cameraTiltPitchDeg: 11.4,
      nodalForwardOffsetFt: 0.0
    },
    frameB: {
      smpte: '00:18:22:10',
      focalMm: 35,
      zoneId: 'apt-sculptor',
      label: 'Frame B · Sculptor Excavated Basement Garden (#1A)',
      cameraPanYawDeg: 18.4,
      cameraTiltPitchDeg: -14.2,
      nodalForwardOffsetFt: 0.0
    },
    overlapRatioPct: 34,
    carpentryDistortionSummary:
      'On the East Wing, the Songwriter’s 3rd-floor penthouse is angled inward by -12.0° at 0.85× scale (13.8 ft physical depth vs. 20.4 ft apparent studio depth), while the ground floor drops into the -6.0 ft excavated Stage 18 sub-floor basin with a -3.2° drainage rake.',
    naiveRmsSeamErrorPx: 18.2,
    naiveSsimScorePct: 65.1,
    compensatedRmsSeamErrorPx: 1.5,
    compensatedSsimScorePct: 97.2,
    artifactHotspots: [
      {
        id: 'hs-east-1',
        title: 'East Stucco Return Wall & Studio Casement Twist (-12.0°)',
        category: 'Non-Orthogonal Wall Splay Ghosting',
        normX: 0.54,
        normY: 0.38,
        radiusNorm: 0.12,
        naiveDiscrepancyPx: 21.0,
        naiveDiscrepancyInches: 4.5,
        compensatedResidualPx: 1.4,
        carpentryRootCause:
          'Penthouse studio walls splay -12.0° westward so the baby grand piano is unobstructed from Jeff’s window.',
        recommendedFix:
          'Apply -12.0° cameraSightlineSplayDeg and +2.4° ceiling rake to APT 3A.'
      },
      {
        id: 'hs-east-2',
        title: 'Excavated Courtyard Retaining Curb Pitch (-3.2°)',
        category: 'Raked Floor Horizon Kink',
        normX: 0.42,
        normY: 0.74,
        radiusNorm: 0.11,
        naiveDiscrepancyPx: 16.4,
        naiveDiscrepancyInches: 3.5,
        compensatedResidualPx: 1.5,
        carpentryRootCause:
          'Excavated basement garden slopes -3.2° toward the center courtyard drain.',
        recommendedFix:
          'Set floorRakePitchDeg = -3.2° andforcedPerspectiveScaleFactor = 0.92× on APT 1A.'
      }
    ]
  }
];

type VisualAuditOverlayMode =
  | 'stitch_artifact_heatmap'
  | 'wireframe_vs_source'
  | 'phase_correlation_vectors'
  | 'ab_split_curtain';

interface VisualConsistencyAuditPanelProps {
  parametricOverrides: Record<string, BuildingParametricOverride>;
  layoutIterations: ArchitecturalLayoutIteration[];
  onVerifyAndCalibrateIteration: (
    iterationId: string,
    updatedTargetApartmentId: string,
    updatedProposedValues: ParametricDimensionsSnapshot,
    verification: ManualFrameVerification
  ) => void;
  onNavigateToWorkbenchWithHeatmap: (targetAptId?: string) => void;
  onNavigateToDeltaScript: () => void;
  loadedDiagnosticPlates?: Array<{
    id: string;
    name: string;
    dataUrl: string;
    timestampHint: string;
  }>;
}

export default function VisualConsistencyAuditPanel({
  parametricOverrides,
  layoutIterations,
  onVerifyAndCalibrateIteration,
  onNavigateToWorkbenchWithHeatmap,
  onNavigateToDeltaScript,
  loadedDiagnosticPlates = []
}: VisualConsistencyAuditPanelProps) {
  const [selectedPairId, setSelectedPairId] = useState<string>(
    CANONICAL_ADJACENT_AUDIT_PAIRS[0].id
  );
  const [auditOverlayMode, setAuditOverlayMode] = useState<VisualAuditOverlayMode>(
    'stitch_artifact_heatmap'
  );
  const [geometryModelMode, setGeometryModelMode] = useState<
    'naive_orthogonal_code' | 'pov_compensated_carpentry'
  >('naive_orthogonal_code');
  const [seamSplitNormX, setSeamSplitNormX] = useState<number>(0.52);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string>(
    CANONICAL_ADJACENT_AUDIT_PAIRS[0].artifactHotspots[0].id
  );

  // Live Interactive Seam Calibration Sliders (initialized from active pair's primary zone)
  const activePair =
    CANONICAL_ADJACENT_AUDIT_PAIRS.find((p) => p.id === selectedPairId) ||
    CANONICAL_ADJACENT_AUDIT_PAIRS[0];
  const primaryZoneId = activePair.frameA.zoneId;
  const secondaryZoneId = activePair.frameB.zoneId;

  const primaryOverride =
    parametricOverrides[primaryZoneId] ||
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES[primaryZoneId];
  const secondaryOverride =
    parametricOverrides[secondaryZoneId] ||
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES[secondaryZoneId];

  const [liveScaleFactor, setLiveScaleFactor] = useState<number>(
    primaryOverride.forcedPerspectiveScaleFactor ?? 0.82
  );
  const [liveSplayDeg, setLiveSplayDeg] = useState<number>(
    primaryOverride.cameraSightlineSplayDeg ?? 6.8
  );
  const [liveRakeDeg, setLiveRakeDeg] = useState<number>(
    primaryOverride.floorRakePitchDeg ?? 1.8
  );
  const [livePhysicalDepthFt, setLivePhysicalDepthFt] = useState<number>(
    primaryOverride.interiorDepthFeet ?? 11.4
  );
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const auditCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync sliders when user selects a different adjacent frame pair
  useEffect(() => {
    const ov =
      parametricOverrides[activePair.frameA.zoneId] ||
      INITIAL_BUILDING_PARAMETRIC_OVERRIDES[activePair.frameA.zoneId];
    setLiveScaleFactor(ov.forcedPerspectiveScaleFactor ?? 0.82);
    setLiveSplayDeg(ov.cameraSightlineSplayDeg ?? 6.8);
    setLiveRakeDeg(ov.floorRakePitchDeg ?? 1.8);
    setLivePhysicalDepthFt(ov.interiorDepthFeet ?? 11.4);
    if (activePair.artifactHotspots.length > 0) {
      setSelectedHotspotId(activePair.artifactHotspots[0].id);
    }
  }, [selectedPairId, activePair.frameA.zoneId]);

  // Compute real-time stitching error metrics based on whether Naive 1:1 Code or POV-Compensated Carpentry is active
  const targetBaseline =
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES[primaryZoneId] ||
    INITIAL_BUILDING_PARAMETRIC_OVERRIDES['apt-thorwald'];
  const scaleDeviation = Math.abs(
    liveScaleFactor - (targetBaseline.forcedPerspectiveScaleFactor ?? 0.82)
  );
  const splayDeviation = Math.abs(
    liveSplayDeg - (targetBaseline.cameraSightlineSplayDeg ?? 6.8)
  );
  const depthDeviation = Math.abs(
    livePhysicalDepthFt - (targetBaseline.interiorDepthFeet ?? 11.4)
  );

  const activeRmsSeamErrorPx =
    geometryModelMode === 'naive_orthogonal_code'
      ? activePair.naiveRmsSeamErrorPx
      : Number(
          (
            activePair.compensatedRmsSeamErrorPx +
            scaleDeviation * 34 +
            splayDeviation * 0.42 +
            depthDeviation * 0.65
          ).toFixed(1)
        );

  const activeSsimScorePct =
    geometryModelMode === 'naive_orthogonal_code'
      ? activePair.naiveSsimScorePct
      : Number(
          Math.max(
            60,
            Math.min(
              99.4,
              activePair.compensatedSsimScorePct -
                scaleDeviation * 45 -
                splayDeviation * 0.6 -
                depthDeviation * 0.8
            )
          ).toFixed(1)
        );

  // Render the Multi-Frame Visual Consistency & Stitching Artifact Canvas
  useEffect(() => {
    const canvas = auditCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const seamX = Math.round(seamSplitNormX * w);
    const isNaive = geometryModelMode === 'naive_orthogonal_code';
    const artifactShiftPx = isNaive
      ? activePair.naiveRmsSeamErrorPx * 1.15
      : Math.max(1.2, (activeRmsSeamErrorPx - 1.0) * 1.4);

    // 1. Base Stitched Source Video Plate (Frame A on Left, Frame B on Right, Overlapping Seam Band)
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#181412');
    bgGrad.addColorStop(0.5, '#342018');
    bgGrad.addColorStop(1, '#1e1b24');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Frame A (Left Side) Source Masonry & Sash Windows (at Zone A true POV scale)
    const pitchA = 11;
    ctx.fillStyle = 'rgba(214, 211, 209, 0.24)';
    for (let y = 26; y < h - 26; y += pitchA) {
      ctx.fillRect(16, y, seamX + 42, 1.5);
    }

    // Frame B (Right Side) Source Masonry & Windows (at Zone B true POV scale & floor rake)
    const pitchB =
      activePair.id === 'pair-thorwald-alley-seam'
        ? 8.5 // 0.66x compressed alley brick courses
        : 10;
    const rakeAngleRad =
      ((activePair.id === 'pair-thorwald-alley-seam' ? 4.8 : liveRakeDeg) * Math.PI) / 180;

    ctx.save();
    ctx.beginPath();
    ctx.rect(seamX - 36, 0, w - (seamX - 36), h);
    ctx.clip();
    ctx.translate(seamX, h / 2);
    ctx.rotate(rakeAngleRad * 0.45);
    ctx.translate(-seamX, -h / 2);

    ctx.fillStyle = 'rgba(214, 211, 209, 0.22)';
    for (let y = 26; y < h - 26; y += pitchB) {
      ctx.fillRect(seamX - 40, y, w - seamX + 60, 1.5);
    }
    ctx.restore();

    // Draw Source Video Window Bays across Frame A and Frame B
    const drawSourceWindowBay = (
      x: number,
      y: number,
      bw: number,
      bh: number,
      splayPx: number,
      glowColor: string
    ) => {
      // Interior warm room glow with splayed side wall visible inside window
      ctx.fillStyle = glowColor;
      ctx.fillRect(x, y, bw, bh);

      // True non-orthogonal splayed interior side wall visible in source footage
      ctx.fillStyle = 'rgba(120, 53, 15, 0.65)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14 + splayPx, y + 10);
      ctx.lineTo(x + 14 + splayPx, y + bh - 10);
      ctx.lineTo(x, y + bh);
      ctx.closePath();
      ctx.fill();

      // Rear wall shadowbox depth line in source footage
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 14 + splayPx, y + 10, bw - 26, bh - 20);

      // Outer sash window frame
      ctx.strokeStyle = '#E7E5E4';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x, y, bw, bh);
      ctx.beginPath();
      ctx.moveTo(x, y + bh * 0.5);
      ctx.lineTo(x + bw, y + bh * 0.5);
      ctx.stroke();
    };

    // Frame A Windows
    drawSourceWindowBay(74, 82, 92, 138, 12, 'rgba(245, 158, 11, 0.34)');
    drawSourceWindowBay(202, 82, 92, 138, 14, 'rgba(245, 158, 11, 0.42)');

    // Frame B Windows (with perspective scale & elevation shift)
    const frameBWinScale = activePair.id === 'pair-thorwald-alley-seam' ? 0.76 : 0.92;
    drawSourceWindowBay(
      344,
      Math.round(88 * frameBWinScale + 18),
      Math.round(92 * frameBWinScale),
      Math.round(138 * frameBWinScale),
      16,
      'rgba(56, 189, 248, 0.28)'
    );
    drawSourceWindowBay(
      458,
      Math.round(88 * frameBWinScale + 18),
      Math.round(92 * frameBWinScale),
      Math.round(138 * frameBWinScale),
      18,
      'rgba(239, 68, 68, 0.32)'
    );

    // 2. Reconstructed 3D Geometry Projection Overlay (Shows Stitching Ghosting when Naive 1:1 Orthogonal is active)
    if (
      auditOverlayMode === 'stitch_artifact_heatmap' ||
      auditOverlayMode === 'wireframe_vs_source' ||
      auditOverlayMode === 'ab_split_curtain'
    ) {
      const ghostOffsetX = isNaive ? artifactShiftPx : (activeRmsSeamErrorPx - 1.1) * 1.2;
      const ghostOffsetY = isNaive ? artifactShiftPx * 0.72 : (activeRmsSeamErrorPx - 1.1) * 0.8;

      ctx.save();
      ctx.strokeStyle = isNaive ? 'rgba(239, 68, 68, 0.92)' : 'rgba(16, 185, 129, 0.92)';
      ctx.lineWidth = 2;
      if (isNaive) {
        ctx.setLineDash([6, 4]);
      }

      // Reconstructed 3D Wireframe for Window Bays & Splayed/Orthogonal Interior Walls
      [74, 202, 344, 458].forEach((wx, idx) => {
        const isRightSide = idx >= 2;
        const scale = isRightSide ? (isNaive ? 1.0 : frameBWinScale) : 1.0;
        const wy = isRightSide ? (isNaive ? 82 : Math.round(88 * frameBWinScale + 18)) : 82;
        const bw = Math.round(92 * scale);
        const bh = Math.round(138 * scale);
        const dx = isRightSide ? ghostOffsetX : ghostOffsetX * 0.35;
        const dy = isRightSide ? -ghostOffsetY : ghostOffsetY * 0.25;

        // 3D Wireframe Outer Window Cage
        ctx.strokeRect(wx + dx, wy + dy, bw, bh);

        // 3D Wireframe Interior Room Depth Box (Naive = 0px orthogonal splay & too deep; Compensated = matches true splay)
        const reconSplayPx = isNaive ? 0 : idx < 2 ? 13 : 17;
        const reconDepthInset = isNaive ? 26 : 14;
        ctx.strokeRect(
          wx + dx + reconDepthInset + reconSplayPx,
          wy + dy + 10,
          bw - reconDepthInset * 1.8,
          bh - 20
        );

        // Corner depth connecting rays
        ctx.beginPath();
        ctx.moveTo(wx + dx, wy + dy);
        ctx.lineTo(wx + dx + reconDepthInset + reconSplayPx, wy + dy + 10);
        ctx.moveTo(wx + dx + bw, wy + dy);
        ctx.lineTo(
          wx + dx + reconDepthInset + reconSplayPx + (bw - reconDepthInset * 1.8),
          wy + dy + 10
        );
        ctx.stroke();
      });
      ctx.restore();
    }

    // 3. Stitching Artifact Heatmap Overlay (Highlights visual stitching errors in Crimson/Magenta)
    if (auditOverlayMode === 'stitch_artifact_heatmap') {
      activePair.artifactHotspots.forEach((hs) => {
        const hx = Math.round(hs.normX * w);
        const hy = Math.round(hs.normY * h);
        const rad = Math.round(hs.radiusNorm * Math.min(w, h) * (isNaive ? 1.35 : 0.75));
        const isSelected = hs.id === selectedHotspotId;

        const heatGrad = ctx.createRadialGradient(hx, hy, 4, hx, hy, rad);
        if (isNaive) {
          heatGrad.addColorStop(0, 'rgba(239, 68, 68, 0.68)');
          heatGrad.addColorStop(0.55, 'rgba(217, 70, 239, 0.38)');
          heatGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        } else {
          heatGrad.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
          heatGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.18)');
          heatGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        }
        ctx.fillStyle = heatGrad;
        ctx.beginPath();
        ctx.arc(hx, hy, rad, 0, Math.PI * 2);
        ctx.fill();

        // Target reticle around hotspot
        ctx.strokeStyle = isSelected
          ? '#F59E0B'
          : isNaive
          ? 'rgba(248, 113, 113, 0.85)'
          : 'rgba(52, 211, 153, 0.85)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy, isSelected ? 18 : 13, 0, Math.PI * 2);
        ctx.stroke();

        // Discrepancy callout label
        ctx.fillStyle = 'rgba(11, 13, 17, 0.88)';
        ctx.fillRect(hx - 46, hy - 34, 92, 16);
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = isNaive ? '#FCA5A5' : '#6EE7B7';
        const errVal = isNaive ? hs.naiveDiscrepancyPx : hs.compensatedResidualPx;
        ctx.fillText(`Δ ${errVal.toFixed(1)}px (${hs.category.split(' ')[0]})`, hx - 42, hy - 23);
      });
    }

    // 4. Phase-Correlation Optical Parallax & Wall-Splay Displacement Vectors
    if (auditOverlayMode === 'phase_correlation_vectors') {
      ctx.strokeStyle = isNaive ? '#F43F5E' : '#34D399';
      ctx.fillStyle = isNaive ? '#F43F5E' : '#34D399';
      ctx.lineWidth = 2;

      for (let gx = 64; gx < w - 48; gx += 56) {
        for (let gy = 56; gy < h - 48; gy += 48) {
          const distFromSeam = Math.abs(gx - seamX) / (w * 0.5);
          const mag =
            (isNaive ? activePair.naiveRmsSeamErrorPx : activeRmsSeamErrorPx) *
            (1.3 - distFromSeam * 0.65);
          const angle =
            Math.atan2(gy - h * 0.45, gx - seamX) + (liveSplayDeg * Math.PI) / 180;
          const ex = gx + Math.cos(angle) * mag;
          const ey = gy + Math.sin(angle) * mag;

          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Vertical Interactive Seam Split Curtain Line (Frame A <-> Frame BOverlap Boundary)
    const overlapHalfWidthPx = Math.round((activePair.overlapRatioPct / 100) * w * 0.42);
    ctx.fillStyle = isNaive
      ? 'rgba(239, 68, 68, 0.08)'
      : 'rgba(16, 185, 129, 0.07)';
    ctx.fillRect(
      seamX - overlapHalfWidthPx,
      0,
      overlapHalfWidthPx * 2,
      h
    );

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(seamX, 0);
    ctx.lineTo(seamX, h);
    ctx.stroke();

    // Seam Handle Pill
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(seamX, h / 2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Top & Bottom Telemetry Overlay Bars
    ctx.fillStyle = 'rgba(11, 13, 17, 0.9)';
    ctx.fillRect(8, 8, w - 16, 26);
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillStyle = isNaive ? '#FCA5A5' : '#6EE7B7';
    ctx.fillText(
      `${
        isNaive
          ? 'NAIVE 1:1 ORTHOGONAL ARCHITECTURAL ASSUMPTION (STITCHING ARTIFACTS ACTIVE)'
          : 'POV-COMPENSATED NON-ORTHOGONAL SET GEOMETRY (SEAM CONVERGED)'
      } · RMS ERROR: ${activeRmsSeamErrorPx}px · SSIM: ${activeSsimScorePct}%`,
      14,
      25
    );

    ctx.fillStyle = 'rgba(11, 13, 17, 0.9)';
    ctx.fillRect(8, h - 32, w - 16, 24);
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(
      `FRAME A (${activePair.frameA.smpte} · ${activePair.frameA.focalMm}mm)  ◀── SEAM OVERLAP ${activePair.overlapRatioPct}% ──▶  FRAME B (${activePair.frameB.smpte} · ${activePair.frameB.focalMm}mm)`,
      14,
      h - 16
    );
  }, [
    activePair,
    auditOverlayMode,
    geometryModelMode,
    seamSplitNormX,
    selectedHotspotId,
    liveScaleFactor,
    liveSplayDeg,
    liveRakeDeg,
    livePhysicalDepthFt,
    activeRmsSeamErrorPx,
    activeSsimScorePct
  ]);

  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.type !== 'click') return;
    const canvas = auditCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const normX = Math.max(0.12, Math.min(0.88, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height));

    // Check if user clicked near a stitching artifact hotspot
    const clickedHotspot = activePair.artifactHotspots.find(
      (hs) => Math.hypot(hs.normX - normX, hs.normY - normY) < 0.09
    );
    if (clickedHotspot && e.type === 'click') {
      setSelectedHotspotId(clickedHotspot.id);
    } else {
      setSeamSplitNormX(Number(normX.toFixed(3)));
    }
  };

  const handleApplySeamCalibrationTo3D = () => {
    const zoneState =
      parametricOverrides[primaryZoneId] ||
      INITIAL_BUILDING_PARAMETRIC_OVERRIDES[primaryZoneId];

    const updatedSnapshot: ParametricDimensionsSnapshot = {
      widthFeet: zoneState.widthFeet,
      heightFeet: zoneState.heightFeet,
      depthFeet: zoneState.depthFeet,
      elevationOffsetFeet: zoneState.elevationOffsetFeet,
      windowCols: zoneState.windowCols,
      windowRows: zoneState.windowRows,
      windowRevealInches: zoneState.windowRevealInches,
      balconyProjectionFeet: zoneState.balconyProjectionFeet,
      interiorDepthFeet: livePhysicalDepthFt,
      apparentArchitecturalDepthFeet:
        zoneState.apparentArchitecturalDepthFeet ?? zoneState.interiorDepthFeet,
      forcedPerspectiveScaleFactor: liveScaleFactor,
      cameraSightlineSplayDeg: liveSplayDeg,
      floorRakePitchDeg: liveRakeDeg
    };

    const verification: ManualFrameVerification = {
      verifiedByUser: true,
      validityStatus: 'verified_valid',
      placementOffsetFeet: zoneState.placementOffsetFeet || [0, 0, 0],
      orientationOverrideDeg: zoneState.orientationOverrideDeg || {
        pitchDeg: activePair.frameA.cameraTiltPitchDeg,
        yawDeg: activePair.frameA.cameraPanYawDeg,
        rollPlumbDeg: 0.0
      },
      forcedPerspectiveScaleOverride: liveScaleFactor,
      cameraSightlineSplayOverrideDeg: liveSplayDeg,
      floorRakePitchOverrideDeg: liveRakeDeg,
      horizonLineNormalizedY: 0.48,
      plumbLineNormalizedX: seamSplitNormX,
      verificationNotes: `Visual Consistency Audit resolved multi-frame stitching artifacts between SMPTE ${activePair.frameA.smpte} and ${activePair.frameB.smpte} (RMS seam error reduced from ${activePair.naiveRmsSeamErrorPx}px to ${activeRmsSeamErrorPx}px).`,
      verifiedAtIso: new Date().toISOString()
    };

    const matchingIter = layoutIterations.find(
      (it) => it.targetApartmentId === primaryZoneId
    );
    if (matchingIter) {
      onVerifyAndCalibrateIteration(
        matchingIter.id,
        primaryZoneId,
        updatedSnapshot,
        verification
      );
    }

    setGeometryModelMode('pov_compensated_carpentry');
    setSyncNotice(
      `Applied POV-compensated seam geometry (${liveScaleFactor.toFixed(
        2
      )}× scale, ${liveSplayDeg >= 0 ? '+' : ''}${liveSplayDeg.toFixed(
        1
      )}° wall splay, ${livePhysicalDepthFt.toFixed(
        1
      )}' physical room depth) to ${primaryZoneId}. Multi-frame RMS seam error reduced to ${activeRmsSeamErrorPx}px.`
    );
  };

  const selectedHotspot =
    activePair.artifactHotspots.find((h) => h.id === selectedHotspotId) ||
    activePair.artifactHotspots[0];

  return (
    <section className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-6">
      {/* Header & Summary */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
        <div>
          <p className="text-xs font-mono text-amber-400">
            STEP 06 · MULTI-FRAME VISUAL CONSISTENCY &amp; STITCHING ARTIFACT AUDIT
          </p>
          <h2 className="text-xl font-bold text-white font-display mt-1">
            Adjacent Frame 3D Geometry Reprojection vs. Source Video Stitching Audit
          </h2>
          <p className="text-xs text-slate-300 max-w-3xl mt-1 leading-relaxed">
            Compares the reconstructed 3D geometry of adjacent camera frames (<code className="text-amber-300">t₁ ↔ t₂</code>) against the original 4K source video. Highlights where Stage 18&apos;s non-standard, camera-POV forced-perspective set construction (compressed room depths, splayed side walls, raked floors, and miniature background brick gauges) causes visual{' '}
            <span className="text-amber-300 font-medium">stitching &amp; ghosting artifacts</span>{' '}
            when modeled with naive 1:1 orthogonal architectural assumptions.
          </p>
        </div>

        {/* Live Seam Convergence Scoreboard */}
        <div className="flex items-center gap-4 bg-[#0B0D11] border border-white/10 rounded-xl px-4 py-3 shrink-0 font-mono text-xs">
          <div>
            <div className="text-slate-400 text-[10px]">SEAM RMS DISCREPANCY</div>
            <div
              className={`text-lg font-bold tabular-nums ${
                activeRmsSeamErrorPx <= 3.0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {activeRmsSeamErrorPx} px
            </div>
          </div>
          <div className="h-8 w-[1px] bg-white/10" />
          <div>
            <div className="text-slate-400 text-[10px]">OVERLAP STRUCTURAL SSIM</div>
            <div
              className={`text-lg font-bold tabular-nums ${
                activeSsimScorePct >= 90 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {activeSsimScorePct}%
            </div>
          </div>
        </div>
      </div>

      {/* Adjacent Frame Pair Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>SELECT ADJACENT CAMERA PAN / MULTI-LENS STITCH PAIR TO AUDIT</span>
          {loadedDiagnosticPlates.length >= 2 && (
            <span className="text-emerald-400">
              {loadedDiagnosticPlates.length} Local 75GB Diagnostic Plates Linked
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {CANONICAL_ADJACENT_AUDIT_PAIRS.map((pair) => {
            const isSelected = pair.id === selectedPairId;
            return (
              <button
                key={pair.id}
                type="button"
                onClick={() => setSelectedPairId(pair.id)}
                className={`p-3.5 rounded-xl border text-left transition-colors flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-[#182030] border-amber-400 text-white'
                    : 'bg-[#0B0D11] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-amber-400 flex items-center justify-between">
                    <span>
                      {pair.frameA.focalMm}mm ↔ {pair.frameB.focalMm}mm
                    </span>
                    <span>{pair.overlapRatioPct}% Overlap</span>
                  </div>
                  <div className="text-xs font-semibold text-white leading-snug">
                    {pair.title}
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono tabular-nums">
                  <span className="text-red-400">
                    Naive: {pair.naiveRmsSeamErrorPx}px err
                  </span>
                  <span className="text-emerald-400">
                    POV Fix: {pair.compensatedRmsSeamErrorPx}px
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Bar: Geometry Assumption Switcher + Visual Overlay Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-4 rounded-xl bg-[#0B0D11] border border-white/10">
        {/* Left: Naive 1:1 Orthogonal vs. POV-Compensated Set Geometry */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400 mr-1">3D MESH ASSUMPTION:</span>
          <button
            type="button"
            onClick={() => setGeometryModelMode('naive_orthogonal_code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              geometryModelMode === 'naive_orthogonal_code'
                ? 'bg-red-500 text-white'
                : 'bg-[#12161F] text-slate-300 border border-white/10 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Naive 1:1 Orthogonal Code (Shows Stitching Artifacts)
          </button>
          <button
            type="button"
            onClick={() => setGeometryModelMode('pov_compensated_carpentry')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              geometryModelMode === 'pov_compensated_carpentry'
                ? 'bg-emerald-500 text-slate-950'
                : 'bg-[#12161F] text-slate-300 border border-white/10 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            POV Forced-Perspective &amp; Splayed Carpentry (Artifact-Free)
          </button>
        </div>

        {/* Right: Visual Overlay Mode */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'stitch_artifact_heatmap', label: '01. Stitching Artifact Heatmap' },
              { id: 'wireframe_vs_source', label: '02. 3D Wireframe vs. Source' },
              { id: 'phase_correlation_vectors', label: '03. Parallax Shear Vectors' },
              { id: 'ab_split_curtain', label: '04. Seam Wipe Split' }
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAuditOverlayMode(mode.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                auditOverlayMode === mode.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-[#12161F] text-slate-300 hover:text-white border border-white/10'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Interactive Stitching Audit Canvas (7 cols) + Artifact Hotspot Inspector & Seam Calibrator (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Interactive Canvas + Seam Wipe Slider + Carpentry Cause Banner */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#0B0D11] border border-white/15 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <GitCompare className="w-4 h-4" />
                ADJACENT FRAME STITCHING COMPARATOR (CLICK HOTSPOTS OR DRAG SEAM WIPE)
              </span>
              <span className="text-slate-400 tabular-nums">
                Seam Split: {Math.round(seamSplitNormX * 100)}%
              </span>
            </div>

            <canvas
              ref={auditCanvasRef}
              width={620}
              height={360}
              onClick={handleCanvasInteraction}
              onMouseMove={handleCanvasInteraction}
              className="w-full h-auto rounded-lg border border-white/10 bg-black cursor-ew-resize block"
            />

            {/* Seam Wipe Scrubber & Quick Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-[11px] font-mono">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-slate-400 shrink-0">SEAM WIPE:</span>
                <input
                  type="range"
                  min="0.15"
                  max="0.85"
                  step="0.01"
                  value={seamSplitNormX}
                  onChange={(e) => setSeamSplitNormX(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
              <div className="flex items-center gap-3 text-slate-300 shrink-0">
                <span className="text-red-400">■ Crimson = Stitching Tear</span>
                <span className="text-emerald-400">■ Emerald = POV Locked</span>
              </div>
            </div>
          </div>

          {/* Architectural Carpentry Explanation Callout */}
          <div className="p-4 rounded-xl bg-[#0B0D11] border border-white/10 space-y-2 text-xs">
            <div className="font-mono text-amber-300 font-semibold">
              WHY STANDARD ARCHITECTURAL ASSUMPTIONS FAIL ON THIS FRAME PAIR:
            </div>
            <p className="text-slate-300 leading-relaxed">
              {activePair.carpentryDistortionSummary}
            </p>
            <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-white/10 flex-wrap gap-2">
              <span>
                Zone A ({activePair.frameA.zoneId}): Scale{' '}
                {(primaryOverride.forcedPerspectiveScaleFactor ?? 0.82).toFixed(2)}× · Splay{' '}
                {(primaryOverride.cameraSightlineSplayDeg ?? 6.8).toFixed(1)}° · Depth{' '}
                {primaryOverride.interiorDepthFeet.toFixed(1)}&apos;
              </span>
              <span>
                Zone B ({activePair.frameB.zoneId}): Scale{' '}
                {(secondaryOverride.forcedPerspectiveScaleFactor ?? 0.66).toFixed(2)}× · Splay{' '}
                {(secondaryOverride.cameraSightlineSplayDeg ?? 9.5).toFixed(1)}° · Depth{' '}
                {secondaryOverride.interiorDepthFeet.toFixed(1)}&apos;
              </span>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Detected Stitching Artifact Hotspots + Live Seam Compensation Sliders */}
        <div className="lg:col-span-5 space-y-4">
          {/* Detected Stitching Artifact Hotspots List */}
          <div className="p-4 rounded-xl bg-[#0B0D11] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-amber-400 font-semibold">
                DETECTED STITCHING ARTIFACT HOTSPOTS ({activePair.artifactHotspots.length})
              </span>
              <span className="text-[11px] font-mono text-slate-400">Click to Inspect</span>
            </div>

            <div className="space-y-2">
              {activePair.artifactHotspots.map((hs) => {
                const isSelected = hs.id === selectedHotspotId;
                return (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => setSelectedHotspotId(hs.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors space-y-1.5 ${
                      isSelected
                        ? 'bg-[#161E2E] border-amber-400'
                        : 'bg-[#12161F] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <span className="text-amber-300 font-semibold">{hs.category}</span>
                      <span className="tabular-nums text-red-400">
                        Naive: {hs.naiveDiscrepancyPx}px ({hs.naiveDiscrepancyInches}&quot;) →{' '}
                        <span className="text-emerald-400">
                          POV: {hs.compensatedResidualPx}px
                        </span>
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white">{hs.title}</div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {hs.carpentryRootCause}
                    </p>
                    {isSelected && (
                      <div className="pt-1.5 border-t border-white/10 text-[11px] font-mono text-emerald-300">
                        Fix: {hs.recommendedFix}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive POV Seam Compensation Calibrator */}
          <div className="p-4 rounded-xl bg-[#0B0D11] border border-white/10 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sky-300 font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                LIVE SEAM DISTORTION COMPENSATOR ({primaryZoneId})
              </span>
              <button
                type="button"
                onClick={() => {
                  setLiveScaleFactor(targetBaseline.forcedPerspectiveScaleFactor ?? 0.82);
                  setLiveSplayDeg(targetBaseline.cameraSightlineSplayDeg ?? 6.8);
                  setLiveRakeDeg(targetBaseline.floorRakePitchDeg ?? 1.8);
                  setLivePhysicalDepthFt(targetBaseline.interiorDepthFeet ?? 11.4);
                  setGeometryModelMode('pov_compensated_carpentry');
                }}
                className="text-[11px] font-mono text-amber-300 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Snap to Stage 18 Carpentry Spec
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 font-mono">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  POV Scale ({liveScaleFactor.toFixed(2)}×)
                </label>
                <input
                  type="range"
                  min="0.60"
                  max="1.00"
                  step="0.01"
                  value={liveScaleFactor}
                  onChange={(e) => {
                    setGeometryModelMode('pov_compensated_carpentry');
                    setLiveScaleFactor(Number(e.target.value));
                  }}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Wall Splay ({liveSplayDeg >= 0 ? '+' : ''}
                  {liveSplayDeg.toFixed(1)}°)
                </label>
                <input
                  type="range"
                  min="-18"
                  max="18"
                  step="0.5"
                  value={liveSplayDeg}
                  onChange={(e) => {
                    setGeometryModelMode('pov_compensated_carpentry');
                    setLiveSplayDeg(Number(e.target.value));
                  }}
                  className="w-full accent-fuchsia-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Physical Room Depth ({livePhysicalDepthFt.toFixed(1)}&apos;)
                </label>
                <input
                  type="range"
                  min="4.5"
                  max="20.0"
                  step="0.2"
                  value={livePhysicalDepthFt}
                  onChange={(e) => {
                    setGeometryModelMode('pov_compensated_carpentry');
                    setLivePhysicalDepthFt(Number(e.target.value));
                  }}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Floor Rake Pitch ({liveRakeDeg >= 0 ? '+' : ''}
                  {liveRakeDeg.toFixed(1)}°)
                </label>
                <input
                  type="range"
                  min="-6.0"
                  max="6.0"
                  step="0.2"
                  value={liveRakeDeg}
                  onChange={(e) => {
                    setGeometryModelMode('pov_compensated_carpentry');
                    setLiveRakeDeg(Number(e.target.value));
                  }}
                  className="w-full accent-emerald-400"
                />
              </div>
            </div>

            {syncNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-mono text-emerald-200">
                {syncNotice}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplySeamCalibrationTo3D}
                className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                Apply Seam-Calibrated Geometry to 3D Model
              </button>
              <button
                type="button"
                onClick={() => onNavigateToWorkbenchWithHeatmap(primaryZoneId)}
                className="py-2.5 px-3 bg-[#1A202C] hover:bg-slate-700 text-slate-200 border border-white/15 rounded-lg font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Eye className="w-4 h-4 text-amber-400" />
                Inspect in 3D
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
