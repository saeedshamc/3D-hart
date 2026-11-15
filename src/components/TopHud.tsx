import {
  AlertTriangle,
  BellRing,
  Check,
  HeartPulse,
  Thermometer,
  X,
} from 'lucide-react';
import {
  ANATOMY_PARTS,
  AnatomyPartId,
  CardiacPhase,
  TelemetrySnapshot,
  VascularScopeId,
} from '../types/biometrics';
import { PpgPulseCanvas } from './PpgPulseCanvas';

interface TopHudProps {
  snapshot: TelemetrySnapshot;
  telemetryRef: React.MutableRefObject<TelemetrySnapshot>;
  vascularScope: VascularScopeId;
  selectedPart: AnatomyPartId | null;
  onClearPart: () => void;
  onAcknowledgeAlert: () => void;
  isAlertAcknowledged: boolean;
}

const PHASE_FA: Record<CardiacPhase, string> = {
  'Atrial Systole': 'انقباض دهلیزی (موج P)',
  'Ventricular Systole': 'انقباض بطنی · سیستول (QRS)',
  Diastole: 'استراحت و پرشدن · دیاستول',
};

export function TopHud({
  snapshot,
  telemetryRef,
  vascularScope,
  selectedPart,
  onClearPart,
  onAcknowledgeAlert,
  isAlertAcknowledged,
}: TopHudProps) {
  const isCritical = snapshot.severity === 'critical';
  const isWarning = snapshot.severity === 'warning';
  const hasActiveAlert =
    snapshot.severity !== 'normal' && snapshot.activeAlertTitle;

  const waveColor = isCritical
    ? '#fb7185'
    : isWarning
      ? '#fbbf24'
      : '#2dd4bf';

  const ecgPoints =
    snapshot.ecgWave.length > 1
      ? snapshot.ecgWave
          .map((v, i) => {
            const x = (i / (snapshot.ecgWave.length - 1)) * 116;
            const norm = (v + 0.25) / 1.35;
            const y = 32 - Math.max(0, Math.min(1, norm)) * 28;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ')
      : '0,24 116,24';

  const partInfo = selectedPart ? ANATOMY_PARTS[selectedPart] : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex flex-col gap-3 p-3.5 sm:flex-row sm:items-start sm:justify-between sm:p-5">
      {/* Top Telemetry Card + Active Inspector */}
      <div className="flex flex-col gap-2.5">
        <div
          dir="rtl"
          className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/10 px-4 py-3 shadow-2xl"
          style={{ backgroundColor: 'rgba(11, 16, 23, 0.93)' }}
        >
          {/* Left-edge severity accent line */}
          <div
            className="absolute inset-y-2 right-0 w-1 rounded-l-full"
            style={{ backgroundColor: waveColor }}
          />

          {/* Header Strip */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pr-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <HeartPulse
                className="h-4 w-4 shrink-0"
                style={{ color: waveColor }}
              />
              <span className="font-display text-sm font-bold text-slate-50 whitespace-nowrap">
                پایشگر قلب و عروق کودک
              </span>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-medium text-slate-300 whitespace-nowrap">
                {snapshot.rhythmLabel}
              </span>
            </div>

            <span className="rounded-md border border-teal-400/20 bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-300 whitespace-nowrap">
              {PHASE_FA[snapshot.cardiacPhase]}
            </span>
          </div>

          {/* Numeric Vitals + Real-Time ECG & PPG Waveforms */}
          <div
            dir="ltr"
            className="mt-2.5 flex flex-wrap items-center gap-4 border-t border-white/8 pt-2.5 pr-1"
          >
            <div className="flex items-baseline gap-1.5">
              <span
                className="font-mono-tabular text-[26px] leading-none font-semibold tracking-tight"
                style={{ color: waveColor }}
              >
                {snapshot.bpm}
              </span>
              <span className="text-[11px] font-medium text-slate-400">BPM</span>
            </div>

            <div className="h-6 w-px bg-white/10" aria-hidden="true" />

            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono-tabular text-[26px] leading-none font-semibold tracking-tight ${
                  snapshot.spo2 < 92 ? 'text-rose-400' : 'text-sky-400'
                }`}
              >
                {snapshot.spo2}%
              </span>
              <span className="text-[11px] font-medium text-slate-400">SpO2</span>
            </div>

            <div className="hidden h-6 w-px bg-white/10 sm:block" aria-hidden="true" />

            <div className="hidden items-center gap-1 text-slate-300 sm:flex">
              <Thermometer className="h-3.5 w-3.5 text-amber-300/80" />
              <span className="font-mono-tabular text-sm font-medium">
                {snapshot.skinTempC.toFixed(1)}°C
              </span>
            </div>

            <div className="hidden items-center gap-3 border-l border-white/10 pl-3 sm:flex">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium tracking-wide text-slate-400">
                  ECG · Electrical
                </span>
                <svg
                  width="116"
                  height="36"
                  viewBox="0 0 116 36"
                  className="shrink-0 rounded-lg border border-white/8 bg-[#070b10]"
                  aria-label="Live pediatric ECG trace"
                >
                  <polyline
                    fill="none"
                    stroke={waveColor}
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={ecgPoints}
                  />
                </svg>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium tracking-wide text-slate-400">
                  PPG · Optical Pulse
                </span>
                <PpgPulseCanvas telemetryRef={telemetryRef} />
              </div>
            </div>
          </div>

          <div dir="ltr" className="mt-2 flex items-center justify-between gap-2 sm:hidden">
            <span className="text-[10px] font-medium text-slate-400">
              PPG · Optical Pulse
            </span>
            <PpgPulseCanvas telemetryRef={telemetryRef} />
          </div>

          {/* Vascular Legend (in Full-Body Scope) + Interaction Hint */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-2 pr-2 text-[11px] text-slate-400">
            <span>
              چرخش با درگ · بزرگ‌نمایی با اسکرول · کلیک روی اندام‌ها · کلید H مخفی‌کردن
            </span>
            {vascularScope === 'full_body' && (
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="flex items-center gap-1.5 text-rose-300">
                  <span className="h-2 w-2 rounded-full bg-[#d93040]" />
                  سرخرگ (اکسیژن‌دار)
                </span>
                <span className="flex items-center gap-1.5 text-sky-300">
                  <span className="h-2 w-2 rounded-full bg-[#3b67b8]" />
                  سیاهرگ (کم‌اکسیژن)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Live Functional Explanation Card when user selects a heart part or body vascular region */}
        {partInfo && (
          <div
            dir="rtl"
            className="pointer-events-auto max-w-md rounded-2xl border border-teal-400/35 px-4 py-3.5 shadow-2xl"
            style={{ backgroundColor: 'rgba(11, 18, 25, 0.95)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      partInfo.category === 'vascular'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-teal-500/15 text-teal-300'
                    }`}
                  >
                    {partInfo.category === 'vascular'
                      ? 'شبکه رگ‌بندی بدن'
                      : 'آناتومی قلب'}
                  </span>
                  <span className="text-[11px] font-medium text-teal-400">
                    {partInfo.role}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-sm font-bold text-white">
                  {partInfo.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClearPart}
                aria-label="بستن جزئیات بخش"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[10px] font-medium text-slate-400">
                عملکرد لحظه‌ای در این فاز ضربان
              </div>
              <div className="mt-0.5 text-xs font-semibold text-teal-300">
                {partInfo.phaseActions[snapshot.cardiacPhase]}
              </div>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-200">
              {partInfo.openCloseMechanism}
            </p>
          </div>
        )}
      </div>

      {/* Real-Time Mobile Alert Toast */}
      {hasActiveAlert && (
        <div
          dir="rtl"
          role="alert"
          className={`pointer-events-auto max-w-sm rounded-2xl border px-4 py-3.5 shadow-2xl ${
            isCritical
              ? 'border-rose-500/60 text-rose-50'
              : 'border-amber-500/50 text-amber-50'
          }`}
          style={{
            backgroundColor: isCritical
              ? 'rgba(54, 15, 24, 0.95)'
              : 'rgba(54, 34, 11, 0.95)',
          }}
        >
          <div className="flex items-start gap-2.5">
            {isCritical ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            )}
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={isCritical ? 'text-rose-300' : 'text-amber-300'}
                >
                  {isCritical ? 'هشدار فوری موبایل' : 'هشدار افزایش ضربان'}
                </span>
                <span className="text-white/30" aria-hidden="true">
                  ·
                </span>
                <span className="text-white/75">
                  {isAlertAcknowledged ? 'تأیید شد' : 'ارسال به گوشی والدین'}
                </span>
              </div>
              <p className="mt-0.5 font-display text-sm font-semibold text-white">
                {snapshot.activeAlertTitle}
              </p>
              {snapshot.activeAlertBody && (
                <p className="mt-0.5 text-xs text-slate-200/90">
                  {snapshot.activeAlertBody}
                </p>
              )}
            </div>
          </div>

          {!isAlertAcknowledged && (
            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={onAcknowledgeAlert}
                className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-slate-200 whitespace-nowrap"
              >
                <Check className="h-3.5 w-3.5" />
                تأیید هشدار
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
