// Match the existing officers' 19–20 px anatomy. Jointed poses, not enlarged blocks.
export const ELITE_TYPES = new Set(['police-pursuit', 'police-breacher', 'sky-marshal', 'bulwark', 'rhino', 'goliath']);
const NAVY = 0x243550, DARK = 0x142137, CLOTH = 0x1c2b45;
const PLATE = 0xd0dce3, EDGE = 0x8b9fb2, GOLD = 0xdcb65c;

function limb(g, x, y, kneeX, kneeY, endX, endY, width, color) {
  g.lineStyle(width, color);
  g.lineBetween(x, y, kneeX, kneeY);
  g.lineBetween(kneeX, kneeY, endX, endY);
  g.fillStyle(DARK);
  g.fillCircle(kneeX, kneeY, width * 0.46);
}
function jet(g, x, y, thrust, warning, elapsed) {
  g.fillStyle(DARK); g.fillRect(x, y, 2.1, 6.8);
  g.fillStyle(EDGE); g.fillRect(x + 0.35, y + 0.5, 1.3, 4.5);
  g.fillStyle(0x536d81); g.fillRect(x - 0.25, y + 5.4, 2.6, 1.3);
  if (thrust <= 0) return;
  const flame = 2.4 + thrust * 5 + Math.sin(elapsed * 43 + x) * 0.7;
  g.fillStyle(warning ? 0xf4b657 : 0x43b5cc, 0.7);
  g.fillTriangle(x - 0.15, y + 6.8, x + 2.3, y + 6.8, x + 1, y + 6.8 + flame);
  g.fillStyle(warning ? 0xffd483 : 0xa4e2e9, 0.9);
  g.fillTriangle(x + 0.45, y + 6.8, x + 1.6, y + 6.8, x + 1, y + 8 + flame * 0.42);
}
export function drawPoliceElite(g, enemy, groundAt, elapsed) {
  if (enemy.enemyType === 'sky-marshal') return drawSkyMarshal(g, enemy, groundAt, elapsed);
  if (enemy.enemyType === 'bulwark') return drawBulwark(g, enemy, groundAt, elapsed);
  if (enemy.enemyType === 'rhino') return drawRhino(g, enemy, groundAt, elapsed);
  if (enemy.enemyType === 'goliath') return drawGoliath(g, enemy, groundAt, elapsed);
  const pursuit = enemy.enemyType === 'police-pursuit';
  const rider = !!enemy.policeRider;
  const flying = pursuit;
  const armor = enemy.enemyType === 'police-breacher';
  const scale = armor ? 1.05 : 1;
  const dead = enemy.health <= 0;
  const falling = enemy.lifted === 'falling' || enemy.lifted === 'held';
  const lying = (dead || enemy.dazed > 0) && !falling;
  const dir = enemy.facing < 0 ? -1 : 1;
  const striking = enemy.state === 'strike';
  const warning = enemy.state === 'windup' || enemy.state === 'aim' || enemy.state === 'locked';
  const firing = enemy.state === 'burst';
  const move = (enemy.x - enemy.previousX) * dir;
  const phase = elapsed * (flying ? 7 : 12) + (enemy.weaponPhase ?? 0) * 6;
  let ax = warning || striking || firing ? enemy.aim.x * dir : armor ? 0.45 : 0.85;
  let ay = warning || striking || firing ? enemy.aim.y : armor ? 0.8 : 0.25;
  const wantLean = striking ? Math.atan2(enemy.aim.y, enemy.aim.x * dir) + Math.PI / 2
    : enemy.state === 'stunned' ? -0.32 * (enemy.recoil || 1) * dir
      : flying ? Math.max(-0.3, Math.min(0.48, move * 0.28)) : Math.max(-0.12, Math.min(0.18, move * 0.2));
  const pose = enemy.elitePose ??= { lean: wantLean, at: elapsed };
  const dt = Math.max(0, Math.min(0.05, elapsed - pose.at));
  pose.lean += (wantLean - pose.lean) * (1 - Math.exp(-16 * dt));
  pose.at = elapsed;
  const white = enemy.flash > 0 && !dead;
  const suit = white ? 0xffecd3 : dead ? 0x394554 : NAVY;
  const plate = white ? 0xfff4e0 : dead ? 0x7e8c94 : PLATE;
  const skin = white ? 0xffecd3 : dead ? 0x9a8270 : 0xd9a481;
  const y = lying ? groundAt(enemy.x) - 3.5 * scale : enemy.y + (!dead && flying && !falling ? Math.sin(phase) * 0.35 : 0);
  g.save(); g.translateCanvas(enemy.x, y); g.scaleCanvas(dir * scale, scale);
  const turn = lying ? Math.PI / 2 : falling ? (enemy.angle ?? 0) * dir : pose.lean;
  g.rotateCanvas(turn);
  if (warning || striking || firing) {
    const before = ax;
    ax = before * Math.cos(turn) + ay * Math.sin(turn);
    ay = ay * Math.cos(turn) - before * Math.sin(turn);
  }
  if (lying) { ax = 0; ay = 1; }
  if (flying) {
    jet(g, -4.7, -4.8, dead || falling ? 0 : striking ? 1.3 : Math.min(0.75, 0.25 + Math.abs(move) * 0.18), warning, elapsed);
    g.fillStyle(DARK); g.fillRect(-3.7, -5, 1.4, 7);
    if (pursuit) { g.fillStyle(EDGE); g.fillRect(-5.4, -5.6, 3.2, 6.2); g.fillStyle(0x6b8193); g.fillRect(-5.4, -1.2, 3.2, 1); }
  }
  // Knees and ankles articulate independently; flight tucks one leg and trails the other.
  const stride = Math.abs(move) > 0.05 && !flying ? Math.sin(phase) * 2 : 0;
  const tuck = false;
  const loose = falling || lying;
  const k1x = lying ? -1.3 : tuck ? -1.9 : -1.1 + stride, k1y = tuck ? 5.5 : 5.8;
  const f1x = lying ? -1.8 : loose ? -4 : flying ? -1.9 + Math.sin(phase) * 0.3 : -1.1 - stride, f1y = loose ? 8 : tuck ? 8 : 9.3;
  const k2x = lying ? 1.6 : loose ? 3.8 : tuck ? 3.2 + Math.sin(phase) * 0.35 : 1.1 - stride;
  const k2y = tuck ? 4.7 : 5.6;
  const f2x = lying ? 2.1 : loose ? 5.3 : flying ? 0.3 + Math.sin(phase + 1) * 0.3 : 1.1 + stride, f2y = loose ? 7 : tuck ? 7.3 : 9.3;
  limb(g, -1.15, 2.3, k1x, k1y, f1x, f1y, armor ? 1.75 : 1.35, CLOTH);
  limb(g, 1.15, 2.3, k2x, k2y, f2x, f2y, armor ? 1.9 : 1.5, suit);
  g.fillStyle(DARK);
  g.fillRect(f1x - 0.7, f1y - 0.2, 2.4, 1.1); g.fillRect(f2x - 0.6, f2y - 0.2, 2.5, 1.1);
  if (armor) {
    g.fillStyle(plate); g.fillRect(k1x - 0.8, k1y - 0.8, 1.5, 1.7); g.fillRect(k2x - 0.9, k2y - 0.9, 1.7, 1.8);
    g.lineStyle(1.1, EDGE); g.lineBetween(k2x, k2y + 1.3, f2x, f2y - 0.8);
  }
  const width = armor ? 6.1 : 4.8;
  g.fillStyle(suit);
  g.fillTriangle(-width / 2, -4.8, width / 2, -4.8, -1.8, 2.6);
  g.fillTriangle(width / 2, -4.8, 1.8, 2.6, -1.8, 2.6);
  g.fillStyle(armor ? plate : 0x8da4b8);
  g.fillRect(-1.9, -4.6, armor ? 3.8 : 0.7, armor ? 4.7 : 5.2);
  if (armor) {
    g.fillStyle(EDGE); g.fillRect(-2.1, -4.8, 4.3, 0.7);
    g.fillStyle(DARK); g.fillRect(-0.3, -3.8, 0.6, 4); g.fillRect(-2.5, 0.3, 5, 0.9);
  }
  g.fillStyle(DARK); g.fillRect(-2, 1.8, 4.2, 1.1);
  g.fillStyle(GOLD); g.fillRect(0.7, -3.2, 1.1, 1.6); g.fillRect(-0.3, 1.9, 0.8, 0.7);
  // A narrow neck separates the face/visor from the shoulder armor.
  const helmet = armor || rider || pursuit;
  g.fillStyle(helmet ? DARK : skin); g.fillRect(-0.7, -6.2, 1.7, 1.5);
  g.fillStyle(pursuit ? plate : helmet ? DARK : skin); g.fillRect(-1.6, -9.3, 3.5, 3.5);
  g.fillStyle(white || pursuit ? 0xfff4e0 : DARK); g.fillRect(-1.9, -10.4, 4.1, 1.7);
  if (helmet) {
    g.fillStyle(EDGE); g.fillRect(-1.2, -10.1, 2.8, 0.55);
    g.fillStyle(0x69b6d0); g.fillRect(-0.3, -8.6, 2.5, 0.8);
    g.fillStyle(0x6b8193); g.fillRect(0.3, -6.8, 1.5, 0.45);
  } else {
    g.fillRect(1.2, -9, 1.8, 0.7);
    g.fillStyle(DARK); g.fillRect(1, -8.1, 0.65, 0.55);
    g.fillStyle(GOLD); g.fillRect(0, -10, 0.8, 0.75);
  }
  const reach = striking ? 8 : warning || firing ? 6.5 : 4.5;
  const hx = lying ? 2 : loose ? 5 : 1.8 + ax * reach, hy = lying ? 3 : loose ? 1 : -3.1 + ay * reach;
  const ex = lying ? 2.3 : loose ? 3.7 : 2.3 + ax * (reach * 0.45) - ay * 1.2;
  const ey = lying ? 0 : loose ? -1.3 : -2 + ay * (reach * 0.45) + ax * 0.6;
  if (armor && !loose) limb(g, -2.5, -3.6, -3, 0.3, hx - ax * 2.5, hy - ay * 2.5, 1.6, CLOTH);
  else if (pursuit && !loose && (warning || firing)) limb(g, -1.7, -3.5, 0.2 + ax, -1 + ay, hx - ax * 0.9, hy - ay * 0.9 + 0.4, 1.25, CLOTH);
  else limb(g, -1.7, -3.5, -3.3, 0, -2.8, 2.2, 1.25, CLOTH);
  limb(g, 2, -3.4, ex, ey, hx, hy, armor ? 1.8 : 1.4, suit);
  g.fillStyle(armor ? plate : pursuit ? DARK : skin); g.fillCircle(hx, hy, armor ? 1 : 0.75);
  if (armor || rider || pursuit) {
    const pistol = rider || pursuit;
    const recoil = firing ? Math.max(0, 1 - ((enemy.stateTime ?? 1) % (pursuit ? 0.12 : 1)) * 12) : 0;
    const barrel = pistol ? 3 : 5;
    g.lineStyle(pistol ? 1.1 : 2.2, DARK);
    g.lineBetween(hx - ax * (1 + recoil), hy - ay * (1 + recoil), hx + ax * (barrel - recoil), hy + ay * (barrel - recoil));
    g.lineStyle(0.7, EDGE); g.lineBetween(hx, hy - 0.8, hx + ax * (barrel - 1), hy - 0.8 + ay * (barrel - 1));
    if (warning || firing && (enemy.stateTime ?? 0) % (pursuit ? 0.12 : 0.24) < 0.055) {
      g.fillStyle(warning ? 0xffbc55 : 0xf6a566, warning ? 0.9 : 0.7);
      g.fillRect(hx + ax * barrel - 0.5, hy + ay * barrel - 0.5, firing ? 1.5 : 1, firing ? 1.5 : 1);
    }
  } else {
    g.lineStyle(1.1, DARK); g.lineBetween(hx, hy, hx + ax * 5.5, hy + ay * 5.5);
    g.lineStyle(0.6, 0x82c9d6); g.lineBetween(hx + ax, hy + ay, hx + ax * 5.3, hy + ay * 5.3);
    if (warning) { g.fillStyle(0xffbc55); g.fillCircle(-3.6, -4.3, 0.8); }
  }
  g.restore();
}

const pt = (x, y) => ({ x, y });

// Sky Marshal, from enemy-refs/police-sky-marshal-v2.png: a bulky armoured flying enforcer with a
// navy helmet and cyan visor slit, white chest plate and gold badge, siren shoulders, a grey twin
// thruster pack, a rotary cannon right arm and a heavy left fist. Raging: red visor and sparks.
export function drawSkyMarshal(g, enemy, groundAt, elapsed) {
  const dead = enemy.health <= 0;
  const falling = enemy.lifted === 'falling' || enemy.lifted === 'held';
  const lying = dead && !falling;
  const rage = !dead && enemy.health < enemy.maxHealth * 0.5;
  const dir = enemy.facing < 0 ? -1 : 1, scale = 0.98; // ~10% taller than the 20 px hero
  const state = enemy.state, move = enemy.bossMove ?? 0;
  const striking = state === 'strike', firing = state === 'burst';
  const warning = state === 'windup' || state === 'locked';
  const stunned = state === 'stunned' || enemy.stagger > 0;
  const aiming = warning || firing || striking;
  const drift = (enemy.x - enemy.previousX) * dir;
  const want = lying ? Math.PI / 2 : falling ? (enemy.angle ?? 0) * dir
    : striking ? Math.atan2(enemy.aim.y, enemy.aim.x * dir) + 0.75
      : stunned ? -0.4 : warning && move === 0 ? -0.22 : Math.max(-0.25, Math.min(0.4, drift * 0.25));
  const pose = enemy.elitePose ??= { lean: want, at: elapsed };
  pose.lean += (want - pose.lean) * (1 - Math.exp(-14 * Math.max(0, Math.min(0.05, elapsed - pose.at))));
  pose.at = elapsed;
  const white = enemy.flash > 0 && !dead;
  const tone = (c) => white ? 0xfff2df : dead ? 0x4a5563 : c;
  const navy = tone(0x1f3152), deep = tone(0x121d33), plate = tone(0xe2e9ee), steel = tone(0x8f9fae);
  const gun = tone(0x3a4452);
  const bob = lying || falling ? 0 : Math.sin(elapsed * 5 + (enemy.weaponPhase ?? 0) * 6) * 0.45;
  const y = lying ? groundAt(enemy.x) - 4 * scale : enemy.y + bob;
  g.save(); g.translateCanvas(enemy.x, y); g.scaleCanvas(dir * scale, scale);
  // Ram: air streaks trail straight back along the flight line, and a pressure wedge leads it.
  if (striking) {
    const bx = enemy.aim.x * dir, by = enemy.aim.y;
    for (const [o, len, a] of [[-6, 14, 0.5], [-2, 20, 0.7], [2, 17, 0.7], [6, 12, 0.5]]) {
      const flick = Math.sin(elapsed * 40 + o) * 2;
      const px = -by * o, py = bx * o;
      g.lineStyle(0.9, 0xffffff, a);
      g.lineBetween(px - bx * 9, py - by * 9, px - bx * (9 + len + flick), py - by * (9 + len + flick));
    }
    g.lineStyle(0.8, 0xffffff, 0.6);
    const nx = bx * 12, ny = by * 12 - 1;
    for (const side of [-1, 1]) g.lineBetween(nx, ny, nx - bx * 4 - by * 6 * side, ny - by * 4 + bx * 6 * side);
  }
  g.rotateCanvas(pose.lean);
  let ax = 1, ay = 0.15;
  if (aiming) {
    const bx = enemy.aim.x * dir, by = enemy.aim.y, t = pose.lean;
    ax = bx * Math.cos(t) + by * Math.sin(t); ay = by * Math.cos(t) - bx * Math.sin(t);
  }
  // Windup glow: amber before a dash, blue-white before shooting.
  if (warning && !dead) {
    g.fillStyle(move === 0 ? 0xffb347 : 0x9fe3ff, 0.18 + 0.1 * Math.sin(elapsed * 30));
    g.fillCircle(0, -1, 11);
  }
  // Thruster pack and twin flames (longer in a dash, none once shut down).
  g.fillStyle(steel); g.fillRect(-6.4, -5.6, 3.6, 7);
  g.fillStyle(deep); g.fillRect(-6.4, -1.4, 3.6, 0.9);
  const thrust = dead || falling ? 0 : striking ? 1.6 : warning ? 1.1 : 0.55 + Math.min(0.4, Math.abs(drift) * 0.2);
  for (const nx of [-6.1, -4.2]) {
    g.fillStyle(deep); g.fillRect(nx, 1.6, 1.6, 1.4);
    if (!thrust) continue;
    const flame = 3 + thrust * 4 + Math.sin(elapsed * 47 + nx) * 0.8;
    g.fillStyle(0x3fd2ee, 0.75); g.fillTriangle(nx - 0.2, 3, nx + 1.8, 3, nx + 0.8, 3 + flame);
    g.fillStyle(0xd9fbff, 0.95); g.fillTriangle(nx + 0.3, 3, nx + 1.3, 3, nx + 0.8, 3.8 + flame * 0.45);
  }
  // Heavy legs: hover dangle, dash trail.
  const sway = Math.sin(elapsed * 5) * 0.4;
  const legs = striking ? [[-1.4, 4.5, -4.5, 8.2], [1.4, 5, -1.8, 9]] : stunned
    ? [[-1.6, 5.8, -0.4, 9.5], [1.6, 5.5, 3.2, 8.4]] : [[-1.6, 6, -2.1 + sway, 9.8], [1.7, 5.8, 1.2 - sway, 9.8]];
  legs.forEach(([kx, ky, fx, fy], i) => {
    g.lineStyle(2.6, i ? navy : deep); g.lineBetween(i ? 1.4 : -1.4, 2.4, kx, ky); g.lineBetween(kx, ky, fx, fy);
    g.fillStyle(plate); g.fillRect(kx - 1, ky - 1, 2, 1.9);
    g.fillStyle(deep); g.fillRect(fx - 1.2, fy - 0.3, 3, 1.5);
  });
  // Rear arm: the heavy fist, thrown forward during a dash.
  const fist = striking ? [-3.2 + ax * 3.5, -3.8 + ay * 3.5, -3.2 + ax * 8, -3.8 + ay * 8] : warning && move === 0 ? [-4.5, -0.5, -2.4, 2.6] : [-4.6, -0.6, -3.6, 2.8];
  g.lineStyle(2.4, deep); g.lineBetween(-3.2, -3.8, fist[0], fist[1]);
  g.lineStyle(2.2, plate); g.lineBetween(fist[0], fist[1], fist[2], fist[3]);
  g.fillStyle(steel); g.fillRect(fist[2] - 1.4, fist[3] - 1.2, 2.8, 2.6);
  // Bulky torso, chest plate and badge; cracks while raging.
  g.fillStyle(navy);
  g.fillPoints([pt(-4.6, -5.4), pt(4.4, -5.4), pt(3.2, 2.8), pt(-3.2, 2.8)], true);
  g.fillStyle(plate); g.fillPoints([pt(-2.7, -4.8), pt(3, -4.8), pt(2.3, -0.4), pt(-2.1, -0.4)], true);
  g.fillStyle(deep); g.fillRect(-3.4, 0.6, 6.8, 1.2);
  g.fillStyle(white ? 0xfff2df : 0xe6b950); g.fillRect(0.6, -3.7, 1.5, 1.8);
  if (rage) {
    g.lineStyle(0.45, 0x30394a); g.lineBetween(-1.8, -4.4, -0.6, -2.6); g.lineBetween(-0.6, -2.6, -1.2, -1);
  }
  // Helmet with visor slit and a glow.
  g.fillStyle(deep); g.fillRect(-0.9, -6.4, 2, 1.2);
  g.fillStyle(navy); g.fillRect(-2.5, -11, 5.4, 5);
  g.fillStyle(deep); g.fillRect(-2.5, -11.4, 5, 1); g.fillRect(-2.7, -6.6, 5.8, 0.9);
  const eye = dead ? 0x55606c : rage ? 0xff4a4a : 0x5ff0ff;
  g.fillStyle(eye, 0.35); g.fillRect(-0.2, -9.4, 3.8, 2.2);
  g.fillStyle(eye); g.fillRect(0.2, -8.9, 3, 0.9);
  // Siren shoulder pads; missile pods open for the salvo.
  const blink = Math.floor(elapsed * (rage ? 10 : 6)) % 2;
  for (const [sx, lit] of [[-4.6, blink ? 0xff5263 : 0x6d2a35], [2.2, blink ? 0x2d4772 : 0x58b4ff]]) {
    g.fillStyle(navy); g.fillRect(sx, -6.4, 2.6, 2.6);
    g.fillStyle(dead ? steel : lit); g.fillRect(sx + 0.4, -7.1, 1.8, 0.8);
  }
  if (move === 2 && (warning || firing) && !dead) {
    g.fillStyle(steel); g.fillRect(-4.4, -9.4, 3.2, 2.4);
    g.fillStyle(0xd94b4b); g.fillRect(-3.2, -9.9, 0.8, 0.6); g.fillRect(-2, -9.9, 0.8, 0.6);
  }
  // Front arm: rotary cannon along the aim, barrels spinning while it fires.
  const sx = 2.6, sy = -3.6, ex = sx + ax * 2.2 - ay * 0.6, ey = sy + ay * 2.2 + ax * 0.8;
  g.lineStyle(2.5, navy); g.lineBetween(sx, sy, ex, ey);
  g.lineStyle(3.2, gun); g.lineBetween(ex, ey, ex + ax * 3, ey + ay * 3);
  const recoil = firing ? 0.5 * Math.max(0, 1 - ((enemy.stateTime ?? 0) % 0.08) * 20) : 0;
  const mx = ex + ax * (9 - recoil), my = ey + ay * (9 - recoil);
  const spin = firing || warning && move !== 0 ? Math.sin(elapsed * 60) * 0.5 : 0;
  g.lineStyle(0.75, deep);
  for (const off of [-0.8, 0, 0.8]) {
    const o = off + spin * (off ? 0.5 : 0);
    g.lineBetween(ex + ax * 3 - ay * o, ey + ay * 3 + ax * o, mx - ay * o, my + ax * o);
  }
  g.fillStyle(steel); g.fillRect(ex + ax * 2 - 1, ey + ay * 2 - 1, 2, 2);
  if (firing && (enemy.stateTime ?? 0) % 0.08 < 0.04) {
    g.fillStyle(0xffd16a, 0.9); g.fillCircle(mx + ax, my + ay, 1.5);
    g.fillStyle(0xfff5c9); g.fillCircle(mx + ax, my + ay, 0.7);
  }
  // Rage and stagger sparks.
  if ((rage || stunned) && !dead) {
    g.fillStyle(stunned ? 0xffe066 : 0xffa04a);
    for (let i = 0; i < 3; i++) {
      const t = elapsed * 9 + i * 2.1;
      if (Math.sin(t * 3) > 0.2) g.fillRect(Math.cos(t) * 5 - 0.4, -6 + Math.sin(t * 1.3) * 5, 0.8, 0.8);
    }
  }
  g.restore();
}

// Bulwark, from enemy-refs/police-bulwark-boss.png: a hunched police riot juggernaut twice the hero's
// height. Navy armour, white chest plate and gold badge, amber visor, huge shoulder pads, back
// missile pods and a light bar, and a steel ram prow on the front forearm.
// A jointed rig in local units (x forward, y down, ground at y 9, scale 2): the torso leans about the
// hip, legs and arms bend at the knee and elbow (two-bone IK) to reach their feet and fists. Each state
// sets a key pose; the rig eases toward it (POSE_RATE) and walk, stride, recoil and shake play on top.
// Pose: [hip y, lean, head, rear foot x, y, front foot x, y, rear fist x, y, front fist x, y, pod lift, shake].
// Fists are in the torso's frame, feet in the body's.
const REST = [2, 0.1, 0, -2.4, 7.8, 2.4, 7.8, -6, -0.8, 6.6, -0.8, 0, 0];
const CHARGE_WIND = [3.8, 0.55, -0.4, -5.6, 7.8, 3, 7.8, -7.2, -3, 8.6, -7, 0, 0];
const CHARGE = [3.2, 0.5, -0.45, -1.6, 7.8, 1.6, 7.8, -6, -2.4, 9, -6.4, 0, 0];
const LEAP_CROUCH = [4.6, 0.38, -0.35, -3.4, 7.8, 3.4, 7.8, -8.4, -1, -3.6, 0.6, 0, 0];
const LEAP_RISE = [1, -0.15, -0.45, -3.2, 8.6, 1, 7.4, -2.6, -17, 2.6, -17.5, 0, 0];
const LEAP_TOP = [1.5, 0.05, 0, -2.6, 6, 2.6, 5.4, -4.4, -16, -0.4, -17, 0, 0];
const LEAP_FALL = [1.5, 0.45, 0.35, -2.6, 8.2, 2.6, 8.2, 7.6, -3.6, 9.6, -2.4, 0, 0];
const SLAM = [4.4, 0.6, 0.25, -3.8, 7.8, 3.8, 7.8, 6, -0.4, 8, 0.8, 0, 0];
const MISSILE = [2.8, -0.08, -0.25, -4, 7.8, 3, 7.8, -6.6, -1.4, 9, -7, 1.8, 0];
const LASER_WIND = [3, 0.05, 0, -3.8, 7.8, 3.4, 7.8, 1.4, -3.4, 6.8, -3.2, 0, 0];
const LASER = [3, -0.08, 0, -4.2, 7.8, 3.4, 7.8, -7.4, -0.6, 8.4, -0.4, 0, 0];
const STUN = [3.2, -0.15, 0.3, -3.2, 7.8, 2.8, 7.8, -4.6, 1.4, 5, 2, 0, 0];
const RECOVER = [2.9, 0.3, 0.25, -2.8, 7.8, 2.8, 7.8, -3.4, 0.6, 5.6, 1.2, 0, 0];
const FLAIL = [2, 0, 0.3, -3, 7, 3, 6.4, -6.4, -12, 7.4, -12.4, 0, 0];
const DEAD = [2, 0, 0.35, -2.2, 7.8, 2.4, 7.8, -2, 1.6, 9.4, -1.2, 0, 0];
const POSE_RATE = 22;
const TARGET = new Float32Array(13), OUT = new Float32Array(13);
const ARM = 3.8, THIGH = 3.4;
const SHOULDER_R = [-4.2, -7.8], SHOULDER_F = [4.6, -7.6], HIP_R = [-2.2, -0.2], HIP_F = [2, -0.2];
const NECK = [2.2, -10.8], VISOR = [2.6, -0.8];
const JOINT = { x: 0, y: 0 };
const smooth = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
const TORSO = [pt(-6.6, -6.5), pt(-5.8, -11.2), pt(4.4, -11.6), pt(6.4, -7.2), pt(5.4, 0.6), pt(-5.2, 0.6)];
const TORSO_SHADE = [pt(-6.6, -6.5), pt(-5.8, -11.2), pt(-3.2, -11.3), pt(-3.8, 0.6), pt(-5.2, 0.6)];
const CHEST = [pt(-2.6, -10.8), pt(4, -10.8), pt(5, -6.8), pt(3.6, -3.6), pt(-2, -3.6)];
const BADGE = [pt(1, -9.1), pt(2.4, -9.1), pt(2.4, -8), pt(1.7, -7.3), pt(1, -8)];
const RAM_SHAPE = [pt(1.2, -6.4), pt(3.4, -5), pt(3.4, 4.2), pt(1.2, 5.6)];
const BRACER = [pt(-3.6, -2.4), pt(-0.4, -2.2), pt(0.2, 0.4), pt(-3.4, 0.6)];
const VISOR_SHAPE = [pt(0.6, -1.7), pt(4, -1.7), pt(3.8, 0), pt(1.3, -0.1)];

function copyPose(src) { for (let i = 0; i < 13; i++) TARGET[i] = src[i]; }
function blendPose(a, b, k) { for (let i = 0; i < 13; i++) TARGET[i] = a[i] + (b[i] - a[i]) * k; }
// Two-bone IK: the middle joint (knee, elbow) between a and b, bent toward +x (bend 1) or -x (-1).
function joint(ax, ay, bx, by, l1, l2, bend) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const off = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const a = Math.atan2(dy, dx) - bend * off;
  JOINT.x = ax + Math.cos(a) * l1;
  JOINT.y = ay + Math.sin(a) * l1;
}
// Local aim angle in the torso's frame (the rig is mirrored by facing).
const localAngle = (x, y, dir, lean) => Math.atan2(y, x * dir) - lean;

// Key pose for the current state into TARGET.
function bulwarkKey(enemy, dir, lean) {
  const t = enemy.stateTime ?? 0, move = enemy.bossMove ?? 0, state = enemy.state;
  if (enemy.health <= 0 && !enemy.lifted) return copyPose(DEAD);
  if (enemy.lifted === 'falling' || enemy.lifted === 'held') return copyPose(FLAIL);
  if (state === 'stunned' || enemy.stagger > 0) return copyPose(STUN);
  if (state === 'windup' || state === 'locked') {
    if (move === 0) blendPose(REST, CHARGE_WIND, smooth(t / 0.4));
    else if (move === 1) blendPose(REST, LEAP_CROUCH, smooth(t / 0.35));
    else if (move === 2) blendPose(REST, MISSILE, smooth(t / 0.3));
    else blendPose(REST, LASER_WIND, smooth(t / 0.45));
    if (move >= 2 && enemy.aim) {
      const a = localAngle(enemy.aim.x, enemy.aim.y, dir, lean);
      if (move === 2) { TARGET[9] = SHOULDER_F[0] + Math.cos(a) * 7; TARGET[10] = SHOULDER_F[1] + Math.sin(a) * 7; }
      else TARGET[2] = Math.max(-1, Math.min(0.7, a)) * smooth(t / 0.45);
    }
    return;
  }
  if (state === 'strike') return copyPose(CHARGE);
  if (state === 'leap') {
    const u = t / 0.85;
    if (u < 0.12) blendPose(LEAP_CROUCH, LEAP_RISE, smooth(u / 0.12));
    else if (u < 0.5) blendPose(LEAP_RISE, LEAP_TOP, smooth((u - 0.12) / 0.38));
    else blendPose(LEAP_TOP, LEAP_FALL, smooth((u - 0.5) / 0.35));
    return;
  }
  if (state === 'burst' && move === 2) {
    copyPose(MISSILE);
    if (enemy.aim) {
      const a = localAngle(enemy.aim.x, enemy.aim.y, dir, lean);
      TARGET[9] = SHOULDER_F[0] + Math.cos(a) * 7; TARGET[10] = SHOULDER_F[1] + Math.sin(a) * 7;
    }
    return;
  }
  if (state === 'burst') {
    copyPose(LASER);
    if (enemy.beam) TARGET[2] = Math.max(-1.1, Math.min(0.8, localAngle(enemy.beam.dx, enemy.beam.dy, dir, lean)));
    return;
  }
  if (state === 'recover') {
    if (enemy.slamAge !== undefined && enemy.slamAge < 0.6) blendPose(SLAM, RECOVER, smooth(enemy.slamAge / 0.6));
    else copyPose(RECOVER);
    const back = smooth((t - 0.35) / 0.45);
    for (let i = 0; i < 13; i++) TARGET[i] += (REST[i] - TARGET[i]) * back;
    return;
  }
  copyPose(REST);
}

// Plays on top of the eased pose: stomping walk, charge stride, missile recoil, breathing, shake.
function bulwarkMotion(enemy, elapsed, walk) {
  const t = enemy.stateTime ?? 0, state = enemy.state;
  const stride = (p, len, lift, swing) => {
    const s = Math.sin(p), c = Math.cos(p);
    OUT[3] -= s * len; OUT[4] -= Math.max(0, -c) * lift;
    OUT[5] += s * len; OUT[6] -= Math.max(0, c) * lift;
    OUT[0] += 0.7 * (1 - Math.abs(c)) - 0.35;
    OUT[7] += s * swing; OUT[9] -= s * swing;
    OUT[1] += s * 0.04;
  };
  if (enemy.health <= 0 && !enemy.lifted) return;
  if (enemy.lifted) {
    OUT[7] += Math.sin(elapsed * 14) * 2; OUT[9] += Math.cos(elapsed * 13) * 2;
    OUT[3] += Math.sin(elapsed * 11) * 1.4; OUT[5] -= Math.sin(elapsed * 11) * 1.4;
  } else if (state === 'stunned' || enemy.stagger > 0) {
    OUT[1] += Math.sin(elapsed * 5) * 0.12; OUT[2] += Math.sin(elapsed * 4) * 0.3;
    OUT[7] += Math.sin(elapsed * 5) * 0.8; OUT[9] += Math.sin(elapsed * 5 + 1) * 0.8;
  } else if (state === 'strike') stride(elapsed * 18, 3.2, 2, 2.2);
  else if (state === 'windup' && (enemy.bossMove ?? 0) === 0) OUT[3] += Math.sin(elapsed * 14) * 0.9; // pawing the street
  else if (state === 'burst' && (enemy.bossMove ?? 0) === 2) {
    const kick = Math.max(0, 1 - (t % 0.22) / 0.1);
    OUT[1] -= 0.14 * kick; OUT[0] += 0.5 * kick; OUT[11] += 0.6 * kick;
  } else if (walk) stride(elapsed * 7, 2.4, 1.5, 1.6);
  else {
    const heave = state === 'recover' ? 0.45 : 0.25;
    OUT[0] += Math.sin(elapsed * (state === 'recover' ? 6 : 3)) * heave;
    OUT[8] += Math.sin(elapsed * 3 + 0.6) * 0.3; OUT[10] += Math.sin(elapsed * 3 + 1.1) * 0.3;
  }
  if (state === 'windup' && (enemy.bossMove ?? 0) === 3) OUT[12] = 0.1 * smooth(t / 0.6);
  if (state === 'burst' && (enemy.bossMove ?? 0) === 3) OUT[12] = 0.16;
}

function darken(c) {
  const mix = (v) => Math.round(v * 0.5 + 0x30 * 0.5);
  return mix(c >> 16 & 255) << 16 | mix(c >> 8 & 255) << 8 | mix(c & 255);
}

export function drawBulwark(g, enemy, groundAt, elapsed) {
  const dead = enemy.health <= 0;
  const falling = enemy.lifted === 'falling' || enemy.lifted === 'held';
  const lying = dead && !falling;
  const rage = !dead && enemy.health < enemy.maxHealth * 0.5;
  const dir = enemy.facing < 0 ? -1 : 1, scale = 2; // 20 local units tall: 2x the 20 px hero
  const state = enemy.state, move = enemy.bossMove ?? 0;
  const windup = state === 'windup' || state === 'locked';
  const charging = state === 'strike', firing = state === 'burst';
  const stunned = state === 'stunned' || enemy.stagger > 0;
  const walk = Math.abs(enemy.x - (enemy.previousX ?? enemy.x)) > 0.05 && state !== 'leap';
  const ground = groundAt(enemy.x);
  // Ease the rig toward this state's key pose, then add motion on top.
  const pose = enemy.artPose ??= Float32Array.from(REST);
  const dt = Math.max(0, Math.min(0.1, elapsed - (enemy.artTime ?? elapsed)));
  enemy.artTime = elapsed;
  bulwarkKey(enemy, dir, pose[1]);
  const ease = 1 - Math.exp(-POSE_RATE * dt);
  for (let i = 0; i < 13; i++) OUT[i] = pose[i] += (TARGET[i] - pose[i]) * ease;
  bulwarkMotion(enemy, elapsed, walk);
  const [hipY, lean, head, rfx, rfy, ffx, ffy, rhx, rhy, fhx, fhy, pod, shake] = OUT;

  // World-space effects first: slam shockwave, charge dust and speed lines.
  if (enemy.slamAge !== undefined && enemy.slamAge < 0.45) {
    const t = enemy.slamAge / 0.45;
    g.lineStyle(3 * (1 - t) + 0.5, 0xf2e6cf, 1 - t);
    g.strokeEllipse(enemy.x, ground, 40 + t * 190, 8 + t * 26);
    g.fillStyle(0x6f6252, 1 - t);
    for (let i = 0; i < 8; i++) g.fillRect(enemy.x + (i - 3.5) * 16 * (0.5 + t), ground - 4 - Math.sin(t * Math.PI) * (12 + i % 3 * 8), 2.5, 2.5);
  }
  if (charging || windup && move === 0) {
    const back = -(enemy.chargeDir ?? dir);
    g.fillStyle(0xcdb998, 0.55);
    for (let i = 0; i < 4; i++) {
      const puff = (elapsed * (charging ? 4 : 2.5) + i / 4) % 1;
      g.fillCircle(enemy.x + back * (12 + puff * 34), ground - 3 - puff * 8, 3 + puff * 6);
    }
    if (charging) {
      g.lineStyle(1.4, 0xffffff, 0.6);
      for (const [y, len] of [[-30, 26], [-20, 36], [-10, 30]]) {
        const flick = Math.sin(elapsed * 40 + y) * 4;
        g.lineBetween(enemy.x + back * 22, enemy.y + y + 14, enemy.x + back * (22 + len + flick), enemy.y + y + 14);
      }
    }
  }

  const white = enemy.flash > 0 && !dead;
  const tone = (c) => white ? 0xfff2df : dead ? darken(c) : c;
  const navy = tone(rage ? 0x323740 : 0x1d2c4c), light = tone(rage ? 0x4a505b : 0x30487a);
  const deep = tone(rage ? 0x15181e : 0x111a2e), plate = tone(rage ? 0xb4bbc2 : 0xe6ecf0);
  const steel = tone(rage ? 0x6f7782 : 0x8f9fae), shine = tone(0xc4ced6);
  const gold = tone(rage ? 0xc8402f : 0xe2b54e), visor = dead ? 0x4c5562 : rage ? 0xff3b3b : 0xffb02e;
  const jitterX = shake ? Math.sin(elapsed * 53) * shake : 0, jitterY = shake ? Math.cos(elapsed * 47) * shake : 0;
  const baseX = enemy.x + jitterX * scale, baseY = lying ? ground - 7.4 * scale : enemy.y + jitterY * scale;
  const cl = Math.cos(lean), sl = Math.sin(lean);
  // Torso-frame point to body frame.
  const bx = (x, y) => x * cl - y * sl, by = (x, y) => x * sl + y * cl + hipY;

  g.save(); g.translateCanvas(baseX, baseY); g.scaleCanvas(dir * scale, scale);
  if (lying) g.rotateCanvas(Math.PI / 2);
  else if (falling) g.rotateCanvas((enemy.angle ?? 0) * dir);

  // Torso frame, behind: back pack, missile pods and light bar, rear arm and shoulder pad.
  g.save(); g.translateCanvas(0, hipY); g.rotateCanvas(lean);
  g.fillStyle(deep); g.fillRect(-7.8, -11.4, 4.2, 9.2);
  const podsOpen = move === 2 && (windup || firing) && !dead;
  for (const px of [-6.6, -3.2]) {
    const py = -14.6 - pod;
    g.fillStyle(steel); g.fillRect(px, py, 3.2, 3.8);
    g.fillStyle(shine); g.fillRect(px, py, 3.2, 0.6);
    g.fillStyle(deep); g.fillRect(px + 0.5, py + 1, 0.9, 0.9); g.fillRect(px + 1.8, py + 1, 0.9, 0.9);
    g.fillRect(px + 0.5, py + 2.3, 0.9, 0.9); g.fillRect(px + 1.8, py + 2.3, 0.9, 0.9);
    if (podsOpen) {
      g.fillStyle(0xd94b4b); g.fillRect(px + 0.5, py - 0.9, 0.9, 1); g.fillRect(px + 1.8, py - 0.9, 0.9, 1);
      if (firing && (enemy.stateTime ?? 0) % 0.22 < 0.07) {
        g.fillStyle(0xffd27a, 0.9); g.fillCircle(px + 1.6, py - 1.4, 1.8);
        g.fillStyle(0xffffff); g.fillCircle(px + 1.6, py - 1.2, 0.8);
      }
    }
  }
  const blink = Math.floor(elapsed * (rage ? 10 : 5)) % 2;
  g.fillStyle(dead ? steel : blink ? 0xff5263 : 0x6d2a35); g.fillRect(-2.6, -12.3, 1.8, 0.9);
  g.fillStyle(dead ? steel : blink ? 0x2d4772 : 0x58b4ff); g.fillRect(-0.8, -12.3, 1.8, 0.9);
  // Rear arm: upper arm, bracer, gauntlet fist.
  joint(SHOULDER_R[0], SHOULDER_R[1], rhx, rhy, ARM, ARM, -1);
  g.lineStyle(3.2, deep); g.lineBetween(SHOULDER_R[0], SHOULDER_R[1], JOINT.x, JOINT.y);
  g.lineStyle(3.6, deep); g.lineBetween(JOINT.x, JOINT.y, rhx, rhy);
  g.fillStyle(steel); g.fillCircle(rhx, rhy, 1.9);
  g.fillStyle(deep); g.fillCircle(SHOULDER_R[0], SHOULDER_R[1] - 0.4, 3.6);
  g.restore();

  // Legs (body frame): thigh and shin bend at a knee pad to planted boots.
  const leg = (hx, hy, fx, fy, color) => {
    const x0 = bx(hx, hy), y0 = by(hx, hy);
    joint(x0, y0, fx, fy, THIGH, THIGH, 1);
    g.lineStyle(4.2, color); g.lineBetween(x0, y0, JOINT.x, JOINT.y);
    g.lineStyle(3.8, color); g.lineBetween(JOINT.x, JOINT.y, fx, fy);
    g.fillStyle(plate); g.fillRect(JOINT.x - 0.4, JOINT.y - 1, 1.8, 2);
    g.fillStyle(deep); g.fillRect(fx - 2, fy - 0.9, 4.6, 2.1);
    g.fillStyle(steel); g.fillRect(fx + 1.4, fy - 0.6, 1.2, 1.2);
  };
  leg(HIP_R[0], HIP_R[1], rfx, rfy, deep);
  leg(HIP_F[0], HIP_F[1], ffx, ffy, navy);

  // Torso frame, in front: shell, chest plate, badge, belt, helmet, front shoulder pad and arm.
  g.save(); g.translateCanvas(0, hipY); g.rotateCanvas(lean);
  g.fillStyle(navy); g.fillPoints(TORSO, true);
  g.fillStyle(deep); g.fillPoints(TORSO_SHADE, true);
  g.fillStyle(plate); g.fillPoints(CHEST, true);
  g.fillStyle(0xffffff, white ? 0 : 0.45); g.fillRect(-2.2, -10.6, 5.6, 0.6);
  g.fillStyle(gold); g.fillPoints(BADGE, true);
  g.fillStyle(deep); g.fillRect(-1.6, -2.6, 5.4, 0.5); g.fillRect(-1.8, -1.6, 5.8, 0.5);
  g.fillRect(-5.2, -0.6, 10.6, 1.8);
  g.fillStyle(steel); g.fillRect(0.2, -0.4, 1.6, 1.4);
  if (rage) {
    g.lineStyle(0.5, 0x30394a); g.lineBetween(-1.6, -10.2, -0.4, -7.6); g.lineBetween(-0.4, -7.6, -1.2, -5);
    g.lineStyle(0.45, 0xff5a3a, 0.6 + 0.4 * Math.sin(elapsed * 9)); g.lineBetween(-3.4, -3.2, 4.6, -3.2);
  }
  g.fillStyle(navy); g.fillCircle(SHOULDER_F[0] - 0.2, SHOULDER_F[1] - 0.4, 3.9);
  g.fillStyle(light); g.fillCircle(SHOULDER_F[0] - 0.8, SHOULDER_F[1] - 1.8, 2);
  g.fillStyle(navy); g.fillCircle(SHOULDER_F[0] + 0.2, SHOULDER_F[1] - 0.8, 2.4);
  g.fillStyle(gold); g.fillRect(SHOULDER_F[0] + 0.4, SHOULDER_F[1] - 1.2, 1.4, 1.4);
  // Helmet low between the shoulders; the visor charges and fires the laser.
  g.save(); g.translateCanvas(NECK[0], NECK[1]); g.rotateCanvas(head);
  g.fillStyle(navy); g.fillCircle(0.6, -1.4, 3.3);
  g.fillStyle(light); g.fillCircle(-0.2, -2.8, 1.5);
  g.fillStyle(deep); g.fillRect(-2.2, -1.9, 5.8, 0.9); g.fillRect(0.6, 0.2, 3, 1.2);
  g.fillStyle(visor); g.fillPoints(VISOR_SHAPE, true);
  if (!dead) { g.fillStyle(0xffffff, 0.55); g.fillRect(2.2, -1.5, 1.2, 0.4); }
  if (windup && move === 3) {
    const charge = Math.min(1, (enemy.stateTime ?? 0) / 0.7);
    g.fillStyle(0xffb347, 0.25 + 0.35 * charge); g.fillCircle(VISOR[0], VISOR[1], 1 + charge * 3 + Math.sin(elapsed * 40) * 0.3);
    g.fillStyle(0xfff0c0, 0.4 + 0.5 * charge); g.fillCircle(VISOR[0], VISOR[1], 0.6 + charge * 1.2);
  }
  g.restore();
  // Front arm: the ram prow rides the forearm; charging it swings out as a shield.
  joint(SHOULDER_F[0], SHOULDER_F[1], fhx, fhy, ARM, ARM, -1);
  const ex = JOINT.x, ey = JOINT.y;
  g.lineStyle(3.6, navy); g.lineBetween(SHOULDER_F[0], SHOULDER_F[1], ex, ey);
  g.lineStyle(4, navy); g.lineBetween(ex, ey, fhx, fhy);
  const ram = charging || windup && move === 0;
  const fore = Math.atan2(fhy - ey, fhx - ex);
  g.save(); g.translateCanvas(fhx, fhy);
  if (ram) {
    g.rotateCanvas(-lean * 0.7);
    g.fillStyle(steel); g.fillPoints(RAM_SHAPE, true);
    g.fillStyle(shine); g.fillRect(1.5, -5.4, 0.6, 10);
  } else {
    g.rotateCanvas(fore);
    g.fillStyle(steel); g.fillPoints(BRACER, true);
    g.fillStyle(shine); g.fillRect(-3.2, -2.1, 2.6, 0.5);
  }
  g.restore();
  g.fillStyle(steel); g.fillCircle(fhx, fhy, 2.1);
  g.fillStyle(shine); g.fillRect(fhx - 0.6, fhy - 1.6, 1.6, 0.6);

  // Stunned stars, rage sparks, pod steam.
  if (stunned && !dead) {
    g.fillStyle(0xffe066);
    for (let i = 0; i < 3; i++) {
      const a = elapsed * 5 + i * 2.1;
      g.fillRect(NECK[0] + Math.cos(a) * 4.5 - 0.5, -16 + Math.sin(a) * 1.2, 1, 1);
    }
  } else if (rage) {
    g.fillStyle(0xffa04a);
    for (let i = 0; i < 3; i++) {
      const t = elapsed * 9 + i * 2.7;
      if (Math.sin(t * 3) > 0.3) g.fillRect(Math.cos(t) * 6 - 0.4, -6 + Math.sin(t * 1.3) * 5, 0.8, 0.8);
    }
  }
  if (dead || rage || state === 'recover' || Math.sin(elapsed * 1.7) > 0.6) {
    g.fillStyle(dead || rage ? 0x5b5f66 : 0xdfe6ea, 0.6);
    for (let i = 0; i < 3; i++) {
      const t = (elapsed * 1.2 + i / 3) % 1;
      g.fillCircle(-4.8 + Math.sin(t * 6 + i) * 0.9, -15.5 - pod - t * 6, 0.8 + t * 1.6);
    }
  }
  g.restore();
  g.restore();

  // The visor beam, from the visor out along the system's beam.
  if (enemy.beam) {
    const ch = Math.cos(head), sh = Math.sin(head);
    const vx = NECK[0] + VISOR[0] * ch - VISOR[1] * sh, vy = NECK[1] + VISOR[0] * sh + VISOR[1] * ch;
    const x = baseX + dir * scale * bx(vx, vy), y = baseY + scale * by(vx, vy);
    const { dx, dy, length } = enemy.beam;
    const ex2 = enemy.beam.x + dx * length, ey2 = enemy.beam.y + dy * length;
    const flicker = 1 + Math.sin(elapsed * 60) * 0.15;
    g.lineStyle(11 * flicker, 0xff9a3c, 0.25); g.lineBetween(x, y, ex2, ey2);
    g.lineStyle(5, 0xffc35a, 0.9); g.lineBetween(x, y, ex2, ey2);
    g.lineStyle(1.8, 0xfff6dc); g.lineBetween(x, y, ex2, ey2);
    g.fillStyle(0xfff0c0, 0.9); g.fillCircle(x, y, 4.5 + Math.sin(elapsed * 50));
  }
}

// Interceptor, from enemy-refs/police-interceptor-jetpack-v2.png: a white and navy sport bike with
// round spoked wheels and a white-helmeted rider tucked low over the tank.
export function drawPoliceBike(g, car, groundAt, shift, elapsed) {
  const x = car.x + shift, dir = car.lane === 0 ? -1 : 1;
  const base = groundAt(x) + (car.lane === 0 ? 1 : 2), rider = car.rider;
  const live = rider?.health > 0 && rider.rider === car && !car.wreck && !car.fall;
  const lean = Math.min(1, Math.abs(car.speed ?? 0) / 150);
  g.save(); g.translateCanvas(x, base);
  g.rotateCanvas(Math.atan2(groundAt(x + 13) - groundAt(x - 13), 26) + (car.pitch ?? 0));
  g.scaleCanvas(car.length / 26 * dir, car.length / 26);
  const turn = (car.roll ?? 0) * dir;
  for (const at of [-9, 9]) {
    g.fillStyle(0x151c2a); g.fillCircle(at, -4.3, 4.3);
    g.fillStyle(0x9aa9b6); g.fillCircle(at, -4.3, 2.8);
    g.fillStyle(0x151c2a); g.fillCircle(at, -4.3, 2);
    g.lineStyle(0.6, 0xc9d4db);
    for (let k = 0; k < 3; k++) {
      const a = turn + k * Math.PI / 3;
      g.lineBetween(at - Math.cos(a) * 2, -4.3 - Math.sin(a) * 2, at + Math.cos(a) * 2, -4.3 + Math.sin(a) * 2);
    }
    g.fillStyle(0xc9d4db); g.fillCircle(at, -4.3, 0.7);
  }
  g.lineStyle(1.4, EDGE); g.lineBetween(-9, -4.3, -2, -7.2);
  g.lineStyle(1.3, 0xb7c3cc); g.lineBetween(9, -4.3, 6.4, -11);
  g.fillStyle(DARK); g.fillRect(-3.4, -8.6, 6.4, 4.2);
  g.fillStyle(0xbfcad2); g.fillRect(-9.5, -7, 6.5, 1.2);
  g.translateCanvas(0, -Math.max(-0.6, Math.min(1.5, car.bounce ?? 0)));
  g.fillStyle(NAVY); g.fillPoints([pt(-4, -6), pt(8.6, -6.2), pt(9.6, -9.4), pt(-3.6, -10)], true);
  g.fillStyle(PLATE);
  g.fillPoints([pt(-5, -10.6), pt(3.4, -12.6), pt(11.8, -10.2), pt(10.4, -7.2), pt(2.2, -7.6), pt(-1, -9.4)], true);
  g.fillPoints([pt(-12.2, -11.8), pt(-5, -10.8), pt(-5, -9.2), pt(-10.8, -9.4)], true);
  g.fillStyle(NAVY); g.fillPoints([pt(1.6, -9.8), pt(9.6, -9.8), pt(9, -8.4), pt(2, -8.4)], true);
  g.fillStyle(0x8fc3dd, 0.85); g.fillTriangle(5.8, -12.4, 9.6, -14.6, 10.6, -11);
  g.fillStyle(DARK); g.fillRect(-6.4, -11.8, 6.2, 1.3);
  g.fillStyle(GOLD); g.fillRect(4.8, -10.6, 1, 1);
  g.fillStyle(0xf6e4a8); g.fillRect(11.2, -10, 1.2, 1.4);
  const blink = !car.wreck && Math.floor(elapsed * 7) % 2;
  g.fillStyle(blink ? 0x63b5e5 : 0x3a4f78); g.fillRect(-12.2, -12.8, 1.6, 1.1);
  g.fillStyle(blink ? 0x7a2f3a : 0xe0525d); g.fillRect(-10.4, -12.8, 1.6, 1.1);
  if (live) {
    const white = rider.flash > 0, suit = white ? 0xffecd3 : NAVY, helmet = white ? 0xfff4e0 : 0xeef3f6;
    const shx = 1.6 + lean * 1.2, shy = -16.4 + lean * 0.6;
    limb(g, -3, -11.6, 2, -9.4, 0.4, -6.2, 1.8, suit);
    g.fillStyle(DARK); g.fillRect(-0.4, -6.4, 3, 1.1);
    g.lineStyle(4.2, suit); g.lineBetween(-3.2, -12.4, shx, shy);
    g.lineStyle(1.2, white ? 0xfff4e0 : 0x8da4b8); g.lineBetween(-2.6, -13.6, shx - 0.4, shy + 0.8);
    g.fillStyle(DARK); g.fillRect(shx - 0.2, shy - 1.4, 1.6, 1.4);
    g.fillStyle(helmet); g.fillCircle(shx + 1.4, shy - 2.6, 2.5);
    g.fillStyle(0x2b3a52); g.fillRect(shx + 1.6, shy - 3.2, 2.3, 1.2);
    const aiming = rider.state === 'aim' || rider.state === 'locked' || rider.state === 'burst';
    if (!aiming) limb(g, shx, shy + 0.4, 4.6, -13.8, 6.8, -12.6, 1.3, suit);
    else {
      const ax = rider.aim.x * dir, ay = rider.aim.y;
      limb(g, 0.6, -14.8, 4.6, -13.4, 6.8, -12.6, 1.2, suit);
      limb(g, shx, shy + 0.4, shx + ax * 3, shy + 2 + ay * 2, shx + ax * 6.5, shy + 0.4 + ay * 6.5, 1.3, suit);
      g.lineStyle(1.1, rider.state === 'locked' ? 0xdba85a : DARK);
      g.lineBetween(shx + ax * 6, shy + 0.4 + ay * 6, shx + ax * 9, shy + 0.4 + ay * 9);
      if (rider.state === 'burst' && rider.stateTime < 0.05) {
        g.fillStyle(0xf6c765); g.fillCircle(shx + ax * 9.8, shy + 0.4 + ay * 9.8, 1);
      }
    }
  }
  g.restore();
}

// Rhino, from enemy-refs/level-2-swat-rhino-boss.png: the SWAT armoured command truck, 9m long. A
// gunmetal armoured box with gun ports, a squared cab with a wide windscreen and a light bar, a steel
// ram plow, three big tyres, a roof water-cannon turret and a roof mortar rack. Drawn in world px
// from the ground (local x forward, y up negative), mirrored by facing. Armour plates fall off as it
// takes damage; raging it smokes and burns; dead it is a burnt-out wreck.
const RHINO_PLOW = [pt(43, -26), pt(49, -26), pt(55, -6), pt(55, -2), pt(44, -4)];
const RHINO_HOOD = [pt(36, -30), pt(41, -30), pt(46, -24), pt(46, -12), pt(36, -12)];
const RHINO_GLASS = [pt(24, -35), pt(34, -35), pt(39, -28), pt(24, -28)];
const RHINO_BOX = [pt(-50, -12), pt(-50, -42), pt(-47, -45), pt(4, -45), pt(6, -42), pt(6, -12)];
const RHINO_CAB = [pt(6, -12), pt(6, -38), pt(9, -41), pt(31, -41), pt(36, -30), pt(36, -12)];

export function drawRhino(g, enemy, groundAt, elapsed) {
  const dead = enemy.health <= 0;
  const rage = !dead && enemy.health < enemy.maxHealth * 0.5;
  const dir = enemy.facing < 0 ? -1 : 1;
  const state = enemy.state, move = enemy.bossMove ?? 0, t = enemy.stateTime ?? 0;
  const windup = state === 'windup', ramming = state === 'strike', firing = state === 'burst';
  const stunned = state === 'stunned' || enemy.stagger > 0;
  const ground = groundAt(enemy.x);
  const lost = dead ? 1 : 1 - enemy.health / enemy.maxHealth; // armour lost, 0 to 1
  const white = enemy.flash > 0 && !dead;
  const burnt = (c) => {
    const mix = (v) => Math.round(v * 0.35 + 0x1a * 0.65);
    return mix(c >> 16 & 255) << 16 | mix(c >> 8 & 255) << 8 | mix(c & 255);
  };
  const tone = (c) => white ? 0xfff2df : dead ? burnt(c) : c;
  const armour = tone(0x3c414b), plate = tone(0x4a505b), seam = tone(0x262a31), dark = tone(0x16181d);
  const steel = tone(0x8f9fae), shine = tone(0xc4ced6), glass = dead ? 0x15171b : white ? 0xfff2df : 0x2f4d6b;
  // Ride: idle engine rumble, a hard nose-down pitch while ramming, a rock while stunned.
  const rumble = dead ? 0 : Math.sin(elapsed * (ramming ? 40 : 22)) * (ramming ? 0.8 : 0.4);
  const pitch = dead ? 0 : ramming ? 0.03 : windup && move === 0 ? -0.025 : stunned ? Math.sin(elapsed * 9) * 0.04 : 0;
  const back = -dir;

  // World effects behind: ram dust and speed lines, exhaust.
  if (ramming || windup && move === 0) {
    g.fillStyle(0xcdb998, 0.5);
    for (let i = 0; i < 5; i++) {
      const puff = (elapsed * (ramming ? 4 : 2.5) + i / 5) % 1;
      g.fillCircle(enemy.x + back * (40 + puff * 50), ground - 3 - puff * 10, 3 + puff * 8);
    }
    if (ramming) {
      g.lineStyle(1.6, 0xffffff, 0.6);
      for (const [y, len] of [[-38, 40], [-26, 56], [-14, 46]]) {
        const flick = Math.sin(elapsed * 40 + y) * 5;
        g.lineBetween(enemy.x + back * 54, ground + y, enemy.x + back * (54 + len + flick), ground + y);
      }
    }
  }
  if (!dead) {
    const revving = windup && move === 0;
    g.fillStyle(0x5d6168, revving ? 0.7 : 0.4);
    for (let i = 0; i < (revving ? 4 : 2); i++) {
      const puff = (elapsed * (revving ? 3 : 1.2) + i / 3) % 1;
      g.fillCircle(enemy.x + back * (52 + puff * 14), ground - 9 - puff * 10, 1.5 + puff * (revving ? 5 : 3));
    }
  }

  g.save();
  g.translateCanvas(enemy.x, ground);
  g.scaleCanvas(dir, 1);
  // Wheels stay on the street; the body rides above them.
  const wheel = (x) => {
    g.fillStyle(dark); g.fillCircle(x, -8.5, 8.5);
    g.fillStyle(tone(0x2b2f36)); g.fillCircle(x, -8.5, 6);
    g.fillStyle(steel); g.fillCircle(x, -8.5, 3);
    const spin = (ramming ? elapsed * 30 : Math.abs(enemy.x - (enemy.previousX ?? enemy.x)) > 0.05 ? elapsed * 12 : 0) * dir;
    g.fillStyle(dark);
    for (let i = 0; i < 3; i++) {
      const a = spin + i * 2.094;
      g.fillRect(x + Math.cos(a) * 4.4 - 0.8, -8.5 + Math.sin(a) * 4.4 - 0.8, 1.6, 1.6);
    }
  };
  for (const x of [-37, -20, 29]) wheel(x);
  g.save();
  g.translateCanvas(0, rumble - 2);
  g.rotateCanvas(pitch);
  // Chassis skirt and wheel arches.
  g.fillStyle(seam); g.fillRect(-50, -14, 92, 5);
  g.fillStyle(dark); g.fillCircle(-37, -9, 10); g.fillCircle(-20, -9, 10); g.fillCircle(29, -9, 10);
  for (const x of [-37, -20, 29]) { g.fillStyle(seam); g.fillRect(x - 10, -14, 20, 2); }
  // Rear doors: open while the squad deploys.
  const doorOpen = !dead && firing && move === 3 ? Math.min(1, t / 0.3) * (t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.2)) : 0;
  if (doorOpen > 0) {
    g.fillStyle(dark); g.fillRect(-50, -40, 4, 27);
    g.fillStyle(armour); g.fillRect(-50 - 14 * doorOpen, -40, 14 * doorOpen, 27);
    g.fillStyle(seam); g.fillRect(-50 - 14 * doorOpen, -30, 14 * doorOpen, 1);
  }
  // Armoured box: panels, seams, bolts, gun ports.
  g.fillStyle(armour); g.fillPoints(RHINO_BOX, true);
  g.fillStyle(plate);
  const plates = [[-48, -40, 16], [-30, -40, 16], [-12, -40, 15]];
  plates.forEach(([x, y, w], i) => {
    // Plates fall off at 25%, 50% and 75% armour lost, leaving bare scratched frame.
    if (lost >= 0.25 * (i + 1)) {
      g.fillStyle(seam); g.fillRect(x, y, w, 24);
      g.fillStyle(tone(0x6b5a48)); g.fillRect(x + 2, y + 4, w - 4, 1); g.fillRect(x + 3, y + 13, w - 7, 1);
      g.fillStyle(plate);
    } else {
      g.fillRect(x, y, w, 24);
      g.fillStyle(seam); g.fillRect(x, y + 12, w, 0.8);
      g.fillStyle(shine); g.fillRect(x + 1, y + 1, 2, 2); g.fillRect(x + w - 3, y + 1, 2, 2); g.fillRect(x + 1, y + 21, 2, 2); g.fillRect(x + w - 3, y + 21, 2, 2);
      g.fillStyle(plate);
    }
  });
  g.fillStyle(dark); g.fillRect(-42, -36, 7, 3); g.fillRect(-24, -36, 7, 3); g.fillRect(-6, -36, 7, 3);
  g.fillStyle(tone(0xe6ecf0)); g.fillRect(-46, -20, 48, 2);
  g.fillStyle(seam); g.fillRect(-50, -16, 56, 1.5);
  // Cab, hood, windscreen, door, headlight, grille.
  g.fillStyle(armour); g.fillPoints(RHINO_CAB, true);
  g.fillStyle(plate); g.fillPoints(RHINO_HOOD, true);
  g.fillStyle(glass); g.fillPoints(RHINO_GLASS, true);
  if (!dead) { g.fillStyle(0xffffff, 0.25); g.fillRect(26, -34, 3, 5); }
  g.fillStyle(glass); g.fillRect(11, -35, 10, 7);
  g.fillStyle(seam); g.fillRect(9, -26, 1, 13); g.fillRect(22, -26, 1, 13); g.fillRect(14, -22, 4, 1.2);
  g.fillStyle(dark); for (let y = -22; y < -14; y += 2.5) g.fillRect(43, y, 3, 1.2);
  const lamp = dead ? 0x2a2a2a : windup && move === 0 && Math.floor(elapsed * 12) % 2 ? 0xffffff : 0xffe28a;
  g.fillStyle(lamp); g.fillRect(41, -25, 4, 3);
  // Ram plow: lowered and glinting in the ram windup and charge.
  const plowDrop = ramming || windup && move === 0 ? 2 : 0;
  g.save(); g.translateCanvas(0, plowDrop);
  g.fillStyle(steel); g.fillPoints(RHINO_PLOW, true);
  g.fillStyle(shine); g.fillRect(46, -24, 1, 18);
  g.fillStyle(seam); for (let y = -22; y < -4; y += 5) g.fillRect(45, y, 9, 0.8);
  g.restore();
  // Light bar on the cab roof.
  const blink = Math.floor(elapsed * (rage ? 10 : 5)) % 2;
  g.fillStyle(dark); g.fillRect(11, -43, 20, 2);
  g.fillStyle(dead ? seam : blink ? 0xff3b47 : 0x6d2a35); g.fillRect(12, -45, 8, 2.4);
  g.fillStyle(dead ? seam : blink ? 0x2d4772 : 0x4aa8ff); g.fillRect(21, -45, 8, 2.4);
  // Mortar rack at the back of the roof: raised for the volley, kicking with each shell.
  const mortarUp = !dead && move === 2 && (windup || firing);
  const kick = mortarUp && firing ? Math.max(0, 1 - (t % 0.35) / 0.12) : 0;
  g.save(); g.translateCanvas(-40, -45);
  g.rotateCanvas(mortarUp ? -0.55 : -0.15);
  for (let i = 0; i < 3; i++) {
    g.fillStyle(seam); g.fillRect(i * 4.2, -9 + kick * 2.5, 3.4, 9);
    g.fillStyle(steel); g.fillRect(i * 4.2, -9 + kick * 2.5, 3.4, 1.4);
  }
  if (kick > 0.6) { g.fillStyle(0xffd27a, 0.9); g.fillCircle(4.2 * (enemy.shots % 3) + 1.7, -11, 3); }
  g.restore();
  // Water-cannon turret: swivels after the hero in the windup, then follows the jet.
  const aim = enemy.jet ? Math.atan2(enemy.jet.dy, enemy.jet.dx * dir)
    : !dead && move === 1 && windup && enemy.aim ? Math.atan2(enemy.aim.y, enemy.aim.x * dir) : -0.08;
  g.fillStyle(seam); g.fillRect(-26, -48, 18, 3);
  g.fillStyle(armour); g.fillRect(-24, -53, 14, 6);
  g.save(); g.translateCanvas(-14, -50); g.rotateCanvas(Math.max(-1.3, Math.min(0.5, aim)));
  g.fillStyle(steel); g.fillRect(0, -1.6, 16, 3.2);
  g.fillStyle(dark); g.fillRect(14, -2.2, 3, 4.4);
  if (windup && move === 1) { g.fillStyle(0x9fd8ff, 0.4 + 0.4 * Math.min(1, t / 0.7)); g.fillCircle(17, 0, 2 + t * 3); }
  g.restore();
  // Rage: fire and sparks off the bare frame. Stunned: hood steam and stars.
  if (rage || dead) {
    for (let i = 0; i < 3; i++) {
      const f = (elapsed * 3 + i * 0.37) % 1;
      g.fillStyle(dead ? 0x3a3a3a : 0xff8a2a, dead ? 0.5 : 0.85 - f * 0.6);
      g.fillCircle(-36 + i * 6 + Math.sin(elapsed * 9 + i) * 1.5, -46 - f * 12, (dead ? 3 : 2.4) + f * 2);
    }
  }
  if (rage && Math.sin(elapsed * 17) > 0.6) {
    g.fillStyle(0xffe066);
    for (let i = 0; i < 4; i++) g.fillRect(-20 + Math.cos(elapsed * 30 + i) * 14, -28 + Math.sin(elapsed * 23 + i) * 8, 1.2, 1.2);
  }
  if (stunned && !dead) {
    g.fillStyle(0xdfe6ea, 0.6);
    for (let i = 0; i < 3; i++) { const f = (elapsed * 1.5 + i / 3) % 1; g.fillCircle(42 + Math.sin(f * 6) * 2, -30 - f * 14, 1.5 + f * 3); }
    g.fillStyle(0xffe066);
    for (let i = 0; i < 3; i++) { const a = elapsed * 5 + i * 2.1; g.fillRect(20 + Math.cos(a) * 9, -52 + Math.sin(a) * 2, 1.6, 1.6); }
  }
  g.restore();
  g.restore();

  // Smoke over a raging or wrecked truck, in world space.
  if (rage || dead) {
    g.fillStyle(0x4a4d53, 0.45);
    for (let i = 0; i < 4; i++) {
      const f = (elapsed * 0.8 + i / 4) % 1;
      g.fillCircle(enemy.x + back * (30 - f * 10) + Math.sin(f * 5 + i) * 4, ground - 58 - f * 40, 4 + f * 9);
    }
  }
  // The water jet: a white-blue stream from the turret, spraying where it lands.
  if (enemy.jet) {
    const { x, y, dx, dy, length } = enemy.jet;
    const ex = x + dx * length, ey = y + dy * length;
    g.lineStyle(10, 0x9fd8ff, 0.25); g.lineBetween(x, y, ex, ey);
    g.lineStyle(5, 0xd8f0ff, 0.8); g.lineBetween(x, y, ex, ey);
    g.lineStyle(1.6, 0xffffff); g.lineBetween(x, y, ex, ey);
    g.fillStyle(0xffffff, 0.7);
    for (let i = 0; i < 6; i++) {
      const f = (elapsed * 6 + i / 6) % 1;
      g.fillCircle(x + dx * length * f + Math.sin(elapsed * 40 + i) * 2, y + dy * length * f + Math.cos(elapsed * 37 + i) * 2, 1 + f * 1.5);
    }
  }
}

// Goliath, from enemy-refs/level-3-army-goliath-boss.png: the army walker mech. An olive armoured
// hull with a red visor slit, hazard band and white stars, a heavy cannon on top, a six-tube missile
// pod at the back, a chin gun, exhaust stacks, on two reverse-jointed legs with flat feet. Drawn in
// world px from the ground (local x forward, y up negative), mirrored by facing. The hull's centre
// is EnemySystem's hullY (62) up; the cannon pivots at (6, -84) and is 46 long (walkerMuzzle).
const GOLIATH_HULL = [pt(-30, -86), pt(-26, -90), pt(20, -90), pt(30, -80), pt(34, -64), pt(28, -48), pt(-28, -48), pt(-32, -56)];
const GOLIATH_FACE = [pt(20, -80), pt(30, -80), pt(34, -64), pt(28, -50), pt(18, -50)];

export function drawGoliath(g, enemy, groundAt, elapsed) {
  const dead = enemy.health <= 0;
  const rage = !dead && enemy.health < enemy.maxHealth * 0.5;
  const dir = enemy.facing < 0 ? -1 : 1;
  const state = enemy.state, move = enemy.bossMove ?? 0, t = enemy.stateTime ?? 0;
  const windup = state === 'windup', charging = state === 'strike', firing = state === 'burst';
  const stunned = !dead && (state === 'stunned' || enemy.stagger > 0);
  const ground = groundAt(enemy.x);
  const lost = dead ? 1 : 1 - enemy.health / enemy.maxHealth;
  const white = enemy.flash > 0 && !dead;
  const mixTo = (c, to, k) => {
    const m = (sh) => Math.round((c >> sh & 255) * (1 - k) + (to >> sh & 255) * k);
    return m(16) << 16 | m(8) << 8 | m(0);
  };
  const rageGlow = rage ? 0.4 + 0.15 * Math.sin(elapsed * 10) : 0;
  const tone = (c) => white ? 0xfff2df : dead ? mixTo(c, 0x1a1816, 0.7) : rage ? mixTo(c, 0xd8301c, rageGlow) : c;
  const olive = tone(0x5d6538), oliveDark = tone(0x3f4526), oliveLight = tone(0x7c8549), steel = tone(0x434950),
    dark = tone(0x1c1f1a), metal = tone(0x8e979c);
  const back = -dir;

  // Walk: the feet step alternately with the stride clock; standing, they plant.
  const walking = !dead && (state === 'approach' || charging) && Math.abs(enemy.x - (enemy.previousX ?? enemy.x)) > 0.05;
  const phase = (enemy.stride ?? 0) * (charging ? 4.5 : 5.5);
  let near = { x: 10, y: 0 }, far = { x: -12, y: 0 };
  if (walking) {
    near = { x: 10 + Math.sin(phase) * 12, y: -Math.max(0, Math.cos(phase)) * 9 };
    far = { x: -12 - Math.sin(phase) * 12, y: -Math.max(0, -Math.cos(phase)) * 9 };
  }
  let body = 0, lean = 0;
  if (!dead) {
    body = walking ? -Math.abs(Math.sin(phase)) * 2.5 : Math.sin(elapsed * 2) * 0.6;
    if (windup && move === 0) { near = { x: 20, y: -30 * Math.min(1, t / 0.4) }; lean = -0.06; body -= 3; }
    if (firing && move === 0) {
      // Each stomp: the near foot lands, then (raging) lifts again for the second.
      const since = t - 0.1 - Math.max(0, (enemy.shots ?? 1) - 1) * 0.55;
      near = { x: 20, y: since < 0 ? -30 : 0 };
      if (rage && (enemy.shots ?? 0) < 2 && t > 0.3) near = { x: 20, y: -30 * Math.min(1, (t - 0.3) / 0.3) };
      body += since >= 0 && since < 0.15 ? 3 : 0;
    }
    if (charging) lean = 0.09;
    if (windup && move === 3) { lean = -0.04; body += 3; }
    if (stunned) lean = Math.sin(elapsed * 11) * 0.05;
  } else {
    body = 30; lean = 0.32; near = { x: 24, y: 0 }; far = { x: -24, y: 0 };
  }

  // Charge dust and speed lines, behind.
  if (charging || (firing && move === 0)) {
    g.fillStyle(0xcdb998, 0.5);
    for (let i = 0; i < 5; i++) {
      const puff = (elapsed * 3.5 + i / 5) % 1;
      g.fillCircle(enemy.x + (charging ? back : (i % 2 ? 1 : -1)) * (20 + puff * 50), ground - 3 - puff * 12, 3 + puff * 9);
    }
    if (charging) {
      g.lineStyle(1.6, 0xffffff, 0.6);
      for (const [y, len] of [[-80, 40], [-62, 56], [-30, 44]]) {
        const flick = Math.sin(elapsed * 40 + y) * 5;
        g.lineBetween(enemy.x + back * 38, ground + y, enemy.x + back * (38 + len + flick), ground + y);
      }
    }
  }
  // Stomp shockwave: a flattened ring running out along the ground.
  if (enemy.shockwave) {
    const { radius } = enemy.shockwave;
    const fade = 1 - radius / 130;
    g.lineStyle(4, 0xfff0c8, 0.3 + fade * 0.5);
    g.strokeEllipse(enemy.x, ground - 2, radius * 2, 16 + radius * 0.12);
    g.lineStyle(2, 0xffffff, 0.6 * fade + 0.2);
    g.strokeEllipse(enemy.x, ground - 2, radius * 1.4, 10 + radius * 0.08);
  }

  g.save();
  g.translateCanvas(enemy.x, ground);
  g.scaleCanvas(dir, 1);
  // Legs: hip under the hull, knee forward (reverse joint), flat foot.
  const leg = (hipX, foot, color, shade) => {
    const hip = { x: hipX, y: -50 + body };
    const ankle = { x: foot.x - 2, y: foot.y - 9 };
    joint(hip.x, hip.y, ankle.x, ankle.y, 24, 24, 1);
    const knee = { x: JOINT.x, y: JOINT.y };
    g.lineStyle(16, color); g.lineBetween(hip.x, hip.y, knee.x, knee.y);
    g.lineStyle(13, color); g.lineBetween(knee.x, knee.y, ankle.x, ankle.y);
    g.fillStyle(shade); g.fillCircle(hip.x, hip.y, 9.5);
    g.fillStyle(color); g.fillCircle(knee.x, knee.y, 9);
    g.fillStyle(shade); g.fillCircle(knee.x, knee.y, 5);
    g.fillStyle(metal); g.fillCircle(knee.x, knee.y, 2.2);
    // Piston along the shin.
    g.lineStyle(2.4, metal); g.lineBetween(knee.x - 5, knee.y + 3, ankle.x - 5, ankle.y - 1);
    g.fillStyle(shade); g.fillCircle(ankle.x, ankle.y, 6);
    g.fillStyle(color); g.fillRect(foot.x - 15, foot.y - 8, 32, 8);
    g.fillStyle(shade); g.fillRect(foot.x - 15, foot.y - 2.5, 32, 2.5); g.fillRect(foot.x + 12, foot.y - 9, 6, 9);
  };
  leg(-6, far, oliveDark, dark);

  g.save();
  g.translateCanvas(0, body);
  g.rotateCanvas(lean);
  // Exhaust stacks at the back, smoking.
  g.fillStyle(steel); g.fillRect(-34, -100, 4, 14); g.fillRect(-28, -97, 4, 11);
  if (!dead) {
    g.fillStyle(0x6b6e70, 0.45);
    for (let i = 0; i < 2; i++) {
      const f = (elapsed * 1.1 + i / 2) % 1;
      g.fillCircle(-32 - f * 8, -104 - f * 14, 2 + f * 4);
    }
  }
  // Missile pod: a 2x3 tube box at the back of the roof, its lid lifting for the salvo.
  const podOpen = !dead && move === 2 && (windup || firing);
  g.save(); g.translateCanvas(-24, -90); g.rotateCanvas(podOpen ? -0.35 : 0);
  g.fillStyle(oliveDark); g.fillRect(0, -14, 22, 14);
  g.fillStyle(olive); g.fillRect(1, -13, 20, 12);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
    const fired = podOpen && firing && (enemy.shots ?? 0) > (r * 3 + c) % 6;
    g.fillStyle(fired ? 0x2a2a2a : 0x7a2a22); g.fillCircle(5 + c * 6, -10 + r * 6, 2.2);
  }
  if (podOpen && windup) { g.fillStyle(0xff5040, 0.5 + 0.5 * Math.sin(elapsed * 30)); g.fillRect(1, -16, 20, 2); }
  g.restore();
  // Hull: plates, hazard band, stars, visor.
  g.fillStyle(oliveDark); g.fillPoints(GOLIATH_HULL, true);
  g.fillStyle(olive);
  const plates = [[-28, -86, 16, 22], [-10, -86, 16, 22], [-28, -62, 34, 12]];
  plates.forEach(([x, y, w, h], i) => {
    if (lost >= 0.25 * (i + 1)) {
      // Torn off: bare frame and wiring.
      g.fillStyle(dark); g.fillRect(x, y, w, h);
      g.lineStyle(1, 0xc24a2a); g.lineBetween(x + 2, y + 3, x + w - 3, y + h - 4);
      g.lineStyle(1, 0xd8b03a); g.lineBetween(x + 3, y + h - 3, x + w - 2, y + 4);
      g.fillStyle(olive);
    } else {
      g.fillRect(x, y, w, h);
      g.fillStyle(oliveLight); g.fillRect(x, y, w, 1.5);
      g.fillStyle(metal); g.fillRect(x + 1, y + 2, 1.5, 1.5); g.fillRect(x + w - 2.5, y + 2, 1.5, 1.5);
      g.fillStyle(olive);
    }
  });
  // Hazard band.
  for (let i = 0; i < 9; i++) {
    g.fillStyle(i % 2 ? dark : tone(0xe0b42c));
    g.fillPoints([pt(-26 + i * 5, -58), pt(-23 + i * 5, -58), pt(-25 + i * 5, -54), pt(-28 + i * 5, -54)], true);
  }
  const star = (cx, cy, r) => {
    const points = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      points.push(pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
    g.fillStyle(dead ? 0x3a3a36 : white ? 0xfff2df : 0xf2f2ea); g.fillPoints(points, true);
  };
  if (lost < 0.25) star(-20, -76, 4);
  if (lost < 0.5) star(-2, -76, 4);
  // Face: sloped armour with the visor slit.
  g.fillStyle(olive); g.fillPoints(GOLIATH_FACE, true);
  g.fillStyle(oliveLight); g.fillRect(20, -80, 10, 1.5);
  const visor = dead ? 0x2a1a18 : windup || charging ? (Math.floor(elapsed * 14) % 2 ? 0xff6a50 : 0xff2a1a) : 0xe0281c;
  g.fillStyle(dark); g.fillRect(19, -72, 14, 6);
  g.fillStyle(visor); g.fillRect(20, -71, 12, 3);
  if (!dead) { g.fillStyle(visor, 0.3); g.fillRect(18, -73, 16, 7); }
  // Chin gun.
  g.fillStyle(steel); g.fillRect(24, -52, 8, 5);
  g.fillStyle(dark); g.fillRect(31, -51, 9, 2);
  // Heavy cannon on the roof: tracks the hero in the windup, glows, kicks back on firing.
  const aim = dead ? 0.5 : Math.atan2(Math.sin(enemy.cannonAngle ?? 0), Math.cos(enemy.cannonAngle ?? 0) * dir) - lean;
  const since = firing && move === 1 ? t - (enemy.fired ?? -1) : 9;
  const kick = since < 0.15 ? (1 - since / 0.15) * 6 : 0;
  g.fillStyle(steel); g.fillRect(-2, -94, 18, 8);
  g.fillStyle(oliveDark); g.fillRect(0, -96, 14, 4);
  g.save(); g.translateCanvas(6, -84 - body * 0); g.rotateCanvas(Math.max(-1.2, Math.min(0.7, aim)));
  g.fillStyle(oliveDark); g.fillRect(-6, -6, 18, 12);
  g.fillStyle(steel); g.fillRect(10 - kick, -3, 32, 6);
  g.fillStyle(dark); g.fillRect(40 - kick, -4, 7, 8);
  g.fillStyle(metal); g.fillRect(12 - kick, -3, 28, 1.2);
  if (lost >= 0.75) { g.fillStyle(dark); g.fillRect(24 - kick, -3, 3, 6); }
  if (windup && move === 1) {
    const glow = Math.min(1, t / 0.6);
    g.fillStyle(0xffb040, 0.35 + glow * 0.5); g.fillCircle(46, 0, 3 + glow * 4);
    g.fillStyle(0xfff2c0, glow); g.fillCircle(46, 0, 1.5 + glow * 2);
  }
  if (since < 0.12) {
    g.fillStyle(0xffd27a, 0.95); g.fillCircle(52, 0, 9);
    g.fillStyle(0xffffff); g.fillCircle(50, 0, 4.5);
    g.fillStyle(0xff8a2a, 0.8); g.fillTriangle(52, -8, 52, 8, 68, 0);
  }
  g.restore();
  // Rage fire; stun sparks.
  if (rage || dead) {
    for (let i = 0; i < 4; i++) {
      const f = (elapsed * 3 + i * 0.29) % 1;
      g.fillStyle(dead ? 0x3a3a3a : 0xff8a2a, dead ? 0.5 : 0.9 - f * 0.6);
      g.fillCircle(-22 + i * 9 + Math.sin(elapsed * 9 + i) * 1.5, -92 - f * 14, (dead ? 3 : 2.8) + f * 2.5);
    }
  }
  if ((stunned || lost >= 0.5) && !dead && Math.sin(elapsed * 17) > 0.4) {
    g.fillStyle(0xffe066);
    for (let i = 0; i < 6; i++) g.fillRect(-10 + Math.cos(elapsed * 30 + i) * 22, -70 + Math.sin(elapsed * 23 + i) * 14, 1.5, 1.5);
  }
  g.restore();
  leg(8, near, olive, oliveDark);
  g.restore();

  // Smoke over a raging or wrecked mech.
  if (rage || dead) {
    g.fillStyle(0x4a4d53, 0.45);
    for (let i = 0; i < 4; i++) {
      const f = (elapsed * 0.8 + i / 4) % 1;
      g.fillCircle(enemy.x + back * (10 - f * 10) + Math.sin(f * 5 + i) * 4, ground - 100 + body - f * 40, 4 + f * 9);
    }
  }
}
