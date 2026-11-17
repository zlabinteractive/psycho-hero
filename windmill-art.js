import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// Windmill and Windmill Fields, built to the same rules as Green City and Oakwood
// (game-design-rules/city-design-rules.md). Two flat parallax rows of hedgerows and distant farms sit
// behind a destructible "street": cottages in the village, hay bales, poplars and field maples out in
// the fields, all in one muted cream-and-straw theme. The landmarks have their own palettes and
// detail: the Great Windmill (the signature, taller than anything around it, its sails turning), a
// wooden post mill, the red barn and silo, the farm stand, the scarecrow, the chapel, the village
// green with its market and maypole, and the farmhouse with its chicken coop. Crop plots (wheat, barley,
// ploughed earth, pasture) are ground cover, like the terrain: never promoted.
// Everything that can break is listed once in WINDMILL_BUILDINGS, so evil mode can promote it.
export const WINDMILL = { from: 5400, to: 7200 };
// Cottages line the lane here; outside it are the fields.
export const VILLAGE = { from: 6060, to: 6860 };
export const FIELD_SPANS = [[WINDMILL.from, VILLAGE.from], [VILLAGE.to, WINDMILL.to]];
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 22;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
const STREET_STEP = 40 * CITY_SCALE;
const FIELD_STEP = 30 * CITY_SCALE;
// Cottages over the last VILLAGE_EDGE px stay single-storey, so the village never ends as a wall.
const VILLAGE_EDGE = 110;

// The "street" theme: limewashed walls, straw thatch and slate (detail means foreground).
const WALLS = [0xd9d1bf, 0xcfc7b4, 0xd4ccb8];
const THATCH = [0xa8925f, 0x9c8656];
const THATCH_DARK = 0x86703f;
const SLATE = 0x6d7279;
const SLATE_DARK = 0x5b6067;
const TIMBER = 0x6b5a48;
const DOOR = 0x5a4636;
const GLASS = 0xd5e8ee;
const WINDOW_WARM = 0xe9d9a8;
const HAY = 0xd2b66a;
const HAY_DARK = 0xb39a52;
const LEAF = [0x5f8f52, 0x678f4f, 0x5a8a56];
const LEAF_LIGHT = 0x7aa862;
const BARK = 0x6b4f3a;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building, where building-destruction.js bakes it too.
export function windmillBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the street leaves free; for a mill, just its tower, so sails sweep over the
// roofs. open: low enough that cottages, bales and trees may stand behind it. yard: a farmyard the crops stop short of. width/height: hit box once promoted.
// fx draws animated smoke, ribbons and lights in free roam only. Sails are part of the mill itself
// and turn with elapsed, so a promoted mill bakes them standing still (elapsed 0).
const LANDMARK_ART = [
  { id: 'farm-stand', open: true, x: 5470, draw: drawFarmStand, clear: 36, width: 70, height: 40 },
  { id: 'red-barn', yard: true, x: 5660, door: true, draw: drawRedBarn, fx: weathervaneFx, clear: 62, width: 120, height: 112 },
  { id: 'scarecrow', open: true, x: 5830, draw: drawScarecrow, fx: scarecrowFx, clear: 18, width: 28, height: 44, maxHealth: 120 },
  { id: 'post-mill', yard: true, x: 5965, draw: drawPostMill, clear: 44, width: 88, height: 96, maxHealth: 280 },
  { id: 'chapel', x: 6150, door: true, draw: drawChapel, fx: bellFx, clear: 42, width: 84, height: 96 },
  { id: 'village-green', open: true, x: 6420, draw: drawVillageGreen, fx: maypoleFx, clear: 60, width: 140, height: 64 },
  { id: 'great-windmill', x: 6640, door: true, draw: drawGreatWindmill, clear: 36, width: 128, height: 158, maxHealth: 360 },
  { id: 'farmhouse', yard: true, x: 7080, door: true, draw: drawFarmhouse, fx: smokeFx(22, 74), clear: 62, width: 124, height: 78 },
];
export const WINDMILL_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// Room between a building of the given width at x and the nearest landmark's clear space.
function landmarkGap(x, width, landmarks = WINDMILL_LANDMARKS) {
  return Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - width / 2));
}

// Village cottages: thatched cottages mostly, slate-roofed houses and a shop or two for rhythm.
function villageStreet() {
  const street = [];
  for (let i = Math.ceil(VILLAGE.from / STREET_STEP); i * STREET_STEP <= VILLAGE.to; i++) {
    const seed = i + 0.71;
    if (hash(seed) < 0.12) continue;
    const slot = i * STREET_STEP;
    const edge = Math.min(slot - VILLAGE.from, VILLAGE.to - slot) < VILLAGE_EDGE;
    const roll = hash(seed + 0.1);
    const kind = edge || roll < 0.55 ? 'cottage' : roll < 0.85 ? 'house' : 'shop';
    const art = { cottage: 36, house: 40, shop: 38 }[kind] + Math.round(hash(seed + 0.2) * 8);
    const width = art * CITY_SCALE;
    const x = slot + Math.round((STREET_STEP - width) * hash(seed + 0.4)) + width / 2;
    // Cottages crowd round the open green, as a village does, and keep clear of everything else.
    if (landmarkGap(x, width, WINDMILL_LANDMARKS.filter(l => !l.open)) < 2) continue;
    const walls = kind === 'house' ? 34 : 20 + Math.round(hash(seed + 0.3) * 4);
    const ridge = walls + (kind === 'cottage' ? 18 : 14);
    const shade = hash(seed + 0.6);
    street.push({
      id: `cottage-${i}`, seed, x, width, height: (ridge + 8) * CITY_SCALE, door: true,
      roof: ridge * CITY_SCALE, maxHealth: 100,
      draw: scaled((g, at, y) => drawCottage(g, at, y, kind, art, walls, shade)),
    });
  }
  return street;
}

// Field "street": round hay bales, tall poplars and field maples along the hedgerows.
function fieldStreet() {
  const items = [];
  for (const [from, to] of FIELD_SPANS) {
    for (let i = Math.ceil(from / FIELD_STEP); i * FIELD_STEP <= to; i++) {
      const seed = i + 0.37;
      const roll = hash(seed);
      if (roll < 0.15) continue;
      const kind = roll < 0.62 ? 'bales' : roll < 0.8 ? 'poplar' : 'maple';
      const art = { bales: hash(seed + 0.1) < 0.5 ? 26 : 14, poplar: 14, maple: 30 }[kind];
      const tall = { bales: art > 20 ? 22 : 12, poplar: 58 + Math.round(hash(seed + 0.3) * 18), maple: 40 + Math.round(hash(seed + 0.3) * 14) }[kind];
      const width = art * CITY_SCALE;
      const x = i * FIELD_STEP + Math.round((FIELD_STEP - width) * hash(seed + 0.4)) + width / 2;
      if (x - width / 2 < from || x + width / 2 > to) continue;
      // Open landmarks only keep their middle clear, so a bale can sit by the stall or the scarecrow.
      if (landmarkGap(x, width, WINDMILL_LANDMARKS.filter(l => !l.open)) < 2) continue;
      if (WINDMILL_LANDMARKS.some(l => l.open && Math.abs(x - l.x) < l.clear * 0.5 + width / 2)) continue;
      const shade = hash(seed + 0.6);
      items.push({
        countsAsBuilding: false, id: `field-${kind}-${i}`, seed, kind, x, width, height: (tall + 4) * CITY_SCALE,
        roof: kind === 'bales' ? tall * CITY_SCALE : (tall - 4) * CITY_SCALE, maxHealth: kind === 'bales' ? 80 : 100,
        draw: scaled((g, at, y) => drawFieldItem(g, at, y, kind, art, tall, shade)),
      });
    }
  }
  return items;
}

// A stone footing that runs below the ground line, so a building on a slope never floats.
function footing(g, x, y, width, color = 0x8a857c) {
  g.fillStyle(color);
  g.fillRect(x - width / 2, y - 3, width, 14);
}

// Leaded window: a timber frame, glass (warm now and then) and a diamond lattice.
function leaded(g, x, y, w, h, warm) {
  g.fillStyle(TIMBER);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(warm ? WINDOW_WARM : GLASS);
  g.fillRect(x, y, w, h);
  g.fillStyle(0x7a6a58, 0.7);
  for (let i = 0; i < w + h; i += 2) {
    for (let j = 0; j <= i; j++) {
      const px = x + j;
      const py = y + i - j;
      if (px < x + w && py < y + h && (i % 4 === 0)) g.fillRect(px, py, 1, 1);
    }
  }
  g.fillStyle(0xffffff, 0.35);
  g.fillRect(x, y, 1, h);
}

// Flower box under a window, with blooms.
function flowerBox(g, x, y, w, seed) {
  g.fillStyle(0x7a5638);
  g.fillRect(x, y, w, 2);
  g.fillStyle(0x6f9a4a);
  g.fillRect(x, y - 1, w, 1);
  const blooms = [0xd9605a, 0xf2c14e, 0xe890b8, 0xf4f2ec];
  for (let fx = x; fx < x + w; fx += 2) {
    g.fillStyle(blooms[Math.floor(hash(fx * 0.7 + seed) * blooms.length)]);
    g.fillRect(fx, y - 2, 1, 1);
  }
}

// Village street buildings. cottage: whitewash and black half-timbering under a deep layered thatch
// with an eyebrow dormer, a chimney, a porch hood and roses round the door. house: two storeys of
// coursed stone, sash windows with lintels, a fanlit door between pilasters, a slate roof with ridge
// tiles and two chimneys. shop: a painted front with a small-paned bay window, a striped awning, a
// hanging sign and a bench.
function drawCottage(g, x, y, kind, width, walls, shade) {
  const half = width / 2;
  const left = x - half;
  const right = x + half;
  const top = y - walls;
  footing(g, x, y, width + 2);
  const wall = kind === 'house' ? [0xc9b99a, 0xbfae8e, 0xd0c2a4][Math.floor(shade * 3)]
    : kind === 'shop' ? [0x9fb5a8, 0xc9a98e, 0xa9b8c8][Math.floor(shade * 3)] : WALLS[Math.floor(shade * WALLS.length)];
  g.fillStyle(wall);
  g.fillRect(left, top, width, walls);
  if (kind === 'cottage') {
    // Half-timbering: sill and wall plates, posts and braces.
    g.fillStyle(0x3e3630);
    g.fillRect(left, top, width, 2);
    g.fillRect(left, y - 3, width, 2);
    for (const px of [left, left + Math.round(width * 0.28), right - Math.round(width * 0.28) - 2, right - 2]) g.fillRect(px, top, 2, walls - 1);
    g.lineStyle(1, 0x3e3630, 1);
    g.lineBetween(left + 2, y - 4, left + Math.round(width * 0.28), top + 2);
    g.lineBetween(right - 2, y - 4, right - Math.round(width * 0.28), top + 2);
  } else if (kind === 'house') {
    // Coursed stone with staggered joints and quoins.
    g.fillStyle(lerpColor(wall, 0x000000, 0.12));
    for (let cy = top + 3, k = 0; cy < y; cy += 4, k++) {
      g.fillRect(left, cy, width, 1);
      for (let cx = left + (k % 2) * 4; cx < right; cx += 8) g.fillRect(cx, cy - 3, 1, 3);
    }
    g.fillStyle(lerpColor(wall, 0xffffff, 0.3));
    for (let qy = top, k = 0; qy < y; qy += 4, k++) {
      g.fillRect(left, qy, k % 2 ? 3 : 5, 3);
      g.fillRect(right - (k % 2 ? 3 : 5), qy, k % 2 ? 3 : 5, 3);
    }
    g.fillStyle(lerpColor(wall, 0x000000, 0.2));
    g.fillRect(left, y - 18, width, 1);
  } else {
    // Shop front: a dark fascia band and a sign board.
    g.fillStyle(0x3e4a44);
    g.fillRect(left, top, width, 3);
    g.fillStyle(0xe8e0c8);
    g.fillRect(left + 4, top + 4, width - 8, 4);
    g.fillStyle(0x3e4a44);
    for (let lx = left + 7; lx < right - 7; lx += 3) if (hash(lx + shade * 13) > 0.25) g.fillRect(lx, top + 5, 2, 2);
  }
  g.fillStyle(0x000000, 0.08);
  g.fillRect(right - 3, top, 3, walls);

  // Roof.
  if (kind === 'cottage') {
    const thatch = THATCH[Math.floor(shade * THATCH.length)];
    // Chimney at the gable end, behind the thatch.
    g.fillStyle(0x9a6a52);
    g.fillRect(right - 9, top - 24, 6, 14);
    g.fillStyle(0x7a4f3e);
    g.fillRect(right - 10, top - 25, 8, 2);
    g.fillStyle(thatch);
    g.fillTriangle(left - 6, top + 3, x, top - 18, right + 6, top + 3);
    g.fillRect(left - 6, top - 2, width + 12, 5);
    g.fillEllipse(left - 4, top + 2, 6, 4);
    g.fillEllipse(right + 4, top + 2, 6, 4);
    // Layers of straw and a wavy ridge.
    g.fillStyle(THATCH_DARK);
    g.fillRect(left - 6, top + 2, width + 12, 1);
    for (let ly = top - 12; ly < top + 1; ly += 4) {
      const w = (ly - (top - 18)) / 21 * (width + 12);
      for (let tx = x - w / 2; tx < x + w / 2; tx += 3) g.fillRect(tx, ly + ((tx / 3) & 1), 2, 1);
    }
    g.fillStyle(lerpColor(thatch, 0xffffff, 0.2));
    for (let rx = x - 8; rx < x + 8; rx += 3) g.fillRect(rx, top - 17 + (((rx - x) / 3) & 1), 2, 2);
    // Eyebrow dormer.
    g.fillStyle(thatch);
    g.fillEllipse(x - 7, top - 4, 14, 8);
    leaded(g, x - 10, top - 5, 6, 4, hash(shade * 5) > 0.5);
  } else {
    const slate = kind === 'shop' ? 0x6a5a52 : SLATE;
    const slateDark = lerpColor(slate, 0x000000, 0.2);
    if (kind === 'house') {
      for (const cx of [left + 3, right - 9]) {
        g.fillStyle(0x8a7a64);
        g.fillRect(cx, top - 16, 6, 12);
        g.fillStyle(0x6b5e4c);
        g.fillRect(cx - 1, top - 17, 8, 2);
        g.fillStyle(0x9a5a44);
        g.fillRect(cx + 1, top - 19, 2, 2);
        g.fillRect(cx + 4, top - 19, 2, 2);
      }
    } else {
      g.fillStyle(0x8a5a48);
      g.fillRect(right - 10, top - 15, 5, 10);
    }
    g.fillStyle(slate);
    g.fillTriangle(left - 3, top, x, top - 14, right + 3, top);
    g.fillStyle(slateDark);
    for (let ry = top - 10; ry < top; ry += 3) {
      const w = (ry - (top - 14)) / 14 * (width + 6);
      g.fillRect(x - w / 2, ry, w, 1);
    }
    g.fillRect(left - 3, top - 1, width + 6, 2);
    g.fillStyle(0x8a4a3a);
    g.fillRect(x - 2, top - 15, 4, 2);
  }

  // Windows.
  const wx = side => Math.round(x + side * (half * 0.55) - 3);
  if (kind === 'cottage') {
    for (const side of [-1, 1]) {
      leaded(g, wx(side), y - 14, 6, 6, hash(shade * 9 + side) < 0.4);
      flowerBox(g, wx(side) - 1, y - 6, 8, shade * 7 + side);
    }
  } else if (kind === 'house') {
    for (const wy of [y - 15, y - 30]) {
      for (const side of [-1, 1]) {
        const ax = wx(side);
        g.fillStyle(lerpColor(wall, 0xffffff, 0.35));
        g.fillRect(ax - 1, wy - 2, 8, 1);
        g.fillRect(ax - 1, wy + 8, 8, 1);
        g.fillStyle(0xf0ebe0);
        g.fillRect(ax - 1, wy - 1, 8, 9);
        g.fillStyle(hash(shade * 11 + side + wy) < 0.3 ? WINDOW_WARM : GLASS);
        g.fillRect(ax, wy, 6, 7);
        g.fillStyle(0xf0ebe0);
        g.fillRect(ax, wy + 3, 6, 1);
        g.fillRect(ax + 3, wy, 1, 7);
      }
    }
    // Small centre window over the door.
    g.fillStyle(0xf0ebe0);
    g.fillRect(x - 3, y - 30, 6, 7);
    g.fillStyle(GLASS);
    g.fillRect(x - 2, y - 29, 4, 5);
  } else {
    // Bay shop window with small panes on one side, display goods, and an upper window.
    const bx = x - half + 3;
    const bw = Math.round(half - 8);
    g.fillStyle(0x3e4a44);
    g.fillRect(bx - 1, y - 14, bw + 2, 12);
    g.fillStyle(GLASS);
    g.fillRect(bx, y - 13, bw, 10);
    g.fillStyle(0x3e4a44);
    for (let px = bx + 3; px < bx + bw; px += 3) g.fillRect(px, y - 13, 1, 10);
    g.fillRect(bx, y - 9, bw, 1);
    const goods = [0xd9873a, 0xb8473f, 0x6f9a4a, 0xf2c14e];
    for (let gx = bx + 1; gx < bx + bw - 1; gx += 3) {
      g.fillStyle(goods[Math.floor(hash(gx + shade) * goods.length)]);
      g.fillRect(gx, y - 5, 2, 2);
    }
    leaded(g, x + half * 0.5 - 3, y - 14, 6, 6, false);
    // Striped awning over the bay and a hanging sign on a bracket.
    for (let ax = bx - 2, i = 0; ax < bx + bw + 2; ax += 3, i++) {
      g.fillStyle(i % 2 ? 0xf0ebe0 : [0x3f7a5a, 0xa84a3e, 0x3f5a8a][Math.floor(shade * 3)]);
      g.fillRect(ax, y - 18, 3, 3);
    }
    g.fillStyle(TIMBER);
    g.fillRect(x + 5, y - 20, 7, 1);
    g.fillRect(x + 11, y - 20, 1, 2);
    g.fillStyle(0xd6c9a8);
    g.fillRect(x + 8, y - 18, 6, 4);
    g.fillStyle(0x3e4a44);
    g.fillRect(x + 9, y - 17, 4, 1);
    // Bench by the door.
    g.fillStyle(0x6b5a48);
    g.fillRect(x + half - 12, y - 4, 9, 1);
    g.fillRect(x + half - 12, y - 3, 1, 3);
    g.fillRect(x + half - 4, y - 3, 1, 3);
  }

  // Door, centred, at least a person tall.
  if (kind === 'house') {
    g.fillStyle(0xf0ebe0);
    g.fillRect(x - 6, y - 17, 12, 17);
    g.fillCircle(x, y - 17, 6);
    g.fillStyle(GLASS);
    g.fillCircle(x, y - 17, 4);
    g.fillStyle(0xf0ebe0);
    g.fillRect(x - 4, y - 17, 8, 1);
    g.fillStyle([0x2f4a3a, 0x4a2f2f, 0x2f3a4a][Math.floor(shade * 3)]);
    g.fillRect(x - 4, y - 16, 8, 16);
    g.fillStyle(0xd9b56a);
    g.fillRect(x + 2, y - 8, 1, 1);
  } else {
    g.fillStyle(TIMBER);
    g.fillRect(x - 5, y - 16, 10, 1);
    g.fillStyle(kind === 'shop' ? 0x3e4a44 : DOOR);
    g.fillRect(x - 4, y - 15, 8, 15);
    g.fillStyle(lerpColor(DOOR, 0x000000, 0.25));
    for (let py = y - 13; py < y; py += 4) g.fillRect(x - 4, py, 8, 1);
    g.fillStyle(0xc9b48a);
    g.fillRect(x + 2, y - 8, 1, 1);
    if (kind === 'cottage') {
      // Porch hood and climbing roses.
      g.fillStyle(THATCH_DARK);
      g.fillTriangle(x - 7, y - 16, x, y - 21, x + 7, y - 16);
      g.fillStyle(0x5f8f52);
      for (let ry = y - 17; ry < y; ry += 2) g.fillRect(x - 7 + ((ry / 2) & 1), ry, 2, 2);
      g.fillStyle(0xd9605a);
      for (let ry = y - 16; ry < y; ry += 4) g.fillRect(x - 6, ry, 1, 1);
    }
  }
}

function drawFieldItem(g, x, y, kind, width, height, shade) {
  if (kind === 'bales') return drawBales(g, x, y, width);
  if (kind === 'poplar') {
    g.fillStyle(BARK);
    g.fillRect(x - 1, y - 12, 3, 12);
    g.fillStyle(LEAF[Math.floor(shade * LEAF.length)]);
    g.fillEllipse(x, y - height / 2 - 6, width, height - 8);
    g.fillStyle(LEAF_LIGHT);
    g.fillEllipse(x - 2, y - height / 2 - 10, width * 0.45, height * 0.6);
    return;
  }
  // Field maple: a short trunk under a round, layered crown.
  const crownY = y - height + width * 0.45;
  g.fillStyle(BARK);
  g.fillRect(x - 2, crownY, 5, y - crownY);
  const r = width / 2;
  g.fillStyle(0x4f7a46);
  g.fillEllipse(x, crownY + 2, width, r * 1.1);
  g.fillStyle(LEAF[Math.floor(shade * LEAF.length)]);
  g.fillCircle(x - r * 0.4, crownY - r * 0.2, r * 0.6);
  g.fillCircle(x + r * 0.4, crownY - r * 0.15, r * 0.58);
  g.fillCircle(x, crownY - r * 0.55, r * 0.62);
  g.fillStyle(LEAF_LIGHT);
  g.fillCircle(x - r * 0.25, crownY - r * 0.8, r * 0.26);
}

// Round bales seen end-on: a straw disc with the wrap's spiral, two wide or stacked three high.
function drawBales(g, x, y, width) {
  const spots = width > 20 ? [[-7, -6], [7, -6], [0, -17]] : [[0, -6]];
  for (const [dx, dy] of spots) {
    g.fillStyle(HAY_DARK);
    g.fillCircle(x + dx, y + dy, 6.5);
    g.fillStyle(HAY);
    g.fillCircle(x + dx - 0.5, y + dy - 0.5, 5.5);
    g.fillStyle(HAY_DARK);
    g.fillCircle(x + dx - 0.5, y + dy - 0.5, 3);
    g.fillStyle(HAY);
    g.fillCircle(x + dx, y + dy - 1, 1.6);
  }
}

// A sail on a mill stock: the stock runs from the hub, the lattice and cloth hang off one side.
// Angles turn clockwise as seen by the player.
function sails(g, cx, cy, angle, length, inner, wide, cloth, frame) {
  for (let i = 0; i < 4; i++) {
    const a = angle + i * Math.PI / 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    const vx = -uy, vy = ux;
    const p = (r, s) => [cx + ux * r + vx * s, cy + uy * r + vy * s];
    const [a0, a1, a2, a3] = [p(inner, 1), p(length, 1), p(length, wide), p(inner, wide)];
    g.fillStyle(cloth);
    g.fillTriangle(...a0, ...a1, ...a2);
    g.fillTriangle(...a0, ...a2, ...a3);
    g.lineStyle(1, frame, 1);
    for (let r = inner; r <= length; r += (length - inner) / 4) g.lineBetween(...p(r, 1), ...p(r, wide));
    g.lineBetween(...p(inner, wide), ...p(length, wide));
    g.lineStyle(2, frame, 1);
    g.lineBetween(...p(-2, 0), ...p(length + 2, 0));
  }
}

// Farm stand: a roadside stall under a striped awning, crates of pumpkins, apples and greens, and a
// chalkboard.
function drawFarmStand(g, x, y) {
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 24, y - 36, 2, 36);
  g.fillRect(x + 22, y - 36, 2, 36);
  g.fillStyle(0x8a6a4a);
  g.fillRect(x - 26, y - 15, 52, 4);
  g.fillRect(x - 24, y - 11, 48, 1);
  g.fillStyle(0x7a5638);
  g.fillRect(x - 24, y - 10, 48, 10);
  g.fillStyle(0x6b4a30);
  for (let bx = x - 22; bx < x + 24; bx += 6) g.fillRect(bx, y - 10, 1, 10);
  // Striped awning with a scalloped edge.
  for (let i = 0, ax = x - 30; ax < x + 30; ax += 6, i++) {
    g.fillStyle(i % 2 ? 0xece4d0 : 0xb85a4a);
    g.fillRect(ax, y - 42, 6, 6);
    g.fillCircle(ax + 3, y - 36, 3);
  }
  // Produce in crates on the counter.
  g.fillStyle(0x9a7a58);
  for (const cx of [-18, -2, 14]) g.fillRect(x + cx - 6, y - 19, 12, 4);
  g.fillStyle(0xd9873a);
  for (const dx of [-21, -17, -14, -19]) g.fillCircle(x + dx, y - (dx === -19 ? 22 : 20), 2.5);
  g.fillStyle(0xb8473f);
  for (const dx of [-5, -2, 1, -3]) g.fillCircle(x + dx, y - (dx === -3 ? 22 : 20), 1.6);
  g.fillStyle(0x6f9a4a);
  for (const dx of [11, 14, 17]) g.fillRect(x + dx - 1, y - 23, 3, 4);
  // Chalkboard on an A-frame.
  g.fillStyle(0x6b4a30);
  g.fillTriangle(x + 30, y, x + 36, y - 16, x + 42, y);
  g.fillStyle(0x3b3f3a);
  g.fillRect(x + 32, y - 13, 8, 9);
  g.fillStyle(0xe2e2dc);
  g.fillRect(x + 33, y - 11, 5, 1);
  g.fillRect(x + 33, y - 8, 4, 1);
}

// Red barn: a gambrel-roofed barn with white trim, a braced double door and a hayloft, beside a
// galvanised grain silo.
function drawRedBarn(g, x, y) {
  footing(g, x, y, 92, 0x7f7a72);
  g.fillStyle(0x9e4a3e);
  g.fillRect(x - 40, y - 40, 80, 40);
  g.fillStyle(0x86402f);
  for (let bx = x - 38; bx < x + 40; bx += 4) g.fillRect(bx, y - 40, 1, 40);
  // Gambrel roof: steep lower slopes, shallow upper ones.
  g.fillStyle(0x9e4a3e);
  g.fillTriangle(x - 40, y - 40, x - 30, y - 62, x + 40, y - 40);
  g.fillTriangle(x + 40, y - 40, x + 30, y - 62, x - 40, y - 40);
  g.fillRect(x - 30, y - 62, 60, 22);
  g.fillTriangle(x - 30, y - 62, x, y - 74, x + 30, y - 62);
  g.fillStyle(0x5a5f66);
  g.lineStyle(3, 0x5a5f66, 1);
  g.lineBetween(x - 44, y - 39, x - 30, y - 63);
  g.lineBetween(x - 30, y - 63, x, y - 75);
  g.lineBetween(x, y - 75, x + 30, y - 63);
  g.lineBetween(x + 30, y - 63, x + 44, y - 39);
  // Big braced doors and the hayloft door, trimmed in white.
  g.fillStyle(0x86402f);
  g.fillRect(x - 15, y - 30, 30, 30);
  g.lineStyle(1, 0xf0ebe0, 1);
  g.lineBetween(x - 15, y - 30, x + 15, y - 30);
  for (const dx of [-15, 0, 15]) g.lineBetween(x + dx, y - 30, x + dx, y);
  g.lineBetween(x - 15, y - 30, x, y);
  g.lineBetween(x - 15, y, x, y - 30);
  g.lineBetween(x, y - 30, x + 15, y);
  g.lineBetween(x, y, x + 15, y - 30);
  g.fillStyle(0xf0ebe0);
  g.fillRect(x - 8, y - 58, 16, 12);
  g.fillStyle(0x6b3a2e);
  g.fillRect(x - 6, y - 56, 12, 10);
  g.fillStyle(HAY);
  g.fillRect(x - 6, y - 50, 12, 4);
  g.fillStyle(0xf0ebe0);
  g.fillRect(x - 1, y - 72, 2, 3);
  // Silo: ribbed galvanised steel under a domed cap, with a caged ladder.
  const sx = x + 52;
  g.fillStyle(0xa9b0b4);
  g.fillRect(sx - 10, y - 100, 20, 100);
  g.fillStyle(0x8f969a);
  for (let ry = y - 96; ry < y; ry += 8) g.fillRect(sx - 10, ry, 20, 1);
  g.fillRect(sx + 6, y - 100, 4, 100);
  g.fillStyle(0xc4cace);
  g.fillEllipse(sx, y - 100, 20, 16);
  g.fillStyle(0xa9b0b4);
  g.fillRect(sx - 10, y - 100, 20, 2);
  g.fillStyle(0x6d7279);
  g.fillRect(sx - 1, y - 110, 2, 4);
  g.fillRect(sx - 7, y - 96, 1, 92);
  g.fillRect(sx - 4, y - 96, 1, 92);
  for (let ly = y - 94; ly < y - 4; ly += 4) g.fillRect(sx - 7, ly, 4, 1);
  // Lean-to shed on the west side with a stack of firewood and a cart wheel.
  g.fillStyle(0x86402f);
  g.fillRect(x - 58, y - 22, 18, 22);
  g.fillStyle(0x76382a);
  for (let bx = x - 57; bx < x - 40; bx += 3) g.fillRect(bx, y - 22, 1, 22);
  g.fillStyle(0x5a5f66);
  g.fillTriangle(x - 60, y - 21, x - 40, y - 32, x - 40, y - 21);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 56, y - 12, 14, 12);
  g.fillStyle(0x9a7a58);
  for (let wy = y - 11; wy < y; wy += 3) for (let wx = x - 55 + ((wy / 3) & 1); wx < x - 43; wx += 3) g.fillCircle(wx, wy, 1.2);
  g.lineStyle(1, 0x5a4636, 1);
  g.strokeCircle(x - 30, y - 6, 5);
  g.lineBetween(x - 35, y - 6, x - 25, y - 6);
  g.lineBetween(x - 30, y - 11, x - 30, y - 1);
  // White trim along the eaves and corner boards, and a louvred cupola on the ridge (its top
  // carries the weathervane).
  g.fillStyle(0xf0ebe0);
  g.fillRect(x - 40, y - 40, 2, 40);
  g.fillRect(x + 38, y - 40, 2, 40);
  g.fillRect(x - 40, y - 41, 80, 1);
  g.fillStyle(0xf0ebe0);
  g.fillRect(x - 4, y - 77, 8, 4);
  g.fillStyle(0x9e4a3e);
  g.fillRect(x - 3, y - 76, 6, 3);
  g.fillStyle(0xf0ebe0);
  for (let lx = x - 2; lx < x + 3; lx += 2) g.fillRect(lx, y - 76, 1, 3);
  g.fillStyle(0x5a5f66);
  g.fillTriangle(x - 5, y - 77, x, y - 79, x + 5, y - 77);
  // A barn star on the gable.
  g.fillStyle(0xf0ebe0);
  g.fillCircle(x, y - 66, 2.5);
  g.fillStyle(0x9e4a3e);
  g.fillCircle(x, y - 66, 1.2);
}

function weathervaneFx(g, x, y, elapsed) {
  // A cockerel on the ridge, swinging slowly with the breeze.
  const turn = Math.sin(elapsed * 0.6) > 0 ? 1 : -1;
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 3 * turn - (turn < 0 ? 1 : 0), y - 79, 7, 2);
  g.fillRect(x + 2 * turn, y - 82, 2, 3);
  g.fillRect(x - 3 * turn, y - 81, 1, 2);
}

// Scarecrow: a sack head under a straw hat, a patched shirt on a crossbar, straw at the cuffs.
function drawScarecrow(g, x, y) {
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 1, y - 36, 2, 36);
  g.fillRect(x - 13, y - 27, 26, 2);
  g.fillStyle(0x6f7d5c);
  g.fillRect(x - 5, y - 28, 10, 15);
  g.fillRect(x - 12, y - 28, 24, 4);
  g.fillStyle(0x8c4f4a);
  g.fillRect(x - 3, y - 22, 3, 3);
  g.fillStyle(0x4b4a46);
  g.fillRect(x - 4, y - 13, 3, 6);
  g.fillRect(x + 1, y - 13, 3, 6);
  g.fillStyle(0xd9c79a);
  g.fillCircle(x, y - 33, 4);
  g.fillStyle(0x3b3f3a);
  g.fillRect(x - 2, y - 34, 1, 1);
  g.fillRect(x + 1, y - 34, 1, 1);
  g.fillRect(x - 1, y - 31, 3, 1);
  g.fillStyle(0xc9a85a);
  g.fillRect(x - 8, y - 37, 16, 2);
  g.fillRect(x - 4, y - 41, 8, 4);
}

function scarecrowFx(g, x, y, elapsed) {
  // Straw tufts at the cuffs and hem flutter in the wind.
  g.fillStyle(0xe0c070);
  for (const [dx, dy, w] of [[-15, -27, 3], [13, -27, 3], [-3, -7, 2], [2, -7, 2]]) {
    const flick = Math.round(Math.sin(elapsed * 4 + dx) * 1);
    g.fillRect(x + dx + flick, y + dy, w, 2);
  }
}

// Post mill: a weatherboarded body on a brick-footed trestle, a ladder and tail pole behind, and
// four lattice sails that turn.
function drawPostMill(g, x, y, elapsed) {
  g.fillStyle(0x8a7a6a);
  g.fillRect(x - 18, y - 6, 8, 6);
  g.fillRect(x + 10, y - 6, 8, 6);
  g.lineStyle(2, 0x6b4a30, 1);
  g.lineBetween(x - 14, y - 6, x - 1, y - 26);
  g.lineBetween(x + 14, y - 6, x + 1, y - 26);
  g.lineBetween(x - 14, y - 6, x + 14, y - 6);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 2, y - 30, 4, 24);
  // Ladder and tail pole down the back.
  g.lineStyle(2, 0x5a3e2a, 1);
  g.lineBetween(x + 14, y - 32, x + 34, y);
  g.lineStyle(1, 0x7a5638, 1);
  g.lineBetween(x + 16, y - 36, x + 30, y - 2);
  g.lineBetween(x + 20, y - 36, x + 34, y - 2);
  for (let t = 0.15; t < 1; t += 0.17) g.lineBetween(x + 16 + 14 * t, y - 36 + 34 * t, x + 20 + 14 * t, y - 36 + 34 * t);
  // Buck: the weatherboarded body under a curved roof.
  g.fillStyle(0x7a6450);
  g.fillEllipse(x, y - 64, 36, 12);
  g.fillStyle(0xbfa98a);
  g.fillRect(x - 16, y - 64, 32, 34);
  g.fillStyle(0xa8916f);
  for (let ly = y - 61; ly < y - 30; ly += 4) g.fillRect(x - 16, ly, 32, 1);
  g.fillRect(x + 12, y - 64, 4, 34);
  g.fillStyle(0x5a4636);
  g.fillRect(x - 16, y - 31, 32, 2);
  g.fillStyle(GLASS);
  g.fillRect(x + 4, y - 44, 5, 5);
  sails(g, x - 3, y - 54, elapsed * 1.1 + Math.PI / 4, 40, 8, 9, 0xe8e0cc, 0x5a4636);
  g.fillStyle(0x3b3f3a);
  g.fillCircle(x - 3, y - 54, 3);
}

// Chapel: a limestone nave under slate with tall lancet windows, an arched door, and a west tower
// with a bell opening and a slender spire.
function drawChapel(g, x, y) {
  footing(g, x, y, 80, 0x8a857c);
  // Churchyard: a low wall and two headstones in front.
  g.fillStyle(0x9a948a);
  g.fillRect(x + 32, y - 5, 10, 5);
  g.fillStyle(0xb0aa9e);
  for (const hx of [x + 24, x + 36]) {
    g.fillRect(hx, y - 7, 4, 7);
    g.fillCircle(hx + 2, y - 7, 2);
  }
  // Nave: coursed stone with buttresses.
  g.fillStyle(0xcbc3b0);
  g.fillRect(x - 26, y - 34, 56, 34);
  g.fillStyle(0xb8af9a);
  for (let cy = y - 30, k = 0; cy < y; cy += 4, k++) {
    g.fillRect(x - 26, cy, 56, 1);
    for (let cx = x - 24 + (k % 2) * 4; cx < x + 30; cx += 8) g.fillRect(cx, cy - 3, 1, 3);
  }
  g.fillStyle(0xb0a792);
  for (const bx of [-24, 0, 26]) {
    g.fillRect(x + bx, y - 26, 4, 26);
    g.fillTriangle(x + bx, y - 26, x + bx + 4, y - 26, x + bx + 4, y - 31);
  }
  // Slate roof with a cross on the east gable.
  g.fillStyle(0x5f646b);
  g.fillTriangle(x - 30, y - 34, x + 2, y - 56, x + 34, y - 34);
  g.fillStyle(0x4f545a);
  for (let ry = y - 50; ry < y - 34; ry += 3) {
    const w = (ry - (y - 56)) / 22 * 64;
    g.fillRect(x + 2 - w / 2, ry, w, 1);
  }
  g.fillRect(x - 30, y - 35, 64, 2);
  g.fillStyle(0xcbc3b0);
  g.fillRect(x + 1, y - 62, 2, 7);
  g.fillRect(x - 1, y - 60, 6, 2);
  // Rose window in the gable.
  g.fillStyle(0x8a857c);
  g.fillCircle(x + 2, y - 42, 4);
  g.fillStyle(0xb85a7a);
  g.fillCircle(x + 2, y - 42, 3);
  g.fillStyle(0xd9b56a);
  g.fillRect(x + 1, y - 45, 2, 6);
  g.fillRect(x - 1, y - 43, 6, 2);
  // Lancet windows with coloured glass.
  for (const wx of [-14, 16]) {
    g.fillStyle(0x8a857c);
    g.fillRect(x + wx - 3, y - 28, 6, 16);
    g.fillCircle(x + wx, y - 28, 3);
    g.fillStyle(0x6a8ab0);
    g.fillRect(x + wx - 2, y - 27, 4, 14);
    g.fillCircle(x + wx, y - 27, 2);
    g.fillStyle(0xd9b56a);
    g.fillRect(x + wx - 2, y - 22, 4, 1);
    g.fillStyle(0xb8473f);
    g.fillRect(x + wx - 1, y - 18, 2, 3);
    g.fillStyle(0x8a857c);
    g.fillRect(x + wx, y - 27, 1, 14);
  }
  // Arched door under a stone surround with a hood mould.
  g.fillStyle(0x9a948a);
  g.fillRect(x - 6, y - 17, 12, 17);
  g.fillCircle(x, y - 17, 6);
  g.fillStyle(0x8a857c);
  g.fillRect(x - 8, y - 19, 2, 2);
  g.fillRect(x + 6, y - 19, 2, 2);
  g.fillStyle(DOOR);
  g.fillRect(x - 4, y - 16, 8, 16);
  g.fillCircle(x, y - 16, 4);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 4, y - 10, 8, 1);
  g.fillRect(x, y - 19, 1, 19);
  // West tower: buttressed, a clock, the belfry opening (bellFx swings the bell in it), a parapet
  // with pinnacles and the spire.
  g.fillStyle(0xc2b9a5);
  g.fillRect(x - 40, y - 68, 18, 68);
  g.fillStyle(0xb0a792);
  for (let cy = y - 64; cy < y; cy += 4) g.fillRect(x - 40, cy, 18, 1);
  g.fillRect(x - 42, y - 30, 2, 30);
  g.fillRect(x - 22, y - 30, 2, 30);
  g.fillStyle(0xf0ebe0);
  g.fillCircle(x - 31, y - 44, 4);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 31, y - 47, 1, 3);
  g.fillRect(x - 31, y - 44, 3, 1);
  g.fillStyle(0x8a857c);
  g.fillCircle(x - 31, y - 44, 4.5);
  g.fillStyle(0xf0ebe0);
  g.fillCircle(x - 31, y - 44, 3.5);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 31, y - 47, 1, 3);
  g.fillRect(x - 31, y - 44, 2, 1);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 34, y - 62, 6, 8);
  g.fillCircle(x - 31, y - 62, 3);
  g.fillStyle(0x8a857c);
  for (let lx = x - 34; lx < x - 28; lx += 2) g.fillRect(lx, y - 55, 1, 1);
  g.fillStyle(0xb0a792);
  g.fillRect(x - 41, y - 69, 20, 2);
  for (const px of [x - 41, x - 23]) {
    g.fillRect(px, y - 73, 2, 4);
    g.fillTriangle(px, y - 73, px + 2, y - 73, px + 1, y - 76);
  }
  g.fillStyle(0x5f646b);
  g.fillTriangle(x - 39, y - 68, x - 31, y - 90, x - 23, y - 68);
  g.fillStyle(0x4f545a);
  g.fillTriangle(x - 31, y - 90, x - 23, y - 68, x - 29, y - 68);
  g.fillStyle(0x3b3f44);
  g.fillRect(x - 31, y - 96, 1, 6);
  g.fillRect(x - 33, y - 94, 5, 1);
}

function bellFx(g, x, y, elapsed) {
  const swing = Math.round(Math.sin(elapsed * 2.2) * 1.2);
  g.fillStyle(0xc9a24a);
  g.fillRect(x - 33 + swing, y - 60, 4, 4);
  g.fillRect(x - 34 + swing, y - 57, 6, 1);
}

// Village green: a mown mound with a roofed well, two market stalls and a maypole (its ribbons
// stream in maypoleFx).
function drawVillageGreen(g, x, y) {
  g.fillStyle(0x7fae5f);
  g.fillEllipse(x, y - 1, 140, 10);
  g.fillStyle(0x8fbd6a);
  g.fillEllipse(x - 10, y - 3, 100, 5);
  // Well.
  g.fillStyle(0x9a948a);
  g.fillRect(x - 9, y - 12, 18, 12);
  g.fillStyle(0x7f7a72);
  for (const [dx, dy] of [[-8, -10], [-1, -10], [5, -10], [-5, -6], [2, -6], [-8, -2], [1, -2], [6, -2]]) g.fillRect(x + dx, y + dy, 4, 2);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 8, y - 28, 2, 16);
  g.fillRect(x + 6, y - 28, 2, 16);
  g.fillRect(x - 6, y - 22, 12, 1);
  g.fillStyle(0x8a5a3a);
  g.fillTriangle(x - 14, y - 27, x, y - 36, x + 14, y - 27);
  g.fillStyle(0x6e4e3a);
  g.fillRect(x - 14, y - 28, 28, 2);
  g.fillStyle(0x7a6a58);
  g.fillRect(x - 2, y - 20, 4, 4);
  // Two market stalls with muted striped awnings.
  for (const [sx, a, b] of [[-40, 0x6f9a6a, 0xe8e2d4], [40, 0x5f7a96, 0xe8e2d4]]) {
    g.fillStyle(0x6b4a30);
    g.fillRect(x + sx - 14, y - 26, 2, 26);
    g.fillRect(x + sx + 12, y - 26, 2, 26);
    g.fillStyle(0x8a6a4a);
    g.fillRect(x + sx - 15, y - 12, 30, 3);
    g.fillStyle(0xe2dccb);
    g.fillRect(x + sx - 13, y - 9, 26, 9);
    for (let i = 0, ax = x + sx - 17; ax < x + sx + 17; ax += 5, i++) {
      g.fillStyle(i % 2 ? b : a);
      g.fillRect(ax, y - 31, 5, 5);
    }
    // Goods: loaves and jars on one, cheeses and flowers on the other.
    const goods = sx < 0 ? [0xc9955a, 0xd8b07a, 0xc9955a] : [0xe6cf7a, 0xb8473f, 0xe6cf7a];
    goods.forEach((color, i) => {
      g.fillStyle(color);
      g.fillEllipse(x + sx - 8 + i * 8, y - 14, 6, 4);
    });
  }
  // Maypole with a garland crown.
  g.fillStyle(0xe8e2d4);
  g.fillRect(x - 63, y - 60, 2, 60);
  g.fillStyle(0x6f9a4a);
  g.fillEllipse(x - 62, y - 58, 10, 4);
  g.fillStyle(0xc9a24a);
  g.fillCircle(x - 62, y - 62, 2);
}

function maypoleFx(g, x, y, elapsed) {
  const ribbons = [0xb85a4a, 0x5f7a96, 0xd8c06a, 0x6f9a6a, 0xe8e2d4];
  ribbons.forEach((color, i) => {
    g.fillStyle(color);
    const side = i % 2 ? 1 : -1;
    for (let s = 0; s < 6; s++) {
      const t = s / 6;
      const wave = Math.sin(elapsed * 3 + i * 1.3 + s * 0.9) * 2 * t;
      g.fillRect(x - 62 + side * (3 + t * (8 + i * 2)), y - 57 + t * (16 + i * 4) + wave, 2, 2);
    }
  });
}

// The Great Windmill: the village's signature. A tapering limewashed tower on a stone base, a timber
// gallery, a green boat-shaped cap with a fantail, and four big lattice sails that turn.
function drawGreatWindmill(g, x, y, elapsed) {
  footing(g, x, y, 50, 0x8a857c);
  const top = y - 96;
  const half = h => 22 - 8 * (y - h) / (y - top);
  // Tapering tower: limewash above, a dressed stone base below.
  g.fillStyle(0xe9e3d6);
  g.fillTriangle(x - 22, y, x - 14, top, x, y);
  g.fillTriangle(x + 22, y, x + 14, top, x, y);
  g.fillRect(x - 14, top, 28, y - top);
  g.fillStyle(0xd3cbbb);
  g.fillTriangle(x + 10, y, x + 10, top, x + 22, y);
  g.fillTriangle(x + 10, top, x + 14, top, x + 22, y);
  g.fillStyle(0x9a8f80);
  g.fillRect(x - half(y - 28), y - 28, half(y - 28) * 2, 28);
  g.fillStyle(0x857b6d);
  for (let cy = y - 25; cy < y; cy += 5) g.fillRect(x - 21, cy, 42, 1);
  // Windows climbing the tower.
  g.fillStyle(0x3b4a52);
  for (const [dx, wy] of [[-6, y - 56], [5, y - 72], [-4, y - 86]]) g.fillRect(x + dx - 2, wy, 4, 6);
  g.fillStyle(GLASS);
  for (const [dx, wy] of [[-6, y - 56], [5, y - 72], [-4, y - 86]]) g.fillRect(x + dx - 1, wy + 1, 2, 2);
  // Timber gallery round the tower, on brackets.
  g.fillStyle(0x5a4636);
  g.fillRect(x - 30, y - 42, 60, 3);
  for (const px of [-28, -18, 16, 26]) g.fillRect(x + px, y - 50, 1, 8);
  g.fillRect(x - 30, y - 50, 60, 1);
  g.lineStyle(1, 0x5a4636, 1);
  g.lineBetween(x - 30, y - 39, x - 20, y - 32);
  g.lineBetween(x + 30, y - 39, x + 20, y - 32);
  // Arched green door at the foot.
  g.fillStyle(0x7f7a72);
  g.fillRect(x - 6, y - 17, 12, 17);
  g.fillCircle(x, y - 17, 6);
  g.fillStyle(0x3f5a4a);
  g.fillRect(x - 4, y - 16, 8, 16);
  g.fillCircle(x, y - 16, 4);
  g.fillStyle(0xc9a24a);
  g.fillRect(x + 2, y - 8, 1, 1);
  // Boat-shaped cap and fantail.
  g.fillStyle(0x3f5a4a);
  g.fillEllipse(x, top - 3, 36, 18);
  g.fillRect(x - 18, top - 3, 36, 4);
  g.fillStyle(0x4f6e5a);
  g.fillEllipse(x - 4, top - 6, 22, 8);
  g.fillStyle(0xc9a24a);
  g.fillRect(x - 1, top - 16, 2, 5);
  g.lineStyle(1, 0x5a4636, 1);
  g.lineBetween(x + 16, top - 2, x + 26, top - 14);
  const fan = elapsed * 3;
  for (let i = 0; i < 4; i++) {
    const a = fan + i * Math.PI / 4;
    g.lineBetween(x + 26 - Math.cos(a) * 5, top - 14 - Math.sin(a) * 5, x + 26 + Math.cos(a) * 5, top - 14 + Math.sin(a) * 5);
  }
  sails(g, x - 4, top + 4, elapsed * 0.8 + Math.PI / 4, 58, 9, 12, 0xf2ece0, 0x5a4636);
  g.fillStyle(0x3b3f3a);
  g.fillCircle(x - 4, top + 4, 4);
  g.fillStyle(0x6b737c);
  g.fillCircle(x - 4, top + 4, 1.5);
}

// Farmhouse: a warm stone farmhouse with a tiled roof, green shutters, a brick chimney and a porch
// canopy, with a chicken coop beside it.
// Farmhouse: rubble-stone walls under a pantile roof with two dormers, a chimney at (22, 74) for
// smokeFx, shuttered windows, a porch with posts over the centred door, a lean-to with a water butt,
// a bench, and the chicken coop with its ramp.
function drawFarmhouse(g, x, y) {
  footing(g, x, y, 76);
  const wall = 0xc9b99a;
  g.fillStyle(wall);
  g.fillRect(x - 36, y - 44, 72, 44);
  // Rubble stones.
  for (let sy = y - 42, k = 0; sy < y - 2; sy += 4, k++) {
    for (let sx = x - 35 + (k % 2) * 3; sx < x + 34; sx += 6) {
      g.fillStyle(hash(sx * 0.3 + sy) > 0.5 ? 0xb4a586 : 0xd6c8aa);
      g.fillRect(sx, sy, 4 + Math.round(hash(sx + sy) * 2), 3);
    }
  }
  g.fillStyle(0x000000, 0.08);
  g.fillRect(x + 32, y - 44, 4, 44);
  // Lean-to on the west end with a water butt.
  g.fillStyle(0xb4a586);
  g.fillRect(x - 50, y - 22, 14, 22);
  g.fillStyle(0x86493a);
  g.fillTriangle(x - 52, y - 21, x - 36, y - 30, x - 36, y - 21);
  g.fillStyle(0x6b4a32);
  g.fillRect(x - 46, y - 14, 6, 14);
  g.fillStyle(0x6b5a48);
  g.fillRect(x - 58, y - 9, 6, 9);
  g.fillStyle(0x4a3e34);
  g.fillRect(x - 58, y - 6, 6, 1);
  g.fillRect(x - 58, y - 2, 6, 1);
  // Chimney then the pantile roof with its courses and ridge.
  g.fillStyle(0x8a5a48);
  g.fillRect(x + 18, y - 74, 8, 26);
  g.fillStyle(0x6f4436);
  g.fillRect(x + 17, y - 75, 10, 2);
  g.fillStyle(0x9a5a44);
  g.fillTriangle(x - 41, y - 44, x, y - 66, x + 41, y - 44);
  g.fillStyle(0x86493a);
  for (let ry = y - 62; ry < y - 44; ry += 3) {
    const w = (ry - (y - 66)) / 22 * 82;
    g.fillRect(x - w / 2, ry, w, 1);
    for (let tx = x - w / 2 + ((ry / 3) & 1) * 2; tx < x + w / 2; tx += 4) g.fillRect(tx, ry - 2, 1, 2);
  }
  g.fillStyle(0x7a3f32);
  g.fillRect(x - 41, y - 45, 82, 2);
  g.fillRect(x - 3, y - 67, 6, 2);
  // Two dormers.
  for (const dx of [-16, 10]) {
    g.fillStyle(0xe8e0cc);
    g.fillRect(x + dx - 1, y - 56, 8, 9);
    g.fillStyle(0x7a3f32);
    g.fillTriangle(x + dx - 3, y - 56, x + dx + 3, y - 61, x + dx + 9, y - 56);
    g.fillStyle(GLASS);
    g.fillRect(x + dx + 1, y - 54, 4, 5);
    g.fillStyle(0xe8e0cc);
    g.fillRect(x + dx + 3, y - 54, 1, 5);
  }
  // Windows with shutters, two up and two down, under stone lintels.
  for (const [dx, wy] of [[-22, y - 36], [16, y - 36], [-22, y - 18], [16, y - 18]]) {
    g.fillStyle(0xe2d8c0);
    g.fillRect(x + dx - 2, wy - 2, 12, 2);
    g.fillStyle(0x5f7a5a);
    g.fillRect(x + dx - 3, wy, 2, 9);
    g.fillRect(x + dx + 9, wy, 2, 9);
    g.fillStyle(0x4f6a4a);
    for (let ly = wy + 1; ly < wy + 9; ly += 2) {
      g.fillRect(x + dx - 3, ly, 2, 1);
      g.fillRect(x + dx + 9, ly, 2, 1);
    }
    g.fillStyle(0xf0ebe0);
    g.fillRect(x + dx - 1, wy, 10, 9);
    g.fillStyle(hash(dx + wy) > 0.6 ? WINDOW_WARM : GLASS);
    g.fillRect(x + dx, wy + 1, 8, 7);
    g.fillStyle(0xf0ebe0);
    g.fillRect(x + dx + 4, wy + 1, 1, 7);
    g.fillRect(x + dx, wy + 4, 8, 1);
    if (wy === y - 18) flowerBox(g, x + dx - 1, wy + 10, 10, dx);
  }
  // Porch: a pitched hood on two posts over the door, with a step.
  g.fillStyle(0x6b4a32);
  g.fillRect(x - 5, y - 16, 10, 16);
  g.fillStyle(0x5a3e2a);
  g.fillRect(x - 5, y - 9, 10, 1);
  g.fillStyle(0xd9b56a);
  g.fillRect(x + 3, y - 8, 1, 1);
  g.fillStyle(0xe8e0cc);
  g.fillRect(x - 10, y - 20, 1, 20);
  g.fillRect(x + 9, y - 20, 1, 20);
  g.fillStyle(0x86493a);
  g.fillTriangle(x - 12, y - 20, x, y - 27, x + 12, y - 20);
  g.fillStyle(0x7a3f32);
  g.fillRect(x - 12, y - 21, 24, 1);
  g.fillStyle(0xa59d8c);
  g.fillRect(x - 8, y - 1, 16, 1);
  // Bench and shrubs.
  g.fillStyle(0x6b5a48);
  g.fillRect(x + 22, y - 5, 10, 1);
  g.fillRect(x + 22, y - 4, 1, 4);
  g.fillRect(x + 31, y - 4, 1, 4);
  g.fillStyle(0x6f8a5a);
  g.fillCircle(x - 32, y - 4, 4);
  g.fillCircle(x + 36, y - 3, 3);
  // Chicken coop on legs with a ramp.
  g.fillStyle(0x8a6a4a);
  g.fillRect(x + 44, y - 13, 18, 10);
  g.fillStyle(0x7a5a3e);
  for (let cx = x + 46; cx < x + 62; cx += 3) g.fillRect(cx, y - 13, 1, 10);
  g.fillStyle(0x8a6a4a);
  g.fillRect(x + 45, y - 3, 2, 3);
  g.fillRect(x + 59, y - 3, 2, 3);
  g.fillStyle(0x6b5a48);
  g.fillTriangle(x + 42, y - 12, x + 53, y - 19, x + 64, y - 12);
  g.fillStyle(0x3b2e24);
  g.fillRect(x + 48, y - 9, 4, 4);
  g.lineStyle(1, 0x7a5638, 1);
  g.lineBetween(x + 48, y - 5, x + 40, y);
  g.fillStyle(0xf0ebe0);
  g.fillRect(x + 38, y - 3, 3, 2);
  g.fillStyle(0xd9605a);
  g.fillRect(x + 40, y - 4, 1, 1);
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
export const WINDMILL_BUILDINGS = Object.freeze([
  ...fieldStreet(),
  ...villageStreet(),
  ...WINDMILL_LANDMARKS.map((landmark, i) => ({ maxHealth: 260, seed: 120 + i, ...landmark })),
]);

// Crop plots between the landmarks. Each field span is cut around every landmark's clear space,
// then split into plots of PLOT px or so, cycling through the crops.
const PLOT = 150;
const CROPS = ['pasture', 'wheat', 'pasture', 'ploughed', 'barley'];
function cropPlots() {
  const plots = [];
  for (const [from, to] of FIELD_SPANS) {
    const cuts = WINDMILL_LANDMARKS.filter(l => l.yard && l.x > from && l.x < to)
      .map(l => [l.x - l.width / 2 - 8, l.x + l.width / 2 + 8]).sort((a, b) => a[0] - b[0]);
    let start = from;
    for (const [a, b] of [...cuts, [to, to]]) {
      for (let x = start; a - x > 30;) {
        const end = Math.min(a, a - x < PLOT * 1.6 ? a : x + PLOT);
        plots.push({ from: Math.round(x), to: Math.round(end), crop: CROPS[plots.length % CROPS.length] });
        x = end + 6;
      }
      start = Math.max(start, b);
    }
  }
  return plots;
}
export const PLOTS = Object.freeze(cropPlots());

// buildings: false leaves the street and landmarks to a mode that draws them itself (evil mode).
export function drawWindmill(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((WINDMILL.from + WINDMILL.to) / 2, cameraX);
  const half = (WINDMILL.to - WINDMILL.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawFarmline(g, left, right, seaY, cameraX, FAR_PARALLAX, 0xa6c8bc, 0.6, 0.25);
  drawFarmline(g, left, right, seaY, cameraX, NEAR_PARALLAX, 0x90b8a4, 1, 0.5);
  drawCrops(g, left, right, seaY, cameraX, elapsed);
  if (!buildings) return;
  for (const building of WINDMILL_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    const y = windmillBase(building.x, seaY);
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}

// Background rows: low hedgerow mounds and, now and then, a distant barn or silo. Flat and
// detail-free, pivoting on the area's centre and clipped to it, like the city skyline.
function drawFarmline(g, left, right, seaY, cameraX, parallax, color, scale, salt) {
  const shift = (cameraX - nearest((WINDMILL.from + WINDMILL.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, WINDMILL.from, WINDMILL.to);
    if (fade <= 0) continue;
    g.fillStyle(color, fade);
    const seed = Math.round(wx / SKYLINE_STEP);
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const roll = hash(seed + salt);
    const unit = scale * CITY_SCALE;
    if (roll < 0.07) {
      // A distant barn: a block under a pitched roof.
      const w = Math.round(30 * unit), h = Math.round(16 * unit);
      g.fillRect(x, y - h, w, h);
      g.fillTriangle(x - 2, y - h, x + w / 2, y - h - Math.round(10 * unit), x + w + 2, y - h);
    } else if (roll < 0.11) {
      // A distant silo.
      const h = Math.round(34 * unit);
      g.fillRect(x + 6, y - h, Math.round(9 * unit), h);
      g.fillCircle(x + 6 + 4.5 * unit, y - h, 4.5 * unit);
    }
    // Hedgerow mounds run underneath, from three stepped rects like the forest treeline.
    const tall = Math.round((10 + hash(seed + 0.4 + salt) * 14) * unit);
    const r = 11 + Math.round(hash(seed + 0.7 + salt) * 4);
    const top = y - tall;
    g.fillRect(x, top + 5, 2 * r, y - top - 5);
    g.fillRect(x + 4, top + 1, 2 * r - 8, 5);
  }
}

// Ground cover on the plots, standing up from under the terrain cap: wheat and barley with heads
// that sway in the wind, ploughed furrows, and pasture tufts with the odd wildflower. Hedges mark
// the plot edges.
const CROP_LOOK = {
  wheat: { body: 0xcbb25e, head: 0xe0c978, tall: 12 },
  barley: { body: 0x9aae5a, head: 0xb7c46e, tall: 10 },
  ploughed: { body: 0x7a5e44, head: 0x5e4634, tall: 5 },
  pasture: { body: 0x7fae5f, head: 0x6f9e50, tall: 4 },
};
function drawCrops(g, left, right, seaY, cameraX, elapsed) {
  for (const plot of PLOTS) {
    const from = nearest(plot.from, cameraX);
    const to = from + (plot.to - plot.from);
    if (to < left || from > right) continue;
    const look = CROP_LOOK[plot.crop];
    const a = Math.max(from, Math.floor(left / 3) * 3);
    const b = Math.min(to, right);
    // Body in 12 px runs that follow the ground.
    for (let x = a; x < b; x += 12) {
      const w = Math.min(12, b - x);
      const base = seaY - Math.max(0, elevation(wrapX(x))) + 3;
      g.fillStyle(look.body);
      g.fillRect(x, base - look.tall, w + 1, look.tall);
    }
    g.fillStyle(look.head);
    for (let x = Math.ceil(a / 3) * 3; x < b; x += 3) {
      const base = seaY - Math.max(0, elevation(wrapX(x))) + 3;
      if (plot.crop === 'wheat' || plot.crop === 'barley') {
        const sway = Math.round(Math.sin(elapsed * 1.6 + x * 0.045) * 1.2);
        g.fillRect(x + sway, base - look.tall - 2, 2, 3);
      } else if (plot.crop === 'ploughed') {
        if (x % 6 === 0) g.fillRect(x, base - look.tall, 3, look.tall - 2);
      } else if (hash(x * 0.37) < 0.25) {
        g.fillRect(x, base - look.tall - 2, 1, 3);
        if (hash(x * 0.53) < 0.12) {
          g.fillStyle(hash(x) < 0.5 ? 0xe8e2d4 : 0xd8c06a);
          g.fillRect(x, base - look.tall - 3, 2, 2);
          g.fillStyle(look.head);
        }
      }
    }
    // Low hedges at both plot ends.
    for (const hx of [from - 3, to - 3]) {
      if (hx + 6 < left || hx > right) continue;
      const base = seaY - Math.max(0, elevation(wrapX(hx))) + 3;
      g.fillStyle(0x5a8550);
      g.fillRect(hx, base - 12, 7, 12);
      g.fillRect(hx + 1, base - 14, 5, 2);
    }
  }
}
