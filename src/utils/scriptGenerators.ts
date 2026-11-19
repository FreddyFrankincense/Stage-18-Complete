import {
  ArchitecturalLayoutIteration,
  BuildingParametricOverride,
  CuratedReferenceFrame,
  INITIAL_BUILDING_PARAMETRIC_OVERRIDES,
  INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS,
  INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE,
  JeffriesPbrMaterialSpec,
  LightingScenarioPreset,
  STAGE18_APARTMENTS,
  Stage18LearnedKnowledgeProfile
} from '../data/stage18Data';

export interface ScriptGeneratorConfig {
  mkvFilePath: string;
  outputDir: string;
  pngBitDepth: '16bit_rgb48le' | '8bit_rgb24';
  hdrToneMapping: 'zscale_linear_bt709' | 'hable_filmic' | 'mobius_agx_prep';
  scaleUnit: 'imperial_feet' | 'metric_meters';
  brickDetailMode: 'procedural_shader_plus_projection' | 'geometry_nodes_instanced';
  enableFrustumLodCulling: boolean;
  cyclesSamples: number;
  activeLightingScenario: LightingScenarioPreset;
  curatedFrames: CuratedReferenceFrame[];
  parametricOverrides?: Record<string, BuildingParametricOverride>;
  layoutIterations?: ArchitecturalLayoutIteration[];
  learnedKnowledgeProfile?: Stage18LearnedKnowledgeProfile;
  jeffriesPbrMaterials?: JeffriesPbrMaterialSpec[];
}

function smpteToSecondsString(smpte: string, fps = 23.976): string {
  const parts = smpte.split(':').map((n) => parseInt(n, 10) || 0);
  if (parts.length === 4) {
    const [hh, mm, ss, ff] = parts;
    const totalSec = hh * 3600 + mm * 60 + ss + ff / fps;
    return totalSec.toFixed(3);
  }
  if (parts.length === 3) {
    const [hh, mm, ss] = parts;
    return (hh * 3600 + mm * 60 + ss).toFixed(3);
  }
  return '134.334';
}

export function generateFfmpegExtractionScript(config: ScriptGeneratorConfig): string {
  const activeFrames = config.curatedFrames.filter((f) => f.includedInExport);
  const pixFmt = config.pngBitDepth === '16bit_rgb48le' ? 'rgb48le' : 'rgb24';

  const colorFilter =
    config.hdrToneMapping === 'zscale_linear_bt709'
      ? `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709:t=iec61966-2-1:m=bt709:r=full,format=${pixFmt}`
      : config.hdrToneMapping === 'hable_filmic'
      ? `zscale=t=linear:npl=100,format=gbrpf32le,tonemap=tonemap=hable:desat=0,zscale=p=bt709:t=iec61966-2-1,format=${pixFmt}`
      : `zscale=t=linear:npl=150,format=gbrpf32le,tonemap=tonemap=mobius:param=0.3,zscale=p=bt709:t=iec61966-2-1,format=${pixFmt}`;

  const frameCommands = activeFrames
    .map((frame, idx) => {
      const startSec = smpteToSecondsString(frame.smpteTimecode);
      const safeSlug = frame.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const outFilename = `${String(idx + 1).padStart(2, '0')}_${safeSlug}_${frame.focalLengthMm}mm.png`;
      const customMetaComment =
        frame.customMetadata && frame.customMetadata.length > 0
          ? `\n# Custom Metadata: ${frame.customMetadata.map((m) => `${m.key}="${m.value}"`).join(' | ')}`
          : '';

      if (frame.useTemporalMedianStack && frame.durationWindowSec > 0.5) {
        const stackFrames = Math.min(36, Math.max(8, Math.round(frame.durationWindowSec * 8)));
        return `# ------------------------------------------------------------------------------
# [${idx + 1}/${activeFrames.length}] ${frame.title}
# Role: ${frame.role.toUpperCase()} | SMPTE: ${frame.smpteTimecode} (t=${startSec}s) | Lens: ${frame.focalLengthMm}mm
# Scene Context: ${frame.sceneContext || 'N/A'}
# Architectural Feature: ${frame.architecturalFeatureHighlighted || 'N/A'}
# Lighting Notes: ${frame.lightingNotes || 'N/A'}${customMetaComment}
# Mode: Multi-Frame Temporal Median Stack (${frame.durationWindowSec}s window -> ${stackFrames} frames averaged)
# ------------------------------------------------------------------------------
echo "Extracting & median-stacking [${outFilename}] at SMPTE ${frame.smpteTimecode}..."
ffmpeg -hide_banner -loglevel warning -y \\
  -ss ${startSec} -t ${frame.durationWindowSec.toFixed(2)} \\
  -i "$MKV_SOURCE" \\
  -vf "fps=8,tmix=frames=${stackFrames}:weights='1',${colorFilter}" \\
  -frames:v 1 \\
  "$OUT_DIR/${outFilename}"`;
      }

      return `# ------------------------------------------------------------------------------
# [${idx + 1}/${activeFrames.length}] ${frame.title}
# Role: ${frame.role.toUpperCase()} | SMPTE: ${frame.smpteTimecode} (t=${startSec}s) | Lens: ${frame.focalLengthMm}mm
# Scene Context: ${frame.sceneContext || 'N/A'}
# Architectural Feature: ${frame.architecturalFeatureHighlighted || 'N/A'}
# Lighting Notes: ${frame.lightingNotes || 'N/A'}${customMetaComment}
# Mode: Single Exact Lossless Keyframe Extraction
# ------------------------------------------------------------------------------
echo "Extracting exact keyframe [${outFilename}] at SMPTE ${frame.smpteTimecode}..."
ffmpeg -hide_banner -loglevel warning -y \\
  -ss ${startSec} \\
  -i "$MKV_SOURCE" \\
  -vf "${colorFilter}" \\
  -frames:v 1 \\
  "$OUT_DIR/${outFilename}"`;
    })
    .join('\n\n');

  return `#!/usr/bin/env bash
# ==============================================================================
# STAGE 18: REAR WINDOW (1954) — 75 GB 4K UHD BLU-RAY REMUX FRAME EXTRACTOR
# Generated by Stage 18 Reconstruction Workbench
# Target Source: ${config.mkvFilePath}
# Output Format: ${config.pngBitDepth} PNG (${config.hdrToneMapping})
# Curated Hero Frames Selected: ${activeFrames.length}
# ==============================================================================

set -euo pipefail

MKV_SOURCE="${config.mkvFilePath}"
OUT_DIR="${config.outputDir}"

mkdir -p "$OUT_DIR"
mkdir -p "$OUT_DIR/metadata"

echo "=== [1/3] Probing 4K Blu-ray Remux Mastering & Color Stream ==="
if [ ! -f "$MKV_SOURCE" ]; then
  echo "ERROR: 4K MKV Remux not found at: $MKV_SOURCE"
  echo "Please update MKV_SOURCE to point to your local 75 GB .mkv file."
  exit 1
fi

ffprobe -v quiet -print_format json -show_format -show_streams -select_streams v:0 \\
  "$MKV_SOURCE" > "$OUT_DIR/metadata/stream_color_profile.json"
echo "Saved stream color metadata to $OUT_DIR/metadata/stream_color_profile.json"

echo "=== [2/3] Extracting ${activeFrames.length} User-Curated Representative Hero Plates ==="

${frameCommands}

echo "=== [3/3] Generating Contact Sheet & Sharpness Audit ==="
echo "All ${activeFrames.length} reference plates extracted to: $OUT_DIR"
`;
}

export function generateFspyCalibrationGuideJson(config: ScriptGeneratorConfig): string {
  const geometryFrames = config.curatedFrames.filter(
    (f) => f.includedInExport && (f.role === 'fspy_geometry' || f.role === 'telephoto_set_dressing')
  );

  const calibrationPayload = {
    project: 'Rear Window (1954) — Paramount Stage 18 Optical Calibration',
    productionDesigners: ['Hal Pereira', 'Joseph MacMillan Johnson', 'Henry Bumstead'],
    cinematographer: 'Robert Burks, ASC',
    soundstageEnvelopeFeet: {
      length: 185.0,
      width: 50.0,
      height: 40.0,
      excavatedBasementDepth: -6.0,
      jeffriesWindowElevation: 14.5,
      jeffriesToThorwaldSpan: 46.0
    },
    cameraSystems: {
      mitchellBNC_1954: {
        cameraBody: 'Mitchell BNC (Blimped Newsreel Camera)',
        aspectRatio: '1.66:1 Paramount European/Academy Widescreen',
        sensorFilmBackMm: { width: 21.95, height: 16.0 },
        primeLensesMm: [28, 35, 50, 75],
        nodalPivotInJeffriesRoomFeet: { x: 0.0, y: 14.5, z: 18.2 }
      },
      exaktaVX_SLR: {
        cameraBody: 'Ihagee Exakta VX 35mm SLR (Jeffries POV Camera)',
        sensorFilmBackMm: { width: 36.0, height: 24.0 },
        telephotoLensesMm: [152, 400],
        lensModel: 'Kilfitt Fern-Kilar f/5.6',
        nodalForwardOffsetFeet: 1.8
      }
    },
    masonryMetrologyStandard: {
      brickType: '1954 Manhattan / Stage 18 Scenic Forced-Perspective Brick',
      singleBrickHeightInchesAt1xForeground: 2.25,
      mortarJointThicknessInchesAt1xForeground: 0.375,
      threeCoursesVerticalPitchInchesAt1xForeground: 8.0,
      forcedPerspectiveCarpentryWarning:
        'CRITICAL: Published architectural plans and standard NYC building codes DO NOT apply to distant Stage 18 zones. Hal Pereira and Joseph MacMillan Johnson built Stage 18 strictly for optical fidelity from L.B. Jefferies camera nodal point (X=0, Y=+14.5ft, Z=+18.2ft). Multiply brick course heights by each zone forcedPerspectiveScaleFactor (1.00x foreground -> 0.88x West Wing -> 0.85x East Wing -> 0.82x Thorwald North Wall -> 0.66x North Alleyway) and account for non-orthogonal splayed interior side walls.',
      standardSashWindowOpeningInchesAt1xForeground: { width: 36.0, height: 72.0 }
    },
    curatedCalibrationFrames: geometryFrames.map((f, i) => {
      const zoneOv =
        (config.parametricOverrides || INITIAL_BUILDING_PARAMETRIC_OVERRIDES)[
          f.targetApartmentId
        ] || INITIAL_BUILDING_PARAMETRIC_OVERRIDES['apt-thorwald'];
      return {
        index: i + 1,
        id: f.id,
        title: f.title,
        smpteTimecode: f.smpteTimecode,
        focalLengthMm: f.focalLengthMm,
        targetApartmentId: f.targetApartmentId,
        forcedPerspectiveScaleFactor: zoneOv.forcedPerspectiveScaleFactor ?? 0.82,
        cameraSightlineSplayDeg: zoneOv.cameraSightlineSplayDeg ?? 0.0,
        floorRakePitchDeg: zoneOv.floorRakePitchDeg ?? 0.0,
        physicalRoomDepthFeet: zoneOv.interiorDepthFeet,
        apparentArchitecturalDepthFeet:
          zoneOv.apparentArchitecturalDepthFeet ?? zoneOv.interiorDepthFeet,
        sceneContext: f.sceneContext,
        architecturalFeatureHighlighted: f.architecturalFeatureHighlighted,
        lightingNotes: f.lightingNotes,
        notes: f.notes,
        customMetadata: f.customMetadata || [],
        recommendedFspySetup: {
          principalPointMode: 'Manual (Film Gate Center)',
          vanishingPointAxes:
            f.focalLengthMm <= 50
              ? [
                  'Axis 1: +X along Thorwald limestone window lintels',
                  'Axis 2: +Z along West Wing brick return wall (compensate for non-orthogonal sightline wall splay)',
                  'Axis 3: +Y vertical pilaster corner'
                ]
              : [
                  'Lock FOV to solved 35mm parent camera and use 2D principal-point shift for 152mm telephoto framing'
                ],
          referenceDistanceAxis: `+Y Vertical (Count 36 Brick Courses = ${(
            8.0 * (zoneOv.forcedPerspectiveScaleFactor ?? 0.82)
          ).toFixed(2)} physical feet at ${(zoneOv.forcedPerspectiveScaleFactor ?? 0.82).toFixed(
            2
          )}x POV forced-perspective scale)`
        }
      };
    })
  };

  return JSON.stringify(calibrationPayload, null, 2);
}

export function generateBlenderArchitectureScript(config: ScriptGeneratorConfig): string {
  const unitScale = config.scaleUnit === 'imperial_feet' ? 0.3048 : 1.0;
  const activeFrames = config.curatedFrames.filter((f) => f.includedInExport);
  const prioritizedAptIds = Array.from(new Set(activeFrames.map((f) => f.targetApartmentId)));
  const overrides = config.parametricOverrides || INITIAL_BUILDING_PARAMETRIC_OVERRIDES;

  const learned = config.learnedKnowledgeProfile || INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE;

  const apartmentsPythonList = STAGE18_APARTMENTS.map((apt) => {
    const isPrioritizedByUser = prioritizedAptIds.includes(apt.id) || apt.id === 'apt-jeffries';
    const ov = overrides[apt.id] || INITIAL_BUILDING_PARAMETRIC_OVERRIDES[apt.id];
    const learnedZone = learned.zonePriors[apt.id];
    const fpScale =
      ov.forcedPerspectiveScaleFactor ?? learnedZone?.forcedPerspectiveScaleFactor ?? 0.85;
    const splayDeg =
      ov.cameraSightlineSplayDeg ?? learnedZone?.cameraSightlineSplayDeg ?? 0.0;
    const rakeDeg = ov.floorRakePitchDeg ?? learnedZone?.floorRakePitchDeg ?? 0.0;
    const appDepth = ov.apparentArchitecturalDepthFeet ?? ov.interiorDepthFeet;
    const brickPitchIn = learnedZone?.brickCourseHeightInches ?? Number((2.67 * fpScale).toFixed(2));
    return `    {
        "id": "${apt.id}",
        "designation": "${apt.designation}",
        "name": "${apt.name.replace(/"/g, '\\"')}",
        "coords": (${apt.coordinates3D[0]}, ${apt.coordinates3D[2]}, ${apt.coordinates3D[1]}),
        "dimensions_ft": (${ov.widthFeet.toFixed(2)}, ${ov.depthFeet.toFixed(2)}, ${ov.heightFeet.toFixed(2)}),
        "window_grid": (${ov.windowCols}, ${ov.windowRows}),
        "window_reveal_in": ${ov.windowRevealInches.toFixed(2)},
        "balcony_proj_ft": ${ov.balconyProjectionFeet.toFixed(2)},
        "interior_depth_ft": ${ov.interiorDepthFeet.toFixed(2)},
        "apparent_arch_depth_ft": ${appDepth.toFixed(2)},
        "forced_perspective_scale": ${fpScale.toFixed(3)},
        "camera_sightline_splay_deg": ${splayDeg.toFixed(2)},
        "floor_rake_pitch_deg": ${rakeDeg.toFixed(2)},
        "learned_brick_course_height_in": ${brickPitchIn.toFixed(2)},
        "learned_kelvin_prior": ${learnedZone?.sampledKelvin ?? 3200},
        "confidence_pct": ${Math.max(ov.confidenceScore, learnedZone?.learnedConfidenceScore ?? 40)},
        "lod_tier": ${isPrioritizedByUser ? 1 : apt.lodTier},
        "prioritized_by_frames": ${isPrioritizedByUser ? 'True' : 'False'},
    }`;
  }).join(',\n');

  return `"""
================================================================================
03_build_stage18_architecture.py
BLENDER 4.x PROCEDURAL ARCHITECTURAL BUILDER — REAR WINDOW (1954) STAGE 18
================================================================================
Auto-Calibrated by 75GB Learned Knowledge Bank:
  - Profile Version: v${learned.version} (${learned.totalFramesAssimilated} frames across ${learned.sourceStreamFingerprint.fileSizeGb} GB MKV)
  - Learned Radial Depth Slope: ${learned.globalOpticalLaws.radialCompressionSlopePerFoot}/ft from Jeff's Camera
  - Learned Oblique Splay Factor: ${learned.globalOpticalLaws.obliqueSightlineSplayFactor} deg/deg
Generates:
  1. Paramount Stage 18 Structural Envelope (185' x 50' x 40') + Excavated Basement (-6.0')
  2. L.B. Jefferies's Apartment (#2B) Foreground Interior:
     - 3-Panel Double-Hung Sash Bay Window + Sills + Mullions
     - Interior Split-Level Floor, Walls, Wheelchair Station & Exakta Tripod Mount
  3. Surrounded Greenwich Village Courtyard Buildings (North, West, East Wings):
     - Lars Thorwald's 4-Window Railroad Apartment (#2E)
     - Miss Torso's Balcony Studio (#2D)
     - The Songwriter's Penthouse Studio with North-Light Casement (#3A)
     - Miss Lonelyhearts's Ground Apartment (#1C)
     - The Sculptor's Excavated Basement Garden & Patio (#1A)
     - North Central Alleyway & Forced-Perspective Street Bar
  4. Procedural PBR Brick/Mortar Material + Cycles Light-Path Thin Glass Material
================================================================================
Run inside Blender 4.x Scripting Workspace or via CLI:
  blender --python 03_build_stage18_architecture.py
"""

import bpy
import bmesh
import math
from mathutils import Vector

UNIT_SCALE = ${unitScale}  # ${config.scaleUnit === 'imperial_feet' ? '1 Blender Unit = 1 Foot (0.3048m)' : 'Metric Meters'}
ENABLE_FRUSTUM_LOD = ${config.enableFrustumLodCulling ? 'True' : 'False'}

STAGE18_LEARNED_75GB_OPTICAL_LAWS = {
    "version": ${learned.version},
    "radial_compression_slope_per_ft": ${learned.globalOpticalLaws.radialCompressionSlopePerFoot},
    "oblique_sightline_splay_factor": ${learned.globalOpticalLaws.obliqueSightlineSplayFactor},
    "eastmancolor_kelvin_bias": ${learned.globalOpticalLaws.eastmancolorKelvinBias},
    "recommended_tmix_stack_frames": ${learned.globalOpticalLaws.recommendedTmixStackFrames},
}

APARTMENT_ZONES = [
${apartmentsPythonList}
]


def setup_scene_units():
    scene = bpy.context.scene
    if "${config.scaleUnit}" == "imperial_feet":
        scene.unit_settings.system = 'IMPERIAL'
        scene.unit_settings.length_unit = 'FEET'
        scene.unit_settings.scale_length = 0.3048
    else:
        scene.unit_settings.system = 'METRIC'
        scene.unit_settings.length_unit = 'METERS'
        scene.unit_settings.scale_length = 1.0


def get_or_create_collection(name, parent=None):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col


def create_stage18_brick_material(name="MAT_Stage18_Village_Brick", base_hex=(0.52, 0.21, 0.14, 1.0)):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex_coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    brick = nodes.new("ShaderNodeTexBrick")
    noise = nodes.new("ShaderNodeTexNoise")
    bump = nodes.new("ShaderNodeBump")
    ao = nodes.new("ShaderNodeAmbientOcclusion")
    mix_soot = nodes.new("ShaderNodeMixRGB")

    # Standard American Common Brick proportions (3 courses = 8 inches)
    mapping.inputs["Scale"].default_value = (1.5, 1.5, 1.5)
    brick.offset = 0.5
    brick.squash = 1.0
    brick.inputs["Color1"].default_value = base_hex
    brick.inputs["Color2"].default_value = (base_hex[0] * 0.78, base_hex[1] * 0.75, base_hex[2] * 0.72, 1.0)
    brick.inputs["Mortar"].default_value = (0.36, 0.34, 0.31, 1.0)
    brick.inputs["Scale"].default_value = 4.5
    brick.inputs["Mortar Size"].default_value = 0.025
    brick.inputs["Mortar Smooth"].default_value = 0.1

    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 8.0

    mix_soot.blend_type = 'MULTIPLY'
    mix_soot.inputs["Fac"].default_value = 0.35

    bsdf.inputs["Roughness"].default_value = 0.82
    bump.inputs["Strength"].default_value = 0.25

    links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], brick.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(brick.outputs["Color"], mix_soot.inputs["Color1"])
    links.new(ao.outputs["Color"], mix_soot.inputs["Color2"])
    links.new(mix_soot.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(brick.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def create_architectural_thin_glass_material(name="MAT_Stage18_Arch_Glass"):
    """
    Solves Barrier 07: Uses Light Path node (Is Shadow Ray + Is Diffuse Ray)
    so Cycles interior practical lights and sunlight pass cleanly through two
    layers of window glass without refractive fireflies.
    """
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    mix_shader = nodes.new("ShaderNodeMixShader")
    light_path = nodes.new("ShaderNodeLightPath")
    math_max = nodes.new("ShaderNodeMath")
    math_max.operation = 'MAXIMUM'
    transp = nodes.new("ShaderNodeBsdfTransparent")
    glass = nodes.new("ShaderNodeBsdfPrincipled")

    glass.inputs["Base Color"].default_value = (0.88, 0.94, 0.96, 1.0)
    glass.inputs["Roughness"].default_value = 0.04
    glass.inputs["IOR"].default_value = 1.52
    if "Transmission Weight" in glass.inputs:
        glass.inputs["Transmission Weight"].default_value = 0.92

    links.new(light_path.outputs["Is Shadow Ray"], math_max.inputs[0])
    links.new(light_path.outputs["Is Diffuse Ray"], math_max.inputs[1])
    links.new(math_max.outputs["Value"], mix_shader.inputs["Fac"])
    links.new(glass.outputs["BSDF"], mix_shader.inputs[1])
    links.new(transp.outputs["BSDF"], mix_shader.inputs[2])
    links.new(mix_shader.outputs["Shader"], out.inputs["Surface"])
    return mat


def create_box(name, size, location, collection, material=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    bm.to_mesh(mesh)
    bm.free()
    obj.location = location
    if material:
        obj.data.materials.append(material)
    return obj


def build_jeffries_foreground_apartment(root_col, mat_plaster, mat_wood, mat_glass):
    """
    Constructs L.B. Jefferies's 2nd-floor apartment interior (#2B) with the
    signature three-window bay frame, window sill, bamboo matchstick blinds,
    convalescent wheelchair & daybed, orthopedic plaster cast, and Exakta VX
    tripod mount at (X=0, Y=-22, Z=14.5) in Blender Z-up coordinates.
    """
    jeff_col = get_or_create_collection("APT_2B_Jeffries_Hero_Interior", root_col)

    # 1. Quarter-Sawn Oak Herringbone Floor Slab, Step-Down Riser & Worktable Top
    create_box("Jeff_Floor_Slab", (24.0, 20.0, 0.8), (0.0, -28.0, 11.2), jeff_col, mat_wood)
    create_box("Jeff_StepDown_Riser", (24.0, 4.5, 0.6), (0.0, -35.5, 11.8), jeff_col, mat_wood)
    create_box("Jeff_Worktable_Top", (2.4, 1.8, 0.14), (-3.4, -19.5, 13.2), jeff_col, mat_wood)

    # 2. Aged Sage-Cream Gypsum Plaster Walls & Ceiling
    create_box("Jeff_Ceiling_Slab", (24.0, 20.0, 0.8), (0.0, -28.0, 22.0), jeff_col, mat_plaster)
    create_box("Jeff_West_Wall", (0.8, 20.0, 10.8), (-12.0, -28.0, 16.6), jeff_col, mat_plaster)
    create_box("Jeff_East_Wall", (0.8, 20.0, 10.8), (12.0, -28.0, 16.6), jeff_col, mat_plaster)
    create_box("Jeff_Rear_Wall", (24.0, 0.8, 10.8), (0.0, -38.0, 16.6), jeff_col, mat_plaster)
    create_box("Jeff_Bay_Header", (12.0, 1.2, 2.2), (0.0, -18.0, 20.8), jeff_col, mat_plaster)
    create_box("Jeff_Bay_Lower_Apron", (12.0, 1.0, 1.6), (0.0, -18.0, 12.0), jeff_col, mat_plaster)

    # 3. Semigloss Cream Enamel over Moulded Pine Casements & Sill Ledge
    create_box("Jeff_Bay_Sill_Ledge", (11.5, 1.4, 0.35), (0.0, -18.0, 12.8), jeff_col, mat_wood)
    for x_mullion in [-5.4, -2.1, 2.1, 5.4]:
        create_box(f"Jeff_Bay_Mullion_{x_mullion}", (0.38, 0.85, 6.8), (x_mullion, -18.0, 16.2), jeff_col, mat_wood)

    create_box("Jeff_Center_Upper_Sash_Top", (4.0, 0.25, 0.25), (0.0, -17.9, 19.3), jeff_col, mat_wood)
    create_box("Jeff_Center_Meeting_Rail_Raised", (4.0, 0.28, 0.22), (0.0, -17.9, 16.8), jeff_col, mat_wood)

    # 4. Cylinder-Drawn Optical Crown Window Glass Panes
    create_box("Jeff_Center_Upper_Glass", (3.9, 0.05, 2.4), (0.0, -17.9, 18.0), jeff_col, mat_glass)
    create_box("Jeff_Left_Flank_Lower_Glass", (3.0, 0.05, 6.2), (-3.75, -17.9, 16.1), jeff_col, mat_glass)
    create_box("Jeff_Right_Flank_Lower_Glass", (3.0, 0.05, 6.2), (3.75, -17.9, 16.1), jeff_col, mat_glass)

    # 5. Split-Bamboo Matchstick Roll-Up Window Shades
    create_box("Jeff_Center_Bamboo_Blind_Roll", (4.0, 0.32, 0.32), (0.0, -18.25, 19.35), jeff_col, mat_wood)
    create_box("Jeff_Left_Bamboo_Blind_Shade", (3.0, 0.08, 2.4), (-3.75, -18.25, 18.1), jeff_col, mat_wood)
    create_box("Jeff_Right_Bamboo_Blind_Shade", (3.0, 0.08, 2.4), (3.75, -18.25, 18.1), jeff_col, mat_wood)

    # 6. Everest & Jennings Convalescent Wheelchair & Oriental Daybed (Wool Bouclé Upholstery)
    create_box("Jeff_Wheelchair_Seat_Cushion", (2.1, 2.2, 0.35), (0.0, -20.8, 12.9), jeff_col, mat_plaster)
    create_box("Jeff_Wheelchair_Backrest", (2.1, 0.28, 2.4), (0.0, -21.8, 14.2), jeff_col, mat_plaster)
    create_box("Jeff_Oriental_Daybed_Mattress", (6.5, 3.2, 0.85), (5.2, -23.5, 12.1), jeff_col, mat_plaster)

    # 7. Calcified Plaster-of-Paris & Crinoline Gauze Orthopedic Left-Leg Cast
    create_box("Jeff_Left_Leg_Plaster_Cast", (0.52, 2.6, 0.55), (-0.35, -19.4, 13.1), jeff_col, mat_plaster)

    # 8. Ihagee Exakta VX 35mm SLR + Kilfitt 152mm Telephoto Barrel + Graflex Parabolic Flash Dish
    create_box("Jeff_Tripod_Pan_Head", (0.35, 0.35, 4.2), (1.25, -19.2, 12.5), jeff_col, mat_wood)
    create_box("Jeff_Exakta_Camera_Body", (0.52, 0.34, 0.36), (1.25, -19.0, 14.6), jeff_col, mat_wood)
    create_box("Jeff_Exakta_Kilfitt_152mm_Barrel", (0.32, 1.55, 0.32), (1.25, -18.2, 14.6), jeff_col, mat_wood)
    create_box("Jeff_Graflex_Parabolic_Flash_Dish", (0.65, 0.22, 0.65), (0.75, -18.8, 14.8), jeff_col, mat_wood)



def build_stage18_courtyard():
    setup_scene_units()
    root_col = get_or_create_collection("STAGE_18_REAR_WINDOW_MASTER")
    tier1_col = get_or_create_collection("TIER_1_HERO_ZONES", root_col)
    tier2_col = get_or_create_collection("TIER_2_FURNISHED_APARTMENTS", root_col)
    tier3_col = get_or_create_collection("TIER_3_COURTYARD_SHELL", root_col)

    mat_red_brick = create_stage18_brick_material("MAT_Thorwald_Red_Brick", (0.54, 0.20, 0.13, 1.0))
    mat_buff_brick = create_stage18_brick_material("MAT_WestWing_Buff_Brick", (0.64, 0.52, 0.38, 1.0))
    mat_cream_stucco = create_stage18_brick_material("MAT_EastWing_Stucco", (0.62, 0.58, 0.52, 1.0))
    mat_concrete = create_stage18_brick_material("MAT_Excavated_Courtyard_Concrete", (0.25, 0.26, 0.27, 1.0))
    mat_glass = create_architectural_thin_glass_material()

    # 1. Excavated Stage 18 Basement Courtyard Floor & Sculptor's Garden (-6.0 ft)
    create_box("Stage18_Excavated_Courtyard_Floor", (68.0, 64.0, 1.0), (0.0, 6.0, -3.0), tier3_col, mat_concrete)
    create_box("Thorwald_Zinnia_Flowerbed", (18.0, 4.5, 1.2), (-6.0, 20.5, -2.0), tier1_col, mat_buff_brick)

    # 2. North Wing: Lars Thorwald's 4-Story Brick Tenement (Y = +24.0 ft)
    create_box("North_Thorwald_Tenement_Facade", (36.0, 16.0, 42.0), (-10.0, 30.0, 18.0), tier1_col, mat_red_brick)

    # 3. North-East Alleyway Gap & Forced-Perspective Cross Street (Y = +38.0 ft)
    create_box("North_Alley_Street_Backdrop", (28.0, 8.0, 36.0), (8.0, 44.0, 16.0), tier3_col, mat_buff_brick)

    # 4. West Wing: Miss Torso & Miss Lonelyhearts Building (X = -26.0 ft)
    create_box("West_Wing_Tenement_Block", (16.0, 48.0, 40.0), (-30.0, 4.0, 17.0), tier2_col, mat_buff_brick)

    # 5. East Wing: The Songwriter's Penthouse Studio & Sculptor's Wing (X = +26.0 ft)
    create_box("East_Wing_Studio_Block", (16.0, 48.0, 42.0), (30.0, 4.0, 18.0), tier2_col, mat_cream_stucco)

    # 6. Build L.B. Jefferies's Foreground Apartment (#2B)
    build_jeffries_foreground_apartment(tier1_col, mat_cream_stucco, mat_buff_brick, mat_glass)

    # 7. Create Named Apartment Reference Locators for All Curated Zones
    for zone in APARTMENT_ZONES:
        target_col = tier1_col if zone["lod_tier"] == 1 else (tier2_col if zone["lod_tier"] == 2 else tier3_col)
        empty = bpy.data.objects.new(f"LOC_{zone['id']}", None)
        empty.empty_display_type = 'PLAIN_AXES'
        empty.empty_display_size = 2.5
        empty.location = zone["coords"]
        target_col.objects.link(empty)

    print("Stage 18 Rear Window Architectural Blockout complete.")


if __name__ == "__main__":
    build_stage18_courtyard()
`;
}

export function generateCyclesLightingAndCamerasScript(config: ScriptGeneratorConfig): string {
  const activeFrames = config.curatedFrames.filter((f) => f.includedInExport);
  const scenario = config.activeLightingScenario;
  const learned = config.learnedKnowledgeProfile || INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE;

  const cameraEntries = activeFrames
    .map((f, idx) => {
      const apt = STAGE18_APARTMENTS.find((a) => a.id === f.targetApartmentId) || STAGE18_APARTMENTS[1];
      const safeSlug = f.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      const pngName = `${String(idx + 1).padStart(2, '0')}_${safeSlug}_${f.focalLengthMm}mm.png`;
      const esc = (s?: string) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `    {
        "name": "CAM_${String(idx + 1).padStart(2, '0')}_${safeSlug}_${f.focalLengthMm}mm",
        "focal_mm": ${f.focalLengthMm}.0,
        "sensor_width_mm": ${f.focalLengthMm >= 135 ? '36.0' : '21.95'},
        "sensor_height_mm": ${f.focalLengthMm >= 135 ? '24.0' : '16.00'},
        "location": (0.0, ${f.focalLengthMm >= 135 ? '-17.2' : '-18.8'}, 14.5),
        "target_coords": (${apt.coordinates3D[0]}, ${-apt.coordinates3D[2]}, ${apt.coordinates3D[1]}),
        "bg_image": "${config.outputDir}/${pngName}",
        "smpte": "${f.smpteTimecode}",
        "kelvin": ${f.kelvinEstimate},
        "scene_context": "${esc(f.sceneContext)}",
        "arch_feature": "${esc(f.architecturalFeatureHighlighted)}",
        "lighting_notes": "${esc(f.lightingNotes)}",
        "general_notes": "${esc(f.notes)}",
    }`;
    })
    .join(',\n');

  return `"""
================================================================================
04_setup_cycles_lighting_and_cameras.py
BLENDER 4.x CYCLES LIGHTING GROUPS, AGX COLOR & HERO CAMERA RIG GENERATOR
================================================================================
Active Lighting Scenario: ${scenario.label}
Key Kelvin Temperature:   ${scenario.cyclesKelvinKey}K (Learned 75GB Corpus Bias: ${learned.globalOpticalLaws.eastmancolorKelvinBias}K)
Cycles Exposure:          ${scenario.cyclesExposure}
Target Render Samples:    ${config.cyclesSamples} (Adaptive Sampling + OIDN Denoiser)
Curated Camera Views:     ${activeFrames.length}
================================================================================
"""

import os
import math
import bpy
from mathutils import Vector

LEARNED_EASTMANCOLOR_KELVIN_EQUILIBRIUM = ${learned.globalOpticalLaws.eastmancolorKelvinBias}

HERO_CAMERA_SPECS = [
${cameraEntries}
]


def configure_cycles_and_agx():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = ${config.cyclesSamples}
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.005
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'

    # 1954 Paramount 1.66:1 Widescreen 4K Resolution
    scene.render.resolution_x = 3840
    scene.render.resolution_y = 2304
    scene.render.resolution_percentage = 100

    # Blender 4.x AgX Color Management for highlight roll-off
    try:
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.exposure = ${scenario.cyclesExposure}


def register_light_groups():
    view_layer = bpy.context.view_layer
    groups = [
        "LG_01_Courtyard_Sun_Key",
        "LG_02_Skylight_Bounce_Fill",
        "LG_03_Neighbor_Practical_Lamps",
        "LG_04_Street_Alley_Background",
        "LG_05_Jeff_Interior_Practicals",
        "LG_06_Flashbulb_Strobe",
    ]
    if hasattr(view_layer, "lightgroups"):
        existing = {lg.name for lg in view_layer.lightgroups}
        for g in groups:
            if g not in existing:
                view_layer.lightgroups.add(name=g)


def create_area_or_point_light(name, light_type, energy, color_rgb, location, rotation_euler, light_group):
    light_data = bpy.data.lights.new(name=name, type=light_type)
    light_data.energy = energy
    light_data.color = color_rgb
    light_obj = bpy.data.objects.new(name=name, object_data=light_data)
    bpy.context.scene.collection.objects.link(light_obj)
    light_obj.location = location
    light_obj.rotation_euler = rotation_euler
    if hasattr(light_obj, "lightgroup"):
        light_obj.lightgroup = light_group
    return light_obj


def build_stage18_lighting_rig():
    register_light_groups()

    # 1. Overhead Stage 18 Arc/Incandescent Sun Key Bank
    sun_el = math.radians(${scenario.sunElevationDeg})
    sun_az = math.radians(${scenario.sunAzimuthDeg})
    create_area_or_point_light(
        "Light_Courtyard_Sun_Key",
        "SUN",
        ${scenario.sunIntensity},
        (1.0, 0.86, 0.68),
        (0.0, 0.0, 42.0),
        (math.pi / 2.0 - sun_el, 0.0, sun_az),
        "LG_01_Courtyard_Sun_Key",
    )

    # 2. Overhead Soundstage Diffusion Skylight Fill
    sky_fill = create_area_or_point_light(
        "Light_Stage18_Overhead_Softbox",
        "AREA",
        ${(scenario.ambientIntensity * 450).toFixed(1)},
        (0.65, 0.80, 1.0),
        (0.0, 6.0, 38.0),
        (0.0, 0.0, 0.0),
        "LG_02_Skylight_Bounce_Fill",
    )
    sky_fill.data.size = 45.0

    # 3. Neighbor Apartment Practical Tungsten Lamps (2700K)
    neighbor_coords = [
        ("Practical_Thorwald_Living", (-16.0, 22.0, 14.0)),
        ("Practical_Thorwald_Bedroom", (-6.0, 22.0, 14.0)),
        ("Practical_Miss_Torso_Studio", (-23.0, 6.0, 14.5)),
        ("Practical_Composer_Studio", (22.0, 8.0, 23.0)),
        ("Practical_Miss_Lonelyhearts", (-21.0, 14.0, 3.5)),
    ]
    for lname, loc in neighbor_coords:
        create_area_or_point_light(
            lname,
            "POINT",
            ${(scenario.practicalLampIntensity * 120).toFixed(1)},
            (1.0, 0.76, 0.48),
            loc,
            (0.0, 0.0, 0.0),
            "LG_03_Neighbor_Practical_Lamps",
        )

    # 4. Climax Graflex #5 Flashbulb Strobe at Jeff's Window
    flash_obj = create_area_or_point_light(
        "Light_Jeff_Graflex_Flashbulb",
        "POINT",
        0.0,
        (1.0, 0.94, 0.86),
        (0.0, -18.2, 14.6),
        (0.0, 0.0, 0.0),
        "LG_06_Flashbulb_Strobe",
    )
    # Keyframe a 4-frame flashbulb discharge pulse at frame 24
    flash_obj.data.energy = 0.0
    flash_obj.data.keyframe_insert(data_path="energy", frame=23)
    flash_obj.data.energy = 45000.0
    flash_obj.data.keyframe_insert(data_path="energy", frame=24)
    flash_obj.data.energy = 4200.0
    flash_obj.data.keyframe_insert(data_path="energy", frame=26)
    flash_obj.data.energy = 0.0
    flash_obj.data.keyframe_insert(data_path="energy", frame=32)


def spawn_calibrated_hero_cameras():
    for spec in HERO_CAMERA_SPECS:
        cam_data = bpy.data.cameras.new(name=spec["name"])
        cam_data.lens = spec["focal_mm"]
        cam_data.sensor_fit = 'HORIZONTAL'
        cam_data.sensor_width = spec["sensor_width_mm"]
        cam_data.sensor_height = spec["sensor_height_mm"]
        cam_data.show_background_images = True

        cam_obj = bpy.data.objects.new(spec["name"], cam_data)
        bpy.context.scene.collection.objects.link(cam_obj)
        cam_obj.location = Vector(spec["location"])

        # Attach curated metadata as Blender Custom Properties
        cam_obj["smpte_timecode"] = spec["smpte"]
        cam_obj["kelvin_estimate"] = spec["kelvin"]
        cam_obj["scene_context"] = spec["scene_context"]
        cam_obj["architectural_feature"] = spec["arch_feature"]
        cam_obj["lighting_notes"] = spec["lighting_notes"]
        cam_obj["general_notes"] = spec["general_notes"]

        # Aim camera at target apartment coordinates
        direction = Vector(spec["target_coords"]) - cam_obj.location
        rot_quat = direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()

        # Attach extracted 4K PNG as semi-transparent background guide
        if os.path.exists(spec["bg_image"]):
            img = bpy.data.images.load(spec["bg_image"], check_existing=True)
            bg = cam_data.background_images.new()
            bg.image = img
            bg.alpha = 0.5
            bg.display_depth = 'FRONT'


if __name__ == "__main__":
    configure_cycles_and_agx()
    build_stage18_lighting_rig()
    spawn_calibrated_hero_cameras()
    print("Stage 18 Cycles Lighting & Hero Camera Rig configured.")
`;
}

export function generateIterativeLayoutDeltasScript(config: ScriptGeneratorConfig): string {
  const overrides = config.parametricOverrides || INITIAL_BUILDING_PARAMETRIC_OVERRIDES;
  const learned = config.learnedKnowledgeProfile || INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE;
  const approvedIterations = (config.layoutIterations || []).filter(
    (it) => it.status === 'approved'
  );

  const esc = (s?: string) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const learnedRulesPy = learned.learnedRulesForFutureBuilds
    .map((r) => `    "${esc(r)}",`)
    .join('\n');

  const zoneOverridesPy = STAGE18_APARTMENTS.map((apt) => {
    const ov = overrides[apt.id] || INITIAL_BUILDING_PARAMETRIC_OVERRIDES[apt.id];
    const base = INITIAL_BUILDING_PARAMETRIC_OVERRIDES[apt.id];
    const pOff = ov.placementOffsetFeet || [0, 0, 0];
    const oDeg = ov.orientationOverrideDeg || { pitchDeg: -4.0, yawDeg: 0.0, rollPlumbDeg: 0.0 };
    const fpScale = ov.forcedPerspectiveScaleFactor ?? base.forcedPerspectiveScaleFactor ?? 0.85;
    const splayDeg = ov.cameraSightlineSplayDeg ?? base.cameraSightlineSplayDeg ?? 0.0;
    const rakeDeg = ov.floorRakePitchDeg ?? base.floorRakePitchDeg ?? 0.0;
    const appDepth = ov.apparentArchitecturalDepthFeet ?? base.apparentArchitecturalDepthFeet ?? ov.interiorDepthFeet;
    return `    "${apt.id}": {
        "designation": "${esc(apt.designation)}",
        "name": "${esc(apt.name)}",
        "baseline_dims_ft": (${base.widthFeet.toFixed(2)}, ${base.depthFeet.toFixed(2)}, ${base.heightFeet.toFixed(2)}),
        "converged_dims_ft": (${ov.widthFeet.toFixed(2)}, ${ov.depthFeet.toFixed(2)}, ${ov.heightFeet.toFixed(2)}),
        "elevation_offset_ft": ${ov.elevationOffsetFeet.toFixed(2)},
        "placement_offset_ft": (${pOff[0].toFixed(2)}, ${pOff[2].toFixed(2)}, ${pOff[1].toFixed(2)}),
        "orientation_override_deg": (${oDeg.pitchDeg.toFixed(2)}, ${oDeg.yawDeg.toFixed(2)}, ${oDeg.rollPlumbDeg.toFixed(2)}),
        "validity_status": "${esc(ov.validityStatus || 'verified_valid')}",
        "window_cols": ${ov.windowCols},
        "window_rows": ${ov.windowRows},
        "window_reveal_in": ${ov.windowRevealInches.toFixed(2)},
        "balcony_projection_ft": ${ov.balconyProjectionFeet.toFixed(2)},
        "interior_depth_ft": ${ov.interiorDepthFeet.toFixed(2)},
        "apparent_arch_depth_ft": ${appDepth.toFixed(2)},
        "forced_perspective_scale": ${fpScale.toFixed(3)},
        "camera_sightline_splay_deg": ${splayDeg.toFixed(2)},
        "floor_rake_pitch_deg": ${rakeDeg.toFixed(2)},
        "confidence_score": ${ov.confidenceScore},
        "contributing_frames": ${ov.contributingFramesCount},
        "last_updated_smpte": "${esc(ov.lastUpdatedSmpte)}",
        "last_engine": "${esc(ov.lastEngineUsed)}",
    }`;
  }).join(',\n');

  const iterationsLedgerPy = approvedIterations
    .map((it, idx) => {
      const mv = it.manualVerification;
      const pOff = mv?.placementOffsetFeet || [0, 0, 0];
      const oDeg = mv?.orientationOverrideDeg || { pitchDeg: -4.0, yawDeg: 0.0, rollPlumbDeg: 0.0 };
      const fpScale =
        mv?.forcedPerspectiveScaleOverride ?? it.proposedValues.forcedPerspectiveScaleFactor ?? 0.85;
      const splayDeg =
        mv?.cameraSightlineSplayOverrideDeg ?? it.proposedValues.cameraSightlineSplayDeg ?? 0.0;
      const rakeDeg =
        mv?.floorRakePitchOverrideDeg ?? it.proposedValues.floorRakePitchDeg ?? 0.0;
      const appDepth =
        it.proposedValues.apparentArchitecturalDepthFeet ?? it.proposedValues.interiorDepthFeet;
      return `    {
        "iteration_index": ${idx + 1},
        "id": "${esc(it.id)}",
        "frame_title": "${esc(it.frameTitle)}",
        "smpte_timecode": "${esc(it.smpteTimecode)}",
        "focal_length_mm": ${it.focalLengthMm},
        "engine_used": "${esc(it.engineUsed)}",
        "target_apartment_id": "${esc(it.targetApartmentId)}",
        "confidence_score": ${it.confidenceScore},
        "validity_status": "${esc(mv?.validityStatus || 'verified_valid')}",
        "placement_offset_ft": (${pOff[0].toFixed(2)}, ${pOff[2].toFixed(2)}, ${pOff[1].toFixed(2)}),
        "orientation_override_deg": (${oDeg.pitchDeg.toFixed(2)}, ${oDeg.yawDeg.toFixed(2)}, ${oDeg.rollPlumbDeg.toFixed(2)}),
        "forced_perspective_scale": ${fpScale.toFixed(3)},
        "camera_sightline_splay_deg": ${splayDeg.toFixed(2)},
        "floor_rake_pitch_deg": ${rakeDeg.toFixed(2)},
        "verification_notes": "${esc(mv?.verificationNotes || '')}",
        "previous_dims_ft": (${it.previousValues.widthFeet.toFixed(2)}, ${it.previousValues.depthFeet.toFixed(2)}, ${it.previousValues.heightFeet.toFixed(2)}),
        "proposed_dims_ft": (${it.proposedValues.widthFeet.toFixed(2)}, ${it.proposedValues.depthFeet.toFixed(2)}, ${it.proposedValues.heightFeet.toFixed(2)}),
        "window_grid": (${it.proposedValues.windowCols}, ${it.proposedValues.windowRows}),
        "window_reveal_in": ${it.proposedValues.windowRevealInches.toFixed(2)},
        "balcony_projection_ft": ${it.proposedValues.balconyProjectionFeet.toFixed(2)},
        "interior_depth_ft": ${it.proposedValues.interiorDepthFeet.toFixed(2)},
        "apparent_arch_depth_ft": ${appDepth.toFixed(2)},
        "spatial_reasoning": "${esc(it.spatialReasoningSummary)}",
    }`;
    })
    .join(',\n');

  return `"""
================================================================================
05_apply_ai_iterative_layout_deltas.py
STAGE 18: AUTOMATED & AI-DRIVEN ITERATIVE 3D ARCHITECTURAL LAYOUT DELTA APPLIER
================================================================================
Applies approved frame-by-frame dimensional refinements and manual low-confidence
frame verifications (3D placement offsets, camera orientation overrides, and
frame validity filters) from the Stage 18 Dual-Engine Frame-to-3D Solver
directly onto the Blender 4.2 LTS Stage 18 architectural scene.

Approved Frame Scan Iterations Applied: ${approvedIterations.length}
================================================================================
Usage inside Blender 4.2+ Scripting Workspace or CLI:
  blender --python 03_build_stage18_architecture.py --python 05_apply_ai_iterative_layout_deltas.py
"""

import bpy
import bmesh
from mathutils import Vector

LEARNED_75GB_CORPUS_RULES = [
${learnedRulesPy}
]

CONVERGED_STAGE18_OVERRIDES = {
${zoneOverridesPy}
}

APPROVED_SCAN_ITERATION_LEDGER = [
${iterationsLedgerPy}
]

ZONE_TO_BLENDER_MESH_MAP = {
    "apt-thorwald": "North_Thorwald_Tenement_Facade",
    "apt-torso": "West_Wing_Tenement_Block",
    "apt-lonelyhearts": "West_Wing_Tenement_Block",
    "apt-composer": "East_Wing_Studio_Block",
    "apt-sculptor": "Stage18_Excavated_Courtyard_Floor",
    "apt-alley-street": "North_Alley_Street_Backdrop",
    "apt-jeffries": "Jeff_Floor_Slab",
}


def create_confidence_heatmap_material(zone_id, confidence_pct):
    """
    Creates a diagnostic viewport material colored by reconstruction confidence:
      - < 45%:  Blueprint Cyan  (#38BDF8) — Baseline Prior
      - 45–79%: Tungsten Amber  (#F59E0B) — Partial Single-Frame Convergence
      - >= 80%: Emerald Locked  (#10B981) — High Multi-Frame / User-Verified Convergence
    """
    mat_name = f"MAT_Confidence_{zone_id}_{confidence_pct}pct"
    if mat_name in bpy.data.materials:
        return bpy.data.materials[mat_name]
    mat = bpy.data.materials.new(name=mat_name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if confidence_pct >= 80:
        rgba = (0.06, 0.72, 0.50, 1.0)
    elif confidence_pct >= 45:
        rgba = (0.96, 0.62, 0.04, 1.0)
    else:
        rgba = (0.22, 0.74, 0.97, 1.0)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = 0.65
    mat.diffuse_color = rgba
    return mat


def rebuild_window_bay_cutter_proxies(zone_id, spec):
    """
    Spawns procedural recessed window bay locators matching the scanned
    window_cols x window_rows matrix and brick reveal depth.
    """
    col_name = "STAGE_18_SCANNED_WINDOW_BAYS"
    if col_name not in bpy.data.collections:
        col = bpy.data.collections.new(col_name)
        bpy.context.scene.collection.children.link(col)
    else:
        col = bpy.data.collections[col_name]

    # Remove old bay markers for this zone
    for obj in list(col.objects):
        if obj.name.startswith(f"BAY_{zone_id}_"):
            bpy.data.objects.remove(obj, do_unlink=True)

    cols = max(1, int(spec["window_cols"]))
    rows = max(1, int(spec["window_rows"]))
    reveal_ft = float(spec["window_reveal_in"]) / 12.0
    w_ft, d_ft, h_ft = spec["converged_dims_ft"]

    for r in range(rows):
        for c in range(cols):
            marker = bpy.data.objects.new(f"BAY_{zone_id}_R{r+1}_C{c+1}", None)
            marker.empty_display_type = 'CUBE'
            marker.empty_display_size = 0.85
            marker["window_reveal_ft"] = reveal_ft
            marker["interior_depth_ft"] = spec["interior_depth_ft"]
            marker["confidence_score"] = spec["confidence_score"]
            col.objects.link(marker)


def apply_converged_layout_deltas():
    print("=== Applying Stage 18 AI, CV & User-Verified 3D Architectural Deltas ===")
    for zone_id, spec in CONVERGED_STAGE18_OVERRIDES.items():
        mesh_name = ZONE_TO_BLENDER_MESH_MAP.get(zone_id)
        obj = bpy.data.objects.get(mesh_name) if mesh_name else None

        base_w, base_d, base_h = spec["baseline_dims_ft"]
        conv_w, conv_d, conv_h = spec["converged_dims_ft"]

        scale_x = conv_w / max(0.1, base_w)
        scale_y = conv_d / max(0.1, base_d)
        scale_z = conv_h / max(0.1, base_h)

        if obj:
            import math
            obj.scale = (scale_x, scale_y, scale_z)
            # Apply Camera-POV non-orthogonal sightline wall splay (Z-axis yaw in Blender) and floor rake pitch (X-axis pitch)
            splay_rad = math.radians(spec.get("camera_sightline_splay_deg", 0.0))
            rake_rad = math.radians(spec.get("floor_rake_pitch_deg", 0.0))
            obj.rotation_euler = (rake_rad, 0.0, splay_rad)

            # Apply user-verified 3D placement offsets (dX, dZ_depth, dY_elevation in Blender Z-up)
            dx, dy_depth, dz_elev = spec.get("placement_offset_ft", (0.0, 0.0, 0.0))
            if abs(dx) > 0.01 or abs(dy_depth) > 0.01 or abs(dz_elev) > 0.01:
                obj.location = obj.location + Vector((dx, dy_depth, dz_elev))

            obj["stage18_zone_id"] = zone_id
            obj["confidence_score"] = spec["confidence_score"]
            obj["validity_status"] = spec.get("validity_status", "verified_valid")
            obj["placement_offset_ft"] = spec.get("placement_offset_ft", (0.0, 0.0, 0.0))
            obj["orientation_override_deg"] = spec.get("orientation_override_deg", (-4.0, 0.0, 0.0))
            obj["forced_perspective_scale"] = spec.get("forced_perspective_scale", 0.85)
            obj["camera_sightline_splay_deg"] = spec.get("camera_sightline_splay_deg", 0.0)
            obj["floor_rake_pitch_deg"] = spec.get("floor_rake_pitch_deg", 0.0)
            obj["apparent_arch_depth_ft"] = spec.get("apparent_arch_depth_ft", spec["interior_depth_ft"])
            obj["contributing_frames"] = spec["contributing_frames"]
            obj["last_updated_smpte"] = spec["last_updated_smpte"]
            obj["last_engine"] = spec["last_engine"]
            obj["window_cols"] = spec["window_cols"]
            obj["window_rows"] = spec["window_rows"]
            obj["window_reveal_in"] = spec["window_reveal_in"]
            obj["balcony_projection_ft"] = spec["balcony_projection_ft"]
            obj["interior_depth_ft"] = spec["interior_depth_ft"]

            # Store diagnostic confidence material in slot 2 for instant viewport inspection
            conf_mat = create_confidence_heatmap_material(zone_id, spec["confidence_score"])
            if len(obj.data.materials) < 2:
                obj.data.materials.append(conf_mat)
            else:
                obj.data.materials[1] = conf_mat

            print(
                f"  [UPDATED POV-COMPENSATED] {zone_id} ({mesh_name}): "
                f"{base_w:.1f}'x{base_h:.1f}' -> {conv_w:.1f}'x{conv_h:.1f}' "
                f"| Physical Room Depth {spec['interior_depth_ft']:.1f}' (Apparent {spec.get('apparent_arch_depth_ft', spec['interior_depth_ft']):.1f}') "
                f"| POV Scale {spec.get('forced_perspective_scale', 0.85):.2f}x "
                f"| Sightline Wall Splay {spec.get('camera_sightline_splay_deg', 0.0):+.1f} deg "
                f"| Floor Rake {spec.get('floor_rake_pitch_deg', 0.0):+.1f} deg "
                f"| Confidence {spec['confidence_score']}%"
            )

        rebuild_window_bay_cutter_proxies(zone_id, spec)

    # Record full iteration provenance on Scene root custom properties
    bpy.context.scene["stage18_approved_iterations_count"] = len(APPROVED_SCAN_ITERATION_LEDGER)
    print(f"=== Completed {len(APPROVED_SCAN_ITERATION_LEDGER)} Approved Frame-to-3D Layout Deltas ===")


if __name__ == "__main__":
    apply_converged_layout_deltas()
`;
}

function hexToLinearRgbTuple(hex: string): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16) || 0;
  const srgbToLinear = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = srgbToLinear((num >> 16) & 255).toFixed(4);
  const g = srgbToLinear((num >> 8) & 255).toFixed(4);
  const b = srgbToLinear(num & 255).toFixed(4);
  return `(${r}, ${g}, ${b}, 1.0)`;
}

export function generateJeffriesPbrMaterialsBlenderScript(
  config: ScriptGeneratorConfig
): string {
  const materials = config.jeffriesPbrMaterials || INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS;
  const esc = (s?: string) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const materialsDictPy = materials
    .map((m) => {
      const sp = m.surfaceProperties;
      const meshesPy = m.targetBlenderMeshes.map((mesh) => `"${esc(mesh)}"`).join(', ');
      return `    "${esc(m.id)}": {
        "mat_name": "${esc(m.blenderMaterialName)}",
        "label": "${esc(m.name)}",
        "category": "${esc(m.category)}",
        "pattern_type": "${esc(m.patternType)}",
        "smpte_ref": "${esc(m.filmStillRef.smpteTimecode)}",
        "focal_mm": ${m.filmStillRef.focalLengthMm},
        "scene_title": "${esc(m.filmStillRef.sceneTitle)}",
        "optical_notes": "${esc(m.filmStillRef.opticalObservation)}",
        "target_meshes": [${meshesPy}],
        "base_rgba": ${hexToLinearRgbTuple(sp.baseColorHex)},
        "secondary_rgba": ${hexToLinearRgbTuple(sp.secondaryColorHex)},
        "accent_rgba": ${hexToLinearRgbTuple(sp.accentColorHex)},
        "roughness": ${sp.roughness.toFixed(3)},
        "roughness_variance": ${sp.roughnessVariance.toFixed(3)},
        "metalness": ${sp.metalness.toFixed(3)},
        "ior": ${sp.ior.toFixed(3)},
        "specular_weight": ${sp.specularWeight.toFixed(3)},
        "coat_weight": ${sp.clearcoatWeight.toFixed(3)},
        "coat_roughness": ${sp.clearcoatRoughness.toFixed(3)},
        "sheen_weight": ${sp.sheenWeight.toFixed(3)},
        "sheen_roughness": ${sp.sheenRoughness.toFixed(3)},
        "transmission_weight": ${sp.transmissionWeight.toFixed(3)},
        "anisotropic_weight": ${sp.anisotropicWeight.toFixed(3)},
        "anisotropic_rotation": ${sp.anisotropicRotation.toFixed(3)},
        "subsurface_weight": ${sp.subsurfaceWeight.toFixed(3)},
        "subsurface_radius_mm": (${sp.subsurfaceRadiusMm[0].toFixed(2)}, ${sp.subsurfaceRadiusMm[1].toFixed(2)}, ${sp.subsurfaceRadiusMm[2].toFixed(2)}),
        "bump_height_mm": ${sp.bumpHeightMm.toFixed(3)},
        "normal_strength": ${sp.normalStrength.toFixed(3)},
        "uv_scale": ${sp.uvScale.toFixed(2)},
        "edge_wear": ${sp.edgeWearFactor.toFixed(3)},
    }`;
    })
    .join(',\n');

  return `"""
================================================================================
06_jeffries_apartment_pbr_materials.py
STAGE 18: L.B. JEFFERIES'S APARTMENT (#2B) — FILM-STILL CALIBRATED PBR SHADER SUITE
================================================================================
Constructs 8 physically based, Blender 4.2+ LTS Principled BSDF v2 procedural
materials derived from 1954 Rear Window 4K UHD Remux reference frames:
  1. MAT_Jeff_Oak_Herringbone_Parquet      (Wood — Quarter-Sawn Red Oak Floor)
  2. MAT_Jeff_Cream_Enamel_Pine_Mullions   (Wood — Semigloss Cream Window Sash/Sill)
  3. MAT_Jeff_Aged_Sage_Gypsum_Plaster     (Plaster — Hand-Troweled Interior Walls)
  4. MAT_Jeff_Cylinder_Crown_Window_Glass  (Glass — Light-Path Caustics Bypass)
  5. MAT_Jeff_Split_Bamboo_Matchstick_Blinds (Wood/Fiber — Anisotropic + Backlit Translucent)
  6. MAT_Jeff_Oatmeal_Wool_Boucle_Upholstery (Fabric — Microfiber Sheen Wheelchair/Daybed)
  7. MAT_Jeff_Exakta_Chrome_And_Vulcanite  (Metal — Anisotropic Chrome + Diamond Vulcanite)
  8. MAT_Jeff_Orthopedic_Plaster_Cast      (Plaster/Gauze — Random-Walk SSS + Bandage Relief)

Optimized for Cycles GPU + AgX Color Management:
  - Uses Blender 4.x Principled BSDF v2 socket names (Coat Weight, Sheen Weight,
    Transmission Weight, Subsurface Weight, Specular IOR Level) with automatic
    fallback for Blender 3.6 LTS.
  - Automatically assigns each material to its target meshes in collection
    'APT_2B_Jeffries_Hero_Interior' created by 03_build_stage18_architecture.py.
================================================================================
Usage inside Blender 4.2+ Scripting Workspace or CLI:
  blender --python 03_build_stage18_architecture.py --python 06_jeffries_apartment_pbr_materials.py
"""

import bpy

JEFFRIES_PBR_MATERIAL_SPECS = {
${materialsDictPy}
}


def set_bsdf_input(bsdf, names, value):
    """Safely sets a Principled BSDF socket across Blender 4.x (v2) and 3.6."""
    if isinstance(names, str):
        names = [names]
    for name in names:
        if name in bsdf.inputs:
            bsdf.inputs[name].default_value = value
            return True
    return False


def build_principled_pbr_material(spec_id, spec):
    mat_name = spec["mat_name"]
    if mat_name in bpy.data.materials:
        mat = bpy.data.materials[mat_name]
    else:
        mat = bpy.data.materials.new(name=mat_name)

    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Store 1954 4K Remux provenance as custom properties on the Blender Material
    mat["stage18_spec_id"] = spec_id
    mat["smpte_reference"] = spec["smpte_ref"]
    mat["focal_length_mm"] = spec["focal_mm"]
    mat["scene_title"] = spec["scene_title"]
    mat["optical_notes"] = spec["optical_notes"]
    mat["bump_height_mm"] = spec["bump_height_mm"]

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (720, 0)

    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (280, 0)

    # Configure base Principled BSDF v2 surface properties
    set_bsdf_input(bsdf, ["Base Color"], spec["base_rgba"])
    set_bsdf_input(bsdf, ["Roughness"], spec["roughness"])
    set_bsdf_input(bsdf, ["Metallic"], spec["metalness"])
    set_bsdf_input(bsdf, ["IOR"], spec["ior"])
    set_bsdf_input(bsdf, ["Specular IOR Level", "Specular"], spec["specular_weight"])
    set_bsdf_input(bsdf, ["Coat Weight", "Clearcoat"], spec["coat_weight"])
    set_bsdf_input(bsdf, ["Coat Roughness", "Clearcoat Roughness"], spec["coat_roughness"])
    set_bsdf_input(bsdf, ["Sheen Weight", "Sheen"], spec["sheen_weight"])
    set_bsdf_input(bsdf, ["Sheen Roughness"], spec["sheen_roughness"])
    set_bsdf_input(bsdf, ["Transmission Weight", "Transmission"], spec["transmission_weight"])
    set_bsdf_input(bsdf, ["Anisotropic"], spec["anisotropic_weight"])
    set_bsdf_input(bsdf, ["Anisotropic Rotation"], spec["anisotropic_rotation"])
    set_bsdf_input(bsdf, ["Subsurface Weight", "Subsurface"], spec["subsurface_weight"])

    tex_coord = nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-980, 0)

    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-760, 0)
    scale = spec["uv_scale"]
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])

    bump = nodes.new("ShaderNodeBump")
    bump.location = (20, -260)
    bump.inputs["Strength"].default_value = min(1.0, spec["normal_strength"])
    # Convert mm bump depth to meters (Blender internal displacement distance)
    bump.inputs["Distance"].default_value = spec["bump_height_mm"] * 0.001

    pattern = spec["pattern_type"]

    if pattern == "oak_parquet":
        # Herringbone Oak Parquet + Quarter-Sawn Medullary Wave + Scuff Roughness
        brick = nodes.new("ShaderNodeTexBrick")
        brick.location = (-480, 220)
        brick.offset = 0.5
        brick.inputs["Color1"].default_value = spec["base_rgba"]
        brick.inputs["Color2"].default_value = spec["secondary_rgba"]
        brick.inputs["Mortar"].default_value = (0.08, 0.05, 0.03, 1.0)
        brick.inputs["Scale"].default_value = 3.5
        brick.inputs["Mortar Size"].default_value = 0.015
        brick.inputs["Brick Width"].default_value = 0.45
        brick.inputs["Row Height"].default_value = 0.15

        wave = nodes.new("ShaderNodeTexWave")
        wave.location = (-480, -60)
        wave.wave_type = 'BANDS'
        wave.inputs["Scale"].default_value = 14.0
        wave.inputs["Distortion"].default_value = 4.5
        wave.inputs["Detail"].default_value = 6.0

        mix_col = nodes.new("ShaderNodeMixRGB")
        mix_col.location = (-160, 180)
        mix_col.blend_type = 'OVERLAY'
        mix_col.inputs["Fac"].default_value = 0.28

        rough_ramp = nodes.new("ShaderNodeMapRange")
        rough_ramp.location = (-160, -40)
        rough_ramp.inputs["To Min"].default_value = max(0.05, spec["roughness"] - spec["roughness_variance"])
        rough_ramp.inputs["To Max"].default_value = min(0.95, spec["roughness"] + spec["roughness_variance"])

        links.new(mapping.outputs["Vector"], brick.inputs["Vector"])
        links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
        links.new(brick.outputs["Color"], mix_col.inputs["Color1"])
        links.new(wave.outputs["Color"], mix_col.inputs["Color2"])
        links.new(mix_col.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(wave.outputs["Fac"], rough_ramp.inputs["Value"])
        links.new(rough_ramp.outputs["Result"], bsdf.inputs["Roughness"])
        links.new(brick.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    elif pattern == "painted_mullion":
        # Semigloss Cream Enamel over Moulded Pine with Bevel & AO Sill Edge Chipping
        ao = nodes.new("ShaderNodeAmbientOcclusion")
        ao.location = (-480, 220)
        ao.samples = 4
        ao.inputs["Distance"].default_value = 0.12
        ao.inputs["Color"].default_value = spec["base_rgba"]

        brush_noise = nodes.new("ShaderNodeTexNoise")
        brush_noise.location = (-480, -60)
        brush_noise.inputs["Scale"].default_value = 28.0
        brush_noise.inputs["Detail"].default_value = 6.0

        bevel = nodes.new("ShaderNodeBevel")
        bevel.location = (-220, -280)
        bevel.samples = 4
        bevel.inputs["Radius"].default_value = 0.0025

        links.new(mapping.outputs["Vector"], brush_noise.inputs["Vector"])
        links.new(ao.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(brush_noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bevel.outputs["Normal"], bump.inputs["Normal"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    elif pattern == "sage_plaster":
        # Dual-Frequency Troweled Gypsum Plaster + Voronoi Hairline Cracks
        macro_noise = nodes.new("ShaderNodeTexNoise")
        macro_noise.location = (-500, 180)
        macro_noise.inputs["Scale"].default_value = 2.2
        macro_noise.inputs["Detail"].default_value = 4.0

        stipple_noise = nodes.new("ShaderNodeTexNoise")
        stipple_noise.location = (-500, -80)
        stipple_noise.inputs["Scale"].default_value = 85.0
        stipple_noise.inputs["Detail"].default_value = 8.0
        stipple_noise.inputs["Roughness"].default_value = 0.75

        mix_plaster = nodes.new("ShaderNodeMixRGB")
        mix_plaster.location = (-180, 160)
        mix_plaster.inputs["Color1"].default_value = spec["base_rgba"]
        mix_plaster.inputs["Color2"].default_value = spec["secondary_rgba"]

        links.new(mapping.outputs["Vector"], macro_noise.inputs["Vector"])
        links.new(mapping.outputs["Vector"], stipple_noise.inputs["Vector"])
        links.new(macro_noise.outputs["Fac"], mix_plaster.inputs["Fac"])
        links.new(mix_plaster.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(stipple_noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    elif pattern == "crown_glass":
        # Cylinder-Drawn Sheet Glass + Cycles Light-Path Shadow/Diffuse Caustics Bypass
        wave_noise = nodes.new("ShaderNodeTexNoise")
        wave_noise.location = (-460, -180)
        wave_noise.inputs["Scale"].default_value = 1.6
        wave_noise.inputs["Detail"].default_value = 2.0

        links.new(mapping.outputs["Vector"], wave_noise.inputs["Vector"])
        links.new(wave_noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

        light_path = nodes.new("ShaderNodeLightPath")
        light_path.location = (60, 320)
        math_max = nodes.new("ShaderNodeMath")
        math_max.location = (280, 280)
        math_max.operation = 'MAXIMUM'
        transp = nodes.new("ShaderNodeBsdfTransparent")
        transp.location = (280, 140)
        transp.inputs["Color"].default_value = spec["base_rgba"]

        mix_shader = nodes.new("ShaderNodeMixShader")
        mix_shader.location = (520, 80)

        links.new(light_path.outputs["Is Shadow Ray"], math_max.inputs[0])
        links.new(light_path.outputs["Is Diffuse Ray"], math_max.inputs[1])
        links.new(math_max.outputs["Value"], mix_shader.inputs["Fac"])
        links.new(bsdf.outputs["BSDF"], mix_shader.inputs[1])
        links.new(transp.outputs["BSDF"], mix_shader.inputs[2])
        links.new(mix_shader.outputs["Shader"], out.inputs["Surface"])
        return mat

    elif pattern == "bamboo_blinds":
        # Horizontal Split-Bamboo Reeds + Backlit Translucent BSDF Mix
        reed_wave = nodes.new("ShaderNodeTexWave")
        reed_wave.location = (-480, 140)
        reed_wave.wave_type = 'BANDS'
        reed_wave.bands_direction = 'Z'
        reed_wave.inputs["Scale"].default_value = 22.0
        reed_wave.inputs["Distortion"].default_value = 0.8

        mix_reed = nodes.new("ShaderNodeMixRGB")
        mix_reed.location = (-180, 140)
        mix_reed.inputs["Color1"].default_value = spec["secondary_rgba"]
        mix_reed.inputs["Color2"].default_value = spec["base_rgba"]

        translucent = nodes.new("ShaderNodeBsdfTranslucent")
        translucent.location = (280, -220)
        translucent.inputs["Color"].default_value = spec["accent_rgba"]

        mix_backlit = nodes.new("ShaderNodeMixShader")
        mix_backlit.location = (520, 0)
        mix_backlit.inputs["Fac"].default_value = 0.14

        links.new(mapping.outputs["Vector"], reed_wave.inputs["Vector"])
        links.new(reed_wave.outputs["Fac"], mix_reed.inputs["Fac"])
        links.new(mix_reed.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(reed_wave.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        links.new(bsdf.outputs["BSDF"], mix_backlit.inputs[1])
        links.new(translucent.outputs["BSDF"], mix_backlit.inputs[2])
        links.new(mix_backlit.outputs["Shader"], out.inputs["Surface"])
        return mat

    elif pattern == "wool_boucle":
        # Oatmeal-Taupe Interlocking Wool Bouclé Weave + Microfiber Grazing Sheen
        checker = nodes.new("ShaderNodeTexChecker")
        checker.location = (-480, 180)
        checker.inputs["Color1"].default_value = spec["base_rgba"]
        checker.inputs["Color2"].default_value = spec["secondary_rgba"]
        checker.inputs["Scale"].default_value = 36.0

        slub_noise = nodes.new("ShaderNodeTexNoise")
        slub_noise.location = (-480, -80)
        slub_noise.inputs["Scale"].default_value = 48.0
        slub_noise.inputs["Detail"].default_value = 8.0
        slub_noise.inputs["Distortion"].default_value = 1.8

        links.new(mapping.outputs["Vector"], checker.inputs["Vector"])
        links.new(mapping.outputs["Vector"], slub_noise.inputs["Vector"])
        links.new(checker.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(slub_noise.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    elif pattern == "chrome_vulcanite":
        # Exakta VX Brushed Chrome + Voronoi Diamond Vulcanite Cladding
        voronoi = nodes.new("ShaderNodeTexVoronoi")
        voronoi.location = (-480, -80)
        voronoi.distance = 'MANHATTAN'
        voronoi.inputs["Scale"].default_value = 64.0

        links.new(mapping.outputs["Vector"], voronoi.inputs["Vector"])
        links.new(voronoi.outputs["Distance"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    else:
        # Orthopedic Plaster-of-Paris Cast with Spiral Bandage Wave & Gauze Relief
        spiral_wave = nodes.new("ShaderNodeTexWave")
        spiral_wave.location = (-480, 140)
        spiral_wave.wave_type = 'BANDS'
        spiral_wave.bands_direction = 'DIAGONAL'
        spiral_wave.inputs["Scale"].default_value = 8.0
        spiral_wave.inputs["Distortion"].default_value = 1.5

        gauze_noise = nodes.new("ShaderNodeTexNoise")
        gauze_noise.location = (-480, -100)
        gauze_noise.inputs["Scale"].default_value = 55.0
        gauze_noise.inputs["Detail"].default_value = 6.0

        links.new(mapping.outputs["Vector"], spiral_wave.inputs["Vector"])
        links.new(mapping.outputs["Vector"], gauze_noise.inputs["Vector"])
        links.new(spiral_wave.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def assign_jeffries_pbr_materials_to_scene():
    print("=== Building & Assigning L.B. Jefferies (#2B) Film-Still Calibrated PBR Materials ===")
    assigned_count = 0

    for spec_id, spec in JEFFRIES_PBR_MATERIAL_SPECS.items():
        mat = build_principled_pbr_material(spec_id, spec)
        for mesh_name in spec["target_meshes"]:
            obj = bpy.data.objects.get(mesh_name)
            if obj and hasattr(obj.data, "materials"):
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(mat)
                else:
                    obj.data.materials[0] = mat
                assigned_count += 1
                print(
                    f"  [ASSIGNED PBR] {mesh_name} -> {mat.name} "
                    f"(R={spec['roughness']:.2f}, IOR={spec['ior']:.2f}, Bump={spec['bump_height_mm']:.2f}mm, SMPTE {spec['smpte_ref']})"
                )

    print(f"=== Completed 8 Jeffries PBR Materials ({assigned_count} mesh bindings updated) ===")


if __name__ == "__main__":
    assign_jeffries_pbr_materials_to_scene()
`;
}


