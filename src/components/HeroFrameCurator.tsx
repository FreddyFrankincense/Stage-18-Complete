import React, { useEffect, useRef, useState } from 'react';
import {
  CuratedReferenceFrame,
  CustomFrameMetadataEntry,
  FrameRole,
  STAGE18_APARTMENTS
} from '../data/stage18Data';
import {
  Check,
  Edit3,
  Eye,
  Pipette,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface HeroFrameCuratorProps {
  curatedFrames: CuratedReferenceFrame[];
  onUpdateFrames: (frames: CuratedReferenceFrame[]) => void;
  onPreviewFrameIn3D: (frame: CuratedReferenceFrame) => void;
  onNavigateToScripts: () => void;
}

const ROLE_LABELS: Record<FrameRole, { label: string; description: string }> = {
  fspy_geometry: {
    label: 'Role A · fSpy Geometry & Vanishing Lines',
    description: 'Unobstructed wide frames with clear horizontal lintels and vertical brick pilasters for solving camera intrinsics.'
  },
  clean_texture_plate: {
    label: 'Role B · Clean Texture Projection Plate',
    description: 'Static 2–5s windows where temporal median stacking (FFmpeg tmix) removes actors and 35mm grain for UV projection.'
  },
  telephoto_set_dressing: {
    label: 'Role C · Telephoto Interior Set Dressing',
    description: 'High-magnification 75mm binocular or 152mm Exakta shots revealing interior props, wallpaper, and molding details.'
  },
  master_lighting_target: {
    label: 'Role D · Master Lighting & Color Target',
    description: 'Representative aesthetic target frame used to sample highlight/shadow Kelvin temperatures for Blender Cycles Light Groups.'
  }
};

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function estimateKelvinFromRgb(r: number, g: number, b: number): number {
  const ratio = (b + 1) / (r + 1);
  const k = Math.round(2400 + ratio * 3800);
  return Math.max(1900, Math.min(9000, k));
}

export default function HeroFrameCurator({
  curatedFrames,
  onUpdateFrames,
  onPreviewFrameIn3D,
  onNavigateToScripts
}: HeroFrameCuratorProps) {
  const [roleFilter, setRoleFilter] = useState<'all' | FrameRole>('all');
  const [selectedFrameId, setSelectedFrameId] = useState<string>(curatedFrames[0]?.id || '');
  const [samplingTarget, setSamplingTarget] = useState<'key' | 'shadow'>('key');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);

  // Inline Metadata Editor State for Selected Frame
  const [editSceneContext, setEditSceneContext] = useState('');
  const [editArchFeature, setEditArchFeature] = useState('');
  const [editLightingNotes, setEditLightingNotes] = useState('');
  const [editGeneralNotes, setEditGeneralNotes] = useState('');
  const [editCustomMeta, setEditCustomMeta] = useState<CustomFrameMetadataEntry[]>([]);
  const [newMetaKey, setNewMetaKey] = useState('');
  const [newMetaValue, setNewMetaValue] = useState('');

  // New Custom Frame Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSmpte, setNewSmpte] = useState('00:32:15:10');
  const [newRole, setNewRole] = useState<FrameRole>('fspy_geometry');
  const [newAptId, setNewAptId] = useState<string>('apt-thorwald');
  const [newFocalMm, setNewFocalMm] = useState<number>(50);
  const [newDurationSec, setNewDurationSec] = useState<number>(3.0);
  const [newUseMedian, setNewUseMedian] = useState<boolean>(true);
  const [newSceneContext, setNewSceneContext] = useState('');
  const [newArchFeature, setNewArchFeature] = useState('');
  const [newLightingNotes, setNewLightingNotes] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newFormCustomMeta, setNewFormCustomMeta] = useState<CustomFrameMetadataEntry[]>([]);
  const [formMetaKey, setFormMetaKey] = useState('');
  const [formMetaValue, setFormMetaValue] = useState('');

  const samplerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedFrame =
    curatedFrames.find((f) => f.id === selectedFrameId) || curatedFrames[0];

  const filteredFrames =
    roleFilter === 'all'
      ? curatedFrames
      : curatedFrames.filter((f) => f.role === roleFilter);

  const includedCount = curatedFrames.filter((f) => f.includedInExport).length;

  // Populate editor fields when opening the inline editor for a frame
  const startEditingFrame = (frame: CuratedReferenceFrame) => {
    setSelectedFrameId(frame.id);
    setEditingFrameId(frame.id);
    setEditSceneContext(frame.sceneContext || '');
    setEditArchFeature(frame.architecturalFeatureHighlighted || '');
    setEditLightingNotes(frame.lightingNotes || '');
    setEditGeneralNotes(frame.notes || '');
    setEditCustomMeta(frame.customMetadata ? [...frame.customMetadata] : []);
    setNewMetaKey('');
    setNewMetaValue('');
  };

  const handleSaveFrameMetadata = (frameId: string) => {
    const pendingEntries =
      newMetaKey.trim() && newMetaValue.trim()
        ? [...editCustomMeta, { key: newMetaKey.trim(), value: newMetaValue.trim() }]
        : editCustomMeta;

    onUpdateFrames(
      curatedFrames.map((f) =>
        f.id === frameId
          ? {
              ...f,
              sceneContext: editSceneContext.trim(),
              architecturalFeatureHighlighted: editArchFeature.trim(),
              lightingNotes: editLightingNotes.trim(),
              notes: editGeneralNotes.trim(),
              customMetadata: pendingEntries
            }
          : f
      )
    );
    setEditingFrameId(null);
    setNewMetaKey('');
    setNewMetaValue('');
  };

  const handleAddCustomMetaToEditor = () => {
    if (!newMetaKey.trim() || !newMetaValue.trim()) return;
    setEditCustomMeta((prev) => [
      ...prev,
      { key: newMetaKey.trim(), value: newMetaValue.trim() }
    ]);
    setNewMetaKey('');
    setNewMetaValue('');
  };

  const handleRemoveCustomMetaFromEditor = (idx: number) => {
    setEditCustomMeta((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddCustomMetaToNewForm = () => {
    if (!formMetaKey.trim() || !formMetaValue.trim()) return;
    setNewFormCustomMeta((prev) => [
      ...prev,
      { key: formMetaKey.trim(), value: formMetaValue.trim() }
    ]);
    setFormMetaKey('');
    setFormMetaValue('');
  };

  const handleRemoveCustomMetaFromNewForm = (idx: number) => {
    setNewFormCustomMeta((prev) => prev.filter((_, i) => i !== idx));
  };

  // Render procedural 1954 Technicolor reference plate or user-uploaded 4K still on the sampler canvas
  useEffect(() => {
    const canvas = samplerCanvasRef.current;
    if (!canvas || !selectedFrame) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (uploadedImageUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = uploadedImageUrl;
      return;
    }

    const w = canvas.width;
    const h = canvas.height;

    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, selectedFrame.sampledShadowColorHex);
    bgGrad.addColorStop(0.55, '#3b2318');
    bgGrad.addColorStop(1, selectedFrame.sampledKeyColorHex);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(18, 22, 31, 0.45)';
    for (let y = 0; y < h; y += 14) {
      ctx.fillRect(0, y, w, 2);
    }

    const winCols = selectedFrame.focalLengthMm >= 135 ? 1 : 3;
    const winW = selectedFrame.focalLengthMm >= 135 ? 180 : 88;
    const winH = selectedFrame.focalLengthMm >= 135 ? 150 : 110;
    for (let i = 0; i < winCols; i++) {
      const wx = w / 2 - ((winCols * (winW + 28) - 28) / 2) + i * (winW + 28);
      const wy = h / 2 - winH / 2;

      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(wx - 6, wy - 10, winW + 12, 8);
      ctx.fillRect(wx - 8, wy + winH + 2, winW + 16, 6);

      const winGrad = ctx.createRadialGradient(
        wx + winW / 2,
        wy + winH / 2,
        10,
        wx + winW / 2,
        wy + winH / 2,
        winW
      );
      winGrad.addColorStop(0, selectedFrame.sampledKeyColorHex);
      winGrad.addColorStop(1, selectedFrame.sampledShadowColorHex);
      ctx.fillStyle = winGrad;
      ctx.fillRect(wx, wy, winW, winH);

      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, wy, winW, winH);
      ctx.beginPath();
      ctx.moveTo(wx, wy + winH * 0.48);
      ctx.lineTo(wx + winW, wy + winH * 0.48);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(11, 13, 17, 0.78)';
    ctx.fillRect(12, h - 34, 290, 24);
    ctx.fillStyle = '#F59E0B';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(
      `SMPTE ${selectedFrame.smpteTimecode} · ${selectedFrame.focalLengthMm}mm`,
      20,
      h - 18
    );
  }, [selectedFrame, uploadedImageUrl]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = samplerCanvasRef.current;
    if (!canvas || !selectedFrame) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    const estKelvin = estimateKelvinFromRgb(pixel[0], pixel[1], pixel[2]);

    const updated = curatedFrames.map((f) => {
      if (f.id !== selectedFrame.id) return f;
      if (samplingTarget === 'key') {
        return { ...f, sampledKeyColorHex: hex, kelvinEstimate: estKelvin };
      }
      return { ...f, sampledShadowColorHex: hex };
    });
    onUpdateFrames(updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFrameInclusion = (id: string) => {
    onUpdateFrames(
      curatedFrames.map((f) =>
        f.id === id ? { ...f, includedInExport: !f.includedInExport } : f
      )
    );
  };

  const toggleFrameMedianStack = (id: string) => {
    onUpdateFrames(
      curatedFrames.map((f) =>
        f.id === id ? { ...f, useTemporalMedianStack: !f.useTemporalMedianStack } : f
      )
    );
  };

  const deleteFrame = (id: string) => {
    if (curatedFrames.length <= 1) return;
    const next = curatedFrames.filter((f) => f.id !== id);
    onUpdateFrames(next);
    if (selectedFrameId === id && next[0]) {
      setSelectedFrameId(next[0].id);
    }
  };

  const handleAddCustomFrame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const id = `frame-custom-${Date.now()}`;
    const finalCustomMeta =
      formMetaKey.trim() && formMetaValue.trim()
        ? [...newFormCustomMeta, { key: formMetaKey.trim(), value: formMetaValue.trim() }]
        : newFormCustomMeta;

    const newFrame: CuratedReferenceFrame = {
      id,
      title: newTitle.trim(),
      sourceType: 'mkv_timecode',
      smpteTimecode: newSmpte.trim() || '00:32:15:10',
      frameNumber: 46400,
      durationWindowSec: newDurationSec,
      useTemporalMedianStack: newUseMedian,
      role: newRole,
      targetApartmentId: newAptId,
      focalLengthMm: newFocalMm,
      sampledKeyColorHex: '#F59E0B',
      sampledShadowColorHex: '#1E293B',
      kelvinEstimate: 3800,
      sceneContext:
        newSceneContext.trim() ||
        'User-pinned scene context from 4K Blu-ray remux inspection.',
      architecturalFeatureHighlighted:
        newArchFeature.trim() ||
        'Primary facade masonry, window sash geometry, and interior depth.',
      lightingNotes:
        newLightingNotes.trim() ||
        'Balanced Stage 18 key/fill lighting setup.',
      notes:
        newNotes.trim() ||
        'User-selected representative reference frame pinned for targeted FFmpeg extraction and Blender camera background alignment.',
      customMetadata: finalCustomMeta,
      includedInExport: true,
      cropRegion: '3840x2304 (Full 4K Frame)'
    };
    onUpdateFrames([newFrame, ...curatedFrames]);
    setSelectedFrameId(id);
    setNewTitle('');
    setNewSceneContext('');
    setNewArchFeature('');
    setNewLightingNotes('');
    setNewNotes('');
    setNewFormCustomMeta([]);
    setFormMetaKey('');
    setFormMetaValue('');
  };

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8 space-y-8">
      {/* Header & Value Summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <p className="text-xs font-mono text-amber-400">
            PHASE 1 &amp; 3.1 OPTIMIZATION · USER-GUIDED HERO FRAME SELECTION &amp; METADATA
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display mt-1">
            Representative Hero Frame Curator &amp; Colorimetric Sampler
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
            Annotate each representative frame with structured engineering metadata—including{' '}
            <span className="text-white font-medium">Scene Context</span>,{' '}
            <span className="text-white font-medium">Architectural Feature Highlighted</span>,{' '}
            <span className="text-white font-medium">Lighting Notes</span>, and custom key-value
            specifications. All metadata is preserved across sessions and embedded directly into
            your exported FFmpeg, fSpy, and Blender <code className="text-amber-300">bpy</code>{' '}
            camera properties.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right text-xs text-slate-400 font-mono">
            <div className="text-slate-200 font-semibold">
              {includedCount} of {curatedFrames.length} Frames Active in Pipeline
            </div>
            <div>Est. Extraction Disk Footprint: ~{includedCount * 42} MB (vs. 6.8 TB full dump)</div>
          </div>
          <button
            onClick={onNavigateToScripts}
            className="px-4 py-2.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Compile FFmpeg &amp; Blender Scripts →
          </button>
        </div>
      </div>

      {/* Role Filter Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-[#12161F] border border-white/10 rounded-lg flex-wrap">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              roleFilter === 'all'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            All Roles ({curatedFrames.length})
          </button>
          {(Object.keys(ROLE_LABELS) as FrameRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                roleFilter === role
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {ROLE_LABELS[role].label.split(' · ')[1]}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Split: Left = Curated Frame List | Right = Interactive Sampler & Add Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Curated Frames List with Inline Metadata & Notes Editor */}
        <div className="lg:col-span-7 space-y-4">
          {filteredFrames.map((frame) => {
            const apt = STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId);
            const isSelected = selectedFrame?.id === frame.id;
            const isEditing = editingFrameId === frame.id;

            return (
              <div
                key={frame.id}
                onClick={() => setSelectedFrameId(frame.id)}
                className={`p-5 rounded-xl border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#161C28] border-amber-500/60'
                    : 'bg-[#12161F] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 flex-wrap">
                      <span className="text-amber-400 font-semibold">
                        SMPTE {frame.smpteTimecode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{frame.focalLengthMm}mm Lens</span>
                      <span aria-hidden="true">·</span>
                      <span>{ROLE_LABELS[frame.role].label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{apt?.designation.split(' · ')[0] || 'STAGE 18'}</span>
                    </div>
                    <h3 className="text-base font-semibold text-white font-display">
                      {frame.title}
                    </h3>
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() =>
                        isEditing ? setEditingFrameId(null) : startEditingFrame(frame)
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                        isEditing
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                          : 'bg-[#1A202C] text-slate-200 border-white/10 hover:border-amber-400/50'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {isEditing ? 'Close Editor' : 'Edit Notes & Metadata'}
                    </button>

                    <button
                      onClick={() => toggleFrameInclusion(frame.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 ${
                        frame.includedInExport
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-white/10'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {frame.includedInExport ? 'Pinned' : 'Excluded'}
                    </button>

                    {curatedFrames.length > 1 && (
                      <button
                        onClick={() => deleteFrame(frame.id)}
                        title="Remove Frame"
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Structured Metadata Display or Inline Editor */}
                {isEditing ? (
                  <div
                    className="mt-4 pt-4 border-t border-white/15 space-y-3 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-amber-300 font-medium mb-1">
                          Scene Context
                        </label>
                        <textarea
                          rows={2}
                          value={editSceneContext}
                          onChange={(e) => setEditSceneContext(e.target.value)}
                          placeholder="Narrative moment, actor blocking, or camera pan state..."
                          className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-300 font-medium mb-1">
                          Architectural Feature Highlighted
                        </label>
                        <textarea
                          rows={2}
                          value={editArchFeature}
                          onChange={(e) => setEditArchFeature(e.target.value)}
                          placeholder="Specific masonry courses, window mullions, ironwork, or props..."
                          className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-amber-300 font-medium mb-1">
                          Lighting &amp; Colorimetric Notes
                        </label>
                        <textarea
                          rows={2}
                          value={editLightingNotes}
                          onChange={(e) => setEditLightingNotes(e.target.value)}
                          placeholder="Sun shadow rake angle, practical lamp ratio, or Kelvin balance..."
                          className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-amber-300 font-medium mb-1">
                          Calibration &amp; Pipeline Notes
                        </label>
                        <textarea
                          rows={2}
                          value={editGeneralNotes}
                          onChange={(e) => setEditGeneralNotes(e.target.value)}
                          placeholder="fSpy vanishing axes, UDIM target, or occlusion notes..."
                          className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* Custom Key-Value Metadata Tag Editor */}
                    <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10 space-y-2.5">
                      <div className="text-slate-300 font-medium">
                        Custom Frame Metadata Attributes (Exported to Blender Camera &amp; fSpy JSON)
                      </div>

                      {editCustomMeta.length > 0 && (
                        <div className="space-y-1.5">
                          {editCustomMeta.map((entry, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 text-xs font-mono bg-[#12161F] px-3 py-1.5 rounded border border-white/5"
                            >
                              <div>
                                <span className="text-amber-400">{entry.key}:</span>{' '}
                                <span className="text-slate-200">{entry.value}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomMetaFromEditor(idx)}
                                className="text-slate-400 hover:text-red-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newMetaKey}
                          onChange={(e) => setNewMetaKey(e.target.value)}
                          placeholder="Metadata Key (e.g., Brick Pitch, Lens T-Stop)"
                          className="flex-1 px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-slate-100 font-mono"
                        />
                        <input
                          type="text"
                          value={newMetaValue}
                          onChange={(e) => setNewMetaValue(e.target.value)}
                          placeholder="Value (e.g., 3 courses = 8 in)"
                          className="flex-1 px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-slate-100 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddCustomMetaToEditor}
                          className="px-3 py-1.5 bg-[#1A202C] hover:bg-slate-700 text-amber-300 border border-white/15 rounded font-medium whitespace-nowrap shrink-0 flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Tag
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingFrameId(null)}
                        className="px-3 py-1.5 rounded-lg bg-[#1A202C] text-slate-300 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveFrameMetadata(frame.id)}
                        className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Frame Metadata
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2.5 text-xs">
                    {/* Structured 3-Field Metadata Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg bg-[#0B0D11]/90 border border-white/5">
                      <div>
                        <span className="text-slate-400 font-medium block mb-0.5">
                          Scene Context
                        </span>
                        <p className="text-slate-200 leading-relaxed">
                          {frame.sceneContext || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block mb-0.5">
                          Architectural Feature Highlighted
                        </span>
                        <p className="text-slate-200 leading-relaxed">
                          {frame.architecturalFeatureHighlighted || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium block mb-0.5">
                          Lighting Notes
                        </span>
                        <p className="text-slate-200 leading-relaxed">
                          {frame.lightingNotes || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    <p className="text-slate-300 leading-relaxed">
                      <span className="text-slate-400 font-medium">Engineering Notes: </span>
                      {frame.notes}
                    </p>

                    {/* Clean Unboxed Custom Metadata String (Zero-Pill Compliance) */}
                    {frame.customMetadata && frame.customMetadata.length > 0 && (
                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
                        {frame.customMetadata.map((meta, idx) => (
                          <React.Fragment key={idx}>
                            {idx > 0 && <span aria-hidden="true">·</span>}
                            <span>
                              <strong className="text-amber-300/90 font-normal">
                                {meta.key}:
                              </strong>{' '}
                              <span className="text-slate-200">{meta.value}</span>
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div
                  className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-4 text-slate-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: frame.sampledKeyColorHex }}
                      />
                      Key {frame.sampledKeyColorHex} ({frame.kelvinEstimate}K)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block w-3 h-3 rounded-sm border border-white/20"
                        style={{ backgroundColor: frame.sampledShadowColorHex }}
                      />
                      Shadow {frame.sampledShadowColorHex}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFrameMedianStack(frame.id)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                        frame.useTemporalMedianStack
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-[#1A202C] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {frame.useTemporalMedianStack
                        ? `Median De-Grain (${frame.durationWindowSec}s tmix)`
                        : 'Single Frame Grab'}
                    </button>

                    <button
                      onClick={() => onPreviewFrameIn3D(frame)}
                      className="px-2.5 py-1 text-xs font-medium bg-[#1A202C] text-slate-200 hover:text-amber-300 border border-white/10 rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Match in 3D Workbench
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column (5 cols): Interactive Frame Color Sampler + Add Custom SMPTE Frame Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Color & Kelvin Sampler Panel */}
          {selectedFrame && (
            <div className="bg-[#12161F] border border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-amber-400">
                    OPTICAL &amp; TECHNICOLOR PLATE INSPECTOR
                  </p>
                  <h3 className="text-base font-semibold text-white font-display mt-0.5">
                    {selectedFrame.title}
                  </h3>
                </div>
                <label className="px-3 py-1.5 text-xs font-medium bg-[#1A202C] text-slate-200 hover:text-white border border-white/15 rounded-lg cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  Load Local 4K Still
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Click anywhere on the reference plate canvas below to sample real Technicolor
                highlight or shadow values. Sampled Kelvin values automatically populate your{' '}
                <code className="text-amber-300">04_setup_cycles_lighting_and_cameras.py</code>{' '}
                script.
              </p>

              <div className="relative rounded-lg overflow-hidden border border-white/15 bg-black">
                <canvas
                  ref={samplerCanvasRef}
                  width={480}
                  height={288}
                  onClick={handleCanvasClick}
                  className="w-full h-auto cursor-crosshair block"
                />
              </div>

              {/* Sampling Mode Controls */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSamplingTarget('key')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      samplingTarget === 'key'
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-[#1A202C] text-slate-300'
                    }`}
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    Sample Key Light ({selectedFrame.sampledKeyColorHex})
                  </button>
                  <button
                    onClick={() => setSamplingTarget('shadow')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      samplingTarget === 'shadow'
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-[#1A202C] text-slate-300'
                    }`}
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    Sample Shadow Fill ({selectedFrame.sampledShadowColorHex})
                  </button>
                </div>

                <div className="text-xs font-mono text-amber-300">
                  Est. {selectedFrame.kelvinEstimate}K
                </div>
              </div>
            </div>
          )}

          {/* Add Custom Representative Frame Form with Full Structured Metadata */}
          <form
            onSubmit={handleAddCustomFrame}
            className="bg-[#12161F] border border-white/10 rounded-xl p-5 space-y-4"
          >
            <div>
              <p className="text-xs font-mono text-amber-400">ADD CUSTOM REPRESENTATIVE FRAME</p>
              <h3 className="text-base font-semibold text-white font-display mt-0.5">
                Pin Specific SMPTE Frame &amp; Metadata from Your 75 GB MKV
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Frame Title / Target Goal
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Unobstructed 50mm View of Miss Torso Balcony Ironwork"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    SMPTE Timecode (HH:MM:SS:FF)
                  </label>
                  <input
                    type="text"
                    value={newSmpte}
                    onChange={(e) => setNewSmpte(e.target.value)}
                    placeholder="00:32:15:10"
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Lens Focal Length (mm)
                  </label>
                  <select
                    value={newFocalMm}
                    onChange={(e) => setNewFocalMm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  >
                    <option value={28}>28mm Stage Crane</option>
                    <option value={35}>35mm Mitchell BNC Wide</option>
                    <option value={50}>50mm Mitchell BNC Normal</option>
                    <option value={75}>75mm Binoculars POV</option>
                    <option value={152}>152mm Exakta Telephoto</option>
                    <option value={400}>400mm Kilfitt Extreme Telephoto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Engineering Role in Pipeline
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as FrameRole)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="fspy_geometry">Role A · fSpy Geometry Anchor</option>
                    <option value="clean_texture_plate">Role B · Clean Texture Plate</option>
                    <option value="telephoto_set_dressing">Role C · 152mm Set Dressing</option>
                    <option value="master_lighting_target">Role D · Master Lighting Target</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">
                    Target Stage 18 Zone
                  </label>
                  <select
                    value={newAptId}
                    onChange={(e) => setNewAptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    {STAGE18_APARTMENTS.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        {apt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dedicated Structured Metadata Inputs */}
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Scene Context
                </label>
                <input
                  type="text"
                  value={newSceneContext}
                  onChange={(e) => setNewSceneContext(e.target.value)}
                  placeholder="e.g., Act II afternoon observation while Miss Torso practices ballet"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Architectural Feature Highlighted
                </label>
                <input
                  type="text"
                  value={newArchFeature}
                  onChange={(e) => setNewArchFeature(e.target.value)}
                  placeholder="e.g., Juliette wrought-iron balcony railing, double sash molding & cornice"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Lighting Notes
                </label>
                <input
                  type="text"
                  value={newLightingNotes}
                  onChange={(e) => setNewLightingNotes(e.target.value)}
                  placeholder="e.g., Warm 3600K oblique key light with soft stage skylight bounce"
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  General Engineering &amp; Occlusion Notes
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Additional fSpy vanishing-point, UDIM projection, or occlusion notes..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Optional Custom Key-Value Metadata Pairs */}
              <div className="p-3 rounded-lg bg-[#0B0D11] border border-white/10 space-y-2">
                <div className="text-slate-300 font-medium">
                  Custom Metadata Attributes (Optional)
                </div>

                {newFormCustomMeta.length > 0 && (
                  <div className="space-y-1">
                    {newFormCustomMeta.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 font-mono text-[11px] bg-[#12161F] px-2.5 py-1 rounded"
                      >
                        <span>
                          <span className="text-amber-400">{m.key}:</span> {m.value}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomMetaFromNewForm(idx)}
                          className="text-slate-400 hover:text-red-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formMetaKey}
                    onChange={(e) => setFormMetaKey(e.target.value)}
                    placeholder="Key (e.g., UDIM Tile)"
                    className="flex-1 px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-slate-100 font-mono"
                  />
                  <input
                    type="text"
                    value={formMetaValue}
                    onChange={(e) => setFormMetaValue(e.target.value)}
                    placeholder="Value (e.g., 1003)"
                    className="flex-1 px-2.5 py-1.5 rounded bg-[#12161F] border border-white/15 text-slate-100 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomMetaToNewForm}
                    className="px-2.5 py-1.5 bg-[#1A202C] hover:bg-slate-700 text-amber-300 border border-white/15 rounded font-medium whitespace-nowrap shrink-0"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUseMedian}
                    onChange={(e) => setNewUseMedian(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  <span>Enable Multi-Frame Median Stack (erases moving actors &amp; grain)</span>
                </label>

                {newUseMedian && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={newDurationSec}
                      onChange={(e) => setNewDurationSec(Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded bg-[#0B0D11] border border-white/15 text-slate-100"
                    />
                    <span className="text-slate-400">sec</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Pin Representative Frame &amp; Metadata to Pipeline
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
