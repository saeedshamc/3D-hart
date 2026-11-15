import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ANATOMY_PARTS,
  AnatomyPartId,
  CAMERA_PRESETS_BY_SCOPE,
  CameraPresetId,
  TelemetrySnapshot,
  VascularScopeId,
  ViewModeId,
} from '../types/biometrics';
import { buildBodyVasculatureRig } from './bodyVasculature';
import { buildPediatricHeartRig } from './heartAnatomy';

interface HeartSceneCanvasProps {
  telemetryRef: React.MutableRefObject<TelemetrySnapshot>;
  vascularScope: VascularScopeId;
  cameraPreset: CameraPresetId;
  viewMode: ViewModeId;
  explodeFactor: number;
  showCoronaries: boolean;
  showWearablePatch: boolean;
  showBloodFlow: boolean;
  showArteries: boolean;
  showVeins: boolean;
  showBodySilhouette: boolean;
  autoRotate: boolean;
  selectedPart: AnatomyPartId | null;
  onSelectPart: (part: AnatomyPartId | null) => void;
}

// Pre-allocated scratch math objects (zero GC in animation loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _restScale = new THREE.Vector3(1, 1, 1);
const _bloodPos = new THREE.Vector3();
const _bloodScale = new THREE.Vector3();
const _bloodQuat = new THREE.Quaternion();
const _bloodMat = new THREE.Matrix4();

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function pulseBell(phase: number, start: number, end: number): number {
  if (phase < start || phase > end) return 0;
  const u = (phase - start) / (end - start);
  return Math.sin(u * Math.PI);
}

export function HeartSceneCanvas({
  telemetryRef,
  vascularScope,
  cameraPreset,
  viewMode,
  explodeFactor,
  showCoronaries,
  showWearablePatch,
  showBloodFlow,
  showArteries,
  showVeins,
  showBodySilhouette,
  autoRotate,
  selectedPart,
  onSelectPart,
}: HeartSceneCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const initialPreset = CAMERA_PRESETS_BY_SCOPE[vascularScope][cameraPreset];
  const cameraGoalPosRef = useRef(new THREE.Vector3(...initialPreset.position));
  const cameraGoalTargetRef = useRef(new THREE.Vector3(...initialPreset.target));
  const transitionActiveRef = useRef(false);

  const vascularScopeRef = useRef<VascularScopeId>(vascularScope);
  const viewModeRef = useRef<ViewModeId>(viewMode);
  const explodeTargetRef = useRef(explodeFactor);
  const showCoronariesRef = useRef(showCoronaries);
  const showWearablePatchRef = useRef(showWearablePatch);
  const showBloodFlowRef = useRef(showBloodFlow);
  const showArteriesRef = useRef(showArteries);
  const showVeinsRef = useRef(showVeins);
  const showBodySilhouetteRef = useRef(showBodySilhouette);
  const autoRotateRef = useRef(autoRotate);
  const selectedPartRef = useRef<AnatomyPartId | null>(selectedPart);

  const onSelectPartRef = useRef(onSelectPart);
  onSelectPartRef.current = onSelectPart;

  const rigActionsRef = useRef<{
    setScope: (scope: VascularScopeId) => void;
    setXrayMode: (x: boolean) => void;
    setShowCoronaries: (s: boolean) => void;
    setShowWearablePatch: (s: boolean) => void;
    setShowBloodFlow: (s: boolean) => void;
    setShowArteries: (s: boolean) => void;
    setShowVeins: (s: boolean) => void;
    setShowSilhouette: (s: boolean) => void;
    setHighlightedPart: (p: AnatomyPartId | null) => void;
  } | null>(null);

  useEffect(() => {
    if (selectedPart) {
      const cam = ANATOMY_PARTS[selectedPart].focusCamera;
      cameraGoalPosRef.current.set(...cam.position);
      cameraGoalTargetRef.current.set(...cam.target);
    } else {
      const preset = CAMERA_PRESETS_BY_SCOPE[vascularScope][cameraPreset];
      cameraGoalPosRef.current.set(...preset.position);
      cameraGoalTargetRef.current.set(...preset.target);
    }
    transitionActiveRef.current = true;
  }, [vascularScope, cameraPreset, selectedPart]);

  useEffect(() => {
    vascularScopeRef.current = vascularScope;
    rigActionsRef.current?.setScope(vascularScope);
  }, [vascularScope]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    rigActionsRef.current?.setXrayMode(viewMode === 'conduction_xray');
  }, [viewMode]);

  useEffect(() => {
    explodeTargetRef.current = explodeFactor;
  }, [explodeFactor]);

  useEffect(() => {
    showCoronariesRef.current = showCoronaries;
    rigActionsRef.current?.setShowCoronaries(showCoronaries);
  }, [showCoronaries]);

  useEffect(() => {
    showWearablePatchRef.current = showWearablePatch;
    rigActionsRef.current?.setShowWearablePatch(showWearablePatch);
  }, [showWearablePatch]);

  useEffect(() => {
    showBloodFlowRef.current = showBloodFlow;
    rigActionsRef.current?.setShowBloodFlow(showBloodFlow);
  }, [showBloodFlow]);

  useEffect(() => {
    showArteriesRef.current = showArteries;
    rigActionsRef.current?.setShowArteries(showArteries);
  }, [showArteries]);

  useEffect(() => {
    showVeinsRef.current = showVeins;
    rigActionsRef.current?.setShowVeins(showVeins);
  }, [showVeins]);

  useEffect(() => {
    showBodySilhouetteRef.current = showBodySilhouette;
    rigActionsRef.current?.setShowSilhouette(showBodySilhouette);
  }, [showBodySilhouette]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    selectedPartRef.current = selectedPart;
    rigActionsRef.current?.setHighlightedPart(selectedPart);
  }, [selectedPart]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener(
      'webglcontextrestored',
      onContextRestored,
    );

    const scene = new THREE.Scene();
    const bgHex = 0x090e14;
    scene.background = new THREE.Color(bgHex);
    const fog = new THREE.FogExp2(bgHex, 0.042);
    scene.fog = fog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
    camera.position.copy(cameraGoalPosRef.current);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(cameraGoalTargetRef.current);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.2;
    controls.maxDistance = vascularScopeRef.current === 'full_body' ? 15.5 : 6.5;
    controls.maxPolarAngle = Math.PI * 0.74;
    controls.minPolarAngle = 0.12;
    controls.autoRotateSpeed = 0.75;
    controls.update();

    const onControlsStart = () => {
      transitionActiveRef.current = false;
    };
    controls.addEventListener('start', onControlsStart);

    // 3-Point Anatomical Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xc2dcf5, 0x1a151b, 0.82);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0e0, 2.45);
    keyLight.position.set(2.6, 3.8, 3.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    const d = 2.4;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x88ccff, 1.25);
    rimLight.position.set(-2.8, 1.8, -2.6);
    scene.add(rimLight);

    const underFillLight = new THREE.PointLight(0xffb4b4, 0.48, 8, 2);
    underFillLight.position.set(0.4, -0.9, 1.8);
    scene.add(underFillLight);

    const floorGeo = new THREE.PlaneGeometry(48, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090e14,
      roughness: 0.92,
      metalness: 0.04,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y =
      vascularScopeRef.current === 'full_body' ? -3.97 : -1.17;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const heartRig = buildPediatricHeartRig(maxAnisotropy, isSoftwareGl);
    scene.add(heartRig.root);

    const bodyRig = buildBodyVasculatureRig();
    scene.add(bodyRig.root);

    const applyScope = (scope: VascularScopeId) => {
      const isFullBody = scope === 'full_body';
      heartRig.heartStandGroup.visible = !isFullBody;
      bodyRig.root.visible = isFullBody;
      floorMesh.position.y = isFullBody ? -3.97 : -1.17;
      controls.maxDistance = isFullBody ? 15.5 : 6.5;
      fog.density = isFullBody ? 0.016 : 0.042;
    };

    rigActionsRef.current = {
      setScope: applyScope,
      setXrayMode: heartRig.setXrayMode,
      setShowCoronaries: heartRig.setShowCoronaries,
      setShowWearablePatch: heartRig.setShowWearablePatch,
      setShowBloodFlow: (show) => {
        heartRig.setShowBloodFlow(show);
        bodyRig.setShowBloodFlow(show);
      },
      setShowArteries: bodyRig.setShowArteries,
      setShowVeins: bodyRig.setShowVeins,
      setShowSilhouette: bodyRig.setShowSilhouette,
      setHighlightedPart: (part) => {
        heartRig.setHighlightedPart(part);
        bodyRig.setHighlightedRegion(part);
      },
    };

    applyScope(vascularScopeRef.current);
    heartRig.setXrayMode(viewModeRef.current === 'conduction_xray');
    heartRig.setShowCoronaries(showCoronariesRef.current);
    heartRig.setShowWearablePatch(showWearablePatchRef.current);
    heartRig.setShowBloodFlow(showBloodFlowRef.current);
    bodyRig.setShowBloodFlow(showBloodFlowRef.current);
    bodyRig.setShowArteries(showArteriesRef.current);
    bodyRig.setShowVeins(showVeinsRef.current);
    bodyRig.setShowSilhouette(showBodySilhouetteRef.current);
    heartRig.setHighlightedPart(selectedPartRef.current);
    bodyRig.setHighlightedRegion(selectedPartRef.current);

    // Layer-1 Throttled Raycasting
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const getActiveHitProxies = () =>
      vascularScopeRef.current === 'full_body'
        ? [...heartRig.hitProxies, ...bodyRig.hitProxies]
        : heartRig.hitProxies;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 36) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(getActiveHitProxies(), false);
      if (hits.length > 0) {
        const partId = hits[0].object.userData.partId as AnatomyPartId;
        onSelectPartRef.current(
          selectedPartRef.current === partId ? null : partId,
        );
      } else {
        onSelectPartRef.current(null);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 65) return;
      lastHoverCheck = now;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(getActiveHitProxies(), false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let frameId = 0;
    let disposed = false;
    let currentExplode = 0;
    let bloodFlowPhase = 0;
    let systemicBloodPhase = 0;
    let currentAvOpen = 1;
    let currentSemilunarOpen = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
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

    function tick() {
      if (disposed) return;

      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const snap = telemetryRef.current;
      const cycle = snap.cardiacCyclePhase;

      // 1. Damped Camera Focus Transition
      if (transitionActiveRef.current) {
        _camGoalPos.copy(cameraGoalPosRef.current);
        _camGoalTarget.copy(cameraGoalTargetRef.current);

        const dampAlpha = 1 - Math.exp(-5.5 * dt);
        camera.position.lerp(_camGoalPos, dampAlpha);
        controls.target.lerp(_camGoalTarget, dampAlpha);

        if (
          camera.position.distanceToSquared(_camGoalPos) < 0.0005 &&
          controls.target.distanceToSquared(_camGoalTarget) < 0.0005
        ) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          transitionActiveRef.current = false;
        }
      }

      controls.autoRotate =
        !isSoftwareGl && autoRotateRef.current && !transitionActiveRef.current;
      controls.update();

      // 2. Smooth Damped Exploded-View Chamber Opening
      const explodeGoal =
        viewModeRef.current === 'exploded'
          ? Math.max(0.85, explodeTargetRef.current)
          : explodeTargetRef.current;
      currentExplode = THREE.MathUtils.damp(currentExplode, explodeGoal, 7.0, dt);
      for (let i = 0; i < heartRig.explodeItems.length; i++) {
        const item = heartRig.explodeItems[i];
        item.object.position
          .copy(item.restPos)
          .addScaledVector(item.explodeOffset, currentExplode);
      }

      // 3. Physiological Two-Phase Cardiac Biomechanics
      const atrialSqueeze = pulseBell(cycle, 0.05, 0.22);
      const ventSqueeze = Math.pow(pulseBell(cycle, 0.25, 0.54), 1.25);
      const arterialRecoil = pulseBell(cycle, 0.3, 0.6);

      heartRig.heartPivot.position.y =
        vascularScopeRef.current === 'full_body'
          ? 0.06
          : 0.06 + Math.sin(elapsed * 1.4) * 0.012;

      const aRad = 1.0 - atrialSqueeze * 0.1;
      const aVert = 1.0 - atrialSqueeze * 0.065;
      heartRig.rightAtriumGroup.scale.set(aRad, aVert, aRad);
      heartRig.leftAtriumGroup.scale.set(aRad, aVert, aRad);

      const lvRad = 1.0 - ventSqueeze * 0.12;
      const lvVert = 1.0 - ventSqueeze * 0.058;
      const rvRad = 1.0 - ventSqueeze * 0.105;
      const rvVert = 1.0 - ventSqueeze * 0.05;

      heartRig.leftVentricleGroup.scale.set(lvRad, lvVert, lvRad);
      heartRig.rightVentricleGroup.scale.set(rvRad, rvVert, rvRad);

      heartRig.coronaryGroup.scale.set(
        1.0 - ventSqueeze * 0.085,
        1.0 - ventSqueeze * 0.042,
        1.0 - ventSqueeze * 0.085,
      );

      heartRig.heartPivot.rotation.y =
        vascularScopeRef.current === 'full_body'
          ? -0.08 + ventSqueeze * 0.025
          : -0.08 + ventSqueeze * 0.058;
      heartRig.heartPivot.rotation.z =
        vascularScopeRef.current === 'full_body'
          ? -0.08
          : -0.08 + ventSqueeze * 0.025;

      const vesselExpand = 1.0 + arterialRecoil * 0.058;
      heartRig.aortaGroup.scale.set(
        vesselExpand,
        1.0 + arterialRecoil * 0.02,
        vesselExpand,
      );
      heartRig.pulmonaryGroup.scale.set(
        vesselExpand,
        1.0 + arterialRecoil * 0.02,
        vesselExpand,
      );
      heartRig.venaCavaGroup.scale.lerp(_restScale, 0.2);

      // 4. Articulated Cardiac Valve Leaflets (Open & Close in real time)
      const isSystole = cycle >= 0.24 && cycle <= 0.54;
      const avGoal = isSystole ? 0.0 : cycle < 0.24 ? 1.0 : 0.78;
      const semilunarGoal = cycle >= 0.27 && cycle <= 0.52 ? 1.0 : 0.0;

      currentAvOpen = THREE.MathUtils.damp(currentAvOpen, avGoal, 18.0, dt);
      currentSemilunarOpen = THREE.MathUtils.damp(
        currentSemilunarOpen,
        semilunarGoal,
        18.0,
        dt,
      );

      for (let i = 0; i < heartRig.avValveLeaflets.length; i++) {
        const lf = heartRig.avValveLeaflets[i];
        lf.pivot.rotation.x = THREE.MathUtils.lerp(
          lf.closedAngle,
          lf.openAngle,
          currentAvOpen,
        );
      }
      for (let i = 0; i < heartRig.semilunarValveLeaflets.length; i++) {
        const lf = heartRig.semilunarValveLeaflets[i];
        lf.pivot.rotation.x = THREE.MathUtils.lerp(
          lf.closedAngle,
          lf.openAngle,
          currentSemilunarOpen,
        );
      }

      // 5. Animated Intracardiac Blood Flow Streams
      if (showBloodFlowRef.current) {
        const flowSpeed = (snap.bpm / 115) * (0.38 + ventSqueeze * 0.45);
        bloodFlowPhase = (bloodFlowPhase + dt * flowSpeed) % 1;
        const count = heartRig.oxygenatedBloodMesh.count;

        for (let i = 0; i < count; i++) {
          const t = (i / count + bloodFlowPhase) % 1;
          const s = 0.65 + 0.45 * Math.sin(t * Math.PI);
          _bloodScale.set(s, s, s);

          heartRig.oxygenatedCurve.getPointAt(t, _bloodPos);
          _bloodMat.compose(_bloodPos, _bloodQuat, _bloodScale);
          heartRig.oxygenatedBloodMesh.setMatrixAt(i, _bloodMat);

          heartRig.deoxygenatedCurve.getPointAt(t, _bloodPos);
          _bloodMat.compose(_bloodPos, _bloodQuat, _bloodScale);
          heartRig.deoxygenatedBloodMesh.setMatrixAt(i, _bloodMat);
        }
        heartRig.oxygenatedBloodMesh.instanceMatrix.needsUpdate = true;
        heartRig.deoxygenatedBloodMesh.instanceMatrix.needsUpdate = true;

        // 5B. Full-Body Systemic & Pulmonary Blood Corpuscles
        if (vascularScopeRef.current === 'full_body') {
          const sysSpeed = (snap.bpm / 115) * (0.28 + arterialRecoil * 0.34);
          systemicBloodPhase = (systemicBloodPhase + dt * sysSpeed) % 1;

          if (showArteriesRef.current && bodyRig.arterialCurves.length > 0) {
            const artCount = bodyRig.arterialBloodMesh.count;
            const artCurves = bodyRig.arterialCurves;
            for (let i = 0; i < artCount; i++) {
              const curve = artCurves[i % artCurves.length];
              const offset = Math.floor(i / artCurves.length) / Math.ceil(artCount / artCurves.length);
              const t = (offset + systemicBloodPhase) % 1;
              const s = 0.72 + 0.38 * Math.sin(t * Math.PI) + arterialRecoil * 0.16;
              _bloodScale.set(s, s, s);
              curve.getPointAt(t, _bloodPos);
              _bloodMat.compose(_bloodPos, _bloodQuat, _bloodScale);
              bodyRig.arterialBloodMesh.setMatrixAt(i, _bloodMat);
            }
            bodyRig.arterialBloodMesh.instanceMatrix.needsUpdate = true;
          }

          if (showVeinsRef.current && bodyRig.venousCurves.length > 0) {
            const venCount = bodyRig.venousBloodMesh.count;
            const venCurves = bodyRig.venousCurves;
            for (let i = 0; i < venCount; i++) {
              const curve = venCurves[i % venCurves.length];
              const offset = Math.floor(i / venCurves.length) / Math.ceil(venCount / venCurves.length);
              const t = (offset + systemicBloodPhase * 0.85) % 1;
              const s = 0.68 + 0.35 * Math.sin(t * Math.PI);
              _bloodScale.set(s, s, s);
              curve.getPointAt(t, _bloodPos);
              _bloodMat.compose(_bloodPos, _bloodQuat, _bloodScale);
              bodyRig.venousBloodMesh.setMatrixAt(i, _bloodMat);
            }
            bodyRig.venousBloodMesh.instanceMatrix.needsUpdate = true;
          }
        }
      }

      // 6. Electrical Conduction Impulse Propagation
      const isXray = viewModeRef.current === 'conduction_xray';
      for (let i = 0; i < heartRig.conductionStages.length; i++) {
        const st = heartRig.conductionStages[i];
        const fire = pulseBell(cycle, st.activationStart, st.activationEnd);
        st.material.emissiveIntensity = (isXray ? 0.55 : 0.15) + fire * 3.5;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', onControlsStart);
      controls.dispose();

      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener(
        'webglcontextlost',
        onContextLost,
      );
      renderer.domElement.removeEventListener(
        'webglcontextrestored',
        onContextRestored,
      );

      heartRig.dispose();
      bodyRig.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      envTarget.dispose();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [telemetryRef]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#090e14]">
      <div ref={mountRef} className="h-full w-full" />
      {contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#090e14] p-6 text-center">
          <p className="font-display text-lg font-semibold text-slate-100">
            نمای سه‌بعدی در دسترس نیست
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            امکان راه‌اندازی WebGL وجود ندارد؛ پایش ضربان و هشدارها همچنان فعال است.
          </p>
        </div>
      )}
    </div>
  );
}
