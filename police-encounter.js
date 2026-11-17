import { HEAT_PHASES } from './enemy-director.js';
import { segmentCircle } from './hero-combat.js';
import { BOSS } from './enemy-system.js';
import { isWater, wrapX } from './planet.js';
import { sound } from './sound.js';

export const POLICE_ELITES = Object.freeze({
  pursuit: { enemyType: 'police-pursuit', radius: 9, maxHealth: 90, customArt: true },
  breacher: { enemyType: 'police-breacher', radius: 11, maxHealth: 135, customArt: true },
  rider: { enemyType: 'police-rider', radius: 7, maxHealth: 90, customArt: true, policeRider: true },
  // Level 5 elite: the flying cyborg, now an ordinary (if tough) enemy.
  marshal: { enemyType: 'sky-marshal', radius: 12, maxHealth: 700, customArt: true, knockbackScale: 0.8 },
  boss: { enemyType: 'bulwark', radius: 18, maxHealth: 3200, customArt: true, boss: true, knockbackScale: 0.35 },
});
// Level 2's boss: Rhino, the SWAT armoured command truck (enemy-system.js 'rhino').
export const SWAT_BOSS = Object.freeze({ enemyType: 'rhino', radius: 24, maxHealth: 4200, customArt: true, boss: true,
  knockbackScale: 0.15 });
// Each campaign phase's boss: its unit, its name on the health bar, and the cleared screen's heading.
// Level 3's final boss: Goliath, the army walker mech (enemy-system.js 'goliath').
export const ARMY_BOSS = Object.freeze({ enemyType: 'goliath', radius: 30, maxHealth: 5600, customArt: true, boss: true,
  knockbackScale: 0.1 });
export const BOSSES = Object.freeze({
  1: { unit: POLICE_ELITES.boss, name: 'Bulwark', cleared: 'Police Response Defeated' },
  2: { unit: SWAT_BOSS, name: 'Rhino', cleared: 'SWAT Response Defeated' },
  3: { unit: ARMY_BOSS, name: 'Goliath', cleared: 'Army Defeated' },
});

// After a boss falls the world runs at `scale` speed for `seconds` of real time, then the win panel.
export const SLOW_MO = Object.freeze({ scale: 0.3, seconds: 3 });

export class PoliceEncounter {
  constructor(scene) { this.scene = scene; this.reset(); }

  reset() {
    if (this.scene.policeWon) this.scene.controlsSuspended = false;
    if (this.boss) Object.assign(this.boss, { health: 0, detonated: true });
    this.boss = null;
    this.won = false;
    this.dying = false;
    this.deathTime = 0;
    this.hudBreak?.forEach(effect => effect?.cancel());
    this.hudBreak = null;
    if (this.scene.enemies) this.scene.enemies.retreat = false;
    this.timer = 0;
    this.bikeTimer = 3;
    this.scene.policeWon = false;
    if (this.hud) this.hud.hidden = true;
  }

  // The boss of the phase being played (Free Roam plays Police).
  get spec() { return BOSSES[this.scene.director?.unlockedPhase ?? 1] ?? BOSSES[1]; }
  get bossName() { return this.boss ? this.spec.name : ''; }

  spawn(kind, near = false) {
    const s = this.scene;
    if (kind === 'boss' || kind === 'rhino' || kind === 'goliath') return this.spawnBoss({ rhino: BOSSES[2], goliath: BOSSES[3] }[kind]);
    if (kind === 'interceptor') return this.spawnBike();
    const unit = POLICE_ELITES[kind];
    if (!unit || !s.canRespond()) return false;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = near ? s.position.x + side * 80 : s.offscreen(side);
    if (kind === 'breacher' && isWater(wrapX(x))) return false;
    const y = kind === 'pursuit' ? Math.min(s.position.y - 25, s.terrainAt(x) - 40)
      : kind === 'marshal' ? Math.min(s.position.y - 35, s.terrainAt(x) - 70) : s.terrainAt(x) - unit.radius;
    s.addUnit(unit, x, y, 0.4, kind === 'marshal' ? { bossMove: 0 } : {});
    s.director.dispatched();
    return true;
  }

  spawnBoss(spec = this.spec) {
    if (this.boss || this.won) return false;
    const s = this.scene;
    // The boss has one reserved response slot and enters even during a reinforcement lull.
    // It stomps in on the street and opens with a charge.
    const side = Math.random() < 0.5 ? -1 : 1;
    let x = s.position.x + side * 260;
    if (isWater(wrapX(x))) x = s.position.x - side * 260;
    const boss = this.boss = s.addUnit(spec.unit, x, s.terrainAt(x) - spec.unit.radius, 0.65, { bossMove: 0 });
    this.bossSpec = spec;
    this.setHudName(spec.name);
    // Every punch lands and pushes; every BOSS.poise-th (more while raging) staggers it.
    boss.poise = () => {
      boss.poiseHits = (boss.poiseHits ?? 0) + 1;
      if (boss.poiseHits < (boss.health < boss.maxHealth * 0.5 ? BOSS.ragePoise : BOSS.poise)) return true;
      boss.poiseHits = 0;
      return false;
    };
    return true;
  }

  spawnBike() {
    const s = this.scene;
    if (!s.sendCar('policebike')) return false;
    const life = s.dispatchLife;
    const car = life.cars.at(-1);
    const dir = car.lane === 0 ? -1 : 1;
    // Continue through the encounter instead of parking beside the patrol vans. The road end
    // still clamps the pass to dry land. Mark the seat occupied by the real rider actor.
    const pass = Math.max(600, Math.abs(s.offscreen(dir) - s.position.x) + 220);
    car.dispatch = Math.max(life.roadEnd(car.x, -1) + car.length,
      Math.min(life.roadEnd(car.x, 1) - car.length, s.position.x - life.shift + dir * pass));
    car.deployed = true;
    car.rider = s.addUnit(POLICE_ELITES.rider, car.x + life.shift, s.terrainAt(car.x + life.shift) - 16, 0.7,
      { rider: car, riderLife: life, casualtyIdentity: car.occupants[0] });
    return true;
  }

  stepBike(rider) {
    const car = rider.rider;
    const life = rider.riderLife;
    if (!life.cars.includes(car)) {
      Object.assign(rider, { health: 0, detonated: true });
      return;
    }
    if (rider.health <= 0 && !car.wreck) life.wreck(car, false, false);
    if (car.fall || car.wreck || car.held) {
      Object.assign(rider, { rider: null, enemyType: 'police', grounded: true, lifted: 'falling',
        carried: true, doomed: false, fallSpeed: 0, drift: (car.fall?.vx ?? car.speed * (car.lane === 0 ? -1 : 1)) * 0.3,
        angle: 0, tumble: 5, state: 'idle' });
      return;
    }
    const worldX = car.x + life.shift;
    const dir = car.lane === 0 ? -1 : 1;
    const beyondView = Math.abs(this.scene.offscreen(dir) - this.scene.position.x) + 120;
    if ((worldX - this.scene.position.x) * dir > beyondView) {
      // An offscreen drive-by leaves normally and frees a slot for another pass. No U-turns
      // or teleporting vehicles in view, and an escaping officer is not a casualty.
      life.cars = life.cars.filter(other => other !== car);
      Object.assign(rider, { health: 0, detonated: true, rider: null });
      return;
    }
    rider.x = car.x + life.shift;
    rider.y = this.scene.streetAt(rider.x) - 16;
    rider.homeX = rider.x;
    rider.homeY = rider.y;
  }

  step(dt) {
    const s = this.scene;
    if (!s.evilMode || this.won) return;
    if (this.dying) {
      // dt is slowed simulation time: SLOW_MO.seconds of real time, then victory.
      this.deathTime += dt;
      if (this.deathTime >= SLOW_MO.seconds * SLOW_MO.scale - 1e-9) this.won = true;
      return;
    }
    if (s.enemies.defeated) return;
    if (s.director.bossDue && BOSSES[s.director.unlockedPhase]) this.spawnBoss();
    if (this.boss) {
      // Keep the encounter with a hero flying across the map, without teleporting the boss.
      this.boss.homeX = s.position.x;
      this.boss.homeY = s.position.y;
      return;
    }
    if (s.director.phase !== 1) return;
    // Interceptor bikes run from level 2 on, on their own clock, so they show up often.
    if ((this.bikeTimer -= dt) <= 0) {
      this.bikeTimer = 0.5;
      if (s.responseCars('policebike').length < s.director.bikeTarget && this.spawn('interceptor')) this.bikeTimer = 2.5;
    }
    if (s.director.stars < 4 || (this.timer -= dt) > 0) return;
    this.timer = 0.5;
    const high = s.director.stars === s.director.levels;
    let pursuit = 0, breacher = 0, marshal = 0;
    for (const e of s.combat.enemies) if (e.health > 0) {
      if (e.enemyType === POLICE_ELITES.pursuit.enemyType) pursuit++;
      if (e.enemyType === POLICE_ELITES.breacher.enemyType) breacher++;
      if (e.enemyType === POLICE_ELITES.marshal.enemyType) marshal++;
    }
    // Level 5 opens with a Sky Marshal; a second joins from the level's 40% title.
    const kind = high && marshal < (s.director.fill >= 0.4 ? 2 : 1) ? 'marshal'
      : pursuit < (high ? 2 : 1) ? 'pursuit' : high && breacher < 2 ? 'breacher' : null;
    if (kind && this.spawn(kind)) this.timer = 4;
  }

  fireMissile(enemy, rule) {
    const s = this.scene;
    if (s.ordnance.length >= 40) return;
    const side = enemy.shots % 2 ? 1 : -1;
    // Bulwark's leave the back pods up and forward, fast, then curve hard onto the hero.
    const pods = enemy.enemyType === 'bulwark' || enemy.enemyType === 'goliath';
    const angle = pods ? -Math.PI / 2 + enemy.facing * (0.55 + side * 0.2) : Math.atan2(enemy.aim.y, enemy.aim.x) + side * 0.15;
    const speed = pods ? 340 : 280;
    s.ordnance.push({ kind: 'missile', bossMissile: true, owner: enemy.id,
      x: pods ? enemy.x - enemy.facing * (8 + side * 3) : enemy.x + enemy.aim.x * 20,
      y: enemy.y + (rule.missileY ?? 0) + (pods ? 0 : side * 7),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, speed, turn: pods ? 2.6 : 0.9,
      age: 0, life: 4, radius: 18, power: 0.35, damage: rule.damage });
  }

  // Rhino's roof mortar: a shell lobbed to land where the hero is heading, spread across the volley.
  fireMortar(enemy, rule) {
    const s = this.scene;
    if (s.ordnance.length >= 40) return;
    const flight = 1.15, gravity = 520;
    const spread = (enemy.shots % 2 ? 1 : -1) * Math.ceil(enemy.shots / 2) * 26;
    const tx = s.position.x + (s.velocity?.x ?? 0) * flight * 0.5 + spread, ty = s.position.y;
    const { x, y } = rule.roof;
    s.ordnance.push({ kind: 'shell', mortar: true, x, y, vx: (tx - x) / flight, vy: (ty - y) / flight - gravity * flight / 2,
      gravity, age: 0, life: 3, radius: 22, power: 0.4, damage: rule.damage });
  }

  // Goliath's shoulder cannon: a heavy shell along the frozen aim that carves what it hits.
  fireCannon(enemy, rule) {
    const s = this.scene;
    if (s.ordnance.length >= 40) return;
    const speed = 520, angle = enemy.cannonAngle;
    s.ordnance.push({ kind: 'shell', x: rule.muzzle.x, y: rule.muzzle.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      age: 0, life: 2, radius: 34, power: 1, damage: rule.damage });
  }

  // A punched-back missile hits the boss or a Sky Marshal it passes.
  reflectedHit(shot, fromX, fromY) {
    if (!shot.reflected) return false;
    const boss = this.scene.combat.enemies.find(e => e.health > 0 && (e.boss || e.enemyType === 'sky-marshal')
      && segmentCircle({ x: fromX, y: fromY }, shot, e, e.radius + 4) !== null);
    if (!boss) return false;
    const speed = Math.hypot(shot.vx, shot.vy) || 1;
    this.scene.combat.damage(boss, 260, { x: shot.vx / speed, y: shot.vy / speed }, 220, 'blast');
    shot.done = true;
    this.scene.enemies.impacts.push({ x: boss.x, y: boss.y, age: 0, kind: 'explosion', duration: 0.3, radius: 16 });
    return true;
  }

  onDefeat(enemy) {
    if (['police-pursuit', 'police-breacher', 'sky-marshal', 'bulwark'].includes(enemy.enemyType) || enemy.policeRider) this.fallDefeated(enemy);
    if (enemy !== this.boss) return;
    // Rhino blows up where it stands; the wreck stays.
    if (enemy.enemyType === 'rhino' || enemy.enemyType === 'goliath') {
      enemy.deathLanded = true;
      this.scene.enemies.impacts.push({ x: enemy.x, y: enemy.y, age: 0, kind: 'explosion', duration: 0.6, radius: 40 });
      sound.blast?.(1);
    }
    // Let the defeated cyborg visibly lose thrust and crash before the clean victory screen.
    // The hero can still steer and punch through this short aftermath.
    this.dying = true;
    this.deathTime = 0;
    this.scene.enemies.retreat = true;
    this.scene.enemies.projectiles = [];
    this.scene.ordnance = [];
    this.scene.enemies.hero.invulnerable = Math.max(this.scene.enemies.hero.invulnerable, 2.5);
    this.breakHud();
  }

  // The boss bar flashes, shakes and shatters into shards as the boss goes down.
  breakHud() {
    if (!this.hud?.animate || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.hudTitle.textContent = `${(this.bossSpec ?? this.spec).name.toUpperCase()} DEFEATED`;
    const easing = 'cubic-bezier(.18,.8,.25,1)';
    const at = (x, y, more = '') => `translate(calc(-50% + ${x}px),${y}px) ${more}`;
    this.hudBreak = [this.hud.animate([
      { transform: at(0, 0, 'scale(1)'), filter: 'brightness(1)', opacity: 1 },
      { transform: at(0, 0, 'scale(1.15)'), filter: 'brightness(3)', opacity: 1, offset: 0.06 },
      { transform: at(-10, 3, 'rotate(-2deg)'), filter: 'brightness(1.6)', offset: 0.12 },
      { transform: at(9, -3, 'rotate(2deg)'), offset: 0.18 },
      { transform: at(-6, 2, 'rotate(-1deg)'), offset: 0.24 },
      { transform: at(0, 0, 'scale(1.06)'), filter: 'brightness(1.2)', opacity: 1, offset: 0.3 },
      { transform: at(0, 0, 'scale(1.06)'), filter: 'brightness(1.2)', opacity: 1, offset: 0.62 },
      { transform: at(0, -10, 'scale(1.5, .05)'), filter: 'brightness(4)', opacity: 0 },
    ], { duration: 1500, easing, fill: 'forwards' })];
    this.shards.forEach((shard, i) => {
      const angle = (i / this.shards.length) * Math.PI * 2 + 0.3;
      this.hudBreak.push(shard.animate([
        { transform: 'translate(0,0) rotate(0)', opacity: 0 },
        { transform: 'translate(0,0) rotate(0)', opacity: 1, offset: 0.01 },
        { transform: `translate(${Math.cos(angle) * 260}px,${Math.sin(angle) * 120 + 80}px) rotate(${i % 2 ? 540 : -540}deg)`, opacity: 0 },
      ], { duration: 1100, delay: 900, easing, fill: 'both' }));
    });
  }

  fallDefeated(enemy) {
    if (enemy.eliteDeath) return;
    enemy.eliteDeath = true;
    if (enemy.lifted === 'falling') return;
    Object.assign(enemy, { lifted: 'falling', carried: true, grounded: false, doomed: false,
      fallSpeed: Math.min(0, enemy.vy), drift: enemy.vx + (enemy.flightVx ?? 0) * 0.3,
      angle: (enemy.elitePose?.lean ?? 0) * (enemy.facing || 1),
      tumble: (Math.sign(enemy.vx) || enemy.facing || 1) * (enemy.boss ? 4 : 7), state: 'down' });
  }

  finish() {
    const s = this.scene;
    if (!this.won || s.policeWon) return;
    s.policeWon = true;
    s.stopHeroCombat?.();
    sound.laser(false);
    sound.ram(false);
    s.throwing?.reset();
    s.enemies.projectiles = [];
    s.enemies.tracers = [];
    s.ordnance = [];
    s.controlsSuspended = true;
    if (s.defeatPanel) s.defeatPanel.hidden = true;
    this.syncHud();
    s.onBossCleared?.((this.bossSpec ?? this.spec).cleared);
  }

  createHud(parent) {
    this.hud = document.createElement('section');
    this.hud.className = 'police-boss-hud';
    this.hud.setAttribute('aria-label', 'Bulwark boss');
    const title = this.hudTitle = document.createElement('strong');
    title.textContent = 'BULWARK';
    this.health = document.createElement('progress');
    this.health.setAttribute('aria-label', 'Bulwark health');
    this.health.max = POLICE_ELITES.boss.maxHealth;
    this.healthText = document.createElement('span');
    // Shards of the bar for the shatter (breakHud); invisible until it plays.
    this.shards = Array.from({ length: 10 }, () => document.createElement('i'));
    for (const shard of this.shards) shard.className = 'boss-shard';
    this.hud.append(title, this.health, this.healthText, ...this.shards);
    this.hud.hidden = true;
    parent.append(this.hud);
  }

  syncHud() {
    sound.bossMusic(Boolean(this.boss) && !this.dying && !this.won);
    if (!this.hud) return;
    const hideBoss = !this.boss || this.won;
    if (this.hud.hidden !== hideBoss) this.hud.hidden = hideBoss;
    if (this.boss && !this.won) {
      if (this.health.max !== this.boss.maxHealth) this.health.max = this.boss.maxHealth;
      const health = Math.max(0, Math.ceil(this.boss.health));
      if (this.health.value !== health) this.health.value = health;
      const text = `${health} / ${this.boss.maxHealth}`;
      if (this.healthText.textContent !== text) this.healthText.textContent = text;
    }
  }

  setHudName(name) {
    if (!this.hud) return;
    this.hudTitle.textContent = name.toUpperCase();
    this.hud.setAttribute('aria-label', `${name} boss`);
    this.health.setAttribute('aria-label', `${name} health`);
  }

  destroy() { this.hud?.remove(); }
}
