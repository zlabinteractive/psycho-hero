import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { WindmillLife } from './windmill-life.js';
import { ORCHARD, ORCHARD_BUILDINGS, ORCHARD_LANDMARKS, PLOTS } from './orchard-art.js';
import { BUS_LIVERIES } from './bus-liveries.js';

// Life in Orchard and Orchard Fields, following game-design-rules/city-life-rules.md with an orchard
// village's cast (area-life.js does the street; windmill-life.js lends its herds and tractors):
// - Villagers in straw hats and flat caps; pickers with baskets of apples at the pick-your-own stand,
//   cricketers in whites on the green, drinkers outside the Apple Tree Inn, a beekeeper in a veil, and
//   crowds at the cider barn and the Oast House.
// - A country lane with tractors, tractors hauling trailers of apple bins, farm pickups, cars and the
//   village bus, which stops between the inn and the Oast House. Tractors are slow; traffic queues.
// - Sheep and spotted pigs grazing under the orchard trees, and geese round the cider barn. They shy
//   from a hero who comes close or rushes past and bunch at the far end of their ground, never
//   leaving it, so nothing pops.
// - Starlings in the fruit trees and pigeons on the cottage roofs.
// Orchard keeps its own showers; Bayport shares them.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'tractor', length: 4.2 * METRE, height: 2.8 * METRE, weight: 2, cruise: [3 * METRE, 4.5 * METRE] },
  { kind: 'appletrailer', length: 9.5 * METRE, height: 2.8 * METRE, weight: 1, cruise: [3 * METRE, 4 * METRE] },
  { kind: 'pickup', length: 5.3 * METRE, height: 1.85 * METRE, weight: 4 },
  { kind: 'bus', length: 11 * METRE, height: 3 * METRE, weight: 1 },
];
const CRUISE = [7 * METRE, 10 * METRE];
const PAINT = [0xc3c8cd, 0x5f6b78, 0x8c4f4a, 0x4f6a86, 0xe2e2dc, 0x6f7d5c];
const FARM_PAINT = [0x8c4f4a, 0x5f6b78, 0x6f7d5c, 0xa9a49a, 0x9a5a3a, 0x8a6a4a];
// Tractors carry the lane's one accent: orchard green or a faded blue.
const TRACTOR_PAINT = [0x5a7a48, 0x4f6a86];
const TYRE = 0x25282d;
const CRATE = 0x9a7a58;
const CRATE_DARK = 0x7d6040;
const APPLE = 0xb24a3e;
const WHITES = 0xeceae2;

// Hotspot crowds: [count, reach px, extra].
const HOTSPOTS = {
  'cider-barn': [4, 60, { hat: 'straw' }],
  beehives: [1, 24, { hat: 'veil', shirt: WHITES, pants: WHITES, busy: true }],
  'apple-tree-inn': [7, 62],
  // Cricketers in whites, and a few spectators by the pavilion.
  'cricket-pavilion': [10, 92, i => i < 6 ? { shirt: WHITES, pants: WHITES, hat: i % 3 ? null : 'sunhat' } : {}],
  'oast-house': [4, 52],
  'pick-your-own': [8, 70, i => ({ basket: i % 3 === 1 ? 0xc9c46a : APPLE, hat: i % 2 ? 'straw' : null })],
};
const STOP_X = 12614;

// Grazing animals: startle px, shy speed, hop on the run, how many. Real sizes from the hero:
// sheep 1.2 m long, pigs 1.4 m, geese 80 cm.
const ANIMAL = {
  sheep: { startle: 90, run: 4.5 * METRE, hop: 18, count: 5 },
  pig: { startle: 55, run: 3 * METRE, hop: 0, count: 3 },
  goose: { startle: 70, run: 3.5 * METRE, hop: 6, count: 5 },
};
const STARLING = [0x2f3438, 0x3b3f44];

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// Sheep in the first orchard, pigs in the second, geese in the cider barn's yard.
function herdHomes() {
  const orchards = PLOTS.filter(plot => plot.crop === 'orchard');
  const barn = ORCHARD_LANDMARKS.find(l => l.id === 'cider-barn');
  return [
    { kind: 'sheep', home: [orchards[0].from + 10, orchards[0].to - 10] },
    { kind: 'pig', home: [orchards[1].from + 12, orchards[1].to - 12] },
    { kind: 'goose', home: [barn.x - barn.width * 0.45, barn.x + barn.width * 0.2] },
  ].map(herd => ({ ...herd, spec: ANIMAL[herd.kind] }));
}

export class OrchardLife extends AreaLife {
  constructor(random = Math.random) {
    super(random, { area: ORCHARD, landmarks: ORCHARD_LANDMARKS, hotspots: HOTSPOTS, stops: [STOP_X], seed: 900 });
    this.hats = { straw: { color: 0xc9a85a, shape: 'brim' }, cap: { color: 0x5a5e66, shape: 'cap' },
      sunhat: { color: 0xe6e2d6, shape: 'brim' }, veil: { color: 0xe6e2d6, shape: 'veil' } };
    for (const building of ORCHARD_BUILDINGS) {
      if (building.id.includes('cottage') && hash(building.seed * 7) < 0.4) {
        this.flocks.push({ x: building.x, height: building.roof - 2, spread: building.width * 0.2, seed: building.seed });
      } else if ((building.kind === 'apple' || building.kind === 'pear') && hash(building.seed * 5) < 0.3) {
        this.flocks.push({ kind: 'starling', x: building.x, height: building.roof, spread: building.width * 0.25, seed: building.seed });
      }
    }
    for (const flock of this.flocks) this.settle(flock);
    this.herds = herdHomes().map(herd => this.herd(herd));
    this.doors = ORCHARD_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  settle(flock) {
    super.settle(flock);
    if (flock.kind === 'starling') for (const bird of flock.birds) bird.color = pick(STARLING, this.random());
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    const roll = hash(r * 61);
    if (roll < 0.22) person.hat = 'straw';
    else if (roll < 0.4) person.hat = 'cap';
    return person;
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const [low, high] = type.cruise ?? CRUISE;
    const cruise = low + this.random() * (high - low);
    const paint = type.kind === 'tractor' || type.kind === 'appletrailer' ? pick(TRACTOR_PAINT, this.random())
      : type.kind === 'pickup' ? pick(FARM_PAINT, this.random()) : type.kind === 'bus' ? BUS_LIVERIES.orchard.body : pick(PAINT, this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint,
      livery: type.kind === 'bus' ? BUS_LIVERIES.orchard : undefined };
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'tractor') this.drawTractor(g, car, groundAt);
    else if (car.kind === 'appletrailer') this.drawAppleTrailer(g, car, groundAt);
    else if (car.kind === 'pickup') this.drawPickup(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  // A tractor hauling a low trailer of apple bins, heaped with fruit.
  drawAppleTrailer(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const deck = c.base - 5 - c.lift;
    const [ta, tb] = [c.front(0), c.front(0.54)].sort((a, b) => a - b);
    g.fillStyle(0x6b4a30);
    g.fillRect(Math.round(ta), deck, Math.round(tb - ta), 2);
    g.fillRect(Math.round(Math.min(c.front(0.54), c.front(0.6))), deck + 1, Math.round(c.length * 0.06), 1);
    for (let bx = Math.round(ta) + 1; bx + 10 < tb; bx += 12) {
      g.fillStyle(CRATE);
      g.fillRect(bx, deck - 8, 11, 8);
      g.fillStyle(CRATE_DARK);
      g.fillRect(bx, deck - 5, 11, 1);
      g.fillRect(bx + 5, deck - 8, 1, 8);
      g.fillStyle(APPLE);
      for (let ax = 1; ax < 10; ax += 3) g.fillRect(bx + ax, deck - 10 + (ax % 2), 2, 2);
    }
    for (const t of [0.14, 0.42]) {
      g.fillStyle(TYRE);
      g.fillCircle(Math.round(c.front(t)), c.base - 3, 3);
    }
    this.tractorBody(g, car, c, 0.58, 1);
    g.fillStyle(car.speed < car.cruise * 0.6 ? 0xff5a4a : 0xb8473f);
    g.fillRect(c.dir > 0 ? c.left : c.left + c.length - 2, deck - 2, 2, 2);
    g.restore();
  }

  drawHerd(g, herd, groundAt) {
    if (herd.kind === 'sheep') return WindmillLife.prototype.drawHerd.call(this, g, herd, groundAt);
    const shy = herd.state === 'shy';
    for (const animal of herd.members) {
      const x = Math.round(animal.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 - Math.round(animal.h);
      const d = animal.dir;
      const moving = shy || animal.target !== null;
      const step = moving ? Math.round(Math.sin(animal.phase) * 1.2) : 0;
      const grazing = animal.graze && !moving;
      if (herd.kind === 'pig') {
        // An orchard pig, about 1.4 m long: a pale, black-spotted body on short legs, rooting for
        // windfalls, with lop ears and a curl of tail.
        g.fillStyle(0x3b3a38);
        for (const lx of [-5, -2, 3, 5]) g.fillRect(x + lx + (lx < 0 ? step : -step), feet - 3, 1, 3);
        g.fillStyle(0xe2c9be);
        g.fillRect(x - 7, feet - 9, 14, 6);
        g.fillRect(x - 6, feet - 10, 12, 1);
        g.fillStyle(0x3b3a38);
        g.fillRect(x - 4 + (animal.phase > 3 ? 1 : 0), feet - 8, 3, 2);
        g.fillRect(x + 2, feet - 7, 2, 2);
        g.fillStyle(0xe2c9be);
        const hx = d > 0 ? x + 6 : x - 10;
        const hy = grazing ? feet - 6 : feet - 9;
        g.fillRect(hx, hy, 4, 4);
        g.fillStyle(0xd4a89a);
        g.fillRect(d > 0 ? hx + 3 : hx, hy + 2, 2, 2);
        g.fillStyle(0x3b3a38);
        g.fillRect(d > 0 ? hx + 1 : hx + 2, hy, 1, 2);
        g.fillStyle(0xd4a89a);
        g.fillRect(d > 0 ? x - 8 : x + 7, feet - 10, 1, 2);
        continue;
      }
      // Goose: a white body, a long neck held high or dipped to graze, an orange bill and feet.
      g.fillStyle(0xd98a3a);
      g.fillRect(x - 1 + step, feet - 1, 1, 1);
      g.fillRect(x + 1 - step, feet - 1, 1, 1);
      g.fillStyle(0xeeebe2);
      g.fillRect(x - 3, feet - 5, 7, 4);
      g.fillRect(x - d * 4 - (d < 0 ? 1 : 0), feet - 5, 2, 2);
      g.fillStyle(0xd8d4c8);
      g.fillRect(x - 2, feet - 3, 5, 1);
      g.fillStyle(0xeeebe2);
      const nx = x + d * 3 + (d < 0 ? 0 : 0);
      if (grazing) {
        g.fillRect(nx, feet - 4, 1, 2);
        g.fillRect(nx + d, feet - 3, 1, 2);
        g.fillStyle(0xd98a3a);
        g.fillRect(nx + d * 2, feet - 2, 1, 1);
      } else {
        g.fillRect(nx, feet - 9, 1, 5);
        g.fillRect(nx + (d > 0 ? 0 : -1), feet - 10, 2, 2);
        g.fillStyle(0xd98a3a);
        g.fillRect(nx + d * 2, feet - 9, 1, 1);
      }
    }
  }
}

// Windmill's herds and tractors fit the orchard lane as they are.
for (const name of ['herd', 'stepHerds', 'tractorBody', 'drawTractor']) {
  OrchardLife.prototype[name] = WindmillLife.prototype[name];
}
