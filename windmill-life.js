import { CIRCUMFERENCE } from './planet.js';
import { CITY } from './city-art.js';
import { CityLife, HERO_HEIGHT } from './city-life.js';
import { ForestLife } from './forest-life.js';
import { PLOTS, WINDMILL, WINDMILL_BUILDINGS, WINDMILL_LANDMARKS } from './windmill-art.js';
import { areaEnds } from './road-ends.js';
import { BUS_LIVERIES } from './bus-liveries.js';

// Life in Windmill and Windmill Fields, following game-design-rules/city-life-rules.md with a
// farming village's cast. It reuses the city's people, reactions, pigeons, doors, buses, weather and
// sky traffic (city-life.js) and the forest's vehicle chassis (forest-life.js), and adds:
// - Villagers and farmers in straw hats and flat caps, with crowds at the market on the green, the
//   farm stand, the Great Windmill, the chapel, the barn and the farmhouse.
// - A country lane with tractors, tractors hauling hay wagons, farm pickups, cars and the village bus,
//   which stops by the green. Tractors are slow, so traffic queues behind them.
// - Cows and sheep grazing the pastures and hens round the coop. They shy from a hero who comes close
//   or rushes past and bunch at the far end of their field, never leaving it, so nothing pops.
// - Crows on the crops and pigeons on the cottage roofs.
// The village shares Green City's weather, picking up the shower where the city's fades out.
const METRE = HERO_HEIGHT / 1.85;
const LANES = [{ dir: -1, y: 1 }, { dir: 1, y: 2 }];
const CRUISE = [7 * METRE, 10 * METRE];
const SAFE_GAP = 2 * METRE;
const WALKER_SPACING = 150;
const CAR_SPACING = 420;
const SPAWN_NEAR = 60;
const SPAWN_FAR = 220;
const DESPAWN = 340;
const FAST = 150;
const WEATHER_FADE = 800;
// The country lane and footpath run the whole area; the city's and forest's own traffic carries on.
export const LANE = [WINDMILL.from, WINDMILL.to];

// Hotspot crowds: [count, reach px, extra].
const HOTSPOTS = {
  'farm-stand': [5, 44], 'red-barn': [2, 50, { farmer: true }], 'post-mill': [2, 40], chapel: [3, 36],
  'village-green': [12, 92], 'great-windmill': [6, 56], farmhouse: [2, 44, { farmer: true }],
};
// The village bus stops between the green and the Great Windmill.
const STOP_X = 6548;
const VEHICLES = [
  { kind: 'tractor', length: 4.2 * METRE, height: 2.8 * METRE, weight: 2, cruise: [3 * METRE, 4.5 * METRE] },
  { kind: 'haywagon', length: 10.5 * METRE, height: 3 * METRE, weight: 1, cruise: [3 * METRE, 4 * METRE] },
  { kind: 'pickup', length: 5.3 * METRE, height: 1.85 * METRE, weight: 4 },
  { kind: 'bus', length: 11 * METRE, height: 3 * METRE, weight: 1 },
];
const PAINT = [0xc3c8cd, 0x5f6b78, 0x8c4f4a, 0x4f6a86, 0xe2e2dc, 0x6f7d5c];
// Farm pickups, several of them rust-brown and faded with age.
const FARM_PAINT = [0x8c4f4a, 0x5f6b78, 0x6f7d5c, 0xa9a49a, 0x9a5a3a, 0x8a6a4a];
// Tractors carry the lane's one accent: farm red or farm green.
const TRACTOR_PAINT = [0xa8503e, 0x5a7a48];
const GLASS = 0x9fb8c6;
const TYRE = 0x25282d;
const HAY = 0xd2b66a;
const HAY_DARK = 0xb39a52;
const HATS = { straw: 0xc9a85a, cap: 0x5a5e66 };

// Farm animals: startle px (plus the herd's spread), shy speed, hop on the run, and their look.
// Real sizes from the hero: cows 2.4 m long, sheep 1.2 m, hens 40 cm.
const ANIMAL = {
  cow: { startle: 60, run: 2.5 * METRE, hop: 0, count: 4 },
  sheep: { startle: 90, run: 4.5 * METRE, hop: 18, count: 6 },
  hen: { startle: 45, run: 3.5 * METRE, hop: 26, count: 5 },
};
const CROW = { color: [0x2b2b2e, 0x3b3b40] };

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const pick = (list, r) => list[Math.floor(r * list.length)];
const MID = (WINDMILL.from + WINDMILL.to) / 2;

// Cows in the first pasture, sheep in the second, hens round the farmhouse coop.
function herdHomes() {
  const pastures = PLOTS.filter(plot => plot.crop === 'pasture');
  const coop = WINDMILL_LANDMARKS.find(l => l.id === 'farmhouse');
  const coopX = coop.x + coop.width * 0.38;
  return [
    ...pastures.slice(0, 2).map((plot, i) => ({ kind: i ? 'sheep' : 'cow', home: [plot.from + 12, plot.to - 12] })),
    { kind: 'hen', home: [coopX - 26, coopX + 22] },
  ];
}

export class WindmillLife extends CityLife {
  // weather: another life (Green City's) whose showers this one shares.
  constructor(random = Math.random, weather = null) {
    super(random);
    this.weather = weather;
    // The lane's west end, where Green City's traffic hands over.
    this.ends = areaEnds(WINDMILL.from, WINDMILL.to);
    this.walkers = [];
    this.cars = [];
    this.crowds = [];
    let seed = 500;
    for (const landmark of WINDMILL_LANDMARKS) {
      const [count, reach, extra = {}] = HOTSPOTS[landmark.id] ?? [0, 0];
      for (let i = 0; i < count; i++, seed++) {
        const person = this.person(landmark.x + (hash(seed) - 0.5) * 2 * reach, hash(seed + 0.3));
        Object.assign(person, { home: [landmark.x - reach, landmark.x + reach], state: 'idle', timer: hash(seed + 0.6) * 4 });
        if (extra.farmer) person.hat = 'straw';
        this.crowds.push(person);
      }
    }
    this.stops = [{ x: STOP_X, timer: 0 }];
    for (let i = 0; i < 2; i++) this.crowds.push(this.waiter(this.stops[0], hash(seed + i + 0.9)));
    this.flocks = [];
    for (const building of WINDMILL_BUILDINGS) {
      if (!building.id.startsWith('cottage') || hash(building.seed * 7) >= 0.35) continue;
      this.flocks.push({ x: building.x, height: building.roof - 2, spread: building.width * 0.2, seed: building.seed });
    }
    for (const plot of PLOTS) {
      if (plot.crop === 'pasture') continue;
      this.flocks.push({ kind: 'crow', x: (plot.from + plot.to) / 2, height: 0, spread: Math.min(30, (plot.to - plot.from) / 3), seed: plot.from });
    }
    for (const flock of this.flocks) this.settle(flock);
    this.herds = herdHomes().map(herd => this.herd(herd));
    this.doors = WINDMILL_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  settle(flock) {
    super.settle(flock);
    if (flock.kind === 'crow') for (const bird of flock.birds) bird.color = pick(CROW.color, this.random());
  }

  // A herd at rest in its home field.
  // spec: another area's animal (pigs, geese), when ANIMAL doesn't list it.
  herd(herd) {
    const spec = herd.spec ?? ANIMAL[herd.kind];
    return Object.assign(herd, { state: 'rest', timer: 0, members: Array.from({ length: spec.count }, (_, i) => ({
      x: herd.home[0] + (herd.home[1] - herd.home[0]) * this.random(), dir: this.random() < 0.5 ? -1 : 1,
      phase: this.random() * 6, graze: this.random() < 0.7, target: null, timer: this.random() * 4, h: 0, hv: 0,
      coat: herd.kind === 'cow' ? (i % 3 === 2 ? 0x8a5a3e : 0x3b3a38) : null,
    })) });
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    // Country folk: plenty of straw hats and flat caps.
    const roll = hash(r * 61);
    if (roll < 0.25) person.hat = 'straw';
    else if (roll < 0.45) person.hat = 'cap';
    return person;
  }

  walkBounds() {
    return [LANE[0] + 20, LANE[1] - 20];
  }

  car(x, lane) {
    const total = VEHICLES.reduce((sum, v) => sum + v.weight, 0);
    let roll = this.random() * total;
    const type = VEHICLES.find(v => (roll -= v.weight) < 0) ?? VEHICLES[0];
    const [low, high] = type.cruise ?? CRUISE;
    const cruise = low + this.random() * (high - low);
    const paint = type.kind === 'tractor' || type.kind === 'haywagon' ? pick(TRACTOR_PAINT, this.random())
      : type.kind === 'pickup' ? pick(FARM_PAINT, this.random()) : type.kind === 'bus' ? BUS_LIVERIES.windmill.body : pick(PAINT, this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint,
      livery: type.kind === 'bus' ? BUS_LIVERIES.windmill : undefined };
  }

  // Shares the city's showers when given its life; otherwise keeps its own.
  stepWeather(dt) {
    if (!this.weather) return super.stepWeather(dt);
    this.rain = this.weather.rain;
    this.raining = this.weather.raining;
  }

  step(dt, left, right, hero = null) {
    this.clock += dt;
    this.stepWeather(dt);
    const shift = Math.round(((left + right) / 2 - MID) / CIRCUMFERENCE) * CIRCUMFERENCE;
    const from = left - shift;
    const to = right - shift;
    if (shift !== this.shift) {
      this.walkers = [];
      this.cars = [];
    }
    const firstFill = shift !== this.shift || !this.walkers.length && !this.cars.length;
    this.shift = shift;
    const local = hero && { ...hero, x: hero.x - shift, speed: Math.hypot(hero.vx, hero.vy) };
    if (to < WINDMILL.from - DESPAWN - 600 || from > WINDMILL.to + DESPAWN + 600) {
      this.walkers = [];
      this.cars = [];
      this.aircraft = null;
      return;
    }
    for (const person of this.crowds) this.stepPerson(person, dt, local);
    this.crowds = this.crowds.filter(person => !person.boarded);
    this.stepBirds(dt, from, to, local);
    this.stepHerds(dt, from, to, local);
    this.stepStops(dt, from, to);
    this.stepDoors(dt, from, to);
    this.stepSky(dt, from, to);
    const keep = item => item.x > from - DESPAWN && item.x < to + DESPAWN;
    this.walkers = this.walkers.filter(person => keep(person) && !person.gone);
    this.cars = this.cars.filter(keep);
    for (const person of this.walkers) this.stepPerson(person, dt, local);
    this.view = [from, to];
    this.stepTraffic(dt, local);
    const fill = this.fillTries(firstFill);
    const zones = fill ? [[from - SPAWN_FAR, to + SPAWN_FAR]]
      : [[from - SPAWN_FAR, from - SPAWN_NEAR], [to + SPAWN_NEAR, to + SPAWN_FAR]];
    const span = [Math.max(LANE[0], from - SPAWN_FAR), Math.min(LANE[1], to + SPAWN_FAR)];
    const room = Math.max(0, span[1] - span[0]);
    const inSpan = item => item.x >= span[0] && item.x <= span[1];
    let walkers = 0;
    for (const person of this.walkers) if (inSpan(person)) walkers++;
    for (let tries = fill || 1; tries > 0 && walkers < room / WALKER_SPACING; tries--) {
      const x = this.spawnIn(zones, [LANE], 24);
      if (x === null) continue;
      this.walkers.push(this.person(x));
      walkers++;
    }
    for (const lane of LANES.keys()) {
      let cars = 0;
      for (const car of this.cars) if (car.lane === lane && inSpan(car)) cars++;
      for (let tries = fill || 1; tries > 0 && cars < room / CAR_SPACING; tries--) {
        const x = this.spawnIn(zones, [LANE], 20);
        if (x === null) continue;
        const car = this.car(x, lane);
        if (!this.roomToSpawn(car)) continue;
        if (this.cars.every(other => other.lane !== lane || Math.abs(other.x - x) > (other.length + car.length) / 2 + SAFE_GAP)) {
          this.cars.push(car);
          cars++;
        }
      }
    }
  }

  get streetSpan() {
    return [WINDMILL.from, WINDMILL.to];
  }

  // Animals graze and amble about their field. A hero coming close, or rushing past, makes them
  // shy away: they trot (sheep and hens with little hops) to the far end of the field and bunch
  // there until the hero has gone, then settle and spread out again.
  stepHerds(dt, from, to, hero) {
    for (const herd of this.herds) {
      if (herd.home[1] < from - DESPAWN || herd.home[0] > to + DESPAWN) continue;
      const spec = herd.spec ?? ANIMAL[herd.kind];
      const [low, high] = herd.home;
      if (hero && hero.altitude < 90) {
        const dx = Math.max(low - hero.x, hero.x - high, 0);
        if (dx < spec.startle || hero.speed >= FAST && dx < spec.startle + 80) {
          herd.state = 'shy';
          herd.timer = 1.6;
          herd.from = hero.x;
        }
      }
      if (herd.state === 'shy') {
        herd.timer -= dt;
        for (const animal of herd.members) {
          animal.dir = Math.sign(animal.x - herd.from) || 1;
          const before = animal.x;
          animal.x = Math.max(low, Math.min(high, animal.x + animal.dir * spec.run * dt));
          const moving = animal.x !== before;
          animal.phase += dt * (moving ? 12 : 2);
          animal.target = null;
          animal.hv -= 260 * dt;
          animal.h = Math.max(0, animal.h + animal.hv * dt);
          if (animal.h === 0 && moving && spec.hop) animal.hv = spec.hop * (0.7 + this.random() * 0.5);
        }
        if (herd.timer <= 0) herd.state = 'rest';
        continue;
      }
      for (const animal of herd.members) {
        animal.h = Math.max(0, animal.h - 40 * dt);
        animal.timer -= dt;
        animal.phase += dt * (animal.target === null ? 2 : 7);
        if (animal.target !== null) {
          animal.x += animal.dir * spec.run * 0.25 * dt;
          if ((animal.target - animal.x) * animal.dir <= 0) animal.target = null;
        } else if (animal.timer <= 0) {
          animal.timer = 2 + this.random() * 5;
          animal.graze = this.random() < 0.7;
          if (this.random() < 0.5) {
            animal.target = low + this.random() * (high - low);
            animal.dir = Math.sign(animal.target - animal.x) || 1;
          }
        }
      }
    }
  }

  // Back to front: the stop, perched birds, animals and the back footpath, then traffic, the front
  // footpath, birds in flight and the rain.
  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    const beyond = Math.max(WINDMILL.from - centre, centre - WINDMILL.to, 0);
    if (beyond > DESPAWN + 900) return;
    // Sharing the city's shower, take over exactly where the city's own rain thins out.
    const west = this.weather ? Math.min(1, Math.max(0, (centre - CITY.to) / WEATHER_FADE))
      : Math.max(0, 1 - Math.max(0, WINDMILL.from - centre) / WEATHER_FADE);
    const rain = this.rain * west * Math.max(0, 1 - Math.max(0, centre - WINDMILL.to) / WEATHER_FADE);
    if (rain > 0.01) {
      g.fillStyle(0x4a5a68, 0.2 * rain);
      g.fillRect(left, top, right - left, bottom - top);
    }
    const visible = item => item.x + this.shift > left - 60 && item.x + this.shift < right + 60;
    const people = [...this.crowds, ...this.walkers].filter(visible);
    for (const stop of this.stops) if (visible(stop)) this.drawStop(g, stop, groundAt);
    const flocks = this.flocks.filter(flock => flock.state !== 'gone' && flock.x + this.shift > left - 300 && flock.x + this.shift < right + 300);
    for (const flock of flocks) if (flock.state === 'perched') this.drawPerched(g, flock, groundAt);
    for (const herd of this.herds) {
      if (herd.home[1] + this.shift > left - 40 && herd.home[0] + this.shift < right + 40) this.drawHerd(g, herd, groundAt);
    }
    this.drawBodies(g, groundAt, left, right);
    for (const person of people) if (person.lane === 0) this.drawFigure(g, person, groundAt);
    for (const lane of LANES.keys()) {
      for (const car of this.cars) {
        const at = car.x + this.shift;
        if (car.lane !== lane || at < left - car.length || at > right + car.length) continue;
        this.drawTraffic(g, car, groundAt);
      }
    }
    for (const person of people) if (person.lane === 1) this.drawFigure(g, person, groundAt);
    for (const flock of flocks) if (flock.state === 'flying') this.drawFlying(g, flock, groundAt);
    if (rain > 0.01) this.drawRain(g, left, right, top, bottom, rain);
  }

  // A hat on top of the city's person: a wide straw brim or a flat cap with a peak.
  drawPerson(g, person, groundAt) {
    super.drawPerson(g, person, groundAt);
    if (!person.hat || person.state === 'flinch' || person.umbrella && this.rain > 0.3 && person.state !== 'look') return;
    const x = Math.round(person.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1 + person.lane * 3;
    const h = person.height;
    const unit = v => Math.max(1, Math.round(v * h / 18));
    const hop = person.state === 'look' && person.gesture === 'cheer'
      ? Math.round(Math.max(0, Math.sin(this.clock * 9 + person.phase)) * unit(2)) : 0;
    const head = unit(4);
    const headTop = feet - hop - unit(7) - unit(7) - head;
    const headLeft = x - Math.floor(head / 2) + (person.dir > 0 ? 0 : -1) + 1;
    g.fillStyle(HATS[person.hat], person.fade ?? 1);
    if (person.hat === 'straw') {
      g.fillRect(headLeft - 1, headTop, head + 2, 1);
      g.fillRect(headLeft, headTop - 1, head, 1);
    } else {
      g.fillRect(headLeft, headTop - 1, head, 1);
      g.fillRect(person.dir > 0 ? headLeft + head : headLeft - 1, headTop, 1, 1);
    }
  }

  drawHerd(g, herd, groundAt) {
    const shy = herd.state === 'shy';
    for (const animal of herd.members) {
      const x = Math.round(animal.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 - Math.round(animal.h);
      const d = animal.dir;
      const moving = shy || animal.target !== null;
      const step = moving ? Math.round(Math.sin(animal.phase) * 1.2) : 0;
      const grazing = animal.graze && !moving;
      if (herd.kind === 'cow') {
        // About 2.4 m long and 1.4 m at the shoulder: a white body with dark patches.
        g.fillStyle(0xe8e4da);
        g.fillRect(x - 12, feet - 15, 24, 8);
        for (const lx of [-11, -8, 7, 10]) g.fillRect(x + lx + (lx < 0 ? step : -step), feet - 7, 2, 7);
        g.fillStyle(animal.coat);
        g.fillRect(x - 8, feet - 15, 6, 4);
        g.fillRect(x + 2, feet - 12, 5, 4);
        g.fillRect(x - d * 11, feet - 14, 3, 3);
        g.fillStyle(0xd9a49a);
        g.fillRect(x - d * 4 - 1, feet - 7, 3, 2);
        g.fillStyle(animal.coat);
        g.fillRect(d > 0 ? x - 13 : x + 12, feet - 15, 1, 7);
        const hx = d > 0 ? x + 12 : x - 17;
        const hy = grazing ? feet - 8 : feet - 17;
        g.fillStyle(0xe8e4da);
        g.fillRect(hx, hy, 5, 5);
        g.fillStyle(animal.coat);
        g.fillRect(d > 0 ? hx + 3 : hx, hy + 3, 2, 2);
        g.fillStyle(0xc9b48a);
        g.fillRect(d > 0 ? hx : hx + 4, hy - 1, 1, 1);
        continue;
      }
      if (herd.kind === 'sheep') {
        // About 1.2 m long: a lumpy fleece on dark legs, with a dark face.
        g.fillStyle(0x3b3a38);
        for (const lx of [-4, 3]) g.fillRect(x + lx + (lx < 0 ? step : -step), feet - 4, 1, 4);
        g.fillStyle(0xe6e2d6);
        g.fillRect(x - 6, feet - 10, 12, 6);
        g.fillRect(x - 5, feet - 11, 4, 1);
        g.fillRect(x + 1, feet - 11, 4, 1);
        g.fillStyle(0xd4cfc2);
        g.fillRect(x - 6, feet - 5, 12, 1);
        g.fillStyle(0x3b3a38);
        g.fillRect(d > 0 ? x + 5 : x - 8, grazing ? feet - 6 : feet - 11, 3, 3);
        continue;
      }
      // Hen: a russet body, a red comb and a tail tuft, pecking as she goes.
      const peck = grazing && Math.sin(animal.phase * 3) > 0.5 ? 1 : 0;
      g.fillStyle(0xc9a46a);
      g.fillRect(x - 1, feet - 1, 1, 1);
      g.fillRect(x + 1, feet - 1, 1, 1);
      g.fillStyle(0xa8603a);
      g.fillRect(x - 2, feet - 4, 5, 3);
      g.fillRect(x - d * 3, feet - 5, 1, 2);
      g.fillRect(x + d * 2 + (d > 0 ? 0 : -1), feet - 5 + peck * 2, 2, 2);
      g.fillStyle(0xb8473f);
      g.fillRect(x + d * 3 + (d > 0 ? 0 : -1), feet - 6 + peck * 2, 1, 1);
    }
  }

  // Tractor drawn between fractions t0 and t1 of the chassis, tail to nose: a big rear wheel under
  // the cab, a small front wheel under the bonnet, and an exhaust stack.
  tractorBody(g, car, c, t0, t1) {
    const at = t => c.front(t0 + t * (t1 - t0));
    const rear = 6;
    const front = 3.5;
    const roof = c.base - Math.round(car.height) - c.lift;
    const sill = c.base - rear - c.lift;
    const [ba, bb] = [at(0.42), at(1)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ba), sill - 7, Math.round(bb - ba), 6);
    g.fillStyle(0x000000, 0.15);
    g.fillRect(Math.round(ba), sill - 2, Math.round(bb - ba), 1);
    // Cab: a dark frame round tall glass.
    const [ca, cb] = [at(0.02), at(0.46)].sort((a, b) => a - b);
    g.fillStyle(0x3b3f44);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof);
    g.fillStyle(GLASS);
    g.fillRect(Math.round(ca) + 1, roof + 2, Math.round(cb - ca) - 2, sill - roof - 6);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca) - 1, roof - 1, Math.round(cb - ca) + 2, 2);
    g.fillRect(Math.round(ca), sill - 3, Math.round(cb - ca), 3);
    g.fillStyle(0x6d7279);
    g.fillRect(Math.round(at(0.66)), roof + 4, 1, sill - 7 - roof - 4);
    // Wheels: big ribbed rear, small front, pale hubs.
    for (const [t, r] of [[0.22, rear], [0.84, front]]) {
      const wx = Math.round(at(t));
      g.fillStyle(TYRE);
      g.fillCircle(wx, c.base - r, r);
      g.fillStyle(0xc9b48a);
      g.fillCircle(wx, c.base - r, Math.max(1, r / 2.6));
    }
    g.fillStyle(0xf4ecc8);
    g.fillRect(Math.round(c.dir > 0 ? bb - 2 : ba), sill - 6, 2, 2);
    // Exhaust stack on the bonnet, chugging out puffs that drift back and fade as they rise.
    const stack = Math.round(at(0.72));
    const stackTop = roof + 2;
    g.fillStyle(0x3b3f44);
    g.fillRect(stack, stackTop, 1, sill - 7 - stackTop);
    g.fillRect(stack - 1, stackTop - 1, 3, 1);
    const pace = 3 + Math.min(4, car.speed * 0.15);
    for (let i = 0; i < 3; i++) {
      const t = (this.clock * pace / 3 + i / 3 + (car.x % 1)) % 1;
      g.fillStyle(0x6f7378, 0.45 * (1 - t));
      g.fillCircle(stack - c.dir * t * 7, stackTop - 2 - t * 9, 1 + t * 2.5);
    }
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'tractor') this.drawTractor(g, car, groundAt);
    else if (car.kind === 'haywagon') this.drawHayWagon(g, car, groundAt);
    else if (car.kind === 'pickup') this.drawPickup(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  drawTractor(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    this.tractorBody(g, car, c, 0, 1);
    g.restore();
  }

  // A tractor hauling a flatbed stacked with square bales.
  drawHayWagon(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const deck = c.base - 5 - c.lift;
    const [ta, tb] = [c.front(0), c.front(0.56)].sort((a, b) => a - b);
    g.fillStyle(0x6b4a30);
    g.fillRect(Math.round(ta), deck, Math.round(tb - ta), 2);
    g.fillRect(Math.round(Math.min(c.front(0.56), c.front(0.62))), deck + 1, Math.round(c.length * 0.06), 1);
    for (let row = 0; row < 2; row++) {
      for (let bx = Math.round(ta) + 1 + row * 3; bx + 9 < tb - row * 3; bx += 10) {
        g.fillStyle(HAY);
        g.fillRect(bx, deck - 6 - row * 6, 9, 6);
        g.fillStyle(HAY_DARK);
        g.fillRect(bx, deck - 3 - row * 6, 9, 1);
      }
    }
    for (const t of [0.12, 0.44]) {
      const wx = Math.round(c.front(t));
      g.fillStyle(TYRE);
      g.fillCircle(wx, c.base - 3, 3);
    }
    this.tractorBody(g, car, c, 0.6, 1);
    g.fillStyle(car.speed < car.cruise * 0.6 ? 0xff5a4a : 0xb8473f);
    g.fillRect(c.dir > 0 ? c.left : c.left + c.length - 2, deck - 2, 2, 2);
    g.restore();
  }
}

// The forest's vehicle chassis, lights, wheels and pickup, and its spawn helper, fit the lane as is.
for (const name of ['spawnIn', 'chassis', 'lights', 'wheels', 'drawPickup']) {
  WindmillLife.prototype[name] = ForestLife.prototype[name];
}
