import { CIRCUMFERENCE, elevation, isWater, lerpColor, wrapX } from './planet.js';
import { ART_MARGIN, CITY_SCALE, scaled, skylineFade } from './city-art.js';

// Sunland: Redrock, Echo Canyon, Sun City International Airport, Sun City, and Long Plains (Fort Ironclad).
// Spans world x from 31200 to 42600.
export const SUNLAND = { from: 31200, to: 42600 };
const SEA_Y_OFFSET = 3;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

export function sunlandBase(x, seaY) {
  return seaY - Math.max(0, elevation(x)) + SEA_Y_OFFSET;
}

// Footing beneath buildings so they anchor cleanly into sloped or uneven terrain
function footing(g, x, y, width, color, depth = 65) {
  g.fillStyle(color);
  g.fillRect(x - width / 2 - 2, y - 2, width + 4, depth);
}

// Palettes
const REDROCK_STONE = 0xb8563a;
const REDROCK_LIGHT = 0xd97452;
const REDROCK_DARK = 0x82341e;
const COPPER_ROOF = 0x4fa682;
const COPPER_LIGHT = 0x6bc4a0;
const GOLD_GLASS = 0xe8c060;
const SUN_GLASS = 0xd8eaf2;
const SKY_GLASS = 0x6ba8cc;
const CONCRETE = 0xc2bcb0;
const CONCRETE_DARK = 0x8a8478;
const ASPHALT = 0x2e3034;
const MIL_GREEN = 0x4a5640;
const MIL_DARK = 0x323a2b;
const MIL_ARMOR = 0x5a6350;
const MARBLE_WHITE = 0xf5f3ed;
const MARBLE_SHADE = 0xd5d0c2;
const ELECTRUM_GOLD = 0xffd700;

// -------------------------------------------------------------
// REDROCK LANDMARKS
// -------------------------------------------------------------

function drawRedrockCitadel(g, x, y) {
  footing(g, x, y, 114, REDROCK_DARK);
  // THE GRAND REDROCK SUN CITADEL (WONDER LANDMARK)
  // Stepped Southwestern Cliff-Palace & Citadel (440px tall)

  // 1. TIER 1 - Rusticated Sandstone Bastion Base (y to y - 145, width 96)
  const w1 = 96;
  const t1 = y - 145;
  g.fillStyle(REDROCK_STONE);
  g.fillRect(x - w1 / 2, t1, w1, 145);
  // Battered foundation plinth with ashlar courses
  g.fillStyle(REDROCK_DARK);
  g.fillRect(x - w1 / 2 - 3, y - 12, w1 + 6, 12);
  g.fillStyle(0x421e10);
  g.fillRect(x - w1 / 2 - 4, y - 4, w1 + 8, 4);

  // 3D Volume Shading: Sunward warm highlight left, deep ambient shadow right
  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(x - w1 / 2, t1, w1 * 0.28, 145);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(x + w1 * 0.22, t1, w1 * 0.28, 145);

  // Horizontal adobe plaster bands / sandstone stratum lines
  g.fillStyle(0x3e1c0e, 0.35);
  for (let sy = y - 28; sy > t1 + 10; sy -= 24) {
    g.fillRect(x - w1 / 2, sy, w1, 2);
  }

  // Monumental Grand Entrance Gateway in Deep Reveal
  g.fillStyle(0x228b84); // Turquoise ceremonial arch surround
  g.fillRect(x - 14, y - 36, 28, 36);
  g.fillCircle(x, y - 36, 14);
  g.fillStyle(0x1a0c06); // Deep entrance portal shadow
  g.fillRect(x - 11, y - 34, 22, 34);
  g.fillCircle(x, y - 34, 11);
  g.fillStyle(0x2e160a); // Massive studded timber doors
  g.fillRect(x - 9, y - 32, 18, 32);
  g.fillCircle(x, y - 32, 9);
  // Brass solar studs & forged iron hinges
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x - 4, y - 20, 2);
  g.fillCircle(x + 4, y - 20, 2);
  g.fillCircle(x, y - 28, 2.5); // Center sun emblem
  g.fillStyle(0x110804);
  g.fillRect(x - 8, y - 24, 16, 2);
  g.fillRect(x - 8, y - 12, 16, 2);

  // Ceremonial Flame Braziers flanking the gateway
  for (let bx of [x - 22, x + 22]) {
    g.fillStyle(0x3e1c0e);
    g.fillRect(bx - 3, y - 18, 6, 18);
    g.fillStyle(0x5a2e18);
    g.fillRect(bx - 5, y - 20, 10, 3);
    // Flickering sacred fire
    g.fillStyle(0xff4400);
    g.fillCircle(bx, y - 22, 3.5);
    g.fillStyle(0xffbb00);
    g.fillCircle(bx, y - 24, 2);
  }

  // Timber vigas (protruding log ceiling beams) at Tier 1 roofline
  g.fillStyle(0x361a0c);
  for (let vx = x - w1 / 2 + 5; vx <= x + w1 / 2 - 5; vx += 8) {
    g.fillRect(vx, t1 + 8, 3, 3);
  }
  // Parapet coping with crenellations
  g.fillStyle(0x4a2212);
  g.fillRect(x - w1 / 2 - 1, t1 - 3, w1 + 2, 3);
  for (let cx = x - w1 / 2; cx < x + w1 / 2; cx += 8) {
    g.fillRect(cx, t1 - 6, 4, 3);
  }

  // 2. TIER 2 - The Cliff Palace Terrace (y - 145 to y - 275, width 72)
  const w2 = 72;
  const t2 = y - 275;
  g.fillStyle(REDROCK_STONE);
  g.fillRect(x - w2 / 2, t2, w2, 130);
  // Volume Shading
  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(x - w2 / 2, t2, w2 * 0.28, 130);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(x + w2 * 0.22, t2, w2 * 0.28, 130);

  // Setback Terrace Wooden Post & Beam Railings
  g.fillStyle(0x5a341e);
  g.fillRect(x - w1 / 2 + 2, t1 - 10, (w1 - w2) / 2 - 3, 2);
  g.fillRect(x + w2 / 2 + 1, t1 - 10, (w1 - w2) / 2 - 3, 2);
  for (let rx of [x - w1 / 2 + 3, x - w2 / 2 - 4, x + w2 / 2 + 4, x + w1 / 2 - 3]) {
    g.fillRect(rx, t1 - 10, 2, 7);
  }
  // Wooden pole ladder propped against Tier 2
  g.fillStyle(0x6e4224);
  g.fillRect(x - w2 / 2 - 8, t1 - 22, 1.5, 24);
  g.fillRect(x - w2 / 2 - 4, t1 - 22, 1.5, 24);
  for (let ry = t1 - 20; ry < t1; ry += 4) g.fillRect(x - w2 / 2 - 8, ry, 5, 1.5);

  // Carved Sun Petroglyph Frieze in center of Tier 2
  g.fillStyle(0x3e1c0e);
  g.fillCircle(x, t2 + 65, 9);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, t2 + 65, 6);
  g.fillStyle(0x3e1c0e);
  for (let a = 0; a < 8; a++) {
    const rad = a * Math.PI / 4;
    g.fillRect(x + Math.cos(rad) * 9 - 1, t2 + 65 + Math.sin(rad) * 9 - 1, 2, 2);
  }

  // Vigas & crenellated parapet atop Tier 2
  g.fillStyle(0x361a0c);
  for (let vx = x - w2 / 2 + 4; vx <= x + w2 / 2 - 4; vx += 7) {
    g.fillRect(vx, t2 + 7, 3, 3);
  }
  g.fillStyle(0x4a2212);
  g.fillRect(x - w2 / 2 - 1, t2 - 3, w2 + 2, 3);
  for (let cx = x - w2 / 2; cx < x + w2 / 2; cx += 7) {
    g.fillRect(cx, t2 - 6, 4, 3);
  }

  // 3. TIER 3 - High Sanctuary & Colonnaded Gallery (y - 275 to y - 375, width 48)
  const w3 = 48;
  const t3 = y - 375;
  g.fillStyle(REDROCK_STONE);
  g.fillRect(x - w3 / 2, t3, w3, 100);
  // Volume Shading
  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(x - w3 / 2, t3, w3 * 0.28, 100);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(x + w3 * 0.22, t3, w3 * 0.28, 100);

  // Open-Air Colonnaded Gallery on Tier 3
  g.fillStyle(0x1a0c06);
  g.fillRect(x - 16, t3 + 30, 32, 22);
  g.fillStyle(0xffbb33, 0.6); // Sacred altar glow inside
  g.fillRect(x - 14, t3 + 32, 28, 18);
  // Stone pillars
  g.fillStyle(REDROCK_LIGHT);
  for (let px of [x - 16, x - 6, x + 4, x + 14]) {
    g.fillRect(px, t3 + 30, 3, 22);
  }

  // Vigas atop Tier 3
  g.fillStyle(0x361a0c);
  for (let vx = x - w3 / 2 + 3; vx <= x + w3 / 2 - 3; vx += 6) {
    g.fillRect(vx, t3 + 6, 3, 3);
  }
  g.fillStyle(0x4a2212);
  g.fillRect(x - w3 / 2 - 1, t3 - 3, w3 + 2, 3);

  // Recessed Windows Across All Tiers (with timber lintels & amber/turquoise warmth)
  for (let wy = y - 55; wy > y - 355; wy -= 20) {
    const isUpper = (wy < t2);
    const isMid = (wy < t1 && wy >= t2);
    const spanW = isUpper ? 32 : isMid ? 50 : 70;
    const cols = isUpper ? 2 : isMid ? 3 : 4;
    const colStep = spanW / cols;
    for (let c = 0; c < cols; c++) {
      const wx = x - spanW / 2 + c * colStep + 4;
      // Skip center petroglyph area
      if (isMid && Math.abs(wx - x) < 14 && Math.abs(wy - (t2 + 65)) < 16) continue;
      // Timber lintel
      g.fillStyle(0x281206);
      g.fillRect(wx - 1, wy - 2, 6, 2);
      // Window reveal
      g.fillStyle(0x160804);
      g.fillRect(wx, wy, 4, 7);
      // Glowing pane (amber gold or turquoise)
      g.fillStyle(((wy + c) % 2 === 0) ? 0xf8be58 : 0x228b84);
      g.fillRect(wx + 0.5, wy + 0.5, 3, 6);
    }
  }

  // 4. TIER 4 - Sacred Solar Spire & Gilded Sun Disc (y - 375 to y - 440)
  // Stepped sandstone temple roof
  g.fillStyle(0x5a2e18);
  g.fillRect(x - 18, t3 - 8, 36, 8);
  g.fillStyle(COPPER_ROOF);
  g.fillTriangle(x - 14, t3 - 8, x, t3 - 32, x + 14, t3 - 8);
  g.fillStyle(COPPER_LIGHT);
  g.fillTriangle(x - 14, t3 - 8, x, t3 - 32, x, t3 - 8);

  // Soaring Gilded Sun Disc Spire
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 1.5, t3 - 62, 3, 30);
  // Radiant Golden Sun Disc
  g.fillCircle(x, t3 - 56, 7);
  g.fillStyle(0xfff4c0);
  g.fillCircle(x, t3 - 56, 4);
  // Radiating golden solar flare rays
  g.fillStyle(ELECTRUM_GOLD);
  for (let a = 0; a < 8; a++) {
    const rad = a * Math.PI / 4;
    g.fillRect(x + Math.cos(rad) * 11 - 1, t3 - 56 + Math.sin(rad) * 11 - 1, 2, 2);
  }

  // Ceremonial red and turquoise prayer streamers streaming in desert wind
  g.fillStyle(0xc41e3a);
  g.fillRect(x + 2, t3 - 52, 10, 2);
  g.fillRect(x + 5, t3 - 50, 7, 2);
  g.fillStyle(0x228b84);
  g.fillRect(x + 2, t3 - 46, 8, 2);
}

function drawRedrockBridge(g, x, y) {
  footing(g, x, y, 140, REDROCK_DARK);
  // Sandstone Canyon Abutment Piers on shores
  for (const ax of [x - 64, x + 64]) {
    g.fillStyle(REDROCK_DARK);
    g.fillRect(ax - 8, y - 36, 16, 36);
    g.fillStyle(REDROCK_STONE);
    g.fillRect(ax - 6, y - 34, 12, 34);
    for (let sy = y - 30; sy <= y - 6; sy += 8) g.fillRect(ax - 8, sy, 16, 1.5);
  }

  // Heavy Timber & Iron Suspension Towers
  for (const tx of [x - 46, x + 46]) {
    // Stone tower base pedestal
    g.fillStyle(REDROCK_DARK);
    g.fillRect(tx - 8, y - 40, 16, 40);
    g.fillStyle(REDROCK_STONE);
    g.fillRect(tx - 6, y - 38, 12, 38);

    // Twin timber/wrought-iron vertical pylon posts
    g.fillStyle(0x3e2818);
    g.fillRect(tx - 6, y - 92, 4, 52);
    g.fillRect(tx + 2, y - 92, 4, 52);
    g.fillStyle(0x6a4428);
    g.fillRect(tx - 5, y - 92, 2, 52);
    g.fillRect(tx + 3, y - 92, 2, 52);

    // Diagonal iron cross-braces
    g.lineStyle(1.5, 0x222226);
    g.lineBetween(tx - 6, y - 88, tx + 6, y - 68);
    g.lineBetween(tx - 6, y - 68, tx + 6, y - 88);
    g.lineBetween(tx - 6, y - 68, tx + 6, y - 48);
    g.lineBetween(tx - 6, y - 48, tx + 6, y - 68);

    // Copper pyramidal cap with decorative lantern
    g.fillStyle(COPPER_ROOF);
    g.fillTriangle(tx - 8, y - 92, tx, y - 98, tx + 8, y - 92);
    g.fillStyle(0xffe070);
    g.fillRect(tx - 2, y - 82, 4, 5); // Tower lantern
  }

  // Braided Steel Main Suspension Cables & Vertical Hangers
  g.lineStyle(2, 0x2e2c2a);
  // West backstay
  g.lineBetween(x - 68, y - 28, x - 46, y - 92);
  // East backstay
  g.lineBetween(x + 46, y - 92, x + 68, y - 28);

  // Parabolic main span cable between towers
  for (let cx = x - 46; cx <= x + 46; cx += 4) {
    const u = (cx - x) / 46;
    const cy = Math.round((y - 42) + (u * u) * (-50)); // sags to y - 42 at center, y - 92 at towers
    g.fillStyle(0x2e2c2a);
    g.fillRect(cx - 0.5, cy, 2, 2);
    // Vertical wire suspender rod
    if (Math.abs(cx - x) % 10 < 3 && Math.abs(cx - x) < 42) {
      g.fillStyle(0x707074, 0.8);
      g.fillRect(cx, cy + 2, 1, Math.max(0, (y - 28) - cy - 2));
    }
  }

  // Heavy Timber Roadway Deck & Guardrails
  g.fillStyle(0x3a2214);
  g.fillRect(x - 68, y - 28, 136, 6); // Timber stringers
  g.fillStyle(0x5a3822);
  g.fillRect(x - 68, y - 29, 136, 2); // Wood deck planks
  // Plank line grooves
  g.fillStyle(0x22140a);
  for (let px = x - 64; px <= x + 64; px += 8) g.fillRect(px, y - 29, 1, 2);

  // Rustic Timber Guardrail & Warm Hanging Lanterns
  g.fillStyle(0x4a2c1a);
  g.fillRect(x - 68, y - 35, 136, 1.5);
  for (let rx = x - 64; rx <= x + 64; rx += 16) {
    g.fillRect(rx, y - 35, 1.5, 6);
  }
  for (const lx of [x - 24, x + 24]) {
    g.fillStyle(0xffe070);
    g.fillCircle(lx, y - 32, 2);
  }
}

// -------------------------------------------------------------
// WONDER 4: TEMPLE OF THE SUN (ECHO CANYON)
// -------------------------------------------------------------

function drawTempleOfTheSun(g, x, y) {
  footing(g, x, y, 210, REDROCK_DARK);
  // Sandstone Needle Pinnacle Mesa
  g.fillStyle(REDROCK_STONE);
  g.fillRect(x - 90, y - 60, 180, 60);
  g.fillStyle(REDROCK_LIGHT);
  g.fillRect(x - 90, y - 60, 90, 60);
  g.fillStyle(REDROCK_DARK);
  for (let sy = y - 50; sy < y; sy += 12) g.fillRect(x - 90, sy, 180, 2);

  // Grand Hexastyle Marble Acropolis
  const styBase = y - 60;
  // Crepidoma steps
  for (let i = 0; i < 4; i++) {
    const sw = 176 - i * 6;
    g.fillStyle(i % 2 === 0 ? MARBLE_WHITE : MARBLE_SHADE);
    g.fillRect(x - sw / 2, styBase - (i + 1) * 4, sw, 4);
  }
  const colBase = styBase - 16;
  const colH = 64;
  const colTop = colBase - colH;
  // Fluted Corinthian Columns
  for (let i = 0; i < 8; i++) {
    const cx = x - 70 + i * 20;
    g.fillStyle(MARBLE_WHITE);
    g.fillRect(cx - 3, colTop, 6, colH);
    g.fillStyle(MARBLE_SHADE);
    g.fillRect(cx + 1, colTop, 2, colH);
    // Capital & Base
    g.fillStyle(ELECTRUM_GOLD);
    g.fillRect(cx - 4, colTop - 2, 8, 3);
    g.fillRect(cx - 4, colBase - 2, 8, 2);
  }
  // Cellar Wall behind
  g.fillStyle(0x3a2218);
  g.fillRect(x - 55, colTop, 110, colH);
  // Entablature & Architrave
  g.fillStyle(MARBLE_SHADE);
  g.fillRect(x - 84, colTop - 8, 168, 8);
  g.fillStyle(ELECTRUM_GOLD);
  for (let gx = x - 80; gx < x + 76; gx += 12) g.fillRect(gx, colTop - 6, 6, 4);
  // Classical Pediment with Sun Chariot Relief
  g.fillStyle(MARBLE_WHITE);
  g.fillTriangle(x - 86, colTop - 8, x, colTop - 42, x + 86, colTop - 8);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, colTop - 22, 9);
  // Radiant Golden Sun Rays
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4;
    g.lineStyle(1.5, ELECTRUM_GOLD);
    g.lineBetween(x + Math.cos(ang) * 11, colTop - 22 + Math.sin(ang) * 11, x + Math.cos(ang) * 18, colTop - 22 + Math.sin(ang) * 18);
  }
  // Roof Cornice & Acroteria
  g.fillStyle(MARBLE_SHADE);
  g.fillRect(x - 1, colTop - 46, 2, 6);
  g.fillCircle(x, colTop - 47, 3);
}

function templeFx(g, x, y, elapsed) {
  // Eternal Solar Flame Altar
  const ay = y - 76;
  const flameH = 8 + Math.sin(elapsed * 15) * 4;
  g.fillStyle(0xff7700, 0.85);
  g.fillTriangle(x - 6, ay, x + 6, ay, x, ay - flameH);
  g.fillStyle(0xffe044);
  g.fillCircle(x, ay - flameH * 0.4, 3.5);
}

// -------------------------------------------------------------
// WONDER 1: THE GOLDEN PYRAMID OF KHUFU (GREAT DESERT GATEWAY)
// -------------------------------------------------------------

function drawGoldenPyramid(g, x, y) {
  footing(g, x, y, 290, 0x6e4e30, 70);

  // 1. Monumental Stepped Foundation Podium & Outer Terrace
  g.fillStyle(0x6e4e30);
  g.fillRect(x - 138, y - 4, 276, 4);
  g.fillStyle(0x8a6642);
  g.fillRect(x - 134, y - 8, 268, 4);

  // 2. 10 Megalithic Ashlar Limestone Tiers (Setbacks)
  const tiers = [
    { w: 250, h: 20 },
    { w: 226, h: 18 },
    { w: 202, h: 18 },
    { w: 178, h: 18 },
    { w: 154, h: 17 },
    { w: 130, h: 17 },
    { w: 106, h: 16 },
    { w: 84, h: 16 },
    { w: 62, h: 15 },
    { w: 42, h: 15 },
  ];

  let curY = y - 8;
  for (let i = 0; i < tiers.length; i++) {
    const { w, h } = tiers[i];
    const top = curY - h;

    // Ancient Tura weathered limestone courses
    const baseColor = (i % 2 === 0) ? 0xdec096 : 0xc8a474;
    g.fillStyle(baseColor);
    g.fillRect(x - w / 2, top, w, h);

    // 3D Volumetric lighting: West face in blazing desert sun, East face in deep shadow
    g.fillStyle(0xffffff, 0.18);
    g.fillRect(x - w / 2, top, w * 0.48, h);
    g.fillStyle(0x4a321c, 0.42);
    g.fillRect(x + w * 0.04, top, w * 0.46, h);

    // Deep horizontal bed coursing joint
    g.fillStyle(0x704e30, 0.6);
    g.fillRect(x - w / 2, top + h - 1.5, w, 1.5);
    // Sunlit top edge highlight
    g.fillStyle(0xfff6d8, 0.25);
    g.fillRect(x - w / 2, top, w * 0.48, 1);

    // Staggered vertical ashlar masonry block joints
    g.fillStyle(0x765434, 0.5);
    const offset = (i * 9) % 17;
    for (let bx = x - w / 2 + 10 + offset; bx < x + w / 2 - 8; bx += 18) {
      g.fillRect(bx, top, 1, h);
    }

    // Weathered stone fissures & natural micro-crevasses on select blocks
    if (i % 2 === 1) {
      g.fillStyle(0x563820, 0.4);
      g.fillRect(x - w * 0.32, top + h * 0.4, 4, 1.5);
      g.fillRect(x + w * 0.28, top + h * 0.6, 5, 1.5);
    }

    curY = top;
  }

  // 3. Grand Central Processional Staircase (y - 8 up to curY + 22)
  const sTop = curY + 22;
  const sW = 32;
  g.fillStyle(0x9a744e);
  g.fillRect(x - sW / 2, sTop, sW, (y - 8) - sTop);

  // Stepped treads with crisp light/shadow contrast
  for (let sy = y - 10; sy >= sTop; sy -= 4) {
    g.fillStyle(0xf0d8ac); // Sunlit tread
    g.fillRect(x - sW / 2 + 1, sy, sW - 2, 2);
    g.fillStyle(0x52361e); // Shadow riser
    g.fillRect(x - sW / 2 + 1, sy + 2, sW - 2, 2);
  }

  // Heavy carved stone balustrades with golden hieroglyphic cartouche medallions
  g.fillStyle(0x7c5836);
  g.fillRect(x - sW / 2 - 3.5, sTop, 3.5, (y - 8) - sTop);
  g.fillRect(x + sW / 2, sTop, 3.5, (y - 8) - sTop);
  for (let my = y - 24; my > sTop + 14; my -= 26) {
    g.fillStyle(ELECTRUM_GOLD);
    g.fillRect(x - sW / 2 - 3, my, 2.5, 5);
    g.fillRect(x + sW / 2 + 0.5, my, 2.5, 5);
  }

  // 4. Monumental Egyptian Pylon Gateway & Hypostyle Portal
  // Battered pylon walls flanking entrance
  g.fillStyle(0x86603c);
  g.fillRect(x - 22, y - 46, 44, 38);
  g.fillTriangle(x - 27, y - 8, x - 22, y - 46, x - 22, y - 8);
  g.fillTriangle(x + 27, y - 8, x + 22, y - 46, x + 22, y - 8);
  // Volume shading on pylons
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(x - 22, y - 46, 20, 38);
  g.fillStyle(0x3e2814, 0.4);
  g.fillRect(x + 2, y - 46, 20, 38);

  // Flaring Cavetto Cornice with Torus Molding
  g.fillStyle(0xa67c4e);
  g.fillRect(x - 28, y - 52, 56, 6);
  g.fillStyle(0x6a482c);
  g.fillRect(x - 28, y - 46.5, 56, 1.5);
  g.fillStyle(0xd6ad78);
  g.fillRect(x - 27, y - 52, 54, 1.5);

  // Sculpted Winged Solar Disk of Ra & Uraeus Serpents (Solid Electrum Gold)
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, y - 49, 4);
  g.fillRect(x - 18, y - 49.5, 36, 2);
  g.fillTriangle(x - 18, y - 49.5, x - 24, y - 51, x - 18, y - 47.5);
  g.fillTriangle(x + 18, y - 49.5, x + 24, y - 51, x + 18, y - 47.5);
  g.fillStyle(0xfff090);
  g.fillCircle(x, y - 49, 2.5);

  // Deep Sacred Sanctum Portal Reveal & Torchlight
  g.fillStyle(0x120e0a);
  g.fillRect(x - 11, y - 36, 22, 28);
  g.fillStyle(0xff9922, 0.85);
  g.fillCircle(x, y - 22, 5.5);
  g.fillStyle(0xfff5aa);
  g.fillCircle(x, y - 22, 2.5);

  // 5. Polished Electrum / Gold Pyramidion Capstone
  const capH = 38;
  g.fillStyle(ELECTRUM_GOLD);
  g.fillTriangle(x, curY - capH, x - 21, curY, x + 21, curY);
  // Blazing sunward reflective face
  g.fillStyle(0xfff6a0);
  g.fillTriangle(x, curY - capH, x - 21, curY, x, curY);
  // Shadowed gold facet
  g.fillStyle(0xd4af37);
  g.fillTriangle(x, curY - capH, x, curY, x + 21, curY);
  // Razor-sharp apex specular highlight
  g.fillStyle(0xffffff, 0.8);
  g.fillRect(x - 0.5, curY - capH, 1, capH);

  // 6. Twin Guardian Sphinxes (Recumbent Pharaoh Lions flanking entrance at x - 44 and x + 44)
  for (const dir of [-1, 1]) {
    const sx = x + dir * 44;
    // Carved sandstone plinth
    g.fillStyle(0x56381e);
    g.fillRect(sx - 16, y - 10, 32, 4);
    g.fillStyle(0x8c643e);
    g.fillRect(sx - 15, y - 14, 30, 4);

    // Lion recumbent body
    g.fillStyle(0xb48e5a);
    // Body mass & flank
    g.fillRect(sx - (dir > 0 ? 11 : 15), y - 24, 26, 10);
    // Haunches
    g.fillStyle(0x9a7444);
    g.fillCircle(sx - dir * 9, y - 20, 6.5);
    // Outstretched forepaws
    g.fillStyle(0xd4ad76);
    g.fillRect(sx + (dir > 0 ? 7 : -17), y - 17, 10, 4);

    // Pharaoh head with Royal Nemes headdress
    g.fillStyle(0xdeb886);
    g.fillCircle(sx + dir * 7, y - 28, 6);
    // Lapis & Gold Striped Nemes Headdress
    g.fillStyle(0x1a3862);
    g.fillRect(sx + (dir > 0 ? 2 : -10), y - 34, 11, 9);
    g.fillStyle(ELECTRUM_GOLD);
    g.fillRect(sx + (dir > 0 ? 4 : -8), y - 32, 7, 2);
    g.fillRect(sx + (dir > 0 ? 4 : -8), y - 28, 7, 1.5);
    // Ceremonial pharaonic beard
    g.fillStyle(ELECTRUM_GOLD);
    g.fillRect(sx + dir * 7 - 1, y - 22, 2, 5);
  }

  // 7. Twin Monumental Rose-Granite Obelisks (at x - 142 and x + 142 on desert sands)
  for (const ox of [x - 142, x + 142]) {
    // Stepped Rose Granite Plinth
    g.fillStyle(0x783428);
    g.fillRect(ox - 8, y - 8, 16, 4);
    g.fillStyle(0x9c4838);
    g.fillRect(ox - 7, y - 12, 14, 4);

    // Soaring Obelisk Shaft (72px tall)
    g.fillStyle(0xba5e4e);
    g.fillRect(ox - 5, y - 84, 10, 72);
    // Sunlit west facet
    g.fillStyle(0xd67a6a);
    g.fillRect(ox - 5, y - 84, 5, 72);

    // Incised hieroglyphic inscription column
    g.fillStyle(0x5a241a);
    for (let hy = y - 78; hy < y - 18; hy += 7) {
      g.fillRect(ox - 2, hy, 4, 2);
      g.fillRect(ox - 1, hy + 3, 2, 2);
    }

    // Gilded Electrum Pyramidion Apex
    g.fillStyle(ELECTRUM_GOLD);
    g.fillTriangle(ox, y - 98, ox - 5, y - 84, ox + 5, y - 84);
    g.fillStyle(0xfff6a0);
    g.fillTriangle(ox, y - 98, ox - 5, y - 84, ox, y - 84);
  }
}

function pyramidFx(g, x, y, elapsed) {
  // Radiant rotating 4-pointed solar starburst lens flare at capstone peak (y - 226)
  const pulse = Math.sin(elapsed * 2.8);
  if (pulse > 0.1) {
    const alpha = (pulse - 0.1) * 1.1;
    const peakY = y - 226;

    // Golden solar halo
    g.fillStyle(0xffe066, alpha * 0.45);
    g.fillCircle(x, peakY, 14);
    g.fillStyle(0xffffff, alpha * 0.85);
    g.fillCircle(x, peakY, 5);

    // Horizontal & vertical radiant light rays
    g.fillStyle(0xffffff, alpha * 0.9);
    g.fillRect(x - 24, peakY - 0.5, 48, 1);
    g.fillRect(x - 0.5, peakY - 24, 1, 48);

    // Diagonal diamond sparkle rays
    g.fillStyle(0xfff0aa, alpha * 0.7);
    g.fillTriangle(x, peakY - 14, x - 3, peakY, x + 3, peakY);
    g.fillTriangle(x, peakY + 14, x - 3, peakY, x + 3, peakY);
    g.fillTriangle(x - 14, peakY, x, peakY - 3, x, peakY + 3);
    g.fillTriangle(x + 14, peakY, x, peakY - 3, x, peakY + 3);
  }
}

// -------------------------------------------------------------
// SUN CITY INTERNATIONAL AIRPORT (SCIA)
// -------------------------------------------------------------

function drawAirportTerminal(g, x, y) {
  footing(g, x, y, 230, ASPHALT);
  // Tarmac Apron & Taxiway Markings
  g.fillStyle(ASPHALT);
  g.fillRect(x - 115, y - 4, 230, 6);
  g.fillStyle(0xffd700, 0.85); // Yellow centerline taxi line
  g.fillRect(x - 110, y - 2, 220, 1.5);

  // Terminal Main Concourse
  const tW = 196;
  const tH = 72;
  const tTop = y - tH;
  g.fillStyle(0x283038);
  g.fillRect(x - tW / 2, tTop, tW, tH);

  // Sweeping Cantilevered Aerofoil Canopy Roof
  g.fillStyle(0x1e242c);
  g.fillTriangle(x - tW / 2 - 16, tTop, x, tTop - 22, x + tW / 2 + 16, tTop);
  g.fillStyle(0x3a4450);
  g.fillRect(x - tW / 2 - 14, tTop - 2, tW + 28, 5);
  // Glass skylights along the roof ridge
  g.fillStyle(SKY_GLASS);
  for (let sx = x - tW / 2 + 20; sx < x + tW / 2 - 20; sx += 24) {
    g.fillRect(sx, tTop - 8, 14, 4);
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(sx + 2, tTop - 8, 4, 4);
    g.fillStyle(SKY_GLASS);
  }

  // Panoramic Floor-to-Ceiling Concourse Glass Wall
  g.fillStyle(0x16202a);
  g.fillRect(x - tW / 2 + 6, tTop + 14, tW - 12, tH - 22);
  g.fillStyle(SKY_GLASS);
  g.fillRect(x - tW / 2 + 8, tTop + 16, tW - 16, tH - 26);
  // Warm interior departures concourse illumination & flight status boards
  g.fillStyle(0xfff6cf, 0.7);
  g.fillRect(x - tW / 2 + 10, tTop + 20, tW - 20, tH - 32);
  // Flight information display screens (glowing amber)
  for (const fdx of [x - 50, x, x + 50]) {
    g.fillStyle(0x223344);
    g.fillRect(fdx - 10, tTop + 24, 20, 8);
    g.fillStyle(0xffaa22);
    g.fillRect(fdx - 8, tTop + 26, 16, 4);
  }

  // Architectural Steel Space-Frame Vertical Mullions
  g.fillStyle(0x4a5868);
  for (let gx = x - tW / 2 + 12; gx < x + tW / 2 - 12; gx += 16) {
    g.fillRect(gx, tTop + 14, 2, tH - 22);
  }

  // Telescopic Passenger Boarding Jet-Bridges (Gates 1 to 4)
  for (const jx of [x - 68, x - 22, x + 24, x + 70]) {
    // Fixed rotunda on concourse
    g.fillStyle(0x3a4450);
    g.fillRect(jx - 2, y - 32, 20, 28);
    // Telescopic glass & steel tunnel extending out to tarmac
    g.fillStyle(0x2a323c);
    g.fillRect(jx, y - 28, 16, 24);
    g.fillStyle(SKY_GLASS);
    g.fillRect(jx + 2, y - 24, 12, 10);
    // Flexible accordion weather bellows
    g.fillStyle(0x14181e);
    g.fillRect(jx + 2, y - 14, 12, 10);
    for (let by = y - 13; by < y - 4; by += 2.5) {
      g.fillStyle(0x384048);
      g.fillRect(jx + 2, by, 12, 1);
    }
  }

  // Illuminated Terminal Signage ("SUN CITY INTERNATIONAL")
  g.fillStyle(0x182028);
  g.fillRect(x - 55, tTop + 4, 110, 8);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 52, tTop + 6, 104, 4);
  g.fillStyle(0xffffff);
  g.fillRect(x - 48, tTop + 7, 96, 2);
}

function drawAirportTower(g, x, y) {
  footing(g, x, y, 48, ASPHALT);
  const shaftTop = y - 142;
  // 1. Concrete Structural Foundation Plinth
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(x - 12, y - 16, 24, 16);

  // 2. Slender Fluted Aerodynamic ATC Concrete Shaft
  g.fillStyle(0xd5dde6);
  g.fillRect(x - 9, shaftTop, 18, 126);
  g.fillStyle(0x9aa6b4);
  g.fillRect(x + 2, shaftTop, 7, 126); // Shadow side
  // Vertical fluting ribs
  g.fillStyle(0x7a8694);
  g.fillRect(x - 7, shaftTop, 1.5, 126);
  g.fillRect(x - 2, shaftTop, 1.5, 126);
  g.fillRect(x + 5, shaftTop, 1.5, 126);

  // 3. Intermediate Service Platform & Safety Catwalk
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(x - 14, y - 75, 28, 4);
  g.fillStyle(0x5a6674);
  g.fillRect(x - 14, y - 79, 28, 1); // Railing
  for (let rx = x - 13; rx <= x + 13; rx += 5) g.fillRect(rx, y - 79, 1, 4);

  // 4. Cantilevered Structural Support Bracket for Control Cab
  g.fillStyle(CONCRETE_DARK);
  g.fillTriangle(x - 20, shaftTop, x, shaftTop + 14, x + 20, shaftTop);
  g.fillRect(x - 20, shaftTop - 4, 40, 5);

  // 5. 360-Degree Faceted Canted-Glass Panoramic Control Cab
  const cabTop = shaftTop - 24;
  g.fillStyle(0x182430);
  g.fillRect(x - 20, cabTop, 40, 20);
  g.fillStyle(SKY_GLASS);
  g.fillRect(x - 18, cabTop + 2, 36, 16);
  // Interior air traffic controller console displays (green & amber)
  g.fillStyle(0x11ee66);
  g.fillRect(x - 8, cabTop + 12, 6, 4);
  g.fillStyle(0xffaa22);
  g.fillRect(x + 2, cabTop + 12, 6, 4);
  // Canted window mullions with sun-shading overhang
  g.fillStyle(CONCRETE_DARK);
  for (let px = x - 16; px <= x + 16; px += 6) g.fillRect(px, cabTop + 2, 1.5, 16);
  // Overhanging roof slab with sun visors
  g.fillStyle(0x28323c);
  g.fillRect(x - 22, cabTop - 4, 44, 4);

  // 6. Roof Radar Deck, Meteorological Sensors & Radome
  g.fillStyle(0x4a5664);
  g.fillRect(x - 12, cabTop - 8, 24, 4);
  // Spherical Weather Radome
  g.fillStyle(0xeeeeee);
  g.fillCircle(x - 5, cabTop - 12, 5);
  g.fillStyle(0xcccccc);
  g.fillCircle(x - 5, cabTop - 12, 2.5);
  // Anemometer mast
  g.fillStyle(0x333333);
  g.fillRect(x + 5, cabTop - 15, 1.5, 7);
}

function towerFx(g, x, y, elapsed) {
  // Rotating Modern ATC Phased-Array / Radar Scanner Bar
  const cabTop = y - 166;
  const rx = Math.sin(elapsed * 4) * 11;
  g.lineStyle(2, 0xffffff);
  g.lineBetween(x - rx, cabTop - 12, x + rx, cabTop - 12);
  g.fillStyle(0x222222);
  g.fillCircle(x, cabTop - 12, 2);
  // High-intensity red obstruction beacon
  if (Math.sin(elapsed * 5) > 0.2) {
    g.fillStyle(0xff2211);
    g.fillCircle(x, cabTop - 18, 3);
    g.fillStyle(0xffaaaa, 0.7);
    g.fillCircle(x, cabTop - 18, 5);
  }
}

function drawAirportHangar(g, x, y) {
  footing(g, x, y, 140, ASPHALT);
  const hW = 132;
  const hH = 74;
  const top = y - hH;

  // 1. Reinforced Concrete Foundation & Exterior Apron Tarmac
  g.fillStyle(ASPHALT);
  g.fillRect(x - hW / 2 - 4, y - 6, hW + 8, 8);
  // Yellow/black diagonal safety hazard clearance apron boundary
  for (let zx = x - hW / 2 + 6; zx < x + hW / 2 - 6; zx += 10) {
    g.fillStyle(0xffbb00);
    g.fillRect(zx, y - 5, 5, 3);
    g.fillStyle(0x181818);
    g.fillRect(zx + 5, y - 5, 5, 3);
  }

  // 2. Wide-Span Corrugated Steel Industrial Arch Hangar
  g.fillStyle(0x323a44);
  g.fillRect(x - hW / 2, top, hW, hH - 6);
  g.fillStyle(0x4a5462);
  g.fillTriangle(x - hW / 2, top, x, top - 20, x + hW / 2, top);
  // Heavy corrugated structural steel roof trim & ribs
  g.fillStyle(0x222830);
  g.fillRect(x - hW / 2, top - 2, hW, 4);
  g.lineStyle(2, 0x606c7c);
  g.lineBetween(x - hW / 2, top, x, top - 20);
  g.lineBetween(x + hW / 2, top, x, top - 20);

  // 3. Deep Maintenance Bay Interior (Recessed & Illuminated)
  const bayW = hW - 22;
  const bayH = hH - 22;
  const bayLeft = x - bayW / 2;
  const bayTop = top + 16;
  g.fillStyle(0x10141a);
  g.fillRect(bayLeft, bayTop, bayW, bayH);

  // Overhead Heavy Yellow Traveling Bridge Crane Gantry
  g.fillStyle(0xffcc00);
  g.fillRect(bayLeft + 2, bayTop + 2, bayW - 4, 4);
  g.fillStyle(0x222222);
  g.fillRect(x - 6, bayTop + 6, 12, 6);
  // Steel hoist cables & lifting hook over engine bay
  g.fillStyle(0x8894a0);
  g.fillRect(x - 2, bayTop + 12, 1, 10);
  g.fillRect(x + 1, bayTop + 12, 1, 10);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 3, bayTop + 22, 6, 4);

  // High-Bay Industrial Sodium Floodlights (casting conical beams)
  g.fillStyle(0xfffae0, 0.42);
  g.fillTriangle(x - 32, bayTop + 6, x - 54, bayTop + bayH, x - 10, bayTop + bayH);
  g.fillTriangle(x + 32, bayTop + 6, x + 10, bayTop + bayH, x + 54, bayTop + bayH);

  // 4. Detailed Airliner Elevated on Maintenance Stands (Recessed Safely Above Street)
  // Positioned from y - 48 to y - 18 (leaves clear 18px clearance above street level for cars & buses!)
  const planeY = y - 26;

  // Yellow Hydraulic Maintenance Jacking Stands & Wheel Chocks
  g.fillStyle(0xffaa00);
  g.fillRect(x - 22, planeY + 4, 4, 10);
  g.fillRect(x + 18, planeY + 4, 4, 10);
  g.fillRect(x - 25, planeY + 12, 10, 2);
  g.fillRect(x + 15, planeY + 12, 10, 2);

  // Swept Aircraft Wings (behind fuselage)
  g.fillStyle(0xb8c4d0);
  g.fillRect(x - 42, planeY - 4, 84, 5);
  // Wingtip vertical winglets (Airline Blue)
  g.fillStyle(0x0055bb);
  g.fillRect(x - 42, planeY - 9, 2, 5);
  g.fillRect(x + 40, planeY - 9, 2, 5);

  // Under-Wing Turbofan Jet Engines
  g.fillStyle(0x38424e);
  g.fillRect(x - 28, planeY - 1, 12, 7);
  g.fillRect(x + 16, planeY - 1, 12, 7);
  // Engine front intake cowling & spinner
  g.fillStyle(0x11161c);
  g.fillCircle(x - 28, planeY + 2.5, 3.5);
  g.fillCircle(x + 28, planeY + 2.5, 3.5);
  g.fillStyle(0xd5dde6);
  g.fillCircle(x - 28, planeY + 2.5, 1);
  g.fillCircle(x + 28, planeY + 2.5, 1);

  // Streamlined Airliner Fuselage Tube (y - 34 to y - 20)
  g.fillStyle(0xe2eaf2);
  g.fillRect(x - 30, planeY - 8, 60, 12);
  // Aerodynamic nose cone (left)
  g.fillCircle(x - 30, planeY - 2, 6);
  // Cockpit flight deck windshield
  g.fillStyle(SKY_GLASS);
  g.fillRect(x - 32, planeY - 6, 6, 4);

  // Airline Blue Cheatline along fuselage
  g.fillStyle(0x0055bb);
  g.fillRect(x - 30, planeY - 1, 60, 2);

  // Passenger Cabin Windows
  g.fillStyle(0x182638);
  for (let px = x - 22; px <= x + 24; px += 5) {
    g.fillRect(px, planeY - 5, 2.5, 2.5);
  }

  // Vertical Tail Fin & Stabilizers (Swept aerodynamic empennage)
  g.fillStyle(0xd5dde6);
  g.fillTriangle(x + 18, planeY - 8, x + 26, planeY - 24, x + 30, planeY - 8);
  // Airline Blue Fin Livery with stylized gold logo
  g.fillStyle(0x0055bb);
  g.fillTriangle(x + 20, planeY - 8, x + 26, planeY - 22, x + 28, planeY - 8);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x + 24, planeY - 15, 1.5);
  // Horizontal stabilizer
  g.fillStyle(0xb8c4d0);
  g.fillRect(x + 22, planeY - 18, 10, 2);

  // Mobile Aircraft Boarding Stairs / Service Scaffolding in bay
  g.fillStyle(0x425060);
  g.fillRect(x - 18, planeY - 6, 2, 16);
  g.fillStyle(0xffcc00);
  for (let sy = planeY - 4; sy <= planeY + 8; sy += 3) {
    g.fillRect(x - 22, sy, 6, 1.5);
  }

  // 5. Heavy Bi-Fold Industrial Shutter Doors on Sides
  g.fillStyle(0x28303a);
  g.fillRect(x - hW / 2 + 2, top + 14, 10, hH - 20);
  g.fillRect(x + hW / 2 - 12, top + 14, 10, hH - 20);
  // Overhead door guide tracks
  g.fillStyle(0x505c6c);
  g.fillRect(x - hW / 2 + 2, top + 12, hW - 4, 3);
}

// -------------------------------------------------------------
// SUN CITY SKYSCRAPERS & WONDER 2: HANGING GARDENS
// -------------------------------------------------------------

function drawSolariaTower(g, x, y) {
  footing(g, x, y, 114, CONCRETE_DARK);
  // 580px Grand Stepped Art Deco Golden Skyscraper
  // Tier 1 (y to y - 180, width 88)
  const w1 = 88;
  const t1 = y - 180;
  g.fillStyle(0x242830);
  g.fillRect(x - w1 / 2, t1, w1, 180);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(x - w1 / 2 + 3, t1 + 4, w1 - 6, 172);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(x + w1 * 0.15, t1 + 4, w1 * 0.35 - 3, 172);

  // Floor spandrels & illuminated office window grid
  for (let fy = t1 + 14; fy < y - 24; fy += 14) {
    g.fillStyle(0x181c22, 0.45);
    g.fillRect(x - w1 / 2 + 3, fy, w1 - 6, 2.5);
    g.fillStyle(0xfff8d0, 0.85);
    for (let wx = x - w1 / 2 + 7; wx < x + w1 / 2 - 7; wx += 9) {
      if ((wx + fy) % 3 !== 0) g.fillRect(wx, fy + 3, 5, 7);
    }
  }
  // Vertical bronze pilasters / fluting
  g.fillStyle(0xd4af37, 0.6);
  for (let px = x - w1 / 2 + 8; px < x + w1 / 2 - 4; px += 12) {
    g.fillRect(px, t1 + 4, 1.5, 172);
  }

  // Setback Terrace 1 (y - 180): Landscaped Sky-Garden with Bronze Railings
  g.fillStyle(CONCRETE);
  g.fillRect(x - w1 / 2 - 2, t1 - 4, w1 + 4, 4);
  g.fillStyle(0x3a8230);
  g.fillCircle(x - 36, t1 - 7, 4);
  g.fillCircle(x + 36, t1 - 7, 4);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - w1 / 2, t1 - 8, 12, 4);
  g.fillRect(x + w1 / 2 - 12, t1 - 8, 12, 4);

  // Tier 2 (y - 180 to y - 360, width 64)
  const w2 = 64;
  const t2 = y - 360;
  g.fillStyle(0x242830);
  g.fillRect(x - w2 / 2, t2, w2, 180);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(x - w2 / 2 + 3, t2 + 4, w2 - 6, 172);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(x + w2 * 0.15, t2 + 4, w2 * 0.35 - 3, 172);

  for (let fy = t2 + 14; fy < t1 - 8; fy += 14) {
    g.fillStyle(0x181c22, 0.45);
    g.fillRect(x - w2 / 2 + 3, fy, w2 - 6, 2.5);
    g.fillStyle(0xfff8d0, 0.85);
    for (let wx = x - w2 / 2 + 6; wx < x + w2 / 2 - 6; wx += 8) {
      if ((wx + fy) % 2 === 0) g.fillRect(wx, fy + 3, 4, 7);
    }
  }
  g.fillStyle(0xd4af37, 0.6);
  for (let px = x - w2 / 2 + 6; px < x + w2 / 2 - 4; px += 10) {
    g.fillRect(px, t2 + 4, 1.5, 172);
  }

  // Setback Terrace 2 (y - 360): Observation Promenade
  g.fillStyle(CONCRETE);
  g.fillRect(x - w2 / 2 - 2, t2 - 4, w2 + 4, 4);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - w2 / 2, t2 - 7, 10, 3);
  g.fillRect(x + w2 / 2 - 10, t2 - 7, 10, 3);

  // Tier 3 (y - 360 to y - 490, width 42)
  const w3 = 42;
  const t3 = y - 490;
  g.fillStyle(0x242830);
  g.fillRect(x - w3 / 2, t3, w3, 130);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(x - w3 / 2 + 2, t3 + 3, w3 - 4, 124);

  for (let fy = t3 + 12; fy < t2 - 6; fy += 12) {
    g.fillStyle(0x181c22, 0.45);
    g.fillRect(x - w3 / 2 + 2, fy, w3 - 4, 2);
    g.fillStyle(0xffea80);
    for (let wx = x - w3 / 2 + 5; wx < x + w3 / 2 - 5; wx += 7) {
      g.fillRect(wx, fy + 2, 3.5, 6);
    }
  }

  // Art Deco Crown & Sunburst Chevrons
  g.fillStyle(ELECTRUM_GOLD);
  g.fillTriangle(x - 14, t3, x, y - 565, x + 14, t3);
  g.fillStyle(0xfffaaa);
  g.fillTriangle(x - 14, t3, x, y - 565, x - 2, t3);
  // Soaring gilded needle spire
  g.fillRect(x - 1.5, y - 580, 3, 90);
  g.fillStyle(0xffffff);
  g.fillCircle(x, y - 581, 2.5);

  // Grand Ground Colonnade & Portico Lobby
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(x - 48, y - 28, 96, 28);
  g.fillStyle(SUN_GLASS);
  g.fillRect(x - 22, y - 22, 44, 22);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 28, y - 24, 56, 3); // Gilded marquee canopy
}

function drawHeliosCenter(g, x, y) {
  footing(g, x, y, 136, CONCRETE_DARK);
  // Twin Sweeping Curved Glass Towers with High Skybridge
  const towerW = 42;
  const towerH = 385;
  const towers = [x - 38, x + 38];

  for (let tIdx = 0; tIdx < towers.length; tIdx++) {
    const tx = towers[tIdx];
    const left = tx - towerW / 2;
    const top = y - towerH;

    // Structural concrete / steel spine
    g.fillStyle(0x1c2430);
    g.fillRect(left, top, towerW, towerH);
    // Tinted sky glass curtain wall
    g.fillStyle(SKY_GLASS);
    g.fillRect(left + 2, top + 4, towerW - 4, towerH - 26);
    g.fillStyle(0x000000, 0.24);
    g.fillRect(left + towerW * 0.65, top + 4, towerW * 0.35 - 2, towerH - 26);
    g.fillStyle(0xffffff, 0.28);
    g.fillRect(left + 2, top + 4, 3, towerH - 26);

    // Floor spandrels and illuminated office window grid
    for (let fy = top + 14; fy < y - 26; fy += 14) {
      g.fillStyle(0x141a24, 0.4);
      g.fillRect(left + 2, fy, towerW - 4, 2);
      g.fillStyle(0xfff8d0, 0.85);
      for (let wx = left + 5; wx < left + towerW - 5; wx += 7) {
        if ((wx + fy) % 3 !== 0) g.fillRect(wx, fy + 3, 4, 7);
      }
    }

    // Vertical bronze mullions
    g.fillStyle(0xffffff, 0.35);
    for (let mx = left + 7; mx < left + towerW - 4; mx += 9) {
      g.fillRect(mx, top + 4, 1, towerH - 26);
    }

    // Aerodynamic curved rooftop crowns with architectural lighting
    g.fillStyle(0x28323e);
    g.fillRect(left, top - 12, towerW, 12);
    g.fillStyle(ELECTRUM_GOLD);
    g.fillRect(left + 4, top - 8, towerW - 8, 2);
  }

  // Articulated High-Altitude Skybridge connecting the towers at y - 280
  const bLeft = x - 26;
  const bTop = y - 288;
  const bW = 52;
  const bH = 20;
  g.fillStyle(0x182028);
  g.fillRect(bLeft, bTop, bW, bH);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(bLeft + 2, bTop + 3, bW - 4, bH - 6);
  // Diagonal Warren steel trusses across skybridge glass
  g.lineStyle(1.5, 0x182028);
  g.lineBetween(bLeft + 2, bTop + 3, bLeft + 18, bTop + bH - 3);
  g.lineBetween(bLeft + 18, bTop + bH - 3, bLeft + 34, bTop + 3);
  g.lineBetween(bLeft + 34, bTop + 3, bLeft + bW - 2, bTop + bH - 3);
  // Interior illuminated observation walkway
  g.fillStyle(0xfff8d0, 0.7);
  g.fillRect(bLeft + 4, bTop + 7, bW - 8, 4);

  // Central Geodesic Solar Observatory Orb atop Skybridge
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, y - 302, 13);
  g.fillStyle(0xfff080);
  g.fillCircle(x, y - 302, 11);
  // Geodesic structural facet lines on sphere
  g.lineStyle(1, 0xcaa020);
  g.lineBetween(x - 11, y - 302, x + 11, y - 302);
  g.lineBetween(x, y - 313, x, y - 291);
  g.lineBetween(x - 8, y - 308, x + 8, y - 296);
  // Concentric solar corona halo ring
  g.lineStyle(1.5, ELECTRUM_GOLD);
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4;
    g.lineBetween(x + Math.cos(ang) * 14, y - 302 + Math.sin(ang) * 14, x + Math.cos(ang) * 19, y - 302 + Math.sin(ang) * 19);
  }

  // Grand Ground Galleria connecting both towers
  g.fillStyle(0x182028);
  g.fillRect(x - 62, y - 26, 124, 26);
  g.fillStyle(SUN_GLASS);
  g.fillRect(x - 28, y - 20, 56, 20);
  g.fillStyle(0xfff8d0);
  g.fillRect(x - 14, y - 16, 28, 16);
  // Automatic sliding doors
  g.fillStyle(0x222222);
  g.fillRect(x - 0.5, y - 16, 1, 16);
}

// -------------------------------------------------------------
// WONDER 2: THE HANGING GARDENS OF BABYLON (CASCADING OASIS ZIGGURAT)
// -------------------------------------------------------------

function drawHangingGardens(g, x, y) {
  footing(g, x, y, 284, 0x6e5036, 70);

  // Stepped Plinth
  g.fillStyle(0x6e5036);
  g.fillRect(x - 138, y - 4, 276, 4);
  g.fillStyle(0x8c6644);
  g.fillRect(x - 134, y - 8, 268, 4);

  // 5 Monumental Terraced Setbacks
  const tiers = [
    { w: 260, h: 48, bays: 7, basinOffsets: [-70, 0, 70] },
    { w: 216, h: 46, bays: 6, basinOffsets: [-52, 0, 52] },
    { w: 172, h: 44, bays: 5, basinOffsets: [-40, 0, 40] },
    { w: 128, h: 42, bays: 4, basinOffsets: [-28, 0, 28] },
    { w: 84,  h: 40, bays: 2, basinOffsets: [0] },
  ];

  let curY = y - 8;
  for (let i = 0; i < tiers.length; i++) {
    const { w, h, bays, basinOffsets } = tiers[i];
    const top = curY - h;

    // 1. Warm baked Babylonian mudbrick & honey limestone wall
    const wallColor = (i % 2 === 0) ? 0xd4a872 : 0xbe925c;
    g.fillStyle(wallColor);
    g.fillRect(x - w / 2, top, w, h);

    // 3D Directional Volume Shading
    g.fillStyle(0xffffff, 0.16);
    g.fillRect(x - w / 2, top, w * 0.38, h);
    g.fillStyle(0x3e2814, 0.35);
    g.fillRect(x + w * 0.12, top, w * 0.38, h);

    // 2. Ishtar Gate Glazed Lapis Lazuli & Gold Frieze Band along parapet
    g.fillStyle(0x183b6e);
    g.fillRect(x - w / 2, top, w, 7);
    g.fillStyle(ELECTRUM_GOLD);
    g.fillRect(x - w / 2, top, w, 1);
    g.fillRect(x - w / 2, top + 6, w, 1);
    // Golden lion rosette reliefs along the frieze
    for (let rx = x - w / 2 + 8; rx < x + w / 2 - 6; rx += 16) {
      g.fillStyle(ELECTRUM_GOLD);
      g.fillRect(rx - 1.5, top + 2, 3, 3);
      g.fillStyle(0xfff0aa);
      g.fillRect(rx - 0.5, top + 3, 1, 1);
    }

    // 3. Multi-Bay Open-Air Arched Colonnade Promenade
    const baySpacing = (w - 24) / bays;
    for (let b = 0; b < bays; b++) {
      const ax = x - w / 2 + 12 + (b + 0.5) * baySpacing;
      const archR = Math.min(8.5, baySpacing * 0.35);
      const archH = h - 18;

      // Deep shaded interior arcade
      g.fillStyle(0x281a10);
      g.fillRect(ax - archR, top + 15, archR * 2, archH);
      g.fillCircle(ax, top + 15, archR);

      // Fluted stone columns flanking arch
      g.fillStyle(0xebd2aa);
      g.fillRect(ax - archR - 1.5, top + 13, 3, archH + 2);
      g.fillRect(ax + archR - 1.5, top + 13, 3, archH + 2);
      // Column capitals & arch keystone
      g.fillStyle(0x9a7248);
      g.fillRect(ax - archR - 2.5, top + 11, 5, 2.5);
      g.fillRect(ax + archR - 2.5, top + 11, 5, 2.5);
      g.fillRect(ax - 1.5, top + 9, 3, 3);

      // Royal glowing palace braziers inside arcades
      if ((i + b) % 2 === 0) {
        g.fillStyle(0xff8811, 0.85);
        g.fillCircle(ax, top + 22, 3);
        g.fillStyle(0xffea70, 0.95);
        g.fillCircle(ax, top + 22, 1.5);
      }
    }

    // 4. Terraced Stone Water Catchment Basins & Lion Spouts
    for (const off of basinOffsets) {
      const bx = x + off;
      // Carved stone catchment basin
      g.fillStyle(0x8a6642);
      g.fillRect(bx - 12, top + h - 6, 24, 6);
      // Aquamarine pool water
      g.fillStyle(0x2884a4);
      g.fillRect(bx - 10, top + h - 5, 20, 5);
      // Basin rim molding
      g.fillStyle(0xbfa078);
      g.fillRect(bx - 13, top + h - 7, 26, 1.5);

      // Sculpted Golden Lion-Head Spout Gargoyle
      g.fillStyle(ELECTRUM_GOLD);
      g.fillRect(bx - 3, top + 7, 6, 5);
      g.fillStyle(0x183040);
      g.fillRect(bx - 1, top + 10, 2, 2);
    }

    // 5. Voluminous Cascading Botanical Gardens & Overflowing Vines
    // Shadow under-foliage
    g.fillStyle(0x1e4620);
    g.fillRect(x - w / 2 - 4, top - 2, w + 8, 5);

    // Multi-layered lush ivy vines spilling over parapets
    g.fillStyle(0x3e8c38);
    for (let vx = x - w / 2 - 2; vx <= x + w / 2 + 2; vx += 5) {
      const drop = 5 + Math.sin(vx * 0.35 + i * 1.8) * 4 + Math.sin(vx * 0.8) * 3;
      g.fillRect(vx, top + 3, 4, drop);
    }
    g.fillStyle(0x62be4e);
    for (let vx = x - w / 2; vx <= x + w / 2; vx += 7) {
      const drop = 3 + Math.sin(vx * 0.42 + i) * 3;
      g.fillRect(vx, top + 4, 3, drop);
    }

    // Vibrant Magenta & Coral Bougainvillea Blossoms + Golden Jasmine
    for (let fx = x - w / 2 + 3; fx < x + w / 2 - 2; fx += 9) {
      const fy = top + 5 + Math.sin(fx * 0.35 + i * 1.8) * 4;
      g.fillStyle(fx % 2 === 0 ? 0xdd1e6c : 0xff4088);
      g.fillCircle(fx, fy, 2);
      if (fx % 3 === 0) {
        g.fillStyle(0xffd033);
        g.fillRect(fx + 3, fy - 1, 2, 2);
      }
    }

    // 6. Terraced Date Palms & Mediterranean Cypress on Setback Wings
    if (i > 0) {
      const wingW = (tiers[i - 1].w - w) / 2;
      const leftWingX = x - tiers[i - 1].w / 2 + wingW * 0.5;
      const rightWingX = x + w / 2 + wingW * 0.5;

      for (const px of [leftWingX, rightWingX]) {
        // Curved palm trunk
        g.fillStyle(0x6a482c);
        g.fillRect(px - 1.5, curY - 24, 3, 24);
        g.fillRect(px - 2.5, curY - 14, 2, 10);
        // Radiating palm fronds
        g.fillStyle(0x286426);
        g.fillCircle(px, curY - 26, 9);
        g.fillStyle(0x4ca838);
        g.fillCircle(px - 4, curY - 28, 6);
        g.fillCircle(px + 4, curY - 28, 6);
        g.fillCircle(px, curY - 32, 5);
        // Golden date clusters
        g.fillStyle(0xd47020);
        g.fillCircle(px - 1, curY - 24, 2);
        g.fillCircle(px + 1, curY - 24, 2);

        // Italian Cypress flanking palm
        const cpx = px + (px < x ? -8 : 8);
        g.fillStyle(0x18421c);
        g.fillTriangle(cpx, curY - 32, cpx - 3, curY, cpx + 3, curY);
        g.fillStyle(0x28602c);
        g.fillTriangle(cpx, curY - 32, cpx - 3, curY, cpx, curY);
      }
    }

    curY = top;
  }

  // 7. Summit Royal Botanical Belvedere (Pavilion of Queen Amytis)
  // White Pentelic marble stylobate
  g.fillStyle(MARBLE_WHITE);
  g.fillRect(x - 26, curY - 6, 52, 6);
  g.fillStyle(MARBLE_SHADE);
  g.fillRect(x - 26, curY - 2, 52, 2);

  // 6 Fluted marble columns
  g.fillStyle(MARBLE_WHITE);
  for (let cx = x - 22; cx <= x + 22; cx += 8.8) {
    g.fillRect(cx - 1.5, curY - 26, 3, 20);
    g.fillStyle(MARBLE_SHADE);
    g.fillRect(cx, curY - 26, 1.5, 20);
    g.fillStyle(MARBLE_WHITE);
  }

  // Classical entablature & dentil cornice
  g.fillStyle(MARBLE_WHITE);
  g.fillRect(x - 27, curY - 30, 54, 4);
  g.fillStyle(MARBLE_SHADE);
  g.fillRect(x - 27, curY - 27, 54, 1);

  // Ribbed Glazed Turquoise Dome (Sits atop entablature)
  const domeBase = curY - 30;
  const domeR = 17;
  g.fillStyle(0x168a7a);
  g.fillCircle(x, domeBase, domeR);
  // Redraw entablature so dome only appears as upper semicircle above domeBase
  g.fillStyle(MARBLE_WHITE);
  g.fillRect(x - 27, domeBase, 54, 4);
  g.fillStyle(0xd4af37); // Golden crest molding
  g.fillRect(x - 27, domeBase, 54, 1.5);

  // Specular sunlight sheen on turquoise dome
  g.fillStyle(0x2fe0cc, 0.5);
  g.fillCircle(x - 5, domeBase - 8, 9);

  // Gilded Bronze Finial & Crescent Apex
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 1.5, domeBase - domeR - 8, 3, 8);
  g.fillCircle(x, domeBase - domeR - 8, 4);
  g.fillStyle(0xfff0aa);
  g.fillCircle(x, domeBase - domeR - 8, 2);
}

function gardensFx(g, x, y, elapsed) {
  // Cascading animated waterfalls leaping between tiers
  const tierCascades = [
    { fromY: y - 221, toY: y - 188, streams: [x] },
    { fromY: y - 181, toY: y - 146, streams: [x - 28, x, x + 28] },
    { fromY: y - 139, toY: y - 102, streams: [x - 40, x, x + 40] },
    { fromY: y - 95,  toY: y - 56,  streams: [x - 52, x, x + 52] },
    { fromY: y - 49,  toY: y - 8,   streams: [x - 70, x, x + 70] },
  ];

  for (const { fromY, toY, streams } of tierCascades) {
    for (const sx of streams) {
      const shimmer = Math.sin(elapsed * 12 + sx * 0.1) * 0.15;
      // Translucent falling aquamarine stream
      g.fillStyle(0x6ad4ff, 0.72 + shimmer);
      g.fillRect(sx - 2.5, fromY, 5, toY - fromY);
      // Bright white inner core
      g.fillStyle(0xffffff, 0.88);
      g.fillRect(sx - 1, fromY, 2, toY - fromY);

      // Foaming splash crest in the catchment basin
      const foamR = 3.5 + Math.sin(elapsed * 16 + sx) * 1.5;
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(sx, toY - 2, foamR);
      g.fillStyle(0x78e8ff, 0.6);
      g.fillCircle(sx, toY - 1, foamR + 2);
    }
  }

  // Drifting flower petals carried on the breeze
  for (let p = 0; p < 8; p++) {
    const pt = (elapsed * 0.6 + p * 0.38) % 2.5;
    const px = x - 85 + ((p * 27 + pt * 40) % 170);
    const py = y - 220 + (pt * 80);
    g.fillStyle(p % 2 === 0 ? 0xff4088 : 0xffd033, 0.8 - pt * 0.25);
    g.fillRect(px, py, 2.5, 2.5);
  }
}

// -------------------------------------------------------------
// LONG PLAINS & LONGFIELD CIVILIAN RANCHES & SETTLEMENTS
// -------------------------------------------------------------

function drawSavannaHomestead(g, x, y) {
  footing(g, x, y, 126, 0x6e5238);
  const left = x - 54;
  const hW = 108;
  const hH = 54;
  const top = y - hH;

  // 1. Rusticated River-Stone Foundation Plinth
  g.fillStyle(0x605244);
  g.fillRect(left - 2, y - 8, hW + 4, 8);
  g.fillStyle(0x7a6a58);
  for (let bx = left; bx < left + hW; bx += 12) {
    g.fillRect(bx, y - 7, 10, 3);
  }

  // 2. Main 2-Story Cedar Clapboard Ranch House
  g.fillStyle(0xc8985c);
  g.fillRect(left, top, hW, hH - 8);
  // Volume Shading: Sunward warm highlight left, gentle shadow right
  g.fillStyle(0xffffff, 0.14);
  g.fillRect(left, top, hW * 0.45, hH - 8);
  g.fillStyle(0x3e2814, 0.22);
  g.fillRect(left + hW * 0.65, top, hW * 0.35, hH - 8);

  // Horizontal cedar lap-siding lines
  g.fillStyle(0x9a6838, 0.45);
  for (let ly = top + 6; ly < y - 10; ly += 6) {
    g.fillRect(left, ly, hW, 1);
  }

  // 3. Shaded Wrap-Around Veranda Porch with Turned Posts & Railings
  g.fillStyle(0x8a5832);
  g.fillRect(left - 4, y - 12, hW + 8, 4); // Porch timber floor
  // Turned veranda support posts
  for (let px = left - 2; px <= left + hW + 2; px += 22) {
    g.fillStyle(0x52341c);
    g.fillRect(px - 1.5, y - 36, 3, 24);
    g.fillStyle(0xeee8d8); // Painted white post trim
    g.fillRect(px - 1, y - 36, 2, 24);
  }
  // Cross-buck veranda railings
  g.fillStyle(0xeee8d8);
  g.fillRect(left - 4, y - 22, hW + 8, 2);
  g.fillRect(left - 4, y - 14, hW + 8, 1.5);
  // Porch steps
  g.fillStyle(0x6e4224);
  g.fillRect(x - 12, y - 8, 24, 8);

  // 4. Multi-Pane Double-Hung Sash Windows with Green Shutters
  for (const wx of [left + 16, left + 44, left + 76]) {
    // Upper story windows
    g.fillStyle(0x284a32); // Dark green shutters
    g.fillRect(wx - 7, top + 8, 14, 14);
    g.fillStyle(0xfff6cf); // Warm interior glow
    g.fillRect(wx - 5, top + 9, 10, 12);
    g.fillStyle(0x284a32); // Window sash muntins
    g.fillRect(wx - 0.5, top + 9, 1, 12);
    g.fillRect(wx - 5, top + 15, 10, 1);

    // Lower story windows (behind porch)
    g.fillStyle(0x284a32);
    g.fillRect(wx - 6, y - 32, 12, 16);
    g.fillStyle(0xffe890, 0.9);
    g.fillRect(wx - 4, y - 31, 8, 14);
  }

  // Front Entry Door
  g.fillStyle(0x4a2814);
  g.fillRect(x - 6, y - 28, 12, 20);
  g.fillStyle(0xd4af37); // Brass doorknob
  g.fillCircle(x + 3, y - 18, 1.5);

  // 5. Pitched Cedar Shake Shingle Roof with Gabled Dormers
  g.fillStyle(0x764228);
  g.fillTriangle(left - 8, top, x, top - 28, left + hW + 8, top);
  g.fillStyle(0x8e5234); // Sunlit roof face
  g.fillTriangle(left - 8, top, x, top - 28, x, top);
  // Roof overhang fascia
  g.fillStyle(0x422414);
  g.fillRect(left - 8, top - 2, hW + 16, 3);

  // Center Gabled Attic Dormer
  g.fillStyle(0xc8985c);
  g.fillRect(x - 10, top - 18, 20, 16);
  g.fillStyle(0x764228);
  g.fillTriangle(x - 12, top - 18, x, top - 28, x + 12, top - 18);
  g.fillStyle(0xfff6cf);
  g.fillCircle(x, top - 10, 4);

  // 6. Massive River-Rock Stone Chimney on East Gable
  g.fillStyle(0x56483c);
  g.fillRect(left + hW - 4, y - 82, 14, 74);
  g.fillStyle(0x786a5e);
  for (let cy = y - 76; cy < y - 14; cy += 8) {
    g.fillRect(left + hW - 3, cy, 12, 3);
  }
  // Chimney cap & curling smoke
  g.fillStyle(0x3e342c);
  g.fillRect(left + hW - 6, y - 86, 18, 4);
  g.fillStyle(0xeeeeee, 0.35);
  g.fillCircle(left + hW + 3, y - 92, 5);
  g.fillCircle(left + hW + 6, y - 100, 8);

  // 7. Western Aeration Farm Windmill & Water Well (at x - 48)
  const wmx = left - 18;
  // Timber lattice derrick tower
  g.fillStyle(0x5a3e26);
  g.fillRect(wmx - 5, y - 62, 10, 2);
  g.fillRect(wmx - 4, y - 40, 8, 2);
  g.lineStyle(1.5, 0x6e4a2e);
  g.lineBetween(wmx - 7, y - 4, wmx - 3, y - 72);
  g.lineBetween(wmx + 7, y - 4, wmx + 3, y - 72);
  g.lineBetween(wmx - 7, y - 4, wmx + 3, y - 40);
  g.lineBetween(wmx + 7, y - 4, wmx - 3, y - 40);
  g.lineBetween(wmx - 5, y - 40, wmx + 3, y - 72);
  // Windmill hub & galvanized 4-blade aeration wheel
  g.fillStyle(0x282828);
  g.fillCircle(wmx, y - 74, 3);
  g.fillStyle(0xdcdad2);
  for (let a = 0; a < 4; a++) {
    const rad = a * Math.PI / 2 + 0.3;
    g.fillRect(wmx + Math.cos(rad) * 12 - 1.5, y - 74 + Math.sin(rad) * 12 - 1.5, 3, 3);
    g.lineStyle(1, 0xaaaaaa);
    g.lineBetween(wmx, y - 74, wmx + Math.cos(rad) * 12, y - 74 + Math.sin(rad) * 12);
  }
  // Vane tail fin
  g.fillStyle(0xaa2211);
  g.fillRect(wmx + 3, y - 76, 9, 5);

  // Wooden water trough & barrels
  g.fillStyle(0x5a381e);
  g.fillRect(wmx - 10, y - 8, 20, 8);
  g.fillStyle(0x3a88a8);
  g.fillRect(wmx - 8, y - 6, 16, 5);
}

function drawWildlifeStation(g, x, y) {
  footing(g, x, y, 110, 0x5a4836);
  const left = x - 48;
  const sW = 96;
  const stiltH = 16;
  const cabinH = 46;
  const cTop = y - stiltH - cabinH;

  // 1. Heavy Timber Stilt Piling Foundation
  g.fillStyle(0x423020);
  for (const px of [left + 4, left + 28, left + 68, left + sW - 4]) {
    g.fillRect(px - 2.5, y - stiltH - 2, 5, stiltH + 2);
  }
  // Diagonal timber sway braces
  g.lineStyle(1.5, 0x423020);
  g.lineBetween(left + 4, y - 2, left + 28, y - stiltH);
  g.lineBetween(left + 28, y - 2, left + 4, y - stiltH);
  g.lineBetween(left + 68, y - 2, left + sW - 4, y - stiltH);
  g.lineBetween(left + sW - 4, y - 2, left + 68, y - stiltH);

  // Wooden access ladder / stair
  g.fillStyle(0x5a4028);
  g.fillRect(left - 8, y - stiltH, 10, stiltH);
  for (let sy = y - 4; sy > y - stiltH; sy -= 4) {
    g.fillRect(left - 9, sy, 12, 1.5);
  }

  // 2. Weatherproof Safari Field Laboratory Cabin
  g.fillStyle(0xd6c4a2); // Safari khaki painted wood
  g.fillRect(left, cTop, sW, cabinH);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(left, cTop, sW * 0.45, cabinH);
  g.fillStyle(0x3e3220, 0.25);
  g.fillRect(left + sW * 0.65, cTop, sW * 0.35, cabinH);

  // Horizontal tongue-and-groove siding lines
  g.fillStyle(0xa89678, 0.4);
  for (let ly = cTop + 5; ly < y - stiltH; ly += 5) {
    g.fillRect(left, ly, sW, 1);
  }

  // 3. Panoramic Wrap-Around Observation Windows
  g.fillStyle(0x182834);
  g.fillRect(left + 8, cTop + 10, sW - 16, 18);
  g.fillStyle(SKY_GLASS);
  g.fillRect(left + 10, cTop + 11, sW - 20, 16);
  // Interior research charts, field maps, and glowing lantern
  g.fillStyle(0xfff4cc, 0.75);
  for (let wx = left + 14; wx < left + sW - 14; wx += 14) {
    g.fillRect(wx, cTop + 13, 8, 12);
  }
  // Window frame mullions
  g.fillStyle(0x423020);
  for (let mx = left + 10; mx <= left + sW - 10; mx += 14) {
    g.fillRect(mx - 1, cTop + 10, 2, 18);
  }

  // 4. Overhanging Safari Canvas Canopy Sun-Fly
  g.fillStyle(0x8a6234);
  g.fillRect(left - 6, cTop - 4, sW + 12, 4);
  g.fillStyle(0xdcc89c); // Sand canvas
  g.fillTriangle(left - 8, cTop - 4, x, cTop - 20, left + sW + 8, cTop - 4);
  g.fillStyle(0xc8b284);
  g.fillTriangle(x, cTop - 20, left + sW + 8, cTop - 4, x, cTop - 4);

  // Guy ropes & tensioners
  g.lineStyle(1, 0x8a6c42);
  g.lineBetween(left - 8, cTop - 4, left - 12, y - stiltH);
  g.lineBetween(left + sW + 8, cTop - 4, left + sW + 12, y - stiltH);

  // 5. Exterior Viewing Deck with Swivel Brass Binoculars
  g.fillStyle(0x5a3e26);
  g.fillRect(left - 12, y - stiltH - 2, 12, 2);
  g.fillRect(left + sW, y - stiltH - 2, 12, 2);
  // Perimeter deck railing
  g.fillStyle(0x4a321c);
  g.fillRect(left - 12, y - stiltH - 12, sW + 24, 2);
  for (let rx = left - 10; rx <= left + sW + 10; rx += 14) {
    g.fillRect(rx - 1, y - stiltH - 12, 2, 10);
  }
  // Mounted safari binoculars on observation deck
  g.fillStyle(0xd4af37);
  g.fillRect(left + sW + 2, y - stiltH - 20, 2, 8);
  g.fillRect(left + sW, y - stiltH - 22, 6, 3);

  // 6. Scientific Telemetry Mast & Solar Photovoltaic Panels
  // Solar panels on roof
  g.fillStyle(0x182844);
  g.fillRect(x - 24, cTop - 15, 18, 9);
  g.fillStyle(0x285078);
  g.fillRect(x - 22, cTop - 13, 14, 5);

  // Radio telemetry antenna mast
  g.fillStyle(0x333333);
  g.fillRect(x + 18, cTop - 38, 2, 24);
  g.fillCircle(x + 19, cTop - 38, 2);
  // Anemometer spinning cups
  g.fillStyle(0xaaaaaa);
  g.fillRect(x + 14, cTop - 36, 10, 1.5);
  g.fillCircle(x + 14, cTop - 36, 2);
  g.fillCircle(x + 24, cTop - 36, 2);
}

function drawSavannaGrainMill(g, x, y) {
  footing(g, x, y, 136, 0x5a4e42);
  const left = x - 64;

  // 1. Reinforced Concrete Foundation Pad
  g.fillStyle(0x7c7872);
  g.fillRect(left, y - 8, 128, 8);
  g.fillStyle(0x969088);
  g.fillRect(left + 2, y - 8, 124, 2);

  // 2. Triple Cylindrical Corrugated Galvanized Metal Grain Silos (at x - 42, x - 18, x + 6)
  const siloRadius = 12;
  const siloHeight = 65;
  for (let s = 0; s < 3; s++) {
    const sx = left + 18 + s * 24;
    const sTop = y - 8 - siloHeight;

    // Silo cylindrical barrel
    g.fillStyle(0xaeb4bc);
    g.fillRect(sx - siloRadius, sTop, siloRadius * 2, siloHeight);
    // Cylindrical volume shading
    g.fillStyle(0xffffff, 0.22);
    g.fillRect(sx - siloRadius, sTop, siloRadius * 0.7, siloHeight);
    g.fillStyle(0x28323c, 0.3);
    g.fillRect(sx + siloRadius * 0.2, sTop, siloRadius * 0.8, siloHeight);

    // Horizontal corrugated rib rings
    g.fillStyle(0x7e8690, 0.5);
    for (let ry = sTop + 6; ry < y - 8; ry += 6) {
      g.fillRect(sx - siloRadius, ry, siloRadius * 2, 1);
    }

    // Conical galvanized steel silo roof cap
    g.fillStyle(0x8a929c);
    g.fillTriangle(sx - siloRadius - 1, sTop, sx, sTop - 14, sx + siloRadius + 1, sTop);
    g.fillStyle(0xbac2cc);
    g.fillTriangle(sx - siloRadius - 1, sTop, sx, sTop - 14, sx, sTop);
    g.fillStyle(0x5a6068);
    g.fillRect(sx - 1, sTop - 16, 2, 3); // Vented apex cap

    // Exterior safety ladder
    g.fillStyle(0x384048);
    g.fillRect(sx + siloRadius - 3, sTop + 2, 2, siloHeight - 2);
    for (let ly = sTop + 6; ly < y - 8; ly += 6) {
      g.fillRect(sx + siloRadius - 4, ly, 4, 1);
    }
  }

  // 3. Soaring Central Timber Bucket-Elevator Tower (at x + 40)
  const tx = left + 96;
  const tW = 32;
  const tH = 118;
  const tTop = y - 8 - tH;

  // Traditional weathered red-iron barn paint
  g.fillStyle(0x8e2c22);
  g.fillRect(tx - tW / 2, tTop, tW, tH);
  g.fillStyle(0xffffff, 0.16);
  g.fillRect(tx - tW / 2, tTop, tW * 0.45, tH);
  g.fillStyle(0x28100c, 0.32);
  g.fillRect(tx + tW * 0.15, tTop, tW * 0.35, tH);

  // Vertical board-and-batten siding
  g.fillStyle(0x6a1e16, 0.5);
  for (let bx = tx - tW / 2 + 4; bx < tx + tW / 2; bx += 5) {
    g.fillRect(bx, tTop, 1, tH);
  }

  // Clerestory ventilation cupola atop elevator tower
  g.fillStyle(0x6e2018);
  g.fillRect(tx - 12, tTop - 10, 24, 10);
  g.fillStyle(0x18100c); // Louvered vents
  for (let vy = tTop - 8; vy < tTop - 2; vy += 2.5) {
    g.fillRect(tx - 10, vy, 20, 1);
  }
  // Gabled cupola roof
  g.fillStyle(0x4a1410);
  g.fillTriangle(tx - 14, tTop - 10, tx, tTop - 18, tx + 14, tTop - 10);

  // 4. Heavy Overhead Grain Auger Conveyor Chutes
  g.fillStyle(0x4a525c);
  // Diagonal auger chute bridging elevator head to silos
  g.fillRect(tx - 68, tTop + 18, 70, 4);
  g.lineStyle(1.5, 0x384048);
  g.lineBetween(tx - tW / 2, tTop + 20, left + 18, y - 8 - siloHeight - 10);
  g.lineBetween(tx - tW / 2, tTop + 20, left + 66, y - 8 - siloHeight - 10);

  // 5. Covered Wagon / Truck Grain Dump & Loading Dock
  g.fillStyle(0x6e4a2c);
  g.fillRect(tx - 24, y - 24, 48, 16); // Timber covered loading bay
  g.fillStyle(0x1c140c);
  g.fillRect(tx - 18, y - 20, 36, 12); // Open dump bay
  // Stacked burlap grain sacks on platform
  g.fillStyle(0xc8b488);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4 - row; col++) {
      g.fillRect(tx + 4 + col * 5 + row * 2, y - 12 - row * 3, 5, 3);
    }
  }
}

function drawLongfieldTownHall(g, x, y) {
  footing(g, x, y, 142, 0x6e5238);
  const left = x - 64;
  const bW = 128;
  const bH = 68;
  const top = y - bH;

  // 1. Rusticated Foundation & Boardwalk Steps
  g.fillStyle(0x6e5848);
  g.fillRect(left - 2, y - 8, bW + 4, 8);
  g.fillStyle(0x8a7260);
  g.fillRect(left, y - 8, bW, 2);
  // Grand center entrance steps
  g.fillStyle(0x564234);
  g.fillRect(x - 24, y - 6, 48, 6);
  g.fillStyle(0x765c48);
  g.fillRect(x - 22, y - 4, 44, 4);

  // 2. Classical 2-Story Painted Clapboard Facade (Parchment White)
  g.fillStyle(0xf0ebe0);
  g.fillRect(left, top, bW, bH - 8);
  // Architectural Volume Shading
  g.fillStyle(0xffffff, 0.18);
  g.fillRect(left, top, bW * 0.45, bH - 8);
  g.fillStyle(0x38342c, 0.18);
  g.fillRect(left + bW * 0.65, top, bW * 0.35, bH - 8);

  // Horizontal clapboard siding lines
  g.fillStyle(0xc2bcaf, 0.5);
  for (let ly = top + 5; ly < y - 10; ly += 5) {
    g.fillRect(left, ly, bW, 1);
  }

  // 3. Double-Decker Pillared Portico with Classical Pediment
  const pW = 54;
  const pLeft = x - pW / 2;
  // 4 Monumental Square Corinthian Columns
  for (let i = 0; i < 4; i++) {
    const cx = pLeft + 4 + i * 15;
    g.fillStyle(0xded8cc);
    g.fillRect(cx - 2, top, 4, bH - 8);
    g.fillStyle(0xffffff); // Sunlit highlight on column
    g.fillRect(cx - 2, top, 2, bH - 8);
    // Column capital & plinth
    g.fillStyle(0xb8b0a2);
    g.fillRect(cx - 3, top, 6, 2.5);
    g.fillRect(cx - 3, y - 11, 6, 3);
  }

  // Classical Triangular Portico Pediment with Carved Gold Seal
  g.fillStyle(0xe2dcd0);
  g.fillTriangle(pLeft - 4, top, x, top - 20, pLeft + pW + 4, top);
  g.fillStyle(0xffffff);
  g.fillTriangle(pLeft - 4, top, x, top - 20, x, top);
  g.fillStyle(0xb8b0a2);
  g.fillRect(pLeft - 4, top - 2, pW + 8, 3);

  // Gilded Town Seal Medallion in pediment tympanum
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, top - 8, 5);
  g.fillStyle(0xfff090);
  g.fillCircle(x, top - 8, 3);

  // 4. Double Entrance Doors & Stained Glass Fanlight
  g.fillStyle(0x422214); // Polished mahogany doors
  g.fillRect(x - 9, y - 28, 18, 20);
  g.fillStyle(0x28120a);
  g.fillRect(x - 8, y - 26, 7, 18);
  g.fillRect(x + 1, y - 26, 7, 18);
  g.fillStyle(ELECTRUM_GOLD); // Brass push plates & handles
  g.fillRect(x - 2, y - 18, 1, 4);
  g.fillRect(x + 1, y - 18, 1, 4);
  // Arched fanlight transom above entrance
  g.fillStyle(0x285078);
  g.fillCircle(x, y - 28, 8);
  g.fillRect(x - 8, y - 28, 16, 2);

  // 5. Symmetrical Multi-Pane Sash Windows with Dark Forest-Green Shutters
  for (const wx of [left + 16, left + 36, left + bW - 36, left + bW - 16]) {
    // Upper floor windows
    g.fillStyle(0x1e4228); // Green shutters
    g.fillRect(wx - 7, top + 8, 14, 16);
    g.fillStyle(0xfff8d0); // Warm civic chandelier light
    g.fillRect(wx - 5, top + 9, 10, 14);
    g.fillStyle(0x1e4228); // Muntins
    g.fillRect(wx - 0.5, top + 9, 1, 14);
    g.fillRect(wx - 5, top + 16, 10, 1);

    // Ground floor windows
    g.fillStyle(0x1e4228);
    g.fillRect(wx - 7, y - 32, 14, 18);
    g.fillStyle(0xfff0aa);
    g.fillRect(wx - 5, y - 31, 10, 16);
    g.fillStyle(0x1e4228);
    g.fillRect(wx - 0.5, y - 31, 1, 16);
    g.fillRect(wx - 5, y - 23, 10, 1);
  }

  // 6. Grand Wooden Clock Tower Stage & Bell Belfry (Apex at y - 134)
  const twW = 36;
  const twH = 34;
  const twTop = top - 20 - twH;

  // Tower Base Stage
  g.fillStyle(0xded8cc);
  g.fillRect(x - twW / 2, twTop, twW, twH);
  g.fillStyle(0xffffff, 0.2);
  g.fillRect(x - twW / 2, twTop, twW * 0.45, twH);

  // Round White Clock Face with Roman Numerals
  g.fillStyle(0x282420); // Dark clock bezel
  g.fillCircle(x, twTop + 16, 11);
  g.fillStyle(0xffffff); // White porcelain dial
  g.fillCircle(x, twTop + 16, 9.5);
  // Black hands pointing to 10:10
  g.lineStyle(1.5, 0x111111);
  g.lineBetween(x, twTop + 16, x - 5, twTop + 12);
  g.lineBetween(x, twTop + 16, x + 6, twTop + 13);
  g.fillStyle(0x111111);
  g.fillCircle(x, twTop + 16, 1.5);

  // 7. Open Octagonal Bell Cupola with Brass Bell
  const cTop = twTop - 22;
  g.fillStyle(0xc8c2b4);
  g.fillRect(x - 14, cTop, 28, 22);
  // Open arched belfry openings
  g.fillStyle(0x181816);
  g.fillRect(x - 9, cTop + 4, 18, 16);
  g.fillCircle(x, cTop + 4, 9);
  // Solid Brass Town Bell
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, cTop + 12, 6);
  g.fillRect(x - 6, cTop + 12, 12, 3);

  // Weathered Copper Octagonal Dome & Gilded Weather Vane
  g.fillStyle(COPPER_ROOF);
  g.fillTriangle(x - 16, cTop, x, cTop - 18, x + 16, cTop);
  g.fillStyle(COPPER_LIGHT);
  g.fillTriangle(x - 16, cTop, x, cTop - 18, x, cTop);

  // Gilded Finial & Arrow Wind Vane
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 1, cTop - 26, 2, 8);
  g.fillCircle(x, cTop - 26, 2.5);
  g.fillRect(x - 6, cTop - 24, 12, 1.5); // Cardinal arrow
}

function drawLongfieldTradingPost(g, x, y) {
  footing(g, x, y, 116, 0x6e5238);
  const left = x - 52;
  const pW = 104;
  const pH = 56;
  const top = y - pH;

  // 1. Raised Timber Boardwalk Porch with Hitching Post
  g.fillStyle(0x7c5836);
  g.fillRect(left - 4, y - 8, pW + 8, 8);
  g.fillStyle(0x9a7248);
  g.fillRect(left - 4, y - 8, pW + 8, 2);

  // Wooden Hitching Rail & Barrels
  g.fillStyle(0x56381e);
  g.fillRect(left - 2, y - 16, pW * 0.35, 2);
  g.fillRect(left - 2, y - 16, 2, 16);
  g.fillRect(left + pW * 0.35 - 2, y - 16, 2, 16);
  // Pickle & molasses barrels
  g.fillStyle(0x6a4628);
  g.fillRect(left + pW - 14, y - 14, 6, 8);
  g.fillRect(left + pW - 7, y - 16, 7, 10);

  // 2. Western Frontier False-Front Parapet in Warm Golden Ochre
  g.fillStyle(0xb88842);
  g.fillRect(left, top - 14, pW, pH + 6);
  g.fillStyle(0xffffff, 0.15);
  g.fillRect(left, top - 14, pW * 0.45, pH + 6);
  g.fillStyle(0x28180a, 0.25);
  g.fillRect(left + pW * 0.65, top - 14, pW * 0.35, pH + 6);

  // Stepped False-Front Decorative Crown Cornice
  g.fillStyle(0x8a5e24);
  g.fillRect(left - 2, top - 18, pW + 4, 4);
  g.fillRect(left + 16, top - 24, pW - 32, 6);
  g.fillRect(left + 32, top - 28, pW - 64, 4);

  // Horizontal timber planking
  g.fillStyle(0x7c5420, 0.45);
  for (let ly = top - 12; ly < y - 10; ly += 5) {
    g.fillRect(left, ly, pW, 1);
  }

  // 3. Painted Store Signboard Banner
  g.fillStyle(0x2a1a0c);
  g.fillRect(x - 38, top - 8, 76, 11);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 36, top - 6, 72, 7);
  g.fillStyle(0x2a1a0c);
  // Sign text simulated lettering
  for (let tx = x - 32; tx <= x + 28; tx += 6) {
    g.fillRect(tx, top - 4, 4, 3);
  }

  // 4. Striped Storefront Canvas Awning Over Porch
  g.fillStyle(0x9a3224); // Red and cream awning
  g.fillRect(left - 2, top + 18, pW + 4, 8);
  for (let ax = left - 2; ax < left + pW + 2; ax += 12) {
    g.fillStyle(0xf2ede0);
    g.fillRect(ax, top + 18, 6, 8);
  }
  // Scalloped valance fringe
  g.fillStyle(0x9a3224);
  for (let ax = left - 2; ax < left + pW + 2; ax += 6) {
    g.fillCircle(ax + 3, top + 26, 2.5);
  }

  // 5. Twin Storefront Multi-Pane Bay Windows & Goods
  g.fillStyle(0x181008);
  g.fillRect(left + 8, top + 28, 34, 18);
  g.fillRect(left + pW - 42, top + 28, 34, 18);
  g.fillStyle(0xfff2b0); // Warm store interior
  g.fillRect(left + 10, top + 29, 30, 16);
  g.fillRect(left + pW - 40, top + 29, 30, 16);
  // Store display goods simulated on shelves
  g.fillStyle(0xaa3322);
  g.fillRect(left + 14, top + 36, 6, 7);
  g.fillStyle(0x286040);
  g.fillRect(left + 24, top + 34, 5, 9);
  g.fillStyle(0xd4af37);
  g.fillRect(left + pW - 32, top + 35, 6, 8);
  // Window frames
  g.fillStyle(0x3e2410);
  g.fillRect(left + 8, top + 28, 34, 2);
  g.fillRect(left + pW - 42, top + 28, 34, 2);

  // Center Double Entrance Door
  g.fillStyle(0x3e2010);
  g.fillRect(x - 7, top + 26, 14, 22);
  g.fillStyle(0xfff2b0);
  g.fillRect(x - 5, top + 28, 10, 8); // Door glass
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x + 3, top + 39, 1.5);

  // Upper Story Living Quarters Windows
  for (const ux of [left + 22, left + pW - 22]) {
    g.fillStyle(0x2e1808);
    g.fillRect(ux - 6, top + 2, 12, 12);
    g.fillStyle(0xffeaa0);
    g.fillRect(ux - 4, top + 3, 8, 10);
    g.fillStyle(0x2e1808);
    g.fillRect(ux - 0.5, top + 3, 1, 10);
  }

  // Stovepipe Chimney with Curling Smoke
  g.fillStyle(0x222222);
  g.fillRect(left + pW - 16, top - 32, 4, 18);
  g.fillStyle(0xaaaaaa, 0.4);
  g.fillCircle(left + pW - 14, top - 36, 4);
  g.fillCircle(left + pW - 12, top - 44, 6);
}

function drawSavannaArtisanBarn(g, x, y) {
  footing(g, x, y, 108, 0x604a36);
  const left = x - 48;
  const bW = 96;
  const bH = 58;
  const top = y - bH;

  // 1. Foundation & Rustic Barn Timber Flooring
  g.fillStyle(0x5a4838);
  g.fillRect(left - 2, y - 6, bW + 4, 6);

  // 2. Traditional Dutch Gambrel Barn in Barn-Red
  g.fillStyle(0x942e20);
  g.fillRect(left, top, bW - 28, bH - 6);
  g.fillStyle(0xffffff, 0.15);
  g.fillRect(left, top, (bW - 28) * 0.45, bH - 6);
  g.fillStyle(0x220a06, 0.3);
  g.fillRect(left + (bW - 28) * 0.65, top, (bW - 28) * 0.35, bH - 6);

  // Vertical board-and-batten white trim lines
  g.fillStyle(0xeee8dc);
  g.fillRect(left, top, 3, bH - 6);
  g.fillRect(left + bW - 31, top, 3, bH - 6);

  // Gambrel Multi-Sloped Roof (Steep lower slope, gentle upper slope)
  const gW = bW - 28;
  g.fillStyle(0x6e2016);
  g.fillTriangle(left - 4, top, left + gW / 2, top - 24, left + gW + 4, top);
  g.fillStyle(0x8a2a1e);
  g.fillTriangle(left - 4, top, left + gW / 2, top - 24, left + gW / 2, top);

  // Upper Hayloft Loading Door with Timber Hoist Beam
  g.fillStyle(0x280e08);
  g.fillRect(left + gW / 2 - 8, top - 14, 16, 14);
  g.fillStyle(0xeee8dc); // Cross-buck trim
  g.fillRect(left + gW / 2 - 7, top - 13, 14, 12);
  g.fillStyle(0x942e20);
  g.fillRect(left + gW / 2 - 6, top - 12, 5, 10);
  g.fillRect(left + gW / 2 + 1, top - 12, 5, 10);
  // Projecting timber hoist beam with rope pulley
  g.fillStyle(0x4a2a14);
  g.fillRect(left + gW / 2 - 1.5, top - 26, 3, 14);
  g.fillStyle(0xd4af37); // Pulley wheel
  g.fillCircle(left + gW / 2, top - 16, 2);

  // 3. Ground Level Cross-Buck Barn Doors
  g.fillStyle(0xeee8dc);
  g.fillRect(left + 12, y - 28, 22, 22);
  g.fillStyle(0x942e20);
  g.fillRect(left + 14, y - 26, 8, 18);
  g.fillRect(left + 24, y - 26, 8, 18);

  // 4. Open-Air Blacksmithing & Forge Bay on East Side
  const forgeLeft = left + gW;
  const forgeW = 28;
  // Timber posts supporting forge lean-to roof
  g.fillStyle(0x4e341c);
  g.fillRect(forgeLeft + forgeW - 3, y - 36, 3, 30);
  // Sloped corrugated iron lean-to roof
  g.fillStyle(0x687480);
  g.fillTriangle(forgeLeft - 2, top + 12, forgeLeft + forgeW + 2, y - 36, forgeLeft - 2, y - 36);

  // Fieldstone Forge Hearth & Chimney
  g.fillStyle(0x56483c);
  g.fillRect(forgeLeft + 4, y - 56, 12, 50);
  // Glowing cherry-red forge embers
  g.fillStyle(0xff3311);
  g.fillCircle(forgeLeft + 8, y - 20, 4);
  g.fillStyle(0xffbb22);
  g.fillCircle(forgeLeft + 8, y - 20, 2);

  // Cast Iron Blacksmith Anvil on Oak Stump
  g.fillStyle(0x5a3e26); // Oak stump
  g.fillRect(forgeLeft + 16, y - 10, 8, 4);
  g.fillStyle(0x282a30); // Iron anvil
  g.fillRect(forgeLeft + 15, y - 16, 10, 6);
  g.fillRect(forgeLeft + 13, y - 16, 4, 2); // Anvil horn

  // Wagon Wheelwright Rack with Wheels
  g.fillStyle(0x6e4624);
  g.fillCircle(forgeLeft + 25, y - 8, 6);
  g.fillStyle(0x181818);
  g.fillCircle(forgeLeft + 25, y - 8, 1.5);

  // Forge Smoke Billowing
  g.fillStyle(0x888888, 0.45);
  g.fillCircle(forgeLeft + 10, y - 62, 5);
  g.fillCircle(forgeLeft + 14, y - 70, 7);
}

function drawTransitHub(g, x, y) {
  footing(g, x, y, 150, CONCRETE_DARK);
  const left = x - 75;
  const tTop = y - 60;

  // 1. Sleek Modern Transit Concourse Podium (y to y - 60)
  g.fillStyle(0x283038);
  g.fillRect(left, tTop, 150, 60);
  g.fillStyle(0x3a4450);
  g.fillRect(left + 4, tTop + 4, 142, 52);

  // 2. High-Tech Aerodynamic Monorail Guideway & Train
  // Monorail elevated concrete guideway beam
  g.fillStyle(0x181e24);
  g.fillRect(left - 18, y - 82, 186, 9);
  g.fillStyle(0x505c68);
  g.fillRect(left - 18, y - 82, 186, 2); // Steel running rail
  // Support pylon bents
  for (const px of [left + 20, left + 75, left + 130]) {
    g.fillStyle(CONCRETE_DARK);
    g.fillRect(px - 5, y - 82, 10, 82);
    g.fillStyle(0x4a5664);
    g.fillRect(px - 4, y - 82, 3, 82);
  }

  // Aerodynamic High-Speed Bullet Monorail Train at platform
  const trX = x - 15;
  const trY = y - 82;
  // Sleek streamlined aerodynamic nose cone
  g.fillStyle(0xeef4f8);
  g.fillRect(trX - 44, trY - 18, 88, 17);
  g.fillTriangle(trX + 44, trY - 18, trX + 62, trY - 6, trX + 44, trY - 1);
  // Gold speed stripe
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(trX - 44, trY - 7, 100, 2);
  // Continuous tinted panoramic windows
  g.fillStyle(0x1a2634);
  g.fillRect(trX - 40, trY - 15, 84, 7);
  g.fillStyle(SKY_GLASS);
  g.fillRect(trX - 38, trY - 14, 80, 5);
  // Glowing interior passenger carriage lights
  g.fillStyle(0xfff8d0, 0.85);
  for (let wx = trX - 35; wx < trX + 38; wx += 14) g.fillRect(wx, trY - 13, 9, 3);
  // Train headlights
  g.fillStyle(0xfffaaa);
  g.fillCircle(trX + 58, trY - 7, 2);

  // 3. Sweeping Vaulted Structural Glass & White Steel Canopy
  g.fillStyle(0x16222c);
  g.fillRect(left + 6, y - 108, 138, 30);
  g.fillStyle(SKY_GLASS);
  g.fillRect(left + 8, y - 106, 134, 26);
  // White structural steel canopy arches
  g.lineStyle(1.5, 0xf0f4f8);
  for (let ax = left + 14; ax <= left + 136; ax += 18) {
    g.lineBetween(ax, y - 78, ax, y - 106);
  }
  g.fillRect(left + 6, y - 108, 138, 3);

  // 4. Ground-Level Passenger Concourse, Ticketing Lounge & Plaza
  g.fillStyle(0xfff6cf, 0.85);
  g.fillRect(left + 16, y - 50, 118, 28);
  // Destination route display boards
  g.fillStyle(0x182432);
  g.fillRect(x - 30, y - 48, 60, 8);
  g.fillStyle(0x22ee88);
  g.fillRect(x - 26, y - 46, 52, 4);

  // Automatic glass sliding doors
  g.fillStyle(0x181e24);
  g.fillRect(x - 16, y - 22, 32, 22);
  g.fillStyle(SKY_GLASS);
  g.fillRect(x - 14, y - 20, 12, 20);
  g.fillRect(x + 2, y - 20, 12, 20);

  // Landscaped Planters with Desert Palms flanking entrance
  for (const px of [left + 8, left + 142]) {
    g.fillStyle(0x5a3e2a);
    g.fillRect(px - 6, y - 12, 12, 12);
    g.fillStyle(0x3a8230);
    g.fillCircle(px, y - 16, 6);
  }
}

function drawHighwayUnderpassPortal(g, x, y, dir, elapsed = 0) {
  footing(g, x, y, 96, ASPHALT);
  const left = x - 48;
  const pTop = y - 44;

  // 1. Reinforced Concrete Headwall Portal (y - 44 to y)
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left, pTop, 96, 44);
  g.fillStyle(0x3a424e);
  g.fillRect(left + 2, pTop + 2, 92, 40);

  // 2. Deep Subterranean Tunnel Mouth Opening
  g.fillStyle(0x0a0c10);
  g.fillRect(left + 14, y - 32, 68, 32);

  // Recessed interior sodium/fluorescent ceiling light tubes inside the tunnel
  g.fillStyle(0xfff4b0, 0.9);
  for (let lx = left + 22; lx <= left + 70; lx += 16) {
    g.fillRect(lx, y - 31, 10, 2);
    // Soft downlight cone
    g.fillStyle(0xfff0aa, 0.15);
    g.fillTriangle(lx + 1, y - 29, lx + 9, y - 29, lx + 5, y - 10);
    g.fillStyle(0xfff4b0, 0.9);
  }

  // 3. Flanking Concrete Portal Pylons with Diagonal Yellow/Black Hazard Stripes
  for (const px of [left + 2, left + 84]) {
    g.fillStyle(0x282c34);
    g.fillRect(px, y - 36, 10, 36);
    // 45-degree yellow & black safety hazard stripes
    for (let sy = y - 34; sy < y - 2; sy += 6) {
      g.fillStyle(0xffcc00);
      g.fillRect(px + 1, sy, 8, 3);
      g.fillStyle(0x111111);
      g.fillRect(px + 1, sy + 3, 8, 3);
    }
  }

  // 4. Overhead Structural Steel Expressway Gantry & Large Green Signboard
  // Gantry truss frame
  g.fillStyle(0x4a5462);
  g.fillRect(left - 4, pTop - 12, 104, 3);
  g.fillRect(left - 4, pTop - 12, 4, 14);
  g.fillRect(left + 96, pTop - 12, 4, 14);

  // Expressway Green Signboard
  g.fillStyle(0x0a5c28); // Highway interstate green
  g.fillRect(left + 4, pTop - 10, 88, 16);
  // Crisp white sign border
  g.fillStyle(0xffffff);
  g.fillRect(left + 5, pTop - 9, 86, 1);
  g.fillRect(left + 5, pTop + 5, 86, 1);
  g.fillRect(left + 5, pTop - 9, 1, 15);
  g.fillRect(left + 90, pTop - 9, 1, 15);

  // Sign text & directional arrow stencil
  if (dir > 0) {
    // Eastbound: text bars + right-pointing arrow
    g.fillRect(left + 9, pTop - 7, 56, 3);
    g.fillRect(left + 9, pTop - 3, 44, 2.5);
    // Right arrow
    g.fillRect(left + 72, pTop - 6, 8, 3);
    g.fillTriangle(left + 80, pTop - 8, left + 86, pTop - 4.5, left + 80, pTop - 1);
  } else {
    // Westbound: left-pointing arrow + text bars
    g.fillRect(left + 14, pTop - 6, 8, 3);
    g.fillTriangle(left + 14, pTop - 8, left + 8, pTop - 4.5, left + 14, pTop - 1);
    g.fillRect(left + 26, pTop - 7, 56, 3);
    g.fillRect(left + 36, pTop - 3, 46, 2.5);
  }

  // 5. Illuminated LED Lane Control Signals (Green downward arrows)
  for (const lx of [left + 32, left + 64]) {
    g.fillStyle(0x111812);
    g.fillRect(lx - 4, pTop + 7, 8, 5);
    g.fillStyle(0x22ee44); // Green down-arrow
    g.fillRect(lx - 1, pTop + 8, 2, 2);
    g.fillTriangle(lx - 3, pTop + 10, lx + 3, pTop + 10, lx, pTop + 12);
  }

  // 6. Flashing Amber Hazard Beacons on Gantry Corners
  const amberFlash = Math.sin((elapsed ?? 0) * 6) > 0.2;
  g.fillStyle(amberFlash ? 0xffaa00 : 0x553300);
  g.fillCircle(left - 2, pTop - 13, 2.5);
  g.fillCircle(left + 98, pTop - 13, 2.5);

  // 7. Ground Jersey Barriers Flanking Approach
  g.fillStyle(0xe2e4e8);
  g.fillRect(left + 8, y - 8, 6, 8);
  g.fillRect(left + 82, y - 8, 6, 8);
}

function drawAirportSecurityGate(g, x, y, dir, elapsed = 0) {
  footing(g, x, y, 80, ASPHALT);
  const left = x - 40;
  const gTop = y - 38;

  // 1. Checkpoint Security Guardhouse (x - 26 to x)
  const ghLeft = x - 26;
  const ghW = 26;
  const ghH = 30;
  const ghTop = y - ghH;
  // Concrete plinth
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(ghLeft - 2, y - 5, ghW + 4, 5);
  // Architectural composite wall panels (white / silver steel)
  g.fillStyle(0xdbe3ea);
  g.fillRect(ghLeft, ghTop, ghW, ghH);
  // Overhang flat canopy roof
  g.fillStyle(0x262c34);
  g.fillRect(ghLeft - 3, ghTop - 3, ghW + 6, 4);

  // Tinted bullet-resistant surveillance observation window
  g.fillStyle(0x162432);
  g.fillRect(ghLeft + 3, ghTop + 6, ghW - 6, 12);
  g.fillStyle(SKY_GLASS);
  g.fillRect(ghLeft + 4, ghTop + 7, ghW - 8, 10);
  // Glowing interior security monitor console screens
  g.fillStyle(0x22ff66, 0.85); // Radar / CCTV screen
  g.fillRect(ghLeft + 6, ghTop + 9, 6, 4);
  g.fillStyle(0xffaa22, 0.85); // Terminal status screen
  g.fillRect(ghLeft + 14, ghTop + 9, 5, 4);

  // Guardhouse door with porthole glass
  g.fillStyle(0x384250);
  g.fillRect(ghLeft + ghW - 8, y - 18, 7, 14);
  g.fillStyle(SKY_GLASS);
  g.fillRect(ghLeft + ghW - 6, y - 15, 3, 4);

  // 2. Motorized Boom Barrier Gate Mechanism across the lane
  const boomPivotX = x + 3;
  // Safety yellow motorized barrier pedestal cabinet
  g.fillStyle(0xffcc00);
  g.fillRect(boomPivotX, y - 14, 5, 14);
  g.fillStyle(0x111111);
  g.fillRect(boomPivotX + 1, y - 12, 3, 4);

  // Striped Red & White Barrier Arm across lane (x + 8 to x + 36)
  const armLen = 30;
  const armY = y - 9;
  for (let ax = 0; ax < armLen; ax += 5) {
    const isRed = Math.floor(ax / 5) % 2 === 0;
    g.fillStyle(isRed ? 0xee2222 : 0xffffff);
    g.fillRect(boomPivotX + 5 + ax, armY, Math.min(5, armLen - ax), 2.5);
  }
  // Barrier tip warning LED
  g.fillStyle(0xff1111);
  g.fillCircle(boomPivotX + 5 + armLen, armY + 1.2, 1.5);

  // 3. Perimeter Anti-Climb Chainlink Security Fence with Razor Wire Coils
  // West perimeter fence (left - 12 to left)
  g.fillStyle(0x606a74);
  g.fillRect(left - 12, y - 24, 2, 24);
  g.fillRect(ghLeft - 4, y - 24, 2, 24);
  // Chainlink mesh grid
  g.fillStyle(0x8a96a2, 0.75);
  for (let fy = y - 22; fy < y - 2; fy += 4) {
    g.fillRect(left - 12, fy, ghLeft - left + 8, 1);
  }
  for (let fx = left - 10; fx < ghLeft - 2; fx += 4) {
    g.fillRect(fx, y - 22, 1, 20);
  }
  // Coiled concertina razor wire on top of fence
  g.fillStyle(0xcccccc);
  for (let rx = left - 12; rx < ghLeft - 2; rx += 4) {
    g.fillRect(rx, y - 27, 3, 3);
  }

  // 4. Tall CCTV Surveillance Camera Mast & Emergency Warning Beacon
  g.fillStyle(0x3a424e);
  g.fillRect(ghLeft + 4, ghTop - 18, 2, 18);
  // Pan-tilt-zoom dome camera
  g.fillStyle(0x181e24);
  g.fillRect(ghLeft + 2, ghTop - 20, 6, 3);
  g.fillStyle(0xffffff);
  g.fillCircle(ghLeft + 5, ghTop - 17, 2);
  // Flashing blue security beacon
  const blueFlash = Math.sin((elapsed ?? 0) * 8) > 0;
  g.fillStyle(blueFlash ? 0x2288ff : 0x0a2255);
  g.fillCircle(ghLeft + 5, ghTop - 22, 2.5);

  // 5. Overhead Checkpoint Signboard: "SCIA SECURITY CHECKPOINT"
  g.fillStyle(0x14202e);
  g.fillRect(ghLeft + 2, ghTop + 1, ghW - 4, 4);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(ghLeft + 3, ghTop + 2, ghW - 6, 2);

  // 6. Yellow Asphalt Speed Humps & Stop Bar
  g.fillStyle(0xffffff); // Stop bar line
  g.fillRect(boomPivotX + 4, y - 3, 1.5, 3);
  g.fillStyle(0xffcc00); // Speed hump
  g.fillRect(boomPivotX + 16, y - 2, 10, 2);
}

function drawAirCargo(g, x, y) {
  footing(g, x, y, 130, ASPHALT);
  const left = x - 65;
  g.fillStyle(0x38404a);
  g.fillRect(left, y - 65, 130, 65);
  // Horizontal steel ribbed bands
  g.fillStyle(0x283038);
  for (let by = y - 60; by < y - 36; by += 8) g.fillRect(left, by, 130, 2);
  // 3 Industrial Cargo Bay Roll-up Doors
  for (const bx of [x - 42, x, x + 42]) {
    g.fillStyle(0x181c20);
    g.fillRect(bx - 16, y - 34, 32, 34);
    // Yellow/black warning hazard header
    for (let hx = bx - 16; hx < bx + 16; hx += 8) {
      g.fillStyle(0xffd700);
      g.fillRect(hx, y - 36, 4, 3);
      g.fillStyle(0x111111);
      g.fillRect(hx + 4, y - 36, 4, 3);
    }
  }
  // Roof HVAC & warning beacon
  g.fillStyle(0x606670);
  g.fillRect(x - 20, y - 74, 40, 9);
  g.fillStyle(0xff3300);
  g.fillCircle(left + 12, y - 70, 3);
}

function drawZenithSpire(g, x, y) {
  footing(g, x, y, 98, CONCRETE_DARK);
  // 560px Grand Crystalline Monolith Skyscraper
  // Tier 1 (Base: y to y - 180, w: 90)
  g.fillStyle(0x1c2430);
  g.fillRect(x - 45, y - 180, 90, 180);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(x - 41, y - 176, 82, 148);
  g.fillStyle(0x000000, 0.24);
  g.fillRect(x + 10, y - 176, 31, 148);
  for (let fy = y - 166; fy < y - 28; fy += 14) {
    g.fillStyle(0x121a22, 0.4);
    g.fillRect(x - 41, fy, 82, 2);
    g.fillStyle(0xfff8d0, 0.8);
    for (let wx = x - 37; wx <= x + 31; wx += 8) g.fillRect(wx, fy + 3, 5, 7);
  }
  g.fillStyle(ELECTRUM_GOLD);
  for (let px = x - 42; px <= x + 42; px += 14) g.fillRect(px, y - 180, 2, 180);

  // Tier 2 (Mid-section: y - 180 to y - 320, w: 68)
  g.fillStyle(0x1c2430);
  g.fillRect(x - 34, y - 320, 68, 140);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(x - 30, y - 316, 60, 132);
  g.fillStyle(0x000000, 0.24);
  g.fillRect(x + 6, y - 316, 24, 132);
  for (let fy = y - 306; fy < y - 188; fy += 14) {
    g.fillStyle(0x121a22, 0.4);
    g.fillRect(x - 30, fy, 60, 2);
    g.fillStyle(0xfff8d0, 0.8);
    for (let wx = x - 27; wx <= x + 21; wx += 8) g.fillRect(wx, fy + 3, 5, 7);
  }

  // Tier 3 (Upper Tower: y - 320 to y - 440, w: 46)
  g.fillStyle(0x1c2430);
  g.fillRect(x - 23, y - 440, 46, 120);
  g.fillStyle(GOLD_GLASS);
  g.fillRect(x - 19, y - 436, 38, 112);
  for (let fy = y - 426; fy < y - 328; fy += 12) {
    g.fillStyle(0x121a22, 0.4);
    g.fillRect(x - 19, fy, 38, 2);
    g.fillStyle(0xffea80);
    for (let wx = x - 16; wx <= x + 12; wx += 7) g.fillRect(wx, fy + 2, 4, 6);
  }

  // Tier 4 Crown (y - 500, w 26) & Gilded Needle (y - 560)
  g.fillStyle(ELECTRUM_GOLD);
  g.fillTriangle(x - 16, y - 440, x, y - 500, x + 16, y - 440);
  g.fillRect(x - 2, y - 560, 4, 60);
  g.fillCircle(x, y - 560, 3);

  // Ground Colonnade Entrance
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(x - 48, y - 26, 96, 26);
  g.fillStyle(SUN_GLASS);
  g.fillRect(x - 24, y - 22, 48, 22);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 26, y - 23, 52, 2.5);
}

function zenithFx(g, x, y, elapsed) {
  const flash = Math.sin(elapsed * 7) > 0.5;
  g.fillStyle(flash ? 0xff2200 : 0xffffff, flash ? 1 : 0.4);
  g.fillCircle(x, y - 560, flash ? 4.5 : 2);
}

function drawWindTurbine(g, x, y) {
  footing(g, x, y, 40, CONCRETE_DARK);
  // Tapered composite pylon
  g.fillStyle(0xf0f4f8);
  g.fillTriangle(x - 5, y, x - 2, y - 180, x + 2, y - 180);
  g.fillTriangle(x - 5, y, x + 2, y - 180, x + 5, y);
  // Nacelle housing
  g.fillStyle(0xdce2ec);
  g.fillRect(x - 8, y - 188, 18, 10);
  g.fillStyle(0xc0c8d4);
  g.fillCircle(x - 8, y - 183, 5);
}

function turbineFx(g, x, y, elapsed) {
  const hubX = x - 8;
  const hubY = y - 183;
  const angle = elapsed * 2.8;
  const bladeLen = 42;
  g.fillStyle(0xf8fafc, 0.95);
  for (let i = 0; i < 3; i++) {
    const a = angle + i * (2 * Math.PI / 3);
    const tipX = hubX + Math.cos(a) * bladeLen;
    const tipY = hubY + Math.sin(a) * bladeLen;
    g.fillTriangle(hubX - Math.sin(a) * 2, hubY + Math.cos(a) * 2, tipX, tipY, hubX + Math.sin(a) * 2, hubY - Math.cos(a) * 2);
  }
  const blink = Math.sin(elapsed * 5) > 0.6;
  if (blink) {
    g.fillStyle(0xff2200);
    g.fillCircle(x + 8, y - 190, 2.5);
  }
}

function drawLongfieldChapel(g, x, y) {
  footing(g, x, y, 76, 0x6e543e);
  const left = x - 36;
  const cW = 72;
  const cH = 62;
  const top = y - cH;

  // 1. Foundation
  g.fillStyle(0x604e40);
  g.fillRect(left - 2, y - 6, cW + 4, 6);

  // 2. White Board-and-Batten Country Chapel Body
  g.fillStyle(0xf4f0e6);
  g.fillRect(left, top, cW, cH - 6);
  g.fillStyle(0xffffff, 0.2);
  g.fillRect(left, top, cW * 0.45, cH - 6);
  g.fillStyle(0x201c18, 0.15);
  g.fillRect(left + cW * 0.65, top, cW * 0.35, cH - 6);

  // Vertical battens
  g.fillStyle(0xdcd4c4);
  for (let bx = left + 4; bx < left + cW; bx += 6) {
    g.fillRect(bx, top, 1, cH - 6);
  }

  // Steep Gothic Gable Shingled Roof
  g.fillStyle(0x6a3830);
  g.fillTriangle(left - 6, top, x, top - 32, left + cW + 6, top);
  g.fillStyle(0x844238);
  g.fillTriangle(left - 6, top, x, top - 32, x, top);

  // 3. Stained Glass Rose & Lancet Windows
  // High gothic lancet windows flanking entrance
  for (const wx of [left + 12, left + cW - 12]) {
    g.fillStyle(0x281c14);
    g.fillRect(wx - 4, top + 18, 8, 22);
    g.fillCircle(wx, top + 18, 4);
    // Vibrant stained glass panes (sapphire and amber)
    g.fillStyle(0x2a60aa);
    g.fillRect(wx - 3, top + 19, 6, 10);
    g.fillStyle(0xd99020);
    g.fillRect(wx - 3, top + 29, 6, 10);
  }
  // Circular stained glass rose window above portal
  g.fillStyle(0x281c14);
  g.fillCircle(x, top + 6, 8);
  g.fillStyle(0x9a3030); // Ruby center
  g.fillCircle(x, top + 6, 6);
  g.fillStyle(0x3a86ff); // Blue facets
  g.fillCircle(x, top + 6, 3.5);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, top + 6, 1.5);

  // 4. Arched Oak Double Doors
  g.fillStyle(0x3e2212);
  g.fillRect(x - 9, y - 26, 18, 20);
  g.fillCircle(x, y - 26, 9);
  g.fillStyle(0x28140a);
  g.fillRect(x - 8, y - 24, 7, 18);
  g.fillRect(x + 1, y - 24, 7, 18);
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x - 2, y - 14, 1.5);
  g.fillCircle(x + 2, y - 14, 1.5);

  // 5. Open Belfry Tower & Steeple Spire (Apex at y - 126)
  const bW = 22;
  const bTop = top - 32 - 20;
  g.fillStyle(0xf0ebe0);
  g.fillRect(x - bW / 2, bTop, bW, 20);
  // Open bell arch
  g.fillStyle(0x201812);
  g.fillRect(x - 6, bTop + 4, 12, 14);
  g.fillCircle(x, bTop + 4, 6);
  // Brass Chapel Bell
  g.fillStyle(ELECTRUM_GOLD);
  g.fillCircle(x, bTop + 10, 4.5);
  g.fillRect(x - 4.5, bTop + 10, 9, 2.5);

  // Soaring Spire Roof & Gilded Cross
  g.fillStyle(0x4a221c);
  g.fillTriangle(x - 12, bTop, x, bTop - 28, x + 12, bTop);
  g.fillStyle(0x683228);
  g.fillTriangle(x - 12, bTop, x, bTop - 28, x, bTop);

  // Gilded Latin Cross
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(x - 1, bTop - 38, 2, 11);
  g.fillRect(x - 4, bTop - 34, 8, 2);
}

function drawRadioMast(g, x, y) {
  footing(g, x, y, 45, CONCRETE_DARK);
  for (let s = 0; s < 5; s++) {
    const sy = y - s * 36;
    const color = s % 2 === 0 ? 0xd93829 : 0xffffff;
    g.fillStyle(color);
    g.fillRect(x - 8 + s * 1, sy - 36, 16 - s * 2, 36);
    g.fillStyle(0x222222, 0.4);
    g.fillRect(x - 7 + s * 1, sy - 34, 14 - s * 2, 32);
  }
  g.fillStyle(0xffffff);
  g.fillCircle(x + 12, y - 120, 9);
  g.fillStyle(0x444444);
  g.fillCircle(x + 12, y - 120, 6);
  g.fillStyle(0xcccccc);
  g.fillRect(x - 1, y - 198, 2, 18);
}

function radioMastFx(g, x, y, elapsed) {
  const flash = Math.sin(elapsed * 6) > 0.4;
  g.fillStyle(flash ? 0xff2200 : 0x440000);
  g.fillCircle(x, y - 198, flash ? 3.5 : 1.5);
}

// -------------------------------------------------------------
// LANDMARK REGISTRATION & EXPORTS
// -------------------------------------------------------------

export const ECHO_VIADUCT_DECK = Object.freeze({
  id: 'echo-canyon-viaduct',
  x: 34350,
  from: 34000,
  to: 34700,
  rise: 160,
});

export function sunlandDeckRise(x, deckUp = null) {
  const at = wrapX(x);
  if (at <= ECHO_VIADUCT_DECK.from || at >= ECHO_VIADUCT_DECK.to) return null;
  if (deckUp && !deckUp(ECHO_VIADUCT_DECK.id)) return null;
  return ECHO_VIADUCT_DECK.rise;
}

function drawEchoCanyonViaduct(g, x, y) {
  const left = x - 350;
  const right = x + 350;
  const spanW = 700;
  const deckY = y - 160;

  // 1. Heavy Tapered Masonry & Steel Canyon Piers
  for (const px of [x - 240, x - 80, x + 80, x + 240]) {
    // Stone base extending to canyon floor
    g.fillStyle(REDROCK_DARK);
    g.fillRect(px - 16, deckY + 70, 32, y - (deckY + 70) + 20);
    g.fillStyle(REDROCK_STONE);
    g.fillRect(px - 12, deckY + 70, 24, y - (deckY + 70) + 20);
    // Steel lattice pier shaft rising to deck under-truss
    g.fillStyle(0x5a2e22);
    g.fillRect(px - 9, deckY + 22, 18, 50);
    g.fillStyle(0x8a4434);
    g.fillRect(px - 7, deckY + 22, 14, 48);
    // Pier cap transverse bracket
    g.fillStyle(0x401812);
    g.fillRect(px - 14, deckY + 20, 28, 4);
  }

  // 2. Steel Under-Truss Flanges & Continuous Diagonal Webbing
  g.fillStyle(0x7a3a2a);
  g.fillRect(left, deckY + 22, spanW, 5); // Bottom chord
  for (let tx = left + 10; tx < right - 10; tx += 25) {
    g.fillStyle(0x5a281c);
    g.fillRect(tx, deckY + 4, 3, 18); // Vertical posts
    g.fillStyle(0x8a4030);
    g.fillTriangle(tx, deckY + 4, tx + 24, deckY + 22, tx + 21, deckY + 22); // Diagonal brace
  }

  // 3. Reinforced Concrete Road Deck Slab & Asphalt Pavement
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left, deckY + 2, spanW, 5);
  g.fillStyle(ASPHALT);
  g.fillRect(left, deckY - 1, spanW, 3);

  // 4. White Lane Edge Striping & Dashed Highway Centerline
  g.fillStyle(0xffffff, 0.85);
  for (let cx = left + 12; cx < right - 12; cx += 26) {
    g.fillRect(cx, deckY, 15, 1);
  }

  // 5. Parapet Railings & Crash Barriers
  g.fillStyle(0x3a1e16);
  g.fillRect(left, deckY - 8, spanW, 2); // Top handrail
  for (let rx = left + 5; rx < right; rx += 10) {
    g.fillRect(rx, deckY - 8, 1.5, 8); // Vertical pickets
  }
  // Highway W-beam crash barrier
  g.fillStyle(0x999088);
  g.fillRect(left, deckY - 4, spanW, 2);

  // 6. Central Semicircular Scenic Overlook with Illuminated Lanterns
  g.fillStyle(REDROCK_STONE);
  g.fillRect(x - 24, deckY - 2, 48, 5);
  g.fillStyle(0x222222);
  g.fillRect(x - 22, deckY - 18, 2, 14);
  g.fillRect(x + 20, deckY - 18, 2, 14);
  g.fillStyle(0xfff0aa);
  g.fillCircle(x - 21, deckY - 18, 3);
  g.fillCircle(x + 21, deckY - 18, 3);

  // 7. Canyon Rim Reinforced Concrete Abutments
  footing(g, left + 15, deckY + 10, 36, CONCRETE_DARK, 60);
  footing(g, right - 15, deckY + 10, 36, CONCRETE_DARK, 60);
}

const LANDMARK_ART = [
  // Wonder 1: The Golden Pyramid of Khufu (Great Desert Gateway of Sunland)
  { id: 'golden-pyramid', x: 31400, door: true, draw: drawGoldenPyramid, fx: pyramidFx, clear: 160, width: 310, height: 225, maxHealth: 950 },
  // Redrock (31600 - 32600)
  { id: 'redrock-citadel', x: 32050, door: true, draw: drawRedrockCitadel, clear: 56, width: 92, height: 440, maxHealth: 480 },
  { id: 'redrock-bridge', x: 32450, draw: drawRedrockBridge, clear: 72, width: 140, height: 95, maxHealth: 380 },
  // Echo Canyon (32600 - 35600) & Wonders 2 & 4
  // Wonder 2: The Hanging Gardens of Babylon (West Rim Oasis of Echo Canyon)
  { id: 'hanging-gardens', x: 33750, door: true, draw: drawHangingGardens, fx: gardensFx, clear: 145, width: 270, height: 260, maxHealth: 950 },
  { id: 'echo-canyon-viaduct', x: 34350, isBridge: true, draw: drawEchoCanyonViaduct, clear: 350, width: 700, height: 190, maxHealth: 980 },
  // Wonder 4: Temple of the Sun (East Rim Mesa of Echo Canyon)
  { id: 'temple-of-the-sun', x: 34850, door: true, draw: drawTempleOfTheSun, fx: templeFx, clear: 110, width: 210, height: 210, maxHealth: 880 },
  // Highway Underpass Portal West (36120) - Diverts civilian traffic under airport
  { id: 'underpass-portal-west', x: 36120, draw: (g, x, y, el) => drawHighwayUnderpassPortal(g, x, y, 1, el), clear: 45, width: 84, height: 48, maxHealth: 480 },
  // Sun City Transit Hub (36320) - Monorail terminal connecting region to SCIA
  { id: 'suncity-transit-hub', x: 36320, door: true, draw: drawTransitHub, clear: 75, width: 150, height: 110, maxHealth: 420 },
  // West Airport Security Gate & Checkpoint (36490)
  { id: 'airport-gate-west', x: 36490, door: true, draw: (g, x, y, el) => drawAirportSecurityGate(g, x, y, 1, el), clear: 40, width: 75, height: 60, maxHealth: 380 },
  // Sun City Air Cargo Logistics Bay (36660)
  { id: 'suncity-air-cargo', x: 36660, door: true, draw: drawAirCargo, clear: 65, width: 130, height: 75, maxHealth: 360 },
  // Sun City International Airport Airfield & Facilities (36720 - 40880)
  { id: 'airport-tower', x: 37260, door: true, draw: drawAirportTower, fx: towerFx, clear: 35, width: 44, height: 185, maxHealth: 360 },
  { id: 'airport-terminal', x: 37600, door: true, draw: drawAirportTerminal, clear: 120, width: 230, height: 85, maxHealth: 440 },
  { id: 'airport-hangar', x: 38100, door: true, draw: drawAirportHangar, clear: 75, width: 140, height: 75, maxHealth: 380 },
  { id: 'airport-cargo-depot', x: 38850, door: true, draw: (g, x, y) => drawAirCargoDepot(g, x, y, 90, 65), clear: 55, width: 90, height: 65, maxHealth: 380 },
  { id: 'airport-fire-station', x: 39650, door: true, draw: (g, x, y) => drawAirportFireStation(g, x, y, 85, 60), clear: 50, width: 85, height: 60, maxHealth: 420 },
  { id: 'airport-heliport-terminal', x: 40200, door: true, draw: (g, x, y) => drawAirportHeliportTerminal(g, x, y, 80, 55), clear: 50, width: 80, height: 55, maxHealth: 360 },
  // East Airport Security Gate & Checkpoint (40880)
  { id: 'airport-gate-east', x: 40880, door: true, draw: (g, x, y, el) => drawAirportSecurityGate(g, x, y, -1, el), clear: 40, width: 75, height: 60, maxHealth: 380 },
  // Highway Underpass Portal East (41040) - Traffic emerges past airport
  { id: 'underpass-portal-east', x: 41040, draw: (g, x, y, el) => drawHighwayUnderpassPortal(g, x, y, -1, el), clear: 45, width: 84, height: 48, maxHealth: 480 },
  // Long Plains & Longfield Agricultural & Civic Community (41100 - 42850)
  { id: 'savanna-wind-turbine-1', x: 41180, draw: drawWindTurbine, fx: turbineFx, clear: 35, width: 55, height: 210, maxHealth: 320 },
  { id: 'savanna-homestead', x: 41420, door: true, draw: drawSavannaHomestead, clear: 65, width: 120, height: 95, maxHealth: 420 },
  { id: 'savanna-wildlife-station', x: 41650, door: true, draw: drawWildlifeStation, clear: 58, width: 105, height: 85, maxHealth: 380 },
  { id: 'savanna-grain-mill', x: 41880, door: true, draw: drawSavannaGrainMill, clear: 70, width: 130, height: 125, maxHealth: 480 },
  { id: 'longfield-town-hall', x: 42120, door: true, draw: drawLongfieldTownHall, clear: 75, width: 135, height: 135, maxHealth: 520 },
  { id: 'longfield-trading-post', x: 42340, door: true, draw: drawLongfieldTradingPost, clear: 60, width: 110, height: 85, maxHealth: 400 },
  { id: 'savanna-artisan-barn', x: 42510, door: true, draw: drawSavannaArtisanBarn, clear: 55, width: 100, height: 80, maxHealth: 380 },
  { id: 'longfield-chapel', x: 42670, door: true, draw: drawLongfieldChapel, clear: 45, width: 75, height: 115, maxHealth: 320 },
  { id: 'savanna-radio-mast', x: 42820, draw: drawRadioMast, fx: radioMastFx, clear: 30, width: 45, height: 180, maxHealth: 340 },
];

export const SUNLAND_LANDMARKS = LANDMARK_ART.map(landmark => {
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
// SUNLAND STREET BUILDINGS & PROCEDURAL SKYSCRAPERS
// -------------------------------------------------------------

function drawRedrockStreet(g, x, y, width, height, isTower, body) {
  footing(g, x, y, width + 8, REDROCK_DARK);
  const left = x - width / 2;
  const top = y - height;

  // 1. Rusticated Foundation Stone Plinth
  g.fillStyle(0x4a2416);
  g.fillRect(left - 2, y - 6, width + 4, 6);
  g.fillStyle(0x6e3822);
  g.fillRect(left - 1, y - 6, width + 2, 2);

  if (isTower) {
    // MULTI-STORY PUEBLO WATCHTOWER / CITADEL
    // Lower mass (ground to mid-height)
    const midY = top + Math.round(height * 0.45);
    g.fillStyle(body);
    g.fillRect(left, midY, width, y - midY);

    // Upper setback tower
    const topW = Math.max(18, Math.round(width * 0.72));
    const topLeft = x - Math.round(topW / 2);
    g.fillStyle(body);
    g.fillRect(topLeft, top, topW, midY - top);

    // Shading & Sunlit Facets
    // Ambient shade right
    g.fillStyle(0x000000, 0.22);
    g.fillRect(left + width * 0.7, midY, width * 0.3, y - midY);
    g.fillRect(topLeft + topW * 0.7, top, topW * 0.3, midY - top);
    // Sunlit warm highlight left
    g.fillStyle(0xfff0d8, 0.16);
    g.fillRect(left, midY, width * 0.22, y - midY);
    g.fillRect(topLeft, top, topW * 0.22, midY - top);

    // Parapets and Crenellations with decorative stepped coping
    g.fillStyle(0x502816);
    g.fillRect(topLeft - 2, top - 3, topW + 4, 3);
    // Battlements / crenels
    for (let bx = topLeft; bx < topLeft + topW; bx += 7) {
      g.fillRect(bx, top - 6, 4, 3);
    }
    // Mid-terrace wooden railing / parapet
    g.fillStyle(0x401e10);
    g.fillRect(left - 1, midY - 3, width + 2, 3);
    g.fillStyle(0x7c4e2c);
    g.fillRect(left + 2, midY - 8, width - 4, 2);
    for (let rx = left + 4; rx < left + width - 4; rx += 8) {
      g.fillRect(rx, midY - 8, 2, 6);
    }

    // Timber vigas (protruding log beams) at floorlines
    g.fillStyle(0x381c0c);
    for (let vx = topLeft + 3; vx < topLeft + topW - 3; vx += 7) {
      g.fillRect(vx, top + 8, 3, 3); // Upper floor vigas
      g.fillRect(vx, midY - 6, 3, 3);
    }
    for (let vx = left + 4; vx < left + width - 4; vx += 8) {
      g.fillRect(vx, midY + 12, 3, 3); // Lower floor vigas
      if (y - midY > 40) g.fillRect(vx, y - 24, 3, 3);
    }

    // Timber Canales (water drainage spouts projecting from parapet)
    g.fillStyle(0x281206);
    g.fillRect(topLeft - 4, top + 1, 4, 2);
    g.fillRect(topLeft + topW, top + 1, 4, 2);

    // Recessed windows with thick timber lintels
    const floors = Math.floor(height / 22);
    for (let f = 1; f < floors; f++) {
      const wy = top + f * 20;
      if (wy > y - 20) continue;
      const onUpper = wy < midY;
      const wleft = onUpper ? topLeft : left;
      const wspan = onUpper ? topW : width;
      // Window placement
      const wx1 = wleft + 4;
      const wx2 = wleft + wspan - 10;
      // Dark timber lintel
      g.fillStyle(0x2c150a);
      g.fillRect(wx1 - 1, wy - 2, 8, 2);
      g.fillRect(wx2 - 1, wy - 2, 8, 2);
      // Window frame & glass (amber warmth or turquoise)
      g.fillStyle(0x180c05);
      g.fillRect(wx1, wy, 6, 8);
      g.fillRect(wx2, wy, 6, 8);
      g.fillStyle((f % 2 === 0) ? 0x228b84 : 0xf8be58);
      g.fillRect(wx1 + 1, wy + 1, 4, 6);
      g.fillRect(wx2 + 1, wy + 1, 4, 6);
    }

    // Rustic wooden pole ladder leaning up to the upper terrace
    g.fillStyle(0x6a4020);
    g.fillRect(left + 5, midY - 14, 2, 16);
    g.fillRect(left + 10, midY - 14, 2, 16);
    for (let ry = midY - 12; ry <= midY; ry += 3) {
      g.fillRect(left + 5, ry, 7, 1.5);
    }

    // Top observation spire / flagpole
    g.fillStyle(0x381c0c);
    g.fillRect(x - 1, top - 18, 2, 12);
    g.fillStyle(0xc41e3a);
    g.fillRect(x + 1, top - 17, 6, 4); // Red heraldic pennant
  } else {
    // 2-3 STORY SOUTHWESTERN ADOBE PUEBLO DWELLING
    g.fillStyle(body);
    g.fillRect(left, top, width, height);

    // Ambient shadow right & sunlit highlight left
    g.fillStyle(0x000000, 0.2);
    g.fillRect(left + width * 0.72, top, width * 0.28, height);
    g.fillStyle(0xfff0d8, 0.15);
    g.fillRect(left, top, width * 0.22, height);

    // Stepped adobe parapet crown
    g.fillStyle(0x562a18);
    g.fillRect(left - 1, top - 3, width + 2, 3);
    // Asymmetric adobe terrace step on roof
    g.fillStyle(body);
    g.fillRect(x - 6, top - 6, 12, 4);
    g.fillStyle(0x421e10);
    g.fillRect(x - 6, top - 7, 12, 2);

    // Wooden vigas protruding along upper ceiling
    g.fillStyle(0x361a0a);
    for (let vx = left + 4; vx < left + width - 4; vx += 7) {
      g.fillRect(vx, top + 6, 3, 3);
      if (height > 50) g.fillRect(vx, top + 26, 3, 3);
    }

    // Canales (timber roof drainage spout)
    g.fillStyle(0x281206);
    g.fillRect(left - 3, top + 2, 3, 2);

    // Recessed windows with thick timber lintels & turquoise accents
    const winCols = Math.max(1, Math.floor((width - 10) / 11));
    const winRows = Math.floor((height - 18) / 16);
    for (let r = 0; r < winRows; r++) {
      const wy = top + 14 + r * 16;
      if (wy > y - 22) continue;
      for (let c = 0; c < winCols; c++) {
        const wx = left + 5 + c * 11;
        // Timber lintel
        g.fillStyle(0x2c150a);
        g.fillRect(wx - 1, wy - 2, 7, 2);
        // Deep reveal shadow
        g.fillStyle(0x180c05);
        g.fillRect(wx, wy, 5, 7);
        // Glass
        g.fillStyle((c % 2 === 0) ? 0x249289 : 0xf8be58);
        g.fillRect(wx + 1, wy + 1, 3, 5);
      }
    }

    // Wooden pole ladder leaning against the building
    g.fillStyle(0x6e4222);
    g.fillRect(left + width - 9, top + 4, 1.5, height - 4);
    g.fillRect(left + width - 5, top + 4, 1.5, height - 4);
    for (let ry = top + 7; ry < y - 4; ry += 5) {
      g.fillRect(left + width - 9, ry, 5, 1.5);
    }
  }

  // Red Chili Pepper Ristras hanging beside entrance
  g.fillStyle(0xc41e3a);
  g.fillCircle(x - 9, y - 13, 2);
  g.fillCircle(x - 9, y - 10, 2);
  g.fillCircle(x - 9, y - 7, 2);
  g.fillStyle(0x2d6a36); // Green stem
  g.fillRect(x - 10, y - 16, 2, 3);

  // Heavy Arched Timber Entrance Portal with Turquoise Trim
  g.fillStyle(0x228b84); // Turquoise casing
  g.fillRect(x - 7, y - 18, 14, 18);
  g.fillStyle(0x28140a); // Deep timber door
  g.fillRect(x - 6, y - 17, 12, 17);
  // Rounded arch doorway top
  g.fillCircle(x, y - 17, 6);
  // Wrought-iron decorative studs & strap hinges
  g.fillStyle(0x110804);
  g.fillRect(x - 5, y - 14, 10, 2);
  g.fillRect(x - 5, y - 8, 10, 2);
  g.fillStyle(0xe5a93c); // Brass door ring handle
  g.fillRect(x - 3, y - 10, 2, 2);
  g.fillRect(x + 2, y - 10, 2, 2);
}

// Echo Canyon Southwestern Pueblo & Cliff Architecture Palettes
const ECHO_STONE_DARK = 0x6e3620;
const ECHO_STONE_MID = 0x8c4628;
const ECHO_ADOBE_WARM = 0xc87d55;
const ECHO_ADOBE_BUFF = 0xd48a5c;
const ECHO_ADOBE_OCHRE = 0xba6c44;
const ECHO_ADOBE_LIGHT = 0xdda078;
const ECHO_TIMBER_DARK = 0x3e2010;
const ECHO_TIMBER_MID = 0x5a341c;
const ECHO_TIMBER_LIGHT = 0x7a4a2a;
const ECHO_TURQUOISE = 0x228b84;
const ECHO_LANTERN_GLOW = 0xffcf54;
const ECHO_LANTERN_CORE = 0xfffae0;
const ECHO_POTTERY_RED = 0xba4e24;
const ECHO_POTTERY_OCHRE = 0xd47640;

function drawEchoVigas(g, vxStart, vxEnd, vy, step = 7) {
  for (let vx = vxStart; vx < vxEnd; vx += step) {
    // Cast drop-shadow beneath viga
    g.fillStyle(0x221008);
    g.fillRect(vx, vy + 3, 3, 1.5);
    // Heavy timber beam end
    g.fillStyle(ECHO_TIMBER_DARK);
    g.fillRect(vx, vy, 3, 3);
    // Sunlit top edge
    g.fillStyle(ECHO_TIMBER_LIGHT);
    g.fillRect(vx, vy, 2, 1);
  }
}

function drawEchoLadder(g, lx, topY, botY, lean = 2) {
  const h = botY - topY;
  if (h <= 8) return;
  // Side poles
  g.fillStyle(ECHO_TIMBER_MID);
  g.fillRect(lx - lean, topY, 1.5, h);
  g.fillRect(lx + 4 - lean, topY, 1.5, h);
  // Tied rungs
  g.fillStyle(ECHO_TIMBER_DARK);
  for (let ry = topY + 3; ry < botY - 1; ry += 4) {
    g.fillRect(lx - lean, ry, 5.5, 1.2);
  }
}

function drawEchoHorno(g, hx, hy) {
  // Adobe beehive dome base
  g.fillStyle(0x9a5030);
  g.fillRect(hx - 4, hy - 6, 8, 6);
  g.fillCircle(hx, hy - 6, 4);
  // Sunlit highlight
  g.fillStyle(0xd07c52);
  g.fillCircle(hx - 1, hy - 7, 2);
  // Arched hearth opening
  g.fillStyle(0x201006);
  g.fillRect(hx - 2, hy - 4, 4, 4);
  g.fillCircle(hx, hy - 4, 2);
  // Glowing embers
  g.fillStyle(0xff6a00);
  g.fillCircle(hx, hy - 2, 1.2);
  // Smoke chimney vent on top
  g.fillStyle(0x5a2814);
  g.fillRect(hx - 1, hy - 11, 2, 2);
}

function drawEchoOlla(g, ox, oy, color = ECHO_POTTERY_RED) {
  g.fillStyle(color);
  g.fillCircle(ox, oy - 3, 2.5);
  g.fillRect(ox - 1.5, oy - 6, 3, 2);
  g.fillStyle(0x2b1006);
  g.fillRect(ox - 1, oy - 6.5, 2, 0.8);
}

function drawEchoWindow(g, wx, wy, ww = 5, wh = 7) {
  // Heavy timber lintel
  g.fillStyle(ECHO_TIMBER_DARK);
  g.fillRect(wx - 1, wy - 2, ww + 2, 2);
  // Deep reveal shadow
  g.fillStyle(0x1a0a04);
  g.fillRect(wx, wy, ww, wh);
  // Warm interior amber lantern glow
  g.fillStyle(ECHO_LANTERN_GLOW);
  g.fillRect(wx + 1, wy + 1, Math.max(1, ww - 2), Math.max(1, wh - 2));
  g.fillStyle(ECHO_LANTERN_CORE);
  g.fillRect(wx + 1.5, wy + 1.5, Math.max(1, ww - 3), Math.max(1, wh - 3));
  // Timber sill
  g.fillStyle(ECHO_TIMBER_MID);
  g.fillRect(wx - 0.5, wy + wh, ww + 1, 1.5);
}

function drawEchoDoor(g, dx, dy, dw = 11, dh = 16) {
  const half = dw / 2;
  // Turquoise outer casing
  g.fillStyle(ECHO_TURQUOISE);
  g.fillRect(dx - half - 1.5, dy - dh - 1.5, dw + 3, dh + 1.5);
  g.fillCircle(dx, dy - dh - 1.5, half + 1.5);
  // Deep door recess
  g.fillStyle(0x180c06);
  g.fillRect(dx - half, dy - dh, dw, dh);
  g.fillCircle(dx, dy - dh, half);
  // Heavy dark timber plank door
  g.fillStyle(0x2d170a);
  g.fillRect(dx - half + 1, dy - dh + 1, dw - 2, dh - 1);
  g.fillCircle(dx, dy - dh + 1, half - 1);
  // Wrought-iron decorative strap hinges
  g.fillStyle(0x110804);
  g.fillRect(dx - half + 1, dy - dh * 0.7, dw - 2, 1.5);
  g.fillRect(dx - half + 1, dy - dh * 0.35, dw - 2, 1.5);
  // Brass solar ring handle
  g.fillStyle(0xeca836);
  g.fillCircle(dx + 2, dy - dh * 0.45, 1.5);
}

function drawEchoRistra(g, rx, ry) {
  g.fillStyle(0x2e6f38); // Green stem
  g.fillRect(rx - 1, ry - 1, 2, 2.5);
  g.fillStyle(0xc41e3a); // Scarlet peppers
  g.fillCircle(rx, ry + 2, 1.8);
  g.fillCircle(rx - 1, ry + 5, 1.8);
  g.fillCircle(rx + 1, ry + 7, 1.6);
  g.fillCircle(rx, ry + 10, 1.4);
}

function drawCliffPueblo(g, x, y, width, height, seed) {
  const left = x - width / 2;
  const top = y - height;
  const bodyColor = (Math.floor(hash(seed + 11) * 2) === 0) ? ECHO_ADOBE_WARM : ECHO_ADOBE_BUFF;

  // Tier 1 (Ground level): covers full width, height ~50%
  const t1H = Math.round(height * 0.50);
  const t1Top = y - t1H;
  g.fillStyle(bodyColor);
  g.fillRect(left, t1Top, width, t1H);
  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(left, t1Top, Math.max(3, width * 0.22), t1H);
  g.fillStyle(0x000000, 0.20);
  g.fillRect(left + width - Math.max(3, width * 0.22), t1Top, Math.max(3, width * 0.22), t1H);

  drawEchoVigas(g, left + 4, left + width - 4, t1Top + 3, 7);

  // Tier 2 (Setback upper floor creating a living rooftop terrace)
  const t2W = Math.round(width * 0.68);
  const t2H = Math.round(height * 0.32);
  const t2Top = t1Top - t2H;
  g.fillStyle(bodyColor);
  g.fillRect(left, t2Top, t2W, t2H);
  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(left, t2Top, Math.max(2, t2W * 0.22), t2H);
  g.fillStyle(0x000000, 0.20);
  g.fillRect(left + t2W - Math.max(2, t2W * 0.22), t2Top, Math.max(2, t2W * 0.22), t2H);

  drawEchoVigas(g, left + 4, left + t2W - 4, t2Top + 3, 7);

  // Rooftop Terrace Elements on Tier 1
  const terraceX = left + t2W + (width - t2W) / 2;
  drawEchoHorno(g, terraceX + 1, t1Top);
  drawEchoOlla(g, left + width - 3, t1Top, ECHO_POTTERY_RED);
  drawEchoLadder(g, left + t2W + 2, t1Top - 3, y - 4, 3);

  // Tier 3 (Pinnacle setback cube)
  if (height >= 56) {
    const t3W = Math.round(width * 0.42);
    const t3H = height - t1H - t2H;
    const t3Top = top;
    g.fillStyle(ECHO_ADOBE_OCHRE);
    g.fillRect(left + 2, t3Top, t3W, t3H);
    drawEchoVigas(g, left + 5, left + t3W - 2, t3Top + 2, 6);
    drawEchoLadder(g, left + t3W + 3, t2Top - 2, t1Top, 2);
    drawEchoOlla(g, left + t3W - 2, t2Top, ECHO_POTTERY_OCHRE);
  }

  drawEchoWindow(g, left + 6, t1Top + 8, 5, 7);
  drawEchoWindow(g, left + 6, t2Top + 7, 5, 6);
  if (t2W > 28) {
    drawEchoWindow(g, left + t2W - 10, t2Top + 7, 5, 6);
  }

  const doorX = left + Math.round(width * 0.38);
  drawEchoDoor(g, doorX, y - 6, 10, 15);
  drawEchoRistra(g, doorX - 8, y - 18);
}

function drawCanyonWatchtower(g, x, y, width, height, seed) {
  const left = x - width / 2;
  const top = y - height;

  // Battered sandstone base plinth
  g.fillStyle(ECHO_STONE_MID);
  g.fillRect(left - 3, y - 10, width + 6, 10);
  g.fillStyle(ECHO_STONE_DARK);
  g.fillRect(left - 4, y - 3, width + 8, 3);

  // Tower Shaft: rusticated sandstone masonry
  g.fillStyle(ECHO_ADOBE_OCHRE);
  g.fillRect(left, top + 10, width, height - 10);

  // 3D Volume Shading
  g.fillStyle(0xfff0d8, 0.18);
  g.fillRect(left, top + 10, width * 0.26, height - 10);
  g.fillStyle(0x000000, 0.22);
  g.fillRect(left + width * 0.74, top + 10, width * 0.26, height - 10);

  // Sandstone sedimentary strata lines
  g.fillStyle(0x421c0e, 0.28);
  for (let sy = y - 18; sy > top + 16; sy -= 15) {
    g.fillRect(left, sy, width, 1.5);
  }

  // Cantilevered Timber Lookout Gallery / Balcony
  const galY = top + 14;
  g.fillStyle(ECHO_TIMBER_DARK);
  g.fillRect(left - 5, galY + 5, width + 10, 3);
  g.fillRect(left - 4, galY + 8, 3, 4);
  g.fillRect(left + width + 1, galY + 8, 3, 4);
  g.fillRect(left + 2, galY + 8, 3, 3);
  g.fillRect(left + width - 5, galY + 8, 3, 3);

  g.fillStyle(ECHO_TIMBER_MID);
  g.fillRect(left - 5, galY + 3, width + 10, 2);

  g.fillStyle(ECHO_TIMBER_LIGHT);
  g.fillRect(left - 5, galY - 4, width + 10, 1.5);
  for (let bx = left - 4; bx <= left + width + 4; bx += 5) {
    g.fillRect(bx, galY - 3, 1.5, 6);
  }

  // Arrow-Slit Embrasures with warm lantern/torch glow
  const slitCols = (width > 36) ? 2 : 1;
  const slitRows = Math.max(2, Math.floor((height - 35) / 16));
  for (let r = 0; r < slitRows; r++) {
    const wy = y - 22 - r * 15;
    if (wy < top + 22) continue;
    if (slitCols === 1) {
      drawEchoWindow(g, x - 2, wy, 4, 7);
    } else {
      drawEchoWindow(g, left + 7, wy, 4, 7);
      drawEchoWindow(g, left + width - 11, wy, 4, 7);
    }
  }

  // Stepped Crenellated Roof Parapet (Battlements)
  g.fillStyle(ECHO_STONE_MID);
  g.fillRect(left - 1, top + 7, width + 2, 4);
  g.fillStyle(ECHO_ADOBE_OCHRE);
  g.fillRect(left - 1, top + 3, 5, 5);
  g.fillRect(x - 2.5, top + 3, 5, 5);
  g.fillRect(left + width - 4, top + 3, 5, 5);

  // Wrought-iron & Brass Signal Fire Brazier on Rooftop
  g.fillStyle(0x341a0e);
  g.fillRect(x - 4, top + 1, 8, 2.5);
  g.fillRect(x - 1, top + 3.5, 2, 3);
  g.fillStyle(0xff4400);
  g.fillCircle(x, top - 1, 3.5);
  g.fillStyle(0xffbb00);
  g.fillCircle(x, top - 2.5, 2);
  g.fillStyle(0xfff5aa);
  g.fillCircle(x, top - 3.5, 1);

  drawEchoDoor(g, x, y - 6, 11, 16);
}

function drawWeaverWorkshop(g, x, y, width, height, seed) {
  const left = x - width / 2;
  const top = y - height;

  const shopW = Math.round(width * 0.65);
  const shopLeft = left + width - shopW;
  g.fillStyle(ECHO_ADOBE_BUFF);
  g.fillRect(shopLeft, top, shopW, height);
  g.fillCircle(shopLeft + 4, top, 4);
  g.fillCircle(shopLeft + shopW - 4, top, 4);

  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(shopLeft, top, shopW * 0.22, height);
  g.fillStyle(0x000000, 0.20);
  g.fillRect(shopLeft + shopW * 0.78, top, shopW * 0.22, height);

  drawEchoVigas(g, shopLeft + 4, shopLeft + shopW - 4, top + 5, 7);

  // Open-Air Timber Ramada / Pergola
  const ramadaW = Math.round(width * 0.50);
  const ramadaH = Math.min(26, Math.round(height * 0.55));
  const ramadaTop = y - ramadaH;

  g.fillStyle(ECHO_TIMBER_DARK);
  g.fillRect(left + 2, ramadaTop, 2.5, ramadaH);
  g.fillRect(left + ramadaW - 3, ramadaTop, 2.5, ramadaH);

  g.fillStyle(ECHO_TIMBER_MID);
  g.fillRect(left, ramadaTop - 2, ramadaW + 2, 2.5);

  for (let rx = left + 1; rx <= left + ramadaW; rx += 5) {
    g.fillStyle(ECHO_TIMBER_LIGHT);
    g.fillRect(rx, ramadaTop - 4, 2, 3);
  }

  // Woven Desert Textile Sun-Canopy (Striped Awning)
  const canopyColors = [0xc24532, 0x2a9d8f, 0xeca836, 0xfdf6e2];
  for (let i = 0; i < ramadaW; i += 3) {
    const colIdx = Math.floor(i / 3) % canopyColors.length;
    g.fillStyle(canopyColors[colIdx]);
    g.fillRect(left + i, ramadaTop - 3.5, 3, 2.5);
    g.fillRect(left + i, ramadaTop - 1, 2.5, 1.5);
  }

  // Exterior Wall Niches with Painted Pottery
  const nicheY = y - 18;
  g.fillStyle(0x281208);
  g.fillRect(shopLeft + 5, nicheY - 8, 8, 8);
  g.fillCircle(shopLeft + 9, nicheY - 8, 4);
  drawEchoOlla(g, shopLeft + 9, nicheY, ECHO_POTTERY_RED);

  drawEchoOlla(g, left + 7, y - 6, ECHO_POTTERY_OCHRE);
  drawEchoOlla(g, left + 13, y - 6, ECHO_POTTERY_RED);
  drawEchoRistra(g, left + 2, ramadaTop + 3);

  if (height >= 48) {
    drawEchoWindow(g, shopLeft + shopW / 2 - 3, top + 14, 6, 7);
  }

  const doorX = shopLeft + Math.round(shopW * 0.58);
  drawEchoDoor(g, doorX, y - 6, 11, 16);
}

function drawCliffhangerRetreat(g, x, y, width, height, seed) {
  const left = x - width / 2;
  const top = y - height;

  g.fillStyle(ECHO_STONE_MID);
  g.fillRect(left - 2, y - 8, width + 4, 8);
  g.fillStyle(ECHO_STONE_DARK);
  g.fillRect(left - 3, y - 3, width + 6, 3);

  // Diagonal timber stilts supporting the cantilevered balcony
  g.fillStyle(ECHO_TIMBER_DARK);
  g.fillRect(left - 6, y - 12, 3, 12);
  g.fillRect(left - 4, y - 22, 3, 12);

  const balcW = Math.round(width * 0.52);
  const balcY = y - Math.round(height * 0.46);

  g.fillStyle(ECHO_TIMBER_DARK);
  g.fillRect(left - 7, balcY, balcW + 7, 3);
  g.fillStyle(ECHO_TIMBER_MID);
  g.fillRect(left - 7, balcY - 2, balcW + 7, 2);

  g.fillStyle(ECHO_TIMBER_LIGHT);
  g.fillRect(left - 7, balcY - 10, balcW + 7, 1.5);
  for (let bx = left - 6; bx <= left + balcW - 2; bx += 5) {
    g.fillRect(bx, balcY - 9, 1.5, 7.5);
  }

  // Hanging Iron Lantern under balcony beam
  g.fillStyle(0x180c06);
  g.fillRect(left - 4, balcY + 3, 1, 2);
  g.fillRect(left - 5.5, balcY + 5, 4, 4);
  g.fillStyle(ECHO_LANTERN_GLOW);
  g.fillRect(left - 4.5, balcY + 6, 2, 2);

  const bodyLeft = left + 2;
  const bodyW = width - 2;
  g.fillStyle(ECHO_ADOBE_WARM);
  g.fillRect(bodyLeft, top, bodyW, height);

  g.fillStyle(0xfff0d8, 0.16);
  g.fillRect(bodyLeft, top, bodyW * 0.22, height);
  g.fillStyle(0x000000, 0.20);
  g.fillRect(bodyLeft + bodyW * 0.78, top, bodyW * 0.22, height);

  g.fillCircle(bodyLeft + 4, top, 4);
  g.fillCircle(bodyLeft + bodyW - 4, top, 4);

  drawEchoVigas(g, bodyLeft + 4, bodyLeft + bodyW - 4, top + 5, 7);
  if (height >= 50) {
    drawEchoVigas(g, bodyLeft + 4, bodyLeft + bodyW - 4, balcY + 4, 7);
  }

  drawEchoLadder(g, bodyLeft + bodyW - 8, top + 4, balcY - 2, 2);

  g.fillStyle(ECHO_TIMBER_DARK);
  g.fillRect(bodyLeft + 6, top - 8, 2, 8);
  g.fillStyle(0xf5e6c8);
  g.fillTriangle(bodyLeft + 7, top - 8, bodyLeft + 18, top - 3, bodyLeft + 7, top - 2);

  drawEchoOlla(g, bodyLeft + bodyW - 3, top, ECHO_POTTERY_RED);

  drawEchoWindow(g, bodyLeft + 8, balcY - 18, 5, 7);
  if (bodyW > 30) {
    drawEchoWindow(g, bodyLeft + bodyW - 12, y - 24, 5, 7);
  }

  const doorX = bodyLeft + Math.round(bodyW * 0.55);
  drawEchoDoor(g, doorX, y - 6, 10, 15);
}

function drawEchoDwelling(g, x, y, width, height, style = 0, seed = 0) {
  footing(g, x, y, width + 8, ECHO_STONE_DARK, 75);
  const left = x - width / 2;

  // Stepped bedrock plinth foundation
  g.fillStyle(ECHO_STONE_MID);
  g.fillRect(left - 2, y - 6, width + 4, 6);
  g.fillStyle(ECHO_STONE_DARK);
  g.fillRect(left - 3, y - 2, width + 6, 2);

  const actualStyle = Math.abs(style) % 4;
  if (actualStyle === 0) {
    drawCliffPueblo(g, x, y, width, height, seed);
  } else if (actualStyle === 1) {
    drawCanyonWatchtower(g, x, y, width, height, seed);
  } else if (actualStyle === 2) {
    drawWeaverWorkshop(g, x, y, width, height, seed);
  } else {
    drawCliffhangerRetreat(g, x, y, width, height, seed);
  }
}

function drawAirportTerminalGate(g, x, y, width, height, glassColor) {
  const left = x - width / 2;
  const top = y - height;
  footing(g, x, y, width + 10, ASPHALT);

  // 1. Concrete & Composite Terminal Foundation Plinth
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left - 2, y - 8, width + 4, 8);
  g.fillStyle(ASPHALT);
  g.fillRect(left - 4, y - 4, width + 8, 4);

  // 2. Main Terminal Concourse Volume
  g.fillStyle(0x28323e);
  g.fillRect(left, top + 10, width, height - 10);

  // Aerodynamic Cantilevered Roof Canopy (Curved aerofoil profile)
  g.fillStyle(0x1a222c);
  g.fillRect(left - 6, top + 6, width + 12, 6);
  g.fillStyle(0x3a4858);
  g.fillTriangle(left - 6, top + 6, x, top - 6, left + width + 6, top + 6);
  g.fillRect(left - 4, top - 2, width + 8, 4);

  // Roof Skylights along the ridge
  g.fillStyle(SKY_GLASS);
  for (let sx = left + 8; sx < left + width - 8; sx += 14) {
    g.fillRect(sx, top - 4, 8, 3);
  }

  // Panoramic Glass Departure Concourse Wall
  const glassW = width - 10;
  const glassH = height - 32;
  const glassTop = top + 16;
  g.fillStyle(0x141c26);
  g.fillRect(left + 5, glassTop, glassW, glassH);
  g.fillStyle(glassColor);
  g.fillRect(left + 6, glassTop + 1, glassW - 2, glassH - 2);

  // Warm interior departures lounge illumination
  g.fillStyle(0xfff6cf, 0.65);
  g.fillRect(left + 8, glassTop + 4, glassW - 6, glassH - 8);

  // Flight Status Information Display Boards (glowing amber)
  if (width >= 40) {
    g.fillStyle(0x101a24);
    g.fillRect(x - 8, glassTop + 6, 16, 7);
    g.fillStyle(0xffaa22);
    g.fillRect(x - 6, glassTop + 8, 12, 3);
  }

  // Steel Vertical Structural Mullions
  g.fillStyle(0x4a5868);
  for (let mx = left + 10; mx < left + width - 10; mx += 10) {
    g.fillRect(mx, glassTop, 1.5, glassH);
  }

  // Telescopic Passenger Jet-Bridge (Gate Corridor) extending to tarmac
  const jbW = 16;
  const jbH = 22;
  const jbX = left + width - jbW - 2;
  const jbTop = y - jbH - 6;
  g.fillStyle(0x323e4c);
  g.fillRect(jbX, jbTop, jbW + 6, jbH);
  g.fillStyle(SKY_GLASS);
  g.fillRect(jbX + 2, jbTop + 3, jbW, 8);
  // Flexible weather accordion bellows
  g.fillStyle(0x181e26);
  g.fillRect(jbX + jbW - 2, jbTop + 2, 8, jbH - 2);
  for (let by = jbTop + 4; by < jbTop + jbH - 2; by += 2.5) {
    g.fillStyle(0x3c4652);
    g.fillRect(jbX + jbW - 2, by, 8, 1);
  }

  // Ground level apron markings & baggage trolley
  g.fillStyle(0xffd700);
  g.fillRect(left + 4, y - 2, width * 0.45, 1.5);
}

function drawAirportHangarBay(g, x, y, width, height) {
  const left = x - width / 2;
  const top = y - height;
  footing(g, x, y, width + 10, ASPHALT);

  // Tarmac apron footing with yellow/black hazard clearance strip
  g.fillStyle(ASPHALT);
  g.fillRect(left - 4, y - 6, width + 8, 8);
  for (let zx = left + 2; zx < left + width - 2; zx += 8) {
    g.fillStyle(0xffbb00);
    g.fillRect(zx, y - 5, 4, 3);
    g.fillStyle(0x181818);
    g.fillRect(zx + 4, y - 5, 4, 3);
  }

  // Arched industrial corrugated steel hangar envelope
  g.fillStyle(0x2c3540);
  g.fillRect(left, top + 10, width, height - 14);
  g.fillStyle(0x424e5c);
  g.fillTriangle(left, top + 10, x, top - 12, left + width, top + 10);
  g.fillStyle(0x1e2630);
  g.fillRect(left - 2, top + 8, width + 4, 3);

  // Deep illuminated maintenance bay interior
  const bayW = width - 14;
  const bayH = height - 22;
  const bayLeft = left + 7;
  const bayTop = top + 16;
  g.fillStyle(0x10141a);
  g.fillRect(bayLeft, bayTop, bayW, bayH);

  // Overhead yellow bridge crane gantry
  g.fillStyle(0xffcc00);
  g.fillRect(bayLeft + 2, bayTop + 2, bayW - 4, 3.5);
  g.fillStyle(0x222222);
  g.fillRect(x - 5, bayTop + 5, 10, 4);

  // Conical high-bay sodium floodlights
  g.fillStyle(0xfffae0, 0.35);
  g.fillTriangle(x - 12, bayTop + 5, bayLeft + 2, y - 8, x, y - 8);
  g.fillTriangle(x + 12, bayTop + 5, x, y - 8, bayLeft + bayW - 2, y - 8);

  // Service jacks & aircraft silhouette inside bay
  const planeY = y - 18;
  g.fillStyle(0xe2eaf2);
  g.fillRect(x - 16, planeY - 4, 32, 6);
  g.fillCircle(x - 16, planeY - 1, 3);
  g.fillStyle(0xb8c4d0);
  g.fillRect(x - 22, planeY - 2, 44, 2.5);
  g.fillStyle(0x0055bb);
  g.fillTriangle(x + 10, planeY - 4, x + 15, planeY - 14, x + 17, planeY - 4);

  // Yellow maintenance stands supporting the aircraft
  g.fillStyle(0xffaa00);
  g.fillRect(x - 12, planeY + 2, 3, 8);
  g.fillRect(x + 10, planeY + 2, 3, 8);

  // Bi-fold industrial hangar doors on sides
  g.fillStyle(0x242c36);
  g.fillRect(left + 1, top + 12, 6, height - 16);
  g.fillRect(left + width - 7, top + 12, 6, height - 16);
}

function drawAirCargoDepot(g, x, y, width, height) {
  const left = x - width / 2;
  const top = y - height;
  footing(g, x, y, width + 10, ASPHALT);

  // Concrete foundation & loading bay apron
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left - 2, y - 10, width + 4, 10);
  g.fillStyle(ASPHALT);
  g.fillRect(left - 4, y - 4, width + 8, 4);

  // Industrial cargo warehouse body (deep navy blue & steel grey)
  g.fillStyle(0x1c2432);
  g.fillRect(left, top, width, height - 8);
  g.fillStyle(0x283446);
  g.fillRect(left, top, width * 0.25, height - 8);
  // Gold corporate airline freight stripe
  g.fillStyle(ELECTRUM_GOLD);
  g.fillRect(left, top + 12, width, 3);

  // Ribbed metal siding texture
  g.fillStyle(0x141c26, 0.4);
  for (let sx = left + 4; sx < left + width - 4; sx += 6) {
    g.fillRect(sx, top + 16, 1, height - 26);
  }

  // Roll-up industrial freight bay doors
  const doorW = Math.min(22, Math.round(width * 0.38));
  // Bay Door 1 (Open with illuminated interior)
  const d1X = left + 8;
  g.fillStyle(0x10141c);
  g.fillRect(d1X, y - 28, doorW, 20);
  g.fillStyle(0xffea88, 0.5);
  g.fillRect(d1X + 2, y - 26, doorW - 4, 16);
  // Stacked air cargo pallets (ULD containers)
  g.fillStyle(0xb0b8c4);
  g.fillRect(d1X + 4, y - 16, 8, 8);
  g.fillRect(d1X + 13, y - 14, 7, 6);
  g.fillStyle(0x334455);
  g.fillRect(d1X + 4, y - 12, 8, 1);

  // Bay Door 2 (Closed with corrugated slats)
  const d2X = left + width - doorW - 8;
  g.fillStyle(0x3a4656);
  g.fillRect(d2X, y - 28, doorW, 20);
  g.fillStyle(0x222c38);
  for (let ry = y - 26; ry < y - 9; ry += 3) {
    g.fillRect(d2X, ry, doorW, 1.2);
  }

  // Yellow pushback tractor / forklift parked on apron
  g.fillStyle(0xffaa00);
  g.fillRect(left + width / 2 - 6, y - 10, 12, 6);
  g.fillStyle(0x111111);
  g.fillCircle(left + width / 2 - 4, y - 3, 2.5);
  g.fillCircle(left + width / 2 + 4, y - 3, 2.5);
}

function drawAirportFireStation(g, x, y, width, height) {
  const left = x - width / 2;
  const top = y - height;
  footing(g, x, y, width + 10, ASPHALT);

  // Concrete apron with yellow hazard chevron lines
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left - 2, y - 8, width + 4, 8);
  g.fillStyle(0xffbb00);
  g.fillRect(left + 2, y - 3, width - 4, 2);

  // Modern fire station facade (crimson red industrial panels & concrete)
  g.fillStyle(0xb82424);
  g.fillRect(left, top + 8, width, height - 14);
  g.fillStyle(CONCRETE);
  g.fillRect(left, top + 6, width, 4);
  g.fillRect(left - 2, top + 4, width + 4, 3);

  // Double Apparatus Bays (Glass roll-up doors)
  const bayW = Math.min(20, Math.round(width * 0.38));
  for (const bx of [left + 6, left + width - bayW - 6]) {
    g.fillStyle(0x181c22);
    g.fillRect(bx, y - 28, bayW, 22);
    g.fillStyle(SKY_GLASS);
    g.fillRect(bx + 2, y - 26, bayW - 4, 6);
    g.fillRect(bx + 2, y - 18, bayW - 4, 6);
    g.fillStyle(0xd82020);
    g.fillRect(bx + 2, y - 10, bayW - 4, 4);
  }

  // Crash Rescue Tender Vehicle silhouette inside left bay
  g.fillStyle(0xee2222);
  g.fillRect(left + 8, y - 16, 16, 9);
  g.fillStyle(0xffdd00);
  g.fillRect(left + 8, y - 11, 16, 2);
  g.fillStyle(0x222222);
  g.fillCircle(left + 11, y - 5, 2.5);
  g.fillCircle(left + 21, y - 5, 2.5);
  g.fillStyle(0xcccccc);
  g.fillRect(left + 18, y - 19, 4, 3);

  // Station Communications Tower & Emergency Beacon
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left + 4, top - 12, 6, 18);
  g.fillStyle(0xff2211);
  g.fillCircle(left + 7, top - 14, 2.5);
}

function drawAirportHeliportTerminal(g, x, y, width, height) {
  const left = x - width / 2;
  const top = y - height;
  footing(g, x, y, width + 10, ASPHALT);

  // Ground apron plinth
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left - 2, y - 8, width + 4, 8);

  // Two-story executive heliport terminal
  g.fillStyle(0x24303c);
  g.fillRect(left, top + 10, width, height - 16);

  // Panoramic executive glass lounge
  g.fillStyle(SKY_GLASS);
  g.fillRect(left + 6, top + 16, width - 12, height - 32);
  g.fillStyle(0xfff6d0, 0.6);
  g.fillRect(left + 8, top + 18, width - 16, height - 36);

  // Heavy structural concrete rooftop helipad deck
  g.fillStyle(CONCRETE_DARK);
  g.fillRect(left - 5, top + 2, width + 10, 8);
  // Bold red perimeter ring
  g.fillStyle(0xcc2222);
  g.fillRect(left - 4, top + 1, width + 8, 2);
  // Large yellow circle & white "H"
  g.fillStyle(0xffd700);
  g.fillCircle(x, top + 5, 6);
  g.fillStyle(0x24303c);
  g.fillCircle(x, top + 5, 4.5);
  // White "H"
  g.fillStyle(0xffffff);
  g.fillRect(x - 3, top + 2, 1.5, 6);
  g.fillRect(x + 1.5, top + 2, 1.5, 6);
  g.fillRect(x - 3, top + 4.5, 6, 1.5);

  // Heliport Green Perimeter Landing Lights
  g.fillStyle(0x22ee55);
  g.fillCircle(left - 3, top + 3, 1.5);
  g.fillCircle(left + width + 3, top + 3, 1.5);
  g.fillCircle(x, top, 1.5);

  // Rotating Fabric Windsock on mast
  g.fillStyle(0x333333);
  g.fillRect(left + 4, top - 14, 1.5, 14);
  g.fillStyle(0xff5500);
  g.fillTriangle(left + 5, top - 13, left + 14, top - 10, left + 5, top - 7);
  g.fillStyle(0xffffff);
  g.fillRect(left + 7, top - 12, 2.5, 4);

  // Aviation Fuel Replenishment Cabinet on ground
  g.fillStyle(0xffcc00);
  g.fillRect(left + width - 10, y - 12, 8, 6);
}

function drawSunCitySkyscraper(g, x, y, width, height, glassColor, style) {
  const actualStyle = Math.abs(style) % 5;
  if (actualStyle === 0) {
    drawAirportTerminalGate(g, x, y, width, height, glassColor);
  } else if (actualStyle === 1) {
    drawAirportHangarBay(g, x, y, width, height);
  } else if (actualStyle === 2) {
    drawAirCargoDepot(g, x, y, width, height);
  } else if (actualStyle === 3) {
    drawAirportFireStation(g, x, y, width, height);
  } else {
    drawAirportHeliportTerminal(g, x, y, width, height);
  }
}

function drawLongfieldBuilding(g, x, y, width, height, seed = 0) {
  footing(g, x, y, width + 6, 0x765a40);
  const left = x - width / 2;
  const top = y - height;
  const style = Math.floor(hash(seed + 0.15) * 4);

  if (style === 0) {
    // Style 0: Pioneer Veranda Homestead (Pale cedar/sage with wrap porch)
    const wallColor = hash(seed + 0.3) < 0.5 ? 0xd0c4b0 : 0xb8c2aa;
    g.fillStyle(wallColor);
    g.fillRect(left, top, width, height);
    g.fillStyle(0xffffff, 0.16);
    g.fillRect(left, top, width * 0.45, height);

    // Clapboard lines
    g.fillStyle(0x443a30, 0.2);
    for (let ly = top + 4; ly < y - 6; ly += 4) {
      g.fillRect(left, ly, width, 1);
    }

    // Sloped Gabled Roof
    g.fillStyle(0x563826);
    g.fillTriangle(left - 3, top, x, top - 12, left + width + 3, top);
    g.fillStyle(0x724832);
    g.fillTriangle(left - 3, top, x, top - 12, x, top);

    // Front Porch & Railings
    g.fillStyle(0x60442e);
    g.fillRect(left - 2, y - 14, width + 4, 2); // Porch roof
    g.fillRect(left, y - 14, 2, 14); // Left post
    g.fillRect(left + width - 2, y - 14, 2, 14); // Right post
    g.fillRect(x - 2, y - 14, 2, 14); // Center post

    // Windows & Door
    g.fillStyle(0x3a2214);
    g.fillRect(x - 4, y - 12, 8, 12); // Door
    g.fillStyle(0xffefaa);
    g.fillRect(left + 4, y - 11, 7, 7); // Warm glowing window
    g.fillRect(left + width - 11, y - 11, 7, 7);

    // Brick Chimney
    g.fillStyle(0x884433);
    g.fillRect(left + 4, top - 14, 4, 10);
  } else if (style === 1) {
    // Style 1: Dutch Gambrel Barn / Outbuilding (Barn-red with X-buck loft doors)
    g.fillStyle(0x8e2c22);
    g.fillRect(left, top, width, height);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(left, top, width * 0.45, height);

    // Vertical battens
    g.fillStyle(0x621a12, 0.35);
    for (let bx = left + 3; bx < left + width; bx += 4) {
      g.fillRect(bx, top, 1, height);
    }

    // Gambrel roof
    g.fillStyle(0x601c16);
    g.fillTriangle(left - 3, top, x, top - 14, left + width + 3, top);
    g.fillStyle(0x7a241c);
    g.fillTriangle(left - 3, top, x, top - 14, x, top);

    // White Trim Barn Double Doors with X-bucks
    g.fillStyle(0xeee8dc);
    g.fillRect(x - 7, y - 14, 14, 14);
    g.fillStyle(0x8e2c22);
    g.fillRect(x - 6, y - 13, 5, 12);
    g.fillRect(x + 1, y - 13, 5, 12);

    // Upper Hayloft Door
    if (height > 26) {
      g.fillStyle(0xeee8dc);
      g.fillRect(x - 5, top + 2, 10, 8);
      g.fillStyle(0x280e08);
      g.fillRect(x - 4, top + 3, 8, 6);
    }
  } else if (style === 2) {
    // Style 2: Prairie Adobe Villa with Vigas (Terracotta/sand ochre)
    const adobeColor = hash(seed + 0.4) < 0.5 ? 0xcfa87a : 0xba8862;
    g.fillStyle(adobeColor);
    g.fillRect(left, top, width, height);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(left, top, width * 0.4, height);
    g.fillStyle(0x24180c, 0.2);
    g.fillRect(left + width * 0.7, top, width * 0.3, height);

    // Parapet roof rim
    g.fillStyle(0x9a6c48);
    g.fillRect(left - 1, top - 2, width + 2, 3);

    // Protruding wooden round vigas (roof beams)
    g.fillStyle(0x563820);
    for (let vx = left + 4; vx < left + width; vx += 6) {
      g.fillCircle(vx, top + 3, 1.8);
    }

    // Deep-set arched wooden doorway
    g.fillStyle(0x3a2010);
    g.fillRect(x - 4, y - 12, 8, 12);
    g.fillCircle(x, y - 12, 4);

    // Small high casement window with turquoise lintel
    g.fillStyle(0x307878);
    g.fillRect(left + width - 11, top + 8, 7, 1.5);
    g.fillStyle(0xffe890);
    g.fillRect(left + width - 10, top + 10, 5, 5);
  } else {
    // Style 3: Frontier False-Front Mercantile / Workshop
    const shopColor = hash(seed + 0.5) < 0.5 ? 0xb08848 : 0x7a6854;
    g.fillStyle(shopColor);
    g.fillRect(left, top - 6, width, height + 6);
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(left, top - 6, width * 0.45, height + 6);

    // Stepped false-front parapet crown
    g.fillStyle(0x5e4228);
    g.fillRect(left - 1, top - 8, width + 2, 2.5);
    g.fillRect(left + 4, top - 11, width - 8, 3);

    // Striped Fabric Awning
    g.fillStyle(0x9a3024);
    g.fillRect(left, top + 8, width, 4);
    for (let ax = left; ax < left + width; ax += 6) {
      g.fillStyle(0xf0ece2);
      g.fillRect(ax, top + 8, 3, 4);
    }

    // Storefront bay window & center door
    g.fillStyle(0x2a1a10);
    g.fillRect(x - 3.5, y - 13, 7, 13);
    g.fillStyle(0xfff0aa);
    g.fillRect(left + 3, y - 11, width * 0.3, 8);
    g.fillRect(left + width - width * 0.3 - 3, y - 11, width * 0.3, 8);

    // Stovepipe
    g.fillStyle(0x222222);
    g.fillRect(left + width - 4, top - 15, 2, 9);
  }
}

function sunlandStreetBuildings() {
  const buildings = [];
  const landmarks = SUNLAND_LANDMARKS;

  // 1. Redrock Street (31260 - 32500)
  for (let x = 31260; x <= 32500; x += 95) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 45));
    if (gap < 12) continue;
    const seed = x * 0.013;
    const isTower = hash(seed) < 0.4;
    const artW = 28 + Math.round(hash(seed + 1) * 16);
    const artH = isTower ? 110 + Math.round(hash(seed + 2) * 70) : 45 + Math.round(hash(seed + 2) * 35);
    const body = [REDROCK_STONE, REDROCK_LIGHT, REDROCK_DARK][Math.floor(hash(seed + 3) * 3)];
    buildings.push({
      id: `redrock-street-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: isTower ? 260 : 160,
      draw: scaled((g, at, y) => drawRedrockStreet(g, at, y, artW, artH, isTower, body)),
    });
  }

  // 2. Echo Canyon Dwellings - West Rim (32800 - 33920)
  for (let x = 32800; x <= 33920; x += 105) {
    if (isWater(x)) continue;
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 45));
    if (gap < 12) continue;
    const seed = x * 0.017;
    const artW = 34 + Math.round(hash(seed + 1) * 18);
    const artH = 42 + Math.round(hash(seed + 2) * 44);
    const style = Math.floor(hash(seed + 3) * 4);
    buildings.push({
      id: `echo-dwelling-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 160,
      draw: scaled((g, at, y) => drawEchoDwelling(g, at, y, artW, artH, style, seed)),
    });
  }

  // 3. Echo Canyon Dwellings - East Rim (35020 - 35450)
  for (let x = 35020; x <= 35450; x += 105) {
    if (isWater(x)) continue;
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 45));
    if (gap < 12) continue;
    const seed = x * 0.019;
    const artW = 34 + Math.round(hash(seed + 1) * 18);
    const artH = 44 + Math.round(hash(seed + 2) * 44);
    const style = Math.floor(hash(seed + 3) * 4);
    buildings.push({
      id: `echo-dwelling-east-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 160,
      draw: scaled((g, at, y) => drawEchoDwelling(g, at, y, artW, artH, style, seed)),
    });
  }

  // 4. Sun City International Airport Complex Facilities (38450 - 40850)
  for (let x = 38450; x <= 40850; x += 95) {
    if (Math.abs(x - 37020) < 70 || Math.abs(x - 40680) < 70) continue;
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 50));
    if (gap < 14) continue;
    const seed = x * 0.019;
    const artW = 40 + Math.round(hash(seed + 1) * 22);
    const artH = 55 + Math.round(hash(seed + 2) * 35);
    const glass = [SKY_GLASS, SUN_GLASS, GOLD_GLASS][Math.floor(hash(seed + 3) * 3)];
    const style = Math.floor(hash(seed + 4) * 5);
    buildings.push({
      id: `suncity-tower-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 340,
      draw: scaled((g, at, y) => drawSunCitySkyscraper(g, at, y, artW, artH, glass, style)),
    });
  }

  // 5. Longfield Savanna Village (41620 - 42050)
  for (let x = 41620; x <= 42050; x += 70) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 35));
    if (gap < 10) continue;
    const seed = x * 0.023;
    const artW = 28 + Math.round(hash(seed + 1) * 16);
    const artH = 26 + Math.round(hash(seed + 2) * 18);
    buildings.push({
      id: `longfield-home-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 140,
      draw: scaled((g, at, y) => drawLongfieldBuilding(g, at, y, artW, artH, seed)),
    });
  }

  // 6. Long Plains Savanna Outposts & Ranches (42100 - 42550)
  for (let x = 42100; x <= 42550; x += 95) {
    const gap = Math.min(...landmarks.map(l => Math.abs(x - l.x) - l.clear - 35));
    if (gap < 10) continue;
    const seed = x * 0.027;
    const artW = 30 + Math.round(hash(seed + 1) * 16);
    const artH = 28 + Math.round(hash(seed + 2) * 20);
    buildings.push({
      id: `savanna-ranch-${x}`,
      x,
      door: true,
      width: artW * CITY_SCALE,
      height: artH * CITY_SCALE,
      maxHealth: 150,
      draw: scaled((g, at, y) => drawLongfieldBuilding(g, at, y, artW, artH, seed)),
    });
  }

  return buildings;
}

export const SUNLAND_BUILDINGS = Object.freeze([
  ...sunlandStreetBuildings(),
  ...SUNLAND_LANDMARKS,
]);

function drawCactus(g, x, y, h = 32) {
  g.fillStyle(0x386b3e);
  g.fillRect(x - 3, y - h, 6, h);
  g.fillRect(x - 11, y - h * 0.65, 8, 4);
  g.fillRect(x - 11, y - h * 0.85, 4, h * 0.2);
  g.fillRect(x + 3, y - h * 0.5, 8, 4);
  g.fillRect(x + 7, y - h * 0.75, 4, h * 0.25);
  g.fillStyle(0x28502c);
  g.fillRect(x - 1, y - h, 2, h);
}

function drawAcacia(g, x, y, w = 48, h = 36) {
  g.fillStyle(0x4a3628);
  g.fillRect(x - 2, y - h * 0.6, 4, h * 0.6);
  g.fillRect(x - 8, y - h * 0.85, 8, 3);
  g.fillRect(x, y - h * 0.85, 8, 3);
  g.fillStyle(0x5a7838);
  g.fillRect(x - w / 2, y - h, w, 8);
  g.fillRect(x - w * 0.4, y - h - 4, w * 0.8, 5);
  g.fillStyle(0x3e5624);
  g.fillRect(x - w / 2 + 2, y - h + 6, w - 4, 2);
}

function drawStreetlight(g, x, y, h = 28) {
  g.fillStyle(0x60666e);
  g.fillRect(x - 1, y - h, 2, h);
  g.fillRect(x - 1, y - h, 8, 2);
  g.fillStyle(0xfff4c0);
  g.fillCircle(x + 6, y - h + 2, 2.5);
}

function drawParkedAirliner(g, x, y) {
  // Grounded regional jet parked on terminal apron
  g.fillStyle(0xdddedf);
  g.fillRect(x - 28, y - 24, 56, 12);
  // Aerodynamic nose
  g.fillTriangle(x - 28, y - 24, x - 36, y - 18, x - 28, y - 12);
  // Cockpit windshield & cabin windows
  g.fillStyle(0x223344);
  g.fillRect(x - 32, y - 22, 5, 4);
  for (let wx = x - 24; wx < x + 20; wx += 6) {
    g.fillRect(wx, y - 21, 3, 3);
  }
  // Swept vertical stabilizer fin & blue airline livery stripe
  g.fillStyle(0x0a4b88);
  g.fillTriangle(x + 14, y - 24, x + 28, y - 44, x + 28, y - 24);
  g.fillRect(x - 28, y - 16, 56, 2);
  // Jet engine nacelle & pylon
  g.fillStyle(0x5a6068);
  g.fillRect(x - 4, y - 14, 14, 6);
  // Heavy landing gear legs & dual tires
  g.fillStyle(0x24282c);
  g.fillRect(x - 22, y - 12, 3, 12);
  g.fillCircle(x - 21, y - 2, 3);
  g.fillRect(x + 10, y - 12, 3, 12);
  g.fillCircle(x + 11, y - 2, 3);
  // Mobile boarding stairway parked at forward door
  g.fillStyle(0xe2a822);
  g.fillTriangle(x - 20, y - 20, x - 12, y - 2, x - 24, y - 2);
  g.fillRect(x - 24, y - 4, 14, 3);
}

function drawHelipad(g, x, y) {
  // Elevated concrete helipad deck above ground
  g.fillStyle(0x323a42);
  g.fillRect(x - 24, y - 18, 48, 15);
  // Red safety perimeter border
  g.fillStyle(0xcc2222);
  g.fillRect(x - 24, y - 18, 48, 2.5);
  // Bold yellow circle
  g.fillStyle(0xffd700);
  g.fillCircle(x, y - 10, 8);
  g.fillStyle(0x323a42);
  g.fillCircle(x, y - 10, 6);
  // Bold white "H"
  g.fillStyle(0xffffff);
  g.fillRect(x - 4, y - 14, 2, 8);
  g.fillRect(x + 2, y - 14, 2, 8);
  g.fillRect(x - 4, y - 11, 8, 2);
  // Green perimeter landing lights on stalks
  g.fillStyle(0x22ee55);
  for (let a = 0; a < 6; a++) {
    const ang = a * Math.PI / 3;
    const lx = x + Math.cos(ang) * 21;
    const ly = y - 10 + Math.sin(ang) * 3;
    g.fillCircle(lx, ly, 1.8);
  }
  // Windsock mast & fabric cone
  g.fillStyle(0x333333);
  g.fillRect(x - 26, y - 32, 1.5, 32);
  g.fillStyle(0xff5500);
  g.fillTriangle(x - 25, y - 31, x - 13, y - 27, x - 25, y - 23);
  g.fillStyle(0xffffff);
  g.fillRect(x - 21, y - 29.5, 3.5, 5);
}

function drawParkedExecutiveJet(g, x, y) {
  const py = y - 14;
  g.fillStyle(0xffffff);
  g.fillRect(x - 22, py - 10, 44, 8);
  g.fillCircle(x - 22, py - 6, 4);
  g.fillStyle(0x187bcd);
  g.fillRect(x - 20, py - 5, 42, 1.5);
  g.fillStyle(0xdbe3ea);
  g.fillRect(x - 14, py - 7, 28, 2);
  g.fillTriangle(x + 12, py - 10, x + 18, py - 22, x + 22, py - 10);
  g.fillStyle(0x187bcd);
  g.fillTriangle(x + 14, py - 10, x + 18, py - 20, x + 20, py - 10);
  g.fillStyle(0x323a42);
  g.fillRect(x + 6, py - 13, 8, 4);
  g.fillRect(x - 16, py - 2, 2, 6);
  g.fillRect(x + 8, py - 2, 2, 6);
  // Passenger boarding stairs
  g.fillStyle(0xe2a822);
  g.fillTriangle(x - 14, py - 8, x - 8, py - 1, x - 18, py - 1);
}

function drawParkedHelicopter(g, x, y) {
  const py = y - 14;
  g.fillStyle(0x0055bb);
  g.fillRect(x - 12, py - 14, 24, 9);
  g.fillCircle(x - 12, py - 9.5, 4.5);
  g.fillStyle(0x9fb8c6);
  g.fillRect(x - 14, py - 13, 5, 5);
  g.fillStyle(0x0055bb);
  g.fillRect(x + 10, py - 12, 16, 3);
  g.fillTriangle(x + 24, py - 12, x + 26, py - 18, x + 26, py - 12);
  g.fillStyle(0x222222);
  g.fillRect(x - 1, py - 17, 2, 3);
  g.fillRect(x - 18, py - 18, 36, 1.5);
  g.fillRect(x - 10, py - 5, 2, 5);
  g.fillRect(x + 6, py - 5, 2, 5);
  g.fillRect(x - 14, py - 1, 28, 1.5);
}

function drawSunlandScenery(g, left, right, seaY, cameraX) {
  // Continuous Elevated International Airport Runway 09L / 27R & Taxiways (36660 - 40860)
  for (let x = Math.floor(left / 60) * 60; x <= right + 60; x += 60) {
    const wx = wrapX(x);
    if (wx >= 36660 && wx <= 40860) {
      const y = sunlandBase(wx, seaY);
      // Paved asphalt runway shoulder & flight line bed
      g.fillStyle(0x26292e);
      g.fillRect(x - 30, y - 18, 60, 15);
      // Main dark grooved tarmac runway bed
      g.fillStyle(0x16181c);
      g.fillRect(x - 28, y - 17, 56, 14);

      // Elevated Runway Edge Lights on Stalks (White)
      g.fillStyle(0x444444);
      g.fillRect(x - 27, y - 22, 1.5, 5);
      g.fillRect(x + 25.5, y - 22, 1.5, 5);
      g.fillStyle(0xffffff);
      g.fillCircle(x - 26, y - 23, 1.8);
      g.fillCircle(x + 26, y - 23, 1.8);

      // Bold White Dashed Centerline Markings with Embedded Lights
      g.fillStyle(0xffffff, 0.95);
      g.fillRect(x - 14, y - 11, 28, 2.5);
      g.fillStyle(0xfffae0);
      g.fillCircle(x, y - 10, 1.2);

      // West Threshold (Runway 09L at 37020)
      if (wx === 37020) {
        // High-intensity green threshold light bar on masts
        for (let tx = -26; tx <= 26; tx += 5) {
          g.fillStyle(0x333333);
          g.fillRect(x + tx - 0.5, y - 23, 1, 5);
          g.fillStyle(0x22ee55);
          g.fillCircle(x + tx, y - 24, 2);
        }
        // Bold white piano keys
        g.fillStyle(0xffffff);
        for (let k = -22; k <= 22; k += 5) g.fillRect(x + k, y - 16, 3.5, 11);
        // Clear block pixel stencil: "09L"
        // '0' at x + 24
        g.fillRect(x + 24, y - 15, 3, 6);
        g.fillStyle(0x16181c);
        g.fillRect(x + 25, y - 14, 1, 4);
        g.fillStyle(0xffffff);
        // '9' at x + 28
        g.fillRect(x + 28, y - 15, 3, 6);
        g.fillStyle(0x16181c);
        g.fillRect(x + 28, y - 12, 2, 2);
        g.fillStyle(0xffffff);
        // 'L' at x + 32
        g.fillRect(x + 32, y - 15, 1, 6);
        g.fillRect(x + 32, y - 10, 3, 1);
      }
      // Yellow blast pad chevrons west (36720 - 36960)
      if (wx >= 36720 && wx < 37020) {
        g.fillStyle(0xd49b20, 0.9);
        g.fillTriangle(x - 14, y - 15, x + 2, y - 10, x - 14, y - 5);
      }

      // West PAPI (Precision Approach Path Indicator) 4-Light Array at 37140
      if (wx === 37140) {
        g.fillStyle(0x222222);
        g.fillRect(x - 24, y - 24, 18, 3);
        // 2 Red, 2 White on 3-degree glidepath
        g.fillStyle(0xff2211);
        g.fillRect(x - 26, y - 27, 4, 3);
        g.fillRect(x - 21, y - 27, 4, 3);
        g.fillStyle(0xffffff);
        g.fillRect(x + 16, y - 27, 4, 3);
        g.fillRect(x + 21, y - 27, 4, 3);
      }

      // Touchdown Zone Aiming Points (37260 & 40380)
      if (wx === 37260 || wx === 40380) {
        g.fillStyle(0xffffff, 0.95);
        g.fillRect(x - 20, y - 15, 14, 6);
        g.fillRect(x + 6, y - 15, 14, 6);
      }

      // East PAPI 4-Light Array at 40560
      if (wx === 40560) {
        g.fillStyle(0x222222);
        g.fillRect(x - 24, y - 24, 18, 3);
        g.fillStyle(0xffffff);
        g.fillRect(x - 26, y - 27, 4, 3);
        g.fillRect(x - 21, y - 27, 4, 3);
        g.fillStyle(0xff2211);
        g.fillRect(x + 16, y - 27, 4, 3);
        g.fillRect(x + 21, y - 27, 4, 3);
      }

      // East Threshold (Runway 27R at 40680)
      if (wx === 40680) {
        // Red runway end lights on masts
        for (let tx = -26; tx <= 26; tx += 5) {
          g.fillStyle(0x333333);
          g.fillRect(x + tx - 0.5, y - 23, 1, 5);
          g.fillStyle(0xee2222);
          g.fillCircle(x + tx, y - 24, 2);
        }
        // Bold white piano keys
        g.fillStyle(0xffffff);
        for (let k = -22; k <= 22; k += 5) g.fillRect(x + k, y - 16, 3.5, 11);
        // Clear block pixel stencil: "27R"
        // '2' at x - 34
        g.fillRect(x - 34, y - 15, 3, 6);
        g.fillStyle(0x16181c);
        g.fillRect(x - 34, y - 14, 2, 1.5);
        g.fillRect(x - 33, y - 11.5, 2, 1.5);
        g.fillStyle(0xffffff);
        // '7' at x - 30
        g.fillRect(x - 30, y - 15, 3, 2);
        g.fillRect(x - 28, y - 15, 1, 6);
        // 'R' at x - 26
        g.fillRect(x - 26, y - 15, 3, 6);
        g.fillStyle(0x16181c);
        g.fillRect(x - 25, y - 14, 1, 1.5);
        g.fillRect(x - 26, y - 11, 2, 2);
        g.fillStyle(0xffffff);
      }
      // Yellow blast pad chevrons east (40740 - 40860)
      if (wx > 40680 && wx <= 40880) {
        g.fillStyle(0xd49b20, 0.9);
        g.fillTriangle(x + 14, y - 15, x - 2, y - 10, x + 14, y - 5);
      }

      // Parallel Taxiway & Apron Connectors
      g.fillStyle(0xe2a822, 0.9);
      g.fillRect(x - 30, y - 6, 60, 2);
      // Blue LED taxiway edge lights on stalks
      g.fillStyle(0x333333);
      g.fillRect(x - 28.5, y - 9, 1, 3);
      g.fillRect(x + 27.5, y - 9, 1, 3);
      g.fillStyle(0x3388ff);
      g.fillCircle(x - 28, y - 10, 1.6);
      g.fillCircle(x + 28, y - 10, 1.6);
    }
  }

  // Dedicated Elevated Helipads (36480, 38460, 40200)
  for (const hx of [36480, 38460, 40200]) {
    const padX = nearest(hx, cameraX);
    if (padX >= left - 60 && padX <= right + 60) {
      drawHelipad(g, padX, sunlandBase(hx, seaY));
    }
  }

  // Apron Parked Aircraft
  const apron1X = nearest(37480, cameraX);
  if (apron1X >= left - 60 && apron1X <= right + 60) {
    drawParkedAirliner(g, apron1X, sunlandBase(37480, seaY));
  }
  const apron2X = nearest(38850, cameraX);
  if (apron2X >= left - 60 && apron2X <= right + 60) {
    drawParkedExecutiveJet(g, apron2X, sunlandBase(38850, seaY));
  }
  const apronHeliX = nearest(36480, cameraX);
  if (apronHeliX >= left - 60 && apronHeliX <= right + 60) {
    drawParkedHelicopter(g, apronHeliX, sunlandBase(36480, seaY));
  }
  const apron3X = nearest(40350, cameraX);
  if (apron3X >= left - 60 && apron3X <= right + 60) {
    drawParkedAirliner(g, apron3X, sunlandBase(40350, seaY));
  }

  for (let x = Math.floor(left / 80) * 80; x <= right + 80; x += 80) {
    const wx = wrapX(x);
    if (wx < SUNLAND.from || wx > SUNLAND.to || isWater(wx)) continue;
    const y = sunlandBase(wx, seaY);
    const r = hash(wx * 0.031);
    if (wx >= 31200 && wx < 35600 && r < 0.4) {
      drawCactus(g, x, y, 24 + Math.round(r * 20));
    } else if (wx >= 41000 && wx <= 42600 && r < 0.35) {
      drawAcacia(g, x, y, 40 + Math.round(r * 24), 32 + Math.round(r * 16));
    } else if (wx >= 36000 && wx <= 41000 && (Math.round(x / 80) % 3 === 0)) {
      drawStreetlight(g, x, y, 32);
    }
  }
}

export function drawSunland(g, left, right, seaY, cameraX, elapsed, buildings = true) {
  const mid = nearest((SUNLAND.from + SUNLAND.to) / 2, cameraX);
  const half = (SUNLAND.to - SUNLAND.from) / 2;
  if (right < mid - half - 500 || left > mid + half + 500) return;

  drawSunlandScenery(g, left, right, seaY, cameraX);

  if (!buildings) return;
  for (const b of SUNLAND_BUILDINGS) {
    const at = nearest(b.x, cameraX);
    if (at + b.width / 2 + ART_MARGIN < left || at - b.width / 2 - ART_MARGIN > right) continue;
    b.draw(g, at, sunlandBase(b.x, seaY), elapsed);
    if (b.fx) b.fx(g, at, sunlandBase(b.x, seaY), elapsed);
  }
}
