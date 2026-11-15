import { useCallback, useEffect, useRef, useState } from 'react';
import { alertAudio } from './audio/alertAudio';
import { BottomControlDock } from './components/BottomControlDock';
import { TopHud } from './components/TopHud';
import { HeartSceneCanvas } from './three/HeartSceneCanvas';
import {
  AlertSeverity,
  AlertThresholds,
  AnatomyPartId,
  CameraPresetId,
  CardiacPhase,
  MobileAlertEntry,
  SCENARIOS,
  ScenarioId,
  TelemetrySnapshot,
  ViewModeId,
} from './types/biometrics';

const ECG_LENGTH = 68;

// Synthesize physiological P-QRS-T cardiac waveform across cycle phase [0..1]
function samplePediatricEcg(phase: number): number {
  const p = phase % 1;
  // P wave (Atrial depolarization: 0.06..0.18)
  const pWave = 0.14 * Math.exp(-Math.pow((p - 0.12) / 0.032, 2));
  // Q dip
  const qDip = -0.14 * Math.exp(-Math.pow((p - 0.235) / 0.012, 2));
  // R spike (Ventricular depolarization: ~0.27)
  const rSpike = 1.02 * Math.exp(-Math.pow((p - 0.27) / 0.014, 2));
  // S dip
  const sDip = -0.22 * Math.exp(-Math.pow((p - 0.305) / 0.014, 2));
  // T wave (Ventricular repolarization: 0.48..0.64)
  const tWave = 0.26 * Math.exp(-Math.pow((p - 0.54) / 0.055, 2));

  return pWave + qDip + rSpike + sDip + tWave;
}

function getCardiacPhaseLabel(phase: number): CardiacPhase {
  const p = phase % 1;
  if (p >= 0.05 && p < 0.23) return 'Atrial Systole';
  if (p >= 0.23 && p < 0.55) return 'Ventricular Systole';
  return 'Diastole';
}

function evaluateSeverity(
  bpm: number,
  spo2: number,
  thresholds: AlertThresholds,
  forcedTestAlert: boolean,
): {
  severity: AlertSeverity;
  title: string | null;
  body: string | null;
} {
  if (forcedTestAlert) {
    return {
      severity: 'warning',
      title: 'Test Mobile Push Alert',
      body: 'Parent mobile push notification channel verified.',
    };
  }
  if (spo2 < thresholds.minSpo2) {
    return {
      severity: 'critical',
      title: `Low Blood Oxygen (${spo2}% SpO2)`,
      body: `Saturation dropped below ${thresholds.minSpo2}% threshold.`,
    };
  }
  if (bpm < thresholds.lowBpm) {
    return {
      severity: 'critical',
      title: `Pediatric Bradycardia (${bpm} BPM)`,
      body: `Heart rate fell below ${thresholds.lowBpm} BPM threshold.`,
    };
  }
  if (bpm > thresholds.highBpm) {
    return {
      severity: 'warning',
      title: `Pediatric Tachycardia (${bpm} BPM)`,
      body: `Heart rate exceeded ${thresholds.highBpm} BPM threshold.`,
    };
  }
  return { severity: 'normal', title: null, body: null };
}

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('deep_sleep');
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('anterior');
  const [viewMode, setViewMode] = useState<ViewModeId>('anatomical');
  const [showCoronaries, setShowCoronaries] = useState(true);
  const [showWearablePatch, setShowWearablePatch] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedPart, setSelectedPart] = useState<AnatomyPartId | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [isAlertAcknowledged, setIsAlertAcknowledged] = useState(false);
  const [alertHistory, setAlertHistory] = useState<MobileAlertEntry[]>([]);
  const [thresholds, setThresholds] = useState<AlertThresholds>({
    lowBpm: 90,
    highBpm: 165,
    minSpo2: 92,
  });

  const initCfg = SCENARIOS.deep_sleep;
  const initialSnapshot: TelemetrySnapshot = {
    bpm: initCfg.targetBpm,
    spo2: initCfg.targetSpo2,
    skinTempC: initCfg.skinTempC,
    rhythmLabel: initCfg.rhythmLabel,
    cardiacPhase: 'Diastole',
    cardiacCyclePhase: 0,
    severity: 'normal',
    activeAlertTitle: null,
    activeAlertBody: null,
    ecgWave: Array.from({ length: ECG_LENGTH }, (_, i) =>
      samplePediatricEcg(i / ECG_LENGTH),
    ),
  };

  const telemetryRef = useRef<TelemetrySnapshot>(initialSnapshot);
  const [hudSnapshot, setHudSnapshot] =
    useState<TelemetrySnapshot>(initialSnapshot);

  const scenarioRef = useRef(scenarioId);
  scenarioRef.current = scenarioId;
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;
  const testAlertExpiryRef = useRef(0);
  const lastDispatchedKeyRef = useRef<string | null>(null);
  const phaseRef = useRef(0);
  const lastBeatIndexRef = useRef(0);

  // 'H' shortcut to hide/show bottom control dock
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      alertAudio.dispose();
    };
  }, []);

  const dispatchMobileAlert = useCallback(
    (
      severity: Exclude<AlertSeverity, 'normal'>,
      title: string,
      message: string,
      bpm: number,
      spo2: number,
      forceSound = false,
    ) => {
      const entry: MobileAlertEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        severity,
        title,
        message,
        bpm,
        spo2,
        acknowledged: false,
      };
      setIsAlertAcknowledged(false);
      setAlertHistory((prev) => [entry, ...prev].slice(0, 25));
      alertAudio.playAlertTone(severity, forceSound);
    },
    [],
  );

  // Continuous physiological cardiac & ECG simulation (30ms step for smooth QRS spike)
  useEffect(() => {
    let smoothBpm = SCENARIOS[scenarioRef.current].targetBpm;
    let smoothSpo2 = SCENARIOS[scenarioRef.current].targetSpo2;
    let smoothTemp = SCENARIOS[scenarioRef.current].skinTempC;
    let uiSyncCounter = 0;

    const timer = window.setInterval(() => {
      const dt = 0.03;
      const cfg = SCENARIOS[scenarioRef.current];

      const jitter =
        Math.sin(performance.now() * 0.0019) * cfg.bpmJitter +
        (cfg.irregularity > 0
          ? Math.sin(performance.now() * 0.0053) * 10 * cfg.irregularity
          : 0);

      smoothBpm += (cfg.targetBpm + jitter - smoothBpm) * 0.12;
      smoothSpo2 += (cfg.targetSpo2 - smoothSpo2) * 0.12;
      smoothTemp += (cfg.skinTempC - smoothTemp) * 0.08;

      const displayBpm = Math.max(40, Math.round(smoothBpm));
      const displaySpo2 = Math.round(smoothSpo2);

      // Advance cardiac phase
      const pacBoost =
        cfg.irregularity > 0.3 &&
        Math.sin(performance.now() * 0.0041) > 0.85
          ? 1.38
          : 1.0;

      phaseRef.current += dt * (displayBpm / 60) * pacBoost;
      const cyclePhase = phaseRef.current % 1;
      const beatIdx = Math.floor(phaseRef.current);
      if (beatIdx !== lastBeatIndexRef.current) {
        lastBeatIndexRef.current = beatIdx;
        if (telemetryRef.current.severity === 'normal') {
          alertAudio.playHeartbeatTick(displayBpm);
        }
      }

      const ecgSample = samplePediatricEcg(cyclePhase);
      const nextWave = [...telemetryRef.current.ecgWave.slice(1), ecgSample];

      const forcedTest = performance.now() < testAlertExpiryRef.current;
      const evaluation = evaluateSeverity(
        displayBpm,
        displaySpo2,
        thresholdsRef.current,
        forcedTest,
      );

      if (evaluation.severity !== 'normal' && evaluation.title) {
        const alertKey = `${scenarioRef.current}:${evaluation.severity}:${forcedTest ? 'test' : 'auto'}`;
        if (lastDispatchedKeyRef.current !== alertKey) {
          lastDispatchedKeyRef.current = alertKey;
          dispatchMobileAlert(
            evaluation.severity,
            evaluation.title,
            evaluation.body ?? '',
            displayBpm,
            displaySpo2,
          );
        }
      } else {
        lastDispatchedKeyRef.current = null;
      }

      const updated: TelemetrySnapshot = {
        bpm: displayBpm,
        spo2: displaySpo2,
        skinTempC: smoothTemp,
        rhythmLabel: cfg.rhythmLabel,
        cardiacPhase: getCardiacPhaseLabel(cyclePhase),
        cardiacCyclePhase: cyclePhase,
        severity: evaluation.severity,
        activeAlertTitle: evaluation.title,
        activeAlertBody: evaluation.body,
        ecgWave: nextWave,
      };

      telemetryRef.current = updated;

      uiSyncCounter++;
      if (uiSyncCounter % 2 === 0) {
        setHudSnapshot(updated);
      }
    }, 30);

    return () => window.clearInterval(timer);
  }, [dispatchMobileAlert]);

  const handleSelectScenario = (id: ScenarioId) => {
    alertAudio.playClick();
    testAlertExpiryRef.current = 0;
    lastDispatchedKeyRef.current = null;
    setScenarioId(id);
  };

  const handleSelectCameraPreset = (id: CameraPresetId) => {
    alertAudio.playClick();
    setCameraPreset(id);
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    alertAudio.setEnabled(next);
    setAudioEnabled(next);
  };

  const handleTriggerTestAlert = () => {
    testAlertExpiryRef.current = performance.now() + 6500;
    lastDispatchedKeyRef.current = 'manual-test';
    dispatchMobileAlert(
      'warning',
      'Test Mobile Push Alert',
      'Parent mobile push notification channel verified.',
      telemetryRef.current.bpm,
      telemetryRef.current.spo2,
      true,
    );
  };

  const handleAcknowledgeAlert = () => {
    alertAudio.playClick();
    testAlertExpiryRef.current = 0;
    setIsAlertAcknowledged(true);
    setAlertHistory((prev) =>
      prev.map((item, idx) =>
        idx === 0 ? { ...item, acknowledged: true } : item,
      ),
    );
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1016]">
      {/* Dedicated Full-Bleed Three.js Anatomical Heart Viewport */}
      <HeartSceneCanvas
        telemetryRef={telemetryRef}
        cameraPreset={cameraPreset}
        viewMode={viewMode}
        showCoronaries={showCoronaries}
        showWearablePatch={showWearablePatch}
        autoRotate={autoRotate}
        selectedPart={selectedPart}
        onSelectPart={(part) => {
          alertAudio.playClick();
          setSelectedPart(part);
        }}
      />

      {/* Non-occluding Top Cardiac Telemetry HUD & Anatomical Part Inspector */}
      <TopHud
        snapshot={hudSnapshot}
        telemetryRef={telemetryRef}
        selectedPart={selectedPart}
        onClearPart={() => {
          alertAudio.playClick();
          setSelectedPart(null);
        }}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        isAlertAcknowledged={isAlertAcknowledged}
      />

      {/* Unified Collapsible Bottom Control Dock */}
      <BottomControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => {
          alertAudio.playClick();
          setDockCollapsed((c) => !c);
        }}
        scenarioId={scenarioId}
        onSelectScenario={handleSelectScenario}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        viewMode={viewMode}
        onSelectViewMode={(mode) => {
          alertAudio.playClick();
          setViewMode(mode);
        }}
        showCoronaries={showCoronaries}
        onToggleCoronaries={() => {
          alertAudio.playClick();
          setShowCoronaries((v) => !v);
        }}
        showWearablePatch={showWearablePatch}
        onToggleWearablePatch={() => {
          alertAudio.playClick();
          setShowWearablePatch((v) => !v);
        }}
        autoRotate={autoRotate}
        onToggleAutoRotate={() => {
          alertAudio.playClick();
          setAutoRotate((v) => !v);
        }}
        thresholds={thresholds}
        onChangeThresholds={setThresholds}
        audioEnabled={audioEnabled}
        onToggleAudio={handleToggleAudio}
        onTriggerTestAlert={handleTriggerTestAlert}
        alertHistory={alertHistory}
        onClearHistory={() => {
          alertAudio.playClick();
          setAlertHistory([]);
        }}
      />
    </main>
  );
}
