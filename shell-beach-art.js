import { CIRCUMFERENCE, elevation, lerpColor } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled } from './city-art.js';

// Shell Beach, the sandy end of Bayport, built to game-design-rules/city-design-rules.md. Below the
// promenade's sea wall a boardwalk runs over the dunes past a row of beach huts (the street: muted
// pastels under slate roofs, each with its door) to the landmarks, each in its own palette: the ice
// cream kiosk with its cone sign, the lifeguard tower (the signature, tallest on the beach, its flag
// flying), the surf shack hung with boards, and the pier that runs out over the water to a shelter
// at its head. Rock pools sit under the pier's landward end; windbreaks, deckchairs, umbrellas,
// sandcastles and a beached rowing boat dot the sand as scenery.
// Everything that can break is listed once in SHELL_BEACH_BUILDINGS, so evil mode can promote it.
export const SHELL_BEACH = { from: 14560, to: 15100 };
// The dry sand: walkers and traffic keep to it; the shore lies just past its end.
export const SAND = { from: 14560, to: 15000 };
const SEA_Y_OFFSET = 3;

const SAND_DARK = 0xcdb47c;
const DUNE = 0xdcc791;
const DUNE_SHADE = 0xc9b27a;
const MARRAM = [0x8a9a5a, 0x7a8a50, 0x9aa868];
const WOOD = 0x8a6e52;
const WOOD_DARK = 0x6a5440;
const WOOD_LIGHT = 0xa88a6a;
const DRIFT = 0x9a8a78;
const STONE = 0xa8a49a;
const STONE_DARK = 0x8a867c;
const ROCK = [0x4a4e4c, 0x5a5e5a, 0x3e4240];

// The street: muted pastel huts under slate, trimmed in white.
const HUT_PAINT = [0xc4a6a2, 0xa6b4a2, 0xa2b0c0, 0xd2c6a8, 0xb4aac0];
const HUT_ROOF = 0x646a72;
const TRIM = 0xeeebe2;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

export function beachBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// The pier's deck, in art px above sea level, and its span. People on it stand this high.
const DECK = 16;
const PIER_X = 15090;
const PIER_ART_WIDTH = 190;

const LANDMARK_ART = [
  { id: 'sea-wall', open: true, x: 14592, draw: drawSeaWall, clear: 22, width: 44, height: 22, maxHealth: 220 },
  { id: 'ice-cream-kiosk', x: 14772, door: true, draw: drawIceCreamKiosk, clear: 20, width: 30, height: 40, maxHealth: 110 },
  { id: 'lifeguard-tower', x: 14858, door: true, draw: drawLifeguardTower, fx: flagFx, clear: 18, width: 30, height: 66, maxHealth: 160 },
  { id: 'surf-shack', x: 14930, door: true, draw: drawSurfShack, clear: 22, width: 40, height: 34, maxHealth: 120 },
  { id: 'shell-pier', open: true, x: PIER_X, draw: drawPier, clear: PIER_ART_WIDTH / 2, width: PIER_ART_WIDTH, height: 42, maxHealth: 320 },
];
export const SHELL_BEACH_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

// The pier deck in world px: its span and its height above sea level, like Rivertown's bridge deck.
export const PIER_DECK = Object.freeze({
  from: PIER_X - PIER_ART_WIDTH / 2 * CITY_SCALE + 4, to: PIER_X + PIER_ART_WIDTH / 2 * CITY_SCALE - 4,
  rise: DECK * CITY_SCALE - SEA_Y_OFFSET,
});

// The row of huts: the beach's street, between the sea wall and the kiosk.
const HUT_ROW = [14626, 14748];
const HUT_ART = 13;
function beachHuts() {
  const huts = [];
  const width = HUT_ART * CITY_SCALE;
  for (let i = 0, x = HUT_ROW[0] + width / 2; x + width / 2 <= HUT_ROW[1]; i++, x += width + 3) {
    const seed = i + 0.31;
    const paint = HUT_PAINT[i % HUT_PAINT.length];
    const tall = 18 + Math.round(hash(seed) * 3);
    huts.push({
      id: `shell-hut-${i}`, seed, kind: 'hut', x, width, height: (tall + 7) * CITY_SCALE, roof: (tall + 5) * CITY_SCALE,
      maxHealth: 70, door: true,
      draw: scaled((g, at, y) => drawHut(g, at, y, tall, paint, hash(seed + 0.5))),
    });
  }
  return huts;
}

// Beach huts: a pastel weatherboard box under a pitched slate roof, with white bargeboards and
// double doors standing open on sunny days.
function drawHut(g, x, y, tall, paint, look) {
  const w = HUT_ART;
  const left = Math.round(x - w / 2);
  const top = y - tall;
  g.fillStyle(WOOD_DARK);
  g.fillRect(left - 1, y - 2, w + 2, 2);
  g.fillStyle(paint);
  g.fillRect(left, top, w, tall - 2);
  g.fillStyle(lerpColor(paint, 0x000000, 0.1));
  for (let by = top + 3; by < y - 2; by += 3) g.fillRect(left, by, w, 1);
  g.fillStyle(lerpColor(paint, 0x000000, 0.18));
  g.fillRect(left + w - 2, top, 2, tall - 2);
  // Roof and white bargeboards.
  g.fillStyle(HUT_ROOF);
  g.fillTriangle(left - 2, top + 1, x, top - 6, left + w + 2, top + 1);
  g.fillStyle(TRIM);
  g.lineStyle(1, TRIM);
  g.lineBetween(left - 2, top + 1, x, top - 6);
  g.lineBetween(x, top - 6, left + w + 2, top + 1);
  // Doors in the centre, a person tall.
  const door = 12;
  g.fillStyle(look < 0.5 ? 0x4a4440 : lerpColor(paint, 0x000000, 0.3));
  g.fillRect(x - 4, y - 2 - door, 8, door);
  g.fillStyle(TRIM);
  g.fillRect(x, y - 2 - door, 1, door);
  if (look < 0.5) {
    // Open: a striped deckchair folded inside and a kettle shelf.
    g.fillStyle(0x7a8a96);
    g.fillRect(x - 3, y - 9, 2, 6);
    g.fillStyle(0xd2c6a8);
    g.fillRect(x + 1, y - 8, 2, 1);
  }
}

function drawSeaWall(g, x, y) {
  // A stone wall at the promenade's foot, its coping in a paler stone, and steps down to the sand
  // on the seaward side.
  const left = x - 22;
  g.fillStyle(STONE_DARK);
  g.fillRect(left, y - 16, 26, 16);
  g.fillStyle(STONE);
  for (let row = 0; row < 4; row++) {
    for (let bx = left + (row % 2) * 3; bx < left + 25; bx += 6) g.fillRect(bx, y - 15 + row * 4, 5, 3);
  }
  g.fillStyle(0xc8c4b8);
  g.fillRect(left - 1, y - 18, 28, 2);
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 ? STONE : 0xb8b4a8);
    g.fillRect(left + 26, y - 16 + i * 3, 3 * (6 - i), 3);
  }
  // Railing along the top and down the steps.
  g.fillStyle(0x4f5a62);
  g.fillRect(left, y - 24, 26, 1);
  for (let px = left; px <= left + 26; px += 6) g.fillRect(px, y - 24, 1, 6);
  g.lineStyle(1, 0x4f5a62);
  g.lineBetween(left + 26, y - 24, left + 44, y - 6);
  g.fillRect(left + 43, y - 6, 1, 6);
}

const CONE = 0xd2a868;
const SCOOP = 0xe8c8c0;
function drawIceCreamKiosk(g, x, y) {
  const w = 24;
  const left = x - w / 2;
  const top = y - 22;
  // Cream boards, a serving hatch under a striped awning, and the cone sign on top.
  g.fillStyle(0xe6dcc6);
  g.fillRect(left, top, w, 22);
  g.fillStyle(0xd6cab2);
  for (let by = top + 3; by < y; by += 3) g.fillRect(left, by, w, 1);
  g.fillStyle(0x5a6a74);
  g.fillRect(left - 1, top - 2, w + 2, 2);
  // Hatch and counter.
  g.fillStyle(0x4a4844);
  g.fillRect(left + 2, top + 5, 9, 7);
  g.fillStyle(0xf0d8d0);
  g.fillRect(left + 3, top + 7, 2, 2);
  g.fillStyle(0xd8e4ea);
  g.fillRect(left + 6, top + 6, 4, 4);
  g.fillStyle(0xbfae94);
  g.fillRect(left + 1, top + 12, 11, 2);
  // Awning, scalloped.
  for (let i = 0; i < 6; i++) {
    g.fillStyle(i % 2 ? 0xf0e8dc : 0xc98a8a);
    g.fillRect(left + i * 2, top + 1, 2, 4);
    g.fillRect(left + i * 2, top + 5, 2, i % 2 ? 1 : 2);
  }
  // Door, a person tall, on the right.
  g.fillStyle(0x6a7a86);
  g.fillRect(x + 3, y - 13, 7, 13);
  g.fillStyle(0xd9c27a);
  g.fillRect(x + 4, y - 7, 1, 1);
  // The cone sign.
  g.fillStyle(CONE);
  g.fillTriangle(x - 4, top - 10, x + 4, top - 10, x, top - 2);
  g.fillStyle(0xb88a50);
  g.fillRect(x - 2, top - 8, 1, 1);
  g.fillRect(x + 1, top - 7, 1, 1);
  g.fillStyle(SCOOP);
  g.fillCircle(x, top - 12, 4);
  g.fillStyle(0xa8c8a0);
  g.fillCircle(x + 2, top - 14, 2);
}

const LIFEGUARD_RED = 0xc4483e;
const LIFEGUARD_TOP = 58;
function drawLifeguardTower(g, x, y) {
  const deck = y - 34;
  // Four splayed legs and cross braces.
  g.lineStyle(2, WOOD_DARK);
  g.lineBetween(x - 13, y, x - 9, deck);
  g.lineBetween(x + 13, y, x + 9, deck);
  g.lineStyle(1, WOOD);
  g.lineBetween(x - 7, y, x - 5, deck);
  g.lineBetween(x + 7, y, x + 5, deck);
  g.lineBetween(x - 12, y - 6, x + 11, deck + 4);
  g.lineBetween(x + 12, y - 6, x - 11, deck + 4);
  g.lineBetween(x - 11, y - 18, x + 11, y - 18);
  // Ladder up the front.
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(x + 12, deck + 2, 1, 32);
  g.fillRect(x + 16, deck + 2, 1, 32);
  for (let ry = deck + 4; ry < y; ry += 4) g.fillRect(x + 12, ry, 5, 1);
  // Deck and railing with the lifebuoy.
  g.fillStyle(WOOD_DARK);
  g.fillRect(x - 14, deck, 28, 2);
  g.fillStyle(WOOD);
  g.fillRect(x - 14, deck - 6, 1, 6);
  g.fillRect(x + 13, deck - 6, 1, 6);
  g.fillRect(x - 14, deck - 6, 28, 1);
  // Cabin with a sea-facing window and its door.
  g.fillStyle(0x9a8a72);
  g.fillRect(x - 10, deck - 16, 20, 16);
  g.fillStyle(0x8a7a64);
  for (let by = deck - 14; by < deck; by += 3) g.fillRect(x - 10, by, 20, 1);
  g.fillStyle(0xcfe0e6);
  g.fillRect(x - 8, deck - 13, 7, 5);
  g.fillStyle(0x4a4440);
  g.fillRect(x + 1, deck - 13, 6, 13);
  // Roof.
  g.fillStyle(0x5a5e62);
  g.fillTriangle(x - 13, deck - 16, x, deck - 23, x + 13, deck - 16);
  // Lifebuoy on the rail.
  g.fillStyle(LIFEGUARD_RED);
  g.fillCircle(x - 11, deck - 3, 3);
  g.fillStyle(0xf0ece4);
  g.fillRect(x - 14, deck - 4, 2, 2);
  g.fillRect(x - 10, deck - 4, 2, 2);
  g.fillStyle(0x9a8a72);
  g.fillCircle(x - 11, deck - 3, 1);
  // Flagpole.
  g.fillStyle(0x6a6e72);
  g.fillRect(x - 1, y - LIFEGUARD_TOP, 1, 36);
  // Door at the ladder's foot: the way up, a person tall.
  g.fillStyle(0x4a4440);
  g.fillRect(x + 10, y - 2, 9, 2);
}

// The red-and-yellow flag streams from the pole, rippling.
function flagFx(g, x, y, elapsed) {
  const top = y - LIFEGUARD_TOP;
  for (let i = 0; i < 9; i++) {
    const wave = Math.round(Math.sin(elapsed * 6 - i * 0.7) * (i / 9) * 1.5);
    g.fillStyle(LIFEGUARD_RED);
    g.fillRect(x + i, top + wave, 1, 3);
    g.fillStyle(0xd8b84a);
    g.fillRect(x + i, top + 3 + wave, 1, 3);
  }
}

function drawSurfShack(g, x, y) {
  const w = 30;
  const left = x - w / 2;
  const top = y - 22;
  // Driftwood planks under a sloping corrugated roof, boards leant along the front.
  g.fillStyle(DRIFT);
  g.fillRect(left, top, w, 22);
  g.fillStyle(lerpColor(DRIFT, 0x000000, 0.12));
  for (let bx = left + 3; bx < left + w; bx += 4) g.fillRect(bx, top, 1, 22);
  g.fillStyle(0x7a8288);
  g.fillTriangle(left - 3, top + 1, left + w + 3, top - 6, left + w + 3, top + 1);
  g.fillRect(left - 3, top, w + 6, 2);
  g.fillStyle(0x6a7076);
  for (let rx = left - 2; rx < left + w + 3; rx += 3) g.fillRect(rx, top - Math.round((rx - left + 3) * 7 / (w + 6)), 1, 2);
  // Window with a hanging wetsuit, and the door.
  g.fillStyle(0x4a4440);
  g.fillRect(x - 4, y - 13, 8, 13);
  g.fillStyle(0xcfe0e6);
  g.fillRect(left + 3, top + 6, 6, 5);
  g.fillStyle(0x2f3438);
  g.fillRect(left + 5, top + 6, 2, 5);
  // Surfboards: muted teal, sun-faded orange and cream, leant on the right.
  const boards = [0x5f8f8a, 0xc98a5a, 0xe2dccb];
  boards.forEach((color, i) => {
    const bx = left + w - 10 + i * 4;
    g.fillStyle(color);
    g.fillRect(bx, y - 20 + i, 3, 20 - i);
    g.fillRect(bx + 1, y - 22 + i, 1, 2);
    g.fillStyle(lerpColor(color, 0x000000, 0.2));
    g.fillRect(bx + 1, y - 18 + i, 1, 16 - i);
  });
  // A painted sign board over the door.
  g.fillStyle(0x5f8f8a);
  g.fillRect(x - 7, top + 1, 14, 3);
  g.fillStyle(0xe2dccb);
  g.fillRect(x - 5, top + 2, 10, 1);
}

// The pier: a timber deck on piles running out over the water, railings each side, lamp posts,
// and at its head a green-roofed shelter. The piles go down into the sand and the sea; the terrain
// and the water hide their feet.
function drawPier(g, x, y) {
  const half = PIER_ART_WIDTH / 2;
  const left = x - half;
  const right = x + half;
  const deck = y - DECK;
  g.fillStyle(WOOD_DARK);
  for (let px = left + 4; px < right; px += 14) {
    g.fillRect(px, deck + 2, 2, DECK + 4);
    g.fillRect(px - 1, deck + 2, 4, 1);
  }
  g.lineStyle(1, 0x5a4636);
  for (let px = left + 4; px + 14 < right; px += 14) {
    g.lineBetween(px + 1, deck + 3, px + 15, deck + 10);
    g.lineBetween(px + 15, deck + 3, px + 1, deck + 10);
  }
  g.fillStyle(WOOD);
  g.fillRect(left, deck, PIER_ART_WIDTH, 3);
  g.fillStyle(WOOD_LIGHT);
  g.fillRect(left, deck, PIER_ART_WIDTH, 1);
  // Railings with a rope.
  g.fillStyle(WOOD_DARK);
  for (let px = left; px <= right - 30; px += 10) g.fillRect(px, deck - 6, 1, 6);
  g.fillRect(left, deck - 6, PIER_ART_WIDTH - 30, 1);
  g.fillStyle(0xbfae94);
  for (let px = left; px < right - 30; px += 1) g.fillRect(px, deck - 4 + Math.round(Math.sin((px - left) / 10 * Math.PI) * 0.8), 1, 1);
  // Lamp posts.
  for (const lx of [left + 30, left + 90]) {
    g.fillStyle(0x3f4a52);
    g.fillRect(lx, deck - 16, 1, 16);
    g.fillRect(lx - 1, deck - 17, 3, 2);
    g.fillStyle(0xf0e6c0);
    g.fillRect(lx - 1, deck - 15, 3, 1);
  }
  // The shelter at the head: green roof, cream walls, a kiosk window.
  const sx = right - 26;
  g.fillStyle(0xe2dccb);
  g.fillRect(sx, deck - 18, 24, 18);
  g.fillStyle(0xd0c8b4);
  g.fillRect(sx + 20, deck - 18, 4, 18);
  g.fillStyle(0x4a4440);
  g.fillRect(sx + 9, deck - 13, 7, 13);
  g.fillStyle(0xcfe0e6);
  g.fillRect(sx + 2, deck - 14, 5, 5);
  g.fillStyle(0x4f7a6a);
  g.fillTriangle(sx - 3, deck - 18, sx + 12, deck - 26, sx + 27, deck - 18);
  g.fillRect(sx - 3, deck - 19, 30, 2);
  g.fillStyle(0x3f6a5a);
  g.fillRect(sx + 11, deck - 30, 2, 5);
}

// Scenery dotted over the sand: [x, kind, variant]. Windbreaks, deckchairs and umbrellas mark
// where the sunbathers lie (shell-beach-life.js puts them there).
export const BEACH_PROPS = Object.freeze([
  [14640, 'bench'], [14662, 'umbrella', 0], [14700, 'windbreak', 1], [14716, 'sandcastle'],
  [14738, 'deckchairs', 0], [14800, 'umbrella', 1], [14812, 'buckets'], [14826, 'windbreak', 0],
  [14884, 'boat'], [14900, 'umbrella', 2], [14958, 'sandcastle'], [14966, 'deckchairs', 1],
  [14748, 'bin'], [14984, 'umbrella', 0],
].map(([x, kind, variant = 0]) => ({ x, kind, variant })));

const UMBRELLA = [[0xc98a5a, 0xe8e0cc], [0x5f8f8a, 0xe8e0cc], [0x9a7aa0, 0xe8e0cc]];
const STRIPES = [[0x8a9aa8, 0xe2dccb], [0xc4a6a2, 0xe2dccb]];
function drawProp(g, prop, x, y) {
  if (prop.kind === 'umbrella') {
    const [a, b] = UMBRELLA[prop.variant % UMBRELLA.length];
    g.fillStyle(0xd8d0c0);
    g.fillRect(x, y - 22, 1, 22);
    for (let i = -6; i < 6; i++) {
      g.fillStyle((i + 6) % 4 < 2 ? a : b);
      const drop = Math.round(Math.abs(i + 0.5) * 0.6);
      g.fillRect(x + i * 2, y - 26 + drop, 2, 3);
    }
    g.fillStyle(a);
    g.fillRect(x, y - 27, 1, 2);
  } else if (prop.kind === 'windbreak') {
    const [a, b] = STRIPES[prop.variant % STRIPES.length];
    for (let i = 0; i < 18; i++) {
      g.fillStyle(i % 6 === 0 ? WOOD_DARK : Math.floor(i / 3) % 2 ? a : b);
      g.fillRect(x - 9 + i, y - (i % 6 === 0 ? 12 : 10), 1, i % 6 === 0 ? 12 : 9);
    }
  } else if (prop.kind === 'deckchairs') {
    for (const dx of [-5, 4]) {
      const [a, b] = STRIPES[(prop.variant + (dx > 0 ? 1 : 0)) % STRIPES.length];
      g.lineStyle(1, WOOD);
      g.lineBetween(x + dx - 3, y, x + dx + 2, y - 8);
      g.lineBetween(x + dx + 2, y, x + dx - 1, y - 4);
      for (let i = 0; i < 5; i++) {
        g.fillStyle(i % 2 ? a : b);
        g.fillRect(x + dx - 2 + i, y - 2 - i * 1.4, 1, 3);
      }
    }
  } else if (prop.kind === 'sandcastle') {
    g.fillStyle(SAND_DARK);
    g.fillRect(x - 6, y - 4, 12, 4);
    g.fillRect(x - 5, y - 8, 3, 4);
    g.fillRect(x + 2, y - 8, 3, 4);
    g.fillRect(x - 1, y - 10, 3, 6);
    g.fillStyle(0xbfa46c);
    g.fillRect(x - 6, y - 1, 12, 1);
    g.fillStyle(0xc4483e);
    g.fillRect(x, y - 14, 1, 4);
    g.fillRect(x + 1, y - 14, 2, 2);
  } else if (prop.kind === 'buckets') {
    g.fillStyle(0x5f8faa);
    g.fillRect(x - 4, y - 4, 4, 4);
    g.fillStyle(0xc9a83a);
    g.fillRect(x + 1, y - 3, 3, 3);
    g.fillStyle(0xc4483e);
    g.fillRect(x + 5, y - 7, 1, 7);
    g.fillRect(x + 4, y - 2, 3, 2);
  } else if (prop.kind === 'bench') {
    g.fillStyle(WOOD);
    g.fillRect(x - 8, y - 6, 16, 2);
    g.fillRect(x - 8, y - 10, 16, 2);
    g.fillStyle(0x4f5a62);
    g.fillRect(x - 7, y - 6, 1, 6);
    g.fillRect(x + 6, y - 6, 1, 6);
  } else if (prop.kind === 'bin') {
    g.fillStyle(0x4f6a5a);
    g.fillRect(x - 3, y - 9, 6, 9);
    g.fillStyle(0x3f5a4a);
    g.fillRect(x - 4, y - 10, 8, 2);
  } else if (prop.kind === 'boat') {
    // A rowing boat drawn up on the sand, tilted on its keel, oars inside.
    g.fillStyle(0x7a6450);
    g.fillTriangle(x - 16, y - 7, x - 11, y, x - 11, y - 7);
    g.fillRect(x - 11, y - 7, 22, 7);
    g.fillTriangle(x + 11, y - 7, x + 17, y - 8, x + 11, y);
    g.fillStyle(0x5f8f8a);
    g.fillRect(x - 13, y - 7, 29, 2);
    g.fillStyle(WOOD_LIGHT);
    g.lineStyle(1, WOOD_LIGHT);
    g.lineBetween(x - 6, y - 10, x + 9, y - 6);
  }
}

// Low dunes with marram grass behind the huts and the landmarks, and the boardwalk over them.
// shift: the planet copy in view.
const DUNES = [14600, 14990];
function drawDunes(g, left, right, seaY, shift) {
  const [from, to] = DUNES;
  for (let wx = from; wx < to; wx += 4) {
    const x = wx + shift;
    if (x < left - 4 || x > right) continue;
    const h = Math.round((10 + 6 * Math.sin(wx / 37) + 4 * Math.sin(wx / 13)) * Math.sin((wx - from) / (to - from) * Math.PI));
    if (h <= 0) continue;
    const ground = beachBase(wx, seaY) - SEA_Y_OFFSET;
    g.fillStyle(DUNE);
    g.fillRect(x, ground - h, 4, h);
    g.fillStyle(DUNE_SHADE);
    g.fillRect(x, ground - h + Math.ceil(h * 0.6), 4, Math.floor(h * 0.4));
    const seed = Math.round(wx / 4);
    if (hash(seed) < 0.45) {
      g.fillStyle(MARRAM[seed % MARRAM.length]);
      g.fillRect(x + 1, ground - h - 4, 1, 4);
      g.fillRect(x, ground - h - 3, 1, 2);
      g.fillRect(x + 2, ground - h - 5, 1, 3);
    }
  }
}

const BOARDWALK = [14614, 14986];
function drawBoardwalk(g, left, right, seaY, shift) {
  for (let wx = BOARDWALK[0]; wx < BOARDWALK[1]; wx += 3) {
    const x = wx + shift;
    if (x < left - 3 || x > right) continue;
    g.fillStyle(wx % 6 < 3 ? 0xa88a6a : 0x9a7e60);
    g.fillRect(x, beachBase(wx, seaY) - SEA_Y_OFFSET - 1, 3, 2);
  }
}

// Rock pools at the waterline under the pier's landward end, with a glint of water in each pool.
function drawRockPools(g, x, seaY, elapsed) {
  const y = seaY + 1;
  const rocks = [[-14, 6, 5], [-6, 9, 7], [4, 7, 6], [12, 10, 4], [20, 6, 3]];
  rocks.forEach(([dx, w, h], i) => {
    g.fillStyle(ROCK[i % ROCK.length]);
    g.fillRect(x + dx - w / 2, y - h, w, h);
    g.fillRect(x + dx - w / 2 + 1, y - h - 1, w - 2, 1);
  });
  g.fillStyle(0x3a6a5a);
  g.fillRect(x - 10, y - 5, 2, 2);
  g.fillRect(x + 8, y - 6, 3, 1);
  const glint = Math.sin(elapsed * 2) > 0.3;
  g.fillStyle(glint ? 0xcfe8f0 : 0x7fb0c8);
  g.fillRect(x - 2, y - 3, 4, 1);
  g.fillRect(x + 15, y - 2, 3, 1);
}

export const SHELL_BEACH_BUILDINGS = Object.freeze([
  ...beachHuts(),
  ...SHELL_BEACH_LANDMARKS.map((landmark, i) => ({ maxHealth: 160, seed: 300 + i, ...landmark })),
]);

// buildings: false leaves the huts and landmarks to a mode that draws them itself (evil mode).
export function drawShellBeach(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((SHELL_BEACH.from + SHELL_BEACH.to) / 2, cameraX);
  const half = (SHELL_BEACH.to - SHELL_BEACH.from) / 2;
  if (right < mid - half - 300 || left > mid + half + 300) return;
  const shift = mid - (SHELL_BEACH.from + SHELL_BEACH.to) / 2;
  drawDunes(g, left, right, seaY, shift);
  drawBoardwalk(g, left, right, seaY, shift);
  if (buildings) {
    for (const building of SHELL_BEACH_BUILDINGS) {
      const at = building.x + shift;
      if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
      const y = beachBase(building.x, seaY);
      building.draw(g, at, y, elapsed);
      building.fx?.(g, at, y, elapsed);
    }
  }
  drawRockPools(g, 15012 + shift, seaY, elapsed);
  for (const prop of BEACH_PROPS) {
    const at = prop.x + shift;
    if (at < left - 30 || at > right + 30) continue;
    drawProp(g, prop, at, beachBase(prop.x, seaY) - SEA_Y_OFFSET + 1);
  }
}
