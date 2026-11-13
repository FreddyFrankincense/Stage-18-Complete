import React, { useEffect, useState } from 'react';
import {
  CAMERA_OPTICAL_PRESETS,
  CameraOpticalPreset,
  CuratedReferenceFrame,
  INITIAL_CURATED_FRAMES,
  LIGHTING_SCENARIOS,
  LightingScenarioPreset,
  STAGE18_APARTMENTS,
  Stage18ApartmentUnit
} from './data/stage18Data';
import Stage18Viewport3D from './components/Stage18Viewport3D';
import HeroFrameCurator from './components/HeroFrameCurator';
import ActionPlanAndBarriers from './components/ActionPlanAndBarriers';
import ScriptGeneratorWorkspace from './components/ScriptGeneratorWorkspace';

type WorkspaceTab = 'workbench' | 'frames' | 'plan' | 'scripts' | 'barriers';

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
  const [targetScriptTab, setTargetScriptTab] = useState<
    'ffmpeg' | 'fspy' | 'architecture' | 'lighting'
  >('ffmpeg');

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

  const handleToggleTask = (taskId: string) => {
    setCompletedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handlePreviewFrameIn3D = (frame: CuratedReferenceFrame) => {
    const targetApt =
      STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId) || STAGE18_APARTMENTS[1];
    setSelectedApartment(targetApt);

    // Match closest camera lens preset
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

  const handleJumpToScriptTab = (scriptTab: 'ffmpeg' | 'fspy' | 'architecture' | 'lighting') => {
    setTargetScriptTab(scriptTab);
    setActiveTab('scripts');
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
              activeTab === 'plan'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            Action Plan
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
          <button
            onClick={() => setActiveTab('barriers')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'barriers'
                ? 'text-amber-400 border-amber-400'
                : 'border-transparent hover:text-white'
            }`}
          >
            Barriers &amp; Risks
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setActiveTab('scripts')}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-500 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Export Blender Kit
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
          />
        )}
      </main>
    </div>
  );
}
