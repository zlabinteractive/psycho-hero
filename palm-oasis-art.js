import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';
import { drawPalm } from './golden-beach-art.js';

// Palm Oasis, a desert village round a spring between the Red Dunes and Redrock, built to
// game-design-rules/city-design-rules.md. Two flat parallax rows (far dunes, a nearer grove of palm
// crowns) sit behind a destructible street of rounded mud-brick houses with palm beams poking out,
// two-storey houses with outside stairs and goat-hair tents, in one muted mud-brown theme, with date
// palms standing among them and crowding the pool. The landmarks have their own palettes and detail:
// the caravanserai with its great arched gate, the date market under palm-leaf shades, the spring pool
// itself (scenery seen beyond the road, with reeds, ducks and dragonflies), the water wheel turning
// beside it, and the mud-brick watchtower (the signature, taller than anything in the village).
// Everything that can break is listed once in PALM_OASIS_BUILDINGS, so evil mode can promote it.
export const PALM_OASIS = { from: 30400, to: 31200 };
// The spring pool, beyond the road: [from, to] world x. Houses keep clear of it; palms ring it.
export const OASIS_POOL = { from: 30762, to: 30934 };
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 26;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
const VILLAGE_EDGE = 120;

// The street theme: mud brick, palm-trunk beams, weathered blue-grey doors.
const MUD = [0xb08a62, 0xa47e58, 0xbc966c];
const BEAM = 0x6a5440;
const DOOR = 0x4f6470;
const SHADOW = 0x3e342a;
const TENT = 0x2f2a26;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

export function oasisBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the street leaves free. width/height: hit box once promoted.
// The water wheel turns with elapsed, so a promoted wheel bakes standing still (elapsed 0).
const LANDMARK_ART = [
  { id: 'caravanserai', x: 30496, door: true, draw: drawCaravanserai, fx: serayFlagFx, clear: 68, width: 136, height: 84, maxHealth: 320 },
  { id: 'date-market', x: 30720, door: true, draw: drawDateMarket, clear: 32, width: 58, height: 28, maxHealth: 140 },
  { id: 'water-wheel', x: 30966, draw: drawWaterWheel, clear: 22, width: 40, height: 42, maxHealth: 180 },
  { id: 'oasis-watchtower', x: 31122, door: true, draw: drawWatchtower, clear: 18, width: 26, height: 100, maxHealth: 260 },
];
export const PALM_OASIS_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// Free stretches of street: the village minus each landmark's clear space and the pool.
function streetSpans() {
  const cuts = [...PALM_OASIS_LANDMARKS.map(l => [l.x - l.clear, l.x + l.clear]), [OASIS_POOL.from, OASIS_POOL.to]]
    .sort((a, b) => a[0] - b[0]);
  const spans = [];
  let start = PALM_OASIS.from;
  for (const [a, b] of [...cuts, [PALM_OASIS.to, PALM_OASIS.to]]) {
    if (a - start > 26) spans.push([start, a]);
    start = Math.max(start, b);
  }
  return spans;
}

// Street: rounded houses (kind 0), two-storey houses with outside stairs (1) and goat-hair tents (2).
const KINDS = ['adobe', 'adobe2', 'tent'];
const MIX = [0, 1, 0, 2, 1, 0, 1];
function streetBuildings() {
  const buildings = [];
  let i = 0;
  for (const [from, to] of streetSpans()) {
    for (let bx = from + 4; ; i++) {
      const seed = i + 0.83;
      const kind = MIX[i % MIX.length];
      const art = kind === 2 ? 24 : 22 + Math.round(hash(seed + 0.2) * 8);
      const width = art * CITY_SCALE;
      const centre = bx + width / 2;
      if (bx + width > to - 4) break;
      bx += width + 3 + Math.round(hash(seed + 0.5) * 4);
      const taper = Math.min(1, Math.min(centre - PALM_OASIS.from, PALM_OASIS.to - centre) / VILLAGE_EDGE);
      const height = Math.round([20, 34, 15][kind] * (0.75 + 0.25 * taper) + hash(seed + 0.3) * 4);
      const mud = MUD[Math.floor(hash(seed + 0.4) * MUD.length)];
      const look = hash(seed + 0.6);
      buildings.push({
        id: `oasis-${i}`, seed, kind: KINDS[kind], x: centre, width,
        height: (height + 6) * CITY_SCALE, roof: height * CITY_SCALE, maxHealth: 110, door: true,
        draw: scaled((g, at, y) => drawHouse(g, at - art / 2, y, art, height, kind, mud, look)),
      });
    }
  }
  return buildings;
}

// Date palms: ringing the pool, and here and there between the houses. Unscaled art, like the beach's.
const PALM_SPOTS = [30440, 30604, 30748, 30772, 30800, 30842, 30880, 30914, 30942, 31010, 31170];
function palms() {
  return PALM_SPOTS.map((x, i) => {
    const variant = i % 3;
    const tall = [44, 52, 38][variant];
    return { countsAsBuilding: false, id: `oasis-palm-${i}`, seed: 700 + i, kind: 'palm', x, width: 30, height: tall + 10, roof: tall, maxHealth: 80,
      draw: (g, at, y, elapsed = 0) => drawPalm(g, at, y - SEA_Y_OFFSET + 1, variant, elapsed) };
  });
}

function drawHouse(g, x, y, width, height, kind, mud, look) {
  const door = Math.round(x + width / 2);
  const top = y - height;
  if (kind === 2) {
    // Goat-hair tent: a low black ridge propped on poles, the front flap folded back.
    g.fillStyle(TENT);
    g.fillRect(x, top + 4, width, height - 4);
    g.fillTriangle(x - 3, top + 6, door, top - 2, x + width + 3, top + 6);
    g.fillStyle(0x3e3732);
    for (let sx = x; sx < x + width; sx += 4) g.fillRect(sx, top + 4, 1, height - 4);
    g.fillStyle(0x1e1a18);
    g.fillRect(door - 4, y - 12, 8, 12);
    g.fillStyle(0xb8604a);
    g.fillRect(door - 4, y - 2, 8, 2);
    g.lineStyle(1, 0x8a7a62);
    g.lineBetween(x - 3, top + 6, x - 7, y);
    g.lineBetween(x + width + 3, top + 6, x + width + 7, y);
    return;
  }
  const shade = lerpColor(mud, 0x000000, 0.12);
  // Walls with softened corners, a parapet and palm beams poking through.
  g.fillStyle(mud);
  g.fillRect(x + 1, top, width - 2, height);
  g.fillRect(x, top + 2, width, height - 2);
  g.fillStyle(shade);
  g.fillRect(x + width - 3, top + 1, 3, height - 1);
  g.fillStyle(lerpColor(mud, 0xffffff, 0.12));
  g.fillRect(x + 1, top - 1, width - 2, 2);
  g.fillStyle(BEAM);
  for (let bx = x + 3; bx < x + width - 2; bx += 6) g.fillRect(bx, top + 3, 2, 2);
  if (kind === 0) {
    // One small deep window.
    g.fillStyle(SHADOW);
    g.fillRect(x + (look < 0.5 ? 3 : width - 8), top + 7, 4, 4);
  } else {
    // Upper storey windows and an outside stair up one side.
    g.fillStyle(SHADOW);
    g.fillRect(x + 4, top + 6, 4, 5);
    g.fillRect(x + width - 9, top + 6, 4, 5);
    g.fillStyle(BEAM);
    g.fillRect(x + 3, top + 11, 6, 1);
    g.fillStyle(shade);
    const side = look < 0.5 ? -1 : 1;
    for (let s = 0; s < 6; s++) {
      const sx = side < 0 ? x - 6 + s : x + width - s;
      g.fillRect(sx, y - 2 - s * 3, 6 - s, 2 + s * 3);
    }
    g.fillStyle(mud);
    g.fillRect(side < 0 ? x - 6 : x + width, y - 2, 6, 2);
  }
  // Roof clutter: a jar or a drying rack.
  if (look > 0.6) {
    g.fillStyle(0xb87a58);
    g.fillRect(x + width - 7, top - 4, 3, 3);
  } else if (look < 0.25) {
    g.fillStyle(BEAM);
    g.fillRect(x + 3, top - 5, 1, 4);
    g.fillRect(x + 10, top - 5, 1, 4);
    g.fillStyle(0xa86a3a);
    g.fillRect(x + 3, top - 5, 8, 1);
  }
  // The door, centred, a person tall, under a beam lintel.
  g.fillStyle(BEAM);
  g.fillRect(door - 5, y - 15, 10, 2);
  g.fillStyle(DOOR);
  g.fillRect(door - 4, y - 13, 8, 13);
  g.fillStyle(lerpColor(DOOR, 0x000000, 0.2));
  g.fillRect(door - 4, y - 9, 8, 1);
}

// The caravanserai: a big two-storey mud-brick kasbah inn round a courtyard. Tapered corner towers
// with carved diamond friezes and horned corner pinnacles, an upper gallery of arches, palm beams
// poking through the walls, and a tall gate block: a horseshoe arch in a tiled frame (the door) with
// banded voussoirs and its studded leaves open onto the yard (a well, a palm, a kneeling camel), a
// lattice window above, lanterns either side and the flag on top. Out front a palm-frond shade over a
// water trough and saddlebags, a hitching post, jars, and a rug airing on the parapet.
const SERAY = 0xb8906a;
const SERAY_SHADE = 0x9e7856;
const SERAY_LIGHT = 0xcca47c;
const SERAY_DARK = 0x4a3e30;
const SERAY_TILE = 0x4f7a86;
const SERAY_CREAM = 0xe8d8a8;
const SERAY_RUST = 0xa8583a;
const SERAY_TOP = 84;

function arch(g, x, y, w, h, color) {
  g.fillStyle(color);
  g.fillRect(x, y + w / 2, w, h - w / 2);
  g.fillCircle(x + w / 2, y + w / 2, w / 2);
}

// Mortar courses and patches of fresh and weathered plaster on a mud wall.
function mudWall(g, x0, top, w, h, salt) {
  g.fillStyle(SERAY_SHADE);
  for (let cy = top + 5; cy < top + h - 1; cy += 5) g.fillRect(x0, cy, w, 1);
  for (let i = 0; i < w * h / 160; i++) {
    const px = x0 + Math.floor(hash(salt + i * 3.1) * (w - 6));
    const py = top + 3 + Math.floor(hash(salt + i * 5.7) * (h - 8));
    g.fillStyle(hash(salt + i) < 0.5 ? SERAY_LIGHT : lerpColor(SERAY, SERAY_SHADE, 0.5));
    g.fillRect(px, py, 4 + Math.floor(hash(salt + i * 1.9) * 4), 2);
  }
}

// Palm-trunk beam ends poking through a wall, each with a drip stain below.
function toron(g, x0, x1, by, step) {
  for (let bx = x0; bx <= x1; bx += step) {
    g.fillStyle(lerpColor(SERAY, SERAY_SHADE, 0.6));
    g.fillRect(bx, by + 2, 2, 2);
    g.fillStyle(BEAM);
    g.fillRect(bx, by, 2, 2);
  }
}

// A row of carved diamonds, the kasbah's relief frieze.
function diamonds(g, x0, by, w) {
  g.fillStyle(SERAY_SHADE);
  for (let dx = x0 + 2; dx + 3 <= x0 + w - 1; dx += 5) {
    g.fillRect(dx + 1, by, 1, 1);
    g.fillRect(dx, by + 1, 3, 1);
    g.fillRect(dx + 1, by + 2, 1, 1);
  }
  g.fillStyle(SERAY_LIGHT);
  g.fillRect(x0, by - 2, w, 1);
  g.fillRect(x0, by + 4, w, 1);
}

// Parapet of stepped merlons with horned pinnacles at the corners.
function hornedParapet(g, x0, top, w) {
  g.fillStyle(SERAY_LIGHT);
  g.fillRect(x0 - 1, top - 1, w + 2, 2);
  g.fillStyle(SERAY);
  for (let bx = x0 + 4; bx + 3 <= x0 + w - 4; bx += 5) {
    g.fillRect(bx, top - 4, 3, 3);
    g.fillRect(bx + 1, top - 5, 1, 1);
  }
  for (const [cx, dir] of [[x0, 1], [x0 + w, -1]]) {
    g.fillStyle(SERAY);
    g.fillTriangle(cx, top - 1, cx + dir * 4, top - 1, cx, top - 8);
    g.fillStyle(SERAY_LIGHT);
    g.fillRect(dir > 0 ? cx : cx - 1, top - 8, 1, 7);
  }
}

// A tapered tower: wider at the foot, shaded on the east, with slits, beams and a frieze.
function serayTower(g, tx, w, h, y, salt) {
  const top = y - h;
  g.fillStyle(SERAY);
  g.fillRect(tx + 2, top, w - 4, h);
  g.fillTriangle(tx, y, tx + 2, y, tx + 2, top);
  g.fillTriangle(tx + w, y, tx + w - 2, y, tx + w - 2, top);
  mudWall(g, tx + 2, top + 8, w - 6, h - 8, salt);
  g.fillStyle(SERAY_SHADE);
  g.fillRect(tx + w - 5, top, 3, h);
  g.fillTriangle(tx + w, y, tx + w - 2, y, tx + w - 2, top);
  g.fillStyle(SERAY_LIGHT);
  g.fillTriangle(tx, y, tx + 2, y, tx + 2, top);
  diamonds(g, tx + 2, top + 5, w - 4);
  toron(g, tx + 4, tx + w - 6, top + 14, 5);
  toron(g, tx + 4, tx + w - 6, top + 34, 5);
  g.fillStyle(SERAY_DARK);
  arch(g, Math.round(tx + w / 2 - 2), top + 20, 3, 7, SERAY_DARK);
  g.fillRect(Math.round(tx + w / 2 - 1), top + 42, 1, 6);
  hornedParapet(g, tx + 1, top, w - 2);
}

function drawCaravanserai(g, x, y) {
  const left = x - 56;
  const right = x + 56;
  // Main two-storey block.
  g.fillStyle(SERAY);
  g.fillRect(left, y - 44, 112, 44);
  mudWall(g, left, y - 44, 112, 44, 11);
  g.fillStyle(SERAY_SHADE);
  g.fillRect(left, y - 4, 112, 4);
  g.fillStyle(SERAY_LIGHT);
  g.fillRect(left, y - 5, 112, 1);
  toron(g, left + 3, right - 4, y - 27, 7);
  hornedParapet(g, left, y - 44, 112);
  // Upper gallery: three arches each side, a balustrade along their feet.
  for (const ax0 of [x - 47, x + 22]) {
    for (let i = 0; i < 3; i++) {
      const ax = ax0 + i * 9;
      g.fillStyle(SERAY_LIGHT);
      g.fillRect(ax - 1, y - 40, 8, 12);
      arch(g, ax, y - 39, 6, 11, SERAY_DARK);
      g.fillStyle(0x6a5a48);
      g.fillRect(ax + 1, y - 33, 4, 1);
      g.fillStyle(SERAY_LIGHT);
      for (let bx = ax; bx < ax + 6; bx += 2) g.fillRect(bx, y - 31, 1, 3);
    }
  }
  // Ground-floor windows: shuttered and grilled.
  for (const wx of [x - 44, x - 32, x + 27, x + 39]) {
    g.fillStyle(SERAY_LIGHT);
    g.fillRect(wx - 1, y - 20, 7, 9);
    g.fillStyle(SERAY_DARK);
    g.fillRect(wx, y - 19, 5, 7);
    g.fillStyle(IRON_GRILLE);
    g.fillRect(wx + 1, y - 19, 1, 7);
    g.fillRect(wx + 3, y - 19, 1, 7);
    g.fillStyle(DOOR);
    g.fillRect(wx - 2, y - 19, 1, 7);
    g.fillRect(wx + 6, y - 19, 1, 7);
  }
  // A rug airing over the parapet, east wing.
  g.fillStyle(SERAY_RUST);
  g.fillRect(x + 31, y - 47, 12, 6);
  g.fillStyle(SERAY_CREAM);
  g.fillRect(x + 31, y - 46, 12, 1);
  g.fillRect(x + 36, y - 45, 2, 2);
  g.fillStyle(0x2f4a6a);
  g.fillRect(x + 32, y - 42, 10, 1);
  g.fillStyle(SERAY_CREAM);
  for (let fx = x + 31; fx < x + 43; fx += 2) g.fillRect(fx, y - 41, 1, 1);
  // Corner towers.
  serayTower(g, x - 68, 18, 60, y, 3);
  serayTower(g, x + 50, 18, 60, y, 7);
  // Gate block.
  g.fillStyle(SERAY_LIGHT);
  g.fillRect(x - 20, y - 70, 40, 70);
  mudWall(g, x - 20, y - 64, 40, 20, 19);
  g.fillStyle(SERAY);
  g.fillRect(x + 16, y - 70, 4, 70);
  diamonds(g, x - 19, y - 64, 38);
  hornedParapet(g, x - 20, y - 70, 40);
  // Lattice window over the gate.
  g.fillStyle(BEAM);
  g.fillRect(x - 7, y - 55, 14, 10);
  g.fillStyle(0x4a3a2a);
  for (let ly = y - 53; ly < y - 46; ly += 2) {
    for (let lx = x - 6 + ((ly - y + 53) / 2) % 2; lx < x + 6; lx += 2) g.fillRect(lx, ly, 1, 1);
  }
  g.fillStyle(SERAY_CREAM);
  g.fillRect(x - 8, y - 56, 16, 1);
  g.fillStyle(BEAM);
  g.fillTriangle(x - 5, y - 45, x + 5, y - 45, x, y - 42);
  // Tiled frame (alfiz) round the arch.
  g.fillStyle(SERAY_TILE);
  g.fillRect(x - 15, y - 41, 30, 41);
  g.fillStyle(SERAY_CREAM);
  for (let ty = y - 40; ty < y - 1; ty += 2) {
    g.fillRect(x - 14 + ((ty - y) / 2 % 2 ? 1 : 0), ty, 1, 1);
    g.fillRect(x + 13 - ((ty - y) / 2 % 2 ? 1 : 0), ty, 1, 1);
  }
  for (let tx = x - 13; tx < x + 13; tx += 2) g.fillRect(tx, y - 40 + ((tx - x) % 4 === 0 ? 1 : 0), 1, 1);
  g.fillStyle(SERAY_LIGHT);
  g.fillRect(x - 12, y - 38, 24, 38);
  // Banded voussoirs round a horseshoe arch.
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * 0.88 + i / 12 * Math.PI * 1.24;
    g.fillStyle(i % 2 ? SERAY_RUST : SERAY_CREAM);
    g.fillCircle(Math.round(x + Math.cos(a) * 10.5), Math.round(y - 25 + Math.sin(a) * 10.5), 2);
  }
  g.fillStyle(SERAY_DARK);
  g.fillCircle(x, y - 25, 9);
  g.fillRect(x - 8, y - 25, 16, 25);
  // The courtyard through the gate: far arcade, pale yard, a well, a palm and a kneeling camel.
  g.fillStyle(0x6a5a48);
  g.fillRect(x - 8, y - 16, 16, 10);
  g.fillStyle(SERAY_DARK);
  for (const ax of [x - 7, x - 2, x + 3]) arch(g, ax, y - 15, 4, 8, SERAY_DARK);
  g.fillStyle(0xd8b88a);
  g.fillRect(x - 8, y - 6, 16, 6);
  g.fillStyle(0x8a7a62);
  g.fillRect(x - 6, y - 9, 5, 4);
  g.fillStyle(0x5a4a38);
  g.fillRect(x - 6, y - 13, 1, 4);
  g.fillRect(x - 2, y - 13, 1, 4);
  g.fillRect(x - 6, y - 13, 5, 1);
  g.fillStyle(0xb08a5a);
  g.fillRect(x + 1, y - 4, 6, 3);
  g.fillRect(x + 3, y - 6, 3, 2);
  g.fillRect(x + 6, y - 7, 1, 3);
  g.fillRect(x + 6, y - 8, 2, 1);
  g.fillStyle(0x7a5a3a);
  g.fillRect(x + 4, y - 22, 1, 15);
  g.fillStyle(0x6f8a4a);
  g.fillRect(x + 1, y - 23, 7, 2);
  g.fillRect(x, y - 21, 2, 1);
  g.fillRect(x + 7, y - 21, 2, 1);
  // Studded timber leaves folded open.
  g.fillStyle(0x6a4e36);
  g.fillRect(x - 11, y - 24, 3, 24);
  g.fillRect(x + 8, y - 24, 3, 24);
  g.fillStyle(0xb8a070);
  for (let sy = y - 21; sy < y; sy += 4) {
    g.fillRect(x - 10, sy, 1, 1);
    g.fillRect(x + 9, sy, 1, 1);
  }
  // Brass lanterns either side of the arch.
  for (const lx of [x - 18, x + 16]) {
    g.fillStyle(BEAM);
    g.fillRect(lx, y - 33, 3, 1);
    g.fillStyle(0xb8903a);
    g.fillRect(lx, y - 32, 3, 4);
    g.fillStyle(0xf0dca0);
    g.fillRect(lx + 1, y - 31, 1, 2);
  }
  // Out front, west: a palm-frond shade over a water trough and saddlebags.
  g.fillStyle(BEAM);
  g.fillRect(x - 47, y - 17, 1, 17);
  g.fillRect(x - 25, y - 17, 1, 17);
  g.fillStyle(0x8a7a4a);
  g.fillRect(x - 49, y - 19, 27, 2);
  g.fillStyle(0x6f7a42);
  for (let fx = x - 49; fx < x - 22; fx += 2) g.fillRect(fx, y - 17, 1, 2 + (fx % 3 === 0 ? 1 : 0));
  g.fillStyle(0x8a7a62);
  g.fillRect(x - 44, y - 5, 12, 5);
  g.fillStyle(0x5f8aa0);
  g.fillRect(x - 43, y - 5, 10, 1);
  g.fillStyle(SERAY_RUST);
  g.fillRect(x - 30, y - 5, 4, 5);
  g.fillStyle(0x2f4a6a);
  g.fillRect(x - 30, y - 3, 4, 1);
  // East: a hitching post and water jars.
  g.fillStyle(BEAM);
  g.fillRect(x + 25, y - 7, 1, 7);
  g.fillRect(x + 33, y - 7, 1, 7);
  g.fillRect(x + 24, y - 7, 11, 1);
  for (const [jx, h] of [[x + 39, 6], [x + 43, 5]]) {
    g.fillStyle(0xa86a4a);
    g.fillRect(jx, y - h, 3, h);
    g.fillRect(jx + 1, y - h - 1, 1, 1);
  }
  // Flagpole on the gate block.
  g.fillStyle(0x5a5650);
  g.fillRect(x, y - SERAY_TOP, 1, 14);
  g.fillStyle(0xd9a83a);
  g.fillRect(x, y - SERAY_TOP - 1, 1, 1);
}
const IRON_GRILLE = 0x3a3530;

function serayFlagFx(g, x, y, elapsed) {
  const top = y - SERAY_TOP;
  for (let i = 0; i < 8; i++) {
    const wave = Math.round(Math.sin(elapsed * 5 - i * 0.7) * (i / 8) * 1.4);
    g.fillStyle(0x5f8a5a);
    g.fillRect(x + 1 + i, top + wave, 1, 3);
    g.fillStyle(0xe8e2d4);
    g.fillRect(x + 1 + i, top + 3 + wave, 1, 2);
  }
}

// The date market: two shades of palm fronds on poles over rugs, baskets heaped with dates, clay
// jars, and a merchant's chest; the way in between them (the door) is marked by a hanging lamp.
function drawDateMarket(g, x, y) {
  for (const [dx, w] of [[-26, 22], [6, 22]]) {
    const left = x + dx;
    g.fillStyle(BEAM);
    g.fillRect(left, y - 22, 1, 22);
    g.fillRect(left + w - 1, y - 22, 1, 22);
    // Frond roof, ragged.
    g.fillStyle(0x8a9a5a);
    g.fillRect(left - 2, y - 25, w + 4, 3);
    g.fillStyle(0x6f8a4a);
    for (let fx = left - 2; fx < left + w + 2; fx += 2) g.fillRect(fx, y - 22, 1, 1 + ((fx * 7) & 1));
    g.fillStyle(0xa8a86a);
    g.fillRect(left, y - 26, w - 4, 1);
    // Rug and baskets of dates.
    g.fillStyle(dx < 0 ? 0xb8604a : 0x4f7a86);
    g.fillRect(left + 1, y - 1, w - 2, 1);
    for (let bx = left + 2; bx < left + w - 4; bx += 6) {
      g.fillStyle(0xb8955a);
      g.fillRect(bx, y - 5, 5, 4);
      g.fillStyle(0x7a3e2a);
      g.fillRect(bx, y - 6, 5, 1);
      g.fillRect(bx + 1, y - 7, 3, 1);
    }
  }
  // Clay jars and a chest.
  g.fillStyle(0xb87a58);
  g.fillRect(x - 30, y - 6, 3, 6);
  g.fillRect(x - 29, y - 7, 1, 1);
  g.fillRect(x + 29, y - 5, 3, 5);
  g.fillStyle(0x6a4e36);
  g.fillRect(x + 22, y - 4, 5, 4);
  // Hanging lamp over the way in.
  g.fillStyle(BEAM);
  g.fillRect(x - 4, y - 24, 10, 1);
  g.fillStyle(0xb8903a);
  g.fillRect(x, y - 22, 2, 3);
  g.fillStyle(0xf0dca0);
  g.fillRect(x, y - 21, 1, 1);
}

// The water wheel: a wooden wheel of paddles and pots turning in the outflow from the pool, lifting
// water to a trough on a mud-brick pier that runs off toward the plots. It turns with elapsed.
const WHEEL_R = 15;
function drawWaterWheel(g, x, y, elapsed = 0) {
  const cx = x - 4;
  const cy = y - WHEEL_R - 2;
  // The channel at its foot.
  g.fillStyle(0x4a8aa0);
  g.fillRect(x - 22, y - 3, 30, 3);
  // Pier and trough.
  g.fillStyle(0xa47e58);
  g.fillRect(x + 8, y - 34, 10, 34);
  g.fillStyle(0x8e6a4a);
  g.fillRect(x + 15, y - 34, 3, 34);
  g.fillStyle(BEAM);
  g.fillRect(x + 4, y - 36, 18, 3);
  g.fillStyle(0x6aaac0);
  g.fillRect(x + 6, y - 36, 14, 1);
  // Axle post.
  g.fillStyle(BEAM);
  g.fillRect(cx - 1, cy, 3, y - cy);
  // Rim and spokes.
  const turn = elapsed * 0.8;
  g.lineStyle(1, 0x7a6048);
  for (let i = 0; i < 16; i++) {
    const a0 = i / 16 * Math.PI * 2;
    const a1 = (i + 1) / 16 * Math.PI * 2;
    g.lineBetween(cx + Math.cos(a0) * WHEEL_R, cy + Math.sin(a0) * WHEEL_R, cx + Math.cos(a1) * WHEEL_R, cy + Math.sin(a1) * WHEEL_R);
  }
  for (let i = 0; i < 8; i++) {
    const a = turn + i / 8 * Math.PI * 2;
    g.lineStyle(1, 0x6a5440);
    g.lineBetween(cx, cy, cx + Math.cos(a) * WHEEL_R, cy + Math.sin(a) * WHEEL_R);
    // Clay pots on the rim.
    g.fillStyle(0xb87a58);
    g.fillRect(Math.round(cx + Math.cos(a) * WHEEL_R) - 1, Math.round(cy + Math.sin(a) * WHEEL_R) - 1, 3, 3);
  }
  g.fillStyle(0x54443a);
  g.fillRect(cx - 2, cy - 2, 4, 4);
  // A trickle spilling from the top pot into the trough.
  g.fillStyle(0x8ac8dc);
  g.fillRect(cx + 4, cy - WHEEL_R + 1, 1, 3);
  g.fillRect(x + 5, y - 37, 2, 1);
}

// The watchtower: a tall, slightly tapering mud-brick tower with rows of palm beams, slit windows,
// a crenellated top and a lookout room; the door is at its foot.
const TOWER = 0xa87e56;
const TOWER_SHADE = 0x8e6a48;
function drawWatchtower(g, x, y) {
  for (let i = 0; i < 88; i++) {
    const half = Math.round(11 - i * 0.04);
    g.fillStyle(TOWER);
    g.fillRect(x - half, y - 1 - i, half * 2, 1);
    g.fillStyle(TOWER_SHADE);
    g.fillRect(x + half - 3, y - 1 - i, 3, 1);
  }
  g.fillStyle(BEAM);
  for (let by = y - 80; by < y - 8; by += 12) {
    g.fillRect(x - 10, by, 2, 2);
    g.fillRect(x - 1, by, 2, 2);
    g.fillRect(x + 7, by, 2, 2);
  }
  g.fillStyle(SHADOW);
  for (let wy = y - 72; wy < y - 24; wy += 16) g.fillRect(x - 1, wy, 2, 6);
  // Lookout room and crenellated top.
  g.fillStyle(0xb88e64);
  g.fillRect(x - 10, y - 92, 20, 6);
  g.fillStyle(SHADOW);
  g.fillRect(x - 6, y - 91, 3, 3);
  g.fillRect(x + 3, y - 91, 3, 3);
  g.fillStyle(TOWER);
  for (let bx = x - 10; bx < x + 10; bx += 4) g.fillTriangle(bx, y - 92, bx + 2, y - 98, bx + 4, y - 92);
  // Door at the foot.
  g.fillStyle(BEAM);
  g.fillRect(x - 5, y - 16, 10, 2);
  g.fillStyle(DOOR);
  g.fillRect(x - 4, y - 14, 8, 14);
}

// Garden plots and palm-leaf fences between the houses: [x, kind].
export const OASIS_PROPS = Object.freeze([
  [30418, 'plot'], [30608, 'fence'], [30626, 'jars'], [30588, 'well'], [31000, 'plot'], [31050, 'fence'], [31180, 'jars'],
].map(([x, kind]) => ({ x, kind })));

function drawProp(g, prop, x, y) {
  if (prop.kind === 'plot') {
    for (let i = 0; i < 6; i++) {
      g.fillStyle(0x6a5440);
      g.fillRect(x - 12 + i * 4, y - 1, 3, 1);
      g.fillStyle(i % 2 ? 0x7a9a4a : 0x6a8a40);
      g.fillRect(x - 12 + i * 4, y - 4, 1, 3);
      g.fillRect(x - 11 + i * 4, y - 3, 1, 2);
    }
  } else if (prop.kind === 'fence') {
    g.fillStyle(0x8a7a52);
    for (let i = 0; i < 16; i += 2) g.fillRect(x - 8 + i, y - 8 - (i % 4 ? 1 : 0), 1, 8 + (i % 4 ? 1 : 0));
    g.fillStyle(BEAM);
    g.fillRect(x - 8, y - 5, 16, 1);
  } else if (prop.kind === 'jars') {
    for (const [dx, h] of [[-4, 6], [0, 8], [4, 5]]) {
      g.fillStyle(0xb87a58);
      g.fillRect(x + dx - 1, y - h, 3, h);
      g.fillStyle(0x9a6448);
      g.fillRect(x + dx, y - h - 1, 1, 1);
    }
  } else {
    // A stone well with a winch frame and a bucket.
    g.fillStyle(0x9a8a72);
    g.fillRect(x - 5, y - 6, 10, 6);
    g.fillStyle(0x8a7a62);
    g.fillRect(x - 5, y - 4, 10, 1);
    g.fillStyle(BEAM);
    g.fillRect(x - 5, y - 14, 1, 8);
    g.fillRect(x + 4, y - 14, 1, 8);
    g.fillRect(x - 5, y - 14, 10, 1);
    g.fillStyle(0x6a6460);
    g.fillRect(x, y - 13, 1, 4);
    g.fillRect(x - 1, y - 9, 3, 2);
  }
}

// The spring pool, seen beyond the road: still blue water edged with reeds, glints, ducks gliding and
// a dragonfly darting over it. Drawn behind the street.
function drawPool(g, left, right, seaY, shift, elapsed) {
  const from = OASIS_POOL.from + shift;
  const to = OASIS_POOL.to + shift;
  if (to < left || from > right) return;
  const y = oasisBase(OASIS_POOL.from, seaY) - SEA_Y_OFFSET;
  const span = to - from;
  // The far bank, then the water.
  g.fillStyle(0x9a8a5a);
  g.fillRect(from + 6, y - 12, span - 12, 2);
  g.fillStyle(0x3f8aa4);
  g.fillRect(from + 2, y - 10, span - 4, 10);
  g.fillRect(from + 8, y - 11, span - 16, 1);
  g.fillStyle(0x5aa4bc);
  g.fillRect(from + 4, y - 10, span - 8, 2);
  for (let i = 0; i < 8; i++) {
    const gx = from + 14 + ((i * 37 + elapsed * 6) % (span - 28));
    g.fillStyle(0xcfeaf2, 0.5 + 0.3 * Math.sin(elapsed * 2 + i));
    g.fillRect(Math.round(gx), y - 6 + (i % 3) * 2, 4, 1);
  }
  // Reeds at both ends and in clumps.
  for (const rx of [from + 2, from + 6, from + 40, from + 44, to - 50, to - 8, to - 4]) {
    g.fillStyle(0x6f8a4a);
    g.fillRect(rx, y - 16, 1, 16);
    g.fillRect(rx + 2, y - 13, 1, 13);
    g.fillStyle(0x8a6a3a);
    g.fillRect(rx, y - 18, 1, 3);
  }
  // Ducks gliding back and forth.
  for (let i = 0; i < 3; i++) {
    const t = (elapsed * 0.03 + i * 0.31) % 1;
    const back = t > 0.5;
    const dx = from + 20 + (span - 40) * (back ? 2 - t * 2 : t * 2);
    const dir = back ? -1 : 1;
    const bx = Math.round(dx);
    g.fillStyle(i === 0 ? 0x6a5a48 : 0x8a7a62);
    g.fillRect(bx - 2, y - 11, 5, 2);
    g.fillStyle(i === 0 ? 0x3f6a4a : 0x7a6a52);
    g.fillRect(bx + dir * 2, y - 13, 2, 2);
    g.fillStyle(0xd9a83a);
    g.fillRect(bx + dir * 4 - (dir < 0 ? 1 : 0), y - 12, 1, 1);
  }
  // A dragonfly darting.
  const fx = from + span * (0.5 + 0.35 * Math.sin(elapsed * 0.7));
  const fy = y - 20 - 6 * Math.sin(elapsed * 1.9);
  g.fillStyle(0x4f7a9a);
  g.fillRect(Math.round(fx) - 2, Math.round(fy), 4, 1);
  g.fillStyle(0xe8f0f2, 0.7);
  g.fillRect(Math.round(fx) - 1, Math.round(fy) - (Math.sin(elapsed * 40) > 0 ? 1 : 0) - 1, 3, 1);
}

// Street first, palms, then landmarks.
export const PALM_OASIS_BUILDINGS = Object.freeze([
  ...streetBuildings(),
  ...palms(),
  ...PALM_OASIS_LANDMARKS.map((landmark, i) => ({ maxHealth: 240, seed: 460 + i, ...landmark })),
]);

// buildings: false leaves the street and landmarks to a mode that draws them itself (evil mode).
export function drawPalmOasis(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((PALM_OASIS.from + PALM_OASIS.to) / 2, cameraX);
  const half = (PALM_OASIS.to - PALM_OASIS.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawFarDunes(g, left, right, seaY, cameraX);
  drawGrove(g, left, right, seaY, cameraX);
  const shift = mid - (PALM_OASIS.from + PALM_OASIS.to) / 2;
  drawPool(g, left, right, seaY, shift, elapsed);
  if (buildings) {
    for (const building of PALM_OASIS_BUILDINGS) {
      const at = nearest(building.x, cameraX);
      if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
      const y = oasisBase(building.x, seaY);
      building.draw(g, at, y, elapsed);
      building.fx?.(g, at, y, elapsed);
    }
  }
  for (const prop of OASIS_PROPS) {
    const at = prop.x + shift;
    if (at < left - 20 || at > right + 20) continue;
    drawProp(g, prop, at, oasisBase(prop.x, seaY) - SEA_Y_OFFSET + 1);
  }
}

function eachColumn(left, right, cameraX, parallax, draw) {
  const shift = (cameraX - nearest((PALM_OASIS.from + PALM_OASIS.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, PALM_OASIS.from, PALM_OASIS.to);
    if (fade <= 0) continue;
    draw(x, Math.round(wx / SKYLINE_STEP), ground, fade);
  }
}

// Far row: low pale dunes beyond the oasis.
function drawFarDunes(g, left, right, seaY, cameraX) {
  eachColumn(left, right, cameraX, FAR_PARALLAX, (x, seed, ground, fade) => {
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const h = Math.round((22 + 12 * Math.sin(seed * 0.5)) * CITY_SCALE);
    g.fillStyle(0xe4ccb0, fade);
    g.fillRect(x, y - h, SKYLINE_STEP, h);
  });
}

// Near row: the grove's flat palm crowns on bare trunks, one shade deeper, no detail.
function drawGrove(g, left, right, seaY, cameraX) {
  eachColumn(left, right, cameraX, NEAR_PARALLAX, (x, seed, ground, fade) => {
    if (hash(seed + 0.4) < 0.3) return;
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const tall = Math.round((34 + hash(seed + 0.7) * 22) * CITY_SCALE);
    // A leaning trunk under a crown of fronds drooping to either side.
    const cx = x + 12 + Math.round((hash(seed + 0.9) - 0.5) * 6);
    g.fillStyle(0xa8b8a0, fade);
    g.fillTriangle(x + 11, y, x + 14, y, cx + 1, y - tall);
    g.fillTriangle(cx, y - tall - 3, cx - 16, y - tall + 9, cx - 4, y - tall + 2);
    g.fillTriangle(cx, y - tall - 3, cx + 17, y - tall + 9, cx + 4, y - tall + 2);
    g.fillTriangle(cx - 2, y - tall - 4, cx - 11, y - tall - 6, cx - 9, y - tall);
    g.fillTriangle(cx + 2, y - tall - 4, cx + 11, y - tall - 6, cx + 9, y - tall);
  });
}
