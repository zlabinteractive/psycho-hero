import { sound } from './sound.js';
import { upgradeValue } from './shop.js';
export const COMBAT = Object.freeze({
  ramMinSpeed: 260,
  ramMinDamage: 45,
  ramMaxDamage: 100,
  ramFullDamageSpeed: 400,
  // Shop: up to 3x.
  get laserDamagePerSecond() { return 45 * upgradeValue('laserDamage'); },
  // Focus: an unbroken beam on one bot or dummy ramps from 1x to laserRampMax over laserRampTime seconds.
  laserRampMax: 3, laserRampTime: 2.5,
  punch: Object.freeze({
    damage: 75, knockback: 260, range: 82, cone: Math.PI / 4,
    maxDistance: 30, missDistance: 8, standOff: 6, contactPadding: 5, aimAssistPadding: 6,
    movementCone: Math.PI / 6, smallTargetRadius: 7, smallTargetDistance: 10,
    duration: 0.24, windup: 0.035, snap: 0.075, hold: 0.025, stepDuration: 0.075,
    chainTime: 0.21, hitStop: 0.032,
    engagementTime: 0.65, retentionCone: Math.PI * 0.4, switchMargin: Math.PI / 24,
  }),
});

// RAM and the laser are the big spenders (per second held). A punch or a grab costs a sliver, under
// 10% of a second of either, never holds off recharge, and is never refused: punching flow is free.
// Run dry, RAM and the laser stay locked until the meter refills to `rearm`.
export const HERO_POWER = Object.freeze({
  // Shop: max 100 to 200; RAM and laser last up to 3x and 2x as long.
  get max() { return upgradeValue('power'); },
  get ramDrainRate() { return 25 / upgradeValue('ramTime'); },
  get laserDrainRate() { return 21.25 / upgradeValue('laserTime'); },
  ramSpeed: 370.5, rearm: 25,
  // Continuous plowing: strain is the px RAM has plowed through buildings without a break (cleared
  // after ramStrainReset s outside). Each px plowed costs extra power, rising from 0 to ramPlowCost
  // over ramStrainPx of strain, so short smashes stay free and one long plow runs dry ~600 px in
  // (base bar, about 1480 px in open air). The RAM duration upgrade divides the cost.
  get ramPlowCost() { return 0.2 / upgradeValue('ramTime'); },
  ramStrainPx: 600, ramStrainReset: 0.3,
  punchCost: 1.5, grabCost: 2,
  rechargeRate: 24, rechargeDelay: 0.65,
});

export const COMBO_TIMEOUT = 5;
const COMBO_LASER_INTERVAL = 0.25;

// Presentation only: consecutive damaging hits never multiply damage, chaos or heat.
export class ComboCounter {
  constructor() { this.reset(); }

  reset(enabled = true) {
    this.enabled = enabled;
    this.count = 0;
    this.remaining = 0;
    this.time = 0;
    this.laserHits = new WeakMap();
  }

  hit(target, kind, enemy = Boolean(target.enemyType)) {
    if (!this.enabled || !enemy || target.destructible || kind === 'self-destruct') return;
    this.remaining = COMBO_TIMEOUT;
    // A held beam keeps the window alive on every damage tick, but earns only
    // four hits a second per enemy at any simulation or render frame rate.
    if (kind === 'laser') {
      if (this.time - (this.laserHits.get(target) ?? -Infinity) < COMBO_LASER_INTERVAL - 1e-9) return;
      this.laserHits.set(target, this.time);
    }
    this.count++;
  }

  update(dt) {
    this.time += dt;
    if (!this.count) return;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 1e-9) this.reset(this.enabled);
  }
}

export class HeroPower {
  constructor() { this.reset(); }

  reset() {
    this.meter = HERO_POWER.max;
    this.ramActive = false;
    this.ramSource = null;
    this.exhausted = false;
    this.drained = false;
    this.strain = 0;
    this.strainClear = 0;
    this.rechargeDelay = 0;
  }

  get ramReady() { return !this.exhausted && !this.drained && this.meter > 1e-8; }

  activateRam(source) {
    if (this.ramSource !== null) return false;
    this.ramSource = source;
    if (!this.ramReady) {
      this.exhausted = true;
      return false;
    }
    this.ramActive = true;
    this.rechargeDelay = HERO_POWER.rechargeDelay;
    return true;
  }

  releaseRam(source) {
    if (this.ramSource !== source) return;
    this.cancelRam();
  }

  cancelRam() {
    this.ramActive = false;
    this.ramSource = null;
    this.exhausted = false;
  }

  // delay: hold off recharge, as sustained powers (the laser) do.
  spend(amount, delay = false) {
    this.meter = Math.max(0, this.meter - amount);
    if (this.meter <= 0) this.drained = true;
    if (delay) this.rechargeDelay = HERO_POWER.rechargeDelay;
  }

  // px: distance RAM plowed through buildings this step (CityDestruction.ram).
  plow(px, dt) {
    if (px > 0) {
      this.strain += px;
      this.strainClear = 0;
      this.spend(px * HERO_POWER.ramPlowCost * Math.min(1, this.strain / HERO_POWER.ramStrainPx));
    } else if ((this.strainClear += dt) > HERO_POWER.ramStrainReset) this.strain = 0;
  }

  update(dt) {
    let activeTime = 0;
    if (this.ramActive) {
      activeTime = Math.min(dt, this.meter / HERO_POWER.ramDrainRate);
      this.meter = Math.max(0, this.meter - activeTime * HERO_POWER.ramDrainRate);
      this.rechargeDelay = HERO_POWER.rechargeDelay;
      if (this.meter < 1e-8) {
        this.meter = 0;
        this.drained = true;
        this.ramActive = false;
        // Releasing re-arms RAM; recharge must not cause repeated on/off activation while held.
        this.exhausted = true;
      }
    }
    const idleTime = dt - activeTime;
    const delayed = Math.min(idleTime, this.rechargeDelay);
    this.rechargeDelay = Math.max(0, this.rechargeDelay - idleTime);
    this.meter = Math.min(HERO_POWER.max, this.meter + (idleTime - delayed) * HERO_POWER.rechargeRate);
    if (this.meter >= HERO_POWER.rearm) this.drained = false;
  }
}

export const TARGETS = [
  { x: 285, y: 210, anchored: false },
  { x: 430, y: 210, anchored: false, heavy: true, knockbackScale: 0.65 },
  { x: 360, y: 125, anchored: false },
  { x: 350, y: 286, radius: 14, anchored: false, heavy: true, knockbackScale: 0.65, grounded: true },
];


export const DESTRUCTIBLES = [
  ...[220, 246, 272].map(x => ({
    x, y: 290, width: 18, height: 20, maxHealth: 40, material: 'wood',
  })),
  ...Array.from({ length: 96 }, (_, i) => ({
    x: 514 + i % 8 * 8, y: 208 + Math.floor(i / 8) * 8,
    width: 8, height: 8, maxHealth: 55, material: 'stone',
  })),
];

// Laser focus: damage multiplier after `time` seconds on one target, rising linearly to `max`.
export function laserFocus(time, max, rampTime) {
  return 1 + (max - 1) * Math.min(1, time / rampTime);
}

// Integral of laserFocus over [0, time]: damage-seconds, so ramped damage is frame-rate independent.
export function laserFocusIntegral(time, max, rampTime) {
  const ramp = Math.min(time, rampTime);
  return time + (max - 1) * (ramp * ramp / (2 * rampTime) + Math.max(0, time - rampTime));
}

// Ray/box entry, shared by attacks and swept movement against solid props.
// Runs for every prop on every 120 Hz step, so the axes are unrolled and a miss allocates nothing.
export function segmentBox(from, to, box, padding = 0) {
  let entry = -Infinity;
  let exit = Infinity;
  let normalX = 0;
  let normalY = 0;
  const halfW = box.width / 2 + padding;
  const dx = to.x - from.x;
  if (Math.abs(dx) < 1e-10) {
    if (from.x < box.x - halfW || from.x > box.x + halfW) return null;
  } else {
    const a = (box.x - halfW - from.x) / dx;
    const b = (box.x + halfW - from.x) / dx;
    entry = Math.min(a, b);
    normalX = dx > 0 ? -1 : 1;
    exit = Math.max(a, b);
  }
  const halfH = box.height / 2 + padding;
  const dy = to.y - from.y;
  if (Math.abs(dy) < 1e-10) {
    if (from.y < box.y - halfH || from.y > box.y + halfH) return null;
  } else {
    const a = (box.y - halfH - from.y) / dy;
    const b = (box.y + halfH - from.y) / dy;
    const near = Math.min(a, b);
    if (near > entry) {
      entry = near;
      normalX = 0;
      normalY = dy > 0 ? -1 : 1;
    }
    exit = Math.min(exit, Math.max(a, b));
    if (entry > exit) return null;
  }
  return exit < 0 || entry > 1 ? null : { t: Math.max(0, entry), entry, normal: { x: normalX, y: normalY } };
}

function contact(from, to, target, padding = 0) {
  // Shaped targets (city buildings) trace their real outline instead of their bounding box.
  // target may be a copy moved to the origin (RAM sweeps): pass it so the trace can map back.
  if (target.trace) return target.trace(from, to, padding, target);
  return target.destructible
    ? segmentBox(from, to, target, padding)?.t ?? null
    : segmentCircle(from, to, target, target.radius + padding);
}

// First intersection along a swept segment. Also handles an overlapping start.
export function segmentCircle(from, to, center, radius) {
  const x = from.x - center.x;
  const y = from.y - center.y;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-12) return null;
  const b = x * dx + y * dy;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

export class CombatArena {
  constructor(definitions = TARGETS, groundY = 300, propDefinitions = [], enemyDefinitions = []) {
    this.definitions = definitions;
    this.propDefinitions = propDefinitions;
    this.enemyDefinitions = enemyDefinitions;
    // A number keeps flat ground; a function of x gives terrain.
    this.groundAt = typeof groundY === 'function' ? groundY : () => groundY;
    this.impactId = 0;
    this.reset();
  }

  reset() {
    this.combo = new ComboCounter();
    const create = this.create = (definition, id) => ({
      id, radius: 11, maxHealth: 100, ...definition,
      homeX: definition.x, homeY: definition.y,
      previousX: definition.x, previousY: definition.y,
      health: definition.maxHealth ?? 100,
      vx: 0, vy: 0, flash: 0, reaction: 0, recoil: 0, deathAge: 0,
      laserFeedback: 0, laserDamage: 0, lastPunch: null,
    });
    this.targets = this.definitions.map(create);
    this.enemies = this.enemyDefinitions.map((definition, id) => create({
      ...definition, anchored: false,
    }, `enemy-${id}`));
    this.props = this.propDefinitions.map((definition, id) => create({
      ...definition, destructible: true, anchored: true, radius: definition.height / 2,
    }, `prop-${id}`));
    this.damageables = [...this.targets, ...this.props, ...this.enemies];
    this.impacts = [];
    this.debris = [];
    this.groundPounds = [];
    this.ramContacts = new Set();
    this.defeated = 0;
    this.enemiesDefeated = 0;
    this.destroyedProps = 0;
    this.consumedPunchId = null;
    this.laserFocus = { target: null, time: 0, multiplier: 1 };
  }

  // An enemy arriving mid-fight (the enemy lab's police, out of their cars). Returns it.
  addEnemy(definition) {
    const enemy = this.create({ ...definition, anchored: false }, `enemy-${this.enemies.length}`);
    this.enemies.push(enemy);
    this.damageables.push(enemy);
    return enemy;
  }

  update(dt) {
    this.combo.update(dt);
    for (const wave of this.groundPounds) wave.age += dt;
    this.groundPounds = this.groundPounds.filter(wave => wave.age < 0.7);
    for (const impact of this.impacts) impact.age += dt;
    this.impacts = this.impacts.filter(impact => impact.age < 0.65);
    for (const piece of this.debris) {
      piece.age += dt;
      piece.vy += 220 * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      const floor = this.groundAt(piece.x);
      if (piece.y > floor - piece.size) {
        piece.y = floor - piece.size;
        piece.vy = -Math.abs(piece.vy) * 0.3;
        piece.vx *= 0.65;
      }
    }
    this.debris = this.debris.filter(piece => piece.age < 1.2);
    for (const target of this.damageables) {
      target.previousX = target.x;
      target.previousY = target.y;
      target.flash = Math.max(0, target.flash - dt);
      target.reaction = Math.max(0, target.reaction - dt * 2.5);
      target.laserFeedback = Math.max(0, target.laserFeedback - dt);
      if (target.health <= 0) target.deathAge += dt;
      // EnemyThrow places a carried bot itself.
      if (target.carried) continue;
      if (target.grounded) target.vy += 280 * dt;
      // Exponential drag makes knockback travel independent of render rate.
      const drag = 5;
      const decay = Math.exp(-drag * dt);
      target.x += target.vx * (1 - decay) / drag;
      target.y += target.vy * (1 - decay) / drag;
      target.vx *= decay;
      target.vy *= decay;
      const floor = this.groundAt(target.x);
      if (target.y > floor - target.radius) {
        target.y = floor - target.radius;
        target.vy = Math.min(0, target.vy);
      }
    }
  }

  damage(target, amount, direction, knockback, kind, point = target) {
    // A carried bot (grabbed or thrown, enemy-throw.js) is out of play until it explodes.
    if (target.health <= 0 || amount <= 0 || target.carried) return;
    if (target.scenery) {
      // Scenery (city buildings) breaks by shape, not health: onSceneryHit carves it.
      this.onSceneryHit?.(target, amount, direction, kind, point);
      if (kind === 'laser') return;
      this.impacts.push({
        id: ++this.impactId, x: point.x, y: point.y, dx: direction.x, dy: direction.y,
        kind, fatal: false, material: target.material, damage: 0, silent: true, age: 0,
      });
      if (this.impacts.length > 48) this.impacts.shift();
      return;
    }
    // A guarded enemy (the enemy lab's riot shield) may soak the hit: guard returns true if it did.
    if (target.guard?.(direction, kind, knockback)) {
      target.flash = 0.06;
      this.impacts.push({ id: ++this.impactId, x: point.x, y: point.y, dx: direction.x, dy: direction.y,
        kind, fatal: false, material: 'metal', damage: 0, age: 0 });
      if (this.impacts.length > 48) this.impacts.shift();
      return;
    }
    if (kind === 'laser') amount *= target.laserDamageMultiplier ?? 1;
    const dealt = Math.min(target.health, amount);
    target.health = Math.max(0, target.health - amount);
    target.lastDamageKind = kind;
    this.combo.hit(target, kind);
    // poise (bosses): returns true while it still holds, so the hit pushes without staggering.
    if (target.enemyType && kind !== 'laser' && !target.poise?.()) {
      target.stagger = Math.max(target.stagger ?? 0, 0.55);
    }
    if (!target.anchored) {
      const impulse = knockback * (target.knockbackScale ?? 1);
      target.vx += direction.x * impulse;
      target.vy += direction.y * impulse;
    }
    const fatal = target.health === 0;
    if (fatal) {
      this.onDefeat?.(target);
      if (target.destructible) {
        this.destroyedProps++;
        this.breakProp(target, direction);
      } else if (target.enemyType) this.enemiesDefeated++;
      else this.defeated++;
    }
    if (kind === 'laser') target.laserDamage += dealt;
    if (kind === 'laser' && target.laserFeedback > 0 && !fatal) return;
    target.flash = kind === 'laser' ? 0.045 : 0.09;
    target.reaction = kind === 'laser' ? 0.3 : target.heavy ? 1.15 : 1;
    target.recoil = direction.x || direction.y || 1;
    if (kind === 'laser') target.laserFeedback = 0.18;
    this.impacts.push({
      id: ++this.impactId, x: point.x, y: point.y, dx: direction.x, dy: direction.y,
      kind, fatal, material: target.material,
      damage: kind === 'laser' ? target.laserDamage : dealt, age: 0,
    });
    if (kind === 'laser') target.laserDamage = 0;
    if (this.impacts.length > 48) this.impacts.shift();
  }

  ram(from, to, velocity, ramActive) {
    const speed = Math.hypot(velocity.x, velocity.y);
    const contacts = [];
    for (const target of this.damageables) {
      const alreadyContact = this.ramContacts.has(target.id);
      const touching = contact(to, to, target, 12) !== null;
      if (!touching) this.ramContacts.delete(target.id);
      // Sweep in the target's frame, as it moved too: shift the start by its motion instead of
      // copying the whole target to the origin (this runs for every target on every step).
      const fraction = contact(
        { x: from.x - target.previousX + target.x, y: from.y - target.previousY + target.y }, to, target, 10);
      if (fraction !== null && target.health > 0 && !target.carried) {
        contacts.push({ target, fraction, touching, alreadyContact });
      }
    }
    if (!ramActive || speed < COMBAT.ramMinSpeed) return;
    contacts.sort((a, b) => a.fraction - b.fraction);
    for (const { target, fraction, touching, alreadyContact } of contacts) {
      if (!alreadyContact) {
        const power = Math.min(1, (speed - COMBAT.ramMinSpeed)
          / (COMBAT.ramFullDamageSpeed - COMBAT.ramMinSpeed));
        const amount = Math.round(COMBAT.ramMinDamage
          + (COMBAT.ramMaxDamage - COMBAT.ramMinDamage) * power);
        this.damage(target, amount, { x: velocity.x / speed, y: velocity.y / speed },
          200 + power * 160, 'ram', {
            x: from.x + (to.x - from.x) * fraction,
            y: from.y + (to.y - from.y) * fraction,
          });
        if (touching) this.ramContacts.add(target.id);
        sound.ramHit();
      }
      // An intact solid stops the ram before objects behind it can take damage. Scenery such as
      // city buildings is not solid, so a ram can smash on through a whole street.
      if (target.destructible && !target.scenery && target.health > 0) break;
    }
  }

  punch({ id, angle, from, to, aimed = null }) {
    if (this.consumedPunchId === id) return null;
    // Buildings stand behind the street: a punch thrown at someone in front of one passes the wall
    // the hand starts inside and lands on them.
    const pastScenery = aimed && !aimed.scenery && aimed.health > 0;
    let nearest = null;
    for (const target of this.damageables) {
      if (target.health <= 0 || target.carried || target.lastPunch === id) continue;
      if (pastScenery && target.scenery) continue;
      // Forgive a near miss on the selected opponent without redirecting the
      // hero's movement or widening punches against the rest of a crowd/cover.
      const padding = COMBAT.punch.contactPadding
        + (target === aimed && !target.destructible ? COMBAT.punch.aimAssistPadding : 0);
      const t = contact(from, to, target, padding);
      if (t !== null && (!nearest || t < nearest.t
        || t === nearest.t && target.destructible && !nearest.target.destructible)) {
        nearest = { target, t };
      }
    }
    if (!nearest) return null;
    const { target, t } = nearest;
    const point = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    this.consumedPunchId = id;
    target.lastPunch = id;
    this.damage(target, COMBAT.punch.damage,
      { x: Math.cos(angle), y: Math.sin(angle) }, COMBAT.punch.knockback, 'punch', point);
    return { target, point };
  }

  isPunchTargetValid(origin, target) {
    if (!target || target.health <= 0 || target.destructible || target.carried
      || !this.damageables.includes(target)) return false;
    const distance = Math.hypot(target.x - origin.x, target.y - origin.y);
    return distance >= 1 && distance <= COMBAT.punch.range
      && !this.props.some(prop => prop.health > 0 && !prop.scenery && segmentBox(origin, target, prop));
  }

  findPunchTarget(origin, direction, { preferredTarget = null, explicitAim = false, aimPoint = null } = {}) {
    const angle = Math.atan2(direction.y, direction.x);
    let best = null;
    let preferred = null;
    let pointed = null;
    // Any non-prop damageable, including ones added after reset (such as meteors), can be acquired.
    for (const target of this.damageables) {
      if (!this.isPunchTargetValid(origin, target)) continue;
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const distance = Math.hypot(dx, dy);
      const offset = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle),
        Math.cos(Math.atan2(dy, dx) - angle));
      const alignment = Math.abs(offset);
      if (target === preferredTarget && alignment <= COMBAT.punch.retentionCone) {
        preferred = { target, alignment };
      }
      if (alignment > COMBAT.punch.cone) continue;
      // Direction carries more intent than proximity; distance breaks close angular ties.
      const score = alignment / COMBAT.punch.cone + distance / COMBAT.punch.range * 0.25;
      if (!best || score < best.score) best = { score, target, alignment };
      if (aimPoint) {
        const cursorDistance = Math.hypot(aimPoint.x - target.x, aimPoint.y - target.y);
        if (cursorDistance <= target.radius + COMBAT.punch.contactPadding
          && (!pointed || cursorDistance < pointed.distance)) pointed = { target, distance: cursorDistance };
      }
    }
    if (pointed) return pointed.target;
    if (preferred) {
      if (!explicitAim) return preferred.target;
      if (preferred.alignment <= COMBAT.punch.cone
        && (!best || best.alignment + COMBAT.punch.switchMargin >= preferred.alignment)) return preferred.target;
    }
    return best?.target ?? null;
  }

  groundPound(x, speed, ramActive) {
    if (!ramActive || speed < COMBAT.ramMinSpeed) return false;
    const power = Math.min(1, (speed - COMBAT.ramMinSpeed)
      / (COMBAT.ramFullDamageSpeed - COMBAT.ramMinSpeed));
    const radius = (95 + power * 30) * upgradeValue('landing');
    const groundY = this.groundAt(x);
    this.groundPounds.push({ x, y: groundY, radius, power, age: 0 });
    if (this.groundPounds.length > 8) this.groundPounds.shift();
    for (const target of this.damageables) {
      const dx = target.x - x;
      const dy = target.y - groundY;
      const distance = target.destructible
        ? Math.hypot(Math.max(0, Math.abs(dx) - target.width / 2),
          Math.max(0, Math.abs(dy) - target.height / 2)) : Math.hypot(dx, dy);
      if (target.health <= 0 || target.carried || distance > radius) continue;
      const angle = Math.atan2(Math.min(-25, dy), dx);
      const strength = 1 - 0.65 * distance / radius;
      this.damage(target, Math.round((45 + power * 55) * strength),
        { x: Math.cos(angle), y: Math.sin(angle) }, (160 + power * 160) * strength,
        'groundpound');
    }
    return true;
  }

  traceLaser(from, to) {
    let nearest = null;
    for (const target of this.damageables) {
      if (target.health <= 0 || target.carried) continue;
      const t = contact(from, to, target, target.laserHitPadding ?? 0);
      if (t !== null && (!nearest || t < nearest.t)) nearest = { t, target };
    }
    return nearest;
  }

  // First live target a moving body (a thrown bot) touches along from→to: { target, t } or null.
  // padding(target) widens each target by the body's own size.
  sweep(from, to, padding = () => 0, eligible = () => true) {
    let nearest = null;
    for (const target of this.damageables) {
      if (target.health <= 0 || target.carried || !eligible(target)) continue;
      const t = contact(from, to, target, padding(target));
      if (t !== null && (!nearest || t < nearest.t)) nearest = { t, target };
    }
    return nearest;
  }

  laser(dt, beam) {
    // Focus builds while one continuous beam stays on the same bot or dummy. Losing sight of it,
    // switching target, or the beam ending (released, or out of power) starts it over. Props and
    // buildings never build focus: they have their own heat rules.
    const target = beam?.hitsTarget ?? null;
    const focusable = Boolean(target) && !target.destructible;
    const { laserRampMax: max, laserRampTime: rampTime } = COMBAT;
    if (!focusable || this.laserFocus.target !== target) {
      this.laserFocus = { target: focusable ? target : null, time: 0, multiplier: 1 };
    }
    if (!target) return;
    let scale = 1;
    if (focusable && dt > 0) {
      const focus = this.laserFocus;
      const before = laserFocusIntegral(focus.time, max, rampTime);
      focus.time += dt;
      scale = (laserFocusIntegral(focus.time, max, rampTime) - before) / dt;
      focus.multiplier = laserFocus(focus.time, max, rampTime);
    }
    const dx = beam.endX - beam.x;
    const dy = beam.endY - beam.y;
    const length = Math.hypot(dx, dy) || 1;
    this.damage(target, COMBAT.laserDamagePerSecond * scale * dt,
      { x: dx / length, y: dy / length }, 0, 'laser', { x: beam.endX, y: beam.endY });
  }

  breakProp(prop, direction) {
    for (let i = 0; i < 10; i++) {
      const column = i % 5;
      this.debris.push({
        x: prop.x + (column - 2) * prop.width / 6,
        y: prop.y + (Math.floor(i / 5) - 0.5) * prop.height / 2,
        vx: (column - 2) * 25 + direction.x * 80,
        vy: -55 - i % 3 * 22 + Math.min(0, direction.y) * 70,
        size: i % 3 + 1, age: 0, material: prop.material,
      });
    }
    // Debris is cosmetic and bounded even when an entire wall breaks at once.
    if (this.debris.length > 120) this.debris.splice(0, this.debris.length - 120);
  }

  resolveSolids(from, to, velocity, halfSize = 10) {
    const current = { x: from.x, y: from.y };
    const remaining = { x: to.x - from.x, y: to.y - from.y };
    let collided = false;
    for (let iteration = 0; iteration < 3; iteration++) {
      const destination = { x: current.x + remaining.x, y: current.y + remaining.y };
      let nearest = null;
      for (const prop of this.props) {
        if (prop.health <= 0 || prop.scenery) continue;
        const hit = segmentBox(current, destination, prop, halfSize);
        if (!hit || hit.entry < -1e-8
          || remaining.x * hit.normal.x + remaining.y * hit.normal.y >= 0) continue;
        if (!nearest || hit.t < nearest.t) nearest = hit;
      }
      if (!nearest) {
        current.x = destination.x;
        current.y = destination.y;
        break;
      }
      collided = true;
      for (const axis of ['x', 'y']) {
        current[axis] += remaining[axis] * nearest.t + nearest.normal[axis] * 0.001;
        remaining[axis] *= 1 - nearest.t;
        if (nearest.normal[axis]) {
          remaining[axis] = 0;
          velocity[axis] = 0;
        }
      }
    }
    to.x = current.x;
    to.y = current.y;
    return collided;
  }
}
