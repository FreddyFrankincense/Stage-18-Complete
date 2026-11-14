import React, { useEffect, useState } from 'react';
import {
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  CAMERA_OPTICAL_PRESETS,
  CameraOpticalPreset,
  CuratedReferenceFrame,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  INITIAL_CURATED_FRAMES,
  INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE,
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

  const [targetScriptTab, setTargetScriptTab] = useState<ScriptTabId>('ffmpeg');
  const [quickDemoTriggerCount, setQuickDemoTriggerCount] = useState<number>(0);
  const [showGuidedWorkflowBar, setShowGuidedWorkflowBar] = useState<boolean>(true);
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
      // ignore storage quota errors
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
        iterations: iterationsToAssimilate
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

  const handleNavigateToWorkbenchWithHeatmap = (targetAptId?: string) => {
    if (targetAptId) {
      const found = STAGE18_APARTMENTS.find((a) => a.id === targetAptId);
      if (found) setSelectedApartment(found);
    }
    setShowConfidenceHeatmap(true);
    setActiveTab('workbench');
  };

  const handleLaunchGlobalQuickDemo = () => {
    setActiveTab('sourcelab');
    setQuickDemoTriggerCount((prev) => prev + 1);
    triggerToast(
      'Launched 1-Click 75GB Quick Demo',
      'Verified prerequisites, mounted 74.80 GB MKV header & started Dual-Engine 3D Batch Sweep',
      'Inspect 3D Workbench →',
      'workbench'
    );
  };

  const approvedDeltasCount = layoutIterations.filter((i) => i.status === 'approved').length;
  const pendingDeltasCount = layoutIterations.filter((i) => i.status === 'pending_review').length;

  // Next-step recommendation based on current tab & state
  const nextStepSuggestion = (() => {
    if (activeTab === 'workbench') {
      return {
        prompt:
          approvedDeltasCount === 0
            ? 'Next Step: Open the 75GB Source Lab to run the 1-Click Quick Demo or mount your 4K MKV.'
            : `Next Step: Curate ${curatedFrames.length} reference frames or export your calibrated Blender Python scripts.`,
        buttonLabel:
          approvedDeltasCount === 0 ? 'Go to 75GB Source Lab →' : 'Go to Script Generator →',
        action: () => setActiveTab(approvedDeltasCount === 0 ? 'sourcelab' : 'scripts')
      };
    }
    if (activeTab === 'sourcelab') {
      return {
        prompt:
          approvedDeltasCount > 0
            ? `${approvedDeltasCount} 3D POV geometry deltas applied! Next: Inspect the 3D Confidence Heatmap or export Blender scripts.`
            : pendingDeltasCount > 0
            ? `${pendingDeltasCount} solved frames awaiting review in Step 05 — approve deltas or audit seams in Step 06.`
            : 'Tip: Click "1-Click Quick Demo" to auto-mount a simulated 74.80 GB MKV and run the 6-frame 3D solver.',
        buttonLabel:
          approvedDeltasCount > 0 ? 'Inspect 3D Stage Heatmap →' : 'Open Frame Curator →',
        action: () =>
          approvedDeltasCount > 0
            ? handleNavigateToWorkbenchWithHeatmap()
            : setActiveTab('frames')
      };
    }
    if (activeTab === 'frames') {
      return {
        prompt: `${curatedFrames.filter((f) => f.includedInExport).length}/${curatedFrames.length} curated frames marked for export. Next: Generate FFmpeg extraction & Blender 4.x scripts.`,
        buttonLabel: 'Generate Pipeline Scripts →',
        action: () => setActiveTab('scripts')
      };
    }
    if (activeTab === 'plan' || activeTab === 'barriers') {
      return {
        prompt: `${completedTaskIds.length}/20 architectural tasks checked off. Next: Generate the executable Python & Bash scripts.`,
        buttonLabel: 'Open Script Generator →',
        action: () => setActiveTab('scripts')
      };
    }
    return {
      prompt: `All 5 pipeline scripts synchronized (${approvedDeltasCount} 3D POV deltas & ${curatedFrames.filter((f) => f.includedInExport).length} frames). Preview in the 3D Stage Workbench.`,
      buttonLabel: 'Return to 3D Workbench →',
      action: () => setActiveTab('workbench')
    };
  })();

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
            75GB Source Lab
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
            onClick={() => setActiveTab('sourcelab')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            AI &amp; 75GB Solver Lab
          </button>
        </div>
      </header>

      {/* Active Workspace Body */}
      <main className="flex-1">
        {/* 1-Click Guided Workflow Bar with Next-Step Prompts */}
        <div className="bg-[#12161F] border-b border-white/10 px-6 py-2.5">
          <div className="max-w-[1380px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-amber-400">GUIDED WORKFLOW:</span>
              {(
                [
                  {
                    id: 'workbench' as const,
                    step: '01',
                    label: '3D Stage',
                    meta: selectedApartment.designation.split('·')[0].trim()
                  },
                  {
                    id: 'sourcelab' as const,
                    step: '02',
                    label: '75GB Lab',
                    meta: `${approvedDeltasCount} Deltas`
                  },
                  {
                    id: 'frames' as const,
                    step: '03',
                    label: 'Curator',
                    meta: `${curatedFrames.length} Plates`
                  },
                  {
                    id: 'plan' as const,
                    step: '04',
                    label: 'Plan & Risks',
                    meta: `${completedTaskIds.length}/20 Tasks`
                  },
                  {
                    id: 'scripts' as const,
                    step: '05',
                    label: 'Blender/FFmpeg',
                    meta: '5 Scripts'
                  }
                ]
              ).map((item, idx) => {
                const isActive =
                  activeTab === item.id || (item.id === 'plan' && activeTab === 'barriers');
                return (
                  <React.Fragment key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`px-2.5 py-1 rounded border font-mono text-[11px] transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-amber-500/20 border-amber-400 text-white font-semibold'
                          : 'bg-[#0B0D11] border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      <span className="text-amber-400">{item.step}.</span>
                      <span>{item.label}</span>
                      <span className="text-slate-400 tabular-nums">({item.meta})</span>
                    </button>
                    {idx < 4 && <span className="text-slate-600 hidden sm:inline">→</span>}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {showGuidedWorkflowBar && (
                <span className="text-slate-300 hidden xl:inline">{nextStepSuggestion.prompt}</span>
              )}
              <button
                type="button"
                onClick={handleLaunchGlobalQuickDemo}
                className="px-3 py-1.5 rounded-lg bg-[#161C28] hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-semibold whitespace-nowrap"
              >
                ⚡ 1-Click Quick Demo
              </button>
              <button
                type="button"
                onClick={nextStepSuggestion.action}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold whitespace-nowrap"
              >
                {nextStepSuggestion.buttonLabel}
              </button>
              <button
                type="button"
                onClick={() => setShowGuidedWorkflowBar((prev) => !prev)}
                className="text-[11px] font-mono text-slate-400 hover:text-slate-200 hidden xl:inline"
              >
                {showGuidedWorkflowBar ? 'Hide Tip' : 'Show Tip'}
              </button>
            </div>
          </div>
        </div>

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
            onNavigateToWorkbenchWithHeatmap={handleNavigateToWorkbenchWithHeatmap}
            onNavigateToDeltaScript={() => handleJumpToScriptTab('deltas')}
            quickDemoTriggerCount={quickDemoTriggerCount}
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
          />
        )}
      </main>
    </div>
  );
}
