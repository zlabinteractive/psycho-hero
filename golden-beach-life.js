import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { ShellBeachLife } from './shell-beach-life.js';
import { elevation } from './planet.js';
import { FERRY_DECK, GOLDEN_BEACH_BUILDINGS, GOLDEN_BEACH_LANDMARKS, GOLDEN_PROPS, GOLDEN_SAND, VOLLEYBALL_NET } from './golden-beach-art.js';

// Life on Golden Beach, following game-design-rules/city-life-rules.md (area-life.js does the walkers
// and the traffic on the sand):
// - Beachgoers in swimwear and sun hats; drinkers at the beach club; sightseers at the lookout tower
//   and the sand sculptures; ferry passengers waiting on the pier with their bags.
// - A camel ride: a handler in a white robe leads a camel with a tourist up top, up and down the sand.
//   The camel stops and turns its head to a hero who comes close, and shies from a RAM.
// - A game of beach volleyball by the net: four players, the ball arcing over, a jump to spike it.
// - Sunbathers on towels by the parasols and loungers, who sit up to watch the hero.
// - Swimmers in the shallows south of the pier, and crabs at the waterline.
// - Gulls on the cabana roofs and a flock by the beach club.
// - On the sand: beach buggies, the lifeguard quad and the juice cart. Like every road, the track
//   ends short of the water (city-life.js), so they turn back at the shore.
// Golden Beach keeps its own showers (rare enough in Sunland); Sandport shares them.
const METRE = HERO_HEIGHT / 1.85;
const VEHICLES = [
  { kind: 'buggy', length: 3.4 * METRE, height: 1.6 * METRE, weight: 2 },
  { kind: 'juicecart', length: 2.6 * METRE, height: 2.3 * METRE, weight: 1, slow: true },
  { kind: 'quad', length: 2.1 * METRE, height: 1.3 * METRE, weight: 1 },
];
const CRUISE = [3 * METRE, 5 * METRE];
const SWIM = [0x4f6a86, 0x2f3540, 0x8c4f4a, 0x5f8f8a, 0x7a6f8f, 0xb87a58];
const TOWELS = [[0xd9a83a, 0xf0e8dc], [0x5f8f8a, 0xf0e8dc], [0xb87a58, 0xf0e8dc], [0x8a9a7a, 0xe2dccb]];
const SKIN = [0xf0c8a4, 0xd9a47a, 0xb07a52, 0x7a5136];
const ROBE = 0xe8e2d4;
const CAMEL = [0xc49a62, 0xb08a58, 0xd2ae78];
// The shallows, where swimmers bob: south of the pier's piles, out from the shore.
export const GOLDEN_SHALLOWS = [25420, 25480];
const WATERLINE = 25494;
const CAMEL_TRACK = [25520, 25880];

const HOTSPOTS = {
  'lookout-tower': [4, 30],
  'beach-club': [9, 34, i => i < 2 ? { shirt: 0xe8e4dc, busy: true } : {}],
  'sand-sculptures': [5, 24],
};
const GULL = { color: [0xf2f4f2, 0xe6eaea] };

const pick = (list, r) => list[Math.floor(r * list.length)];

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export class GoldenBeachLife extends AreaLife {
  constructor(random = Math.random) {
    super(random, { area: GOLDEN_SAND, landmarks: GOLDEN_BEACH_LANDMARKS, hotspots: HOTSPOTS, ends: [null, GOLDEN_SAND.to - 40],
      walkerSpacing: 120, carSpacing: 520, seed: 2500 });
    this.hats = { sun: { color: 0xd8c8a0, shape: 'brim' }, cap: { color: 0x4f6a86, shape: 'cap' }, wrap: { color: ROBE, shape: 'cap' } };
    // Ferry passengers waiting on the pier deck, toward the terminal, with a bag at their feet.
    for (let i = 0; i < 5; i++) {
      const x = FERRY_DECK.from + 70 + i * 22 + hash(2600 + i) * 8;
      const person = this.person(x, hash(2610 + i));
      Object.assign(person, { home: [x - 6, x + 6], state: 'idle', timer: hash(2620 + i) * 4, pier: true, bag: hash(2630 + i) < 0.7,
        deck: 'ferry-pier', deckLift: FERRY_DECK.rise - Math.max(0, elevation(x)) });
      this.crowds.push(person);
    }
    // The camel ride: a handler leading a camel with a tourist up top.
    const handler = this.person(25600, 0.41);
    Object.assign(handler, { home: CAMEL_TRACK, state: 'walk', calm: true, shirt: ROBE, pants: ROBE, hat: 'wrap',
      camel: { x: 25588, dir: 1, phase: 0, shy: 0, look: 0, color: CAMEL[0], rider: { shirt: 0x5f8f8a, skin: SKIN[0] } } });
    this.crowds.push(handler);
    // Volleyball: two players each side of the net.
    this.volley = { t: 0, from: -1, players: [] };
    for (const [i, dx] of [-26, -12, 12, 26].entries()) {
      const x = VOLLEYBALL_NET + dx;
      const player = this.person(x, 0.2 + i * 0.13);
      this.dress(player, 0.1 + i * 0.07);
      Object.assign(player, { home: [x - 3, x + 3], state: 'idle', timer: 99, calm: true, volley: true, dir: dx < 0 ? 1 : -1 });
      this.crowds.push(player);
      this.volley.players.push(player);
    }
    for (const person of this.crowds) if (!person.camel && !person.volley && hash(person.x) < 0.5) this.dress(person, hash(person.x * 3));
    this.sunbathers = GOLDEN_PROPS.filter(p => p.kind === 'parasol' || p.kind === 'lounger').flatMap((prop, i) => {
      const count = prop.kind === 'parasol' ? 2 : 1;
      return Array.from({ length: count }, (_, j) => {
        const r = hash(2700 + i * 7 + j);
        return { x: prop.x + (j ? 9 : -9) + (r - 0.5) * 4, dir: r < 0.5 ? -1 : 1, towel: pick(TOWELS, hash(r * 9)),
          skin: pick(SKIN, hash(r * 5)), swim: pick(SWIM, hash(r * 7)),
          hair: pick([0x2b2420, 0x5a3e2b, 0x8a6a3a, 0xbdb5a8], hash(r * 11)), up: 0, timer: 0 };
      });
    });
    this.swimmers = Array.from({ length: 4 }, (_, i) => {
      const r = hash(2800 + i);
      return { x: GOLDEN_SHALLOWS[0] + r * (GOLDEN_SHALLOWS[1] - GOLDEN_SHALLOWS[0]), home: GOLDEN_SHALLOWS, dir: r < 0.5 ? -1 : 1, phase: r * 6,
        skin: pick(SKIN, hash(r * 5)), hair: pick([0x2b2420, 0x5a3e2b, 0x8a6a3a], hash(r * 3)),
        cap: hash(r * 13) < 0.3 ? pick(SWIM, hash(r * 17)) : null, under: 0, wave: 0 };
    });
    this.crabs = Array.from({ length: 3 }, (_, i) => ({ x: WATERLINE + 4 + i * 10, dx: 0, dir: i % 2 ? 1 : -1, hidden: 0, phase: i }));
    // The beach's other cast, for evil mode (city-life.js). The camel hangs off its handler.
    const camels = [];
    this.cast.push(
      { list: () => this.sunbathers, draw: (g, s, ground) => this.drawSunbather(g, s, ground), width: 14, height: 6 },
      { list: () => this.swimmers, draw: (g, s, ground) => this.drawSwimmer(g, s, ground), width: 7, height: 7 },
      { list: () => this.crabs, draw: (g, crab, ground) => this.drawCrab(g, crab, ground), x: crab => crab.x + crab.dx,
        alive: crab => !crab.hidden, width: 6, height: 5 },
      { list: () => {
        camels.length = 0;
        for (const person of this.crowds) {
          if (!person.camel) continue;
          person.camel.owner = person;
          camels.push(person.camel);
        }
        return camels;
      }, draw: (g, camel, ground) => this.drawCamelOf(g, camel, ground), width: 26, height: 22,
      onKill: camel => { camel.owner.camel = null; }, onRestore: camel => { camel.owner.camel = camel; } },
    );
    for (const cabana of GOLDEN_BEACH_BUILDINGS.filter(b => b.kind === 'cabana')) {
      if (hash(cabana.seed * 11) >= 0.5) continue;
      this.flocks.push({ kind: 'gull', x: cabana.x, height: cabana.roof - 2, spread: cabana.width * 0.25, seed: cabana.seed });
    }
    const club = GOLDEN_BEACH_LANDMARKS.find(l => l.id === 'beach-club');
    this.flocks.push({ kind: 'gull', x: club.x - club.clear - 8, height: 0, spread: 16, seed: club.x });
    for (const flock of this.flocks) this.settle(flock);
    this.doors = GOLDEN_BEACH_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: hash(b.x) * 10 }));
  }

  // Beachwear: bare arms in swimsuits, or a T-shirt and shorts, and sun hats.
  dress(person, r) {
    if (r < 0.45) Object.assign(person, { shirt: person.skin, pants: pick(SWIM, hash(r * 3)), swim: true });
    else person.pants = pick([0x8a9aa8, 0xb0a48a, 0x6f7d5c, 0xd8d0b8], hash(r * 5));
    if (hash(r * 7) < 0.4) person.hat = 'sun';
    else if (hash(r * 7) < 0.52) person.hat = 'cap';
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
    const cruise = (CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0])) * (type.slow ? 0.35 : 1);
    const paint = type.kind === 'juicecart' ? 0x5f8f8a : type.kind === 'quad' ? 0xc4483e : pick([0xc98a5a, 0xb0a46a, 0x9a8a78], this.random());
    return { x, lane, ...type, cruise, speed: cruise, bounce: 0, bounceSpeed: 0, startle: 0, dwell: 0, paint };
  }

  walkBounds(person) {
    if (person?.pier && !person.offDeck) {
      return [FERRY_DECK.from + 4, FERRY_DECK.to - 6];
    }
    return [GOLDEN_SAND.from + 20, GOLDEN_SAND.to - 40];
  }

  step(dt, left, right, hero = null) {
    super.step(dt, left, right, hero);
    if (this.shift === null) return;
    const local = hero && { ...hero, x: hero.x - this.shift, speed: Math.hypot(hero.vx, hero.vy) };
    const near = x => x > left - this.shift - 400 && x < right - this.shift + 400;
    for (const person of this.crowds) {
      if (person.pier && !person.offDeck) {
        const onPier = person.x >= FERRY_DECK.from - 2 && person.x <= FERRY_DECK.to + 2;
        if (onPier && this.deckUp(person.deck ?? 'ferry-pier')) {
          person.lift = person.deckLift = FERRY_DECK.rise - Math.max(0, elevation(person.x));
        } else {
          person.lift = 0;
        }
      }
      if (person.camel) this.stepCamel(person, dt, local);
    }
    if (near(VOLLEYBALL_NET)) this.stepVolley(dt);
    for (const sunbather of this.sunbathers) {
      if (!near(sunbather.x)) continue;
      const close = local && Math.abs(local.x - sunbather.x) < 70 && local.altitude < 100
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
        if (swimmer.x < swimmer.home[0] || swimmer.x > swimmer.home[1]) {
          swimmer.x = Math.max(swimmer.home[0], Math.min(swimmer.home[1], swimmer.x));
          swimmer.dir *= -1;
        }
      }
    }
    for (const crab of this.crabs) {
      if (!near(crab.x)) continue;
      crab.phase += dt * 8;
      if (local && Math.abs(local.x - crab.x - crab.dx) < 60 && local.altitude < 60) crab.hidden = 4;
      crab.hidden = Math.max(0, crab.hidden - dt);
      if (crab.hidden) continue;
      crab.dx += crab.dir * 8 * dt;
      if (Math.abs(crab.dx) > 8) crab.dir = -Math.sign(crab.dx);
    }
  }

  // The camel plods a few steps behind its handler. It stops and turns its head to a hero who comes
  // close, and shies sideways from a RAM, the handler hauling on the rope.
  stepCamel(person, dt, hero) {
    const camel = person.camel;
    camel.shy = Math.max(0, camel.shy - dt);
    camel.look = 0;
    if (hero && this.wake(hero) && Math.abs(hero.x - camel.x) < 120) camel.shy = 1.2;
    if (camel.shy > 0) {
      const away = Math.sign(camel.x - (hero?.x ?? camel.x)) || 1;
      camel.x = Math.max(CAMEL_TRACK[0], Math.min(CAMEL_TRACK[1], camel.x + away * 1.6 * METRE * dt));
      camel.phase += dt * 10;
      return;
    }
    if (hero && Math.abs(hero.x - camel.x) < 70 && hero.altitude < 90) {
      camel.look = 1;
      camel.dir = Math.sign(hero.x - camel.x) || camel.dir;
      return;
    }
    const target = person.x - person.dir * 13;
    const gap = target - camel.x;
    if (Math.abs(gap) > 0.5) {
      camel.dir = Math.sign(person.x - camel.x) || camel.dir;
      camel.x += Math.sign(gap) * Math.min(Math.abs(gap), 1.5 * METRE * dt);
      camel.phase += dt * 6;
    }
  }

  // The ball flies from one player to the next across the net in a high arc; the receiver jumps
  // as it comes down, the spiker higher.
  stepVolley(dt) {
    const v = this.volley;
    const live = v.players.filter(p => this.crowds.includes(p) && !p.dead);
    if (live.length < 2) {
      v.ball = null;
      return;
    }
    v.t += dt / 1.3;
    if (v.t >= 1 || !v.ball) {
      v.t = 0;
      const from = v.ball?.to ?? live[0];
      const side = Math.sign(from.x - VOLLEYBALL_NET);
      const across = live.filter(p => Math.sign(p.x - VOLLEYBALL_NET) !== side);
      const to = across.length ? pick(across, this.random()) : pick(live.filter(p => p !== from), this.random());
      v.ball = { from, to };
    }
    for (const p of live) p.lift = 0;
    const { from, to } = v.ball;
    const jump = t => Math.max(0, Math.sin(t * Math.PI)) * 5;
    if (v.t > 0.8) to.lift = jump((v.t - 0.8) / 0.2);
    if (v.t < 0.15) from.lift = jump(v.t / 0.15);
    from.dir = Math.sign(to.x - from.x) || from.dir;
    to.dir = Math.sign(from.x - to.x) || to.dir;
  }

  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    if (centre < GOLDEN_SHALLOWS[0] - 1400 || centre > GOLDEN_SAND.to + 1400) return;
    const visible = x => x + this.shift > left - 60 && x + this.shift < right + 60;
    for (const sunbather of this.sunbathers) if (visible(sunbather.x)) this.drawSunbather(g, sunbather, groundAt);
    for (const crab of this.crabs) if (visible(crab.x) && !crab.hidden) this.drawCrab(g, crab, groundAt);
    super.draw(g, left, right, groundAt, top, bottom);
    for (const swimmer of this.swimmers) if (visible(swimmer.x)) this.drawSwimmer(g, swimmer, groundAt);
    const ball = this.volley.ball;
    if (ball && visible(VOLLEYBALL_NET) && this.crowds.includes(ball.from) && this.crowds.includes(ball.to)) {
      const t = this.volley.t;
      const bx = Math.round(ball.from.x + (ball.to.x - ball.from.x) * t + this.shift);
      const by = Math.round(groundAt(bx)) - 22 - Math.sin(t * Math.PI) * 30;
      g.fillStyle(0xf0ece0);
      g.fillRect(bx - 1, by - 1, 3, 3);
      g.fillStyle(0xd9a83a);
      g.fillRect(bx, by - 1, 1, 1);
    }
  }

  drawPerson(g, person, groundAt) {
    if (person.camel) this.drawCamelOf(g, person.camel, groundAt, person);
    super.drawPerson(g, person, groundAt);
    if (person.state === 'flinch' || person.state === 'board') return;
    if (person.bag) {
      const x = Math.round(person.x + this.shift);
      const feet = Math.round(groundAt(x)) + 1 + person.lane * 3 - (person.lift ?? 0);
      g.fillStyle(0x6a5a4a);
      g.fillRect(x - person.dir * 5 - 2, feet - 4, 5, 4);
      g.fillStyle(0x4a3e34);
      g.fillRect(x - person.dir * 5 - 1, feet - 5, 3, 1);
    }
  }

  // The camel, with its tourist up top and, while the handler leads it, the rope to their hand.
  drawCamelOf(g, camel, groundAt, handler = null) {
    const x = Math.round(camel.x + this.shift);
    const feet = Math.round(groundAt(x)) + 1;
    drawCamel(g, x, feet, camel.dir, camel.phase, { color: camel.color, look: camel.look, rider: camel.rider });
    if (handler && handler.state !== 'flinch') {
      const hx = Math.round(handler.x + this.shift);
      g.lineStyle(1, 0x6a5440);
      g.lineBetween(x + camel.dir * 13, feet - 17, hx - Math.sign(hx - x) * 2, Math.round(groundAt(hx)) - 9);
    }
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'juicecart') this.drawJuiceCart(g, car, groundAt);
    else if (car.kind === 'buggy') this.drawBuggy(g, car, groundAt);
    else this.drawQuad(g, car, groundAt);
  }

  // Juice cart: a teal pushcart with a striped canopy, a counter heaped with oranges, and the vendor
  // pedalling it along on the tail.
  drawJuiceCart(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const top = c.base - Math.round(car.height) - c.lift;
    const [a, b] = [c.front(0.25), c.front(1)].sort((p, q) => p - q);
    const ax = Math.round(a);
    const w = Math.round(b - a);
    g.fillStyle(car.paint);
    g.fillRect(ax, sill - 8, w, 8);
    g.fillStyle(0xece4d2);
    g.fillRect(ax + 2, sill - 6, w - 4, 2);
    // Oranges and a juicer on the counter.
    g.fillStyle(0xd98a3a);
    for (let ox = ax + 2; ox < ax + w - 5; ox += 3) g.fillRect(ox, sill - 10, 2, 2);
    g.fillStyle(0xd8d4c8);
    g.fillRect(ax + w - 4, sill - 12, 2, 4);
    // Canopy on poles.
    g.fillStyle(0x6a5440);
    g.fillRect(ax, top + 3, 1, sill - 8 - top - 3);
    g.fillRect(ax + w - 1, top + 3, 1, sill - 8 - top - 3);
    for (let i = 0, sx = ax - 1; sx < ax + w + 1; sx += 2, i++) {
      g.fillStyle(i % 2 ? 0xece4d2 : 0xd9a83a);
      g.fillRect(sx, top, 2, 3);
    }
    // The vendor on the saddle at the back.
    const vx = Math.round(c.front(0.1));
    g.fillStyle(0x5a6a74);
    g.fillRect(vx - 1, sill - 7, 3, 4);
    g.fillStyle(0xe8e4dc);
    g.fillRect(vx - 1, sill - 13, 3, 6);
    g.fillStyle(0xb07a52);
    g.fillRect(vx - 1, sill - 16, 3, 3);
    g.fillStyle(0xd8c8a0);
    g.fillRect(vx - 2, sill - 17, 5, 1);
    this.wheels(g, c, [0.1, 0.4, 0.9], wheel);
    g.restore();
  }
}

// A dromedary about 2.6 m long and 1.9 m at the shoulder (hero-scaled): long legs, one hump, a long
// curved neck. Walking, its legs swing in pairs; look turns the head up toward the hero.
// opts.rider: { shirt, skin } sits a tourist on a blanket over the hump; opts.pack slings striped
// saddlebags and a rolled rug over it instead; opts.kneel folds it down.
export function drawCamel(g, x, feet, dir, phase, { color = CAMEL[0], look = 0, rider = null, pack = false, kneel = false, alpha = 1 } = {}) {
  const d = dir;
  const shade = shadeOf(color);
  const leg = kneel ? 4 : 12;
  const step = kneel ? 0 : Math.round(Math.sin(phase) * 2);
  const body = feet - leg;
  g.fillStyle(shade, alpha);
  // Legs: two pairs, knobbly knees.
  for (const [lx, s] of [[-9, step], [-6, -step], [6, step], [9, -step]]) {
    g.fillRect(x + d * lx + s, body, 2, leg);
    if (!kneel) g.fillRect(x + d * lx + s, body + 5, 2, 1);
  }
  g.fillStyle(color, alpha);
  // Body and hump.
  g.fillRect(x - 11, body - 7, 22, 8);
  g.fillRect(x - 7, body - 11, 12, 4);
  g.fillRect(x - 5, body - 13, 8, 2);
  // Tail.
  g.fillStyle(shade, alpha);
  g.fillRect(x - d * 12 - (d > 0 ? 0 : 1), body - 6, 1, 5);
  // Neck curving forward and up to the head.
  g.fillStyle(color, alpha);
  const nx = x + d * 10;
  if (look) {
    g.fillRect(nx + (d > 0 ? 0 : -3), body - 14, 4, 10);
    g.fillRect(nx + d * 2 + (d > 0 ? 0 : -5), body - 18, 6, 4);
  } else {
    g.fillRect(nx + (d > 0 ? 0 : -4), body - 7, 5, 3);
    g.fillRect(nx + d * 3 + (d > 0 ? 0 : -3), body - 13, 4, 7);
    g.fillRect(nx + d * 4 + (d > 0 ? 0 : -6), body - 15, 7, 3);
  }
  g.fillStyle(0x2f2a26, alpha);
  const ex = look ? nx + d * 5 : nx + d * 7;
  g.fillRect(ex, look ? body - 17 : body - 14, 1, 1);
  if (pack) {
    // Saddlebags each side of the hump and a rolled rug on top.
    g.fillStyle(0x8a5a3e, alpha);
    g.fillRect(x - 8, body - 10, 5, 6);
    g.fillRect(x + 2, body - 10, 5, 6);
    g.fillStyle(0xb8604a, alpha);
    g.fillRect(x - 8, body - 8, 5, 1);
    g.fillRect(x + 2, body - 8, 5, 1);
    g.fillStyle(0xd8c8a0, alpha);
    g.fillRect(x - 5, body - 15, 9, 2);
  }
  if (rider) {
    // Saddle blanket, then the rider sitting astride.
    g.fillStyle(0xb8604a, alpha);
    g.fillRect(x - 7, body - 13, 12, 2);
    g.fillStyle(0xd9a83a, alpha);
    g.fillRect(x - 7, body - 11, 12, 1);
    g.fillStyle(0x4f5a62, alpha);
    g.fillRect(x - 1, body - 14, 3, 4);
    g.fillStyle(rider.shirt, alpha);
    g.fillRect(x - 1, body - 20, 3, 6);
    g.fillStyle(rider.skin, alpha);
    g.fillRect(x - 1, body - 23, 3, 3);
    g.fillStyle(0xd8c8a0, alpha);
    g.fillRect(x - 2, body - 24, 5, 1);
  }
}

function shadeOf(color) {
  const r = (color >> 16) & 0xff;
  const gr = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (Math.round(r * 0.8) << 16) | (Math.round(gr * 0.8) << 8) | Math.round(b * 0.8);
}

// The sunbathers, swimmers, crabs, buggy, quad and gulls look the same as at Shell Beach.
for (const name of ['drawSunbather', 'drawSwimmer', 'drawCrab', 'drawBuggy', 'drawQuad', 'drawPerched', 'drawFlying']) {
  GoldenBeachLife.prototype[name] = ShellBeachLife.prototype[name];
}
