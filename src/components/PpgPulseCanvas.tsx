import { useEffect, useRef } from 'react';
import { TelemetrySnapshot } from '../types/biometrics';

interface PpgPulseCanvasProps {
  telemetryRef: React.MutableRefObject<TelemetrySnapshot>;
}

const BUFFER_SIZE = 120;

// Physiological optical PPG waveform with pulse-transit delay after QRS and dicrotic notch
function sampleOpticalPpg(cyclePhase: number): number {
  const p = cyclePhase % 1;
  // Systolic optical peak arrives slightly after ventricular depolarization (~0.34)
  const systolic = Math.exp(-Math.pow((p - 0.34) / 0.085, 2));
  // Dicrotic notch / diastolic reflection wave (~0.56)
  const dicrotic = 0.38 * Math.exp(-Math.pow((p - 0.56) / 0.105, 2));
  const baseline = 0.04 * Math.sin(p * Math.PI * 2);
  return Math.max(0.03, Math.min(1.0, 0.06 + systolic * 0.86 + dicrotic + baseline));
}

export function PpgPulseCanvas({ telemetryRef }: PpgPulseCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cssWidth = 148;
    const cssHeight = 36;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    const samples = new Float32Array(BUFFER_SIZE);
    // Pre-seed waveform with realistic curve
    for (let i = 0; i < BUFFER_SIZE; i++) {
      samples[i] = sampleOpticalPpg((i / BUFFER_SIZE) * 2);
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastSampleTime = performance.now();
    let writeHead = 0;

    const draw = (now: number) => {
      const snap = telemetryRef.current;

      // Advance scrolling optical buffer at ~45 Hz synced to cardiacCyclePhase
      if (!prefersReducedMotion && now - lastSampleTime >= 22) {
        lastSampleTime = now;
        const val = sampleOpticalPpg(snap.cardiacCyclePhase);
        samples[writeHead] = val;
        writeHead = (writeHead + 1) % BUFFER_SIZE;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Subtle optical sensor grid
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1;
      for (let y = 9; y < cssHeight; y += 9) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }

      const strokeColor =
        snap.severity === 'critical'
          ? '#fb7185'
          : snap.severity === 'warning'
            ? '#fbbf24'
            : '#34d399';

      const fillTopColor =
        snap.severity === 'critical'
          ? 'rgba(251, 113, 133, 0.24)'
          : snap.severity === 'warning'
            ? 'rgba(251, 191, 36, 0.22)'
            : 'rgba(52, 211, 153, 0.24)';

      const padY = 4;
      const plotH = cssHeight - padY * 2;

      // Build scrolling trace from oldest -> newest sample
      ctx.beginPath();
      let lastX = 0;
      let lastY = cssHeight - padY;

      for (let i = 0; i < BUFFER_SIZE; i++) {
        const idx = (writeHead + i) % BUFFER_SIZE;
        const x = (i / (BUFFER_SIZE - 1)) * (cssWidth - 4);
        const y = cssHeight - padY - samples[idx] * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        lastX = x;
        lastY = y;
      }

      // Soft under-curve optical area fill
      ctx.save();
      ctx.lineTo(lastX, cssHeight);
      ctx.lineTo(0, cssHeight);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, cssHeight);
      grad.addColorStop(0, fillTopColor);
      grad.addColorStop(1, 'rgba(11, 16, 22, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // Main optical pulse wave stroke
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.9;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Leading optical emitter point
      const latestVal = samples[(writeHead - 1 + BUFFER_SIZE) % BUFFER_SIZE];
      const dotRadius = 2.1 + latestVal * 1.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lastX, lastY, dotRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(lastX, lastY, dotRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [telemetryRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 148, height: 36 }}
      className="block rounded-md border border-white/8 bg-[#080d12]"
      aria-label="Real-time optical PPG pulse wave visualization"
    />
  );
}
