import React, { useEffect, useRef, useState } from 'react';
import {
  CuratedReferenceFrame,
  CustomFrameMetadataEntry,
  FrameRole,
  STAGE18_APARTMENTS
} from '../data/stage18Data';
import {
  Check,
  Download,
  Edit3,
  Eye,
  FileCode,
  Layers,
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

type ExportResolutionMode = '2k_1920x1152' | '4k_3840x2304';
type ExportOverlayMode = 'annotated_slate' | 'clean_plate';

const ROLE_LABELS: Record<FrameRole, { label: string; shortCode: string; description: string }> = {
  fspy_geometry: {
    label: 'Role A · fSpy Geometry & Vanishing Lines',
    shortCode: 'ROLE-A_FSPY',
    description:
      'Unobstructed wide frames with clear horizontal lintels and vertical brick pilasters for solving camera intrinsics.'
  },
  clean_texture_plate: {
    label: 'Role B · Clean Texture Projection Plate',
    shortCode: 'ROLE-B_TEXPLATE',
    description:
      'Static 2–5s windows where temporal median stacking (FFmpeg tmix) removes actors and 35mm grain for UV projection.'
  },
  telephoto_set_dressing: {
    label: 'Role C · Telephoto Interior Set Dressing',
    shortCode: 'ROLE-C_SETDRESS',
    description:
      'High-magnification 75mm binocular or 152mm Exakta shots revealing interior props, wallpaper, and molding details.'
  },
  master_lighting_target: {
    label: 'Role D · Master Lighting & Color Target',
    shortCode: 'ROLE-D_LIGHTREF',
    description:
      'Representative aesthetic target frame used to sample highlight/shadow Kelvin temperatures for Blender Cycles Light Groups.'
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

// ============================================================================
// Binary PNG tEXt Metadata Chunk Encoder (IEEE 802.3 CRC32)
// Embeds Blender pipeline metadata directly inside the exported PNG binary
// so Blender Python (PIL/OpenImageIO) & ExifTool can read all frame attributes.
// ============================================================================
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function toLatin1SafeBytes(input: string, maxLen = 1024): Uint8Array {
  const clean = input.replace(/[\r\n]+/g, ' ').slice(0, maxLen);
  const out = new Uint8Array(clean.length);
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    out[i] = code >= 32 && code <= 126 ? code : 63; // printable ASCII
  }
  return out;
}

function createPngTextChunk(keyword: string, textValue: string): Uint8Array {
  const safeKey = keyword
    .replace(/[^A-Za-z0-9_ -]/g, '_')
    .slice(0, 78)
    .trim();
  const keyBytes = toLatin1SafeBytes(safeKey, 78);
  const valBytes = toLatin1SafeBytes(textValue, 2048);

  const dataLen = keyBytes.length + 1 + valBytes.length;
  const chunk = new Uint8Array(4 + 4 + dataLen + 4);
  const view = new DataView(chunk.buffer);

  // Length (4 bytes, big-endian)
  view.setUint32(0, dataLen, false);

  // Chunk Type "tEXt" (0x74 0x45 0x58 0x74)
  chunk[4] = 0x74;
  chunk[5] = 0x45;
  chunk[6] = 0x58;
  chunk[7] = 0x74;

  // Keyword + Null separator (0x00) + Text value
  chunk.set(keyBytes, 8);
  chunk[8 + keyBytes.length] = 0x00;
  chunk.set(valBytes, 8 + keyBytes.length + 1);

  // CRC32 over Type + Data
  const crc = computeCrc32(chunk.subarray(4, 8 + dataLen));
  view.setUint32(8 + dataLen, crc, false);

  return chunk;
}

function injectPngTextChunks(
  pngBuffer: ArrayBuffer,
  metadataPairs: Array<{ key: string; value: string }>
): Uint8Array {
  const src = new Uint8Array(pngBuffer);
  // Verify PNG signature and locate IEND chunk near the end (last 12 bytes in standard canvas PNG)
  let iendOffset = src.length - 12;
  for (let i = src.length - 12; i >= 8; i--) {
    if (
      src[i + 4] === 0x49 && // 'I'
      src[i + 5] === 0x45 && // 'E'
      src[i + 6] === 0x4e && // 'N'
      src[i + 7] === 0x44 // 'D'
    ) {
      iendOffset = i;
      break;
    }
  }

  const textChunks = metadataPairs.map((pair) => createPngTextChunk(pair.key, pair.value));
  const totalInsertedBytes = textChunks.reduce((sum, c) => sum + c.length, 0);

  const output = new Uint8Array(src.length + totalInsertedBytes);
  output.set(src.subarray(0, iendOffset), 0);

  let writePos = iendOffset;
  for (const chunk of textChunks) {
    output.set(chunk, writePos);
    writePos += chunk.length;
  }

  output.set(src.subarray(iendOffset), writePos);
  return output;
}

export function buildBlenderPipelineFilename(
  frame: CuratedReferenceFrame,
  overlayMode: ExportOverlayMode
): string {
  const apt = STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId);
  const aptCode = (apt?.designation.split(' · ')[0] || 'STAGE18')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
  const roleShort = ROLE_LABELS[frame.role].shortCode;
  const smpteSafe = frame.smpteTimecode.replace(/:/g, '-');
  const titleSlug = frame.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 34);
  const suffix = overlayMode === 'annotated_slate' ? 'SLATE' : 'CLEAN';
  return `stage18_${aptCode}_${roleShort}_TC${smpteSafe}_${frame.focalLengthMm}mm_${titleSlug}_${suffix}.png`;
}

export function buildPngEmbeddedMetadataPairs(
  frame: CuratedReferenceFrame
): Array<{ key: string; value: string }> {
  const apt = STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId);
  const aptLabel = apt ? `${apt.designation} (${apt.name})` : frame.targetApartmentId;

  const pairs: Array<{ key: string; value: string }> = [
    { key: 'Title', value: frame.title },
    { key: 'Stage18_Frame_ID', value: frame.id },
    { key: 'Stage18_Apartment_Zone', value: aptLabel },
    { key: 'Stage18_Pipeline_Role', value: ROLE_LABELS[frame.role].label },
    { key: 'SMPTE_Timecode', value: frame.smpteTimecode },
    { key: 'Focal_Length_mm', value: `${frame.focalLengthMm}mm` },
    { key: 'Sensor_Gate', value: '24.89x18.67mm Mitchell BNC (1.66:1 Paramount VistaVision)' },
    { key: 'Sampled_Key_Hex', value: frame.sampledKeyColorHex },
    { key: 'Sampled_Shadow_Hex', value: frame.sampledShadowColorHex },
    { key: 'Kelvin_Estimate', value: `${frame.kelvinEstimate}K` },
    {
      key: 'Temporal_Median_Stack',
      value: frame.useTemporalMedianStack
        ? `Enabled (${frame.durationWindowSec}s FFmpeg tmix)`
        : 'Disabled (Single Frame Grab)'
    },
    { key: 'Scene_Context', value: frame.sceneContext || 'Not specified' },
    {
      key: 'Architectural_Feature',
      value: frame.architecturalFeatureHighlighted || 'Not specified'
    },
    { key: 'Lighting_Notes', value: frame.lightingNotes || 'Not specified' },
    { key: 'Engineering_Notes', value: frame.notes || 'Not specified' }
  ];

  if (frame.customMetadata && frame.customMetadata.length > 0) {
    frame.customMetadata.forEach((meta) => {
      pairs.push({
        key: `Custom_${meta.key.replace(/[^A-Za-z0-9_-]/g, '_')}`,
        value: meta.value
      });
    });
  }

  // Serialized JSON string for 1-line Blender Python ingestion
  pairs.push({
    key: 'Blender_Asset_JSON',
    value: JSON.stringify({
      id: frame.id,
      title: frame.title,
      smpteTimecode: frame.smpteTimecode,
      role: frame.role,
      targetApartmentId: frame.targetApartmentId,
      focalLengthMm: frame.focalLengthMm,
      sampledKeyColorHex: frame.sampledKeyColorHex,
      sampledShadowColorHex: frame.sampledShadowColorHex,
      kelvinEstimate: frame.kelvinEstimate,
      sceneContext: frame.sceneContext,
      architecturalFeatureHighlighted: frame.architecturalFeatureHighlighted,
      lightingNotes: frame.lightingNotes,
      notes: frame.notes,
      customMetadata: frame.customMetadata || []
    })
  });

  return pairs;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) {
        break;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }
  return lines;
}

// ============================================================================
// High-Resolution Reference Plate Canvas Renderer (2K 1920x1152 or 4K 3840x2304)
// Draws either the user's loaded 4K frame or a high-detail architectural plate,
// plus an optional studio-grade Blender Asset Technical Slate burn-in.
// ============================================================================
function renderHighResReferenceCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: CuratedReferenceFrame,
  loadedImg: HTMLImageElement | null,
  overlayMode: ExportOverlayMode
) {
  const scale = width / 1920;
  const apt = STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId);
  const aptDesignation = apt?.designation || 'STAGE 18 · GREENWICH VILLAGE COURTYARD';

  ctx.clearRect(0, 0, width, height);

  if (loadedImg) {
    // Draw uploaded 4K still preserving aspect cover
    ctx.drawImage(loadedImg, 0, 0, width, height);
  } else {
    // High-resolution procedural architectural reference plate matching Stage 18 brickwork & optics
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, frame.sampledShadowColorHex);
    bgGrad.addColorStop(0.55, '#3b2318');
    bgGrad.addColorStop(1, frame.sampledKeyColorHex);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Architectural brick course lines (scaled to resolution)
    const coursePitch = Math.max(8, Math.round(22 * scale));
    ctx.fillStyle = 'rgba(14, 18, 26, 0.42)';
    for (let y = 0; y < height; y += coursePitch) {
      ctx.fillRect(0, y, width, Math.max(2, Math.round(2.5 * scale)));
    }

    // Vertical mortar joints staggered every course
    ctx.fillStyle = 'rgba(14, 18, 26, 0.25)';
    const brickW = Math.round(64 * scale);
    for (let row = 0, y = 0; y < height; row++, y += coursePitch) {
      const offset = (row % 2) * (brickW / 2);
      for (let x = offset; x < width; x += brickW) {
        ctx.fillRect(x, y, Math.max(1, Math.round(2 * scale)), coursePitch);
      }
    }

    // Perspective vanishing reference grid for fSpy / architectural alignment
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.16)';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    const centerX = width * 0.5;
    const centerY = height * 0.44;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX + i * 220 * scale, 0);
      ctx.lineTo(centerX + i * 165 * scale, height);
      ctx.stroke();
    }

    // Double-hung sash windows scaled to focal length
    const winCols = frame.focalLengthMm >= 135 ? 1 : 3;
    const winW = (frame.focalLengthMm >= 135 ? 580 : 310) * scale;
    const winH = (frame.focalLengthMm >= 135 ? 490 : 390) * scale;
    const gap = 96 * scale;

    for (let i = 0; i < winCols; i++) {
      const wx = width / 2 - ((winCols * (winW + gap) - gap) / 2) + i * (winW + gap);
      const wy = centerY - winH / 2;

      // Cast-stone header lintel & projecting sill
      ctx.fillStyle = '#d6d3d1';
      ctx.fillRect(wx - 22 * scale, wy - 34 * scale, winW + 44 * scale, 26 * scale);
      ctx.fillRect(wx - 28 * scale, wy + winH + 6 * scale, winW + 56 * scale, 20 * scale);

      // Interior room illumination gradient
      const winGrad = ctx.createRadialGradient(
        wx + winW / 2,
        wy + winH / 2,
        24 * scale,
        wx + winW / 2,
        wy + winH / 2,
        winW * 0.95
      );
      winGrad.addColorStop(0, frame.sampledKeyColorHex);
      winGrad.addColorStop(1, frame.sampledShadowColorHex);
      ctx.fillStyle = winGrad;
      ctx.fillRect(wx, wy, winW, winH);

      // Timber sash frame & check-rail
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 10 * scale;
      ctx.strokeRect(wx, wy, winW, winH);
      ctx.beginPath();
      ctx.moveTo(wx, wy + winH * 0.48);
      ctx.lineTo(wx + winW, wy + winH * 0.48);
      ctx.stroke();

      // Vertical muntin bar
      ctx.lineWidth = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(wx + winW * 0.5, wy);
      ctx.lineTo(wx + winW * 0.5, wy + winH);
      ctx.stroke();
    }

    // Subtle 1.66:1 Mitchell BNC optical crosshair in center
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 28 * scale, centerY);
    ctx.lineTo(width / 2 + 28 * scale, centerY);
    ctx.moveTo(width / 2, centerY - 28 * scale);
    ctx.lineTo(width / 2, centerY + 28 * scale);
    ctx.stroke();
  }

  // If Annotated Blender Technical Slate is active, draw structured metadata burn-in HUD
  if (overlayMode === 'annotated_slate') {
    // Top-left & top-right optical header bar
    const topBarH = Math.round(54 * scale);
    ctx.fillStyle = 'rgba(11, 13, 17, 0.88)';
    ctx.fillRect(0, 0, width, topBarH);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, topBarH - Math.max(2, Math.round(2 * scale)), width, Math.max(2, Math.round(2 * scale)));

    ctx.font = `600 ${Math.round(19 * scale)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(
      `STAGE 18 BLENDER ASSET PLATE  ·  SMPTE ${frame.smpteTimecode}  ·  ${frame.focalLengthMm}mm LENS  ·  ${ROLE_LABELS[frame.role].shortCode}`,
      Math.round(28 * scale),
      Math.round(34 * scale)
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(
      `${aptDesignation}  ·  ${width}x${height} (1.66:1)`,
      width - Math.round(28 * scale),
      Math.round(34 * scale)
    );
    ctx.textAlign = 'left';

    // Bottom technical metadata slate panel
    const slateH = Math.round(250 * scale);
    const slateY = height - slateH;
    ctx.fillStyle = 'rgba(11, 13, 17, 0.92)';
    ctx.fillRect(0, slateY, width, slateH);

    // Top border of bottom slate
    ctx.fillStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.fillRect(0, slateY, width, Math.max(2, Math.round(3 * scale)));

    const padX = Math.round(28 * scale);
    const row1Y = slateY + Math.round(38 * scale);

    // Frame Title
    ctx.font = `700 ${Math.round(24 * scale)}px "Outfit", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(frame.title, padX, row1Y);

    // Right side of Row 1: Colorimetric Swatches & Kelvin
    const swatchSize = Math.round(22 * scale);
    const rightBlockX = width - Math.round(560 * scale);

    ctx.fillStyle = frame.sampledKeyColorHex;
    ctx.fillRect(rightBlockX, row1Y - swatchSize + 4 * scale, swatchSize, swatchSize);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(1, 1.5 * scale);
    ctx.strokeRect(rightBlockX, row1Y - swatchSize + 4 * scale, swatchSize, swatchSize);

    ctx.font = `500 ${Math.round(17 * scale)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(
      `KEY ${frame.sampledKeyColorHex} (${frame.kelvinEstimate}K)`,
      rightBlockX + swatchSize + Math.round(10 * scale),
      row1Y
    );

    const shadowSwatchX = rightBlockX + Math.round(290 * scale);
    ctx.fillStyle = frame.sampledShadowColorHex;
    ctx.fillRect(shadowSwatchX, row1Y - swatchSize + 4 * scale, swatchSize, swatchSize);
    ctx.strokeRect(shadowSwatchX, row1Y - swatchSize + 4 * scale, swatchSize, swatchSize);
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(
      `SHADOW ${frame.sampledShadowColorHex}`,
      shadowSwatchX + swatchSize + Math.round(10 * scale),
      row1Y
    );

    // 3-Column Structured Metadata Grid in Slate
    const colY = slateY + Math.round(76 * scale);
    const colW = Math.round((width - padX * 2 - 48 * scale) / 3);
    const colGap = Math.round(24 * scale);

    const columns = [
      {
        heading: 'SCENE CONTEXT',
        body: frame.sceneContext || 'Not specified'
      },
      {
        heading: 'ARCHITECTURAL FEATURE HIGHLIGHTED',
        body: frame.architecturalFeatureHighlighted || 'Not specified'
      },
      {
        heading: 'LIGHTING & CYCLES NOTES',
        body: frame.lightingNotes || 'Not specified'
      }
    ];

    columns.forEach((col, idx) => {
      const cx = padX + idx * (colW + colGap);
      ctx.font = `600 ${Math.round(14 * scale)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(col.heading, cx, colY);

      ctx.font = `400 ${Math.round(16 * scale)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#E2E8F0';
      const lines = wrapCanvasText(ctx, col.body, colW, 3);
      lines.forEach((line, lineIdx) => {
        ctx.fillText(line, cx, colY + Math.round((24 + lineIdx * 22) * scale));
      });
    });

    // Bottom Footer Line: Custom Metadata Attributes + Extraction Method
    const footerY = height - Math.round(22 * scale);
    ctx.font = `500 ${Math.round(15 * scale)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#94A3B8';

    const customTagsStr =
      frame.customMetadata && frame.customMetadata.length > 0
        ? frame.customMetadata.map((m) => `${m.key}: ${m.value}`).join('  ·  ')
        : 'No custom key-value tags';
    const stackMethod = frame.useTemporalMedianStack
      ? `FFmpeg tmix (${frame.durationWindowSec}s Temporal Median Stack)`
      : 'Single-Frame Lossless Extraction';

    const footerLine = `PIPELINE: ${stackMethod}  |  TAGS: ${customTagsStr}`;
    ctx.fillText(footerLine.slice(0, 145), padX, footerY);
  }
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
  // Map of per-frame uploaded image data URLs
  const [uploadedImagesByFrameId, setUploadedImagesByFrameId] = useState<Record<string, string>>(
    {}
  );
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);

  // High-Resolution PNG Export Configuration State
  const [exportResolution, setExportResolution] =
    useState<ExportResolutionMode>('2k_1920x1152');
  const [exportOverlayMode, setExportOverlayMode] =
    useState<ExportOverlayMode>('annotated_slate');
  const [includeSidecarJson, setIncludeSidecarJson] = useState<boolean>(false);
  const [exportStatusBanner, setExportStatusBanner] = useState<string | null>(null);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

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

  const activeUploadedImageUrl = selectedFrame
    ? uploadedImagesByFrameId[selectedFrame.id] || null
    : null;

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

    if (activeUploadedImageUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = activeUploadedImageUrl;
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
  }, [selectedFrame, activeUploadedImageUrl]);

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
    if (!file || !selectedFrame) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setUploadedImagesByFrameId((prev) => ({
          ...prev,
          [selectedFrame.id]: reader.result as string
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // Export Single or Batch Curated Reference Frame(s) to High-Resolution PNG
  // with Embedded PNG tEXt Metadata Chunks + Optional Sidecar .json
  // ============================================================================
  const exportSingleFrameToPng = async (
    frame: CuratedReferenceFrame,
    resMode: ExportResolutionMode = exportResolution,
    overlay: ExportOverlayMode = exportOverlayMode,
    withSidecar: boolean = includeSidecarJson
  ) => {
    setIsExportingPng(true);
    try {
      const width = resMode === '4k_3840x2304' ? 3840 : 1920;
      const height = resMode === '4k_3840x2304' ? 2304 : 1152;

      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      const frameUploadedUrl = uploadedImagesByFrameId[frame.id] || null;
      let loadedImg: HTMLImageElement | null = null;

      if (frameUploadedUrl) {
        loadedImg = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = frameUploadedUrl;
        });
      }

      renderHighResReferenceCanvas(ctx, width, height, frame, loadedImg, overlay);

      const rawBlob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob((b) => resolve(b), 'image/png')
      );
      if (!rawBlob) return;

      const rawBuffer = await rawBlob.arrayBuffer();
      const metadataPairs = buildPngEmbeddedMetadataPairs(frame);
      const taggedPngBytes = injectPngTextChunks(rawBuffer, metadataPairs);

      const finalBlob = new Blob([taggedPngBytes.buffer as ArrayBuffer], { type: 'image/png' });
      const filename = buildBlenderPipelineFilename(frame, overlay);

      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      if (withSidecar) {
        const apt = STAGE18_APARTMENTS.find((ap) => ap.id === frame.targetApartmentId);
        const sidecarPayload = {
          schema: 'stage18.blender.reference_frame.v1',
          exportedAt: new Date().toISOString(),
          imageFile: filename,
          resolution: { width, height, aspect: 1.66 },
          overlayMode: overlay,
          frameMetadata: {
            ...frame,
            apartmentDesignation: apt?.designation || frame.targetApartmentId,
            roleLabel: ROLE_LABELS[frame.role].label
          }
        };
        const jsonBlob = new Blob([JSON.stringify(sidecarPayload, null, 2)], {
          type: 'application/json'
        });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const ja = document.createElement('a');
        ja.href = jsonUrl;
        ja.download = filename.replace(/\.png$/i, '.blender_meta.json');
        document.body.appendChild(ja);
        ja.click();
        document.body.removeChild(ja);
        URL.revokeObjectURL(jsonUrl);
      }

      setExportStatusBanner(
        `Exported ${filename} (${width}×${height} PNG with ${metadataPairs.length} embedded PNG tEXt metadata chunks)`
      );
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleBatchExportPinnedFrames = async () => {
    const pinned = curatedFrames.filter((f) => f.includedInExport);
    if (pinned.length === 0) return;
    for (let i = 0; i < pinned.length; i++) {
      await exportSingleFrameToPng(pinned[i]);
      await new Promise((r) => setTimeout(r, 180));
    }
    setExportStatusBanner(
      `Batch exported ${pinned.length} pinned reference frames as metadata-tagged PNGs for Blender.`
    );
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

  const previewFilename = selectedFrame
    ? buildBlenderPipelineFilename(selectedFrame, exportOverlayMode)
    : '';
  const previewEmbeddedChunks = selectedFrame
    ? buildPngEmbeddedMetadataPairs(selectedFrame)
    : [];

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8 space-y-8">
      {/* Header & Value Summary */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <p className="text-xs font-mono text-amber-400">
            PHASE 1 &amp; 3.1 OPTIMIZATION · USER-GUIDED HERO FRAME SELECTION &amp; PNG ASSET EXPORT
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white font-display mt-1">
            Representative Hero Frame Curator &amp; Colorimetric Sampler
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl mt-2 leading-relaxed">
            Annotate each representative frame with structured engineering metadata—including{' '}
            <span className="text-white font-medium">Scene Context</span>,{' '}
            <span className="text-white font-medium">Architectural Feature Highlighted</span>,{' '}
            <span className="text-white font-medium">Lighting Notes</span>, and custom key-value
            specifications. Export high-resolution local PNG plates with embedded binary{' '}
            <code className="text-amber-300">tEXt</code> metadata chunks and standardized Blender
            asset filenames.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          <div className="text-right text-xs text-slate-400 font-mono">
            <div className="text-slate-200 font-semibold">
              {includedCount} of {curatedFrames.length} Frames Active in Pipeline
            </div>
            <div>Est. Extraction Disk Footprint: ~{includedCount * 42} MB (vs. 6.8 TB full dump)</div>
          </div>
          <button
            onClick={handleBatchExportPinnedFrames}
            disabled={isExportingPng || includedCount === 0}
            className="px-3.5 py-2.5 text-xs font-semibold bg-[#161C28] text-amber-300 border border-amber-500/40 rounded-lg hover:bg-amber-500/15 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Batch Export {includedCount} Pinned PNGs
          </button>
          <button
            onClick={onNavigateToScripts}
            className="px-4 py-2.5 text-xs font-semibold bg-amber-500 text-slate-950 rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
          >
            Compile FFmpeg &amp; Blender Scripts →
          </button>
        </div>
      </div>

      {/* Export Confirmation Banner */}
      {exportStatusBanner && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 font-mono">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportStatusBanner}</span>
          </div>
          <button
            onClick={() => setExportStatusBanner(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* Main 2-Column Split: Left = Curated Frame List | Right = Interactive Sampler, PNG Exporter & Add Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Curated Frames List with Inline Metadata & Notes Editor */}
        <div className="lg:col-span-7 space-y-4">
          {filteredFrames.map((frame) => {
            const apt = STAGE18_APARTMENTS.find((a) => a.id === frame.targetApartmentId);
            const isSelected = selectedFrame?.id === frame.id;
            const isEditing = editingFrameId === frame.id;
            const frameFilename = buildBlenderPipelineFilename(frame, exportOverlayMode);

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
                    className="flex items-center gap-2 shrink-0 flex-wrap justify-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => exportSingleFrameToPng(frame)}
                      disabled={isExportingPng}
                      title={`Export ${frameFilename}`}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Frame to PNG
                    </button>

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
                        Custom Frame Metadata Attributes (Embedded in PNG tEXt Chunks, Blender Camera &amp; fSpy JSON)
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

                    {/* Standardized Blender Asset Export Label Preview */}
                    <div className="pt-1 text-[11px] font-mono text-slate-400 flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-400">Blender Asset File:</span>
                      <span className="text-slate-200 truncate">{frameFilename}</span>
                    </div>
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

        {/* Right Column (5 cols): Interactive Frame Color Sampler, High-Res PNG Exporter + Add Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Interactive Color & Kelvin Sampler + High-Resolution PNG Exporter Panel */}
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
                  {activeUploadedImageUrl ? 'Replace 4K Still' : 'Load Local 4K Still'}
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
                script and PNG metadata chunks.
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
                <div className="flex items-center gap-1.5 flex-wrap">
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

              {/* High-Resolution PNG Export & Blender Asset Labeling Controls */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    EXPORT FRAME TO PNG · BLENDER ASSET PIPELINE
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {previewEmbeddedChunks.length} PNG tEXt Chunks
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Output Resolution (1.66:1)</label>
                    <select
                      value={exportResolution}
                      onChange={(e) =>
                        setExportResolution(e.target.value as ExportResolutionMode)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                    >
                      <option value="2k_1920x1152">2K Reference (1920×1152)</option>
                      <option value="4k_3840x2304">4K Master Plate (3840×2304)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Metadata Labeling Mode</label>
                    <select
                      value={exportOverlayMode}
                      onChange={(e) =>
                        setExportOverlayMode(e.target.value as ExportOverlayMode)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0D11] border border-white/15 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      <option value="annotated_slate">
                        Technical Slate Burn-In + PNG tEXt
                      </option>
                      <option value="clean_plate">
                        Clean Camera Plate + PNG tEXt Only
                      </option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSidecarJson}
                    onChange={(e) => setIncludeSidecarJson(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  <span>
                    Also download companion <code className="text-amber-300">.blender_meta.json</code>{' '}
                    sidecar file
                  </span>
                </label>

                {/* Preview of Standardized Filename & Embedded PNG Chunks */}
                <div className="p-2.5 rounded-lg bg-[#0B0D11] border border-white/10 space-y-1.5 text-[11px] font-mono">
                  <div className="text-slate-400">
                    Target Filename:{' '}
                    <span className="text-amber-300 break-all">{previewFilename}</span>
                  </div>
                  <div className="text-slate-400 leading-relaxed">
                    Embedded PNG <code className="text-slate-200">tEXt</code> Keys:{' '}
                    <span className="text-slate-300">
                      SMPTE_Timecode, Stage18_Apartment_Zone, Stage18_Pipeline_Role, Focal_Length_mm,
                      Scene_Context, Architectural_Feature, Lighting_Notes, Sampled_Key_Hex,
                      Kelvin_Estimate, Blender_Asset_JSON
                      {selectedFrame.customMetadata && selectedFrame.customMetadata.length > 0
                        ? `, +${selectedFrame.customMetadata.length} Custom Tags`
                        : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => exportSingleFrameToPng(selectedFrame)}
                  disabled={isExportingPng}
                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {isExportingPng
                    ? 'Encoding High-Res PNG & Metadata Chunks...'
                    : `Export Frame to PNG (${
                        exportResolution === '4k_3840x2304' ? '3840×2304' : '1920×1152'
                      })`}
                </button>
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
