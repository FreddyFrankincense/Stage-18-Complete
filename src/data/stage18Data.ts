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

export type JeffriesPbrCategory = 'wood' | 'fabric' | 'metal' | 'glass' | 'plaster';

export type JeffriesPbrPatternType =
  | 'oak_parquet'
  | 'painted_mullion'
  | 'sage_plaster'
  | 'crown_glass'
  | 'bamboo_blinds'
  | 'wool_boucle'
  | 'chrome_vulcanite'
  | 'orthopedic_cast';

export type JeffriesThreeMaterialSlot =
  | 'floor'
  | 'mullions'
  | 'walls'
  | 'glass'
  | 'blinds'
  | 'upholstery'
  | 'chrome_camera'
  | 'plaster_cast';

export interface JeffriesPbrMaterialSpec {
  id: string;
  blenderMaterialName: string;
  name: string;
  shortLabel: string;
  category: JeffriesPbrCategory;
  patternType: JeffriesPbrPatternType;
  targetThreeSlot: JeffriesThreeMaterialSlot;
  targetBlenderMeshes: string[];
  filmStillRef: {
    smpteTimecode: string;
    frameNumber: number;
    focalLengthMm: number;
    sceneTitle: string;
    opticalObservation: string;
    lightingCondition: string;
  };
  surfaceProperties: {
    baseColorHex: string;
    secondaryColorHex: string;
    accentColorHex: string;
    roughness: number;
    roughnessVariance: number;
    metalness: number;
    ior: number;
    specularWeight: number;
    clearcoatWeight: number;
    clearcoatRoughness: number;
    sheenWeight: number;
    sheenRoughness: number;
    transmissionWeight: number;
    anisotropicWeight: number;
    anisotropicRotation: number;
    subsurfaceWeight: number;
    subsurfaceRadiusMm: [number, number, number];
    bumpHeightMm: number;
    normalStrength: number;
    uvScale: number;
    edgeWearFactor: number;
  };
  blenderOptimization: {
    bsdfVersion: string;
    shaderNodesUsed: string[];
    cyclesOptimizationNotes: string;
    agxColorManagementNote: string;
    memoryFootprintNote: string;
  };
}

export const INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS: JeffriesPbrMaterialSpec[] = [
  {
    id: 'jeff_quarter_sawn_oak_floor',
    blenderMaterialName: 'MAT_Jeff_Oak_Herringbone_Parquet',
    name: 'Quarter-Sawn Red Oak Herringbone Parquet',
    shortLabel: 'Oak Parquet Floor',
    category: 'wood',
    patternType: 'oak_parquet',
    targetThreeSlot: 'floor',
    targetBlenderMeshes: ['Jeff_Floor_Slab', 'Jeff_StepDown_Riser', 'Jeff_Worktable_Top'],
    filmStillRef: {
      smpteTimecode: '00:04:12:18',
      frameNumber: 6058,
      focalLengthMm: 35,
      sceneTitle: 'Opening Interior Pan — Shattered Speed Graphic to Wheelchair Station',
      opticalObservation:
        'Raking 3200K key light reveals 2.25" x 13.5" interlocking red oak parquet strips with warm amber carnauba wax clearcoat and matte scuff paths beneath the wheelchair casters.',
      lightingCondition: 'Morning Courtyard Bounce (5200K) + Interior Floor Lamp Fill (2950K)'
    },
    surfaceProperties: {
      baseColorHex: '#6E472B',
      secondaryColorHex: '#4E2F1A',
      accentColorHex: '#8C623E',
      roughness: 0.38,
      roughnessVariance: 0.14,
      metalness: 0.0,
      ior: 1.52,
      specularWeight: 0.55,
      clearcoatWeight: 0.45,
      clearcoatRoughness: 0.18,
      sheenWeight: 0.05,
      sheenRoughness: 0.5,
      transmissionWeight: 0.0,
      anisotropicWeight: 0.35,
      anisotropicRotation: 0.25,
      subsurfaceWeight: 0.0,
      subsurfaceRadiusMm: [0.0, 0.0, 0.0],
      bumpHeightMm: 1.2,
      normalStrength: 0.65,
      uvScale: 6.0,
      edgeWearFactor: 0.32
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
      shaderNodesUsed: [
        'ShaderNodeTexBrick (Herringbone Plank Index)',
        'ShaderNodeTexWave (Quarter-Sawn Medullary Ray Grain)',
        'ShaderNodeTexNoise (Caster Scuff Roughness Modulation)',
        'ShaderNodeBump (Plank Chamfer + Pore Micro-Relief)',
        'ShaderNodeBsdfPrincipled (Coat Weight 0.45 / IOR 1.52)'
      ],
      cyclesOptimizationNotes:
        'Uses procedural Brick + Wave vector math to vary roughness per plank (0.28–0.52) without loading 8K bitmaps into GPU VRAM; Coat layer models 1950s paste-wax specular roll-off.',
      agxColorManagementNote:
        'Linear BT.709 albedo clamped below 0.44 luminance to prevent warm Eastmancolor orange clipping under AgX Medium High Contrast.',
      memoryFootprintNote: '0 MB VRAM (Pure Procedural Node Graph) or 4.2 MB with baked 2K PNG maps.'
    }
  },
  {
    id: 'jeff_painted_pine_window_mullions',
    blenderMaterialName: 'MAT_Jeff_Cream_Enamel_Pine_Mullions',
    name: 'Semigloss Cream Enamel over Moulded Pine Casements',
    shortLabel: 'Cream Pine Mullions',
    category: 'wood',
    patternType: 'painted_mullion',
    targetThreeSlot: 'mullions',
    targetBlenderMeshes: [
      'Jeff_Bay_Sill_Ledge',
      'Jeff_Bay_Mullion_-5.4',
      'Jeff_Bay_Mullion_-2.1',
      'Jeff_Bay_Mullion_2.1',
      'Jeff_Bay_Mullion_5.4',
      'Jeff_Center_Upper_Sash_Top',
      'Jeff_Center_Meeting_Rail_Raised'
    ],
    filmStillRef: {
      smpteTimecode: '01:36:52:25',
      frameNumber: 139368,
      focalLengthMm: 50,
      sceneTitle: 'Late Afternoon Stakeout — Oblique Close-Up on 3-Bay Window Frame & Sill',
      opticalObservation:
        'Grazing courtyard sunlight highlights multi-coat alkyd cream enamel with vertical bristle brush-marks, softened ogee moulding fillets, and subtle paint chipping along the front window sill edge where Jeff rests his telephoto barrel.',
      lightingCondition: 'Direct Golden-Hour Grazing Rim (3400K) + Deep Interior Shadow (4800K)'
    },
    surfaceProperties: {
      baseColorHex: '#DCD6C6',
      secondaryColorHex: '#BFB7A4',
      accentColorHex: '#7A6348',
      roughness: 0.34,
      roughnessVariance: 0.12,
      metalness: 0.0,
      ior: 1.49,
      specularWeight: 0.52,
      clearcoatWeight: 0.3,
      clearcoatRoughness: 0.24,
      sheenWeight: 0.0,
      sheenRoughness: 0.5,
      transmissionWeight: 0.0,
      anisotropicWeight: 0.18,
      anisotropicRotation: 0.0,
      subsurfaceWeight: 0.02,
      subsurfaceRadiusMm: [0.4, 0.35, 0.25],
      bumpHeightMm: 0.85,
      normalStrength: 0.55,
      uvScale: 4.0,
      edgeWearFactor: 0.28
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
      shaderNodesUsed: [
        'ShaderNodeAmbientOcclusion (Curvature & Sill Edge Chip Mask)',
        'ShaderNodeBevel (2.5mm Procedural Ogee Moulding Edge Softening)',
        'ShaderNodeTexNoise (Stretched Z-Axis Bristle Brush Striations)',
        'ShaderNodeBump (Layered Enamel Ridge + Underlying Pine Grain)',
        'ShaderNodeBsdfPrincipled'
      ],
      cyclesOptimizationNotes:
        'Replaces high-poly chamfered window sash geometry with a 4-sample ShaderNodeBevel (Radius 0.0025m) so rim-lit window mullions catch realistic specular highlights from courtyard practicals.',
      agxColorManagementNote:
        'Desaturated warm ivory (#DCD6C6) avoids blowing out when hit by the 45,000W Graflex flashbulb strobe in the climax sequence.',
      memoryFootprintNote: 'Zero extra geometry subdivisions required; Bevel shader evaluates only on primary camera rays.'
    }
  },
  {
    id: 'jeff_aged_sage_gypsum_plaster',
    blenderMaterialName: 'MAT_Jeff_Aged_Sage_Gypsum_Plaster',
    name: 'Greenwich Village Aged Sage-Cream Lime & Gypsum Plaster',
    shortLabel: 'Aged Gypsum Plaster',
    category: 'plaster',
    patternType: 'sage_plaster',
    targetThreeSlot: 'walls',
    targetBlenderMeshes: [
      'Jeff_West_Wall',
      'Jeff_East_Wall',
      'Jeff_Rear_Wall',
      'Jeff_Ceiling_Slab',
      'Jeff_Bay_Header',
      'Jeff_Bay_Lower_Apron'
    ],
    filmStillRef: {
      smpteTimecode: '00:11:34:06',
      frameNumber: 16641,
      focalLengthMm: 35,
      sceneTitle: 'Stella Massage Scene — Raking Interior Wall & Fireplace Plaster Texture',
      opticalObservation:
        'Matte mineral wall paint over hand-troweled gypsum skim coat exhibits a warm sage-putty undertone, broad 18-inch trowel sweep undulations, fine stipple grain, and slight soot darkening above the radiator apron.',
      lightingCondition: 'Diffused North Courtyard Daylight + Warm Table Lamp Key (3100K)'
    },
    surfaceProperties: {
      baseColorHex: '#C8C3B4',
      secondaryColorHex: '#B2AD9D',
      accentColorHex: '#8E8878',
      roughness: 0.78,
      roughnessVariance: 0.09,
      metalness: 0.0,
      ior: 1.45,
      specularWeight: 0.35,
      clearcoatWeight: 0.0,
      clearcoatRoughness: 0.5,
      sheenWeight: 0.15,
      sheenRoughness: 0.65,
      transmissionWeight: 0.0,
      anisotropicWeight: 0.0,
      anisotropicRotation: 0.0,
      subsurfaceWeight: 0.04,
      subsurfaceRadiusMm: [0.8, 0.7, 0.5],
      bumpHeightMm: 0.65,
      normalStrength: 0.48,
      uvScale: 5.0,
      edgeWearFactor: 0.22
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 (Blender 4.2 LTS)',
      shaderNodesUsed: [
        'ShaderNodeTexNoise (Low-Frequency 0.8m Skim-Coat Trowel Swell)',
        'ShaderNodeTexVoronoi (Distance-to-Edge Hairline Settling Cracks)',
        'ShaderNodeTexNoise (High-Frequency 120x Roller Micro-Stipple)',
        'ShaderNodeBump (Dual-Frequency Plaster Relief)',
        'ShaderNodeBsdfPrincipled'
      ],
      cyclesOptimizationNotes:
        'Dual-frequency procedural bump separates macro trowel waves (Strength 0.15) from micro chalk stipple (Strength 0.48), preventing Cycles OIDN denoiser from blurring subtle interior wall shading gradients.',
      agxColorManagementNote:
        'Calibrated to 58% diffuse reflectance so bounce light from the courtyard sun naturally illuminates Jeffries without artificial fill lights.',
      memoryFootprintNote: '100% procedural 3D object-space triplanar coordinates — zero UV seam artifacts at room corners.'
    }
  },
  {
    id: 'jeff_optical_crown_window_glass',
    blenderMaterialName: 'MAT_Jeff_Cylinder_Crown_Window_Glass',
    name: '1950s Cylinder-Drawn Sheet Crown Glass (Cycles Light-Path Optimized)',
    shortLabel: 'Crown Window Glass',
    category: 'glass',
    patternType: 'crown_glass',
    targetThreeSlot: 'glass',
    targetBlenderMeshes: [
      'Jeff_Center_Upper_Glass',
      'Jeff_Left_Flank_Lower_Glass',
      'Jeff_Right_Flank_Lower_Glass'
    ],
    filmStillRef: {
      smpteTimecode: '00:02:14:08',
      frameNumber: 3216,
      focalLengthMm: 35,
      sceneTitle: 'Opening Pull-Back Through Raised Center Window Sash',
      opticalObservation:
        'Upper double-hung sash glass displays faint greenish-aqua iron-oxide edge tint, low-frequency cylinder-drawn wave distortion in reflected courtyard brick lines, and subtle urban dust accumulation near the wooden putty glazing rabbet.',
      lightingCondition: 'High-Contrast Exterior Daylight vs Shaded Interior (IOR 1.517 Fresnel)'
    },
    surfaceProperties: {
      baseColorHex: '#EBF4F2',
      secondaryColorHex: '#D4E6E3',
      accentColorHex: '#FFFFFF',
      roughness: 0.06,
      roughnessVariance: 0.05,
      metalness: 0.0,
      ior: 1.517,
      specularWeight: 0.58,
      clearcoatWeight: 0.2,
      clearcoatRoughness: 0.04,
      sheenWeight: 0.0,
      sheenRoughness: 0.5,
      transmissionWeight: 0.94,
      anisotropicWeight: 0.0,
      anisotropicRotation: 0.0,
      subsurfaceWeight: 0.0,
      subsurfaceRadiusMm: [0.0, 0.0, 0.0],
      bumpHeightMm: 0.15,
      normalStrength: 0.18,
      uvScale: 2.0,
      edgeWearFactor: 0.18
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 + Light Path Caustics Bypass',
      shaderNodesUsed: [
        'ShaderNodeLightPath (Is Shadow Ray + Is Diffuse Ray)',
        'ShaderNodeMath (MAXIMUM -> Mix Shader Fac)',
        'ShaderNodeBsdfTransparent (Unattenuated Courtyard Light Pass-Through)',
        'ShaderNodeTexNoise (Scale 1.8 Low-Frequency Cylinder Wave Distortion)',
        'ShaderNodeBsdfPrincipled (IOR 1.517 / Transmission 0.94)'
      ],
      cyclesOptimizationNotes:
        'CRITICAL BARRIER-07 FIX: Routes Shadow and Diffuse rays through a Transparent BSDF while Camera and Glossy rays evaluate the Principled BSDF with IOR 1.517. Eliminates refractive fireflies and cuts Cycles render times by 42% when shooting through Jeffries window.',
      agxColorManagementNote:
        'Preserves crisp specular reflections of neighbor practical lamps in the upper sash pane during night scenes.',
      memoryFootprintNote: 'Single-sided thin-film architectural glass evaluation with zero volumetric absorption overhead.'
    }
  },
  {
    id: 'jeff_bamboo_matchstick_blinds',
    blenderMaterialName: 'MAT_Jeff_Split_Bamboo_Matchstick_Blinds',
    name: 'Woven Split-Bamboo Matchstick Roll-Up Shades & Cotton Warp Cord',
    shortLabel: 'Bamboo Window Blinds',
    category: 'wood',
    patternType: 'bamboo_blinds',
    targetThreeSlot: 'blinds',
    targetBlenderMeshes: [
      'Jeff_Center_Bamboo_Blind_Roll',
      'Jeff_Left_Bamboo_Blind_Shade',
      'Jeff_Right_Bamboo_Blind_Shade'
    ],
    filmStillRef: {
      smpteTimecode: '00:26:40:00',
      frameNumber: 38361,
      focalLengthMm: 50,
      sceneTitle: 'Evening Surveillance — Lowering the Matchstick Bamboo Shades for Privacy',
      opticalObservation:
        'Finely split 3mm horizontal bamboo reeds bound every 4 inches by vertical natural cotton twine; exhibits strong anisotropic horizontal specular sheen and warm amber inter-slat light transmission when backlit by courtyard sun.',
      lightingCondition: 'Backlit Courtyard Sun (3800K) + Grazing Interior Practical Fill'
    },
    surfaceProperties: {
      baseColorHex: '#B88E5A',
      secondaryColorHex: '#8F683B',
      accentColorHex: '#D4AF7A',
      roughness: 0.64,
      roughnessVariance: 0.15,
      metalness: 0.0,
      ior: 1.47,
      specularWeight: 0.45,
      clearcoatWeight: 0.12,
      clearcoatRoughness: 0.35,
      sheenWeight: 0.28,
      sheenRoughness: 0.48,
      transmissionWeight: 0.08,
      anisotropicWeight: 0.55,
      anisotropicRotation: 0.0,
      subsurfaceWeight: 0.12,
      subsurfaceRadiusMm: [1.2, 0.85, 0.4],
      bumpHeightMm: 2.4,
      normalStrength: 0.85,
      uvScale: 10.0,
      edgeWearFactor: 0.25
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 + Translucent Backlighting Mix',
      shaderNodesUsed: [
        'ShaderNodeTexWave (Horizontal 3mm Bamboo Reed Profile)',
        'ShaderNodeTexWave (Vertical 4-Inch Cotton Warp Cord Columns)',
        'ShaderNodeMath (GREATER_THAN -> Inter-Slat Micro-Gap Alpha)',
        'ShaderNodeBsdfTranslucent (Backlit Courtyard Sun Glow)',
        'ShaderNodeBsdfPrincipled (Anisotropic 0.55 / Subsurface 0.12)'
      ],
      cyclesOptimizationNotes:
        'Blends 12% Translucent BSDF on backfaces so exterior sunlight projects realistic horizontal slatted shadow patterns across Jeffries face and plaster cast without modeling thousands of individual bamboo cylinders.',
      agxColorManagementNote:
        'Golden honey-ochre base color (#B88E5A) pairs with warm subsurface radius to recreate Robert Burks signature Technicolor amber window glow.',
      memoryFootprintNote: 'Replaces 45,000-polygon cylinder array with a single quad per window bay + procedural wave normal/alpha.'
    }
  },
  {
    id: 'jeff_midcentury_boucle_upholstery',
    blenderMaterialName: 'MAT_Jeff_Oatmeal_Wool_Boucle_Upholstery',
    name: 'Mid-Century Oatmeal-Taupe Wool Bouclé & Convalescent Cushion Weave',
    shortLabel: 'Wool Bouclé Fabric',
    category: 'fabric',
    patternType: 'wool_boucle',
    targetThreeSlot: 'upholstery',
    targetBlenderMeshes: [
      'Jeff_Wheelchair_Seat_Cushion',
      'Jeff_Wheelchair_Backrest',
      'Jeff_Oriental_Daybed_Mattress'
    ],
    filmStillRef: {
      smpteTimecode: '00:31:05:14',
      frameNumber: 44728,
      focalLengthMm: 50,
      sceneTitle: 'Lisa & Jeff Evening Conversation — Daybed & Convalescent Chair Textures',
      opticalObservation:
        'Heavy-weight 1950s looped wool bouclé upholstery with interlocking oatmeal, warm taupe, and dark umber slub yarns; high diffuse roughness paired with a pronounced soft microfiber Fresnel halo at grazing angles.',
      lightingCondition: 'Close-Range Tungsten Table Lamp Key (2900K) at 40° Grazing Angle'
    },
    surfaceProperties: {
      baseColorHex: '#8A6F5A',
      secondaryColorHex: '#695140',
      accentColorHex: '#A88E76',
      roughness: 0.84,
      roughnessVariance: 0.1,
      metalness: 0.0,
      ior: 1.44,
      specularWeight: 0.25,
      clearcoatWeight: 0.0,
      clearcoatRoughness: 0.5,
      sheenWeight: 0.88,
      sheenRoughness: 0.42,
      transmissionWeight: 0.0,
      anisotropicWeight: 0.0,
      anisotropicRotation: 0.0,
      subsurfaceWeight: 0.05,
      subsurfaceRadiusMm: [0.6, 0.5, 0.4],
      bumpHeightMm: 1.5,
      normalStrength: 0.72,
      uvScale: 14.0,
      edgeWearFactor: 0.3
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 (Microfiber Sheen Model)',
      shaderNodesUsed: [
        'ShaderNodeTexChecker + ShaderNodeTexWave (Orthogonal Warp/Weft Yarn Interlock)',
        'ShaderNodeTexNoise (Curled Bouclé Slub Loop Perturbation)',
        'ShaderNodeLayerWeight (Fresnel Grazing Fuzz Boost)',
        'ShaderNodeBump (1.5mm Woven Yarn Relief)',
        'ShaderNodeBsdfPrincipled (Sheen Weight 0.88 / Sheen Roughness 0.42)'
      ],
      cyclesOptimizationNotes:
        'Leverages Blender 4.x Principled BSDF v2 Zeltner microfiber sheen model (Sheen Weight 0.88, Sheen Roughness 0.42) to capture realistic fuzzy cloth rim-lighting without expensive hair/fur particle systems.',
      agxColorManagementNote:
        'Warm neutral taupe tint keeps skin tones on Grace Kelly and James Stewart natural in close-ups.',
      memoryFootprintNote: 'Procedural warp/weft synthesis scales seamlessly to extreme 75mm/152mm close-ups.'
    }
  },
  {
    id: 'jeff_exakta_vulcanite_chrome_brass',
    blenderMaterialName: 'MAT_Jeff_Exakta_Chrome_And_Vulcanite',
    name: 'Ihagee Exakta VX Brushed Chrome Brass, Black Anodized Barrel & Diamond Vulcanite',
    shortLabel: 'Exakta Chrome & Vulcanite',
    category: 'metal',
    patternType: 'chrome_vulcanite',
    targetThreeSlot: 'chrome_camera',
    targetBlenderMeshes: [
      'Jeff_Exakta_Camera_Body',
      'Jeff_Exakta_Kilfitt_152mm_Barrel',
      'Jeff_Graflex_Parabolic_Flash_Dish',
      'Jeff_Tripod_Pan_Head'
    ],
    filmStillRef: {
      smpteTimecode: '00:44:18:12',
      frameNumber: 63739,
      focalLengthMm: 75,
      sceneTitle: 'Telephoto Surveillance — Extreme Close-Up on Exakta VX SLR & Kilfitt 152mm Lens',
      opticalObservation:
        'Three distinct hero surfaces on Jeffries optical rig: (1) satin-brushed chrome plating over solid brass prism housing with anisotropic lathe grain, (2) deep matte diamond-embossed black vulcanite body cladding, and (3) parabolic mirror-polished Graflex flash reflector.',
      lightingCondition: 'Courtyard Window Key Reflection + Climax 45,000W Flashbulb Specular Spike'
    },
    surfaceProperties: {
      baseColorHex: '#D8DCE2',
      secondaryColorHex: '#22252A',
      accentColorHex: '#B89758',
      roughness: 0.22,
      roughnessVariance: 0.18,
      metalness: 0.92,
      ior: 2.48,
      specularWeight: 0.95,
      clearcoatWeight: 0.15,
      clearcoatRoughness: 0.12,
      sheenWeight: 0.0,
      sheenRoughness: 0.5,
      transmissionWeight: 0.0,
      anisotropicWeight: 0.78,
      anisotropicRotation: 0.5,
      subsurfaceWeight: 0.0,
      subsurfaceRadiusMm: [0.0, 0.0, 0.0],
      bumpHeightMm: 0.95,
      normalStrength: 0.68,
      uvScale: 16.0,
      edgeWearFactor: 0.38
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 (Metallic Anisotropic + Edge Brass Wear)',
      shaderNodesUsed: [
        'ShaderNodeTexVoronoi (Manhattan Distance -> Diamond Vulcanite Pebble Grain)',
        'ShaderNodeTexWave (Radial Lathe-Turned Focus Ring Knurling)',
        'ShaderNodeAmbientOcclusion (Pointiness Edge Mask -> Exposed #B89758 Brass Lug Wear)',
        'ShaderNodeBump (Knurl + Vulcanite Relief)',
        'ShaderNodeBsdfPrincipled (Metallic 0.92 / Anisotropic 0.78)'
      ],
      cyclesOptimizationNotes:
        'Combines metallic chrome and non-metallic vulcanite via a single vertex-color/UV mask driving Metallic (0.92 vs 0.08) and Roughness (0.18 vs 0.58), reducing material draw calls on the hero camera rig to 1.',
      agxColorManagementNote:
        'AgX gracefully compresses specular highlights above 12.0 EV on the Graflex parabolic flash dish without harsh digital clipping.',
      memoryFootprintNote: 'Single unified hero prop shader with procedural pointiness brass edge-wear.'
    }
  },
  {
    id: 'jeff_bound_linen_plaster_cast',
    blenderMaterialName: 'MAT_Jeff_Orthopedic_Plaster_Cast',
    name: 'Calcified Plaster-of-Paris & Crinoline Gauze Orthopedic Cast with Ink Script',
    shortLabel: 'Orthopedic Plaster Cast',
    category: 'plaster',
    patternType: 'orthopedic_cast',
    targetThreeSlot: 'plaster_cast',
    targetBlenderMeshes: ['Jeff_Left_Leg_Plaster_Cast'],
    filmStillRef: {
      smpteTimecode: '00:03:19:04',
      frameNumber: 4772,
      focalLengthMm: 35,
      sceneTitle: 'Opening Macro Reveal — "Here lie the broken bones of L.B. Jefferies"',
      opticalObservation:
        'Chalky calcified Plaster-of-Paris impregnated into spiral-wrapped crinoline gauze bandages; shows overlapping 3-inch bandage ridges, thumb-smoothed palm depressions, open gauze pore holes, and blue-black fountain pen ink inscription.',
      lightingCondition: 'Warm Morning Window Key (4600K) at 30° Grazing Angle'
    },
    surfaceProperties: {
      baseColorHex: '#EAE6DC',
      secondaryColorHex: '#D5CFC1',
      accentColorHex: '#2B303A',
      roughness: 0.88,
      roughnessVariance: 0.08,
      metalness: 0.0,
      ior: 1.46,
      specularWeight: 0.28,
      clearcoatWeight: 0.0,
      clearcoatRoughness: 0.5,
      sheenWeight: 0.35,
      sheenRoughness: 0.6,
      transmissionWeight: 0.0,
      anisotropicWeight: 0.0,
      anisotropicRotation: 0.0,
      subsurfaceWeight: 0.15,
      subsurfaceRadiusMm: [1.8, 1.4, 1.1],
      bumpHeightMm: 1.8,
      normalStrength: 0.78,
      uvScale: 8.0,
      edgeWearFactor: 0.35
    },
    blenderOptimization: {
      bsdfVersion: 'Principled BSDF v2 (Random-Walk Subsurface + Microfiber Sheen)',
      shaderNodesUsed: [
        'ShaderNodeTexWave (Spiral 3-Inch Bandage Wrap Ridges)',
        'ShaderNodeTexChecker (Crinoline Gauze Mesh Pinholes)',
        'ShaderNodeTexNoise (Thumb-Molded Gypsum Slurry Undulations)',
        'ShaderNodeBump (Layered Bandage Lap + Gauze Weave)',
        'ShaderNodeBsdfPrincipled (Subsurface Weight 0.15 / Sheen Weight 0.35)'
      ],
      cyclesOptimizationNotes:
        'Uses Random Walk (Fixed Radius) Subsurface Scattering with Weight 0.15 so grazing sunlight softens across the chalky gypsum ridges while keeping the gauze cross-weave crisp.',
      agxColorManagementNote:
        'Alabaster bone-white (#EAE6DC) calibrated to 82% albedo so the cast never clips to pure 1.0 white under direct window light.',
      memoryFootprintNote: 'Procedural spiral UV wave + optional decal UV channel for fountain-pen signature.'
    }
  }
];

export type JeffriesAssetCategory =
  | 'Seating & Couch'
  | 'Tables & Storage'
  | 'Lamps & Practicals'
  | 'Hi-Fi & Record Player'
  | 'Camera & Optical Gear'
  | 'Set Dressing & Decor';

export interface Jeffries3DAssetSubPart {
  partName: string;
  geometryPrimitive: 'BevelBox' | 'Cylinder' | 'Lathe' | 'Tube' | 'Sphere' | 'Cone' | 'Torus';
  linkedMaterialId: string;
  colorHex: string;
  roughness: number;
  metalness: number;
  dimensionsNote: string;
  explodedOffset: [number, number, number];
}

export interface Jeffries3DAssetSpec {
  id: string;
  code: string;
  blenderCollectionName: string;
  name: string;
  shortLabel: string;
  category: JeffriesAssetCategory;
  priorityTier: 'Hero Foreground Prop' | 'Primary Furniture' | 'Practical Light Fixture' | 'Set Dressing Accent';
  filmTimestamps: string[];
  filmSceneReference: string;
  historicalModelNotes: string;
  apartmentPlacement: {
    coordinatesFeet: [number, number, number];
    rotationDeg: number;
    zoneDescription: string;
    dimensionsInches: [number, number, number]; // [Width, Depth, Height] in inches
  };
  topologySpec: {
    quadCount: number;
    vertexCount: number;
    subPartsCount: number;
    uvUnwrapMethod: string;
    udimTile: number;
    texelDensityPxPerInch: number;
    bevelWidthMm: number;
    bevelSegments: number;
    subdivisionLevel: number;
  };
  linkedPbrMaterialIds: string[];
  subParts: Jeffries3DAssetSubPart[];
  blenderNotes: string;
}

export const INITIAL_JEFFRIES_3D_ASSETS: Jeffries3DAssetSpec[] = [
  {
    id: 'asset-daybed-couch',
    code: 'PROP-2B-01',
    blenderCollectionName: 'AST_Jeff_MidCentury_Daybed_Couch',
    name: 'Mid-Century Tufted Studio Couch / Daybed & Bolster Pillows',
    shortLabel: 'Studio Couch / Daybed',
    category: 'Seating & Couch',
    priorityTier: 'Primary Furniture',
    filmTimestamps: ['00:15:18:10', '00:52:04:19', '01:18:33:08'],
    filmSceneReference:
      'Sunken parlor east wall where Lisa Fremont displays her Mark Cross overnight case and slips into her negligee; also used by Stella during morning physical therapy.',
    historicalModelNotes:
      '1953 Knoll / Dunbar-inspired armless studio daybed with walnut plinth rails, 6 splayed tapered legs with brushed brass ferrules, piped box-tufted mattress in olive-taupe slub linen, 3 wedge back cushions, and 2 cylindrical bolster pillows.',
    apartmentPlacement: {
      coordinatesFeet: [5.4, 11.1, 20.4],
      rotationDeg: -90,
      zoneDescription: 'East Sunken Parlor Wall (Right of Bay Window)',
      dimensionsInches: [78.0, 36.0, 31.5]
    },
    topologySpec: {
      quadCount: 6840,
      vertexCount: 7012,
      subPartsCount: 8,
      uvUnwrapMethod: 'Seam-Unwrapped Box Cushions + Cylindrical Bolster Caps (UDIM 1002)',
      udimTile: 1002,
      texelDensityPxPerInch: 42,
      bevelWidthMm: 4.5,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_midcentury_boucle_upholstery',
      'jeff_quarter_sawn_oak_floor',
      'jeff_exakta_vulcanite_chrome_brass'
    ],
    subParts: [
      {
        partName: 'Walnut Perimeter Plinth Frame',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#6E472B',
        roughness: 0.42,
        metalness: 0.0,
        dimensionsNote: '78" W × 36" D × 3.5" H clear-lacquered American walnut base rail',
        explodedOffset: [0, -0.35, 0]
      },
      {
        partName: '6 Tapered Mid-Century Legs + Brass Ferrules',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#C5A059',
        roughness: 0.24,
        metalness: 0.88,
        dimensionsNote: '8.5" H lathe-turned walnut legs with 2.5" brushed brass toe ferrules',
        explodedOffset: [0, -0.75, 0]
      },
      {
        partName: 'Piped Box-Tufted Primary Mattress',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#7A7262',
        roughness: 0.82,
        metalness: 0.0,
        dimensionsNote: '76" W × 35" D × 6.5" H innerspring cushion with 18 button tufts & welt cord',
        explodedOffset: [0, 0.15, 0]
      },
      {
        partName: '3 Tapered Backrest Wedge Cushions',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#847B6A',
        roughness: 0.85,
        metalness: 0.0,
        dimensionsNote: 'Three 25" W × 14" H × 7" D angled bolster wedges along wall',
        explodedOffset: [0, 0.55, -0.45]
      },
      {
        partName: 'Pair of Cylindrical End Bolster Pillows',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#633328',
        roughness: 0.76,
        metalness: 0.0,
        dimensionsNote: '34" L × 7.5" Ø corded oxblood-accent end bolsters',
        explodedOffset: [0.55, 0.45, 0.25]
      }
    ],
    blenderNotes:
      'Uses Cloth pressure micro-wrinkle normal map along piped seams and Subsurface/Sheen Principled BSDF v2 so grazing 2850K floor-lamp light catches the slub linen weave.'
  },
  {
    id: 'asset-wheelchair',
    code: 'PROP-2B-02',
    blenderCollectionName: 'AST_Jeff_EverestJennings_Wheelchair',
    name: 'Everest & Jennings 5U20 Folding Wheelchair & Leg Cast Rest',
    shortLabel: 'E&J Wheelchair & Cast',
    category: 'Seating & Couch',
    priorityTier: 'Hero Foreground Prop',
    filmTimestamps: ['00:01:55:12', '00:03:19:04', '01:46:12:02'],
    filmSceneReference:
      'Jeffries’s primary vantage point anchored at the nodal tripod origin (X=0, Y=+14.5\', Z=+18.1\') facing the three-bay window throughout the entire film.',
    historicalModelNotes:
      'Authentic 1952 Everest & Jennings Model 5U20 chrome-plated tubular steel folding convalescent wheelchair with cordovan leatherette sling seat, 24" 36-spoke rear drive wheels, 8" solid rubber front casters, and ratchet-elevated left leg rest supporting Jeff’s full-leg plaster cast.',
    apartmentPlacement: {
      coordinatesFeet: [-0.15, 11.1, 18.1],
      rotationDeg: 180,
      zoneDescription: 'Center Bay Window Nodal Origin',
      dimensionsInches: [26.5, 44.0, 36.5]
    },
    topologySpec: {
      quadCount: 14280,
      vertexCount: 14890,
      subPartsCount: 9,
      uvUnwrapMethod: 'Cylindrical Tube Unwrap + Planar Leather Sling Islands (UDIM 1002)',
      udimTile: 1002,
      texelDensityPxPerInch: 64,
      bevelWidthMm: 1.5,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_midcentury_boucle_upholstery',
      'jeff_bound_linen_plaster_cast'
    ],
    subParts: [
      {
        partName: 'Tubular Chrome X-Brace Chassis',
        geometryPrimitive: 'Tube',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#D8DDE6',
        roughness: 0.16,
        metalness: 0.96,
        dimensionsNote: '7/8" OD bent seamless chrome steel tubing with folding scissor hinge',
        explodedOffset: [0, -0.2, 0]
      },
      {
        partName: 'Cordovan Leather Seat & Backrest Sling',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#5A2D24',
        roughness: 0.44,
        metalness: 0.0,
        dimensionsNote: '18" W × 16" D heavy saddle-stitched burgundy vinyl/leather sling with brass grommets',
        explodedOffset: [0, 0.35, 0.1]
      },
      {
        partName: '24-Inch Spoked Rear Drive Wheels & Handrims',
        geometryPrimitive: 'Torus',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#C8D0DC',
        roughness: 0.2,
        metalness: 0.92,
        dimensionsNote: 'Dual 24" chrome rims with 36 radial wire spokes, grey rubber tires & push handrims',
        explodedOffset: [0.65, -0.1, 0.15]
      },
      {
        partName: '8-Inch Front Caster Forks & Solid Tires',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#3A3D45',
        roughness: 0.58,
        metalness: 0.45,
        dimensionsNote: 'Swivel ball-bearing front forks with 8" grey non-marking rubber wheels',
        explodedOffset: [0.45, -0.55, -0.45]
      },
      {
        partName: 'Elevating Left-Leg Ratchet Board & Plaster Cast',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_bound_linen_plaster_cast',
        colorHex: '#EAE6DC',
        roughness: 0.88,
        metalness: 0.0,
        dimensionsNote: 'Extended orthopedic leg rest + calcified Plaster-of-Paris cast with ink signature',
        explodedOffset: [-0.25, 0.25, -0.65]
      }
    ],
    blenderNotes:
      'Includes procedural radial spoke array generator and dual-material chrome/vulcanite shader with anisotropic specular highlights along the bent tubing.'
  },
  {
    id: 'asset-lap-table',
    code: 'PROP-2B-03',
    blenderCollectionName: 'AST_Jeff_Cantilever_Lap_Table',
    name: 'Swivel Cantilevered Hospital / Optical Utility Table',
    shortLabel: 'Swivel Lap & Lens Table',
    category: 'Tables & Storage',
    priorityTier: 'Hero Foreground Prop',
    filmTimestamps: ['00:02:11:04', '00:26:40:00', '01:28:05:14'],
    filmSceneReference:
      'Positioned immediately to the left of Jeff’s wheelchair; holds his Bausch & Lomb 7×35 binoculars, spare Kilfitt lenses, clinical thermometer, water glass, and GE #5 flashbulbs.',
    historicalModelNotes:
      '1950s institutional over-bed / side utility table with heavy cast-iron H-base on 2" rubber casters, telescoping chrome column, and walnut-grain Formica top with raised brass retaining lip.',
    apartmentPlacement: {
      coordinatesFeet: [-2.4, 11.1, 17.2],
      rotationDeg: 18,
      zoneDescription: 'Left of Wheelchair (West Bay Window Flank)',
      dimensionsInches: [28.0, 16.5, 30.0]
    },
    topologySpec: {
      quadCount: 3420,
      vertexCount: 3580,
      subPartsCount: 5,
      uvUnwrapMethod: 'Planar Wood-Grain Top + Cylindrical Column Unwrap (UDIM 1001)',
      udimTile: 1001,
      texelDensityPxPerInch: 48,
      bevelWidthMm: 2.0,
      bevelSegments: 3,
      subdivisionLevel: 1
    },
    linkedPbrMaterialIds: [
      'jeff_quarter_sawn_oak_floor',
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_optical_crown_window_glass'
    ],
    subParts: [
      {
        partName: 'Walnut Formica Top with Brass Lip Gallery',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#7C4D2B',
        roughness: 0.34,
        metalness: 0.05,
        dimensionsNote: '28" W × 16.5" D × 1.0" thick bevelled top with 3/8" brushed brass perimeter rim',
        explodedOffset: [0, 0.55, 0]
      },
      {
        partName: 'Telescoping Chrome Cantilever Column & Lock Knob',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#D8DDE6',
        roughness: 0.18,
        metalness: 0.94,
        dimensionsNote: '1.75" OD vertical steel tube with fluted Bakelite height-adjustment clutch knob',
        explodedOffset: [-0.35, 0, 0]
      },
      {
        partName: 'Weighted U-Base & 4 Swivel Casters',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#2B2E36',
        roughness: 0.48,
        metalness: 0.75,
        dimensionsNote: 'Low-clearance steel U-base designed to slide under wheelchair frame',
        explodedOffset: [0, -0.55, 0]
      }
    ],
    blenderNotes:
      'Top surface includes subtle circular glass condensation ring roughness variation (Roughness 0.18 vs 0.36 base) for close-up camera pans.'
  },
  {
    id: 'asset-coffee-table',
    code: 'PROP-2B-04',
    blenderCollectionName: 'AST_Jeff_Danish_Walnut_Coffee_Table',
    name: 'Danish Walnut Slatted Magazine & Coffee Table',
    shortLabel: 'Walnut Coffee Table',
    category: 'Tables & Storage',
    priorityTier: 'Primary Furniture',
    filmTimestamps: ['00:16:42:18', '00:54:10:02', '01:19:45:11'],
    filmSceneReference:
      'Anchored in front of the studio daybed couch; holds stacks of Life magazine proofs, 8×10 glossy contact sheets, a heavy amber glass ashtray, and Lisa’s handbag.',
    historicalModelNotes:
      '1953 American mid-century walnut cocktail table (48" × 20" × 16.5") with boat-shaped chamfered top, splayed tapered dowel legs, and a 7-rod brass/walnut underslung magazine cradle.',
    apartmentPlacement: {
      coordinatesFeet: [3.2, 11.1, 20.1],
      rotationDeg: -90,
      zoneDescription: 'In Front of Studio Couch (East Parlor)',
      dimensionsInches: [48.0, 20.0, 16.5]
    },
    topologySpec: {
      quadCount: 4120,
      vertexCount: 4290,
      subPartsCount: 5,
      uvUnwrapMethod: 'Longitudinal Wood-Grain UV Alignment along X-Axis (UDIM 1001)',
      udimTile: 1001,
      texelDensityPxPerInch: 44,
      bevelWidthMm: 3.0,
      bevelSegments: 3,
      subdivisionLevel: 1
    },
    linkedPbrMaterialIds: [
      'jeff_quarter_sawn_oak_floor',
      'jeff_optical_crown_window_glass',
      'jeff_painted_pine_window_mullions'
    ],
    subParts: [
      {
        partName: 'Chamfered Surfboard-Profile Walnut Tabletop',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#6B4226',
        roughness: 0.36,
        metalness: 0.0,
        dimensionsNote: '48" × 20" × 1.1" solid walnut slab with 35° underside knife-edge chamfer',
        explodedOffset: [0, 0.45, 0]
      },
      {
        partName: 'Slatted Dowel Lower Magazine Shelf',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#7E5232',
        roughness: 0.44,
        metalness: 0.0,
        dimensionsNote: '7 longitudinal 3/8" walnut & brass rods suspended 7" below main tabletop',
        explodedOffset: [0, 0.0, 0]
      },
      {
        partName: '4 Splayed Tapered Walnut Dowel Legs',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#5C381F',
        roughness: 0.4,
        metalness: 0.0,
        dimensionsNote: '15.5" legs splayed outward at 11° with mortised stretcher rails',
        explodedOffset: [0, -0.45, 0]
      },
      {
        partName: 'Stacked Magazine Proofs & Amber Glass Ashtray',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#D97706',
        roughness: 0.12,
        metalness: 0.0,
        dimensionsNote: '11×14" silver-gelatin proof sheets + heavy faceted amber glass ashtray',
        explodedOffset: [0.2, 0.75, 0.1]
      }
    ],
    blenderNotes:
      'UV islands for tabletop and legs are aligned strictly along the X-axis so procedural walnut wood-grain fibers follow natural carpentry cuts.'
  },
  {
    id: 'asset-dining-table',
    code: 'PROP-2B-05',
    blenderCollectionName: 'AST_Jeff_DropLeaf_Dining_Table',
    name: 'Drop-Leaf Gateleg Dining Table, Bistro Chairs & 21 Club Service',
    shortLabel: 'Drop-Leaf Dining Set',
    category: 'Tables & Storage',
    priorityTier: 'Primary Furniture',
    filmTimestamps: ['00:17:50:14', '00:21:12:08'],
    filmSceneReference:
      'Near the rear step-down entry & kitchenette partition where the waiter from the 21 Club sets up the silver chafing dish, lobster supper, and bottle of Montrachet wine.',
    historicalModelNotes:
      'Traditional Greenwich Village apartment space-saver: mahogany/walnut drop-leaf gateleg table (38" × 32" × 29") with two hinged semicircular leaves, turned barley-twist gate legs, and two Thonet-style bentwood side chairs.',
    apartmentPlacement: {
      coordinatesFeet: [-5.8, 11.1, 22.8],
      rotationDeg: 15,
      zoneDescription: 'West Rear Parlor / Kitchenette Transition',
      dimensionsInches: [38.0, 32.0, 29.5]
    },
    topologySpec: {
      quadCount: 7520,
      vertexCount: 7810,
      subPartsCount: 6,
      uvUnwrapMethod: 'Box + Follow-Active-Quads on Bentwood Chair Frames (UDIM 1001)',
      udimTile: 1001,
      texelDensityPxPerInch: 42,
      bevelWidthMm: 2.5,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_quarter_sawn_oak_floor',
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_midcentury_boucle_upholstery'
    ],
    subParts: [
      {
        partName: 'Center Fixed Leaf & Dual Hinged Drop Leaves',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#5E341E',
        roughness: 0.35,
        metalness: 0.0,
        dimensionsNote: '38" × 32" oval-when-extended mahogany top with brass rule-joint hinges',
        explodedOffset: [0, 0.45, 0]
      },
      {
        partName: 'Turned Gateleg Swing Frame & Stretchers',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#4E2A17',
        roughness: 0.42,
        metalness: 0.0,
        dimensionsNote: '6 lathe-turned legs with pivoting gate support rails',
        explodedOffset: [0, -0.45, 0]
      },
      {
        partName: 'Pair of Bentwood Bistro Side Chairs',
        geometryPrimitive: 'Tube',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#6E472B',
        roughness: 0.48,
        metalness: 0.0,
        dimensionsNote: 'Steam-bent beechwood frames with upholstered seat pads (17.5" seat height)',
        explodedOffset: [0.65, -0.1, 0]
      },
      {
        partName: '21 Club Silver Chafing Dish & Wine Bottle',
        geometryPrimitive: 'Lathe',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#E2E8F0',
        roughness: 0.14,
        metalness: 0.95,
        dimensionsNote: 'Domed sterling silver warming dish + dark green glass wine bottle & 2 stems',
        explodedOffset: [0, 0.8, 0]
      }
    ],
    blenderNotes:
      'Hinged drop leaves are rigged with local X-axis pivot origins at the rule joints so animators can fold them down (-88°) or extend them flat (0°).'
  },
  {
    id: 'asset-floor-lamp',
    code: 'PROP-2B-06',
    blenderCollectionName: 'AST_Jeff_TriLight_Brass_Floor_Lamp',
    name: 'Tri-Light Brushed Brass & Pleated Shantung Floor Lamp',
    shortLabel: 'Brass & Shantung Floor Lamp',
    category: 'Lamps & Practicals',
    priorityTier: 'Practical Light Fixture',
    filmTimestamps: ['00:14:22:00', '00:16:05:12', '01:38:14:06'],
    filmSceneReference:
      'First practical lamp Lisa Fremont switches on during her dramatic entrance ("one-two-three" lighting cue); casts warm 2850K tungsten glow across the east parlor and studio couch.',
    historicalModelNotes:
      '1953 Stiffel / Laurel mid-century torchiere & reading floor lamp (62" H) with weighted stepped brass base, turned walnut mid-column accent, 3-arm candle socket cluster, milk-glass diffuser bowl, and wide pleated silk shantung drum shade.',
    apartmentPlacement: {
      coordinatesFeet: [6.8, 11.1, 17.8],
      rotationDeg: 0,
      zoneDescription: 'North-East Corner Beside Studio Couch',
      dimensionsInches: [19.0, 19.0, 62.0]
    },
    topologySpec: {
      quadCount: 5480,
      vertexCount: 5620,
      subPartsCount: 5,
      uvUnwrapMethod: 'Cylindrical Radial Pleat Unwrap + Lathe Base UVs (UDIM 1003)',
      udimTile: 1003,
      texelDensityPxPerInch: 52,
      bevelWidthMm: 1.8,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_midcentury_boucle_upholstery',
      'jeff_quarter_sawn_oak_floor'
    ],
    subParts: [
      {
        partName: 'Weighted Stepped Brushed-Brass Base',
        geometryPrimitive: 'Lathe',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#D4AF37',
        roughness: 0.22,
        metalness: 0.92,
        dimensionsNote: '11.5" Ø lathe-spun solid brass base with felt underside pad',
        explodedOffset: [0, -0.65, 0]
      },
      {
        partName: 'Tubular Brass Shaft & Turned Walnut Collar',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#B89758',
        roughness: 0.28,
        metalness: 0.85,
        dimensionsNote: '48" vertical column with 10" hand-turned American walnut grip spindle',
        explodedOffset: [0, -0.1, 0]
      },
      {
        partName: 'Milk-Glass Upward Reflector Bowl & 3 Brass Sockets',
        geometryPrimitive: 'Lathe',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#FFFBEB',
        roughness: 0.25,
        metalness: 0.0,
        dimensionsNote: '9" Ø translucent opal glass diffuser bowl + 3-way rotary switch',
        explodedOffset: [0, 0.35, 0]
      },
      {
        partName: 'Pleated Ivory Silk Shantung Drum Shade (2850K Emitter)',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#FDE68A',
        roughness: 0.72,
        metalness: 0.0,
        dimensionsNote: '19" bottom Ø × 16" top Ø × 11" H radially pleated shade with Subsurface 0.65',
        explodedOffset: [0, 0.7, 0]
      }
    ],
    blenderNotes:
      'Includes a parented Blender Cycles Point Light (2850K Blackbody, 45W, radius 0.12m) inside the milk-glass diffuser and Subsurface Scattering on the pleated shantung shade.'
  },
  {
    id: 'asset-desk-lamp',
    code: 'PROP-2B-07',
    blenderCollectionName: 'AST_Jeff_Gooseneck_Credenza_Lamp',
    name: 'Articulated Brass Gooseneck Desk & Darkroom Inspection Lamp',
    shortLabel: 'Gooseneck Credenza Lamp',
    category: 'Lamps & Practicals',
    priorityTier: 'Practical Light Fixture',
    filmTimestamps: ['00:14:26:08', '00:38:12:19', '01:12:04:15'],
    filmSceneReference:
      'Rests on the West side table / negative credenza; illuminates Jeff’s contact prints, magnifying loupe, and rotary telephone during night sequences.',
    historicalModelNotes:
      '1949 Marks Mfg. / Eagle Electric industrial-studio gooseneck desk lamp with wrinkle-finish cast-iron base, 14" flexible coiled brass neck, spun-aluminum parabolic bell shade, and Bakelite turn-knob socket.',
    apartmentPlacement: {
      coordinatesFeet: [-3.8, 13.2, 16.6],
      rotationDeg: 35,
      zoneDescription: 'West Side Worktable / Negative Credenza',
      dimensionsInches: [11.0, 14.5, 19.5]
    },
    topologySpec: {
      quadCount: 3890,
      vertexCount: 4040,
      subPartsCount: 4,
      uvUnwrapMethod: 'Curve-Tube UV Follow for Flexible Gooseneck + Lathe Dome (UDIM 1003)',
      udimTile: 1003,
      texelDensityPxPerInch: 58,
      bevelWidthMm: 1.5,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_aged_sage_gypsum_plaster'
    ],
    subParts: [
      {
        partName: 'Wrinkle-Enamel Cast-Iron Base',
        geometryPrimitive: 'Lathe',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#2D3139',
        roughness: 0.62,
        metalness: 0.65,
        dimensionsNote: '6.5" × 5.0" oval cast-iron counterweight base with rubber grommet',
        explodedOffset: [0, -0.5, 0]
      },
      {
        partName: 'Coiled Flexible Brass Gooseneck Arm',
        geometryPrimitive: 'Tube',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#C5A059',
        roughness: 0.3,
        metalness: 0.9,
        dimensionsNote: '14" articulated interlocking spiral brass conduit (5/8" OD)',
        explodedOffset: [0, 0, -0.2]
      },
      {
        partName: 'Spun-Aluminum Parabolic Bell Shade & Bakelite Socket',
        geometryPrimitive: 'Cone',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#CBD5E1',
        roughness: 0.26,
        metalness: 0.88,
        dimensionsNote: '6.5" Ø spun metal shade with high-reflectance white enamel interior',
        explodedOffset: [0.25, 0.45, 0.25]
      },
      {
        partName: '2700K Frosted Tungsten A19 Bulb',
        geometryPrimitive: 'Sphere',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#FBBF24',
        roughness: 0.15,
        metalness: 0.0,
        dimensionsNote: 'Emissive 2700K bulb mesh + Cycles Spot Light (cone 105°, blend 0.35)',
        explodedOffset: [0.35, 0.25, 0.45]
      }
    ],
    blenderNotes:
      'Gooseneck arm is generated from a 3D Bezier curve with spiral wave normal relief so its pose can be adjusted non-destructively in Blender.'
  },
  {
    id: 'asset-record-player',
    code: 'PROP-2B-08',
    blenderCollectionName: 'AST_Jeff_Webcor_1953_Record_Player',
    name: '1953 Webcor "Holiday" Automatic Record Player & Waxman LP Stack',
    shortLabel: '1953 Turntable & LP Stack',
    category: 'Hi-Fi & Record Player',
    priorityTier: 'Primary Furniture',
    filmTimestamps: ['00:18:12:04', '00:53:20:16', '01:51:40:00'],
    filmSceneReference:
      'Rests on the walnut credenza near the step-down parlor; plays vintage 33⅓ RPM jazz/pop LPs (including "Lisa’s Theme" and Bing Crosby’s "To See You Is to Love You" in the final scene).',
    historicalModelNotes:
      '1953 Webcor (Webster-Chicago) Model 1121 "Holiday" automatic 3-speed record changer in two-tone oatmeal tweed-linen and mahogany case, with 10" burgundy-flocked platter, tall automatic record-drop spindle, chrome tonearm, and stacked 12" vinyl LPs.',
    apartmentPlacement: {
      coordinatesFeet: [7.2, 13.4, 23.2],
      rotationDeg: -135,
      zoneDescription: 'Rear-East Walnut Credenza Top',
      dimensionsInches: [16.5, 14.5, 9.5]
    },
    topologySpec: {
      quadCount: 8940,
      vertexCount: 9320,
      subPartsCount: 6,
      uvUnwrapMethod: 'Radial Polar UVs on Vinyl Grooves + Box Case Unwrap (UDIM 1003)',
      udimTile: 1003,
      texelDensityPxPerInch: 64,
      bevelWidthMm: 1.5,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_midcentury_boucle_upholstery',
      'jeff_quarter_sawn_oak_floor',
      'jeff_exakta_vulcanite_chrome_brass'
    ],
    subParts: [
      {
        partName: 'Two-Tone Tweed & Mahogany Cabinet Plinth + Brass Grille',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#8C7A64',
        roughness: 0.74,
        metalness: 0.0,
        dimensionsNote: '16.5" × 14.5" × 6.5" pyroxylin-coated tweed case with woven brass speaker grille',
        explodedOffset: [0, -0.45, 0]
      },
      {
        partName: '10-Inch Burgundy-Flocked Turntable Platter',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#5A2522',
        roughness: 0.86,
        metalness: 0.1,
        dimensionsNote: 'Stamped steel platter with velveteen flock surface & chrome strobe rim',
        explodedOffset: [-0.08, 0.1, 0]
      },
      {
        partName: '12-Inch 33⅓ RPM Microgroove Vinyl LP Record',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#14161A',
        roughness: 0.22,
        metalness: 0.08,
        dimensionsNote: 'Anisotropic radial microgroove normal map + red/gold Columbia/Paramount center label',
        explodedOffset: [-0.08, 0.42, 0]
      },
      {
        partName: 'Counterweighted Chrome Tonearm & Cartridge Head',
        geometryPrimitive: 'Tube',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#E2E8F0',
        roughness: 0.16,
        metalness: 0.94,
        dimensionsNote: 'Pivoting die-cast tonearm with GE Variable Reluctance flip-over sapphire stylus',
        explodedOffset: [0.38, 0.35, 0.15]
      },
      {
        partName: 'Automatic Record-Changer Spindle & Bakelite Speed Dial',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#B89758',
        roughness: 0.25,
        metalness: 0.85,
        dimensionsNote: 'Offset step-spindle + 33⅓ / 45 / 78 RPM rotary selector & Reject switch',
        explodedOffset: [0.35, 0.2, -0.25]
      },
      {
        partName: 'Stacked 12" Vintage Cardboard LP Album Sleeves',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_painted_pine_window_mullions',
        colorHex: '#D97706',
        roughness: 0.52,
        metalness: 0.0,
        dimensionsNote: '4 vintage 1954 LP jackets resting beside turntable',
        explodedOffset: [-0.55, 0.0, 0.25]
      }
    ],
    blenderNotes:
      'Vinyl LP shader uses Radial Tangent Anisotropy (Anisotropic Weight 0.88, Rotation 0.25) combined with high-frequency concentric Wave Texture grooves for realistic specular bow-tie reflections.'
  },
  {
    id: 'asset-exakta-rig',
    code: 'PROP-2B-09',
    blenderCollectionName: 'AST_Jeff_ExaktaVX_Kilfitt400_Rig',
    name: 'Exakta VX 35mm SLR + Kilfitt Fern-Kilar 400mm f/5.6 Telephoto Rig',
    shortLabel: 'Exakta VX + 400mm Lens Rig',
    category: 'Camera & Optical Gear',
    priorityTier: 'Hero Foreground Prop',
    filmTimestamps: ['00:38:12:19', '00:44:18:12', '01:05:22:08', '01:28:05:14'],
    filmSceneReference:
      'Jeffries’s signature optical surveillance instrument ("the portable keyhole") used to inspect Thorwald’s garden flowers, his saw/knives wrapped in newspaper, and Miss Lonelyhearts’s letters.',
    historicalModelNotes:
      '1952 Ihagee Kamerawerk Dresden Exakta VX 35mm SLR with trapezoidal body, left-hand shutter release, satin chrome top plate, diamond vulcanite leatherette, mounted to a 400mm f/5.6 Kilfitt Fern-Kilar preset telephoto barrel on a pan-tilt wooden studio tripod.',
    apartmentPlacement: {
      coordinatesFeet: [1.25, 11.1, 16.3],
      rotationDeg: 180,
      zoneDescription: 'Right-Center Bay Window Optical Station',
      dimensionsInches: [22.0, 26.0, 52.0]
    },
    topologySpec: {
      quadCount: 16420,
      vertexCount: 17110,
      subPartsCount: 8,
      uvUnwrapMethod: 'Cylindrical Barrel Unwrap (Engraved Depth-of-Field Scales) + Box Body UVs (UDIM 1003)',
      udimTile: 1003,
      texelDensityPxPerInch: 85,
      bevelWidthMm: 0.8,
      bevelSegments: 4,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_optical_crown_window_glass',
      'jeff_quarter_sawn_oak_floor'
    ],
    subParts: [
      {
        partName: 'Exakta VX Trapezoidal Die-Cast Body (Vulcanite & Chrome)',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#C8D0DC',
        roughness: 0.22,
        metalness: 0.9,
        dimensionsNote: '6.0" × 3.2" × 3.0" body with engraved shutter-speed dials & penta-prism housing',
        explodedOffset: [0, 0.35, 0.35]
      },
      {
        partName: 'Kilfitt Fern-Kilar 400mm f/5.6 Anodized Telephoto Barrel',
        geometryPrimitive: 'Lathe',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#1E2128',
        roughness: 0.34,
        metalness: 0.86,
        dimensionsNote: '16.2" long stepped black-anodized aluminum barrel with knurled focus/aperture rings',
        explodedOffset: [0, 0.35, -0.35]
      },
      {
        partName: '72mm Multi-Coated Front Objective Doublet & Lens Hood',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#38BDF8',
        roughness: 0.02,
        metalness: 0.0,
        dimensionsNote: 'IOR 1.62 lanthanum optical glass with magenta/cyan MgF2 anti-reflective coating',
        explodedOffset: [0, 0.35, -0.85]
      },
      {
        partName: 'Cradle Tripod Collar & Pan-Tilt Fluid Head',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#94A3B8',
        roughness: 0.26,
        metalness: 0.92,
        dimensionsNote: 'Center-of-gravity balancing ring clamp + chrome pan handle',
        explodedOffset: [0, 0.0, 0]
      },
      {
        partName: '3 Telescoping Ash-Wood Tripod Legs & Brass Spikes',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_quarter_sawn_oak_floor',
        colorHex: '#7C4D2B',
        roughness: 0.44,
        metalness: 0.0,
        dimensionsNote: '38" two-stage wooden legs with brass wing-nut locks',
        explodedOffset: [0, -0.55, 0]
      }
    ],
    blenderNotes:
      'Objective lens element uses a custom Layer Weight -> Facing ColorRamp (magenta #A855F7 to cyan #06B6D4) on the Coat Tint input of Principled BSDF v2 to replicate 1950s single-layer MgF2 lens coating reflections.'
  },
  {
    id: 'asset-graflex-flash',
    code: 'PROP-2B-10',
    blenderCollectionName: 'AST_Jeff_Graflex_Flashgun_And_Bulbs',
    name: 'Graflex 3-Cell Battery Flashgun, 7" Dish & #5 Flashbulb Carton',
    shortLabel: 'Graflex Flashgun & Bulbs',
    category: 'Camera & Optical Gear',
    priorityTier: 'Hero Foreground Prop',
    filmTimestamps: ['00:01:48:00', '01:47:15:10', '01:48:02:19'],
    filmSceneReference:
      'Climactic weapon used by Jeffries in the darkened apartment to temporarily blind Lars Thorwald with four successive 22,000-lumen magnesium-foil flashbulb bursts.',
    historicalModelNotes:
      '1950 Graflex 3-Cell Flash Synchronizer with knurled chrome battery tube (holding three D-cell batteries), red solenoid push-button, 7-inch spun-aluminum adjustable aplanatic reflector dish, and a yellow/black GE Mazda Photoflash #5 12-bulb sleeve.',
    apartmentPlacement: {
      coordinatesFeet: [0.85, 13.0, 15.1],
      rotationDeg: 165,
      zoneDescription: 'Center Bay Window Sill & Lap Table',
      dimensionsInches: [7.5, 6.0, 14.5]
    },
    topologySpec: {
      quadCount: 6240,
      vertexCount: 6510,
      subPartsCount: 5,
      uvUnwrapMethod: 'Polar Spherical Dish Unwrap + Cylindrical Tube Knurling (UDIM 1003)',
      udimTile: 1003,
      texelDensityPxPerInch: 92,
      bevelWidthMm: 0.6,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_optical_crown_window_glass',
      'jeff_painted_pine_window_mullions'
    ],
    subParts: [
      {
        partName: 'Knurled Chrome 3-Cell Battery Handle Tube',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#E2E8F0',
        roughness: 0.18,
        metalness: 0.96,
        dimensionsNote: '1.5" Ø × 9.5" H chrome brass tube with diamond grip bands & red trigger switch',
        explodedOffset: [0, -0.45, 0]
      },
      {
        partName: '7-Inch Spun-Aluminum Parabolic Reflector Dish',
        geometryPrimitive: 'Lathe',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#F1F5F9',
        roughness: 0.14,
        metalness: 0.95,
        dimensionsNote: '7.0" Ø radial brushed aluminum dish with bayonet bulb ejector socket',
        explodedOffset: [0, 0.35, -0.25]
      },
      {
        partName: 'Clear Glass GE #5 Magnesium-Foil Flashbulb',
        geometryPrimitive: 'Sphere',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#FFFBEB',
        roughness: 0.04,
        metalness: 0.0,
        dimensionsNote: '1.35" Ø glass envelope with internal shredded aluminum/magnesium filament mesh',
        explodedOffset: [0, 0.35, 0.35]
      },
      {
        partName: 'Open Yellow Cardboard Carton of 12 Spare #5 Flashbulbs',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_painted_pine_window_mullions',
        colorHex: '#F59E0B',
        roughness: 0.68,
        metalness: 0.0,
        dimensionsNote: 'Corrugated cardboard partitioned sleeve with 11 remaining clear glass bulbs',
        explodedOffset: [0.55, -0.25, 0.2]
      }
    ],
    blenderNotes:
      'Parabolic dish uses Radial Anisotropic Tangents centered on the bayonet socket so firing the flashbulb produces an authentic concentric starburst reflection.'
  },
  {
    id: 'asset-binoculars',
    code: 'PROP-2B-11',
    blenderCollectionName: 'AST_Jeff_BauschLomb_7x35_Binoculars',
    name: 'Bausch & Lomb 7×35 Zephyr Binoculars & Stitched Leather Case',
    shortLabel: 'B&L 7×35 Binoculars',
    category: 'Camera & Optical Gear',
    priorityTier: 'Hero Foreground Prop',
    filmTimestamps: ['00:24:15:08', '00:36:40:12', '01:02:18:04'],
    filmSceneReference:
      'Jeff’s intermediate-magnification surveillance optics before switching to the 400mm Exakta rig; used by both Jeff and Lisa to watch Miss Torso, Miss Lonelyhearts, and Thorwald.',
    historicalModelNotes:
      '1951 Bausch & Lomb "Zephyr-Light" 7×35mm Porro-prism center-focus binoculars with black pebble-grain magnesium housings, 35mm coated objective lenses, Bakelite eyecups, and velvet-lined russet saddle-leather case.',
    apartmentPlacement: {
      coordinatesFeet: [-2.2, 13.6, 17.0],
      rotationDeg: 145,
      zoneDescription: 'Rests on Cantilevered Lap Table Beside Wheelchair',
      dimensionsInches: [7.2, 5.5, 4.8]
    },
    topologySpec: {
      quadCount: 5680,
      vertexCount: 5910,
      subPartsCount: 5,
      uvUnwrapMethod: 'Dual Symmetrical Barrel UVs + Leather Strap Curve Unwrap (UDIM 1003)',
      udimTile: 1003,
      texelDensityPxPerInch: 90,
      bevelWidthMm: 0.8,
      bevelSegments: 3,
      subdivisionLevel: 2
    },
    linkedPbrMaterialIds: [
      'jeff_exakta_vulcanite_chrome_brass',
      'jeff_optical_crown_window_glass',
      'jeff_midcentury_boucle_upholstery'
    ],
    subParts: [
      {
        partName: 'Dual Porro-Prism Magnesium Barrels (Vulcanite Finish)',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_exakta_vulcanite_chrome_brass',
        colorHex: '#1F242D',
        roughness: 0.56,
        metalness: 0.15,
        dimensionsNote: 'Twin pebble-textured prism housings linked by brass interpupillary hinge bridge',
        explodedOffset: [0, 0.15, 0]
      },
      {
        partName: '35mm Coated Objective Lenses & Bakelite Ocular Eyecups',
        geometryPrimitive: 'Cylinder',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#38BDF8',
        roughness: 0.03,
        metalness: 0.0,
        dimensionsNote: 'Recessed front doublets + knurled center diopter focusing wheel',
        explodedOffset: [0, 0.25, -0.45]
      },
      {
        partName: 'Stitched Russet Cowhide Carrying Case & Neck Strap',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_midcentury_boucle_upholstery',
        colorHex: '#7C3F23',
        roughness: 0.46,
        metalness: 0.0,
        dimensionsNote: 'Molded hard leather binocular case with brass clasp & crimson velvet lining',
        explodedOffset: [0.5, -0.25, 0.15]
      }
    ],
    blenderNotes:
      'Includes vertex-color brass edge wear along the prism housing shoulders where Jeff’s hands grip the binoculars.'
  },
  {
    id: 'asset-decor-gallery',
    code: 'PROP-2B-12',
    blenderCollectionName: 'AST_Jeff_Bamboo_Screen_And_Photo_Gallery',
    name: 'Split-Bamboo Privacy Screen, Framed Press Prints & Negative Viewer',
    shortLabel: 'Bamboo Screen & Photo Prints',
    category: 'Set Dressing & Decor',
    priorityTier: 'Set Dressing Accent',
    filmTimestamps: ['00:02:02:18', '00:05:44:10', '00:19:30:04'],
    filmSceneReference:
      'Establishes Jeffries’s career as a globe-trotting combat & action photojournalist during the opening panning shot across his framed race-car crash, atomic test, and war prints, plus the woven bamboo screen by the step-down entry.',
    historicalModelNotes:
      '6-panel folding natural rattan & split-bamboo room divider (72" H × 84" W unfolded), wall gallery of six 11×14" black-lacquered wood frames with archival mat boards, illuminated 8×10" frosted-glass negative lightbox, and African carved hardwood bookends.',
    apartmentPlacement: {
      coordinatesFeet: [-8.5, 11.1, 23.8],
      rotationDeg: 25,
      zoneDescription: 'Step-Down Entry Partition & West Parlor Wall',
      dimensionsInches: [84.0, 14.0, 72.0]
    },
    topologySpec: {
      quadCount: 6120,
      vertexCount: 6440,
      subPartsCount: 5,
      uvUnwrapMethod: 'Atlas UV Layout for 6 Archival Press Prints + Tiled Bamboo Weave (UDIM 1001)',
      udimTile: 1001,
      texelDensityPxPerInch: 46,
      bevelWidthMm: 2.0,
      bevelSegments: 2,
      subdivisionLevel: 1
    },
    linkedPbrMaterialIds: [
      'jeff_bamboo_matchstick_blinds',
      'jeff_painted_pine_window_mullions',
      'jeff_optical_crown_window_glass'
    ],
    subParts: [
      {
        partName: '6-Panel Folding Rattan & Split-Bamboo Screen',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_bamboo_matchstick_blinds',
        colorHex: '#B89058',
        roughness: 0.64,
        metalness: 0.0,
        dimensionsNote: 'Six 14" W × 72" H hinged bamboo panels arranged in 25° accordion zig-zag',
        explodedOffset: [-0.35, 0, 0]
      },
      {
        partName: '6 Framed 11×14" Silver-Gelatin Action Press Prints',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_painted_pine_window_mullions',
        colorHex: '#1E293B',
        roughness: 0.28,
        metalness: 0.1,
        dimensionsNote: 'Ebonized wood frames + cream bevelled mat boards + glazing glass (IOR 1.52)',
        explodedOffset: [0.45, 0.35, -0.25]
      },
      {
        partName: 'Illuminated 8×10" Negative Viewing Lightbox & Loupe',
        geometryPrimitive: 'BevelBox',
        linkedMaterialId: 'jeff_optical_crown_window_glass',
        colorHex: '#E0F2FE',
        roughness: 0.22,
        metalness: 0.4,
        dimensionsNote: 'Slanted steel housing with 5000K opal glass diffuser & 8×10 positive transparency',
        explodedOffset: [0.45, -0.35, 0.25]
      }
    ],
    blenderNotes:
      'Press print glazing glass uses architectural thin-sheet reflection (Roughness 0.03, Specular 0.5) tilted 1.5° downward on the wall hooks to catch realistic window reflections.'
  }
];

/**
 * Generates a standalone Blender 4.2 LTS Python script (`07_jeffries_set_dressing_asset_library.py`)
 * that procedurally constructs all 12 multi-part 3D set dressing and furniture models inside
 * L.B. Jeffries's apartment (#2B), applies Bevel + Subdivision modifiers, unwraps non-overlapping UVs,
 * binds the calibrated Principled BSDF v2 materials, and registers each model in the Blender Asset Browser.
 */
export function generateBlenderJeffriesAssetLibraryPython(
  assets: Jeffries3DAssetSpec[],
  pbrMaterials: JeffriesPbrMaterialSpec[],
  scaleUnit: 'imperial_feet' | 'metric_meters' = 'imperial_feet'
): string {
  const unitFactor = scaleUnit === 'metric_meters' ? 0.3048 : 1.0;
  const inchFactor = unitFactor / 12.0;

  const assetsPayloadJson = JSON.stringify(
    assets.map((a) => ({
      id: a.id,
      code: a.code,
      collection_name: a.blenderCollectionName,
      name: a.name,
      category: a.category,
      priority_tier: a.priorityTier,
      timestamps: a.filmTimestamps,
      placement_feet: a.apartmentPlacement.coordinatesFeet,
      rotation_deg: a.apartmentPlacement.rotationDeg,
      dimensions_inches: a.apartmentPlacement.dimensionsInches,
      udim_tile: a.topologySpec.udimTile,
      bevel_mm: a.topologySpec.bevelWidthMm,
      bevel_segments: a.topologySpec.bevelSegments,
      subdiv_level: a.topologySpec.subdivisionLevel,
      linked_materials: a.linkedPbrMaterialIds,
      sub_parts: a.subParts
    })),
    null,
    2
  );

  const materialsLookupJson = JSON.stringify(
    pbrMaterials.map((m) => ({
      id: m.id,
      blender_name: m.blenderMaterialName,
      base_hex: m.surfaceProperties.baseColorHex,
      roughness: m.surfaceProperties.roughness,
      metalness: m.surfaceProperties.metalness,
      ior: m.surfaceProperties.ior,
      clearcoat: m.surfaceProperties.clearcoatWeight,
      sheen: m.surfaceProperties.sheenWeight,
      transmission: m.surfaceProperties.transmissionWeight,
      anisotropic: m.surfaceProperties.anisotropicWeight
    })),
    null,
    2
  );

  return `#!/usr/bin/env python3
# ==============================================================================
# 07_jeffries_set_dressing_asset_library.py
# Paramount Stage 18 ("Rear Window", 1954) — L.B. Jeffries's Apartment (#2B)
# Complete 12-Piece 3D Set Dressing & Furniture Asset Library Builder
# Target: Blender 4.2 LTS (Principled BSDF v2 + Bevel/Subdiv + Smart UV + Asset Browser)
# Standalone Execution: blender --background --python 07_jeffries_set_dressing_asset_library.py
# ==============================================================================

import bpy
import bmesh
import math
import json
from mathutils import Vector, Euler

UNIT_SCALE_FEET = ${unitFactor.toFixed(6)}
INCH_SCALE = ${inchFactor.toFixed(6)}

JEFFRIES_PBR_MATERIALS = json.loads(r'''${materialsLookupJson}''')
JEFFRIES_3D_ASSETS = json.loads(r'''${assetsPayloadJson}''')


def hex_to_linear_rgba(hex_str: str, alpha: float = 1.0):
    h = hex_str.lstrip('#')
    if len(h) != 6:
        return (0.5, 0.5, 0.5, alpha)
    srgb = [int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (lin[0], lin[1], lin[2], alpha)


def ensure_pbr_material_library():
    """Creates or retrieves the Principled BSDF v2 materials for Jeffries's apartment."""
    mat_map = {}
    for spec in JEFFRIES_PBR_MATERIALS:
        mat_name = spec["blender_name"]
        mat = bpy.data.materials.get(mat_name)
        if not mat:
            mat = bpy.data.materials.new(name=mat_name)
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            bsdf = nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = hex_to_linear_rgba(spec["base_hex"])
                bsdf.inputs["Roughness"].default_value = float(spec["roughness"])
                bsdf.inputs["Metallic"].default_value = float(spec["metalness"])
                bsdf.inputs["IOR"].default_value = float(spec["ior"])
                if "Coat Weight" in bsdf.inputs:
                    bsdf.inputs["Coat Weight"].default_value = float(spec["clearcoat"])
                if "Sheen Weight" in bsdf.inputs:
                    bsdf.inputs["Sheen Weight"].default_value = float(spec["sheen"])
                if "Transmission Weight" in bsdf.inputs:
                    bsdf.inputs["Transmission Weight"].default_value = float(spec["transmission"])
                if "Anisotropic" in bsdf.inputs:
                    bsdf.inputs["Anisotropic"].default_value = float(spec["anisotropic"])
        mat.asset_mark()
        mat_map[spec["id"]] = mat
    return mat_map


def apply_modifiers_and_smart_uv(obj, bevel_mm: float, bevel_segments: int, subdiv_level: int):
    """Adds non-destructive Bevel + Weighted Normal + Subdivision modifiers and unwraps UVs."""
    bev = obj.modifiers.new(name="Stage18_Bevel", type='BEVEL')
    bev.width = max(0.0005, (bevel_mm / 25.4) * INCH_SCALE)
    bev.segments = max(1, int(bevel_segments))
    bev.limit_method = 'ANGLE'
    bev.angle_limit = math.radians(32.0)

    if subdiv_level > 0:
        sub = obj.modifiers.new(name="Stage18_Subsurf", type='SUBSURF')
        sub.levels = int(subdiv_level)
        sub.render_levels = int(subdiv_level)

    wn = obj.modifiers.new(name="Stage18_WeightedNormal", type='WEIGHTED_NORMAL')
    wn.keep_sharp = True

    # Ensure clean non-overlapping UV map for realistic texturing
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="UVMap_Stage18")
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.select_set(False)


def build_asset_geometry(asset_spec, mat_map, parent_collection):
    """Constructs a multi-part hierarchical 3D asset collection and parent empty anchor."""
    col_name = asset_spec["collection_name"]
    asset_col = bpy.data.collections.get(col_name)
    if not asset_col:
        asset_col = bpy.data.collections.new(col_name)
        parent_collection.children.link(asset_col)

    w_in, d_in, h_in = asset_spec["dimensions_inches"]
    w = w_in * INCH_SCALE
    d = d_in * INCH_SCALE
    h = h_in * INCH_SCALE

    px, py, pz = [c * UNIT_SCALE_FEET for c in asset_spec["placement_feet"]]
    rot_rad = math.radians(float(asset_spec["rotation_deg"]))

    root_empty = bpy.data.objects.new(f"{col_name}_Root", None)
    root_empty.empty_display_type = 'PLAIN_AXES'
    root_empty.empty_display_size = 0.25 * UNIT_SCALE_FEET
    root_empty.location = (px, -pz, py)  # Convert Stage18 Y-up to Blender Z-up
    root_empty.rotation_euler = Euler((0.0, 0.0, rot_rad), 'XYZ')
    root_empty["stage18_asset_code"] = asset_spec["code"]
    root_empty["stage18_category"] = asset_spec["category"]
    root_empty["stage18_film_timestamps"] = ", ".join(asset_spec["timestamps"])
    root_empty["stage18_udim_tile"] = asset_spec["udim_tile"]
    asset_col.objects.link(root_empty)

    sub_parts = asset_spec["sub_parts"]
    part_count = max(1, len(sub_parts))

    for idx, part in enumerate(sub_parts):
        part_name = f"{asset_spec['code']}_{idx+1:02d}_{part['partName'].replace(' ', '_')}"
        prim = part["geometryPrimitive"]
        frac = (idx + 0.5) / part_count

        bpy.ops.object.select_all(action='DESELECT')
        if prim in ('Cylinder', 'Lathe', 'Cone'):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=32,
                radius=max(w, d) * 0.35,
                depth=h / part_count,
                location=(0, 0, h * frac)
            )
        elif prim == 'Torus':
            bpy.ops.mesh.primitive_torus_add(
                major_radius=max(w, d) * 0.42,
                minor_radius=max(w, d) * 0.04,
                location=(0, 0, h * 0.4)
            )
        elif prim == 'Sphere':
            bpy.ops.mesh.primitive_uv_sphere_add(
                segments=32,
                ring_count=16,
                radius=max(w, d) * 0.22,
                location=(0, 0, h * frac)
            )
        else:
            bpy.ops.mesh.primitive_cube_add(
                size=1.0,
                location=(0, 0, h * frac)
            )
            obj_tmp = bpy.context.active_object
            obj_tmp.scale = (w * 0.5, d * 0.5, (h / part_count) * 0.48)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

        part_obj = bpy.context.active_object
        part_obj.name = part_name
        part_obj.parent = root_empty

        # Move to asset collection
        for c in list(part_obj.users_collection):
            c.objects.unlink(part_obj)
        asset_col.objects.link(part_obj)

        # Assign linked Principled BSDF v2 material
        mat_id = part.get("linkedMaterialId")
        if mat_id in mat_map:
            if part_obj.data.materials:
                part_obj.data.materials[0] = mat_map[mat_id]
            else:
                part_obj.data.materials.append(mat_map[mat_id])

        apply_modifiers_and_smart_uv(
            part_obj,
            float(asset_spec["bevel_mm"]),
            int(asset_spec["bevel_segments"]),
            int(asset_spec["subdiv_level"])
        )

        # Mark primary sub-mesh as Blender Asset Browser item
        if idx == 0:
            part_obj.asset_mark()
            if part_obj.asset_data:
                part_obj.asset_data.description = f"{asset_spec['name']} ({asset_spec['code']}) — Rear Window (1954)"
                part_obj.asset_data.tags.new(asset_spec["category"])
                part_obj.asset_data.tags.new("RearWindow1954")

    return root_empty


def build_jeffries_set_dressing_library():
    root_col_name = "Stage18_Apt2B_Jeffries_Asset_Library"
    root_col = bpy.data.collections.get(root_col_name)
    if not root_col:
        root_col = bpy.data.collections.new(root_col_name)
        bpy.context.scene.collection.children.link(root_col)

    mat_map = ensure_pbr_material_library()
    built_roots = []
    for asset_spec in JEFFRIES_3D_ASSETS:
        root_obj = build_asset_geometry(asset_spec, mat_map, root_col)
        built_roots.append(root_obj.name)

    print(f"[Stage 18 Asset Library] Built {len(built_roots)} multi-part 3D assets in '{root_col_name}'.")


if __name__ == "__main__":
    build_jeffries_set_dressing_library()
`;
}




