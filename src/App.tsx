import React, { useEffect, useState } from 'react';
import {
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  CAMERA_OPTICAL_PRESETS,
  CameraOpticalPreset,
  CuratedReferenceFrame,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  INITIAL_CURATED_FRAMES,
  LIGHTING_SCENARIOS,
  LightingScenarioPreset,
  ManualFrameVerification,
  ParametricDimensionsSnapshot,
  STAGE18_APARTMENTS,
  Stage18ApartmentUnit
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

  const [targetScriptTab, setTargetScriptTab] = useState<ScriptTabId>('ffmpeg');

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

  const handleToggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handlePreviewFrameIn3D = (frame: CuratedReferenceFrame) => {
    const targetApt =
      STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId) || STAGE18_APARTMENTS[1];
    setSelectedApartment(targetApt);

    const closestPreset =
      CAMERA_OPTICAL_PRESETS.find((c) => c.focalLengthMm === frame.focalLengthMm) ||
      (frame.focalLengthMm >= 135
        ? CAMERA_OPTICAL_PRESETS[3]
        : frame.focalLengthMm >= 70
        ? CAMERA_OPTICAL_PRESETS[2]
        : CAMERA_OPTICAL_PRESETS[0]);
    setActiveCameraPreset(closestPreset);
    setActiveTab('workbench');
  };

  const handleJumpToScriptTab = (scriptTab: ScriptTabId) => {
    setTargetScriptTab(scriptTab);
    setActiveTab('scripts');
  };

  const handlePinAnalyzedFrame = (newFrame: CuratedReferenceFrame) => {
    setCuratedFrames((prev) => [newFrame, ...prev]);
  };

  const handleApplyLiveProjectionTo3D = (dataUrl: string, targetAptId: string) => {
    const targetApt =
      STAGE18_APARTMENTS.find((a) => a.id === targetAptId) || STAGE18_APARTMENTS[1];
    setSelectedApartment(targetApt);
    setLiveProjectedTextureUrl(dataUrl);
    setActiveTab('workbench');
  };

  // Review Gate Handlers for Dual-Engine Autonomous Frame-to-3D Solver
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
    setLayoutIterations((prev) =>
      prev.map((it) =>
        it.id === iterationId
          ? {
              ...it,
              targetApartmentId: updatedTargetApartmentId,
              proposedValues: updatedProposedValues,
              confidenceScore: 96,
              status: 'approved',
              manualVerification: verification
            }
          : it
      )
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
  };

  const handleResetAllOverrides = () => {
    setParametricOverrides(INITIAL_BUILDING_PARAMETRIC_OVERRIDES);
    setLayoutIterations((prev) =>
      prev.map((it) => (it.status === 'approved' ? { ...it, status: 'pending_review' } : it))
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
          />
        )}
      </main>
    </div>
  );
}
