import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { WindmillLife } from './windmill-life.js';
import { SANDPORT, SANDPORT_BUILDINGS, SANDPORT_LANDMARKS } from './sandport-art.js';
import { GOLDEN_SAND } from './golden-beach-art.js';
import { drawCamel } from './golden-beach-life.js';
import { BUS_LIVERIES } from './bus-liveries.js';

// Life in Sandport, following game-design-rules/city-life-rules.md with a desert port's cast
// (area-life.js does the street):
// - Townsfolk in light cottons, under straw sun hats or headscarves; merchants in aprons and porters
//   at the Spice Market; visitors at the Sea Fort, the museum and the Sun Tower; camel drivers at the
//   Caravan Gate.
// - Two lanes of cars, sand-yellow taxis, three-wheeled delivery rickshaws, the water tanker (the one
//   big vehicle), and the sand-yellow town bus with its terracotta stripe, which stops at two stops.
// - White doves instead of pigeons, on the rooftops and in the fort's square; cats at the market,
//   who bolt from a hero who comes close; a string of camels resting by the Caravan Gate, who get up
//   and shuffle away from a hero who comes too close.
// Sandport shares Golden Beach's showers, taking over where the beach's rain fades.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 4 },
  { kind: 'hatch', length: 3.9 * METRE, height: 1.5 * METRE, weight: 3 },
  { kind: 'taxi', length: 4.5 * METRE, height: 1.45 * METRE, weight: 2 },
  { kind: 'rickshaw', length: 2.9 * METRE, height: 1.8 * METRE, weight: 2 },
  { kind: 'tanker', length: 7 * METRE, height: 2.7 * METRE, weight: 1 },
  { kind: 'bus', length: 11 * METRE, height: 3 * METRE, weight: 1 },
];
const CRUISE = [7 * METRE, 10 * METRE];
const PAINT = [0xd8d2c4, 0xb8ab94, 0x8a7a64, 0xe6e2d8, 0x6a7078, 0x9a6a50, 0x5f7f8a];
const TAXI = 0xd9b860;
const COTTON = [0xe8e2d4, 0xd8ccb4, 0xc9b89a, 0xa8b4b0, 0xb87a58, 0x8a9aa8];
const APRON = 0xd8ccb4;
const ROBE = 0xe8e2d4;
const GLASS = 0x9fb8c6;

// Hotspot crowds: [count, reach px, extra].
const HOTSPOTS = {
  'sandport-fort': [6, 74],
  // Merchants in aprons and porters among the shoppers.
  'spice-market': [14, 76, i => i < 3 ? { shirt: APRON, busy: true, hat: 'wrap' } : i < 5 ? { shirt: 0x8a7a64, basket: 0xc9802e } : {}],
  'sandport-museum': [7, 60],
  'sun-tower': [6, 44],
  'caravan-gate': [3, 36, () => ({ shirt: ROBE, pants: ROBE, hat: 'wrap', calm: true })],
};
const STOPS = [26250, 26870];
// White doves, about 30 cm, like pigeons.
const DOVES = [0xf2f2ee, 0xe8e6e0, 0xdcdad4];
const GROUND_FLOCKS = ['sandport-fort', 'sandport-museum'];
const ANIMAL = {
  camel: { startle: 70, run: 2.2 * METRE, hop: 0, count: 3 },
  cat: { startle: 50, run: 5 * METRE, hop: 14, count: 3 },
};
const CAMEL_COATS = [0xc49a62, 0xb08a58, 0xd2ae78];
const CAT_COATS = [0xc98a4a, 0x8a8478, 0x3a3634, 0xd8ccb4];

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class SandportLife extends AreaLife {
  // weather: Golden Beach's life, whose showers Sandport shares.
  constructor(random = Math.random, weather = null) {
    super(random, { area: SANDPORT, landmarks: SANDPORT_LANDMARKS, hotspots: HOTSPOTS, stops: STOPS,
      ends: [SANDPORT.from + 20, null], weather, weatherEdge: GOLDEN_SAND.to, walkerSpacing: 115, carSpacing: 330, seed: 2900 });
    this.hats = { sun: { color: 0xd8c8a0, shape: 'brim' }, wrap: { color: ROBE, shape: 'scarf' },
      scarf: { color: 0xb87a58, shape: 'scarf' }, fez: { color: 0x9a4a3a, shape: 'cap' } };
    for (const person of this.crowds) if (!person.hat && hash(person.x * 3) < 0.5) this.clothe(person, hash(person.x * 5));
    for (const building of SANDPORT_BUILDINGS) {
      if (!building.roof || !building.kind || hash(building.seed * 7) >= 0.35) continue;
      this.flocks.push({ x: building.x, height: building.roof - 2, spread: building.width * 0.25, seed: building.seed });
    }
    for (const id of GROUND_FLOCKS) {
      const landmark = SANDPORT_LANDMARKS.find(l => l.id === id);
      this.flocks.push({ x: landmark.x + landmark.clear * 0.75, height: 0, spread: 20, seed: landmark.x });
    }
    for (const flock of this.flocks) this.settle(flock);
    const gate = SANDPORT_LANDMARKS.find(l => l.id === 'caravan-gate').x;
    const market = SANDPORT_LANDMARKS.find(l => l.id === 'spice-market').x;
    this.herds = [
      { kind: 'camel', home: [gate - 80, gate - 34], spec: ANIMAL.camel },
      { kind: 'cat', home: [market - 60, market + 60], spec: ANIMAL.cat },
    ].map(herd => this.herd(herd));
    for (const [i, animal] of this.herds[0].members.entries()) animal.coat = CAMEL_COATS[i % CAMEL_COATS.length];
    for (const [i, animal] of this.herds[1].members.entries()) animal.coat = CAT_COATS[i % CAT_COATS.length];
    this.doors = SANDPORT_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  // Light cottons, straw hats and headscarves.
  clothe(person, r) {
    person.shirt = pick(COTTON, hash(r * 3));
    const roll = hash(r * 7);
    if (roll < 0.3) person.hat = 'sun';
    else if (roll < 0.5) person.hat = 'wrap';
    else if (roll < 0.62) person.hat = 'scarf';
    else if (roll < 0.66) person.hat = 'fez';
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    if (hash(r * 61) < 0.6) this.clothe(person, hash(r * 63));
    return person;
  }

  settle(flock) {
    super.settle(flock);
    for (const bird of flock.birds) bird.color = pick(DOVES, this.random());
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]) * (type.kind === 'rickshaw' ? 0.6 : 1);
    const paint = type.kind === 'taxi' ? TAXI : type.kind === 'bus' ? BUS_LIVERIES.sandport.body
      : type.kind === 'tanker' ? 0x8a8e90 : type.kind === 'rickshaw' ? pick([0x5f7f8a, 0xb8604a, 0xd9a83a], this.random())
        : pick(PAINT, this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint,
      livery: type.kind === 'bus' ? BUS_LIVERIES.sandport : undefined };
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'tanker') this.drawTanker(g, car, groundAt);
    else if (car.kind === 'rickshaw') this.drawRickshaw(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  // Water tanker: a sand-coloured cab and a long steel tank with bands, a ladder and a hose reel.
  drawTanker(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const [ca, cb] = [c.front(0.74), c.front(1)].sort((a, b) => a - b);
    g.fillStyle(0x3b3f44);
    g.fillRect(c.left, sill - 3, c.length, 3);
    g.fillStyle(0xd8c8a0);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof - 1);
    g.fillStyle(GLASS);
    g.fillRect(c.dir > 0 ? Math.round(cb) - 6 : Math.round(ca) + 1, roof + 2, 5, Math.round((sill - roof) * 0.4));
    const [ta, tb] = [c.front(0.02), c.front(0.7)].sort((a, b) => a - b);
    const tankTop = roof + 3;
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ta), tankTop, Math.round(tb - ta), sill - 3 - tankTop);
    g.fillRect(Math.round(ta) + 1, tankTop - 1, Math.round(tb - ta) - 2, 1);
    g.fillStyle(0xb0b4b6);
    g.fillRect(Math.round(ta) + 2, tankTop + 1, Math.round(tb - ta) - 4, 1);
    g.fillStyle(0x6a6e70);
    for (let bx = Math.round(ta) + 6; bx < tb - 3; bx += 10) g.fillRect(bx, tankTop, 1, sill - 3 - tankTop);
    g.fillStyle(0x4f7a86);
    g.fillRect(Math.round((ta + tb) / 2) - 5, tankTop + 4, 10, 2);
    g.fillStyle(0x3b3f44);
    g.fillRect(c.dir > 0 ? Math.round(ta) + 1 : Math.round(tb) - 3, tankTop + 3, 2, 3);
    this.lights(g, car, c, sill - 4);
    this.wheels(g, c, [0.14, 0.3, 0.86], wheel);
    g.restore();
  }

  // Delivery rickshaw: a three-wheeler with a painted cab under a canvas roof, the driver in front,
  // and a load of sacks on the back.
  drawRickshaw(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 2;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const [ca, cb] = [c.front(0.4), c.front(1)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca), sill - 6, Math.round(cb - ca), 6);
    g.fillStyle(0x3a3e42);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), 2);
    g.fillRect(Math.round(ca), roof, 1, sill - 6 - roof);
    g.fillRect(Math.round(cb) - 1, roof + 1, 1, sill - 7 - roof);
    // Driver.
    const dx = Math.round(c.front(0.72));
    g.fillStyle(0xe8e2d4);
    g.fillRect(dx - 1, sill - 12, 3, 6);
    g.fillStyle(0xb07a52);
    g.fillRect(dx - 1, sill - 15, 3, 3);
    // Load bed with sacks.
    const [la, lb] = [c.front(0), c.front(0.42)].sort((a, b) => a - b);
    g.fillStyle(0x6a5440);
    g.fillRect(Math.round(la), sill - 4, Math.round(lb - la), 4);
    g.fillStyle(0xd8c8a0);
    g.fillRect(Math.round(la) + 1, sill - 8, 4, 4);
    g.fillRect(Math.round(la) + 5, sill - 7, 4, 3);
    this.lights(g, car, c, sill - 4);
    this.wheels(g, c, [0.12, 0.88], wheel);
    g.restore();
  }

  drawHerd(g, herd, groundAt) {
    for (const animal of herd.members) {
      const x = Math.round(animal.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 - Math.round(animal.h);
      const moving = herd.state === 'shy' || animal.target !== null;
      if (herd.kind === 'camel') {
        drawCamel(g, x, feet, animal.dir, animal.phase, { color: animal.coat ?? CAMEL_COATS[0], kneel: !moving && animal.graze });
        continue;
      }
      // Cat, about 0.5 m: a slim body, a tail curled up, pointed ears; it slinks, or sits and washes.
      const d = animal.dir;
      const step = moving ? Math.round(Math.sin(animal.phase) * 1) : 0;
      g.fillStyle(animal.coat ?? CAT_COATS[0]);
      if (moving || !animal.graze) {
        g.fillRect(x - 3, feet - 4, 6, 2);
        g.fillRect(x - 3 + step, feet - 2, 1, 2);
        g.fillRect(x + 2 - step, feet - 2, 1, 2);
        g.fillRect(x + d * 3 - (d > 0 ? 0 : 2), feet - 6, 3, 3);
        g.fillRect(x + d * 3 + (d > 0 ? 0 : 0), feet - 7, 1, 1);
        g.fillRect(x - d * 4, feet - 7, 1, 4);
      } else {
        g.fillRect(x - 1, feet - 5, 3, 5);
        g.fillRect(x + (d > 0 ? 0 : -1), feet - 8, 3, 3);
        g.fillRect(x + (d > 0 ? 0 : 1), feet - 9, 1, 1);
        g.fillRect(x - d * 2, feet - 1, 3, 1);
      }
    }
  }
}

// Windmill's herds fit the town's camels and cats as they are.
for (const name of ['herd', 'stepHerds']) SandportLife.prototype[name] = WindmillLife.prototype[name];
