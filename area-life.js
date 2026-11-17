import { CIRCUMFERENCE, isWater } from './planet.js';
import { CityLife, HERO_HEIGHT } from './city-life.js';
import { ForestLife } from './forest-life.js';

// Shared life for a town or village laid along one road, following
// game-design-rules/city-life-rules.md. It keeps Green City's people, reactions, pigeons, doors,
// buses, weather and sky traffic (city-life.js) and the forest's vehicle chassis (forest-life.js), and
// takes the area as data instead of hard-wiring one place:
// - area: { from, to } the area's world span; walkers turn back at its ends and traffic spawns in it.
// - hotspots: { landmarkId: [count, reach px, extra] }: crowds that mill around the landmarks; extra
//   is merged into each person (a hat, a basket, an apron).
// - stops: x of each bus stop. Up to two people queue at each from the start.
// - ends: [west, east] world x where the road stops and traffic turns back (null: it runs on into
//   the next area). Roads also always end short of open water (city-life.js).
// - weather: another area's life whose showers this one shares, picking up the rain where that
//   area's own shower thins out past weatherEdge.
// Subclasses add their own cast: herds, birds, vehicles and hats.
const METRE = HERO_HEIGHT / 1.85;
export const LANES = [{ dir: -1, y: 1 }, { dir: 1, y: 2 }];
const SAFE_GAP = 2 * METRE;
const SPAWN_NEAR = 60;
const SPAWN_FAR = 220;
const DESPAWN = 340;
const WEATHER_FADE = 800;
const BASKET = 0xb8955a;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class AreaLife extends CityLife {
  constructor(random, { area, landmarks, hotspots, stops = [], ends = [null, null], weather = null, weatherEdge = null,
    walkerSpacing = 130, carSpacing = 380, seed = 700 }) {
    super(random);
    Object.assign(this, { area, ends, weather, weatherEdge, walkerSpacing, carSpacing, underpasses: [] });
    this.mid = (area.from + area.to) / 2;
    this.walkers = [];
    this.cars = [];
    this.crowds = [];
    for (const landmark of landmarks) {
      const [count, reach, extra = {}] = hotspots[landmark.id] ?? [0, 0];
      for (let i = 0; i < count; i++, seed++) {
        const person = this.person(landmark.x + (hash(seed) - 0.5) * 2 * reach, hash(seed + 0.3));
        Object.assign(person, { home: [landmark.x - reach, landmark.x + reach], state: 'idle', timer: hash(seed + 0.6) * 4 },
          typeof extra === 'function' ? extra(i) : extra);
        this.crowds.push(person);
      }
    }
    this.stops = stops.map(x => ({ x, timer: 0 }));
    for (const stop of this.stops) for (let i = 0; i < 2; i++, seed++) this.crowds.push(this.waiter(stop, hash(seed + 0.9)));
    this.flocks = [];
    this.herds = [];
    this.doors = [];
  }

  get streetSpan() {
    return [this.area.from, this.area.to];
  }

  walkBounds(person) {
    if (this.walkSpans && person) {
      for (const [from, to] of this.walkSpans) {
        if (person.x >= from && person.x <= to) {
          return [from + 20, to - 20];
        }
      }
    }
    const from = this.area?.from ?? 0;
    const to = this.area?.to ?? 0;
    return [from + 20, to - 20];
  }

  roadEnd(x, dir) {
    let bound = super.roadEnd(x, dir);
    if (this.roadSpans) {
      for (const [from, to] of this.roadSpans) {
        if (x >= from && x <= to) {
          const spanEnd = dir > 0 ? to - 30 : from + 30;
          bound = dir > 0 ? Math.min(bound, spanEnd) : Math.max(bound, spanEnd);
          break;
        }
      }
    }
    return bound;
  }

  // Shares another area's showers when given its life; otherwise keeps its own.
  stepWeather(dt) {
    if (!this.weather) return super.stepWeather(dt);
    this.rain = this.weather.rain;
    this.raining = this.weather.raining;
  }

  // How much of the shower to draw with the view centred at x (local planet copy).
  rainAt(centre) {
    const { from, to } = this.area;
    const east = Math.max(0, 1 - Math.max(0, centre - to) / WEATHER_FADE);
    // Sharing a neighbour's shower, take over exactly where its own rain thins out.
    const west = this.weather ? Math.min(1, Math.max(0, (centre - this.weatherEdge) / WEATHER_FADE))
      : Math.max(0, 1 - Math.max(0, from - centre) / WEATHER_FADE);
    return this.rain * west * east;
  }

  step(dt, left, right, hero = null) {
    this.clock += dt;
    this.stepWeather(dt);
    const shift = Math.round(((left + right) / 2 - this.mid) / CIRCUMFERENCE) * CIRCUMFERENCE;
    const from = left - shift;
    const to = right - shift;
    if (shift !== this.shift) {
      this.walkers = [];
      this.cars = [];
    }
    const firstFill = shift !== this.shift || !this.walkers.length && !this.cars.length;
    this.shift = shift;
    const local = hero && { ...hero, x: hero.x - shift, speed: Math.hypot(hero.vx, hero.vy) };
    if (to < this.area.from - DESPAWN - 600 || from > this.area.to + DESPAWN + 600) {
      this.walkers = [];
      this.cars = [];
      this.aircraft = null;
      return;
    }
    for (const person of this.crowds) this.stepPerson(person, dt, local);
    this.crowds = this.crowds.filter(person => !person.boarded);
    this.stepBirds(dt, from, to, local);
    if (this.herds.length) this.stepHerds(dt, from, to, local);
    this.stepStops(dt, from, to);
    this.stepDoors(dt, from, to);
    this.stepSky(dt, from, to);
    const keep = item => item.x > from - DESPAWN && item.x < to + DESPAWN;
    this.walkers = this.walkers.filter(person => keep(person) && !person.gone);
    this.cars = this.cars.filter(keep);
    for (const person of this.walkers) this.stepPerson(person, dt, local);
    this.view = [from, to];
    this.stepTraffic(dt, local);
    // On a fresh street, fill the view too; afterwards only off screen, so nothing pops in.
    const fill = this.fillTries(firstFill);
    const zones = fill ? [[from - SPAWN_FAR, to + SPAWN_FAR]]
      : [[from - SPAWN_FAR, from - SPAWN_NEAR], [to + SPAWN_NEAR, to + SPAWN_FAR]];
    const road = [this.area.from, this.area.to];
    const span = [Math.max(road[0], from - SPAWN_FAR), Math.min(road[1], to + SPAWN_FAR)];
    const room = Math.max(0, span[1] - span[0]);
    const inSpan = item => item.x >= span[0] && item.x <= span[1];
    let walkers = 0;
    for (const person of this.walkers) if (inSpan(person)) walkers++;
    const walkSpans = this.walkSpans ?? [road];
    for (let tries = fill || 1; tries > 0 && walkers < room / this.walkerSpacing; tries--) {
      const x = this.spawnIn(zones, walkSpans, 24);
      if (x === null || isWater(x, this.bridges)) continue;
      this.walkers.push(this.person(x));
      walkers++;
    }
    const roadSpans = this.roadSpans ?? [road];
    for (const lane of LANES.keys()) {
      let cars = 0;
      for (const car of this.cars) if (car.lane === lane && inSpan(car)) cars++;
      for (let tries = fill || 1; tries > 0 && cars < room / this.carSpacing; tries--) {
        const x = this.spawnIn(zones, roadSpans, 20);
        if (x === null || isWater(x, this.bridges)) continue;
        const car = this.car(x, lane);
        if (!this.roomToSpawn(car)) continue;
        if (this.cars.every(other => other.lane !== lane || Math.abs(other.x - x) > (other.length + car.length) / 2 + SAFE_GAP)) {
          this.cars.push(car);
          cars++;
        }
      }
    }
  }

  // Picks a vehicle type by weight from a list of { kind, length, height, weight, cruise? }.
  pickVehicle(list) {
    const total = list.reduce((sum, v) => sum + v.weight, 0);
    let roll = this.random() * total;
    return list.find(v => (roll -= v.weight) < 0) ?? list[0];
  }

  // Back to front: stops, perched birds, animals and the back pavement, then traffic, the front
  // pavement, birds in flight and the rain.
  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    const beyond = Math.max(this.area.from - centre, centre - this.area.to, 0);
    if (beyond > DESPAWN + 900) return;
    const rain = this.rainAt(centre);
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
    this.drawUnderpasses(g, groundAt, left, right);
    for (const person of people) if (person.lane === 1) this.drawFigure(g, person, groundAt);
    for (const flock of flocks) if (flock.state === 'flying') this.drawFlying(g, flock, groundAt);
    if (rain > 0.01) this.drawRain(g, left, right, top, bottom, rain);
  }

  // On top of the city's person: a hat from this.hats ({ color, shape: 'brim' | 'cap' | 'souwester'
  // | 'veil' | 'scarf' }) and, for pickers, a basket of fruit at the hip.
  drawPerson(g, person, groundAt) {
    super.drawPerson(g, person, groundAt);
    if (person.state === 'flinch' || person.state === 'board') return;
    const x = Math.round(person.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
    const h = person.height;
    const unit = v => Math.max(1, Math.round(v * h / 18));
    const alpha = person.fade ?? 1;
    const hop = person.state === 'look' && person.gesture === 'cheer'
      ? Math.round(Math.max(0, Math.sin(this.clock * 9 + person.phase)) * unit(2)) : 0;
    if (person.basket && person.state !== 'look') {
      const bx = x + person.dir * unit(2) - (person.dir < 0 ? unit(3) : 0);
      const by = feet - hop - unit(8);
      g.fillStyle(BASKET, alpha);
      g.fillRect(bx, by, unit(3), unit(2));
      g.fillStyle(person.basket, alpha);
      g.fillRect(bx, by - 1, unit(3), 1);
    }
    const hat = person.hat && this.hats?.[person.hat];
    if (!hat || person.umbrella && this.rain > 0.3 && person.state !== 'look') return;
    const head = unit(4);
    const headTop = feet - hop - unit(7) - unit(7) - head;
    const headLeft = x - Math.floor(head / 2) + (person.dir > 0 ? 0 : -1) + 1;
    g.fillStyle(hat.color, alpha);
    if (hat.shape === 'brim') {
      g.fillRect(headLeft - 1, headTop, head + 2, 1);
      g.fillRect(headLeft, headTop - 1, head, 1);
    } else if (hat.shape === 'souwester') {
      // Oilskin hat: a crown, and a brim that runs long down the back of the neck.
      g.fillRect(headLeft, headTop - 1, head, 2);
      g.fillRect(person.dir > 0 ? headLeft - 1 : headLeft + head, headTop, 1, unit(2.5));
    } else if (hat.shape === 'scarf') {
      // A headscarf or wrap: over the crown, its tail hanging down the back of the neck.
      g.fillRect(headLeft - 1, headTop - 1, head + 2, 2);
      g.fillRect(person.dir > 0 ? headLeft - 1 : headLeft + head, headTop, 1, unit(4));
    } else if (hat.shape === 'veil') {
      // A beekeeper's hat and veil, down over the face.
      g.fillRect(headLeft - 1, headTop - 1, head + 2, 1);
      g.fillStyle(0xe8ece6, 0.6 * alpha);
      g.fillRect(headLeft - 1, headTop, head + 2, head);
    } else {
      g.fillRect(headLeft, headTop - 1, head, 1);
      g.fillRect(person.dir > 0 ? headLeft + head : headLeft - 1, headTop, 1, 1);
    }
  }
}

// The forest's vehicle chassis, lights, wheels and pickup, and its spawn helper, fit any one road.
for (const name of ['spawnIn', 'chassis', 'lights', 'wheels', 'drawPickup']) {
  AreaLife.prototype[name] = ForestLife.prototype[name];
}
