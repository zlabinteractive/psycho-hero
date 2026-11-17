import { CIRCUMFERENCE, elevation, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// Bayport, Meadowland's seaside port, built to the same rules as Green City
// (game-design-rules/city-design-rules.md). Two flat parallax rows of rooftops, ship masts and
// harbour cranes sit behind a destructible street of bay-fronted terraces, tall guesthouses, seafront
// shops and, near the fish market and the lighthouse, the tall black net lofts of the fishing fleet;
// between them, the docklands (cranes, containers, warehouses, a freighter and a tug) work the harbour,
// all in one muted salt-white and slate theme. The landmarks have their own palettes and detail: the
// anchor memorial, the Custom House under its copper dome, the fish market's iron-and-glass hall, the
// Port Authority with its radar tower, the Bayport Eye (a giant Ferris wheel, turning), and Bayport Lighthouse, the signature, whose beam sweeps over the
// sea and whose lantern tops everything in town.
// Everything that can break is listed once in BAYPORT_BUILDINGS, so evil mode can promote it.
export const BAYPORT = { from: 13320, to: 14560 };
const SEA_Y_OFFSET = 3;

const SKYLINE_STEP = 30;
const FAR_PARALLAX = 0.85;
const NEAR_PARALLAX = 0.93;
// Over the last TOWN_EDGE px the street thins and drops, so the town never ends as a wall.
const TOWN_EDGE = 200;
// Net lofts crowd round the fish market and the lighthouse, where the boats come in.
const LOFT_REACH = 120;

// The street theme: salt-white render, slate roofs, slate-blue trim (detail means foreground).
const RENDER = [0xdcd8ce, 0xd2d4cd, 0xd8d1c4];
const TRIM = 0x6a7a86;
const SLATE = 0x646a72;
const SLATE_DARK = 0x535860;
const SILL = 0xeeebe2;
const GLASS = 0xd5e8ee;
const DOOR = 0x4a5a66;
const TAR = 0x34383a;
const TAR_LIGHT = 0x404446;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

// Ground line under a building, where building-destruction.js bakes it too.
export function bayportBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// clear: half-width (art px) the street leaves free. width/height: hit box once promoted.
// The Ferris wheel turns with elapsed, so a promoted wheel bakes standing still (elapsed 0).
// fx draws animated parts (the lighthouse beam, flags, gulls' vane) in free roam only.
const LANDMARK_ART = [
  { id: 'anchor-memorial', open: true, x: 13452, draw: drawAnchorMemorial, clear: 24, width: 44, height: 40, maxHealth: 160 },
  { id: 'custom-house', x: 13610, door: true, draw: drawCustomHouse, fx: customFlagFx, clear: 54, width: 106, height: 122 },
  { id: 'fish-market', x: 13905, door: true, draw: drawFishMarket, clear: 62, width: 120, height: 60 },
  { id: 'port-authority', x: 13752, door: true, draw: drawPortAuthority, clear: 36, width: 68, height: 154, maxHealth: 300 },
  { id: 'ferris-wheel', x: 14200, draw: drawFerrisWheel, clear: 68, width: 184, height: 198, maxHealth: 420 },
  // Wonder 5: The Pharos Grand Lighthouse of Alexandria
  { id: 'bayport-lighthouse', x: 14482, door: true, draw: drawLighthouse, fx: beamFx, clear: 58, width: 96, height: 260, maxHealth: 850 },
];
export const BAYPORT_LANDMARKS = LANDMARK_ART.map(landmark => ({ ...landmark,
  draw: scaled(landmark.draw), fx: landmark.fx && scaled(landmark.fx),
  clear: landmark.clear * CITY_SCALE, width: landmark.width * CITY_SCALE, height: landmark.height * CITY_SCALE }));

const LOFT_ANCHORS = ['fish-market', 'bayport-lighthouse'].map(id => BAYPORT_LANDMARKS.find(l => l.id === id).x);

// Free stretches of street: the town minus each landmark's clear space. The anchor memorial is
// small and open, standing on the pavement in front of the houses.
function streetSpans() {
  const cuts = BAYPORT_LANDMARKS.filter(l => !l.open).map(l => [l.x - l.clear, l.x + l.clear]).sort((a, b) => a[0] - b[0]);
  const spans = [];
  let start = BAYPORT.from;
  for (const [a, b] of [...cuts, [BAYPORT.to, BAYPORT.to]]) {
    if (a - start > 30) spans.push([start, a]);
    start = Math.max(start, b);
  }
  return spans;
}

// Street: bay-fronted terraces (kind 0), seafront shops (1), tall guesthouses (2) and, by the fish
// market and the lighthouse, net lofts (3), packed along each free span with the odd empty lot.
// Fewer and lower toward the town's ends.
const KINDS = ['terrace', 'shop', 'guesthouse', 'netloft'];
function streetBuildings() {
  const buildings = [];
  let i = 0;
  for (const [from, to] of streetSpans()) {
    for (let bx = from + 6; ; i++) {
      const seed = i + 0.47;
      const centreGuess = bx + 20;
      const loft = Math.min(...LOFT_ANCHORS.map(x => Math.abs(centreGuess - x))) < LOFT_REACH && hash(seed + 0.7) < 0.5;
      const art = loft ? 16 + Math.round(hash(seed + 0.2) * 6) : 30 + Math.round(hash(seed + 0.2) * 12);
      const width = art * CITY_SCALE;
      const centre = bx + width / 2;
      if (bx + width > to - 6) break;
      bx += width + (loft ? 2 : 3) + Math.round(hash(seed + 0.5) * 6);
      const taper = Math.min(1, Math.min(centre - BAYPORT.from, BAYPORT.to - centre) / TOWN_EDGE);
      if (hash(seed) < 0.05 + 0.25 * (1 - taper)) continue;
      const roll = hash(seed + 0.1);
      const kind = loft ? 3 : taper === 1 && roll < 0.34 ? 2 : roll < 0.72 ? 0 : 1;
      const full = [46, 32, 66, 52][kind] + Math.round(hash(seed + 0.3) * [14, 8, 16, 14][kind]);
      const height = Math.max(26, Math.round(full * (0.45 + 0.55 * taper)));
      const render = RENDER[Math.floor(hash(seed + 0.4) * RENDER.length)];
      const look = hash(seed + 0.6);
      buildings.push({
        id: `bayport-${i}`, seed, kind: KINDS[kind], x: centre, width,
        height: (height + 12) * CITY_SCALE, roof: (height + 2) * CITY_SCALE,
        maxHealth: kind === 2 ? 160 : 120, door: true,
        draw: scaled((g, at, y) => drawStreetBuilding(g, at - art / 2, y, art, height, kind, render, look)),
      });
    }
  }
  return buildings;
}

// A circle outline from straight segments: the evil-mode bake pen only draws lines and fills.
function ring(g, cx, cy, r, steps) {
  for (let i = 0; i < steps; i++) {
    const a0 = i / steps * Math.PI * 2, a1 = (i + 1) / steps * Math.PI * 2;
    g.lineBetween(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
  }
}

function window4(g, x, y, w, h) {
  g.fillStyle(SILL);
  g.fillRect(x - 1, y + h, w + 2, 1);
  g.fillStyle(GLASS);
  g.fillRect(x, y, w, h);
  g.fillStyle(lerpColor(GLASS, 0x000000, 0.18));
  g.fillRect(x, y + Math.floor(h / 2), w, 1);
}

function drawStreetBuilding(g, x, y, width, height, kind, render, look) {
  const top = y - height;
  const door = Math.round(x + width / 2);
  if (kind === 3) {
    // Net loft: a tall, narrow tarred weatherboard shed under a steep pitch, with a loading hatch.
    g.fillStyle(TAR);
    g.fillRect(x, top, width, height);
    g.fillStyle(TAR_LIGHT);
    for (let by = top + 3; by < y; by += 3) g.fillRect(x, by, width, 1);
    g.fillStyle(0x2a2d2f);
    g.fillTriangle(x - 2, top + 1, x + width / 2, top - 10, x + width + 2, top + 1);
    g.fillStyle(0x4a4e50);
    g.fillRect(door - 3, top + 6, 6, 8);
    g.fillRect(door - 3, top + 22, 6, 8);
    // A coil of rope and a buoy hung on the wall.
    g.fillStyle(0x9a8a6a);
    g.fillCircle(x + 4, y - 24, 2.5);
    g.fillStyle(0xb8604a);
    g.fillCircle(x + width - 4, y - 30, 2);
    g.fillStyle(0x24272a);
    g.fillRect(door - 4, y - 14, 8, 14);
    g.fillStyle(0xc9b48a);
    g.fillRect(door + 2, y - 7, 1, 1);
    return;
  }
  g.fillStyle(render);
  g.fillRect(x, top, width, height);
  g.fillStyle(lerpColor(render, 0x000000, 0.09));
  g.fillRect(x + width - 4, top, 4, height);
  if (kind === 1) {
    // Seafront shop: a glass front under a striped awning in the town's slate blue, flat above.
    g.fillStyle(TRIM);
    g.fillRect(x + 1, y - 17, width - 6, 17);
    g.fillStyle(GLASS);
    g.fillRect(x + 3, y - 14, width - 10, 9);
    for (let i = 0, ax = x; ax < x + width - 4; ax += 5, i++) {
      g.fillStyle(i % 2 ? SILL : TRIM);
      g.fillRect(ax, y - 22, 5, 5);
    }
    for (let wx = x + 5; wx < x + width - 9; wx += 9) window4(g, wx, top + 5, 4, 6);
  } else {
    // Bay windows stacked up the front, sash windows beside them, a balcony on guesthouses.
    const bay = look < 0.5 ? x + 4 : x + width - 16;
    for (let wy = top + 6, row = 0; wy < y - 20; wy += 13, row++) {
      g.fillStyle(lerpColor(render, 0x000000, 0.06));
      g.fillRect(bay - 1, wy - 1, 12, 10);
      g.fillStyle(GLASS);
      g.fillRect(bay, wy, 3, 8);
      g.fillRect(bay + 4, wy, 2, 8);
      g.fillRect(bay + 7, wy, 3, 8);
      g.fillStyle(SILL);
      g.fillRect(bay - 1, wy + 8, 12, 1);
      const other = look < 0.5 ? x + width - 12 : x + 5;
      window4(g, other, wy, 4, 7);
      if (kind === 2 && row % 2 === 0) {
        // Iron balcony rail across the front.
        g.fillStyle(TRIM);
        g.fillRect(x + 2, wy + 10, width - 8, 1);
        for (let rx = x + 2; rx < x + width - 6; rx += 3) g.fillRect(rx, wy + 10, 1, 3);
      }
    }
    // Ground-floor bay matches the upper ones.
    g.fillStyle(GLASS);
    g.fillRect(bay, y - 14, 10, 7);
    g.fillStyle(SILL);
    g.fillRect(bay - 1, y - 7, 12, 1);
  }
  // Slate roof: a low pitch behind a cornice, with a dormer or chimney; flat enough for gulls.
  g.fillStyle(SILL);
  g.fillRect(x - 1, top - 2, width + 2, 3);
  g.fillStyle(SLATE);
  g.fillTriangle(x, top - 2, x + width / 2, top - 9, x + width - 4, top - 2);
  g.fillStyle(SLATE_DARK);
  g.fillRect(x + (look < 0.5 ? width - 12 : 4), top - 10, 6, 8);
  if (kind === 2) {
    g.fillStyle(render);
    g.fillRect(x + width / 2 - 5, top - 8, 8, 6);
    g.fillStyle(GLASS);
    g.fillRect(x + width / 2 - 3, top - 6, 4, 3);
  }
  // Every street building has a centred door people walk in and out of, with a fanlight.
  g.fillStyle(SILL);
  g.fillRect(door - 5, y - 17, 10, 3);
  g.fillStyle(GLASS);
  g.fillRect(door - 3, y - 16, 6, 1);
  g.fillStyle(DOOR);
  g.fillRect(door - 4, y - 14, 8, 14);
  g.fillStyle(0xd9c27a);
  g.fillRect(door + 2, y - 7, 1, 1);
}

// Anchor memorial: a granite plinth with a bronze plaque, a great black anchor, and a chain looped
// between bollards.
function drawAnchorMemorial(g, x, y) {
  g.fillStyle(0x8f9196);
  g.fillRect(x - 10, y - 10, 20, 10);
  g.fillStyle(0x7d7f84);
  g.fillRect(x - 12, y - 3, 24, 3);
  g.fillRect(x - 11, y - 11, 22, 2);
  g.fillStyle(0xb08a4a);
  g.fillRect(x - 5, y - 8, 10, 4);
  // Anchor: shank, stock, ring and the curved arms with flukes.
  g.fillStyle(0x2f3336);
  g.fillRect(x - 1, y - 36, 3, 24);
  g.fillRect(x - 7, y - 32, 15, 2);
  g.lineStyle(2, 0x2f3336, 1);
  ring(g, x + 0.5, y - 38, 2.5, 8);
  for (let i = 0; i < 6; i++) {
    const a0 = (0.15 + i * 0.7 / 6) * Math.PI, a1 = (0.15 + (i + 1) * 0.7 / 6) * Math.PI;
    g.lineBetween(x + 0.5 + Math.cos(a0) * 9, y - 20 + Math.sin(a0) * 9, x + 0.5 + Math.cos(a1) * 9, y - 20 + Math.sin(a1) * 9);
  }
  g.fillTriangle(x - 10, y - 20, x - 7, y - 15, x - 5, y - 20);
  g.fillTriangle(x + 11, y - 20, x + 8, y - 15, x + 6, y - 20);
  // Bollards and the chain between them.
  for (const dx of [-20, 20]) {
    g.fillStyle(0x3b3f44);
    g.fillRect(x + dx - 2, y - 7, 5, 7);
    g.fillRect(x + dx - 3, y - 8, 7, 2);
  }
  g.fillStyle(0x4a4e52);
  for (const side of [-1, 1]) {
    for (let t = 0; t <= 1; t += 0.12) {
      const cx = x + side * (12 + t * 8);
      g.fillRect(Math.round(cx), Math.round(y - 6 + Math.sin(t * Math.PI) * 2), 2, 1);
    }
  }
}

// Custom House: pale Portland stone, lit from the left. A rusticated ground floor with arched
// windows and a smooth upper storey with hooded ones, quoined end pavilions, a balustrade with urns,
// a fluted four-column portico on steps under a pediment carved with the port's anchor and, rising
// behind it, an attic with the clock, a windowed drum, a ribbed copper dome, a lantern and the flag.
const STONE = 0xe4ddcc;
const STONE_LIGHT = 0xf0eadb;
const STONE_SHADE = 0xcfc6b2;
const STONE_DEEP = 0xb7ad97;
const COPPER = 0x6fa894;
const COPPER_LIGHT = 0x8cc0ab;
const COPPER_DARK = 0x5a8c7a;
const COPPER_DEEP = 0x4a7666;
const PANE = 0x9fb8c6;
const PANE_DARK = 0x7f98a8;
const GILT = 0xd9c27a;
const CUSTOM_POLE_TOP = 145;

// A window with glazing bars; an arched one gets a round head and a keystone.
function customWindow(g, x, top, w, h, arched) {
  g.fillStyle(STONE_DEEP);
  g.fillRect(x - 1, top, w + 2, h + 1);
  if (arched) g.fillCircle(x + w / 2, top, w / 2 + 1);
  g.fillStyle(PANE);
  g.fillRect(x, top, w, h);
  if (arched) g.fillCircle(x + w / 2, top, w / 2);
  g.fillStyle(PANE_DARK);
  const head = arched ? Math.floor(w / 2) : 0;
  g.fillRect(x + Math.floor(w / 2), top - head, 1, h + head);
  g.fillRect(x, top + Math.floor(h / 2), w, 1);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 1, top + h, w + 2, 1);
  if (arched) g.fillRect(Math.round(x + w / 2 - 1), top - head - 2, 2, 2);
}

function drawCustomHouse(g, x, y, elapsed = 0) {
  // Plinth.
  g.fillStyle(STONE_SHADE);
  g.fillRect(x - 52, y - 6, 104, 6);
  g.fillStyle(STONE_DEEP);
  g.fillRect(x - 52, y - 1, 104, 1);

  // Attic block behind the pediment, carrying the clock clear of the portico roof.
  g.fillStyle(STONE);
  g.fillRect(x - 18, y - 84, 36, 28);
  g.fillStyle(STONE_SHADE);
  g.fillRect(x + 13, y - 84, 5, 28);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 20, y - 86, 40, 2);
  g.fillStyle(STONE_DEEP);
  g.fillRect(x - 20, y - 84, 40, 1);
  g.fillStyle(STONE_DEEP);
  g.fillCircle(x, y - 76, 7);
  g.fillStyle(0xfdf8ea);
  g.fillCircle(x, y - 76, 6);
  g.fillStyle(0x3b3b3b);
  for (const [dx, dy] of [[0, -5], [5, 0], [0, 5], [-5, 0]]) g.fillRect(x + dx, y - 76 + dy, 1, 1);
  g.lineStyle(1, 0x3b3b3b);
  g.lineBetween(x, y - 76, x + Math.sin(elapsed * 0.6) * 4.5, y - 76 - Math.cos(elapsed * 0.6) * 4.5);
  g.lineBetween(x, y - 76, x + Math.sin(elapsed * 0.05) * 3, y - 76 - Math.cos(elapsed * 0.05) * 3);

  // Drum: pilasters with slit windows between them.
  g.fillStyle(STONE);
  g.fillRect(x - 15, y - 96, 30, 10);
  g.fillStyle(STONE_SHADE);
  g.fillRect(x + 9, y - 96, 6, 10);
  for (const dx of [-11, -5, 1, 7]) {
    g.fillStyle(0x52616b);
    g.fillRect(x + dx, y - 94, 3, 6);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + dx - 1, y - 95, 1, 8);
  }
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 17, y - 98, 34, 2);

  // Dome: a half-ellipse built row by row, lit on the left, ribs following its curve.
  const R = 16, H = 17, base = y - 98;
  for (let r = 0; r < H; r++) {
    const half = Math.max(1, Math.round(R * Math.sqrt(1 - ((r + 0.5) / H) ** 2)));
    const row = base - 1 - r;
    const lit = Math.round(half * 0.45);
    g.fillStyle(COPPER);
    g.fillRect(x - half, row, half * 2, 1);
    g.fillStyle(COPPER_LIGHT);
    g.fillRect(x - half + 1, row, Math.max(1, Math.round(half * 0.4)), 1);
    g.fillStyle(COPPER_DARK);
    g.fillRect(x + lit, row, Math.max(1, half - lit), 1);
    g.fillStyle(COPPER_DEEP);
    for (const f of [-0.72, -0.28, 0.28, 0.72]) g.fillRect(x + Math.round(half * f), row, 1, 1);
  }
  // Lantern: a little colonnade under a copper cap, a gilt ball, the flagstaff.
  const top = base - H;
  g.fillStyle(STONE);
  g.fillRect(x - 4, top - 8, 8, 9);
  g.fillStyle(0x52616b);
  g.fillRect(x - 2, top - 6, 1, 5);
  g.fillRect(x + 1, top - 6, 1, 5);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 5, top - 9, 10, 1);
  g.fillStyle(COPPER);
  g.fillTriangle(x - 5, top - 9, x, top - 15, x + 5, top - 9);
  g.fillStyle(COPPER_DARK);
  g.fillTriangle(x, top - 15, x + 5, top - 9, x, top - 9);
  g.fillStyle(0x6b6f74);
  g.fillRect(x, y - CUSTOM_POLE_TOP, 1, CUSTOM_POLE_TOP - (y - top + 16) + 1);
  g.fillStyle(GILT);
  g.fillCircle(x + 0.5, top - 16, 1.5);

  // Main block: rusticated ground floor, a string course, the smooth upper storey.
  g.fillStyle(STONE);
  g.fillRect(x - 50, y - 55, 100, 49);
  g.fillStyle(STONE_SHADE);
  for (let sy = y - 30, k = 0; sy < y - 6; sy += 4, k++) {
    g.fillRect(x - 50, sy, 100, 1);
    for (let jx = x - 50 + (k % 2 ? 6 : 0); jx < x + 50; jx += 12) g.fillRect(jx, sy, 1, 4);
  }
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 51, y - 33, 102, 2);
  g.fillStyle(STONE_DEEP);
  g.fillRect(x - 51, y - 31, 102, 1);
  // End pavilions stand forward: one lit, one shaded, quoins up the outer corners.
  for (const [px, lit] of [[x - 50, true], [x + 39, false]]) {
    g.fillStyle(lit ? STONE_LIGHT : STONE_SHADE);
    g.fillRect(px, y - 55, 11, 49);
    g.fillStyle(STONE_DEEP);
    g.fillRect(lit ? px + 11 : px - 1, y - 55, 1, 49);
    for (let qy = y - 54, k = 0; qy < y - 8; qy += 4, k++) {
      const w = k % 2 ? 4 : 6;
      g.fillRect(lit ? px : px + 11 - w, qy + 3, w, 1);
    }
    const cx = px + 5;
    g.fillStyle(STONE_DEEP);
    g.fillCircle(cx + 0.5, y - 44, 3.5);
    g.fillStyle(PANE);
    g.fillCircle(cx + 0.5, y - 44, 2.5);
    g.fillStyle(PANE_DARK);
    g.fillRect(cx, y - 44, 1, 1);
    customWindow(g, cx - 2, y - 21, 5, 11, true);
  }
  // Arched windows below; above, windows under alternating triangular and flat hoods.
  for (const [i, dx] of [-34, -25, 19, 28].entries()) {
    customWindow(g, x + dx, y - 21, 6, 11, true);
    customWindow(g, x + dx, y - 47, 6, 12, false);
    g.fillStyle(STONE_LIGHT);
    if (i % 2) g.fillTriangle(x + dx - 2, y - 48, x + dx + 3, y - 52, x + dx + 8, y - 48);
    else g.fillRect(x + dx - 2, y - 50, 10, 2);
    g.fillStyle(STONE_DEEP);
    g.fillRect(x + dx - 2, y - 48, 10, 1);
  }
  // Shade on the right-hand wing, then the cornice with its dentils.
  g.fillStyle(0x000000, 0.06);
  g.fillRect(x + 20, y - 55, 19, 49);
  g.fillStyle(STONE_DEEP);
  g.fillRect(x - 51, y - 56, 102, 1);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 52, y - 58, 104, 2);
  g.fillStyle(STONE_SHADE);
  for (let dx = -50; dx < 50; dx += 3) g.fillRect(x + dx, y - 56, 1, 1);

  // Balustrade over the wings, urns on the pedestals.
  for (const [from, to] of [[x - 52, x - 23], [x + 23, x + 52]]) {
    g.fillStyle(STONE);
    g.fillRect(from, y - 64, to - from, 2);
    g.fillRect(from, y - 60, to - from, 2);
    for (let bx = from + 2; bx < to - 1; bx += 3) {
      g.fillStyle(STONE);
      g.fillRect(bx, y - 62, 2, 2);
      g.fillStyle(STONE_SHADE);
      g.fillRect(bx + 1, y - 62, 1, 2);
    }
  }
  for (const ux of [x - 52, x - 27, x + 23, x + 48]) {
    g.fillStyle(STONE);
    g.fillRect(ux, y - 65, 4, 7);
    g.fillStyle(STONE_SHADE);
    g.fillRect(ux + 3, y - 65, 1, 7);
    g.fillStyle(STONE_LIGHT);
    g.fillEllipse(ux + 2, y - 67.5, 4, 3);
    g.fillRect(ux + 1, y - 70, 2, 2);
  }

  // Portico: the shadowed loggia and three steps up to it.
  g.fillStyle(0x8a8478);
  g.fillRect(x - 20, y - 50, 40, 44);
  g.fillStyle(0x76705f);
  g.fillRect(x - 20, y - 50, 40, 3);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 23, y - 6, 46, 2);
  g.fillStyle(STONE);
  g.fillRect(x - 25, y - 4, 50, 2);
  g.fillStyle(STONE_SHADE);
  g.fillRect(x - 27, y - 2, 54, 2);
  // Door: an arched double door under a fanlight, a lamp each side.
  g.fillStyle(STONE_SHADE);
  g.fillRect(x - 6, y - 24, 12, 18);
  g.fillCircle(x, y - 24, 6);
  g.fillStyle(0x3f4a52);
  g.fillRect(x - 4, y - 20, 8, 14);
  g.fillStyle(PANE);
  g.fillCircle(x, y - 21, 4);
  g.fillStyle(0x3f4a52);
  g.fillRect(x - 4, y - 21, 8, 1);
  g.fillRect(x, y - 25, 1, 4);
  g.fillStyle(0x2f383e);
  g.fillRect(x, y - 20, 1, 14);
  g.fillStyle(GILT);
  g.fillRect(x - 2, y - 13, 1, 1);
  g.fillRect(x + 2, y - 13, 1, 1);
  for (const lx of [x - 11, x + 9]) {
    g.fillStyle(0x2f3336);
    g.fillRect(lx, y - 30, 2, 1);
    g.fillRect(lx, y - 29, 2, 4);
    g.fillStyle(0xf4dc8a);
    g.fillRect(lx, y - 28, 2, 2);
  }
  // Four fluted columns with bases and capitals, lit from the left.
  for (const dx of [-18, -8, 4, 14]) {
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + dx, y - 47, 4, 39);
    g.fillStyle(STONE_SHADE);
    g.fillRect(x + dx + 2, y - 47, 1, 39);
    g.fillStyle(STONE_DEEP);
    g.fillRect(x + dx + 3, y - 47, 1, 39);
    g.fillStyle(STONE);
    g.fillRect(x + dx - 1, y - 8, 6, 2);
    g.fillRect(x + dx - 1, y - 49, 6, 2);
    g.fillStyle(STONE_LIGHT);
    g.fillRect(x + dx - 2, y - 50, 8, 1);
  }
  // Entablature: architrave, a frieze lettered in gilt, cornice.
  g.fillStyle(STONE);
  g.fillRect(x - 22, y - 57, 44, 7);
  g.fillStyle(STONE_DEEP);
  g.fillRect(x - 22, y - 51, 44, 1);
  g.fillStyle(STONE_SHADE);
  g.fillRect(x - 20, y - 56, 40, 3);
  g.fillStyle(0x9a874a);
  for (let lx = x - 16; lx < x + 16; lx += 3) g.fillRect(lx, y - 55, 2, 1);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 24, y - 59, 48, 2);
  // Pediment: raking cornice, shaded tympanum with the anchor in a roundel, acroteria.
  g.fillStyle(STONE_LIGHT);
  g.fillTriangle(x - 25, y - 59, x, y - 72, x + 25, y - 59);
  g.fillStyle(STONE_SHADE);
  g.fillTriangle(x - 19, y - 60, x, y - 69, x + 19, y - 60);
  g.fillStyle(STONE_DEEP);
  g.fillTriangle(x, y - 69, x + 19, y - 60, x, y - 60);
  g.fillStyle(STONE);
  g.fillCircle(x + 0.5, y - 63.5, 3.5);
  g.fillStyle(0x5f6a72);
  g.fillRect(x, y - 66, 1, 5);
  g.fillRect(x - 1, y - 65, 3, 1);
  g.fillRect(x - 2, y - 62, 1, 1);
  g.fillRect(x + 2, y - 62, 1, 1);
  g.fillRect(x - 1, y - 61, 3, 1);
  g.fillStyle(STONE_LIGHT);
  g.fillRect(x - 1, y - 74, 3, 3);
  g.fillRect(x - 26, y - 62, 3, 3);
  g.fillRect(x + 24, y - 62, 3, 3);
}

function customFlagFx(g, x, y, elapsed) {
  for (let i = 0; i < 6; i++) {
    const wave = Math.round(Math.sin(elapsed * 4 - i * 0.8) * 1.2);
    g.fillStyle(i < 3 ? 0x5f7a96 : 0xe8e2d4);
    g.fillRect(x + 1 + i * 2, y - CUSTOM_POLE_TOP + wave, 2, 6);
  }
}

// Fish market: a long hall of slate-blue ironwork under a sawtooth glass roof, its open front
// showing ice slabs heaped with fish under a painted sign, crates stacked outside.
const IRON = 0x4f6a7a;
const IRON_DARK = 0x3f5664;
function drawFishMarket(g, x, y) {
  g.fillStyle(0x8f9196);
  g.fillRect(x - 58, y - 4, 116, 4);
  // Back wall seen through the open front, then the iron frame.
  g.fillStyle(0x6b7378);
  g.fillRect(x - 56, y - 36, 112, 32);
  g.fillStyle(IRON);
  g.fillRect(x - 58, y - 40, 116, 4);
  for (let px = x - 58; px <= x + 54; px += 16) g.fillRect(px, y - 40, 4, 40);
  // Sawtooth roof: glazed north lights between iron ridges.
  for (let rx = x - 58; rx < x + 56; rx += 19) {
    g.fillStyle(0xb9d0da);
    g.fillTriangle(rx, y - 40, rx + 4, y - 54, rx + 4, y - 40);
    g.fillStyle(IRON_DARK);
    g.fillTriangle(rx + 4, y - 54, rx + 19, y - 40, rx + 4, y - 40);
    g.fillRect(rx + 3, y - 55, 2, 15);
  }
  // Sign board over the middle bay.
  g.fillStyle(0xeeebe2);
  g.fillRect(x - 22, y - 36, 44, 7);
  g.fillStyle(IRON_DARK);
  for (let lx = x - 18; lx < x + 18; lx += 4) g.fillRect(lx, y - 34, 2, 3);
  // Ice slabs with the catch: silver mackerel and pink crabs; the middle bay is the way in.
  for (const dx of [-44, -26, 18, 36]) {
    g.fillStyle(0x7a6a58);
    g.fillRect(x + dx, y - 12, 14, 12);
    g.fillStyle(0xe8f2f6);
    g.fillRect(x + dx - 1, y - 15, 16, 3);
    g.fillStyle(0xa9b8c2);
    for (let fx = 0; fx < 14; fx += 4) g.fillRect(x + dx + fx, y - 17, 3, 2);
    g.fillStyle(0xc98a7a);
    g.fillRect(x + dx + 5, y - 18, 3, 2);
  }
  g.fillStyle(0x2f3a40);
  g.fillRect(x - 6, y - 22, 12, 22);
  // Fish crates stacked by the door.
  for (const [dx, dy] of [[-68, 0], [-60, 0], [-64, -5], [60, 0]]) {
    g.fillStyle(0x6a8aa0);
    g.fillRect(x + dx, y + dy - 5, 8, 5);
    g.fillStyle(0x5a7a90);
    g.fillRect(x + dx, y + dy - 3, 8, 1);
  }
}

// The Bayport Eye: a giant seafront Ferris wheel (feedback #14), 120 px in radius as drawn. A double
// white rim on 24 spokes turns on a steel A-frame; 16 gondolas hang upright from their pins as it
// turns, and carnival bulbs round the rim chase in sea-glass colours (steady while baked for evil
// mode). A ticket booth and striped kiosks sit at its foot. No door: people queue outside.
const WHEEL_R = 86;
const WHEEL_HUB = WHEEL_R + 26;
const BULBS = [0xf2d27a, 0xe8908a, 0x8ac8e0, 0xa8d89a];
function drawFerrisWheel(g, x, y, elapsed = 0) {
  const hub = y - WHEEL_HUB;
  const angle = elapsed * 0.08;
  // A-frame legs behind the wheel, braced, on concrete pads.
  g.lineStyle(4, 0x8a96a0, 1);
  for (const side of [-1, 1]) g.lineBetween(x + side * 58, y, x + side * 3, hub);
  g.lineStyle(2, 0x7a868f, 1);
  for (const [h, w] of [[30, 43], [62, 28]]) g.lineBetween(x - w, y - h, x + w, y - h);
  g.lineBetween(x - 43, y - 30, x + 28, y - 62);
  g.lineBetween(x + 43, y - 30, x - 28, y - 62);
  g.fillStyle(0xa8a49a);
  g.fillRect(x - 66, y - 4, 16, 4);
  g.fillRect(x + 50, y - 4, 16, 4);
  // Spokes, then the two rims and the trusses between them.
  g.lineStyle(1, 0xd8d6ce, 1);
  for (let i = 0; i < 24; i++) {
    const a = angle + i * Math.PI / 12;
    g.lineBetween(x, hub, x + Math.cos(a) * WHEEL_R, hub + Math.sin(a) * WHEEL_R);
  }
  g.lineStyle(3, 0xeceae2, 1);
  ring(g, x, hub, WHEEL_R, 48);
  g.lineStyle(2, 0xdedcd4, 1);
  ring(g, x, hub, WHEEL_R - 7, 48);
  g.lineStyle(1, 0xd8d6ce, 1);
  ring(g, x, hub, WHEEL_R * 0.32, 20);
  for (let i = 0; i < 24; i++) {
    const a0 = angle + i * Math.PI / 12;
    const a1 = a0 + Math.PI / 12;
    g.lineBetween(x + Math.cos(a0) * WHEEL_R, hub + Math.sin(a0) * WHEEL_R,
      x + Math.cos(a1) * (WHEEL_R - 7), hub + Math.sin(a1) * (WHEEL_R - 7));
  }
  g.fillStyle(0x6a7a86);
  g.fillCircle(x, hub, 7);
  g.fillStyle(0xeceae2);
  g.fillCircle(x, hub, 2.5);
  // Carnival bulbs chase round the rim.
  const chase = Math.floor(elapsed * 6);
  for (let i = 0; i < 48; i++) {
    const a = angle + i * Math.PI / 24;
    const lit = elapsed === 0 || (i + chase) % 3 !== 0;
    g.fillStyle(BULBS[(i + (elapsed === 0 ? 0 : Math.floor(elapsed * 1.5))) % BULBS.length], lit ? 1 : 0.35);
    g.fillRect(Math.round(x + Math.cos(a) * (WHEEL_R + 2)) - 1, Math.round(hub + Math.sin(a) * (WHEEL_R + 2)) - 1, 2, 2);
  }
  // Gondolas hang below their pins, in muted sea colours.
  const cars = [0x5f8fa8, 0xc9a24a, 0x8c4f4a, 0x6f9a7a];
  for (let i = 0; i < 16; i++) {
    const a = angle + i * Math.PI / 8;
    const px = Math.round(x + Math.cos(a) * WHEEL_R);
    const py = Math.round(hub + Math.sin(a) * WHEEL_R);
    g.fillStyle(0x6a7a86);
    g.fillRect(px, py, 1, 3);
    g.fillStyle(cars[i % cars.length]);
    g.fillRect(px - 5, py + 3, 11, 9);
    g.fillStyle(0xeceae2);
    g.fillRect(px - 6, py + 2, 13, 2);
    g.fillStyle(GLASS);
    g.fillRect(px - 4, py + 5, 9, 3);
  }
  // Ticket booth, a striped kiosk and a lit sign arch over the queue.
  g.fillStyle(0xe6dfcc);
  g.fillRect(x - 40, y - 18, 14, 18);
  g.fillStyle(0x5f8fa8);
  g.fillRect(x - 42, y - 21, 18, 3);
  g.fillStyle(GLASS);
  g.fillRect(x - 37, y - 14, 8, 5);
  g.fillStyle(0xe8d2c8);
  g.fillRect(x + 26, y - 14, 14, 14);
  for (let i = 0, ax = x + 24; ax < x + 42; ax += 3, i++) {
    g.fillStyle(i % 2 ? 0xeceae2 : 0xc98a8a);
    g.fillRect(ax, y - 19, 3, 5);
  }
  g.fillStyle(0x6a7a86);
  g.fillRect(x - 14, y - 30, 2, 30);
  g.fillRect(x + 12, y - 30, 2, 30);
  g.fillStyle(0x3f5a6a);
  g.fillRect(x - 16, y - 36, 32, 7);
  for (let i = 0; i < 7; i++) {
    g.fillStyle(BULBS[i % BULBS.length], elapsed === 0 || (i + chase) % 2 ? 1 : 0.4);
    g.fillRect(x - 13 + i * 4, y - 34, 2, 2);
  }
}

// Port Authority: a broad ochre-brick block (feedback #19) with a stone base, rows of tall windows,
// a pale band across the front, and a square tower with a clock face, flagstaff and radar scanner
// keeping watch on the harbour. The scanner turns in free roam.
function drawPortAuthority(g, x, y, elapsed = 0) {
  const BRICK = 0xb88a5e;
  const BRICK_DARK = 0x9a7048;
  // Main block.
  g.fillStyle(BRICK);
  g.fillRect(x - 31, y - 92, 62, 92);
  g.fillStyle(BRICK_DARK);
  g.fillRect(x + 27, y - 92, 4, 92);
  for (let by = y - 88; by < y - 14; by += 6) g.fillRect(x - 31, by, 58, 1);
  g.fillStyle(0xd8d0bc);
  g.fillRect(x - 33, y - 95, 66, 4);
  g.fillRect(x - 31, y - 52, 62, 5);
  g.fillStyle(TRIM);
  for (let wx = x - 25; wx < x + 22; wx += 9) {
    for (const wy of [y - 84, y - 70, y - 42]) {
      g.fillStyle(TRIM);
      g.fillRect(wx - 1, wy - 1, 6, 11);
      g.fillStyle(GLASS);
      g.fillRect(wx, wy, 4, 9);
    }
  }
  // Stone base with the entrance.
  g.fillStyle(0x9a978f);
  g.fillRect(x - 33, y - 26, 66, 26);
  g.fillStyle(0x8a877f);
  for (let by = y - 22; by < y; by += 5) g.fillRect(x - 33, by, 66, 1);
  g.fillStyle(DOOR);
  g.fillRect(x - 6, y - 18, 12, 18);
  g.fillStyle(GLASS);
  g.fillRect(x - 4, y - 16, 3, 6);
  g.fillRect(x + 1, y - 16, 3, 6);
  g.fillStyle(0xd8d0bc);
  g.fillRect(x - 9, y - 21, 18, 3);
  // Tower: brick shaft, clock, a lookout gallery and the radar mast.
  g.fillStyle(BRICK);
  g.fillRect(x - 11, y - 138, 22, 46);
  g.fillStyle(BRICK_DARK);
  g.fillRect(x + 8, y - 138, 3, 46);
  g.fillStyle(0xf2efe6);
  g.fillCircle(x, y - 116, 7);
  g.lineStyle(1, 0x3b3b3b, 1);
  g.lineBetween(x, y - 116, x + Math.sin(elapsed * 0.6) * 5, y - 116 - Math.cos(elapsed * 0.6) * 5);
  g.lineBetween(x, y - 116, x + Math.sin(elapsed * 0.05) * 3, y - 116 - Math.cos(elapsed * 0.05) * 3);
  g.fillStyle(0x3f4a52);
  g.fillRect(x - 14, y - 141, 28, 3);
  for (let rx = x - 14; rx <= x + 13; rx += 3) g.fillRect(rx, y - 146, 1, 5);
  g.fillRect(x - 14, y - 147, 28, 1);
  g.fillStyle(0x6a7a86);
  g.fillRect(x - 1, y - 150, 2, 12);
  // Radar scanner: a bar that sweeps, seen side-on as it turns.
  const sweep = Math.cos(elapsed * 2.2);
  g.fillStyle(0x2f3336);
  g.fillRect(Math.round(x - 9 * Math.abs(sweep)) - 1, y - 152, Math.round(18 * Math.abs(sweep)) + 2, 2);
  // Flagstaff on the main roof, pennant in the port's blue.
  g.fillStyle(0x6a7a86);
  g.fillRect(x - 24, y - 112, 1, 17);
  g.fillStyle(0x4f6a86);
  g.fillTriangle(x - 23, y - 112, x - 23, y - 106, x - 15 + Math.round(Math.sin(elapsed * 5)), y - 109);
}

// Docklands (feedback #19): the working harbour behind the street, between the far rows and the
// houses. Gantry cranes, stacks of containers, sawtooth warehouses, a moored freighter and a tug at
// the quay. They are a background layer (city-design-rules.md): flat silhouettes in one shade, a step
// deeper than the near row, with no detail and no colour, so the street and its landmarks stay the
// eye-catching foreground. Parallax DOCK_PARALLAX, pivoting on the town's centre and fading at its
// ends like the rows. Items: [world x, kind, size].
const DOCK_PARALLAX = 0.965;
const DOCK_SHADE = 0x8eacba;
// The gantry cranes stand further back than the rest of the docks (QA-11): deeper parallax and a
// paler shade, drawn first, so they read as skyline behind the quay, not as obstacles in play.
const CRANE_PARALLAX = 0.93;
const CRANE_SHADE = 0xa3c0cd;
const DOCKS = [
  [13470, 'freighter', 1], [13700, 'warehouse', 1], [13800, 'containers', 5],
  [13868, 'crane', 1], [13960, 'containers', 4], [14030, 'crane', -1], [14130, 'warehouse', 0.8],
  [14330, 'containers', 3], [14385, 'crane', 1], [14520, 'tug', 1],
];
// Cranes first, so the rest of the docks overlap them.
const DOCK_ORDER = [...DOCKS.filter(item => item[1] === 'crane'), ...DOCKS.filter(item => item[1] !== 'crane')];

function drawDocklands(g, left, right, seaY, cameraX) {
  const offset = cameraX - nearest((BAYPORT.from + BAYPORT.to) / 2, cameraX);
  for (const [wx, kind, size] of DOCK_ORDER) {
    const crane = kind === 'crane';
    const at = nearest(wx, cameraX) + offset * (1 - (crane ? CRANE_PARALLAX : DOCK_PARALLAX));
    if (at < left - 260 || at > right + 260) continue;
    const fade = skylineFade(wx, wrapX(at), BAYPORT.from - 120, BAYPORT.to + 120);
    if (fade <= 0) continue;
    const y = bayportBase(wrapX(at), seaY);
    g.fillStyle(crane ? CRANE_SHADE : DOCK_SHADE, fade);
    const u = CITY_SCALE;
    if (kind === 'crane') {
      // Ship-to-shore gantry: two legs, a cross-beam, a long boom out over the water.
      const h = 128 * u, boom = 96 * u * size, leg = 30 * u;
      g.fillRect(at - leg / 2, y - h, 4, h);
      g.fillRect(at + leg / 2 - 4, y - h, 4, h);
      g.fillRect(at - leg / 2, y - h * 0.55, leg, 4);
      g.fillRect(Math.min(at - leg * 0.8 * Math.sign(size), at + boom), y - h - 6, Math.abs(boom) + leg * 0.8, 6);
      g.fillTriangle(at - 2, y - h - 6, at + 2, y - h - 36, at + 6, y - h - 6);
    } else if (kind === 'containers') {
      // Stacks of boxes, a few tiers high: one flat block per column.
      for (let col = 0; col < 4; col++) {
        const tiers = Math.max(1, size - (col % 3));
        g.fillRect(at - 2 * 34 + col * 34, y - tiers * 13, 32, tiers * 13);
      }
    } else if (kind === 'warehouse') {
      // A long shed under a sawtooth roof.
      const w = 150 * size * u, h = 46 * u;
      g.fillRect(at - w / 2, y - h, w, h);
      for (let rx = at - w / 2; rx < at + w / 2 - 1; rx += 22) g.fillTriangle(rx, y - h, rx + 22, y - h, rx + 22, y - h - 14);
    } else if (kind === 'freighter') {
      // A cargo ship at the quay: hull, a deck of boxes and the bridge house aft.
      const len = 300 * u, hull = 26 * u;
      g.fillRect(at - len / 2, y - hull, len, hull);
      g.fillTriangle(at + len / 2, y - hull, at + len / 2 + 24, y - hull, at + len / 2, y);
      g.fillRect(at - len / 2 + 70, y - hull - 18, len - 90, 18);
      g.fillRect(at - len / 2 + 14, y - hull - 58, 46, 58);
      g.fillRect(at - len / 2 + 30, y - hull - 76, 14, 18);
    } else {
      // Harbour tug: a short hull, a tall wheelhouse and a funnel.
      g.fillRect(at - 30, y - 14, 60, 12);
      g.fillRect(at - 8, y - 32, 22, 18);
      g.fillRect(at - 20, y - 30, 7, 16);
    }
  }
}

// Wonder 5: The Pharos Grand Lighthouse of Alexandria
// A colossal three-tiered classical marble marvel: a monumental fortified square base with
// Greek architraves, a soaring octagonal middle tower with fluted pilasters and observation gallery,
// an open cylindrical Corinthian colonnade housing a giant polished bronze parabolic reflector and
// blazing fire beacon, surmounted by a colossal bronze statue of the Sea God with a trident.
const LIGHT_TOP = 245;
const PHAROS_MARBLE = 0xf2efe6;
const PHAROS_SHADE = 0xd2ccc0;
const PHAROS_DARK = 0x9a9486;
const BRONZE_TITAN = 0xa87840;

function drawLighthouse(g, x, y) {
  // Keeper's annex to the west: classical portico with pediment
  g.fillStyle(PHAROS_SHADE);
  g.fillRect(x - 46, y - 24, 28, 24);
  g.fillStyle(PHAROS_MARBLE);
  g.fillTriangle(x - 48, y - 24, x - 32, y - 36, x - 16, y - 24);
  g.fillStyle(SLATE_DARK);
  g.fillRect(x - 40, y - 38, 4, 10);
  g.fillStyle(GLASS);
  g.fillRect(x - 38, y - 18, 8, 8);

  // TIER 1: Monumental Square Fortress Base (y to y - 75)
  const bH = 75;
  const bW = 64;
  g.fillStyle(0x7a8088); // Granite plinth
  g.fillRect(x - bW / 2 - 4, y - 8, bW + 8, 8);
  g.fillStyle(PHAROS_SHADE);
  g.fillRect(x - bW / 2, y - bH, bW, bH);
  g.fillStyle(PHAROS_MARBLE);
  g.fillRect(x - bW / 2, y - bH, bW * 0.55, bH);
  // Tier 1 Ashlar stone block lines
  g.fillStyle(PHAROS_DARK, 0.4);
  for (let sy = y - bH + 12; sy < y; sy += 15) g.fillRect(x - bW / 2, sy, bW, 1);
  for (let bx = x - bW / 2 + 10; bx < x + bW / 2 - 4; bx += 18) g.fillRect(bx, y - bH, 1, bH);
  // Grand arched entrance with classical pediment
  g.fillStyle(PHAROS_DARK);
  g.fillRect(x - 8, y - 22, 16, 22);
  g.fillStyle(0x181e24);
  g.fillRect(x - 6, y - 18, 12, 18);
  g.fillStyle(PHAROS_MARBLE);
  g.fillTriangle(x - 11, y - 22, x, y - 30, x + 11, y - 22);
  // Tier 1 Battlements and perimeter balcony
  g.fillStyle(PHAROS_MARBLE);
  g.fillRect(x - bW / 2 - 2, y - bH - 3, bW + 4, 4);
  g.fillStyle(PHAROS_DARK);
  for (let cx = x - bW / 2 - 2; cx <= x + bW / 2; cx += 6) g.fillRect(cx, y - bH - 7, 3, 4);

  // TIER 2: Soaring Octagonal Tower (y - 75 to y - 165)
  const t2Base = y - bH - 3;
  const t2H = 90;
  const t2Top = t2Base - t2H;
  for (let h = t2Base; h > t2Top; h -= 2) {
    const frac = (t2Base - h) / t2H;
    const w = Math.round(24 - 5 * frac);
    g.fillStyle(PHAROS_MARBLE);
    g.fillRect(x - w, h - 2, w * 2, 2);
    // Shadowed right facet of octagonal geometry
    g.fillStyle(PHAROS_SHADE);
    g.fillRect(x + Math.round(w * 0.35), h - 2, Math.round(w * 0.65), 2);
  }
  // Fluted pilasters on the facets
  g.fillStyle(PHAROS_DARK, 0.35);
  g.fillRect(x - 1, t2Top + 6, 2, t2H - 8);
  g.fillRect(x - 14, t2Top + 10, 2, t2H - 14);
  g.fillRect(x + 12, t2Top + 10, 2, t2H - 14);
  // Arched observation windows
  g.fillStyle(0x28323c);
  for (const wy of [t2Base - 24, t2Base - 52, t2Base - 78]) {
    g.fillRect(x - 2.5, wy, 5, 8);
    g.fillCircle(x, wy, 2.5);
  }
  // Tier 2 Upper Observation Balustrade & Cornice
  g.fillStyle(PHAROS_MARBLE);
  g.fillRect(x - 22, t2Top - 3, 44, 4);
  g.fillStyle(0x2f3336);
  for (let rx = x - 22; rx <= x + 21; rx += 4) g.fillRect(rx, t2Top - 8, 1, 5);
  g.fillRect(x - 22, t2Top - 9, 44, 1);

  // TIER 3: Cylindrical Rotunda Colonnade & Fire Beacon (y - 168 to y - 212)
  const rBase = t2Top - 9;
  const rTop = rBase - 36;
  // Core reflector chamber
  g.fillStyle(0x2a2a2a);
  g.fillRect(x - 14, rTop, 28, 36);
  // Polished Bronze Parabolic Mirror
  g.fillStyle(0xd9923b);
  g.fillRect(x - 10, rTop + 6, 20, 24);
  g.fillStyle(0xffd700);
  g.fillCircle(x, rTop + 18, 7);
  // Roaring beacon fire core
  g.fillStyle(0xffffff);
  g.fillCircle(x, rTop + 18, 3.5);
  // Classical colonnade pillars flanking the lantern drum
  g.fillStyle(PHAROS_MARBLE);
  for (const px of [-14, -7, 7, 14]) {
    g.fillRect(x + px - 1, rTop, 2, 36);
    g.fillRect(x + px - 2, rTop + 34, 4, 2);
  }

  // CUPOLA & SEA GOD STATUE (y - 212 to y - 245)
  // Domed cupola roof
  g.fillStyle(PHAROS_MARBLE);
  g.fillRect(x - 15, rTop - 2, 30, 3);
  g.fillStyle(PHAROS_SHADE);
  g.fillTriangle(x - 14, rTop - 2, x, rTop - 12, x + 14, rTop - 2);
  g.fillStyle(BRONZE_TITAN);
  g.fillRect(x - 5, rTop - 14, 10, 3);

  // Colossal Bronze Statue of the Sea God
  const statY = rTop - 14;
  g.fillRect(x - 2, statY - 16, 4, 16); // Torso & legs
  g.fillCircle(x, statY - 18, 3); // Head with crown
  // Crown sunburst rays
  g.fillStyle(0xffd700);
  g.fillRect(x - 3, statY - 22, 6, 1.5);
  g.fillRect(x - 0.5, statY - 24, 1, 3);
  // Raised right hand holding radiant trident spear
  g.fillStyle(BRONZE_TITAN);
  g.fillRect(x + 2, statY - 24, 1.5, 20); // Spear shaft
  g.fillStyle(0xffd700);
  g.fillRect(x, statY - 26, 5, 1.5); // Trident cross
  g.fillRect(x, statY - 28, 1, 2);
  g.fillRect(x + 2, statY - 29, 1, 3);
  g.fillRect(x + 4, statY - 28, 1, 2);
}

// The beam turns: sweeping searchlight beacon across sea and sky
function beamFx(g, x, y, elapsed) {
  const top = y - 195;
  const ly = top;
  const turn = Math.sin(elapsed * 1.2);
  const length = 240 * Math.abs(turn);
  const dir = turn > 0 ? 1 : -1;

  // Wide radiant beam cone across ocean waves
  g.fillStyle(0xfffae0, 0.28);
  g.fillTriangle(x, ly - 3, x + dir * length, ly - 22, x + dir * length, ly + 18);
  // Intense core beam
  g.fillStyle(0xffffff, 0.45);
  g.fillTriangle(x, ly - 1, x + dir * length * 0.8, ly - 8, x + dir * length * 0.8, ly + 6);
  // Glowing lantern orb
  g.fillStyle(0xfff6c8, 0.75);
  g.fillCircle(x, ly, 8);
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(x, ly, 4);

  // Beacon bonfire smoke plume rising into the sky
  for (let i = 0; i < 4; i++) {
    const age = ((elapsed * 2 + i * 0.7) % 2.5);
    const alpha = Math.max(0, 0.6 * (1 - age / 2.5));
    const sx = x + Math.sin(elapsed * 3 + i) * 6 + age * 8;
    const sy = ly - 18 - age * 24;
    g.fillStyle(0x38342e, alpha);
    g.fillCircle(sx, sy, 3 + age * 3);
  }
}

// Street first, then landmarks, matching the city's order.
export const BAYPORT_BUILDINGS = Object.freeze([
  ...streetBuildings(),
  ...BAYPORT_LANDMARKS.map((landmark, i) => ({ maxHealth: 280, seed: 240 + i, ...landmark })),
]);

// buildings: false leaves the street and landmarks to a mode that draws them itself (evil mode).
export function drawBayport(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((BAYPORT.from + BAYPORT.to) / 2, cameraX);
  const half = (BAYPORT.to - BAYPORT.from) / 2;
  if (right < mid - half - 400 || left > mid + half + 400) return;
  drawHarbourline(g, left, right, seaY, cameraX, FAR_PARALLAX, 0xa9c8d6, 1, 0.3);
  drawHarbourline(g, left, right, seaY, cameraX, NEAR_PARALLAX, 0x97b6c4, 0.7, 0.6);
  drawDocklands(g, left, right, seaY, cameraX);
  if (!buildings) return;
  for (const building of BAYPORT_BUILDINGS) {
    const at = nearest(building.x, cameraX);
    if (at + building.width / 2 + ART_MARGIN < left || at - building.width / 2 - ART_MARGIN > right) continue;
    const y = bayportBase(building.x, seaY);
    building.draw(g, at, y, elapsed);
    building.fx?.(g, at, y, elapsed);
  }
}

// Background rows: flat terraces with pitched roofs, and now and then a ship's masts or a harbour
// crane, more of them toward the sea end. No detail, pivoting on the town's centre and clipped to
// it, like the city skyline. Blocks fade out as they slide behind a landmark.
const LANDMARK_REACH = 70 * CITY_SCALE;
function drawHarbourline(g, left, right, seaY, cameraX, parallax, color, scale, salt) {
  const shift = (cameraX - nearest((BAYPORT.from + BAYPORT.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SKYLINE_STEP) - 1; i * SKYLINE_STEP + shift < right + SKYLINE_STEP; i++) {
    const wx = wrapX(i * SKYLINE_STEP);
    const x = i * SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, BAYPORT.from, BAYPORT.to);
    if (fade <= 0) continue;
    const seed = Math.round(wx / SKYLINE_STEP);
    const roll = hash(seed + salt);
    if (roll < 0.12) continue;
    const centre = wrapX(x + SKYLINE_STEP / 2);
    const clearance = Math.min(...BAYPORT_LANDMARKS.map(l => Math.abs(centre - l.x) - l.width / 2));
    const alpha = fade * Math.min(1, Math.max(0, (clearance + LANDMARK_REACH * 0.4) / (LANDMARK_REACH * 0.6)));
    if (alpha <= 0) continue;
    const y = seaY - Math.max(0, elevation(ground)) + 3;
    const unit = scale * CITY_SCALE;
    const h = Math.round((44 + hash(seed + 0.4 + salt) * 40) * unit);
    const w = SKYLINE_STEP - 2;
    g.fillStyle(color, alpha);
    g.fillRect(x, y - h, w, h);
    g.fillTriangle(x, y - h, x + w / 2, y - h - Math.round(9 * unit), x + w, y - h);
    // Toward the sea, masts and cranes rise behind the roofs.
    const seaward = (wx - BAYPORT.from) / (BAYPORT.to - BAYPORT.from);
    if (roll > 0.92 - 0.12 * seaward) {
      const mast = Math.round((110 + hash(seed + 0.8) * 40) * unit);
      g.fillRect(x + 8, y - mast, 2, mast - h);
      g.fillRect(x + 20, y - mast + 12, 2, mast - h - 12);
      g.fillRect(x + 2, y - mast + 20, 26, 1);
    } else if (roll > 0.86 - 0.1 * seaward) {
      // A harbour crane: a tower, a long jib and its counterweight.
      const tower = Math.round(120 * unit);
      g.fillRect(x + w / 2 - 2, y - tower, 4, tower - h);
      g.fillRect(x + w / 2 - 34, y - tower - 3, 48, 3);
      g.fillRect(x + w / 2 + 8, y - tower, 6, 5);
    }
  }
}
