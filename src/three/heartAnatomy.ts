import * as THREE from 'three';
import { AnatomyPartId } from '../types/biometrics';
import {
  createContactShadowTexture,
  createMyocardiumTextures,
  createVesselWallTexture,
} from './heartTextures';

export interface ConductionStage {
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  activationStart: number; // 0..1 within cardiac cycle
  activationEnd: number;
}

export interface AnatomicalExplodeItem {
  object: THREE.Object3D;
  restPos: THREE.Vector3;
  explodeOffset: THREE.Vector3;
}

export interface PediatricHeartRig {
  root: THREE.Group;
  heartPivot: THREE.Group;
  rightAtriumGroup: THREE.Group;
  leftAtriumGroup: THREE.Group;
  rightVentricleGroup: THREE.Group;
  leftVentricleGroup: THREE.Group;
  aortaGroup: THREE.Group;
  pulmonaryGroup: THREE.Group;
  venaCavaGroup: THREE.Group;
  coronaryGroup: THREE.Group;
  conductionGroup: THREE.Group;
  wearablePatchGroup: THREE.Group;
  conductionStages: ConductionStage[];
  explodeItems: AnatomicalExplodeItem[];
  hitProxies: THREE.Mesh[];
  myocardiumMaterials: THREE.MeshPhysicalMaterial[];
  vesselMaterials: THREE.MeshPhysicalMaterial[];
  setXrayMode: (xray: boolean) => void;
  setShowCoronaries: (show: boolean) => void;
  setShowWearablePatch: (show: boolean) => void;
  setHighlightedPart: (part: AnatomyPartId | null) => void;
  dispose: () => void;
}

function createTaperedVesselGeometry(
  points: THREE.Vector3[],
  radiusStart: number,
  radiusEnd: number,
  tubularSegments = 48,
  radialSegments = 20,
  flareEnd = false,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(
    curve,
    tubularSegments,
    1,
    radialSegments,
    false,
  );
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  const vert = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, center);
    let r = THREE.MathUtils.lerp(radiusStart, radiusEnd, t);
    // Subtle anatomical root/ostium flare
    if (t < 0.12) {
      r *= 1.0 + 0.14 * Math.cos((t / 0.12) * Math.PI * 0.5);
    }
    if (flareEnd && t > 0.88) {
      r *= 1.0 + 0.18 * Math.sin(((t - 0.88) / 0.12) * Math.PI * 0.5);
    }

    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * (radialSegments + 1) + j;
      vert.fromBufferAttribute(pos, idx);
      vert.sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(idx, vert.x, vert.y, vert.z);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

function createSculptedLeftVentricleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.46, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Normalize vertical param y in [-1, 1]
    const yn = v.y / 0.46;

    // Pediatric rounded conical taper toward cardiac apex (-y)
    const taper =
      yn < 0
        ? 0.62 + 0.38 * Math.pow(1 + yn, 0.55)
        : 1.0 - 0.16 * Math.pow(yn, 1.8);

    v.x *= taper * 0.94;
    v.z *= taper * 1.02;
    v.y *= 1.28;

    // Skew cardiac apex smoothly toward child's left (+x) and anterior (+z)
    const apexFactor = Math.max(0, -yn);
    v.x += apexFactor * apexFactor * 0.28;
    v.z += apexFactor * apexFactor * 0.11;

    // Flatten septal medial face (-x) where RV wraps against LV
    if (v.x < 0) {
      v.x *= 0.68;
    }

    // Subtle helical muscular surface contour
    const theta = Math.atan2(v.z, v.x);
    const undulation = 1.0 + 0.018 * Math.sin(theta * 3 + yn * 4.5);
    v.x *= undulation;
    v.z *= undulation;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createSculptedRightVentricleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.44, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yn = v.y / 0.44;

    // Crescentic anterior-right pediatric RV shape
    const taper =
      yn < 0
        ? 0.52 + 0.48 * Math.pow(1 + yn, 0.52)
        : 0.96 - 0.12 * Math.pow(yn, 1.5);

    v.x *= taper * 1.06;
    v.z *= taper * 0.88;
    v.y *= 1.18;

    // Curve RV smoothly around the anterior face (+z) and narrow into conus arteriosus at top
    const infundibulum = Math.max(0, yn);
    v.z += 0.08 * (1 - Math.abs(yn)) + infundibulum * 0.09;
    v.x += infundibulum * 0.14;

    // Flatten posterior/septal contact side
    if (v.z < 0) {
      v.z *= 0.55;
    }

    // Taper bottom toward LV apex
    const apexSkew = Math.max(0, -yn);
    v.x += apexSkew * 0.24;

    const theta = Math.atan2(v.z, v.x);
    const undulation = 1.0 + 0.015 * Math.sin(theta * 4 - yn * 3.5);
    v.x *= undulation;
    v.z *= undulation;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createSculptedAtriumGeometry(isRight: boolean): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.28, 44, 32);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.y *= 0.92;
    v.x *= isRight ? 1.05 : 1.14;
    v.z *= isRight ? 1.02 : 0.92;

    // Subtle scalloped pectinate muscle ridges
    const angle = Math.atan2(v.z, v.x);
    const ridge = 1.0 + 0.025 * Math.sin(angle * 7 + v.y * 10);
    v.multiplyScalar(ridge);

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createAuricleGeometry(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.06, 0.04, 0.12),
    new THREE.Vector3(0.11, 0.01, 0.23),
    new THREE.Vector3(0.14, -0.04, 0.3),
  ];
  return createTaperedVesselGeometry(pts, 0.11, 0.025, 24, 16);
}

export function buildPediatricHeartRig(
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): PediatricHeartRig {
  const root = new THREE.Group();
  root.name = 'pediatric_heart_root';

  const disposables: { dispose: () => void }[] = [];
  const register = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Procedural biological textures
  const ventTex = register(createMyocardiumTextures(maxAnisotropy, 'ventricle'));
  const atrTex = register(createMyocardiumTextures(maxAnisotropy, 'atrium'));
  const aortaTex = register(
    createVesselWallTexture('#c94a4f', '#e57c7a', maxAnisotropy),
  );
  const pulmTex = register(
    createVesselWallTexture('#5d6f9e', '#869ac7', maxAnisotropy),
  );
  const venaTex = register(
    createVesselWallTexture('#475c8a', '#697fb0', maxAnisotropy),
  );

  // Materials with wet glistening epicardial clearcoat
  const lvMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: ventTex.map,
      bumpMap: ventTex.bumpMap,
      bumpScale: 0.018,
      roughnessMap: ventTex.roughnessMap,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.88,
      clearcoatRoughness: 0.15,
      sheen: 0.35,
      sheenColor: new THREE.Color(0xff9aa2),
      transparent: false,
      opacity: 1,
    }),
  );

  const rvMat = register(lvMat.clone());
  const raMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: atrTex.map,
      bumpMap: atrTex.bumpMap,
      bumpScale: 0.014,
      roughnessMap: atrTex.roughnessMap,
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.82,
      clearcoatRoughness: 0.18,
      transparent: false,
      opacity: 1,
    }),
  );
  const laMat = register(raMat.clone());

  const aortaMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: aortaTex,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.78,
      clearcoatRoughness: 0.18,
      transparent: false,
      opacity: 1,
    }),
  );

  const pulmMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: pulmTex,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.2,
      transparent: false,
      opacity: 1,
    }),
  );

  const venaMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: venaTex,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      transparent: false,
      opacity: 1,
    }),
  );

  const coronaryArteryMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xd93848,
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    }),
  );

  const coronaryVeinMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x3f5b99,
      roughness: 0.32,
      metalness: 0.03,
      clearcoat: 0.82,
      clearcoatRoughness: 0.15,
    }),
  );

  const adiposeMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6c88a,
      roughness: 0.48,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
      transparent: true,
      opacity: 0.9,
    }),
  );

  const valveRingMat = register(
    new THREE.MeshStandardMaterial({
      color: 0xf2d9d0,
      roughness: 0.45,
      metalness: 0.05,
    }),
  );

  const myocardiumMaterials = [lvMat, rvMat, raMat, laMat];
  const vesselMaterials = [aortaMat, pulmMat, venaMat];

  // Grounding clinical specimen pedestal & soft contact shadow
  const shadowMat = register(
    new THREE.MeshBasicMaterial({
      map: register(createContactShadowTexture()),
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  const shadowPlane = new THREE.Mesh(
    register(new THREE.PlaneGeometry(2.6, 2.6)),
    shadowMat,
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.16;
  root.add(shadowPlane);

  const standBaseGeo = register(new THREE.CylinderGeometry(0.68, 0.78, 0.05, 56));
  const standBaseMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x1b222c,
      roughness: 0.26,
      metalness: 0.75,
      clearcoat: 0.4,
    }),
  );
  const standBase = new THREE.Mesh(standBaseGeo, standBaseMat);
  standBase.position.y = -1.14;
  standBase.receiveShadow = true;
  root.add(standBase);

  const standRingGeo = register(new THREE.TorusGeometry(0.66, 0.012, 12, 64));
  const standRingMat = register(
    new THREE.MeshStandardMaterial({
      color: 0x3b4858,
      roughness: 0.25,
      metalness: 0.88,
    }),
  );
  const standRing = new THREE.Mesh(standRingGeo, standRingMat);
  standRing.rotation.x = Math.PI / 2;
  standRing.position.y = -1.112;
  root.add(standRing);

  // Subtle translucent surgical cradle ring under apex area
  const cradleRingGeo = register(new THREE.TorusGeometry(0.42, 0.008, 10, 48));
  const cradleMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x94a3b8,
      roughness: 0.15,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.75,
      transparent: true,
      opacity: isSoftwareGl ? 0.35 : 0.85,
    }),
  );
  const cradleRing = new THREE.Mesh(cradleRingGeo, cradleMat);
  cradleRing.rotation.x = Math.PI / 2;
  cradleRing.position.y = -0.92;
  root.add(cradleRing);

  // Main anatomical heart pivot (centered nicely above pedestal)
  const heartPivot = new THREE.Group();
  heartPivot.position.set(0, 0.06, 0);
  // Slight physiological thoracic tilt
  heartPivot.rotation.set(0.06, -0.08, -0.08);
  root.add(heartPivot);

  const hitProxies: THREE.Mesh[] = [];
  const registerProxy = (
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    partId: AnatomyPartId,
  ) => {
    const proxy = new THREE.Mesh(
      register(geo),
      register(new THREE.MeshBasicMaterial({ visible: false })),
    );
    proxy.position.set(...pos);
    proxy.layers.set(1);
    proxy.userData = { partId };
    parent.add(proxy);
    hitProxies.push(proxy);
  };

  // 1. LEFT VENTRICLE & CARDIAC APEX
  const leftVentricleGroup = new THREE.Group();
  leftVentricleGroup.position.set(0.16, -0.22, -0.02);
  const lvGeo = register(createSculptedLeftVentricleGeometry());
  const lvMesh = new THREE.Mesh(lvGeo, lvMat);
  lvMesh.castShadow = true;
  lvMesh.receiveShadow = true;
  leftVentricleGroup.add(lvMesh);
  registerProxy(
    leftVentricleGroup,
    new THREE.SphereGeometry(0.44, 14, 12),
    [0.08, -0.06, 0.02],
    'left_ventricle',
  );
  heartPivot.add(leftVentricleGroup);

  // 2. RIGHT VENTRICLE & CONUS ARTERIOSUS
  const rightVentricleGroup = new THREE.Group();
  rightVentricleGroup.position.set(-0.14, -0.18, 0.14);
  const rvGeo = register(createSculptedRightVentricleGeometry());
  const rvMesh = new THREE.Mesh(rvGeo, rvMat);
  rvMesh.castShadow = true;
  rvMesh.receiveShadow = true;
  rightVentricleGroup.add(rvMesh);

  // Conus arteriosus / pulmonary infundibulum collar bridging RV to Pulmonary Trunk
  const conusGeo = register(
    createTaperedVesselGeometry(
      [
        new THREE.Vector3(0.04, 0.34, 0.09),
        new THREE.Vector3(0.09, 0.48, 0.13),
        new THREE.Vector3(0.13, 0.56, 0.12),
      ],
      0.19,
      0.145,
      20,
      20,
    ),
  );
  const conusMesh = new THREE.Mesh(conusGeo, rvMat);
  conusMesh.castShadow = true;
  rightVentricleGroup.add(conusMesh);
  registerProxy(
    rightVentricleGroup,
    new THREE.SphereGeometry(0.42, 14, 12),
    [-0.04, 0.04, 0.08],
    'right_ventricle',
  );
  heartPivot.add(rightVentricleGroup);

  // 3. RIGHT ATRIUM & RIGHT AURICULAR APPENDAGE
  const rightAtriumGroup = new THREE.Group();
  rightAtriumGroup.position.set(-0.37, 0.25, -0.04);
  const raGeo = register(createSculptedAtriumGeometry(true));
  const raMesh = new THREE.Mesh(raGeo, raMat);
  raMesh.castShadow = true;
  raMesh.receiveShadow = true;
  rightAtriumGroup.add(raMesh);

  const rightAuricleGeo = register(createAuricleGeometry());
  const rightAuricle = new THREE.Mesh(rightAuricleGeo, raMat);
  rightAuricle.position.set(0.08, 0.1, 0.12);
  rightAuricle.rotation.set(0.25, 0.45, -0.18);
  rightAuricle.castShadow = true;
  rightAtriumGroup.add(rightAuricle);

  // Tricuspid fibrous annulus ring (visible in cutaway/exploded)
  const tricuspidRing = new THREE.Mesh(
    register(new THREE.TorusGeometry(0.13, 0.022, 12, 28)),
    valveRingMat,
  );
  tricuspidRing.rotation.x = Math.PI / 2 - 0.35;
  tricuspidRing.position.set(0.05, -0.2, 0.06);
  rightAtriumGroup.add(tricuspidRing);

  registerProxy(
    rightAtriumGroup,
    new THREE.SphereGeometry(0.32, 12, 10),
    [0, 0, 0.05],
    'right_atrium',
  );
  heartPivot.add(rightAtriumGroup);

  // 4. LEFT ATRIUM, LEFT AURICLE & 4 PULMONARY VEINS
  const leftAtriumGroup = new THREE.Group();
  leftAtriumGroup.position.set(0.22, 0.31, -0.25);
  const laGeo = register(createSculptedAtriumGeometry(false));
  const laMesh = new THREE.Mesh(laGeo, laMat);
  laMesh.castShadow = true;
  laMesh.receiveShadow = true;
  leftAtriumGroup.add(laMesh);

  // Left atrial appendage (auricle) curving forward beside pulmonary trunk
  const leftAuricleGeo = register(createAuricleGeometry());
  const leftAuricle = new THREE.Mesh(leftAuricleGeo, laMat);
  leftAuricle.position.set(0.16, 0.04, 0.12);
  leftAuricle.rotation.set(0.32, -0.68, 0.15);
  leftAuricle.scale.set(0.88, 0.88, 1.08);
  leftAuricle.castShadow = true;
  leftAtriumGroup.add(leftAuricle);

  // 4 Pulmonary Veins entering posterior Left Atrium
  const pvCurves = [
    // Left Superior & Inferior Pulmonary Veins
    [
      new THREE.Vector3(0.18, 0.1, -0.08),
      new THREE.Vector3(0.42, 0.18, -0.16),
      new THREE.Vector3(0.6, 0.24, -0.22),
    ],
    [
      new THREE.Vector3(0.18, -0.05, -0.1),
      new THREE.Vector3(0.4, -0.06, -0.19),
      new THREE.Vector3(0.56, -0.08, -0.25),
    ],
    // Right Superior & Inferior Pulmonary Veins
    [
      new THREE.Vector3(-0.18, 0.08, -0.1),
      new THREE.Vector3(-0.38, 0.14, -0.16),
      new THREE.Vector3(-0.54, 0.18, -0.22),
    ],
    [
      new THREE.Vector3(-0.18, -0.06, -0.12),
      new THREE.Vector3(-0.38, -0.08, -0.19),
      new THREE.Vector3(-0.52, -0.1, -0.24),
    ],
  ];
  pvCurves.forEach((pts) => {
    const pvGeo = register(createTaperedVesselGeometry(pts, 0.055, 0.046, 20, 14, true));
    const pvMesh = new THREE.Mesh(pvGeo, aortaMat);
    pvMesh.castShadow = true;
    leftAtriumGroup.add(pvMesh);
  });

  // Mitral valve annulus ring
  const mitralRing = new THREE.Mesh(
    register(new THREE.TorusGeometry(0.12, 0.022, 12, 28)),
    valveRingMat,
  );
  mitralRing.rotation.x = Math.PI / 2 - 0.35;
  mitralRing.position.set(-0.02, -0.2, 0.1);
  leftAtriumGroup.add(mitralRing);

  registerProxy(
    leftAtriumGroup,
    new THREE.SphereGeometry(0.32, 12, 10),
    [0, 0, -0.02],
    'left_atrium',
  );
  heartPivot.add(leftAtriumGroup);

  // 5. ASCENDING AORTA, AORTIC ARCH, 3 SUPRA-AORTIC BRANCHES & DESCENDING AORTA
  const aortaGroup = new THREE.Group();
  const mainAortaPts = [
    new THREE.Vector3(0.06, 0.24, 0.03),
    new THREE.Vector3(0.03, 0.48, 0.06),
    new THREE.Vector3(0.01, 0.72, 0.03),
    new THREE.Vector3(0.08, 0.88, -0.08),
    new THREE.Vector3(0.22, 0.86, -0.25),
    new THREE.Vector3(0.26, 0.64, -0.38),
    new THREE.Vector3(0.22, 0.2, -0.44),
    new THREE.Vector3(0.18, -0.42, -0.42),
  ];
  const mainAortaGeo = register(
    createTaperedVesselGeometry(mainAortaPts, 0.145, 0.105, 56, 24, false),
  );
  const mainAortaMesh = new THREE.Mesh(mainAortaGeo, aortaMat);
  mainAortaMesh.castShadow = true;
  mainAortaMesh.receiveShadow = true;
  aortaGroup.add(mainAortaMesh);

  // Three Supra-aortic Arch Branches (Brachiocephalic, Left Common Carotid, Left Subclavian)
  const archBranches = [
    // Brachiocephalic trunk
    {
      pts: [
        new THREE.Vector3(0.02, 0.81, 0.0),
        new THREE.Vector3(-0.06, 1.01, -0.02),
        new THREE.Vector3(-0.14, 1.18, -0.05),
      ],
      r0: 0.055,
      r1: 0.042,
    },
    // Left Common Carotid
    {
      pts: [
        new THREE.Vector3(0.09, 0.88, -0.09),
        new THREE.Vector3(0.11, 1.07, -0.11),
        new THREE.Vector3(0.12, 1.24, -0.13),
      ],
      r0: 0.044,
      r1: 0.034,
    },
    // Left Subclavian
    {
      pts: [
        new THREE.Vector3(0.18, 0.87, -0.2),
        new THREE.Vector3(0.27, 1.04, -0.23),
        new THREE.Vector3(0.36, 1.17, -0.27),
      ],
      r0: 0.042,
      r1: 0.032,
    },
  ];
  archBranches.forEach((b) => {
    const bGeo = register(
      createTaperedVesselGeometry(b.pts, b.r0, b.r1, 24, 16, true),
    );
    const bMesh = new THREE.Mesh(bGeo, aortaMat);
    bMesh.castShadow = true;
    aortaGroup.add(bMesh);
  });

  // Aortic valve ring at root
  const aorticValveRing = new THREE.Mesh(
    register(new THREE.TorusGeometry(0.125, 0.018, 12, 28)),
    valveRingMat,
  );
  aorticValveRing.rotation.x = Math.PI / 2;
  aorticValveRing.position.set(0.06, 0.25, 0.03);
  aortaGroup.add(aorticValveRing);

  registerProxy(
    aortaGroup,
    new THREE.SphereGeometry(0.34, 12, 10),
    [0.1, 0.82, -0.12],
    'aorta',
  );
  heartPivot.add(aortaGroup);

  // 6. PULMONARY TRUNK & LEFT/RIGHT PULMONARY ARTERIES
  const pulmonaryGroup = new THREE.Group();
  const pulmTrunkPts = [
    new THREE.Vector3(-0.01, 0.36, 0.25),
    new THREE.Vector3(0.03, 0.54, 0.2),
    new THREE.Vector3(0.06, 0.67, 0.08),
    new THREE.Vector3(0.08, 0.68, -0.05),
  ];
  const pulmTrunkGeo = register(
    createTaperedVesselGeometry(pulmTrunkPts, 0.14, 0.122, 32, 22, false),
  );
  const pulmTrunkMesh = new THREE.Mesh(pulmTrunkGeo, pulmMat);
  pulmTrunkMesh.castShadow = true;
  pulmTrunkMesh.receiveShadow = true;
  pulmonaryGroup.add(pulmTrunkMesh);

  // Left Pulmonary Artery
  const lpaPts = [
    new THREE.Vector3(0.07, 0.67, -0.02),
    new THREE.Vector3(0.28, 0.67, -0.11),
    new THREE.Vector3(0.55, 0.64, -0.2),
  ];
  const lpaMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(lpaPts, 0.095, 0.074, 24, 18, true)),
    pulmMat,
  );
  lpaMesh.castShadow = true;
  pulmonaryGroup.add(lpaMesh);

  // Right Pulmonary Artery (passes behind ascending aorta)
  const rpaPts = [
    new THREE.Vector3(0.06, 0.66, -0.05),
    new THREE.Vector3(-0.2, 0.64, -0.12),
    new THREE.Vector3(-0.52, 0.6, -0.18),
  ];
  const rpaMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(rpaPts, 0.092, 0.072, 24, 18, true)),
    pulmMat,
  );
  rpaMesh.castShadow = true;
  pulmonaryGroup.add(rpaMesh);

  registerProxy(
    pulmonaryGroup,
    new THREE.SphereGeometry(0.28, 12, 10),
    [0.03, 0.58, 0.1],
    'pulmonary_trunk',
  );
  heartPivot.add(pulmonaryGroup);

  // 7. SUPERIOR & INFERIOR VENA CAVA
  const venaCavaGroup = new THREE.Group();
  const svcPts = [
    new THREE.Vector3(-0.34, 0.42, -0.04),
    new THREE.Vector3(-0.32, 0.72, -0.05),
    new THREE.Vector3(-0.3, 1.05, -0.07),
  ];
  const svcMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(svcPts, 0.11, 0.115, 24, 20, true)),
    venaMat,
  );
  svcMesh.castShadow = true;
  venaCavaGroup.add(svcMesh);

  // Left Brachiocephalic Vein tribute
  const lbcVeinPts = [
    new THREE.Vector3(-0.31, 0.92, -0.06),
    new THREE.Vector3(-0.12, 1.02, -0.03),
    new THREE.Vector3(0.12, 1.08, -0.02),
  ];
  const lbcVeinMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(lbcVeinPts, 0.068, 0.056, 20, 14, true)),
    venaMat,
  );
  lbcVeinMesh.castShadow = true;
  venaCavaGroup.add(lbcVeinMesh);

  // Inferior Vena Cava
  const ivcPts = [
    new THREE.Vector3(-0.35, 0.06, -0.12),
    new THREE.Vector3(-0.34, -0.25, -0.16),
    new THREE.Vector3(-0.33, -0.52, -0.19),
  ];
  const ivcMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(ivcPts, 0.125, 0.13, 20, 18, true)),
    venaMat,
  );
  ivcMesh.castShadow = true;
  venaCavaGroup.add(ivcMesh);

  registerProxy(
    venaCavaGroup,
    new THREE.CylinderGeometry(0.16, 0.16, 0.75, 10),
    [-0.32, 0.76, -0.05],
    'vena_cava',
  );
  heartPivot.add(venaCavaGroup);

  // 8. CORONARY ARTERIES, CARDIAC VEINS & EPICARDIAL ADIPOSE SULCI
  const coronaryGroup = new THREE.Group();

  // Anterior Interventricular Sulcus Epicardial Adipose Cushion
  const sulcusFatPts = [
    new THREE.Vector3(0.05, 0.18, 0.34),
    new THREE.Vector3(0.12, -0.08, 0.36),
    new THREE.Vector3(0.22, -0.38, 0.29),
    new THREE.Vector3(0.32, -0.62, 0.16),
  ];
  const sulcusFatMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(sulcusFatPts, 0.042, 0.022, 28, 12)),
    adiposeMat,
  );
  coronaryGroup.add(sulcusFatMesh);

  // Right AV Sulcus Adipose Cushion
  const rightSulcusFatPts = [
    new THREE.Vector3(-0.08, 0.22, 0.31),
    new THREE.Vector3(-0.28, 0.12, 0.26),
    new THREE.Vector3(-0.42, -0.02, 0.06),
    new THREE.Vector3(-0.32, -0.08, -0.18),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(rightSulcusFatPts, 0.036, 0.024, 24, 12)),
      adiposeMat,
    ),
  );

  // Left Anterior Descending (LAD) Coronary Artery + Diagonal Branches
  const ladPts = [
    new THREE.Vector3(0.1, 0.24, 0.2),
    new THREE.Vector3(0.06, 0.14, 0.36),
    new THREE.Vector3(0.13, -0.08, 0.39),
    new THREE.Vector3(0.23, -0.36, 0.32),
    new THREE.Vector3(0.34, -0.62, 0.18),
    new THREE.Vector3(0.4, -0.74, 0.09),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(ladPts, 0.021, 0.008, 36, 12)),
      coronaryArteryMat,
    ),
  );

  const diag1Pts = [
    new THREE.Vector3(0.11, -0.03, 0.385),
    new THREE.Vector3(0.28, -0.14, 0.35),
    new THREE.Vector3(0.44, -0.28, 0.22),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(diag1Pts, 0.013, 0.005, 20, 10)),
      coronaryArteryMat,
    ),
  );

  const diag2Pts = [
    new THREE.Vector3(0.2, -0.26, 0.35),
    new THREE.Vector3(0.37, -0.39, 0.26),
    new THREE.Vector3(0.48, -0.52, 0.12),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(diag2Pts, 0.011, 0.004, 18, 10)),
      coronaryArteryMat,
    ),
  );

  // Left Circumflex (LCx) Artery
  const lcxPts = [
    new THREE.Vector3(0.08, 0.21, 0.26),
    new THREE.Vector3(0.3, 0.17, 0.25),
    new THREE.Vector3(0.48, 0.08, 0.06),
    new THREE.Vector3(0.42, 0.02, -0.22),
    new THREE.Vector3(0.22, -0.05, -0.34),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(lcxPts, 0.018, 0.007, 32, 10)),
      coronaryArteryMat,
    ),
  );

  // Right Coronary Artery (RCA) + Acute Marginal Branch
  const rcaPts = [
    new THREE.Vector3(-0.02, 0.24, 0.22),
    new THREE.Vector3(-0.22, 0.15, 0.31),
    new THREE.Vector3(-0.4, 0.04, 0.18),
    new THREE.Vector3(-0.44, -0.05, -0.06),
    new THREE.Vector3(-0.26, -0.1, -0.28),
    new THREE.Vector3(-0.02, -0.22, -0.31),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(rcaPts, 0.02, 0.009, 36, 12)),
      coronaryArteryMat,
    ),
  );

  const marginalPts = [
    new THREE.Vector3(-0.34, 0.05, 0.24),
    new THREE.Vector3(-0.26, -0.18, 0.35),
    new THREE.Vector3(-0.08, -0.4, 0.34),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(marginalPts, 0.012, 0.005, 20, 10)),
      coronaryArteryMat,
    ),
  );

  // Great Cardiac Vein & Coronary Sinus (Venous companion)
  const gcvPts = [
    new THREE.Vector3(0.28, -0.5, 0.24),
    new THREE.Vector3(0.18, -0.22, 0.36),
    new THREE.Vector3(0.11, 0.08, 0.36),
    new THREE.Vector3(0.32, 0.13, 0.22),
    new THREE.Vector3(0.45, 0.05, -0.06),
    new THREE.Vector3(0.18, -0.02, -0.31),
    new THREE.Vector3(-0.14, 0.04, -0.26),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(gcvPts, 0.007, 0.026, 38, 12)),
      coronaryVeinMat,
    ),
  );

  registerProxy(
    coronaryGroup,
    new THREE.SphereGeometry(0.16, 10, 10),
    [0.16, -0.15, 0.38],
    'coronary_vessels',
  );
  heartPivot.add(coronaryGroup);

  // 9. CARDIAC CONDUCTION SYSTEM (SA Node -> AV Node -> Bundle of His -> Purkinje)
  const conductionGroup = new THREE.Group();
  const conductionStages: ConductionStage[] = [];

  const makeConductionMat = () =>
    register(
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.4,
        roughness: 0.25,
        metalness: 0.1,
      }),
    );

  // Stage 1: Sinoatrial (SA) Node + Internodal Pathways (P-wave start)
  const saMat = makeConductionMat();
  const saNode = new THREE.Mesh(
    register(new THREE.SphereGeometry(0.052, 16, 16)),
    saMat,
  );
  saNode.position.set(-0.31, 0.41, -0.01);
  conductionGroup.add(saNode);
  conductionStages.push({
    mesh: saNode,
    material: saMat,
    activationStart: 0.0,
    activationEnd: 0.18,
  });

  const internodalMat = makeConductionMat();
  const internodalPts = [
    new THREE.Vector3(-0.31, 0.4, -0.01),
    new THREE.Vector3(-0.22, 0.26, 0.04),
    new THREE.Vector3(-0.1, 0.14, -0.02),
  ];
  const internodalMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(internodalPts, 0.014, 0.014, 18, 8)),
    internodalMat,
  );
  conductionGroup.add(internodalMesh);
  conductionStages.push({
    mesh: internodalMesh,
    material: internodalMat,
    activationStart: 0.05,
    activationEnd: 0.24,
  });

  // Bachmann's bundle to Left Atrium
  const bachmannPts = [
    new THREE.Vector3(-0.28, 0.39, -0.03),
    new THREE.Vector3(-0.04, 0.36, -0.14),
    new THREE.Vector3(0.2, 0.32, -0.2),
  ];
  const bachmannMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(bachmannPts, 0.013, 0.011, 18, 8)),
    internodalMat,
  );
  conductionGroup.add(bachmannMesh);

  // Stage 2: Atrioventricular (AV) Node (PR delay)
  const avMat = makeConductionMat();
  const avNode = new THREE.Mesh(
    register(new THREE.SphereGeometry(0.046, 16, 16)),
    avMat,
  );
  avNode.position.set(-0.09, 0.12, -0.02);
  conductionGroup.add(avNode);
  conductionStages.push({
    mesh: avNode,
    material: avMat,
    activationStart: 0.14,
    activationEnd: 0.32,
  });

  // Stage 3: Bundle of His + Left & Right Bundle Branches (QRS)
  const hisMat = makeConductionMat();
  const hisPts = [
    new THREE.Vector3(-0.08, 0.11, -0.01),
    new THREE.Vector3(0.0, 0.02, 0.04),
    new THREE.Vector3(0.06, -0.16, 0.08),
    new THREE.Vector3(0.18, -0.44, 0.1),
    new THREE.Vector3(0.32, -0.62, 0.11),
  ];
  const hisMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(hisPts, 0.017, 0.012, 26, 8)),
    hisMat,
  );
  conductionGroup.add(hisMesh);
  conductionStages.push({
    mesh: hisMesh,
    material: hisMat,
    activationStart: 0.24,
    activationEnd: 0.44,
  });

  // Stage 4: Purkinje Arborization up Left & Right Ventricular walls
  const purkMat = makeConductionMat();
  const purkBranches = [
    [
      new THREE.Vector3(0.32, -0.62, 0.11),
      new THREE.Vector3(0.43, -0.42, 0.12),
      new THREE.Vector3(0.46, -0.15, 0.06),
    ],
    [
      new THREE.Vector3(0.18, -0.44, 0.1),
      new THREE.Vector3(-0.05, -0.45, 0.22),
      new THREE.Vector3(-0.24, -0.22, 0.24),
    ],
  ];
  purkBranches.forEach((pts) => {
    const pMesh = new THREE.Mesh(
      register(createTaperedVesselGeometry(pts, 0.013, 0.008, 20, 8)),
      purkMat,
    );
    conductionGroup.add(pMesh);
    conductionStages.push({
      mesh: pMesh,
      material: purkMat,
      activationStart: 0.3,
      activationEnd: 0.56,
    });
  });

  registerProxy(
    conductionGroup,
    new THREE.SphereGeometry(0.12, 10, 10),
    [-0.1, 0.12, -0.01],
    'conduction_system',
  );
  heartPivot.add(conductionGroup);

  // 10. OPTIONAL MINIATURE WEARABLE BIOSENSOR PATCH (Toggleable on anterior-left thorax/epicardium)
  const wearablePatchGroup = new THREE.Group();
  wearablePatchGroup.position.set(0.36, -0.26, 0.33);
  wearablePatchGroup.rotation.set(0.18, 0.52, -0.12);

  const patchPadGeo = register(new THREE.CylinderGeometry(0.11, 0.12, 0.018, 28));
  const patchPadMat = register(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.58,
      metalness: 0.05,
    }),
  );
  const patchPad = new THREE.Mesh(patchPadGeo, patchPadMat);
  patchPad.rotation.x = Math.PI / 2;
  wearablePatchGroup.add(patchPad);

  const podCapGeo = register(new THREE.CylinderGeometry(0.068, 0.074, 0.032, 28));
  const podCapMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.22,
      metalness: 0.85,
      clearcoat: 0.5,
    }),
  );
  const podCap = new THREE.Mesh(podCapGeo, podCapMat);
  podCap.rotation.x = Math.PI / 2;
  podCap.position.z = 0.018;
  wearablePatchGroup.add(podCap);

  const patchLedGeo = register(new THREE.TorusGeometry(0.042, 0.007, 10, 28));
  const patchLedMat = register(
    new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x2dd4bf,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    }),
  );
  const patchLed = new THREE.Mesh(patchLedGeo, patchLedMat);
  patchLed.position.z = 0.035;
  wearablePatchGroup.add(patchLed);
  wearablePatchGroup.visible = false;
  heartPivot.add(wearablePatchGroup);

  // Exploded Anatomy Layers
  const explodeItems: AnatomicalExplodeItem[] = [
    {
      object: leftVentricleGroup,
      restPos: leftVentricleGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.32, -0.18, 0.05),
    },
    {
      object: rightVentricleGroup,
      restPos: rightVentricleGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.28, -0.16, 0.26),
    },
    {
      object: rightAtriumGroup,
      restPos: rightAtriumGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.38, 0.16, 0.05),
    },
    {
      object: leftAtriumGroup,
      restPos: leftAtriumGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.32, 0.18, -0.28),
    },
    {
      object: aortaGroup,
      restPos: aortaGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.08, 0.36, -0.06),
    },
    {
      object: pulmonaryGroup,
      restPos: pulmonaryGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.08, 0.28, 0.24),
    },
    {
      object: venaCavaGroup,
      restPos: venaCavaGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.34, 0.22, -0.18),
    },
    {
      object: coronaryGroup,
      restPos: coronaryGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.0, 0.0, 0.38),
    },
  ];

  const setXrayMode = (xray: boolean) => {
    myocardiumMaterials.forEach((m) => {
      m.transparent = xray;
      m.opacity = xray ? 0.24 : 1.0;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    });
    vesselMaterials.forEach((m) => {
      m.transparent = xray;
      m.opacity = xray ? 0.34 : 1.0;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    });
    adiposeMat.opacity = xray ? 0.18 : 0.9;
    conductionGroup.visible = true;
  };

  const setShowCoronaries = (show: boolean) => {
    coronaryGroup.visible = show;
  };

  const setShowWearablePatch = (show: boolean) => {
    wearablePatchGroup.visible = show;
  };

  const partGroupMap: Record<AnatomyPartId, THREE.Object3D> = {
    left_ventricle: leftVentricleGroup,
    right_ventricle: rightVentricleGroup,
    right_atrium: rightAtriumGroup,
    left_atrium: leftAtriumGroup,
    aorta: aortaGroup,
    pulmonary_trunk: pulmonaryGroup,
    vena_cava: venaCavaGroup,
    coronary_vessels: coronaryGroup,
    conduction_system: conductionGroup,
  };

  const setHighlightedPart = (part: AnatomyPartId | null) => {
    (Object.keys(partGroupMap) as AnatomyPartId[]).forEach((key) => {
      const grp = partGroupMap[key];
      const active = part === key;
      grp.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive && key !== 'conduction_system') {
            mat.emissive.setHex(active ? 0x2dd4bf : 0x000000);
            mat.emissiveIntensity = active ? 0.28 : 0.0;
          }
        }
      });
    });
  };

  return {
    root,
    heartPivot,
    rightAtriumGroup,
    leftAtriumGroup,
    rightVentricleGroup,
    leftVentricleGroup,
    aortaGroup,
    pulmonaryGroup,
    venaCavaGroup,
    coronaryGroup,
    conductionGroup,
    wearablePatchGroup,
    conductionStages,
    explodeItems,
    hitProxies,
    myocardiumMaterials,
    vesselMaterials,
    setXrayMode,
    setShowCoronaries,
    setShowWearablePatch,
    setHighlightedPart,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
