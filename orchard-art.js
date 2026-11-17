import { CIRCUMFERENCE, elevation, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// Orchard and Orchard Fields, built to the same rules as Green City and Windmill
// (game-design-rules/city-design-rules.md). Two flat parallax rows of distant orchard trees and oast
// cowls sit behind a destructible "street": weatherboarded and brick cottages in the village; apple
// trees, pear trees and stacked apple bins out in the orchards, all in one muted cream, brick and
// clay-tile theme. The landmarks have their own palettes and detail: the Oast House (the signature,
// twin kiln roundels whose white cowls turn with the wind), the black cider barn with its press and
// barrels, the beehives, the Apple Tree Inn, the cricket pavilion on the village green, and the
// pick-your-own stand; the cricket green and the stand sit just east of the village. Plots (orchard grass, pasture, strawberries, pumpkins) are ground cover, like
// the terrain: never promoted. Fruit trees only stand on orchard and pasture plots.
// Everything that can break is listed once in ORCHARD_BUILDINGS, so evil mode can promote it.
export const ORCHARD = { from: 11800, to: 13300 };
// Cottages line the lane here; outside it are the orchards.
export const VILLAGE = { from: 12300, to: 12800 };
export const FIELD_SPANS = [[ORCHARD.from, VILLAGE.from], [VILLAGE.to, ORCHARD.to]];
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 22;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
// Closer than a crown is wide, so the orchard's crowns overlap in rows.
const FIELD_STEP = 19 * CITY_SCALE;
// Cottages over the last VILLAGE_EDGE px stay single-storey, so the village never ends as a wall.
const VILLAGE_EDGE = 90;

// The "street" theme: cream weatherboard, soft red brick and clay tiles (detail means foreground).
const BOARD = [0xddd5c2, 0xd4ccb8, 0xd9d2c0];
const BRICK = [0xa47a66, 0x9c7360, 0xa88070];
const TILE = [0x9a5e4c, 0x926050];
const TILE_DARK = 0x7f4c3e;
const TIMBER = 0x6b5a48;
const DOOR = 0x4f5a4a;
const GLASS = 0xd5e8ee;
const WINDOW_WARM = 0xe9d9a8;
const LEAF = [0x557f48, 0x5d8a4c, 0x527a4a];
const LEAF_LIGHT = 0x76a25e;
const PEAR_LEAF = 0x6a8f52;
const APPLE = 0xb24a3e;
const PEAR = 0xc9c46a;
const BARK = 0x6b4f3a;
const CRATE = 0x9a7a58;
const CRATE_DARK = 0x7d6040;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building, where building-destruction.js bakes it too.
export function orchardBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the street leaves free. open: low enough that trees and bins may stand
// beside it. yard: a farmyard the plots stop short of. width/height: hit box once promoted.
// fx draws animated cowls, smoke, bees and the flag in free roam only; a promoted building bakes still.
const LANDMARK_ART = [
  { id: 'cider-barn', yard: true, x: 11905, door: true, draw: drawCiderBarn, clear: 58, width: 116, height: 74 },
  { id: 'beehives', open: true, x: 12170, draw: drawBeehives, fx: beesFx, clear: 32, width: 64, height: 30, maxHealth: 120 },
  { id: 'apple-tree-inn', x: 12486, door: true, draw: drawInn, fx: smokeFx(-28, 72), clear: 46, width: 92, height: 82 },
  { id: 'cricket-pavilion', open: true, yard: true, x: 12905, door: true, draw: drawPavilion, fx: pavilionFlagFx, clear: 56, width: 112, height: 62 },
  { id: 'oast-house', x: 12740, door: true, draw: drawOastHouse, fx: cowlFx, clear: 43, width: 92, height: 152, maxHealth: 360 },
  { id: 'pick-your-own', open: true, x: 13044, draw: drawPickYourOwn, clear: 38, width: 76, height: 46, maxHealth: 140 },
];
export const ORCHARD_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// Room between a building of the given width at x and the nearest landmark's clear space.
function landmarkGap(x, width, landmarks = ORCHARD_LANDMARKS) {
  return Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - width / 2));
}

// Plots between the farmyards. Each field span is cut around every yard, then split into plots of
// PLOT px or so. West of the village it is all orchard, sheep and pigs grazing under the trees, as is
// the custom; east of it, strawberries by the pick-your-own stand, more orchard and a pumpkin patch.
const PLOT = 100;
const CROPS = [['orchard'], ['strawberries', 'orchard', 'pumpkins']];
function cropPlots() {
  const plots = [];
  for (const [span, [from, to]] of FIELD_SPANS.entries()) {
    const crops = CROPS[span];
    let k = 0;
    const cuts = ORCHARD_LANDMARKS.filter(l => l.yard && l.x > from && l.x < to)
      .map(l => [l.x - l.width / 2 - 8, l.x + l.width / 2 + 8]).sort((a, b) => a[0] - b[0]);
    let start = from;
    for (const [a, b] of [...cuts, [to, to]]) {
      for (let x = start; a - x > 30;) {
        const end = Math.min(a, a - x < PLOT * 1.6 ? a : x + PLOT);
        plots.push({ from: Math.round(x), to: Math.round(end), crop: crops[k++ % crops.length] });
        x = end + 6;
      }
      start = Math.max(start, b);
    }
  }
  return plots;
}
export const PLOTS = Object.freeze(cropPlots());

function plotAt(x) {
  return PLOTS.find(plot => x >= plot.from && x <= plot.to);
}

// Village cottages: weatherboarded cottages mostly, brick houses with tile-hung upper floors, and the
// village shop, packed along each free stretch of the lane like a village street, with the odd gap.
const STREET = [VILLAGE.from - 10, VILLAGE.to + 10];
function villageStreet() {
  const cuts = ORCHARD_LANDMARKS.map(l => [l.x - l.clear, l.x + l.clear]).sort((a, b) => a[0] - b[0]);
  const spans = [];
  let start = STREET[0];
  for (const [a, b] of [...cuts, [STREET[1], STREET[1]]]) {
    if (Math.min(a, STREET[1]) - start > 40) spans.push([start, Math.min(a, STREET[1])]);
    start = Math.max(start, b);
  }
  const street = [];
  let i = 0;
  for (const [from, to] of spans) {
    for (let bx = from + 4; ; i++) {
      const seed = i + 0.53;
      const edge = Math.min(bx - VILLAGE.from, VILLAGE.to - bx) < VILLAGE_EDGE;
      const roll = hash(seed + 0.1);
      const kind = edge || roll < 0.5 ? 'cottage' : roll < 0.85 ? 'house' : 'shop';
      const art = { cottage: 32, house: 38, shop: 36 }[kind] + Math.round(hash(seed + 0.2) * 6);
      const width = art * CITY_SCALE;
      if (bx + width > to - 4) break;
      const x = bx + width / 2;
      bx += width + 4 + Math.round(hash(seed + 0.5) * 8);
      if (hash(seed) < 0.08) continue;
      const walls = kind === 'house' ? 34 : 20 + Math.round(hash(seed + 0.3) * 4);
      const ridge = walls + (kind === 'cottage' ? 16 : 14);
      const shade = hash(seed + 0.6);
      street.push({
        id: `orchard-cottage-${i}`, seed, kind, x, width, height: (ridge + 10) * CITY_SCALE, door: true,
        roof: ridge * CITY_SCALE, maxHealth: 100,
        draw: scaled((g, at, y) => drawCottage(g, at, y, kind, art, walls, shade)),
      });
    }
  }
  return street;
}

// Orchard "street": apple and pear trees standing in rows on the orchard and pasture plots, and
// stacked apple bins wherever the harvest has reached.
function fieldStreet() {
  const items = [];
  for (const [from, to] of FIELD_SPANS) {
    for (let i = Math.ceil(from / FIELD_STEP); i * FIELD_STEP <= to; i++) {
      const seed = i + 0.29;
      const roll = hash(seed);
      if (roll < 0.06) continue;
      const art = 24;
      const x = i * FIELD_STEP + Math.round((FIELD_STEP - art * CITY_SCALE) * hash(seed + 0.4)) + art * CITY_SCALE / 2;
      const crop = plotAt(x)?.crop;
      const treeGround = crop === 'orchard';
      let kind = roll < 0.74 ? 'apple' : roll < 0.9 ? 'pear' : 'bins';
      if (!treeGround) {
        if (crop === undefined || roll > 0.6) continue;
        kind = 'bins';
      }
      const wide = kind === 'bins' ? 18 : art;
      const width = wide * CITY_SCALE;
      if (x - width / 2 < from || x + width / 2 > to) continue;
      if (landmarkGap(x, width, ORCHARD_LANDMARKS.filter(l => !l.open)) < 2) continue;
      // Open landmarks only keep their middle clear, so trees can shade the hives and the stand.
      if (ORCHARD_LANDMARKS.some(l => l.open && Math.abs(x - l.x) < l.clear * 0.35 + width / 2)) continue;
      const tall = { apple: 34 + Math.round(hash(seed + 0.3) * 8), pear: 46 + Math.round(hash(seed + 0.3) * 8), bins: 12 }[kind];
      const shade = hash(seed + 0.6);
      items.push({
        countsAsBuilding: false, id: `orchard-${kind}-${i}`, seed, kind, x, width, height: (tall + 4) * CITY_SCALE,
        roof: kind === 'bins' ? tall * CITY_SCALE : (tall - 6) * CITY_SCALE, maxHealth: kind === 'bins' ? 70 : 100,
        draw: scaled((g, at, y) => drawFieldItem(g, at, y, kind, wide, tall, shade)),
      });
    }
  }
  return items;
}

// A brick footing that runs below the ground line, so a building on a slope never floats.
function footing(g, x, y, width, color = 0x8a7a70) {
  g.fillStyle(color);
  g.fillRect(x - width / 2, y - 3, width, 14);
}

function drawCottage(g, x, y, kind, width, walls, shade) {
  const half = width / 2;
  footing(g, x, y, width + 2);
  if (kind === 'house') {
    // Brick ground floor, tile-hung upper floor.
    g.fillStyle(BRICK[Math.floor(shade * BRICK.length)]);
    g.fillRect(x - half, y - walls, width, walls);
    g.fillStyle(TILE[Math.floor(shade * TILE.length)]);
    g.fillRect(x - half, y - walls, width, walls - 18);
    g.fillStyle(TILE_DARK);
    for (let ty = y - walls + 3; ty < y - 18; ty += 3) {
      for (let tx = x - half + ((ty >> 1) & 2); tx < x + half; tx += 4) g.fillRect(tx, ty, 2, 1);
    }
  } else {
    // Cream weatherboard over a brick plinth.
    g.fillStyle(BOARD[Math.floor(shade * BOARD.length)]);
    g.fillRect(x - half, y - walls, width, walls);
    g.fillStyle(0x000000, 0.07);
    for (let by = y - walls + 3; by < y - 4; by += 3) g.fillRect(x - half, by, width, 1);
    g.fillStyle(BRICK[0]);
    g.fillRect(x - half, y - 4, width, 4);
  }
  g.fillStyle(0x000000, 0.08);
  g.fillRect(x + half - 4, y - walls, 4, walls);
  // Steep clay-tile roof with a brick chimney.
  const tile = TILE[Math.floor(shade * TILE.length)];
  const pitch = kind === 'cottage' ? 16 : 14;
  g.fillStyle(0x8a5a48);
  g.fillRect(x + (shade < 0.5 ? -half + 5 : half - 11), y - walls - pitch - 2, 6, pitch);
  g.fillStyle(tile);
  g.fillTriangle(x - half - 4, y - walls + 1, x, y - walls - pitch, x + half + 4, y - walls + 1);
  g.fillStyle(TILE_DARK);
  g.fillRect(x - half - 4, y - walls, width + 8, 2);
  for (let ry = y - walls - pitch + 5; ry < y - walls; ry += 4) {
    const w = (ry - (y - walls - pitch)) / pitch * (width + 8);
    g.fillRect(x - w / 2, ry, w, 1);
  }
  // A centred door at least a person tall, under a little porch hood.
  g.fillStyle(TIMBER);
  g.fillRect(x - 6, y - 17, 12, 2);
  g.fillStyle(DOOR);
  g.fillRect(x - 4, y - 15, 8, 15);
  g.fillStyle(0xc9b48a);
  g.fillRect(x + 2, y - 8, 1, 1);
  const rows = kind === 'house' ? [y - 13, y - 28] : [y - 13];
  for (const wy of rows) {
    for (const side of [-1, 1]) {
      const wx = x + side * (half * 0.56) - 3;
      g.fillStyle(0xf0ebe0);
      g.fillRect(wx - 1, wy - 1, 8, 7);
      g.fillStyle(wy === rows[0] && hash(shade * 11 + side) < 0.35 ? WINDOW_WARM : GLASS);
      g.fillRect(wx, wy, 6, 5);
      g.fillStyle(0xf0ebe0);
      g.fillRect(wx + 3, wy, 1, 5);
    }
  }
  if (kind === 'shop') {
    // The village shop: a bowed window under a muted awning, and a sign board.
    g.fillStyle(0x7a6a8a);
    g.fillRect(x - half + 2, y - 20, width - 4, 3);
    g.fillStyle(0xe2dccb);
    for (let ax = x - half + 2; ax < x + half - 2; ax += 6) g.fillRect(ax, y - 20, 3, 3);
    g.fillStyle(0x3f4a46);
    g.fillRect(x - 10, y - walls + 2, 20, 4);
    g.fillStyle(0xd9c79a);
    g.fillRect(x - 7, y - walls + 3, 14, 1);
  }
  // Roses round the door.
  g.fillStyle(0x6f8a5a);
  g.fillRect(x - 7, y - 16, 2, 16);
  g.fillStyle(0xb8737a);
  for (const dy of [-14, -9, -4]) g.fillRect(x - 7, y + dy, 2, 2);
}

function drawFieldItem(g, x, y, kind, width, height, shade) {
  if (kind === 'bins') return drawBins(g, x, y);
  if (kind === 'pear') {
    // Pear: a taller, narrower crown on a straight trunk, pale fruit hanging low.
    g.fillStyle(BARK);
    g.fillRect(x - 1, y - 16, 3, 16);
    g.fillStyle(0x4f7546);
    g.fillEllipse(x, y - height / 2 - 6, width * 0.82, height - 12);
    g.fillStyle(PEAR_LEAF);
    g.fillEllipse(x - 2, y - height / 2 - 9, width * 0.6, height - 20);
    g.fillStyle(PEAR);
    for (let i = 0; i < 6; i++) {
      const fx = x + (hash(shade * 7 + i) - 0.5) * width * 0.6;
      const fy = y - 18 - hash(shade * 5 + i) * (height - 24);
      g.fillRect(Math.round(fx), Math.round(fy), 2, 3);
    }
    return;
  }
  // Apple: a short, forked trunk under a wide, rounded crown dotted with red fruit.
  const crownY = y - height + width * 0.42;
  g.fillStyle(BARK);
  g.fillRect(x - 2, crownY + 4, 4, y - crownY - 4);
  g.fillRect(x - 5, crownY + 6, 3, 2);
  g.fillRect(x + 2, crownY + 4, 3, 2);
  const r = width / 2;
  g.fillStyle(0x4a7244);
  g.fillEllipse(x, crownY + 3, width, r * 1.1);
  g.fillStyle(LEAF[Math.floor(shade * LEAF.length)]);
  g.fillCircle(x - r * 0.45, crownY - r * 0.1, r * 0.58);
  g.fillCircle(x + r * 0.45, crownY - r * 0.05, r * 0.56);
  g.fillCircle(x, crownY - r * 0.45, r * 0.6);
  g.fillStyle(LEAF_LIGHT);
  g.fillCircle(x - r * 0.3, crownY - r * 0.7, r * 0.24);
  g.fillStyle(APPLE);
  for (let i = 0; i < 9; i++) {
    const fx = x + (hash(shade * 13 + i) - 0.5) * width * 0.85;
    const fy = crownY + (hash(shade * 17 + i) - 0.6) * r * 1.4;
    g.fillRect(Math.round(fx), Math.round(fy), 2, 2);
  }
  // A few windfalls in the grass.
  for (const dx of [-6, 3, 8]) if (hash(shade * 3 + dx) < 0.5) g.fillRect(x + dx, y - 2, 2, 2);
}

// Wooden apple bins stacked two high, the top one heaped with fruit.
function drawBins(g, x, y) {
  for (const [dx, dy] of [[-9, 0], [0, 0], [-4, -6]]) {
    g.fillStyle(CRATE);
    g.fillRect(x + dx, y + dy - 6, 9, 6);
    g.fillStyle(CRATE_DARK);
    g.fillRect(x + dx, y + dy - 4, 9, 1);
    g.fillRect(x + dx + 4, y + dy - 6, 1, 6);
  }
  g.fillStyle(APPLE);
  for (const dx of [-4, -1, 2]) g.fillCircle(x + dx, y - 13, 1.6);
  g.fillStyle(0xc9a24a);
  g.fillCircle(x - 2, y - 14, 1.4);
}

// Cider barn: a black weatherboarded barn under a clay-tile half-hip roof, its doors open on a
// wooden screw press, with a stack of oak barrels outside.
function drawCiderBarn(g, x, y) {
  footing(g, x, y, 92, 0x7f7570);
  g.fillStyle(0x3b3a38);
  g.fillRect(x - 42, y - 38, 84, 38);
  g.fillStyle(0x2f2e2c);
  for (let by = y - 35; by < y; by += 4) g.fillRect(x - 42, by, 84, 1);
  g.fillStyle(0xa47a66);
  g.fillRect(x - 42, y - 6, 84, 6);
  // Half-hipped clay-tile roof.
  g.fillStyle(0x9a5e4c);
  g.fillTriangle(x - 48, y - 38, x - 30, y - 64, x - 30, y - 38);
  g.fillTriangle(x + 48, y - 38, x + 30, y - 64, x + 30, y - 38);
  g.fillRect(x - 30, y - 64, 60, 26);
  g.fillStyle(0x7f4c3e);
  for (let ry = y - 60; ry < y - 38; ry += 4) g.fillRect(x - 46 + (y - 38 - ry) * 0.6, ry, 92 - (y - 38 - ry) * 1.2, 1);
  g.fillRect(x - 48, y - 39, 96, 2);
  // Open doors on the press inside: a timber frame, the screw and a cheese of pomace.
  g.fillStyle(0x24221f);
  g.fillRect(x - 15, y - 30, 30, 30);
  g.fillStyle(0x4a3a2a);
  g.fillRect(x - 21, y - 30, 6, 30);
  g.fillRect(x + 15, y - 30, 6, 30);
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 10, y - 26, 2, 24);
  g.fillRect(x + 8, y - 26, 2, 24);
  g.fillRect(x - 10, y - 26, 20, 3);
  g.fillStyle(0x9aa0a4);
  g.fillRect(x - 1, y - 23, 2, 9);
  g.fillStyle(0xb88a4a);
  g.fillRect(x - 7, y - 14, 14, 6);
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 9, y - 8, 18, 3);
  g.fillRect(x - 9, y - 5, 2, 5);
  g.fillRect(x + 7, y - 5, 2, 5);
  // Painted sign: a red apple on a cream board above the doors.
  g.fillStyle(0xe2d6bc);
  g.fillRect(x - 12, y - 37, 24, 6);
  g.fillStyle(APPLE);
  g.fillCircle(x, y - 34, 2.5);
  g.fillStyle(0x5d8a4c);
  g.fillRect(x + 1, y - 37, 2, 1);
  // Oak barrels, three down and two up.
  for (const [dx, dy] of [[46, 0], [56, 0], [66, 0], [51, -9], [61, -9]]) {
    g.fillStyle(0x7a5638);
    g.fillEllipse(x + dx, y + dy - 4.5, 9, 9);
    g.fillStyle(0x4a4a4a);
    g.fillRect(x + dx - 4, y + dy - 7, 8, 1);
    g.fillRect(x + dx - 4, y + dy - 3, 8, 1);
    g.fillStyle(0x9a7450);
    g.fillCircle(x + dx, y + dy - 4.5, 1.5);
  }
}

// Beehives: a row of white lift hives on stands by a small shed, with flowering lavender between.
function drawBeehives(g, x, y) {
  g.fillStyle(0x8a9a6a);
  g.fillRect(x - 30, y - 4, 60, 4);
  g.fillStyle(0x8f7aa6);
  for (let lx = x - 28; lx < x + 28; lx += 3) g.fillRect(lx, y - 6 - (lx & 1), 1, 2);
  for (const dx of [-20, -6, 8]) {
    g.fillStyle(0x6b5a48);
    g.fillRect(x + dx - 4, y - 5, 1, 5);
    g.fillRect(x + dx + 4, y - 5, 1, 5);
    g.fillStyle(0xeceae2);
    g.fillRect(x + dx - 5, y - 17, 11, 12);
    g.fillStyle(0xd8d4c8);
    g.fillRect(x + dx - 5, y - 13, 11, 1);
    g.fillRect(x + dx - 5, y - 9, 11, 1);
    g.fillStyle(0xeceae2);
    g.fillTriangle(x + dx - 7, y - 17, x + dx, y - 22, x + dx + 7, y - 17);
    g.fillStyle(0x3b3a38);
    g.fillRect(x + dx - 2, y - 6, 5, 1);
  }
  // The beekeeper's shed.
  g.fillStyle(0x7a6a58);
  g.fillRect(x + 16, y - 20, 14, 20);
  g.fillStyle(0x5a4636);
  g.fillTriangle(x + 14, y - 20, x + 23, y - 26, x + 32, y - 20);
  g.fillStyle(0x4a3a2c);
  g.fillRect(x + 20, y - 14, 6, 14);
}

function beesFx(g, x, y, elapsed) {
  g.fillStyle(0x3b3a20);
  for (let i = 0; i < 9; i++) {
    const hive = [-20, -6, 8][i % 3];
    const a = elapsed * (2 + (i % 4) * 0.5) + i * 1.7;
    g.fillRect(Math.round(x + hive + Math.cos(a) * (5 + i % 3 * 3)), Math.round(y - 12 + Math.sin(a * 1.3) * 6 - (i % 2) * 6), 1, 1);
  }
}

// The Apple Tree Inn: a brick ground floor, timber framing above, a long tile roof with a dormer, a
// tall chimney, benches out front and a hanging sign painted with an apple tree.
function drawInn(g, x, y) {
  footing(g, x, y, 86);
  g.fillStyle(0xa47a66);
  g.fillRect(x - 40, y - 24, 80, 24);
  g.fillStyle(0x8f6a58);
  for (let by = y - 21; by < y; by += 4) g.fillRect(x - 40, by, 80, 1);
  g.fillStyle(0xe6dfcc);
  g.fillRect(x - 40, y - 48, 80, 24);
  g.fillStyle(0x4a3a2c);
  for (let tx = x - 40; tx <= x + 38; tx += 10) g.fillRect(tx, y - 48, 2, 24);
  g.fillRect(x - 40, y - 26, 80, 2);
  g.fillRect(x - 40, y - 48, 80, 2);
  for (let tx = x - 40; tx < x + 38; tx += 20) {
    g.lineStyle(1, 0x4a3a2c, 1);
    g.lineBetween(tx + 2, y - 26, tx + 10, y - 46);
  }
  // Tall chimney at the west gable, then the roof and a dormer.
  g.fillStyle(0x8a5a48);
  g.fillRect(x - 32, y - 76, 9, 30);
  g.fillStyle(0x6e4a3a);
  g.fillRect(x - 33, y - 77, 11, 2);
  g.fillStyle(0x9a5e4c);
  g.fillTriangle(x - 46, y - 48, x - 26, y - 68, x - 26, y - 48);
  g.fillTriangle(x + 46, y - 48, x + 26, y - 68, x + 26, y - 48);
  g.fillRect(x - 26, y - 68, 52, 20);
  g.fillStyle(0x7f4c3e);
  for (let ry = y - 64; ry < y - 48; ry += 4) g.fillRect(x - 42 + (y - 48 - ry), ry, 84 - (y - 48 - ry) * 2, 1);
  g.fillRect(x - 46, y - 49, 92, 2);
  g.fillStyle(0xe6dfcc);
  g.fillRect(x + 6, y - 64, 14, 10);
  g.fillStyle(0x9a5e4c);
  g.fillTriangle(x + 4, y - 64, x + 13, y - 70, x + 22, y - 64);
  g.fillStyle(GLASS);
  g.fillRect(x + 9, y - 62, 8, 6);
  // Leaded windows up and down, a warm glow in the bar.
  for (const dx of [-26, 16]) {
    g.fillStyle(0x4a3a2c);
    g.fillRect(x + dx - 1, y - 43, 12, 10);
    g.fillStyle(GLASS);
    g.fillRect(x + dx, y - 42, 10, 8);
    g.fillStyle(0x4a3a2c);
    g.fillRect(x + dx + 5, y - 42, 1, 8);
    g.fillStyle(0xf0ebe0);
    g.fillRect(x + dx - 2, y - 18, 14, 11);
    g.fillStyle(WINDOW_WARM);
    g.fillRect(x + dx - 1, y - 17, 12, 9);
    g.fillStyle(0x6b5a48);
    g.fillRect(x + dx + 5, y - 17, 1, 9);
  }
  // Centred door under a little porch.
  g.fillStyle(0x9a5e4c);
  g.fillTriangle(x - 9, y - 18, x, y - 24, x + 9, y - 18);
  g.fillStyle(0x3f4a3e);
  g.fillRect(x - 5, y - 17, 10, 17);
  g.fillStyle(0xd9c27a);
  g.fillRect(x + 2, y - 9, 1, 1);
  // Hanging sign on a bracket.
  g.fillStyle(0x3b3a38);
  g.fillRect(x + 40, y - 40, 12, 2);
  g.fillRect(x + 42, y - 40, 1, 4);
  g.fillRect(x + 49, y - 40, 1, 4);
  g.fillStyle(0xd9c79a);
  g.fillRect(x + 40, y - 36, 12, 12);
  g.fillStyle(0x5d8a4c);
  g.fillCircle(x + 46, y - 32, 4);
  g.fillStyle(BARK);
  g.fillRect(x + 45, y - 29, 2, 4);
  g.fillStyle(APPLE);
  g.fillRect(x + 44, y - 33, 1, 1);
  g.fillRect(x + 48, y - 31, 1, 1);
  // Benches and a barrel table out front.
  g.fillStyle(0x7a5638);
  for (const dx of [-36, 26]) {
    g.fillRect(x + dx, y - 5, 12, 2);
    g.fillRect(x + dx + 1, y - 3, 1, 3);
    g.fillRect(x + dx + 10, y - 3, 1, 3);
  }
}

// Cricket pavilion: a white weatherboarded pavilion with a veranda, a clock gable and a flagpole,
// on the mown village green with the roller parked beside it.
function drawPavilion(g, x, y) {
  g.fillStyle(0x86b866);
  g.fillEllipse(x, y - 1, 156, 10);
  g.fillStyle(0x96c474);
  for (let sx = x - 70; sx < x + 70; sx += 16) g.fillRect(sx, y - 4, 8, 3);
  // The wicket strip and stumps out on the green.
  g.fillStyle(0xc9c08a);
  g.fillRect(x + 36, y - 3, 30, 2);
  g.fillStyle(0xeceae2);
  for (const sx of [36, 65]) for (const d of [0, 2]) g.fillRect(x + sx + d, y - 9, 1, 6);
  footing(g, x - 20, y, 66, 0x8a857c);
  g.fillStyle(0xeeebe2);
  g.fillRect(x - 52, y - 30, 64, 30);
  g.fillStyle(0xdedbd0);
  for (let by = y - 27; by < y; by += 3) g.fillRect(x - 52, by, 64, 1);
  // Green roof and a gable with a clock.
  g.fillStyle(0x4f6e5a);
  g.fillTriangle(x - 58, y - 30, x - 20, y - 46, x + 18, y - 30);
  g.fillStyle(0x3f5a4a);
  g.fillRect(x - 58, y - 31, 76, 2);
  g.fillStyle(0xeeebe2);
  g.fillTriangle(x - 32, y - 31, x - 20, y - 52, x - 8, y - 31);
  g.fillStyle(0xfdf8ea);
  g.fillCircle(x - 20, y - 39, 4);
  g.fillStyle(0x3b3b3b);
  g.fillRect(x - 20, y - 42, 1, 3);
  g.fillRect(x - 20, y - 39, 2, 1);
  // Veranda posts and rail; the door in the middle.
  g.fillStyle(0xf6f4ee);
  for (let px = x - 50; px <= x + 10; px += 10) g.fillRect(px, y - 22, 2, 22);
  g.fillRect(x - 52, y - 22, 64, 2);
  g.fillRect(x - 52, y - 8, 64, 1);
  g.fillStyle(0x4f6e5a);
  g.fillRect(x - 24, y - 17, 8, 17);
  g.fillStyle(GLASS);
  g.fillRect(x - 42, y - 16, 10, 7);
  g.fillRect(x - 8, y - 16, 10, 7);
  // Flagpole and the heavy roller.
  g.fillStyle(0xeceae2);
  g.fillRect(x + 22, y - 60, 1, 60);
  g.fillStyle(0x5a5f66);
  g.fillCircle(x + 30, y - 4, 4);
  g.fillRect(x + 30, y - 9, 8, 1);
}

function pavilionFlagFx(g, x, y, elapsed) {
  for (let i = 0; i < 6; i++) {
    const wave = Math.round(Math.sin(elapsed * 4 - i * 0.8) * 1.2);
    g.fillStyle(i % 2 ? 0x5f7a96 : 0x6f9a6a);
    g.fillRect(x + 23 + i * 2, y - 60 + wave, 2, 6);
  }
}

// The Oast House: the village's signature. Two round brick kilns (roundels) with tall conical tile
// roofs, each capped by a white weatherboarded cowl that turns from the wind, joined to a
// weatherboarded stowage barn with a loading door. The cowls are drawn by cowlFx in free roam; a
// promoted oast bakes them facing the same way.
const OAST_BRICK = 0xb06e56;
const OAST_TILE = 0x8a4e40;
function drawOastHouse(g, x, y, elapsed = 0) {
  footing(g, x, y, 90, 0x7f7570);
  // Stowage barn between and in front of the roundels.
  g.fillStyle(0xe6dfcc);
  g.fillRect(x - 28, y - 46, 56, 46);
  g.fillStyle(0xd4cdb8);
  for (let by = y - 43; by < y; by += 3) g.fillRect(x - 28, by, 56, 1);
  for (const [cx, top, wide] of [[-26, 118, 15], [26, 104, 14]]) {
    // Roundel: a brick drum, then the cone.
    g.fillStyle(OAST_BRICK);
    g.fillRect(x + cx - wide, y - 62, wide * 2, 62);
    g.fillStyle(0x9a5e48);
    g.fillRect(x + cx + wide - 4, y - 62, 4, 62);
    for (let by = y - 58; by < y; by += 5) g.fillRect(x + cx - wide, by, wide * 2, 1);
    g.fillStyle(OAST_TILE);
    g.fillTriangle(x + cx - wide - 2, y - 62, x + cx, y - top, x + cx + wide + 2, y - 62);
    g.fillStyle(0x7a4436);
    g.fillTriangle(x + cx + 2, y - 62, x + cx, y - top, x + cx + wide + 2, y - 62);
    g.fillStyle(0x6e3e32);
    g.fillRect(x + cx - wide - 2, y - 63, wide * 2 + 4, 2);
  }
  // Barn roof and the loading door with its hoist.
  g.fillStyle(0x9a5e4c);
  g.fillTriangle(x - 30, y - 46, x, y - 62, x + 30, y - 46);
  g.fillStyle(0x7f4c3e);
  g.fillRect(x - 30, y - 47, 60, 2);
  g.fillStyle(0x6b5a48);
  g.fillRect(x - 5, y - 42, 10, 12);
  g.fillRect(x - 1, y - 52, 2, 8);
  g.fillRect(x - 1, y - 52, 9, 2);
  // Centred door at ground level and a pair of windows.
  g.fillStyle(DOOR);
  g.fillRect(x - 5, y - 17, 10, 17);
  g.fillStyle(0xd9c27a);
  g.fillRect(x + 2, y - 9, 1, 1);
  g.fillStyle(GLASS);
  g.fillRect(x - 20, y - 16, 7, 7);
  g.fillRect(x + 13, y - 16, 7, 7);
  // Cowls, still: the fx redraws them turning.
  cowls(g, x, y, elapsed);
}

function cowls(g, x, y, elapsed) {
  for (const [cx, top, phase] of [[-26, 118, 0], [26, 104, 2]]) {
    const turn = Math.sin(elapsed * 0.35 + phase);
    const face = turn > 0 ? 1 : -1;
    const lean = Math.round(Math.abs(turn) * 2);
    // The cowl sits over the cone's tip, so it reads as one piece with the kiln.
    const cy = y - top + 9;
    g.fillStyle(0xf2f0e8);
    g.fillRect(x + cx - 5, cy - 16, 10, 16);
    g.fillStyle(0xdedbd0);
    for (let by = cy - 13; by < cy; by += 3) g.fillRect(x + cx - 5, by, 10, 1);
    // The hood curves over toward the open side, its flat vane opposite.
    g.fillStyle(0xf2f0e8);
    g.fillEllipse(x + cx + face * lean, cy - 16, 12, 7);
    g.fillRect(x + cx + face * 3, cy - 18, face * (6 + lean), 4);
    g.fillStyle(0x3b3a38);
    g.fillRect(face > 0 ? x + cx + 4 + lean : x + cx - 5 - lean, cy - 14, 2, 8);
    g.fillStyle(0xf2f0e8);
    g.fillRect(face > 0 ? x + cx - 9 : x + cx + 5, cy - 12, 4, 2);
    // Finial.
    g.fillStyle(0xc9a24a);
    g.fillRect(x + cx - 1, cy - 23, 2, 4);
  }
}

function cowlFx(g, x, y, elapsed) {
  cowls(g, x, y, elapsed);
}

// Pick-your-own stand: a cream hut with a striped awning, ladders leant against stacked bins, baskets
// on the counter and a sign.
function drawPickYourOwn(g, x, y) {
  g.fillStyle(0xe2d6bc);
  g.fillRect(x - 18, y - 26, 36, 26);
  g.fillStyle(0xd0c4a8);
  for (let by = y - 23; by < y; by += 3) g.fillRect(x - 18, by, 36, 1);
  for (let i = 0, ax = x - 22; ax < x + 22; ax += 5, i++) {
    g.fillStyle(i % 2 ? 0xeceae2 : 0x6f9a6a);
    g.fillRect(ax, y - 32, 5, 6);
    g.fillCircle(ax + 2.5, y - 26, 2.5);
  }
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 20, y - 14, 40, 3);
  // Baskets of apples and pears on the counter.
  for (const [dx, fruit] of [[-12, APPLE], [0, PEAR], [12, APPLE]]) {
    g.fillStyle(0xb8955a);
    g.fillRect(x + dx - 4, y - 18, 8, 4);
    g.fillStyle(fruit);
    g.fillCircle(x + dx - 1.5, y - 19, 1.6);
    g.fillCircle(x + dx + 1.5, y - 19, 1.6);
  }
  // Ladders against the bins.
  for (const [bx, lean] of [[-32, 1], [28, -1]]) {
    g.fillStyle(CRATE);
    g.fillRect(x + bx - 5, y - 8, 10, 8);
    g.fillStyle(CRATE_DARK);
    g.fillRect(x + bx - 5, y - 5, 10, 1);
    g.lineStyle(1, 0x8a6a4a, 1);
    g.lineBetween(x + bx - 3, y, x + bx - 3 + lean * 6, y - 38);
    g.lineBetween(x + bx + 1, y, x + bx + 1 + lean * 6, y - 38);
    for (let s = 4; s < 38; s += 5) g.lineBetween(x + bx - 3 + lean * s * 6 / 38, y - s, x + bx + 1 + lean * s * 6 / 38, y - s);
  }
  // Sign on a post: a painted apple.
  g.fillStyle(0x6b4a30);
  g.fillRect(x + 36, y - 30, 1, 30);
  g.fillStyle(0xeceae2);
  g.fillRect(x + 30, y - 40, 14, 10);
  g.fillStyle(APPLE);
  g.fillCircle(x + 37, y - 35, 3);
  g.fillStyle(0x5d8a4c);
  g.fillRect(x + 37, y - 39, 2, 1);
}

// Rising, fading puffs above a chimney at (dx, height) art px from the base.
function smokeFx(dx, height) {
  return (g, x, y, elapsed) => {
    for (let i = 0; i < 4; i++) {
      const t = (elapsed * 0.35 + i / 4) % 1;
      g.fillStyle(0xe6e8ea, 0.5 * (1 - t));
      g.fillCircle(x + dx + t * 10 + Math.sin(elapsed + i) * 2, y - height - 4 - t * 26, 2 + t * 4);
    }
  };
}

// Street first, then landmarks, matching the city's order.
export const ORCHARD_BUILDINGS = Object.freeze([
  ...fieldStreet(),
  ...villageStreet(),
  ...ORCHARD_LANDMARKS.map((landmark, i) => ({ maxHealth: 260, seed: 200 + i, ...landmark })),
]);

// buildings: false leaves the street and landmarks to a mode that draws them itself (evil mode).
export function drawOrchard(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((ORCHARD.from + ORCHARD.to) / 2, cameraX);
  const half = (ORCHARD.to - ORCHARD.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawTreeline(g, left, right, seaY, cameraX, FAR_PARALLAX, 0xa6c8bc, 0.6, 0.35);
  drawTreeline(g, left, right, seaY, cameraX, NEAR_PARALLAX, 0x90b8a4, 1, 0.65);
  drawPlots(g, left, right, seaY, cameraX);
  if (!buildings) return;
  for (const building of ORCHARD_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    const y = orchardBase(building.x, seaY);
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}

// Background rows: rounded orchard crowns in rows and, now and then, a distant oast cone. Flat and
// detail-free, pivoting on the area's centre and clipped to it, like the city skyline.
function drawTreeline(g, left, right, seaY, cameraX, parallax, color, scale, salt) {
  const shift = (cameraX - nearest((ORCHARD.from + ORCHARD.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, ORCHARD.from, ORCHARD.to);
    if (fade <= 0) continue;
    g.fillStyle(color, fade);
    const seed = Math.round(wx / SKYLINE_STEP);
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const roll = hash(seed + salt);
    const unit = scale * CITY_SCALE;
    if (roll < 0.06) {
      // A distant oast: a drum under a cone and a cowl.
      const w = Math.round(14 * unit), h = Math.round(22 * unit);
      g.fillRect(x + 4, y - h, w, h);
      g.fillTriangle(x + 2, y - h, x + 4 + w / 2, y - h - Math.round(26 * unit), x + 6 + w, y - h);
      g.fillRect(x + 4 + w / 2 - 2, y - h - Math.round(32 * unit), 4, Math.round(7 * unit));
    }
    // Orchard crowns: a round mound on a short trunk, every slot.
    const tall = Math.round((12 + hash(seed + 0.4 + salt) * 8) * unit);
    const r = 9 + Math.round(hash(seed + 0.7 + salt) * 3);
    g.fillRect(x + r - 1, y - tall + r, 2, tall - r);
    g.fillCircle(x + r, y - tall + r * 0.5, r);
  }
}

// Ground cover on the plots, standing up from under the terrain cap: mown orchard grass with
// windfalls, pasture tufts, rows of strawberries and a pumpkin patch. Hedges mark the plot edges.
const PLOT_LOOK = {
  orchard: { body: 0x7aa85c, tall: 3 },
  pasture: { body: 0x7fae5f, tall: 4 },
  strawberries: { body: 0x5f8f4f, tall: 5 },
  pumpkins: { body: 0x6f8f4a, tall: 3 },
};
function drawPlots(g, left, right, seaY, cameraX) {
  for (const plot of PLOTS) {
    const from = nearest(plot.from, cameraX);
    const to = from + (plot.to - plot.from);
    if (to < left || from > right) continue;
    const look = PLOT_LOOK[plot.crop];
    const a = Math.max(from, Math.floor(left / 3) * 3);
    const b = Math.min(to, right);
    for (let x = a; x < b; x += 12) {
      const w = Math.min(12, b - x);
      const base = seaY - Math.max(0, elevation(wrapX(x))) + 3;
      g.fillStyle(look.body);
      g.fillRect(x, base - look.tall, w + 1, look.tall);
    }
    for (let x = Math.ceil(a / 3) * 3; x < b; x += 3) {
      const base = seaY - Math.max(0, elevation(wrapX(x))) + 3;
      const roll = hash(wrapX(x) * 0.37);
      if (plot.crop === 'strawberries') {
        // Mounded rows with a berry here and there.
        if (x % 9 === 0) {
          g.fillStyle(0x6f9f58);
          g.fillRect(x, base - look.tall - 2, 5, 2);
          if (roll < 0.6) {
            g.fillStyle(0xb8473f);
            g.fillRect(x + 1 + Math.round(roll * 3), base - look.tall - 1, 1, 1);
          }
        }
      } else if (plot.crop === 'pumpkins') {
        if (roll < 0.12) {
          g.fillStyle(0xc98a3e);
          g.fillEllipse(x, base - look.tall - 2, 7, 5);
          g.fillStyle(0xa86e30);
          g.fillRect(x, base - look.tall - 4, 1, 4);
          g.fillStyle(0x5a6e3a);
          g.fillRect(x, base - look.tall - 6, 1, 2);
        } else if (roll < 0.4) {
          g.fillStyle(0x7f9f52);
          g.fillRect(x, base - look.tall - 1, 2, 1);
        }
      } else if (roll < 0.25) {
        g.fillStyle(0x6f9e50);
        g.fillRect(x, base - look.tall - 2, 1, 3);
        if (plot.crop === 'orchard' && hash(wrapX(x) * 0.53) < 0.1) {
          g.fillStyle(APPLE);
          g.fillRect(x, base - look.tall - 1, 2, 2);
        } else if (hash(wrapX(x) * 0.53) < 0.1) {
          g.fillStyle(hash(x) < 0.5 ? 0xe8e2d4 : 0xd8c06a);
          g.fillRect(x, base - look.tall - 3, 2, 2);
        }
      }
    }
    for (const hx of [from - 3, to - 3]) {
      if (hx + 6 < left || hx > right) continue;
      const base = seaY - Math.max(0, elevation(wrapX(hx))) + 3;
      g.fillStyle(0x5a8550);
      g.fillRect(hx, base - 12, 7, 12);
      g.fillRect(hx + 1, base - 14, 5, 2);
    }
  }
}
