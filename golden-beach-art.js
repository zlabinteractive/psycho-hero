import { CIRCUMFERENCE, elevation, lerpColor } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled } from './city-art.js';

// Golden Beach, Sunland's beach where the Blue Sea comes ashore, built to
// game-design-rules/city-design-rules.md. The sea lies to the west, so the beach mirrors Shell Beach:
// the ferry pier runs from the sand out over the water to the terminal where the Bayport ferry ties
// up; on the sand, rows of thatched cabanas (the street: sand and terracotta under palm thatch, each
// with its door) frame the landmarks, each in its own palette: the lookout tower (the signature,
// tallest on the beach, its pennant flying), the beach club under its great thatched roof, and the
// sand sculptures by the town end. Date palms, loungers, parasols and a volleyball net dot the sand
// as scenery.
// Everything that can break is listed once in GOLDEN_BEACH_BUILDINGS, so evil mode can promote it.
export const GOLDEN_BEACH = { from: 25300, to: 25900 };
// The dry sand: walkers and traffic keep to it; the shore lies just west of its start.
export const GOLDEN_SAND = { from: 25500, to: 25900 };
const SEA_Y_OFFSET = 3;

const SAND_DARK = 0xd2b47a;
const SAND_SHADE = 0xc4a46c;
const WOOD = 0x8a6a4c;
const WOOD_DARK = 0x684e38;
const WOOD_LIGHT = 0xa8865e;
const THATCH = 0xc9a462;
const THATCH_DARK = 0xa8844a;
const THATCH_LIGHT = 0xdcbc7c;
const TERRACOTTA = 0xb87a58;
const LINEN = 0xece4d2;
const PALM_TRUNK = [0x8a6e4e, 0x7a5e42];
const PALM_LEAF = [0x6f8a4a, 0x5f7a40, 0x80985a];
const DATES = 0xa8603a;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

export function goldenBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// The ferry pier's deck, in art px above sea level, and its span. People on it stand this high.
const DECK = 14;
const PIER_X = 25470;
const PIER_ART_WIDTH = 150;

const LANDMARK_ART = [
  { id: 'ferry-pier', open: true, x: PIER_X, draw: drawFerryPier, clear: PIER_ART_WIDTH / 2, width: PIER_ART_WIDTH, height: 40, maxHealth: 320 },
  { id: 'lookout-tower', x: 25676, door: true, draw: drawLookoutTower, fx: pennantFx, clear: 20, width: 30, height: 74, maxHealth: 180 },
  { id: 'beach-club', x: 25772, door: true, draw: drawBeachClub, clear: 26, width: 50, height: 36, maxHealth: 160 },
  { id: 'sand-sculptures', open: true, x: 25876, draw: drawSandSculptures, clear: 16, width: 34, height: 24, maxHealth: 90 },
];
export const GOLDEN_BEACH_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// The pier deck in world px: its span and its height above sea level, like Shell Beach's pier.
export const FERRY_DECK = Object.freeze({
  from: PIER_X - PIER_ART_WIDTH / 2 * CITY_SCALE + 4, to: PIER_X + PIER_ART_WIDTH / 2 * CITY_SCALE - 4,
  rise: DECK * CITY_SCALE - SEA_Y_OFFSET,
});

// Two rows of cabanas: the beach's street, between the pier's landward end and the tower, and
// between the beach club and the sculptures.
const CABANA_ROWS = [[25576, 25646], [25808, 25853]];
const CABANA_ART = 15;
function cabanas() {
  const list = [];
  const width = CABANA_ART * CITY_SCALE;
  let i = 0;
  for (const [from, to] of CABANA_ROWS) {
    for (let x = from + width / 2; x + width / 2 <= to; i++, x += width + 2) {
      const seed = i + 0.73;
      const tall = 16 + Math.round(hash(seed) * 3);
      const curtain = [LINEN, 0xd8b89a, 0xc9b8a0][i % 3];
      list.push({
        id: `golden-cabana-${i}`, seed, kind: 'cabana', x, width, height: (tall + 8) * CITY_SCALE, roof: (tall + 4) * CITY_SCALE,
        maxHealth: 60, door: true,
        draw: scaled((g, at, y) => drawCabana(g, at, y, tall, curtain, hash(seed + 0.5))),
      });
    }
  }
  return list;
}

// Cabana: a timber frame on posts, drawn linen curtains tied back, under a shaggy palm-thatch roof.
function drawCabana(g, x, y, tall, curtain, look) {
  const w = CABANA_ART;
  const left = Math.round(x - w / 2);
  const top = y - tall;
  // Back wall of woven reed, the posts, and a raised floor.
  g.fillStyle(0xb89a6a);
  g.fillRect(left + 1, top + 2, w - 2, tall - 3);
  g.fillStyle(0xa88a5c);
  for (let by = top + 4; by < y - 1; by += 2) g.fillRect(left + 1, by, w - 2, 1);
  g.fillStyle(WOOD_DARK);
  g.fillRect(left, top + 1, 1, tall - 1);
  g.fillRect(left + w - 1, top + 1, 1, tall - 1);
  g.fillRect(left - 1, y - 2, w + 2, 2);
  // Doorway in the centre, a person tall, with curtains tied back to each side.
  const door = 12;
  g.fillStyle(look < 0.5 ? 0x5a4a3a : 0x6a5640);
  g.fillRect(x - 4, y - 2 - door, 8, door);
  g.fillStyle(curtain);
  g.fillRect(left + 1, top + 2, 3, tall - 4);
  g.fillRect(left + w - 4, top + 2, 3, tall - 4);
  g.fillRect(x - 5, top + 2, 1, 4);
  g.fillRect(x + 4, top + 2, 1, 4);
  g.fillStyle(lerpColor(curtain, 0x000000, 0.15));
  g.fillRect(left + 3, top + 8, 1, 2);
  g.fillRect(left + w - 4, top + 8, 1, 2);
  if (look < 0.4) {
    // A lounger cushion and a towel inside.
    g.fillStyle(TERRACOTTA);
    g.fillRect(x - 3, y - 5, 6, 2);
  }
  // Thatch: a low pyramid with a ragged fringe.
  g.fillStyle(THATCH);
  g.fillTriangle(left - 3, top + 2, x, top - 7, left + w + 3, top + 2);
  g.fillStyle(THATCH_DARK);
  for (let fx = left - 3; fx < left + w + 3; fx += 2) g.fillRect(fx, top + 2, 1, 1 + ((fx - left) & 1));
  g.fillStyle(THATCH_LIGHT);
  g.lineStyle(1, THATCH_LIGHT);
  g.lineBetween(x, top - 7, x - 5, top - 1);
  g.fillStyle(WOOD_DARK);
  g.fillRect(x, top - 9, 1, 2);
}

// The ferry pier: a heavy timber deck on piles, a slipway down to the water at its head, and the
// little white terminal with a terracotta roof and a flag; the Bayport ferry lies alongside.
function drawFerryPier(g, x, y) {
  const half = PIER_ART_WIDTH / 2;
  const left = x - half;
  const right = x + half;
  const deck = y - DECK;
  g.fillStyle(WOOD_DARK);
  for (let px = left + 6; px < right; px += 12) {
    g.fillRect(px, deck + 2, 2, DECK + 4);
    g.fillRect(px - 1, deck + 2, 4, 1);
  }
  g.lineStyle(1, 0x5a4232);
  for (let px = left + 6; px + 12 < right; px += 12) {
    g.lineBetween(px + 1, deck + 3, px + 13, deck + 9);
  }
  g.fillStyle(WOOD);
  g.fillRect(left, deck, PIER_ART_WIDTH, 3);
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(left, deck, PIER_ART_WIDTH, 1);
  // Rail along the landward two-thirds, with bollards toward the head.
  g.fillStyle(WOOD_DARK);
  for (let px = left + 40; px <= right; px += 10) g.fillRect(px, deck - 6, 1, 6);
  g.fillRect(left + 40, deck - 6, PIER_ART_WIDTH - 40, 1);
  g.fillStyle(0x3f4246);
  for (const bx of [left + 6, left + 22, left + 36]) {
    g.fillRect(bx, deck - 3, 3, 3);
    g.fillRect(bx - 1, deck - 4, 5, 1);
  }
  // Lamp posts with lantern heads.
  for (const lx of [left + 70, left + 112]) {
    g.fillStyle(0x3f3a34);
    g.fillRect(lx, deck - 15, 1, 15);
    g.fillRect(lx - 1, deck - 18, 3, 3);
    g.fillStyle(0xf0dca0);
    g.fillRect(lx, deck - 17, 1, 1);
  }
  // The terminal at the head: whitewash, an arched window, terracotta pantiles and a flag.
  const tx = left + 6;
  g.fillStyle(0xeee6d6);
  g.fillRect(tx, deck - 18, 28, 18);
  g.fillStyle(0xdcd2be);
  g.fillRect(tx + 24, deck - 18, 4, 18);
  g.fillStyle(0x5a6a74);
  g.fillRect(tx + 10, deck - 13, 8, 13);
  g.fillCircle(tx + 14, deck - 13, 4);
  g.fillStyle(0xcfe0e6);
  g.fillRect(tx + 3, deck - 13, 4, 5);
  g.fillRect(tx + 21, deck - 13, 4, 5);
  g.fillStyle(TERRACOTTA);
  g.fillRect(tx - 2, deck - 21, 32, 3);
  g.fillStyle(lerpColor(TERRACOTTA, 0x000000, 0.18));
  for (let rx = tx - 2; rx < tx + 30; rx += 3) g.fillRect(rx, deck - 21, 1, 3);
  g.fillStyle(0x6a6e72);
  g.fillRect(tx + 26, deck - 34, 1, 13);
  // A sign board over the door: a ferry and an arrow.
  g.fillStyle(0x4f7a86);
  g.fillRect(tx + 8, deck - 17, 12, 3);
  g.fillStyle(LINEN);
  g.fillRect(tx + 10, deck - 16, 8, 1);
  // The ferry moored alongside, west of the head: a white hull with a blue band and a wheelhouse.
  const fx = left - 30;
  const water = y - 2;
  g.fillStyle(0xe8e4dc);
  g.fillRect(fx - 24, water - 9, 50, 7);
  g.fillTriangle(fx - 30, water - 9, fx - 24, water - 9, fx - 24, water - 2);
  g.fillStyle(0x4f6a86);
  g.fillRect(fx - 28, water - 4, 54, 2);
  g.fillStyle(0xdcd8cc);
  g.fillRect(fx - 12, water - 17, 30, 8);
  g.fillStyle(0x6a8a9a);
  for (let wx = fx - 10; wx < fx + 16; wx += 5) g.fillRect(wx, water - 15, 3, 3);
  g.fillStyle(0xe8e4dc);
  g.fillRect(fx + 6, water - 22, 10, 5);
  g.fillStyle(0x3f4a52);
  g.fillRect(fx + 8, water - 21, 6, 2);
  g.fillStyle(0xb8604a);
  g.fillRect(fx + 2, water - 26, 3, 9);
  // Mooring lines to the bollards.
  g.lineStyle(1, 0xbfae94);
  g.lineBetween(fx + 26, water - 8, left + 7, deck - 3);
}

// The lookout tower: a tall timber trestle, a ladder up one side, a shaded deck with a thatched hat
// and binoculars on a post. The pennant streams from the peak (pennantFx).
const LOOKOUT_DECK = 44;
const LOOKOUT_TOP = 72;
function drawLookoutTower(g, x, y) {
  const deck = y - LOOKOUT_DECK;
  g.lineStyle(2, WOOD_DARK);
  g.lineBetween(x - 13, y, x - 9, deck);
  g.lineBetween(x + 13, y, x + 9, deck);
  g.lineStyle(1, WOOD);
  for (const [a, b] of [[0, 14], [14, 28], [28, 42]]) {
    const ya = y - a;
    const yb = y - b;
    const wa = 13 - a / 11;
    const wb = 13 - b / 11;
    g.lineBetween(x - wa, ya, x + wb, yb);
    g.lineBetween(x + wa, ya, x - wb, yb);
    g.lineBetween(x - wb, yb, x + wb, yb);
  }
  // Ladder up the landward side.
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(x + 12, deck + 2, 1, LOOKOUT_DECK - 2);
  g.fillRect(x + 16, deck + 2, 1, LOOKOUT_DECK - 2);
  for (let ry = deck + 4; ry < y; ry += 4) g.fillRect(x + 12, ry, 5, 1);
  // Deck and rails.
  g.fillStyle(WOOD_DARK);
  g.fillRect(x - 14, deck, 28, 2);
  g.fillStyle(WOOD);
  g.fillRect(x - 14, deck - 7, 1, 7);
  g.fillRect(x + 13, deck - 7, 1, 7);
  g.fillRect(x - 14, deck - 7, 28, 1);
  g.fillRect(x - 14, deck - 4, 28, 1);
  // Shade posts, the cabin and its door.
  g.fillStyle(0xb09670);
  g.fillRect(x - 9, deck - 15, 18, 15);
  g.fillStyle(0xa08a66);
  for (let by = deck - 13; by < deck; by += 3) g.fillRect(x - 9, by, 18, 1);
  g.fillStyle(0x4a3e34);
  g.fillRect(x + 1, deck - 12, 6, 12);
  g.fillStyle(0xcfe0e6);
  g.fillRect(x - 7, deck - 12, 6, 4);
  // Binoculars on their post at the rail.
  g.fillStyle(0x3a3e42);
  g.fillRect(x - 12, deck - 10, 1, 3);
  g.fillRect(x - 14, deck - 12, 4, 2);
  // Thatched hat roof.
  g.fillStyle(THATCH);
  g.fillTriangle(x - 15, deck - 15, x, deck - 26, x + 15, deck - 15);
  g.fillStyle(THATCH_DARK);
  for (let fx = x - 15; fx < x + 15; fx += 2) g.fillRect(fx, deck - 15, 1, 2);
  g.fillStyle(THATCH_LIGHT);
  g.lineStyle(1, THATCH_LIGHT);
  g.lineBetween(x, deck - 26, x - 7, deck - 19);
  // Flagpole to the pennant.
  g.fillStyle(0x6a6e72);
  g.fillRect(x, y - LOOKOUT_TOP, 1, LOOKOUT_TOP - LOOKOUT_DECK - 24);
  // Door at the ladder's foot, a person tall: a gate in the trestle.
  g.fillStyle(WOOD_DARK);
  g.fillRect(x + 10, y - 13, 1, 13);
  g.fillRect(x + 18, y - 13, 1, 13);
  g.fillRect(x + 10, y - 13, 9, 1);
}

// A long sun-gold pennant with a sea-blue tip, rippling in the onshore breeze (toward the land).
function pennantFx(g, x, y, elapsed) {
  const top = y - LOOKOUT_TOP;
  for (let i = 0; i < 12; i++) {
    const wave = Math.round(Math.sin(elapsed * 5 - i * 0.6) * (i / 12) * 1.6);
    const tall = Math.max(1, 4 - Math.floor(i / 4));
    g.fillStyle(i > 8 ? 0x4f86a6 : 0xd9a83a);
    g.fillRect(x + 1 + i, top + wave + Math.floor((4 - tall) / 2), 1, tall);
  }
}

// The beach club: a great thatched pavilion on palm-trunk posts, a bar counter with stools, a shelf
// of bottles, string lights under the eaves and the door at the back of the bar.
function drawBeachClub(g, x, y) {
  const w = 44;
  const left = x - w / 2;
  const eave = y - 22;
  // Raised deck and back wall of reed screens.
  g.fillStyle(WOOD_DARK);
  g.fillRect(left - 3, y - 3, w + 6, 3);
  g.fillStyle(WOOD);
  g.fillRect(left - 3, y - 4, w + 6, 1);
  g.fillStyle(0xc0a072);
  g.fillRect(left + 2, eave, w - 4, 18);
  g.fillStyle(0xb09262);
  for (let bx = left + 3; bx < left + w - 2; bx += 3) g.fillRect(bx, eave, 1, 18);
  // Posts.
  g.fillStyle(PALM_TRUNK[0]);
  for (const px of [left, left + w - 2]) g.fillRect(px, eave, 2, 19);
  // Shelf of bottles behind the bar.
  g.fillStyle(WOOD_DARK);
  g.fillRect(left + 5, eave + 6, 14, 1);
  const bottles = [0x6a8a5a, 0xc9a462, 0x8a5a4a, 0x5f8f8a, 0xd8d0b8];
  bottles.forEach((color, i) => {
    g.fillStyle(color);
    g.fillRect(left + 6 + i * 3, eave + 3, 1, 3);
  });
  // Bar counter with a terracotta front, and stools.
  g.fillStyle(TERRACOTTA);
  g.fillRect(left + 3, y - 11, 22, 7);
  g.fillStyle(lerpColor(TERRACOTTA, 0x000000, 0.15));
  for (let bx = left + 5; bx < left + 25; bx += 4) g.fillRect(bx, y - 10, 1, 6);
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(left + 2, y - 12, 24, 1);
  g.fillStyle(WOOD_DARK);
  for (const sx of [left + 6, left + 13, left + 20]) {
    g.fillRect(sx, y - 8, 3, 1);
    g.fillRect(sx + 1, y - 7, 1, 3);
  }
  // Door through the screens beside the bar, a person tall.
  g.fillStyle(0x4a3e34);
  g.fillRect(x + 4, y - 17, 8, 13);
  g.fillStyle(0xd9c27a);
  g.fillRect(x + 10, y - 11, 1, 1);
  // A chalkboard on an easel.
  g.fillStyle(0x3a3e3c);
  g.fillRect(left + w - 9, y - 12, 6, 7);
  g.fillStyle(0xd8d4c8);
  g.fillRect(left + w - 8, y - 10, 4, 1);
  g.fillRect(left + w - 8, y - 8, 3, 1);
  // The great thatched roof, steep and shaggy, with a carved finial.
  g.fillStyle(THATCH);
  g.fillTriangle(left - 8, eave + 1, x, eave - 16, left + w + 8, eave + 1);
  g.fillStyle(THATCH_LIGHT);
  g.fillTriangle(left - 2, eave - 3, x, eave - 16, x, eave - 3);
  g.fillStyle(THATCH_DARK);
  for (let fx = left - 8; fx < left + w + 8; fx += 2) g.fillRect(fx, eave + 1, 1, 1 + (fx & 2 ? 1 : 0));
  g.fillRect(left - 4, eave - 5, w + 8, 1);
  g.fillStyle(WOOD_DARK);
  g.fillRect(x, eave - 20, 1, 4);
  g.fillRect(x - 1, eave - 18, 3, 1);
  // String lights under the eaves.
  const bulbs = [0xf2d27a, 0xe8b08a, 0xf0e2b0];
  for (let i = 0, lx = left - 4; lx < left + w + 4; lx += 4, i++) {
    g.fillStyle(bulbs[i % bulbs.length]);
    g.fillRect(lx, eave + 2 + Math.round(Math.sin(i * 0.8) * 1), 1, 1);
  }
}

// Sand sculptures: a turreted castle and a reclining sphinx-like lion, roped off with a sign.
function drawSandSculptures(g, x, y) {
  // Castle, left.
  const cx = x - 8;
  g.fillStyle(SAND_DARK);
  g.fillRect(cx - 9, y - 9, 18, 9);
  g.fillRect(cx - 9, y - 16, 5, 7);
  g.fillRect(cx + 4, y - 16, 5, 7);
  g.fillRect(cx - 3, y - 21, 6, 12);
  g.fillStyle(SAND_SHADE);
  for (const tx of [cx - 9, cx - 7, cx - 5, cx + 4, cx + 6, cx + 8, cx - 3, cx - 1, cx + 1]) {
    g.fillRect(tx, (tx >= cx - 3 && tx <= cx + 1) ? y - 22 : y - 17, 1, 1);
  }
  g.fillRect(cx - 1, y - 6, 3, 6);
  g.fillRect(cx - 6, y - 13, 1, 2);
  g.fillRect(cx + 6, y - 13, 1, 2);
  g.fillRect(cx, y - 18, 1, 2);
  g.fillStyle(0xb8604a);
  g.fillRect(cx, y - 26, 1, 4);
  g.fillRect(cx + 1, y - 26, 2, 2);
  // Lion, right: a long body, forepaws out, maned head up.
  const lx = x + 9;
  g.fillStyle(SAND_DARK);
  g.fillRect(lx - 6, y - 5, 14, 5);
  g.fillRect(lx + 6, y - 2, 5, 2);
  g.fillRect(lx + 4, y - 11, 6, 6);
  g.fillStyle(SAND_SHADE);
  g.fillRect(lx + 3, y - 12, 2, 7);
  g.fillRect(lx - 6, y - 1, 14, 1);
  g.fillRect(lx + 8, y - 9, 1, 1);
  g.fillRect(lx - 7, y - 4, 1, 3);
  // Rope barrier on short posts, and a little sign.
  g.fillStyle(WOOD_DARK);
  for (const px of [x - 20, x + 21]) g.fillRect(px, y - 5, 1, 5);
  g.lineStyle(1, 0xbfae94);
  g.lineBetween(x - 20, y - 5, x - 11, y - 3);
  g.lineBetween(x + 12, y - 3, x + 21, y - 5);
  g.fillStyle(LINEN);
  g.fillRect(x - 3, y - 7, 6, 4);
  g.fillStyle(0x5a4a3a);
  g.fillRect(x, y - 3, 1, 3);
}

// Scenery dotted over the sand: [x, kind, variant]. Loungers and parasols mark where the sunbathers
// lie (golden-beach-life.js puts them there). Palms stand tall but are scenery, not buildings.
export const GOLDEN_PROPS = Object.freeze([
  [25512, 'palm', 0], [25540, 'boat'], [25594, 'parasol', 0], [25608, 'palm', 1], [25624, 'lounger', 0],
  [25654, 'parasol', 1], [25704, 'net'], [25726, 'palm', 2], [25736, 'buckets'], [25804, 'parasol', 2],
  [25818, 'lounger', 1], [25836, 'palm', 0], [25850, 'parasol', 0], [25896, 'palm', 1],
].map(([x, kind, variant = 0]) => ({ x, kind, variant })));
// The volleyball court, where a game goes on (golden-beach-life.js).
export const VOLLEYBALL_NET = GOLDEN_PROPS.find(p => p.kind === 'net').x;

const PARASOL = [[0xc98a5a, 0xece4d2], [0xb8604a, 0xece4d2], [0x5f8f8a, 0xece4d2]];
function drawProp(g, prop, x, y, elapsed) {
  if (prop.kind === 'palm') {
    drawPalm(g, x, y, prop.variant, elapsed);
  } else if (prop.kind === 'parasol') {
    const [a, b] = PARASOL[prop.variant % PARASOL.length];
    g.fillStyle(0xd8d0c0);
    g.fillRect(x, y - 22, 1, 22);
    for (let i = -6; i < 6; i++) {
      g.fillStyle((i + 6) % 4 < 2 ? a : b);
      const drop = Math.round(Math.abs(i + 0.5) * 0.7);
      g.fillRect(x + i * 2, y - 26 + drop, 2, 3);
    }
    g.fillStyle(lerpColor(a, 0x000000, 0.2));
    for (let i = -6; i < 6; i += 2) g.fillRect(x + i * 2, y - 23 + Math.round(Math.abs(i + 0.5) * 0.7), 1, 1);
    g.fillStyle(a);
    g.fillRect(x, y - 27, 1, 2);
  } else if (prop.kind === 'lounger') {
    for (const dx of [-7, 6]) {
      g.fillStyle(WOOD);
      g.fillRect(x + dx - 5, y - 3, 10, 1);
      g.fillRect(x + dx - 5, y - 2, 1, 2);
      g.fillRect(x + dx + 4, y - 2, 1, 2);
      g.lineStyle(1, WOOD);
      g.lineBetween(x + dx + (dx < 0 ? -5 : 4), y - 3, x + dx + (dx < 0 ? -7 : 6), y - 7);
      g.fillStyle(prop.variant ? 0xd8b89a : LINEN);
      g.fillRect(x + dx - 4, y - 4, 8, 1);
    }
  } else if (prop.kind === 'net') {
    g.fillStyle(0x6a6e72);
    g.fillRect(x - 16, y - 16, 1, 16);
    g.fillRect(x + 16, y - 16, 1, 16);
    g.fillStyle(0xe8e4dc, 0.85);
    g.fillRect(x - 15, y - 16, 31, 1);
    g.fillRect(x - 15, y - 10, 31, 1);
    for (let nx = x - 14; nx < x + 16; nx += 3) g.fillRect(nx, y - 15, 1, 5);
    // Court lines in the sand.
    g.fillStyle(0xe8dcc0);
    g.fillRect(x - 34, y - 1, 1, 1);
    g.fillRect(x + 34, y - 1, 1, 1);
  } else if (prop.kind === 'buckets') {
    g.fillStyle(0x5f8faa);
    g.fillRect(x - 4, y - 4, 4, 4);
    g.fillStyle(0xc9a83a);
    g.fillRect(x + 1, y - 3, 3, 3);
    g.fillStyle(SAND_DARK);
    g.fillRect(x + 5, y - 3, 5, 3);
    g.fillRect(x + 6, y - 5, 3, 2);
  } else if (prop.kind === 'boat') {
    // A fishing boat drawn up on the sand, tilted on its keel, oars inside.
    g.fillStyle(0x7a5e46);
    g.fillTriangle(x - 16, y - 7, x - 11, y, x - 11, y - 7);
    g.fillRect(x - 11, y - 7, 22, 7);
    g.fillTriangle(x + 11, y - 7, x + 17, y - 8, x + 11, y);
    g.fillStyle(0x4f86a6);
    g.fillRect(x - 13, y - 7, 29, 2);
    g.fillStyle(0xe8e4dc);
    g.fillRect(x - 6, y - 4, 1, 1);
    g.fillRect(x - 4, y - 4, 1, 1);
    g.lineStyle(1, WOOD_LIGHT);
    g.lineBetween(x - 6, y - 10, x + 9, y - 6);
  }
}

// A date palm: a gently curving ringed trunk, a crown of drooping fronds that sway, and hanging
// clusters of dates. Variant leans and sizes it.
export function drawPalm(g, x, y, variant, elapsed) {
  const tall = [44, 52, 38][variant % 3];
  const lean = [5, -4, 7][variant % 3];
  let tx = x;
  let ty = y;
  for (let i = 0; i < tall; i++) {
    const t = i / tall;
    tx = x + Math.round(lean * t * t);
    ty = y - i;
    g.fillStyle(PALM_TRUNK[(i >> 1) % 2]);
    g.fillRect(tx - 1, ty, 3, 1);
  }
  const sway = Math.sin(elapsed * 1.3 + variant * 2) * 1.5;
  g.fillStyle(DATES);
  g.fillRect(tx - 2, ty + 2, 2, 3);
  g.fillRect(tx + 2, ty + 2, 2, 2);
  for (let f = 0; f < 7; f++) {
    const a = -Math.PI + (f / 6) * Math.PI;
    const reach = 13 + (f % 2) * 3;
    g.fillStyle(PALM_LEAF[f % PALM_LEAF.length]);
    for (let s = 1; s <= reach; s++) {
      const fx = tx + Math.cos(a) * s + (s > 6 ? sway * s / reach : 0);
      const fy = ty + Math.sin(a) * s * 0.55 + (s * s) / reach * 0.45;
      g.fillRect(Math.round(fx), Math.round(fy), s < reach - 2 ? 2 : 1, 1);
      if (s % 3 === 0) g.fillRect(Math.round(fx), Math.round(fy) + 1, 1, 2);
    }
  }
  g.fillStyle(PALM_TRUNK[0]);
  g.fillRect(tx - 1, ty - 1, 3, 2);
}

// Low wind-rippled sand ridges along the back of the beach, with tufts of dune grass.
const RIDGES = [25520, 25890];
function drawRidges(g, left, right, seaY, shift) {
  const [from, to] = RIDGES;
  for (let wx = from; wx < to; wx += 4) {
    const x = wx + shift;
    if (x < left - 4 || x > right) continue;
    const h = Math.round((6 + 4 * Math.sin(wx / 29) + 3 * Math.sin(wx / 11)) * Math.sin((wx - from) / (to - from) * Math.PI));
    if (h <= 0) continue;
    const ground = goldenBase(wx, seaY) - SEA_Y_OFFSET;
    g.fillStyle(0xe6cc8e);
    g.fillRect(x, ground - h, 4, h);
    g.fillStyle(0xd8bc7e);
    g.fillRect(x, ground - h + Math.ceil(h * 0.55), 4, Math.floor(h * 0.45));
    const seed = Math.round(wx / 4);
    if (hash(seed + 0.4) < 0.25) {
      g.fillStyle(0x9a9a5a);
      g.fillRect(x + 1, ground - h - 3, 1, 3);
      g.fillRect(x + 2, ground - h - 2, 1, 2);
    }
  }
}

// A plank walkway over the sand from the pier's foot to the town.
const WALKWAY = [25560, 25896];
function drawWalkway(g, left, right, seaY, shift) {
  for (let wx = WALKWAY[0]; wx < WALKWAY[1]; wx += 3) {
    const x = wx + shift;
    if (x < left - 3 || x > right) continue;
    g.fillStyle(wx % 6 < 3 ? 0xa8865e : 0x987854);
    g.fillRect(x, goldenBase(wx, seaY) - SEA_Y_OFFSET - 1, 3, 2);
  }
}

export const GOLDEN_BEACH_BUILDINGS = Object.freeze([
  ...cabanas(),
  ...GOLDEN_BEACH_LANDMARKS.map((landmark, i) => ({ maxHealth: 160, seed: 340 + i, ...landmark })),
]);

// buildings: false leaves the cabanas and landmarks to a mode that draws them itself (evil mode).
export function drawGoldenBeach(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((GOLDEN_BEACH.from + GOLDEN_BEACH.to) / 2, cameraX);
  const half = (GOLDEN_BEACH.to - GOLDEN_BEACH.from) / 2;
  if (right < mid - half - 300 || left > mid + half + 300) return;
  const shift = mid - (GOLDEN_BEACH.from + GOLDEN_BEACH.to) / 2;
  drawRidges(g, left, right, seaY, shift);
  drawWalkway(g, left, right, seaY, shift);
  // Palms stand behind the buildings, so the cabanas and the club read in front of them.
  for (const prop of GOLDEN_PROPS) {
    if (prop.kind !== 'palm') continue;
    const at = prop.x + shift;
    if (at < left - 40 || at > right + 40) continue;
    drawProp(g, prop, at, goldenBase(prop.x, seaY) - SEA_Y_OFFSET + 1, elapsed);
  }
  if (buildings) {
    for (const building of GOLDEN_BEACH_BUILDINGS) {
      const at = building.x + shift;
      if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
      const y = goldenBase(building.x, seaY);
      building.draw(g, at, y, elapsed);
      building.fx?.(g, at, y, elapsed);
    }
  }
  for (const prop of GOLDEN_PROPS) {
    if (prop.kind === 'palm') continue;
    const at = prop.x + shift;
    if (at < left - 40 || at > right + 40) continue;
    drawProp(g, prop, at, goldenBase(prop.x, seaY) - SEA_Y_OFFSET + 1, elapsed);
  }
}
