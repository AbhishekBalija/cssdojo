import { getPref } from "./prefs";

// Two short wooden clacks for a 90+ solve. Off unless the player turns sound on in Settings.

let ctx: AudioContext | null = null;

function clack(at: number, pitch: number): void {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * 0.08);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.08));
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = pitch;
  band.Q.value = 9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.9, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
  src.connect(band).connect(gain).connect(ctx.destination);
  src.start(at);
}

export function playSolveSound(): void {
  if (!getPref("sound")) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime + 0.02;
    clack(t, 1400);
    clack(t + 0.13, 1050);
  } catch {
    /* no audio here: stay silent */
  }
}
