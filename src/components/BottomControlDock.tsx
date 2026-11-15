import { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Eye,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AlertThresholds,
  CAMERA_PRESETS,
  CameraPresetId,
  MobileAlertEntry,
  SCENARIOS,
  ScenarioId,
  ViewModeId,
} from '../types/biometrics';

type DockTab = 'rhythm' | 'anatomy' | 'thresholds';

interface BottomControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  scenarioId: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  cameraPreset: CameraPresetId;
  onSelectCameraPreset: (id: CameraPresetId) => void;
  viewMode: ViewModeId;
  onSelectViewMode: (mode: ViewModeId) => void;
  showCoronaries: boolean;
  onToggleCoronaries: () => void;
  showWearablePatch: boolean;
  onToggleWearablePatch: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  thresholds: AlertThresholds;
  onChangeThresholds: (next: AlertThresholds) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onTriggerTestAlert: () => void;
  alertHistory: MobileAlertEntry[];
  onClearHistory: () => void;
}

export function BottomControlDock({
  collapsed,
  onToggleCollapse,
  scenarioId,
  onSelectScenario,
  cameraPreset,
  onSelectCameraPreset,
  viewMode,
  onSelectViewMode,
  showCoronaries,
  onToggleCoronaries,
  showWearablePatch,
  onToggleWearablePatch,
  autoRotate,
  onToggleAutoRotate,
  thresholds,
  onChangeThresholds,
  audioEnabled,
  onToggleAudio,
  onTriggerTestAlert,
  alertHistory,
  onClearHistory,
}: BottomControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('anatomy');
  const [showLogDrawer, setShowLogDrawer] = useState(false);

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-10 flex w-[min(920px,94vw)] -translate-x-1/2 flex-col items-center transition-transform duration-300 ease-out"
      style={{
        transform: collapsed
          ? 'translate(-50%, calc(100% - 36px))'
          : 'translate(-50%, 0)',
      }}
    >
      {/* Collapsible Mobile Alert Log Drawer */}
      {!collapsed && showLogDrawer && (
        <div
          className="pointer-events-auto mb-2 w-full max-w-xl rounded-xl border border-white/10 p-3.5 shadow-2xl"
          style={{ backgroundColor: 'rgba(11, 16, 22, 0.96)' }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-display text-xs font-semibold text-slate-100">
              Mobile Alert Dispatch Log ({alertHistory.length})
            </span>
            <div className="flex items-center gap-3">
              {alertHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs text-slate-400 transition-colors hover:text-slate-200"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLogDrawer(false)}
                className="text-xs font-medium text-teal-400 transition-colors hover:text-teal-300"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-2 max-h-44 overflow-y-auto pr-1">
            {alertHistory.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                No threshold alerts dispatched yet. Switch to Tachycardia or
                Bradycardia to test mobile push alerts.
              </p>
            ) : (
              <ul className="divide-y divide-white/8">
                {alertHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            entry.severity === 'critical'
                              ? 'text-rose-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {entry.severity === 'critical' ? 'Critical' : 'Warning'}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="truncate font-medium text-slate-100">
                          {entry.title}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-slate-400">
                        {entry.message}
                      </p>
                    </div>
                    <div className="shrink-0 text-right font-mono-tabular text-[11px] text-slate-400">
                      <div>{entry.timestamp}</div>
                      <div>
                        {entry.bpm} BPM · {entry.spo2}%
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Collapse / Expand Handle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Show Controls' : 'Hide Controls'}
        className="pointer-events-auto flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/10 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
        style={{ backgroundColor: 'rgba(11, 16, 22, 0.94)' }}
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {/* Main Dock Container */}
      <div
        className="pointer-events-auto w-full rounded-2xl border border-white/10 px-4 py-3 shadow-2xl"
        style={{ backgroundColor: 'rgba(11, 16, 22, 0.94)' }}
      >
        {/* Top Row: Segmented Tabs + Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2.5">
          <div
            className="flex items-center gap-1 rounded-lg bg-white/5 p-1"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'anatomy'}
              onClick={() => setActiveTab('anatomy')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'anatomy'
                  ? 'bg-teal-500 font-semibold text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              3D Anatomy &amp; Views
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'rhythm'}
              onClick={() => setActiveTab('rhythm')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'rhythm'
                  ? 'bg-teal-500 font-semibold text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              Cardiac Rhythm
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'thresholds'}
              onClick={() => setActiveTab('thresholds')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'thresholds'
                  ? 'bg-teal-500 font-semibold text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Alert Rules
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLogDrawer((v) => !v)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                showLogDrawer
                  ? 'border-teal-400/50 bg-teal-500/15 text-teal-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              Alert Log ({alertHistory.length})
            </button>

            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 whitespace-nowrap shrink-0"
            >
              Test Push
            </button>

            <button
              type="button"
              onClick={onToggleAudio}
              aria-label={
                audioEnabled ? 'Mute heartbeat audio' : 'Unmute heartbeat audio'
              }
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                audioEnabled
                  ? 'border-teal-400/50 bg-teal-500/15 text-teal-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {audioEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
              <span>{audioEnabled ? 'Sound On' : 'Muted'}</span>
            </button>
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="pt-2.5">
          {activeTab === 'anatomy' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* View Modes: Solid, Conduction X-Ray, Exploded Chambers */}
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'anatomical', label: 'Anatomical' },
                    { id: 'conduction_xray', label: 'Conduction X-Ray' },
                    { id: 'exploded', label: 'Exploded Chambers' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectViewMode(m.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      viewMode === m.id
                        ? 'border-teal-400/70 bg-teal-500/20 text-teal-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Camera Angles */}
              <div className="flex items-center gap-1">
                {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectCameraPreset(id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      cameraPreset === id
                        ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {CAMERA_PRESETS[id].label}
                  </button>
                ))}
              </div>

              {/* Layer Toggles */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onToggleCoronaries}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showCoronaries
                      ? 'border-rose-400/60 bg-rose-500/15 text-rose-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Coronaries
                </button>
                <button
                  type="button"
                  onClick={onToggleWearablePatch}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showWearablePatch
                      ? 'border-teal-400/60 bg-teal-500/15 text-teal-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Sensor Patch
                </button>
                <button
                  type="button"
                  onClick={onToggleAutoRotate}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    autoRotate
                      ? 'border-teal-400/60 bg-teal-500/15 text-teal-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  Auto-Orbit
                </button>
              </div>
            </div>
          )}

          {activeTab === 'rhythm' && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
                  const s = SCENARIOS[id];
                  const active = scenarioId === id;
                  const isAlertScenario =
                    id === 'elevated_hr' || id === 'bradycardia';

                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectScenario(id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? isAlertScenario
                            ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                            : 'border-teal-400/70 bg-teal-500/20 text-teal-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-slate-400">
                {SCENARIOS[scenarioId].description}
              </span>
            </div>
          )}

          {activeTab === 'thresholds' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    Low Heart Rate
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Alert below ceiling
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={65}
                    max={110}
                    step={5}
                    value={thresholds.lowBpm}
                    onChange={(e) =>
                      onChangeThresholds({
                        ...thresholds,
                        lowBpm: Number(e.target.value),
                      })
                    }
                    className="studio-slider w-20"
                  />
                  <span className="font-mono-tabular w-10 text-right text-xs font-semibold text-teal-300">
                    {thresholds.lowBpm}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    High Heart Rate
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Alert above ceiling
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={150}
                    max={200}
                    step={5}
                    value={thresholds.highBpm}
                    onChange={(e) =>
                      onChangeThresholds({
                        ...thresholds,
                        highBpm: Number(e.target.value),
                      })
                    }
                    className="studio-slider w-20"
                  />
                  <span className="font-mono-tabular w-10 text-right text-xs font-semibold text-amber-300">
                    {thresholds.highBpm}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/5 px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-slate-200">
                    Minimum SpO2
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Critical desaturation
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={86}
                    max={96}
                    step={1}
                    value={thresholds.minSpo2}
                    onChange={(e) =>
                      onChangeThresholds({
                        ...thresholds,
                        minSpo2: Number(e.target.value),
                      })
                    }
                    className="studio-slider w-20"
                  />
                  <span className="font-mono-tabular w-10 text-right text-xs font-semibold text-sky-300">
                    {thresholds.minSpo2}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
