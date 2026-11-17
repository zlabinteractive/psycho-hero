import { CIRCUMFERENCE } from './planet.js';
import { RIVER } from './rivertown-art.js';

// Ambient sky over the whole planet, so it never looks empty between the cities' own crossings
// (city-life.js keeps its one plane or helicopter). Everything here flies far behind the scenery and
// follows city-life-rules.md: small, pale silhouettes with no detail, ignoring the hero.
// - Airliners up high with fading contrails, light prop planes (some towing a banner) and
//   helicopters, a few at a time.
// - Skeins of geese in a V, flapping across.
// Gulls are the exception: they wheel low over Rivertown's river in front of the town, and scatter
// from a hero who comes close, coming back once the river is off screen.
//
// Aircraft hold the height they started at (over the ground where they spawned), so they cross
// hills and towns level instead of bobbing with the terrain.
export const SKY_KINDS = {
  airliner: { length: 40, altitude: [360, 520], speed: [70, 90], weight: 3 },
  prop: { length: 18, altitude: [210, 330], speed: [40, 52], weight: 2 },
  helicopter: { length: 16, altitude: [160, 260], speed: [30, 40], weight: 2 },
  geese: { length: 50, altitude: [140, 320], speed: [24, 32], weight: 3 },
};
// Up to MAX crossings at once, SPAWN_GAP seconds apart. Things spawn this far past the view edge
// and drop once DESPAWN past it.
export const SKY_MAX = 4;
const SPAWN_GAP = [3, 8];
const SPAWN_MARGIN = 80;
const DESPAWN = 700;
const BANNERS = 0.5;

// Pale, sky-faded colours: far behind everything.
const FAR = 0xdde8ee;
const FAR_SHADE = 0xc7d6de;
const FAR_DARK = 0x8fa6b3;
const GOOSE = 0x7e8f9a;

// Gulls over Rivertown's river: a loose wheel around its middle.
const GULL = { count: 6, centre: (RIVER.from + RIVER.to) / 2, reach: [50, 150], height: [55, 140],
  startle: 80, regroup: 10, color: 0xf2f4f2, wing: 0x9aa6ae };

function nearest(x, cameraX) {
  return x + Math.round((cameraX - x) / CIRCUMFERENCE) * CIRCUMFERENCE;
}

export class SkyLife {
  constructor(groundAt, random = Math.random) {
    this.groundAt = groundAt;
    this.random = random;
    this.crafts = [];
    this.timer = 0;
    this.clock = 0;
    this.view = null;
    this.gulls = { state: 'wheeling', timer: 0, birds: this.gullFlock() };
  }

  gullFlock() {
    return Array.from({ length: GULL.count }, () => ({
      rx: GULL.reach[0] + this.random() * (GULL.reach[1] - GULL.reach[0]),
      ry: 8 + this.random() * 18,
      h: GULL.height[0] + this.random() * (GULL.height[1] - GULL.height[0]),
      angle: this.random() * Math.PI * 2,
      spin: (this.random() < 0.5 ? -1 : 1) * (0.35 + this.random() * 0.3),
      phase: this.random() * 6, x: 0, y: 0, vx: 0, vy: 0,
    }));
  }

  pickKind() {
    const kinds = Object.entries(SKY_KINDS);
    let roll = this.random() * kinds.reduce((sum, [, k]) => sum + k.weight, 0);
    return (kinds.find(([, k]) => (roll -= k.weight) < 0) ?? kinds[0])[0];
  }

  // A crossing at x heading dir; at = null starts it just off the view edge it flies in from.
  spawn(left, right, at = null) {
    const kind = this.pickKind();
    const type = SKY_KINDS[kind];
    const dir = this.random() < 0.5 ? -1 : 1;
    const x = at ?? (dir > 0 ? left - SPAWN_MARGIN - type.length : right + SPAWN_MARGIN + type.length);
    const altitude = type.altitude[0] + this.random() * (type.altitude[1] - type.altitude[0]);
    const craft = {
      kind, dir, x, length: type.length,
      speed: type.speed[0] + this.random() * (type.speed[1] - type.speed[0]),
      // Height above sea level, fixed for the whole crossing.
      y: this.groundAt(x) - altitude, phase: this.random() * 6,
    };
    if (kind === 'prop') craft.banner = this.random() < BANNERS;
    if (kind === 'geese') {
      const count = 7 + Math.floor(this.random() * 5);
      // Lead goose first, then alternating arms of the V trailing behind it.
      craft.birds = Array.from({ length: count }, (_, i) => {
        const rank = Math.ceil(i / 2);
        return { dx: -dir * rank * 6, dy: rank * 3 * (i % 2 ? 1 : 0.85), phase: this.random() * 6 };
      });
    }
    this.crafts.push(craft);
    return craft;
  }

  // left/right: the view's world span. hero: { x, altitude } in world space, or null.
  step(dt, left, right, hero = null) {
    this.clock += dt;
    const width = right - left;
    // A fresh view (first frame, or a jump across the map) starts with a couple already in the sky.
    const jumped = !this.view || Math.abs((left + right) / 2 - this.view) > width * 3;
    this.view = (left + right) / 2;
    if (jumped) {
      this.crafts = [];
      for (let i = 0; i < 2; i++) this.spawn(left, right, left + width * (0.2 + 0.6 * this.random()));
      this.timer = SPAWN_GAP[0];
    }
    for (const craft of this.crafts) {
      craft.x += craft.dir * craft.speed * dt;
      craft.phase += dt;
    }
    this.crafts = this.crafts.filter(c => c.x > left - DESPAWN && c.x < right + DESPAWN);
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = SPAWN_GAP[0] + this.random() * (SPAWN_GAP[1] - SPAWN_GAP[0]);
      if (this.crafts.length < SKY_MAX) this.spawn(left, right);
    }
    this.stepGulls(dt, left, right, hero);
  }

  stepGulls(dt, left, right, hero) {
    const flock = this.gulls;
    const centre = nearest(GULL.centre, this.view);
    const onScreen = centre + GULL.reach[1] > left - 40 && centre - GULL.reach[1] < right + 40;
    const water = this.groundAt(centre);
    if (flock.state === 'wheeling') {
      for (const gull of flock.birds) {
        gull.angle += gull.spin * dt;
        gull.phase += dt * 3;
        gull.x = centre + Math.cos(gull.angle) * gull.rx;
        gull.y = water - gull.h + Math.sin(gull.angle) * gull.ry;
      }
      if (!hero) return;
      const near = flock.birds.some(g => Math.abs(g.x - hero.x) < GULL.startle && Math.abs(g.y - hero.y) < GULL.startle);
      if (!near) return;
      flock.state = 'fleeing';
      flock.timer = 6;
      for (const gull of flock.birds) {
        const away = Math.sign(gull.x - hero.x) || 1;
        gull.vx = away * (60 + this.random() * 50);
        gull.vy = -(50 + this.random() * 40);
      }
    } else if (flock.state === 'fleeing') {
      for (const gull of flock.birds) {
        gull.x += gull.vx * dt;
        gull.y += gull.vy * dt;
        gull.vy += (-8 - gull.vy) * (1 - Math.exp(-0.8 * dt));
        gull.phase += dt * 12;
      }
      flock.timer -= dt;
      if (flock.timer <= 0) Object.assign(flock, { state: 'gone', timer: GULL.regroup });
    } else {
      flock.timer -= dt;
      if (flock.timer <= 0 && !onScreen) Object.assign(flock, { state: 'wheeling', birds: this.gullFlock() });
    }
  }

  // Behind everything: drawn right after the backdrop hills, before any town.
  drawSky(g, left, right) {
    for (const craft of this.crafts) {
      if (craft.x < left - 300 || craft.x > right + 300) continue;
      if (craft.kind === 'airliner') this.drawAirliner(g, craft);
      else if (craft.kind === 'prop') this.drawProp(g, craft);
      else if (craft.kind === 'helicopter') this.drawHelicopter(g, craft);
      else this.drawGeese(g, craft);
    }
  }

  // Gulls, in front of the town but behind the hero.
  draw(g, left, right) {
    if (this.gulls.state === 'gone') return;
    for (const gull of this.gulls.birds) {
      const x = Math.round(gull.x);
      if (x < left - 10 || x > right + 10) continue;
      const y = Math.round(gull.y);
      // Mostly gliding on bent wings, with a few beats now and then.
      const beat = Math.sin(gull.phase * 3) > 0.7 || this.gulls.state === 'fleeing' && Math.sin(gull.phase) > 0;
      g.fillStyle(GULL.color);
      g.fillRect(x - 1, y, 3, 1);
      g.fillStyle(GULL.wing);
      g.fillRect(x - 3, beat ? y - 2 : y - 1, 2, 1);
      g.fillRect(x + 2, beat ? y - 2 : y - 1, 2, 1);
      g.fillRect(x - 4, beat ? y - 3 : y, 1, 1);
      g.fillRect(x + 4, beat ? y - 3 : y, 1, 1);
    }
  }

  drawAirliner(g, craft) {
    const x = Math.round(craft.x);
    const y = Math.round(craft.y);
    const tail = -craft.dir;
    const half = craft.length / 2;
    for (let i = 0; i < 8; i++) {
      g.fillStyle(0xffffff, 0.38 - i * 0.045);
      g.fillRect(x + tail * (half + i * 26) - (tail < 0 ? 26 : 0), y - 1, 26, 2);
    }
    g.fillStyle(FAR);
    g.fillRect(x - half, y - 2, craft.length, 4);
    // Rounded nose, tail fin, and a swept wing under the middle.
    g.fillRect(x + craft.dir * half - (craft.dir > 0 ? 0 : 2), y - 1, 2, 2);
    g.fillTriangle(x + tail * half, y - 2, x + tail * (half - 8), y - 2, x + tail * half, y - 10);
    g.fillStyle(FAR_SHADE);
    g.fillTriangle(x - 2, y + 1, x + 6, y + 1, x + tail * 8 + 2, y + 4);
    g.fillRect(x + tail * (half - 3) - 3, y - 2, 6, 1);
  }

  drawProp(g, craft) {
    const x = Math.round(craft.x);
    const y = Math.round(craft.y + Math.sin(craft.phase * 1.3) * 1.5);
    const tail = -craft.dir;
    const half = craft.length / 2;
    if (craft.banner) {
      // A tow line and a long fluttering banner trailing behind.
      const start = x + tail * (half + 8);
      g.fillStyle(FAR_SHADE);
      g.fillRect(Math.min(x + tail * half, start), y, 8, 1);
      for (let i = 0; i < 12; i++) {
        const wave = Math.round(Math.sin(craft.phase * 6 - i * 0.7));
        g.fillStyle(i % 3 ? 0xe9e4d6 : 0xd9c9b0);
        g.fillRect(start + tail * i * 4 - (tail < 0 ? 4 : 0), y - 3 + wave, 4, 6);
      }
    }
    g.fillStyle(0xd4dde3);
    g.fillRect(x - half, y - 1, craft.length, 3);
    g.fillTriangle(x + tail * half, y - 1, x + tail * (half - 5), y - 1, x + tail * half, y - 6);
    // High wing over the cabin, and a spinning propeller disc on the nose.
    g.fillStyle(FAR_SHADE);
    g.fillRect(x - 5 + craft.dir * 2, y - 2, 10, 1);
    g.fillStyle(FAR_DARK, 0.5);
    const nose = x + craft.dir * half;
    g.fillRect(nose, y - (Math.sin(craft.phase * 50) > 0 ? 3 : 1), 1, Math.sin(craft.phase * 50) > 0 ? 6 : 3);
  }

  drawHelicopter(g, craft) {
    const x = Math.round(craft.x);
    const y = Math.round(craft.y + Math.sin(craft.phase * 0.9) * 2);
    const tail = -craft.dir;
    g.fillStyle(FAR_DARK);
    g.fillEllipse(x, y, 11, 6);
    g.fillRect(Math.min(x + tail * 5, x + tail * 17), y - 1, 12, 1);
    g.fillRect(x + tail * 18 - 1, y - 3, 2, 4);
    g.fillRect(x - 4, y + 4, 8, 1);
    const blade = Math.sin(craft.phase * 40) > 0 ? 9 : 4;
    g.fillRect(x - blade, y - 5, blade * 2, 1);
    g.fillRect(x, y - 4, 1, 1);
  }

  drawGeese(g, craft) {
    for (const bird of craft.birds) {
      const x = Math.round(craft.x + bird.dx);
      const y = Math.round(craft.y + bird.dy);
      const up = Math.sin(craft.phase * 7 + bird.phase) > 0;
      g.fillStyle(GOOSE);
      g.fillRect(x - 1, y, 3, 1);
      g.fillRect(x + craft.dir * 2, y, 1, 1);
      g.fillRect(x - 2, up ? y - 2 : y + 1, 1, 1);
      g.fillRect(x - 1, up ? y - 1 : y + 1, 1, 1);
      g.fillRect(x + 1, up ? y - 1 : y + 1, 1, 1);
      g.fillRect(x + 2, up ? y - 2 : y + 1, 1, 1);
    }
  }
}

// Exported for tests: where the river gulls wheel.
export const RIVER_GULLS = GULL;
