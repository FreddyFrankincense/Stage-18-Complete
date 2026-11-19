import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS,
  JeffriesPbrCategory,
  JeffriesPbrMaterialSpec
} from '../data/stage18Data';
import {
  CheckCircle2,
  Code2,
  Download,
  Eye,
  Film,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun
} from 'lucide-react';

export interface SynthesizedPbrCanvases {
  albedoCanvas: HTMLCanvasElement;
  roughnessCanvas: HTMLCanvasElement;
  normalCanvas: HTMLCanvasElement;
  bumpCanvas: HTMLCanvasElement;
  albedoData: Uint8ClampedArray;
  roughnessData: Uint8ClampedArray;
  normalData: Uint8ClampedArray;
  resolution: number;
}

const PBR_CANVAS_CACHE = new Map<string, SynthesizedPbrCanvases>();
const MAX_PBR_CACHE_ENTRIES = 48;

export function getPbrMaterialSignature(spec: JeffriesPbrMaterialSpec, resolution = 256): string {
  const sp = spec.surfaceProperties;
  return `${spec.id}|${spec.patternType}|${resolution}|${sp.baseColorHex}|${sp.secondaryColorHex}|${sp.accentColorHex}|${sp.roughness.toFixed(3)}|${sp.roughnessVariance.toFixed(3)}|${sp.metalness.toFixed(3)}|${sp.ior.toFixed(3)}|${sp.specularWeight.toFixed(3)}|${sp.clearcoatWeight.toFixed(3)}|${sp.clearcoatRoughness.toFixed(3)}|${sp.sheenWeight.toFixed(3)}|${sp.transmissionWeight.toFixed(3)}|${sp.bumpHeightMm.toFixed(3)}|${sp.normalStrength.toFixed(3)}|${sp.uvScale.toFixed(2)}|${sp.edgeWearFactor.toFixed(3)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16) || 0;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

// Deterministic 2D hash & value noise for repeatable procedural PBR textures
function hash2D(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

/**
 * Generates 4 physically calibrated PBR texture maps (Albedo sRGB, Roughness Linear,
 * OpenGL Tangent-Space Normal Map, and Height/Bump Map) on HTML5 Canvases.
 */
export function synthesizeJeffriesPbrMapsToCanvases(
  spec: JeffriesPbrMaterialSpec,
  resolution = 256
): SynthesizedPbrCanvases {
  const cacheKey = getPbrMaterialSignature(spec, resolution);
  const cached = PBR_CANVAS_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const albedoCanvas = document.createElement('canvas');
  const roughnessCanvas = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  const bumpCanvas = document.createElement('canvas');

  [albedoCanvas, roughnessCanvas, normalCanvas, bumpCanvas].forEach((c) => {
    c.width = resolution;
    c.height = resolution;
  });

  const albedoCtx = albedoCanvas.getContext('2d')!;
  const roughCtx = roughnessCanvas.getContext('2d')!;
  const normCtx = normalCanvas.getContext('2d')!;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  const albedoImg = albedoCtx.createImageData(resolution, resolution);
  const roughImg = roughCtx.createImageData(resolution, resolution);
  const normImg = normCtx.createImageData(resolution, resolution);
  const bumpImg = bumpCtx.createImageData(resolution, resolution);

  const heightField = new Float32Array(resolution * resolution);
  const roughField = new Float32Array(resolution * resolution);

  const props = spec.surfaceProperties;
  const [r1, g1, b1] = hexToRgb(props.baseColorHex);
  const [r2, g2, b2] = hexToRgb(props.secondaryColorHex);
  const [r3, g3, b3] = hexToRgb(props.accentColorHex);
  const scale = Math.max(1, props.uvScale);
  const wear = props.edgeWearFactor;

  for (let y = 0; y < resolution; y++) {
    const v = (y / resolution) * scale;
    for (let x = 0; x < resolution; x++) {
      const u = (x / resolution) * scale;
      const idx = y * resolution + x;
      const pIdx = idx * 4;

      let h = 0.5;
      let rVal = props.roughness;
      let colR = r1;
      let colG = g1;
      let colB = b1;

      if (spec.patternType === 'oak_parquet') {
        // Herringbone interlocking red oak strips + medullary ray wood grain
        const cellU = Math.floor(u * 1.5);
        const cellV = Math.floor(v * 1.5);
        const isHorizontal = (cellU + cellV) % 2 === 0;
        const localU = isHorizontal ? (u * 1.5) % 1 : (v * 1.5) % 1;
        const localV = isHorizontal ? (v * 4.5) % 1 : (u * 4.5) % 1;
        const plankId = hash2D(cellU, cellV + Math.floor(isHorizontal ? v * 4.5 : u * 4.5));

        const bevelMask =
          localU < 0.035 || localU > 0.965 || localV < 0.055 || localV > 0.945 ? 0.0 : 1.0;
        const grainCoord = isHorizontal ? u * 24 + fbm2D(u * 4, v * 4, 3) * 2.5 : v * 24 + fbm2D(u * 4, v * 4, 3) * 2.5;
        const grainWave = Math.sin(grainCoord * Math.PI * 2) * 0.5 + 0.5;
        const medullaryRay = Math.pow(valueNoise2D(u * 18, v * 18), 3);

        const scuff = fbm2D(u * 1.8, v * 1.8, 3) * wear;
        h = bevelMask * (0.45 + grainWave * 0.35 + medullaryRay * 0.2 - scuff * 0.25);
        rVal = Math.min(
          0.95,
          Math.max(
            0.08,
            props.roughness +
              (plankId - 0.5) * props.roughnessVariance +
              (1 - bevelMask) * 0.35 +
              scuff * 0.22 -
              medullaryRay * 0.08
          )
        );

        const mixT = grainWave * 0.55 + plankId * 0.35;
        colR = r1 * (1 - mixT) + r2 * mixT + medullaryRay * (r3 - r1) * 0.5;
        colG = g1 * (1 - mixT) + g2 * mixT + medullaryRay * (g3 - g1) * 0.5;
        colB = b1 * (1 - mixT) + b2 * mixT + medullaryRay * (b3 - b1) * 0.5;
        if (bevelMask < 0.5) {
          colR *= 0.42;
          colG *= 0.42;
          colB *= 0.42;
        }
      } else if (spec.patternType === 'painted_mullion') {
        // Semigloss cream enamel over pine moulding with vertical brush strokes & sill edge chips
        const brush = Math.sin(u * 38 + fbm2D(u * 6, v * 1.5, 3) * 3.0) * 0.5 + 0.5;
        const mouldingGroove =
          Math.abs((x / resolution) - 0.14) < 0.025 || Math.abs((x / resolution) - 0.86) < 0.025
            ? 0.25
            : 1.0;
        const edgeDist = Math.min(x / resolution, 1 - x / resolution, y / resolution, 1 - y / resolution);
        const chipNoise = fbm2D(u * 5.5, v * 5.5, 4);
        const isChipped = edgeDist < 0.08 + wear * 0.09 && chipNoise > 0.62 - wear * 0.25;

        h = isChipped ? 0.18 + brush * 0.15 : mouldingGroove * (0.65 + brush * 0.25);
        rVal = isChipped
          ? Math.min(0.92, props.roughness + 0.36)
          : Math.max(0.1, props.roughness + (brush - 0.5) * props.roughnessVariance);

        if (isChipped) {
          colR = r3;
          colG = g3;
          colB = b3;
        } else {
          const shade = mouldingGroove < 0.5 ? 0.86 : 0.96 + brush * 0.06;
          colR = (r1 * 0.75 + r2 * 0.25) * shade;
          colG = (g1 * 0.75 + g2 * 0.25) * shade;
          colB = (b1 * 0.75 + b2 * 0.25) * shade;
        }
      } else if (spec.patternType === 'sage_plaster') {
        // Troweled gypsum skim coat + roller micro-stipple + hairline settling crack
        const trowel = fbm2D(u * 1.4, v * 1.4, 3);
        const stipple = valueNoise2D(u * 32, v * 32);
        const crackPath = Math.abs(
          (x / resolution) - 0.52 - (fbm2D(v * 2.2, u * 1.1, 3) - 0.5) * 0.22
        );
        const isCrack = crackPath < 0.008 * (1 + wear);

        h = isCrack ? 0.08 : 0.35 + trowel * 0.38 + stipple * 0.27;
        rVal = Math.min(
          0.98,
          Math.max(0.35, props.roughness + (trowel - 0.5) * props.roughnessVariance + (isCrack ? 0.14 : 0))
        );

        const smudge = trowel * 0.65 + stipple * 0.35;
        colR = r1 * smudge + r2 * (1 - smudge);
        colG = g1 * smudge + g2 * (1 - smudge);
        colB = b1 * smudge + b2 * (1 - smudge);
        if (isCrack) {
          colR = r3 * 0.75;
          colG = g3 * 0.75;
          colB = b3 * 0.75;
        }
      } else if (spec.patternType === 'crown_glass') {
        // Cylinder-drawn sheet glass wave warp + corner dust/condensation film
        const wave =
          Math.sin(v * Math.PI * 2.0 + Math.sin(u * Math.PI * 1.5) * 0.8) * 0.5 + 0.5;
        const cornerDist = Math.min(
          x / resolution,
          1 - x / resolution,
          y / resolution,
          1 - y / resolution
        );
        const dust =
          cornerDist < 0.16
            ? (1 - cornerDist / 0.16) * fbm2D(u * 8, v * 8, 3) * (0.5 + wear)
            : 0;

        h = 0.45 + wave * 0.35 + dust * 0.2;
        rVal = Math.min(0.65, Math.max(0.02, props.roughness + dust * 0.45));

        colR = r1 * (1 - dust) + r2 * dust;
        colG = g1 * (1 - dust) + g2 * dust;
        colB = b1 * (1 - dust) + b2 * dust;
      } else if (spec.patternType === 'bamboo_blinds') {
        // Horizontal split-bamboo matchstick slats + vertical cotton twine warp cords
        const slatPhase = (v * 3.2) % 1;
        const slatId = Math.floor(v * 3.2);
        const slatProfile = Math.sin(slatPhase * Math.PI);
        const cordDist = Math.abs(((u * 0.75) % 1) - 0.5);
        const isCord = cordDist < 0.055;
        const nodeDark = hash2D(slatId, Math.floor(u * 1.5)) > 0.75 ? 0.78 : 1.0;

        h = isCord ? 0.88 + Math.cos((cordDist / 0.055) * Math.PI * 0.5) * 0.12 : slatProfile * 0.78;
        rVal = isCord
          ? Math.min(0.95, props.roughness + 0.18)
          : Math.max(0.25, props.roughness - slatProfile * 0.14);

        if (isCord) {
          colR = r3;
          colG = g3;
          colB = b3;
        } else {
          const reedShade = (0.65 + slatProfile * 0.35) * nodeDark;
          colR = (r1 * 0.7 + r2 * 0.3) * reedShade;
          colG = (g1 * 0.7 + g2 * 0.3) * reedShade;
          colB = (b1 * 0.7 + b2 * 0.3) * reedShade;
        }
      } else if (spec.patternType === 'wool_boucle') {
        // Interlocking curled oatmeal-taupe wool bouclé slub yarn weave
        const warp = Math.sin(u * Math.PI * 4 + fbm2D(u * 6, v * 6, 2) * 2.2) * 0.5 + 0.5;
        const weft = Math.sin(v * Math.PI * 4 + fbm2D(v * 6, u * 6, 2) * 2.2) * 0.5 + 0.5;
        const slubLoop = fbm2D(u * 9, v * 9, 3);
        const weave = ((Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0 ? warp : weft) * 0.65 + slubLoop * 0.35;

        h = weave;
        rVal = Math.min(0.98, Math.max(0.55, props.roughness + (0.5 - weave) * props.roughnessVariance));

        colR = r2 + (r1 - r2) * weave + (slubLoop > 0.65 ? (r3 - r1) * 0.6 : 0);
        colG = g2 + (g1 - g2) * weave + (slubLoop > 0.65 ? (g3 - g1) * 0.6 : 0);
        colB = b2 + (b1 - b2) * weave + (slubLoop > 0.65 ? (b3 - b1) * 0.6 : 0);
      } else if (spec.patternType === 'chrome_vulcanite') {
        // Split map: Upper brushed chrome + machined knurl band + Lower diamond vulcanite cladding
        const normY = y / resolution;
        if (normY < 0.38) {
          // Brushed Chrome Prism & Top Plate with faint brass edge wear
          const brush = valueNoise2D(u * 45, v * 2.5) * 0.18;
          const brassWear = normY < 0.045 * (1 + wear) && fbm2D(u * 8, v * 8, 2) > 0.52;
          h = 0.75 + brush;
          rVal = brassWear ? props.roughness + 0.12 : Math.max(0.06, props.roughness + brush * 0.3);
          colR = brassWear ? r3 : r1;
          colG = brassWear ? g3 : g1;
          colB = brassWear ? b3 : b1;
        } else if (normY < 0.52) {
          // Kilfitt Focus Ring Vertical Knurling
          const knurl = Math.sin(u * Math.PI * 12) * 0.5 + 0.5;
          h = 0.35 + knurl * 0.62;
          rVal = Math.max(0.12, props.roughness + (1 - knurl) * 0.25);
          colR = r1 * (0.75 + knurl * 0.25);
          colG = g1 * (0.75 + knurl * 0.25);
          colB = b1 * (0.75 + knurl * 0.25);
        } else {
          // Embossed Diamond Vulcanite Cladding
          const d1 = Math.abs(((u * 3 + v * 3) % 1) - 0.5) * 2;
          const d2 = Math.abs(((u * 3 - v * 3 + 100) % 1) - 0.5) * 2;
          const pebble = Math.min(d1, d2);
          h = 0.15 + pebble * 0.55;
          rVal = Math.min(0.88, props.roughness + 0.34 - pebble * 0.12);
          colR = r2 * (0.85 + pebble * 0.3);
          colG = g2 * (0.85 + pebble * 0.3);
          colB = b2 * (0.85 + pebble * 0.3);
        }
      } else {
        // Orthopedic Plaster-of-Paris Cast with spiral gauze wrap & ink signature band
        const spiral = ((v * 1.4 + u * 0.35) % 1);
        const lapRidge = spiral < 0.12 ? 0.92 : 0.48 + spiral * 0.28;
        const gauzeMesh =
          (Math.sin(u * Math.PI * 10) * 0.5 + 0.5) * (Math.sin(v * Math.PI * 10) * 0.5 + 0.5);
        const slurry = fbm2D(u * 2.5, v * 2.5, 3);
        const inkLine =
          Math.abs(y / resolution - 0.48 - Math.sin(u * 6.5) * 0.025) < 0.012 &&
          x / resolution > 0.18 &&
          x / resolution < 0.82;

        h = lapRidge * 0.55 + gauzeMesh * 0.25 + slurry * 0.2;
        rVal = Math.min(0.98, Math.max(0.55, props.roughness + (0.5 - slurry) * props.roughnessVariance));

        if (inkLine) {
          colR = r3;
          colG = g3;
          colB = b3;
        } else {
          const mix = slurry * 0.65 + gauzeMesh * 0.35;
          colR = r1 * mix + r2 * (1 - mix);
          colG = g1 * mix + g2 * (1 - mix);
          colB = b1 * mix + b2 * (1 - mix);
        }
      }

      heightField[idx] = h;
      roughField[idx] = rVal;

      albedoImg.data[pIdx] = clampByte(colR);
      albedoImg.data[pIdx + 1] = clampByte(colG);
      albedoImg.data[pIdx + 2] = clampByte(colB);
      albedoImg.data[pIdx + 3] = 255;

      const rByte = clampByte(rVal * 255);
      roughImg.data[pIdx] = rByte;
      roughImg.data[pIdx + 1] = rByte;
      roughImg.data[pIdx + 2] = rByte;
      roughImg.data[pIdx + 3] = 255;

      const hByte = clampByte(h * 255);
      bumpImg.data[pIdx] = hByte;
      bumpImg.data[pIdx + 1] = hByte;
      bumpImg.data[pIdx + 2] = hByte;
      bumpImg.data[pIdx + 3] = 255;
    }
  }

  // Second pass: Compute OpenGL Tangent-Space Normal Map (+X right, +Y up, +Z out)
  const strength = Math.max(0.2, props.normalStrength * (props.bumpHeightMm / 1.0) * 3.2);
  for (let y = 0; y < resolution; y++) {
    const yPrev = (y - 1 + resolution) % resolution;
    const yNext = (y + 1) % resolution;
    for (let x = 0; x < resolution; x++) {
      const xPrev = (x - 1 + resolution) % resolution;
      const xNext = (x + 1) % resolution;

      const dX =
        (heightField[y * resolution + xNext] - heightField[y * resolution + xPrev]) * strength;
      const dY =
        (heightField[yNext * resolution + x] - heightField[yPrev * resolution + x]) * strength;

      let nx = -dX;
      let ny = dY; // OpenGL +Y convention for Blender & Three.js
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      const pIdx = (y * resolution + x) * 4;
      normImg.data[pIdx] = clampByte((nx * 0.5 + 0.5) * 255);
      normImg.data[pIdx + 1] = clampByte((ny * 0.5 + 0.5) * 255);
      normImg.data[pIdx + 2] = clampByte((nz * 0.5 + 0.5) * 255);
      normImg.data[pIdx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);
  normCtx.putImageData(normImg, 0, 0);
  bumpCtx.putImageData(bumpImg, 0, 0);

  const result: SynthesizedPbrCanvases = {
    albedoCanvas,
    roughnessCanvas,
    normalCanvas,
    bumpCanvas,
    albedoData: albedoImg.data,
    roughnessData: roughImg.data,
    normalData: normImg.data,
    resolution
  };

  if (PBR_CANVAS_CACHE.size >= MAX_PBR_CACHE_ENTRIES) {
    const oldestKey = PBR_CANVAS_CACHE.keys().next().value;
    if (oldestKey) PBR_CANVAS_CACHE.delete(oldestKey);
  }
  PBR_CANVAS_CACHE.set(cacheKey, result);

  return result;
}

export interface PbrShaderBallRenderOptions {
  size?: number;
  mapResolution?: number;
  lightAzimuthDeg?: number;
  lightElevationDeg?: number;
  studioLightKelvin?: '3200K_tungsten' | '5400K_daylight';
  outerRingMode?: 'albedo_tile' | 'studio_vignette';
}

/**
 * Shared, zero-reallocation Principled BSDF v2 shader ball renderer used across
 * the 3D Workbench Swatch Gallery, Side-by-Side Material Inspector, and PBR Material Lab.
 */
export function renderPbrShaderBallToCanvas(
  targetCanvas: HTMLCanvasElement | null,
  spec: JeffriesPbrMaterialSpec,
  options: PbrShaderBallRenderOptions = {}
): void {
  if (!targetCanvas) return;
  const sRes = options.size ?? 160;
  const mapRes = options.mapResolution ?? (sRes <= 112 ? 96 : 220);
  const lightAzimuthDeg = options.lightAzimuthDeg ?? 36;
  const lightElevationDeg = options.lightElevationDeg ?? 40;
  const studioLightKelvin = options.studioLightKelvin ?? '3200K_tungsten';
  const outerRingMode = options.outerRingMode ?? 'studio_vignette';

  targetCanvas.width = sRes;
  targetCanvas.height = sRes;
  const sCtx = targetCanvas.getContext('2d');
  if (!sCtx) return;

  const synthesized = synthesizeJeffriesPbrMapsToCanvases(spec, mapRes);
  const { albedoData, roughnessData: roughData, normalData: normData } = synthesized;
  const sImg = sCtx.createImageData(sRes, sRes);

  const az = (lightAzimuthDeg * Math.PI) / 180;
  const el = (lightElevationDeg * Math.PI) / 180;
  const lx = Math.sin(az) * Math.cos(el);
  const ly = Math.sin(el);
  const lz = Math.cos(az) * Math.cos(el);

  let hx = lx;
  let hy = ly;
  let hz = lz + 1.0;
  const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
  hx /= hLen;
  hy /= hLen;
  hz /= hLen;

  const [lr, lg, lb] =
    studioLightKelvin === '3200K_tungsten' ? [1.04, 0.95, 0.85] : [0.96, 0.99, 1.05];

  const props = spec.surfaceProperties;
  const f0Scalar = Math.pow((props.ior - 1) / (props.ior + 1), 2);
  const cx = sRes * 0.5;
  const cy = sRes * 0.5;
  const radius = sRes * 0.42;
  const coatPower = Math.min(
    220,
    Math.max(8, 2 / Math.max(0.02, props.clearcoatRoughness * props.clearcoatRoughness))
  );
  const diffuseWeight = (1 - props.metalness * 0.86) * (1 - props.transmissionWeight * 0.68);
  const ambient = 0.17 + props.subsurfaceWeight * 0.2;

  for (let y = 0; y < sRes; y++) {
    const dy = (cy - y) / radius;
    for (let x = 0; x < sRes; x++) {
      const pIdx = (y * sRes + x) * 4;
      const dx = (x - cx) / radius;
      const r2 = dx * dx + dy * dy;

      if (r2 > 1.0) {
        if (outerRingMode === 'albedo_tile') {
          const tx = Math.floor((x / sRes) * mapRes) % mapRes;
          const ty = Math.floor((y / sRes) * mapRes) % mapRes;
          const tIdx = (ty * mapRes + tx) * 4;
          sImg.data[pIdx] = Math.round(albedoData[tIdx] * 0.48);
          sImg.data[pIdx + 1] = Math.round(albedoData[tIdx + 1] * 0.48);
          sImg.data[pIdx + 2] = Math.round(albedoData[tIdx + 2] * 0.48);
          sImg.data[pIdx + 3] = 255;
        } else {
          const bg = Math.max(9, Math.round(16 - r2 * 3));
          sImg.data[pIdx] = bg;
          sImg.data[pIdx + 1] = bg + 2;
          sImg.data[pIdx + 2] = bg + 6;
          sImg.data[pIdx + 3] = 255;
        }
        continue;
      }

      const dz = Math.sqrt(1.0 - r2);
      const uSphere = 0.5 + Math.atan2(dx, dz) / (Math.PI * 2);
      const vSphere = 0.5 - Math.asin(dy) / Math.PI;
      const tx = Math.floor(uSphere * mapRes * 1.45) % mapRes;
      const ty = Math.floor(vSphere * mapRes * 1.45) % mapRes;
      const tIdx = (ty * mapRes + tx) * 4;

      const baseR = albedoData[tIdx] / 255;
      const baseG = albedoData[tIdx + 1] / 255;
      const baseB = albedoData[tIdx + 2] / 255;
      const pixelRough = Math.max(0.04, roughData[tIdx] / 255);

      const tnx = (normData[tIdx] / 255) * 2 - 1;
      const tny = (normData[tIdx + 1] / 255) * 2 - 1;
      let nx = dx + tnx * 0.34;
      let ny = dy + tny * 0.34;
      let nz = dz;
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nLen;
      ny /= nLen;
      nz /= nLen;

      const nDotL = Math.max(0, nx * lx + ny * ly + nz * lz);
      const nDotV = Math.max(0.005, nz);
      const nDotH = Math.max(0, nx * hx + ny * hy + nz * hz);

      const fresnel = f0Scalar + (1 - f0Scalar) * Math.pow(1 - nDotV, 5);
      const specPower = Math.max(2, Math.pow(2 / (pixelRough * pixelRough) - 2, 0.84));
      const specLobe =
        Math.pow(nDotH, specPower) *
        (0.26 + fresnel * 1.58) *
        props.specularWeight *
        (1 + props.metalness * 1.75);

      const coatLobe = props.clearcoatWeight * Math.pow(nDotH, coatPower) * 0.82;
      const grazingSheen =
        props.sheenWeight * Math.pow(1 - nDotV, 3.1) * (0.35 + nDotL * 0.65) * 0.52;

      let outR =
        baseR * diffuseWeight * (ambient + nDotL * 0.88 * lr) +
        (props.metalness > 0.5 ? baseR : 1.0) * specLobe * lr +
        coatLobe * lr +
        grazingSheen * baseR * 1.25;
      let outG =
        baseG * diffuseWeight * (ambient + nDotL * 0.88 * lg) +
        (props.metalness > 0.5 ? baseG : 1.0) * specLobe * lg +
        coatLobe * lg +
        grazingSheen * baseG * 1.25;
      let outB =
        baseB * diffuseWeight * (ambient + nDotL * 0.88 * lb) +
        (props.metalness > 0.5 ? baseB : 1.0) * specLobe * lb +
        coatLobe * lb +
        grazingSheen * baseB * 1.25;

      if (props.transmissionWeight > 0.4) {
        const refrX = Math.floor((uSphere + nx * 0.08) * 14);
        const refrY = Math.floor((vSphere + ny * 0.08) * 14);
        const checker = (refrX + refrY) % 2 === 0 ? 0.34 : 0.18;
        outR =
          outR * (1 - props.transmissionWeight * 0.65) +
          baseR * checker * props.transmissionWeight +
          specLobe +
          fresnel * 0.55;
        outG =
          outG * (1 - props.transmissionWeight * 0.65) +
          baseG * checker * props.transmissionWeight +
          specLobe +
          fresnel * 0.58;
        outB =
          outB * (1 - props.transmissionWeight * 0.65) +
          baseB * checker * props.transmissionWeight +
          specLobe +
          fresnel * 0.62;
      }

      outR = outR / (1 + outR * 0.31);
      outG = outG / (1 + outG * 0.31);
      outB = outB / (1 + outB * 0.31);

      sImg.data[pIdx] = clampByte(outR * 255);
      sImg.data[pIdx + 1] = clampByte(outG * 255);
      sImg.data[pIdx + 2] = clampByte(outB * 255);
      sImg.data[pIdx + 3] = 255;
    }
  }

  sCtx.putImageData(sImg, 0, 0);
}

interface JeffriesPbrMaterialLabProps {
  materials: JeffriesPbrMaterialSpec[];
  onUpdateMaterials: (updated: JeffriesPbrMaterialSpec[]) => void;
  onOpenBlenderPbrScript?: () => void;
  compactMode?: boolean;
  initialSelectedMaterialId?: string;
}

const CATEGORY_FILTERS: { id: 'all' | JeffriesPbrCategory; label: string }[] = [
  { id: 'all', label: 'All 8 Materials' },
  { id: 'wood', label: 'Wood & Bamboo (3)' },
  { id: 'plaster', label: 'Plaster & Cast (2)' },
  { id: 'glass', label: 'Optical Glass (1)' },
  { id: 'fabric', label: 'Bouclé Fabric (1)' },
  { id: 'metal', label: 'Chrome & Vulcanite (1)' }
];

export default function JeffriesPbrMaterialLab({
  materials,
  onUpdateMaterials,
  onOpenBlenderPbrScript,
  compactMode = false,
  initialSelectedMaterialId
}: JeffriesPbrMaterialLabProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | JeffriesPbrCategory>('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    initialSelectedMaterialId || materials[0]?.id || 'jeff_quarter_sawn_oak_floor'
  );

  useEffect(() => {
    if (initialSelectedMaterialId) {
      setSelectedMaterialId(initialSelectedMaterialId);
    }
  }, [initialSelectedMaterialId]);

  const [lightAzimuthDeg, setLightAzimuthDeg] = useState<number>(38);
  const [lightElevationDeg, setLightElevationDeg] = useState<number>(42);
  const [studioLightKelvin, setStudioLightKelvin] = useState<'3200K_tungsten' | '5400K_daylight'>(
    '3200K_tungsten'
  );
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  const albedoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const roughnessCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const normalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bumpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spherePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const filteredMaterials = useMemo(() => {
    if (selectedCategory === 'all') return materials;
    return materials.filter((m) => m.category === selectedCategory);
  }, [materials, selectedCategory]);

  const activeMaterial = useMemo(() => {
    return (
      materials.find((m) => m.id === selectedMaterialId) ||
      filteredMaterials[0] ||
      materials[0]
    );
  }, [materials, selectedMaterialId, filteredMaterials]);

  const updateSurfaceProperty = <K extends keyof JeffriesPbrMaterialSpec['surfaceProperties']>(
    key: K,
    value: JeffriesPbrMaterialSpec['surfaceProperties'][K]
  ) => {
    const updated = materials.map((m) => {
      if (m.id !== activeMaterial.id) return m;
      return {
        ...m,
        surfaceProperties: {
          ...m.surfaceProperties,
          [key]: value
        }
      };
    });
    onUpdateMaterials(updated);
  };

  const handleResetActiveMaterial = () => {
    const baseline = INITIAL_JEFFRIES_APARTMENT_PBR_MATERIALS.find(
      (m) => m.id === activeMaterial.id
    );
    if (!baseline) return;
    const updated = materials.map((m) => (m.id === activeMaterial.id ? baseline : m));
    onUpdateMaterials(updated);
    setSyncToastMessage(`Reset ${baseline.shortLabel} to 1954 4K Remux film-still calibration.`);
    window.setTimeout(() => setSyncToastMessage(null), 2600);
  };

  const handleDownloadFourPbrMaps = () => {
    const maps = synthesizeJeffriesPbrMapsToCanvases(activeMaterial, 512);
    const downloads: { canvas: HTMLCanvasElement; suffix: string }[] = [
      { canvas: maps.albedoCanvas, suffix: 'BaseColor_sRGB' },
      { canvas: maps.roughnessCanvas, suffix: 'Roughness_Linear' },
      { canvas: maps.normalCanvas, suffix: 'Normal_OpenGL' },
      { canvas: maps.bumpCanvas, suffix: 'Height_Bump_Linear' }
    ];
    downloads.forEach(({ canvas, suffix }, i) => {
      window.setTimeout(() => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${activeMaterial.blenderMaterialName}_${suffix}.png`;
        a.click();
      }, i * 140);
    });
    setSyncToastMessage(
      `Exported 4x 512px PNG PBR maps (${activeMaterial.blenderMaterialName}) for Blender.`
    );
    window.setTimeout(() => setSyncToastMessage(null), 3200);
  };

  // Synthesize the 4 PBR map canvases + physically shaded sphere preview whenever activeMaterial or lighting changes
  useEffect(() => {
    if (!activeMaterial) return;
    const mapRes = 256;
    const synthesized = synthesizeJeffriesPbrMapsToCanvases(activeMaterial, mapRes);

    const copyToMount = (src: HTMLCanvasElement, dst: HTMLCanvasElement | null) => {
      if (!dst) return;
      dst.width = mapRes;
      dst.height = mapRes;
      const ctx = dst.getContext('2d');
      if (ctx) ctx.drawImage(src, 0, 0);
    };

    copyToMount(synthesized.albedoCanvas, albedoCanvasRef.current);
    copyToMount(synthesized.roughnessCanvas, roughnessCanvasRef.current);
    copyToMount(synthesized.normalCanvas, normalCanvasRef.current);
    copyToMount(synthesized.bumpCanvas, bumpCanvasRef.current);

    renderPbrShaderBallToCanvas(spherePreviewCanvasRef.current, activeMaterial, {
      size: 220,
      mapResolution: mapRes,
      lightAzimuthDeg,
      lightElevationDeg,
      studioLightKelvin,
      outerRingMode: 'studio_vignette'
    });
  }, [activeMaterial, lightAzimuthDeg, lightElevationDeg, studioLightKelvin]);

  if (!activeMaterial) return null;
  const sp = activeMaterial.surfaceProperties;

  return (
    <div className="bg-[#12161F] border border-white/10 rounded-xl p-5 shadow-2xl space-y-5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded">
              APT 2B · L.B. JEFFERIES FOREGROUND HERO SET
            </span>
            <span className="text-xs font-mono text-slate-400">
              Blender 4.2 LTS Principled BSDF v2 + AgX Calibrated
            </span>
          </div>
          <h2 className="text-lg font-bold text-white font-display mt-1.5">
            Film-Still Calibrated PBR Texture &amp; Material Studio
          </h2>
          <p className="text-xs text-slate-300 mt-0.5 max-w-3xl">
            Synthesizes 4 physically-based texture channels (<span className="text-amber-300 font-mono">Base Color sRGB</span>,{' '}
            <span className="text-sky-300 font-mono">Roughness Linear</span>,{' '}
            <span className="text-indigo-300 font-mono">OpenGL Normal Map</span>, and{' '}
            <span className="text-emerald-300 font-mono">mm-Scaled Height/Bump</span>) from 1954 4K Remux reference frames, live-synced to the 3D Stage Viewport and Blender Python builder.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadFourPbrMaps}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export 4 PBR Maps (.png)
          </button>
          {onOpenBlenderPbrScript && (
            <button
              onClick={onOpenBlenderPbrScript}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 transition-colors flex items-center gap-1.5"
            >
              <Code2 className="w-3.5 h-3.5" />
              Open 06_jeffries_pbr_materials.py
            </button>
          )}
        </div>
      </div>

      {syncToastMessage && (
        <div className="px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Category Filter Strip + 8 Material Selector Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-slate-100 text-slate-950 font-semibold'
                    : 'bg-[#0B0D11] text-slate-400 hover:text-white border border-white/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Active Shader: <strong className="text-amber-300">{activeMaterial.blenderMaterialName}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {filteredMaterials.map((mat) => {
            const isSelected = mat.id === activeMaterial.id;
            return (
              <button
                key={mat.id}
                onClick={() => setSelectedMaterialId(mat.id)}
                className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 shadow-md'
                    : 'bg-[#0B0D11] border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span
                    className="w-4 h-4 rounded-sm border border-white/20 shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${mat.surfaceProperties.baseColorHex} 55%, ${mat.surfaceProperties.secondaryColorHex} 100%)`
                    }}
                  />
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-slate-300">
                    {mat.category}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white leading-tight line-clamp-2">
                    {mat.shortLabel}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 tabular-nums">
                    R:{mat.surfaceProperties.roughness.toFixed(2)} · IOR:{mat.surfaceProperties.ior.toFixed(2)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workbench Grid: Left = Shader Ball + 4 PBR Map Canvases | Right = Film Still Provenance + Interactive Surface Sliders */}
      <div className={`grid grid-cols-1 ${compactMode ? 'xl:grid-cols-12' : 'lg:grid-cols-12'} gap-5`}>
        {/* Left Column (7 cols): Live PBR Shader Ball + 4 Synthesized Texture Channels */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0B0D11] border border-white/10 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{activeMaterial.name}</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Target Blender Meshes: {activeMaterial.targetBlenderMeshes.join(', ')}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    setStudioLightKelvin((prev) =>
                      prev === '3200K_tungsten' ? '5400K_daylight' : '3200K_tungsten'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-mono rounded bg-[#12161F] text-amber-300 border border-white/10 hover:border-amber-400/40 flex items-center gap-1"
                >
                  <Sun className="w-3 h-3" />
                  {studioLightKelvin === '3200K_tungsten' ? '3200K Stage Tungsten' : '5400K Courtyard Sun'}
                </button>
                <button
                  onClick={handleResetActiveMaterial}
                  className="px-2.5 py-1 text-[11px] font-mono rounded bg-[#12161F] text-slate-300 border border-white/10 hover:text-white flex items-center gap-1"
                  title="Reset material to 1954 film-still calibration"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Interactive Shaded PBR Sphere */}
              <div className="md:col-span-5 flex flex-col items-center bg-[#12161F] border border-white/10 rounded-lg p-3">
                <div className="text-[11px] font-mono text-slate-400 mb-1.5 flex items-center justify-between w-full">
                  <span>PRINCIPLED BSDF v2 PREVIEW</span>
                  <span className="text-amber-300 tabular-nums">IOR {sp.ior.toFixed(2)}</span>
                </div>
                <canvas
                  ref={spherePreviewCanvasRef}
                  className="w-44 h-44 rounded-lg border border-white/10 shadow-inner"
                />
                <div className="w-full mt-2.5 space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Key Light Azimuth</span>
                    <span className="text-slate-200 tabular-nums">{lightAzimuthDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={-80}
                    max={80}
                    value={lightAzimuthDeg}
                    onChange={(e) => setLightAzimuthDeg(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Key Light Elevation</span>
                    <span className="text-slate-200 tabular-nums">{lightElevationDeg}°</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={85}
                    value={lightElevationDeg}
                    onChange={(e) => setLightElevationDeg(Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* 4 Synthesized Procedural PBR Texture Maps */}
              <div className="md:col-span-7 grid grid-cols-2 gap-2.5">
                <div className="bg-[#12161F] border border-white/10 rounded-lg p-2">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-amber-300 font-semibold">1. ALBEDO / BASE COLOR</span>
                    <span className="text-slate-400">sRGB</span>
                  </div>
                  <canvas
                    ref={albedoCanvasRef}
                    className="w-full aspect-square rounded border border-white/10"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>Primary {sp.baseColorHex}</span>
                    <span>Wear {(sp.edgeWearFactor * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="bg-[#12161F] border border-white/10 rounded-lg p-2">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-sky-300 font-semibold">2. ROUGHNESS MAP</span>
                    <span className="text-slate-400">Non-Color</span>
                  </div>
                  <canvas
                    ref={roughnessCanvasRef}
                    className="w-full aspect-square rounded border border-white/10"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>Mean R: {sp.roughness.toFixed(2)}</span>
                    <span>±{sp.roughnessVariance.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-[#12161F] border border-white/10 rounded-lg p-2">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-indigo-300 font-semibold">3. TANGENT NORMAL</span>
                    <span className="text-slate-400">OpenGL +Y</span>
                  </div>
                  <canvas
                    ref={normalCanvasRef}
                    className="w-full aspect-square rounded border border-white/10"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>Strength {sp.normalStrength.toFixed(2)}</span>
                    <span>Sobel dH/duv</span>
                  </div>
                </div>

                <div className="bg-[#12161F] border border-white/10 rounded-lg p-2">
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-emerald-300 font-semibold">4. HEIGHT / BUMP</span>
                    <span className="text-slate-400">16-Bit Linear</span>
                  </div>
                  <canvas
                    ref={bumpCanvasRef}
                    className="w-full aspect-square rounded border border-white/10"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>Relief {sp.bumpHeightMm.toFixed(2)} mm</span>
                    <span>Scale {sp.uvScale.toFixed(1)}×</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Blender 4.2 Principled BSDF v2 Optimization & Node Architecture Box */}
          <div className="bg-[#0B0D11] border border-white/10 rounded-xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-sky-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Blender 4.2+ Cycles Node Graph &amp; AgX Optimization
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {activeMaterial.blenderOptimization.bsdfVersion}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {activeMaterial.blenderOptimization.shaderNodesUsed.map((nodeName, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-[11px] font-mono rounded bg-[#12161F] text-slate-200 border border-white/10"
                >
                  {nodeName}
                </span>
              ))}
            </div>

            <p className="text-slate-300 leading-relaxed">
              <strong className="text-white">Cycles Render Optimization:</strong>{' '}
              {activeMaterial.blenderOptimization.cyclesOptimizationNotes}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono text-slate-400">
              <div className="p-2 rounded bg-[#12161F] border border-white/5">
                <span className="text-amber-300 block font-semibold">AgX View Transform</span>
                {activeMaterial.blenderOptimization.agxColorManagementNote}
              </div>
              <div className="p-2 rounded bg-[#12161F] border border-white/5">
                <span className="text-emerald-300 block font-semibold">VRAM &amp; Geometry Budget</span>
                {activeMaterial.blenderOptimization.memoryFootprintNote}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Film-Still Optical Evidence + Surface Property Sliders */}
        <div className="lg:col-span-5 space-y-4">
          {/* 1954 Film-Still Reference Card */}
          <div className="bg-[#0B0D11] border border-amber-500/30 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-semibold text-amber-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5" />
                4K REMUX FILM-STILL EVIDENCE
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[11px] tabular-nums">
                SMPTE {activeMaterial.filmStillRef.smpteTimecode} · {activeMaterial.filmStillRef.focalLengthMm}mm
              </span>
            </div>
            <div className="text-white font-semibold">{activeMaterial.filmStillRef.sceneTitle}</div>
            <p className="text-slate-300 leading-relaxed">
              {activeMaterial.filmStillRef.opticalObservation}
            </p>
            <div className="text-[11px] font-mono text-slate-400 pt-1 border-t border-white/10">
              Lighting Reference: <span className="text-slate-200">{activeMaterial.filmStillRef.lightingCondition}</span>
            </div>
          </div>

          {/* Interactive Surface Property Calibration Controls */}
          <div className="bg-[#0B0D11] border border-white/10 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Surface Properties (Live-Synced to 3D &amp; Blender)
              </span>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <Eye className="w-3 h-3" />
                Live 3D Sync
              </span>
            </div>

            {/* Color Swatches */}
            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
              <label className="p-2 rounded bg-[#12161F] border border-white/10 flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-slate-400 text-[10px]">Base Albedo</div>
                  <div className="text-slate-200 uppercase">{sp.baseColorHex}</div>
                </div>
                <input
                  type="color"
                  value={sp.baseColorHex}
                  onChange={(e) => updateSurfaceProperty('baseColorHex', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
              </label>

              <label className="p-2 rounded bg-[#12161F] border border-white/10 flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-slate-400 text-[10px]">Secondary</div>
                  <div className="text-slate-200 uppercase">{sp.secondaryColorHex}</div>
                </div>
                <input
                  type="color"
                  value={sp.secondaryColorHex}
                  onChange={(e) => updateSurfaceProperty('secondaryColorHex', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
              </label>

              <label className="p-2 rounded bg-[#12161F] border border-white/10 flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-slate-400 text-[10px]">Accent / Wear</div>
                  <div className="text-slate-200 uppercase">{sp.accentColorHex}</div>
                </div>
                <input
                  type="color"
                  value={sp.accentColorHex}
                  onChange={(e) => updateSurfaceProperty('accentColorHex', e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
              </label>
            </div>

            {/* Sliders */}
            <div className="space-y-2.5 text-xs font-mono">
              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-300">Micro-Surface Roughness</span>
                  <span className="text-amber-300 tabular-nums">{sp.roughness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.02}
                  max={0.98}
                  step={0.01}
                  value={sp.roughness}
                  onChange={(e) => updateSurfaceProperty('roughness', Number(e.target.value))}
                  className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-slate-300">Refractive Index (Specular IOR)</span>
                  <span className="text-sky-300 tabular-nums">{sp.ior.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={1.3}
                  max={2.6}
                  step={0.01}
                  value={sp.ior}
                  onChange={(e) => updateSurfaceProperty('ior', Number(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Metalness</span>
                    <span className="text-slate-200 tabular-nums">{sp.metalness.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={sp.metalness}
                    onChange={(e) => updateSurfaceProperty('metalness', Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Clearcoat / Wax</span>
                    <span className="text-slate-200 tabular-nums">{sp.clearcoatWeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={sp.clearcoatWeight}
                    onChange={(e) => updateSurfaceProperty('clearcoatWeight', Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Microfiber Sheen</span>
                    <span className="text-slate-200 tabular-nums">{sp.sheenWeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={sp.sheenWeight}
                    onChange={(e) => updateSurfaceProperty('sheenWeight', Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Transmission</span>
                    <span className="text-slate-200 tabular-nums">{sp.transmissionWeight.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.98}
                    step={0.02}
                    value={sp.transmissionWeight}
                    onChange={(e) =>
                      updateSurfaceProperty('transmissionWeight', Number(e.target.value))
                    }
                    className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Bump Relief (mm)</span>
                    <span className="text-emerald-300 tabular-nums">{sp.bumpHeightMm.toFixed(2)} mm</span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={4.0}
                    step={0.05}
                    value={sp.bumpHeightMm}
                    onChange={(e) => updateSurfaceProperty('bumpHeightMm', Number(e.target.value))}
                    className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Normal Strength</span>
                    <span className="text-indigo-300 tabular-nums">{sp.normalStrength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.05}
                    value={sp.normalStrength}
                    onChange={(e) => updateSurfaceProperty('normalStrength', Number(e.target.value))}
                    className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">Patina / Edge Wear</span>
                    <span className="text-slate-200 tabular-nums">
                      {(sp.edgeWearFactor * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.85}
                    step={0.02}
                    value={sp.edgeWearFactor}
                    onChange={(e) => updateSurfaceProperty('edgeWearFactor', Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-slate-300">UV Tile Density</span>
                    <span className="text-slate-200 tabular-nums">{sp.uvScale.toFixed(1)}×</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    step={0.5}
                    value={sp.uvScale}
                    onChange={(e) => updateSurfaceProperty('uvScale', Number(e.target.value))}
                    className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
