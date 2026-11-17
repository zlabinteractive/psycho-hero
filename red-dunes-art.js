import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// The Red Dunes, Sunland's desert between Sandport and Palm Oasis, built to the same rules as the
// forest (game-design-rules/city-design-rules.md): two flat parallax rows (far mesas and buttes,
// nearer dune humps) sit behind a destructible "street" of desert life in one muted ochre theme
// (flat-topped acacias, dead trees, scrub and boulders), with detailed landmarks in their own
// palettes: the lonely fuel station, the nomad camp with its fire, the Red Arch (the signature, a
// great sandstone arch on the highest crest, taller than anything around), the wrecked old prop plane
// and the half-buried temple ruins. Sand streams off the dune crests in the wind.
// Everything that can break is listed once in RED_DUNES_BUILDINGS, so evil mode can promote it.
export const RED_DUNES = { from: 27400, to: 30400 };
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 34;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
// Plants and rocks stand this far apart, a desert sparse rather than a forest dense.
const FLORA_STEP = 46 * CITY_SCALE;
const DESERT_EDGE = 220;

// The "street" theme: dusty olive leaves, grey-brown wood, ochre and rust rock.
const WOOD = 0x6e5a44;
const WOOD_DARK = 0x54443a;
const LEAF = [0x7a8450, 0x6e7a48, 0x84905a];
const LEAF_DARK = 0x5e6a3e;
const SCRUB = [0x9a9460, 0x8a8a58, 0xa8a06a];
const BOULDER = [0xa8684a, 0x9a5e44, 0xb4765a];
const BOULDER_DARK = 0x7e4a36;
// Landmark palettes.
const ARCH = 0xb8603e;
const ARCH_LIGHT = 0xd27e56;
const ARCH_DARK = 0x8e4630;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building. On a dune's flank one side sits lower, so every building draws a
// footing below this line that the terrain hides.
export function dunesBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the flora leaves free. width/height: hit box once promoted.
// fx draws animated parts (the fire's smoke, the fuel sign's flicker) in free roam only.
const LANDMARK_ART = [
  { id: 'fuel-station', x: 28000, door: true, draw: drawFuelStation, fx: fuelFx, clear: 40, width: 70, height: 46, maxHealth: 220 },
  { id: 'nomad-camp', x: 28700, door: true, draw: drawNomadCamp, fx: campFx, clear: 46, width: 84, height: 26, maxHealth: 140 },
  { id: 'red-arch', x: 29050, draw: drawRedArch, clear: 46, width: 84, height: 124, maxHealth: 420 },
  { id: 'plane-wreck', x: 29400, draw: drawPlaneWreck, clear: 44, width: 80, height: 28, maxHealth: 200 },
  { id: 'sand-ruins', x: 29750, draw: drawRuins, clear: 40, width: 72, height: 56, maxHealth: 260 },
];
export const RED_DUNES_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// Desert flora between the landmarks: acacias, dead trees, scrub and boulders, sparser toward the
// towns at either end.
const FLORA = ['acacia', 'deadtree', 'scrub', 'boulder'];
function desertFlora() {
  const list = [];
  for (let i = Math.ceil(RED_DUNES.from / FLORA_STEP); i * FLORA_STEP <= RED_DUNES.to; i++) {
    const seed = i + 0.67;
    const slot = i * FLORA_STEP;
    const taper = Math.min(1, Math.min(slot - RED_DUNES.from, RED_DUNES.to - slot) / DESERT_EDGE);
    if (hash(seed) < 0.2 + 0.5 * (1 - taper)) continue;
    const roll = hash(seed + 0.1);
    const kind = roll < 0.32 ? 'acacia' : roll < 0.46 ? 'deadtree' : roll < 0.76 ? 'scrub' : 'boulder';
    const [w0, w1, h0, h1] = { acacia: [30, 12, 30, 14], deadtree: [16, 8, 22, 12], scrub: [12, 6, 7, 5], boulder: [14, 12, 8, 8] }[kind];
    const art = w0 + Math.round(hash(seed + 0.2) * w1);
    const tall = Math.round(h0 + hash(seed + 0.3) * h1);
    const width = art * CITY_SCALE;
    const x = slot + Math.round((FLORA_STEP - width) * hash(seed + 0.4)) + width / 2;
    const gap = Math.min(...RED_DUNES_LANDMARKS.map(l => Math.abs(x - l.x) - l.clear - width / 2));
    if (gap < 2) continue;
    const shade = hash(seed + 0.6);
    list.push({
      countsAsBuilding: false, id: `dune-${kind}-${i}`, seed, kind, x, width, height: (tall + 3) * CITY_SCALE,
      // roof: crown top, where vultures perch (red-dunes-life.js).
      roof: (kind === 'acacia' || kind === 'deadtree' ? tall - 2 : tall) * CITY_SCALE,
      maxHealth: kind === 'boulder' ? 160 : 90,
      draw: scaled((g, at, y) => drawFlora(g, at, y, kind, art, tall, shade)),
    });
  }
  return list;
}

function drawFlora(g, x, y, kind, width, tall, shade) {
  if (kind === 'acacia') return drawAcacia(g, x, y, width, tall, shade);
  if (kind === 'deadtree') return drawDeadTree(g, x, y, width, tall, shade);
  if (kind === 'scrub') return drawScrub(g, x, y, width, tall, shade);
  return drawBoulder(g, x, y, width, tall, shade);
}

// Acacia: a crooked trunk forking into two or three limbs under a wide, flat-topped canopy.
function drawAcacia(g, x, y, width, tall, shade) {
  const crown = y - tall;
  const lean = shade < 0.5 ? -1 : 1;
  g.fillStyle(WOOD);
  g.fillRect(x - 1, crown + 4, 3, tall - 4 + 6);
  g.lineStyle(2, WOOD);
  g.lineBetween(x, crown + 10, x - width * 0.28, crown + 2);
  g.lineBetween(x + 1, crown + 8, x + width * 0.3, crown + 2);
  g.lineStyle(1, WOOD);
  g.lineBetween(x, crown + 6, x + lean * 4, crown + 1);
  g.fillStyle(WOOD_DARK);
  g.fillRect(x + 1, crown + 6, 1, tall);
  const r = width / 2;
  const leaf = LEAF[Math.floor(shade * LEAF.length)];
  g.fillStyle(LEAF_DARK);
  g.fillRect(x - r, crown, width, 3);
  g.fillStyle(leaf);
  g.fillRect(x - r + 2, crown - 4, width - 4, 4);
  g.fillRect(x - r + 6, crown - 6, width - 12, 2);
  g.fillStyle(lerpColor(leaf, 0xffffff, 0.15));
  g.fillRect(x - r + 8, crown - 6, Math.round(width * 0.3), 1);
  // Ragged underside.
  g.fillStyle(LEAF_DARK);
  for (let lx = x - r + 1; lx < x + r - 1; lx += 3) g.fillRect(lx, crown + 3, 2, 1);
}

// Dead tree: bare, sun-bleached forked branches.
function drawDeadTree(g, x, y, width, tall, shade) {
  const bone = lerpColor(0x9a8a76, 0xc8b8a0, shade);
  g.lineStyle(2, bone);
  g.lineBetween(x, y + 6, x, y - tall * 0.55);
  g.lineStyle(1, bone);
  g.lineBetween(x, y - tall * 0.5, x - width * 0.4, y - tall);
  g.lineBetween(x, y - tall * 0.55, x + width * 0.35, y - tall * 0.92);
  g.lineBetween(x - width * 0.2, y - tall * 0.75, x - width * 0.1, y - tall * 0.95);
  g.lineBetween(x + width * 0.2, y - tall * 0.75, x + width * 0.45, y - tall * 0.7);
}

// Scrub: a low, tufted cushion of grey-green twigs.
function drawScrub(g, x, y, width, tall, shade) {
  const leaf = SCRUB[Math.floor(shade * SCRUB.length)];
  g.fillStyle(lerpColor(leaf, 0x000000, 0.2));
  g.fillRect(x - width / 2, y - tall * 0.5, width, tall * 0.5 + 4);
  g.fillStyle(leaf);
  for (let i = 0; i < width; i += 2) {
    const h = Math.round(tall * (0.5 + 0.5 * Math.sin((i + shade * 9) * 0.9) ** 2));
    g.fillRect(x - width / 2 + i, y - h, 1, h);
  }
}

// Boulder: rounded rust-red rocks, lit on top, with a crack.
function drawBoulder(g, x, y, width, tall, shade) {
  const rock = BOULDER[Math.floor(shade * BOULDER.length)];
  g.fillStyle(BOULDER_DARK);
  g.fillEllipse(x, y - tall / 2 + 2, width, tall + 8);
  g.fillStyle(rock);
  g.fillEllipse(x - 1, y - tall / 2, width - 3, tall + 2);
  g.fillStyle(lerpColor(rock, 0xffffff, 0.2));
  g.fillRect(x - width * 0.25, y - tall + 1, width * 0.3, 2);
  g.fillStyle(BOULDER_DARK);
  g.fillRect(x + width * 0.1, y - tall * 0.6, 1, tall * 0.4);
  if (shade > 0.5) {
    g.fillStyle(rock);
    g.fillEllipse(x + width * 0.45, y - 2, width * 0.4, tall * 0.7);
  }
}

// A plinth of packed sand and stone below the ground line, so nothing floats on a dune's flank.
function footing(g, x, y, width, color) {
  g.fillStyle(color);
  g.fillRect(x - width / 2, y - 1, width, 14);
}

// The fuel station: a flat-roofed block with a shaded forecourt canopy on posts, one old pump, a
// tall pole sign, oil drums and a water tank on a stand.
function drawFuelStation(g, x, y) {
  footing(g, x, y, 70, 0x9a8470);
  // Shop block, right.
  const sx = x + 6;
  g.fillStyle(0xd8c8a8);
  g.fillRect(sx, y - 22, 26, 22);
  g.fillStyle(0xc4b292);
  g.fillRect(sx + 22, y - 22, 4, 22);
  g.fillStyle(0x8a7a62);
  g.fillRect(sx - 1, y - 24, 28, 2);
  g.fillStyle(0xa8c4cc);
  g.fillRect(sx + 3, y - 17, 7, 6);
  g.fillStyle(0x4a4038);
  g.fillRect(sx + 14, y - 15, 7, 15);
  g.fillStyle(0xd9c27a);
  g.fillRect(sx + 19, y - 8, 1, 1);
  // Canopy over the forecourt, left.
  g.fillStyle(0x6a6e70);
  g.fillRect(x - 32, y - 27, 40, 3);
  g.fillStyle(0xb8603e);
  g.fillRect(x - 32, y - 24, 40, 1);
  g.fillStyle(0x7a7e80);
  g.fillRect(x - 30, y - 24, 2, 24);
  g.fillRect(x - 2, y - 24, 2, 24);
  // The pump.
  g.fillStyle(0xb8603e);
  g.fillRect(x - 18, y - 11, 6, 11);
  g.fillStyle(0xe8e0cc);
  g.fillRect(x - 17, y - 9, 4, 3);
  g.fillStyle(0x3a3e42);
  g.fillRect(x - 12, y - 8, 2, 1);
  g.fillRect(x - 11, y - 8, 1, 5);
  // Oil drums.
  for (const [dx, c] of [[-26, 0x5a6a74], [-23, 0x8a5a3e]]) {
    g.fillStyle(c);
    g.fillRect(x + dx, y - 6, 3, 6);
    g.fillStyle(lerpColor(c, 0x000000, 0.25));
    g.fillRect(x + dx, y - 4, 3, 1);
  }
  // Water tank on a stand behind the shop.
  g.fillStyle(0x6a5a48);
  g.fillRect(sx + 28, y - 26, 1, 26);
  g.fillRect(sx + 34, y - 26, 1, 26);
  g.fillStyle(0x8a8e90);
  g.fillRect(sx + 27, y - 34, 9, 8);
  // Pole sign.
  g.fillStyle(0x5a5e60);
  g.fillRect(x - 38, y - 44, 1, 44);
  g.fillStyle(0xe8dcc0);
  g.fillRect(x - 46, y - 46, 16, 8);
  g.fillStyle(0xb8603e);
  g.fillRect(x - 45, y - 45, 14, 2);
}

// The sign's lamp flickers, a dying bulb out in the dunes.
function fuelFx(g, x, y, elapsed) {
  const on = Math.sin(elapsed * 7) + Math.sin(elapsed * 2.3) > -0.6;
  g.fillStyle(on ? 0xf0dca0 : 0x8a7a5a);
  g.fillRect(x - 44, y - 41, 2, 1);
  g.fillRect(x - 40, y - 41, 2, 1);
  g.fillRect(x - 36, y - 41, 2, 1);
}

// The nomad camp: three low black goat-hair tents with their fronts propped open on poles, rugs
// and cushions inside, a fire ringed with stones, a tea kettle and a pile of saddlebags.
function drawNomadCamp(g, x, y) {
  footing(g, x, y, 84, 0xb4805a);
  const tents = [[-26, 26, 15], [4, 30, 18], [32, 20, 12]];
  for (const [dx, w, h] of tents) {
    const left = x + dx - w / 2;
    g.fillStyle(0x2f2a26);
    g.fillRect(left, y - h + 3, w, h - 3);
    g.fillTriangle(left - 4, y - h + 6, left + w / 2, y - h - 1, left + w + 4, y - h + 6);
    g.fillStyle(0x3e3732);
    for (let sx = left; sx < left + w; sx += 4) g.fillRect(sx, y - h + 3, 1, h - 3);
    // The open front: a dark interior with a striped rug.
    g.fillStyle(0x1e1a18);
    g.fillRect(left + w / 2 - 5, y - h + 6, 10, h - 6);
    g.fillStyle(0xb8604a);
    g.fillRect(left + w / 2 - 5, y - 2, 10, 2);
    g.fillStyle(0xd9a83a);
    g.fillRect(left + w / 2 - 3, y - 2, 2, 1);
    g.fillRect(left + w / 2 + 2, y - 2, 2, 1);
    // Guy ropes and poles.
    g.lineStyle(1, 0x8a7a62);
    g.lineBetween(left - 4, y - h + 6, left - 8, y);
    g.lineBetween(left + w + 4, y - h + 6, left + w + 8, y);
    g.fillStyle(0x6a5440);
    g.fillRect(left + w / 2, y - h - 2, 1, 3);
  }
  // Fire ring, between the first two tents, and a kettle.
  g.fillStyle(0x6a6460);
  for (const dx of [-14, -12, -9, -7]) g.fillRect(x + dx, y - 2, 2, 2);
  g.fillStyle(0x3a2a20);
  g.fillRect(x - 12, y - 3, 4, 1);
  g.fillStyle(0x8a8a86);
  g.fillRect(x - 5, y - 4, 3, 3);
  g.fillRect(x - 6, y - 5, 1, 1);
  // Saddlebags.
  g.fillStyle(0x8a5a3e);
  g.fillRect(x + 18, y - 4, 6, 4);
  g.fillStyle(0xb8604a);
  g.fillRect(x + 19, y - 3, 4, 1);
}

// The fire flickers and smoke curls up and drifts downwind.
function campFx(g, x, y, elapsed) {
  const fx = x - 10;
  const flick = Math.sin(elapsed * 13) > 0 ? 1 : 0;
  g.fillStyle(0xe8823a);
  g.fillRect(fx - 1, y - 6 - flick, 3, 3 + flick);
  g.fillStyle(0xf2d27a);
  g.fillRect(fx, y - 5, 1, 2);
  for (let i = 0; i < 6; i++) {
    const t = (elapsed * 0.4 + i / 6) % 1;
    g.fillStyle(0xcfc8c0, 0.5 * (1 - t));
    g.fillRect(Math.round(fx + t * 12 + Math.sin(t * 9 + i) * 2), Math.round(y - 8 - t * 30), 2 + Math.round(t * 2), 2);
  }
}

// The Red Arch: one great wind-carved sandstone mass with a tall opening worn through it, leaving two
// thick, uneven legs under a span, banded in rust and ochre, with a fallen block at its foot. The
// tallest thing in the desert.
const ARCH_TOP = 122;
const OPENING = { half: 22, top: 100 };
function drawRedArch(g, x, y) {
  footing(g, x, y, 84, ARCH_DARK);
  for (let row = 0; row < ARCH_TOP; row++) {
    const t = row / ARCH_TOP;
    // The outer outline: a broad dome, a little lumpy, leaning slightly east.
    const outer = Math.round(42 * Math.sqrt(1 - t ** 5) + Math.sin(row * 0.35) * 1.5 + Math.sin(row * 0.11) * 2);
    if (outer <= 1) continue;
    const lean = Math.round(t * 4);
    const left = x - outer + lean;
    const right = x + outer + lean;
    const band = Math.floor(row / 9) % 3 === 1 ? ARCH_LIGHT : ARCH;
    const ry = y - 1 - row;
    // The opening: a tall rounded arch, narrower at the top.
    const inner = row < OPENING.top ? Math.round(OPENING.half * Math.sqrt(1 - (row / OPENING.top) ** 2.4)) : 0;
    if (inner > 0) {
      const ia = x - inner + lean;
      const ib = x + inner + lean;
      g.fillStyle(band);
      g.fillRect(left, ry, ia - left, 1);
      g.fillRect(ib, ry, right - ib, 1);
      g.fillStyle(ARCH_DARK);
      g.fillRect(ia - 3, ry, 3, 1);
      g.fillRect(right - 3, ry, 3, 1);
    } else {
      g.fillStyle(band);
      g.fillRect(left, ry, right - left, 1);
      g.fillStyle(ARCH_DARK);
      g.fillRect(right - 3, ry, 3, 1);
      if (row === OPENING.top || row === OPENING.top + 1) g.fillRect(x - 6 + lean, ry, 12, 1);
    }
  }
  // Sunlit crown and a few weathered pits.
  g.fillStyle(0xe0946a);
  g.fillRect(x - 24, y - ARCH_TOP + 2, 30, 2);
  g.fillStyle(ARCH_DARK);
  for (const [dx, dy] of [[-34, 30], [-30, 62], [32, 44], [28, 80], [-12, 108], [14, 112]]) g.fillRect(x + dx, y - dy, 2, 2);
  // Talus at the foot.
  g.fillStyle(ARCH_DARK);
  g.fillRect(x - 46, y - 5, 92, 5);
  g.fillStyle(ARCH);
  g.fillRect(x - 46, y - 6, 18, 2);
  g.fillRect(x + 30, y - 6, 16, 2);
  // A fallen block and a few stones.
  g.fillStyle(ARCH);
  g.fillRect(x - 6, y - 7, 10, 7);
  g.fillStyle(ARCH_LIGHT);
  g.fillRect(x - 6, y - 7, 10, 1);
  g.fillStyle(ARCH_DARK);
  g.fillRect(x + 8, y - 3, 3, 3);
  g.fillRect(x - 12, y - 2, 2, 2);
}

// The wrecked plane: an old silver-grey prop plane nosed into the sand, one wing snapped and lying
// beside it, the tail fin up, peeling paint and a bent propeller.
function drawPlaneWreck(g, x, y) {
  footing(g, x, y, 80, 0xb4805a);
  const metal = 0x9aa0a0;
  const dark = 0x6a7070;
  // Fuselage, tilted nose-down to the left, half sunk.
  for (let i = 0; i < 56; i++) {
    const fx = x - 30 + i;
    const sink = Math.round((56 - i) * 0.12);
    const h = i < 6 ? 6 : i > 46 ? Math.max(3, 9 - (i - 46)) : 9;
    g.fillStyle(metal);
    g.fillRect(fx, y - h - 2 + sink, 1, h);
    g.fillStyle(dark);
    g.fillRect(fx, y - 3 + sink, 1, 1);
  }
  // Windows, a rust streak and the faded roundel.
  g.fillStyle(0x3a4044);
  for (let wx = x - 18; wx < x + 10; wx += 5) g.fillRect(wx, y - 9, 2, 2);
  g.fillStyle(0x9a5a3a);
  g.fillRect(x + 2, y - 6, 8, 1);
  g.fillRect(x - 10, y - 4, 4, 1);
  g.fillStyle(0xb8604a);
  g.fillCircle(x + 14, y - 7, 2);
  // Tail fin and stabiliser.
  g.fillStyle(metal);
  g.fillTriangle(x + 20, y - 10, x + 28, y - 24, x + 27, y - 10);
  g.fillRect(x + 18, y - 9, 12, 2);
  g.fillStyle(dark);
  g.fillRect(x + 26, y - 22, 1, 12);
  // Upper wing still on, lower one snapped and lying on the sand.
  g.fillStyle(0x8a9090);
  g.fillRect(x - 14, y - 13, 26, 2);
  g.fillStyle(dark);
  g.fillRect(x - 14, y - 11, 26, 1);
  g.fillStyle(0x8a9090);
  g.fillRect(x - 46, y - 3, 16, 3);
  g.fillTriangle(x - 46, y - 3, x - 48, y, x - 46, y);
  // Bent propeller at the buried nose.
  g.lineStyle(1, 0x4a4a46);
  g.lineBetween(x - 31, y - 6, x - 34, y - 14);
  g.lineBetween(x - 31, y - 4, x - 28, y + 2);
}

// The ruins: a half-buried colonnade of sandstone columns, two still carrying a lintel, others
// broken off at different heights, fallen drums in the sand, and a carved block with a face.
const RUIN = 0xd4b282;
const RUIN_SHADE = 0xb8946a;
function column(g, x, y, height) {
  g.fillStyle(RUIN);
  g.fillRect(x - 3, y - height, 7, height);
  g.fillStyle(RUIN_SHADE);
  for (let fx = x - 2; fx < x + 4; fx += 2) g.fillRect(fx, y - height, 1, height);
  g.fillStyle(RUIN);
  g.fillRect(x - 4, y - 3, 9, 3);
}
function drawRuins(g, x, y) {
  footing(g, x, y, 72, RUIN_SHADE);
  // A stepped platform, mostly drifted over.
  g.fillStyle(RUIN_SHADE);
  g.fillRect(x - 34, y - 4, 68, 4);
  // The standing pair with the lintel.
  column(g, x - 22, y - 4, 40);
  column(g, x - 6, y - 4, 40);
  g.fillStyle(RUIN);
  g.fillRect(x - 28, y - 50, 28, 6);
  g.fillStyle(RUIN_SHADE);
  g.fillRect(x - 28, y - 45, 28, 1);
  for (let lx = x - 26; lx < x; lx += 4) g.fillRect(lx, y - 49, 2, 2);
  g.fillStyle(RUIN);
  g.fillRect(x - 25, y - 52, 22, 2);
  // Broken columns.
  column(g, x + 10, y - 4, 26);
  g.fillStyle(RUIN_SHADE);
  g.fillTriangle(x + 7, y - 30, x + 14, y - 34, x + 14, y - 30);
  column(g, x + 24, y - 4, 14);
  // Fallen drums and the carved block.
  g.fillStyle(RUIN);
  g.fillRect(x + 28, y - 6, 9, 6);
  g.fillStyle(RUIN_SHADE);
  g.fillRect(x + 28, y - 6, 1, 6);
  g.fillRect(x + 32, y - 6, 1, 6);
  g.fillStyle(RUIN);
  g.fillRect(x - 38, y - 9, 10, 9);
  g.fillStyle(RUIN_SHADE);
  g.fillRect(x - 36, y - 7, 2, 1);
  g.fillRect(x - 32, y - 7, 2, 1);
  g.fillRect(x - 34, y - 4, 2, 2);
  // Sand drifted against the bases.
  g.fillStyle(0xd8a070);
  g.fillTriangle(x - 34, y, x - 18, y - 8, x - 4, y);
  g.fillTriangle(x + 6, y, x + 16, y - 5, x + 30, y);
}

// Small scenery on the sand: [x, kind]. A skull, tumbleweed caught on scrub, a signpost.
export const DUNE_PROPS = Object.freeze([
  [27560, 'signpost'], [28420, 'skull'], [29230, 'skull'], [29960, 'signpost'], [30260, 'skull'],
].map(([x, kind]) => ({ x, kind })));

function drawProp(g, prop, x, y) {
  if (prop.kind === 'skull') {
    g.fillStyle(0xe8e0cc);
    g.fillRect(x - 3, y - 3, 6, 3);
    g.fillRect(x + 3, y - 2, 2, 2);
    g.fillStyle(0x6a5a48);
    g.fillRect(x - 1, y - 2, 1, 1);
    g.lineStyle(1, 0xe8e0cc);
    g.lineBetween(x - 3, y - 3, x - 7, y - 7);
    g.lineBetween(x - 2, y - 3, x + 1, y - 8);
  } else {
    g.fillStyle(0x6a5a48);
    g.fillRect(x, y - 16, 1, 16);
    g.fillStyle(0xd8c8a8);
    g.fillRect(x - 8, y - 16, 9, 3);
    g.fillRect(x + 1, y - 12, 9, 3);
    g.fillStyle(0x8a6a4c);
    g.fillRect(x - 7, y - 15, 6, 1);
    g.fillRect(x + 2, y - 11, 6, 1);
  }
}

// Dune crests where the wind lifts sand off in a streaming plume.
const CRESTS = [27700, 28370, 29060, 29760];
function drawSandPlumes(g, left, right, seaY, shift, elapsed) {
  for (const cx of CRESTS) {
    const x = cx + shift;
    if (x < left - 80 || x > right + 20) continue;
    const top = dunesBase(cx, seaY) - SEA_Y_OFFSET;
    for (let i = 0; i < 14; i++) {
      const t = (elapsed * 0.35 + i / 14) % 1;
      g.fillStyle(0xe8c8a0, 0.45 * (1 - t));
      g.fillRect(Math.round(x + t * 60), Math.round(top - 2 - t * 10 - Math.sin(t * 6 + i) * 2), 2, 1);
    }
  }
}

// Street first, then landmarks, matching the city's order.
export const RED_DUNES_BUILDINGS = Object.freeze([
  ...desertFlora(),
  ...RED_DUNES_LANDMARKS.map((landmark, i) => ({ maxHealth: 240, seed: 420 + i, ...landmark })),
]);

// buildings: false leaves flora and landmarks to a mode that draws them itself (evil mode).
export function drawRedDunes(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((RED_DUNES.from + RED_DUNES.to) / 2, cameraX);
  const half = (RED_DUNES.to - RED_DUNES.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawMesas(g, left, right, seaY, cameraX);
  drawDuneRow(g, left, right, seaY, cameraX);
  const shift = mid - (RED_DUNES.from + RED_DUNES.to) / 2;
  if (buildings) {
    for (const building of RED_DUNES_BUILDINGS) {
      const at = nearest(building.x, cameraX);
      if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
      const y = dunesBase(building.x, seaY);
      building.draw(g, at, y, elapsed);
      building.fx?.(g, at, y, elapsed);
    }
  }
  for (const prop of DUNE_PROPS) {
    const at = prop.x + shift;
    if (at < left - 20 || at > right + 20) continue;
    drawProp(g, prop, at, dunesBase(prop.x, seaY) - SEA_Y_OFFSET + 1);
  }
  drawSandPlumes(g, left, right, seaY, shift, elapsed);
}

// Each copy of a parallax row pivots on the desert's centre, clipped to the desert.
function eachColumn(left, right, cameraX, parallax, draw) {
  const shift = (cameraX - nearest((RED_DUNES.from + RED_DUNES.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, RED_DUNES.from, RED_DUNES.to);
    if (fade <= 0) continue;
    draw(x, Math.round(wx / SKYLINE_STEP), ground, fade);
  }
}

// Far row: flat-topped mesas and buttes in a pale haze, no detail. They stand on a level horizon,
// not on the dunes, so they read as far away.
function drawMesas(g, left, right, seaY, cameraX) {
  const horizon = seaY - 20;
  eachColumn(left, right, cameraX, FAR_PARALLAX, (x, seed, ground, fade) => {
    const roll = hash(seed + 0.31);
    const run = hash(Math.floor(seed / 5) + 0.77);
    if (run < 0.5) return;
    // A mesa is a run of columns: flat on top, with a stepped shoulder at each end.
    const edge = hash(Math.floor((seed + 1) / 5) + 0.77) < 0.5 || hash(Math.floor((seed - 1) / 5) + 0.77) < 0.5;
    const h = Math.round((16 + run * 30) * CITY_SCALE * (edge ? 0.6 : 1));
    g.fillStyle(0xe6cdb4, fade);
    g.fillRect(x, horizon - h, SKYLINE_STEP, h);
    if (roll < 0.12 && !edge) g.fillRect(x + 10, horizon - h - Math.round(12 * CITY_SCALE), 8, Math.round(12 * CITY_SCALE));
  });
}

// Near row: soft dune humps, one shade deeper, following the ground loosely.
function drawDuneRow(g, left, right, seaY, cameraX) {
  eachColumn(left, right, cameraX, NEAR_PARALLAX, (x, seed, ground, fade) => {
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const h = Math.round((18 + 14 * Math.sin(seed * 0.45) + 8 * Math.sin(seed * 1.3)) * CITY_SCALE);
    if (h <= 4) return;
    g.fillStyle(0xd8b08e, fade);
    g.fillRect(x, y - h, SKYLINE_STEP, h);
    g.fillRect(x + 6, y - h - 4, SKYLINE_STEP - 12, 4);
  });
}
