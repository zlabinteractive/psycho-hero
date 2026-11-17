import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { WindmillLife } from './windmill-life.js';
import { RED_DUNES, RED_DUNES_BUILDINGS, RED_DUNES_LANDMARKS } from './red-dunes-art.js';
import { SANDPORT } from './sandport-art.js';
import { drawCamel } from './golden-beach-life.js';

// Life in the Red Dunes, following game-design-rules/city-life-rules.md with a desert's cast
// (area-life.js does the road and its few walkers):
// - Nomads in dark robes and indigo headscarves round the camp; travellers at the fuel station;
//   sightseers under the Red Arch and at the ruins; a couple poking round the plane wreck.
// - The desert highway: dusty 4x4s, loaded desert trucks, motorbikes and the odd car, sparse.
// - A camel caravan: a nomad leads four laden camels nose to tail across the whole desert and back.
//   The string halts and the camels turn their heads to a hero who comes close.
// - Vultures perched on the dead trees and the acacias, and a pair circling high over the wreck and
//   the arch, who wheel away from a hero who flies up among them.
// - Fennec foxes, desert hares and lizards that bolt from a hero who comes close.
// - Tumbleweeds bowling along on the wind, bouncing over the dunes.
// The Red Dunes share Sandport's showers, taking over where the town's rain fades.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'jeep', length: 4.2 * METRE, height: 1.9 * METRE, weight: 3 },
  { kind: 'deserttruck', length: 5.6 * METRE, height: 2.2 * METRE, weight: 2 },
  { kind: 'motorbike', length: 2.1 * METRE, height: 1.5 * METRE, weight: 2 },
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 1 },
];
const CRUISE = [9 * METRE, 13 * METRE];
const DUST = [0xb8a888, 0x8a7a62, 0x6e6a5a, 0xc8b89a, 0x9a6a50];
const GLASS = 0x9fb8c6;
const ROBE_DARK = [0x2f2a26, 0x3a3440, 0x4a3e34];
const INDIGO = 0x2f3a5a;
const HOTSPOTS = {
  'fuel-station': [3, 40],
  'nomad-camp': [6, 54, () => ({ shirt: ROBE_DARK[0], pants: ROBE_DARK[1], hat: 'indigo', calm: true })],
  'red-arch': [7, 66],
  'plane-wreck': [2, 40],
  'sand-ruins': [5, 50],
};
// The caravan's track, short of the towns at either end.
const CARAVAN = [27700, 30150];
const CARAVAN_GAP = 2.9 * METRE;
const CAMEL_COATS = [0xc49a62, 0xb08a58, 0xd2ae78, 0xa8825a];
// Vultures, about 1 m long with a 2.6 m span: dark brown, a pale ruff and a bare head.
const VULTURE = { color: [0x4a3a30, 0x3e322a], ruff: 0xd8c8b0, head: 0xc89a8a };
const CIRCLES = [{ id: 'plane-wreck', r: 46, h: 150 }, { id: 'red-arch', r: 60, h: 230 }];
const ANIMAL = {
  fennec: { startle: 80, run: 7 * METRE, hop: 0, count: 2 },
  hare: { startle: 90, run: 8 * METRE, hop: 16, count: 3 },
  lizard: { startle: 45, run: 4 * METRE, hop: 0, count: 3 },
};
const HERDS = [['fennec', 28520, 60], ['hare', 29230, 70], ['lizard', 29600, 50], ['hare', 30000, 60], ['lizard', 27900, 40]];
const TUMBLE_GAP = [5, 11];

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class RedDunesLife extends AreaLife {
  // weather: Sandport's life, whose showers the desert shares.
  constructor(random = Math.random, weather = null) {
    super(random, { area: RED_DUNES, landmarks: RED_DUNES_LANDMARKS, hotspots: HOTSPOTS, weather, weatherEdge: SANDPORT.to,
      walkerSpacing: 700, carSpacing: 640, seed: 3300 });
    this.hats = { sun: { color: 0xd8c8a0, shape: 'brim' }, cap: { color: 0x6a6e5a, shape: 'cap' },
      indigo: { color: INDIGO, shape: 'scarf' }, wrap: { color: 0xe8e2d4, shape: 'scarf' } };
    // The caravan: a nomad leading a string of laden camels.
    const leader = this.person(28200, 0.37);
    Object.assign(leader, { home: CARAVAN, state: 'walk', dir: 1, calm: true, shirt: ROBE_DARK[2], pants: ROBE_DARK[0], hat: 'indigo', caravan: true });
    this.crowds.push(leader);
    this.leader = leader;
    this.camels = Array.from({ length: 4 }, (_, i) => ({ x: leader.x - (i + 1) * CARAVAN_GAP, dir: 1, phase: i * 1.3,
      look: 0, coat: CAMEL_COATS[i % CAMEL_COATS.length], index: i }));
    this.halt = 0;
    // Vultures: perched on dead trees, acacias and the wreck, and a pair circling on the thermals.
    for (const plant of RED_DUNES_BUILDINGS) {
      if (plant.kind !== 'deadtree' && plant.kind !== 'acacia' || hash(plant.seed * 7) >= (plant.kind === 'deadtree' ? 0.7 : 0.25)) continue;
      this.flocks.push({ kind: 'vulture', x: plant.x, height: plant.roof, spread: plant.width * 0.2, seed: plant.seed });
    }
    const wreck = RED_DUNES_LANDMARKS.find(l => l.id === 'plane-wreck');
    this.flocks.push({ kind: 'vulture', x: wreck.x + 8, height: 18, spread: 10, seed: wreck.x });
    for (const flock of this.flocks) this.settle(flock);
    this.circling = CIRCLES.flatMap(({ id, r, h }, c) => {
      const x = RED_DUNES_LANDMARKS.find(l => l.id === id).x;
      return [0, Math.PI].map(offset => ({ cx: x, r, h, angle: offset + c, x, lift: h, flee: 0 }));
    });
    this.herds = HERDS.map(([kind, x, reach]) => this.herd({ kind, home: [x - reach, x + reach], spec: ANIMAL[kind] }));
    this.tumbleweeds = [];
    this.tumbleTimer = 2;
    this.doors = RED_DUNES_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
    const camels = this.camels;
    this.cast.push(
      { list: () => camels, draw: (g, camel, ground) => this.drawCaravanCamel(g, camel, ground), width: 26, height: 22 },
      { list: () => this.circling, draw: (g, bird, ground) => this.drawVulture(g, bird.x, ground(bird.x + this.shift) - bird.lift, bird.angle),
        lift: bird => bird.lift, width: 14, height: 6 },
      { list: () => this.tumbleweeds, draw: (g, weed, ground) => this.drawTumbleweed(g, weed, ground), lift: weed => weed.h,
        width: 9, height: 9, transient: true },
    );
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    const roll = hash(r * 61);
    if (roll < 0.3) person.hat = 'sun';
    else if (roll < 0.45) person.hat = 'cap';
    else if (roll < 0.62) Object.assign(person, { hat: 'wrap', shirt: 0xe8e2d4 });
    person.umbrella = null;
    return person;
  }

  settle(flock) {
    super.settle(flock);
    if (flock.kind !== 'vulture') return;
    flock.birds.length = Math.min(flock.birds.length, 3);
    for (const bird of flock.birds) bird.color = pick(VULTURE.color, this.random());
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0,
      paint: type.kind === 'jeep' ? pick([0xb8a888, 0x6e7458, 0x9a6a50], this.random()) : pick(DUST, this.random()) };
  }

  step(dt, left, right, hero = null) {
    super.step(dt, left, right, hero);
    if (this.shift === null) return;
    const local = hero && { ...hero, x: hero.x - this.shift, speed: Math.hypot(hero.vx, hero.vy) };
    const near = x => x > left - this.shift - 500 && x < right - this.shift + 500;
    this.stepCaravan(dt, local);
    for (const bird of this.circling) {
      if (!near(bird.cx)) continue;
      // Flying up among them, they wheel wider and climb away for a while.
      const close = local && Math.hypot(local.x - bird.x, local.altitude - bird.lift) < 70;
      if (close) bird.flee = 4;
      bird.flee = Math.max(0, bird.flee - dt);
      bird.angle += dt * (bird.flee ? 0.9 : 0.35);
      const r = bird.r * (bird.flee ? 1.8 : 1);
      bird.x = bird.cx + Math.cos(bird.angle) * r;
      bird.lift += ((bird.h + (bird.flee ? 80 : 0) + Math.sin(bird.angle) * r * 0.25) - bird.lift) * Math.min(1, dt * 2);
    }
    this.stepTumbleweeds(dt, left - this.shift, right - this.shift);
  }

  // The leader walks the caravan track (stepPerson turns them at its ends); each camel follows the
  // one ahead. A hero close by halts the string, and the camels turn their heads to look.
  stepCaravan(dt, hero) {
    const leader = this.leader;
    // The leader heads for the far end of the track rather than wandering, and turns there.
    if (leader.state === 'walk' && leader.target !== CARAVAN[0] && leader.target !== CARAVAN[1]) {
      const end = leader.dir > 0 ? CARAVAN[1] : CARAVAN[0];
      leader.target = Math.abs(end - leader.x) < 20 ? CARAVAN[0] + CARAVAN[1] - end : end;
      leader.dir = Math.sign(leader.target - leader.x) || 1;
    }
    const closeTo = x => hero && Math.abs(hero.x - x) < 80 && hero.altitude < 100;
    const close = [leader.x, ...this.camels.map(c => c.x)].some(closeTo);
    if (close) this.halt = 1.5;
    this.halt = Math.max(0, this.halt - dt);
    if (this.halt > 0 && leader.state === 'walk') {
      leader.state = 'idle';
      leader.timer = 1.5;
    }
    let ahead = leader.x;
    let dir = leader.dir;
    for (const camel of this.camels) {
      camel.look = this.halt > 0 && closeTo(camel.x) ? 1 : 0;
      if (camel.look) camel.dir = Math.sign(hero.x - camel.x) || camel.dir;
      const target = ahead - dir * CARAVAN_GAP;
      const gap = target - camel.x;
      if (Math.abs(gap) > 0.5 && !this.halt) {
        camel.dir = Math.sign(ahead - camel.x) || camel.dir;
        camel.x += Math.sign(gap) * Math.min(Math.abs(gap), 1.6 * METRE * dt);
        camel.phase += dt * 6;
      }
      ahead = camel.x;
      dir = camel.dir;
    }
  }

  // Tumbleweeds roll in from upwind (the west), off screen, bounce along and roll on out of view.
  stepTumbleweeds(dt, from, to) {
    this.tumbleTimer -= dt;
    const inDesert = to > RED_DUNES.from + 100 && from < RED_DUNES.to - 100;
    if (this.tumbleTimer <= 0 && inDesert) {
      this.tumbleTimer = TUMBLE_GAP[0] + this.random() * (TUMBLE_GAP[1] - TUMBLE_GAP[0]);
      const x = from - 80 - this.random() * 60;
      if (x > RED_DUNES.from) {
        this.tumbleweeds.push({ x, h: 0, vh: 0, speed: 3 * METRE + this.random() * 3 * METRE, spin: 0, size: 3 + Math.round(this.random() * 2) });
      }
    }
    for (const weed of this.tumbleweeds) {
      weed.x += weed.speed * dt;
      weed.spin += weed.speed * dt / weed.size;
      weed.vh -= 260 * dt;
      weed.h += weed.vh * dt;
      if (weed.h <= 0) {
        weed.h = 0;
        weed.vh = 30 + this.random() * 50;
      }
    }
    this.tumbleweeds = this.tumbleweeds.filter(weed => weed.x < to + 200 && weed.x < RED_DUNES.to);
  }

  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    if (centre < RED_DUNES.from - 1400 || centre > RED_DUNES.to + 1400) return;
    const visible = x => x + this.shift > left - 60 && x + this.shift < right + 60;
    for (const camel of this.camels) if (visible(camel.x)) this.drawCaravanCamel(g, camel, groundAt);
    super.draw(g, left, right, groundAt, top, bottom);
    for (const weed of this.tumbleweeds) if (visible(weed.x)) this.drawTumbleweed(g, weed, groundAt);
    for (const bird of this.circling) {
      if (!visible(bird.x)) continue;
      const x = Math.round(bird.x + this.shift);
      this.drawVulture(g, bird.x, groundAt(x) - bird.lift, bird.angle);
    }
  }

  drawCaravanCamel(g, camel, groundAt) {
    const x = Math.round(camel.x + this.shift);
    drawCamel(g, x, Math.round(groundAt(x)) + 1, camel.dir, camel.phase, { color: camel.coat, look: camel.look, pack: true });
    // The lead rope to the one ahead.
    const ahead = camel.index === 0 ? this.leader.x : this.camels[camel.index - 1]?.x;
    if (ahead === undefined) return;
    const ax = Math.round(ahead + this.shift);
    g.lineStyle(1, 0x6a5440);
    g.lineBetween(x + camel.dir * 13, Math.round(groundAt(x)) - 16, ax - camel.dir * (camel.index === 0 ? 2 : 11),
      Math.round(groundAt(ax)) - (camel.index === 0 ? 9 : 10));
  }

  // A soaring vulture: broad flat wings with fingered tips, tilting as it circles. x is local, y on screen.
  drawVulture(g, x, y, angle) {
    const sx = Math.round(x + this.shift);
    const sy = Math.round(y);
    const tilt = Math.round(Math.sin(angle) * 1.5);
    g.fillStyle(VULTURE.color[0]);
    g.fillRect(sx - 7, sy - tilt, 7, 1);
    g.fillRect(sx + 1, sy + tilt, 7, 1);
    g.fillRect(sx - 2, sy - 1, 5, 2);
    g.fillStyle(VULTURE.color[1]);
    g.fillRect(sx - 8, sy - tilt - 1, 1, 1);
    g.fillRect(sx + 8, sy + tilt - 1, 1, 1);
    g.fillStyle(VULTURE.ruff);
    g.fillRect(sx + 2, sy - 1, 1, 1);
  }

  drawTumbleweed(g, weed, groundAt) {
    const x = Math.round(weed.x + this.shift);
    const r = weed.size;
    const cy = Math.round(groundAt(x)) + 1 - r - Math.round(weed.h);
    g.lineStyle(1, 0xb09a72);
    for (let i = 0; i < 4; i++) {
      const a = weed.spin + i * Math.PI / 4;
      g.lineBetween(x - Math.cos(a) * r, cy - Math.sin(a) * r, x + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.fillStyle(0x9a8460);
    g.fillRect(x - 1, cy - 1, 2, 2);
  }

  // Perched vultures hunch on the branch: a dark body, a pale ruff and a bare pink head.
  drawPerched(g, flock, groundAt) {
    if (flock.kind !== 'vulture') return super.drawPerched(g, flock, groundAt);
    for (const bird of flock.birds) {
      const x = Math.round(flock.x + bird.dx + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(flock.height);
      g.fillStyle(bird.color);
      g.fillRect(x - 2, y - 6, 5, 6);
      g.fillRect(x - bird.dir * 3, y - 2, 1, 2);
      g.fillStyle(VULTURE.ruff);
      g.fillRect(x - 1 + (bird.dir > 0 ? 1 : 0), y - 7, 3, 1);
      g.fillStyle(VULTURE.head);
      g.fillRect(x + bird.dir * 2, y - 9, 2, 2);
      g.fillStyle(0xd8c8a0);
      g.fillRect(x + bird.dir * 3 + (bird.dir > 0 ? 1 : -1), y - 8, 1, 1);
    }
  }

  drawFlying(g, flock, groundAt) {
    if (flock.kind !== 'vulture') return super.drawFlying(g, flock, groundAt);
    for (const bird of flock.birds) {
      const x = Math.round(bird.x + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(bird.h);
      const up = Math.sin(bird.phase * 0.5) > 0;
      g.fillStyle(bird.color);
      g.fillRect(x - 2, y - 1, 5, 2);
      g.fillRect(x - 7, up ? y - 3 : y, 5, 1);
      g.fillRect(x + 3, up ? y - 3 : y, 5, 1);
    }
  }

  drawHerd(g, herd, groundAt) {
    for (const animal of herd.members) {
      const x = Math.round(animal.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 - Math.round(animal.h);
      const d = animal.dir;
      const moving = herd.state === 'shy' || animal.target !== null;
      const step = moving ? Math.round(Math.sin(animal.phase) * 1) : 0;
      if (herd.kind === 'fennec') {
        // Fennec fox, about 0.6 m with the tail: sandy, with huge ears and a dark-tipped tail.
        g.fillStyle(0xe0c08a);
        g.fillRect(x - 3, feet - 4, 6, 2);
        g.fillRect(x - 3 + step, feet - 2, 1, 2);
        g.fillRect(x + 2 - step, feet - 2, 1, 2);
        g.fillRect(x + d * 3 - (d > 0 ? 0 : 2), feet - 6, 3, 3);
        g.fillRect(x + d * 3 - (d > 0 ? 0 : 2), feet - 9, 1, 3);
        g.fillRect(x + d * 3 - (d > 0 ? -2 : 0), feet - 9, 1, 3);
        g.fillRect(x - d * 4 - (d > 0 ? 2 : 0), feet - 4, 3, 1);
        g.fillStyle(0x3a3028);
        g.fillRect(x - d * 6 - (d > 0 ? 0 : 0), feet - 4, 1, 1);
      } else if (herd.kind === 'hare') {
        // Desert hare: grey-brown, long ears, white scut.
        g.fillStyle(0xa8906a);
        g.fillRect(x - 2, feet - 4, 5, 3);
        g.fillRect(x + d * 2, feet - 6, 2, 2);
        g.fillRect(x + d * 2 + (d > 0 ? 0 : 1), feet - 9, 1, 3);
        g.fillRect(x - 2 + step, feet - 1, 1, 1);
        g.fillRect(x + 2 - step, feet - 1, 1, 1);
        g.fillStyle(0xf0ece4);
        g.fillRect(x - d * 3, feet - 4, 1, 1);
      } else {
        // Lizard: a low, banded body, splayed legs and a long tail.
        g.fillStyle(0x9a8a5a);
        g.fillRect(x - 2, feet - 2, 5, 1);
        g.fillRect(x - d * 4 - (d > 0 ? 3 : 0), feet - 1, 4, 1);
        g.fillRect(x + d * 3, feet - 2, 1, 1);
        g.fillRect(x - 1 + step, feet - 1, 1, 1);
        g.fillRect(x + 2 - step, feet - 1, 1, 1);
        g.fillStyle(0x6a5a3a);
        g.fillRect(x, feet - 2, 1, 1);
      }
    }
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'jeep') this.drawJeep(g, car, groundAt);
    else if (car.kind === 'deserttruck') this.drawDesertTruck(g, car, groundAt);
    else if (car.kind === 'motorbike') this.drawMotorbike(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  // 4x4 jeep: a boxy body on big tyres, a spare wheel on the tail, jerry cans and a roof rack.
  drawJeep(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const belt = sill - 5;
    const [ca, cb] = [c.front(0.15), c.front(0.78)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(c.left, belt, c.length, sill - belt);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), belt - roof);
    g.fillStyle(GLASS);
    g.fillRect(Math.round(ca) + 2, roof + 2, Math.round(cb - ca) - 4, belt - roof - 3);
    g.fillStyle(car.paint);
    g.fillRect(Math.round((ca + cb) / 2), roof + 2, 1, belt - roof - 3);
    g.fillStyle(0x3a3e42);
    g.fillRect(Math.round(ca), roof - 2, Math.round(cb - ca), 1);
    g.fillRect(Math.round(ca) + 2, roof - 1, 1, 1);
    g.fillRect(Math.round(cb) - 3, roof - 1, 1, 1);
    g.fillStyle(0x6a5a3a);
    g.fillRect(Math.round(ca) + 4, roof - 4, 5, 2);
    // Spare wheel on the tail.
    g.fillStyle(0x25282d);
    const tail = c.dir > 0 ? c.left - 1 : c.left + c.length - 1;
    g.fillRect(tail, belt - 2, 2, 5);
    this.lights(g, car, c, belt + 1);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }

  // Desert truck: a high cab and a slatted bed piled with sacks, jerry cans and a tarp.
  drawDesertTruck(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const deck = sill - 4;
    const [ca, cb] = [c.front(0.66), c.front(1)].sort((a, b) => a - b);
    g.fillStyle(0x3b3f44);
    g.fillRect(c.left, sill - 2, c.length, 2);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof - 1);
    g.fillStyle(GLASS);
    g.fillRect(c.dir > 0 ? Math.round(cb) - 5 : Math.round(ca) + 1, roof + 2, 4, Math.round((sill - roof) * 0.38));
    const [ba, bb] = [c.front(0.02), c.front(0.64)].sort((a, b) => a - b);
    g.fillStyle(0x6a5440);
    g.fillRect(Math.round(ba), deck - 4, Math.round(bb - ba), 6);
    g.fillStyle(0x54443a);
    for (let sx = Math.round(ba) + 2; sx < bb; sx += 3) g.fillRect(sx, deck - 4, 1, 6);
    g.fillStyle(0xd8c8a0);
    g.fillRect(Math.round(ba) + 2, deck - 8, 5, 4);
    g.fillRect(Math.round(ba) + 8, deck - 9, 5, 5);
    g.fillStyle(0x5f7a4a);
    g.fillRect(Math.round(ba) + 14, deck - 7, 6, 3);
    g.fillStyle(0xb8603e);
    g.fillRect(Math.round(bb) - 4, deck - 7, 2, 3);
    this.lights(g, car, c, sill - 4);
    this.wheels(g, c, [0.18, 0.82], wheel);
    g.restore();
  }

  // Motorbike: a trail bike with a rider in a scarf, a little dust kicked up behind.
  drawMotorbike(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const axle = c.base - wheel - c.lift;
    g.fillStyle(car.paint);
    g.fillRect(Math.round(Math.min(c.front(0.25), c.front(0.75))), axle - 3, Math.round(c.length * 0.5), 2);
    g.fillStyle(0x3a3e42);
    g.lineStyle(1, 0x3a3e42);
    g.lineBetween(c.front(0.85), axle, c.front(0.7), axle - 6);
    // Rider.
    const rx = Math.round(c.front(0.45));
    g.fillStyle(0x4f5a62);
    g.fillRect(rx - 1, axle - 7, 3, 4);
    g.fillStyle(0xd8c8a0);
    g.fillRect(rx - 1, axle - 13, 3, 6);
    g.fillStyle(0x6a6e70);
    g.fillRect(rx - 1, axle - 17, 4, 4);
    g.fillStyle(INDIGO);
    g.fillRect(rx - c.dir * 3, axle - 13, 2, 1);
    if (car.speed > 2) {
      g.fillStyle(0xd8b08e, 0.5);
      g.fillRect(Math.round(c.front(-0.2)) - 2, c.base - 3, 4, 2);
    }
    this.wheels(g, c, [0.12, 0.88], wheel);
    g.restore();
  }
}

// Windmill's herds fit the desert's foxes, hares and lizards as they are.
for (const name of ['herd', 'stepHerds']) RedDunesLife.prototype[name] = WindmillLife.prototype[name];
