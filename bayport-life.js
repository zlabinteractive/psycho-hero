import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { BAYPORT, BAYPORT_BUILDINGS, BAYPORT_LANDMARKS } from './bayport-art.js';
import { ORCHARD } from './orchard-art.js';
import { BUS_LIVERIES } from './bus-liveries.js';

// Life in Bayport, following game-design-rules/city-life-rules.md with a seaside port's cast
// (area-life.js does the street):
// - Townsfolk and day-trippers; fishermen in oilskins and sou'westers (the one accent, a muted
//   yellow) and fishmongers in white at the fish market; sailors in dark caps; a queue at the Ferris
//   wheel; visitors at the Custom House, the anchor memorial and the lighthouse.
// - Two lanes of cars, taxis, fish lorries stacked with crates, and the navy town bus with its white
//   wave, which stops at two stops along the front.
// - Gulls instead of pigeons: on the rooftops, and in squabbling flocks at the fish market and the
//   Ferris wheel. They burst up and away from a hero who comes close, like pigeons, only bigger.
// Bayport shares Orchard's showers, taking over where the orchard's rain fades out.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 4 },
  { kind: 'hatch', length: 3.9 * METRE, height: 1.5 * METRE, weight: 3 },
  { kind: 'taxi', length: 4.5 * METRE, height: 1.45 * METRE, weight: 1 },
  { kind: 'fishlorry', length: 6.5 * METRE, height: 2.6 * METRE, weight: 1 },
  { kind: 'bus', length: 11 * METRE, height: 3 * METRE, weight: 1 },
];
const CRUISE = [7 * METRE, 10 * METRE];
const PAINT = [0xc3c8cd, 0x5f6b78, 0x4f6a86, 0xe2e2dc, 0x3a3f46, 0x6f7d5c, 0x8c4f4a];
const TAXI = 0xd6b04c;
const LORRY_PAINT = [0x5a7a90, 0xd9ddd6];
const OILSKIN = 0xc9a83a;
const NAVY = 0x2f3a4a;
const WHITES = 0xe8e6de;
const GLASS = 0x9fb8c6;

// Hotspot crowds: [count, reach px, extra].
const HOTSPOTS = {
  'anchor-memorial': [3, 30],
  'custom-house': [6, 72],
  // Fishmongers in white and fishermen in oilskins among the shoppers.
  'fish-market': [10, 84, i => i < 3 ? { shirt: WHITES, busy: true } : i < 6 ? { shirt: OILSKIN, hat: 'souwester', calm: true } : {}],
  'ferris-wheel': [14, 78],
  'bayport-lighthouse': [5, 52],
};
const STOPS = [13770, 14352];
// Gulls, about 45 cm: bigger than pigeons, white with grey backs.
const GULL = { color: [0xf2f4f2, 0xe6eaea], back: 0x9aa6ae, beak: 0xd9b84a };
const GROUND_FLOCKS = ['fish-market', 'ferris-wheel'];

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class BayportLife extends AreaLife {
  // weather: Orchard's life, whose showers Bayport shares.
  constructor(random = Math.random, weather = null) {
    super(random, { area: BAYPORT, landmarks: BAYPORT_LANDMARKS, hotspots: HOTSPOTS, stops: STOPS, ends: [null, BAYPORT.to - 20],
      weather, weatherEdge: ORCHARD.to, walkerSpacing: 115, carSpacing: 320, seed: 1100 });
    this.hats = { souwester: { color: OILSKIN, shape: 'souwester' }, sailor: { color: NAVY, shape: 'cap' } };
    for (const building of BAYPORT_BUILDINGS) {
      if (!building.roof || !building.kind || hash(building.seed * 7) >= 0.4) continue;
      this.flocks.push({ kind: 'gull', x: building.x, height: building.roof - 2, spread: building.width * 0.25, seed: building.seed });
    }
    for (const id of GROUND_FLOCKS) {
      const landmark = BAYPORT_LANDMARKS.find(l => l.id === id);
      this.flocks.push({ kind: 'gull', x: landmark.x - landmark.clear * 0.7, height: 0, spread: 22, seed: landmark.x });
    }
    for (const flock of this.flocks) this.settle(flock);
    this.doors = BAYPORT_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  // Gulls come in smaller groups than pigeons.
  settle(flock) {
    super.settle(flock);
    flock.birds.length = Math.min(flock.birds.length, 5);
    for (const bird of flock.birds) bird.color = pick(GULL.color, this.random());
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    const roll = hash(r * 61);
    if (roll < 0.1) Object.assign(person, { hat: 'souwester', shirt: OILSKIN });
    else if (roll < 0.24) Object.assign(person, { hat: 'sailor', shirt: hash(r * 67) < 0.5 ? NAVY : person.shirt });
    return person;
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    const paint = type.kind === 'taxi' ? TAXI : type.kind === 'bus' ? BUS_LIVERIES.bayport.body
      : type.kind === 'fishlorry' ? pick(LORRY_PAINT, this.random()) : pick(PAINT, this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint,
      livery: type.kind === 'bus' ? BUS_LIVERIES.bayport : undefined };
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'fishlorry') this.drawFishLorry(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  // Fish lorry: a short cab and a flatbed of blue fish crates under a slatted tailgate.
  drawFishLorry(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const deck = sill - 3;
    const roof = c.base - Math.round(car.height) - c.lift;
    const [ca, cb] = [c.front(0.7), c.front(1)].sort((a, b) => a - b);
    g.fillStyle(0x3b3f44);
    g.fillRect(c.left, deck, c.length, sill - deck);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof);
    g.fillStyle(GLASS);
    const glass = c.dir > 0 ? Math.round(cb) - 6 : Math.round(ca) + 1;
    g.fillRect(glass, roof + 2, 5, Math.round((sill - roof) * 0.4));
    // Crates in two layers, then the tailgate.
    const [ba, bb] = [c.front(0.02), c.front(0.68)].sort((a, b) => a - b);
    for (let row = 0; row < 2; row++) {
      for (let bx = Math.round(ba) + row * 2; bx + 7 < bb - row * 2; bx += 8) {
        g.fillStyle(row ? 0x5a8aa8 : 0x4f7a96);
        g.fillRect(bx, deck - 5 - row * 5, 7, 5);
        g.fillStyle(0x3f6a86);
        g.fillRect(bx, deck - 3 - row * 5, 7, 1);
      }
    }
    g.fillStyle(0x6a6f74);
    g.fillRect(c.dir > 0 ? Math.round(ba) - 1 : Math.round(bb), deck - 7, 1, 7);
    this.lights(g, car, c, deck - 1);
    this.wheels(g, c, [0.2, 0.36, 0.84], wheel);
    g.restore();
  }

  // A gull on the ridge: a white body with a grey back, a yellow bill, bobbing as it looks about.
  drawPerched(g, flock, groundAt) {
    for (const bird of flock.birds) {
      const x = Math.round(flock.x + bird.dx + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(flock.height);
      const bob = Math.sin(bird.phase) > 0.7 ? 1 : 0;
      g.fillStyle(0xd9b84a);
      g.fillRect(x - 1, y - 1, 1, 1);
      g.fillRect(x + 1, y - 1, 1, 1);
      g.fillStyle(bird.color);
      g.fillRect(x - 2, y - 4, 5, 3);
      g.fillRect(x + bird.dir * 2, y - 6 + bob, 2, 2);
      g.fillStyle(GULL.back);
      g.fillRect(x - 2, y - 4, 4, 1);
      g.fillRect(x - bird.dir * 3, y - 4, 1, 1);
      g.fillStyle(GULL.beak);
      g.fillRect(x + bird.dir * 3 + (bird.dir > 0 ? 1 : -1), y - 5 + bob, 1, 1);
    }
  }

  // Gulls in flight: long, angled wings beating slowly.
  drawFlying(g, flock, groundAt) {
    for (const bird of flock.birds) {
      const x = Math.round(bird.x + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(bird.h);
      const up = Math.sin(bird.phase * 0.6) > 0;
      g.fillStyle(bird.color);
      g.fillRect(x - 1, y - 1, 3, 2);
      g.fillStyle(GULL.back);
      g.fillRect(x - 4, up ? y - 3 : y, 3, 1);
      g.fillRect(x + 2, up ? y - 3 : y, 3, 1);
      g.fillRect(x - 2, y - 2, 1, 1);
      g.fillRect(x + 2, y - 2, 1, 1);
    }
  }
}
