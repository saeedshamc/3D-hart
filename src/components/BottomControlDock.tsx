import { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  Heart,
  Minus,
  Plus,
  Sliders,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ANATOMY_PARTS,
  AlertThresholds,
  AnatomyPartId,
  CAMERA_PRESETS_BY_SCOPE,
  CameraPresetId,
  MobileAlertEntry,
  SCENARIOS,
  ScenarioId,
  VascularScopeId,
  ViewModeId,
} from '../types/biometrics';

type DockTab = 'functions' | 'bpm' | 'view';

interface BottomControlDockProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  vascularScope: VascularScopeId;
  onChangeScope: (scope: VascularScopeId) => void;
  selectedPart: AnatomyPartId | null;
  onSelectPart: (part: AnatomyPartId | null) => void;
  explodeFactor: number;
  onChangeExplode: (val: number) => void;
  scenarioId: ScenarioId;
  onSelectScenario: (id: ScenarioId) => void;
  manualBpm: number | null;
  currentBpm: number;
  onChangeManualBpm: (bpm: number | null) => void;
  playbackSpeed: number;
  onChangePlaybackSpeed: (speed: number) => void;
  cameraPreset: CameraPresetId;
  onSelectCameraPreset: (id: CameraPresetId) => void;
  viewMode: ViewModeId;
  onSelectViewMode: (mode: ViewModeId) => void;
  showCoronaries: boolean;
  onToggleCoronaries: () => void;
  showBloodFlow: boolean;
  onToggleBloodFlow: () => void;
  showWearablePatch: boolean;
  onToggleWearablePatch: () => void;
  showArteries: boolean;
  onToggleArteries: () => void;
  showVeins: boolean;
  onToggleVeins: () => void;
  showBodySilhouette: boolean;
  onToggleBodySilhouette: () => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  thresholds: AlertThresholds;
  onChangeThresholds: (next: AlertThresholds) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  alertHistory: MobileAlertEntry[];
  onClearHistory: () => void;
}

const HEART_PART_ORDER: AnatomyPartId[] = [
  'cardiac_valves',
  'left_ventricle',
  'right_ventricle',
  'left_atrium',
  'right_atrium',
  'aorta',
  'pulmonary_trunk',
  'coronary_vessels',
  'conduction_system',
];

const VASCULAR_REGION_ORDER: AnatomyPartId[] = [
  'brain_carotid',
  'pulmonary_loop',
  'upper_limbs',
  'hands_fingers',
  'renal_visceral',
  'lower_limbs',
];

export function BottomControlDock({
  collapsed,
  onToggleCollapse,
  vascularScope,
  onChangeScope,
  selectedPart,
  onSelectPart,
  explodeFactor,
  onChangeExplode,
  scenarioId,
  onSelectScenario,
  manualBpm,
  currentBpm,
  onChangeManualBpm,
  playbackSpeed,
  onChangePlaybackSpeed,
  cameraPreset,
  onSelectCameraPreset,
  viewMode,
  onSelectViewMode,
  showCoronaries,
  onToggleCoronaries,
  showBloodFlow,
  onToggleBloodFlow,
  showWearablePatch,
  onToggleWearablePatch,
  showArteries,
  onToggleArteries,
  showVeins,
  onToggleVeins,
  showBodySilhouette,
  onToggleBodySilhouette,
  autoRotate,
  onToggleAutoRotate,
  thresholds,
  onChangeThresholds,
  audioEnabled,
  onToggleAudio,
  alertHistory,
  onClearHistory,
}: BottomControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('functions');
  const [showLogDrawer, setShowLogDrawer] = useState(false);

  const effectiveBpm = manualBpm ?? currentBpm;
  const presetsForScope = CAMERA_PRESETS_BY_SCOPE[vascularScope];

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-10 flex w-[min(1020px,96vw)] -translate-x-1/2 flex-col items-center transition-transform duration-300 ease-out"
      style={{
        transform: collapsed
          ? 'translate(-50%, calc(100% - 34px))'
          : 'translate(-50%, 0)',
      }}
    >
      {/* Collapsible Mobile Alert Log Drawer */}
      {!collapsed && showLogDrawer && (
        <div
          dir="rtl"
          className="pointer-events-auto mb-2 w-full max-w-xl rounded-2xl border border-white/10 p-3.5 shadow-2xl"
          style={{ backgroundColor: 'rgba(11, 16, 23, 0.96)' }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-display text-xs font-semibold text-slate-100">
              گزارش هشدارهای موبایل ({alertHistory.length})
            </span>
            <div className="flex items-center gap-3">
              {alertHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs text-slate-400 transition-colors hover:text-slate-200"
                >
                  پاک‌کردن
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowLogDrawer(false)}
                className="text-xs font-medium text-teal-400 transition-colors hover:text-teal-300"
              >
                بستن
              </button>
            </div>
          </div>

          <div className="mt-2 max-h-44 overflow-y-auto pr-1">
            {alertHistory.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                هنوز هشداری ثبت نشده است. با افزایش یا کاهش ضربان از آستانه‌ها، هشدار موبایل فعال می‌شود.
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
                          {entry.severity === 'critical' ? 'بحرانی' : 'هشدار'}
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
                    <div
                      dir="ltr"
                      className="shrink-0 text-right font-mono-tabular text-[11px] text-slate-400"
                    >
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
        aria-label={collapsed ? 'نمایش کنترل‌ها' : 'مخفی‌کردن کنترل‌ها'}
        className="pointer-events-auto flex items-center gap-1.5 rounded-t-xl border border-b-0 border-white/10 px-4 py-1 text-xs font-medium text-slate-300 transition-colors hover:text-white"
        style={{ backgroundColor: 'rgba(11, 16, 23, 0.94)' }}
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>نمایش کنترل‌ها</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>مخفی‌کردن</span>
          </>
        )}
      </button>

      {/* Main Dock Container */}
      <div
        dir="rtl"
        className="pointer-events-auto w-full rounded-2xl border border-white/10 px-4 py-3 shadow-2xl"
        style={{ backgroundColor: 'rgba(11, 16, 23, 0.94)' }}
      >
        {/* Top Row: Scope Switcher + Segmented Tabs + Quick Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Switcher: Heart vs Full Human Body Vasculature */}
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#070b10] p-1">
              <button
                type="button"
                onClick={() => onChangeScope('heart')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  vascularScope === 'heart'
                    ? 'bg-rose-500 font-semibold text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Heart className="h-3.5 w-3.5" />
                قلب کودک
              </button>
              <button
                type="button"
                onClick={() => onChangeScope('full_body')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  vascularScope === 'full_body'
                    ? 'bg-sky-500 font-semibold text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                رگ‌بندی کل بدن
              </button>
            </div>

            {/* Primary Dock Tabs */}
            <div
              className="flex items-center gap-1 rounded-xl bg-white/5 p-1"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'functions'}
                onClick={() => setActiveTab('functions')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'functions'
                    ? 'bg-teal-500 font-semibold text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                قلب و رگ‌ها
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'bpm'}
                onClick={() => setActiveTab('bpm')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'bpm'
                    ? 'bg-teal-500 font-semibold text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                ضربان و سرعت
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'view'}
                onClick={() => setActiveTab('view')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'view'
                    ? 'bg-teal-500 font-semibold text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                نمایش و هشدارها
              </button>
            </div>
          </div>

          {/* Right Quick Actions */}
          <div className="flex items-center gap-2">
            {vascularScope === 'heart' ? (
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 md:flex">
                <span className="text-[11px] font-medium text-slate-300 whitespace-nowrap">
                  بازشدن حفره‌ها
                </span>
                <input
                  type="range"
                  dir="ltr"
                  min={0}
                  max={1}
                  step={0.01}
                  value={explodeFactor}
                  onChange={(e) => onChangeExplode(parseFloat(e.target.value))}
                  className="studio-slider w-20"
                />
                <span className="font-mono-tabular w-8 text-left text-[11px] text-teal-300">
                  {Math.round(explodeFactor * 100)}%
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onToggleBodySilhouette}
                className={`hidden rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap md:block ${
                  showBodySilhouette
                    ? 'border-sky-400/50 bg-sky-500/15 text-sky-200'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                شبح بدن
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLogDrawer((v) => !v)}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                showLogDrawer
                  ? 'border-teal-400/50 bg-teal-500/15 text-teal-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:text-white'
              }`}
            >
              هشدارها ({alertHistory.length})
            </button>

            <button
              type="button"
              onClick={onToggleAudio}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
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
              <span>{audioEnabled ? 'صدا روشن' : 'بی‌صدا'}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Heart Parts & Full-Body Vascular Regions */}
        {activeTab === 'functions' && (
          <div className="flex flex-col gap-2 pt-2.5">
            {/* Row 1: Heart Anatomy */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ml-1 text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                بخش‌های قلب:
              </span>
              <button
                type="button"
                onClick={() => {
                  onChangeScope('heart');
                  onSelectPart(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  vascularScope === 'heart' && selectedPart === null
                    ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                کل قلب
              </button>
              {HEART_PART_ORDER.map((id) => {
                const part = ANATOMY_PARTS[id];
                const active = selectedPart === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPart(active ? null : id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-teal-400/80 bg-teal-500/20 text-teal-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {part.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Row 2: Full-Body Vascular Network */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/6 pt-2">
              <span className="ml-1 text-[11px] font-semibold text-sky-300/90 whitespace-nowrap">
                رگ‌بندی کل بدن:
              </span>
              <button
                type="button"
                onClick={() => {
                  onChangeScope('full_body');
                  onSelectPart(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  vascularScope === 'full_body' && selectedPart === null
                    ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                تمام رگ‌های بدن
              </button>
              {VASCULAR_REGION_ORDER.map((id) => {
                const part = ANATOMY_PARTS[id];
                const active = selectedPart === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectPart(active ? null : id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-teal-400/80 bg-teal-500/20 text-teal-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {part.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Direct BPM Increase/Decrease + Slow-Mo Speed + Scenarios */}
        {activeTab === 'bpm' && (
          <div className="flex flex-col gap-2.5 pt-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Direct BPM Control */}
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
                <span className="text-xs font-medium text-slate-200 whitespace-nowrap">
                  تنظیم دستی ضربان:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeManualBpm(Math.max(45, effectiveBpm - 10))
                  }
                  aria-label="کاهش ضربان قلب"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-white/5 text-slate-200 hover:bg-white/15"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="range"
                  dir="ltr"
                  min={45}
                  max={210}
                  step={1}
                  value={effectiveBpm}
                  onChange={(e) => onChangeManualBpm(Number(e.target.value))}
                  className="studio-slider w-32 sm:w-44"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChangeManualBpm(Math.min(210, effectiveBpm + 10))
                  }
                  aria-label="افزایش ضربان قلب"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-white/5 text-slate-200 hover:bg-white/15"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span
                  dir="ltr"
                  className="font-mono-tabular w-16 text-center text-xs font-semibold text-teal-300"
                >
                  {effectiveBpm} BPM
                </span>
                {manualBpm !== null && (
                  <button
                    type="button"
                    onClick={() => onChangeManualBpm(null)}
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                  >
                    بازگشت به خودکار
                  </button>
                )}
              </div>

              {/* Slow-Motion Time Scale */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  سرعت نمایش:
                </span>
                {[
                  { val: 0.25, label: '۰.۲۵× آهسته' },
                  { val: 0.5, label: '۰.۵×' },
                  { val: 1, label: '۱× واقعی' },
                ].map((sp) => (
                  <button
                    key={sp.val}
                    type="button"
                    onClick={() => onChangePlaybackSpeed(sp.val)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      playbackSpeed === sp.val
                        ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ml-1 text-[11px] text-slate-400">
                حالت‌های آماده:
              </span>
              {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => {
                const s = SCENARIOS[id];
                const active = manualBpm === null && scenarioId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChangeManualBpm(null);
                      onSelectScenario(id);
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'border-teal-400/70 bg-teal-500/20 text-teal-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {s.label} ({s.targetBpm})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: View Layers, Camera Angles & Alert Rules */}
        {activeTab === 'view' && (
          <div className="flex flex-col gap-2.5 pt-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'anatomical', label: 'نمای کامل' },
                    { id: 'conduction_xray', label: 'شفاف / الکتریکی' },
                    { id: 'exploded', label: 'حفره‌های باز' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onSelectViewMode(m.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      viewMode === m.id
                        ? 'border-teal-400/70 bg-teal-500/20 text-teal-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(Object.keys(presetsForScope) as CameraPresetId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectCameraPreset(id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      cameraPreset === id && selectedPart === null
                        ? 'border-sky-400/70 bg-sky-500/20 text-sky-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {presetsForScope[id].label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {vascularScope === 'full_body' && (
                  <>
                    <button
                      type="button"
                      onClick={onToggleArteries}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        showArteries
                          ? 'border-rose-400/60 bg-rose-500/15 text-rose-200'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      سرخرگ‌ها
                    </button>
                    <button
                      type="button"
                      onClick={onToggleVeins}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        showVeins
                          ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      سیاهرگ‌ها
                    </button>
                    <button
                      type="button"
                      onClick={onToggleBodySilhouette}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                        showBodySilhouette
                          ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      شبح بدن
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onToggleBloodFlow}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    showBloodFlow
                      ? 'border-rose-400/60 bg-rose-500/15 text-rose-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  جریان خون
                </button>
                <button
                  type="button"
                  onClick={onToggleCoronaries}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    showCoronaries
                      ? 'border-rose-400/60 bg-rose-500/15 text-rose-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  کرونری
                </button>
                <button
                  type="button"
                  onClick={onToggleWearablePatch}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    showWearablePatch
                      ? 'border-teal-400/60 bg-teal-500/15 text-teal-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  سنسور
                </button>
                <button
                  type="button"
                  onClick={onToggleAutoRotate}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    autoRotate
                      ? 'border-teal-400/60 bg-teal-500/15 text-teal-200'
                      : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  چرخش
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-white/8 pt-2 text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <Sliders className="h-3.5 w-3.5 text-slate-400" />
                <span>آستانه هشدار:</span>
              </div>
              <label className="flex items-center gap-2 text-slate-300">
                <span>حداقل BPM</span>
                <input
                  type="range"
                  dir="ltr"
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
                  className="studio-slider w-16"
                />
                <span className="font-mono-tabular text-teal-300">
                  {thresholds.lowBpm}
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <span>حداکثر BPM</span>
                <input
                  type="range"
                  dir="ltr"
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
                  className="studio-slider w-16"
                />
                <span className="font-mono-tabular text-amber-300">
                  {thresholds.highBpm}
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-300">
                <span>حداقل SpO2</span>
                <input
                  type="range"
                  dir="ltr"
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
                  className="studio-slider w-16"
                />
                <span className="font-mono-tabular text-sky-300">
                  {thresholds.minSpo2}%
                </span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
