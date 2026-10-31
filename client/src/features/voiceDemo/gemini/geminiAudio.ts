// Audio for the Gemini Live browser test: the microphone as 16 kHz 16-bit PCM
// chunks (what the Live API takes in), and a player for its 24 kHz PCM replies
// that can be flushed at once when the caller interrupts.

const MIC_RATE = 16_000;
const OUT_RATE = 24_000;
/** About 40 ms per chunk sent to Gemini. */
const CHUNK_SAMPLES = 640;

// The worklet is inlined (no separate public file to keep in step): it turns
// float frames into Int16 and posts fixed-size chunks to the main thread.
const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(${CHUNK_SAMPLES}); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0).buffer); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToInt16(b64: string): Int16Array {
  const bin = atob(b64);
  const out = new Int16Array(bin.length >> 1);
  for (let i = 0; i < out.length; i++) {
    const lo = bin.charCodeAt(i * 2), hi = bin.charCodeAt(i * 2 + 1);
    const v = (hi << 8) | lo;
    out[i] = v >= 0x8000 ? v - 0x10000 : v;
  }
  return out;
}

export interface MicCapture { stop(): void }

/** Opens the microphone (echo cancellation on: speaker echo otherwise interrupts her). */
export async function startMic(onChunk: (base64Pcm: string) => void): Promise<MicCapture> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate: MIC_RATE });
  try {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, "pcm-capture");
    node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(bytesToBase64(e.data));
    src.connect(node);
    return {
      stop() {
        node.port.onmessage = null;
        try { src.disconnect(); node.disconnect(); } catch { /* already gone */ }
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close().catch(() => {});
      },
    };
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
    throw err;
  }
}

export interface PcmPlayer {
  play(base64Pcm: string): void;
  /** Stops everything queued, at once (the caller interrupted). */
  flush(): void;
  /** True while audio is queued or playing. */
  busy(): boolean;
  close(): void;
}

export function createPlayer(): PcmPlayer {
  const ctx = new AudioContext({ sampleRate: OUT_RATE });
  let at = 0;
  const live = new Set<AudioBufferSourceNode>();
  return {
    play(b64) {
      if (ctx.state === "suspended") void ctx.resume();
      const pcm = base64ToInt16(b64);
      if (!pcm.length) return;
      const buf = ctx.createBuffer(1, pcm.length, OUT_RATE);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.connect(ctx.destination);
      at = Math.max(at, ctx.currentTime + 0.03);
      node.start(at);
      at += buf.duration;
      live.add(node);
      node.onended = () => live.delete(node);
    },
    flush() {
      live.forEach((n) => { try { n.stop(); } catch { /* not started */ } });
      live.clear();
      at = 0;
    },
    busy() {
      return live.size > 0;
    },
    close() {
      this.flush();
      void ctx.close().catch(() => {});
    },
  };
}
