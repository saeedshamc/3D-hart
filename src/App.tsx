import { useCallback, useEffect, useRef, useState } from 'react';
import { alertAudio } from './audio/alertAudio';
import { BottomControlDock } from './components/BottomControlDock';
import { TopHud } from './components/TopHud';
import { HeartSceneCanvas } from './three/HeartSceneCanvas';
import {
  ANATOMY_PARTS,
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

function samplePediatricEcg(phase: number): number {
  const p = phase % 1;
  const pWave = 0.14 * Math.exp(-Math.pow((p - 0.12) / 0.032, 2));
  const qDip = -0.14 * Math.exp(-Math.pow((p - 0.235) / 0.012, 2));
  const rSpike = 1.02 * Math.exp(-Math.pow((p - 0.27) / 0.014, 2));
  const sDip = -0.22 * Math.exp(-Math.pow((p - 0.305) / 0.014, 2));
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
): {
  severity: AlertSeverity;
  title: string | null;
  body: string | null;
} {
  if (spo2 < thresholds.minSpo2) {
    return {
      severity: 'critical',
      title: `افت اکسیژن خون (${spo2}% SpO2)`,
      body: `سطح اکسیژن به زیر آستانه ${thresholds.minSpo2}% رسیده است.`,
    };
  }
  if (bpm < thresholds.lowBpm) {
    return {
      severity: 'critical',
      title: `کاهش شدید ضربان (${bpm} BPM)`,
      body: `ضربان قلب کودک از آستانه ${thresholds.lowBpm} کمتر شده است.`,
    };
  }
  if (bpm > thresholds.highBpm) {
    return {
      severity: 'warning',
      title: `افزایش ضربان قلب (${bpm} BPM)`,
      body: `ضربان قلب کودک از سقف مجاز ${thresholds.highBpm} فراتر رفته است.`,
    };
  }
  return { severity: 'normal', title: null, body: null };
}

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('deep_sleep');
  const [manualBpm, setManualBpm] = useState<number | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('anterior');
  const [viewMode, setViewMode] = useState<ViewModeId>('anatomical');
  const [explodeFactor, setExplodeFactor] = useState<number>(0);
  const [showCoronaries, setShowCoronaries] = useState(true);
  const [showBloodFlow, setShowBloodFlow] = useState(true);
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
  const manualBpmRef = useRef(manualBpm);
  manualBpmRef.current = manualBpm;
  const playbackSpeedRef = useRef(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

  const lastDispatchedKeyRef = useRef<string | null>(null);
  const phaseRef = useRef(0);
  const lastBeatIndexRef = useRef(0);

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
      alertAudio.playAlertTone(severity, false);
    },
    [],
  );

  // Continuous physiological cardiac & ECG simulation scaled by playbackSpeed & manualBpm
  useEffect(() => {
    let smoothBpm = SCENARIOS[scenarioRef.current].targetBpm;
    let smoothSpo2 = SCENARIOS[scenarioRef.current].targetSpo2;
    let smoothTemp = SCENARIOS[scenarioRef.current].skinTempC;
    let uiSyncCounter = 0;

    const timer = window.setInterval(() => {
      const dt = 0.03 * playbackSpeedRef.current;
      const cfg = SCENARIOS[scenarioRef.current];
      const overrideBpm = manualBpmRef.current;

      const targetBpm = overrideBpm !== null ? overrideBpm : cfg.targetBpm;
      const jitter =
        overrideBpm !== null
          ? Math.sin(performance.now() * 0.0019) * 1.5
          : Math.sin(performance.now() * 0.0019) * cfg.bpmJitter +
            (cfg.irregularity > 0
              ? Math.sin(performance.now() * 0.0053) * 10 * cfg.irregularity
              : 0);

      smoothBpm += (targetBpm + jitter - smoothBpm) * 0.16;
      smoothSpo2 += (cfg.targetSpo2 - smoothSpo2) * 0.12;
      smoothTemp += (cfg.skinTempC - smoothTemp) * 0.08;

      const displayBpm = Math.max(40, Math.round(smoothBpm));
      const displaySpo2 = Math.round(smoothSpo2);

      const pacBoost =
        overrideBpm === null &&
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

      const evaluation = evaluateSeverity(
        displayBpm,
        displaySpo2,
        thresholdsRef.current,
      );

      if (evaluation.severity !== 'normal' && evaluation.title) {
        const alertKey = `${overrideBpm !== null ? 'manual' : scenarioRef.current}:${evaluation.severity}`;
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

      const rhythmLabel =
        overrideBpm !== null
          ? overrideBpm > thresholdsRef.current.highBpm
            ? 'کنترل دستی · تاکیکاردی'
            : overrideBpm < thresholdsRef.current.lowBpm
              ? 'کنترل دستی · برادیکاردی'
              : 'کنترل دستی · سینوسی'
          : cfg.rhythmLabel;

      const updated: TelemetrySnapshot = {
        bpm: displayBpm,
        spo2: displaySpo2,
        skinTempC: smoothTemp,
        rhythmLabel,
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

  const handleSelectPart = (part: AnatomyPartId | null) => {
    alertAudio.playClick();
    setSelectedPart(part);
    if (part) {
      const info = ANATOMY_PARTS[part];
      setExplodeFactor(info.autoExplode);
      setViewMode(info.autoXray ? 'conduction_xray' : 'anatomical');
    } else {
      setExplodeFactor(0);
      setViewMode('anatomical');
    }
  };

  const handleSelectViewMode = (mode: ViewModeId) => {
    alertAudio.playClick();
    setViewMode(mode);
    if (mode === 'exploded') {
      setExplodeFactor(0.9);
    } else if (selectedPart === null) {
      setExplodeFactor(0);
    }
  };

  const handleToggleAudio = () => {
    const next = !audioEnabled;
    alertAudio.setEnabled(next);
    setAudioEnabled(next);
  };

  const handleAcknowledgeAlert = () => {
    alertAudio.playClick();
    setIsAlertAcknowledged(true);
    setAlertHistory((prev) =>
      prev.map((item, idx) =>
        idx === 0 ? { ...item, acknowledged: true } : item,
      ),
    );
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0b1016]">
      <HeartSceneCanvas
        telemetryRef={telemetryRef}
        cameraPreset={cameraPreset}
        viewMode={viewMode}
        explodeFactor={explodeFactor}
        showCoronaries={showCoronaries}
        showWearablePatch={showWearablePatch}
        showBloodFlow={showBloodFlow}
        autoRotate={autoRotate}
        selectedPart={selectedPart}
        onSelectPart={handleSelectPart}
      />

      <TopHud
        snapshot={hudSnapshot}
        telemetryRef={telemetryRef}
        selectedPart={selectedPart}
        onClearPart={() => handleSelectPart(null)}
        onAcknowledgeAlert={handleAcknowledgeAlert}
        isAlertAcknowledged={isAlertAcknowledged}
      />

      <BottomControlDock
        collapsed={dockCollapsed}
        onToggleCollapse={() => {
          alertAudio.playClick();
          setDockCollapsed((c) => !c);
        }}
        selectedPart={selectedPart}
        onSelectPart={handleSelectPart}
        explodeFactor={explodeFactor}
        onChangeExplode={(val) => {
          setExplodeFactor(val);
          if (val > 0.1 && viewMode === 'anatomical') {
            setViewMode('exploded');
          } else if (val <= 0.05 && viewMode === 'exploded') {
            setViewMode('anatomical');
          }
        }}
        scenarioId={scenarioId}
        onSelectScenario={(id) => {
          alertAudio.playClick();
          lastDispatchedKeyRef.current = null;
          setScenarioId(id);
        }}
        manualBpm={manualBpm}
        currentBpm={hudSnapshot.bpm}
        onChangeManualBpm={(bpm) => {
          lastDispatchedKeyRef.current = null;
          setManualBpm(bpm);
        }}
        playbackSpeed={playbackSpeed}
        onChangePlaybackSpeed={(sp) => {
          alertAudio.playClick();
          setPlaybackSpeed(sp);
        }}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={(preset) => {
          alertAudio.playClick();
          setSelectedPart(null);
          setExplodeFactor(0);
          setViewMode('anatomical');
          setCameraPreset(preset);
        }}
        viewMode={viewMode}
        onSelectViewMode={handleSelectViewMode}
        showCoronaries={showCoronaries}
        onToggleCoronaries={() => {
          alertAudio.playClick();
          setShowCoronaries((v) => !v);
        }}
        showBloodFlow={showBloodFlow}
        onToggleBloodFlow={() => {
          alertAudio.playClick();
          setShowBloodFlow((v) => !v);
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
        alertHistory={alertHistory}
        onClearHistory={() => {
          alertAudio.playClick();
          setAlertHistory([]);
        }}
      />
    </main>
  );
}
