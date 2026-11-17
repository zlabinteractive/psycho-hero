import { CIRCUMFERENCE } from './planet.js';
import { CityLife, HERO_HEIGHT, ROAD_END, braking, wheelAt } from './city-life.js';
import { COMBAT } from './hero-combat.js';
import { FOREST, FOREST_BUILDINGS, FOREST_LANDMARKS, LAKE } from './forest-art.js';

// Life in Oakwood and around Mirror Lake, following game-design-rules/city-life-rules.md with the
// forest's own cast. It reuses the city's people, reactions, birds, doors, weather and sky traffic
// (city-life.js) and adds what the area needs:
// - Hikers with packs on the trails, picnickers under Old Oak, campers round the fire, anglers on
//   the pier and visitors on the lodge porch.
// - A forest road on each shore: logging trucks, green ranger pickups, camper vans and visitors'
//   cars. The road ends at the lake, where traffic parks briefly and turns back.
// - Canoes, rowboats and a sailboat crossing the lake; a seaplane moored at the boathouse dock.
// - Ducks and swans on the water, herons in the shallows, songbirds in the treetops, deer, foxes
//   and squirrels in the clearings, and fish jumping now and then.
// Everything is sized from the hero. Wildlife bolts from a hero who comes close or rushes past and
// only returns once off screen, so nothing pops in.
const METRE = HERO_HEIGHT / 1.85;
const LANES = [{ dir: -1, y: 1 }, { dir: 1, y: 2 }];
const CRUISE = [7 * METRE, 10 * METRE];
const SAFE_GAP = 2 * METRE;
const WALKER_SPACING = 170;
const CAR_SPACING = 460;
const SPAWN_NEAR = 60;
const SPAWN_FAR = 220;
const DESPAWN = 340;
const FAST = 150;
const WAKE = { speed: COMBAT.ramMinSpeed, reach: 60, altitude: 69 };
const ROCK = { reach: 24, altitude: 60 };
// Two stretches of trail and road, one on each shore.
export const TRAILS = [[FOREST.from, LAKE.from - 6], [LAKE.to + 6, FOREST.to]];
const ROADS = [[FOREST.from - 600, LAKE.from - ROAD_END], [LAKE.to + ROAD_END, FOREST.to + 600]];

// Hotspot crowds: [count, reach px, extra]. Anglers stand on the pier deck with rods.
const HOTSPOTS = {
  'ranger-station': [3, 46], 'old-oak': [6, 80], trailhead: [6, 60], 'lakeside-lodge': [4, 54],
  'fishing-pier': [3, 0, { rod: true, lift: 7, deck: 'fishing-pier', deckLift: 7, pier: true }], campground: [7, 70], 'timber-cabin': [2, 36],
};
const PACKS = [0x8a5a3a, 0x5f7a4a, 0x7a4f4a, 0x4f6a86, 0xa88a4a];
const VEHICLES = [
  { kind: 'pickup', length: 5.3 * METRE, height: 1.85 * METRE, weight: 3 },
  { kind: 'logtruck', length: 12 * METRE, height: 3.4 * METRE, weight: 2 },
  { kind: 'camper', length: 7.4 * METRE, height: 3.2 * METRE, weight: 1 },
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 2 },
  { kind: 'hatch', length: 3.9 * METRE, height: 1.5 * METRE, weight: 2 },
];
const PAINT = [0xc3c8cd, 0x5f6b78, 0x8c4f4a, 0x4f6a86, 0xe2e2dc, 0x6f7d5c];
const RANGER = 0x4f6b4a;
const GLASS = 0x9fb8c6;
const TYRE = 0x25282d;
// Boats cross the lake between these margins, clear of the pier and the boathouse dock.
const BOAT_LANE = [LAKE.from + 210, LAKE.to - 175];
export const LAKE_BOAT_VARIETIES = {
  canoe: [
    { name: 'Cedar Green', paint: 0x5f7a4a, trim: 0x3e5230 },
    { name: 'Birch Crimson', paint: 0xb84a3c, trim: 0x76281e },
    { name: 'Royal Natural', paint: 0xd6c098, trim: 0x5a3e28 },
  ],
  rowboat: [
    { name: 'Slate Blue', paint: 0x8a9aa4, trim: 0x485864 },
    { name: 'Hunter Green', paint: 0x3c5442, trim: 0x223626 },
    { name: 'Harbour White', paint: 0xeeeae0, trim: 0x2e425b },
  ],
  sailboat: [
    { name: 'Vintage Cream', paint: 0xe8e2d4, stripe: 0x4f6a86, sail: 0xf4f1ea, burgee: 0xb84a3e },
    { name: 'Racing Azure', paint: 0x2f5e8a, stripe: 0xdca83a, sail: 0xeeeae0, burgee: 0xe85a30 },
    { name: 'Classic Burgundy', paint: 0x6e2e28, stripe: 0xeeeae0, sail: 0xf2ede2, burgee: 0x3e76a8 },
  ],
};
const BOATS = [
  { kind: 'canoe', length: 5 * METRE, speed: 1.6 * METRE, paint: 0x5f7a4a },
  { kind: 'rowboat', length: 4.2 * METRE, speed: 1.2 * METRE, paint: 0x8a9aa4 },
  { kind: 'sailboat', length: 6 * METRE, speed: 2.2 * METRE, paint: 0xe8e2d4 },
];
// Wildlife groups: [kind, x, count, home reach]. Water birds float at height 0 on the lake.
const WATER_FLOCKS = [
  ['duck', LAKE.from + 260, 5, 30], ['duck', LAKE.to - 230, 4, 26], ['swan', LAKE.from + 520, 2, 20],
  ['heron', LAKE.to + 40, 2, 8],
];
const HERDS = [
  ['deer', 7520, 3, 70], ['deer', 10080, 2, 60], ['fox', 7800, 1, 90], ['fox', 9840, 1, 80],
  ['squirrel', 7660, 3, 50], ['squirrel', 9520, 2, 40],
];
const ANIMAL = {
  deer: { startle: 110, flee: 9 * METRE, color: 0x8a6446, belly: 0xd8c6a8 },
  fox: { startle: 90, flee: 8 * METRE, color: 0xb8683a, belly: 0xece2d0 },
  squirrel: { startle: 60, flee: 5 * METRE, color: 0x8a5a3a, belly: 0xd8b48a },
};
const BIRD = { startle: 70, rush: 140, height: 60, regroup: 14, trees: 0.3 };
const SONGBIRDS = [0x7a5a46, 0x8a7a58, 0x9a4a3a, 0x5d636b];
const FISH_GAP = [2.5, 6];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const pick = (list, r) => list[Math.floor(r * list.length)];
const FOREST_MID = (FOREST.from + FOREST.to) / 2;

export class ForestLife extends CityLife {
  constructor(random = Math.random) {
    super(random);
    this.walkers = [];
    this.cars = [];
    this.crowds = [];
    this.stops = [];
    this.boats = [];
    this.fish = [];
    this.deadFish = [];
    this.lakeBlood = [];
    this.fishTimer = FISH_GAP[0];
    this.weatherTimer = 90;
    let seed = 300;
    for (const landmark of FOREST_LANDMARKS) {
      const [count, reach, extra = {}] = HOTSPOTS[landmark.id] ?? [0, 0];
      for (let i = 0; i < count; i++, seed++) {
        const spot = extra.rod ? landmark.x + landmark.width * (0.1 + i * 0.13) : landmark.x + (hash(seed) - 0.5) * 2 * reach;
        const person = this.person(spot, hash(seed + 0.3));
        Object.assign(person, extra, { home: extra.rod ? [spot, spot] : [landmark.x - reach, landmark.x + reach],
          state: 'idle', timer: hash(seed + 0.6) * 4 + (extra.rod ? 6 : 0), lane: extra.rod ? 0 : person.lane });
        if (extra.rod) person.dir = 1;
        this.crowds.push(person);
      }
    }
    this.flocks = [];
    for (const tree of FOREST_BUILDINGS) {
      if (!tree.kind || hash(tree.seed * 7) >= BIRD.trees) continue;
      this.flocks.push({ kind: 'songbird', x: tree.x, height: tree.roof, spread: tree.width * 0.25, seed: tree.seed });
    }
    for (const [kind, x, count, reach] of WATER_FLOCKS) this.flocks.push({ kind, x, count, height: 0, spread: reach, seed: x });
    for (const flock of this.flocks) this.settle(flock);
    this.herds = HERDS.map(([kind, x, count, reach]) => this.herd({ kind, x, count, home: [x - reach, x + reach] }));
    this.doors = FOREST_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
    BOATS.forEach((type, i) => {
      const x = BOAT_LANE[0] + (BOAT_LANE[1] - BOAT_LANE[0]) * (0.2 + 0.3 * i);
      const variants = LAKE_BOAT_VARIETIES[type.kind] ?? [{ paint: type.paint }];
      const varietyIndex = i % variants.length;
      const variety = variants[varietyIndex];
      this.boats.push({ ...type, x, dir: i % 2 ? -1 : 1, pause: 0, phase: i * 2.1, bounce: 0, bounceSpeed: 0, flinch: 0,
        varietyIndex, ...variety,
        crew: [this.person(x, hash(seed + i)), this.person(x, hash(seed + i + 0.5))] });
    });
    // The seaplane rides at the end of the boathouse dock.
    this.seaplane = { x: LAKE.to - 22 * 1.4 - 106, bounce: 0, bounceSpeed: 0, phase: 0, length: 34, height: 12 };
    // Evil mode can sink it at its mooring (city-life.js).
    this.moored = [this.seaplane];
    this.cast.push({
      list: () => this.fish,
      x: fish => fish.x,
      alive: fish => fish.t < 0.7,
      width: 14,
      height: 14,
      transient: true,
      hit: (fish, vx, vy) => this.killLakeFish(fish, vx, vy),
    });
    this.drawMoored = (g, plane, groundAt) => this.drawSeaplane(g, groundAt);
  }

  // Ducks paddle in a loose raft, herons stand alone, songbirds hop about the crown.
  settle(flock) {
    if (!flock.kind || flock.kind === 'songbird') {
      super.settle(flock);
      if (flock.kind) for (const bird of flock.birds) bird.color = pick(SONGBIRDS, this.random());
      return;
    }
    flock.state = 'perched';
    flock.birds = Array.from({ length: flock.count }, (_, i) => ({
      dx: (this.random() - 0.5) * 2 * flock.spread, dir: this.random() < 0.5 ? -1 : 1, phase: this.random() * 6,
      drift: (this.random() - 0.5) * 3, color: flock.kind === 'duck' && i % 2 ? 0x6b5a46 : null,
    }));
  }

  // A deer herd, a fox or a few squirrels at rest within their home range.
  get streetSpan() {
    return [FOREST.from, FOREST.to];
  }

  herd(herd) {
    Object.assign(herd, { state: 'rest', timer: 0, members: Array.from({ length: herd.count }, (_, i) => ({
      x: herd.home[0] + (herd.home[1] - herd.home[0]) * this.random(), dir: this.random() < 0.5 ? -1 : 1,
      phase: this.random() * 6, graze: this.random() < 0.6, buck: herd.kind === 'deer' && i === 0, target: null,
      timer: this.random() * 4, h: 0, hv: 0,
    })) });
    return herd;
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    // Forest walkers dress for it: most carry a pack.
    if (hash(r * 53) < 0.7) person.pack = pick(PACKS, hash(r * 59));
    return person;
  }

  // A walker without a home turns back at the end of the trail on its shore.
  walkBounds(person) {
    if (person?.pier && !person.offDeck) {
      return [LAKE.from + 40, LAKE.from + 140];
    }
    const [from, to] = TRAILS[person.x < (LAKE.from + LAKE.to) / 2 ? 0 : 1];
    return [from + 20, to - 20];
  }

  car(x, lane) {
    const total = VEHICLES.reduce((sum, v) => sum + v.weight, 0);
    let roll = this.random() * total;
    const type = VEHICLES.find(v => (roll -= v.weight) < 0) ?? VEHICLES[0];
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    const paint = type.kind === 'pickup' ? RANGER : type.kind === 'logtruck' ? 0x6b6f52 : type.kind === 'camper' ? 0xe2dccb
      : pick(PAINT, this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, park: 0, paint };
  }

  step(dt, left, right, hero = null) {
    this.clock += dt;
    this.stepWeather(dt);
    const shift = Math.round(((left + right) / 2 - FOREST_MID) / CIRCUMFERENCE) * CIRCUMFERENCE;
    const from = left - shift;
    const to = right - shift;
    if (shift !== this.shift) {
      this.walkers = [];
      this.cars = [];
    }
    const firstFill = shift !== this.shift || !this.walkers.length && !this.cars.length;
    this.shift = shift;
    const local = hero && { ...hero, x: hero.x - shift, speed: Math.hypot(hero.vx, hero.vy) };
    if (to < FOREST.from - DESPAWN - 600 || from > FOREST.to + DESPAWN + 600) {
      this.walkers = [];
      this.cars = [];
      this.aircraft = null;
      return;
    }
    for (const person of this.crowds) this.stepPerson(person, dt, local);
    this.stepBirds(dt, from, to, local);
    this.stepHerds(dt, from, to, local);
    this.stepBoats(dt, local);
    this.stepFish(dt, from, to);
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
    const near = (spans, item) => spans.some(([a, b]) => item.x >= Math.max(a, from - SPAWN_FAR) && item.x <= Math.min(b, to + SPAWN_FAR));
    const room = spans => spans.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to + SPAWN_FAR) - Math.max(a, from - SPAWN_FAR)), 0);
    let walkers = 0;
    for (const person of this.walkers) if (near(TRAILS, person)) walkers++;
    for (let tries = fill || 1; tries > 0 && walkers < room(TRAILS) / WALKER_SPACING; tries--) {
      const x = this.spawnIn(zones, TRAILS, 24);
      if (x === null) continue;
      this.walkers.push(this.person(x));
      walkers++;
    }
    const forestRoads = ROADS.map(([a, b]) => [Math.max(a, FOREST.from), Math.min(b, FOREST.to)]);
    for (const lane of LANES.keys()) {
      let cars = 0;
      for (const car of this.cars) if (car.lane === lane && near(forestRoads, car)) cars++;
      for (let tries = fill || 1; tries > 0 && cars < room(forestRoads) / CAR_SPACING; tries--) {
        const x = this.spawnIn(zones, forestRoads, 20);
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

  // A random x inside both the spawn zones and the given spans, or null.
  spawnIn(zones, spans, inset) {
    const parts = [];
    for (const [za, zb] of zones) {
      for (const [sa, sb] of spans) {
        const a = Math.max(za, sa + inset);
        const b = Math.min(zb, sb - inset);
        if (b > a) parts.push([a, b]);
      }
    }
    const total = parts.reduce((sum, [a, b]) => sum + b - a, 0);
    if (!total) return null;
    let roll = this.random() * total;
    for (const [a, b] of parts) {
      if (roll < b - a) return a + roll;
      roll -= b - a;
    }
    return null;
  }

  // Where the road ends ahead of a car at x heading dir: the lakeside turnaround, or far away
  // otherwise the shared shore check.
  roadEnd(x, dir) {
    const west = x < (LAKE.from + LAKE.to) / 2;
    if (west && dir > 0) return ROADS[0][1];
    if (!west && dir < 0) return ROADS[1][0];
    return super.roadEnd(x, dir);
  }

  onRoad(x) {
    return ROADS.some(([a, b]) => x > a && x < b);
  }

  stepBirds(dt, from, to, hero) {
    super.stepBirds(dt, from, to, hero);
    // Rafts on the water drift slowly back and forth while settled.
    for (const flock of this.flocks) {
      if (flock.state !== 'perched' || flock.height > 0) continue;
      for (const bird of flock.birds) {
        bird.dx += (bird.drift ?? 0) * dt;
        if (Math.abs(bird.dx) > flock.spread) bird.drift = -Math.sign(bird.dx) * Math.abs(bird.drift ?? 1);
        if (bird.drift) bird.dir = Math.sign(bird.drift);
      }
    }
  }

  // Animals graze and wander; a hero coming close (or rushing past) sends them bounding away.
  // They return only once their home is off screen.
  stepHerds(dt, from, to, hero) {
    for (const herd of this.herds) {
      const spec = ANIMAL[herd.kind];
      const middle = (herd.home[0] + herd.home[1]) / 2;
      const onScreen = herd.home[1] > from - 30 && herd.home[0] < to + 30;
      if (herd.state === 'gone') {
        herd.timer -= dt;
        if (herd.timer <= 0 && !onScreen) this.herd(herd);
        continue;
      }
      if (herd.state === 'flee') {
        herd.timer -= dt;
        for (const animal of herd.members) {
          animal.x += animal.dir * spec.flee * dt;
          animal.phase += dt * 14;
          // Bounding: each animal hops along its own rhythm.
          animal.hv -= 260 * dt;
          animal.h = Math.max(0, animal.h + animal.hv * dt);
          if (animal.h === 0) animal.hv = herd.kind === 'deer' ? 70 : 45;
        }
        if (herd.timer <= 0) Object.assign(herd, { state: 'gone', timer: BIRD.regroup });
        continue;
      }
      if (hero) {
        const dx = Math.abs(hero.x - middle);
        const reach = (herd.home[1] - herd.home[0]) / 2 + spec.startle;
        if (hero.altitude < 90 && (dx < reach || hero.speed >= FAST && dx < reach + 80)) {
          herd.state = 'flee';
          herd.timer = 3.5;
          for (const animal of herd.members) {
            animal.dir = Math.sign(animal.x - hero.x) || 1;
            animal.hv = 40 + this.random() * 40;
          }
          continue;
        }
      }
      for (const animal of herd.members) {
        animal.timer -= dt;
        animal.phase += dt * (animal.target === null ? 2 : 8);
        if (animal.target !== null) {
          animal.x += animal.dir * spec.flee * 0.15 * dt;
          if ((animal.target - animal.x) * animal.dir <= 0) animal.target = null;
        } else if (animal.timer <= 0) {
          animal.timer = 2 + this.random() * 5;
          animal.graze = this.random() < 0.6;
          if (this.random() < 0.5) {
            animal.target = herd.home[0] + this.random() * (herd.home[1] - herd.home[0]);
            animal.dir = Math.sign(animal.target - animal.x) || 1;
          }
        }
      }
    }
  }

  // Boats cross the lake, pause, and come back. A RAM's wake rocks them and the crew ducks.
  stepBoats(dt, hero) {
    const wake = hero && this.wake(hero) && hero.altitude < ROCK.altitude + 20;
    for (const boat of this.boats) {
      boat.phase += dt;
      if (boat.pause > 0) boat.pause -= dt;
      else {
        boat.x += boat.dir * boat.speed * dt;
        if (boat.x < BOAT_LANE[0] || boat.x > BOAT_LANE[1]) {
          boat.x = Math.max(BOAT_LANE[0], Math.min(BOAT_LANE[1], boat.x));
          boat.dir *= -1;
          boat.pause = 2 + this.random() * 4;
        }
      }
      if (wake && Math.abs(hero.x - boat.x) < boat.length / 2 + WAKE.reach && boat.flinch <= 0) {
        boat.bounceSpeed += 55;
        boat.flinch = 1.2;
      }
      boat.flinch -= dt;
      boat.bounceSpeed += (-200 * boat.bounce - 6 * boat.bounceSpeed) * dt;
      boat.bounce += boat.bounceSpeed * dt;
    }
    const plane = this.seaplane;
    plane.phase += dt;
    if (wake && Math.abs(hero.x - plane.x) < 60 && plane.bounce < 1) plane.bounceSpeed += 45;
    plane.bounceSpeed += (-200 * plane.bounce - 6 * plane.bounceSpeed) * dt;
    plane.bounce += plane.bounceSpeed * dt;
  }

  killLakeFish(fish, vx, vy) {
    const idx = this.fish.indexOf(fish);
    if (idx !== -1) this.fish.splice(idx, 1);
    const p = Math.min(1, Math.max(0, fish.t / 0.7));
    const airH = Math.sin(p * Math.PI) * 11;
    const curX = fish.x + fish.dir * (p - 0.5) * 12;
    const upward = Math.max(120, Math.abs(vy || 0) * 0.9 + 70);
    const horiz = (vx || 0) * 0.5 + fish.dir * 30;

    // Blood droplets in air and water
    for (let k = 0; k < 8; k++) {
      this.lakeBlood.push({
        x: curX + (this.random() - 0.5) * 6,
        relY: -airH + (this.random() - 0.5) * 6,
        vx: horiz * (0.3 + this.random() * 0.5) + (this.random() - 0.5) * 40,
        vy: -upward * (0.3 + this.random() * 0.4) - 20 - this.random() * 30,
        age: 0,
        life: 0.7 + this.random() * 0.5,
        size: this.random() < 0.6 ? 1 : 2,
        color: this.random() < 0.5 ? 0x900c14 : 0xbf1822,
      });
    }

    this.deadFish.push({
      x: curX,
      relY: -Math.max(3, airH),
      dir: fish.dir,
      vx: horiz,
      vy: -upward,
      spinRate: (Math.sign(horiz) || 1) * (12.0 + this.random() * 8.0),
      angle: 0,
      inAir: true,
      flopping: false,
      flopAge: 0,
      twitch: 0,
      roll: 0,
      age: 0,
      bubbles: [],
    });
  }

  // Now and then a fish jumps somewhere on the lake in view.
  stepFish(dt, from, to) {
    this.fish = this.fish.filter(fish => (fish.t += dt) < 1.4);
    this.fishTimer -= dt;
    const a = Math.max(from, LAKE.from + 30);
    const b = Math.min(to, LAKE.to - 30);
    if (this.fishTimer <= 0 && b > a) {
      this.fishTimer = FISH_GAP[0] + this.random() * (FISH_GAP[1] - FISH_GAP[0]);
      this.fish.push({ x: a + this.random() * (b - a), dir: this.random() < 0.5 ? -1 : 1, t: 0 });
    }

    // Step lake casualties (blood & dead fish)
    for (const b of this.lakeBlood) {
      b.age += dt;
      b.vy += 380 * dt;
      b.relY += b.vy * dt;
      b.x += b.vx * dt;
      if (b.relY >= 0) b.age = b.life;
    }
    this.lakeBlood = this.lakeBlood.filter(b => b.age < b.life);

    for (const dead of this.deadFish) {
      dead.age += dt;
      if (dead.inAir) {
        dead.vy += 380 * dt;
        dead.relY += dead.vy * dt;
        dead.x += dead.vx * dt;
        dead.angle += dead.spinRate * dt;
        dead.roll = Math.min(1.0, dead.age * 1.6);
        if (dead.relY >= 0) {
          dead.inAir = false;
          dead.relY = 0;
          dead.vy = 0;
          dead.vx *= 0.15;
          dead.angle = 0;
          dead.spinRate = 0;
          dead.flopping = true;
          dead.flopAge = 0;
        }
      } else {
        dead.x += dead.dir * 2.5 * dt;
        if (dead.flopping) {
          dead.flopAge += dt;
          const flopDecay = Math.exp(-dead.flopAge * 4.0);
          const spasm = flopDecay * Math.sin(dead.flopAge * 36);
          dead.twitch = spasm;
          dead.roll = Math.min(1.0, Math.max(dead.roll, (1 - flopDecay) * 1.25 + Math.abs(spasm) * 0.3));
          dead.relY = -Math.abs(spasm) * 2 + Math.sin(dead.age * 2.5) * 0.8;
          if (dead.flopAge >= 1.2) {
            dead.flopping = false;
            dead.roll = 1.0;
            dead.twitch = 0;
          }
        } else {
          dead.roll = 1.0;
          dead.twitch = 0;
          if (dead.age < 4.0) {
            dead.relY = Math.sin(dead.age * 2.0) * 1.0;
          } else {
            const sinkTime = dead.age - 4.0;
            dead.relY = Math.sin(dead.age * 2.0) * 0.8 + sinkTime * 4.5;
            if (dead.relY > 2 && this.random() < dt * 4) {
              dead.bubbles.push({
                dx: (this.random() - 0.5) * 6,
                dy: dead.relY,
                vy: 14 + this.random() * 10,
                r: 1,
              });
            }
          }
        }
      }

      for (const b of dead.bubbles) b.dy -= b.vy * dt;
      dead.bubbles = dead.bubbles.filter(b => b.dy > 0);
    }
    this.deadFish = this.deadFish.filter(f => f.age < 8);
  }

  // Back to front: herons, animals and the back pavement, then traffic, the front pavement, boats,
  // the seaplane and water birds, then birds in flight and the rain.
  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    const beyond = Math.max(FOREST.from - centre, centre - FOREST.to, 0);
    if (beyond > DESPAWN + 900) return;
    const rain = this.rain * Math.max(0, 1 - beyond / 800);
    if (rain > 0.01) {
      g.fillStyle(0x4a5a68, 0.2 * rain);
      g.fillRect(left, top, right - left, bottom - top);
    }
    const visible = item => item.x + this.shift > left - 60 && item.x + this.shift < right + 60;
    const people = [...this.crowds, ...this.walkers].filter(visible);
    const flocks = this.flocks.filter(flock => flock.state !== 'gone' && flock.x + this.shift > left - 300 && flock.x + this.shift < right + 300);
    for (const flock of flocks) if (flock.state === 'perched' && flock.height > 0) this.drawPerched(g, flock, groundAt);
    for (const herd of this.herds) if (herd.state !== 'gone') this.drawHerd(g, herd, groundAt, left, right);
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
    if (visible(this.seaplane)) this.drawAfloat(g, this.seaplane, groundAt, this.drawMoored);
    for (const boat of this.boats) if (visible(boat)) this.drawAfloat(g, boat, groundAt);
    for (const fish of this.fish) this.drawFish(g, fish, groundAt);
    this.drawLakeCasualties(g, groundAt, left, right);
    for (const flock of flocks) if (flock.state === 'perched' && flock.height === 0) this.drawWaterBirds(g, flock, groundAt);
    for (const flock of flocks) if (flock.state === 'flying') this.drawFlying(g, flock, groundAt);
    if (rain > 0.01) this.drawRain(g, left, right, top, bottom, rain);
  }

  drawWaterBirds(g, flock, groundAt) {
    for (const bird of flock.birds) {
      const x = Math.round(flock.x + bird.dx + this.shift);
      const y = Math.round(groundAt(x)) + 1;
      const d = bird.dir;
      if (flock.kind === 'heron') {
        // Grey heron, about a metre tall, wading on stilt legs with an S-necked head.
        const stab = Math.sin(bird.phase + this.clock * 0.8) > 0.92 ? 2 : 0;
        g.fillStyle(0x5d636b);
        g.fillRect(x, y - 6, 1, 6);
        g.fillStyle(0x8f979e);
        g.fillRect(x - 3, y - 10, 6, 4);
        g.fillRect(x + d * 2, y - 14 + stab, 1, 4);
        g.fillStyle(0xd8dcde);
        g.fillRect(x + d * 2, y - 15 + stab, 2 * d > 0 ? 2 : 1, 2);
        g.fillStyle(0xc9a46a);
        g.fillRect(x + d * 4 - (d < 0 ? 1 : 0), y - 14 + stab, 2, 1);
        continue;
      }
      const bob = Math.round(Math.sin(this.clock * 2 + bird.phase) * 0.5);
      if (flock.kind === 'swan') {
        g.fillStyle(0xf2f2ee);
        g.fillRect(x - 4, y - 3 + bob, 8, 3);
        g.fillRect(x + d * 3, y - 8 + bob, 1, 5);
        g.fillRect(x + d * 3, y - 8 + bob, d > 0 ? 2 : -1, 1);
        g.fillStyle(0xd9773a);
        g.fillRect(x + d * 5 - (d < 0 ? 1 : 0), y - 8 + bob, 1, 1);
        continue;
      }
      g.fillStyle(bird.color ?? 0x7a6a52);
      g.fillRect(x - 2, y - 2 + bob, 5, 2);
      g.fillStyle(bird.color ? 0x7a6a52 : 0x3f6e52);
      g.fillRect(x + d * 2, y - 4 + bob, 2, 2);
      g.fillStyle(0xd6b04c);
      g.fillRect(x + d * 3 + (d > 0 ? 1 : -1), y - 3 + bob, 1, 1);
    }
  }

  drawHerd(g, herd, groundAt, left, right) {
    const spec = ANIMAL[herd.kind];
    for (const animal of herd.members) {
      const x = Math.round(animal.x + this.shift);
      if (x < left - 30 || x > right + 30) continue;
      const feet = Math.round(groundAt(x)) + 1 - Math.round(animal.h);
      const d = animal.dir;
      const moving = herd.state === 'flee' || animal.target !== null;
      const step = moving ? Math.round(Math.sin(animal.phase) * 1.5) : 0;
      if (herd.kind === 'deer') {
        // About 1.6 m long and 1 m at the shoulder; the buck carries antlers.
        const body = 8;
        g.fillStyle(spec.color);
        g.fillRect(x - body, feet - 13, 16, 6);
        g.fillRect(x - body + 1 + step, feet - 7, 1, 7);
        g.fillRect(x - body + 4 - step, feet - 7, 1, 7);
        g.fillRect(x + body - 4 + step, feet - 7, 1, 7);
        g.fillRect(x + body - 2 - step, feet - 7, 1, 7);
        g.fillStyle(spec.belly);
        g.fillRect(x - body + 1, feet - 8, 14, 1);
        g.fillRect(d > 0 ? x - body - 1 : x + body, feet - 13, 1, 2);
        const grazing = animal.graze && !moving;
        const hx = x + d * (body + 1);
        g.fillStyle(spec.color);
        if (grazing) {
          g.fillRect(Math.min(hx, hx + d * 3), feet - 9, 4, 3);
          g.fillRect(hx + d * 3 - (d < 0 ? 1 : 0), feet - 6, 2, 3);
        } else {
          g.fillRect(hx - (d < 0 ? 1 : 0), feet - 18, 2, 6);
          g.fillRect(hx + (d > 0 ? 0 : -3), feet - 19, 4, 3);
          g.fillStyle(0x3b2e24);
          g.fillRect(hx + d * 3 + (d > 0 ? 0 : -1), feet - 18, 1, 1);
          if (animal.buck) {
            g.fillStyle(0xc9b48a);
            g.fillRect(hx, feet - 24, 1, 5);
            g.fillRect(hx - d * 2, feet - 23, 2, 1);
            g.fillRect(hx + d, feet - 25, 1, 2);
          }
        }
        continue;
      }
      if (herd.kind === 'fox') {
        g.fillStyle(spec.color);
        g.fillRect(x - 4, feet - 5, 8, 3);
        g.fillRect(x - 3 + step, feet - 2, 1, 2);
        g.fillRect(x + 2 - step, feet - 2, 1, 2);
        g.fillRect(x + d * 4 - (d < 0 ? 2 : 0), feet - 7, 3, 3);
        g.fillRect(x + d * 4 + (d > 0 ? 1 : -1), feet - 8, 1, 1);
        g.fillRect(x - d * 5 - (d > 0 ? 3 : 0), feet - 5, 4, 2);
        g.fillStyle(spec.belly);
        g.fillRect(x - d * 8 - (d > 0 ? 0 : 0), feet - 5, 1, 2);
        g.fillRect(x + d * 5, feet - 5, 1, 1);
        continue;
      }
      // Squirrel: a tiny body with a tall bushy tail.
      g.fillStyle(spec.color);
      g.fillRect(x - 1, feet - 3, 3, 3);
      g.fillRect(x + d * 2, feet - 4, 1, 2);
      g.fillRect(x - d * 2, feet - 6, 1, 5);
      g.fillRect(x - d * 3, feet - 7, 1, 3);
    }
  }

  // Boats sit in the water: the hull rides the surface line with a pale wake ripple.
  drawBoat(g, boat, groundAt) {
    const x = Math.round(boat.x + this.shift);
    const water = Math.round(groundAt(x)) + 1;
    const bob = Math.round(Math.sin(boat.phase * 1.6) * 0.6 + Math.max(-1, Math.min(3, boat.bounce)));
    const half = Math.round(boat.length / 2);
    const y = water - bob;
    const d = boat.dir;
    if (boat.pause <= 0) {
      g.fillStyle(0xe6f2f6, 0.5);
      g.fillRect(x - d * (half + 8) - 4, water, 8, 1);
      g.fillRect(x - d * (half + 16) - 2, water + 1, 4, 1);
    }
    const ducking = boat.flinch > 0;
    if (boat.kind === 'sailboat') {
      g.fillStyle(boat.paint);
      g.fillRect(x - half, y - 3, half * 2, 3);
      g.fillTriangle(x + d * half, y - 3, x + d * (half + 3), y - 4, x + d * half, y);
      g.fillStyle(boat.stripe ?? 0x4f6a86);
      g.fillRect(x - half, y - 1, half * 2, 1);
      g.fillStyle(0x6b5038);
      g.fillRect(x, y - 30, 1, 27);
      g.fillStyle(boat.sail ?? 0xf4f1ea);
      const lean = Math.round(Math.sin(this.clock * 0.7 + boat.phase));
      g.fillTriangle(x + 1, y - 29, x + 1, y - 6, x - d * 13 + lean, y - 6);
      g.fillTriangle(x + 1, y - 27, x + 1, y - 7, x + d * 9, y - 7);
      g.fillStyle(boat.burgee ?? 0xb84a3e);
      g.fillRect(x, y - 32, 3, 2);
      this.drawSeated(g, boat.crew[0], x - d * 6, y - 3, ducking);
      return;
    }
    g.fillStyle(boat.paint);
    g.fillRect(x - half + 1, y - 3, half * 2 - 2, 3);
    g.fillTriangle(x - half - 2, y - 4, x - half + 1, y - 3, x - half + 1, y);
    g.fillTriangle(x + half + 2, y - 4, x + half - 1, y - 3, x + half - 1, y);
    g.fillStyle(boat.trim ?? 0x000000, boat.trim ? 1 : 0.18);
    g.fillRect(x - half + 1, y - 1, half * 2 - 2, 1);
    if (boat.kind === 'canoe') {
      for (const [i, sx] of [[0, -0.5], [1, 0.45]]) {
        const seat = x + Math.round(sx * half);
        this.drawSeated(g, boat.crew[i], seat, y - 3, ducking);
        if (ducking) continue;
        // Paddles dip on alternate sides, out of phase.
        const stroke = Math.sin(this.clock * 3 + i * Math.PI);
        g.fillStyle(0x8a6a4a);
        const px = seat + Math.round(stroke * 3);
        g.fillRect(px, y - 9, 1, 9 + (stroke > 0 ? 2 : 0));
        g.fillRect(px - 1, y + (stroke > 0 ? 1 : -1), 3, 2);
      }
      return;
    }
    // Rowboat with an outboard and an angler trailing a line.
    g.fillStyle(0x3b3f44);
    g.fillRect(x - d * (half + 1) - 1, y - 6, 3, 4);
    g.fillRect(x - d * (half + 1), y - 2, 1, 4);
    this.drawSeated(g, boat.crew[0], x, y - 3, ducking);
    if (!ducking) {
      g.fillStyle(0x5a4632);
      for (let i = 0; i < 8; i++) g.fillRect(x + d * (2 + i), y - 9 - Math.round(i * 0.6), 1, 1);
      g.fillStyle(0xe8ecee, 0.6);
      g.fillRect(x + d * 10, y - 14, 1, 14);
    }
  }

  // A seated figure: torso and head above a seat, ducked low after a RAM.
  drawSeated(g, person, x, seat, ducking) {
    const h = ducking ? 4 : 7;
    g.fillStyle(person.shirt);
    g.fillRect(x - 1, seat - h, 3, h);
    g.fillStyle(person.skin);
    g.fillRect(x - 1, seat - h - 3, 3, 3);
    g.fillStyle(person.hair);
    g.fillRect(x - 1, seat - h - 3, 3, 1);
  }

  // Seaplane on floats at the boathouse dock: cream fuselage, a red stripe and a still prop.
  drawSeaplane(g, groundAt) {
    const plane = this.seaplane;
    const x = Math.round(plane.x + this.shift);
    const water = Math.round(groundAt(x)) + 1;
    const y = water - Math.round(Math.sin(plane.phase * 1.3) * 0.6 + Math.max(-1, Math.min(3, plane.bounce)));
    g.fillStyle(0xd9dcd8);
    g.fillRect(x - 18, y - 2, 30, 2);
    g.fillStyle(0x8f979e);
    g.fillRect(x - 12, y - 6, 1, 4);
    g.fillRect(x + 4, y - 6, 1, 4);
    g.fillStyle(0xeae5d8);
    g.fillRect(x - 20, y - 12, 34, 6);
    g.fillTriangle(x - 20, y - 12, x - 26, y - 21, x - 20, y - 6);
    g.fillRect(x - 28, y - 21, 6, 3);
    g.fillStyle(0xb84a3e);
    g.fillRect(x - 20, y - 9, 34, 1);
    g.fillRect(x - 27, y - 20, 4, 2);
    g.fillStyle(0xeae5d8);
    g.fillRect(x - 8, y - 15, 22, 3);
    g.fillStyle(GLASS);
    g.fillRect(x + 6, y - 12, 5, 3);
    g.fillRect(x - 2, y - 12, 6, 3);
    g.fillStyle(0x3b3f44);
    g.fillRect(x + 14, y - 11, 2, 4);
    g.fillRect(x + 16, y - 14, 1, 10);
  }

  drawFish(g, fish, groundAt) {
    const x0 = Math.round(fish.x + this.shift);
    const water = Math.round(groundAt(x0)) + 1;
    const t = fish.t;
    if (t < 0.7) {
      const p = t / 0.7;
      const x = x0 + Math.round(fish.dir * (p - 0.5) * 12);
      const y = water - Math.round(Math.sin(p * Math.PI) * 11);
      g.fillStyle(0x8fa6a8);
      g.fillRect(x - 2, y - 1, 4, 2);
      g.fillRect(x - fish.dir * 3, y - (p < 0.5 ? 2 : 0), 1, 2);
    }
    // Rings spread where it went in and came out.
    for (const [at, from] of [[x0 - fish.dir * 6, 0], [x0 + fish.dir * 6, 0.7]]) {
      const age = t - from;
      if (age < 0 || age > 0.7) continue;
      const spread = Math.round(2 + age * 12);
      g.fillStyle(0xe6f2f6, 0.6 * (1 - age / 0.7));
      g.fillRect(at - spread, water, spread * 2, 1);
    }
  }

  drawLakeCasualties(g, groundAt, left, right) {
    // 1. Lake blood droplets & stains
    for (const b of this.lakeBlood) {
      const bx = b.x + this.shift;
      if (bx < left - 20 || bx > right + 20) continue;
      const water = Math.round(groundAt(bx)) + 1;
      const by = water + b.relY;
      const fade = Math.max(0, 1 - b.age / b.life);
      g.fillStyle(b.color, fade);
      g.fillRect(Math.round(bx), Math.round(by), b.size, b.size);
    }

    // 2. Dead lake fish (ballistic launch, surface flopping, upside down with X eye, sink)
    for (const dead of this.deadFish) {
      const fx = dead.x + this.shift;
      if (fx < left - 30 || fx > right + 30) continue;
      const water = Math.round(groundAt(fx)) + 1;
      const fy = water + dead.relY;
      const dir = dead.dir;
      const sinkAlpha = dead.age > 5.0 ? Math.max(0, 1 - (dead.age - 5.0) / 3.0) : 1;

      g.save();
      g.translateCanvas(Math.round(fx), Math.round(fy));
      if (dead.inAir) {
        g.rotateCanvas(dead.angle);
      } else if (dead.flopping) {
        g.rotateCanvas(dead.twitch * 0.45);
      } else {
        g.rotateCanvas(Math.PI); // Belly-up
      }

      // Dark dorsal spine (underneath when belly-up)
      g.fillStyle(0x385052, sinkAlpha);
      g.fillRect(-4, -1, 8, 1);
      // Trout silver flank
      g.fillStyle(0x8fa6a8, sinkAlpha);
      g.fillRect(-3, 0, 6, 1);
      // Pale underbelly (on top when belly-up)
      g.fillStyle(0xe8f0f0, 0.95 * sinkAlpha);
      g.fillRect(-2, 0, 4, 1);

      // Tail fin
      g.fillStyle(0x6a8284, sinkAlpha);
      const tailX = -dir * 4;
      g.fillRect(tailX, -1, 1, 3);
      g.fillRect(tailX - dir * 1, -2, 1, 1);
      g.fillRect(tailX - dir * 1, 2, 1, 1);

      // Pectoral fin
      g.fillStyle(0xcce2e4, 0.7 * sinkAlpha);
      g.fillRect(-dir * 1, -2, 2, 1);

      // Arcade dead 'X' eye
      const eyeX = dir * 2;
      g.fillStyle(0x1a2628, sinkAlpha);
      g.fillRect(eyeX - 1, -1, 1, 1);
      g.fillRect(eyeX + 1, -1, 1, 1);
      g.fillRect(eyeX, 0, 1, 1);
      g.fillRect(eyeX - 1, 1, 1, 1);
      g.fillRect(eyeX + 1, 1, 1, 1);

      g.restore();

      // Flopping splash rings on calm lake
      if (dead.flopping && Math.abs(dead.twitch) > 0.25) {
        g.fillStyle(0xe6f2f6, 0.75);
        g.fillRect(Math.round(fx - 3), water - 1, 6, 1);
        g.fillRect(Math.round(fx + (Math.sin(dead.age * 28) > 0 ? 3 : -3)), water - 2, 1, 1);
      }

      // Rising oxygen bubbles during sinking
      if (dead.bubbles.length > 0) {
        g.fillStyle(0xdcf4fc, 0.8 * sinkAlpha);
        for (const b of dead.bubbles) {
          g.fillRect(Math.round(fx + b.dx), Math.round(water + b.dy), b.r, b.r);
        }
      }
    }
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'pickup') this.drawPickup(g, car, groundAt);
    else if (car.kind === 'logtruck') this.drawLogTruck(g, car, groundAt);
    else if (car.kind === 'camper') this.drawCamper(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  // Shared chassis for the forest's own vehicles: tilted with the road, bobbing on its springs.
  chassis(g, car, groundAt) {
    const x = Math.round(car.x + this.shift);
    const dir = LANES[car.lane].dir;
    const base = Math.round(groundAt(x)) + LANES[car.lane].y;
    const length = Math.round(car.length);
    const left = x - Math.round(length / 2);
    const lift = Math.round(Math.max(-1, Math.min(3, car.bounce)));
    g.save();
    g.translateCanvas(x, base);
    g.rotateCanvas(Math.atan2(groundAt(x + length / 2) - groundAt(x - length / 2), length) + (car.pitch ?? 0));
    g.translateCanvas(-x, -base);
    g.fillStyle(0x000000, 0.18);
    g.fillRect(left, base - 1, length, 1);
    // front(t): x at fraction t of the length from the tail toward the nose.
    const front = t => dir > 0 ? left + t * length : left + (1 - t) * length;
    return { x, dir, base, length, left, lift, front, roll: car.roll ?? 0 };
  }

  lights(g, car, c, y) {
    g.fillStyle(0xf4ecc8);
    g.fillRect(c.dir > 0 ? c.left + c.length - 2 : c.left, y, 2, 2);
    g.fillStyle(braking(car) ? 0xff5a4a : 0xb8473f);
    g.fillRect(c.dir > 0 ? c.left : c.left + c.length - 2, y, 2, 2);
  }

  wheels(g, c, list, radius) {
    for (const t of list) wheelAt(g, c.left + Math.round(t * c.length), c.base - radius, radius, c.roll);
  }

  // Ranger pickup: forest green, a cab at the front, an open bed and a gold door badge.
  drawPickup(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const deck = sill - Math.round(car.height * 0.42);
    const roof = c.base - Math.round(car.height) - c.lift;
    const [ca, cb] = [c.front(0.45), c.front(0.78)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(c.left, deck, c.length, sill - deck);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), deck - roof);
    g.fillStyle(GLASS);
    g.fillRect(Math.round(ca) + 2, roof + 2, Math.round(cb - ca) - 4, deck - roof - 2);
    g.fillStyle(car.paint);
    g.fillRect(Math.round((ca + cb) / 2) - 1, roof + 2, 2, deck - roof - 2);
    g.fillStyle(0x000000, 0.15);
    g.fillRect(Math.round(Math.min(c.front(0), c.front(0.42))), deck, Math.round(c.length * 0.42), 1);
    g.fillStyle(0xd6b04c);
    g.fillRect(Math.round(c.front(0.6)), deck + 2, 2, 2);
    this.lights(g, car, c, deck + 1);
    this.wheels(g, c, [0.18, 0.8], wheel);
    g.restore();
  }

  // Logging truck: an olive cab with a tall exhaust, pulling a trailer stacked with logs.
  drawLogTruck(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height * 0.85) - c.lift;
    const [ca, cb] = [c.front(0.8), c.front(1)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof);
    g.fillStyle(GLASS);
    g.fillRect(Math.round(c.dir > 0 ? cb - 6 : ca + 2), roof + 2, 4, 5);
    g.fillStyle(0x7d8286);
    g.fillRect(Math.round(c.dir > 0 ? ca - 1 : cb), roof - 4, 1, 10);
    // Trailer bed with stakes and a stack of logs, ends showing pale rings at the tail.
    const [ta, tb] = [c.front(0), c.front(0.78)].sort((a, b) => a - b);
    g.fillStyle(0x3b3f44);
    g.fillRect(Math.round(ta), sill - 2, Math.round(tb - ta), 2);
    const top = c.base - Math.round(car.height) - c.lift;
    g.fillStyle(0x7a5638);
    for (let row = 0, ly = sill - 5; ly > top; ly -= 4, row++) g.fillRect(Math.round(ta) + row, ly, Math.round(tb - ta) - row * 2, 4);
    g.fillStyle(0x5a3e2a);
    for (let ly = sill - 5; ly > top; ly -= 4) g.fillRect(Math.round(ta), ly + 3, Math.round(tb - ta), 1);
    g.fillStyle(0xc9a46a);
    const tail = c.dir > 0 ? Math.round(ta) : Math.round(tb) - 2;
    for (let ly = sill - 4; ly > top; ly -= 4) g.fillRect(tail, ly, 2, 2);
    g.fillStyle(0x3b3f44);
    for (const t of [0.05, 0.4, 0.73]) g.fillRect(Math.round(c.front(t)), top - 1, 1, sill - top);
    this.lights(g, car, c, sill - 6);
    this.wheels(g, c, [0.1, 0.22, 0.6, 0.9], wheel);
    g.restore();
  }

  // Camper van: cream body with a brown stripe, a cab-over bunk and a row of windows.
  drawCamper(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const [ba, bb] = [c.front(0), c.front(0.86)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ba), roof, Math.round(bb - ba), sill - roof);
    const [na, nb] = [c.front(0.86), c.front(1)].sort((a, b) => a - b);
    g.fillRect(Math.round(na), roof + 8, Math.round(nb - na), sill - roof - 8);
    g.fillStyle(GLASS);
    g.fillRect(Math.round(c.dir > 0 ? nb - 5 : na + 1), roof + 9, 4, 4);
    for (const t of [0.15, 0.4, 0.62]) g.fillRect(Math.round(c.front(t)) - 3, roof + 4, 6, 4);
    g.fillStyle(0x8a6a4a);
    g.fillRect(Math.round(ba), roof + 11, Math.round(nb - ba), 2);
    g.fillStyle(0x6e5c54);
    g.fillRect(Math.round(c.front(0.28)) - 2, roof + 4, 4, sill - roof - 5);
    this.lights(g, car, c, sill - 4);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }
}
