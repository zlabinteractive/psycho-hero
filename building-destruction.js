import { LIFT } from './enemy-throw.js';
import { sound } from './sound.js';
import { PersistentRubble } from './persistent-rubble.js';
// Building destruction: each promoted building is baked into a pixel texture split into a grid of
// small cells. Hits carve ragged holes and throw the building's own pixels out as debris. After
// every carve the grid checks what still holds up: a thin neck under a heavy load breaks and the
// load topples on a hinge, and anything cut off from the ground falls free. Falling chunks crush
// whatever they swing into and shatter on the ground in dust, rubble and screen shake.

export const CELL = 4;
const RES = 2;
const GRAVITY = 520;
const PAD = 14;
const MAX_DEBRIS = 2200;
const MAX_DUST = 160;
// Dust puffs expand, drift downwind at DUST_WIND px/s and fade out over DUST_LIFE [min, max] s.
const DUST_LIFE = [1.2, 1.8];
const DUST_WIND = 10;
// A sinking ship spends the first SINK_FLOOD of her time flooding, and lists SINK_LIST rad bow-down.
const SINK_FLOOD = 0.25;
const SINK_LIST = 0.2;
// Ships (building.ship) only hole: each carved cell costs them this many times its share of strength.
const SHIP_FRAGILE = 3;
const RUBBLE_PIECES = 900;
// Canvas px past which a breaking-off chunk drops to 1 px per world px.
const CHUNK_PIXELS = 2e6;
// A row this thin under at least NECK_LOAD cells above it snaps.
const NECK_RATIO = 0.3;
const NECK_LOAD = 30;
// Toughness against the laser grows with the building: a beam cuts through a shop in about 0.35s,
// Meadow Tower in about 0.85s and one Twin Spire in about 0.65s. It carves once per LASER_HEAT ×
// toughness of beam damage (about 36 per second).
const toughness = building => building.maxHealth / 110;
// ponytail: these are max-level stats; scale LASER_HEAT by hero progression once it exists.
const LASER_HEAT = 5 / 4.5;
// Holding the beam on one area heats it harder: from 1x on contact, growing exponentially up to
// FOCUS_MAX x after FOCUS_RAMP seconds. The area is FOCUS_RADIUS px either side of where the beam first aimed,
// measured across the beam, so boring deeper keeps the focus. A gap over FOCUS_GAP s resets it.
const FOCUS_MAX = 5;
const FOCUS_RAMP = 3.5;
const FOCUS_RADIUS = 28;
const FOCUS_GAP = 0.2;
// RAM: the entry crater scales with the hit's damage, like it does on enemies; the tunnel behind
// it is this fraction of the crater.
const RAM_DAMAGE = 70;
const RAM_TUNNEL = 0.75;
// Heavy pieces fall in slow motion, like a film collapse: a piece's clock runs at pace(mass),
// from nearly real time for rubble down to 35% for a tower top. Before moving, a heavy piece
// creaks in place for up to CREAK_MAX seconds while the break groans and sheds dust.
const pace = mass => Math.max(0.35, 1 / (1 + Math.sqrt(mass) / 20));
const CREAK_MAX = 0.8;
// How hard each attack shoves a falling piece: velocity change = KICK / (mass + 40) px/s.
const KICK = Object.freeze({ punch: 9000, ram: 24000, groundpound: 12000, laser: 0, crush: 0, blast: 16000 });
// Pieces at least this heavy shake the camera with a low rumble the whole way down.
const RUMBLE_MASS = 250;
// Camera quake: a landing jolts the view at full strength for a hold as long as the old shake
// (0.18s plus more for size), then trauma (0–1) drains at QUAKE_DECAY per second. The view jumps
// by up to QUAKE_PX world pixels × trauma^1.5 at random each frame, so it stays violent but
// eases out instead of stopping dead.
const QUAKE_PX = 0;
const QUAKE_DECAY = 0.7 / 1.5;
// Grab and throw: a piece of at most LIFT_RUBBLE cells and LIFT_LONG px on its longer side can be
// lifted: a spire's top broken off fits (about 600 cells, 290 px), a whole tower felled at its base
// (about 4000 cells, 590 px) does not. It hits for LIFT_HIT damage per cell.
const LIFT_RUBBLE = 900;
const LIFT_LONG = 320;
// Half the width, in px, of the column over the hero's hands that a held piece rests on.
const LIFT_HANDS = 3;
const LIFT_HIT = 0.6;
// A chunk point striking the ground faster than this crumbles the part within reach of it (up
// to CRUMBLE_MAX px); a chunk left with under CRUMBLE_KEEP cells shatters whole.
const CRUMBLE_SPEED = 120;
const CRUMBLE_MAX = 96;
const CRUMBLE_KEEP = 40;
// Bounds corners are used for broad-phase bounds; physical contacts follow solid masonry.
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

// Carve shape per attack, in logical pixels, and how hard the debris flies.
const HITS = Object.freeze({
  punch: { radius: 10, burst: 230 },
  ram: { radius: 20, burst: 340 },
  groundpound: { radius: 18, burst: 260 },
  laser: { radius: 3, burst: 60, molten: true },
  crush: { radius: 10, burst: 160 },
  blast: { radius: 18, burst: 300 },
});

function hash(i) {
  const s = Math.sin(i * 91.7 + 13.1) * 43758.5453;
  return s - Math.floor(s);
}

// A ground strike often leaves one horizontal run per row. Overlapping consecutive
// runs prove four-neighbour connectivity without labeling every surviving cell.
// Holes, empty interior rows or disjoint runs fall back to the general flood.
function singleRowPiece(grid, bounds) {
  const { cols, rows, cells } = grid;
  const piece = { label: 1, count: 0, c0: cols, c1: -1, r0: rows, r1: -1, sumC: 0, sumR: 0 };
  let previousLeft = -1, previousRight = -1, previousRow = -2;
  for (let r = bounds.r0; r <= bounds.r1; r++) {
    const base = r * cols;
    let left = bounds.c0;
    while (left <= bounds.c1 && !cells[base + left]) left++;
    if (left > bounds.c1) continue;
    let end = left + 1;
    while (end <= bounds.c1 && cells[base + end]) end++;
    for (let c = end + 1; c <= bounds.c1; c++) if (cells[base + c]) return null;
    const right = end - 1;
    if (piece.count && (previousRow !== r - 1 || left > previousRight || right < previousLeft)) return null;
    const count = end - left;
    piece.count += count;
    piece.sumC += count * (left + right + 1) / 2;
    piece.sumR += count * (r + 0.5);
    piece.c0 = Math.min(piece.c0, left); piece.c1 = Math.max(piece.c1, right);
    piece.r0 = Math.min(piece.r0, r); piece.r1 = r;
    previousLeft = left; previousRight = right; previousRow = r;
  }
  return piece.count ? piece : null;
}

// A destruction grid in cells: row 0 is the top, the last row rests on the ground.
export class BuildingGrid {
  constructor(cols, rows, cells) {
    this.cols = cols;
    this.rows = rows;
    this.cells = cells;
    this.total = this.count();
  }

  has(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.cells[r * this.cols + c] === 1;
  }

  count() {
    let total = 0;
    for (const cell of this.cells) total += cell;
    return total;
  }

  remove(list) {
    for (const [c, r] of list) this.cells[r * this.cols + c] = 0;
  }

  // Removes solid cells within radius (in cells) of a point, with a ragged edge. Returns them.
  carve(cx, cy, radius, seed = 0) {
    const removed = [];
    const reach = Math.ceil(radius + 1);
    for (let r = Math.floor(cy - reach); r <= cy + reach; r++) {
      for (let c = Math.floor(cx - reach); c <= cx + reach; c++) {
        if (!this.has(c, r)) continue;
        const edge = radius * (0.7 + 0.5 * hash(c * 7.3 + r * 3.1 + seed));
        if (Math.hypot(c + 0.5 - cx, r + 0.5 - cy) > edge) continue;
        this.cells[r * this.cols + c] = 0;
        removed.push([c, r]);
      }
    }
    return removed;
  }

  nearestSolid(cx, cy, maxDistance) {
    let best = null;
    const reach = Math.ceil(maxDistance);
    for (let r = Math.floor(cy) - reach; r <= Math.floor(cy) + reach; r++) {
      for (let c = Math.floor(cx) - reach; c <= Math.floor(cx) + reach; c++) {
        if (!this.has(c, r)) continue;
        const distance = Math.hypot(c + 0.5 - cx, r + 0.5 - cy);
        if (distance <= maxDistance && (!best || distance < best.distance)) best = { c, r, distance };
      }
    }
    return best;
  }

  // Connected solid cells from the seeds, staying within rows [top, bottom).
  flood(seeds, top = 0, bottom = this.rows, seen = new Uint8Array(this.cells.length)) {
    const group = [];
    const stack = [...seeds];
    while (stack.length) {
      const [c, r] = stack.pop();
      if (r < top || r >= bottom || !this.has(c, r) || seen[r * this.cols + c]) continue;
      seen[r * this.cols + c] = 1;
      group.push([c, r]);
      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    return group;
  }

  // Allocation-free flood: marks the solid cells connected to index start within rows [top, bottom)
  // in seen and returns how many. rowCounts, when given, gets each row's share; support counts the
  // cells on row bottom - 1 resting on a solid cell below. Mega-towers have ~75k cells, so the
  // per-hit structure checks must not build an array per cell.
  mark(start, top, bottom, seen, rowCounts = null) {
    const { cols, cells } = this;
    if (!this.stack || this.stack.length < cells.length) this.stack = new Int32Array(cells.length);
    const stack = this.stack;
    let size = 0;
    let count = 0;
    let support = 0;
    if (cells[start] && !seen[start]) { seen[start] = 2; stack[size++] = start; }
    while (size) {
      const at = stack[--size];
      if (seen[at] !== 2) continue;
      const r = (at / cols) | 0, c = at - r * cols, base = r * cols;
      let left = c, right = c;
      while (left > 0 && cells[base + left - 1] && seen[base + left - 1] !== 1) left--;
      while (right + 1 < cols && cells[base + right + 1] && seen[base + right + 1] !== 1) right++;
      seen.fill(1, base + left, base + right + 1);
      const length = right - left + 1;
      count += length;
      if (rowCounts) rowCounts[r] += length;
      if (r === bottom - 1 && r + 1 < this.rows) {
        for (let col = left; col <= right; col++) support += cells[base + cols + col];
      }
      for (let nextRow = r - 1; nextRow <= r + 1; nextRow += 2) {
        if (nextRow < top || nextRow >= bottom) continue;
        const nextBase = nextRow * cols;
        let inRun = false;
        for (let col = left; col <= right; col++) {
          const next = nextBase + col;
          if (cells[next] && !seen[next]) {
            if (!inRun) { seen[next] = 2; stack[size++] = next; }
            inRun = true;
          } else inRun = false;
        }
      }
    }
    return { count, support };
  }

  // Breaks off what the structure no longer holds. rowsTouched limits the neck search to rows a
  // carve changed. Returns removed groups: { cells, pivot, side } where pivot is the hinge point (in
  // cells) for a toppling load, or null for a piece that falls free, and side is the way it tips.
  // lean breaks a tie when the load sits straight over its neck.
  detach(rowsTouched = [], lean = 0, bounds = null) {
    const groups = [];
    const { c0, c1, r0, r1 } = bounds ?? { c0: 0, c1: this.cols - 1, r0: 0, r1: this.rows - 1 };
    const seen = this.supportSeen ??= new Uint8Array(this.cells.length);
    const rowCounts = this.supportRows ??= new Int32Array(this.rows);
    for (const r of [...new Set(rowsTouched)].sort((a, b) => b - a)) {
      if (r < 1 || r >= this.rows) continue;
      seen.fill(0);
      for (let c = c0; c <= c1; c++) {
        const start = (r - 1) * this.cols + c;
        if (!this.cells[start] || seen[start]) continue;
        // A contiguous ledge is part of one connected load. If its direct supports
        // already exceed the widest possible neck threshold, that load cannot snap
        // here. Avoid flooding an entire tower for each row of a small crater.
        let end = c, directSupport = 0;
        while (end < this.cols && this.cells[(r - 1) * this.cols + end]) {
          directSupport += this.cells[r * this.cols + end];
          end++;
        }
        if (directSupport > Math.max(1, Math.floor(this.cols * NECK_RATIO))) {
          c = end - 1;
          continue;
        }
        rowCounts.fill(0, 0, r);
        const measured = this.mark(start, 0, r, seen, rowCounts);
        if (measured.count < NECK_LOAD) continue;
        let width = 0;
        for (let lr = 0; lr < r; lr++) width = Math.max(width, rowCounts[lr]);
        if (measured.support > Math.max(1, Math.floor(width * NECK_RATIO))) continue;
        // A neck: only now gather the load's cells, which is rare.
        const load = this.flood([[c, r - 1]], 0, r);
        const support = [];
        for (const [lc, lr] of load) if (lr === r - 1 && this.has(lc, r)) support.push(lc);
        this.remove(load);
        if (!support.length) {
          groups.push({ cells: load, pivot: null, side: lean });
          continue;
        }
        // It hinges on what is left of the neck and tips the way its weight hangs; lean breaks a tie.
        const neck = support.reduce((a, b) => a + b) / support.length + 0.5;
        const centre = load.reduce((sum, [lc]) => sum + lc + 0.5, 0) / load.length;
        const side = Math.abs(centre - neck) > 0.5 ? Math.sign(centre - neck) : lean || 1;
        groups.push({ cells: load, pivot: { c: neck, r }, side });
      }
    }
    // Islands: anything with no path down to the ground row.
    const grounded = seen.fill(0);
    // The original ground row remains the only support, even after the base vanishes.
    for (let c = c0; c <= c1; c++) this.mark((this.rows - 1) * this.cols + c, 0, this.rows, grounded);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * this.cols + c;
        if (!this.cells[i] || grounded[i]) continue;
        const island = this.flood([[c, r]], 0, this.rows, grounded);
        this.remove(island);
        groups.push({ cells: island, pivot: null, side: lean });
      }
    }
    return groups;
  }
}

// Draws Phaser Graphics calls onto a 2D canvas, so city art can be baked into textures.
class CanvasPen {
  constructor(ctx) {
    this.ctx = ctx;
  }

  static rgba(color, alpha = 1) {
    return `rgba(${color >> 16 & 255},${color >> 8 & 255},${color & 255},${alpha})`;
  }

  fillStyle(color, alpha) { this.ctx.fillStyle = CanvasPen.rgba(color, alpha); }
  lineStyle(width, color, alpha) {
    this.ctx.lineWidth = width;
    this.ctx.strokeStyle = CanvasPen.rgba(color, alpha);
  }
  save() { this.ctx.save(); }
  restore() { this.ctx.restore(); }
  translateCanvas(x, y) { this.ctx.translate(x, y); }
  scaleCanvas(x, y) { this.ctx.scale(x, y); }
  rotateCanvas(angle) { this.ctx.rotate(angle); }
  fillPoints(points, closePath = false) {
    if (!points.length) return;
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) this.ctx.lineTo(point.x, point.y);
    if (closePath) this.ctx.closePath();
    this.ctx.fill();
  }
  fillRoundedRect(x, y, w, h, radius = 0) {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, radius);
    this.ctx.fill();
  }
  strokeCircle(x, y, radius) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }
  fillRect(x, y, w, h) { this.ctx.fillRect(x, y, w, h); }
  fillCircle(x, y, radius) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
  fillEllipse(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }
  fillTriangle(x1, y1, x2, y2, x3, y3) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.fill();
  }
  lineBetween(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }
}

// Buildings and falling chunks share a frame: cell (comC, comR) sits at world (x, y), rotated
// by angle. A standing building has angle 0 and its top-left corner at cell (0, 0).
function toLocal(piece, x, y) {
  const cos = Math.cos(piece.angle);
  const sin = Math.sin(piece.angle);
  const dx = x - piece.x;
  const dy = y - piece.y;
  return { c: (dx * cos + dy * sin) / CELL + piece.comC, r: (dy * cos - dx * sin) / CELL + piece.comR };
}

function toWorld(piece, c, r) {
  const cos = Math.cos(piece.angle);
  const sin = Math.sin(piece.angle);
  const dx = (c - piece.comC) * CELL;
  const dy = (r - piece.comR) * CELL;
  return { x: piece.x + dx * cos - dy * sin, y: piece.y + dx * sin + dy * cos };
}

function localDirection(piece, direction) {
  const cos = Math.cos(piece.angle);
  const sin = Math.sin(piece.angle);
  return { x: direction.x * cos + direction.y * sin, y: direction.y * cos - direction.x * sin };
}

// Grows a piece's dirty rect (canvas px) so the next draw uploads only what changed.
function markDirty(piece, x0, y0, x1, y1) {
  const d = piece.dirty || (piece.dirty = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  d.x0 = Math.min(d.x0, x0); d.y0 = Math.min(d.y0, y0);
  d.x1 = Math.max(d.x1, x1); d.y1 = Math.max(d.y1, y1);
}

// Uploads just a piece's dirty rect to the GPU. A full refresh re-sends the whole canvas, megabytes
// for a mega-tower, on every hit. Binds through Phaser's texture units so its GL state stays in sync.
function upload(scene, piece) {
  const rect = piece.dirty;
  piece.dirty = false;
  const texture = scene.textures.get(piece.key);
  const renderer = scene.sys.renderer;
  const gl = renderer.gl;
  const glTexture = texture.source[0].glTexture;
  const x = Math.max(0, Math.floor(rect.x0));
  const y = Math.max(0, Math.floor(rect.y0));
  const w = Math.min(piece.canvas.width, Math.ceil(rect.x1)) - x;
  const h = Math.min(piece.canvas.height, Math.ceil(rect.y1)) - y;
  if (!gl || !glTexture || w <= 0 || h <= 0 || w * h > piece.canvas.width * piece.canvas.height * 0.5) {
    if (w > 0 && h > 0) texture.refresh();
    return;
  }
  renderer.glTextureUnits.bind(glTexture, 0);
  renderer.glWrapper.updateTexturing({ texturing: { flipY: glTexture.flipY, premultiplyAlpha: glTexture.pma } });
  const pixels = piece.ctx.getImageData(x, y, w, h);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, x, glTexture.flipY ? piece.canvas.height - y - h : y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
}

function canvas(width, height) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

// ponytail: buildings are baked at their base planet copy and lose their animation (clock,
// flags, beacons) while promoted; bake per wrap copy and re-draw animated parts if that matters.
export class CityDestruction {
  constructor(scene, buildings, groundAt, groundMin = null) {
    this.scene = scene;
    this.groundAt = groundAt;
    this.groundMin = groundMin;
    this.debris = [];
    this.piles = new PersistentRubble(groundAt);
    this.dust = [];
    this.chunks = [];
    this.serial = 0;
    this.trauma = 0;
    this.clock = 0;
    this.focus = null;
    this.quakeHold = 0;
    this.quakeOffset = { x: 0, y: 0 };
    this.quakeScroll = null; // Camera scroll after the last quake; reused each frame once set.
    // Keep debris and dust in their original render slot, with all puffs above
    // the chips. A shared circle avoids rebuilding/tessellating 160 paths per frame.
    this.effects = scene.add.layer().setDepth(3);
    this.front = scene.add.graphics();
    this.effects.add(this.front);
    const dustKey = 'city-destruction-dust';
    if (!scene.textures.exists(dustKey)) {
      const shape = scene.make.graphics({ add: false });
      shape.fillStyle(0xcfc6b6, 1).fillCircle(64, 64, 64);
      shape.generateTexture(dustKey, 128, 128);
      shape.destroy();
    }
    this.dustImages = Array.from({ length: MAX_DUST }, () => {
      const image = scene.add.image(0, 0, dustKey).setVisible(false);
      this.effects.add(image);
      return image;
    });
    this.visibleDust = 0;
    // Optional listeners for street life: onLanding(from, to, size) when a falling piece hits the
    // ground across world x [from, to]; onBreak(x) when a hit breaks something at world x.
    this.onLanding = null;
    this.onBreak = null;
    this.bodies = buildings.map(building => this.bake(building));
  }

  destroy() {
    this.piles.destroy(this.scene);
    for (const body of this.bodies) this.release(body.image, body.key);
    for (const chunk of this.chunks) this.release(chunk.image, chunk.key);
    this.effects.destroy();
  }

  release(image, key) {
    image.destroy();
    this.scene.textures.remove(key);
  }

  bake(building) {
    const cols = Math.ceil((building.width + PAD * 2) / CELL);
    const rows = Math.ceil((building.height + PAD) / CELL);
    // A ship sets her own waterline (building.surface); a building stands on the ground.
    const surface = building.surface ?? this.groundAt(building.x);
    const left = Math.round(building.x - cols * CELL / 2);
    const top = surface + 3 - rows * CELL;
    // A tower taller than the GPU's biggest texture bakes at 1 px per world px instead of RES.
    const max = this.scene.sys?.renderer?.getMaxTextureSize?.() ?? 4096;
    const res = Math.max(cols, rows) * CELL * RES > max ? 1 : RES;
    const element = canvas(cols * CELL * res, rows * CELL * res);
    const ctx = element.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(res, 0, 0, res, 0, 0);
    building.draw(new CanvasPen(ctx), building.x - left, rows * CELL, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Cells come from the art drawn again at one pixel per cell: antialiasing makes each pixel's
    // alpha the cell's coverage and its colour the average. Scanning every pixel of a mega-tower
    // at RES took over 100 ms. Cells under a tenth full still count (thin aerials, cables), matching
    // the old per-pixel scan on 99.7% of cells.
    const small = canvas(cols, rows);
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
    building.draw(new CanvasPen(sctx), building.x - left, rows * CELL, 0);
    const pixels = sctx.getImageData(0, 0, cols, rows).data;
    const cells = new Uint8Array(cols * rows);
    const colors = new Uint32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) {
      if (pixels[i * 4 + 3] < 12) continue;
      cells[i] = 1;
      colors[i] = pixels[i * 4] << 16 | pixels[i * 4 + 1] << 8 | pixels[i * 4 + 2];
    }
    const key = `building-${building.id}-${this.serial++}`;
    this.scene.textures.addCanvas(key, element);
    const image = this.scene.add.image(left, top, key).setOrigin(0, 0).setScale(1 / res).setDepth(1);
    return {
      building, grid: new BuildingGrid(cols, rows, cells), colors, canvas: element, ctx, key, image,
      left, top, res, shake: 0, dirty: false, prop: null, toughness: toughness(building), heat: 0,
      x: left, y: top, angle: 0, comC: 0, comR: 0,
    };
  }

  // Combat props for the arena: one per building, kept to the solid cells' bounds.
  props() {
    return this.bodies.map(body => {
      const prop = {
        buildingId: body.building.id, maxHealth: body.building.maxHealth, material: 'stone', scenery: true,
        x: body.building.x, y: 0, width: 1, height: 1,
        trace: (from, to, padding, frame) => this.trace(body, from, to, padding, frame),
      };
      body.propDefinition = prop;
      this.fit(body, prop);
      return prop;
    });
  }

  link(arena) {
    this.arena = arena;
    for (const body of this.bodies) {
      body.prop = arena.props.find(prop => prop.buildingId === body.building.id);
      this.fit(body, body.prop);
    }
  }

  // Promotes a building mid-game (a big ship the hero has just hit): baked like the rest and
  // joined to the arena as a target. Returns its body.
  addBody(building) {
    const body = this.bake(building);
    this.bodies.push(body);
    if (!this.arena) return body;
    body.prop = {
      id: `prop-${building.id}`, buildingId: building.id, material: 'stone', scenery: true, destructible: true,
      anchored: true, maxHealth: building.maxHealth, health: building.maxHealth, x: building.x, y: 0, width: 1, height: 1,
      radius: 0, previousX: building.x, previousY: 0, homeX: building.x, homeY: 0, vx: 0, vy: 0, flash: 0, reaction: 0,
      recoil: 0, deathAge: 0, laserFeedback: 0, laserDamage: 0, lastPunch: null,
      trace: (from, to, padding, frame) => this.trace(body, from, to, padding, frame),
    };
    this.fit(body, body.prop);
    this.arena.props.push(body.prop);
    this.arena.damageables.push(body.prop);
    return body;
  }

  // Falling chunks join the arena as targets too, so the hero can keep smashing them mid-fall.
  addChunkProp(chunk) {
    if (!this.arena) return;
    chunk.prop = {
      id: chunk.key, buildingId: chunk.key, chunk, material: 'stone', scenery: true, destructible: true,
      anchored: true, maxHealth: chunk.mass, health: chunk.mass, x: chunk.x, y: chunk.y, width: 1, height: 1,
      radius: 0, previousX: chunk.x, previousY: chunk.y, vx: 0, vy: 0, flash: 0, reaction: 0, recoil: 0,
      deathAge: 0, laserFeedback: 0, laserDamage: 0, lastPunch: null,
      trace: (from, to, padding, frame) => this.trace(chunk, from, to, padding, frame),
    };
    this.fitChunk(chunk);
    this.arena.props.push(chunk.prop);
    this.arena.damageables.push(chunk.prop);
  }

  fitChunk(chunk) {
    const { prop } = chunk;
    if (!prop) return;
    const cos = Math.cos(chunk.angle), sin = Math.sin(chunk.angle);
    prop.width = 2 * (Math.abs(cos) * chunk.halfW + Math.abs(sin) * chunk.halfH);
    prop.height = 2 * (Math.abs(sin) * chunk.halfW + Math.abs(cos) * chunk.halfH);
    prop.x = chunk.x + chunk.offset.x * cos - chunk.offset.y * sin;
    prop.y = chunk.y + chunk.offset.x * sin + chunk.offset.y * cos;
    prop.health = chunk.mass;
  }

  removeChunk(chunk) {
    const index = this.chunks.indexOf(chunk);
    if (index !== -1) this.chunks.splice(index, 1);
    this.release(chunk.image, chunk.key);
    if (!chunk.prop || !this.arena) return;
    chunk.prop.health = 0;
    this.arena.props = this.arena.props.filter(prop => prop !== chunk.prop);
    this.arena.damageables = this.arena.damageables.filter(prop => prop !== chunk.prop);
  }

  fit(body, prop) {
    const { grid } = body;
    const bounds = body.cellBounds ?? { c0: 0, c1: grid.cols - 1, r0: 0, r1: grid.rows - 1 };
    let c0 = grid.cols, c1 = -1, r0 = grid.rows, r1 = -1, solid = 0;
    for (let r = bounds.r0; r <= bounds.r1; r++) {
      let first = -1, last = -1;
      for (let c = bounds.c0; c <= bounds.c1; c++) {
        if (!grid.cells[r * grid.cols + c]) continue;
        solid++;
        if (first < 0) first = c;
        last = c;
      }
      if (first < 0) continue;
      c0 = Math.min(c0, first); c1 = Math.max(c1, last);
      r0 = Math.min(r0, r); r1 = r;
    }
    // Masonry only disappears, so subsequent refits can skip the empty outer grid.
    body.cellBounds = { c0, c1, r0, r1 };
    // A building is destroyed once at least 80% of its original standing masonry is gone.
    if (!body.isChunk && !body.building.ship && !body.destroyedReported && solid <= grid.total * 0.2) {
      body.destroyedReported = true;
      this.onDestroyed?.(body);
    }
    if (!solid) {
      prop.health = 0;
      return 0;
    }
    prop.width = (c1 - c0 + 1) * CELL;
    prop.height = (r1 - r0 + 1) * CELL;
    prop.x = body.left + c0 * CELL + prop.width / 2;
    prop.y = body.top + r0 * CELL + prop.height / 2;
    prop.radius = prop.height / 2;
    // A holed ship loses strength SHIP_FRAGILE times faster than a building loses its walls.
    const lost = (1 - solid / grid.total) * (body.building.ship ? SHIP_FRAGILE : 1);
    if ('health' in prop) prop.health = Math.max(1, prop.maxHealth * (1 - Math.min(1, lost)));
    return solid;
  }

  // Where along from→to the segment first meets a solid cell (0–1), or null. padding widens
  // the test by that many pixels, like a fist's reach. frame is where the caller placed the
  // building: segments given relative to a moved copy are shifted back into the world.
  trace(piece, segmentFrom, segmentTo, padding = 0, frame = piece.prop) {
    const prop = piece.prop;
    if (!prop || prop.health <= 0) return null;
    const shift = { x: prop.x - (frame?.x ?? prop.x), y: prop.y - (frame?.y ?? prop.y) };
    const from = { x: segmentFrom.x + shift.x, y: segmentFrom.y + shift.y };
    const to = { x: segmentTo.x + shift.x, y: segmentTo.y + shift.y };
    const halfW = prop.width / 2 + padding;
    const halfH = prop.height / 2 + padding;
    if (Math.max(from.x, to.x) < prop.x - halfW || Math.min(from.x, to.x) > prop.x + halfW
      || Math.max(from.y, to.y) < prop.y - halfH || Math.min(from.y, to.y) > prop.y + halfH) return null;
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (CELL / 2)));
    const reach = padding / CELL;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { c, r } = toLocal(piece, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      if (reach ? piece.grid.nearestSolid(c, r, reach + 0.5) : piece.grid.has(Math.floor(c), Math.floor(r))) return t;
    }
    return null;
  }

  // Is there standing masonry at world (x, y)? For things that fly into buildings. reach: in cells
  // (0.5 for the cell at the point only).
  solidAt(x, y, reach = 1.5) {
    for (const body of this.bodies) {
      const { prop } = body;
      if (!prop || prop.health <= 0 || Math.abs(x - prop.x) > prop.width / 2 || Math.abs(y - prop.y) > prop.height / 2) continue;
      const local = toLocal(body, x, y);
      if (body.grid.nearestSolid(local.c, local.r, reach)) return true;
    }
    return false;
  }

  bodyFor(prop) {
    return prop.chunk ?? this.bodies.find(body => body.prop === prop);
  }

  // Arena hook: a punch, RAM, ground pound or laser landed on a building or a falling chunk.
  hit(prop, amount, direction, kind, point) {
    const body = this.bodyFor(prop);
    if (!body) return;
    let at = point;
    if (kind === 'groundpound' && !prop.chunk) {
      // The pound comes along the ground: break the base on the side facing it.
      const side = direction.x >= 0 ? -1 : 1;
      at = { x: prop.x + side * prop.width * 0.4, y: this.groundAt(prop.x) - 8 };
    }
    if (kind === 'laser') {
      // Big buildings soak the beam: the spot glows and spits embers until enough heat builds up.
      body.heat += amount * this.focusOn(point, direction);
      if (body.heat < LASER_HEAT * body.toughness) {
        if (hash(this.serial++) < 0.35 * this.focus.intensity) {
          this.addDebris({ x: point.x, y: point.y, vx: -direction.x * 40 + (hash(this.serial) - 0.5) * 50,
            vy: -40 - hash(this.serial + 1) * 40, size: 1, color: 0xff9a3c, glow: 0.9 });
        }
        return;
      }
      body.heat -= LASER_HEAT * body.toughness;
    }
    const scale = kind === 'groundpound' || kind === 'blast' ? Math.min(1.4, amount / 70)
      : kind === 'ram' ? amount / RAM_DAMAGE : 1;
    if (prop.chunk) this.kick(prop.chunk, at, direction, KICK[kind] * scale);
    if (this.impact(body, at, direction, kind, scale)) this.onBreak?.(at.x);
  }

  // How hard the beam heats: it ramps up while it stays within the focus area, across its line.
  focusOn(point, direction) {
    const focus = this.focus;
    const across = focus && Math.abs((focus.x - point.x) * direction.y - (focus.y - point.y) * direction.x);
    if (focus && this.clock - focus.last <= FOCUS_GAP && across <= FOCUS_RADIUS) {
      focus.time += this.clock - focus.last;
    } else {
      this.focus = { x: point.x, y: point.y, time: 0 };
    }
    this.focus.last = this.clock;
    // Exponential: a slow warm-up that surges near the end, rewarding holding on.
    this.focus.intensity = FOCUS_MAX ** Math.min(1, this.focus.time / FOCUS_RAMP);
    return this.focus.intensity;
  }

  // Shoves a chunk from a hit point: it tears off its hinge, wakes if resting, and spins.
  kick(chunk, point, direction, strength) {
    if (!strength) return;
    chunk.creak = 0;
    chunk.resting = false;
    const change = strength / (chunk.mass + 40);
    if (chunk.hinge) {
      // Still on its hinge: the hit swings it around the neck. Tearing it loose would drop it
      // straight through its own stump to shatter at once, the worst when hit from below.
      const rx = point.x - chunk.hinge.x;
      const ry = point.y - chunk.hinge.y;
      chunk.va += (rx * direction.y - ry * direction.x) * change / (chunk.arm.x ** 2 + chunk.arm.y ** 2 + 1) * 1.5;
      return;
    }
    chunk.vx += direction.x * change;
    chunk.vy += direction.y * change;
    const rx = point.x - chunk.x;
    const ry = point.y - chunk.y;
    chunk.va += (rx * direction.y - ry * direction.x) * change / (chunk.halfW ** 2 + chunk.halfH ** 2) * 1.5;
  }

  // RAM tunnels: carve along the hero's path through every building it crosses this step.
  // Returns the distance (px) travelled inside buildings, so RAM can pay for long plows.
  ram(from, to, velocity) {
    let inside = 0;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const direction = { x: velocity.x / (Math.hypot(velocity.x, velocity.y) || 1), y: velocity.y / (Math.hypot(velocity.x, velocity.y) || 1) };
    for (const body of [...this.bodies, ...this.chunks]) {
      const { prop } = body;
      if (!prop || prop.health <= 0) continue;
      if (Math.max(from.x, to.x) < prop.x - prop.width / 2 - 12 || Math.min(from.x, to.x) > prop.x + prop.width / 2 + 12
        || Math.max(from.y, to.y) < prop.y - prop.height / 2 - 12 || Math.min(from.y, to.y) > prop.y + prop.height / 2 + 12) continue;
      const radius = HITS.ram.radius * RAM_TUNNEL / CELL;
      let broke = false;
      for (let travelled = 0; travelled <= length; travelled += CELL * 1.5) {
        const t = length ? travelled / length : 0;
        const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
        // Only tunnel where the hero is actually inside the building, not in the air beside it.
        const local = toLocal(body, point.x, point.y);
        // Each carve clears ahead of the hero, so "inside" looks wider than the carve gate: the
        // tunnel's own walls still count, or RAM would only feel the building every few steps.
        if (!body.grid.nearestSolid(local.c, local.r, radius * 2)) continue;
        inside = Math.max(inside, Math.min(length, travelled + CELL * 1.5));
        if (!body.grid.nearestSolid(local.c, local.r, radius)) continue;
        broke = this.impact(body, point, direction, 'ram', RAM_TUNNEL) > 0 || broke;
      }
      if (broke) this.onBreak?.(to.x);
    }
    return inside;
  }

  impact(body, point, worldDirection, kind, scale = 1, quiet = false, crushRows = null) {
    const rule = HITS[kind] ?? HITS.punch;
    const { grid } = body;
    const radius = rule.radius * scale / CELL;
    const local = toLocal(body, point.x, point.y);
    const direction = localDirection(body, worldDirection);
    let near = grid.nearestSolid(local.c, local.r, radius + 1.5);
    // Through an existing hole, carry on along the hit to the next wall: lasers bore deep,
    // fists reach a little.
    const reach = kind === 'laser' ? 160 : radius + 4;
    for (let step = 1; !near && step <= reach; step++) {
      near = grid.nearestSolid(local.c + direction.x * step, local.r + direction.y * step, 0.8);
    }
    if (!near) return 0;
    // Punches and pounds blow out the far side a little, so hits read as force, not erasing.
    const cx = near.c + 0.5 + direction.x * radius * 0.35;
    const cy = near.r + 0.5 + direction.y * radius * 0.35;
    const removed = grid.carve(cx, cy, radius, this.serial++);
    if (!removed.length) return 0;
    this.clear(body, removed);
    if (kind !== 'crush') sound.hit(kind, Math.min(1, removed.length / 60));
    this.scorch(body, cx, cy, radius, rule.molten);
    if (!quiet || hash(this.serial) < 0.5) this.burst(body, removed, worldDirection, rule.burst * scale, rule.molten);
    body.shake = Math.min(0.25, body.shake + (rule.molten ? 0.02 : 0.12));
    if (body.isChunk) {
      this.split(body, Math.sign(worldDirection.x));
      return removed.length;
    }
    // A ship's hull holes and burns but never breaks into falling blocks (QA-08): she sinks instead.
    if (body.building.ship) {
      if (body.prop) this.fit(body, body.prop);
      return removed.length;
    }
    const rows = [...new Set(removed.map(([, r]) => r))];
    // A long falling edge can carve the same building at many contact points in one step.
    // Apply every crater, then assess its combined support once after those contacts.
    if (crushRows) {
      for (const r of rows) { crushRows.add(r); crushRows.add(r + 1); }
      return removed.length;
    }
    this.collapse(body, rows.flatMap(r => [r, r + 1]), Math.sign(worldDirection.x));
    return removed.length;
  }

  clear(body, cells) {
    const span = CELL * body.res;
    // Neighbouring cells in a row clear as one rect: a crumbling tower clears thousands at once.
    for (let i = 0; i < cells.length; i++) {
      const [c, r] = cells[i];
      let end = c;
      while (i + 1 < cells.length && cells[i + 1][1] === r && cells[i + 1][0] === end + 1) { end++; i++; }
      body.ctx.clearRect(c * span, r * span, (end - c + 1) * span, span);
      markDirty(body, c * span, r * span, (end + 1) * span, (r + 1) * span);
    }
  }

  // Darkens the broken edge and runs a few cracks out from it, only over remaining pixels.
  scorch(body, cx, cy, radius, molten) {
    const { ctx } = body;
    const span = CELL * body.res;
    // The burn and its cracks stay within about radius + 7 cells of the hit.
    const reach = (radius + 7) * span;
    markDirty(body, cx * span - reach, cy * span - reach, cx * span + reach, cy * span + reach);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = molten ? 'rgba(255,120,40,0.35)' : 'rgba(38,44,50,0.4)';
    ctx.beginPath();
    ctx.arc(cx * span, cy * span, (radius + 1.4) * span, 0, Math.PI * 2);
    ctx.fill();
    if (!molten) {
      ctx.strokeStyle = 'rgba(40,46,52,0.75)';
      ctx.lineWidth = body.res;
      for (let i = 0; i < 3; i++) {
        const angle = hash(this.serial + i * 3.7) * Math.PI * 2;
        let x = cx * span + Math.cos(angle) * radius * span;
        let y = cy * span + Math.sin(angle) * radius * span;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let step = 0; step < 4; step++) {
          const turn = angle + (hash(this.serial + i + step) - 0.5) * 1.6;
          x += Math.cos(turn) * span * 1.4;
          y += Math.sin(turn) * span * 1.4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  burst(body, cells, direction, power, molten) {
    this.depositRubble(body, cells);
    for (const [c, r] of cells) {
      const color = body.colors[r * body.grid.cols + c];
      const { x, y } = toWorld(body, c + 0.5, r + 0.5);
      for (let i = 0; i < 2; i++) {
        const spread = (hash(x * 1.3 + y + i) - 0.5) * 2;
        const speed = power * (0.35 + 0.65 * hash(x + y * 0.7 + i));
        this.addDebris({
          x: x + (i - 0.5) * 2, y,
          vx: direction.x * speed + spread * power * 0.45,
          vy: direction.y * speed - power * 0.35 * hash(y + i) - 30,
          size: 1 + Math.round(hash(x * 0.9 + i) * 2),
          color: molten ? 0xff9a3c : color,
          glow: molten ? 0.8 : 0,
          glint: !molten && (color & 255) > 210 && (color >> 8 & 255) > 210,
        });
      }
    }
    const at = toWorld(body, cells[0][0] + 0.5, cells[0][1] + 0.5);
    this.addDust(at.x, at.y, Math.min(6, 1 + cells.length / 8), direction);
  }

  addDebris(piece) {
    // Callers hand over a fresh particle; keep it instead of allocating a second
    // object for every chip in a large landing.
    if (!('age' in piece)) piece.age = 0;
    if (!('settled' in piece)) piece.settled = false;
    this.debris.push(piece);
  }

  addDust(x, y, count, direction = { x: 0, y: 0 }, size = 1) {
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: x + (hash(x + i) - 0.5) * 10 * size, y: y + (hash(y + i) - 0.5) * 6 * size,
        vx: direction.x * 30 + (hash(x * 2 + i) - 0.5) * 50 * size, vy: -12 - hash(y * 2 + i) * 20,
        // Every puff is gone within DUST_LIFE seconds, whatever its size, so none hangs in the air.
        radius: (4 + hash(i + x) * 5) * size, age: 0, life: DUST_LIFE[0] + hash(i * 5 + y) * (DUST_LIFE[1] - DUST_LIFE[0]),
      });
    }
    if (this.dust.length > MAX_DUST) this.dust.splice(0, this.dust.length - MAX_DUST);
  }

  // Breaks off whatever the carve left unsupported and turns each piece into a falling chunk.
  collapse(body, rows, lean) {
    const groups = body.grid.detach(rows, lean, body.cellBounds);
    for (const group of groups) this.spawnChunk(body, group, lean);
    if (body.prop) {
      const solid = this.fit(body, body.prop);
      if (solid < body.grid.total * 0.04) {
        // Too little left to stand: the stump crumbles into rubble.
        const rest = [];
        for (let r = 0; r < body.grid.rows; r++) for (let c = 0; c < body.grid.cols; c++) if (body.grid.has(c, r)) rest.push([c, r]);
        body.grid.remove(rest);
        this.clear(body, rest);
        if (rest.length) this.burst(body, rest, { x: 0, y: -0.3 }, 60, false);
        body.prop.health = 0;
      }
    }
  }

  // A carved chunk keeps its biggest connected piece; the rest break away as their own chunks.
  split(chunk, lean) {
    const { grid } = chunk;
    const { cols, rows } = grid;
    // Flood horizontal runs, measuring their mass and balance arithmetically. Queued
    // seeds have a sentinel so ragged holes cannot queue the same cell repeatedly.
    const bounds = chunk.cellBounds ?? { c0: 0, c1: cols - 1, r0: 0, r1: rows - 1 };
    const simple = singleRowPiece(grid, bounds);
    const seen = simple ? null : grid.splitLabels ??= new Uint32Array(grid.cells.length);
    if (seen) seen.fill(0);
    const stack = simple ? null : grid.stack ??= new Int32Array(grid.cells.length);
    const queued = 0xffffffff;
    const pieces = simple ? [simple] : [];
    if (!simple) for (let row = bounds.r0; row <= bounds.r1; row++) for (let col = bounds.c0; col <= bounds.c1; col++) {
      const i = row * cols + col;
      if (!grid.cells[i] || seen[i]) continue;
      const piece = { label: pieces.length + 1, count: 0, c0: cols, c1: -1, r0: rows, r1: -1, sumC: 0, sumR: 0 };
      let size = 1;
      stack[0] = i; seen[i] = queued;
      while (size) {
        const at = stack[--size];
        if (seen[at] !== queued) continue;
        const r = (at / cols) | 0, c = at - r * cols;
        const base = r * cols;
        let left = c, right = c;
        while (left > bounds.c0 && grid.cells[base + left - 1]
          && (seen[base + left - 1] === 0 || seen[base + left - 1] === queued)) left--;
        while (right < bounds.c1 && grid.cells[base + right + 1]
          && (seen[base + right + 1] === 0 || seen[base + right + 1] === queued)) right++;
        seen.fill(piece.label, base + left, base + right + 1);
        const count = right - left + 1;
        piece.count += count;
        piece.c0 = Math.min(piece.c0, left); piece.c1 = Math.max(piece.c1, right);
        piece.r0 = Math.min(piece.r0, r); piece.r1 = Math.max(piece.r1, r);
        piece.sumC += count * (left + right + 1) / 2; piece.sumR += count * (r + 0.5);
        for (let nextRow = r - 1; nextRow <= r + 1; nextRow += 2) {
          if (nextRow < bounds.r0 || nextRow > bounds.r1) continue;
          const nextBase = nextRow * cols;
          let inRun = false;
          for (let nextCol = left; nextCol <= right; nextCol++) {
            const next = nextBase + nextCol;
            if (grid.cells[next] && !seen[next]) {
              if (!inRun) { seen[next] = queued; stack[size++] = next; }
              inRun = true;
            } else inRun = false;
          }
        }
      }
      pieces.push(piece);
    }
    pieces.sort((a, b) => b.count - a.count);
    const cellsOf = piece => {
      const cells = [];
      for (let r = piece.r0; r <= piece.r1; r++) for (let c = piece.c0; c <= piece.c1; c++) {
        if (simple ? grid.cells[r * cols + c] : seen[r * cols + c] === piece.label) cells.push([c, r]);
      }
      return cells;
    };
    for (const piece of pieces.slice(1)) {
      const cells = cellsOf(piece);
      grid.remove(cells);
      this.spawnChunk(chunk, { cells, pivot: null, side: lean }, lean);
    }
    chunk.mass = pieces[0]?.count ?? 0;
    if (chunk.mass < 6) {
      const rest = pieces[0] ? cellsOf(pieces[0]) : [];
      if (rest.length) this.burst(chunk, rest, { x: lean * 0.5, y: -0.5 }, 90, false);
      this.removeChunk(chunk);
      return;
    }
    chunk.pace = pace(chunk.mass);
    // Shrink the bounds to what is left, or the piece would stand on its missing cells.
    const { c0, c1, r0, r1, sumC, sumR } = pieces[0];
    chunk.cellBounds = { c0, c1, r0, r1 };
    // A cut changes the balance as well as the outline. Move the origin to the new centre
    // without moving any surviving pixels, retaining their linear and angular momentum.
    const comC = sumC / chunk.mass, comR = sumR / chunk.mass;
    const dx = (comC - chunk.comC) * CELL, dy = (comR - chunk.comR) * CELL;
    const cos = Math.cos(chunk.angle), sin = Math.sin(chunk.angle);
    const shiftX = dx * cos - dy * sin, shiftY = dx * sin + dy * cos;
    chunk.x += shiftX; chunk.y += shiftY;
    chunk.vx -= chunk.va * shiftY; chunk.vy += chunk.va * shiftX;
    chunk.comC = comC; chunk.comR = comR;
    chunk.image.setOrigin(comC / cols, comR / rows).setPosition(chunk.x, chunk.y);
    if (chunk.hinge) {
      const hx = chunk.x - chunk.hinge.x, hy = chunk.y - chunk.hinge.y;
      chunk.arm = { x: hx * cos + hy * sin, y: -hx * sin + hy * cos };
    }
    chunk.halfW = (c1 - c0 + 1) * CELL / 2;
    chunk.halfH = (r1 - r0 + 1) * CELL / 2;
    chunk.offset = { x: ((c0 + c1 + 1) / 2 - chunk.comC) * CELL, y: ((r0 + r1 + 1) / 2 - chunk.comR) * CELL };
    this.cacheContacts(chunk);
    this.fitChunk(chunk);
  }

  spawnChunk(body, { cells, pivot, side }, lean) {
    if (cells.length < 6) {
      this.clear(body, cells);
      this.burst(body, cells, { x: lean * 0.5, y: -0.5 }, 90, false);
      return;
    }
    let c0 = Infinity, c1 = -Infinity, r0 = Infinity, r1 = -Infinity, sumC = 0, sumR = 0;
    for (const [c, r] of cells) {
      c0 = Math.min(c0, c); c1 = Math.max(c1, c);
      r0 = Math.min(r0, r); r1 = Math.max(r1, r);
      sumC += c + 0.5; sumR += r + 0.5;
    }
    const cols = c1 - c0 + 1;
    const rows = r1 - r0 + 1;
    // A mega-tower's toppling top is megapixels: it falls at 1 px per world px, so breaking it
    // off doesn't stall a frame on the upload.
    const res = cols * rows * (CELL * body.res) ** 2 > CHUNK_PIXELS ? 1 : body.res;
    const from = CELL * body.res;
    const span = CELL * res;
    const element = canvas(cols * span, rows * span);
    const ctx = element.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(body.canvas, c0 * from, r0 * from, cols * from, rows * from, 0, 0, cols * span, rows * span);
    const mask = new Uint8Array(cols * rows);
    for (const [c, r] of cells) mask[(r - r0) * cols + (c - c0)] = 1;
    // Row runs: the chunk keeps only its own cells, and they leave the body, one rect per run.
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols;) {
        const solid = mask[r * cols + c];
        let end = c;
        while (end + 1 < cols && mask[r * cols + end + 1] === solid) end++;
        const width = (end - c + 1) * span;
        if (solid) {
          body.ctx.clearRect((c0 + c) * from, (r0 + r) * from, (end - c + 1) * from, from);
          markDirty(body, (c0 + c) * from, (r0 + r) * from, (c0 + end + 1) * from, (r0 + r + 1) * from);
        } else ctx.clearRect(c * span, r * span, width, span);
        c = end + 1;
      }
    }
    const comC = sumC / cells.length;
    const comR = sumR / cells.length;
    const colors = new Uint32Array(cols * rows);
    for (const [c, r] of cells) colors[(r - r0) * cols + (c - c0)] = body.colors[r * body.grid.cols + c];
    const key = `chunk-${this.serial++}`;
    this.scene.textures.addCanvas(key, element);
    const image = this.scene.add.image(0, 0, key).setScale(1 / res).setDepth(1.5)
      .setOrigin((comC - c0) / cols, (comR - r0) / rows);
    const com = toWorld(body, comC, comR);
    // A piece breaking off a moving chunk keeps that chunk's motion at its own position.
    const spin = body.va ?? 0;
    const chunk = {
      isChunk: true, key, image, body: body.body ?? body, res, canvas: element, ctx, dirty: false, shake: 0,
      grid: new BuildingGrid(cols, rows, mask), colors, mass: cells.length,
      toughness: body.toughness, heat: 0, comC: comC - c0, comR: comR - r0,
      x: com.x, y: com.y, angle: body.angle,
      vx: (body.vx ?? 0) - spin * (com.y - body.y), vy: (body.vy ?? 0) + spin * (com.x - body.x),
      va: pivot ? side * 0.45 : spin + (!body.isChunk && rows > cols * 2
        ? (side || lean || (hash(this.serial) < 0.5 ? -1 : 1)) * 0.35
        : (hash(this.serial) - 0.5) * 0.8),
      hinge: pivot ? toWorld(body, pivot.c, pivot.r) : null,
      halfW: cols * CELL / 2, halfH: rows * CELL / 2, age: 0,
      pace: pace(cells.length), creak: body.isChunk ? 0 : Math.min(CREAK_MAX, cells.length / 1200), rumble: 0,
    };
    if (chunk.hinge) {
      const dx = com.x - chunk.hinge.x, dy = com.y - chunk.hinge.y;
      const cos = Math.cos(chunk.angle), sin = Math.sin(chunk.angle);
      chunk.arm = { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    }
    // Bounds centre relative to the centre of mass, for ground and crush contacts.
    chunk.offset = { x: (cols / 2 - (comC - c0)) * CELL, y: (rows / 2 - (comR - r0)) * CELL };
    this.cacheContacts(chunk);
    this.chunks.push(chunk);
    this.addChunkProp(chunk);
    // A groan of dust where it tears loose.
    this.addDust(chunk.hinge?.x ?? com.x, chunk.hinge?.y ?? com.y + chunk.halfH, 4, { x: side, y: 0 }, 1.4);
  }

  step(dt) {
    this.clock += dt;
    for (const chunk of [...this.chunks]) this.stepChunk(chunk, dt);
    // Impact chips are disposable; their source masonry already lives in the persistent piles.
    if (this.debris.length > MAX_DEBRIS) this.debris.splice(0, this.debris.length - MAX_DEBRIS);
    const debrisDrag = Math.exp(-0.8 * dt);
    for (const piece of this.debris) {
      if (piece.settled) continue;
      piece.age += dt;
      piece.vy += GRAVITY * dt;
      piece.vx *= debrisDrag;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      const floor = this.groundAt(piece.x) - piece.size;
      if (piece.y > floor) {
        piece.y = floor;
        piece.vy *= -0.28;
        piece.vx *= 0.55;
        if (Math.abs(piece.vy) < 26) piece.settled = true;
      }
    }
    const dustDragX = Math.exp(-1.6 * dt), dustDragY = Math.exp(-1.2 * dt);
    for (const puff of this.dust) {
      puff.age += dt;
      puff.x += (puff.vx + DUST_WIND) * dt;
      puff.y += puff.vy * dt;
      puff.vx *= dustDragX;
      puff.vy *= dustDragY;
    }
    // Drop finished puffs in place: a new filtered array every step is avoidable garbage.
    let kept = 0;
    for (const puff of this.dust) if (puff.age < puff.life) this.dust[kept++] = puff;
    this.dust.length = kept;
    for (const body of this.bodies) {
      body.shake = Math.max(0, body.shake - dt);
      if (body.sinking) this.stepSinking(body, dt);
    }
    if (this.quakeHold > 0) this.quakeHold -= dt;
    else this.trauma = Math.max(0, this.trauma - QUAKE_DECAY * dt);
  }

  // A floating building (the cruise liner) goes down as a ship instead of standing as a wreck
  // (QA-08): she floods and settles with a slight list, then her bow goes down and she slides under
  // stern last, over `time` seconds, churning white froth (onFroth, else dust) along the hull. The
  // body pivots about its top-left corner (the stern), which the hit tests share, so it can be hit
  // all the way down.
  sink(buildingId, time = 18) {
    const body = this.bodies.find(each => each.building.id === buildingId);
    if (!body || body.sinking) return null;
    body.sinking = { age: 0, time, depth: 0, refit: 0 };
    this.onShipLost?.(body);
    return body;
  }

  stepSinking(body, dt) {
    const sinking = body.sinking;
    if (sinking.done) return;
    sinking.age += dt;
    const t = Math.min(1, sinking.age / sinking.time);
    const smooth = v => v * v * (3 - 2 * v);
    // First quarter: flooding, settling a seventh of her height. Then the slide, gathering pace.
    const flood = smooth(Math.min(1, t / SINK_FLOOD));
    const slide = Math.max(0, (t - SINK_FLOOD) / (1 - SINK_FLOOD));
    const depth = (0.14 * flood + 1.05 * slide * slide) * body.building.height;
    body.top += depth - sinking.depth;
    body.y = body.top;
    sinking.depth = depth;
    body.angle = 0.03 * flood + SINK_LIST * smooth(slide);
    body.image.y = body.top;
    body.image.rotation = body.angle;
    body.image.alpha = 1 - slide ** 3;
    // Froth churns along the waterline, faster once she slides, dying away as she goes under.
    const rate = slide > 0 ? 10 : 5;
    if (Math.floor((sinking.age - dt) * rate) !== Math.floor(sinking.age * rate) && t < 0.92) {
      const x = body.left + hash(sinking.age * 13.7) * body.building.width * (1 - 0.4 * slide);
      if (this.onFroth) this.onFroth(x, 0.4 + 0.6 * (1 - t));
      else this.addDust(x, this.groundAt(x) - 2, 2, { x: 0, y: 0 }, 0.8);
    }
    sinking.refit -= dt;
    if (body.prop && sinking.refit <= 0) {
      sinking.refit = 0.1;
      this.fit(body, body.prop);
    }
    if (t < 1) return;
    sinking.done = true;
    body.image.setVisible(false);
    if (body.prop) body.prop.health = 0;
  }

  // Applies the quake on top of wherever the scene put the camera this frame. The scene only
  // re-centres the camera on simulation steps, so last frame's offset is removed when it stayed.
  quake() {
    // Camera shake is removed game-wide: the view never moves on a landing.
    if (QUAKE_PX === 0) return;
    const camera = this.scene.cameras.main;
    const kept = camera.scrollX === this.quakeScroll?.x && camera.scrollY === this.quakeScroll?.y;
    const baseX = camera.scrollX - (kept ? this.quakeOffset.x : 0);
    const baseY = camera.scrollY - (kept ? this.quakeOffset.y : 0);
    const amount = QUAKE_PX * this.trauma ** 1.5;
    this.quakeOffset.x = amount * (Math.random() * 2 - 1);
    this.quakeOffset.y = amount * (Math.random() * 2 - 1);
    camera.setScroll(baseX + this.quakeOffset.x, baseY + this.quakeOffset.y);
    this.quakeScroll ??= { x: 0, y: 0 };
    this.quakeScroll.x = camera.scrollX;
    this.quakeScroll.y = camera.scrollY;
  }

  stepChunk(chunk, real) {
    if (chunk.held) {
      // In the hero's hands: it goes where the body EnemyThrow moves goes, turning with it.
      const spin = chunk.held.spin ?? 0;
      chunk.x = chunk.held.x - chunk.heldSlide * Math.cos(spin);
      chunk.y = chunk.held.y - chunk.heldSlide * Math.sin(spin);
      chunk.angle = chunk.heldAngle + spin;
      chunk.image.setPosition(chunk.x, chunk.y).setRotation(chunk.angle);
      return;
    }
    if (chunk.resting) return;
    if (chunk.creak > 0) {
      // The break groans first: the piece shudders in place and sheds dust from the tear.
      chunk.creak -= real;
      chunk.image.setPosition(chunk.x + (hash(chunk.age + chunk.creak) - 0.5) * 2, chunk.y);
      if (hash(chunk.creak * 7) < 0.25) {
        this.addDust(chunk.hinge?.x ?? chunk.x, chunk.hinge?.y ?? chunk.y + chunk.halfH, 1, { x: 0, y: 0 }, 0.8);
      }
      if (chunk.mass >= RUMBLE_MASS) this.rumble(chunk, real, 0.6);
      return;
    }
    if (chunk.mass >= RUMBLE_MASS) this.rumble(chunk, real, 1);
    const dt = real * chunk.pace;
    chunk.age += dt;
    if (chunk.hinge) {
      // Topple on the hinge like a rod about its end, then let go once it has swung clear.
      const cos = Math.cos(chunk.angle);
      const sin = Math.sin(chunk.angle);
      const arm = { x: chunk.arm.x * cos - chunk.arm.y * sin, y: chunk.arm.x * sin + chunk.arm.y * cos };
      const length2 = arm.x * arm.x + arm.y * arm.y || 1;
      chunk.va += 3 * GRAVITY * arm.x / length2 * dt;
      chunk.angle += chunk.va * dt;
      const nextCos = Math.cos(chunk.angle), nextSin = Math.sin(chunk.angle);
      arm.x = chunk.arm.x * nextCos - chunk.arm.y * nextSin;
      arm.y = chunk.arm.x * nextSin + chunk.arm.y * nextCos;
      chunk.x = chunk.hinge.x + arm.x;
      chunk.y = chunk.hinge.y + arm.y;
      // Contact at the torn foot must not release the hinge before the tower starts to swing.
      const contact = this.grounded(chunk);
      const collision = contact && contact.depth > CELL
        && Math.hypot(contact.x - chunk.hinge.x, contact.y - chunk.hinge.y) > CELL * 3;
      if (Math.abs(chunk.angle) > 0.85 || arm.y > -2 || collision) this.letGo(chunk, arm);
    } else {
      chunk.vy += GRAVITY * dt;
      chunk.x += chunk.vx * dt;
      chunk.y += chunk.vy * dt;
      chunk.angle += chunk.va * dt;
    }
    chunk.image.setPosition(chunk.x, chunk.y).setRotation(chunk.angle);
    this.fitChunk(chunk);
    const speed = Math.hypot(chunk.vx, chunk.vy) + Math.abs(chunk.va) * Math.max(chunk.halfW, chunk.halfH);

    // Crush whatever it swings or drops into.
    if (speed > 60) {
      const direction = { x: chunk.vx / (Math.hypot(chunk.vx, chunk.vy) || 1), y: chunk.vy / (Math.hypot(chunk.vx, chunk.vy) || 1) || 1 };
      const contacts = this.corners(chunk);
      for (const body of this.bodies) {
        if (body === chunk.body || !body.prop || body.prop.health <= 0) continue;
        const { prop } = body;
        if (chunk.prop && (Math.abs(chunk.prop.x - prop.x) > (chunk.prop.width + prop.width) / 2
          || Math.abs(chunk.prop.y - prop.y) > (chunk.prop.height + prop.height) / 2)) continue;
        const rows = new Set();
        for (const point of contacts) {
          if (Math.abs(point.x - prop.x) > prop.width / 2 || Math.abs(point.y - prop.y) > prop.height / 2) continue;
          const crushed = this.impact(body, point, direction, 'crush', Math.min(2.2, 0.8 + Math.sqrt(chunk.mass) / 12), true, rows);
          if (crushed) {
            // The building pushes back by what it lost against the piece's weight, so a piece
            // ploughs down through a roof instead of dropping straight through to shatter.
            const resist = Math.min(0.12, crushed * 2 / (chunk.mass + 40));
            chunk.vx *= 1 - resist;
            chunk.vy *= 1 - resist;
            chunk.va *= 1 - resist * 0.5;
          }
        }
        if (rows.size) this.collapse(body, [...rows], Math.sign(direction.x));
      }
    }

    // Hit the ground: the part that strikes it crumbles, the rest pivots on it and comes down
    // after, so a falling tower breaks up along its length instead of vanishing all at once.
    let lowest = this.grounded(chunk);
    if (!lowest || chunk.hinge) return;
    const strike = chunk.vy + chunk.va * (lowest.x - chunk.x);
    if (strike > CRUMBLE_SPEED) {
      sound.crash(Math.min(1, Math.sqrt(chunk.mass) / 30));
      if (this.crumble(chunk, lowest, strike)) return;
      lowest = this.grounded(chunk);
      if (!lowest) return;
    }
    // Absorb the velocity of the touching masonry, including its spin. Merely zeroing
    // downward COM velocity leaves a rotating slab driving through the ground every
    // step; penetration correction then lifts it back up like a bouncing board.
    chunk.y -= lowest.depth;
    const grip = Math.exp(-5 * dt);
    chunk.vx *= grip;
    let left = false, right = false;
    for (const point of this.corners(chunk)) {
      if (point.y < this.groundAt(point.x) - 2) continue;
      if (point.x < chunk.x) left = true;
      if (point.x > chunk.x) right = true;
    }
    if (left && right && chunk.vy >= 0) {
      // Support on both sides of the mass centre absorbs the landing without rebound.
      chunk.vy = chunk.va = 0;
    } else {
      // A single contact gives an inelastic normal impulse. Its angular response lets
      // gravity tip the remaining masonry over the contact without adding energy.
      const armX = lowest.x - chunk.x;
      const inertia = Math.max(1, (chunk.halfW ** 2 + chunk.halfH ** 2) / 3
        + chunk.offset.x ** 2 + chunk.offset.y ** 2);
      const incoming = chunk.vy + chunk.va * armX;
      if (incoming > 0) {
        const impulse = incoming / (1 + armX * armX / inertia);
        chunk.vy -= impulse;
        chunk.va -= impulse * armX / inertia;
      }
    }
    chunk.image.setPosition(chunk.x, chunk.y);
    this.fitChunk(chunk);
    if (left && right) {
      const settledSpeed = Math.hypot(chunk.vx, chunk.vy)
        + Math.abs(chunk.va) * Math.max(chunk.halfW, chunk.halfH);
      if (settledSpeed < 5 && chunk.age > 0.4) {
        // It comes to rest as a wreck: still a target, until something knocks it moving again.
        chunk.vx = chunk.vy = chunk.va = 0;
        chunk.resting = true;
        return;
      }
    }
  }

  // Grab and throw (enemy-throw.js): the nearest broken-off piece the hero (world { x, y }) can
  // lift, falling or lying where it landed, as the body EnemyThrow carries and throws, or null.
  // reach: px from the hero to the piece's bounds. size: the largest LIFT_SIZES index the hero
  // lifts; only a piece up to LIFT_RUBBLE cells and LIFT_LONG px is taken. A held piece is out of
  // the arena. Thrown, it hits like masonry (LIFT_HIT damage per cell, no fire) and then carries on
  // under its own weight: ploughing into buildings, crushing the street, breaking up where it lands.
  liftable(hero, reach, size) {
    let best = null;
    let nearest = reach;
    for (const chunk of this.chunks) {
      if (chunk.held || chunk.creak > 0 || !chunk.prop) continue;
      if (LIFT.rubble > size || chunk.mass > LIFT_RUBBLE
        || Math.max(chunk.grid.cols, chunk.grid.rows) * CELL > LIFT_LONG) continue;
      const { prop } = chunk;
      const distance = Math.hypot(Math.max(0, Math.abs(hero.x - prop.x) - prop.width / 2),
        Math.max(0, Math.abs(hero.y - prop.y) - prop.height / 2));
      if (distance > nearest) continue;
      nearest = distance;
      best = chunk;
    }
    if (!best) return null;
    const { prop } = best;
    const body = best.lift ??= {
      object: true, thud: true, spinRate: 2,
      grabbed: () => this.pickUp(best), dropped: () => this.putDown(best, 0, 0),
      burst: () => this.putDown(best, best.lift.vx * 0.6, best.lift.vy * 0.6),
      gone: () => this.removeChunk(best),
    };
    return Object.assign(body, {
      size: LIFT.rubble, distance: nearest, x: best.x, y: best.y,
      radius: (prop.width + prop.height) / 4, half: prop.height / 2, width: prop.width, height: prop.height,
      maxHealth: Math.round(20 + best.mass * LIFT_HIT),
    });
  }

  // Where the hands take a piece, as it lies now: `hold` px below its centre of mass, on the lowest
  // solid cell of the column over the hands, so no air shows between hands and piece. A piece with
  // nothing solid under its centre (a hook, a tree's crown beside its trunk) is taken `slide` px
  // to the side, at its nearest solid column.
  grip(chunk) {
    const { grid } = chunk;
    const cos = Math.cos(chunk.angle);
    const sin = Math.sin(chunk.angle);
    const cells = [];
    let slide = Infinity;
    for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
      if (!grid.has(c, r)) continue;
      const x = (c + 0.5 - chunk.comC) * CELL;
      const y = (r + 0.5 - chunk.comR) * CELL;
      const across = x * cos - y * sin;
      cells.push(across, x * sin + y * cos);
      if (Math.abs(across) < Math.abs(slide)) slide = across;
    }
    if (Math.abs(slide) <= LIFT_HANDS) slide = 0;
    let hold = -Infinity;
    for (let i = 0; i < cells.length; i += 2) {
      if (Math.abs(cells[i] - slide) <= LIFT_HANDS) hold = Math.max(hold, cells[i + 1]);
    }
    return { slide, hold: hold + CELL / 2 };
  }

  pickUp(chunk) {
    const { slide, hold } = this.grip(chunk);
    chunk.lift.hold = hold;
    Object.assign(chunk, { held: chunk.lift, heldAngle: chunk.angle, heldSlide: slide, hinge: null, resting: false, creak: 0, vx: 0, vy: 0, va: 0 });
    chunk.prop.health = 0;
    this.arena.props = this.arena.props.filter(prop => prop !== chunk.prop);
    this.arena.damageables = this.arena.damageables.filter(prop => prop !== chunk.prop);
    chunk.prop = null;
  }

  // Out of the hero's hands, moving at (vx, vy): a falling piece again, and a target.
  putDown(chunk, vx, vy) {
    if (!chunk.held) return;
    Object.assign(chunk, { held: null, vx, vy, va: (hash(chunk.x + chunk.y) - 0.5) * 2, age: 0 });
    this.addChunkProp(chunk);
  }

  rumble(chunk, dt, strength) {
    chunk.rumble -= dt;
    if (chunk.rumble > 0) return;
    chunk.rumble = 0.2;
    this.trauma = Math.max(this.trauma, strength * Math.min(0.4, 0.15 + chunk.mass / 8000));
  }

  letGo(chunk, arm) {
    chunk.vx = -chunk.va * arm.y;
    chunk.vy = chunk.va * arm.x;
    chunk.hinge = null;
  }

  // Cache solid boundary vertices only when masonry changes. Straight edges keep a sample
  // every 16px for uneven terrain; all bends are kept. No per-step grid scan or point allocation.
  cacheContacts(chunk) {
    const { grid } = chunk;
    const { cols, rows, cells } = grid;
    const { c0, c1, r0, r1 } = chunk.cellBounds ?? { c0: 0, c1: cols - 1, r0: 0, r1: rows - 1 };
    const contacts = [];
    for (let r = r0; r <= r1 + 1; r++) {
      const north = (r - 1) * cols, south = r * cols;
      // Slide a four-cell window over each vertex. Read each adjacent cell once;
      // interior and empty vertices need no has() calls or coordinate objects.
      let nw = 0, sw = 0;
      for (let c = c0; c <= c1 + 1; c++) {
        const ne = r > 0 && c < cols ? cells[north + c] : 0;
        const se = r < rows && c < cols ? cells[south + c] : 0;
        const mask = nw | ne << 1 | sw << 2 | se << 3;
        nw = ne; sw = se;
        if (mask === 0 || mask === 15) continue;
        if ((mask === 3 || mask === 12) && c % 4 !== 0) continue;
        if ((mask === 5 || mask === 10) && r % 4 !== 0) continue;
        contacts.push({ localX: (c - chunk.comC) * CELL, localY: (r - chunk.comR) * CELL, x: 0, y: 0 });
      }
    }
    chunk.contacts = contacts;
  }

  corners(chunk, cornersOnly = false) {
    const cos = Math.cos(chunk.angle);
    const sin = Math.sin(chunk.angle);
    if (!cornersOnly) {
      if (!chunk.contacts) this.cacheContacts(chunk);
      // Crush and ground checks share the same pose within a simulation step.
      // A rebuilt boundary has a new array, so carving also invalidates this cache.
      if (chunk.worldContacts === chunk.contacts && chunk.contactsX === chunk.x
        && chunk.contactsY === chunk.y && chunk.contactsAngle === chunk.angle) return chunk.contacts;
      for (const point of chunk.contacts) {
        point.x = chunk.x + point.localX * cos - point.localY * sin;
        point.y = chunk.y + point.localX * sin + point.localY * cos;
      }
      chunk.worldContacts = chunk.contacts;
      chunk.contactsX = chunk.x; chunk.contactsY = chunk.y; chunk.contactsAngle = chunk.angle;
      return chunk.contacts;
    }
    return CORNERS.map(([sx, sy]) => {
      const x = chunk.offset.x + sx * chunk.halfW;
      const y = chunk.offset.y + sy * chunk.halfH;
      return { x: chunk.x + x * cos - y * sin, y: chunk.y + x * sin + y * cos };
    });
  }

  // The corner deepest below the ground, or null while the chunk is still in the air.
  grounded(chunk) {
    let deepest = null;
    for (const point of this.corners(chunk)) {
      const depth = point.y - this.groundAt(point.x);
      if (depth >= 0 && (!deepest || depth > deepest.depth)) deepest = { ...point, depth };
    }
    return deepest;
  }

  // Smashes the cells near the ground when a chunk strikes it, harder strikes reaching higher.
  // Returns true when nothing worth keeping is left and the whole chunk has shattered.
  crumble(chunk, contact, strike) {
    // Heavier pieces break up more of themselves when they hit.
    const reach = Math.min(CRUMBLE_MAX, 8 + strike * 0.08 * (1 + Math.sqrt(chunk.mass) / 20));
    const cells = [];
    // toWorld inlined: this runs over every cell each frame a big piece strikes the ground.
    const cos = Math.cos(chunk.angle);
    const sin = Math.sin(chunk.angle);
    const { cols, rows } = chunk.grid;
    const { c0, c1, r0, r1 } = chunk.cellBounds ?? { c0: 0, c1: cols - 1, r0: 0, r1: rows - 1 };
    // The rotated grid's horizontal extent contains every cell centre. Cells above
    // the highest possible terrain need no cubic terrain query. Other groundAt
    // callers retain the exact generic path when no conservative bound is supplied.
    const extent = (Math.abs(cos) * (c1 - c0 + 1) + Math.abs(sin) * (r1 - r0 + 1)) * CELL / 2;
    const centreX = chunk.x + ((c0 + c1 + 1) / 2 - chunk.comC) * CELL * cos
      - ((r0 + r1 + 1) / 2 - chunk.comR) * CELL * sin;
    const groundMin = this.groundMin ? this.groundMin(centreX - extent, centreX + extent) : -Infinity;
    let left = contact.x, right = contact.x;
    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5 - chunk.comR) * CELL;
      const rowY = chunk.y + dy * cos;
      const leftY = rowY + (c0 + 0.5 - chunk.comC) * CELL * sin;
      const rightY = rowY + (c1 + 0.5 - chunk.comC) * CELL * sin;
      // Rotation is affine along a row. If both ends are above reach, every
      // centre between them is too; retain a margin for floating-point rounding.
      if (groundMin - Math.max(leftY, rightY) > reach + 1e-8) continue;
      for (let c = c0; c <= c1; c++) {
        if (!chunk.grid.cells[r * cols + c]) continue;
        const dx = (c + 0.5 - chunk.comC) * CELL;
        const y = chunk.y + dx * sin + dy * cos;
        if (groundMin - y > reach) continue;
        const x = chunk.x + dx * cos - dy * sin;
        // Everything within reach of the ground smashes, so a corner landing chips the corner
        // and a piece slamming down flat breaks along its whole length.
        if (this.groundAt(x) - y > reach) continue;
        cells.push([c, r]);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    if (chunk.mass - cells.length < CRUMBLE_KEEP) {
      this.shatter(chunk, contact, strike);
      return true;
    }
    this.rubble(chunk, cells, contact, strike, left - 6, right + 6);
    chunk.grid.remove(cells);
    this.clear(chunk, cells);
    // The ground soaks up most of the strike; what is left breaks apart where it was cut.
    chunk.vy *= 0.4;
    chunk.va *= 0.6;
    chunk.vx *= 0.8;
    if (cells.length) this.split(chunk, Math.sign(chunk.vx));
    return !this.chunks.includes(chunk);
  }

  shatter(chunk, contact, speed) {
    this.removeChunk(chunk);
    // Keep every cell for pile volume; only the temporary impact chips are sampled.
    const cells = [];
    for (let r = 0; r < chunk.grid.rows; r++) for (let c = 0; c < chunk.grid.cols; c++) if (chunk.grid.has(c, r)) cells.push([c, r]);
    const corners = this.corners(chunk);
    this.rubble(chunk, cells, contact, speed,
      Math.min(...corners.map(point => point.x)) - 6, Math.max(...corners.map(point => point.x)) + 6);
  }

  // Turns a chunk's cells into debris and dust, smashes the roofs under [from, to] and shakes the
  // view, all sized by the weight that came down.
  rubble(chunk, cells, contact, speed, from, to) {
    this.depositRubble(chunk, cells);
    const power = Math.min(260, speed * 0.45);
    // Sample transient chips independently of the full masonry volume above.
    const stride = Math.max(1, Math.ceil(cells.length / RUBBLE_PIECES));
    const cos = Math.cos(chunk.angle), sin = Math.sin(chunk.angle);
    const floor = cells.length ? this.groundAt(chunk.x) - 2 : 0;
    for (let i = 0; i < cells.length; i += stride) {
      const [c, r] = cells[i];
      const color = chunk.colors[r * chunk.grid.cols + c];
      const dx = (c + 0.5 - chunk.comC) * CELL, dy = (r + 0.5 - chunk.comR) * CELL;
      const x = chunk.x + dx * cos - dy * sin;
      const y = Math.min(chunk.y + dx * sin + dy * cos, floor);
      const away = Math.sign(x - contact.x) || 1;
      this.addDebris({
        x, y,
        vx: chunk.vx * 0.5 + away * power * hash(x + y) + (hash(y) - 0.5) * 60,
        vy: -power * (0.3 + 0.7 * hash(x * 1.7)) - 20,
        size: 1 + Math.round(hash(x * 0.37 + y) * 2.4),
        color, glint: (color & 255) > 210 && (color >> 8 & 255) > 210,
      });
    }
    // Sized by the whole weight coming down, not just the cells that broke off.
    const size = Math.min(3.5, 1 + Math.sqrt(chunk.mass) / 10);
    this.addDust(contact.x, this.groundAt(contact.x) - 6, Math.round(6 + size * 6), { x: Math.sign(chunk.vx), y: 0 }, size);
    this.onLanding?.(from, to, size);
    // The landing smashes everything under its footprint, roofs first.
    for (const body of this.bodies) {
      const { prop } = body;
      if (!prop || prop.health <= 0 || body === chunk.body) continue;
      const left = Math.max(from, prop.x - prop.width / 2);
      const right = Math.min(to, prop.x + prop.width / 2);
      if (left > right) continue;
      const crushRows = new Set();
      for (let x = left; x <= right; x += 10) {
        this.impact(body, { x, y: prop.y - prop.height / 2 }, { x: Math.sign(chunk.vx) * 0.3, y: 1 }, 'crush', Math.min(2, size * 0.7), true, crushRows);
      }
      if (crushRows.size) this.collapse(body, [...crushRows], Math.sign(chunk.vx));
    }
    // Overlapping landings don't stack: a landing during a shake counts for less the stronger
    // the shake already is, and only one that raises it restarts the hold. A street collapsing
    // reads as one big quake that still fades, rather than a multiplied, endless one.
    const level = Math.min(1, 0.3 + size * 0.15) * (1 - this.trauma * 0.5);
    if (level > this.trauma) {
      this.trauma = level;
      this.quakeHold = Math.max(this.quakeHold, 0.18 + size * 0.09);
    }
  }

  depositRubble(piece, cells) {
    if (!this.piles || (piece.body ?? piece).building?.ship) return;
    const cos = Math.cos(piece.angle), sin = Math.sin(piece.angle);
    for (const [c, r] of cells) {
      const dx = (c + 0.5 - piece.comC) * CELL, dy = (r + 0.5 - piece.comR) * CELL;
      const x = piece.x + dx * cos - dy * sin;
      this.piles.add(x, CELL * CELL, piece.colors[r * piece.grid.cols + c]);
    }
  }

  draw(elapsed) {
    this.quake();
    for (const body of this.bodies) {
      if (body.dirty) upload(this.scene, body);
      body.image.x = body.left + (body.shake > 0 ? Math.sin(elapsed * 95) * body.shake * 6 : 0);
    }
    for (const chunk of this.chunks) {
      if (chunk.dirty) upload(this.scene, chunk);
    }
    const g = this.front;
    g.clear();
    const view = this.scene.cameras.main.worldView;
    this.piles?.draw(this.scene, view);
    for (const piece of this.debris) {
      if (view && (piece.x + piece.size + 2 < view.x || piece.x - 2 > view.right
        || piece.y + piece.size + 2 < view.y || piece.y - 2 > view.bottom)) continue;
      const glint = piece.glint && !piece.settled && Math.sin(elapsed * 30 + piece.x) > 0.6;
      g.fillStyle(glint ? 0xffffff : piece.color, 1);
      g.fillRect(Math.round(piece.x), Math.round(piece.y), piece.size, piece.size);
      if (piece.glow && piece.age < 0.6) {
        g.fillStyle(0xffd27a, piece.glow * (1 - piece.age / 0.6));
        g.fillRect(Math.round(piece.x) - 1, Math.round(piece.y) - 1, piece.size + 2, piece.size + 2);
      }
    }
    let visibleDust = 0;
    for (const puff of this.dust) {
      const t = puff.age / puff.life;
      const radius = puff.radius * (1 + t * 1.6);
      if (view && (puff.x + radius < view.x || puff.x - radius > view.right
        || puff.y + radius < view.y || puff.y - radius > view.bottom)) continue;
      // Fades fast at first and eases to nothing (quadratic), never popping out at full strength.
      this.dustImages[visibleDust++].setVisible(true).setPosition(puff.x, puff.y)
        .setScale(radius / 64).setAlpha(0.5 * (1 - t) ** 2 * Math.min(1, puff.age * 8));
    }
    for (let i = visibleDust; i < this.visibleDust; i++) this.dustImages[i].setVisible(false);
    this.visibleDust = visibleDust;
  }
}
