import { CIRCUMFERENCE, elevation, groundColors, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';
import { sunlandDeckRise } from './sunland-art.js';
import { frostlandDeckRise } from './frostland-art.js';

// Rivertown, an old canal town built to the same rules as Green City
// (game-design-rules/city-design-rules.md). Two flat parallax rows of rooftops and chimneys sit behind
// a destructible street of terraced houses, corner shops and riverside warehouses, all in one muted
// soot-brick-and-slate theme. The landmarks have their own palettes and detail: the Old Bridge over the
// river (golden sandstone, three arches, lamps on the parapet), the Water Mill with its turning wheel,
// the Dockside Crane on the east quay with a swaying crate, the Market Hall's open arcade under a
// verdigris cupola, and Rivertown Minster, the signature, whose spire tops everything in town.
// Everything that can break is listed once in RIVERTOWN_BUILDINGS, so evil mode can promote it.
export const RIVERTOWN = { from: 10220, to: 11780 };
// The river channel (planet.js dips the terrain here); the street never builds in it.
export const RIVER = { from: 10900, to: 11100 };
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 34;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
// Over the last TOWN_EDGE px the street thins and drops, so the town never ends as a wall.
const TOWN_EDGE = 220;
// Warehouses crowd the quays: within this distance of the river most slots are warehouses.
const QUAY_REACH = 260;

// The street theme: soot-dulled brick under slate, cream sills, dark green doors.
const BRICK = [0x9a7f74, 0x92786e, 0xa0857a];
const BRICK_DARK = 0x7d665d;
const SLATE = 0x646a72;
const SLATE_DARK = 0x535860;
const SILL = 0xcfc5b2;
const GLASS = 0xd5e8ee;
const DOOR = 0x3f5a4c;
const AWNING = 0x5d6f7a;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building, where building-destruction.js bakes it too. Over the river that is
// the water surface, so the bridge's piers stand in the water and its deck meets the banks.
export function rivertownBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the street leaves free. width/height: hit box once promoted.
// fx draws animated parts (wheel, crate, lamps) in free roam only; a promoted building bakes still.
const LANDMARK_ART = [
  { id: 'rivertown-minster', x: 10490, door: true, draw: drawMinster, clear: 58, width: 104, height: 300, maxHealth: 360 },
  { id: 'water-mill', x: 10820, door: true, draw: drawWaterMill, fx: millWheelFx, clear: 58, width: 104, height: 92 },
  { id: 'old-bridge', x: 11000, open: true, draw: drawBridge, fx: bridgeLampFx, clear: 96, width: 190, height: 44, maxHealth: 320 },
  { id: 'dockside-crane', x: 11150, draw: drawCrane, fx: craneCrateFx, clear: 34, width: 70, height: 128 },
  { id: 'market-hall', x: 11520, door: true, draw: drawMarketHall, clear: 78, width: 144, height: 150 },
];
export const RIVERTOWN_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// The Old Bridge's deck: its span and its rise above sea level (level with the banks at both ends).
// Like an old stone bridge, the deck humps gently over the river: it climbs HUMP px to the crown over
// the HUMP_REACH px either side of the middle, on a cosine, so cars roll on and off without a kink.
// Traffic and walkers cross the river on it instead of following the terrain down into the channel.
const BRIDGE = RIVERTOWN_LANDMARKS.find(l => l.id === 'old-bridge');
const HUMP = 8;
const HUMP_REACH = 120;
export const BRIDGE_DECK = Object.freeze({
  id: BRIDGE.id, x: BRIDGE.x, from: BRIDGE.x - BRIDGE.width / 2, to: BRIDGE.x + BRIDGE.width / 2,
  rise: 15 * CITY_SCALE - SEA_Y_OFFSET, crown: 15 * CITY_SCALE - SEA_Y_OFFSET + HUMP,
});

// How far the deck stands above the banks at dx world px from the middle of the bridge.
function humpAt(dx) {
  const u = Math.abs(dx) / HUMP_REACH;
  return u >= 1 ? 0 : HUMP * (0.5 + 0.5 * Math.cos(Math.PI * u));
}

// The deck's rise above sea level at x, or null off the bridge.
export function deckRise(x) {
  const at = wrapX(x);
  if (at <= BRIDGE_DECK.from || at >= BRIDGE_DECK.to) return null;
  return BRIDGE_DECK.rise + humpAt(at - BRIDGE.x);
}

// Height of the street surface at x: the terrain, or the bridge deck where it spans water/obstacles.
export function streetRise(x, deckUp = null) {
  const rise = elevation(x);
  const deck = deckRise(x);
  if (deck !== null && (!deckUp || deckUp(BRIDGE_DECK.id))) return Math.max(rise, deck);
  const sunlandDeck = sunlandDeckRise(x, deckUp);
  if (sunlandDeck !== null) return Math.max(rise, sunlandDeck);
  const frostlandDeck = frostlandDeckRise(x, deckUp);
  if (frostlandDeck !== null) return Math.max(rise, frostlandDeck);
  return rise;
}

function landmarkGap(x, width) {
  return Math.min(...RIVERTOWN_LANDMARKS.map(l => Math.abs(x - l.x) - l.clear - width / 2));
}

// Free stretches of street: the town minus each landmark's clear space and the river.
function streetSpans() {
  const cuts = [...RIVERTOWN_LANDMARKS.map(l => [l.x - l.clear, l.x + l.clear]), [RIVER.from - 10, RIVER.to + 10]]
    .sort((a, b) => a[0] - b[0]);
  const spans = [];
  let start = RIVERTOWN.from;
  for (const [a, b] of [...cuts, [RIVERTOWN.to, RIVERTOWN.to]]) {
    if (a - start > 30) spans.push([start, a]);
    start = Math.max(start, b);
  }
  return spans;
}

// Street: terraced houses (kind 0), corner shops (1) and, near the river, tall warehouses (2), packed
// along each free span like a terrace, with the odd empty lot. Fewer stand toward the town's ends.
function streetBuildings() {
  const buildings = [];
  let i = 0;
  for (const [from, to] of streetSpans()) {
    for (let bx = from + 6; ; i++) {
      const seed = i + 0.61;
      const art = 30 + Math.round(hash(seed + 0.2) * 12);
      const width = art * CITY_SCALE;
      const centre = bx + width / 2;
      if (bx + width > to - 6) break;
      bx += width + 3 + Math.round(hash(seed + 0.5) * 6);
      const taper = Math.min(1, Math.min(centre - RIVERTOWN.from, RIVERTOWN.to - centre) / TOWN_EDGE);
      if (hash(seed) < 0.08 + 0.3 * (1 - taper) || landmarkGap(centre, width) < 6) continue;
      const quay = Math.min(Math.abs(centre - RIVER.from), Math.abs(centre - RIVER.to)) < QUAY_REACH;
      const kind = quay && taper === 1 && hash(seed + 0.7) < 0.6 ? 2 : hash(seed + 0.1) < 0.7 ? 0 : 1;
      const full = [44, 30, 70][kind] + Math.round(hash(seed + 0.3) * [22, 12, 26][kind]);
      const height = Math.max(26, Math.round(full * (0.45 + 0.55 * taper)));
      const brick = BRICK[Math.floor(hash(seed + 0.4) * BRICK.length)];
      const roll = hash(seed + 0.6);
      buildings.push({
        id: `rivertown-${i}`, seed, kind: ['terrace', 'shop', 'warehouse'][kind],
        x: centre, width, height: (height + 12) * CITY_SCALE, roof: (height + 2) * CITY_SCALE,
        maxHealth: kind === 2 ? 170 : 120, door: true,
        draw: scaled((g, at, y) => drawStreetBuilding(g, at - art / 2, y, art, height, kind, brick, roll)),
      });
    }
  }
  return buildings;
}

// Parapet and chimney stacks with clay pots: the roofline is flat behind the parapet, so pigeons perch.
function drawChimneys(g, x, top, width, roll) {
  g.fillStyle(BRICK_DARK);
  g.fillRect(x - 1, top - 2, width + 2, 3);
  const stacks = width > 38 ? [0.2, 0.75] : [roll > 0.5 ? 0.25 : 0.7];
  for (const at of stacks) {
    const cx = Math.round(x + width * at);
    g.fillStyle(BRICK_DARK);
    g.fillRect(cx - 4, top - 10, 8, 9);
    g.fillStyle(0xa86f52);
    g.fillRect(cx - 3, top - 13, 2, 3);
    g.fillRect(cx + 1, top - 13, 2, 3);
  }
}

function drawStreetBuilding(g, x, y, width, height, kind, brick, roll) {
  const top = y - height;
  g.fillStyle(brick);
  g.fillRect(x, top, width, height);
  g.fillStyle(lerpColor(brick, 0x000000, 0.1));
  g.fillRect(x + width - 4, top, 4, height);
  // A string course of darker brick between the storeys.
  g.fillStyle(lerpColor(brick, 0x000000, 0.06));
  for (let sy = y - 22; sy > top + 8; sy -= 16) g.fillRect(x, sy, width, 1);

  const door = Math.round(x + width / 2);
  if (kind === 2) {
    // Warehouse: arched windows in bays, a loading door stack with a hoist beam, a painted sign band.
    for (let wy = top + 8; wy < y - 20; wy += 14) {
      for (let wx = x + 4; wx < x + width - 8; wx += 8) {
        if (Math.abs(wx + 2 - door) < 6) continue;
        g.fillStyle(SILL);
        g.fillRect(wx - 1, wy + 7, 6, 1);
        g.fillStyle(GLASS);
        g.fillRect(wx, wy + 1, 4, 6);
        g.fillCircle(wx + 2, wy + 1, 2);
      }
    }
    g.fillStyle(lerpColor(brick, 0x000000, 0.25));
    for (let wy = top + 8; wy < y - 26; wy += 14) g.fillRect(door - 4, wy, 8, 10);
    g.fillStyle(SLATE_DARK);
    g.fillRect(door - 1, top - 6, 2, 8);
    g.fillRect(door - 1, top - 6, 8, 2);
    g.fillRect(door + 6, top - 4, 1, 6);
    g.fillStyle(SILL);
    g.fillRect(x + 3, top + 2, width - 8, 3);
  } else if (kind === 1) {
    // Corner shop: a glass front under a slate-blue awning, sash windows above.
    g.fillStyle(SILL);
    g.fillRect(x + 2, y - 16, width - 6, 16);
    g.fillStyle(GLASS);
    g.fillRect(x + 4, y - 14, width - 10, 9);
    g.fillStyle(AWNING);
    g.fillRect(x + 1, y - 20, width - 4, 4);
    g.fillStyle(lerpColor(AWNING, 0xffffff, 0.25));
    for (let ax = x + 2; ax < x + width - 4; ax += 6) g.fillRect(ax, y - 20, 3, 4);
    for (let wy = top + 6; wy < y - 26; wy += 12) {
      for (let wx = x + 5; wx < x + width - 9; wx += 9) {
        g.fillStyle(SILL);
        g.fillRect(wx - 1, wy + 7, 6, 1);
        g.fillStyle(GLASS);
        g.fillRect(wx, wy, 4, 7);
      }
    }
  } else {
    // Terraced houses: sash windows with cream sills, some with a window box.
    for (let wy = top + 6, row = 0; wy < y - 18; wy += 12, row++) {
      for (let wx = x + 5; wx < x + width - 9; wx += 8) {
        g.fillStyle(SILL);
        g.fillRect(wx - 1, wy + 7, 6, 1);
        g.fillStyle(hash(wx * 0.29 + wy) > 0.85 ? 0xb4cbd4 : GLASS);
        g.fillRect(wx, wy, 4, 7);
        g.fillStyle(lerpColor(GLASS, 0x000000, 0.2));
        g.fillRect(wx, wy + 3, 4, 1);
      }
      if (hash(roll * 10 + row) > 0.6) {
        g.fillStyle(0x6b8a5a);
        g.fillRect(x + 4, wy + 8, width - 12, 2);
      }
    }
  }
  drawChimneys(g, x, top, width - 4, roll);
  // Every street building has a centred door people walk in and out of, under a cream lintel.
  g.fillStyle(SILL);
  g.fillRect(door - 5, y - 15, 10, 2);
  g.fillStyle(kind === 2 ? lerpColor(brick, 0x000000, 0.35) : DOOR);
  g.fillRect(door - 4, y - 13, 8, 13);
  g.fillStyle(0xd9c27a);
  g.fillRect(door + 2, y - 7, 1, 1);
}

// Old Bridge: three golden sandstone arches springing from the river between the quay walls, its
// deck humped gently over the water and level with the banks at both ends (BRIDGE_DECK). The street's
// road surface runs on across it, under a cornice; the far parapet stands behind the traffic, with
// refuges over the piers and ironwork lamps. Drawn column by column so it follows the hump. Art px
// here: the water is about 2 px above y, the banks 15 px above it.
const STONE = 0xc9a86e;
const STONE_LIGHT = 0xdcc08a;
const STONE_DARK = 0xa88a56;
const STONE_SHADE = 0xb8975f;
const ARCH_SHADOW = 0x3f4c52;
const ARCH_SOFFIT = 0x56656a;
const LAMP_IRON = 0x3c4a48;
const BRIDGE_HALF = 95;
const SPRING = 3;
// The three arches: [centre, half span, rise above the springing line]. The side arches spring from
// the quay walls, the middle one is widest and tallest, under the crown of the hump.
const ARCHES = [[-39.5, 16.5, 9], [0, 15, 11], [39.5, 16.5, 9]];
const PIERS = [-19, 19];
const LAMPS = [-62, 0, 62];
let bridgeRoad = null;

// Deck top at art dx from the middle, relative to y (negative is up).
function deckTop(dx) {
  return -15 - humpAt(dx * CITY_SCALE) / CITY_SCALE;
}

// Top of the arch opening at dx, relative to y, or null where there is no opening.
function archTop(dx) {
  for (const [c, half, rise] of ARCHES) {
    const u = (dx - c) / half;
    if (Math.abs(u) < 1) return -SPRING - rise * Math.sqrt(1 - u * u);
  }
  return null;
}

// [dx, width, deck top, arch top or null] runs across the bridge; the deck is kept to half an art px
// (0.7 world px) so the road stays under the wheels, the arches to whole pixels.
let bridgeRuns = null;
function bridgeColumns() {
  const runs = [];
  for (let dx = -BRIDGE_HALF; dx < BRIDGE_HALF; dx++) {
    const deck = Math.round(deckTop(dx + 0.5) * 2) / 2;
    const raw = archTop(dx + 0.5);
    const arch = raw === null ? null : Math.round(raw);
    const last = runs[runs.length - 1];
    if (last && last[2] === deck && last[3] === arch) last[1]++;
    else runs.push([dx, 1, deck, arch]);
  }
  return runs;
}

function drawBridge(g, x, y) {
  // The road colour is the street's own, so the road reads as one surface across the river.
  bridgeRoad ??= groundColors(RIVER.from - 60).ground;
  // Columns are merged into runs that share the same deck and arch heights (to the pixel), so the
  // hump costs a few dozen rects rather than one stack per column.
  bridgeRuns ??= bridgeColumns();
  for (const [dx, w, deck, arch] of bridgeRuns) {
    const top = y + deck;
    const col = x + dx;
    // Far parapet behind the traffic, coped with a light capstone.
    g.fillStyle(STONE_SHADE);
    g.fillRect(col, top - 5, w, 5);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(col, top - 6, w, 1);
    // Spandrel wall down into the river, under the road surface and cornice.
    g.fillStyle(STONE);
    g.fillRect(col, top, w, y + 12 - top);
    g.fillStyle(bridgeRoad[0]);
    g.fillRect(col, top, w, 2);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(col, top + 2, w, 1);
    g.fillStyle(STONE_DARK);
    g.fillRect(col, top + 3, w, 1);
    // Arch opening: a light voussoir ring round a shadowed span with a lit soffit just inside it.
    // The water (drawn over the bridge) hides everything below the springing line.
    if (arch === null) continue;
    const open = y + arch;
    g.fillStyle(STONE_LIGHT);
    g.fillRect(col, open - 2, w, 2);
    g.fillStyle(ARCH_SOFFIT);
    g.fillRect(col, open, w, 1);
    g.fillStyle(ARCH_SHADOW);
    g.fillRect(col, open + 1, w, y + 12 - open - 1);
  }
  // Masonry courses on the spandrels and abutments, clear of the arches.
  g.fillStyle(STONE_SHADE);
  for (let row = 0; row < 3; row++) {
    const cy = y - 6 - row * 3;
    for (let dx = -BRIDGE_HALF + 2 + row * 3; dx < BRIDGE_HALF - 4; dx += 9) {
      const arch = archTop(dx + 2);
      if (arch !== null && cy > y + arch - 3) continue;
      if (cy < y + deckTop(dx) + 5) continue;
      g.fillRect(x + dx, cy, 4, 1);
    }
  }
  // Keystones at the crowns.
  for (const [c, , rise] of ARCHES) {
    const crown = Math.round(y - SPRING - rise);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + c - 1.5, crown - 3, 3, 3);
    g.fillStyle(STONE_DARK);
    g.fillRect(x + c + 1, crown - 3, 0.5, 3);
  }
  // Piers: shaded on the downstream face, with pointed cutwaters standing in the current.
  for (const p of PIERS) {
    g.fillStyle(STONE_DARK);
    g.fillRect(x + p + 2, y - 6, 1, 8);
    g.fillStyle(STONE);
    g.fillRect(x + p - 5, y - 4, 10, 6);
    g.fillTriangle(x + p - 5, y - 4, x + p, y - 9, x + p + 5, y - 4);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + p - 5, y - 4, 10, 1);
    g.fillStyle(STONE_DARK);
    g.fillRect(x + p + 3, y - 4, 2, 6);
    // Refuge over the pier: the parapet steps up.
    const top = Math.round(y + deckTop(p));
    g.fillStyle(STONE_SHADE);
    g.fillRect(x + p - 5, top - 8, 10, 3);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + p - 6, top - 9, 12, 1);
  }
  // End piers where the parapet meets the banks.
  for (const e of [-BRIDGE_HALF, BRIDGE_HALF - 5]) {
    const top = Math.round(y + deckTop(e));
    g.fillStyle(STONE_SHADE);
    g.fillRect(x + e, top - 9, 5, 9);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + e - 1, top - 10, 7, 1);
  }
  // Lamp posts on the parapet, following the hump.
  for (const dx of LAMPS) {
    const top = Math.round(y + deckTop(dx)) - 6;
    g.fillStyle(LAMP_IRON);
    g.fillRect(x + dx - 1, top - 14, 2, 14);
    g.fillRect(x + dx - 2, top - 1, 4, 1);
    g.fillRect(x + dx - 3, top - 16, 6, 2);
    g.fillStyle(0xe8d9a0);
    g.fillRect(x + dx - 2, top - 20, 4, 4);
    g.fillStyle(LAMP_IRON);
    g.fillRect(x + dx - 3, top - 21, 6, 1);
  }
}

function bridgeLampFx(g, x, y, elapsed) {
  for (const dx of LAMPS) {
    const top = Math.round(y + deckTop(dx)) - 6;
    g.fillStyle(0xfff2b0, 0.18 + 0.06 * Math.sin(elapsed * 3 + dx));
    g.fillCircle(x + dx, top - 18, 5);
  }
}

// Water Mill: a stone base with a weatherboarded upper floor under a red-tile roof, a lucam (the hoist
// housing) jutting from the gable, and an undershot wheel on the river side.
function drawWaterMill(g, x, y) {
  g.fillStyle(0xb7aa92);
  g.fillRect(x - 40, y - 34, 72, 34);
  g.fillStyle(0xa4977f);
  g.fillRect(x + 26, y - 34, 6, 34);
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 40, y - 64, 72, 30);
  g.fillStyle(0x7a5c3f);
  for (let by = y - 62; by < y - 34; by += 4) g.fillRect(x - 40, by, 72, 1);
  // Clay-tile roof.
  g.fillStyle(0xb5664a);
  g.fillTriangle(x - 44, y - 64, x - 4, y - 88, x + 36, y - 64);
  g.fillStyle(0x9a5540);
  g.fillRect(x - 44, y - 65, 80, 2);
  // Lucam.
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 12, y - 76, 16, 14);
  g.fillStyle(0xb5664a);
  g.fillTriangle(x - 14, y - 76, x - 4, y - 84, x + 6, y - 76);
  g.fillStyle(0x4a3a2c);
  g.fillRect(x - 8, y - 72, 8, 8);
  // Windows and the door.
  g.fillStyle(GLASS);
  for (const wx of [-32, -20, 10, 20]) g.fillRect(x + wx, y - 56, 5, 7);
  for (const wx of [-30, 14]) g.fillRect(x + wx, y - 26, 6, 8);
  g.fillStyle(0x5a4636);
  g.fillRect(x - 9, y - 16, 10, 16);
  g.fillStyle(0xd9c27a);
  g.fillRect(x - 2, y - 8, 1, 1);
  // Wheel axle housing on the river side; the wheel itself is drawn by millWheelFx in free roam,
  // and here as a still wheel so a promoted mill keeps it.
  millWheel(g, x + 40, y - 18, 0);
}

function millWheel(g, cx, cy, angle) {
  g.fillStyle(0x5e4632);
  g.fillCircle(cx, cy, 17);
  g.fillStyle(0x4a3826);
  g.fillCircle(cx, cy, 13);
  g.lineStyle(2, 0x6e5440);
  for (let i = 0; i < 8; i++) {
    const a = angle + i * Math.PI / 4;
    g.lineBetween(cx, cy, cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
  }
  g.fillStyle(0x6e5440);
  for (let i = 0; i < 12; i++) {
    const a = angle + i * Math.PI / 6;
    g.fillRect(cx + Math.cos(a) * 16 - 2, cy + Math.sin(a) * 16 - 2, 4, 4);
  }
  g.fillStyle(0x3c4a48);
  g.fillCircle(cx, cy, 3);
}

function millWheelFx(g, x, y, elapsed) {
  millWheel(g, x + 40, y - 18, elapsed * 0.8);
  // Spray where the paddles dip.
  g.fillStyle(0xe6f7ff, 0.8);
  for (let i = 0; i < 4; i++) {
    const t = (elapsed * 1.4 + i / 4) % 1;
    g.fillRect(x + 52 + t * 8, y - 4 - 6 * t + 8 * t * t, 2, 2);
  }
}

// Dockside Crane: a riveted teal-painted iron crane on the east quay, its jib reaching over the water.
const IRON = 0x3f7a78;
const IRON_DARK = 0x2f5e5c;
function drawCrane(g, x, y) {
  // Plinth.
  g.fillStyle(0xb9b0a0);
  g.fillRect(x - 14, y - 8, 28, 8);
  // Post with its cab.
  g.fillStyle(IRON);
  g.fillRect(x - 4, y - 92, 8, 84);
  g.fillStyle(IRON_DARK);
  g.fillRect(x + 2, y - 92, 2, 84);
  g.fillStyle(IRON);
  g.fillRect(x - 10, y - 46, 20, 16);
  g.fillStyle(GLASS);
  g.fillRect(x - 7, y - 43, 6, 6);
  // Jib: a solid web reaching left over the river, braced with a darker lattice. Solid, so it stays in
  // one piece with the post once promoted (thin diagonal lines alone fall apart in the break grid).
  g.fillStyle(IRON);
  g.fillTriangle(x + 1, y - 93, x + 1, y - 77, x - 48, y - 119);
  g.lineStyle(1, IRON_DARK);
  for (let s = 1; s < 5; s++) {
    const t = s / 5;
    g.lineBetween(x - 48 * t, y - 92 - 26 * t, x - 48 * t, y - 78 - 40 * t);
  }
  // Counterweight and the gold maker's band.
  g.fillStyle(0x4a4f52);
  g.fillRect(x + 4, y - 98, 12, 10);
  g.fillStyle(0xd9b56a);
  g.fillRect(x - 5, y - 60, 10, 2);
  // The hanging crate is free-roam only (craneCrateFx): on a one-cell rope it would drop the moment the
  // crane is promoted and crush the bridge below.
}

function craneCrate(g, x, y, sway) {
  const hx = x - 48;
  const hy = y - 118;
  const cx = hx + sway;
  g.lineStyle(1, 0x2a2f30);
  g.lineBetween(hx, hy, cx, y - 66);
  g.fillStyle(0x9a7a52);
  g.fillRect(cx - 7, y - 66, 14, 11);
  g.fillStyle(0x7d6040);
  g.fillRect(cx - 7, y - 61, 14, 1);
  g.fillRect(cx - 1, y - 66, 2, 11);
}

function craneCrateFx(g, x, y, elapsed) {
  craneCrate(g, x, y, Math.sin(elapsed * 1.3) * 3);
}

// Market Hall: a rusticated arcade of five stone arches with keystones and pilasters (market stalls in
// four, the open door in the middle), a brick upper storey with arched sash windows and a balcony, a
// dentilled cornice with balustrades and urns, a pediment with a gilt fish, and behind it a clock tower
// with a belfry, a verdigris dome and a fish weathervane. The door is the arcade's middle bay.
const HALL_STONE = 0xe2d6bc;
const HALL_STONE_LIGHT = 0xefe6d2;
const HALL_STONE_SHADE = 0xd2c5a8;
const HALL_BRICK = 0xb05a42;
const HALL_GOLD = 0xd9b56a;
const HALL_DARK = 0x4a4038;
const HALL_VERDIGRIS = 0x5e9a86;
function drawMarketHall(g, x, y, elapsed = 0) {
  const bays = [-52, -26, 0, 26, 52];

  // Clock tower, behind the pediment: shaft with quoins, clock, belfry, dome, finial and vane.
  g.fillStyle(HALL_STONE);
  g.fillRect(x - 12, y - 112, 24, 26);
  g.fillStyle(HALL_STONE_SHADE);
  g.fillRect(x + 8, y - 112, 4, 26);
  g.fillStyle(HALL_STONE_LIGHT);
  for (let qy = y - 112; qy < y - 88; qy += 6) g.fillRect(x - 12, qy, 3, 3);
  g.fillStyle(HALL_GOLD);
  g.fillCircle(x, y - 102, 8);
  g.fillStyle(0xfdf8ea);
  g.fillCircle(x, y - 102, 6.5);
  g.fillStyle(0x3b3b3b);
  for (let k = 0; k < 4; k++) g.fillRect(x + Math.sin(k * Math.PI / 2) * 5 - 0.5, y - 102 - Math.cos(k * Math.PI / 2) * 5 - 0.5, 1, 1);
  g.lineStyle(1, 0x3b3b3b);
  g.lineBetween(x, y - 102, x + Math.sin(elapsed * 0.6) * 5, y - 102 - Math.cos(elapsed * 0.6) * 5);
  g.lineBetween(x, y - 102, x + Math.sin(elapsed * 0.05) * 3, y - 102 - Math.cos(elapsed * 0.05) * 3);
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillRect(x - 14, y - 114, 28, 3);
  g.fillStyle(HALL_VERDIGRIS);
  g.fillEllipse(x, y - 125, 22, 18);
  g.fillStyle(0x86c0aa);
  g.fillEllipse(x - 4, y - 129, 4, 5);
  g.fillStyle(HALL_STONE);
  g.fillRect(x - 10, y - 125, 20, 11);
  for (const dx of [-5, 5]) {
    g.fillStyle(HALL_DARK);
    g.fillRect(x + dx - 2, y - 121, 4, 7);
    g.fillCircle(x + dx, y - 121, 2);
    g.fillStyle(HALL_GOLD);
    g.fillRect(x + dx - 1, y - 120, 2, 2);
  }
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillRect(x - 12, y - 127, 24, 2);
  g.fillStyle(HALL_VERDIGRIS);
  g.fillRect(x - 2, y - 138, 4, 5);
  g.fillStyle(HALL_GOLD);
  g.fillCircle(x, y - 140, 2);
  g.fillRect(x - 0.5, y - 150, 1, 9);
  g.fillEllipse(x + 1, y - 148, 9, 3);
  g.fillTriangle(x + 5, y - 148, x + 8, y - 150, x + 8, y - 146);

  // Slate hipped roof.
  g.fillStyle(SLATE);
  g.fillRect(x - 52, y - 86, 104, 10);
  g.fillTriangle(x - 66, y - 76, x - 52, y - 86, x - 52, y - 76);
  g.fillTriangle(x + 66, y - 76, x + 52, y - 86, x + 52, y - 76);

  // Arcade storey: rusticated stone, arches with voussoirs and keystones, pilasters between.
  g.fillStyle(HALL_STONE);
  g.fillRect(x - 66, y - 43, 132, 40);
  g.fillStyle(HALL_STONE_SHADE);
  for (let ry = y - 37; ry < y - 3; ry += 6) g.fillRect(x - 66, ry, 132, 1);
  for (const dx of bays) {
    const ax = x + dx;
    g.fillStyle(HALL_STONE_SHADE);
    g.fillRect(ax - 10, y - 24, 20, 21);
    g.fillCircle(ax, y - 24, 10);
    g.fillStyle(HALL_DARK);
    g.fillRect(ax - 8, y - 24, 16, 21);
    g.fillCircle(ax, y - 24, 8);
    g.fillStyle(HALL_STONE_LIGHT);
    g.fillRect(ax - 2, y - 36, 4, 5);
  }
  for (const dx of [-64, -39, -13, 13, 39, 64]) {
    g.fillStyle(HALL_STONE_LIGHT);
    g.fillRect(x + dx - 2, y - 40, 4, 37);
    g.fillRect(x + dx - 3, y - 41, 6, 2);
  }
  // Stalls in the outer bays: striped canopies over crates of produce.
  bays.forEach((dx, i) => {
    if (dx === 0) return;
    const ax = x + dx;
    for (let s = 0; s < 7; s++) {
      g.fillStyle(s % 2 ? 0xf3ece0 : i % 2 ? HALL_GOLD : 0xc2725a);
      g.fillRect(ax - 7 + s * 2, y - 22, 2, 4);
    }
    g.fillStyle(0x8a6a4a);
    g.fillRect(ax - 7, y - 8, 14, 5);
    g.fillStyle(0x8fb46a);
    g.fillRect(ax - 6, y - 10, 4, 2);
    g.fillStyle(0xd98a4a);
    g.fillRect(ax - 1, y - 10, 3, 2);
    g.fillStyle(0xc0504a);
    g.fillRect(ax + 3, y - 10, 3, 2);
  });
  // The open door in the middle bay, under a hanging lamp.
  g.fillStyle(0x5a3f2c);
  g.fillRect(x - 8, y - 20, 3, 17);
  g.fillRect(x + 5, y - 20, 3, 17);
  g.fillStyle(0x2a241f);
  g.fillRect(x - 0.5, y - 32, 1, 5);
  g.fillStyle(0xfff2b0);
  g.fillRect(x - 1.5, y - 27, 3, 4);
  // Steps.
  g.fillStyle(0xc9bda2);
  g.fillRect(x - 70, y - 3, 140, 3);
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillRect(x - 70, y - 3, 140, 1);
  // String course.
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillRect(x - 70, y - 46, 140, 3);
  g.fillStyle(0xbfb193);
  g.fillRect(x - 68, y - 43, 136, 1);

  // Upper storey: coursed brick, stone quoins, arched sash windows, a balcony in the middle.
  g.fillStyle(HALL_BRICK);
  g.fillRect(x - 64, y - 70, 128, 24);
  g.fillStyle(0x96493a, 0.5);
  for (let by = y - 67; by < y - 46; by += 4) g.fillRect(x - 64, by, 128, 1);
  g.fillStyle(HALL_STONE);
  for (let qy = y - 70, k = 0; qy < y - 46; qy += 6, k++) {
    g.fillRect(x - 64, qy, k % 2 ? 4 : 6, 3);
    g.fillRect(x + 64 - (k % 2 ? 4 : 6), qy, k % 2 ? 4 : 6, 3);
  }
  for (const dx of bays) {
    const ax = x + dx;
    g.fillStyle(HALL_STONE);
    g.fillRect(ax - 6, y - 61, 12, 12);
    g.fillCircle(ax, y - 61, 6);
    g.fillStyle(GLASS);
    g.fillRect(ax - 4, y - 61, 8, 11);
    g.fillCircle(ax, y - 61, 4);
    g.fillStyle(0xa9c3cc);
    g.fillRect(ax - 0.5, y - 65, 1, 15);
    g.fillRect(ax - 4, y - 57, 8, 1);
    g.fillStyle(HALL_STONE_LIGHT);
    if (dx !== 0) g.fillRect(ax - 7, y - 50, 14, 2);
  }
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillRect(x - 10, y - 54, 20, 2);
  for (let bx = x - 9; bx < x + 10; bx += 3) g.fillRect(bx, y - 52, 1, 6);

  // Cornice with dentils, then balustrades and urns over the wings.
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillRect(x - 68, y - 74, 136, 4);
  g.fillStyle(HALL_STONE_SHADE);
  for (let dx = -66; dx < 66; dx += 4) g.fillRect(x + dx, y - 70, 2, 2);
  g.fillStyle(HALL_STONE);
  g.fillRect(x - 70, y - 77, 140, 3);
  for (const side of [-1, 1]) {
    const from = side < 0 ? x - 70 : x + 36;
    g.fillStyle(HALL_STONE);
    for (let bx = from + 2; bx < from + 33; bx += 4) g.fillRect(bx, y - 83, 2, 6);
    g.fillStyle(HALL_STONE_LIGHT);
    g.fillRect(from, y - 85, 34, 2);
    g.fillRect(x + side * 67 - 1.5, y - 87, 3, 2);
    g.fillCircle(x + side * 67, y - 89, 2.5);
  }

  // Pediment with a gilt fish in the tympanum.
  g.fillStyle(HALL_STONE_LIGHT);
  g.fillTriangle(x - 40, y - 77, x, y - 94, x + 40, y - 77);
  g.fillStyle(HALL_STONE_SHADE);
  g.fillTriangle(x - 33, y - 79, x, y - 91, x + 33, y - 79);
  g.fillStyle(HALL_GOLD);
  g.fillEllipse(x - 1, y - 83, 10, 4);
  g.fillTriangle(x + 3, y - 83, x + 7, y - 85, x + 7, y - 81);
}

// Rivertown Minster: the signature. A pale sandstone nave with tall lancet windows, a square tower
// with pinnacles, and a slate spire with a gold cross, taller than anything else in town.
const MINSTER = 0xd8c9a6;
const MINSTER_SHADE = 0xbfae88;
function drawMinster(g, x, y) {
  // Nave to the west of the tower.
  g.fillStyle(MINSTER);
  g.fillRect(x - 52, y - 58, 40, 58);
  g.fillStyle(0x6b6f78);
  g.fillTriangle(x - 54, y - 58, x - 32, y - 76, x - 10, y - 58);
  g.fillStyle(MINSTER_SHADE);
  for (const bx of [-50, -30]) g.fillRect(x + bx, y - 58, 3, 58);
  g.fillStyle(0x7c95b0);
  for (const wx of [-44, -24]) {
    g.fillRect(wx + x, y - 46, 6, 24);
    g.fillTriangle(wx + x, y - 46, wx + x + 3, y - 51, wx + x + 6, y - 46);
  }
  // Chancel to the east, lower.
  g.fillStyle(MINSTER);
  g.fillRect(x + 14, y - 44, 34, 44);
  g.fillStyle(0x6b6f78);
  g.fillTriangle(x + 12, y - 44, x + 31, y - 58, x + 50, y - 44);
  g.fillStyle(0x7c95b0);
  g.fillRect(x + 26, y - 36, 8, 20);
  g.fillCircle(x + 30, y - 36, 4);
  // Tower.
  g.fillStyle(MINSTER);
  g.fillRect(x - 16, y - 150, 32, 150);
  g.fillStyle(MINSTER_SHADE);
  g.fillRect(x + 11, y - 150, 5, 150);
  g.fillRect(x - 18, y - 104, 36, 3);
  g.fillRect(x - 18, y - 62, 36, 3);
  // Belfry louvres and a rose window.
  g.fillStyle(0x4a4a52);
  g.fillRect(x - 10, y - 140, 6, 20);
  g.fillRect(x + 4, y - 140, 6, 20);
  g.fillStyle(0x7c95b0);
  g.fillCircle(x, y - 82, 8);
  g.fillStyle(MINSTER);
  g.fillRect(x - 1, y - 90, 2, 16);
  g.fillRect(x - 8, y - 83, 16, 2);
  // Pinnacles at the tower's corners.
  for (const side of [-1, 1]) {
    g.fillStyle(MINSTER);
    g.fillRect(x + side * 14 - 3, y - 160, 6, 10);
    g.fillTriangle(x + side * 14 - 3, y - 160, x + side * 14, y - 172, x + side * 14 + 3, y - 160);
  }
  g.fillStyle(MINSTER_SHADE);
  g.fillRect(x - 17, y - 152, 34, 3);
  // Spire.
  g.fillStyle(0x5c6470);
  g.fillTriangle(x - 12, y - 150, x, y - 284, x + 12, y - 150);
  g.fillStyle(0x6e7682);
  g.fillTriangle(x - 12, y - 150, x - 2, y - 270, x, y - 150);
  g.fillStyle(0xd9b56a);
  g.fillRect(x - 1, y - 300, 2, 18);
  g.fillRect(x - 5, y - 294, 10, 2);
  // West door under a pointed arch.
  g.fillStyle(MINSTER_SHADE);
  g.fillRect(x - 8, y - 22, 16, 22);
  g.fillTriangle(x - 8, y - 22, x, y - 30, x + 8, y - 22);
  g.fillStyle(0x5a3f2e);
  g.fillRect(x - 6, y - 20, 12, 20);
  g.fillTriangle(x - 6, y - 20, x, y - 26, x + 6, y - 20);
}

// Street first, then landmarks, matching the city's order.
export const RIVERTOWN_BUILDINGS = Object.freeze([
  ...streetBuildings(),
  ...RIVERTOWN_LANDMARKS.map((landmark, i) => ({ maxHealth: 280, seed: 160 + i, ...landmark })),
]);

// buildings: false leaves the street and landmarks to a mode that draws them itself (evil mode).
export function drawRivertown(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((RIVERTOWN.from + RIVERTOWN.to) / 2, cameraX);
  const half = (RIVERTOWN.to - RIVERTOWN.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawRoofline(g, left, right, seaY, cameraX, FAR_PARALLAX, 0xa9cad6, 1, 0.25);
  drawRoofline(g, left, right, seaY, cameraX, NEAR_PARALLAX, 0x97b6c3, 0.7, 0.5);
  if (!buildings) return;
  for (const building of RIVERTOWN_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    const y = rivertownBase(building.x, seaY);
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}

// Background rows: flat terraces with pitched roofs and chimney stacks, and now and then a mill
// chimney. No detail, pivoting on the town's centre and clipped to it, like the city skyline. Blocks
// fade out as they slide behind a landmark, so the landmarks stay clear.
const LANDMARK_REACH = 70 * CITY_SCALE;
function drawRoofline(g, left, right, seaY, cameraX, parallax, color, scale, salt) {
  const shift = (cameraX - nearest((RIVERTOWN.from + RIVERTOWN.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, RIVERTOWN.from, RIVERTOWN.to);
    if (fade <= 0) continue;
    const seed = Math.round(wx / SKYLINE_STEP);
    const roll = hash(seed + salt);
    if (roll < 0.15) continue;
    const centre = wrapX(x + SKYLINE_STEP / 2);
    const clearance = Math.min(...RIVERTOWN_LANDMARKS.map(l => Math.abs(centre - l.x) - l.width / 2));
    const alpha = fade * Math.min(1, Math.max(0, (clearance + LANDMARK_REACH * 0.4) / (LANDMARK_REACH * 0.6)));
    if (alpha <= 0) continue;
    // Stand on the banks, not the river bed, so the row bridges the river like the town behind it.
    const y = seaY - Math.max(18, elevation(ground)) + 3;
    const unit = scale * CITY_SCALE;
    const h = Math.round((50 + hash(seed + 0.4 + salt) * 50) * unit);
    const w = SKYLINE_STEP - 2;
    g.fillStyle(color, alpha);
    g.fillRect(x, y - h, w, h);
    g.fillTriangle(x, y - h, x + w / 2, y - h - Math.round(10 * unit), x + w, y - h);
    g.fillRect(x + 5, y - h - Math.round(12 * unit), 5, Math.round(10 * unit));
    if (roll > 0.92) {
      // A tall mill chimney, tapering.
      const ch = Math.round(150 * unit);
      g.fillRect(x + w / 2 - 4, y - ch, 8, ch - h);
      g.fillRect(x + w / 2 - 5, y - ch - 3, 10, 4);
    }
  }
}
