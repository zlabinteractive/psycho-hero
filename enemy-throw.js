import { ENEMY_RULES } from './enemy-system.js';

// Finishing move: a bot worn down to a fifth of its health can be grabbed, hoisted and hurled. The
// thrown bot explodes on whatever it hits, and bots that blast kills blow up in turn, so a throw into
// a crowd chains. Logic only: ThrowArtwork draws it and the scene turns events into feedback.
export const THROW = Object.freeze({
  threshold: 0.2,
  // Grab reach from the hero's centre to the bot's edge: generous, so grabbing is never fiddly.
  reach: 56,
  yank: 0.12, carry: 3, windup: 0.08,
  // The windup pulls a load at most `swing` px back from overhead, and the release puts it at most
  // twice that ahead: a bot or a car goes right behind the shoulder and out in front, while a
  // tower-sized load only rocks back, instead of leaping its own width through the hero.
  swing: 26,
  // The hands hold a load `grip` px above the hero's centre, unless the scene sets it from the rig.
  grip: 9, flightRock: 0.35,
  // Seconds the hero stays upright after a throw, still travelling.
  stance: 0.5,
  // Seconds a stretched-out hero takes to stand up before the swing starts.
  settle: 0.2,
  // A held object rocks against the hero's motion: `sway` radians at `swaySpeed` px/s, and tips
  // `tip` radians nose-up as it is snatched off the road and back as the throw winds up.
  sway: 0.3, swaySpeed: 200, tip: 0.4,
  // A line drive that only starts to drop after `hang` seconds, then skids along the ground.
  speed: 430, momentum: 0.5, hang: 0.3, gravity: 260, skidDrag: 1.4, life: 1.4,
  recoil: 80,
  // Blast damage grows with the thrown bot's weight (max health). A throw that hits no bot (ground,
  // wall, timeout) still blows up at `miss` power, so a whiff is never wasted.
  blastRadius: 40, blastDamage: 55, weightDamage: 0.6, directBonus: 1.5, edgeDamage: 0.4,
  knockback: 330, miss: 0.6, bossDamage: 0.5,
  // A `thud` body (a person, a piece of masonry) does not explode: it hits what is within thudReach
  // px of it for its own max health, and knocks it back. A `soft` one (a person) marks no building.
  thudReach: 6,
  // A thrown kamikaze still carries its charge: a bigger, harder blast.
  volatile: 1.35,
  // Chain reactions: each generation is weaker, and one throw can set off at most chainLimit more.
  chainDelay: 0.11, chainStagger: 0.05, chainFalloff: 0.75, chainDepth: 4, chainLimit: 10,
  maxPending: 24, slowmoAt: 3,
});

// How much lift a bot needs. Elites weigh one class more; bosses and armour never lift.
export const WEIGHT_CLASS = Object.freeze({
  swarm: 1, drone: 1, 'flying-melee': 1, kamikaze: 1, soldier: 1, police: 1, 'police-sniper': 1,
  'police-pursuit': 1, 'police-breacher': 2, 'police-rider': 1, 'police-heli-sniper': 1,
  gunner: 2, sniper: 2, mortar: 2, jet: 2, shield: 2, 'ground-melee': 2,
  tank: 3, gunship: 3, carrier: 3,
});

// The upgrade path. Each tier lifts one more weight class; a bot above the hero's lift never shows
// a grab marker and cannot be grabbed, so only throwable bots ever read as throwable. Whatever
// awards upgrades (the combat lab's throw kills, a run's upgrade picks) just sets the tier.
// `kills`: blast kills the combat lab asks for before awarding the tier.
export const GRAB_TIERS = Object.freeze([
  { name: 'LOCKED', lift: 0, unlocks: '', kills: 0 },
  { name: 'GRAPPLE', lift: 1, unlocks: 'small flyers and troopers', kills: 0 },
  { name: 'HEAVY LIFTER', lift: 2, unlocks: 'gunners and brawlers', kills: 4 },
  { name: 'TITAN GRIP', lift: 3, unlocks: 'tanks, gunships and carriers', kills: 10 },
]);
export const MAX_GRAB_TIER = GRAB_TIERS.length - 1;

// What the hero can lift off the street, smallest first: a second path beside the bot tiers. A
// body's `size` is its index here, and the hero lifts every size up to EnemyThrow.size. A new kind
// of object slots in by size.
export const LIFT_SIZES = Object.freeze([
  { name: 'NOTHING', unlocks: '' },
  { name: 'PEOPLE', unlocks: 'people' },
  { name: 'CARS', unlocks: 'cars, taxis, pickups, tractors and small boats' },
  { name: 'BUSES', unlocks: 'buses, trucks, camper vans, yachts and tugs' },
  { name: 'LIGHT AIRCRAFT', unlocks: 'helicopters and light planes' },
  { name: 'BUILDING PIECES', unlocks: 'broken pieces of buildings, trawlers and cutters' },
  { name: 'AIRLINERS', unlocks: 'airliners and tall ships' },
  { name: 'JUMBO JETS', unlocks: 'jumbo jets and the Beluga' },
]);
// LIFT_SIZES indexes by kind, for the code that makes the bodies.
export const LIFT = Object.freeze({ person: 1, car: 2, bus: 3, lightAircraft: 4, rubble: 5, airliner: 6, giant: 7 });
export const MAX_LIFT_SIZE = LIFT_SIZES.length - 1;

export function weightClass(enemy) {
  return (WEIGHT_CLASS[enemy.enemyType] ?? 3) + (enemy.elite ? 1 : 0);
}

// Worn down far enough to grab, whatever it weighs.
export function isWeakened(enemy) {
  const rule = ENEMY_RULES[enemy.enemyType];
  // Street units (police) are lifted like people, through the scene's lift sources, not here.
  return Boolean(rule) && !rule.street && rule.attack !== 'boss' && rule.attack !== 'part' && !enemy.boss && !enemy.part
    && enemy.health > 0 && !enemy.carried && !enemy.grabSpent
    && enemy.health <= enemy.maxHealth * THROW.threshold;
}

// liftClass: the heaviest weight class the hero can lift (0 = grabbing still locked).
export function canGrab(enemy, liftClass = Infinity) {
  return isWeakened(enemy) && weightClass(enemy) <= liftClass;
}

const unit = (x, y) => {
  const length = Math.hypot(x, y);
  return length > 1e-6 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
};
const ease = t => 1 - (1 - t) ** 3;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
// The point up to `max` px from `from` on the way to `to`.
function toward(from, to, max) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const k = distance > max ? max / distance : 1;
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}
// Half a body's height: where it rests on the ground or in the hand. Bots are round.
const half = body => body.half ?? body.radius;
// From a body's centre down to where the hands take it (a car's chassis, above its wheels).
const hold = body => body.hold ?? half(body);

export class EnemyThrow {
  // bounds { left, right, ceiling }: a throw leaving them explodes at the edge.
  constructor(arena, bounds = null) {
    this.arena = arena;
    this.bounds = bounds;
    // Lift everything at base power until a scene sets a tier.
    this.tier = MAX_GRAB_TIER;
    this.power = 1;
    // Things other than bots the hero can lift (street cars, city-life.js): a function
    // (hero, reach, size) => body or null. A body is { object: true, x, y, radius, half, size, distance, thud?, soft?,
    // maxHealth, spinRate, hold?, grabbed(hero), dropped(), burst(), gone() }. EnemyThrow moves it like a held or
    // thrown bot; its owner draws it there and takes it back when it is dropped or bursts.
    // A bot in reach is always taken first, and a thrown object's kills never chain: objects open
    // a fight, weakened bots finish it.
    this.objects = null;
    // The largest LIFT_SIZES index the hero lifts; the scene sets it.
    this.size = MAX_LIFT_SIZE;
    // Mark things in reach that are too heavy yet (an upgrade lifts them); the scene turns it off
    // once the player has seen the Shop tip.
    this.showLocked = false;
    // How far above the hero's centre the hands hold a load; the scene scales it with the hero.
    this.grip = THROW.grip;
    // Which way the load sits from the hero, as a unit vector: overhead, or out from the hero's
    // back in stretched-out flight. The scene sets it.
    this.up = { x: 0, y: -1 };
    // Radians a held object pitches with the hero's body in flight; the scene sets it.
    this.lean = 0;
    // Seconds a throw waits before its swing, while the hero stands up; the scene sets it.
    this.settle = 0;
    // A thrown object this many px from the hero, on either axis, is taken away unseen. The scene
    // sets it from the camera; Infinity keeps every object flying until it hits something.
    this.range = Infinity;
    // How much of THROW.sway a held object rocks by: less while the hero is stretched out under
    // it, where a rocking car would dip into the body.
    this.rock = 1;
    this.reset();
  }

  get tier() { return this._tier; }
  set tier(value) { this._tier = clamp(Math.round(value), 0, MAX_GRAB_TIER); }
  get liftClass() { return GRAB_TIERS[this._tier].lift; }

  canGrab(enemy) {
    return canGrab(enemy, this.liftClass);
  }

  reset() {
    // Held and flying objects go back to their owner.
    for (const item of [this.held, ...this.flights ?? []]) if (item?.enemy.object) this.release(item.enemy);
    this.held = null;
    this.flights = [];
    this.pending = [];
    this.blasts = [];
    this.events = [];
    this.chains = new Map();
    this.nextChain = 0;
  }

  release(body) {
    body.carried = false;
    delete body.spin;
    body.dropped();
  }

  // The grabbable bot nearest the hero within reach, else a liftable object, or null.
  target(hero) {
    let best = null;
    for (const enemy of this.arena.enemies) {
      if (!this.canGrab(enemy)) continue;
      const distance = Math.hypot(enemy.x - hero.x, enemy.y - hero.y) - enemy.radius;
      if (distance <= THROW.reach && (!best || distance < best.distance)) best = { enemy, distance };
    }
    return best?.enemy ?? this.objects?.(hero, THROW.reach, this.size) ?? null;
  }

  // The nearest object in reach that is too heavy to lift yet, or null. Only while showLocked, and
  // only when nothing liftable is in reach (it costs a second sweep of the lift sources).
  locked(hero) {
    if (!this.showLocked || !this.objects || this.size >= MAX_LIFT_SIZE) return null;
    const body = this.objects(hero, THROW.reach, MAX_LIFT_SIZE);
    return body && body.size > this.size ? body : null;
  }

  grab(hero) {
    if (this.held) return null;
    const enemy = this.target(hero);
    if (!enemy) return null;
    // carried takes the bot out of AI and every attack until it explodes or slips free.
    if (enemy.object) {
      enemy.carried = true;
      enemy.grabbed(hero);
    } else Object.assign(enemy, { carried: true, grabSpent: true, state: 'grabbed', stateTime: 0,
      stagger: 0, vx: 0, vy: 0 });
    this.held = { enemy, time: 0, from: { x: enemy.x, y: enemy.y }, windup: null, lastX: hero.x, sway: 0 };
    this.events.push({ type: 'grab', x: enemy.x, y: enemy.y, enemy });
    return enemy;
  }

  // Starts the swing; the bot leaves the hand after a short windup. heroVelocity carries into the throw.
  throw(direction, heroVelocity = { x: 0, y: 0 }) {
    if (!this.held || this.held.windup) return false;
    this.held.windup = { time: -this.settle, direction: unit(direction.x, direction.y),
      carry: { x: heroVelocity.x, y: heroVelocity.y } };
    return true;
  }

  // The bot wriggles free, dazed. It stays spent: no grabbing the same bot twice.
  // An object is just let go.
  drop() {
    if (!this.held) return;
    const { enemy } = this.held;
    this.held = null;
    if (enemy.object) {
      this.release(enemy);
      this.events.push({ type: 'drop', x: enemy.x, y: enemy.y, enemy });
      return;
    }
    enemy.carried = false;
    enemy.stagger = 0.6;
    delete enemy.spin;
    this.events.push({ type: 'drop', x: enemy.x, y: enemy.y, enemy });
  }

  update(dt, hero, facing = 1) {
    for (const blast of this.blasts) blast.age += dt;
    this.blasts = this.blasts.filter(blast => blast.age < 0.6);
    if (this.held) this.carry(dt, hero, facing);
    this.flights = this.flights.filter(flight => this.fly(flight, dt, hero));
    for (const entry of this.pending) entry.time -= dt;
    const due = this.pending.filter(entry => entry.time <= 0);
    this.pending = this.pending.filter(entry => entry.time > 0);
    for (const entry of due) this.explode(entry.source, entry.power, entry.depth, entry.chain);
  }

  carry(dt, hero, facing) {
    const held = this.held;
    const { enemy } = held;
    held.time += dt;
    // Hoisted overhead, a little behind the hero's facing.
    // A bot sits a little behind the hero's facing; a car is centred, so a turn never jolts it.
    const out = this.grip + hold(enemy);
    const overhead = { x: hero.x + this.up.x * out - (enemy.object ? 0 : facing * 2), y: hero.y + this.up.y * out };
    let point = overhead;
    // The load lags the hero: it rocks back as the hero accelerates away under it.
    const speed = dt > 0 ? (hero.x - held.lastX) / dt : 0;
    held.lastX = hero.x;
    held.sway += (clamp(-speed / THROW.swaySpeed, -1, 1) * THROW.sway - held.sway) * (1 - Math.exp(-8 * dt));
    let tilt = held.sway * this.rock + this.lean;
    if (held.windup) {
      const swing = held.windup;
      swing.time += dt;
      if (swing.time >= THROW.windup) {
        this.launch(enemy, swing, hero);
        return;
      }
      // Swing back behind the shoulder, against the throw, before letting go.
      const reach = 8 + enemy.radius;
      const back = { x: hero.x - swing.direction.x * reach, y: hero.y - swing.direction.y * reach - 8 };
      const k = ease(Math.max(0, swing.time) / THROW.windup);
      point = toward(overhead, back, THROW.swing * k);
      tilt -= Math.sign(swing.direction.x) * THROW.tip * k;
    } else if (held.time < THROW.yank) {
      const k = ease(held.time / THROW.yank);
      point = { x: held.from.x + (overhead.x - held.from.x) * k, y: held.from.y + (overhead.y - held.from.y) * k };
      tilt -= facing * THROW.tip * Math.sin(k * Math.PI);
    } else if (held.time >= THROW.carry && !enemy.object) {
      // Only a bot wriggles free; a car stays put overhead.
      this.drop();
      return;
    }
    enemy.x = point.x;
    enemy.y = point.y;
    enemy.vx = enemy.vy = 0;
    enemy.facing = facing;
    if (enemy.object) enemy.spin = tilt;
  }

  launch(enemy, swing, hero) {
    this.held = null;
    const { direction, carry } = swing;
    const chain = ++this.nextChain;
    this.chains.set(chain, { blasts: 0, queued: 0, slowmo: false });
    if (this.chains.size > 32) this.chains.delete(this.chains.keys().next().value);
    const offset = enemy.radius + 4;
    const out = toward(enemy, { x: hero.x + direction.x * offset, y: hero.y + direction.y * offset }, THROW.swing * 2);
    enemy.x = out.x;
    enemy.y = Math.min(this.arena.groundAt(enemy.x) - half(enemy), out.y);
    enemy.state = 'thrown';
    // An object tumbles on from the tilt it left the hands with.
    if (!enemy.object) enemy.spin = 0;
    this.flights.push({ enemy, chain, age: 0, trail: [], skid: false,
      vx: direction.x * THROW.speed + carry.x * THROW.momentum,
      vy: direction.y * THROW.speed + carry.y * THROW.momentum });
    this.events.push({ type: 'throw', x: enemy.x, y: enemy.y, direction, enemy });
  }

  // One simulation step of a thrown bot. Returns false once it has exploded.
  fly(flight, dt, hero) {
    const { enemy } = flight;
    flight.age += dt;
    if (enemy.object && Math.max(Math.abs(enemy.x - hero.x), Math.abs(enemy.y - hero.y)) > this.range) {
      enemy.carried = false;
      enemy.gone();
      return false;
    }
    if (flight.age > THROW.hang) flight.vy += THROW.gravity * dt;
    const from = { x: enemy.x, y: enemy.y };
    const to = { x: from.x + flight.vx * dt, y: from.y + flight.vy * dt };
    flight.trail.unshift(from);
    if (flight.trail.length > 8) flight.trail.length = 8;
    enemy.spin = (enemy.spin ?? 0) + dt * (enemy.spinRate ?? 24) * (flight.vx >= 0 ? 1 : -1);
    // Steep landings detonate; glancing ones skid along the ground like a bowling ball.
    const floor = this.arena.groundAt(to.x) - half(enemy);
    let groundT = Infinity;
    flight.skid = false;
    if (to.y >= floor) {
      if (flight.vy > Math.hypot(flight.vx, flight.vy) * 0.5) {
        groundT = from.y < floor ? (floor - from.y) / (to.y - from.y) : 0;
      } else {
        to.y = floor;
        flight.vy = 0;
        flight.vx *= Math.exp(-THROW.skidDrag * dt);
        flight.skid = true;
      }
    }
    const hit = this.arena.sweep(from, to,
      target => (target.destructible ? enemy.radius * 0.5 : enemy.radius), target => target !== enemy);
    const bounds = this.bounds;
    const outside = bounds && (to.x < bounds.left || to.x > bounds.right || to.y < bounds.ceiling);
    // A bot is a bomb on a fuse. An object flies until it hits something.
    if (!hit && groundT > 1 && !outside && (enemy.object || flight.age < THROW.life)) {
      enemy.x = to.x;
      enemy.y = to.y;
      enemy.vx = enemy.vy = 0;
      return true;
    }
    const t = Math.min(hit?.t ?? 1, groundT, 1);
    enemy.x = from.x + (to.x - from.x) * t;
    enemy.y = from.y + (to.y - from.y) * t;
    if (bounds) enemy.x = clamp(enemy.x, bounds.left, bounds.right);
    // What it was doing when it hit, for an owner that lets it carry on (a piece of masonry).
    if (enemy.object) {
      enemy.vx = flight.vx;
      enemy.vy = flight.vy;
    }
    const struck = hit && hit.t <= groundT ? hit.target : null;
    const direct = struck && !struck.destructible ? struck : null;
    // A thrown object is a wrecking ball: it hits a building at full power too.
    this.explode(enemy, direct || struck && enemy.object ? 1 : THROW.miss, 0, flight.chain, direct);
    return false;
  }

  // Detonates `source` (a thrown bot, or one killed by an earlier blast in the chain).
  explode(source, power, depth, chain, direct = null) {
    const { x, y } = source;
    const info = this.chains.get(chain) ?? { blasts: 0, queued: 0, slowmo: false };
    this.chains.set(chain, info);
    info.blasts++;
    const charge = source.enemyType === 'kamikaze' ? THROW.volatile : 1;
    if (source.carried) {
      source.carried = false;
      // The thrown bot is spent in its own blast; an object goes back to its owner, wrecked.
      if (source.object) source.burst();
      else this.arena.damage(source, Infinity, { x: 0, y: -1 }, 0, 'blast');
    }
    // this.power (blast upgrades) scales damage fully and radius by its square root.
    const thud = Boolean(source.thud);
    const radius = thud ? source.radius + THROW.thudReach
      : (THROW.blastRadius * (0.6 + 0.4 * power * charge) + source.radius) * Math.sqrt(this.power);
    const damage = thud ? source.maxHealth * power * this.power
      : (THROW.blastDamage + source.maxHealth * THROW.weightDamage) * power * charge * this.power;
    this.blasts.push({ x, y, radius, power, depth, age: 0, scrap: source.scrap, thud });
    this.events.push({ type: thud ? 'thud' : 'blast', x, y, radius, power, depth, chain, count: info.blasts, object: Boolean(source.object) });
    if (info.blasts >= THROW.slowmoAt && !info.slowmo) {
      info.slowmo = true;
      this.events.push({ type: 'chain', x, y, count: info.blasts });
    }
    let fused = 0;
    for (const target of this.arena.damageables) {
      if (target === source || target.health <= 0 || target.carried) continue;
      if (source.soft && target.destructible) continue;
      let point = target;
      let dx = target.x - x;
      let dy = target.y - y;
      let distance;
      if (target.destructible) {
        // Props and buildings take the blast on their nearest face.
        point = { x: clamp(x, target.x - target.width / 2, target.x + target.width / 2),
          y: clamp(y, target.y - target.height / 2, target.y + target.height / 2) };
        dx = point.x - x;
        dy = point.y - y;
        distance = Math.hypot(dx, dy);
      } else distance = target === direct ? 0 : Math.max(0, Math.hypot(dx, dy) - (target.radius ?? 0));
      if (distance > radius) continue;
      const falloff = 1 - (1 - THROW.edgeDamage) * distance / radius;
      // Outward with an upward kick, so caught bots fly rather than slide.
      const outward = unit(dx, dy);
      const away = unit(outward.x, outward.y - 0.45);
      const amount = damage * falloff * (target === direct ? THROW.directBonus : 1)
        * (target.boss ? THROW.bossDamage : 1);
      this.arena.damage(target, amount, away, THROW.knockback * falloff * (0.5 + 0.5 * power), 'blast', point);
      if (target.enemyType && target.health <= 0) {
        this.events.push({ type: 'kill', x: target.x, y: target.y, enemy: target, chain });
        if (!source.object && !target.boss && !target.part && depth < THROW.chainDepth && info.queued < THROW.chainLimit
          && this.pending.length < THROW.maxPending) {
          info.queued++;
          this.pending.push({ source: target, power: power * THROW.chainFalloff, depth: depth + 1, chain,
            time: THROW.chainDelay + fused++ * THROW.chainStagger });
        }
      }
    }
  }
}
