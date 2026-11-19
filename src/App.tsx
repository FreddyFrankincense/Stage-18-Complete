import React, { useEffect, useState } from 'react';
import {
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  CAMERA_OPTICAL_PRESETS,
  CameraOpticalPreset,
  CuratedReferenceFrame,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  INITIAL_CURATED_FRAMES,
  INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS,
  INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE,
  JeffriesPbrMaterialSpec,
  LIGHTING_SCENARIOS,
  LightingScenarioPreset,
  ManualFrameVerification,
  ParametricDimensionsSnapshot,
  STAGE18_APARTMENTS,
  Stage18ApartmentUnit,
  Stage18LearnedKnowledgeProfile
} from './data/stage18Data';
import Stage18Viewport3D from './components/Stage18Viewport3D';
import HeroFrameCurator from './components/HeroFrameCurator';
import ActionPlanAndBarriers from './components/ActionPlanAndBarriers';
import ScriptGeneratorWorkspace, { ScriptTabId } from './components/ScriptGeneratorWorkspace';
import SourceVideoTestLab from './components/SourceVideoTestLab';

type WorkspaceTab = 'workbench' | 'sourcelab' | 'frames' | 'plan' | 'scripts' | 'barriers';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workbench');
  const [selectedApartment, setSelectedApartment] = useState<Stage18ApartmentUnit>(
    STAGE18_APARTMENTS[1] // Lars Thorwald's Apartment by default viewed from Jeff's window
  );
  const [activeCameraPreset, setActiveCameraPreset] = useState<CameraOpticalPreset>(
    CAMERA_OPTICAL_PRESETS[0] // 35mm Mitchell BNC Wide
  );
  const [activeLighting, setActiveLighting] = useState<LightingScenarioPreset>(
    LIGHTING_SCENARIOS[0] // Signature Golden Hour
  );
  const [liveProjectedTextureUrl, setLiveProjectedTextureUrl] = useState<string | null>(null);
  const [showConfidenceHeatmap, setShowConfidenceHeatmap] = useState<boolean>(false);

  const [curatedFrames, setCuratedFrames] = useState<CuratedReferenceFrame[]>(() => {
    try {
      const saved = localStorage.getItem('stage18_curated_frames_v2');
      return saved ? JSON.parse(saved) : INITIAL_CURATED_FRAMES;
    } catch {
      return INITIAL_CURATED_FRAMES;
    }
  });
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('stage18_completed_tasks_v1');
      return saved ? JSON.parse(saved) : ['t1-1', 't2-1'];
    } catch {
      return ['t1-1', 't2-1'];
    }
  });
  const [parametricOverrides, setParametricOverrides] = useState<
    Record<string, BuildingParametricOverride>
  >(() => {
    try {
      const saved = localStorage.getItem('stage18_parametric_overrides_v2');
      if (!saved) return INITIAL_BUILDING_PARAMETRIC_OVERRIDES;
      const parsed = JSON.parse(saved);
      const merged: Record<string, BuildingParametricOverride> = {
        ...INITIAL_BUILDING_PARAMETRIC_OVERRIDES
      };
      for (const key of Object.keys(merged)) {
        if (parsed[key]) {
          merged[key] = { ...merged[key], ...parsed[key] };
        }
      }
      return merged;
    } catch {
      return INITIAL_BUILDING_PARAMETRIC_OVERRIDES;
    }
  });
  const [layoutIterations, setLayoutIterations] = useState<ArchitecturalLayoutIteration[]>(() => {
    try {
      const saved = localStorage.getItem('stage18_layout_iterations_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [learnedKnowledgeProfile, setLearnedKnowledgeProfile] =
    useState<Stage18LearnedKnowledgeProfile>(() => {
      try {
        const saved = localStorage.getItem('stage18_learned_knowledge_v1');
        if (!saved) return INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE;
        const parsed = JSON.parse(saved) as Stage18LearnedKnowledgeProfile;
        if (!parsed.zonePriors || !parsed.globalOpticalLaws) {
          return INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE;
        }
        return parsed;
      } catch {
        return INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE;
      }
    });

  const [jeffriesPbrMaterials, setJeffriesPbrMaterials] = useState<JeffriesPbrMaterialSpec[]>(
    () => {
      try {
        const saved = localStorage.getItem('stage18_jeffries_pbr_materials_v1');
        if (!saved) return INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS;
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length === 8
          ? parsed
          : INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS;
      } catch {
        return INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS;
      }
    }
  );

  const [targetScriptTab, setTargetScriptTab] = useState<ScriptTabId>('ffmpeg');
  const [toastNotification, setToastNotification] = useState<{
    id: number;
    message: string;
    detail?: string;
    actionLabel?: string;
    targetTab?: WorkspaceTab;
    targetScript?: ScriptTabId;
  } | null>(null);

  const triggerToast = (
    message: string,
    detail?: string,
    actionLabel?: string,
    targetTab?: WorkspaceTab,
    targetScript?: ScriptTabId
  ) => {
    setToastNotification({
      id: Date.now(),
      message,
      detail,
      actionLabel,
      targetTab,
      targetScript
    });
  };

  useEffect(() => {
    if (!toastNotification) return;
    const timer = window.setTimeout(() => {
      setToastNotification(null);
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [toastNotification]);

  useEffect(() => {
    try {
      localStorage.setItem('stage18_curated_frames_v2', JSON.stringify(curatedFrames));
    } catch {
      try {
        const slimmed = curatedFrames.map((f) =>
          f.customImageDataUrl && f.customImageDataUrl.length > 260000
            ? { ...f, customImageDataUrl: undefined }
            : f
        );
        localStorage.setItem('stage18_curated_frames_v2', JSON.stringify(slimmed));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [curatedFrames]);

  useEffect(() => {
    try {
      localStorage.setItem('stage18_completed_tasks_v1', JSON.stringify(completedTaskIds));
    } catch {
      // ignore storage quota errors
    }
  }, [completedTaskIds]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'stage18_parametric_overrides_v2',
        JSON.stringify(parametricOverrides)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [parametricOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem('stage18_layout_iterations_v2', JSON.stringify(layoutIterations));
    } catch {
      // ignore storage quota errors
    }
  }, [layoutIterations]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'stage18_jeffries_pbr_materials_v1',
        JSON.stringify(jeffriesPbrMaterials)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [jeffriesPbrMaterials]);

  // Hydrate learned knowledge profile from server disk (`stage18_learned_knowledge_bank.json`) on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/learned-knowledge')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (
          data.profile &&
          data.profile.zonePriors &&
          (data.profile.totalFramesAssimilated || 0) >=
            (learnedKnowledgeProfile.totalFramesAssimilated || 0)
        ) {
          setLearnedKnowledgeProfile(data.profile);
          try {
            localStorage.setItem('stage18_learned_knowledge_v1', JSON.stringify(data.profile));
          } catch {
            // ignore storage errors
          }
        } else {
          // Ensure server disk has the initial or local profile persisted
          fetch('/api/learned-knowledge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: learnedKnowledgeProfile })
          }).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const persistLearnedProfileEverywhere = (updated: Stage18LearnedKnowledgeProfile) => {
    setLearnedKnowledgeProfile(updated);
    try {
      localStorage.setItem('stage18_learned_knowledge_v1', JSON.stringify(updated));
    } catch {
      // ignore storage quota errors
    }
    fetch('/api/learned-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: updated })
    }).catch(() => {});
  };

  const handleUpdateLearnedKnowledgeProfile = (
    updated: Stage18LearnedKnowledgeProfile,
    sourceLabel?: string
  ) => {
    persistLearnedProfileEverywhere(updated);
    if (sourceLabel) {
      triggerToast(
        sourceLabel,
        `Knowledge Bank v${updated.version} saved to server disk & localStorage (${updated.totalFramesAssimilated} frames · ${updated.totalTrainingRuns} runs)`,
        'Export Calibrated Blender Scripts →',
        'scripts',
        'architecture'
      );
    }
  };

  const handleApplyLearnedPriorsToBuild = (profile: Stage18LearnedKnowledgeProfile) => {
    setParametricOverrides((prev) => {
      const next = { ...prev };
      for (const [aptId, prior] of Object.entries(profile.zonePriors || {})) {
        const existing = next[aptId] || INITIAL_BUILDING_PARAMETRIC_OVERRIDES[aptId];
        if (!existing) continue;
        next[aptId] = {
          ...existing,
          apartmentId: aptId,
          widthFeet: prior.widthFeet,
          heightFeet: prior.heightFeet,
          depthFeet: prior.depthFeet,
          elevationOffsetFeet: prior.elevationOffsetFeet,
          windowCols: prior.windowCols,
          windowRows: prior.windowRows,
          windowRevealInches: prior.windowRevealInches,
          balconyProjectionFeet: prior.balconyProjectionFeet,
          interiorDepthFeet: prior.interiorDepthFeet,
          apparentArchitecturalDepthFeet: prior.apparentArchitecturalDepthFeet,
          forcedPerspectiveScaleFactor: prior.forcedPerspectiveScaleFactor,
          cameraSightlineSplayDeg: prior.cameraSightlineSplayDeg,
          floorRakePitchDeg: prior.floorRakePitchDeg,
          confidenceScore: Math.max(
            existing.confidenceScore || 50,
            prior.learnedConfidenceScore
          ),
          contributingFramesCount: Math.max(
            existing.contributingFramesCount || 1,
            prior.observationCount
          ),
          lastUpdatedSmpte: prior.lastUpdatedSmpte || existing.lastUpdatedSmpte
        };
      }
      return next;
    });

    // Align active lighting to closest learned Eastmancolor 1954 Kelvin equilibrium
    const targetKelvin = profile.globalOpticalLaws?.eastmancolorKelvinBias || 3340;
    const closestLighting = [...LIGHTING_SCENARIOS].sort(
      (a, b) =>
        Math.abs(a.cyclesKelvinKey - targetKelvin) - Math.abs(b.cyclesKelvinKey - targetKelvin)
    )[0];
    if (closestLighting) {
      setActiveLighting({
        ...closestLighting,
        cyclesKelvinKey: targetKelvin
      });
    }

    setShowConfidenceHeatmap(true);
    triggerToast(
      'Applied Learned 75GB Corpus Priors to 3D Stage & Scripts',
      `Updated all 7 apartment zones, forced-perspective tapers & ${targetKelvin}K Eastmancolor lighting equilibrium`,
      'Inspect 3D Stage Heatmap →',
      'workbench'
    );
  };

  const handleToggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handlePreviewFrameIn3D = (frame: CuratedReferenceFrame) => {
    const targetApt =
      STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId) || STAGE18_APARTMENTS[1];
    setSelectedApartment(targetApt);
    if (frame.customImageDataUrl) {
      setLiveProjectedTextureUrl(frame.customImageDataUrl);
    }

    const closestPreset =
      CAMERA_OPTICAL_PRESETS.find((c) => c.focalLengthMm === frame.focalLengthMm) ||
      (frame.focalLengthMm >= 135
        ? CAMERA_OPTICAL_PRESETS[3]
        : frame.focalLengthMm >= 70
        ? CAMERA_OPTICAL_PRESETS[2]
        : CAMERA_OPTICAL_PRESETS[0]);
    setActiveCameraPreset(closestPreset);
    setActiveTab('workbench');
    triggerToast(
      `Camera aligned to ${frame.title}`,
      `${targetApt.name} · ${closestPreset.shortLabel} (${frame.smpteTimecode})`,
      'Open Frame Curator →',
      'frames'
    );
  };

  const handleJumpToScriptTab = (scriptTab: ScriptTabId) => {
    setTargetScriptTab(scriptTab);
    setActiveTab('scripts');
  };

  const handlePinAnalyzedFrame = (newFrame: CuratedReferenceFrame, dataUrl?: string) => {
    const enrichedFrame: CuratedReferenceFrame = {
      ...newFrame,
      customImageDataUrl: dataUrl || newFrame.customImageDataUrl
    };
    setCuratedFrames((prev) => [enrichedFrame, ...prev]);
    triggerToast(
      `Pinned "${enrichedFrame.title}" to Frame Curator`,
      `SMPTE ${enrichedFrame.smpteTimecode} · ${enrichedFrame.focalLengthMm}mm lens plate ready for 2K/4K export`,
      'Open Frame Curator →',
      'frames'
    );
  };

  const handleApplyLiveProjectionTo3D = (dataUrl: string, targetAptId: string) => {
    const targetApt =
      STAGE18_APARTMENTS.find((a) => a.id === targetAptId) || STAGE18_APARTMENTS[1];
    setSelectedApartment(targetApt);
    setLiveProjectedTextureUrl(dataUrl);
    setActiveTab('workbench');
    triggerToast(
      `Projected live 4K plate onto ${targetApt.name}`,
      'Camera-projected UV texture applied to 3D Stage 18 courtyard mesh',
      'Return to 75GB Source Lab →',
      'sourcelab'
    );
  };

  // Review Gate Handlers for Dual-Engine Autonomous Frame-to-3D Solver
  const assimilateIterationsIntoLearnedBank = (
    iterationsToAssimilate: ArchitecturalLayoutIteration[]
  ) => {
    if (iterationsToAssimilate.length === 0) return;
    fetch('/api/learned-knowledge/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentProfile: learnedKnowledgeProfile,
        layoutIterations: iterationsToAssimilate
      })
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) {
          persistLearnedProfileEverywhere(data.profile);
        }
      })
      .catch(() => {});
  };

  const handleAddIterations = (newIterations: ArchitecturalLayoutIteration[]) => {
    setLayoutIterations((prev) => [...newIterations, ...prev]);
  };

  const handleApproveIteration = (iterationId: string) => {
    const target = layoutIterations.find((it) => it.id === iterationId);
    if (!target) return;

    setLayoutIterations((prev) =>
      prev.map((it) => (it.id === iterationId ? { ...it, status: 'approved' } : it))
    );

    setParametricOverrides((prev) => {
      const existing =
        prev[target.targetApartmentId] ||
        INITIAL_BUILDING_PARAMETRIC_OVERRIDES[target.targetApartmentId];
      return {
        ...prev,
        [target.targetApartmentId]: {
          apartmentId: target.targetApartmentId,
          ...target.proposedValues,
          confidenceScore: Math.min(
            99,
            Math.max(existing?.confidenceScore || 40, target.confidenceScore)
          ),
          contributingFramesCount: (existing?.contributingFramesCount || 0) + 1,
          lastUpdatedSmpte: target.smpteTimecode,
          lastEngineUsed: target.engineUsed
        }
      };
    });

    assimilateIterationsIntoLearnedBank([{ ...target, status: 'approved' }]);

    const aptName =
      STAGE18_APARTMENTS.find((a) => a.id === target.targetApartmentId)?.name ||
      target.targetApartmentId;
    triggerToast(
      `Applied 3D POV Geometry Delta to ${aptName}`,
      `SMPTE ${target.smpteTimecode} (${target.confidenceScore}% confidence) committed to Stage 18 3D model & Learned Knowledge Bank`,
      'View 3D Stage Heatmap →',
      'workbench'
    );
  };

  const handleApproveAllPending = (minConfidence = 75) => {
    const toApprove = layoutIterations.filter(
      (it) => it.status === 'pending_review' && it.confidenceScore >= minConfidence
    );
    if (toApprove.length === 0) return;

    const approvedIds = new Set(toApprove.map((it) => it.id));
    setLayoutIterations((prev) =>
      prev.map((it) => (approvedIds.has(it.id) ? { ...it, status: 'approved' } : it))
    );

    setParametricOverrides((prev) => {
      const next = { ...prev };
      for (const iter of toApprove) {
        const existing =
          next[iter.targetApartmentId] ||
          INITIAL_BUILDING_PARAMETRIC_OVERRIDES[iter.targetApartmentId];
        next[iter.targetApartmentId] = {
          apartmentId: iter.targetApartmentId,
          ...iter.proposedValues,
          confidenceScore: Math.min(
            99,
            Math.max(existing?.confidenceScore || 40, iter.confidenceScore)
          ),
          contributingFramesCount: (existing?.contributingFramesCount || 0) + 1,
          lastUpdatedSmpte: iter.smpteTimecode,
          lastEngineUsed: iter.engineUsed
        };
      }
      return next;
    });

    assimilateIterationsIntoLearnedBank(toApprove.map((it) => ({ ...it, status: 'approved' })));

    triggerToast(
      `Batch Approved ${toApprove.length} High-Confidence 3D Deltas`,
      `All pending iterations >= ${minConfidence}% confidence applied to Stage 18 3D geometry & Learned Knowledge Bank`,
      'Export 05_apply_verified_3d_deltas.py →',
      'scripts',
      'deltas'
    );
  };

  const handleRejectIteration = (iterationId: string) => {
    setLayoutIterations((prev) =>
      prev.map((it) => (it.id === iterationId ? { ...it, status: 'rejected' } : it))
    );
  };

  const handleRevertIteration = (iterationId: string) => {
    const target = layoutIterations.find((it) => it.id === iterationId);
    if (!target) return;

    setLayoutIterations((prev) =>
      prev.map((it) => (it.id === iterationId ? { ...it, status: 'pending_review' } : it))
    );

    setParametricOverrides((prev) => {
      const baseline = INITIAL_BUILDING_PARAMETRIC_OVERRIDES[target.targetApartmentId];
      const existing = prev[target.targetApartmentId] || baseline;
      return {
        ...prev,
        [target.targetApartmentId]: {
          apartmentId: target.targetApartmentId,
          ...target.previousValues,
          confidenceScore: Math.max(28, (existing?.confidenceScore || 60) - 18),
          contributingFramesCount: Math.max(0, (existing?.contributingFramesCount || 1) - 1),
          lastUpdatedSmpte: baseline.lastUpdatedSmpte,
          lastEngineUsed: existing?.lastEngineUsed || 'baseline_prior'
        }
      };
    });
  };

  const handleVerifyAndCalibrateIteration = (
    iterationId: string,
    updatedTargetApartmentId: string,
    updatedProposedValues: ParametricDimensionsSnapshot,
    verification: ManualFrameVerification
  ) => {
    const target = layoutIterations.find((it) => it.id === iterationId);
    if (!target) return;

    if (verification.validityStatus === 'invalid_discarded') {
      setLayoutIterations((prev) =>
        prev.map((it) =>
          it.id === iterationId
            ? {
                ...it,
                targetApartmentId: updatedTargetApartmentId,
                status: 'rejected',
                manualVerification: verification
              }
            : it
        )
      );
      return;
    }

    if (verification.validityStatus === 'geometry_excluded_lighting_only') {
      setLayoutIterations((prev) =>
        prev.map((it) =>
          it.id === iterationId
            ? {
                ...it,
                targetApartmentId: updatedTargetApartmentId,
                status: 'approved',
                confidenceScore: Math.max(it.confidenceScore, 90),
                manualVerification: verification
              }
            : it
        )
      );
      return;
    }

    // 'verified_valid' — apply user-verified placement, orientation, zone, and dimensions to 3D model
    const calibratedIter: ArchitecturalLayoutIteration = {
      ...target,
      targetApartmentId: updatedTargetApartmentId,
      proposedValues: updatedProposedValues,
      confidenceScore: 96,
      status: 'approved',
      manualVerification: verification
    };

    setLayoutIterations((prev) =>
      prev.map((it) => (it.id === iterationId ? calibratedIter : it))
    );

    setParametricOverrides((prev) => {
      const existing =
        prev[updatedTargetApartmentId] ||
        INITIAL_BUILDING_PARAMETRIC_OVERRIDES[updatedTargetApartmentId];
      return {
        ...prev,
        [updatedTargetApartmentId]: {
          apartmentId: updatedTargetApartmentId,
          ...updatedProposedValues,
          confidenceScore: 96,
          contributingFramesCount: (existing?.contributingFramesCount || 0) + 1,
          lastUpdatedSmpte: target.smpteTimecode,
          lastEngineUsed: target.engineUsed,
          placementOffsetFeet: verification.placementOffsetFeet,
          orientationOverrideDeg: verification.orientationOverrideDeg,
          validityStatus: verification.validityStatus
        }
      };
    });

    assimilateIterationsIntoLearnedBank([calibratedIter]);

    const aptName =
      STAGE18_APARTMENTS.find((a) => a.id === updatedTargetApartmentId)?.name ||
      updatedTargetApartmentId;
    triggerToast(
      `Calibrated Forced-Perspective Seam on ${aptName}`,
      `POV Depth Scale ${updatedProposedValues.forcedPerspectiveScaleFactor ?? 1.0}× · Splay ${updatedProposedValues.cameraSightlineSplayDeg ?? 0}° committed (96% confidence)`,
      'Export 05_apply_verified_3d_deltas.py →',
      'scripts',
      'deltas'
    );
  };

  const handleResetAllOverrides = () => {
    setParametricOverrides(INITIAL_BUILDING_PARAMETRIC_OVERRIDES);
    setLayoutIterations((prev) =>
      prev.map((it) => (it.status === 'approved' ? { ...it, status: 'pending_review' } : it))
    );
    triggerToast(
      'Reset All 3D Building Overrides to Baseline Priors',
      'All approved iterations returned to pending review state',
      'View 3D Workbench →',
      'workbench'
    );
  };

  const handleResetToFreshStage18Copy = () => {
    try {
      localStorage.removeItem('stage18_curated_frames_v2');
      localStorage.removeItem('stage18_parametric_overrides_v2');
      localStorage.removeItem('stage18_layout_iterations_v2');
      localStorage.removeItem('stage18_learned_knowledge_v1');
    } catch {
      // ignore storage errors
    }

    const freshUnverifiedOverrides: Record<string, BuildingParametricOverride> = {};
    for (const [aptId, base] of Object.entries(INITIAL_BUILDING_PARAMETRIC_OVERRIDES)) {
      freshUnverifiedOverrides[aptId] = {
        ...base,
        confidenceScore: 50,
        contributingFramesCount: 0,
        lastUpdatedSmpte: 'Awaiting Video Import',
        lastEngineUsed: 'baseline_prior'
      };
    }

    const freshZonePriors = JSON.parse(
      JSON.stringify(INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE.zonePriors)
    );
    for (const key of Object.keys(freshZonePriors)) {
      freshZonePriors[key].observationCount = 0;
      freshZonePriors[key].learnedConfidenceScore = 50;
      freshZonePriors[key].lastUpdatedSmpte = 'Awaiting Video Import';
    }

    const freshProfile: Stage18LearnedKnowledgeProfile = {
      ...INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE,
      version: 1,
      lastTrainedIso: new Date().toISOString(),
      totalTrainingRuns: 0,
      totalFramesAssimilated: 0,
      sourceStreamFingerprint: {
        fileName: 'Awaiting_Local_Video_Mount.mkv',
        fileSizeGb: 0,
        ebmlHeaderHex: '00 00 00 00',
        sampledOffsets: []
      },
      zonePriors: freshZonePriors,
      learningHistory: []
    };

    setParametricOverrides(freshUnverifiedOverrides);
    setLayoutIterations([]);
    setCuratedFrames([]);
    setLiveProjectedTextureUrl(null);
    setLearnedKnowledgeProfile(freshProfile);

    fetch('/api/learned-knowledge/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freshProfile })
    }).catch(() => {});

    triggerToast(
      'Fresh Stage 18 Copy Ready for Local Video Import Testing',
      'Cleared cached frames, iterations & knowledge bank (0 frames assimilated across all 7 zones)',
      'Start Video Test in 75GB Source Lab →',
      'sourcelab'
    );
  };

  const handleRestorePreCalibratedBaseline = () => {
    setParametricOverrides(INITIAL_BUILDING_PARAMETRIC_OVERRIDES);
    setCuratedFrames(INITIAL_CURATED_FRAMES);
    setLearnedKnowledgeProfile(INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE);
    fetch('/api/learned-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE })
    }).catch(() => {});
    triggerToast(
      'Restored Pre-Calibrated Stage 18 Reference Baseline',
      'Reloaded 8 archival reference frames and baseline 7-zone optical priors',
      'Inspect 3D Workbench →',
      'workbench'
    );
  };

  const handleNavigateToWorkbenchWithHeatmap = (targetAptId?: string) => {
    if (targetAptId) {
      const found = STAGE18_APARTMENTS.find((a) => a.id === targetAptId);
      if (found) setSelectedApartment(found);
    }
    setShowConfidenceHeatmap(true);
    setActiveTab('workbench');
  };

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="h-[65px] flex items-center justify-between gap-8 px-6 border-b border-white/10 bg-[#0B0D11] sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#workbench"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workbench');
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          Stage 18 · Rear Window 3D
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-300 overflow-x-auto">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'workbench'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            3D Workbench
          </button>
          <button
            onClick={() => setActiveTab('sourcelab')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'sourcelab'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            75GB Video Ingest Lab
          </button>
          <button
            onClick={() => setActiveTab('frames')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'frames'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            Frame Curator
          </button>
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'plan' || activeTab === 'barriers'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            Action Plan &amp; Risks
          </button>
          <button
            onClick={() => setActiveTab('scripts')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'scripts'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            Script Generator
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => {
              setActiveTab('sourcelab');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Upload / Test 75GB Video
          </button>
        </div>
      </header>

      {/* Active Workspace Body */}
      <main className="flex-1">
        {/* Unified Cross-Tab Toast Notification Banner */}
        {toastNotification && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-6 py-2.5">
            <div className="max-w-[1380px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-200">{toastNotification.message}</span>
                {toastNotification.detail && (
                  <span className="text-slate-300 font-mono hidden md:inline">
                    · {toastNotification.detail}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {toastNotification.actionLabel && toastNotification.targetTab && (
                  <button
                    type="button"
                    onClick={() => {
                      if (toastNotification.targetScript) {
                        setTargetScriptTab(toastNotification.targetScript);
                      }
                      if (toastNotification.targetTab) {
                        setActiveTab(toastNotification.targetTab);
                      }
                      setToastNotification(null);
                    }}
                    className="px-3 py-1 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-semibold"
                  >
                    {toastNotification.actionLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setToastNotification(null)}
                  className="px-2 py-1 text-slate-300 hover:text-white font-mono"
                >
                  Dismiss ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workbench' && (
          <Stage18Viewport3D
            selectedApartment={selectedApartment}
            onSelectApartment={setSelectedApartment}
            activeCameraPreset={activeCameraPreset}
            onSelectCameraPreset={setActiveCameraPreset}
            activeLighting={activeLighting}
            onSelectLighting={setActiveLighting}
            curatedFrames={curatedFrames}
            onNavigateToTab={setActiveTab}
            liveProjectedTextureUrl={liveProjectedTextureUrl}
            onClearLiveProjection={() => setLiveProjectedTextureUrl(null)}
            parametricOverrides={parametricOverrides}
            showConfidenceHeatmap={showConfidenceHeatmap}
            onToggleConfidenceHeatmap={() => setShowConfidenceHeatmap((prev) => !prev)}
            jeffriesPbrMaterials={jeffriesPbrMaterials}
            onUpdateJeffriesPbrMaterials={setJeffriesPbrMaterials}
            onOpenBlenderPbrScript={() => handleJumpToScriptTab('pbr_materials')}
            onOpenBlenderAssetLibraryScript={() => handleJumpToScriptTab('asset_library')}
            onPinConceptFrame={handlePinAnalyzedFrame}
            onApplyLiveProjection={(dataUrl) =>
              handleApplyLiveProjectionTo3D(dataUrl, selectedApartment.id)
            }
          />
        )}

        {activeTab === 'sourcelab' && (
          <SourceVideoTestLab
            onPinAnalyzedFrame={handlePinAnalyzedFrame}
            onApplyLiveProjectionTo3D={handleApplyLiveProjectionTo3D}
            parametricOverrides={parametricOverrides}
            layoutIterations={layoutIterations}
            onApproveIteration={handleApproveIteration}
            onApproveAllPending={handleApproveAllPending}
            onRejectIteration={handleRejectIteration}
            onRevertIteration={handleRevertIteration}
            onAddIterations={handleAddIterations}
            onVerifyAndCalibrateIteration={handleVerifyAndCalibrateIteration}
            onResetAllOverrides={handleResetAllOverrides}
            onResetToFreshVideoTestCopy={handleResetToFreshStage18Copy}
            onRestorePreCalibratedBaseline={handleRestorePreCalibratedBaseline}
            onNavigateToWorkbenchWithHeatmap={handleNavigateToWorkbenchWithHeatmap}
            onNavigateToDeltaScript={() => handleJumpToScriptTab('deltas')}
            learnedKnowledgeProfile={learnedKnowledgeProfile}
            onUpdateLearnedKnowledgeProfile={handleUpdateLearnedKnowledgeProfile}
            onApplyLearnedPriorsToBuild={handleApplyLearnedPriorsToBuild}
          />
        )}

        {activeTab === 'frames' && (
          <HeroFrameCurator
            curatedFrames={curatedFrames}
            onUpdateFrames={setCuratedFrames}
            onPreviewFrameIn3D={handlePreviewFrameIn3D}
            onNavigateToScripts={() => setActiveTab('scripts')}
          />
        )}

        {(activeTab === 'plan' || activeTab === 'barriers') && (
          <ActionPlanAndBarriers
            mode={activeTab === 'barriers' ? 'barriers' : 'plan'}
            completedTaskIds={completedTaskIds}
            onToggleTask={handleToggleTask}
            onJumpToScriptTab={handleJumpToScriptTab}
            onSwitchMode={(m) => setActiveTab(m)}
          />
        )}

        {activeTab === 'scripts' && (
          <ScriptGeneratorWorkspace
            curatedFrames={curatedFrames}
            activeLighting={activeLighting}
            onSelectLighting={setActiveLighting}
            initialScriptTab={targetScriptTab}
            parametricOverrides={parametricOverrides}
            layoutIterations={layoutIterations}
            learnedKnowledgeProfile={learnedKnowledgeProfile}
            jeffriesPbrMaterials={jeffriesPbrMaterials}
            onUpdateJeffriesPbrMaterials={setJeffriesPbrMaterials}
          />
        )}
      </main>
    </div>
  );
}
