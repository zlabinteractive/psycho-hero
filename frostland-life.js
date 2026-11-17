import { HERO_HEIGHT } from './city-life.js';
import { AreaLife } from './area-life.js';
import { EMBER_GATES, FROSTLAND, FROSTLAND_BUILDINGS, FROSTLAND_LANDMARKS, ICE_LAKE_BRIDGE_DECK, FJORD_BRIDGE_DECK } from './frostland-art.js';

const METRE = HERO_HEIGHT / 1.85;

function hash(i) {
  const s = Math.sin(i * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// The base is defended on foot; its surface road has no vehicle traffic.
const SOLDIER_LOOK = { shirt: 0x5a6346, pants: 0x464e36, helmet: true };
const inBase = x => x > EMBER_GATES[0] && x < EMBER_GATES[1];
// Keep surface traffic out of the base, including its eastern approach.
const militaryRoad = x => x >= EMBER_GATES[0];
// Far enough west that the ground over the tunnel ends short of the gate and the base road.
const UNDERPASS_WEST = EMBER_GATES[0] - 180;
const VEHICLES = [
  { kind: 'sedan', length: 4.5 * METRE, height: 1.45 * METRE, weight: 4 },
  { kind: 'pickup', length: 5.2 * METRE, height: 1.8 * METRE, weight: 3 },
  { kind: 'logtruck', length: 11 * METRE, height: 3.2 * METRE, weight: 2 },
  { kind: 'snowplow', length: 8 * METRE, height: 2.8 * METRE, weight: 2 },
  { kind: 'bus', length: 11 * METRE, height: 3.1 * METRE, weight: 1 },
];

const CRUISE = [6 * METRE, 9 * METRE];
const PAINT = [0x485864, 0x8a9aa8, 0xdde6ec, 0x9a3e34, 0x364834, 0x22262a];

const HOTSPOTS = {
  'peaks-rescue-shelter': [4, 40, () => ({ shirt: 0x9a3024, pants: 0x222226, pack: 0x3a3024 })],
  'peaks-summit-observatory': [4, 45, () => ({ shirt: 0x3a4860, pants: 0x242e3a, calm: true })],
  'ice-citadel': [6, 70, () => ({ shirt: 0xdde8ea, pants: 0x8a9aa8, calm: true })],
  'pinewoods-ranger-lookout': [3, 30, () => ({ shirt: 0x364834, pants: 0x242c22, hat: 'ranger' })],
  'pinetown-mill': [8, 65, () => ({ shirt: 0xa44634, pants: 0x423428 })],
  'pinetown-clocktower': [6, 45],
  'arctic-research-station': [5, 45, () => ({ shirt: 0xdd6622, pants: 0x222222, helmet: true })],
  'plains-drill-rig': [4, 35, () => ({ shirt: 0xdd7722, pants: 0x222222, helmet: true })],
  'polaris-nexus': [12, 80, () => ({ shirt: 0x324050, pants: 0x222a34, calm: true })],
  'aurora-spire': [12, 75, () => ({ shirt: 0x52f0d0, pants: 0x1a2632 })],
  'borealis-tower': [8, 60],
  'geothermal-plant': [6, 50, () => ({ shirt: 0xddaa33, pants: 0x333333 })],
  'fjord-foghorn-lighthouse': [2, 25, () => ({ shirt: 0x243040, calm: true })],
  'fjord-observation-deck': [6, 45, () => ({ shirt: 0x485864, calm: true })],
  'harbor-colossus': [10, 80, () => ({ shirt: 0x485864, calm: true })],
  // Ember Base: soldiers in olive fatigues and helmets round the command post and the citadel.
  'ember-geothermal-pump': [6, 45, () => ({ shirt: 0x5a6346, pants: 0x464e36, helmet: true })],
  'volcano-forge': [10, 120, () => ({ shirt: 0x5a6346, pants: 0x464e36, helmet: true })],
  'ice-lake-causeway': [5, 120, () => ({ shirt: 0x9a3024, pants: 0x222226 })],
  'whale-fjord-bridge': [2, 35, () => ({ calm: true, shirt: 0x485864 })],
};

const STOPS = [49800, 56000, 62100];

export class FrostlandLife extends AreaLife {
  constructor(random = Math.random, weather = null) {
    super(random, {
      area: FROSTLAND,
      landmarks: FROSTLAND_LANDMARKS,
      hotspots: HOTSPOTS,
      stops: STOPS,
      // Civilian traffic uses the underpass before the base.
      ends: [FROSTLAND.from, null],
      weather,
      weatherEdge: 1400,
      walkerSpacing: 150,
      carSpacing: 380,
      seed: 920,
    });
    this.doors = FROSTLAND_BUILDINGS.filter(b => b.door).map(b => ({ x: b.x, timer: (hash(b.x) * 6) + 2, id: b.id }));
    this.bridgeDecks = [ICE_LAKE_BRIDGE_DECK, FJORD_BRIDGE_DECK];
    this.bridges = this.bridgeDecks.map(deck => [deck.from, deck.to]);
    // Restrict walking pedestrians to populated towns and settlements (prevent wandering onto mountain slopes)
    this.walkSpans = [
      [43300, 44200], // Peaks Alpine Resort & Shelters
      [45000, 46500], // Ice Lake Village
      [48200, 50800], // Pinewoods Camp
      [52400, 53200], // Pinetown
      [54200, 58200], // Snow City Metropolis
      [61750, 63100], // Whale Fjord Harbor & Town
      [EMBER_GATES[0] + 20, EMBER_GATES[1] - 20], // Ember Base: soldiers only
    ];
    // Civilian traffic takes the underpass under Ember Base (mouth short of the west gate, coming out
    // at Green City's west end); the base road above stays clear for soldiers.
    this.underpasses = [{ x: UNDERPASS_WEST, dir: 1 }];
    this.roadSpans = [[FROSTLAND.from, UNDERPASS_WEST + 30]];
  }

  walkBounds(person) {
    if (this.walkSpans && person) {
      for (const [from, to] of this.walkSpans) {
        if (person.x >= from && person.x <= to) {
          return [from + 20, to - 20];
        }
      }
    }
    const from = this.area?.from ?? FROSTLAND.from;
    const to = this.area?.to ?? FROSTLAND.to;
    return [from + 20, to - 20];
  }

  person(x, r = this.random()) {
    const p = super.person(x, r);
    // Inside the base: soldiers on patrol, walking up and down between the gates.
    if (inBase(x)) return Object.assign(p, SOLDIER_LOOK, { routine: 'stroll' });
    if (!this.doors) return p;
    // Assign purposeful daily routine & destinations
    const roll = hash(x * 0.063 + r * 11.3);
    if (roll < 0.4) {
      // Shopper/worker heading to enter a nearby cabin, shop, or research station
      const bounds = this.walkBounds(p);
      const candidates = this.doors.filter(d => d.x >= bounds[0] && d.x <= bounds[1] && Math.abs(d.x - x) > 20 && Math.abs(d.x - x) < 700);
      if (candidates.length) {
        const door = candidates[Math.floor(hash(x * 0.041) * candidates.length)];
        p.routine = 'visit';
        p.targetDoor = door;
        p.target = door.x;
        p.dir = Math.sign(door.x - x) || p.dir;
      } else {
        p.routine = 'stroll';
      }
    } else if (roll < 0.65) {
      // Commuter heading to transit stop or industrial hub
      const bounds = this.walkBounds(p);
      const candidates = (this.stops ?? []).filter(s => s.x >= bounds[0] && s.x <= bounds[1]);
      if (candidates.length) {
        const stop = candidates[Math.floor(hash(x * 0.057) * candidates.length)];
        p.routine = 'commute';
        p.target = stop.x;
        p.dir = Math.sign(stop.x - x) || p.dir;
      } else {
        p.routine = 'stroll';
      }
    } else if (roll < 0.85) {
      p.routine = 'socialize';
      p.socialTimer = 3 + hash(r * 17) * 6;
    } else {
      p.routine = 'stroll';
    }
    return p;
  }

  stepPerson(person, dt, hero) {
    if (person.routine === 'visit' && person.targetDoor && person.state === 'walk') {
      const dist = person.targetDoor.x - person.x;
      person.dir = Math.sign(dist) || person.dir;
      if (Math.abs(dist) < 7 && this.intact && !person.home) {
        // Enters the building naturally
        Object.assign(person, { state: 'enter', x: person.targetDoor.x, timer: 0.4, fade: 1 });
        return;
      }
    } else if (person.routine === 'socialize' && person.state === 'walk') {
      person.socialTimer = (person.socialTimer ?? 4) - dt;
      if (person.socialTimer <= 0) {
        const neighbor = this.walkers.find(other => other !== person && Math.abs(other.x - person.x) < 25 && other.state !== 'flee');
        if (neighbor) {
          person.state = 'idle';
          person.timer = 3 + this.random() * 4;
          person.dir = Math.sign(neighbor.x - person.x) || person.dir;
          if (this.random() < 0.5) person.gesture = 'wave';
        }
        person.socialTimer = 5 + this.random() * 7;
      }
    }
    super.stepPerson(person, dt, hero);
  }

  // Safety net: a civilian vehicle still driving past the west gate (not a wreck, falling, thrown
  // or held by the hero) is taken off the road.
  stepTraffic(dt, hero) {
    super.stepTraffic(dt, hero);
    this.cars = this.cars.filter(car => car.wreck || car.fall || car.held || car.hurt !== undefined
      || !militaryRoad(car.x - (car.length ?? 0) / 2));
  }

  car(x, lane) {
    const type = this.pickVehicle(VEHICLES);
    const cruise = CRUISE[0] + this.random() * (CRUISE[1] - CRUISE[0]);
    const paint = PAINT[Math.floor(this.random() * PAINT.length)];
    return {
      x,
      lane,
      ...type,
      cruise,
      speed: cruise,
      bounce: 0,
      bounceSpeed: 0,
      startle: 0,
      dwell: 0,
      paint,
    };
  }

  drawVehicle(g, car, groundAt) {
    if (car.kind === 'logtruck') this.drawLogTruck(g, car, groundAt);
    else if (car.kind === 'snowplow') this.drawSnowplow(g, car, groundAt);
    else super.drawVehicle(g, car, groundAt);
  }

  drawLogTruck(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height * 0.85) - c.lift;
    const [ca, cb] = [c.front(0.8), c.front(1)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof);
    g.fillStyle(0xdbeaf2);
    g.fillRect(Math.round(c.dir > 0 ? cb - 6 : ca + 2), roof + 2, 4, 5);
    g.fillStyle(0x7d8286);
    g.fillRect(Math.round(c.dir > 0 ? ca - 1 : cb), roof - 4, 1, 10);
    // Trailer bed with stakes and stack of timber logs
    const [ta, tb] = [c.front(0), c.front(0.78)].sort((a, b) => a - b);
    g.fillStyle(0x3b3f44);
    g.fillRect(Math.round(ta), sill - 2, Math.round(tb - ta), 2);
    const top = c.base - Math.round(car.height) - c.lift;
    g.fillStyle(0x7a5638);
    for (let row = 0, ly = sill - 5; ly > top; ly -= 4, row++) {
      g.fillRect(Math.round(ta) + row, ly, Math.round(tb - ta) - row * 2, 4);
    }
    g.fillStyle(0x5a3e2a);
    for (let ly = sill - 5; ly > top; ly -= 4) {
      g.fillRect(Math.round(ta), ly + 3, Math.round(tb - ta), 1);
    }
    g.fillStyle(0xc9a46a);
    const tail = c.dir > 0 ? Math.round(ta) : Math.round(tb) - 2;
    for (let ly = sill - 4; ly > top; ly -= 4) {
      g.fillRect(tail, ly, 2, 2);
    }
    g.fillStyle(0x3b3f44);
    for (const t of [0.05, 0.4, 0.73]) {
      g.fillRect(Math.round(c.front(t)), top - 1, 1, sill - top);
    }
    this.lights(g, car, c, sill - 6);
    this.wheels(g, c, [0.1, 0.22, 0.6, 0.9], wheel);
    g.restore();
  }

  drawSnowplow(g, car, groundAt) {
    const c = this.chassis(g, car, groundAt);
    const wheel = 3.5;
    const sill = c.base - wheel - c.lift;
    const roof = c.base - Math.round(car.height * 0.9) - c.lift;
    // Front angled heavy snowplow blade
    const plowX = c.dir > 0 ? c.left + c.length : c.left - 6;
    g.fillStyle(0xd49b28);
    g.fillRect(plowX, sill - 6, 6, 8);
    g.fillStyle(0x222222);
    g.fillRect(plowX + (c.dir > 0 ? 4 : 0), sill - 5, 2, 6);
    // Heavy diesel cab
    const [ca, cb] = [c.front(0.6), c.front(0.96)].sort((a, b) => a - b);
    g.fillStyle(car.paint);
    g.fillRect(Math.round(ca), roof, Math.round(cb - ca), sill - roof);
    g.fillStyle(0xdbeaf2);
    g.fillRect(Math.round(c.dir > 0 ? cb - 5 : ca + 2), roof + 2, 4, 5);
    // Flashing amber roof beacon
    const flash = Math.sin(this.clock * 10) > 0;
    g.fillStyle(flash ? 0xffaa00 : 0x885500);
    g.fillRect(Math.round((ca + cb) / 2) - 1, roof - 3, 3, 3);
    // Rear salt-spreader hopper bed
    const [ha, hb] = [c.front(0.04), c.front(0.58)].sort((a, b) => a - b);
    g.fillStyle(0x3a4248);
    g.fillRect(Math.round(ha), sill - 10, Math.round(hb - ha), 10);
    g.fillStyle(0x5a646c);
    g.fillRect(Math.round(ha) + 2, sill - 12, Math.round(hb - ha) - 4, 3);
    this.lights(g, car, c, sill - 4);
    this.wheels(g, c, [0.15, 0.28, 0.8], wheel);
    g.restore();
  }
}
