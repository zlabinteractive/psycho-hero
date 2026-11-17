import { THROW } from './enemy-throw.js';

// Grab and throw feedback. Only bots the hero can lift right now wear the pulsing gold lock-on;
// the one in reach shows the grab key. Weakened bots above the current grab tier show nothing. A
// held bot crackles and shows its flight arc. Throws leave a hot streak, and blasts flash, swell into
// a fireball, ring out a shockwave and throw embers, scrap and smoke.
const GOLD = 0xffd34a;
const HOT = 0xfff6df;
const FIRE = 0xff9a3c;
// Too heavy to lift yet: the Shop's Grab upgrade lifts it.
const LOCKED = 0xff7a1a;
const EMBER = 0xff5a3a;
const SMOKE = 0x4a4458;
const DUST = 0xb8ad9c;
const SCRAP = [0x15111f, 0x4c526a, 0x858fa1];
const MAX_PARTICLES = 220;
const BANNER_TIME = 2.4;

const ease = t => 1 - (1 - t) ** 3;

export class ThrowArtwork {
  constructor(scene, throwing) {
    this.scene = scene;
    this.throwing = throwing;
    this.under = scene.add.graphics().setDepth(9.6);
    this.graphics = scene.add.graphics().setDepth(12.7);
    this.promptStyle = { fontFamily: 'monospace', fontSize: '8px', fontStyle: 'bold',
      color: '#ffd34a', stroke: '#15111f', strokeThickness: 3 };
    this.banner = null;
    this.bannerTime = 0;
    this.particles = [];
    this.seen = new WeakSet();
    this.last = null;
  }

  reset() {
    this.particles = [];
    this.seen = new WeakSet();
    this.under.clear();
    this.graphics.clear();
  }

  // A new grab tier: a short banner over the hero naming it and what it lifts.
  announce(tier) {
    if (!this.banner) {
      this.banner = this.scene.add.text(0, 0, '', { ...this.promptStyle, fontSize: '9px', align: 'center' })
        .setOrigin(0.5, 1).setDepth(14);
    }
    this.banner.setText(`${tier.name} UNLOCKED\ngrab ${tier.unlocks}`);
    this.bannerTime = BANNER_TIME;
  }

  // aim: unit direction of a throw from the hero.
  draw(elapsed, hero, heroVelocity, aim) {
    const dt = this.last === null ? 0 : Math.max(0, Math.min(0.05, elapsed - this.last));
    this.last = elapsed;
    const g = this.graphics;
    const under = this.under;
    g.clear();
    under.clear();
    const throwing = this.throwing;
    const target = throwing.held ? null : throwing.target(hero);
    for (const enemy of throwing.arena.enemies) {
      if (throwing.canGrab(enemy)) this.drawWeakened(under, g, enemy, elapsed, enemy === target);
    }
    if (target?.object) this.drawLiftable(g, target, elapsed);
    else if (!target && !throwing.held) {
      const locked = throwing.locked(hero);
      if (locked) this.drawLiftable(g, locked, elapsed, LOCKED);
    }
    this.drawBanner(hero, dt);
    if (throwing.held) this.drawHeld(g, throwing.held, hero, heroVelocity, aim, elapsed);
    for (const flight of throwing.flights) this.drawFlight(g, flight, elapsed, dt);
    for (const blast of throwing.blasts) {
      if (!this.seen.has(blast)) {
        this.seen.add(blast);
        if (blast.thud) this.puff(blast);
        else this.burst(blast);
      }
      if (!blast.thud) this.drawBlast(g, blast);
    }
    this.updateParticles(g, dt);
  }

  drawWeakened(under, g, enemy, t, inReach) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 10 + enemy.homeX);
    const radius = enemy.radius + 4 + pulse * 2;
    under.fillStyle(GOLD, (inReach ? 0.22 : 0.1) + pulse * 0.08);
    under.fillCircle(enemy.x, enemy.y, radius + 2);
    g.lineStyle(inReach ? 2 : 1, GOLD, (inReach ? 0.75 : 0.45) + pulse * 0.25);
    g.strokeCircle(enemy.x, enemy.y, radius);
    // Four lock-on brackets turning around the bot.
    const spin = t * 2.2;
    g.lineStyle(inReach ? 2 : 1.5, inReach ? HOT : GOLD, 0.9);
    for (let i = 0; i < 4; i++) {
      const angle = spin + i * Math.PI / 2;
      const r = radius + 4;
      const x = enemy.x + Math.cos(angle) * r;
      const y = enemy.y + Math.sin(angle) * r;
      const along = { x: -Math.sin(angle) * 3, y: Math.cos(angle) * 3 };
      const inward = { x: -Math.cos(angle) * 3, y: -Math.sin(angle) * 3 };
      g.lineBetween(x - along.x, y - along.y, x + along.x, y + along.y);
      g.lineBetween(x, y, x + inward.x, y + inward.y);
    }
    // Sparks drift up off the damaged hull.
    for (let i = 0; i < 3; i++) {
      const phase = (t * 1.6 + i / 3 + enemy.homeX * 0.01) % 1;
      g.fillStyle(i % 2 ? FIRE : GOLD, 1 - phase);
      g.fillRect(Math.round(enemy.x + Math.sin(i * 2.4 + t * 3) * enemy.radius * 0.7),
        Math.round(enemy.y - enemy.radius * 0.3 - phase * 14), 1, 1);
    }
  }

  // A car in reach: gold corner brackets around it, pulsing (orange when too heavy yet).
  drawLiftable(g, body, t, color = GOLD) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 10);
    const w = body.width / 2 + 3 + pulse;
    const h = body.height / 2 + 3 + pulse;
    g.lineStyle(1.5, color, 0.7 + pulse * 0.3);
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const x = body.x + sx * w;
        const y = body.y + sy * h;
        g.lineBetween(x, y, x - sx * 5, y);
        g.lineBetween(x, y, x, y - sy * 4);
      }
    }
  }

  drawBanner(hero, dt) {
    if (!this.banner) return;
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    const t = this.bannerTime;
    // Pops in, holds over the hero, then rises and fades.
    const rise = Math.max(0, 0.5 - t) * 24;
    this.banner.setVisible(t > 0).setAlpha(Math.min(1, t / 0.5))
      .setScale(1 + Math.max(0, t - (BANNER_TIME - 0.12)) * 3)
      .setPosition(Math.round(hero.x), Math.round(hero.y - 28 - rise));
  }

  drawHeld(g, held, hero, heroVelocity, aim, t) {
    const { enemy } = held;
    if (enemy.object) {
      // A car torn off the road: dust kicks up where its wheels were, and it leaves a few flecks.
      if (!this.seen.has(held) && !enemy.thud) {
        this.seen.add(held);
        const ground = this.throwing.arena.groundAt(held.from.x);
        for (let i = 0; i < 10; i++) {
          const side = i % 2 ? 1 : -1;
          this.add({ x: held.from.x + side * enemy.width * (0.2 + Math.random() * 0.3), y: ground - 1,
            vx: side * (10 + Math.random() * 40), vy: -8 - Math.random() * 26, size: 2 + Math.random() * 3,
            color: DUST, life: 0.5 + Math.random() * 0.3, gravity: 0, kind: 'smoke' });
        }
        for (let i = 0; i < 6; i++) {
          this.add({ x: held.from.x + (Math.random() - 0.5) * enemy.width, y: ground - 2,
            vx: (Math.random() - 0.5) * 90, vy: -60 - Math.random() * 90, size: 1,
            color: enemy.scrap?.[i % 2 ? 2 : 0] ?? SCRAP[0], life: 0.7, gravity: 420, kind: 'scrap' });
        }
      }
    } else {
      // Grip crackle.
      g.lineStyle(1, HOT, 0.8);
      for (let i = 0; i < 3; i++) {
        const angle = t * 17 + i * 2.1;
        const r = enemy.radius + 2;
        g.lineBetween(enemy.x + Math.cos(angle) * r, enemy.y + Math.sin(angle) * r,
          enemy.x + Math.cos(angle + 0.5) * (r + 3), enemy.y + Math.sin(angle + 0.5) * (r + 3));
      }
    }
    if (held.time < THROW.yank && !enemy.object) {
      // Snatch lines from where the bot was grabbed.
      const fade = 1 - held.time / THROW.yank;
      g.lineStyle(2, GOLD, fade);
      g.lineBetween(held.from.x, held.from.y, enemy.x, enemy.y);
    }
    // An object swings back with no swoosh: sized to it, the arc reads as a stray white circle.
    if (held.windup && enemy.object) return;
    if (held.windup) {
      // Swoosh as the bot swings back.
      const k = ease(Math.max(0, held.windup.time) / THROW.windup);
      g.lineStyle(3, HOT, 0.6 * (1 - k * 0.5));
      g.beginPath();
      const base = Math.atan2(-1, 0);
      const end = Math.atan2(-held.windup.direction.y - 0.6, -held.windup.direction.x);
      g.arc(hero.x, hero.y, enemy.radius + 10, base, base + (end - base) * k, end < base);
      g.strokePath();
      return;
    }
    // Where the throw will fly: the same launch and gravity as the real flight.
    // A bot is about to wriggle free; a car never does.
    const urgent = !enemy.object && THROW.carry - held.time < 0.8;
    const arena = this.throwing.arena;
    const offset = enemy.radius + 4;
    let x = hero.x + aim.x * offset;
    let y = hero.y + aim.y * offset;
    let vx = aim.x * THROW.speed + heroVelocity.x * THROW.momentum;
    let vy = aim.y * THROW.speed + heroVelocity.y * THROW.momentum;
    const step = 1 / 40;
    let locked = null;
    for (let i = 1; i <= 24 && !locked; i++) {
      if (i * step > THROW.hang) vy += THROW.gravity * step;
      x += vx * step;
      y += vy * step;
      if (y > arena.groundAt(x) - enemy.radius) break;
      if (i % 2 === 0) {
        g.fillStyle(urgent && Math.sin(t * 30) > 0 ? EMBER : HOT, 0.85 - i * 0.03);
        g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
      locked = arena.enemies.find(other => other !== enemy && other.health > 0 && !other.carried
        && Math.hypot(other.x - x, other.y - y) < other.radius + enemy.radius);
    }
  }

  drawFlight(g, flight, t, dt) {
    const { enemy, trail } = flight;
    if (enemy.object) {
      this.drawHurled(g, flight, t, dt);
      return;
    }
    // Hot streak behind the tumbling bot.
    for (let i = trail.length - 1; i >= 0; i--) {
      const fade = 1 - i / trail.length;
      g.fillStyle(i < 2 ? HOT : FIRE, 0.55 * fade);
      g.fillCircle(trail[i].x, trail[i].y, enemy.radius * (0.35 + 0.45 * fade));
    }
    const speed = Math.hypot(flight.vx, flight.vy) || 1;
    const back = { x: -flight.vx / speed, y: -flight.vy / speed };
    g.lineStyle(1, HOT, 0.7);
    for (let i = -1; i <= 1; i++) {
      const sx = enemy.x + back.y * i * enemy.radius * 0.8 + back.x * enemy.radius;
      const sy = enemy.y - back.x * i * enemy.radius * 0.8 + back.y * enemy.radius;
      g.lineBetween(sx, sy, sx + back.x * (10 + Math.abs(i) * -4), sy + back.y * (10 + Math.abs(i) * -4));
    }
    if (flight.age < 0.07) {
      g.lineStyle(2, HOT, 1 - flight.age / 0.07);
      g.strokeCircle(enemy.x, enemy.y, enemy.radius + flight.age * 220);
    }
    if (flight.skid && dt > 0 && Math.sin(t * 90) > 0.3) {
      this.add({ x: enemy.x - Math.sign(flight.vx) * enemy.radius, y: enemy.y + enemy.radius - 1,
        vx: -flight.vx * 0.15 + (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 25,
        size: 2 + Math.random() * 2, color: 0x9a8f86, life: 0.4, gravity: 40, kind: 'smoke' });
    }
  }

  // A hurled car: no fire yet, just the air it tears through. Three white streaks along its path,
  // and grit off the road while it skids. No launch ring: on an object it reads as a stray circle.
  drawHurled(g, flight, t, dt) {
    const { enemy, trail } = flight;
    const speed = Math.hypot(flight.vx, flight.vy) || 1;
    const across = { x: -flight.vy / speed, y: flight.vx / speed };
    for (let lane = -1; lane <= 1; lane++) {
      const offset = lane * enemy.half * 0.9;
      let from = enemy;
      for (let i = lane ? 1 : 0; i < trail.length; i++) {
        const fade = 1 - i / trail.length;
        g.lineStyle(lane ? 1 : 2, 0xffffff, (lane ? 0.5 : 0.75) * fade);
        g.lineBetween(from.x + across.x * offset, from.y + across.y * offset,
          trail[i].x + across.x * offset, trail[i].y + across.y * offset);
        from = trail[i];
      }
    }
    if (flight.skid && dt > 0) {
      for (let i = 0; i < 2; i++) {
        this.add({ x: enemy.x - Math.sign(flight.vx) * enemy.radius * Math.random(), y: enemy.y + enemy.half - 1,
          vx: -flight.vx * 0.1 + (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40,
          size: i ? 1 : 2 + Math.random() * 3, color: i ? GOLD : DUST, life: i ? 0.3 : 0.5,
          gravity: i ? 300 : 30, kind: i ? 'ember' : 'smoke' });
      }
    }
  }

  drawBlast(g, blast) {
    const { x, y, radius, age } = blast;
    if (age < 0.07) {
      // A car's blast is wider than a bot's, so its flash stays a core, not a white-out.
      g.fillStyle(HOT, 0.95 * (1 - age / 0.07));
      g.fillCircle(x, y, radius * (blast.scrap ? 0.55 : 0.95));
    }
    const p = Math.min(1, age / 0.45);
    if (p < 1) {
      const swell = radius * (0.4 + 0.6 * ease(p));
      g.fillStyle(EMBER, 0.75 * (1 - p));
      g.fillCircle(x, y, swell * 0.85);
      g.fillStyle(FIRE, 0.9 * (1 - p));
      g.fillCircle(x, y - swell * 0.1, swell * 0.62);
      g.fillStyle(HOT, (1 - p) ** 2);
      g.fillCircle(x, y - swell * 0.15, swell * 0.35);
    }
    const ring = Math.min(1, age / 0.32);
    if (ring < 1) {
      g.lineStyle(4 * (1 - ring) + 1, HOT, 1 - ring);
      g.strokeCircle(x, y, radius * (0.3 + 1.0 * ease(ring)));
    }
  }

  // A thud: no fire, a few puffs of dust where it hit.
  puff(blast) {
    for (let i = 0; i < 6; i++) {
      this.add({ x: blast.x, y: blast.y, vx: (Math.random() - 0.5) * 70, vy: -10 - Math.random() * 30,
        size: 2 + Math.random() * 3, color: DUST, life: 0.4 + Math.random() * 0.3, gravity: 0, kind: 'smoke' });
    }
  }

  burst(blast) {
    const power = blast.power;
    // A car comes apart in its own colours: more pieces, a few big panels, and two wheels.
    const scrap = blast.scrap ?? SCRAP;
    const count = Math.round(10 + 8 * power) + (blast.scrap ? 12 : 0);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180 * (0.6 + power);
      this.add({ x: blast.x, y: blast.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 90,
        size: 1 + Math.floor(Math.random() * (blast.scrap && i < 4 ? 5 : 3)), color: scrap[i % scrap.length],
        life: 0.9 + Math.random() * 0.5, gravity: 420, kind: 'scrap' });
    }
    if (blast.scrap) {
      for (const side of [-1, 1]) {
        this.add({ x: blast.x, y: blast.y, vx: side * (70 + Math.random() * 90), vy: -150 - Math.random() * 80,
          size: 3, color: scrap[2], life: 1.6, gravity: 420, kind: 'scrap' });
      }
    }
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.add({ x: blast.x, y: blast.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 40,
        size: 1, color: i % 2 ? FIRE : GOLD, life: 0.5 + Math.random() * 0.4, gravity: 120, kind: 'ember' });
    }
    for (let i = 0; i < 5; i++) {
      this.add({ x: blast.x + (Math.random() - 0.5) * blast.radius * 0.8, y: blast.y + (Math.random() - 0.5) * blast.radius * 0.5,
        vx: (Math.random() - 0.5) * 30, vy: -18 - Math.random() * 22, size: blast.radius * (0.25 + Math.random() * 0.2),
        color: SMOKE, life: 0.9 + Math.random() * 0.4, gravity: 0, kind: 'smoke', delay: 0.12 });
    }
  }

  add(particle) {
    this.particles.push({ age: 0, ...particle });
    if (this.particles.length > MAX_PARTICLES) this.particles.splice(0, this.particles.length - MAX_PARTICLES);
  }

  updateParticles(g, dt) {
    const groundAt = x => this.throwing.arena.groundAt(x);
    for (const piece of this.particles) {
      piece.age += dt;
      if (piece.age < (piece.delay ?? 0)) continue;
      piece.vy += piece.gravity * dt;
      piece.x += piece.vx * dt;
      piece.y += piece.vy * dt;
      if (piece.kind === 'scrap') {
        const floor = groundAt(piece.x) - piece.size;
        if (piece.y > floor) {
          piece.y = floor;
          piece.vy = -Math.abs(piece.vy) * 0.35;
          piece.vx *= 0.6;
        }
      } else if (piece.kind === 'smoke') {
        piece.vx *= Math.exp(-2 * dt);
        piece.vy *= Math.exp(-1 * dt);
      }
    }
    this.particles = this.particles.filter(piece => piece.age < piece.life + (piece.delay ?? 0));
    for (const piece of this.particles) {
      const age = piece.age - (piece.delay ?? 0);
      if (age < 0) continue;
      const fade = 1 - age / piece.life;
      if (piece.kind === 'smoke') {
        g.fillStyle(piece.color, 0.45 * fade);
        g.fillCircle(piece.x, piece.y, piece.size * (1 + age * 1.2));
      } else {
        g.fillStyle(piece.color, piece.kind === 'ember' ? fade : Math.min(1, fade * 2));
        g.fillRect(Math.round(piece.x), Math.round(piece.y), piece.size, piece.size);
      }
    }
  }
}
