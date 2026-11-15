import { AlertSeverity } from '../types/biometrics';

class ProceduralAlertAudio {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private lastAlertPlayedAt = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next) {
      this.ensureContext();
      this.playClick();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public playClick(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playHeartbeatTick(bpm: number): void {
    if (!this.enabled || bpm <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.06);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playAlertTone(severity: Exclude<AlertSeverity, 'normal'>, force = false): void {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (!force && nowMs - this.lastAlertPlayedAt < 4500) return;
    this.lastAlertPlayedAt = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes =
      severity === 'critical' ? [880, 659.25, 880, 659.25] : [587.33, 739.99];
    const spacing = severity === 'critical' ? 0.16 : 0.19;

    notes.forEach((freq, idx) => {
      const start = now + idx * spacing;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = severity === 'critical' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(
        severity === 'critical' ? 0.11 : 0.07,
        start + 0.015,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const alertAudio = new ProceduralAlertAudio();
