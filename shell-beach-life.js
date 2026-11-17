import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { BayportLife } from './bayport-life.js';
import { BAYPORT } from './bayport-art.js';
import { elevation } from './planet.js';
import { BEACH_PROPS, PIER_DECK, SAND, SHELL_BEACH_BUILDINGS, SHELL_BEACH_LANDMARKS } from './shell-beach-art.js';

// Life on Shell Beach, following game-design-rules/city-life-rules.md (area-life.js does the walkers
// and the traffic on the sand):
// - Beachgoers in swimwear and sun hats; a queue at the ice cream kiosk; surfers with boards at the
//   surf shack; the lifeguard (the one accent: red and yellow) at the tower; anglers on the pier.
// - Sunbathers on towels by the umbrellas and windbreaks: they sit up to watch a hero who comes
//   close or blasts past.
// - Swimmers in the shallows: heads bobbing, arms splashing; they duck under a hero skimming the
//   water, and wave when it hovers.
// - People flying kites, and a dog walker whose dog runs rings round them and barks at the hero.
// - Crabs scuttling at the rock pools, which hide when the hero comes near.
// - Gulls on the hut roofs and a squabbling flock by the ice cream kiosk.
// - On the sand: a beach buggy, the ice cream van and the lifeguard quad. Like every road, the beach
//   track ends short of the water (city-life.js), so they turn back at the shore.
// Shell Beach shares Bayport's showers.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'buggy', length: 3.4 * METRE, height: 1.6 * METRE, weight: 2 },
  { kind: 'icecream', length: 5 * METRE, height: 2.5 * METRE, weight: 1 },
  { kind: 'quad', length: 2.1 * METRE, height: 1.3 * METRE, weight: 2 },
];
const CRUISE = [3 * METRE, 5 * METRE];
const LIFEGUARD = { shirt: 0xc4483e, pants: 0xd8b84a };
const SWIM = [0x4f6a86, 0x2f3540, 0x8c4f4a, 0x5f8f8a, 0x7a6f8f, 0x3e4652];
const BOARDS = [0x5f8f8a, 0xc98a5a, 0xe2dccb, 0x8aa0b0];
const TOWELS = [[0xc98a8a, 0xf0e8dc], [0x8aa0b0, 0xf0e8dc], [0xb0a46a, 0xf0e8dc], [0x8a9a7a, 0xe2dccb]];
const KITES = [0xc98a5a, 0x5f8f8a, 0x9a7aa0];
const DOG = [0x8a6a4a, 0x2f2a26, 0xd8c8a8];
const SAND_DRIFT = { startle: 70, height: 50 };
// The shallows, where swimmers bob: from the shore out past the pier's head.
const SHALLOWS = [15030, 15190];
const ROCK_POOLS = 15012;

const HOTSPOTS = {
  'sea-wall': [3, 30],
  'ice-cream-kiosk': [8, 34],
  'lifeguard-tower': [4, 36, i => i === 0 ? { ...LIFEGUARD, calm: true, busy: false, lifeguard: true } : {}],
  'surf-shack': [5, 36, i => ({ board: BOARDS[i % BOARDS.length], swim: true })],
};
const GULL = { color: [0xf2f4f2, 0xe6eaea] };

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class ShellBeachLife extends AreaLife {
  // weather: Bayport's life, whose showers the beach shares.
  constructor(random = Math.random, weather = null) {
    super(random, { area: SAND, landmarks: SHELL_BEACH_LANDMARKS, hotspots: HOTSPOTS, ends: [SAND.from + 40, null],
      weather, weatherEdge: BAYPORT.to, walkerSpacing: 120, carSpacing: 520, seed: 1500 });
    this.hats = { sun: { color: 0xd8c8a0, shape: 'brim' }, cap: { color: 0x4f6a86, shape: 'cap' } };
    // Anglers along the pier deck, standing safely on the boards.
    for (let i = 0; i < 4; i++) {
      const x = PIER_DECK.from + 25 + i * 36 + hash(1600 + i) * 10;
      const person = this.person(x, hash(1610 + i));
      Object.assign(person, { home: [x - 6, x + 6], state: 'idle', timer: hash(1620 + i) * 4, rod: true, dir: 1, pier: true,
        deck: 'shell-pier', deckLift: PIER_DECK.rise - Math.max(0, elevation(x)) });
      this.crowds.push(person);
    }
    // A dog walker and the dog.
    const walker = this.person(14700, 0.62);
    Object.assign(walker, { home: [14610, 14980], state: 'walk', calm: true, dog: { x: 14690, dir: 1, phase: 0, run: 0, bark: 0, color: DOG[0] } });
    this.crowds.push(walker);
    // People flying kites between the huts and the tower.
    for (const [i, x] of [14760, 14905].entries()) {
      const flyer = this.person(x, 0.05 + i * 0.03);
      Object.assign(flyer, { home: [x - 14, x + 14], state: 'idle', timer: 2, kite: { color: KITES[i], phase: i * 2 } });
      this.crowds.push(flyer);
    }
    for (const person of this.crowds) if (!person.lifeguard && !person.rod && hash(person.x) < 0.5) this.dress(person, hash(person.x * 3));
    this.sunbathers = BEACH_PROPS.filter(p => p.kind === 'umbrella' || p.kind === 'windbreak').flatMap((prop, i) => {
      const count = prop.kind === 'umbrella' ? 2 : 1;
      return Array.from({ length: count }, (_, j) => {
        const r = hash(1700 + i * 7 + j);
        return { x: prop.x + (j ? 9 : -9) + (r - 0.5) * 4, dir: r < 0.5 ? -1 : 1, towel: pick(TOWELS, hash(r * 9)),
          skin: pick([0xf0c8a4, 0xd9a47a, 0xb07a52, 0x7a5136], hash(r * 5)), swim: pick(SWIM, hash(r * 7)),
          hair: pick([0x2b2420, 0x5a3e2b, 0x8a6a3a, 0xbdb5a8], hash(r * 11)), up: 0, timer: 0 };
      });
    });
    this.swimmers = Array.from({ length: 6 }, (_, i) => {
      const r = hash(1800 + i);
      return { x: SHALLOWS[0] + r * (SHALLOWS[1] - SHALLOWS[0]), home: SHALLOWS, dir: r < 0.5 ? -1 : 1, phase: r * 6,
        skin: pick([0xf0c8a4, 0xd9a47a, 0xb07a52, 0x7a5136], hash(r * 5)), hair: pick([0x2b2420, 0x5a3e2b, 0x8a6a3a], hash(r * 3)),
        cap: hash(r * 13) < 0.3 ? pick(SWIM, hash(r * 17)) : null, under: 0, wave: 0 };
    });
    this.crabs = Array.from({ length: 4 }, (_, i) => ({ x: ROCK_POOLS - 22 + i * 12, dx: 0, dir: i % 2 ? 1 : -1, hidden: 0, phase: i }));
    // The beach's other cast, for evil mode (city-life.js). The dog hangs off its walker, so it is
    // listed afresh each time into one reused array.
    const dogs = [];
    this.cast.push(
      { list: () => this.sunbathers, draw: (g, s, ground) => this.drawSunbather(g, s, ground), width: 14, height: 6 },
      { list: () => this.swimmers, draw: (g, s, ground) => this.drawSwimmer(g, s, ground), width: 7, height: 7 },
      { list: () => this.crabs, draw: (g, crab, ground) => this.drawCrab(g, crab, ground), x: crab => crab.x + crab.dx,
        alive: crab => !crab.hidden, width: 6, height: 5 },
      { list: () => {
        dogs.length = 0;
        for (const person of this.crowds) {
          if (!person.dog) continue;
          person.dog.owner = person;
          dogs.push(person.dog);
        }
        return dogs;
      }, draw: (g, dog, ground) => this.drawDog(g, dog, ground), width: 10, height: 7,
      onKill: dog => { dog.owner.dog = null; }, onRestore: dog => { dog.owner.dog = dog; } },
    );
    const huts = SHELL_BEACH_BUILDINGS.filter(b => b.kind === 'hut');
    for (const hut of huts) {
      if (hash(hut.seed * 11) >= 0.5) continue;
      this.flocks.push({ kind: 'gull', x: hut.x, height: hut.roof - 2, spread: hut.width * 0.25, seed: hut.seed });
    }
    const kiosk = SHELL_BEACH_LANDMARKS.find(l => l.id === 'ice-cream-kiosk');
    this.flocks.push({ kind: 'gull', x: kiosk.x + kiosk.clear + 10, height: 0, spread: 18, seed: kiosk.x });
    for (const flock of this.flocks) this.settle(flock);
    this.doors = SHELL_BEACH_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  // Beachwear: bare arms in swimsuits, or a T-shirt and shorts, and sun hats.
  dress(person, r) {
    if (r < 0.45) Object.assign(person, { shirt: person.skin, pants: pick(SWIM, hash(r * 3)), swim: true });
    else person.pants = pick([0x8a9aa8, 0xb0a48a, 0x6f7d5c, 0x5f6b78], hash(r * 5));
    if (hash(r * 7) < 0.35) person.hat = 'sun';
    else if (hash(r * 7) < 0.5) person.hat = 'cap';
  }

  person(x, r = this.random()) {
    const person = super.person(x, r);
    if (hash(r * 71) < 0.55) this.dress(person, hash(r * 73));
    person.umbrella = null;
    return person;
  }

  settle(flock) {
    super.settle(flock);
    flock.birds.length = Math.min(flock.birds.length, 5);
    for (const bird of flock.birds) bird.color = pick(GULL.color, this.random());
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    const paint = type.kind === 'icecream' ? 0xe6dcc6 : type.kind === 'quad' ? LIFEGUARD.shirt : pick([0xb0a46a, 0x8a9a7a, 0x9a8a78], this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint };
  }

  walkBounds(person) {
    if (person?.pier && !person.offDeck) {
      return [PIER_DECK.from + 10, PIER_DECK.to - 12];
    }
    return [SAND.from + 20, SAND.to - 20];
  }

  step(dt, left, right, hero = null) {
    super.step(dt, left, right, hero);
    if (this.shift === null) return;
    const local = hero && { ...hero, x: hero.x - this.shift, speed: Math.hypot(hero.vx, hero.vy) };
    const near = x => x > left - this.shift - 400 && x < right - this.shift + 400;
    for (const person of this.crowds) {
      if (person.pier && !person.offDeck) {
        const onPier = person.x >= PIER_DECK.from - 2 && person.x <= PIER_DECK.to + 2;
        if (onPier && this.deckUp(person.deck ?? 'shell-pier')) {
          person.lift = person.deckLift = PIER_DECK.rise - Math.max(0, elevation(person.x));
        } else {
          person.lift = 0;
          if (!this.deckUp(person.deck ?? 'shell-pier')) {
            person.offDeck = true;
            person.rod = false;
          }
        }
      }
      if (person.dog) this.stepDog(person, dt, local);
      if (person.kite) person.kite.phase += dt;
    }
    for (const sunbather of this.sunbathers) {
      if (!near(sunbather.x)) continue;
      const close = local && Math.abs(local.x - sunbather.x) < SAND_DRIFT.startle && local.altitude < SAND_DRIFT.height * 2
        || local && this.wake(local) && Math.abs(local.x - sunbather.x) < 160;
      if (close) sunbather.timer = 3 + hash(sunbather.x) * 2;
      sunbather.timer = Math.max(0, sunbather.timer - dt);
      sunbather.up += ((sunbather.timer > 0 ? 1 : 0) - sunbather.up) * Math.min(1, dt * 6);
    }
    for (const swimmer of this.swimmers) {
      if (!near(swimmer.x)) continue;
      swimmer.phase += dt * 3;
      const dx = local ? Math.abs(local.x - swimmer.x) : Infinity;
      if (dx < 50 && local.altitude < 30 && local.speed > 60) swimmer.under = 1.4;
      swimmer.under = Math.max(0, swimmer.under - dt);
      swimmer.wave = dx < 90 && local.altitude < 120 && local.speed < 60 ? 1 : 0;
      if (!swimmer.under && !swimmer.wave) {
        swimmer.x += swimmer.dir * 6 * dt;
        if (swimmer.x < swimmer.home[0] || swimmer.x > swimmer.home[1]) swimmer.dir *= -1;
      }
    }
    for (const crab of this.crabs) {
      if (!near(crab.x)) continue;
      crab.phase += dt * 8;
      const close = local && Math.abs(local.x - crab.x - crab.dx) < 60 && local.altitude < 60;
      if (close) crab.hidden = 4;
      crab.hidden = Math.max(0, crab.hidden - dt);
      if (crab.hidden) continue;
      crab.dx += crab.dir * 8 * dt;
      if (Math.abs(crab.dx) > 10) crab.dir = -Math.sign(crab.dx);
    }
  }

  // The dog trots ahead of its walker, runs back, and barks and jumps at a hero who comes close.
  stepDog(person, dt, hero) {
    const dog = person.dog;
    dog.phase += dt * 10;
    dog.bark = Math.max(0, dog.bark - dt);
    if (hero && Math.abs(hero.x - dog.x) < 80 && hero.altitude < 80) {
      dog.dir = Math.sign(hero.x - dog.x) || 1;
      if (dog.bark <= 0) dog.bark = 0.6;
      return;
    }
    const target = person.x + person.dir * (14 + Math.sin(this.clock * 0.7) * 10);
    const gap = target - dog.x;
    dog.dir = Math.sign(gap) || dog.dir;
    dog.x += Math.sign(gap) * Math.min(Math.abs(gap), 2.6 * METRE * dt);
  }

  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    if (centre < SAND.from - 1400 || centre > SHALLOWS[1] + 1400) return;
    const visible = x => x + this.shift > left - 60 && x + this.shift < right + 60;
    for (const sunbather of this.sunbathers) if (visible(sunbather.x)) this.drawSunbather(g, sunbather, groundAt);
    for (const crab of this.crabs) if (visible(crab.x) && !crab.hidden) this.drawCrab(g, crab, groundAt);
    super.draw(g, left, right, groundAt, top, bottom);
    for (const swimmer of this.swimmers) if (visible(swimmer.x)) this.drawSwimmer(g, swimmer, groundAt);
  }

  drawPerson(g, person, groundAt) {
    super.drawPerson(g, person, groundAt);
    if (person.state === 'flinch' || person.state === 'board' || person.state === 'flee'
      || person.state === 'down' || person.state === 'thrown' || person.state === 'dead' || person.angle) return;
    const x = Math.round(person.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
    const h = person.height;
    const unit = v => Math.max(1, Math.round(v * h / 18));
    if (person.board) {
      // A surfboard under the arm, nose up.
      g.fillStyle(person.board);
      g.fillRect(x - person.dir * unit(3) - 1, feet - unit(17), unit(2), unit(14));
      g.fillRect(x - person.dir * unit(3) - 1 + (person.dir > 0 ? 0 : 1), feet - unit(18), 1, 1);
    }
    if (person.lifeguard) {
      // A rescue float under the arm.
      g.fillStyle(0xd8b84a);
      g.fillRect(x + person.dir * unit(3), feet - unit(11), unit(2), unit(5));
    }
    // Note: person.rod is drawn by CityLife.drawArms with pixel art while person.state === 'idle'.
    // No conflicting vector rod is drawn here, which previously created double rods and horizontal wires when down.
    if (person.kite) {
      // The kite rides the wind high off to one side, its tail streaming.
      const k = person.kite;
      const kx = x + person.dir * (30 + Math.round(Math.sin(k.phase * 0.8) * 6));
      const ky = feet - 70 + Math.round(Math.sin(k.phase * 1.3) * 5);
      const handX = x + person.dir * unit(2);
      const handY = feet - unit(11);
      g.lineStyle(1, 0xe6e2d8, 0.7);
      g.lineBetween(handX, handY, kx, ky + 4);
      g.fillStyle(k.color);
      g.fillTriangle(kx - 4, ky, kx, ky - 5, kx + 4, ky);
      g.fillTriangle(kx - 4, ky, kx, ky + 6, kx + 4, ky);
      g.fillStyle(0xf0e8dc);
      g.fillRect(kx, ky - 4, 1, 10);
      for (let i = 1; i <= 4; i++) {
        g.fillStyle(i % 2 ? k.color : 0xf0e8dc);
        const tailX = kx - person.dir * i * 3;
        const tailY = ky + 6 + i * 2 + Math.round(Math.sin(k.phase * 5 + i) * 1.5);
        g.fillRect(tailX, tailY, 2, 1);
      }
    }
    if (person.dog) this.drawDog(g, person.dog, groundAt);
  }

  drawDog(g, dog, groundAt) {
    const x = Math.round(dog.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1;
    const hop = dog.bark > 0.3 ? 2 : 0;
    const step = Math.sin(dog.phase) > 0 ? 1 : 0;
    g.fillStyle(dog.color);
    g.fillRect(x - 4, feet - 5 - hop, 8, 3);
    g.fillRect(x + dog.dir * 4 - (dog.dir > 0 ? 0 : 2), feet - 7 - hop, 3, 3);
    g.fillRect(x - dog.dir * 5, feet - 7 - hop, 1, 2);
    g.fillRect(x - 3 + step, feet - 2 - hop, 1, 2);
    g.fillRect(x + 2 - step, feet - 2 - hop, 1, 2);
    if (dog.bark > 0.3) {
      g.fillStyle(0xffffff, 0.8);
      g.fillRect(x + dog.dir * 9, feet - 10, 1, 1);
      g.fillRect(x + dog.dir * 11, feet - 12, 1, 1);
    }
  }

  // Lying on a towel, or propped up on an elbow to watch.
  drawSunbather(g, s, groundAt) {
    const x = Math.round(s.x + this.shift);
    const y = Math.round(groundAt(x)) + 1;
    const [a, b] = s.towel;
    for (let i = 0; i < 18; i++) {
      g.fillStyle(Math.floor(i / 3) % 2 ? a : b);
      g.fillRect(x - 9 + i, y - 1, 1, 1);
    }
    const head = s.dir;
    const sit = s.up > 0.5;
    g.fillStyle(s.skin);
    if (sit) {
      // Sitting up: legs out along the towel, back upright, head turned up.
      g.fillRect(x - head * 6 - 3, y - 3, 7, 2);
      g.fillStyle(s.swim);
      g.fillRect(x + head * 1 - 2, y - 4, 4, 2);
      g.fillStyle(s.skin);
      g.fillRect(x + head * 2 - 1, y - 10, 3, 6);
      g.fillRect(x + head * 2 - 1, y - 14, 4, 4);
      g.fillStyle(s.hair);
      g.fillRect(x + head * 2 - 1, y - 14, 4, 1);
      return;
    }
    g.fillRect(x - 8, y - 3, 15, 2);
    g.fillStyle(s.swim);
    g.fillRect(x - head * 1 - 2, y - 3, 4, 2);
    g.fillStyle(s.skin);
    g.fillRect(x + head * 7 - 2, y - 4, 4, 3);
    g.fillStyle(s.hair);
    g.fillRect(x + head * 8 - (head > 0 ? 0 : 1), y - 4, 2, 3);
  }

  // A head and shoulders in the water; arms flash up in a crawl, or wave at a hovering hero.
  drawSwimmer(g, s, groundAt) {
    if (s.under > 0.2) {
      const x = Math.round(s.x + this.shift);
      g.fillStyle(0xe8f4f8, 0.8);
      g.fillRect(x - 2, Math.round(groundAt(x)) - 1, 5, 1);
      return;
    }
    const x = Math.round(s.x + this.shift);
    const y = Math.round(groundAt(x)) + 1 + Math.round(Math.sin(s.phase) * 0.8);
    g.fillStyle(s.skin);
    g.fillRect(x - 2, y - 5, 4, 4);
    g.fillRect(x - 3, y - 1, 6, 1);
    g.fillStyle(s.cap ?? s.hair);
    g.fillRect(x - 2, y - 6, 4, s.cap ? 2 : 1);
    g.fillStyle(s.skin);
    if (s.wave) {
      const up = Math.sin(s.phase * 3) > 0;
      g.fillRect(x + 3, y - 9 + (up ? 0 : 1), 1, 6);
      g.fillRect(x + (up ? 4 : 2), y - 10, 1, 1);
    } else if (Math.sin(s.phase) > 0.2) {
      g.fillRect(x + s.dir * 3, y - 7, 1, 4);
      g.fillStyle(0xf0f8fa, 0.8);
      g.fillRect(x + s.dir * 4, y - 1, 2, 1);
    }
    g.fillStyle(0xf0f8fa, 0.6);
    g.fillRect(x - 4, y, 9, 1);
  }

  drawCrab(g, crab, groundAt) {
    const x = Math.round(crab.x + crab.dx + this.shift);
    const y = Math.round(groundAt(x)) + 1 - 5;
    const step = Math.sin(crab.phase) > 0 ? 1 : 0;
    g.fillStyle(0xb8603e);
    g.fillRect(x - 2, y - 2, 4, 2);
    g.fillRect(x - 3, y - 3 + step, 1, 1);
    g.fillRect(x + 2, y - 3 + (1 - step), 1, 1);
    g.fillStyle(0x8a4a30);
    g.fillRect(x - 2, y, 1, 1);
    g.fillRect(x + 1, y, 1, 1);
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'buggy') this.drawBuggy(g, car, groundAt);
    else if (car.kind === 'icecream') this.drawIceCreamVan(g, car, groundAt);
    else this.drawQuad(g, car, groundAt);
  }

  // Beach buggy: a low tub with a roll cage and fat tyres.
  drawBuggy(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 4;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    g.fillStyle(car.paint);
    g.fillRect(c.left + 2, sill - 5, c.length - 4, 5);
    g.fillTriangle(Math.round(c.front(1)), sill, Math.round(c.front(0.85)), sill - 5, Math.round(c.front(0.85)), sill);
    g.fillStyle(0x3a3e42);
    const [a, b] = [c.front(0.3), c.front(0.7)].sort((p, q) => p - q);
    g.fillRect(Math.round(a), roof, 1, sill - 5 - roof);
    g.fillRect(Math.round(b), roof + 2, 1, sill - 7 - roof);
    g.fillRect(Math.round(a), roof, Math.round(b - a), 1);
    this.lights(g, car, c, sill - 4);
    this.wheels(g, c, [0.18, 0.82], wheel);
    g.restore();
  }

  // Ice cream van: a cream box with a serving hatch, a pink stripe and a cone on the roof.
  drawIceCreamVan(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height) - c.lift;
    const [ca, cb] = [c.front(0.78), c.front(1)].sort((p, q) => p - q);
    g.fillStyle(car.paint);
    g.fillRect(c.left, roof, Math.round(c.length * 0.8), sill - roof);
    g.fillRect(Math.round(ca), roof + 5, Math.round(cb - ca), sill - roof - 5);
    g.fillStyle(0xc98a8a);
    g.fillRect(c.left, sill - 5, c.length, 2);
    g.fillStyle(0x9fb8c6);
    g.fillRect(c.dir > 0 ? Math.round(cb) - 6 : Math.round(ca) + 1, roof + 6, 5, 5);
    const [ha, hb] = [c.front(0.25), c.front(0.6)].sort((p, q) => p - q);
    g.fillStyle(0x4a4844);
    g.fillRect(Math.round(ha), roof + 4, Math.round(hb - ha), 7);
    g.fillStyle(0xd2a868);
    const cone = Math.round(c.front(0.4));
    g.fillTriangle(cone - 2, roof - 1, cone + 2, roof - 1, cone, roof + 3);
    g.fillStyle(0xe8c8c0);
    g.fillRect(cone - 2, roof - 4, 5, 3);
    this.lights(g, car, c, sill - 3);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }

  // Lifeguard quad: a red four-wheeler with a rider in red and a rescue board strapped behind.
  drawQuad(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    g.fillStyle(car.paint);
    g.fillRect(c.left + 2, sill - 4, c.length - 4, 4);
    g.fillStyle(0xd8b84a);
    g.fillRect(Math.round(Math.min(c.front(0), c.front(0.4))), sill - 6, Math.round(c.length * 0.4), 2);
    // Rider.
    const rx = Math.round(c.front(0.55));
    g.fillStyle(0xd8b84a);
    g.fillRect(rx - 1, sill - 8, 3, 4);
    g.fillStyle(LIFEGUARD.shirt);
    g.fillRect(rx - 1, sill - 14, 3, 6);
    g.fillStyle(0xd9a47a);
    g.fillRect(rx - 1, sill - 17, 3, 3);
    g.fillStyle(0x3a3e42);
    g.fillRect(rx + c.dir * 3, sill - 9, 1, 3);
    this.wheels(g, c, [0.2, 0.8], wheel);
    g.restore();
  }
}

// Gulls look the same on the beach as in the port.
for (const name of ['drawPerched', 'drawFlying']) ShellBeachLife.prototype[name] = BayportLife.prototype[name];
