import { CIRCUMFERENCE, elevation, isWater, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// Frostland: Snowcap Peaks, Highpass, Pinetown, Ice Lake, Snow City, Whale Fjord, Whale Harbor, and Mount Ember.
// Spans world x from 42600 to 65400 (seam back to Green City at 0).
export const FROSTLAND = { from: 42600, to: 65400 };
const SEA_Y_OFFSET = 3;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

export function frostlandBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

function footing(g, x, y, width, color, depth = 65) {
  g.fillStyle(color);
  g.fillRect(x - width / 2 - 2, y - 2, width + 4, depth);
}

// Palettes
const ICE_BLUE = 0x8fe2ff;
const ICE_DEEP = 0x5aa8cc;
const ICE_WHITE = 0xf2faff;
const BRICK_RED = 0xa44634;
const BRICK_DARK = 0x762c20;
const TIMBER_DARK = 0x423428;
const PINE_ROOF = 0x364834;
const COPPER_ROOF = 0x4fa682;
const COPPER_LIGHT = 0x6bc4a0;
const SLATE_SNOW = 0x485864;
const AURORA_TEAL = 0x52f0d0;
const AURORA_CYAN = 0x38b8e0;
const AURORA_PURPLE = 0xa868e8;
const ELECTRUM_GOLD = 0xffd700;

// -------------------------------------------------------------
// WONDER 6: THE NORTHERN ICE CITADEL (SNOWCAP PEAKS)
// -------------------------------------------------------------

function drawIceCitadel(g, x, y) {
  footing(g, x, y, 240, ICE_DEEP);
  // Glacial Mountain Base & Flying Buttresses
  g.fillStyle(ICE_DEEP);
  g.fillRect(x - 100, y - 60, 200, 60);
  g.fillStyle(ICE_WHITE);
  g.fillRect(x - 90, y - 56, 180, 56);
  // Flying Buttresses
  for (const bx of [-105, -70, 70, 105]) {
    g.fillStyle(ICE_DEEP);
    g.fillRect(x + bx - 4, y - 85, 8, 85);
    g.fillStyle(ICE_BLUE);
    g.fillTriangle(x + bx - 4, y - 85, x + bx + (bx < 0 ? 25 : -25), y - 130, x + bx + 4, y - 85);
  }
  // Central Great Nave
  const nW = 130;
  const nH = 160;
  g.fillStyle(ICE_BLUE);
  g.fillRect(x - nW / 2, y - nH, nW, nH);
  g.fillStyle(ICE_WHITE);
  g.fillRect(x - nW / 2 + 4, y - nH + 4, nW * 0.48, nH - 4);
  // Gothic Arched Spires (Twin Bell Spires)
  for (const sx of [-45, 45]) {
    g.fillStyle(ICE_DEEP);
    g.fillRect(x + sx - 14, y - 230, 28, 70);
    g.fillStyle(ICE_WHITE);
    g.fillTriangle(x + sx - 16, y - 230, x + sx, y - 285, x + sx + 16, y - 230);
  }
  // Soaring Central Flèche (High Spire reaching 290px)
  g.fillStyle(ICE_BLUE);
  g.fillRect(x - 10, y - 220, 20, 60);
  g.fillStyle(ICE_WHITE);
  g.fillTriangle(x - 12, y - 220, x, y - 290, x + 12, y - 220);
  // Glowing Crystalline Rose Window
  g.fillStyle(AURORA_CYAN);
  g.fillCircle(x, y - 110, 18);
  g.fillStyle(0xffffff);
  g.fillCircle(x, y - 110, 8);
  for (let a = 0; a < 8; a++) {
    const rad = a * Math.PI / 4;
    g.lineStyle(1.5, 0xffffff);
    g.lineBetween(x, y - 110, x + Math.cos(rad) * 16, y - 110 + Math.sin(rad) * 16);
  }
  // Great Ice Portal Entrance
  g.fillStyle(ICE_DEEP);
  g.fillRect(x - 16, y - 36, 32, 36);
  g.fillStyle(0x182c3c);
  g.fillRect(x - 12, y - 32, 24, 32);
  g.fillCircle(x, y - 32, 12);
}

function citadelFx(g, x, y, elapsed) {
  // Shimmering Aurora Glint around the High Spire
  const pulse = Math.sin(elapsed * 2) * 0.5 + 0.5;
  g.fillStyle(AURORA_CYAN, pulse * 0.7);
  g.fillCircle(x, y - 290, 6);
  g.fillStyle(0xffffff, pulse);
  g.fillCircle(x, y - 290, 2.5);
}

// -------------------------------------------------------------
// PINETOWN & INDUSTRIAL LANDMARKS
// -------------------------------------------------------------

function drawPinetownMill(g, x, y) {
  footing(g, x, y, 130, 0x242830);
  const left = x - 56;
  const top = y - 90;
  const mW = 112;
  const mH = 90;

  // 1. Rusticated Stone Foundation & Water Race Channel
  g.fillStyle(0x3e4650);
  g.fillRect(left - 2, y - 22, mW + 4, 22);
  g.fillStyle(0x282e36);
  g.fillRect(left + mW * 0.5, y - 22, mW * 0.5 + 2, 22); // Shadow side
  // Stone masonry joints
  g.fillStyle(0x56606c);
  for (let fy = y - 18; fy <= y - 6; fy += 6) g.fillRect(left - 2, fy, mW + 4, 1);

  // 2. Multi-Story Red Brick Mill Building (3 floors)
  g.fillStyle(BRICK_RED);
  g.fillRect(left, top, mW, mH - 22);
  g.fillStyle(BRICK_DARK);
  g.fillRect(left + mW * 0.65, top, mW * 0.35, mH - 22);
  // Brick corbel table cornice below roof
  g.fillStyle(BRICK_DARK);
  g.fillRect(left - 2, top - 4, mW + 4, 4);
  for (let cx = left; cx <= left + mW - 4; cx += 8) {
    g.fillRect(cx, top - 2, 4, 4);
  }

  // 3. Multi-Pane Industrial Sash Windows (3 floors, 4 columns)
  for (let floor = 0; floor < 3; floor++) {
    const wy = top + 10 + floor * 18;
    for (let c = 0; c < 4; c++) {
      const wx = left + 14 + c * 22;
      // Stone header lintel & sill
      g.fillStyle(0xd5dde6);
      g.fillRect(wx - 1, wy - 2, 12, 2);
      g.fillRect(wx - 1, wy + 12, 12, 2);
      // Window frame & glowing glass
      g.fillStyle(0x182028);
      g.fillRect(wx, wy, 10, 12);
      g.fillStyle(0xfff4c2, 0.85); // Warm interior glow
      g.fillRect(wx + 1, wy + 1, 8, 10);
      // Window sash mullions (6 panes)
      g.fillStyle(0x3e322a);
      g.fillRect(wx + 4.5, wy + 1, 1, 10);
      g.fillRect(wx + 1, wy + 5.5, 8, 1);
    }
  }

  // 4. Projecting Gantry Hoist & Timber Loading Doors
  g.fillStyle(TIMBER_DARK);
  g.fillRect(left + 2, y - 32, 18, 30);
  g.fillStyle(0x7a5a3a);
  g.fillRect(left + 3, y - 30, 7, 28);
  g.fillRect(left + 11, y - 30, 7, 28);
  // Projecting Timber Crane Beam atop the gable
  g.fillStyle(0x523e2c);
  g.fillRect(x - 2, top - 18, 4, 22);
  g.fillRect(x - 12, top - 18, 20, 3);
  g.fillStyle(0x222222);
  g.fillRect(x - 10, top - 15, 1, 10); // Hoist cable

  // 5. Timber Waterwheel / Machinery Turbine on the East Side
  const wwX = left + mW + 6;
  g.fillStyle(0x3a2c1e);
  g.fillCircle(wwX, y - 16, 16);
  g.fillStyle(0x5a4430);
  g.fillCircle(wwX, y - 16, 13);
  g.fillStyle(0x181a1c);
  g.fillCircle(wwX, y - 16, 4);
  // Wooden wheel paddles
  g.fillStyle(0x3a2c1e);
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4;
    g.fillRect(wwX + Math.cos(ang) * 4 - 1, y - 16 + Math.sin(ang) * 4 - 1, 2, 11);
  }
  // Churning water splash
  g.fillStyle(0xd5eef8, 0.8);
  g.fillRect(wwX - 16, y - 4, 32, 4);

  // 6. Steep Slate Gable Roof with Snow Blanket
  g.fillStyle(SLATE_SNOW);
  g.fillTriangle(left - 6, top, x, top - 32, left + mW + 6, top);
  g.fillStyle(0x36424e);
  g.fillTriangle(x, top - 32, left + mW + 6, top, x + mW * 0.4, top);
  // Thick snow blanket
  g.fillStyle(0xf0f6fa);
  g.fillTriangle(left - 6, top, x, top - 32, x, top - 26);
  g.fillRect(left - 6, top - 3, mW + 12, 4);

  // 7. Industrial Brick Smokestack with Reinforcing Steel Hoops
  const stackX = left + mW - 22;
  const stackTop = top - 85;
  const stackH = 85;
  g.fillStyle(BRICK_DARK);
  g.fillRect(stackX, stackTop, 16, stackH);
  g.fillStyle(BRICK_RED);
  g.fillRect(stackX + 2, stackTop, 8, stackH);
  // Steel reinforcing hoops & corbeled crown
  g.fillStyle(0x22262a);
  g.fillRect(stackX - 2, stackTop - 4, 20, 5);
  for (let hy = stackTop + 14; hy < top; hy += 16) {
    g.fillRect(stackX - 1, hy, 18, 2);
  }
  // Iron maintenance ladder
  g.fillStyle(0x444a50);
  for (let ly = stackTop + 6; ly < top; ly += 6) {
    g.fillRect(stackX + 13, ly, 3, 1);
  }
}

function millFx(g, x, y, elapsed) {
  // Billowing Coal Smoke Puffs from the Smokestack
  const sx = x + 42;
  const sy = y - 175;
  for (let i = 0; i < 4; i++) {
    const age = ((elapsed * 1.5 + i * 0.8) % 3.0);
    const alpha = Math.max(0, 0.65 * (1 - age / 3.0));
    g.fillStyle(0x3e4248, alpha);
    g.fillCircle(sx + age * 12, sy - age * 26, 4 + age * 5);
  }
}

function drawPinetownClocktower(g, x, y) {
  footing(g, x, y, 54, 0x22262c);
  // 1. Rusticated Ashlar Stone Base Plinth (y to y - 26)
  g.fillStyle(0x424a52);
  g.fillRect(x - 17, y - 26, 34, 26);
  g.fillStyle(0x2e353c);
  g.fillRect(x + 4, y - 26, 13, 26); // Shadow side
  g.fillStyle(0x56606c);
  for (let by = y - 22; by <= y - 6; by += 8) g.fillRect(x - 17, by, 34, 1.5);
  // Arched ground entrance door with stone surround
  g.fillStyle(0x181e24);
  g.fillRect(x - 6, y - 20, 12, 20);
  g.fillCircle(x, y - 20, 6);
  g.fillStyle(0x6e4a2c);
  g.fillRect(x - 4, y - 18, 8, 18);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x + 2, y - 10, 1.5, 2.5); // Brass handle

  // 2. Main Red Brick Masonry Shaft with Stone Quoins (y - 26 to y - 110)
  const shaftH = 84;
  const sTop = y - 110;
  g.fillStyle(BRICK_RED);
  g.fillRect(x - 14, sTop, 28, shaftH);
  g.fillStyle(BRICK_DARK);
  g.fillRect(x + 2, sTop, 12, shaftH); // Shadow side

  // Corner Stone Quoins (alternating light stone corner blocks)
  g.fillStyle(0xd5dde6);
  for (let qy = sTop + 4; qy < y - 28; qy += 10) {
    g.fillRect(x - 14, qy, 4, 4);
    g.fillRect(x + 10, qy, 4, 4);
  }
  // Slender Lancet Arch Windows in the shaft
  g.fillStyle(0x182028);
  g.fillRect(x - 4, y - 56, 8, 14);
  g.fillCircle(x, y - 56, 4);
  g.fillStyle(0xfff5cc, 0.85);
  g.fillRect(x - 3, y - 54, 6, 11);

  // 3. Molded Stone String Course & Belfry Stage (y - 110 to y - 138)
  g.fillStyle(0xd5dde6);
  g.fillRect(x - 17, sTop - 4, 34, 5); // Projecting stone cornice
  g.fillStyle(0x8a96a4);
  g.fillRect(x - 17, sTop - 1, 34, 2);

  // Belfry with arched timber louvers
  g.fillStyle(BRICK_RED);
  g.fillRect(x - 15, y - 138, 30, 24);
  g.fillStyle(BRICK_DARK);
  g.fillRect(x + 2, y - 138, 13, 24);
  // Arched Belfry Openings with Louvers
  for (const bx of [x - 7, x + 7]) {
    g.fillStyle(0x181e26);
    g.fillRect(bx - 4, y - 134, 8, 16);
    g.fillCircle(bx, y - 134, 4);
    // Bronze bell visible in shadow
    g.fillStyle(0xa87834);
    g.fillCircle(bx, y - 128, 3);
    // Louver slats
    g.fillStyle(TIMBER_DARK);
    for (let ly = y - 132; ly <= y - 120; ly += 3) g.fillRect(bx - 3, ly, 6, 1);
  }

  // 4. Ornate Clock Face Stage (y - 138 to y - 162)
  g.fillStyle(0xd5dde6);
  g.fillRect(x - 18, y - 142, 36, 5); // Cornice below clock
  g.fillStyle(0x28303a);
  g.fillRect(x - 16, y - 162, 32, 20);

  // Molded Clock Bezel & Face
  g.fillStyle(0x9aa6b4);
  g.fillCircle(x, y - 152, 11);
  g.fillStyle(0xffffff); // Crisp porcelain enamel dial
  g.fillCircle(x, y - 152, 9);
  // Roman numeral hour markers (12 tick marks around circumference)
  g.fillStyle(0x181a1c);
  for (let a = 0; a < 12; a++) {
    const ang = a * Math.PI / 6;
    const tx = x + Math.sin(ang) * 7.5;
    const ty = y - 152 - Math.cos(ang) * 7.5;
    g.fillRect(tx - 0.5, ty - 0.5, 1, 1);
  }
  // Filigree hour and minute hands
  g.lineStyle(1.5, 0x181a1c);
  g.lineBetween(x, y - 152, x - 3.5, y - 156.5); // Hour hand
  g.lineStyle(1, 0x181a1c);
  g.lineBetween(x, y - 152, x + 4, y - 157.5); // Minute hand
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, y - 152, 1.5); // Center arbor brass boss

  // 5. Flared Copper Spire with Snow Rims & Weather Vane (y - 162 to y - 215)
  // Gilded cornice
  g.fillStyle(COPPER_LIGHT);
  g.fillRect(x - 18, y - 165, 36, 3);
  g.fillStyle(COPPER_ROOF);
  g.fillTriangle(x - 18, y - 165, x, y - 215, x + 18, y - 165);
  g.fillStyle(COPPER_LIGHT);
  g.fillTriangle(x - 18, y - 165, x, y - 215, x - 4, y - 165); // Highlight ridge
  // Fresh snow ridges along spire edges
  g.fillStyle(0xf4faff);
  g.lineStyle(1.5, 0xffffff);
  g.lineBetween(x - 18, y - 165, x, y - 215);
  g.fillRect(x - 18, y - 166, 36, 2);

  // Gilded Weather Vane / Compass Directionals
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 0.75, y - 227, 1.5, 12); // Spire rod
  g.fillRect(x - 6, y - 224, 12, 1.5); // E-W arm
  g.fillTriangle(x + 4, y - 227, x + 8, y - 224, x + 4, y - 221); // Arrow point
  g.fillCircle(x, y - 228, 2); // Top sphere
}

// -------------------------------------------------------------
// ARCTIC RESEARCH STATION (ICE LAKE)
// -------------------------------------------------------------

function drawResearchStation(g, x, y) {
  footing(g, x, y, 130, ICE_DEEP);
  // Geodesic Research Dome
  g.fillStyle(0xeeeeee);
  g.fillCircle(x - 28, y - 28, 28);
  g.fillStyle(0xbbbbbb);
  for (let ay = y - 52; ay <= y - 6; ay += 8) g.fillRect(x - 50, ay, 44, 1.5);
  // Observation Skylight
  g.fillStyle(ICE_BLUE);
  g.fillCircle(x - 28, y - 46, 6);
  // Lab Annex - International Safety Orange
  g.fillStyle(0xdd6622);
  g.fillRect(x + 2, y - 26, 52, 26);
  g.fillStyle(0x222222);
  g.fillRect(x + 10, y - 18, 10, 8);
  g.fillRect(x + 26, y - 18, 10, 8);
  // Double-airlock entrance door
  g.fillStyle(0x18181c);
  g.fillRect(x + 40, y - 20, 10, 20);
  g.fillStyle(0xddaa33);
  g.fillRect(x + 42, y - 18, 6, 8);
  // Weather Radar & Satellite Mast
  g.fillStyle(0x555555);
  g.fillRect(x + 36, y - 65, 3, 39);
  g.fillStyle(0xffffff);
  g.fillCircle(x + 37, y - 68, 7);
  g.fillStyle(0x333333);
  g.fillCircle(x + 37, y - 68, 3);
}

// -------------------------------------------------------------
// SNOW CITY (POLAR METROPOLIS)
// -------------------------------------------------------------

// Snow City's landmarks keep their own palettes so they stand out from the slate street (city design
// rules, layer 4): Aurora Spire in warm granite, copper and gold; Borealis Tower in bronze glass;
// Polaris Nexus in red brick and slate; the Geothermal plant in brick and concrete. Each carries snow.
const LANDMARK_WARM = 0xf2d28a;
const LANDMARK_GOLD = 0xd9b56a;
const LANDMARK_RECESS = 0x4a4238;

// Lit panes in a landmark's window columns, worked out once per grid and cached.
const LANDMARK_LIT = new Map();
function litPanes(key, cols, rows, chance) {
  if (!LANDMARK_LIT.has(key)) {
    const lit = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (hash(key.length * 3.1 + c * 0.29 + r * 0.071 + cols) > chance) lit.push(c, r);
    LANDMARK_LIT.set(key, lit);
  }
  return LANDMARK_LIT.get(key);
}

// Recessed window columns crossed by stone spandrels, with warm panes lit here and there.
function windowColumns(g, left, top, cols, stepX, paneW, rows, stepY, spandrel, key) {
  const height = rows * stepY;
  g.fillStyle(LANDMARK_RECESS);
  for (let c = 0; c < cols; c++) g.fillRect(left + c * stepX, top, paneW, height);
  g.fillStyle(spandrel);
  for (let r = 1; r < rows; r++) g.fillRect(left - 1, top + r * stepY - 3, (cols - 1) * stepX + paneW + 2, 3);
  const lit = litPanes(key, cols, rows, 0.72);
  g.fillStyle(LANDMARK_WARM);
  for (let i = 0; i < lit.length; i += 2) g.fillRect(left + lit[i] * stepX, top + lit[i + 1] * stepY, paneW, stepY - 3);
}

// Aurora Spire: Snow City's signature tower and the tallest thing in the city. Three setback tiers of
// warm granite with recessed window columns and gold bands, snow on every setback, a copper crown and
// a gilded needle. The aurora itself ripples above it (auroraFx).
function drawAuroraSpire(g, x, y) {
  const STONE = 0xbfae96;
  const SHADE = 0xa08f78;
  const PIER = 0xd4c6b0;
  const COPPER = 0x4f8f78;
  const COPPER_LIGHT = 0x76b59c;
  footing(g, x, y, 110, 0x8a7c68);
  const tiers = [[42, 0, 200], [32, 200, 370], [22, 370, 460]];
  for (const [half, from, to] of tiers) {
    g.fillStyle(STONE);
    g.fillRect(x - half, y - to, half * 2, to - from);
    g.fillStyle(SHADE);
    g.fillRect(x + half - 6, y - to, 6, to - from);
    const cols = Math.floor((half * 2 - 12) / 10) + 1;
    const bottom = from === 0 ? 40 : from + 8;
    windowColumns(g, x - half + 6, y - to + 10, cols, 10, 5, Math.floor((to - 10 - bottom) / 12), 12, STONE, `aurora-${half}`);
    g.fillStyle(PIER);
    g.fillRect(x - half, y - to, 2, to - from);
    g.fillStyle(LANDMARK_GOLD);
    g.fillRect(x - half - 1, y - to - 2, half * 2 + 2, 2);
    snowCap(g, x - half, y - to - 2, half * 2, half);
  }
  // Copper crown: a stepped drum, then a ribbed pyramid with a gilded star emblem.
  g.fillStyle(COPPER);
  g.fillRect(x - 18, y - 482, 36, 20);
  g.fillTriangle(x - 18, y - 482, x, y - 532, x + 18, y - 482);
  g.fillStyle(COPPER_LIGHT);
  g.fillRect(x - 18, y - 482, 12, 20);
  g.fillTriangle(x - 18, y - 482, x, y - 532, x - 4, y - 482);
  g.fillStyle(LANDMARK_GOLD);
  for (const rx of [-12, -4, 4, 12]) g.fillRect(x + rx, y - 480, 1, 16);
  g.fillCircle(x, y - 472, 4);
  g.fillStyle(0xfff4c8);
  g.fillCircle(x, y - 472, 1.5);
  g.fillStyle(SNOW);
  g.fillRect(x - 19, y - 484, 38, 2);
  // Gilded needle and ball.
  g.fillStyle(LANDMARK_GOLD);
  g.fillRect(x - 1, y - 548, 2, 18);
  g.fillCircle(x, y - 549, 2);
  // Entrance: stone steps, an arched portal with bronze doors and a warm fanlight.
  g.fillStyle(PIER);
  g.fillRect(x - 24, y - 4, 48, 4);
  g.fillStyle(LANDMARK_RECESS);
  g.fillRect(x - 12, y - 30, 24, 26);
  g.fillCircle(x, y - 30, 12);
  g.fillStyle(LANDMARK_WARM, 0.9);
  g.fillCircle(x, y - 30, 9);
  g.fillStyle(0x8a5a2c);
  g.fillRect(x - 9, y - 28, 8, 24);
  g.fillRect(x + 1, y - 28, 8, 24);
  g.fillStyle(LANDMARK_GOLD);
  g.fillRect(x - 2, y - 18, 1, 3);
  g.fillRect(x + 1, y - 18, 1, 3);
  g.fillRect(x - 14, y - 44, 28, 2);
  // Lanterns either side of the portal.
  for (const side of [-1, 1]) {
    g.fillStyle(0x3a332c);
    g.fillRect(x + side * 20 - 1, y - 26, 2, 22);
    g.fillStyle(LANDMARK_WARM);
    g.fillRect(x + side * 20 - 2, y - 30, 4, 4);
  }
}

// The northern lights rippling over the needle, and a beacon on its tip.
function auroraFx(g, x, y, elapsed) {
  const colors = [0x52f0b0, 0x52f0d0, 0x7ad8f0, 0xa868e8];
  for (let i = 0; i < 14; i++) {
    const wave = Math.sin(elapsed * 1.4 + i * 0.7);
    g.fillStyle(colors[i % colors.length], 0.5 + 0.2 * wave);
    g.fillRect(x - 42 + i * 6, y - 596 + wave * 6 + Math.abs(i - 6.5) * 2, 6, 30 + Math.sin(elapsed * 0.9 + i) * 8);
  }
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 2.5) > 0));
  g.fillCircle(x, y - 552, 2.5);
}

// Borealis Tower: a bronze-glass shaft with bronze fins, a ring of lit observation windows near the top
// and a roof that slants up to the east like a sail, snow along its edge, an aerial on the peak.
function drawBorealisTower(g, x, y) {
  const GLASS_BODY = 0x6b5a48;
  const SHADE = 0x58493a;
  const FIN = 0xb08850;
  const DARK = 0x3a3028;
  const AMBER = 0xe0b066;
  footing(g, x, y, 96, 0x4a3e32);
  const half = 35;
  g.fillStyle(GLASS_BODY);
  g.fillRect(x - half, y - 380, half * 2, 356);
  g.fillTriangle(x - half, y - 380, x + half, y - 380, x + half, y - 436);
  g.fillStyle(SHADE);
  g.fillRect(x + half - 7, y - 380, 7, 356);
  // Floor lines and lit panes.
  g.fillStyle(DARK);
  for (let fy = y - 370; fy < y - 30; fy += 10) g.fillRect(x - half, fy, half * 2, 2);
  const lit = litPanes('borealis', 9, 34, 0.8);
  g.fillStyle(AMBER);
  for (let i = 0; i < lit.length; i += 2) g.fillRect(x - half + 3 + lit[i] * 7, y - 368 + lit[i + 1] * 10, 5, 6);
  // Bronze fins up the face and across the sail.
  g.fillStyle(FIN);
  for (let fx = x - half; fx <= x + half - 2; fx += 14) {
    const rise = Math.round((fx - (x - half)) * 56 / (half * 2));
    g.fillRect(fx, y - 380 - rise, 2, 356 + rise);
  }
  g.lineStyle(2, SNOW);
  g.lineBetween(x - half, y - 381, x + half, y - 437);
  // Observation ring: a wider band of lit windows with snow on top and icicles beneath.
  g.fillStyle(DARK);
  g.fillRect(x - 42, y - 350, 84, 16);
  g.fillStyle(AMBER, 0.85);
  g.fillRect(x - 39, y - 346, 78, 7);
  g.fillStyle(DARK);
  for (let wx = x - 33; wx < x + 39; wx += 8) g.fillRect(wx, y - 346, 1, 7);
  snowCap(g, x - 42, y - 350, 84, 5);
  icicles(g, x - 42, y - 334, 84, 9);
  // Aerial on the peak.
  g.fillStyle(0xb9c2c7);
  g.fillRect(x + half - 3, y - 462, 2, 26);
  // Lobby: a stone base with warm glass doors under a snowy canopy.
  g.fillStyle(0xc8bca8);
  g.fillRect(x - half - 2, y - 26, half * 2 + 4, 26);
  g.fillStyle(AMBER, 0.75);
  g.fillRect(x - 28, y - 20, 56, 12);
  g.fillStyle(DARK);
  g.fillRect(x - 9, y - 22, 18, 22);
  g.fillStyle(FROST_GLASS);
  g.fillRect(x - 8, y - 21, 7, 20);
  g.fillRect(x + 1, y - 21, 7, 20);
  g.fillStyle(FIN);
  g.fillRect(x - 16, y - 28, 32, 3);
  g.fillStyle(SNOW);
  g.fillRect(x - 16, y - 30, 32, 2);
}

// A tapering slab between two half-widths, for the cooling towers' curves.
function taper(g, cx, top, bottom, topHalf, bottomHalf) {
  const inner = Math.min(topHalf, bottomHalf);
  g.fillRect(cx - inner, top, inner * 2, bottom - top);
  if (bottomHalf > topHalf) {
    g.fillTriangle(cx - inner, top, cx - bottomHalf, bottom, cx - inner, bottom);
    g.fillTriangle(cx + inner, top, cx + bottomHalf, bottom, cx + inner, bottom);
  } else if (topHalf > bottomHalf) {
    g.fillTriangle(cx - inner, top, cx - topHalf, top, cx - inner, bottom);
    g.fillTriangle(cx + inner, top, cx + topHalf, top, cx + inner, bottom);
  }
}

// Geothermal plant: a brick turbine hall with tall warm windows and a snowy roof, between two curved
// concrete cooling towers banded in orange, with steam pipes running out to them (steam: plantFx).
function drawGeothermalPlant(g, x, y) {
  const BRICK = 0x9a4c3a;
  const BRICK_SHADE = 0x7d3c2e;
  const CONCRETE = 0xbab4aa;
  const CONCRETE_SHADE = 0x9e988e;
  const PIPE = 0xc8783c;
  footing(g, x, y, 130, 0x5a4c44);
  for (const cx of [x - 46, x + 46]) {
    g.fillStyle(CONCRETE);
    taper(g, cx, y - 80, y, 9, 18);
    taper(g, cx, y - 112, y - 80, 13, 9);
    g.fillStyle(CONCRETE_SHADE);
    taper(g, cx + 4, y - 80, y, 4, 8);
    taper(g, cx + 4, y - 112, y - 80, 6, 4);
    // Ring beams down the shell, the orange band near the lip, and the support legs at the foot.
    g.fillStyle(0xa8a298);
    for (const [ry, half] of [[y - 30, 13], [y - 55, 10], [y - 95, 10]]) g.fillRect(cx - half, ry, half * 2, 1);
    g.fillStyle(0x6e6a64);
    for (let lx = cx - 16; lx <= cx + 14; lx += 5) g.fillRect(lx, y - 5, 2, 5);
    g.fillStyle(PIPE);
    g.fillRect(cx - 12, y - 106, 24, 4);
    g.fillStyle(SNOW);
    g.fillRect(cx - 14, y - 114, 28, 2);
  }
  // Steam pipes from the hall to each tower.
  g.fillStyle(PIPE);
  g.fillRect(x - 46, y - 34, 92, 4);
  for (const px of [x - 40, x + 38]) g.fillRect(px, y - 34, 2, 34);
  g.fillStyle(SNOW);
  g.fillRect(x - 46, y - 35, 92, 1);
  // Turbine hall with a pitched metal roof.
  g.fillStyle(BRICK);
  g.fillRect(x - 34, y - 50, 68, 50);
  g.fillStyle(BRICK_SHADE);
  g.fillRect(x + 28, y - 50, 6, 50);
  g.fillStyle(0x4a5058);
  g.fillTriangle(x - 37, y - 50, x, y - 66, x + 37, y - 50);
  g.fillStyle(SNOW);
  g.fillTriangle(x - 37, y - 50, x, y - 66, x, y - 58);
  g.fillStyle(SNOW_SHADE);
  g.fillTriangle(x, y - 66, x + 37, y - 50, x, y - 58);
  icicles(g, x - 34, y - 49, 68, 3);
  // Tall arched windows, lit warm.
  for (const wx of [x - 24, x - 14, x + 14, x + 24]) {
    g.fillStyle(LANDMARK_RECESS);
    g.fillRect(wx - 3, y - 40, 6, 24);
    g.fillCircle(wx, y - 40, 3);
    g.fillStyle(LANDMARK_WARM, 0.85);
    g.fillRect(wx - 2, y - 39, 4, 22);
  }
  // Centred door with a lamp, and a hazard-striped sign above it.
  g.fillStyle(0x3a3a3e);
  g.fillRect(x - 7, y - 22, 14, 22);
  g.fillStyle(0x55585e);
  g.fillRect(x - 6, y - 21, 5, 21);
  g.fillRect(x + 1, y - 21, 5, 21);
  g.fillStyle(LANDMARK_WARM);
  g.fillRect(x - 1, y - 26, 2, 2);
  g.fillStyle(0xe8b04a);
  g.fillRect(x - 10, y - 32, 20, 4);
  g.fillStyle(0x2e2e30);
  for (let sx = x - 9; sx < x + 10; sx += 4) g.fillRect(sx, y - 32, 2, 4);
}

function plantFx(g, x, y, elapsed) {
  // Steam billowing from both cooling towers.
  for (const cx of [x - 46, x + 46]) {
    for (let i = 0; i < 4; i++) {
      const age = (elapsed * 1.5 + i * 0.7) % 2.8;
      const alpha = Math.max(0, 0.7 * (1 - age / 2.8));
      g.fillStyle(0xeef6f8, alpha);
      g.fillCircle(cx + Math.sin(elapsed * 1.6 + i) * 6 + age * 4, y - 118 - age * 22, 7 + age * 5);
    }
  }
}

// -------------------------------------------------------------
// WONDER 3: THE COLOSSUS OF THE HARBOR (WHALE HARBOR)
// -------------------------------------------------------------

// The Harbor Guardian (Wonder 3): a burnished-bronze fisherman in an oilskin coat and sou'wester,
// lantern raised over the harbour and his other hand on an anchor, on a granite pedestal carved with
// waves and a bronze plaque, flanked by lamps. Snow on the hat, shoulders and steps.
function drawHarborColossus(g, x, y) {
  const GRANITE = 0x8a8e94;
  const GRANITE_SHADE = 0x6e7278;
  const GRANITE_LIGHT = 0xa4a8ae;
  const BRONZE = 0x7a5634;
  const BRONZE_SHADE = 0x5e4026;
  const BRONZE_HI = 0xc89a5a;
  const PATINA = 0x5f9a86;
  footing(g, x, y, 180, 0x5a5652);

  // Pedestal: two steps, a die carved with waves, a cornice.
  g.fillStyle(GRANITE_SHADE);
  g.fillRect(x - 85, y - 8, 170, 8);
  g.fillStyle(GRANITE);
  g.fillRect(x - 75, y - 16, 150, 8);
  g.fillRect(x - 48, y - 80, 96, 64);
  g.fillStyle(GRANITE_SHADE);
  g.fillRect(x + 40, y - 80, 8, 64);
  g.fillStyle(GRANITE_LIGHT);
  g.fillRect(x - 55, y - 90, 110, 10);
  g.fillRect(x - 48, y - 80, 3, 64);
  // Carved wave band.
  g.fillStyle(GRANITE_LIGHT);
  for (let wx = x - 42; wx < x + 40; wx += 10) {
    g.fillCircle(wx + 5, y - 30, 4);
  }
  g.fillStyle(GRANITE);
  for (let wx = x - 42; wx < x + 40; wx += 10) g.fillCircle(wx + 7, y - 28, 3);
  // Bronze plaque with lines of text.
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x - 18, y - 70, 36, 22);
  g.fillStyle(BRONZE_HI);
  g.fillRect(x - 16, y - 68, 32, 18);
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x - 12, y - 64, 24, 2);
  g.fillRect(x - 10, y - 59, 20, 1);
  g.fillRect(x - 10, y - 55, 20, 1);
  // Snow on steps and cornice.
  g.fillStyle(SNOW);
  g.fillRect(x - 85, y - 9, 170, 1.5);
  g.fillRect(x - 75, y - 17, 150, 1.5);
  g.fillRect(x - 56, y - 92, 112, 2);
  icicles(g, x - 55, y - 80, 110, 7);

  // Lamps either side of the pedestal.
  for (const side of [-1, 1]) {
    const lx = x + side * 72;
    g.fillStyle(0x2e3034);
    g.fillRect(lx - 1, y - 48, 2, 32);
    g.fillRect(lx - 3, y - 18, 6, 2);
    g.fillStyle(LAMP);
    g.fillRect(lx - 3, y - 54, 6, 6);
    g.fillStyle(0x2e3034);
    g.fillRect(lx - 4, y - 56, 8, 2);
    g.fillStyle(SNOW);
    g.fillRect(lx - 4, y - 57, 8, 1);
  }

  const feet = y - 90;
  // Anchor at his left side (viewer's right), standing on the pedestal.
  g.fillStyle(0x3a3a3e);
  g.fillRect(x + 39, feet - 88, 4, 88);
  g.fillRect(x + 31, feet - 84, 20, 3);
  g.lineStyle(3, 0x3a3a3e);
  g.fillRect(x + 38, feet - 94, 6, 4);
  g.lineBetween(x + 41, feet - 2, x + 28, feet - 12);
  g.lineBetween(x + 41, feet - 2, x + 54, feet - 12);
  g.fillStyle(0x3a3a3e);
  g.fillTriangle(x + 25, feet - 16, x + 31, feet - 10, x + 24, feet - 8);
  g.fillTriangle(x + 57, feet - 16, x + 51, feet - 10, x + 58, feet - 8);

  // Boots.
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x - 15, feet - 22, 12, 22);
  g.fillRect(x + 3, feet - 22, 12, 22);
  g.fillRect(x - 17, feet - 4, 15, 4);
  g.fillRect(x + 2, feet - 4, 15, 4);
  // Oilskin coat: shoulders to a flared hem.
  const shoulder = feet - 150;
  const hem = feet - 22;
  g.fillStyle(BRONZE);
  g.fillRect(x - 22, shoulder, 44, hem - shoulder);
  g.fillTriangle(x - 22, shoulder + 40, x - 28, hem, x - 22, hem);
  g.fillTriangle(x + 22, shoulder + 40, x + 28, hem, x + 22, hem);
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x + 8, shoulder, 14, hem - shoulder);
  g.fillTriangle(x + 22, shoulder + 40, x + 28, hem, x + 22, hem);
  // Coat front: opening, buttons, belt, pockets, collar.
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x - 1, shoulder + 8, 2, hem - shoulder - 8);
  g.fillRect(x - 22, feet - 92, 50, 4);
  g.fillRect(x - 18, feet - 66, 10, 2);
  g.fillRect(x + 8, feet - 66, 10, 2);
  g.fillStyle(BRONZE_HI);
  for (let by = shoulder + 14; by < hem - 6; by += 14) g.fillCircle(x - 4, by, 1.2);
  g.fillRect(x - 3, feet - 92, 6, 4);
  g.fillRect(x - 22, shoulder, 2, hem - shoulder);
  g.fillStyle(BRONZE);
  g.fillTriangle(x - 14, shoulder - 2, x, shoulder + 12, x - 2, shoulder - 2);
  g.fillTriangle(x + 14, shoulder - 2, x, shoulder + 12, x + 2, shoulder - 2);
  // Verdigris streaks where rain runs down.
  g.fillStyle(PATINA, 0.7);
  g.fillRect(x - 16, shoulder + 30, 2, 40);
  g.fillRect(x + 12, shoulder + 50, 2, 34);
  g.fillRect(x - 8, hem - 30, 2, 26);

  // Left arm down to the anchor's stock.
  g.lineStyle(11, BRONZE_SHADE);
  g.lineBetween(x + 20, shoulder + 6, x + 30, shoulder + 50);
  g.lineBetween(x + 30, shoulder + 50, x + 38, shoulder + 74);
  g.fillStyle(BRONZE_SHADE);
  g.fillCircle(x + 39, shoulder + 78, 5);
  // Right arm raised, holding the lantern high.
  g.lineStyle(11, BRONZE);
  g.lineBetween(x - 20, shoulder + 6, x - 34, shoulder - 26);
  g.lineBetween(x - 34, shoulder - 26, x - 38, shoulder - 58);
  g.lineStyle(2, BRONZE_HI);
  g.lineBetween(x - 25, shoulder + 2, x - 38, shoulder - 28);
  g.fillStyle(BRONZE);
  g.fillCircle(x - 38, shoulder - 62, 5);
  // Lantern: a bronze frame round warm glass, a handle up to the fist.
  const lanternTop = shoulder - 84;
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x - 45, lanternTop, 14, 4);
  g.fillRect(x - 44, lanternTop + 18, 12, 3);
  g.fillTriangle(x - 45, lanternTop, x - 38, lanternTop - 6, x - 31, lanternTop);
  g.fillStyle(LAMP);
  g.fillRect(x - 43, lanternTop + 4, 10, 14);
  g.fillStyle(0xfff4c8);
  g.fillRect(x - 40, lanternTop + 7, 4, 8);
  g.fillStyle(BRONZE_SHADE);
  g.fillRect(x - 39, lanternTop + 4, 2, 14);
  g.fillRect(x - 39, lanternTop - 10, 2, 5);
  g.fillRect(x - 39, lanternTop + 21, 2, 4);

  // Head: neck, face with a full beard, sou'wester hat with a back flap.
  const head = shoulder - 16;
  g.fillStyle(BRONZE);
  g.fillRect(x - 5, shoulder - 6, 10, 8);
  g.fillCircle(x, head, 12);
  g.fillStyle(BRONZE_SHADE);
  g.fillCircle(x + 1, head + 6, 9);
  g.fillRect(x - 8, head + 2, 17, 6);
  g.fillStyle(BRONZE_HI);
  g.fillRect(x - 6, head - 2, 3, 2);
  g.fillRect(x + 3, head - 2, 3, 2);
  g.fillStyle(BRONZE);
  g.fillRect(x - 3, head + 5, 6, 1.5);
  // Hat: crown, a brim wider at the back, the flap over the neck.
  g.fillStyle(BRONZE_SHADE);
  g.fillCircle(x, head - 9, 11);
  g.fillRect(x - 18, head - 8, 36, 4);
  g.fillTriangle(x + 10, head - 6, x + 22, head - 6, x + 14, head + 8);
  g.fillStyle(SNOW);
  g.fillRect(x - 18, head - 9, 36, 1.5);
  g.fillCircle(x - 3, head - 17, 4);
  g.fillRect(x - 24, shoulder - 2, 12, 2);
  g.fillRect(x + 12, shoulder - 2, 12, 2);
}

// The lantern's flame flickers and throws a soft glow over the harbour.
function colossusFx(g, x, y, elapsed) {
  const lx = x - 38;
  const ly = y - 90 - 150 - 84 + 11;
  const flicker = 0.75 + 0.25 * Math.sin(elapsed * 9) * Math.sin(elapsed * 5.3);
  g.fillStyle(LAMP, 0.18 * flicker);
  g.fillCircle(lx, ly, 26);
  g.fillStyle(LAMP, 0.3 * flicker);
  g.fillCircle(lx, ly, 14);
  g.fillStyle(0xfff4c8, flicker);
  g.fillRect(lx - 2, ly - 3 - Math.sin(elapsed * 12) * 1.5, 4, 6);
}

// -------------------------------------------------------------
// WONDER 7: EMBER CITADEL (MOUNT EMBER MILITARY BASE)
// -------------------------------------------------------------
// A mountain fortress dug into the crater rim: a concrete glacis with a blast door, an armoured
// middle tier with twin side cannons, a command tower with lit screens, and a gun ring on the roof
// where the base's heaviest live gun sits (EMBER_GUN_MOUNTS; enemy-response.js mans it).
const MIL_OLIVE = 0x5a6346;
const MIL_OLIVE_DARK = 0x464e36;
const MIL_CONCRETE = 0x8c8a80;
const MIL_CONCRETE_SHADE = 0x6e6c64;
const MIL_CONCRETE_LIGHT = 0xa6a49a;
const MIL_STEEL = 0x3a3d40;
const MIL_HAZARD = 0xe8b04a;
const MIL_TINT = 0x2e3a40;
const MIL_RED = 0xd9443a;
const MIL_SCREEN = 0x58d888;
// Art px from the base to the citadel's roof deck, where its live gun is mounted.
const CITADEL_ROOF = 212;

function hazardStripes(g, x, y, width, height) {
  g.fillStyle(MIL_HAZARD);
  g.fillRect(x, y, width, height);
  g.fillStyle(0x2a2a2c);
  for (let sx = x; sx < x + width; sx += 6) g.fillTriangle(sx, y + height, sx + 3, y + height, sx + 6, y);
}

function drawVolcanoForge(g, x, y) {
  footing(g, x, y, 260, 0x3a3a3e, 70);
  // Rock of the crater rim the fortress is dug into, with snow lying on it.
  g.fillStyle(0x4a4a4e);
  g.fillTriangle(x - 132, y, x - 96, y - 70, x - 80, y);
  g.fillTriangle(x + 132, y, x + 96, y - 70, x + 80, y);
  g.fillStyle(SNOW);
  g.fillTriangle(x - 112, y - 40, x - 96, y - 70, x - 92, y - 46);
  g.fillTriangle(x + 112, y - 40, x + 96, y - 70, x + 100, y - 46);

  // Tier 1: sloped concrete glacis.
  g.fillStyle(MIL_CONCRETE);
  g.fillRect(x - 105, y - 80, 210, 80);
  g.fillTriangle(x - 120, y, x - 105, y - 80, x - 105, y);
  g.fillTriangle(x + 120, y, x + 105, y - 80, x + 105, y);
  g.fillStyle(MIL_CONCRETE_SHADE);
  g.fillRect(x + 40, y - 80, 65, 80);
  g.fillTriangle(x + 120, y, x + 105, y - 80, x + 105, y);
  g.fillStyle(MIL_CONCRETE_LIGHT);
  for (let sy = y - 64; sy < y; sy += 16) g.fillRect(x - 105, sy, 210, 1);
  // Firing slits.
  g.fillStyle(0x1c1e20);
  for (let sx = x - 96; sx < x + 92; sx += 22) if (Math.abs(sx + 5 - x) > 34) g.fillRect(sx, y - 58, 10, 3);
  // Blast door: steel frame, olive leaves, hazard band and warning lights.
  g.fillStyle(MIL_STEEL);
  g.fillRect(x - 28, y - 64, 56, 64);
  g.fillStyle(MIL_OLIVE_DARK);
  g.fillRect(x - 24, y - 60, 23, 60);
  g.fillRect(x + 1, y - 60, 23, 60);
  g.fillStyle(MIL_OLIVE);
  for (let ry = y - 54; ry < y - 10; ry += 12) {
    g.fillRect(x - 22, ry, 19, 2);
    g.fillRect(x + 3, ry, 19, 2);
  }
  hazardStripes(g, x - 24, y - 10, 48, 6);
  // Personnel door set into the blast door, person-height.
  g.fillStyle(0x2a2c2e);
  g.fillRect(x - 5, y - 18, 10, 18);
  g.fillStyle(MIL_HAZARD);
  g.fillRect(x - 5, y - 19, 10, 1);
  for (const side of [-1, 1]) {
    g.fillStyle(MIL_RED);
    g.fillCircle(x + side * 33, y - 58, 2.5);
  }
  snowCap(g, x - 105, y - 80, 210, 21);

  // Tier 2: armoured plating, a window band, camouflage, and twin side cannons.
  g.fillStyle(MIL_OLIVE);
  g.fillRect(x - 85, y - 150, 170, 70);
  g.fillStyle(MIL_OLIVE_DARK);
  g.fillRect(x + 35, y - 150, 50, 70);
  for (const [cx, cy, w, h] of [[-72, 140, 22, 10], [-30, 100, 26, 8], [14, 144, 18, 12], [50, 104, 22, 9]]) {
    g.fillRect(x + cx, y - cy, w, h);
  }
  g.fillStyle(0x7a8462);
  for (let ry = y - 146; ry < y - 84; ry += 10) for (let rx = x - 82; rx < x + 82; rx += 12) g.fillRect(rx, ry, 1, 1);
  g.fillStyle(MIL_TINT);
  g.fillRect(x - 70, y - 130, 140, 12);
  g.fillStyle(MIL_SCREEN, 0.75);
  for (const sx of [-60, -34, 12, 44]) g.fillRect(x + sx, y - 127, 8, 5);
  g.fillStyle(LAMP, 0.6);
  for (const sx of [-48, -2, 28]) g.fillRect(x + sx, y - 127, 8, 5);
  g.fillStyle(MIL_STEEL);
  for (let mx = x - 70; mx <= x + 70; mx += 14) g.fillRect(mx, y - 130, 1, 12);
  for (const side of [-1, 1]) {
    // Sponson and twin barrels pointing out over the slopes.
    g.fillStyle(MIL_STEEL);
    g.fillRect(x + side * 85 - (side > 0 ? 0 : 18), y - 120, 18, 16);
    // The twin barrels are live turrets drawn by enemy-response at EMBER_GUN_MOUNTS.
  }
  snowCap(g, x - 85, y - 150, 170, 22);

  // Tier 3: command tower with a panoramic window band of screens.
  g.fillStyle(MIL_CONCRETE);
  g.fillRect(x - 45, y - CITADEL_ROOF, 90, CITADEL_ROOF - 150);
  g.fillStyle(MIL_CONCRETE_SHADE);
  g.fillRect(x + 20, y - CITADEL_ROOF, 25, CITADEL_ROOF - 150);
  g.fillStyle(MIL_TINT);
  g.fillRect(x - 40, y - 196, 80, 14);
  g.fillStyle(MIL_SCREEN, 0.8);
  for (const sx of [-34, -14, 6, 26]) g.fillRect(x + sx, y - 193, 8, 6);
  g.fillStyle(MIL_STEEL);
  g.fillRect(x - 47, y - CITADEL_ROOF - 3, 94, 3);
  hazardStripes(g, x - 45, y - 160, 90, 3);
  snowCap(g, x - 47, y - CITADEL_ROOF - 3, 94, 23);

  // Roof: gun ring (the live gun sits on it), radar on a mast, antennas and a flag.
  g.fillStyle(MIL_STEEL);
  g.fillRect(x - 16, y - CITADEL_ROOF - 7, 32, 4);
  g.fillStyle(MIL_HAZARD);
  g.fillRect(x - 16, y - CITADEL_ROOF - 8, 32, 1);
  g.fillStyle(0x6d7175);
  g.fillRect(x + 28, y - CITADEL_ROOF - 34, 3, 31);
  g.fillRect(x + 16, y - CITADEL_ROOF - 40, 28, 4);
  for (let rx = x + 17; rx < x + 43; rx += 3) g.fillRect(rx, y - CITADEL_ROOF - 44, 1, 4);
  g.fillRect(x - 36, y - CITADEL_ROOF - 46, 2, 43);
  g.fillRect(x - 28, y - CITADEL_ROOF - 30, 2, 27);
  g.fillRect(x - 40, y - CITADEL_ROOF - 36, 10, 1);
  // Flag on the tower corner.
  g.fillStyle(0x2e3034);
  g.fillRect(x + 43, y - CITADEL_ROOF - 30, 1, 27);
  g.fillStyle(0x4a5a7a);
  g.fillRect(x + 44, y - CITADEL_ROOF - 30, 12, 8);
  g.fillStyle(0xe8e2d6);
  g.fillRect(x + 44, y - CITADEL_ROOF - 27, 12, 2);
}

// Blinking red beacons on the masts and a searchlight sweeping the sky (when drawn live).
function forgeFx(g, x, y, elapsed) {
  const on = Math.sin(elapsed * 3) > 0;
  g.fillStyle(MIL_RED, on ? 1 : 0.3);
  g.fillCircle(x - 35, y - CITADEL_ROOF - 47, 2.5);
  g.fillCircle(x - 27, y - CITADEL_ROOF - 31, 2);
  const angle = -Math.PI / 2 + Math.sin(elapsed * 0.5) * 0.9;
  const sx = x - 90;
  const sy = y - 152;
  const reach = 260;
  const spread = 0.09;
  g.fillStyle(0xfff6d0, 0.12);
  g.fillTriangle(sx, sy, sx + Math.cos(angle - spread) * reach, sy + Math.sin(angle - spread) * reach,
    sx + Math.cos(angle + spread) * reach, sy + Math.sin(angle + spread) * reach);
}

function drawAlpineShelter(g, x, y) {
  footing(g, x, y, 102, 0x34383c);
  const left = x - 48;
  const sW = 96;
  const sH = 76;
  const top = y - sH;

  // 1. Heavy Glacial Fieldstone Ground Floor (Avalanche-resistant base)
  g.fillStyle(0x4a4e54);
  g.fillRect(left, y - 28, sW, 28);
  g.fillStyle(0xffffff, 0.12);
  g.fillRect(left, y - 28, sW * 0.45, 28);
  g.fillStyle(0x1a1c20, 0.25);
  g.fillRect(left + sW * 0.65, y - 28, sW * 0.35, 28);

  // Fieldstone masonry pattern & quoins
  g.fillStyle(0x34383e, 0.6);
  for (let sy = y - 24; sy < y - 4; sy += 7) {
    g.fillRect(left, sy, sW, 1);
  }
  for (let i = 0; i < 4; i++) {
    g.fillRect(left + 18 + i * 20, y - 28, 1, 28);
  }

  // Snowdrifts banked against base
  g.fillStyle(0xf0f6fa);
  g.fillTriangle(left - 6, y, left + 14, y, left, y - 10);
  g.fillTriangle(left + sW - 14, y, left + sW + 6, y, left + sW, y - 12);

  // 2. Alpine Cedar Timber Log Second Story (y - 28 to top)
  g.fillStyle(0x523c28);
  g.fillRect(left + 4, top, sW - 8, y - 28 - top);
  g.fillStyle(0xffffff, 0.14);
  g.fillRect(left + 4, top, (sW - 8) * 0.45, y - 28 - top);

  // Horizontal log profile lines
  g.fillStyle(0x38281a, 0.5);
  for (let ly = top + 5; ly < y - 28; ly += 5) {
    g.fillRect(left + 4, ly, sW - 8, 1);
  }

  // Interlocking corner log ends (round notches)
  g.fillStyle(0x3e2c1e);
  for (let ly = top + 4; ly < y - 28; ly += 6) {
    g.fillCircle(left + 2, ly, 3);
    g.fillCircle(left + sW - 2, ly, 3);
  }

  // 3. Cantilevered Timber Rescue Balcony with Red Cross Crest
  const bW = 54;
  const bLeft = x - bW / 2;
  const bY = y - 28;
  // Balcony timber deck floor
  g.fillStyle(0x382618);
  g.fillRect(bLeft - 2, bY - 2, bW + 4, 3);
  // Diagonal support timber brackets underneath
  g.lineStyle(2, 0x382618);
  g.lineBetween(bLeft + 6, bY, bLeft - 4, bY + 12);
  g.lineBetween(bLeft + bW - 6, bY, bLeft + bW + 4, bY + 12);

  // Carved wooden alpine balcony railings
  g.fillStyle(0x6e4e32);
  g.fillRect(bLeft, bY - 14, bW, 12);
  g.fillStyle(0x382618);
  g.fillRect(bLeft, bY - 14, bW, 2); // Handrail top
  // Baluster cutouts
  g.fillStyle(0x281a10);
  for (let bx = bLeft + 4; bx < bLeft + bW - 4; bx += 7) {
    g.fillRect(bx, bY - 11, 3, 7);
  }

  // Mountain Rescue Red Cross Crest in center of balcony
  g.fillStyle(0xffffff);
  g.fillRect(x - 6, bY - 12, 12, 10);
  g.fillStyle(0xee2222); // Red cross
  g.fillRect(x - 4, bY - 8, 8, 2);
  g.fillRect(x - 1, bY - 11, 2, 8);

  // 4. Steep Alpine A-Frame Slate Roof with Thick Snow Blanket
  // Slate under-roof
  g.fillStyle(SLATE_SNOW);
  g.fillTriangle(left - 8, top, x, top - 32, left + sW + 8, top);
  g.fillStyle(0x36424e);
  g.fillTriangle(x, top - 32, left + sW + 8, top, x, top);

  // Thick undulating snow drifts on roof
  g.fillStyle(0xf0f6fa);
  g.fillTriangle(left - 8, top, x, top - 32, x, top - 24);
  g.fillRect(left - 8, top - 2, sW + 16, 4);
  // Snow drift crests
  g.fillCircle(x - 16, top - 14, 5);
  g.fillCircle(x + 18, top - 12, 4);

  // Hanging frost icicles along eaves
  g.fillStyle(0xd6ecfa);
  for (let ix = left - 6; ix <= left + sW + 6; ix += 7) {
    const iLen = 3 + ((Math.abs(ix * 7)) % 5);
    g.fillTriangle(ix - 1.5, top + 2, ix + 1.5, top + 2, ix, top + 2 + iLen);
  }

  // 5. Alpine Dormer Window glowing with refuge light
  g.fillStyle(0x423020);
  g.fillRect(x - 8, top - 18, 16, 14);
  g.fillStyle(0xf0f6fa); // Dormer snow cap
  g.fillTriangle(x - 10, top - 18, x, top - 25, x + 10, top - 18);
  // Multi-pane glowing warm window
  g.fillStyle(0xffe890);
  g.fillRect(x - 6, top - 16, 12, 10);
  g.fillStyle(0x423020);
  g.fillRect(x - 0.5, top - 16, 1, 10);
  g.fillRect(x - 6, top - 11, 12, 1);

  // 6. Massive Mountain Fieldstone Hearth Chimney & Pluming Smoke
  g.fillStyle(0x444a52);
  g.fillRect(left + sW - 18, top - 40, 10, 36);
  g.fillStyle(0x282c32);
  g.fillRect(left + sW - 10, top - 40, 2, 36);
  // Chimney snow cap & pot
  g.fillStyle(0x606670);
  g.fillRect(left + sW - 19, top - 42, 12, 3);
  g.fillStyle(0xdd5533); // Terracotta flue pot
  g.fillRect(left + sW - 15, top - 46, 4, 4);
  // Cozy hearth smoke curling in alpine wind
  g.fillStyle(0xcccccc, 0.45);
  g.fillCircle(left + sW - 13, top - 52, 4);
  g.fillCircle(left + sW - 9, top - 60, 6);
  g.fillCircle(left + sW - 3, top - 70, 8);

  // 7. Rooftop Emergency Rescue Radio Antenna & Blinking Beacon
  g.fillStyle(0x8894a0);
  g.fillRect(x - 1, top - 54, 2, 22);
  g.fillRect(x - 4, top - 48, 8, 1.5);
  g.fillRect(x - 3, top - 42, 6, 1.5);
  // Red safety strobe beacon
  g.fillStyle(0xff2222);
  g.fillCircle(x, top - 54, 2.5);

  // 8. Ground Floor Heavy Timber Portal & Mountain Gear
  // Heavy insulated arched wooden door
  g.fillStyle(0x28180e);
  g.fillRect(x - 7, y - 24, 14, 24);
  g.fillStyle(0x422616);
  g.fillRect(x - 6, y - 23, 12, 22);
  // Iron strap hinges & handle
  g.fillStyle(0x181818);
  g.fillRect(x - 6, y - 18, 10, 1.5);
  g.fillRect(x - 6, y - 8, 10, 1.5);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x + 3, y - 12, 1.5);

  // Warm wall lantern beside door
  g.fillStyle(0xffbb33);
  g.fillCircle(x + 12, y - 16, 2.5);
  g.fillStyle(0x181818);
  g.fillRect(x + 10, y - 18, 4, 1.5);

  // Propped Skis and Mountain Sled against wall
  // Slanted skis
  g.lineStyle(1.5, 0x2266aa);
  g.lineBetween(left + 10, y, left + 14, y - 26);
  g.lineStyle(1.5, 0xee4422);
  g.lineBetween(left + 13, y, left + 17, y - 26);
  // Ski poles
  g.lineStyle(1, 0xcccccc);
  g.lineBetween(left + 16, y, left + 19, y - 22);
}

function drawSummitObservatory(g, x, y) {
  footing(g, x, y, 116, 0x1e2630);
  const left = x - 54;
  const oW = 108;

  // 1. Reinforced Mountain Foundation & Foundation Snow Bank
  g.fillStyle(0x2e3844);
  g.fillRect(left - 2, y - 12, oW + 4, 12);
  g.fillStyle(0xf0f6fa); // Snow accumulation around base
  g.fillTriangle(left - 8, y, left + 16, y, left - 2, y - 10);
  g.fillTriangle(left + oW - 16, y, left + oW + 8, y, left + oW + 2, y - 10);

  // 2. Monumental Cylindrical Insulated Concrete Base (y - 12 to y - 88, height 76)
  const bTop = y - 88;
  const bW = 96;
  const bLeft = x - bW / 2;

  // High-altitude insulated panels (arctic white & tech slate)
  g.fillStyle(0xe2ecf4);
  g.fillRect(bLeft, bTop, bW, 76);
  g.fillStyle(0xffffff, 0.25);
  g.fillRect(bLeft, bTop, bW * 0.45, 76);
  g.fillStyle(0x3a4858, 0.35);
  g.fillRect(bLeft + bW * 0.65, bTop, bW * 0.35, 76);

  // Reinforced concrete vertical pilasters / buttresses
  for (const px of [bLeft + 6, bLeft + 26, bLeft + bW - 26, bLeft + bW - 6]) {
    g.fillStyle(0xbac8d6);
    g.fillRect(px - 2, bTop, 4, 76);
    g.fillStyle(0xffffff);
    g.fillRect(px - 2, bTop, 2, 76);
  }

  // Cylindrical panel seams
  g.fillStyle(0x94a6b8, 0.5);
  g.fillRect(bLeft, bTop + 24, bW, 1.5);
  g.fillRect(bLeft, bTop + 50, bW, 1.5);

  // Heavy Air-Lock Blast Hatch & Exterior Entry Portal
  g.fillStyle(0x283442);
  g.fillRect(x - 12, y - 28, 24, 28);
  g.fillStyle(0x485868);
  g.fillRect(x - 10, y - 26, 20, 26);
  // Hazard stripe warning header above portal
  for (let hx = x - 12; hx < x + 12; hx += 4) {
    g.fillStyle(hx % 8 === 0 ? 0xffcc00 : 0x111111);
    g.fillRect(hx, y - 30, 4, 3);
  }
  // Porthole inspection window
  g.fillStyle(0x38b8e0);
  g.fillCircle(x, y - 18, 4);
  g.fillStyle(0xffffff);
  g.fillCircle(x - 1, y - 19, 1.5);

  // 3. 360-Degree Cantilevered Catwalk Gallery & Steel Railing (at y - 88)
  const cW = 106;
  const cLeft = x - cW / 2;
  // Industrial steel grating platform
  g.fillStyle(0x242e38);
  g.fillRect(cLeft, bTop - 4, cW, 5);
  g.fillStyle(0x56687a);
  g.fillRect(cLeft, bTop - 4, cW, 1.5);
  // Diagonal steel strut supports below catwalk
  g.lineStyle(1.5, 0x384858);
  for (const sx of [cLeft + 8, cLeft + 30, cLeft + cW - 30, cLeft + cW - 8]) {
    g.lineBetween(sx, bTop, sx + (sx < x ? 12 : -12), bTop + 14);
  }
  // Safety handrails & posts
  g.fillStyle(0x788a9e);
  g.fillRect(cLeft + 2, bTop - 14, cW - 4, 1.5);
  g.fillRect(cLeft + 2, bTop - 9, cW - 4, 1);
  for (let rx = cLeft + 4; rx <= cLeft + cW - 4; rx += 14) {
    g.fillRect(rx, bTop - 14, 1.5, 10);
  }

  // 4. Heavy Azimuth Rotating Track Ring (at y - 88 to y - 94)
  g.fillStyle(0x303c4a);
  g.fillRect(bLeft + 4, bTop - 10, bW - 8, 6);
  g.fillStyle(0x607284);
  for (let gx = bLeft + 8; gx < bLeft + bW - 8; gx += 6) {
    g.fillRect(gx, bTop - 9, 3, 4); // Drive gears
  }

  // 5. Massive Hemispherical Weathered Copper Rotating Telescope Dome
  const domeRadius = 45;
  const domeCenterY = bTop - 10;
  // Copper dome base circle (masked upper half)
  g.fillStyle(COPPER_ROOF);
  g.fillCircle(x, domeCenterY, domeRadius);
  // Highlight reflection on sunlit quadrant
  g.fillStyle(COPPER_LIGHT, 0.65);
  g.fillCircle(x - 12, domeCenterY - 14, 28);
  // Shadowed shading on east side
  g.fillStyle(0x224838, 0.45);
  g.fillCircle(x + 12, domeCenterY - 4, domeRadius * 0.75);

  // Dome panel rib seams
  g.lineStyle(1.5, 0x2d5a48);
  g.lineBetween(x - domeRadius + 4, domeCenterY, x, domeCenterY - domeRadius + 2);
  g.lineBetween(x, domeCenterY - domeRadius + 2, x + domeRadius - 4, domeCenterY);

  // 6. Deep Open Telescope Observation Shutter Slit
  const slitW = 16;
  const slitTop = domeCenterY - domeRadius;
  const slitH = domeRadius + 2;
  g.fillStyle(0x10141a); // Dark interior cavern
  g.fillRect(x - slitW / 2, slitTop, slitW, slitH);
  // Shutter slide doors retracted on sides
  g.fillStyle(0x387860);
  g.fillRect(x - slitW / 2 - 3, slitTop + 4, 3, slitH - 4);
  g.fillRect(x + slitW / 2, slitTop + 4, 3, slitH - 4);

  // 7. Protruding High-Powered Astronomical Telescope Barrel
  // Telescope mount & barrel protruding from slit toward apex
  const tY = domeCenterY - 32;
  g.fillStyle(0x2e3846); // Massive telescope tube
  g.fillRect(x - 5, tY - 16, 10, 26);
  g.fillStyle(0x4a586a);
  g.fillRect(x - 5, tY - 16, 4, 26);
  // Polished metallic aperture bezel
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 6, tY - 18, 12, 3);
  // Deep blue coated optical primary mirror/lens
  g.fillStyle(0x1a4878);
  g.fillRect(x - 4, tY - 17, 8, 1.5);
  g.fillStyle(AURORA_TEAL);
  g.fillCircle(x, tY - 17, 1.5); // Optical starburst glint

  // 8. Secondary Instrumentation Pod / Satellite Uplink (West Wing)
  g.fillStyle(0x3a4858);
  g.fillRect(left + 2, bTop + 8, 20, 24);
  // Parabolic satellite uplink dish
  g.fillStyle(0xdde6ec);
  g.fillCircle(left + 12, bTop + 4, 10);
  g.fillStyle(0x242e38);
  g.fillCircle(left + 12, bTop + 4, 8);
  g.fillStyle(0xffffff);
  g.fillCircle(left + 12, bTop + 4, 2.5); // Feed horn

  // 9. High-Altitude Weather Telemetry Mast (East Wing)
  g.fillStyle(0x8898a8);
  g.fillRect(left + oW - 14, bTop - 26, 2, 34);
  // Rotating anemometer wind cups
  g.fillStyle(0xff3322);
  g.fillCircle(left + oW - 18, bTop - 24, 2.5);
  g.fillCircle(left + oW - 8, bTop - 24, 2.5);
  g.fillRect(left + oW - 18, bTop - 25, 10, 1.5);
  // Meteorological wind arrow vane
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(left + oW - 17, bTop - 18, 8, 1.5);
}

function observatoryFx(g, x, y, elapsed) {
  const beamAlpha = 0.55 + Math.sin(elapsed * 5) * 0.15;
  g.fillStyle(0x38ffa8, beamAlpha);
  g.fillRect(x - 1.5, y - 380, 3, 240);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(x, y - 140, 3.5);
}

function drawRangerLookout(g, x, y) {
  footing(g, x, y, 55, TIMBER_DARK);
  g.fillStyle(0x423428);
  g.fillRect(x - 18, y - 110, 4, 110);
  g.fillRect(x + 14, y - 110, 4, 110);
  g.fillStyle(0x32261c);
  for (let by = y - 90; by < y - 15; by += 28) {
    g.fillRect(x - 18, by, 36, 3);
  }
  g.fillStyle(0x5a4634);
  g.fillRect(x - 22, y - 145, 44, 35);
  g.fillStyle(0xfff0c0);
  g.fillRect(x - 20, y - 140, 40, 14);
  g.fillStyle(0x222222);
  for (let wx = x - 18; wx <= x + 18; wx += 9) g.fillRect(wx, y - 140, 1.5, 14);
  g.fillStyle(0x2e3c28);
  g.fillTriangle(x - 26, y - 145, x, y - 162, x + 26, y - 145);
  g.fillStyle(0xcccccc);
  g.fillRect(x - 1, y - 175, 2, 14);
}

function drawDrillRig(g, x, y) {
  footing(g, x, y, 80, 0x222e38);
  g.fillStyle(0x3a4854);
  g.fillRect(x - 34, y - 45, 68, 45);
  g.fillStyle(0xffaa22);
  g.fillRect(x - 30, y - 40, 60, 4);
  g.fillStyle(0x788898);
  g.fillTriangle(x - 22, y - 45, x - 4, y - 170, x + 4, y - 170);
  g.fillTriangle(x - 22, y - 45, x + 4, y - 170, x + 22, y - 45);
  g.fillStyle(0x182430);
  g.fillTriangle(x - 18, y - 45, x, y - 160, x + 18, y - 45);
  g.fillStyle(0xffd700);
  g.fillRect(x - 6, y - 174, 12, 6);
  g.fillStyle(0xcccccc);
  g.fillRect(x - 0.5, y - 170, 1, 125);
}

function drillFx(g, x, y, elapsed) {
  for (let i = 0; i < 3; i++) {
    const age = ((elapsed * 2.2 + i * 0.9) % 2.5);
    const alpha = Math.max(0, 0.6 * (1 - age / 2.5));
    g.fillStyle(0xffffff, alpha);
    g.fillCircle(x + 22 + Math.sin(elapsed * 2 + i) * 6, y - 48 - age * 24, 4 + age * 5);
  }
}

// Polaris Nexus: twin red-brick towers banded in pale stone, under steep slate roofs carrying snow
// and gold finials, joined by a warm-lit glass skybridge, on an arcaded stone podium. Each tower has a
// clock (hands in polarisFx).
function drawPolarisNexus(g, x, y, elapsed) {
  const BRICK = 0x8c4b3e;
  const BRICK_SHADE = 0x713a30;
  const BAND = 0xe2d8c6;
  const SLATE = 0x3e4650;
  const SLATE_LIGHT = 0x56606b;
  footing(g, x, y, 130, 0x5a4a44);
  for (const tx of [x - 32, x + 32]) {
    const left = tx - 22;
    const top = y - 440;
    g.fillStyle(BRICK);
    g.fillRect(left, top, 44, 406);
    g.fillStyle(BRICK_SHADE);
    g.fillRect(left + 39, top, 5, 406);
    windowColumns(g, left + 6, top + 44, 4, 9, 5, 29, 12, BRICK, `polaris-${tx > x ? 'e' : 'w'}`);
    // Stone bands every few floors.
    g.fillStyle(BAND);
    for (let by = top + 40; by < y - 40; by += 72) g.fillRect(left - 1, by, 46, 3);
    // Clock face under the roof.
    g.fillStyle(LANDMARK_GOLD);
    g.fillCircle(tx, top + 20, 10);
    g.fillStyle(0xfdfbf2);
    g.fillCircle(tx, top + 20, 8);
    g.fillStyle(0x303030);
    g.fillRect(tx - 0.5, top + 13, 1, 2);
    g.fillRect(tx - 0.5, top + 25, 1, 2);
    g.fillRect(tx - 7, top + 19.5, 2, 1);
    g.fillRect(tx + 5, top + 19.5, 2, 1);
    // Hands: they tick while the building is drawn live, and read 10:10 when it is painted once.
    const minute = elapsed ? elapsed * 0.6 : Math.PI * 0.33;
    const hour = elapsed ? minute / 12 : -Math.PI * 0.33;
    g.lineStyle(1.5, 0x1f1f1f);
    g.lineBetween(tx, top + 20, tx + Math.sin(minute) * 6, top + 20 - Math.cos(minute) * 6);
    g.lineStyle(2, 0x1f1f1f);
    g.lineBetween(tx, top + 20, tx + Math.sin(hour) * 4, top + 20 - Math.cos(hour) * 4);
    // Steep slate roof with snow down its sunlit side, and a gold finial.
    g.fillStyle(SLATE);
    g.fillTriangle(left - 3, top, tx, top - 66, left + 47, top);
    g.fillStyle(SLATE_LIGHT);
    g.fillTriangle(left - 3, top, tx, top - 66, tx, top);
    g.fillStyle(SNOW);
    g.fillTriangle(left - 3, top, tx - 8, top - 48, tx - 4, top);
    g.fillRect(left - 3, top - 2, 50, 2);
    icicles(g, left - 3, top, 50, tx * 0.01);
    g.fillStyle(LANDMARK_GOLD);
    g.fillRect(tx - 1, top - 80, 2, 16);
    g.fillCircle(tx, top - 81, 2);
  }
  // Skybridge between the inner faces: brick frame, warm-lit glass, snow on top, icicles beneath.
  g.fillStyle(BRICK_SHADE);
  g.fillRect(x - 11, y - 302, 22, 24);
  g.fillStyle(LANDMARK_WARM, 0.85);
  g.fillRect(x - 10, y - 298, 20, 14);
  g.fillStyle(BRICK_SHADE);
  for (const mx of [-4, 3]) g.fillRect(x + mx, y - 298, 1, 14);
  g.fillStyle(SNOW);
  g.fillRect(x - 11, y - 304, 22, 2);
  icicles(g, x - 11, y - 278, 22, 4);
  // Arcaded stone podium with a warm-lit hall behind the arches and a centred entrance.
  g.fillStyle(BAND);
  g.fillRect(x - 60, y - 34, 120, 34);
  for (let ax = x - 52; ax <= x + 52; ax += 13) {
    if (Math.abs(ax - x) < 8) continue;
    g.fillStyle(LANDMARK_RECESS);
    g.fillRect(ax - 4, y - 22, 8, 22);
    g.fillCircle(ax, y - 22, 4);
    g.fillStyle(LANDMARK_WARM, 0.7);
    g.fillRect(ax - 3, y - 20, 6, 12);
  }
  g.fillStyle(LANDMARK_RECESS);
  g.fillRect(x - 8, y - 26, 16, 26);
  g.fillCircle(x, y - 26, 8);
  g.fillStyle(0x6b4a30);
  g.fillRect(x - 6, y - 25, 5, 25);
  g.fillRect(x + 1, y - 25, 5, 25);
  g.fillStyle(LANDMARK_GOLD);
  g.fillRect(x - 62, y - 36, 124, 2);
  snowCap(g, x - 60, y - 36, 120, 6);
}

// The finials' beacons. (The clock hands are part of the building, so they still show when a mode
// paints the building once to make it breakable and its fx stop.)
function polarisFx(g, x, y, elapsed) {
  for (const tx of [x - 32, x + 32]) {
    g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 2.5 + tx) > 0));
    g.fillCircle(tx, y - 524, 2.5);
  }
}

function drawFjordLighthouse(g, x, y) {
  footing(g, x, y, 70, 0x1a242e);
  // 1. Rusticated Granite Plinth Base (y to y - 28)
  g.fillStyle(0x28343e);
  g.fillRect(x - 28, y - 28, 56, 28);
  g.fillStyle(0x3e4e5c);
  g.fillRect(x - 29, y - 28, 58, 3); // Stone water-table moulding
  // Ashlar stone block texture
  g.fillStyle(0x18222a);
  for (let by = y - 20; by < y; by += 8) {
    g.fillRect(x - 28, by, 56, 1);
    for (let bx = x - 20; bx < x + 24; bx += 14) g.fillRect(bx, by, 1, 8);
  }
  // Heavy Arched Timber Service Portal
  g.fillStyle(0x161e24);
  g.fillRect(x - 7, y - 20, 14, 20);
  g.fillCircle(x, y - 20, 7);
  g.fillStyle(0x3e2316); // Timber door
  g.fillRect(x - 5, y - 19, 10, 19);
  g.fillCircle(x, y - 19, 5);
  // Brass portal lantern
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x + 9, y - 18, 3, 5);
  g.fillStyle(0xfffae0);
  g.fillCircle(x + 10.5, y - 15, 2.5);

  // 2. Tapered Octagonal Tower Shaft (y - 28 to y - 170)
  // 5 alternating bands of nautical crimson & weather-sealed white stone
  const shaftBands = 5;
  const shaftH = 142;
  const bandH = shaftH / shaftBands;
  for (let b = 0; b < shaftBands; b++) {
    const bTop = (y - 28) - (b + 1) * bandH;
    const bBottom = (y - 28) - b * bandH;
    const wBottom = 50 - b * 3.2;
    const wTop = 50 - (b + 1) * 3.2;
    const isRed = (b % 2 === 0);
    const colMain = isRed ? 0xbe281c : 0xf2f6fa;
    const colShadow = isRed ? 0x82160e : 0xb4c0cc;
    const colLit = isRed ? 0xdf4436 : 0xffffff;

    // Main masonry band
    g.fillStyle(colMain);
    g.fillRect(x - wBottom / 2, bTop, wBottom, bBottom - bTop);
    // Sunlit west face
    g.fillStyle(colLit);
    g.fillRect(x - wBottom / 2, bTop, wBottom * 0.28, bBottom - bTop);
    // Shaded east face
    g.fillStyle(colShadow);
    g.fillRect(x + wBottom * 0.22, bTop, wBottom * 0.28, bBottom - bTop);

    // Stone stringer course (cornice moulding) between bands
    if (b < shaftBands - 1) {
      g.fillStyle(0x2a3642);
      g.fillRect(x - wTop / 2 - 2, bTop - 2, wTop + 4, 3);
      g.fillStyle(0x4a5a68);
      g.fillRect(x - wTop / 2 - 2, bTop - 2, wTop + 4, 1);
    }
  }

  // Recessed Arched Windows on Shaft
  for (let wy of [y - 65, y - 115]) {
    g.fillStyle(0x182028);
    g.fillRect(x - 4, wy - 12, 8, 12);
    g.fillCircle(x, wy - 12, 4);
    g.fillStyle(0xfff2a8);
    g.fillRect(x - 2.5, wy - 10, 5, 9);
    g.fillCircle(x, wy - 10, 2.5);
    // Dark glazing cross-mullions
    g.fillStyle(0x182028);
    g.fillRect(x - 2.5, wy - 6, 5, 1);
    g.fillRect(x - 0.5, wy - 10, 1, 9);
  }

  // 3. Watch Room & Flared Cornice (y - 170 to y - 182)
  g.fillStyle(0x28343e);
  g.fillRect(x - 20, y - 176, 40, 8);
  g.fillStyle(0x3e4e5c);
  g.fillTriangle(x - 20, y - 176, x - 26, y - 182, x - 20, y - 182);
  g.fillTriangle(x + 20, y - 176, x + 26, y - 182, x + 20, y - 182);
  g.fillRect(x - 26, y - 182, 52, 6);

  // 4. Cast-Iron Gallery Catwalk & Foghorn Trumpets (y - 182 to y - 192)
  g.fillStyle(0x141a20);
  g.fillRect(x - 25, y - 184, 50, 3);
  // Railing & stanchions
  g.fillStyle(0x222a32);
  g.fillRect(x - 24, y - 192, 48, 1.5);
  for (let rx = x - 23; rx <= x + 23; rx += 6) g.fillRect(rx, y - 192, 1, 8);
  // Dual bronze foghorn trumpets projecting seaward
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x + 18, y - 189, 10, 3);
  g.fillTriangle(x + 28, y - 192, x + 34, y - 195, x + 28, y - 186);

  // 5. Faceted Glass Lantern Room & Copper Cupola (y - 192 to y - 218)
  g.fillStyle(0x18222a);
  g.fillRect(x - 17, y - 193, 34, 3);
  // Faceted panoramic Fresnel lens glazing
  g.fillStyle(0xfff8d0);
  g.fillRect(x - 15, y - 210, 30, 17);
  // High-intensity white beacon core
  g.fillStyle(0xffffff);
  g.fillCircle(x, y - 201, 7);
  // Vertical brass astragals (glazing bars)
  g.fillStyle(0x323a42);
  for (let lx = x - 15; lx <= x + 15; lx += 6) g.fillRect(lx, y - 210, 1.5, 17);

  // Oxidized Copper Dome Cupola
  g.fillStyle(COPPER_ROOF);
  g.fillCircle(x, y - 210, 18);
  g.fillStyle(COPPER_LIGHT);
  g.fillCircle(x - 4, y - 212, 12);
  // Spherical Ventilator Ball, Lightning Mast & Weather Vane
  g.fillStyle(COPPER_ROOF);
  g.fillRect(x - 2, y - 224, 4, 6);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, y - 225, 3.5);
  g.fillRect(x - 0.5, y - 235, 1, 10);
  g.fillRect(x - 4, y - 231, 8, 1);
}

function lighthouseFx(g, x, y, elapsed) {
  const sweep = Math.sin(elapsed * 2.5);
  const alpha = Math.max(0, sweep) * 0.55;
  if (alpha > 0.05) {
    g.fillStyle(0xfff4c0, alpha);
    g.fillTriangle(x, y - 201, x + 240, y - 225, x + 240, y - 177);
  }
}

function drawFjordDeck(g, x, y) {
  footing(g, x, y, 114, 0x2a343e);
  const left = x - 55;
  const w = 110;

  // 1. Rusticated Granite Seawall Quay Foundation (at ground level)
  g.fillStyle(0x28323c);
  g.fillRect(left, y - 8, w, 8);
  g.fillStyle(0x424e5a);
  g.fillRect(left - 2, y - 8, w + 4, 2);
  for (let qx = left + 8; qx < left + w - 8; qx += 16) {
    g.fillStyle(0x182026);
    g.fillRect(qx, y - 8, 1, 8);
  }

  // 2. Weathered Timber Boardwalk Surface
  g.fillStyle(0x6a543e);
  g.fillRect(left, y - 10, w, 3);
  g.fillStyle(0x4a3828);
  for (let px = left; px < left + w; px += 6) g.fillRect(px, y - 10, 1, 3);

  // 3. Central Nordic Timber Overlook Pavilion (x - 28 to x + 28, y - 46 to y - 10)
  const pavLeft = x - 28;
  const pavW = 56;
  const pavTop = y - 44;
  // Deep timber frame & weatherboard siding
  g.fillStyle(0x7c3426); // Scandinavian Falun red
  g.fillRect(pavLeft, pavTop, pavW, 34);
  g.fillStyle(0x3e1e16);
  g.fillRect(pavLeft, pavTop, 3, 34);
  g.fillRect(pavLeft + pavW - 3, pavTop, 3, 34);

  // Pitched Gable Roof with Snow Eaves
  g.fillStyle(0x28343e);
  g.fillTriangle(pavLeft - 4, pavTop, x, pavTop - 16, pavLeft + pavW + 4, pavTop);
  // Crisp snow ridge on roof
  g.fillStyle(0xf2f8fc);
  g.fillRect(pavLeft - 4, pavTop - 1, pavW + 8, 2);
  g.lineStyle(2, 0xffffff);
  g.lineBetween(pavLeft - 4, pavTop, x, pavTop - 16);
  g.lineBetween(pavLeft + pavW + 4, pavTop, x, pavTop - 16);

  // Panoramic Glass Harbor Observation Windows
  g.fillStyle(ICE_BLUE);
  g.fillRect(pavLeft + 6, pavTop + 8, 18, 16);
  g.fillRect(pavLeft + 32, pavTop + 8, 18, 16);
  // Interior warm amber lighting
  g.fillStyle(0xfff2aa, 0.45);
  g.fillRect(pavLeft + 7, pavTop + 9, 16, 14);
  g.fillRect(pavLeft + 33, pavTop + 9, 16, 14);
  // Timber window mullions
  g.fillStyle(0x3e1e16);
  g.fillRect(pavLeft + 14, pavTop + 8, 1.5, 16);
  g.fillRect(pavLeft + 40, pavTop + 8, 1.5, 16);
  g.fillRect(pavLeft + 6, pavTop + 15, 18, 1.5);
  g.fillRect(pavLeft + 32, pavTop + 15, 18, 1.5);

  // Pavilion Front Entrance Door
  g.fillStyle(0x26140c);
  g.fillRect(x - 4, y - 22, 8, 12);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x + 2, y - 16, 1);

  // 4. Scenic Veranda Wooden Railings & Harbor Binoculars on Flanks
  // Veranda railings
  g.fillStyle(0x4a3626);
  g.fillRect(left + 2, y - 22, 22, 2);
  g.fillRect(x + 30, y - 22, 22, 2);
  for (let rx of [left + 4, left + 12, left + 22, x + 32, x + 42, x + 50]) {
    g.fillRect(rx, y - 22, 2, 12);
  }

  // Brass Swivel Maritime Telescope on west veranda
  g.fillStyle(0x242424);
  g.fillRect(left + 10, y - 26, 2, 16); // Pillar mount
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(left + 7, y - 29, 9, 4); // Barrel
  g.fillStyle(0x111111);
  g.fillRect(left + 6, y - 28, 2, 2); // Eyepiece

  // Weathered wooden harbor bench on east veranda
  g.fillStyle(0x5a422e);
  g.fillRect(x + 35, y - 16, 14, 2);
  g.fillRect(x + 36, y - 14, 2, 4);
  g.fillRect(x + 46, y - 14, 2, 4);

  // Lifebuoy ring mounted on railing
  g.fillStyle(0xd93829);
  g.fillCircle(left + 19, y - 16, 3);
  g.fillStyle(0xffffff);
  g.fillCircle(left + 19, y - 16, 1.5);

  // 5. Nautical Flagpole atop Pavilion
  g.fillStyle(0x323a42);
  g.fillRect(x - 1, pavTop - 30, 2, 14);
  g.fillStyle(0x286090); // Maritime blue pennant
  g.fillTriangle(x + 1, pavTop - 29, x + 12, pavTop - 25, x + 1, pavTop - 21);
}

// Command post: a sandbagged concrete bunker with a steel door, an antenna farm and a satellite dish.
function drawGeothermalPump(g, x, y) {
  footing(g, x, y, 105, 0x3a3a3e);
  g.fillStyle(MIL_CONCRETE);
  g.fillRect(x - 45, y - 34, 90, 34);
  g.fillStyle(MIL_CONCRETE_SHADE);
  g.fillRect(x + 20, y - 34, 25, 34);
  g.fillStyle(MIL_TINT);
  for (const wx of [-36, -24, 16, 28]) g.fillRect(x + wx, y - 26, 8, 5);
  g.fillStyle(MIL_SCREEN, 0.7);
  g.fillRect(x - 35, y - 25, 3, 3);
  g.fillRect(x + 29, y - 25, 3, 3);
  // Sandbag walls either side of the door.
  for (const side of [-1, 1]) {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        g.fillStyle(r % 2 ? 0x9a8a68 : 0x8a7a5a);
        g.fillRect(x + side * 50 - (side > 0 ? 0 : 20) + c * 5 + (r % 2) * 2, y - 6 - r * 4, 5, 4);
      }
    }
  }
  g.fillStyle(MIL_STEEL);
  g.fillRect(x - 6, y - 20, 12, 20);
  g.fillStyle(0x4a4e52);
  g.fillRect(x - 5, y - 19, 10, 19);
  hazardStripes(g, x - 8, y - 23, 16, 3);
  snowCap(g, x - 45, y - 34, 90, 31);
  // Antenna farm and dish on the roof.
  g.fillStyle(0x6d7175);
  g.fillRect(x - 32, y - 112, 2, 78);
  g.fillRect(x - 20, y - 86, 2, 52);
  g.fillRect(x - 38, y - 96, 14, 1);
  g.fillRect(x - 36, y - 74, 10, 1);
  g.lineStyle(1, 0x8a8e92, 0.8);
  g.lineBetween(x - 31, y - 112, x - 45, y - 34);
  g.lineBetween(x - 31, y - 112, x - 14, y - 34);
  g.fillStyle(0xd8dce0);
  g.fillCircle(x + 18, y - 50, 11);
  g.fillStyle(MIL_CONCRETE_SHADE);
  g.fillCircle(x + 20, y - 50, 8);
  g.fillStyle(0x6d7175);
  g.fillRect(x + 17, y - 40, 3, 6);
  g.fillRect(x + 14, y - 52, 9, 1);
}

function pumpFx(g, x, y, elapsed) {
  g.fillStyle(MIL_RED, Math.sin(elapsed * 2.6) > 0 ? 1 : 0.3);
  g.fillCircle(x - 31, y - 113, 2);
  g.fillCircle(x - 19, y - 87, 1.5);
}

// -------------------------------------------------------------
// LANDMARK REGISTRATION & EXPORTS
// -------------------------------------------------------------

export const ICE_LAKE_BRIDGE_DECK = Object.freeze({
  id: 'ice-lake-causeway',
  x: 52025,
  from: 51550,
  to: 52500,
  rise: 20,
});

export const FJORD_BRIDGE_DECK = Object.freeze({
  id: 'whale-fjord-bridge',
  x: 61200,
  from: 60620,
  to: 61780,
  rise: 36,
});

export function frostlandDeckRise(x, deckUp = null) {
  const at = wrapX(x);
  if (at > ICE_LAKE_BRIDGE_DECK.from && at < ICE_LAKE_BRIDGE_DECK.to) {
    if (deckUp && !deckUp(ICE_LAKE_BRIDGE_DECK.id)) return null;
    return ICE_LAKE_BRIDGE_DECK.rise;
  }
  if (at > FJORD_BRIDGE_DECK.from && at < FJORD_BRIDGE_DECK.to) {
    if (deckUp && !deckUp(FJORD_BRIDGE_DECK.id)) return null;
    const halfSpan = (FJORD_BRIDGE_DECK.to - FJORD_BRIDGE_DECK.from) / 2;
    const u = (at - FJORD_BRIDGE_DECK.x) / halfSpan;
    return Math.round(36 + (1 - u * u) * 6);
  }
  return null;
}

function drawIceLakeCauseway(g, x, y) {
  const left = x - 475;
  const right = x + 475;
  const spanW = 950;
  const deckY = y - 20;

  // 1. Arctic Timber & Concrete Pile Bents
  for (let px = left + 25; px < right - 15; px += 40) {
    g.fillStyle(TIMBER_DARK);
    g.fillRect(px - 3, deckY + 4, 6, y - (deckY + 4) + 20);
    g.fillStyle(0x4a3628);
    g.fillRect(px - 10, deckY + 2, 20, 3);
    g.fillTriangle(px - 8, deckY + 4, px + 8, deckY + 16, px + 6, deckY + 16);
  }

  // 2. Heavy Timber Stringers & Causeway Roadbed
  g.fillStyle(0x32261c);
  g.fillRect(left, deckY + 1, spanW, 4);
  g.fillStyle(0x282c32);
  g.fillRect(left, deckY - 1, spanW, 3);

  // 3. Snowplow Windrows & Road Marking
  g.fillStyle(0xecf4f8);
  g.fillRect(left, deckY - 2, spanW, 1.5);
  g.fillStyle(0xd4a024);
  for (let cx = left + 10; cx < right - 10; cx += 28) {
    g.fillRect(cx, deckY, 16, 1);
  }

  // 4. Heavy Log Guardrails & High-Visibility Snow Poles
  g.fillStyle(0x4e3826);
  g.fillRect(left, deckY - 6, spanW, 2);
  for (let rx = left + 5; rx < right; rx += 15) {
    g.fillRect(rx, deckY - 6, 2, 6);
  }
  for (let sp = left + 18; sp < right - 10; sp += 50) {
    g.fillStyle(0xcc2211);
    g.fillRect(sp, deckY - 18, 2, 14);
    g.fillStyle(0xffffff);
    g.fillRect(sp, deckY - 15, 2, 3);
    g.fillRect(sp, deckY - 9, 2, 3);
  }

  // 5. Mid-span Ice-Fishing Platforms with Windbreaks
  for (const bx of [x - 160, x + 160]) {
    g.fillStyle(TIMBER_DARK);
    g.fillRect(bx - 18, deckY - 2, 36, 4);
    g.fillStyle(0x9a3024);
    g.fillRect(bx - 14, deckY - 16, 12, 14);
    g.fillStyle(0x222222);
    g.fillRect(bx - 12, deckY - 14, 4, 6);
    g.fillStyle(0xee6622);
    g.fillCircle(bx + 8, deckY - 8, 3.5);
    g.fillStyle(0xffffff);
    g.fillCircle(bx + 8, deckY - 8, 1.5);
  }

  footing(g, left + 12, deckY + 6, 26, 0x364048, 50);
  footing(g, right - 12, deckY + 6, 26, 0x364048, 50);
}

function drawWhaleFjordBridge(g, x, y) {
  const left = x - 580;
  const right = x + 580;
  const spanW = 1160;

  const towW = x - 300;
  const towE = x + 300;
  const deckAt = cx => {
    const u = (cx - x) / 580;
    const rise = 36 + (1 - u * u) * 6;
    return Math.round(y - SEA_Y_OFFSET - rise);
  };

  const deckYW = deckAt(towW);
  const deckYE = deckAt(towE);
  const towerH = 195;
  const topPylon = deckYW - towerH; // perfectly identical height on both towers

  // 1. Deep-Water Concrete Caissons & Abutments
  footing(g, left + 14, deckAt(left) + 4, 38, 0x222830, 50);
  footing(g, right - 14, deckAt(right) + 4, 38, 0x222830, 50);

  // Granite Ashlar Anchorage Houses on shores
  g.fillStyle(0x3a424c);
  g.fillRect(left - 4, deckAt(left) - 10, 28, 14);
  g.fillRect(right - 24, deckAt(right) - 10, 28, 14);
  g.fillStyle(0x222830);
  g.fillRect(left + 2, deckAt(left) - 8, 16, 12);
  g.fillRect(right - 18, deckAt(right) - 8, 16, 12);

  const towers = [
    { tx: towW, deckY: deckYW },
    { tx: towE, deckY: deckYE },
  ];

  for (const { tx, deckY } of towers) {
    // Deep water concrete caisson pier with tapered icebreaker nose
    g.fillStyle(0x1a2026);
    g.fillRect(tx - 24, deckY + 10, 48, y - (deckY + 10) + 36);
    g.fillStyle(0x2c343e);
    g.fillRect(tx - 20, deckY + 10, 40, y - (deckY + 10) + 36);
    // Pier granite rustication cap
    g.fillStyle(0x485462);
    g.fillRect(tx - 26, deckY + 8, 52, 4);

    // Crimson steel twin pylon shafts
    const pylonH = deckY - topPylon + 10;
    g.fillStyle(0x8e1e16); // Shadow side
    g.fillRect(tx - 14, topPylon, 10, pylonH);
    g.fillRect(tx + 4, topPylon, 10, pylonH);
    g.fillStyle(0xba2820); // Lit face
    g.fillRect(tx - 12, topPylon, 6, pylonH);
    g.fillRect(tx + 6, topPylon, 6, pylonH);

    // Cross-strut portal beams with decorative arched brackets
    g.fillStyle(0x781810);
    for (let sy = topPylon + 32; sy < deckY; sy += 44) {
      g.fillRect(tx - 14, sy, 28, 8);
      g.fillStyle(0xd0342a);
      g.fillRect(tx - 12, sy + 1, 24, 2);
      g.fillStyle(0x5a100a);
      g.fillTriangle(tx - 14, sy + 8, tx - 14, sy + 16, tx - 6, sy + 8);
      g.fillTriangle(tx + 14, sy + 8, tx + 14, sy + 16, tx + 6, sy + 8);
      g.fillStyle(0x781810);
    }
    // Decorative Art Deco tower cap and cable saddle housing
    g.fillStyle(0x4a100a);
    g.fillRect(tx - 18, topPylon - 7, 36, 8);
    g.fillStyle(0xba2820);
    g.fillRect(tx - 14, topPylon - 12, 28, 6);
    g.fillStyle(0xdddddd);
    g.fillRect(tx - 2, topPylon - 16, 4, 5); // Lightning rod / antenna
  }

  // 2. Main Catenary Suspension Cables & Suspenders
  g.lineStyle(3, 0xba2820);
  // West backstay: shore anchor to west tower top
  g.lineBetween(left + 10, deckAt(left) - 4, towW, topPylon - 6);
  // East backstay: east tower top to shore anchor
  g.lineBetween(towE, topPylon - 6, right - 10, deckAt(right) - 4);

  // Main parabolic cable curve between towers
  const midSagY = deckAt(x) - 30; // graceful sag reaching 30px above mid-deck
  for (let cx = towW; cx <= towE; cx += 12) {
    const v = (cx - x) / 300;
    const cy = Math.round(midSagY + (topPylon - 6 - midSagY) * (v * v));
    g.fillStyle(0xba2820);
    g.fillRect(cx - 1, cy, 3, 3);
    const dY = deckAt(cx);
    // Vertical wire suspender rope
    g.fillStyle(0xa0a8b4, 0.85);
    g.fillRect(cx, cy + 3, 1, Math.max(0, dY - cy - 3));
    // Cable clamp fittings
    g.fillStyle(0x3a404a);
    g.fillRect(cx - 1, cy + 2, 3, 2);
    g.fillRect(cx - 1, dY - 2, 3, 2);
  }

  // Backstay vertical hanger ropes
  for (let cx = left + 40; cx < towW - 20; cx += 24) {
    const t = (cx - (left + 10)) / (towW - (left + 10));
    const cy = Math.round((deckAt(left) - 4) * (1 - t) + (topPylon - 6) * t);
    const dY = deckAt(cx);
    g.fillStyle(0xa0a8b4, 0.7);
    g.fillRect(cx, cy + 2, 1, Math.max(0, dY - cy - 2));
  }
  for (let cx = towE + 24; cx < right - 30; cx += 24) {
    const t = (cx - towE) / ((right - 10) - towE);
    const cy = Math.round((topPylon - 6) * (1 - t) + (deckAt(right) - 4) * t);
    const dY = deckAt(cx);
    g.fillStyle(0xa0a8b4, 0.7);
    g.fillRect(cx, cy + 2, 1, Math.max(0, dY - cy - 2));
  }

  // 3. Stiffening Steel Warren Under-Truss & Roadbed
  for (let cx = left; cx < right; cx += 16) {
    const dY = deckAt(cx);
    // Steel under-truss box girder
    g.fillStyle(0x222830);
    g.fillRect(cx, dY + 2, 16, 9);
    g.fillStyle(0x384250);
    g.fillRect(cx, dY + 3, 2, 7);
    g.fillRect(cx, dY + 10, 16, 1.5);
    // Diagonal Warren cross-brace
    g.lineStyle(1, 0x485668);
    g.lineBetween(cx, dY + 3, cx + 16, dY + 9);

    // Reinforced concrete deck slab & asphalt roadway
    g.fillStyle(0x1a1c20);
    g.fillRect(cx, dY - 1, 16, 3);
    // Double yellow center divide
    g.fillStyle(0xeeaa22, 0.9);
    g.fillRect(cx, dY - 0.5, 16, 0.8);

    // Dashed white lane markings
    if (Math.round(cx / 16) % 2 === 0) {
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(cx + 2, dY - 1, 10, 0.6);
      g.fillRect(cx + 2, dY + 0.5, 10, 0.6);
    }

    // Steel pedestrian guardrail & sidewalk curb
    g.fillStyle(0x6a7888);
    g.fillRect(cx, dY - 7, 16, 1.5);
    g.fillRect(cx + 4, dY - 7, 1, 6);
    g.fillRect(cx + 12, dY - 7, 1, 6);

    // Illuminated Art Deco Street Lampposts every 80px
    if (Math.abs((cx - left) % 80) < 8) {
      g.fillStyle(0x3a4450);
      g.fillRect(cx + 7, dY - 18, 2, 12);
      g.fillRect(cx + 5, dY - 18, 6, 2);
      g.fillStyle(0xfff5cc);
      g.fillCircle(cx + 8, dY - 18, 2.5);
    }
  }

  // Center navigation channel green/white beacons beneath mid-span
  const midY = deckAt(x);
  g.fillStyle(0x11ee66);
  g.fillCircle(x, midY + 13, 3);
  g.fillStyle(0xffffff, 0.7);
  g.fillCircle(x, midY + 13, 1.5);
}

function fjordBridgeFx(g, x, y, elapsed) {
  const deckYW = Math.round(y - SEA_Y_OFFSET - 41);
  const topPylon = deckYW - 195;
  if (Math.sin(elapsed * 5) > 0.1) {
    g.fillStyle(0xff2211);
    g.fillCircle(x - 300, topPylon - 10, 3.5);
    g.fillCircle(x + 300, topPylon - 10, 3.5);
  }
}

const LANDMARK_ART = [
  // Snowcap Peaks (42600 - 47600) & Wonder 6
  { id: 'peaks-rescue-shelter', x: 43600, door: true, draw: drawAlpineShelter, clear: 50, width: 95, height: 80, maxHealth: 280 },
  { id: 'peaks-summit-observatory', x: 45300, door: true, draw: drawSummitObservatory, fx: observatoryFx, clear: 60, width: 110, height: 160, maxHealth: 420 },
  { id: 'ice-citadel', x: 46000, door: true, draw: drawIceCitadel, fx: citadelFx, clear: 120, width: 240, height: 290, maxHealth: 920 },
  // Pine Woods (48100 - 49100)
  { id: 'pinewoods-ranger-lookout', x: 48450, door: true, draw: drawRangerLookout, clear: 35, width: 55, height: 155, maxHealth: 280 },
  // Pinetown (49100 - 50900)
  { id: 'pinetown-mill', x: 49400, door: true, draw: drawPinetownMill, fx: millFx, clear: 65, width: 120, height: 180, maxHealth: 440 },
  { id: 'pinetown-clocktower', x: 50200, door: true, draw: drawPinetownClocktower, clear: 35, width: 48, height: 180, maxHealth: 360 },
  // Frozen Plains Tundra & Ice Lake Causeway (50900 - 53200)
  { id: 'ice-lake-causeway', x: 52025, isBridge: true, draw: drawIceLakeCauseway, clear: 475, width: 950, height: 60, maxHealth: 900 },
  { id: 'arctic-research-station', x: 52700, door: true, draw: drawResearchStation, clear: 65, width: 130, height: 75, maxHealth: 340 },
  { id: 'plains-drill-rig', x: 52950, draw: drawDrillRig, fx: drillFx, clear: 45, width: 80, height: 175, maxHealth: 380 },
  // Snow City (53200 - 59200)
  { id: 'polaris-nexus', x: 54600, door: true, draw: drawPolarisNexus, fx: polarisFx, clear: 65, width: 120, height: 520, maxHealth: 650 },
  { id: 'aurora-spire', x: 55400, door: true, draw: drawAuroraSpire, fx: auroraFx, clear: 58, width: 96, height: 540, maxHealth: 540 },
  { id: 'borealis-tower', x: 56600, door: true, draw: drawBorealisTower, clear: 50, width: 84, height: 440, maxHealth: 480 },
  { id: 'geothermal-plant', x: 57900, door: true, draw: drawGeothermalPlant, fx: plantFx, clear: 70, width: 130, height: 120, maxHealth: 460 },
  // Whale Fjord (60400 - 61800)
  { id: 'fjord-foghorn-lighthouse', x: 60520, door: true, draw: drawFjordLighthouse, fx: lighthouseFx, clear: 40, width: 65, height: 195, maxHealth: 400 },
  { id: 'whale-fjord-bridge', x: 61200, isBridge: true, draw: drawWhaleFjordBridge, fx: fjordBridgeFx, clear: 580, width: 1160, height: 290, maxHealth: 980 },
  { id: 'fjord-observation-deck', x: 61870, draw: drawFjordDeck, clear: 55, width: 110, height: 55, maxHealth: 280 },
  // Whale Harbor (61800 - 63100) & Wonder 3
  { id: 'harbor-colossus', x: 62400, draw: drawHarborColossus, fx: colossusFx, clear: 100, width: 180, height: 330, maxHealth: 940 },
  // Mount Ember (63100 - 65400) & Wonder 7
  { id: 'ember-geothermal-pump', x: 63500, door: true, draw: drawGeothermalPump, fx: pumpFx, clear: 55, width: 105, height: 115, maxHealth: 460 },
  { id: 'volcano-forge', x: 64400, door: true, draw: drawVolcanoForge, fx: forgeFx, clear: 130, width: 260, height: 260, maxHealth: 980 },
];

export const FROSTLAND_LANDMARKS = LANDMARK_ART.map(landmark => {
  if (landmark.isBridge) {
    return { ...landmark };
  }
  return {
    ...landmark,
    draw: scaled(landmark.draw),
    fx: landmark.fx && scaled(landmark.fx),
    clear: landmark.clear * CITY_SCALE,
    width: landmark.width * CITY_SCALE,
    height: landmark.height * CITY_SCALE,
  };
});

// -------------------------------------------------------------
// FROSTLAND STREET BUILDINGS & PROCEDURAL SKYSCRAPERS
// -------------------------------------------------------------

function drawHighpassChalet(g, x, y, width, height, seed = 0) {
  footing(g, x, y, width + 6, 0x342e26);
  const left = x - width / 2;
  const top = y - height;
  const style = Math.floor(hash(seed + 0.23) * 3);

  if (style === 0) {
    // Style 0: Classic Swiss Tyrolean Chalet
    // Fieldstone ground floor
    const stoneH = Math.min(22, Math.round(height * 0.45));
    g.fillStyle(0x56524a);
    g.fillRect(left, y - stoneH, width, stoneH);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(left, y - stoneH, width * 0.45, stoneH);
    g.fillStyle(0x38342e, 0.4);
    for (let sy = y - stoneH + 5; sy < y - 2; sy += 5) g.fillRect(left, sy, width, 1);

    // Dark timber log upper story
    g.fillStyle(0x4a3624);
    g.fillRect(left, top, width, height - stoneH);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(left, top, width * 0.45, height - stoneH);
    g.fillStyle(0x322214, 0.4);
    for (let ly = top + 4; ly < y - stoneH; ly += 4) g.fillRect(left, ly, width, 1);

    // Carved Alpine Balcony
    g.fillStyle(0x6e4e32);
    g.fillRect(left + 2, y - stoneH - 1, width - 4, 3); // Balcony base
    g.fillRect(left + 2, y - stoneH - 9, width - 4, 1.5); // Rail
    for (let bx = left + 4; bx < left + width - 4; bx += 5) {
      g.fillRect(bx, y - stoneH - 9, 1.5, 8);
    }

    // Steep A-frame Alpine Roof with Snow Blanket & Icicles
    g.fillStyle(SLATE_SNOW);
    g.fillTriangle(left - 6, top, x, top - 18, left + width + 6, top);
    g.fillStyle(0xf0f6fa); // Snow
    g.fillTriangle(left - 6, top, x, top - 18, x, top - 13);
    g.fillRect(left - 6, top - 2, width + 12, 3.5);
    // Icicles
    g.fillStyle(0xd6ecfa);
    for (let ix = left - 4; ix <= left + width + 4; ix += 6) {
      g.fillRect(ix, top + 1.5, 1, 3);
    }

    // Windows with shutters & Door
    g.fillStyle(0x8a3024); // Red alpine shutters
    g.fillRect(left + 4, top + 3, 10, 8);
    g.fillRect(left + width - 14, top + 3, 10, 8);
    g.fillStyle(0xffea90); // Lantern light
    g.fillRect(left + 6, top + 4, 6, 6);
    g.fillRect(left + width - 12, top + 4, 6, 6);

    // Entrance door
    g.fillStyle(0x281810);
    g.fillRect(x - 4, y - stoneH + 2, 8, stoneH - 2);

    // Chimney
    g.fillStyle(0x50545a);
    g.fillRect(left + width - 8, top - 24, 5, 16);
    g.fillStyle(0xcccccc, 0.4);
    g.fillCircle(left + width - 5, top - 28, 3.5);
  } else if (style === 1) {
    // Style 1: Alpine Log Cabin (Notched logs with heavy snowed A-frame)
    g.fillStyle(0x5a422e);
    g.fillRect(left, top, width, height);
    g.fillStyle(0xffffff, 0.16);
    g.fillRect(left, top, width * 0.45, height);

    // Timber log notched joints
    g.fillStyle(0x382618);
    for (let ly = top + 4; ly < y - 4; ly += 5) {
      g.fillRect(left, ly, width, 1);
      g.fillCircle(left + 1, ly, 2);
      g.fillCircle(left + width - 1, ly, 2);
    }

    // Steep A-frame Roof with heavy snow drifts
    g.fillStyle(0x3e4852);
    g.fillTriangle(left - 5, top, x, top - 22, left + width + 5, top);
    g.fillStyle(0xf0f6fa);
    g.fillTriangle(left - 5, top, x, top - 22, x, top - 16);
    g.fillRect(left - 5, top - 2, width + 10, 4);

    // Attic Triangular / Gable window
    g.fillStyle(0xffe890);
    g.fillCircle(x, top - 6, 3.5);
    g.fillStyle(0x28180e);
    g.fillRect(x - 0.5, top - 9, 1, 6);

    // Lower Window & Door
    g.fillStyle(0x28180e);
    g.fillRect(x - 4, y - 14, 8, 14);
    g.fillStyle(0xffe890);
    g.fillRect(left + 5, y - 13, 8, 7);

    // Propped Firewood Stack beside cabin
    g.fillStyle(0x6e4a28);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3 - row; col++) {
        g.fillCircle(left + width - 10 + col * 3 + row * 1.5, y - 3 - row * 3, 1.8);
      }
    }

    // Stone Chimney
    g.fillStyle(0x4a4e54);
    g.fillRect(left + 5, top - 26, 4, 18);
    g.fillStyle(0xf0f6fa);
    g.fillRect(left + 4, top - 27, 6, 2);
  } else {
    // Style 2: High Mountain Weather Refuge Hut
    // Insulated weatherproof siding (Nordic slate / spruce)
    g.fillStyle(0x3a4c58);
    g.fillRect(left, top, width, height);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(left, top, width * 0.45, height);

    // Weatherproof seam battens
    g.fillStyle(0x24323c, 0.5);
    for (let bx = left + 4; bx < left + width; bx += 5) {
      g.fillRect(bx, top, 1, height);
    }

    // Low-pitch reinforced snow roof
    g.fillStyle(0x28323a);
    g.fillRect(left - 2, top - 4, width + 4, 4);
    g.fillStyle(0xf0f6fa);
    g.fillRect(left - 2, top - 6, width + 4, 3);

    // Reinforced Steel Guy Wires anchoring roof to ground
    g.lineStyle(1, 0x788a96);
    g.lineBetween(left - 2, top, left - 8, y);
    g.lineBetween(left + width + 2, top, left + width + 8, y);

    // Round porthole insulated window
    g.fillStyle(0x18242c);
    g.fillCircle(x, top + height * 0.35, 5);
    g.fillStyle(0x38b8e0);
    g.fillCircle(x, top + height * 0.35, 3.5);

    // Insulated weather door
    g.fillStyle(0x1a242c);
    g.fillRect(x - 4, y - 13, 8, 13);
    g.fillStyle(ELECTRUM_GOLD);
    g.fillCircle(x + 2, y - 7, 1);

    // Weather sensor mast
    g.fillStyle(0x8a9aa8);
    g.fillRect(left + 4, top - 18, 1.5, 14);
    g.fillStyle(0xff3322);
    g.fillCircle(left + 4, top - 18, 2);
  }
}

function drawPinetownBuilding(g, x, y, width, height, isMill) {
  footing(g, x, y, width + 6, BRICK_DARK);
  const left = x - width / 2;
  const top = y - height;
  // Red brick warehouse / mill structure
  g.fillStyle(BRICK_RED);
  g.fillRect(left, top, width, height);
  // Weathered brick mortar lines
  g.fillStyle(BRICK_DARK);
  g.fillRect(left + width * 0.7, top, width * 0.3, height);
  // Slate / copper roof
  g.fillStyle(isMill ? PINE_ROOF : SLATE_SNOW);
  g.fillRect(left - 2, top - 6, width + 4, 6);
  if (isMill) {
    g.fillTriangle(x - 12, top - 6, x, top - 24, x + 12, top - 6);
  }
  // Windows with white stone sills
  g.fillStyle(0xd5e8ee);
  const rows = Math.floor(height / 18);
  const cols = Math.max(1, Math.floor((width - 8) / 12));
  for (let r = 1; r < rows; r++) {
    const wy = top + r * 18;
    if (wy > y - 22) continue;
    for (let c = 0; c < cols; c++) {
      const wx = left + 6 + c * 12;
      g.fillRect(wx, wy, 6, 9);
      g.fillStyle(0xf0f0f0);
      g.fillRect(wx - 1, wy + 9, 8, 1.5);
      g.fillStyle(0xd5e8ee);
    }
  }
  // Double freight doors
  g.fillStyle(0x2a221a);
  g.fillRect(x - 8, y - 18, 16, 18);
  g.fillStyle(0xb0a48a);
  g.fillRect(x - 7, y - 17, 6, 16);
  g.fillRect(x + 1, y - 17, 6, 16);
}

// -------------------------------------------------------------
// SNOW CITY STREET
// -------------------------------------------------------------
// Built to game-design-rules/city-design-rules.md with Green City (city-art.js) as the reference:
// two flat skyline rows, then a muted street of shops, apartments, offices and downtown high-rises,
// each with a centred door and a flat roof. Snow City's own theme is slate stone under snow: drifts
// on every roof and ledge, icicles, chimney steam and warm-lit windows. The landmarks keep their own
// colours so they still stand out from the street.
export const SNOW_CITY = { from: 53300, to: 59150 };
const SNOW_STREET_STEP = 56 * CITY_SCALE;
const SNOW_TOWER_MARGIN = 110 * CITY_SCALE;
const SNOW_EDGE = 320;
// Downtown sits around Polaris Nexus and Aurora Spire, where the street grows high-rises.
const SNOW_DOWNTOWN = { x: 55600, reach: 1000 };
const SNOW_FACADES = [0x8d9aa7, 0x96a2ae, 0x85929f];
const SNOW_TOWERS = [0x7b8a98, 0x84929f, 0x768595];
const SNOW = 0xf4f8fb;
const SNOW_SHADE = 0xd3dee8;
const ICICLE = 0xd8ecf6;
const FROST_GLASS = 0xcfe1ea;
const LAMP = 0xf3dc9c;
const TIMBER = 0x6b5446;
const CHIMNEY = 0x76686a;
// Snow City's crown and setbacks: everything above a tower's shaft, in art px.
const SNOW_CROWN = 82;
const SNOW_LANDMARK_XS = FROSTLAND_LANDMARKS.filter(l => l.x > SNOW_CITY.from && l.x < SNOW_CITY.to).map(l => l.x);

// A snow drift along a roof or ledge, with a couple of humps, and icicles under the edge.
function snowCap(g, x, top, width, seed) {
  g.fillStyle(SNOW);
  g.fillRect(x - 1, top - 3, width + 2, 3);
  g.fillCircle(x + 6, top - 3, 3);
  g.fillCircle(x + width - 8, top - 2.5, 2.5);
  g.fillStyle(SNOW_SHADE);
  g.fillRect(x - 1, top - 1, width + 2, 1);
  icicles(g, x, top + 2, width, seed);
}

function icicles(g, x, y, width, seed) {
  g.fillStyle(ICICLE);
  for (let ix = x + 2; ix < x + width - 2; ix += 5) {
    const r = hash(ix * 0.37 + seed);
    if (r < 0.45) continue;
    g.fillTriangle(ix, y, ix + 2, y, ix + 1, y + 2 + Math.round(r * 3));
  }
}

// Chimney with a snow cap and a slow plume of steam.
function chimney(g, x, top, elapsed) {
  g.fillStyle(CHIMNEY);
  g.fillRect(x, top - 12, 5, 12);
  g.fillStyle(SNOW);
  g.fillRect(x - 1, top - 14, 7, 2);
  for (let i = 0; i < 3; i++) {
    const t = (elapsed * 0.35 + i / 3 + x * 0.01) % 1;
    g.fillStyle(0xeef3f6, 0.55 * (1 - t));
    g.fillCircle(x + 2.5 + t * 5, top - 16 - t * 14, 2 + t * 2.5);
  }
}

// kind 0: shop with a snowy timber awning; 1: apartments with snowy balconies; 2: office with frosted
// glass bands. All share the slate facade, a cornice, a snow-covered roof and a centred door.
function drawSnowStreetBuilding(g, x, y, width, height, kind, facade, roll, elapsed) {
  const top = y - height;
  g.fillStyle(facade);
  g.fillRect(x, top, width, height);
  g.fillStyle(lerpColor(facade, 0x000000, 0.1));
  g.fillRect(x + width - 4, top, 4, height);
  g.fillStyle(lerpColor(facade, 0x000000, 0.22));
  g.fillRect(x - 1, top, width + 2, 2);

  if (kind === 2) {
    for (let wy = top + 6; wy < y - 16; wy += 8) {
      g.fillStyle(FROST_GLASS);
      g.fillRect(x + 4, wy, width - 9, 4);
      g.fillStyle(0xffffff, 0.5);
      g.fillRect(x + 4, wy, 5, 4);
      g.fillStyle(SNOW);
      g.fillRect(x + 3, wy - 1, width - 7, 1);
    }
  } else if (kind === 1) {
    for (let wy = top + 6, row = 0; wy < y - 18; wy += 10, row++) {
      for (let wx = x + 4; wx < x + width - 9; wx += 7) {
        g.fillStyle(hash(wx * 0.31 + wy) > 0.8 ? LAMP : FROST_GLASS);
        g.fillRect(wx, wy, 3, 5);
      }
      if (hash(roll * 10 + row) > 0.5) {
        g.fillStyle(lerpColor(facade, 0x000000, 0.3));
        g.fillRect(x + 3, wy + 6, width - 10, 1);
        g.fillRect(x + 3, wy + 6, 1, 2);
        g.fillRect(x + width - 8, wy + 6, 1, 2);
        g.fillStyle(SNOW);
        g.fillRect(x + 3, wy + 5, width - 10, 1);
      }
    }
  } else {
    // Shop front: frosted glass with a warm glow, under a timber awning carrying snow and icicles.
    g.fillStyle(FROST_GLASS);
    g.fillRect(x + 4, y - 15, width - 9, 9);
    g.fillStyle(LAMP, 0.55);
    g.fillRect(x + 5, y - 14, width - 11, 7);
    g.fillStyle(TIMBER);
    g.fillRect(x + 2, y - 19, width - 5, 4);
    g.fillStyle(SNOW);
    g.fillRect(x + 2, y - 20, width - 5, 2);
    icicles(g, x + 2, y - 15, width - 5, roll * 7);
    for (let wy = top + 5; wy < y - 24; wy += 9) {
      for (let wx = x + 4; wx < x + width - 9; wx += 7) {
        g.fillStyle(hash(wx * 0.27 + wy) > 0.85 ? LAMP : FROST_GLASS);
        g.fillRect(wx, wy, 3, 4);
      }
    }
  }

  snowCap(g, x, top, width, roll * 13);
  if (roll > 0.55) chimney(g, x + width - 13, top - 2, elapsed);
  else if (roll > 0.25) {
    // Rooftop heating unit on legs, snowed over.
    g.fillStyle(0x6d7f88);
    g.fillRect(x + width - 16, top - 8, 2, 6);
    g.fillRect(x + width - 9, top - 8, 2, 6);
    g.fillRect(x + width - 17, top - 15, 11, 8);
    g.fillStyle(0x5b6b74);
    g.fillRect(x + width - 15, top - 13, 7, 1);
    g.fillRect(x + width - 15, top - 11, 7, 1);
    g.fillStyle(SNOW);
    g.fillRect(x + width - 18, top - 17, 13, 2);
  }

  // Centred door, at least person-height, with a warm lamp above; a shop's sits in its glass front.
  const cx = x + Math.round(width / 2);
  if (kind === 0) {
    g.fillStyle(0x5b6b74);
    g.fillRect(cx - 3, y - 13, 6, 13);
    g.fillStyle(FROST_GLASS);
    g.fillRect(cx - 2, y - 12, 4, 5);
  } else {
    g.fillStyle(TIMBER);
    g.fillRect(cx - 4, y - 12, 8, 12);
    g.fillStyle(lerpColor(TIMBER, 0x000000, 0.25));
    g.fillRect(cx, y - 12, 1, 12);
    g.fillStyle(LAMP);
    g.fillRect(cx - 1, y - 15, 2, 2);
  }
  // Snow banked against the walls.
  g.fillStyle(SNOW);
  g.fillRect(x - 1, y - 2, 5, 2);
  g.fillRect(x + width - 4, y - 2, 5, 2);
}

// Window grid for the high-rises: one glass block crossed by frame strips (cheap to redraw), with
// lit panes worked out once per tower and cached.
const SNOW_LIT = new Map();
function snowWindows(g, left, top, cols, rows, frame, seed) {
  const width = (cols - 1) * 7 + 4;
  const height = (rows - 1) * 8 + 4;
  g.fillStyle(FROST_GLASS);
  g.fillRect(left, top, width, height);
  g.fillStyle(frame);
  for (let i = 1; i < cols; i++) g.fillRect(left + i * 7 - 3, top, 3, height);
  for (let i = 1; i < rows; i++) g.fillRect(left, top + i * 8 - 4, width, 4);
  const key = `${cols},${rows},${seed}`;
  if (!SNOW_LIT.has(key)) {
    const lit = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (hash(seed + c * 0.29 + r * 0.071) > 0.9) lit.push(c, r);
    SNOW_LIT.set(key, lit);
  }
  const lit = SNOW_LIT.get(key);
  g.fillStyle(LAMP);
  for (let i = 0; i < lit.length; i += 2) g.fillRect(left + lit[i] * 7, top + lit[i + 1] * 8, 4, 4);
}

// High-rise: a window grid under two snowy setbacks and a snow-covered pyramid cap, with an aerial and
// a beacon, an icicled ledge partway up and a sheltered lobby.
function drawSnowTower(g, x, y, width, height, body, seed, elapsed) {
  const top = y - height;
  const left = Math.round(x - width / 2);
  const crown = Math.round(width * 0.72);
  const step = Math.round(width * 0.44);
  const shade = lerpColor(body, 0x000000, 0.12);
  g.fillStyle(body);
  g.fillRect(left, top, width, height);
  g.fillRect(Math.round(x - crown / 2), top - 26, crown, 26);
  g.fillRect(Math.round(x - step / 2), top - 40, step, 14);
  g.fillStyle(shade);
  g.fillRect(left + width - 4, top, 4, height);
  g.fillRect(Math.round(x + crown / 2) - 3, top - 26, 3, 26);
  const cols = Math.floor((width - 12) / 7) + 1;
  snowWindows(g, left + 5, top + 6, cols, Math.floor((height - 30) / 8), body, seed);
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(left + 2, top, 3, height);
  // Pyramid cap: snow on the sunlit side, shaded snow on the other.
  const capY = top - 40;
  g.fillStyle(SNOW);
  g.fillTriangle(x - step / 2 - 1, capY, x, capY - 18, x, capY);
  g.fillStyle(SNOW_SHADE);
  g.fillTriangle(x, capY, x, capY - 18, x + step / 2 + 1, capY);
  g.fillStyle(0xb9c2c7);
  g.fillRect(Math.round(x) - 1, capY - 42, 2, 24);
  g.fillStyle(0xd9776b, 0.4 + 0.6 * (Math.sin(elapsed * 2.5 + x) > 0));
  g.fillCircle(Math.round(x), capY - 43, 2.5);
  // Snow on each setback.
  snowCap(g, left, top, width, seed);
  snowCap(g, Math.round(x - crown / 2), top - 26, crown, seed + 1);
  // Ledge partway up, carrying snow and icicles.
  const ledge = Math.round(top + height * 0.45);
  g.fillStyle(lerpColor(body, 0x000000, 0.25));
  g.fillRect(left - 1, ledge, width + 2, 2);
  g.fillStyle(SNOW);
  g.fillRect(left - 1, ledge - 1, width + 2, 1);
  icicles(g, left, ledge + 2, width, seed + 2);
  // Lobby: dark base, warm-lit glass doors, a canopy under snow.
  g.fillStyle(lerpColor(body, 0x000000, 0.3));
  g.fillRect(left, y - 16, width, 16);
  g.fillStyle(LAMP, 0.6);
  g.fillRect(left + 3, y - 12, width - 7, 6);
  g.fillStyle(lerpColor(body, 0x000000, 0.45));
  g.fillRect(Math.round(x) - 5, y - 13, 10, 13);
  g.fillStyle(FROST_GLASS);
  g.fillRect(Math.round(x) - 4, y - 12, 3, 11);
  g.fillRect(Math.round(x) + 1, y - 12, 3, 11);
  g.fillStyle(TIMBER);
  g.fillRect(Math.round(x) - 9, y - 17, 18, 3);
  g.fillStyle(SNOW);
  g.fillRect(Math.round(x) - 9, y - 18, 18, 1.5);
}

// Skyline rows behind Snow City: flat, pale, icy blocks with no detail, scrolling slower than the
// street and pivoting on the city centre, so they read as distance (same rules as Green City's).
const SNOW_SKYLINE_STEP = 40;
function eachSnowSkylineColumn(left, right, cameraX, parallax, draw) {
  const shift = (cameraX - nearest((SNOW_CITY.from + SNOW_CITY.to) / 2, cameraX)) * (1 - parallax);
  for (let i = Math.floor((left - shift) / SNOW_SKYLINE_STEP) - 1; i * SNOW_SKYLINE_STEP + shift < right + SNOW_SKYLINE_STEP; i++) {
    const wx = wrapX(i * SNOW_SKYLINE_STEP);
    const x = i * SNOW_SKYLINE_STEP + shift;
    const ground = wrapX(x);
    const fade = skylineFade(wx, ground, SNOW_CITY.from, SNOW_CITY.to);
    if (fade <= 0) continue;
    draw(x, Math.round(wx / SNOW_SKYLINE_STEP), ground, fade);
  }
}

function drawSnowSkyline(g, left, right, seaY, cameraX) {
  eachSnowSkylineColumn(left, right, cameraX, 0.85, (x, seed, ground, fade) => {
    if (hash(seed + 0.75) <= 0.3) return;
    const y = frostlandBase(ground, seaY);
    const far = (50 + hash(seed) * 90) * CITY_SCALE;
    g.fillStyle(0xb9cbd7, fade);
    g.fillRect(x, y - far, 30, far);
    g.fillStyle(0xc9d9e3, fade);
    g.fillRect(x + 3, y - far, 4, far);
  });
  const reach = 160 * CITY_SCALE;
  eachSnowSkylineColumn(left, right, cameraX, 0.93, (x, seed, ground, fade) => {
    if (hash(seed + 0.5) < 0.25) return;
    const nx = x + 6 + Math.round(hash(seed + 0.25) * 8);
    const centre = wrapX(nx + 13);
    const clearance = Math.min(...SNOW_LANDMARK_XS.map(lx => Math.abs(centre - lx)));
    const alpha = fade * Math.min(1, Math.max(0, (clearance - reach * 0.5) / (reach * 0.3)));
    if (alpha <= 0) return;
    const y = frostlandBase(ground, seaY);
    const near = (28 + hash(seed + 0.5) * 50) * CITY_SCALE;
    g.fillStyle(0xa5b8c6, alpha);
    g.fillRect(nx, y - near, 26, near);
    g.fillStyle(0xb5c7d3, alpha);
    g.fillRect(nx + 3, y - near, 4, near);
  });
}

// Snowy gable roof over a building: dark shingles, snow down the sunlit side and along the eaves,
// icicles beneath. Returns the ridge height above top.
function snowyGable(g, left, top, width, rise, shingle, seed) {
  const x = left + width / 2;
  g.fillStyle(shingle);
  g.fillTriangle(left - 4, top, x, top - rise, left + width + 4, top);
  g.fillStyle(SNOW);
  g.fillTriangle(left - 4, top, x, top - rise, x, top - rise * 0.35);
  g.fillRect(left - 4, top - 2, width + 8, 2);
  g.fillStyle(SNOW_SHADE);
  g.fillTriangle(x, top - rise, left + width + 4, top, x, top - rise * 0.35);
  icicles(g, left - 4, top, width + 8, seed);
}

// A small warm window with a cross mullion and, if asked, shutters.
function cabinWindow(g, x, y, w, h, frame, shutters) {
  g.fillStyle(frame);
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle(LAMP);
  g.fillRect(x, y, w, h);
  g.fillStyle(frame);
  g.fillRect(x + Math.floor(w / 2), y, 1, h);
  g.fillRect(x, y + Math.floor(h / 2), w, 1);
  if (shutters) {
    g.fillStyle(lerpColor(frame, 0x000000, 0.2));
    g.fillRect(x - 3, y - 1, 2, h + 2);
    g.fillRect(x + w + 1, y - 1, 2, h + 2);
  }
  g.fillStyle(SNOW);
  g.fillRect(x - 1, y + h + 1, w + 2, 1);
}

function woodpile(g, x, y) {
  g.fillStyle(0x6b4e34);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3 - r; c++) g.fillCircle(x + c * 3 + r * 1.5, y - 1.5 - r * 3, 1.5);
  g.fillStyle(0xc8a878);
  g.fillCircle(x, y - 1.5, 0.6);
  g.fillCircle(x + 3, y - 1.5, 0.6);
  g.fillStyle(SNOW);
  g.fillRect(x - 1.5, y - 7, 8, 1.5);
}

// Pine Woods: variant 0 log cabin with a porch, 1 A-frame cabin, 2 board-and-batten woodshed hut.
function drawPineCabin(g, x, y, width, height, variant, seed) {
  footing(g, x, y, width + 4, TIMBER_DARK);
  const left = x - width / 2;
  const top = y - height;
  if (variant === 1) {
    // A-frame: the roof comes down to the ground, a glazed gable front, and a deck.
    const half = width / 2 + 3;
    const peak = y - height - 16;
    g.fillStyle(0x3e4a3c);
    g.fillTriangle(x - half, y, x, peak, x + half, y);
    g.fillStyle(SNOW);
    g.fillTriangle(x - half, y, x, peak, x - half * 0.45, y - (y - peak) * 0.45);
    g.fillStyle(0x7a5a3c);
    g.fillTriangle(x - half + 6, y, x, peak + 8, x + half - 6, y);
    g.fillStyle(LAMP, 0.9);
    g.fillTriangle(x - half * 0.4, y - 16, x, peak + 14, x + half * 0.4, y - 16);
    g.fillStyle(0x4e3824);
    g.fillRect(x - half * 0.4, y - 17, half * 0.8, 1);
    g.fillRect(x - 0.5, peak + 14, 1, y - 16 - peak - 14);
    g.fillStyle(0x4e3824);
    g.fillRect(x - 4, y - 14, 8, 14);
    g.fillStyle(0x8a6a48);
    g.fillRect(x - half + 2, y - 3, half * 2 - 4, 2);
    g.fillStyle(SNOW);
    g.fillRect(x - half + 2, y - 4, half * 2 - 4, 1);
    woodpile(g, x + half - 8, y - 3);
    return;
  }
  if (variant === 2) {
    // Woodshed hut: vertical boards under a single-pitch roof, a lantern and a log pile.
    g.fillStyle(0x5e4a36);
    g.fillRect(left, top + 4, width, height - 4);
    g.fillStyle(0x4a3828);
    for (let bx = left + 3; bx < left + width; bx += 4) g.fillRect(bx, top + 4, 1, height - 4);
    g.fillStyle(0x34302c);
    g.fillTriangle(left - 4, top + 4, left - 4, top - 6, left + width + 4, top + 4);
    g.fillStyle(SNOW);
    g.fillTriangle(left - 4, top + 1, left - 4, top - 8, left + width + 4, top + 1);
    icicles(g, left - 4, top + 5, width + 8, seed);
    cabinWindow(g, left + 4, top + 10, 5, 5, 0x3a2c20, false);
    g.fillStyle(0x3a2c20);
    g.fillRect(x - 4, y - 14, 8, 14);
    g.fillStyle(0x6b5446);
    g.fillRect(x - 3, y - 13, 6, 13);
    g.fillStyle(LAMP);
    g.fillRect(x + 6, y - 16, 2, 3);
    woodpile(g, left + width - 9, y);
    return;
  }
  // Log cabin: stacked logs with round ends at the corners, a snowy gable, stone chimney and porch.
  g.fillStyle(0x6b4e34);
  g.fillRect(left, top, width, height);
  g.fillStyle(0x4e3824);
  for (let ly = top + 5; ly < y; ly += 5) g.fillRect(left, ly, width, 1);
  g.fillStyle(0x8a6a48);
  for (let ly = top + 2.5; ly < y; ly += 5) {
    g.fillCircle(left, ly, 2);
    g.fillCircle(left + width, ly, 2);
  }
  g.fillStyle(0x6e6e72);
  g.fillRect(left + width - 9, top - 18, 6, 18);
  g.fillStyle(0x56565a);
  g.fillRect(left + width - 9, top - 12, 6, 1);
  g.fillRect(left + width - 9, top - 6, 6, 1);
  snowyGable(g, left, top, width, Math.round(width * 0.42), 0x3e4a3c, seed);
  g.fillStyle(SNOW);
  g.fillRect(left + width - 10, top - 20, 8, 2);
  g.fillStyle(0xeef3f6, 0.5);
  g.fillCircle(left + width - 5, top - 25, 3);
  g.fillCircle(left + width - 2, top - 31, 4);
  cabinWindow(g, left + 4, top + 7, 6, 6, 0x3a2c20, true);
  if (width > 30) cabinWindow(g, left + width - 11, top + 7, 6, 6, 0x3a2c20, true);
  // Porch: a lean-to roof on two posts over the centred door.
  g.fillStyle(0x3a2c20);
  g.fillRect(x - 4, y - 14, 8, 14);
  g.fillStyle(0x5a4030);
  g.fillRect(x - 3, y - 13, 6, 13);
  g.fillStyle(0x8a6a48);
  g.fillRect(x - 9, y - 18, 18, 2);
  g.fillRect(x - 9, y - 16, 1, 16);
  g.fillRect(x + 8, y - 16, 1, 16);
  g.fillStyle(SNOW);
  g.fillRect(x - 9, y - 19, 18, 1);
  g.fillStyle(LAMP);
  g.fillRect(x + 5, y - 15, 2, 2);
  woodpile(g, left - 8, y);
}

// Birchwood: painted Nordic timber houses. variant 0 cottage, 1 two-storey house, 2 sauna, 3 tavern.
const BIRCH_PAINTS = [0x8a3e32, 0xb08a4a, 0xd8d2c4, 0x5e6e6a];
function drawBirchwoodHouse(g, x, y, width, height, variant, paint, seed) {
  footing(g, x, y, width + 4, 0x5a5652);
  const left = x - width / 2;
  const top = y - height;
  const trim = paint === 0xd8d2c4 ? 0x6b5446 : 0xf0ece4;
  const board = lerpColor(paint, 0x000000, 0.15);
  g.fillStyle(paint);
  g.fillRect(left, top, width, height);
  g.fillStyle(board);
  for (let bx = left + 3; bx < left + width - 1; bx += 3) g.fillRect(bx, top, 1, height);
  g.fillStyle(lerpColor(paint, 0x000000, 0.1));
  g.fillRect(left + width - 3, top, 3, height);
  // Corner boards and a stone plinth.
  g.fillStyle(trim);
  g.fillRect(left, top, 2, height);
  g.fillRect(left + width - 2, top, 2, height);
  g.fillStyle(0x7a7672);
  g.fillRect(left - 1, y - 3, width + 2, 3);

  const rise = Math.round(width * (variant === 2 ? 0.3 : 0.5));
  snowyGable(g, left, top, width, rise, 0x3a3e44, seed);
  // Round attic window in the gable.
  if (variant !== 2) {
    g.fillStyle(trim);
    g.fillCircle(x, top - rise * 0.3, 2.5);
    g.fillStyle(LAMP);
    g.fillCircle(x, top - rise * 0.3, 1.5);
  }
  // Chimney with smoke on houses, sauna and tavern.
  if (variant !== 0 || hash(seed) > 0.5) {
    const cx = x + width * 0.22;
    g.fillStyle(0x76686a);
    g.fillRect(cx, top - rise * 0.6 - 6, 4, rise * 0.6 + 6);
    g.fillStyle(SNOW);
    g.fillRect(cx - 1, top - rise * 0.6 - 8, 6, 2);
    g.fillStyle(0xeef3f6, variant === 2 ? 0.7 : 0.45);
    g.fillCircle(cx + 2, top - rise * 0.6 - 12, 3);
    g.fillCircle(cx + 5, top - rise * 0.6 - 18, 4);
  }
  // Windows: one row, or two on the two-storey house and tavern.
  const rows = variant === 1 || variant === 3 ? [top + 5, top + height * 0.5] : [top + 6];
  for (const wy of rows) {
    for (const wx of [left + 4, left + width - 10]) cabinWindow(g, wx, wy, 6, 6, trim, false);
  }
  if (variant === 3) {
    // Tavern: a hanging sign with a gold tankard, lanterns and a bench out front.
    g.fillStyle(0x3a2c20);
    g.fillRect(left - 6, top + 10, 8, 1);
    g.fillRect(left - 5, top + 11, 6, 6);
    g.fillStyle(LANDMARK_GOLD);
    g.fillRect(left - 4, top + 12, 3, 4);
    g.fillRect(left - 1, top + 13, 1, 2);
    for (const lx of [x - 9, x + 8]) {
      g.fillStyle(LAMP);
      g.fillRect(lx, y - 16, 2, 3);
    }
    g.fillStyle(0x6b4e34);
    g.fillRect(left + width - 14, y - 6, 10, 1);
    g.fillRect(left + width - 13, y - 5, 1, 5);
    g.fillRect(left + width - 6, y - 5, 1, 5);
  }
  // Centred door with a step, a frame and a lamp above.
  const door = lerpColor(paint, 0x000000, 0.45);
  g.fillStyle(trim);
  g.fillRect(x - 5, y - 15, 10, 15);
  g.fillStyle(door);
  g.fillRect(x - 4, y - 14, 8, 14);
  g.fillStyle(LAMP);
  g.fillRect(x - 1, y - 18, 2, 2);
  g.fillStyle(SNOW);
  g.fillRect(x - 6, y - 1, 12, 1);
}

// Whale Harbor: a Nordic fishing port. variant 0 boathouse/warehouse with a hoist, 1 fish shop with
// an awning and crates, 2 step-gabled harbour house. Each has dockside props beside it.
const HARBOR_PAINTS = [0x3a3634, 0x8a3e32, 0xb08a4a, 0x6a7a84, 0xd8d2c4];
function drawWhaleHarborBuilding(g, x, y, width, height, variant, paint, seed) {
  footing(g, x, y, width + 6, 0x4a4844);
  const left = x - width / 2;
  const top = y - height;
  const dark = paint === 0x3a3634;
  const trim = dark || paint === 0x8a3e32 ? 0xe8e2d6 : 0x4a3c34;
  g.fillStyle(paint);
  g.fillRect(left, top, width, height);
  g.fillStyle(lerpColor(paint, 0x000000, 0.15));
  if (variant !== 2) for (let bx = left + 3; bx < left + width - 1; bx += 4) g.fillRect(bx, top, 1, height);
  g.fillRect(left + width - 4, top, 4, height);
  g.fillStyle(0x7a7672);
  g.fillRect(left - 1, y - 4, width + 2, 4);

  if (variant === 2) {
    // Step gable: stone steps up to a peak, each carrying snow.
    const steps = 4;
    const stepW = width / (steps * 2);
    for (let s = 0; s < steps; s++) {
      const sy = top - (s + 1) * 6;
      g.fillStyle(paint);
      g.fillRect(left + s * stepW, sy, width - s * stepW * 2, 6);
      g.fillStyle(SNOW);
      g.fillRect(left + s * stepW - 1, sy - 1.5, stepW + 1, 1.5);
      g.fillRect(left + width - (s + 1) * stepW, sy - 1.5, stepW + 1, 1.5);
    }
    g.fillStyle(SNOW);
    g.fillRect(x - stepW, top - steps * 6 - 1.5, stepW * 2, 1.5);
    g.fillStyle(trim);
    g.fillCircle(x, top - 10, 2.5);
    g.fillStyle(LAMP);
    g.fillCircle(x, top - 10, 1.5);
    for (let wy = top + 6; wy < y - 22; wy += 12) {
      for (let wx = left + 4; wx < left + width - 8; wx += 8) cabinWindow(g, wx, wy, 4, 6, trim, false);
    }
  } else {
    const rise = Math.round(width * 0.45);
    snowyGable(g, left, top, width, rise, 0x34383c, seed);
    if (variant === 0) {
      // Hoist beam out of the gable with a rope and a crate.
      g.fillStyle(0x6b5446);
      g.fillRect(x - 1, top - rise * 0.55, 14, 2);
      g.fillStyle(0xc8b890);
      g.fillRect(x + 11, top - rise * 0.55 + 2, 1, 14);
      g.fillStyle(0x8a6a48);
      g.fillRect(x + 8, top - rise * 0.55 + 16, 7, 6);
      g.fillStyle(0x5a4030);
      g.fillRect(x + 8, top - rise * 0.55 + 18, 7, 1);
      // Loft door and side windows.
      g.fillStyle(trim);
      g.fillRect(x - 5, top + 4, 10, 10);
      g.fillStyle(lerpColor(paint, 0x000000, 0.35));
      g.fillRect(x - 4, top + 5, 8, 9);
      for (let wy = top + 18; wy < y - 24; wy += 12) {
        cabinWindow(g, left + 4, wy, 5, 6, trim, false);
        cabinWindow(g, left + width - 10, wy, 5, 6, trim, false);
      }
    } else {
      // Fish shop: a warm-lit window, an awning in muted stripes under snow, a fish sign and crates.
      g.fillStyle(FROST_GLASS);
      g.fillRect(left + 4, y - 17, width - 9, 10);
      g.fillStyle(LAMP, 0.6);
      g.fillRect(left + 5, y - 16, width - 11, 8);
      for (let ax = left + 2, i = 0; ax < left + width - 3; ax += 4, i++) {
        g.fillStyle(i % 2 ? 0xe8e2d6 : 0x5e7a86);
        g.fillRect(ax, y - 22, 4, 4);
      }
      g.fillStyle(SNOW);
      g.fillRect(left + 2, y - 23, width - 5, 1.5);
      icicles(g, left + 2, y - 18, width - 5, seed + 1);
      g.fillStyle(trim);
      g.fillRect(x - 8, top + 4, 16, 7);
      g.fillStyle(0x6a8a9a);
      g.fillTriangle(x - 5, top + 7.5, x + 3, top + 5.5, x + 3, top + 9.5);
      g.fillTriangle(x + 3, top + 7.5, x + 6, top + 5.5, x + 6, top + 9.5);
      for (let wy = top + 14; wy < y - 28; wy += 11) cabinWindow(g, left + 5, wy, 5, 5, trim, false);
      g.fillStyle(0x8a6a48);
      g.fillRect(left + width + 1, y - 6, 7, 6);
      g.fillStyle(0xb8c8d0);
      g.fillRect(left + width + 2, y - 7, 5, 1.5);
    }
  }
  // Centred door, at least person-height, with a lamp; the boathouse gets a wide freight door.
  const doorHalf = variant === 0 ? 7 : 4;
  g.fillStyle(trim);
  g.fillRect(x - doorHalf - 1, y - 17, doorHalf * 2 + 2, 17);
  g.fillStyle(lerpColor(paint, 0x000000, 0.45));
  g.fillRect(x - doorHalf, y - 16, doorHalf * 2, 16);
  if (variant === 0) {
    g.fillStyle(lerpColor(paint, 0x000000, 0.25));
    g.lineStyle(1, lerpColor(paint, 0x000000, 0.25));
    g.lineBetween(x - doorHalf, y - 16, x, y - 8);
    g.lineBetween(x + doorHalf, y - 16, x, y - 8);
  }
  g.fillStyle(LAMP);
  g.fillRect(x + doorHalf + 2, y - 18, 2, 3);
  // Dockside props: a bollard and a rope coil, or a stack of lobster traps.
  if (hash(seed + 5) > 0.5) {
    g.fillStyle(0x2e3034);
    g.fillRect(left - 9, y - 6, 4, 6);
    g.fillRect(left - 10, y - 7, 6, 2);
    g.fillStyle(0xc8b890);
    g.fillCircle(left - 14, y - 2, 2.5);
    g.fillStyle(0x8a7a5a);
    g.fillCircle(left - 14, y - 2, 1);
  } else {
    g.fillStyle(0x6b5446);
    g.fillRect(left - 13, y - 5, 8, 5);
    g.fillRect(left - 12, y - 9, 6, 4);
    g.fillStyle(0x3a2c20);
    for (let tx = left - 12; tx < left - 5; tx += 2) g.fillRect(tx, y - 9, 1, 9);
    g.fillStyle(SNOW);
    g.fillRect(left - 12, y - 10, 6, 1);
  }
}

// Ember Base around the citadel: watchtowers at the gates, barracks, gun pits, a hangar and a fuel
// depot. Gun pits carry the base's live guns (EMBER_GUN_MOUNTS); soldiers come out of the barracks
// (EMBER_BARRACKS). Both are manned by enemy-response.js.
const EMBER_BASE_PLAN = [
  [63220, 'gate'], [63300, 'tower'], [63370, 'gunpit'], [63620, 'gunpit'], [63720, 'barracks'],
  [63830, 'gunpit'], [63950, 'gunpit'], [64130, 'gunpit'], [64620, 'gunpit'],
  [64690, 'gunpit'], [64880, 'hangar'], [65060, 'gunpit'], [65150, 'gunpit'],
  [65230, 'fuel'], [65310, 'tower'], [65370, 'gate'],
];
const EMBER_ART = { gate: [34, 58], tower: [26, 64], barracks: [70, 26], gunpit: [44, 20], hangar: [90, 44], fuel: [60, 30] };
// Art px to the top of a gun pit, where its gun sits.
const GUNPIT_TOP = 20;
// Live guns: x, height above the ground in world px, and kind (tank cannon or anti-aircraft gun).
export const EMBER_GUN_MOUNTS = Object.freeze([
  { x: 63370, height: GUNPIT_TOP * CITY_SCALE, kind: 'aa' },
  { x: 63620, height: GUNPIT_TOP * CITY_SCALE, kind: 'tank' },
  { x: 63830, height: GUNPIT_TOP * CITY_SCALE, kind: 'aa' },
  { x: 63950, height: GUNPIT_TOP * CITY_SCALE, kind: 'tank' },
  { x: 64130, height: GUNPIT_TOP * CITY_SCALE, kind: 'aa' },
  { x: 64400, height: (CITADEL_ROOF + 7) * CITY_SCALE, kind: 'tank' },
  ...[-1, 1].map(side => ({ x: 64400 + side * 101 * CITY_SCALE,
    height: 112 * CITY_SCALE, kind: 'sponson', side, supportX: 64400 + side * 92 * CITY_SCALE })),
  { x: 64620, height: GUNPIT_TOP * CITY_SCALE, kind: 'tank' },
  { x: 64690, height: GUNPIT_TOP * CITY_SCALE, kind: 'aa' },
  { x: 65060, height: GUNPIT_TOP * CITY_SCALE, kind: 'tank' },
  { x: 65150, height: GUNPIT_TOP * CITY_SCALE, kind: 'aa' },
].map(Object.freeze));
export const EMBER_BARRACKS = Object.freeze([63720, 64880]);
export const EMBER_BASE_ZONE = Object.freeze({ from: 63200, to: 65400 });
// Checkpoints at the base's west and east ends: only military traffic and personnel pass between them.
export const EMBER_GATES = Object.freeze([63220, 65370]);

function sandbags(g, x, y, count, rows) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < count; c++) {
      g.fillStyle(r % 2 ? 0x9a8a68 : 0x8a7a5a);
      g.fillRect(x + c * 5 + (r % 2) * 2, y - 4 - r * 4, 5, 4);
    }
  }
  g.fillStyle(SNOW);
  g.fillRect(x, y - 1 - rows * 4, count * 5 + 2, 1);
}

function drawEmberBaseBuilding(g, x, y, kind, seed) {
  const [width, height] = EMBER_ART[kind];
  const left = x - width / 2;
  const top = y - height;
  footing(g, x, y, width + 4, 0x3a3a3e);
  if (kind === 'gate') {
    // Checkpoint: a guard booth with a sentry at the window, a red-and-white barrier arm swung down
    // across the road on the outside, concrete blocks, a stop sign, a floodlight and sandbags.
    const out = x < 64400 ? -1 : 1;
    g.fillStyle(MIL_CONCRETE);
    g.fillRect(left + 2, y - 28, width - 4, 28);
    g.fillStyle(MIL_CONCRETE_SHADE);
    g.fillRect(x + 6, y - 28, width / 2 - 8, 28);
    hazardStripes(g, left + 2, y - 31, width - 4, 3);
    g.fillStyle(MIL_STEEL);
    g.fillRect(left, y - 33, width, 2);
    g.fillStyle(SNOW);
    g.fillRect(left - 1, y - 35, width + 2, 2);
    icicles(g, left, y - 31, width, seed);
    for (const wx of [left + 4, left + width - 12]) {
      g.fillStyle(MIL_TINT);
      g.fillRect(wx, y - 24, 8, 8);
      g.fillStyle(LAMP, 0.55);
      g.fillRect(wx + 1, y - 23, 6, 6);
      // A sentry's helmeted head at the window.
      g.fillStyle(MIL_OLIVE_DARK);
      g.fillCircle(wx + 4, y - 19, 2);
      g.fillRect(wx + 2, y - 17, 4, 1);
    }
    g.fillStyle(MIL_STEEL);
    g.fillRect(x - 4, y - 15, 8, 15);
    g.fillStyle(0x4a4e52);
    g.fillRect(x - 3, y - 14, 6, 14);
    // Floodlight pole on the inside.
    const pole = x - out * (width / 2 + 3);
    g.fillStyle(0x5a5e62);
    g.fillRect(pole, y - 58, 2, 58);
    g.fillRect(pole - 4, y - 58, 10, 3);
    g.fillStyle(0xfff6d0);
    g.fillRect(pole - 3, y - 55, 8, 1);
    // Barrier: post, counterweight and the striped arm across the road on the outside.
    const post = x + out * (width / 2 + 2);
    g.fillStyle(MIL_STEEL);
    g.fillRect(post - 2, y - 14, 4, 14);
    g.fillRect(post - out * 7 - 2, y - 13, 5, 4);
    for (let i = 0; i < 9; i++) {
      g.fillStyle(i % 2 ? 0xe8e2d6 : MIL_RED);
      g.fillRect(out > 0 ? post + i * 5 : post - (i + 1) * 5, y - 12, 5, 2);
    }
    g.fillStyle(MIL_RED);
    g.fillCircle(post + out * 45, y - 11, 1.2);
    // Jersey blocks and the stop sign further out.
    g.fillStyle(MIL_CONCRETE_LIGHT);
    for (const d of [52, 64]) {
      const bx = post + out * d;
      g.fillRect(bx - 4, y - 6, 8, 6);
      g.fillTriangle(bx - 6, y, bx - 4, y - 6, bx - 4, y);
      g.fillTriangle(bx + 6, y, bx + 4, y - 6, bx + 4, y);
      g.fillStyle(MIL_HAZARD);
      g.fillRect(bx - 4, y - 4, 8, 1);
      g.fillStyle(MIL_CONCRETE_LIGHT);
    }
    const sign = post + out * 76;
    g.fillStyle(0x5a5e62);
    g.fillRect(sign, y - 20, 1, 20);
    g.fillStyle(MIL_RED);
    g.fillCircle(sign, y - 23, 4);
    g.fillStyle(0xf0ece4);
    g.fillRect(sign - 2.5, y - 23.5, 5, 1);
    sandbags(g, x - out * (width / 2 + 14) - 6, y, 3, 2);
    return;
  }
  if (kind === 'tower') {
    // Watchtower: braced legs, a cabin with windows and a searchlight, a ladder to the door.
    g.fillStyle(0x5a4a3a);
    g.fillRect(left + 2, top + 18, 2, height - 18);
    g.fillRect(left + width - 4, top + 18, 2, height - 18);
    g.lineStyle(1, 0x5a4a3a);
    for (let by = top + 22; by < y - 6; by += 14) {
      g.lineBetween(left + 3, by, left + width - 3, by + 14);
      g.lineBetween(left + width - 3, by, left + 3, by + 14);
    }
    g.fillStyle(MIL_OLIVE);
    g.fillRect(left - 2, top + 4, width + 4, 16);
    g.fillStyle(MIL_TINT);
    g.fillRect(left + 1, top + 8, width - 2, 6);
    g.fillStyle(LAMP, 0.5);
    g.fillRect(left + 4, top + 9, 4, 4);
    g.fillStyle(0x34383c);
    g.fillTriangle(left - 5, top + 4, x, top - 4, left + width + 5, top + 4);
    g.fillStyle(SNOW);
    g.fillTriangle(left - 5, top + 4, x, top - 4, x, top);
    g.fillStyle(0x2e3034);
    g.fillRect(left + width + 1, top + 6, 5, 4);
    g.fillStyle(0xfff6d0);
    g.fillRect(left + width + 5, top + 7, 1, 2);
    g.fillStyle(0x6b5446);
    g.fillRect(x - 3, top + 20, 1, height - 20);
    g.fillRect(x + 2, top + 20, 1, height - 20);
    for (let ly = top + 23; ly < y; ly += 4) g.fillRect(x - 3, ly, 6, 1);
    g.fillStyle(0x2a2c2e);
    g.fillRect(x - 4, y - 14, 8, 14);
    sandbags(g, left - 8, y, 3, 2);
    return;
  }
  if (kind === 'barracks') {
    // Quonset hut: a ribbed half-barrel with snow on the crown, a door, windows and supply crates.
    g.fillStyle(0x6e7458);
    g.fillRect(left, top + 10, width, height - 10);
    g.fillCircle(left + 10, top + 10, 10);
    g.fillCircle(left + width - 10, top + 10, 10);
    g.fillRect(left + 10, top, width - 20, 10);
    g.fillStyle(0x5e6448);
    for (let rx = left + 6; rx < left + width - 4; rx += 7) g.fillRect(rx, top + 2, 1, height - 2);
    g.fillStyle(SNOW);
    g.fillRect(left + 8, top - 2, width - 16, 3);
    g.fillCircle(left + 10, top + 1, 3);
    g.fillCircle(left + width - 10, top + 1, 3);
    for (const wx of [left + 8, left + 20, left + width - 26, left + width - 14]) {
      g.fillStyle(MIL_TINT);
      g.fillRect(wx, y - 16, 6, 5);
      g.fillStyle(LAMP, 0.55);
      g.fillRect(wx + 1, y - 15, 4, 3);
    }
    g.fillStyle(MIL_STEEL);
    g.fillRect(x - 5, y - 16, 10, 16);
    g.fillStyle(0x4a4e52);
    g.fillRect(x - 4, y - 15, 8, 15);
    g.fillStyle(LAMP);
    g.fillRect(x - 1, y - 19, 2, 2);
    g.fillStyle(MIL_OLIVE_DARK);
    g.fillRect(left + width + 2, y - 8, 14, 8);
    g.fillStyle(MIL_OLIVE);
    g.fillRect(left + width + 4, y - 14, 10, 6);
    sandbags(g, left - 14, y, 3, 2);
    return;
  }
  if (kind === 'gunpit') {
    // Gun pit: a concrete ring behind sandbags, ammo crates, a hatch; the live gun sits on top.
    g.fillStyle(MIL_CONCRETE);
    g.fillRect(left + 4, top + 4, width - 8, height - 4);
    g.fillTriangle(left, y, left + 4, top + 4, left + 4, y);
    g.fillTriangle(left + width, y, left + width - 4, top + 4, left + width - 4, y);
    g.fillStyle(MIL_CONCRETE_SHADE);
    g.fillRect(x + 8, top + 4, width / 2 - 12, height - 4);
    g.fillStyle(MIL_STEEL);
    g.fillRect(left + 6, top, width - 12, 4);
    g.fillStyle(MIL_HAZARD);
    g.fillRect(left + 6, top, width - 12, 1);
    g.fillStyle(0x1c1e20);
    g.fillRect(left + 9, top + 9, 8, 2);
    g.fillRect(left + width - 17, top + 9, 8, 2);
    g.fillStyle(0x2a2c2e);
    g.fillRect(x - 4, y - 14, 8, 14);
    sandbags(g, left - 10, y, 2, 3);
    g.fillStyle(MIL_OLIVE);
    g.fillRect(left + width + 2, y - 6, 8, 6);
    g.fillRect(left + width + 3, y - 11, 6, 5);
    g.fillStyle(MIL_HAZARD);
    g.fillRect(left + width + 4, y - 4, 4, 1);
    snowCap(g, left + 4, top, width - 8, seed);
    return;
  }
  if (kind === 'hangar') {
    // Arched hangar with a big door half open on the armoury, hazard edges and lights.
    g.fillStyle(0x7a7e72);
    g.fillRect(left, top + 14, width, height - 14);
    g.fillTriangle(left, top + 14, left + 18, top, left + 18, top + 14);
    g.fillTriangle(left + width, top + 14, left + width - 18, top, left + width - 18, top + 14);
    g.fillRect(left + 18, top, width - 36, 14);
    g.fillStyle(0x6a6e62);
    for (let rx = left + 4; rx < left + width; rx += 6) g.fillRect(rx, top + 6, 1, height - 6);
    g.fillStyle(SNOW);
    g.fillRect(left + 16, top - 2, width - 32, 3);
    g.fillTriangle(left, top + 14, left + 18, top - 1, left + 18, top + 4);
    g.fillStyle(0x1e2022);
    g.fillRect(left + 12, y - 30, width - 24, 30);
    g.fillStyle(LAMP, 0.35);
    g.fillRect(left + 14, y - 28, width - 28, 26);
    // Infantry armoury: ammunition racks and stacked supply crates.
    g.fillStyle(MIL_STEEL);
    for (const shelf of [8, 18, 28]) g.fillRect(x - 20, y - shelf, 46, 2);
    g.fillRect(x - 20, y - 28, 2, 28);
    g.fillRect(x + 24, y - 28, 2, 28);
    g.fillStyle(MIL_OLIVE_DARK);
    for (const cx of [-15, -1, 13]) for (const cy of [8, 18]) g.fillRect(x + cx, y - cy - 6, 10, 6);
    g.fillStyle(0x6a6e62);
    g.fillRect(left + 12, y - 30, width * 0.28, 30);
    hazardStripes(g, left + 12, y - 33, width - 24, 3);
    g.fillStyle(MIL_RED);
    g.fillCircle(left + 8, y - 26, 1.5);
    g.fillCircle(left + width - 8, y - 26, 1.5);
    return;
  }
  // Fuel depot: two tanks with ladders, hazard bands and a pipe.
  for (const tx of [left + 14, left + width - 14]) {
    g.fillStyle(0xb8b4a8);
    g.fillRect(tx - 12, top + 4, 24, height - 4);
    g.fillCircle(tx, top + 4, 12);
    g.fillStyle(0x9e9a8e);
    g.fillRect(tx + 4, top + 2, 8, height - 2);
    g.fillStyle(MIL_RED);
    g.fillRect(tx - 12, y - 14, 24, 2);
    g.fillStyle(0x5a5e62);
    g.fillRect(tx - 9, top + 6, 1, height - 6);
    for (let ly = top + 8; ly < y; ly += 3) g.fillRect(tx - 10, ly, 3, 1);
    g.fillStyle(SNOW);
    g.fillRect(tx - 9, top - 8, 18, 3);
  }
  g.fillStyle(0x6d7175);
  g.fillRect(left + 14, y - 6, width - 28, 2);
  g.fillStyle(0x2a2c2e);
  g.fillRect(x - 4, y - 14, 8, 14);
  hazardStripes(g, x - 8, y - 17, 16, 2);
}

function frostlandStreetBuildings() {
  const buildings = [];
  const landmarks = FROSTLAND_LANDMARKS;

  // 1. Snowcap Peaks Alpine Waypoints (43200 - 45000)
  for (let x = 43200; x <= 45000; x += 320) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 45));
    if (gap < 12) continue;
    const seed = x * 0.011;
    const artW = 30 + Math.round(hash(seed + 1) * 14);
    const artH = 32 + Math.round(hash(seed + 2) * 18);
    buildings.push({
      id: `peaks-waypoint-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 160,
      draw: scaled((g, at, y) => drawHighpassChalet(g, at, y, artW, artH, seed)),
    });
  }

  // 2. Highpass Village (47650 - 48050)
  for (let x = 47650; x <= 48050; x += 80) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 35));
    if (gap < 10) continue;
    const seed = x * 0.013;
    const artW = 26 + Math.round(hash(seed + 1) * 12);
    const artH = 28 + Math.round(hash(seed + 2) * 16);
    buildings.push({
      id: `highpass-chalet-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 140,
      draw: scaled((g, at, y) => drawHighpassChalet(g, at, y, artW, artH, seed)),
    });
  }

  // 3. West Pine Woods Cabins (48150 - 48850)
  for (let x = 48150; x <= 48850; x += 110) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 35));
    if (gap < 10) continue;
    const seed = x * 0.015;
    const artW = 26 + Math.round(hash(seed + 1) * 10);
    const artH = 24 + Math.round(hash(seed + 2) * 14);
    buildings.push({
      id: `pinewoods-cabin-${x}`,
      x,
      seed,
      door: true,
      width: artW * CITY_SCALE,
      height: (artH + 18) * CITY_SCALE,
      roof: artH * CITY_SCALE,
      maxHealth: 120,
      draw: scaled((g, at, y) => drawPineCabin(g, at, y, artW, artH, Math.floor(hash(seed + 3) * 3), seed)),
    });
  }

  // 4. Pinetown Street Buildings (48950 - 50850)
  for (let x = 48950; x <= 50850; x += 95) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 45));
    if (gap < 12) continue;
    const seed = x * 0.017;
    const isMill = hash(seed) < 0.45;
    const artW = 30 + Math.round(hash(seed + 1) * 16);
    const artH = isMill ? 65 + Math.round(hash(seed + 2) * 45) : 40 + Math.round(hash(seed + 2) * 30);
    buildings.push({
      id: `pinetown-street-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: isMill ? 240 : 160,
      draw: scaled((g, at, y) => drawPinetownBuilding(g, at, y, artW, artH, isMill)),
    });
  }

  // 5. West Frozen Plains Polar Huts (51000 - 51600)
  for (let x = 51000; x <= 51600; x += 120) {
    if (isWater(x)) continue;
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 40));
    if (gap < 10) continue;
    const seed = x * 0.018;
    const artW = 28 + Math.round(hash(seed + 1) * 12);
    const artH = 25 + Math.round(hash(seed + 2) * 16);
    buildings.push({
      id: `polar-hut-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 140,
      draw: scaled((g, at, y) => drawHighpassChalet(g, at, y, artW, artH, seed)),
    });
  }

  // 6. East Frozen Plains Research Huts (52520 - 53180)
  for (let x = 52520; x <= 53180; x += 120) {
    if (isWater(x)) continue;
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 40));
    if (gap < 10) continue;
    const seed = x * 0.021;
    const artW = 28 + Math.round(hash(seed + 1) * 12);
    const artH = 26 + Math.round(hash(seed + 2) * 16);
    buildings.push({
      id: `frozenplains-hut-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 140,
      draw: scaled((g, at, y) => drawHighpassChalet(g, at, y, artW, artH, seed)),
    });
  }

  // 7. Snow City street (53300 - 59150): laid out like Green City's, about one building every 56
  // art px, thinning and dropping at both ends, with high-rises clustered downtown.
  for (let i = Math.ceil(SNOW_CITY.from / SNOW_STREET_STEP); i * SNOW_STREET_STEP <= SNOW_CITY.to; i++) {
    const x = i * SNOW_STREET_STEP;
    const seed = i + 0.53;
    const taper = Math.min(1, Math.min(x - SNOW_CITY.from, SNOW_CITY.to - x) / SNOW_EDGE);
    if (hash(seed) < 0.12 + 0.45 * (1 - taper)) continue;
    const art = 34 + Math.round(hash(seed + 0.2) * 18);
    const width = art * CITY_SCALE;
    const bx = x + Math.round((SNOW_STREET_STEP - width) * hash(seed + 0.5));
    if (bx + width > SNOW_CITY.to) continue;
    const gap = Math.min(...landmarks.map(l => Math.abs(bx + width / 2 - l.x) - l.clear - width / 2));
    if (gap < 6) continue;
    const towerChance = Math.abs(x - SNOW_DOWNTOWN.x) < SNOW_DOWNTOWN.reach ? 0.4 : 0.08;
    if (taper === 1 && gap >= SNOW_TOWER_MARGIN && hash(seed + 0.7) < towerChance) {
      const height = 140 + Math.round(hash(seed + 0.3) * 120);
      const body = SNOW_TOWERS[Math.floor(hash(seed + 0.4) * SNOW_TOWERS.length)];
      buildings.push({
        id: `snowcity-tower-${i}`, seed, x: bx + width / 2, width, height: (height + SNOW_CROWN) * CITY_SCALE,
        maxHealth: 225, door: true,
        draw: scaled((g, at, y, elapsed) => drawSnowTower(g, at, y, art, height, body, seed, elapsed)),
      });
      continue;
    }
    const kind = Math.floor(hash(seed + 0.1) * 3);
    const full = [32, 52, 84][kind] + Math.round(hash(seed + 0.3) * [12, 28, 30][kind]);
    const height = Math.max(28, Math.round(full * (0.45 + 0.55 * taper)));
    const facade = SNOW_FACADES[Math.floor(hash(seed + 0.4) * SNOW_FACADES.length)];
    const roll = hash(seed + 0.6);
    buildings.push({
      // roof: the rooftop's height above the base, where birds perch.
      id: `snowcity-${i}`, seed, x: bx + width / 2, width, height: (height + 18) * CITY_SCALE, roof: (height + 3) * CITY_SCALE,
      maxHealth: kind === 0 ? 110 : 150, door: true,
      draw: scaled((g, at, y, elapsed) => drawSnowStreetBuilding(g, at - art / 2, y, art, height, kind, facade, roll, elapsed)),
    });
  }

  // 8. Birchwood Cabins & Tavern (59240 - 59580)
  for (let x = 59240; x <= 59580; x += 70) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 35));
    if (gap < 10) continue;
    const seed = x * 0.023;
    // The middle slot is the village tavern.
    const tavern = x === 59380;
    const variant = tavern ? 3 : Math.floor(hash(seed + 3) * 3);
    const artW = tavern ? 40 : 24 + Math.round(hash(seed + 1) * 10);
    const artH = tavern ? 32 : variant === 1 ? 34 : variant === 2 ? 18 : 22 + Math.round(hash(seed + 2) * 6);
    const paint = BIRCH_PAINTS[Math.floor(hash(seed + 4) * BIRCH_PAINTS.length)];
    buildings.push({
      id: `birchwood-cabin-${x}`,
      x,
      seed,
      door: true,
      width: artW * CITY_SCALE,
      height: (artH + Math.round(artW * 0.5)) * CITY_SCALE,
      roof: artH * CITY_SCALE,
      maxHealth: 110,
      draw: scaled((g, at, y) => drawBirchwoodHouse(g, at, y, artW, artH, variant, paint, seed)),
    });
  }

  // 9. East Pine Woods Cabins (59680 - 60320)
  for (let x = 59680; x <= 60320; x += 110) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 35));
    if (gap < 10) continue;
    const seed = x * 0.026;
    const artW = 26 + Math.round(hash(seed + 1) * 12);
    const artH = 24 + Math.round(hash(seed + 2) * 14);
    buildings.push({
      id: `eastpines-cabin-${x}`,
      x,
      seed,
      door: true,
      width: artW * CITY_SCALE,
      height: (artH + 18) * CITY_SCALE,
      roof: artH * CITY_SCALE,
      maxHealth: 120,
      draw: scaled((g, at, y) => drawPineCabin(g, at, y, artW, artH, Math.floor(hash(seed + 3) * 3), seed)),
    });
  }

  // 10. Whale Harbor (61820 - 63050)
  for (let x = 61820; x <= 63050; x += 90) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 45));
    if (gap < 12) continue;
    const seed = x * 0.029;
    const artW = 30 + Math.round(hash(seed + 1) * 14);
    const variant = Math.floor(hash(seed + 3) * 3);
    const artH = variant === 1 ? 32 + Math.round(hash(seed + 2) * 10) : 45 + Math.round(hash(seed + 2) * 35);
    const paint = HARBOR_PAINTS[Math.floor(hash(seed + 4) * HARBOR_PAINTS.length)];
    buildings.push({
      id: `whaleharbor-dock-${x}`,
      x,
      seed,
      door: true,
      width: artW * CITY_SCALE,
      height: (artH + Math.round(artW * 0.45)) * CITY_SCALE,
      roof: artH * CITY_SCALE,
      maxHealth: 180,
      draw: scaled((g, at, y) => drawWhaleHarborBuilding(g, at, y, artW, artH, variant, paint, seed)),
    });
  }

  // 11. Ember Base (63200 - 65400): the military base laid out in EMBER_BASE_PLAN.
  for (const [x, kind] of EMBER_BASE_PLAN) {
    const [artW, artH] = EMBER_ART[kind];
    const seed = x * 0.033;
    buildings.push({
      id: `ember-${kind}-${x}`,
      x,
      seed,
      door: true,
      width: artW * CITY_SCALE,
      height: (artH + (kind === 'fuel' ? 8 : 4)) * CITY_SCALE,
      roof: artH * CITY_SCALE,
      maxHealth: kind === 'gunpit' ? 320 : kind === 'hangar' ? 360 : 240,
      draw: scaled((g, at, y) => drawEmberBaseBuilding(g, at, y, kind, seed)),
    });
  }

  return buildings;
}

export const FROSTLAND_BUILDINGS = Object.freeze([
  ...frostlandStreetBuildings(),
  ...FROSTLAND_LANDMARKS,
]);

function drawPineTree(g, x, y, h = 38) {
  g.fillStyle(0x3e2e20);
  g.fillRect(x - 2, y - 10, 4, 10);
  const tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const ty = y - 8 - t * (h * 0.28);
    const w = 26 - t * 6;
    g.fillStyle(0x283e2a);
    g.fillTriangle(x - w / 2, ty, x, ty - 14, x + w / 2, ty);
    g.fillStyle(0xf0f8ff);
    g.fillTriangle(x - w / 2 + 2, ty, x, ty - 14, x, ty);
  }
}

function drawBirchTree(g, x, y, h = 32) {
  g.fillStyle(0xf4f6f8);
  g.fillRect(x - 2, y - h, 4, h);
  g.fillStyle(0x222222);
  g.fillRect(x - 2, y - h * 0.3, 3, 2);
  g.fillRect(x, y - h * 0.6, 2, 2);
  g.fillRect(x - 2, y - h * 0.8, 3, 2);
  g.fillStyle(0x90a88c, 0.75);
  g.fillCircle(x, y - h - 4, 10);
}

function drawFrostBoulder(g, x, y, r = 10) {
  g.fillStyle(0x4a5864);
  g.fillCircle(x, y - r * 0.6, r);
  g.fillStyle(0xdde8f2);
  g.fillCircle(x - 2, y - r * 0.8, r * 0.5);
}

function drawFrostlandScenery(g, left, right, seaY, cameraX) {
  for (let x = Math.floor(left / 75) * 75; x <= right + 75; x += 75) {
    const wx = wrapX(x);
    if (wx < FROSTLAND.from || wx > FROSTLAND.to || isWater(wx)) continue;
    const y = frostlandBase(wx, seaY);
    const r = hash(wx * 0.033);
    if (((wx >= 48100 && wx <= 49300) || (wx >= 59600 && wx <= 60400) || (wx >= 47600 && wx <= 48100)) && r < 0.45) {
      drawPineTree(g, x, y, 32 + Math.round(r * 20));
    } else if (wx >= 59200 && wx <= 59600 && r < 0.45) {
      drawBirchTree(g, x, y, 28 + Math.round(r * 14));
    } else if (((wx >= 42600 && wx <= 47600) || (wx >= 50900 && wx <= 53200)) && r < 0.3) {
      drawFrostBoulder(g, x, y, 8 + Math.round(r * 8));
    }
  }
}

export function drawFrostland(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((FROSTLAND.from + FROSTLAND.to) / 2, cameraX);
  const half = (FROSTLAND.to - FROSTLAND.from) / 2;
  if (right < mid - half - 500 || left > mid + half + 500) return;

  drawSnowSkyline(g, left, right, seaY, cameraX);
  drawFrostlandScenery(g, left, right, seaY, cameraX);

  if (!buildings) return;
  for (const b of FROSTLAND_BUILDINGS) {
    const at = nearest(b.x, cameraX);
    if (at + b.width / 2 + ART_MARGIN < left || at - b.width / 2 - ART_MARGIN > right) continue;
    b.draw(g, at, frostlandBase(b.x, seaY), elapsed);
    if (b.fx) b.fx(g, at, frostlandBase(b.x, seaY), elapsed);
  }
}
