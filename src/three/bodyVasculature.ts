import * as THREE from 'three';
import { AnatomyPartId, VesselFilterId } from '../types/biometrics';
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
  setShowArteries: (show: boolean) => void;
  setShowVeins: (show: boolean) => void;
  setShowSilhouette: (show: boolean) => void;
  setShowBloodFlow: (show: boolean) => void;
  setVisualFocus: (
    activePart: AnatomyPartId | null,
    vesselFilter: VesselFilterId,
  ) => void;
  dispose: () => void;
}

function buildVesselTube(
  points: THREE.Vector3[],
  r0: number,
  r1: number,
  tubularSegments = 28,
  radialSegments = 10,
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

  const baseArteryMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0xd93040,
      emissive: 0x3a070d,
      emissiveIntensity: 0.44,
      roughness: 0.26,
      metalness: 0.04,
      clearcoat: 0.82,
      clearcoatRoughness: 0.15,
    }),
  );

  const baseVeinMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x3867c4,
      emissive: 0x0a1733,
      emissiveIntensity: 0.42,
      roughness: 0.32,
      metalness: 0.03,
      clearcoat: 0.74,
      clearcoatRoughness: 0.18,
    }),
  );

  const organCapillaryMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x9e344e,
      roughness: 0.45,
      metalness: 0.02,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    }),
  );

  const silhouetteMat = register(
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0c2438,
      emissiveIntensity: 0.32,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.075,
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

  // Share 1 arterial + 1 venous material per anatomical region for crisp highlighting & fast GPU batching
  const regionArteryMats = new Map<string, THREE.MeshPhysicalMaterial>();
  const regionVeinMats = new Map<string, THREE.MeshPhysicalMaterial>();

  const getRegionMat = (regionId: string, isArtery: boolean) => {
    const map = isArtery ? regionArteryMats : regionVeinMats;
    let mat = map.get(regionId);
    if (!mat) {
      mat = register((isArtery ? baseArteryMat : baseVeinMat).clone());
      mat.userData = { isArtery };
      map.set(regionId, mat);
    }
    return mat;
  };

  const addVessel = (
    regionId: string,
    isArtery: boolean,
    pts: THREE.Vector3[],
    r0: number,
    r1: number,
    tubularSeg = 24,
    radialSeg = 9,
  ) => {
    const mat = getRegionMat(regionId, isArtery);
    const mesh = new THREE.Mesh(
      register(buildVesselTube(pts, r0, r1, tubularSeg, radialSeg)),
      mat,
    );
    mesh.userData = {
      isArtery,
      regionId,
      vesselType: isArtery ? 'artery' : 'vein',
    };
    if (isArtery) {
      arteriesGroup.add(mesh);
    } else {
      veinsGroup.add(mesh);
    }
  };

  const arterialCurves: THREE.CatmullRomCurve3[] = [];
  const venousCurves: THREE.CatmullRomCurve3[] = [];

  // =========================================================
  // 1. HEAD, NECK & BRAIN (Carotids, Vertebrals, Circle of Willis, Cerebral Cortex, Jugulars & Sinuses)
  // =========================================================
  const rightCarotidPts = [
    new THREE.Vector3(-0.14, 1.2, -0.05),
    new THREE.Vector3(-0.17, 1.56, -0.04),
    new THREE.Vector3(-0.15, 1.88, -0.02),
    new THREE.Vector3(-0.11, 2.15, 0.04),
    new THREE.Vector3(-0.18, 2.38, 0.03),
    new THREE.Vector3(-0.08, 2.55, -0.04),
  ];
  const leftCarotidPts = [
    new THREE.Vector3(0.12, 1.26, -0.12),
    new THREE.Vector3(0.17, 1.58, -0.06),
    new THREE.Vector3(0.15, 1.88, -0.02),
    new THREE.Vector3(0.11, 2.15, 0.04),
    new THREE.Vector3(0.18, 2.38, 0.03),
    new THREE.Vector3(0.08, 2.55, -0.04),
  ];
  addVessel('brain_carotid', true, rightCarotidPts, 0.034, 0.011, 30);
  addVessel('brain_carotid', true, leftCarotidPts, 0.034, 0.011, 30);
  arterialCurves.push(new THREE.CatmullRomCurve3(rightCarotidPts));
  arterialCurves.push(new THREE.CatmullRomCurve3(leftCarotidPts));

  // Circle of Willis + Anterior, Middle & Posterior Cerebral cortical branches
  addVessel(
    'brain_carotid',
    true,
    [
      new THREE.Vector3(-0.11, 2.15, 0.04),
      new THREE.Vector3(0.0, 2.22, 0.12),
      new THREE.Vector3(0.11, 2.15, 0.04),
      new THREE.Vector3(0.08, 2.14, -0.11),
      new THREE.Vector3(-0.08, 2.14, -0.11),
      new THREE.Vector3(-0.11, 2.15, 0.04),
    ],
    0.013,
    0.013,
    26,
  );
  // Basilar & Vertebral Arteries
  addVessel(
    'brain_carotid',
    true,
    [
      new THREE.Vector3(0.0, 1.98, -0.14),
      new THREE.Vector3(0.0, 2.14, -0.11),
    ],
    0.015,
    0.013,
    10,
  );
  [-1, 1].forEach((side) => {
    // Vertebral
    addVessel(
      'brain_carotid',
      true,
      [
        new THREE.Vector3(side * 0.24, 1.24, -0.14),
        new THREE.Vector3(side * 0.11, 1.62, -0.16),
        new THREE.Vector3(0.0, 1.98, -0.14),
      ],
      0.014,
      0.01,
      18,
    );
    // Middle Cerebral Artery cortical fan
    addVessel(
      'brain_carotid',
      true,
      [
        new THREE.Vector3(side * 0.11, 2.15, 0.04),
        new THREE.Vector3(side * 0.24, 2.28, 0.04),
        new THREE.Vector3(side * 0.27, 2.48, -0.02),
        new THREE.Vector3(side * 0.16, 2.64, -0.05),
      ],
      0.012,
      0.005,
      18,
    );
    // Anterior Cerebral Artery arc
    addVessel(
      'brain_carotid',
      true,
      [
        new THREE.Vector3(side * 0.04, 2.21, 0.1),
        new THREE.Vector3(side * 0.04, 2.45, 0.16),
        new THREE.Vector3(side * 0.05, 2.66, 0.02),
        new THREE.Vector3(side * 0.04, 2.6, -0.16),
      ],
      0.01,
      0.005,
      18,
    );
    // External Carotid -> Facial & Superficial Temporal
    addVessel(
      'brain_carotid',
      true,
      [
        new THREE.Vector3(side * 0.15, 1.86, -0.02),
        new THREE.Vector3(side * 0.26, 2.06, 0.08),
        new THREE.Vector3(side * 0.31, 2.38, 0.02),
      ],
      0.015,
      0.005,
      16,
    );
    addVessel(
      'brain_carotid',
      true,
      [
        new THREE.Vector3(side * 0.19, 1.94, 0.03),
        new THREE.Vector3(side * 0.14, 2.06, 0.22),
        new THREE.Vector3(side * 0.06, 2.2, 0.28),
      ],
      0.01,
      0.004,
      14,
    );
  });

  // Cranial Venous Sinuses & Internal/External Jugular Veins
  addVessel(
    'brain_carotid',
    false,
    [
      new THREE.Vector3(0.0, 2.44, 0.18),
      new THREE.Vector3(0.0, 2.74, -0.01),
      new THREE.Vector3(0.0, 2.48, -0.24),
      new THREE.Vector3(0.0, 2.24, -0.25),
    ],
    0.009,
    0.02,
    24,
  );
  const rightJugularPts = [
    new THREE.Vector3(0.0, 2.24, -0.25),
    new THREE.Vector3(-0.22, 2.2, -0.14),
    new THREE.Vector3(-0.23, 1.78, -0.04),
    new THREE.Vector3(-0.28, 1.24, -0.05),
    new THREE.Vector3(-0.3, 1.05, -0.07),
  ];
  const leftJugularPts = [
    new THREE.Vector3(0.0, 2.24, -0.25),
    new THREE.Vector3(0.22, 2.2, -0.14),
    new THREE.Vector3(0.23, 1.78, -0.04),
    new THREE.Vector3(0.18, 1.22, -0.03),
    new THREE.Vector3(-0.12, 1.08, -0.03),
  ];
  addVessel('brain_carotid', false, rightJugularPts, 0.018, 0.04, 26);
  addVessel('brain_carotid', false, leftJugularPts, 0.018, 0.038, 26);
  venousCurves.push(new THREE.CatmullRomCurve3(rightJugularPts));
  venousCurves.push(new THREE.CatmullRomCurve3(leftJugularPts));

  // External Jugular & Cortical Superficial Veins
  [-1, 1].forEach((side) => {
    addVessel(
      'brain_carotid',
      false,
      [
        new THREE.Vector3(side * 0.28, 2.38, 0.02),
        new THREE.Vector3(side * 0.29, 1.92, 0.0),
        new THREE.Vector3(side * 0.33, 1.44, -0.04),
        new THREE.Vector3(side * 0.34, 1.14, -0.06),
      ],
      0.008,
      0.016,
      18,
    );
  });

  // =========================================================
  // 2. PULMONARY LOOP & THORACIC RIBCAGE INTERCOSTAL VESSELS
  // =========================================================
  const lungBranches = [
    { side: -1, xOut: -0.92, yMid: 0.56, yLow: 0.2 },
    { side: 1, xOut: 0.94, yMid: 0.58, yLow: 0.22 },
  ];
  lungBranches.forEach(({ side, xOut, yMid, yLow }) => {
    const pArtPts = [
      new THREE.Vector3(side * 0.5, 0.64, -0.18),
      new THREE.Vector3(side * 0.76, yMid + 0.14, -0.16),
      new THREE.Vector3(xOut, yMid - 0.06, -0.1),
    ];
    addVessel('pulmonary_loop', false, pArtPts, 0.052, 0.014, 18);
    addVessel(
      'pulmonary_loop',
      false,
      [
        new THREE.Vector3(side * 0.65, yMid + 0.08, -0.16),
        new THREE.Vector3(side * 0.86, yMid + 0.26, -0.14),
      ],
      0.028,
      0.01,
      12,
    );
    addVessel(
      'pulmonary_loop',
      false,
      [
        new THREE.Vector3(side * 0.68, yMid + 0.04, -0.16),
        new THREE.Vector3(side * 0.88, yLow + 0.02, -0.12),
      ],
      0.032,
      0.011,
      14,
    );
    venousCurves.push(new THREE.CatmullRomCurve3(pArtPts));

    const pVeinPts = [
      new THREE.Vector3(xOut * 0.94, yLow + 0.1, -0.14),
      new THREE.Vector3(side * 0.7, 0.34, -0.22),
      new THREE.Vector3(side * 0.45, 0.3, -0.28),
    ];
    addVessel('pulmonary_loop', true, pVeinPts, 0.014, 0.04, 16);
    arterialCurves.push(new THREE.CatmullRomCurve3(pVeinPts));

    // Internal Thoracic (Mammary) Artery & Vein + 5 Intercostal Pairs
    addVessel(
      'pulmonary_loop',
      true,
      [
        new THREE.Vector3(side * 0.34, 1.12, -0.14),
        new THREE.Vector3(side * 0.28, 0.78, 0.22),
        new THREE.Vector3(side * 0.24, 0.22, 0.26),
        new THREE.Vector3(side * 0.22, -0.24, 0.24),
      ],
      0.014,
      0.008,
      18,
    );

    [0.82, 0.62, 0.42, 0.22, 0.02].forEach((ry) => {
      addVessel(
        'pulmonary_loop',
        true,
        [
          new THREE.Vector3(0.18, ry, -0.4),
          new THREE.Vector3(side * 0.56, ry - 0.02, -0.32),
          new THREE.Vector3(side * 0.86, ry - 0.05, -0.05),
          new THREE.Vector3(side * 0.52, ry - 0.07, 0.24),
        ],
        0.008,
        0.004,
        16,
      );
      addVessel(
        'pulmonary_loop',
        false,
        [
          new THREE.Vector3(-0.08, ry + 0.02, -0.36),
          new THREE.Vector3(side * 0.54, ry, -0.3),
          new THREE.Vector3(side * 0.84, ry - 0.03, -0.04),
          new THREE.Vector3(side * 0.48, ry - 0.05, 0.23),
        ],
        0.008,
        0.004,
        16,
      );
    });

    // Translucent lung lobe silhouette
    const lungGeo = register(new THREE.SphereGeometry(0.42, 24, 20));
    lungGeo.scale(0.85, 1.35, 0.72);
    const lungMesh = new THREE.Mesh(lungGeo, organCapillaryMat);
    lungMesh.position.set(side * 0.68, 0.44, -0.15);
    lungMesh.rotation.z = -side * 0.14;
    silhouetteGroup.add(lungMesh);
  });

  // Azygos Vein along thoracic spine into SVC
  addVessel(
    'pulmonary_loop',
    false,
    [
      new THREE.Vector3(-0.08, -0.35, -0.34),
      new THREE.Vector3(-0.08, 0.42, -0.36),
      new THREE.Vector3(-0.18, 0.78, -0.22),
      new THREE.Vector3(-0.32, 0.8, -0.06),
    ],
    0.016,
    0.022,
    20,
  );

  // =========================================================
  // 3. UPPER LIMBS (Subclavian, Axillary, Brachial, Radial, Ulnar, Interosseous, Cephalic, Basilic, Median Cubital)
  // =========================================================
  // &
  // =========================================================
  // 4. HANDS, PALMS & ALL 5 FINGERS (Superficial & Deep Palmar Arches + Digital Arteries & Veins on Thumb, Index, Middle, Ring, Pinky)
  // =========================================================
  const buildArmAndHandVessels = (side: -1 | 1) => {
    const startA =
      side === -1
        ? new THREE.Vector3(-0.14, 1.2, -0.05)
        : new THREE.Vector3(0.35, 1.18, -0.25);

    // Subclavian -> Axillary -> Brachial -> Radial (lateral / thumb side)
    const brachialToRadialPts = [
      startA,
      new THREE.Vector3(side * 0.72, 1.16, -0.1),
      new THREE.Vector3(side * 1.16, 0.86, -0.04),
      new THREE.Vector3(side * 1.32, 0.16, 0.04),
      new THREE.Vector3(side * 1.48, -0.45, 0.11),
      new THREE.Vector3(side * 1.59, -0.96, 0.18),
    ];
    addVessel('upper_limbs', true, brachialToRadialPts, 0.036, 0.013, 34);

    // Profunda Brachii (deep upper arm artery)
    addVessel(
      'upper_limbs',
      true,
      [
        new THREE.Vector3(side * 1.16, 0.82, -0.04),
        new THREE.Vector3(side * 1.29, 0.48, -0.05),
        new THREE.Vector3(side * 1.34, 0.24, -0.02),
      ],
      0.015,
      0.007,
      14,
    );

    // Ulnar Artery (medial / pinky side of forearm)
    const ulnarArteryPts = [
      new THREE.Vector3(side * 1.32, 0.15, 0.04),
      new THREE.Vector3(side * 1.34, -0.42, 0.07),
      new THREE.Vector3(side * 1.46, -0.96, 0.15),
    ];
    addVessel('upper_limbs', true, ulnarArteryPts, 0.017, 0.012, 22);

    // Anterior Interosseous Artery (mid-forearm)
    addVessel(
      'upper_limbs',
      true,
      [
        new THREE.Vector3(side * 1.33, 0.06, 0.04),
        new THREE.Vector3(side * 1.41, -0.44, 0.07),
        new THREE.Vector3(side * 1.52, -0.96, 0.15),
      ],
      0.009,
      0.005,
      16,
    );

    // Deep Brachial -> Axillary -> Subclavian Vein
    const endV =
      side === -1
        ? new THREE.Vector3(-0.3, 1.04, -0.06)
        : new THREE.Vector3(0.14, 1.12, -0.02);

    const deepArmVeinPts = [
      new THREE.Vector3(side * 1.56, -0.96, 0.16),
      new THREE.Vector3(side * 1.44, -0.45, 0.1),
      new THREE.Vector3(side * 1.29, 0.17, 0.03),
      new THREE.Vector3(side * 1.13, 0.83, -0.04),
      new THREE.Vector3(side * 0.68, 1.1, -0.06),
      endV,
    ];
    addVessel('upper_limbs', false, deepArmVeinPts, 0.012, 0.034, 32);

    // Cephalic Vein (lateral / thumb side all the way up to shoulder)
    const cephalicVeinPts = [
      new THREE.Vector3(side * 1.61, -0.97, 0.16),
      new THREE.Vector3(side * 1.54, -0.42, 0.13),
      new THREE.Vector3(side * 1.4, 0.18, 0.08),
      new THREE.Vector3(side * 1.24, 0.84, 0.03),
      new THREE.Vector3(side * 0.92, 1.1, -0.02),
      new THREE.Vector3(side * 0.68, 1.1, -0.06),
    ];
    addVessel('upper_limbs', false, cephalicVeinPts, 0.01, 0.02, 28);

    // Basilic Vein (medial / pinky side of forearm and inner arm)
    const basilicVeinPts = [
      new THREE.Vector3(side * 1.45, -0.97, 0.14),
      new THREE.Vector3(side * 1.32, -0.42, 0.08),
      new THREE.Vector3(side * 1.22, 0.16, 0.03),
      new THREE.Vector3(side * 1.11, 0.62, -0.02),
      new THREE.Vector3(side * 1.13, 0.83, -0.04),
    ];
    addVessel('upper_limbs', false, basilicVeinPts, 0.01, 0.02, 24);

    // Median Cubital Vein (classic elbow venipuncture bridge connecting Cephalic & Basilic)
    addVessel(
      'upper_limbs',
      false,
      [
        new THREE.Vector3(side * 1.4, 0.14, 0.08),
        new THREE.Vector3(side * 1.31, 0.19, 0.08),
        new THREE.Vector3(side * 1.22, 0.21, 0.04),
      ],
      0.011,
      0.011,
      10,
    );

    // =====================================================
    // DETAILED PALM & ALL 5 FINGERS (Arteries + Veins)
    // =====================================================
    const radialWrist = new THREE.Vector3(side * 1.59, -0.96, 0.18);
    const ulnarWrist = new THREE.Vector3(side * 1.46, -0.96, 0.15);

    // Deep Palmar Arterial Arch
    addVessel(
      'hands_fingers',
      true,
      [
        radialWrist,
        new THREE.Vector3(side * 1.57, -1.03, 0.175),
        new THREE.Vector3(side * 1.51, -1.04, 0.165),
        new THREE.Vector3(side * 1.47, -1.01, 0.155),
      ],
      0.011,
      0.01,
      16,
    );

    // Superficial Palmar Arterial Arch (fed primarily by Ulnar + Radial superficial branch)
    addVessel(
      'hands_fingers',
      true,
      [
        ulnarWrist,
        new THREE.Vector3(side * 1.46, -1.05, 0.17),
        new THREE.Vector3(side * 1.52, -1.09, 0.185),
        new THREE.Vector3(side * 1.58, -1.07, 0.19),
        radialWrist,
      ],
      0.012,
      0.01,
      20,
    );

    // Dorsal Venous Network / Arch on back of hand (z slightly posterior)
    addVessel(
      'hands_fingers',
      false,
      [
        new THREE.Vector3(side * 1.61, -0.97, 0.16),
        new THREE.Vector3(side * 1.59, -1.05, 0.145),
        new THREE.Vector3(side * 1.53, -1.08, 0.135),
        new THREE.Vector3(side * 1.47, -1.05, 0.13),
        new THREE.Vector3(side * 1.45, -0.97, 0.14),
      ],
      0.01,
      0.01,
      20,
    );

    // 5 Anatomical Fingers: Thumb, Index, Middle, Ring, Pinky
    // Each finger receives paired digital arteries converging at fingertip loop + digital veins returning to dorsal arch
    const fingers = [
      {
        name: 'thumb',
        archArt: new THREE.Vector3(side * 1.58, -1.02, 0.185),
        archVein: new THREE.Vector3(side * 1.6, -1.02, 0.155),
        base: new THREE.Vector3(side * 1.62, -1.05, 0.19),
        mid: new THREE.Vector3(side * 1.7, -1.14, 0.22),
        tip: new THREE.Vector3(side * 1.75, -1.22, 0.24),
        radius: 0.026,
      },
      {
        name: 'index',
        archArt: new THREE.Vector3(side * 1.58, -1.08, 0.185),
        archVein: new THREE.Vector3(side * 1.58, -1.07, 0.142),
        base: new THREE.Vector3(side * 1.6, -1.14, 0.185),
        mid: new THREE.Vector3(side * 1.63, -1.25, 0.2),
        tip: new THREE.Vector3(side * 1.65, -1.35, 0.215),
        radius: 0.023,
      },
      {
        name: 'middle',
        archArt: new THREE.Vector3(side * 1.54, -1.09, 0.185),
        archVein: new THREE.Vector3(side * 1.54, -1.08, 0.135),
        base: new THREE.Vector3(side * 1.55, -1.15, 0.18),
        mid: new THREE.Vector3(side * 1.56, -1.28, 0.195),
        tip: new THREE.Vector3(side * 1.56, -1.39, 0.21),
        radius: 0.024,
      },
      {
        name: 'ring',
        archArt: new THREE.Vector3(side * 1.5, -1.08, 0.18),
        archVein: new THREE.Vector3(side * 1.5, -1.07, 0.132),
        base: new THREE.Vector3(side * 1.5, -1.14, 0.172),
        mid: new THREE.Vector3(side * 1.495, -1.26, 0.185),
        tip: new THREE.Vector3(side * 1.49, -1.36, 0.198),
        radius: 0.022,
      },
      {
        name: 'pinky',
        archArt: new THREE.Vector3(side * 1.46, -1.06, 0.17),
        archVein: new THREE.Vector3(side * 1.46, -1.05, 0.13),
        base: new THREE.Vector3(side * 1.45, -1.12, 0.16),
        mid: new THREE.Vector3(side * 1.43, -1.22, 0.172),
        tip: new THREE.Vector3(side * 1.415, -1.3, 0.182),
        radius: 0.019,
      },
    ];

    fingers.forEach((f, idx) => {
      const off = 0.0085;
      // Lateral & Medial Proper Palmar Digital Arteries joining at the fingertip capillary arch
      const latArtPts = [
        f.archArt,
        new THREE.Vector3(f.base.x + side * off, f.base.y, f.base.z + 0.006),
        new THREE.Vector3(f.mid.x + side * off, f.mid.y, f.mid.z + 0.006),
        new THREE.Vector3(f.tip.x, f.tip.y, f.tip.z + 0.004),
      ];
      const medArtPts = [
        f.archArt,
        new THREE.Vector3(f.base.x - side * off, f.base.y, f.base.z + 0.006),
        new THREE.Vector3(f.mid.x - side * off, f.mid.y, f.mid.z + 0.006),
        new THREE.Vector3(f.tip.x, f.tip.y, f.tip.z + 0.004),
      ];
      addVessel('hands_fingers', true, latArtPts, 0.0055, 0.0032, 14, 7);
      addVessel('hands_fingers', true, medArtPts, 0.0052, 0.003, 14, 7);

      // Digital Veins returning from fingertip back along dorsal/lateral border to Dorsal Venous Arch
      const digVeinPts = [
        new THREE.Vector3(f.tip.x, f.tip.y, f.tip.z - 0.006),
        new THREE.Vector3(f.mid.x + side * off * 0.5, f.mid.y, f.mid.z - 0.012),
        new THREE.Vector3(f.base.x, f.base.y, f.base.z - 0.016),
        f.archVein,
      ];
      addVessel('hands_fingers', false, digVeinPts, 0.003, 0.0058, 14, 7);

      // Add blood corpuscle stream into Thumb, Index, Middle fingers + full arm
      if (idx === 0 || idx === 2) {
        arterialCurves.push(
          new THREE.CatmullRomCurve3([...brachialToRadialPts, ...latArtPts.slice(1)]),
        );
        venousCurves.push(
          new THREE.CatmullRomCurve3([
            ...digVeinPts,
            ...cephalicVeinPts.slice(1),
            endV,
          ]),
        );
      }

      // Translucent Finger Silhouette
      const fCurve = new THREE.CatmullRomCurve3([f.base, f.mid, f.tip]);
      const fMesh = new THREE.Mesh(
        register(new THREE.TubeGeometry(fCurve, 12, f.radius, 10, false)),
        silhouetteMat,
      );
      silhouetteGroup.add(fMesh);
    });

    // Full arm venous corpuscle path
    venousCurves.push(new THREE.CatmullRomCurve3(deepArmVeinPts));
    arterialCurves.push(new THREE.CatmullRomCurve3(brachialToRadialPts));

    // Translucent Palm Silhouette connecting wrist to finger bases
    const palmGeo = register(new THREE.BoxGeometry(0.18, 0.18, 0.065));
    const palmMesh = new THREE.Mesh(palmGeo, silhouetteMat);
    palmMesh.position.set(side * 1.53, -1.06, 0.165);
    palmMesh.rotation.z = side * 0.08;
    silhouetteGroup.add(palmMesh);
  };
  buildArmAndHandVessels(-1);
  buildArmAndHandVessels(1);

  // =========================================================
  // 5. ABDOMEN, LIVER, SPLEEN, MESENTERIC & RENAL VESSELS
  // =========================================================
  const abdAortaPts = [
    new THREE.Vector3(0.18, -0.34, -0.4),
    new THREE.Vector3(0.08, -0.68, -0.26),
    new THREE.Vector3(0.05, -1.18, -0.18),
    new THREE.Vector3(0.03, -1.66, -0.14),
  ];
  addVessel('renal_visceral', true, abdAortaPts, 0.092, 0.065, 30);

  const ivcPts = [
    new THREE.Vector3(-0.1, -1.64, -0.14),
    new THREE.Vector3(-0.14, -1.1, -0.15),
    new THREE.Vector3(-0.22, -0.64, -0.17),
    new THREE.Vector3(-0.32, -0.44, -0.18),
  ];
  addVessel('renal_visceral', false, ivcPts, 0.065, 0.11, 30);

  // Left & Right Renal Arteries, Veins, Intrarenal Branches & Kidney Silhouettes
  [-1, 1].forEach((side) => {
    const renA = [
      new THREE.Vector3(0.05, -1.02, -0.19),
      new THREE.Vector3(side * 0.28, -1.04, -0.22),
      new THREE.Vector3(side * 0.45, -1.06, -0.22),
    ];
    addVessel('renal_visceral', true, renA, 0.03, 0.015, 16);
    addVessel(
      'renal_visceral',
      true,
      [
        new THREE.Vector3(side * 0.44, -1.06, -0.22),
        new THREE.Vector3(side * 0.54, -0.96, -0.21),
      ],
      0.012,
      0.005,
      10,
    );
    addVessel(
      'renal_visceral',
      true,
      [
        new THREE.Vector3(side * 0.44, -1.06, -0.22),
        new THREE.Vector3(side * 0.54, -1.16, -0.21),
      ],
      0.012,
      0.005,
      10,
    );
    arterialCurves.push(new THREE.CatmullRomCurve3(renA));

    const renV = [
      new THREE.Vector3(side * 0.46, -1.08, -0.18),
      new THREE.Vector3(side * 0.2, -1.06, -0.16),
      new THREE.Vector3(-0.14, -1.04, -0.15),
    ];
    addVessel('renal_visceral', false, renV, 0.016, 0.032, 16);
    venousCurves.push(new THREE.CatmullRomCurve3(renV));

    const kidneyGeo = register(new THREE.SphereGeometry(0.15, 16, 14));
    kidneyGeo.scale(0.85, 1.35, 0.65);
    const kMesh = new THREE.Mesh(kidneyGeo, organCapillaryMat);
    kMesh.position.set(side * 0.49, -1.06, -0.2);
    silhouetteGroup.add(kMesh);
  });

  // Celiac Trunk -> Common Hepatic Artery (Liver) + Splenic Artery (Spleen)
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.06, -0.78, -0.24),
      new THREE.Vector3(0.02, -0.82, 0.04),
      new THREE.Vector3(-0.34, -0.78, 0.1),
      new THREE.Vector3(-0.48, -0.74, 0.06),
    ],
    0.026,
    0.01,
    18,
  );
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.04, -0.81, -0.02),
      new THREE.Vector3(0.32, -0.78, 0.04),
      new THREE.Vector3(0.52, -0.76, -0.05),
    ],
    0.022,
    0.009,
    16,
  );
  // Superior & Inferior Mesenteric Arteries + Intestinal Arcades
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.05, -0.92, -0.2),
      new THREE.Vector3(0.02, -1.16, 0.1),
      new THREE.Vector3(-0.1, -1.42, 0.16),
    ],
    0.024,
    0.008,
    18,
  );
  addVessel(
    'renal_visceral',
    true,
    [
      new THREE.Vector3(0.03, -1.32, -0.16),
      new THREE.Vector3(0.16, -1.48, 0.08),
    ],
    0.015,
    0.006,
    12,
  );
  // Hepatic Portal Vein & Hepatic Veins into IVC
  addVessel(
    'renal_visceral',
    false,
    [
      new THREE.Vector3(-0.08, -1.36, 0.12),
      new THREE.Vector3(-0.14, -1.04, 0.06),
      new THREE.Vector3(-0.32, -0.82, 0.05),
    ],
    0.014,
    0.028,
    18,
  );
  addVessel(
    'renal_visceral',
    false,
    [
      new THREE.Vector3(-0.38, -0.78, 0.04),
      new THREE.Vector3(-0.28, -0.68, -0.08),
      new THREE.Vector3(-0.22, -0.62, -0.17),
    ],
    0.016,
    0.03,
    14,
  );

  // Subtle translucent Liver & Spleen organ frames
  const liverGeo = register(new THREE.SphereGeometry(0.28, 16, 14));
  liverGeo.scale(1.35, 0.72, 0.85);
  const liverMesh = new THREE.Mesh(liverGeo, organCapillaryMat);
  liverMesh.position.set(-0.34, -0.76, 0.06);
  silhouetteGroup.add(liverMesh);

  // =========================================================
  // 6. PELVIS, LOWER LIMBS, FEET & TOES (Iliac, Femoral, Profunda, Popliteal, Ant/Post Tibial, Dorsalis Pedis, Great & Small Saphenous)
  // =========================================================
  const buildLegVessels = (side: -1 | 1) => {
    const legArteryPts = [
      new THREE.Vector3(0.03, -1.65, -0.14),
      new THREE.Vector3(side * 0.28, -1.88, -0.04),
      new THREE.Vector3(side * 0.42, -2.25, 0.08),
      new THREE.Vector3(side * 0.4, -2.85, -0.04),
      new THREE.Vector3(side * 0.41, -3.45, 0.06),
      new THREE.Vector3(side * 0.42, -3.86, 0.22),
    ];
    addVessel('lower_limbs', true, legArteryPts, 0.054, 0.014, 38);
    arterialCurves.push(new THREE.CatmullRomCurve3(legArteryPts));

    // Internal Iliac pelvic loop
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.16, -1.78, -0.09),
        new THREE.Vector3(side * 0.18, -1.96, -0.14),
        new THREE.Vector3(side * 0.08, -2.04, -0.08),
      ],
      0.02,
      0.008,
      14,
    );

    // Profunda Femoris (deep femoral thigh)
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.36, -2.04, 0.04),
        new THREE.Vector3(side * 0.49, -2.42, 0.0),
        new THREE.Vector3(side * 0.45, -2.72, -0.04),
      ],
      0.022,
      0.007,
      16,
    );

    // Posterior Tibial & Fibular Arteries
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.4, -2.85, -0.04),
        new THREE.Vector3(side * 0.44, -3.45, -0.08),
        new THREE.Vector3(side * 0.43, -3.89, 0.05),
      ],
      0.02,
      0.009,
      20,
    );
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.41, -3.02, -0.05),
        new THREE.Vector3(side * 0.47, -3.46, -0.04),
        new THREE.Vector3(side * 0.46, -3.86, 0.04),
      ],
      0.014,
      0.006,
      16,
    );

    // Deep Femoral/Iliac Vein
    const legVeinPts = [
      new THREE.Vector3(side * 0.45, -3.86, 0.2),
      new THREE.Vector3(side * 0.45, -3.4, 0.08),
      new THREE.Vector3(side * 0.45, -2.82, 0.0),
      new THREE.Vector3(side * 0.47, -2.2, 0.1),
      new THREE.Vector3(side * 0.25, -1.85, -0.06),
      new THREE.Vector3(-0.1, -1.64, -0.14),
    ];
    addVessel('lower_limbs', false, legVeinPts, 0.013, 0.052, 38);
    venousCurves.push(new THREE.CatmullRomCurve3(legVeinPts));

    // Great Saphenous Vein (medial superficial return from foot to groin)
    const gsvPts = [
      new THREE.Vector3(side * 0.36, -3.87, 0.18),
      new THREE.Vector3(side * 0.31, -3.28, 0.06),
      new THREE.Vector3(side * 0.32, -2.55, 0.09),
      new THREE.Vector3(side * 0.36, -2.02, 0.06),
    ];
    addVessel('lower_limbs', false, gsvPts, 0.009, 0.02, 24);

    // Small Saphenous Vein (posterior calf to popliteal)
    addVessel(
      'lower_limbs',
      false,
      [
        new THREE.Vector3(side * 0.48, -3.87, 0.08),
        new THREE.Vector3(side * 0.45, -3.36, -0.1),
        new THREE.Vector3(side * 0.43, -2.85, -0.03),
      ],
      0.008,
      0.014,
      16,
    );

    // Arcuate Foot Arch + 5 Toe Digital Arteries & Veins
    addVessel(
      'lower_limbs',
      true,
      [
        new THREE.Vector3(side * 0.36, -3.88, 0.23),
        new THREE.Vector3(side * 0.42, -3.87, 0.24),
        new THREE.Vector3(side * 0.49, -3.88, 0.21),
      ],
      0.01,
      0.009,
      12,
    );
    addVessel(
      'lower_limbs',
      false,
      [
        new THREE.Vector3(side * 0.36, -3.87, 0.21),
        new THREE.Vector3(side * 0.42, -3.86, 0.22),
        new THREE.Vector3(side * 0.48, -3.87, 0.19),
      ],
      0.009,
      0.009,
      12,
    );

    [-0.06, -0.03, 0.0, 0.03, 0.06].forEach((dx, idx) => {
      const toeLen = 0.09 - idx * 0.008;
      addVessel(
        'lower_limbs',
        true,
        [
          new THREE.Vector3(side * (0.42 + dx), -3.88, 0.23),
          new THREE.Vector3(side * (0.42 + dx), -3.9, 0.23 + toeLen),
        ],
        0.0055,
        0.003,
        8,
      );
      addVessel(
        'lower_limbs',
        false,
        [
          new THREE.Vector3(side * (0.42 + dx), -3.89, 0.23 + toeLen),
          new THREE.Vector3(side * (0.42 + dx), -3.87, 0.21),
        ],
        0.003,
        0.005,
        8,
      );
    });
  };
  buildLegVessels(-1);
  buildLegVessels(1);

  // =========================================================
  // 7. TRANSLUCENT HUMAN BODY SILHOUETTE (Head, Torso, Arms, Legs, Feet)
  // =========================================================
  const headGeo = register(new THREE.SphereGeometry(0.42, 28, 22));
  headGeo.scale(0.88, 1.12, 0.96);
  const headMesh = new THREE.Mesh(headGeo, silhouetteMat);
  headMesh.position.set(0, 2.34, -0.02);
  silhouetteGroup.add(headMesh);

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

  [-1, 1].forEach((side) => {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.86, 1.16, -0.08),
      new THREE.Vector3(side * 1.22, 0.72, -0.02),
      new THREE.Vector3(side * 1.36, 0.14, 0.04),
      new THREE.Vector3(side * 1.53, -0.94, 0.16),
    ]);
    const armMesh = new THREE.Mesh(
      register(new THREE.TubeGeometry(armCurve, 24, 0.175, 14, false)),
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
      register(new THREE.TubeGeometry(legCurve, 26, 0.24, 16, false)),
      silhouetteMat,
    );
    silhouetteGroup.add(legMesh);

    const footGeo = register(new THREE.BoxGeometry(0.24, 0.1, 0.34));
    const footMesh = new THREE.Mesh(footGeo, silhouetteMat);
    footMesh.position.set(side * 0.43, -3.88, 0.18);
    silhouetteGroup.add(footMesh);
  });

  // =========================================================
  // 8. FULL-BODY STANDING BASE & CONTACT SHADOW (at y = -3.96)
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
  // 9. SYSTEMIC ARTERIAL & VENOUS BLOOD CORPUSCLES (InstancedMesh)
  // =========================================================
  const particleCount = 220;
  const particleGeo = register(new THREE.SphereGeometry(0.022, 8, 8));
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
  // 10. LAYER-1 RAYCAST PROXIES FOR VASCULAR REGIONS
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
  addProxy('upper_limbs', new THREE.BoxGeometry(0.7, 1.9, 0.45), [-1.3, 0.05, 0.05]);
  addProxy('upper_limbs', new THREE.BoxGeometry(0.7, 1.9, 0.45), [1.3, 0.05, 0.05]);
  addProxy('hands_fingers', new THREE.SphereGeometry(0.32, 10, 10), [-1.56, -1.16, 0.18]);
  addProxy('hands_fingers', new THREE.SphereGeometry(0.32, 10, 10), [1.56, -1.16, 0.18]);
  addProxy('renal_visceral', new THREE.BoxGeometry(1.1, 0.95, 0.55), [0, -1.05, -0.18]);
  addProxy('lower_limbs', new THREE.BoxGeometry(1.2, 2.2, 0.55), [0, -2.75, 0.02]);

  let arteriesVisible = true;
  let veinsVisible = true;
  let bloodFlowVisible = true;
  let currentVesselFilter: VesselFilterId = 'all';

  const syncBloodVisibility = () => {
    arterialBloodMesh.visible =
      bloodFlowVisible && arteriesVisible && currentVesselFilter !== 'veins';
    venousBloodMesh.visible =
      bloodFlowVisible && veinsVisible && currentVesselFilter !== 'arteries';
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

  const applyRegionMat = (
    mat: THREE.MeshPhysicalMaterial,
    isActive: boolean,
    isDimmed: boolean,
    isArtery: boolean,
    partSelected: boolean,
    vesselSpotlit: boolean,
  ) => {
    if (isDimmed) {
      if (!mat.transparent || Math.abs(mat.opacity - 0.11) > 0.01) {
        mat.transparent = true;
        mat.opacity = 0.11;
        mat.depthWrite = false;
        mat.needsUpdate = true;
      }
      mat.emissive.setHex(isArtery ? 0x1a0306 : 0x050b18);
      mat.emissiveIntensity = 0.12;
      return;
    }

    if (mat.transparent || mat.opacity < 0.99) {
      mat.transparent = false;
      mat.opacity = 1.0;
      mat.depthWrite = true;
      mat.needsUpdate = true;
    }

    if (partSelected && isActive) {
      mat.emissive.setHex(0x2dd4bf);
      mat.emissiveIntensity = 0.72;
    } else if (vesselSpotlit && isActive) {
      mat.emissive.setHex(isArtery ? 0xb91c1c : 0x1d4ed8);
      mat.emissiveIntensity = 0.72;
    } else {
      mat.emissive.setHex(isArtery ? 0x3a070d : 0x0a1733);
      mat.emissiveIntensity = 0.44;
    }
  };

  const setVisualFocus = (
    activePart: AnatomyPartId | null,
    vesselFilter: VesselFilterId,
  ) => {
    currentVesselFilter = vesselFilter;
    syncBloodVisibility();

    const allRegions = new Set([
      ...regionArteryMats.keys(),
      ...regionVeinMats.keys(),
    ]);
    const hasRegionSelection =
      activePart !== null && allRegions.has(activePart);
    const hasHeartSelection =
      activePart !== null && !allRegions.has(activePart);

    allRegions.forEach((regionId) => {
      const regionMatch = activePart === null || activePart === regionId;
      const artM = regionArteryMats.get(regionId);
      if (artM) {
        const typeMatch = vesselFilter !== 'veins';
        const isActive = regionMatch && typeMatch && !hasHeartSelection;
        const isDimmed =
          hasHeartSelection ||
          (hasRegionSelection && !regionMatch) ||
          !typeMatch;
        applyRegionMat(
          artM,
          isActive,
          isDimmed,
          true,
          hasRegionSelection && regionMatch,
          vesselFilter === 'arteries',
        );
      }

      const venM = regionVeinMats.get(regionId);
      if (venM) {
        const typeMatch = vesselFilter !== 'arteries';
        const isActive = regionMatch && typeMatch && !hasHeartSelection;
        const isDimmed =
          hasHeartSelection ||
          (hasRegionSelection && !regionMatch) ||
          !typeMatch;
        applyRegionMat(
          venM,
          isActive,
          isDimmed,
          false,
          hasRegionSelection && regionMatch,
          vesselFilter === 'veins',
        );
      }
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
    setShowArteries,
    setShowVeins,
    setShowSilhouette,
    setShowBloodFlow,
    setVisualFocus,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
