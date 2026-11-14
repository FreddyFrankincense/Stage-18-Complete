export type FrameRole =
  | 'fspy_geometry'
  | 'clean_texture_plate'
  | 'telephoto_set_dressing'
  | 'master_lighting_target';

export interface CustomFrameMetadataEntry {
  key: string;
  value: string;
}

export interface CuratedReferenceFrame {
  id: string;
  title: string;
  sourceType: 'mkv_timecode' | 'web_archival_still';
  smpteTimecode: string;
  frameNumber: number;
  durationWindowSec: number;
  useTemporalMedianStack: boolean;
  role: FrameRole;
  targetApartmentId: string;
  focalLengthMm: number;
  sampledKeyColorHex: string;
  sampledShadowColorHex: string;
  kelvinEstimate: number;
  sceneContext: string;
  architecturalFeatureHighlighted: string;
  lightingNotes: string;
  notes: string;
  customMetadata?: CustomFrameMetadataEntry[];
  includedInExport: boolean;
  cropRegion?: string;
  customImageDataUrl?: string;
}

export interface Stage18ApartmentUnit {
  id: string;
  designation: string;
  name: string;
  resident: string;
  wing: 'Interior Foreground' | 'West Courtyard Wing' | 'North Center Courtyard' | 'East Courtyard Wing' | 'Excavated Basement Level' | 'Background Street & Alley';
  floorLevel: string;
  coordinates3D: [number, number, number]; // Feet relative to courtyard center
  cameraLookAt: [number, number, number];
  dimensionsFeet: string;
  furnishedStatus: 'Hero Tier 1 (Full Interior + Sub-mm Props)' | 'Furnished Tier 2 (Full Visible Room)' | 'Architectural Tier 3 (Parallax / Exterior)';
  lodTier: 1 | 2 | 3;
  keyProps: string[];
  materialsAndFinishes: string[];
  remuxTimestamps: string[];
  focalLengthRef: number;
  occlusionNotes: string;
}

export interface CameraOpticalPreset {
  id: string;
  label: string;
  shortLabel: string;
  cameraBody: string;
  lensModel: string;
  focalLengthMm: number;
  fovDegrees: number;
  position: [number, number, number];
  target: [number, number, number];
  reticleMode: 'none' | 'mitchell_academy' | 'binoculars' | 'exakta_slr';
  description: string;
}

export interface LightingScenarioPreset {
  id: string;
  label: string;
  shortLabel: string;
  filmTimestampRef: string;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunColorHex: string;
  sunIntensity: number;
  skyHemiColorHex: string;
  groundHemiColorHex: string;
  ambientIntensity: number;
  practicalLampIntensity: number;
  jeffInteriorLampIntensity: number;
  fogColorHex: string;
  cyclesKelvinKey: number;
  cyclesExposure: number;
  description: string;
}

export interface PipelineSubTask {
  id: string;
  title: string;
  detail: string;
  toolUsed: 'FFmpeg' | 'fSpy' | 'Blender 4.2 LTS' | 'Python / OpenCV' | 'Archival Blueprints';
  estimatedHours: number;
  cliOrActionSnippet: string;
}

export interface PipelinePhase {
  id: string;
  phaseNumber: string;
  title: string;
  subtitle: string;
  summary: string;
  deliverable: string;
  tasks: PipelineSubTask[];
  linkedBarrierIds: string[];
}

export interface TechnicalBarrier {
  id: string;
  code: string;
  title: string;
  category: 'Optical & Camera' | '4K Remux & Color' | 'Architecture & Scale' | 'Lighting & VRAM';
  severity: 'Critical' | 'High' | 'Moderate';
  opticalOrTechnicalCause: string;
  symptomsInBlender: string;
  engineeredWorkaround: string;
  blenderOrFfmpegSolution: string;
  associatedScriptTab: 'ffmpeg' | 'fspy' | 'architecture' | 'lighting';
}

export const STAGE18_APARTMENTS: Stage18ApartmentUnit[] = [
  {
    id: 'apt-jeffries',
    designation: 'APT 2B · SOUTH FOREGROUND',
    name: "L.B. 'Jeff' Jefferies's Apartment",
    resident: 'L.B. Jefferies (Photojournalist)',
    wing: 'Interior Foreground',
    floorLevel: '2nd Floor (+14.5 ft above Courtyard)',
    coordinates3D: [0, 14.5, 22],
    cameraLookAt: [0, 11.5, -18],
    dimensionsFeet: "24' W × 18.0' D Physical (1:1 Foreground Anchor) · 0° Wall Splay",
    furnishedStatus: 'Hero Tier 1 (Full Interior + Sub-mm Props)',
    lodTier: 1,
    keyProps: [
      'Three-Bay Double-Hung Wood Sash Windows (Center 48" W, Flanks 32" W)',
      'Exakta VX 35mm SLR + Kilfitt Fern-Kilar 152mm/400mm f/5.6 Telephoto Lens',
      'Graflex 3-Cell Flashgun + 7-inch Parabolic Chrome Reflector + Box of #5 Flashbulbs',
      'Bausch & Lomb 7×35 Zephyr Binoculars on Lap Table',
      'Everest & Jennings Chrome/Leather Wheelchair & Full Left-Leg Plaster Cast',
      'Mid-Century Tripod, Framed Magazine Negative Prints, Bamboo Partition & Step-Down Entry'
    ],
    materialsAndFinishes: [
      'Warm cream-ochre painted plaster walls (Roughness 0.72)',
      'Satin cream-white enameled window mullions with subtle paint chipping',
      'Weathered oak parquet flooring with woven rush area rug',
      'Brushed chrome, vulcanite leatherette, and multi-coated optical glass on Exakta VX'
    ],
    remuxTimestamps: ['00:01:42:12', '00:03:18:04', '00:38:12:19', '01:36:52:06'],
    focalLengthRef: 35,
    occlusionNotes: 'Acts as the 1:1 optical nodal origin (0, +14.5, +18.2 ft). All distant courtyard structures were angled, raked, and scaled relative to this exact camera tripod position rather than architectural code.'
  },
  {
    id: 'apt-thorwald',
    designation: 'APT 2E · NORTH-WEST WING',
    name: "Lars & Anna Thorwald's Railroad Flat",
    resident: 'Lars Thorwald (Costume Jewelry Salesman)',
    wing: 'North Center Courtyard',
    floorLevel: '2nd Floor (+13.0 ft · 43.6 ft from Camera)',
    coordinates3D: [-11, 13.0, -24],
    cameraLookAt: [-11, 13.0, -24],
    dimensionsFeet: "35.2' W × 11.4' D Physical (Appears 16.5' D from POV · 0.82× Scale · +6.8° Wall Splay)",
    furnishedStatus: 'Hero Tier 1 (Full Interior + Sub-mm Props)',
    lodTier: 1,
    keyProps: [
      '4 Sequential Double-Hung Sash Windows (0.88× scaled-down frames to exaggerate courtyard span)',
      'Forced-perspective hallway & bedroom partitions splayed +6.8° toward Jeffs sightline',
      'Undersized 0.82× scale headboard bed & vanity dresser pushed against shallow 11.4 ft rear wall',
      'Wall-mounted rotary telephone in hallway & shallow-relief kitchen sink/icebox',
      'Translucent roller shades + emissive cigar tip light source (Night scene)'
    ],
    materialsAndFinishes: [
      'Scenic molded red-brown brick facade (compressed 2.35" course height vs 2.67" standard to simulate extra distance)',
      'Limestone window lintels and sills with soot/rain streak vertex masking',
      'Muted warm-grey interior trim & yellow-green floral bedroom wallpaper'
    ],
    remuxTimestamps: ['00:07:19:10', '00:26:40:00', '00:44:18:12', '01:28:05:14'],
    focalLengthRef: 152,
    occlusionNotes: 'Archival sources claim a 16–18 ft deep apartment, but Stage 18 north wall clearance forced Hal Pereira to build a 11.4 ft shallow shadowbox with +6.8° splayed partition walls and +2.4° floor rake tuned strictly for Jeffs POV.'
  },
  {
    id: 'apt-torso',
    designation: 'APT 2D · WEST WING',
    name: "Miss Torso's Studio Apartment",
    resident: 'Georgine / Miss Torso (Ballet Dancer)',
    wing: 'West Courtyard Wing',
    floorLevel: '2nd Floor (+13.5 ft · 33.4 ft Oblique from Camera)',
    coordinates3D: [-23, 13.5, -6],
    cameraLookAt: [-23, 13.5, -6],
    dimensionsFeet: "19.8' W × 12.6' D Physical (Appears 18.0' D from POV · 0.88× Scale · +11.5° Trapezoidal Splay)",
    furnishedStatus: 'Furnished Tier 2 (Full Visible Room)',
    lodTier: 2,
    keyProps: [
      'Wide double apartment windows with asymmetrically canted Juliette iron balcony',
      'Trapezoidal interior side walls splayed +11.5° toward Jeffs window to prevent jamb occlusion',
      '0.88× scale white porcelain refrigerator, sofa & three floor lamps arranged on raked floor',
      'Angled dressing vanity & rehearsal mirror cheated 9° off-orthogonal to reflect into camera lens'
    ],
    materialsAndFinishes: [
      'Painted cream-buff brick exterior wall',
      'Warm rose-beige interior walls for high contrast in Technicolor night scenes',
      'Wrought-iron fire escape landing with black satin alkyd enamel'
    ],
    remuxTimestamps: ['00:01:58:15', '00:22:10:04', '00:51:33:20'],
    focalLengthRef: 75,
    occlusionNotes: 'If modeled with standard 90° orthogonal walls at a 38° oblique sightline, the window jamb hides 60% of the room. The real set splayed the interior north/south walls +11.5° open toward Jeffries camera.'
  },
  {
    id: 'apt-composer',
    designation: 'APT 3A · EAST STUDIO WING',
    name: "The Songwriter's Penthouse Studio",
    resident: 'Ross Bagdasarian / The Songwriter',
    wing: 'East Courtyard Wing',
    floorLevel: '3rd Floor (+22.5 ft · 35.1 ft Oblique from Camera)',
    coordinates3D: [22, 22.5, -8],
    cameraLookAt: [22, 22.5, -8],
    dimensionsFeet: "22.4' W × 13.8' D Physical (Appears 21.0' D from POV · 0.85× Scale · -12.0° Splay · +3.5° Rake)",
    furnishedStatus: 'Furnished Tier 2 (Full Visible Room)',
    lodTier: 2,
    keyProps: [
      'Large multi-pane industrial steel casement studio window canted -4.5° downward toward courtyard',
      '7/8-scale baby grand piano positioned on a +3.5° raked floor so keys/lid read from below',
      'Trapezoidal studio walls splayed -12.0° toward Jeffs 2nd-floor viewpoint',
      'Blue/cyan evening party fill light rig + warm tungsten chandelier hung low in frame'
    ],
    materialsAndFinishes: [
      'Stucco & painted masonry East Wing facade',
      'Cool slate-blue interior acoustic wall panels',
      'High-gloss black lacquer piano shader (Roughness 0.05, Clearcoat 1.0)'
    ],
    remuxTimestamps: ['00:02:28:00', '00:34:12:08', '01:12:44:16'],
    focalLengthRef: 75,
    occlusionNotes: 'Because Jeff views the 3rd-floor studio from 8 ft below (+14.5 ft vs +22.5 ft), the studio floor was raked +3.5° upward toward the rear and walls splayed -12.0° so the piano and party guests remain fully visible.'
  },
  {
    id: 'apt-lonelyhearts',
    designation: 'APT 1C · LOWER WEST WING',
    name: "Miss Lonelyhearts's Ground Apartment",
    resident: 'Miss Lonelyhearts',
    wing: 'Excavated Basement Level',
    floorLevel: '1st Floor / Raised Basement (+2.0 ft · 40.4 ft from Camera)',
    coordinates3D: [-21, 2.5, -14],
    cameraLookAt: [-21, 2.5, -14],
    dimensionsFeet: "16.2' W × 10.8' D Physical (Appears 16.0' D from POV · 0.86× Scale · +9.5° Splay · -3.2° Rake)",
    furnishedStatus: 'Furnished Tier 2 (Full Visible Room)',
    lodTier: 2,
    keyProps: [
      'Pair of ground-floor sash windows with emerald-green draperies & Venetian blinds',
      'Dining table tilted -3.2° toward camera to expose place settings from Jeffs elevated angle',
      'Shallow 10.8 ft bedroom alcove with +9.5° splayed walls & forced-perspective doorway',
      'Exterior basement stairwell & wrought-iron handrail outside window'
    ],
    materialsAndFinishes: [
      'Dark weathered brownstone/concrete lower foundation course',
      'Emerald green fabric curtains (Subsurface scattering 0.15)',
      'Warm candlelight point sources (1900K Blackbody)'
    ],
    remuxTimestamps: ['00:11:04:18', '00:54:19:02', '01:21:09:11'],
    focalLengthRef: 152,
    occlusionNotes: 'Viewed at a steep -19° downward depression angle; the room was built only 10.8 ft deep with a slight negative floor rake (-3.2°) and +9.5° wall splay to prevent the window header from cutting off the rear bed alcove.'
  },
  {
    id: 'apt-sculptor',
    designation: 'APT 1A · COURTYARD FLOOR & PATIO',
    name: "The Sculptor's Basement Studio & Garden",
    resident: 'The Female Sculptor & Courtyard Neighbors',
    wing: 'Excavated Basement Level',
    floorLevel: 'Excavated Stage 18 Basement (-6.0 ft to 0.0 ft · 39.4 ft from Camera)',
    coordinates3D: [10, -2.5, -16],
    cameraLookAt: [6, -2.0, -18],
    dimensionsFeet: "34.5' W × 24.2' D Physical Basin (Trapezoidal Taper toward North Wall · +2.0° Grade Slope)",
    furnishedStatus: 'Furnished Tier 2 (Full Visible Room)',
    lodTier: 2,
    keyProps: [
      'Biomorphic white plaster abstract sculpture ("Hunger") on wooden plinth',
      'Thorwald prized Zinnia flowerbed & freshly dug soil patch (tapered width to lengthen wall)',
      'Non-orthogonal concrete courtyard flagstones laid in converging perspective grid',
      'Sub-basement cellar bulkhead doors & pulley clotheslines'
    ],
    materialsAndFinishes: [
      'Damp concrete flagstones with moss/soil vertex blending',
      'Chalky matte plaster sculpture material (Roughness 0.88)',
      'Organic soil and zinnia foliage instanced via Blender Geometry Nodes'
    ],
    remuxTimestamps: ['00:01:48:22', '00:41:05:10', '01:24:30:00'],
    focalLengthRef: 50,
    occlusionNotes: 'Hal Pereira excavated the floor of Paramount Stage 18 and laid the patio flagstones in a converging trapezoidal grid (+4.2° taper toward the north wall) to make the 44 ft soundstage courtyard appear 75+ ft deep.'
  },
  {
    id: 'apt-alley-street',
    designation: 'NORTH ALLEY · STREET & BAR',
    name: 'Central Alleyway, Cross-Street & Bar Marquee',
    resident: 'Public Greenwich Village Street Traffic',
    wing: 'Background Street & Alley',
    floorLevel: 'Raked Street Grade (+3.5 ft to +6.8 ft · 55.4 ft Farthest Zone from Camera)',
    coordinates3D: [2, 8.0, -36],
    cameraLookAt: [2, 8.0, -36],
    dimensionsFeet: "11.8' W Tapered Alley × 5.2' D Physical Flats (Appears 35' D Street · 0.66× Scale · +14.5° Splay · +4.8° Rake)",
    furnishedStatus: 'Architectural Tier 3 (Parallax / Exterior)',
    lodTier: 3,
    keyProps: [
      'Converging brick alleyway walls (+14.5° inward splay) and +4.8° upward raked asphalt ramp',
      '0.66× miniature-scale Manhattan street facade & tavern windows pressed against Stage 18 north wall',
      'Scaled-down illuminated Neon Bar & Grill marquee sign and warm tavern window glow',
      '0.72× underscaled period automobiles & dwarf-doorway silhouettes on compressed motion track'
    ],
    materialsAndFinishes: [
      'Atmospheric volumetric haze pass separating courtyard from street',
      'Emissive neon tubing (Red/Amber Cycles Emission)',
      'Wet asphalt shader on +4.8° raked ramp with specular streetlamp reflections'
    ],
    remuxTimestamps: ['00:02:14:08', '00:19:50:12', '01:08:15:04'],
    focalLengthRef: 50,
    occlusionNotes: 'Farthest zone from Jeffs camera (55.4 ft): built right against the physical North soundstage wall using extreme 0.66× forced perspective, a +4.8° raked street ramp, and +14.5° converging alley walls to fake an entire Manhattan city block.'
  }
];

export const INITIAL_CURATED_FRAMES: CuratedReferenceFrame[] = [
  {
    id: 'frame-01-wide-geometry',
    title: 'Opening Courtyard Establishing Pan (Clean Wide Lock)',
    sourceType: 'mkv_timecode',
    smpteTimecode: '00:02:14:08',
    frameNumber: 3216,
    durationWindowSec: 1.5,
    useTemporalMedianStack: true,
    role: 'fspy_geometry',
    targetApartmentId: 'apt-thorwald',
    focalLengthMm: 35,
    sampledKeyColorHex: '#F3C68F',
    sampledShadowColorHex: '#2B3240',
    kelvinEstimate: 4800,
    sceneContext: 'Act I morning exposition pan across the Greenwich Village courtyard before Jeff begins his phone call with his magazine editor.',
    architecturalFeatureHighlighted: 'North Tenement common-bond brick courses, limestone window lintels, 3-story cast-iron fire escape landings, and central alleyway gap.',
    lightingNotes: 'High-angle 4800K overhead studio arc daylight key with soft diffused stage fill; minimal window specular reflection.',
    notes: 'Primary 35mm Mitchell BNC wide frame before foreground actor occlusion. Ideal orthogonal brick courses and window lintels for 3-point fSpy calibration.',
    customMetadata: [
      { key: 'Brick Metrology', value: '90 courses = 20.0 ft vertical span' },
      { key: 'Shutter Angle', value: '180° (1/48s at 23.976 fps)' }
    ],
    includedInExport: true,
    cropRegion: '3840x2304 (Full 1.66:1 Academy Aperture)'
  },
  {
    id: 'frame-02-golden-hour-master',
    title: 'Late Afternoon Golden Hour Slanted Sun Across Brick',
    sourceType: 'mkv_timecode',
    smpteTimecode: '00:26:40:00',
    frameNumber: 38361,
    durationWindowSec: 3.0,
    useTemporalMedianStack: true,
    role: 'master_lighting_target',
    targetApartmentId: 'apt-thorwald',
    focalLengthMm: 50,
    sampledKeyColorHex: '#F59E0B',
    sampledShadowColorHex: '#1E293B',
    kelvinEstimate: 3650,
    sceneContext: 'Late afternoon transition as Stella massages Jeffs shoulder and courtyard shadows lengthen across the lower patio.',
    architecturalFeatureHighlighted: 'Diagonal shadow line cast by the West Wing cornice across Thorwalds lower brick facade and the Sculptors excavated garden.',
    lightingNotes: '3650K warm incandescent key at 28° elevation, -42° azimuth; 3.5:1 key-to-shadow contrast ratio with warm terracotta bounce.',
    notes: 'Representative goal frame for daytime golden-hour Cycles lighting. Captures exact 34-degree shadow rake from West Wing cornice across courtyard.',
    customMetadata: [
      { key: 'Sun Elevation', value: '28° above Stage 18 horizon' },
      { key: 'Technicolor Dye Balance', value: 'Warm Amber-Red bias (+12% Red channel)' }
    ],
    includedInExport: true,
    cropRegion: '3840x2304 (Full Frame)'
  },
  {
    id: 'frame-03-thorwald-telephoto-152mm',
    title: 'Exakta 152mm Telephoto POV: Thorwald Sample Case & Bedroom',
    sourceType: 'mkv_timecode',
    smpteTimecode: '00:44:18:12',
    frameNumber: 63740,
    durationWindowSec: 2.0,
    useTemporalMedianStack: false,
    role: 'telephoto_set_dressing',
    targetApartmentId: 'apt-thorwald',
    focalLengthMm: 152,
    sampledKeyColorHex: '#EAB308',
    sampledShadowColorHex: '#1C1917',
    kelvinEstimate: 2950,
    sceneContext: 'Jeff switches from 7×35 binoculars to the Ihagee Exakta VX 35mm SLR with Kilfitt telephoto lens to inspect Thorwald binding the aluminum sample case.',
    architecturalFeatureHighlighted: 'Thorwalds interior bedroom partition wall, carved wooden headboard, yellow-green floral wallpaper repeat, and sash window hardware.',
    lightingNotes: '2950K interior practical bedside lamp + hallway ceiling fixture creating warm interior rim lighting against the recessed wallpaper.',
    notes: 'High-magnification Kilfitt telephoto POV through Jeffs Exakta SLR. Reveals wallpaper motif, bedpost turnings, hallway door molding, and window sash hardware.',
    customMetadata: [
      { key: 'Optical Vignette', value: 'Circular Exakta ground-glass mask' },
      { key: 'Interior Depth', value: '16.0 ft from window glass to rear corridor wall' }
    ],
    includedInExport: true,
    cropRegion: '2400x1800 (Center Optical Crop)'
  },
  {
    id: 'frame-04-clean-brick-plate',
    title: 'North-West Brick Facade Clean Texture Plate (Median De-Grained)',
    sourceType: 'mkv_timecode',
    smpteTimecode: '00:58:12:04',
    frameNumber: 83725,
    durationWindowSec: 4.5,
    useTemporalMedianStack: true,
    role: 'clean_texture_plate',
    targetApartmentId: 'apt-torso',
    focalLengthMm: 50,
    sampledKeyColorHex: '#D97706',
    sampledShadowColorHex: '#334155',
    kelvinEstimate: 4300,
    sceneContext: 'Mid-day static conversational lock-off where Miss Torso steps away from her balcony and Thorwalds blinds remain stationary for 4.5 seconds.',
    architecturalFeatureHighlighted: 'West Wing cream-buff brick masonry, Juliette wrought-iron balcony scrolls, and soot weathering beneath limestone window sills.',
    lightingNotes: '4300K overcast/diffused studio fill—minimal hard directional shadows, making it ideal for de-lighted UV texture projection baking.',
    notes: '4.5-second locked-off window where temporal median filter (FFmpeg tmix) removes 35mm Eastmancolor grain and passing birds/smoke for UV projection baking.',
    customMetadata: [
      { key: 'Median Stack Window', value: '36 frames averaged via FFmpeg tmix' },
      { key: 'Target UV Map', value: 'UDIM 1002 (West & North-West Brick)' }
    ],
    includedInExport: true,
    cropRegion: '3840x2304 (Full Frame)'
  },
  {
    id: 'frame-05-nocturnal-practicals',
    title: 'Nocturnal Courtyard Practicals & Composer Party Glow',
    sourceType: 'mkv_timecode',
    smpteTimecode: '01:08:15:04',
    frameNumber: 98182,
    durationWindowSec: 2.0,
    useTemporalMedianStack: true,
    role: 'master_lighting_target',
    targetApartmentId: 'apt-composer',
    focalLengthMm: 35,
    sampledKeyColorHex: '#38BDF8',
    sampledShadowColorHex: '#090D16',
    kelvinEstimate: 6400,
    sceneContext: 'Nighttime courtyard ensemble scene as the Songwriter hosts a cocktail party around his baby grand piano while Jeff and Lisa watch in the dark.',
    architecturalFeatureHighlighted: 'East Wing multi-pane steel casement studio window, vaulted skylight, and background street neon bar marquee through the north alley.',
    lightingNotes: '6400K cool moonlight overhead stage fill contrasted against 2700K warm apartment lamps and cyan-blue studio party bounce.',
    notes: 'Benchmark dark-scene exposure reference showing balance between cool moonlight courtyard fill (6400K) and warm 2700K tungsten apartment interiors.',
    customMetadata: [
      { key: 'Practical Lamp Ratio', value: '8:1 interior-to-courtyard luminance' }
    ],
    includedInExport: true,
    cropRegion: '3840x2304 (Full Frame)'
  },
  {
    id: 'frame-06-reverse-jeff-window',
    title: 'Courtyard Reverse Angle Looking Up at Jeffries Bay Window',
    sourceType: 'web_archival_still',
    smpteTimecode: '01:36:52:06',
    frameNumber: 139350,
    durationWindowSec: 1.0,
    useTemporalMedianStack: false,
    role: 'fspy_geometry',
    targetApartmentId: 'apt-jeffries',
    focalLengthMm: 50,
    sampledKeyColorHex: '#FBBF24',
    sampledShadowColorHex: '#111827',
    kelvinEstimate: 3200,
    sceneContext: 'Climax confrontation & Paramount Stage 18 archival publicity still taken from the courtyard floor looking back up into Jeffs apartment (#2B).',
    architecturalFeatureHighlighted: 'Jeffries exterior 3-window bay projection, deep wooden sill, flanking sash proportions (32"-48"-32"), and interior room depth.',
    lightingNotes: 'Stealth low-key interior bounce inside Jeffs apartment prior to the 50,000-lumen Graflex #5 flashbulb discharge.',
    notes: 'Crucial reverse-POV shot from Thorwald/Courtyard perspective + Paramount Stage 18 publicity still showing the exterior masonry and three-window bay of Jeffs apartment.',
    customMetadata: [
      { key: 'Bay Window Span', value: '11.5 ft total width (Center 4.0 ft, Flanks 2.8 ft)' }
    ],
    includedInExport: true,
    cropRegion: '3840x2304 (Full Frame)'
  }
];

export const CAMERA_OPTICAL_PRESETS: CameraOpticalPreset[] = [
  {
    id: 'cam-35mm-wide',
    label: '35mm Mitchell BNC Wide (Establishing)',
    shortLabel: '35mm Wide',
    cameraBody: 'Mitchell BNC (1.66:1 Academy Gate)',
    lensModel: 'Bausch & Lomb 35mm Baltar f/2.3',
    focalLengthMm: 35,
    fovDegrees: 42,
    position: [0, 14.8, 20.5],
    target: [0, 10.5, -20],
    reticleMode: 'mitchell_academy',
    description: 'Seated inside Jeffries apartment looking through the three-window bay across the entire Stage 18 courtyard.'
  },
  {
    id: 'cam-50mm-normal',
    label: '50mm Mitchell BNC Normal (Jeff Seated Eye)',
    shortLabel: '50mm Eye POV',
    cameraBody: 'Mitchell BNC (1.66:1 Academy Gate)',
    lensModel: 'Bausch & Lomb 50mm Baltar f/2.3',
    focalLengthMm: 50,
    fovDegrees: 30,
    position: [0, 14.5, 18.2],
    target: [-4, 11.0, -22],
    reticleMode: 'none',
    description: 'Natural human perspective from Jeffs wheelchair positioned 4 feet behind the center window sill.'
  },
  {
    id: 'cam-75mm-binoculars',
    label: '75mm Bausch & Lomb Binoculars POV',
    shortLabel: '75mm Binoculars',
    cameraBody: 'Subjective Binocular Matte',
    lensModel: 'Bausch & Lomb 7×35 Zephyr Optics',
    focalLengthMm: 75,
    fovDegrees: 20,
    position: [0, 14.5, 17.5],
    target: [-11, 13.0, -24],
    reticleMode: 'binoculars',
    description: 'Medium-telephoto magnification used when Jeff scans across Miss Torso and Thorwalds apartments.'
  },
  {
    id: 'cam-152mm-exakta',
    label: '152mm Exakta VX Telephoto POV',
    shortLabel: '152mm Exakta SLR',
    cameraBody: 'Ihagee Exakta VX 35mm SLR',
    lensModel: 'Kilfitt Fern-Kilar 152mm / 400mm f/5.6',
    focalLengthMm: 152,
    fovDegrees: 11,
    position: [0, 14.5, 17.2],
    target: [-11, 13.0, -24],
    reticleMode: 'exakta_slr',
    description: 'High-compression telephoto view through Jeffs Exakta waist/eye viewfinder with split-image rangefinder reticle.'
  },
  {
    id: 'cam-stage18-orbit',
    label: 'Stage 18 Soundstage Overview (Free Orbit)',
    shortLabel: 'Stage 18 Overview',
    cameraBody: 'Paramount Stage 18 Crane Rig',
    lensModel: '28mm Wide Architectural Survey',
    focalLengthMm: 28,
    fovDegrees: 50,
    position: [26, 28, 34],
    target: [-2, 8, -8],
    reticleMode: 'none',
    description: 'External architectural overview showing the relationship between Jeffries foreground room and the excavated courtyard.'
  }
];

export const LIGHTING_SCENARIOS: LightingScenarioPreset[] = [
  {
    id: 'light-golden-hour',
    label: 'Signature Golden Hour (5:45 PM Slanted Sun)',
    shortLabel: 'Golden Hour',
    filmTimestampRef: '00:26:40:00',
    sunElevationDeg: 28,
    sunAzimuthDeg: -42,
    sunColorHex: '#FDBA74',
    sunIntensity: 3.2,
    skyHemiColorHex: '#93C5FD',
    groundHemiColorHex: '#451A03',
    ambientIntensity: 0.75,
    practicalLampIntensity: 1.4,
    jeffInteriorLampIntensity: 0.9,
    fogColorHex: '#1C1917',
    cyclesKelvinKey: 3650,
    cyclesExposure: 1.15,
    description: 'Warm incandescent arc-light bounce across the red-brick North and East wings with deep theatrical courtyard shadows.'
  },
  {
    id: 'light-morning-heat',
    label: 'Morning Heatwave (9:30 AM High Key)',
    shortLabel: 'Morning Heat',
    filmTimestampRef: '00:01:42:12',
    sunElevationDeg: 58,
    sunAzimuthDeg: 32,
    sunColorHex: '#FEF08A',
    sunIntensity: 3.6,
    skyHemiColorHex: '#BAE6FD',
    groundHemiColorHex: '#57534E',
    ambientIntensity: 1.1,
    practicalLampIntensity: 0.3,
    jeffInteriorLampIntensity: 0.4,
    fogColorHex: '#1E293B',
    cyclesKelvinKey: 5200,
    cyclesExposure: 1.25,
    description: 'High-angle overhead Stage 18 daylight bank replicating the sweltering 94°F Greenwich Village morning opening pan.'
  },
  {
    id: 'light-nocturnal',
    label: 'Nocturnal Practicals (11:15 PM Interior Glow)',
    shortLabel: 'Night Practicals',
    filmTimestampRef: '01:08:15:04',
    sunElevationDeg: 18,
    sunAzimuthDeg: 15,
    sunColorHex: '#38BDF8',
    sunIntensity: 0.45,
    skyHemiColorHex: '#1E3A8A',
    groundHemiColorHex: '#090D16',
    ambientIntensity: 0.25,
    practicalLampIntensity: 4.2,
    jeffInteriorLampIntensity: 0.2,
    fogColorHex: '#090D16',
    cyclesKelvinKey: 6500,
    cyclesExposure: 0.95,
    description: 'Jeffries apartment plunged into stealth darkness while warm 2700K tungsten practicals illuminate Thorwald, Miss Torso, and the Composer.'
  },
  {
    id: 'light-flashbulb',
    label: 'Climax Flashbulb Strobe (1:10 AM Blindness Rig)',
    shortLabel: 'Flashbulb Rig',
    filmTimestampRef: '01:44:12:18',
    sunElevationDeg: 15,
    sunAzimuthDeg: 10,
    sunColorHex: '#60A5FA',
    sunIntensity: 0.3,
    skyHemiColorHex: '#172554',
    groundHemiColorHex: '#05080F',
    ambientIntensity: 0.2,
    practicalLampIntensity: 3.5,
    jeffInteriorLampIntensity: 0.15,
    fogColorHex: '#070A10',
    cyclesKelvinKey: 3800,
    cyclesExposure: 1.05,
    description: 'High-contrast nocturnal setup armed with a 50,000-lumen Graflex #5 clear flashbulb pulse from Jeffs window position.'
  }
];

export const PIPELINE_PHASES: PipelinePhase[] = [
  {
    id: 'phase-1',
    phaseNumber: '01',
    title: 'Lossless 4K Remux Ingestion & User-Guided Hero Frame Curation',
    subtitle: '75 GB HEVC 10-bit BT.2020/PQ MKV → 16-bit Linear PNG Reference Plates',
    summary:
      'Instead of dumping 161,000 frames from the 75 GB 4K Blu-ray remux, this phase uses fast keyframe seeking and temporal median stacking on your curated Hero Reference Frames to produce grain-free, actor-free 16-bit PNG plates with accurate HDR-to-Linear tone mapping.',
    deliverable: 'Curated directory of 16-bit Linear/sRGB 4K PNG plates (`3840×2304`) + clean median-stacked texture plates.',
    linkedBarrierIds: ['barrier-hdr-grain', 'barrier-nodal-parallax'],
    tasks: [
      {
        id: 't1-1',
        title: 'Probe 75 GB MKV Stream Metadata & Mastering Luminance',
        detail: 'Inspect video stream index, frame rate (24000/1001), mastering display metadata (SMPTE ST 2086), and chapter boundaries using ffprobe.',
        toolUsed: 'FFmpeg',
        estimatedHours: 1,
        cliOrActionSnippet: 'ffprobe -v error -select_streams v:0 -show_entries stream=width,height,color_space,color_transfer,color_primaries "Rear_Window_1954_4K_Remux.mkv"'
      },
      {
        id: 't1-2',
        title: 'Pin Representative Hero Frames by Engineering Role',
        detail: 'Use the Frame Curator tab to lock specific SMPTE timestamps for (A) fSpy Geometry, (B) Clean Texture Plates, (C) 152mm Set Dressing, and (D) Master Lighting.',
        toolUsed: 'Python / OpenCV',
        estimatedHours: 2,
        cliOrActionSnippet: 'Select or add target SMPTE timestamps in the Hero Frame Curator tab to dynamically populate 01_extract_4k_remux_frames.sh'
      },
      {
        id: 't1-3',
        title: 'Execute Lossless PQ-to-Linear 16-bit PNG Extraction & Median Actor Removal',
        detail: 'Run the generated FFmpeg script with zscale color-transfer conversion and tmix temporal median filtering across static 3-second windows to strip film grain and moving actors.',
        toolUsed: 'FFmpeg',
        estimatedHours: 2,
        cliOrActionSnippet: 'ffmpeg -ss 00:58:12.16 -t 4.0 -i "Rear_Window_4K.mkv" -vf "tmix=frames=24:weights=1,zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709:t=iec61966-2-1,format=rgb48le" -frames:v 1 clean_plate.png'
      }
    ]
  },
  {
    id: 'phase-2',
    phaseNumber: '02',
    title: 'Optical Calibration, fSpy Metrology & Stage 18 Scale Locking',
    subtitle: 'Solving Mitchell BNC Focal Lengths & Paramount Stage 18 Dimensions',
    summary:
      'Because the camera pans from a fixed tripod inside Jeffries apartment, multi-view photogrammetry fails. We solve camera intrinsics and building distances using 2-point and 3-point vanishing lines in fSpy anchored to standard American brick courses (3 bricks + mortar = 8.0 inches).',
    deliverable: 'Calibrated .fspy project files + Blender Camera Rig with locked 35mm, 50mm, 75mm, and 152mm nodal cameras.',
    linkedBarrierIds: ['barrier-nodal-parallax', 'barrier-forced-perspective', 'barrier-focal-jumps'],
    tasks: [
      {
        id: 't2-1',
        title: 'Configure Mitchell BNC 1.66:1 Academy Aperture in fSpy',
        detail: 'Set custom film back size to 21.95mm × 16.00mm (1954 Paramount widescreen matte) and align X/Y vanishing axes along Thorwalds limestone window lintels and vertical brick pilasters.',
        toolUsed: 'fSpy',
        estimatedHours: 3,
        cliOrActionSnippet: 'Film Gate: 21.95mm × 16.00mm | Reference Distance: Vertical Brick Pilaster (90 Courses = 240.0 inches / 20.0 ft)'
      },
      {
        id: 't2-2',
        title: 'Cross-Validate Stage 18 Footprint Against Archival Floorplans',
        detail: 'Verify solved depth from Jeffs bay window (Z = +22 ft) to Thorwalds wall (Z = -24 ft, total 46 ft courtyard span) and the excavated -6 ft basement garden.',
        toolUsed: 'Archival Blueprints',
        estimatedHours: 2,
        cliOrActionSnippet: 'Stage 18 Envelope: 185 ft Length × 50 ft Courtyard Width × 40 ft Height (including excavated basement level)'
      },
      {
        id: 't2-3',
        title: 'Bind User Hero Frames to Blender Camera Background Slots',
        detail: 'Run 04_setup_cycles_lighting_and_cameras.py to spawn virtual cameras for every pinned frame with the extracted 4K PNG attached at 50% opacity.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 1,
        cliOrActionSnippet: 'cam.data.show_background_images = True; bg = cam.data.background_images.new(); bg.alpha = 0.5'
      }
    ]
  },
  {
    id: 'phase-3',
    phaseNumber: '03',
    title: 'Modular Architectural Blocking & Procedural Masonry',
    subtitle: 'Constructing Jeffries Bay Window, 31 Courtyard Units & Excavated Garden',
    summary:
      'Generate the foundational Stage 18 structural shell using our Python bpy builder script, then refine modular double-hung sash windows, cast-iron fire escapes, rooftop water towers, and stepped cornices using Blender Collection Instancing.',
    deliverable: 'Dimensionally verified Blender architectural scene organized into 31 Apartment Collections.',
    linkedBarrierIds: ['barrier-forced-perspective', 'barrier-blind-zones', 'barrier-vram-budget'],
    tasks: [
      {
        id: 't3-1',
        title: 'Execute 03_build_stage18_architecture.py Procedural Base Mesh',
        detail: 'Run the generated Python script inside Blender Scripting workspace to instantiate Jeffs foreground room, the three-window bay frame, excavated courtyard floor, and all surrounding building volumes.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 2,
        cliOrActionSnippet: 'blender --python 03_build_stage18_architecture.py'
      },
      {
        id: 't3-2',
        title: 'Model Instanced Double-Hung Sash Windows & Venetian Blinds',
        detail: 'Create a master parametric window assembly (frame, upper/lower sash, glass panes, stone lintel, sill, and adjustable roller shade/blind) instanced across 84 courtyard window openings.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 6,
        cliOrActionSnippet: 'Use Alt+D linked duplicates + Object Info Random socket to vary sash open height (0" to 28") and blind tilt'
      },
      {
        id: 't3-3',
        title: 'Construct Wrought-Iron Fire Escapes, Balconies & Rooftop Water Tower',
        detail: 'Build modular steel slat landings, diagonal stair flights, and gooseneck ladders along the West and North facades, plus the cedar rooftop water tank.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 5,
        cliOrActionSnippet: 'Array Modifier + Curve Modifier for wrought-iron balusters; bevel = 2mm with weighted normals'
      }
    ]
  },
  {
    id: 'phase-4',
    phaseNumber: '04',
    title: 'Hero Interior (Jeffries Apartment) & Frame-Prioritized Set Decoration',
    subtitle: 'View-Frustum Tiered Prop Modeling Guided by 152mm Telephoto Stills',
    summary:
      'Allocate modeling budget strictly by camera proximity and user-selected Hero Frames: sub-millimeter detail for Jeffries window sill, wheelchair, and Exakta VX camera; mid-poly furnished interiors for the 12 primary neighbor apartments; and parallax planes for secondary windows.',
    deliverable: 'Fully dressed foreground apartment + 12 furnished neighbor apartment interiors.',
    linkedBarrierIds: ['barrier-vram-budget', 'barrier-blind-zones', 'barrier-window-glass'],
    tasks: [
      {
        id: 't4-1',
        title: 'Model Tier 1 Foreground Hero Assets in Jeffries Apartment',
        detail: 'Construct the three-panel sash window with locks/pulleys, Exakta VX SLR body, Kilfitt 152mm/400mm telephoto lens barrel, Graflex flashgun reflector, wheelchair, plaster cast, and photo worktable.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 14,
        cliOrActionSnippet: 'Subdivision Surface Level 2 + 4K UDIM textures on window frame, Exakta VX chrome/leatherette, and Graflex flash reflector'
      },
      {
        id: 't4-2',
        title: 'Dress Tier 2 Hero Neighbor Interiors (Thorwald, Torso, Composer, Lonelyhearts)',
        detail: 'Using the 152mm telephoto reference frames, model Thorwalds 4-room railroad layout (bed, floral wallpaper, sample case, telephone), Composers baby grand piano, and Sculptors patio.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 16,
        cliOrActionSnippet: 'Align interior partition walls to 152mm Exakta camera frustum rays so through-window sightlines match frame 00:44:18:12'
      },
      {
        id: 't4-3',
        title: 'Configure Frustum-Driven Collection Visibility & Interior Parallax Planes',
        detail: 'Assign the 19 minor apartments to Tier 3 emissive/parallax room cards and link Collection visibility to the active camera lens.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 4,
        cliOrActionSnippet: 'Enable Cycles Camera Ray Culling on Tier 2 interior furniture collections when rendering wide 35mm views'
      }
    ]
  },
  {
    id: 'phase-5',
    phaseNumber: '05',
    title: 'PBR Texturing, Camera-Projected Clean Plates & Technicolor Shaders',
    subtitle: 'Hybrid De-Lighted 4K Film Projection + Procedural Brick & Soot Weathering',
    summary:
      'Combine camera-projected 4K clean plates from the remux with procedural Blender Shader Nodes so the masonry retains authentic 1954 Paramount scenic paint variations while remaining razor-sharp at any focal length.',
    deliverable: 'Complete PBR material library calibrated for 1954 three-strip Technicolor / Eastmancolor spectral response.',
    linkedBarrierIds: ['barrier-hdr-grain', 'barrier-window-glass', 'barrier-technicolor-lut'],
    tasks: [
      {
        id: 't5-1',
        title: 'Project De-Lighted 4K Clean Plates via UV Project Modifier',
        detail: 'Project the median-stacked clean plates from CAM_01_Jeff_Wide_35mm onto the courtyard walls to capture Hal Pereiras exact scenic brick color variations and mortar aging.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 6,
        cliOrActionSnippet: 'Modifier: UV Project (Projector: CAM_01_Jeff_Wide_35mm) -> Mix 65% with Procedural Brick Texture for micro-relief'
      },
      {
        id: 't5-2',
        title: 'Author Architectural Glass Shader with Cycles Light Path Trick',
        detail: 'Prevent neighbor window glass from blocking interior light or creating noisy fireflies by mixing Glossy BSDF and Transparent BSDF via the Is Shadow Ray / Is Diffuse Ray light path node.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 3,
        cliOrActionSnippet: 'Light Path (Is Shadow Ray + Is Diffuse Ray) -> Mix Shader Factor (1.0 = Transparent BSDF, 0.0 = Fresnel Glass)'
      },
      {
        id: 't5-3',
        title: 'Add Ambient Occlusion Soot, Water Streaks & Peeling Paint Masks',
        detail: 'Drive vertical grime streaks beneath limestone window sills and cast-iron fire escape brackets using Ambient Occlusion multiplied with stretched Musgrave/Noise textures.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 5,
        cliOrActionSnippet: 'Texture Coordinate (Object) -> Mapping (Scale Z: 0.15) -> Noise -> ColorRamp -> Multiply with AO Node'
      }
    ]
  },
  {
    id: 'phase-6',
    phaseNumber: '06',
    title: 'Dynamic Stage 18 Lighting Rig, Light Groups & Cycles Rendering',
    subtitle: 'Matching Robert Burks (ASC) Studio Banks, Practicals & Flashbulb Strobe',
    summary:
      'Replicate the thousands of overhead incandescent studio lamps on Paramount Stage 18 using Cycles Light Groups, allowing you to transition seamlessly between Golden Hour, Nocturnal Practicals, and the Flashbulb discharge in the Blender Compositor from a single multi-layer EXR render.',
    deliverable: 'Final 4K Cycles render + Multi-Layer EXR compositor setup with 1954 Technicolor dye-transfer grading.',
    linkedBarrierIds: ['barrier-technicolor-lut', 'barrier-vram-budget'],
    tasks: [
      {
        id: 't6-1',
        title: 'Run 04_setup_cycles_lighting_and_cameras.py to Build 6 Light Groups',
        detail: 'Instantiate Courtyard_Sun_Key, Skylight_Bounce_Fill, Neighbor_Practical_Lamps, Street_Alley_Background, Jeff_Interior_Practicals, and Flashbulb_Strobe with Blackbody Kelvin nodes.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 3,
        cliOrActionSnippet: 'blender --python 04_setup_cycles_lighting_and_cameras.py'
      },
      {
        id: 't6-2',
        title: 'Calibrate Color Temperatures Against User Sampled Lighting Frame',
        detail: 'Apply the Kelvin and RGB values sampled from your Master Lighting Target Frame in the Frame Curator (e.g., 3650K Golden Hour key vs 6400K Skylight fill and 2700K interior tungsten lamps).',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 3,
        cliOrActionSnippet: 'Blackbody Node: Sun Key = 3650K | Neighbor Lamps = 2650K | Miss Lonelyhearts Candles = 1900K | Flashbulb = 3800K'
      },
      {
        id: 't6-3',
        title: 'Render Multi-Layer EXR with OpenImageDenoise & Technicolor Compositor LUT',
        detail: 'Render at 3840×2304 (2048 samples, Adaptive Sampling 0.005, Albedo+Normal OIDN prefilter) and apply subtle 3-strip dye-transfer saturation curves and 35mm halation in Compositor.',
        toolUsed: 'Blender 4.2 LTS',
        estimatedHours: 4,
        cliOrActionSnippet: 'Render Engine: Cycles GPU | Color Management: AgX (Medium High Contrast) + Compositor LightGroup Mix + Glare (Fog Glow)'
      }
    ]
  }
];

export const TECHNICAL_BARRIERS: TechnicalBarrier[] = [
  {
    id: 'barrier-nodal-parallax',
    code: 'BARRIER 01 · OPTICAL GEOMETRY',
    title: 'Zero-Baseline Nodal Camera Panning Defeats Automated Photogrammetry',
    category: 'Optical & Camera',
    severity: 'Critical',
    opticalOrTechnicalCause:
      'Roughly 95% of Rear Window was filmed from inside L.B. Jefferies apartment with the Mitchell BNC rotating on a geared pan/tilt head. Pure rotation around a fixed nodal point produces projective homography with almost zero stereoscopic baseline (B ≈ 0), making depth triangulation mathematically degenerate.',
    symptomsInBlender:
      'Feeding extracted MKV frames into Meshroom, COLMAP, or RealityCapture produces a collapsed spherical shell or inverted depth noise rather than a 3D courtyard.',
    engineeredWorkaround:
      'Bypass multi-view SfM photogrammetry for the building shells. Instead, use fSpy single-frame vanishing-point metrology on user-selected Role A Geometry Frames anchored to known architectural standards (American common brick course = 2.667" vertical pitch; standard 36"×72" double-hung windows), cross-checked against the few non-Jeffries reverse/courtyard shots (01:17:42 & 01:48:10).',
    blenderOrFfmpegSolution:
      'Use the fSpy Optical Calibration preset + 03_build_stage18_architecture.py to generate orthogonal geometry locked to the solved camera frustum.',
    associatedScriptTab: 'fspy'
  },
  {
    id: 'barrier-forced-perspective',
    code: 'BARRIER 02 · POV-CHEATED SOUNDSTAGE GEOMETRY',
    title: 'Inaccurate Architectural Standards vs. Camera-POV Forced Perspective & Odd Room Angles',
    category: 'Architecture & Scale',
    severity: 'Critical',
    opticalOrTechnicalCause:
      'Published studio publicity sheets and municipal architectural standards are inaccurate for Stage 18 because Hal Pereira & J. McMillan Johnson built the entire courtyard solely to look convincing from L.B. Jefferies camera POV (0, +14.5, +18.2 ft). Rooms furthest from the camera (Thorwalds flat, 3rd-floor Composer studio, Miss Torsos oblique apartment, and the North Alleyway) were built as compressed shallow shadowboxes (0.66× to 0.88× scale) with non-orthogonal trapezoidal walls splayed +6.8° to +14.5° toward Jeffs lens and raked floors (+2.4° to +4.8°).',
    symptomsInBlender:
      'Assuming standard 90° orthogonal room walls, uniform 3-courses=8" brick gauge, or full 16–22 ft apartment depths causes distant rooms to punch through the physical Stage 18 walls and causes window jambs on oblique wings (West/East) to occlude the actors and furniture seen in the film.',
    engineeredWorkaround:
      'Apply a radial Camera-POV Forced-Perspective & Sightline Splay Solver anchored at Jeffries nodal point: attenuate physical Z-depth by radial distance from the camera, splay side walls open along the sightline ray (cameraSightlineSplayDeg), and rake distant floors/alleys (floorRakePitchDeg) so the 3D geometry matches both Stage 18 physical carpentry and the 4K film frames.',
    blenderOrFfmpegSolution:
      '03_build_stage18_architecture.py & 05_apply_ai_iterative_layout_deltas.py shear and splay room vertices along the camera sightline vector and apply per-zone forced-perspective scale factors.',
    associatedScriptTab: 'architecture'
  },
  {
    id: 'barrier-hdr-grain',
    code: 'BARRIER 03 · 4K REMUX PIPELINE',
    title: '75 GB 4K HDR10 PQ Transfer Curve, 1954 Film Grain & Actor Occlusion',
    category: '4K Remux & Color',
    severity: 'Critical',
    opticalOrTechnicalCause:
      'A 75 GB 4K UHD Blu-ray remux is encoded in 10-bit HEVC with BT.2020 primaries and SMPTE ST 2084 (PQ) perceptual quantizer transfer. Naive frame grabs look washed-out and desaturated, while heavy 1954 35mm grain, 1/48s motion blur during pans, and actors crossing windows corrupt projected textures.',
    symptomsInBlender:
      'Projected wall textures appear milky/clipped in Cycles, and baked brick maps contain ghosted silhouettes of James Stewart, Grace Kelly, or Lars Thorwald.',
    engineeredWorkaround:
      'Pin static user-selected Clean Texture Plates in the Frame Curator and run FFmpeg with explicit zscale PQ-to-Linear/BT.709 16-bit PNG conversion paired with a 24-frame temporal median filter (tmix) that averages out film grain and erases moving actors.',
    blenderOrFfmpegSolution:
      '01_extract_4k_remux_frames.sh automates zscale transfer mapping and multi-frame temporal median stacking.',
    associatedScriptTab: 'ffmpeg'
  },
  {
    id: 'barrier-focal-jumps',
    code: 'BARRIER 04 · MULTI-LENS REGISTRATION',
    title: 'Extreme Focal Length Jumps (35mm Wide vs. 75mm Binoculars vs. 152mm Exakta)',
    category: 'Optical & Camera',
    severity: 'High',
    opticalOrTechnicalCause:
      'Hitchcock cuts between 35mm/50mm studio lenses on the Mitchell BNC and tight 75mm/152mm/400mm telephoto POV shots. Telephoto lenses compress depth dramatically and were sometimes shot with the camera nudged forward toward the window glass to avoid catching the window mullions.',
    symptomsInBlender:
      'Details modeled from a 152mm telephoto frame of Thorwalds bedroom appear slightly shifted or occluded by Jeffs window sash when viewed from the 35mm master camera.',
    engineeredWorkaround:
      'Establish the global world coordinate system strictly from the 35mm wide master frame first. Parent dedicated 75mm and 152mm sub-cameras to Jeffs tripod rig with a documented +1.8 ft Z-axis nodal offset to match Robert Burkss physical lens barrel clearance.',
    blenderOrFfmpegSolution:
      '04_setup_cycles_lighting_and_cameras.py creates parented multi-focal camera rigs with accurate sensor gate and nodal offsets.',
    associatedScriptTab: 'lighting'
  },
  {
    id: 'barrier-blind-zones',
    code: 'BARRIER 05 · OCCLUDED GEOMETRY',
    title: 'Permanent Occlusion Zones & Unseen Exterior of Jeffries Apartment',
    category: 'Architecture & Scale',
    severity: 'Moderate',
    opticalOrTechnicalCause:
      'Because the audience shares Jeffs restricted viewpoint, surfaces perpendicular to the sightline (courtyard side alleys, undersides of fire escape landings, rear walls of Jeffries own room, and Jeffs exterior brick facade) are rarely or never seen in the film.',
    symptomsInBlender:
      'Moving the Blender camera even 5 feet off-axis or rendering wide reflections in window glass reveals empty geometry gaps behind Jeffs camera position.',
    engineeredWorkaround:
      'Supplement the 4K MKV remux with two specific sources: (1) the climax reverse-angle shots from the courtyard looking up at Jeffs window (01:36:52 & 01:46:15) and (2) archival Paramount Stage 18 production stills showing Hitchcock and Stewart inside the three-window bay.',
    blenderOrFfmpegSolution:
      'Frame Curator includes the 01:36:52 reverse-angle reference plate and 03_build_stage18_architecture.py generates complete closed-manifold walls for Jeffries apartment.',
    associatedScriptTab: 'architecture'
  },
  {
    id: 'barrier-vram-budget',
    code: 'BARRIER 06 · COMPUTATIONAL SCALE',
    title: 'VRAM Exhaustion & Ray-Tracing Overhead Across 31 Detailed Apartments',
    category: 'Lighting & VRAM',
    severity: 'High',
    opticalOrTechnicalCause:
      'Stage 18 contains 31 apartments (12 fully furnished in the real set), hundreds of window panes, intricate cast-iron fire escapes, and thousands of brick courses. Naive high-poly modeling and 8K textures across all 31 units will exceed 16–24 GB of GPU VRAM in Cycles.',
    symptomsInBlender:
      'Cycles reports "System is out of GPU memory" during BVH build or takes hours per frame due to deep multi-bounce transmission rays through dozens of windows.',
    engineeredWorkaround:
      'Enforce a strict 3-Tier View-Frustum LOD hierarchy driven by your selected Hero Frames: Tier 1 (Jeffs interior + Thorwalds flat), Tier 2 (10 furnished neighbor rooms using instanced furniture), and Tier 3 (19 background units using emissive parallax planes).',
    blenderOrFfmpegSolution:
      '03_build_stage18_architecture.py partitions geometry into Tier 1/2/3 Collections with automated camera-frustum visibility toggles.',
    associatedScriptTab: 'architecture'
  },
  {
    id: 'barrier-window-glass',
    code: 'BARRIER 07 · CYCLES PATH TRACING',
    title: 'Window Glass Caustics, Fireflies & Double-Pane Reflection Ghosting',
    category: 'Lighting & VRAM',
    severity: 'Moderate',
    opticalOrTechnicalCause:
      'Every sightline from Jeffries apartment passes through Jeffs own window panes AND the neighbors window panes. In an unbiased path tracer like Cycles, lighting interior rooms through two layers of refractive dielectric glass causes severe noise ("fireflies") and energy loss.',
    symptomsInBlender:
      'Neighbor apartment interiors look dark and noisy even at 4096 samples, or Jeffs room reflects too strongly over the courtyard.',
    engineeredWorkaround:
      'Use an Architectural Thin-Glass Shader in Blender that bypasses refractive caustics for shadow and diffuse rays (`Light Path -> Is Shadow Ray / Is Diffuse Ray -> Transparent BSDF`) while preserving physically accurate Fresnel specular reflections for camera rays.',
    blenderOrFfmpegSolution:
      'Included directly in the procedural glass material generator inside 03_build_stage18_architecture.py.',
    associatedScriptTab: 'architecture'
  },
  {
    id: 'barrier-technicolor-lut',
    code: 'BARRIER 08 · SPECTRAL COLORIMETRY',
    title: 'Replicating 1954 Technicolor Dye-Transfer & Incandescent Arc Lighting',
    category: '4K Remux & Color',
    severity: 'Moderate',
    opticalOrTechnicalCause:
      'Rear Window was photographed on Eastmancolor negative and printed via three-strip Technicolor imbibition dye transfer under massive banks of 3200K tungsten and 5000K carbon-arc studio lamps—producing warm terracotta brick reds, rich cyan-blues in shadows, and soft highlight roll-off.',
    symptomsInBlender:
      'Standard sRGB or Filmic renders look clinically digital, with harsh monochromatic shadows and neon-oversaturated primary colors.',
    engineeredWorkaround:
      'Use Blender 4.x AgX color management paired with our Frame Curators HTML5 Canvas Color Sampler to feed real sampled Kelvin/RGB values from the 4K remux into Cycles Light Groups, finished with a 3-strip dye-transfer split-toning curve in the Blender Compositor.',
    blenderOrFfmpegSolution:
      '04_setup_cycles_lighting_and_cameras.py configures AgX color management, Blackbody Kelvin nodes, and Compositor Light Group passes.',
    associatedScriptTab: 'lighting'
  }
];

export type AnalysisEngineMode = 'gemini_cloud_hybrid' | 'local_cv_backup';

export interface ParametricDimensionsSnapshot {
  widthFeet: number;
  heightFeet: number;
  depthFeet: number;
  elevationOffsetFeet: number;
  windowCols: number;
  windowRows: number;
  windowRevealInches: number;
  balconyProjectionFeet: number;
  interiorDepthFeet: number; // True physical Stage 18 compressed carpentry depth
  apparentArchitecturalDepthFeet?: number; // Apparent depth if naively assuming 1:1 architectural standards
  forcedPerspectiveScaleFactor?: number; // 1.00 at Jeff's window -> 0.66 at farthest North Alley backdrop
  cameraSightlineSplayDeg?: number; // Non-orthogonal wall splay angle cheated toward Jeff's lens
  floorRakePitchDeg?: number; // Vertical floor/ceiling rake tilt built for Jeff's +14.5ft POV
}

export type FrameValidityStatus =
  | 'unverified'
  | 'verified_valid'
  | 'geometry_excluded_lighting_only'
  | 'invalid_discarded';

export interface ManualFrameVerification {
  verifiedByUser: boolean;
  validityStatus: FrameValidityStatus;
  placementOffsetFeet: [number, number, number]; // [dX lateral, dY elevation, dZ depth]
  orientationOverrideDeg: {
    pitchDeg: number;
    yawDeg: number;
    rollPlumbDeg: number;
  };
  horizonLineNormalizedY: number; // 0.0 to 1.0 on calibration canvas
  plumbLineNormalizedX: number; // 0.0 to 1.0 on calibration canvas
  forcedPerspectiveScaleOverride?: number;
  cameraSightlineSplayOverrideDeg?: number;
  floorRakePitchOverrideDeg?: number;
  verificationNotes: string;
  verifiedAtIso: string;
}

export interface BuildingParametricOverride extends ParametricDimensionsSnapshot {
  apartmentId: string;
  confidenceScore: number; // 0 to 100
  contributingFramesCount: number;
  lastUpdatedSmpte: string;
  lastEngineUsed: 'baseline_prior' | AnalysisEngineMode;
  placementOffsetFeet?: [number, number, number];
  orientationOverrideDeg?: {
    pitchDeg: number;
    yawDeg: number;
    rollPlumbDeg: number;
  };
  validityStatus?: FrameValidityStatus;
}

export interface CvPrepassTelemetry {
  vanishingPitchDeg: number;
  vanishingYawDeg: number;
  brickCoursesCounted: number;
  detectedWindowBays: number;
  orthogonalEdgePct: number;
  sharpnessScore: number;
  radialDistanceFromJeffFeet?: number;
  estimatedPerspectiveScaleFactor?: number;
  estimatedSightlineSplayDeg?: number;
}

export interface ArchitecturalLayoutIteration {
  id: string;
  frameTitle: string;
  smpteTimecode: string;
  focalLengthMm: number;
  engineUsed: AnalysisEngineMode;
  targetApartmentId: string;
  confidenceScore: number;
  status: 'pending_review' | 'approved' | 'rejected';
  proposedValues: ParametricDimensionsSnapshot;
  previousValues: ParametricDimensionsSnapshot;
  cvPrepassTelemetry: CvPrepassTelemetry;
  spatialReasoningSummary: string;
  detectedFeatures: string[];
  lowConfidenceFlags?: string[];
  manualVerification?: ManualFrameVerification;
  createdAtIso: string;
}

export const INITIAL_BUILDING_PARAMETRIC_OVERRIDES: Record<string, BuildingParametricOverride> = {
  'apt-jeffries': {
    apartmentId: 'apt-jeffries',
    widthFeet: 24.0,
    heightFeet: 10.4,
    depthFeet: 16.0,
    elevationOffsetFeet: 14.5,
    windowCols: 3,
    windowRows: 1,
    windowRevealInches: 8.5,
    balconyProjectionFeet: 0.0,
    interiorDepthFeet: 18.0,
    apparentArchitecturalDepthFeet: 18.0,
    forcedPerspectiveScaleFactor: 1.0,
    cameraSightlineSplayDeg: 0.0,
    floorRakePitchDeg: 0.0,
    confidenceScore: 42,
    contributingFramesCount: 1,
    lastUpdatedSmpte: '01:36:52:25',
    lastEngineUsed: 'baseline_prior'
  },
  'apt-thorwald': {
    apartmentId: 'apt-thorwald',
    widthFeet: 35.2,
    heightFeet: 36.4,
    depthFeet: 10.8,
    elevationOffsetFeet: 13.0,
    windowCols: 4,
    windowRows: 4,
    windowRevealInches: 6.4,
    balconyProjectionFeet: 2.8,
    interiorDepthFeet: 11.4,
    apparentArchitecturalDepthFeet: 16.5,
    forcedPerspectiveScaleFactor: 0.82,
    cameraSightlineSplayDeg: 6.8,
    floorRakePitchDeg: 2.4,
    confidenceScore: 38,
    contributingFramesCount: 1,
    lastUpdatedSmpte: '00:02:14:08',
    lastEngineUsed: 'baseline_prior'
  },
  'apt-torso': {
    apartmentId: 'apt-torso',
    widthFeet: 11.4,
    heightFeet: 34.8,
    depthFeet: 41.5,
    elevationOffsetFeet: 13.5,
    windowCols: 2,
    windowRows: 3,
    windowRevealInches: 7.2,
    balconyProjectionFeet: 2.5,
    interiorDepthFeet: 12.6,
    apparentArchitecturalDepthFeet: 18.0,
    forcedPerspectiveScaleFactor: 0.88,
    cameraSightlineSplayDeg: 11.5,
    floorRakePitchDeg: 1.8,
    confidenceScore: 34,
    contributingFramesCount: 1,
    lastUpdatedSmpte: '00:03:45:12',
    lastEngineUsed: 'baseline_prior'
  },
  'apt-composer': {
    apartmentId: 'apt-composer',
    widthFeet: 11.6,
    heightFeet: 36.2,
    depthFeet: 41.0,
    elevationOffsetFeet: 22.5,
    windowCols: 3,
    windowRows: 3,
    windowRevealInches: 7.8,
    balconyProjectionFeet: 1.4,
    interiorDepthFeet: 13.8,
    apparentArchitecturalDepthFeet: 21.0,
    forcedPerspectiveScaleFactor: 0.85,
    cameraSightlineSplayDeg: -12.0,
    floorRakePitchDeg: 3.5,
    confidenceScore: 36,
    contributingFramesCount: 1,
    lastUpdatedSmpte: '01:08:15:04',
    lastEngineUsed: 'baseline_prior'
  },
  'apt-lonelyhearts': {
    apartmentId: 'apt-lonelyhearts',
    widthFeet: 11.2,
    heightFeet: 34.5,
    depthFeet: 41.2,
    elevationOffsetFeet: 2.5,
    windowCols: 2,
    windowRows: 2,
    windowRevealInches: 6.2,
    balconyProjectionFeet: 0.8,
    interiorDepthFeet: 10.8,
    apparentArchitecturalDepthFeet: 16.0,
    forcedPerspectiveScaleFactor: 0.86,
    cameraSightlineSplayDeg: 9.5,
    floorRakePitchDeg: -3.2,
    confidenceScore: 30,
    contributingFramesCount: 0,
    lastUpdatedSmpte: '00:26:40:00',
    lastEngineUsed: 'baseline_prior'
  },
  'apt-sculptor': {
    apartmentId: 'apt-sculptor',
    widthFeet: 34.5,
    heightFeet: 8.2,
    depthFeet: 24.2,
    elevationOffsetFeet: -4.0,
    windowCols: 2,
    windowRows: 1,
    windowRevealInches: 6.0,
    balconyProjectionFeet: 0.0,
    interiorDepthFeet: 10.4,
    apparentArchitecturalDepthFeet: 14.5,
    forcedPerspectiveScaleFactor: 0.92,
    cameraSightlineSplayDeg: 4.2,
    floorRakePitchDeg: 2.0,
    confidenceScore: 32,
    contributingFramesCount: 0,
    lastUpdatedSmpte: '00:18:22:10',
    lastEngineUsed: 'baseline_prior'
  },
  'apt-alley-street': {
    apartmentId: 'apt-alley-street',
    widthFeet: 14.8,
    heightFeet: 23.5,
    depthFeet: 3.4,
    elevationOffsetFeet: 10.0,
    windowCols: 3,
    windowRows: 3,
    windowRevealInches: 4.2,
    balconyProjectionFeet: 0.4,
    interiorDepthFeet: 5.2,
    apparentArchitecturalDepthFeet: 35.0,
    forcedPerspectiveScaleFactor: 0.66,
    cameraSightlineSplayDeg: 14.5,
    floorRakePitchDeg: 4.8,
    confidenceScore: 28,
    contributingFramesCount: 0,
    lastUpdatedSmpte: '00:02:48:15',
    lastEngineUsed: 'baseline_prior'
  }
};

export interface LearnedStreamSliceSample {
  offsetPercent: number;
  offsetGb: number;
  clusterHexSignature: string;
  keyframeDensityHint: string;
}

export interface LearnedGlobalOpticalLaws {
  radialCompressionSlopePerFoot: number; // e.g., -0.0058 scale attenuation per radial foot from Jeff's window
  obliqueSightlineSplayFactor: number; // e.g., 0.34 deg wall splay per degree of horizontal viewing angle
  eastmancolorKelvinBias: number; // e.g., 3250K warm tungsten/arc equilibrium
  recommendedTmixStackFrames: number; // e.g., 24 frames for 1954 Eastmancolor grain suppression
  averageSeamRmsErrorPx: number; // e.g., 0.85 px after POV forced-perspective compensation
  architecturalSynthesisSummary: string;
}

export interface LearnedZonePrior extends ParametricDimensionsSnapshot {
  apartmentId: string;
  zoneName: string;
  radialDistanceFeet: number;
  brickCourseHeightInches: number;
  sampledKelvin: number;
  learnedConfidenceScore: number;
  observationCount: number;
  lastUpdatedSmpte: string;
  learnedNotes: string;
}

export interface LearnedTrainingRunEntry {
  id: string;
  timestampIso: string;
  sourceMethod:
    | 'in_browser_75gb_slice_and_solver'
    | 'python_full_corpus_json_import'
    | 'manual_seam_calibration'
    | 'gemini_cloud_synthesis';
  framesAssimilated: number;
  streamSizeGb: number;
  keyTakeaway: string;
  avgConfidenceGain: number;
}

export interface Stage18LearnedKnowledgeProfile {
  version: number;
  lastTrainedIso: string;
  totalTrainingRuns: number;
  totalFramesAssimilated: number;
  sourceStreamFingerprint: {
    fileName: string;
    fileSizeGb: number;
    ebmlHeaderHex: string;
    sampledOffsets: LearnedStreamSliceSample[];
  };
  globalOpticalLaws: LearnedGlobalOpticalLaws;
  zonePriors: Record<string, LearnedZonePrior>;
  learnedRulesForFutureBuilds: string[];
  learningHistory: LearnedTrainingRunEntry[];
}

export const INITIAL_STAGE18_LEARNED_KNOWLEDGE_PROFILE: Stage18LearnedKnowledgeProfile = {
  version: 1,
  lastTrainedIso: '2026-11-14T06:00:00.000Z',
  totalTrainingRuns: 1,
  totalFramesAssimilated: 6,
  sourceStreamFingerprint: {
    fileName: 'Rear_Window_1954_UHD_Remux_75GB.mkv',
    fileSizeGb: 74.8,
    ebmlHeaderHex: '1A 45 DF A3',
    sampledOffsets: [
      { offsetPercent: 0, offsetGb: 0.0, clusterHexSignature: '1A 45 DF A3', keyframeDensityHint: 'EBML Master Header + HEVC Main 10 SPS/PPS' },
      { offsetPercent: 15, offsetGb: 11.22, clusterHexSignature: '1F 43 B6 75', keyframeDensityHint: 'Act I Daylight Courtyard Pan Cluster (35mm Wide)' },
      { offsetPercent: 30, offsetGb: 22.44, clusterHexSignature: '1F 43 B6 75', keyframeDensityHint: 'Golden Hour Shadows & Miss Torso West Wing' },
      { offsetPercent: 50, offsetGb: 37.4, clusterHexSignature: '1F 43 B6 75', keyframeDensityHint: 'Thorwald 4-Room Railroad Flat (50mm & 75mm Binocular)' },
      { offsetPercent: 70, offsetGb: 52.36, clusterHexSignature: '1F 43 B6 75', keyframeDensityHint: 'Nocturnal Rain & Songwriter East Wing (3200K Practicals)' },
      { offsetPercent: 85, offsetGb: 63.58, clusterHexSignature: '1F 43 B6 75', keyframeDensityHint: '152mm Exakta Telephoto Inspection Plates' },
      { offsetPercent: 98, offsetGb: 73.3, clusterHexSignature: '1F 43 B6 75', keyframeDensityHint: 'Climax Flashbulb Reverse-Angle on Jeffries Bay Window' }
    ]
  },
  globalOpticalLaws: {
    radialCompressionSlopePerFoot: -0.0058,
    obliqueSightlineSplayFactor: 0.34,
    eastmancolorKelvinBias: 3340,
    recommendedTmixStackFrames: 24,
    averageSeamRmsErrorPx: 0.92,
    architecturalSynthesisSummary:
      'Stage 18 physical set depth attenuates at -0.58% per radial foot from Jeffries nodal origin (0, +14.5, +18.2 ft), reaching 0.82x at Thorwald (43.6 ft) and 0.66x at the North Alley (55.4 ft), while oblique West/East wing walls splay 9.5 deg to 12.0 deg open toward the camera lens.'
  },
  zonePriors: {
    'apt-jeffries': {
      apartmentId: 'apt-jeffries',
      zoneName: "L.B. 'Jeff' Jefferies's Foreground Apartment",
      radialDistanceFeet: 0.0,
      widthFeet: 24.0,
      heightFeet: 10.4,
      depthFeet: 16.0,
      elevationOffsetFeet: 14.5,
      windowCols: 3,
      windowRows: 1,
      windowRevealInches: 8.5,
      balconyProjectionFeet: 0.0,
      interiorDepthFeet: 18.0,
      apparentArchitecturalDepthFeet: 18.0,
      forcedPerspectiveScaleFactor: 1.0,
      cameraSightlineSplayDeg: 0.0,
      floorRakePitchDeg: 0.0,
      brickCourseHeightInches: 2.67,
      sampledKelvin: 3200,
      learnedConfidenceScore: 84,
      observationCount: 2,
      lastUpdatedSmpte: '01:36:52:25',
      learnedNotes: '1:1 foreground optical origin (X=0, Y=+14.5, Z=+18.2 ft); zero forced-perspective compression.'
    },
    'apt-thorwald': {
      apartmentId: 'apt-thorwald',
      zoneName: "Lars & Anna Thorwald's Railroad Flat",
      radialDistanceFeet: 43.6,
      widthFeet: 35.2,
      heightFeet: 36.4,
      depthFeet: 10.8,
      elevationOffsetFeet: 13.0,
      windowCols: 4,
      windowRows: 4,
      windowRevealInches: 6.4,
      balconyProjectionFeet: 2.8,
      interiorDepthFeet: 11.4,
      apparentArchitecturalDepthFeet: 16.5,
      forcedPerspectiveScaleFactor: 0.82,
      cameraSightlineSplayDeg: 6.8,
      floorRakePitchDeg: 2.4,
      brickCourseHeightInches: 2.38,
      sampledKelvin: 2950,
      learnedConfidenceScore: 88,
      observationCount: 4,
      lastUpdatedSmpte: '00:44:18:12',
      learnedNotes: '4-bay railroad corridor compressed to 11.4 ft physical carpentry depth (0.82x scale) with +6.8 deg wall splay.'
    },
    'apt-torso': {
      apartmentId: 'apt-torso',
      zoneName: "Miss Torso's West Wing Studio",
      radialDistanceFeet: 33.4,
      widthFeet: 11.4,
      heightFeet: 34.8,
      depthFeet: 41.5,
      elevationOffsetFeet: 13.5,
      windowCols: 2,
      windowRows: 3,
      windowRevealInches: 7.2,
      balconyProjectionFeet: 2.5,
      interiorDepthFeet: 12.6,
      apparentArchitecturalDepthFeet: 18.0,
      forcedPerspectiveScaleFactor: 0.88,
      cameraSightlineSplayDeg: 11.5,
      floorRakePitchDeg: 1.8,
      brickCourseHeightInches: 2.48,
      sampledKelvin: 3400,
      learnedConfidenceScore: 82,
      observationCount: 3,
      lastUpdatedSmpte: '00:26:40:00',
      learnedNotes: 'West Wing oblique facade built with +11.5 deg wall splay so deep interior remains visible from Jeffries window.'
    },
    'apt-composer': {
      apartmentId: 'apt-composer',
      zoneName: "The Songwriter's Penthouse Studio",
      radialDistanceFeet: 35.1,
      widthFeet: 11.6,
      heightFeet: 36.2,
      depthFeet: 41.0,
      elevationOffsetFeet: 22.5,
      windowCols: 3,
      windowRows: 3,
      windowRevealInches: 7.8,
      balconyProjectionFeet: 1.4,
      interiorDepthFeet: 13.8,
      apparentArchitecturalDepthFeet: 21.0,
      forcedPerspectiveScaleFactor: 0.85,
      cameraSightlineSplayDeg: -12.0,
      floorRakePitchDeg: 3.5,
      brickCourseHeightInches: 2.45,
      sampledKelvin: 4100,
      learnedConfidenceScore: 81,
      observationCount: 2,
      lastUpdatedSmpte: '01:08:15:04',
      learnedNotes: 'East Wing upper studio with -12.0 deg counter-splay and +3.5 deg upward floor rake for baby grand piano sightline.'
    },
    'apt-lonelyhearts': {
      apartmentId: 'apt-lonelyhearts',
      zoneName: "Miss Lonelyhearts's Ground Apartment",
      radialDistanceFeet: 40.4,
      widthFeet: 11.2,
      heightFeet: 34.5,
      depthFeet: 41.2,
      elevationOffsetFeet: 2.5,
      windowCols: 2,
      windowRows: 2,
      windowRevealInches: 6.2,
      balconyProjectionFeet: 0.8,
      interiorDepthFeet: 10.8,
      apparentArchitecturalDepthFeet: 16.0,
      forcedPerspectiveScaleFactor: 0.86,
      cameraSightlineSplayDeg: 9.5,
      floorRakePitchDeg: -3.2,
      brickCourseHeightInches: 2.42,
      sampledKelvin: 2850,
      learnedConfidenceScore: 78,
      observationCount: 2,
      lastUpdatedSmpte: '00:26:40:00',
      learnedNotes: 'Ground-level unit with -3.2 deg downward floor rake to expose dining table from Jeffs +14.5 ft downward angle.'
    },
    'apt-sculptor': {
      apartmentId: 'apt-sculptor',
      zoneName: 'Excavated Courtyard Basement & Garden',
      radialDistanceFeet: 39.4,
      widthFeet: 34.5,
      heightFeet: 8.2,
      depthFeet: 24.2,
      elevationOffsetFeet: -4.0,
      windowCols: 2,
      windowRows: 1,
      windowRevealInches: 6.0,
      balconyProjectionFeet: 0.0,
      interiorDepthFeet: 10.4,
      apparentArchitecturalDepthFeet: 14.5,
      forcedPerspectiveScaleFactor: 0.92,
      cameraSightlineSplayDeg: 4.2,
      floorRakePitchDeg: 2.0,
      brickCourseHeightInches: 2.55,
      sampledKelvin: 4800,
      learnedConfidenceScore: 79,
      observationCount: 2,
      lastUpdatedSmpte: '00:18:22:10',
      learnedNotes: 'Excavated Stage 18 sub-floor (-4.0 ft datum) with +4.2 deg retaining wall taper.'
    },
    'apt-alley-street': {
      apartmentId: 'apt-alley-street',
      zoneName: 'North Alleyway, Street & Bar Marquee',
      radialDistanceFeet: 55.4,
      widthFeet: 14.8,
      heightFeet: 23.5,
      depthFeet: 3.4,
      elevationOffsetFeet: 10.0,
      windowCols: 3,
      windowRows: 3,
      windowRevealInches: 4.2,
      balconyProjectionFeet: 0.4,
      interiorDepthFeet: 5.2,
      apparentArchitecturalDepthFeet: 35.0,
      forcedPerspectiveScaleFactor: 0.66,
      cameraSightlineSplayDeg: 14.5,
      floorRakePitchDeg: 4.8,
      brickCourseHeightInches: 2.12,
      sampledKelvin: 3650,
      learnedConfidenceScore: 86,
      observationCount: 3,
      lastUpdatedSmpte: '00:02:48:15',
      learnedNotes: 'Extreme forced-perspective alley slot (0.66x scale, +14.5 deg converging walls, +4.8 deg raked ramp) compressing 35 ft apparent depth into 5.2 ft.'
    }
  },
  learnedRulesForFutureBuilds: [
    'Apply radial depth attenuation of -0.58%/ft from Jeffries camera origin (0, +14.5, +18.2 ft) to all distant room meshes.',
    'Splay West Wing (+9.5° to +11.5°) and East Wing (-12.0°) interior side walls open toward the camera nodal point to prevent window jamb occlusion.',
    'Scale procedural brick mortar shader Z-pitch from 2.67 in (foreground) down to 2.12 in (North Alley) so telephoto crops match 4K remux plates.',
    'Use 24-frame FFmpeg tmix median stacking on plates with Eastmancolor grain sigma > 2.8 and drive Cycles Blackbody nodes around 2950K–3400K for interior practicals.'
  ],
  learningHistory: [
    {
      id: 'learn-init-baseline',
      timestampIso: '2026-11-14T06:00:00.000Z',
      sourceMethod: 'in_browser_75gb_slice_and_solver',
      framesAssimilated: 6,
      streamSizeGb: 74.8,
      keyTakeaway:
        'Initialized baseline Stage 18 forced-perspective radial curve (1.00x -> 0.66x) and oblique wall splay priors across 7 courtyard zones.',
      avgConfidenceGain: 14
    }
  ]
};


