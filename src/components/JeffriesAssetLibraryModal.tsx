import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  INITIAL_JEFFRIES_3D_ASSETS,
  Jeffries3DAssetSpec,
  JeffriesAssetCategory,
  JeffriesPbrMaterialSpec,
  generateBlenderJeffriesAssetLibraryPython
} from '../data/stage18Data';
import {
  Box,
  Camera,
  Check,
  Copy,
  Crosshair,
  Download,
  Eye,
  Film,
  Grid,
  Layers,
  Package,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
  Wrench,
  X
} from 'lucide-react';

export type AssetViewportShadingMode =
  | 'pbr_shaded'
  | 'pbr_wireframe'
  | 'uv_checker'
  | 'clay_silhouette';

interface JeffriesAssetLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jeffriesPbrMaterials: JeffriesPbrMaterialSpec[];
  initialAssetId?: string;
  onFocusAssetInApartment?: (asset: Jeffries3DAssetSpec) => void;
  onOpenPbrMaterialStudio?: (materialId: string) => void;
  onOpenBlenderAssetScriptTab?: () => void;
}

const ASSET_CATEGORIES: Array<'All' | JeffriesAssetCategory> = [
  'All',
  'Seating & Couch',
  'Tables & Storage',
  'Lamps & Practicals',
  'Hi-Fi & Record Player',
  'Camera & Optical Gear',
  'Set Dressing & Decor'
];

// Detect software WebGL once for rendering cost budget
const isSoftwareGl = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

function createProceduralUvCheckerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const cells = 16;
  const cellSize = canvas.width / cells;

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const isEven = (x + y) % 2 === 0;
      ctx.fillStyle = isEven ? '#1E293B' : '#F59E0B';
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('UDIM UV CHECK', 18, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

/**
 * Procedurally constructs a composite 5-12 part 3D model (`THREE.Group`) for each of the 12
 * L.B. Jeffries apartment set dressing & furniture assets. Each child sub-group stores
 * `userData.basePos` and `userData.explodedOffset` so the Exploded View slider smoothly separates parts.
 */
function buildProceduralJeffriesAssetGroup(
  asset: Jeffries3DAssetSpec,
  pbrMaterials: JeffriesPbrMaterialSpec[]
): THREE.Group {
  const root = new THREE.Group();

  const getMatProps = (matId: string, fallbackHex: string, rough: number, metal: number) => {
    const found = pbrMaterials.find((m) => m.id === matId);
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(found ? found.surfaceProperties.baseColorHex : fallbackHex),
      roughness: found ? found.surfaceProperties.roughness : rough,
      metalness: found ? found.surfaceProperties.metalness : metal,
      clearcoat: found ? found.surfaceProperties.clearcoatWeight : metal > 0.5 ? 0.25 : 0.05,
      clearcoatRoughness: found ? found.surfaceProperties.clearcoatRoughness : 0.25,
      sheen: found ? found.surfaceProperties.sheenWeight : rough > 0.7 ? 0.45 : 0.0,
      ior: found ? found.surfaceProperties.ior : 1.5
    });
  };

  const addExplodablePart = (
    meshOrGroup: THREE.Object3D,
    basePos: [number, number, number],
    explodedOffset: [number, number, number],
    partName: string
  ) => {
    meshOrGroup.position.set(basePos[0], basePos[1], basePos[2]);
    meshOrGroup.userData.basePos = new THREE.Vector3(...basePos);
    meshOrGroup.userData.explodedOffset = new THREE.Vector3(...explodedOffset);
    meshOrGroup.userData.partName = partName;
    meshOrGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    root.add(meshOrGroup);
  };

  const walnutMat = getMatProps('jeff_quarter_sawn_oak_floor', '#6B4226', 0.38, 0.0);
  const linenMat = getMatProps('jeff_midcentury_boucle_upholstery', '#7A7262', 0.82, 0.0);
  const cordovanLeatherMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#5A2D24'),
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.22,
    sheen: 0.35
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E2E8F0'),
    roughness: 0.16,
    metalness: 0.96,
    clearcoat: 0.3
  });
  const brushedBrassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D4AF37'),
    roughness: 0.24,
    metalness: 0.9,
    clearcoat: 0.2
  });
  const blackAnodizedMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1E222B'),
    roughness: 0.38,
    metalness: 0.82
  });
  const opticalLensMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#38BDF8'),
    roughness: 0.04,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
    clearcoat: 1.0,
    ior: 1.62
  });
  const plasterCastMat = getMatProps('jeff_bound_linen_plaster_cast', '#EAE6DC', 0.88, 0.0);
  const bambooMat = getMatProps('jeff_bamboo_matchstick_blinds', '#B89058', 0.64, 0.0);
  const warmShadeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FDE68A'),
    emissive: new THREE.Color('#F59E0B'),
    emissiveIntensity: 0.45,
    roughness: 0.68,
    side: THREE.DoubleSide
  });

  switch (asset.id) {
    case 'asset-daybed-couch': {
      // 1. Walnut Plinth Frame
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.5), walnutMat);
      addExplodablePart(plinth, [0, -0.32, 0], [0, -0.35, 0], 'Walnut Perimeter Plinth Frame');

      // 2. 6 Tapered Legs + Brass Ferrules
      const legsGroup = new THREE.Group();
      [-1.42, 0, 1.42].forEach((lx) => {
        [-0.62, 0.62].forEach((lz) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.42, 14), walnutMat);
          leg.position.set(lx, 0, lz);
          legsGroup.add(leg);
          const ferrule = new THREE.Mesh(
            new THREE.CylinderGeometry(0.036, 0.03, 0.12, 14),
            brushedBrassMat
          );
          ferrule.position.set(lx, -0.15, lz);
          legsGroup.add(ferrule);
        });
      });
      addExplodablePart(
        legsGroup,
        [0, -0.6, 0],
        [0, -0.75, 0],
        '6 Tapered Mid-Century Legs + Brass Ferrules'
      );

      // 3. Tufted Mattress + Button Tufts
      const mattressGroup = new THREE.Group();
      const mattress = new THREE.Mesh(new THREE.BoxGeometry(3.14, 0.34, 1.44), linenMat);
      mattressGroup.add(mattress);
      for (let tx = -1.2; tx <= 1.2; tx += 0.6) {
        for (let tz = -0.42; tz <= 0.42; tz += 0.42) {
          const button = new THREE.Mesh(
            new THREE.SphereGeometry(0.028, 10, 10),
            cordovanLeatherMat
          );
          button.position.set(tx, 0.175, tz);
          mattressGroup.add(button);
        }
      }
      addExplodablePart(
        mattressGroup,
        [0, -0.06, 0],
        [0, 0.15, 0],
        'Piped Box-Tufted Primary Mattress'
      );

      // 4. 3 Backrest Wedge Cushions
      const wedgesGroup = new THREE.Group();
      [-1.02, 0, 1.02].forEach((wx) => {
        const wedge = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.46, 0.28), linenMat);
        wedge.position.set(wx, 0, 0);
        wedge.rotation.x = -0.18;
        wedgesGroup.add(wedge);
      });
      addExplodablePart(
        wedgesGroup,
        [0, 0.34, -0.52],
        [0, 0.55, -0.45],
        '3 Tapered Backrest Wedge Cushions'
      );

      // 5. Pair of Cylindrical End Bolsters
      const bolstersGroup = new THREE.Group();
      [-1.36, 1.36].forEach((bx) => {
        const bolster = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 1.36, 20),
          cordovanLeatherMat
        );
        bolster.rotation.x = Math.PI / 2;
        bolster.position.set(bx, 0, 0.04);
        bolstersGroup.add(bolster);
      });
      addExplodablePart(
        bolstersGroup,
        [0, 0.26, 0],
        [0.45, 0.45, 0.25],
        'Pair of Cylindrical End Bolster Pillows'
      );
      break;
    }

    case 'asset-wheelchair': {
      // 1. Tubular Chrome X-Brace Frame
      const frameGroup = new THREE.Group();
      [-0.56, 0.56].forEach((sx) => {
        const sideBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.35, 12), chromeMat);
        sideBar.rotation.x = Math.PI / 2;
        sideBar.position.set(sx, 0, 0);
        frameGroup.add(sideBar);
        const rearPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.45, 12), chromeMat);
        rearPost.position.set(sx, 0.35, 0.58);
        frameGroup.add(rearPost);
      });
      const xBrace1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 12), chromeMat);
      xBrace1.rotation.z = 0.82;
      frameGroup.add(xBrace1);
      const xBrace2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 12), chromeMat);
      xBrace2.rotation.z = -0.82;
      frameGroup.add(xBrace2);
      addExplodablePart(frameGroup, [0, -0.15, 0], [0, -0.25, 0], 'Tubular Chrome X-Brace Chassis');

      // 2. Cordovan Leather Seat & Backrest Sling
      const slingGroup = new THREE.Group();
      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 1.05), cordovanLeatherMat);
      slingGroup.add(seatMesh);
      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.09), cordovanLeatherMat);
      backMesh.position.set(0, 0.48, 0.52);
      backMesh.rotation.x = 0.1;
      slingGroup.add(backMesh);
      [-0.56, 0.56].forEach((ax) => {
        const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.85), walnutMat);
        armPad.position.set(ax, 0.38, 0.08);
        slingGroup.add(armPad);
      });
      addExplodablePart(
        slingGroup,
        [0, 0.05, 0],
        [0, 0.45, 0.1],
        'Cordovan Leather Seat & Backrest Sling'
      );

      // 3. 24-Inch Spoked Rear Drive Wheels & Handrims
      const rearWheelsGroup = new THREE.Group();
      [-0.68, 0.68].forEach((wx) => {
        const tire = new THREE.Mesh(
          new THREE.TorusGeometry(0.62, 0.045, 16, 36),
          blackAnodizedMat
        );
        tire.rotation.y = Math.PI / 2;
        tire.position.set(wx, 0, 0);
        rearWheelsGroup.add(tire);

        const handrim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.02, 12, 32), chromeMat);
        handrim.rotation.y = Math.PI / 2;
        handrim.position.set(wx + (wx > 0 ? 0.05 : -0.05), 0, 0);
        rearWheelsGroup.add(handrim);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16), chromeMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(wx, 0, 0);
        rearWheelsGroup.add(hub);

        for (let s = 0; s < 12; s++) {
          const angle = (s / 12) * Math.PI;
          const spoke = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, 1.2, 6),
            chromeMat
          );
          spoke.position.set(wx, 0, 0);
          spoke.rotation.x = angle;
          rearWheelsGroup.add(spoke);
        }
      });
      addExplodablePart(
        rearWheelsGroup,
        [0, -0.18, 0.36],
        [0.65, -0.1, 0.25],
        '24-Inch Spoked Rear Drive Wheels & Handrims'
      );

      // 4. 8-Inch Front Casters
      const castersGroup = new THREE.Group();
      [-0.52, 0.52].forEach((cx) => {
        const casterWheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20),
          blackAnodizedMat
        );
        casterWheel.rotation.z = Math.PI / 2;
        casterWheel.position.set(cx, 0, 0);
        castersGroup.add(casterWheel);
      });
      addExplodablePart(
        castersGroup,
        [0, -0.58, -0.55],
        [0.4, -0.55, -0.45],
        '8-Inch Front Caster Forks & Solid Tires'
      );

      // 5. Elevating Left-Leg Ratchet Board & Plaster Cast
      const castGroup = new THREE.Group();
      const legBoard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.95), walnutMat);
      legBoard.position.set(0, -0.14, 0);
      castGroup.add(legBoard);
      const castCylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 1.15, 20),
        plasterCastMat
      );
      castCylinder.rotation.x = Math.PI / 2 - 0.14;
      castGroup.add(castCylinder);
      addExplodablePart(
        castGroup,
        [-0.26, -0.05, -0.92],
        [-0.25, 0.25, -0.65],
        'Elevating Left-Leg Ratchet Board & Plaster Cast'
      );
      break;
    }

    case 'asset-lap-table': {
      // 1. Walnut Formica Top with Brass Lip
      const topGroup = new THREE.Group();
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.09, 1.25), walnutMat);
      topGroup.add(board);
      const brassRim = new THREE.Mesh(
        new THREE.BoxGeometry(2.14, 0.12, 1.29),
        brushedBrassMat
      );
      brassRim.position.y = 0.01;
      topGroup.add(brassRim);
      addExplodablePart(
        topGroup,
        [0, 0.65, 0],
        [0, 0.55, 0],
        'Walnut Formica Top with Brass Lip Gallery'
      );

      // 2. Telescoping Chrome Column
      const colGroup = new THREE.Group();
      const outerTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1.35, 18),
        chromeMat
      );
      colGroup.add(outerTube);
      const clutchKnob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16),
        blackAnodizedMat
      );
      clutchKnob.position.y = 0.12;
      colGroup.add(clutchKnob);
      addExplodablePart(
        colGroup,
        [-0.82, -0.02, 0],
        [-0.45, 0, 0],
        'Telescoping Chrome Cantilever Column & Lock Knob'
      );

      // 3. Weighted U-Base & Casters
      const baseGroup = new THREE.Group();
      const uBarLeft = new THREE.Mesh(
        new THREE.BoxGeometry(1.95, 0.08, 0.14),
        blackAnodizedMat
      );
      uBarLeft.position.set(0, 0, -0.52);
      baseGroup.add(uBarLeft);
      const uBarRight = new THREE.Mesh(
        new THREE.BoxGeometry(1.95, 0.08, 0.14),
        blackAnodizedMat
      );
      uBarRight.position.set(0, 0, 0.52);
      baseGroup.add(uBarRight);
      const crossSpine = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.09, 1.18),
        blackAnodizedMat
      );
      crossSpine.position.set(-0.82, 0, 0);
      baseGroup.add(crossSpine);
      addExplodablePart(
        baseGroup,
        [0, -0.7, 0],
        [0, -0.55, 0],
        'Weighted U-Base & 4 Swivel Casters'
      );
      break;
    }

    case 'asset-coffee-table': {
      // 1. Surfboard-Profile Walnut Tabletop
      const topSlab = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.1, 1.35), walnutMat);
      addExplodablePart(
        topSlab,
        [0, 0.36, 0],
        [0, 0.48, 0],
        'Chamfered Surfboard-Profile Walnut Tabletop'
      );

      // 2. Slatted Lower Magazine Shelf
      const rackGroup = new THREE.Group();
      for (let i = -3; i <= 3; i++) {
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.018, 2.6, 10),
          i % 2 === 0 ? brushedBrassMat : walnutMat
        );
        rod.rotation.z = Math.PI / 2;
        rod.position.set(0, 0, i * 0.14);
        rackGroup.add(rod);
      }
      addExplodablePart(
        rackGroup,
        [0, 0.02, 0],
        [0, 0, 0],
        'Slatted Dowel Lower Magazine Shelf'
      );

      // 3. 4 Splayed Tapered Walnut Legs
      const legsGroup = new THREE.Group();
      [-1.25, 1.25].forEach((lx) => {
        [-0.48, 0.48].forEach((lz) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.026, 0.85, 14), walnutMat);
          leg.position.set(lx, 0, lz);
          leg.rotation.z = lx > 0 ? -0.15 : 0.15;
          legsGroup.add(leg);
        });
      });
      addExplodablePart(
        legsGroup,
        [0, -0.1, 0],
        [0, -0.48, 0],
        '4 Splayed Tapered Walnut Dowel Legs'
      );

      // 4. Stacked Magazine Proofs & Amber Glass Ashtray
      const propsGroup = new THREE.Group();
      const mag1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.04, 0.55),
        new THREE.MeshStandardMaterial({ color: '#F1F5F9', roughness: 0.45 })
      );
      mag1.position.set(-0.45, 0, 0.05);
      mag1.rotation.y = 0.18;
      propsGroup.add(mag1);
      const ashtray = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.18, 0.08, 8),
        new THREE.MeshPhysicalMaterial({
          color: '#D97706',
          roughness: 0.12,
          transmission: isSoftwareGl ? 0 : 0.8,
          transparent: true,
          opacity: 0.85
        })
      );
      ashtray.position.set(0.55, 0.02, -0.1);
      propsGroup.add(ashtray);
      addExplodablePart(
        propsGroup,
        [0, 0.45, 0],
        [0.2, 0.82, 0.1],
        'Stacked Magazine Proofs & Amber Glass Ashtray'
      );
      break;
    }

    case 'asset-dining-table': {
      // 1. Center Leaf + Hinged Drop Leaves
      const topGroup = new THREE.Group();
      const centerTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.09, 1.9), walnutMat);
      topGroup.add(centerTop);
      [-0.85, 0.85].forEach((lx) => {
        const dropLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.08, 1.86), walnutMat);
        dropLeaf.position.set(lx, -0.02, 0);
        topGroup.add(dropLeaf);
      });
      addExplodablePart(
        topGroup,
        [0, 0.45, 0],
        [0, 0.48, 0],
        'Center Fixed Leaf & Dual Hinged Drop Leaves'
      );

      // 2. Turned Gateleg Frame
      const gateGroup = new THREE.Group();
      [-0.48, 0.48].forEach((gx) => {
        [-0.78, 0, 0.78].forEach((gz) => {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.035, 1.15, 14),
            walnutMat
          );
          post.position.set(gx, 0, gz);
          gateGroup.add(post);
        });
      });
      addExplodablePart(
        gateGroup,
        [0, -0.16, 0],
        [0, -0.48, 0],
        'Turned Gateleg Swing Frame & Stretchers'
      );

      // 3. Pair of Bentwood Bistro Side Chairs
      const chairsGroup = new THREE.Group();
      [-1.35, 1.35].forEach((cx) => {
        const seat = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.07, 20),
          cordovanLeatherMat
        );
        seat.position.set(cx, -0.18, 0);
        chairsGroup.add(seat);
        const backHoops = new THREE.Mesh(
          new THREE.TorusGeometry(0.36, 0.03, 10, 24, Math.PI),
          walnutMat
        );
        backHoops.position.set(cx, 0.15, 0);
        backHoops.rotation.y = cx > 0 ? -Math.PI / 2 : Math.PI / 2;
        chairsGroup.add(backHoops);
      });
      addExplodablePart(
        chairsGroup,
        [0, 0, 0],
        [0.65, -0.1, 0],
        'Pair of Bentwood Bistro Side Chairs'
      );

      // 4. 21 Club Silver Chafing Dish & Wine Bottle
      const serviceGroup = new THREE.Group();
      const chafingDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        chromeMat
      );
      chafingDome.position.set(-0.2, 0.05, 0);
      serviceGroup.add(chafingDome);
      const wineBottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.09, 0.48, 16),
        new THREE.MeshPhysicalMaterial({ color: '#14532D', roughness: 0.12, clearcoat: 1.0 })
      );
      wineBottle.position.set(0.35, 0.24, 0.2);
      serviceGroup.add(wineBottle);
      addExplodablePart(
        serviceGroup,
        [0, 0.52, 0],
        [0, 0.85, 0],
        '21 Club Silver Chafing Dish & Wine Bottle'
      );
      break;
    }

    case 'asset-floor-lamp': {
      // 1. Stepped Brushed-Brass Base
      const baseGroup = new THREE.Group();
      const baseDisc1 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.54, 0.08, 28),
        brushedBrassMat
      );
      baseGroup.add(baseDisc1);
      const baseDisc2 = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.42, 0.12, 28),
        brushedBrassMat
      );
      baseDisc2.position.y = 0.09;
      baseGroup.add(baseDisc2);
      addExplodablePart(
        baseGroup,
        [0, -1.15, 0],
        [0, -0.65, 0],
        'Weighted Stepped Brushed-Brass Base'
      );

      // 2. Tubular Brass Shaft & Turned Walnut Collar
      const shaftGroup = new THREE.Group();
      const brassPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 1.9, 18),
        brushedBrassMat
      );
      shaftGroup.add(brassPole);
      const walnutCollar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.065, 0.48, 20),
        walnutMat
      );
      walnutCollar.position.y = 0.25;
      shaftGroup.add(walnutCollar);
      addExplodablePart(
        shaftGroup,
        [0, -0.15, 0],
        [0, -0.1, 0],
        'Tubular Brass Shaft & Turned Walnut Collar'
      );

      // 3. Milk-Glass Diffuser Bowl & 3 Sockets
      const bowlGroup = new THREE.Group();
      const opalBowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.12, 0.28, 24, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: '#FFFBEB',
          emissive: '#F59E0B',
          emissiveIntensity: 0.35,
          roughness: 0.2,
          side: THREE.DoubleSide
        })
      );
      bowlGroup.add(opalBowl);
      addExplodablePart(
        bowlGroup,
        [0, 0.82, 0],
        [0, 0.35, 0],
        'Milk-Glass Upward Reflector Bowl & 3 Brass Sockets'
      );

      // 4. Pleated Ivory Silk Shantung Drum Shade
      const shadeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.64, 0.78, 0.68, 36, 1, true),
        warmShadeMat
      );
      addExplodablePart(
        shadeMesh,
        [0, 0.92, 0],
        [0, 0.78, 0],
        'Pleated Ivory Silk Shantung Drum Shade (2850K Emitter)'
      );
      break;
    }

    case 'asset-desk-lamp': {
      // 1. Cast-Iron Base
      const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.45, 0.14, 24),
        blackAnodizedMat
      );
      addExplodablePart(
        baseMesh,
        [0, -0.75, 0],
        [0, -0.55, 0],
        'Wrinkle-Enamel Cast-Iron Base'
      );

      // 2. Coiled Brass Gooseneck Curve
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.68, 0),
        new THREE.Vector3(0, -0.1, -0.28),
        new THREE.Vector3(0, 0.55, -0.05),
        new THREE.Vector3(0, 0.62, 0.32)
      ]);
      const neckGeo = new THREE.TubeGeometry(curve, 36, 0.055, 14, false);
      const neckMesh = new THREE.Mesh(neckGeo, brushedBrassMat);
      addExplodablePart(
        neckMesh,
        [0, 0, 0],
        [0, 0, -0.25],
        'Coiled Flexible Brass Gooseneck Arm'
      );

      // 3. Spun-Aluminum Parabolic Bell Shade
      const bellGroup = new THREE.Group();
      const bellCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.46, 0.52, 28, 1, true),
        chromeMat
      );
      bellCone.rotation.x = Math.PI * 0.68;
      bellGroup.add(bellCone);
      addExplodablePart(
        bellGroup,
        [0, 0.52, 0.46],
        [0.25, 0.45, 0.25],
        'Spun-Aluminum Parabolic Bell Shade & Bakelite Socket'
      );

      // 4. 2700K Tungsten Bulb
      const bulbMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 20, 20),
        warmShadeMat
      );
      addExplodablePart(
        bulbMesh,
        [0, 0.38, 0.56],
        [0.35, 0.25, 0.55],
        '2700K Frosted Tungsten A19 Bulb'
      );
      break;
    }

    case 'asset-record-player': {
      // 1. Two-Tone Tweed & Mahogany Cabinet Plinth
      const plinthGroup = new THREE.Group();
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.44, 1.65), linenMat);
      plinthGroup.add(cabinet);
      const mahoganyTrim = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 1.69), walnutMat);
      mahoganyTrim.position.y = -0.16;
      plinthGroup.add(mahoganyTrim);
      const speakerGrille = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.24, 0.04),
        brushedBrassMat
      );
      speakerGrille.position.set(0, 0, 0.83);
      plinthGroup.add(speakerGrille);
      addExplodablePart(
        plinthGroup,
        [0, -0.28, 0],
        [0, -0.48, 0],
        'Two-Tone Tweed & Mahogany Cabinet Plinth + Brass Grille'
      );

      // 2. 10-Inch Burgundy-Flocked Platter
      const platter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.64, 0.06, 36),
        cordovanLeatherMat
      );
      addExplodablePart(
        platter,
        [-0.12, -0.02, 0],
        [-0.08, 0.12, 0],
        '10-Inch Burgundy-Flocked Turntable Platter'
      );

      // 3. 12-Inch 33⅓ RPM Microgroove Vinyl LP Record
      const lpGroup = new THREE.Group();
      const vinylDisc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 0.02, 48),
        new THREE.MeshPhysicalMaterial({
          color: '#111318',
          roughness: 0.18,
          metalness: 0.12,
          clearcoat: 0.85
        })
      );
      lpGroup.add(vinylDisc);
      const redLabel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.24, 0.024, 32),
        new THREE.MeshStandardMaterial({ color: '#B91C1C', roughness: 0.4 })
      );
      lpGroup.add(redLabel);
      addExplodablePart(
        lpGroup,
        [-0.12, 0.04, 0],
        [-0.08, 0.45, 0],
        '12-Inch 33⅓ RPM Microgroove Vinyl LP Record'
      );

      // 4. Counterweighted Chrome Tonearm
      const armGroup = new THREE.Group();
      const pivotPost = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.16, 16),
        chromeMat
      );
      pivotPost.position.set(0.62, 0.04, -0.45);
      armGroup.add(pivotPost);
      const toneArmRod = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.04, 0.95),
        chromeMat
      );
      toneArmRod.position.set(0.45, 0.1, -0.05);
      toneArmRod.rotation.y = 0.36;
      armGroup.add(toneArmRod);
      addExplodablePart(
        armGroup,
        [0, 0.04, 0],
        [0.42, 0.38, 0.15],
        'Counterweighted Chrome Tonearm & Cartridge Head'
      );

      // 5. Changer Spindle & Speed Dial
      const spindleGroup = new THREE.Group();
      const spindle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.48, 12),
        chromeMat
      );
      spindle.position.set(-0.12, 0.22, 0);
      spindleGroup.add(spindle);
      const speedKnob = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.1, 0.06, 16),
        brushedBrassMat
      );
      speedKnob.position.set(0.64, 0.02, 0.52);
      spindleGroup.add(speedKnob);
      addExplodablePart(
        spindleGroup,
        [0, 0, 0],
        [0.35, 0.25, -0.25],
        'Automatic Record-Changer Spindle & Bakelite Speed Dial'
      );

      // 6. Stacked LP Sleeves
      const sleeves = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 0.08, 1.45),
        new THREE.MeshStandardMaterial({ color: '#D97706', roughness: 0.55 })
      );
      sleeves.rotation.y = -0.18;
      addExplodablePart(
        sleeves,
        [-1.35, -0.42, 0.15],
        [-0.65, 0, 0.25],
        'Stacked 12" Vintage Cardboard LP Album Sleeves'
      );
      break;
    }

    case 'asset-exakta-rig': {
      // 1. Exakta VX Body
      const bodyGroup = new THREE.Group();
      const bodyBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.42, 0.34),
        blackAnodizedMat
      );
      bodyGroup.add(bodyBox);
      const chromeTop = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.1, 0.32), chromeMat);
      chromeTop.position.y = 0.22;
      bodyGroup.add(chromeTop);
      const prismFinder = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.28), chromeMat);
      prismFinder.position.y = 0.32;
      bodyGroup.add(prismFinder);
      addExplodablePart(
        bodyGroup,
        [0, 0.48, 0.62],
        [0, 0.38, 0.45],
        'Exakta VX Trapezoidal Die-Cast Body (Vulcanite & Chrome)'
      );

      // 2. Kilfitt 400mm Telephoto Barrel
      const barrelGroup = new THREE.Group();
      const mainTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.15, 1.65, 28),
        blackAnodizedMat
      );
      mainTube.rotation.x = Math.PI / 2;
      barrelGroup.add(mainTube);
      [-0.35, 0.15, 0.55].forEach((rz) => {
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(0.215, 0.215, 0.09, 28),
          chromeMat
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.z = rz;
        barrelGroup.add(ring);
      });
      addExplodablePart(
        barrelGroup,
        [0, 0.48, -0.35],
        [0, 0.35, -0.35],
        'Kilfitt Fern-Kilar 400mm f/5.6 Anodized Telephoto Barrel'
      );

      // 3. 72mm Coated Front Objective & Hood
      const glassGroup = new THREE.Group();
      const hood = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.2, 0.38, 28, 1, true),
        blackAnodizedMat
      );
      hood.rotation.x = Math.PI / 2;
      glassGroup.add(hood);
      const lensGlass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.04, 28),
        opticalLensMat
      );
      lensGlass.rotation.x = Math.PI / 2;
      lensGlass.position.z = 0.12;
      glassGroup.add(lensGlass);
      addExplodablePart(
        glassGroup,
        [0, 0.48, -1.32],
        [0, 0.35, -0.88],
        '72mm Multi-Coated Front Objective Doublet & Lens Hood'
      );

      // 4. Cradle Tripod Collar & Fluid Head
      const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.32, 0.38), chromeMat);
      addExplodablePart(
        headMesh,
        [0, 0.18, -0.1],
        [0, 0, 0],
        'Cradle Tripod Collar & Pan-Tilt Fluid Head'
      );

      // 5. 3 Wooden Tripod Legs
      const legsGroup = new THREE.Group();
      [-0.45, 0, 0.45].forEach((ang, idx) => {
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.03, 1.55, 12),
          walnutMat
        );
        leg.position.set(ang * 0.85, -0.65, idx === 1 ? -0.45 : 0.32);
        leg.rotation.z = -ang * 0.35;
        legsGroup.add(leg);
      });
      addExplodablePart(
        legsGroup,
        [0, 0, 0],
        [0, -0.58, 0],
        '3 Telescoping Ash-Wood Tripod Legs & Brass Spikes'
      );
      break;
    }

    case 'asset-graflex-flash': {
      // 1. Knurled Chrome 3-Cell Battery Handle
      const handleMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 1.35, 24),
        chromeMat
      );
      addExplodablePart(
        handleMesh,
        [0, -0.35, 0],
        [0, -0.48, 0],
        'Knurled Chrome 3-Cell Battery Handle Tube'
      );

      // 2. 7-Inch Spun-Aluminum Parabolic Reflector Dish
      const dishMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.68, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.48),
        chromeMat
      );
      dishMesh.rotation.x = -Math.PI / 2;
      addExplodablePart(
        dishMesh,
        [0, 0.52, -0.25],
        [0, 0.35, -0.35],
        '7-Inch Spun-Aluminum Parabolic Reflector Dish'
      );

      // 3. Clear Glass GE #5 Flashbulb
      const bulbMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 24, 24),
        warmShadeMat
      );
      addExplodablePart(
        bulbMesh,
        [0, 0.52, 0.12],
        [0, 0.35, 0.42],
        'Clear Glass GE #5 Magnesium-Foil Flashbulb'
      );

      // 4. Open Yellow Carton of 12 Spare #5 Flashbulbs
      const cartonGroup = new THREE.Group();
      const boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.32, 0.62),
        new THREE.MeshStandardMaterial({ color: '#F59E0B', roughness: 0.65 })
      );
      cartonGroup.add(boxMesh);
      [-0.25, 0, 0.25].forEach((bx) => {
        [-0.14, 0.14].forEach((bz) => {
          const spareBulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 12, 12),
            opticalLensMat
          );
          spareBulb.position.set(bx, 0.2, bz);
          cartonGroup.add(spareBulb);
        });
      });
      addExplodablePart(
        cartonGroup,
        [0.95, -0.68, 0.2],
        [0.55, -0.25, 0.2],
        'Open Yellow Cardboard Carton of 12 Spare #5 Flashbulbs'
      );
      break;
    }

    case 'asset-binoculars': {
      // 1. Dual Porro-Prism Magnesium Barrels
      const barrelsGroup = new THREE.Group();
      [-0.36, 0.36].forEach((bx) => {
        const bTube = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.3, 0.95, 24),
          blackAnodizedMat
        );
        bTube.rotation.x = Math.PI / 2;
        bTube.position.set(bx, 0, 0);
        barrelsGroup.add(bTube);
      });
      const hingeBridge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.72, 16),
        brushedBrassMat
      );
      hingeBridge.rotation.z = Math.PI / 2;
      barrelsGroup.add(hingeBridge);
      addExplodablePart(
        barrelsGroup,
        [-0.3, 0.05, 0],
        [0, 0.2, 0],
        'Dual Porro-Prism Magnesium Barrels (Vulcanite Finish)'
      );

      // 2. 35mm Coated Objective Lenses
      const opticsGroup = new THREE.Group();
      [-0.36, 0.36].forEach((bx) => {
        const objGlass = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.25, 0.06, 24),
          opticalLensMat
        );
        objGlass.rotation.x = Math.PI / 2;
        objGlass.position.set(bx, 0, -0.5);
        opticsGroup.add(objGlass);
      });
      addExplodablePart(
        opticsGroup,
        [-0.3, 0.05, 0],
        [0, 0.25, -0.48],
        '35mm Coated Objective Lenses & Bakelite Ocular Eyecups'
      );

      // 3. Stitched Russet Cowhide Carrying Case
      const caseMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.05, 0.58),
        cordovanLeatherMat
      );
      addExplodablePart(
        caseMesh,
        [0.82, -0.05, 0.1],
        [0.52, -0.25, 0.15],
        'Stitched Russet Cowhide Carrying Case & Neck Strap'
      );
      break;
    }

    default: {
      // 'asset-decor-gallery': Split-Bamboo Screen, Framed Press Prints & Negative Lightbox
      // 1. 6-Panel Folding Rattan & Split-Bamboo Screen
      const screenGroup = new THREE.Group();
      for (let p = 0; p < 6; p++) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 2.15, 0.06),
          bambooMat
        );
        panel.position.set((p - 2.5) * 0.38, 0, (p % 2 === 0 ? 1 : -1) * 0.08);
        panel.rotation.y = (p % 2 === 0 ? 1 : -1) * 0.35;
        screenGroup.add(panel);
      }
      addExplodablePart(
        screenGroup,
        [-0.45, 0, 0],
        [-0.4, 0, 0],
        '6-Panel Folding Rattan & Split-Bamboo Screen'
      );

      // 2. 6 Framed 11x14" Silver-Gelatin Press Prints
      const printsGroup = new THREE.Group();
      [-0.45, 0.45].forEach((px) => {
        [-0.38, 0.38].forEach((py) => {
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.58, 0.46, 0.05),
            blackAnodizedMat
          );
          frame.position.set(px, py, 0);
          printsGroup.add(frame);
        });
      });
      addExplodablePart(
        printsGroup,
        [1.05, 0.35, -0.25],
        [0.48, 0.35, -0.25],
        '6 Framed 11×14" Silver-Gelatin Action Press Prints'
      );

      // 3. Illuminated 8x10" Negative Viewing Lightbox
      const lightboxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.38, 0.52),
        opticalLensMat
      );
      addExplodablePart(
        lightboxMesh,
        [1.05, -0.68, 0.3],
        [0.48, -0.35, 0.25],
        'Illuminated 8×10" Negative Viewing Lightbox & Loupe'
      );
      break;
    }
  }

  return root;
}

export default function JeffriesAssetLibraryModal({
  isOpen,
  onClose,
  jeffriesPbrMaterials,
  initialAssetId,
  onFocusAssetInApartment,
  onOpenPbrMaterialStudio,
  onOpenBlenderAssetScriptTab
}: JeffriesAssetLibraryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'All' | JeffriesAssetCategory>('All');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    initialAssetId || INITIAL_JEFFRIES_3D_ASSETS[0].id
  );
  const [explodedPct, setExplodedPct] = useState<number>(0);
  const [shadingMode, setShadingMode] = useState<AssetViewportShadingMode>('pbr_shaded');
  const [autoTurntable, setAutoTurntable] = useState<boolean>(!isSoftwareGl);
  const [showDimensionCage, setShowDimensionCage] = useState<boolean>(true);
  const [copiedSingleFlag, setCopiedSingleFlag] = useState<boolean>(false);
  const [copiedFullScriptFlag, setCopiedFullScriptFlag] = useState<boolean>(false);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const explodedPctRef = useRef<number>(explodedPct);
  const shadingModeRef = useRef<AssetViewportShadingMode>(shadingMode);
  const autoTurntableRef = useRef<boolean>(autoTurntable);
  const showDimensionCageRef = useRef<boolean>(showDimensionCage);
  const requestRenderRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (initialAssetId) {
      setSelectedAssetId(initialAssetId);
    }
  }, [initialAssetId]);

  const filteredAssets = useMemo(() => {
    if (selectedCategory === 'All') return INITIAL_JEFFRIES_3D_ASSETS;
    return INITIAL_JEFFRIES_3D_ASSETS.filter((a) => a.category === selectedCategory);
  }, [selectedCategory]);

  const selectedAsset = useMemo(
    () =>
      INITIAL_JEFFRIES_3D_ASSETS.find((a) => a.id === selectedAssetId) ||
      INITIAL_JEFFRIES_3D_ASSETS[0],
    [selectedAssetId]
  );

  useEffect(() => {
    explodedPctRef.current = explodedPct;
    requestRenderRef.current();
  }, [explodedPct]);

  useEffect(() => {
    shadingModeRef.current = shadingMode;
    requestRenderRef.current();
  }, [shadingMode]);

  useEffect(() => {
    autoTurntableRef.current = autoTurntable;
    requestRenderRef.current();
  }, [autoTurntable]);

  useEffect(() => {
    showDimensionCageRef.current = showDimensionCage;
    requestRenderRef.current();
  }, [showDimensionCage]);

  // Mount & update the dedicated 3D Turntable Asset Inspector Viewport
  useEffect(() => {
    if (!isOpen) return;
    const container = canvasContainerRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth || 640);
    const height = Math.max(280, container.clientHeight || 420);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090C12');
    scene.fog = new THREE.FogExp2('#090C12', 0.06);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(3.2, 2.1, 3.6);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Mandatory Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // 3-Point Warm/Cool Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xffedd5, 2.8);
    keyLight.position.set(4.5, 6.5, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const hemiFill = new THREE.HemisphereLight(0x93c5fd, 0x451a03, 0.85);
    hemiFill.position.set(0, 8, 0);
    scene.add(hemiFill);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(-4.5, 3.5, -4.2);
    scene.add(rimLight);

    // Contact Shadow Grounding Plane + Measurement Pedestal Grid
    const shadowTex = createRadialContactShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(5.2, 5.2),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.55
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.22;
    scene.add(shadowPlane);

    const studioGrid = new THREE.GridHelper(5.5, 22, 0xf59e0b, 0x1e293b);
    studioGrid.position.y = -1.21;
    scene.add(studioGrid);

    // Build selected 3D Asset Group
    const assetGroup = buildProceduralJeffriesAssetGroup(selectedAsset, jeffriesPbrMaterials);
    scene.add(assetGroup);

    // Build wireframe overlay & bounding dimension cage
    const box3 = new THREE.Box3().setFromObject(assetGroup);
    const boxHelper = new THREE.Box3Helper(box3, new THREE.Color('#F59E0B'));
    boxHelper.visible = showDimensionCageRef.current;
    scene.add(boxHelper);

    const uvCheckerTex = createProceduralUvCheckerTexture(
      renderer.capabilities.getMaxAnisotropy()
    );
    const uvCheckerMat = new THREE.MeshStandardMaterial({
      map: uvCheckerTex,
      roughness: 0.45,
      metalness: 0.05
    });
    const clayMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#D6D3D1'),
      roughness: 0.58,
      metalness: 0.05
    });

    const wireOverlayGroup = new THREE.Group();
    assetGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        const edges = new THREE.EdgesGeometry(obj.geometry, 18);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.65
          })
        );
        line.position.copy(obj.getWorldPosition(new THREE.Vector3()));
        line.rotation.copy(obj.rotation);
        wireOverlayGroup.add(line);
      }
    });
    wireOverlayGroup.visible = shadingModeRef.current === 'pbr_wireframe';
    scene.add(wireOverlayGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.target.set(0, -0.05, 0);
    controls.update();

    let currentExploded = explodedPctRef.current / 100;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;

        const targetExploded = explodedPctRef.current / 100;
        currentExploded = THREE.MathUtils.damp(currentExploded, targetExploded, 8.0, dt);

        assetGroup.children.forEach((part) => {
          const basePos = part.userData.basePos as THREE.Vector3 | undefined;
          const expOff = part.userData.explodedOffset as THREE.Vector3 | undefined;
          if (basePos && expOff) {
            part.position.set(
              basePos.x + expOff.x * currentExploded * 1.35,
              basePos.y + expOff.y * currentExploded * 1.35,
              basePos.z + expOff.z * currentExploded * 1.35
            );
          }
        });

        if (autoTurntableRef.current && !isSoftwareGl) {
          assetGroup.rotation.y += dt * 0.42;
          wireOverlayGroup.rotation.y = assetGroup.rotation.y;
        }

        boxHelper.visible = showDimensionCageRef.current;
        wireOverlayGroup.visible = shadingModeRef.current === 'pbr_wireframe';

        if (shadingModeRef.current === 'uv_checker') {
          scene.overrideMaterial = uvCheckerMat;
        } else if (shadingModeRef.current === 'clay_silhouette') {
          scene.overrideMaterial = clayMat;
        } else {
          scene.overrideMaterial = null;
        }

        controls.update();
        renderer.render(scene, camera);
        scene.overrideMaterial = null;

        const stillMoving =
          Math.abs(currentExploded - targetExploded) > 0.004 ||
          (autoTurntableRef.current && !isSoftwareGl);

        const done = () => {
          renderBusy = false;
          if (renderDirty || stillMoving) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    controls.addEventListener('change', requestRender);

    const onResize = () => {
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      requestRender();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    requestRender();

    return () => {
      ro.disconnect();
      controls.removeEventListener('change', requestRender);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      shadowTex.dispose();
      uvCheckerTex.dispose();
      uvCheckerMat.dispose();
      clayMat.dispose();
      envTex.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [isOpen, selectedAsset, jeffriesPbrMaterials]);

  if (!isOpen) return null;

  const [wIn, dIn, hIn] = selectedAsset.apartmentPlacement.dimensionsInches;

  const handleCopySingleAssetPython = async () => {
    const snippet = generateBlenderJeffriesAssetLibraryPython(
      [selectedAsset],
      jeffriesPbrMaterials,
      'imperial_feet'
    );
    await navigator.clipboard.writeText(snippet);
    setCopiedSingleFlag(true);
    window.setTimeout(() => setCopiedSingleFlag(false), 1800);
  };

  const handleDownloadFullBlenderLibrary = () => {
    const script = generateBlenderJeffriesAssetLibraryPython(
      INITIAL_JEFFRIES_3D_ASSETS,
      jeffriesPbrMaterials,
      'imperial_feet'
    );
    const blob = new Blob([script], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '07_jeffries_set_dressing_asset_library.py';
    a.click();
    URL.revokeObjectURL(url);
    setCopiedFullScriptFlag(true);
    window.setTimeout(() => setCopiedFullScriptFlag(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto">
      <div className="w-full max-w-[1360px] bg-[#0B0D11] border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#12161F] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="text-amber-400 font-semibold">
                  APT 2B · L.B. JEFFERIES FOREGROUND SET DRESSING &amp; FURNITURE LIBRARY
                </span>
                <span aria-hidden="true">·</span>
                <span>12 Multi-Part Blender 4.2 Assets</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-300">UDIM 1001–1003 Calibrated</span>
              </div>
              <h2 className="text-lg font-bold text-white font-display">
                L.B. Jeffries Apartment 3D Asset Library &amp; Turntable Inspector
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadFullBlenderLibrary}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              {copiedFullScriptFlag ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Downloaded 07_jeffries_set_dressing_asset_library.py
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Download Blender 4.2 Asset Library (.PY)
                </>
              )}
            </button>

            {onOpenBlenderAssetScriptTab && (
              <button
                onClick={() => {
                  onClose();
                  onOpenBlenderAssetScriptTab();
                }}
                className="px-3 py-2 text-xs font-medium rounded-lg bg-[#1A202C] text-slate-200 hover:text-white border border-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                Open in Script Compiler →
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Close 3D Asset Library"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Strip */}
        <div className="px-6 py-3 bg-[#0E121A] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {ASSET_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              const count =
                cat === 'All'
                  ? INITIAL_JEFFRIES_3D_ASSETS.length
                  : INITIAL_JEFFRIES_3D_ASSETS.filter((a) => a.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-[#151A24] text-slate-300 hover:text-white border border-white/10'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          <div className="text-xs text-slate-400 font-mono">
            Total Library Budget:{' '}
            <span className="text-slate-200 font-semibold tabular-nums">
              {INITIAL_JEFFRIES_3D_ASSETS.reduce((acc, a) => acc + a.topologySpec.quadCount, 0).toLocaleString()}{' '}
              Quads
            </span>{' '}
            ·{' '}
            <span className="text-amber-300">
              {INITIAL_JEFFRIES_3D_ASSETS.reduce((acc, a) => acc + a.subParts.length, 0)} Sub-Meshes
            </span>
          </div>
        </div>

        {/* Main 12-Column Workspace: Left = 12-Asset Catalog | Center = 3D Turntable + Exploded View | Right = Sub-Parts & Blender Specs */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column (3 cols): 12-Asset Selector List */}
          <div className="lg:col-span-3 border-r border-white/10 bg-[#0B0D11] max-h-[640px] overflow-y-auto p-3 space-y-2">
            {filteredAssets.map((asset) => {
              const isSelected = asset.id === selectedAsset.id;
              const [aw, ad, ah] = asset.apartmentPlacement.dimensionsInches;
              return (
                <button
                  key={asset.id}
                  onClick={() => {
                    setSelectedAssetId(asset.id);
                    setExplodedPct(0);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : 'bg-[#12161F] border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className={isSelected ? 'text-amber-300 font-semibold' : 'text-slate-400'}>
                      {asset.code}
                    </span>
                    <span>
                      {aw}&quot;×{ad}&quot;×{ah}&quot;
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white mt-0.5 leading-snug">
                    {asset.shortLabel}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>{asset.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{asset.subParts.length} parts</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-amber-300/90">
                      {asset.filmTimestamps[0]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Center Column (5 cols): Interactive 3D Turntable & Exploded-View Viewport */}
          <div className="lg:col-span-5 border-r border-white/10 bg-[#090C12] flex flex-col justify-between">
            <div className="relative h-[430px] w-full overflow-hidden">
              <div ref={canvasContainerRef} className="w-full h-full" />

              {/* Top-Left Asset Telemetry Overlay */}
              <div className="pointer-events-none absolute top-3 left-3 bg-[#12161F]/90 border border-white/10 rounded-lg px-3 py-2 text-[11px] space-y-0.5">
                <div className="font-mono text-amber-400 font-semibold">
                  {selectedAsset.code} · {selectedAsset.blenderCollectionName}
                </div>
                <div className="text-slate-300">
                  Dimensions: <strong className="text-white tabular-nums">{wIn}&quot; W × {dIn}&quot; D × {hIn}&quot; H</strong>
                </div>
                <div className="text-slate-400 font-mono">
                  Topology: {selectedAsset.topologySpec.quadCount.toLocaleString()} Quads · UDIM{' '}
                  {selectedAsset.topologySpec.udimTile} ({selectedAsset.topologySpec.texelDensityPxPerInch} px/in)
                </div>
              </div>

              {/* Top-Right Turntable & Cage Toggles */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={() => setAutoTurntable((prev) => !prev)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-colors ${
                    autoTurntable
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-[#12161F]/90 border-white/15 text-slate-300'
                  }`}
                >
                  {autoTurntable ? 'Turntable: ON' : 'Turntable: OFF'}
                </button>
                <button
                  onClick={() => setShowDimensionCage((prev) => !prev)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded border transition-colors ${
                    showDimensionCage
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-[#12161F]/90 border-white/15 text-slate-300'
                  }`}
                >
                  BBox Cage
                </button>
              </div>
            </div>

            {/* Bottom Controls inside 3D Turntable Column: Exploded View Slider + Shading Mode */}
            <div className="p-4 bg-[#12161F] border-t border-white/10 space-y-3">
              {/* Exploded View Sub-Part Separation Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    Exploded Sub-Mesh Inspection ({selectedAsset.subParts.length} Hierarchical Parts)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-300 font-semibold tabular-nums">
                      {explodedPct}% Exploded
                    </span>
                    {explodedPct > 0 && (
                      <button
                        onClick={() => setExplodedPct(0)}
                        className="text-[11px] text-slate-400 hover:text-white underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={explodedPct}
                  onChange={(e) => setExplodedPct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Viewport Shading Modes */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {(
                    [
                      { id: 'pbr_shaded', label: 'PBR Shaded' },
                      { id: 'pbr_wireframe', label: 'PBR + Quad Wire' },
                      { id: 'uv_checker', label: 'UV Checker' },
                      { id: 'clay_silhouette', label: 'Clay Massing' }
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setShadingMode(mode.id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        shadingMode === mode.id
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-[#0B0D11] text-slate-300 hover:text-white border border-white/10'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {onFocusAssetInApartment && (
                  <button
                    onClick={() => {
                      onFocusAssetInApartment(selectedAsset);
                      onClose();
                    }}
                    className="px-3 py-1 text-[11px] font-semibold rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Crosshair className="w-3 h-3" />
                    Locate in 3D Apartment
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Film Reference, Sub-Mesh Breakdown & Linked PBR Materials */}
          <div className="lg:col-span-4 bg-[#0B0D11] max-h-[640px] overflow-y-auto p-5 space-y-4 text-xs">
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>{selectedAsset.priorityTier}</span>
                <span>SMPTE {selectedAsset.filmTimestamps.join(' · ')}</span>
              </div>
              <h3 className="text-base font-bold text-white font-display mt-0.5">
                {selectedAsset.name}
              </h3>
              <p className="text-slate-300 mt-1.5 leading-relaxed">
                {selectedAsset.historicalModelNotes}
              </p>
            </div>

            {/* Film Scene & Placement Telemetry */}
            <div className="p-3 rounded-xl bg-[#12161F] border border-white/10 space-y-2">
              <div className="text-[11px] font-mono text-amber-400 font-semibold">
                APARTMENT #2B SPATIAL PLACEMENT &amp; FILM CUE
              </div>
              <p className="text-slate-300 leading-snug">{selectedAsset.filmSceneReference}</p>
              <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400">
                <span>
                  Zone: <strong className="text-slate-200">{selectedAsset.apartmentPlacement.zoneDescription}</strong>
                </span>
                <span>·</span>
                <span>
                  Coords:{' '}
                  <strong className="text-amber-300 tabular-nums">
                    ({selectedAsset.apartmentPlacement.coordinatesFeet.join("', ")}&apos;)
                  </strong>
                </span>
                <span>·</span>
                <span>
                  Yaw: <strong className="text-slate-200">{selectedAsset.apartmentPlacement.rotationDeg}°</strong>
                </span>
              </div>
            </div>

            {/* Sub-Component Mesh Hierarchy */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400 font-semibold">
                  SUB-COMPONENT MESH HIERARCHY ({selectedAsset.subParts.length} PARTS)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Bevel {selectedAsset.topologySpec.bevelWidthMm}mm · Subdiv L{selectedAsset.topologySpec.subdivisionLevel}
                </span>
              </div>

              <div className="space-y-1.5">
                {selectedAsset.subParts.map((part, idx) => {
                  const linkedMat = jeffriesPbrMaterials.find(
                    (m) => m.id === part.linkedMaterialId
                  );
                  return (
                    <div
                      key={part.partName}
                      className="p-2.5 rounded-lg bg-[#12161F] border border-white/10 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-sm border border-white/20 shrink-0"
                            style={{ backgroundColor: part.colorHex }}
                          />
                          {idx + 1}. {part.partName}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 shrink-0">
                          {part.geometryPrimitive}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {part.dimensionsNote}
                      </p>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
                        <span>
                          R: <strong className="text-slate-200">{part.roughness.toFixed(2)}</strong> · M:{' '}
                          <strong className="text-slate-200">{part.metalness.toFixed(2)}</strong>
                        </span>
                        {linkedMat && onOpenPbrMaterialStudio && (
                          <button
                            onClick={() => {
                              onClose();
                              onOpenPbrMaterialStudio(linkedMat.id);
                            }}
                            className="text-amber-300 hover:text-amber-200 underline"
                          >
                            {linkedMat.shortLabel} →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Blender 4.2 Cycles & UV Optimization Callout */}
            <div className="p-3 rounded-xl bg-[#12161F] border border-white/10 space-y-2">
              <div className="text-[11px] font-mono text-emerald-300 font-semibold">
                BLENDER 4.2 CYCLES &amp; UV UNWRAP SPECIFICATION
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-white">UV Method:</strong>{' '}
                {selectedAsset.topologySpec.uvUnwrapMethod}
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong className="text-white">Shader Notes:</strong> {selectedAsset.blenderNotes}
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  onClick={handleCopySingleAssetPython}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedSingleFlag ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied {selectedAsset.blenderCollectionName} Python Builder
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy {selectedAsset.shortLabel} Blender Python Code
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
