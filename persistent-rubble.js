// Lasting masonry is a sparse heightfield, independent of the disposable impact particles.
// One source cell contributes its area once. Compaction leaves room for broad, uneven heaps.
export const RUBBLE_BIN = 12;
const TILE = 240;
// Facades include windows and hollow floors: the wreck occupies a fraction of its upright area.
const COMPACTION = 0.10;
const random = n => { const s = Math.sin(n * 91.7 + 13.1) * 43758.5453; return s - Math.floor(s); };
const css = (color, shade = 1) => `rgb(${Math.min(255, (color >> 16) * shade | 0)},${Math.min(255, (color >> 8 & 255) * shade | 0)},${Math.min(255, (color & 255) * shade | 0)})`;
let serial = 0;

export class PersistentRubble {
  constructor(groundAt) {
    this.groundAt = groundAt;
    this.bins = new Map();
    this.dirty = new Set();
    this.tiles = new Map();
    this.area = 0;
    this.id = serial++;
  }

  add(x, area, color) {
    if (!(area > 0) || !Number.isFinite(x)) return;
    const middle = Math.floor(x / RUBBLE_BIN);
    area *= COMPACTION;
    this.area += area;
    this.unsettled = true;
    // Scatter the impact locally; settling below spreads high heaps further without losing mass.
    for (let offset = -2; offset <= 2; offset++) {
      this.mix(middle + offset, area * (3 - Math.abs(offset)) / 9, color);
    }
  }

  mix(index, area, color) {
    let bin = this.bins.get(index);
    if (!bin) this.bins.set(index, bin = { area: 0, color });
    const total = bin.area + area, fraction = area / total;
    const blend = shift => Math.round((bin.color >> shift & 255) * (1 - fraction) + (color >> shift & 255) * fraction);
    bin.color = blend(16) << 16 | blend(8) << 8 | blend(0);
    bin.area = total;
    // Neighbouring tiles share the silhouette at the boundary.
    for (let delta = -1; delta <= 1; delta++) this.dirty.add(Math.floor((index + delta) * RUBBLE_BIN / TILE));
  }

  settle() {
    if (!this.unsettled) return;
    this.unsettled = false;
    // A queue visits only columns disturbed by the latest landing. Transfer conserves area.
    const queue = [], queued = new Set();
    const enqueue = i => { if (!queued.has(i)) { queued.add(i); queue.push(i); } };
    for (const tile of this.dirty) for (let i = tile * TILE / RUBBLE_BIN; i < (tile + 1) * TILE / RUBBLE_BIN; i++) enqueue(i);
    for (let head = 0; head < queue.length; head++) {
      const index = queue[head]; queued.delete(index);
      const bin = this.bins.get(index);
      if (!bin) continue;
      for (const next of [index - 1, index + 1]) {
        const difference = bin.area - (this.bins.get(next)?.area ?? 0);
        // Different fractured plates hold different slopes, avoiding a perfectly regular cone.
        const slope = RUBBLE_BIN * RUBBLE_BIN * (0.35 + random(Math.min(index, next)) * 0.6);
        if (difference <= slope + 0.1) continue;
        const transfer = (difference - slope) / 2;
        bin.area -= transfer;
        this.mix(next, transfer, bin.color);
        enqueue(index); enqueue(next);
      }
    }
  }

  height(x) { return (this.bins.get(Math.floor(x / RUBBLE_BIN))?.area ?? 0) / RUBBLE_BIN; }

  draw(scene, view) {
    this.settle();
    for (const index of this.dirty) {
      const left = index * TILE;
      if (view && (left + TILE < view.x || left > view.right)) continue;
      this.paint(scene, index);
      this.dirty.delete(index);
    }
    for (const [index, tile] of this.tiles) {
      tile.image.setVisible(!view || (index * TILE + TILE >= view.x && index * TILE <= view.right
        && tile.top + tile.canvas.height >= view.y && tile.top <= view.bottom));
    }
  }

  paint(scene, index) {
    const left = index * TILE, points = [];
    let top = Infinity, bottom = -Infinity;
    for (let x = left - RUBBLE_BIN; x <= left + TILE + RUBBLE_BIN; x += RUBBLE_BIN) {
      const ground = this.groundAt(x), height = this.height(x);
      points.push({ x, y: ground - height, ground, height });
      top = Math.min(top, ground - height - 12); bottom = Math.max(bottom, ground + 3);
    }
    if (!points.some(p => p.height > 0)) return;
    top = Math.floor(top / 64) * 64;
    const height = Math.ceil((bottom - top) / 64) * 64;
    let tile = this.tiles.get(index);
    if (!tile || tile.top !== top || tile.canvas.height !== height) {
      if (tile) { tile.image.destroy(); scene.textures.remove(tile.key); }
      const canvas = document.createElement('canvas'); canvas.width = TILE; canvas.height = height;
      const key = `persistent-rubble-${this.id}-${index}`;
      scene.textures.addCanvas(key, canvas);
      tile = { canvas, key, top, image: scene.add.image(left, top, key).setOrigin(0, 0).setDepth(2) };
      this.tiles.set(index, tile);
    }
    const ctx = tile.canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, height);
    ctx.save(); ctx.translate(-left, -top);
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (const p of points) ctx.lineTo(p.x, p.y);
    for (const p of points.slice().reverse()) ctx.lineTo(p.x, p.ground + 2);
    ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#383b3d'; ctx.fillRect(left, top, TILE, height);
    // Large broken facade plates, dark crevices and bright chipped edges read at street scale.
    for (let y = Math.floor(top / 8) * 8; y < bottom; y += 8) for (let x = left - 24; x < left + TILE; x += 10) {
      const seed = x * 0.73 + y * 2.17;
      const color = this.bins.get(Math.floor(x / RUBBLE_BIN))?.color ?? 0x74777b;
      const xx = x + random(seed) * 10, yy = y + random(seed + 1) * 8;
      const w = 5 + random(seed + 2) * 19, h = 3 + random(seed + 3) * 10;
      ctx.save(); ctx.translate(xx, yy); ctx.rotate((random(seed + 6) - 0.5) * 2.4);
      ctx.fillStyle = css(color, 0.45 + random(seed + 4) * 0.55);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * (0.5 + random(seed + 7) * 0.4), -h * 0.25);
      ctx.lineTo(w, h * 0.5); ctx.lineTo(w * 0.2, h); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css(color, 0.95 + random(seed + 8) * 0.25); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.7, -h * 0.25); ctx.stroke();
      if (random(seed + 5) > 0.88) {
        ctx.strokeStyle = '#292e35'; ctx.beginPath(); ctx.moveTo(2, h);
        ctx.lineTo(w * 0.6, -3); ctx.lineTo(w, -1); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    scene.textures.get(tile.key).refresh();
  }

  destroy(scene) {
    for (const tile of this.tiles.values()) { tile.image.destroy(); scene.textures.remove(tile.key); }
    this.tiles.clear(); this.bins.clear(); this.dirty.clear(); this.area = 0;
  }
}
