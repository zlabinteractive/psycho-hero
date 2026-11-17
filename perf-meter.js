// Frame cost meter: CPU time per Phaser step (update + render) and GPU texture uploads per frame.
// Feeds the dev panel readout and the benchmark (tests/perf/bench.mjs reads window.__perf).
export const FRAME_BUDGET_MS = 8; // Worst-frame warning: half of a 60 fps frame, leaving room for slower PCs.
export const UPLOAD_BUDGET = 2; // Uploads per frame. The hero rig canvas alone costs 1.

const SAMPLES = 8192; // Ring buffer: covers a 10 s benchmark even with the frame-rate cap off.

export class PerfMeter {
  constructor(game) {
    this.frames = new Float32Array(SAMPLES);
    this.uploads = new Uint16Array(SAMPLES);
    this.count = 0;
    this.pendingUploads = 0;
    this.start = 0;
    game.events.on('prestep', () => { this.start = performance.now(); });
    game.events.on('postrender', () => {
      const at = this.count++ % SAMPLES;
      this.frames[at] = performance.now() - this.start;
      this.uploads[at] = this.pendingUploads;
      this.pendingUploads = 0;
    });
    // Count texture uploads at the GL context: a Text style change, a canvas texture refresh and a
    // new texture all land here, so per-frame churn shows up whatever code caused it.
    const gl = this.gl = game.renderer?.gl;
    if (gl) {
      for (const name of ['texImage2D', 'texSubImage2D']) {
        const upload = gl[name].bind(gl);
        gl[name] = (...args) => { this.pendingUploads++; return upload(...args); };
      }
    }
  }

  reset() {
    this.count = 0;
    this.resetAt = performance.now();
  }

  // Stats over the latest `window` frames (default: everything since reset, up to the buffer size).
  report(window = SAMPLES) {
    const n = Math.min(this.count, SAMPLES, window);
    const fps = this.count / Math.max(0.001, (performance.now() - (this.resetAt ?? 0)) / 1000);
    if (!n) return { fps: 0, frames: 0, mean: 0, p50: 0, p95: 0, p99: 0, worst: 0, uploadsPerFrame: 0 };
    const times = [];
    let uploads = 0;
    for (let i = 0; i < n; i++) {
      const at = (this.count - 1 - i) % SAMPLES;
      times.push(this.frames[at]);
      uploads += this.uploads[at];
    }
    times.sort((a, b) => a - b);
    const pick = p => times[Math.min(n - 1, Math.floor(p * n))];
    return { fps, frames: n, mean: times.reduce((a, b) => a + b, 0) / n, p50: pick(0.5), p95: pick(0.95),
      p99: pick(0.99), worst: times[n - 1], uploadsPerFrame: uploads / n };
  }
}
