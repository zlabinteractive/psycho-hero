import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// Oakwood and Mirror Lake, built to the same rules as Green City (game-design-rules/
// city-design-rules.md) so the hero has a second sandbox to wreck. Two flat parallax treelines sit
// behind a destructible "street" of oaks, pines and birches in one muted green theme, with detailed
// landmarks in their own palettes: Old Oak (the signature, taller than anything around it), the
// ranger station, the fire lookout, the trailhead, the lakeside lodge and pier, the lake beacon on
// its islet, the red boathouse, the campground, the sawmill and the timber cabin.
// Everything is listed once in FOREST_BUILDINGS, so evil mode can promote it like the city.
// A tree is a trunk under a heavy crown: cut the trunk and the crown topples
// (building-destruction.js), which is what makes a forest fun to smash.
export const FOREST = { from: 7200, to: 10200 };

// Mirror Lake's shoreline, found from the terrain so it follows any edit to planet.js.
function shoreline() {
  let from = null, to = null;
  for (let x = 8200; x < 9400; x++) {
    const wet = elevation(x) < 0;
    if (wet && from === null) from = x;
    if (!wet && from !== null && to === null) to = x;
  }
  return { from, to };
}
export const LAKE = shoreline();
export const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 22;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
// Trees stand closer than city buildings and their crowns overlap, so the forest reads dense.
const TREE_STEP = 24 * CITY_SCALE;
const FOREST_EDGE = 260;

// The "street" theme: muted greens and bark browns (detail means foreground).
const BARK = 0x6b4f3a;
const BARK_DARK = 0x553e2e;
const OAK = [0x4f8a4c, 0x568f4f, 0x4a8350];
const OAK_LIGHT = 0x6aa860;
const OAK_DARK = 0x3f7442;
const PINE = [0x3f6e52, 0x45755a];
const PINE_LIGHT = 0x5a8a68;
const BIRCH_BARK = 0xd9d4c8;
const BIRCH_LEAF = 0x7ea65a;
const GLASS = 0xd5e8ee;
const WINDOW_WARM = 0xe9d9a8;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building: the lake surface counts as ground, so piers and islets float.
export function forestBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the trees leave free. trees: low buildings that trees may grow
// behind, as they would in a real forest; tall landmarks keep their silhouette clear.
// width/height: hit box once promoted.
// fx draws animated smoke and lights in free roam only, so it never bakes into the rubble.
const LANDMARK_ART = [
  { id: 'ranger-station', trees: true, x: 7380, door: true, draw: drawRangerStation, fx: rangerFx, clear: 52, width: 96, height: 92 },
  { countsAsBuilding: false, id: 'old-oak', x: 7640, draw: drawOldOak, fx: oldOakFx, clear: 66, width: 128, height: 156, maxHealth: 340 },
  { id: 'fire-lookout', x: 7920, draw: drawLookout, fx: lookoutFx, clear: 26, width: 46, height: 124, maxHealth: 240 },
  { id: 'trailhead', trees: true, x: 8095, draw: drawTrailhead, clear: 48, width: 92, height: 34 },
  { id: 'lakeside-lodge', trees: true, x: 8250, door: true, draw: drawLodge, fx: chimneyFx(36, 70), clear: 52, width: 100, height: 76 },
  { id: 'fishing-pier', x: LAKE.from + 92, draw: drawPier, clear: 70, width: 134, height: 28, maxHealth: 160 },
  { id: 'lake-beacon', x: Math.round((LAKE.from + LAKE.to) / 2), draw: drawBeacon, fx: beaconFx, clear: 24, width: 40, height: 104, maxHealth: 260 },
  { id: 'boathouse', trees: true, x: LAKE.to - 22, door: true, draw: drawBoathouse, clear: 56, width: 104, height: 62 },
  { id: 'campground', trees: true, x: 9440, draw: drawCampground, fx: campfireFx, clear: 60, width: 116, height: 34 },
  { id: 'sawmill', trees: true, x: 9690, draw: drawSawmill, fx: sawFx, clear: 64, width: 126, height: 66 },
  { id: 'timber-cabin', trees: true, x: 9960, door: true, draw: drawCabin, fx: chimneyFx(18, 52), clear: 36, width: 66, height: 62 },
];
export const FOREST_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// Trees between the landmarks: oaks mostly, with pines and birches for rhythm. They thin and
// shrink over the last FOREST_EDGE px into the fields and town on either side.
function forestTrees() {
  const trees = [];
  for (let i = Math.ceil(FOREST.from / TREE_STEP); i * TREE_STEP <= FOREST.to; i++) {
    const seed = i + 0.53;
    const slot = i * TREE_STEP;
    const taper = Math.min(1, Math.min(slot - FOREST.from, FOREST.to - slot) / FOREST_EDGE);
    if (hash(seed) < 0.12 + 0.5 * (1 - taper)) continue;
    const roll = hash(seed + 0.1);
    const kind = roll < 0.62 ? 'oak' : roll < 0.84 ? 'pine' : 'birch';
    const [w0, w1, h0, h1] = { oak: [28, 14, 52, 34], pine: [18, 8, 60, 34], birch: [16, 8, 50, 24] }[kind];
    const art = w0 + Math.round(hash(seed + 0.2) * w1);
    const tall = Math.round((h0 + hash(seed + 0.3) * h1) * (0.6 + 0.4 * taper));
    const width = art * CITY_SCALE;
    const x = slot + Math.round((TREE_STEP - width) * hash(seed + 0.4)) + width / 2;
    // Dry land under the whole crown footprint, and room around every landmark.
    if ([-0.5, 0, 0.5].some(t => elevation(x + t * width) < 3)) continue;
    const gap = Math.min(...FOREST_LANDMARKS.filter(l => !l.trees).map(l => Math.abs(x - l.x) - l.clear - width / 2));
    if (gap < 2) continue;
    const shade = hash(seed + 0.6);
    trees.push({
      countsAsBuilding: false, id: `tree-${i}`, seed, kind, x, width, height: (tall + 4) * CITY_SCALE,
      // roof: crown top, where songbirds perch (forest-life.js).
      roof: (tall - 4) * CITY_SCALE, maxHealth: kind === 'pine' ? 120 : 100,
      draw: scaled((g, at, y) => drawTree(g, at, y, kind, art, tall, shade)),
    });
  }
  return trees;
}

function drawTree(g, x, y, kind, width, height, shade) {
  if (kind === 'pine') return drawPine(g, x, y, width, height, shade);
  if (kind === 'birch') return drawBirch(g, x, y, width, height, shade);
  return drawOak(g, x, y, width, height, shade);
}

// Oak: a stout trunk forking into a broad, lumpy crown with a lit top and a shaded underside.
function drawOak(g, x, y, width, height, shade) {
  const trunk = Math.max(4, Math.round(width * 0.18));
  const crownY = y - height + width * 0.42;
  const leaf = OAK[Math.floor(shade * OAK.length)];
  g.fillStyle(BARK);
  g.fillRect(x - trunk / 2, crownY, trunk, y - crownY);
  g.fillRect(x - trunk / 2 - 2, y - 4, trunk + 4, 4);
  g.fillTriangle(x, crownY + 10, x - width * 0.28, crownY - 2, x - 1, crownY + 4);
  g.fillTriangle(x, crownY + 12, x + width * 0.26, crownY, x + 1, crownY + 5);
  g.fillStyle(BARK_DARK);
  g.fillRect(x + trunk / 2 - 2, crownY, 2, y - crownY);
  g.fillRect(x - 1, y - height * 0.3, 1, 5);
  const r = width / 2;
  g.fillStyle(OAK_DARK);
  g.fillEllipse(x, crownY + 2, width, r * 0.9);
  g.fillStyle(leaf);
  g.fillCircle(x - r * 0.45, crownY - r * 0.15, r * 0.62);
  g.fillCircle(x + r * 0.45, crownY - r * 0.1, r * 0.6);
  g.fillCircle(x, crownY - r * 0.5, r * 0.7);
  g.fillCircle(x - r * 0.1, crownY - r * 0.05, r * 0.6);
  g.fillStyle(OAK_LIGHT);
  g.fillCircle(x - r * 0.25, crownY - r * 0.8, r * 0.28);
  g.fillCircle(x + r * 0.42, crownY - r * 0.42, r * 0.2);
  g.fillCircle(x - r * 0.62, crownY - r * 0.32, r * 0.16);
}

// Pine: stacked dark tiers on a short trunk.
function drawPine(g, x, y, width, height, shade) {
  g.fillStyle(BARK);
  g.fillRect(x - 2, y - 10, 4, 10);
  const leaf = PINE[Math.floor(shade * PINE.length)];
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const base = y - 6 - i * (height - 8) / (tiers + 0.6);
    const half = width / 2 * (1 - i / (tiers + 1));
    const top = base - (height - 8) / tiers * 1.5;
    g.fillStyle(leaf);
    g.fillTriangle(x - half, base, x, top, x + half, base);
    g.fillStyle(PINE_LIGHT);
    g.fillTriangle(x - half * 0.15, top + 6, x, top, x - half * 0.55, base - 2);
  }
}

// Birch: a pale, dark-flecked trunk under a light, airy crown.
function drawBirch(g, x, y, width, height, shade) {
  const crownY = y - height + width * 0.6;
  g.fillStyle(BIRCH_BARK);
  g.fillRect(x - 2, crownY, 4, y - crownY);
  g.fillStyle(0x5a5550);
  for (let my = crownY + 4; my < y - 2; my += 7) g.fillRect(x - 2 + (my % 3), my, 2, 1);
  g.fillStyle(lerpColor(BIRCH_LEAF, OAK_DARK, 0.35 + shade * 0.2));
  g.fillEllipse(x, crownY - 2, width, width * 1.3);
  g.fillStyle(BIRCH_LEAF);
  g.fillEllipse(x - 2, crownY - 5, width * 0.7, width);
  g.fillStyle(0x9fc277);
  g.fillCircle(x - width * 0.2, crownY - width * 0.45, 2.5);
}

// A stone footing that runs below the ground line, so a building on a slope never floats.
function footing(g, x, y, width, color = 0x8a857c) {
  g.fillStyle(color);
  g.fillRect(x - width / 2, y - 3, width, 14);
}

// Log wall: round logs in 4 px courses with a lit top and a shadowed underside, ringed log ends
// sticking out at both corners.
function logWall(g, left, top, width, height, color) {
  g.fillStyle(color);
  g.fillRect(left, top, width, height);
  for (let ly = top; ly < top + height; ly += 4) {
    g.fillStyle(lerpColor(color, 0xffffff, 0.18));
    g.fillRect(left, ly, width, 1);
    g.fillStyle(lerpColor(color, 0x000000, 0.25));
    g.fillRect(left, ly + 3, width, 1);
    for (const ex of [left - 1, left + width + 1]) {
      g.fillStyle(lerpColor(color, 0xffffff, 0.3));
      g.fillCircle(ex, ly + 2, 2);
      g.fillStyle(lerpColor(color, 0x000000, 0.2));
      g.fillRect(ex, ly + 2, 1, 1);
    }
  }
}

// Shingle roof: a gable from (left, eave) to (right, eave) peaking at (peakX, peak), with staggered
// shingle courses, moss patches and a dark fascia.
function shingleRoof(g, left, right, eave, peakX, peak, color, moss = 0) {
  g.fillStyle(color);
  g.fillTriangle(left, eave, peakX, peak, right, eave);
  const dark = lerpColor(color, 0x000000, 0.22);
  for (let ry = peak + 3; ry < eave; ry += 3) {
    const t = (ry - peak) / (eave - peak);
    const a = peakX + (left - peakX) * t;
    const b = peakX + (right - peakX) * t;
    g.fillStyle(dark);
    g.fillRect(a, ry, b - a, 1);
    for (let sx = a + ((ry / 3) & 1) * 3; sx < b; sx += 6) g.fillRect(sx, ry - 2, 1, 2);
    if (moss && hash(ry * 0.7 + left) < moss) {
      g.fillStyle(0x6f8a4a);
      g.fillRect(a + (b - a) * hash(ry + right), ry - 2, 4, 2);
    }
  }
  g.fillStyle(lerpColor(color, 0x000000, 0.4));
  g.fillRect(left, eave - 1, right - left, 2);
}

// Framed window with a cross bar and warm light, optional shutters and flower box.
function cabinWindow(g, x, y, w, h, shutter = null, flowers = false) {
  g.fillStyle(0xe8dcc0);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(WINDOW_WARM);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xfff4d0, 0.6);
  g.fillRect(x, y, 2, h);
  g.fillStyle(0xe8dcc0);
  g.fillRect(x + Math.floor(w / 2), y, 1, h);
  g.fillRect(x, y + Math.floor(h / 2), w, 1);
  if (shutter) {
    g.fillStyle(shutter);
    g.fillRect(x - 3, y - 1, 2, h + 2);
    g.fillRect(x + w + 1, y - 1, 2, h + 2);
  }
  if (flowers) {
    g.fillStyle(0x6b4a30);
    g.fillRect(x - 1, y + h + 1, w + 2, 2);
    const blooms = [0xd9605a, 0xf2c14e, 0xe890b8];
    for (let fx = x; fx < x + w; fx += 2) {
      g.fillStyle(blooms[(fx >> 1) % 3]);
      g.fillRect(fx, y + h, 1, 1);
    }
  }
}

// Hanging lantern with a glow.
function lantern(g, x, y) {
  g.fillStyle(0x3b3f44);
  g.fillRect(x, y - 3, 1, 2);
  g.fillStyle(0xffd88a, 0.25);
  g.fillCircle(x, y + 1, 4);
  g.fillStyle(0xffe6a0);
  g.fillRect(x - 1, y - 1, 3, 3);
}

// Ranger station: a log cabin on a stone footing under a green standing-seam roof, with a
// fieldstone chimney, a railed porch, a badge sign over the door, a notice board, lanterns, a radio
// aerial, firewood and the flagpole (rangerFx flies the flag at its top).
function drawRangerStation(g, x, y) {
  footing(g, x, y, 84);
  g.fillStyle(0x8a857c);
  g.fillRect(x - 40, y - 6, 80, 6);
  logWall(g, x - 38, y - 34, 76, 28, 0x8a5a3a);
  // Chimney, then the roof with its seams, ridge cap and an aerial.
  g.fillStyle(0x9a948a);
  g.fillRect(x + 18, y - 62, 7, 18);
  g.fillStyle(0x7f7a72);
  for (let cy = y - 60; cy < y - 44; cy += 4) g.fillRect(x + 18 + ((cy >> 2) & 1) * 3, cy, 4, 2);
  g.fillStyle(0x4f7a4f);
  g.fillTriangle(x - 46, y - 33, x, y - 58, x + 46, y - 33);
  g.fillStyle(0x3f6640);
  for (let sx = x - 42; sx < x + 44; sx += 5) {
    const reach = 25 * (1 - Math.abs(sx - x) / 46);
    g.fillRect(sx, y - 33 - reach, 1, reach);
  }
  g.fillRect(x - 46, y - 35, 92, 3);
  g.fillStyle(0x6f9a6f);
  g.fillRect(x - 3, y - 59, 6, 2);
  g.fillStyle(0x6d7279);
  g.fillRect(x - 24, y - 64, 1, 18);
  g.fillRect(x - 27, y - 60, 7, 1);
  g.fillRect(x - 26, y - 56, 5, 1);
  // Windows with shutters.
  cabinWindow(g, x - 31, y - 30, 9, 7, 0x3f6640);
  cabinWindow(g, x + 22, y - 30, 9, 7, 0x3f6640);
  // Porch: roof on posts, a railing either side of the steps.
  g.fillStyle(0x3f6640);
  g.fillRect(x - 43, y - 23, 86, 3);
  g.fillStyle(0x6b4a32);
  for (const px of [-40, -14, 12, 38]) g.fillRect(x + px, y - 20, 2, 17);
  g.fillRect(x - 40, y - 11, 26, 1);
  g.fillRect(x + 14, y - 11, 26, 1);
  for (let rx = x - 38; rx < x - 14; rx += 3) g.fillRect(rx, y - 10, 1, 6);
  for (let rx = x + 16; rx < x + 38; rx += 3) g.fillRect(rx, y - 10, 1, 6);
  g.fillStyle(0x7a5a3e);
  g.fillRect(x - 41, y - 4, 82, 1);
  g.fillRect(x - 8, y - 2, 16, 2);
  // Door with a window, under a badge sign.
  g.fillStyle(0x5a3e2a);
  g.fillRect(x - 6, y - 18, 12, 15);
  g.fillStyle(WINDOW_WARM);
  g.fillRect(x - 3, y - 16, 6, 4);
  g.fillStyle(0xd9b56a);
  g.fillRect(x + 3, y - 10, 1, 1);
  g.fillStyle(0x5a3e2a);
  g.fillRect(x - 13, y - 28, 26, 6);
  g.fillStyle(0xe2d4a8);
  g.fillRect(x - 11, y - 26, 14, 1);
  g.fillRect(x - 11, y - 24, 10, 1);
  g.fillStyle(0xc9a24a);
  g.fillCircle(x + 8, y - 25, 2.5);
  g.fillStyle(0x3f6640);
  g.fillTriangle(x + 6, y - 24, x + 8, y - 28, x + 10, y - 24);
  lantern(g, x - 12, y - 19);
  lantern(g, x + 12, y - 19);
  // Notice board with pinned papers, and a stack of firewood.
  g.fillStyle(0x6b4a32);
  g.fillRect(x - 33, y - 17, 12, 9);
  g.fillStyle(0xd6c9a8);
  g.fillRect(x - 32, y - 16, 10, 7);
  g.fillStyle(0xf4f2ec);
  g.fillRect(x - 31, y - 15, 3, 4);
  g.fillStyle(0xe8d070);
  g.fillRect(x - 27, y - 14, 3, 3);
  g.fillStyle(0x9a7a58);
  for (let wy = y - 9; wy < y - 3; wy += 3) for (let wx = x + 25; wx < x + 36; wx += 3) g.fillCircle(wx + ((wy / 3) & 1), wy, 1.3);
  // Flagpole.
  g.fillStyle(0xb9c0c4);
  g.fillRect(x + 46, y - 92, 1, 89);
  g.fillStyle(0xd9b56a);
  g.fillCircle(x + 46.5, y - 93, 1.5);
}

function rangerFx(g, x, y, elapsed) {
  const wave = Math.round(Math.sin(elapsed * 5) * 1);
  g.fillStyle(0x6f9f78);
  g.fillRect(x + 47, y - 91 + wave, 12, 4);
  g.fillStyle(0xe9e2c8);
  g.fillRect(x + 47, y - 87 + wave, 12, 3);
}

// Old Oak: Oakwood's signature, an ancient oak on a mossy mound with a tire swing.
function drawOldOak(g, x, y) {
  g.fillStyle(0x5f8a48);
  g.fillEllipse(x, y - 2, 120, 12);
  g.fillStyle(0x6e4a32);
  g.fillRect(x - 11, y - 70, 22, 68);
  g.fillTriangle(x - 22, y - 2, x - 9, y - 26, x - 6, y - 2);
  g.fillTriangle(x + 22, y - 2, x + 9, y - 26, x + 6, y - 2);
  g.fillTriangle(x - 8, y - 66, x - 52, y - 92, x - 46, y - 84);
  g.fillTriangle(x - 8, y - 70, x - 46, y - 84, x - 2, y - 58);
  g.fillTriangle(x + 6, y - 66, x + 56, y - 88, x + 2, y - 58);
  g.fillTriangle(x - 3, y - 70, x + 10, y - 112, x + 6, y - 66);
  g.fillStyle(0x553826);
  g.fillRect(x + 6, y - 70, 5, 68);
  g.fillRect(x - 6, y - 50, 2, 10);
  g.fillRect(x - 2, y - 30, 3, 8);
  g.fillStyle(0x7a5640);
  g.fillRect(x - 8, y - 66, 2, 60);
  // Layered crown: deep green with gold-green sunlit clumps, so it reads apart from the trees.
  const clumps = [[-46, -96, 24], [46, -98, 26], [0, -126, 30], [-26, -126, 22], [28, -124, 22], [-60, -108, 16],
    [62, -106, 16], [0, -98, 26], [-22, -146, 16], [20, -144, 16]];
  g.fillStyle(0x2f6233);
  for (const [dx, dy, r] of clumps) g.fillCircle(x + dx, y + dy + 4, r);
  g.fillStyle(0x3f7a3f);
  for (const [dx, dy, r] of clumps) g.fillCircle(x + dx - 2, y + dy, r * 0.88);
  // Sunlight catches the upper clumps as soft crescents, not spots.
  g.fillStyle(0x5f9a48);
  for (const [dx, dy, r] of clumps) g.fillCircle(x + dx - r * 0.18, y + dy - r * 0.22, r * 0.62);
  g.fillStyle(0x8fbf5a);
  for (const [dx, dy, r] of clumps) if (dy < -100) g.fillEllipse(x + dx - r * 0.3, y + dy - r * 0.55, r * 0.7, r * 0.3);
  // Rope swing branch hook; the swing itself sways in oldOakFx.
  g.fillStyle(0x553826);
  g.fillRect(x + 32, y - 82, 2, 3);
}

function oldOakFx(g, x, y, elapsed) {
  const swing = Math.sin(elapsed * 1.6) * 0.18;
  const length = 46;
  const tx = x + 33 + Math.sin(swing) * length;
  const ty = y - 80 + Math.cos(swing) * length;
  g.lineStyle(1, 0xc9b48a, 1);
  g.lineBetween(x + 33, y - 80, tx, ty - 3);
  g.fillStyle(0x2b2b2b);
  g.fillEllipse(tx, ty, 9, 5);
  g.fillStyle(0x5a5a5a);
  g.fillEllipse(tx, ty, 4, 2);
}

// Fire lookout: a timber tower on splayed legs with cross-bracing, a stair and a glazed cab.
function drawLookout(g, x, y) {
  const top = y - 92;
  g.fillStyle(0x7a5638);
  for (const side of [-1, 1]) {
    g.lineStyle(3, 0x7a5638, 1);
    g.lineBetween(x + side * 20, y, x + side * 12, top);
  }
  g.lineStyle(1, 0x6b4a30, 1);
  for (let h = y - 4; h > top + 8; h -= 22) {
    const half = d => 20 - 8 * (y - d) / (y - top);
    g.lineBetween(x - half(h), h, x + half(h - 22), h - 22);
    g.lineBetween(x + half(h), h, x - half(h - 22), h - 22);
    g.lineBetween(x - half(h), h, x + half(h), h);
  }
  // Zig-zag stair.
  g.lineStyle(1, 0x8a6a4a, 1);
  for (let h = y; h > top + 4; h -= 22) g.lineBetween(x - 22, h, x - 14, h - 22);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 18, top - 2, 36, 4);
  g.fillStyle(0xcbb48c);
  g.fillRect(x - 15, top - 20, 30, 18);
  g.fillStyle(GLASS);
  g.fillRect(x - 13, top - 18, 26, 8);
  g.fillStyle(0x7a5638);
  for (const wx of [-5, 4]) g.fillRect(x + wx, top - 18, 1, 8);
  g.fillStyle(0x4a6e48);
  g.fillTriangle(x - 20, top - 19, x, top - 31, x + 20, top - 19);
  g.fillStyle(0xb9c0c4);
  g.fillRect(x, top - 40, 1, 10);
}

function lookoutFx(g, x, y, elapsed) {
  // A ranger's lamp blinks in the cab.
  g.fillStyle(0xffe08a, 0.35 + 0.35 * (Math.sin(elapsed * 1.3) > 0));
  g.fillRect(x - 3, y - 108, 6, 4);
}

// Trailhead: a fingerpost, a map board and two picnic tables at the edge of the trees.
function drawTrailhead(g, x, y) {
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 30, y - 28, 2, 26);
  g.fillStyle(0x8a6a4a);
  g.fillTriangle(x - 40, y - 26, x - 44, y - 23, x - 40, y - 20);
  g.fillRect(x - 40, y - 26, 14, 6);
  g.fillTriangle(x - 18, y - 18, x - 14, y - 15, x - 18, y - 12);
  g.fillRect(x - 32, y - 18, 14, 6);
  g.fillStyle(0xe2d4a8);
  g.fillRect(x - 38, y - 24, 9, 1);
  g.fillRect(x - 30, y - 16, 9, 1);
  // Map board under a little roof.
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 6, y - 22, 2, 19);
  g.fillRect(x + 12, y - 22, 2, 19);
  g.fillStyle(0x4f7a4f);
  g.fillTriangle(x - 9, y - 22, x + 5, y - 30, x + 17, y - 22);
  g.fillStyle(0xd6c9a8);
  g.fillRect(x - 4, y - 21, 16, 11);
  g.fillStyle(0x6f9f78);
  g.fillRect(x - 2, y - 19, 7, 3);
  g.fillStyle(0x4f86b0);
  g.fillRect(x + 4, y - 15, 6, 3);
  for (const tx of [26, 52]) {
    g.fillStyle(0x8a6a4a);
    g.fillRect(x + tx - 10, y - 9, 20, 2);
    g.fillRect(x + tx - 12, y - 5, 24, 1);
    g.fillRect(x + tx - 8, y - 7, 2, 4);
    g.fillRect(x + tx + 6, y - 7, 2, 4);
  }
}

// Lakeside lodge: log walls on a stone base, a mossy shingle roof with a cross gable and two
// dormers, the fieldstone chimney (chimneyFx at (36, 70)), a railed porch with lanterns, antlers
// over the door and a canoe racked on the wall.
function drawLodge(g, x, y) {
  footing(g, x, y, 96, 0x8a857c);
  g.fillStyle(0x8a857c);
  g.fillRect(x - 46, y - 6, 92, 6);
  logWall(g, x - 44, y - 40, 88, 34, 0x7a5034);
  // Roof: main gable and a cross gable over the entrance.
  shingleRoof(g, x - 50, x + 50, y - 40, x - 12, y - 66, 0x5a6e4a, 0.35);
  g.fillStyle(0x5a6e4a);
  g.fillRect(x - 12, y - 66, 34, 26);
  g.fillTriangle(x + 22, y - 66, x + 50, y - 40, x + 22, y - 40);
  g.fillStyle(0x4a5c3c);
  for (let ry = y - 63; ry < y - 40; ry += 3) {
    g.fillRect(x - 12, ry, 34 + (ry - (y - 66)) * 28 / 26, 1);
  }
  g.fillRect(x - 50, y - 42, 100, 3);
  g.fillStyle(0x6f8a4a);
  g.fillRect(x + 4, y - 60, 6, 2);
  g.fillRect(x - 30, y - 48, 5, 2);
  for (const dx of [-14, 12]) {
    logWall(g, x + dx - 6, y - 58, 12, 10, 0x7a5034);
    g.fillStyle(0x5a6e4a);
    g.fillTriangle(x + dx - 8, y - 57, x + dx, y - 64, x + dx + 8, y - 57);
    g.fillStyle(0x4a5c3c);
    g.fillRect(x + dx - 8, y - 58, 16, 1);
    cabinWindow(g, x + dx - 3, y - 55, 6, 5);
  }
  // Fieldstone chimney with a cap.
  g.fillStyle(0x9a948a);
  g.fillRect(x + 31, y - 72, 10, 69);
  for (let cy = y - 70, k = 0; cy < y - 4; cy += 4, k++) {
    g.fillStyle(k % 2 ? 0x7f7a72 : 0xaaa49a);
    g.fillRect(x + 31 + (k % 3), cy, 5, 3);
    g.fillStyle(0x8a857c);
    g.fillRect(x + 37 - (k % 2), cy + 1, 3, 2);
  }
  g.fillStyle(0x6d6a64);
  g.fillRect(x + 30, y - 73, 12, 2);
  // Upper windows.
  cabinWindow(g, x - 34, y - 35, 8, 6);
  cabinWindow(g, x - 2, y - 35, 8, 6);
  // Porch: roof, posts, log railing, steps.
  g.fillStyle(0x4a5c3c);
  g.fillRect(x - 49, y - 25, 74, 3);
  g.fillStyle(0x5a3e2a);
  for (const px of [-46, -26, -6, 14, 22]) g.fillRect(x + px, y - 22, 2, 19);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 46, y - 11, 38, 2);
  g.fillRect(x + 8, y - 11, 16, 2);
  for (let rx = x - 44; rx < x - 8; rx += 4) g.fillRect(rx, y - 9, 1, 5);
  for (let rx = x + 10; rx < x + 22; rx += 4) g.fillRect(rx, y - 9, 1, 5);
  g.fillStyle(0x7a5a3e);
  g.fillRect(x - 48, y - 4, 72, 1);
  g.fillRect(x - 8, y - 2, 16, 2);
  // Door under antlers, porch windows, lanterns.
  g.fillStyle(0x4a321f);
  g.fillRect(x - 6, y - 19, 12, 16);
  g.fillStyle(0x3a2616);
  g.fillRect(x - 6, y - 11, 12, 1);
  g.fillRect(x, y - 19, 1, 16);
  g.fillStyle(0xd9b56a);
  g.fillRect(x + 3, y - 11, 1, 1);
  g.fillStyle(0xe8dcc0);
  g.fillRect(x - 1, y - 23, 2, 2);
  g.fillRect(x - 5, y - 25, 3, 1);
  g.fillRect(x + 2, y - 25, 3, 1);
  g.fillRect(x - 5, y - 27, 1, 2);
  g.fillRect(x + 4, y - 27, 1, 2);
  cabinWindow(g, x - 36, y - 20, 10, 8);
  cabinWindow(g, x + 12, y - 20, 8, 8);
  lantern(g, x - 16, y - 21);
  lantern(g, x + 9, y - 21);
  // Canoe racked on the west wall.
  g.fillStyle(0xb8473f);
  g.fillEllipse(x - 33, y - 28, 22, 4);
  g.fillStyle(0x8a3530);
  g.fillRect(x - 43, y - 28, 20, 1);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 40, y - 27, 1, 3);
  g.fillRect(x - 27, y - 27, 1, 3);
}

// Rising, fading puffs above a chimney at (dx, height) art px from the base.
function chimneyFx(dx, height) {
  return (g, x, y, elapsed) => {
    for (let i = 0; i < 4; i++) {
      const t = (elapsed * 0.35 + i / 4) % 1;
      g.fillStyle(0xe6e8ea, 0.5 * (1 - t));
      g.fillCircle(x + dx + t * 10 + Math.sin(elapsed + i) * 2, y - height - 4 - t * 26, 2 + t * 4);
    }
  };
}

// Fishing pier: a plank deck on piles reaching out over the lake, a lamp post at the end and a
// red-and-white life ring.
function drawPier(g, x, y) {
  const deck = y - 7;
  const left = x - 66;
  const right = x + 66;
  g.fillStyle(0x6b5038);
  for (let px = left + 4; px < right; px += 16) g.fillRect(px, deck, 3, 16);
  g.fillStyle(0x9a7a58);
  g.fillRect(left, deck - 3, right - left, 3);
  g.fillStyle(0x86694a);
  for (let px = left; px < right; px += 5) g.fillRect(px, deck - 3, 1, 3);
  // Rail along the far end, a lamp post and a life ring.
  g.fillStyle(0x6b5038);
  g.fillRect(right - 40, deck - 10, 1, 7);
  g.fillRect(right - 20, deck - 10, 1, 7);
  g.fillRect(right - 40, deck - 10, 40, 1);
  g.fillRect(right - 2, deck - 24, 2, 21);
  g.fillStyle(0xffe08a);
  g.fillRect(right - 4, deck - 27, 6, 4);
  g.fillStyle(0xc9483e);
  g.fillCircle(right - 30, deck - 7, 3);
  g.fillStyle(0xf2efe6);
  g.fillCircle(right - 30, deck - 7, 1.5);
  // A ladder down to the water.
  g.fillStyle(0x8a8f8a);
  g.fillRect(left + 40, deck, 1, 10);
  g.fillRect(left + 44, deck, 1, 10);
  for (let ly = deck + 2; ly < deck + 10; ly += 3) g.fillRect(left + 40, ly, 5, 1);
}

// Lake beacon: Mirror Lake's signature, a white lighthouse with a red lantern room on a rock islet.
function drawBeacon(g, x, y) {
  g.fillStyle(0x6f6f6a);
  g.fillEllipse(x, y + 2, 40, 18);
  g.fillStyle(0x8a8a84);
  g.fillEllipse(x - 4, y - 2, 34, 12);
  g.fillStyle(0xa4a49c);
  g.fillCircle(x - 10, y - 5, 4);
  g.fillCircle(x + 8, y - 4, 3);
  g.fillStyle(0xf0ece4);
  g.fillTriangle(x - 10, y - 6, x - 6, y - 80, x, y - 6);
  g.fillTriangle(x + 10, y - 6, x + 6, y - 80, x, y - 6);
  g.fillRect(x - 6, y - 80, 12, 74);
  g.fillStyle(0xd9d2c3);
  g.fillTriangle(x + 4, y - 6, x + 6, y - 80, x + 10, y - 6);
  g.fillStyle(0xb84a3e);
  g.fillRect(x - 8, y - 50, 16, 6);
  g.fillRect(x - 3, y - 12, 6, 6);
  g.fillStyle(0x3b3b3b);
  g.fillRect(x - 9, y - 82, 18, 2);
  g.fillRect(x - 7, y - 92, 14, 1);
  g.fillStyle(0xb84a3e);
  g.fillRect(x - 6, y - 92, 12, 10);
  g.fillStyle(GLASS);
  g.fillRect(x - 4, y - 90, 8, 6);
  g.fillStyle(0xb84a3e);
  g.fillTriangle(x - 7, y - 92, x, y - 100, x + 7, y - 92);
  g.fillStyle(0x3b3b3b);
  g.fillRect(x, y - 104, 1, 4);
  g.fillStyle(GLASS);
  g.fillRect(x - 2, y - 34, 3, 4);
  g.fillRect(x - 2, y - 64, 3, 4);
}

function beaconFx(g, x, y, elapsed) {
  // A slow lamp sweep: the beam grows toward the viewer, then passes.
  const t = (elapsed * 0.5) % 1;
  const glow = Math.max(0, Math.sin(t * Math.PI * 2));
  g.fillStyle(0xffe9a0, 0.5 + 0.5 * glow);
  g.fillRect(x - 3, y - 89, 6, 4);
  if (glow > 0.05) {
    const side = t < 0.25 ? 1 : -1;
    g.fillStyle(0xfff3c4, 0.22 * glow);
    g.fillTriangle(x, y - 87, x + side * 70, y - 96, x + side * 70, y - 78);
  }
}

// Red boathouse: board-and-batten walls with white trim and corner boards, a big X-braced water door,
// a louvred cupola, a dock with bollards and a moored rowboat, oars and a life ring on the wall, and
// the person door on the land side.
function drawBoathouse(g, x, y) {
  const deck = y - 7;
  // Dock with piles, bollards and a rowboat tied alongside.
  g.fillStyle(0x6b5038);
  for (let px = x - 70; px < x - 34; px += 12) g.fillRect(px, deck, 3, 14);
  g.fillStyle(0x9a7a58);
  g.fillRect(x - 72, deck - 3, 40, 3);
  g.fillStyle(0x7a5a3e);
  for (let px = x - 70; px < x - 34; px += 4) g.fillRect(px, deck - 3, 1, 3);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 68, deck - 6, 3, 3);
  g.fillRect(x - 40, deck - 6, 3, 3);
  g.fillStyle(0x4f7a8a);
  g.fillTriangle(x - 64, deck + 2, x - 44, deck + 2, x - 42, deck - 2);
  g.fillRect(x - 64, deck - 2, 22, 4);
  g.fillStyle(0xf2efe6);
  g.fillRect(x - 64, deck - 2, 22, 1);
  // Walls, battens, trim.
  g.fillStyle(0xa84a3a);
  g.fillRect(x - 34, y - 46, 68, 43);
  g.fillStyle(0x8f3d30);
  for (let bx = x - 32; bx < x + 34; bx += 5) g.fillRect(bx, y - 46, 1, 43);
  g.fillStyle(0xf2efe6);
  g.fillRect(x - 34, y - 46, 2, 43);
  g.fillRect(x + 32, y - 46, 2, 43);
  // Roof with a cupola on the ridge.
  g.fillStyle(0x4a4a4e);
  g.fillTriangle(x - 40, y - 45, x, y - 62, x + 40, y - 45);
  g.fillStyle(0x3a3a3e);
  for (let ry = y - 59; ry < y - 45; ry += 3) {
    const w = (ry - (y - 62)) / 17 * 80;
    g.fillRect(x - w / 2, ry, w, 1);
  }
  g.fillStyle(0xf2efe6);
  g.fillRect(x - 40, y - 47, 80, 2);
  g.fillRect(x - 4, y - 66, 8, 6);
  g.fillStyle(0xa84a3a);
  g.fillRect(x - 3, y - 65, 6, 4);
  g.fillStyle(0xf2efe6);
  for (let lx = x - 2; lx < x + 3; lx += 2) g.fillRect(lx, y - 65, 1, 4);
  g.fillStyle(0x4a4a4e);
  g.fillTriangle(x - 5, y - 66, x, y - 70, x + 5, y - 66);
  // Gable window.
  g.fillStyle(0xf2efe6);
  g.fillRect(x - 5, y - 57, 8, 7);
  g.fillStyle(GLASS);
  g.fillRect(x - 4, y - 56, 6, 5);
  // Water door: white frame and X braces.
  g.fillStyle(0xf2efe6);
  g.fillRect(x - 25, y - 34, 28, 2);
  g.fillRect(x - 25, y - 34, 2, 31);
  g.fillRect(x + 1, y - 34, 2, 31);
  g.fillStyle(0x5a4a44);
  g.fillRect(x - 23, y - 32, 24, 29);
  g.fillStyle(0x6e5c54);
  for (let dy = y - 30; dy < y - 4; dy += 4) g.fillRect(x - 23, dy, 24, 1);
  g.lineStyle(1, 0xf2efe6, 1);
  g.lineBetween(x - 23, y - 32, x + 1, y - 3);
  g.lineBetween(x + 1, y - 32, x - 23, y - 3);
  g.fillStyle(0xf2efe6);
  g.fillRect(x - 11, y - 32, 1, 29);
  // Oars and a life ring on the wall.
  g.fillStyle(0xc9a46a);
  g.fillRect(x + 25, y - 40, 1, 18);
  g.fillRect(x + 28, y - 40, 1, 18);
  g.fillRect(x + 24, y - 24, 3, 4);
  g.fillRect(x + 27, y - 24, 3, 4);
  g.fillStyle(0xf2efe6);
  g.fillCircle(x + 9, y - 37, 4);
  g.fillStyle(0xd9605a);
  g.fillRect(x + 5, y - 38, 2, 2);
  g.fillRect(x + 11, y - 38, 2, 2);
  g.fillRect(x + 8, y - 41, 2, 2);
  g.fillRect(x + 8, y - 35, 2, 2);
  g.fillStyle(0xa84a3a);
  g.fillCircle(x + 9, y - 37, 1.8);
  // Person door on the land side, with a lamp and a window.
  g.fillStyle(0xf2efe6);
  g.fillRect(x + 10, y - 19, 12, 16);
  g.fillStyle(0x5a3e2a);
  g.fillRect(x + 12, y - 17, 8, 14);
  g.fillStyle(GLASS);
  g.fillRect(x + 14, y - 15, 4, 4);
  lantern(g, x + 24, y - 20);
  cabinWindow(g, x + 22, y - 38, 7, 6);
}

// Campground: two tents, a stone fire ring with log seats and a little woodpile.
function drawCampground(g, x, y) {
  g.fillStyle(0x5f7a4a);
  g.fillTriangle(x - 52, y - 3, x - 36, y - 24, x - 20, y - 3);
  g.fillStyle(0x4f6a3c);
  g.fillTriangle(x - 36, y - 3, x - 36, y - 24, x - 20, y - 3);
  g.fillStyle(0x2f3a28);
  g.fillTriangle(x - 40, y - 3, x - 36, y - 12, x - 32, y - 3);
  g.fillStyle(0xc9a46a);
  g.fillTriangle(x + 22, y - 3, x + 38, y - 22, x + 54, y - 3);
  g.fillStyle(0xb08c56);
  g.fillTriangle(x + 38, y - 3, x + 38, y - 22, x + 54, y - 3);
  g.fillStyle(0x6b5038);
  g.fillRect(x + 38, y - 26, 1, 4);
  // Fire ring and log seats.
  g.fillStyle(0x8a8a84);
  for (const dx of [-7, -3, 1, 5]) g.fillCircle(x + dx, y - 4, 2);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 3, y - 7, 6, 2);
  g.fillStyle(0x7a5638);
  g.fillRect(x - 20, y - 6, 10, 3);
  g.fillRect(x + 10, y - 6, 10, 3);
  g.fillStyle(0xb08c6a);
  g.fillCircle(x - 20, y - 5, 1.5);
  g.fillCircle(x + 20, y - 5, 1.5);
  // Woodpile by the green tent.
  g.fillStyle(0x7a5638);
  for (const [dx, dy] of [[-62, 0], [-56, 0], [-59, -4]]) g.fillCircle(x + dx, y - 5 + dy, 2.5);
  g.fillStyle(0xc9a46a);
  for (const [dx, dy] of [[-62, 0], [-56, 0], [-59, -4]]) g.fillCircle(x + dx, y - 5 + dy, 1);
}

function campfireFx(g, x, y, elapsed) {
  const flick = Math.sin(elapsed * 17) * 0.5 + Math.sin(elapsed * 11) * 0.5;
  g.fillStyle(0xe9823a);
  g.fillTriangle(x - 4, y - 7, x + flick, y - 15 - flick * 2, x + 4, y - 7);
  g.fillStyle(0xffd26a);
  g.fillTriangle(x - 2, y - 7, x + flick * 0.5, y - 11 - flick, x + 2, y - 7);
  for (let i = 0; i < 3; i++) {
    const t = (elapsed * 0.4 + i / 3) % 1;
    g.fillStyle(0xd8dadc, 0.4 * (1 - t));
    g.fillCircle(x + t * 6 + Math.sin(elapsed * 2 + i) * 2, y - 18 - t * 30, 2 + t * 4);
  }
}

// Sawmill: an open timber shed with a tin roof, a big saw blade, a log deck and stacked lumber.
function drawSawmill(g, x, y) {
  footing(g, x, y, 112, 0x7f7a72);
  g.fillStyle(0x6b4a30);
  for (const px of [-48, -16, 16, 48]) g.fillRect(x + px - 2, y - 44, 4, 41);
  g.fillRect(x - 52, y - 46, 104, 4);
  g.lineStyle(2, 0x6b4a30, 1);
  g.lineBetween(x - 48, y - 30, x - 30, y - 44);
  g.lineBetween(x + 48, y - 30, x + 30, y - 44);
  g.fillStyle(0x8f979b);
  g.fillTriangle(x - 58, y - 45, x, y - 64, x + 58, y - 45);
  g.fillStyle(0x7a8286);
  for (let rx = x - 50; rx < x + 52; rx += 8) g.fillRect(rx, y - 52 + Math.abs(rx - x) * 0.3, 1, 6);
  // Saw bench and the blade hub (the blade itself spins in sawFx).
  g.fillStyle(0x5a3e2a);
  g.fillRect(x - 36, y - 16, 64, 4);
  g.fillRect(x - 34, y - 12, 3, 9);
  g.fillRect(x + 24, y - 12, 3, 9);
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 34, y - 22, 26, 6);
  g.fillStyle(0xc9a46a);
  g.fillCircle(x - 34, y - 19, 3);
  // Log deck outside on the right, lumber stack on the left.
  g.fillStyle(0x7a5638);
  for (const [dx, dy] of [[58, 0], [66, 0], [74, 0], [62, -7], [70, -7], [66, -14]]) g.fillCircle(x + dx, y - 6 + dy, 4);
  g.fillStyle(0xc9a46a);
  for (const [dx, dy] of [[58, 0], [66, 0], [74, 0], [62, -7], [70, -7], [66, -14]]) g.fillCircle(x + dx, y - 6 + dy, 2);
  g.fillStyle(0xd6b98a);
  for (let ly = y - 6; ly > y - 24; ly -= 4) g.fillRect(x - 74, ly, 22, 3);
  g.fillStyle(0xb09670);
  for (let ly = y - 6; ly > y - 24; ly -= 4) g.fillRect(x - 74, ly + 2, 22, 1);
}

function sawFx(g, x, y, elapsed) {
  const cx = x + 6;
  const cy = y - 20;
  g.fillStyle(0xc9cfd2);
  g.fillCircle(cx, cy, 9);
  g.fillStyle(0x8f979b);
  for (let i = 0; i < 8; i++) {
    const a = elapsed * 14 + i * Math.PI / 4;
    g.fillRect(cx + Math.cos(a) * 9 - 1, cy + Math.sin(a) * 9 - 1, 2, 2);
  }
  g.fillStyle(0x5a5f62);
  g.fillCircle(cx, cy, 2);
  // Sawdust spray off the cut.
  for (let i = 0; i < 4; i++) {
    const t = (elapsed * 2 + i / 4) % 1;
    g.fillStyle(0xe6cf9a, 0.8 * (1 - t));
    g.fillRect(cx - 10 - t * 14, cy + 2 - t * 6 + t * t * 14, 1, 1);
  }
}

// Timber cabin: logs with ringed ends, a mossy shingle roof, the stone chimney (chimneyFx at
// (18, 52)), shuttered windows with flower boxes, a hood over the door, and a stump with an axe by
// the log pile.
function drawCabin(g, x, y) {
  footing(g, x, y, 60);
  g.fillStyle(0x8a857c);
  g.fillRect(x - 30, y - 5, 60, 5);
  logWall(g, x - 28, y - 30, 56, 25, 0x8a5a3a);
  g.fillStyle(0x9a948a);
  g.fillRect(x + 14, y - 52, 8, 20);
  for (let cy = y - 50, k = 0; cy < y - 32; cy += 4, k++) {
    g.fillStyle(k % 2 ? 0x7f7a72 : 0xaaa49a);
    g.fillRect(x + 14 + (k % 2) * 3, cy, 4, 3);
  }
  g.fillStyle(0x6d6a64);
  g.fillRect(x + 13, y - 53, 10, 2);
  shingleRoof(g, x - 34, x + 34, y - 29, x, y - 50, 0x6e4e3a, 0.4);
  // Gable vent.
  g.fillStyle(0x4a321f);
  g.fillRect(x - 3, y - 42, 6, 4);
  g.fillStyle(0x8a5a3a);
  g.fillRect(x - 3, y - 41, 6, 1);
  cabinWindow(g, x - 21, y - 24, 8, 6, 0x4f6e4a, true);
  cabinWindow(g, x + 13, y - 24, 8, 6, 0x4f6e4a, true);
  // Door under a little hood.
  g.fillStyle(0x4a321f);
  g.fillRect(x - 5, y - 17, 10, 14);
  g.fillStyle(0x3a2616);
  for (let py = y - 15; py < y - 3; py += 4) g.fillRect(x - 5, py, 10, 1);
  g.fillStyle(0xd9b56a);
  g.fillRect(x + 2, y - 10, 1, 1);
  g.fillStyle(0x5a3e2a);
  g.fillTriangle(x - 8, y - 18, x, y - 23, x + 8, y - 18);
  lantern(g, x + 7, y - 17);
  g.fillStyle(0x7a5a3e);
  g.fillRect(x - 7, y - 3, 14, 1);
  // Log pile, a stump with an axe in it.
  g.fillStyle(0x7a5638);
  for (const dx of [-38, -33, -35.5]) g.fillCircle(x + dx, y - (dx === -35.5 ? 9 : 5), 2.5);
  g.fillStyle(0xc9a46a);
  for (const dx of [-38, -33, -35.5]) g.fillCircle(x + dx, y - (dx === -35.5 ? 9 : 5), 1);
  g.fillStyle(0x6b4a30);
  g.fillRect(x + 25, y - 5, 6, 5);
  g.fillStyle(0xc9a46a);
  g.fillRect(x + 25, y - 5, 6, 1);
  g.fillStyle(0x7a5638);
  g.fillRect(x + 29, y - 11, 1, 7);
  g.fillStyle(0x9aa2a8);
  g.fillRect(x + 27, y - 6, 3, 2);
}

// Street first, then landmarks, matching the city's order.
export const FOREST_BUILDINGS = Object.freeze([
  ...forestTrees(),
  ...FOREST_LANDMARKS.map((landmark, i) => ({ maxHealth: 260, seed: 80 + i, ...landmark })),
]);

// buildings: false leaves trees and landmarks to a mode that draws them itself (evil mode).
export function drawForest(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((FOREST.from + FOREST.to) / 2, cameraX);
  if (right < mid - (FOREST.to - FOREST.from) / 2 - 400 || left > mid + (FOREST.to - FOREST.from) / 2 + 400) return;
  drawTreeline(g, left, right, seaY, cameraX, FAR_PARALLAX, 0x9cc4b6, 0.6, 0.25);
  drawTreeline(g, left, right, seaY, cameraX, NEAR_PARALLAX, 0x86b4a0, 1, 0.5);
  if (!buildings) return;
  for (const building of FOREST_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    const y = forestBase(building.x, seaY);
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}

// Each copy of the forest's parallax rows pivots on the forest centre, clipped to the forest.
function eachTreelineColumn(left, right, cameraX, parallax, draw) {
  const shift = (cameraX - nearest((FOREST.from + FOREST.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, FOREST.from, FOREST.to);
    if (fade <= 0) continue;
    draw(x, Math.round(wx / SKYLINE_STEP), ground, fade);
  }
}

// Background treeline: flat rounded crowns, no trunks or highlights, so it stays scenery. Over
// the lake it stands on the far shore at the water line.
function treelineHeight(seed, scale) {
  return (34 + hash(seed + scale) * 40) * scale * CITY_SCALE;
}

function drawTreeline(g, left, right, seaY, cameraX, parallax, color, scale, salt) {
  eachTreelineColumn(left, right, cameraX, parallax, (x, seed, ground, fade) => {
    if (hash(seed + salt) < 0.15) return;
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const tall = treelineHeight(seed, scale);
    const r = Math.round(15 + hash(seed + 0.4 + salt) * 6);
    // A stepped, rounded crown from three rects: flat like the city skyline, and far cheaper
    // to draw every frame than a circle.
    const top = Math.round(y - tall);
    g.fillStyle(color, fade);
    g.fillRect(x, top + 8, 2 * r, y - top - 8);
    g.fillRect(x + 4, top + 3, 2 * r - 8, 6);
    g.fillRect(x + 9, top, 2 * r - 18, 4);
  });
}

// Mirror Lake lives up to its name: the near treeline and the beacon reflect on the water as soft,
// rippling bands, with glints drifting across. Drawn over the water, under the boats.
export function drawLakeReflections(g, left, right, seaY, cameraX, elapsed) {
  const from = nearest(LAKE.from, cameraX);
  const to = from + (LAKE.to - LAKE.from);
  if (right < from || left > to) return;
  const lo = Math.max(left, from + 4);
  const hi = Math.min(right, to - 4);
  eachTreelineColumn(lo - SKYLINE_STEP, hi, cameraX, NEAR_PARALLAX, (x, seed) => {
    if (hash(seed + 0.5) < 0.15) return;
    const r = 15 + hash(seed + 0.4 + 0.5) * 6;
    const depth = Math.min(26, treelineHeight(seed, 1) * 0.3);
    for (let dy = 1; dy < depth; dy += 2) {
      const wobble = Math.round(Math.sin(elapsed * 1.5 + dy * 0.7 + x * 0.05) * 1.5);
      const a = Math.max(x + 4, lo) + wobble;
      const b = Math.min(x + 2 * r - 4, hi) + wobble;
      if (b <= a) continue;
      g.fillStyle(0x2f6a5a, 0.3 * (1 - dy / depth));
      g.fillRect(a, seaY + dy, b - a, 1);
    }
  });
  const beacon = FOREST_LANDMARKS.find(l => l.id === 'lake-beacon');
  const bx = nearest(beacon.x, cameraX);
  for (let dy = 2; dy < 40; dy += 2) {
    const wobble = Math.round(Math.sin(elapsed * 2 + dy * 0.6) * 1.5);
    g.fillStyle(dy > 26 && dy < 34 ? 0xb84a3e : 0xf0ece4, 0.22 * (1 - dy / 40));
    g.fillRect(bx - 6 + wobble, seaY + 6 + dy, 12, 1);
  }
  g.fillStyle(0xffffff, 0.35);
  for (let i = 0; i < 18; i++) {
    const gx = from + ((hash(i + 0.31) * (to - from) + elapsed * (6 + hash(i) * 8)) % (to - from));
    if (gx < lo || gx > hi) continue;
    const gy = seaY + 2 + Math.round(hash(i + 0.77) * 26);
    const w = 3 + Math.round(4 * Math.max(0, Math.sin(elapsed * 1.8 + i)));
    g.fillRect(Math.round(gx), gy, w, 1);
  }
}
