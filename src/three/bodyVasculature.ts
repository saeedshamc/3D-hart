import * as THREE from 'three';
import { AnatomyPartId } from '../types/biometrics';
import { createContactShadowTexture } from './heartTextures';

export interface BodyVasculatureRig {
  root: THREE.Group;
  arteriesGroup: THREE.Group;
  veinsGroup: THREE.Group;
  silhouetteGroup: THREE.Group;
  fullBodyStandGroup: THREE.Group;
  arterialBloodMesh: THREE.InstancedMesh;
  venousBloodMesh: THREE.InstancedMesh;
  arterialCurves: THREE.CatmullRomCurve3[];
  venousCurves: THREE.CatmullRomCurve3[];
  hitProxies: THREE.Mesh[];
  arteryMat: THREE.MeshPhysicalMaterial;
  veinMat: THREE.MeshPhysicalMaterial;
  setShowArteries: (show: boolean) => void;
  setShowVeins: (show: boolean) => void;
  setShowSilhouette: (show: boolean) => void;
  setShowBloodFlow: (show: boolean) => void;
  setHighlightedRegion: (part: AnatomyPartId | null) => void;
  dispose: () => void;
}

function buildVesselTube(
  points: THREE.Vector3[],
  r0: number,
  r1: number,
  tubularSegments = 36,
  radialSegments = 12,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  const vert = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, center);
    const r = THREE.MathUtils.lerp(r0, r1, t);
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

function buildLimbLathe(
  radii: [number, number][],
  segments = 24,
): THREE.BufferGeometry {
  const pts = radii.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(pts, segments);
  geo.computeVertexNormals();
  return geo;
}

export function buildBodyVasculatureRig(): BodyVasculatureRig {
  const root = new THREE.Group();
  root.name = 'human_body_vasculature';

  const disposables: { dispose: () => void }[] = [];
  const register = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const arteryMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xd93040,
      emissive: 0x3a070d,
      emissiveIntensity: 0.45,
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.78,
      clearcoatRoughness: 0.16,
    }),
  );

  const veinMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x3b67b8,
      emissive: 0x0a1733,
      emissiveIntensity: 0.4,
      roughness: 0.34,
      metalness: 0.03,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    }),
  );

  const organCapillaryMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x9e344e,
      roughness: 0.45,
      metalness: 0.02,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );

  const silhouetteMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0c2438,
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.085,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );

  const arteriesGroup = new THREE.Group();
  const veinsGroup = new THREE.Group();
  const silhouetteGroup = new THREE.Group();
  const fullBodyStandGroup = new THREE.Group();

  root.add(arteriesGroup);
  root.add(veinsGroup);
  root.add(silhouetteGroup);
  root.add(fullBodyStandGroup);

  const regionGroups: Record<string, THREE.Group> = {
    brain_carotid: new THREE.Group(),
    pulmonary_loop: new THREE.Group(),
    upper_limbs: new THREE.Group(),
    renal_visceral: new THREE.Group(),
    lower_limbs: new THREE.Group(),
  };

  const regionMaterials = new Map<string, THREE.MeshPhysicalMaterial[]>();

  const addVessel = (
    regionId: string,
    isArtery: boolean,
    pts: THREE.Vector3[],
    r0: number,
    r1: number,
    seg = 32,
  ) => {
    const baseMat = isArtery ? arteryMat : veinMat;
    const mat = register(baseMat.clone());
    mat.userData = { isArtery };
    const mesh = new THREE.Mesh(
      register(buildVesselTube(pts, r0, r1, seg, 10)),
      mat,
    );
    mesh.userData = { isArtery, regionId };
    if (isArtery) {
      arteriesGroup.add(mesh);
    } else {
      veinsGroup.add(mesh);
    }
    if (!regionMaterials.has(regionId)) regionMaterials.set(regionId, []);
    regionMaterials.get(regionId)!.push(mat);
  };

  const arterialCurves: THREE.CatmullRomCurve3[] = [];
  const venousCurves: THREE.CatmullRomCurve3[] = [];

  // =========================================================
  // 1. HEAD, NECK & BRAIN (Carotid Arteries, Circle of Willis, Jugular Veins)
  // =========================================================
  const rightCarotidPts = [
    new THREE.Vector3(-0.14, 1.2, -0.05),
    new THREE.Vector3(-0.18, 1.55, -0.04),
    new THREE.Vector3(-0.16, 1.88, -0.02),
    new THREE.Vector3(-0.12, 2.15, 0.04),
    new THREE.Vector3(-0.18, 2.38, 0.02),
    new THREE.Vector3(-0.08, 2.52, -0.06),
  ];
  const leftCarotidPts = [
    new THREE.Vector3(0.12, 1.26, -0.12),
    new THREE.Vector3(0.17, 1.58, -0.06),
    new THREE.Vector3(0.16, 1.88, -0.02),
    new THREE.Vector3(0.12, 2.15, 0.04),
    new THREE.Vector3(0.18, 2.38, 0.02),
    new THREE.Vector3(0.08, 2.52, -0.06),
  ];
  addVessel('brain_carotid', true, rightCarotidPts, 0.036, 0.012);
  addVessel('brain_carotid', true, leftCarotidPts, 0.036, 0.012);
  arterialCurves.push(new THREE.CatmullRomCurve3(rightCarotidPts));
  arterialCurves.push(new THREE.CatmullRomCurve3(leftCarotidPts));

  // Circle of Willis + Anterior & Posterior Cerebral Loops
  addVessel(
    'brain_carotid',
    true,
    [
      new THREE.Vector3(-0.12, 2.15, 0.04),
      new THREE.Vector3(0.0, 2.22, 0.12),
      new THREE.Vector3(0.12, 2.15, 0.04),
      new THREE.Vector3(0.08, 2.14, -0.12),
      new THREE.Vector3(-0.08, 2.14, -0.12),
      new THREE.Vector3(-0.12, 2.15, 0.04),
    ],
    0.014,
    0.014,
    28,
  );
  // External facial/temporal arterial twigs
  addVessel(
    'brain_carotid',
    true,
    [
      new THREE.Vector3(-0.16, 1.86, -0.02),
      new THREE.Vector3(-0.28, 2.08, 0.08),
      new THREE.Vector3(-0.32, 2.36, 0.02),
    ],
    0.016,
    0.006,
    18,
  );
  addVessel(
    'brain_carotid',
    true,
    [
      new THREE.Vector3(0.16, 1.86, -0.02),
      new THREE.Vector3(0.28, 2.08, 0.08),
      new THREE.Vector3(0.32, 2.36, 0.02),
    ],
    0.016,
    0.006,
    18,
  );

  // Jugular Veins returning from cranial dural sinuses down to SVC
  const rightJugularPts = [
    new THREE.Vector3(-0.12, 2.48, -0.08),
    new THREE.Vector3(-0.24, 2.18, -0.04),
    new THREE.Vector3(-0.24, 1.72, -0.03),
    new THREE.Vector3(-0.28, 1.24, -0.05),
    new THREE.Vector3(-0.3, 1.05, -0.07),
  ];
  const leftJugularPts = [
    new THREE.Vector3(0.12, 2.48, -0.08),
    new THREE.Vector3(0.24, 2.18, -0.04),
    new THREE.Vector3(0.24, 1.72, -0.03),
    new THREE.Vector3(0.2, 1.22, -0.03),
    new THREE.Vector3(-0.12, 1.08, -0.03),
  ];
  addVessel('brain_carotid', false, rightJugularPts, 0.012, 0.042);
  addVessel('brain_carotid', false, leftJugularPts, 0.012, 0.04);
  venousCurves.push(new THREE.CatmullRomCurve3(rightJugularPts));
  venousCurves.push(new THREE.CatmullRomCurve3(leftJugularPts));

  // Superior sagittal sinus & posterior vertebral arteries
  addVessel(
    'brain_carotid',
    false,
    [
      new THREE.Vector3(0.0, 2.55, 0.14),
      new THREE.Vector3(0.0, 2.74, -0.02),
      new THREE.Vector3(0.0, 2.54, -0.22),
      new THREE.Vector3(-0.12, 2.48, -0.08),
    ],
    0.01,
    0.016,
    24,
  );
  [-1, 1].forEach((side) => {
    addVessel(
      'brain_carotid',
      true,
      [
        new THREE.Vector3(side * 0.24, 1.24, -0.14),
        new THREE.Vector3(side * 0.12, 1.65, -0.16),
        new THREE.Vector3(side * 0.08, 2.12, -0.14),
      ],
      0.016,
      0.01,
      20,
    );
  });

  // =========================================================
  // 2. PULMONARY ARTERIAL & VENOUS ARBORS (Left & Right Lungs)
  // =========================================================
  const lungBranches = [
    { side: -1, xOut: -0.92, yMid: 0.56, yLow: 0.22 },
    { side: 1, xOut: 0.94, yMid: 0.58, yLow: 0.24 },
  ];
  lungBranches.forEach(({ side, xOut, yMid, yLow }) => {
    const pArtPts = [
      new THREE.Vector3(side * 0.5, 0.64, -0.18),
      new THREE.Vector3(side * 0.76, yMid + 0.14, -0.16),
      new THREE.Vector3(xOut, yMid - 0.06, -0.1),
    ];
    addVessel('pulmonary_loop', false, pArtPts, 0.055, 0.016, 20);
    addVessel(
      'pulmonary_loop',
      false,
      [
        new THREE.Vector3(side * 0.68, yMid + 0.08, -0.16),
        new THREE.Vector3(side * 0.88, yLow + 0.04, -0.12),
      ],
      0.034,
      0.012,
      16,
    );
    venousCurves.push(new THREE.CatmullRomCurve3(pArtPts));

    const pVeinPts = [
      new THREE.Vector3(xOut * 0.95, yLow + 0.12, -0.14),
      new THREE.Vector3(side * 0.72, 0.34, -0.22),
      new THREE.Vector3(side * 0.45, 0.3, -0.28),
    ];
    addVessel('pulmonary_loop', true, pVeinPts, 0.016, 0.042, 18);
    arterialCurves.push(new THREE.CatmullRomCurve3(pVeinPts));

    // Subtle translucent lung lobe silhouette
    const lungGeo = register(new THREE.SphereGeometry(0.42, 24, 20));
    lungGeo.scale(0.85, 1.35, 0.72);
    const lungMesh = new THREE.Mesh(lungGeo, organCapillaryMat);
    lungMesh.position.set(side * 0.68, 0.44, -0.15);
    lungMesh.rotation.z = -side * 0.14;
    silhouetteGroup.add(lungMesh);
  });

  // =========================================================
  // 3. UPPER LIMBS (Subclavian -> Brachial -> Radial/Ulnar -> Palmar Arch)
  // =========================================================
  const buildArmVessels = (side: -1 | 1) => {
    const startA =
      side === -1
        ? new THREE.Vector3(-0.14, 1.2, -0.05)
        : new THREE.Vector3(0.35, 1.18, -0.25);

    const armArteryPts = [
      startA,
      new THREE.Vector3(side * 0.72, 1.16, -0.1),
      new THREE.Vector3(side * 1.18, 0.85, -0.04),
      new THREE.Vector3(side * 1.34, 0.15, 0.02),
      new THREE.Vector3(side * 1.48, -0.58, 0.12),
      new THREE.Vector3(side * 1.56, -1.06, 0.18),
    ];
    addVessel('upper_limbs', true, armArteryPts, 0.036, 0.014, 36);
    arterialCurves.push(new THREE.CatmullRomCurve3(armArteryPts));

    // Ulnar artery branch in forearm
    addVessel(
      'upper_limbs',
      true,
      [
        new THREE.Vector3(side * 1.34, 0.12, 0.02),
        new THREE.Vector3(side * 1.36, -0.55, 0.06),
        new THREE.Vector3(side * 1.48, -1.06, 0.14),
      ],
      0.018,
      0.01,
      20,
    );

    // Digital / Palmar finger twigs
    [-0.04, 0.0, 0.04].forEach((dz) => {
      addVessel(
        'upper_limbs',
        true,
        [
          new THREE.Vector3(side * 1.54, -1.06, 0.16 + dz * 0.5),
          new THREE.Vector3(side * 1.62, -1.32, 0.2 + dz),
        ],
        0.008,
        0.004,
        10,
      );
    });

    // Upper limb Venous return (Cephalic + Brachial -> Subclavian -> SVC)
    const endV =
      side === -1
        ? new THREE.Vector3(-0.3, 1.04, -0.06)
        : new THREE.Vector3(0.14, 1.12, -0.02);

    const armVeinPts = [
      new THREE.Vector3(side * 1.54, -1.16, 0.18),
      new THREE.Vector3(side * 1.44, -0.62, 0.14),
      new THREE.Vector3(side * 1.28, 0.18, 0.05),
      new THREE.Vector3(side * 1.12, 0.82, -0.02),
      new THREE.Vector3(side * 0.68, 1.1, -0.06),
      endV,
    ];
    addVessel('upper_limbs', false, armVeinPts, 0.012, 0.036, 36);
    venousCurves.push(new THREE.CatmullRomCurve3(armVeinPts));

    // Superficial basilic/cephalic vein & palmar arch
    addVessel(
      'upper_limbs',
      true,
      [
        new THREE.Vector3(side * 1.56, -1.06, 0.18),
        new THREE.Vector3(side * 1.52, -1.12, 0.16),
        new THREE.Vector3(side * 1.48, -1.06, 0.14),
      ],
      0.009,
      0.009,
      10,
    );
    addVessel(
      'upper_limbs',
      false,
      [
        new THREE.Vector3(side * 1.48, -1.02, 0.1),
        new THREE.Vector3(side * 1.25, 0.12, -0.02),
        new THREE.Vector3(side * 0.92, 0.94, -0.08),
        new THREE.Vector3(side * 0.68, 1.1, -0.06),
      ],
      0.009,
      0.022,
      24,
    );
  };
  buildArmVessels(-1);
  buildArmVessels(1);

  // =========================================================
  // 4. ABDOMINAL AORTA, IVC, CELIAC/HEPATIC & RENAL VESSELS
  // =========================================================
  const abdAortaPts = [
    new THREE.Vector3(0.18, -0.34, -0.4),
    new THREE.Vector3(0.08, -0.68, -0.26),
    new THREE.Vector3(0.05, -1.18, -0.18),
    new THREE.Vector3(0.03, -1.66, -0.14),
  ];
  addVessel('renal_visceral', true, abdAortaPts, 0.095, 0.068, 32);

  const ivcPts = [
    new THREE.Vector3(-0.1, -1.64, -0.14),
    new THREE.Vector3(-0.14, -1.1, -0.15),
    new THREE.Vector3(-0.22, -0.64, -0.17),
    new THREE.Vector3(-0.32, -0.44, -0.18),
  ];
  addVessel('renal_visceral', false, ivcPts, 0.068, 0.115, 32);

  // Left & Right Renal Arteries + Veins + Kidney silhouettes
  [-1, 1].forEach((side) => {
    const renA = [
      new THREE.Vector3(0.05, -1.02, -0.19),
      new THREE.Vector3(side * 0.28, -1.04, -0.22),
      new THREE.Vector3(side * 0.44, -1.06, -0.22),
    ];
    addVessel('renal_visceral', true, renA, 0.03, 0.016, 16);
    arterialCurves.push(new THREE.CatmullRomCurve3(renA));

    const renV = [
      new THREE.Vector3(side * 0.44, -1.08, -0.19),
      new THREE.Vector3(side * 0.2, -1.06, -0.17),
      new THREE.Vector3(-0.14, -1.04, -0.15),
    ];
    addVessel('renal_visceral', false, renV, 0.018, 0.032, 16);
    venousCurves.push(new THREE.CatmullRomCurve3(renV));

    const kidneyGeo = register(new THREE.SphereGeometry(0.15, 16, 14));
    kidneyGeo.scale(0.85, 1.35, 0.65);
    const kMesh = new THREE.Mesh(kidneyGeo, organCapillaryMat);
    kMesh.position.set(side * 0.48, -1.06, -0.2);
    silhouetteGroup.add(kMesh);
  });

  // Celiac / Hepatic / Splenic Visceral Arch
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.06, -0.78, -0.24),
      new THREE.Vector3(0.02, -0.82, 0.04),
      new THREE.Vector3(-0.32, -0.8, 0.12),
    ],
    0.026,
    0.012,
    18,
  );
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.04, -0.81, -0.02),
      new THREE.Vector3(0.36, -0.78, 0.06),
    ],
    0.022,
    0.01,
    14,
  );
  // Superior mesenteric artery & hepatic venous return
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.05, -0.92, -0.2),
      new THREE.Vector3(0.02, -1.16, 0.08),
      new THREE.Vector3(-0.08, -1.42, 0.14),
    ],
    0.024,
    0.009,
    18,
  );
  addVessel(
    'renal_visceral',
    false,
    [
      new THREE.Vector3(-0.34, -0.82, 0.06),
      new THREE.Vector3(-0.26, -0.7, -0.08),
      new THREE.Vector3(-0.22, -0.64, -0.17),
    ],
    0.016,
    0.03,
    14,
  );

  // =========================================================
  // 5. PELVIS & LOWER LIMBS (Iliac -> Femoral -> Popliteal -> Tibial -> Foot)
  // =========================================================
  const buildLegVessels = (side: -1 | 1) => {
    const legArteryPts = [
      new THREE.Vector3(0.03, -1.65, -0.14),
      new THREE.Vector3(side * 0.28, -1.88, -0.04),
      new THREE.Vector3(side * 0.42, -2.25, 0.08),
      new THREE.Vector3(side * 0.4, -2.85, -0.04),
      new THREE.Vector3(side * 0.41, -3.45, 0.04),
      new THREE.Vector3(side * 0.42, -3.86, 0.24),
    ];
    addVessel('lower_limbs', true, legArteryPts, 0.056, 0.015, 42);
    arterialCurves.push(new THREE.CatmullRomCurve3(legArteryPts));

    // Posterior tibial & deep femoral branches
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.4, -2.85, -0.04),
        new THREE.Vector3(side * 0.44, -3.45, -0.08),
        new THREE.Vector3(side * 0.43, -3.89, 0.05),
      ],
      0.022,
      0.01,
      20,
    );
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.36, -2.05, 0.04),
        new THREE.Vector3(side * 0.48, -2.42, 0.02),
        new THREE.Vector3(side * 0.45, -2.7, -0.03),
      ],
      0.024,
      0.008,
      16,
    );

    const legVeinPts = [
      new THREE.Vector3(side * 0.46, -3.86, 0.2),
      new THREE.Vector3(side * 0.46, -3.4, 0.08),
      new THREE.Vector3(side * 0.46, -2.82, 0.0),
      new THREE.Vector3(side * 0.48, -2.2, 0.1),
      new THREE.Vector3(side * 0.26, -1.85, -0.06),
      new THREE.Vector3(-0.1, -1.64, -0.14),
    ];
    addVessel('lower_limbs', false, legVeinPts, 0.014, 0.054, 42);
    venousCurves.push(new THREE.CatmullRomCurve3(legVeinPts));

    // Great saphenous vein (medial superficial return)
    addVessel(
      'lower_limbs',
      false,
      [
        new THREE.Vector3(side * 0.34, -3.85, 0.18),
        new THREE.Vector3(side * 0.31, -3.28, 0.06),
        new THREE.Vector3(side * 0.32, -2.55, 0.09),
        new THREE.Vector3(side * 0.36, -2.02, 0.06),
      ],
      0.01,
      0.022,
      24,
    );
  };
  buildLegVessels(-1);
  buildLegVessels(1);

  // =========================================================
  // 6. TRANSLUCENT HUMAN BODY SILHOUETTE (Anatomical Framing)
  // =========================================================
  // Head
  const headGeo = register(new THREE.SphereGeometry(0.42, 28, 22));
  headGeo.scale(0.88, 1.12, 0.96);
  const headMesh = new THREE.Mesh(headGeo, silhouetteMat);
  headMesh.position.set(0, 2.34, -0.02);
  silhouetteGroup.add(headMesh);

  // Neck + Torso + Pelvis (LatheGeometry)
  const torsoGeo = register(
    buildLimbLathe(
      [
        [0.0, 1.92],
        [0.24, 1.88],
        [0.26, 1.48],
        [0.86, 1.24],
        [0.98, 0.72],
        [0.86, 0.05],
        [0.74, -0.68],
        [0.82, -1.35],
        [0.74, -1.82],
        [0.0, -1.86],
      ],
      32,
    ),
  );
  torsoGeo.scale(1.0, 1.0, 0.56);
  const torsoMesh = new THREE.Mesh(torsoGeo, silhouetteMat);
  torsoMesh.position.set(0, 0, -0.08);
  silhouetteGroup.add(torsoMesh);

  // Left & Right Arms silhouette
  [-1, 1].forEach((side) => {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.86, 1.16, -0.08),
      new THREE.Vector3(side * 1.22, 0.72, -0.02),
      new THREE.Vector3(side * 1.38, 0.1, 0.04),
      new THREE.Vector3(side * 1.56, -0.95, 0.16),
      new THREE.Vector3(side * 1.62, -1.32, 0.2),
    ]);
    const armMesh = new THREE.Mesh(
      register(new THREE.TubeGeometry(armCurve, 24, 0.19, 14, false)),
      silhouetteMat,
    );
    silhouetteGroup.add(armMesh);

    const legCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.42, -1.68, -0.06),
      new THREE.Vector3(side * 0.44, -2.35, 0.04),
      new THREE.Vector3(side * 0.42, -3.1, -0.02),
      new THREE.Vector3(side * 0.43, -3.84, 0.08),
    ]);
    const legMesh = new THREE.Mesh(
      register(new THREE.TubeGeometry(legCurve, 26, 0.25, 16, false)),
      silhouetteMat,
    );
    silhouetteGroup.add(legMesh);
  });

  // =========================================================
  // 7. FULL-BODY STANDING BASE & CONTACT SHADOW (at y = -3.96)
  // =========================================================
  const floorShadow = new THREE.Mesh(
    register(new THREE.PlaneGeometry(5.6, 5.6)),
    register(
      new THREE.MeshBasicMaterial({
        map: register(createContactShadowTexture()),
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    ),
  );
  floorShadow.rotation.x = -Math.PI / 2;
  floorShadow.position.y = -3.96;
  fullBodyStandGroup.add(floorShadow);

  const standPlinth = new THREE.Mesh(
    register(new THREE.CylinderGeometry(1.5, 1.65, 0.08, 64)),
    register(
      new THREE.MeshPhysicalMaterial({
        color: 0x131a22,
        roughness: 0.3,
        metalness: 0.72,
      }),
    ),
  );
  standPlinth.position.y = -3.94;
  fullBodyStandGroup.add(standPlinth);

  const standGlow = new THREE.Mesh(
    register(new THREE.TorusGeometry(1.48, 0.018, 12, 64)),
    register(
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x14b8a6,
        emissiveIntensity: 0.4,
      }),
    ),
  );
  standGlow.rotation.x = Math.PI / 2;
  standGlow.position.y = -3.9;
  fullBodyStandGroup.add(standGlow);

  // =========================================================
  // 8. SYSTEMIC ARTERIAL & VENOUS BLOOD CORPUSCLES (InstancedMesh)
  // =========================================================
  const particleCount = 120;
  const particleGeo = register(new THREE.SphereGeometry(0.025, 8, 8));
  const artBloodMat = register(
    new THREE.MeshStandardMaterial({
      color: 0xff4757,
      emissive: 0xff2e43,
      emissiveIntensity: 0.95,
      roughness: 0.2,
    }),
  );
  const venBloodMat = register(
    new THREE.MeshStandardMaterial({
      color: 0x60a5fa,
      emissive: 0x2563eb,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    }),
  );

  const arterialBloodMesh = new THREE.InstancedMesh(
    particleGeo,
    artBloodMat,
    particleCount,
  );
  arterialBloodMesh.frustumCulled = false;

  const venousBloodMesh = new THREE.InstancedMesh(
    particleGeo,
    venBloodMat,
    particleCount,
  );
  venousBloodMesh.frustumCulled = false;

  root.add(arterialBloodMesh);
  root.add(venousBloodMesh);

  // =========================================================
  // 9. LAYER-1 RAYCAST PROXIES FOR VASCULAR REGIONS
  // =========================================================
  const hitProxies: THREE.Mesh[] = [];
  const addProxy = (
    partId: AnatomyPartId,
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
  ) => {
    const m = new THREE.Mesh(
      register(geo),
      register(new THREE.MeshBasicMaterial({ visible: false })),
    );
    m.position.set(...pos);
    m.layers.set(1);
    m.userData = { partId };
    root.add(m);
    hitProxies.push(m);
  };

  addProxy('brain_carotid', new THREE.SphereGeometry(0.55, 10, 10), [0, 2.15, 0]);
  addProxy('pulmonary_loop', new THREE.BoxGeometry(1.9, 0.85, 0.6), [0, 0.46, -0.15]);
  addProxy('upper_limbs', new THREE.BoxGeometry(0.75, 2.2, 0.5), [-1.35, -0.1, 0.05]);
  addProxy('upper_limbs', new THREE.BoxGeometry(0.75, 2.2, 0.5), [1.35, -0.1, 0.05]);
  addProxy('renal_visceral', new THREE.BoxGeometry(1.1, 0.95, 0.55), [0, -1.05, -0.18]);
  addProxy('lower_limbs', new THREE.BoxGeometry(1.2, 2.2, 0.55), [0, -2.75, 0.02]);

  Object.values(regionGroups).forEach((g) => root.add(g));

  let arteriesVisible = true;
  let veinsVisible = true;
  let bloodFlowVisible = true;

  const syncBloodVisibility = () => {
    arterialBloodMesh.visible = bloodFlowVisible && arteriesVisible;
    venousBloodMesh.visible = bloodFlowVisible && veinsVisible;
  };

  const setShowArteries = (show: boolean) => {
    arteriesVisible = show;
    arteriesGroup.visible = show;
    syncBloodVisibility();
  };
  const setShowVeins = (show: boolean) => {
    veinsVisible = show;
    veinsGroup.visible = show;
    syncBloodVisibility();
  };
  const setShowSilhouette = (show: boolean) => {
    silhouetteGroup.visible = show;
  };
  const setShowBloodFlow = (show: boolean) => {
    bloodFlowVisible = show;
    syncBloodVisibility();
  };

  const setHighlightedRegion = (part: AnatomyPartId | null) => {
    regionMaterials.forEach((mats, regionId) => {
      const active = part === regionId;
      mats.forEach((m) => {
        const isArt = Boolean(m.userData?.isArtery);
        if (active) {
          m.emissive.setHex(0x2dd4bf);
          m.emissiveIntensity = 0.72;
        } else {
          m.emissive.setHex(isArt ? 0x3a070d : 0x0a1733);
          m.emissiveIntensity = 0.42;
        }
      });
    });
  };

  return {
    root,
    arteriesGroup,
    veinsGroup,
    silhouetteGroup,
    fullBodyStandGroup,
    arterialBloodMesh,
    venousBloodMesh,
    arterialCurves,
    venousCurves,
    hitProxies,
    arteryMat,
    veinMat,
    setShowArteries,
    setShowVeins,
    setShowSilhouette,
    setShowBloodFlow,
    setHighlightedRegion,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
