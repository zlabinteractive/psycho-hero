import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { WindmillLife } from './windmill-life.js';
import { OASIS_POOL, PALM_OASIS, PALM_OASIS_BUILDINGS, PALM_OASIS_LANDMARKS } from './palm-oasis-art.js';
import { RED_DUNES } from './red-dunes-art.js';
import { drawCamel } from './golden-beach-life.js';
import { BUS_LIVERIES } from './bus-liveries.js';

// Life in Palm Oasis, following game-design-rules/city-life-rules.md with a desert village's cast
// (area-life.js does the street):
// - Villagers in robes and headscarves; date pickers with baskets at the market; travellers at the
//   caravanserai; children playing by the pool; a lookout at the watchtower.
// - On the road: donkey carts, old pickups, travellers' 4x4s and the village bus, which stops once.
// - Goats browsing round the houses, donkeys by the market, hens in the yards and camels kneeling
//   outside the caravanserai; they shy from a hero who comes close. Doves on the palms and roofs.
// Palm Oasis shares the Red Dunes' showers.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'donkeycart', length: 4.4 * METRE, height: 1.9 * METRE, weight: 2, slow: true },
  { kind: 'pickup', length: 5.3 * METRE, height: 1.85 * METRE, weight: 3 },
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 1 },
  { kind: 'bus', length: 9 * METRE, height: 3 * METRE, weight: 1 },
];
const CRUISE = [6 * METRE, 9 * METRE];
const PAINT = [0xb8a888, 0x8a7a62, 0x6e7458, 0xd8d2c4, 0x9a6a50];
const ROBES = [0xe8e2d4, 0xd8ccb4, 0x8a7a62, 0x5f6a5a, 0xb87a58];
const HOTSPOTS = {
  caravanserai: [8, 90, i => i < 2 ? { shirt: 0x2f2a26, hat: 'indigo', calm: true } : {}],
  'date-market': [9, 44, i => i < 4 ? { basket: 0x7a3e2a } : {}],
  'water-wheel': [4, 40, () => ({ child: true })],
  'oasis-watchtower': [2, 26],
};
const STOPS = [31040];
const DOVES = [0xf2f2ee, 0xe8e6e0, 0xc8c4bc];
const ANIMAL = {
  goat: { startle: 70, run: 5 * METRE, hop: 18, count: 5 },
  donkey: { startle: 60, run: 3 * METRE, hop: 0, count: 2 },
  hen: { startle: 45, run: 3.5 * METRE, hop: 26, count: 5 },
  camel: { startle: 70, run: 2.2 * METRE, hop: 0, count: 3 },
};
const HERDS = [['goat', 30620, 30], ['donkey', 30740, 14], ['hen', 31050, 30], ['camel', 30420, 18], ['goat', 31160, 24]];
const CAMEL_COATS = [0xc49a62, 0xb08a58, 0xd2ae78];
const GOAT_COATS = [0x6a5a4a, 0xd8ccb4, 0x3a3430, 0x9a7a5a];

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class PalmOasisLife extends AreaLife {
  // weather: the Red Dunes' life, whose showers the oasis shares.
  constructor(random = Math.random, weather = null) {
    super(random, { area: PALM_OASIS, landmarks: PALM_OASIS_LANDMARKS, hotspots: HOTSPOTS, stops: STOPS,
      weather, weatherEdge: RED_DUNES.to, walkerSpacing: 120, carSpacing: 520, seed: 3700 });
    this.hats = { wrap: { color: 0xe8e2d4, shape: 'scarf' }, scarf: { color: 0xb87a58, shape: 'scarf' },
      indigo: { color: 0x2f3a5a, shape: 'scarf' }, sun: { color: 0xd8c8a0, shape: 'brim' } };
    for (const person of this.crowds) {
      if (person.child) Object.assign(person, { height: Math.round(HERO_HEIGHT * 0.58), calm: false });
      if (!person.hat && hash(person.x * 3) < 0.6) this.robe(person, hash(person.x * 5));
    }
    for (const building of PALM_OASIS_BUILDINGS) {
      if (!building.roof || !building.kind || building.kind === 'tent' || hash(building.seed * 7) >= 0.35) continue;
      this.flocks.push({ x: building.x, height: building.roof - 2, spread: building.width * 0.2, seed: building.seed });
    }
    this.flocks.push({ x: OASIS_POOL.from - 8, height: 0, spread: 14, seed: OASIS_POOL.from });
    for (const flock of this.flocks) this.settle(flock);
    this.herds = HERDS.map(([kind, x, reach]) => this.herd({ kind, home: [x - reach, x + reach], spec: ANIMAL[kind] }));
    for (const herd of this.herds) {
      const coats = herd.kind === 'camel' ? CAMEL_COATS : GOAT_COATS;
      for (const [i, animal] of herd.members.entries()) animal.coat = coats[i % coats.length];
    }
    this.doors = PALM_OASIS_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  robe(person, r) {
    Object.assign(person, { shirt: pick(ROBES, hash(r * 3)), pants: pick(ROBES, hash(r * 9)) });
    const roll = hash(r * 7);
    person.hat = roll < 0.45 ? 'wrap' : roll < 0.7 ? 'scarf' : roll < 0.8 ? 'sun' : person.hat;
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    if (hash(r * 61) < 0.65) this.robe(person, hash(r * 63));
    return person;
  }

  settle(flock) {
    super.settle(flock);
    for (const bird of flock.birds) bird.color = pick(DOVES, this.random());
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const cruise = (CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0])) * (type.slow ? 0.3 : 1);
    const paint = type.kind === 'bus' ? BUS_LIVERIES.palmOasis.body : type.kind === 'donkeycart' ? 0x8a6a4c : pick(PAINT, this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint,
      livery: type.kind === 'bus' ? BUS_LIVERIES.palmOasis : undefined };
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'donkeycart') this.drawDonkeyCart(g, car, groundAt);
    else if (car.kind === 'pickup') this.drawPickup(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  // Donkey cart: a grey donkey in harness pulling a two-wheeled cart of sacks and jars, the driver
  // sitting up front.
  drawDonkeyCart(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const sill = c.base - 4 - c.lift;
    // The donkey at the nose.
    const dx = Math.round(c.front(0.85));
    const d = c.dir;
    const step = Math.round(Math.sin(this.clock * 8 + car.x) * 1);
    drawDonkey(g, dx, c.base, d, step);
    // Shafts.
    g.lineStyle(1, 0x54443a);
    g.lineBetween(c.front(0.55), sill - 2, c.front(0.78), c.base - 8);
    // Cart bed and its load.
    const [a, b] = [c.front(0), c.front(0.55)].sort((p, q) => p - q);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(a), sill - 4, Math.round(b - a), 4);
    g.fillStyle(0x6a5038);
    g.fillRect(Math.round(a), sill - 6, 1, 6);
    g.fillRect(Math.round(b) - 1, sill - 6, 1, 6);
    g.fillStyle(0xd8c8a0);
    g.fillRect(Math.round(a) + 2, sill - 8, 4, 4);
    g.fillStyle(0xb87a58);
    g.fillRect(Math.round(a) + 7, sill - 8, 3, 4);
    // Driver.
    const rx = Math.round(c.front(0.48));
    g.fillStyle(0xe8e2d4);
    g.fillRect(rx - 1, sill - 12, 3, 8);
    g.fillStyle(0xb07a52);
    g.fillRect(rx - 1, sill - 15, 3, 3);
    g.fillStyle(0xe8e2d4);
    g.fillRect(rx - 2, sill - 16, 5, 2);
    // One big wheel.
    const wx = Math.round(c.front(0.28));
    g.fillStyle(0x54443a);
    g.fillCircle(wx, c.base - 4, 4);
    g.fillStyle(0x8a6a4c);
    g.fillCircle(wx, c.base - 4, 2);
    g.restore();
  }

  drawHerd(g, herd, groundAt) {
    if (herd.kind === 'hen') return WindmillLife.prototype.drawHerd.call(this, g, herd, groundAt);
    for (const animal of herd.members) {
      const x = Math.round(animal.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 - Math.round(animal.h);
      const moving = herd.state === 'shy' || animal.target !== null;
      const step = moving ? Math.round(Math.sin(animal.phase) * 1) : 0;
      if (herd.kind === 'camel') {
        drawCamel(g, x, feet, animal.dir, animal.phase, { color: animal.coat, kneel: !moving && animal.graze });
      } else if (herd.kind === 'donkey') {
        drawDonkey(g, x, feet, animal.dir, step, !moving && animal.graze);
      } else {
        // Goat, about 1.2 m: a shaggy coat, swept-back horns, a beard; browsing head down.
        const d = animal.dir;
        const down = !moving && animal.graze;
        g.fillStyle(0x3a3430);
        for (const lx of [-4, 3]) g.fillRect(x + lx + (lx < 0 ? step : -step), feet - 5, 1, 5);
        g.fillStyle(animal.coat);
        g.fillRect(x - 5, feet - 10, 10, 5);
        g.fillRect(x - 5, feet - 6, 10, 1);
        g.fillRect(x - d * 6, feet - 10, 1, 2);
        const hx = d > 0 ? x + 4 : x - 7;
        const hy = down ? feet - 6 : feet - 13;
        g.fillRect(hx, hy, 3, 3);
        g.fillStyle(0x3a3430);
        g.fillRect(hx + (d > 0 ? 2 : 0), hy + 3, 1, 2);
        g.fillStyle(0x8a7a62);
        g.fillRect(hx + (d > 0 ? 0 : 2), hy - 2, 1, 2);
        g.fillRect(hx - d, hy - 2, 1, 1);
      }
    }
  }
}

// A donkey, about 1.6 m long: grey with a pale muzzle and belly, long ears and a dark mane stripe.
function drawDonkey(g, x, feet, d, step, grazing = false) {
  g.fillStyle(0x6a6460);
  for (const lx of [-5, -3, 3, 5]) g.fillRect(x + lx + (lx < 0 ? step : -step), feet - 6, 1, 6);
  g.fillStyle(0x8a8480);
  g.fillRect(x - 6, feet - 12, 12, 6);
  g.fillStyle(0xc8c0b4);
  g.fillRect(x - 5, feet - 7, 10, 1);
  g.fillStyle(0x4a4440);
  g.fillRect(x - 5, feet - 12, 10, 1);
  g.fillRect(x - d * 7, feet - 12, 1, 4);
  const hx = d > 0 ? x + 5 : x - 9;
  const hy = grazing ? feet - 8 : feet - 16;
  g.fillStyle(0x8a8480);
  g.fillRect(hx, hy, 4, 4);
  g.fillRect(d > 0 ? hx : hx + 2, hy + 3, 2, grazing ? 2 : 4);
  g.fillStyle(0xc8c0b4);
  g.fillRect(d > 0 ? hx + 2 : hx, hy + 2, 2, 2);
  g.fillStyle(0x6a6460);
  g.fillRect(hx + (d > 0 ? 0 : 3), hy - 3, 1, 3);
  g.fillRect(hx + (d > 0 ? 1 : 2), hy - 3, 1, 3);
}

for (const name of ['herd', 'stepHerds']) PalmOasisLife.prototype[name] = WindmillLife.prototype[name];
