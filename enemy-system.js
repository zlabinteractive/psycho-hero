import { segmentBox, segmentCircle } from './hero-combat.js';
import { sound } from './sound.js';
import { upgradeValue } from './shop.js';

// Placeholder bodies, real encounter rules. More types can supply their own tuning later.
export const ENEMIES = [
  { x: 655, y: 286, radius: 14, maxHealth: 210, enemyType: 'gunner' },
  { x: 745, y: 155, radius: 11, maxHealth: 165, enemyType: 'drone' },
  { x: 860, y: 286, radius: 14, maxHealth: 210, enemyType: 'ground-melee' },
  { x: 945, y: 150, radius: 11, maxHealth: 165, enemyType: 'flying-melee' },
  { x: 1090, y: 185, radius: 12, maxHealth: 135, enemyType: 'kamikaze' },
  ...[[-30, -16], [0, -28], [30, -16], [-30, 16], [0, 28], [30, 16]].map(([dx, dy], slot) => ({
    x: 1280 + dx, y: 160 + dy, radius: 6, maxHealth: 36, enemyType: 'swarm',
    swarmGroup: 'drill-swarm', swarmSlot: slot, laserDamageMultiplier: 3, laserHitPadding: 3,
  })),
];

export const ENEMY_RULES = Object.freeze({
  gunner: { flying: false, attack: 'ranged', speed: 28, range: 220, distance: 125, aim: 0.65, lock: 0.35,
    shots: 3, interval: 0.18, recovery: 1.5, projectileSpeed: 145, damage: 10, radius: 2 },
  drone: { flying: true, attack: 'ranged', speed: 43, range: 240, distance: 155, aim: 0.8, lock: 0.4,
    shots: 1, interval: 0.2, recovery: 1.7, projectileSpeed: 115, damage: 16, radius: 4 },
  'ground-melee': { flying: false, attack: 'melee', speed: 50, range: 34, height: 18,
    aim: 0.45, lock: 0.2, duration: 0.16, lungeSpeed: 65, reach: 18, attackRadius: 8,
    recovery: 0.9, damage: 12 },
  'flying-melee': { flying: true, attack: 'melee', speed: 70, range: 95,
    aim: 0.55, lock: 0.25, duration: 0.36, lungeSpeed: 230, reach: 0, attackRadius: 11,
    recovery: 1.2, damage: 16 },
  kamikaze: { flying: true, attack: 'self-destruct', speed: 85, range: 100,
    arm: 0.55, chargeSpeed: 195, fuse: 1.25, blastRadius: 48, damage: 26, recovery: 0.8 },
  // Heat level 1 patrol officer: a weak pistol gunner on the street (game-design-rules/heat-and-enemies.md).
  police: { flying: false, street: true, hitscan: true, attack: 'ranged', speed: 38, range: 420, distance: 115, aim: 0.35, lock: 0.3,
    shots: 4, interval: 0.11, gaps: [0.11, 0.30, 0.11], recovery: 0.65, damage: 4,
    tracerSpeed: 1200, tracerLength: 7 },
  // Heat level 1 police drone: hovers over the hero and fires short pistol bursts from a gun pod
  // under its body (muzzle: px below its centre).
  'police-drone': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 55, range: 460, distance: 110,
    aim: 0.4, lock: 0.3, shots: 3, interval: 0.075, gaps: [0.075, 0.22], recovery: 0.9, damage: 4, muzzle: 3,
    tracerSpeed: 1600, tracerLength: 6 },
  // Heat level 2 SWAT trooper: armoured, with an assault rifle firing longer, faster bursts.
  swat: { flying: false, street: true, hitscan: true, attack: 'ranged', speed: 34, range: 440, distance: 130, aim: 0.4, lock: 0.35,
    shots: 6, interval: 0.075, recovery: 0.65, damage: 5, tracerSpeed: 2400, tracerLength: 10 },
  // Heat level 2 police helicopter's door gunner: rides the helicopter (enemy.rider), so never
  // moves itself; fires pistol bursts.
  'police-heli': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 500, distance: 0,
    aim: 0.4, lock: 0.3, shots: 4, interval: 0.23, recovery: 0.5, damage: 4, muzzle: 0,
    tracerSpeed: 1450, tracerLength: 8 },
  // Heat level 2 riot shield: a slow `ground-melee` that bashes with the shield. The enemy lab's
  // guard soaks a front hit while the shield is up (riot shield in heat-and-enemies.md).
  riot: { flying: false, street: true, attack: 'melee', speed: 30, range: 30, height: 18,
    aim: 0.5, lock: 0.2, duration: 0.16, lungeSpeed: 70, reach: 16, attackRadius: 8, recovery: 1.1, damage: 8 },
  // Heat level 3 door gunner helicopter's gunner: a rider with an assault rifle.
  'heli-rifle': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 500, distance: 0,
    aim: 0.4, lock: 0.3, shots: 36, magazine: [32, 40], interval: 0.085, recovery: 2.6, reloadFloor: 1.5, damage: 5, muzzle: 0,
    tracerSpeed: 2800, tracerLength: 11 },
  // Heat level 3 armoured truck's roof gun: a slower automatic stream, then a full reload.
  'truck-gun': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 240, distance: 0,
    aim: 0.8, lock: 0.35, shots: 14, magazine: [12, 15], interval: 0.26, recovery: 3, reloadFloor: 1.5, damage: 7, muzzle: -2,
    tracerSpeed: 1600, tracerLength: 14 },
  // Heat level 3 marksman: on a roof; a long aim (the laser line), then one heavy shot from far off.
  // notice: px at which it starts aiming (the others wait for 290).
  sniper: { flying: false, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 420, distance: 0, notice: 420,
    aim: 1.2, lock: 0.25, shots: 1, interval: 0.2, recovery: 2.4, damage: 14,
    tracerSpeed: 3800, tracerLength: 18 },
  // Police heat level 3 sniper: the marksman's roof and laser line, a longer aim and a lighter shot.
  'police-sniper': { flying: false, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 420, distance: 0, notice: 420,
    aim: 1.4, lock: 0.25, shots: 1, interval: 0.2, recovery: 2.8, damage: 10,
    tracerSpeed: 3800, tracerLength: 18 },
  'police-heli-sniper': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 500, distance: 0,
    aim: 1.4, lock: 0.3, telegraphFloor: 0.9, shots: 1, interval: 0.2, recovery: 2.8, damage: 10,
    tracerSpeed: 3800, tracerLength: 18 },
  // Jetpack officer: hovers at pistol range with little drift and fires short bursts often.
  'police-pursuit': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 60, range: 360, distance: 140,
    aim: 0.45, lock: 0.25, shots: 4, interval: 0.12, recovery: 0.8, damage: 4,
    tracerSpeed: 1800, tracerLength: 9 },
  'police-breacher': { flying: false, street: true, attack: 'ranged', speed: 58, range: 200, distance: 60,
    aim: 0.7, lock: 0.27, telegraphFloor: 0.5, shots: 2, interval: 0.24, fixedInterval: true, recovery: 1.5,
    recoveryFloor: 0.85, projectileSpeed: 310, projectileLife: 0.72, fan: [-0.16, 0, 0.16], damage: 8, radius: 2 },
  'police-rider': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 330, distance: 0,
    aim: 0.5, lock: 0.25, telegraphFloor: 0.34, shots: 5, interval: 0.1, recovery: 1,
    tracerSpeed: 1600, tracerLength: 8, muzzle: 0, damage: 4 },
  'sky-marshal': { flying: true, street: true, attack: 'boss', speed: 265, range: 390, distance: 90,
    aim: 0.7, lock: 0.25, telegraphFloor: 0.5, recovery: 0.95, recoveryFloor: 0.65,
    duration: 0.44, lungeSpeed: 500, reach: 8, attackRadius: 13, damage: 16,
    shots: 5, interval: 0.14, fixedInterval: true, projectileSpeed: 420, projectileLife: 1.3,
    projectileMuzzle: 18, projectileMuzzleY: -4, radius: 2.5 },
  // Police boss: a ground juggernaut. Charges along the street, leaps onto the hero, fires back-pod
  // missiles and sweeps a visor laser upward. A charge that hits a wall leaves it stunned (wallStun s).
  // Windups per move (wind), the leap and laser track a moving hero (leapLead, laserTrack rad/s).
  bulwark: { flying: false, street: true, attack: 'brute', speed: 95, range: 420, aim: 0.7, lock: 0.2,
    telegraphFloor: 0.5, recovery: 0.8, recoveryFloor: 0.5, damage: 12, slam: 14, slamRadius: 110,
    chargeSpeed: 470, chargeTime: 1.1, wallStun: 1.5, leapTime: 0.85, leapLead: 0.8, missileDamage: 6,
    missiles: 4, rageMissiles: 6, laserDamage: 8, laserTime: 1.2, laserSweep: 1.25, laserRange: 640,
    laserTrack: 1.4, wind: [0.6, 0.5, 0.45, 0.7] },
  // SWAT boss (campaign level 2): Rhino, an armoured command truck on the street. Moves: 0 ram charge
  // (a wall stuns it), 1 roof water cannon (pushes and stings), 2 roof mortar volley onto the hero,
  // 3 rear doors open and a SWAT squad jumps out (while fewer than squadMax are up).
  rhino: { flying: false, street: true, attack: 'rhino', speed: 80, range: 520, aim: 0.7, lock: 0.2,
    telegraphFloor: 0.5, recovery: 1.0, recoveryFloor: 0.6, wind: [0.8, 0.7, 0.6, 0.6],
    ramSpeed: 480, ramTime: 1.3, ramDamage: 12, wallStun: 1.6, halfLength: 50, height: 40,
    cannonTime: 1.8, cannonRange: 300, cannonPush: 900, cannonDamage: 4, cannonTrack: 1.6,
    mortarShells: 3, rageShells: 5, mortarDamage: 8, mortarGap: 0.35, squadMax: 8 },
  // Army boss (campaign level 3): Goliath, a walker mech on the street (reference
  // enemy-refs/level-3-army-goliath-boss.png). Its hull (the hit circle) rides hullY px above the
  // ground on two legs. Moves: 0 stomp (a raised foot slams down; a shockwave runs stompRadius px
  // along the ground, over by flying high), 1 shoulder cannon (aims while the barrel glows, freezes
  // cannonLock s before firing a shell that carves), 2 shoulder-pod missile salvo, 3 striding charge
  // (a wall stuns it). Raging (under half health) it stomps twice and fires twice.
  goliath: { flying: false, street: true, attack: 'walker', speed: 70, range: 520, aim: 0.7, lock: 0.2,
    telegraphFloor: 0.5, recovery: 0.9, recoveryFloor: 0.55, wind: [0.75, 0.9, 0.6, 0.7], hullY: 62,
    stompDamage: 14, stompRadius: 130, stompHeight: 60, cannonLock: 0.25, cannonDamage: 14, cannonGap: 0.45,
    missiles: 6, rageMissiles: 8, missileGap: 0.15, missileDamage: 6, chargeSpeed: 380, chargeTime: 1.2,
    chargeDamage: 12, wallStun: 1.6, halfWidth: 34, height: 96 },
  // Heat level 4 (army). Soldier: a heavier rifle; the enemy lab adds grenades between bursts.
  soldier: { flying: false, street: true, hitscan: true, attack: 'ranged', speed: 36, range: 460, distance: 140, aim: 0.4, lock: 0.3,
    shots: 6, interval: 0.075, gaps: [0.075, 0.075, 0.30, 0.075, 0.075], recovery: 0.62, damage: 6,
    tracerSpeed: 2600, tracerLength: 12 },
  // The APC's roof autocannon: a rider, slow heavy bursts.
  autocannon: { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 280, distance: 0, notice: 300,
    aim: 0.8, lock: 0.35, shots: 3, interval: 0.38, recovery: 1.55, damage: 9, muzzle: 0,
    tracerSpeed: 1350, tracerLength: 16 },
  // The tank's main gun: a rider whose turret turns slowly onto the hero (the enemy lab turns its
  // aim, the telegraph), then one shell (ordnance: the enemy lab flies it; it carves what it hits).
  'tank-gun': { flying: true, street: true, attack: 'ranged', ordnance: 'shell', speed: 0, range: 340, distance: 0, notice: 360,
    aim: 1.6, lock: 0.4, shots: 1, interval: 0.2, recovery: 3, damage: 24, muzzle: -1 },
  // Ember Base has dedicated weapons: rapid artillery and sustained AA / twin-sponson fire.
  // Keep their final aim lock and limited tracking so flying across the line still evades fire.
  'base-cannon': { flying: true, street: true, attack: 'ranged', ordnance: 'shell', speed: 0, range: 800, distance: 0,
    aim: 0.45, lock: 0.22, shots: 1, interval: 0.2, recovery: 0.65, damage: 24 },
  'base-aa': { flying: true, street: true, attack: 'ranged', hitscan: true, speed: 0, range: 700, distance: 0,
    aim: 0.3, lock: 0.2, shots: 32, magazine: [28, 36], interval: 0.065, recovery: 0.85, reloadFloor: 0.65,
    damage: 7, muzzle: 0, tracerSpeed: 2400, tracerLength: 12, track: 0.65 },
  'base-sponson': { flying: true, street: true, attack: 'ranged', hitscan: true, speed: 0, range: 850, distance: 0,
    aim: 0.28, lock: 0.2, shots: 40, magazine: [36, 44], interval: 0.055, recovery: 0.8, reloadFloor: 0.6,
    damage: 8, muzzle: 0, tracerSpeed: 2800, tracerLength: 14, track: 0.7 },
  // The attack chopper's chin gun: a rider, long bursts (rocket salvos come from the enemy lab).
  'chin-gun': { flying: true, street: true, hitscan: true, attack: 'ranged', speed: 0, range: 520, distance: 0, notice: 320,
    aim: 0.4, lock: 0.3, shots: 56, magazine: [48, 64], interval: 0.055, recovery: 2.4, reloadFloor: 1.5, damage: 5, muzzle: 0,
    tracerSpeed: 3000, tracerLength: 9, track: 0.45 },
  // Recon drone: flies a standoff over the hero and never fires (it spots, for the heat system).
  recon: { flying: true, street: true, attack: 'ranged', speed: 45, range: 0, distance: 120, aim: 1, lock: 1,
    shots: 1, interval: 1, recovery: 1, damage: 0 },
  swarm: { flying: true, attack: 'melee', speed: 90, range: 52,
    aim: 0.3, lock: 0.14, duration: 0.22, lungeSpeed: 175, reach: 0, attackRadius: 6,
    recovery: 0.85, damage: 5, separation: 24, formation: 24, staggerInterval: 0.035 },
});

// Enemy difficulty: pace scales attack timings except sustained automatic round spacing (aim,
// lock, grouped burst interval, recovery, kamikaze
// arming); power scales damage. The lock (the hero's chance to leave the line) never drops below
// MIN_LOCK s, so every shot can still be read and dodged.
export const DIFFICULTY = Object.freeze({
  easy: { label: 'Easy', pace: 1, power: 1 },
  normal: { label: 'Normal', pace: 0.7, power: 1 },
  hard: { label: 'Hard', pace: 0.5, power: 1.25 },
  brutal: { label: 'Brutal', pace: 0.35, power: 1.5 },
});
const MIN_LOCK = 0.12;
const PACED = ['aim', 'interval', 'recovery', 'arm'];
const STRAIGHT_SHOT = [0];
// Boss tuning: hits that break its poise into a stagger (more while raging), the sweep's arc
// (radians) and its round spacing, and the missile spacing.
// Enemy spacing: personal space is `room` × the two radii plus `gap` px; overlap pushes apart at
// up to `speed` px/s.
export const SPREAD = Object.freeze({ room: 1.6, gap: 6, speed: 160 });
export const BOSS = Object.freeze({ poise: 3, ragePoise: 4, sweep: 1.3, sweepInterval: 0.07, missileInterval: 0.32 });

// Shop: max health 100 to 200.
export const HERO_DAMAGE = Object.freeze({ get maxHealth() { return upgradeValue('health'); }, protection: 0.75, radius: 9 });
// Passive regeneration at max level: health per second, starting `delay` s after the last hit.
export const HERO_REGEN = Object.freeze({ rate: 12, delay: 2 });
// Seconds a revived hero cannot be hurt.
export const REVIVE_GRACE = 30;
// Hitscan damage lands at once; its compact visual round travels independently of the hit test.
export const TRACER_SPEED = 3000;
// Muzzle flash and sparks last eight frames, including when the round reaches a nearby wall.
export const TRACER_LIFE = 8 / 60;
const unit = (x, y) => {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
};

export class EnemySystem {
  constructor(arena) {
    this.arena = arena;
    this.random = Math.random; // tests swap in a seeded source
    this.responseRecovery = 1;
    this.setDifficulty('easy');
    this.reset();
  }

  // The rules every enemy here acts on, at a DIFFICULTY level (default 'easy': ENEMY_RULES as written).
  setDifficulty(level) {
    const { pace, power } = DIFFICULTY[level];
    this.difficulty = level;
    this.rules = Object.fromEntries(Object.entries(ENEMY_RULES).map(([type, rule]) => {
      const scaled = { ...rule, damage: rule.damage * power };
      for (const key of PACED) if (key in rule) scaled[key] = rule[key] * pace;
      if (rule.telegraphFloor) scaled.aim = Math.max(rule.telegraphFloor, scaled.aim);
      if (rule.magazine || rule.fixedInterval) scaled.interval = rule.interval;
      if (rule.gaps) scaled.gaps = rule.gaps.map(gap => gap * pace);
      if ('lock' in rule) scaled.lock = Math.max(Math.min(MIN_LOCK, rule.lock), rule.lock * pace);
      return [type, scaled];
    }));
  }

  reset() {
    this.hero = { health: HERO_DAMAGE.maxHealth, invulnerable: 0, flash: 0, hits: 0, sinceHit: 0 };
    this.projectiles = [];
    this.impacts = [];
    // Hitscan shots carry compact visual rounds that travel independently of the hit test.
    this.tracers = [];
    this.time = 0;
    this.nextProjectileId = 0;
    this.nextWeaponPhase = 0;
    for (const [index, enemy] of this.arena.enemies.entries()) this.prepare(enemy, 0.6 + index * 0.4);
  }

  // Fresh AI state. wake: seconds before it first acts.
  prepare(enemy, wake = 0.6) {
    // Stable, bounded individuality; never jitter the authored beat or shorten the dodge lock.
    const rule = ENEMY_RULES[enemy.baseWeapon ?? enemy.enemyType];
    const phase = (++this.nextWeaponPhase * 0.61803398875) % 1;
    const armed = rule.hitscan || rule.ordnance;
    Object.assign(enemy, { state: 'idle', stateTime: 0, stagger: 0,
      grounded: !ENEMY_RULES[enemy.enemyType].flying,
      wakeDelay: enemy.enemyType === 'swarm' ? 0.6 + (enemy.swarmSlot ?? 0) * 0.08 : wake + (armed ? phase * 0.16 : 0),
      recoveryPace: armed ? 0.9 + phase * 0.2 : 1,
      weaponPhase: phase, weaponCycle: 0, cycleReloadPace: 1, cycleShots: rule.shots,
      shots: 0, meleeHit: false, detonated: false,
      aim: { x: -1, y: 0 }, facing: -1 });
    return enemy;
  }

  get defeated() { return this.hero.health <= 0; }

  // Back to full health where the hero fell, with a grace period and the shots in the air cleared.
  revive() {
    this.hero.health = HERO_DAMAGE.maxHealth;
    this.hero.invulnerable = REVIVE_GRACE;
    this.projectiles = [];
  }

  // Dummies do not block enemy fire. Intact scenery does, and breaches open sight lines. Street
  // units (rule.street) stand in front of the buildings, so scenery behind them never blocks.
  obstruction(from, to, padding = 0, type = from.enemyType) {
    let nearest = null;
    for (const prop of ENEMY_RULES[type]?.street ? [] : this.arena.props) {
      if (prop.health <= 0) continue;
      const hit = segmentBox(from, to, prop, padding);
      if (hit && (!nearest || hit.t < nearest.t)) nearest = hit;
    }
    // ponytail: checks ground under the segment's end only; march like HeroLaser if bots meet terrain.
    const groundY = this.arena.groundAt(to.x);
    if (to.y >= groundY && from.y < groundY) {
      const t = (groundY - from.y) / (to.y - from.y);
      if (!nearest || t < nearest.t) nearest = { t };
    }
    return nearest;
  }

  transition(enemy, state) {
    enemy.state = state;
    enemy.stateTime = 0;
  }

  update(dt, hero, previousHero = hero) {
    this.time += dt;
    this.hero.invulnerable = Math.max(0, this.hero.invulnerable - dt);
    this.hero.flash = Math.max(0, this.hero.flash - dt);
    if (!this.defeated && (this.hero.sinceHit += dt) > HERO_REGEN.delay) {
      this.hero.health = Math.min(HERO_DAMAGE.maxHealth, this.hero.health + HERO_REGEN.rate * dt);
    }
    for (const impact of this.impacts) impact.age += dt;
    for (const tracer of this.tracers) tracer.age += dt;
    this.tracers = this.tracers.filter(tracer => tracer.age < tracer.life);
    this.impacts = this.impacts.filter(impact => impact.age < (impact.duration ?? 0.25));

    for (const enemy of this.arena.enemies) {
      if (enemy.health <= 0) {
        enemy.state = 'down';
        continue;
      }
      // Grabbed or thrown by the hero: EnemyThrow moves it until it explodes or slips free.
      if (enemy.carried) continue;
      // CombatArena integrates knockback first. Resolve that displacement against scenery.
      const before = { x: enemy.previousX, y: enemy.previousY };
      const knockback = { x: enemy.vx, y: enemy.vy };
      this.arena.resolveSolids(before, enemy, knockback, enemy.radius);
      enemy.vx = knockback.x;
      enemy.vy = knockback.y;
      if (this.defeated) {
        this.transition(enemy, 'idle');
        continue;
      }
      const rule = this.rules[enemy.baseWeapon ?? enemy.enemyType];
      if (rule.attack === 'brute') this.settleBrute(enemy, dt);
      if (rule.attack === 'rhino') this.settleRhino(enemy);
      if (rule.attack === 'walker') this.settleWalker(enemy, rule);
      if (enemy.stagger > 0) {
        if (rule.attack === 'boss') enemy.flightVx = enemy.flightVy = 0;
        enemy.stagger = Math.max(0, enemy.stagger - dt);
        this.transition(enemy, 'stunned');
        continue;
      }
      if (enemy.state === 'stunned') this.transition(enemy, 'recover');
      enemy.stateTime += dt;
      if (this.retreat) {
        this.flee(enemy, rule, dt, hero);
        continue;
      }
      enemy.wakeDelay = Math.max(0, enemy.wakeDelay - dt);
      const dx = hero.x - enemy.x;
      const dy = hero.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (!['locked', 'strike'].includes(enemy.state) && Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      // Once launched, a kamikaze spends its fuse even if the hero leaves the drill.
      if (rule.attack === 'self-destruct' && ['arming', 'charge'].includes(enemy.state)) {
        this.updateKamikaze(enemy, rule, dt, hero, previousHero, distance);
        continue;
      }
      if (!enemy.response && (distance > Math.max(370, (rule.notice ?? rule.range ?? 0) + 30) || Math.hypot(enemy.x - enemy.homeX, enemy.y - enemy.homeY) > 340)) {
        this.transition(enemy, 'idle');
        this.move(enemy, rule, dt, { x: enemy.homeX, y: enemy.homeY }, true);
        continue;
      }
      if (rule.attack === 'melee') {
        this.updateMelee(enemy, rule, dt, hero, previousHero, distance);
        continue;
      }
      if (rule.attack === 'boss') {
        this.updateBoss(enemy, rule, dt, hero, previousHero, distance);
        continue;
      }
      if (rule.attack === 'brute') {
        this.updateBrute(enemy, rule, dt, hero, previousHero);
        continue;
      }
      if (rule.attack === 'rhino') {
        this.updateRhino(enemy, rule, dt, hero);
        continue;
      }
      if (rule.attack === 'walker') {
        this.updateWalker(enemy, rule, dt, hero);
        continue;
      }
      if (rule.attack === 'self-destruct') {
        this.updateKamikaze(enemy, rule, dt, hero, previousHero, distance);
        continue;
      }
      if (enemy.state === 'idle' || enemy.state === 'approach') {
        if (enemy.wakeDelay > 0 || (!enemy.response && distance > (rule.notice ?? 290))) continue;
        this.transition(enemy, 'approach');
        if (distance <= rule.range && !this.obstruction(enemy, hero)) {
          enemy.aim = unit(dx, dy);
          this.transition(enemy, 'aim');
        } else this.move(enemy, rule, dt, hero);
      } else if (enemy.state === 'aim') {
        enemy.aim = unit(dx, dy);
        if (this.obstruction(enemy, hero) || (!enemy.response && distance > rule.range + 30)) {
          this.transition(enemy, 'approach');
        } else if (enemy.stateTime >= rule.aim) this.transition(enemy, 'locked');
        else if (enemy.response) this.move(enemy, rule, dt, hero);
      } else if (enemy.state === 'locked' && enemy.stateTime >= rule.lock) {
        // Aim is frozen through lock and burst (track: rad/s sweep for long streams, slower than a
        // boost across the line); moving after the warning evades the shot.
        enemy.shots = 0;
        this.planVolley(enemy, rule);
        this.transition(enemy, 'burst');
        this.fire(enemy, rule, hero);
      } else if (enemy.state === 'burst' && enemy.stateTime >= (rule.gaps?.[enemy.shots - 1] ?? rule.interval)) {
        // Carry fractional time so automatic fire has the same duration at 60 and 120 Hz.
        enemy.stateTime -= rule.gaps?.[enemy.shots - 1] ?? rule.interval;
        if (rule.track) {
          const current = Math.atan2(enemy.aim.y, enemy.aim.x);
          const turn = Math.atan2(Math.sin(Math.atan2(dy, dx) - current), Math.cos(Math.atan2(dy, dx) - current));
          const step = rule.track * (rule.gaps?.[enemy.shots - 1] ?? rule.interval);
          const angle = current + Math.max(-step, Math.min(step, turn));
          enemy.aim = { x: Math.cos(angle), y: Math.sin(angle) };
        }
        this.fire(enemy, rule, hero);
      } else if (enemy.state === 'recover') {
        if (enemy.response || enemy.stateTime > 0.3) this.move(enemy, rule, dt, hero);
        const reload = rule.recovery * enemy.recoveryPace * enemy.cycleReloadPace * (enemy.response ? this.responseRecovery : 1);
        const floor = (rule.reloadFloor ?? 0) * (1 + enemy.cycleReloadPace - 0.75);
        if (enemy.stateTime >= Math.max(floor, rule.recoveryFloor ?? 0, reload)) this.transition(enemy, 'approach');
      }
    }
    this.separate(dt);
    this.updateProjectiles(dt, hero, previousHero);
  }

  // Close-by enemies drift apart (SPREAD) so one RAM or punch can't wipe a stacked group. Skips the
  // swarm (its own formation), anything perched, riding, carried, thrown or reeling from a hit.
  // ponytail: O(n²) pair scan, fine for the ~60-enemy cap; bucket by x if the cap grows a lot.
  separate(dt) {
    const free = this.arena.enemies.filter(e => e.health > 0 && !e.carried && !e.lifted && !e.perched
      && !e.rider && !e.emplacement && !(e.stagger > 0) && e.enemyType !== 'swarm');
    for (let i = 0; i < free.length; i++) {
      const a = free[i];
      for (let j = i + 1; j < free.length; j++) {
        const b = free[j];
        const room = (a.radius + b.radius) * SPREAD.room + SPREAD.gap;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) >= room || Math.abs(dy) >= room) continue;
        const distance = Math.hypot(dx, dy);
        if (distance >= room) continue;
        // Exactly stacked: split them sideways by list order.
        const nx = distance > 0.01 ? dx / distance : 1, ny = distance > 0.01 ? dy / distance : 0;
        const push = (1 - distance / room) * SPREAD.speed * dt / 2;
        // Ground units only slide along the street.
        this.displace(a, -nx * push, this.rules[a.enemyType]?.flying ? -ny * push : 0);
        this.displace(b, nx * push, this.rules[b.enemyType]?.flying ? ny * push : 0);
      }
    }
  }

  move(enemy, rule, dt, target, returning = false) {
    // On a roof, or riding a helicopter: holds the spot and fires from it.
    if (enemy.perched || enemy.rider || enemy.emplacement) return;
    if (enemy.enemyType === 'swarm' && !returning) {
      this.moveSwarm(enemy, rule, dt, target);
      return;
    }
    const dx = target.x - enemy.x;
    if (rule.attack === 'melee' || rule.attack === 'self-destruct' || returning) {
      const dy = rule.flying ? target.y - enemy.y : 0;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) return;
      const step = Math.min(distance, rule.speed * dt);
      this.displace(enemy, dx / distance * step, dy / distance * step);
      return;
    }
    const dy = rule.flying ? target.y - 45 - enemy.y : 0;
    // spread: a unit's own extra standoff, so a squad fans out instead of stacking on one spot.
    const distance = rule.distance + (enemy.spread ?? 0);
    const horizontal = Math.abs(dx) > distance + 15 ? Math.sign(dx)
      : Math.abs(dx) < distance - 35 ? -Math.sign(dx) : 0;
    const vertical = rule.flying && Math.abs(dy) > 15 ? Math.sign(dy) * 0.65 : 0;
    this.displace(enemy, horizontal * rule.speed * dt, vertical * rule.speed * dt);
  }

  // The boss is down: no one fights on. Free units run (or fly up and) away from the hero;
  // riders and gun mounts hold fire while their vehicles leave.
  flee(enemy, rule, dt, hero) {
    enemy.beam = null;
    if (enemy.rider || enemy.emplacement || enemy.boss) {
      this.transition(enemy, 'idle');
      return;
    }
    const away = Math.sign(enemy.x - hero.x) || enemy.facing || 1;
    enemy.facing = away;
    if (enemy.state !== 'approach') this.transition(enemy, 'approach');
    const speed = Math.max(140, (rule.speed ?? 0) * 2);
    this.displace(enemy, away * speed * dt, rule.flying ? -speed * 0.4 * dt : 200 * dt);
  }

  displace(enemy, dx, dy) {
    const from = { x: enemy.x, y: enemy.y };
    enemy.x += dx;
    enemy.y = Math.min(this.arena.groundAt(enemy.x) - enemy.radius, enemy.y + dy);
    return this.arena.resolveSolids(from, enemy, { x: dx, y: dy }, enemy.radius);
  }

  moveSwarm(enemy, rule, dt, hero) {
    const neighbors = this.arena.enemies.filter(other => other.health > 0 && !other.carried
      && other.enemyType === 'swarm' && other.swarmGroup === enemy.swarmGroup);
    const phase = (enemy.swarmSlot ?? 0) * Math.PI / 3 + this.time * 0.5;
    // Loose attack slots and local separation keep the pack readable and easy to sweep with a beam.
    const target = { x: hero.x + Math.cos(phase) * rule.formation,
      y: hero.y + Math.sin(phase) * rule.formation };
    const toward = unit(target.x - enemy.x, target.y - enemy.y);
    let x = toward.x;
    let y = toward.y;
    for (const other of neighbors) {
      if (other === enemy) continue;
      const dx = enemy.x - other.previousX;
      const dy = enemy.y - other.previousY;
      const distance = Math.hypot(dx, dy);
      if (distance >= rule.separation) continue;
      const away = distance > 0.001 ? unit(dx, dy)
        : { x: Math.cos(phase), y: Math.sin(phase) };
      const force = (1 - distance / rule.separation) * 1.8;
      x += away.x * force;
      y += away.y * force;
    }
    const direction = unit(x, y);
    this.displace(enemy, direction.x * rule.speed * dt, direction.y * rule.speed * dt);
  }

  updateKamikaze(enemy, rule, dt, hero, previousHero, distance) {
    if (enemy.state === 'idle' || enemy.state === 'approach') {
      if (enemy.wakeDelay > 0 || distance > 290) return;
      this.transition(enemy, 'approach');
      if (distance <= rule.range && !this.obstruction(enemy, hero)) {
        this.transition(enemy, 'arming');
      } else this.move(enemy, rule, dt, hero);
    } else if (enemy.state === 'arming') {
      enemy.aim = unit(hero.x - enemy.x, hero.y - enemy.y);
      if (enemy.stateTime >= rule.arm) this.transition(enemy, 'charge');
    } else if (enemy.state === 'charge') {
      // Clamp both motion and hero sweep to the live portion of the fuse.
      const activeTime = Math.min(dt, Math.max(0, rule.fuse - (enemy.stateTime - dt)));
      const activeHero = { x: previousHero.x + (hero.x - previousHero.x) * activeTime / dt,
        y: previousHero.y + (hero.y - previousHero.y) * activeTime / dt };
      const from = { x: enemy.x, y: enemy.y };
      enemy.aim = unit(activeHero.x - enemy.x, activeHero.y - enemy.y);
      this.move(enemy, { ...rule, speed: rule.chargeSpeed }, activeTime, activeHero);
      const hit = segmentCircle(
        { x: from.x - previousHero.x, y: from.y - previousHero.y },
        { x: enemy.x - activeHero.x, y: enemy.y - activeHero.y },
        { x: 0, y: 0 }, enemy.radius + HERO_DAMAGE.radius);
      if (hit !== null) {
        const contact = { x: from.x + (enemy.x - from.x) * hit,
          y: from.y + (enemy.y - from.y) * hit };
        const victim = { x: previousHero.x + (activeHero.x - previousHero.x) * hit,
          y: previousHero.y + (activeHero.y - previousHero.y) * hit };
        if (!this.obstruction(contact, victim)) {
          enemy.x = contact.x;
          enemy.y = contact.y;
          this.detonate(enemy, rule, victim);
          return;
        }
      }
      if (enemy.stateTime >= rule.fuse) this.detonate(enemy, rule, activeHero);
    } else if (enemy.state === 'recover' && enemy.stateTime >= rule.recovery * (enemy.response ? this.responseRecovery : 1)) {
      this.transition(enemy, 'approach');
    }
  }

  detonate(enemy, rule, hero) {
    if (enemy.health <= 0 || enemy.detonated) return;
    const inBlast = Math.hypot(hero.x - enemy.x, hero.y - enemy.y)
      <= rule.blastRadius + HERO_DAMAGE.radius;
    const hit = inBlast && !this.obstruction(enemy, hero) && this.damageHero(rule.damage);
    this.impacts.push({ x: enemy.x, y: enemy.y, age: 0, kind: 'explosion',
      duration: 0.45, radius: rule.blastRadius, hero: Boolean(hit) });
    this.arena.damage(enemy, enemy.health, enemy.aim, 0, 'self-destruct');
    enemy.vx = enemy.vy = 0;
    enemy.detonated = true;
    this.transition(enemy, 'down');
  }

  updateMelee(enemy, rule, dt, hero, previousHero, distance) {
    if (enemy.state === 'idle' || enemy.state === 'approach') {
      const packNearby = enemy.enemyType === 'swarm' && this.arena.enemies.some(other =>
        other.health > 0 && other.enemyType === 'swarm' && other.swarmGroup === enemy.swarmGroup
        && Math.hypot(hero.x - other.x, hero.y - other.y) <= 290);
      if (enemy.wakeDelay > 0 || (distance > 290 && !packNearby && !enemy.response)) return;
      this.transition(enemy, 'approach');
      const inReach = distance <= rule.range
        && (rule.flying || Math.abs(hero.y - enemy.y) <= rule.height);
      if (inReach && !this.obstruction(enemy, hero)) {
        enemy.aim = unit(hero.x - enemy.x, hero.y - enemy.y);
        this.transition(enemy, 'windup');
      } else this.move(enemy, rule, dt, hero);
    } else if (enemy.state === 'windup') {
      if (rule.windupMove) this.move(enemy, rule, dt * rule.windupMove, hero);
      enemy.aim = unit(hero.x - enemy.x, hero.y - enemy.y);
      if (this.obstruction(enemy, hero)) this.transition(enemy, 'approach');
      else if (enemy.stateTime >= rule.aim + (enemy.swarmSlot ?? 0) * (rule.staggerInterval ?? 0)) {
        this.transition(enemy, 'locked');
      }
    } else if (enemy.state === 'locked' && enemy.stateTime >= rule.lock) {
      enemy.meleeHit = false;
      this.transition(enemy, 'strike');
    } else if (enemy.state === 'strike') {
      const remaining = Math.max(0, rule.duration - (enemy.stateTime - dt));
      const activeTime = Math.min(dt, remaining);
      const activeHero = { x: previousHero.x + (hero.x - previousHero.x) * activeTime / dt,
        y: previousHero.y + (hero.y - previousHero.y) * activeTime / dt };
      this.strike(enemy, rule, activeTime, activeHero, previousHero);
      if (enemy.state === 'strike' && enemy.stateTime >= rule.duration) this.transition(enemy, 'recover');
    } else if (enemy.state === 'recover') {
      if (rule.recoverMove) this.move(enemy, rule, dt * rule.recoverMove, hero);
      if (enemy.stateTime >= Math.max(rule.recoveryFloor ?? 0,
        rule.recovery * (enemy.response ? this.responseRecovery : 1))) this.transition(enemy, 'approach');
    }
  }

  // Boss moves: 0 dash (chained 2-3 times), 1 cannon burst, 2 slow missiles to punch back,
  // 3 cannon sweep (a fan raked across the hero). Moves come in a shuffled order, never the same
  // twice running. Below half health it rages: shorter windups, longer chains, more rounds.
  // Punches always land, push it back and break its poise (BOSS.poise hits) into a stagger.
  updateBoss(enemy, rule, dt, hero, previousHero, distance) {
    const rage = enemy.health < enemy.maxHealth * 0.5;
    const move = enemy.bossMove ?? 0;
    if (enemy.state === 'idle' || enemy.state === 'approach') {
      if (enemy.wakeDelay > 0) return;
      this.transition(enemy, 'approach');
      this.moveBoss(enemy, rule, dt, hero, move === 0);
      if (distance > (move === 0 ? 230 : rule.range)) return;
      enemy.aim = unit(hero.x - enemy.x, hero.y - enemy.y);
      this.transition(enemy, 'windup');
    } else if (enemy.state === 'windup') {
      this.moveBoss(enemy, rule, dt * 0.65, hero, move === 0);
      enemy.aim = unit(hero.x - enemy.x, hero.y - enemy.y);
      const chained = move === 0 && (enemy.chainLeft ?? 0) < (enemy.chainSize ?? 0);
      if (enemy.stateTime >= rule.aim * (rage ? 0.7 : 1) * (chained ? 0.55 : 1)) this.transition(enemy, 'locked');
    } else if (enemy.state === 'locked' && enemy.stateTime >= rule.lock) {
      enemy.meleeHit = false;
      enemy.shots = 0;
      enemy.sweepFrom = Math.atan2(enemy.aim.y, enemy.aim.x) - BOSS.sweep / 2;
      this.transition(enemy, move === 0 ? 'strike' : 'burst');
    } else if (enemy.state === 'strike') {
      this.strike(enemy, rule, Math.min(dt, Math.max(0, rule.duration - (enemy.stateTime - dt))), hero, previousHero);
      if (enemy.stateTime >= rule.duration) {
        // A chained dash turns straight round into the next windup.
        if ((enemy.chainLeft ?? 0) > 0) { enemy.chainLeft--; this.transition(enemy, 'windup'); }
        else this.transition(enemy, 'recover');
      }
    } else if (enemy.state === 'burst') {
      this.moveBoss(enemy, rule, dt * 0.8, hero);
      enemy.facing = Math.sign(enemy.aim.x) || enemy.facing;
      const shots = move === 2 ? (rage ? 4 : 3) : move === 3 ? (rage ? 13 : 9) : rule.shots + (rage ? 3 : 0);
      const interval = move === 3 ? BOSS.sweepInterval : move === 2 ? BOSS.missileInterval : rule.interval;
      if (enemy.stateTime >= enemy.shots * interval) {
        if (move === 2) this.onOrdnance?.(enemy, { ...rule, ordnance: 'boss-missile' });
        else if (move === 3) {
          // The sweep rakes its fan across the frozen aim: dodge by moving with or against it.
          const angle = enemy.sweepFrom + BOSS.sweep * enemy.shots / (shots - 1);
          this.launchProjectile(enemy, rule, angle - Math.atan2(enemy.aim.y, enemy.aim.x));
        } else this.launchProjectile(enemy, rule, 0);
        enemy.shots++;
        if (enemy.shots >= shots) this.transition(enemy, 'recover');
      }
    } else if (enemy.state === 'recover') {
      this.moveBoss(enemy, rule, dt, hero);
      const recovery = Math.max(rule.recoveryFloor, rule.recovery * enemy.recoveryPace * this.responseRecovery) * (rage ? 0.7 : 1);
      if (enemy.stateTime >= recovery) {
        const options = [0, 1, 2, 3].filter(next => next !== move);
        enemy.bossMove = options[Math.floor(this.random() * options.length)];
        enemy.chainSize = enemy.chainLeft = enemy.bossMove === 0 ? (rage ? 2 : 1) + (this.random() < 0.5 ? 1 : 0) : 0;
        // Each cycle picks a new orbit: wider or tighter, clockwise or not.
        enemy.orbit = 90 + this.random() * 80;
        enemy.orbitDir = this.random() < 0.5 ? -1 : 1;
        this.transition(enemy, 'approach');
      }
    }
  }

  // Fly between attack positions throughout windup, shooting and recovery: a banking orbit round
  // the hero whose radius and direction change every attack cycle. Punch stagger suspends this
  // steering completely, so the player's knockback always wins.
  moveBoss(enemy, rule, dt, hero, close = false) {
    const rage = enemy.health < enemy.maxHealth * 0.5;
    enemy.orbitAngle = (enemy.orbitAngle ?? 0) + dt * (rage ? 2.4 : 1.8) * (enemy.orbitDir ?? 1);
    const radius = enemy.orbit ?? 110;
    const x = hero.x + (close ? 0 : Math.cos(enemy.orbitAngle) * radius);
    const y = hero.y + (close ? 0 : Math.sin(enemy.orbitAngle) * radius * 0.55 - 25);
    const dx = x - enemy.x, dy = y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const speed = Math.min(rule.speed * (rage ? 1.25 : 1), distance * 6);
    const ease = 1 - Math.exp(-8 * dt);
    enemy.flightVx = (enemy.flightVx ?? 0) + (dx / distance * speed - (enemy.flightVx ?? 0)) * ease;
    enemy.flightVy = (enemy.flightVy ?? 0) + (dy / distance * speed - (enemy.flightVy ?? 0)) * ease;
    this.displace(enemy, enemy.flightVx * dt, enemy.flightVy * dt);
  }

  // Bulwark stays on the street: punches shove it along, never lift it. Outside a leap it drops back
  // to the ground; a stagger cancels a leap or beam mid-way.
  settleBrute(enemy, dt) {
    enemy.vy = 0;
    if (enemy.slamAge !== undefined) enemy.slamAge += dt;
    if (enemy.state === 'leap' && !(enemy.stagger > 0)) return;
    enemy.beam = null;
    const ground = this.arena.groundAt(enemy.x) - enemy.radius;
    enemy.y = Math.min(ground, enemy.y + 420 * dt);
  }

  // Bulwark's moves: 0 charge, 1 leap slam, 2 missile salvo, 3 visor laser sweep. Shuffled, never the
  // same twice running; no charge while the hero is high above. Raging (under half health) it winds
  // up faster, recovers faster, fires more and runs harder.
  updateBrute(enemy, rule, dt, hero, previousHero = hero) {
    const rage = enemy.health < enemy.maxHealth * 0.5;
    const move = enemy.bossMove ?? 0;
    const dx = hero.x - enemy.x;
    const near = (radius, lift = 0) => Math.abs(hero.x - enemy.x) < enemy.radius + HERO_DAMAGE.radius + radius
      && Math.abs(hero.y - (enemy.y - lift)) < enemy.radius + HERO_DAMAGE.radius + radius;
    const hit = (amount) => {
      if (enemy.meleeHit || !this.damageHero(amount)) return;
      enemy.meleeHit = true;
      this.impacts.push({ x: hero.x, y: hero.y, age: 0, hero: true });
    };
    if (enemy.state === 'idle' || enemy.state === 'approach') {
      if (enemy.wakeDelay > 0) return;
      this.transition(enemy, 'approach');
      const want = move === 0 ? 170 : move === 1 ? 260 : move === 3 ? rule.laserRange * 0.85 : rule.range;
      if (Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      if (Math.abs(dx) > want) {
        this.displace(enemy, Math.sign(dx) * rule.speed * (rage ? 1.3 : 1) * dt, 0);
        return;
      }
      this.transition(enemy, 'windup');
    } else if (enemy.state === 'windup') {
      if (Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      enemy.aim = unit(dx, hero.y - (enemy.y - enemy.radius * 0.8));
      const wind = rule.wind[move] * (rage ? 0.7 : 1);
      if (enemy.stateTime < wind) return;
      enemy.meleeHit = false;
      enemy.shots = 0;
      if (move === 0) {
        enemy.chargeDir = enemy.facing;
        this.transition(enemy, 'strike');
      } else if (move === 1) {
        // Leads a moving hero: aims where the hero will be when it lands.
        const ground = this.arena.groundAt(enemy.x) - enemy.radius;
        const lead = (hero.x - previousHero.x) / Math.max(dt, 1e-3) * rule.leapTime * rule.leapLead;
        enemy.leap = { x0: enemy.x, x1: enemy.x + Math.max(-340, Math.min(340, dx + lead)),
          height: Math.max(70, Math.min(230, ground - hero.y + 25)) };
        this.transition(enemy, 'leap');
      } else {
        // The laser starts below the hero and sweeps up through it, its centre following the hero.
        enemy.sweepCentre = Math.atan2(enemy.aim.y, enemy.aim.x);
        this.transition(enemy, 'burst');
      }
    } else if (enemy.state === 'strike') {
      const blocked = this.displace(enemy, enemy.chargeDir * rule.chargeSpeed * (rage ? 1.15 : 1) * dt, 0);
      if (near(10, 10)) hit(rule.damage);
      if (blocked) {
        // Ran into a wall: dazed, the big punish window.
        enemy.stagger = rule.wallStun;
        this.impacts.push({ x: enemy.x + enemy.chargeDir * enemy.radius, y: enemy.y, age: 0, kind: 'explosion', duration: 0.3, radius: 14 });
        this.transition(enemy, 'stunned');
      } else if (enemy.stateTime >= rule.chargeTime) this.transition(enemy, 'recover');
    } else if (enemy.state === 'leap') {
      const t = Math.min(1, enemy.stateTime / rule.leapTime);
      const leap = enemy.leap;
      // Steers the landing after a hero still moving, up to the last third of the arc.
      if (t < 0.65) leap.x1 += Math.max(-260 * dt, Math.min(260 * dt, hero.x - leap.x1));
      this.displace(enemy, leap.x0 + (leap.x1 - leap.x0) * t - enemy.x, 0);
      const ground = this.arena.groundAt(enemy.x) - enemy.radius;
      enemy.y = ground - Math.sin(Math.PI * t) * leap.height;
      if (near(8)) hit(rule.damage);
      if (t >= 1) {
        enemy.y = ground;
        enemy.slamAge = 0;
        if (Math.abs(dx) < rule.slamRadius && hero.y > ground - 90) hit(rule.slam);
        this.impacts.push({ x: enemy.x, y: ground + enemy.radius, age: 0, kind: 'explosion', duration: 0.35, radius: 22 });
        this.transition(enemy, 'recover');
      }
    } else if (enemy.state === 'burst' && move === 2) {
      if (enemy.stateTime >= enemy.shots * 0.22) {
        enemy.aim = unit(dx, hero.y - enemy.y);
        this.onOrdnance?.(enemy, { ...rule, ordnance: 'boss-missile', damage: rule.missileDamage, missileY: -enemy.radius * 1.2 });
        if (++enemy.shots >= (rage ? rule.rageMissiles : rule.missiles)) this.transition(enemy, 'recover');
      }
    } else if (enemy.state === 'burst') {
      const t = enemy.stateTime / (rule.laserTime * (rage ? 0.85 : 1));
      if (t >= 1) {
        enemy.beam = null;
        this.transition(enemy, 'recover');
        return;
      }
      const heroAngle = Math.atan2(hero.y - (enemy.y - enemy.radius * 0.95), dx);
      const turn = Math.atan2(Math.sin(heroAngle - enemy.sweepCentre), Math.cos(heroAngle - enemy.sweepCentre));
      enemy.sweepCentre += Math.max(-rule.laserTrack * dt, Math.min(rule.laserTrack * dt, turn));
      const angle = enemy.sweepCentre + enemy.facing * rule.laserSweep * (0.4 - t);
      // From the visor (the art draws the beam from the same point).
      const beam = enemy.beam = { x: enemy.x + enemy.facing * enemy.radius * 0.48, y: enemy.y - enemy.radius * 0.95,
        dx: Math.cos(angle), dy: Math.sin(angle), length: rule.laserRange };
      const along = (hero.x - beam.x) * beam.dx + (hero.y - beam.y) * beam.dy;
      const across = Math.abs((hero.x - beam.x) * beam.dy - (hero.y - beam.y) * beam.dx);
      // The beam is drawn through buildings, so it burns the hero through them too.
      if (along > 0 && along < beam.length && across < HERO_DAMAGE.radius + 7) this.damageHero(rule.laserDamage);
    } else if (enemy.state === 'recover') {
      if (enemy.stateTime < Math.max(rule.recoveryFloor, rule.recovery * (rage ? 0.7 : 1))) return;
      // A hero high above can't be charged: leap, missiles or laser instead.
      const high = this.arena.groundAt(enemy.x) - hero.y > 120;
      enemy.bossMove = this.nextBossMove(enemy, move, next => high && next === 0);
      this.transition(enemy, 'approach');
    }
  }

  // A shuffled bag of four moves: every move comes up each round, never the same twice running.
  // skip(move): moves that can't be used right now.
  nextBossMove(enemy, last, skip) {
    const bag = enemy.moveBag ??= [];
    const pick = () => {
      for (let i = bag.length - 1; i >= 0; i--) if (bag[i] !== last && !skip(bag[i])) return i;
      return -1;
    };
    let at = pick();
    if (at < 0) {
      bag.push(0, 1, 2, 3);
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      at = pick();
    }
    return at < 0 ? (last + 1) % 4 : bag.splice(at, 1)[0];
  }

  // Rhino rides the street: punches shove it a little, never lift it.
  settleRhino(enemy) {
    enemy.vy = 0;
    enemy.y = this.arena.groundAt(enemy.x) - enemy.radius;
  }

  updateRhino(enemy, rule, dt, hero) {
    const rage = enemy.health < enemy.maxHealth * 0.5;
    const move = enemy.bossMove ?? 0;
    const dx = hero.x - enemy.x;
    // The roof turret's pivot (police-elite-art.js drawRhino).
    const roof = { x: enemy.x - enemy.facing * 14, y: enemy.y + enemy.radius - 52 };
    enemy.jet = null;
    if (enemy.state === 'idle' || enemy.state === 'approach') {
      if (enemy.wakeDelay > 0) return;
      this.transition(enemy, 'approach');
      const want = move === 0 ? 240 : move === 1 ? rule.cannonRange * 0.75 : move === 2 ? 380 : 300;
      if (Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      if (Math.abs(dx) > want) {
        this.displace(enemy, Math.sign(dx) * rule.speed * (rage ? 1.3 : 1) * dt, 0);
        return;
      }
      this.transition(enemy, 'windup');
    } else if (enemy.state === 'windup') {
      if (move !== 0 && Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      enemy.aim = unit(dx, hero.y - roof.y);
      if (enemy.stateTime < rule.wind[move] * (rage ? 0.75 : 1)) return;
      enemy.meleeHit = false;
      enemy.shots = 0;
      enemy.chargeDir = enemy.facing;
      enemy.cannonAngle = Math.atan2(enemy.aim.y, enemy.aim.x);
      this.transition(enemy, move === 0 ? 'strike' : 'burst');
    } else if (enemy.state === 'strike') {
      // Ram: flat out along the street; the plow hits anything at bumper height in its path.
      const blocked = this.displace(enemy, enemy.chargeDir * rule.ramSpeed * (rage ? 1.15 : 1) * dt, 0);
      const ground = this.arena.groundAt(enemy.x);
      if (!enemy.meleeHit && Math.abs(hero.x - enemy.x) < rule.halfLength + HERO_DAMAGE.radius
        && hero.y > ground - rule.height - HERO_DAMAGE.radius && this.damageHero(rule.ramDamage)) {
        enemy.meleeHit = true;
        this.impacts.push({ x: hero.x, y: hero.y, age: 0, hero: true });
      }
      if (blocked) {
        enemy.stagger = rule.wallStun;
        this.impacts.push({ x: enemy.x + enemy.chargeDir * rule.halfLength, y: enemy.y, age: 0, kind: 'explosion', duration: 0.35, radius: 18 });
        this.transition(enemy, 'stunned');
      } else if (enemy.stateTime >= rule.ramTime) this.transition(enemy, 'recover');
    } else if (enemy.state === 'burst' && move === 1) {
      // Water cannon: the jet follows the hero at cannonTrack rad/s; inside it, the hero is shoved
      // along the jet and stung (hit protection spaces the damage).
      const target = Math.atan2(hero.y - roof.y, dx);
      const turn = Math.atan2(Math.sin(target - enemy.cannonAngle), Math.cos(target - enemy.cannonAngle));
      enemy.cannonAngle += Math.max(-rule.cannonTrack * dt, Math.min(rule.cannonTrack * dt, turn));
      const jet = enemy.jet = { x: roof.x, y: roof.y, dx: Math.cos(enemy.cannonAngle), dy: Math.sin(enemy.cannonAngle), length: rule.cannonRange };
      const along = (hero.x - jet.x) * jet.dx + (hero.y - jet.y) * jet.dy;
      const across = Math.abs((hero.x - jet.x) * jet.dy - (hero.y - jet.y) * jet.dx);
      if (along > 0 && along < jet.length && across < HERO_DAMAGE.radius + 6) {
        const push = rule.cannonPush * (1 - along / jet.length * 0.5) * dt;
        this.onPushHero?.(jet.dx * push, jet.dy * push);
        this.damageHero(rule.cannonDamage);
      }
      if (enemy.stateTime >= rule.cannonTime) this.transition(enemy, 'recover');
    } else if (enemy.state === 'burst' && move === 2) {
      if (enemy.stateTime >= enemy.shots * rule.mortarGap) {
        enemy.aim = unit(dx, hero.y - roof.y);
        this.onOrdnance?.(enemy, { ...rule, ordnance: 'mortar', damage: rule.mortarDamage, roof });
        if (++enemy.shots >= (rage ? rule.rageShells : rule.mortarShells)) this.transition(enemy, 'recover');
      }
    } else if (enemy.state === 'burst') {
      // Deploy: the rear doors swing open; the squad jumps out once.
      if (!enemy.shots && enemy.stateTime >= 0.35) {
        enemy.shots = 1;
        this.onDeploySquad?.(enemy);
      }
      if (enemy.stateTime >= 1.1) this.transition(enemy, 'recover');
    } else if (enemy.state === 'recover') {
      if (enemy.stateTime < Math.max(rule.recoveryFloor, rule.recovery * (rage ? 0.7 : 1))) return;
      const squad = this.arena.enemies.filter(o => o.health > 0 && o.squadOf === enemy.id).length;
      const far = Math.abs(dx) > rule.cannonRange + 120;
      enemy.bossMove = this.nextBossMove(enemy, move, next => (next === 3 && squad >= rule.squadMax) || (next === 1 && far));
      this.transition(enemy, 'approach');
    }
  }

  // Goliath walks the street: its hull rides at hullY over the ground; punches shove it a little.
  settleWalker(enemy, rule) {
    enemy.vy = 0;
    enemy.y = this.arena.groundAt(enemy.x) - rule.hullY;
  }

  // The cannon's muzzle and the missile pod (police-elite-art.js drawGoliath).
  walkerMuzzle(enemy) {
    const angle = enemy.cannonAngle ?? (enemy.facing < 0 ? Math.PI : 0);
    const pivot = { x: enemy.x + enemy.facing * 6, y: enemy.y - 22 };
    return { x: pivot.x + Math.cos(angle) * 46, y: pivot.y + Math.sin(angle) * 46 };
  }

  updateWalker(enemy, rule, dt, hero) {
    const rage = enemy.health < enemy.maxHealth * 0.5;
    const move = enemy.bossMove ?? 0;
    const dx = hero.x - enemy.x;
    const ground = this.arena.groundAt(enemy.x);
    enemy.shockwave = null;
    if (enemy.state === 'idle' || enemy.state === 'approach') {
      if (enemy.wakeDelay > 0) return;
      this.transition(enemy, 'approach');
      const want = move === 0 ? 70 : move === 1 ? 340 : move === 2 ? 400 : 260;
      if (Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      if (Math.abs(dx) > want) {
        enemy.stride = (enemy.stride ?? 0) + dt * (rage ? 1.3 : 1);
        this.displace(enemy, Math.sign(dx) * rule.speed * (rage ? 1.3 : 1) * dt, 0);
        return;
      }
      this.transition(enemy, 'windup');
    } else if (enemy.state === 'windup') {
      if (Math.abs(dx) > 1) enemy.facing = Math.sign(dx);
      // The cannon tracks the hero while it glows, then freezes: moving then dodges the shell.
      const wind = rule.wind[move] * (rage ? 0.75 : 1);
      const pivotY = enemy.y - 22;
      if (move !== 1 || enemy.stateTime < wind - rule.cannonLock) enemy.cannonAngle = Math.atan2(hero.y - pivotY, dx);
      if (enemy.stateTime < wind) return;
      enemy.meleeHit = false;
      enemy.shots = 0;
      enemy.chargeDir = enemy.facing;
      this.transition(enemy, move === 3 ? 'strike' : 'burst');
    } else if (enemy.state === 'strike') {
      // Charge: long strides along the street; the hull and legs hit anything in the way.
      enemy.stride = (enemy.stride ?? 0) + dt * 3;
      const blocked = this.displace(enemy, enemy.chargeDir * rule.chargeSpeed * (rage ? 1.15 : 1) * dt, 0);
      if (!enemy.meleeHit && Math.abs(hero.x - enemy.x) < rule.halfWidth + HERO_DAMAGE.radius
        && hero.y > ground - rule.height - HERO_DAMAGE.radius && this.damageHero(rule.chargeDamage)) {
        enemy.meleeHit = true;
        this.impacts.push({ x: hero.x, y: hero.y, age: 0, hero: true });
      }
      if (blocked) {
        enemy.stagger = rule.wallStun;
        this.impacts.push({ x: enemy.x + enemy.chargeDir * rule.halfWidth, y: enemy.y, age: 0, kind: 'explosion', duration: 0.35, radius: 22 });
        this.transition(enemy, 'stunned');
      } else if (enemy.stateTime >= rule.chargeTime) this.transition(enemy, 'recover');
    } else if (enemy.state === 'burst' && move === 0) {
      // Stomp: the raised foot lands at 0.1s and a shockwave runs out along the ground; raging, the
      // other foot follows. A hero near the ground inside the ring is hit; flying high clears it.
      const stomps = rage ? 2 : 1;
      if (enemy.shots < stomps && enemy.stateTime >= 0.1 + enemy.shots * 0.55) {
        enemy.shots++;
        enemy.stompAt = enemy.stateTime;
        this.impacts.push({ x: enemy.x + enemy.facing * 14, y: ground, age: 0, kind: 'explosion', duration: 0.3, radius: 20 });
        if (Math.abs(dx) < rule.stompRadius && hero.y > ground - rule.stompHeight - HERO_DAMAGE.radius
          && this.damageHero(rule.stompDamage)) {
          this.onPushHero?.(Math.sign(dx || 1) * 260, -220);
          this.impacts.push({ x: hero.x, y: hero.y, age: 0, hero: true });
        }
      }
      if (enemy.stompAt !== undefined) enemy.shockwave = { x: enemy.x, y: ground, radius: rule.stompRadius * Math.min(1, (enemy.stateTime - enemy.stompAt) / 0.3) };
      if (enemy.stateTime >= 0.1 + stomps * 0.55) { enemy.stompAt = undefined; this.transition(enemy, 'recover'); }
    } else if (enemy.state === 'burst' && move === 1) {
      const shots = rage ? 2 : 1;
      if (enemy.shots < shots && enemy.stateTime >= enemy.shots * rule.cannonGap) {
        // The second shot re-aims onto the hero (a short telegraph: the barrel's still glowing).
        if (enemy.shots) enemy.cannonAngle = Math.atan2(hero.y - (enemy.y - 22), dx);
        enemy.shots++;
        enemy.fired = enemy.stateTime;
        this.onOrdnance?.(enemy, { ...rule, ordnance: 'walker-shell', damage: rule.cannonDamage, muzzle: this.walkerMuzzle(enemy) });
      }
      if (enemy.stateTime >= shots * rule.cannonGap + 0.35) this.transition(enemy, 'recover');
    } else if (enemy.state === 'burst') {
      // Missile salvo from the shoulder pod: up and over, curving onto the hero.
      const count = rage ? rule.rageMissiles : rule.missiles;
      if (enemy.stateTime >= enemy.shots * rule.missileGap) {
        this.onOrdnance?.(enemy, { ...rule, ordnance: 'boss-missile', damage: rule.missileDamage, missileY: -34 });
        if (++enemy.shots >= count) this.transition(enemy, 'recover');
      }
    } else if (enemy.state === 'recover') {
      if (enemy.stateTime < Math.max(rule.recoveryFloor, rule.recovery * (rage ? 0.7 : 1))) return;
      // A hero high overhead can't be stomped or charged: the cannon and missiles reach it.
      const high = ground - hero.y > 150;
      enemy.bossMove = this.nextBossMove(enemy, move, next => high && (next === 0 || next === 3));
      this.transition(enemy, 'approach');
    }
  }

  strike(enemy, rule, dt, hero, previousHero) {
    const from = { x: enemy.x, y: enemy.y };
    const blocked = this.displace(enemy, enemy.aim.x * rule.lungeSpeed * dt,
      rule.flying ? enemy.aim.y * rule.lungeSpeed * dt : 0);
    if (!enemy.meleeHit) {
      const reach = { x: enemy.aim.x * rule.reach, y: enemy.aim.y * rule.reach };
      const t = segmentCircle(
        { x: from.x + reach.x - previousHero.x, y: from.y + reach.y - previousHero.y },
        { x: enemy.x + reach.x - hero.x, y: enemy.y + reach.y - hero.y },
        { x: 0, y: 0 }, HERO_DAMAGE.radius + rule.attackRadius);
      if (t !== null) {
        const attacker = { x: from.x + (enemy.x - from.x) * t, y: from.y + (enemy.y - from.y) * t };
        const victim = { x: previousHero.x + (hero.x - previousHero.x) * t,
          y: previousHero.y + (hero.y - previousHero.y) * t };
        if (!this.obstruction(attacker, victim)) {
          enemy.meleeHit = true;
          this.damageHero(rule.damage);
          this.impacts.push({ ...victim, age: 0, hero: true });
        }
      }
    }
    if (blocked) this.transition(enemy, 'recover');
  }

  planVolley(enemy, rule) {
    // Pick only at volley boundaries: independent magazines/reloads, no per-shot randomness.
    const phase = (enemy.weaponPhase + ++enemy.weaponCycle * 0.61803398875) % 1;
    enemy.cycleShots = rule.magazine
      ? rule.magazine[0] + Math.floor(phase * (rule.magazine[1] - rule.magazine[0] + 1)) : rule.shots;
    enemy.cycleReloadPace = rule.hitscan || rule.ordnance ? 0.75 + ((phase + 0.37) % 1) * 0.5 : 1;
  }

  fire(enemy, rule, hero) {
    // Ordnance (shells): the arena owner flies it (onOrdnance), along the locked aim.
    if (!rule.ordnance) sound.gunshot(rule.damage >= 5);
    if (rule.ordnance) this.onOrdnance?.(enemy, rule);
    else if (rule.hitscan) {
      this.hitscan(enemy, rule, hero);
    } else for (const angle of rule.fan ?? STRAIGHT_SHOT) this.launchProjectile(enemy, rule, angle);
    enemy.shots++;
    if (enemy.shots >= (enemy.cycleShots ?? rule.shots)) this.transition(enemy, 'recover');
  }

  launchProjectile(enemy, rule, offset) {
    if (this.projectiles.length >= 48) return;
    const angle = Math.atan2(enemy.aim.y, enemy.aim.x) + offset;
    const muzzle = rule.projectileMuzzle ?? (rule.projectileLife ? 12 : 0);
    this.projectiles.push({ id: ++this.nextProjectileId, owner: enemy.id,
      x: enemy.x + Math.cos(angle) * muzzle,
      y: enemy.y + (rule.projectileMuzzleY ?? (muzzle ? -2 : 0)) + Math.sin(angle) * muzzle,
      vx: Math.cos(angle) * rule.projectileSpeed, vy: Math.sin(angle) * rule.projectileSpeed,
      age: 0, life: rule.projectileLife ?? 4, radius: rule.radius, damage: rule.damage, type: enemy.enemyType });
  }

  // A bullet along the aim frozen at lock: it hits only if the hero is still on that line, so
  // moving after the warning still dodges it.
  hitscan(enemy, rule, hero) {
    const from = { x: enemy.x + enemy.aim.x * 8, y: enemy.y + (rule.muzzle ?? -4) + enemy.aim.y * 8 };
    const reach = rule.range * 1.5;
    const to = { x: from.x + enemy.aim.x * reach, y: from.y + enemy.aim.y * reach };
    const wall = this.obstruction(from, to, 0, enemy.enemyType);
    const t = segmentCircle(from, to, hero, HERO_DAMAGE.radius);
    // A shot on target reaches the hero; buildings stop only the ones that miss.
    const touchesHero = t !== null;
    const end = touchesHero ? t : wall?.t ?? 1;
    const point = { x: from.x + (to.x - from.x) * end, y: from.y + (to.y - from.y) * end };
    // Pistols (light damage) get a smaller muzzle flash than rifles and heavier guns.
    this.tracers.push({ x1: from.x, y1: from.y, x2: point.x, y2: point.y, age: 0,
      type: enemy.enemyType, speed: rule.tracerSpeed ?? TRACER_SPEED, length: rule.tracerLength ?? 10,
      life: Math.max(TRACER_LIFE, Math.hypot(point.x - from.x, point.y - from.y) / (rule.tracerSpeed ?? TRACER_SPEED)),
      flash: rule.damage < 5 ? 0.7 : 1, hit: touchesHero });
    if (touchesHero || wall) this.impacts.push({ ...point, age: 0, hero: touchesHero });
    if (touchesHero) this.damageHero(rule.damage);
  }

  updateProjectiles(dt, hero, previousHero) {
    const remaining = [];
    for (const shot of this.projectiles) {
      shot.age += dt;
      if (shot.age > (shot.life ?? 4) || this.defeated) continue;
      const from = { x: shot.x, y: shot.y };
      const to = { x: shot.x + shot.vx * dt, y: shot.y + shot.vy * dt };
      // Buildings stop a bolt only once it has missed: still closing on the hero, it flies on.
      const missed = (hero.x - from.x) * shot.vx + (hero.y - from.y) * shot.vy < 0;
      const wall = missed ? this.obstruction(from, to, shot.radius, shot.type) : null;
      // Relative sweeps catch both fast projectiles and the hero boosting across a bolt.
      const hit = segmentCircle({ x: from.x - previousHero.x, y: from.y - previousHero.y },
        { x: to.x - hero.x, y: to.y - hero.y }, { x: 0, y: 0 }, HERO_DAMAGE.radius + shot.radius);
      const touchesHero = hit !== null && (!wall || hit < wall.t);
      if (touchesHero || wall) {
        const t = touchesHero ? hit : wall.t;
        const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
        this.impacts.push({ ...point, age: 0, hero: touchesHero });
        if (touchesHero) this.damageHero(shot.damage);
      } else {
        shot.x = to.x;
        shot.y = to.y;
        remaining.push(shot);
      }
    }
    this.projectiles = this.defeated ? [] : remaining;
    if (this.impacts.length > 24) this.impacts.splice(0, this.impacts.length - 24);
  }

  damageHero(amount) {
    if (this.defeated || this.hero.invulnerable > 0 || amount <= 0) return false;
    // unlimited (dev panel): hits still land and flash, health stays.
    if (!this.unlimited) this.hero.health = Math.max(0, this.hero.health - amount);
    this.hero.invulnerable = HERO_DAMAGE.protection;
    this.hero.flash = 0.15;
    this.hero.sinceHit = 0;
    this.hero.hits++;
    return true;
  }
}
