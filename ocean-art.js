import { CIRCUMFERENCE, wrapX } from './planet.js';

// Open-sea set pieces on the Blue Sea, drawn behind the water and terrain like the other art:
// - MS Meadow Star (feedback #17): a big cruise liner riding at anchor east of Gull Rock. White hull and navy boot-top, four decks of balconies, lifeboats, a pool and loungers on
//   the sun deck, a raked funnel, the bridge and a radar mast. It never moves. Its decks are solid
//   (shipDeckAt), so the hero can land on it and fight there.
// The art is laid out at its original size (ART, design px) and drawn SHIP_SCALE times bigger about
// her midships waterline (scaledPen), so she reads as a liner beside the freighters and tankers.
const SHIP_SCALE = 1.5;
const ART = Object.freeze({ x: 19080, from: 18820, to: 19340 });
const grow = x => ART.x + (x - ART.x) * SHIP_SCALE;
export const CRUISE_SHIP = Object.freeze({ x: ART.x, from: grow(ART.from), to: grow(ART.to) });

// The ship's walkable surface: [world x, rise above sea level], linear between points. Stern deck,
// stepped terraces up to the sun deck, the bridge front, then the foredeck rising to the bow.
// Listed in design px, scaled with the art.
const DECKS = [
  [18820, 28], [18832, 36], [18886, 36], [18896, 58], [18912, 58], [18922, 80], [18936, 80],
  [18946, 100], [19212, 100], [19224, 80], [19234, 36], [19318, 40], [19340, 44],
].map(([x, rise]) => [grow(x), rise * SHIP_SCALE]);

// Phaser Graphics calls scaled k times about (cx, cy), each corner rounded to a whole px so the
// pixel art stays crisp (a canvas transform would smear it).
function scaledPen(g, cx, cy, k) {
  const X = v => Math.round(cx + (v - cx) * k);
  const Y = v => Math.round(cy + (v - cy) * k);
  const size = v => (v > 0 ? Math.max(1, Math.round(v * k)) : 0);
  return {
    fillStyle: (color, alpha) => g.fillStyle(color, alpha),
    lineStyle: (width, color, alpha) => g.lineStyle(width * k, color, alpha),
    fillRect: (x, y, w, h) => g.fillRect(X(x), Y(y), size(w), size(h)),
    fillTriangle: (x1, y1, x2, y2, x3, y3) => g.fillTriangle(X(x1), Y(y1), X(x2), Y(y2), X(x3), Y(y3)),
    fillCircle: (x, y, radius) => g.fillCircle(X(x), Y(y), radius * k),
    lineBetween: (x1, y1, x2, y2) => g.lineBetween(X(x1), Y(y1), X(x2), Y(y2)),
  };
}

// Rise above sea level of the ship's deck at x, or null off the ship.
export function shipDeckAt(x) {
  const at = wrapX(x);
  if (at < CRUISE_SHIP.from || at > CRUISE_SHIP.to) return null;
  for (let i = 1; i < DECKS.length; i++) {
    const [x1, r1] = DECKS[i];
    if (at > x1) continue;
    const [x0, r0] = DECKS[i - 1];
    return r0 + (r1 - r0) * (at - x0) / (x1 - x0);
  }
  return DECKS.at(-1)[1];
}

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// As a breakable building for evil mode (building-destruction.js bakes it): the whole ship, hull to
// funnels. A baked building sits 3 px into its ground; the ship's waterline stays on the sea.
export const CRUISE_SHIP_BUILDING = Object.freeze({
  id: 'cruise-ship', x: CRUISE_SHIP.x, width: CRUISE_SHIP.to - CRUISE_SHIP.from + 8, height: Math.round(156 * SHIP_SCALE),
  maxHealth: 900, seed: 480,
  varietyIndex: 0,
  // A ship, not a building: hits hole and scorch her hull, and she sinks rather than crumbles.
  ship: true,
  draw: (g, x, y, elapsed) => drawCruiseShip(g, x - CRUISE_SHIP.x, y - 3, elapsed, 0),
});

// drawShip: false leaves the cruise ship to a mode that draws it itself (evil mode).
export function drawOceanArt(g, left, right, seaY, cameraX, elapsed, drawShip = true, varietyIndex = 0) {
  const ship = nearest(CRUISE_SHIP.x, cameraX) - CRUISE_SHIP.x;
  if (drawShip && CRUISE_SHIP.to + ship + 40 > left && CRUISE_SHIP.from + ship - 40 < right) drawCruiseShip(g, ship, seaY, elapsed, varietyIndex);
}

// Three distinct, authentic color varieties for the cruise liner.
export const CRUISE_VARIETIES = [
  {
    name: 'Meadow Star (Pearl & Navy)',
    hull: 0xf2f0ea,
    shade: 0xdcdad2,
    boot: 0x2f3e56,
    band: 0x2f5e8a,
    stripe: 0x3f6e9a,
    keel: 0xa8473e,
    window: 0x5f7f96,
  },
  {
    name: 'Sovereign Star (Midnight & Crimson)',
    hull: 0x222a36,
    shade: 0x181e28,
    boot: 0x8a3028,
    band: 0xdca83a,
    stripe: 0xeeeae0,
    keel: 0x16181c,
    window: 0x486278,
  },
  {
    name: 'Emerald Star (Jade & Silver)',
    hull: 0x243b32,
    shade: 0x1a2c24,
    boot: 0x24282c,
    band: 0x4fa878,
    stripe: 0xd4a034,
    keel: 0x8c3830,
    window: 0x5a7a70,
  },
];

// ---- MS Meadow Star --------------------------------------------------------------------------
const LIT = 0xf2dc9a;

export function drawCruiseShip(pen, shift, seaY, elapsed, varietyIndex = 0) {
  const v = CRUISE_VARIETIES[varietyIndex % CRUISE_VARIETIES.length] ?? CRUISE_VARIETIES[0];
  const g = scaledPen(pen, ART.x + shift, seaY, SHIP_SCALE);
  const X = v => v + shift;
  const Y = rise => seaY - rise;
  const [s0, s1] = [X(ART.from), X(ART.to)];
  // Hull: white topsides over a navy boot-top, a rounded stern and a raked, flared bow.
  g.fillStyle(v.hull);
  g.fillRect(s0 + 8, Y(36), s1 - s0 - 48, 44);
  g.fillTriangle(s0 + 8, Y(36), s0 + 8, Y(-6), s0, Y(28));
  g.fillTriangle(s0, Y(28), s0 + 8, Y(-6), s0 + 2, Y(4));
  g.fillTriangle(s1 - 40, Y(40), s1, Y(46), s1 - 40, Y(-6));
  g.fillStyle(v.shade);
  g.fillRect(s0 + 8, Y(10), s1 - s0 - 48, 4);
  g.fillStyle(v.boot);
  g.fillRect(s0 + 4, Y(8), s1 - s0 - 44, 12);
  g.fillTriangle(s1 - 40, Y(8), s1 - 12, Y(8), s1 - 40, Y(-6));
  g.fillStyle(v.keel);
  g.fillRect(s0 + 4, Y(9), s1 - s0 - 40, 1);
  // A sheer stripe and two rows of portholes.
  g.fillStyle(v.stripe);
  g.fillRect(s0 + 6, Y(33), s1 - s0 - 36, 2);
  for (const rise of [24, 16]) {
    for (let px = s0 + 16; px < s1 - 50; px += 7) {
      g.fillStyle(hash(px * 0.37 + rise) > 0.82 ? LIT : v.window);
      g.fillRect(px, Y(rise), 2, 2);
    }
  }
  // Hawse pipe (no diagonal anchor chain, by the owner's eye).
  g.fillStyle(0x3b3f44);
  g.fillRect(s1 - 32, Y(32), 4, 3);
  // Superstructure: three tiers of balconied cabins, each a little shorter.
  const tiers = [[18896, 19234, 36, 58], [18922, 19224, 58, 80], [18946, 19212, 80, 100]];
  tiers.forEach(([from, to, low, high], k) => {
    g.fillStyle(v.hull);
    g.fillRect(X(from), Y(high), to - from, high - low);
    g.fillStyle(v.shade);
    g.fillRect(X(from), Y(low) - 2, to - from, 2);
    for (let wx = X(from) + 5; wx < X(to) - 6; wx += 6) {
      g.fillStyle(hash(wx * 0.29 + k * 7) > 0.85 ? LIT : v.window);
      g.fillRect(wx, Y(high) + 6, 4, high - low - 11);
    }
    g.fillStyle(0xd0ccc2);
    g.fillRect(X(from), Y(high) + 4, to - from, 1);
  });
  // Lifeboats in orange along the lowest tier, hung from davits.
  for (let bx = X(18960); bx < X(19190); bx += 32) {
    g.fillStyle(0x8a949b);
    g.fillRect(bx + 2, Y(64), 1, 6);
    g.fillRect(bx + 15, Y(64), 1, 6);
    g.fillStyle(0xd9773e);
    g.fillRect(bx, Y(58) + 1, 18, 5);
    g.fillStyle(0xe8e2d4);
    g.fillRect(bx + 2, Y(58), 14, 2);
  }
  // Bridge: a dark band of windows across the front of the top tier, with wings.
  g.fillStyle(0x2f3e4c);
  g.fillRect(X(19172), Y(98), 40, 6);
  // Bridge wing, ending over the deck below and carried on a bulkhead down to it, so it never
  // hangs in the air past the top tier.
  g.fillStyle(v.hull);
  g.fillRect(X(19200), Y(97), 24, 5);
  g.fillRect(X(19212), Y(92), 12, 12);
  g.fillStyle(v.shade);
  g.fillRect(X(19212), Y(81), 12, 1);
  g.fillStyle(0x2f3e4c);
  g.fillRect(X(19216), Y(96), 8, 2);
  // Sun deck: railings, a blue pool with a glint, loungers and parasols.
  g.fillStyle(0xc9cdd0);
  g.fillRect(X(18946), Y(106), 266, 1);
  for (let rx = X(18946); rx < X(19212); rx += 5) g.fillRect(rx, Y(106), 1, 6);
  g.fillStyle(0x3fa7da);
  g.fillRect(X(19040), Y(102), 56, 3);
  g.fillStyle(0xbfe8f6, 0.6 + 0.4 * Math.sin(elapsed * 3));
  g.fillRect(X(19046) + Math.round(Math.sin(elapsed) * 18) + 18, Y(102), 6, 1);
  for (let lx = X(19104); lx < X(19160); lx += 12) {
    g.fillStyle(0xeceae2);
    g.fillRect(lx, Y(102), 7, 2);
    g.fillStyle(lx % 24 < 12 ? 0x4f8fb8 : 0xd96a5a);
    g.fillRect(lx + 1, Y(110), 7, 2);
    g.fillStyle(0x8a949b);
    g.fillRect(lx + 4, Y(108), 1, 6);
  }
  // Raked funnel: white, the line's blue band and a black top, a little smoke drifting aft.
  const f0 = X(18966);
  g.fillStyle(v.hull);
  g.fillTriangle(f0, Y(100), f0 + 30, Y(100), f0 + 8, Y(142));
  g.fillTriangle(f0 + 30, Y(100), f0 + 36, Y(142), f0 + 8, Y(142));
  g.fillStyle(v.band);
  g.fillRect(f0 + 6, Y(130), 30, 6);
  g.fillStyle(0x23262a);
  g.fillRect(f0 + 8, Y(142), 28, 4);
  for (let i = 0; i < 4; i++) {
    const t = (elapsed * 0.25 + i / 4) % 1;
    g.fillStyle(0xdde2e6, 0.4 * (1 - t));
    g.fillCircle(f0 + 22 - t * 46, Y(150) - t * 16, 4 + t * 7);
  }
  // Radar mast over the bridge, its scanner turning, and the masthead light.
  const m = X(19196);
  g.fillStyle(0xc9cdd0);
  g.fillRect(m, Y(150), 2, 50);
  g.fillRect(m - 8, Y(132), 18, 2);
  const sweep = Math.abs(Math.cos(elapsed * 2));
  g.fillStyle(0x3b3f44);
  g.fillRect(Math.round(m + 1 - 9 * sweep), Y(140), Math.round(18 * sweep) + 1, 2);
  g.fillStyle(0xfff2c0, 0.5 + 0.5 * (Math.sin(elapsed * 4) > 0));
  g.fillCircle(m + 1, Y(152), 2);
  // A string of dress lights from the masthead down to bow and stern.
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const lit = Math.sin(elapsed * 2 + i) > -0.3;
    g.fillStyle([0xf2dc9a, 0xe8908a, 0x8ac8e0][i % 3], lit ? 0.95 : 0.3);
    g.fillRect(Math.round(m + (s1 - 6 - m) * t), Math.round(Y(150) + (Y(46) - Y(150)) * t), 2, 2);
    g.fillRect(Math.round(f0 + 20 + (s0 + 6 - f0 - 20) * t), Math.round(Y(144) + (Y(30) - Y(144)) * t), 2, 2);
  }
}
