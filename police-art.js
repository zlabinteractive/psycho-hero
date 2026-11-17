// Heat level 1 police, heat level 2–3 SWAT and heat level 4 army units, drawn like street people (drawPerson in city-life.js): solid rectangles,
// no outlines, sized from the hero. Reference sheets (ideas only, never used as art):
// game-design-rules/enemy-refs/level-1-police.png, level-2-swat.jpg, level-3-swat.jpg, level-4-army.jpg.
import { HERO_HEIGHT } from './city-life.js';
import { lerpColor } from './planet.js';

const UNIFORM = 0x1f2c50;
const TROUSERS = 0x19233f;
const CAP = 0x141c33;
const COLLAR = 0x9cc0e0;
const BELT = 0x0f1218;
const BADGE = 0xc8ccd2;
const GUN = 0x15171c;
// Heat level 2–3 SWAT (enemy-refs/level-2-swat.jpg, level-3-swat.jpg): navy fatigues, a black vest
// lettered SWAT, knee pads, a navy helmet with tinted goggles over a black mask, an assault rifle
// held across the chest (the marksman's long, with a scope).
const SWAT = { uniform: 0x26345e, trousers: 0x1f2b4f, vest: 0x14171f, helmet: 0x1c2544, visor: 0x86a39c, mask: 0x121418,
  text: 0xd8dde3, pads: 0x0f1116 };
const POLICE = { uniform: UNIFORM, trousers: TROUSERS, cap: CAP };
// Heat level 4 army (enemy-refs/level-4-army.jpg): olive fatigues, a tan plate carrier, a backpack,
// a helmet over a bare face.
const ARMY = { uniform: 0x67734a, trousers: 0x5a6640, vest: 0x9c8558, helmet: 0x5a6640, pack: 0x4b5536 };
export const SKINS = [0xe8b48c, 0xc98e66, 0x8d5a3b, 0xf0c7a0];
const HAIR = [0x2a1d14, 0x4a3020, 0x111111, 0x6b4a2a];
// 1.8m against the hero's 1.85m.
export const OFFICER_HEIGHT = Math.round(HERO_HEIGHT * 1.8 / 1.85);
const h = OFFICER_HEIGHT;
const unit = v => Math.max(1, Math.round(v * h / 18));

// angle: radians the body is turned, about its centre (held across the hero's hands, thrown, or
// falling after being let go), as city-life draws people off their feet.
export function drawOfficer(g, officer, groundAt, elapsed) {
  if (officer.angle && officer.health > 0) {
    g.save();
    g.translateCanvas(officer.x, officer.y);
    g.rotateCanvas(officer.angle);
    g.translateCanvas(-officer.x, -officer.y);
    drawPose(g, officer, groundAt, elapsed, false);
    g.restore();
    return;
  }
  drawPose(g, officer, groundAt, elapsed, true);
}

function drawPose(g, officer, groundAt, elapsed, grounded) {
  const look = officer.look ??= {
    skin: SKINS[officer.lookSeed % SKINS.length], hair: HAIR[(officer.lookSeed >> 2) % HAIR.length],
  };
  const white = officer.flash > 0 ? 0xfff6d6 : null;
  const fill = color => g.fillStyle(white ?? color);
  const x = Math.round(officer.x);
  const feet = Math.round(officer.y + officer.radius);
  const ground = Math.round(groundAt(officer.x));
  const width = unit(5);
  const head = unit(4);
  const legs = unit(7);
  const torso = unit(7);
  const dir = officer.facing < 0 ? -1 : 1;
  // SWAT kit: troopers, riot shields and marksmen; army kit: soldiers. All but riot shields and
  // police carry rifles.
  const type = officer.enemyType;
  const swat = type === 'swat' || type === 'riot' || type === 'sniper' || type === 'heli-rifle';
  const scoped = type === 'sniper' || type === 'police-sniper';
  const rifle = swat && type !== 'riot' || type === 'soldier' || scoped;
  const kit = type === 'soldier' ? ARMY : swat ? SWAT : POLICE;
  const UNIFORM = kit.uniform;
  const TROUSERS = kit.trousers;
  const CAP = kit.helmet ?? kit.cap;

  if (officer.health <= 0 || officer.dazed > 0) {
    // Down (or dazed after a drop): flat on the street where they landed, head toward the hit.
    const lying = Math.min(feet, ground);
    const length = legs + torso;
    const left = x - Math.floor(length / 2);
    const headSide = (officer.recoil ?? 1) > 0 ? -1 : 1;
    fill(TROUSERS);
    g.fillRect(headSide < 0 ? left + torso : left, lying - unit(2), legs, unit(2));
    fill(UNIFORM);
    g.fillRect(headSide < 0 ? left : left + legs, lying - unit(3), torso, unit(3));
    fill(look.skin);
    g.fillRect(headSide < 0 ? left - head : left + length, lying - head + 1, head, head - 1);
    fill(CAP);
    g.fillRect(headSide < 0 ? left - head - unit(1) : left + length + head - 1, lying - unit(3), unit(2), unit(3));
    return;
  }

  g.fillStyle(0x000000, 0.15);
  if (grounded && feet >= ground - 2) g.fillRect(x - Math.floor(width / 2) - 1, ground - 1, width + 2, 1);

  const moving = Math.abs(officer.x - officer.previousX) > 0.05;
  const kicking = officer.carried;
  const stride = moving || kicking
    ? Math.round(Math.sin((kicking ? elapsed * 14 : officer.x * 0.45)) * unit(1.5)) : 0;
  // Staggered: thrown back off balance, away from the hit.
  const lean = officer.state === 'stunned' ? -dir : 0;
  const left = x - Math.floor(width / 2);
  fill(TROUSERS);
  g.fillRect(left + stride, feet - legs, unit(2), legs);
  g.fillRect(left + width - unit(2) - stride, feet - legs, unit(2), legs);
  fill(BELT);
  g.fillRect(left + stride, feet - 1, unit(2), 1);
  g.fillRect(left + width - unit(2) - stride, feet - 1, unit(2), 1);
  if (kit.pads) {
    fill(kit.pads);
    g.fillRect(left + stride, feet - unit(4), unit(2), 1);
    g.fillRect(left + width - unit(2) - stride, feet - unit(4), unit(2), 1);
  }

  const shoulders = feet - legs - torso;
  if (kit.pack) {
    fill(kit.pack);
    g.fillRect(dir > 0 ? left + lean - unit(1.5) : left + lean + width, shoulders + 1, unit(1.5), unit(5));
  }
  fill(UNIFORM);
  g.fillRect(left + lean, shoulders, width, torso);
  fill(BELT);
  g.fillRect(left + lean, feet - legs - 1, width, 1);
  const headLeft = x - Math.floor(head / 2) + (dir > 0 ? 0 : -1) + 1 + lean;
  const headTop = shoulders - head;
  drawChest(g, fill, kit, left + lean, shoulders, width, torso, dir);
  drawHead(g, fill, look, kit, headLeft, headTop, head, dir);

  const shoulderX = x + lean + dir * unit(1);
  const shoulderY = shoulders + unit(1.5);
  if (type === 'riot' && !kicking) {
    drawShield(g, officer, { fill, x: x + lean, dir, shoulderX, shoulderY, top: shoulders - head + unit(1),
      height: head + torso + legs - unit(2), white, UNIFORM });
    return;
  }
  const aiming = ['aim', 'locked', 'burst'].includes(officer.state);
  if (type === 'soldier' && elapsed - (officer.thrown ?? -1) < 0.3 && !aiming && !kicking) {
    // Follow-through of an overarm grenade throw: the arm up and out over the head.
    fill(UNIFORM);
    g.fillRect(shoulderX + (dir > 0 ? 0 : -unit(1)), shoulders - unit(3), unit(1.5), unit(4));
    fill(look.skin);
    g.fillRect(shoulderX + dir * unit(1) + (dir > 0 ? 0 : -unit(1)), shoulders - unit(4), unit(1.5), unit(1.5));
  } else if (aiming) {
    // Pistol arm straight along the aim, the gun at the hand.
    const reach = unit(6);
    const hx = Math.round(shoulderX + officer.aim.x * reach);
    const hy = Math.round(shoulderY + officer.aim.y * reach);
    fill(UNIFORM);
    for (let i = 1; i < reach; i++) {
      g.fillRect(Math.round(shoulderX + officer.aim.x * i), Math.round(shoulderY + officer.aim.y * i), unit(1.5), unit(1.5));
    }
    fill(look.skin);
    g.fillRect(hx, hy, unit(1.5), unit(1.5));
    fill(GUN);
    const gx = Math.round(hx + officer.aim.x * unit(1.5));
    const gy = Math.round(hy + officer.aim.y * unit(1.5));
    g.fillRect(gx, gy, unit(2), unit(1));
    // The rifle: stock back at the shoulder, barrel out past the hand.
    const barrel = scoped ? unit(9) : rifle ? unit(5) : unit(3);
    if (rifle) {
      for (let i = -unit(4); i < barrel; i++) {
        g.fillRect(Math.round(hx + officer.aim.x * i), Math.round(hy + officer.aim.y * i), 1, unit(1));
      }
      // The marksman's scope, over the rifle by the hand.
      if (scoped) for (let i = 0; i < unit(3); i++) g.fillRect(Math.round(hx + officer.aim.x * i), Math.round(hy + officer.aim.y * i) - unit(1), 1, unit(1));
    }
    if (officer.state === 'locked') {
      // The raised weapon freezes before firing; a small warm muzzle makes that beat readable.
      g.fillStyle(0xffbc55);
      g.fillRect(Math.round(gx + officer.aim.x * barrel), Math.round(gy + officer.aim.y * barrel), 1, 1);
    }
    if (officer.state === 'burst' && officer.stateTime < 0.06) {
      g.fillStyle(0xffe27a);
      g.fillRect(Math.round(gx + officer.aim.x * barrel) - 1, Math.round(gy + officer.aim.y * barrel) - 1, 3, 3);
      g.fillStyle(0xfff6d3);
      g.fillRect(Math.round(gx + officer.aim.x * barrel), Math.round(gy + officer.aim.y * barrel), 1, 1);
    }
  } else if (kicking) {
    // Held up by the hero: arms flail overhead.
    fill(UNIFORM);
    const flap = Math.sin(elapsed * 18) > 0 ? 1 : 0;
    g.fillRect(left - 1, shoulders - unit(4) + flap, unit(1.5), unit(4));
    g.fillRect(left + width - 1, shoulders - unit(4) + 1 - flap, unit(1.5), unit(4));
  } else if (rifle) {
    // Rifle held across the chest, muzzle down and forward; the arm under it.
    fill(GUN);
    for (let i = 0; i < unit(7); i++) g.fillRect(x + lean - dir * unit(2) + dir * i, shoulders + unit(5) - Math.round(i * 0.4), 1, unit(1));
    fill(UNIFORM);
    g.fillRect(shoulderX, shoulderY, unit(1.5), unit(4));
    fill(GUN);
    g.fillRect(shoulderX + dir * unit(1.5), shoulderY + unit(3), unit(1.5), unit(1));
  } else {
    // Arm at the side, swinging against the stride; holster on the hip.
    fill(UNIFORM);
    g.fillRect(shoulderX - stride, shoulderY, unit(1.5), unit(5));
    fill(look.skin);
    g.fillRect(shoulderX - stride, shoulderY + unit(5), unit(1.5), unit(1));
    fill(BELT);
    g.fillRect(x - dir * unit(2), feet - legs, unit(1.5), unit(2));
  }
}

// Police drone (reference: enemy-refs/level-1-police-drone.jpg): a small quadcopter in the patrol
// car's livery, light bar on top, gun pod under the body, rotors as flickering blurred bars.
export function drawDrone(g, drone, groundAt, elapsed) {
  if (drone.enemyType === 'swarm') {
    const x = Math.round(drone.x);
    const y = Math.round(drone.y);
    const dead = drone.health <= 0;
    const warning = drone.state === 'windup' || drone.state === 'locked';
    const aim = drone.aim ?? { x: 1, y: 0 };
    const turned = drone.angle || (!dead ? Math.max(-0.25, Math.min(0.25, drone.vx / 260)) : 0);
    if (turned) {
      g.save();
      g.translateCanvas(x, y);
      g.rotateCanvas(turned);
      g.translateCanvas(-x, -y);
    }
    // Tiny angular skimmers: amber nose while coiling up, a short hot wake during the lunge.
    // The body carries the tell; no targeting rings obscure a pack's punching space.
    if (!dead && drone.state === 'strike') {
      g.lineStyle(2, 0x79e8ed, 0.55);
      g.lineBetween(x - aim.x * 14, y - aim.y * 14, x, y);
    }
    g.fillStyle(drone.flash > 0 ? 0xfff6d6 : dead ? 0x485057 : 0x253e48);
    g.fillRect(x - 5, y - 2, 10, 4);
    g.fillRect(x - 3, y - 5, 2, 10);
    g.fillRect(x + 2, y - 5, 2, 10);
    g.fillStyle(dead ? 0x637078 : warning ? 0xffbc55 : 0x8ce7ea);
    g.fillRect(x - 2 + Math.round(aim.x * 2), y - 1 + Math.round(aim.y * 2), 4, 2);
    if (!dead) {
      g.fillStyle(0xc8f1ed, 0.5);
      const rotor = Math.sin(elapsed * 70 + (drone.swarmSlot ?? 0)) > 0 ? 7 : 5;
      g.fillRect(x - rotor, y - 5, rotor * 2, 1);
    }
    if (turned) g.restore();
    return;
  }
  const x = Math.round(drone.x);
  const y = Math.round(drone.y);
  const white = drone.flash > 0 ? 0xfff6d6 : null;
  const dead = drone.health <= 0;
  const fill = (color, alpha = 1) => g.fillStyle(dead ? lerpColor(color, 0x26221f, 0.8) : white ?? color, alpha);
  const turned = drone.angle || (!dead && drone.vx ? Math.max(-0.3, Math.min(0.3, drone.vx / 200)) : 0);
  const landed = dead && !drone.lifted;
  if (turned && !landed) {
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(turned);
    g.translateCanvas(-x, -y);
  }
  // Recon (heat level 4): olive and bigger, a camera ball where the police one carries its gun,
  // a green nav light where the light bar is.
  const recon = drone.enemyType === 'recon';
  // The wreck keeps its body, pod and landing legs; only the rotor blades are lost.
  const top = landed ? Math.round(groundAt(drone.x)) - (recon ? 6 : 7) : y - 2;
  fill(recon ? 0x5d6943 : UNIFORM);
  g.fillRect(x - (recon ? 5 : 4), top + 1, recon ? 10 : 8, 2);
  fill(recon ? 0x7a8558 : 0xe9ecef);
  g.fillRect(x - 3, top, 6, 1);
  // Arms out to the rotors, which blur while it flies.
  fill(BELT);
  g.fillRect(x - 7, top + 1, 3, 1);
  g.fillRect(x + 4, top + 1, 3, 1);
  if (!landed) {
    const blur = dead ? 0.35 : 0.45 + 0.35 * Math.abs(Math.sin(elapsed * 40 + drone.x));
    fill(0xd8dde3, blur);
    g.fillRect(x - 9, top - 1, 5, 1);
    g.fillRect(x + 4, top - 1, 5, 1);
    fill(BELT);
    g.fillRect(x - 7, top, 1, 1);
    g.fillRect(x + 6, top, 1, 1);
  }
  const aim = drone.aim ?? { x: drone.facing ?? -1, y: 0 };
  if (recon) {
    // Camera ball, its lens turned toward the hero, between two landing legs
    // (enemy-refs/level-4-army.jpg).
    fill(BELT);
    g.fillRect(x - 2, top + 3, 4, 3);
    g.fillRect(x - 4, top + 3, 1, 3);
    g.fillRect(x + 3, top + 3, 1, 3);
    fill(0x8fc4e8);
    g.fillRect(x + (aim.x > 0 ? 1 : -2), top + 4, 1, 1);
  } else {
    // Gun pod under the body, along the aim.
    fill(GUN);
    g.fillRect(x - 1, top + 3, 2, 1);
    g.fillRect(Math.round(x + aim.x * 2) - 1, Math.round(top + 4 + aim.y * 2) - 1, 2, 2);
    if (!dead && drone.state === 'locked') {
      g.fillStyle(0xffbc55);
      g.fillRect(Math.round(x + aim.x * 5), Math.round(top + 4 + aim.y * 5), 1, 1);
    }
    if (!dead && drone.state === 'burst' && drone.stateTime < 0.06) {
      g.fillStyle(0xffe27a);
      g.fillRect(Math.round(x + aim.x * 5) - 1, Math.round(top + 4 + aim.y * 5) - 1, 3, 3);
    }
  }

  const blink = !dead && Math.sin(elapsed * 6) > 0;
  if (recon) {
    // Green nav light.
    fill(blink ? 0x6dff7a : 0x2e6a34);
    g.fillRect(x - 1, top - 1, 2, 1);
  } else {
    // Light bar: red and blue, flashing while it flies.
    fill(dead ? 0x55606e : blink ? 0xe63946 : 0x8a2a32);
    g.fillRect(x - 2, top - 1, 2, 1);
    fill(dead ? 0x55606e : blink ? 0x2a4a8a : 0x4a8ae6);
    g.fillRect(x, top - 1, 2, 1);
  }
  if (turned && !landed) g.restore();
  if (landed) {
    g.fillStyle(0x6b6f76, 0.5);
    const puff = (elapsed * 1.5 + drone.x * 0.1) % 1;
    g.fillRect(x - 1 + Math.round(puff * 2), top - 3 - Math.round(puff * 8), 2, 2);
  }
}

// The riot shield: a tall clear panel with a dark band, held in front. It pulls back in the bash
// windup and drives out in the strike. Knocked aside (officer.shieldDown), it hangs out to the
// side on a straight arm, the body open (enemy-refs/level-2-swat.jpg).
function drawShield(g, officer, { fill, x, dir, shoulderX, shoulderY, top, height, white, UNIFORM }) {
  const aside = officer.shieldDown > 0;
  const push = officer.state === 'windup' ? -unit(1) : officer.state === 'strike' ? unit(2) : 0;
  const front = x + dir * (aside ? unit(7) : unit(3) + push);
  const panelTop = aside ? top + unit(5) : top;
  const panel = aside ? height - unit(6) : height;
  fill(UNIFORM);
  const reach = Math.abs(front - shoulderX);
  g.fillRect(Math.min(front, shoulderX), shoulderY + (aside ? 0 : unit(2)), reach, unit(1.5));
  // Clear blue-tinted panel, its rim catching the light, a black band across the middle.
  const thick = unit(2.5);
  const near = front - (dir > 0 ? 0 : thick);
  g.fillStyle(white ?? 0xa9cbe6, aside ? 0.45 : 0.55);
  g.fillRect(near, panelTop, thick, panel);
  g.fillStyle(white ?? 0xe8f2f8, 0.85);
  g.fillRect(near, panelTop, thick, 1);
  g.fillRect(dir > 0 ? near + thick - 1 : near, panelTop, 1, panel);
  fill(0x1a1d24);
  g.fillRect(near, panelTop + Math.round(panel * 0.38), thick, unit(2));
}

// Vehicle guns, mounted on the roof at (gun.x, gun.y): `mount` w × h, a cupola, the barrel
// (length, thickness) along the aim from `pivot` px above the mount's middle.
// truck-gun: the armoured truck's small shielded gun. autocannon: the APC's olive turret.
const TURRETS = {
  'truck-gun': { mount: [6, 4], color: 0x23272d, barrel: 8, thick: 1, pivot: 2 },
  autocannon: { mount: [15, 5], color: 0x56613f, barrel: 15, thick: 1, pivot: 2 },
};
export function drawTurret(g, gun) {
  if (gun.health <= 0) return;
  if (gun.emplacement?.kind === 'sponson') return drawSponson(g, gun);
  if (gun.enemyType === 'tank-gun') return drawTankTurret(g, gun);
  const spec = TURRETS[gun.enemyType] ?? TURRETS['truck-gun'];
  const white = gun.flash > 0 ? 0xfff6d6 : null;
  const x = Math.round(gun.x);
  const y = Math.round(gun.y);
  const aim = gun.aim ?? { x: gun.facing ?? -1, y: 0 };
  const [w, h] = spec.mount;
  g.fillStyle(white ?? spec.color);
  g.fillRect(x - Math.floor(w / 2), y - 1, w, h);
  g.fillRect(x - 2, y - 3, 4, 2);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(x - Math.floor(w / 2), y + h - 2, w, 1);
  g.fillStyle(white ?? GUN);
  const py = y - spec.pivot + h / 2;
  for (let i = 1; i < spec.barrel; i++) g.fillRect(Math.round(x + aim.x * i), Math.round(py + aim.y * i), spec.thick, spec.thick);
  if (spec.thick > 1) g.fillRect(Math.round(x + aim.x * spec.barrel) - 1, Math.round(py + aim.y * spec.barrel) - 1, 3, 3);
  if (gun.state === 'burst' && gun.stateTime < 0.06) {
    g.fillStyle(0xffe27a);
    const far = spec.barrel + 2;
    g.fillRect(Math.round(x + aim.x * far) - 2, Math.round(py + aim.y * far) - 2, 4, 4);
  }
}

// The citadel's twin side guns: both barrels follow the same frozen firing direction.
function drawSponson(g, gun) {
  const { x, y } = gun;
  const aim = gun.aim;
  const nx = -aim.y, ny = aim.x;
  g.fillStyle(gun.flash > 0 ? 0xfff6d6 : 0x3a3d40);
  g.fillCircle(x, y, 5);
  for (const offset of [-2, 2]) {
    const bx = x + nx * offset, by = y + ny * offset;
    g.lineStyle(2, 0x3f4830);
    g.lineBetween(bx, by, bx + aim.x * 26, by + aim.y * 26);
    g.lineStyle(3, 0x252a2c);
    g.lineBetween(bx + aim.x * 24, by + aim.y * 24, bx + aim.x * 27, by + aim.y * 27);
    if (gun.state === 'burst' && gun.stateTime < 0.04) {
      g.fillStyle(0xffe27a);
      g.fillCircle(bx + aim.x * 29, by + aim.y * 29, 3);
    }
  }
}

// The tank's turret (from enemy-refs/level-4-army-vehicles.jpg): a long angular wedge set back on
// the hull, facing the aim, with a stowage crate on the rear bustle, the commander's machine gun
// and an antenna; the long gun leaves the mantlet with a fume extractor and a muzzle brake.
// u runs along the facing from the mount, v up from the hull deck (4 px under the mount: the roof
// gap plus the lane's drop).
const TANK_TURRET = { back: -24, pivot: [12, 3.5], barrel: 40 };
const tankFacing = gun => gun.side ?? (Math.sign((gun.aim ?? { x: gun.facing ?? -1 }).x) || -1);
// Where the tank's shell leaves the barrel (the enemy lab's fireShell).
export function tankMuzzle(gun) {
  const f = tankFacing(gun);
  const [u, v] = TANK_TURRET.pivot;
  return { x: gun.x + f * u + gun.aim.x * TANK_TURRET.barrel, y: gun.y + 4 - v + gun.aim.y * TANK_TURRET.barrel };
}
function drawTankTurret(g, gun) {
  const white = gun.flash > 0 ? 0xfff6d6 : null;
  const f = tankFacing(gun) * (gun.swing ?? 1);
  const x = Math.round(gun.x);
  const deck = Math.round(gun.y) + 4;
  const at = (u, v) => ({ x: x + f * u, y: deck - v });
  const box = (u0, u1, v0, v1) => g.fillRect(Math.min(x + f * u0, x + f * u1), deck - v1, Math.max(1, Math.abs(f * (u1 - u0))), v1 - v0);
  const aim = gun.aim ?? { x: f, y: 0 };
  const [pu, pv] = TANK_TURRET.pivot;
  const p = at(pu, pv);
  // The gun first, so its root hides in the mantlet.
  g.fillStyle(white ?? 0x3f4830);
  const along = (d, w) => g.fillRect(Math.round(p.x + aim.x * d - w / 2), Math.round(p.y + aim.y * d - w / 2), w, w);
  for (let d = 0; d <= TANK_TURRET.barrel; d++) along(d, 2);
  for (let d = 16; d <= 21; d++) along(d, 3);
  for (let d = TANK_TURRET.barrel - 3; d <= TANK_TURRET.barrel; d++) along(d, 3);
  if (gun.muzzleFlash > 0 || gun.state === 'burst' && gun.stateTime < 0.08) {
    g.fillStyle(0xffe27a);
    along(TANK_TURRET.barrel + 3, 6);
    g.fillStyle(0xfff6d6);
    along(TANK_TURRET.barrel + 2, 3);
  }
  // Turret: the low wedge front, the flat roof, the bustle overhanging at the back.
  const body = white ?? 0x5d6a45;
  g.fillStyle(body);
  g.fillPoints([at(-24, 2), at(-22, 0), at(14, 0), at(19, 2), at(11, 7), at(-21, 7), at(-24, 5)], true);
  g.fillStyle(white ?? 0x4a5537);
  g.fillPoints([at(-23, 2), at(-22, 0), at(14, 0), at(16, 1.5)], true);
  box(-22, 15, 0, 2);
  g.fillStyle(0xffffff, 0.14);
  box(-20, 11, 6, 7);
  g.fillStyle(0x000000, 0.22);
  box(-12, -11, 1, 6);
  box(2, 3, 2, 6);
  // Stowage crate on the bustle, a smoke launcher, the commander's cupola and machine gun, antenna.
  g.fillStyle(white ?? 0x8b6c48);
  box(-19, -13, 2, 6);
  g.fillStyle(0x5e4730);
  box(-19, -13, 4, 4.6);
  g.fillStyle(white ?? 0x3a4250);
  box(-24, -22, 4, 7);
  g.fillStyle(white ?? 0x3f4830);
  box(-7, -2, 7, 9);
  box(-5, -4, 9, 11);
  box(-5, 4, 11, 12);
  g.fillStyle(0x2c3222, 0.8);
  box(-20, -19, 7, 19);
}

// SWAT and army: a vest over the chest. Police: badge and collar.
function drawChest(g, fill, kit, left, shoulders, width, torso, dir) {
  if (kit.vest) {
    fill(kit.vest);
    g.fillRect(left, shoulders + 1, width, torso - unit(2));
    if (kit.text) {
      fill(kit.text);
      g.fillRect(left + Math.floor(width / 2) - 1, shoulders + unit(2), unit(2), 1);
    }
    return;
  }
  fill(BADGE);
  g.fillRect(left + (dir > 0 ? width - unit(2) : unit(1)), shoulders + unit(2), 1, 1);
  fill(COLLAR);
  g.fillRect(left + Math.floor(width / 2) - 1, shoulders, 2, 1);
}

// SWAT: a masked head under a helmet, the visor a pale strip at the front. Police: face, hair and
// a peaked cap, its brim out in front.
// Army: the face bare under a helmet that comes down over the brow and the back of the head.
function drawHead(g, fill, look, kit, headLeft, headTop, head, dir) {
  if (kit.helmet && !kit.visor) {
    fill(look.skin);
    g.fillRect(headLeft, headTop, head, head);
    fill(kit.helmet);
    g.fillRect(headLeft - 1, headTop - unit(1), head + 2, unit(2));
    g.fillRect(dir > 0 ? headLeft - 1 : headLeft + head - 1, headTop + unit(1), unit(1), unit(1.5));
    return;
  }
  if (kit.visor) {
    fill(kit.mask);
    g.fillRect(headLeft, headTop, head, head);
    fill(kit.helmet);
    g.fillRect(headLeft - 1, headTop - unit(1), head + 2, unit(2));
    g.fillRect(dir > 0 ? headLeft - 1 : headLeft + head - 1, headTop + unit(1), unit(1.5), unit(1.5));
    fill(kit.visor);
    g.fillRect(dir > 0 ? headLeft + Math.floor(head / 2) : headLeft, headTop + unit(1), Math.ceil(head / 2) + (dir > 0 ? 1 : 0), 1);
    return;
  }
  fill(look.skin);
  g.fillRect(headLeft, headTop, head, head);
  fill(look.hair);
  g.fillRect(dir > 0 ? headLeft : headLeft + head - 1, headTop + 1, 1, unit(1.5));
  fill(CAP);
  g.fillRect(headLeft - (dir > 0 ? 0 : 1), headTop - unit(1.5), head + 1, unit(1.5));
  g.fillRect(dir > 0 ? headLeft + head : headLeft - unit(1.5), headTop, unit(1.5), 1);
}
