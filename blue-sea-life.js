import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { BayportLife } from './bayport-life.js';
import { BLUE_SEA, SANDBAR } from './blue-sea-art.js';
import { isWater, lerpColor as lerp } from './planet.js';
import { sound } from './sound.js';
import { drawCetacean } from './cetaceans.js';
import { PIER_DECK } from './shell-beach-art.js';
import { FERRY_DECK } from './golden-beach-art.js';

// Life on the Blue Sea, following game-design-rules/city-life-rules.md, hero-scaled (the big ships
// are far out on the horizon, in blue-sea-art.js):
// - Boats in two lanes, each with a bow wave and a wake: sailing yachts, fishing trawlers with gulls
//   in tow, tugs, a rubber dinghy, the coast guard cutter (the one accent, its red-and-blue stripe)
//   and now and then a container feeder or a coastal tanker, all at real size beside the hero. They keep to open water: each turns back short of the
//   shore or Shell Beach's pier. A RAM's wake rocks them.
// - Pods of dolphins that roam their own stretch of deep water and leap as they go.
// - Seals hauled out on the sandbar, which flop into the water when the hero comes near.
// - A shark's fin cruising, turtles surfacing for air, and shoals of fish leaping with gannets
//   circling high above and plunging in after them.
// - Rafts of puffins and gulls bobbing on the swell, which scatter like pigeons. (The albatross
//   gliding high overhead was removed: from below it read as a drone.)
// - Whitecaps on the swell all across the open water.
const METRE = HERO_HEIGHT / 1.85;
// Boats keep to this stretch of open water, turning back at its ends.
// The east end stops short of Golden Beach's ferry pier and the ferry moored at its head.
export const SEA_LANES = [PIER_DECK.to + 90, FERRY_DECK.from - 110];
// Real sizes in metres from the hero (1.85 m), so a container is taller than the hero and the
// ships tower over the hero. height is the hit box, centred on the waterline. scale shrinks a
// kind's art and hit box together (the small craft by 10% and the tanker by 20%, by the owner's
// eye); art keeps the length the drawing is laid out at.
const BOATS = [
  { kind: 'yacht', length: 11 * METRE, height: 10 * METRE, speed: 4, weight: 4, scale: 0.9 },
  { kind: 'trawler', length: 20 * METRE, height: 12 * METRE, speed: 3.5, weight: 3, scale: 0.9 },
  { kind: 'tug', length: 24 * METRE, height: 14 * METRE, speed: 4.5, weight: 2, scale: 0.9 },
  { kind: 'dinghy', length: 4 * METRE, height: 2 * METRE, speed: 6, weight: 2, scale: 0.9 },
  { kind: 'cutter', length: 28 * METRE, height: 14 * METRE, speed: 7, weight: 1, scale: 0.9 },
  { kind: 'freighter', length: 70 * METRE, height: 34 * METRE, speed: 3, weight: 1, scale: 1 },
  { kind: 'tanker', length: 82 * METRE, height: 30 * METRE, speed: 3, weight: 1, scale: 0.8 },
].map(type => ({ ...type, art: type.length, length: type.length * type.scale, height: type.height * type.scale }));
// px for a size in metres.
const px = metres => Math.round(metres * METRE);
// Three distinct, authentic color varieties for each ship and boat model.
export const SHIP_VARIETIES = {
  freighter: [
    { name: 'Ocean Blue Line', hull: 0x24394e, boot: 0x8c3b36, band: 0x4f8fc0, trim: 0x3a5068 },
    { name: 'Jade Container Line', hull: 0x22382c, boot: 0x202224, band: 0xd48834, trim: 0x345440 },
    { name: 'Nordic Charcoal Line', hull: 0x2c2e33, boot: 0xa43830, band: 0xeeeae0, trim: 0x444852 },
  ],
  tanker: [
    { name: 'Crude Raven / Red Lead', hull: 0x1f2124, boot: 0x8c3b36, band: 0xdca83a, deck: 0x763630, trim: 0x542824 },
    { name: 'Baltic Slate / Crimson', hull: 0x424a54, boot: 0x1c1e20, band: 0xc03a32, deck: 0x4c5a52, trim: 0x34423c },
    { name: 'Gulf Midnight / Pine', hull: 0x1c2b3c, boot: 0x243e30, band: 0xeeeae0, deck: 0x304254, trim: 0x223242 },
  ],
  cutter: [
    { name: 'Coast Guard Off-White', hull: 0xeeeae0, boot: 0x2a2f36, stripe1: 0xb8463c, stripe2: 0x243b64, trim: 0x5a6a7a, ribColor: 0xd8783a },
    { name: 'Naval Haze Grey', hull: 0x74808c, boot: 0x1c2228, stripe1: 0xd85e2b, stripe2: 0xeeeae0, trim: 0x46505c, ribColor: 0xd85e2b },
    { name: 'Customs Deep Navy', hull: 0x1e3046, boot: 0x863028, stripe1: 0xe2a832, stripe2: 0xb83026, trim: 0x2a3e56, ribColor: 0xe2a832 },
  ],
  tug: [
    { name: 'Harbour Signal Red', hull: 0xa4342a, boot: 0x24262a, band: 0xe8b838, trim: 0x8a5a3a },
    { name: 'Port Authority Navy', hull: 0x233e62, boot: 0x8c3b36, band: 0xeeeae0, trim: 0x465a76 },
    { name: 'Dockyard Ochre', hull: 0xb48434, boot: 0x202224, band: 0x363a3e, trim: 0x36281c },
  ],
  trawler: [
    { name: 'North Sea Ocean Blue', hull: 0x34526e, boot: 0x7a3028, trim: 0x8a5a3a, shelter: 0xd8d4c8 },
    { name: 'Atlantic Spruce Green', hull: 0x304c38, boot: 0x202224, trim: 0x24382a, shelter: 0xd0d6d2 },
    { name: 'Harbour Terracotta', hull: 0x924034, boot: 0x282c32, trim: 0x6e2e26, shelter: 0xdcd2c2 },
  ],
  yacht: [
    { name: 'Pearl White & Navy', hull: 0xf4f2ec, boot: 0x20344c, sail: 0xf8f6f0, trim: 0x7a5234 },
    { name: 'Midnight Navy & Crimson', hull: 0x182436, boot: 0xa42824, sail: 0xe8dfc8, trim: 0x4a3222 },
    { name: 'Mediterranean Azure & Gold', hull: 0x305e7a, boot: 0xdcd8c4, sail: 0xeeeae0, trim: 0x5a402e },
  ],
  dinghy: [
    { name: 'Rescue Safety Orange', hull: 0xd9602b, boot: 0x202224, trim: 0x3a3e42 },
    { name: 'Marine Navy Blue', hull: 0x243952, boot: 0x202224, trim: 0xeeeae0 },
    { name: 'Tactical Storm Grey', hull: 0x565e6a, boot: 0x202224, trim: 0x202224 },
  ],
};

// Merchant hulls and funnel bands.
const SHIP_HULLS = [0x2f3a46, 0x34483e, 0x6e3530, 0x2c2e33];
const FUNNEL_BANDS = [0x4f6a86, 0xc98a4a, 0xeeeae0, 0x8c4f4a];
// Boot tops (the band at the waterline) on the merchant ships: oxide red, black or deep green.
const BOOT_TOPS = [0x8c4f4a, 0x24262a, 0x2f4a3a];
// Tug hulls: harbour red, navy, deep green or ochre.
const TUG_HULLS = [0x9a3a30, 0x2f4664, 0x2f4a3a, 0xa8803a];
// Wheelhouse roof and rail trim on the small working boats.
const TRIMS = [0x6a5a4a, 0x9a3a30, 0x4f6a86, 0x5f7d58];
// [dir, y offset]: the back lane runs west, the front lane east.
const BOAT_LANES = [{ dir: -1, y: 0 }, { dir: 1, y: 3 }];
// Each kind's hit shape, traced from its art: [from, to] along the hull (0 the stern, 1 the bow) and
// [low, high] in metres above the waterline (below it, the part the hero can reach underwater).
// Hull, then the deckhouses, cargo and funnels. Masts, aerials and rigging are a pixel wide and
// left out, so a hit has to land on the ship itself. A yacht's sails count: they are big and solid.
const HIT_PARTS = {
  yacht: [[0, 0.97, -0.6, 1.1], [0.3, 0.64, 1.1, 1.7], [0.3, 0.62, 1.7, 10], [0.14, 0.3, 1.7, 4.5], [0.62, 0.95, 1.1, 5]],
  trawler: [[0, 0.95, -0.8, 1.6], [0.8, 1, 1.6, 2.9], [0.5, 0.86, 1.6, 3.8], [0.56, 0.78, 3.8, 6.2], [0.05, 0.11, 1.6, 7.1]],
  tug: [[0, 0.96, -0.8, 1.6], [0.8, 1, 1.6, 2.6], [0.4, 0.78, 1.6, 4.1], [0.5, 0.74, 4.1, 6.9], [0.34, 0.44, 1.6, 7.1]],
  dinghy: [[0, 1, -0.3, 1.3]],
  cutter: [[0, 0.95, -0.8, 2.2], [0.8, 1, 2.2, 3.2], [0.3, 0.7, 2.2, 4.7], [0.38, 0.7, 4.7, 7.2], [0.05, 0.22, 2.2, 3.3]],
  freighter: [[0, 0.95, -1.2, 2.6], [0.87, 1, 2.6, 4.2], [0.275, 0.87, 2.6, 10.4], [0.1, 0.25, 2.6, 16.2], [0.12, 0.2, 16.2, 21]],
  tanker: [[0, 0.95, -1.2, 2.4], [0.88, 1, 2.4, 4.2], [0.23, 0.9, 2.4, 5], [0.085, 0.21, 2.4, 15.9], [0.1, 0.16, 15.9, 20.9]],
};
const HIT_SCRATCH = [];
const HIT_LIST = [];
const BOAT_SPACING = 1100;
const BOAT_GAP = 6 * METRE;
const TURN = 1.5;
const SPAWN_NEAR = 80;
const SPAWN_FAR = 400;
const DESPAWN = 700;
const ROCK = { reach: 40, altitude: 70 };
const NEAR = 900;

const HULLS = [0xe6e2d8, 0x4f6a86, 0x3a3f46, 0x6f7d5c, 0x8c4f4a];
const SAILS = [0xeeeae0, 0xe2dccb, 0xd8d0c0];
const FOAM = 0xeef6f8;
const DOLPHIN = 0x7a8a96;
const SEA_TINT = 0x1f78b8;
// Container colours on the feeder ship: vibrant authentic shipping line liveries (Maersk, Evergreen, MSC, ONE, Hapag-Lloyd, CMA CGM).
const CONTAINERS = [0x42b0d5, 0x0f6e3c, 0xfbc02d, 0xd81b60, 0xe65100, 0x1b3c68, 0x8c4f4a, 0x4f6a86, 0xb9b4a8];
// Splashes last SPLASH_LIFE s.
const SPLASH_LIFE = 3.2;
const DOLPHIN_LENGTH = 26;
const DOLPHIN_SPLASH = 1.2;
// Dolphins never leave deep water between these world x, and each pod roams its own home within it.
export const DOLPHIN_WATER = [16800, 24800];
const DOLPHIN_HOMES = [[16800, 18400], [18700, 19900], [21500, 22900], [23400, 24800]];
const SEAL = [0x6a6660, 0x7a746a, 0x5a5650];
const PUFFIN = { color: [0x2a2a2e, 0x34343a], face: 0xeeeeea, beak: 0xd8783a };

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const pick = (list, r) => list[Math.floor(r * list.length)];

export class SeaLife extends AreaLife {
  constructor(random = Math.random) {
    super(random, { area: BLUE_SEA, landmarks: [], hotspots: {}, walkerSpacing: Infinity, carSpacing: Infinity, seed: 1900 });
    // Open water: no roads, so no side roads at the shores either.
    this.noRoads = true;
    this.boats = [];
    // Each pod keeps to its own stretch of deep water, inside DOLPHIN_WATER.
    // Staggered V/echelon formation with varied wait timers and leap arcs so dolphins never leap in an identical line.
    const podOffsets = [
      { dx: 0, dy: 0, waitBase: 0.6, hScale: 1.2, tScale: 1.1, vxScale: 1.2 },    // Lead dolphin
      { dx: -38, dy: 4, waitBase: 1.8, hScale: 0.9, tScale: 0.95, vxScale: 0.85 }, // Port flanker
      { dx: 34, dy: -3, waitBase: 3.2, hScale: 1.35, tScale: 1.25, vxScale: 1.3 }, // Starboard flanker
    ];
    this.pods = DOLPHIN_HOMES.map((home, i) => ({
      x: (home[0] + home[1]) / 2, home, dir: i % 2 ? -1 : 1, chase: 0, pace: 1, paceClock: hash(i + 40) * 10,
      clock: 0, splashes: [],
      dolphins: podOffsets.map((cfg, j) => ({
        dx: cfg.dx, dy: cfg.dy, wave: hash(i * 3 + j) * 6,
        wait: cfg.waitBase + hash(i * 5 + j) * 0.8,
        hScale: cfg.hScale, tScale: cfg.tScale, vxScale: cfg.vxScale,
        drift: 0, air: null,
      })),
    }));
    this.deadDolphins = [];
    this.deadFish = [];
    this.bloodClouds = [];
    this.airBlood = [];
    this.seals = Array.from({ length: 5 }, (_, i) => ({
      x: SANDBAR.from + 22 + i * 20 + hash(2000 + i) * 6, dir: i % 2 ? 1 : -1, color: SEAL[i % SEAL.length],
      state: 'out', timer: 0, dx: 0, phase: i,
    }));
    this.sharks = [{ x: 23200, home: [22700, 23700], dir: 1 }];
    this.turtles = [{ x: 17800, timer: 3, up: false }, { x: 24000, timer: 6, up: false }];
    this.shoals = [16900, 19800, 23500].map(x => ({ x, timer: 2 + hash(x) * 3, leaps: [] }));
    this.gannets = this.shoals.flatMap((shoal, i) => [0, 1, 2].map(j => ({
      shoal, angle: hash(i * 5 + j) * 6, radius: 50 + j * 18, h: 130 + j * 14, state: 'circle', timer: 4 + hash(i + j) * 8, x: shoal.x, splash: 0,
    })));
    this.flocks = [
      ...[15900, 18200, 21900, 24800].map(x => ({ kind: 'puffin', x, height: 0, spread: 22, seed: x })),
      ...[17400, 20150, 23000].map(x => ({ kind: 'gull', x, height: 0, spread: 18, seed: x })),
    ];
    for (const flock of this.flocks) this.settle(flock);
    // Sea creatures evil mode can kill (city-life.js). Sea art draws at the sea line, not a ground function.
    const sea = ground => ground(BLUE_SEA.from + 2000 + this.shift);
    this.cast.push(
      { list: () => this.seals, draw: (g, seal, ground) => this.drawSeal(g, seal, sea(ground)), x: seal => seal.x + seal.dx, width: 12, height: 6 },
      { list: () => this.turtles, draw: (g, turtle, ground) => this.drawTurtle(g, turtle, sea(ground)), alive: turtle => turtle.up, width: 12, height: 5 },
      { list: () => this.sharks, draw: (g, shark, ground) => this.drawFin(g, shark, sea(ground)), width: 10, height: 9 },
      // A gannet's art rises by its own height, so death drops that to the body's fall.
      { list: () => this.gannets, draw: (g, gannet, ground) => this.drawGannet(g, gannet, sea(ground)), alive: gannet => gannet.state !== 'under',
        lift: gannet => gannet.height ?? gannet.h, width: 16, height: 6,
        onKill: gannet => Object.assign(gannet, { height: 0, splash: 0, state: 'circle' }) },
    );
    for (const shoal of this.shoals) {
      this.cast.push({
        list: () => shoal.leaps, x: leap => shoal.x + leap.dx, alive: leap => leap.t >= 0, width: 12, height: 16, transient: true,
        hit: (leap, vx, vy) => this.killShoalFish(shoal, leap, vx, vy),
        corpse: leap => this.makeDeadFishCorpse(shoal, leap, sea),
      });
    }
    for (const pod of this.pods) {
      this.cast.push({
        list: () => pod.dolphins, x: dolphin => pod.x + dolphin.dx + (dolphin.air ? dolphin.air.dx : dolphin.drift), width: DOLPHIN_LENGTH, height: 12,
        hit: (dolphin, vx, vy) => this.killDolphin(pod, dolphin, vx, vy),
        corpse: dolphin => this.makeDeadDolphinCorpse(pod, dolphin, sea),
      });
    }
  }

  settle(flock) {
    super.settle(flock);
    for (const bird of flock.birds) bird.color = flock.kind === 'puffin' ? pick(PUFFIN.color, this.random()) : pick([0xf2f4f2, 0xe6eaea], this.random());
  }

  boat(x, lane) {
    const type = this.pickVehicle(BOATS);
    const cruise = type.speed * METRE * (0.85 + this.random() * 0.3);
    const variants = SHIP_VARIETIES[type.kind] ?? [
      { hull: 0xe6e2d8, boot: 0x2a2f36, band: 0x4f6a86, trim: 0x6a5a4a, sail: 0xeeeae0 },
    ];
    const varietyIndex = Math.floor(this.random() * variants.length) % variants.length;
    const variety = variants[varietyIndex];
    return {
      x, lane, ...type, cruise, speed: cruise, rock: 0, rockSpeed: 0, startle: 0, turn: 0, phase: this.random() * 6,
      seed: Math.floor(this.random() * 1000),
      varietyIndex,
      ...variety,
    };
  }

  // Open water a boat of this length may sit on at x.
  afloat(x, length) {
    return x - length / 2 > SEA_LANES[0] && x + length / 2 < SEA_LANES[1] && isWater(x - length / 2) && isWater(x + length / 2);
  }

  step(dt, left, right, hero = null) {
    super.step(dt, left, right, hero);
    if (this.shift === null) return;
    const from = left - this.shift;
    const to = right - this.shift;
    if (to < BLUE_SEA.from - NEAR * 2 || from > BLUE_SEA.to + NEAR * 2) {
      this.boats = [];
      return;
    }
    const local = hero && { ...hero, x: hero.x - this.shift, speed: Math.hypot(hero.vx, hero.vy) };
    const near = x => x > from - NEAR && x < to + NEAR;
    this.stepBoats(dt, from, to, local);
    for (const pod of this.pods) if (near(pod.x)) this.stepPod(pod, dt);
    if (near(SANDBAR.from)) for (const seal of this.seals) this.stepSeal(seal, dt, local);
    for (const shark of this.sharks) {
      if (!near(shark.x)) continue;
      shark.x += shark.dir * 2 * METRE * dt;
      if (shark.x < shark.home[0] || shark.x > shark.home[1]) shark.dir *= -1;
    }
    for (const turtle of this.turtles) {
      if (!near(turtle.x)) continue;
      turtle.timer -= dt;
      if (turtle.timer <= 0) Object.assign(turtle, { up: !turtle.up, timer: turtle.up ? 6 + this.random() * 6 : 3 });
      if (turtle.up && local && Math.abs(local.x - turtle.x) < 60 && local.altitude < 50) Object.assign(turtle, { up: false, timer: 8 });
    }
    for (const shoal of this.shoals) if (near(shoal.x)) this.stepShoal(shoal, dt);
    for (const gannet of this.gannets) if (near(gannet.shoal.x)) this.stepGannet(gannet, dt);
    this.stepMarineCasualties(dt);
  }

  // Boats ease to cruise, keep their gap, rock in a RAM's wake, and at either end of the open water
  // slow, swing round, and head back the other way in the other lane.
  // Hull-shaped hit boxes (HIT_PARTS), in world space, scaled like the art and set on the boat's own
  // waterline (lane and bob), so punches, RAM and the laser land on the ship and not the sky round it.
  boatBoxes(boat, groundAt) {
    const parts = HIT_PARTS[boat.kind];
    if (!parts) return super.boatBoxes(boat, groundAt);
    const dir = BOAT_LANES[boat.lane].dir;
    const x = boat.x + this.shift;
    const water = groundAt(BLUE_SEA.from + 2000 + this.shift) + BOAT_LANES[boat.lane].y + Math.sin(boat.phase * 1.4) * 0.8;
    const unit = METRE * (boat.scale ?? 1);
    HIT_LIST.length = parts.length;
    for (const [i, [t0, t1, low, high]] of parts.entries()) {
      const box = HIT_SCRATCH[i] ??= { x: 0, y: 0, width: 0, height: 0 };
      box.x = x + dir * ((t0 + t1) / 2 - 0.5) * boat.length;
      box.width = (t1 - t0) * boat.length;
      box.y = water - (low + high) / 2 * unit;
      box.height = (high - low) * unit;
      HIT_LIST[i] = box;
    }
    return HIT_LIST;
  }

  stepBoats(dt, from, to, hero) {
    const keep = boat => boat.x > from - DESPAWN && boat.x < to + DESPAWN;
    this.boats = this.boats.filter(keep);
    for (const [index, { dir }] of BOAT_LANES.entries()) {
      const lane = this.boats.filter(boat => boat.lane === index).sort((a, b) => (b.x - a.x) * dir);
      lane.forEach((boat, i) => {
        boat.phase += dt;
        if (boat.turn > 0) {
          boat.turn -= dt;
          if (boat.turn <= 0 && !this.boats.some(b => b !== boat && b.lane !== index && Math.abs(b.x - boat.x) < (b.length + boat.length) / 2 + BOAT_GAP)) {
            boat.lane = 1 - index;
            boat.speed = 0;
          } else if (boat.turn <= 0) boat.turn = 0.5;
          return;
        }
        const ahead = lane[i - 1];
        let target = boat.startle > 0 ? boat.cruise * 0.4 : boat.cruise;
        if (ahead) target = Math.min(target, Math.max(0, (Math.abs(ahead.x - boat.x) - (ahead.length + boat.length) / 2 - BOAT_GAP) * 0.8));
        const end = Math.min(dir > 0 ? SEA_LANES[1] - boat.length / 2 - 20 - boat.x : boat.x - boat.length / 2 - 20 - SEA_LANES[0],
          this.landEnd(boat, dir));
        target = Math.min(target, Math.max(0, end * 0.5));
        if (hero && this.wake(hero) && hero.altitude < ROCK.altitude && Math.abs(hero.x - boat.x) < boat.length / 2 + ROCK.reach && boat.startle <= 0) {
          boat.rockSpeed += 2.2;
          boat.startle = 1.2;
        }
        boat.startle -= dt;
        const rate = target < boat.speed ? 2 * METRE : 0.8 * METRE;
        boat.speed += Math.max(-rate * dt, Math.min(rate * dt, target - boat.speed));
        boat.x += dir * Math.min(boat.speed * dt, Math.max(0, end));
        boat.rockSpeed += (-6 * boat.rock - 1.2 * boat.rockSpeed) * dt;
        boat.rock += boat.rockSpeed * dt;
        if (end < 2 && boat.speed < 0.5) boat.turn = TURN;
      });
    }
    const firstFill = !this.boats.length;
    const zones = firstFill ? [[from - SPAWN_FAR, to + SPAWN_FAR]] : [[from - SPAWN_FAR, from - SPAWN_NEAR], [to + SPAWN_NEAR, to + SPAWN_FAR]];
    const span = [Math.max(SEA_LANES[0], from - SPAWN_FAR), Math.min(SEA_LANES[1], to + SPAWN_FAR)];
    const wanted = Math.max(0, span[1] - span[0]) / BOAT_SPACING;
    for (const lane of BOAT_LANES.keys()) {
      let count = this.boats.filter(b => b.lane === lane && b.x >= span[0] && b.x <= span[1]).length;
      for (let tries = firstFill ? 40 : 1; tries > 0 && count < wanted; tries--) {
        const x = this.spawnIn(zones, [SEA_LANES], 60);
        if (x === null) continue;
        const boat = this.boat(x, lane);
        if (!this.afloat(x, boat.length + 40)) continue;
        if (this.boats.every(b => b.lane !== lane || Math.abs(b.x - x) > (b.length + boat.length) / 2 + BOAT_GAP * 3)) {
          this.boats.push(boat);
          count++;
        }
      }
    }
  }

  // How far a boat may sail heading dir before land is BOAT_GAP short of its bow.
  // Cached per heading; looked up again once the boat has sailed a while.
  landEnd(boat, dir) {
    if (boat.landDir !== dir || Math.abs(boat.x - boat.landFrom) > 500) {
      Object.assign(boat, { landDir: dir, landFrom: boat.x, land: null });
      for (let d = 0; d <= 1400; d += 10) {
        if (isWater(boat.x + dir * d)) continue;
        boat.land = boat.x + dir * d;
        break;
      }
    }
    return boat.land === null ? Infinity : (boat.land - boat.x) * dir - boat.length / 2 - 30;
  }

  makeSprayDrops(count = 14) {
    const drops = [];
    for (let k = 0; k < count; k++) {
      drops.push({
        vx: (this.random() - 0.5) * 80,
        vy: 35 + this.random() * 55,
        r: this.random() < 0.6 ? 1 : 2,
      });
    }
    return drops;
  }

  // Dolphins roam their stretch on their own (feedback #15; QA-09: they never pace the hero). Each
  // swims just under the surface with an undulating body, then now and then leaps on a true
  // ballistic arc: out of the water nose-up, over, and back in nose-down, throwing a splash at each
  // end. The pod cruises at a natural pace that swells and eases, sometimes turns about on a whim,
  // and always turns back at the ends of its home or wherever the water ahead runs out.
  stepPod(pod, dt) {
    pod.paceClock += dt;
    pod.pace = 0.8 + 0.35 * Math.sin(pod.paceClock * 0.4) + 0.15 * Math.sin(pod.paceClock * 1.3);
    if (this.random() < dt / 25) pod.dir = -pod.dir;
    const ahead = pod.x + pod.dir * (DOLPHIN_LENGTH * 2 + 4);
    if (ahead < pod.home[0] || ahead > pod.home[1] || !isWater(ahead + (this.shift ?? 0))) pod.dir = -pod.dir;
    pod.x += pod.dir * 6 * METRE * pod.pace * dt;
    pod.x = Math.max(pod.home[0], Math.min(pod.home[1], pod.x));
    pod.clock = (pod.clock ?? 0) + dt;
    for (const splash of pod.splashes) splash.age += dt;
    pod.splashes = pod.splashes.filter(splash => splash.age < DOLPHIN_SPLASH);
    for (const dolphin of pod.dolphins) {
      dolphin.wave += dt * (pod.chase > 0 ? 14 : 9);
      const air = dolphin.air;
      if (air) {
        air.t += dt;
        // Ahead of the pod in the air, then easing back into formation.
        air.dx += pod.dir * air.vx * dt;
        if (air.t >= air.T) {
          pod.splashes.push({ x: pod.x + dolphin.dx + air.dx, age: 0, size: 0.8, drops: this.makeSprayDrops(18) });
          dolphin.drift = air.dx;
          dolphin.air = null;
          dolphin.wait = (pod.chase > 0 ? 0.8 : 1.8) + this.random() * (pod.chase > 0 ? 0.8 : 2.4);
        }
        continue;
      }
      dolphin.drift *= Math.exp(-1.5 * dt);
      dolphin.wait -= dt;
      if (dolphin.wait > 0) continue;
      const T = (0.75 + this.random() * 0.35) * (dolphin.tScale || 1);
      const H = (18 + this.random() * 16) * (dolphin.hScale || 1);
      const vx = (12 + this.random() * 16) * (dolphin.vxScale || 1);
      dolphin.air = { t: 0, T, H, vx, dx: dolphin.drift };
      pod.splashes.push({ x: pod.x + dolphin.dx + dolphin.drift, age: 0, size: 0.6, drops: this.makeSprayDrops(12) });
    }
  }

  // Splashes from the dolphins: droplets, a column of white water, foam and rings.
  drawSplashes(g, splashes, sea) {
    for (const splash of splashes) {
      const x = splash.x + this.shift;
      const a = splash.age;
      const fade = Math.max(0, 1 - a / (0.9 + splash.size * 0.6));
      if (splash.drops) {
        g.fillStyle(FOAM, 0.95 * fade);
        for (const drop of splash.drops) {
          const h = drop.vy * a - 0.5 * 320 * a * a;
          if (h < -2) continue;
          g.fillRect(Math.round(x + drop.vx * a), Math.round(sea - Math.max(0, h)), drop.r, drop.r);
        }
      }
      // White water: a column that shoots up and slumps.
      const column = 60 * splash.size * Math.max(0, Math.sin(Math.min(1, a / 0.9) * Math.PI));
      if (column > 1) {
        for (let i = -4; i <= 4; i++) {
          const h = column * (1 - Math.abs(i) * 0.18) * (0.75 + hash(i + splash.x) * 0.5);
          g.fillStyle(FOAM, 0.85 * fade);
          g.fillRect(Math.round(x + i * 6 * splash.size) - 2, Math.round(sea - h), 4, Math.round(h));
        }
      }
      // Foam patch, then rings spreading out across the swell and fading.
      g.fillStyle(FOAM, 0.6 * Math.max(0, 1 - a / 2.5));
      const patch = Math.round(30 * splash.size * (1 + a));
      g.fillRect(Math.round(x) - patch, sea, patch * 2, 2);
      for (let k = 0; k < (splash.size > 1 ? 3 : 1); k++) {
        const r = (a - k * 0.5) * (90 + 50 * splash.size);
        if (r <= 0) continue;
        g.fillStyle(FOAM, 0.55 * Math.max(0, 1 - a / SPLASH_LIFE));
        for (const side of [-1, 1]) g.fillRect(Math.round(x + side * r) - 7, sea - 1, 14, 1);
      }
    }
  }

  drawPod(g, pod, sea) {
    const water = SEA_TINT;
    for (const dolphin of pod.dolphins) {
      const air = dolphin.air;
      const x = pod.x + dolphin.dx + (air ? air.dx : dolphin.drift) + this.shift;
      let y;
      let angle;
      let bend;
      let wave = dolphin.wave;
      if (air) {
        // Height and pitch from the arc itself, so the body always points along its path.
        const u = Math.max(0, Math.min(1, air.t / air.T));
        y = sea - 4 * air.H * u * (1 - u);
        const climb = 4 * air.H * (1 - 2 * u) / air.T;
        const ahead = Math.abs(pod.chase > 0 ? 40 : 30) + air.vx;
        angle = Math.atan2(climb, ahead);
        // Dynamic anatomical curvature along the parabolic leap:
        // Dorsal flex upward on breach -> graceful convex arch at peak -> downward hydrodynamic dive curvature on entry!
        bend = 4.2 * Math.sin((u - 0.5) * Math.PI);
        wave = Math.PI * 0.5;
      } else {
        // Cruising a body's depth under the surface, rising and falling with each stroke.
        y = sea + 6 + 2.5 * Math.sin(dolphin.wave * 0.35) + (dolphin.dy || 0);
        angle = 0.12 * Math.cos(dolphin.wave * 0.35);
        bend = 2.5;
        // A thin wake on the surface above it.
        g.fillStyle(FOAM, 0.35);
        g.fillRect(Math.round(x - pod.dir * 20) - 6, sea, 12, 1);
      }
      drawCetacean(g, { x, y, dir: pod.dir, angle, length: DOLPHIN_LENGTH, thick: DOLPHIN_LENGTH * 0.11, back: DOLPHIN,
        belly: 0xc8d0d6, sea, water, wave, bend, beak: true, dorsal: 1.4, flipper: 1.2 });
    }
    this.drawSplashes(g, pod.splashes, sea);
  }

  spawnAirBlood(x, relY, vx, vy, count = 12) {
    for (let k = 0; k < count; k++) {
      this.airBlood.push({
        x: x + (this.random() - 0.5) * 6,
        relY: relY + (this.random() - 0.5) * 6,
        vx: vx * (0.3 + this.random() * 0.6) + (this.random() - 0.5) * 50,
        vy: vy * (0.3 + this.random() * 0.5) - 30 - this.random() * 40,
        age: 0,
        life: 0.7 + this.random() * 0.5,
        size: this.random() < 0.6 ? 1 : 2,
        color: this.random() < 0.5 ? 0x900c14 : 0xbf1822,
      });
    }
  }

  spawnBlood(x, size = 22) {
    const puffs = [];
    for (let k = 0; k < 6; k++) {
      puffs.push({
        dx: (this.random() - 0.5) * size * 0.8,
        dy: 2 + this.random() * 8,
        r: size * 0.3 + this.random() * (size * 0.2),
        spread: 1.2 + this.random() * 1.6,
        seed: this.random() * 10,
      });
    }
    this.bloodClouds.push({
      x,
      age: 0,
      life: 6.0,
      alpha: 0.85,
      puffs,
    });
  }

  killDolphin(pod, dolphin, vx, vy) {
    const idx = pod.dolphins.indexOf(dolphin);
    if (idx !== -1) pod.dolphins.splice(idx, 1);
    const deathX = pod.x + dolphin.dx + (dolphin.air ? dolphin.air.dx : dolphin.drift);
    const airHeight = dolphin.air ? 4 * dolphin.air.H * (dolphin.air.t / dolphin.air.T) * (1 - dolphin.air.t / dolphin.air.T) : 0;
    
    // Upward launch impulse (in canvas coordinates, negative y is upward toward sky)
    const upward = Math.max(130, Math.abs(vy || 0) * 1.1 + 80);
    const horiz = (vx || 0) * 0.65 + pod.dir * 45;
    const initialRelY = -Math.max(4, airHeight);

    // Initial mid-air blood burst & ocean breach splash
    this.spawnAirBlood(deathX, initialRelY, horiz, -upward, 14);
    this.spawnBlood(deathX, 30);
    pod.splashes.push({ x: deathX, age: 0, size: 1.1, drops: this.makeSprayDrops(26) });

    this.deadDolphins.push({
      x: deathX,
      relY: initialRelY,
      dir: pod.dir,
      vx: horiz,
      vy: -upward,
      spinRate: (Math.sign(horiz) || 1) * (6.5 + this.random() * 5.0),
      angle: dolphin.air ? 0.35 : 0,
      inAir: true,
      flopping: false,
      flopAge: 0,
      twitch: 0,
      roll: 0,
      age: 0,
      wave: dolphin.wave || 0,
      bubbles: [],
      originalPod: pod,
      originalDolphin: dolphin,
    });
  }

  killShoalFish(shoal, leap, vx, vy) {
    const idx = shoal.leaps.indexOf(leap);
    if (idx !== -1) shoal.leaps.splice(idx, 1);
    const deathX = shoal.x + leap.dx;
    const curHeight = leap.height ? Math.sin((Math.max(0, leap.t) / (leap.duration || 0.6)) * Math.PI) * leap.height : 0;
    const upward = Math.max(120, Math.abs(vy || 0) * 0.9 + 70);
    const horiz = (vx || 0) * 0.5 + leap.dir * 35;
    const initialRelY = -Math.max(3, curHeight);

    this.spawnAirBlood(deathX, initialRelY, horiz, -upward, 8);
    this.spawnBlood(deathX, 14);

    this.deadFish.push({
      x: deathX,
      relY: initialRelY,
      dir: leap.dir,
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
      len: leap.len || 7,
      bubbles: [],
    });
  }

  makeDeadDolphinCorpse(pod, dolphin, sea) {
    this.killDolphin(pod, dolphin, 0, 0);
    return () => {};
  }

  makeDeadFishCorpse(shoal, leap, sea) {
    this.killShoalFish(shoal, leap, 0, 0);
    return () => {};
  }

  stepMarineCasualties(dt) {
    for (const blood of this.bloodClouds) blood.age += dt;
    this.bloodClouds = this.bloodClouds.filter(b => b.age < b.life);

    for (const b of this.airBlood) {
      b.age += dt;
      b.vy += 420 * dt;
      b.relY += b.vy * dt;
      b.x += b.vx * dt;
      if (b.relY >= 0) b.age = b.life;
    }
    this.airBlood = this.airBlood.filter(b => b.age < b.life);

    // Dolphins
    for (const dead of this.deadDolphins) {
      dead.age += dt;
      if (dead.inAir) {
        dead.vy += 420 * dt;
        dead.relY += dead.vy * dt;
        dead.x += dead.vx * dt;
        dead.angle += dead.spinRate * dt;
        dead.roll = Math.min(1.0, dead.age * 1.6);
        if (dead.relY >= 0) {
          // Re-entry water slapdown
          dead.inAir = false;
          dead.relY = 0;
          const impact = Math.abs(dead.vy);
          dead.vy = 0;
          dead.vx *= 0.15;
          dead.spinRate = 0;
          dead.angle = 0;
          dead.flopping = true;
          dead.flopAge = 0;
          if (dead.originalPod) {
            dead.originalPod.splashes.push({
              x: dead.x, age: 0, size: 1.25 + Math.min(0.6, impact / 350),
              drops: this.makeSprayDrops(32),
            });
          }
          this.spawnBlood(dead.x, 28);
        }
      } else {
        // Water physics
        dead.x += dead.dir * 4.5 * dt;
        if (dead.flopping) {
          dead.flopAge += dt;
          const flopDecay = Math.exp(-dead.flopAge * 3.5);
          const spasm = flopDecay * Math.sin(dead.flopAge * 32);
          dead.twitch = spasm;
          dead.roll = Math.min(1.0, Math.max(dead.roll, (1 - flopDecay) * 1.25 + Math.abs(spasm) * 0.25));
          dead.relY = -Math.abs(spasm) * 3 + Math.sin(dead.age * 2.2) * 1.2;
          if (dead.flopAge >= 1.4) {
            dead.flopping = false;
            dead.roll = 1.0;
            dead.twitch = 0;
          }
        } else {
          dead.roll = 1.0;
          dead.twitch = 0;
          if (dead.age < 5.0) {
            dead.relY = Math.sin(dead.age * 1.8) * 1.8;
          } else {
            const sinkTime = dead.age - 5.0;
            dead.relY = Math.sin(dead.age * 1.8) * 1.5 + sinkTime * 5.5;
            if (dead.relY > 2 && this.random() < dt * 6) {
              dead.bubbles.push({
                dx: (this.random() - 0.5) * 14,
                dy: dead.relY,
                vy: 18 + this.random() * 14,
                r: 1,
              });
            }
          }
        }
      }

      for (const b of dead.bubbles) b.dy -= b.vy * dt;
      dead.bubbles = dead.bubbles.filter(b => b.dy > 0);
    }
    this.deadDolphins = this.deadDolphins.filter(d => d.age < 12);

    // Shoal fish
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
          this.spawnBlood(dead.x, 10);
        }
      } else {
        dead.x += dead.dir * 3.0 * dt;
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

  drawMarineCasualties(g, left, right, sea) {
    // 1. Spreading underwater blood plumes
    for (const blood of this.bloodClouds) {
      const bx = blood.x + this.shift;
      if (bx < left - 60 || bx > right + 60) continue;
      const fade = Math.max(0, 1 - blood.age / blood.life);
      const alpha = blood.alpha * fade;
      for (const puff of blood.puffs) {
        const px = bx + puff.dx * (1 + blood.age * 0.5);
        const py = sea + puff.dy + Math.sin(blood.age * 1.5 + puff.seed) * 1.2;
        const r = puff.r + blood.age * puff.spread;
        // Deep arterial burgundy/crimson
        g.fillStyle(0x7c0f14, alpha * 0.7);
        g.fillCircle(px, py, r * 0.5);
        g.fillStyle(0xa81c22, alpha * 0.5);
        g.fillCircle(px, py, r * 0.85);
        g.fillStyle(0x500c10, alpha * 0.3);
        g.fillCircle(px, py, r);
      }
    }

    // 2. Air blood drops
    for (const b of this.airBlood) {
      const bx = b.x + this.shift;
      if (bx < left - 20 || bx > right + 20) continue;
      const by = sea + b.relY;
      const fade = Math.max(0, 1 - b.age / b.life);
      g.fillStyle(b.color, fade);
      g.fillRect(Math.round(bx), Math.round(by), b.size, b.size);
    }

    // 3. Dead dolphins (ballistic ragdoll tumble, water slap, flopping, belly-up with X eye, sink with bubbles)
    for (const dead of this.deadDolphins) {
      const dx = dead.x + this.shift;
      if (dx < left - 60 || dx > right + 60) continue;
      const dy = sea + dead.relY;
      const sinkAlpha = dead.age > 8 ? Math.max(0, 1 - (dead.age - 8) / 4) : 1;
      const limpBend = dead.inAir ? 1.5 * Math.sin(dead.age * 8) : (dead.flopping ? dead.twitch * 12 : 2.0 * Math.sin(dead.age * 1.5));
      const limpAngle = dead.inAir ? dead.angle : (dead.flopping ? dead.twitch * 0.35 : -dead.dir * 0.05);

      drawCetacean(g, {
        x: dx, y: dy, dir: dead.dir, angle: limpAngle,
        length: DOLPHIN_LENGTH, thick: DOLPHIN_LENGTH * 0.11,
        back: 0x54626e, belly: 0xdde4e8, sea, water: SEA_TINT,
        wave: dead.wave, bend: limpBend, beak: true, dorsal: 1.4, flipper: 1.2,
        roll: dead.roll, alpha: sinkAlpha,
        deadEye: true,
      });

      // Spasmodic surface water flecks while flopping
      if (dead.flopping && Math.abs(dead.twitch) > 0.25) {
        g.fillStyle(FOAM, 0.85);
        for (let k = -2; k <= 2; k++) {
          g.fillRect(Math.round(dx + dead.dir * k * 7 + Math.sin(dead.age * 22 + k) * 3), sea - 2, 2, 2);
        }
      }

      // Buoyant belly-up surface foam ring
      if (dead.roll > 0.8 && dead.relY < 4) {
        g.fillStyle(FOAM, 0.32 * sinkAlpha);
        g.fillRect(Math.round(dx - 18), sea - 1, 36, 2);
        g.fillStyle(FOAM, 0.18 * sinkAlpha);
        g.fillRect(Math.round(dx - 24), sea, 48, 1);
      }

      // Rising oxygen bubbles during deep sink
      if (dead.bubbles.length > 0) {
        g.fillStyle(0xd4f0ff, 0.85 * sinkAlpha);
        for (const b of dead.bubbles) {
          g.fillRect(Math.round(dx + b.dx), Math.round(sea + b.dy), b.r, b.r);
        }
      }
    }

    // 4. Dead shoal fish (ballistic tumble, surface flopping, inverted silver belly-up with X eye, sink)
    for (const dead of this.deadFish) {
      const fx = dead.x + this.shift;
      if (fx < left - 40 || fx > right + 40) continue;
      const fy = sea + dead.relY;
      const len = dead.len || 7;
      const dir = dead.dir;
      const sinkAlpha = dead.age > 5.5 ? Math.max(0, 1 - (dead.age - 5.5) / 2.5) : 1;

      g.save();
      g.translateCanvas(Math.round(fx), Math.round(fy));
      if (dead.inAir) {
        g.rotateCanvas(dead.angle);
      } else if (dead.flopping) {
        g.rotateCanvas(dead.twitch * 0.45);
      } else {
        // Floating upside down (belly-up)
        g.rotateCanvas(Math.PI);
      }

      // Dark cobalt/indigo spine (now underneath when belly-up)
      g.fillStyle(0x1e4460, sinkAlpha);
      g.fillRect(-Math.round(len / 2), -1, len, 1);
      // Silver metallic flank
      g.fillStyle(0xcee4f0, sinkAlpha);
      g.fillRect(-Math.round(len / 2) + 1, 0, len - 2, 1);
      // Pale white belly (now prominent on top when belly-up)
      g.fillStyle(0xffffff, 0.95 * sinkAlpha);
      g.fillRect(-Math.round(len / 2) + 2, 0, len - 4, 1);

      // Forked caudal fin (limp)
      g.fillStyle(0x789cb4, sinkAlpha);
      const tailX = -dir * Math.round(len / 2);
      g.fillRect(tailX, -1, 1, 3);
      g.fillRect(tailX - dir * 1, -2, 1, 1);
      g.fillRect(tailX - dir * 1, 2, 1, 1);

      // Pectoral fin
      g.fillStyle(0xdcf4fc, 0.65 * sinkAlpha);
      g.fillRect(-dir * 1, -2, 2, 1);

      // Arcade dead 'X' eye
      const eyeX = dir * Math.round(len / 2 - 2);
      g.fillStyle(0x101820, sinkAlpha);
      g.fillRect(eyeX - 1, -1, 1, 1);
      g.fillRect(eyeX + 1, -1, 1, 1);
      g.fillRect(eyeX, 0, 1, 1);
      g.fillRect(eyeX - 1, 1, 1, 1);
      g.fillRect(eyeX + 1, 1, 1, 1);

      g.restore();

      // Flopping surface splashes
      if (dead.flopping && Math.abs(dead.twitch) > 0.25) {
        g.fillStyle(FOAM, 0.8);
        g.fillRect(Math.round(fx - 2), sea - 1, 5, 1);
        g.fillRect(Math.round(fx + (Math.sin(dead.age * 28) > 0 ? 3 : -3)), sea - 2, 1, 1);
      }

      // Rising oxygen bubbles during sinking
      if (dead.bubbles.length > 0) {
        g.fillStyle(0xd4f0ff, 0.8 * sinkAlpha);
        for (const b of dead.bubbles) {
          g.fillRect(Math.round(fx + b.dx), Math.round(sea + b.dy), b.r, b.r);
        }
      }
    }
  }

  // Seals lie on the sandbar; startled, they flop into the water and bob there, hauling out again
  // once the hero has gone.
  stepSeal(seal, dt, hero) {
    seal.phase += dt;
    const close = hero && Math.abs(hero.x - seal.x) < 110 && hero.altitude < 90;
    if (seal.state === 'out' && close) Object.assign(seal, { state: 'in', timer: 10 + this.random() * 6, dx: seal.dir * (16 + this.random() * 20) });
    else if (seal.state === 'in') {
      seal.timer -= dt;
      if (seal.timer <= 0 && !close) Object.assign(seal, { state: 'out', dx: 0 });
    }
  }

  // Now and then the shoal breaks the surface in a burst of leaping fish.
  stepShoal(shoal, dt) {
    shoal.timer -= dt;
    for (const leap of shoal.leaps) leap.t += dt;
    shoal.leaps = shoal.leaps.filter(leap => leap.t < (leap.duration || 0.6));
    if (shoal.timer > 0) return;
    shoal.timer = 2.6 + this.random() * 3.2;
    const count = 6 + Math.floor(this.random() * 4);
    for (let i = 0; i < count; i++) {
      shoal.leaps.push({
        dx: (this.random() - 0.5) * 44,
        dir: this.random() < 0.5 ? -1 : 1,
        t: -i * 0.08 - this.random() * 0.05,
        duration: 0.65 + this.random() * 0.25,
        height: 10 + this.random() * 10,
        distance: 14 + this.random() * 16,
        len: 6 + Math.floor(this.random() * 3),
      });
    }
  }

  // Gannets wheel high over the shoal, then fold their wings and plunge, burst up and climb again.
  stepGannet(gannet, dt) {
    gannet.splash = Math.max(0, gannet.splash - dt);
    gannet.timer -= dt;
    if (gannet.state === 'circle') {
      gannet.angle += dt * 0.8;
      gannet.x = gannet.shoal.x + Math.cos(gannet.angle) * gannet.radius;
      gannet.height = gannet.h + Math.sin(gannet.angle * 2) * 10;
      if (gannet.timer <= 0) Object.assign(gannet, { state: 'dive', timer: 0 });
    } else if (gannet.state === 'dive') {
      gannet.height -= 260 * dt;
      if (gannet.height <= 0) Object.assign(gannet, { state: 'under', timer: 0.8, splash: 0.5, height: 0 });
    } else if (gannet.state === 'under') {
      if (gannet.timer <= 0) Object.assign(gannet, { state: 'rise', height: 0 });
    } else {
      gannet.height += 50 * dt;
      gannet.angle += dt * 0.8;
      gannet.x += (gannet.shoal.x + Math.cos(gannet.angle) * gannet.radius - gannet.x) * Math.min(1, dt);
      if (gannet.height >= gannet.h) Object.assign(gannet, { state: 'circle', timer: 6 + this.random() * 10 });
    }
  }

  draw(g, left, right, groundAt, top, bottom) {
    if (this.shift === null) return;
    const centre = (left + right) / 2 - this.shift;
    if (centre < BLUE_SEA.from - 1800 || centre > BLUE_SEA.to + 1800) return;
    const sea = groundAt(BLUE_SEA.from + 2000 + this.shift);
    const visible = (x, pad = 60) => x + this.shift > left - pad && x + this.shift < right + pad;
    this.drawWaves(g, left, right, sea);
    for (const seal of this.seals) if (visible(seal.x)) this.drawSeal(g, seal, sea);
    for (const turtle of this.turtles) if (turtle.up && visible(turtle.x)) this.drawTurtle(g, turtle, sea);
    for (const shark of this.sharks) if (visible(shark.x)) this.drawFin(g, shark, sea);
    for (const lane of BOAT_LANES.keys()) {
      for (const boat of this.boats) if (boat.lane === lane && visible(boat.x, boat.length)) this.drawAfloat(g, boat, sea);
    }
    this.drawMarineCasualties(g, left, right, sea);
    for (const pod of this.pods) if (visible(pod.x, 120)) this.drawPod(g, pod, sea);
    for (const shoal of this.shoals) if (visible(shoal.x)) this.drawShoal(g, shoal, sea);
    const flat = () => sea;
    this.drawBodies(g, flat, left, right);
    for (const flock of this.flocks) {
      if (!visible(flock.x, 300)) continue;
      if (flock.state === 'perched') this.drawPerched(g, flock, flat);
      else if (flock.state === 'flying') this.drawFlying(g, flock, flat);
    }
    for (const gannet of this.gannets) if (visible(gannet.x)) this.drawGannet(g, gannet, sea);
  }

  // Whitecaps: crests that build, break white and fade, scattered over the open water.
  drawWaves(g, left, right, sea) {
    const step = 22;
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      const wx = x - this.shift;
      if (!isWater(wx) || !isWater(wx + step)) continue;
      const k = Math.round(wx / step);
      const crest = Math.sin(this.clock * 0.9 + hash(k) * 12);
      const at = x + Math.round(hash(k + 0.5) * 10);
      if (crest > 0.55) {
        const w = 3 + Math.round((crest - 0.55) * 10);
        g.fillStyle(FOAM, 0.55 + (crest - 0.55));
        g.fillRect(at, sea - 1, w, 1);
        g.fillRect(at + 1, sea - 2, Math.max(1, w - 3), 1);
      } else if (crest < -0.6) {
        g.fillStyle(0x1f5a8a, 0.35);
        g.fillRect(at, sea + 2, 6, 1);
      }
    }
  }

  boatFacing(boat) {
    return BOAT_LANES[boat.lane].dir;
  }

  waterline(boat) {
    return BOAT_LANES[boat.lane].y;
  }

  // Drawn at the art's own size, then scaled about the waterline to the kind's size (BOATS scale).
  drawBoat(g, boat, sea) {
    const x = Math.round(boat.x + this.shift);
    const dir = BOAT_LANES[boat.lane].dir;
    const y = sea + BOAT_LANES[boat.lane].y + Math.round(Math.sin(boat.phase * 1.4) * 0.8);
    const scale = boat.scale ?? 1;
    if (scale !== 1) {
      g.save();
      g.translateCanvas(x, y);
      g.scaleCanvas(scale, scale);
      g.translateCanvas(-x, -y);
    }
    const length = Math.round(boat.art ?? boat.length);
    const left = x - Math.round(length / 2);
    const front = t => dir > 0 ? left + t * length : left + (1 - t) * length;
    // No wake trail behind the stern (it read as a dotted line): only a bow wave under way, bigger
    // on a big ship. A holed boat has stopped, so she has none either (QA-08).
    if (boat.sink === undefined && boat.speed > 0.5) {
      const wave = Math.max(3, Math.round(length / 60));
      g.fillStyle(FOAM, 0.8);
      g.fillRect(Math.round(front(0.97)) - (dir > 0 ? 1 : wave - 1), y - 1, wave, 2);
      g.fillStyle(FOAM, 0.45);
      g.fillRect(Math.round(front(0.9)) - (dir > 0 ? 0 : wave * 2), y, wave * 2, 1);
    }
    // A big ship barely pitches: the rocking shrinks with her length.
    const steady = Math.min(1, 12 * METRE / length);
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas((Math.max(-0.12, Math.min(0.12, boat.rock * 0.05)) + Math.sin(boat.phase * 1.1) * 0.015) * steady);
    g.translateCanvas(-x, -y);
    const draw = { yacht: this.drawYacht, trawler: this.drawTrawler, tug: this.drawTug, dinghy: this.drawDinghy,
      cutter: this.drawCutter, freighter: this.drawFreighter, tanker: this.drawTanker }[boat.kind];
    draw.call(this, g, boat, { x, y, dir, left, length, front });
    g.restore();
    if (scale !== 1) g.restore();
  }

  // What a sinking ship leaves on the surface (city-life.js drawAfloat): a freighter sheds
  // containers that bob awash and drift off; a tanker bleeds a spreading black slick that burns
  // under a column of oily smoke; a working boat (trawler, tug, cutter) leaves a lifebuoy and a
  // crate. t runs 0..1 over the sinking; x, y: her centre on the waterline.
  drawWreckage(g, boat, x, y, t) {
    const dir = BOAT_LANES[boat.lane].dir;
    const r = k => hash(boat.seed * 0.137 + k);
    const fade = 1 - Math.max(0, (t - 0.8) / 0.2);
    if (boat.kind === 'freighter') {
      const w = px(6.1);
      const h = px(2.6);
      for (let k = 0; k < 6; k++) {
        const born = 0.18 + k * 0.08;
        if (t < born) continue;
        const age = (t - born) * 7.5;
        const cx = Math.round(x + (r(k) - 0.5) * boat.length * 0.8 + dir * age * px(0.8) * (r(k + 9) - 0.3));
        const bob = Math.round(Math.sin(this.clock * 1.6 + k * 2) * 1.2);
        g.save();
        g.translateCanvas(cx, y + bob);
        g.rotateCanvas((r(k + 3) - 0.5) * 0.5 + Math.sin(this.clock * 1.1 + k) * 0.06);
        g.fillStyle(CONTAINERS[k % CONTAINERS.length], 0.95 * fade);
        g.fillRect(-Math.round(w / 2), -Math.round(h * 0.45), w, h);
        g.fillStyle(0x000000, 0.18 * fade);
        for (let rx = -Math.round(w / 2) + 2; rx < w / 2 - 1; rx += 3) g.fillRect(rx, -Math.round(h * 0.45), 1, h);
        g.restore();
        // Awash: the sea laps over her lower half.
        g.fillStyle(SEA_TINT, 0.6);
        g.fillRect(cx - Math.round(w * 0.55), y + bob + Math.round(h * 0.15), Math.round(w * 1.1), Math.round(h * 0.45));
        g.fillStyle(FOAM, 0.5 * fade);
        g.fillRect(cx - Math.round(w * 0.55), y + bob + Math.round(h * 0.15) - 1, Math.round(w * 1.1), 1);
      }
      return;
    }
    if (boat.kind === 'tanker') {
      // The slick spreads a little past her ends and outlasts her.
      const spread = Math.min(1, t * 1.6);
      const half = Math.round(boat.length * (0.35 + 0.3 * spread));
      g.fillStyle(0x15171b, 0.5 * spread);
      g.fillRect(x - half, y - 1, half * 2, 2);
      g.fillStyle(0x15171b, 0.25 * spread);
      g.fillRect(x - half - 12, y, half * 2 + 24, 1);
      // A dull rainbow sheen glinting on it.
      g.fillStyle(0x6a5a8a, 0.35 * spread);
      for (let k = 0; k < 5; k++) g.fillRect(Math.round(x + (r(k) - 0.5) * half * 1.6), y - 1, 8, 1);
      // Fire where she is holed, along her midbody: small flickering tongues, and a thin column of
      // black smoke leaning downwind (aft), greying as it climbs.
      const fire = Math.min(1, t * 3) * (1 - Math.max(0, (t - 0.85) / 0.15));
      const burn = boat.length * 0.25;
      for (let k = 0; k < 7; k++) {
        const fx = Math.round(x + (r(k + 20) - 0.5) * burn * 2);
        const flick = 0.5 + 0.5 * Math.sin(this.clock * 13 + k * 1.7);
        const fh = Math.round((6 + 12 * r(k + 30)) * (0.6 + 0.4 * flick) * fire);
        if (fh < 2) continue;
        g.fillStyle(0xd9542a, 0.85 * fire);
        g.fillTriangle(fx - 4, y - 1, fx + 4, y - 1, fx, y - 1 - fh);
        g.fillStyle(0xf2c04a, 0.9 * fire);
        g.fillTriangle(fx - 2, y - 1, fx + 2, y - 1, fx, y - 1 - Math.round(fh * 0.55));
      }
      // Two plumes, each a dense chain of overlapping puffs that billow as they climb.
      for (let plume = 0; plume < 2; plume++) {
        const base = x + (plume ? 0.35 : -0.2) * burn;
        for (let k = 0; k < 18; k++) {
          const rise = (this.clock * 0.22 + k / 18 + plume * 0.5) % 1;
          const sx = Math.round(base + (r(k + 40 + plume * 20) - 0.5) * 10 * (1 + rise * 3) + rise * rise * 90 * -dir);
          g.fillStyle(lerp(0x24252a, 0x707276, rise), 0.42 * fire * (1 - rise) ** 1.3);
          g.fillCircle(sx, Math.round(y - 10 - rise * 160), Math.round(6 + rise * 16));
        }
      }
      return;
    }
    if (boat.kind === 'trawler' || boat.kind === 'tug' || boat.kind === 'cutter') {
      if (t < 0.3) return;
      const drift = (t - 0.3) * px(3);
      const bx = Math.round(x - dir * boat.length * 0.3 - dir * drift);
      const by = y + Math.round(Math.sin(this.clock * 1.8) * 0.8);
      g.lineStyle(2, 0xe8642e, fade);
      g.strokeCircle(bx, by - 1, px(0.35));
      g.fillStyle(0xeeeae0, fade);
      g.fillRect(bx - 1, by - px(0.35) - 2, 2, 2);
      g.fillStyle(0x9a7a4e, fade);
      g.fillRect(Math.round(x + dir * boat.length * 0.15 + dir * drift * 0.6), y - 2 + Math.round(Math.sin(this.clock * 2.1 + 1)), px(0.8), px(0.5));
    }
  }

  // [x, width] of the stretch from t = a to t = b along the boat (0 stern, 1 bow), whichever way
  // she faces.
  reach(c, a, b) {
    const [p, q] = [c.front(a), c.front(b)].sort((m, n) => m - n);
    return [Math.round(p), Math.max(1, Math.round(q - p))];
  }

  // A row of windows w x h px every step px across [x, x + width) with its top at y.
  windows(g, x, width, y, w, h, step, color = 0x34424e) {
    g.fillStyle(color);
    for (let wx = x + Math.round((width % step) / 2 + (step - w) / 2); wx + w <= x + width - 1; wx += step) g.fillRect(wx, y, w, h);
  }

  // A shaped hull, sized in metres from the hero: a transom stern, a sheer line rising to a raked
  // bow, a boot top at the waterline, a shaded lower half and a pale rail along the deck. Most of a
  // real hull is under water, so the part below the waterline (draft px deep) shows faintly through
  // the sea. depth and sheer are px above c.y. opts: bulb (a bulbous bow), fin (a yacht's fin keel
  // under a shallow canoe body).
  hull(g, c, color, depth, sheer = 3, boot = 0x2a2f36, bootHeight = 2, draft = 0, opts = {}) {
    const d = c.dir;
    const bow = Math.round(c.front(1));
    const stern = Math.round(c.front(0));
    const rake = Math.round((depth + sheer) * 0.9);
    if (draft > 0) this.underwater(g, c, boot, draft, rake, opts);
    // x of the raked stem h px above the waterline.
    const stem = h => Math.round(bow - d * rake * (1 - (h + 1) / (depth + sheer + 1)));
    const deck = [
      { x: stern, y: c.y - depth + 1 },
      { x: Math.round(c.front(0.55)), y: c.y - depth },
      { x: Math.round(c.front(0.82)), y: c.y - depth - Math.round(sheer * 0.35) },
      { x: bow, y: c.y - depth - sheer },
    ];
    const keel = [{ x: bow - d * rake, y: c.y + 1 }, { x: stern + d * 2, y: c.y + 1 }];
    g.fillStyle(color);
    g.fillPoints([...deck, ...keel], true);
    const half = Math.round(depth / 2);
    g.fillStyle(0x000000, 0.14);
    g.fillPoints([{ x: stern + d, y: c.y - half }, { x: stem(half), y: c.y - half }, ...keel], true);
    g.fillStyle(boot);
    g.fillPoints([{ x: stern + d * 2, y: c.y - bootHeight }, { x: stem(bootHeight), y: c.y - bootHeight }, ...keel], true);
    g.fillStyle(lerp(color, 0xffffff, 0.4));
    g.fillPoints([...deck, ...deck.slice().reverse().map(p => ({ x: p.x, y: p.y + 1 }))], true);
  }

  // The hull below the waterline, tinted by the sea: a rounded forefoot, a flat bottom, the run
  // rising to the stern with the rudder, and a bulb or a fin keel.
  underwater(g, c, boot, draft, rake, opts) {
    const d = c.dir;
    const stern = Math.round(c.front(0));
    const stem = Math.round(c.front(1)) - d * rake;
    const body = opts.fin ? Math.max(2, Math.round(draft * 0.28)) : draft;
    g.fillStyle(lerp(boot, SEA_TINT, 0.6), 0.5);
    g.fillPoints([
      { x: stern + d * 2, y: c.y + 1 },
      { x: stem, y: c.y + 1 },
      { x: stem - d * Math.round(body * 0.5), y: c.y + Math.round(body * 0.7) },
      { x: stem - d * Math.round(body * 1.3), y: c.y + body },
      { x: stern + d * Math.round(body * 1.6 + 4), y: c.y + body },
      { x: stern + d * 4, y: c.y + Math.round(body * 0.4) },
    ], true);
    if (opts.bulb) g.fillEllipse(stem - d * Math.round(draft * 0.2), c.y + Math.round(draft * 0.66), Math.round(draft * 0.8), Math.round(draft * 0.42));
    if (opts.fin) {
      const [fa, fw] = this.reach(c, 0.42, 0.56);
      g.fillPoints([{ x: fa, y: c.y + body }, { x: fa + fw, y: c.y + body },
        { x: fa + fw - d * 2, y: c.y + draft }, { x: fa + 3, y: c.y + draft }], true);
      g.fillRect(stern + d * 6 - 1, c.y + 1, 3, Math.round(draft * 0.75));
      return;
    }
    // Rudder and propeller under the stern.
    const rudder = stern + d * Math.max(3, Math.round(draft * 0.3));
    g.fillRect(rudder - 1, c.y + Math.round(draft * 0.3), Math.max(2, Math.round(draft * 0.12)), Math.round(draft * 0.65));
    g.fillStyle(lerp(boot, SEA_TINT, 0.4), 0.5);
    const prop = rudder + d * Math.max(3, Math.round(draft * 0.22));
    g.fillRect(prop - 1, c.y + Math.round(draft * 0.45), 2, Math.round(draft * 0.4));
  }

  // A row of portholes along the hull.
  portholes(g, c, from, to, h, step = 8, color = 0x2a3440) {
    g.fillStyle(color);
    const [a, b] = [c.front(from), c.front(to)].sort((p, q) => p - q);
    for (let px = Math.round(a); px < b; px += step) g.fillRect(px, c.y - h, 2, 2);
  }

  // A seated person seen side on, head and shoulders above y (the cockpit or tube top).
  sitter(g, x, y, shirt, skin = 0xd9a47a) {
    g.fillStyle(shirt);
    g.fillRect(x - 2, y - 7, 4, 7);
    g.fillStyle(skin);
    g.fillRect(x - 2, y - 11, 4, 4);
    g.fillStyle(0x3a2e26);
    g.fillRect(x - 2, y - 12, 4, 1);
  }

  // Sailing yacht, 11 m: a sleek white hull over a fin keel, a coachroof with long windows, a
  // 14 m mast with the mainsail on its boom and a jib to the stem, and the helmsman in the cockpit.
  drawYacht(g, boat, c) {
    const depth = px(1.1);
    this.hull(g, c, boat.hull ?? 0xf4f2ec, depth, px(0.4), boat.boot ?? 0x20344c, 2, px(1.9), { fin: true });
    const deck = c.y - depth;
    const [ra, rw] = this.reach(c, 0.3, 0.64);
    g.fillStyle(0xeeeae0);
    g.fillRect(ra, deck - px(0.6), rw, px(0.6) + 1);
    g.fillStyle(boat.trim ?? 0x34424e);
    g.fillRect(ra + 3, deck - px(0.45), rw - 6, 2);
    // Helmsman in the cockpit aft.
    this.sitter(g, Math.round(c.front(0.14)), deck + 1, pick([0x4f6a86, 0xc98a4a, 0x8c4f4a], hash(boat.seed)));
    const mast = Math.round(c.front(0.62));
    const top = deck - px(14);
    g.fillStyle(0xd8d8d0);
    g.fillRect(mast, top, 1, deck - top);
    g.fillRect(mast - c.dir * 2, top + px(4), 1, 1);
    // Boom 2 m above the deck, the mainsail above it, and the jib from 85% up to the stem.
    const boom = deck - px(2);
    const clew = Math.round(c.front(0.12));
    g.fillStyle(0xb8b8b0);
    g.fillRect(Math.min(mast, clew), boom, Math.abs(mast - clew), 1);
    g.fillStyle(boat.sail ?? 0xeeeae0);
    g.fillTriangle(mast - c.dir, top + 2, mast - c.dir, boom - 1, clew, boom - 1);
    g.fillStyle(lerp(boat.sail ?? 0xeeeae0, 0x000000, 0.12));
    g.fillTriangle(mast + c.dir, top + px(2), mast + c.dir, deck - 2, Math.round(c.front(0.98)), deck - px(0.3));
    // Battens on the main.
    g.fillStyle(lerp(boat.sail ?? 0xeeeae0, 0x000000, 0.08));
    for (let i = 1; i < 4; i++) {
      const by = boom - Math.round((boom - top) * i / 4);
      const reach = Math.round(Math.abs(mast - clew) * (1 - i / 4));
      g.fillRect(c.dir > 0 ? mast - reach : mast, by, reach, 1);
    }
  }

  // Stern trawler, 20 m: a high bow, the wheelhouse forward, an A-frame gantry aft with the net
  // drum, a tall mast with outriggers, and the gulls following.
  drawTrawler(g, boat, c) {
    const depth = px(1.6);
    // Draft kept shallow (px(1.4), about the hull above water): deeper, it swamped the trawler.
    this.hull(g, c, boat.hull ?? 0x34526e, depth, px(1.3), boat.boot ?? 0x7a3028, 3, px(1.4));
    const deck = c.y - depth;
    // Whaleback shelter and the wheelhouse on top of it.
    const [sa, sw] = this.reach(c, 0.5, 0.86);
    g.fillStyle(boat.shelter ?? 0xd8d4c8);
    g.fillRect(sa, deck - px(2.2), sw, px(2.2) + 1);
    this.windows(g, sa, sw, deck - px(1.6), 2, 2, px(1.2), 0x34424e);
    const [wa, ww] = this.reach(c, 0.56, 0.78);
    g.fillStyle(0xeeeae0);
    g.fillRect(wa, deck - px(4.6), ww, px(2.4) + 1);
    g.fillStyle(0x34424e);
    g.fillRect(wa + 2, deck - px(4), ww - 4, px(1));
    g.fillStyle(boat.trim ?? 0x6a5a4a);
    g.fillRect(wa - 1, deck - px(4.6) - 1, ww + 2, 2);
    // A-frame gantry over the stern, the net drum in front of it.
    const gantry = Math.round(c.front(0.08));
    g.fillStyle(0x6a7076);
    g.fillRect(gantry - 5, deck - px(5.5), 2, px(5.5));
    g.fillRect(gantry + 4, deck - px(5.5), 2, px(5.5));
    g.fillRect(gantry - 5, deck - px(5.5), 11, 2);
    const drum = Math.round(c.front(0.22));
    g.fillStyle(0x5a6a4a);
    g.fillCircle(drum, deck - px(1), px(0.9));
    g.fillStyle(0x7a8a6a);
    for (let k = -1; k <= 1; k++) g.fillRect(drum - px(0.9), deck - px(1) + k * 3, px(1.8), 1);
    // Mast with its yard and lights (no diagonal outrigger boom).
    const mast = Math.round(c.front(0.68));
    g.fillStyle(0x6a7076);
    g.fillRect(mast, deck - px(10), 1, px(5.4));
    g.fillRect(mast - 6, deck - px(8.5), 13, 1);
    g.fillStyle(0xc9a83a);
    g.fillRect(mast - 1, deck - px(10) - 2, 3, 2);
    g.fillRect(Math.round(c.front(0.36)), deck - px(0.8), 4, px(0.8));
    // Gulls tag along above the stern.
    g.fillStyle(0xf2f4f2);
    for (let i = 0; i < 3; i++) {
      const gx = Math.round(c.front(-0.05 - i * 0.08)) + Math.round(Math.sin(boat.phase * 2 + i * 2) * 4);
      const gy = deck - px(7) - i * 9 + Math.round(Math.sin(boat.phase * 3 + i) * 3);
      const up = Math.sin(boat.phase * 6 + i) > 0;
      g.fillRect(gx - 1, gy, 3, 1);
      g.fillRect(gx - 3, up ? gy - 1 : gy + 1, 2, 1);
      g.fillRect(gx + 2, up ? gy - 1 : gy + 1, 2, 1);
    }
  }

  // Harbour tug, 24 m: a red, navy, green or ochre hull (and wheelhouse trim) with a heavy black fender band and a bow fender, the main
  // deckhouse, the tall all-round wheelhouse on top, twin stacks, and the towing winch aft.
  drawTug(g, boat, c) {
    const depth = px(1.6);
    // Draft kept shallow (px(1.6), level with the hull above water): deeper, it swamped the tug.
    this.hull(g, c, boat.hull ?? 0xa4342a, depth, px(1), boat.boot ?? 0x24262a, 4, px(1.6));
    const deck = c.y - depth;
    // Fendering along the sheer and a big pudding fender on the stem.
    g.fillStyle(0x2a2a2c);
    const [fa, fw] = this.reach(c, 0.01, 0.96);
    g.fillRect(fa, deck + 1, fw, px(0.5));
    g.fillCircle(Math.round(c.front(0.99)), deck - 1, px(0.6));
    // Twin stacks behind the wheelhouse, standing on the deck (drawn first, so the deckhouse hides
    // the foot of the one beside it).
    for (const t of [0.36, 0.42]) {
      const s = Math.round(c.front(t));
      g.fillStyle(0x3a3e42);
      g.fillRect(s - 2, deck - px(5.5), 4, px(5.5) + 1);
      g.fillStyle(boat.band ?? 0xc9a83a);
      g.fillRect(s - 2, deck - px(5.1), 4, 2);
    }
    const [ha, hw] = this.reach(c, 0.4, 0.78);
    g.fillStyle(0xe2dccb);
    g.fillRect(ha, deck - px(2.5), hw, px(2.5) + 1);
    this.windows(g, ha, hw, deck - px(1.9), 3, 3, px(1.4), 0x34424e);
    const [wa, ww] = this.reach(c, 0.5, 0.74);
    g.fillRect(wa, deck - px(5.2), ww, px(2.7) + 1);
    g.fillStyle(0x34424e);
    g.fillRect(wa + 2, deck - px(4.6), ww - 4, px(1.2));
    g.fillStyle(boat.trim ?? boat.hull ?? 0xa4342a);
    g.fillRect(wa - 1, deck - px(5.2) - 2, ww + 2, 2);
    // Mast with the towing lights.
    const mast = Math.round(c.front(0.62));
    g.fillStyle(0x6a7076);
    g.fillRect(mast, deck - px(9), 1, px(3.8));
    g.fillRect(mast - 4, deck - px(7.5), 9, 1);
    g.fillStyle(0xeeeae0);
    g.fillRect(mast - 1, deck - px(8.2), 3, 2);
    g.fillRect(mast - 1, deck - px(7), 3, 2);
    // Towing winch and H-bitt aft.
    g.fillStyle(0x2f2f30);
    const [ta, tw] = this.reach(c, 0.2, 0.3);
    g.fillRect(ta, deck - px(1.2), tw, px(1.2));
    g.fillRect(Math.round(c.front(0.08)) - 3, deck - px(1), 7, 2);
    g.fillRect(Math.round(c.front(0.08)) - 3, deck - px(1), 2, px(1));
    g.fillRect(Math.round(c.front(0.08)) + 2, deck - px(1), 2, px(1));
    // A wisp of smoke.
    g.fillStyle(0xc8ccd0, 0.5);
    const puff = (boat.phase * 12) % 16;
    g.fillCircle(Math.round(c.front(0.39)) - c.dir * puff, deck - px(5.6) - puff * 0.6, 2 + puff / 5);
  }

  drawDinghy(g, boat, c) {
    // An inflatable boat, 4 m: two fat tubes, two people sitting on them and an outboard.
    const tube = px(0.5);
    for (const [i, t] of [0.3, 0.66].entries()) this.sitter(g, Math.round(c.front(t)), c.y - tube + 2, i ? 0x4f6a86 : 0xc9a83a);
    g.fillStyle(boat.hull ?? 0xd9602b);
    g.fillRoundedRect(c.left + 1, c.y - tube, c.length - 2, tube + 1, Math.floor(tube / 2));
    g.fillStyle(lerp(boat.hull ?? 0xd9602b, 0xffffff, 0.3));
    g.fillRect(c.left + 3, c.y - tube, c.length - 6, 1);
    g.fillStyle(boat.trim ?? 0x3a3e42);
    g.fillRect(c.left + 2, c.y, c.length - 4, 1);
    // Outboard on the transom.
    const stern = Math.round(c.front(0));
    g.fillRect(stern - c.dir * 2 - 2, c.y - px(0.9), 5, px(0.5));
    g.fillRect(stern - c.dir * 2, c.y - px(0.4), 1, px(0.8));
  }

  // Coast guard patrol vessel, 28 m: a white or patrol-grey hull with a diagonal stripe, a two-deck
  // superstructure with raked bridge windows, a mast with radar and the blue light, and a rescue RIB on the stern.
  drawCutter(g, boat, c) {
    const depth = px(2.2);
    this.hull(g, c, boat.hull ?? 0xeeeae0, depth, px(1), boat.boot ?? 0x2a2f36, 3, px(2.2));
    const deck = c.y - depth;
    const s = Math.round(c.front(0.84));
    g.fillStyle(boat.stripe1 ?? 0xb8463c);
    g.fillPoints([{ x: s, y: deck }, { x: s + c.dir * px(1.4), y: deck }, { x: s - c.dir * px(1), y: c.y - 2 }, { x: s - c.dir * px(2.4), y: c.y - 2 }], true);
    g.fillStyle(boat.stripe2 ?? 0x3f5a86);
    const b = s - c.dir * px(2.2);
    g.fillPoints([{ x: b, y: deck }, { x: b + c.dir * 3, y: deck }, { x: b - c.dir * px(2.4) + c.dir * 3, y: c.y - 2 }, { x: b - c.dir * px(2.4), y: c.y - 2 }], true);
    this.portholes(g, c, 0.2, 0.62, Math.round(depth * 0.55), px(1.4));
    const [ha, hw] = this.reach(c, 0.3, 0.7);
    g.fillStyle(0xeeeae0);
    g.fillRect(ha, deck - px(2.5), hw, px(2.5) + 1);
    this.windows(g, ha, hw, deck - px(1.8), 3, 3, px(1.3));
    // Bridge deck, its front raked back.
    const [ba, bw] = this.reach(c, 0.38, 0.66);
    const fore = Math.round(c.front(0.66));
    g.fillStyle(0xeeeae0);
    g.fillRect(ba, deck - px(5), bw, px(2.5));
    g.fillTriangle(fore, deck - px(2.5), fore, deck - px(5), fore + c.dir * px(1.2), deck - px(2.5));
    g.fillStyle(0x34424e);
    g.fillRect(ba + 2, deck - px(4.3), bw - 4, px(1));
    g.fillRect(Math.min(fore, fore + c.dir * px(0.6)), deck - px(4.3), px(0.6), px(1));
    const mast = Math.round(c.front(0.52));
    g.fillStyle(boat.trim ?? 0x6a7076);
    g.fillRect(mast, deck - px(9), 1, px(4));
    const radar = Math.sin(boat.phase * 4) > 0 ? px(1) : 2;
    g.fillRect(mast - radar, deck - px(7.5), radar * 2 + 1, 2);
    g.fillStyle(Math.sin(boat.phase * 6) > 0 ? 0x6ab0ff : 0x3a5a7a);
    g.fillRect(mast - 1, deck - px(9) - 3, 3, 3);
    // Rescue RIB in its cradle on the stern.
    const [ra, rw] = this.reach(c, 0.05, 0.22);
    g.fillStyle(boat.ribColor ?? 0xd8783a);
    g.fillRoundedRect(ra, deck - px(1.1), rw, px(0.7), 2);
    g.fillStyle(0x3a3e42);
    g.fillRect(ra + 2, deck - px(0.4), rw - 4, px(0.4));
  }

  // Superstructure bridge block: multi-tier stepped accommodation, overhanging bridge wings with
  // navigation repeater stands, tinted sun-visor wheelhouse glazing, monkey island with rotating
  // radar scanner bar, spherical satcom radome, raked funnel with silencer pipes, and an enclosed
  // SOLAS free-fall stern lifeboat on an angled launching slipway.
  bridgeBlock(g, c, boat, deck, a, b, decks = 5) {
    const dh = px(2.7);
    const [aa, aw] = this.reach(c, a, b);
    const top = deck - decks * dh;
    // Main accommodation block
    g.fillStyle(0xf0eee8);
    g.fillRect(aa, top, aw, decks * dh + 1);
    g.fillStyle(0x000000, 0.12);
    g.fillRect(aa, deck - dh, aw, dh);
    // Deck levels with shadow lines and safety railings
    for (let i = 1; i < decks; i++) {
      const dy = top + i * dh;
      g.fillStyle(0xc5c0b4);
      g.fillRect(aa - 1, dy, aw + 2, 1);
      g.fillStyle(0x8a9298);
      g.fillRect(aa - 1, dy - 2, aw + 2, 1);
      this.windows(g, aa, aw, dy + px(0.9), px(0.8), px(0.8), px(2.2));
    }
    // Wheelhouse: overhanging bridge wings reaching outboard with repeater stands
    const wing = px(1.8);
    g.fillStyle(0xf0eee8);
    g.fillRect(aa - wing, top - 1, aw + wing * 2, px(0.6) + 1);
    // Dark anti-glare tinted bridge glazing
    g.fillStyle(0x182430);
    g.fillRect(aa - wing + 1, top + px(0.6), aw + wing * 2 - 2, px(1.2));
    // Bridge wing repeater pedestals and safety rail
    g.fillStyle(0x5a646c);
    g.fillRect(aa - wing, top - 2, 2, px(1.6));
    g.fillRect(aa + aw + wing - 2, top - 2, 2, px(1.6));
    // Bridge roof visor
    g.fillStyle(0xdedad0);
    g.fillRect(aa - wing - 1, top - 2, aw + wing * 2 + 2, 1);

    // Funnel: raked modern casing with company band and exhaust pipes
    const f = Math.round(c.front(a + (b - a) * 0.28));
    const fw = px(3.6);
    const fh = px(5.4);
    g.fillStyle(0x2c3035);
    g.fillPoints([{ x: f - fw / 2, y: top }, { x: f + fw / 2, y: top },
      { x: f + fw / 2 - c.dir * px(0.9), y: top - fh }, { x: f - fw / 2 - c.dir * px(0.9), y: top - fh }], true);
    // Company band
    g.fillStyle(boat.band ?? 0xc9a83a);
    g.fillRect(Math.round(f - fw / 2 - c.dir * px(0.5)), top - px(3.8), fw, px(1.3));
    // Twin dark exhaust stack pipes rising from funnel casing
    g.fillStyle(0x141618);
    g.fillRect(Math.round(f - c.dir * px(0.9) - 2), top - fh - 3, 2, 3);
    g.fillRect(Math.round(f - c.dir * px(0.9) + 1), top - fh - 3, 2, 3);
    // Faint exhaust haze / puff
    g.fillStyle(0xc8ccd0, 0.4);
    const puff = (boat.phase * 10) % 24;
    g.fillCircle(f - c.dir * (px(0.9) + puff), top - fh - 4 - puff * 0.5, 3 + puff / 5);

    // Monkey island (wheelhouse roof): forward radar mast, rotating radar scanner, and white satcom radome dome
    const mast = Math.round(c.front(a + (b - a) * 0.72));
    g.fillStyle(0x606870);
    g.fillRect(mast, top - px(5.2), 1, px(5.2));
    g.fillRect(mast - px(1.4), top - px(3.8), px(2.8) + 1, 1);
    // Rotating radar scanner bar
    const radar = Math.sin(boat.phase * 3.5) > 0 ? px(1.2) : 2;
    g.fillStyle(0x242c34);
    g.fillRect(mast - radar, top - px(4.8), radar * 2 + 1, 2);
    // White spherical satcom radome dome on pedestal
    const domeX = Math.round(c.front(a + (b - a) * 0.5));
    g.fillStyle(0x606870);
    g.fillRect(domeX, top - px(3.4), 1, px(3.4));
    g.fillStyle(0xffffff);
    g.fillCircle(domeX, top - px(3.8), px(1.1));

    // Stern free-fall lifeboat: mounted on an authentic 35° angled launching ramp overhanging the stern
    const [la, lw] = this.reach(c, 0.02, a - 0.02);
    const keel = deck - px(0.6);
    const bh = px(1.6);
    // Steel ramp slipway structure
    g.fillStyle(0x5a646c);
    g.fillRect(la + 1, keel, lw - 2, deck - keel + 1);
    // Angled launching skid
    g.fillStyle(0x7a848c);
    g.fillRect(la + 2, keel - bh - 2, lw - 3, 2);
    // Bright orange enclosed free-fall lifeboat
    g.fillStyle(0xf05a24);
    g.fillRect(la + 2, keel - bh - 1, lw - 4, bh);
    g.fillTriangle(la + 2, keel - bh - 1, la + 2, keel, la - 2, keel - bh - 1);
    g.fillTriangle(la + lw - 2, keel - bh - 1, la + lw - 2, keel, la + lw + 1, keel - bh - 1);
    // Lifeboat cabin canopy and window
    g.fillStyle(0xffffff);
    g.fillRect(la + Math.round(lw * 0.28), keel - bh - px(0.6), Math.round(lw * 0.44), px(0.6));
    g.fillStyle(0x182430);
    g.fillRect(la + Math.round(lw * 0.35), keel - bh - px(0.5), 3, 2);
  }

  // A container feeder, 70 m: modern flared bow with bulbous underwater bulb, white draft marks,
  // forecastle with breakwater baffle, anchor windlass and forward navigation mast, hatch covers
  // stacked two and three high with vibrant 20 and 40 ft intermodal containers (Maersk, Evergreen, MSC,
  // ONE, Hapag-Lloyd, CMA CGM) with corner castings and cell-guide lashing bridges, two detailed
  // electro-hydraulic deck cranes with luffing jibs and suspended spreader bars, and the modern bridge castle aft.
  drawFreighter(g, boat, c) {
    const depth = px(2.6);
    this.hull(g, c, boat.hull, depth, px(1.6), boat.boot ?? 0x8c4f4a, px(0.5), px(4.8), { bulb: true });
    const deck = c.y - depth;

    // White draft marks / plimsoll at bow and stern waterline
    g.fillStyle(0xffffff, 0.7);
    const bowX = Math.round(c.front(0.97));
    const sternX = Math.round(c.front(0.04));
    for (let dy = 0; dy < 4; dy += 2) {
      g.fillRect(bowX - 1, c.y - dy, 2, 1);
      g.fillRect(sternX - 1, c.y - dy, 2, 1);
    }

    // Forecastle: hawse pipe, anchor, mooring windlass winch drums
    const hawse = Math.round(c.front(0.955));
    g.fillStyle(0x1a1e24);
    g.fillRect(hawse - 2, deck + 2, 4, 3);
    g.fillStyle(0x5a6068);
    g.fillRect(hawse - 1, deck + 5, 2, px(0.8));
    // Windlass winch drums on forecastle deck
    const winchX = Math.round(c.front(0.91));
    g.fillStyle(0x3a424a);
    g.fillRect(winchX - 2, deck - px(1.6) - 3, 5, 3);
    g.fillStyle(0x8a929a);
    g.fillRect(winchX - 1, deck - px(1.6) - 4, 3, 1);

    // Forward navigation mast on the forecastle with cross-arm and lantern
    const fore = Math.round(c.front(0.935));
    g.fillStyle(0x7a848c);
    g.fillRect(fore, deck - px(1.6) - px(5.2), 1, px(5.2));
    g.fillRect(fore - 3, deck - px(1.6) - px(3.8), 7, 1);
    g.fillStyle(0xfff0c0);
    g.fillRect(fore, deck - px(1.6) - px(5.4), 1, 2);

    // Breakwater baffle at the front of cargo holds
    const [ca, cw] = this.reach(c, 0.275, 0.87);
    const ahead = Math.round(c.front(0.875));
    g.fillStyle(boat.trim ?? lerp(boat.hull, 0xffffff, 0.15));
    g.fillPoints([{ x: ahead, y: deck }, { x: ahead + c.dir * px(1.8), y: deck },
      { x: ahead, y: deck - px(2.6) }], true);

    // Hatch covers, container bays, and cell guides
    g.fillStyle(0x384048);
    g.fillRect(ca, deck - px(1), cw, px(1) + 1);
    const box = px(6.1);
    const tier = px(2.6);
    const bays = Math.floor((cw - 4) / (box + 1));
    const from = ca + Math.round((cw - bays * (box + 1)) / 2);
    const cranes = new Set([Math.round(bays * 0.33), Math.round(bays * 0.66)]);

    for (let k = 0; k < bays; k++) {
      const bx = from + k * (box + 1);
      const tiers = 2 + (hash(boat.seed + k * 7.3) > 0.3 ? 1 : 0);

      // Cell-guide lashing bridge frame between stacks
      g.fillStyle(0x283038);
      g.fillRect(bx - 1, deck - px(1) - tiers * tier, 1, tiers * tier);

      for (let t = 0; t < tiers; t++) {
        const pair = hash(boat.seed + Math.floor(k / 2) * 3.1 + t) > 0.45 ? Math.floor(k / 2) * 2 : k;
        const color = CONTAINERS[Math.floor(hash(boat.seed * 1.7 + pair * 5 + t * 11) * CONTAINERS.length)];
        const by = deck - px(1) - (t + 1) * tier;
        // Container box body
        g.fillStyle(color);
        g.fillRect(bx, by, box, tier - 1);
        // Top edge highlight
        g.fillStyle(lerp(color, 0xffffff, 0.25));
        g.fillRect(bx, by, box, 1);
        // Vertical corrugation grooves
        g.fillStyle(0x000000, 0.15);
        for (let r = bx + 2; r < bx + box - 1; r += 3) g.fillRect(r, by + 1, 1, tier - 3);
        // Bottom shadow line
        g.fillStyle(0x000000, 0.28);
        g.fillRect(bx, by + tier - 2, box, 1);
        // Corner casting pads (intermodal ISO corner fittings)
        g.fillStyle(0xdedede);
        g.fillRect(bx, by, 1, 1);
        g.fillRect(bx + box - 1, by, 1, 1);
        g.fillRect(bx, by + tier - 2, 1, 1);
        g.fillRect(bx + box - 1, by + tier - 2, 1, 1);
      }

      if (!cranes.has(k)) continue;

      // Modern electro-hydraulic deck crane: heavy pedestal, enclosed cab, angled luffing boom, cables, and spreader bar
      const cx = bx + (c.dir > 0 ? box : 0);
      const ped = deck - px(9.5);
      // Slewing pedestal column with access ladder
      g.fillStyle(0xd8b244);
      g.fillRect(cx - px(0.8), ped, px(1.6), px(9.5) + 1);
      g.fillStyle(0x3a424a);
      g.fillRect(cx - px(0.2), ped, 1, px(9.5)); // ladder
      // Slewing turntable ring
      g.fillStyle(0x283038);
      g.fillRect(cx - px(1.2), ped - 2, px(2.4), 2);
      // Enclosed operator cab
      g.fillStyle(0xd8b244);
      g.fillRect(cx - px(1.3), ped - px(2.2), px(2.6), px(2.2));
      g.fillStyle(0x182430); // cab window
      g.fillRect(cx + (c.dir > 0 ? 0 : -px(1.1)), ped - px(1.8), px(1.1), px(1.1));

      // Diagonal luffing boom (box girder jib reaching over adjacent bay)
      const jibReach = c.dir * px(5.8);
      const jibTipX = cx + jibReach;
      const jibTipY = ped - px(4.6);
      g.fillStyle(0xd8b244);
      g.fillPoints([
        { x: cx - c.dir * 1, y: ped - px(2.0) },
        { x: cx + c.dir * 2, y: ped - px(1.6) },
        { x: jibTipX + c.dir * 1, y: jibTipY },
        { x: jibTipX - c.dir * 1, y: jibTipY - 1 }
      ], true);
      // Hoisting wire cable dropping from boom tip
      g.fillStyle(0x404850);
      g.fillRect(jibTipX, jibTipY, 1, px(3.2));
      // Suspended container spreader bar
      g.fillStyle(0xdedede);
      g.fillRect(jibTipX - px(1.6), jibTipY + px(3.2), px(3.2), 2);
      g.fillStyle(0xff3020); // twistlock ends
      g.fillRect(jibTipX - px(1.6), jibTipY + px(3.2), 1, 3);
      g.fillRect(jibTipX + px(1.5), jibTipY + px(3.2), 1, 3);
    }

    this.bridgeBlock(g, c, boat, deck, 0.1, 0.25, 5);
  }

  // A coastal product tanker, 82 m: low laden freeboard with draft marks and plimsoll disc, raised forecastle
  // with anchor windlasses and gas-monitoring mast, continuous elevated catwalk with safety handrails and stanchions,
  // heavy main cargo oil and vapor header pipelines running fore and aft, midships cross-over cargo manifold with
  // flanged connections and circular valve handwheels, P/V high-velocity gas vent mast risers with flame arresters,
  // foam fire-fighting monitors, articulated hydraulic midships hose-handling crane with sling, and modern bridge castle aft.
  drawTanker(g, boat, c) {
    const depth = px(2.4);
    this.hull(g, c, boat.hull, depth, px(1.8), boat.boot ?? 0x8c4f4a, px(0.6), px(5.4), { bulb: true });
    const deck = c.y - depth;

    // White draft marks and plimsoll disc at bow and stern
    g.fillStyle(0xffffff, 0.7);
    const bowX = Math.round(c.front(0.975));
    const sternX = Math.round(c.front(0.035));
    for (let dy = 0; dy < 4; dy += 2) {
      g.fillRect(bowX - 1, c.y - dy, 2, 1);
      g.fillRect(sternX - 1, c.y - dy, 2, 1);
    }
    // Plimsoll mark midships
    const plimX = Math.round(c.front(0.5));
    g.fillRect(plimX - 2, c.y - 1, 4, 1);
    g.fillRect(plimX - 1, c.y - 2, 2, 3);

    // Forecastle deck: hawse pipe, anchors, windlass drums, bell
    const hawse = Math.round(c.front(0.96));
    g.fillStyle(0x1a1e24);
    g.fillRect(hawse - 2, deck + 2, 4, 3);
    g.fillStyle(0x5a6068);
    g.fillRect(hawse - 1, deck + 5, 2, px(0.9));
    const windlassX = Math.round(c.front(0.92));
    g.fillStyle(0x384048);
    g.fillRect(windlassX - 2, deck - px(1.8) - 3, 5, 3);

    // Forward gas-monitoring mast with cross-trees and navigation lantern
    const fore = Math.round(c.front(0.94));
    g.fillStyle(0x727a82);
    g.fillRect(fore, deck - px(1.8) - px(6.2), 1, px(6.2));
    g.fillRect(fore - 3, deck - px(1.8) - px(4.6), 7, 1);
    g.fillStyle(0xfff0c0);
    g.fillRect(fore, deck - px(1.8) - px(6.4), 1, 2);

    // Trunk deck: cargo tank deck platform
    const [ta, tw] = this.reach(c, 0.23, 0.9);
    g.fillStyle(boat.deck ?? lerp(boat.hull, 0x8c4f4a, 0.5));
    g.fillRect(ta, deck - px(0.8), tw, px(0.8) + 1);

    // Industrial cargo pipeline headers running along the deck
    // Main 16-inch cargo oil header pipe (red-lead oxide)
    g.fillStyle(0x7c342c);
    g.fillRect(ta, deck - px(1.3), tw, 3);
    // Inert gas / vapor recovery line (slate silver)
    g.fillStyle(0x5a6470);
    g.fillRect(ta, deck - px(1.8), tw, 2);
    // Ballast header line (dark olive/charcoal)
    g.fillStyle(0x3a443e);
    g.fillRect(ta, deck - px(2.1), tw, 1);

    // Elevated catwalk (flying gangway): steel grating raised on stanchions over pipelines
    const catTop = deck - px(3.2);
    // Steel stanchions and access ladders
    g.fillStyle(0x606870);
    for (let sx = ta + 4; sx < ta + tw; sx += px(3)) g.fillRect(sx, catTop, 1, px(2.4));
    // Walkway grating
    g.fillStyle(0xa0a8b0);
    g.fillRect(ta, catTop, tw, 1);
    // Continuous top and middle safety handrails
    g.fillStyle(0x8a9298);
    g.fillRect(ta, catTop - 2, tw, 1);
    g.fillRect(ta, catTop - 5, tw, 1);

    // Foam fire-fighting cannons (monitors) on catwalk
    for (const monF of [0.38, 0.68]) {
      const monX = Math.round(c.front(monF));
      g.fillStyle(0xd82b24);
      g.fillRect(monX - 1, catTop - 8, 2, 4);
      g.fillRect(monX + c.dir, catTop - 8, 2, 1); // angled nozzle
    }

    // P/V high-velocity gas vent mast risers in a row with flame arresters
    for (let k = 1; k < 7; k++) {
      const vx = Math.round(c.front(0.23 + k * 0.092));
      g.fillStyle(0x5a626a);
      g.fillRect(vx, deck - px(4.8), 2, px(4.0));
      // Bell-shaped flame arrester head
      g.fillStyle(boat.trim ?? 0x8c4f4a);
      g.fillRect(vx - 2, deck - px(4.8) - 2, 6, 2);
      g.fillStyle(0xffffff, 0.6);
      g.fillRect(vx - 1, deck - px(4.8) - 3, 4, 1);
    }

    // Midships cargo manifold station: cross-over pipes, flanges, valve handwheels, drip tray
    const m = Math.round(c.front(0.52));
    // Drip tray / save-all coaming
    g.fillStyle(0x282c30);
    g.fillRect(m - px(2.8), deck - px(1.0), px(5.6), 2);
    // Cross-over pipe manifolds
    g.fillStyle(0x8a3830);
    g.fillRect(m - px(2.2), deck - px(2.2), px(4.4), 2);
    g.fillStyle(0x606872);
    g.fillRect(m - px(1.8), deck - px(2.8), px(3.6), 2);
    // Valve handwheels (circular handles in safety yellow and red)
    g.fillStyle(0xdca83a);
    g.fillRect(m - px(1.4), deck - px(3.4), 2, 2);
    g.fillStyle(0xd82b24);
    g.fillRect(m + px(0.6), deck - px(3.4), 2, 2);

    // Heavy-duty midships hose handling crane: pedestal, cab, articulated luffing boom, and hose sling
    g.fillStyle(0xd8b244);
    g.fillRect(m - 2, deck - px(6.8), 4, px(6.0)); // pedestal
    // Cab
    g.fillRect(m - 3, deck - px(8.4), 6, px(1.8));
    g.fillStyle(0x182430); // cab window
    g.fillRect(m + (c.dir > 0 ? 0 : -2), deck - px(8.0), 2, 2);
    // Articulated luffing boom reaching over the manifold
    const boomTipX = m + c.dir * px(4.2);
    const boomTipY = deck - px(7.6);
    g.fillStyle(0xd8b244);
    g.fillPoints([
      { x: m - c.dir * 1, y: deck - px(8.2) },
      { x: m + c.dir * 2, y: deck - px(7.8) },
      { x: boomTipX + c.dir * 1, y: boomTipY },
      { x: boomTipX - c.dir * 1, y: boomTipY - 1 }
    ], true);
    // Hoist wire and cargo hose saddle sling
    g.fillStyle(0x384048);
    g.fillRect(boomTipX, boomTipY, 1, px(2.4));
    g.fillStyle(0x1a1a1a);
    g.fillRect(boomTipX - 2, boomTipY + px(2.4), 5, 2);

    this.bridgeBlock(g, c, boat, deck, 0.085, 0.21, 5);
  }

  drawSeal(g, seal, sea) {
    const x = Math.round(seal.x + seal.dx + this.shift);
    if (seal.state === 'in') {
      // Just a head bobbing, watching.
      const y = sea + Math.round(Math.sin(seal.phase * 2) * 0.8);
      g.fillStyle(seal.color);
      g.fillRect(x - 2, y - 4, 4, 4);
      g.fillStyle(0x2a2826);
      g.fillRect(x + seal.dir, y - 3, 1, 1);
      g.fillStyle(FOAM, 0.6);
      g.fillRect(x - 3, y, 7, 1);
      return;
    }
    // Hauled out on the sand, banana-shaped, now and then lifting head and tail.
    const y = sea - 3;
    const lift = Math.sin(seal.phase * 0.7) > 0.8 ? 1 : 0;
    g.fillStyle(seal.color);
    g.fillEllipse(x, y - 2, 16, 5);
    g.fillRect(x + seal.dir * 6 - 1, y - 5 - lift, 4, 3);
    g.fillRect(x - seal.dir * 8, y - 3 - lift, 2, 2);
    g.fillStyle(lerp(seal.color, 0xffffff, 0.2));
    g.fillRect(x - 4, y - 1, 8, 1);
    g.fillStyle(0x2a2826);
    g.fillRect(x + seal.dir * 7 + (seal.dir > 0 ? 0 : 1), y - 4 - lift, 1, 1);
  }

  drawFin(g, shark, sea) {
    const x = Math.round(shark.x + this.shift);
    g.fillStyle(0x4a5058);
    g.fillTriangle(x - shark.dir * 5, sea, x + shark.dir * 1, sea - 9, x + shark.dir * 4, sea);
    g.fillStyle(FOAM, 0.7);
    g.fillRect(x - shark.dir * 9 - (shark.dir > 0 ? 0 : 4), sea, 5, 1);
    g.fillRect(x + shark.dir * 4 - 1, sea - 1, 2, 1);
  }

  drawTurtle(g, turtle, sea) {
    const x = Math.round(turtle.x + this.shift);
    g.fillStyle(0x6a7a4a);
    g.fillEllipse(x, sea, 12, 4);
    g.fillStyle(0x5a6a3e);
    g.fillRect(x - 3, sea - 2, 2, 1);
    g.fillRect(x + 1, sea - 2, 2, 1);
    g.fillStyle(0x8a9a6a);
    g.fillRect(x + 6, sea - 3, 3, 3);
  }

  drawShoal(g, shoal, sea) {
    for (const leap of shoal.leaps) {
      if (leap.t < 0) continue;
      const duration = leap.duration || 0.6;
      if (leap.t > duration) continue;
      const u = Math.max(0, Math.min(1, leap.t / duration));
      const dist = leap.distance || 8;
      const h = leap.height || 7;
      const len = leap.len || 7;
      const x = Math.round(shoal.x + leap.dx + leap.dir * u * dist + this.shift);
      const y = Math.round(sea - Math.sin(u * Math.PI) * h);
      const pitch = (1 - 2 * u) * 0.65;
      const dir = leap.dir;

      g.save();
      g.translateCanvas(x, y);
      g.rotateCanvas(dir * pitch);

      // Dark cobalt/indigo spine
      g.fillStyle(0x1e4460);
      g.fillRect(-Math.round(len / 2), -1, len, 1);
      // Silver metallic flank
      g.fillStyle(0xcee4f0);
      g.fillRect(-Math.round(len / 2) + 1, 0, len - 2, 1);
      // White belly highlight
      g.fillStyle(0xffffff, 0.9);
      g.fillRect(-Math.round(len / 2) + 2, 0, len - 4, 1);

      // Tail fluke (forked caudal fin)
      g.fillStyle(0x789cb4);
      const tailX = -dir * Math.round(len / 2);
      g.fillRect(tailX, -1, 1, 3);
      g.fillRect(tailX - dir * 1, -2, 1, 1);
      g.fillRect(tailX - dir * 1, 2, 1, 1);

      // Translucent pectoral wing (spread during glide)
      g.fillStyle(0xdcf4fc, 0.75);
      g.fillRect(-dir * 1, -2, 2, 1);

      // Tiny eye glint
      g.fillStyle(0xfcd864);
      g.fillRect(dir * Math.round(len / 2 - 2), -1, 1, 1);
      g.fillStyle(0x101820);
      g.fillRect(dir * Math.round(len / 2 - 2), 0, 1, 1);

      g.restore();

      // Froth and glistening splash rings at water breach and reentry
      if (u < 0.18 || u > 0.82) {
        g.fillStyle(FOAM, 0.75);
        g.fillRect(x - 2, sea - 1, 5, 1);
        g.fillStyle(FOAM, 0.45);
        g.fillRect(x - 3, sea, 7, 1);
      }
    }
  }

  drawGannet(g, gannet, sea) {
    const x = Math.round(gannet.x + this.shift);
    if (gannet.splash > 0) {
      g.fillStyle(FOAM, 0.9);
      const h = Math.round(gannet.splash * 16);
      g.fillRect(x - 1, sea - h, 3, h);
      g.fillRect(x - 4, sea - Math.round(h * 0.5), 2, Math.round(h * 0.5));
      g.fillRect(x + 3, sea - Math.round(h * 0.5), 2, Math.round(h * 0.5));
    }
    if (gannet.state === 'under') return;
    const y = sea - Math.round(gannet.height);
    g.fillStyle(0xf4f4f0);
    if (gannet.state === 'dive') {
      // Wings folded back: a white dart, head down.
      g.fillRect(x, y - 6, 2, 7);
      g.fillStyle(0xd8c070);
      g.fillRect(x, y, 2, 1);
      g.fillStyle(0x2a2a2e);
      g.fillRect(x, y - 6, 2, 1);
      return;
    }
    const up = Math.sin(this.clock * 6 + gannet.radius) > 0;
    g.fillRect(x - 2, y, 5, 2);
    g.fillRect(x - 7, up ? y - 1 : y + 1, 5, 1);
    g.fillRect(x + 3, up ? y - 1 : y + 1, 5, 1);
    g.fillStyle(0x2a2a2e);
    g.fillRect(x - 8, up ? y - 1 : y + 1, 1, 1);
    g.fillRect(x + 8, up ? y - 1 : y + 1, 1, 1);
  }

  drawPerched(g, flock, groundAt) {
    if (flock.kind !== 'puffin') return BayportLife.prototype.drawPerched.call(this, g, flock, groundAt);
    for (const bird of flock.birds) {
      const x = Math.round(flock.x + bird.dx + this.shift);
      const y = Math.round(groundAt(x)) + 1 + Math.round(Math.sin(this.clock * 1.6 + bird.phase) * 0.8);
      g.fillStyle(bird.color);
      g.fillRect(x - 2, y - 3, 5, 3);
      g.fillRect(x + bird.dir - 1, y - 5, 3, 2);
      g.fillStyle(PUFFIN.face);
      g.fillRect(x + bird.dir * 1, y - 4, 1, 1);
      g.fillRect(x - 1, y - 1, 3, 1);
      g.fillStyle(PUFFIN.beak);
      g.fillRect(x + bird.dir * 2 + (bird.dir > 0 ? 1 : -1), y - 4, 1, 2);
    }
  }

  drawFlying(g, flock, groundAt) {
    if (flock.kind !== 'puffin') return BayportLife.prototype.drawFlying.call(this, g, flock, groundAt);
    // Puffins whirr low and fast on short wings.
    for (const bird of flock.birds) {
      const x = Math.round(bird.x + this.shift);
      const y = Math.round(groundAt(x)) + 1 - Math.round(Math.min(bird.h, 40));
      const up = Math.sin(bird.phase * 2.5) > 0;
      g.fillStyle(bird.color);
      g.fillRect(x - 1, y - 1, 3, 2);
      g.fillRect(x - 2, up ? y - 2 : y + 1, 1, 1);
      g.fillRect(x + 2, up ? y - 2 : y + 1, 1, 1);
      g.fillStyle(PUFFIN.beak);
      g.fillRect(x + (bird.vx > 0 ? 2 : -2), y - 1, 1, 1);
    }
  }
}

