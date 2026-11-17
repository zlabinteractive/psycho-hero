import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';
import { drawPalm } from './golden-beach-art.js';

// Sandport, Sunland's sun-baked port town behind Golden Beach, built to the same rules as Green City
// (game-design-rules/city-design-rules.md). Two flat parallax rows of flat roofs, with now and then a
// dome, sit behind a destructible street of whitewashed cube houses with water tanks,
// two-storey sandstone houses with shuttered windows and roof terraces, shops under canvas awnings
// and, in the middle of town, tall merchants' houses, all in one muted whitewash-and-sandstone theme
// with weathered teal shutters. The landmarks have their own palettes and detail: the old Sea Fort
// with its battlements and flag, the Spice Market under striped canvas, the domed Sandport Museum
// behind its arcade, the Sun Tower (the signature: a slender stone tower crowned with a golden sun
// disc, topping everything in town), and the Caravan Gate where the road leaves for the Red Dunes.
// Everything that can break is listed once in SANDPORT_BUILDINGS, so evil mode can promote it.
export const SANDPORT = { from: 25900, to: 27400 };
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 30;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
// Over the last TOWN_EDGE px the street thins and drops, so the town never ends as a wall.
const TOWN_EDGE = 200;
// Tall merchants' houses gather downtown, round the museum and the Sun Tower.
const DOWNTOWN = [26600, 27120];

// The street theme: whitewash, sandstone, weathered teal shutters (detail means foreground).
const WHITEWASH = [0xe8e2d4, 0xe2dccc, 0xebe5d8];
const SANDSTONE = [0xd2b48a, 0xc8aa80, 0xd8bc94];
const TEAL = 0x5f7f8a;
const TEAL_DARK = 0x4a6670;
const SILL = 0xf0ebe0;
const SHADOW = 0x3e3a34;
const TANK = 0x9aa0a4;
const AWNING = [0xc9b48a, 0xb8a07a];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building, where building-destruction.js bakes it too.
export function sandportBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the street leaves free. width/height: hit box once promoted.
// fx draws animated parts (the fort's flag, the sun disc's glint) in free roam only.
const LANDMARK_ART = [
  { id: 'sandport-fort', x: 26090, door: true, draw: drawSeaFort, fx: fortFlagFx, clear: 52, width: 96, height: 64, maxHealth: 340 },
  { id: 'spice-market', x: 26410, door: true, draw: drawSpiceMarket, clear: 56, width: 104, height: 38, maxHealth: 200 },
  { id: 'sandport-museum', x: 26720, door: true, draw: drawMuseum, clear: 48, width: 88, height: 72, maxHealth: 300 },
  { id: 'sun-tower', x: 26990, door: true, draw: drawSunTower, fx: sunFx, clear: 26, width: 30, height: 186, maxHealth: 360 },
  { id: 'caravan-gate', x: 27310, draw: drawCaravanGate, clear: 32, width: 58, height: 64, maxHealth: 260 },
];
export const SANDPORT_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// Free stretches of street: the town minus each landmark's clear space.
function streetSpans() {
  const cuts = SANDPORT_LANDMARKS.filter(l => !l.open).map(l => [l.x - l.clear, l.x + l.clear]).sort((a, b) => a[0] - b[0]);
  const spans = [];
  let start = SANDPORT.from;
  for (const [a, b] of [...cuts, [SANDPORT.to, SANDPORT.to]]) {
    if (a - start > 30) spans.push([start, a]);
    start = Math.max(start, b);
  }
  return spans;
}

// Street: whitewashed cube houses (kind 0), sandstone houses (1), shops (2) and, downtown, tall
// merchants' houses (3), packed along each free span with the odd empty lot. Fewer and lower toward
// the town's ends.
const KINDS = ['whitewash', 'sandstone', 'shop', 'merchant'];
// A fixed mix of the three common kinds, so no stretch of street runs to one kind.
const STREET_MIX = [0, 1, 2, 0, 1, 1, 0, 2, 1, 0];
function streetBuildings() {
  const buildings = [];
  let i = 0;
  for (const [from, to] of streetSpans()) {
    for (let bx = from + 6; ; i++) {
      const seed = i + 0.29;
      const art = 24 + Math.round(hash(seed + 0.2) * 10);
      const width = art * CITY_SCALE;
      const centre = bx + width / 2;
      if (bx + width > to - 6) break;
      bx += width + 2 + Math.round(hash(seed + 0.5) * 4);
      const taper = Math.min(1, Math.min(centre - SANDPORT.from, SANDPORT.to - centre) / TOWN_EDGE);
      if (hash(seed) < 0.06 + 0.25 * (1 - taper)) continue;
      const downtown = centre > DOWNTOWN[0] && centre < DOWNTOWN[1];
      const roll = hash(i * 7.31 + 0.11);
      const kind = downtown && taper === 1 && roll < 0.4 ? 3 : STREET_MIX[i % STREET_MIX.length];
      const full = [36, 50, 30, 70][kind] + Math.round(hash(seed + 0.3) * [8, 12, 6, 14][kind]);
      const height = Math.max(26, Math.round(full * (0.45 + 0.55 * taper)));
      const wall = kind === 0 || kind === 2 && hash(seed + 0.8) < 0.5 ? WHITEWASH : SANDSTONE;
      const paint = wall[Math.floor(hash(seed + 0.4) * wall.length)];
      const look = hash(seed + 0.6);
      buildings.push({
        id: `sandport-${i}`, seed, kind: KINDS[kind], x: centre, width,
        height: (height + 10) * CITY_SCALE, roof: (height + 1) * CITY_SCALE,
        maxHealth: kind === 3 ? 160 : 120, door: true,
        draw: scaled((g, at, y) => drawStreetBuilding(g, at - art / 2, y, art, height, kind, paint, look)),
      });
    }
  }
  return buildings;
}

// Accents shared by street and landmarks: terracotta, saffron, a deep painted blue, timber, and the
// greens and pinks of potted plants and bougainvillea.
const TERRACOTTA = 0xb8604a;
const SAFFRON = 0xd9a83a;
const CREAM = 0xece4d2;
const DOOR_BLUE = 0x3f6f9a;
const FRAME_BLUE = 0x5a86a8;
const TIMBER = 0x7a5a40;
const TIMBER_DARK = 0x5a4230;
const LEAF = 0x6a8a4a;
const LEAF_DARK = 0x4f6e3a;
const BLOOM = 0xc8508a;
const IRON = 0x3a3530;
const AWNINGS = [[TERRACOTTA, CREAM], [TEAL, CREAM], [SAFFRON, CREAM]];

// A shuttered window: a dark opening with teal shutters folded back each side.
function shutters(g, x, y, w, h, open) {
  g.fillStyle(SHADOW);
  g.fillRect(x, y, w, h);
  g.fillStyle(open ? TEAL : TEAL_DARK);
  if (open) {
    g.fillRect(x - 2, y, 2, h);
    g.fillRect(x + w, y, 2, h);
  } else {
    g.fillRect(x, y, w, h);
    g.fillStyle(TEAL);
    for (let sy = y + 1; sy < y + h; sy += 2) g.fillRect(x, sy, w, 1);
  }
  g.fillStyle(SILL);
  g.fillRect(x - 1, y + h, w + 2, 1);
}

// An arched opening: a rectangle under a round head.
function arch(g, x, y, w, h, color) {
  g.fillStyle(color);
  g.fillRect(x, y + w / 2, w, h - w / 2);
  g.fillCircle(x + w / 2, y + w / 2, w / 2);
}

// An arched window in a painted frame, with a sill.
function archWindow(g, x, y, w, h, frame) {
  arch(g, x - 1, y - 1, w + 2, h + 1, frame);
  arch(g, x, y, w, h, SHADOW);
  g.fillStyle(SILL);
  g.fillRect(x - 1, y + h, w + 2, 1);
}

// Zellige: a two-px band of teal tiles checkered with cream, a terracotta tile every so often.
function tileBand(g, x, y, w) {
  g.fillStyle(TEAL);
  g.fillRect(x, y, w, 2);
  for (let i = 0; i < w; i += 2) {
    g.fillStyle(i % 8 === 4 ? TERRACOTTA : 0xe8d8a8);
    g.fillRect(x + i, y + (i / 2) % 2, 1, 1);
  }
}

// Stepped Moorish merlons along a parapet.
function merlons(g, x, top, w, color) {
  g.fillStyle(color);
  for (let bx = x; bx + 3 <= x + w; bx += 5) {
    g.fillRect(bx, top - 2, 3, 2);
    g.fillRect(bx + 1, top - 3, 1, 1);
  }
}

// A wooden lattice balcony (mashrabiya) on a carved corbel.
function mashrabiya(g, cx, y, w, h) {
  const x = Math.round(cx - w / 2);
  g.fillStyle(TIMBER_DARK);
  g.fillTriangle(x + 2, y + h, x + w - 2, y + h, cx, y + h + 3);
  g.fillStyle(TIMBER);
  g.fillRect(x, y, w, h);
  g.fillStyle(TIMBER_DARK);
  for (let ly = y + 2; ly < y + h - 1; ly += 2) {
    for (let lx = x + 1 + ((ly - y) / 2) % 2; lx < x + w - 1; lx += 2) g.fillRect(lx, ly, 1, 1);
  }
  g.fillStyle(lerpColor(TIMBER, 0xffffff, 0.18));
  g.fillRect(x - 1, y - 1, w + 2, 2);
  g.fillRect(x - 1, y + h - 1, w + 2, 1);
}

// Bougainvillea climbing a wall from the ground, spilling over at the top.
function bougainvillea(g, x, y, h) {
  g.fillStyle(0x5a4a30);
  g.fillRect(x, y - h, 1, h);
  for (let i = 2; i < h; i += 3) {
    const left = Math.floor(i / 3) % 2 === 0;
    g.fillStyle(i % 2 ? LEAF : LEAF_DARK);
    g.fillRect(x + (left ? -2 : 1), y - i - 2, 2, 2);
    g.fillStyle(BLOOM);
    g.fillRect(x + (left ? -2 : 2), y - i - 2, 1, 1);
  }
  g.fillStyle(LEAF_DARK);
  g.fillRect(x - 3, y - h - 1, 7, 3);
  g.fillStyle(BLOOM);
  for (const [bx, by] of [[-3, -1], [-1, 0], [1, -1], [3, 0], [0, 1]]) g.fillRect(x + bx, y - h + by, 1, 1);
}

// A potted plant on a sill or a roof.
function pot(g, x, y, big) {
  g.fillStyle(big ? LEAF_DARK : LEAF);
  g.fillRect(x, y - (big ? 5 : 3), big ? 4 : 3, big ? 3 : 2);
  g.fillStyle(TERRACOTTA);
  g.fillRect(x, y - 2, big ? 4 : 3, 2);
}

// A wind tower (badgir) catching the breeze above the roof, 8 px tall.
function windTower(g, x, top, paint) {
  g.fillStyle(paint);
  g.fillRect(x, top - 8, 7, 8);
  g.fillStyle(lerpColor(paint, 0x000000, 0.14));
  g.fillRect(x + 5, top - 8, 2, 8);
  g.fillStyle(SHADOW);
  g.fillRect(x + 1, top - 6, 1, 4);
  g.fillRect(x + 3, top - 6, 1, 4);
  g.fillStyle(lerpColor(paint, 0xffffff, 0.22));
  g.fillRect(x - 1, top - 9, 9, 1);
  g.fillStyle(TIMBER_DARK);
  g.fillRect(x + 1, top - 10, 1, 1);
  g.fillRect(x + 5, top - 10, 1, 1);
}

function drawStreetBuilding(g, x, y, width, height, kind, paint, look) {
  const top = y - height;
  const door = Math.round(x + width / 2);
  const shade = lerpColor(paint, 0x000000, 0.1);
  const light = lerpColor(paint, 0xffffff, 0.2);
  const right = x + width;
  g.fillStyle(paint);
  g.fillRect(x, top, width, height);
  g.fillStyle(shade);
  g.fillRect(right - 3, top, 3, height);
  g.fillStyle(light);
  g.fillRect(x, top, 1, height);
  if (kind === 0) {
    // Whitewashed cube: a blue-painted plinth, softened parapet, small arched windows in blue frames
    // with pots on the sills, bougainvillea up one corner, and a stair hut on the roof under a blue
    // dome, or a water tank.
    g.fillStyle(0x9ab4c4);
    g.fillRect(x, y - 3, width, 3);
    g.fillStyle(light);
    g.fillRect(x, top - 2, width, 2);
    g.fillRect(x + 1, top - 3, width - 2, 1);
    const hut = look < 0.5 ? x + 3 : right - 13;
    if (look < 0.3 || look > 0.7) {
      g.fillStyle(paint);
      g.fillRect(hut, top - 7, 10, 5);
      g.fillStyle(shade);
      g.fillRect(hut + 8, top - 7, 2, 5);
      g.fillStyle(DOOR_BLUE);
      g.fillRect(hut + 2, top - 6, 2, 4);
      g.fillCircle(hut + 5, top - 7, 3.5);
      g.fillStyle(0x6a92b4);
      g.fillRect(hut + 3, top - 9, 2, 1);
      g.fillStyle(0xd9c27a);
      g.fillRect(hut + 5, top - 12, 1, 2);
    } else {
      g.fillStyle(TANK);
      g.fillRect(hut + 1, top - 9, 8, 6);
      g.fillStyle(lerpColor(TANK, 0x000000, 0.2));
      g.fillRect(hut + 1, top - 6, 8, 1);
      g.fillRect(hut + 2, top - 3, 1, 1);
      g.fillRect(hut + 7, top - 3, 1, 1);
    }
    for (let wy = top + 5, row = 0; wy < y - 20; wy += 12, row++) {
      archWindow(g, x + 4, wy, 4, 6, FRAME_BLUE);
      archWindow(g, right - 10, wy, 4, 6, FRAME_BLUE);
      if (width >= 28 && row > 0) archWindow(g, door - 2, wy, 4, 6, FRAME_BLUE);
      pot(g, (look + row * 0.5) % 1 < 0.5 ? x + 4 : right - 10, wy + 6, false);
    }
    bougainvillea(g, look < 0.5 ? right - 5 : x + 3, y - 1, Math.min(height - 5, 24));
  } else if (kind === 2) {
    // Shop: a dark open front under a striped, scalloped awning, a hanging rug and baskets one side,
    // pots and a fruit crate the other, a brass lantern, a painted sign board, a window above.
    const [stripe, ground] = AWNINGS[Math.floor(look * AWNINGS.length)];
    g.fillStyle(SHADOW);
    g.fillRect(x + 2, y - 15, width - 5, 15);
    g.fillStyle(lerpColor(SHADOW, paint, 0.25));
    g.fillRect(x + 2, y - 15, width - 5, 2);
    // Hanging rug and a basket.
    g.fillStyle(look < 0.5 ? 0x9a3a32 : 0x3e5a7a);
    g.fillRect(x + 3, y - 13, 5, 8);
    g.fillStyle(0xe0c890);
    g.fillRect(x + 3, y - 13, 5, 1);
    g.fillRect(x + 5, y - 10, 1, 2);
    g.fillRect(x + 4, y - 9, 3, 1);
    g.fillStyle(0xb8955a);
    g.fillRect(x + 3, y - 4, 5, 4);
    g.fillStyle(0x9a7a48);
    g.fillRect(x + 3, y - 2, 5, 1);
    // A pot and a crate of oranges or melons.
    g.fillStyle(0x8a6a4c);
    g.fillRect(right - 10, y - 5, 6, 5);
    g.fillStyle(look < 0.5 ? 0xe08a30 : 0x8a9a5a);
    for (let fx = right - 10; fx < right - 4; fx += 2) g.fillRect(fx, y - 6, 1, 1);
    g.fillStyle(TERRACOTTA);
    g.fillRect(right - 13, y - 4, 2, 4);
    g.fillRect(right - 14, y - 3, 4, 2);
    // Awning: stripes, then a scalloped valance, jutting out a little.
    for (let ax = x; ax < right + 1; ax += 2) {
      g.fillStyle(((ax - x) / 2) % 2 ? ground : stripe);
      g.fillRect(ax, y - 20, 2, 5);
    }
    g.fillStyle(stripe);
    for (let ax = x + 1; ax < right; ax += 4) g.fillCircle(ax + 1, y - 15, 1.5);
    g.fillStyle(lerpColor(stripe, 0x000000, 0.2));
    g.fillRect(x, y - 20, width + 1, 1);
    // Lantern under the awning by the door.
    g.fillStyle(0x5a4a38);
    g.fillRect(door + 6, y - 14, 1, 2);
    g.fillStyle(0xb8903a);
    g.fillRect(door + 5, y - 12, 3, 3);
    g.fillStyle(0xf0dca0);
    g.fillRect(door + 6, y - 11, 1, 1);
    // Sign board with painted lettering.
    g.fillStyle(TIMBER);
    g.fillRect(x + 4, y - 25, width - 9, 4);
    g.fillStyle(0xe8d8a8);
    for (let lx = x + 6; lx < right - 6; lx += 2) g.fillRect(lx, y - 24 + (lx % 3 === 0 ? 1 : 0), 1, 1);
    if (height >= 35) {
      shutters(g, door - 3, top + 4, 6, 6, look > 0.3);
      pot(g, door - 3, top + 10, false);
    }
    g.fillStyle(light);
    g.fillRect(x - 1, top - 2, width + 2, 2);
  } else {
    // Sandstone or merchant's house: ashlar courses, quoins, arched-hooded shuttered windows, a tile
    // frieze under stepped merlons, grilled windows by the door, and on the roof potted plants, a
    // pergola or (merchants) a wind tower. Merchants add a lattice balcony over the door.
    const merchant = kind === 3;
    g.fillStyle(lerpColor(paint, 0x000000, 0.05));
    for (let cy = y - 4; cy > top + 2; cy -= 5) g.fillRect(x + 1, cy, width - 4, 1);
    g.fillStyle(light);
    for (let qy = y - 5, i = 0; qy > top + 3; qy -= 5, i++) {
      g.fillRect(x, qy, i % 2 ? 2 : 3, 4);
      if (merchant) g.fillRect(right - (i % 2 ? 2 : 3), qy, i % 2 ? 2 : 3, 4);
    }
    g.fillStyle(shade);
    g.fillRect(x, y - 3, width, 3);
    const rows = [];
    for (let wy = top + 7; wy < y - 21; wy += 13) rows.push(wy);
    rows.forEach((wy, row) => {
      for (const [wx, open] of [[x + 5, (look * 7 + row) % 2 < 1], [right - 11, (look * 5 + row) % 2 >= 1]]) {
        g.fillStyle(light);
        g.fillRect(wx - 1, wy - 2, 7, 1);
        g.fillRect(wx, wy - 3, 5, 1);
        shutters(g, wx, wy, 5, 7, open);
      }
      if (merchant && row === rows.length - 1) mashrabiya(g, door, wy - 1, 12, 10);
      else if (merchant && width >= 30) archWindow(g, door - 2, wy + 1, 4, 6, light);
    });
    // Grilled windows each side of the door.
    for (const wx of width >= 28 ? [x + 4, right - 10] : []) {
      g.fillStyle(SHADOW);
      g.fillRect(wx, y - 13, 5, 6);
      g.fillStyle(IRON);
      g.fillRect(wx + 1, y - 13, 1, 6);
      g.fillRect(wx + 3, y - 13, 1, 6);
      g.fillRect(wx, y - 11, 5, 1);
      g.fillStyle(SILL);
      g.fillRect(wx - 1, y - 7, 7, 1);
    }
    tileBand(g, x, top + 2, width);
    g.fillStyle(light);
    g.fillRect(x - 1, top - 1, width + 2, 1);
    merlons(g, x, top - 1, width, light);
    if (merchant && look > 0.5) {
      windTower(g, right - 11, top - 1, paint);
      pot(g, x + 3, top - 1, true);
    } else if (look < 0.4) {
      // A pergola with a vine over the terrace.
      g.fillStyle(TIMBER_DARK);
      g.fillRect(x + 5, top - 8, 1, 7);
      g.fillRect(right - 8, top - 8, 1, 7);
      g.fillRect(x + 4, top - 8, width - 10, 1);
      g.fillStyle(LEAF);
      for (let vx = x + 5; vx < right - 7; vx += 3) g.fillRect(vx, top - 10 + (vx % 2), 2, 2);
      g.fillStyle(BLOOM);
      g.fillRect(x + 8, top - 9, 1, 1);
    } else {
      pot(g, x + 3, top - 1, false);
      pot(g, right - 8, top - 1, true);
    }
  }
  // Every street building has a centred, arched door people walk in and out of.
  const leaf = kind === 0 ? DOOR_BLUE : look < 0.5 ? TEAL_DARK : TIMBER;
  g.fillStyle(light);
  g.fillRect(door - 5, y - 16, 10, 16);
  g.fillCircle(door, y - 11, 5);
  arch(g, door - 4, y - 15, 8, 15, leaf);
  g.fillStyle(lerpColor(leaf, 0x000000, 0.25));
  g.fillRect(door, y - 11, 1, 11);
  g.fillStyle(0xd9c27a);
  g.fillRect(door + 2, y - 7, 1, 1);
  g.fillRect(door - 3, y - 7, 1, 1);
  g.fillStyle(lerpColor(paint, 0x000000, 0.18));
  g.fillRect(door - 6, y - 1, 12, 1);
}

// The Sea Fort: a sandstone curtain wall on a battered plinth between two round-shouldered towers,
// machicolations under every parapet, a taller keep behind with the flag (fortFlagFx), cross-shaped
// arrow slits, weathered ashlar, and the pointed gate (the door) under banded voussoirs with its
// portcullis raised and studded timber leaves standing open. A bronze cannon on its carriage points
// out to sea from the west tower.
const FORT = 0xc9a06a;
const FORT_SHADE = 0xb08850;
const FORT_LIGHT = 0xdab47e;
const FORT_DARK = 0x4a3e30;
const FORT_TOP = 62;
function battlements(g, left, top, width) {
  // Corbels (machicolations) under a projecting parapet, then merlons.
  g.fillStyle(FORT_SHADE);
  for (let bx = left; bx < left + width; bx += 3) g.fillRect(bx, top + 2, 2, 2);
  g.fillStyle(FORT_LIGHT);
  g.fillRect(left - 1, top, width + 2, 2);
  g.fillStyle(FORT);
  for (let bx = left - 1; bx < left + width; bx += 4) g.fillRect(bx, top - 3, 2, 3);
  g.fillStyle(FORT_LIGHT);
  for (let bx = left - 1; bx < left + width; bx += 4) g.fillRect(bx, top - 3, 2, 1);
}
function crossSlit(g, x, y) {
  g.fillStyle(FORT_DARK);
  g.fillRect(x, y, 1, 7);
  g.fillRect(x - 1, y + 2, 3, 1);
}
function drawSeaFort(g, x, y) {
  // Keep, behind, with arched windows.
  g.fillStyle(FORT_SHADE);
  g.fillRect(x - 14, y - 50, 28, 50);
  g.fillStyle(lerpColor(FORT_SHADE, 0x000000, 0.1));
  g.fillRect(x + 10, y - 50, 4, 50);
  battlements(g, x - 14, y - 50, 28);
  arch(g, x - 6, y - 45, 3, 7, FORT_DARK);
  arch(g, x + 3, y - 45, 3, 7, FORT_DARK);
  // Curtain wall: ashlar with weathered stones, a battered plinth.
  g.fillStyle(FORT);
  g.fillRect(x - 40, y - 30, 80, 30);
  for (let row = 0; row < 7; row++) {
    g.fillStyle(FORT_SHADE);
    g.fillRect(x - 40, y - 26 + row * 4, 80, 1);
    for (let bx = x - 40 + (row % 2) * 4; bx < x + 40; bx += 8) {
      g.fillStyle(FORT_SHADE);
      g.fillRect(bx, y - 29 + row * 4, 1, 3);
      const weather = hash(row * 13.7 + bx * 0.31);
      if (weather < 0.18) {
        g.fillStyle(weather < 0.09 ? FORT_LIGHT : lerpColor(FORT, FORT_SHADE, 0.5));
        g.fillRect(bx + 1, y - 29 + row * 4, 7, 3);
      }
    }
  }
  g.fillStyle(FORT_SHADE);
  g.fillTriangle(x - 42, y, x - 40, y - 7, x - 40, y);
  g.fillTriangle(x + 42, y, x + 40, y - 7, x + 40, y);
  g.fillRect(x - 40, y - 4, 80, 4);
  g.fillStyle(FORT_LIGHT);
  g.fillRect(x - 40, y - 5, 80, 1);
  battlements(g, x - 40, y - 30, 80);
  // Towers each end, a little taller, shaded round, on battered feet.
  for (const tx of [x - 48, x + 32]) {
    g.fillStyle(FORT);
    g.fillRect(tx, y - 40, 16, 40);
    g.fillStyle(FORT_LIGHT);
    g.fillRect(tx, y - 40, 3, 40);
    g.fillStyle(FORT_SHADE);
    g.fillRect(tx + 12, y - 40, 4, 40);
    g.fillStyle(lerpColor(FORT_SHADE, 0x000000, 0.1));
    g.fillRect(tx + 15, y - 40, 1, 40);
    g.fillStyle(FORT_SHADE);
    for (let ry = y - 35; ry < y - 6; ry += 5) g.fillRect(tx + 3, ry, 9, 1);
    g.fillRect(tx - 2, y - 6, 20, 6);
    g.fillTriangle(tx - 2, y - 6, tx, y - 10, tx, y - 6);
    g.fillTriangle(tx + 18, y - 6, tx + 16, y - 10, tx + 16, y - 6);
    g.fillStyle(FORT_LIGHT);
    g.fillRect(tx - 2, y - 7, 20, 1);
    battlements(g, tx, y - 40, 16);
    crossSlit(g, tx + 7, y - 33);
    crossSlit(g, tx + 7, y - 20);
  }
  for (const sx of [x - 30, x - 20, x + 19, x + 29]) crossSlit(g, sx, y - 23);
  // Gate: a pointed arch under banded voussoirs, portcullis raised, timber leaves folded open.
  g.fillStyle(FORT_LIGHT);
  g.fillRect(x - 10, y - 24, 20, 24);
  g.fillTriangle(x - 10, y - 24, x, y - 31, x + 10, y - 24);
  for (let i = 0; i < 7; i++) {
    g.fillStyle(i % 2 ? TERRACOTTA : 0xe8d0a0);
    const a = Math.PI + (i + 0.5) / 7 * Math.PI;
    g.fillRect(Math.round(x + Math.cos(a) * 9) - 1, Math.round(y - 17 + Math.sin(a) * 9), 2, 2);
  }
  g.fillStyle(0x3a3028);
  g.fillRect(x - 7, y - 16, 14, 16);
  g.fillTriangle(x - 7, y - 16, x, y - 23, x + 7, y - 16);
  g.fillStyle(IRON);
  g.fillRect(x - 6, y - 17, 12, 1);
  for (let px = x - 6; px < x + 7; px += 3) g.fillRect(px, y - 17, 1, 3);
  g.fillStyle(0x6a4e36);
  g.fillRect(x - 10, y - 15, 3, 15);
  g.fillRect(x + 7, y - 15, 3, 15);
  g.fillStyle(0x9a8a6a);
  for (let sy = y - 13; sy < y; sy += 3) {
    g.fillRect(x - 9, sy, 1, 1);
    g.fillRect(x + 8, sy, 1, 1);
  }
  // A tiled plaque over the gate.
  g.fillStyle(0xe6cc98);
  g.fillRect(x - 6, y - 29, 12, 4);
  tileBand(g, x - 5, y - 28, 10);
  // Cannon on its carriage atop the seaward tower, pointing west.
  g.fillStyle(0x6a5a3a);
  g.fillRect(x - 58, y - 45, 13, 3);
  g.fillRect(x - 59, y - 46, 2, 5);
  g.fillStyle(0x8a7448);
  g.fillRect(x - 56, y - 45, 9, 1);
  g.fillStyle(TIMBER_DARK);
  g.fillRect(x - 48, y - 43, 6, 2);
  g.fillStyle(0x3a3028);
  g.fillCircle(x - 45, y - 43, 2);
  // Flagpole on the keep.
  g.fillStyle(0x5a5650);
  g.fillRect(x, y - FORT_TOP, 1, 12);
  g.fillStyle(GOLD);
  g.fillRect(x, y - FORT_TOP - 1, 1, 1);
}

// Sunland's flag: a sun-gold field with a terracotta band, rippling.
function fortFlagFx(g, x, y, elapsed) {
  const top = y - FORT_TOP;
  for (let i = 0; i < 10; i++) {
    const wave = Math.round(Math.sin(elapsed * 5 - i * 0.7) * (i / 10) * 1.5);
    g.fillStyle(0xd9a83a);
    g.fillRect(x + 1 + i, top + wave, 1, 2);
    g.fillStyle(0xb8604a);
    g.fillRect(x + 1 + i, top + 2 + wave, 1, 2);
    g.fillStyle(0xd9a83a);
    g.fillRect(x + 1 + i, top + 4 + wave, 1, 2);
  }
}

// The Spice Market: a long arcade before a tiled back wall of blind arches, under three striped
// canvas roofs with scalloped valances on turned posts, bunting strung between them, stalls heaped
// with spice in sacks and cones, carpets hung on the centre bay, baskets and jars, brass lanterns,
// and an arched entry at the centre (the door).
const SPICES = [0xd9a83a, 0xb8503a, 0xc9802e, 0x7a8a4a, 0x8a4a3a, 0xe0c060];
const CANVAS = [[0xb8604a, 0xece4d2], [0xd9a83a, 0xece4d2], [0x4f7a86, 0xece4d2]];
const CARPETS = [0x9a3a32, 0x3e5a7a, 0x8a5a2a];
function drawSpiceMarket(g, x, y) {
  const left = x - 52;
  // Back wall: blind arches over a tile dado.
  g.fillStyle(0xc8aa80);
  g.fillRect(left + 2, y - 26, 100, 26);
  g.fillStyle(0xb89a70);
  for (let ax = left + 5; ax < left + 99; ax += 9) arch(g, ax, y - 23, 6, 14, 0xb89a70);
  tileBand(g, left + 2, y - 9, 100);
  g.fillStyle(0x8a7258);
  g.fillRect(left, y - 2, 104, 2);
  // Three canvas roofs on posts, each with a lantern.
  for (let bay = 0; bay < 3; bay++) {
    const bx = left + bay * 35;
    const [a, b] = CANVAS[bay];
    for (let i = 0; i < 17; i++) {
      const sag = Math.round(Math.sin(i / 16 * Math.PI) * 2);
      g.fillStyle(i % 2 ? b : a);
      g.fillRect(bx + i * 2, y - 35 + sag, 2, 6);
      g.fillStyle(a);
      g.fillCircle(bx + i * 2 + 1, y - 29 + sag, i % 2 ? 0.6 : 1.2);
    }
    g.fillStyle(lerpColor(a, 0x000000, 0.2));
    for (let i = 0; i < 17; i++) g.fillRect(bx + i * 2, y - 35 + Math.round(Math.sin(i / 16 * Math.PI) * 2), 2, 1);
    g.fillStyle(TIMBER_DARK);
    g.fillRect(bx, y - 35, 1, 35);
    g.fillRect(bx + 33, y - 35, 1, 35);
    g.fillStyle(TIMBER);
    g.fillRect(bx - 1, y - 20, 3, 1);
    g.fillRect(bx + 32, y - 20, 3, 1);
    g.fillStyle(0xb8903a);
    g.fillRect(bx + 16, y - 28, 1, 2);
    g.fillRect(bx + 15, y - 26, 3, 3);
    g.fillStyle(0xf0dca0);
    g.fillRect(bx + 16, y - 25, 1, 1);
    if (bay === 1) {
      // Carpets hung either side of the entry.
      for (const [cx, c] of [[bx + 3, CARPETS[0]], [bx + 24, CARPETS[1]]]) {
        g.fillStyle(c);
        g.fillRect(cx, y - 22, 7, 16);
        g.fillStyle(0xe0c890);
        g.fillRect(cx, y - 22, 7, 1);
        g.fillRect(cx, y - 7, 7, 1);
        g.fillRect(cx + 3, y - 17, 1, 6);
        g.fillRect(cx + 2, y - 15, 3, 2);
        g.fillStyle(lerpColor(c, 0x000000, 0.25));
        g.fillRect(cx + 1, y - 20, 1, 12);
        g.fillRect(cx + 5, y - 20, 1, 12);
      }
      continue;
    }
    // Stall counter with sacks and spice cones, jars and a basket.
    g.fillStyle(0x8a6a4c);
    g.fillRect(bx + 3, y - 10, 28, 8);
    g.fillStyle(0x6a5038);
    g.fillRect(bx + 3, y - 10, 28, 1);
    g.fillRect(bx + 3, y - 6, 28, 1);
    for (let s = 0; s < 5; s++) {
      const sx = bx + 4 + s * 5 + (bay ? 1 : 0);
      g.fillStyle(0xd8c8a0);
      g.fillRect(sx, y - 14, 4, 4);
      g.fillStyle(0xc0ae86);
      g.fillRect(sx, y - 12, 4, 1);
      g.fillStyle(SPICES[(s + bay * 2) % SPICES.length]);
      g.fillTriangle(sx, y - 14, sx + 2, y - 17, sx + 4, y - 14);
    }
    g.fillStyle(0x8a4a3a);
    g.fillRect(bx + 6, y - 28, 1, 5);
    g.fillRect(bx + 26, y - 28, 1, 4);
    g.fillStyle(0x7a8a4a);
    g.fillRect(bx + 5, y - 24, 3, 2);
    g.fillStyle(0xb8955a);
    g.fillRect(bx + 31, y - 5, 5, 3);
    g.fillStyle(TERRACOTTA);
    g.fillRect(bx + 1, y - 5, 2, 3);
  }
  // Bunting between the posts.
  for (let i = 0; i < 26; i++) {
    const px = left + 2 + i * 4;
    const sag = Math.round(Math.sin((i % 9) / 8 * Math.PI) * 2);
    g.fillStyle(SPICES[i % SPICES.length]);
    g.fillTriangle(px, y - 37 + sag, px + 3, y - 37 + sag, px + 1.5, y - 34 + sag);
  }
  // Centre bay: the arched entry, a person tall, under a tiled sign.
  g.fillStyle(0xe6d2a8);
  g.fillRect(x - 9, y - 22, 18, 22);
  g.fillCircle(x, y - 15, 9);
  arch(g, x - 6, y - 19, 12, 19, 0x3e3428);
  g.fillStyle(0x4f7a86);
  g.fillRect(x - 8, y - 27, 16, 4);
  g.fillStyle(0xe8d8a8);
  for (let sx = x - 6; sx < x + 7; sx += 2) g.fillRect(sx, y - 26 + (sx % 2), 1, 1);
}

// Sandport Museum: a pale stone hall behind an arcade of five horseshoe arches on slim columns, a
// tiled frieze and a cornice of stepped merlons, a ribbed terracotta dome lit from the left on a drum
// ringed with arched windows, a gilt finial, palms in tubs, and broad steps up to the central door.
const MUSEUM = 0xe6dcc8;
const MUSEUM_SHADE = 0xd2c6ae;
const MUSEUM_LIGHT = 0xf2ece0;
const DOME = 0xc98a5a;
const DOME_DARK = 0xa86e46;
const DOME_LIGHT = 0xdaa070;
function drawMuseum(g, x, y) {
  const w = 84;
  const left = x - w / 2;
  // Hall, frieze and cornice.
  g.fillStyle(MUSEUM);
  g.fillRect(left, y - 34, w, 34);
  g.fillStyle(MUSEUM_SHADE);
  g.fillRect(left + w - 4, y - 34, 4, 34);
  g.fillStyle(MUSEUM_LIGHT);
  g.fillRect(left, y - 34, 2, 34);
  tileBand(g, left, y - 32, w);
  g.fillStyle(0xb0a48c);
  for (let lx = left + 6; lx < left + w - 6; lx += 3) g.fillRect(lx, y - 29, 2, 1);
  g.fillStyle(MUSEUM_LIGHT);
  g.fillRect(left - 2, y - 36, w + 4, 3);
  merlons(g, left - 2, y - 36, w + 4, MUSEUM_LIGHT);
  // Arcade: five horseshoe arches on columns, the middle one the door.
  for (let i = 0; i < 5; i++) {
    const ax = left + 6 + i * 16;
    const deep = i === 2 ? 0x4a4038 : 0x8a8070;
    g.fillStyle(deep);
    g.fillCircle(ax + 5, y - 20, 6);
    g.fillRect(ax, y - 20, 10, 16);
    g.fillStyle(MUSEUM);
    g.fillRect(ax - 1, y - 14, 1, 10);
    g.fillRect(ax + 10, y - 14, 1, 10);
    if (i !== 2) {
      g.fillStyle(0xb0a48c);
      g.fillRect(ax + 2, y - 14, 6, 10);
      g.fillStyle(i % 2 ? 0x8a6a4c : 0x6a8a9a);
      g.fillRect(ax + 4, y - 12, 2, 4);
    }
  }
  for (let i = 0; i < 6; i++) {
    const cx = left + 2 + i * 16;
    g.fillStyle(MUSEUM_SHADE);
    g.fillRect(cx + 1, y - 22, 2, 18);
    g.fillStyle(MUSEUM_LIGHT);
    g.fillRect(cx, y - 23, 4, 2);
    g.fillRect(cx, y - 5, 4, 1);
  }
  // Steps and palm tubs.
  g.fillStyle(0xd8ccb4);
  g.fillRect(left + 2, y - 4, w - 4, 2);
  g.fillStyle(0xc8bca2);
  g.fillRect(left, y - 2, w, 2);
  for (const px of [left + 20, left + 60]) {
    g.fillStyle(TERRACOTTA);
    g.fillRect(px, y - 8, 4, 4);
    g.fillStyle(LEAF);
    g.fillRect(px - 2, y - 11, 8, 2);
    g.fillRect(px + 1, y - 13, 2, 3);
    g.fillStyle(LEAF_DARK);
    g.fillRect(px - 3, y - 10, 2, 1);
    g.fillRect(px + 5, y - 10, 2, 1);
  }
  // Drum with arched windows.
  g.fillStyle(MUSEUM);
  g.fillRect(x - 18, y - 46, 36, 10);
  g.fillStyle(MUSEUM_SHADE);
  g.fillRect(x + 14, y - 46, 4, 10);
  for (let wx = x - 14; wx < x + 15; wx += 7) arch(g, wx, y - 45, 3, 7, 0x6a8a9a);
  g.fillStyle(MUSEUM_LIGHT);
  g.fillRect(x - 20, y - 47, 40, 2);
  // Dome: stacked bands narrowing to a point, lit from the left, with ribs.
  for (let i = 0; i < 18; i++) {
    const t = i / 18;
    const half = Math.round(19 * Math.sqrt(1 - t * t));
    g.fillStyle(DOME);
    g.fillRect(x - half, y - 48 - i, half * 2, 1);
    g.fillStyle(DOME_LIGHT);
    g.fillRect(x - half, y - 48 - i, Math.max(1, Math.round(half * 0.5)), 1);
    g.fillStyle(DOME_DARK);
    g.fillRect(x + half - Math.max(1, Math.round(half * 0.3)), y - 48 - i, Math.max(1, Math.round(half * 0.3)), 1);
  }
  g.fillStyle(DOME_DARK);
  for (const rx of [-12, -6, 0, 6, 12]) {
    const h = Math.round(18 * Math.sqrt(1 - (rx / 19) ** 2));
    g.fillRect(x + rx, y - 48 - h, 1, h);
  }
  // Gilt finial: a ball on a spike.
  g.fillStyle(0xe8c070);
  g.fillRect(x - 1, y - 68, 2, 2);
  g.fillCircle(x, y - 69, 1.5);
  g.fillRect(x, y - 72, 1, 2);
}

// The Sun Tower: a slender stone shaft rising in three stages, each lit from the left with blind arch
// panels, a tile band and a corbelled balcony with a balustrade at its head, then an open belvedere
// of horseshoe arches under a gold-ribbed dome carrying the golden sun disc (its rays glint in
// sunFx). The tallest thing in Sandport.
const TOWER = 0xd8bc8a;
const TOWER_SHADE = 0xc0a272;
const TOWER_LIGHT = 0xead2a2;
const GOLD = 0xe0b040;
const SUN_Y = 176;
function drawSunTower(g, x, y) {
  const stages = [[13, 60], [11, 50], [9, 40]];
  let base = y;
  stages.forEach(([half, tall], stage) => {
    const top = base - tall;
    g.fillStyle(TOWER);
    g.fillRect(x - half, top, half * 2, tall);
    g.fillStyle(TOWER_LIGHT);
    g.fillRect(x - half, top, 2, tall);
    g.fillStyle(TOWER_SHADE);
    g.fillRect(x + half - 3, top, 3, tall);
    // Blind arch panels beside tall arched windows.
    for (let wy = top + 8; wy < base - 12; wy += 16) {
      g.fillStyle(TOWER_LIGHT);
      g.fillRect(x - 3, wy - 1, 6, 11);
      arch(g, x - 2, wy, 4, 9, 0x4a4038);
      if (half >= 11) {
        arch(g, x - half + 3, wy + 1, 3, 8, TOWER_SHADE);
        arch(g, x + half - 6, wy + 1, 3, 8, lerpColor(TOWER_SHADE, 0x000000, 0.08));
      }
    }
    tileBand(g, x - half, top + 5, half * 2);
    // Corbelled balcony with a balustrade at the stage's head.
    g.fillStyle(TOWER_SHADE);
    for (let bx = x - half - 1; bx < x + half + 1; bx += 3) g.fillRect(bx, top + 2, 2, 2);
    g.fillStyle(TOWER_LIGHT);
    g.fillRect(x - half - 2, top, half * 2 + 4, 2);
    g.fillStyle(TOWER_SHADE);
    for (let bx = x - half - 2; bx < x + half + 2; bx += 2) g.fillRect(bx, top - 3, 1, 3);
    g.fillStyle(TOWER_LIGHT);
    g.fillRect(x - half - 2, top - 4, half * 2 + 4, 1);
    if (stage === 0) {
      g.fillStyle(TOWER_SHADE);
      g.fillRect(x - half - 1, y - 3, half * 2 + 2, 3);
    }
    base = top;
  });
  // Belvedere: four slim columns and horseshoe arches under a gold-ribbed dome.
  const deck = base;
  g.fillStyle(0x4a4038);
  g.fillRect(x - 7, deck - 11, 14, 11);
  g.fillStyle(TOWER);
  for (const cx of [x - 8, x - 3, x + 2, x + 7]) g.fillRect(cx, deck - 12, 1, 12);
  g.fillStyle(TOWER_LIGHT);
  for (const cx of [x - 6, x - 1, x + 4]) {
    g.fillRect(cx, deck - 12, 3, 1);
    g.fillRect(cx - 1, deck - 11, 1, 1);
    g.fillRect(cx + 3, deck - 11, 1, 1);
  }
  g.fillRect(x - 9, deck - 14, 18, 2);
  for (let i = 0; i < 6; i++) {
    const half = Math.round(8 * Math.sqrt(1 - (i / 6) ** 2));
    g.fillStyle(i === 5 ? GOLD : TOWER_SHADE);
    g.fillRect(x - half, deck - 15 - i, half * 2, 1);
    g.fillStyle(GOLD);
    if (i < 5) {
      g.fillRect(x - Math.round(half * 0.5), deck - 15 - i, 1, 1);
      g.fillRect(x + Math.round(half * 0.5) - 1, deck - 15 - i, 1, 1);
    }
  }
  // Mast and the sun disc.
  g.fillStyle(0x8a7a5a);
  g.fillRect(x, deck - 24, 1, 6);
  g.fillStyle(GOLD);
  g.fillCircle(x, y - SUN_Y + 4, 5);
  g.fillStyle(0xf0d070);
  g.fillCircle(x - 1, y - SUN_Y + 3, 2);
  g.fillStyle(0xb88a2a);
  g.fillRect(x + 2, y - SUN_Y + 6, 2, 1);
  // Door at the foot, a person tall, arched, in a carved surround.
  g.fillStyle(TOWER_LIGHT);
  g.fillRect(x - 7, y - 17, 14, 17);
  g.fillCircle(x, y - 13, 7);
  arch(g, x - 4, y - 15, 8, 15, TIMBER);
  g.fillStyle(TIMBER_DARK);
  g.fillRect(x, y - 11, 1, 11);
  g.fillStyle(0xd9c27a);
  g.fillRect(x + 2, y - 7, 1, 1);
}

// The sun disc's rays turn slowly, glinting.
function sunFx(g, x, y, elapsed) {
  const cy = y - SUN_Y + 4;
  for (let i = 0; i < 8; i++) {
    const a = elapsed * 0.5 + i * Math.PI / 4;
    const flash = 0.5 + 0.5 * Math.sin(elapsed * 2 + i);
    g.fillStyle(0xf0d070, 0.5 + 0.4 * flash);
    g.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(cy + Math.sin(a) * 8), 1, 1);
    g.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 10), 1, 1);
  }
}

// The Caravan Gate: a great horseshoe arch of alternating ochre and terracotta voussoirs between two
// square pylons with tiled panels and carved bands, stepped merlons along the top, banners hanging
// from the pylons, studded timber gates standing open, stub walls each side and a lantern overhead.
const GATE = 0xc89a62;
const GATE_SHADE = 0xae8450;
const GATE_LIGHT = 0xdcb27a;
function drawCaravanGate(g, x, y) {
  // Stub walls with merlons.
  g.fillStyle(GATE_SHADE);
  g.fillRect(x - 30, y - 16, 8, 16);
  g.fillRect(x + 22, y - 16, 8, 16);
  merlons(g, x - 30, y - 16, 8, GATE_SHADE);
  merlons(g, x + 22, y - 16, 8, GATE_SHADE);
  // Pylons and the span between them.
  g.fillStyle(GATE);
  g.fillRect(x - 24, y - 56, 48, 56);
  g.fillStyle(GATE_LIGHT);
  g.fillRect(x - 24, y - 56, 2, 56);
  g.fillStyle(GATE_SHADE);
  g.fillRect(x + 20, y - 56, 4, 56);
  g.fillStyle(lerpColor(GATE, 0x000000, 0.05));
  for (let cy = y - 4; cy > y - 48; cy -= 5) g.fillRect(x - 22, cy, 42, 1);
  // Tiled panels on the pylons.
  for (const px of [x - 21, x + 14]) {
    g.fillStyle(GATE_LIGHT);
    g.fillRect(px - 1, y - 45, 9, 14);
    g.fillStyle(TEAL);
    g.fillRect(px, y - 44, 7, 12);
    g.fillStyle(0xe8d8a8);
    for (let ty = y - 43; ty < y - 33; ty += 2) {
      for (let tx = px + ((ty - y) % 4 === 0 ? 1 : 0); tx < px + 7; tx += 2) g.fillRect(tx, ty, 1, 1);
    }
    g.fillStyle(SAFFRON);
    g.fillRect(px + 3, y - 39, 1, 2);
  }
  // Opening: a horseshoe arch, wider than it is at the foot, under banded voussoirs.
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * 0.9 + i / 12 * Math.PI * 1.2;
    g.fillStyle(i % 2 ? TERRACOTTA : 0xe8cc98);
    g.fillCircle(Math.round(x + Math.cos(a) * 14), Math.round(y - 30 + Math.sin(a) * 14), 2.2);
  }
  g.fillStyle(0x7a6448);
  g.fillCircle(x, y - 30, 12);
  g.fillRect(x - 10, y - 30, 20, 30);
  g.fillStyle(lerpColor(0x7a6448, 0x000000, 0.2));
  g.fillRect(x - 10, y - 30, 20, 2);
  // Carved bands across the top and the inscription frieze.
  g.fillStyle(GATE_LIGHT);
  g.fillRect(x - 25, y - 56, 50, 2);
  g.fillRect(x - 24, y - 49, 48, 1);
  tileBand(g, x - 22, y - 53, 44);
  // Stepped merlons along the top.
  g.fillStyle(GATE);
  for (let bx = x - 24; bx < x + 24; bx += 6) {
    g.fillRect(bx + 1, y - 59, 4, 3);
    g.fillRect(bx + 2, y - 61, 2, 2);
    g.fillStyle(GATE_LIGHT);
    g.fillRect(bx + 1, y - 59, 1, 3);
    g.fillStyle(GATE);
  }
  // Banners hung from the pylons.
  for (const bx of [x - 23, x + 17]) {
    g.fillStyle(0x5a4a38);
    g.fillRect(bx - 1, y - 30, 7, 1);
    g.fillStyle(SAFFRON);
    g.fillRect(bx, y - 29, 5, 12);
    g.fillStyle(TERRACOTTA);
    g.fillRect(bx, y - 25, 5, 3);
    g.fillStyle(SAFFRON);
    g.fillTriangle(bx, y - 17, bx + 5, y - 17, bx + 2.5, y - 14);
  }
  // Timber gates folded back against the inner jambs.
  g.fillStyle(0x6a4e36);
  g.fillRect(x - 10, y - 26, 3, 26);
  g.fillRect(x + 7, y - 26, 3, 26);
  g.fillStyle(0x9a8a6a);
  for (let sy = y - 23; sy < y; sy += 4) {
    g.fillRect(x - 9, sy, 1, 1);
    g.fillRect(x + 8, sy, 1, 1);
  }
  // Lantern hung in the arch.
  g.fillStyle(0x5a4a38);
  g.fillRect(x, y - 42, 1, 4);
  g.fillStyle(0xb8903a);
  g.fillRect(x - 1, y - 38, 3, 3);
  g.fillRect(x, y - 35, 1, 1);
  g.fillStyle(0xf0dca0);
  g.fillRect(x, y - 37, 1, 1);
}

// Palms on the squares in front of the fort, the museum and the gate: [x, variant].
const PALMS = [[26020, 0], [26162, 1], [26650, 2], [26792, 0], [27262, 1], [27358, 2]];

// Street first, then landmarks, matching the city's order.
export const SANDPORT_BUILDINGS = Object.freeze([
  ...streetBuildings(),
  ...SANDPORT_LANDMARKS.map((landmark, i) => ({ maxHealth: 280, seed: 380 + i, ...landmark })),
]);

// buildings: false leaves the street and landmarks to a mode that draws them itself (evil mode).
export function drawSandport(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((SANDPORT.from + SANDPORT.to) / 2, cameraX);
  const half = (SANDPORT.to - SANDPORT.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawRoofline(g, left, right, seaY, cameraX, FAR_PARALLAX, 0xd2d4cc, 1, 0.3);
  drawRoofline(g, left, right, seaY, cameraX, NEAR_PARALLAX, 0xc2c4ba, 0.75, 0.6);
  const shift = mid - (SANDPORT.from + SANDPORT.to) / 2;
  for (const [px, variant] of PALMS) {
    const at = px + shift;
    if (at < left - 40 || at > right + 40) continue;
    drawPalm(g, at, sandportBase(px, seaY) - SEA_Y_OFFSET + 1, variant, elapsed);
  }
  if (!buildings) return;
  for (const building of SANDPORT_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    const y = sandportBase(building.x, seaY);
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}

// Background rows: flat-roofed blocks, and now and then a dome, flat and with no
// detail, pivoting on the town's centre and clipped to it. Blocks fade out as they slide behind a
// landmark.
const LANDMARK_REACH = 70 * CITY_SCALE;
function drawRoofline(g, left, right, seaY, cameraX, parallax, color, scale, salt) {
  const shift = (cameraX - nearest((SANDPORT.from + SANDPORT.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, SANDPORT.from, SANDPORT.to);
    if (fade <= 0) continue;
    const seed = Math.round(wx / SKYLINE_STEP);
    const roll = hash(seed + salt);
    if (roll < 0.12) continue;
    const centre = wrapX(x + SKYLINE_STEP / 2);
    const clearance = Math.min(...SANDPORT_LANDMARKS.map(l => Math.abs(centre - l.x) - l.width / 2));
    const alpha = fade * Math.min(1, Math.max(0, (clearance + LANDMARK_REACH * 0.4) / (LANDMARK_REACH * 0.6)));
    if (alpha <= 0) continue;
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const unit = scale * CITY_SCALE;
    const h = Math.round((40 + hash(seed + 0.4 + salt) * 36) * unit);
    const w = SKYLINE_STEP - 2;
    g.fillStyle(color, alpha);
    g.fillRect(x, y - h, w, h);
    g.fillRect(x - 1, y - h - Math.round(2 * unit), w + 2, Math.round(2 * unit));
    if (roll > 0.88) {
      // A dome on a drum.
      const r = Math.round(9 * unit);
      g.fillRect(x + w / 2 - r, y - h - Math.round(5 * unit), r * 2, Math.round(5 * unit));
      g.fillCircle(x + w / 2, y - h - Math.round(5 * unit), r);
    }
  }
}
