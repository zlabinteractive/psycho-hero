import { CIRCUMFERENCE, lerpColor } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled } from './city-art.js';

// The Blue Sea: open water between Meadowland and Sunland. There is no street, so the layers are:
// - Horizon (background): an offshore wind farm with turning rotors, and the big ships (the car
//   ferry between Bayport and Sandport, container ships) crossing far out. Pale, flat and small
//   like the sky traffic, on the far backdrop layer; they never react to the hero.
// - Landmarks (destructible in evil mode), each in its own palette: Gull Rock, a rocky island with
//   a keeper's cottage under a red-and-white lighthouse (the signature, tallest thing at sea), and
//   the Sea Fort, a rusting gun platform on four legs.
// - Sea marks and scenery: navigation buoys and channel markers bobbing on the swell (their lights
//   blinking), the mast of a wreck leaning out of the water, and a sandbar where seals haul out.
// Boats, dolphins and the birds live in blue-sea-life.js.
export const BLUE_SEA = { from: 15100, to: 25300 };
const SEA_Y_OFFSET = 3;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// clear: half-width kept free (art px). width/height: hit box once promoted.
const LANDMARK_ART = [
  { id: 'gull-rock', x: 18600, door: true, draw: drawGullRock, fx: gullRockBeam, clear: 54, width: 104, height: 112, maxHealth: 420 },
  { id: 'sea-fort', x: 21400, door: true, draw: drawSeaFort, clear: 40, width: 76, height: 66, maxHealth: 360 },
];
export const BLUE_SEA_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

export const BLUE_SEA_BUILDINGS = Object.freeze(BLUE_SEA_LANDMARKS.map((landmark, i) => ({ seed: 400 + i, ...landmark })));

// Sea marks and scenery: [x, kind]. The sandbar's span is where seals haul out.
export const SEA_MARKS = Object.freeze([
  [15700, 'buoy-green'], [16500, 'marker-red'], [17900, 'buoy-green'], [19700, 'marker-red'],
  [21000, 'buoy-yellow'], [22500, 'buoy-green'], [23300, 'marker-red'], [24400, 'buoy-green'],
].map(([x, kind]) => ({ x, kind })));
export const SANDBAR = { from: 17200, to: 17330 };
// The wind farm stands far out, between these world x.
const WIND_FARM = [19900, 22900];

// Gull Rock: a lumpy grey island with a grassy top, the keeper's whitewashed cottage, and the
// lighthouse's banded tower and lantern. Its base sits at sea level; the water hides the rest.
const LIGHT_TOP = 106;
function drawGullRock(g, x, y) {
  // Rock: one solid mound with a flat crown, broken into lumps and ledges.
  g.fillStyle(0x5e625e);
  g.fillRect(x - 40, y - 14, 80, 16);
  g.fillTriangle(x - 54, y + 2, x - 40, y - 14, x - 40, y + 2);
  g.fillTriangle(x + 40, y - 14, x + 54, y + 2, x + 40, y + 2);
  g.fillRect(x - 28, y - 22, 56, 9);
  g.fillTriangle(x - 40, y - 13, x - 28, y - 22, x - 28, y - 13);
  g.fillTriangle(x + 28, y - 22, x + 40, y - 13, x + 28, y - 13);
  g.fillStyle(0x6e726c);
  g.fillTriangle(x - 46, y - 4, x - 34, y - 16, x - 24, y - 4);
  g.fillTriangle(x - 10, y - 6, x + 4, y - 20, x + 16, y - 6);
  g.fillTriangle(x + 22, y - 4, x + 34, y - 15, x + 46, y - 4);
  g.fillStyle(0x52564f);
  g.fillRect(x - 30, y - 9, 12, 1);
  g.fillRect(x + 6, y - 11, 14, 1);
  g.fillRect(x - 6, y - 15, 9, 1);
  g.fillStyle(0x4a4e4a);
  g.fillRect(x - 50, y - 2, 100, 4);
  // Grass on the crown, and white guano streaks on the ledges.
  g.fillStyle(0x7f9a5a);
  g.fillRect(x - 27, y - 24, 54, 3);
  g.fillStyle(0x6f8a4e);
  g.fillRect(x - 26, y - 22, 52, 1);
  g.fillStyle(0xe6e6de);
  g.fillRect(x + 34, y - 13, 1, 6);
  g.fillRect(x - 36, y - 10, 1, 5);
  g.fillRect(x + 12, y - 9, 1, 4);
  // Keeper's cottage: white, red roof, a chimney and a door.
  const cx = x - 15;
  g.fillStyle(0xeeebe2);
  g.fillRect(cx - 10, y - 38, 20, 14);
  g.fillStyle(0x9a3e36);
  g.fillTriangle(cx - 12, y - 38, cx, y - 46, cx + 12, y - 38);
  g.fillStyle(0x6a6e72);
  g.fillRect(cx + 5, y - 47, 2, 5);
  g.fillStyle(0x4a5a66);
  g.fillRect(cx - 3, y - 34, 6, 10);
  g.fillStyle(0xcfe0e6);
  g.fillRect(cx - 8, y - 35, 3, 3);
  g.fillRect(cx + 5, y - 35, 3, 3);
  // Lighthouse: a tapering tower in red and white bands, gallery and lantern.
  const lx = x + 12;
  const base = y - 24;
  const top = y - LIGHT_TOP + 16;
  for (let ty = base; ty > top; ty -= 1) {
    const t = (base - ty) / (base - top);
    const half = Math.round(8 - 3 * t);
    g.fillStyle(Math.floor((base - ty) / 12) % 2 ? 0xb8463c : 0xf0ece4);
    g.fillRect(lx - half, ty - 1, half * 2, 1);
  }
  g.fillStyle(0x000000, 0.12);
  g.fillRect(lx + 2, top, 3, base - top);
  g.fillStyle(0x3f4448);
  g.fillRect(lx - 8, top - 2, 16, 2);
  g.fillRect(lx - 8, top - 6, 1, 4);
  g.fillRect(lx + 7, top - 6, 1, 4);
  g.fillStyle(0xf6e8a8);
  g.fillRect(lx - 4, top - 10, 8, 8);
  g.fillStyle(0x3f4448);
  g.fillRect(lx - 4, top - 10, 1, 8);
  g.fillRect(lx + 3, top - 10, 1, 8);
  g.fillTriangle(lx - 6, top - 10, lx, top - 16, lx + 6, top - 10);
  g.fillRect(lx, top - 19, 1, 3);
  // Lighthouse door, a person tall, at the tower's foot.
  g.fillStyle(0x4a4440);
  g.fillRect(lx - 3, base - 10, 6, 10);
  // A jetty and steps down to the water on the west side.
  g.fillStyle(0x6a5440);
  g.fillRect(x - 64, y - 4, 18, 2);
  g.fillRect(x - 62, y - 2, 1, 4);
  g.fillRect(x - 52, y - 2, 1, 4);
}

// The beam sweeps out across the sea and back, as at Bayport.
function gullRockBeam(g, x, y, elapsed) {
  const lx = x + 12;
  const ly = y - LIGHT_TOP + 16 - 6;
  const turn = Math.sin(elapsed * 0.9);
  const length = 170 * Math.abs(turn);
  const dir = turn > 0 ? 1 : -1;
  g.fillStyle(0xfff6c8, 0.2);
  g.fillTriangle(lx, ly - 2, lx + dir * length, ly - 12, lx + dir * length, ly + 10);
  g.fillStyle(0xfff6c8, 0.35 + 0.25 * (1 - Math.abs(turn)));
  g.fillCircle(lx, ly, 5);
}

// The Sea Fort: two rusting concrete blocks on a deck, four legs braced into the sea, a ladder down
// to a landing stage and a radar mast.
const RUST = 0x8a6a56;
const CONCRETE = 0x9a9a92;
function drawSeaFort(g, x, y) {
  const deck = y - 26;
  g.fillStyle(0x6a6a64);
  for (const lx of [-26, -10, 8, 24]) g.fillRect(x + lx, deck, 4, 30);
  g.lineStyle(1, 0x5a5a54);
  g.lineBetween(x - 24, deck + 4, x - 8, deck + 22);
  g.lineBetween(x - 8, deck + 4, x - 24, deck + 22);
  g.lineBetween(x + 10, deck + 4, x + 26, deck + 22);
  g.lineBetween(x + 26, deck + 4, x + 10, deck + 22);
  g.fillStyle(0x5a5a54);
  g.fillRect(x - 32, deck - 2, 64, 3);
  // Two blocks, streaked with rust.
  g.fillStyle(CONCRETE);
  g.fillRect(x - 28, deck - 20, 26, 18);
  g.fillRect(x + 2, deck - 24, 28, 22);
  g.fillStyle(lerpColor(CONCRETE, 0x000000, 0.15));
  g.fillRect(x - 6, deck - 20, 4, 18);
  g.fillRect(x + 26, deck - 24, 4, 22);
  g.fillStyle(RUST);
  for (const rx of [-24, -14, 6, 14, 22]) g.fillRect(x + rx, deck - 12, 1, 9);
  g.fillStyle(0x3a3e40);
  for (const wx of [-24, -16]) g.fillRect(x + wx, deck - 16, 4, 3);
  for (const wx of [6, 14, 22]) g.fillRect(x + wx, deck - 20, 3, 3);
  // Door into the larger block, a person tall.
  g.fillStyle(0x4a4440);
  g.fillRect(x + 12, deck - 13, 6, 11);
  // Railings and the radar mast.
  g.fillStyle(0x5a5a54);
  g.fillRect(x - 28, deck - 23, 26, 1);
  g.fillRect(x + 2, deck - 27, 28, 1);
  g.fillRect(x + 20, deck - 40, 1, 14);
  g.fillRect(x + 15, deck - 40, 11, 2);
  // Ladder down to the landing stage.
  g.fillStyle(RUST);
  g.fillRect(x - 36, deck, 1, 26);
  g.fillRect(x - 33, deck, 1, 26);
  for (let ly = deck + 3; ly < y; ly += 4) g.fillRect(x - 36, ly, 4, 1);
  g.fillStyle(0x6a5440);
  g.fillRect(x - 42, y - 3, 14, 2);
}

// Bobbing sea marks, drawn at the waterline. Their lights blink.
function drawSeaMark(g, mark, x, y, elapsed) {
  const bob = Math.round(Math.sin(elapsed * 1.6 + mark.x) * 1.2);
  const tilt = Math.round(Math.sin(elapsed * 1.1 + mark.x * 0.3) * 1);
  const top = y + bob;
  const blink = (elapsed + hash(mark.x) * 4) % 4 < 0.4;
  if (mark.kind === 'marker-red') {
    // A channel marker: a red can on a striped pole.
    g.fillStyle(0xe6e2d8);
    g.fillRect(x + tilt, top - 22, 2, 22);
    g.fillStyle(0xa8443c);
    g.fillRect(x + tilt, top - 16, 2, 4);
    g.fillRect(x + tilt - 3, top - 28, 8, 7);
    g.fillStyle(blink ? 0xff8070 : 0x8a3a34);
    g.fillRect(x + tilt, top - 31, 2, 2);
    g.fillStyle(0x4a4e52);
    g.fillRect(x - 5, top - 2, 12, 3);
    return;
  }
  const color = mark.kind === 'buoy-yellow' ? 0xc9a83a : 0x4f8a5a;
  // A buoy: a float, a lattice tower with a topmark, and the light.
  g.fillStyle(lerpColor(color, 0x000000, 0.25));
  g.fillRect(x - 6, top - 3, 13, 4);
  g.fillStyle(color);
  g.fillRect(x - 5, top - 6, 11, 4);
  g.fillTriangle(x - 3 + tilt, top - 6, x + tilt, top - 18, x + 4 + tilt, top - 6);
  g.fillStyle(lerpColor(color, 0x000000, 0.3));
  g.fillRect(x + tilt, top - 16, 1, 10);
  if (mark.kind === 'buoy-yellow') {
    g.fillStyle(0xc9a83a);
    g.fillRect(x - 2 + tilt, top - 22, 5, 1);
    g.fillRect(x + tilt, top - 24, 1, 5);
  } else {
    g.fillTriangle(x - 2 + tilt, top - 19, x + tilt, top - 23, x + 3 + tilt, top - 19);
  }
  g.fillStyle(blink ? 0xb8f0a0 : 0x5a7a50);
  if (mark.kind === 'buoy-yellow') g.fillStyle(blink ? 0xfff0a0 : 0x8a7a40);
  g.fillRect(x + tilt, top - 20, 1, 1);
}

// The sandbar: a long low bank of wet sand just above the water.
function drawSandbar(g, x0, x1, y) {
  for (let x = x0; x < x1; x += 2) {
    const t = (x - x0) / (x1 - x0);
    const h = Math.round(Math.sin(t * Math.PI) * 5 + Math.sin(x / 7) * 0.6);
    if (h <= 0) continue;
    g.fillStyle(0xcdb47c);
    g.fillRect(x, y - h, 2, h + 1);
    g.fillStyle(0xb89e66);
    g.fillRect(x, y, 2, 1);
  }
  g.fillStyle(0x5e625e);
  g.fillRect(x0 + 18, y - 3, 6, 3);
  g.fillRect(x1 - 30, y - 4, 5, 4);
}

// Background: the wind farm and the big ships, on the far backdrop layer (parallax `factor`), pale
// against the distant sea. Pure functions of elapsed, so they cost nothing when out of view.
const FAR = 0.55;
const HORIZON_SHIP = 0x9db8c6;
const HORIZON_DARK = 0x86a4b4;
// [world x the route starts, length px, speed px/s, kind]. Each sails back and forth along its route.
const HORIZON_SHIPS = [
  [15600, 9400, 14, 'ferry'], [17000, 7000, 9, 'container'], [19800, 5200, 11, 'container'], [16200, 8600, 18, 'ferry'],
];

function drawHorizon(g, left, right, seaY, cameraX, cameraY, elapsed) {
  const baseY = cameraY + (seaY - cameraY) * FAR;
  const shift = cameraX * (1 - FAR);
  const toScreen = wx => wx * FAR + shift;
  // Only draw while the camera is over the sea.
  const near = nearest((BLUE_SEA.from + BLUE_SEA.to) / 2, cameraX);
  const offset = near - (BLUE_SEA.from + BLUE_SEA.to) / 2;
  if (cameraX < near - (BLUE_SEA.to - BLUE_SEA.from) / 2 - 1600 || cameraX > near + (BLUE_SEA.to - BLUE_SEA.from) / 2 + 1600) return;
  for (let wx = WIND_FARM[0]; wx <= WIND_FARM[1]; wx += 300) {
    const x = Math.round(toScreen(wx + offset) + (hash(wx) - 0.5) * 60);
    if (x < left - 30 || x > right + 30) continue;
    const h = 46 + Math.round(hash(wx + 1) * 6);
    g.fillStyle(0xc6d8e0);
    g.fillRect(x, baseY - h, 1, h);
    g.fillRect(x - 1, baseY - h - 1, 3, 2);
    const spin = elapsed * (1.1 + hash(wx + 2) * 0.4) + wx;
    g.lineStyle(1, 0xd6e4ea);
    for (let b = 0; b < 3; b++) {
      const a = spin + b * Math.PI * 2 / 3;
      g.lineBetween(x, baseY - h, x + Math.cos(a) * 15, baseY - h + Math.sin(a) * 15);
    }
  }
  for (const [start, length, speed, kind] of HORIZON_SHIPS) {
    const run = (elapsed * speed + start) % (length * 2);
    const dir = run < length ? 1 : -1;
    const wx = BLUE_SEA.from + 400 + (start - BLUE_SEA.from) % 500 + (dir > 0 ? run : length * 2 - run) + offset;
    const x = Math.round(toScreen(wx));
    if (x < left - 60 || x > right + 60) continue;
    drawHorizonShip(g, x, Math.round(baseY), dir, kind);
  }
}

function drawHorizonShip(g, x, y, dir, kind) {
  if (kind === 'ferry') {
    // Car ferry: a long white hull, two decks of windows, a single funnel.
    g.fillStyle(HORIZON_DARK);
    g.fillRect(x - 22, y - 4, 44, 4);
    g.fillStyle(HORIZON_SHIP);
    g.fillRect(x - 18, y - 8, 34, 4);
    g.fillRect(x - 12, y - 11, 22, 3);
    g.fillStyle(0xb6ccd6);
    g.fillRect(x - dir * 4, y - 15, 4, 4);
    return;
  }
  // Container ship: a low hull stacked with boxes and the bridge at the stern.
  g.fillStyle(HORIZON_DARK);
  g.fillRect(x - 28, y - 4, 56, 4);
  g.fillStyle(HORIZON_SHIP);
  for (let i = 0; i < 6; i++) g.fillRect(x - 22 + i * 7 + (dir > 0 ? 0 : 8), y - 8 - (i % 2), 6, 4 + (i % 2));
  g.fillRect(x - dir * 24 - 3, y - 13, 6, 9);
}

export function drawBlueSea(g, left, right, seaY, cameraX, elapsed, buildings = true, cameraY = seaY) {
  drawHorizon(g, left, right, seaY, cameraX, cameraY, elapsed);
  const mid = nearest((BLUE_SEA.from + BLUE_SEA.to) / 2, cameraX);
  const half = (BLUE_SEA.to - BLUE_SEA.from) / 2;
  if (right < mid - half - 300 || left > mid + half + 300) return;
  const shift = mid - (BLUE_SEA.from + BLUE_SEA.to) / 2;
  const y = seaY + SEA_Y_OFFSET - 2;
  if (SANDBAR.to + shift > left && SANDBAR.from + shift < right) drawSandbar(g, SANDBAR.from + shift, SANDBAR.to + shift, seaY + 1);
  for (const mark of SEA_MARKS) {
    const at = mark.x + shift;
    if (at > left - 20 && at < right + 20) drawSeaMark(g, mark, at, seaY + 1, elapsed);
  }
  if (!buildings) return;
  for (const building of BLUE_SEA_BUILDINGS) {
    const at = building.x + shift;
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}
