import type { GameSim } from '../game/sim';
import { soundEvents, soundState, type SoundEvent, type SoundState } from './soundEvents';

type Tone = {
  type: OscillatorType;
  from: number;
  to: number;
  dur: number;
  gain: number;
  delay?: number;
};
type Noise = { noise: true; from: number; to: number; dur: number; gain: number; delay?: number };
type Voice = Tone | Noise;

/** Every sound is synthesized: no audio files, no network. Volumes kept deliberately low. */
const SOUNDS: Record<SoundEvent, Voice[]> = {
  start: [
    { type: 'triangle', from: 330, to: 660, dur: 0.18, gain: 0.12 },
    { type: 'triangle', from: 495, to: 990, dur: 0.18, gain: 0.08, delay: 0.09 },
  ],
  jump: [{ type: 'square', from: 260, to: 520, dur: 0.1, gain: 0.05 }],
  leap: [
    { noise: true, from: 600, to: 2400, dur: 0.22, gain: 0.12 },
    { type: 'triangle', from: 300, to: 700, dur: 0.16, gain: 0.06 },
  ],
  land: [{ type: 'sine', from: 140, to: 60, dur: 0.09, gain: 0.14 }],
  slide: [{ noise: true, from: 1800, to: 400, dur: 0.3, gain: 0.08 }],
  bounce: [{ type: 'sine', from: 180, to: 720, dur: 0.35, gain: 0.14 }],
  refused: [{ type: 'sawtooth', from: 110, to: 90, dur: 0.14, gain: 0.07 }],
  spell: [
    { type: 'sawtooth', from: 110, to: 55, dur: 0.8, gain: 0.08 },
    { type: 'sine', from: 165, to: 82, dur: 0.8, gain: 0.08 },
  ],
  emerge: [
    { type: 'sine', from: 660, to: 880, dur: 0.5, gain: 0.07 },
    { type: 'sine', from: 990, to: 1320, dur: 0.5, gain: 0.05, delay: 0.08 },
  ],
  // Near miss: an airy whoosh past the ear.
  nearMiss: [{ noise: true, from: 3200, to: 700, dur: 0.22, gain: 0.1 }],
  portal: [
    { type: 'triangle', from: 880, to: 440, dur: 0.3, gain: 0.08 },
    { type: 'triangle', from: 660, to: 330, dur: 0.3, gain: 0.06, delay: 0.1 },
  ],
  mirrorEnd: [{ type: 'triangle', from: 440, to: 880, dur: 0.25, gain: 0.07 }],
  crash: [
    { noise: true, from: 900, to: 120, dur: 0.35, gain: 0.2 },
    { type: 'sine', from: 90, to: 40, dur: 0.3, gain: 0.16 },
  ],
  fall: [{ type: 'sine', from: 520, to: 70, dur: 0.9, gain: 0.1 }],
  shard: [{ type: 'sine', from: 1320, to: 1760, dur: 0.08, gain: 0.05 }],
};

/** Minimum seconds between two plays of the same sound, so rapid events never stack up. */
const COOLDOWN = 0.06;

/**
 * Game audio. Created suspended; the first tap/key unlocks it (browsers block autoplay).
 * Reads sim events once per frame and never affects gameplay.
 */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private prev: SoundState | null = null;
  private last = new Map<SoundEvent, number>();
  enabled = true;
  /** Sounds actually started (for tests). */
  played = 0;

  /** 'locked' until the first tap/key, then the AudioContext state. */
  get state(): string {
    return this.ctx ? this.ctx.state : 'locked';
  }

  constructor(private readonly target: Window) {
    target.addEventListener('pointerdown', this.unlock, true);
    target.addEventListener('keydown', this.unlock, true);
  }

  dispose(): void {
    this.target.removeEventListener('pointerdown', this.unlock, true);
    this.target.removeEventListener('keydown', this.unlock, true);
    void this.ctx?.close().catch(() => {});
  }

  update(sim: GameSim): void {
    const next = soundState(sim);
    const events = this.prev ? soundEvents(this.prev, next) : [];
    this.prev = next;
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    for (const e of events) this.play(e);
  }

  private unlock = (): void => {
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(this.ctx.destination);
        this.noise = makeNoise(this.ctx);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    } catch {
      // No audio on this device: the game is fully playable silently.
      this.ctx = null;
    }
  };

  private play(e: SoundEvent): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    if (now - (this.last.get(e) ?? -1) < COOLDOWN) return;
    this.last.set(e, now);
    this.played += 1;
    for (const v of SOUNDS[e]) this.voice(ctx, v, now + (v.delay ?? 0));
  }

  private voice(ctx: AudioContext, v: Voice, t: number): void {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(v.gain, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + v.dur);
    gain.connect(this.master!);
    let src: AudioScheduledSourceNode;
    if ('noise' in v) {
      const n = ctx.createBufferSource();
      n.buffer = this.noise;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(v.from, t);
      filter.frequency.exponentialRampToValueAtTime(v.to, t + v.dur);
      n.connect(filter).connect(gain);
      src = n;
    } else {
      const o = ctx.createOscillator();
      o.type = v.type;
      o.frequency.setValueAtTime(v.from, t);
      o.frequency.exponentialRampToValueAtTime(v.to, t + v.dur);
      o.connect(gain);
      src = o;
    }
    src.start(t);
    src.stop(t + v.dur + 0.02);
    src.onended = () => gain.disconnect();
  }
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
