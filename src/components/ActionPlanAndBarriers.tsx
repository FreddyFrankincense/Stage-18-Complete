import React, { useState } from 'react';
import {
  PIPELINE_PHASES,
  PipelinePhase,
  TECHNICAL_BARRIERS,
  TechnicalBarrier
} from '../data/stage18Data';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Code2,
  ShieldAlert,
  Wrench
} from 'lucide-react';

interface ActionPlanAndBarriersProps {
  mode: 'plan' | 'barriers';
  completedTaskIds: string[];
  onToggleTask: (taskId: string) => void;
  onJumpToScriptTab: (
    scriptTab: 'ffmpeg' | 'fspy' | 'architecture' | 'lighting' | 'deltas'
  ) => void;
  onSwitchMode: (mode: 'plan' | 'barriers') => void;
}

export default function ActionPlanAndBarriers({
  mode,
  completedTaskIds,
  onToggleTask,
  onJumpToScriptTab,
  onSwitchMode
}: ActionPlanAndBarriersProps) {
  const [barrierCategory, setBarrierCategory] = useState<string>('All');
  const [highlightedBarrierId, setHighlightedBarrierId] = useState<string | null>(null);

  const allTasks = PIPELINE_PHASES.flatMap((p) => p.tasks);
  const totalHours = allTasks.reduce((acc, t) => acc + t.estimatedHours, 0);
  const completedHours = allTasks
    .filter((t) => completedTaskIds.includes(t.id))
    .reduce((acc, t) => acc + t.estimatedHours, 0);

  const filteredBarriers =
    barrierCategory === 'All'
      ? TECHNICAL_BARRIERS
      : TECHNICAL_BARRIERS.filter((b) => b.category === barrierCategory);

  if (mode === 'barriers') {
    return (
      <div className="max-w-[1380px] mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div>
            <p className="text-xs font-mono text-red-400">
              OPTICAL, COMPUTATIONAL &amp; ARCHIVAL RISK ANALYSIS
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white font-display mt-1">
              Technical Difficulties, Barriers &amp; Engineered Mitigations
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
              Reconstructing Paramount Stage 18 solely from a 75 GB 4K Blu-ray remux and public web
              stills presents 8 critical optical and computational barriers—most notably the failure
              of traditional multi-view photogrammetry due to nodal tripod panning inside L.B.
              Jefferies&apos;s apartment.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onSwitchMode('plan')}
              className="px-4 py-2 text-xs font-medium bg-[#12161F] text-slate-200 border border-white/15 rounded-lg hover:border-white/30 transition-colors whitespace-nowrap shrink-0"
            >
              ← View 6-Phase Action Plan
            </button>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#12161F] border border-white/10 rounded-lg w-fit flex-wrap">
          {['All', 'Optical & Camera', '4K Remux & Color', 'Architecture & Scale', 'Lighting & VRAM'].map(
            (cat) => (
              <button
                key={cat}
                onClick={() => setBarrierCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  barrierCategory === cat
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>

        {/* Barriers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBarriers.map((barrier) => {
            const isHighlighted = highlightedBarrierId === barrier.id;
            return (
              <div
                key={barrier.id}
                className={`p-6 rounded-xl border transition-colors flex flex-col justify-between space-y-4 ${
                  isHighlighted
                    ? 'bg-[#181E2C] border-amber-400'
                    : 'bg-[#12161F] border-white/10 hover:border-white/20'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-amber-400">{barrier.code}</span>
                    <span
                      className={
                        barrier.severity === 'Critical'
                          ? 'text-red-400 font-semibold'
                          : barrier.severity === 'High'
                          ? 'text-amber-300 font-semibold'
                          : 'text-slate-300'
                      }
                    >
                      Severity: {barrier.severity} · {barrier.category}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white font-display">
                    {barrier.title}
                  </h3>

                  <div className="space-y-2.5 text-xs leading-relaxed pt-1">
                    <div>
                      <span className="text-slate-400 font-semibold block mb-0.5">
                        Root Optical / Technical Cause:
                      </span>
                      <p className="text-slate-300">{barrier.opticalOrTechnicalCause}</p>
                    </div>

                    <div>
                      <span className="text-red-300/90 font-semibold block mb-0.5">
                        Failure Mode / Symptom in Blender:
                      </span>
                      <p className="text-slate-300">{barrier.symptomsInBlender}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10">
                      <span className="text-emerald-400 font-semibold block mb-0.5">
                        Engineered Mitigation &amp; Workaround:
                      </span>
                      <p className="text-slate-200">{barrier.engineeredWorkaround}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                  <span className="text-xs font-mono text-slate-400 truncate">
                    {barrier.blenderOrFfmpegSolution}
                  </span>
                  <button
                    onClick={() => onJumpToScriptTab(barrier.associatedScriptTab)}
                    className="px-3 py-1.5 text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    Open Solving Script →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8 space-y-8">
      {/* Header & Progress Bar */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <p className="text-xs font-mono text-amber-400">
            END-TO-END ARCHITECTURAL RECONSTRUCTION BLUEPRINT
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display mt-1">
            6-Phase Action Plan: 75 GB 4K Remux to Final Blender Cycles Render
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
            A structured engineering roadmap combining lossless FFmpeg frame extraction, user-guided
            Hero Frame curation, fSpy single-image perspective metrology, and modular Blender 4.2
            LTS Python automation.
          </p>
        </div>

        <div className="bg-[#12161F] border border-white/10 rounded-xl p-4 min-w-[280px] shrink-0">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="text-slate-400">PIPELINE EXECUTION PROGRESS</span>
            <span className="text-amber-400 font-semibold">
              {completedTaskIds.length}/{allTasks.length} Tasks ({completedHours}/{totalHours}h)
            </span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-200"
              style={{ width: `${(completedTaskIds.length / allTasks.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 6 Phases List */}
      <div className="space-y-6">
        {PIPELINE_PHASES.map((phase) => {
          const linkedBarriers = TECHNICAL_BARRIERS.filter((b) =>
            phase.linkedBarrierIds.includes(b.id)
          );

          return (
            <section
              key={phase.id}
              className="bg-[#12161F] border border-white/10 rounded-xl p-6 space-y-5"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    PHASE {phase.phaseNumber} · {phase.subtitle}
                  </div>
                  <h2 className="text-xl font-bold text-white font-display mt-1">
                    {phase.phaseNumber}. {phase.title}
                  </h2>
                  <p className="text-sm text-slate-300 mt-1.5 max-w-4xl leading-relaxed">
                    {phase.summary}
                  </p>
                </div>

                <div className="text-xs font-mono text-slate-400 shrink-0 md:text-right">
                  <div className="text-slate-200 font-medium">Target Deliverable</div>
                  <div className="mt-0.5 max-w-xs">{phase.deliverable}</div>
                </div>
              </div>

              {/* Tasks */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {phase.tasks.map((task) => {
                  const isDone = completedTaskIds.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onToggleTask(task.id)}
                      className={`p-4 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between space-y-3 ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-[#0B0D11] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-mono text-slate-400">
                            {task.toolUsed} · ~{task.estimatedHours}h
                          </span>
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-white">{task.title}</h3>
                        <p className="text-xs text-slate-300 leading-relaxed">{task.detail}</p>
                      </div>

                      <div className="p-2.5 rounded bg-[#12161F] border border-white/5 font-mono text-[11px] text-amber-300/90 overflow-x-auto">
                        {task.cliOrActionSnippet}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cross-linked Barriers */}
              {linkedBarriers.length > 0 && (
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap text-xs">
                  <div className="flex items-center gap-2 text-slate-400 flex-wrap">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Associated Technical Barriers Mitigated in Phase {phase.phaseNumber}:</span>
                    {linkedBarriers.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setHighlightedBarrierId(b.id);
                          onSwitchMode('barriers');
                        }}
                        className="text-amber-300 hover:text-amber-200 underline underline-offset-4 font-medium"
                      >
                        {b.code}: {b.title.split(' ')[0]} {b.title.split(' ')[1]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
