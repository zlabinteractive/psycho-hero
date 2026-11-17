import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';

// Green City art, layered per game-design-rules/city-design-rules.md: two flat parallax skyline
// rows, a grey-and-green street, then detailed landmarks. Street and landmarks are listed once in
// CITY_BUILDINGS so a mode can promote them to destructible (see building-destruction.js).
// Everything sits on the city's flat ground and is drawn behind the terrain cap, so bases tuck
// into the soil.
export const CITY = { from: 150, to: 5250 };
// Buildings are drawn this much larger than their art, so a door fits a hero-sized person and
// Meadow Tower stands as tall as the Twin Spires once did. City life is sized from the hero
// (city-life.js), so this is the one knob that keeps the city in proportion with them.
// ponytail: scales the art rather than redrawing it, so building pixels are 1.4x the hero's;
// redraw at native density if that ever reads chunky.
export const CITY_SCALE = 1.4;
const SKYLINE_STEP = 40;
// Background rows fade out over this many px at an area's ends instead of cutting off, so blocks
// sliding past the edge with parallax never pop (feedback issue #07).
export const SKYLINE_FADE = 260;
// Foreground art reaches past a building's hit box (plazas, guy cables, lighthouse beams), so
// drawing keeps this much margin past the view before skipping one.
export const ART_MARGIN = 280;

// 0..1: how far inside [from, to] both the block's own x and where it is drawn sit, eased over
// SKYLINE_FADE px. 0 means skip it.
export function skylineFade(wx, ground, from, to) {
  const inside = Math.min(wx - from, to - wx, ground - from, to - ground);
  if (inside <= 0) return 0;
  const t = Math.min(1, inside / SKYLINE_FADE);
  return t * t * (3 - 2 * t);
}

// Draws a building CITY_SCALE larger about its base, keeping world coordinates inside the art.
export function scaled(draw) {
  return (g, x, y, elapsed) => {
    g.save();
    g.translateCanvas(x, y);
    g.scaleCanvas(CITY_SCALE, CITY_SCALE);
    g.translateCanvas(-x, -y);
    draw(g, x, y, elapsed);
    g.restore();
  };
}

const WINDOW_WARM = 0xffe890;

// clear is the half-width the street leaves free, so each silhouette reads whole. width and height
// are the hit box once promoted. All three are in art pixels here and scaled below. door marks a
// ground-floor entrance at x that people walk in and out of (city-life.js).
// Half the twins' spacing in art px: each spire's bridge half reaches this far from its centre.
const SPIRE_REACH = 155;
const LANDMARK_ART = [
  { id: 'hero-plaza', x: 1950, draw: drawStatue, clear: 120, width: 44, height: 64 },
  { id: 'city-hall', x: 1646, door: true, draw: drawCityHall, clear: 85, width: 148, height: 172 },
  { id: 'green-park', x: 600, draw: drawPark, clear: 150, width: 280, height: 45 },
  // Twin Spires: two towers 434px apart, each carrying half the sky bridge, so each breaks alone.
  // width spans to the bridge midpoint (SPIRE_REACH); clear covers the gap so no street fills it.
  { id: 'twin-spires-west', x: 2390, door: true, draw: (g, x, y, elapsed) => drawSpire(g, x, y, elapsed, 1), clear: 160, width: SPIRE_REACH * 2, height: 1844, maxHealth: 360 },
  { id: 'twin-spires-east', x: 2824, door: true, draw: (g, x, y, elapsed) => drawSpire(g, x, y, elapsed, -1), clear: 160, width: SPIRE_REACH * 2, height: 1844, maxHealth: 360 },
  { id: 'meadow-tower', x: 3257, door: true, draw: drawSkyscraper, clear: 115, width: 200, height: 627 },
  // Apex Spire: a stepped needle tower with a helipad perch, second only to the Twin Spires.
  { id: 'apex-spire', x: 3788, door: true, draw: drawApexSpire, clear: 155, width: 280, height: 962, maxHealth: 380 },
  { id: 'stadium', x: 4210, draw: drawStadium, clear: 140, width: 250, height: 98 },
  // Horizon Megalith: offset glass blocks with a rooftop terrace on every step.
  { id: 'horizon-megalith', x: 4500, door: true, draw: drawMegalith, clear: 66, width: 100, height: 512, maxHealth: 360 },
  { id: 'mast', x: 4700, draw: drawMast, clear: 70, width: 50, height: 212 },
];
export const LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark, draw: scaled(landmark.draw),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));
const LANDMARK_REACH = 160 * CITY_SCALE;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
const STREET_STEP = 56 * CITY_SCALE;
// High-rises keep this much further back than low buildings, so they never crowd a landmark.
const TOWER_MARGIN = 110 * CITY_SCALE;
const CITY_EDGE = 320;
// Street greys with Green City's rooftop greenery: calm enough to keep the eye on the hero.
const FACADES = [0x8fa7b3, 0x879eaa, 0x96abb5];
const TOWERS = [0x7d95a2, 0x869ca8, 0x7891a0];
const LEAF = 0x5fa865;
const LEAF_LIGHT = 0x7cbf7f;
const GLASS = 0xd5e8ee;
// Downtown, around Meadow Tower, where the street grows high-rises most often.
const DOWNTOWN = { x: 3100, reach: 800 };
// Street slots drawn at a fixed x instead of their own: the two grey office blocks that stand where
// City Hall used to, with City Hall in their old spot.
const PINNED_STREET = new Map([[20, 1115], [21, 1186]]);

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// Nearest copy of a planet x to the camera, so landmarks survive the wrap seam.
function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// buildings: false leaves the street and landmarks out, for a mode that draws them itself.
export function drawCity(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  drawFarSkyline(g, left, right, seaY, cameraX);
  drawSkyline(g, left, right, seaY, cameraX);
  if (!buildings) return;
  for (const building of CITY_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    building.draw(g, at, seaY - elevation(building.x) + 3, elapsed);
  }
}

// Skyline rows scroll slower than the city so they read as distant: the far row most, the near
// row a little. Parallax pivots on the city centre and each block is clipped to the city where
// it is drawn, so neither row drifts onto the hills. Calls draw(x, seed, groundX) per column.
function eachSkylineColumn(left, right, cameraX, parallax, draw) {
  const shift = (cameraX - nearest((CITY.from + CITY.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, CITY.from, CITY.to);
    if (fade <= 0) continue;
    draw(x, Math.round(wx / SKYLINE_STEP), ground, fade);
  }
}

function drawFarSkyline(g, left, right, seaY, cameraX) {
  eachSkylineColumn(left, right, cameraX, FAR_PARALLAX, (x, seed, ground, fade) => {
    if (hash(seed + 0.75) <= 0.3) return;
    const y = seaY - elevation(ground) + 3;
    const far = (40 + hash(seed) * 80) * CITY_SCALE;
    g.fillStyle(0xa9cad6, fade);
    g.fillRect(x, y - far, 30, far);
    g.fillStyle(0xbcd8e1, fade);
    g.fillRect(x + 3, y - far, 4, far);
  });
}

// Near row: flat blocks like the far row, a shade deeper. Detail such as windows is kept for
// things the hero can touch, so this row stays scenery. Blocks fade out as they slide behind a
// landmark rather than popping, so the landmarks stay clear.
function drawSkyline(g, left, right, seaY, cameraX) {
  eachSkylineColumn(left, right, cameraX, NEAR_PARALLAX, (x, seed, ground, fade) => {
    if (hash(seed + 0.5) < 0.25) return;
    const nx = x + 6 + Math.round(hash(seed + 0.25) * 8);
    const centre = wrapX(nx + 13);
    const clearance = Math.min(...LANDMARKS.map(landmark => Math.abs(centre - landmark.x)));
    const alpha = fade * Math.min(1, Math.max(0, (clearance - LANDMARK_REACH * 0.5) / (LANDMARK_REACH * 0.3)));
    if (alpha <= 0) return;
    const y = seaY - elevation(ground) + 3;
    const near = (24 + hash(seed + 0.5) * 44) * CITY_SCALE;
    g.fillStyle(0x97b6c3, alpha);
    g.fillRect(nx, y - near, 26, near);
    g.fillStyle(0xa8c5d1, alpha);
    g.fillRect(nx + 3, y - near, 4, near);
  });
}

// Street: detailed buildings on the ground plane, between the landmarks. Detail marks them as
// foreground, like the landmarks: things a mode can promote to destructible.
function streetBuildings() {
  const buildings = [];
  for (let i = Math.floor(CITY.from / STREET_STEP); i * STREET_STEP <= CITY.to; i++) {
    const x = i * STREET_STEP;
    if (x < CITY.from || PINNED_STREET.has(i)) continue;
    const seed = i + 0.37;
    // The street thins and drops toward the city's ends instead of stopping as a wall.
    const taper = Math.min(1, Math.min(x - CITY.from, CITY.to - x) / CITY_EDGE);
    if (hash(seed) < 0.12 + 0.45 * (1 - taper)) continue;
    // art is the drawn width; width is the scaled footprint the street lays out and promotes.
    const art = 34 + Math.round(hash(seed + 0.2) * 18);
    const width = art * CITY_SCALE;
    const bx = x + Math.round((STREET_STEP - width) * hash(seed + 0.5));
    const gap = Math.min(...LANDMARKS.map(landmark => Math.abs(bx + width / 2 - landmark.x) - landmark.clear - width / 2),
      ...[...PINNED_STREET.values()].map(px => Math.abs(bx + width / 2 - px) - 30 * CITY_SCALE - width / 2));
    if (gap < 6) continue;
    const towerChance = Math.abs(x - DOWNTOWN.x) < DOWNTOWN.reach ? 0.4 : 0.08;
    const id = `street-${i}`;
    if (taper === 1 && gap >= TOWER_MARGIN && hash(seed + 0.7) < towerChance) {
      const height = 140 + Math.round(hash(seed + 0.3) * 120);
      const body = TOWERS[Math.floor(hash(seed + 0.4) * TOWERS.length)];
      buildings.push({
        id, seed, x: bx + width / 2, width, height: (height + 64) * CITY_SCALE, maxHealth: 225, door: true,
        draw: scaled((g, at, y, elapsed) => drawTower(g, at, y, art, height, body, elapsed, Math.floor(hash(seed + 0.8) * 3), seed)),
      });
      continue;
    }
    buildings.push(lowBuilding(i, bx + width / 2, taper));
  }
  for (const [i, x] of PINNED_STREET) buildings.push(lowBuilding(i, x, 1));
  return buildings.sort((a, b) => a.x - b.x);
}

// A shop, apartment or office for street slot i, centred on x and shrunk by taper at the city's ends.
function lowBuilding(i, x, taper) {
  const seed = i + 0.37;
  const art = 34 + Math.round(hash(seed + 0.2) * 18);
  const kind = Math.floor(hash(seed + 0.1) * 3);
  const full = [32, 52, 84][kind] + Math.round(hash(seed + 0.3) * [12, 28, 30][kind]);
  const height = Math.max(28, Math.round(full * (0.45 + 0.55 * taper)));
  const facade = FACADES[Math.floor(hash(seed + 0.4) * FACADES.length)];
  const roll = hash(seed + 0.6);
  return {
    // roof: height of the rooftop above the building's base, where birds perch (city-life.js).
    id: `street-${i}`, seed, x, width: art * CITY_SCALE, height: (height + 8) * CITY_SCALE, roof: (height + 3) * CITY_SCALE, maxHealth: kind === 0 ? 110 : 150, door: true,
    draw: scaled((g, at, y) => drawStreetBuilding(g, at - art / 2, y, art, height, kind, facade, roll)),
  };
}

// Rooftop garden: a planted strip with a few bushes and, on wider roofs, a small tree.
function drawGarden(g, x, top, width, roll) {
  g.fillStyle(LEAF);
  g.fillRect(x - 1, top - 3, width + 2, 4);
  g.fillCircle(x + 7, top - 4, 4);
  g.fillCircle(x + width - 9, top - 3, 3);
  if (width > 40 && roll > 0.5) {
    g.fillStyle(0x6b4f3a);
    g.fillRect(x + width / 2 - 1, top - 10, 2, 8);
    g.fillStyle(LEAF);
    g.fillCircle(x + width / 2, top - 12, 5);
  }
  g.fillStyle(LEAF_LIGHT);
  g.fillCircle(x + 6, top - 5, 1.5);
}

// Street building palettes, muted to sit with the city's pastel blues: shops in terracotta, cream or
// sage; apartments in sand, clay or pale blue; offices keep the street's blue-grey (FACADES).
const SHOP_WALLS = [0xc4917a, 0xd8c8a8, 0x9fb5a0];
const FLAT_WALLS = [0xd6cbb4, 0xc2a790, 0xb8c4c9];
const SIGNS = [0x2f6f8f, 0x8a3a3a, 0x3f7a4a, 0xc08a2a];
const AWNINGS = [[0x3f8a55, 0xeef0e6], [0xb8483e, 0xf4eee2], [0x2f6f8f, 0xeef0e6]];
const FLOWERS = [0xe0645a, 0xf2c14e, 0xe890b8, 0xf4f2ec];
const WARM = 0xf6dfa0;

// A window: glass with a highlight, dark frame below; now and then lit warm.
function drawWindow(g, x, y, w, h, seed) {
  g.fillStyle(hash(seed) > 0.86 ? WARM : GLASS);
  g.fillRect(x, y, w, h);
  g.fillStyle(0xffffff, 0.45);
  g.fillRect(x, y, Math.max(1, Math.floor(w / 3)), h);
  g.fillStyle(0x000000, 0.18);
  g.fillRect(x, y + h - 1, w, 1);
}

// Rooftop water tower: legs, a cross brace, a stave tank with hoops, a cone roof and a ladder.
function drawWaterTower(g, x, top) {
  g.fillStyle(0x5c6a72);
  g.fillRect(x, top - 7, 1, 7);
  g.fillRect(x + 9, top - 7, 1, 7);
  g.fillRect(x, top - 4, 10, 1);
  g.fillStyle(0x8a6a4e);
  g.fillRect(x - 1, top - 17, 12, 10);
  g.fillStyle(0x6f5440);
  for (let sx = x + 1; sx < x + 11; sx += 3) g.fillRect(sx, top - 17, 1, 10);
  g.fillStyle(0x4a5257);
  g.fillRect(x - 1, top - 14, 12, 1);
  g.fillRect(x - 1, top - 10, 12, 1);
  g.fillStyle(0x6d7f88);
  g.fillTriangle(x - 2, top - 17, x + 11, top - 17, x + 4.5, top - 22);
  g.fillStyle(0x4a5257);
  g.fillRect(x + 11, top - 16, 1, 16);
}

// Apartment house: brick with stone quoins and a band at every floor; framed windows with lintels,
// keystones and sills (shutters on some houses, arched on the top floor); wrought-iron balconies on
// alternate floors and flower boxes on the rest; a stone ground floor with an arched, fanlit
// entrance, steps and lamps; a bracketed cornice and a balustrade parapet, with a roof garden or a
// water tower behind it.
const SHUTTERS = [0x4f6e58, 0x5a6e86, 0x7a4a3e];
function drawApartments(g, x, y, width, height, wall, roll) {
  const top = y - height;
  const mid = x + Math.round(width / 2);
  const deep = lerpColor(wall, 0x000000, 0.32);
  const brick = lerpColor(wall, 0x000000, 0.1);
  const stone = lerpColor(wall, 0xffffff, 0.45);
  const iron = 0x3a3f44;
  const base = y - 16;
  // Brick coursing: faint mortar lines and staggered joints.
  g.fillStyle(brick, 0.5);
  for (let by = top + 5, k = 0; by < base; by += 3, k++) {
    g.fillRect(x + 1, by, width - 4, 1);
    for (let bx = x + 2 + (k % 2) * 3; bx < x + width - 3; bx += 6) g.fillRect(bx, by - 2, 1, 2);
  }
  // Quoins down both corners.
  for (let qy = top + 4, k = 0; qy < base; qy += 3, k++) {
    g.fillStyle(stone);
    g.fillRect(x, qy, k % 2 ? 2 : 3, 2);
    g.fillRect(x + width - (k % 2 ? 2 : 3), qy, k % 2 ? 2 : 3, 2);
  }
  const shutter = roll > 0.5 ? SHUTTERS[Math.floor(roll * 97) % SHUTTERS.length] : null;
  const cols = Math.max(2, Math.floor((width - 10) / 8));
  const step = (width - 10) / cols;
  const floors = [];
  for (let fy = top + 7; fy + 10 <= base - 2; fy += 12) floors.push(fy);
  floors.forEach((wy, row) => {
    const upper = row === 0;
    // Band at the floor line below these windows.
    g.fillStyle(stone);
    g.fillRect(x + 1, wy + 10, width - 3, 1);
    for (let c = 0; c < cols; c++) {
      const wx = Math.round(x + 5 + c * step + (step - 4) / 2);
      // Lintel with keystone, or an arch on the top floor.
      g.fillStyle(stone);
      if (upper) {
        g.fillRect(wx, wy - 2, 4, 1);
        g.fillRect(wx - 1, wy - 1, 6, 1);
      } else {
        g.fillRect(wx - 1, wy - 1, 6, 1);
        g.fillRect(wx + 1, wy - 2, 2, 1);
      }
      drawWindow(g, wx, wy, 4, 7, wx * 0.53 + wy);
      g.fillStyle(deep);
      g.fillRect(wx, wy + 3, 4, 1);
      g.fillRect(wx + 2, wy, 1, 7);
      if (shutter) {
        g.fillStyle(shutter);
        g.fillRect(wx - 2, wy, 1, 7);
        g.fillRect(wx + 5, wy, 1, 7);
      }
      g.fillStyle(stone);
      g.fillRect(wx - 1, wy + 7, 6, 1);
      if (row % 2 === 1) {
        // Wrought-iron balcony: a slab with its shadow and a railing.
        g.fillStyle(stone);
        g.fillRect(wx - 2, wy + 7, 8, 1);
        g.fillStyle(deep, 0.6);
        g.fillRect(wx - 1, wy + 8, 6, 1);
        g.fillStyle(iron);
        g.fillRect(wx - 2, wy + 3, 8, 1);
        for (let rx = wx - 2; rx < wx + 6; rx += 2) g.fillRect(rx, wy + 4, 1, 3);
        if (hash(wx + wy * 0.3 + roll) > 0.6) {
          g.fillStyle(0x8a5a3e);
          g.fillRect(wx + 4, wy + 5, 2, 2);
          g.fillStyle(LEAF);
          g.fillRect(wx + 4, wy + 3, 2, 2);
        }
      } else if (hash(wx * 0.7 + row + roll) > 0.3) {
        // Flower box.
        g.fillStyle(0x7a5238);
        g.fillRect(wx - 1, wy + 8, 6, 2);
        g.fillStyle(LEAF);
        g.fillRect(wx - 1, wy + 7, 6, 1);
        for (let fx = wx - 1; fx < wx + 5; fx += 2) {
          g.fillStyle(FLOWERS[Math.floor(hash(fx * 1.7 + wy) * FLOWERS.length)]);
          g.fillRect(fx, wy + 6, 1, 1);
        }
      }
    }
  });
  // Shade on the right face.
  g.fillStyle(0x000000, 0.1);
  g.fillRect(x + width - 3, top, 3, height);
  // Stone ground floor: rusticated joints, two windows, an arched fanlit entrance, steps and lamps.
  g.fillStyle(stone);
  g.fillRect(x, base, width, 16);
  g.fillStyle(lerpColor(stone, 0x000000, 0.18));
  for (let jy = base + 3; jy < y; jy += 4) g.fillRect(x, jy, width, 1);
  g.fillRect(x, base, width, 1);
  for (const wx of [x + 4, x + width - 10]) {
    drawWindow(g, wx, base + 4, 5, 7, wx + roll * 3);
    g.fillStyle(iron);
    g.fillRect(wx + 2, base + 4, 1, 7);
  }
  g.fillStyle(deep);
  g.fillRect(mid - 5, y - 13, 10, 13);
  g.fillCircle(mid, y - 13, 5);
  g.fillStyle(GLASS);
  g.fillRect(mid - 3, y - 16, 6, 2);
  g.fillStyle(0x6b4f3a);
  g.fillRect(mid - 3, y - 12, 6, 11);
  g.fillStyle(lerpColor(0x6b4f3a, 0x000000, 0.25));
  g.fillRect(mid, y - 12, 1, 11);
  g.fillStyle(0xf2c14e);
  g.fillRect(mid + 1, y - 7, 1, 1);
  g.fillStyle(lerpColor(stone, 0xffffff, 0.3));
  g.fillRect(mid - 6, y - 1, 12, 1);
  g.fillRect(mid - 5, y - 2, 10, 1);
  for (const side of [-1, 1]) {
    g.fillStyle(iron);
    g.fillRect(mid + side * 7, y - 11, 1, 4);
    g.fillStyle(WARM);
    g.fillRect(mid + side * 7 - (side < 0 ? 1 : 0), y - 13, 2, 2);
  }
  // Bracketed cornice and a balustrade parapet.
  g.fillStyle(deep);
  g.fillRect(x - 2, top, width + 4, 3);
  g.fillStyle(stone);
  g.fillRect(x - 2, top, width + 4, 1);
  g.fillStyle(deep);
  for (let dx = x; dx < x + width; dx += 4) g.fillRect(dx, top + 3, 2, 2);
  g.fillStyle(stone);
  g.fillRect(x - 1, top - 5, width + 2, 1);
  for (let px = x; px < x + width; px += 2) g.fillRect(px, top - 4, 1, 4);
  // Behind the parapet: a roof garden with shrubs and a small tree, or a water tower.
  if (roll > 0.25) {
    g.fillStyle(LEAF);
    g.fillCircle(x + 6, top - 6, 3);
    g.fillCircle(x + width - 8, top - 6, 2.5);
    g.fillCircle(x + width / 2 + 4, top - 5, 2);
    if (width > 38) {
      g.fillStyle(0x6b4f3a);
      g.fillRect(x + 13, top - 10, 1, 6);
      g.fillStyle(LEAF);
      g.fillCircle(x + 13, top - 11, 4);
      g.fillStyle(LEAF_LIGHT);
      g.fillCircle(x + 12, top - 12, 1.5);
    }
  } else drawWaterTower(g, x + width - 17, top - 4);
}

// kind 0: shop; 1: apartments; 2: office. Each has its own facade detail, a cornice, a rooftop
// garden or water tower, and a centred door people walk in and out of.
function drawStreetBuilding(g, x, y, width, height, kind, facade, roll) {
  const top = y - height;
  const pick = (list, k) => list[Math.floor(hash(roll * 31 + k) * list.length) % list.length];
  const wall = kind === 0 ? pick(SHOP_WALLS, 1) : kind === 1 ? pick(FLAT_WALLS, 2) : facade;
  const shade = lerpColor(wall, 0x000000, 0.14);
  const deep = lerpColor(wall, 0x000000, 0.3);
  const lite = lerpColor(wall, 0xffffff, 0.25);
  const mid = x + Math.round(width / 2);
  g.fillStyle(wall);
  g.fillRect(x, top, width, height);
  g.fillStyle(shade);
  g.fillRect(x + width - 3, top, 3, height);

  if (kind === 2) {
    // Curtain wall: glass between slim mullions, darker spandrel bands, a diagonal sky reflection.
    g.fillStyle(lerpColor(GLASS, 0x5c7f90, 0.35));
    g.fillRect(x + 3, top + 4, width - 7, height - 22);
    g.fillStyle(0xffffff, 0.22);
    for (let k = 0; k < 3; k++) {
      const rx = x + 6 + Math.round(hash(roll + k) * (width - 16));
      for (let ry = top + 4; ry < y - 18; ry += 2) {
        const off = Math.round((ry - top) * 0.35) % (width - 10);
        if (rx + off < x + width - 6) g.fillRect(rx + off, ry, 3, 2);
      }
    }
    g.fillStyle(lerpColor(wall, 0x000000, 0.22));
    for (let sy = top + 10; sy < y - 18; sy += 8) g.fillRect(x + 3, sy, width - 7, 2);
    g.fillStyle(lite);
    for (let mx = x + 3; mx < x + width - 4; mx += 6) g.fillRect(mx, top + 4, 1, height - 22);
    // Logo panel and a lobby of tall glass under a canopy.
    g.fillStyle(0xf4f6f2);
    g.fillRect(x + 4, top + 4, 7, 3);
    g.fillStyle(pick(SIGNS, 3));
    g.fillRect(x + 5, top + 5, 2, 1);
    g.fillStyle(deep);
    g.fillRect(x, y - 18, width, 18);
    g.fillStyle(GLASS);
    g.fillRect(x + 3, y - 15, width - 7, 15);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(x + 3, y - 15, 3, 15);
    g.fillStyle(deep);
    for (let lx = x + 9; lx < x + width - 5; lx += 8) g.fillRect(lx, y - 15, 1, 15);
    g.fillStyle(0xe8ecee);
    g.fillRect(mid - 9, y - 19, 18, 2);
    // Plant room and an antenna on the roof.
    g.fillStyle(shade);
    g.fillRect(x + 4, top - 6, Math.round(width * 0.45), 6);
    g.fillStyle(deep);
    for (let vx = x + 6; vx < x + 4 + width * 0.45 - 2; vx += 3) g.fillRect(vx, top - 5, 1, 4);
    g.fillStyle(0x6d7f88);
    g.fillRect(x + width - 9, top - 14, 1, 14);
    g.fillStyle(0xd0563e);
    g.fillRect(x + width - 10, top - 15, 3, 1);
  } else if (kind === 1) {
    drawApartments(g, x, y, width, height, wall, roll);
  } else {
    // Shop: upper floors of paired windows with sills and lintels, a sign band, a striped awning
    // with a scalloped edge, and display windows either side of the door.
    for (let wy = top + 6; wy < y - 30; wy += 10) {
      for (let wx = x + 4; wx < x + width - 10; wx += 9) {
        g.fillStyle(lite);
        g.fillRect(wx - 1, wy - 1, 8, 1);
        drawWindow(g, wx, wy, 3, 5, wx + wy * 0.7);
        drawWindow(g, wx + 4, wy, 3, 5, wx + wy * 0.7 + 1);
        g.fillStyle(deep);
        g.fillRect(wx - 1, wy + 5, 8, 1);
      }
    }
    g.fillStyle(pick(SIGNS, 4));
    g.fillRect(x + 1, y - 27, width - 3, 5);
    g.fillStyle(0xf4f2ec);
    for (let lx = x + 5; lx < x + width - 8; lx += 3) if (hash(lx + roll) > 0.3) g.fillRect(lx, y - 25, 2, 1);
    const [stripe, gap] = pick(AWNINGS, 5);
    for (let ax = x; ax < x + width; ax += 3) {
      g.fillStyle(Math.floor((ax - x) / 3) % 2 ? gap : stripe);
      g.fillRect(ax, y - 22, Math.min(3, x + width - ax), 4);
      g.fillCircle(ax + 1.5, y - 18, 1.5);
    }
    g.fillStyle(deep);
    g.fillRect(x, y - 16, width, 16);
    g.fillStyle(GLASS);
    g.fillRect(x + 3, y - 14, mid - x - 8, 11);
    g.fillRect(mid + 5, y - 14, x + width - mid - 9, 11);
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(x + 3, y - 14, 2, 11);
    g.fillRect(mid + 5, y - 14, 2, 11);
    // Goods in the window.
    for (const [from, to] of [[x + 6, mid - 6], [mid + 8, x + width - 5]]) {
      for (let gx = from; gx < to - 1; gx += 4) {
        g.fillStyle(FLOWERS[Math.floor(hash(gx * 1.3 + roll) * FLOWERS.length)]);
        g.fillRect(gx, y - 6, 2, 3);
      }
    }
    g.fillStyle(lite);
    g.fillRect(x + 2, y - 3, width - 4, 1);
  }

  // Cornice: a deep band with a lit top edge, dentils under it on shops (apartments draw their own).
  if (kind !== 1) {
  g.fillStyle(deep);
  g.fillRect(x - 1, top, width + 2, 3);
  g.fillStyle(lite);
  g.fillRect(x - 1, top, width + 2, 1);
  if (kind !== 2) {
    g.fillStyle(deep);
    for (let dx = x + 1; dx < x + width - 1; dx += 3) g.fillRect(dx, top + 3, 1, 1);
  }
  }

  if (kind === 0) {
    if (roll > 0.25) {
      drawGarden(g, x, top, width, roll);
      if (width > 38 && roll < 0.5) {
        // Pergola over the roof garden.
        g.fillStyle(0x8a6a4e);
        g.fillRect(x + width - 16, top - 9, 1, 8);
        g.fillRect(x + width - 6, top - 9, 1, 8);
        g.fillRect(x + width - 17, top - 9, 12, 1);
      }
    } else drawWaterTower(g, x + width - 17, top);
  }
  // Every street building has a centred door; a shop's is glazed, the others' sit in their lobby.
  g.fillStyle(0x4a5257);
  if (kind === 0) {
    g.fillRect(mid - 3, y - 13, 6, 13);
    g.fillStyle(GLASS);
    g.fillRect(mid - 2, y - 12, 4, 6);
  } else if (kind === 1) {
    // Drawn with the building (drawApartments).
  } else {
    g.fillRect(mid - 4, y - 13, 8, 13);
    g.fillStyle(GLASS);
    g.fillRect(mid - 3, y - 12, 6, 12);
    g.fillStyle(0x4a5257);
    g.fillRect(mid, y - 12, 1, 12);
  }
}

// High-rise, in one of three styles over a shared podium: 0 a glass tower with vertical fins and a
// chamfered crown; 1 ribbon windows between spandrel bands, topped by a plant room and a helipad;
// 2 an art-deco tower stepping back in three tiers with terraces and a spire. All carry a sky garden
// band, panes lit here and there, a lit edge, a lobby under a canopy and a blinking beacon.
function drawTower(g, x, y, width, height, body, elapsed, style = 0, seed = 0) {
  const top = y - height;
  const left = Math.round(x - width / 2);
  const right = left + width;
  const cx = Math.round(x);
  const shade = lerpColor(body, 0x000000, 0.12);
  const deep = lerpColor(body, 0x000000, 0.3);
  const lite = lerpColor(body, 0xffffff, 0.3);
  const garden = Math.round(top + height * 0.45);
  let beacon;
  if (style === 0) {
    g.fillStyle(body);
    g.fillRect(left, top, width, height);
    paneGrid(g, left + 3, right - 4, top + 6, y - 20, 6, 4, seed * 7.3, body);
    g.fillStyle(lite);
    for (let fx = left + 3; fx < right - 3; fx += 6) g.fillRect(fx - 1, top + 4, 1, height - 22);
    // Chamfered crown: the corners cut back in steps, a lit band, a mast.
    g.fillStyle(body);
    for (let k = 0; k < 4; k++) g.fillRect(left + 3 + k * 3, top - 4 - k * 4, width - 6 - k * 6, 4);
    g.fillStyle(0xf2e6b0, 0.75);
    g.fillRect(left + 3, top - 1, width - 6, 1);
    g.fillStyle(0x6d7f88);
    g.fillRect(cx - 1, top - 44, 2, 28);
    g.fillRect(cx - 4, top - 30, 8, 1);
    beacon = top - 45;
  } else if (style === 1) {
    g.fillStyle(body);
    g.fillRect(left, top, width, height);
    for (let wy = top + 6; wy < y - 20; wy += 7) {
      g.fillStyle(GLASS);
      g.fillRect(left + 2, wy, width - 5, 4);
      g.fillStyle(0xffffff, 0.35);
      g.fillRect(left + 2, wy, 6, 4);
      if (hash(seed * 3.1 + wy * 0.13) > 0.8) {
        g.fillStyle(0xf2e6b0);
        g.fillRect(left + 9 + Math.round(hash(wy + seed) * (width - 20)), wy, 6, 4);
      }
    }
    // Rounded corner: a light strip on the left, darker on the right.
    g.fillStyle(lite);
    g.fillRect(left, top, 2, height - 18);
    // Plant room, then a helipad deck with its H and corner lights.
    g.fillStyle(shade);
    g.fillRect(left + 4, top - 10, width - 8, 10);
    g.fillStyle(deep);
    for (let vx = left + 6; vx < right - 6; vx += 3) g.fillRect(vx, top - 8, 1, 6);
    g.fillStyle(0x5c6a72);
    g.fillRect(left - 2, top - 13, width + 4, 3);
    g.fillStyle(0xf4f2ec);
    g.fillRect(cx - 4, top - 13, 1, 1);
    g.fillRect(cx + 3, top - 13, 1, 1);
    g.fillRect(cx - 3, top - 13, 6, 1);
    const blink = Math.sin(elapsed * 3 + x) > 0;
    g.fillStyle(blink ? 0x7ad07a : 0x3f7a4a);
    g.fillRect(left - 2, top - 14, 2, 1);
    g.fillRect(right, top - 14, 2, 1);
    g.fillStyle(0x6d7f88);
    g.fillRect(right - 6, top - 30, 1, 17);
    beacon = top - 31;
  } else {
    // Three tiers stepping in, each with piers, terraces on the setbacks, a crown and spire.
    const tiers = [[width, height], [Math.round(width * 0.74), 26], [Math.round(width * 0.48), 18]];
    let base = y;
    let tierTop = top;
    for (let i = 0; i < 3; i++) {
      const [w, h] = tiers[i];
      const l = Math.round(x - w / 2);
      tierTop = i === 0 ? top : tierTop - h;
      const bottom = i === 0 ? y : tierTop + h;
      g.fillStyle(body);
      g.fillRect(l, tierTop, w, bottom - tierTop);
      paneGrid(g, l + 3, l + w - 4, tierTop + 4, bottom - (i === 0 ? 20 : 3), 7, 3, seed * 5.1 + i, body);
      g.fillStyle(lite);
      for (let px = l + 2; px < l + w - 2; px += 8) g.fillRect(px, tierTop + 2, 1, bottom - tierTop - (i === 0 ? 20 : 2));
      g.fillStyle(LEAF);
      g.fillRect(l, tierTop - 2, w, 2);
      g.fillCircle(l + 3, tierTop - 2, 2);
      g.fillCircle(l + w - 3, tierTop - 2, 2);
      base = tierTop;
    }
    g.fillStyle(0xd9b56a);
    g.fillTriangle(cx - 6, base - 2, cx + 6, base - 2, cx, base - 14);
    g.fillStyle(0x6d7f88);
    g.fillRect(cx - 1, base - 20, 2, 8);
    beacon = base - 21;
  }
  // Shared: shaded right face, lit left edge, sky garden band, podium and lobby.
  g.fillStyle(shade);
  g.fillRect(right - 3, top, 3, height);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(left + 1, top, 2, height - 18);
  g.fillStyle(deep);
  g.fillRect(left, garden - 1, width, 6);
  g.fillStyle(LEAF);
  g.fillRect(left, garden, width, 3);
  for (let bx = left + 4; bx < right - 3; bx += 7) g.fillCircle(bx, garden, 2);
  g.fillStyle(LEAF_LIGHT);
  g.fillRect(left + 2, garden, 2, 1);
  g.fillStyle(deep);
  g.fillRect(left - 1, y - 18, width + 2, 18);
  g.fillStyle(lerpColor(body, 0xffffff, 0.5));
  g.fillRect(left - 2, y - 19, width + 4, 2);
  g.fillStyle(GLASS);
  g.fillRect(left + 2, y - 15, width - 5, 15);
  g.fillStyle(0xffffff, 0.4);
  g.fillRect(left + 2, y - 15, 3, 15);
  g.fillStyle(deep);
  for (let lx = left + 8; lx < right - 4; lx += 7) g.fillRect(lx, y - 15, 1, 15);
  g.fillStyle(0xe8ecee);
  g.fillRect(cx - 9, y - 21, 18, 2);
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 2.5 + x) > 0));
  g.fillCircle(cx + (style === 1 ? Math.round(width / 2) - 6 : 0), beacon, 2.5);
  // Glass lobby doors.
  g.fillStyle(deep);
  g.fillRect(cx - 5, y - 13, 10, 13);
  g.fillStyle(GLASS);
  g.fillRect(cx - 4, y - 12, 3, 12);
  g.fillRect(cx + 1, y - 12, 3, 12);
}

// Twin Spires: the city's signature pair. Deep teal shafts with vertical fins rise from stone
// podiums to gold-trimmed pointed crowns. Each tower draws its half of the sky bridge, reaching
// toward its twin (inward: 1 reaches right, -1 reaches left), with a garden at bridge level.
function drawSpire(g, cx, y, elapsed, inward) {
  const half = 105;
  const top = 1622;
  // The sky bridge spans the pair at a little under half the shaft's height.
  const bridge = 730;
  const left = cx - half;
  g.fillStyle(0x55848c);
  g.fillRect(left, y - top, half * 2, top - 40);
  g.fillRect(cx - 72, y - top - 40, 144, 40);
  g.fillRect(cx - 40, y - top - 75, 80, 35);
  g.fillTriangle(cx - 40, y - top - 75, cx, y - top - 150, cx + 40, y - top - 75);
  g.fillRect(cx - 1.5, y - top - 222, 3, 74);
  g.fillStyle(0x4a757c);
  g.fillRect(left + half * 2 - 8, y - top, 8, top - 40);
  glassGrid(g, left + 4, y - top + 6, 32, Math.floor((top - 52) / 7), 6, 7, 3, 4, 0x55848c);
  g.fillStyle(0x6f9ca3);
  for (let fx = left + 12; fx < left + half * 2 - 8; fx += 12) g.fillRect(fx, y - top, 1, top - 40);
  g.fillStyle(0xd9b56a);
  g.fillRect(left - 1, y - top - 2, half * 2 + 2, 2);
  g.fillRect(cx - 41, y - top - 77, 82, 2);
  g.fillStyle(LEAF);
  g.fillRect(cx - 72, y - top - 43, 144, 3);
  for (const level of [1180, bridge + 4, 240]) {
    g.fillRect(left, y - level, half * 2, 4);
    g.fillCircle(left + 6, y - level - 1, 4);
    g.fillCircle(left + half * 2 - 6, y - level - 1, 4);
  }
  g.fillStyle(0xc9c1b0);
  g.fillRect(cx - 118, y - 50, 236, 50);
  g.fillStyle(0xd9d2c3);
  g.fillRect(cx - 121, y - 54, 242, 4);
  g.fillStyle(GLASS);
  for (let wx = cx - 110; wx < cx + 106; wx += 10) if (Math.abs(wx + 3 - cx) > 14) g.fillRect(wx, y - 40, 6, 14);
  g.fillStyle(0x6d7f88);
  g.fillRect(cx - 9, y - 24, 18, 24);
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 2.5 + inward) > 0));
  g.fillCircle(cx, y - top - 223, 3);

  // Half the sky bridge, from this tower's inner face to the midpoint between the pair.
  const face = cx + inward * (half - 1);
  const middle = cx + inward * SPIRE_REACH;
  const from = Math.min(face, middle);
  const span = Math.abs(middle - face);
  g.fillStyle(0xc9c1b0);
  g.fillRect(from, y - bridge, span, 22);
  g.fillTriangle(face, y - bridge + 22, middle, y - bridge + 36, middle, y - bridge + 22);
  g.fillStyle(GLASS);
  for (let bx = from + 3; bx < from + span - 4; bx += 7) g.fillRect(bx, y - bridge + 5, 4, 10);
  g.fillStyle(0xd9b56a);
  g.fillRect(from, y - bridge - 1, span, 2);
}

// Glass panes on a curtain wall, drawn as one glass block crossed by frame strips: rows + cols
// rects instead of rows x cols, so the mega-towers stay cheap to redraw every frame.
function glassGrid(g, left, top, cols, rows, stepX, stepY, paneW, paneH, frame) {
  const width = (cols - 1) * stepX + paneW;
  const height = (rows - 1) * stepY + paneH;
  g.fillStyle(GLASS);
  g.fillRect(left, top, width, height);
  g.fillStyle(frame);
  for (let i = 1; i < cols; i++) g.fillRect(left + i * stepX - (stepX - paneW), top, stepX - paneW, height);
  for (let i = 1; i < rows; i++) g.fillRect(left, top + i * stepY - (stepY - paneH), width, stepY - paneH);
}

// Hero Plaza: a bronze hero mid-punch on a paved square with benches, planters and lamps,
// right where the player spawns.
function drawStatue(g, x, y) {
  g.fillStyle(0xc9c1b0);
  g.fillRect(x - 112, y - 5, 224, 3);
  for (const side of [-1, 1]) {
    g.fillStyle(0x6d7f88);
    g.fillRect(x + side * 100 - 1, y - 38, 2, 34);
    g.fillStyle(0xfff2b0);
    g.fillRect(x + side * 100 - 3, y - 41, 6, 4);
    g.fillStyle(0x8a7a6c);
    g.fillRect(x + side * 62 - 9, y - 12, 18, 2);
    g.fillRect(x + side * 62 - 8, y - 10, 2, 5);
    g.fillRect(x + side * 62 + 6, y - 10, 2, 5);
    g.fillStyle(0xb9b0a0);
    g.fillRect(x + side * 34 - 8, y - 12, 16, 7);
    g.fillStyle(LEAF);
    g.fillCircle(x + side * 34 - 3, y - 14, 5);
    g.fillCircle(x + side * 34 + 4, y - 13, 4);
    g.fillStyle(LEAF_LIGHT);
    g.fillCircle(x + side * 34 - 4, y - 16, 1.5);
  }
  g.fillStyle(0xb9b0a0);
  g.fillRect(x - 14, y - 22, 28, 17);
  g.fillStyle(0xd9d2c3);
  g.fillRect(x - 17, y - 25, 34, 4);
  g.fillStyle(0xa86f3c);
  g.fillTriangle(x - 5, y - 49, x - 5, y - 33, x - 15, y - 31);
  g.fillRect(x - 4, y - 35, 3, 10);
  g.fillRect(x + 1, y - 35, 3, 10);
  g.fillRect(x - 5, y - 48, 10, 14);
  g.fillCircle(x, y - 52, 4);
  g.fillRect(x + 4, y - 63, 3, 16);
  g.fillStyle(0xd69a5a);
  g.fillRect(x - 4, y - 48, 2, 12);
  g.fillRect(x + 4, y - 63, 1, 16);
}

// City hall with a copper-green clock tower; the clock actually ticks.
export function drawCityHall(g, x, y, elapsed) {
  // --- Stone Base & Graduated Portico Steps ---
  g.fillStyle(0xa8a092);
  g.fillRect(x - 74, y - 4, 148, 4);
  g.fillStyle(0xbcb4a6);
  g.fillRect(x - 70, y - 8, 140, 4);
  g.fillStyle(0xd0c8bb);
  g.fillRect(x - 66, y - 12, 132, 4);
  // Portico cheek walls on the flanks with molded caps
  g.fillStyle(0xb2aa9c);
  g.fillRect(x - 74, y - 14, 8, 10);
  g.fillRect(x + 66, y - 14, 8, 10);
  g.fillStyle(0xded8cc);
  g.fillRect(x - 75, y - 16, 10, 2);
  g.fillRect(x + 65, y - 16, 10, 2);

  // --- Main Facade & Recessed Colonnade Loggia ---
  g.fillStyle(0xd6cfc0);
  g.fillRect(x - 70, y - 56, 140, 44);
  // Rusticated masonry corner quoins on outer wings
  g.fillStyle(0xc0b8aa);
  for (let qy = y - 54; qy < y - 12; qy += 6) {
    g.fillRect(x - 70, qy, 6, 3);
    g.fillRect(x + 64, qy, 6, 3);
  }
  // Recessed shaded wall behind portico columns
  g.fillStyle(0x766f64);
  g.fillRect(x - 58, y - 56, 116, 44);

  // Tall arched windows behind columns with warm golden interior illumination
  for (let wi = 0; wi < 4; wi++) {
    const wx = x - 48 + wi * 32;
    if (Math.abs(wx - x) < 14) continue; // center is the door
    g.fillStyle(0x4a4339);
    g.fillRect(wx - 4, y - 46, 8, 26);
    g.fillCircle(wx, y - 46, 4);
    g.fillStyle(WINDOW_WARM, 0.85);
    g.fillRect(wx - 3, y - 44, 6, 23);
    g.fillCircle(wx, y - 45, 3);
    // Window mullions and stone keystone
    g.fillStyle(0x4a4339);
    g.fillRect(wx - 1, y - 45, 2, 24);
    g.fillRect(wx - 3, y - 34, 6, 1);
    g.fillStyle(0xdcd6c8);
    g.fillRect(wx - 2, y - 51, 4, 3);
  }

  // Grand double entrance: arched mahogany civic doors with brass fittings
  g.fillStyle(0x382a1e);
  g.fillRect(x - 7, y - 34, 14, 22);
  g.fillCircle(x, y - 34, 7);
  // Fanlight transom above the door
  g.fillStyle(WINDOW_WARM, 0.9);
  g.fillCircle(x, y - 34, 5.5);
  g.fillStyle(0x382a1e);
  g.fillRect(x - 6, y - 34, 12, 1);
  g.fillRect(x - 1, y - 39, 2, 6);
  // Polished mahogany door panels
  g.fillStyle(0x563824);
  g.fillRect(x - 6, y - 33, 5, 21);
  g.fillRect(x + 1, y - 33, 5, 21);
  // Brass kickplates and handles
  g.fillStyle(0xd4af37);
  g.fillRect(x - 6, y - 15, 5, 3);
  g.fillRect(x + 1, y - 15, 5, 3);
  g.fillRect(x - 2, y - 24, 1, 3);
  g.fillRect(x + 1, y - 24, 1, 3);

  // --- Fluted Classical Columns (8 fluted columns with Corinthian capitals & bases) ---
  for (let i = 0; i < 8; i++) {
    const cx = x - 58 + i * 16.5;
    // Square base plinth
    g.fillStyle(0xbcb4a4);
    g.fillRect(cx - 4, y - 15, 8, 3);
    g.fillStyle(0xded8cc);
    g.fillRect(cx - 3, y - 17, 6, 2);
    // Column shaft with cylindrical 3D shading
    g.fillStyle(0xb5aca0); // right shaded core
    g.fillRect(cx - 2.5, y - 52, 5, 35);
    g.fillStyle(0xe2dcd0); // body
    g.fillRect(cx - 2.5, y - 52, 3.5, 35);
    g.fillStyle(0xf8f5ed); // left highlight rim
    g.fillRect(cx - 2.5, y - 52, 1.2, 35);
    // Fluting line
    g.fillStyle(0xcac2b4);
    g.fillRect(cx, y - 51, 1, 33);
    // Capital (volute scroll / acanthus)
    g.fillStyle(0xebe5da);
    g.fillRect(cx - 4, y - 54, 8, 2.5);
    g.fillRect(cx - 3, y - 56, 6, 2);
    g.fillStyle(0x8a8276);
    g.fillRect(cx - 4, y - 54, 1.5, 1.5);
    g.fillRect(cx + 2.5, y - 54, 1.5, 1.5);
  }

  // --- Entablature & Dentil Frieze ---
  g.fillStyle(0xb8b0a2);
  g.fillRect(x - 74, y - 61, 148, 5);
  g.fillStyle(0xe2dcd2);
  g.fillRect(x - 76, y - 63, 152, 2.5);
  // Dentil course
  g.fillStyle(0xf2ede4);
  for (let dx = -72; dx <= 72; dx += 4) {
    g.fillRect(x + dx, y - 60, 2, 2);
  }

  // Classical stone balustrades on roof terrace wings
  g.fillStyle(0xb0a89a);
  g.fillRect(x - 70, y - 67, 26, 1.5);
  g.fillRect(x + 44, y - 67, 26, 1.5);
  for (let bx = -68; bx <= -46; bx += 3) g.fillRect(x + bx, y - 66, 1.5, 3);
  for (let bx = 46; bx <= 68; bx += 3) g.fillRect(x + bx, y - 66, 1.5, 3);
  // Decorative stone urns on corner terrace piers
  for (const ux of [x - 69, x + 69]) {
    g.fillStyle(0xded8cc);
    g.fillRect(ux - 2, y - 70, 4, 3);
    g.fillRect(ux - 1, y - 72, 2, 2);
  }

  // The tower footing extends behind the sloped roof so its outer corners meet the pediment.
  g.fillStyle(0xb8b0a2);
  g.fillRect(x - 16, y - 84, 32, 12);
  g.fillStyle(0xd6cfc2);
  g.fillRect(x - 14, y - 84, 28, 12);

  // --- Classical Triangular Pediment ---
  g.fillStyle(0xb5aca0);
  g.fillTriangle(x - 45, y - 63, x, y - 82, x + 45, y - 63);
  g.fillStyle(0xded8cc);
  g.fillTriangle(x - 42, y - 64, x, y - 80, x + 42, y - 64);
  // Sculpted tympanum bas-relief: gilded civic crest & laurel wreath
  g.fillStyle(0xd4af37);
  g.fillCircle(x, y - 71, 5);
  g.fillStyle(0x9a7a28);
  g.fillCircle(x, y - 71, 3);
  g.fillStyle(0xd4af37);
  g.fillRect(x - 1, y - 73, 2, 4);
  // Raking cornice moulding with acroteria at apex and eaves
  g.fillStyle(0xf2ede4);
  g.fillRect(x - 2, y - 84, 4, 4); // apex acroterion
  g.fillRect(x - 44, y - 66, 3, 3);
  g.fillRect(x + 41, y - 66, 3, 3);

  // --- Clock Tower Shaft ---
  g.fillStyle(0xb8b0a2);
  g.fillRect(x - 16, y - 134, 32, 54);
  g.fillStyle(0xd6cfc2);
  g.fillRect(x - 14, y - 134, 28, 54);
  // Rusticated corner stone quoins on tower
  g.fillStyle(0xa8a092);
  for (let ty = y - 132; ty < y - 82; ty += 6) {
    g.fillRect(x - 15, ty, 3, 3);
    g.fillRect(x + 12, ty, 3, 3);
  }
  // Tower belt courses
  g.fillStyle(0xe2dcd2);
  g.fillRect(x - 17, y - 96, 34, 2.5);
  g.fillRect(x - 17, y - 124, 34, 2.5);

  // Arched belfry window louvers below the clock
  g.fillStyle(0x3a3630);
  g.fillRect(x - 5, y - 92, 10, 10);
  g.fillCircle(x, y - 92, 5);
  g.fillStyle(0xd4af37, 0.7); // brass bell visible inside
  g.fillCircle(x, y - 88, 2.5);
  g.fillStyle(0x766f64);
  for (let ly = y - 89; ly <= y - 83; ly += 2) g.fillRect(x - 4, ly, 8, 1);

  // --- Ornate Clock Face ---
  // Outer decorative bronze bezel rim
  g.fillStyle(0xc49a45);
  g.fillCircle(x, y - 110, 11);
  g.fillStyle(0x4a3a18);
  g.fillCircle(x, y - 110, 9.5);
  // Warm illuminated clock dial face
  g.fillStyle(0xfdfbf2);
  g.fillCircle(x, y - 110, 8.5);
  // Dial tick marks for 12, 3, 6, 9
  g.fillStyle(0x303030);
  g.fillRect(x - 0.5, y - 118, 1, 2); // 12
  g.fillRect(x - 0.5, y - 104, 1, 2); // 6
  g.fillRect(x - 8, y - 110.5, 2, 1); // 9
  g.fillRect(x + 6, y - 110.5, 2, 1); // 3
  for (const [tx, ty] of [[x - 4.5, y - 116], [x + 3.5, y - 116], [x - 4.5, y - 105], [x + 3.5, y - 105]]) {
    g.fillRect(tx, ty, 1, 1);
  }
  // Delicate ticking clock hands
  const minute = elapsed * 0.6;
  g.lineStyle(1.8, 0x1f1f1f);
  g.lineBetween(x, y - 110, x + Math.sin(minute) * 6.5, y - 110 - Math.cos(minute) * 6.5);
  g.lineStyle(2.2, 0x1f1f1f);
  g.lineBetween(x, y - 110, x + Math.sin(minute / 12) * 4.2, y - 110 - Math.cos(minute / 12) * 4.2);
  // Central pivot hub & subtle glass glare glint
  g.fillStyle(0xc49a45);
  g.fillCircle(x, y - 110, 1.5);
  g.fillStyle(0xffffff, 0.45);
  g.fillRect(x - 4, y - 115, 3, 2);

  // --- Baroque / Neoclassical Copper Belfry Drum & Spire ---
  // Octagonal copper cornice drum
  g.fillStyle(0x4a7860);
  g.fillRect(x - 17, y - 138, 34, 4);
  g.fillStyle(0x76b898);
  g.fillRect(x - 17, y - 138, 34, 1.2);
  // Faceted bell dome with copper verdigris ribs & lighting
  g.fillStyle(0x43765b);
  g.fillTriangle(x - 18, y - 138, x, y - 165, x + 18, y - 138);
  g.fillStyle(0x5e9e7e); // main sunlit facet
  g.fillTriangle(x - 13, y - 138, x, y - 165, x + 8, y - 138);
  g.fillStyle(0x82caa4); // bright left specular copper rib
  g.fillTriangle(x - 10, y - 138, x, y - 165, x - 3, y - 138);

  // Needle spire & Gilded Weather Vane, rising straight from the dome's tip.
  g.fillStyle(0x2f3630);
  g.fillRect(x, y - 186, 1, 22);
  // Directional cross arms
  g.fillRect(x - 3, y - 178, 7, 1);
  // Gilded arrow vane on the rod: a thin shaft, arrowhead and tail fin, foreshortening as it
  // swings round in the wind, and a gilt ball on top.
  g.fillStyle(0xd4af37);
  const half = Math.max(1, Math.round(5 * Math.abs(Math.cos(Math.sin(elapsed * 0.6) * 1.1))));
  g.fillRect(x - half + 1, y - 183, half * 2 - 1, 1);
  g.fillTriangle(x + half, y - 185, x + half + 3, y - 182.5, x + half, y - 180);
  g.fillRect(x - half, y - 185, 1, 4);
  g.fillCircle(x + 0.5, y - 187, 1.2);
}

// Green Park: trees around a fountain with a looping spray.
export function drawPark(g, x, y, elapsed) {
  for (const [dx, size] of [[-130, 11], [-95, 14], [-45, 12], [50, 13], [95, 15], [135, 10]]) {
    g.fillStyle(0x6b4f3a);
    g.fillRect(x + dx - 2, y - size - 4, 4, size + 4);
    g.fillStyle(0x4f9a52);
    g.fillCircle(x + dx, y - size * 2, size);
    g.fillStyle(0x72bb6a);
    g.fillCircle(x + dx - size * 0.3, y - size * 2.3, size * 0.5);
  }

  // --- Classical Tiered Marble Fountain Architecture ---
  // Sub-base paving & lower basin plinth
  g.fillStyle(0xa49e92);
  g.fillRect(x - 38, y - 3, 76, 3);
  g.fillStyle(0xbdb6aa);
  g.fillRect(x - 34, y - 6, 68, 3);
  // Outer carved basin walls
  g.fillStyle(0xcac3b6);
  g.fillRect(x - 26, y - 12, 52, 6);
  g.fillStyle(0xdcd5c8); // highlighted rim
  g.fillRect(x - 28, y - 13, 56, 2.5);

  // Lower basin interior pool (deep turquoise to bright cyan water)
  g.fillStyle(0x2382ad);
  g.fillRect(x - 24, y - 10, 48, 4);
  g.fillStyle(0x3ea7d8);
  g.fillRect(x - 24, y - 9, 48, 2);

  // Central sculpted pedestal column
  g.fillStyle(0xa49d90);
  g.fillRect(x - 4, y - 24, 8, 12);
  g.fillStyle(0xd8d1c4);
  g.fillRect(x - 3, y - 24, 6, 12);
  g.fillStyle(0xe8e2d6);
  g.fillRect(x - 3, y - 24, 2, 12);

  // Upper spillway basin / bowl
  g.fillStyle(0xb2ab9e);
  g.fillRect(x - 13, y - 26, 26, 3);
  g.fillStyle(0xd6cfc2);
  g.fillRect(x - 15, y - 28, 30, 2.5);
  g.fillStyle(0x389ccb); // upper water pool
  g.fillRect(x - 12, y - 27, 24, 1.5);
  // Center nozzle finial
  g.fillStyle(0xa49d90);
  g.fillRect(x - 2, y - 32, 4, 4);
  g.fillStyle(0xdcd5c8);
  g.fillRect(x - 1, y - 33, 2, 2);

  // --- Dynamic Fluid Fountain Water Animation ---

  // 1. Center High-Pressure Water Column (Geyser)
  const geyserPulse = 0.85 + 0.15 * Math.sin(elapsed * 4.2);
  const geyserH = 14 * geyserPulse;
  // Core upward column
  g.fillStyle(0xd8f4ff, 0.95);
  g.fillRect(x - 1, y - 33 - geyserH, 2, geyserH);
  g.fillStyle(0xffffff, 0.9);
  g.fillRect(x - 0.5, y - 33 - geyserH, 1, geyserH);
  // Blossoming crowned plume at apex
  const apexWobble = Math.sin(elapsed * 8) * 1.5;
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(x + apexWobble * 0.5, y - 34 - geyserH, 2.5);
  g.fillStyle(0xc2edff, 0.8);
  g.fillCircle(x - 2.5 + apexWobble, y - 33 - geyserH + 2, 2);
  g.fillCircle(x + 2.5 - apexWobble, y - 33 - geyserH + 2, 2);

  // 2. Continuous Parabolic Water Streams cascading into lower basin
  const streams = [
    { side: -1, reach: 21, height: 20, speed: 0.85, phase: 0.0 },
    { side:  1, reach: 21, height: 20, speed: 0.85, phase: 0.5 },
    { side: -1, reach: 15, height: 16, speed: 1.05, phase: 0.25 },
    { side:  1, reach: 15, height: 16, speed: 1.05, phase: 0.75 },
    { side: -1, reach: 25, height: 18, speed: 0.75, phase: 0.15 },
    { side:  1, reach: 25, height: 18, speed: 0.75, phase: 0.65 },
  ];
  for (const str of streams) {
    for (let d = 0; d < 6; d++) {
      const t = (elapsed * str.speed + str.phase + d / 6) % 1;
      const px = x + str.side * (t * str.reach);
      // Parabolic flight: starts with upward climb then falls under gravity into lower pool
      const py = (y - 33) - str.height * (1 - Math.pow(2 * t - 0.4, 2));
      if (py > y - 8) continue; // splashdown
      const dropAlpha = 0.95 - 0.35 * t;
      g.fillStyle(t < 0.4 ? 0xffffff : 0xd2f0ff, dropAlpha);
      g.fillRect(px - 0.5, py - 0.5, 1.5, 1.5);
    }
  }

  // 3. Overflow Weirs / Waterfalls from Upper Basin into Lower Basin
  for (let ox = -13; ox <= 13; ox += 3) {
    if (Math.abs(ox) < 3) continue;
    const fallT = (elapsed * 2.5 + Math.abs(ox) * 0.4) % 1;
    const fallY = (y - 26) + fallT * 15;
    g.fillStyle(0xffffff, 0.85 * (1 - fallT * 0.3));
    g.fillRect(x + ox, fallY, 1, 2);
  }

  // 4. Foam Rings & Churning Splash in Lower Basin
  for (let s = -1; s <= 1; s += 2) {
    const splashX = x + s * 19;
    const splashPulse = (elapsed * 3.5 + (s > 0 ? 0.5 : 0)) % 1;
    g.fillStyle(0xffffff, 0.9 * (1 - splashPulse));
    g.fillRect(splashX - 2, y - 9, 4, 1.5);
    g.fillStyle(0xdcf4ff, 0.6 * (1 - splashPulse));
    const rW = 2 + splashPulse * 5;
    g.fillRect(splashX - rW, y - 8, rW * 2, 1);
  }

  // Center basin bubbling foam
  const bubbleT = (elapsed * 3) % 1;
  g.fillStyle(0xffffff, 0.7 * (1 - bubbleT));
  g.fillRect(x - 3, y - 10, 6, 1.5);

  // 5. Fine Floating Water Mist Particles
  for (let m = 0; m < 5; m++) {
    const mt = (elapsed * 0.6 + m * 0.2) % 1;
    const mx = x + (Math.sin(m * 3.1 + elapsed * 1.5) * 16) + (m % 2 ? 2 : -2) * mt * 8;
    const my = (y - 30) - mt * 22;
    g.fillStyle(0xe8f8ff, 0.5 * (1 - mt));
    g.fillRect(mx, my, 1, 1);
  }
}

// Meadow Tower: Green City's signature spire. A garden podium with a colonnade; a darker glass
// shaft with lit panes, pale vertical fins and corner piers, sky lobbies planted with trees; a
// crown that steps in through chamfered setbacks to a glowing lantern; and a needle with rings and
// a beacon that tops every street high-rise.
function drawSkyscraper(g, x, y, elapsed) {
  const body = 0x6f8a98;
  const shade = 0x5f7886;
  const pier = 0x86a0ad;
  // Podium: stone with a colonnade of glass bays and a planted roof.
  g.fillStyle(0xc9c1b0);
  g.fillRect(x - 100, y - 48, 200, 48);
  g.fillStyle(0xd9d2c3);
  g.fillRect(x - 102, y - 50, 204, 3);
  g.fillStyle(GLASS);
  for (let wx = x - 94; wx < x + 88; wx += 12) if (Math.abs(wx + 4 - x) > 16) g.fillRect(wx, y - 40, 8, 30);
  g.fillStyle(0xb5ad9c);
  for (let wx = x - 96; wx < x + 96; wx += 12) g.fillRect(wx, y - 42, 2, 34);
  g.fillStyle(0xa59d8c);
  g.fillRect(x - 100, y - 8, 200, 8);
  // Shaft.
  g.fillStyle(body);
  g.fillRect(x - 75, y - 470, 150, 422);
  paneGrid(g, x - 68, x + 66, y - 464, y - 52, 8, 4, 31.7, body);
  g.fillStyle(pier);
  for (let fx = x - 62; fx < x + 66; fx += 12) g.fillRect(fx, y - 468, 1, 418);
  g.fillRect(x - 75, y - 470, 5, 422);
  g.fillStyle(shade);
  g.fillRect(x + 67, y - 470, 8, 422);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(x - 70, y - 470, 4, 422);
  // Sky lobbies: a recessed glass band with planters and two trees.
  for (const level of [160, 320]) {
    g.fillStyle(0x4f6470);
    g.fillRect(x - 75, y - level - 8, 150, 10);
    g.fillStyle(0xf2e6b0, 0.8);
    g.fillRect(x - 70, y - level - 6, 140, 5);
    g.fillStyle(LEAF);
    g.fillRect(x - 76, y - level, 152, 3);
    for (const tx of [-55, 50]) {
      g.fillStyle(0x6b4f3a);
      g.fillRect(x + tx, y - level - 7, 2, 7);
      g.fillStyle(LEAF);
      g.fillCircle(x + tx + 1, y - level - 9, 5);
      g.fillStyle(LEAF_LIGHT);
      g.fillCircle(x + tx - 1, y - level - 11, 2);
    }
  }
  // Crown: chamfered setbacks, terraces, a glowing lantern and the needle.
  g.fillStyle(body);
  g.fillRect(x - 60, y - 500, 120, 30);
  g.fillTriangle(x - 75, y - 470, x - 60, y - 470, x - 60, y - 500);
  g.fillTriangle(x + 75, y - 470, x + 60, y - 470, x + 60, y - 500);
  g.fillRect(x - 44, y - 530, 88, 30);
  g.fillTriangle(x - 60, y - 500, x - 44, y - 500, x - 44, y - 530);
  g.fillTriangle(x + 60, y - 500, x + 44, y - 500, x + 44, y - 530);
  paneGrid(g, x - 54, x + 52, y - 494, y - 474, 7, 4, 12.3, body);
  paneGrid(g, x - 38, x + 36, y - 524, y - 504, 7, 4, 15.9, body);
  g.fillStyle(LEAF);
  g.fillRect(x - 75, y - 473, 150, 3);
  g.fillRect(x - 60, y - 503, 120, 3);
  g.fillRect(x - 44, y - 533, 88, 3);
  g.fillStyle(0x4f6470);
  g.fillRect(x - 28, y - 556, 56, 23);
  g.fillStyle(0xf2e6b0, 0.55 + 0.15 * Math.sin(elapsed * 1.5));
  g.fillRect(x - 24, y - 552, 48, 15);
  g.fillStyle(0x4f6470);
  for (let lx = x - 18; lx < x + 24; lx += 8) g.fillRect(lx, y - 552, 1, 15);
  g.fillStyle(0xd9b56a);
  g.fillRect(x - 30, y - 558, 60, 2);
  g.fillRect(x - 46, y - 532, 92, 1);
  g.fillStyle(0x9aa6ac);
  g.fillRect(x - 1.5, y - 625, 3, 67);
  for (const ry of [575, 595, 612]) g.fillRect(x - 4, y - ry, 8, 2);
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 4) > 0));
  g.fillCircle(x, y - 626, 3);
  // Podium planting.
  g.fillStyle(LEAF);
  g.fillRect(x - 101, y - 53, 202, 3);
  g.fillCircle(x - 94, y - 54, 4);
  g.fillCircle(x + 94, y - 54, 4);
  g.fillCircle(x - 84, y - 53, 3);
  g.fillCircle(x + 84, y - 53, 3);
  // Lobby doors under a canopy.
  g.fillStyle(0xe8ecee);
  g.fillRect(x - 16, y - 26, 32, 3);
  g.fillStyle(0x4f6470);
  g.fillRect(x - 9, y - 22, 18, 22);
  g.fillStyle(GLASS);
  g.fillRect(x - 8, y - 21, 7, 20);
  g.fillRect(x + 1, y - 21, 7, 20);
}

// Window grid helper for the mega-towers: a glass grid with a lit pane now and then. Lit panes
// are worked out once per grid and cached, so a frame only draws them.
const LIT = new Map();
function paneGrid(g, left, right, top, bottom, step, pane, seed, frame) {
  const cols = Math.floor((right - left - pane) / (pane + 2)) + 1;
  const rows = Math.ceil((bottom - top) / step);
  const h = Math.max(2, step - 3);
  glassGrid(g, left, top, cols, rows, pane + 2, step, pane, h, frame);
  const key = `${cols},${rows},${seed}`;
  if (!LIT.has(key)) {
    const lit = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (hash(seed + c * 0.29 + r * 0.071) > 0.95) lit.push(c, r);
    LIT.set(key, lit);
  }
  const lit = LIT.get(key);
  g.fillStyle(0xf2e6b0);
  for (let i = 0; i < lit.length; i += 2) g.fillRect(left + lit[i] * (pane + 2), top + lit[i + 1] * step, pane, h);
}

// Apex Spire: three stepped tiers of slate-blue glass with pale vertical fins, a gold-trimmed
// crown and a long needle with a beacon. A helipad cantilevers off the third setback, and each
// setback carries a planted terrace: perches for a fight high above the street.
function drawApexSpire(g, x, y, elapsed) {
  const BODY = 0x5d7d8f;
  const SHADE = 0x4f6d7e;
  const FIN = 0x8fb0bf;
  const TRIM = 0xd9b56a;
  const tiers = [[110, 50, 480], [82, 480, 650], [56, 650, 760]];
  // Stone podium with a glass lobby.
  g.fillStyle(0xc9c1b0);
  g.fillRect(x - 140, y - 50, 280, 50);
  g.fillStyle(0xd9d2c3);
  g.fillRect(x - 143, y - 54, 286, 4);
  for (const [half, from, to] of tiers) {
    g.fillStyle(BODY);
    g.fillRect(x - half, y - to, half * 2, to - from);
    g.fillStyle(SHADE);
    g.fillRect(x + half - 8, y - to, 8, to - from);
    paneGrid(g, x - half + 4, x + half - 9, y - to + 6, y - from - 4, 7, 3, half, BODY);
    g.fillStyle(FIN);
    for (const side of [-1, 1]) {
      g.fillRect(x + side * (half - 1) - (side > 0 ? 1 : 0), y - to, 2, to - from);
      g.fillRect(x + side * Math.round(half / 2) - 1, y - to, 2, to - from);
    }
    g.fillRect(x - 1, y - to, 2, to - from);
    // Planted terrace on the setback, edged in gold.
    g.fillStyle(TRIM);
    g.fillRect(x - half - 1, y - to - 2, half * 2 + 2, 2);
    g.fillStyle(LEAF);
    g.fillRect(x - half, y - to - 5, half * 2, 3);
    g.fillCircle(x - half + 5, y - to - 6, 4);
    g.fillCircle(x + half - 5, y - to - 6, 4);
  }
  // Crown: a tapering cap, then the needle.
  g.fillStyle(BODY);
  g.fillTriangle(x - 56, y - 760, x + 56, y - 760, x + 20, y - 815);
  g.fillTriangle(x - 56, y - 760, x - 20, y - 815, x + 20, y - 815);
  g.fillStyle(SHADE);
  g.fillTriangle(x + 12, y - 760, x + 56, y - 760, x + 20, y - 815);
  g.fillStyle(TRIM);
  g.fillRect(x - 22, y - 818, 44, 3);
  g.fillStyle(0xb9c2c7);
  g.fillRect(x - 4, y - 860, 8, 42);
  g.fillRect(x - 1.5, y - 958, 3, 98);
  g.fillRect(x - 8, y - 846, 16, 2);
  g.fillRect(x - 5, y - 900, 10, 2);
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 3.1) > 0));
  g.fillCircle(x, y - 960, 3);
  // Helipad: a deck braced off the east face of the second tier, with its H and ring.
  const pad = y - 652;
  g.fillStyle(0x6d7f88);
  g.lineStyle(2, 0x6d7f88, 1);
  g.lineBetween(x + 82, pad + 30, x + 106, pad + 2);
  g.fillRect(x + 82, pad - 1, 44, 5);
  g.fillStyle(0x8a949b);
  g.fillRect(x + 82, pad - 3, 44, 2);
  g.fillStyle(0xf2f0e8);
  g.fillRect(x + 99, pad - 3, 1, 2);
  g.fillRect(x + 105, pad - 3, 1, 2);
  g.fillRect(x + 99, pad - 2, 7, 1);
  g.fillStyle(0xe8b04a, 0.5 + 0.5 * (Math.sin(elapsed * 5) > 0));
  g.fillRect(x + 124, pad - 4, 2, 1);
  // Lobby doors and podium glass.
  g.fillStyle(GLASS);
  for (let wx = x - 132; wx < x + 128; wx += 10) if (Math.abs(wx + 3 - x) > 14) g.fillRect(wx, y - 40, 6, 14);
  g.fillStyle(0x4f6470);
  g.fillRect(x - 9, y - 22, 18, 22);
  g.fillStyle(GLASS);
  g.fillRect(x - 8, y - 21, 7, 20);
  g.fillRect(x + 1, y - 21, 7, 20);
}

// Horizon Megalith: three offset slabs of pale green-blue glass, each topped by a slanted facet
// and a rooftop terrace with a railing, stepping up to the east. Mullions run the full height, and
// a sky lobby band glows partway up.
function drawMegalith(g, x, y, elapsed) {
  const GLASS_BODY = 0x8fb6c4;
  const FACET = 0x6f97a8;
  const MULLION = 0x5f8494;
  // [left, right, top] of each slab, relative to x; all stand on the ground.
  const slabs = [[-48, 6, 330], [-22, 30, 440], [6, 48, 380]];
  for (const [a, b, top] of slabs) {
    g.fillStyle(GLASS_BODY);
    g.fillRect(x + a, y - top, b - a, top);
    g.fillStyle(FACET);
    g.fillRect(x + b - 6, y - top, 6, top);
    g.fillStyle(MULLION);
    for (let mx = x + a + 6; mx < x + b - 6; mx += 6) g.fillRect(mx, y - top, 1, top - 30);
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(x + a + 2, y - top, 3, top - 30);
  }
  // Panes across the mullions, with a few lit.
  for (let wy = y - 436; wy < y - 34; wy += 9) {
    for (const [a, b, top] of slabs) {
      if (wy < y - top + 4) continue;
      for (let wx = x + a + 2; wx < x + b - 8; wx += 6) {
        if (hash(wx * 0.31 + wy * 0.17) > 0.94) {
          g.fillStyle(0xf2e6b0, 0.8);
          g.fillRect(wx + 1, wy, 4, 5);
        }
      }
    }
  }
  // Slanted crowns: each slab's roof rises to its east edge, then a terrace and railing.
  for (const [a, b, top] of slabs) {
    g.fillStyle(FACET);
    g.fillTriangle(x + a, y - top, x + b, y - top, x + b, y - top - 14);
    g.fillStyle(LEAF);
    g.fillRect(x + a, y - top - 3, Math.round((b - a) * 0.55), 3);
    g.fillCircle(x + a + 4, y - top - 4, 3);
    g.fillStyle(0xd5dde0);
    g.fillRect(x + a, y - top - 8, Math.round((b - a) * 0.55), 1);
    for (let rx = x + a; rx < x + a + (b - a) * 0.55; rx += 4) g.fillRect(rx, y - top - 8, 1, 5);
  }
  // Mast on the tallest slab.
  g.fillStyle(0xb9c2c7);
  g.fillRect(x + 20, y - 512, 2, 72);
  g.fillRect(x + 16, y - 484, 10, 2);
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 2.3 + 1) > 0));
  g.fillCircle(x + 21, y - 513, 2.5);
  // Sky lobby: a glowing band and a terrace garden two thirds of the way up.
  g.fillStyle(0xe8f2d8, 0.85);
  g.fillRect(x - 48, y - 214, 54, 6);
  g.fillRect(x - 22, y - 214, 70, 6);
  g.fillStyle(LEAF);
  g.fillRect(x - 48, y - 216, 96, 2);
  // Ground floor: a dark plinth and glass doors.
  g.fillStyle(0x4f6470);
  g.fillRect(x - 50, y - 26, 100, 26);
  g.fillStyle(GLASS);
  for (let wx = x - 44; wx < x + 44; wx += 9) if (Math.abs(wx + 3 - x) > 11) g.fillRect(wx, y - 22, 6, 18);
  g.fillRect(x - 8, y - 20, 7, 20);
  g.fillRect(x + 1, y - 20, 7, 20);
}

// Stadium: a modern arena. Lattice floodlight towers at either end; a stepped seating bowl with white
// steel ribs and team-coloured seats showing between them; a white roof canopy hung from two cable
// pylons with the scoreboard between them; a glass concourse; and a ground floor of arched gates with
// team banners. Flags wave on the roof and the scoreboard's ticker runs.
const STADIUM_GREEN = 0x3f9e5a;
const STADIUM_GOLD = 0xf2c14e;
function drawStadium(g, x, y, elapsed) {
  // Floodlight towers: twin-leg lattice, a lamp bank and its glow.
  for (const side of [-1, 1]) {
    const mx = x + side * 118;
    g.fillStyle(0x6c757b);
    g.fillRect(mx - 3, y - 89, 1, 89);
    g.fillRect(mx + 3, y - 89, 1, 89);
    g.fillStyle(0x8a9399);
    for (let h = y - 6; h > y - 89; h -= 7) {
      g.fillRect(mx - 3, h, 7, 1);
      g.fillRect(mx - 2 + ((h / 7) & 1) * 3, h - 3, 2, 1);
    }
    g.fillStyle(0x4a5257);
    g.fillRect(mx - 10, y - 98, 21, 10);
    g.fillStyle(0xfff4c0);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) g.fillRect(mx - 9 + i * 5, y - 97 + j * 4, 4, 3);
    g.fillStyle(0xfff4c0, 0.16 + 0.05 * Math.sin(elapsed * 2 + side));
    g.fillRect(mx - 13, y - 100, 27, 15);
  }
  // Seating bowl: four tiers stepping in toward the top, white ribs, seats glimpsed between them.
  for (let i = 0; i < 4; i++) {
    const w = 232 - i * 12;
    const ty = y - 40 - i * 6;
    g.fillStyle(i % 2 ? 0xcfc8b8 : 0xdcd5c6);
    g.fillRect(x - w / 2, ty, w, 6);
    g.fillStyle(0xa79f8f);
    g.fillRect(x - w / 2, ty + 5, w, 1);
    g.fillStyle(i % 2 ? STADIUM_GOLD : STADIUM_GREEN);
    for (let sx = x - w / 2 + 6; sx < x + w / 2 - 10; sx += 16) g.fillRect(sx + 3, ty + 2, 9, 2);
  }
  g.fillStyle(0xf4f2ec);
  for (let rx = -112; rx <= 112; rx += 16) {
    const lean = Math.round(rx / 40);
    for (let i = 0; i < 4; i++) {
      if (Math.abs(rx) > 116 - i * 6) continue;
      g.fillRect(x + rx - lean + Math.round(lean * i / 4), y - 40 - i * 6, 2, 6);
    }
  }
  // Roof canopy: a white membrane edge with its shaded underside and rib caps.
  g.fillStyle(0xb9b4a8);
  g.fillRect(x - 104, y - 59, 208, 3);
  g.fillStyle(0xf6f4ee);
  g.fillEllipse(x, y - 62, 216, 10);
  g.fillStyle(0xdedad0);
  for (let rx = -96; rx <= 96; rx += 16) g.fillRect(x + rx, y - 64, 1, 4);
  // Cable pylons, with stays down to the canopy.
  g.lineStyle(1, 0x9aa2a8, 0.9);
  for (const side of [-1, 1]) {
    const px = x + side * 44;
    for (const reach of [20, 44, 68]) {
      g.lineBetween(px, y - 88, px + side * reach, y - 63);
      g.lineBetween(px, y - 88, px - side * Math.min(reach, 30), y - 63);
    }
  }
  for (const side of [-1, 1]) {
    g.fillStyle(0xe8e6e0);
    g.fillRect(x + side * 44 - 1, y - 90, 3, 28);
    g.fillStyle(0xd0563e);
    g.fillRect(x + side * 44 - 1, y - 91, 3, 1);
  }
  // Scoreboard: a framed screen, two team blocks, and a ticker light sweeping along the bottom.
  g.fillStyle(0x2a3034);
  g.fillRect(x - 25, y - 88, 50, 22);
  g.fillRect(x - 1, y - 66, 2, 4);
  g.fillStyle(0x1d3a52);
  g.fillRect(x - 23, y - 86, 46, 15);
  g.fillStyle(STADIUM_GREEN);
  g.fillRect(x - 20, y - 84, 14, 5);
  g.fillStyle(STADIUM_GOLD);
  g.fillRect(x + 6, y - 84, 14, 5);
  g.fillStyle(0xf4f6f2);
  g.fillRect(x - 15, y - 77, 4, 4);
  g.fillRect(x + 11, y - 77, 4, 4);
  g.fillRect(x - 1, y - 76, 2, 2);
  const tick = Math.floor((elapsed * 18) % 42);
  g.fillStyle(0xffd26a);
  g.fillRect(x - 21 + tick, y - 70, 4, 1);
  // Concourse: team bands over a glass curtain wall between columns.
  g.fillStyle(STADIUM_GREEN);
  g.fillRect(x - 118, y - 37, 236, 3);
  g.fillStyle(STADIUM_GOLD);
  g.fillRect(x - 118, y - 34, 236, 1);
  g.fillStyle(0xe4ded2);
  g.fillRect(x - 118, y - 33, 236, 19);
  g.fillStyle(0x8fb3c2);
  g.fillRect(x - 113, y - 30, 226, 12);
  g.fillStyle(0xb8d2dc);
  g.fillRect(x - 113, y - 30, 226, 2);
  g.fillStyle(0xe4ded2);
  for (let cx = x - 113; cx <= x + 110; cx += 14) g.fillRect(cx, y - 30, 3, 12);
  // Ground floor: a plinth with five arched gates and team banners between them.
  g.fillStyle(0xbfb7a6);
  g.fillRect(x - 118, y - 14, 236, 14);
  g.fillStyle(0xa59d8c);
  g.fillRect(x - 118, y - 14, 236, 1);
  for (let k = -2; k <= 2; k++) {
    const gx = x + k * 44;
    g.fillStyle(0x34383c);
    g.fillRect(gx - 7, y - 9, 14, 9);
    g.fillCircle(gx, y - 9, 7);
    g.fillStyle(0xffe6a0, 0.7);
    g.fillRect(gx - 5, y - 4, 10, 1);
    if (k < 2) {
      const bx = gx + 22;
      g.fillStyle(k % 2 ? STADIUM_GOLD : STADIUM_GREEN);
      g.fillRect(bx - 3, y - 13, 6, 9);
      g.fillRect(bx - 2, y - 4, 4, 1);
      g.fillStyle(0xf4f2ec);
      g.fillRect(bx - 1, y - 10, 2, 2);
    }
  }
  // Flags on the canopy.
  for (const [dx, color] of [[-80, STADIUM_GREEN], [-20, STADIUM_GOLD], [20, STADIUM_GOLD], [80, STADIUM_GREEN]]) {
    g.fillStyle(0x7d868c);
    g.fillRect(x + dx, y - 75, 1, 12);
    g.fillStyle(color);
    g.fillRect(x + dx + 1, y - 75 + Math.round(Math.sin(elapsed * 6 + dx)), 6, 4);
  }
}

// Broadcast mast: red-and-white lattice with a beacon on top.
function drawMast(g, x, y, elapsed) {
  const top = y - 210;
  const half = h => 22 * (y - h) / (y - top) - 22;
  // Guy cables first, so the lattice draws over them.
  g.lineStyle(1, 0xa0a6aa, 0.7);
  for (const side of [-1, 1]) {
    g.lineBetween(x, y - 150, x + side * 66, y - 2);
    g.lineBetween(x, y - 90, x + side * 50, y - 2);
  }
  for (let h = y; h > top; h -= 20) {
    g.lineStyle(2, Math.round((y - h) / 20) % 2 ? 0xf2f2f2 : 0xd0563e);
    g.lineBetween(x + half(h), h, x + half(h - 20), h - 20);
    g.lineBetween(x - half(h), h, x - half(h - 20), h - 20);
    g.lineStyle(1, 0xa0a6aa);
    g.lineBetween(x + half(h), h, x - half(h - 20), h - 20);
  }
  g.fillStyle(0xd0563e);
  g.fillRect(x - 12, y - 152, 24, 3);
  g.fillStyle(0xe8ecee);
  g.fillCircle(x + 10, y - 140, 6);
  g.fillCircle(x - 8, y - 110, 5);
  g.fillCircle(x + 6, y - 178, 4);
  g.fillStyle(0xb9c2c7);
  g.fillCircle(x + 11, y - 140, 2);
  // Transmitter hut at the foot, with a planted roof.
  g.fillStyle(0x8fa7b3);
  g.fillRect(x + 22, y - 20, 32, 20);
  g.fillStyle(0x6d7f88);
  g.fillRect(x + 26, y - 12, 7, 12);
  g.fillStyle(GLASS);
  g.fillRect(x + 38, y - 15, 10, 5);
  g.fillStyle(LEAF);
  g.fillRect(x + 21, y - 23, 34, 3);
  g.fillCircle(x + 27, y - 24, 3);
  g.fillStyle(0xff4a3a, 0.4 + 0.6 * (Math.sin(elapsed * 3) > 0));
  g.fillCircle(x, top - 2, 3);
}

// Street first, so landmarks draw over any neighbour that leans into them.
export const CITY_BUILDINGS = Object.freeze([
  ...streetBuildings(),
  ...LANDMARKS.map((landmark, i) => ({ maxHealth: 300, seed: 50 + i, ...landmark })),
]);
