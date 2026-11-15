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
  activationStart: number;
  activationEnd: number;
}

export interface AnatomicalExplodeItem {
  object: THREE.Object3D;
  restPos: THREE.Vector3;
  explodeOffset: THREE.Vector3;
}

export interface ValveLeafletPivot {
  pivot: THREE.Group;
  closedAngle: number;
  openAngle: number;
}

export interface PediatricHeartRig {
  root: THREE.Group;
  heartPivot: THREE.Group;
  rightAtriumGroup: THREE.Group;
  leftAtriumGroup: THREE.Group;
  rightVentricleGroup: THREE.Group;
  leftVentricleGroup: THREE.Group;
  septumGroup: THREE.Group;
  aortaGroup: THREE.Group;
  pulmonaryGroup: THREE.Group;
  venaCavaGroup: THREE.Group;
  coronaryGroup: THREE.Group;
  conductionGroup: THREE.Group;
  valvesGroup: THREE.Group;
  wearablePatchGroup: THREE.Group;
  conductionStages: ConductionStage[];
  explodeItems: AnatomicalExplodeItem[];
  avValveLeaflets: ValveLeafletPivot[];
  semilunarValveLeaflets: ValveLeafletPivot[];
  oxygenatedBloodMesh: THREE.InstancedMesh;
  deoxygenatedBloodMesh: THREE.InstancedMesh;
  oxygenatedCurve: THREE.CatmullRomCurve3;
  deoxygenatedCurve: THREE.CatmullRomCurve3;
  hitProxies: THREE.Mesh[];
  setXrayMode: (xray: boolean) => void;
  setShowCoronaries: (show: boolean) => void;
  setShowWearablePatch: (show: boolean) => void;
  setShowBloodFlow: (show: boolean) => void;
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
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function createSculptedLeftVentricleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.46, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yn = THREE.MathUtils.clamp(v.y / 0.46, -1, 1);

    const taper =
      yn < 0
        ? 0.62 + 0.38 * Math.pow(Math.max(0, 1 + yn), 0.55)
        : 1.0 - 0.16 * Math.pow(Math.max(0, yn), 1.8);

    v.x *= taper * 0.95;
    v.z *= taper * 1.03;
    v.y *= 1.28;

    const apexFactor = Math.max(0, -yn);
    v.x += apexFactor * apexFactor * 0.28;
    v.z += apexFactor * apexFactor * 0.11;

    if (v.x < 0) {
      v.x *= 0.66;
    }

    const theta = Math.atan2(v.z, v.x);
    const undulation = 1.0 + 0.022 * Math.sin(theta * 3 + yn * 4.5);
    v.x *= undulation;
    v.z *= undulation;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

function createSculptedRightVentricleGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.44, 64, 48);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const yn = THREE.MathUtils.clamp(v.y / 0.44, -1, 1);

    const taper =
      yn < 0
        ? 0.52 + 0.48 * Math.pow(Math.max(0, 1 + yn), 0.52)
        : 0.96 - 0.12 * Math.pow(Math.max(0, yn), 1.5);

    v.x *= taper * 1.06;
    v.z *= taper * 0.88;
    v.y *= 1.18;

    const infundibulum = Math.max(0, yn);
    v.z += 0.08 * (1 - Math.abs(yn)) + infundibulum * 0.09;
    v.x += infundibulum * 0.14;

    if (v.z < 0) {
      v.z *= 0.55;
    }

    const apexSkew = Math.max(0, -yn);
    v.x += apexSkew * 0.24;

    const theta = Math.atan2(v.z, v.x);
    const undulation = 1.0 + 0.018 * Math.sin(theta * 4 - yn * 3.5);
    v.x *= undulation;
    v.z *= undulation;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
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

    const angle = Math.atan2(v.z, v.x);
    const ridge = 1.0 + 0.03 * Math.sin(angle * 7 + v.y * 10);
    v.multiplyScalar(ridge);

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
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

function createValveLeafletGeometry(
  radius: number,
  arcAngle: number,
): THREE.BufferGeometry {
  // Triangular/cusp-shaped leaflet hinged at rim (origin -> inward)
  const shape = new THREE.Shape();
  const halfSpan = Math.sin(arcAngle * 0.5) * radius * 0.92;
  shape.moveTo(-halfSpan, 0);
  shape.quadraticCurveTo(0, -radius * 0.12, halfSpan, 0);
  shape.quadraticCurveTo(halfSpan * 0.5, radius * 0.85, 0, radius * 0.96);
  shape.quadraticCurveTo(-halfSpan * 0.5, radius * 0.85, -halfSpan, 0);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 12,
  });
  // Lay leaflet flat along +Z inward from hinge at Z=0
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
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

  const ventTex = register(createMyocardiumTextures(maxAnisotropy, 'ventricle'));
  const atrTex = register(createMyocardiumTextures(maxAnisotropy, 'atrium'));
  const aortaTex = register(
    createVesselWallTexture('#cf4c52', '#ec8380', maxAnisotropy),
  );
  const pulmTex = register(
    createVesselWallTexture('#5a6fa3', '#889dca', maxAnisotropy),
  );
  const venaTex = register(
    createVesselWallTexture('#43598c', '#6a82b5', maxAnisotropy),
  );

  const lvMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffecee,
      map: ventTex.map,
      bumpMap: ventTex.bumpMap,
      bumpScale: 0.02,
      roughnessMap: ventTex.roughnessMap,
      roughness: 0.34,
      metalness: 0.02,
      clearcoat: 0.92,
      clearcoatRoughness: 0.14,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xff9aa2),
    }),
  );

  // Right ventricle slightly deeper venous-crimson tone for clear visual distinction
  const rvMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6c8d2,
      map: ventTex.map,
      bumpMap: ventTex.bumpMap,
      bumpScale: 0.02,
      roughnessMap: ventTex.roughnessMap,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.88,
      clearcoatRoughness: 0.16,
      sheen: 0.32,
      sheenColor: new THREE.Color(0xd48ca8),
    }),
  );

  const raMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xe2c6d4,
      map: atrTex.map,
      bumpMap: atrTex.bumpMap,
      bumpScale: 0.015,
      roughnessMap: atrTex.roughnessMap,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.84,
      clearcoatRoughness: 0.18,
    }),
  );

  const laMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffdde2,
      map: atrTex.map,
      bumpMap: atrTex.bumpMap,
      bumpScale: 0.015,
      roughnessMap: atrTex.roughnessMap,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.86,
      clearcoatRoughness: 0.16,
    }),
  );

  const septumMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xa63a45,
      map: ventTex.map,
      bumpMap: ventTex.bumpMap,
      bumpScale: 0.022,
      roughness: 0.42,
      metalness: 0.02,
      clearcoat: 0.65,
    }),
  );

  const aortaMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: aortaTex,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.8,
      clearcoatRoughness: 0.16,
    }),
  );

  const pulmMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: pulmTex,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.74,
      clearcoatRoughness: 0.18,
    }),
  );

  const venaMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: venaTex,
      roughness: 0.4,
      metalness: 0.02,
      clearcoat: 0.68,
      clearcoatRoughness: 0.2,
    }),
  );

  const coronaryArteryMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xe63946,
      roughness: 0.25,
      metalness: 0.04,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
    }),
  );

  const coronaryVeinMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x3b5998,
      roughness: 0.3,
      metalness: 0.03,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    }),
  );

  const adiposeMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xead096,
      roughness: 0.48,
      metalness: 0.0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.25,
      transparent: true,
      opacity: 0.9,
    }),
  );

  const valveAnnulusMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xf6e6de,
      roughness: 0.38,
      metalness: 0.04,
      clearcoat: 0.65,
    }),
  );

  const leafletMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xfff3ed,
      roughness: 0.28,
      metalness: 0.02,
      clearcoat: 0.85,
      side: THREE.DoubleSide,
    }),
  );

  const chordaeMat = register(
    new THREE.MeshStandardMaterial({
      color: 0xf4e8e1,
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
      opacity: 0.66,
      depthWrite: false,
    }),
  );
  const shadowPlane = new THREE.Mesh(
    register(new THREE.PlaneGeometry(2.8, 2.8)),
    shadowMat,
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.16;
  root.add(shadowPlane);

  // Sculpted Lathe specimen stand
  const standProfile = [
    new THREE.Vector2(0.0, 0.06),
    new THREE.Vector2(0.6, 0.06),
    new THREE.Vector2(0.68, 0.042),
    new THREE.Vector2(0.76, 0.0),
    new THREE.Vector2(0.0, 0.0),
  ];
  const standBase = new THREE.Mesh(
    register(new THREE.LatheGeometry(standProfile, 64)),
    register(
      new THREE.MeshPhysicalMaterial({
        color: 0x161c24,
        roughness: 0.25,
        metalness: 0.78,
        clearcoat: 0.5,
      }),
    ),
  );
  standBase.position.y = -1.16;
  standBase.receiveShadow = true;
  root.add(standBase);

  const standRing = new THREE.Mesh(
    register(new THREE.TorusGeometry(0.62, 0.011, 12, 64)),
    register(
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.35,
        roughness: 0.28,
        metalness: 0.8,
      }),
    ),
  );
  standRing.rotation.x = Math.PI / 2;
  standRing.position.y = -1.1;
  root.add(standRing);

  const cradleRing = new THREE.Mesh(
    register(new THREE.TorusGeometry(0.42, 0.008, 10, 48)),
    register(
      new THREE.MeshPhysicalMaterial({
        color: 0x94a3b8,
        roughness: 0.15,
        metalness: 0.1,
        transmission: isSoftwareGl ? 0 : 0.72,
        transparent: true,
        opacity: isSoftwareGl ? 0.32 : 0.82,
      }),
    ),
  );
  cradleRing.rotation.x = Math.PI / 2;
  cradleRing.position.y = -0.92;
  root.add(cradleRing);

  // Main anatomical heart pivot
  const heartPivot = new THREE.Group();
  heartPivot.position.set(0, 0.06, 0);
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

  // 1. LEFT VENTRICLE & CARDIAC APEX + PAPILLARY MUSCLES
  const leftVentricleGroup = new THREE.Group();
  leftVentricleGroup.position.set(0.16, -0.22, -0.02);
  const lvMesh = new THREE.Mesh(register(createSculptedLeftVentricleGeometry()), lvMat);
  lvMesh.castShadow = true;
  lvMesh.receiveShadow = true;
  leftVentricleGroup.add(lvMesh);
  registerProxy(
    leftVentricleGroup,
    new THREE.SphereGeometry(0.42, 14, 12),
    [0.08, -0.06, 0.02],
    'left_ventricle',
  );
  heartPivot.add(leftVentricleGroup);

  // 2. RIGHT VENTRICLE & CONUS ARTERIOSUS
  const rightVentricleGroup = new THREE.Group();
  rightVentricleGroup.position.set(-0.14, -0.18, 0.14);
  const rvMesh = new THREE.Mesh(register(createSculptedRightVentricleGeometry()), rvMat);
  rvMesh.castShadow = true;
  rvMesh.receiveShadow = true;
  rightVentricleGroup.add(rvMesh);

  const conusMesh = new THREE.Mesh(
    register(
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
    ),
    rvMat,
  );
  conusMesh.castShadow = true;
  rightVentricleGroup.add(conusMesh);
  registerProxy(
    rightVentricleGroup,
    new THREE.SphereGeometry(0.4, 14, 12),
    [-0.04, 0.04, 0.08],
    'right_ventricle',
  );
  heartPivot.add(rightVentricleGroup);

  // 2B. INTERVENTRICULAR SEPTUM & PAPILLARY MUSCLES (Visible when exploded / X-ray)
  const septumGroup = new THREE.Group();
  const septumGeo = register(new THREE.CylinderGeometry(0.12, 0.06, 0.68, 24));
  septumGeo.scale(0.42, 1.0, 1.85);
  const septumMesh = new THREE.Mesh(septumGeo, septumMat);
  septumMesh.position.set(0.04, -0.22, 0.04);
  septumMesh.rotation.z = 0.24;
  septumGroup.add(septumMesh);

  // Papillary muscles inside ventricular cavities
  const papGeo = register(new THREE.ConeGeometry(0.042, 0.16, 12));
  const papPositions: [number, number, number, number][] = [
    [0.24, -0.34, 0.06, -0.25],
    [0.14, -0.38, -0.05, 0.2],
    [-0.18, -0.32, 0.16, 0.3],
    [-0.1, -0.35, 0.08, -0.18],
  ];
  papPositions.forEach(([px, py, pz, rz]) => {
    const pm = new THREE.Mesh(papGeo, septumMat);
    pm.position.set(px, py, pz);
    pm.rotation.z = rz;
    septumGroup.add(pm);
  });
  heartPivot.add(septumGroup);

  // 3. RIGHT ATRIUM & RIGHT AURICLE
  const rightAtriumGroup = new THREE.Group();
  rightAtriumGroup.position.set(-0.37, 0.25, -0.04);
  const raMesh = new THREE.Mesh(register(createSculptedAtriumGeometry(true)), raMat);
  raMesh.castShadow = true;
  raMesh.receiveShadow = true;
  rightAtriumGroup.add(raMesh);

  const rightAuricle = new THREE.Mesh(register(createAuricleGeometry()), raMat);
  rightAuricle.position.set(0.08, 0.1, 0.12);
  rightAuricle.rotation.set(0.25, 0.45, -0.18);
  rightAuricle.castShadow = true;
  rightAtriumGroup.add(rightAuricle);

  registerProxy(
    rightAtriumGroup,
    new THREE.SphereGeometry(0.3, 12, 10),
    [0, 0, 0.05],
    'right_atrium',
  );
  heartPivot.add(rightAtriumGroup);

  // 4. LEFT ATRIUM, LEFT AURICLE & 4 PULMONARY VEINS
  const leftAtriumGroup = new THREE.Group();
  leftAtriumGroup.position.set(0.22, 0.31, -0.25);
  const laMesh = new THREE.Mesh(register(createSculptedAtriumGeometry(false)), laMat);
  laMesh.castShadow = true;
  laMesh.receiveShadow = true;
  leftAtriumGroup.add(laMesh);

  const leftAuricle = new THREE.Mesh(register(createAuricleGeometry()), laMat);
  leftAuricle.position.set(0.16, 0.04, 0.12);
  leftAuricle.rotation.set(0.32, -0.68, 0.15);
  leftAuricle.scale.set(0.88, 0.88, 1.08);
  leftAuricle.castShadow = true;
  leftAtriumGroup.add(leftAuricle);

  const pvCurves = [
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
    const pvMesh = new THREE.Mesh(
      register(createTaperedVesselGeometry(pts, 0.055, 0.046, 20, 14, true)),
      aortaMat,
    );
    pvMesh.castShadow = true;
    leftAtriumGroup.add(pvMesh);
  });

  registerProxy(
    leftAtriumGroup,
    new THREE.SphereGeometry(0.3, 12, 10),
    [0, 0, -0.02],
    'left_atrium',
  );
  heartPivot.add(leftAtriumGroup);

  // 5. ASCENDING AORTA, AORTIC ARCH & 3 SUPRA-AORTIC BRANCHES
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
  const mainAortaMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(mainAortaPts, 0.145, 0.105, 56, 24, false)),
    aortaMat,
  );
  mainAortaMesh.castShadow = true;
  mainAortaMesh.receiveShadow = true;
  aortaGroup.add(mainAortaMesh);

  const archBranches = [
    {
      pts: [
        new THREE.Vector3(0.02, 0.81, 0.0),
        new THREE.Vector3(-0.06, 1.01, -0.02),
        new THREE.Vector3(-0.14, 1.18, -0.05),
      ],
      r0: 0.055,
      r1: 0.042,
    },
    {
      pts: [
        new THREE.Vector3(0.09, 0.88, -0.09),
        new THREE.Vector3(0.11, 1.07, -0.11),
        new THREE.Vector3(0.12, 1.24, -0.13),
      ],
      r0: 0.044,
      r1: 0.034,
    },
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
    const bMesh = new THREE.Mesh(
      register(createTaperedVesselGeometry(b.pts, b.r0, b.r1, 24, 16, true)),
      aortaMat,
    );
    bMesh.castShadow = true;
    aortaGroup.add(bMesh);
  });

  registerProxy(
    aortaGroup,
    new THREE.SphereGeometry(0.34, 12, 10),
    [0.1, 0.82, -0.12],
    'aorta',
  );
  heartPivot.add(aortaGroup);

  // 6. PULMONARY TRUNK & BIFURCATION
  const pulmonaryGroup = new THREE.Group();
  const pulmTrunkPts = [
    new THREE.Vector3(-0.01, 0.36, 0.25),
    new THREE.Vector3(0.03, 0.54, 0.2),
    new THREE.Vector3(0.06, 0.67, 0.08),
    new THREE.Vector3(0.08, 0.68, -0.05),
  ];
  const pulmTrunkMesh = new THREE.Mesh(
    register(createTaperedVesselGeometry(pulmTrunkPts, 0.14, 0.122, 32, 22, false)),
    pulmMat,
  );
  pulmTrunkMesh.castShadow = true;
  pulmTrunkMesh.receiveShadow = true;
  pulmonaryGroup.add(pulmTrunkMesh);

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
  heartPivot.add(venaCavaGroup);

  // 8. ARTICULATED 4-VALVE SYSTEM WITH MOVING LEAFLETS & CHORDAE TENDINEAE
  const valvesGroup = new THREE.Group();
  const avValveLeaflets: ValveLeafletPivot[] = [];
  const semilunarValveLeaflets: ValveLeafletPivot[] = [];

  const buildArticulatedValve = (
    pos: [number, number, number],
    rot: [number, number, number],
    radius: number,
    numLeaflets: number,
    isAvValve: boolean,
    withChordae = false,
  ) => {
    const vGrp = new THREE.Group();
    vGrp.position.set(...pos);
    vGrp.rotation.set(...rot);

    const ring = new THREE.Mesh(
      register(new THREE.TorusGeometry(radius, 0.018, 12, 32)),
      valveAnnulusMat,
    );
    ring.rotation.x = Math.PI / 2;
    vGrp.add(ring);

    const arcAngle = (Math.PI * 2) / numLeaflets;
    const leafGeo = register(createValveLeafletGeometry(radius, arcAngle));

    for (let i = 0; i < numLeaflets; i++) {
      const a = i * arcAngle;
      const radialHolder = new THREE.Group();
      radialHolder.rotation.y = a;

      const hingePivot = new THREE.Group();
      hingePivot.position.set(0, 0, radius * 0.92);
      // Leaflets point inward toward center along -Z
      const leafMesh = new THREE.Mesh(leafGeo, leafletMat);
      leafMesh.rotation.y = Math.PI;
      hingePivot.add(leafMesh);

      if (withChordae) {
        const chordGeo = register(
          new THREE.CylinderGeometry(0.004, 0.004, 0.18, 6),
        );
        const c1 = new THREE.Mesh(chordGeo, chordaeMat);
        c1.position.set(-0.025, -0.09, -radius * 0.65);
        c1.rotation.x = 0.25;
        hingePivot.add(c1);

        const c2 = new THREE.Mesh(chordGeo, chordaeMat);
        c2.position.set(0.025, -0.09, -radius * 0.65);
        c2.rotation.x = 0.25;
        hingePivot.add(c2);
      }

      radialHolder.add(hingePivot);
      vGrp.add(radialHolder);

      if (isAvValve) {
        // AV valves open DOWNWARD into ventricles (+X rotation swings -Z tip downward)
        avValveLeaflets.push({
          pivot: hingePivot,
          closedAngle: 0.08,
          openAngle: 1.08,
        });
      } else {
        // Semilunar valves open UPWARD into great arteries (-X rotation swings -Z tip upward)
        semilunarValveLeaflets.push({
          pivot: hingePivot,
          closedAngle: -0.08,
          openAngle: -1.15,
        });
      }
    }

    valvesGroup.add(vGrp);
  };

  // Mitral (bicuspid) between LA & LV
  buildArticulatedValve([0.19, 0.12, -0.07], [0.22, 0.15, -0.15], 0.135, 2, true, true);
  // Tricuspid (3 leaflets) between RA & RV
  buildArticulatedValve([-0.24, 0.08, 0.06], [0.25, -0.1, 0.18], 0.145, 3, true, true);
  // Aortic valve (3 semilunar cusps) at Aortic root
  buildArticulatedValve([0.055, 0.27, 0.035], [0.05, 0, -0.08], 0.115, 3, false, false);
  // Pulmonary valve (3 semilunar cusps) at Pulmonary trunk root
  buildArticulatedValve([-0.01, 0.37, 0.23], [-0.28, 0, -0.1], 0.115, 3, false, false);

  registerProxy(
    valvesGroup,
    new THREE.BoxGeometry(0.65, 0.45, 0.45),
    [-0.02, 0.18, 0.05],
    'cardiac_valves',
  );
  heartPivot.add(valvesGroup);

  // 9. CORONARY ARTERIES, CARDIAC VEINS & EPICARDIAL ADIPOSE SULCI
  const coronaryGroup = new THREE.Group();

  const sulcusFatPts = [
    new THREE.Vector3(0.05, 0.18, 0.34),
    new THREE.Vector3(0.12, -0.08, 0.36),
    new THREE.Vector3(0.22, -0.38, 0.29),
    new THREE.Vector3(0.32, -0.62, 0.16),
  ];
  coronaryGroup.add(
    new THREE.Mesh(
      register(createTaperedVesselGeometry(sulcusFatPts, 0.042, 0.022, 28, 12)),
      adiposeMat,
    ),
  );

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

  // 10. CARDIAC CONDUCTION SYSTEM
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
  const internodalMesh = new THREE.Mesh(
    register(
      createTaperedVesselGeometry(
        [
          new THREE.Vector3(-0.31, 0.4, -0.01),
          new THREE.Vector3(-0.22, 0.26, 0.04),
          new THREE.Vector3(-0.1, 0.14, -0.02),
        ],
        0.014,
        0.014,
        18,
        8,
      ),
    ),
    internodalMat,
  );
  conductionGroup.add(internodalMesh);
  conductionStages.push({
    mesh: internodalMesh,
    material: internodalMat,
    activationStart: 0.05,
    activationEnd: 0.24,
  });

  const bachmannMesh = new THREE.Mesh(
    register(
      createTaperedVesselGeometry(
        [
          new THREE.Vector3(-0.28, 0.39, -0.03),
          new THREE.Vector3(-0.04, 0.36, -0.14),
          new THREE.Vector3(0.2, 0.32, -0.2),
        ],
        0.013,
        0.011,
        18,
        8,
      ),
    ),
    internodalMat,
  );
  conductionGroup.add(bachmannMesh);

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

  const hisMat = makeConductionMat();
  const hisMesh = new THREE.Mesh(
    register(
      createTaperedVesselGeometry(
        [
          new THREE.Vector3(-0.08, 0.11, -0.01),
          new THREE.Vector3(0.0, 0.02, 0.04),
          new THREE.Vector3(0.06, -0.16, 0.08),
          new THREE.Vector3(0.18, -0.44, 0.1),
          new THREE.Vector3(0.32, -0.62, 0.11),
        ],
        0.017,
        0.012,
        26,
        8,
      ),
    ),
    hisMat,
  );
  conductionGroup.add(hisMesh);
  conductionStages.push({
    mesh: hisMesh,
    material: hisMat,
    activationStart: 0.24,
    activationEnd: 0.44,
  });

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

  // 11. ANIMATED OXYGENATED & DEOXYGENATED BLOOD FLOW PARTICLES (InstancedMesh)
  const oxygenatedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.54, 0.42, -0.34), // Pulmonary vein entry
    new THREE.Vector3(0.24, 0.3, -0.2),   // Left Atrium
    new THREE.Vector3(0.2, 0.1, -0.07),   // Through Mitral Valve
    new THREE.Vector3(0.26, -0.34, 0.04), // Left Ventricle apex loop
    new THREE.Vector3(0.08, 0.06, 0.04),  // LVOT
    new THREE.Vector3(0.05, 0.32, 0.04),  // Through Aortic Valve
    new THREE.Vector3(0.06, 0.84, -0.06), // Aortic Arch
    new THREE.Vector3(0.22, 0.42, -0.4),  // Descending Aorta
  ]);

  const deoxygenatedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.31, 0.94, -0.06), // SVC entry
    new THREE.Vector3(-0.35, 0.28, -0.03), // Right Atrium
    new THREE.Vector3(-0.24, 0.06, 0.07),  // Through Tricuspid Valve
    new THREE.Vector3(-0.16, -0.3, 0.18),  // Right Ventricle
    new THREE.Vector3(-0.04, 0.18, 0.23),  // Conus arteriosus
    new THREE.Vector3(0.02, 0.44, 0.21),   // Through Pulmonary Valve
    new THREE.Vector3(0.07, 0.67, 0.0),    // Pulmonary Bifurcation
    new THREE.Vector3(0.45, 0.64, -0.17),  // Left Pulmonary Artery
  ]);

  const bloodParticleCount = 24;
  const bloodGeo = register(new THREE.SphereGeometry(0.021, 10, 10));
  const oxyBloodMat = register(
    new THREE.MeshStandardMaterial({
      color: 0xff3b4e,
      emissive: 0xef4444,
      emissiveIntensity: 0.75,
      roughness: 0.25,
    }),
  );
  const deoxyBloodMat = register(
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    }),
  );

  const oxygenatedBloodMesh = new THREE.InstancedMesh(
    bloodGeo,
    oxyBloodMat,
    bloodParticleCount,
  );
  oxygenatedBloodMesh.frustumCulled = false;

  const deoxygenatedBloodMesh = new THREE.InstancedMesh(
    bloodGeo,
    deoxyBloodMat,
    bloodParticleCount,
  );
  deoxygenatedBloodMesh.frustumCulled = false;

  heartPivot.add(oxygenatedBloodMesh);
  heartPivot.add(deoxygenatedBloodMesh);

  // 12. OPTIONAL MINIATURE WEARABLE BIOSENSOR PATCH
  const wearablePatchGroup = new THREE.Group();
  wearablePatchGroup.position.set(0.36, -0.26, 0.33);
  wearablePatchGroup.rotation.set(0.18, 0.52, -0.12);

  const patchPad = new THREE.Mesh(
    register(new THREE.CylinderGeometry(0.11, 0.12, 0.018, 28)),
    register(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.58,
        metalness: 0.05,
      }),
    ),
  );
  patchPad.rotation.x = Math.PI / 2;
  wearablePatchGroup.add(patchPad);

  const podCap = new THREE.Mesh(
    register(new THREE.CylinderGeometry(0.068, 0.074, 0.032, 28)),
    register(
      new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        roughness: 0.22,
        metalness: 0.85,
        clearcoat: 0.5,
      }),
    ),
  );
  podCap.rotation.x = Math.PI / 2;
  podCap.position.z = 0.018;
  wearablePatchGroup.add(podCap);

  const patchLed = new THREE.Mesh(
    register(new THREE.TorusGeometry(0.042, 0.007, 10, 28)),
    register(
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x2dd4bf,
        emissiveIntensity: 1.8,
        roughness: 0.2,
      }),
    ),
  );
  patchLed.position.z = 0.035;
  wearablePatchGroup.add(patchLed);
  wearablePatchGroup.visible = false;
  heartPivot.add(wearablePatchGroup);

  // Exploded Anatomy Layers (opens up chambers cleanly so valves, septum & blood flow are visible)
  const explodeItems: AnatomicalExplodeItem[] = [
    {
      object: leftVentricleGroup,
      restPos: leftVentricleGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.46, -0.2, 0.06),
    },
    {
      object: rightVentricleGroup,
      restPos: rightVentricleGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.42, -0.18, 0.34),
    },
    {
      object: rightAtriumGroup,
      restPos: rightAtriumGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.48, 0.18, 0.04),
    },
    {
      object: leftAtriumGroup,
      restPos: leftAtriumGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.42, 0.2, -0.34),
    },
    {
      object: aortaGroup,
      restPos: aortaGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.1, 0.4, -0.08),
    },
    {
      object: pulmonaryGroup,
      restPos: pulmonaryGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.1, 0.32, 0.28),
    },
    {
      object: venaCavaGroup,
      restPos: venaCavaGroup.position.clone(),
      explodeOffset: new THREE.Vector3(-0.44, 0.24, -0.22),
    },
    {
      object: coronaryGroup,
      restPos: coronaryGroup.position.clone(),
      explodeOffset: new THREE.Vector3(0.0, 0.0, 0.52),
    },
  ];

  const setXrayMode = (xray: boolean) => {
    myocardiumMaterials.forEach((m) => {
      m.transparent = xray;
      m.opacity = xray ? 0.22 : 1.0;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    });
    vesselMaterials.forEach((m) => {
      m.transparent = xray;
      m.opacity = xray ? 0.3 : 1.0;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    });
    septumMat.transparent = xray;
    septumMat.opacity = xray ? 0.35 : 1.0;
    septumMat.depthWrite = !xray;
    septumMat.needsUpdate = true;
    adiposeMat.opacity = xray ? 0.16 : 0.9;
    conductionGroup.visible = true;
  };

  const setShowCoronaries = (show: boolean) => {
    coronaryGroup.visible = show;
  };

  const setShowWearablePatch = (show: boolean) => {
    wearablePatchGroup.visible = show;
  };

  const setShowBloodFlow = (show: boolean) => {
    oxygenatedBloodMesh.visible = show;
    deoxygenatedBloodMesh.visible = show;
  };

  const partGroupMap: Record<AnatomyPartId, THREE.Object3D> = {
    left_ventricle: leftVentricleGroup,
    right_ventricle: rightVentricleGroup,
    right_atrium: rightAtriumGroup,
    left_atrium: leftAtriumGroup,
    cardiac_valves: valvesGroup,
    aorta: aortaGroup,
    pulmonary_trunk: pulmonaryGroup,
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
            mat.emissiveIntensity = active ? 0.34 : 0.0;
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
    septumGroup,
    aortaGroup,
    pulmonaryGroup,
    venaCavaGroup,
    coronaryGroup,
    conductionGroup,
    valvesGroup,
    wearablePatchGroup,
    conductionStages,
    explodeItems,
    avValveLeaflets,
    semilunarValveLeaflets,
    oxygenatedBloodMesh,
    deoxygenatedBloodMesh,
    oxygenatedCurve,
    deoxygenatedCurve,
    hitProxies,
    setXrayMode,
    setShowCoronaries,
    setShowWearablePatch,
    setShowBloodFlow,
    setHighlightedPart,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
