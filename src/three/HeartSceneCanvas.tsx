import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AnatomyPartId,
  CAMERA_PRESETS,
  CameraPresetId,
  TelemetrySnapshot,
  ViewModeId,
} from '../types/biometrics';
import { buildPediatricHeartRig } from './heartAnatomy';

interface HeartSceneCanvasProps {
  telemetryRef: React.MutableRefObject<TelemetrySnapshot>;
  cameraPreset: CameraPresetId;
  viewMode: ViewModeId;
  showCoronaries: boolean;
  showWearablePatch: boolean;
  autoRotate: boolean;
  selectedPart: AnatomyPartId | null;
  onSelectPart: (part: AnatomyPartId | null) => void;
}

// Pre-allocated scratch math objects (zero GC in animation loop)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _restScale = new THREE.Vector3(1, 1, 1);

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
  cameraPreset,
  viewMode,
  showCoronaries,
  showWearablePatch,
  autoRotate,
  selectedPart,
  onSelectPart,
}: HeartSceneCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const activePresetRef = useRef<CameraPresetId>(cameraPreset);
  const transitionActiveRef = useRef(false);
  const viewModeRef = useRef<ViewModeId>(viewMode);
  const showCoronariesRef = useRef(showCoronaries);
  const showWearablePatchRef = useRef(showWearablePatch);
  const autoRotateRef = useRef(autoRotate);
  const selectedPartRef = useRef<AnatomyPartId | null>(selectedPart);

  const onSelectPartRef = useRef(onSelectPart);
  onSelectPartRef.current = onSelectPart;

  const rigActionsRef = useRef<{
    setXrayMode: (x: boolean) => void;
    setShowCoronaries: (s: boolean) => void;
    setShowWearablePatch: (s: boolean) => void;
    setHighlightedPart: (p: AnatomyPartId | null) => void;
  } | null>(null);

  useEffect(() => {
    activePresetRef.current = cameraPreset;
    transitionActiveRef.current = true;
  }, [cameraPreset]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    rigActionsRef.current?.setXrayMode(viewMode === 'conduction_xray');
  }, [viewMode]);

  useEffect(() => {
    showCoronariesRef.current = showCoronaries;
    rigActionsRef.current?.setShowCoronaries(showCoronaries);
  }, [showCoronaries]);

  useEffect(() => {
    showWearablePatchRef.current = showWearablePatch;
    rigActionsRef.current?.setShowWearablePatch(showWearablePatch);
  }, [showWearablePatch]);

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
    renderer.toneMappingExposure = 1.12;
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
    const bgHex = 0x0b1016;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.052);

    // Mandatory Studio Environment Reflections (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 45);
    const initPreset = CAMERA_PRESETS[activePresetRef.current];
    camera.position.set(...initPreset.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 1.4;
    controls.maxDistance = 6.5;
    controls.maxPolarAngle = Math.PI * 0.72;
    controls.minPolarAngle = 0.15;
    controls.autoRotateSpeed = 0.75;
    controls.update();

    const onControlsStart = () => {
      transitionActiveRef.current = false;
    };
    controls.addEventListener('start', onControlsStart);

    // 3-Point Anatomical Studio Lighting Rig (warm surgical key + cool fill + rim)
    const hemiLight = new THREE.HemisphereLight(0xc2dcf5, 0x1a151b, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0e0, 2.4);
    keyLight.position.set(2.6, 3.8, 3.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    const d = 2.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x88ccff, 1.15);
    rimLight.position.set(-2.8, 1.8, -2.6);
    scene.add(rimLight);

    const underFillLight = new THREE.PointLight(0xffb4b4, 0.45, 5, 2);
    underFillLight.position.set(0.4, -0.9, 1.4);
    scene.add(underFillLight);

    // Subtle dark clinical floor plane beneath pedestal
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1016,
      roughness: 0.92,
      metalness: 0.04,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.17;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Build Composite Anatomical Pediatric Heart Rig
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const heartRig = buildPediatricHeartRig(maxAnisotropy, isSoftwareGl);
    scene.add(heartRig.root);

    rigActionsRef.current = {
      setXrayMode: heartRig.setXrayMode,
      setShowCoronaries: heartRig.setShowCoronaries,
      setShowWearablePatch: heartRig.setShowWearablePatch,
      setHighlightedPart: heartRig.setHighlightedPart,
    };
    heartRig.setXrayMode(viewModeRef.current === 'conduction_xray');
    heartRig.setShowCoronaries(showCoronariesRef.current);
    heartRig.setShowWearablePatch(showWearablePatchRef.current);
    heartRig.setHighlightedPart(selectedPartRef.current);

    // Layer-1 Throttled Raycasting for Anatomical Part Inspection
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

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
      const hits = raycaster.intersectObjects(heartRig.hitProxies, false);
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
      const hits = raycaster.intersectObjects(heartRig.hitProxies, false);
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

      // 1. Damped Camera Preset Transition
      if (transitionActiveRef.current) {
        const preset = CAMERA_PRESETS[activePresetRef.current];
        _camGoalPos.set(...preset.position);
        _camGoalTarget.set(...preset.target);

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

      // 2. Smooth Exploded-View Chamber Separation
      const explodeGoal = viewModeRef.current === 'exploded' ? 1.0 : 0.0;
      currentExplode = THREE.MathUtils.damp(currentExplode, explodeGoal, 7.0, dt);
      for (let i = 0; i < heartRig.explodeItems.length; i++) {
        const item = heartRig.explodeItems[i];
        item.object.position
          .copy(item.restPos)
          .addScaledVector(item.explodeOffset, currentExplode);
      }

      // 3. Physiological Two-Phase Cardiac Biomechanics (Atrial Systole -> Ventricular Systole)
      const atrialSqueeze = pulseBell(cycle, 0.05, 0.22);
      const ventSqueeze = Math.pow(pulseBell(cycle, 0.25, 0.54), 1.25);
      const arterialRecoil = pulseBell(cycle, 0.3, 0.6);

      // Gentle breathing / suspension micro-motion
      heartRig.heartPivot.position.y = 0.06 + Math.sin(elapsed * 1.4) * 0.012;

      // Atrial contraction (P-wave)
      const aRad = 1.0 - atrialSqueeze * 0.095;
      const aVert = 1.0 - atrialSqueeze * 0.06;
      heartRig.rightAtriumGroup.scale.set(aRad, aVert, aRad);
      heartRig.leftAtriumGroup.scale.set(aRad, aVert, aRad);

      // Ventricular systolic squeeze + apical longitudinal shortening + physiological torsion
      const lvRad = 1.0 - ventSqueeze * 0.115;
      const lvVert = 1.0 - ventSqueeze * 0.055;
      const rvRad = 1.0 - ventSqueeze * 0.1;
      const rvVert = 1.0 - ventSqueeze * 0.048;

      heartRig.leftVentricleGroup.scale.set(lvRad, lvVert, lvRad);
      heartRig.rightVentricleGroup.scale.set(rvRad, rvVert, rvRad);

      // Subtle epicardial coronary compliance during ventricular systole
      heartRig.coronaryGroup.scale.set(
        1.0 - ventSqueeze * 0.085,
        1.0 - ventSqueeze * 0.042,
        1.0 - ventSqueeze * 0.085,
      );

      // Physiological systolic wringing torsion around long axis
      heartRig.heartPivot.rotation.y = -0.08 + ventSqueeze * 0.055;
      heartRig.heartPivot.rotation.z = -0.08 + ventSqueeze * 0.025;

      // Great vessels systolic distension during blood ejection
      const vesselExpand = 1.0 + arterialRecoil * 0.055;
      heartRig.aortaGroup.scale.set(vesselExpand, 1.0 + arterialRecoil * 0.02, vesselExpand);
      heartRig.pulmonaryGroup.scale.set(vesselExpand, 1.0 + arterialRecoil * 0.02, vesselExpand);
      heartRig.venaCavaGroup.scale.lerp(_restScale, 0.2);

      // 4. Electrical Conduction Impulse Propagation (SA -> AV -> His -> Purkinje)
      const isXray = viewModeRef.current === 'conduction_xray';
      for (let i = 0; i < heartRig.conductionStages.length; i++) {
        const st = heartRig.conductionStages[i];
        const fire = pulseBell(cycle, st.activationStart, st.activationEnd);
        st.material.emissiveIntensity = (isXray ? 0.55 : 0.15) + fire * 3.4;
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
    <div className="relative h-full w-full overflow-hidden bg-[#0b1016]">
      <div ref={mountRef} className="h-full w-full" />
      {contextLost && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0b1016] p-6 text-center">
          <p className="font-display text-lg font-semibold text-slate-100">
            3D Cardiac Viewport Unavailable
          </p>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            WebGL rendering could not be initialized. Biometric ECG telemetry and
            mobile alerts remain active.
          </p>
        </div>
      )}
    </div>
  );
}
